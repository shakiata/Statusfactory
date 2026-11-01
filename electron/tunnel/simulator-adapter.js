/**
 * Simulation-only tunnel adapter.
 *
 * This adapter never spawns a process and never opens a network tunnel. It
 * exists so the real lifecycle, permit, teardown and UI state paths can be
 * exercised on Linux without a provider account or CLI artifact.
 *
 * Safety gates:
 * - only selected by main when `!app.isPackaged` and
 *   `STATUSFACTORY_TUNNEL_SIMULATOR === '1'`;
 * - the reported URL uses the reserved `.invalid` TLD and is not reachable;
 * - it reports `simulated: true` in the authoritative state so the UI cannot
 *   present it as a real public endpoint.
 */

/** Resolves after a short delay. */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates the simulation adapter.
 *
 * @param {object} [options]
 * @param {number} [options.startDelayMs]
 * @param {number} [options.stopDelayMs]
 * @param {string} [options.url] reserved, non-routable URL
 */
function createSimulatorAdapter({
  startDelayMs = 25,
  stopDelayMs = 10,
  url = 'https://simulated.invalid',
} = {}) {
  /**
   * Returns a fake owned handle after a readiness delay.
   * Aborts cleanly when Stop arrives during the delay.
   */
  async function start({ signal } = {}) {
    await delay(startDelayMs);
    if (signal?.aborted) {
      throw Object.assign(new Error('Simulated start cancelled.'), { code: 'cancelled', spawned: false });
    }
    let exitCallback = null;
    return {
      pid: 0,
      url,
      simulated: true,
      async stop() {
        await delay(stopDelayMs);
        return { confirmed: true, code: 0, signal: null };
      },
      onExit(callback) {
        exitCallback = callback;
      },
      /** Test helper: simulate an observed child exit. */
      simulateExit(info = { code: 1, signal: null }) {
        exitCallback?.(info);
      },
    };
  }

  /** No real PID exists; report already-closed. */
  async function terminateVerifiedPid() {
    return { confirmed: true, reason: 'simulated-no-process' };
  }

  return { start, terminateVerifiedPid, simulated: true };
}

module.exports = { createSimulatorAdapter };
