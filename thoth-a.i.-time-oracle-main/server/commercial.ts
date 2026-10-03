/**
 * Single source of truth for plans, limits and entitlements.
 * No prices live here on purpose: pricing is owned by the billing provider.
 * Radar (monitoring + briefings) and Navigator (workflow analysis + decisions) are separate entitlements.
 */

export type MonitoringPlanId = 'none' | 'radar_5' | 'radar_15' | 'radar_unlimited';
export type NavigatorPlanId = 'none' | 'evaluation' | 'navigator';

export interface MonitoringPlan { id: MonitoringPlanId; name: string; trackedVendorLimit: number | null }
export interface NavigatorPlan {
  id: NavigatorPlanId; name: string;
  /** null = unlimited */
  workflowLimit: number | null;
  canWrite: boolean;
  /** Whether this plan itself reads the published-change feed without a Radar entitlement or link. */
  includesFeedAccess: boolean;
}

export const MONITORING_PLANS: Record<MonitoringPlanId, MonitoringPlan> = {
  none: { id: 'none', name: 'No Radar monitoring', trackedVendorLimit: 0 },
  radar_5: { id: 'radar_5', name: 'Radar 5', trackedVendorLimit: 5 },
  radar_15: { id: 'radar_15', name: 'Radar 15', trackedVendorLimit: 15 },
  radar_unlimited: { id: 'radar_unlimited', name: 'Radar Unlimited', trackedVendorLimit: null },
};

export const NAVIGATOR_PLANS: Record<NavigatorPlanId, NavigatorPlan> = {
  none: { id: 'none', name: 'No Navigator access', workflowLimit: 0, canWrite: false, includesFeedAccess: false },
  // Placeholder limits for evaluation accounts; adjust here only.
  evaluation: { id: 'evaluation', name: 'Navigator evaluation', workflowLimit: 5, canWrite: true, includesFeedAccess: true },
  navigator: { id: 'navigator', name: 'AZxAI Navigator', workflowLimit: null, canWrite: true, includesFeedAccess: false },
};

/** Plan assigned to new self-registered tenants. Never a paid plan. */
export const SIGNUP_DEFAULTS = { monitoring: 'none' as MonitoringPlanId, navigator: 'evaluation' as NavigatorPlanId, radarLinked: false };

/**
 * Billing product codes that verified billing events may grant.
 * The bundle grants Navigator plus linked read access to the Radar feed, with no second monitoring charge.
 */
export interface Grant { monitoring?: MonitoringPlanId; navigator?: NavigatorPlanId; radarLinked?: boolean }
export const BILLING_PRODUCTS: Record<string, Grant> = {
  radar_5: { monitoring: 'radar_5' },
  radar_15: { monitoring: 'radar_15' },
  radar_unlimited: { monitoring: 'radar_unlimited' },
  navigator: { navigator: 'navigator' },
  navigator_radar_linked: { navigator: 'navigator', radarLinked: true },
};

export interface Entitlements { monitoringPlan: MonitoringPlanId; navigatorPlan: NavigatorPlanId; radarLinked: boolean }

export function entitlementSummary(e: Entitlements) {
  const nav = NAVIGATOR_PLANS[e.navigatorPlan];
  const mon = MONITORING_PLANS[e.monitoringPlan];
  return {
    ...e,
    monitoring: mon,
    navigator: nav,
    canUseNavigator: nav.canWrite,
    canReadChangeFeed: e.monitoringPlan !== 'none' || e.radarLinked || nav.includesFeedAccess,
  };
}

export const ROLES = ['viewer', 'editor', 'admin', 'owner'] as const;
export type Role = typeof ROLES[number];
export const roleAtLeast = (role: Role, min: Role) => ROLES.indexOf(role) >= ROLES.indexOf(min);
