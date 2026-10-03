/**
 * AI Ecosystem Predictive Mechanisms
 * These mechanisms emit typed AI-ecosystem forecast payloads while still using
 * the standard HRM contribution/arbitration contract.
 */

import { Contribution, HRMWorldState } from '../types/hrm';
import { Mechanism } from './mechanisms';
import { MechanismChange, AIEcosystemState } from '../types/aiEcosystem';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function neutralContribution(id: string, name: string, rationale: string): Contribution {
  return {
    mechanismId: id,
    mechanismName: name,
    confidence: 0.2,
    activationStrength: 0.1,
    estimatedCost: 1,
    uncertainty: 0.8,
    rationale,
    diagnostics: {},
  };
}

function makeGlobalFieldDelta(state: Readonly<HRMWorldState>, scale: number): Record<string, number> {
  const deltas: Record<string, number> = {};
  const nodeIds = Object.keys(state.topology.nodes);
  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i];
    // Small spatially varying term to avoid uniform collapse.
    deltas[nodeId] = scale * (Math.sin(i * 0.7) * 0.5 + 0.5);
  }
  return deltas;
}

function fromIndicators(state: Readonly<HRMWorldState>): AIEcosystemState | null {
  return state.aiEcosystem ?? null;
}

export class AICapabilityForecastMechanism implements Mechanism {
  id = 'mech_ai_capability_forecast';
  name = 'AI Capability Forecasting';
  description = 'Projects capability frontier growth, threshold crossings, and dependency bottlenecks.';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const eco = fromIndicators(state);
    if (!eco) return neutralContribution(this.id, this.name, 'AI ecosystem twins unavailable in current scenario');

    const frontier = eco.indicators.capabilityFrontierIndex;
    const stress = eco.indicators.infrastructureStressIndex;

    const delta = (0.018 - stress * 0.01);
    const changes: MechanismChange[] = [
      {
        twinKind: 'ai_system',
        twinId: 'model_frontier_a',
        variable: 'reasoningPerformance',
        delta,
        probability: 0.72,
        confidence: 0.71,
        causalAssumptions: ['compute availability remains above 0.55', 'no major benchmark regression'],
        uncertainty: 0.23,
        supportingEvidence: ['recent trend in model capability improvement rates'],
        failureConditions: ['hardware supply shock', 'data quality collapse'],
      },
      {
        twinKind: 'ai_system',
        twinId: 'model_open_b',
        variable: 'toolUseAbility',
        delta: delta * 0.8,
        probability: 0.68,
        confidence: 0.64,
        causalAssumptions: ['open-source tool-use frameworks continue improving'],
        uncertainty: 0.3,
        supportingEvidence: ['agent framework ecosystem growth'],
        failureConditions: ['policy constraints on release pipelines'],
      },
    ];

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: clamp01(0.65 + frontier * 0.25),
      activationStrength: clamp01(0.45 + (1 - stress) * 0.35),
      estimatedCost: 14,
      uncertainty: 0.25,
      rationale: 'Forecasting capability progression with infrastructure-adjusted trend correction',
      fieldDeltas: makeGlobalFieldDelta(state, 0.008),
      diagnostics: {
        aiEcosystem: {
          mechanismType: 'capability',
          summary: 'Capability frontier continues gradual rise, constrained by infrastructure stress.',
          changes,
          disagreement: 0.26,
        },
      },
    };
  }
}

export class AIComputeInfrastructureMechanism implements Mechanism {
  id = 'mech_ai_compute_infrastructure';
  name = 'Compute and Infrastructure Forecasting';
  description = 'Forecasts hardware supply, energy/cooling stress, and compute accessibility.';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const eco = fromIndicators(state);
    if (!eco) return neutralContribution(this.id, this.name, 'AI ecosystem twins unavailable in current scenario');

    const infra = eco.infrastructure.compute_backbone;
    const demandPressure = infra ? infra.energyDemandMw / Math.max(1, infra.coolingCapacityMw) : 0.6;

