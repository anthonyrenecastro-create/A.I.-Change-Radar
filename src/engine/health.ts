/**
 * Self-Monitoring Runtime Health Engine
 * Priority 9: Persistent RuntimeHealth channel tracking 10 core substrate metrics.
 */

import { HRMWorldState, RuntimeHealthState, ConsequenceEvaluation } from '../types/hrm';
import { ReputationManager } from './reputation';

export function computeRuntimeHealth(
  state: Readonly<HRMWorldState>,
  reputationManager: ReputationManager,
  consequence?: ConsequenceEvaluation
): RuntimeHealthState {
  // 1. Coherence: 1.0 minus global stress
  const coherence = Math.max(0, Math.min(1.0, 1.0 - state.stress.globalStress));

  // 2. Global Entropy: direct from uncertainty state
  const globalEntropy = Math.max(0, Math.min(1.0, state.uncertainty.globalEntropy));

  // 3. Prediction Accuracy: 1.0 - predictionError from consequence engine
  const predictionAccuracy = consequence
    ? Math.max(0, Math.min(1.0, 1.0 - consequence.predictionError))
    : 0.88;

  // 4. Memory Utilization
  const memCount = Object.keys(state.memory.nodes).length;
  const memoryUtilization = Math.min(1.0, memCount / Math.max(1, state.memory.capacity));

  // 5. Mechanism Diversity
  const allReps = Object.values(reputationManager.getAllReputations());
  const activeCount = allReps.filter(r => !r.isSuspended && !r.isRetired).length;
  const mechanismDiversity = Math.min(1.0, activeCount / Math.max(1, allReps.length));

  // 6. Topology Health: connected edges vs isolated nodes
  const nodes = Object.keys(state.topology.nodes);
  const connectedNodes = new Set<string>();
  for (const edgeId in state.topology.edges) {
    const edge = state.topology.edges[edgeId];
    if (edge.active) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }
  }
  const topologyHealth = nodes.length > 0 ? connectedNodes.size / nodes.length : 1.0;

  // 7. Resource Efficiency
  const resourceEfficiency = Math.max(0, Math.min(1.0, 1.0 - (state.resources.usedComputeEnergy / Math.max(1, state.resources.totalComputeBudget))));

  // 8. Reasoning Stability
  const avgTrust = allReps.reduce((acc, r) => acc + r.trustScore, 0) / Math.max(1, allReps.length);
  const reasoningStability = Math.max(0, Math.min(1.0, avgTrust));

  // 9. Learning Rate
  const learningRate = Math.max(0.1, Math.min(1.0, (memCount * 0.05) + (predictionAccuracy * 0.5)));

  // 10. Goal Convergence
  const goalConvergence = Math.max(0, Math.min(1.0, state.goals.progressRatio));

  return {
    coherence,
    globalEntropy,
    predictionAccuracy,
    memoryUtilization,
    mechanismDiversity,
    topologyHealth,
    resourceEfficiency,
    reasoningStability,
    learningRate,
    goalConvergence,
  };
}
