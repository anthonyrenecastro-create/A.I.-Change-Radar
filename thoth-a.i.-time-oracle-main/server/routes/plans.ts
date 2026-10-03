import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ScenarioInput } from '../../shared/domain';
import { compareForecastToObserved } from '../../shared/outcome';
import { runRehearsal } from '../../shared/rehearsal';
import { CHECKLIST_TEMPLATES, TEMPLATE_DISCLAIMER } from '../../shared/templates';
import { assertOwned, ctxOf, HttpError, nowIso, notFound, requireNavigatorWrite, requireRole, type Deps } from '../http';
import { getWorkflow, listEdges, listWorkflows } from '../repo';

const item = z.object({ id: z.string().max(60).optional(), text: z.string().trim().min(1).max(400) });
const planPatch = z.object({
  title: z.string().trim().min(1).max(160),
  owner: z.string().trim().max(120),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  successCriteria: z.array(item).max(30),
  checklist: z.array(item.extend({ done: z.boolean().default(false), ownerNote: z.string().max(200).default('') })).max(60),
  testSteps: z.array(item).max(30),
  fallbackTrigger: z.string().max(1000),
  rollbackInstructions: z.string().max(2000),
  notes: z.string().max(4000),
  links: z.array(z.object({ id: z.string().max(60).optional(), label: z.string().trim().min(1).max(160), url: z.string().url().max(500).refine(u => /^https?:\/\//i.test(u), 'Links must be http(s)') })).max(30),
  revisionId: z.string().max(100),
  chosenOptionId: z.string().max(60),
}).partial();

interface PlanRow {
  id: string; tenant_id: string; decision_id: string; revision_id: string; chosen_option_id: string; title: string; owner: string; due_date: string | null; status: string;
  success_criteria_json: string; checklist_json: string; test_steps_json: string; fallback_trigger: string; rollback_instructions: string; notes: string;
  links_json: string; timeline_json: string; created_by: string; created_at: string; updated_at: string;
}

const withIds = <T extends { id?: string }>(xs: T[]) => xs.map(x => ({ ...x, id: x.id || randomUUID() }));
/** Fields covered by approval. Notes, links and checklist ticks may change after approval without withdrawing it. */
const approvalHash = (p: { revisionId: string; chosenOptionId: string; owner: string; dueDate: string | null; successCriteria: { text: string }[]; testSteps: { text: string }[]; fallbackTrigger: string; rollbackInstructions: string; checklist: { text: string }[] }) =>
  createHash('sha256').update(JSON.stringify([p.revisionId, p.chosenOptionId, p.owner, p.dueDate, p.successCriteria.map(x => x.text), p.testSteps.map(x => x.text), p.fallbackTrigger, p.rollbackInstructions, p.checklist.map(x => x.text)])).digest('hex');

export function planRouter(deps: Deps): Router {
  const r = Router();
  const { db } = deps;

  const mapPlan = (p: PlanRow) => ({
    id: p.id, decisionId: p.decision_id, revisionId: p.revision_id, chosenOptionId: p.chosen_option_id, title: p.title, owner: p.owner, dueDate: p.due_date, status: p.status,
    successCriteria: JSON.parse(p.success_criteria_json), checklist: JSON.parse(p.checklist_json), testSteps: JSON.parse(p.test_steps_json),
    fallbackTrigger: p.fallback_trigger, rollbackInstructions: p.rollback_instructions, notes: p.notes, links: JSON.parse(p.links_json), timeline: JSON.parse(p.timeline_json) as { at: string; by: string; event: string }[],
    createdAt: p.created_at, updatedAt: p.updated_at,
  });
  type Plan = ReturnType<typeof mapPlan>;

  const getPlan = (tenantId: string, id: string): PlanRow => {
    const p = db.prepare('SELECT * FROM action_plans WHERE id = ? AND tenant_id = ?').get(id, tenantId) as PlanRow | undefined;
    if (!p) throw notFound('Plan');
    return p;
  };
  const revisionOption = (tenantId: string, decisionId: string, revisionId: string, optionId: string) => {
    const rev = db.prepare('SELECT input_json, result_json, revision_no FROM scenario_revisions WHERE id = ? AND decision_id = ? AND tenant_id = ?').get(revisionId, decisionId, tenantId) as { input_json: string; result_json: string; revision_no: number } | undefined;
    if (!rev) throw new HttpError(422, 'Revision does not belong to this decision', 'invalid_reference');
    const input = JSON.parse(rev.input_json) as ScenarioInput;
    if (!input.options.some(o => o.id === optionId)) throw new HttpError(422, 'Option is not part of that revision', 'invalid_reference');
    return { input, result: JSON.parse(rev.result_json), revisionNo: rev.revision_no };
  };
  const readiness = (p: Plan): string[] => {
    const m: string[] = [];
    if (!p.owner) m.push('Action owner');
    if (!p.dueDate) m.push('Due date');
    if (!p.successCriteria.length) m.push('At least one success criterion');
    if (!p.testSteps.length) m.push('At least one pre-migration test step');
    if (!p.fallbackTrigger.trim()) m.push('Fallback trigger');
    if (!p.rollbackInstructions.trim()) m.push('Rollback instructions');
    return m;
  };
  const log = (p: Plan, by: string, event: string) => [...p.timeline, { at: nowIso(), by, event }];
  const save = (tenantId: string, id: string, fields: Record<string, unknown>) => {
    const keys = Object.keys(fields);
    db.prepare(`UPDATE action_plans SET ${keys.map(k => `${k}=@${k}`).join(',')}, updated_at=@updated_at WHERE id=@id AND tenant_id=@tenant_id`).run({ ...fields, updated_at: nowIso(), id, tenant_id: tenantId });
  };
  const detail = (tenantId: string, id: string) => {
    const p = mapPlan(getPlan(tenantId, id));
    const d = db.prepare('SELECT title, workflow_id, change_id FROM decision_records WHERE id = ? AND tenant_id = ?').get(p.decisionId, tenantId) as { title: string; workflow_id: string; change_id: string | null };
    const opt = revisionOption(tenantId, p.decisionId, p.revisionId, p.chosenOptionId);
    const latest = db.prepare('SELECT id, revision_no FROM scenario_revisions WHERE decision_id = ? AND tenant_id = ? ORDER BY revision_no DESC LIMIT 1').get(p.decisionId, tenantId) as { id: string; revision_no: number };
    const approvals = db.prepare('SELECT approved_by AS approvedBy, approved_at AS approvedAt, revision_id AS revisionId, plan_hash AS planHash FROM plan_approvals WHERE plan_id = ? AND tenant_id = ? ORDER BY approved_at').all(id, tenantId);
    const o = db.prepare('SELECT * FROM outcomes WHERE plan_id = ? AND tenant_id = ?').get(id, tenantId) as Record<string, any> | undefined;
    const option = opt.input.options.find(x => x.id === p.chosenOptionId)!;
    const optionResult = opt.result.options.find((x: { optionId: string }) => x.optionId === p.chosenOptionId);
    const wf = getWorkflow(db, tenantId, d.workflow_id)!;
    let outcome = null as null | Record<string, unknown>;
    if (o) {
      const observed = { spendBefore: o.spend_before, spendAfter: o.spend_after, currency: o.currency, period: o.measurement_period, scope: o.scope, migrationHours: o.migration_hours };
      outcome = {
        id: o.id, ...observed, downtimeMinutes: o.downtime_minutes, criteriaResults: JSON.parse(o.criteria_results_json), unexpected: o.unexpected, lessons: o.lessons, recordedAt: o.recorded_at, recordedBy: o.recorded_by,
        comparisons: compareForecastToObserved({ expectedMonthlyRecurring: optionResult?.cases.expected.monthlyRecurring ?? null, currency: opt.input.currency, scope: 'workflow', period: 'monthly', migrationHours: option.migrationHours }, observed),
      };
    }
    return {
      plan: p, decisionTitle: d.title, changeId: d.change_id, workflow: wf, revisionNo: opt.revisionNo, latestRevisionNo: latest.revision_no, newerRevisionAvailable: latest.id !== p.revisionId,
      latestRevisionId: latest.id, option: { id: option.id, kind: option.kind, label: option.label, assumptions: option.assumptions }, forecast: optionResult ?? null, currency: opt.input.currency,
      approvals, readinessMissing: readiness(p), outcome,
    };
  };

  r.get('/templates', (_req, res) => res.json({ disclaimer: TEMPLATE_DISCLAIMER, templates: CHECKLIST_TEMPLATES }));

  r.get('/plans', (req, res) => {
    const c = ctxOf(req);
    const rows = db.prepare(`SELECT p.id, p.title, p.status, p.owner, p.due_date AS dueDate, p.decision_id AS decisionId, w.name AS workflowName,
      EXISTS(SELECT 1 FROM outcomes o WHERE o.plan_id = p.id AND o.tenant_id = p.tenant_id) AS hasOutcome
      FROM action_plans p JOIN decision_records d ON d.id = p.decision_id AND d.tenant_id = p.tenant_id JOIN workflows w ON w.id = d.workflow_id AND w.tenant_id = p.tenant_id
      WHERE p.tenant_id = ? ORDER BY p.created_at DESC`).all(c.tenantId);
    res.json({ plans: rows });
  });

  r.post('/plans', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    const body = z.object({ decisionId: z.string().min(1).max(100), revisionId: z.string().max(100).optional(), chosenOptionId: z.string().min(1).max(60), templateId: z.string().max(60).optional(), title: z.string().trim().max(160).optional() }).parse(req.body);
    assertOwned(db, 'decision_records', body.decisionId, c.tenantId, 'Decision');
    const latest = db.prepare('SELECT id FROM scenario_revisions WHERE decision_id = ? AND tenant_id = ? ORDER BY revision_no DESC LIMIT 1').get(body.decisionId, c.tenantId) as { id: string };
    const revisionId = body.revisionId ?? latest.id;
    const { input } = revisionOption(c.tenantId, body.decisionId, revisionId, body.chosenOptionId);
    const tpl = body.templateId ? CHECKLIST_TEMPLATES.find(t => t.id === body.templateId) : undefined;
    if (body.templateId && !tpl) throw notFound('Template');
    const label = input.options.find(o => o.id === body.chosenOptionId)!.label;
    const id = randomUUID();
    const now = nowIso();
    db.prepare(`INSERT INTO action_plans (id, tenant_id, decision_id, revision_id, chosen_option_id, title, checklist_json, test_steps_json, timeline_json, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, c.tenantId, body.decisionId, revisionId, body.chosenOptionId, body.title || `Plan: ${label}`,
      JSON.stringify((tpl?.items ?? []).map(text => ({ id: randomUUID(), text, done: false, ownerNote: '' }))), JSON.stringify((tpl?.testSteps ?? []).map(text => ({ id: randomUUID(), text }))),
      JSON.stringify([{ at: now, by: c.email, event: tpl ? `Created from generic template "${tpl.name}" (unverified starting point)` : 'Created' }]), c.userId, now, now);
    res.status(201).json(detail(c.tenantId, id));
  });

  r.get('/plans/:id', (req, res) => res.json(detail(ctxOf(req).tenantId, req.params.id as string)));

  r.patch('/plans/:id', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    const row = getPlan(c.tenantId, req.params.id as string);
    if (row.status === 'done' || row.status === 'cancelled') throw new HttpError(409, `A ${row.status} plan can no longer be edited`, 'locked');
    const b = planPatch.parse(req.body);
    const cur = mapPlan(row);
    const next = {
      ...cur, ...b,
      successCriteria: b.successCriteria ? withIds(b.successCriteria) : cur.successCriteria,
      testSteps: b.testSteps ? withIds(b.testSteps) : cur.testSteps,
      checklist: b.checklist ? withIds(b.checklist) : cur.checklist,
      links: b.links ? withIds(b.links) : cur.links,
    };
    if (b.revisionId || b.chosenOptionId) revisionOption(c.tenantId, cur.decisionId, next.revisionId, next.chosenOptionId);
    const hashChanged = approvalHash(cur) !== approvalHash(next);
    let status = cur.status;
    let timeline = cur.timeline;
    if (hashChanged && ['in_review', 'approved', 'in_progress'].includes(cur.status)) {
      status = 'draft';
      timeline = log(cur, c.email, `Plan content changed after ${cur.status === 'in_review' ? 'submission' : 'approval'}; returned to draft and needs review again`);
    }
    save(c.tenantId, row.id, {
      title: next.title, owner: next.owner, due_date: next.dueDate, status, success_criteria_json: JSON.stringify(next.successCriteria), checklist_json: JSON.stringify(next.checklist),
      test_steps_json: JSON.stringify(next.testSteps), fallback_trigger: next.fallbackTrigger, rollback_instructions: next.rollbackInstructions, notes: next.notes,
      links_json: JSON.stringify(next.links), revision_id: next.revisionId, chosen_option_id: next.chosenOptionId, timeline_json: JSON.stringify(timeline),
    });
    res.json(detail(c.tenantId, row.id));
  });

  const transition = (name: string, from: string[], to: string, role: 'editor' | 'admin', extra?: (p: Plan, c: ReturnType<typeof ctxOf>) => void) =>
    r.post(`/plans/:id/${name}`, requireNavigatorWrite, requireRole(role), (req, res) => {
      const c = ctxOf(req);
      const row = getPlan(c.tenantId, req.params.id as string);
      const p = mapPlan(row);
      if (!from.includes(p.status)) throw new HttpError(409, `Cannot ${name} a plan that is ${p.status}`, 'invalid_transition');
      extra?.(p, c);
      save(c.tenantId, row.id, { status: to, timeline_json: JSON.stringify(log(p, c.email, `Status: ${p.status} → ${to}`)) });
      res.json(detail(c.tenantId, row.id));
    });

  transition('submit', ['draft'], 'in_review', 'editor', p => {
    const missing = readiness(p);
    if (missing.length) throw new HttpError(422, `Plan is incomplete: ${missing.join('; ')}`, 'plan_incomplete');
  });
  transition('return', ['in_review'], 'draft', 'admin');
  transition('start', ['approved'], 'in_progress', 'editor');
  transition('cancel', ['draft', 'in_review', 'approved', 'in_progress'], 'cancelled', 'editor');

  // Approval is human-only (admin/owner), checks readiness, and records the exact plan content hash and revision.
  r.post('/plans/:id/approve', requireNavigatorWrite, requireRole('admin'), (req, res) => {
    const c = ctxOf(req);
    const row = getPlan(c.tenantId, req.params.id as string);
    const p = mapPlan(row);
    if (p.status !== 'in_review') throw new HttpError(409, 'Only plans in review can be approved', 'invalid_transition');
    const missing = readiness(p);
    if (missing.length) throw new HttpError(422, `Plan is incomplete: ${missing.join('; ')}`, 'plan_incomplete');
    db.transaction(() => {
      db.prepare('INSERT INTO plan_approvals (id, tenant_id, plan_id, revision_id, approved_by, approved_at, plan_hash) VALUES (?,?,?,?,?,?,?)')
        .run(randomUUID(), c.tenantId, p.id, p.revisionId, c.email, nowIso(), approvalHash(p));
      save(c.tenantId, row.id, { status: 'approved', timeline_json: JSON.stringify(log(p, c.email, 'Approved against scenario revision')) });
    })();
    res.json(detail(c.tenantId, row.id));
  });

  r.put('/plans/:id/outcome', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    const row = getPlan(c.tenantId, req.params.id as string);
    const p = mapPlan(row);
    if (!['in_progress', 'done'].includes(p.status)) throw new HttpError(409, 'Outcomes can be recorded once the approved plan is in progress', 'invalid_transition');
    const n = z.number().finite().min(0).max(1e12).nullable();
    const b = z.object({
      spendBefore: n, spendAfter: n, currency: z.string().regex(/^[A-Z]{3}$/), period: z.enum(['monthly', 'quarterly', 'annual', 'other']), scope: z.enum(['workflow', 'vendor_account', 'organization']),
      migrationHours: n, downtimeMinutes: n,
      criteriaResults: z.array(z.object({ criterionId: z.string().max(60), met: z.boolean().nullable() })).max(30),
      unexpected: z.string().max(3000), lessons: z.string().max(3000),
    }).parse(req.body);
    const known = new Set(p.successCriteria.map((x: { id: string }) => x.id));
    if (b.criteriaResults.some(x => !known.has(x.criterionId))) throw new HttpError(422, 'Unknown success criterion', 'invalid_reference');
    const now = nowIso();
    const existing = db.prepare('SELECT id FROM outcomes WHERE plan_id = ? AND tenant_id = ?').get(p.id, c.tenantId) as { id: string } | undefined;
    const vals = { spend_before: b.spendBefore, spend_after: b.spendAfter, currency: b.currency, measurement_period: b.period, scope: b.scope, migration_hours: b.migrationHours, downtime_minutes: b.downtimeMinutes,
      criteria_results_json: JSON.stringify(b.criteriaResults), unexpected: b.unexpected, lessons: b.lessons };
    db.transaction(() => {
      if (existing) db.prepare(`UPDATE outcomes SET ${Object.keys(vals).map(k => `${k}=@${k}`).join(',')}, updated_at=@now WHERE id=@id AND tenant_id=@tid`).run({ ...vals, now, id: existing.id, tid: c.tenantId });
      else db.prepare(`INSERT INTO outcomes (id, tenant_id, plan_id, ${Object.keys(vals).join(',')}, recorded_by, recorded_at, updated_at) VALUES (@id,@tid,@pid,${Object.keys(vals).map(k => '@' + k).join(',')},@by,@now,@now)`)
        .run({ ...vals, id: randomUUID(), tid: c.tenantId, pid: p.id, by: c.email, now });
      save(c.tenantId, p.id, { status: 'done', timeline_json: JSON.stringify(log(p, c.email, existing ? 'Outcome updated' : 'Outcome recorded; plan marked done')) });
    })();
    res.json(detail(c.tenantId, p.id));
  });

  /* ---- Tabletop rehearsals: stored only in `rehearsals`, never in the change feed ---- */
  r.get('/rehearsals', (req, res) => {
    const c = ctxOf(req);
    const rows = db.prepare('SELECT id, params_json, result_json, created_at, created_by FROM rehearsals WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50').all(c.tenantId) as
      { id: string; params_json: string; result_json: string; created_at: string; created_by: string }[];
    res.json({ rehearsals: rows.map(x => ({ id: x.id, params: JSON.parse(x.params_json), result: JSON.parse(x.result_json), createdAt: x.created_at, createdBy: x.created_by })) });
  });

  r.post('/rehearsals', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    const b = z.object({
      kind: z.enum(['model_retirement', 'price_increase', 'vendor_outage']), vendor: z.string().trim().min(1).max(120),
      model: z.string().trim().max(120).optional(), percent: z.number().finite().min(0).max(1000).optional(), durationHours: z.number().finite().min(0).max(8760).optional(),
    }).superRefine((v, ctx) => {
      if (v.kind === 'model_retirement' && !v.model) ctx.addIssue({ code: 'custom', message: 'A model is required for a retirement rehearsal' });
      if (v.kind === 'price_increase' && v.percent === undefined) ctx.addIssue({ code: 'custom', message: 'A percentage is required for a price rehearsal' });
    }).parse(req.body);
    const result = runRehearsal(b, listWorkflows(db, c.tenantId), listEdges(db, c.tenantId));
    const id = randomUUID();
    db.prepare('INSERT INTO rehearsals (id, tenant_id, params_json, result_json, created_by, created_at) VALUES (?,?,?,?,?,?)').run(id, c.tenantId, JSON.stringify(b), JSON.stringify(result), c.email, nowIso());
    res.status(201).json({ id, params: b, result });
  });

  return r;
}
