/** Typed domain model shared by the Navigator server, client, and tests. */

export type Criticality = 'low' | 'medium' | 'high' | 'critical';
export type DataSensitivity = 'unknown' | 'public' | 'internal' | 'confidential' | 'regulated';
export type IntegrationMethod = 'unknown' | 'api' | 'saas_app' | 'embedded' | 'no_code' | 'manual' | 'other';
export type FallbackType = 'none' | 'vendor' | 'manual';

export const CRITICALITIES: Criticality[] = ['low', 'medium', 'high', 'critical'];
export const SENSITIVITIES: DataSensitivity[] = ['unknown', 'public', 'internal', 'confidential', 'regulated'];
export const INTEGRATIONS: IntegrationMethod[] = ['unknown', 'api', 'saas_app', 'embedded', 'no_code', 'manual', 'other'];

export interface Requirement { id: string; text: string }

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  purpose: string;
  businessOwner: string;
  criticality: Criticality;
  vendor: string;
  model: string;
  integrationMethod: IntegrationMethod;
  monthlyUsage: number | null;
  usageUnit: string;
  monthlySpend: number | null;
  currency: string;
  spendAsOf: string | null;
  userCount: number | null;
  dataSensitivity: DataSensitivity;
  requirements: Requirement[];
  fallbackType: FallbackType;
  fallbackDetail: string;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDependency {
  id: string;
  workflowId: string;
  dependsOnWorkflowId: string;
  note: string;
}

/* ---------- Published changes (Radar side) ---------- */

export type ChangeKind = 'retirement' | 'price_increase' | 'price_decrease' | 'outage' | 'policy' | 'release' | 'other';

export interface PublishedChange {
  id: string;
  vendorId: string;
  vendorName: string;
  category: string;
  kind: ChangeKind;
  title: string;
  summary: string;
  implication: string;
  action: string;
  /** Models or products the published item explicitly names. Empty when the source is vendor-wide. */
  affectedModels: string[];
  publishedAt: string | null;
  effectiveAt: string | null;
  evidence: EvidenceLink[];
  isDemo: boolean;
}

export interface EvidenceLink { id: string; url: string; retrievedAt: string | null; label: string }

/* ---------- Exposure ---------- */

export type MatchStatus = 'confirmed' | 'possible' | 'insufficient_information';
export type ReviewState = 'unreviewed' | 'confirmed' | 'dismissed';

export interface ExposureMatch {
  id?: string;
  changeId: string;
  workflowId: string;
  status: MatchStatus;
  /** Machine-readable rule that produced the match. */
  rule: 'model_named' | 'model_mentioned' | 'vendor_wide' | 'downstream_dependency' | 'missing_vendor' | 'missing_model';
  explanation: string;
  /** Workflow whose exposure propagated here, for downstream matches. */
  viaWorkflowId?: string;
  reviewState: ReviewState;
}

/* ---------- Scenarios ---------- */

export type OptionKind = 'keep' | 'modify' | 'alternative' | 'fallback';
export type Case = 'low' | 'expected' | 'high';
export const CASES: Case[] = ['low', 'expected', 'high'];

export interface SourcedValue {
  /** null means unknown, which is never treated as zero. */
  value: number | null;
  source: 'user_entered' | 'evidence';
  /** ISO date the figure was entered or published. */
  asOf: string | null;
  evidenceUrl?: string;
}

export interface CaseVolumes {
  inputTokens: number | null;   // per month
  outputTokens: number | null;  // per month
  seats: number | null;
  otherUsageUnits: number | null;
}

export type RequirementFit = 'met' | 'unmet' | 'unknown';

export interface ScenarioOption {
  id: string;
  kind: OptionKind;
  label: string;
  vendor: string;
  model: string;
  /** Token-based pricing, input and output priced separately, USD (or scenario currency) per 1M tokens. */
  inputRatePerMTok: SourcedValue;
  outputRatePerMTok: SourcedValue;
  /** Seat pricing, kept separate from usage pricing. */
  pricePerSeatMonth: SourcedValue;
  /** Other recurring monthly cost entered by the customer (support plans, platform fees). */
  fixedMonthlyCost: SourcedValue;
  volumes: Record<Case, CaseVolumes>;
  migrationHours: number | null;
  hourlyRate: SourcedValue;
  otherOneTimeCosts: { id: string; label: string; amount: number | null }[];
  requirementFit: Record<string, RequirementFit>;
  tradeoffs: string;
  assumptions: string;
  evidenceNotes: string;
}

export interface ScenarioInput {
  currency: string;
  options: ScenarioOption[];
  /** Customer-entered baseline monthly recurring spend for the workflow today (from inventory). */
  baselineMonthlySpend: SourcedValue;
  horizonMonths: number;
  notes: string;
}

export interface Formula { label: string; expression: string; result: number | null; note?: string }

export interface CaseResult {
  usageCost: number | null;
  inputCost: number | null;
  outputCost: number | null;
  seatCost: number | null;
  fixedCost: number | null;
  monthlyRecurring: number | null;
  formulas: Formula[];
  missing: string[];
}

export interface OptionResult {
  optionId: string;
  cases: Record<Case, CaseResult>;
  oneTimeCost: number | null;
  oneTimeFormulas: Formula[];
  /** Expected monthly recurring minus customer baseline; negative = cheaper. */
  monthlyDeltaVsBaseline: Record<Case, number | null>;
  horizonTotal: Record<Case, number | null>;
  horizonFormula: string;
  unmetRequirements: string[];
  unknownRequirements: string[];
  missing: string[];
}

export interface ScenarioResult { options: OptionResult[]; computedWith: string; disclaimer: string }

/* ---------- Plans & outcomes ---------- */

export type PlanStatus = 'draft' | 'in_review' | 'approved' | 'in_progress' | 'done' | 'cancelled';

export interface ChecklistItem { id: string; text: string; done: boolean; ownerNote: string }
export interface Criterion { id: string; text: string }
export interface PlanLink { id: string; label: string; url: string }

export interface TimelineEntry { at: string; by: string; event: string }