    const changes: MechanismChange[] = [
      {
        twinKind: 'infrastructure',
        twinId: 'compute_backbone',
        variable: 'supplyChainConstraintIndex',
        delta: 0.008,
        probability: 0.58,
        confidence: 0.61,
        causalAssumptions: ['semiconductor lead times remain elevated'],
        uncertainty: 0.32,
        supportingEvidence: ['historical chip-cycle variability'],
        failureConditions: ['unexpected foundry capacity expansion'],
      },
      {
        twinKind: 'infrastructure',
        twinId: 'compute_backbone',
        variable: 'cloudAvailabilityIndex',
        delta: 0.01,
        probability: 0.69,
        confidence: 0.66,
        causalAssumptions: ['continued data-center buildout'],
        uncertainty: 0.24,
        supportingEvidence: ['reported cloud capex trajectories'],
        failureConditions: ['grid constraints', 'cooling water limits'],
      },
    ];

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.7,
      activationStrength: clamp01(0.4 + demandPressure * 0.5),
      estimatedCost: 11,
      uncertainty: 0.28,
      rationale: 'Evaluating energy, cooling, and supply-chain constraints on compute growth',
      fieldDeltas: makeGlobalFieldDelta(state, -0.006),
      diagnostics: {
        aiEcosystem: {
          mechanismType: 'infrastructure',
          summary: 'Compute scale-up continues, but stress accumulation remains non-trivial.',
          changes,
          disagreement: 0.31,
        },
      },
    };
  }
}

export class AIOrganizationDynamicsMechanism implements Mechanism {
  id = 'mech_ai_org_dynamics';
  name = 'Organization and Competition Dynamics';
  description = 'Models lab/company strategy adaptation under incentives and constraints.';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const eco = fromIndicators(state);
    if (!eco) return neutralContribution(this.id, this.name, 'AI ecosystem twins unavailable in current scenario');

    const volatility = eco.indicators.ecosystemVolatilityIndex;

    const changes: MechanismChange[] = [
      {
        twinKind: 'organization',
        twinId: 'org_frontier_lab',
        variable: 'competitivePressure',
        delta: 0.012,
        probability: 0.74,
        confidence: 0.69,
        causalAssumptions: ['open and closed model competition intensifies'],
        uncertainty: 0.27,
        supportingEvidence: ['release cadence acceleration'],
        failureConditions: ['market consolidation reducing rivalry'],
      },
      {
        twinKind: 'organization',
        twinId: 'org_open_foundation',
        variable: 'researchTalentIndex',
        delta: 0.01,
        probability: 0.62,
        confidence: 0.6,
        causalAssumptions: ['open collaboration continues attracting talent'],
        uncertainty: 0.33,
        supportingEvidence: ['community contribution trend'],
        failureConditions: ['funding shortfalls'],
      },
    ];

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.67,
      activationStrength: clamp01(0.35 + volatility * 0.45),
      estimatedCost: 10,
      uncertainty: 0.3,
      rationale: 'Projecting strategic adaptation under multi-actor competition',
      fieldDeltas: makeGlobalFieldDelta(state, 0.004),
      diagnostics: {
        aiEcosystem: {
          mechanismType: 'economic',
          summary: 'Competition pressure increases and open ecosystems gain selective momentum.',
          changes,
          disagreement: 0.34,
        },
      },
    };
  }
}

export class AIDataEcosystemMechanism implements Mechanism {
  id = 'mech_ai_data_ecosystem';
  name = 'Data Ecosystem and Recursion Pressure';
  description = 'Tracks data quality, synthetic recursion, and training-corpus constraints.';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const eco = fromIndicators(state);
    if (!eco) return neutralContribution(this.id, this.name, 'AI ecosystem twins unavailable in current scenario');

    const dataTwin = eco.dataEcosystems.global_training_corpus;

