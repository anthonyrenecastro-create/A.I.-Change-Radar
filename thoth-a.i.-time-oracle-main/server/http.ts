import type { NextFunction, Request, Response } from 'express';
import type { Db } from './db';
import type { AppConfig } from './config';
import { entitlementSummary, NAVIGATOR_PLANS, roleAtLeast, type Entitlements, type Role } from './commercial';
import type { ChangeFeedAdapter } from './radar';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') { super(message); }
}
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`, 'not_found');

export interface Ctx {
  userId: string; email: string; tenantId: string; role: Role; isDemo: boolean; entitlements: Entitlements;
}
export interface Deps { db: Db; config: AppConfig; feed: ChangeFeedAdapter }

declare module 'express-serve-static-core' {
  interface Request { ctx?: Ctx }
}

export const ctxOf = (req: Request): Ctx => {
  if (!req.ctx) throw new HttpError(401, 'Sign in required', 'unauthenticated');
  return req.ctx;
};

export const requireRole = (min: Role) => (req: Request, _res: Response, next: NextFunction) => {
  const c = ctxOf(req);
  if (!roleAtLeast(c.role, min)) throw new HttpError(403, `This action requires the ${min} role`, 'forbidden');
  next();
};

/** Navigator write access: role + entitlement. Reads only need a session. */
export const requireNavigatorWrite = (req: Request, _res: Response, next: NextFunction) => {
  const c = ctxOf(req);
  if (!roleAtLeast(c.role, 'editor')) throw new HttpError(403, 'Read-only access: editor role required', 'forbidden');
  if (!NAVIGATOR_PLANS[c.entitlements.navigatorPlan].canWrite) throw new HttpError(402, 'Your account does not include Navigator access', 'entitlement_required');
  next();
};

export const feedAccess = (c: Ctx) => {
  if (!entitlementSummary(c.entitlements).canReadChangeFeed) throw new HttpError(402, 'Published-change access requires a Radar plan or a linked Radar account', 'entitlement_required');
  return { tenantId: c.tenantId, isDemo: c.isDemo };
};

export const nowIso = () => new Date().toISOString();

/** Asserts a row with the id exists in the tenant; responds 404 (not 403) so IDs from other tenants are not revealed. */
export function assertOwned(db: Db, table: 'workflows' | 'decision_records' | 'scenario_revisions' | 'action_plans' | 'exposure_matches' | 'rehearsals' | 'outcomes', id: unknown, tenantId: string, label: string): void {
  if (typeof id !== 'string' || !db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND tenant_id = ?`).get(id, tenantId)) throw notFound(label);
}
