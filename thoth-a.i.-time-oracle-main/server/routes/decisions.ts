import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ScenarioInput, Workflow } from '../../shared/domain';
import { blankOption, computeScenario, SCENARIO_MATH_VERSION } from '../../shared/scenario';
import { assertOwned, ctxOf, feedAccess, HttpError, nowIso, notFound, requireNavigatorWrite, type Deps } from '../http';
import { getWorkflow } from '../repo';

const sourced = z.object({
  value: z.number().finite().min(0).max(1e12).nullable(),
  source: z.enum(['user_entered', 'evidence']),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  evidenceUrl: z.string().url().max(500).refine(u => /^https?:\/\//i.test(u), 'Evidence URL must be http(s)').optional(),
}).refine(v => v.value === null || v.asOf !== null, { message: 'Entered figures need a date (asOf)' })
  .refine(v => v.source !== 'evidence' || v.value === null || !!v.evidenceUrl, { message: 'Evidence-backed figures need an evidence URL' });
const vol = z.number().finite().min(0).max(1e15).nullable();
const volumes = z.object({ inputTokens: vol, outputTokens: vol, seats: vol, otherUsageUnits: vol });

export const scenarioInputSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  horizonMonths: z.number().int().min(1).max(120),
  notes: z.string().max(2000).default(''),
  baselineMonthlySpend: sourced,
  options: z.array(z.object({
    id: z.string().min(1).max(60),
    kind: z.enum(['keep', 'modify', 'alternative', 'fallback']),
    label: z.string().trim().min(1).max(120),
    vendor: z.string().max(120), model: z.string().max(120),
    inputRatePerMTok: sourced, outputRatePerMTok: sourced, pricePerSeatMonth: sourced, fixedMonthlyCost: sourced,
    volumes: z.object({ low: volumes, expected: volumes, high: volumes }),
    migrationHours: z.number().finite().min(0).max(100000).nullable(),
    hourlyRate: sourced,
    otherOneTimeCosts: z.array(z.object({ id: z.string().max(60), label: z.string().max(120), amount: z.number().finite().min(0).max(1e12).nullable() })).max(20),
    requirementFit: z.record(z.string(), z.enum(['met', 'unmet', 'unknown'])),
    tradeoffs: z.string().max(2000), assumptions: z.string().max(2000), evidenceNotes: z.string().max(2000),
  })).min(1).max(8),
}).superRefine((v, ctx) => {
  if (new Set(v.options.map(o => o.id)).size !== v.options.length) ctx.addIssue({ code: 'custom', message: 'Option ids must be unique' });
});

export function defaultScenario(w: Workflow): ScenarioInput {
  const keep = blankOption('keep', 'keep', 'Keep the current setup');
  keep.vendor = w.vendor; keep.model = w.model;
  const fb = blankOption('fallback', 'fallback', 'Use fallback or manual process');
  fb.tradeoffs = w.fallbackDetail;
  return {
    currency: w.currency, horizonMonths: 12, notes: '',
    baselineMonthlySpend: { value: w.monthlySpend, source: 'user_entered', asOf: w.spendAsOf },
    options: [keep, blankOption('modify', 'modify', 'Modify usage or configuration'), blankOption('alternative', 'alternative', 'Move to an alternative you choose'), fb],
  };
}

