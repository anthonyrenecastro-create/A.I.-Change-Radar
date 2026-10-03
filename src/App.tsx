import React, { useState, useEffect } from 'react';
import { WeeklyBriefView } from './components/WeeklyBriefView';
import { VendorSettingsView } from './components/VendorSettingsView';
import { OwnerConsoleView } from './components/OwnerConsoleView';
import { ScenarioDemoModal } from './components/ScenarioDemoModal';
import { AuthModal } from './components/AuthModal';
import { Vendor, WeeklyBrief, BriefItem, TenantContext, TenantPreferences } from './types/radar';
import {
  Radio,
  Sliders,
  Shield,
  Building,
  Play,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Layers,
  Sparkles,
  Database,
  LogIn,
  LogOut,
  UserPlus,
  User,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';

const DEMO_PERSONAS = [
  {
    id: 'tenant_acme_legal',
    name: 'Acme Legal Partners',
    industry: 'Legal & Professional Services',
    role: 'customer' as const,
  },
  {
    id: 'tenant_apex_health',
    name: 'Apex Health Systems',
    industry: 'Healthcare & Life Sciences',
    role: 'customer' as const,
  },
  {
    id: 'tenant_cloudscale',
    name: 'CloudScale SaaS Inc',
    industry: 'Technology & Software',
    role: 'customer' as const,
  },
  {
    id: 'tenant_acme_legal',
    name: 'System Editorial Owner',
    industry: 'Editorial & Operations Gate',
    role: 'owner' as const,
  },
];

export default function App() {
  const [activeNav, setActiveNav] = useState<'brief' | 'vendors' | 'owner'>('brief');
  const [currentPersonaIndex, setCurrentPersonaIndex] = useState(0);

  const [token, setToken] = useState<string>('');
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [role, setRole] = useState<'customer' | 'owner'>('customer');
  const [preferences, setPreferences] = useState<TenantPreferences | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [briefs, setBriefs] = useState<WeeklyBrief[]>([]);
  const [activeBrief, setActiveBrief] = useState<WeeklyBrief | null>(null);
  const [activeItems, setActiveItems] = useState<BriefItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Unified Auth Modal (Sign In vs Create Account)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  const openSignIn = () => {
    setAuthModalMode('signin');
    setShowAuthModal(true);
  };

  const openSignUp = () => {
    setAuthModalMode('signup');
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      console.warn('Logout error:', e);
    }
    localStorage.removeItem('azxai_radar_token');
    setToken('');
    setTenant(null);
    setPreferences(null);
    setBriefs([]);
    setActiveBrief(null);
    setActiveItems([]);
    openSignIn();
  };

  // Switch to one of the seeded demo personas
  const switchPersona = async (personaIdx: number) => {
    setCurrentPersonaIndex(personaIdx);
    setLoading(true);
    const selected = DEMO_PERSONAS[personaIdx];

    try {
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selected.id, role: selected.role }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setTenant(data.tenant);
        setRole(data.role);
        localStorage.setItem('azxai_radar_token', data.token);

        if (data.role === 'owner') {
          setActiveNav('owner');
        } else if (activeNav === 'owner') {
          setActiveNav('brief');
        }

        await fetchTenantData(data.token, data.tenant.id);
      }
    } catch (err) {
      console.error('Failed to switch persona:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantData = async (authToken: string, tenantId: string) => {
    try {
      const headers = { Authorization: `Bearer ${authToken}` };

      // 1. Fetch Profile & Preferences
      const meRes = await fetch('/api/tenant/me', { headers });
      if (meRes.ok) {
        const meData = await meRes.json();
        const rawTenant = meData.tenant || {};
        const normalizedTenant: TenantContext = {
          ...rawTenant,
          companyName: rawTenant.companyName || rawTenant.company_name || 'My Business',
          vendorLimit: rawTenant.vendorLimit || rawTenant.vendor_limit || 3,
        };
        setTenant(normalizedTenant);
        setRole(meData.role || 'customer');
        setPreferences(meData.preferences);
      }

      // 2. Fetch Vendors Catalog
      const vRes = await fetch('/api/vendors');
      if (vRes.ok) {
        const vData = await vRes.json();
        setVendors(vData.vendors || []);
      }

      // 3. Fetch Briefs
      const bRes = await fetch('/api/tenant/briefs', { headers });
      if (bRes.ok) {
        const bData = await bRes.json();
        const loadedBriefs: WeeklyBrief[] = bData.briefs || [];
        setBriefs(loadedBriefs);

        if (loadedBriefs.length > 0) {
          const latest = loadedBriefs[0];
          setActiveBrief(latest);
          await loadBriefItems(latest.id, authToken);
        } else {
          setActiveBrief(null);
          setActiveItems([]);
        }
      }
    } catch (err) {
      console.error('Error fetching tenant data:', err);
    }
  };

  const loadBriefItems = async (briefId: string, authToken = token) => {
    try {
      const res = await fetch(`/api/tenant/briefs/${briefId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveBrief(data.brief);
        setActiveItems(data.items || []);
      }
    } catch (err) {
      console.error('Error loading brief items:', err);
    }
  };

  // Restore session from localStorage or boot default demo persona
  useEffect(() => {
    const initSession = async () => {
      const savedToken = localStorage.getItem('azxai_radar_token');
      if (savedToken) {
        try {
          const res = await fetch('/api/tenant/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            const rawTenant = data.tenant || {};
            const normalizedTenant: TenantContext = {
              ...rawTenant,
              companyName: rawTenant.companyName || rawTenant.company_name || 'My Business',
              vendorLimit: rawTenant.vendorLimit || rawTenant.vendor_limit || 3,
            };
            setToken(savedToken);
            setTenant(normalizedTenant);
            setRole(data.role || 'customer');
            setPreferences(data.preferences);
            await fetchTenantData(savedToken, normalizedTenant.id);
            setLoading(false);
            return;
          }
        } catch {
          // fallback to demo
        }
      }
      switchPersona(0);
    };

    initSession();
  }, []);

  const handleSavePreferences = async (updated: Partial<TenantPreferences>): Promise<boolean> => {
    try {
      const res = await fetch('/api/tenant/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updated),
      });

      if (res.ok) {
        await fetchTenantData(token, tenant!.id);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleReanalyzeBrief = async () => {
    if (!token) return;
    const res = await fetch('/api/tenant/generate-brief', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to generate on-demand brief');
    }
    if (tenant) {
      await fetchTenantData(token, tenant.id);
      setActiveNav('brief');
    }
  };

  const handleUpdatePlan = async (newPlan: 'starter' | 'pro' | 'enterprise') => {
    if (!token) return;
    const res = await fetch('/api/tenant/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan: newPlan }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update plan');
    }
    const data = await res.json();
    setTenant(data.tenant);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Radio className="w-4 h-4" />
            </div>
            <span className="font-bold text-white tracking-tight text-lg">
              AZxAI Radar
            </span>
          </div>

          {/* User Account State & Actions */}
          <div className="flex items-center gap-2.5">
            {tenant ? (
              <div className="hidden md:flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs">
                <div className="w-6 h-6 rounded-full bg-blue-900 text-blue-300 flex items-center justify-center font-bold text-[10px]">
                  {(tenant.companyName || tenant.company_name || 'B').charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <div className="font-bold text-slate-200 truncate max-w-[140px]">
                    {tenant.companyName || tenant.company_name || 'My Organization'}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
                    <span className="text-blue-400 font-semibold">{tenant.plan || 'pro'}</span>
                    <span>•</span>
                    <span>{role}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Login / Switch Account Button */}
            <button
              onClick={openSignIn}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-all"
            >
              <LogIn className="w-3.5 h-3.5 text-blue-400" />
              <span>Log In</span>
            </button>

            {/* Create Account / Onboard Button */}
            <button
              onClick={openSignUp}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>

            {/* Demo Verification Scenario Modal Trigger */}
            <button
              onClick={() => setShowDemoModal(true)}
              className="hidden lg:inline-flex items-center gap-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 border border-slate-700/80 text-xs font-medium px-2.5 py-2 rounded-lg transition-all"
              title="Inspect automated end-to-end evidence ingestion and critique flow"
            >
              <Play className="w-3 h-3 fill-current text-blue-400" />
              <span>Live Scenario</span>
            </button>

            {/* Quick Demo Switcher Dropdown */}
            <div className="relative">
              <select
                value={currentPersonaIndex}
                onChange={(e) => switchPersona(parseInt(e.target.value, 10))}
                className="bg-slate-800 text-xs font-medium text-slate-300 rounded-lg border border-slate-700 px-2.5 py-2 pr-7 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Quick-switch evaluation account"
              >
                {DEMO_PERSONAS.map((p, idx) => (
                  <option key={idx} value={idx}>
                    Demo: {p.name} ({p.role.toUpperCase()})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            {/* Logout button if logged in */}
            {token && (
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors"
                title="Sign out of account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 border-t border-slate-800/60 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveNav('brief')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeNav === 'brief'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Weekly Brief</span>
            {briefs.length > 0 && (
              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono">
                #{activeBrief?.issue_number || 1}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('vendors')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeNav === 'vendors'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Customize Analysis Parameters & Vendors</span>
            {preferences && (
              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono">
                {preferences.selectedVendors.length} tracked
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('owner')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeNav === 'owner'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Editorial & Sources (Owner Console)</span>
            {role === 'owner' && (
              <span className="bg-purple-950 text-purple-300 border border-purple-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
                Admin
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {loading && !tenant ? (
          <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-3"></div>
            <span>Connecting to AZxAI Radar Database...</span>
          </div>
        ) : activeNav === 'brief' && tenant ? (
          <WeeklyBriefView
            tenant={tenant}
            briefs={briefs}
            activeBrief={activeBrief}
            items={activeItems}
            onSelectBrief={(id) => loadBriefItems(id)}
            onRefresh={() => fetchTenantData(token, tenant.id)}
          />
        ) : activeNav === 'vendors' && tenant && preferences ? (
          <VendorSettingsView
            tenant={tenant}
            preferences={preferences}
            vendors={vendors}
            onSavePreferences={handleSavePreferences}
            onReanalyzeBrief={handleReanalyzeBrief}
            onUpdatePlan={handleUpdatePlan}
          />
        ) : activeNav === 'owner' ? (
          <OwnerConsoleView token={token} onSwitchToOwner={() => switchPersona(3)} />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            AZxAI Radar • Verified AI Vendor Changes for Small and Midsize Businesses
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Durable SQLite Storage</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Gemini 3.8 Reasoning & Critique</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Verification Demonstration Modal */}
      <ScenarioDemoModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        onComplete={() => fetchTenantData(token, tenant?.id || 'tenant_acme_legal')}
      />

      {/* Unified Authentication Modal (Sign In / Login & Create Account / Sign Up) */}
      <AuthModal
        isOpen={showAuthModal}
        initialMode={authModalMode}
        onClose={() => setShowAuthModal(false)}
        availableVendors={vendors}
        onAuthSuccess={(authResult) => {
          setToken(authResult.token);
          setTenant(authResult.tenant);
          setRole(authResult.role);
          fetchTenantData(authResult.token, authResult.tenant.id);
          setActiveNav(authResult.role === 'owner' ? 'owner' : 'brief');
        }}
      />
    </div>
  );
}
