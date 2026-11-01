/**
 * Permit registry tests.
 *
 * Requirement: REQ-008. Oracle: a permit is opaque, single-use, short-lived and
 * bound to sender/profile/origin/generation; reuse and mismatches fail without
 * any side effect.
 * Fixture: deterministic clock and entropy; no process starts.
 */
import { describe, it, expect } from 'vitest';
import { createPermitRegistry } from '../../electron/tunnel/permit-registry.js';

/** Deterministic 16-byte entropy source. */
function fixedEntropy() {
  let counter = 0;
  return (bytes: number) => Buffer.alloc(bytes, counter++);
}

describe('permit registry', () => {
  it('issues a 32-hex-character permit valid for at most 60 seconds', () => {
    const permits = createPermitRegistry({ now: () => 1_000, randomBytes: fixedEntropy() });
    const permit = permits.issue({ senderId: 1, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 });
    expect(permit.id).toMatch(/^[a-f0-9]{32}$/);
    expect(permit.expiresAt - 1_000).toBeLessThanOrEqual(60_000);
  });

  it('consumes a matching permit exactly once', () => {
    const permits = createPermitRegistry({ now: () => 0, randomBytes: fixedEntropy() });
    const { id } = permits.issue({ senderId: 1, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 });
    const binding = { senderId: 1, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 };
    expect(permits.consume(id, binding)).toEqual({ ok: true });
    expect(permits.consume(id, binding)).toEqual({ ok: false, reason: 'unknown-permit' });
  });

  it('rejects expired and mismatched permits', () => {
    let now = 0;
    const permits = createPermitRegistry({ now: () => now, randomBytes: fixedEntropy(), ttlMs: 1_000 });
    const issued = permits.issue({ senderId: 1, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 });
    now = 1_001;
    expect(permits.consume(issued.id, { senderId: 1, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 }))
      .toEqual({ ok: false, reason: 'expired-permit' });

    const other = permits.issue({ senderId: 1, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 });
    expect(permits.consume(other.id, { senderId: 2, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 }))
      .toEqual({ ok: false, reason: 'sender-mismatch' });
  });

  it('invalidates every permit on a profile/renderer change', () => {
    const permits = createPermitRegistry({ now: () => 0, randomBytes: fixedEntropy() });
    const { id } = permits.issue({ senderId: 1, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 });
    permits.invalidateAll();
    expect(permits.consume(id, { senderId: 1, profileId: 'p1', origin: 'http://localhost:8080', generation: 1 }))
      .toEqual({ ok: false, reason: 'unknown-permit' });
  });
});
