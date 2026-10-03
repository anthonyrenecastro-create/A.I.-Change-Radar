import React, { useState, useEffect } from 'react';
import { WeeklyBriefView } from './components/WeeklyBriefView';
import { VendorSettingsView } from './components/VendorSettingsView';
import { OwnerConsoleView } from './components/OwnerConsoleView';
import { ResearchSimulator } from './components/ResearchSimulator';
import { ScenarioDemoModal } from './components/ScenarioDemoModal';
import { Vendor, WeeklyBrief, BriefItem, TenantContext, TenantPreferences } from './types/radar';
import {
  Radio,
  Sliders,
  Shield,
  FlaskConical,
  Building,
  Play,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Layers,
  Sparkles,
  Database
} from 'lucide-react';

const DEMO_PERSONAS = [
  {
    id: 'tenant_acme_legal',
    name: 'Acme Legal Partners',
    industry: 'Legal & Professional Services',
    role: 'customer',
  },
  {
    id: 'tenant_apex_health',
    name: 'Apex Health Systems',
    industry: 'Healthcare & Life Sciences',
    role: 'customer',
  },
  {
    id: 'tenant_cloudscale',
    name: 'CloudScale SaaS Inc',
    industry: 'Technology & Software',
    role: 'customer',
  },
  {
    id: 'tenant_acme_legal',
    name: 'System Editorial Owner',
    industry: 'Editorial & Operations Gate',
    role: 'owner',
  },
];

export default function App() {
  const [activeNav, setActiveNav] = useState<'brief' | 'vendors' | 'owner' | 'simulator'>('brief');
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

  // Initialize Session with Demo Persona
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
        setTenant(meData.tenant);
        setRole(meData.role);
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

  useEffect(() => {
    switchPersona(0);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight text-lg">
                  AI Change Radar
                </span>
                <span className="text-[10px] font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60 uppercase">
                  SMB Intelligence
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Verified weekly briefs explaining what changed, why it matters, and next steps
              </div>
            </div>
          </div>

          {/* Persona Switcher & Verification Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDemoModal(true)}
              className="hidden sm:inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Verification Demo</span>
            </button>

            {/* Persona Dropdown */}
            <div className="relative">
              <select
                value={currentPersonaIndex}
                onChange={(e) => switchPersona(parseInt(e.target.value, 10))}
                className="bg-slate-800 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEMO_PERSONAS.map((p, idx) => (
                  <option key={idx} value={idx}>
                    {p.name} ({p.role.toUpperCase()})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>
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
              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
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
            <Sliders className="w-4 h-4" />
            <span>Monitored Vendors & Context</span>
            {preferences && (
              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                {preferences.selectedVendors.length}
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

          <button
            onClick={() => setActiveNav('simulator')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeNav === 'simulator'
                ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-4 h-4 text-amber-400" />
            <span>Research Simulator (HRM Substrate)</span>
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {loading && !tenant ? (
          <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-3"></div>
            <span>Connecting to AI Change Radar Database...</span>
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
          />
        ) : activeNav === 'owner' ? (
          <OwnerConsoleView token={token} />
        ) : activeNav === 'simulator' ? (
          <div className="space-y-4">
            <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-4 text-xs text-amber-200 flex items-center justify-between">
              <div>
                <strong>Reference Foundation: HRM Ecology Interactive Simulator</strong>
                <p className="text-amber-300/80 mt-0.5">
                  The original multi-agent world-model substrate workbench is preserved here intact for research inspection and benchmarking.
                </p>
              </div>
              <button
                onClick={() => setActiveNav('brief')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded font-semibold text-xs border border-slate-700"
              >
                Return to AI Change Radar
              </button>
            </div>
            <ResearchSimulator />
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            AI Change Radar • Verified AI Vendor Changes for Small and Midsize Businesses
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
    </div>
  );
}
