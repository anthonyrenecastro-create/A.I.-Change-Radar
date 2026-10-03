import React from 'react';
import { HRMWorldState } from '../types/hrm';
import { AISystemTwin } from '../types/aiEcosystem';

interface AIEcosystemDashboardProps {
  state: HRMWorldState;
}

function asPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export const AIEcosystemDashboard: React.FC<AIEcosystemDashboardProps> = ({ state }) => {
  if (!state.aiEcosystem) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-sm text-slate-400">
        AI ecosystem twins are inactive for this scenario. Switch domain to AI Ecosystem Twin.
      </div>
    );
  }

  const eco = state.aiEcosystem;
  const indicators = eco.indicators;
  const recent = eco.recentContributions.slice(0, 6);
  const systems: AISystemTwin[] = Object.values(eco.aiSystems) as AISystemTwin[];

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">AI Ecosystem World State</h3>
          <span className="text-xs font-mono text-slate-500">Step {state.metadata.step}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Capability Frontier</p>
            <p className="text-lg font-bold text-sky-300">{asPct(indicators.capabilityFrontierIndex)}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Safety Readiness</p>
            <p className="text-lg font-bold text-emerald-300">{asPct(indicators.safetyReadinessIndex)}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Infrastructure Stress</p>
            <p className="text-lg font-bold text-amber-300">{asPct(indicators.infrastructureStressIndex)}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Governance Coordination</p>
            <p className="text-lg font-bold text-cyan-300">{asPct(indicators.governanceCoordinationIndex)}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Ecosystem Volatility</p>
            <p className="text-lg font-bold text-rose-300">{asPct(indicators.ecosystemVolatilityIndex)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Model Twin Snapshot</h4>
          <div className="space-y-2 text-xs">
            {systems.map(system => (
              <div key={system.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-100">{system.label}</p>
                  <p className="font-mono text-slate-400">{system.modelFamily}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-slate-300">
                  <p>Reasoning: <span className="text-sky-300">{asPct(system.reasoningPerformance)}</span></p>
                  <p>Autonomy: <span className="text-sky-300">{asPct(system.autonomyLevel)}</span></p>
                  <p>Safety: <span className="text-emerald-300">{asPct(system.safetyControls)}</span></p>
                  <p>Hallucination: <span className="text-rose-300">{asPct(system.hallucinationRate)}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Recent Mechanism Forecasts</h4>
          <div className="space-y-2 text-xs">
            {recent.length === 0 && (
              <p className="text-slate-400">No accepted AI ecosystem contributions yet. Run a few steps.</p>
            )}
            {recent.map((item, i) => (
              <div key={`${item.mechanismId}-${i}`} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-200 font-semibold">{item.mechanismId}</p>
                  <p className="text-slate-500 uppercase tracking-wide">{item.mechanismType}</p>
                </div>
                <p className="text-slate-300 mt-1">{item.summary}</p>
                <div className="flex items-center gap-4 mt-2 text-slate-400">
                  <span>Confidence: {asPct(item.confidence)}</span>
                  <span>Disagreement: {asPct(item.disagreement)}</span>
                  <span>Changes: {item.changes.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
