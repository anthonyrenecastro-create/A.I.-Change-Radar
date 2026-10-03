import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { generateId } from '../utils/crypto';

export interface PlanDetails {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  priceMonthly: number;
  vendorLimit: number;
  features: string[];
}

export const PLANS: Record<string, PlanDetails> = {
  starter: {
    id: 'starter',
    name: 'Radar Starter',
    priceMonthly: 29,
    vendorLimit: 3,
    features: ['Up to 3 tracked vendors', 'Concise weekly digest', 'Standard email delivery', 'Public source transparency'],
  },
  pro: {
    id: 'pro',
    name: 'Radar Professional',
    priceMonthly: 79,
    vendorLimit: 8,
    features: ['Up to 8 tracked vendors', 'Conditional cost & token impact estimates', 'Priority changelog indexing', 'Email delivery with custom threshold'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Radar Enterprise',
    priceMonthly: 199,
    vendorLimit: 99,
    features: ['Unlimited tracked vendors', 'Custom compliance & BAA statement tracking', 'Multi-recipient delivery', 'Dedicated webhook & raw audit export'],
  },
};

export class BillingService {
  private webhookSecret: string;

  constructor(private db: DatabaseSync) {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_radar_sandbox_key_2026';
  }

  /**
   * Verify HMAC SHA-256 signature for billing webhooks (Stripe-compatible header format).
   */
  verifyWebhookSignature(payload: string, signatureHeader?: string): boolean {
    if (!signatureHeader) return false;

    // Header format: t=1612345678,v1=abc123...
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let expectedSig = '';

    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key === 't') timestamp = val;
      if (key === 'v1') expectedSig = val;
    }

    if (!timestamp || !expectedSig) return false;

    // Prevent replay attacks if timestamp is older than 5 minutes
    const nowSec = Math.floor(Date.now() / 1000);
    const tsSec = parseInt(timestamp, 10);
    if (isNaN(tsSec) || Math.abs(nowSec - tsSec) > 300) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const computedSig = crypto.createHmac('sha256', this.webhookSecret).update(signedPayload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(computedSig), Buffer.from(expectedSig));
  }

  /**
   * Process a billing webhook idempotently.
   */
  processWebhookEvent(event: {
    id: string;
    type: string;
    data: { object: { customer_email?: string; client_reference_id?: string; plan_id?: string; status?: string } };
  }): { processed: boolean; message: string } {
    const now = Date.now();

    // Idempotency check: has this providerEventId already been processed?
    const existing = this.db.prepare('SELECT id FROM billing_events WHERE provider_event_id = ?').get(event.id);
    if (existing) {
      return { processed: false, message: 'Event already processed (idempotency key matched).' };
    }

    const tenantEmail = event.data.object.customer_email;
    const tenantId = event.data.object.client_reference_id;

    // Find tenant
    let tenant: any = null;
    if (tenantId) {
      tenant = this.db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    } else if (tenantEmail) {
      tenant = this.db.prepare('SELECT * FROM tenants WHERE email = ?').get(tenantEmail);
    }

    if (tenant) {
      if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'checkout.session.completed') {
        const planKey = (event.data.object.plan_id || 'pro').toLowerCase();
        const plan = PLANS[planKey] || PLANS.pro;

        this.db.prepare(`
          UPDATE tenants
          SET plan = ?, vendor_limit = ?, status = 'active', updated_at = ?
          WHERE id = ?
        `).run(plan.id, plan.vendorLimit, now, tenant.id);
      } else if (event.type === 'customer.subscription.deleted') {
        this.db.prepare(`
          UPDATE tenants
          SET status = 'canceled', vendor_limit = 1, updated_at = ?
          WHERE id = ?
        `).run(now, tenant.id);
      }
    }

    // Record billing event
    this.db.prepare(`
      INSERT INTO billing_events (id, tenant_id, event_type, provider_event_id, payload, status, processed_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'processed', ?, ?)
    `).run(
      generateId('bil'),
      tenant?.id || null,
      event.type,
      event.id,
      JSON.stringify(event),
      now,
      now
    );

    return { processed: true, message: `Successfully processed billing event: ${event.type}` };
  }

  /**
   * Enforce vendor limit entitlements for a tenant.
   */
  enforceVendorEntitlement(tenantId: string, requestedVendorCount: number): { allowed: boolean; limit: number; currentPlan: string } {
    const tenant = this.db.prepare('SELECT plan, vendor_limit FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) throw new Error('Tenant not found');

    const limit = tenant.vendor_limit || 3;
    return {
      allowed: requestedVendorCount <= limit,
      limit,
      currentPlan: tenant.plan || 'starter',
    };
  }
}
