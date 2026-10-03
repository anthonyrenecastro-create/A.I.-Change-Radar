/**
 * HRM Ecology Runtime Engine Controller
 * Manages loop execution, deterministic replay, state history, and perturbation triggers.
 */

import {
  HRMWorldState,
  LedgerEntry,
  Contribution,
  PerceptualObservation,
  RuntimeHealthState
} from '../types/hrm';
import { createInitialWorldState, freezeState } from './state';
import { getDefaultMechanisms, Mechanism } from './mechanisms';
import { getAIEcosystemMechanisms } from './aiMechanisms';
import { commitNextState } from './arbitrator';
import { EnvironmentSimulator, SimulationScenario } from './environment';
import { fetchTriPathInteract, getCachedCritique, TriPathOrchestrationResult } from './llmMechanisms';
import { ReputationManager } from './reputation';
import { CognitiveMemoryEngine } from './memory';
import { DynamicCognitiveRouter } from './routing';
import { computeRuntimeHealth } from './health';
import { ScientificValidationTracker, ScientificBenchmarkReport } from './benchmarks';
import { applyAIEcosystemCycle } from './aiEcosystem';

export class HRMEcologyRuntime {
  private currentState: HRMWorldState;
  private stateHistory: HRMWorldState[] = [];
  private ledger: LedgerEntry[] = [];
  private mechanisms: Mechanism[];
  private environment: EnvironmentSimulator;
  private seed: number;
  private isRunning = false;
  private autoRunTimer: any = null;
  private listeners: Array<() => void> = [];

  // Core Substrate Engines
  private reputationManager: ReputationManager;
  private memoryEngine: CognitiveMemoryEngine;
  private router: DynamicCognitiveRouter;
  private benchmarkTracker: ScientificValidationTracker;
  private currentHealth: RuntimeHealthState;

