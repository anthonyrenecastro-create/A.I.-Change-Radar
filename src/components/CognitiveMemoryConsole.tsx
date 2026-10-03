/**
 * Cognitive Memory Architecture Inspector
 * Priority 2: 4-Layer Memory System (Working, Episodic, Semantic, Procedural)
 */

import React, { useState } from 'react';
import { HRMWorldState } from '../types/hrm';
import { Brain, Database, Cpu, Layers, Tag, Bookmark } from 'lucide-react';

interface Props {
  state: HRMWorldState;
}

export function CognitiveMemoryConsole({ state }: Props) {
  const [activeTab, setActiveTab] = useState<'working' | 'episodic' | 'semantic' | 'procedural'>('working');

  const memory = state.memory;
  const nodes = Object.values(memory.nodes);

  const workingMem = memory.workingMemory;
  const episodicNodes = nodes.filter(n => n.type === 'episodic');
  const semanticNodes = nodes.filter(n => n.type === 'semantic');
  const proceduralNodes = nodes.filter(n => n.type === 'procedural');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Cognitive Memory Architecture</h3>
            <p className="text-xs text-slate-400">4-Layer Persistent Cognitive Substrate Memory</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-purple-300">
            Capacity: {nodes.length} / {memory.capacity} Nodes
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-sky-300">
            Total Mass: {memory.totalMass.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('working')}
          className={`px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-1.5 ${
            activeTab === 'working'
              ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 font-bold'
              : 'border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Working Memory
        </button>

        <button
          onClick={() => setActiveTab('episodic')}
          className={`px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-1.5 ${
            activeTab === 'episodic'
              ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 font-bold'
              : 'border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> Episodic ({episodicNodes.length})
        </button>

        <button
          onClick={() => setActiveTab('semantic')}
          className={`px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-1.5 ${
            activeTab === 'semantic'
              ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 font-bold'
              : 'border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Tag className="w-3.5 h-3.5" /> Semantic ({semanticNodes.length})
        </button>

        <button
          onClick={() => setActiveTab('procedural')}
          className={`px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-1.5 ${
            activeTab === 'procedural'
              ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 font-bold'
              : 'border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> Procedural ({proceduralNodes.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {activeTab === 'working' && (
          <div className="space-y-3">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-slate-400 font-bold text-[11px] block">Active Perceptual Observations:</span>
              {workingMem?.activeObservations.length ? (
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  {workingMem.activeObservations.map((obs, idx) => (
                    <li key={idx}>{obs}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">No active working observations</span>
              )}
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-slate-400 font-bold text-[11px] block">Active Hypotheses:</span>
              {workingMem?.activeHypotheses.length ? (
                <ul className="space-y-1">
                  {workingMem.activeHypotheses.map((hyp, idx) => (
                    <li key={idx} className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-slate-200">{hyp.description}</span>
                      <span className="text-purple-400 font-bold">Confidence: {(hyp.confidence * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">No active hypotheses</span>
              )}
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-slate-400 font-bold text-[11px] block">Temporary Cognitive Plans:</span>
              {workingMem?.temporaryPlans.length ? (
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  {workingMem.temporaryPlans.map((plan, idx) => (
                    <li key={idx}>{plan}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">No temporary plans queued</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'episodic' && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {episodicNodes.map(node => (
              <div key={node.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="font-bold text-sky-400">{node.id}</span>
                  <span>Salience: {(node.salience * 100).toFixed(0)}% | Step {node.lastAccessedStep}</span>
                </div>
                <p className="text-slate-200">{node.content}</p>
                <div className="text-[10px] text-slate-500">
                  Associated Nodes: {node.associatedNodeIds.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'semantic' && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {semanticNodes.map(node => (
              <div key={node.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="font-bold text-purple-400">{node.id}</span>
                  <span>Salience: {(node.salience * 100).toFixed(0)}%</span>
                </div>
                <p className="text-slate-200">{node.content}</p>
                <div className="text-[10px] text-slate-500">
                  Associated Nodes: {node.associatedNodeIds.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'procedural' && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {proceduralNodes.map(node => (
              <div key={node.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="font-bold text-emerald-400">{node.id}</span>
                  <span>Usefulness Score: {((node.usefulnessScore || 0.8) * 100).toFixed(0)}%</span>
                </div>
                <p className="text-slate-200">{node.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
