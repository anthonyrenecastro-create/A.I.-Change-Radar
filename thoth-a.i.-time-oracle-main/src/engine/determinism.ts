export function createSeededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicId(prefix: string, seed: number, step: number, suffix: string): string {
  return `${prefix}_${seed}_${step}_${stableHash(`${prefix}:${seed}:${step}:${suffix}`).toString(36)}`;
}

export function deterministicTimestamp(seed: number, step = 0): number {
  return ((seed * 1_000_000_007) + (step * 1_000_003)) >>> 0;
}
