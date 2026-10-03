export interface Vendor {
  id: string;
  name: string;
  description: string;
  category: string;
  official_domain: string;
  documentation_url: string;
  pricing_url: string;
  status_url?: string;
  policy_url?: string;
  last_checked_at?: number | null;
}

export interface Source {
  id: string;
  vendor_id: string;
  vendor_name?: string;
  name: string;
  source_type: string;
  url: string;
  parser_type: string;
  is_fixture: number;
  last_fetched_at?: number | null;
  last_status?: string | null;
  last_content_hash?: string | null;
  failure_count: number;
  snapshot_count?: number;
  has_baseline?: number;
}

export interface ClaimWithEvidence {
  claim: string;
  sourceQuote: string;
  sourceUrl: string;
}

export interface BriefItem {
  id: string;
  job_id: string;
  tenant_id: string;
  change_event_id: string;
  vendor_id: string;
  vendor_name?: string;
  change_summary: string;
  category: string;
  applicability_level: 'direct' | 'conditional' | 'informational';
  applicability_rationale: string;
  business_implication: string;
  suggested_action: string;
  action_category: 'action_required' | 'review_recommended' | 'no_action_needed';
  deadline?: string | null;
  estimated_cost_delta?: string | null;
  claimsWithEvidence: ClaimWithEvidence[];
  assumptions_missing_context?: string | null;
  status: string;
  created_at: number;
}

export interface WeeklyBrief {
  id: string;
  tenant_id: string;
  issue_number: number;
  week_start_date: string;
  week_end_date: string;
  status: 'draft' | 'ready' | 'published' | 'delivered';
  published_at?: number | null;
  generated_at: number;
  summary_text: string;
  sourceCoverageStats: {
    checked: number;
    failed: number;
    hasIncompleteCoverage: boolean;
    sources?: Array<{ name: string; status: string; failureCount: number }>;
  };
  acceptedItemIds: string[];
}

export interface TenantContext {
  id: string;
  email: string;
  companyName: string;
  company_name?: string;
  industry: string;
  plan: 'starter' | 'pro' | 'enterprise';
  vendorLimit: number;
  vendor_limit?: number;
}

export interface AnalysisParameters {
  activeSeats?: number;
  monthlyTokenVolumeMillions?: number;
  primaryUseCases?: string[];
  deploymentType?: 'direct_api' | 'cloud_hyperscalers' | 'enterprise_apps' | 'hybrid';
  confidentialDataHandlingRequired?: boolean;
  baaRequired?: boolean;
  soc2Required?: boolean;
  gdprEuAiActRequired?: boolean;
  criticalityLevel?: 'mission_critical' | 'business_important' | 'internal_experimentation';
  costThresholdAlertDollars?: number;
  specialInstructions?: string;
  primaryRegions?: string[];
}

export interface TenantPreferences {
  selectedVendors: string[];
  deliveryEmail: string;
  deliveryFrequency: string;
  deliveryDay: string;
  notifyThreshold: string;
  usageContext: AnalysisParameters;
}

export interface ReviewProposal extends BriefItem {
  company_name: string;
  industry: string;
  final_url: string;
  source_text: string;
  evidence_supported_score?: number;
  supports_factual_claims?: number;
  dates_and_products_match?: number;
  applicability_valid?: number;
  critique_decision?: string;
  critique_notes?: string;
}

export interface OutboundEmail {
  id: string;
  tenant_id: string;
  company_name?: string;
  idempotency_key: string;
  recipient: string;
  subject: string;
  html_body: string;
  text_body: string;
  status: string;
  provider: string;
  sent_at: number;
}
