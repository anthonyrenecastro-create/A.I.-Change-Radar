/**
 * HRM Ecology: Explicit State Transport Engine
 * Principle 5: Structure is Independent from State
 *
 * When computational structure changes (structural events),
 * field state and memory mass must be explicitly transported into the new structure
 * with full mass conservation tracking and residual logging.
 */

import {
  HRMWorldState,
  StructuralEvent,
  TransportDiagnostics,
  NodeGeometry,
  EdgeTopology
} from '../types/hrm';

export function executeStateTransport(
  previousState: Readonly<HRMWorldState>,
  nextStateDraft: HRMWorldState,
  events: StructuralEvent[]
): TransportDiagnostics {
  let initialFieldMass = 0;
  for (const nodeId in previousState.field.values) {
    const val = previousState.field.values[nodeId];
    if (!isNaN(val)) initialFieldMass += val;
  }

  let transportedMass = 0;
  let introducedMass = 0;
  let lostMass = 0;
  const unmappedReferences: string[] = [];

  // Process structural events step-by-step
  for (const ev of events) {
    switch (ev.type) {
      case 'AddNode': {
        const nodeId = ev.targetIds[0] || `node_${Date.now()}`;
        const pos = (ev.parameters.position as any) || { x: 200, y: 200 };
        const initVal = (ev.parameters.initialValue as number) ?? 0.2;

        nextStateDraft.topology.nodes[nodeId] = {
          id: nodeId,
          position: pos,
          regionId: (ev.parameters.regionId as string) || 'region_north',
          manifoldId: (ev.parameters.manifoldId as string) || 'manifold_primary',
        };

        nextStateDraft.field.values[nodeId] = initVal;
        nextStateDraft.field.gradients[nodeId] = { x: 0, y: 0 };
        nextStateDraft.field.densities[nodeId] = 1.0;
        nextStateDraft.field.velocities[nodeId] = { x: 0, y: 0 };
        nextStateDraft.stress.nodeStress[nodeId] = 0.05;
        nextStateDraft.uncertainty.nodeUncertainties[nodeId] = 0.15;
        nextStateDraft.topology.adjacency[nodeId] = [];

        introducedMass += initVal;
        break;
      }

      case 'RemoveNode': {
        const nodeId = ev.targetIds[0];
        if (nextStateDraft.topology.nodes[nodeId]) {
          const removedVal = nextStateDraft.field.values[nodeId] ?? 0;
          lostMass += removedVal;

          delete nextStateDraft.topology.nodes[nodeId];
          delete nextStateDraft.field.values[nodeId];
          delete nextStateDraft.field.gradients[nodeId];
          delete nextStateDraft.field.densities[nodeId];
          delete nextStateDraft.field.velocities[nodeId];
          delete nextStateDraft.stress.nodeStress[nodeId];
          delete nextStateDraft.uncertainty.nodeUncertainties[nodeId];
          delete nextStateDraft.topology.adjacency[nodeId];

          // Clean up connected edges
          for (const edgeId in nextStateDraft.topology.edges) {
            const edge = nextStateDraft.topology.edges[edgeId];
            if (edge.source === nodeId || edge.target === nodeId) {
              delete nextStateDraft.topology.edges[edgeId];
            }
          }
        } else {
          unmappedReferences.push(`RemoveNode: ${nodeId} not found`);
        }
        break;
      }

      case 'AddEdge': {
        const [source, target] = ev.targetIds;
        if (nextStateDraft.topology.nodes[source] && nextStateDraft.topology.nodes[target]) {
          const edgeId = `edge_${source}_${target}_${Date.now()}`;
          const weight = (ev.parameters.weight as number) ?? 0.8;
          const conductance = (ev.parameters.conductance as number) ?? 0.7;

          nextStateDraft.topology.edges[edgeId] = {
            id: edgeId,
            source,
            target,
            weight,
            conductance,
            active: true,
          };

          if (!nextStateDraft.topology.adjacency[source]) nextStateDraft.topology.adjacency[source] = [];
          if (!nextStateDraft.topology.adjacency[target]) nextStateDraft.topology.adjacency[target] = [];
          if (!nextStateDraft.topology.adjacency[source].includes(target)) nextStateDraft.topology.adjacency[source].push(target);
          if (!nextStateDraft.topology.adjacency[target].includes(source)) nextStateDraft.topology.adjacency[target].push(source);
        } else {
          unmappedReferences.push(`AddEdge: source ${source} or target ${target} missing`);
        }
        break;
      }

      case 'RemoveEdge': {
        const edgeId = ev.targetIds[0];
        if (nextStateDraft.topology.edges[edgeId]) {
          delete nextStateDraft.topology.edges[edgeId];
        } else {
          unmappedReferences.push(`RemoveEdge: ${edgeId} not found`);
        }
        break;
      }

      case 'SplitRegion': {
        const parentId = ev.targetIds[0];
        if (nextStateDraft.topology.nodes[parentId]) {
          const parentNode = nextStateDraft.topology.nodes[parentId];
          const parentValue = nextStateDraft.field.values[parentId] ?? 0.5;

          const newNodeId = `node_split_${Date.now() % 10000}`;
          const newPos = (ev.parameters.newNodePosition as { x: number; y: number }) || {
            x: parentNode.position.x + 30,
            y: parentNode.position.y + 30,
          };

          // Explicit Conservation Transport: Split parent value equally between parent and child
          const splitValue = parentValue / 2.0;
          nextStateDraft.field.values[parentId] = splitValue;
          nextStateDraft.field.values[newNodeId] = splitValue;

          nextStateDraft.topology.nodes[newNodeId] = {
            id: newNodeId,
            position: newPos,
            regionId: parentNode.regionId,
            manifoldId: parentNode.manifoldId,
          };

          nextStateDraft.field.gradients[newNodeId] = { ...nextStateDraft.field.gradients[parentId] };
          nextStateDraft.field.densities[newNodeId] = nextStateDraft.field.densities[parentId];
          nextStateDraft.field.velocities[newNodeId] = { ...nextStateDraft.field.velocities[parentId] };
          nextStateDraft.stress.nodeStress[newNodeId] = 0.05;
          nextStateDraft.uncertainty.nodeUncertainties[newNodeId] = 0.1;

          // Connect split node to parent
          const edgeId = `edge_split_${parentId}_${newNodeId}`;
          nextStateDraft.topology.edges[edgeId] = {
            id: edgeId,
            source: parentId,
            target: newNodeId,
            weight: 0.9,
            conductance: 0.85,
            active: true,
          };

          if (!nextStateDraft.topology.adjacency[parentId]) nextStateDraft.topology.adjacency[parentId] = [];
          nextStateDraft.topology.adjacency[parentId].push(newNodeId);
          nextStateDraft.topology.adjacency[newNodeId] = [parentId];

          transportedMass += parentValue; // Mass conserved cleanly via 50/50 split
        } else {
          unmappedReferences.push(`SplitRegion: ${parentId} not found`);
        }
        break;
      }

      case 'EdgeHealing': {
        for (const edgeId of ev.targetIds) {
          if (nextStateDraft.topology.edges[edgeId]) {
            nextStateDraft.topology.edges[edgeId].conductance = Math.min(
              1.0,
              nextStateDraft.topology.edges[edgeId].conductance + 0.3
            );
            nextStateDraft.topology.edges[edgeId].active = true;
          }
        }
        break;
      }

      default:
        break;
    }
  }

  // Calculate total final field mass
  let finalFieldMass = 0;
  for (const nodeId in nextStateDraft.field.values) {
    const val = nextStateDraft.field.values[nodeId];
    if (!isNaN(val)) finalFieldMass += val;
  }

  // Mass Conservation Residual: Residual = FinalMass - (InitialMass + IntroducedMass - LostMass)
  const expectedMass = initialFieldMass + introducedMass - lostMass;
  const conservationResidual = Math.abs(finalFieldMass - expectedMass);
  const continuityError = initialFieldMass > 0 ? conservationResidual / initialFieldMass : 0;
  const passedConservationCheck = conservationResidual < 0.001 && unmappedReferences.length === 0;

  return {
    transportedMass,
    introducedMass,
    lostMass,
    continuityError,
    conservationResidual,
    unmappedReferences,
    passedConservationCheck,
  };
}
