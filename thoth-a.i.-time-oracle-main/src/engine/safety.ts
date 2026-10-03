/**
 * HRM Ecology: Safety Constitution
 * Safety is constitutionally separate from proposals.
 * Evaluates invariants, performs repairs, and enforces lockouts or rollbacks.
 */

import { HRMWorldState } from '../types/hrm';

export interface SafetyCheckResult {
  passed: boolean;
  interventions: string[];
  repairedState?: HRMWorldState;
  triggerRollback: boolean;
}

export function evaluateSafetyConstitution(
  stateDraft: HRMWorldState,
  previousState: Readonly<HRMWorldState>
): SafetyCheckResult {
  const interventions: string[] = [];
  let triggerRollback = false;

  // 1. Finite Value Preservation Check (NaN / Infinity detection)
  let nanOrInfDetected = false;
  for (const nodeId in stateDraft.field.values) {
    const val = stateDraft.field.values[nodeId];
    if (isNaN(val) || !isFinite(val)) {
      nanOrInfDetected = true;
      interventions.push(`Finite Value Violation: NaN/Infinity detected on node ${nodeId}. Resetting to fallback 0.25`);
      stateDraft.field.values[nodeId] = previousState.field.values[nodeId] ?? 0.25;
    }
  }

  // 2. Topology Integrity Check (Orphaned edges pointing to missing nodes)
  const nodeSet = new Set(Object.keys(stateDraft.topology.nodes));
  for (const edgeId in stateDraft.topology.edges) {
    const edge = stateDraft.topology.edges[edgeId];
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) {
      interventions.push(`Topology Integrity Violation: Edge ${edgeId} references missing node (${edge.source} -> ${edge.target}). Removing edge.`);
      delete stateDraft.topology.edges[edgeId];
    }
  }

  // 3. Field Collapse Prevention (Check if all field values collapsed to 0)
  const values = Object.values(stateDraft.field.values);
  const totalFieldSum = values.reduce((acc, v) => acc + (isNaN(v) ? 0 : Math.max(0, v)), 0);
  if (values.length > 0 && totalFieldSum < 0.001) {
    interventions.push('Field Collapse Violation: All node field values collapsed near zero. Injecting baseline energy floor (0.1).');
    for (const nodeId in stateDraft.field.values) {
      stateDraft.field.values[nodeId] = 0.1;
    }
  }

  // 4. Bound Field Values to [0, 1]
  for (const nodeId in stateDraft.field.values) {
    if (stateDraft.field.values[nodeId] > 1.0) {
      stateDraft.field.values[nodeId] = 1.0;
    } else if (stateDraft.field.values[nodeId] < 0.0) {
      stateDraft.field.values[nodeId] = 0.0;
    }
  }

  // 5. Stress Lockout & Resource Floor
  const globalStress = Object.values(stateDraft.stress.nodeStress).reduce((a, b) => a + b, 0) / (values.length || 1);
  stateDraft.stress.globalStress = globalStress;

  if (globalStress > 0.85) {
    stateDraft.stress.safeModeActive = true;
    interventions.push(`Stress Lockout Triggered: Global stress (${globalStress.toFixed(2)}) exceeded safety ceiling (0.85). Activating Safe Mode.`);
  }

  // 6. Unrecoverable Failure Check
  if (nanOrInfDetected && Object.keys(stateDraft.topology.nodes).length === 0) {
    triggerRollback = true;
    interventions.push('Unrecoverable Safety Failure: Complete state corruption detected. Initiating Rollback to X_{t-1}.');
  }

  return {
    passed: interventions.length === 0,
    interventions,
    repairedState: stateDraft,
    triggerRollback,
  };
}
