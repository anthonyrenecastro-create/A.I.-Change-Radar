import { DatabaseSync } from 'node:sqlite';
import { safeFetch } from './safeFetcher';
import { normalizeSnapshot, NormalizedSnapshot } from './normalizer';
import { generateId, sha256 } from '../utils/crypto';

export interface SourceRecord {
  id: string;
  vendor_id: string;
  name: string;
  source_type: string;
  url: string;
  parser_type: string;
  is_fixture: number;
  last_fetched_at?: number | null;
  last_status?: string | null;
  last_etag?: string | null;
  last_content_hash?: string | null;
  failure_count: number;
}

export interface IngestionResult {
  sourceId: string;
  vendorId: string;
  status: 'baseline_created' | 'change_detected' | 'unchanged' | 'cosmetic_suppressed' | 'failed';
  substantiveChange?: boolean;
  changeEventId?: string;
  error?: string;
}

/**
 * Fixture state timeline storage for deterministic reproducible testing.
 */
class FixtureRegistry {
  private timelineVersion: Record<string, 'baseline' | 'substantive_change' | 'cosmetic_change'> = {
    fixture_openai_models: 'baseline',
    fixture_anthropic_pricing: 'baseline',
    fixture_gemini_security: 'baseline',
  };

  setTimelineVersion(sourceId: string, version: 'baseline' | 'substantive_change' | 'cosmetic_change') {
    this.timelineVersion[sourceId] = version;
  }

  getFixtureContent(sourceId: string): string {
    const version = this.timelineVersion[sourceId] || 'baseline';

    if (sourceId === 'fixture_openai_models') {
      if (version === 'baseline') {
        return `
          <h1>OpenAI API Model Availability Notice</h1>
          <p>Current production models: gpt-4o, gpt-4o-mini, gpt-4-turbo, and legacy gpt-4-0613.</p>
          <p>All production models have standard 99.9% uptime SLA and standard API rate limits.</p>
          <footer>Page generated at: 2026-09-01T00:00:00Z</footer>
        `;
      }
      if (version === 'substantive_change') {
        return `
          <h1>OpenAI API Model Availability Notice</h1>
          <p>Important Deprecation Notice: Model gpt-4-0613 will be retired on October 31, 2026.</p>
          <p>Effective October 31, 2026, calls to gpt-4-0613 will fail. Customers must migrate workloads to gpt-4o or gpt-4o-mini.</p>
          <p>New pricing for gpt-4o-mini: $0.15 per 1M input tokens and $0.60 per 1M output tokens.</p>
          <footer>Page generated at: 2026-10-02T12:00:00Z</footer>
        `;
      }
      if (version === 'cosmetic_change') {
        // Same text as substantive_change, but only cosmetic header/banner timestamp changes
        return `
          <header>Notice: CDN refreshed at 2026-10-03 04:00 UTC</header>
          <h1>OpenAI API Model Availability Notice</h1>
          <p>Important Deprecation Notice: Model gpt-4-0613 will be retired on October 31, 2026.</p>
          <p>Effective October 31, 2026, calls to gpt-4-0613 will fail. Customers must migrate workloads to gpt-4o or gpt-4o-mini.</p>
          <p>New pricing for gpt-4o-mini: $0.15 per 1M input tokens and $0.60 per 1M output tokens.</p>
          <footer>Page generated at: 2026-10-03T04:00:00Z | Session nonce: abc987</footer>
        `;
      }
    }

    if (sourceId === 'fixture_anthropic_pricing') {
      if (version === 'baseline') {
        return `
          <h1>Anthropic Claude API Commercial Pricing</h1>
          <p>Claude 3.5 Sonnet: $3.00 / 1M input tokens, $15.00 / 1M output tokens.</p>
          <p>Claude 3.5 Haiku: $1.00 / 1M input tokens, $5.00 / 1M output tokens.</p>
          <p>Batch API discount available at 50% reduction for asynchronous requests.</p>
        `;
      }
      if (version === 'substantive_change') {
        return `
          <h1>Anthropic Claude API Commercial Pricing</h1>
          <p>Claude 3.5 Sonnet: $3.00 / 1M input tokens, $15.00 / 1M output tokens.</p>
          <p>Claude 3.5 Haiku Price Reduction: Effective November 1, 2026, price is $0.50 / 1M input tokens and $2.50 / 1M output tokens.</p>
          <p>Batch API discount available at 50% reduction for asynchronous requests.</p>
        `;
      }
      if (version === 'cosmetic_change') {
        return `
          <h1>Anthropic Claude API Commercial Pricing</h1>
          <nav>Updated style sheet v2.4</nav>
          <p>Claude 3.5 Sonnet: $3.00 / 1M input tokens, $15.00 / 1M output tokens.</p>
          <p>Claude 3.5 Haiku Price Reduction: Effective November 1, 2026, price is $0.50 / 1M input tokens and $2.50 / 1M output tokens.</p>
          <p>Batch API discount available at 50% reduction for asynchronous requests.</p>
          <footer>Cookie policy link</footer>
        `;
      }
    }

    if (sourceId === 'fixture_gemini_security') {
      if (version === 'baseline') {
        return `
          <h1>Google Cloud Gemini Data Governance & Security</h1>
          <p>Gemini APIs process prompts and completions according to Google Cloud data processing terms.</p>
          <p>Default log retention is 30 days unless customer requests zero-logging configuration.</p>
        `;
      }
      if (version === 'substantive_change') {
        return `
          <h1>Google Cloud Gemini Data Governance & Security</h1>
          <p>Gemini APIs process prompts and completions according to Google Cloud data processing terms.</p>
          <p>New Commercial Data Protection Commitment: Starting November 15, 2026, customer enterprise prompt data will never be used for foundation model training or evaluations without explicit administrative consent.</p>
          <p>HIPAA Business Associate Agreement (BAA) coverage extended to all Gemini 2.5 and Gemini 3.8 endpoints.</p>
        `;
      }
      if (version === 'cosmetic_change') {
        return `
          <aside>Security Notice Header</aside>
          <h1>Google Cloud Gemini Data Governance & Security</h1>
          <p>Gemini APIs process prompts and completions according to Google Cloud data processing terms.</p>
          <p>New Commercial Data Protection Commitment: Starting November 15, 2026, customer enterprise prompt data will never be used for foundation model training or evaluations without explicit administrative consent.</p>
          <p>HIPAA Business Associate Agreement (BAA) coverage extended to all Gemini 2.5 and Gemini 3.8 endpoints.</p>
        `;
      }
    }

    return '<h1>Default Baseline Content</h1><p>Standard vendor operation.</p>';
  }
}

