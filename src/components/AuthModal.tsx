import React, { useState } from 'react';
import {
  Building,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  ShieldCheck,
  Check,
  Sparkles,
  KeyRound,
  UserCheck,
  LogIn,
  UserPlus
} from 'lucide-react';
import { Vendor } from '../types/radar';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableVendors: Vendor[];
  initialMode?: 'signin' | 'signup';
  onAuthSuccess: (result: { token: string; tenant: any; role: 'customer' | 'owner' }) => void;
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

const PRESET_USE_CASES = [
  'Customer Support Chatbots',
  'Code Generation & Dev Tools',
  'Document Discovery & RAG',
  'Contract Clause Review',
  'Clinical Notes & Transcription',
  'Marketing & Copywriting',
  'Financial Underwriting & Analysis',
  'Data Extraction & OCR',
];

const QUICK_DEMO_ACCOUNTS = [
  {
    name: 'Acme Legal Partners',
    role: 'customer' as const,
    email: 'managing-partner@acmelegal.com',
    password: 'radar2026!acme',
    industry: 'Legal & Professional Services',
    plan: 'Pro (8 vendors)',
    badge: 'Customer',
  },
  {
    name: 'Apex Health Systems',
    role: 'customer' as const,
    email: 'cto@apexhealthclinic.org',
    password: 'radar2026!apex',
    industry: 'Healthcare & Life Sciences',
    plan: 'Starter (3 vendors)',
    badge: 'Customer',
  },
  {
    name: 'CloudScale SaaS Inc',
    role: 'customer' as const,
    email: 'engineering@cloudscalesoftware.io',
    password: 'radar2026!cloud',
    industry: 'Technology & Software',
    plan: 'Enterprise (Unlimited)',
    badge: 'Customer',
  },
  {
    name: 'System Editorial Owner',
    role: 'owner' as const,
    email: 'managing-partner@acmelegal.com',
    password: 'radar2026!acme',
    industry: 'Editorial Operations Gate',
    plan: 'Admin Oversight',
    badge: 'Owner Admin',
  },
];

