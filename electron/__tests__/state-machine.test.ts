/**
 * Tunnel state-machine tests.
 *
 * Requirements: REQ-009.
 * Oracle: only documented transitions are accepted; a late readiness URL after
 * Stop cannot reactivate sharing; unconfirmed closure is never reported idle.
 * Fixtures: pure state objects; no processes. Isolation: none (pure).
 */
import { describe, it, expect } from 'vitest';
import {
  beginStart,
  beginStop,
  canStart,
  childExited,
  confirmClosed,
  confirmUnknown,
  createState,
  markActive,
} from '../../electron/tunnel/state-machine.js';

/** Starts an operation and returns the new state. */
function starting() {
  const result = beginStart(createState(), { operationId: 'op1', profileId: 'p1', generation: 1 });
  if (!result.ok) throw new Error('expected start');
  return result.state;
}

describe('tunnel state machine', () => {
  it('starts only from idle/failed_closed and never creates a second operation', () => {
    expect(canStart(createState())).toBe(true);
    const started = starting();
    expect(started.state).toBe('starting');
    const second = beginStart(started, { operationId: 'op2', profileId: 'p2', generation: 2 });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('busy');
  });

  it('accepts only a current-generation HTTPS readiness URL', () => {
    const started = starting();
    expect(markActive(started, { generation: started.generation, url: 'http://x.ngrok.app' }).ok).toBe(false);
    expect(markActive(started, { generation: started.generation - 1, url: 'https://x.ngrok.app' }).ok).toBe(false);
    const active = markActive(started, { generation: started.generation, url: 'https://x.ngrok.app' });
    expect(active.ok).toBe(true);
    expect(active.state.publicUrl).toBe('https://x.ngrok.app');
  });

  it('clears the public URL on Stop and rejects a late readiness event', () => {
    const active = markActive(starting(), { generation: 1, url: 'https://x.ngrok.app' }).state;
    const stopping = beginStop(active).state;
    expect(stopping.publicUrl).toBeNull();
    expect(markActive(stopping, { generation: stopping.generation, url: 'https://late.ngrok.app' }).ok).toBe(false);
  });

  it('distinguishes confirmed closure from closure_unknown', () => {
    const stopping = beginStop(starting()).state;
    expect(confirmClosed(stopping).state).toBe('idle');
    const unknown = confirmUnknown(stopping, { error: 'no proof' });
    expect(unknown.state).toBe('closure_unknown');
    expect(unknown.closureUnknown).toBe(true);
    expect(unknown.publicUrl).toBeNull();
  });

  it('records an observed child exit as failed_closed after readiness', () => {
    const active = markActive(starting(), { generation: 1, url: 'https://x.ngrok.app' }).state;
    const exited = childExited(active, { code: 1, signal: null });
    expect(exited.state).toBe('failed_closed');
    expect(exited.error).toMatch(/exited/);
  });
});