    const changes: MechanismChange[] = [
      {
        twinKind: 'data_ecosystem',
        twinId: 'global_training_corpus',
        variable: 'syntheticDataShare',
        delta: 0.012,
        probability: 0.76,
        confidence: 0.74,
        causalAssumptions: ['cost pressure pushes synthetic data use upward'],
        uncertainty: 0.22,
        supportingEvidence: ['growth in synthetic data pipelines'],
        failureConditions: ['new high-quality licensed corpus supply'],
      },
      {
        twinKind: 'data_ecosystem',
        twinId: 'global_training_corpus',
        variable: 'dataQualityIndex',
        delta: -0.009 * dataTwin.modelContentSaturation,
        probability: 0.64,
        confidence: 0.63,
        causalAssumptions: ['recursion pressure degrades marginal quality without filtering'],
        uncertainty: 0.29,
        supportingEvidence: ['content saturation trajectory'],
        failureConditions: ['strong dedup/filtering breakthroughs'],
      },
    ];

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.73,
      activationStrength: 0.66,
      estimatedCost: 9,
      uncertainty: 0.27,
      rationale: 'Estimating synthetic recursion and quality constraints in training data ecosystems',
      fieldDeltas: makeGlobalFieldDelta(state, -0.003),
      diagnostics: {
        aiEcosystem: {
          mechanismType: 'scientific_progress',
          summary: 'Synthetic-share growth likely outpaces quality-preservation controls.',
          changes,
          disagreement: 0.29,
        },
      },
    };
  }
}

export class AIGovernancePolicyMechanism implements Mechanism {
  id = 'mech_ai_governance_policy';
  name = 'Governance and Policy Simulation';
  description = 'Simulates policy intensity changes and ecosystem adaptation/evasion effects.';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const eco = fromIndicators(state);
    if (!eco) return neutralContribution(this.id, this.name, 'AI ecosystem twins unavailable in current scenario');

    const policy = eco.policies.policy_global_baseline;

    const changes: MechanismChange[] = [
      {
        twinKind: 'policy_environment',
        twinId: 'policy_global_baseline',
        variable: 'safetyEvalMandateStrength',
        delta: 0.01,
        probability: 0.59,
        confidence: 0.62,
        causalAssumptions: ['high-visibility incidents increase regulatory appetite'],
        uncertainty: 0.31,
        supportingEvidence: ['draft policy trend'],
        failureConditions: ['political fragmentation'],
      },
      {
        twinKind: 'policy_environment',
        twinId: 'policy_global_baseline',
        variable: 'evasionPressure',
        delta: 0.006 * policy.releaseRestrictionIntensity,
        probability: 0.54,
        confidence: 0.55,
        causalAssumptions: ['stronger release restrictions increase circumvention incentives'],
        uncertainty: 0.36,
        supportingEvidence: ['historical compliance/evasion dynamics'],
        failureConditions: ['high international coordination'],
      },
    ];

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.64,
      activationStrength: 0.57,
      estimatedCost: 12,
      uncertainty: 0.33,
      rationale: 'Evaluating policy impact vs adaptive behavior and compliance friction',
      fieldDeltas: makeGlobalFieldDelta(state, 0.002),
      diagnostics: {
        aiEcosystem: {
          mechanismType: 'regulatory',
          summary: 'Safety mandates rise gradually, with moderate evasion pressure side effects.',
          changes,
          disagreement: 0.37,
        },
      },
    };
  }
}

export class AISafetyRiskMechanism implements Mechanism {
  id = 'mech_ai_safety_risk';
  name = 'Safety and Failure-Mode Dynamics';
  description = 'Forecasts risk severity shifts based on capability, scale, and safeguards.';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const eco = fromIndicators(state);
    if (!eco) return neutralContribution(this.id, this.name, 'AI ecosystem twins unavailable in current scenario');

    const frontier = eco.indicators.capabilityFrontierIndex;
    const safety = eco.indicators.safetyReadinessIndex;

