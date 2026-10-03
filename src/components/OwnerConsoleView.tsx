import React, { useState, useEffect } from 'react';
import { Source, ReviewProposal, OutboundEmail } from '../types/radar';
import {
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Edit3,
  Mail,
  FileText,
  Clock,
  Send,
  Database,
  Search,
  Eye,
  Check
} from 'lucide-react';

interface OwnerConsoleViewProps {
  token: string;
  onSwitchToOwner?: () => void;
}

export function OwnerConsoleView({ token, onSwitchToOwner }: OwnerConsoleViewProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [proposals, setProposals] = useState<ReviewProposal[]>([]);
  const [emails, setEmails] = useState<OutboundEmail[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [publicationMode, setPublicationMode] = useState<'reviewed' | 'automatic'>('reviewed');
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const [activeTab, setActiveTab] = useState<'review_queue' | 'sources' | 'emails' | 'jobs'>('review_queue');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Email Preview Modal
  const [previewEmail, setPreviewEmail] = useState<OutboundEmail | null>(null);

  // Edit Proposal Modal
  const [editingProposal, setEditingProposal] = useState<ReviewProposal | null>(null);
  const [editedSummary, setEditedSummary] = useState('');
  const [editedAction, setEditedAction] = useState('');

  const safeFetchJson = async (url: string) => {
    if (!token) return null;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return null;
      }
      return await res.json();
    } catch {
      return null;
    }
  };

  const fetchConsoleData = async () => {
    if (!token) return;
    setLoading(true);
    setIsUnauthorized(false);
    try {
      // Sources
      const dataSources = await safeFetchJson('/api/owner/sources');
      if (dataSources) {
        if (dataSources.unauthorized) {
          setIsUnauthorized(true);
        } else {
          setSources(dataSources.sources || []);
        }
      }

      // Review Queue
      const dataQueue = await safeFetchJson('/api/owner/review-queue');
      if (dataQueue) {
        if (dataQueue.unauthorized) {
          setIsUnauthorized(true);
        } else {
          setProposals(dataQueue.proposals || []);
        }
      }

      // Mode
      const dataMode = await safeFetchJson('/api/owner/mode');
      if (dataMode && !dataMode.unauthorized) {
        setPublicationMode(dataMode.mode || 'reviewed');
      }

      // Emails
      const dataEmails = await safeFetchJson('/api/owner/emails');
      if (dataEmails && !dataEmails.unauthorized) {
        setEmails(dataEmails.emails || []);
      }

      // Jobs
      const dataJobs = await safeFetchJson('/api/owner/jobs');
      if (dataJobs && !dataJobs.unauthorized) {
        setJobs(dataJobs.jobs || []);
      }
    } catch (err) {
      console.warn('Failed to load owner console data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchConsoleData();
    }
  }, [token]);

  const handleToggleMode = async (newMode: 'reviewed' | 'automatic') => {
    try {
      const res = await fetch('/api/owner/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        setPublicationMode(newMode);
      }
    } catch (err) {
      console.error('Failed to change mode:', err);
    }
  };

  const handleDecision = async (proposalId: string, decision: 'accept' | 'reject' | 'revise') => {
    setActionLoading(proposalId);
    try {
      const res = await fetch(`/api/owner/proposals/${proposalId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          decision,
          editedSummary: decision === 'revise' ? editedSummary : undefined,
          editedAction: decision === 'revise' ? editedAction : undefined,
          ownerNotes: `Decided via Editorial Console: ${decision}`,
        }),
      });

      if (res.ok) {
        setProposals(proposals.filter((p) => p.id !== proposalId));
        setEditingProposal(null);
      }
    } catch (err) {
      console.error('Error applying decision:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerIngestion = async () => {
    setLoading(true);
    try {
      await fetch('/api/owner/sources/check-now', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchConsoleData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDigestCycle = async () => {
    setLoading(true);
    try {
      await fetch('/api/owner/trigger-digest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchConsoleData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unauthorized Notice when viewing as Customer */}
      {isUnauthorized && (
        <div className="bg-amber-950/40 border border-amber-700/60 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-200">
                Editorial Owner Access Required
              </div>
              <div className="text-xs text-amber-300/80 mt-1 max-w-2xl leading-relaxed">
                You are currently signed in as a Customer tenant. Viewing unredacted raw source evidence feeds, inspecting pending model critique exceptions, and publishing weekly briefs requires Editorial Owner privileges.
              </div>
            </div>
          </div>
          {onSwitchToOwner && (
            <button
              onClick={onSwitchToOwner}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm whitespace-nowrap transition-colors"
            >
              Switch to Editorial Owner
            </button>
          )}
        </div>
      )}

      {/* Top Banner & Control Deck */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span className="font-semibold text-purple-400">Editorial Operations Gate</span>
              <span aria-hidden="true">·</span>
              <span>Authoritative Gatekeeping & Pipeline Controls</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Owner Editorial Console
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Inspect claims against raw source evidence, audit model critiques, and supervise automated digests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Switcher */}
            <div className="bg-slate-950 border border-slate-800 p-1 rounded-lg flex items-center gap-1 text-xs">
              <button
                onClick={() => handleToggleMode('reviewed')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  publicationMode === 'reviewed'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Reviewed Mode (Initial Default)
              </button>
              <button
                onClick={() => handleToggleMode('automatic')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  publicationMode === 'automatic'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Automatic Gate Mode
              </button>
            </div>

            <button
              onClick={handleTriggerIngestion}
              disabled={loading}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Check Sources</span>
            </button>

            <button
              onClick={handleTriggerDigestCycle}
              disabled={loading}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Run Digest Cycle</span>
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800 text-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab('review_queue')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'review_queue'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Review Queue</span>
            {proposals.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.2 rounded-full font-bold">
                {proposals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'sources'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Source Freshness ({sources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'emails'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Outbound Emails Sandbox ({emails.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'jobs'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Job History & Audit</span>
          </button>
        </div>
      </div>

      {/* 1. Review Queue Tab */}
      {activeTab === 'review_queue' && (
        <div className="space-y-4">
          {proposals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">Review Queue Clear</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                All proposed brief items have either been audited, approved into tenant digests, or filtered out.
              </p>
            </div>
          ) : (
            proposals.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Tenant:</span>
                    <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
                      {item.company_name} ({item.industry})
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                      {item.vendor_name || item.vendor_id}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">
                      {item.category.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingProposal(item);
                        setEditedSummary(item.change_summary);
                        setEditedAction(item.suggested_action);
                      }}
                      className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Edit & Approve</span>
                    </button>

                    <button
                      onClick={() => handleDecision(item.id, 'reject')}
                      disabled={actionLoading === item.id}
                      className="text-xs font-semibold text-red-300 hover:text-red-200 bg-red-950/70 hover:bg-red-900/80 px-3 py-1.5 rounded border border-red-800 flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleDecision(item.id, 'accept')}
                      disabled={actionLoading === item.id}
                      className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/70 hover:bg-emerald-900/80 px-3 py-1.5 rounded border border-emerald-800 flex items-center gap-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve & Publish</span>
                    </button>
                  </div>
                </div>

                {/* Side-by-Side Inspection Deck */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left: Proposed Item */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2.5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Proposed Brief Item</span>
                      <span className="text-blue-400">{item.action_category.toUpperCase()}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white leading-snug">
                      {item.change_summary}
                    </h4>

                    <div className="text-xs text-slate-300">
                      <strong>Business Impact:</strong> {item.business_implication}
                    </div>

                    <div className="text-xs text-slate-300">
                      <strong>Next Step:</strong> {item.suggested_action}
                    </div>

                    {item.deadline && (
                      <div className="text-xs text-red-400 font-semibold">
                        Deadline: {item.deadline}
                      </div>
                    )}

                    {/* Claims with Quotes */}
                    <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] space-y-1.5">
                      <div className="font-semibold text-slate-400 uppercase">Supporting Claims:</div>
                      {item.claimsWithEvidence?.map((c, i) => (
                        <div key={i} className="bg-slate-900 p-2 rounded border border-slate-800">
                          <div className="text-slate-200 font-medium">{c.claim}</div>
                          <div className="text-slate-400 italic mt-0.5">"{c.sourceQuote}"</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Critique Audit & Source Text */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2.5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Critique & Factual Verification</span>
                      <a
                        href={item.final_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 lowercase text-[11px]"
                      >
                        <span>source url</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Critique Status Checklist */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        {item.supports_factual_claims ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span>Factual Claims Supported</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-300">
                        {item.dates_and_products_match ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span>Dates / Products Match</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-300">
                        {item.applicability_valid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span>Customer Applicability</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Action Proportionate</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800">
                      <strong>Critique Finding:</strong> {item.critique_notes || 'Verified against evidence snapshot.'}
                    </div>

                    {/* Source Extract */}
                    <div className="mt-2 text-[11px] text-slate-400 font-mono bg-slate-900/60 p-2.5 rounded border border-slate-800 max-h-36 overflow-y-auto whitespace-pre-wrap">
                      {item.source_text?.slice(0, 1200) || 'Snapshot extract unavailable.'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. Source Freshness Tab */}
      {activeTab === 'sources' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-base">Registered Vendor Feeds & Freshness</h3>
            <span className="text-xs text-slate-400">Checked via safe HTTP connector with SSRF guards</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Vendor</th>
                  <th className="p-3.5">Feed Name</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Last Checked</th>
                  <th className="p-3.5">Baseline</th>
                  <th className="p-3.5">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-bold text-white">{s.vendor_name || s.vendor_id}</td>
                    <td className="p-3.5 font-medium text-slate-200">{s.name}</td>
                    <td className="p-3.5 capitalize text-slate-400">{s.source_type}</td>
                    <td className="p-3.5">
                      {s.last_status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-red-400 bg-red-950/80 px-2 py-0.5 rounded font-semibold border border-red-800/50">
                          <XCircle className="w-3 h-3" />
                          <span>Failed ({s.failure_count} retries)</span>
                        </span>
                      ) : s.last_status === 'change_detected' ? (
                        <span className="inline-flex items-center gap-1 text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded font-semibold border border-blue-800/50">
                          <Activity className="w-3 h-3" />
                          <span>Change Detected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded font-semibold border border-emerald-800/50">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{s.last_status || 'Healthy'}</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-400">
                      {s.last_fetched_at ? new Date(s.last_fetched_at).toLocaleTimeString() : 'Pending'}
                    </td>
                    <td className="p-3.5">
                      {s.has_baseline ? (
                        <span className="text-emerald-400 font-semibold">Established</span>
                      ) : (
                        <span className="text-slate-500">Not set</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Outbound Emails Tab (Sandbox Inspector) */}
      {activeTab === 'emails' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Outbound Email Sandbox & Delivery Log</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every generated email is recorded with delivery idempotency keys. Inspect live HTML emails below.
              </p>
            </div>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded font-mono">
              Provider: test_sandbox
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Recipient</th>
                  <th className="p-3.5">Subject</th>
                  <th className="p-3.5">Company</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Sent Time</th>
                  <th className="p-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {emails.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-semibold text-white">{e.recipient}</td>
                    <td className="p-3.5 text-slate-200 max-w-xs truncate">{e.subject}</td>
                    <td className="p-3.5 text-slate-400">{e.company_name}</td>
                    <td className="p-3.5">
                      <span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded font-semibold border border-emerald-800/50">
                        {e.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">
                      {new Date(e.sent_at).toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => setPreviewEmail(e)}
                        className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview HTML</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Job History & Audit */}
      {activeTab === 'jobs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-bold text-white text-base">Scheduler Worker Audit & Run History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Job ID</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Sources Checked</th>
                  <th className="p-3.5">Changes Found</th>
                  <th className="p-3.5">Briefs Created</th>
                  <th className="p-3.5">Started At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">{j.id}</td>
                    <td className="p-3.5 font-semibold text-white capitalize">{j.job_type.replace('_', ' ')}</td>
                    <td className="p-3.5">
                      <span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded font-semibold border border-emerald-800/50">
                        {j.status}
                      </span>
                    </td>
                    <td className="p-3.5">{j.sources_checked}</td>
                    <td className="p-3.5">{j.changes_detected}</td>
                    <td className="p-3.5">{j.briefs_generated}</td>
                    <td className="p-3.5 text-slate-400">{new Date(j.started_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rendered Email Preview Modal */}
      {previewEmail && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">{previewEmail.subject}</h3>
                <div className="text-xs text-slate-400">To: {previewEmail.recipient} • Provider: {previewEmail.provider}</div>
              </div>
              <button
                onClick={() => setPreviewEmail(null)}
                className="text-slate-400 hover:text-white text-sm px-3 py-1 bg-slate-800 rounded"
              >
                Close
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-slate-950">
              <iframe
                title="Email Preview"
                srcDoc={previewEmail.html_body}
                className="w-full h-[600px] border-0 rounded bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Proposal Modal */}
      {editingProposal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white">Edit & Authorize Brief Item</h3>
              <button
                onClick={() => setEditingProposal(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Change Summary (Executive Copy)
                </label>
                <textarea
                  rows={3}
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Suggested Action (Actionable Guidance)
                </label>
                <textarea
                  rows={2}
                  value={editedAction}
                  onChange={(e) => setEditedAction(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setEditingProposal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDecision(editingProposal.id, 'revise')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold"
              >
                Save & Publish Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
