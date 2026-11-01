/**
 * IPC sender and payload validation for the Electron main process.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md sections 7 and 10
 * (REQ-010). Every channel validates the sender WebContents, the main frame and
 * the exact application document before validating typed input.
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { parseOrigin } = require('./tunnel/endpoint-policy');
const { MAX_TOKEN_CHARS } = require('./tunnel/constants');

/** Error carrying a stable rejection code. */
function rejection(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Creates a sender guard bound to one BrowserWindow.
 *
 * @param {object} options
 * @param {() => import('electron').BrowserWindow | null} options.getWindow
 * @param {boolean} options.isDev
 * @param {string} options.indexPath packaged `out/index.html`
 */
function createSenderGuard({ getWindow, isDev, indexPath }) {
  const expectedFile = pathToFileURL(indexPath).pathname;

  /**
   * Throws unless the event comes from the main window's main frame showing the
   * expected application document.
   */
  function assertTrusted(event) {
    const win = getWindow();
    if (!win || win.isDestroyed()) throw rejection('untrusted-sender', 'No application window.');
    if (event.sender !== win.webContents) throw rejection('untrusted-sender', 'Unexpected sender.');
    if (!event.senderFrame || event.senderFrame !== win.webContents.mainFrame) {
      throw rejection('untrusted-frame', 'IPC is only accepted from the main frame.');
    }
    let url;
    try {
      url = new URL(event.senderFrame.url);
    } catch {
      throw rejection('untrusted-origin', 'Sender has no valid document URL.');
    }
    const allowed = isDev
      ? (url.protocol === 'http:' || url.protocol === 'https:') &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        url.port === '3000'
      : url.protocol === 'file:' && url.pathname === expectedFile;
    if (!allowed) throw rejection('untrusted-origin', 'Sender document is not the application document.');
  }

  return { assertTrusted };
}

/** Requires a plain object with only the expected keys. */
function requireObject(value, allowedKeys) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw rejection('invalid-input', 'Expected an object.');
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) throw rejection('invalid-input', `Unexpected field: ${key}`);
  }
  return value;
}

/** Requires an integer within bounds. */
function requireInteger(value, min, max, field) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw rejection('invalid-input', `${field} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

/** Requires a bounded string matching a pattern. */
function requireString(value, { min = 0, max, pattern, field }) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw rejection('invalid-input', `${field} is missing or too long.`);
  }
  if (pattern && !pattern.test(value)) throw rejection('invalid-input', `${field} has an invalid format.`);
  return value;
}

/** Validates `connection:select` input and returns a canonical origin or null. */
function validateConnectionSelect(input) {
  const value = requireObject(input, ['origin', 'expectedGeneration']);
  const expectedGeneration = requireInteger(value.expectedGeneration, 0, Number.MAX_SAFE_INTEGER, 'expectedGeneration');
  if (value.origin === null) return { origin: null, expectedGeneration };
  if (typeof value.origin !== 'string') throw rejection('invalid-input', 'origin must be a string or null.');
  const parsed = parseOrigin(value.origin);
  if (!parsed.ok) throw rejection('invalid-origin', parsed.message);
  return { origin: parsed.origin, endpoint: parsed, expectedGeneration };
}

/** Validates `share:authorize` input. */
function validateShareAuthorize(input) {
  const value = requireObject(input, ['profileId', 'generation', 'frmToken']);
  return {
    profileId: requireString(value.profileId, { min: 1, max: 64, pattern: /^[A-Za-z0-9_-]+$/, field: 'profileId' }),
    generation: requireInteger(value.generation, 0, Number.MAX_SAFE_INTEGER, 'generation'),
    frmToken: requireString(value.frmToken, { min: 1, max: MAX_TOKEN_CHARS, pattern: /^[^\r\n]+$/, field: 'frmToken' }),
  };
}

/** Validates `tunnel:start` input: a permit ID and nothing else. */
function validateTunnelStart(input) {
  const value = requireObject(input, ['permitId']);
  return { permitId: requireString(value.permitId, { min: 32, max: 32, pattern: /^[a-f0-9]{32}$/, field: 'permitId' }) };
}

/** Validates an empty payload for stop/status. */
function validateEmpty(input) {
  if (input !== undefined && input !== null) requireObject(input, []);
  return {};
}

module.exports = {
  createSenderGuard,
  validateConnectionSelect,
  validateShareAuthorize,
  validateTunnelStart,
  validateEmpty,
  rejection,
};
