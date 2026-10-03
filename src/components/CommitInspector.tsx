/**
 * HRM Ecology: Singular Commit & Proposal Inspector
 * Principle 3: Proposal, Never Mutation
 * Principle 4: Singular Commit
 */

import React, { useState } from 'react';
import { LedgerEntry, Contribution } from '../types/hrm';
import { CheckCircle, XCircle, Activity, Cpu, Sparkles, Filter } from 'lucide-react';

interface CommitInspectorProps {
  currentLedgerEntry: LedgerEntry | null;
  stepNumber: number;
}

export const CommitInspector: React.FC<CommitInspectorProps> = ({
  currentLedgerEntry,
  stepNumber,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'accepted' | 'rejected'>('all');

  if (!currentLedgerEntry) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-sm">
        No state transitions committed yet. Advance simulation step to observe mechanism proposals.
      </div>
    );
  }

  const acceptedList = currentLedgerEntry.acceptedContributions;
  const rejectedList = currentLedgerEntry.rejectedContributions;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            Singular Commit Proposal Inspector (Step {stepNumber})
          </h3>
          <p className="text-xs text-slate-400">
            Mechanism proposals received simultaneously from Common Snapshot X_{stepNumber - 1}
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filterType === 'all' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({acceptedList.length + rejectedList.length})
          </button>
          <button
            onClick={() => setFilterType('accepted')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filterType === 'accepted' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Accepted ({acceptedList.length})
          </button>
          <button
            onClick={() => setFilterType('rejected')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filterType === 'rejected' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rejected ({rejectedList.length})
          </button>
        </div>
      </div>

      {/* Proposals List */}
      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {(filterType === 'all' || filterType === 'accepted') &&
          acceptedList.map((item, idx) => (
            <div
              key={`acc_${idx}`}
              className="bg-slate-950/80 border border-emerald-900/50 rounded-lg p-3 text-xs flex items-start justify-between gap-3"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-mono font-medium text-emerald-300">{item.mechanismId}</span>
                  <span className="bg-emerald-950 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-800">
                    Accepted (Weight: {item.weight.toFixed(3)})
                  </span>
                </div>
                <p className="text-slate-300 font-sans">{item.rationale}</p>
              </div>
              <div className="text-right shrink-0 font-mono text-[11px] text-slate-400">
                <span className="block text-slate-500">Cost</span>
                {item.cost} compute
              </div>
            </div>
          ))}

        {(filterType === 'all' || filterType === 'rejected') &&
          rejectedList.map((item, idx) => (
            <div
              key={`rej_${idx}`}
              className="bg-slate-950/80 border border-rose-900/40 rounded-lg p-3 text-xs flex items-start justify-between gap-3"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-mono font-medium text-rose-300">{item.mechanismId}</span>
                  <span className="bg-rose-950 text-rose-400 text-[10px] px-2 py-0.5 rounded border border-rose-800">
                    Rejected Proposal
                  </span>
                </div>
                <p className="text-slate-400 font-sans">{item.reason}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
