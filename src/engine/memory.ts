/**
 * Cognitive Memory Architecture
 * Priority 2: 4-Layer Memory System (Working, Episodic, Semantic, Procedural)
 * Manages memory lifecycle, auto-expiry, semantic derivation, and procedural routing.
 */

import {
  HRMWorldState,
  MemoryState,
  MemoryNode,
  ConsequenceEvaluation,
  PerceptualObservation
} from '../types/hrm';

export class CognitiveMemoryEngine {
  /**
   * Consolidates memory state at step completion
   */
  public consolidateMemory(
    state: HRMWorldState,
    observation?: PerceptualObservation,
    consequence?: ConsequenceEvaluation,
    userPrompt?: string
  ): MemoryState {
    const memory = state.memory;
    const currentStep = state.metadata.step;

    // 1. Working Memory auto-expiration & update
    if (!memory.workingMemory) {
      memory.workingMemory = {
        activeObservations: [],
        activeHypotheses: state.cognition.activeHypotheses || [],
        attentionFocusNodeId: state.cognition.attentionFocusNodeId,
        unresolvedConflicts: [],
        temporaryPlans: [],
      };
    }

    if (observation) {
      const obsSummary = `Step ${currentStep}: ${Object.keys(observation.sensedNodes).length} nodes sensed`;
      memory.workingMemory.activeObservations.unshift(obsSummary);
      if (memory.workingMemory.activeObservations.length > 5) {
        memory.workingMemory.activeObservations.pop();
      }
    }

    if (userPrompt) {
      memory.workingMemory.temporaryPlans.unshift(`User Directive: ${userPrompt}`);
      if (memory.workingMemory.temporaryPlans.length > 3) {
        memory.workingMemory.temporaryPlans.pop();
      }
    }

    // Auto-expire working memory nodes in state.memory.nodes
    for (const memId in memory.nodes) {
      const node = memory.nodes[memId];
      if (node.type === 'working' && node.expiresAtStep && currentStep >= node.expiresAtStep) {
        delete memory.nodes[memId];
      }
    }

    // 2. Episodic Memory Recording: Record significant state transition
    if (consequence && (consequence.predictionError > 0.15 || Math.abs(consequence.goalProgressDelta) > 0.05 || userPrompt)) {
      const epId = `mem_ep_${currentStep}_${Math.floor(Math.random() * 1000)}`;
      const isSuccess = consequence.goalProgressDelta > 0;
      memory.nodes[epId] = {
        id: epId,
        type: 'episodic',
        content: `Step ${currentStep} transition: ${isSuccess ? 'Goal progress achieved' : 'Stress/error spike'} (Error: ${consequence.predictionError.toFixed(3)})`,
        vector: [
          state.stress.globalStress,
          state.uncertainty.globalEntropy,
          consequence.goalProgressDelta,
        ],
        salience: Math.min(1.0, 0.5 + consequence.predictionError * 2),
        lastAccessedStep: currentStep,
        associatedNodeIds: state.cognition.attentionFocusNodeId ? [state.cognition.attentionFocusNodeId] : ['node_0'],
      };
    }

    // 3. Semantic Memory Derivation: Consolidate episodic memory into abstractions
    const episodicNodes = Object.values(memory.nodes).filter(n => n.type === 'episodic');
    if (episodicNodes.length >= 4) {
      const semId = `mem_sem_concept_${currentStep}`;
      if (!memory.nodes[semId]) {
        memory.nodes[semId] = {
          id: semId,
          type: 'semantic',
          content: `Abstract Concept Step ${currentStep}: Stable topology correlates with global stress < ${(state.stress.globalStress * 1.2).toFixed(2)}`,
          vector: [0.5, state.stress.globalStress, state.uncertainty.globalEntropy],
          salience: 0.85,
          lastAccessedStep: currentStep,
          associatedNodeIds: Object.keys(state.topology.nodes).slice(0, 3),
        };
      }
    }

    // 4. Procedural Memory: Record effective execution strategies
    if (consequence && consequence.causalConfidence > 0.8) {
      const procId = `mem_proc_${currentStep}`;
      if (!memory.nodes[procId]) {
        memory.nodes[procId] = {
          id: procId,
          type: 'procedural',
          content: `Effective Strategy: Attractor focus on ${state.cognition.attentionFocusNodeId || 'node_0'} yielded high causal confidence (${consequence.causalConfidence.toFixed(2)})`,
          vector: [0.9, 0.3, 0.7],
          salience: 0.9,
          lastAccessedStep: currentStep,
          associatedNodeIds: state.cognition.attentionFocusNodeId ? [state.cognition.attentionFocusNodeId] : ['node_0'],
          usefulnessScore: consequence.causalConfidence,
        };
      }
    }

    // Calculate total memory mass and trim if exceeding capacity
    const nodeCount = Object.keys(memory.nodes).length;
    memory.totalMass = nodeCount * 0.8;

    if (nodeCount > memory.capacity) {
      // Remove lowest salience non-procedural memory
      const sorted = Object.values(memory.nodes).sort((a, b) => a.salience - b.salience);
      const toRemove = sorted.find(n => n.type !== 'procedural');
      if (toRemove) {
        delete memory.nodes[toRemove.id];
      }
    }

    return memory;
  }
}
