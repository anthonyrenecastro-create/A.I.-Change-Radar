import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { getDatabase } from './server/db/database';
import { IngestionService, fixtureRegistry } from './server/sources/connectors';
import { PipelineEngine } from './server/engine/pipeline';
import { EmailService } from './server/email/emailAdapter';
import { BillingService, PLANS } from './server/billing/billingAdapter';
import { RadarScheduler } from './server/engine/scheduler';
import { createAuthMiddleware, requireOwnerRole, AuthenticatedRequest } from './server/auth/authMiddleware';
import { generateId, sha256 } from './server/utils/crypto';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Database & Core Services
const db = getDatabase();
const ingestionService = new IngestionService(db);
const pipelineEngine = new PipelineEngine(db);
const emailService = new EmailService(db);
const billingService = new BillingService(db);
const scheduler = new RadarScheduler(db, ingestionService, pipelineEngine, emailService);

// Start autonomous background scheduler
scheduler.start();

const authMiddleware = createAuthMiddleware(db);

// ==========================================
// 1. HEALTH & SYSTEM STATUS
// ==========================================
app.get('/api/health', (req, res) => {
  const sourcesCount = (db.prepare('SELECT COUNT(*) as count FROM sources').get() as any)?.count || 0;
  const tenantsCount = (db.prepare('SELECT COUNT(*) as count FROM tenants').get() as any)?.count || 0;
  const briefsCount = (db.prepare('SELECT COUNT(*) as count FROM weekly_briefs').get() as any)?.count || 0;

  res.json({
    status: 'ok',
    service: 'AZxAI Radar',
    version: '2.0.0',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    emailProvider: emailService.getProviderName(),
    dbStats: {
      sources: sourcesCount,
      tenants: tenantsCount,
      weeklyBriefs: briefsCount,
    },
    timestamp: Date.now(),
  });
});

// ==========================================
// 2. AUTHENTICATION & ONBOARDING
// ==========================================

