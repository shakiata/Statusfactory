'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import pkg from '../../package.json';
import { ConnectionBar } from '@/components/ConnectionBar';
import { EndpointList } from '@/components/EndpointList';
import { PowerDashboard } from '@/components/dashboard/PowerDashboard';
import { ProductionMonitor } from '@/components/dashboard/ProductionMonitor';
import { FactoryEfficiency } from '@/components/dashboard/FactoryEfficiency';
import { ResourceTracker } from '@/components/dashboard/ResourceTracker';
import { GeneratorStatus } from '@/components/dashboard/GeneratorStatus';
import { PlayerMap } from '@/components/dashboard/PlayerMap';
import { InventoryPanel } from '@/components/dashboard/InventoryPanel';
import { ChatPanel } from '@/components/dashboard/ChatPanel';
import { TrainControlTower } from '@/components/dashboard/TrainControlTower';
import { SettingsPanel } from '@/components/dashboard/SettingsPanel';
import { FluidDashboard } from '@/components/dashboard/FluidDashboard';
import { useConfig } from '@/lib/useConfig';
import { useAppSettings } from '@/lib/useAppSettings';
import { ThemeProvider } from '@/lib/useTheme';
import { abortAllRequests, getEndpoints, getEndpointsByCategory, testConnection } from '@/lib/api';
import { parseConfigEndpoint } from '@/lib/connection/contract';
import { TimeWindowSelector, type TimeWindowMs } from '@/components/TimeWindowSelector';

