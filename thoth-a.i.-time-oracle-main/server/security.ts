import { createHash, randomBytes, scrypt as scryptCb, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

const LEGACY_SHA256 = /^[0-9a-f]{64}$/;

export interface PasswordCheck { ok: boolean; needsRehash: boolean }

/**
 * Verifies scrypt hashes. Unsalted SHA-256 hex digests from older deployments are accepted only so a
 * successful login can upgrade them; callers must store a fresh scrypt hash when needsRehash is true.
 */
export async function verifyPassword(password: string, stored: string): Promise<PasswordCheck> {
  if (stored.startsWith('scrypt$')) {
    const [, n, r, p, saltB64, keyB64] = stored.split('$');
    const expected = Buffer.from(keyB64, 'base64');
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem });
    const ok = key.length === expected.length && timingSafeEqual(key, expected);
    return { ok, needsRehash: ok && (Number(n) !== PARAMS.N || Number(r) !== PARAMS.r || Number(p) !== PARAMS.p) };
  }
  if (LEGACY_SHA256.test(stored)) {
    const digest = Buffer.from(createHash('sha256').update(password).digest('hex'));
    const ok = timingSafeEqual(digest, Buffer.from(stored));
    return { ok, needsRehash: ok };
  }
  return { ok: false, needsRehash: false };
}

/** Constant-ish work for unknown accounts so response time does not reveal registered emails. */
const DUMMY_HASH = `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${Buffer.alloc(16).toString('base64')}$${scryptSync('x', Buffer.alloc(16), 32, PARAMS).toString('base64')}`;
export async function burnPasswordWork(password: string): Promise<void> { await verifyPassword(password, DUMMY_HASH); }

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 12) return 'Password must be at least 12 characters.';
  if (pw.length > 200) return 'Password is too long.';
  return null;
}

/** Fixed-window failure counter with lockout, keyed by arbitrary strings. */
export class AttemptLimiter {
  private hits = new Map<string, { count: number; first: number }>();
  constructor(private max: number, private windowMs: number, private now: () => number = Date.now) {}

  /** Returns seconds to wait if currently blocked, otherwise 0. */
  blockedFor(key: string): number {
    const h = this.hits.get(key);
    if (!h) return 0;
    if (this.now() - h.first >= this.windowMs) { this.hits.delete(key); return 0; }
    return h.count >= this.max ? Math.ceil((h.first + this.windowMs - this.now()) / 1000) : 0;
  }
  fail(key: string): void {
    const h = this.hits.get(key);
    if (!h || this.now() - h.first >= this.windowMs) this.hits.set(key, { count: 1, first: this.now() });
    else h.count++;
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (this.now() - v.first >= this.windowMs) this.hits.delete(k);
  }
  reset(key: string): void { this.hits.delete(key); }
}
