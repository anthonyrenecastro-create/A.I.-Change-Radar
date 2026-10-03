import { randomUUID } from 'node:crypto';
import type { Db } from './db';
import type { ExposureMatch, PublishedChange, Workflow, WorkflowDependency } from '../shared/domain';
import { matchChange } from '../shared/matching';
import { nowIso } from './http';

interface WfRow {
  id: string; tenant_id: string; name: string; purpose: string; business_owner: string; criticality: Workflow['criticality']; vendor: string; model: string;
  integration_method: Workflow['integrationMethod']; monthly_usage: number | null; usage_unit: string; monthly_spend: number | null; currency: string;
  spend_as_of: string | null; user_count: number | null; data_sensitivity: Workflow['dataSensitivity']; requirements_json: string;
  fallback_type: Workflow['fallbackType']; fallback_detail: string; notes: string; archived: number; created_at: string; updated_at: string;
}

export const mapWorkflow = (r: WfRow): Workflow => ({
  id: r.id, tenantId: r.tenant_id, name: r.name, purpose: r.purpose, businessOwner: r.business_owner, criticality: r.criticality, vendor: r.vendor, model: r.model,
  integrationMethod: r.integration_method, monthlyUsage: r.monthly_usage, usageUnit: r.usage_unit, monthlySpend: r.monthly_spend, currency: r.currency,
  spendAsOf: r.spend_as_of, userCount: r.user_count, dataSensitivity: r.data_sensitivity, requirements: JSON.parse(r.requirements_json),
  fallbackType: r.fallback_type, fallbackDetail: r.fallback_detail, notes: r.notes, archived: r.archived === 1, createdAt: r.created_at, updatedAt: r.updated_at,
});

export function listWorkflows(db: Db, tenantId: string, includeArchived = false): Workflow[] {
  const rows = db.prepare(`SELECT * FROM workflows WHERE tenant_id = ? ${includeArchived ? '' : 'AND archived = 0'} ORDER BY name`).all(tenantId) as WfRow[];
  return rows.map(mapWorkflow);
}

export function getWorkflow(db: Db, tenantId: string, id: string): Workflow | null {
  const r = db.prepare('SELECT * FROM workflows WHERE id = ? AND tenant_id = ?').get(id, tenantId) as WfRow | undefined;
  return r ? mapWorkflow(r) : null;
}

export function listEdges(db: Db, tenantId: string): WorkflowDependency[] {
  return (db.prepare('SELECT id, workflow_id, depends_on_workflow_id, note FROM workflow_dependencies WHERE tenant_id = ?').all(tenantId) as
    { id: string; workflow_id: string; depends_on_workflow_id: string; note: string }[])
    .map(r => ({ id: r.id, workflowId: r.workflow_id, dependsOnWorkflowId: r.depends_on_workflow_id, note: r.note }));
}

/** Recomputes matches for one change and persists them, carrying forward the customer's review decisions. */
export function syncExposure(db: Db, tenantId: string, change: PublishedChange): ExposureMatch[] {
  const workflows = listWorkflows(db, tenantId);
  const existing = db.prepare('SELECT id, workflow_id, review_state FROM exposure_matches WHERE tenant_id = ? AND change_id = ?').all(tenantId, change.id) as
    { id: string; workflow_id: string; review_state: ExposureMatch['reviewState'] }[];
  const review = new Map(existing.map(e => [e.workflow_id, e]));
  const dismissed = new Set(existing.filter(e => e.review_state === 'dismissed').map(e => e.workflow_id));
  const matches = matchChange(change, workflows, listEdges(db, tenantId), dismissed);
  const now = nowIso();
  db.transaction(() => {
    const keep = new Set(matches.map(m => m.workflowId));
    for (const e of existing) if (!keep.has(e.workflow_id)) db.prepare('DELETE FROM exposure_matches WHERE id = ? AND tenant_id = ?').run(e.id, tenantId);
    for (const m of matches) {
      const prior = review.get(m.workflowId);
      m.id = prior?.id ?? randomUUID();
      // Dismissal is only meaningful for possible matches; a confirmed or incomplete match is never hidden by an old review.
      m.reviewState = m.status === 'possible' ? prior?.review_state ?? 'unreviewed' : 'unreviewed';
      db.prepare(`INSERT INTO exposure_matches (id, tenant_id, change_id, workflow_id, status, rule, explanation, via_workflow_id, review_state, computed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(tenant_id, change_id, workflow_id) DO UPDATE SET status=excluded.status, rule=excluded.rule, explanation=excluded.explanation,
          via_workflow_id=excluded.via_workflow_id, review_state=excluded.review_state, computed_at=excluded.computed_at`)
        .run(m.id, tenantId, change.id, m.workflowId, m.status, m.rule, m.explanation, m.viaWorkflowId ?? null, m.reviewState, now);
    }
  })();
  return matches;
}