const TABS = [
  { id: 'power', label: '⚡ Power', icon: '⚡' },
  { id: 'production', label: '📊 Production', icon: '📊' },
  { id: 'factory', label: '🏭 Factory', icon: '🏭' },
  { id: 'resources', label: '⛏️ Resources', icon: '⛏️' },
  { id: 'generators', label: '🔥 Generators', icon: '🔥' },
  { id: 'trains', label: '🚂 Trains', icon: '🚂' },
  { id: 'inventory', label: '📦 Inventory', icon: '📦' },
  { id: 'players', label: '👤 Players', icon: '👤' },
  { id: 'chat', label: '💬 Chat', icon: '💬' },
  { id: 'fluids', label: '💧 Fluids', icon: '💧' },
  { id: 'api', label: '🔧 API Explorer', icon: '🔧' },
  { id: 'settings', label: '🎨 Settings', icon: '🎨' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Main-owned connection profile identity returned by `connectionSelect`. */
interface SelectedProfile {
  id: string;
  generation: number;
  origin: string;
}

/**
 * Root dashboard page — the single-page shell that orchestrates the session
 * token, connection generation, tab navigation and panels.
 *
 * Session-only credential policy: `token` lives in React state and is cleared
 * on reload, restart, origin change, Forget and disconnect. It is never written
 * to storage.
 */
export default function Home() {
  const { config, saveConfig, loaded, notice, dismissNotice } = useConfig();
  const { settings, saveSettings, loaded: settingsLoaded } = useAppSettings();
  const [token, setToken] = useState('');
  const [credentialOrigin, setCredentialOrigin] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('power');
  const [timeWindow, setTimeWindow] = useState<TimeWindowMs>(0);
  const [connectionGeneration, setConnectionGeneration] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<SelectedProfile | null>(null);
  const [plaintextAcks, setPlaintextAcks] = useState<Set<string>>(() => new Set());
  /** Incremented on every connection identity change; remounts panel state. */
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const connectAttempt = useRef(0);

  const endpointResult = useMemo(() => parseConfigEndpoint(config), [config]);
  const endpoint = endpointResult.ok ? endpointResult.endpoint : null;

  const [applied, setApplied] = useState(false);
  if (!applied && loaded && settingsLoaded) {
    setApplied(true);
    if (TABS.some((t) => t.id === settings.activeTab)) {
      setActiveTab(settings.activeTab as TabId);
    }
    setTimeWindow(settings.timeWindow as TimeWindowMs);
  }

  /** Drops the live credential and all in-flight work. */
  const clearSession = useCallback(() => {
    abortAllRequests();
    setToken('');
    setCredentialOrigin(null);
    setConnected(false);
    setConnecting(false);
    setSelectedProfile(null);
    setConnectionEpoch((value) => value + 1);
  }, []);

  /** Asks main to select a profile (or disconnect) and records its generation. */
  const selectProfile = useCallback(async (origin: string | null): Promise<{ ok: boolean; code?: string; message?: string }> => {
    if (!window.electronAPI) return { ok: true };
    const result = await window.electronAPI.connectionSelect({ origin, expectedGeneration: connectionGeneration });
    if (typeof result.generation === 'number') setConnectionGeneration(result.generation);
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message:
          result.code === 'recovery-required'
            ? 'A previous tunnel could not be confirmed closed. Stop it and verify closure before reconnecting.'
            : 'The connection profile could not be changed.',
      };
    }
    if (origin && result.profileId && result.origin) {
      setSelectedProfile({ id: result.profileId, generation: result.generation ?? connectionGeneration, origin: result.origin });
    } else {
      setSelectedProfile(null);
    }
    return { ok: true };
  }, [connectionGeneration]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    saveSettings({ activeTab: tab });
  };

  const handleTimeWindowChange = (tw: TimeWindowMs) => {
    setTimeWindow(tw);
    saveSettings({ timeWindow: tw });
  };

  /** Connects using the current session token; main selects the profile first. */
  const handleConnect = async () => {
    if (!endpoint) {
      setError(endpointResult.ok ? 'Invalid endpoint.' : endpointResult.error.message);
      return;
    }
    if (endpoint.requiresPlaintextAcknowledgement && !plaintextAcks.has(endpoint.origin)) {
      setError('Acknowledge the unencrypted LAN connection before connecting.');
      return;
    }
    const attempt = ++connectAttempt.current;
    setConnecting(true);
    setError(null);
    const selection = await selectProfile(endpoint.origin);
    if (attempt !== connectAttempt.current) return;
    if (!selection.ok) {
      setConnecting(false);
      setError(selection.message ?? 'Connection failed.');
      return;
    }
    const result = await testConnection({ ...config, password: token });
    if (attempt !== connectAttempt.current) return;
    setConnecting(false);
    if (result.ok) {
      setConnected(true);
      setCredentialOrigin(endpoint.origin);
    } else {
      setConnected(false);
      setError(result.error || 'Connection failed');
    }
  };

  /** Cancels a pending connection and aborts outstanding requests. */
  const handleCancel = () => {
    connectAttempt.current += 1;
    abortAllRequests();
    setConnecting(false);
    setError('Connection cancelled.');
  };

  /** Forgets the session token and returns to a disconnected state. */
  const handleForget = async () => {
    if (window.electronAPI) await window.electronAPI.tunnelStop();
    clearSession();
    setError(null);
    await selectProfile(null);
  };

  /** Disconnects but keeps the nonsecret profile. */
  const handleDisconnect = async () => {
    if (window.electronAPI) await window.electronAPI.tunnelStop();
    clearSession();
    setError(null);
    await selectProfile(null);
  };

  /** Editing any connection field invalidates the session credential. */
  const handleConfigChange = (newConfig: typeof config) => {
    saveConfig(newConfig);
    if (connected || connecting || token || selectedProfile) {
      clearSession();
      // Editing the origin must not leave a public tunnel running: main stops it
      // and only commits the new/disconnected profile after confirmed closure.
      if (window.electronAPI) void window.electronAPI.tunnelStop();
      void selectProfile(null);
    }
    setError(null);
  };

  /** Editing the token ends the current authenticated session. */
  const handleTokenChange = (value: string) => {
    setToken(value);
    if (connected || connecting) {
      clearSession();
      setToken(value);
      setError('Token changed; connect again.');
      void selectProfile(null);
    }
  };

  const togglePlaintextAck = (origin: string, ack: boolean) => {
    setPlaintextAcks((previous) => {
      const next = new Set(previous);
      if (ack) next.add(origin);
      else next.delete(origin);
      return next;
    });
  };

  /** Runtime config passed to panels: token only for the bound origin. */
  const runtimeConfig = useMemo(
    () => ({ ...config, password: credentialOrigin === endpoint?.origin ? token : '' }),
    [config, credentialOrigin, endpoint?.origin, token],
  );

  const endpoints = getEndpoints();
  const categories = getEndpointsByCategory();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, 12_000);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!loaded || !settingsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="px-6 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))' }}>
            <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Statusfactory</h1>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ficsit Remote Monitoring</p>
          </div>
          {connected && endpoint && (
            <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full border" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                Live — {endpoint.origin}
              </span>
            </div>
          )}
        </div>

        <ConnectionBar
          config={config}
          token={token}
          onTokenChange={handleTokenChange}
          onConfigChange={handleConfigChange}
          onConnect={handleConnect}
          onCancel={handleCancel}
          onForget={handleForget}
          onDisconnect={handleDisconnect}
          connected={connected}
          connecting={connecting}
          error={error}
          endpoint={endpoint}
          endpointError={endpointResult.ok ? null : endpointResult.error}
          plaintextAck={endpoint ? plaintextAcks.has(endpoint.origin) : false}
          onPlaintextAckChange={togglePlaintextAck}
          profile={selectedProfile}
        />

        {notice && (
          <div role="status" className="px-6 py-2 text-xs" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            {notice}
          </div>
        )}

        {!connected && !connecting && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <svg className="w-10 h-10" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Connect to Your Factory</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Enter your Satisfactory server&apos;s address and port where the <strong>Ficsit Remote Monitoring</strong> mod is running.
                The default port is <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)' }}>8080</code>.
              </p>
              <div className="mt-6 p-4 rounded-xl text-left" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>In-Game Setup</p>
                <ol className="text-xs space-y-1.5 list-decimal list-inside" style={{ color: 'var(--text-primary)' }}>
                  <li>Install the <strong>Ficsit Remote Monitoring</strong> mod</li>
                  <li>In-game, open chat and type <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}>/frm http start</code></li>
                  <li>Find the token in <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}>Configs/FicsitRemoteMonitoring/WebServer.cfg</code></li>
                  <li>Enter the IP, port, and token above and click Connect</li>
                </ol>
                <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  The token is kept in memory for this session only and is never saved to disk.
                </p>
              </div>
            </div>
          </div>
        )}

        {connected && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 flex gap-1 overflow-x-auto items-center" style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all tab-btn ${activeTab === tab.id ? 'tab-active' : ''}`}
                  style={{
                    borderColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
              <div className="ml-auto pr-2">
                <TimeWindowSelector value={timeWindow} onChange={handleTimeWindowChange} />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6" key={connectionEpoch}>
              {activeTab === 'power' && <PowerDashboard config={runtimeConfig} timeWindow={timeWindow} />}
              {activeTab === 'production' && <ProductionMonitor config={runtimeConfig} timeWindow={timeWindow} settings={settings} />}
              {activeTab === 'factory' && <FactoryEfficiency config={runtimeConfig} timeWindow={timeWindow} />}
              {activeTab === 'resources' && <ResourceTracker config={runtimeConfig} timeWindow={timeWindow} />}
              {activeTab === 'generators' && <GeneratorStatus config={runtimeConfig} timeWindow={timeWindow} />}
              {activeTab === 'trains' && <TrainControlTower config={runtimeConfig} />}
              {activeTab === 'inventory' && <InventoryPanel config={runtimeConfig} settings={settings} />}
              {activeTab === 'players' && <PlayerMap config={runtimeConfig} />}
              {activeTab === 'chat' && <ChatPanel config={runtimeConfig} />}
              {activeTab === 'settings' && <SettingsPanel config={config} saveConfig={saveConfig} settings={settings} saveSettings={saveSettings} />}
              {activeTab === 'fluids' && <FluidDashboard config={runtimeConfig} timeWindow={timeWindow} settings={settings} />}
              {activeTab === 'api' && <EndpointList config={runtimeConfig} endpoints={endpoints} categories={categories} />}
            </div>
          </div>
        )}

        <div className="px-6 py-2 text-center text-xs" style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', color: 'var(--muted)' }}>
          Statusfactory v{pkg.version} — Powered by Ficsit Remote Monitoring
        </div>
      </div>
    </ThemeProvider>
  );
}
