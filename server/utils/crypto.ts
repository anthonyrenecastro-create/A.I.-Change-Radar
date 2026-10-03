import crypto from 'node:crypto';

/**
 * Deep-freeze an object and all nested properties to prevent accidental mutation of snapshots.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    for (const item of obj) {
      deepFreeze(item);
    }
    return Object.freeze(obj) as unknown as Readonly<T>;
  }

  // Handle Objects
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

/**
 * Deterministically serialize any object into canonical JSON with sorted object keys.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ':' + canonicalJson(val);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Compute cryptographic SHA-256 hash of canonical JSON representation.
 */
export function canonicalHash(obj: unknown): string {
  const canonical = canonicalJson(obj);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Simple SHA-256 helper for string/buffer.
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Deterministic or random ID generator.
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