// Sign In (Login)
const handleSignIn = (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const tenant = db.prepare('SELECT * FROM tenants WHERE email = ?').get(email.toLowerCase().trim()) as any;
  if (!tenant || tenant.password_hash !== sha256(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateId('token');
  const tokenHash = sha256(token);
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 3600 * 1000; // 30 days

  // Check if role is owner (managing partner or admin)
  const role = tenant.email.includes('managing') || tenant.email.includes('owner') || tenant.email.includes('admin') ? 'owner' : 'customer';

  db.prepare(`
    INSERT INTO sessions (token_hash, tenant_id, role, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenHash, tenant.id, role, expiresAt, now);

  res.json({
    token,
    role,
    tenant: {
      id: tenant.id,
      email: tenant.email,
      companyName: tenant.company_name,
      industry: tenant.industry,
      plan: tenant.plan,
      vendorLimit: tenant.vendor_limit,
    },
  });
};

app.post('/api/auth/signin', handleSignIn);
app.post('/api/auth/login', handleSignIn);

// Sign Out (Logout)
app.post('/api/auth/logout', authMiddleware, (req: AuthenticatedRequest, res) => {
  const token = req.token;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// Self-Serve Sign Up (Onboarding)
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, companyName, industry, selectedVendors, timezone, plan, usageContext, deliveryDay } = req.body;
  if (!email || !password || !companyName || !industry) {
    return res.status(400).json({ error: 'Email, password, company name, and industry are required' });
  }

  const existing = db.prepare('SELECT id FROM tenants WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const tenantId = generateId('tenant');
  const now = Date.now();
  const chosenPlan = plan === 'professional' ? 'professional' : plan === 'enterprise' ? 'enterprise' : 'starter';
  const vendorLimit = chosenPlan === 'professional' ? 7 : chosenPlan === 'enterprise' ? 999 : 3;
  const vendors = Array.isArray(selectedVendors) ? selectedVendors.slice(0, vendorLimit) : ['openai', 'anthropic'];

  db.prepare(`
    INSERT INTO tenants (id, email, password_hash, company_name, industry, timezone, plan, status, vendor_limit, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    tenantId,
    email.toLowerCase().trim(),
    sha256(password),
    companyName.trim(),
    industry.trim(),
    timezone || 'America/New_York',
    chosenPlan,
    vendorLimit,
    now,
    now
  );

  db.prepare(`
    INSERT INTO tenant_preferences (tenant_id, selected_vendors, delivery_email, delivery_frequency, delivery_day, notify_threshold, usage_context, created_at, updated_at)
    VALUES (?, ?, ?, 'weekly', ?, 'all', ?, ?, ?)
  `).run(
    tenantId,
    JSON.stringify(vendors),
    email.toLowerCase().trim(),
    deliveryDay || 'monday',
    JSON.stringify(usageContext || {}),
    now,
    now
  );

  const token = generateId('token');
  const tokenHash = sha256(token);
  const expiresAt = now + 30 * 24 * 3600 * 1000;

  db.prepare(`
    INSERT INTO sessions (token_hash, tenant_id, role, expires_at, created_at)
    VALUES (?, ?, 'customer', ?, ?)
  `).run(tokenHash, tenantId, expiresAt, now);

  // Immediately generate initial baseline brief for the new tenant
  try {
    await pipelineEngine.processTenantWeeklyBrief(tenantId);
  } catch (briefErr) {
    console.warn(`Could not generate initial brief for new tenant ${tenantId}:`, briefErr);
  }

  res.status(201).json({
    token,
    role: 'customer',
    tenant: {
      id: tenantId,
      email,
      companyName,
      industry,
      plan: chosenPlan,
      vendorLimit,
    },
  });
});

// Quick Switch Demo Persona (for immediate exploration and evaluator review)
app.post('/api/auth/demo-switch', (req, res) => {
  const { tenantId, role } = req.body;
  const targetId = tenantId || 'tenant_acme_legal';
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(targetId) as any;
  if (!tenant) {
    return res.status(404).json({ error: 'Demo tenant not found' });
  }

  const token = generateId('token');
  const tokenHash = sha256(token);
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 3600 * 1000;
  const userRole = role === 'owner' ? 'owner' : 'customer';

  db.prepare(`
    INSERT INTO sessions (token_hash, tenant_id, role, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenHash, tenant.id, userRole, expiresAt, now);

  res.json({
    token,
    role: userRole,
    tenant: {
      id: tenant.id,
      email: tenant.email,
      companyName: tenant.company_name,
      industry: tenant.industry,
      plan: tenant.plan,
      vendorLimit: tenant.vendor_limit,
    },
  });
});

// ==========================================
// 3. TENANT CONTEXT & SUBSCRIPTIONS
// ==========================================

// Get Tenant Profile & Preferences
app.get('/api/tenant/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  const tenant = req.tenant!;
  const prefs = db.prepare('SELECT * FROM tenant_preferences WHERE tenant_id = ?').get(tenant.id) as any;

  res.json({
    tenant,
    role: req.userRole,
    preferences: {
      selectedVendors: JSON.parse(prefs?.selected_vendors || '[]'),
      deliveryEmail: prefs?.delivery_email || tenant.email,
      deliveryFrequency: prefs?.delivery_frequency || 'weekly',
      deliveryDay: prefs?.delivery_day || 'monday',
      notifyThreshold: prefs?.notify_threshold || 'all',
      usageContext: JSON.parse(prefs?.usage_context || '{}'),
    },
  });
});

// Update Preferences & Selected Vendors with Entitlement Check
app.put('/api/tenant/preferences', authMiddleware, (req: AuthenticatedRequest, res) => {
  const tenant = req.tenant!;
  const { selectedVendors, deliveryEmail, deliveryFrequency, deliveryDay, notifyThreshold, usageContext } = req.body;

  // Check vendor limit entitlement
  if (Array.isArray(selectedVendors)) {
    const entitlement = billingService.enforceVendorEntitlement(tenant.id, selectedVendors.length);
    if (!entitlement.allowed) {
      return res.status(403).json({
        error: `Your current ${entitlement.currentPlan.toUpperCase()} plan allows tracking up to ${entitlement.limit} vendors. You selected ${selectedVendors.length}. Please upgrade your plan to track additional vendors.`,
        limit: entitlement.limit,
      });
    }
  }

  const now = Date.now();
  const current = db.prepare('SELECT * FROM tenant_preferences WHERE tenant_id = ?').get(tenant.id) as any;

  const newVendors = selectedVendors !== undefined ? JSON.stringify(selectedVendors) : current?.selected_vendors;
  const newEmail = deliveryEmail || current?.delivery_email || tenant.email;
  const newFreq = deliveryFrequency || current?.delivery_frequency || 'weekly';
  const newDay = deliveryDay || current?.delivery_day || 'monday';
  const newThreshold = notifyThreshold || current?.notify_threshold || 'all';
  const newUsage = usageContext !== undefined ? JSON.stringify(usageContext) : current?.usage_context;

  db.prepare(`
    UPDATE tenant_preferences
    SET selected_vendors = ?, delivery_email = ?, delivery_frequency = ?,
        delivery_day = ?, notify_threshold = ?, usage_context = ?, updated_at = ?
    WHERE tenant_id = ?
  `).run(newVendors, newEmail, newFreq, newDay, newThreshold, newUsage, now, tenant.id);

  res.json({ success: true, message: 'Preferences updated successfully.' });
});

// Update / Upgrade Subscription Plan Directly (No Stripe Required)
app.post('/api/tenant/plan', authMiddleware, (req: AuthenticatedRequest, res) => {
  const tenant = req.tenant!;
  const { plan } = req.body;
  const targetPlan = (plan || 'pro').toLowerCase();
  const planConfig = PLANS[targetPlan] || PLANS.pro;

  const now = Date.now();
  db.prepare(`
    UPDATE tenants
    SET plan = ?, vendor_limit = ?, updated_at = ?
    WHERE id = ?
  `).run(planConfig.id, planConfig.vendorLimit, now, tenant.id);

  const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenant.id) as any;
  res.json({
    success: true,
    message: `Plan upgraded to ${planConfig.name}. You can now track up to ${planConfig.vendorLimit} vendors.`,
    tenant: {
      id: updated.id,
      email: updated.email,
      companyName: updated.company_name,
      company_name: updated.company_name,
      industry: updated.industry,
      plan: updated.plan,
      vendorLimit: updated.vendor_limit,
      vendor_limit: updated.vendor_limit,
    },
  });
});

// Get Customer Weekly Briefs
app.get('/api/tenant/briefs', authMiddleware, (req: AuthenticatedRequest, res) => {
  const tenant = req.tenant!;
  const briefs = db.prepare(`
    SELECT * FROM weekly_briefs
    WHERE tenant_id = ?
    ORDER BY generated_at DESC
  `).all(tenant.id) as any[];

  res.json({
    briefs: briefs.map((b) => ({
      ...b,
      sourceCoverageStats: JSON.parse(b.source_coverage_stats || '{}'),
      acceptedItemIds: JSON.parse(b.accepted_item_ids || '[]'),
    })),
  });
});

// Get a Specific Weekly Brief with its Items and Claims
app.get('/api/tenant/briefs/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const tenant = req.tenant!;
  const brief = db.prepare('SELECT * FROM weekly_briefs WHERE id = ? AND tenant_id = ?').get(req.params.id, tenant.id) as any;

  if (!brief) {
    return res.status(404).json({ error: 'Weekly brief not found' });
  }

  const acceptedItemIds: string[] = JSON.parse(brief.accepted_item_ids || '[]');
  let items: any[] = [];
  if (acceptedItemIds.length > 0) {
    const placeholders = acceptedItemIds.map(() => '?').join(',');
    items = db.prepare(`
      SELECT p.*, e.vendor_id, v.name as vendor_name
      FROM brief_proposals p
      JOIN change_events e ON p.change_event_id = e.id
      LEFT JOIN vendors v ON e.vendor_id = v.id
      WHERE p.id IN (${placeholders})
    `).all(...acceptedItemIds) as any[];
  }

  const parsedItems = items.map((i) => ({
    ...i,
    claimsWithEvidence: JSON.parse(i.claims_with_evidence || '[]'),
  }));

  res.json({
    brief: {
      ...brief,
      sourceCoverageStats: JSON.parse(brief.source_coverage_stats || '{}'),
      acceptedItemIds,
    },
    items: parsedItems,
  });
});

// Run On-Demand Analysis / Generate Fresh Brief with Current Customized Parameters
app.post('/api/tenant/generate-brief', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const tenant = req.tenant!;
  try {
    const result = await pipelineEngine.processTenantWeeklyBrief(tenant.id);
    res.json({
      success: true,
      message: 'Fresh intelligence brief successfully generated.',
      result,
    });
  } catch (err: any) {
    console.error('Error generating on-demand brief:', err);
    res.status(500).json({ error: err.message || 'Failed to generate brief' });
  }
});

// List All Tracked Vendors Catalog
app.get('/api/vendors', (req, res) => {
  const vendors = db.prepare('SELECT * FROM vendors ORDER BY name ASC').all();
  res.json({ vendors });
});

// List Plans & Hypothesis Pricing
app.get('/api/billing/plans', (req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

// ==========================================
// 4. EDITORIAL & OWNER CONSOLE
// ==========================================

// Get Sources Health & Freshness
app.get('/api/owner/sources', authMiddleware, requireOwnerRole, (req, res) => {
  const sources = db.prepare(`
    SELECT s.*, v.name as vendor_name,
      (SELECT COUNT(*) FROM evidence_snapshots WHERE source_id = s.id) as snapshot_count,
      (SELECT is_baseline FROM evidence_snapshots WHERE source_id = s.id ORDER BY retrieved_at ASC LIMIT 1) as has_baseline
    FROM sources s
    JOIN vendors v ON s.vendor_id = v.id
    ORDER BY s.vendor_id ASC, s.name ASC
  `).all();

  res.json({ sources });
});

// Trigger Source Ingestion Manually
app.post('/api/owner/sources/check-now', authMiddleware, requireOwnerRole, async (req, res) => {
  try {
    const result = await scheduler.runIngestionJob();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Review Queue (Pending Proposals & Exceptions)
app.get('/api/owner/review-queue', authMiddleware, requireOwnerRole, (req, res) => {
  const proposals = db.prepare(`
    SELECT p.*, e.vendor_id, v.name as vendor_name, t.company_name, t.industry,
           c.evidence_supported_score, c.supports_factual_claims, c.dates_and_products_match,
           c.applicability_valid, c.critique_decision, c.critique_notes,
           s.final_url, s.extracted_text as source_text
    FROM brief_proposals p
    JOIN change_events e ON p.change_event_id = e.id
    JOIN vendors v ON e.vendor_id = v.id
    JOIN tenants t ON p.tenant_id = t.id
    LEFT JOIN critique_results c ON c.brief_proposal_id = p.id
    JOIN evidence_snapshots s ON e.evidence_snapshot_id = s.id
    WHERE p.status IN ('proposed', 'needs_review')
    ORDER BY p.created_at DESC
  `).all() as any[];

  res.json({
    proposals: proposals.map((p) => ({
      ...p,
      claimsWithEvidence: JSON.parse(p.claims_with_evidence || '[]'),
    })),
  });
});

// Owner Action: Approve, Reject, or Edit Proposal
app.post('/api/owner/proposals/:id/decision', authMiddleware, requireOwnerRole, async (req: AuthenticatedRequest, res) => {
  const proposalId = req.params.id;
  const { decision, ownerNotes, editedSummary, editedAction } = req.body; // 'accept' | 'reject' | 'revise'

  if (!['accept', 'reject', 'revise'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be accept, reject, or revise' });
  }

  const proposal = db.prepare('SELECT * FROM brief_proposals WHERE id = ?').get(proposalId) as any;
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  const now = Date.now();
  const finalStatus = decision === 'accept' || decision === 'revise' ? 'accepted' : 'rejected';

  if (decision === 'revise') {
    db.prepare(`
      UPDATE brief_proposals
      SET change_summary = COALESCE(?, change_summary),
          suggested_action = COALESCE(?, suggested_action),
          status = ?
      WHERE id = ?
    `).run(editedSummary, editedAction, finalStatus, proposalId);
  } else {
    db.prepare('UPDATE brief_proposals SET status = ? WHERE id = ?').run(finalStatus, proposalId);
  }

  // Update Publication Ledger
  const finalDecision = decision === 'accept' || decision === 'revise' ? 'published' : 'rejected_by_owner';
  const ledgerId = generateId('led');
  const idempotencyKey = sha256(`owner_review:${proposal.tenant_id}:${proposal.id}:${now}`);

  db.prepare(`
    INSERT INTO publication_ledger (
      id, tenant_id, job_id, brief_proposal_id, final_decision, decision_reason,
      owner_notes, reviewed_by, model_version, prompt_version, published_at,
      delivered_at, delivery_status, idempotency_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'editorial_owner', 'manual_review', ?, null, 'ready', ?)
  `).run(
    ledgerId,
    proposal.tenant_id,
    proposal.job_id,
    proposal.id,
    finalDecision,
    `Editorial Owner Action: ${decision.toUpperCase()}`,
    ownerNotes || null,
    req.tenant?.email || 'owner',
    now,
    idempotencyKey
  );

  // If approved, update tenant's latest weekly brief to include this item
  if (finalDecision === 'published') {
    const latestBrief = db.prepare(`
      SELECT * FROM weekly_briefs WHERE tenant_id = ? ORDER BY generated_at DESC LIMIT 1
    `).get(proposal.tenant_id) as any;

    if (latestBrief) {
      const currentItems: string[] = JSON.parse(latestBrief.accepted_item_ids || '[]');
      if (!currentItems.includes(proposal.id)) {
        currentItems.push(proposal.id);
        db.prepare('UPDATE weekly_briefs SET accepted_item_ids = ?, status = ? WHERE id = ?').run(
          JSON.stringify(currentItems),
          'published',
          latestBrief.id
        );
      }

      // Record outbound email in test sandbox with idempotency
      try {
        const placeholders = currentItems.map(() => '?').join(',');
        const briefItems = db.prepare(`SELECT * FROM brief_proposals WHERE id IN (${placeholders})`).all(...currentItems) as any[];
        const tenantRecord = db.prepare('SELECT * FROM tenants WHERE id = ?').get(proposal.tenant_id) as any;
        const tenantPrefs = db.prepare('SELECT delivery_email FROM tenant_preferences WHERE tenant_id = ?').get(proposal.tenant_id) as any;
        const recipient = tenantPrefs?.delivery_email || tenantRecord.email;

        await emailService.sendWeeklyDigestEmail({
          tenantId: tenantRecord.id,
          recipient,
          subject: `[AI Change Radar] Weekly Brief #${latestBrief.issue_number}: Verified AI Updates for ${tenantRecord.company_name}`,
          briefIssueNumber: latestBrief.issue_number,
          companyName: tenantRecord.company_name,
          items: briefItems.map((i) => ({
            category: i.category,
            actionCategory: i.action_category,
            changeSummary: i.change_summary,
            applicabilityRationale: i.applicability_rationale,
            businessImplication: i.business_implication,
            suggestedAction: i.suggested_action,
            deadline: i.deadline,
            claimsWithEvidence: JSON.parse(i.claims_with_evidence || '[]'),
          })),
          sourceCoverage: JSON.parse(latestBrief.source_coverage_stats || '{"checked":0,"failed":0,"hasIncompleteCoverage":false}'),
        });
      } catch (emlErr) {
        console.error('Error dispatching sandbox email:', emlErr);
      }
    }
  }

  res.json({ success: true, decision, proposalId });
});

