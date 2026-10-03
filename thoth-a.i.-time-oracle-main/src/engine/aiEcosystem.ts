/**
 * AI Ecosystem Digital Twin Runtime Support
 * Stage 2/3: static twins + dynamic transition updates across forecast cycles.
 */

import { Contribution, HRMWorldState } from '../types/hrm';
import {
  AIEcosystemState,
  AISystemTwin,
  CapabilityDimension,
  InfrastructureTwin,
  MechanismChange,
  MechanismForecastContribution,
  OrganizationTwin,
  DataEcosystemTwin,
  PolicyTwin,
  HumanInstitutionTwin,
  RiskTwin,
  AIEcosystemIndicators,
} from '../types/aiEcosystem';

interface EcosystemDiagnosticsPayload {
  aiEcosystem?: {
    mechanismType: MechanismForecastContribution['mechanismType'];
    summary: string;
    changes: MechanismChange[];
    disagreement?: number;
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function makeCapability(level: number, growthRatePerCycle: number) {
  return {
    level,
    growthRatePerCycle,
    reliability: clamp01(0.55 + level * 0.35),
    economicViability: clamp01(0.45 + level * 0.45),
  };
}

function buildCapabilityProfile(base: number): Record<CapabilityDimension, ReturnType<typeof makeCapability>> {
  return {
    language_understanding: makeCapability(base + 0.10, 0.012),
    mathematical_reasoning: makeCapability(base - 0.05, 0.014),
    software_development: makeCapability(base + 0.05, 0.016),
    scientific_discovery: makeCapability(base - 0.08, 0.012),
    long_term_planning: makeCapability(base - 0.12, 0.011),
    memory: makeCapability(base - 0.04, 0.013),
    multimodal_perception: makeCapability(base - 0.03, 0.014),
    robotics_control: makeCapability(base - 0.18, 0.01),
    social_reasoning: makeCapability(base - 0.02, 0.012),
    self_correction: makeCapability(base - 0.10, 0.011),
    autonomous_tool_use: makeCapability(base - 0.07, 0.015),
    agent_coordination: makeCapability(base - 0.14, 0.012),
    model_to_model_communication: makeCapability(base - 0.16, 0.012),
    continuous_learning: makeCapability(base - 0.2, 0.009),
    recursive_improvement: makeCapability(base - 0.25, 0.008),
  };
}

function deriveIndicators(
  aiSystems: Record<string, AISystemTwin>,
  infrastructure: Record<string, InfrastructureTwin>,
  organizations: Record<string, OrganizationTwin>,
  policies: Record<string, PolicyTwin>,
  risks: Record<string, RiskTwin>
): AIEcosystemIndicators {
  const systems = Object.values(aiSystems);
  const infra = Object.values(infrastructure);
  const orgs = Object.values(organizations);
  const pol = Object.values(policies);
  const riskValues = Object.values(risks);

  const capabilityFrontierIndex = clamp01(
    systems.reduce((acc, s) => acc + s.reasoningPerformance + s.toolUseAbility + s.autonomyLevel, 0) / Math.max(1, systems.length * 3)
  );

  const safetyReadinessIndex = clamp01(
    systems.reduce((acc, s) => acc + s.safetyControls + s.reliability - s.hallucinationRate, 0) / Math.max(1, systems.length * 2)
  );

  const infrastructureStressIndex = clamp01(
    infra.reduce((acc, i) => acc + i.supplyChainConstraintIndex + i.manufacturingConcentrationRisk + (i.energyDemandMw / Math.max(1, i.coolingCapacityMw)) * 0.3, 0) /
      Math.max(1, infra.length * 2)
  );

  const governanceCoordinationIndex = clamp01(
    pol.reduce((acc, p) => acc + p.internationalCoordinationIndex + p.transparencyRequirementStrength - p.evasionPressure, 0) /
      Math.max(1, pol.length * 2)
  );

  const avgCompetition = orgs.reduce((acc, o) => acc + o.competitivePressure, 0) / Math.max(1, orgs.length);
  const avgRisk = riskValues.reduce((acc, r) => acc + r.severity * r.likelihood, 0) / Math.max(1, riskValues.length);
  const ecosystemVolatilityIndex = clamp01((avgCompetition * 0.45) + (avgRisk * 0.55));

  return {
    capabilityFrontierIndex,
    safetyReadinessIndex,
    infrastructureStressIndex,
    governanceCoordinationIndex,
    ecosystemVolatilityIndex,
  };
}

export function createInitialAIEcosystemState(step = 0): AIEcosystemState {
  const aiSystems: Record<string, AISystemTwin> = {
    model_frontier_a: {
      id: 'model_frontier_a',
      label: 'Frontier Model A',
      modelFamily: 'general_multimodal',
      architecture: 'transformer_moe',
      parameterScaleB: 950,
      contextCapacityTokens: 512000,
      trainingMethod: 'self_supervised_plus_rl',
      inferenceCostPer1kTokensUsd: 0.009,
      reasoningPerformance: 0.72,
      toolUseAbility: 0.68,
      memoryArchitecture: 'hybrid_vector_symbolic',
      autonomyLevel: 0.42,
      safetyControls: 0.64,
      reliability: 0.71,
      hallucinationRate: 0.18,
      deploymentEnvironment: 'hybrid',
      capabilityImprovementRate: 0.015,
      capabilities: buildCapabilityProfile(0.58),
    },
    model_open_b: {
      id: 'model_open_b',
      label: 'Open Model B',
      modelFamily: 'open_weight',
      architecture: 'transformer_dense',
      parameterScaleB: 210,
      contextCapacityTokens: 256000,
      trainingMethod: 'instruction_tuned',
      inferenceCostPer1kTokensUsd: 0.003,
      reasoningPerformance: 0.56,
      toolUseAbility: 0.51,
      memoryArchitecture: 'retrieval_augmented',
      autonomyLevel: 0.31,
      safetyControls: 0.44,
      reliability: 0.58,
      hallucinationRate: 0.24,
      deploymentEnvironment: 'cloud',
      capabilityImprovementRate: 0.017,
      capabilities: buildCapabilityProfile(0.48),
    },
  };

  const infrastructure: Record<string, InfrastructureTwin> = {
    compute_backbone: {
      id: 'compute_backbone',
      label: 'Global Compute Backbone',
      gpuAvailabilityIndex: 0.61,
      semiconductorProductionIndex: 0.57,
      memoryBandwidthTbps: 42,
      energyDemandMw: 820,
      coolingCapacityMw: 1030,
      dataCenterExpansionRate: 0.12,
      cloudAvailabilityIndex: 0.75,
      networkCapacityTbps: 180,
      hardwareEfficiencyGainRate: 0.08,
      edgeAdoptionIndex: 0.27,
      supplyChainConstraintIndex: 0.46,
      manufacturingConcentrationRisk: 0.63,
    },
  };

  const organizations: Record<string, OrganizationTwin> = {
    org_frontier_lab: {
      id: 'org_frontier_lab',
      label: 'Frontier Lab Consortium',
      orgType: 'research_lab',
      capitalUsdBn: 19,
      computeCapacityExaFLOPs: 6.2,
      researchTalentIndex: 0.81,
      strategicGoal: 'Capability expansion with enterprise deployment',
      modelAccessLevel: 0.9,
      proprietaryDataAdvantage: 0.78,
      safetyCulture: 0.62,
      publicationAggressiveness: 0.49,
      competitivePressure: 0.77,
      regulatoryExposure: 0.68,
      partnershipNetworkStrength: 0.71,
      releaseAggressiveness: 0.56,
    },
    org_open_foundation: {
      id: 'org_open_foundation',
      label: 'Open Model Foundation',
      orgType: 'open_source_community',
      capitalUsdBn: 1.2,
      computeCapacityExaFLOPs: 0.9,
      researchTalentIndex: 0.61,
      strategicGoal: 'Broad model access and ecosystem decentralization',
      modelAccessLevel: 0.95,
      proprietaryDataAdvantage: 0.23,
      safetyCulture: 0.49,
      publicationAggressiveness: 0.88,
      competitivePressure: 0.58,
      regulatoryExposure: 0.44,
      partnershipNetworkStrength: 0.53,
      releaseAggressiveness: 0.79,
    },
  };

  const dataEcosystems: Record<string, DataEcosystemTwin> = {
    global_training_corpus: {
      id: 'global_training_corpus',
      label: 'Global Training Corpus',
      dataAvailabilityIndex: 0.66,
      dataQualityIndex: 0.61,
      syntheticDataShare: 0.34,
      copyrightRestrictionIntensity: 0.57,
      privacyConstraintIntensity: 0.62,
      multilingualCoverage: 0.52,
      contaminationRisk: 0.29,
      feedbackLoopPressure: 0.36,
      modelContentSaturation: 0.41,
      humanContentRefreshRate: 0.54,
    },
  };

  const policies: Record<string, PolicyTwin> = {
    policy_global_baseline: {
      id: 'policy_global_baseline',
      label: 'Global Baseline Policy Environment',
      computeThresholdStrictness: 0.42,
      licensingStrictness: 0.38,
      releaseRestrictionIntensity: 0.35,
      dataRegulationIntensity: 0.56,
      safetyEvalMandateStrength: 0.48,
      transparencyRequirementStrength: 0.46,
      internationalCoordinationIndex: 0.32,
      liabilityPressure: 0.41,
      evasionPressure: 0.39,
    },
  };

  const humanResponses: Record<string, HumanInstitutionTwin> = {
    society_global: {
      id: 'society_global',
      label: 'Global Human and Institutional Response',
      adoptionRate: 0.52,
      publicTrust: 0.47,
      workforceDisplacementPressure: 0.38,
      retrainingCapacity: 0.31,
      politicalPolarization: 0.55,
      investmentMomentum: 0.69,
      automationResistance: 0.35,
      institutionalAdaptationRate: 0.34,
      internationalCompetitionIntensity: 0.73,
    },
  };

  const risks: Record<string, RiskTwin> = {
    risk_hallucination: {
      id: 'risk_hallucination',
      label: 'Hallucination and Reliability Drift',
      riskType: 'hallucination',
      severity: 0.48,
      likelihood: 0.62,
      detectability: 0.67,
      mitigationReadiness: 0.58,
    },
    risk_coordination_failure: {
      id: 'risk_coordination_failure',
      label: 'Cross-Actor Coordination Failure',
      riskType: 'coordination_failure',
      severity: 0.57,
      likelihood: 0.49,
      detectability: 0.41,
      mitigationReadiness: 0.36,
    },
    risk_oversight_loss: {
      id: 'risk_oversight_loss',
      label: 'Human Oversight Degradation',
      riskType: 'oversight_loss',
      severity: 0.53,
      likelihood: 0.44,
      detectability: 0.39,
      mitigationReadiness: 0.33,
    },
  };

  return {
    initializedAtStep: step,
    aiSystems,
    infrastructure,
    organizations,
    dataEcosystems,
    policies,
    humanResponses,
    risks,
    indicators: deriveIndicators(aiSystems, infrastructure, organizations, policies, risks),
    recentContributions: [],
    scenarioWeights: {
      baseline_growth: 0.45,
      accelerated_open_source: 0.2,
      regulation_intensification: 0.18,
      infrastructure_bottleneck: 0.17,
    },
  };
}

function resolveTwinRecord(state: AIEcosystemState, twinKind: MechanismChange['twinKind']): Record<string, any> {
  if (twinKind === 'ai_system') return state.aiSystems;
  if (twinKind === 'infrastructure') return state.infrastructure;
  if (twinKind === 'organization') return state.organizations;
  if (twinKind === 'data_ecosystem') return state.dataEcosystems;
  if (twinKind === 'policy_environment') return state.policies;
  if (twinKind === 'human_response') return state.humanResponses;
  return state.risks;
}

function applyChange(state: AIEcosystemState, change: MechanismChange): void {
  const twins = resolveTwinRecord(state, change.twinKind);
  const twin = twins[change.twinId];
  if (!twin) return;

  const weightedDelta = change.delta * clamp01(change.probability) * clamp01(change.confidence);
  if (typeof twin[change.variable] === 'number') {
    const nextValue = twin[change.variable] + weightedDelta;
    twin[change.variable] = nextValue;
  }
}

export function applyAIEcosystemCycle(
  nextState: HRMWorldState,
  acceptedContributions: Contribution[]
): void {
  if (!nextState.aiEcosystem) return;

  const contributionUpdates: MechanismForecastContribution[] = [];

  for (const contribution of acceptedContributions) {
    const payload = contribution.diagnostics as EcosystemDiagnosticsPayload;
    if (!payload.aiEcosystem) continue;

    const forecast: MechanismForecastContribution = {
      mechanismId: contribution.mechanismId,
      mechanismType: payload.aiEcosystem.mechanismType,
      summary: payload.aiEcosystem.summary,
      changes: payload.aiEcosystem.changes,
      confidence: contribution.confidence,
      disagreement: clamp01(payload.aiEcosystem.disagreement ?? contribution.uncertainty),
    };

    for (const change of forecast.changes) {
      applyChange(nextState.aiEcosystem, change);
    }

    contributionUpdates.push(forecast);
  }

  // Continuous drift terms preserve temporal evolution even in low-signal cycles.
  for (const system of Object.values(nextState.aiEcosystem.aiSystems)) {
    system.reasoningPerformance = clamp01(system.reasoningPerformance + system.capabilityImprovementRate * 0.25);
    system.toolUseAbility = clamp01(system.toolUseAbility + system.capabilityImprovementRate * 0.2);
    system.autonomyLevel = clamp01(system.autonomyLevel + system.capabilityImprovementRate * 0.18);
    system.hallucinationRate = clamp01(system.hallucinationRate - system.safetyControls * 0.003 + 0.002);

    for (const capability of Object.values(system.capabilities)) {
      capability.level = clamp01(capability.level + capability.growthRatePerCycle * 0.2);
      capability.reliability = clamp01(capability.reliability + (system.safetyControls - 0.5) * 0.01);
      capability.economicViability = clamp01(capability.economicViability + (1 - system.inferenceCostPer1kTokensUsd) * 0.005);
    }
  }

  const computeBackbone = nextState.aiEcosystem.infrastructure.compute_backbone;
  if (computeBackbone) {
    computeBackbone.energyDemandMw = Math.max(0, computeBackbone.energyDemandMw + 2.0);
    computeBackbone.gpuAvailabilityIndex = clamp01(computeBackbone.gpuAvailabilityIndex + computeBackbone.hardwareEfficiencyGainRate * 0.02 - computeBackbone.supplyChainConstraintIndex * 0.01);
  }

  nextState.aiEcosystem.recentContributions = [
    ...contributionUpdates,
    ...nextState.aiEcosystem.recentContributions,
  ].slice(0, 40);

  nextState.aiEcosystem.indicators = deriveIndicators(
    nextState.aiEcosystem.aiSystems,
    nextState.aiEcosystem.infrastructure,
    nextState.aiEcosystem.organizations,
    nextState.aiEcosystem.policies,
    nextState.aiEcosystem.risks
  );
}
