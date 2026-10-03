/**
 * HRM Ecology: State Management & Immutable Hashing
 */

import {
  HRMWorldState,
  NodeId,
  EdgeId,
  ManifoldId,
  RegionId
} from '../types/hrm';
import { createInitialAIEcosystemState } from './aiEcosystem';

/**
 * Computes a deterministic pseudo-hash string of the entire authoritative world state Xt
 */
export function computeStateHash(state: Omit<HRMWorldState, 'metadata'> & { metadata?: { step: number; seed: number } }): string {
  const aiIndicators = state.aiEcosystem?.indicators;
  const serialized = JSON.stringify({
    step: state.metadata?.step ?? 0,
    nodes: Object.keys(state.topology.nodes).sort(),
    edges: Object.keys(state.topology.edges).sort(),
    fieldSum: Object.values(state.field.values).reduce((a, b) => a + (isNaN(b) ? 0 : b), 0).toFixed(6),
    stressSum: Object.values(state.stress.nodeStress).reduce((a, b) => a + (isNaN(b) ? 0 : b), 0).toFixed(6),
    memoryCount: Object.keys(state.memory.nodes).length,
    activeGoal: state.guidance.activeGoal,
    aiCapabilityFrontier: aiIndicators?.capabilityFrontierIndex?.toFixed(6) ?? null,
    aiSafetyReadiness: aiIndicators?.safetyReadinessIndex?.toFixed(6) ?? null,
    aiInfraStress: aiIndicators?.infrastructureStressIndex?.toFixed(6) ?? null,
  });

  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return '0x' + (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Creates a deep frozen snapshot of the world state to guarantee immutability (Common Snapshot Principle)
 */
export function freezeState(state: HRMWorldState): Readonly<HRMWorldState> {
  return Object.freeze(JSON.parse(JSON.stringify(state)));
}

/**
 * Generates an initial authoritative world state X0
 */
export function createInitialWorldState(seed = 42, numNodes = 12, initializeAIEcosystem = false): HRMWorldState {
  const nodes: Record<NodeId, any> = {};
  const edges: Record<EdgeId, any> = {};
  const adjacency: Record<NodeId, NodeId[]> = {};
  const fieldValues: Record<NodeId, number> = {};
  const fieldGradients: Record<NodeId, { x: number; y: number }> = {};
  const fieldDensities: Record<NodeId, number> = {};
  const fieldVelocities: Record<NodeId, { x: number; y: number }> = {};
  const nodeStress: Record<NodeId, number> = {};
  const nodeUncertainties: Record<NodeId, number> = {};

  const gridCols = Math.ceil(Math.sqrt(numNodes));
  const spacing = 120;

  for (let i = 0; i < numNodes; i++) {
    const nodeId = `node_${i}`;
    const row = Math.floor(i / gridCols);
    const col = i % gridCols;
    const regionId: RegionId = row < 2 ? 'region_north' : 'region_south';
    const manifoldId: ManifoldId = i < numNodes / 2 ? 'manifold_primary' : 'manifold_secondary';

    nodes[nodeId] = {
      id: nodeId,
      position: {
        x: 100 + col * spacing + (Math.sin(i * 1.5) * 15),
        y: 100 + row * spacing + (Math.cos(i * 1.5) * 15),
      },
      regionId,
      manifoldId,
    };

    fieldValues[nodeId] = 0.2 + 0.6 * ((i * 37) % 100) / 100;
    fieldGradients[nodeId] = { x: (Math.sin(i) * 0.1), y: (Math.cos(i) * 0.1) };
    fieldDensities[nodeId] = 1.0;
    fieldVelocities[nodeId] = { x: 0, y: 0 };
    nodeStress[nodeId] = 0.05 + 0.1 * (i % 3) / 3;
    nodeUncertainties[nodeId] = 0.1;
    adjacency[nodeId] = [];
  }

  // Create lattice edges
  let edgeCounter = 0;
  const nodeKeys = Object.keys(nodes);
  for (let i = 0; i < nodeKeys.length; i++) {
    for (let j = i + 1; j < nodeKeys.length; j++) {
      const n1 = nodes[nodeKeys[i]];
      const n2 = nodes[nodeKeys[j]];
      const dist = Math.hypot(n1.position.x - n2.position.x, n1.position.y - n2.position.y);
      if (dist < spacing * 1.5) {
        const edgeId = `edge_${edgeCounter++}`;
        edges[edgeId] = {
          id: edgeId,
          source: n1.id,
          target: n2.id,
          weight: 1.0 - (dist / (spacing * 1.6)),
          conductance: 0.8,
          active: true,
        };
        adjacency[n1.id].push(n2.id);
        adjacency[n2.id].push(n1.id);
      }
    }
  }

  const initialStateWithoutHash = {
    field: {
      values: fieldValues,
      gradients: fieldGradients,
      densities: fieldDensities,
      velocities: fieldVelocities,
    },
    topology: {
      nodes,
      edges,
      adjacency,
    },
    hierarchy: {
      rootManifoldId: 'manifold_root',
      manifolds: {
        manifold_root: {
          id: 'manifold_root',
          name: 'Root Cognitive Substrate',
          depth: 0,
          nodeIds: nodeKeys,
          childManifoldIds: ['manifold_primary', 'manifold_secondary'],
          parentManifoldId: null,
          guidanceVector: [1.0, 0.5, 0.2],
        },
        manifold_primary: {
          id: 'manifold_primary',
          name: 'Perceptual Manifold A',
          depth: 1,
          nodeIds: nodeKeys.slice(0, Math.floor(numNodes / 2)),
          childManifoldIds: [],
          parentManifoldId: 'manifold_root',
          guidanceVector: [0.8, 0.1, 0.0],
        },
        manifold_secondary: {
          id: 'manifold_secondary',
          name: 'Action Manifold B',
          depth: 1,
          nodeIds: nodeKeys.slice(Math.floor(numNodes / 2)),
          childManifoldIds: [],
          parentManifoldId: 'manifold_root',
          guidanceVector: [0.2, 0.9, 0.4],
        },
      },
    },
    memory: {
      nodes: {
        mem_0: {
          id: 'mem_0',
          type: 'episodic' as const,
          content: 'Initial topology bootstrap completed safely',
          vector: [0.1, 0.5, 0.9],
          salience: 0.95,
          lastAccessedStep: 0,
          associatedNodeIds: ['node_0', 'node_1'],
        },
        mem_1: {
          id: 'mem_1',
          type: 'semantic' as const,
          content: 'High-density field correlates with terrain hazard',
          vector: [0.8, 0.2, 0.1],
          salience: 0.8,
          lastAccessedStep: 0,
          associatedNodeIds: ['node_2'],
        },
        mem_2: {
          id: 'mem_2',
          type: 'procedural' as const,
          content: 'When stress > 0.4, trigger channel activation and diffusion boost',
          vector: [0.2, 0.8, 0.4],
          salience: 0.9,
          lastAccessedStep: 0,
          associatedNodeIds: ['node_0'],
          usefulnessScore: 0.92,
        },
      },
      workingMemory: {
        activeObservations: ['Substrate initialized', 'Lattice transport functional'],
        activeHypotheses: [
          { id: 'hyp_1', description: 'Field relaxation will minimize local stress', confidence: 0.85 }
        ],
        attentionFocusNodeId: 'node_0',
        unresolvedConflicts: [],
        temporaryPlans: ['Damp stress on node_0', 'Probe surrounding gradients'],
      },
      capacity: 50,
      totalMass: 2.65,
    },
    cognition: {
      attentionFocusNodeId: 'node_0',
      curiosityBias: 0.5,
      noveltyScore: 0.2,
      surpriseLevel: 0.05,
      activeHypotheses: [
        { id: 'hyp_1', description: 'Field relaxation will minimize local stress', confidence: 0.85 }
      ],
    },
    guidance: {
      activeGoal: 'Explore Hazard-Free Trajectory',
      targetPosition: { x: 350, y: 350 },
      attractorNodes: ['node_3', 'node_7'],
      riskTolerance: 0.3,
    },
    uncertainty: {
      nodeUncertainties,
      globalEntropy: 0.12,
      sensorConfidence: 0.95,
    },
    stress: {
      nodeStress,
      globalStress: 0.08,
      lockedOutMechanisms: [],
      safeModeActive: false,
      consecutiveAlerts: 0,
    },
    resources: {
      totalComputeBudget: 100,
      usedComputeEnergy: 24,
      activeWidth: numNodes,
      memoryUsageBytes: 4096,
      structuralEventBudget: 3,
    },
    goals: {
      primaryGoal: 'Maintain World Model Stability',
      subGoals: ['Dampen field variance', 'Repair broken links', 'Consolidate memory'],
      progressRatio: 0.1,
    },
  };

  const hash = computeStateHash({ ...initialStateWithoutHash, metadata: { step: 0, seed } });

  return {
    ...initialStateWithoutHash,
    aiEcosystem: initializeAIEcosystem ? createInitialAIEcosystemState(0) : undefined,
    metadata: {
      step: 0,
      timestamp: Date.now(),
      seed,
      stateHash: hash,
      version: '1.0.0-HRM',
    },
  };
}
