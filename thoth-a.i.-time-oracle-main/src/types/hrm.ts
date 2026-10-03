/**
 * HRM Ecology: A Resilient World-Model Runtime
 * Core Type Definitions & Interfaces
 */

import { AIEcosystemState } from './aiEcosystem';

export interface Vector2D {
  x: number;
  y: number;
}

export type NodeId = string;
export type EdgeId = string;
export type RegionId = string;
export type ManifoldId = string;

export interface FieldState {
  values: Record<NodeId, number>;      // Node continuous scalar field [0, 1]
  gradients: Record<NodeId, Vector2D>; // Field spatial gradients
  densities: Record<NodeId, number>;   // Field density distribution
  velocities: Record<NodeId, Vector2D>; // Vector flow field
}

export interface NodeGeometry {
  id: NodeId;
  position: Vector2D;
  regionId: RegionId;
  manifoldId: ManifoldId;
}

export interface EdgeTopology {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  weight: number;
  conductance: number; // Conductance for diffusion/transport
  active: boolean;
}

export interface TopologyState {
  nodes: Record<NodeId, NodeGeometry>;
  edges: Record<EdgeId, EdgeTopology>;
  adjacency: Record<NodeId, NodeId[]>;
}

export interface HierarchyLevel {
  id: ManifoldId;
  name: string;
  depth: number;
  nodeIds: NodeId[];
  childManifoldIds: ManifoldId[];
  parentManifoldId: ManifoldId | null;
  guidanceVector: number[];
}

export interface HierarchyState {
  rootManifoldId: ManifoldId;
  manifolds: Record<ManifoldId, HierarchyLevel>;
}

export interface MemoryNode {
  id: string;
  type: 'working' | 'episodic' | 'semantic' | 'procedural';
  content: string;
  vector: number[];
  salience: number; // [0, 1]
  lastAccessedStep: number;
  associatedNodeIds: NodeId[];
  expiresAtStep?: number; // Auto-expiration for working memory
  usefulnessScore?: number; // Procedural memory workflow quality
}

export interface MemoryState {
  nodes: Record<string, MemoryNode>;
  workingMemory: {
    activeObservations: string[];
    activeHypotheses: Array<{ id: string; description: string; confidence: number }>;
    attentionFocusNodeId: NodeId | null;
    unresolvedConflicts: string[];
    temporaryPlans: string[];
  };
  capacity: number;
  totalMass: number;
}

export interface MechanismReputation {
  mechanismId: string;
  successRate: number; // [0, 1]
  failureRate: number; // [0, 1]
  confidence: number;  // [0, 1]
  hallucinationHistory: number[]; // Recent hallucination risk scores
  predictionAccuracy: number; // [0, 1]
  resourceEfficiency: number; // [0, 1]
  trustScore: number; // [0, 1]
  totalContributions: number;
  acceptedCount: number;
  vetoedCount: number;
  consecutiveFailures: number;
  isSuspended: boolean;
  isRetired: boolean;
}

export interface CreditAssignment {
  mechanismId: string;
  predictedBenefit: number;
  actualBenefit: number;
  confidenceAdjustment: number;
  futurePriority: number;
  blame: number;  // [0, 1]
  reward: number; // [0, 1]
}

export interface ConsequenceEvaluation {
  predictionError: number; // ||predicted_state - actual_state||
  goalProgressDelta: number;
  resourceCostActual: number;
  unexpectedEventsCount: number;
  causalConfidence: number; // [0, 1]
  creditAssignments: CreditAssignment[];
}

export interface RuntimeHealthState {
  coherence: number;          // [0, 1]
  globalEntropy: number;      // [0, 1]
  predictionAccuracy: number; // [0, 1]
  memoryUtilization: number;  // [0, 1]
  mechanismDiversity: number; // [0, 1]
  topologyHealth: number;     // [0, 1]
  resourceEfficiency: number; // [0, 1]
  reasoningStability: number; // [0, 1]
  learningRate: number;       // [0, 1]
  goalConvergence: number;    // [0, 1]
}

export interface CognitionState {
  attentionFocusNodeId: NodeId | null;
  curiosityBias: number;
  noveltyScore: number;
  surpriseLevel: number;
  activeHypotheses: Array<{ id: string; description: string; confidence: number }>;
}

export interface GuidanceState {
  activeGoal: string;
  targetPosition: Vector2D | null;
  attractorNodes: NodeId[];
  riskTolerance: number; // [0, 1]
}

export interface UncertaintyState {
  nodeUncertainties: Record<NodeId, number>; // Local variance / estimation error
  globalEntropy: number;
  sensorConfidence: number; // [0, 1]
}