export function AuthModal({
  isOpen,
  onClose,
  availableVendors,
  initialMode = 'signin',
  onAuthSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  // Sign In State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up State
  const [companyName, setCompanyName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [industry, setIndustry] = useState(SMB_INDUSTRIES[0]);
  const [plan, setPlan] = useState<'starter' | 'professional' | 'enterprise'>('professional');
  const [timezone, setTimezone] = useState('America/New_York');

  // Parameter Customization during signup
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['openai', 'anthropic', 'google_gemini']);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([PRESET_USE_CASES[0], PRESET_USE_CASES[1]]);
  const [activeSeats, setActiveSeats] = useState(25);
  const [tokenVolume, setTokenVolume] = useState(30);
  const [zeroTraining, setZeroTraining] = useState(true);
  const [baaRequired, setBaaRequired] = useState(false);
  const [deliveryDay, setDeliveryDay] = useState('monday');

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

  const toggleUseCase = (uc: string) => {
    if (selectedUseCases.includes(uc)) {
      setSelectedUseCases(selectedUseCases.filter((u) => u !== uc));
    } else {
      setSelectedUseCases([...selectedUseCases, uc]);
    }
  };

  // Sign In Handler
  const handleSignIn = async (e?: React.FormEvent, overrideEmail?: string, overridePass?: string, overrideRole?: 'customer' | 'owner') => {
    if (e) e.preventDefault();
    const emailToUse = overrideEmail || loginEmail;
    const passToUse = overridePass || loginPassword;

    if (!emailToUse.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!passToUse) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // If demo role override is requested (e.g. editorial owner)
      if (overrideRole === 'owner') {
        const res = await fetch('/api/auth/demo-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: 'tenant_acme_legal', role: 'owner' }),
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('azxai_radar_token', data.token);
          onAuthSuccess({ token: data.token, tenant: data.tenant, role: 'owner' });
          onClose();
          return;
        }
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse, password: passToUse }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in. Please verify credentials.');
      }

      localStorage.setItem('azxai_radar_token', data.token);
      onAuthSuccess({
        token: data.token,
        tenant: data.tenant,
        role: data.role || 'customer',
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with authentication server.');
    } finally {
      setLoading(false);
    }
  };

  // Sign Up Handler
  const handleSignUpSubmit = async (e: React.FormEvent) => {
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
          email: signupEmail.trim(),
          password: signupPassword,
          industry,
          plan,
          selectedVendors,
          timezone,
          deliveryDay,
          usageContext: {
            activeSeats,
            monthlyTokenVolumeMillions: tokenVolume,
            primaryUseCases: selectedUseCases,
            confidentialDataHandlingRequired: zeroTraining,
            baaRequired,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sign up failed. Please check inputs and retry.');
      }

      localStorage.setItem('azxai_radar_token', data.token);
      onAuthSuccess({
        token: data.token,
        tenant: data.tenant,
        role: 'customer',
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (!companyName.trim()) {
      setErrorMsg('Please enter your company or business name.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg(null);
    setSignupStep(2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signin'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Log In</span>
            </button>

            <button
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ---------------- MODE: SIGN IN (LOGIN) ---------------- */}
        {mode === 'signin' && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Log In to AZxAI Radar
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Access your verified weekly intelligence briefs, monitored vendor alerts, and custom analysis parameters.
              </p>
            </div>

            <form onSubmit={(e) => handleSignIn(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Business Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Log In to Dashboard</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Logins for immediate exploration */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                  <span>One-Click Demo & Evaluation Accounts</span>
                </div>
                <span className="text-[11px] text-slate-500">Ready to test</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {QUICK_DEMO_ACCOUNTS.map((acc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setLoginEmail(acc.email);
                      setLoginPassword(acc.password);
                      handleSignIn(undefined, acc.email, acc.password, acc.role);
                    }}
                    className="text-left p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-blue-600/80 hover:bg-blue-950/20 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                        {acc.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        acc.role === 'owner'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}>
                        {acc.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      {acc.email}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {acc.industry} • {acc.plan}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-400">
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                  }}
                  className="text-blue-400 hover:underline font-semibold"
                >
                  Create an account now
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ---------------- MODE: SIGN UP (CREATE ACCOUNT) ---------------- */}
        {mode === 'signup' && (
          <div className="p-6 space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Create Your Business Account
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {signupStep === 1
                    ? 'Step 1 of 2: Organization & Login Credentials'
                    : 'Step 2 of 2: Customize Your AI Analysis Parameters'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    signupStep === 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {signupStep === 1 ? '1' : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </span>
                <span className="text-slate-600 text-xs">──</span>
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    signupStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  2
                </span>
              </div>
            </div>

            {signupStep === 1 ? (
              /* Step 1: Credentials & Org Info */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300">
                      Company / Organization Name *
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Apex Strategic Advisors"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Work Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Password (min 6 characters) *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Industry / Sector
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
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Primary Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="America/New_York">Eastern Time (US & Canada)</option>
                      <option value="America/Chicago">Central Time (US & Canada)</option>
                      <option value="America/Denver">Mountain Time (US & Canada)</option>
                      <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Berlin">Central European Time</option>
                    </select>
                  </div>
                </div>

                {/* Plan Selection Tier */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Subscription Tier (Hypothesis Pricing)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'starter', name: 'Starter', limit: '3 Vendors', price: '$49/mo' },
                      { id: 'professional', name: 'Professional', limit: '7 Vendors', price: '$149/mo', popular: true },
                      { id: 'enterprise', name: 'Enterprise', limit: 'Unlimited', price: '$399/mo' },
                    ].map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPlan(p.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          plan === p.id
                            ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {p.popular && (
                          <span className="absolute -top-2 right-2 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            Popular
                          </span>
                        )}
                        <div className="font-bold text-white text-xs">{p.name}</div>
                        <div className="text-[11px] text-blue-400 font-semibold mt-0.5">{p.price}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{p.limit}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-all shadow-md"
                  >
                    <span>Next: Customize Analysis Parameters</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Customize Analysis Parameters */
              <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                {/* Vendors Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>Select Monitored AI Vendors</span>
                    </label>
                    <span className={`text-xs font-bold ${isOverLimit ? 'text-red-400' : 'text-slate-400'}`}>
                      {selectedVendors.length} / {vendorLimit} selected
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableVendors.map((v) => {
                      const isSelected = selectedVendors.includes(v.id);
                      return (
                        <div
                          key={v.id}
                          onClick={() => toggleVendor(v.id)}
                          className={`cursor-pointer rounded-lg p-2.5 border text-xs transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-950/40 border-blue-500 text-white font-semibold'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span className="truncate">{v.name}</span>
                          <div
                            className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border ${
                              isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Use Cases */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Your Primary AI Workloads & Use Cases
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_USE_CASES.map((uc) => {
                      const active = selectedUseCases.includes(uc);
                      return (
                        <button
                          key={uc}
                          type="button"
                          onClick={() => toggleUseCase(uc)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            active
                              ? 'bg-blue-600/30 border-blue-500 text-blue-200 font-medium'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {uc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Seats and Volume for Deterministic Financial Calculation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Active AI User Seats
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={activeSeats}
                      onChange={(e) => setActiveSeats(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-500">
                      Calculates seat licensing impact across Copilot/ChatGPT Enterprise plans.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Monthly Token Volume (Millions)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={tokenVolume}
                      onChange={(e) => setTokenVolume(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-500">
                      Computes exact dollar savings or cost deltas when API prices shift.
                    </p>
                  </div>
                </div>

                {/* Compliance Guardrails */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Compliance & Privacy Guardrails
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-start gap-2.5 p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                      <input
                        type="checkbox"
                        checked={zeroTraining}
                        onChange={(e) => setZeroTraining(e.target.checked)}
                        className="mt-0.5 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">Zero Model Training Mandate</div>
                        <div className="text-[10px] text-slate-400">Prompts never used for model retraining</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                      <input
                        type="checkbox"
                        checked={baaRequired}
                        onChange={(e) => setBaaRequired(e.target.checked)}
                        className="mt-0.5 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">HIPAA BAA Requirement</div>
                        <div className="text-[10px] text-slate-400">Healthcare data governance & compliance</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSignupStep(1)}
                    className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-2"
                  >
                    Back to Organization Info
                  </button>

                  <button
                    type="button"
                    onClick={handleSignUpSubmit}
                    disabled={loading || isOverLimit}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-all shadow-md"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Create Account & Analyze Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
