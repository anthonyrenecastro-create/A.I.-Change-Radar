import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { signBillingPayload } from '../server/billing';
import { ingestSnapshot } from '../server/radar';
import { seedDemo } from '../server/seed';
import { PASSWORD, registerTenant, startTestApp, wfBody, type Client } from './helpers';

type T = Awaited<ReturnType<typeof startTestApp>>;
let t: T;
before(async () => {
  t = await startTestApp();
  ingestSnapshot(t.db, 'acme', 'Acme', {
    evidence: { id: 'ev1', sourceId: 's', vendorId: 'acme', originalUrl: 'https://acme.example/x', finalUrl: 'https://acme.example/x', retrievedAt: '2026-01-01T00:00:00Z', publishedAt: null, effectiveAt: null, contentHash: 'h', parserVersion: '1', status: 'success', extractedContent: '' },
    items: [{ id: 'i1', title: 'm1 retired', content: 'm1 retires', category: 'availability', publishedAt: '2026-01-01T00:00:00Z', effectiveAt: null, structured: { kind: 'retirement', affectedModels: ['m1'], vendorName: 'Acme' } }],
  }, false);
});
after(async () => { await t.close(); });

const acme = (over = {}) => wfBody({ vendor: 'Acme', model: 'm1', ...over });
const changeId = () => (t.db.prepare("SELECT id FROM published_changes WHERE vendor_id = 'acme'").get() as { id: string }).id;

async function fullPlan(c: Client, wfId: string) {
  const d = (await c.post('/decisions', { workflowId: wfId, changeId: changeId() })).body;
  const plan = (await c.post('/plans', { decisionId: d.id, chosenOptionId: 'keep', templateId: 'model-retirement' })).body;
  const patched = await c.patch(`/plans/${plan.plan.id}`, {
    owner: 'Ann', dueDate: '2026-12-01', successCriteria: [{ text: 'works' }], fallbackTrigger: 'if bad', rollbackInstructions: 'revert',
  });
  assert.equal(patched.status, 200);
  return { d, planId: plan.plan.id as string };
}

test('unauthenticated requests are rejected and there is no persona or scenario switch', async () => {
  const c = t.client();
  assert.equal((await c.get('/workflows')).status, 401);
  assert.equal((await c.get('/changes')).status, 401);
  assert.equal((await c.post('/auth/demo-session')).status, 503); // enabled in dev but nothing seeded
  const prod = await startTestApp({ production: true, allowPublicDemo: false });
  assert.equal((await prod.client().post('/auth/demo-session')).status, 404);
  assert.equal((await prod.client().post('/persona', { role: 'owner' })).status, 401);
  await prod.close();
});

test('public demo in production is read-only', async () => {
  const p = await startTestApp({ production: true, allowPublicDemo: true });
  await seedDemo(p.db, p.config);
  const c = p.client();
  const s = await c.post('/auth/demo-session');
  assert.equal(s.status, 200); assert.equal(s.body.user.role, 'viewer');
  assert.equal((await c.get('/workflows')).body.workflows.length, 6);
  assert.equal((await c.post('/workflows', wfBody())).status, 403);
  await p.close();
});

test('roles are server-controlled: registration always makes the creator owner of their own tenant, email text grants nothing', async () => {
  const c = t.client();
  const me = await registerTenant(c, 'admin-owner-superuser@example.com');
  assert.equal(me.user.role, 'owner');
  assert.equal(me.entitlements.navigatorPlan, 'evaluation');
  const sneaky = t.client();
  const r = await sneaky.post('/auth/register', { email: 'sneaky@example.com', password: PASSWORD, organization: 'S', role: 'owner', navigatorPlan: 'navigator', monitoringPlan: 'radar_unlimited' });
  assert.equal(r.body.entitlements.navigatorPlan, 'evaluation'); assert.equal(r.body.entitlements.monitoringPlan, 'none');
  assert.equal((await sneaky.put('/entitlements', { navigatorPlan: 'navigator' })).status, 404);
  assert.equal((await sneaky.post('/billing/upgrade', { plan: 'radar_unlimited' })).status, 404);
});

