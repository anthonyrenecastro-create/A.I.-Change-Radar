/**
 * HRM Ecology: Computational Ecology (Independent Mechanisms)
 * Adheres strictly to Principle 2: Common Snapshot Principle
 * and Principle 3: Proposal, Never Mutation
 */

import {
  HRMWorldState,
  Contribution,
  PerceptualObservation,
  StructuralEvent
} from '../types/hrm';
import {
  LLMAReasoningMechanism,
  LLMBCritiqueMechanism,
  ToolsActionMechanism
} from './llmMechanisms';

export interface Mechanism {
  id: string;
  name: string;
  description: string;
  propose(state: Readonly<HRMWorldState>, observation?: PerceptualObservation): Contribution;
}

/**
 * 1. Diffusion Mechanism: Smooths continuous field values across graph edges based on conductance
 */
export class DiffusionMechanism implements Mechanism {
  id = 'mech_diffusion';
  name = 'Diffusion Relaxation';
  description = 'Propagates continuous field energy across connected topology via graph Laplacian conductance';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const fieldDeltas: Record<string, number> = {};
    const { nodes, edges } = state.topology;
    const values = state.field.values;
    const diffusionRate = 0.15;

    // Initialize deltas to 0
    for (const nodeId in nodes) {
      fieldDeltas[nodeId] = 0;
    }

    // Graph Laplacian diffusion proposal
    for (const edgeId in edges) {
      const edge = edges[edgeId];
      if (!edge.active) continue;

      const vSource = values[edge.source] ?? 0;
      const vTarget = values[edge.target] ?? 0;
      const flux = (vTarget - vSource) * edge.conductance * diffusionRate;

      if (fieldDeltas[edge.source] !== undefined) fieldDeltas[edge.source] += flux;
      if (fieldDeltas[edge.target] !== undefined) fieldDeltas[edge.target] -= flux;
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.92,
      activationStrength: 0.85,
      estimatedCost: 12,
      uncertainty: 0.05,
      rationale: 'Diffusing local field concentration across topological graph conductance',
      fieldDeltas,
      diagnostics: {
        activeEdgesProcessed: Object.values(edges).filter(e => e.active).length,
        diffusionRate,
      },
    };
  }
}

/**
 * 2. Prediction Error Correction Mechanism
 */
export class PredictionErrorCorrectionMechanism implements Mechanism {
  id = 'mech_pred_error';
  name = 'Prediction Error Correction';
  description = 'Compares state field against goal target attractors and proposes corrective gradients';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const fieldDeltas: Record<string, number> = {};
    const attractors = state.guidance.attractorNodes;
    const values = state.field.values;

    let maxError = 0;
    for (const nodeId in state.topology.nodes) {
      const isAttractor = attractors.includes(nodeId);
      const targetVal = isAttractor ? 0.95 : 0.25;
      const currentVal = values[nodeId] ?? 0.5;
      const error = targetVal - currentVal;
      fieldDeltas[nodeId] = error * 0.25; // Propose 25% correction step

      if (Math.abs(error) > maxError) {
        maxError = Math.abs(error);
      }
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.88,
      activationStrength: Math.min(1.0, maxError * 1.5),
      estimatedCost: 15,
      uncertainty: 0.12,
      rationale: `Proposing corrective field deltas (Max prediction error: ${maxError.toFixed(3)})`,
      fieldDeltas,
      diagnostics: { maxError, attractorsCount: attractors.length },
    };
  }
}

/**
 * 3. Stress Regulation & Self Stabilization Mechanism
 */
export class StressRegulationMechanism implements Mechanism {
  id = 'mech_stress_reg';
  name = 'Stress Regulation & Damping';
  description = 'Monitors localized node stress and proposes field dampening and structural lockouts if overheated';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const fieldDeltas: Record<string, number> = {};
    const stressMap = state.stress.nodeStress;
    let highStressCount = 0;

    for (const nodeId in stressMap) {
      const stress = stressMap[nodeId] ?? 0;
      if (stress > 0.4) {
        // High stress: propose negative field dampening to stabilize energy
        fieldDeltas[nodeId] = -0.15 * stress;
        highStressCount++;
      }
    }

    const globalStress = state.stress.globalStress;
    const proposedEvents: StructuralEvent[] = [];

    if (globalStress > 0.6) {
      proposedEvents.push({
        id: `ev_stabilize_${Date.now()}`,
        type: 'EdgeHealing',
        targetIds: Object.keys(state.topology.edges).slice(0, 2),
        parameters: { boostConductance: 0.3 },
        reason: 'High global stress detected: boosting edge conductance for energy dissipation',
      });
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.95,
      activationStrength: Math.min(1.0, globalStress * 2.0),
      estimatedCost: 8,
      uncertainty: 0.08,
      rationale: highStressCount > 0
        ? `Dampening field energy on ${highStressCount} high-stress nodes (Global stress: ${globalStress.toFixed(2)})`
        : 'Global stress within normal operational bound',
      fieldDeltas,
      proposedEvents,
      diagnostics: { highStressCount, globalStress },
    };
  }
}

/**
 * 4. Sensor Fusion & Uncertainty Propagation Mechanism
 */
