import React, { useMemo, useState } from 'react';
import { CASES, type Case, type CaseVolumes, type RequirementFit, type ScenarioInput, type ScenarioOption, type SourcedValue, type Workflow } from '../../shared/domain';
import { computeScenario } from '../../shared/scenario';
import { get, post } from './api';
import { Badge, Btn, Empty, errText, ErrorBox, Field, fmtDate, inputCls, kindLabel, Loading, money, NumberInput, navigate, Page, useLoad } from './ui';

export function SandboxList() {
  const { data, error, loading, reload } = useLoad(() => get<{ decisions: any[] }>('/decisions'), []);
  return (
    <Page title="Decision Sandbox" question="What happens if we choose this option?">
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data?.decisions.length === 0 && <Empty title="No decisions yet">Start from an <a className="underline" href="#/exposure">affected workflow in Exposure</a>.</Empty>}
      <ul className="grid gap-2">{data?.decisions.map(d => (
        <li key={d.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3 flex flex-wrap justify-between gap-2">
          <div><a className="font-medium underline" href={`#/sandbox/${d.id}`}>{d.title}</a><div className="text-sm text-slate-400">Workflow: {d.workflowName} · revision {d.latestRevisionNo} · {d.planCount} plan(s) · created {fmtDate(d.createdAt)}</div></div>
        </li>))}</ul>
    </Page>
  );
}

const sv = (value: number | null, prev: SourcedValue): SourcedValue => ({ ...prev, value, asOf: prev.asOf ?? (value === null ? null : new Date().toISOString().slice(0, 10)) });

function Sourced({ label, v, onChange, unit }: { label: string; v: SourcedValue; onChange: (v: SourcedValue) => void; unit: string }) {
  return (
    <fieldset className="rounded border border-slate-800 p-2">
      <legend className="text-xs font-medium px-1">{label} <span className="text-slate-500">({unit})</span></legend>
      <div className="grid grid-cols-2 gap-1">
        <NumberInput aria-label={`${label} value`} value={v.value} onChange={n => onChange(sv(n, v))} />
        <input type="date" aria-label={`${label} as-of date`} className={inputCls} value={v.asOf ?? ''} onChange={e => onChange({ ...v, asOf: e.target.value || null })} />
        <select aria-label={`${label} source`} className={inputCls} value={v.source} onChange={e => onChange({ ...v, source: e.target.value as SourcedValue['source'] })}><option value="user_entered">Entered by us</option><option value="evidence">From evidence</option></select>
        {v.source === 'evidence' && <input aria-label={`${label} evidence URL`} placeholder="Evidence URL" className={inputCls} value={v.evidenceUrl ?? ''} onChange={e => onChange({ ...v, evidenceUrl: e.target.value })} />}
      </div>
    </fieldset>
  );
}

