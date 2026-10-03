import React, { useState } from 'react';
import { Vendor, TenantContext, TenantPreferences } from '../types/radar';
import {
  Check,
  Building,
  Mail,
  Sliders,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
  Save,
  CheckCircle2,
  Sparkles,
  Zap,
  Plus,
  X,
  DollarSign,
  Users,
  ShieldCheck,
  Server,
  BellRing,
  CreditCard,
  ArrowUpRight
} from 'lucide-react';

interface VendorSettingsViewProps {
  tenant: TenantContext;
  preferences: TenantPreferences;
  vendors: Vendor[];
  onSavePreferences: (updated: Partial<TenantPreferences>) => Promise<boolean>;
  onReanalyzeBrief?: () => Promise<void>;
  onUpdatePlan?: (planId: 'starter' | 'pro' | 'enterprise') => Promise<void>;
}

const PRESET_USE_CASES = [
  'Customer Support Chatbots',
  'Automated Code Generation & IDE Tools',
  'Document Discovery & Legal RAG',
  'Contract Clause Review',
  'Clinical Notes & EHR Summarization',
  'Financial Underwriting & Risk Analysis',
  'Data Extraction & Document OCR',
  'Marketing, Sales & Copywriting',
  'Image & Multimodal Generation',
  'Internal Employee Knowledge Base',
];

const DEPLOYMENT_MODELS = [
  { id: 'direct_api', label: 'Direct Vendor APIs', desc: 'Direct calls to OpenAI, Anthropic, Gemini API endpoints' },
  { id: 'cloud_hyperscalers', label: 'Cloud Hyperscalers', desc: 'AWS Bedrock, Azure OpenAI Service, Google Cloud Vertex AI' },
  { id: 'enterprise_apps', label: 'Enterprise Copilots / SaaS', desc: 'ChatGPT Enterprise, Microsoft Copilot 365, Cursor Team' },
  { id: 'hybrid', label: 'Hybrid Multi-Cloud', desc: 'Combination of direct APIs, hyperscalers, and SaaS tools' },
];

const AVAILABLE_PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter Tier',
    price: '$29/mo',
    vendorLimit: 3,
    audience: 'Early-Stage Teams & Lean SMBs',
    features: ['Up to 3 tracked vendors', 'Verified weekly digest', 'Deterministic cost calculations', 'Email delivery schedule'],
  },
  {
    id: 'pro' as const,
    name: 'Professional Tier',
    price: '$79/mo',
    vendorLimit: 8,
    audience: 'Scaling SMBs & High-Growth Operations',
    features: ['Up to 8 tracked vendors', 'Custom AI guidance injection', 'HIPAA & Zero-training audit filters', 'Priority changelog indexing'],
    popular: true,
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise Tier',
    price: '$199/mo',
    vendorLimit: 99,
    audience: 'Multi-Product Organizations',
    features: ['Unlimited tracked AI vendors', 'Full regulatory & compliance tracking', 'Multi-recipient delivery', 'On-demand brief re-analysis'],
  },
];

