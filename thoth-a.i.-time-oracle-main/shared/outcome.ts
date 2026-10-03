export type MeasurementPeriod = 'monthly' | 'quarterly' | 'annual' | 'other';
export type OutcomeScope = 'workflow' | 'vendor_account' | 'organization';

export interface ForecastBasis {
  expectedMonthlyRecurring: number | null;
  currency: string;
  scope: 'workflow';
  period: 'monthly';
  migrationHours: number | null;
}

export interface ObservedBasis {
  spendBefore: number | null;
  spendAfter: number | null;
  currency: string;
  period: MeasurementPeriod;
  scope: OutcomeScope;
  migrationHours: number | null;
}

export interface Comparison {
  metric: string;
  forecast: number | null;
  observed: number | null;
  difference: number | null;
  comparable: boolean;
  reason: string;
}

/** Compares forecast with observed values only when currency, period and scope line up. */
export function compareForecastToObserved(f: ForecastBasis, o: ObservedBasis): Comparison[] {
  const out: Comparison[] = [];
  const spend: Comparison = { metric: 'Monthly recurring cost after the change', forecast: f.expectedMonthlyRecurring, observed: o.spendAfter, difference: null, comparable: false, reason: '' };
  if (f.expectedMonthlyRecurring === null) spend.reason = 'The saved forecast has no complete expected monthly cost.';
  else if (o.spendAfter === null) spend.reason = 'No observed post-change spend was recorded.';
  else if (o.currency !== f.currency) spend.reason = `Currencies differ (forecast ${f.currency}, observed ${o.currency}).`;
  else if (o.period !== f.period) spend.reason = `Measurement periods differ (forecast is per month, observed is ${o.period}).`;
  else if (o.scope !== f.scope) spend.reason = `Scope differs (forecast covers one workflow, observed covers ${o.scope.replace('_', ' ')}).`;
  else { spend.comparable = true; spend.difference = Math.round((o.spendAfter - f.expectedMonthlyRecurring) * 100) / 100; spend.reason = 'Same currency, monthly period and workflow scope.'; }
  out.push(spend);

  const hours: Comparison = { metric: 'Migration hours', forecast: f.migrationHours, observed: o.migrationHours, difference: null, comparable: false, reason: '' };
  if (f.migrationHours === null) hours.reason = 'The saved forecast has no migration-hours estimate.';
  else if (o.migrationHours === null) hours.reason = 'No actual migration hours were recorded.';
  else { hours.comparable = true; hours.difference = Math.round((o.migrationHours - f.migrationHours) * 100) / 100; hours.reason = 'Both values are hours of effort.'; }
  out.push(hours);
  return out;
}