function OptionCard({ o, onChange, wf, result }: { o: ScenarioOption; onChange: (o: ScenarioOption) => void; wf: Workflow; result: ReturnType<typeof computeScenario>['options'][number] }) {
  const set = <K extends keyof ScenarioOption>(k: K, val: ScenarioOption[K]) => onChange({ ...o, [k]: val });
  const setVol = (c: Case, k: keyof CaseVolumes, n: number | null) => onChange({ ...o, volumes: { ...o.volumes, [c]: { ...o.volumes[c], [k]: n } } });
  const exp = result.cases.expected;
  return (
    <article className="rounded-xl border border-slate-700 bg-slate-900 p-3 grid gap-3 content-start" aria-label={o.label}>
      <header><Badge tone="violet">{kindLabel(o.kind)}</Badge><h3 className="font-semibold mt-1">{o.label}</h3></header>
      {(
        <div className="grid grid-cols-2 gap-2">
          <Field label="Vendor"><input className={inputCls} value={o.vendor} onChange={e => set('vendor', e.target.value)} /></Field>
          <Field label="Model / product"><input className={inputCls} value={o.model} onChange={e => set('model', e.target.value)} /></Field>
        </div>
      )}
      <Sourced label="Input rate" unit="per 1M input tokens" v={o.inputRatePerMTok} onChange={v => set('inputRatePerMTok', v)} />
      <Sourced label="Output rate" unit="per 1M output tokens" v={o.outputRatePerMTok} onChange={v => set('outputRatePerMTok', v)} />
      <Sourced label="Seat price" unit="per seat per month, separate from usage" v={o.pricePerSeatMonth} onChange={v => set('pricePerSeatMonth', v)} />
      <Sourced label="Other fixed monthly cost" unit="per month" v={o.fixedMonthlyCost} onChange={v => set('fixedMonthlyCost', v)} />
      <div className="overflow-x-auto">
        <table className="text-xs w-full"><caption className="text-left font-medium text-sm">Monthly volumes: sensitivity scenarios</caption>
          <thead><tr><th scope="col" className="text-left">Input</th>{CASES.map(c => <th scope="col" key={c} className="capitalize">{c}</th>)}</tr></thead>
          <tbody>{([['inputTokens', 'Input tokens'], ['outputTokens', 'Output tokens'], ['seats', 'Seats'], ['otherUsageUnits', 'Other units']] as const).map(([k, label]) => (
            <tr key={k}><th scope="row" className="text-left font-normal pr-1">{label}</th>{CASES.map(c => <td key={c} className="p-0.5"><NumberInput aria-label={`${label}, ${c}`} value={o.volumes[c][k]} onChange={n => setVol(c, k, n)} /></td>)}</tr>))}</tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Migration hours"><NumberInput value={o.migrationHours} onChange={n => set('migrationHours', n)} /></Field>
      </div>
      <Sourced label="Hourly rate" unit="per hour" v={o.hourlyRate} onChange={v => set('hourlyRate', v)} />
      <fieldset><legend className="text-xs font-medium">Other one-time costs</legend>
        {o.otherOneTimeCosts.map((c, i) => (
          <div key={c.id} className="flex gap-1 mb-1"><input aria-label="Cost label" className={inputCls} value={c.label} onChange={e => set('otherOneTimeCosts', o.otherOneTimeCosts.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /><div className="w-28"><NumberInput aria-label="Cost amount" value={c.amount} onChange={n => set('otherOneTimeCosts', o.otherOneTimeCosts.map((x, j) => j === i ? { ...x, amount: n } : x))} /></div><Btn variant="ghost" aria-label="Remove cost" onClick={() => set('otherOneTimeCosts', o.otherOneTimeCosts.filter((_, j) => j !== i))}>×</Btn></div>))}
        <Btn variant="ghost" onClick={() => set('otherOneTimeCosts', [...o.otherOneTimeCosts, { id: crypto.randomUUID(), label: '', amount: null }])}>+ Add one-time cost</Btn>
      </fieldset>
      {wf.requirements.length > 0 && (
        <fieldset><legend className="text-xs font-medium">Requirements (your assessment)</legend>
          {wf.requirements.map(r => (
            <label key={r.id} className="flex items-center justify-between gap-2 text-sm"><span>{r.text}</span>
              <select className="rounded border border-slate-700 text-xs p-1" value={o.requirementFit[r.id] ?? 'unknown'} onChange={e => set('requirementFit', { ...o.requirementFit, [r.id]: e.target.value as RequirementFit })}><option value="unknown">Unknown</option><option value="met">Met</option><option value="unmet">Unmet</option></select></label>))}
        </fieldset>)}
      <Field label="Tradeoffs and dependencies"><textarea rows={2} className={inputCls} value={o.tradeoffs} onChange={e => set('tradeoffs', e.target.value)} /></Field>
      <Field label="Assumptions"><textarea rows={2} className={inputCls} value={o.assumptions} onChange={e => set('assumptions', e.target.value)} /></Field>
      <Field label="Supporting evidence (notes or links)"><textarea rows={2} className={inputCls} value={o.evidenceNotes} onChange={e => set('evidenceNotes', e.target.value)} /></Field>

      <section className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-sm" aria-label="Calculated results">
        <h4 className="font-medium">Calculated results <span className="text-xs font-normal text-slate-500">(deterministic)</span></h4>
        <dl className="grid grid-cols-[1fr_auto] gap-x-2">
          {CASES.map(c => <React.Fragment key={c}><dt className="capitalize">Monthly recurring, {c}</dt><dd className="text-right font-mono">{money(result.cases[c].monthlyRecurring)}</dd></React.Fragment>)}
          <dt>One-time cost</dt><dd className="text-right font-mono">{money(result.oneTimeCost)}</dd>
          <dt>vs. current baseline (expected)</dt><dd className="text-right font-mono">{result.monthlyDeltaVsBaseline.expected === null ? 'Unknown' : `${result.monthlyDeltaVsBaseline.expected > 0 ? '+' : ''}${result.monthlyDeltaVsBaseline.expected.toFixed(2)}`}</dd>
          <dt>Horizon total (expected)</dt><dd className="text-right font-mono">{money(result.horizonTotal.expected)}</dd>
        </dl>
        <details className="mt-1"><summary className="cursor-pointer text-sky-400">Show formulas (expected case)</summary>
          <ul className="text-xs mt-1 grid gap-1">{[...exp.formulas, ...result.oneTimeFormulas].map((f, i) => <li key={i}><span className="font-medium">{f.label}:</span> <code className="break-words">{f.expression}</code> = {f.result === null ? 'unknown' : f.result.toFixed(2)}{f.note && <span className="text-slate-500"> ({f.note})</span>}</li>)}<li><code>{result.horizonFormula}</code></li></ul>
        </details>
        {result.unmetRequirements.length > 0 && <p className="mt-1 text-red-300">Unmet requirements: {result.unmetRequirements.join('; ')}</p>}
        {result.unknownRequirements.length > 0 && <p className="mt-1 text-amber-300">Requirement fit unknown: {result.unknownRequirements.join('; ')}</p>}
        {result.missing.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-amber-300">Missing information ({result.missing.length})</summary><ul className="list-disc ml-5 text-xs">{result.missing.map(m => <li key={m}>{m}</li>)}</ul></details>}
      </section>
    </article>
  );
}

export function SandboxDetail({ id, canWrite }: { id: string; canWrite: boolean }) {
  const [rev, setRev] = useState<number | undefined>();
  const { data, error, loading, reload } = useLoad(() => get<any>(`/decisions/${id}${rev ? `?revision=${rev}` : ''}`), [id, rev]);
  const [draft, setDraft] = useState<{ key: string; input: ScenarioInput } | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const key = data ? `${data.id}:${data.revision.revisionNo}` : '';
  const input: ScenarioInput | null = data ? (draft && draft.key === key ? draft.input : data.revision.input) : null;
  const dirty = !!draft && draft.key === key;
  const isLatest = data ? data.revision.revisionNo === data.revisions[0].revisionNo : false;
  const wf: Workflow | null = data?.workflow ?? null;
  const computed = useMemo(() => (input && wf ? computeScenario(input, wf.requirements) : null), [input, wf]);

  if (loading && !data) return <Page title="Decision Sandbox"><Loading /></Page>;
  if (error || !data || !input || !wf || !computed) return <Page title="Decision Sandbox"><ErrorBox message={error ?? 'Not found'} onRetry={reload} /></Page>;

  const update = (next: ScenarioInput) => setDraft({ key, input: next });
  const saveRevision = async () => {
    setBusy(true); setErr(null);
    try { await post(`/decisions/${id}/revisions`, { input, changeNote: note }); setDraft(null); setNote(''); setRev(undefined); reload(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const makePlan = async (optionId: string) => {
    try { const p = await post<{ plan: { id: string } }>('/plans', { decisionId: id, revisionId: data.revision.id, chosenOptionId: optionId }); navigate(`/actions/${p.plan.id}`); } catch (e) { setErr(errText(e)); }
  };

  return (
    <Page title={data.title} question="What happens if we choose this option?" actions={<a className="underline text-sm" href="#/sandbox">All decisions</a>}>
      <p className="text-sm text-slate-400 mb-3">Workflow: <strong>{wf.name}</strong>{data.change && <> · Change: <a className="underline" href={`#/exposure/${data.change.id}`}>{data.change.title}</a></>}</p>
      <div role="note" className="rounded-lg bg-slate-800 border border-slate-700 text-sm p-3 mb-4">{computed.disclaimer} Figures are entered by you; nothing here is a vendor price quote or a guarantee.</div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-sm">Revision <select className="rounded border border-slate-700 p-1 ml-1" value={data.revision.revisionNo} onChange={e => { setDraft(null); setRev(Number(e.target.value)); }}>{data.revisions.map((r: any) => <option key={r.revisionNo} value={r.revisionNo}>#{r.revisionNo}{r.revisionNo === data.revisions[0].revisionNo ? ' (latest)' : ''} · {fmtDate(r.createdAt)}</option>)}</select></label>
        {!isLatest && <Badge tone="amber">Viewing an older revision. Saving creates a new latest revision.</Badge>}
        <span className="text-xs text-slate-500">{data.revision.changeNote}</span>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-4 max-w-3xl">
        <Field label="Currency"><input className={inputCls} value={input.currency} maxLength={3} onChange={e => update({ ...input, currency: e.target.value.toUpperCase() })} /></Field>
        <Field label="Horizon (months)"><NumberInput value={input.horizonMonths} onChange={n => update({ ...input, horizonMonths: Math.max(1, Math.round(n ?? 12)) })} step="1" /></Field>
        <div className="sm:col-span-3"><Sourced label="Current monthly spend baseline" unit="per month" v={input.baselineMonthlySpend} onChange={v => update({ ...input, baselineMonthlySpend: v })} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4 items-start">
        {input.options.map((o, i) => (
          <div key={o.id} className="grid gap-2">
            <OptionCard o={o} wf={wf} result={computed.options[i]} onChange={n => update({ ...input, options: input.options.map(x => x.id === o.id ? n : x) })} />
            {canWrite && !dirty && isLatest && <Btn onClick={() => makePlan(o.id)}>Plan this option</Btn>}
          </div>))}
      </div>

      {canWrite && (
        <div className="sticky bottom-0 bg-slate-900/95 border-t border-slate-800 mt-4 p-3 flex flex-wrap items-end gap-3">
          <Field label="What changed? (revision note)" className="flex-1 min-w-[16rem]"><input className={inputCls} value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></Field>
          <Btn variant="primary" disabled={busy || !dirty} onClick={saveRevision}>{busy ? 'Saving…' : 'Save as new revision'}</Btn>
          {dirty && <Btn onClick={() => setDraft(null)}>Discard edits</Btn>}
          <p className="basis-full text-xs text-slate-500">Saved revisions are never altered. Approved plans stay linked to the revision they were approved against. {dirty ? 'Unsaved edits.' : 'No unsaved edits.'}</p>
          {err && <div className="basis-full"><ErrorBox message={err} /></div>}
        </div>)}
      {data.plans.length > 0 && <section className="mt-4"><h2 className="font-semibold">Plans from this decision</h2><ul>{data.plans.map((p: any) => <li key={p.id}><a className="underline" href={`#/actions/${p.id}`}>{p.title}</a> <Badge>{p.status}</Badge></li>)}</ul></section>}
    </Page>
  );
}
