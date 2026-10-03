import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { sha256 } from '../utils/crypto';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(customPath?: string): DatabaseSync {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath = customPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'radar.sqlite');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  initSchema(db);

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company_name TEXT NOT NULL,
      industry TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      plan TEXT NOT NULL DEFAULT 'starter',
      status TEXT NOT NULL DEFAULT 'active',
      vendor_limit INTEGER NOT NULL DEFAULT 3,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_preferences (
      tenant_id TEXT PRIMARY KEY,
      selected_vendors TEXT NOT NULL DEFAULT '[]',
      delivery_email TEXT NOT NULL,
      delivery_frequency TEXT NOT NULL DEFAULT 'weekly',
      delivery_day TEXT NOT NULL DEFAULT 'monday',
      notify_threshold TEXT NOT NULL DEFAULT 'all',
      usage_context TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      official_domain TEXT NOT NULL,
      documentation_url TEXT NOT NULL,
      pricing_url TEXT NOT NULL,
      status_url TEXT,
      policy_url TEXT,
      last_checked_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      url TEXT NOT NULL,
      parser_type TEXT NOT NULL DEFAULT 'generic_html',
      is_fixture INTEGER NOT NULL DEFAULT 0,
      last_fetched_at INTEGER,
      last_status TEXT,
      last_etag TEXT,
      last_content_hash TEXT,
      failure_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence_snapshots (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      vendor_id TEXT NOT NULL,
      original_url TEXT NOT NULL,
      final_url TEXT NOT NULL,
      retrieved_at INTEGER NOT NULL,
      published_at INTEGER,
      effective_at INTEGER,
      content_hash TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      extracted_text TEXT NOT NULL,
      structured_facts TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      parser_version TEXT NOT NULL,
      is_baseline INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
      FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS change_events (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      evidence_snapshot_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      substantive_diff TEXT NOT NULL DEFAULT '{}',
      observed_at INTEGER NOT NULL,
      effective_date TEXT,
      supporting_source_ids TEXT NOT NULL DEFAULT '[]',
      deduplication_key TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      FOREIGN KEY(evidence_snapshot_id) REFERENCES evidence_snapshots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brief_proposals (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      change_event_id TEXT NOT NULL,
      change_summary TEXT NOT NULL,
      category TEXT NOT NULL,
      applicability_level TEXT NOT NULL,
      applicability_rationale TEXT NOT NULL,
      business_implication TEXT NOT NULL,
      suggested_action TEXT NOT NULL,
      action_category TEXT NOT NULL,
      deadline TEXT,
      estimated_cost_delta TEXT,
      claims_with_evidence TEXT NOT NULL DEFAULT '[]',
      assumptions_missing_context TEXT,
      status TEXT NOT NULL DEFAULT 'proposed',
      created_at INTEGER NOT NULL,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY(change_event_id) REFERENCES change_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS critique_results (
      id TEXT PRIMARY KEY,
      brief_proposal_id TEXT UNIQUE NOT NULL,
      evidence_supported_score REAL NOT NULL,
      supports_factual_claims INTEGER NOT NULL,
      dates_and_products_match INTEGER NOT NULL,
      applicability_valid INTEGER NOT NULL,
      action_proportionate INTEGER NOT NULL,
      calculations_correct INTEGER NOT NULL,
      staleness_or_contradiction_warning TEXT,
      critique_decision TEXT NOT NULL,
      critique_notes TEXT NOT NULL,
      raw_model_response TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(brief_proposal_id) REFERENCES brief_proposals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS publication_ledger (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      brief_proposal_id TEXT NOT NULL,
      final_decision TEXT NOT NULL,
      decision_reason TEXT NOT NULL,
      owner_notes TEXT,
      reviewed_by TEXT NOT NULL DEFAULT 'system',
      model_version TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      published_at INTEGER NOT NULL,
      delivered_at INTEGER,
      delivery_status TEXT NOT NULL DEFAULT 'pending',
      idempotency_key TEXT UNIQUE NOT NULL,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY(brief_proposal_id) REFERENCES brief_proposals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS weekly_briefs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      issue_number INTEGER NOT NULL,
      week_start_date TEXT NOT NULL,
      week_end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at INTEGER,
      generated_at INTEGER NOT NULL,
      summary_text TEXT NOT NULL,
      source_coverage_stats TEXT NOT NULL DEFAULT '{}',
      accepted_item_ids TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS billing_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      event_type TEXT NOT NULL,
      provider_event_id TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processed',
      processed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_and_job_runs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      sources_checked INTEGER NOT NULL DEFAULT 0,
      changes_detected INTEGER NOT NULL DEFAULT 0,
      briefs_generated INTEGER NOT NULL DEFAULT 0,
      llm_budget_tokens INTEGER NOT NULL DEFAULT 0,
      cost_estimate_usd REAL NOT NULL DEFAULT 0.0,
      error_details TEXT
    );

    CREATE TABLE IF NOT EXISTS outbound_emails (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      html_body TEXT NOT NULL,
      text_body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      provider TEXT NOT NULL DEFAULT 'test_sandbox',
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      sent_at INTEGER,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default publication mode: 'reviewed' (can also be 'automatic')
  const modeStmt = db.prepare("SELECT value FROM system_config WHERE key = 'publication_mode'");
  const mode = modeStmt.get() as { value?: string } | undefined;
  if (!mode) {
    db.prepare("INSERT INTO system_config (key, value) VALUES ('publication_mode', 'reviewed')").run();
  }

  seedInitialData(db);
}

function seedInitialData(db: DatabaseSync): void {
  // Check if vendors already exist
  const vendorCount = (db.prepare('SELECT COUNT(*) as count FROM vendors').get() as { count: number }).count;
  if (vendorCount === 0) {
    const now = Date.now();
    const vendors = [
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'Developer of GPT-4o, o1, o3-mini models, ChatGPT Enterprise, and OpenAI API.',
        category: 'Foundation Models & API',
        officialDomain: 'openai.com',
        documentationUrl: 'https://platform.openai.com/docs',
        pricingUrl: 'https://openai.com/api/pricing/',
        statusUrl: 'https://status.openai.com',
        policyUrl: 'https://openai.com/policies/business-terms',
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Developer of Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, and Console API.',
        category: 'Foundation Models & API',
        officialDomain: 'anthropic.com',
        documentationUrl: 'https://docs.anthropic.com',
        pricingUrl: 'https://docs.anthropic.com/en/pricing',
        statusUrl: 'https://status.anthropic.com',
        policyUrl: 'https://www.anthropic.com/legal/commercial-terms',
      },
      {
        id: 'google_gemini',
        name: 'Google Gemini & Workspace AI',
        description: 'Gemini 2.5/3.8 models, Google AI Studio, Vertex AI, and Gemini for Google Workspace.',
        category: 'Cloud AI & Productivity',
        officialDomain: 'ai.google.dev',
        documentationUrl: 'https://ai.google.dev/docs',
        pricingUrl: 'https://ai.google.dev/pricing',
        statusUrl: 'https://status.cloud.google.com',
        policyUrl: 'https://policies.google.com/terms',
      },
      {
        id: 'microsoft_azure',
        name: 'Microsoft Azure OpenAI & Copilot',
        description: 'Azure OpenAI Service enterprise instances and Microsoft 365 Copilot integrations.',
        category: 'Enterprise Cloud AI',
        officialDomain: 'azure.microsoft.com',
        documentationUrl: 'https://learn.microsoft.com/azure/ai-services/openai/',
        pricingUrl: 'https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/',
        statusUrl: 'https://azure.status.microsoft.com',
        policyUrl: 'https://www.microsoft.com/licensing/terms',
      },
      {
        id: 'aws_bedrock',
        name: 'Amazon Web Services (Bedrock)',
        description: 'Fully managed multi-model service providing access to Claude, Llama, Titan, and Mistral.',
        category: 'Enterprise Cloud AI',
        officialDomain: 'aws.amazon.com',
        documentationUrl: 'https://docs.aws.amazon.com/bedrock/',
        pricingUrl: 'https://aws.amazon.com/bedrock/pricing/',
        statusUrl: 'https://health.aws.amazon.com',
        policyUrl: 'https://aws.amazon.com/service-terms/',
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        description: 'Mistral Large, Pixtral, Codestral, and open-weight European frontier models.',
        category: 'Foundation Models & API',
        officialDomain: 'mistral.ai',
        documentationUrl: 'https://docs.mistral.ai',
        pricingUrl: 'https://mistral.ai/pricing',
        statusUrl: 'https://status.mistral.ai',
        policyUrl: 'https://mistral.ai/terms',
      },
    ];

    const insertVendor = db.prepare(`
      INSERT INTO vendors (id, name, description, category, official_domain, documentation_url, pricing_url, status_url, policy_url, last_checked_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const v of vendors) {
      insertVendor.run(v.id, v.name, v.description, v.category, v.officialDomain, v.documentationUrl, v.pricingUrl, v.statusUrl, v.policyUrl, null, now);
    }

    // Insert official sources for live and fixture monitoring
    const insertSource = db.prepare(`
      INSERT INTO sources (id, vendor_id, name, source_type, url, parser_type, is_fixture, last_fetched_at, last_status, last_etag, last_content_hash, failure_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultSources = [
      {
        id: 'src_openai_pricing',
        vendorId: 'openai',
        name: 'OpenAI Official API Pricing Table',
        sourceType: 'pricing',
        url: 'https://openai.com/api/pricing/',
        parserType: 'openai_pricing',
        isFixture: 0,
      },
      {
        id: 'src_anthropic_changelog',
        vendorId: 'anthropic',
        name: 'Anthropic Release Notes & Changelog',
        sourceType: 'changelog',
        url: 'https://docs.anthropic.com/en/release-notes/overview',
        parserType: 'anthropic_release_notes',
        isFixture: 0,
      },
      {
        id: 'src_gemini_changelog',
        vendorId: 'google_gemini',
        name: 'Google Gemini API Changelog',
        sourceType: 'changelog',
        url: 'https://ai.google.dev/gemini-api/docs/changelog',
        parserType: 'gemini_changelog',
        isFixture: 0,
      },
      // Deterministic fixture sources for testing and reproducible baseline/diff demonstration
      {
        id: 'fixture_openai_models',
        vendorId: 'openai',
        name: 'OpenAI Model Availability & Deprecation Notice (Fixture)',
        sourceType: 'deprecations',
        url: 'https://fixtures.radar.internal/openai/models-deprecation.json',
        parserType: 'fixture_json',
        isFixture: 1,
      },
      {
        id: 'fixture_anthropic_pricing',
        vendorId: 'anthropic',
        name: 'Anthropic Claude 3.5 Haiku Pricing Cut Notice (Fixture)',
        sourceType: 'pricing',
        url: 'https://fixtures.radar.internal/anthropic/haiku-pricing.json',
        parserType: 'fixture_json',
        isFixture: 1,
      },
      {
        id: 'fixture_gemini_security',
        vendorId: 'google_gemini',
        name: 'Google Gemini Workspace Security & Data Retention Policy (Fixture)',
        sourceType: 'security',
        url: 'https://fixtures.radar.internal/google/workspace-ai-security.json',
        parserType: 'fixture_json',
        isFixture: 1,
      },
    ];

    for (const s of defaultSources) {
      insertSource.run(s.id, s.vendorId, s.name, s.sourceType, s.url, s.parserType, s.isFixture, null, null, null, null, 0);
    }
  }

  // Seed default demonstration SMB tenant accounts if none exist
  const tenantCount = (db.prepare('SELECT COUNT(*) as count FROM tenants').get() as { count: number }).count;
  if (tenantCount === 0) {
    const now = Date.now();
    const demoTenants = [
      {
        id: 'tenant_acme_legal',
        email: 'managing-partner@acmelegal.com',
        passwordHash: sha256('radar2026!acme'),
        companyName: 'Acme Legal Partners LLP',
        industry: 'Legal & Professional Services',
        timezone: 'America/New_York',
        plan: 'pro',
        vendorLimit: 8,
        selectedVendors: ['openai', 'anthropic'],
        deliveryEmail: 'briefs@acmelegal.com',
        usageContext: {
          activeSeats: 35,
          monthlyTokenVolumeMillions: 45,
          primaryUseCases: ['Document discovery', 'Contract clause comparison', 'Drafting research'],
          confidentialDataHandlingRequired: true,
          primaryRegions: ['us-east'],
        },
      },
      {
        id: 'tenant_apex_health',
        email: 'cto@apexhealthclinic.org',
        passwordHash: sha256('radar2026!apex'),
        companyName: 'Apex Health Systems',
        industry: 'Healthcare & Life Sciences',
        timezone: 'America/Chicago',
        plan: 'starter',
        vendorLimit: 3,
        selectedVendors: ['google_gemini', 'microsoft_azure'],
        deliveryEmail: 'ai-governance@apexhealthclinic.org',
        usageContext: {
          activeSeats: 120,
          monthlyTokenVolumeMillions: 20,
          primaryUseCases: ['Patient intake summarization', 'Physician ambient notes'],
          baaRequired: true,
          primaryRegions: ['us-central'],
        },
      },
      {
        id: 'tenant_cloudscale',
        email: 'engineering@cloudscalesoftware.io',
        passwordHash: sha256('radar2026!cloud'),
        companyName: 'CloudScale SaaS Inc',
        industry: 'Technology & Software Development',
        timezone: 'America/Los_Angeles',
        plan: 'enterprise',
        vendorLimit: 99,
        selectedVendors: ['openai', 'anthropic', 'aws_bedrock', 'mistral'],
        deliveryEmail: 'ai-ops@cloudscalesoftware.io',
        usageContext: {
          activeSeats: 85,
          monthlyTokenVolumeMillions: 250,
          primaryUseCases: ['Customer support copilots', 'Code autocomplete', 'Agentic workflow routing'],
          baaRequired: false,
          primaryRegions: ['us-west-2', 'eu-west-1'],
        },
      },
    ];

    const insertTenant = db.prepare(`
      INSERT INTO tenants (id, email, password_hash, company_name, industry, timezone, plan, status, vendor_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);

    const insertPref = db.prepare(`
      INSERT INTO tenant_preferences (tenant_id, selected_vendors, delivery_email, delivery_frequency, delivery_day, notify_threshold, usage_context, created_at, updated_at)
      VALUES (?, ?, ?, 'weekly', 'monday', 'all', ?, ?, ?)
    `);

    for (const t of demoTenants) {
      insertTenant.run(t.id, t.email, t.passwordHash, t.companyName, t.industry, t.timezone, t.plan, t.vendorLimit, now, now);
      insertPref.run(t.id, JSON.stringify(t.selectedVendors), t.deliveryEmail, JSON.stringify(t.usageContext), now, now);
    }

    // Insert an initial session for Acme Legal
    const sampleToken = 'radar_session_acme_demo_token_2026';
    const sampleTokenHash = sha256(sampleToken);
    db.prepare(`
      INSERT INTO sessions (token_hash, tenant_id, role, expires_at, created_at)
      VALUES (?, 'tenant_acme_legal', 'customer', ?, ?)
    `).run(sampleTokenHash, now + 365 * 24 * 3600 * 1000, now);

    // Insert an owner admin session
    const ownerToken = 'radar_session_owner_admin_token_2026';
    const ownerTokenHash = sha256(ownerToken);
    db.prepare(`
      INSERT INTO sessions (token_hash, tenant_id, role, expires_at, created_at)
      VALUES (?, 'tenant_acme_legal', 'owner', ?, ?)
    `).run(ownerTokenHash, now + 365 * 24 * 3600 * 1000, now);
  }
}
