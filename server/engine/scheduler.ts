import { DatabaseSync } from 'node:sqlite';
import { IngestionService } from '../sources/connectors';
import { PipelineEngine } from './pipeline';
import { EmailService } from '../email/emailAdapter';
import { generateId } from '../utils/crypto';

export class RadarScheduler {
  private isIngesting = false;
  private isGeneratingDigests = false;
  private ingestionInterval: NodeJS.Timeout | null = null;
  private digestInterval: NodeJS.Timeout | null = null;

  constructor(
    private db: DatabaseSync,
    private ingestionService: IngestionService,
    private pipeline: PipelineEngine,
    private emailService: EmailService
  ) {}

  /**
   * Start server-side background schedules.
   */
  start(): void {
    // Ingest feeds every 10 minutes in background
    this.ingestionInterval = setInterval(() => {
      this.runIngestionJob().catch((err) => console.error('Scheduled ingestion job error:', err));
    }, 10 * 60 * 1000);

    // Digest generation ticker check every 15 minutes
    this.digestInterval = setInterval(() => {
      this.runDigestCycle().catch((err) => console.error('Scheduled digest cycle error:', err));
    }, 15 * 60 * 1000);

    console.log('[AI Change Radar] Background scheduler worker started (autonomous server execution).');
  }

  stop(): void {
    if (this.ingestionInterval) clearInterval(this.ingestionInterval);
    if (this.digestInterval) clearInterval(this.digestInterval);
  }

  /**
   * Run an ingestion job with durable audit logging and concurrency protection.
   */
  async runIngestionJob(): Promise<{
    jobId: string;
    sourcesChecked: number;
    changesDetected: number;
  }> {
    if (this.isIngesting) {
      console.log('[Scheduler] Ingestion job already in progress; skipping duplicate run.');
      return { jobId: 'skipped', sourcesChecked: 0, changesDetected: 0 };
    }

    this.isIngesting = true;
    const jobId = generateId('job_ingest');
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO audit_and_job_runs (
        id, job_type, status, started_at, completed_at, sources_checked,
        changes_detected, briefs_generated, llm_budget_tokens, cost_estimate_usd, error_details
      ) VALUES (?, 'ingestion', 'running', ?, null, 0, 0, 0, 0, 0, null)
    `).run(jobId, now);

    try {
      const results = await this.ingestionService.ingestAllSources();
      const changesDetected = results.filter((r) => r.status === 'change_detected').length;
      const completedNow = Date.now();

      this.db.prepare(`
        UPDATE audit_and_job_runs
        SET status = 'completed', completed_at = ?, sources_checked = ?, changes_detected = ?
        WHERE id = ?
      `).run(completedNow, results.length, changesDetected, jobId);

      return {
        jobId,
        sourcesChecked: results.length,
        changesDetected,
      };
    } catch (err: any) {
      this.db.prepare(`
        UPDATE audit_and_job_runs
        SET status = 'failed', completed_at = ?, error_details = ?
        WHERE id = ?
      `).run(Date.now(), err.message, jobId);
      throw err;
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Run digest cycle for all active tenants.
   */
  async runDigestCycle(): Promise<{
    jobId: string;
    tenantsProcessed: number;
    briefsGenerated: number;
  }> {
    if (this.isGeneratingDigests) {
      console.log('[Scheduler] Digest cycle already in progress; skipping duplicate run.');
      return { jobId: 'skipped', tenantsProcessed: 0, briefsGenerated: 0 };
    }

    this.isGeneratingDigests = true;
    const jobId = generateId('job_digest');
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO audit_and_job_runs (
        id, job_type, status, started_at, completed_at, sources_checked,
        changes_detected, briefs_generated, llm_budget_tokens, cost_estimate_usd, error_details
      ) VALUES (?, 'digest_generation', 'running', ?, null, 0, 0, 0, 0, 0, null)
    `).run(jobId, now);

    try {
      const tenants = this.db.prepare("SELECT id, email, company_name FROM tenants WHERE status = 'active'").all() as any[];
      let briefsGenerated = 0;

      for (const t of tenants) {
        const result = await this.pipeline.processTenantWeeklyBrief(t.id, jobId);
        briefsGenerated++;

        // If items are published, dispatch email digest with idempotency
        if (result.acceptedCount > 0) {
          const brief = this.db.prepare('SELECT * FROM weekly_briefs WHERE id = ?').get(result.briefId) as any;
          const acceptedItemIds: string[] = JSON.parse(brief.accepted_item_ids || '[]');

          const placeholders = acceptedItemIds.map(() => '?').join(',');
          const items = (acceptedItemIds.length > 0
            ? this.db.prepare(`SELECT * FROM brief_proposals WHERE id IN (${placeholders})`).all(...acceptedItemIds)
            : []) as any[];

          const mappedItems = items.map((i) => ({
            category: i.category,
            actionCategory: i.action_category,
            changeSummary: i.change_summary,
            applicabilityRationale: i.applicability_rationale,
            businessImplication: i.business_implication,
            suggestedAction: i.suggested_action,
            deadline: i.deadline,
            claimsWithEvidence: JSON.parse(i.claims_with_evidence || '[]'),
          }));

          const prefs = this.db.prepare('SELECT delivery_email FROM tenant_preferences WHERE tenant_id = ?').get(t.id) as any;
          const recipient = prefs?.delivery_email || t.email;

          await this.emailService.sendWeeklyDigestEmail({
            tenantId: t.id,
            recipient,
            subject: `[AI Change Radar] Weekly Brief #${brief.issue_number}: Verified AI Updates for ${t.company_name}`,
            briefIssueNumber: brief.issue_number,
            companyName: t.company_name,
            items: mappedItems,
            sourceCoverage: result.sourceCoverage,
          });
        }
      }

      this.db.prepare(`
        UPDATE audit_and_job_runs
        SET status = 'completed', completed_at = ?, briefs_generated = ?
        WHERE id = ?
      `).run(Date.now(), briefsGenerated, jobId);

      return {
        jobId,
        tenantsProcessed: tenants.length,
        briefsGenerated,
      };
    } catch (err: any) {
      this.db.prepare(`
        UPDATE audit_and_job_runs
        SET status = 'failed', completed_at = ?, error_details = ?
        WHERE id = ?
      `).run(Date.now(), err.message, jobId);
      throw err;
    } finally {
      this.isGeneratingDigests = false;
    }
  }
}
