import type { ExposureMatch, PublishedChange, Workflow } from './domain';
import type { Edge } from './graph';
import { matchChange } from './matching';

export type RehearsalKind = 'model_retirement' | 'price_increase' | 'vendor_outage';

export interface RehearsalParams {
  kind: RehearsalKind;
  vendor: string;
  model?: string;
  /** price_increase only */
  percent?: number;
  /** vendor_outage only */
  durationHours?: number;
}

export interface RehearsalWorkflowResult {
  workflowId: string;
  workflowName: string;
  criticality: Workflow['criticality'];
  status: ExposureMatch['status'];
  explanation: string;
  hasFallback: boolean;
  fallbackNote: string;
  monthlyCostImpact: number | null;
  proposedTasks: string[];
}

export interface RehearsalResult {
  simulation: true;
  label: string;
  params: RehearsalParams;
  affected: RehearsalWorkflowResult[];
  missingFallbacks: string[];
  unknownCostImpact: string[];
  totalKnownMonthlyCostImpact: number | null;
  currency: string | null;
  notes: string[];
}

const LABEL = 'SIMULATION: tabletop rehearsal only. No real vendor event exists and nothing was published to the change feed.';

export function simulatedChange(p: RehearsalParams): PublishedChange {
  const kindMap = { model_retirement: 'retirement', price_increase: 'price_increase', vendor_outage: 'outage' } as const;
  const title = p.kind === 'model_retirement' ? `Simulated retirement of ${p.model ?? 'a model'}`
    : p.kind === 'price_increase' ? `Simulated ${p.percent ?? 0}% price increase`
    : `Simulated outage of ${p.vendor}`;
  return {
    id: `simulation:${p.kind}`, vendorId: p.vendor, vendorName: p.vendor, category: 'simulation', kind: kindMap[p.kind], title,
    summary: title, implication: '', action: '',
    affectedModels: p.kind === 'model_retirement' || (p.kind === 'price_increase' && p.model) ? [p.model ?? ''].filter(Boolean) : [],
    publishedAt: null, effectiveAt: null, evidence: [], isDemo: false,
  };
}

export function runRehearsal(params: RehearsalParams, workflows: Workflow[], edges: Edge[]): RehearsalResult {
  const change = simulatedChange(params);
  const matches = matchChange(change, workflows, edges);
  const byId = new Map(workflows.map(w => [w.id, w]));
  const affected: RehearsalWorkflowResult[] = [];
  const currencies = new Set<string>();
  let total = 0;
  let anyCost = false;
  const unknownCost: string[] = [];

  for (const m of matches) {
    const w = byId.get(m.workflowId)!;
    const hasFallback = w.fallbackType !== 'none';
    let impact: number | null = null;
    if (params.kind === 'price_increase' && m.status !== 'insufficient_information') {
      if (w.monthlySpend !== null && params.percent !== undefined) {
        impact = Math.round(w.monthlySpend * params.percent) / 100;
        total += impact; anyCost = true; currencies.add(w.currency);
      } else unknownCost.push(w.name);
    }
    const tasks: string[] = [];
    const exposed = m.status !== 'insufficient_information';
    if (m.status === 'insufficient_information') tasks.push(`Complete inventory details for "${w.name}" (vendor/model) so exposure can be assessed.`);
    if (exposed && !hasFallback) tasks.push(`Define a fallback vendor or manual process for "${w.name}".`);
    if (exposed && hasFallback) tasks.push(`Test that the ${w.fallbackType} fallback for "${w.name}" works and is documented${w.fallbackDetail ? ` (${w.fallbackDetail})` : ''}.`);
    if (exposed && params.kind === 'model_retirement') tasks.push(`Identify a replacement option and schedule pre-migration tests for "${w.name}".`);
    if (exposed && params.kind === 'price_increase') tasks.push(w.monthlySpend === null ? `Record current monthly spend for "${w.name}".` : `Compare alternatives in the Decision Sandbox for "${w.name}".`);
    if (exposed && params.kind === 'vendor_outage') tasks.push(`Agree who declares the fallback trigger and who communicates with users of "${w.name}"${params.durationHours ? ` during a ${params.durationHours}h outage` : ''}.`);
    if (exposed && (w.criticality === 'critical' || w.criticality === 'high')) tasks.push(`Prioritise "${w.name}" (${w.criticality} criticality) and confirm the business owner ${w.businessOwner || '(not recorded)'}.`);
    affected.push({
      workflowId: w.id, workflowName: w.name, criticality: w.criticality, status: m.status, explanation: m.explanation,
      hasFallback, fallbackNote: hasFallback ? `${w.fallbackType}: ${w.fallbackDetail || 'no detail recorded'} (untested in this simulation)` : 'No fallback recorded',
      monthlyCostImpact: impact, proposedTasks: tasks,
    });
  }
  const order = { confirmed: 0, possible: 1, insufficient_information: 2 } as const;
  affected.sort((a, b) => order[a.status] - order[b.status] || a.workflowName.localeCompare(b.workflowName));
  const notes: string[] = [];
  if (currencies.size > 1) notes.push('Workflows use different currencies; the cost total is not shown.');
  if (params.kind === 'price_increase') notes.push('Cost impact applies the entered percentage to customer-entered current monthly spend; it is not a vendor price.');
  if (params.kind === 'vendor_outage') notes.push('Outage rehearsal does not estimate lost revenue or downtime cost.');
  return {
    simulation: true, label: LABEL, params, affected,
    missingFallbacks: affected.filter(a => a.status !== 'insufficient_information' && !a.hasFallback).map(a => a.workflowName),
    unknownCostImpact: unknownCost,
    totalKnownMonthlyCostImpact: anyCost && currencies.size <= 1 ? Math.round(total * 100) / 100 : null,
    currency: currencies.size === 1 ? [...currencies][0] : null,
    notes,
  };
}
