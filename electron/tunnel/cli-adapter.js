/**
 * Direct ngrok CLI adapter.
 *
 * One owned child, fixed argument array, no shell interpolation, no PATH
 * fallback, bounded output and verified teardown.
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 7
 * (REQ-009, REQ-012).
 */

const { spawn } = require('child_process');
const path = require('path');
const {
  MAX_LOG_TAIL_BYTES,
  READINESS_MS,
  GRACE_MS,
  CONFIRM_MS,
} = require('./constants');

/** Resolves after `ms`. */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when a PID exists (POSIX signal 0 probe). */
function pidExists(pid, killImpl) {
  try {
    killImpl(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but cannot be signalled; only ESRCH proves
    // absence. Any other error is treated conservatively as "may exist".
    return !(error && error.code === 'ESRCH');
  }
}

/**
 * Creates the CLI adapter.
 *
 * @param {object} [options]
 * @param {Function} [options.spawnImpl] injectable spawn (tests)
 * @param {Function} [options.killImpl] injectable kill (tests)
 * @param {string} [options.platform] injectable platform (tests)
 * @param {object} [options.env] restricted environment supplied by the service
 */
function createCliAdapter({
  spawnImpl = spawn,
  killImpl = process.kill,
  platform = process.platform,
  readinessMs = READINESS_MS,
  graceMs = GRACE_MS,
  confirmMs = CONFIRM_MS,
  logger = console,
} = {}) {
  /**
   * Starts one CLI process and resolves with a handle once a verified HTTPS URL
   * appears in its structured log.
   *
   * @param {object} input
   * @param {string} input.executablePath absolute verified path
   * @param {string} input.target `host:port` upstream
   * @param {string} [input.providerToken] provider credential (env only)
   * @param {object} [input.env] base restricted environment
   */
  async function start({ executablePath, target, providerToken, env = {}, signal }) {
    if (!path.isAbsolute(executablePath)) {
      throw Object.assign(new Error('CLI path must be absolute.'), { code: 'invalid-path', spawned: false });
    }
    if (signal?.aborted) {
      throw Object.assign(new Error('CLI start was cancelled before spawn.'), { code: 'cancelled', spawned: false });
    }
    const args = [
      'http',
      target,
      '--log=stdout',
      '--log-format=json',
      '--request-header-add',
      'ngrok-skip-browser-warning:1',
    ];
    const childEnv = { ...env };
    if (providerToken) childEnv.NGROK_AUTHTOKEN = providerToken;
    // PATH is deliberately empty: the executable is a fixed absolute path and
    // the CLI must not locate helper binaries through the user's PATH.
    childEnv.PATH = '';

    let child;
    try {
      child = spawnImpl(executablePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
        shell: false,
        windowsHide: true,
        detached: platform !== 'win32',
      });
    } catch (error) {
      // Synchronous spawn failure means no process was created; the service may
      // safely clear the pre-spawn marker.
      throw Object.assign(error, { code: 'spawn-error', spawned: false });
    }

    let exited = false;
    let exitInfo = { code: null, signal: null };
    let logTail = '';
    let resolveUrl;
    let rejectUrl;
    const urlPromise = new Promise((resolve, reject) => {
      resolveUrl = resolve;
      rejectUrl = reject;
    });
    const exitPromise = new Promise((resolve) => {
      const finish = (code, signal) => {
        if (exited) return;
        exited = true;
        exitInfo = { code, signal };
        resolve(exitInfo);
      };
      child.once('exit', finish);
      child.once('close', finish);
    });

    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    /** Appends a bounded tail and resolves the first structured HTTPS URL. */
    const consume = (chunk) => {
      logTail = (logTail + chunk.toString('utf8')).slice(-MAX_LOG_TAIL_BYTES);
      for (const line of logTail.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          const entry = JSON.parse(trimmed);
          if (typeof entry.url === 'string' && /^https:\/\/\S+$/i.test(entry.url)) {
            settle(resolveUrl, entry.url);
          }
        } catch {
          // Partial/non-JSON lines are ignored; the tail remains bounded.
        }
      }
    };
    child.stdout?.on('data', consume);
    child.stderr?.on('data', consume);
    child.once('error', (error) => {
      settle(rejectUrl, Object.assign(error, { code: error.code || 'spawn-error' }));
    });
    child.once('exit', (code, signal) => {
      settle(rejectUrl, Object.assign(new Error('CLI exited before reporting readiness.'), {
        code: 'exited-before-ready',
        exitCode: code,
        signal,
      }));
    });

    const timer = setTimeout(() => {
      settle(rejectUrl, Object.assign(new Error('CLI readiness timed out.'), { code: 'readiness-timeout' }));
    }, readinessMs);

    // Stop-during-Start aborts this controller so teardown begins without
    // waiting for the full readiness deadline.
    const onAbort = () => {
      settle(rejectUrl, Object.assign(new Error('CLI start was cancelled.'), { code: 'cancelled' }));
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    let url;
    try {
      url = await urlPromise;
    } catch (error) {
      // Readiness failed after spawn: terminate this owned child and report
      // whether closure was actually observed. The function declaration below
      // is hoisted, so it is available here.
      const closed = await stop();
      error.spawned = true;
      error.confirmedClosure = closed.confirmed;
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    /**
     * Terminates this owned child tree and reports whether closure was
     * observed. Never targets any other process.
     */
    async function stop() {
      if (exited) return { confirmed: true, code: exitInfo.code, signal: exitInfo.signal };

      const signalTree = (signal) => {
        if (platform === 'win32') {
          const argsForce = signal === 'force' ? ['/f'] : [];
          try {
            const killer = spawnImpl('taskkill', ['/pid', String(child.pid), '/t', ...argsForce], {
              stdio: 'ignore',
              windowsHide: true,
            });
            killer.once('error', () => {});
          } catch {
            /* reported through confirmation below */
          }
          return;
        }
        // Negative PID targets the process group created with detached: true.
        try {
          killImpl(-child.pid, signal === 'force' ? 'SIGKILL' : 'SIGTERM');
        } catch {
          try {
            child.kill(signal === 'force' ? 'SIGKILL' : 'SIGTERM');
          } catch {
            /* already gone */
          }
        }
      };

      signalTree('graceful');
      const graceful = await Promise.race([exitPromise, delay(graceMs).then(() => null)]);
      if (graceful) return { confirmed: true, code: exitInfo.code, signal: exitInfo.signal };

      signalTree('force');
      const forced = await Promise.race([exitPromise, delay(confirmMs).then(() => null)]);
      if (forced) return { confirmed: true, code: exitInfo.code, signal: exitInfo.signal };

      logger.error('[tunnel] closure could not be confirmed for owned child', { pid: child.pid });
      return { confirmed: false, code: exitInfo.code, signal: exitInfo.signal };
    }

    return {
      pid: child.pid,
      url,
      stop,
      onExit(callback) {
        exitPromise.then((info) => callback(info));
      },
      get logTail() {
        return logTail;
      },
    };
  }

  /**
   * Terminates a surviving PID only after the caller proved ownership.
   * Polls for disappearance; returns confirmation.
   */
  async function terminateVerifiedPid(pid) {
    if (!Number.isInteger(pid) || pid <= 1) return { confirmed: false, reason: 'invalid-pid' };
    if (!pidExists(pid, killImpl)) return { confirmed: true, reason: 'already-exited' };
    try {
      if (platform === 'win32') {
        spawnImpl('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
      } else {
        try {
          killImpl(-pid, 'SIGKILL');
        } catch {
          killImpl(pid, 'SIGKILL');
        }
      }
    } catch {
      return { confirmed: false, reason: 'kill-failed' };
    }
    const deadline = Date.now() + graceMs + confirmMs;
    while (Date.now() < deadline) {
      if (!pidExists(pid, killImpl)) return { confirmed: true, reason: 'terminated' };
      await delay(100);
    }
    return { confirmed: false, reason: 'still-running' };
  }

  return { start, terminateVerifiedPid };
}

module.exports = { createCliAdapter, pidExists };
