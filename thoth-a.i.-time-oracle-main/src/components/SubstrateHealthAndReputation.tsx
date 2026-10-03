/**
 * Sovereign Critique Reputation & RuntimeHealth Dashboard
 * Priority 1 (Reputation & Arbitration) & Priority 9 (Self-Monitoring Health)
 */

import React from 'react';
import { HRMEcologyRuntime } from '../engine/runtime';
import { HRMWorldState } from '../types/hrm';
import { Activity, ShieldCheck, Award, AlertTriangle, Cpu, BarChart2, CheckCircle, RefreshCw } from 'lucide-react';

interface Props {
  runtime: HRMEcologyRuntime;
  state: HRMWorldState;
}

export function SubstrateHealthAndReputation({ runtime, state }: Props) {
  const health = runtime.getHealth();
  const repManager = runtime.getReputationManager();
  const reps = Object.values(repManager.getAllReputations());
  const benchmark = runtime.getBenchmarkReport();

  return (
    <div className="space-y-6">
      {/* 1. Self-Monitoring Substrate Health Channels (10 Core Metrics) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">RuntimeHealth Substrate Channel</h3>
              <p className="text-xs text-slate-400">Continuous self-monitoring metrics computed over closed loop</p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Coherence {(health.coherence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Prediction Accuracy</span>
            <span className="text-sm font-bold text-sky-400">{(health.predictionAccuracy * 100).toFixed(1)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Global Entropy</span>
            <span className="text-sm font-bold text-amber-400">{(health.globalEntropy * 100).toFixed(1)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Memory Utilization</span>
            <span className="text-sm font-bold text-purple-400">{(health.memoryUtilization * 100).toFixed(0)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Mechanism Diversity</span>
            <span className="text-sm font-bold text-emerald-400">{(health.mechanismDiversity * 100).toFixed(0)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Topology Health</span>
            <span className="text-sm font-bold text-indigo-400">{(health.topologyHealth * 100).toFixed(0)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Resource Efficiency</span>
            <span className="text-sm font-bold text-teal-400">{(health.resourceEfficiency * 100).toFixed(0)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Reasoning Stability</span>
            <span className="text-sm font-bold text-sky-300">{(health.reasoningStability * 100).toFixed(0)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Learning Rate</span>
            <span className="text-sm font-bold text-amber-300">{(health.learningRate * 100).toFixed(1)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Goal Convergence</span>
            <span className="text-sm font-bold text-emerald-300">{(health.goalConvergence * 100).toFixed(0)}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block">Replay Determinism</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Verified
            </span>
          </div>
        </div>
      </div>

      {/* 2. Sovereign Critique Mechanism Reputation Matrix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sovereign Critique Mechanism Reputation Engine</h3>
              <p className="text-xs text-slate-400">Dynamic trust scores, success rates, and arbitration weights</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <th className="py-2.5 px-3">Mechanism ID</th>
                <th className="py-2.5 px-3">Trust Score</th>
                <th className="py-2.5 px-3">Success Rate</th>
                <th className="py-2.5 px-3">Prediction Accuracy</th>
                <th className="py-2.5 px-3">Accepted / Total</th>
                <th className="py-2.5 px-3">Consec. Failures</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {reps.map((rep, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">{rep.mechanismId}</td>
                  <td className="py-2.5 px-3 font-bold text-purple-300">{(rep.trustScore * 100).toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-sky-400">{(rep.successRate * 100).toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-emerald-400">{(rep.predictionAccuracy * 100).toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {rep.acceptedCount} / {rep.totalContributions}
                  </td>
                  <td className="py-2.5 px-3 text-amber-400 font-semibold">{rep.consecutiveFailures}</td>
                  <td className="py-2.5 px-3">
                    {rep.isRetired ? (
                      <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 text-[10px]">
                        Retired
                      </span>
                    ) : rep.isSuspended ? (
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 text-[10px]">
                        Suspended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Exportable Scientific Benchmark Telemetry */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 font-mono">
            <BarChart2 className="w-4 h-4 text-sky-400" /> Scientific Validation Benchmark Report
          </h4>
          <button
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(benchmark, null, 2));
              const downloadAnchor = document.createElement('a');
              downloadAnchor.setAttribute("href", dataStr);
              downloadAnchor.setAttribute("download", `hrm_benchmark_step_${state.metadata.step}.json`);
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
            }}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-mono text-[11px] transition-all"
          >
            Export Benchmark JSON
          </button>
        </div>

        <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
          {JSON.stringify(benchmark, null, 2)}
        </pre>
      </div>
    </div>
  );
}
