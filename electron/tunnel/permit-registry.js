/**
 * Single-use, short-lived sharing permits.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 10
 * (REQ-008). A permit is a 128-bit opaque ID bound to the sender, selected
 * profile, origin and generation. It is consumed before any subprocess starts.
 */

const crypto = require('crypto');
const { PERMIT_TTL_MS } = require('./constants');

/**
 * Creates an in-memory permit registry.
 *
 * @param {object} [options]
 * @param {() => number} [options.now] injectable clock (tests)
 * @param {(bytes: number) => Buffer} [options.randomBytes] injectable entropy
 * @param {number} [options.ttlMs] permit lifetime, capped at 60 s
 */
/** Monotonic milliseconds for permit expiry (immune to wall-clock changes). */
function monotonicNow() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function createPermitRegistry({ now = monotonicNow, randomBytes = crypto.randomBytes, ttlMs = PERMIT_TTL_MS } = {}) {
  const permits = new Map();
  const effectiveTtl = Math.min(Math.max(1, ttlMs), PERMIT_TTL_MS);

  /** Removes expired permits so the map cannot grow without bound. */
  function prune() {
    const current = now();
    for (const [id, permit] of permits) {
      if (permit.expiresAt <= current) permits.delete(id);
    }
  }

  /**
   * Issues a permit bound to one sender/profile/origin/generation.
   * @returns {{id: string, expiresAt: number}}
   */
  function issue(binding) {
    prune();
    const id = randomBytes(16).toString('hex');
    permits.set(id, {
      id,
      senderId: binding.senderId,
      profileId: binding.profileId,
      origin: binding.origin,
      generation: binding.generation,
      expiresAt: now() + effectiveTtl,
    });
    return { id, expiresAt: now() + effectiveTtl };
  }

  /**
   * Consumes a permit. A permit is deleted whether or not the binding matches,
   * so a stolen ID cannot be retried against a different target.
   *
   * @returns {{ok: true} | {ok: false, reason: string}}
   */
  function consume(id, binding) {
    const permit = permits.get(id);
    if (!permit) return { ok: false, reason: 'unknown-permit' };
    permits.delete(id);
    if (permit.expiresAt <= now()) return { ok: false, reason: 'expired-permit' };
    if (permit.senderId !== binding.senderId) return { ok: false, reason: 'sender-mismatch' };
    if (permit.profileId !== binding.profileId) return { ok: false, reason: 'profile-mismatch' };
    if (permit.origin !== binding.origin) return { ok: false, reason: 'origin-mismatch' };
    if (permit.generation !== binding.generation) return { ok: false, reason: 'generation-mismatch' };
    return { ok: true };
  }

  /** Invalidates every outstanding permit (origin/token change, reload, loss). */
  function invalidateAll() {
    permits.clear();
  }

  /** Number of live permits (diagnostics/tests only; never exposed to UI). */
  function size() {
    prune();
    return permits.size;
  }

  return { issue, consume, invalidateAll, size };
}

module.exports = { createPermitRegistry };
