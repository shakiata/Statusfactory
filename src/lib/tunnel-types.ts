/**
 * Shared tunnel state types for the renderer.
 * Mirrors the public state emitted by electron/tunnel/service.js.
 */
export interface TunnelState {
  state: 'idle' | 'starting' | 'active' | 'stopping' | 'failed_closed' | 'closure_unknown';
  generation: number;
  profileId: string | null;
  publicUrl: string | null;
  error: string | null;
  closureUnknown: boolean;
  /** True only for the dev-only simulator; never for a real provider tunnel. */
  simulated?: boolean;
}
