import React, { useState } from 'react';
import { get } from './api';
import { Badge, Empty, ErrorBox, fmtDate, kindLabel, Loading, Page, useLoad } from './ui';

export default function History() {
  const [q, setQ] = useState('');
  const [recorded, setRecorded] = useState(false);
  const { data, error, loading, reload } = useLoad(() => get<{ entries: any[]; total: number }>(`/history?q=${encodeURIComponent(q)}${recorded ? '&outcome=recorded' : ''}`), [q, recorded]);
  return (
    <Page title="Decision History" question="Did our decision work, and what should we remember?">
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <label className="text-sm font-medium">Search<input type="search" className="block rounded-md border border-slate-700 px-2 py-1.5 w-72 max-w-full font-normal" placeholder="Vendor, workflow, lesson…" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={recorded} onChange={e => setRecorded(e.target.checked)} />Only decisions with a recorded outcome</label>
      </div>
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data?.entries.length === 0 && <Empty title={q || recorded ? 'No decisions match' : 'No decisions recorded yet'}>Decisions appear here once you start one from Exposure.</Empty>}
      <ol className="grid gap-3">{data?.entries.map(e => (
        <li key={e.decisionId} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">{e.title}</h2>
          <ol className="mt-2 flex flex-wrap items-stretch gap-2 text-sm" aria-label="Decision chain">
            {[
              ['Vendor change', e.vendorChange ? <a className="underline" href={`#/exposure/${e.vendorChange.id}`}>{e.vendorChange.title}</a> : 'None linked'],
              ['Affected workflow', e.workflow.name],
              ['Scenario revision', <a className="underline" href={`#/sandbox/${e.decisionId}`}>{e.plans.length ? e.plans.map((p: any) => `#${p.revisionNo}`).join(', ') + ` of ${e.latestRevisionNo}` : `latest #${e.latestRevisionNo}`}</a>],
              ['Approved plan', e.plans.length ? e.plans.map((p: any) => <div key={p.id}><a className="underline" href={`#/actions/${p.id}`}>{p.title}</a> <Badge>{kindLabel(p.status)}</Badge></div>) : 'No plan yet'],
              ['Outcome', e.outcome ? <span>Criteria met: <strong>{e.outcome.successMet}</strong> · {fmtDate(e.outcome.recordedAt)}</span> : 'Not recorded'],
            ].map(([label, body], i) => <li key={i} className="rounded-lg bg-slate-950 border border-slate-800 p-2 min-w-[9rem] flex-1"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>{body}</li>)}
          </ol>
          {e.outcome?.lessons && <p className="text-sm mt-2"><strong>Lesson:</strong> {e.outcome.lessons}</p>}
          {e.outcome?.unexpected && <p className="text-sm"><strong>Unexpected:</strong> {e.outcome.unexpected}</p>}
        </li>))}</ol>
      {data && <p className="text-xs text-slate-500 mt-2">{data.total} decision(s). Matching on this page is plain text search; no predictions are made.</p>}
    </Page>
  );
}
