import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CRITICALITIES, INTEGRATIONS, SENSITIVITIES } from '../../shared/domain';
import { wouldCreateCycle } from '../../shared/graph';
import { NAVIGATOR_PLANS } from '../commercial';
import { assertOwned, ctxOf, HttpError, nowIso, notFound, requireNavigatorWrite, type Deps } from '../http';
import { getWorkflow, listEdges, listWorkflows } from '../repo';

const nonNeg = z.number().finite().min(0).max(1e12).nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const workflowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  purpose: z.string().max(1000).default(''),
  businessOwner: z.string().max(120).default(''),
  criticality: z.enum(CRITICALITIES as [string, ...string[]]),
  vendor: z.string().trim().max(120).default(''),
  model: z.string().trim().max(120).default(''),
  integrationMethod: z.enum(INTEGRATIONS as [string, ...string[]]).default('unknown'),
  monthlyUsage: nonNeg.default(null),
  usageUnit: z.string().max(60).default(''),
  monthlySpend: nonNeg.default(null),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  spendAsOf: isoDate.default(null),
  userCount: z.number().int().min(0).max(1e7).nullable().default(null),
  dataSensitivity: z.enum(SENSITIVITIES as [string, ...string[]]).default('unknown'),
  requirements: z.array(z.object({ id: z.string().max(60).optional(), text: z.string().trim().min(1).max(300) })).max(30).default([]),
  fallbackType: z.enum(['none', 'vendor', 'manual']).default('none'),
  fallbackDetail: z.string().max(500).default(''),
  notes: z.string().max(2000).default(''),
});

const cols = (b: z.infer<typeof workflowSchema>) => ({
  name: b.name, purpose: b.purpose, business_owner: b.businessOwner, criticality: b.criticality, vendor: b.vendor, model: b.model,
  integration_method: b.integrationMethod, monthly_usage: b.monthlyUsage, usage_unit: b.usageUnit, monthly_spend: b.monthlySpend, currency: b.currency,
  spend_as_of: b.spendAsOf, user_count: b.userCount, data_sensitivity: b.dataSensitivity,
  requirements_json: JSON.stringify(b.requirements.map(r => ({ id: r.id || randomUUID(), text: r.text }))),
  fallback_type: b.fallbackType, fallback_detail: b.fallbackDetail, notes: b.notes,
});

export function workflowRouter(deps: Deps): Router {
  const r = Router();
  const { db } = deps;

  r.get('/workflows', (req, res) => {
    const c = ctxOf(req);
    res.json({ workflows: listWorkflows(db, c.tenantId), dependencies: listEdges(db, c.tenantId) });
  });

  r.post('/workflows', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    const limit = NAVIGATOR_PLANS[c.entitlements.navigatorPlan].workflowLimit;
    const count = (db.prepare('SELECT COUNT(*) n FROM workflows WHERE tenant_id = ? AND archived = 0').get(c.tenantId) as { n: number }).n;
    if (limit !== null && count >= limit) throw new HttpError(402, `Your plan allows up to ${limit} workflows`, 'plan_limit');
    const body = workflowSchema.parse(req.body);
    const id = randomUUID();
    const now = nowIso();
    const v = { id, tenant_id: c.tenantId, ...cols(body), archived: 0, created_at: now, updated_at: now };
    db.prepare(`INSERT INTO workflows (${Object.keys(v).join(',')}) VALUES (${Object.keys(v).map(k => '@' + k).join(',')})`).run(v);
    res.status(201).json(getWorkflow(db, c.tenantId, id));
  });

  r.put('/workflows/:id', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    assertOwned(db, 'workflows', req.params.id, c.tenantId, 'Workflow');
    const body = workflowSchema.parse(req.body);
    const v = { id: req.params.id, tenant_id: c.tenantId, ...cols(body), updated_at: nowIso() };
    db.prepare(`UPDATE workflows SET ${Object.keys(cols(body)).map(k => `${k}=@${k}`).join(',')}, updated_at=@updated_at WHERE id=@id AND tenant_id=@tenant_id`).run(v);
    res.json(getWorkflow(db, c.tenantId, req.params.id as string));
  });

  // Archived rather than deleted so decision history keeps its links.
  r.delete('/workflows/:id', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    assertOwned(db, 'workflows', req.params.id, c.tenantId, 'Workflow');
    db.prepare('UPDATE workflows SET archived = 1, updated_at = ? WHERE id = ? AND tenant_id = ?').run(nowIso(), req.params.id, c.tenantId);
    db.prepare('DELETE FROM workflow_dependencies WHERE tenant_id = ? AND (workflow_id = ? OR depends_on_workflow_id = ?)').run(c.tenantId, req.params.id, req.params.id);
    res.json({ ok: true });
  });

  r.post('/workflows/:id/dependencies', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    const body = z.object({ dependsOnWorkflowId: z.string().min(1).max(100), note: z.string().max(300).default('') }).parse(req.body);
    assertOwned(db, 'workflows', req.params.id, c.tenantId, 'Workflow');
    assertOwned(db, 'workflows', body.dependsOnWorkflowId, c.tenantId, 'Dependency target');
    const edges = listEdges(db, c.tenantId);
    if (edges.some(e => e.workflowId === req.params.id && e.dependsOnWorkflowId === body.dependsOnWorkflowId)) throw new HttpError(409, 'Dependency already exists', 'duplicate');
    if (wouldCreateCycle(edges, req.params.id as string, body.dependsOnWorkflowId)) throw new HttpError(422, 'This dependency would create a cycle', 'dependency_cycle');
    const id = randomUUID();
    db.prepare('INSERT INTO workflow_dependencies (id, tenant_id, workflow_id, depends_on_workflow_id, note) VALUES (?,?,?,?,?)').run(id, c.tenantId, req.params.id, body.dependsOnWorkflowId, body.note);
    res.status(201).json({ id, workflowId: req.params.id, dependsOnWorkflowId: body.dependsOnWorkflowId, note: body.note });
  });

  r.delete('/dependencies/:depId', requireNavigatorWrite, (req, res) => {
    const c = ctxOf(req);
    const result = db.prepare('DELETE FROM workflow_dependencies WHERE id = ? AND tenant_id = ?').run(req.params.depId, c.tenantId);
    if (!result.changes) throw notFound('Dependency');
    res.json({ ok: true });
  });

  return r;
}
