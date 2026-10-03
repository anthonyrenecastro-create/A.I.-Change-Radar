import React, { lazy, Suspense, useEffect, useState } from 'react';
import { get, post } from './navigator/api';
import Operations from './navigator/Operations';
import { Briefs, ExposureDetail, ExposureList } from './navigator/Exposure';
import { SandboxDetail, SandboxList } from './navigator/Sandbox';
import { ActionsList, PlanDetail } from './navigator/Actions';
import History from './navigator/History';
import { Badge, Btn, errText, ErrorBox, Field, inputCls, Loading, navigate, useRoute } from './navigator/ui';

const LabApp = lazy(() => import('./LabApp'));

interface Me { user: { id: string; email: string; role: string }; tenant: { name: string; isDemo: boolean }; entitlements: any }

const NAV = [['operations', 'My AI Operations'], ['exposure', 'Exposure'], ['sandbox', 'Decision Sandbox'], ['actions', 'Action Workspace'], ['history', 'Decision History']] as const;

function AuthScreen({ demo, onAuthed }: { demo: boolean; onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [org, setOrg] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(null); try { await fn(); onAuthed(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); } };
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-indigo-800">AXIOM ZETA INNOVATIONS</p>
        <h1 className="text-2xl font-semibold">AZxAI Navigator</h1>
        <p className="text-slate-600 text-sm mb-4">Map your AI operations, see which vendor changes touch them, compare options, approve an action, and record the outcome.</p>
        <form onSubmit={e => { e.preventDefault(); go(() => post(`/auth/${mode}`, mode === 'register' ? { email, password: pw, organization: org } : { email, password: pw })); }} className="grid gap-3">
          {mode === 'register' && <Field label="Organisation name"><input required maxLength={120} autoComplete="organization" className={inputCls} value={org} onChange={e => setOrg(e.target.value)} /></Field>}
          <Field label="Email"><input type="email" required autoComplete="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Password" hint={mode === 'register' ? 'At least 12 characters' : undefined}><input type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputCls} value={pw} onChange={e => setPw(e.target.value)} /></Field>
          {err && <ErrorBox message={err} />}
          <Btn type="submit" variant="primary" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create evaluation account'}</Btn>
        </form>
        <button className="mt-3 text-sm underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(null); }}>{mode === 'login' ? 'Create an account' : 'I already have an account'}</button>
        {demo && <div className="mt-4 pt-4 border-t"><Btn onClick={() => go(() => post('/auth/demo-session'))}>Try the demo (sample data)</Btn></div>}
      </div>
    </main>
  );
}

export default function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [publicDemo, setPublicDemo] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [labOn, setLabOn] = useState(false);

  const refresh = () => get<any>('/auth/me').then(r => { setPublicDemo(!!r.publicDemoEnabled); setMe(r.user ? r : null); setLoadErr(null); }, e => { setLoadErr(errText(e)); setMe(null); });
  useEffect(() => { refresh(); fetch('/api/lab/health').then(r => setLabOn(r.ok)).catch(() => {}); }, []);
  useEffect(() => { document.getElementById('page-title')?.focus(); }, [route.join('/')]);

  if (route[0] === 'lab') return labOn ? <Suspense fallback={<Loading what="Loading research lab" />}><LabApp /></Suspense> : <main className="p-8"><p>The research lab is not enabled on this server. <a className="underline" href="#/">Back</a></p></main>;
  if (me === undefined) return <div className="p-8"><Loading /></div>;
  if (!me) return <>{loadErr && <div className="p-4"><ErrorBox message={loadErr} onRetry={refresh} /></div>}<AuthScreen demo={publicDemo} onAuthed={() => { navigate('/operations'); refresh(); }} /></>;

  const role = me.user.role;
  const canWrite = !!me.entitlements.canUseNavigator && ['editor', 'admin', 'owner'].includes(role);
  const section = route[0] ?? 'operations';
  const logout = async () => { await post('/auth/logout').catch(() => {}); setMe(null); navigate('/'); };

  let page: React.ReactNode;
  switch (section) {
    case 'exposure': page = route[1] ? <ExposureDetail id={route[1]} canWrite={canWrite} /> : <ExposureList />; break;
    case 'briefs': page = <Briefs />; break;
    case 'sandbox': page = route[1] ? <SandboxDetail key={route[1]} id={route[1]} canWrite={canWrite} /> : <SandboxList />; break;
    case 'actions': page = route[1] ? <PlanDetail key={route[1]} id={route[1]} canWrite={canWrite} role={role} /> : <ActionsList canWrite={canWrite} />; break;
    case 'history': page = <History />; break;
    default: page = <Operations canWrite={canWrite} />;
  }
  const active = (k: string) => section === k || (k === 'operations' && !NAV.some(([x]) => x === section) && section !== 'briefs');
  const ent = me.entitlements;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a href="#main" onClick={e => { e.preventDefault(); document.getElementById('page-title')?.focus(); }} className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>
      {me.tenant.isDemo && <div role="status" className="bg-amber-100 text-amber-950 text-sm px-4 py-1.5 text-center">DEMO WORKSPACE: fictional sample data, separate from real customer records.{role === 'viewer' && ' Read-only.'}</div>}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div><div className="font-semibold leading-tight">AZxAI Navigator</div><div className="text-[11px] text-slate-500 leading-tight">Axiom Zeta Innovations</div></div>
          <nav aria-label="Main" className="flex flex-wrap gap-1 flex-1">
            {NAV.map(([k, label]) => <a key={k} href={`#/${k}`} aria-current={active(k) ? 'page' : undefined} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${active(k) ? 'bg-indigo-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{label}</a>)}
            <a href="#/briefs" aria-current={section === 'briefs' ? 'page' : undefined} className={`px-3 py-1.5 rounded-lg text-sm ${section === 'briefs' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Weekly Briefs <span className="text-xs">(Radar context)</span></a>
          </nav>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Badge tone="violet">{ent.navigator.name}</Badge>
            <Badge tone={ent.canReadChangeFeed ? 'green' : 'amber'}>{ent.radarLinked ? 'Radar linked' : ent.monitoringPlan !== 'none' ? ent.monitoring.name : ent.canReadChangeFeed ? 'Feed: evaluation' : 'No change feed'}</Badge>
            <span className="hidden sm:inline">{me.user.email} ({role})</span>
            {labOn && <a className="underline" href="#/lab">Lab</a>}
            <Btn onClick={logout}>Sign out</Btn>
          </div>
        </div>
      </header>
      <main id="main" className="max-w-7xl mx-auto px-4 py-6">
        {!canWrite && !me.tenant.isDemo && <div role="note" className="mb-4 rounded bg-slate-100 border border-slate-300 p-2 text-sm">{role === 'viewer' ? 'Your role is read-only.' : 'Your plan does not include editing in Navigator.'}</div>}
        {page}
      </main>
    </div>
  );
}