test('team roles: viewer cannot write, editor cannot approve, only owner manages members', async () => {
  const owner = t.client(); await registerTenant(owner, 'team-owner@example.com');
  const w = (await owner.post('/workflows', acme())).body;
  const { planId } = await fullPlan(owner, w.id);
  for (const [email, role] of [['v@example.com', 'viewer'], ['e@example.com', 'editor'], ['a@example.com', 'admin']]) {
    assert.equal((await owner.post('/team/members', { email, password: PASSWORD, role })).status, 201);
  }
  const login = async (email: string) => { const c = t.client(); const r = await c.post('/auth/login', { email, password: PASSWORD }); assert.equal(r.status, 200); return c; };
  const viewer = await login('v@example.com'); const editor = await login('e@example.com'); const admin = await login('a@example.com');
  assert.equal((await viewer.post('/workflows', acme())).status, 403);
  assert.equal((await viewer.get('/workflows')).status, 200);
  assert.equal((await editor.post('/team/members', { email: 'x@example.com', password: PASSWORD, role: 'owner' })).status, 403);
  assert.equal((await admin.post('/team/members', { email: 'x@example.com', password: PASSWORD, role: 'owner' })).status, 403);
  assert.equal((await editor.post(`/plans/${planId}/submit`)).status, 200);
  assert.equal((await editor.post(`/plans/${planId}/approve`)).status, 403);
  assert.equal((await viewer.post(`/plans/${planId}/approve`)).status, 403);
  assert.equal((await admin.post(`/plans/${planId}/approve`)).status, 200);
});

test('cross-tenant reads and writes are rejected, including relationship ids', async () => {
  const a = t.client(); await registerTenant(a, 'tenant-a@example.com');
  const b = t.client(); await registerTenant(b, 'tenant-b@example.com');
  const wa = (await a.post('/workflows', acme({ name: 'A-wf' }))).body;
  const wb = (await b.post('/workflows', acme({ name: 'B-wf' }))).body;
  const { d, planId } = await fullPlan(a, wa.id);
  assert.equal((await b.get('/workflows')).body.workflows.every((w: any) => w.id !== wa.id), true);
  assert.equal((await b.put(`/workflows/${wa.id}`, acme())).status, 404);
  assert.equal((await b.del(`/workflows/${wa.id}`)).status, 404);
  assert.equal((await b.post(`/workflows/${wb.id}/dependencies`, { dependsOnWorkflowId: wa.id })).status, 404);
  assert.equal((await b.post(`/workflows/${wa.id}/dependencies`, { dependsOnWorkflowId: wb.id })).status, 404);
  assert.equal((await b.post('/decisions', { workflowId: wa.id })).status, 404);
  assert.equal((await b.get(`/decisions/${d.id}`)).status, 404);
  assert.equal((await b.post(`/decisions/${d.id}/revisions`, { input: {}, changeNote: '' })).status, 404);
  assert.equal((await b.get(`/plans/${planId}`)).status, 404);
  assert.equal((await b.patch(`/plans/${planId}`, { notes: 'x' })).status, 404);
  assert.equal((await b.post(`/plans/${planId}/submit`)).status, 404);
  assert.equal((await b.put(`/plans/${planId}/outcome`, {})).status, 404);
  // A plan in B cannot point at A's decision or revision.
  const dbb = (await b.post('/decisions', { workflowId: wb.id })).body;
  assert.equal((await b.post('/plans', { decisionId: d.id, chosenOptionId: 'keep' })).status, 404);
  const aRev = (await a.get(`/decisions/${d.id}`)).body.revision.id;
  assert.equal((await b.post('/plans', { decisionId: dbb.id, revisionId: aRev, chosenOptionId: 'keep' })).status, 422);
  assert.equal((await b.get('/history')).body.entries.some((e: any) => e.decisionId === d.id), false);
  // Review of someone else's match is rejected.
  const exp = (await a.get(`/changes/${changeId()}`)).body;
  const match = exp.confirmed[0];
  assert.equal((await b.patch(`/exposure/${match.id}/review`, { state: 'dismissed' })).status, 404);
});

