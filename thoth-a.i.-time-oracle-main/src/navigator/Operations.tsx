import React, { useMemo, useState } from 'react';
import { CRITICALITIES, INTEGRATIONS, SENSITIVITIES, type Workflow, type WorkflowDependency } from '../../shared/domain';
import { layerIndex } from '../../shared/graph';
import { del, get, post, put } from './api';
import { Badge, Btn, Empty, errText, ErrorBox, Field, inputCls, kindLabel, Loading, money, NumberInput, Page, useLoad } from './ui';

const critTone = { low: 'slate', medium: 'blue', high: 'amber', critical: 'red' } as const;

type Draft = Omit<Workflow, 'id' | 'tenantId' | 'archived' | 'createdAt' | 'updatedAt'>;
const blank = (): Draft => ({ name: '', purpose: '', businessOwner: '', criticality: 'medium', vendor: '', model: '', integrationMethod: 'unknown', monthlyUsage: null, usageUnit: '', monthlySpend: null, currency: 'USD', spendAsOf: null, userCount: null, dataSensitivity: 'unknown', requirements: [], fallbackType: 'none', fallbackDetail: '', notes: '' });

export function missingFields(w: Workflow): string[] {
  const m: string[] = [];
  if (!w.vendor) m.push('vendor');
  if (!w.model) m.push('model/product');
  if (w.monthlySpend === null) m.push('monthly spend');
  if (w.dataSensitivity === 'unknown') m.push('data sensitivity');
  return m;
}

export default function Operations({ canWrite }: { canWrite: boolean }) {
  const { data, error, loading, reload } = useLoad(() => get<{ workflows: Workflow[]; dependencies: WorkflowDependency[] }>('/workflows'), []);
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [view, setView] = useState<'map' | 'table'>('map');
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Page title="My AI Operations" question="How does our business actually use AI?" actions={canWrite && <Btn variant="primary" onClick={() => setEditing({ draft: blank() })}>Add workflow</Btn>}>
      {loading && !data && <Loading what="Loading workflows" />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {editing && <WorkflowForm key={editing.id ?? 'new'} initial={editing.draft} id={editing.id} others={data?.workflows.filter(w => w.id !== editing.id) ?? []} deps={data?.dependencies ?? []} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />}
      {data && data.workflows.length === 0 && !editing && (
        <Empty title="No workflows mapped yet">Add each place your business uses AI (a chatbot, a drafting tool, an automation). Exposure analysis only works on what you record here. Missing data is flagged, never treated as “not affected”.</Empty>
      )}
      {data && data.workflows.length > 0 && (
        <>
          <div role="group" aria-label="Dependency view" className="flex gap-2 mb-3">
            <Btn variant={view === 'map' ? 'primary' : 'secondary'} aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</Btn>
            <Btn variant={view === 'table' ? 'primary' : 'secondary'} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</Btn>
          </div>
          {view === 'map' && <DependencyMap workflows={data.workflows} edges={data.dependencies} selected={selected} onSelect={setSelected} />}
          <DependencyTable workflows={data.workflows} edges={data.dependencies} canWrite={canWrite} onEdit={w => { const { id, tenantId, archived, createdAt, updatedAt, ...draft } = w; setEditing({ id, draft }); window.scrollTo({ top: 0 }); }} onChanged={reload} highlight={selected} />
        </>
      )}
    </Page>
  );
}

