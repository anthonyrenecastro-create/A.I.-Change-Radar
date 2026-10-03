import { Router, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { entitlementSummary, ROLES, SIGNUP_DEFAULTS, type Entitlements, type Role } from './commercial';
import { burnPasswordWork, AttemptLimiter, hashPassword, newToken, tokenHash, validatePasswordStrength, verifyPassword } from './security';
import { ctxOf, HttpError, nowIso, requireRole, type Ctx, type Deps } from './http';

const COOKIE = 'nav_session';
const SESSION_MS = 7 * 24 * 3600 * 1000;
export const DISABLED_HASH = 'disabled';

const credentials = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function entitlementsFor(deps: Deps, tenantId: string): Entitlements {
  const r = deps.db.prepare('SELECT monitoring_plan, navigator_plan, radar_linked FROM entitlements WHERE tenant_id = ?').get(tenantId) as { monitoring_plan: Entitlements['monitoringPlan']; navigator_plan: Entitlements['navigatorPlan']; radar_linked: number } | undefined;
  return r ? { monitoringPlan: r.monitoring_plan, navigatorPlan: r.navigator_plan, radarLinked: r.radar_linked === 1 } : { monitoringPlan: 'none', navigatorPlan: 'none', radarLinked: false };
}

/** Attaches req.ctx when a valid session cookie is present. */
export function sessionMiddleware(deps: Deps) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) {
      const row = deps.db.prepare(`SELECT s.expires_at, u.id AS user_id, u.email, u.role, u.tenant_id, t.is_demo
        FROM sessions s JOIN users u ON u.id = s.user_id JOIN tenants t ON t.id = u.tenant_id WHERE s.token_hash = ?`).get(tokenHash(token)) as
        { expires_at: string; user_id: string; email: string; role: Role; tenant_id: string; is_demo: number } | undefined;
      if (row && row.expires_at > nowIso()) {
        req.ctx = { userId: row.user_id, email: row.email, role: row.role, tenantId: row.tenant_id, isDemo: row.is_demo === 1, entitlements: entitlementsFor(deps, row.tenant_id) };
      } else if (row) deps.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
    }
    next();
  };
}

/** CSRF defence in depth: SameSite=Lax cookie, JSON-only mutations, and same-origin check when Origin is sent. */
export function mutationGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* invalid */ }
    if (host !== req.headers.host) throw new HttpError(403, 'Cross-origin request rejected', 'bad_origin');
  }
  if (req.headers['content-length'] !== '0' && req.headers['content-length'] !== undefined && !req.is('application/json')) throw new HttpError(415, 'JSON body required', 'unsupported_media_type');
  next();
}

export const requireSession = (req: Request, _res: Response, next: NextFunction) => { ctxOf(req); next(); };

