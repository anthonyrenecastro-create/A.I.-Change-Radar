import React, { useState } from 'react';
import { get, patch, post, put } from './api';
import { Badge, Btn, Empty, errText, ErrorBox, Field, fmtDate, inputCls, kindLabel, Loading, money, NumberInput, Page, useLoad } from './ui';

const statusTone: Record<string, any> = { draft: 'slate', in_review: 'amber', approved: 'green', in_progress: 'blue', done: 'green', cancelled: 'red' };
type Tab = 'plans' | 'rehearsal';

export function ActionsList({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>('plans');
  return (
    <Page title="Action Workspace" question="Are we prepared, and who does what next?">
      <div role="tablist" aria-label="Action workspace sections" className="flex gap-2 mb-4">
        {([['plans', 'Response plans'], ['rehearsal', 'Rehearsals (simulation)']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === k ? 'bg-sky-600 text-white' : 'bg-slate-900 border border-slate-700'}`}>{l}</button>)}
      </div>
      {tab === 'plans' ? <Plans /> : <Rehearsals canWrite={canWrite} />}
    </Page>
  );
}

function Plans() {
  const { data, error, loading, reload } = useLoad(() => get<{ plans: any[] }>('/plans'), []);
  return (
    <>
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data?.plans.length === 0 && <Empty title="No response plans yet">Compare options in the <a className="underline" href="#/sandbox">Decision Sandbox</a>, then choose “Plan this option”.</Empty>}
      <ul className="grid gap-2">{data?.plans.map(p => (
        <li key={p.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3"><a className="font-medium underline" href={`#/actions/${p.id}`}>{p.title}</a> <Badge tone={statusTone[p.status]}>{kindLabel(p.status)}</Badge>
          <div className="text-sm text-slate-400">{p.workflowName} · owner: {p.owner || 'unassigned'} · due {p.dueDate ? fmtDate(p.dueDate) : 'not set'}</div></li>))}</ul>
    </>
  );
}

const newId = () => crypto.randomUUID();
type Item = { id?: string; text: string; done?: boolean; ownerNote?: string };

