import type { ExposureMatch, PublishedChange, Workflow } from './domain';
import { downstreamOf, type Edge } from './graph';

/** Lowercase alphanumerics separated by single spaces. */
export function norm(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const VENDOR_SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|ai|labs)\b/g;
export function normVendor(value: string | null | undefined): string {
  return norm(value).replace(VENDOR_SUFFIX, ' ').replace(/\s+/g, ' ').trim() || norm(value);
}

function mentions(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

export function vendorMatches(w: Workflow, change: Pick<PublishedChange, 'vendorId' | 'vendorName'>): boolean {
  const wv = normVendor(w.vendor);
  if (!wv) return false;
  return wv === normVendor(change.vendorId) || wv === normVendor(change.vendorName);
}

type ChangeLike = Pick<PublishedChange, 'id' | 'vendorId' | 'vendorName' | 'title' | 'summary' | 'affectedModels' | 'kind'>;

/**
 * Deterministic exposure matching. Rules, in order:
 *  - Missing vendor never means "not affected": it yields insufficient_information unless the model is named explicitly.
 *  - A model named in the published item and equal to the workflow model is the only "confirmed" rule.
 *  - Similar names, text mentions, and vendor-wide notices are "possible" and need customer review.
 *  - Workflows depending on an exposed workflow are "possible" downstream matches (cycle-safe traversal).
 * Workflows at a different known vendor, or using a different model than a model-specific notice names, are not matched.
 */
export function matchChange(
  change: ChangeLike,
  workflows: Workflow[],
  edges: Edge[],
  dismissedWorkflowIds: Set<string> = new Set(),
): ExposureMatch[] {
  const active = workflows.filter(w => !w.archived);
  const byId = new Map(active.map(w => [w.id, w]));
  const named = change.affectedModels.map(norm).filter(Boolean);
  const text = norm(`${change.title} ${change.summary}`);
  const out = new Map<string, ExposureMatch>();
  const base = { changeId: change.id, reviewState: 'unreviewed' as const };

  for (const w of active) {
    const wModel = norm(w.model);
    const hasVendor = normVendor(w.vendor) !== '';
    const vendorOk = vendorMatches(w, change);
    const exact = wModel !== '' && named.includes(wModel);
    const similar = wModel.length >= 3 && !exact && named.some(n => n.includes(wModel) || wModel.includes(n));
    const textMention = wModel.length >= 3 && mentions(text, wModel);

    if (!hasVendor) {
      if (exact) {
        out.set(w.id, { ...base, workflowId: w.id, status: 'possible', rule: 'model_named',
          explanation: `This workflow's model "${w.model}" is named in the announcement, but its vendor is not recorded. Confirm the vendor.` });
      } else {
        out.set(w.id, { ...base, workflowId: w.id, status: 'insufficient_information', rule: 'missing_vendor',
          explanation: 'No vendor is recorded for this workflow, so exposure to this change cannot be ruled in or out.' });
      }
      continue;
    }
    if (!vendorOk) continue;

    if (exact) {
      out.set(w.id, { ...base, workflowId: w.id, status: 'confirmed', rule: 'model_named',
        explanation: `This workflow uses the model "${w.model}" named in the ${change.vendorName} announcement.` });
    } else if (similar) {
      out.set(w.id, { ...base, workflowId: w.id, status: 'possible', rule: 'model_mentioned',
        explanation: `The workflow model "${w.model}" resembles a model named in the announcement (${change.affectedModels.join(', ')}). Check whether they are the same product.` });
    } else if (textMention) {
      out.set(w.id, { ...base, workflowId: w.id, status: 'possible', rule: 'model_mentioned',
        explanation: `The announcement text mentions "${w.model}", which this workflow uses, but it is not listed as an affected model. Review the source.` });
    } else if (named.length === 0) {
      if (!wModel) {
        out.set(w.id, { ...base, workflowId: w.id, status: 'insufficient_information', rule: 'missing_model',
          explanation: `This is a vendor-wide ${change.vendorName} notice and no model or product is recorded for this workflow, so scope cannot be assessed.` });
      } else {
        out.set(w.id, { ...base, workflowId: w.id, status: 'possible', rule: 'vendor_wide',
          explanation: `This notice applies to ${change.vendorName} generally and does not name specific models. Your plan or usage may or may not be in scope.` });
      }
    } else if (!wModel) {
      out.set(w.id, { ...base, workflowId: w.id, status: 'insufficient_information', rule: 'missing_model',
        explanation: `The announcement names specific models (${change.affectedModels.join(', ')}) and no model is recorded for this workflow, so exposure cannot be ruled out.` });
    }
  }

  const roots = [...out.values()]
    .filter(m => (m.status === 'confirmed' || m.status === 'possible') && !dismissedWorkflowIds.has(m.workflowId))
    .map(m => m.workflowId);
  for (const [wid, info] of downstreamOf(edges, roots)) {
    const w = byId.get(wid);
    if (!w || out.has(wid)) continue;
    const via = byId.get(info.via);
    out.set(wid, { ...base, workflowId: wid, status: 'possible', rule: 'downstream_dependency', viaWorkflowId: info.via,
      explanation: `This workflow depends on "${via?.name ?? 'another workflow'}", which may be affected${info.hops > 1 ? ` (${info.hops} dependency steps away)` : ''}.` });
  }
  return [...out.values()];
}

export const MATCH_ORDER = ['confirmed', 'possible', 'insufficient_information'] as const;