export interface StressState {
  nodeStress: Record<NodeId, number>; // Local stress / field tension
  globalStress: number;
  lockedOutMechanisms: string[];
  safeModeActive: boolean;
  consecutiveAlerts: number;
}

export interface ResourceState {
  totalComputeBudget: number;
  usedComputeEnergy: number;
  activeWidth: number; // Computed active node count
  memoryUsageBytes: number;
  structuralEventBudget: number;
}

export interface GoalState {
  primaryGoal: string;
  subGoals: string[];
  progressRatio: number; // [0, 1]
}

export interface MetadataState {
  step: number;
  timestamp: number;
  seed: number;
  stateHash: string;
  version: string;
}

/**
 * The One Authoritative Immutable World State Xt
 */
export interface HRMWorldState {
  field: FieldState;
  topology: TopologyState;
  hierarchy: HierarchyState;
  memory: MemoryState;
  cognition: CognitionState;
  guidance: GuidanceState;
  uncertainty: UncertaintyState;
  stress: StressState;
  resources: ResourceState;
  goals: GoalState;
  aiEcosystem?: AIEcosystemState;
  metadata: MetadataState;
}

/**
 * Structural Events for Substrate Adaptation
 */
export type StructuralEventType =
  | 'AddNode'
  | 'RemoveNode'
  | 'AddEdge'
  | 'RemoveEdge'
  | 'SplitRegion'
  | 'MergeRegion'
  | 'ActivateChannel'
  | 'DeactivateChannel'
  | 'CreateChildManifold'
  | 'PruneChildManifold'
  | 'EdgeHealing'
  | 'TopologyRepair';

export interface StructuralEvent {
  id: string;
  type: StructuralEventType;
  targetIds: string[];
  parameters: Record<string, unknown>;
  reason: string;
}

export interface SelfEvolutionProposal {
  type: 'ParameterAdjustment' | 'RoutingPolicyChange' | 'TopologyMutation' | 'MechanismRegistration' | 'MechanismRetirement';
  targetMechanismId?: string;
  parameters?: Record<string, unknown>;
  reason: string;
}

/**
 * Mechanism Proposal (Contribution)
 */
export interface Contribution {
  mechanismId: string;
  mechanismName: string;
  confidence: number;       // [0, 1]
  activationStrength: number; // [0, 1]
  estimatedCost: number;     // Compute units
  uncertainty: number;       // [0, 1]
  rationale: string;
  fieldDeltas?: Record<NodeId, number>;
  proposedEvents?: StructuralEvent[];
  guidanceAdjustments?: Partial<GuidanceState>;
  resourceAdjustments?: Partial<ResourceState>;
  memoryModifications?: Partial<MemoryState>;
  predictedFieldValues?: Record<NodeId, number>; // Predicted node values at t+1 for consequence evaluation
  predictedGoalProgress?: number;
  selfEvolutionProposals?: SelfEvolutionProposal[];
  diagnostics: Record<string, unknown>;
}

/**
 * Explicit State Transport Diagnostics
 */
export interface TransportDiagnostics {
  transportedMass: number;
  introducedMass: number;
  lostMass: number;
  continuityError: number;
  conservationResidual: number;
  unmappedReferences: string[];
  passedConservationCheck: boolean;
}

/**
 * Computational Conservation of Explanation Ledger Entry
 */
export interface LedgerEntry {
  step: number;
  previousStateHash: string;
  newStateHash: string;
  timestamp: number;
  acceptedContributions: Array<{
    mechanismId: string;
    weight: number;
    rationale: string;
    cost: number;
  }>;
  rejectedContributions: Array<{
    mechanismId: string;
    reason: string;
  }>;
  executedStructuralEvents: StructuralEvent[];
  transportDiagnostics: TransportDiagnostics;
  safetyInterventions: string[];
  residual: number;
  accepted: boolean;
  consequenceEvaluation?: ConsequenceEvaluation;
  critiqueAudit?: {
    overallConsistencyScore: number;
    hallucinationRisk: number;
    vetoedMechanisms: string[];
    safetyWarnings: string[];
  };
  creditAssignments?: CreditAssignment[];
}

/**
 * Simulated Environment Input (Perceptual Observation)
 */
export interface PerceptualObservation {
  step: number;
  sensedNodes: Record<NodeId, { value: number; noise: number }>;
  movingEntities: Array<{ id: string; position: Vector2D; type: 'hazard' | 'target' | 'obstacle' }>;
  sensorLoss: boolean;
  environmentalDamageRegion?: RegionId;
  globalScarcityMultiplier: number;
}