    const netRiskPressure = clamp01(frontier - safety + 0.2);
    const changes: MechanismChange[] = [
      {
        twinKind: 'risk_twin',
        twinId: 'risk_oversight_loss',
        variable: 'likelihood',
        delta: 0.012 * netRiskPressure,
        probability: 0.66,
        confidence: 0.68,
        causalAssumptions: ['autonomy rises faster than oversight tooling'],
        uncertainty: 0.29,
        supportingEvidence: ['agent reliability trend and deployment scale'],
        failureConditions: ['verification tools mature quickly'],
      },
      {
        twinKind: 'risk_twin',
        twinId: 'risk_hallucination',
        variable: 'severity',
        delta: -0.008 * safety,
        probability: 0.62,
        confidence: 0.65,
        causalAssumptions: ['safety investment and eval mandates reduce severe failures'],
        uncertainty: 0.28,
        supportingEvidence: ['safety-control trend'],
        failureConditions: ['distribution-shift-heavy deployments'],
      },
    ];

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.76,
      activationStrength: clamp01(0.4 + netRiskPressure * 0.5),
      estimatedCost: 13,
      uncertainty: 0.24,
      rationale: 'Balancing capability acceleration against safety-readiness gains',
      fieldDeltas: makeGlobalFieldDelta(state, -0.007),
      diagnostics: {
        aiEcosystem: {
          mechanismType: 'safety',
          summary: 'Risk profile shifts toward oversight challenges despite reliability improvements.',
          changes,
          disagreement: 0.28,
        },
      },
    };
  }
}

export class AIHumanInstitutionResponseMechanism implements Mechanism {
  id = 'mech_ai_human_response';
  name = 'Human and Institutional Response';
  description = 'Models adoption, trust, labor pressure, and institutional adaptation feedback.';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const eco = fromIndicators(state);
    if (!eco) return neutralContribution(this.id, this.name, 'AI ecosystem twins unavailable in current scenario');

    const response = eco.humanResponses.society_global;
    const safety = eco.indicators.safetyReadinessIndex;

    const changes: MechanismChange[] = [
      {
        twinKind: 'human_response',
        twinId: 'society_global',
        variable: 'adoptionRate',
        delta: 0.01,
        probability: 0.71,
        confidence: 0.7,
        causalAssumptions: ['continued enterprise integration and consumer tooling uptake'],
        uncertainty: 0.25,
        supportingEvidence: ['adoption growth baselines'],
        failureConditions: ['major trust shock event'],
      },
      {
        twinKind: 'human_response',
        twinId: 'society_global',
        variable: 'publicTrust',
        delta: (safety - response.workforceDisplacementPressure) * 0.008,
        probability: 0.57,
        confidence: 0.59,
        causalAssumptions: ['trust tied to visible reliability and labor outcomes'],
        uncertainty: 0.34,
        supportingEvidence: ['public sentiment sensitivity to incidents and jobs impact'],
        failureConditions: ['policy legitimacy crisis'],
      },
    ];

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.66,
      activationStrength: 0.62,
      estimatedCost: 9,
      uncertainty: 0.31,
      rationale: 'Projecting social adaptation under parallel productivity and displacement pressures',
      fieldDeltas: makeGlobalFieldDelta(state, 0.003),
      diagnostics: {
        aiEcosystem: {
          mechanismType: 'adoption',
          summary: 'Adoption rises, while trust remains sensitive to safety and labor dislocations.',
          changes,
          disagreement: 0.35,
        },
      },
    };
  }
}

export function getAIEcosystemMechanisms(): Mechanism[] {
  return [
    new AICapabilityForecastMechanism(),
    new AIComputeInfrastructureMechanism(),
    new AIOrganizationDynamicsMechanism(),
    new AIDataEcosystemMechanism(),
    new AIGovernancePolicyMechanism(),
    new AISafetyRiskMechanism(),
    new AIHumanInstitutionResponseMechanism(),
  ];
}
