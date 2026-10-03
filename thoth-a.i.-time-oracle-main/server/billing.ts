import { Router, raw } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { BILLING_PRODUCTS } from './commercial';
import { HttpError, nowIso, type Deps } from './http';

const TOLERANCE_SECONDS = 300;

export function signBillingPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

export function verifyBillingSignature(secret: string, body: Buffer, header: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=', 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > TOLERANCE_SECONDS || typeof parts.v1 !== 'string') return false;
  const expected = createHmac('sha256', secret).update(`${t}.`).update(body).digest();
  const given = Buffer.from(parts.v1, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const eventSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(['entitlement.granted', 'entitlement.revoked']),
  tenantId: z.string().min(1).max(100),
  product: z.string().min(1).max(100),
});

/**
 * Entitlements change only through signed billing events. There is deliberately no customer-facing upgrade endpoint.
 * An unsigned or badly signed request is rejected with 400 and no detail about why.
 */
export function billingRouter(deps: Deps): Router {
  const r = Router();
  r.post('/webhook', raw({ type: '*/*', limit: '256kb' }), (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!deps.config.billingWebhookSecret) throw new HttpError(503, 'Billing webhook is not configured', 'not_configured');
    if (!verifyBillingSignature(deps.config.billingWebhookSecret, body, req.header('x-billing-signature'))) throw new HttpError(400, 'Invalid signature', 'invalid_signature');
    let event: z.infer<typeof eventSchema>;
    try { event = eventSchema.parse(JSON.parse(body.toString('utf8'))); } catch { throw new HttpError(400, 'Invalid event', 'invalid_event'); }
    const grant = BILLING_PRODUCTS[event.product];
    if (!grant) throw new HttpError(422, 'Unknown product', 'unknown_product');
    const { db } = deps;
    if (db.prepare('SELECT 1 FROM billing_events WHERE id = ?').get(event.id)) return res.json({ ok: true, duplicate: true });
    const tenant = db.prepare('SELECT id, is_demo FROM tenants WHERE id = ?').get(event.tenantId) as { id: string; is_demo: number } | undefined;
    let outcome = 'applied';
    db.transaction(() => {
      if (!tenant) outcome = 'ignored_unknown_tenant';
      else if (tenant.is_demo) outcome = 'ignored_demo_tenant';
      else {
        const granted = event.type === 'entitlement.granted';
        if (grant.monitoring) db.prepare('UPDATE entitlements SET monitoring_plan = ?, updated_at = ? WHERE tenant_id = ?').run(granted ? grant.monitoring : 'none', nowIso(), tenant.id);
        if (grant.navigator) db.prepare('UPDATE entitlements SET navigator_plan = ?, updated_at = ? WHERE tenant_id = ?').run(granted ? grant.navigator : 'evaluation', nowIso(), tenant.id);
        if (grant.radarLinked) db.prepare('UPDATE entitlements SET radar_linked = ?, updated_at = ? WHERE tenant_id = ?').run(granted ? 1 : 0, nowIso(), tenant.id);
      }
      db.prepare('INSERT INTO billing_events (id, type, tenant_id, payload, received_at, outcome) VALUES (?,?,?,?,?,?)').run(event.id, event.type, event.tenantId, body.toString('utf8'), nowIso(), outcome);
    })();
    res.json({ ok: true, outcome });
  });
  return r;
}

