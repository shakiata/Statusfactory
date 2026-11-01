/**
 * Nonsecret tunnel ownership marker.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 11
 * (REQ-009). The marker proves that a tunnel operation may have started even
 * when graceful teardown never ran. It contains no token and no raw log.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Creates a marker store at a fixed path.
 *
 * @param {object} options
 * @param {string} options.filePath absolute marker path under Electron userData
 * @param {object} [options.fsImpl] injectable fs for tests
 */
function createOwnershipMarker({ filePath, fsImpl = fs }) {
  /**
   * Atomically writes the pre-spawn marker.
   * A crash between this write and PID recording leaves an unresolved marker,
   * which is exactly the safe outcome.
   */
  function begin({ operationId, appSessionId, executablePath, executableDigest }) {
    const marker = {
      schemaVersion: 1,
      operationId,
      appSessionId,
      executablePath,
      executableDigest,
      pid: null,
      creationIdentity: null,
      createdAt: new Date().toISOString(),
    };
    writeAtomic(marker);
    return marker;
  }

  /** Records the spawned PID and platform creation identity. */
  function recordSpawn({ pid, creationIdentity = null }) {
    const marker = read();
    if (!marker) return null;
    const next = { ...marker, pid, creationIdentity, spawnedAt: new Date().toISOString() };
    writeAtomic(next);
    return next;
  }

  /** Reads the marker, returning null when absent or unreadable. */
  function read() {
    try {
      const text = fsImpl.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * Distinguishes an absent marker from one that exists but cannot be read.
   * An unreadable marker must force closure_unknown, never idle.
   */
  function readState() {
    try {
      const text = fsImpl.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return { status: 'present', marker: parsed };
      return { status: 'unreadable' };
    } catch (error) {
      if (error && error.code === 'ENOENT') return { status: 'absent' };
      return { status: 'unreadable' };
    }
  }

  /** Removes the marker only after confirmed closure. */
  function clear() {
    try {
      fsImpl.unlinkSync(filePath);
    } catch {
      // Already absent is fine; other failures leave the marker as evidence.
    }
  }

  /** Internal atomic write (temp file in the same directory + rename). */
  function writeAtomic(marker) {
    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fsImpl.writeFileSync(temporary, JSON.stringify(marker), { mode: 0o600 });
    fsImpl.renameSync(temporary, filePath);
  }

  return { begin, recordSpawn, read, readState, clear, filePath };
}

/**
 * Reads a Linux process creation identity (field 22 of /proc/<pid>/stat).
 * Returns null when the platform or process cannot be inspected.
 */
function linuxCreationIdentity(pid, fsImpl = fs) {
  if (process.platform !== 'linux') return null;
  try {
    const stat = fsImpl.readFileSync(`/proc/${pid}/stat`, 'utf8');
    // The comm field may contain spaces/parentheses; split after the last ')'.
    const tail = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    // Field 22 overall is index 19 after the closing ')' (fields 3..).
    return tail[19] ?? null;
  } catch {
    return null;
  }
}

/**
 * Verifies that a recorded PID still belongs to the recorded executable and
 * creation identity. PID reuse alone must never authorize a kill.
 *
 * @returns {{ok: true, pid: number} | {ok: false, reason: string}}
 */
function verifyOwnedProcess(marker, { fsImpl = fs, platform = process.platform } = {}) {
  if (!marker || !Number.isInteger(marker.pid) || marker.pid <= 1) {
    return { ok: false, reason: 'no-recorded-pid' };
  }
  if (platform !== 'linux') {
    return { ok: false, reason: 'platform-identity-unavailable' };
  }
  let executable;
  try {
    executable = fsImpl.readlinkSync(`/proc/${marker.pid}/exe`);
  } catch (error) {
    // Only ENOENT/ESRCH prove the process is gone. EACCES/EPERM and unknown
    // errors leave ownership unproven and must not clear the marker.
    if (error && (error.code === 'ENOENT' || error.code === 'ESRCH')) {
      return { ok: false, reason: 'process-not-running' };
    }
    return { ok: false, reason: 'inspection-error' };
  }
  let expected;
  try {
    expected = fsImpl.realpathSync(marker.executablePath);
  } catch {
    // The recorded path is gone; the running process cannot be proven ours.
    return { ok: false, reason: 'recorded-executable-missing' };
  }
  if (path.resolve(executable) !== path.resolve(expected)) {
    return { ok: false, reason: 'executable-mismatch' };
  }
  const currentIdentity = linuxCreationIdentity(marker.pid, fsImpl);
  if (!marker.creationIdentity || currentIdentity !== marker.creationIdentity) {
    return { ok: false, reason: 'creation-identity-mismatch' };
  }
  return { ok: true, pid: marker.pid };
}

/** Returns a human-readable recovery hint without exposing secrets. */
function recoveryHint(marker) {
  const pid = marker && marker.pid ? marker.pid : 'unknown';
  return `Sharing is blocked because a previous tunnel may still be running (process ${pid}). Verify and close it in your ngrok account or OS process list, then restart Statusfactory. The app will not kill an unverified process.`;
}

module.exports = {
  createOwnershipMarker,
  verifyOwnedProcess,
  linuxCreationIdentity,
  recoveryHint,
  markerFileName: 'tunnel-ownership.json',
  markerDirectory: () => path.join(os.homedir(), '.statusfactory'),
};
