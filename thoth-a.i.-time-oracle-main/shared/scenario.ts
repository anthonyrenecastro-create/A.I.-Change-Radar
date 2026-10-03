import type { Case, CaseResult, CaseVolumes, Formula, OptionResult, Requirement, ScenarioInput, ScenarioOption, ScenarioResult, SourcedValue } from './domain';
import { CASES } from './domain';

export const SCENARIO_MATH_VERSION = '1.0.0';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 4 }));
const money = (n: number, cur: string) => `${cur} ${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const val = (v: SourcedValue) => v.value;
const isNum = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

export function emptySourced(): SourcedValue { return { value: null, source: 'user_entered', asOf: null }; }
export function emptyVolumes(): CaseVolumes { return { inputTokens: null, outputTokens: null, seats: null, otherUsageUnits: null }; }

function caseResult(o: ScenarioOption, v: CaseVolumes, cur: string): CaseResult {
  const formulas: Formula[] = [];
  const missing: string[] = [];
  let incomplete = false;
  let present = 0;

  const usageTouched = [v.inputTokens, v.outputTokens, val(o.inputRatePerMTok), val(o.outputRatePerMTok)].some(isNum);
  let inputCost: number | null = null;
  let outputCost: number | null = null;
  let usageCost: number | null = null;
  if (usageTouched) {
    present++;
    if (isNum(v.inputTokens) && isNum(val(o.inputRatePerMTok))) {
      inputCost = (v.inputTokens / 1_000_000) * val(o.inputRatePerMTok)!;
      formulas.push({ label: 'Input token cost', expression: `${num(v.inputTokens)} input tokens ÷ 1,000,000 × ${money(val(o.inputRatePerMTok)!, cur)} per 1M input tokens`, result: round2(inputCost) });
    } else { missing.push('Input tokens per month or input rate'); }
    if (isNum(v.outputTokens) && isNum(val(o.outputRatePerMTok))) {
      outputCost = (v.outputTokens / 1_000_000) * val(o.outputRatePerMTok)!;
      formulas.push({ label: 'Output token cost', expression: `${num(v.outputTokens)} output tokens ÷ 1,000,000 × ${money(val(o.outputRatePerMTok)!, cur)} per 1M output tokens`, result: round2(outputCost) });
    } else { missing.push('Output tokens per month or output rate (enter 0 if none)'); }
    if (inputCost !== null && outputCost !== null) usageCost = inputCost + outputCost; else incomplete = true;
  }

  let seatCost: number | null = null;
  if (isNum(v.seats) || isNum(val(o.pricePerSeatMonth))) {
    present++;
    if (isNum(v.seats) && isNum(val(o.pricePerSeatMonth))) {
      seatCost = v.seats * val(o.pricePerSeatMonth)!;
      formulas.push({ label: 'Seat cost (separate from usage)', expression: `${num(v.seats)} seats × ${money(val(o.pricePerSeatMonth)!, cur)} per seat per month`, result: round2(seatCost) });
    } else { missing.push('Seat count or price per seat'); incomplete = true; }
  }

  let fixedCost: number | null = null;
  if (isNum(val(o.fixedMonthlyCost))) {
    present++;
    fixedCost = val(o.fixedMonthlyCost)!;
    formulas.push({ label: 'Other fixed monthly cost', expression: `${money(fixedCost, cur)} entered per month`, result: round2(fixedCost) });
  }

  let monthlyRecurring: number | null = null;
  if (present === 0) {
    missing.push('No pricing inputs entered; cost is unknown, not zero');
  } else if (!incomplete) {
    monthlyRecurring = (usageCost ?? 0) + (seatCost ?? 0) + (fixedCost ?? 0);
    const parts = [usageCost !== null && 'usage', seatCost !== null && 'seats', fixedCost !== null && 'fixed'].filter(Boolean).join(' + ');
    formulas.push({ label: 'Monthly recurring total', expression: `${parts} = ${money(monthlyRecurring, cur)}`, result: round2(monthlyRecurring) });
  }
  return {
    usageCost: usageCost === null ? null : round2(usageCost),
    inputCost: inputCost === null ? null : round2(inputCost),
    outputCost: outputCost === null ? null : round2(outputCost),
    seatCost: seatCost === null ? null : round2(seatCost),
    fixedCost: fixedCost === null ? null : round2(fixedCost),
    monthlyRecurring: monthlyRecurring === null ? null : round2(monthlyRecurring),
    formulas, missing,
  };
}

function oneTime(o: ScenarioOption, cur: string): { total: number | null; formulas: Formula[]; missing: string[] } {
  const formulas: Formula[] = [];
  const missing: string[] = [];
  let total = 0;
  let known = true;
  let anyEntered = false;
  const hours = o.migrationHours;
  if (isNum(hours) && isNum(val(o.hourlyRate))) {
    const c = hours * val(o.hourlyRate)!;
    total += c; anyEntered = true;
    formulas.push({ label: 'Migration labour', expression: `${num(hours)} hours × ${money(val(o.hourlyRate)!, cur)} per hour`, result: round2(c) });
  } else if (isNum(hours) && hours > 0) {
    known = false; missing.push('Hourly rate for migration labour');
  } else if (isNum(hours)) { anyEntered = true; }
  for (const c of o.otherOneTimeCosts) {
    if (isNum(c.amount)) { total += c.amount; anyEntered = true; formulas.push({ label: c.label || 'One-time cost', expression: `${money(c.amount, cur)} entered`, result: round2(c.amount) }); }
    else { known = false; missing.push(`Amount for one-time cost "${c.label || 'unnamed'}"`); }
  }
  if (o.kind === 'keep' && !anyEntered && known) {
    formulas.push({ label: 'One-time cost', expression: 'Keeping the current setup: none entered', result: 0 });
    return { total: 0, formulas, missing };
  }
  if (!anyEntered && known) { missing.push('Migration hours and one-time costs not entered'); return { total: null, formulas, missing }; }
  if (!known) return { total: null, formulas, missing };
  formulas.push({ label: 'One-time total', expression: `${money(total, cur)}`, result: round2(total) });
  return { total: round2(total), formulas, missing };
}

export function computeScenario(input: ScenarioInput, requirements: Requirement[]): ScenarioResult {
  const cur = input.currency || 'USD';
  const horizon = Math.max(1, Math.floor(input.horizonMonths || 12));
  const baseline = val(input.baselineMonthlySpend);
  const options: OptionResult[] = input.options.map(o => {
    const cases = {} as Record<Case, CaseResult>;
    for (const c of CASES) cases[c] = caseResult(o, o.volumes[c], cur);
    const ot = oneTime(o, cur);
    const delta = {} as Record<Case, number | null>;
    const total = {} as Record<Case, number | null>;
    for (const c of CASES) {
      const r = cases[c].monthlyRecurring;
      delta[c] = r !== null && isNum(baseline) ? round2(r - baseline) : null;
      total[c] = r !== null && ot.total !== null ? round2(r * horizon + ot.total) : null;
    }
    const unmet: string[] = [];
    const unknown: string[] = [];
    for (const r of requirements) {
      const fit = o.requirementFit[r.id] ?? 'unknown';
      if (fit === 'unmet') unmet.push(r.text); else if (fit === 'unknown') unknown.push(r.text);
    }
    const missing = [...new Set([...CASES.flatMap(c => cases[c].missing), ...ot.missing])];
    if (!isNum(baseline)) missing.push('Current monthly spend baseline not entered; savings cannot be computed');
    return {
      optionId: o.id, cases, oneTimeCost: ot.total, oneTimeFormulas: ot.formulas, monthlyDeltaVsBaseline: delta, horizonTotal: total,
      horizonFormula: `monthly recurring × ${horizon} months + one-time total`, unmetRequirements: unmet, unknownRequirements: unknown, missing,
    };
  });
  return {
    options,
    computedWith: `navigator-scenario-math ${SCENARIO_MATH_VERSION}`,
    disclaimer: 'Low / expected / high are editable sensitivity scenarios, not statistical confidence intervals. All rates and costs are customer-entered or evidence-linked and dated; none are verified vendor prices.',
  };
}

export function blankOption(kind: ScenarioOption['kind'], id: string, label: string): ScenarioOption {
  return {
    id, kind, label, vendor: '', model: '',
    inputRatePerMTok: emptySourced(), outputRatePerMTok: emptySourced(), pricePerSeatMonth: emptySourced(), fixedMonthlyCost: emptySourced(),
    volumes: { low: emptyVolumes(), expected: emptyVolumes(), high: emptyVolumes() },
    migrationHours: kind === 'keep' ? 0 : null, hourlyRate: emptySourced(), otherOneTimeCosts: [], requirementFit: {},
    tradeoffs: '', assumptions: '', evidenceNotes: '',
  };
}
