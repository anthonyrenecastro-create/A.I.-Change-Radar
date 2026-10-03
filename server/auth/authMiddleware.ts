import { DatabaseSync } from 'node:sqlite';
import { Request, Response, NextFunction } from 'express';
import { sha256 } from '../utils/crypto';

export interface AuthenticatedRequest extends Request {
  tenant?: {
    id: string;
    email: string;
    company_name: string;
    industry: string;
    plan: string;
    status: string;
    vendor_limit: number;
  };
  userRole?: 'customer' | 'owner';
}

export function createAuthMiddleware(db: DatabaseSync) {
  return function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header (Bearer token required)' });
    }

    const token = authHeader.slice(7).trim();
    const tokenHash = sha256(token);
    const now = Date.now();

    const session = db.prepare(`
      SELECT s.*, t.email, t.company_name, t.industry, t.plan, t.status, t.vendor_limit
      FROM sessions s
      JOIN tenants t ON s.tenant_id = t.id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(tokenHash, now) as any;

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session token. Please sign in.' });
    }

    req.tenant = {
      id: session.tenant_id,
      email: session.email,
      company_name: session.company_name,
      industry: session.industry,
      plan: session.plan,
      status: session.status,
      vendor_limit: session.vendor_limit,
    };
    req.userRole = session.role as 'customer' | 'owner';

    next();
  };
}

export function requireOwnerRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'owner') {
    return res.status(403).json({ error: 'Owner/Editorial administrative permissions required.' });
  }
  next();
}
