'use client';

import { useCallback, useEffect, useState } from 'react';
import { FRMConfig } from '@/lib/types';
import { useTheme } from '@/lib/useTheme';
import type { ConnectionEndpoint, EndpointError } from '@/lib/connection/contract';
import type { TunnelState } from '@/lib/tunnel-types';

interface SelectedProfile {
  id: string;
  generation: number;
  origin: string;
}

interface ConnectionBarProps {
  config: FRMConfig;
  token: string;
  onTokenChange: (token: string) => void;
  onConfigChange: (config: FRMConfig) => void;
  onConnect: () => void;
  onCancel: () => void;
  onForget: () => void;
  onDisconnect: () => void;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  endpoint: ConnectionEndpoint | null;
  endpointError: EndpointError | null;
  plaintextAck: boolean;
  onPlaintextAckChange: (origin: string, ack: boolean) => void;
  profile: SelectedProfile | null;
}

const IDLE_STATE: TunnelState = {
  state: 'idle',
  generation: 0,
  profileId: null,
  publicUrl: null,
  error: null,
  closureUnknown: false,
  simulated: false,
};

/** Maps a main-process rejection code to a safe, actionable message. */
function shareErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'provider-not-configured':
      return 'Provider credentials are not configured. Ask the owner to add a user-only provider credential file.';
    case 'provider-file-permissions':
      return 'The provider credential file is readable by other users and was refused.';
    case 'artifact-unverified':
      return 'The bundled ngrok CLI is missing or not pinned to a verified digest. Sharing is disabled.';
    case 'auth-contract-unverified':
      return 'Sharing is disabled because the supported FRM version and authentication coverage are not recorded. This is the selected containment for this release.';
    case 'auth-not-enforced':
      return 'The FRM server accepted an unauthenticated request. Sharing is blocked because the exposure cannot be characterised.';
    case 'auth-rejected':
      return 'The FRM server rejected the session token. Re-enter it and connect again.';
    case 'probe-transport-failed':
      return 'The FRM authentication probe could not reach the server.';
    case 'profile-conflict':
      return 'The selected server changed. Connect again before sharing.';
    case 'expired-permit':
      return 'The share authorization expired. Start sharing again.';
    case 'closure-unknown':
      return 'A previous tunnel could not be confirmed closed. Verify closure before starting again.';
    default:
      return 'Sharing could not be started.';
  }
}

/** Human-readable label and tone for each tunnel state. */
function tunnelLabel(state: TunnelState, theme: { danger: string; success: string; textSecondary: string; accent: string }) {
  switch (state.state) {
    case 'starting':
      return { text: 'Starting — waiting for a verified HTTPS URL', color: theme.accent };
    case 'active':
      return state.simulated
        ? { text: 'SIMULATED sharing — no public endpoint exists', color: theme.accent }
        : { text: 'Sharing — the entire reachable FRM API is exposed', color: theme.success };
    case 'stopping':
      return { text: 'Stopping — confirming closure', color: theme.accent };
    case 'failed_closed':
      return { text: 'Share failed; closure confirmed', color: theme.danger };
    case 'closure_unknown':
      return { text: 'Closure unconfirmed — public exposure may remain', color: theme.danger };
    default:
      return { text: 'Not sharing', color: theme.textSecondary };
  }
}

/**
 * Connection and sharing controls.
 *
 * Owns the presentation of every security state in
 * docs/security/05_DESIGN_AND_ACCESSIBILITY.md. The session token is a prop and
 * is never persisted here; sharing uses main-issued permits only.
 */
