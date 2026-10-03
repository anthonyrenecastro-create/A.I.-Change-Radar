/**
 * HRM Ecology: Singular Commit Arbitrator
 * Principle 4: Singular Commit & Principle 6: Computational Conservation of Explanation
 *
 * Collects all mechanism proposals from step t, evaluates arbitration weights,
 * applies field deltas, executes structural events with explicit transport,
 * enforces safety constitution, and commits authoritative Xt+1 with full explanation ledger entry.
 */

import {
  HRMWorldState,
  Contribution,
  LedgerEntry,
  StructuralEvent,
  ConsequenceEvaluation,
  CreditAssignment
} from '../types/hrm';
import { computeStateHash } from './state';
import { executeStateTransport } from './transport';
import { evaluateSafetyConstitution } from './safety';
import { ReputationManager } from './reputation';
import { evaluateConsequences } from './consequence';

export interface CommitResult {
  nextState: HRMWorldState;
  ledgerEntry: LedgerEntry;
  consequence: ConsequenceEvaluation;
}

export function commitNextState(
  currentState: Readonly<HRMWorldState>,
  contributions: Contribution[],
  reputationManager?: ReputationManager,
  critiqueAudit?: {
    overallConsistencyScore: number;
    hallucinationRisk: number;
    vetoedMechanisms: string[];
    safetyWarnings: string[];
  }
): CommitResult {
  const previousStateHash = currentState.metadata.stateHash;
  const currentStep = currentState.metadata.step;

  // 1. Sovereign Critique scaling & veto check
  let processedContributions = contributions;
  let vetoedMechanisms: string[] = critiqueAudit?.vetoedMechanisms || [];

  if (reputationManager) {
    const evalResult = reputationManager.evaluateAndScaleContributions(contributions, critiqueAudit);
    processedContributions = evalResult.scaledContributions;
    vetoedMechanisms = [...vetoedMechanisms, ...evalResult.vetoed];
  }

  // Filter locked out mechanisms if safe mode / stress lockout active
  const lockedOut = currentState.stress.lockedOutMechanisms;
  const validContributions = processedContributions.filter(
    c => !lockedOut.includes(c.mechanismId) && !vetoedMechanisms.includes(c.mechanismId)
  );

  const acceptedContributions: LedgerEntry['acceptedContributions'] = [];
  const rejectedContributions: LedgerEntry['rejectedContributions'] = [];
  const pendingEvents: StructuralEvent[] = [];
  const acceptedForConsequence: Contribution[] = [];

  // 2. Accumulate field deltas using confidence & activation weighting
  const accumulatedDeltas: Record<string, number> = {};
  const totalWeightsPerNode: Record<string, number> = {};

  for (const nodeId in currentState.topology.nodes) {
    accumulatedDeltas[nodeId] = 0;
    totalWeightsPerNode[nodeId] = 0;
  }

  for (const c of validContributions) {
    const weight = c.confidence * c.activationStrength;

    if (weight > 0.05) {
      acceptedContributions.push({
        mechanismId: c.mechanismId,
        weight,
        rationale: c.rationale,
        cost: c.estimatedCost,
      });
      acceptedForConsequence.push(c);

      if (c.fieldDeltas) {
        for (const nodeId in c.fieldDeltas) {
          if (accumulatedDeltas[nodeId] !== undefined) {
            accumulatedDeltas[nodeId] += c.fieldDeltas[nodeId] * weight;
            totalWeightsPerNode[nodeId] += weight;
          }
        }
      }

      if (c.proposedEvents && c.proposedEvents.length > 0) {
        pendingEvents.push(...c.proposedEvents);
      }
    } else {
      rejectedContributions.push({
        mechanismId: c.mechanismId,
        reason: `Weight below threshold (Confidence: ${c.confidence.toFixed(2)}, Activation: ${c.activationStrength.toFixed(2)})`,
      });
    }
  }

  // Deep clone currentState to construct stateDraft for step t+1
  const stateDraft: HRMWorldState = JSON.parse(JSON.stringify(currentState));
  stateDraft.metadata.step = currentStep + 1;
  // Deterministic timestamp step: t0 + step * 1000
  stateDraft.metadata.timestamp = (currentState.metadata.timestamp || 1700000000000) + 1000;

  // Apply weighted average field deltas
  for (const nodeId in stateDraft.field.values) {
    const weightSum = totalWeightsPerNode[nodeId] ?? 0;
    if (weightSum > 0) {
      const avgDelta = accumulatedDeltas[nodeId] / weightSum;
      stateDraft.field.values[nodeId] = Math.max(0, Math.min(1.0, stateDraft.field.values[nodeId] + avgDelta));
    }
  }

  // Process self-evolution proposals
  for (const c of acceptedForConsequence) {
    if (c.selfEvolutionProposals) {
      for (const prop of c.selfEvolutionProposals) {
        if (prop.type === 'ParameterAdjustment' && prop.parameters) {
          if (typeof prop.parameters.riskTolerance === 'number') {
            stateDraft.guidance.riskTolerance = Math.max(0, Math.min(1.0, prop.parameters.riskTolerance));
          }
        }
      }
    }
  }

  // 3. Deduplicate structural events (limit to structural budget)
  const budget = currentState.resources.structuralEventBudget;
  const executedEvents = pendingEvents.slice(0, budget);

  // 4. Execute Explicit State Transport
  const transportDiagnostics = executeStateTransport(currentState, stateDraft, executedEvents);

  // 5. Evaluate Safety Constitution
  const safetyResult = evaluateSafetyConstitution(stateDraft, currentState);

  let finalState: HRMWorldState;
  if (safetyResult.triggerRollback) {
    // Safety Rollback triggered
    finalState = JSON.parse(JSON.stringify(currentState));
    finalState.metadata.step = currentStep + 1;
    finalState.metadata.stateHash = computeStateHash(finalState);
  } else {
    finalState = safetyResult.repairedState || stateDraft;
    finalState.metadata.stateHash = computeStateHash(finalState);
  }

  // 6. Consequence Evaluation & Credit Assignment
  const consequence = evaluateConsequences(currentState, finalState, acceptedForConsequence);

  // 7. Update Reputation Store
  if (reputationManager) {
    const acceptedIds = acceptedContributions.map(a => a.mechanismId);
    const rejectedIds = rejectedContributions.map(r => r.mechanismId);
    reputationManager.updateReputations(acceptedIds, rejectedIds, consequence);
  }

  // Calculate conservation residual
  const residual = transportDiagnostics.conservationResidual;

  const ledgerEntry: LedgerEntry = {
    step: currentStep + 1,
    previousStateHash,
    newStateHash: finalState.metadata.stateHash,
    timestamp: finalState.metadata.timestamp,
    acceptedContributions,
    rejectedContributions,
    executedStructuralEvents: executedEvents,
    transportDiagnostics,
    safetyInterventions: safetyResult.interventions,
    residual,
    accepted: !safetyResult.triggerRollback && residual < 0.05,
    consequenceEvaluation: consequence,
    critiqueAudit: critiqueAudit ? {
      overallConsistencyScore: critiqueAudit.overallConsistencyScore,
      hallucinationRisk: critiqueAudit.hallucinationRisk,
      vetoedMechanisms,
      safetyWarnings: critiqueAudit.safetyWarnings,
    } : undefined,
    creditAssignments: consequence.creditAssignments,
  };

  return {
    nextState: finalState,
    ledgerEntry,
    consequence,
  };
}
