/**
 * Types for the narrow preload bridge.
 * Kept in sync with electron/preload.js and the main-process validators.
 */

import type { TunnelState } from './tunnel-types';

export interface ConnectionSelectResult {
  ok: boolean;
  code?: string;
  generation?: number;
  profileId?: string;
  origin?: string | null;
  error?: string;
  state?: TunnelState;
}

export interface ShareAuthorizeResult {
  ok: boolean;
  code?: string;
  permitId?: string;
  expiresAt?: number;
  profileId?: string;
  generation?: number;
}

export interface TunnelCommandResult {
  ok: boolean;
  code?: string;
  confirmed?: boolean;
  reason?: string;
  detail?: string;
  error?: string;
  state?: TunnelState;
}

declare global {
  interface Window {
    electronAPI?: {
      connectionSelect: (input: { origin: string | null; expectedGeneration: number }) => Promise<ConnectionSelectResult>;
      shareAuthorize: (input: { profileId: string; generation: number; frmToken: string }) => Promise<ShareAuthorizeResult>;
      tunnelStart: (input: { permitId: string }) => Promise<TunnelCommandResult>;
      tunnelStop: (input?: Record<string, never>) => Promise<TunnelCommandResult>;
      tunnelStatus: () => Promise<{
        ok: boolean;
        state?: TunnelState;
        code?: string;
        sharing?: { verified: boolean; note: string | null };
      }>;
      onTunnelState: (callback: (state: TunnelState) => void) => () => void;
    };
  }
}

export {};
