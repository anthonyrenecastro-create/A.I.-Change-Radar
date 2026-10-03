import type { Db } from './db';
import type { PublishedChange, EvidenceLink, ChangeKind } from '../shared/domain';
import { applySnapshot, type ChangeEvent, type SourceItem, type VendorSnapshot } from '../src/engine/changeRadar';

/** Who is asking for changes. Demo tenants only ever see demo changes, and real tenants never see them. */
export interface FeedScope { tenantId: string; isDemo: boolean }

export interface WeeklyBrief { weekStart: string; items: PublishedChange[] }

/**
 * Boundary between Navigator and Radar. The local implementation reads the existing change pipeline's output.
 * A future authenticated Radar integration should implement this interface; nothing here assumes a live Radar API.
 */
export interface ChangeFeedAdapter {
  readonly source: string;
  listChanges(scope: FeedScope): PublishedChange[];
  getChange(scope: FeedScope, id: string): PublishedChange | null;
  listBriefs(scope: FeedScope): WeeklyBrief[];
}

interface ChangeRow {
  id: string; vendor_id: string; vendor_name: string; category: string; kind: ChangeKind; title: string; summary: string;
  implication: string; action: string; affected_models_json: string; published_at: string | null; effective_at: string | null;
  evidence_ids_json: string; is_demo: number;
}

export class LocalPipelineAdapter implements ChangeFeedAdapter {
  readonly source = 'local-change-pipeline';
  constructor(private db: Db) {}

  private evidenceFor(ids: string[]): EvidenceLink[] {
    if (!ids.length) return [];
    const rows = this.db.prepare(`SELECT id, url, retrieved_at FROM change_evidence WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as { id: string; url: string; retrieved_at: string | null }[];
    return rows.map(r => ({ id: r.id, url: r.url, retrievedAt: r.retrieved_at, label: r.url }));
  }

  private map(r: ChangeRow): PublishedChange {
    return {
      id: r.id, vendorId: r.vendor_id, vendorName: r.vendor_name, category: r.category, kind: r.kind, title: r.title, summary: r.summary,
      implication: r.implication, action: r.action, affectedModels: JSON.parse(r.affected_models_json), publishedAt: r.published_at,
      effectiveAt: r.effective_at, evidence: this.evidenceFor(JSON.parse(r.evidence_ids_json)), isDemo: r.is_demo === 1,
    };
  }

  listChanges(scope: FeedScope): PublishedChange[] {
    const rows = this.db.prepare('SELECT * FROM published_changes WHERE is_demo = ? ORDER BY COALESCE(published_at, \'\') DESC, id').all(scope.isDemo ? 1 : 0) as ChangeRow[];
    return rows.map(r => this.map(r));
  }

  getChange(scope: FeedScope, id: string): PublishedChange | null {
    const r = this.db.prepare('SELECT * FROM published_changes WHERE id = ? AND is_demo = ?').get(id, scope.isDemo ? 1 : 0) as ChangeRow | undefined;
    return r ? this.map(r) : null;
  }

  listBriefs(scope: FeedScope): WeeklyBrief[] {
    const weeks = new Map<string, PublishedChange[]>();
    for (const c of this.listChanges(scope)) {
      const key = weekStart(c.publishedAt);
      weeks.set(key, [...(weeks.get(key) ?? []), c]);
    }
    return [...weeks].map(([weekStart, items]) => ({ weekStart, items })).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }
}

export function weekStart(iso: string | null): string {
  if (!iso) return 'undated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'undated';
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/**
 * Ingests one vendor snapshot through the existing pipeline (hash-based change detection) and mirrors the
 * resulting events into published_changes. Navigator reads only published_changes.
 */
export function ingestSnapshot(db: Db, vendorId: string, vendorName: string, snapshot: VendorSnapshot, isDemo: boolean): { baseline: boolean; materialChanges: ChangeEvent[] } {
  const state = db.prepare('SELECT items_json, events_json FROM vendor_snapshots WHERE vendor_id = ?').get(vendorId) as { items_json: string; events_json: string } | undefined;
  const priorItems: SourceItem[] | null = state ? JSON.parse(state.items_json) : null;
  const priorEvents: ChangeEvent[] = state ? JSON.parse(state.events_json) : [];
  const result = applySnapshot(vendorId, snapshot, priorItems, priorEvents);
  if (snapshot.evidence.status !== 'success') return { baseline: false, materialChanges: [] };

  db.transaction(() => {
    const ev = snapshot.evidence;
    db.prepare('INSERT OR REPLACE INTO change_evidence (id, vendor_id, url, retrieved_at, content_hash, is_demo) VALUES (?,?,?,?,?,?)')
      .run(ev.id, vendorId, ev.finalUrl || ev.originalUrl, ev.retrievedAt, ev.contentHash, isDemo ? 1 : 0);
    db.prepare('INSERT OR REPLACE INTO vendor_snapshots (vendor_id, items_json, events_json, updated_at) VALUES (?,?,?,?)')
      .run(vendorId, JSON.stringify(snapshot.items), JSON.stringify(result.events), new Date().toISOString());
    const up = db.prepare(`INSERT INTO published_changes (id, vendor_id, vendor_name, category, kind, title, summary, implication, action, affected_models_json, published_at, effective_at, evidence_ids_json, version, content_hash, is_demo)
      VALUES (@id,@vendor_id,@vendor_name,@category,@kind,@title,@summary,@implication,@action,@models,@published_at,@effective_at,@evidence,@version,@hash,@is_demo)
      ON CONFLICT(id) DO UPDATE SET category=@category, kind=@kind, title=@title, summary=@summary, implication=@implication, action=@action,
        affected_models_json=@models, published_at=@published_at, effective_at=@effective_at, evidence_ids_json=@evidence, version=@version, content_hash=@hash`);
    for (const e of result.events) {
      const s = e.structured ?? {};
      up.run({
        id: e.id, vendor_id: vendorId, vendor_name: s.vendorName ?? vendorName, category: e.category, kind: s.kind ?? 'other', title: e.title,
        summary: s.summary ?? e.content.slice(0, 500), implication: s.implication ?? '', action: s.action ?? '',
        models: JSON.stringify(s.affectedModels ?? []), published_at: e.publishedAt, effective_at: e.effectiveAt,
        evidence: JSON.stringify(e.evidenceIds), version: e.version, hash: e.contentHash, is_demo: isDemo ? 1 : 0,
      });
    }
  })();
  return { baseline: result.baseline, materialChanges: result.materialChanges };
}
