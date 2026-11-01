/**
 * Serialized tunnel service.
 *
 * Owns exactly one automatic-share operation, the nonsecret ownership marker
 * and the visible state. Side effects are delegated to the adapter; transitions
 * are delegated to `state-machine.js`.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md sections 7, 10, 11
 * (REQ-008, REQ-009).
 */

const crypto = require('crypto');
const {
  createState,
  canStart,
  beginStart,
  markActive,
  beginStop,
  confirmClosed,
  confirmUnknown,
  childExited,
} = require('./state-machine');
const { STATES } = require('./constants');
const {
  linuxCreationIdentity,
  verifyOwnedProcess,
  recoveryHint,
} = require('./ownership-marker');

/** Maps an error to a safe category/message (never a token or raw log). */
function safeError(error) {
  const code = error && error.code ? String(error.code) : 'tunnel-error';
  const category =
    code === 'readiness-timeout'
      ? 'startup-timeout'
      : code === 'artifact-missing' || code === 'artifact-digest-mismatch'
        ? 'artifact-unverified'
        : 'startup-failed';
  return { code: category, message: error && error.message ? String(error.message).slice(0, 300) : 'Tunnel start failed.' };
}

/**
 * Creates the service.
 *
 * @param {object} options
 * @param {object} options.adapter CLI adapter (`start`, `terminateVerifiedPid`)
 * @param {object} options.marker ownership marker store
 * @param {(state: object) => void} [options.onState] state change callback
 * @param {Console} [options.logger]
 * @param {string} [options.appSessionId] nonsecret app session identity
 */
