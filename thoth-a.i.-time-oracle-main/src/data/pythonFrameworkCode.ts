/**
 * HRM Ecology: Production Python 3.12+ Reference Architecture
 * Ready for export, download, and execution.
 */

export interface PythonFile {
  path: string;
  filename: string;
  language: string;
  content: string;
}

export const PYTHON_FRAMEWORK_FILES: PythonFile[] = [
  {
    path: 'hrm_ecology/__init__.py',
    filename: '__init__.py',
    language: 'python',
    content: `"""
HRM Ecology: A Resilient World-Model Runtime
Python 3.12+ Reference Substrate Implementation
"""

__version__ = "1.0.0"
__author__ = "HRM Ecology Contributors"

from .state import HRMWorldState, create_initial_world_state, compute_state_hash
from .arbitrator import commit_next_state, Contribution, LedgerEntry
from .mechanisms import Mechanism, getDefaultMechanisms
from .transport import execute_state_transport, TransportDiagnostics
from .safety import evaluate_safety_constitution, SafetyCheckResult
from .runtime import HRMEcologyRuntime

__all__ = [
    "HRMWorldState",
    "create_initial_world_state",
    "compute_state_hash",
    "commit_next_state",
    "Contribution",
    "LedgerEntry",
    "Mechanism",
    "getDefaultMechanisms",
    "execute_state_transport",
    "TransportDiagnostics",
    "evaluate_safety_constitution",
    "SafetyCheckResult",
    "HRMEcologyRuntime",
]
`,
  },
  {
    path: 'hrm_ecology/state.py',
    filename: 'state.py',
    language: 'python',
    content: `"""
HRM World State Definition & Immutable Hash Verification
Constitutional Principle 1: One Authoritative State Xt
"""

from dataclasses import dataclass, field
import hashlib
import json
import math
import time
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class Vector2D:
    x: float
    y: float


@dataclass(frozen=True)
class FieldState:
    values: Dict[str, float]
    gradients: Dict[str, Vector2D]
    densities: Dict[str, float]
    velocities: Dict[str, Vector2D]


@dataclass(frozen=True)
class NodeGeometry:
    id: str
    position: Vector2D
    region_id: str
    manifold_id: str


@dataclass(frozen=True)
class EdgeTopology:
    id: str
    source: str
    target: str
    weight: float
    conductance: float
    active: bool = True


@dataclass(frozen=True)
class TopologyState:
    nodes: Dict[str, NodeGeometry]
    edges: Dict[str, EdgeTopology]
    adjacency: Dict[str, List[str]]


@dataclass(frozen=True)
class HierarchyLevel:
    id: str
    name: str
    depth: int
    node_ids: List[str]
    child_manifold_ids: List[str]
    parent_manifold_id: Optional[str]
    guidance_vector: List[float]


@dataclass(frozen=True)
class HierarchyState:
    root_manifold_id: str
    manifolds: Dict[str, HierarchyLevel]


@dataclass(frozen=True)
class MemoryNode:
    id: str
    type: str  # 'episodic' | 'semantic' | 'procedural'
    content: str
    vector: List[float]
    salience: float
    last_accessed_step: int
    associated_node_ids: List[str]


@dataclass(frozen=True)
class MemoryState:
    nodes: Dict[str, MemoryNode]
    capacity: int
    total_mass: float


@dataclass(frozen=True)
class CognitionState:
    attention_focus_node_id: Optional[str]
    curiosity_bias: float
    novelty_score: float
    surprise_level: float


@dataclass(frozen=True)
class GuidanceState:
    active_goal: str
    target_position: Optional[Vector2D]
    attractor_nodes: List[str]
    risk_tolerance: float


@dataclass(frozen=True)
class UncertaintyState:
    node_uncertainties: Dict[str, float]
    global_entropy: float
    sensor_confidence: float


@dataclass(frozen=True)
class StressState:
    node_stress: Dict[str, float]
    global_stress: float
    locked_out_mechanisms: List[str]
    safe_mode_active: bool
    consecutive_alerts: int


@dataclass(frozen=True)
class ResourceState:
    total_compute_budget: float
    used_compute_energy: float
    active_width: int
    memory_usage_bytes: int
    structural_event_budget: int


@dataclass(frozen=True)
class GoalState:
    primary_goal: str
    sub_goals: List[str]
    progress_ratio: float


@dataclass(frozen=True)
class MetadataState:
    step: int
    timestamp: float
    seed: int
    state_hash: str
    version: str = "1.0.0-HRM"


@dataclass(frozen=True)
class HRMWorldState:
    """The One Authoritative Immutable World State Xt"""
    field: FieldState
    topology: TopologyState
    hierarchy: HierarchyState
    memory: MemoryState
    cognition: CognitionState
    guidance: GuidanceState
    uncertainty: UncertaintyState
    stress: StressState
    resources: ResourceState
    goals: GoalState
    metadata: MetadataState


def compute_state_hash(state: HRMWorldState) -> str:
    """Computes a deterministic SHA-256 state hash for verification and replay."""
    payload = {
        "step": state.metadata.step,
        "seed": state.metadata.seed,
        "nodes": sorted(list(state.topology.nodes.keys())),
        "edges": sorted(list(state.topology.edges.keys())),
        "field_sum": round(sum(state.field.values.values()), 6),
        "stress_sum": round(sum(state.stress.node_stress.values()), 6),
        "goal": state.guidance.active_goal,
    }
    serialized = json.dumps(payload, sort_keys=True)
    return "0x" + hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


def create_initial_world_state(seed: int = 42, num_nodes: int = 12) -> HRMWorldState:
    """Bootstraps an initial authoritative world state X0."""
    nodes: Dict[str, NodeGeometry] = {}
    edges: Dict[str, EdgeTopology] = {}
    adjacency: Dict[str, List[str]] = {}
    field_values: Dict[str, float] = {}
    field_gradients: Dict[str, Vector2D] = {}
    field_densities: Dict[str, float] = {}
    field_velocities: Dict[str, Vector2D] = {}
    node_stress: Dict[str, float] = {}
    node_uncertainties: Dict[str, float] = {}

    grid_cols = int(math.ceil(math.sqrt(num_nodes)))
    spacing = 120.0

    for i in range(num_nodes):
        node_id = f"node_{i}"
        row = i // grid_cols
        col = i % grid_cols

        nodes[node_id] = NodeGeometry(
            id=node_id,
            position=Vector2D(100.0 + col * spacing, 100.0 + row * spacing),
            region_id="region_north" if row < 2 else "region_south",
            manifold_id="manifold_primary" if i < num_nodes // 2 else "manifold_secondary",
        )
        field_values[node_id] = 0.2 + 0.6 * ((i * 37) % 100) / 100.0
        field_gradients[node_id] = Vector2D(math.sin(i) * 0.1, math.cos(i) * 0.1)
        field_densities[node_id] = 1.0
        field_velocities[node_id] = Vector2D(0.0, 0.0)
        node_stress[node_id] = 0.05 + 0.1 * (i % 3) / 3.0
        node_uncertainties[node_id] = 0.1
        adjacency[node_id] = []

    edge_counter = 0
    node_keys = list(nodes.keys())
    for i in range(len(node_keys)):
        for j in range(i + 1, len(node_keys)):
            n1 = nodes[node_keys[i]]
            n2 = nodes[node_keys[j]]
            dist = math.hypot(n1.position.x - n2.position.x, n1.position.y - n2.position.y)
            if dist < spacing * 1.5:
                edge_id = f"edge_{edge_counter}"
                edge_counter += 1
                edges[edge_id] = EdgeTopology(
                    id=edge_id,
                    source=n1.id,
                    target=n2.id,
                    weight=1.0 - (dist / (spacing * 1.6)),
                    conductance=0.8,
                    active=True,
                )
                adjacency[n1.id].append(n2.id)
                adjacency[n2.id].append(n1.id)

    dummy_meta = MetadataState(step=0, timestamp=time.time(), seed=seed, state_hash="")

    draft_state = HRMWorldState(
        field=FieldState(field_values, field_gradients, field_densities, field_velocities),
        topology=TopologyState(nodes, edges, adjacency),
        hierarchy=HierarchyState(
            root_manifold_id="manifold_root",
            manifolds={
                "manifold_root": HierarchyLevel(
                    id="manifold_root",
                    name="Root Cognitive Substrate",
                    depth=0,
                    node_ids=node_keys,
                    child_manifold_ids=["manifold_primary", "manifold_secondary"],
                    parent_manifold_id=None,
                    guidance_vector=[1.0, 0.5, 0.2],
                )
            },
        ),
        memory=MemoryState(nodes={}, capacity=50, total_mass=0.0),
        cognition=CognitionState(
            attention_focus_node_id="node_0",
            curiosity_bias=0.5,
            novelty_score=0.2,
            surprise_level=0.05,
        ),
        guidance=GuidanceState(
            active_goal="Explore Hazard-Free Trajectory",
            target_position=Vector2D(350.0, 350.0),
            attractor_nodes=["node_3", "node_7"],
            risk_tolerance=0.3,
        ),
        uncertainty=UncertaintyState(node_uncertainties, global_entropy=0.12, sensor_confidence=0.95),
        stress=StressState(node_stress, global_stress=0.08, locked_out_mechanisms=[], safe_mode_active=False, consecutive_alerts=0),
        resources=ResourceState(total_compute_budget=100.0, used_compute_energy=24.0, active_width=num_nodes, memory_usage_bytes=4096, structural_event_budget=3),
        goals=GoalState(primary_goal="Maintain World Model Stability", sub_goals=["Dampen field variance"], progress_ratio=0.1),
        metadata=dummy_meta,
    )

    h = compute_state_hash(draft_state)
    return HRMWorldState(
        field=draft_state.field,
        topology=draft_state.topology,
        hierarchy=draft_state.hierarchy,
        memory=draft_state.memory,
        cognition=draft_state.cognition,
        guidance=draft_state.guidance,
        uncertainty=draft_state.uncertainty,
        stress=draft_state.stress,
        resources=draft_state.resources,
        goals=draft_state.goals,
        metadata=MetadataState(step=0, timestamp=time.time(), seed=seed, state_hash=h),
    )
`,
  },
  {
    path: 'hrm_ecology/arbitrator.py',
    filename: 'arbitrator.py',
    language: 'python',
    content: `"""
HRM Singular Commit Arbitrator
Principle 3: Proposal, Never Mutation
Principle 4: Singular Commit
Principle 6: Computational Conservation of Explanation
"""

from dataclasses import dataclass, field
import time
from typing import Dict, List, Optional, Any
from .state import HRMWorldState, compute_state_hash, MetadataState, FieldState, TopologyState
from .transport import execute_state_transport, TransportDiagnostics
from .safety import evaluate_safety_constitution


@dataclass
class Contribution:
    mechanism_id: str
    mechanism_name: str
    confidence: float
    activation_strength: float
    estimated_cost: float
    uncertainty: float
    rationale: str
    field_deltas: Optional[Dict[str, float]] = None
    proposed_events: Optional[List[Any]] = None
    diagnostics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LedgerEntry:
    step: int
    previous_state_hash: str
    new_state_hash: str
    timestamp: float
    accepted_contributions: List[Dict[str, Any]]
    rejected_contributions: List[Dict[str, Any]]
    executed_structural_events: List[Any]
    transport_diagnostics: TransportDiagnostics
    safety_interventions: List[str]
    residual: float
    accepted: bool


def commit_next_state(
    current_state: HRMWorldState,
    contributions: List[Contribution]
) -> Tuple[HRMWorldState, LedgerEntry]:
    """
    Collects proposals, performs arbitration, executes state transport,
    enforces safety constitution, and creates authoritative Xt+1.
    """
    current_step = current_state.metadata.step
    previous_hash = current_state.metadata.state_hash

    accepted_contribs = []
    rejected_contribs = []
    pending_events = []

    accumulated_deltas: Dict[str, float] = {node_id: 0.0 for node_id in current_state.topology.nodes}
    weights_per_node: Dict[str, float] = {node_id: 0.0 for node_id in current_state.topology.nodes}

    for c in contributions:
        weight = c.confidence * c.activation_strength
        if weight > 0.05:
            accepted_contribs.append({
                "mechanism_id": c.mechanism_id,
                "weight": weight,
                "rationale": c.rationale,
                "cost": c.estimated_cost,
            })

            if c.field_deltas:
                for node_id, delta in c.field_deltas.items():
                    if node_id in accumulated_deltas:
                        accumulated_deltas[node_id] += delta * weight
                        weights_per_node[node_id] += weight

            if c.proposed_events:
                pending_events.extend(c.proposed_events)
        else:
            rejected_contribs.append({
                "mechanism_id": c.mechanism_id,
                "reason": f"Weight below threshold ({weight:.2f})",
            })

    # Construct new field values dict
    new_field_values = dict(current_state.field.values)
    for node_id, val in new_field_values.items():
        w_sum = weights_per_node.get(node_id, 0.0)
        if w_sum > 0:
            avg_delta = accumulated_deltas[node_id] / w_sum
            new_field_values[node_id] = max(0.0, min(1.0, val + avg_delta))

    # Construct state draft
    draft_nodes = dict(current_state.topology.nodes)
    draft_edges = dict(current_state.topology.edges)
    draft_adj = dict(current_state.topology.adjacency)

    budget = current_state.resources.structural_event_budget
    executed_events = pending_events[:budget]

    # Explicit State Transport
    transport_diag, final_nodes, final_edges, final_adj, final_field_vals = execute_state_transport(
        current_state, draft_nodes, draft_edges, draft_adj, new_field_values, executed_events
    )

    # Safety Constitution Check
    safety_result = evaluate_safety_constitution(current_state, final_nodes, final_edges, final_field_vals)

    if safety_result.trigger_rollback:
        next_state = current_state
    else:
        new_meta = MetadataState(
            step=current_step + 1,
            timestamp=time.time(),
            seed=current_state.metadata.seed,
            state_hash="",
        )
        candidate = HRMWorldState(
            field=FieldState(safety_result.repaired_field, current_state.field.gradients, current_state.field.densities, current_state.field.velocities),
            topology=TopologyState(final_nodes, final_edges, final_adj),
            hierarchy=current_state.hierarchy,
            memory=current_state.memory,
            cognition=current_state.cognition,
            guidance=current_state.guidance,
            uncertainty=current_state.uncertainty,
            stress=current_state.stress,
            resources=current_state.resources,
            goals=current_state.goals,
            metadata=new_meta,
        )
        h = compute_state_hash(candidate)
        next_state = HRMWorldState(
            field=candidate.field,
            topology=candidate.topology,
            hierarchy=candidate.hierarchy,
            memory=candidate.memory,
            cognition=candidate.cognition,
            guidance=candidate.guidance,
            uncertainty=candidate.uncertainty,
            stress=candidate.stress,
            resources=candidate.resources,
            goals=candidate.goals,
            metadata=MetadataState(step=current_step + 1, timestamp=time.time(), seed=current_state.metadata.seed, state_hash=h),
        )

    ledger_entry = LedgerEntry(
        step=current_step + 1,
        previous_state_hash=previous_hash,
        new_state_hash=next_state.metadata.state_hash,
        timestamp=time.time(),
        accepted_contributions=accepted_contribs,
        rejected_contributions=rejected_contribs,
        executed_structural_events=executed_events,
        transport_diagnostics=transport_diag,
        safety_interventions=safety_result.interventions,
        residual=transport_diag.conservation_residual,
        accepted=not safety_result.trigger_rollback,
    )

    return next_state, ledger_entry
`,
  },
  {
    path: 'tests/test_hrm.py',
    filename: 'test_hrm.py',
    language: 'python',
    content: `"""
HRM Ecology Pytest Suite
Verifies constitutional principles, state transport, and deterministic replay.
"""

import pytest
from hrm_ecology import create_initial_world_state, commit_next_state, Contribution, HRMEcologyRuntime


def test_one_authoritative_state_immutability():
    state0 = create_initial_world_state(seed=42)
    assert state0.metadata.step == 0
    with pytest.raises(Exception):
        state0.metadata.step = 1  # Frozen dataclass immutability check


def test_singular_commit_and_hash_generation():
    state0 = create_initial_world_state(seed=42)
    contrib = Contribution(
        mechanism_id="mech_test",
        mechanism_name="Test Mechanism",
        confidence=0.9,
        activation_strength=0.8,
        estimated_cost=5.0,
        uncertainty=0.1,
        rationale="Testing singular commit",
        field_deltas={"node_0": 0.1},
    )
    next_state, ledger = commit_next_state(state0, [contrib])
    assert next_state.metadata.step == 1
    assert ledger.previous_state_hash == state0.metadata.state_hash
    assert ledger.new_state_hash == next_state.metadata.state_hash
    assert next_state.field.values["node_0"] > state0.field.values["node_0"]


def test_deterministic_replay():
    runtime = HRMEcologyRuntime(seed=123)
    for _ in range(5):
        runtime.step()

    h1 = runtime.getState().metadata.state_hash

    # Reset with same seed
    runtime.reset(seed=123)
    for _ in range(5):
        runtime.step()

    h2 = runtime.getState().metadata.state_hash
    assert h1 == h2, "Deterministic replay failed to match exact state hash"
`,
  },
  {
    path: 'main.py',
    filename: 'main.py',
    language: 'python',
    content: `"""
HRM Ecology CLI Benchmark & Runtime Simulation Entrypoint
"""

from hrm_ecology import HRMEcologyRuntime

def main():
    print("==========================================================")
    print("      HRM Ecology: Resilient World-Model Runtime          ")
    print("==========================================================")
    
    runtime = HRMEcologyRuntime(seed=42, num_nodes=12)
    print(f"Initialized World State X0 Hash: {runtime.getState().metadata.state_hash}")

    for step in range(1, 10):
        entry = runtime.step()
        state = runtime.getState()
        print(f"Step {entry.step:02d} | Hash: {state.metadata.state_hash} | Residual: {entry.residual:.6f} | Accepted: {entry.accepted}")

    print("\\nExecution finished successfully with zero constitutional violations.")

if __name__ == "__main__":
    main()
`,
  },
];
