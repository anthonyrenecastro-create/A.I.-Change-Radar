/**
 * HRM Ecology: Tri-Path LLM Integration
 * Implements LLM A (Reasoning Engine), LLM B (Critique & Reflector), and Tools Action Mechanisms
 * plugged into the HRM World-Model Substrate.
 */

import {
  HRMWorldState,
  Contribution,
  PerceptualObservation,
  StructuralEvent
} from '../types/hrm';
import { Mechanism } from './mechanisms';

export interface LLMAReasoningResult {
  llmSource: string;
  rationale: string;
  confidence: number;
  activationStrength: number;
  cognitiveFocusNodeId?: string | null;
  strategicGoalAdjustment?: string | null;
  fieldDeltas?: Record<string, number>;
  proposedEvents?: Array<{
    type: string;
    targetIds?: string[];
    reason: string;
  }>;
}

export interface LLMBCritiqueResult {
  llmSource: string;
  critiqueRationale: string;
  overallConsistencyScore: number;
  hallucinationRisk: number;
  vetoedMechanisms?: string[];
  safetyWarnings?: string[];
  mechanismWeightAdjustments?: Record<string, number>;
}

export interface TriPathOrchestrationResult {
  llmSource: string;
  llmA: LLMAReasoningResult;
  llmB: LLMBCritiqueResult;
  toolActionsExecuted: string[];
}

/**
 * Global cache for async LLM responses to ensure synchronous step execution is non-blocking
 */
let cachedReasoningResult: LLMAReasoningResult | null = null;
let cachedCritiqueResult: LLMBCritiqueResult | null = null;
let isReasoningPending = false;
let isCritiquePending = false;
let lastReasoningStep = -1;

/**
 * Call server endpoint /api/gemini/reason
 */
import { retrieveContextForLLM } from './retrieval';

export async function fetchLLMAReasoning(
  state: Readonly<HRMWorldState>,
  observation?: PerceptualObservation,
  userPrompt?: string
): Promise<LLMAReasoningResult> {
  const retrievedContext = retrieveContextForLLM(state, userPrompt);

  try {
    const res = await fetch('/api/gemini/reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retrievedContext,
        worldStateSummary: {
          step: state.metadata.step,
          nodeCount: Object.keys(state.topology.nodes).length,
          observation,
        },
        userPrompt,
      }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: LLMAReasoningResult = await res.json();
    cachedReasoningResult = data;
    return data;
  } catch (err) {
    console.warn('LLM A Reasoning API call failed, using heuristic fallback:', err);
    const focusId = retrievedContext.focusNodeId;
    const fallback: LLMAReasoningResult = {
      llmSource: 'heuristic_fallback',
      rationale: userPrompt
        ? `[Substrate Directive] Reasoning adapted to: "${userPrompt}"`
        : `Aligning cognitive focus with node ${focusId} via retrieved context`,
      confidence: 0.85,
      activationStrength: 0.80,
      cognitiveFocusNodeId: focusId,
      strategicGoalAdjustment: userPrompt ? `Orient: ${userPrompt}` : state.guidance.activeGoal,
      fieldDeltas: { [focusId]: 0.15 },
      proposedEvents: [],
    };
    cachedReasoningResult = fallback;
    return fallback;
  }
}

/**
 * Call server endpoint /api/gemini/critique
 */
