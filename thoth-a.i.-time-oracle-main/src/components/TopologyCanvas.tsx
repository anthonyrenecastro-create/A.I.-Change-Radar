/**
 * HRM Ecology: Interactive Topology & Substrate Canvas Visualizer
 * Renders graph geometry, field energy gradients, conductance edges, particle flows, and selected node diagnostics.
 */

import React, { useRef, useEffect, useState } from 'react';
import { HRMWorldState, NodeGeometry, NodeId } from '../types/hrm';
import { EnvironmentSimulator } from '../engine/environment';
import { Zap, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

interface TopologyCanvasProps {
  state: HRMWorldState;
  environment: EnvironmentSimulator;
  selectedNodeId: NodeId | null;
  onSelectNode: (nodeId: NodeId | null) => void;
  onSplitNodeRequest: (nodeId: NodeId) => void;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  state,
  environment,
  selectedNodeId,
  onSelectNode,
  onSplitNodeRequest,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [particles, setParticles] = useState<Array<{ x: number; y: number; edgeId: string; progress: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Render Background Substrate Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Render Region Boundary Clustered Overlays
      const nodes = state.topology.nodes;
      const field = state.field.values;
      const stress = state.stress.nodeStress;

      // 3. Render Topological Conductance Edges
      const edges = state.topology.edges;
      for (const edgeId in edges) {
        const edge = edges[edgeId];
        const n1 = nodes[edge.source];
        const n2 = nodes[edge.target];
        if (!n1 || !n2) continue;

        ctx.beginPath();
        ctx.moveTo(n1.position.x, n1.position.y);
        ctx.lineTo(n2.position.x, n2.position.y);

        if (!edge.active) {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'; // Severed red
          ctx.lineWidth = 1.5;
        } else {
          ctx.setLineDash([]);
          const alpha = 0.2 + edge.conductance * 0.6;
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
          ctx.lineWidth = Math.max(1, edge.conductance * 3.5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. Render Moving Environment Entities
      const entities = environment.getEntities();
      for (const ent of entities) {
        ctx.beginPath();
        ctx.arc(ent.position.x, ent.position.y, ent.radius, 0, Math.PI * 2);
        if (ent.type === 'target') {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
          ctx.strokeStyle = '#22c55e';
        } else if (ent.type === 'hazard') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.strokeStyle = '#ef4444';
        } else {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.15)';
          ctx.strokeStyle = '#64748b';
        }
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(ent.id, ent.position.x - ent.radius + 2, ent.position.y + ent.radius + 12);
      }

      // 5. Render Topological Nodes & Field Halos
      for (const nodeId in nodes) {
        const node = nodes[nodeId];
        const val = field[nodeId] ?? 0.2;
        const nodeStr = stress[nodeId] ?? 0.05;
        const isSelected = nodeId === selectedNodeId;

        // Outer Glow Halo based on Continuous Field Energy [0, 1]
        const haloRadius = 16 + val * 24;
        const gradient = ctx.createRadialGradient(
          node.position.x, node.position.y, 4,
          node.position.x, node.position.y, haloRadius
        );

        if (nodeStr > 0.4) {
          gradient.addColorStop(0, 'rgba(239, 68, 68, 0.6)');
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        } else {
          gradient.addColorStop(0, `rgba(14, 165, 233, ${0.4 + val * 0.4})`);
          gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
        }

        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, haloRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Node Solid Core
        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#38bdf8' : '#0f172a';
        ctx.strokeStyle = nodeStr > 0.4 ? '#ef4444' : isSelected ? '#38bdf8' : '#38bdf8';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.fill();
        ctx.stroke();

        // Node Label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px monospace';
        ctx.fillText(node.id, node.position.x - 18, node.position.y - 12);

        // Field Value Indicator
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText(`F:${val.toFixed(2)}`, node.position.x - 14, node.position.y + 18);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, environment, selectedNodeId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let clickedNode: NodeId | null = null;
    for (const nodeId in state.topology.nodes) {
      const node = state.topology.nodes[nodeId];
      const dist = Math.hypot(node.position.x - clickX, node.position.y - clickY);
      if (dist < 22) {
        clickedNode = nodeId;
        break;
      }
    }
    onSelectNode(clickedNode);
  };

  const selectedNode = selectedNodeId ? state.topology.nodes[selectedNodeId] : null;

  return (
    <div className="relative w-full h-[480px] bg-slate-950 rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden flex">
      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        width={680}
        height={480}
        onClick={handleCanvasClick}
        className="cursor-pointer flex-1"
      />

      {/* Side Inspector Overlay for Selected Node */}
      {selectedNode ? (
        <div className="w-64 bg-slate-900/95 border-l border-slate-800 p-4 text-xs flex flex-col justify-between backdrop-blur-md">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="font-mono font-semibold text-sky-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4" /> {selectedNode.id}
              </span>
              <button
                onClick={() => onSelectNode(null)}
                className="text-slate-500 hover:text-slate-300 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Region:</span>
                <span className="font-mono">{selectedNode.regionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Manifold:</span>
                <span className="font-mono">{selectedNode.manifoldId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Position:</span>
                <span className="font-mono">
                  ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-slate-400">Field Energy F:</span>
                <span className="font-mono font-bold text-sky-400">
                  {(state.field.values[selectedNode.id] ?? 0).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Stress Level:</span>
                <span
                  className={`font-mono font-bold ${
                    (state.stress.nodeStress[selectedNode.id] ?? 0) > 0.4
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {(state.stress.nodeStress[selectedNode.id] ?? 0).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Uncertainty:</span>
                <span className="font-mono text-amber-400">
                  {(state.uncertainty.nodeUncertainties[selectedNode.id] ?? 0).toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSplitNodeRequest(selectedNode.id)}
            className="w-full py-2 bg-sky-600/80 hover:bg-sky-500 text-white font-medium rounded border border-sky-400/30 transition-all flex items-center justify-center gap-1"
          >
            <Zap className="w-3.5 h-3.5" /> Request Region Split
          </button>
        </div>
      ) : (
        <div className="absolute top-3 left-3 bg-slate-900/80 px-3 py-1.5 rounded-md border border-slate-800 text-[11px] text-slate-400 pointer-events-none flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Click node on canvas to view state & stress metrics
        </div>
      )}
    </div>
  );
};
