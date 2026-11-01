/**
 * Nonsecret profile migration tests.
 *
 * Requirements: REQ-017.
 * Oracle: a legacy `password` field is removed, valid nonsecret preferences are
 * preserved, malformed data falls back to safe defaults, and the write never
 * contains a token.
 * Fixture: in-memory Storage double; no browser or disk access.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROFILE,
  PROFILE_STORAGE_KEY,
  loadProfile,
  writeProfile,
  type ConnectionProfile,
} from '../connection/profile';

/** Minimal Storage-like double that records writes. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('loadProfile', () => {
  it('removes a legacy token while preserving nonsecret preferences', () => {
    const storage = fakeStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify({
        host: '192.168.1.5',
        port: '8081',
        refreshRate: 10_000,
        password: 'legacy-secret-token',
      }),
    });
    const result = loadProfile(storage);
    expect(result.profile).toMatchObject({ host: '192.168.1.5', port: '8081', refreshRate: 10_000 });
    expect(result.migrated).toBe(true);
    expect(result.notice).toMatch(/token was removed/i);
    const written = storage.data.get(PROFILE_STORAGE_KEY) ?? '';
    expect(written).not.toContain('legacy-secret-token');
    expect(JSON.parse(written)).not.toHaveProperty('password');
  });

  it('resets malformed JSON instead of restoring a secret', () => {
    const storage = fakeStorage({ [PROFILE_STORAGE_KEY]: '{"host":' });
    const result = loadProfile(storage);
    expect(result.profile).toEqual(DEFAULT_PROFILE);
    expect(result.recovered).toBe(true);
    expect(storage.data.get(PROFILE_STORAGE_KEY)).toBe(JSON.stringify(DEFAULT_PROFILE));
  });

  it('does not claim a reset when malformed settings cannot be overwritten', () => {
    const storage = {
      getItem: () => '{bad json',
      setItem: () => { throw new Error('denied'); },
    };
    const result = loadProfile(storage);
    expect(result.notice).toMatch(/could not be reset/i);
    expect(result.notice).toMatch(/old token/i);
  });

  it('reverts an unsupported refresh rate and invalid port to defaults', () => {
    const storage = fakeStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify({ host: 'localhost', port: 'abc', refreshRate: 7 }),
    });
    const result = loadProfile(storage);
    expect(result.profile.port).toBe(DEFAULT_PROFILE.port);
    expect(result.profile.refreshRate).toBe(DEFAULT_PROFILE.refreshRate);
    expect(result.migrated).toBe(false);
  });

  it('does not claim token removal when the sanitized write fails', () => {
    const storage = {
      getItem: (key: string) => (key === PROFILE_STORAGE_KEY
        ? JSON.stringify({ host: 'localhost', port: '8080', password: 'still-there' })
        : null),
      setItem: () => { throw new Error('denied'); },
    };
    const result = loadProfile(storage);
    expect(result.notice).toMatch(/could not be removed/i);
    expect(result.notice).not.toMatch(/token was removed/i);
  });

  it('does not treat a stored empty password as a migration failure', () => {
    const storage = fakeStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify({ host: 'localhost', port: '8080', password: '' }),
    });
    const result = loadProfile(storage);
    expect(result.migrated).toBe(true);
    expect(result.profile).not.toHaveProperty('password');
  });
});

describe('writeProfile', () => {
  it('writes only the schema fields even if the caller passes extras', () => {
    const storage = fakeStorage();
    const profile = { schemaVersion: 2, host: 'localhost', port: '8080', refreshRate: 5000, password: 'x' } as unknown as ConnectionProfile;
    writeProfile(storage, profile, () => {});
    const written = JSON.parse(storage.data.get(PROFILE_STORAGE_KEY) ?? '{}');
    expect(written).toEqual({ schemaVersion: 2, host: 'localhost', port: '8080', refreshRate: 5000 });
  });

  it('reports storage failure without throwing', () => {
    let reported = false;
    writeProfile({ setItem: () => { throw new Error('quota'); } }, DEFAULT_PROFILE, () => { reported = true; });
    expect(reported).toBe(true);
  });
});
