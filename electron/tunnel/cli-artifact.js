/**
 * Pinned native CLI artifact verification.
 *
 * Contract: docs/security/06_SECURITY_AND_OPERATIONS.md section 2 and
 * docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 7 (REQ-012).
 *
 * The manifest is intentionally empty until the repository owner supplies a
 * trusted vendor artifact and digest. Missing or mismatched artifacts fail
 * closed; there is no PATH fallback and no mutable "stable" download.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Supported platform/architecture keys. */
function artifactKey(platform = process.platform, arch = process.arch) {
  const osName = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux';
  const archName = arch === 'arm64' ? 'arm64' : 'x64';
  return `${osName}-${archName}`;
}

/** Resolves the fixed executable path for a packaged or development build. */
function resolveArtifactPath({ isPackaged, resourcesPath, appPath, platform = process.platform, arch = process.arch }) {
  const key = artifactKey(platform, arch);
  const fileName = platform === 'win32' ? 'ngrok.exe' : 'ngrok';
  const base = isPackaged
    ? path.join(resourcesPath, 'tunnel')
    : path.join(appPath, 'electron', 'tunnel', 'bin');
  return { key, fileName, filePath: path.join(base, key, fileName) };
}

/** Returns true when the first bytes look like a supported executable. */
function hasExecutableMagic(buffer, platform) {
  if (platform === 'win32') return buffer[0] === 0x4d && buffer[1] === 0x5a;
  if (platform === 'darwin') {
    return (buffer[0] === 0xcf && buffer[1] === 0xfa) || (buffer[0] === 0xfe && buffer[1] === 0xed);
  }
  return buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46;
}

/**
 * Verifies the configured CLI against the manifest digest.
 *
 * @returns {{ok: true, path: string, version: string, sha256: string}
 *   | {ok: false, reason: string, detail?: string}}
 */
function verifyArtifact({
  isPackaged,
  resourcesPath,
  appPath,
  manifestPath = path.join(appPath || process.cwd(), 'electron', 'tunnel', 'ngrok-artifact.json'),
  platform = process.platform,
  arch = process.arch,
  fsImpl = fs,
}) {
  let manifest;
  try {
    manifest = JSON.parse(fsImpl.readFileSync(manifestPath, 'utf8'));
  } catch {
    return { ok: false, reason: 'manifest-missing' };
  }
  if (!manifest || manifest.schemaVersion !== 1 || !manifest.artifacts) {
    return { ok: false, reason: 'manifest-invalid' };
  }
  const { key, filePath } = resolveArtifactPath({ isPackaged, resourcesPath, appPath, platform, arch });
  const entry = manifest.artifacts[key];
  if (!entry || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) {
    return { ok: false, reason: 'artifact-not-configured', detail: key };
  }
  let bytes;
  try {
    bytes = fsImpl.readFileSync(filePath);
  } catch {
    return { ok: false, reason: 'artifact-missing', detail: filePath };
  }
  if (bytes.length < 4096) {
    return { ok: false, reason: 'artifact-too-small', detail: filePath };
  }
  if (!hasExecutableMagic(bytes, platform)) {
    return { ok: false, reason: 'artifact-magic-mismatch', detail: filePath };
  }
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (digest !== entry.sha256) {
    return { ok: false, reason: 'artifact-digest-mismatch', detail: `${filePath} ${digest}` };
  }
  return { ok: true, path: filePath, version: String(entry.version || manifest.version || 'unknown'), sha256: digest };
}

module.exports = { artifactKey, resolveArtifactPath, verifyArtifact, hasExecutableMagic };
