/**
 * Provider credential loading tests.
 *
 * Requirements: REQ-007, REQ-012. Oracle: provider credentials are loaded only
 * from a user-only file; a group/world-readable file, missing file or malformed
 * token is refused.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadProviderToken, PROVIDER_FILE } from '../../electron/provider-credentials.js';

let userData: string;
beforeEach(() => { userData = mkdtempSync(path.join(tmpdir(), 'statusfactory-provider-')); });
afterEach(() => rmSync(userData, { recursive: true, force: true }));

describe('loadProviderToken', () => {
  it('loads a user-only provider file', () => {
    const file = path.join(userData, PROVIDER_FILE);
    writeFileSync(file, JSON.stringify({ authtoken: 'dummy-provider-token' }), { mode: 0o600 });
    chmodSync(file, 0o600);
    expect(loadProviderToken({ userDataPath: userData })).toEqual({ ok: true, token: 'dummy-provider-token' });
  });

  it('refuses a world-readable provider file', () => {
    const file = path.join(userData, PROVIDER_FILE);
    writeFileSync(file, JSON.stringify({ authtoken: 'dummy-provider-token' }), { mode: 0o644 });
    chmodSync(file, 0o644);
    expect(loadProviderToken({ userDataPath: userData })).toEqual({ ok: false, reason: 'provider-file-permissions' });
  });

  it('refuses a missing or malformed file', () => {
    expect(loadProviderToken({ userDataPath: userData })).toEqual({ ok: false, reason: 'provider-not-configured' });
    writeFileSync(path.join(userData, PROVIDER_FILE), '{not json', { mode: 0o600 });
    expect(loadProviderToken({ userDataPath: userData })).toEqual({ ok: false, reason: 'provider-file-invalid' });
  });
});
