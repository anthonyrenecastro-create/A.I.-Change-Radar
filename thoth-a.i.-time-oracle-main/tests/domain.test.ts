import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishedChange, Workflow } from '../shared/domain';
import { hasCycle, layerIndex, wouldCreateCycle } from '../shared/graph';
import { matchChange } from '../shared/matching';
import { compareForecastToObserved } from '../shared/outcome';
import { runRehearsal } from '../shared/rehearsal';
import { blankOption, computeScenario, emptySourced } from '../shared/scenario';

const wf = (id: string, over: Partial<Workflow> = {}): Workflow => ({
  id, tenantId: 't', name: id, purpose: '', businessOwner: '', criticality: 'medium', vendor: 'Acme', model: 'm1', integrationMethod: 'api', monthlyUsage: null, usageUnit: '',
  monthlySpend: null, currency: 'USD', spendAsOf: null, userCount: null, dataSensitivity: 'unknown', requirements: [], fallbackType: 'none', fallbackDetail: '', notes: '',
  archived: false, createdAt: '', updatedAt: '', ...over,
});
const change = (over: Partial<PublishedChange> = {}): PublishedChange => ({
  id: 'c1', vendorId: 'acme', vendorName: 'Acme', category: 'availability', kind: 'retirement', title: 'm1 retired', summary: 'The m1 model retires', implication: '', action: '',
  affectedModels: ['m1'], publishedAt: null, effectiveAt: null, evidence: [], isDemo: false, ...over,
});

test('named model is confirmed with an explanation; other models and vendors are not matched', () => {
  const m = matchChange(change(), [wf('a'), wf('b', { model: 'm2' }), wf('c', { vendor: 'Other' })], []);
  assert.equal(m.length, 1);
  assert.equal(m[0].status, 'confirmed');
  assert.match(m[0].explanation, /uses the model "m1" named in the Acme announcement/);
});

test('missing inventory data is insufficient, never absence of exposure', () => {
  const m = matchChange(change(), [wf('novendor', { vendor: '', model: '' }), wf('nomodel', { model: '' })], []);
  assert.deepEqual(m.map(x => x.status).sort(), ['insufficient_information', 'insufficient_information']);
  assert.deepEqual(m.map(x => x.rule).sort(), ['missing_model', 'missing_vendor']);
  const named = matchChange(change(), [wf('x', { vendor: '', model: 'm1' })], []);
  assert.equal(named[0].status, 'possible');
});

test('vendor-wide notices and text mentions are possible matches needing review', () => {
  const wide = matchChange(change({ affectedModels: [], kind: 'price_increase', title: 'Pricing', summary: 'General prices change' }), [wf('a')], []);
  assert.equal(wide[0].status, 'possible'); assert.equal(wide[0].rule, 'vendor_wide');
  const mention = matchChange(change({ affectedModels: ['m9'], summary: 'Also affects model-one behaviour' }), [wf('a', { model: 'model-one' })], []);
  assert.equal(mention[0].rule, 'model_mentioned');
});

test('downstream dependents are possible matches and traversal terminates on cyclic data', () => {
  const ws = [wf('a'), wf('b', { model: 'zzz' }), wf('c', { vendor: 'Other' })];
  const edges = [{ workflowId: 'b', dependsOnWorkflowId: 'a' }, { workflowId: 'c', dependsOnWorkflowId: 'b' }];
  const m = matchChange(change(), ws, edges);
  assert.equal(m.find(x => x.workflowId === 'c')!.rule, 'downstream_dependency');
  const cyclic = [...edges, { workflowId: 'a', dependsOnWorkflowId: 'c' }];
  assert.ok(hasCycle(cyclic));
  assert.equal(matchChange(change(), ws, cyclic).length, 3);
  assert.equal(layerIndex(['a', 'b', 'c'], cyclic).size, 3);
});

test('dismissed possible matches stop propagating; cycle detection rejects self and indirect cycles', () => {
  const ws = [wf('a', { model: 'm1x' }), wf('b', { model: 'q' })];
  const edges = [{ workflowId: 'b', dependsOnWorkflowId: 'a' }];
  assert.equal(matchChange(change(), ws, edges).length, 2);
  assert.equal(matchChange(change(), ws, edges, new Set(['a'])).length, 1);
  assert.ok(wouldCreateCycle(edges, 'a', 'b'));
  assert.ok(wouldCreateCycle(edges, 'a', 'a'));
  assert.ok(!wouldCreateCycle(edges, 'b', 'c'));
});

