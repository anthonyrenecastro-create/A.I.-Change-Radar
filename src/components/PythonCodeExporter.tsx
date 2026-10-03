/**
 * HRM Ecology: Production Python 3.12+ Framework Source Code Viewer & Exporter
 */

import React, { useState } from 'react';
import { PYTHON_FRAMEWORK_FILES } from '../data/pythonFrameworkCode';
import { Code, Copy, Check, Download, Terminal, FileCode } from 'lucide-react';

export const PythonCodeExporter: React.FC = () => {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentFile = PYTHON_FRAMEWORK_FILES[selectedFileIdx];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Production Python 3.12+ Reference Implementation
          </h3>
          <p className="text-xs text-slate-400">
            Strictly typed, protocol-based Python 3.12 library adhering to all HRM constitutional principles
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied File!' : 'Copy Active File'}
        </button>
      </div>

      {/* File Selector Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs border-b border-slate-800">
        {PYTHON_FRAMEWORK_FILES.map((file, idx) => (
          <button
            key={file.path}
            onClick={() => setSelectedFileIdx(idx)}
            className={`px-3 py-1.5 rounded-t-lg transition-colors flex items-center gap-1.5 whitespace-nowrap font-mono ${
              selectedFileIdx === idx
                ? 'bg-slate-950 text-emerald-400 border-t-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            {file.filename}
          </button>
        ))}
      </div>

      {/* Code Viewer Area */}
      <div className="relative bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-200 border border-slate-800 overflow-x-auto max-h-96">
        <pre className="whitespace-pre">{currentFile.content}</pre>
      </div>
    </div>
  );
};