export function ConnectionBar({
  config,
  token,
  onTokenChange,
  onConfigChange,
  onConnect,
  onCancel,
  onForget,
  onDisconnect,
  connected,
  connecting,
  error,
  endpoint,
  endpointError,
  plaintextAck,
  onPlaintextAckChange,
  profile,
}: ConnectionBarProps) {
  const { theme } = useTheme();
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const [tunnel, setTunnel] = useState<TunnelState>(IDLE_STATE);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [sharingPolicy, setSharingPolicy] = useState<{ verified: boolean; simulated?: boolean; note: string | null }>({
    verified: false,
    note: null,
  });

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    let active = true;
    window.electronAPI.tunnelStatus().then((result) => {
      if (!active) return;
      if (result.ok && result.state) setTunnel(result.state);
      if (result.sharing) setSharingPolicy(result.sharing);
    });
    const unsubscribe = window.electronAPI.onTunnelState((state) => {
      if (active) setTunnel(state);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isElectron]);

  /** Requests a permit from main, then starts the tunnel with that permit only. */
  const startShare = useCallback(async () => {
    if (!window.electronAPI || !profile || !endpoint || !token) return;
    setShareBusy(true);
    setShareError(null);
    const authorization = await window.electronAPI.shareAuthorize({
      profileId: profile.id,
      generation: profile.generation,
      frmToken: token,
    });
    if (!authorization.ok || !authorization.permitId) {
      setShareBusy(false);
      setShareError(shareErrorMessage(authorization.code));
      return;
    }
    const started = await window.electronAPI.tunnelStart({ permitId: authorization.permitId });
    setShareBusy(false);
    if (!started.ok) setShareError(shareErrorMessage(started.code));
  }, [endpoint, profile, token]);

  /** Stops the owned tunnel; main reports confirmed or unknown closure. */
  const stopShare = useCallback(async () => {
    if (!window.electronAPI) return;
    setShareBusy(true);
    setShareError(null);
    const result = await window.electronAPI.tunnelStop();
    setShareBusy(false);
    if (!result.ok) setShareError('Tunnel closure could not be confirmed. Keep sharing disabled and follow recovery guidance.');
  }, []);

  /** Copies only the public URL; reports failure instead of a false success. */
  const copyUrl = useCallback(async () => {
    if (!tunnel.publicUrl) return;
    try {
      await navigator.clipboard.writeText(tunnel.publicUrl);
      setCopyStatus('Copied public URL');
    } catch {
      setCopyStatus('Copy failed — select the URL and copy manually');
    }
    setTimeout(() => setCopyStatus(null), 3000);
  }, [tunnel.publicUrl]);

  const label = tunnelLabel(tunnel, theme);
  const canShare =
    isElectron &&
    sharingPolicy.verified &&
    connected &&
    !!profile &&
    !!endpoint &&
    !!token &&
    !shareBusy &&
    (tunnel.state === 'idle' || tunnel.state === 'failed_closed');
  const plaintextPending = !!endpoint?.requiresPlaintextAcknowledgement && !plaintextAck;

  return (
    <div className="p-4" style={{ backgroundColor: theme.bgSecondary, borderBottom: `1px solid ${theme.borderColor}` }}>
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="frm-host" className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>
              Host
            </label>
            <input
              id="frm-host"
              type="text"
              value={config.host}
              onChange={(event) => onConfigChange({ ...config, host: event.target.value })}
              placeholder="localhost"
              aria-invalid={endpointError?.field === 'host' || endpointError?.field === 'scheme'}
              aria-describedby={endpointError ? 'frm-endpoint-error' : undefined}
              className="rounded-lg px-3 py-2 text-sm w-64 focus:outline-none transition-colors conn-input"
              style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor, color: theme.textPrimary, borderWidth: '1px', borderStyle: 'solid' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="frm-port" className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>
              Port
            </label>
            <input
              id="frm-port"
              type="text"
              inputMode="numeric"
              value={config.port}
              onChange={(event) => onConfigChange({ ...config, port: event.target.value })}
              placeholder="8080"
              aria-invalid={endpointError?.field === 'port'}
              aria-describedby={endpointError ? 'frm-endpoint-error' : undefined}
              className="rounded-lg px-3 py-2 text-sm w-24 focus:outline-none transition-colors conn-input"
              style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor, color: theme.textPrimary, borderWidth: '1px', borderStyle: 'solid' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="frm-token" className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>
              Auth Token
            </label>
            <input
              id="frm-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => onTokenChange(event.target.value)}
              placeholder="From WebServer.cfg"
              aria-describedby="frm-token-help"
              className="rounded-lg px-3 py-2 text-sm w-44 focus:outline-none transition-colors conn-input"
              style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor, color: theme.textPrimary, borderWidth: '1px', borderStyle: 'solid' }}
            />
          </div>

          <button
            onClick={onConnect}
            disabled={connecting || plaintextPending || !endpoint}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            style={{
              backgroundColor: connected ? theme.success + '20' : theme.accent,
              color: connected ? theme.success : 'black',
              border: connected ? `1px solid ${theme.success}40` : 'none',
            }}
          >
            {connecting ? 'Connecting…' : connected ? 'Connected' : 'Connect'}
          </button>

          {connecting && (
            <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ color: theme.textPrimary, border: `1px solid ${theme.borderColor}` }}>
              Cancel
            </button>
          )}
          {connected && (
            <button onClick={onDisconnect} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ color: theme.textPrimary, border: `1px solid ${theme.borderColor}` }}>
              Disconnect
            </button>
          )}
          {(token || connected) && (
            <button onClick={onForget} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ color: theme.danger, border: `1px solid ${theme.borderColor}` }}>
              Forget token
            </button>
          )}

          {endpoint && (
            <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: theme.bgPrimary, color: theme.textSecondary }}>
              {endpoint.origin}
              {endpoint.scheme === 'http' ? ' · HTTP — unencrypted' : ''}
            </span>
          )}
        </div>

        <p id="frm-token-help" className="text-xs" style={{ color: theme.textSecondary }}>
          The FRM token is scoped to this exact server ({endpoint?.origin ?? 'no valid origin'}) and kept in memory for this
          session only. It is cleared on reload, restart, origin change, Forget and disconnect.
        </p>

        {endpointError && (
          <p id="frm-endpoint-error" role="alert" className="text-sm" style={{ color: theme.danger }}>
            {endpointError.message}
          </p>
        )}

        {plaintextPending && endpoint && (
          <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: theme.danger + '12', border: `1px solid ${theme.danger}44` }}>
            <p style={{ color: theme.textPrimary }}>
              <strong>{endpoint.origin}</strong> uses plain HTTP on a LAN address. The FRM token and factory/chat data
              travel without encryption and can be observed by others on that network.
            </p>
            <label className="mt-2 flex items-center gap-2" style={{ color: theme.textPrimary }}>
              <input
                type="checkbox"
                checked={plaintextAck}
                onChange={(event) => onPlaintextAckChange(endpoint.origin, event.target.checked)}
              />
              I understand and want to connect to this exact origin for this session.
            </label>
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm px-3 py-2 rounded-lg border" style={{ color: theme.danger, backgroundColor: theme.danger + '18', borderColor: theme.danger + '33' }}>
            {error}
          </div>
        )}

        {isElectron && (
          <div className="rounded-lg p-3" style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}` }}>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Share factory data</p>
                <p className="text-xs" style={{ color: theme.textSecondary }}>
                  Sharing exposes the entire reachable FRM API through a provider tunnel — not a screenshot. It does not
                  share your FRM token. Provider account credentials are configured locally in the desktop app, never here.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span role="status" aria-live="polite" className="text-xs font-medium" style={{ color: label.color }}>
                  {label.text}
                </span>
                {(tunnel.state === 'idle' || tunnel.state === 'failed_closed') && (
                  <button
                    onClick={startShare}
                    disabled={!canShare}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ backgroundColor: theme.accent + '18', color: theme.accent, border: `1px solid ${theme.accent}30` }}
                  >
                    {shareBusy ? 'Authorizing…' : 'Start sharing'}
                  </button>
                )}
                {(tunnel.state === 'starting' || tunnel.state === 'active' || tunnel.state === 'stopping' || tunnel.state === 'closure_unknown') && (
                  <button
                    onClick={stopShare}
                    disabled={shareBusy || tunnel.state === 'stopping'}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ backgroundColor: theme.danger + '18', color: theme.danger, border: `1px solid ${theme.danger}30` }}
                  >
                    {tunnel.state === 'closure_unknown' ? 'Retry Stop' : 'Stop sharing'}
                  </button>
                )}
              </div>
            </div>

            {tunnel.state === 'active' && tunnel.publicUrl && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {tunnel.simulated ? (
                  <span className="text-xs font-mono" style={{ color: theme.accent }}>
                    {tunnel.publicUrl} (simulated, not reachable)
                  </span>
                ) : (
                  <a href={tunnel.publicUrl} target="_blank" rel="noreferrer" className="text-xs font-mono underline" style={{ color: theme.success }}>
                    {tunnel.publicUrl}
                  </a>
                )}
                <button onClick={copyUrl} className="px-2 py-1 rounded text-xs" style={{ color: theme.accent, border: `1px solid ${theme.borderColor}` }}>
                  Copy URL
                </button>
                <span role="status" aria-live="polite" className="text-xs" style={{ color: theme.textSecondary }}>
                  {copyStatus}
                </span>
              </div>
            )}

            {tunnel.state === 'closure_unknown' && (
              <div role="alert" className="mt-2 text-xs" style={{ color: theme.danger }}>
                {tunnel.error || 'Closure could not be confirmed.'} The public endpoint may still be reachable. Verify it in
                your provider account or OS process list, then retry Stop. New sharing stays blocked until closure is proven.
              </div>
            )}
            {tunnel.state === 'failed_closed' && tunnel.error && (
              <p role="status" className="mt-2 text-xs" style={{ color: theme.textSecondary }}>
                {tunnel.error} Closure was confirmed.
              </p>
            )}
            {shareError && (
              <p role="alert" className="mt-2 text-xs" style={{ color: theme.danger }}>
                {shareError}
              </p>
            )}
            {sharingPolicy.simulated && (
              <p role="status" className="mt-2 text-xs" style={{ color: theme.accent }}>
                SIMULATION MODE — the lifecycle is exercised locally with a reserved .invalid URL. No provider connection
                or public endpoint exists.
              </p>
            )}
            {!sharingPolicy.verified && (
              <p role="status" className="mt-2 text-xs" style={{ color: theme.textSecondary }}>
                {sharingPolicy.note ??
                  'Sharing is disabled until the owner records the supported FRM version and authentication coverage.'}
              </p>
            )}
            {!connected && (
              <p className="mt-2 text-xs" style={{ color: theme.textSecondary }}>
                Connect to the FRM server first. Sharing also requires main to verify that the server rejects
                unauthenticated requests and accepts your session token.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
