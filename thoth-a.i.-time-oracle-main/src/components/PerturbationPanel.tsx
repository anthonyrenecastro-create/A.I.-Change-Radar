/**
 * HRM Ecology: Environmental Perturbation & Structural Stress Injection
 * Allows live stress-testing of substrate resilience and safety interventions
 */

import React from 'react';
import { HRMEcologyRuntime } from '../engine/runtime';
import { AlertOctagon, Radio, Flame, Scissors, Shield } from 'lucide-react';

interface PerturbationPanelProps {
  runtime: HRMEcologyRuntime;
}

export const PerturbationPanel: React.FC<PerturbationPanelProps> = ({ runtime }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2">
        <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
        Inject Environmental Perturbations & Structural Damage
      </h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <button
          onClick={() => runtime.injectEMPStrike()}
          className="p-2.5 bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-rose-300 rounded-lg transition-all flex flex-col items-center gap-1.5 text-center group"
        >
          <Radio className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold">EMP Strike</span>
          <span className="text-[10px] text-slate-500">Sensor Blackout</span>
        </button>

        <button
          onClick={() => runtime.injectNoiseInflux()}
          className="p-2.5 bg-slate-950 hover:bg-amber-950/60 border border-slate-800 hover:border-amber-800 text-amber-300 rounded-lg transition-all flex flex-col items-center gap-1.5 text-center group"
        >
          <Flame className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold">Noise Influx</span>
          <span className="text-[10px] text-slate-500">High Uncertainty</span>
        </button>

        <button
          onClick={() => runtime.injectSeverRegion('region_north')}
          className="p-2.5 bg-slate-950 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-800 text-purple-300 rounded-lg transition-all flex flex-col items-center gap-1.5 text-center group"
        >
          <Scissors className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold">Sever Region</span>
          <span className="text-[10px] text-slate-500">Cut Graph Edges</span>
        </button>

        <button
          onClick={() => runtime.toggleSafeMode()}
          className="p-2.5 bg-slate-950 hover:bg-sky-950/60 border border-slate-800 hover:border-sky-800 text-sky-300 rounded-lg transition-all flex flex-col items-center gap-1.5 text-center group"
        >
          <Shield className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold">Toggle Safe Mode</span>
          <span className="text-[10px] text-slate-500">Override Lockouts</span>
        </button>
      </div>
    </div>
  );
};
