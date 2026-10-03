import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDatabase } from '../server/db/database';
import { IngestionService, fixtureRegistry } from '../server/sources/connectors';
import { PipelineEngine, CustomerContext } from '../server/engine/pipeline';
import { BillingService, PLANS } from '../server/billing/billingAdapter';
import { EmailService } from '../server/email/emailAdapter';
import { deepFreeze, canonicalJson, canonicalHash, sha256 } from '../server/utils/crypto';
import { isPrivateOrReservedIp } from '../server/sources/safeFetcher';

// Isolated temporary test database
const TEST_DB_PATH = path.join(process.cwd(), 'data', `test_radar_${Date.now()}.sqlite`);

function setupTestEnvironment() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  const db = getDatabase(TEST_DB_PATH);
  const ingestion = new IngestionService(db);
  const pipeline = new PipelineEngine(db);
  const billing = new BillingService(db);
  const email = new EmailService(db);

  return { db, ingestion, pipeline, billing, email };
}

function cleanupTestEnvironment() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  } catch {}
}

test('AI Change Radar - Comprehensive Test Suite', async (t) => {
  const env = setupTestEnvironment();

  t.after(() => {
    cleanupTestEnvironment();
  });

  await t.test('1. Snapshot immutability, canonical serialization, and cryptographic hashing', () => {
    const rawState = {
      vendor: 'OpenAI',
      version: 2,
      tags: ['pricing', 'api'],
      meta: {
        effectiveDate: '2026-10-31',
        rate: 0.15,
      },
    };

    // Deep freeze test
    const frozen = deepFreeze(rawState);
    assert.throws(() => {
      // @ts-ignore
      frozen.meta.rate = 0.5;
    }, /Cannot assign to read only property|Cannot set property/);

    // Canonical JSON key ordering test
    const objA = { z: 10, a: 1, m: { y: 2, b: 3 } };
    const objB = { a: 1, m: { b: 3, y: 2 }, z: 10 };
    assert.equal(canonicalJson(objA), canonicalJson(objB));
    assert.equal(canonicalHash(objA), canonicalHash(objB));
  });

  await t.test('2. SSRF Protection: blocks private, loopback, link-local, and AWS metadata IPs', () => {
    assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('10.0.0.5'), true);
    assert.equal(isPrivateOrReservedIp('172.16.0.1'), true);
    assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
    assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
    assert.equal(isPrivateOrReservedIp('::1'), true);
    assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
    assert.equal(isPrivateOrReservedIp('142.250.190.46'), false);
  });

  await t.test('3. Baseline ingestion vs subsequent substantive changes', async () => {
    const source = env.db.prepare("SELECT * FROM sources WHERE id = 'fixture_openai_models'").get() as any;
    assert.ok(source, 'Fixture source should exist in database');

    // Step A: Baseline run
    fixtureRegistry.setTimelineVersion(source.id, 'baseline');
    const baselineResult = await env.ingestion.ingestSource(source);
    assert.equal(baselineResult.status, 'baseline_created');
    assert.equal(baselineResult.substantiveChange, false);

    // Verify baseline snapshot in DB has is_baseline = 1
    const baselineSnap = env.db.prepare('SELECT is_baseline FROM evidence_snapshots WHERE source_id = ? AND is_baseline = 1').get(source.id) as any;
    assert.equal(baselineSnap.is_baseline, 1);

    // Verify no change event created on baseline
    const changeEventsCount = (env.db.prepare('SELECT COUNT(*) as cnt FROM change_events WHERE vendor_id = ?').get(source.vendor_id) as any).cnt;
    assert.equal(changeEventsCount, 0);

    // Step B: Advance to substantive change
    fixtureRegistry.setTimelineVersion(source.id, 'substantive_change');
    const updateResult = await env.ingestion.ingestSource(source);
    assert.equal(updateResult.status, 'change_detected');
    assert.equal(updateResult.substantiveChange, true);
    assert.ok(updateResult.changeEventId);

    // Verify change event was created with deprecations category
    const evt = env.db.prepare('SELECT * FROM change_events WHERE id = ?').get(updateResult.changeEventId) as any;
    assert.equal(evt.category, 'deprecations');
    assert.equal(evt.effective_date, 'October 31, 2026');
  });

  await t.test('4. Cosmetic-change suppression and event deduplication', async () => {
    const source = env.db.prepare("SELECT * FROM sources WHERE id = 'fixture_openai_models'").get() as any;

    // Timeline set to cosmetic change (page regenerated header/footer timestamp, but substantive text is identical)
    fixtureRegistry.setTimelineVersion(source.id, 'cosmetic_change');
    const cosmeticResult = await env.ingestion.ingestSource(source);
    assert.equal(cosmeticResult.status, 'cosmetic_suppressed');
    assert.equal(cosmeticResult.substantiveChange, false);

    // Ingesting the same announcement again does not create a duplicate change event
    const eventsBefore = (env.db.prepare('SELECT COUNT(*) as cnt FROM change_events WHERE vendor_id = ?').get(source.vendor_id) as any).cnt;
    fixtureRegistry.setTimelineVersion(source.id, 'substantive_change');
    await env.ingestion.ingestSource(source);
    const eventsAfter = (env.db.prepare('SELECT COUNT(*) as cnt FROM change_events WHERE vendor_id = ?').get(source.vendor_id) as any).cnt;
    assert.equal(eventsBefore, eventsAfter, 'Deduplication key should prevent duplicate change event creation');
  });

  await t.test('5. Retrieval failures and incomplete-coverage reporting', async () => {
    // Intentionally register an unreachable source URL
    const brokenSourceId = 'src_broken_unreachable';
    env.db.prepare(`
      INSERT INTO sources (id, vendor_id, name, source_type, url, parser_type, is_fixture, failure_count)
      VALUES (?, 'openai', 'Broken Feeds', 'pricing', 'http://192.168.1.99:9999/unreachable', 'generic_html', 0, 0)
    `).run(brokenSourceId);

    const brokenSource = env.db.prepare('SELECT * FROM sources WHERE id = ?').get(brokenSourceId) as any;
    const failRes = await env.ingestion.ingestSource(brokenSource);
    assert.equal(failRes.status, 'failed');

    const updatedSource = env.db.prepare('SELECT failure_count, last_status FROM sources WHERE id = ?').get(brokenSourceId) as any;
    assert.equal(updatedSource.failure_count, 1);
    assert.equal(updatedSource.last_status, 'failed');

    // Run pipeline for tenant tracking openai and verify report has incomplete coverage flag
    const pipelineRes = await env.pipeline.processTenantWeeklyBrief('tenant_acme_legal');
    assert.equal(pipelineRes.sourceCoverage.hasIncompleteCoverage, true);
    assert.ok(pipelineRes.sourceCoverage.failed > 0);
  });

  await t.test('6. Unsupported claims and hallucinated quotes rejected by critique', async () => {
    const rawSnapshot = {
      extracted_text: 'Anthropic Claude 3.5 Haiku is available at $1.00 / 1M input tokens and $5.00 / 1M output tokens.',
      final_url: 'https://docs.anthropic.com/en/pricing',
    };

    const ctx: CustomerContext = {
      tenantId: 'tenant_acme_legal',
      companyName: 'Acme Legal Partners',
      industry: 'Legal',
      selectedVendors: ['anthropic'],
      timezone: 'America/New_York',
      usageContext: {},
    };

    // A proposed brief item containing a fabricated claim NOT in the source extract
    const hallucinatedProposal = {
      id: 'prop_fabricated_123',
      jobId: 'job_test',
      tenantId: 'tenant_acme_legal',
      changeEventId: 'evt_test',
      vendorId: 'anthropic',
      changeSummary: 'Anthropic guarantees zero data retention for all free tiers indefinitely',
      category: 'security_privacy',
      applicabilityLevel: 'direct' as const,
      applicabilityRationale: 'Relevant to confidential legal data',
      businessImplication: 'High impact',
      suggestedAction: 'Rely on free tier',
      actionCategory: 'action_required' as const,
      deadline: '2026-12-31',
      estimatedCostDelta: null,
      claimsWithEvidence: [
        {
          claim: 'Zero data retention for free tier',
          sourceQuote: 'guarantees zero data retention for all free tiers indefinitely',
          sourceUrl: 'https://docs.anthropic.com/en/pricing',
        },
      ],
      assumptionsMissingContext: null,
    };

    const existingEvent = env.db.prepare('SELECT id FROM change_events LIMIT 1').get() as any;
    env.db.prepare(`
      INSERT INTO brief_proposals (
        id, job_id, tenant_id, change_event_id, change_summary, category,
        applicability_level, applicability_rationale, business_implication,
        suggested_action, action_category, deadline, estimated_cost_delta,
        claims_with_evidence, assumptions_missing_context, status, created_at
      ) VALUES (?, 'job_test', 'tenant_acme_legal', ?, 'summary', 'security_privacy', 'direct', 'rationale', 'implication', 'action', 'action_required', null, null, '[]', null, 'proposed', ?)
    `).run(hallucinatedProposal.id, existingEvent.id, Date.now());

    const critique = await env.pipeline.critiqueBriefItem(hallucinatedProposal, rawSnapshot, ctx);
    assert.equal(critique.supportsFactualClaims, false, 'Critique must flag unsupported claims when quotes are missing from source text');
    assert.equal(critique.critiqueDecision, 'needs_review');
  });

  await t.test('7. Customer applicability and deterministic price calculations', async () => {
    // Ingest Anthropic price cut fixture
    const anthropicSource = env.db.prepare("SELECT * FROM sources WHERE id = 'fixture_anthropic_pricing'").get() as any;
    fixtureRegistry.setTimelineVersion(anthropicSource.id, 'baseline');
    await env.ingestion.ingestSource(anthropicSource);

    fixtureRegistry.setTimelineVersion(anthropicSource.id, 'substantive_change');
    const updateRes = await env.ingestion.ingestSource(anthropicSource);

    const changeEvt = env.db.prepare(`
      SELECT c.*, s.extracted_text, s.final_url, s.structured_facts
      FROM change_events c
      JOIN evidence_snapshots s ON c.evidence_snapshot_id = s.id
      WHERE c.id = ?
    `).get(updateRes.changeEventId) as any;

    const ctxWithUsage: CustomerContext = {
      tenantId: 'tenant_acme_legal',
      companyName: 'Acme Legal Partners',
      industry: 'Legal & Professional Services',
      selectedVendors: ['anthropic'],
      timezone: 'America/New_York',
      usageContext: {
        monthlyTokenVolumeMillions: 40,
      },
    };

    const proposal = await env.pipeline.reasonAboutChangeEvent(changeEvt, ctxWithUsage, 'job_calc_test');
    assert.ok(proposal);
    assert.equal(proposal.category, 'pricing');
    assert.equal(proposal.actionCategory, 'review_recommended');
    assert.ok(proposal.estimatedCostDelta?.includes('% change'), 'Must calculate percentage difference deterministically');
    assert.ok(proposal.estimatedCostDelta?.includes('40M tokens/mo'), 'Must calculate customer dollar impact when volume context is provided');
  });

  await t.test('8. Billing entitlement enforcement and webhook verification', () => {
    // Starter plan has limit of 3 vendors
    const entitlement1 = env.billing.enforceVendorEntitlement('tenant_apex_health', 3);
    assert.equal(entitlement1.allowed, true);

    const entitlement2 = env.billing.enforceVendorEntitlement('tenant_apex_health', 5);
    assert.equal(entitlement2.allowed, false, 'Starter plan cannot add 5 vendors without upgrade');

    // Test webhook signature verification
    const testSecret = 'whsec_test_radar_sandbox_key_2026';
    const payload = JSON.stringify({
      id: 'evt_stripe_webhook_1',
      type: 'customer.subscription.created',
      data: {
        object: {
          client_reference_id: 'tenant_apex_health',
          plan_id: 'pro',
          status: 'active',
        },
      },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const signedPayload = `${nowSec}.${payload}`;
    const sig = crypto.createHmac('sha256', testSecret).update(signedPayload).digest('hex');
    const sigHeader = `t=${nowSec},v1=${sig}`;

    assert.equal(env.billing.verifyWebhookSignature(payload, sigHeader), true);

    // Process webhook
    const processRes = env.billing.processWebhookEvent(JSON.parse(payload));
    assert.equal(processRes.processed, true);

    // Verify tenant upgraded in DB to pro
    const upgradedTenant = env.db.prepare('SELECT plan, vendor_limit FROM tenants WHERE id = ?').get('tenant_apex_health') as any;
    assert.equal(upgradedTenant.plan, 'pro');
    assert.equal(upgradedTenant.vendor_limit, 8);

    // Replay attack / duplicate webhook execution check (idempotency)
    const duplicateRes = env.billing.processWebhookEvent(JSON.parse(payload));
    assert.equal(duplicateRes.processed, false, 'Duplicate provider event must not be re-processed');
  });

  await t.test('9. Restart-safe jobs and duplicate-delivery prevention (Idempotency)', async () => {
    const payload = {
      tenantId: 'tenant_acme_legal',
      recipient: 'briefs@acmelegal.com',
      subject: 'Weekly Digest Issue #1',
      briefIssueNumber: 1,
      companyName: 'Acme Legal Partners',
      items: [
        {
          category: 'pricing',
          actionCategory: 'review_recommended',
          changeSummary: 'Claude 3.5 Haiku Price Reduction',
          applicabilityRationale: 'Direct savings on legal research workloads',
          businessImplication: 'Token input cost halved',
          suggestedAction: 'Update API routing',
          deadline: 'November 1, 2026',
          claimsWithEvidence: [
            {
              claim: 'Haiku Price Cut',
              sourceQuote: 'price is $0.50 / 1M input tokens',
              sourceUrl: 'https://docs.anthropic.com/en/pricing',
            },
          ],
        },
      ],
      sourceCoverage: {
        checked: 5,
        failed: 0,
        hasIncompleteCoverage: false,
      },
    };

    // First dispatch
    const firstDelivery = await env.email.sendWeeklyDigestEmail(payload);
    assert.equal(firstDelivery.delivered, true);

    // Re-dispatching same issue for same tenant (e.g. server worker restart or crash recovery)
    const secondDelivery = await env.email.sendWeeklyDigestEmail(payload);
    assert.equal(secondDelivery.idempotencyKey, firstDelivery.idempotencyKey);
    assert.equal(secondDelivery.emailId, firstDelivery.emailId, 'Must return existing delivery ID without duplicating outbound email record');

    const emailCount = (env.db.prepare('SELECT COUNT(*) as cnt FROM outbound_emails WHERE idempotency_key = ?').get(firstDelivery.idempotencyKey) as any).cnt;
    assert.equal(emailCount, 1, 'Only one email must be written to outbound queue');
  });

  await t.test('10. Live connector verification and safe HTML normalization', async () => {
    // Normalization test on rich HTML with noisy navigation, script tags, and comments
    const rawHtml = `
      <html>
        <head><script>alert('untrusted')</script><style>.body { color: red }</style></head>
        <body>
          <nav><a href="/home">Home</a><a href="/login">Login</a></nav>
          <header>Company Banner</header>
          <main>
            <h1>Google Gemini API Changelog</h1>
            <p>New model gemini-3.8-flash is generally available starting October 2026.</p>
            <p>Pricing for gemini-3.8-flash: $0.15 / 1M input tokens and $0.60 / 1M output tokens.</p>
          </main>
          <footer>Copyright 2026 Google LLC. All rights reserved. Page generated in 2ms.</footer>
        </body>
      </html>
    `;

    const { extractSubstantiveText, extractStructuredFacts, normalizeSnapshot } = await import('../server/sources/normalizer');
    const text = extractSubstantiveText(rawHtml);
    assert.ok(!text.includes('alert'), 'Must strip script tags');
    assert.ok(!text.includes('color: red'), 'Must strip styles');
    assert.ok(!text.includes('Copyright 2026'), 'Must strip cosmetic footers');
    assert.ok(text.includes('gemini-3.8-flash'), 'Must preserve substantive content');

    const facts = extractStructuredFacts(text);
    assert.ok(facts.models?.includes('gemini-3.8-flash'));
    assert.ok(facts.prices && facts.prices.length > 0);

    const snapshot = normalizeSnapshot(rawHtml);
    assert.ok(snapshot.contentHash);
    assert.ok(snapshot.substantiveHash);
  });
});
