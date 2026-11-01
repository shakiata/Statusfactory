/**
 * Ownership-marker and artifact-verification tests.
 *
 * Requirements: REQ-009, REQ-012.
 * Oracle: the marker is written atomically and cleared only on confirmed
 * closure; an unverified or tampered CLI fails closed.
 * Fixture: temporary directory under /tmp/opencode; synthetic 4 KiB file.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createOwnershipMarker, verifyOwnedProcess } from '../../electron/tunnel/ownership-marker.js';
import { verifyArtifact, hasExecutableMagic } from '../../electron/tunnel/cli-artifact.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'statusfactory-'));
});
afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('ownership marker', () => {
  it('writes a secret-free marker, records the pid and clears it', () => {
    const marker = createOwnershipMarker({ filePath: path.join(workdir, 'marker.json') });
    marker.begin({ operationId: 'op1', appSessionId: 'app1', executablePath: '/opt/ngrok', executableDigest: 'a'.repeat(64) });
    expect(JSON.parse(readFileSync(marker.filePath, 'utf8'))).toMatchObject({ operationId: 'op1', pid: null });
    marker.recordSpawn({ pid: 1234, creationIdentity: '99' });
    expect(JSON.parse(readFileSync(marker.filePath, 'utf8'))).toMatchObject({ pid: 1234, creationIdentity: '99' });
    expect(readFileSync(marker.filePath, 'utf8')).not.toMatch(/token|authtoken/i);
    marker.clear();
    expect(existsSync(marker.filePath)).toBe(false);
  });

  it('refuses to verify a pid without a matching recorded identity', () => {
    const marker = createOwnershipMarker({ filePath: path.join(workdir, 'marker.json') });
    marker.begin({ operationId: 'op1', appSessionId: 'app1', executablePath: '/opt/ngrok', executableDigest: null });
    expect(verifyOwnedProcess({ pid: 1 })).toMatchObject({ ok: false });
  });

  it('does not treat an inspection permission error as process absence', () => {
    const denied = new Error('denied');
    (denied as NodeJS.ErrnoException).code = 'EACCES';
    const fakeFs = { readlinkSync: () => { throw denied; } };
    expect(verifyOwnedProcess({ pid: 1234, executablePath: '/opt/ngrok' }, { fsImpl: fakeFs as never }))
      .toEqual({ ok: false, reason: 'inspection-error' });
  });
});

describe('CLI artifact verification', () => {
  it('accepts only a configured digest and executable magic', () => {
    const binDir = path.join(workdir, 'electron', 'tunnel', 'bin', 'linux-x64');
    mkdirSync(binDir, { recursive: true });
    const binary = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(5000, 1)]);
    writeFileSync(path.join(binDir, 'ngrok'), binary);
    const digest = createHash('sha256').update(binary).digest('hex');
    const manifestPath = path.join(workdir, 'electron', 'tunnel', 'ngrok-artifact.json');
    writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      version: '3.0.0-test',
      artifacts: { 'linux-x64': { version: '3.0.0-test', sha256: digest } },
    }));
    const good = verifyArtifact({ isPackaged: false, appPath: workdir, manifestPath, platform: 'linux', arch: 'x64' });
    expect(good).toMatchObject({ ok: true, sha256: digest });

    writeFileSync(path.join(binDir, 'ngrok'), Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(5000, 2)]));
    expect(verifyArtifact({ isPackaged: false, appPath: workdir, manifestPath, platform: 'linux', arch: 'x64' }))
      .toMatchObject({ ok: false, reason: 'artifact-digest-mismatch' });
  });

  it('fails closed when no artifact is configured', () => {
    const manifestPath = path.join(workdir, 'ngrok-artifact.json');
    writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, artifacts: {} }));
    expect(verifyArtifact({ isPackaged: false, appPath: workdir, manifestPath, platform: 'linux', arch: 'x64' }))
      .toMatchObject({ ok: false, reason: 'artifact-not-configured' });
  });

  it('rejects a text file pretending to be a binary', () => {
    expect(hasExecutableMagic(Buffer.from('<html>'), 'linux')).toBe(false);
  });
});
