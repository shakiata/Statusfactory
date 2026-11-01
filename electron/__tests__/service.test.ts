/**
 * Serialized tunnel service tests with a fake adapter.
 *
 * Requirements: REQ-009.
 * Oracle: one operation at a time; Stop during Start cancels and cleans up; a
 * failed spawn or an existing marker yields closure_unknown, never idle.
 * Fixture: in-memory adapter/marker; no real process or provider call.
 */
import { describe, it, expect, vi } from 'vitest';
import { createTunnelService } from '../../electron/tunnel/service.js';

/** In-memory marker double. */
function fakeMarker() {
  let value: Record<string, unknown> | null = null;
  return {
    begin: vi.fn((input: Record<string, unknown>) => { value = { ...input, pid: null }; return value; }),
    recordSpawn: vi.fn((input: Record<string, unknown>) => { value = { ...(value ?? {}), ...input }; return value; }),
    read: vi.fn(() => value),
    clear: vi.fn(() => { value = null; }),
    set: (next: Record<string, unknown> | null) => { value = next; },
  };
}

/** Fake adapter handle with controllable readiness and exit. */
function fakeHandle(url = 'https://test.ngrok.app') {
  let exitCallback: ((info: { code: number | null; signal: string | null }) => void) | null = null;
  return {
    pid: 4242,
    url,
    stop: vi.fn(async () => ({ confirmed: true, code: 0, signal: 'SIGTERM' })),
    onExit: (callback: (info: { code: number | null; signal: string | null }) => void) => { exitCallback = callback; },
    emitExit: (info: { code: number | null; signal: string | null }) => exitCallback?.(info),
  };
}

/** Builds a service with fakes and a state history. */
function build(adapterOverrides: Record<string, unknown> = {}, marker = fakeMarker()) {
  const states: Array<Record<string, unknown>> = [];
  const handle = fakeHandle();
  const adapter = {
    start: vi.fn(async () => handle),
    terminateVerifiedPid: vi.fn(async () => ({ confirmed: true })),
    ...adapterOverrides,
  };
  const service = createTunnelService({ adapter, marker, onState: (state) => states.push(state), appSessionId: 'app-test' });
  return { service, adapter, marker, handle, states };
}

const profile = { id: 'p1', target: '192.168.1.5:8080', executableDigest: 'a'.repeat(64) };

describe('tunnel service', () => {
  it('moves starting → active and reports the verified HTTPS URL', async () => {
    const { service, states } = build();
    const result = await service.start({ profile, generation: 1, executablePath: '/opt/ngrok', providerToken: 'provider-token' });
    expect(result.ok).toBe(true);
    expect(service.getStatus()).toMatchObject({ state: 'active', publicUrl: 'https://test.ngrok.app' });
    expect(states.map((state) => state.state)).toEqual(['starting', 'active']);
  });

  it('stops with confirmed closure and clears the marker', async () => {
    const { service, marker, handle } = build();
    await service.start({ profile, generation: 1, executablePath: '/opt/ngrok', providerToken: 'p' });
    const stopped = await service.stop();
    expect(stopped).toMatchObject({ ok: true, confirmed: true });
    expect(service.getStatus().state).toBe('idle');
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(marker.clear).toHaveBeenCalled();
  });

  it('reports failed_closed when the process exits after readiness', async () => {
    const { service, handle } = build();
    await service.start({ profile, generation: 1, executablePath: '/opt/ngrok', providerToken: 'p' });
    handle.emitExit({ code: 1, signal: null });
    expect(service.getStatus().state).toBe('failed_closed');
  });

  it('enters closure_unknown when a spawn fails after the marker was written', async () => {
    const { service } = build({ start: vi.fn(async () => { throw Object.assign(new Error('spawn failed'), { code: 'readiness-timeout' }); }) });
    const result = await service.start({ profile, generation: 1, executablePath: '/opt/ngrok', providerToken: 'p' });
    expect(result.ok).toBe(false);
    expect(service.getStatus().state).toBe('closure_unknown');
  });

  it('starts in closure_unknown when a previous marker exists', async () => {
    const marker = fakeMarker();
    marker.set({ pid: 999, executablePath: '/opt/ngrok' });
    const { service } = build({}, marker);
    expect(service.init()).toMatchObject({ recovered: true });
    expect(service.getStatus().state).toBe('closure_unknown');
    const blocked = await service.start({ profile, generation: 1, executablePath: '/opt/ngrok', providerToken: 'p' });
    expect(blocked.code).toBe('closure-unknown');
  });

  it('treats an unreadable marker as closure_unknown, not absent', async () => {
    const marker = fakeMarker();
    Object.assign(marker, { readState: vi.fn(() => ({ status: 'unreadable' })) });
    const { service } = build({}, marker);
    expect(service.init()).toMatchObject({ recovered: true, unreadable: true });
    expect(service.getStatus().state).toBe('closure_unknown');
  });

  it('cancels a start when Stop arrives before readiness', async () => {
    let resolveStart!: (handle: ReturnType<typeof fakeHandle>) => void;
    const startPromise = new Promise<ReturnType<typeof fakeHandle>>((resolve) => { resolveStart = resolve; });
    const { service, handle } = build({ start: vi.fn(() => startPromise) });
    const starting = service.start({ profile, generation: 1, executablePath: '/opt/ngrok', providerToken: 'p' });
    const stopping = service.stop();
    resolveStart(handle);
    const result = await starting;
    const stopped = await stopping;
    expect(result.code).toBe('cancelled');
    expect(stopped.confirmed).toBe(true);
    expect(service.getStatus().state).toBe('idle');
  });

  it('refuses verified recovery when the marker does not prove ownership', async () => {
    const marker = fakeMarker();
    // A running PID (this test process) with a recorded path that does not exist
    // must not be killed or cleared.
    marker.set({ pid: process.pid, executablePath: '/nonexistent/ngrok', creationIdentity: 'unknown' });
    const { service, adapter } = build({}, marker);
    service.init();
    const recovery = await service.recoverOwnedProcess();
    expect(recovery.ok).toBe(false);
    expect(adapter.terminateVerifiedPid).not.toHaveBeenCalled();
  });
});
