/**
 * Pure tunnel lifecycle state transitions.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 7
 * (REQ-009). The service in `service.js` owns side effects; this module owns
 * only the allowed transitions and their invariants, so they can be tested
 * without processes or Electron.
 */

const { STATES } = require('./constants');

/** Creates the initial idle state. */
function createState() {
  return {
    state: STATES.IDLE,
    generation: 0,
    operationId: null,
    profileId: null,
    publicUrl: null,
    error: null,
    closureUnknown: false,
  };
}

/** True when a new owned child must not be created. */
function isBusy(state) {
  return state.state === STATES.STARTING || state.state === STATES.ACTIVE || state.state === STATES.STOPPING;
}

/** True when sharing may be started. */
function canStart(state) {
  return state.state === STATES.IDLE || state.state === STATES.FAILED_CLOSED;
}

/**
 * Begins an operation. Returns `{ok:false}` for a busy state without changing
 * the state, so no second child is ever created.
 */
function beginStart(state, { operationId, profileId, generation }) {
  if (!canStart(state)) return { ok: false, state, reason: 'busy' };
  return {
    ok: true,
    state: {
      ...state,
      state: STATES.STARTING,
      generation: state.generation + 1,
      operationId,
      profileId,
      publicUrl: null,
      error: null,
      closureUnknown: false,
      startedGeneration: generation,
    },
  };
}

/**
 * Accepts a readiness URL only from the current generation and only when it is
 * an HTTPS ngrok URL. A late URL after cancellation is ignored.
 */
function markActive(state, { generation, url }) {
  if (state.state !== STATES.STARTING) return { ok: false, state, reason: 'not-starting' };
  if (generation !== state.generation) return { ok: false, state, reason: 'stale-generation' };
  if (typeof url !== 'string' || !/^https:\/\/[^\s]+$/i.test(url)) {
    return { ok: false, state, reason: 'invalid-url' };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, state, reason: 'invalid-url' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, state, reason: 'invalid-url' };
  return {
    ok: true,
    state: { ...state, state: STATES.ACTIVE, publicUrl: parsed.toString().replace(/\/$/, ''), error: null },
  };
}

/**
 * Enters `stopping` and invalidates the public URL immediately.
 * A late readiness URL cannot reactivate the tunnel because the generation is
 * no longer `starting`.
 */
function beginStop(state) {
  if (state.state === STATES.IDLE || state.state === STATES.FAILED_CLOSED) {
    return { ok: true, state, already: true };
  }
  if (state.state === STATES.STOPPING) return { ok: true, state, already: true };
  return {
    ok: true,
    state: {
      ...state,
      state: STATES.STOPPING,
      generation: state.generation + 1,
      publicUrl: null,
    },
  };
}

/** Confirms closure: only this transition may clear the ownership marker. */
function confirmClosed(state, { error = null } = {}) {
  return {
    ...state,
    state: error ? STATES.FAILED_CLOSED : STATES.IDLE,
    publicUrl: null,
    error,
    closureUnknown: false,
    operationId: null,
  };
}

/** Records that closure could not be proven. Sharing stays blocked. */
function confirmUnknown(state, { error }) {
  return {
    ...state,
    state: STATES.CLOSURE_UNKNOWN,
    publicUrl: null,
    error: error || 'Tunnel closure could not be confirmed.',
    closureUnknown: true,
  };
}

/** Records an observed child exit after readiness. */
function childExited(state, { code = null, signal = null } = {}) {
  const detail = `Tunnel process exited (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`;
  if (state.state === STATES.STOPPING) return confirmClosed(state, { error: null });
  return {
    ...state,
    state: STATES.FAILED_CLOSED,
    publicUrl: null,
    error: detail,
    closureUnknown: false,
    operationId: null,
  };
}

module.exports = {
  createState,
  isBusy,
  canStart,
  beginStart,
  markActive,
  beginStop,
  confirmClosed,
  confirmUnknown,
  childExited,
};
