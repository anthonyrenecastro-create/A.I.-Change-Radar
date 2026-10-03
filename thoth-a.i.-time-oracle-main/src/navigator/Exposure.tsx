import React, { useState } from 'react';
import type { PublishedChange } from '../../shared/domain';
import { get, patch, post } from './api';
import { Badge, Btn, Empty, errText, ErrorBox, fmtDate, kindLabel, Loading, navigate, Page, useLoad } from './ui';

interface ChangeRow { change: PublishedChange; counts: { confirmed: number; possible: number; insufficient_information: number } }

export function ExposureList() {
  const { data, error, loading, reload } = useLoad(() => get<{ source: string; hasWorkflows: boolean; changes: ChangeRow[] }>('/changes'), []);
  return (
    <Page title="Exposure" question="Where does this change touch my business?">
      {loading && !data && <Loading what="Loading vendor changes" />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && !data.hasWorkflows && <div className="mb-4"><Empty title="Map your AI operations first">Without a workflow inventory nothing can be matched. <a className="underline" href="#/operations">Add a workflow</a>.</Empty></div>}
      {data && data.changes.length === 0 && <Empty title="No published changes available">Your plan may not include the change feed, or nothing has been published yet.</Empty>}
      <ul className="grid gap-3">
        {data?.changes.map(({ change, counts }) => (
          <li key={change.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="violet">{change.vendorName}</Badge><Badge>{kindLabel(change.kind)}</Badge>{change.isDemo && <Badge tone="amber">DEMO DATA</Badge>}</div>
            <h2 className="font-semibold mt-2"><a className="hover:underline" href={`#/exposure/${change.id}`}>{change.title}</a></h2>
            <p className="text-sm text-slate-400">{change.summary}</p>
            <p className="text-sm mt-2" aria-label="Match counts"><strong>{counts.confirmed}</strong> confirmed · <strong>{counts.possible}</strong> need review · <strong>{counts.insufficient_information}</strong> insufficient information</p>
          </li>
        ))}
      </ul>
      {data && <p className="text-xs text-slate-500 mt-3">Source: {data.source}</p>}
    </Page>
  );
}

export function ExposureDetail({ id, canWrite }: { id: string; canWrite: boolean }) {
  const { data, error, loading, reload } = useLoad(() => get<any>(`/changes/${id}`), [id]);
  const [err, setErr] = useState<string | null>(null);
  const review = async (matchId: string, state: string) => { try { await patch(`/exposure/${matchId}/review`, { state }); reload(); } catch (e) { setErr(errText(e)); } };
  const start = async (workflowId: string) => {
    try { const d = await post<{ id: string }>('/decisions', { workflowId, changeId: id }); navigate(`/sandbox/${d.id}`); } catch (e) { setErr(errText(e)); }
  };
  if (loading && !data) return <Page title="Exposure"><Loading /></Page>;
  if (error || !data) return <Page title="Exposure"><ErrorBox message={error ?? 'Not found'} onRetry={reload} /></Page>;
  const ch: PublishedChange = data.change;

  const Section = ({ title, hint, items, kind }: { title: string; hint: string; items: any[]; kind: 'confirmed' | 'possible' | 'insufficient' }) => (
    <section className="mb-5" aria-labelledby={`h-${kind}`}>
      <h2 id={`h-${kind}`} className="font-semibold">{title} <span className="text-slate-500 font-normal">({items.length})</span></h2>
      <p className="text-sm text-slate-400 mb-2">{hint}</p>
      {items.length === 0 ? <p className="text-sm text-slate-500 italic">None.</p> : (
        <ul className="grid gap-2">{items.map(m => (
          <li key={m.workflowId} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <span className="font-medium">{m.workflow.name} <Badge tone={m.workflow.criticality === 'critical' ? 'red' : 'slate'}>{m.workflow.criticality}</Badge></span>
              <span className="text-xs text-slate-500">rule: {kindLabel(m.rule)}{m.reviewState !== 'unreviewed' && ` · ${m.reviewState}`}</span>
            </div>
            <p className="text-sm mt-1">{m.explanation}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {canWrite && kind !== 'insufficient' && <Btn variant="primary" onClick={() => start(m.workflowId)}>Compare options</Btn>}
              {canWrite && kind === 'possible' && <><Btn onClick={() => review(m.id, 'confirmed')}>Yes, this applies</Btn><Btn onClick={() => review(m.id, 'dismissed')}>Not applicable</Btn></>}
              {kind === 'insufficient' && <a className="text-sm underline self-center" href="#/operations">Complete the inventory</a>}
            </div>
          </li>
        ))}</ul>
      )}
    </section>
  );

  return (
    <Page title={ch.title} question="Where does this change touch my business?" actions={<a className="underline text-sm" href="#/exposure">All changes</a>}>
      <div className="flex flex-wrap gap-2 mb-2"><Badge tone="violet">{ch.vendorName}</Badge><Badge>{kindLabel(ch.kind)}</Badge>{ch.isDemo && <Badge tone="amber">DEMO DATA</Badge>}<span className="text-sm text-slate-400">Effective: {fmtDate(ch.effectiveAt)}</span></div>
      <p className="mb-1">{ch.summary}</p>
      {ch.evidence.length > 0 && <p className="text-sm mb-3">Evidence: {ch.evidence.map(e => <a key={e.id} className="underline mr-2" href={e.url} target="_blank" rel="noreferrer noopener">{e.label || e.url}</a>)}</p>}
      <div role="note" className="rounded-lg bg-amber-950/40 border border-amber-800 text-amber-200 text-sm p-3 mb-4">{data.notice}</div>
      {err && <ErrorBox message={err} />}
      {data.noInventory && <Empty title="No workflows mapped yet"><a className="underline" href="#/operations">Map your AI operations</a> to see where this touches you.</Empty>}
      <Section kind="confirmed" title="Confirmed matches" hint="An explicit rule matched your recorded vendor and model." items={data.confirmed} />
      <Section kind="possible" title="Possible matches: review needed" hint="A rule suggests exposure but cannot confirm it. You decide." items={data.possible} />
      <Section kind="insufficient" title="Insufficient information" hint="These workflows lack the data needed to rule exposure in or out. They are not assumed safe." items={data.insufficient} />
      {data.dismissed.length > 0 && <p className="text-sm text-slate-500">{data.dismissed.length} possible match(es) dismissed by your team.</p>}
      {data.similarDecisions.length > 0 && (
        <section aria-labelledby="h-similar" className="mt-4">
          <h2 id="h-similar" className="font-semibold">Relevant past decisions</h2>
          <p className="text-sm text-slate-400 mb-2">Surfaced by simple matching rules (not prediction).</p>
          <ul className="grid gap-2">{data.similarDecisions.map((s: any) => (
            <li key={s.entry.decisionId} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm"><a className="font-medium underline" href="#/history">{s.entry.title}</a><div className="text-slate-400">Why shown: {s.basis}</div>{s.entry.outcome && <div>Outcome recorded. Success criteria met: {s.entry.outcome.successMet}. {s.entry.outcome.lessons && <>Lesson: “{s.entry.outcome.lessons}”</>}</div>}</li>
          ))}</ul>
        </section>
      )}
    </Page>
  );
}

export function Briefs() {
  const { data, error, loading, reload } = useLoad(() => get<any>('/briefs'), []);
  const { data: wf } = useLoad(() => get<{ workflows: { id: string; name: string }[] }>('/workflows'), []);
  const name = (id: string) => wf?.workflows.find(w => w.id === id)?.name ?? 'workflow';
  return (
    <Page title="Weekly Briefs" question="Supporting context from the monitoring service. Each item links into your affected workflows.">
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data?.weeks.length === 0 && <Empty title="No briefs available" />}
      {data?.weeks.map((w: any) => (
        <section key={w.weekStart} className="mb-5"><h2 className="font-semibold mb-2">Week of {fmtDate(w.weekStart)}</h2>
          <ul className="grid gap-2">{w.items.map((i: any) => (
            <li key={i.change.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
              <div className="font-medium">{i.change.vendorName}: {i.change.title}</div><p className="text-slate-400">{i.change.summary}</p>
              <p className="mt-1">{i.affectedWorkflowIds.length ? <>Touches: {i.affectedWorkflowIds.map((id: string) => <a key={id} className="underline mr-2" href={`#/exposure/${i.change.id}`}>{name(id)}</a>)}</> : 'No workflow matched.'}{i.incompleteWorkflowCount > 0 && ` ${i.incompleteWorkflowCount} workflow(s) have insufficient information.`} <a className="underline" href={`#/exposure/${i.change.id}`}>View exposure</a></p>
            </li>))}</ul></section>
      ))}
    </Page>
  );
}
