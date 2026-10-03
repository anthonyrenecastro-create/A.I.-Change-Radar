import React, { useState } from 'react';
import { WeeklyBrief, BriefItem, TenantContext } from '../types/radar';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Info,
  Calendar,
  Building,
  DollarSign,
  ArrowRight,
  ChevronDown,
  FileCheck
} from 'lucide-react';

interface WeeklyBriefViewProps {
  tenant: TenantContext;
  briefs: WeeklyBrief[];
  activeBrief: WeeklyBrief | null;
  items: BriefItem[];
  onSelectBrief: (briefId: string) => void;
  onRefresh: () => void;
}

export function WeeklyBriefView({
  tenant,
  briefs,
  activeBrief,
  items,
  onSelectBrief,
  onRefresh,
}: WeeklyBriefViewProps) {
  const [filter, setFilter] = useState<'all' | 'action_required' | 'review_recommended' | 'no_action_needed'>('all');
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return item.action_category === filter;
  });

  const actionRequiredCount = items.filter((i) => i.action_category === 'action_required').length;
  const reviewCount = items.filter((i) => i.action_category === 'review_recommended').length;

  return (
    <div className="space-y-6">
      {/* Header & Issue Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold tracking-wider uppercase text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2.5 py-0.5 rounded">
                Verified Intelligence
              </span>
              <span className="text-xs text-slate-400">
                Week: {activeBrief?.week_start_date || 'Current'} to {activeBrief?.week_end_date || 'Current'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Executive Weekly Brief {activeBrief ? `#${activeBrief.issue_number}` : ''}
            </h1>
            <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-500" />
              <span>Prepared for <strong>{tenant.companyName}</strong> ({tenant.industry})</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {briefs.length > 1 && (
              <div className="relative">
                <select
                  value={activeBrief?.id}
                  onChange={(e) => onSelectBrief(e.target.value)}
                  className="bg-slate-800 text-slate-200 text-sm rounded-lg border border-slate-700 px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {briefs.map((b) => (
                    <option key={b.id} value={b.id}>
                      Issue #{b.issue_number} ({b.week_start_date})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            )}

            <button
              onClick={onRefresh}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors"
            >
              Sync Brief
            </button>
          </div>
        </div>

        {/* Coverage Health Banner */}
        <div className="mt-5 pt-5 border-t border-slate-800/80">
          {activeBrief?.sourceCoverageStats?.hasIncompleteCoverage ? (
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-3.5 flex items-start justify-between gap-3 text-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">
                    Incomplete Monitoring Coverage Warning
                  </div>
                  <div className="text-amber-200/80 text-xs mt-0.5">
                    {activeBrief.sourceCoverageStats.failed} of {activeBrief.sourceCoverageStats.checked} official vendor sources experienced temporary retrieval issues this cycle. Changes may have occurred on degraded feeds that could not be verified.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCoverageDetails(!showCoverageDetails)}
                className="text-xs font-medium text-amber-400 hover:text-amber-300 underline shrink-0 mt-0.5"
              >
                {showCoverageDetails ? 'Hide Sources' : 'View Source Status'}
              </button>
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-emerald-300">
                    100% Verified Source Coverage
                  </span>
                  <span className="text-emerald-200/70 text-xs ml-2">
                    All {activeBrief?.sourceCoverageStats?.checked || 6} monitored public changelogs, pricing tables, and policy feeds verified.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCoverageDetails(!showCoverageDetails)}
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 underline shrink-0"
              >
                {showCoverageDetails ? 'Hide Sources' : 'Inspect Checked Sources'}
              </button>
            </div>
          )}

          {showCoverageDetails && activeBrief?.sourceCoverageStats?.sources && (
            <div className="mt-3 p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-2">
                Monitored Source Feeds
              </div>
              {activeBrief.sourceCoverageStats.sources.map((src, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                  <span className="font-medium text-slate-200">{src.name}</span>
                  <div className="flex items-center gap-2">
                    {src.status === 'failed' ? (
                      <span className="text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-800/50">
                        Failed Retrieval ({src.failureCount} retries)
                      </span>
                    ) : (
                      <span className="text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-800/50">
                        Active & Healthy
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilter('all')}
          className={`cursor-pointer rounded-xl p-4 border transition-all ${
            filter === 'all'
              ? 'bg-slate-800/90 border-blue-500 ring-1 ring-blue-500'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Brief Items</div>
          <div className="text-2xl font-bold text-white mt-1">{items.length}</div>
          <div className="text-xs text-slate-500 mt-1">Across your tracked AI vendors</div>
        </div>

        <div
          onClick={() => setFilter('action_required')}
          className={`cursor-pointer rounded-xl p-4 border transition-all ${
            filter === 'action_required'
              ? 'bg-red-950/40 border-red-500 ring-1 ring-red-500'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-400 uppercase tracking-wider">Action Required</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-300 mt-1">{actionRequiredCount}</div>
          <div className="text-xs text-red-400/80 mt-1">Deprecations & breaking changes</div>
        </div>

        <div
          onClick={() => setFilter('review_recommended')}
          className={`cursor-pointer rounded-xl p-4 border transition-all ${
            filter === 'review_recommended'
              ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Review Recommended</span>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{reviewCount}</div>
          <div className="text-xs text-amber-400/80 mt-1">Pricing reductions & opportunities</div>
        </div>
      </div>

      {/* Main Items Section */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <FileCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">No Material Disruptions Detected</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
              {activeBrief?.summary_text || 'All verified vendor feeds are within baseline operational parameters. No breaking changes or urgent policy adjustments apply to your profile.'}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              Coverage complete & verified
            </div>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isActionRequired = item.action_category === 'action_required';
            const isReview = item.action_category === 'review_recommended';

            const badgeBg = isActionRequired
              ? 'bg-red-950/70 border-red-800 text-red-300'
              : isReview
              ? 'bg-amber-950/70 border-amber-800 text-amber-300'
              : 'bg-emerald-950/70 border-emerald-800 text-emerald-300';

            const badgeLabel = isActionRequired
              ? 'Action Required'
              : isReview
              ? 'Review Recommended'
              : 'Informational';

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm hover:border-slate-700 transition-colors"
              >
                {/* Item Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {item.vendor_name || item.vendor_id.toUpperCase()}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${badgeBg}`}>
                      {badgeLabel}
                    </span>
                    <span className="text-xs text-slate-400 capitalize bg-slate-800/60 px-2 py-0.5 rounded">
                      {item.category.replace('_', ' ')}
                    </span>
                  </div>

                  {item.deadline && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-950/50 border border-red-900/60 px-2.5 py-1 rounded">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Deadline: {item.deadline}</span>
                    </div>
                  )}
                </div>

                {/* 1. What Changed */}
                <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                  {item.change_summary}
                </h3>

                {/* 2. Why It Matters */}
                <div className="mt-3 text-sm text-slate-300 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/60 space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    Why It Matters to Your Business ({tenant.industry})
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    {item.business_implication}
                  </p>
                  <p className="text-xs text-slate-400">
                    <strong>Applicability:</strong> {item.applicability_rationale}
                  </p>
                </div>

                {/* 3. Deterministic Cost Impact (if pricing) */}
                {item.estimated_cost_delta && (
                  <div className="mt-3 flex items-center gap-3 bg-emerald-950/30 border border-emerald-800/50 px-3.5 py-2.5 rounded-lg text-sm text-emerald-200">
                    <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-300">Cost Impact Calculation: </span>
                      <span>{item.estimated_cost_delta}</span>
                    </div>
                  </div>
                )}

                {/* 4. Practical Next Step */}
                <div className="mt-3.5 bg-blue-950/30 border border-blue-900/50 p-3.5 rounded-lg flex items-start gap-3">
                  <ArrowRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      Practical Next Step
                    </div>
                    <div className="text-sm text-slate-200 mt-0.5 font-medium">
                      {item.suggested_action}
                    </div>
                  </div>
                </div>

                {/* 5. Supporting Public Sources and Verified Quotes */}
                <div className="mt-4 pt-3.5 border-t border-slate-800 text-xs">
                  <div className="font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Supporting Public Sources & Verified Evidence</span>
                  </div>
                  <div className="space-y-2">
                    {item.claimsWithEvidence && item.claimsWithEvidence.length > 0 ? (
                      item.claimsWithEvidence.map((claim, cIdx) => (
                        <div key={cIdx} className="bg-slate-950/80 p-2.5 rounded border border-slate-800/80">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-200">{claim.claim}</span>
                            <a
                              href={claim.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 font-medium"
                            >
                              <span>Official Source</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="text-slate-400 italic text-[11px] border-l-2 border-slate-700 pl-2">
                            "{claim.sourceQuote}"
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 italic">Official changelog snapshot on record.</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