export class SensorFusionMechanism implements Mechanism {
  id = 'mech_sensor_fusion';
  name = 'Sensor Fusion & Uncertainty';
  description = 'Integrates incoming perceptual observations with noisy confidence bounds into the world model';

  propose(state: Readonly<HRMWorldState>, observation?: PerceptualObservation): Contribution {
    const fieldDeltas: Record<string, number> = {};
    if (!observation || observation.sensorLoss) {
      return {
        mechanismId: this.id,
        mechanismName: this.name,
        confidence: 0.3,
        activationStrength: 0.1,
        estimatedCost: 2,
        uncertainty: 0.8,
        rationale: observation?.sensorLoss ? 'Sensor signal lost / blackout in progress' : 'No observation frame provided',
        diagnostics: { sensorLoss: true },
      };
    }

    const sensorConfidence = state.uncertainty.sensorConfidence;
    let updatedNodesCount = 0;

    for (const nodeId in observation.sensedNodes) {
      if (state.topology.nodes[nodeId]) {
        const obs = observation.sensedNodes[nodeId];
        const currentVal = state.field.values[nodeId] ?? 0;
        const delta = (obs.value - currentVal) * sensorConfidence * (1.0 - obs.noise);
        fieldDeltas[nodeId] = delta;
        updatedNodesCount++;
      }
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: sensorConfidence,
      activationStrength: 0.9,
      estimatedCost: 18,
      uncertainty: 1.0 - sensorConfidence,
      rationale: `Fused observation signals across ${updatedNodesCount} nodes with sensor confidence ${sensorConfidence.toFixed(2)}`,
      fieldDeltas,
      diagnostics: { updatedNodesCount, sensorConfidence },
    };
  }
}

/**
 * 5. Memory Consolidation & Retrieval Mechanism
 */
export class MemoryConsolidationMechanism implements Mechanism {
  id = 'mech_memory';
  name = 'Memory Consolidation & Retrieval';
  description = 'Manages episodic memory salience, prunes decayed memories, and links active nodes to semantically relevant knowledge';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const memory = state.memory;
    const focusNode = state.cognition.attentionFocusNodeId;
    const proposedEvents: StructuralEvent[] = [];

    // Check if memory capacity is exceeded
    const memoryKeys = Object.keys(memory.nodes);
    let saliencePruned = 0;

    if (memoryKeys.length > memory.capacity * 0.8) {
      saliencePruned = 1;
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.85,
      activationStrength: 0.6,
      estimatedCost: 10,
      uncertainty: 0.15,
      rationale: focusNode
        ? `Consolidating memories around active focus node ${focusNode}`
        : 'Maintaining memory graph salience and decay profiles',
      memoryModifications: {
        totalMass: memory.totalMass * 0.99,
      },
      proposedEvents,
      diagnostics: { memoryCount: memoryKeys.length, saliencePruned },
    };
  }
}

/**
 * 6. Damage Detection & Topology Repair Mechanism
 */
export class DamageDetectionMechanism implements Mechanism {
  id = 'mech_damage_repair';
  name = 'Damage Detection & Topology Repair';
  description = 'Identifies severed connections, missing edges, and damaged regions; proposes structural healing events';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const { nodes, edges } = state.topology;
    const proposedEvents: StructuralEvent[] = [];

    // Count active connections for each node
    const activeDegree: Record<string, number> = {};
    for (const nodeId in nodes) {
      activeDegree[nodeId] = 0;
    }

    for (const edgeId in edges) {
      const edge = edges[edgeId];
      if (edge.active) {
        if (activeDegree[edge.source] !== undefined) activeDegree[edge.source]++;
        if (activeDegree[edge.target] !== undefined) activeDegree[edge.target]++;
      }
    }

    // Identify isolated or low-degree nodes and propose edge healing or addition
    const isolatedNodes = Object.keys(activeDegree).filter(id => activeDegree[id] === 0);

    if (isolatedNodes.length > 0) {
      const targetNode = isolatedNodes[0];
      // Find nearest non-isolated node
      const nTarget = nodes[targetNode];
      let nearestId: string | null = null;
      let minDist = Infinity;

      for (const otherId in nodes) {
        if (otherId !== targetNode && activeDegree[otherId] > 0) {
          const nOther = nodes[otherId];
          const dist = Math.hypot(nTarget.position.x - nOther.position.x, nTarget.position.y - nOther.position.y);
          if (dist < minDist) {
            minDist = dist;
            nearestId = otherId;
          }
        }
      }

      if (nearestId) {
        proposedEvents.push({
          id: `ev_repair_${Date.now()}`,
          type: 'AddEdge',
          targetIds: [targetNode, nearestId],
          parameters: { weight: 0.75, conductance: 0.6 },
          reason: `Topology repair: healing isolated node ${targetNode} by reconnecting to ${nearestId}`,
        });
      }
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.96,
      activationStrength: isolatedNodes.length > 0 ? 0.95 : 0.2,
      estimatedCost: 14,
      uncertainty: 0.05,
      rationale: isolatedNodes.length > 0
        ? `Detected ${isolatedNodes.length} isolated topological node(s); proposing structural edge healing`
        : 'Topology connectivity checks passed; zero isolated nodes',
      proposedEvents,
      diagnostics: { isolatedCount: isolatedNodes.length },
    };
  }
}

