import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, set] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    set(s => ({ ...s, loading: true, error: null }));
    fn().then(data => set({ data, error: null, loading: false }), e => set({ data: null, error: e instanceof ApiError ? e.message : String(e), loading: false }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run };
}

export const errText = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));

export function Page({ title, question, actions, children }: { title: string; question?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby="page-title">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 id="page-title" tabIndex={-1} className="text-xl font-bold tracking-tight text-white">{title}</h1>
          {question && <p className="text-slate-400 mt-1">{question}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return <div role="status" aria-live="polite" className="flex items-center gap-2 text-slate-400 py-8"><span className="inline-block h-4 w-4 rounded-full border-2 border-slate-700 border-t-sky-400 animate-spin" aria-hidden />{what}…</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 text-red-200 p-3 flex items-center justify-between gap-3">
      <span>{message}</span>{onRetry && <button className="underline font-medium" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center"><p className="font-medium text-slate-200">{title}</p><div className="text-slate-400 mt-2 text-sm">{children}</div></div>;
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-950 text-emerald-300 border border-emerald-800', amber: 'bg-amber-950 text-amber-300 border border-amber-800', red: 'bg-red-950 text-red-300 border border-red-800', slate: 'bg-slate-800 text-slate-300 border border-slate-700', blue: 'bg-sky-950 text-sky-300 border border-sky-800', violet: 'bg-violet-950 text-violet-300 border border-violet-800',
};
export const Badge = ({ tone = 'slate', children }: { tone?: keyof typeof TONES; children: React.ReactNode }) => <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-mono font-medium ${TONES[tone]}`}>{children}</span>;

export function Btn({ variant = 'secondary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const v = { primary: 'bg-sky-600 text-white hover:bg-sky-500', secondary: 'bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800', danger: 'bg-slate-900 border border-red-300 text-red-300 hover:bg-red-50', ghost: 'text-sky-400 hover:bg-slate-800' }[variant];
  return <button type="button" {...p} className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${v} ${className}`} />;
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <label className={`block text-sm ${className}`}><span className="font-medium text-slate-200">{label}</span>{hint && <span className="block text-xs text-slate-500">{hint}</span>}<div className="mt-1">{children}</div></label>;
}
export const inputCls = 'w-full rounded-md border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-sky-500 disabled:bg-slate-900 disabled:text-slate-500';

export function NumberInput({ value, onChange, disabled, placeholder = 'Unknown', step = 'any', ...rest }: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean; placeholder?: string; step?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input {...rest} type="number" min={0} step={step} disabled={disabled} placeholder={placeholder} className={inputCls} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
}

export const money = (n: number | null | undefined, cur = 'USD') => (n === null || n === undefined ? 'Unknown' : `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not stated');
export const kindLabel = (k: string) => k.replace(/_/g, ' ');

export function navigate(path: string) { window.location.hash = path; }
export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [r, set] = useState(read);
  useEffect(() => { const f = () => set(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return r;
}
