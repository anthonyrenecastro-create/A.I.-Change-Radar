import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from './config';
import { createApp } from './app';
import { DISABLED_HASH } from './auth';
import type { Db } from './db';
import { newToken, tokenHash } from './security';
import { ingestSnapshot } from './radar';
import type { Workflow, ScenarioInput } from '../shared/domain';
import type { VendorSnapshot } from '../src/engine/changeRadar';

export const DEMO_LABEL = 'DEMONSTRATION DATA: fictional vendors, models, prices and results. Not real vendor information.';

function demoSnapshot(vendorId: string, vendorName: string, items: VendorSnapshot['items']): VendorSnapshot {
  return {
    evidence: {
      id: `demo-evidence-${vendorId}`, sourceId: `demo-${vendorId}`, vendorId, originalUrl: `https://example.invalid/demo/${vendorId}`, finalUrl: `https://example.invalid/demo/${vendorId}`,
      retrievedAt: '2026-09-20T09:00:00.000Z', publishedAt: null, effectiveAt: null, contentHash: `demo-${vendorId}-v1`, parserVersion: 'demo', status: 'success',
      extractedContent: `${DEMO_LABEL} (${vendorName})`,
    },
    items,
  };
}

/** Creates the isolated demo tenant, fictional changes, and completes one full journey through the public API. Idempotent. */
export async function seedDemo(db: Db, config: AppConfig): Promise<void> {
  if (db.prepare('SELECT 1 FROM tenants WHERE is_demo = 1').get()) return;
  const now = new Date().toISOString();
  const tenantId = randomUUID();
  const ownerId = randomUUID();
  db.transaction(() => {
    db.prepare('INSERT INTO tenants (id, name, is_demo, created_at) VALUES (?,?,1,?)').run(tenantId, 'Demo Company (sample data)', now);
    for (const [email, role] of [['demo-owner@demo.invalid', 'owner'], ['demo-viewer@demo.invalid', 'viewer']] as const) {
      db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, role, created_at, password_updated_at) VALUES (?,?,?,?,?,?,?)').run(email === 'demo-owner@demo.invalid' ? ownerId : randomUUID(), tenantId, email, DISABLED_HASH, role, now, now);
    }
    db.prepare('INSERT INTO entitlements (tenant_id, monitoring_plan, navigator_plan, radar_linked, updated_at) VALUES (?,?,?,?,?)').run(tenantId, 'none', 'navigator', 1, now);

    ingestSnapshot(db, 'demo-ai', 'Demo AI Vendor', demoSnapshot('demo-ai', 'Demo AI Vendor', [
      { id: 'retire-chat-large', title: '[DEMO] demo-chat-large will be retired', category: 'availability', publishedAt: '2026-09-15T00:00:00.000Z', effectiveAt: '2026-12-15T00:00:00.000Z',
        content: `${DEMO_LABEL} Demo AI Vendor announces the fictional model demo-chat-large will be retired on 2026-12-15. Customers should move to a successor.`,
        structured: { kind: 'retirement', affectedModels: ['demo-chat-large'], summary: `${DEMO_LABEL} demo-chat-large retires on 2026-12-15.`, implication: 'Workflows configured with demo-chat-large stop working after the retirement date.', action: 'Choose and test a replacement before the effective date.' } },
      { id: 'usage-price', title: '[DEMO] Demo AI Vendor API usage prices change', category: 'pricing', publishedAt: '2026-09-22T00:00:00.000Z', effectiveAt: '2026-11-01T00:00:00.000Z',
        content: `${DEMO_LABEL} Demo AI Vendor announces updated API usage pricing for all demo models. See the vendor page for current rates.`,
        structured: { kind: 'price_increase', affectedModels: [], summary: `${DEMO_LABEL} Usage pricing changes across Demo AI Vendor models from 2026-11-01.`, implication: 'Recurring usage costs may change; exact effect depends on your models and volumes.', action: 'Re-check your usage figures and enter the published rates.' } },
    ]), true);
    ingestSnapshot(db, 'demo-speech', 'Demo Speech Co', demoSnapshot('demo-speech', 'Demo Speech Co', [
      { id: 'transcribe-outage', title: '[DEMO] demo-transcribe service interruption', category: 'availability', publishedAt: '2026-09-29T00:00:00.000Z', effectiveAt: null,
        content: `${DEMO_LABEL} Demo Speech Co reports a fictional multi-hour interruption affecting demo-transcribe.`,
        structured: { kind: 'outage', affectedModels: ['demo-transcribe'], summary: `${DEMO_LABEL} demo-transcribe interruption reported.`, implication: 'Transcription workflows may be unavailable.', action: 'Confirm fallback readiness.' } },
    ]), true);
  })();

  // Drive the real API in-process so seeded data obeys the same validation as customer data.
  const app = createApp(db, { ...config, allowPublicDemo: true });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const token = newToken();
  db.prepare('INSERT INTO sessions (token_hash, user_id, tenant_id, created_at, expires_at) VALUES (?,?,?,?,?)').run(tokenHash(token), ownerId, tenantId, now, new Date(Date.now() + 3600_000).toISOString());
  const call = async <T>(method: string, p: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${base}${p}`, { method, headers: { 'content-type': 'application/json', cookie: `nav_session=${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(`Demo seed ${method} ${p} failed: ${res.status} ${JSON.stringify(json)}`);
    return json as T;
  };
  try {
    const wf = (o: Record<string, unknown>) => call<Workflow>('POST', '/workflows', o);
    const support = await wf({ name: 'Customer support reply drafting', purpose: 'Drafts first replies for the support team to review', businessOwner: 'Dana (Support Lead)', criticality: 'high', vendor: 'Demo AI Vendor', model: 'demo-chat-large',
      integrationMethod: 'api', monthlyUsage: 40, usageUnit: 'million input tokens', monthlySpend: 190, currency: 'USD', spendAsOf: '2026-09-01', userCount: 12, dataSensitivity: 'confidential',
      requirements: [{ text: 'Customer data must not be used for vendor model training' }, { text: 'Replies drafted in under 5 seconds' }], fallbackType: 'manual', fallbackDetail: 'Agents write replies from saved templates' });
    const report = await wf({ name: 'Weekly operations report', purpose: 'Summarises support volume for managers', businessOwner: 'Priya (Operations)', criticality: 'medium', vendor: 'Demo AI Vendor', model: 'demo-chat-small', integrationMethod: 'api', monthlySpend: 40, spendAsOf: '2026-09-01', dataSensitivity: 'internal', fallbackType: 'none' });
    const summarizer = await wf({ name: 'Management digest', purpose: 'Combines the weekly report with finance notes', businessOwner: 'Priya (Operations)', criticality: 'low', vendor: 'Demo AI Vendor', model: 'demo-chat-small', dataSensitivity: 'internal', fallbackType: 'none' });
    await wf({ name: 'Internal knowledge search', purpose: 'Staff Q&A over internal documents', businessOwner: 'Sam (IT)', criticality: 'medium', vendor: 'Demo AI Vendor', model: '', dataSensitivity: 'confidential' });
    await wf({ name: 'Contract clause review', purpose: 'Flags unusual clauses for legal review', businessOwner: 'Legal', criticality: 'high', vendor: '', model: '', dataSensitivity: 'regulated' });
    await wf({ name: 'Meeting transcription', purpose: 'Transcribes leadership meetings', businessOwner: 'Sam (IT)', criticality: 'low', vendor: 'Demo Speech Co', model: 'demo-transcribe', integrationMethod: 'saas_app', userCount: 8, monthlySpend: 96, spendAsOf: '2026-09-01', dataSensitivity: 'internal', fallbackType: 'manual', fallbackDetail: 'Notes taken by hand' });
    await call('POST', `/workflows/${summarizer.id}/dependencies`, { dependsOnWorkflowId: report.id, note: 'Digest reads the weekly report' });
    await call('POST', `/workflows/${report.id}/dependencies`, { dependsOnWorkflowId: support.id, note: 'Report uses support drafts metadata' });

    const { changes } = await call<{ changes: { change: { id: string; title: string } }[] }>('GET', '/changes');
    const retire = changes.find(c => c.change.title.includes('demo-chat-large'))!.change;
    await call('GET', `/changes/${retire.id}`); // computes and stores exposure matches

    const created = await call<{ id: string }>('POST', '/decisions', { workflowId: support.id, changeId: retire.id });
    const d = await call<{ revision: { input: ScenarioInput }; workflow: Workflow }>('GET', `/decisions/${created.id}`);
    const input = structuredClone(d.revision.input) as ScenarioInput;
    const user = (value: number | null, asOf = '2026-09-20') => ({ value, source: 'user_entered' as const, asOf });
    const [keep, , alt, fb] = input.options;
    const vols = (i: number, o: number) => ({ inputTokens: i, outputTokens: o, seats: null, otherUsageUnits: null });
    keep.inputRatePerMTok = user(2); keep.outputRatePerMTok = user(9); keep.fixedMonthlyCost = user(30);
    keep.volumes = { low: vols(30e6, 6e6), expected: vols(40e6, 8e6), high: vols(55e6, 12e6) };
    keep.tradeoffs = 'Not possible after 2026-12-15: the model is retired. Included for comparison only.';
    alt.label = 'Move to demo-chat-xl (fictional successor)'; alt.vendor = 'Demo AI Vendor'; alt.model = 'demo-chat-xl';
    alt.inputRatePerMTok = user(2.5); alt.outputRatePerMTok = user(10); alt.fixedMonthlyCost = user(30);
    alt.volumes = { low: vols(30e6, 6e6), expected: vols(40e6, 8e6), high: vols(55e6, 12e6) };
    alt.migrationHours = 16; alt.hourlyRate = user(60); alt.otherOneTimeCosts = [{ id: 'testing', label: 'Extra testing budget', amount: 150 }];
    alt.requirementFit = { [support.requirements[0].id]: 'unknown', [support.requirements[1].id]: 'met' };
    alt.assumptions = 'Demo rates entered 2026-09-20; token volumes equal current usage.'; alt.tradeoffs = 'Same vendor, so integration code changes are small.';
    fb.fixedMonthlyCost = user(400); fb.volumes.expected = vols(null, null);
    fb.tradeoffs = 'Slower replies; relies on staff availability.'; fb.requirementFit = { [support.requirements[0].id]: 'met', [support.requirements[1].id]: 'unmet' };
    await call('POST', `/decisions/${created.id}/revisions`, { input, changeNote: 'Entered demo rates and volumes' });
    // A later assumption change creates revision 3; the approved plan stays tied to the revision it was approved against.
    const rev2 = await call<{ revision: { id: string } }>('GET', `/decisions/${created.id}?revision=2`);
    const plan = await call<{ plan: { id: string; checklist: { id: string; text: string; done: boolean; ownerNote: string }[]; successCriteria: { id: string }[] } }>('POST', '/plans', { decisionId: created.id, revisionId: rev2.revision.id, chosenOptionId: alt.id, templateId: 'model-retirement' });
    const pid = plan.plan.id;
    const patched = await call<{ plan: { successCriteria: { id: string }[] } }>('PATCH', `/plans/${pid}`, {
      owner: 'Dana (Support Lead)', dueDate: '2026-11-30',
      successCriteria: [{ text: '95% of sampled replies rated acceptable by agents' }, { text: 'Median draft time under 5 seconds' }],
      fallbackTrigger: 'Switch to manual templates if acceptable-reply rate drops below 85% for two days',
      rollbackInstructions: 'Point configuration back to the prior model name only while it is still available; otherwise use the manual template process',
      notes: 'Demo plan. Verify the vendor data-training requirement in writing before cutover.',
      links: [{ label: 'Demo announcement (fictional)', url: 'https://example.invalid/demo/demo-ai' }],
    });
    await call('POST', `/plans/${pid}/submit`);
    await call('POST', `/plans/${pid}/approve`);
    await call('POST', `/plans/${pid}/start`);
    await call('PUT', `/plans/${pid}/outcome`, {
      spendBefore: 190, spendAfter: 214, currency: 'USD', period: 'monthly', scope: 'workflow', migrationHours: 22, downtimeMinutes: 15,
      criteriaResults: [{ criterionId: patched.plan.successCriteria[0].id, met: true }, { criterionId: patched.plan.successCriteria[1].id, met: false }],
      unexpected: 'Replies were longer than before, which raised output token use.',
      lessons: 'Test with real reply lengths before migrating; migration took more hours than estimated because prompts needed trimming. (Demonstration text)',
    });
    await call('POST', '/rehearsals', { kind: 'model_retirement', vendor: 'Demo AI Vendor', model: 'demo-chat-small' });
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  }
}
