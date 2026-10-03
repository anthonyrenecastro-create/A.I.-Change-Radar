import React, { useState } from 'react';
import { Vendor, TenantContext, TenantPreferences } from '../types/radar';
import {
  Check,
  Building,
  Mail,
  Sliders,
  CreditCard,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
  Save,
  CheckCircle2
} from 'lucide-react';

interface VendorSettingsViewProps {
  tenant: TenantContext;
  preferences: TenantPreferences;
  vendors: Vendor[];
  onSavePreferences: (updated: Partial<TenantPreferences>) => Promise<boolean>;
}

const INDUSTRIES = [
  'Legal & Professional Services',
  'Healthcare & Life Sciences',
  'Technology & Software Development',
  'Financial Services & Insurance',
  'E-commerce & Retail',
  'Education & EdTech',
  'Manufacturing & Logistics',
  'Media & Publishing',
];

export function VendorSettingsView({
  tenant,
  preferences,
  vendors,
  onSavePreferences,
}: VendorSettingsViewProps) {
  const [selectedVendors, setSelectedVendors] = useState<string[]>(preferences.selectedVendors || []);
  const [deliveryEmail, setDeliveryEmail] = useState(preferences.deliveryEmail || tenant.email);
  const [deliveryDay, setDeliveryDay] = useState(preferences.deliveryDay || 'monday');
  const [notifyThreshold, setNotifyThreshold] = useState(preferences.notifyThreshold || 'all');

  // Usage Context fields
  const [activeSeats, setActiveSeats] = useState<number>(preferences.usageContext?.activeSeats || 25);
  const [tokenVolume, setTokenVolume] = useState<number>(preferences.usageContext?.monthlyTokenVolumeMillions || 30);
  const [confidentialData, setConfidentialData] = useState<boolean>(preferences.usageContext?.confidentialDataHandlingRequired ?? true);
  const [baaRequired, setBaaRequired] = useState<boolean>(preferences.usageContext?.baaRequired ?? false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const vendorLimit = tenant.vendorLimit || 3;
  const isOverLimit = selectedVendors.length > vendorLimit;

  const toggleVendor = (vendorId: string) => {
    if (selectedVendors.includes(vendorId)) {
      setSelectedVendors(selectedVendors.filter((id) => id !== vendorId));
    } else {
      setSelectedVendors([...selectedVendors, vendorId]);
    }
    setErrorMsg(null);
  };

  const handleSave = async () => {
    if (isOverLimit) {
      setErrorMsg(`Your ${tenant.plan.toUpperCase()} plan allows tracking up to ${vendorLimit} vendors. Please deselect vendors or upgrade your plan.`);
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    const success = await onSavePreferences({
      selectedVendors,
      deliveryEmail,
      deliveryDay,
      notifyThreshold,
      usageContext: {
        activeSeats,
        monthlyTokenVolumeMillions: tokenVolume,
        confidentialDataHandlingRequired: confidentialData,
        baaRequired,
      },
    });

    setSaving(false);
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setErrorMsg('Failed to save preferences. Please check your network connection.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Monitored Vendors & Business Context
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Select which AI providers to monitor and supply your business context for personalized, accurate brief items.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition-colors text-sm"
          >
            {saving ? (
              <span>Saving...</span>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Tracked Vendors Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <span>Tracked AI Vendors</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Only updates from your selected vendors will be included in your weekly digest.
            </p>
          </div>

          <div className="text-right">
            <div className={`text-sm font-bold ${isOverLimit ? 'text-red-400' : 'text-slate-300'}`}>
              {selectedVendors.length} / {vendorLimit} Selected
            </div>
            <div className="text-xs text-slate-500 capitalize">
              {tenant.plan} Plan Limit
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => {
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
                  <div className="font-bold text-white text-base">{vendor.name}</div>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'border-slate-700 bg-slate-800'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {vendor.description}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    {vendor.category}
                  </span>
                  <a
                    href={vendor.pricing_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <span>Pricing</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer Context Model */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <span>Customer Context & Operational Scope</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            AI Change Radar uses your operational parameters to calculate exact dollar impacts and filter irrelevant changes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Active Seats */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Active AI Users / Seats
            </label>
            <input
              type="number"
              min={1}
              max={10000}
              value={activeSeats}
              onChange={(e) => setActiveSeats(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500">
              Used to calculate per-seat copilot and enterprise plan pricing adjustments.
            </p>
          </div>

          {/* Monthly Token Volume */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Monthly API Token Volume (Millions / Month)
            </label>
            <input
              type="number"
              min={0}
              max={10000}
              value={tokenVolume}
              onChange={(e) => setTokenVolume(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500">
              Enables deterministic dollar calculations (e.g. "Save $120/mo") when token rates change.
            </p>
          </div>

          {/* Confidential Data Handling */}
          <div className="space-y-2 md:col-span-2 pt-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Compliance & Data Privacy Requirements
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={confidentialData}
                  onChange={(e) => setConfidentialData(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-semibold text-white">Zero Data Training Mandate</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Strict requirement that customer prompts must never be used to train foundational AI models.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={baaRequired}
                  onChange={(e) => setBaaRequired(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-semibold text-white">HIPAA Business Associate Agreement (BAA)</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Requires vendor endpoints to be covered by signed BAA and healthcare compliance terms.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Preferences */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <span>Delivery & Notification Preferences</span>
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
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Weekly Digest Day
            </label>
            <select
              value={deliveryDay}
              onChange={(e) => setDeliveryDay(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monday">Monday Morning</option>
              <option value="wednesday">Wednesday Midweek</option>
              <option value="friday">Friday Wrap-up</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Notification Urgency Threshold
            </label>
            <select
              value={notifyThreshold}
              onChange={(e) => setNotifyThreshold(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Verified Changes</option>
              <option value="action_only">Action Required Items Only</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