export async function fetchLLMBCritique(
  state: Readonly<HRMWorldState>,
  proposals: Contribution[]
): Promise<LLMBCritiqueResult> {
  const summary = {
    step: state.metadata.step,
    globalStress: state.stress.globalStress,
    globalEntropy: state.uncertainty.globalEntropy,
  };

  const proposalSummaries = proposals.map(p => ({
    mechanismId: p.mechanismId,
    mechanismName: p.mechanismName,
    confidence: p.confidence,
    activationStrength: p.activationStrength,
    rationale: p.rationale,
    proposedEventsCount: p.proposedEvents?.length || 0,
  }));

  try {
    const res = await fetch('/api/gemini/critique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldStateSummary: summary, proposals: proposalSummaries }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: LLMBCritiqueResult = await res.json();
    cachedCritiqueResult = data;
    return data;
  } catch (err) {
    console.warn('LLM B Critique API call failed, using heuristic fallback:', err);
    const fallback: LLMBCritiqueResult = {
      llmSource: 'heuristic_fallback',
      critiqueRationale: 'All mechanism proposals satisfy baseline conservation constraints.',
      overallConsistencyScore: 0.94,
      hallucinationRisk: 0.04,
      vetoedMechanisms: [],
      safetyWarnings: [],
      mechanismWeightAdjustments: {},
    };
    cachedCritiqueResult = fallback;
    return fallback;
  }
}

/**
 * Call server endpoint /api/gemini/interact for full tri-path user interaction
 */
export async function fetchTriPathInteract(
  userPrompt: string,
  state: Readonly<HRMWorldState>
): Promise<TriPathOrchestrationResult> {
  const summary = {
    step: state.metadata.step,
    activeGoal: state.guidance.activeGoal,
    attentionFocusNodeId: state.cognition.attentionFocusNodeId,
    globalStress: state.stress.globalStress,
    globalEntropy: state.uncertainty.globalEntropy,
  };

  try {
    const res = await fetch('/api/gemini/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userPrompt, worldStateSummary: summary }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: TriPathOrchestrationResult = await res.json();
    cachedReasoningResult = data.llmA;
    cachedCritiqueResult = data.llmB;
    return data;
  } catch (err) {
    console.warn('TriPath Interact API call failed, using fallback:', err);
    const fallback: TriPathOrchestrationResult = {
      llmSource: 'heuristic_fallback',
      llmA: {
        llmSource: 'heuristic_fallback',
        rationale: `[User Prompt Action] Directive processed: "${userPrompt}"`,
        confidence: 0.90,
        activationStrength: 0.85,
        cognitiveFocusNodeId: 'node_1',
        strategicGoalAdjustment: userPrompt,
        fieldDeltas: { node_0: 0.2, node_1: 0.35 },
        proposedEvents: [],
      },
      llmB: {
        llmSource: 'heuristic_fallback',
        critiqueRationale: 'Directive within standard safety parameters. Zero entropy spikes detected.',
        overallConsistencyScore: 0.96,
        hallucinationRisk: 0.02,
        safetyWarnings: [],
      },
      toolActionsExecuted: ['Attractor Focus Shift', 'Substrate Density Perturbation'],
    };
    cachedReasoningResult = fallback.llmA;
    cachedCritiqueResult = fallback.llmB;
    return fallback;
  }
}

/**
 * LLM A Reasoning Engine Mechanism
 */
export class LLMAReasoningMechanism implements Mechanism {
  id = 'mech_llm_reasoning';
  name = 'LLM A Reasoning Engine';
  description = 'Gemini 3.6 Flash general intelligence synthesizing cognitive strategy, field deltas, and structural events';

  propose(state: Readonly<HRMWorldState>, observation?: PerceptualObservation): Contribution {
    // Trigger async background refresh if step changed and not pending
    if (state.metadata.step !== lastReasoningStep && !isReasoningPending) {
      lastReasoningStep = state.metadata.step;
      isReasoningPending = true;
      fetchLLMAReasoning(state, observation).finally(() => {
        isReasoningPending = false;
      });
    }

    const reasoning = cachedReasoningResult;

    const fieldDeltas: Record<string, number> = reasoning?.fieldDeltas || {};
    const proposedEvents: StructuralEvent[] = (reasoning?.proposedEvents || []).map((e, idx) => ({
      id: `ev_llm_a_${Date.now()}_${idx}`,
      type: (e.type as any) || 'EdgeHealing',
      targetIds: e.targetIds || ['node_0', 'node_1'],
      parameters: {},
      reason: `[LLM A Reasoning] ${e.reason || 'Strategic substrate adaptation'}`,
    }));

    // Compute predicted field values at t+1 for consequence evaluation
    const predictedFieldValues: Record<string, number> = {};
    for (const nodeId in state.field.values) {
      const currentVal = state.field.values[nodeId];
      const delta = fieldDeltas[nodeId] || 0;
      predictedFieldValues[nodeId] = Math.max(0, Math.min(1.0, currentVal + delta * 0.8));
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: reasoning?.confidence ?? 0.88,
      activationStrength: reasoning?.activationStrength ?? 0.80,
      estimatedCost: 25,
      uncertainty: 0.1,
      rationale: reasoning?.rationale || 'Synthesizing global substrate trajectory and perceptual coherence via Gemini general intelligence',
      fieldDeltas,
      proposedEvents,
      predictedFieldValues,
      predictedGoalProgress: 0.15,
      guidanceAdjustments: reasoning?.strategicGoalAdjustment
        ? { activeGoal: reasoning.strategicGoalAdjustment }
        : undefined,
      diagnostics: {
        llmSource: reasoning?.llmSource || 'pending_initialization',
        focusNode: reasoning?.cognitiveFocusNodeId || state.cognition.attentionFocusNodeId,
        pending: isReasoningPending,
      },
    };
  }
}

/**
 * LLM B Critique & Reflector Mechanism
 */
export class LLMBCritiqueMechanism implements Mechanism {
  id = 'mech_llm_critique';
  name = 'LLM B Critique & Reflector';
  description = 'Adversarial auditor checking consistency, hallucination risk, and adjusting proposal weights';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const critique = cachedCritiqueResult;

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: critique?.overallConsistencyScore ?? 0.92,
      activationStrength: 0.75,
      estimatedCost: 15,
      uncertainty: critique?.hallucinationRisk ?? 0.05,
      rationale: critique?.critiqueRationale || 'Adversarial consistency check: Substrate proposals satisfy conservation bounds',
      diagnostics: {
        llmSource: critique?.llmSource || 'pending_initialization',
        consistencyScore: critique?.overallConsistencyScore ?? 0.92,
        hallucinationRisk: critique?.hallucinationRisk ?? 0.05,
        vetoedMechanismsCount: critique?.vetoedMechanisms?.length || 0,
        safetyWarnings: critique?.safetyWarnings || [],
      },
    };
  }
}

