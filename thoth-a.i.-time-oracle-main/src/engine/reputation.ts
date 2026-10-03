/**
 * Sovereign Critique & Mechanism Reputation Engine
 * Priority 1: Converts critique from diagnostics into an executive participant.
 * Tracks mechanism reputation, modifies arbitration weights, and enforces trust bounds.
 */

import {
  MechanismReputation,
  Contribution,
  LedgerEntry,
  ConsequenceEvaluation,
  CreditAssignment
} from '../types/hrm';

export class ReputationManager {
  private reputations: Record<string, MechanismReputation> = {};

  constructor(mechanismIds: string[] = []) {
    for (const id of mechanismIds) {
      this.initMechanism(id);
    }
  }

  public initMechanism(id: string): MechanismReputation {
    if (!this.reputations[id]) {
      this.reputations[id] = {
        mechanismId: id,
        successRate: 0.9,
        failureRate: 0.1,
        confidence: 0.85,
        hallucinationHistory: [0.02],
        predictionAccuracy: 0.88,
        resourceEfficiency: 0.90,
        trustScore: 0.88,
        totalContributions: 0,
        acceptedCount: 0,
        vetoedCount: 0,
        consecutiveFailures: 0,
        isSuspended: false,
        isRetired: false,
      };
    }
    return this.reputations[id];
  }

  public getReputation(id: string): MechanismReputation {
    return this.reputations[id] || this.initMechanism(id);
  }

  public getAllReputations(): Record<string, MechanismReputation> {
    return { ...this.reputations };
  }

  /**
   * Applies Sovereign Critique weight multipliers & trust constraints to contributions
   */
  public evaluateAndScaleContributions(
    contributions: Contribution[],
    critiqueAudit?: {
      vetoedMechanisms?: string[];
      mechanismWeightAdjustments?: Record<string, number>;
      hallucinationRisk?: number;
    }
  ): { scaledContributions: Contribution[]; vetoed: string[] } {
    const scaledContributions: Contribution[] = [];
    const vetoed: string[] = [];

    const vetoSet = new Set(critiqueAudit?.vetoedMechanisms || []);

    for (const c of contributions) {
      const rep = this.getReputation(c.mechanismId);

      // Check if retired or suspended
      if (rep.isRetired || rep.isSuspended) {
        vetoed.push(c.mechanismId);
        rep.vetoedCount++;
        continue;
      }

      // Check if critique vetoed this mechanism directly
      if (vetoSet.has(c.mechanismId)) {
        vetoed.push(c.mechanismId);
        rep.vetoedCount++;
        rep.consecutiveFailures++;
        if (critiqueAudit?.hallucinationRisk) {
          rep.hallucinationHistory.push(critiqueAudit.hallucinationRisk);
          if (rep.hallucinationHistory.length > 20) rep.hallucinationHistory.shift();
        }
        continue;
      }

      // Apply reputation trust scale factor
      const weightMultiplier = critiqueAudit?.mechanismWeightAdjustments?.[c.mechanismId] ?? 1.0;
      const effectiveConfidence = Math.max(0.01, Math.min(1.0, c.confidence * rep.trustScore * weightMultiplier));
      const effectiveActivation = Math.max(0.01, Math.min(1.0, c.activationStrength * (1.0 - rep.failureRate * 0.5)));

      scaledContributions.push({
        ...c,
        confidence: effectiveConfidence,
        activationStrength: effectiveActivation,
        diagnostics: {
          ...c.diagnostics,
          trustScore: rep.trustScore,
          reputationScaledConfidence: effectiveConfidence,
        },
      });
    }

    return { scaledContributions, vetoed };
  }

  /**
   * Post-transition reputation & credit assignment updates based on consequence engine
   */
  public updateReputations(
    acceptedMechanisms: string[],
    rejectedMechanisms: string[],
    consequence?: ConsequenceEvaluation
  ): void {
    const creditMap: Record<string, CreditAssignment> = {};
    if (consequence?.creditAssignments) {
      for (const ca of consequence.creditAssignments) {
        creditMap[ca.mechanismId] = ca;
      }
    }

    const allIds = new Set([
      ...Object.keys(this.reputations),
      ...acceptedMechanisms,
      ...rejectedMechanisms,
    ]);

    for (const id of allIds) {
      const rep = this.getReputation(id);
      rep.totalContributions++;

      const isAccepted = acceptedMechanisms.includes(id);
      const isRejected = rejectedMechanisms.includes(id);

      if (isAccepted) {
        rep.acceptedCount++;
        rep.consecutiveFailures = 0;

        const credit = creditMap[id];
        if (credit) {
          // Adjust prediction accuracy based on benefit vs blame
          const accuracyDelta = (credit.reward - credit.blame) * 0.05;
          rep.predictionAccuracy = Math.max(0.05, Math.min(1.0, rep.predictionAccuracy + accuracyDelta));
        }

        // Trust recovery for accepted mechanism
        rep.trustScore = Math.min(1.0, rep.trustScore + 0.02);
        if (rep.isSuspended && rep.trustScore > 0.5) {
          rep.isSuspended = false; // Recovered from suspension
        }
      } else if (isRejected) {
        rep.consecutiveFailures++;
        rep.trustScore = Math.max(0.05, rep.trustScore - 0.05);

        // Suspend if 4 consecutive failures or trust < 0.25
        if (rep.consecutiveFailures >= 4 || rep.trustScore < 0.25) {
          rep.isSuspended = true;
        }
        // Retire if total contributions high and success rate < 0.15
        if (rep.totalContributions > 30 && rep.acceptedCount / rep.totalContributions < 0.15) {
          rep.isRetired = true;
        }
      }

      // Recompute overall success/failure rates
      rep.successRate = rep.acceptedCount / Math.max(1, rep.totalContributions);
      rep.failureRate = 1.0 - rep.successRate;
      rep.confidence = Math.max(0.1, rep.trustScore * rep.predictionAccuracy);
    }
  }
}
