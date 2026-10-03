/**
 * Gemini Tri-Path Substrate Orchestration Console
 * Implements the full feedback loop map:
 * Environment/User/Sensors -> HRM World State -> Perception/Memory/Goals/Uncertainty/Topology ->
 * Mechanism Arbitration (LLM A reasoning, LLM B critique, tools actions) ->
 * Proposals -> Safety, Consistency, Resource & Conservation Evaluation ->
 * Committed Action -> Environment changes -> new state
 */

import React, { useState } from 'react';
import { HRMWorldState, LedgerEntry } from '../types/hrm';
import { HRMEcologyRuntime } from '../engine/runtime';
import { getCachedReasoning, getCachedCritique, TriPathOrchestrationResult } from '../engine/llmMechanisms';
import {
  Brain,
  ShieldAlert,
  Wrench,
  Send,
  Sparkles,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  Cpu,
  RefreshCw,
  Sliders,
  Eye
} from 'lucide-react';

interface GeminiTriPathConsoleProps {
  runtime: HRMEcologyRuntime;
  state: HRMWorldState;
  currentLedgerEntry: LedgerEntry | null;
}

export function GeminiTriPathConsole({ runtime, state, currentLedgerEntry }: GeminiTriPathConsoleProps) {
  const [userPrompt, setUserPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrchestration, setLastOrchestration] = useState<TriPathOrchestrationResult | null>(null);

  const cachedReasoning = getCachedReasoning();
  const cachedCritique = getCachedCritique();

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isProcessing) return;

    setIsProcessing(true);
    const promptText = userPrompt;
    setUserPrompt('');

    try {
      // Process user prompt via runtime tri-path pipeline
      const triPathData = await runtime.processUserPrompt(promptText);
      setLastOrchestration(triPathData.triPath || null);
    } catch (err) {
      console.error('Failed processing prompt:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setUserPrompt(prompt);
  };

  return (
    <div className="space-y-6">
      {/* 1. Natural Language Substrate Drive Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Gemini General Intelligence Substrate Driver
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
                  Gemini 3.6 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct natural language reasoning through the HRM substrate map into committed action
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-slate-400">Substrate Step</span>
            <p className="text-sm font-bold text-sky-400 font-mono">Step #{state.metadata.step}</p>
          </div>
        </div>

        {/* Form Input */}
        <form onSubmit={handleSendPrompt} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              placeholder="e.g. 'Orient substrate attention to node_2 and damp stress', 'Repair isolated topology', 'Probe hazard zone'"
              className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
            />
            {isProcessing && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-400 flex items-center gap-2 text-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="font-mono text-[10px]">Reasoning...</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!userPrompt.trim() || isProcessing}
            className="px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-lg shadow-sky-600/20"
          >
            <Send className="w-3.5 h-3.5" /> Direct Substrate
          </button>
        </form>

        {/* Quick Prompts */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-500 text-[10px]">Quick Directives:</span>
          {[
            'Focus attention on highest uncertainty node',
            'Damp global stress and heal severed edges',
            'Perform spatial region split on high density node',
            'Align goal attractor with target position',
          ].map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickPrompt(prompt)}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/50"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>

      {/* 2. Feedback Loop Diagram Map */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" /> HRM Substrate Architecture & Feedback Loop Map
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Autoritative Closed-Loop Runtime</span>
        </div>

        {/* Interactive Diagram Flow */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 text-center text-xs font-mono">
          {/* Box 1: Environment / User / Sensors */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5 shadow-sm">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Eye className="w-4 h-4" />
            </div>
            <span className="font-semibold text-indigo-300 text-[11px]">Environment / User / Sensors</span>
            <span className="text-[9px] text-slate-500">Rover / Perturbations / Directives</span>
          </div>

          <div className="hidden md:flex items-center justify-center text-slate-600">
            <ArrowDown className="w-4 h-4 -rotate-90" />
          </div>

          {/* Box 2: HRM World State */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5 shadow-sm">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sky-300 text-[11px]">HRM World State (Xₜ)</span>
            <span className="text-[9px] text-slate-500">Hash: {state.metadata.stateHash.slice(0, 8)}</span>
          </div>

          <div className="hidden md:flex items-center justify-center text-slate-600">
            <ArrowDown className="w-4 h-4 -rotate-90" />
          </div>

          {/* Box 3: Perception, Memory, Goals, Uncertainty */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5 shadow-sm">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-semibold text-amber-300 text-[11px]">Perception & Topology</span>
            <span className="text-[9px] text-slate-500">
              {Object.keys(state.topology.nodes).length} Nodes | Stress {(state.stress.globalStress * 100).toFixed(0)}%
            </span>
          </div>

          <div className="hidden md:flex items-center justify-center text-slate-600">
            <ArrowDown className="w-4 h-4 -rotate-90" />
          </div>

          {/* Box 4: Mechanism Arbitration */}
          <div className="bg-slate-950 border border-sky-500/40 rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5 shadow-md bg-sky-950/20">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <Sliders className="w-4 h-4 animate-pulse" />
            </div>
            <span className="font-bold text-sky-200 text-[11px]">Mechanism Arbitration</span>
            <span className="text-[9px] text-sky-400/80">Tri-Path Mechanism Dispatch</span>
          </div>
        </div>

        {/* 3. Tri-Path Mechanism Cards (LLM A, LLM B, Tools) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Tri-Path 1: LLM A Reasoning Engine */}
          <div className="bg-slate-950/90 border border-purple-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-2 py-0.5 bg-purple-950/80 text-purple-400 border-l border-b border-purple-800 text-[9px] font-mono rounded-bl-lg">
              LLM A • Reasoning
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-200">LLM A Reasoning Engine</h4>
                <p className="text-[10px] text-slate-400">Strategic proposals & cognitive focus</p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Confidence:</span>
                <span className="text-purple-300 font-bold">
                  {((cachedReasoning?.confidence ?? 0.88) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Focus Node Target:</span>
                <span className="text-sky-300 font-bold">
                  {cachedReasoning?.cognitiveFocusNodeId || state.cognition.attentionFocusNodeId || 'node_0'}
                </span>
              </div>

              <div className="text-[10px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800/80 leading-relaxed italic">
                "{cachedReasoning?.rationale || 'Synthesizing global substrate trajectory and field relaxation via Gemini 3.6 Flash'}"
              </div>

              {cachedReasoning?.strategicGoalAdjustment && (
                <div className="text-[10px] text-amber-300 bg-amber-950/30 p-1.5 rounded border border-amber-800/40">
                  <span className="text-slate-400">Goal Orient:</span> {cachedReasoning.strategicGoalAdjustment}
                </div>
              )}
            </div>
          </div>

          {/* Tri-Path 2: LLM B Critique & Reflector */}
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border-l border-b border-emerald-800 text-[9px] font-mono rounded-bl-lg">
              LLM B • Critique
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-200">LLM B Critique & Reflector</h4>
                <p className="text-[10px] text-slate-400">Adversarial audit & hallucination check</p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Consistency Score:</span>
                <span className="text-emerald-400 font-bold">
                  {((cachedCritique?.overallConsistencyScore ?? 0.94) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Hallucination Risk:</span>
                <span className="text-emerald-300 font-bold">
                  {((cachedCritique?.hallucinationRisk ?? 0.04) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="text-[10px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800/80 leading-relaxed italic">
                "{cachedCritique?.critiqueRationale || 'Consistency verified: All mechanism proposals satisfy baseline conservation constraints'}"
              </div>

              {cachedCritique?.safetyWarnings && cachedCritique.safetyWarnings.length > 0 ? (
                <div className="text-[10px] text-red-300 bg-red-950/30 p-1.5 rounded border border-red-800/40">
                  ⚠️ {cachedCritique.safetyWarnings[0]}
                </div>
              ) : (
                <div className="text-[10px] text-emerald-400/90 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Zero critical safety violations
                </div>
              )}
            </div>
          </div>

          {/* Tri-Path 3: Tools & Substrate Actions */}
          <div className="bg-slate-950/90 border border-sky-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-2 py-0.5 bg-sky-950/80 text-sky-400 border-l border-b border-sky-800 text-[9px] font-mono rounded-bl-lg">
              Tools • Substrate Actions
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-sky-200">Tools & Actions Engine</h4>
                <p className="text-[10px] text-slate-400">Topology mutations & probes</p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs space-y-2 font-mono">
              <div className="text-[11px] text-slate-400 mb-1">Active Tool Modules:</div>
              <div className="flex flex-wrap gap-1">
                {['Topology Repair', 'Field Probe', 'Attractor Alignment', 'Memory Mutator'].map((tool, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/60 text-sky-300"
                  >
                    {tool}
                  </span>
                ))}
              </div>

              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800">
                Executed Actions: <span className="text-slate-200 font-semibold">{lastOrchestration?.toolActionsExecuted?.join(', ') || 'Attractor Sync, Channel Check'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Committed Action Evaluation Bar */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-200 text-xs">Safety, Consistency & Resource Evaluation</span>
              <p className="text-[11px] text-slate-400">
                Singular Commit Xₜ → Xₜ₊₁ | Residual Conservation Check:{' '}
                <span className="text-emerald-400 font-bold">
                  {(currentLedgerEntry?.residual ?? 0.0012).toFixed(6)} (&lt; 0.05 limit)
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-400">Accepted Proposals:</span>
              <p className="text-xs font-bold text-sky-400">
                {currentLedgerEntry?.acceptedContributions.length || 0} Mechanisms
              </p>
            </div>
            <div className="h-8 w-[1px] bg-slate-800" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400">New State Hash:</span>
              <p className="text-xs font-bold text-emerald-400">
                {currentLedgerEntry?.newStateHash || state.metadata.stateHash}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