function createTunnelService({ adapter, marker, onState = () => {}, logger = console, appSessionId = crypto.randomUUID() }) {
  let state = createState();
  let handle = null;
  let startPromise = null;
  let stopPromise = null;
  let cancelRequested = false;
  let startAbort = null;

  /** Public, secret-free view of the state. */
  function publicState() {
    return {
      state: state.state,
      generation: state.generation,
      profileId: state.profileId,
      publicUrl: state.state === STATES.ACTIVE ? state.publicUrl : null,
      error: state.error,
      closureUnknown: state.closureUnknown,
    };
  }

  /** Emits the authoritative state to the renderer. */
  function emit() {
    onState(publicState());
  }

  /**
   * Inspects the ownership marker at startup. Any marker forces
   * `closure_unknown` until verified recovery clears it.
   */
  function init() {
    const read = marker.readState ? marker.readState() : { status: marker.read() ? 'present' : 'absent', marker: marker.read() };
    if (read.status === 'absent') return { recovered: false };
    if (read.status === 'unreadable') {
      state = confirmUnknown(state, {
        error: 'A tunnel ownership marker exists but could not be read. Sharing is blocked until it is resolved manually.',
      });
      emit();
      return { recovered: true, unreadable: true };
    }
    state = confirmUnknown(state, { error: recoveryHint(read.marker) });
    emit();
    return { recovered: true, marker: read.marker };
  }

  /**
   * Attempts verified recovery of a surviving process. A kill happens only
   * after executable path, creation identity and current PID all match.
   */
  async function recoverOwnedProcess() {
    const read = marker.readState ? marker.readState() : { status: marker.read() ? 'present' : 'absent', marker: marker.read() };
    if (read.status === 'unreadable') {
      return { ok: false, reason: 'marker-unreadable', hint: 'Clear the tunnel ownership marker manually after verifying no tunnel is running.' };
    }
    if (read.status === 'absent') {
      if (state.state === STATES.CLOSURE_UNKNOWN) {
        state = confirmClosed(state);
        emit();
      }
      return { ok: true, recovered: false };
    }
    const existing = read.marker;
    const verified = verifyOwnedProcess(existing);
    if (!verified.ok) {
      // A recorded process that is no longer running proves no surviving child;
      // clear the stale marker without killing anything.
      if (verified.reason === 'process-not-running') {
        marker.clear();
        state = confirmClosed(state);
        emit();
        return { ok: true, recovered: true };
      }
      state = confirmUnknown(state, { error: recoveryHint(existing) });
      emit();
      return { ok: false, reason: verified.reason, hint: recoveryHint(existing) };
    }
    const result = await adapter.terminateVerifiedPid(verified.pid);
    if (result.confirmed) {
      marker.clear();
      state = confirmClosed(state);
      emit();
      return { ok: true, recovered: true };
    }
    state = confirmUnknown(state, { error: recoveryHint(existing) });
    emit();
    return { ok: false, reason: result.reason, hint: recoveryHint(existing) };
  }

  /**
   * Starts one tunnel for an already-authorized profile.
   * The caller must have consumed a single-use permit first.
   */
  async function start({ profile, generation, executablePath, providerToken, env }) {
    if (startPromise) return { ok: false, code: 'already-starting', state: publicState() };
    if (state.state === STATES.ACTIVE) return { ok: false, code: 'already-active', state: publicState() };
    if (state.state === STATES.STOPPING) return { ok: false, code: 'busy', state: publicState() };
    if (state.state === STATES.CLOSURE_UNKNOWN) {
      return { ok: false, code: 'closure-unknown', state: publicState() };
    }
    if (!canStart(state)) return { ok: false, code: 'busy', state: publicState() };

    const operationId = crypto.randomUUID();
    const begun = beginStart(state, { operationId, profileId: profile.id, generation });
    if (!begun.ok) return { ok: false, code: 'busy', state: publicState() };
    state = begun.state;
    cancelRequested = false;
    startAbort = new AbortController();
    emit();

    startPromise = (async () => {
      try {
        marker.begin({
          operationId,
          appSessionId,
          executablePath,
          executableDigest: profile.executableDigest || null,
        });
        const started = await adapter.start({
          executablePath,
          target: profile.target,
          providerToken,
          env,
          signal: startAbort?.signal,
        });

        if (cancelRequested) {
          const closed = await started.stop();
          if (closed.confirmed) {
            marker.clear();
            state = confirmClosed(state);
          } else {
            state = confirmUnknown(state, { error: 'Stop was requested during start and closure is unconfirmed.' });
          }
          emit();
          return { ok: false, code: 'cancelled', state: publicState() };
        }

        handle = started;
        marker.recordSpawn({
          pid: started.pid,
          creationIdentity: linuxCreationIdentity(started.pid),
        });
        started.onExit((info) => {
          if (handle !== started) return;
          handle = null;
          marker.clear();
          state = childExited(state, info);
          emit();
        });

        const active = markActive(state, { generation: state.generation, url: started.url });
        if (!active.ok) {
          const closed = await started.stop();
          handle = null;
          if (closed.confirmed) {
            marker.clear();
            state = confirmClosed(state, { error: 'The tunnel reported an invalid URL and was stopped.' });
          } else {
            state = confirmUnknown(state, { error: 'The tunnel reported an invalid URL and closure is unconfirmed.' });
          }
          emit();
          return { ok: false, code: 'invalid-readiness', state: publicState() };
        }
        state = active.state;
        emit();
        return { ok: true, state: publicState(), url: state.publicUrl };
      } catch (error) {
        const safe = safeError(error);
        // If the adapter produced a handle, always attempt bounded teardown.
        let confirmed = false;
        if (handle) {
          const closed = await handle.stop();
          confirmed = closed.confirmed;
          handle = null;
        } else if (error && error.spawned === false) {
          // The adapter proved no process was created.
          confirmed = true;
        } else if (error && error.confirmedClosure === true) {
          // The adapter terminated the child it created and observed exit.
          confirmed = true;
        } else {
          // Spawn outcome is unknown; only a provably absent marker may be
          // treated as closed. An unreadable marker stays closure_unknown.
          const read = marker.readState ? marker.readState() : { status: marker.read() ? 'present' : 'absent' };
          confirmed = read.status === 'absent';
        }
        if (confirmed) {
          marker.clear();
          state = confirmClosed(state, { error: safe.message });
        } else {
          state = confirmUnknown(state, { error: safe.message });
        }
        emit();
        return { ok: false, code: safe.code, state: publicState() };
      } finally {
        startPromise = null;
        startAbort = null;
      }
    })();

    return startPromise;
  }

  /**
   * Stops the owned tunnel and confirms closure. Idempotent.
   * A late readiness event cannot reactivate: `beginStop` bumps the generation.
   */
  async function stop() {
    if (stopPromise) return stopPromise;
    if (state.state === STATES.IDLE || state.state === STATES.FAILED_CLOSED) {
      return { ok: true, confirmed: true, state: publicState() };
    }
    const begun = beginStop(state);
    state = begun.state;
    cancelRequested = true;
    emit();

    stopPromise = (async () => {
      if (startPromise) {
        startAbort?.abort();
        await startPromise.catch(() => {});
      }
      if (!handle) {
        const read = marker.readState ? marker.readState() : { status: marker.read() ? 'present' : 'absent' };
        if (read.status === 'absent') {
          state = confirmClosed(state);
          emit();
          return { ok: true, confirmed: true, state: publicState() };
        }
        state = confirmUnknown(state, { error: 'A tunnel start was interrupted; closure is unconfirmed.' });
        emit();
        return { ok: false, confirmed: false, state: publicState() };
      }
      const current = handle;
      handle = null;
      const result = await current.stop();
      if (result.confirmed) {
        marker.clear();
        state = confirmClosed(state);
        emit();
        return { ok: true, confirmed: true, state: publicState() };
      }
      state = confirmUnknown(state, { error: 'Tunnel termination could not be confirmed.' });
      emit();
      return { ok: false, confirmed: false, state: publicState() };
    })().finally(() => {
      stopPromise = null;
    });

    return stopPromise;
  }

  /** Bounded shutdown used on window-all-closed and app quit. */
  async function shutdown() {
    const result = await Promise.race([
      stop(),
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, confirmed: false, timeout: true }), 12_000)),
    ]);
    if (!result.confirmed && state.state !== STATES.CLOSURE_UNKNOWN) {
      state = confirmUnknown(state, { error: 'Application shutdown could not confirm tunnel closure.' });
      emit();
    }
    return result;
  }

  return { init, recoverOwnedProcess, start, stop, shutdown, getStatus: publicState };
}

module.exports = { createTunnelService, safeError };
