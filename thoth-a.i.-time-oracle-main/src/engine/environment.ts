/**
 * HRM Ecology: Environmental Dynamics Simulator
 * Generates dynamic perceptual observations and environmental perturbations
 */

import { PerceptualObservation, Vector2D } from '../types/hrm';
import { createSeededRandom } from './determinism';

export type SimulationScenario = 'planetary_rover' | 'digital_twin' | 'embodied_cognition' | 'ai_ecosystem';

export interface EnvironmentEntity {
  id: string;
  type: 'hazard' | 'target' | 'obstacle';
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
}

export class EnvironmentSimulator {
  private scenario: SimulationScenario;
  private seed: number;
  private random: () => number;
  private entities: EnvironmentEntity[] = [];
  private sensorLoss = false;
  private noiseLevel = 0.05;
  private stepCount = 0;

  constructor(scenario: SimulationScenario = 'planetary_rover', seed = 42) {
    this.scenario = scenario;
    this.seed = seed;
    this.random = createSeededRandom(seed);
    this.reset();
  }

  public reset(scenario?: SimulationScenario, seed?: number): void {
    if (scenario) this.scenario = scenario;
    if (seed !== undefined) this.seed = seed;
    this.random = createSeededRandom(this.seed);
    this.stepCount = 0;
    this.sensorLoss = false;
    this.noiseLevel = 0.05;

    this.entities = this.scenario === 'ai_ecosystem'
      ? [
        {
          id: 'signal_research_breakthrough',
          type: 'target',
          position: { x: 360, y: 330 },
          velocity: { x: -0.35, y: 0.15 },
          radius: 16,
        },
        {
          id: 'constraint_supply_chain',
          type: 'hazard',
          position: { x: 210, y: 220 },
          velocity: { x: 0.5, y: -0.2 },
          radius: 24,
        },
        {
          id: 'constraint_regulatory_friction',
          type: 'obstacle',
          position: { x: 180, y: 300 },
          velocity: { x: 0, y: 0 },
          radius: 30,
        },
      ]
      : [
      {
        id: 'target_alpha',
        type: 'target',
        position: { x: 380, y: 350 },
        velocity: { x: -0.5, y: 0.2 },
        radius: 18,
      },
      {
        id: 'hazard_radiation',
        type: 'hazard',
        position: { x: 220, y: 180 },
        velocity: { x: 0.8, y: -0.4 },
        radius: 25,
      },
      {
        id: 'obstacle_crater',
        type: 'obstacle',
        position: { x: 160, y: 310 },
        velocity: { x: 0, y: 0 },
        radius: 30,
      },
    ];
  }

  public setSensorLoss(loss: boolean): void {
    this.sensorLoss = loss;
  }

  public setNoiseLevel(level: number): void {
    this.noiseLevel = Math.max(0, Math.min(1.0, level));
  }

  public step(nodePositions: Record<string, Vector2D>): PerceptualObservation {
    this.stepCount++;

    // Update entity positions (moving objects & dynamic obstacles)
    for (const ent of this.entities) {
      if (ent.type !== 'obstacle') {
        ent.position.x += ent.velocity.x;
        ent.position.y += ent.velocity.y;

        // Bounce off bounds
        if (ent.position.x < 50 || ent.position.x > 500) ent.velocity.x *= -1;
        if (ent.position.y < 50 || ent.position.y > 450) ent.velocity.y *= -1;
      }
    }

    // Generate observations for nodes based on proximity to target/hazard entities
    const sensedNodes: PerceptualObservation['sensedNodes'] = {};

    for (const nodeId in nodePositions) {
      const pos = nodePositions[nodeId];

      let nodeFieldValue = 0.3; // Default baseline

      for (const ent of this.entities) {
        const dist = Math.hypot(pos.x - ent.position.x, pos.y - ent.position.y);
        if (dist < 120) {
          const proximityFactor = (1.0 - dist / 120);
          if (ent.type === 'target') {
            nodeFieldValue += 0.5 * proximityFactor;
          } else if (ent.type === 'hazard') {
            nodeFieldValue -= 0.4 * proximityFactor;
          }
        }
      }

      // Add Gaussian sensor noise using a deterministic seeded generator for replay fidelity.
      const noisyValue = Math.max(0, Math.min(1.0, nodeFieldValue + (this.random() - 0.5) * this.noiseLevel));

      sensedNodes[nodeId] = {
        value: noisyValue,
        noise: this.noiseLevel,
      };
    }

    return {
      step: this.stepCount,
      sensedNodes,
      movingEntities: this.entities.map(e => ({
        id: e.id,
        position: { ...e.position },
        type: e.type,
      })),
      sensorLoss: this.sensorLoss,
      globalScarcityMultiplier: this.stepCount % 50 > 35 ? 0.6 : 1.0,
    };
  }

  public getEntities(): EnvironmentEntity[] {
    return this.entities;
  }
}
