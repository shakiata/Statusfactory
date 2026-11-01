// @vitest-environment node
/**
 * Simulated tunnel lifecycle integration (no process, no network).
 *
 * Requirements: REQ-009, REQ-008.
 * Oracle: the real service/permit/state code reaches `active`, reports a
 * reserved `.invalid` URL, stops with confirmed closure, and clears its marker;
 * Stop during Start is cancelled rather than left running.
 * Fixture: simulator adapter + temporary ownership marker.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTunnelService } from '../../electron/tunnel/service.js';
import { createSimulatorAdapter } from '../../electron/tunnel/simulator-adapter.js';
import { createOwnershipMarker } from '../../electron/tunnel/ownership-marker.js';

let workdir: string;
beforeEach(() => { workdir = mkdtempSync(path.join(tmpdir(), 'statusfactory-sim-')); });
afterEach(() => rmSync(workdir, { recursive: true, force: true }));

describe('simulated tunnel lifecycle', () => {
  it('starts, exposes a reserved URL, and stops with confirmed closure', async () => {
    const marker = createOwnershipMarker({ filePath: path.join(workdir, 'marker.json') });
    const service = createTunnelService({ adapter: createSimulatorAdapter(), marker });
    service.init();
    const started = await service.start({
      profile: { id: 'p1', target: '127.0.0.1:8099', executableDigest: null },
      generation: 1,
      executablePath: 'simulated',
      providerToken: null,
    });
    expect(started.ok).toBe(true);
    expect(service.getStatus()).toMatchObject({ state: 'active', publicUrl: 'https://simulated.invalid' });
    expect(marker.read()).not.toBeNull();

    const stopped = await service.stop();
    expect(stopped.confirmed).toBe(true);
    expect(service.getStatus().state).toBe('idle');
    expect(marker.read()).toBeNull();
  });

  it('cancels Stop-during-Start without leaving a simulated tunnel active', async () => {
    const marker = createOwnershipMarker({ filePath: path.join(workdir, 'marker.json') });
    const service = createTunnelService({ adapter: createSimulatorAdapter({ startDelayMs: 100 }), marker });
    const starting = service.start({
      profile: { id: 'p1', target: '127.0.0.1:8099', executableDigest: null },
      generation: 1,
      executablePath: 'simulated',
      providerToken: null,
    });
    const stopping = service.stop();
    const result = await starting;
    const stopped = await stopping;
    expect(result.code).toBe('cancelled');
    expect(stopped.confirmed).toBe(true);
    expect(service.getStatus().state).toBe('idle');
  });
});
