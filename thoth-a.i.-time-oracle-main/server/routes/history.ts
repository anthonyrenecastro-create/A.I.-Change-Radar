import { Router } from 'express';
import type { Db } from '../db';
import type { PublishedChange } from '../../shared/domain';
import { ctxOf, type Deps } from '../http';

interface HistRow {
  decision_id: string; title: string; created_at: string; workflow_id: string; workflow_name: string; workflow_vendor: string; change_id: string | null;
  plan_id: string | null; plan_status: string | null; plan_title: string | null; plan_revision_id: string | null; plan_revision_no: number | null;
  latest_revision_no: number; outcome_id: string | null; success_json: string | null; unexpected: string | null; lessons: string | null; recorded_at: string | null;
}

export interface HistoryEntry {
  decisionId: string; title: string; createdAt: string;
  vendorChange: { id: string; title: string; vendor: string; kind: string } | null;
  workflow: { id: string; name: string; vendor: string };
  latestRevisionNo: number;
  plans: { id: string; title: string; status: string; revisionNo: number }[];
  outcome: { planId: string; recordedAt: string; successMet: 'yes' | 'no' | 'partial' | 'unrecorded'; unexpected: string; lessons: string } | null;
}

export function successSummary(json: string | null): 'yes' | 'no' | 'partial' | 'unrecorded' {
  const results = json ? JSON.parse(json) as { met: boolean | null }[] : [];
  if (!results.length || results.every(r => r.met === null)) return 'unrecorded';
  if (results.every(r => r.met === true)) return 'yes';
  if (results.some(r => r.met === false) && !results.some(r => r.met === true)) return 'no';
  return 'partial';
}

export function loadHistory(db: Db, tenantId: string, lookupChange: (id: string) => PublishedChange | null): HistoryEntry[] {
  const rows = db.prepare(`
    SELECT d.id AS decision_id, d.title, d.created_at, d.workflow_id, w.name AS workflow_name, w.vendor AS workflow_vendor, d.change_id,
      p.id AS plan_id, p.status AS plan_status, p.title AS plan_title, p.revision_id AS plan_revision_id, pr.revision_no AS plan_revision_no,
      (SELECT MAX(revision_no) FROM scenario_revisions WHERE decision_id = d.id AND tenant_id = d.tenant_id) AS latest_revision_no,
      o.id AS outcome_id, o.criteria_results_json AS success_json, o.unexpected, o.lessons, o.recorded_at
    FROM decision_records d
    JOIN workflows w ON w.id = d.workflow_id AND w.tenant_id = d.tenant_id
    LEFT JOIN action_plans p ON p.decision_id = d.id AND p.tenant_id = d.tenant_id
    LEFT JOIN scenario_revisions pr ON pr.id = p.revision_id AND pr.tenant_id = d.tenant_id
    LEFT JOIN outcomes o ON o.plan_id = p.id AND o.tenant_id = d.tenant_id
    WHERE d.tenant_id = ? ORDER BY d.created_at DESC, p.created_at`).all(tenantId) as HistRow[];
  const byDecision = new Map<string, HistoryEntry>();
  for (const r of rows) {
    let e = byDecision.get(r.decision_id);
    if (!e) {
      const ch = r.change_id ? lookupChange(r.change_id) : null;
      e = {
        decisionId: r.decision_id, title: r.title, createdAt: r.created_at,
        vendorChange: ch ? { id: ch.id, title: ch.title, vendor: ch.vendorName, kind: ch.kind } : null,
        workflow: { id: r.workflow_id, name: r.workflow_name, vendor: r.workflow_vendor }, latestRevisionNo: r.latest_revision_no, plans: [], outcome: null,
      };
      byDecision.set(r.decision_id, e);
    }
    if (r.plan_id) {
      e.plans.push({ id: r.plan_id, title: r.plan_title!, status: r.plan_status!, revisionNo: r.plan_revision_no! });
      if (r.outcome_id) e.outcome = { planId: r.plan_id, recordedAt: r.recorded_at!, successMet: successSummary(r.success_json), unexpected: r.unexpected ?? '', lessons: r.lessons ?? '' };
    }
  }
  return [...byDecision.values()];
}

export interface SimilarDecision { entry: HistoryEntry; basis: string; strength: number }

/** Explicit, rule-based recall. No learning or prediction is implied: each hit states why it was surfaced. */
export function similarDecisions(db: Db, tenantId: string, change: PublishedChange, workflowIds: string[]): SimilarDecision[] {
  const cache = new Map<string, PublishedChange | null>();
  const lookup = (id: string) => (cache.has(id) ? cache.get(id)! : (cache.set(id, lookupFromDb(db, id)), cache.get(id)!));
  const wf = new Set(workflowIds);
  const out: SimilarDecision[] = [];
  for (const e of loadHistory(db, tenantId, lookup)) {
    if (e.vendorChange?.id === change.id) continue;
    const sameVendor = e.vendorChange ? e.vendorChange.vendor.toLowerCase() === change.vendorName.toLowerCase() : false;
    const sameKind = e.vendorChange?.kind === change.kind;
    if (wf.has(e.workflow.id)) out.push({ entry: e, strength: 3, basis: `Same workflow ("${e.workflow.name}") was the subject of this earlier decision.` });
    else if (sameVendor && sameKind) out.push({ entry: e, strength: 2, basis: `Same vendor (${change.vendorName}) and same type of change (${change.kind.replace('_', ' ')}).` });
    else if (sameVendor) out.push({ entry: e, strength: 1, basis: `Same vendor (${change.vendorName}).` });
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, 5);
}

function lookupFromDb(db: Db, id: string): PublishedChange | null {
  const r = db.prepare('SELECT id, vendor_id, vendor_name, category, kind, title, summary FROM published_changes WHERE id = ?').get(id) as
    { id: string; vendor_id: string; vendor_name: string; category: string; kind: PublishedChange['kind']; title: string; summary: string } | undefined;
  return r ? { id: r.id, vendorId: r.vendor_id, vendorName: r.vendor_name, category: r.category, kind: r.kind, title: r.title, summary: r.summary, implication: '', action: '', affectedModels: [], publishedAt: null, effectiveAt: null, evidence: [], isDemo: false } : null;
}

export function historyRouter(deps: Deps): Router {
  const r = Router();
  r.get('/history', (req, res) => {
    const c = ctxOf(req);
    const q = String(req.query.q ?? '').trim().toLowerCase().slice(0, 100);
    const vendor = String(req.query.vendor ?? '').trim().toLowerCase();
    const outcomeOnly = req.query.outcome === 'recorded';
    let entries = loadHistory(deps.db, c.tenantId, id => lookupFromDb(deps.db, id));
    if (vendor) entries = entries.filter(e => (e.vendorChange?.vendor ?? '').toLowerCase() === vendor || e.workflow.vendor.toLowerCase() === vendor);
    if (outcomeOnly) entries = entries.filter(e => e.outcome);
    if (q) {
      entries = entries.filter(e => [e.title, e.workflow.name, e.workflow.vendor, e.vendorChange?.title, e.vendorChange?.vendor, e.outcome?.lessons, e.outcome?.unexpected, ...e.plans.map(p => p.title)]
        .some(s => (s ?? '').toLowerCase().includes(q)));
    }
    res.json({ entries: entries.slice(0, 200), total: entries.length });
  });
  return r;
}
