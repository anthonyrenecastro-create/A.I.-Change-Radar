/** Cycle-safe dependency graph helpers. Edges mean "workflow depends on dependsOn". */

export interface Edge { workflowId: string; dependsOnWorkflowId: string }

function adjacency(edges: Edge[], direction: 'dependsOn' | 'dependents'): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    const [from, to] = direction === 'dependsOn' ? [e.workflowId, e.dependsOnWorkflowId] : [e.dependsOnWorkflowId, e.workflowId];
    const list = map.get(from) ?? [];
    list.push(to);
    map.set(from, list);
  }
  return map;
}

/** True if adding "workflowId depends on dependsOnId" would create a cycle (including self-dependency). */
export function wouldCreateCycle(edges: Edge[], workflowId: string, dependsOnId: string): boolean {
  if (workflowId === dependsOnId) return true;
  const next = adjacency(edges, 'dependsOn');
  const seen = new Set<string>();
  const stack = [dependsOnId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === workflowId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of next.get(id) ?? []) stack.push(n);
  }
  return false;
}

/** Detects any cycle in existing data (defensive; writes already prevent them). */
export function hasCycle(edges: Edge[]): boolean {
  const next = adjacency(edges, 'dependsOn');
  const state = new Map<string, 1 | 2>();
  for (const start of next.keys()) {
    if (state.has(start)) continue;
    const stack: { id: string; i: number }[] = [{ id: start, i: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const children = next.get(top.id) ?? [];
      if (top.i >= children.length) { state.set(top.id, 2); stack.pop(); continue; }
      const child = children[top.i++];
      const s = state.get(child);
      if (s === 1) return true;
      if (!s) { state.set(child, 1); stack.push({ id: child, i: 0 }); }
    }
  }
  return false;
}

/**
 * Workflows that depend, directly or transitively, on any root.
 * Returns the nearest root that explains the exposure and the hop count. Visits each node once.
 */
export function downstreamOf(edges: Edge[], roots: string[]): Map<string, { via: string; hops: number }> {
  const dependents = adjacency(edges, 'dependents');
  const result = new Map<string, { via: string; hops: number }>();
  const rootSet = new Set(roots);
  const queue: { id: string; hops: number }[] = roots.map(id => ({ id, hops: 0 }));
  const seen = new Set(roots);
  while (queue.length) {
    const { id, hops } = queue.shift()!;
    for (const dep of dependents.get(id) ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      if (!rootSet.has(dep)) result.set(dep, { via: id, hops: hops + 1 });
      queue.push({ id: dep, hops: hops + 1 });
    }
  }
  return result;
}

/** Layer index per node: 0 = depends on nothing; otherwise 1 + deepest dependency. Terminates on cyclic input. */
export function layerIndex(ids: string[], edges: Edge[]): Map<string, number> {
  const next = adjacency(edges.filter(e => ids.includes(e.workflowId) && ids.includes(e.dependsOnWorkflowId)), 'dependsOn');
  const layer = new Map<string, number>(ids.map(id => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const id of ids) {
      for (const dep of next.get(id) ?? []) {
        const want = (layer.get(dep) ?? 0) + 1;
        if (want > (layer.get(id) ?? 0) && want < ids.length) { layer.set(id, want); changed = true; }
      }
    }
    if (!changed) break;
  }
  return layer;
}
