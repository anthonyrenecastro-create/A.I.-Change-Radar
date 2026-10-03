/**
 * Rich Context State & Memory Retrieval
 * Priority 8: Replaces full-state serialization with focused contextual retrieval
 * dependent upon attention focus, topological proximity, semantic similarity, and goals.
 */

import { HRMWorldState, MemoryNode } from '../types/hrm';

export interface RetrievedLLMContext {
  activeGoal: string;
  focusNodeId: string;
  focusNodeNeighbors: string[];
  focusNodeFieldVal: number;
  globalStress: number;
  globalEntropy: number;
  workingMemoryObservations: string[];
  activeHypotheses: string[];
  retrievedMemories: Array<{ id: string; type: string; content: string; salience: number }>;
  proceduralGuidance: string[];
}

export function retrieveContextForLLM(
  state: Readonly<HRMWorldState>,
  userPrompt?: string
): RetrievedLLMContext {
  const focusNodeId = state.cognition.attentionFocusNodeId || Object.keys(state.topology.nodes)[0] || 'node_0';
  const focusNode = state.topology.nodes[focusNodeId];

  // Get topological neighbors
  const neighbors = state.topology.adjacency[focusNodeId] || [];
  const focusFieldVal = state.field.values[focusNodeId] ?? 0.5;

  // Retrieve top 3 most salient memories associated with focusNode or matching prompt
  const allMemories = Object.values(state.memory.nodes);
  const relevantMemories = allMemories
    .filter(mem => {
      if (mem.associatedNodeIds.includes(focusNodeId)) return true;
      if (userPrompt && mem.content.toLowerCase().includes(userPrompt.toLowerCase().slice(0, 5))) return true;
      return mem.salience > 0.7;
    })
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 4)
    .map(mem => ({
      id: mem.id,
      type: mem.type,
      content: mem.content,
      salience: mem.salience,
    }));

  // Retrieve procedural rules
  const proceduralGuidance = allMemories
    .filter(mem => mem.type === 'procedural')
    .map(mem => mem.content);

  const workingObs = state.memory.workingMemory?.activeObservations || [];
  const activeHyps = (state.cognition.activeHypotheses || []).map(h => `${h.description} (conf: ${h.confidence.toFixed(2)})`);

  return {
    activeGoal: state.guidance.activeGoal,
    focusNodeId,
    focusNodeNeighbors: neighbors,
    focusNodeFieldVal: focusFieldVal,
    globalStress: state.stress.globalStress,
    globalEntropy: state.uncertainty.globalEntropy,
    workingMemoryObservations: workingObs,
    activeHypotheses: activeHyps,
    retrievedMemories: relevantMemories,
    proceduralGuidance,
  };
}