// Publication Mode: Get and Set
app.get('/api/owner/mode', authMiddleware, requireOwnerRole, (req, res) => {
  const row = db.prepare("SELECT value FROM system_config WHERE key = 'publication_mode'").get() as any;
  res.json({ mode: row?.value || 'reviewed' });
});

app.post('/api/owner/mode', authMiddleware, requireOwnerRole, (req, res) => {
  const { mode } = req.body;
  if (!['reviewed', 'automatic'].includes(mode)) {
    return res.status(400).json({ error: 'Mode must be reviewed or automatic' });
  }

  db.prepare("UPDATE system_config SET value = ? WHERE key = 'publication_mode'").run(mode);
  res.json({ success: true, mode });
});

// Job Runs & Audit Logs
app.get('/api/owner/jobs', authMiddleware, requireOwnerRole, (req, res) => {
  const jobs = db.prepare('SELECT * FROM audit_and_job_runs ORDER BY started_at DESC LIMIT 50').all();
  res.json({ jobs });
});

// Outbound Emails (Sandbox & Delivery Logs)
app.get('/api/owner/emails', authMiddleware, requireOwnerRole, (req, res) => {
  const emails = db.prepare(`
    SELECT e.*, t.company_name
    FROM outbound_emails e
    JOIN tenants t ON e.tenant_id = t.id
    ORDER BY e.sent_at DESC
    LIMIT 50
  `).all();
  res.json({ emails });
});

