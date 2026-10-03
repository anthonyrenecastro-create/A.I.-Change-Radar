/**
 * HRM Ecology: Computational Conservation of Explanation Ledger
 * Principle 6: Computational Conservation of Explanation
 */

import React, { useState } from 'react';
import { LedgerEntry } from '../types/hrm';
import { FileText, Search, ShieldAlert, ArrowRight, Activity } from 'lucide-react';

interface LedgerViewProps {
  ledger: LedgerEntry[];
  selectedStep: number;
  onSelectStep: (step: number) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  ledger,
  selectedStep,
  onSelectStep,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = ledger.filter(entry => {
    const query = searchTerm.toLowerCase();
    if (!query) return true;
    return (
      entry.step.toString().includes(query) ||
      entry.previousStateHash.toLowerCase().includes(query) ||
      entry.newStateHash.toLowerCase().includes(query) ||
      entry.acceptedContributions.some(c => c.mechanismId.toLowerCase().includes(query)) ||
      entry.safetyInterventions.some(i => i.toLowerCase().includes(query))
    );
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            Computational Explanation Ledger
          </h3>
          <p className="text-xs text-slate-400">
            Append-only record tracing every state transition, transport mass, and attribution
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search mechanism, hash, step..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 sticky top-0">
            <tr>
              <th className="p-2.5">Step</th>
              <th className="p-2.5">State Hash Transition</th>
              <th className="p-2.5">Contribs</th>
              <th className="p-2.5">Transport Residual</th>
              <th className="p-2.5">Safety Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredEntries.map(entry => {
              const isSelected = entry.step === selectedStep;

              return (
                <tr
                  key={entry.step}
                  onClick={() => onSelectStep(entry.step)}
                  className={`cursor-pointer transition-colors hover:bg-slate-800/40 ${
                    isSelected ? 'bg-sky-950/40 text-sky-200 border-l-2 border-sky-400' : 'text-slate-300'
                  }`}
                >
                  <td className="p-2.5 font-bold text-sky-400">#{entry.step}</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500">{entry.previousStateHash.slice(0, 10)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <span className="text-sky-300 font-semibold">{entry.newStateHash.slice(0, 10)}</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-slate-400">
                    {entry.acceptedContributions.length} acc / {entry.rejectedContributions.length} rej
                  </td>
                  <td className="p-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        entry.residual < 0.001
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {entry.residual.toFixed(6)}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {entry.safetyInterventions.length === 0 ? (
                      <span className="text-emerald-400 text-[11px]">Verified Safe</span>
                    ) : (
                      <span className="text-rose-400 text-[11px] flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> {entry.safetyInterventions.length} Rules
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
