/**
 * Provider credential loading.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 7 and
 * docs/security/06_SECURITY_AND_OPERATIONS.md section 2 (REQ-007, REQ-012).
 *
 * The provider token lives in a separate user-only file, is read by main only,
 * is passed to the CLI through its environment (never argv), and never enters
 * the renderer or any log.
 */

const fs = require('fs');
const path = require('path');

/** Provider credential file name under Electron userData. */
const PROVIDER_FILE = 'ngrok-provider.json';

/**
 * Loads the provider token.
 *
 * @returns {{ok: true, token: string} | {ok: false, reason: string}}
 */
function loadProviderToken({ userDataPath, fsImpl = fs, platform = process.platform }) {
  const filePath = path.join(userDataPath, PROVIDER_FILE);
  let stat;
  try {
    stat = fsImpl.statSync(filePath);
  } catch {
    return { ok: false, reason: 'provider-not-configured' };
  }
  if (!stat.isFile()) return { ok: false, reason: 'provider-not-configured' };
  if (platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    return { ok: false, reason: 'provider-file-permissions' };
  }
  let parsed;
  try {
    parsed = JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
  } catch {
    return { ok: false, reason: 'provider-file-invalid' };
  }
  const token = parsed && typeof parsed.authtoken === 'string' ? parsed.authtoken.trim() : '';
  if (token.length < 8 || token.length > 512 || /[\r\n]/.test(token)) {
    return { ok: false, reason: 'provider-token-invalid' };
  }
  return { ok: true, token };
}

/** Writes a user-only provider file (setup helper for the owner). */
function writeProviderToken({ userDataPath, token, fsImpl = fs }) {
  if (typeof token !== 'string' || token.trim().length < 8 || /[\r\n]/.test(token)) {
    throw new Error('Provider token is invalid.');
  }
  const filePath = path.join(userDataPath, PROVIDER_FILE);
  fsImpl.mkdirSync(userDataPath, { recursive: true });
  fsImpl.writeFileSync(filePath, JSON.stringify({ authtoken: token.trim() }), { mode: 0o600 });
  return filePath;
}

module.exports = { loadProviderToken, writeProviderToken, PROVIDER_FILE };