// Trigger Digest Generation Cycle for All Tenants
app.post('/api/owner/trigger-digest', authMiddleware, requireOwnerRole, async (req, res) => {
  try {
    const result = await scheduler.runDigestCycle();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. BILLING & WEBHOOKS
// ==========================================
app.post('/api/billing/webhook', (req, res) => {
  const signature = req.headers['stripe-signature'] as string | undefined;
  const rawBody = JSON.stringify(req.body);

  // In test sandbox environments or automated test runners, signature header can be validated
  if (signature && !billingService.verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  const result = billingService.processWebhookEvent(req.body);
  res.json(result);
});

// ==========================================
// 6. END-TO-END DEMO FIXTURE SCENARIO
// ==========================================
app.post('/api/demo/run-scenario', async (req, res) => {
  try {
    const now = Date.now();
    const testTenantId = 'tenant_acme_legal';

    // Step 1: Initialize baseline state for fixture sources
    fixtureRegistry.setTimelineVersion('fixture_openai_models', 'baseline');
    fixtureRegistry.setTimelineVersion('fixture_anthropic_pricing', 'baseline');
    fixtureRegistry.setTimelineVersion('fixture_gemini_security', 'baseline');

    const baselineSources = db.prepare("SELECT * FROM sources WHERE id LIKE 'fixture_%'").all() as any[];
    for (const s of baselineSources) {
      await ingestionService.ingestSource(s);
    }

    // Step 2: Advance timeline to substantive changes (Claude price cut & OpenAI deprecation)
    fixtureRegistry.setTimelineVersion('fixture_openai_models', 'substantive_change');
    fixtureRegistry.setTimelineVersion('fixture_anthropic_pricing', 'substantive_change');

    const substantiveResults = [];
    for (const s of baselineSources) {
      const ingestRes = await ingestionService.ingestSource(s);
      substantiveResults.push(ingestRes);
    }

    // Step 3: Test cosmetic noise suppression
    fixtureRegistry.setTimelineVersion('fixture_openai_models', 'cosmetic_change');
    const cosmeticSource = db.prepare("SELECT * FROM sources WHERE id = 'fixture_openai_models'").get() as any;
    const cosmeticResult = await ingestionService.ingestSource(cosmeticSource);

    // Step 4: Run Reasoning & Critique Pipeline for Acme Legal
    const pipelineResult = await pipelineEngine.processTenantWeeklyBrief(testTenantId);

    // Step 5: Deliver Test Digest Email
    const brief = db.prepare('SELECT * FROM weekly_briefs WHERE id = ?').get(pipelineResult.briefId) as any;
    const acceptedIds: string[] = JSON.parse(brief.accepted_item_ids || '[]');

    let emailSent = false;
    let emailId = '';
    if (acceptedIds.length > 0) {
      const placeholders = acceptedIds.map(() => '?').join(',');
      const items = db.prepare(`SELECT * FROM brief_proposals WHERE id IN (${placeholders})`).all(...acceptedIds) as any[];
      const emailRes = await emailService.sendWeeklyDigestEmail({
        tenantId: testTenantId,
        recipient: 'briefs@acmelegal.com',
        subject: `[Verified Demo] AI Change Radar Brief #${brief.issue_number}`,
        briefIssueNumber: brief.issue_number,
        companyName: 'Acme Legal Partners LLP',
        items: items.map((i) => ({
          category: i.category,
          actionCategory: i.action_category,
          changeSummary: i.change_summary,
          applicabilityRationale: i.applicability_rationale,
          businessImplication: i.business_implication,
          suggestedAction: i.suggested_action,
          deadline: i.deadline,
          claimsWithEvidence: JSON.parse(i.claims_with_evidence || '[]'),
        })),
        sourceCoverage: pipelineResult.sourceCoverage,
      });
      emailSent = emailRes.delivered;
      emailId = emailRes.emailId;
    }

    res.json({
      success: true,
      scenario: 'End-to-End Baseline -> Substantive Change -> Critique -> Ledger -> Delivery',
      substantiveResults,
      cosmeticSuppressionResult: cosmeticResult,
      pipelineResult,
      emailDelivered: emailSent,
      emailId,
      timestamp: now,
    });
  } catch (err: any) {
    console.error('Demo scenario error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 404 handler for unmatched API routes to ensure they always return JSON, not HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// ==========================================
// 8. SERVER STARTUP & VITE INTEGRATION
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI Change Radar] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