export function authRouter(deps: Deps): Router {
  const r = Router();
  const { db, config } = deps;
  const loginByEmail = new AttemptLimiter(5, 15 * 60_000);
  const loginByIp = new AttemptLimiter(30, 15 * 60_000);
  const registerByIp = new AttemptLimiter(10, 60 * 60_000);
  const tooMany = (secs: number) => { throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(secs / 60)} minute(s).`, 'rate_limited'); };

  const startSession = (res: Response, userId: string, tenantId: string) => {
    const token = newToken();
    db.prepare('INSERT INTO sessions (token_hash, user_id, tenant_id, created_at, expires_at) VALUES (?,?,?,?,?)')
      .run(tokenHash(token), userId, tenantId, nowIso(), new Date(Date.now() + SESSION_MS).toISOString());
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: SESSION_MS, path: '/' });
  };

  const me = (c: Ctx) => ({
    user: { id: c.userId, email: c.email, role: c.role },
    tenant: { id: c.tenantId, isDemo: c.isDemo, name: (db.prepare('SELECT name FROM tenants WHERE id = ?').get(c.tenantId) as { name: string }).name },
    entitlements: entitlementSummary(c.entitlements),
    publicDemoEnabled: config.allowPublicDemo,
  });

  r.get('/me', (req, res) => {
    if (!req.ctx) return res.json({ user: null, publicDemoEnabled: config.allowPublicDemo });
    res.json(me(req.ctx));
  });

  r.post('/register', async (req, res) => {
    const ip = req.ip ?? 'unknown';
    const wait = registerByIp.blockedFor(ip);
    if (wait) tooMany(wait);
    registerByIp.fail(ip);
    const body = credentials.extend({ organization: z.string().trim().min(1).max(120) }).parse(req.body);
    const weak = validatePasswordStrength(body.password);
    if (weak) throw new HttpError(422, weak, 'weak_password');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email)) {
      await burnPasswordWork(body.password);
      throw new HttpError(409, 'An account with this email already exists', 'email_taken');
    }
    const tenantId = randomUUID();
    const userId = randomUUID();
    const hash = await hashPassword(body.password);
    const now = nowIso();
    db.transaction(() => {
      db.prepare('INSERT INTO tenants (id, name, is_demo, created_at) VALUES (?,?,0,?)').run(tenantId, body.organization, now);
      // The creator of a tenant is its owner. Roles are never derived from the email address.
      db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, role, created_at, password_updated_at) VALUES (?,?,?,?,?,?,?)').run(userId, tenantId, body.email, hash, 'owner', now, now);
      db.prepare('INSERT INTO entitlements (tenant_id, monitoring_plan, navigator_plan, radar_linked, updated_at) VALUES (?,?,?,?,?)')
        .run(tenantId, SIGNUP_DEFAULTS.monitoring, SIGNUP_DEFAULTS.navigator, SIGNUP_DEFAULTS.radarLinked ? 1 : 0, now);
    })();
    startSession(res, userId, tenantId);
    const ctx: Ctx = { userId, email: body.email, tenantId, role: 'owner', isDemo: false, entitlements: entitlementsFor(deps, tenantId) };
    res.status(201).json(me(ctx));
  });

  r.post('/login', async (req, res) => {
    const ip = req.ip ?? 'unknown';
    const body = credentials.parse(req.body);
    const wait = Math.max(loginByEmail.blockedFor(body.email), loginByIp.blockedFor(ip));
    if (wait) tooMany(wait);
    const user = db.prepare('SELECT id, tenant_id, password_hash FROM users WHERE email = ?').get(body.email) as { id: string; tenant_id: string; password_hash: string } | undefined;
    const check = user ? await verifyPassword(body.password, user.password_hash) : (await burnPasswordWork(body.password), { ok: false, needsRehash: false });
    if (!user || !check.ok) {
      loginByEmail.fail(body.email); loginByIp.fail(ip);
      throw new HttpError(401, 'Incorrect email or password', 'invalid_credentials');
    }
    loginByEmail.reset(body.email);
    if (check.needsRehash) db.prepare('UPDATE users SET password_hash = ?, password_updated_at = ? WHERE id = ?').run(await hashPassword(body.password), nowIso(), user.id);
    startSession(res, user.id, user.tenant_id);
    const c = db.prepare('SELECT u.id, u.email, u.role, u.tenant_id, t.is_demo FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ?').get(user.id) as { id: string; email: string; role: Role; tenant_id: string; is_demo: number };
    res.json(me({ userId: c.id, email: c.email, role: c.role, tenantId: c.tenant_id, isDemo: c.is_demo === 1, entitlements: entitlementsFor(deps, c.tenant_id) }));
  });

  r.post('/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  r.post('/password', requireSession, async (req, res) => {
    const c = ctxOf(req);
    if (c.isDemo) throw new HttpError(403, 'Demo accounts cannot change passwords', 'forbidden');
    const body = z.object({ currentPassword: z.string().max(200), newPassword: z.string().max(200) }).parse(req.body);
    const weak = validatePasswordStrength(body.newPassword);
    if (weak) throw new HttpError(422, weak, 'weak_password');
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(c.userId) as { password_hash: string };
    if (!(await verifyPassword(body.currentPassword, u.password_hash)).ok) throw new HttpError(401, 'Current password is incorrect', 'invalid_credentials');
    db.prepare('UPDATE users SET password_hash = ?, password_updated_at = ? WHERE id = ?').run(await hashPassword(body.newPassword), nowIso(), c.userId);
    // End other sessions after a password change.
    const token = parseCookies(req.headers.cookie)[COOKIE];
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(c.userId, tokenHash(token ?? ''));
    res.json({ ok: true });
  });

  r.post('/demo-session', (req, res) => {
    if (!config.allowPublicDemo) throw new HttpError(404, 'Not found', 'not_found');
    // In production the public demo is strictly read-only; in development it is fully writable but isolated to the demo tenant.
    const email = config.production ? 'demo-viewer@demo.invalid' : 'demo-owner@demo.invalid';
    const u = db.prepare('SELECT id, tenant_id FROM users WHERE email = ?').get(email) as { id: string; tenant_id: string } | undefined;
    if (!u) throw new HttpError(503, 'Demo data has not been seeded', 'demo_unavailable');
    startSession(res, u.id, u.tenant_id);
    const c = db.prepare('SELECT u.id, u.email, u.role, u.tenant_id FROM users u WHERE u.id = ?').get(u.id) as { id: string; email: string; role: Role; tenant_id: string };
    res.json(me({ userId: c.id, email: c.email, role: c.role, tenantId: c.tenant_id, isDemo: true, entitlements: entitlementsFor(deps, c.tenant_id) }));
  });

  return r;
}

export function teamRouter(deps: Deps): Router {
  const r = Router();
  r.get('/members', requireRole('admin'), (req, res) => {
    const c = ctxOf(req);
    res.json(deps.db.prepare('SELECT id, email, role, created_at AS createdAt FROM users WHERE tenant_id = ? ORDER BY created_at').all(c.tenantId));
  });
  // Only owners assign roles, and only within their own tenant.
  r.post('/members', requireRole('owner'), async (req, res) => {
    const c = ctxOf(req);
    if (c.isDemo) throw new HttpError(403, 'Not available in the demo', 'forbidden');
    const body = credentials.extend({ role: z.enum(ROLES) }).parse(req.body);
    const weak = validatePasswordStrength(body.password);
    if (weak) throw new HttpError(422, weak, 'weak_password');
    if (deps.db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email)) throw new HttpError(409, 'An account with this email already exists', 'email_taken');
    const id = randomUUID();
    const now = nowIso();
    deps.db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, role, created_at, password_updated_at) VALUES (?,?,?,?,?,?,?)').run(id, c.tenantId, body.email, await hashPassword(body.password), body.role, now, now);
    res.status(201).json({ id, email: body.email, role: body.role });
  });
  return r;
}