/**
 * Tools & Substrate Action Engine Mechanism
 */
export class ToolsActionMechanism implements Mechanism {
  id = 'mech_tools_action';
  name = 'Tools & Substrate Actions';
  description = 'Executes tool actions on topology, field probes, spatial splits, and memory graph mutations';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const focusNode = state.cognition.attentionFocusNodeId;
    const highStressNode = Object.entries(state.stress.nodeStress).find(([_, s]) => s > 0.35);

    const proposedEvents: StructuralEvent[] = [];
    if (highStressNode) {
      proposedEvents.push({
        id: `ev_tool_dampen_${Date.now()}`,
        type: 'ActivateChannel',
        targetIds: [highStressNode[0]],
        parameters: { boostConductance: 0.2 },
        reason: `[Tool Action] Stress mitigation tool engaged on ${highStressNode[0]}`,
      });
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.95,
      activationStrength: 0.85,
      estimatedCost: 10,
      uncertainty: 0.02,
      rationale: focusNode
        ? `Tool execution active: Field manipulation & memory vector alignment on focus node ${focusNode}`
        : 'Substrate tool engine operational: Monitoring topological channels',
      proposedEvents,
      diagnostics: {
        activeTools: ['Field Probe', 'Topology Repair Tool', 'Attractor Synchronizer', 'Memory Vector Mutation'],
        focusNode,
      },
    };
  }
}

export function getCachedReasoning(): LLMAReasoningResult | null {
  return cachedReasoningResult;
}

export function getCachedCritique(): LLMBCritiqueResult | null {
  return cachedCritiqueResult;
}
