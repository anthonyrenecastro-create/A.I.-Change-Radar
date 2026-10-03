/**
 * Consequence Engine & Credit Assignment
 * Priority 3 & 6: Compares predicted outcomes vs actual state changes,
 * computes prediction error, goal progress, and credit assignment (reward/blame).
 */

import {
  HRMWorldState,
  Contribution,
  ConsequenceEvaluation,
  CreditAssignment
} from '../types/hrm';

export function evaluateConsequences(
  previousState: Readonly<HRMWorldState>,
  actualState: Readonly<HRMWorldState>,
  acceptedContributions: Contribution[]
): ConsequenceEvaluation {
  let totalSquareError = 0;
  let predictedNodeCount = 0;

  const creditAssignments: CreditAssignment[] = [];

  // Evaluate field value prediction errors
  for (const c of acceptedContributions) {
    let mechSquareError = 0;
    let predictedCount = 0;

    if (c.predictedFieldValues) {
      for (const nodeId in c.predictedFieldValues) {
        const predictedVal = c.predictedFieldValues[nodeId];
        const actualVal = actualState.field.values[nodeId] ?? previousState.field.values[nodeId] ?? 0;
        const diff = Math.abs(predictedVal - actualVal);
        mechSquareError += diff * diff;
        predictedCount++;
      }
    }

    const mechMSE = predictedCount > 0 ? Math.sqrt(mechSquareError / predictedCount) : 0.05;
    totalSquareError += mechSquareError;
    predictedNodeCount += predictedCount;

    // Calculate actual benefit (stress reduction + field alignment)
    const prevStress = previousState.stress.globalStress;
    const actualStress = actualState.stress.globalStress;
    const stressReduced = Math.max(0, prevStress - actualStress);

    const prevGoalProgress = previousState.goals.progressRatio;
    const actualGoalProgress = actualState.goals.progressRatio;
    const goalDelta = Math.max(-0.5, Math.min(0.5, actualGoalProgress - prevGoalProgress));

    const predictedBenefit = (c.predictedGoalProgress ?? 0.1) + (1.0 - c.uncertainty) * 0.1;
    const actualBenefit = goalDelta + stressReduced * 0.5 + (1.0 - mechMSE) * 0.2;

    const benefitDiff = actualBenefit - predictedBenefit;
    const reward = Math.max(0, Math.min(1, 0.5 + benefitDiff));
    const blame = Math.max(0, Math.min(1, mechMSE + (benefitDiff < -0.1 ? 0.3 : 0)));

    creditAssignments.push({
      mechanismId: c.mechanismId,
      predictedBenefit,
      actualBenefit,
      confidenceAdjustment: (reward - blame) * 0.05,
      futurePriority: Math.max(0.1, Math.min(1.0, 0.8 + (reward - blame) * 0.2)),
      blame,
      reward,
    });
  }

  const overallRMSE = predictedNodeCount > 0 ? Math.sqrt(totalSquareError / predictedNodeCount) : 0.02;

  const goalProgressDelta = actualState.goals.progressRatio - previousState.goals.progressRatio;
  const resourceCostActual = actualState.resources.usedComputeEnergy;
  const unexpectedEventsCount = actualState.stress.consecutiveAlerts;

  const causalConfidence = Math.max(0.1, Math.min(1.0, 1.0 - overallRMSE - (unexpectedEventsCount * 0.1)));

  return {
    predictionError: overallRMSE,
    goalProgressDelta,
    resourceCostActual,
    unexpectedEventsCount,
    causalConfidence,
    creditAssignments,
  };
}