export function DependencyMap({ workflows, edges, selected, onSelect }: { workflows: Workflow[]; edges: WorkflowDependency[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const layout = useMemo(() => {
    const ids = workflows.map(w => w.id);
    const layers = layerIndex(ids, edges);
    const cols = new Map<number, string[]>();
    for (const id of ids) cols.set(layers.get(id) ?? 0, [...(cols.get(layers.get(id) ?? 0) ?? []), id]);
    const pos = new Map<string, { x: number; y: number }>();
    const W = 190, H = 64;
    let maxRows = 1;
    [...cols.entries()].forEach(([l, list]) => { maxRows = Math.max(maxRows, list.length); list.forEach((id, i) => pos.set(id, { x: 20 + l * (W + 70), y: 20 + i * (H + 24) })); });
    return { pos, W, H, width: 40 + cols.size * (W + 70), height: 40 + maxRows * (H + 24) };
  }, [workflows, edges]);
  const rel = (id: string) => {
    const out = edges.filter(e => e.workflowId === id).length, inn = edges.filter(e => e.dependsOnWorkflowId === id).length;
    return `depends on ${out}, depended on by ${inn}`;
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 mb-4 overflow-x-auto">
      <p className="text-xs text-slate-400 mb-2">Arrows point from a workflow to what it depends on. Use Tab and Enter to select a workflow; a table with the same information is below.</p>
      <svg width={layout.width} height={layout.height} role="group" aria-label="AI workflow dependency map">
        <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" /></marker></defs>
        {edges.map(e => {
          const a = layout.pos.get(e.workflowId), b = layout.pos.get(e.dependsOnWorkflowId);
          if (!a || !b) return null;
          const hot = selected === e.workflowId || selected === e.dependsOnWorkflowId;
          return <line key={e.id} x1={a.x} y1={a.y + layout.H / 2} x2={b.x + layout.W} y2={b.y + layout.H / 2} stroke={hot ? '#38bdf8' : '#475569'} strokeWidth={hot ? 2.5 : 1.5} markerEnd="url(#arr)" />;
        })}
        {workflows.map(w => {
          const p = layout.pos.get(w.id)!;
          const sel = selected === w.id;
          return (
            <g key={w.id} tabIndex={0} role="button" aria-pressed={sel} aria-label={`${w.name}, ${w.criticality} criticality, ${w.vendor || 'vendor unknown'}, ${rel(w.id)}`}
              onClick={() => onSelect(sel ? null : w.id)} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(sel ? null : w.id); } }} className="cursor-pointer focus:outline-none [&:focus>rect]:stroke-sky-400 [&:focus>rect]:stroke-[3px]">
              <rect x={p.x} y={p.y} width={layout.W} height={layout.H} rx={8} fill={sel ? '#0c4a6e' : '#0f172a'} stroke="#475569" strokeWidth={1.5} />
              <text x={p.x + 10} y={p.y + 24} fontSize={13} fontWeight={600} fill="#f1f5f9">{w.name.length > 24 ? w.name.slice(0, 23) + '…' : w.name}</text>
              <text x={p.x + 10} y={p.y + 44} fontSize={11} fill="#94a3b8">{(w.vendor || 'vendor ?') + ' · ' + w.criticality}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DependencyTable({ workflows, edges, canWrite, onEdit, onChanged, highlight }: { workflows: Workflow[]; edges: WorkflowDependency[]; canWrite: boolean; onEdit: (w: Workflow) => void; onChanged: () => void; highlight: string | null }) {
  const name = (id: string) => workflows.find(w => w.id === id)?.name ?? id;
  const [err, setErr] = useState<string | null>(null);
  const archive = async (w: Workflow) => {
    if (!confirm(`Archive "${w.name}"? Its dependencies are removed; decision history is kept.`)) return;
    try { await del(`/workflows/${w.id}`); onChanged(); } catch (e) { setErr(errText(e)); }
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      {err && <ErrorBox message={err} />}
      <table className="w-full text-sm">
        <caption className="text-left p-3 font-medium">Workflows and dependencies (table alternative to the map)</caption>
        <thead className="bg-slate-950 text-left"><tr>{['Workflow', 'Criticality', 'Vendor / model', 'Monthly spend', 'Depends on', 'Fallback', 'Data gaps', ''].map(h => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {workflows.map(w => {
            const gaps = missingFields(w);
            return (
              <tr key={w.id} className={`border-t border-slate-800 align-top ${highlight === w.id ? 'bg-sky-950/50' : ''}`}>
                <th scope="row" className="px-3 py-2 text-left font-medium">{w.name}<div className="text-xs font-normal text-slate-500">{w.businessOwner || 'No owner recorded'}</div></th>
                <td className="px-3 py-2"><Badge tone={critTone[w.criticality]}>{w.criticality}</Badge></td>
                <td className="px-3 py-2">{w.vendor || <em>unknown</em>} / {w.model || <em>unknown</em>}<div className="text-xs text-slate-500">{kindLabel(w.integrationMethod)}</div></td>
                <td className="px-3 py-2">{money(w.monthlySpend, w.currency)}{w.spendAsOf && <div className="text-xs text-slate-500">as of {w.spendAsOf}</div>}</td>
                <td className="px-3 py-2">{edges.filter(e => e.workflowId === w.id).map(e => name(e.dependsOnWorkflowId)).join(', ') || '—'}</td>
                <td className="px-3 py-2">{w.fallbackType === 'none' ? <Badge tone="amber">none recorded</Badge> : <span>{w.fallbackType}: {w.fallbackDetail || '—'}</span>}</td>
                <td className="px-3 py-2">{gaps.length ? <Badge tone="amber">{gaps.join(', ')}</Badge> : <Badge tone="green">complete</Badge>}</td>
                <td className="px-3 py-2 whitespace-nowrap">{canWrite && <><Btn variant="ghost" onClick={() => onEdit(w)}>Edit</Btn><Btn variant="ghost" onClick={() => archive(w)}>Archive</Btn></>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowForm({ initial, id, others, deps, onDone, onCancel }: { initial: Draft; id?: string; others: Workflow[]; deps: WorkflowDependency[]; onDone: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [dependsOn, setDependsOn] = useState<Set<string>>(() => new Set(deps.filter(e => e.workflowId === id).map(e => e.dependsOnWorkflowId)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const saved = await (id ? put<Workflow>(`/workflows/${id}`, d) : post<Workflow>('/workflows', d));
      const wid = saved.id;
      const existing = deps.filter(x => x.workflowId === wid);
      for (const x of existing) if (!dependsOn.has(x.dependsOnWorkflowId)) await del(`/dependencies/${x.id}`);
      for (const t of dependsOn) if (!existing.some(x => x.dependsOnWorkflowId === t)) await post(`/workflows/${wid}/dependencies`, { dependsOnWorkflowId: t });
      onDone();
    } catch (e2) { setErr(errText(e2)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-sky-800 bg-slate-900 p-4 mb-5 grid gap-3 md:grid-cols-3" aria-label={id ? 'Edit workflow' : 'Add workflow'}>
      <h2 className="md:col-span-3 font-semibold">{id ? 'Edit workflow' : 'Add workflow'}</h2>
      <Field label="Name *"><input required className={inputCls} value={d.name} onChange={e => set('name', e.target.value)} maxLength={120} /></Field>
      <Field label="Business owner"><input className={inputCls} value={d.businessOwner} onChange={e => set('businessOwner', e.target.value)} /></Field>
      <Field label="Criticality"><select className={inputCls} value={d.criticality} onChange={e => set('criticality', e.target.value as Draft['criticality'])}>{CRITICALITIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Purpose" className="md:col-span-3"><input className={inputCls} value={d.purpose} onChange={e => set('purpose', e.target.value)} /></Field>
      <Field label="Vendor" hint="Leave blank if unknown"><input className={inputCls} value={d.vendor} onChange={e => set('vendor', e.target.value)} /></Field>
      <Field label="Model or product" hint="Leave blank if unknown"><input className={inputCls} value={d.model} onChange={e => set('model', e.target.value)} /></Field>
      <Field label="Integration method"><select className={inputCls} value={d.integrationMethod} onChange={e => set('integrationMethod', e.target.value as Draft['integrationMethod'])}>{INTEGRATIONS.map(c => <option key={c} value={c}>{kindLabel(c)}</option>)}</select></Field>
      <Field label="Monthly usage"><NumberInput value={d.monthlyUsage} onChange={v => set('monthlyUsage', v)} /></Field>
      <Field label="Usage unit" hint="e.g. requests, tokens"><input className={inputCls} value={d.usageUnit} onChange={e => set('usageUnit', e.target.value)} /></Field>
      <Field label="Users"><NumberInput value={d.userCount} onChange={v => set('userCount', v)} step="1" /></Field>
      <Field label="Monthly spend"><NumberInput value={d.monthlySpend} onChange={v => set('monthlySpend', v)} /></Field>
      <Field label="Currency"><input className={inputCls} value={d.currency} maxLength={3} pattern="[A-Z]{3}" onChange={e => set('currency', e.target.value.toUpperCase())} /></Field>
      <Field label="Spend as of" hint="Date you entered or read this figure"><input type="date" className={inputCls} value={d.spendAsOf ?? ''} onChange={e => set('spendAsOf', e.target.value || null)} /></Field>
      <Field label="Data sensitivity"><select className={inputCls} value={d.dataSensitivity} onChange={e => set('dataSensitivity', e.target.value as Draft['dataSensitivity'])}>{SENSITIVITIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Fallback"><select className={inputCls} value={d.fallbackType} onChange={e => set('fallbackType', e.target.value as Draft['fallbackType'])}><option value="none">None recorded</option><option value="vendor">Fallback vendor</option><option value="manual">Manual process</option></select></Field>
      <Field label="Fallback detail"><input className={inputCls} disabled={d.fallbackType === 'none'} value={d.fallbackDetail} onChange={e => set('fallbackDetail', e.target.value)} /></Field>
      <Field label="Operational requirements (one per line)" className="md:col-span-3" hint="Your own requirements, e.g. “Data stays in the EU”. They are used to check scenario options.">
        <textarea className={inputCls} rows={3} value={d.requirements.map(r => r.text).join('\n')} onChange={e => set('requirements', e.target.value.split('\n').filter(t => t.trim()).map((text, i) => ({ id: d.requirements[i]?.id ?? '', text })))} />
      </Field>
      <fieldset className="md:col-span-3">
        <legend className="text-sm font-medium">Depends on (other workflows)</legend>
        {others.length === 0 ? <p className="text-sm text-slate-500">No other workflows yet.</p> : (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">{others.map(o => (
            <label key={o.id} className="text-sm flex items-center gap-1"><input type="checkbox" checked={dependsOn.has(o.id)} onChange={e => setDependsOn(s => { const n = new Set(s); e.target.checked ? n.add(o.id) : n.delete(o.id); return n; })} />{o.name}</label>
          ))}</div>
        )}
      </fieldset>
      {err && <div className="md:col-span-3"><ErrorBox message={err} /></div>}
      <div className="md:col-span-3 flex gap-2"><Btn type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save workflow'}</Btn><Btn onClick={onCancel}>Cancel</Btn></div>
    </form>
  );
}