export const fixtureRegistry = new FixtureRegistry();

export class IngestionService {
  constructor(private db: DatabaseSync) {}

  /**
   * Ingest a single source. Handles baseline vs substantive change vs cosmetic change vs failure.
   */
  async ingestSource(source: SourceRecord): Promise<IngestionResult> {
    const now = Date.now();
    let rawContent = '';
    let finalUrl = source.url;

    try {
      if (source.is_fixture === 1) {
        // Fetch from deterministic fixture registry
        rawContent = fixtureRegistry.getFixtureContent(source.id);
      } else {
        // Live safe HTTP connector
        const fetchRes = await safeFetch(source.url, {
          timeoutMs: 8000,
        });

        if (fetchRes.status >= 400) {
          throw new Error(`HTTP Error ${fetchRes.status} from ${source.url}`);
        }
        rawContent = fetchRes.body;
        finalUrl = fetchRes.finalUrl;
      }
    } catch (fetchErr: any) {
      // Record failure and increment failure count
      this.db.prepare(`
        UPDATE sources
        SET last_fetched_at = ?, last_status = 'failed', failure_count = failure_count + 1
        WHERE id = ?
      `).run(now, source.id);

      return {
        sourceId: source.id,
        vendorId: source.vendor_id,
        status: 'failed',
        error: fetchErr.message || 'Unknown network error',
      };
    }

    // Normalize snapshot and extract substantive facts
    const normalized = normalizeSnapshot(rawContent);

    // Check if a prior baseline snapshot exists for this source
    const priorBaseline = this.db.prepare(`
      SELECT id, content_hash, extracted_text, structured_facts
      FROM evidence_snapshots
      WHERE source_id = ? AND is_baseline = 1
      ORDER BY retrieved_at ASC
      LIMIT 1
    `).get(source.id) as { id: string; content_hash: string; extracted_text: string; structured_facts: string } | undefined;

    const snapshotId = generateId('snap');

    if (!priorBaseline) {
      // First successful retrieval: Establish baseline! (Do not report as a change event)
      this.db.prepare(`
        INSERT INTO evidence_snapshots (
          id, source_id, vendor_id, original_url, final_url, retrieved_at,
          published_at, effective_at, content_hash, raw_content, extracted_text,
          structured_facts, status, parser_version, is_baseline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        snapshotId,
        source.id,
        source.vendor_id,
        source.url,
        finalUrl,
        now,
        null,
        null,
        normalized.contentHash,
        normalized.rawContent,
        normalized.extractedText,
        JSON.stringify(normalized.structuredFacts),
        'baseline_established',
        'v1.0.0'
      );

      this.db.prepare(`
        UPDATE sources
        SET last_fetched_at = ?, last_status = 'success', last_content_hash = ?, failure_count = 0
        WHERE id = ?
      `).run(now, normalized.contentHash, source.id);

      this.db.prepare(`
        UPDATE vendors SET last_checked_at = ? WHERE id = ?
      `).run(now, source.vendor_id);

      return {
        sourceId: source.id,
        vendorId: source.vendor_id,
        status: 'baseline_created',
        substantiveChange: false,
      };
    }

    // We have a baseline snapshot. Get the most recent previous snapshot to compare against.
    const lastSnapshot = this.db.prepare(`
      SELECT id, content_hash, extracted_text, structured_facts
      FROM evidence_snapshots
      WHERE source_id = ?
      ORDER BY retrieved_at DESC
      LIMIT 1
    `).get(source.id) as { id: string; content_hash: string; extracted_text: string; structured_facts: string } | undefined;

    const previousText = lastSnapshot?.extracted_text || priorBaseline.extracted_text;

    // Check if raw content is byte-for-byte identical
    if (lastSnapshot && lastSnapshot.content_hash === normalized.contentHash) {
      this.db.prepare(`
        UPDATE sources SET last_fetched_at = ?, last_status = 'unchanged', failure_count = 0 WHERE id = ?
      `).run(now, source.id);

      return {
        sourceId: source.id,
        vendorId: source.vendor_id,
        status: 'unchanged',
        substantiveChange: false,
      };
    }

    // Check if substantive text and structured facts changed
    const previousFacts = JSON.parse(lastSnapshot?.structured_facts || priorBaseline.structured_facts || '{}');
    const isTextEqual = previousText.trim() === normalized.extractedText.trim();

    if (isTextEqual) {
      // Content hash changed (e.g. cookie timestamp, session ID in HTML footer), but substantive text is identical!
      // This is a COSMETIC change that must be suppressed.
      this.db.prepare(`
        INSERT INTO evidence_snapshots (
          id, source_id, vendor_id, original_url, final_url, retrieved_at,
          published_at, effective_at, content_hash, raw_content, extracted_text,
          structured_facts, status, parser_version, is_baseline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        snapshotId,
        source.id,
        source.vendor_id,
        source.url,
        finalUrl,
        now,
        null,
        null,
        normalized.contentHash,
        normalized.rawContent,
        normalized.extractedText,
        JSON.stringify(normalized.structuredFacts),
        'cosmetic_suppressed',
        'v1.0.0'
      );

      this.db.prepare(`
        UPDATE sources SET last_fetched_at = ?, last_status = 'cosmetic_suppressed', failure_count = 0 WHERE id = ?
      `).run(now, source.id);

      return {
        sourceId: source.id,
        vendorId: source.vendor_id,
        status: 'cosmetic_suppressed',
        substantiveChange: false,
      };
    }

    // Substantive Change Detected!
    // Store snapshot
    this.db.prepare(`
      INSERT INTO evidence_snapshots (
        id, source_id, vendor_id, original_url, final_url, retrieved_at,
        published_at, effective_at, content_hash, raw_content, extracted_text,
        structured_facts, status, parser_version, is_baseline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      snapshotId,
      source.id,
      source.vendor_id,
      source.url,
      finalUrl,
      now,
      null,
      null,
      normalized.contentHash,
      normalized.rawContent,
      normalized.extractedText,
      JSON.stringify(normalized.structuredFacts),
      'substantive_change_detected',
      'v1.0.0'
    );

    // Formulate Change Event with category and deduplication
    const changeEvent = this.createChangeEvent(source, snapshotId, normalized, previousText, previousFacts, now);

    this.db.prepare(`
      UPDATE sources SET last_fetched_at = ?, last_status = 'change_detected', last_content_hash = ?, failure_count = 0 WHERE id = ?
    `).run(now, normalized.contentHash, source.id);

    this.db.prepare(`
      UPDATE vendors SET last_checked_at = ? WHERE id = ?
    `).run(now, source.vendor_id);

    return {
      sourceId: source.id,
      vendorId: source.vendor_id,
      status: 'change_detected',
      substantiveChange: true,
      changeEventId: changeEvent.id,
    };
  }

  private createChangeEvent(
    source: SourceRecord,
    snapshotId: string,
    normalized: NormalizedSnapshot,
    previousText: string,
    previousFacts: any,
    now: number
  ): { id: string } {
    let category = 'features';
    let title = `${source.name} Update`;
    let summary = 'A substantive update to documentation or service specifications was detected.';
    const effectiveDate = normalized.structuredFacts.effectiveDates?.[0] || null;

    const lower = normalized.extractedText.toLowerCase();
    if (lower.includes('deprecat') || lower.includes('retired on') || lower.includes('sunset')) {
      category = 'deprecations';
      title = `Model / Feature Deprecation Announced (${source.vendor_id.toUpperCase()})`;
      summary = `Vendor has scheduled deprecation for legacy models with required customer migration deadline.`;
    } else if (lower.includes('price') || lower.includes('pricing') || lower.includes('rate cut') || lower.includes('cost')) {
      category = 'pricing';
      title = `Commercial Pricing Revision (${source.vendor_id.toUpperCase()})`;
      summary = `Adjustments to API token pricing and commercial tiers published on official pricing source.`;
    } else if (lower.includes('security') || lower.includes('privacy') || lower.includes('hipaa') || lower.includes('baa') || lower.includes('train')) {
      category = 'security_privacy';
      title = `Enterprise Security & Data Governance Update (${source.vendor_id.toUpperCase()})`;
      summary = `Updated policy statements regarding customer data training, enterprise privacy guarantees, or compliance coverage.`;
    } else if (lower.includes('terms') || lower.includes('policy') || lower.includes('commercial-terms')) {
      category = 'terms';
      title = `Terms of Service / Commercial Agreement Revision (${source.vendor_id.toUpperCase()})`;
      summary = `Modifications to commercial terms and legal obligations.`;
    }

    // Deduplication Key: sha256(vendorId + category + title + effectiveDate)
    const dedupKey = sha256(`${source.vendor_id}:${category}:${title}:${effectiveDate || 'no_date'}`);

    // Check if an existing change event with this deduplication key already exists
    const existing = this.db.prepare('SELECT id, supporting_source_ids FROM change_events WHERE deduplication_key = ?').get(dedupKey) as { id: string; supporting_source_ids: string } | undefined;

    if (existing) {
      // Append supporting source ID to preserve all supporting sources
      const supporting = JSON.parse(existing.supporting_source_ids || '[]');
      if (!supporting.includes(source.id)) {
        supporting.push(source.id);
        this.db.prepare('UPDATE change_events SET supporting_source_ids = ? WHERE id = ?').run(JSON.stringify(supporting), existing.id);
      }
      return { id: existing.id };
    }

    const eventId = generateId('evt');
    const diff = {
      addedClauses: normalized.extractedText
        .split('\n')
        .filter((l) => !previousText.includes(l) && l.length > 20)
        .slice(0, 5),
      detectedModels: normalized.structuredFacts.models,
      detectedPrices: normalized.structuredFacts.prices,
      effectiveDates: normalized.structuredFacts.effectiveDates,
    };

    this.db.prepare(`
      INSERT INTO change_events (
        id, vendor_id, evidence_snapshot_id, title, category, summary,
        substantive_diff, observed_at, effective_date, supporting_source_ids,
        deduplication_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      source.vendor_id,
      snapshotId,
      title,
      category,
      summary,
      JSON.stringify(diff),
      now,
      effectiveDate,
      JSON.stringify([source.id]),
      dedupKey,
      now
    );

    return { id: eventId };
  }

  /**
   * Ingest all registered sources in the database.
   */
  async ingestAllSources(): Promise<IngestionResult[]> {
    const sources = this.db.prepare('SELECT * FROM sources').all() as unknown as SourceRecord[];
    const results: IngestionResult[] = [];
    for (const s of sources) {
      const res = await this.ingestSource(s);
      results.push(res);
    }
    return results;
  }
}
