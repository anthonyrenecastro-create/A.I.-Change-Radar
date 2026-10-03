/**
 * HRM Ecology: Deterministic Replay & Timeline Control
 * Guarantees identical state hashes on replay across seeds and steps.
 */

import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Hash, Compass } from 'lucide-react';
import { SimulationScenario } from '../engine/environment';

interface ReplayControlsProps {
  currentStep: number;
  maxStep: number;
  isRunning: boolean;
  stateHash: string;
  seed: number;
  scenario: SimulationScenario;
  onPlayPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeek: (step: number) => void;
  onReset: (seed?: number, scenario?: SimulationScenario) => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  currentStep,
  maxStep,
  isRunning,
  stateHash,
  seed,
  scenario,
  onPlayPause,
  onStepForward,
  onStepBackward,
  onSeek,
  onReset,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      {/* Upper Status Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
            <Hash className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Hash:</span>
            <span className="text-sky-300 font-bold">{stateHash}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Seed:</span>
            <span className="font-mono text-emerald-300 font-bold">{seed}</span>
          </div>
        </div>

        {/* Scenario Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Domain:</span>
          <select
            value={scenario}
            onChange={e => onReset(seed, e.target.value as SimulationScenario)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 font-mono"
          >
            <option value="ai_ecosystem">AI Ecosystem Twin</option>
            <option value="planetary_rover">Planetary Rover</option>
            <option value="digital_twin">Adaptive Digital Twin</option>
            <option value="embodied_cognition">Embodied Substrate</option>
          </select>
        </div>
      </div>

      {/* Scrub Bar & Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Pause/Step Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onReset(seed, scenario)}
            title="Reset to X0"
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onStepBackward}
            disabled={currentStep <= 0}
            title="Step Backward"
            className="p-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-800 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={onPlayPause}
            className={`p-2 rounded-lg font-medium text-white transition-all flex items-center justify-center ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 border border-amber-400/40'
                : 'bg-sky-600 hover:bg-sky-500 border border-sky-400/40'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={onStepForward}
            title="Step Forward (Execute t -> t+1)"
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 flex items-center gap-3">
          <span className="font-mono text-xs text-sky-400 font-bold shrink-0">
            Step {currentStep} / {maxStep}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0, maxStep)}
            value={currentStep}
            onChange={e => onSeek(Number(e.target.value))}
            className="w-full accent-sky-500 bg-slate-950 cursor-pointer h-2 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};