test('scenario arithmetic: separate input/output rates, seats separate, formulas visible', () => {
  const o = blankOption('alternative', 'alt', 'Alt');
  const u = (value: number) => ({ ...emptySourced(), value, asOf: '2026-01-01' });
  o.inputRatePerMTok = u(3); o.outputRatePerMTok = u(15); o.pricePerSeatMonth = u(20); o.fixedMonthlyCost = u(10);
  o.volumes.expected = { inputTokens: 2_000_000, outputTokens: 500_000, seats: 5, otherUsageUnits: null };
  o.migrationHours = 10; o.hourlyRate = u(50); o.otherOneTimeCosts = [{ id: 'x', label: 'Fee', amount: 100 }];
  const res = computeScenario({ currency: 'USD', horizonMonths: 12, notes: '', baselineMonthlySpend: u(200), options: [o] }, []);
  const r = res.options[0];
  const e = r.cases.expected;
  assert.equal(e.inputCost, 6); assert.equal(e.outputCost, 7.5); assert.equal(e.usageCost, 13.5); assert.equal(e.seatCost, 100); assert.equal(e.monthlyRecurring, 123.5);
  assert.equal(r.oneTimeCost, 600);
  assert.equal(r.horizonTotal.expected, 123.5 * 12 + 600);
  assert.equal(r.monthlyDeltaVsBaseline.expected, -76.5);
  assert.match(e.formulas[0].expression, /2,000,000 input tokens ÷ 1,000,000 × USD 3\.00/);
  assert.equal(r.cases.low.monthlyRecurring, null, 'low case has no volumes so cost is unknown, not the fixed fee');
  assert.ok(r.cases.low.missing.length > 0);
});

test('unknown values stay unknown and requirement fit is reported', () => {
  const o = blankOption('alternative', 'alt', 'Alt');
  const res = computeScenario({ currency: 'USD', horizonMonths: 12, notes: '', baselineMonthlySpend: emptySourced(), options: [o] }, [{ id: 'r1', text: 'EU only' }, { id: 'r2', text: 'Fast' }]);
  assert.equal(res.options[0].cases.expected.monthlyRecurring, null);
  assert.equal(res.options[0].oneTimeCost, null);
  assert.deepEqual(res.options[0].unknownRequirements, ['EU only', 'Fast']);
  const keep = blankOption('keep', 'keep', 'Keep'); keep.requirementFit = { r1: 'unmet' };
  assert.deepEqual(computeScenario({ currency: 'USD', horizonMonths: 1, notes: '', baselineMonthlySpend: emptySourced(), options: [keep] }, [{ id: 'r1', text: 'EU only' }]).options[0].unmetRequirements, ['EU only']);
  assert.equal(computeScenario({ currency: 'USD', horizonMonths: 1, notes: '', baselineMonthlySpend: emptySourced(), options: [keep] }, []).options[0].oneTimeCost, 0);
});

test('rehearsal reports exposure, missing fallbacks and cost impact, flagged as simulation', () => {
  const ws = [wf('a', { monthlySpend: 100 }), wf('b', { fallbackType: 'manual', fallbackDetail: 'by hand', monthlySpend: 50 }), wf('c', { vendor: '' })];
  const r = runRehearsal({ kind: 'price_increase', vendor: 'Acme', percent: 10 }, ws, []);
  assert.equal(r.simulation, true); assert.match(r.label, /SIMULATION/);
  assert.deepEqual(r.missingFallbacks, ['a']);
  assert.equal(r.totalKnownMonthlyCostImpact, 15);
  assert.equal(r.affected.find(x => x.workflowId === 'c')!.status, 'insufficient_information');
  assert.ok(r.affected.every(x => x.proposedTasks.length > 0));
});

test('forecast vs observed only compares matching units, periods and scope', () => {
  const f = { expectedMonthlyRecurring: 200, currency: 'USD', scope: 'workflow' as const, period: 'monthly' as const, migrationHours: 16 };
  const ok = compareForecastToObserved(f, { spendBefore: 190, spendAfter: 214, currency: 'USD', period: 'monthly', scope: 'workflow', migrationHours: 22 });
  assert.equal(ok[0].comparable, true); assert.equal(ok[0].difference, 14); assert.equal(ok[1].difference, 6);
  const bad = compareForecastToObserved(f, { spendBefore: 1, spendAfter: 600, currency: 'USD', period: 'quarterly', scope: 'organization', migrationHours: null });
  assert.equal(bad[0].comparable, false); assert.match(bad[0].reason, /periods differ/);
  assert.equal(bad[1].comparable, false);
  assert.match(compareForecastToObserved(f, { spendBefore: 1, spendAfter: 2, currency: 'EUR', period: 'monthly', scope: 'workflow', migrationHours: null })[0].reason, /Currencies differ/);
});