/**
 * 7. Geometry Adaptation & Region Splitting Mechanism
 */
export class GeometryAdaptationMechanism implements Mechanism {
  id = 'mech_geometry_adapt';
  name = 'Geometry & Region Adaptation';
  description = 'Detects high local field density or spatial clustering and proposes node splitting or region division';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const { values } = state.field;
    const { nodes } = state.topology;
    const proposedEvents: StructuralEvent[] = [];

    let highestDensityNode: string | null = null;
    let maxDensity = 0;

    for (const nodeId in values) {
      if (values[nodeId] > 0.85) {
        if (values[nodeId] > maxDensity) {
          maxDensity = values[nodeId];
          highestDensityNode = nodeId;
        }
      }
    }

    // If a node field value is saturated > 0.92 and budget permits, propose SplitRegion or AddNode
    if (highestDensityNode && maxDensity > 0.92 && Object.keys(nodes).length < 24) {
      const parentNode = nodes[highestDensityNode];
      proposedEvents.push({
        id: `ev_split_${Date.now()}`,
        type: 'SplitRegion',
        targetIds: [highestDensityNode],
        parameters: {
          newNodePosition: {
            x: parentNode.position.x + 25,
            y: parentNode.position.y + 25,
          },
        },
        reason: `High field density concentration (${maxDensity.toFixed(2)}) on ${highestDensityNode}; proposing spatial region split`,
      });
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.82,
      activationStrength: maxDensity > 0.85 ? 0.75 : 0.1,
      estimatedCost: 20,
      uncertainty: 0.18,
      rationale: highestDensityNode
        ? `High localized field density (${maxDensity.toFixed(2)}) detected on node ${highestDensityNode}`
        : 'Substrate density uniform; no geometric adaptation required',
      proposedEvents,
      diagnostics: { maxDensity, highestDensityNode },
    };
  }
}

/**
 * 8. Resource Allocation Mechanism
 */
export class ResourceAllocationMechanism implements Mechanism {
  id = 'mech_resource';
  name = 'Resource Allocation & Compute Budgeting';
  description = 'Controls active computational width and energy expenditure to keep execution within constitutional limits';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const totalNodes = Object.keys(state.topology.nodes).length;
    const currentEnergy = state.resources.usedComputeEnergy;
    const totalBudget = state.resources.totalComputeBudget;

    const resourceRatio = currentEnergy / totalBudget;

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.99,
      activationStrength: resourceRatio > 0.7 ? 0.9 : 0.4,
      estimatedCost: 4,
      uncertainty: 0.02,
      rationale: `Monitoring resource ecology (Energy ratio: ${(resourceRatio * 100).toFixed(1)}%). Active width target: ${totalNodes}`,
      resourceAdjustments: {
        activeWidth: totalNodes,
        usedComputeEnergy: Math.max(15, Math.min(totalBudget, currentEnergy * 0.95 + 10)),
      },
      diagnostics: { resourceRatio, totalNodes },
    };
  }
}

/**
 * 9. Curiosity, Novelty & Surprise Mechanism
 */
export class CuriosityMechanism implements Mechanism {
  id = 'mech_curiosity';
  name = 'Curiosity & Novelty Detection';
  description = 'Evaluates regional entropy shifts and directs cognitive attention focus toward high-uncertainty nodes';

  propose(state: Readonly<HRMWorldState>): Contribution {
    const uncertainties = state.uncertainty.nodeUncertainties;
    let maxUncertainty = 0;
    let mostUncertainNode: string | null = null;

    for (const nodeId in uncertainties) {
      if (uncertainties[nodeId] > maxUncertainty) {
        maxUncertainty = uncertainties[nodeId];
        mostUncertainNode = nodeId;
      }
    }

    return {
      mechanismId: this.id,
      mechanismName: this.name,
      confidence: 0.87,
      activationStrength: Math.min(1.0, maxUncertainty * 2.0),
      estimatedCost: 8,
      uncertainty: maxUncertainty,
      rationale: mostUncertainNode
        ? `Directing curiosity attention bias to node ${mostUncertainNode} (Uncertainty: ${maxUncertainty.toFixed(2)})`
        : 'Substrate uncertainty low; maintaining baseline novelty search',
      diagnostics: { maxUncertainty, mostUncertainNode },
    };
  }
}

/**
 * Registry of default mechanisms powering the computational ecology
 */
export function getDefaultMechanisms(): Mechanism[] {
  return [
    new LLMAReasoningMechanism(),
    new LLMBCritiqueMechanism(),
    new ToolsActionMechanism(),
    new DiffusionMechanism(),
    new PredictionErrorCorrectionMechanism(),
    new StressRegulationMechanism(),
    new SensorFusionMechanism(),
    new MemoryConsolidationMechanism(),
    new DamageDetectionMechanism(),
    new GeometryAdaptationMechanism(),
    new ResourceAllocationMechanism(),
    new CuriosityMechanism(),
  ];
}
