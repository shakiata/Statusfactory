/**
 * Share-authorization sequencing tests.
 *
 * Requirement: REQ-008. Oracle: a successful probe issues a permit only when the
 * selected profile is unchanged; a profile change during the probe yields no
 * permit and no tunnel side effect.
 */
import { describe, it, expect, vi } from 'vitest';
import { authorizeShare } from '../../electron/share-authorization.js';

describe('authorizeShare', () => {
  const snapshot = { id: 'p1', origin: 'http://192.168.1.5:8080', generation: 1 };

  it('issues a permit bound to the snapshot when the profile is unchanged', async () => {
    const issuePermit = vi.fn(() => ({ id: 'a'.repeat(32), expiresAt: 123 }));
    const result = await authorizeShare({
      snapshot,
      readCurrentProfile: () => ({ ...snapshot }),
      probe: async () => ({ ok: true }),
      issuePermit,
      senderId: 7,
    });
    expect(result).toMatchObject({ ok: true, permitId: 'a'.repeat(32) });
    expect(issuePermit).toHaveBeenCalledWith({ senderId: 7, profileId: 'p1', origin: snapshot.origin, generation: 1 });
  });

  it('issues no permit when the profile changes during the probe', async () => {
    const issuePermit = vi.fn();
    const result = await authorizeShare({
      snapshot,
      readCurrentProfile: () => ({ id: 'p2', origin: 'http://10.0.0.9:8080', generation: 2 }),
      probe: async () => ({ ok: true }),
      issuePermit,
      senderId: 7,
    });
    expect(result).toEqual({ ok: false, code: 'profile-conflict' });
    expect(issuePermit).not.toHaveBeenCalled();
  });

  it('issues no permit when the probe fails or is ambiguous', async () => {
    const issuePermit = vi.fn();
    const result = await authorizeShare({
      snapshot,
      readCurrentProfile: () => ({ ...snapshot }),
      probe: async () => ({ ok: false, code: 'auth-not-enforced' }),
      issuePermit,
      senderId: 7,
    });
    expect(result).toEqual({ ok: false, code: 'auth-not-enforced' });
    expect(issuePermit).not.toHaveBeenCalled();
  });
});
