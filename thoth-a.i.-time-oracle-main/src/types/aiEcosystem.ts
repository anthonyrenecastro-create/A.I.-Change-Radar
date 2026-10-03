/**
 * AI Ecosystem Digital Twin Types
 * Stage 1 domain model for a multi-actor, multi-mechanism forecasting substrate.
 */

export type TwinId = string;

export type TwinKind =
  | 'ai_system'
  | 'infrastructure'
  | 'organization'
  | 'data_ecosystem'
  | 'policy_environment'
  | 'human_response'
  | 'risk_twin';

export type CapabilityDimension =
  | 'language_understanding'
  | 'mathematical_reasoning'
  | 'software_development'
  | 'scientific_discovery'
  | 'long_term_planning'
  | 'memory'
  | 'multimodal_perception'
  | 'robotics_control'
  | 'social_reasoning'
  | 'self_correction'
  | 'autonomous_tool_use'
  | 'agent_coordination'
  | 'model_to_model_communication'
  | 'continuous_learning'
  | 'recursive_improvement';

export interface CapabilityProfile {
  level: number; // [0, 1]
  growthRatePerCycle: number;
  reliability: number; // [0, 1]
  economicViability: number; // [0, 1]
}

export interface AISystemTwin {
  id: TwinId;
  label: string;
  modelFamily: string;
  architecture: string;
  parameterScaleB: number;
  contextCapacityTokens: number;
  trainingMethod: string;
  inferenceCostPer1kTokensUsd: number;
  reasoningPerformance: number; // [0, 1]
  toolUseAbility: number; // [0, 1]
  memoryArchitecture: string;
  autonomyLevel: number; // [0, 1]
  safetyControls: number; // [0, 1]
  reliability: number; // [0, 1]
  hallucinationRate: number; // [0, 1]
  deploymentEnvironment: 'cloud' | 'edge' | 'hybrid';
  capabilityImprovementRate: number;
  capabilities: Record<CapabilityDimension, CapabilityProfile>;
}

export interface InfrastructureTwin {
  id: TwinId;
  label: string;
  gpuAvailabilityIndex: number; // [0, 1]
  semiconductorProductionIndex: number; // [0, 1]
  memoryBandwidthTbps: number;
  energyDemandMw: number;
  coolingCapacityMw: number;
  dataCenterExpansionRate: number;
  cloudAvailabilityIndex: number; // [0, 1]
  networkCapacityTbps: number;
  hardwareEfficiencyGainRate: number;
  edgeAdoptionIndex: number; // [0, 1]
  supplyChainConstraintIndex: number; // [0, 1], high means constrained
  manufacturingConcentrationRisk: number; // [0, 1]
}

export interface OrganizationTwin {
  id: TwinId;
  label: string;
  orgType: 'company' | 'research_lab' | 'open_source_community' | 'university' | 'government' | 'independent';
  capitalUsdBn: number;
  computeCapacityExaFLOPs: number;
  researchTalentIndex: number; // [0, 1]
  strategicGoal: string;
  modelAccessLevel: number; // [0, 1]
  proprietaryDataAdvantage: number; // [0, 1]
  safetyCulture: number; // [0, 1]
  publicationAggressiveness: number; // [0, 1]
  competitivePressure: number; // [0, 1]
  regulatoryExposure: number; // [0, 1]
  partnershipNetworkStrength: number; // [0, 1]
  releaseAggressiveness: number; // [0, 1]
}

export interface DataEcosystemTwin {
  id: TwinId;
  label: string;
  dataAvailabilityIndex: number; // [0, 1]
  dataQualityIndex: number; // [0, 1]
  syntheticDataShare: number; // [0, 1]
  copyrightRestrictionIntensity: number; // [0, 1]
  privacyConstraintIntensity: number; // [0, 1]
  multilingualCoverage: number; // [0, 1]
  contaminationRisk: number; // [0, 1]
  feedbackLoopPressure: number; // [0, 1]
  modelContentSaturation: number; // [0, 1]
  humanContentRefreshRate: number; // [0, 1]
}

export interface PolicyTwin {
  id: TwinId;
  label: string;
  computeThresholdStrictness: number; // [0, 1]
  licensingStrictness: number; // [0, 1]
  releaseRestrictionIntensity: number; // [0, 1]
  dataRegulationIntensity: number; // [0, 1]
  safetyEvalMandateStrength: number; // [0, 1]
  transparencyRequirementStrength: number; // [0, 1]
  internationalCoordinationIndex: number; // [0, 1]
  liabilityPressure: number; // [0, 1]
  evasionPressure: number; // [0, 1]
}

export interface HumanInstitutionTwin {
  id: TwinId;
  label: string;
  adoptionRate: number; // [0, 1]
  publicTrust: number; // [0, 1]
  workforceDisplacementPressure: number; // [0, 1]
  retrainingCapacity: number; // [0, 1]
  politicalPolarization: number; // [0, 1]
  investmentMomentum: number; // [0, 1]
  automationResistance: number; // [0, 1]
  institutionalAdaptationRate: number; // [0, 1]
  internationalCompetitionIntensity: number; // [0, 1]
}

export interface RiskTwin {
  id: TwinId;
  label: string;
  riskType:
    | 'hallucination'
    | 'goal_misgeneralization'
    | 'reward_hacking'
    | 'tool_misuse'
    | 'automation_cascade'
    | 'data_poisoning'
    | 'model_collapse'
    | 'adversarial_attack'
    | 'coordination_failure'
    | 'power_concentration'
    | 'oversight_loss';
  severity: number; // [0, 1]
  likelihood: number; // [0, 1]
  detectability: number; // [0, 1]
  mitigationReadiness: number; // [0, 1]
}

export interface MechanismChange {
  twinKind: TwinKind;
  twinId: TwinId;
  variable: string;
  delta: number;
  probability: number; // [0, 1]
  confidence: number; // [0, 1]
  causalAssumptions: string[];
  uncertainty: number; // [0, 1]
  supportingEvidence: string[];
  failureConditions: string[];
}

export interface MechanismForecastContribution {
  mechanismId: string;
  mechanismType:
    | 'capability'
    | 'economic'
    | 'hardware'
    | 'regulatory'
    | 'geopolitical'
    | 'safety'
    | 'adoption'
    | 'adversarial'
    | 'infrastructure'
    | 'scientific_progress';
  summary: string;
  changes: MechanismChange[];
  confidence: number; // [0, 1]
  disagreement: number; // [0, 1]
}

export interface AIEcosystemIndicators {
  capabilityFrontierIndex: number; // [0, 1]
  safetyReadinessIndex: number; // [0, 1]
  infrastructureStressIndex: number; // [0, 1]
  governanceCoordinationIndex: number; // [0, 1]
  ecosystemVolatilityIndex: number; // [0, 1]
}

export interface AIEcosystemState {
  initializedAtStep: number;
  aiSystems: Record<TwinId, AISystemTwin>;
  infrastructure: Record<TwinId, InfrastructureTwin>;
  organizations: Record<TwinId, OrganizationTwin>;
  dataEcosystems: Record<TwinId, DataEcosystemTwin>;
  policies: Record<TwinId, PolicyTwin>;
  humanResponses: Record<TwinId, HumanInstitutionTwin>;
  risks: Record<TwinId, RiskTwin>;
  indicators: AIEcosystemIndicators;
  recentContributions: MechanismForecastContribution[];
  scenarioWeights: Record<string, number>;
}