export function VendorSettingsView({
  tenant,
  preferences,
  vendors,
  onSavePreferences,
  onReanalyzeBrief,
  onUpdatePlan,
}: VendorSettingsViewProps) {
  // 1. Vendors Selection
  const [selectedVendors, setSelectedVendors] = useState<string[]>(preferences.selectedVendors || []);
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState<string>('all');

  // 2. Business Context & Parameters
  const [activeSeats, setActiveSeats] = useState<number>(preferences.usageContext?.activeSeats || 25);
  const [tokenVolume, setTokenVolume] = useState<number>(preferences.usageContext?.monthlyTokenVolumeMillions || 30);
  const [deploymentType, setDeploymentType] = useState<string>(preferences.usageContext?.deploymentType || 'direct_api');
  const [criticalityLevel, setCriticalityLevel] = useState<string>(preferences.usageContext?.criticalityLevel || 'business_important');
  const [useCases, setUseCases] = useState<string[]>(preferences.usageContext?.primaryUseCases || [PRESET_USE_CASES[0], PRESET_USE_CASES[1]]);
  const [customUseCaseInput, setCustomUseCaseInput] = useState('');

  // 3. Compliance & Governance Guardrails
  const [confidentialData, setConfidentialData] = useState<boolean>(preferences.usageContext?.confidentialDataHandlingRequired ?? true);
  const [baaRequired, setBaaRequired] = useState<boolean>(preferences.usageContext?.baaRequired ?? false);
  const [soc2Required, setSoc2Required] = useState<boolean>(preferences.usageContext?.soc2Required ?? true);
  const [gdprEuAiAct, setGdprEuAiAct] = useState<boolean>(preferences.usageContext?.gdprEuAiActRequired ?? false);

  // 4. Custom AI Reasoning Guidance
  const [specialInstructions, setSpecialInstructions] = useState<string>(preferences.usageContext?.specialInstructions || '');

  // 5. Delivery & Schedule
  const [deliveryEmail, setDeliveryEmail] = useState(preferences.deliveryEmail || tenant.email);
  const [deliveryDay, setDeliveryDay] = useState(preferences.deliveryDay || 'monday');
  const [notifyThreshold, setNotifyThreshold] = useState(preferences.notifyThreshold || 'all');

  // Status flags
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [planSuccessMsg, setPlanSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const vendorLimit = tenant.vendorLimit || 3;
  const isOverLimit = selectedVendors.length > vendorLimit;

  // Categories list
  const categories = ['all', ...Array.from(new Set(vendors.map((v) => v.category)))];

  const filteredVendors = vendors.filter((v) => {
    if (vendorCategoryFilter === 'all') return true;
    return v.category === vendorCategoryFilter;
  });

  const toggleVendor = (vendorId: string) => {
    if (selectedVendors.includes(vendorId)) {
      setSelectedVendors(selectedVendors.filter((id) => id !== vendorId));
    } else {
      setSelectedVendors([...selectedVendors, vendorId]);
    }
    setErrorMsg(null);
  };

  const toggleUseCase = (uc: string) => {
    if (useCases.includes(uc)) {
      setUseCases(useCases.filter((u) => u !== uc));
    } else {
      setUseCases([...useCases, uc]);
    }
  };

  const addCustomUseCase = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customUseCaseInput.trim();
    if (trimmed && !useCases.includes(trimmed)) {
      setUseCases([...useCases, trimmed]);
      setCustomUseCaseInput('');
    }
  };

  const removeUseCase = (uc: string) => {
    setUseCases(useCases.filter((u) => u !== uc));
  };

  const gatherPreferencesPayload = (): Partial<TenantPreferences> => {
    return {
      selectedVendors,
      deliveryEmail,
      deliveryDay,
      notifyThreshold,
      usageContext: {
        activeSeats,
        monthlyTokenVolumeMillions: tokenVolume,
        deploymentType: deploymentType as any,
        criticalityLevel: criticalityLevel as any,
        primaryUseCases: useCases,
        confidentialDataHandlingRequired: confidentialData,
        baaRequired,
        soc2Required,
        gdprEuAiActRequired: gdprEuAiAct,
        specialInstructions: specialInstructions.trim(),
      },
    };
  };

  const handleSave = async (): Promise<boolean> => {
    if (isOverLimit) {
      setErrorMsg(`Your ${tenant.plan.toUpperCase()} plan allows tracking up to ${vendorLimit} vendors. Please deselect vendors or switch your plan below.`);
      return false;
    }

    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    const payload = gatherPreferencesPayload();
    const success = await onSavePreferences(payload);

    setSaving(false);
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      return true;
    } else {
      setErrorMsg('Failed to save preferences. Please check your connection and retry.');
      return false;
    }
  };

  const handleSaveAndReanalyze = async () => {
    const saved = await handleSave();
    if (!saved) return;

    if (onReanalyzeBrief) {
      setReanalyzing(true);
      try {
        await onReanalyzeBrief();
        setSaveSuccess(true);
      } catch (err: any) {
        setErrorMsg(err.message || 'Saved parameters, but failed to regenerate brief immediately.');
      } finally {
        setReanalyzing(false);
      }
    }
  };

  const handleSwitchPlan = async (planId: 'starter' | 'pro' | 'enterprise') => {
    if (onUpdatePlan) {
      setUpdatingPlan(true);
      setErrorMsg(null);
      setPlanSuccessMsg(null);
      try {
        await onUpdatePlan(planId);
        setPlanSuccessMsg(`Plan successfully updated to ${planId.toUpperCase()}. Your vendor tracking capacity has been updated.`);
        setTimeout(() => setPlanSuccessMsg(null), 4000);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to update plan tier.');
      } finally {
        setUpdatingPlan(false);
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner & Control Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span className="font-semibold text-blue-400">Parameter Management</span>
              <span aria-hidden="true">·</span>
              <span>{tenant.companyName || tenant.company_name || 'Organization'}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{tenant.plan} Tier</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Customize Analysis Parameters
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Configure which AI vendors to track and tailor the reasoning engine's parameters—including team seat count, token consumption, deployment type, regulatory constraints, and custom prompts—to get precise, business-specific intelligence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || reanalyzing}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium px-4 py-2.5 rounded-lg text-xs transition-all shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Parameters</span>
                </>
              )}
            </button>

            <button
              onClick={handleSaveAndReanalyze}
              disabled={saving || reanalyzing}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg text-xs transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {reanalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Re-analyzing with New Parameters...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-blue-200" />
                  <span>Save & Re-Analyze Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {planSuccessMsg && (
          <div className="mt-4 p-3 bg-blue-950/50 border border-blue-800 rounded-lg text-blue-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{planSuccessMsg}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Custom parameters saved successfully. Future weekly intelligence briefs and re-analyses will strictly adhere to these settings.</span>
          </div>
        )}
      </div>

      {/* 0. Subscription Tier & Quota Management (Direct Self-Serve, No Stripe Required) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <span>Subscription Tier & Vendor Capacity</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Self-serve plan management. Switch or upgrade tier instantly without payment walls or external checkout gateways.
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold text-slate-300">
              Active Tier: <span className="font-bold text-blue-400 capitalize">{tenant.plan}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {selectedVendors.length} of {vendorLimit} slots used
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {AVAILABLE_PLANS.map((p) => {
            const isCurrent = (tenant.plan || 'starter').toLowerCase().includes(p.id);
            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-blue-950/30 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{p.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-blue-300 bg-blue-900/60 border border-blue-700 px-2 py-0.5 rounded">
                        Current Active Plan
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-bold text-white mt-1 font-mono">{p.price}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{p.audience}</div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    {p.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-[11px]">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  {isCurrent ? (
                    <div className="text-center text-xs font-semibold text-emerald-400 py-1.5 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Currently Enabled</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={updatingPlan}
                      onClick={() => handleSwitchPlan(p.id)}
                      className="w-full bg-slate-800 hover:bg-blue-600 text-white font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <span>Switch to {p.name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1. Tracked AI Vendors Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <span>Tracked AI Vendors Catalog</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select which foundation models and developer tools are monitored for your weekly executive digest.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={`text-xs font-bold ${isOverLimit ? 'text-red-400' : 'text-slate-200'}`}>
                {selectedVendors.length} / {vendorLimit} Tracked
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                {tenant.plan} Capacity
              </div>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setVendorCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg capitalize whitespace-nowrap transition-colors ${
                vendorCategoryFilter === cat
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Vendors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {filteredVendors.map((vendor) => {
            const isSelected = selectedVendors.includes(vendor.id);
            return (
              <div
                key={vendor.id}
                onClick={() => toggleVendor(vendor.id)}
                className={`cursor-pointer rounded-xl p-4 border transition-all relative ${
                  isSelected
                    ? 'bg-blue-950/30 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-white text-sm">{vendor.name}</span>
                    <span className="ml-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded capitalize">
                      {vendor.category}
                    </span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'border-slate-700 bg-slate-800'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {vendor.description}
                </p>

                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[130px] font-mono text-[10px] text-slate-500">
                    {vendor.official_domain}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={vendor.pricing_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium"
                    >
                      <span>Pricing</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Business Workloads & Primary AI Use Cases */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <span>Business Workloads & Primary AI Use Cases</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            The reasoning engine evaluates vendor changes against your reported workloads to determine direct vs conditional impact.
          </p>
        </div>

        {/* Selected Use Case Chips */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Active AI Use Cases ({useCases.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {useCases.map((uc) => (
              <span
                key={uc}
                className="inline-flex items-center gap-1.5 bg-blue-950/60 border border-blue-700/60 text-blue-200 text-xs px-3 py-1.5 rounded-lg font-medium"
              >
                <span>{uc}</span>
                <button
                  type="button"
                  onClick={() => removeUseCase(uc)}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          {/* Quick-add preset chips */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] text-slate-400">Add common workload presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_USE_CASES.filter((p) => !useCases.includes(p)).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => toggleUseCase(preset)}
                  className="text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-blue-400" />
                  <span>{preset}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom tag input form */}
          <form onSubmit={addCustomUseCase} className="flex gap-2 pt-2 max-w-md">
            <input
              type="text"
              value={customUseCaseInput}
              onChange={(e) => setCustomUseCaseInput(e.target.value)}
              placeholder="Add custom workload (e.g. Contract OCR, Patent Search)..."
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Primary Deployment Infrastructure */}
        <div className="space-y-2 pt-3 border-t border-slate-800">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Primary Deployment Infrastructure Model
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DEPLOYMENT_MODELS.map((m) => (
              <label
                key={m.id}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  deploymentType === m.id
                    ? 'bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="deploymentType"
                  value={m.id}
                  checked={deploymentType === m.id}
                  onChange={() => setDeploymentType(m.id)}
                  className="mt-1 text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-white">{m.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Operational Scale & Deterministic Financial Impact Model */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Operational Scale & Financial Impact Parameters</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Parameters utilized by the deterministic calculation engine to compute exact monthly dollar deltas for your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Active User Seats */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Active AI User Seats</span>
            </label>
            <input
              type="number"
              min={1}
              max={10000}
              value={activeSeats}
              onChange={(e) => setActiveSeats(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tabular-nums"
            />
            <p className="text-[11px] text-slate-500">
              Licensed team members using Copilot, Cursor, or ChatGPT Enterprise.
            </p>
          </div>

          {/* Monthly Token Volume */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Monthly Token Consumption (Millions)</span>
            </label>
            <input
              type="number"
              min={0}
              max={50000}
              value={tokenVolume}
              onChange={(e) => setTokenVolume(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tabular-nums"
            />
            <p className="text-[11px] text-slate-500">
              Input + output token consumption across your backend API applications.
            </p>
          </div>

          {/* Workload Criticality */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-purple-400" />
              <span>Workload Criticality Tier</span>
            </label>
            <select
              value={criticalityLevel}
              onChange={(e) => setCriticalityLevel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="mission_critical">Mission-Critical (Customer-Facing & Real-Time)</option>
              <option value="business_important">Core Operations (Daily Business Workflow)</option>
              <option value="internal_experimentation">Internal Experimentation & R&D</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Governs the urgency classification and alert sensitivity for breaking changes.
            </p>
          </div>
        </div>

        {/* Live Calculation Preview Card */}
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Live Financial Calculation Preview:</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Based on your parameter of <span className="text-white font-mono font-semibold">{tokenVolume}M tokens/month</span>:
            </div>
          </div>
          <div className="text-right">
            <div className="text-emerald-400 font-bold font-mono text-sm tabular-nums">
              ±${Math.round(tokenVolume * 5.0)}/mo
            </div>
            <div className="text-[10px] text-slate-500">per $5.00/1M rate revision</div>
          </div>
        </div>
      </div>

      {/* 4. Compliance, Privacy & Regulatory Guardrails */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Compliance & Privacy Guardrails</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Flagging criteria: changes affecting these mandates are automatically escalated to "Action Required" status.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="flex items-start gap-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={confidentialData}
              onChange={(e) => setConfidentialData(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
            />
            <div>
              <div className="text-xs font-bold text-white">Zero Model Training Mandate</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Strict mandate that vendor terms must guarantee customer prompts and embeddings are never stored or used to train public foundation models.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={baaRequired}
              onChange={(e) => setBaaRequired(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
            />
            <div>
              <div className="text-xs font-bold text-white">HIPAA Business Associate Agreement (BAA)</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Requires healthcare-compliant data handling with executed BAAs covering API endpoint usage and audit logging.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={soc2Required}
              onChange={(e) => setSoc2Required(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
            />
            <div>
              <div className="text-xs font-bold text-white">SOC 2 Type II / ISO 27001 Mandate</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Requires independent third-party security audits and annual SOC 2 reporting from monitored AI infrastructure vendors.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={gdprEuAiAct}
              onChange={(e) => setGdprEuAiAct(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
            />
            <div>
              <div className="text-xs font-bold text-white">EU AI Act & GDPR High-Risk Classification</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Evaluates vendor systemic risk declarations, technical documentation availability, and copyright transparency under European standards.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 5. Custom AI Intelligence Guidance & Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <span>Custom AI Reasoning Guidance</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inject special instructions and priority rules directly into the Gemini reasoning and critique pipeline for your organization.
          </p>
        </div>

        <div className="space-y-2">
          <textarea
            rows={3}
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="e.g., We are migrating our core RAG pipeline from OpenAI to Claude 3.7. Please flag any prompt formatting deprecations, rate-limit revisions, or changes to tool-calling semantics with high priority..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
          />
          <p className="text-[11px] text-slate-500">
            These instructions are passed directly to the reasoning engine prompt when evaluating each evidence snapshot for your tenant.
          </p>
        </div>
      </div>

      {/* 6. Delivery & Alert Schedule */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-400" />
            <span>Delivery & Alert Schedule</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure how and when your executive digest is delivered.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Digest Recipient Email
            </label>
            <input
              type="email"
              value={deliveryEmail}
              onChange={(e) => setDeliveryEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Weekly Digest Schedule
            </label>
            <select
              value={deliveryDay}
              onChange={(e) => setDeliveryDay(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monday">Monday Morning (08:00 EST)</option>
              <option value="wednesday">Wednesday Midweek (08:00 EST)</option>
              <option value="friday">Friday Wrap-up (16:00 EST)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Notification Urgency Filter
            </label>
            <select
              value={notifyThreshold}
              onChange={(e) => setNotifyThreshold(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Verified Changes</option>
              <option value="action_only">Action Required & Breaking Changes Only</option>
              <option value="pricing_only">Pricing Adjustments & Deprecations Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 shadow-xl backdrop-blur">
        <div className="text-xs text-slate-400">
          Make sure to click <strong className="text-white">Save & Re-Analyze Now</strong> to immediately recalculate brief items with your updated parameters.
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || reanalyzing}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Parameters'}
          </button>

          <button
            onClick={handleSaveAndReanalyze}
            disabled={saving || reanalyzing}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-lg text-xs transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            {reanalyzing ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                <span>Re-analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span>Save & Re-Analyze Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
