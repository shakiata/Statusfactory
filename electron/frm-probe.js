/**
 * Independent FRM authentication probe used before sharing.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md sections 7 and 10
 * (REQ-008). The renderer's "connected" flag is never authoritative: main
 * performs a credential-free denial probe and an authenticated nonmutating
 * success probe itself, then discards the token.
 *
 * The probe covers representative protected endpoints. It is not a proof about
 * every endpoint reachable through the tunnel; that residual is documented and
 * remains an ACT-002 input.
 */

const { REQUEST_DEADLINE_MS } = require('./tunnel/constants');

/** Maximum bytes drained from each probe response. */
const MAX_PROBE_BYTES = 1024 * 1024;
/** Representative nonmutating endpoints expected to require authentication. */
const PROBE_ENDPOINTS = Object.freeze(['getPower', 'getFactory', 'getWorldInv', 'getPlayer']);

/**
 * Drains a response body up to a hard byte limit, cancelling the stream when the
 * limit is crossed. Prevents an oversized probe response from being buffered.
 *
 * @returns {Promise<{ok: true} | {ok: false, code: 'probe-too-large'}>}
 */
async function drainBounded(response, maxBytes = MAX_PROBE_BYTES) {
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return buffer.byteLength <= maxBytes ? { ok: true } : { ok: false, code: 'probe-too-large' };
  }
  const reader = response.body.getReader();
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return { ok: true };
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, code: 'probe-too-large' };
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

/** Returns an abort signal with a deadline, with a portable fallback. */
function deadlineSignal() {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(REQUEST_DEADLINE_MS);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), REQUEST_DEADLINE_MS).unref?.();
  return controller.signal;
}

/** Executes one request and maps transport/size failures to a probe code. */
async function probeRequest(fetchImpl, url, headers) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers,
      redirect: 'error',
      cache: 'no-store',
      signal: deadlineSignal(),
    });
  } catch {
    return { ok: false, code: 'probe-transport-failed' };
  }
  const drained = await drainBounded(response).catch(() => ({ ok: false, code: 'probe-transport-failed' }));
  if (!drained.ok) return drained;
  return { ok: true, response };
}

/**
 * Runs the probes against one fixed origin.
 *
 * @param {object} input
 * @param {string} input.origin canonical origin
 * @param {string} input.token session FRM token
 * @param {Function} [input.fetchImpl] injectable fetch (tests)
 * @param {string[]} [input.endpoints] injectable endpoint list (tests)
 * @returns {Promise<{ok: true} | {ok: false, code: string}>}
 */
async function probeSharing({ origin, token, fetchImpl = fetch, endpoints = PROBE_ENDPOINTS }) {
  const anonymous = await Promise.all(
    endpoints.map((endpoint) =>
      probeRequest(fetchImpl, `${origin}/${endpoint}`, { Accept: 'application/json' }),
    ),
  );
  for (const result of anonymous) {
    if (!result.ok) return { ok: false, code: result.code };
    // Every probed protected endpoint must reject an unauthenticated request.
    if (result.response.status !== 401 && result.response.status !== 403) {
      return { ok: false, code: 'auth-not-enforced' };
    }
  }

  const authenticated = await Promise.all(
    endpoints.map((endpoint) =>
      probeRequest(fetchImpl, `${origin}/${endpoint}`, {
        Accept: 'application/json',
        'X-FRM-Authorization': token,
      }),
    ),
  );
  for (const result of authenticated) {
    if (!result.ok) return { ok: false, code: result.code };
    if (result.response.status === 401 || result.response.status === 403) {
      return { ok: false, code: 'auth-rejected' };
    }
    if (!result.response.ok) return { ok: false, code: 'probe-failed' };
  }
  return { ok: true };
}

module.exports = { probeSharing, PROBE_ENDPOINTS };