  constructor(seed = 42, numNodes = 12, scenario: SimulationScenario = 'ai_ecosystem') {
    this.seed = seed;
    this.mechanisms = scenario === 'ai_ecosystem'
      ? [...getDefaultMechanisms(), ...getAIEcosystemMechanisms()]
      : getDefaultMechanisms();
    this.environment = new EnvironmentSimulator(scenario, seed);

    this.reputationManager = new ReputationManager(this.mechanisms.map(m => m.id));
    this.memoryEngine = new CognitiveMemoryEngine(seed);
    this.router = new DynamicCognitiveRouter();
    this.benchmarkTracker = new ScientificValidationTracker();

    const initialState = createInitialWorldState(seed, numNodes, scenario === 'ai_ecosystem');
    this.currentState = initialState;
    this.stateHistory = [initialState];
    this.currentHealth = computeRuntimeHealth(initialState, this.reputationManager);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  public getState(): HRMWorldState {
    return this.currentState;
  }

  public getHistory(): HRMWorldState[] {
    return this.stateHistory;
  }

  public getLedger(): LedgerEntry[] {
    return this.ledger;
  }

  public getMechanisms(): Mechanism[] {
    return this.mechanisms;
  }

  public getEnvironment(): EnvironmentSimulator {
    return this.environment;
  }

  public getReputationManager(): ReputationManager {
    return this.reputationManager;
  }

  public getHealth(): RuntimeHealthState {
    return this.currentHealth;
  }

  public getBenchmarkReport(): ScientificBenchmarkReport {
    return this.benchmarkTracker.generateReport();
  }

  /**
   * Executes a single authoritative transition step t -> t+1
   */
  public step(userPrompt?: string): LedgerEntry {
    const readonlySnapshot = freezeState(this.currentState);

    // Extract node positions for environment perception
    const nodePositions: Record<string, { x: number; y: number }> = {};
    for (const nodeId in readonlySnapshot.topology.nodes) {
      nodePositions[nodeId] = readonlySnapshot.topology.nodes[nodeId].position;
    }

    // Step environment simulation
    const observation: PerceptualObservation = this.environment.step(nodePositions);

    // 1. Dynamic Cognitive Routing: Select active mechanisms
    const activeMechanisms = this.router.selectActiveMechanisms(
      readonlySnapshot,
      this.mechanisms,
      this.reputationManager,
      observation
    );

    // 2. Collect proposals/contributions from active mechanisms
    const contributions: Contribution[] = activeMechanisms.map(mech =>
      mech.propose(readonlySnapshot, observation)
    );

    // 3. Sovereign Critique Audit & Singular Commit Arbitration
    const critiqueResult = getCachedCritique();
    const critiqueAudit = critiqueResult ? {
      overallConsistencyScore: critiqueResult.overallConsistencyScore,
      hallucinationRisk: critiqueResult.hallucinationRisk,
      vetoedMechanisms: critiqueResult.vetoedMechanisms || [],
      safetyWarnings: critiqueResult.safetyWarnings || [],
    } : undefined;

    const { nextState, ledgerEntry, consequence } = commitNextState(
      readonlySnapshot,
      contributions,
      this.reputationManager,
      critiqueAudit
    );

    const acceptedMechanismIds = new Set(ledgerEntry.acceptedContributions.map(c => c.mechanismId));
    const acceptedContributions = contributions.filter(c => acceptedMechanismIds.has(c.mechanismId));

    // Preserve HRM authority: only accepted contributions are allowed to evolve ecosystem twins.
    applyAIEcosystemCycle(nextState, acceptedContributions);

    // 4. Memory Consolidation across 4 layers
    nextState.memory = this.memoryEngine.consolidateMemory(
      nextState,
      observation,
      consequence,
      userPrompt
    );

    // 5. Update Self-Monitoring Runtime Health
    this.currentHealth = computeRuntimeHealth(nextState, this.reputationManager, consequence);

    // 6. Record Scientific Benchmark Telemetry
    this.benchmarkTracker.recordStep(ledgerEntry, consequence);

    // Update authoritative state
    this.currentState = nextState;
    this.stateHistory.push(nextState);
    this.ledger.push(ledgerEntry);

    this.notify();
    return ledgerEntry;
  }

  /**
   * Processes a direct natural language directive through Gemini Tri-Path Orchestration
   * and commits the resulting substrate transition.
   */
  public async processUserPrompt(userPrompt: string): Promise<LedgerEntry & { triPath?: TriPathOrchestrationResult }> {
    const readonlySnapshot = freezeState(this.currentState);
    const triPathResult = await fetchTriPathInteract(userPrompt, readonlySnapshot);

    // Apply focus node if requested by reasoning
    if (triPathResult.llmA.cognitiveFocusNodeId && readonlySnapshot.topology.nodes[triPathResult.llmA.cognitiveFocusNodeId]) {
      this.currentState.cognition.attentionFocusNodeId = triPathResult.llmA.cognitiveFocusNodeId;
    }

    // Apply goal orientation if requested
    if (triPathResult.llmA.strategicGoalAdjustment) {
      this.currentState.guidance.activeGoal = triPathResult.llmA.strategicGoalAdjustment;
    }

    // Run transition step passing prompt
    const ledgerEntry = this.step(userPrompt);

    return {
      ...ledgerEntry,
      triPath: triPathResult,
    };
  }

  /**
   * Replays execution from step 0 to target step strictly deterministically using seed without LLM calls
   */
  public replayToStep(targetStep: number): void {
    if (targetStep < 0 || targetStep >= this.stateHistory.length) return;
    this.currentState = this.stateHistory[targetStep];
    this.currentHealth = computeRuntimeHealth(this.currentState, this.reputationManager);
    this.notify();
  }

  public reset(seed = 42, numNodes = 12, scenario?: SimulationScenario): void {
    this.stop();
    this.seed = seed;
    const nextScenario = scenario || 'ai_ecosystem';
    this.environment.reset(nextScenario, seed);

    this.mechanisms = nextScenario === 'ai_ecosystem'
      ? [...getDefaultMechanisms(), ...getAIEcosystemMechanisms()]
      : getDefaultMechanisms();

    this.reputationManager = new ReputationManager(this.mechanisms.map(m => m.id));
    this.memoryEngine = new CognitiveMemoryEngine(seed);
    this.router = new DynamicCognitiveRouter();
    this.benchmarkTracker = new ScientificValidationTracker();

    const initialState = createInitialWorldState(seed, numNodes, nextScenario === 'ai_ecosystem');
    this.currentState = initialState;
    this.stateHistory = [initialState];
    this.ledger = [];
    this.currentHealth = computeRuntimeHealth(this.currentState, this.reputationManager);
    this.notify();
  }

  public start(intervalMs = 800): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.autoRunTimer = setInterval(() => {
      this.step();
    }, intervalMs);
    this.notify();
  }

  public stop(): void {
    if (this.autoRunTimer) {
      clearInterval(this.autoRunTimer);
      this.autoRunTimer = null;
    }
    this.isRunning = false;
    this.notify();
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Manual Perturbation Triggers (Damage, Noise, EMP, Region Split)
   */
  public injectEMPStrike(): void {
    this.environment.setSensorLoss(true);
    this.currentState.stress.globalStress = 0.8;
    this.notify();
  }

  public injectNoiseInflux(): void {
    this.environment.setNoiseLevel(0.4);
    this.notify();
  }

  public injectSeverRegion(regionId: string): void {
    const edges = this.currentState.topology.edges;
    for (const edgeId in edges) {
      const edge = edges[edgeId];
      const srcNode = this.currentState.topology.nodes[edge.source];
      if (srcNode && srcNode.regionId === regionId) {
        edge.active = false;
        edge.conductance = 0.0;
      }
    }
    this.notify();
  }

  public injectSplitNode(nodeId: string): void {
    const node = this.currentState.topology.nodes[nodeId];
    if (node) {
      this.step(); // Trigger a step where geometry adaptation receives high density
    }
  }

  public toggleSafeMode(): void {
    this.currentState.stress.safeModeActive = !this.currentState.stress.safeModeActive;
    this.notify();
  }
}