const hashOf = (input: unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex');

export function decisionRouter(deps: Deps): Router {
  const r = Router();
  const { db, feed } = deps;

  const saveRevision = (tenantId: string, userId: string, decisionId: string, input: ScenarioInput, wf: Workflow, note: string) => {
    const reqIds = new Set(wf.requirements.map(x => x.id));
    for (const o of input.options) for (const k of Object.keys(o.requirementFit)) if (!reqIds.has(k)) throw new HttpError(422, `Unknown requirement id in option "${o.label}"`, 'invalid_reference');
    const hash = hashOf(input);
    const result = computeScenario(input, wf.requirements);
    const last = db.prepare('SELECT revision_no, content_hash FROM scenario_revisions WHERE decision_id = ? AND tenant_id = ? ORDER BY revision_no DESC LIMIT 1').get(decisionId, tenantId) as { revision_no: number; content_hash: string } | undefined;
    if (last?.content_hash === hash) throw new HttpError(409, 'No assumptions changed since the latest revision', 'no_change');
    const id = randomUUID();
    const no = (last?.revision_no ?? 0) + 1;
    db.prepare(`INSERT INTO scenario_revisions (id, tenant_id, decision_id, revision_no, input_json, result_json, math_version, content_hash, change_note, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, tenantId, decisionId, no, JSON.stringify(input), JSON.stringify(result), SCENARIO_MATH_VERSION, hash, note, userId, nowIso());
    return { id, revisionNo: no };
  };

  const loadRevision = (tenantId: string, decisionId: string, no?: number) => {
    const row = (no === undefined
      ? db.prepare('SELECT * FROM scenario_revisions WHERE decision_id = ? AND tenant_id = ? ORDER BY revision_no DESC LIMIT 1').get(decisionId, tenantId)
      : db.prepare('SELECT * FROM scenario_revisions WHERE decision_id = ? AND tenant_id = ? AND revision_no = ?').get(decisionId, tenantId, no)) as Record<string, string | number> | undefined;
    if (!row) throw notFound('Revision');
    return {
      id: row.id as string, revisionNo: row.revision_no as number, input: JSON.parse(row.input_json as string) as ScenarioInput, result: JSON.parse(row.result_json as string),
      mathVersion: row.math_version as string, contentHash: row.content_hash as string, changeNote: row.change_note as string, createdBy: row.created_by as string, createdAt: row.created_at as string,
    };
  };

  r.get('/decisions', (req, res) => {
    const c = ctxOf(req);
    const rows = db.prepare(`SELECT d.id, d.title, d.created_at AS createdAt, d.workflow_id AS workflowId, w.name AS workflowName, d.change_id AS changeId,
      (SELECT MAX(revision_no) FROM scenario_revisions s WHERE s.decision_id = d.id AND s.tenant_id = d.tenant_id) AS latestRevisionNo,
      (SELECT COUNT(*) FROM action_plans p WHERE p.decision_id = d.id AND p.tenant_id = d.tenant_id) AS planCount
      FROM decision_records d JOIN workflows w ON w.id = d.workflow_id AND w.tenant_id = d.tenant_id WHERE d.tenant_id = ? ORDER BY d.created_at DESC`).all(c.tenantId);
    res.json({ decisions: rows });
  });

  r.post('/decisions', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    const body = z.object({ workflowId: z.string().min(1).max(100), changeId: z.string().max(100).nullable().default(null), title: z.string().trim().max(160).default('') }).parse(req.body);
    assertOwned(db, 'workflows', body.workflowId, c.tenantId, 'Workflow');
    const wf = getWorkflow(db, c.tenantId, body.workflowId)!;
    if (wf.archived) throw new HttpError(422, 'Workflow is archived', 'archived');
    let changeTitle = '';
    if (body.changeId) {
      // Only changes this tenant may read from the feed can be referenced; simulated events are never accepted.
      const ch = feed.getChange(feedAccess(c), body.changeId);
      if (!ch) throw notFound('Change');
      changeTitle = ch.title;
    }
    const id = randomUUID();
    const title = body.title || (changeTitle ? `${wf.name}: ${changeTitle}` : `${wf.name}: options review`);
    const out = db.transaction(() => {
      db.prepare('INSERT INTO decision_records (id, tenant_id, workflow_id, change_id, title, created_by, created_at) VALUES (?,?,?,?,?,?,?)').run(id, c.tenantId, wf.id, body.changeId, title, c.userId, nowIso());
      return saveRevision(c.tenantId, c.userId, id, defaultScenario(wf), wf, 'Initial revision from workflow inventory');
    })();
    res.status(201).json({ id, title, revisionNo: out.revisionNo });
  });

  r.get('/decisions/:id', (req, res) => {
    const c = ctxOf(req);
    assertOwned(db, 'decision_records', req.params.id, c.tenantId, 'Decision');
    const d = db.prepare('SELECT id, title, workflow_id, change_id, created_at, created_by FROM decision_records WHERE id = ? AND tenant_id = ?').get(req.params.id, c.tenantId) as
      { id: string; title: string; workflow_id: string; change_id: string | null; created_at: string; created_by: string };
    const revisions = db.prepare('SELECT revision_no AS revisionNo, change_note AS changeNote, created_by AS createdBy, created_at AS createdAt, content_hash AS contentHash, id FROM scenario_revisions WHERE decision_id = ? AND tenant_id = ? ORDER BY revision_no DESC').all(d.id, c.tenantId);
    const change = d.change_id ? (db.prepare('SELECT id, title, vendor_name AS vendorName, kind FROM published_changes WHERE id = ?').get(d.change_id) ?? null) : null;
    const requestedNo = req.query.revision ? Number(req.query.revision) : undefined;
    const plans = db.prepare('SELECT id, title, status, revision_id AS revisionId FROM action_plans WHERE decision_id = ? AND tenant_id = ?').all(d.id, c.tenantId);
    res.json({
      id: d.id, title: d.title, createdAt: d.created_at, change, workflow: getWorkflow(db, c.tenantId, d.workflow_id), revisions,
      revision: loadRevision(c.tenantId, d.id, requestedNo), plans,
    });
  });

  // Revisions are append-only: there is no update route. Any changed assumption creates a new numbered revision.
  r.post('/decisions/:id/revisions', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    assertOwned(db, 'decision_records', req.params.id, c.tenantId, 'Decision');
    const body = z.object({ input: scenarioInputSchema, changeNote: z.string().trim().max(500).default('') }).parse(req.body);
    const d = db.prepare('SELECT workflow_id FROM decision_records WHERE id = ? AND tenant_id = ?').get(req.params.id, c.tenantId) as { workflow_id: string };
    const wf = getWorkflow(db, c.tenantId, d.workflow_id)!;
    const out = saveRevision(c.tenantId, c.userId, req.params.id as string, body.input as ScenarioInput, wf, body.changeNote);
    res.status(201).json({ ...out, revision: loadRevision(c.tenantId, req.params.id as string, out.revisionNo) });
  });

  return r;
}

export { hashOf };