test('dependency cycles and duplicates are rejected; matching explains exposure and flags missing data', async () => {
  const c = t.client(); await registerTenant(c, 'dep@example.com');
  const a = (await c.post('/workflows', acme({ name: 'a' }))).body;
  const b = (await c.post('/workflows', acme({ name: 'b', model: 'other' }))).body;
  const n = (await c.post('/workflows', acme({ name: 'nomodel', model: '' }))).body;
  assert.equal((await c.post(`/workflows/${b.id}/dependencies`, { dependsOnWorkflowId: a.id })).status, 201);
  assert.equal((await c.post(`/workflows/${b.id}/dependencies`, { dependsOnWorkflowId: a.id })).status, 409);
  assert.equal((await c.post(`/workflows/${a.id}/dependencies`, { dependsOnWorkflowId: b.id })).body.code, 'dependency_cycle');
  assert.equal((await c.post(`/workflows/${a.id}/dependencies`, { dependsOnWorkflowId: a.id })).status, 422);
  const e = (await c.get(`/changes/${changeId()}`)).body;
  assert.deepEqual(e.confirmed.map((m: any) => m.workflow.name), ['a']);
  assert.match(e.confirmed[0].explanation, /uses the model "m1"/);
  assert.deepEqual(e.possible.map((m: any) => m.workflow.name), ['b']);
  assert.equal(e.possible[0].rule, 'downstream_dependency');
  assert.deepEqual(e.insufficient.map((m: any) => m.workflow.name), ['nomodel']);
  // Insufficient matches cannot be dismissed.
  const insuff = (await c.get(`/changes/${changeId()}`)).body.insufficient[0];
  assert.equal((await c.patch(`/exposure/${insuff.id}/review`, { state: 'dismissed' })).status, 422);
  // Dismissing a possible match removes it from the active list but not silently from record.
  assert.equal((await c.patch(`/exposure/${e.possible[0].id}/review`, { state: 'dismissed' })).status, 200);
  const after = (await c.get(`/changes/${changeId()}`)).body;
  assert.equal(after.possible.length, 0); assert.equal(after.dismissed.length, 1);
  assert.equal(n.name, 'nomodel');
});

test('evaluation workflow limit is enforced from central plan config', async () => {
  const c = t.client(); await registerTenant(c, 'limit@example.com');
  for (let i = 0; i < 5; i++) assert.equal((await c.post('/workflows', wfBody({ name: `w${i}` }))).status, 201);
  const over = await c.post('/workflows', wfBody({ name: 'w6' }));
  assert.equal(over.status, 402); assert.equal(over.body.code, 'plan_limit');
});

test('revisions are immutable and approved plans stay pinned to their revision', async () => {
  const c = t.client(); await registerTenant(c, 'rev@example.com');
  const w = (await c.post('/workflows', acme({ monthlySpend: 100, spendAsOf: '2026-01-01' }))).body;
  const { d, planId } = await fullPlan(c, w.id);
  const rev1 = (await c.get(`/decisions/${d.id}`)).body;
  assert.equal(rev1.revision.revisionNo, 1);
  const same = await c.post(`/decisions/${d.id}/revisions`, { input: rev1.revision.input, changeNote: 'no-op' });
  assert.equal(same.status, 409);
  const input = structuredClone(rev1.revision.input);
  input.options[0].fixedMonthlyCost = { value: 55, source: 'user_entered', asOf: '2026-02-01' };
  const made = await c.post(`/decisions/${d.id}/revisions`, { input, changeNote: 'new price' });
  assert.equal(made.status, 201); assert.equal(made.body.revisionNo, 2);
  assert.equal(made.body.revision.result.options[0].cases.expected.fixedCost, 55);
  assert.equal((await c.get(`/decisions/${d.id}?revision=1`)).body.revision.input.options[0].fixedMonthlyCost.value, null);
  assert.throws(() => t.db.prepare('UPDATE scenario_revisions SET input_json = ? WHERE decision_id = ?').run('{}', d.id), /immutable/);
  assert.throws(() => t.db.prepare('DELETE FROM scenario_revisions WHERE decision_id = ?').run(d.id), /immutable/);
  // Invalid evidence-backed value without URL, undated entered value and unknown requirement ids are rejected.
  const bad = structuredClone(input); bad.options[0].inputRatePerMTok = { value: 1, source: 'user_entered', asOf: null };
  assert.equal((await c.post(`/decisions/${d.id}/revisions`, { input: bad, changeNote: '' })).status, 400);
  const bad2 = structuredClone(input); bad2.options[0].requirementFit = { nope: 'met' };
  assert.equal((await c.post(`/decisions/${d.id}/revisions`, { input: bad2, changeNote: '' })).status, 422);
  // Plan approval flow: pinned to revision 1, flagged when a newer revision exists.
  await c.post(`/plans/${planId}/submit`);
  const approved = (await c.post(`/plans/${planId}/approve`)).body;
  assert.equal(approved.plan.status, 'approved'); assert.equal(approved.revisionNo, 1); assert.equal(approved.latestRevisionNo, 2); assert.equal(approved.newerRevisionAvailable, true);
  // Checklist ticks and notes do not withdraw approval; changing the plan content does.
  const ticked = (await c.patch(`/plans/${planId}`, { notes: 'hello', checklist: approved.plan.checklist.map((x: any, i: number) => ({ ...x, done: i === 0 })) })).body;
  assert.equal(ticked.plan.status, 'approved');
  const changed = (await c.patch(`/plans/${planId}`, { owner: 'Someone else' })).body;
  assert.equal(changed.plan.status, 'draft');
  assert.ok(changed.plan.timeline.some((e: any) => /returned to draft/.test(e.event)));
  assert.equal(changed.approvals.length, 1);
  assert.equal((await c.post(`/plans/${planId}/approve`)).status, 409);
  // Incomplete plans cannot be submitted.
  const d2 = (await c.post('/decisions', { workflowId: w.id })).body;
  const p2 = (await c.post('/plans', { decisionId: d2.id, chosenOptionId: 'keep' })).body.plan.id;
  const sub = await c.post(`/plans/${p2}/submit`);
  assert.equal(sub.status, 422); assert.match(sub.body.error, /Action owner/);
  assert.equal((await c.put(`/plans/${p2}/outcome`, {})).status, 409);
});

