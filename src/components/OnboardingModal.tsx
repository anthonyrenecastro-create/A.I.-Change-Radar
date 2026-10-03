import React, { useState } from 'react';
import {
  Building,
  Mail,
  Lock,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Vendor } from '../types/radar';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableVendors: Vendor[];
  onCompleteSignup: (authResult: { token: string; tenant: any }) => void;
}

const SMB_INDUSTRIES = [
  'Legal & Professional Services',
  'Healthcare & Life Sciences',
  'Technology & Software Development',
  'Financial Services & Insurance',
  'E-commerce & Retail',
  'Education & EdTech',
  'Manufacturing & Logistics',
  'Media, Marketing & Publishing',
];

export function OnboardingModal({
  isOpen,
  onClose,
  availableVendors,
  onCompleteSignup,
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [industry, setIndustry] = useState(SMB_INDUSTRIES[0]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['openai', 'anthropic']);
  const [plan, setPlan] = useState<'starter' | 'professional' | 'enterprise'>('starter');
  const [timezone, setTimezone] = useState('America/New_York');
  const [deliveryDay, setDeliveryDay] = useState('monday');
  const [activeSeats, setActiveSeats] = useState(15);
  const [tokenVolume, setTokenVolume] = useState(25);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const vendorLimit = plan === 'starter' ? 3 : plan === 'professional' ? 7 : 999;
  const isOverLimit = selectedVendors.length > vendorLimit;

  const toggleVendor = (vendorId: string) => {
    if (selectedVendors.includes(vendorId)) {
      setSelectedVendors(selectedVendors.filter((v) => v !== vendorId));
    } else {
      setSelectedVendors([...selectedVendors, vendorId]);
    }
    setErrorMsg(null);
  };

  const handleNext = () => {
    if (!companyName.trim()) {
      setErrorMsg('Please enter your business or company name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid business email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg(null);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverLimit) {
      setErrorMsg(`Your chosen ${plan.toUpperCase()} plan allows up to ${vendorLimit} vendors. Please deselect vendors or upgrade.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          email: email.toLowerCase().trim(),
          password,
          industry,
          selectedVendors,
          plan,
          timezone,
          deliveryDay,
          usageContext: {
            activeSeats,
            monthlyTokenVolumeMillions: tokenVolume,
            confidentialDataHandlingRequired: true,
            baaRequired: industry.includes('Healthcare'),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete registration.');
      }

      onCompleteSignup({
        token: data.token,
        tenant: data.tenant,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during onboarding.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded">
                Self-Serve Onboarding
              </span>
              <span className="text-xs text-slate-400">Step {step} of 2</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Start Your AZxAI Radar Subscription
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-red-950/40 border border-red-800 rounded-lg flex items-center gap-3 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Company / Organization Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Strategic Advisors LLC"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Business Email (Digest Recipient)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="executive@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Account Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Primary Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SMB_INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Weekly briefs tailor business implications, legal exposures, and actionable guidance directly to your industry.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <span>Continue to AI Vendors & Delivery</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Plan Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Select Subscription Plan (Configurable Hypothesis)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setPlan('starter')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      plan === 'starter'
                        ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">Starter</div>
                    <div className="text-lg font-extrabold text-blue-400 mt-0.5">$49<span className="text-xs font-normal text-slate-400">/mo</span></div>
                    <div className="text-[11px] text-slate-400 mt-1">Up to 3 AI Vendors</div>
                  </div>

                  <div
                    onClick={() => setPlan('professional')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      plan === 'professional'
                        ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Professional</span>
                      <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">Popular</span>
                    </div>
                    <div className="text-lg font-extrabold text-blue-400 mt-0.5">$129<span className="text-xs font-normal text-slate-400">/mo</span></div>
                    <div className="text-[11px] text-slate-400 mt-1">Up to 7 AI Vendors</div>
                  </div>

                  <div
                    onClick={() => setPlan('enterprise')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      plan === 'enterprise'
                        ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">Enterprise</div>
                    <div className="text-lg font-extrabold text-blue-400 mt-0.5">$299<span className="text-xs font-normal text-slate-400">/mo</span></div>
                    <div className="text-[11px] text-slate-400 mt-1">Unlimited Vendors</div>
                  </div>
                </div>
              </div>

              {/* Vendors Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Select AI Vendors to Track
                  </label>
                  <span className={`text-xs font-semibold ${isOverLimit ? 'text-red-400' : 'text-slate-400'}`}>
                    {selectedVendors.length} / {vendorLimit === 999 ? 'Unlimited' : vendorLimit} Selected
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {availableVendors.map((v) => {
                    const isSelected = selectedVendors.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => toggleVendor(v.id)}
                        className={`p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-950/50 border-blue-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="truncate">{v.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-1" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Digest Delivery Day
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

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || isOverLimit}
                  className="w-2/3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 text-sm"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Subscription...</span>
                    </div>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Start Weekly Briefing Service</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
