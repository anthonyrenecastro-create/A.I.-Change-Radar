export interface Migration { id: number; name: string; sql: string }

export const MIGRATIONS: Migration[] = [
  {
    id: 1, name: 'accounts_entitlements_billing',
    sql: `
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer','editor','admin','owner')),
  created_at TEXT NOT NULL,
  password_updated_at TEXT NOT NULL
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE entitlements (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  monitoring_plan TEXT NOT NULL DEFAULT 'none',
  navigator_plan TEXT NOT NULL DEFAULT 'none',
  radar_linked INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  tenant_id TEXT,
  payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  outcome TEXT NOT NULL
);`,
  },
  {
    id: 2, name: 'published_changes_local_pipeline',
    sql: `
CREATE TABLE vendor_snapshots (
  vendor_id TEXT PRIMARY KEY,
  items_json TEXT NOT NULL,
  events_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE change_evidence (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  url TEXT NOT NULL,
  retrieved_at TEXT,
  content_hash TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE published_changes (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  category TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  implication TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  affected_models_json TEXT NOT NULL DEFAULT '[]',
  published_at TEXT,
  effective_at TEXT,
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_changes_vendor ON published_changes(vendor_id);`,
  },
  {
    id: 3, name: 'navigator_workflows_exposure',
    sql: `
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  business_owner TEXT NOT NULL DEFAULT '',
  criticality TEXT NOT NULL CHECK (criticality IN ('low','medium','high','critical')),
  vendor TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  integration_method TEXT NOT NULL DEFAULT 'unknown',
  monthly_usage REAL,
  usage_unit TEXT NOT NULL DEFAULT '',
  monthly_spend REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  spend_as_of TEXT,
  user_count INTEGER,
  data_sensitivity TEXT NOT NULL DEFAULT 'unknown',
  requirements_json TEXT NOT NULL DEFAULT '[]',
  fallback_type TEXT NOT NULL DEFAULT 'none',
  fallback_detail TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE TABLE workflow_dependencies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workflow_id TEXT NOT NULL,
  depends_on_workflow_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (tenant_id, workflow_id) REFERENCES workflows(tenant_id, id),
  FOREIGN KEY (tenant_id, depends_on_workflow_id) REFERENCES workflows(tenant_id, id),
  CHECK (workflow_id <> depends_on_workflow_id),
  UNIQUE (tenant_id, workflow_id, depends_on_workflow_id)
);
CREATE TABLE exposure_matches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  change_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,
  rule TEXT NOT NULL,
  explanation TEXT NOT NULL,
  via_workflow_id TEXT,
  review_state TEXT NOT NULL DEFAULT 'unreviewed',
  reviewed_by TEXT,
  reviewed_at TEXT,
  computed_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id, workflow_id) REFERENCES workflows(tenant_id, id),
  UNIQUE (tenant_id, change_id, workflow_id)
);`,
  },
  {
    id: 4, name: 'navigator_decisions_plans_outcomes',
    sql: `
CREATE TABLE decision_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workflow_id TEXT NOT NULL,
  change_id TEXT,
  title TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id, workflow_id) REFERENCES workflows(tenant_id, id),
  UNIQUE (tenant_id, id)
);
CREATE TABLE scenario_revisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  decision_id TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  math_version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  change_note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id, decision_id) REFERENCES decision_records(tenant_id, id),
  UNIQUE (decision_id, revision_no),
  UNIQUE (tenant_id, id)
);
CREATE TRIGGER scenario_revisions_no_update BEFORE UPDATE ON scenario_revisions
BEGIN SELECT RAISE(ABORT, 'scenario revisions are immutable'); END;
CREATE TRIGGER scenario_revisions_no_delete BEFORE DELETE ON scenario_revisions
BEGIN SELECT RAISE(ABORT, 'scenario revisions are immutable'); END;
CREATE TABLE action_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  decision_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  chosen_option_id TEXT NOT NULL,
  title TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  success_criteria_json TEXT NOT NULL DEFAULT '[]',
  checklist_json TEXT NOT NULL DEFAULT '[]',
  test_steps_json TEXT NOT NULL DEFAULT '[]',
  fallback_trigger TEXT NOT NULL DEFAULT '',
  rollback_instructions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  links_json TEXT NOT NULL DEFAULT '[]',
  timeline_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id, decision_id) REFERENCES decision_records(tenant_id, id),
  FOREIGN KEY (tenant_id, revision_id) REFERENCES scenario_revisions(tenant_id, id),
  UNIQUE (tenant_id, id)
);
CREATE TABLE plan_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  plan_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  plan_hash TEXT NOT NULL,
  FOREIGN KEY (tenant_id, plan_id) REFERENCES action_plans(tenant_id, id)
);
CREATE TABLE outcomes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  plan_id TEXT NOT NULL,
  spend_before REAL,
  spend_after REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  measurement_period TEXT NOT NULL DEFAULT 'monthly',
  scope TEXT NOT NULL DEFAULT 'workflow',
  migration_hours REAL,
  downtime_minutes REAL,
  criteria_results_json TEXT NOT NULL DEFAULT '[]',
  unexpected TEXT NOT NULL DEFAULT '',
  lessons TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id, plan_id) REFERENCES action_plans(tenant_id, id),
  UNIQUE (tenant_id, plan_id)
);
CREATE TABLE rehearsals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  params_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  is_simulation INTEGER NOT NULL DEFAULT 1 CHECK (is_simulation = 1),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);`,
  },
];