test('billing: bad signatures rejected, valid signed events grant entitlements once, demo tenants untouched', async () => {
  const c = t.client(); const me = await registerTenant(c, 'bill@example.com');
  const body = JSON.stringify({ id: 'evt_1', type: 'entitlement.granted', tenantId: me.tenant.id, product: 'navigator_radar_linked' });
  const post = (b: string, sig?: string) => fetch(`${t.base}/billing/webhook`, { method: 'POST', body: b, headers: sig ? { 'x-billing-signature': sig } : {} });
  assert.equal((await post(body)).status, 400);
  assert.equal((await post(body, signBillingPayload('wrong-secret-wrong-secret-wrong', body))).status, 400);
  assert.equal((await c.get('/auth/me')).body.entitlements.navigatorPlan, 'evaluation');
  const sig = signBillingPayload(t.config.billingWebhookSecret, body);
  const ok = await post(body, sig); assert.equal(ok.status, 200);
  const ent = (await c.get('/auth/me')).body.entitlements;
  assert.equal(ent.navigatorPlan, 'navigator'); assert.equal(ent.radarLinked, true); assert.equal(ent.monitoringPlan, 'none');
  assert.equal((await (await post(body, sig)).json()).duplicate, true);
  const radar = JSON.stringify({ id: 'evt_2', type: 'entitlement.granted', tenantId: me.tenant.id, product: 'radar_15' });
  await post(radar, signBillingPayload(t.config.billingWebhookSecret, radar));
  const after = (await c.get('/auth/me')).body.entitlements;
  assert.equal(after.monitoringPlan, 'radar_15'); assert.equal(after.monitoring.trackedVendorLimit, 15);
  const unknown = JSON.stringify({ id: 'evt_3', type: 'entitlement.granted', tenantId: me.tenant.id, product: 'free_gold' });
  assert.equal((await post(unknown, signBillingPayload(t.config.billingWebhookSecret, unknown))).status, 422);
  const unconfigured = await startTestApp({ billingWebhookSecret: '' });
  assert.equal((await fetch(`${unconfigured.base}/billing/webhook`, { method: 'POST', body })).status, 503);
  await unconfigured.close();
});

test('Navigator access without entitlement is rejected (402) and the feed is gated', async () => {
  const c = t.client(); const me = await registerTenant(c, 'noent@example.com');
  t.db.prepare("UPDATE entitlements SET navigator_plan = 'none' WHERE tenant_id = ?").run(me.tenant.id);
  assert.equal((await c.post('/workflows', wfBody())).status, 402);
  assert.equal((await c.get('/changes')).status, 402);
});

test('authentication throttling locks an account after repeated failures', async () => {
  const c = t.client(); await registerTenant(c, 'throttle@example.com');
  const attacker = t.client();
  for (let i = 0; i < 5; i++) assert.equal((await attacker.post('/auth/login', { email: 'throttle@example.com', password: 'wrong-password-1' })).status, 401);
  assert.equal((await attacker.post('/auth/login', { email: 'throttle@example.com', password: 'wrong-password-1' })).status, 429);
  assert.equal((await attacker.post('/auth/login', { email: 'throttle@example.com', password: PASSWORD })).status, 429);
});

