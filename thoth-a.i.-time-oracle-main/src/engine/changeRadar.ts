import { createHash } from 'node:crypto';

export type ChangeCategory = 'release' | 'pricing' | 'api' | 'security' | 'terms' | 'availability' | 'policy' | 'other';

export interface EvidenceRecord {
  id: string;
  sourceId: string;
  vendorId: string;
  originalUrl: string;
  finalUrl: string;
  retrievedAt: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  contentHash: string;
  parserVersion: string;
  status: 'success' | 'failed';
  extractedContent: string;
}

/** Optional structured facts a curator or extractor attached to a source item. Never inferred by Navigator. */
export interface StructuredImpact {
  vendorName?: string;
  kind?: 'retirement' | 'price_increase' | 'price_decrease' | 'outage' | 'policy' | 'release' | 'other';
  affectedModels?: string[];
  summary?: string;
  implication?: string;
  action?: string;
}

export interface SourceItem {
  id: string;
  title: string;
  content: string;
  category: ChangeCategory;
  publishedAt: string | null;
  effectiveAt: string | null;
  structured?: StructuredImpact;
}

export interface VendorSnapshot {
  evidence: EvidenceRecord;
  items: SourceItem[];
}

export interface ChangeEvent {
  id: string;
  vendorId: string;
  category: ChangeCategory;
  title: string;
  content: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  version: number;
  contentHash: string;
  evidenceIds: string[];
  structured?: StructuredImpact;
}

export interface BriefItem {
  id: string;
  eventId: string;
  summary: string;
  category: ChangeCategory;
  applicability: 'applicable' | 'conditional' | 'not_applicable';
  applicabilityReason: string;
  implication: string;
  action: string;
  deadline: string | null;
  evidenceIds: string[];
  assumptions: string[];
  facts: string[];
}

export interface CritiqueDecision {
  itemId: string;
  decision: 'accept' | 'revise' | 'reject' | 'needs_review';
  reasons: string[];
  blocking: boolean;
}

export function canonicalSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter(key => record[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalSerialize(record[key])}`).join(',')}}`;
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalSerialize(value)).digest('hex');
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value as Readonly<T>;
}

export function normalizeContent(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en');
}

export function applySnapshot(
  vendorId: string,
  snapshot: VendorSnapshot,
  priorItems: SourceItem[] | null,
  priorEvents: ChangeEvent[],
): { events: ChangeEvent[]; baseline: boolean; materialChanges: ChangeEvent[] } {
  if (snapshot.evidence.status !== 'success') return { events: priorEvents, baseline: false, materialChanges: [] };

  const baseline = priorItems === null;
  const priorItemsById = new Map((priorItems ?? []).map(item => [item.id, item]));
  const existingById = new Map(priorEvents.map(event => [event.id, event]));
  const emitted = new Map(priorEvents.map(event => [event.id, event]));
  const materialChanges: ChangeEvent[] = [];

  for (const item of snapshot.items) {
    const eventId = sha256(`${vendorId}:${item.id}`).slice(0, 24);
    const contentHash = sha256({
      category: item.category,
      title: normalizeContent(item.title),
      content: normalizeContent(item.content),
      effectiveAt: item.effectiveAt,
    });
    const existing = existingById.get(eventId);
    const previous = priorItemsById.get(item.id);
    const previousHash = previous ? sha256({
      category: previous.category,
      title: normalizeContent(previous.title),
      content: normalizeContent(previous.content),
      effectiveAt: previous.effectiveAt,
    }) : null;

    if (!existing) {
      const event: ChangeEvent = {
        id: eventId,
        vendorId,
        category: item.category,
        title: item.title,
        content: item.content,
        publishedAt: item.publishedAt,
        effectiveAt: item.effectiveAt,
        version: 1,
        contentHash,
        evidenceIds: [snapshot.evidence.id],
        structured: item.structured,
      };
      emitted.set(eventId, event);
      if (!baseline) materialChanges.push(event);
      continue;
    }

    if (existing.contentHash === contentHash) {
      emitted.set(eventId, { ...existing, evidenceIds: [...new Set([...existing.evidenceIds, snapshot.evidence.id])] });
      continue;
    }

    const event: ChangeEvent = {
      ...existing,
      category: item.category,
      title: item.title,
      content: item.content,
      publishedAt: item.publishedAt,
      effectiveAt: item.effectiveAt,
      structured: item.structured ?? existing.structured,
      version: existing.version + 1,
      contentHash,
      evidenceIds: [...new Set([...existing.evidenceIds, snapshot.evidence.id])],
    };
    emitted.set(eventId, event);
    if (!baseline && previousHash !== contentHash) materialChanges.push(event);
  }

  return { events: [...emitted.values()], baseline, materialChanges };
}

export function priceDifference(
  previous: { amount: number; currency: string; unit: string },
  next: { amount: number; currency: string; unit: string },
): { amount: number; percent: number } | null {
  if (previous.currency !== next.currency || previous.unit !== next.unit || previous.amount <= 0) return null;
  const amount = next.amount - previous.amount;
  return { amount, percent: (amount / previous.amount) * 100 };
}

export function applicabilityFor(
  context: { industry: string; productId?: string; planId?: string; region?: string },
  event: { industryIds?: string[]; productIds?: string[]; planIds?: string[]; regions?: string[] },
): { status: BriefItem['applicability']; reason: string } {
  if (event.industryIds?.length && !event.industryIds.includes(context.industry)) {
    return { status: 'not_applicable', reason: 'The published scope excludes this industry.' };
  }
  if (event.productIds?.length && !context.productId) {
    return { status: 'conditional', reason: 'Select the affected product to confirm applicability.' };
  }
  if (event.productIds?.length && !event.productIds.includes(context.productId!)) {
    return { status: 'not_applicable', reason: 'The selected product is outside the published scope.' };
  }
  if (event.planIds?.length && !context.planId) {
    return { status: 'conditional', reason: 'Your plan is unknown, so plan-specific impact cannot be confirmed.' };
  }
  if (event.regions?.length && !context.region) {
    return { status: 'conditional', reason: 'Your service region is unknown.' };
  }
  if (event.regions?.length && !event.regions.includes(context.region!)) {
    return { status: 'not_applicable', reason: 'The selected region is outside the published scope.' };
  }
  return { status: 'applicable', reason: 'The known customer context matches the published scope.' };
}

export function critiqueBriefItem(
  item: BriefItem,
  evidence: Map<string, EvidenceRecord>,
  critique: CritiqueDecision,
): { accepted: boolean; reasons: string[] } {
  const reasons = [...critique.reasons];
  if (item.evidenceIds.length === 0) reasons.push('No supporting evidence is attached.');
  for (const evidenceId of item.evidenceIds) {
    if (!evidence.has(evidenceId)) reasons.push(`Evidence reference ${evidenceId} is unavailable.`);
  }
  if (item.applicability !== 'applicable') reasons.push('Applicability is not confirmed for the customer.');
  if (critique.blocking || critique.decision === 'reject' || critique.decision === 'needs_review') {
    reasons.push('Critique has an unresolved blocking decision.');
  }
  return {
    accepted: reasons.length === 0 && (critique.decision === 'accept' || critique.decision === 'revise'),
    reasons,
  };
}