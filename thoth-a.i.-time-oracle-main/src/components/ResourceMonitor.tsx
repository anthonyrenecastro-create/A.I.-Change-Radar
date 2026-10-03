/**
 * HRM Ecology: Resource Ecology & Stress Gauge Monitor
 * Endogenous resource allocation: compute budget, active width, global stress
 */

import React from 'react';
import { HRMWorldState } from '../types/hrm';
import { Cpu, ShieldAlert, Zap, Layers, Activity } from 'lucide-react';

interface ResourceMonitorProps {
  state: HRMWorldState;
}

export const ResourceMonitor: React.FC<ResourceMonitorProps> = ({ state }) => {
  const { resources, stress, uncertainty } = state;

  const energyRatio = (resources.usedComputeEnergy / resources.totalComputeBudget) * 100;
  const globalStress = stress.globalStress;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-sky-400" /> Endogenous Resource & Stress Ecology
        </h4>
        {stress.safeModeActive ? (
          <span className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> SAFE MODE ACTIVE
          </span>
        ) : (
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono">
            Substrate Nominal
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Compute Energy */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Energy Budget
            </span>
            <span className="font-mono text-amber-300">{energyRatio.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, energyRatio)}%` }}
            />
          </div>
        </div>

        {/* Global Stress */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" /> Global Stress
            </span>
            <span className="font-mono text-rose-300">{globalStress.toFixed(2)}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                globalStress > 0.5 ? 'bg-rose-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, globalStress * 100)}%` }}
            />
          </div>
        </div>

        {/* Active Width */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
          <span className="text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-sky-400" /> Active Width
          </span>
          <span className="font-mono text-base font-bold text-sky-300 block">
            {resources.activeWidth} Nodes
          </span>
        </div>

        {/* Sensor Confidence */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
          <span className="text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-emerald-400" /> Sensor Confidence
          </span>
          <span className="font-mono text-base font-bold text-emerald-300 block">
            {(uncertainty.sensorConfidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};