test('cross-origin mutations are rejected', async () => {
  const c = t.client(); await registerTenant(c, 'csrf@example.com');
  assert.equal((await c.req('POST', '/workflows', wfBody(), { origin: 'https://evil.example' })).status, 403);
});

test('rehearsals are simulations: stored separately, never in the feed, not usable as decision sources', async () => {
  const c = t.client(); await registerTenant(c, 'sim@example.com');
  const w = (await c.post('/workflows', acme())).body;
  const before = (t.db.prepare('SELECT COUNT(*) n FROM published_changes').get() as { n: number }).n;
  const r = await c.post('/rehearsals', { kind: 'model_retirement', vendor: 'Acme', model: 'm1' });
  assert.equal(r.status, 201); assert.equal(r.body.result.simulation, true);
  assert.equal(r.body.result.affected[0].workflowId, w.id);
  assert.deepEqual(r.body.result.missingFallbacks, ['WF']);
  assert.equal((t.db.prepare('SELECT COUNT(*) n FROM published_changes').get() as { n: number }).n, before);
  assert.equal((await c.get('/changes')).body.changes.some((x: any) => x.change.id.startsWith('simulation')), false);
  assert.equal((await c.post('/decisions', { workflowId: w.id, changeId: 'simulation:model_retirement' })).status, 404);
  assert.equal((await c.post('/rehearsals', { kind: 'model_retirement', vendor: 'Acme' })).status, 400);
  assert.equal((t.db.prepare('SELECT COUNT(*) n FROM rehearsals').get() as { n: number }).n >= 1, true);
});

test('demo journey: change → workflow → revision → approved plan → outcome, isolated from real tenants', async () => {
  const d = await startTestApp();
  await seedDemo(d.db, d.config);
  await seedDemo(d.db, d.config); // idempotent
  const demo = d.client();
  assert.equal((await demo.post('/auth/demo-session')).body.tenant.isDemo, true);
  const hist = (await demo.get('/history?outcome=recorded')).body;
  assert.equal(hist.total, 1);
  const e = hist.entries[0];
  assert.ok(e.vendorChange.title.includes('demo-chat-large')); assert.equal(e.workflow.name, 'Customer support reply drafting');
  assert.equal(e.latestRevisionNo, 2); assert.equal(e.plans[0].revisionNo, 2); assert.equal(e.plans[0].status, 'done'); assert.equal(e.outcome.successMet, 'partial');
  const plan = (await demo.get(`/plans/${e.plans[0].id}`)).body;
  assert.equal(plan.plan.approvals?.length ?? plan.approvals.length, 1);
  const spend = plan.outcome.comparisons[0];
  assert.equal(spend.comparable, true); assert.equal(spend.forecast, 210); assert.equal(spend.difference, 4);
  assert.equal(plan.outcome.comparisons[1].difference, 6);
  assert.equal((await demo.get('/history?q=trim')).body.total, 1);
  assert.equal((await demo.get('/history?q=nonexistent-term')).body.total, 0);
  const exposure = (await demo.get('/changes')).body.changes.find((x: any) => x.change.title.includes('demo-chat-large'));
  assert.equal(exposure.counts.confirmed, 1); assert.ok(exposure.counts.insufficient_information >= 2);
  const detail = (await demo.get(`/changes/${exposure.change.id}`)).body;
  assert.deepEqual(detail.confirmed.map((m: any) => m.workflow.name), ['Customer support reply drafting']);
  assert.ok(detail.possible.some((m: any) => m.rule === 'downstream_dependency'));
  // Similar-decision recall explains its basis.
  const usage = (await demo.get('/changes')).body.changes.find((x: any) => x.change.title.includes('usage prices')).change;
  const sim = (await demo.get(`/changes/${usage.id}`)).body.similarDecisions;
  assert.equal(sim.length, 1); assert.match(sim[0].basis, /Same workflow|Same vendor/);
  // Real tenants never see demo data or demo changes.
  const real = d.client(); await registerTenant(real, 'real@example.com');
  assert.equal((await real.get('/workflows')).body.workflows.length, 0);
  assert.equal((await real.get('/changes')).body.changes.length, 0);
  assert.equal((await real.get('/history')).body.total, 0);
  await d.close();
});