function ListEditor({ label, items, onChange, checkable, disabled }: { label: string; items: Item[]; onChange: (i: Item[]) => void; checkable?: boolean; disabled?: boolean }) {
  return (
    <fieldset className="mb-3"><legend className="font-medium text-sm">{label}</legend>
      <ul className="grid gap-1 mt-1">{items.map((it, i) => (
        <li key={it.id ?? i} className="flex items-center gap-2">
          {checkable && <input type="checkbox" aria-label={`Done: ${it.text}`} checked={!!it.done} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, done: e.target.checked } : x))} />}
          <input aria-label={`${label} ${i + 1}`} className={inputCls} disabled={disabled} value={it.text} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
          <Btn variant="ghost" disabled={disabled} aria-label={`Remove ${label} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</Btn>
        </li>))}</ul>
      <Btn variant="ghost" disabled={disabled} onClick={() => onChange([...items, { id: newId(), text: '', done: false }])}>+ Add</Btn>
    </fieldset>
  );
}

export function PlanDetail({ id, canWrite, role }: { id: string; canWrite: boolean; role: string }) {
  const { data, error, loading, reload } = useLoad(() => get<any>(`/plans/${id}`), [id]);
  const tpls = useLoad(() => get<{ disclaimer: string; templates: { id: string; name: string; items: string[]; testSteps: string[] }[] }>('/templates'), []);
  const [edit, setEdit] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Page title="Action Workspace"><Loading /></Page>;
  if (error || !data) return <Page title="Action Workspace"><ErrorBox message={error ?? 'Not found'} onRetry={reload} /></Page>;
  const p = edit ?? data.plan;
  const locked = !canWrite || ['done', 'cancelled'].includes(data.plan.status);
  const isAdmin = role === 'admin' || role === 'owner';
  const set = (k: string, v: unknown) => setEdit({ ...p, [k]: v });
  const run = async (fn: () => Promise<any>) => { setBusy(true); setErr(null); try { await fn(); setEdit(null); reload(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); } };
  const save = () => run(() => patch(`/plans/${id}`, { title: p.title, owner: p.owner, dueDate: p.dueDate || null, successCriteria: p.successCriteria, checklist: p.checklist, testSteps: p.testSteps, fallbackTrigger: p.fallbackTrigger, rollbackInstructions: p.rollbackInstructions, notes: p.notes, links: p.links }));
  const act = (name: string) => run(async () => { if (edit) await save(); await post(`/plans/${id}/${name}`); });
  const applyTemplate = (tid: string) => {
    const t = tpls.data?.templates.find(x => x.id === tid); if (!t) return;
    setEdit({ ...p, checklist: [...p.checklist, ...t.items.map(text => ({ id: newId(), text, done: false, ownerNote: '' }))], testSteps: [...p.testSteps, ...t.testSteps.map(text => ({ id: newId(), text }))] });
  };
  const st = data.plan.status;

  return (
    <Page title={p.title || 'Plan'} question="Are we prepared, and who does what next?" actions={<a className="underline text-sm" href="#/actions">All plans</a>}>
      <div className="flex flex-wrap gap-2 items-center mb-3"><Badge tone={statusTone[st]}>{kindLabel(st)}</Badge><span className="text-sm text-slate-400">Workflow: {data.workflow.name} · Option: <strong>{data.option.label}</strong> · scenario revision #{data.revisionNo}</span></div>
      {data.newerRevisionAvailable && <div role="note" className="rounded bg-amber-950/40 border border-amber-800 text-amber-200 p-2 text-sm mb-3">A newer scenario revision (#{data.latestRevisionNo}) exists. This plan stays tied to revision #{data.revisionNo} until you edit and re-submit it.</div>}
      <div role="note" className="rounded bg-slate-800 border border-slate-700 p-2 text-sm mb-3">Navigator records plans only. It never changes vendor accounts, production configuration, or your infrastructure.</div>
      {err && <ErrorBox message={err} />}
      <div className="grid md:grid-cols-3 gap-3 my-3">
        <Field label="Plan title"><input className={inputCls} disabled={locked} value={p.title} onChange={e => set('title', e.target.value)} /></Field>
        <Field label="Action owner"><input className={inputCls} disabled={locked} value={p.owner} onChange={e => set('owner', e.target.value)} /></Field>
        <Field label="Due date"><input type="date" className={inputCls} disabled={locked} value={p.dueDate ?? ''} onChange={e => set('dueDate', e.target.value || null)} /></Field>
      </div>
      {!locked && tpls.data && (
        <div className="mb-3 rounded border border-slate-800 bg-slate-900 p-2 text-sm"><label>Add checklist template: <select className="rounded border border-slate-700 p-1" value="" onChange={e => applyTemplate(e.target.value)}><option value="">Choose…</option>{tpls.data.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p className="text-xs text-slate-400 mt-1">{tpls.data.disclaimer}</p></div>)}
      <div className="grid md:grid-cols-2 gap-x-6">
        <ListEditor label="Success criteria" items={p.successCriteria} onChange={v => set('successCriteria', v)} disabled={locked} />
        <ListEditor label="Test steps before migration" items={p.testSteps} onChange={v => set('testSteps', v)} disabled={locked} />
      </div>
      <ListEditor label="Checklist" items={p.checklist} checkable onChange={v => set('checklist', v)} disabled={!canWrite || ['cancelled'].includes(st)} />
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Fallback trigger" hint="What observation makes us switch to the fallback?"><textarea className={inputCls} rows={3} disabled={locked} value={p.fallbackTrigger} onChange={e => set('fallbackTrigger', e.target.value)} /></Field>
        <Field label="Rollback instructions"><textarea className={inputCls} rows={3} disabled={locked} value={p.rollbackInstructions} onChange={e => set('rollbackInstructions', e.target.value)} /></Field>
      </div>
      <Field label="Notes" className="mt-3"><textarea className={inputCls} rows={3} disabled={!canWrite} value={p.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <fieldset className="mt-3"><legend className="font-medium text-sm">Evidence links</legend>
        {p.links.map((l: any, i: number) => <div key={l.id ?? i} className="flex gap-2 mb-1"><input aria-label="Link label" className={inputCls} value={l.label} disabled={!canWrite} onChange={e => set('links', p.links.map((x: any, j: number) => j === i ? { ...x, label: e.target.value } : x))} /><input aria-label="Link URL" type="url" className={inputCls} value={l.url} disabled={!canWrite} onChange={e => set('links', p.links.map((x: any, j: number) => j === i ? { ...x, url: e.target.value } : x))} /><Btn variant="ghost" aria-label="Remove link" onClick={() => set('links', p.links.filter((_: any, j: number) => j !== i))}>×</Btn></div>)}
        <Btn variant="ghost" disabled={!canWrite} onClick={() => set('links', [...p.links, { id: newId(), label: '', url: '' }])}>+ Add link</Btn></fieldset>

      <div className="flex flex-wrap gap-2 my-4 items-center">
        {canWrite && edit && <Btn variant="primary" disabled={busy} onClick={save}>Save changes</Btn>}
        {canWrite && st === 'draft' && <Btn variant="primary" disabled={busy} onClick={() => act('submit')}>Submit for review</Btn>}
        {isAdmin && st === 'in_review' && <><Btn variant="primary" disabled={busy || !!edit} onClick={() => act('approve')}>Approve plan</Btn><Btn disabled={busy} onClick={() => act('return')}>Return to draft</Btn></>}
        {canWrite && st === 'approved' && <Btn variant="primary" disabled={busy} onClick={() => act('start')}>Mark in progress</Btn>}
        {canWrite && ['draft', 'in_review', 'approved', 'in_progress'].includes(st) && <Btn variant="danger" disabled={busy} onClick={() => confirm('Cancel this plan?') && act('cancel')}>Cancel plan</Btn>}
        {st === 'in_review' && !isAdmin && <span className="text-sm text-slate-400">Waiting for an admin or owner to approve.</span>}
      </div>
      {data.readinessMissing.length > 0 && st === 'draft' && <p className="text-sm text-amber-300">Before submitting: {data.readinessMissing.join('; ')}.</p>}
      <section aria-label="Approval record" className="text-sm mb-4">{data.approvals.length > 0 && <><h2 className="font-semibold">Approvals</h2><ul>{data.approvals.map((a: any, i: number) => <li key={i}>{a.approvedBy} on {fmtDate(a.approvedAt)} (content hash {a.planHash.slice(0, 8)})</li>)}</ul></>}</section>

      {['in_progress', 'done'].includes(st) && canWrite && <OutcomeForm plan={data} onSaved={reload} />}
      {data.outcome && <OutcomeSummary outcome={data.outcome} currency={data.currency} />}
      <details className="mt-4 text-sm"><summary className="cursor-pointer">Timeline</summary><ul className="mt-1">{data.plan.timeline.map((t: any, i: number) => <li key={i}>{new Date(t.at).toLocaleString()} · {t.by} · {t.event}</li>)}</ul></details>
    </Page>
  );
}

function OutcomeForm({ plan, onSaved }: { plan: any; onSaved: () => void }) {
  const o = plan.outcome;
  const [f, setF] = useState({ spendBefore: o?.spendBefore ?? null, spendAfter: o?.spendAfter ?? null, currency: o?.currency ?? plan.currency, period: o?.period ?? 'monthly', scope: o?.scope ?? 'workflow', migrationHours: o?.migrationHours ?? null, downtimeMinutes: o?.downtimeMinutes ?? null, unexpected: o?.unexpected ?? '', lessons: o?.lessons ?? '' });
  const [crit, setCrit] = useState<Record<string, boolean | null>>(() => Object.fromEntries(plan.plan.successCriteria.map((c: any) => [c.id, (o?.criteriaResults ?? []).find((r: any) => r.criterionId === c.id)?.met ?? null])));
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    try { await put(`/plans/${plan.plan.id}/outcome`, { ...f, criteriaResults: Object.entries(crit).map(([criterionId, met]) => ({ criterionId, met })) }); onSaved(); } catch (x) { setErr(errText(x)); }
  };
  return (
    <form onSubmit={submit} className="rounded-xl border border-sky-800 bg-slate-900 p-4 my-4 grid gap-3 md:grid-cols-3">
      <h2 className="md:col-span-3 font-semibold">Record the outcome</h2>
      <Field label="Spend before"><NumberInput value={f.spendBefore} onChange={v => setF({ ...f, spendBefore: v })} /></Field>
      <Field label="Spend after"><NumberInput value={f.spendAfter} onChange={v => setF({ ...f, spendAfter: v })} /></Field>
      <Field label="Currency"><input className={inputCls} maxLength={3} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
      <Field label="Measurement period"><select className={inputCls} value={f.period} onChange={e => setF({ ...f, period: e.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="other">Other</option></select></Field>
      <Field label="Scope measured"><select className={inputCls} value={f.scope} onChange={e => setF({ ...f, scope: e.target.value })}><option value="workflow">This workflow only</option><option value="vendor_account">Whole vendor account</option><option value="organization">Whole organisation</option></select></Field>
      <Field label="Migration hours"><NumberInput value={f.migrationHours} onChange={v => setF({ ...f, migrationHours: v })} /></Field>
      <Field label="Downtime or disruption (minutes)"><NumberInput value={f.downtimeMinutes} onChange={v => setF({ ...f, downtimeMinutes: v })} /></Field>
      <fieldset className="md:col-span-3"><legend className="text-sm font-medium">Success criteria met?</legend>
        {plan.plan.successCriteria.map((c: any) => <div key={c.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{c.text}</span>
          <select aria-label={`Met: ${c.text}`} className="rounded border border-slate-700 p-1" value={crit[c.id] === null ? '' : String(crit[c.id])} onChange={e => setCrit({ ...crit, [c.id]: e.target.value === '' ? null : e.target.value === 'true' })}><option value="">Not assessed</option><option value="true">Met</option><option value="false">Not met</option></select></div>)}</fieldset>
      <Field label="Unexpected consequences" className="md:col-span-3"><textarea rows={2} className={inputCls} value={f.unexpected} onChange={e => setF({ ...f, unexpected: e.target.value })} /></Field>
      <Field label="Lessons for future decisions" className="md:col-span-3"><textarea rows={2} className={inputCls} value={f.lessons} onChange={e => setF({ ...f, lessons: e.target.value })} /></Field>
      {err && <div className="md:col-span-3"><ErrorBox message={err} /></div>}
      <div className="md:col-span-3"><Btn type="submit" variant="primary">{o ? 'Update outcome' : 'Record outcome and complete plan'}</Btn></div>
    </form>
  );
}

export function OutcomeSummary({ outcome, currency }: { outcome: any; currency: string }) {
  return (
    <section aria-labelledby="out-h" className="rounded-xl border border-slate-800 bg-slate-900 p-4 my-4">
      <h2 id="out-h" className="font-semibold">Recorded outcome</h2>
      <p className="text-sm text-slate-400">Recorded {fmtDate(outcome.recordedAt)} by {outcome.recordedBy}. Measured {outcome.period}, scope: {kindLabel(outcome.scope)}. Spend {money(outcome.spendBefore, outcome.currency)} → {money(outcome.spendAfter, outcome.currency)}; downtime {outcome.downtimeMinutes ?? 'not recorded'} min.</p>
      <table className="text-sm w-full mt-2"><caption className="sr-only">Forecast versus observed (forecast currency {currency})</caption>
        <thead><tr className="text-left"><th scope="col">Metric</th><th scope="col">Forecast</th><th scope="col">Observed</th><th scope="col">Difference</th><th scope="col">Comparable?</th></tr></thead>
        <tbody>{outcome.comparisons.map((c: any) => <tr key={c.metric} className="border-t align-top"><th scope="row" className="text-left font-normal">{c.metric}</th><td>{c.forecast ?? '—'}</td><td>{c.observed ?? '—'}</td><td>{c.comparable ? c.difference : '—'}</td><td>{c.comparable ? 'Yes' : <span className="text-amber-300">No: {c.reason}</span>}</td></tr>)}</tbody></table>
      {outcome.unexpected && <p className="text-sm mt-2"><strong>Unexpected:</strong> {outcome.unexpected}</p>}
      {outcome.lessons && <p className="text-sm"><strong>Lessons:</strong> {outcome.lessons}</p>}
    </section>
  );
}

function Rehearsals({ canWrite }: { canWrite: boolean }) {
  const list = useLoad(() => get<{ rehearsals: any[] }>('/rehearsals'), []);
  const [f, setF] = useState({ kind: 'model_retirement', vendor: '', model: '', percent: 20 as number | null, durationHours: 8 as number | null });
  const [res, setRes] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    try {
      const body: any = { kind: f.kind, vendor: f.vendor };
      if (f.kind === 'model_retirement') body.model = f.model; else if (f.kind === 'price_increase') body.percent = f.percent ?? 0; else body.durationHours = f.durationHours ?? 0;
      const r = await post<any>('/rehearsals', body); setRes(r.result); list.reload();
    } catch (x) { setErr(errText(x)); }
  };
  return (
    <div>
      <div role="note" className="rounded bg-violet-950/40 border border-violet-700 text-violet-200 p-3 text-sm mb-4"><strong>Simulation.</strong> Rehearsals use your own inventory with a made-up event. They never appear in the vendor-change feed, exposure lists or briefs.</div>
      {canWrite && (
        <form onSubmit={run} className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid gap-3 md:grid-cols-4 items-end mb-4">
          <Field label="Scenario"><select className={inputCls} value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}><option value="model_retirement">Model retirement</option><option value="price_increase">Price increase</option><option value="vendor_outage">Vendor outage</option></select></Field>
          <Field label="Vendor"><input required className={inputCls} value={f.vendor} onChange={e => setF({ ...f, vendor: e.target.value })} /></Field>
          {f.kind === 'model_retirement' && <Field label="Model"><input required className={inputCls} value={f.model} onChange={e => setF({ ...f, model: e.target.value })} /></Field>}
          {f.kind === 'price_increase' && <Field label="Increase %"><NumberInput value={f.percent} onChange={v => setF({ ...f, percent: v })} /></Field>}
          {f.kind === 'vendor_outage' && <Field label="Duration (hours)"><NumberInput value={f.durationHours} onChange={v => setF({ ...f, durationHours: v })} /></Field>}
          <Btn type="submit" variant="primary">Run rehearsal</Btn>
          {err && <div className="md:col-span-4"><ErrorBox message={err} /></div>}
        </form>)}
      {res && <RehearsalResult r={res} />}
      {list.data && list.data.rehearsals.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm">Earlier rehearsals ({list.data.rehearsals.length})</summary>{list.data.rehearsals.map(x => <div key={x.id} className="my-2"><p className="text-xs text-slate-500">{new Date(x.createdAt).toLocaleString()}</p><RehearsalResult r={x.result} /></div>)}</details>}
    </div>
  );
}

function RehearsalResult({ r }: { r: any }) {
  return (
    <section className="rounded-xl border-2 border-dashed border-violet-600 bg-slate-900 p-4" aria-label="Rehearsal result">
      <p className="font-semibold text-violet-300">{r.label}</p>
      {r.affected.length === 0 ? <p className="text-sm mt-2">No workflows affected based on your recorded inventory (incomplete inventory is listed separately above if present).</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm mt-2"><thead><tr className="text-left"><th scope="col">Workflow</th><th scope="col">Status</th><th scope="col">Why</th><th scope="col">Fallback</th><th scope="col">Cost impact / month</th><th scope="col">Proposed tasks</th></tr></thead>
          <tbody>{r.affected.map((a: any) => <tr key={a.workflowId} className="border-t align-top"><th scope="row" className="text-left">{a.workflowName}<div className="font-normal text-xs">{a.criticality}</div></th><td>{kindLabel(a.status)}</td><td>{a.explanation}</td><td>{a.hasFallback ? a.fallbackNote : <Badge tone="red">missing</Badge>}</td><td>{a.monthlyCostImpact === null ? 'unknown' : a.monthlyCostImpact.toFixed(2)}</td><td><ul className="list-disc ml-4">{a.proposedTasks.map((t: string) => <li key={t}>{t}</li>)}</ul></td></tr>)}</tbody></table></div>)}
      {r.missingFallbacks.length > 0 && <p className="text-sm mt-2 text-red-300"><strong>Missing fallbacks:</strong> {r.missingFallbacks.join(', ')}</p>}
      {r.unknownCostImpact.length > 0 && <p className="text-sm text-amber-300"><strong>Cost impact unknown:</strong> {r.unknownCostImpact.join(', ')}</p>}
      {r.totalKnownMonthlyCostImpact !== null && <p className="text-sm">Known cost impact total: {money(r.totalKnownMonthlyCostImpact, r.currency ?? 'USD')} / month (known figures only).</p>}
      <ul className="text-xs text-slate-400 mt-2 list-disc ml-4">{r.notes.map((n: string) => <li key={n}>{n}</li>)}</ul>
    </section>
  );
}
