/**
 * Dynamic Cognitive Routing Layer
 * Priority 7: Selects active mechanisms per step based on uncertainty, goal alignment,
 * available resources, environmental novelty, and historical reputation.
 */

import { HRMWorldState, PerceptualObservation } from '../types/hrm';
import { Mechanism } from './mechanisms';
import { ReputationManager } from './reputation';

export class DynamicCognitiveRouter {
  public selectActiveMechanisms(
    state: Readonly<HRMWorldState>,
    allMechanisms: Mechanism[],
    reputationManager: ReputationManager,
    observation?: PerceptualObservation
  ): Mechanism[] {
    const activeMechanisms: Mechanism[] = [];

    const globalStress = state.stress.globalStress;
    const globalEntropy = state.uncertainty.globalEntropy;
    const availableBudget = state.resources.totalComputeBudget - state.resources.usedComputeEnergy;

    for (const mech of allMechanisms) {
      const rep = reputationManager.getReputation(mech.id);

      // Rule 1: Skip retired or suspended mechanisms
      if (rep.isRetired || rep.isSuspended) continue;

      // Rule 2: Always invoke core LLM reasoning & critique if available
      if (mech.id.startsWith('mech_llm_') || mech.id === 'mech_tools_action') {
        activeMechanisms.push(mech);
        continue;
      }

      // Rule 3: Stress Regulation mechanism triggers when global stress > 0.05
      if (mech.id === 'mech_stress_regulation' && globalStress > 0.05) {
        activeMechanisms.push(mech);
        continue;
      }

      // Rule 4: Diffusion & Transport trigger when entropy > 0.08 or active field gradients exist
      if ((mech.id === 'mech_diffusion' || mech.id === 'mech_transport') && globalEntropy > 0.08) {
        activeMechanisms.push(mech);
        continue;
      }

      // Rule 5: Prediction Error Correction triggers on sensor observations
      if (mech.id === 'mech_prediction_error' && observation) {
        activeMechanisms.push(mech);
        continue;
      }

      // Rule 6: Geometry & Hierarchy adaptation triggers on high stress or structural needs
      if ((mech.id === 'mech_geometry' || mech.id === 'mech_hierarchy') && (globalStress > 0.15 || availableBudget > 20)) {
        activeMechanisms.push(mech);
        continue;
      }

      // Fallback: If trust score is high (>0.7) and budget allows, include
      if (rep.trustScore > 0.7 && availableBudget > 15) {
        activeMechanisms.push(mech);
      }
    }

    return activeMechanisms;
  }
}
