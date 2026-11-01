/**
 * Main-process endpoint policy.
 *
 * This is a deliberately small mirror of src/lib/connection/contract.ts: main
 * must not trust a renderer-supplied origin, even when the renderer validated
 * it. Keep the two implementations aligned with the shared fixture test in
 * `electron/__tests__/endpoint-policy.test.ts`.
 */

const DEFAULT_PORTS = { http: 80, https: 443 };

/** Classifies an IPv4 literal; rejects ambiguous leading-zero forms. */
function classifyIPv4(value) {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const octets = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith('0')) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    octets.push(n);
  }
  const [a, b] = octets;
  return {
    isLoopback: a === 127,
    isPrivate: a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168),
  };
}

/** Classifies an IPv6 literal (loopback or ULA only). */
function classifyIPv6(value) {
  if (value.includes('%')) return null;
  let host = value.toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  if (mapped) return classifyIPv4(mapped[1]);
  // URL serialisation may convert IPv4-mapped IPv6 to hex (::ffff:c0a8:105).
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return classifyIPv4(
      `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`,
    );
  }
  try {
    host = new URL(`http://[${host}]/`).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return null;
  }
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') {
    return { isLoopback: true, isPrivate: false };
  }
  const first = host.split(':')[0];
  const firstByte = parseInt(first.padEnd(4, '0').slice(0, 2), 16);
  return {
    isLoopback: false,
    isPrivate: Number.isFinite(firstByte) && (firstByte & 0xfe) === 0xfc,
  };
}

/** Validates a DNS name. */
function isDnsName(value) {
  if (value.length === 0 || value.length > 253) return false;
  return value
    .split('.')
    .every(
      (label) =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    );
}

/**
 * Validates one canonical origin string.
 *
 * @param {unknown} input candidate origin
 * @returns {{ok: true, origin: string, hostname: string, port: number,
 *   scheme: string, requiresPlaintextAcknowledgement: boolean, isLoopback: boolean}
 *   | {ok: false, code: string, message: string}}
 */
function parseOrigin(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 2048) {
    return { ok: false, code: 'invalid-origin', message: 'Missing or oversized origin.' };
  }
  if (input.includes('@') || /[\s\u0000-\u001f\u007f]/.test(input)) {
    return { ok: false, code: 'invalid-origin', message: 'Origin contains credentials or control characters.' };
  }
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, code: 'invalid-origin', message: 'Origin is not a valid URL.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, code: 'unsupported-scheme', message: 'Only http and https origins are supported.' };
  }
  if (url.username || url.password) {
    return { ok: false, code: 'invalid-origin', message: 'Origin must not contain userinfo.' };
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    return { ok: false, code: 'ambiguous-origin', message: 'Origin must not contain a path, query or fragment.' };
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const scheme = url.protocol.slice(0, -1);
  const port = url.port ? Number(url.port) : DEFAULT_PORTS[scheme];
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, code: 'invalid-port', message: 'Port must be between 1 and 65535.' };
  }

  let classification = null;
  if (hostname.includes(':')) {
    classification = classifyIPv6(hostname);
  } else if (/^\d+(?:\.\d+){3}$/.test(hostname)) {
    classification = classifyIPv4(hostname);
  } else if (/^\d+$/.test(hostname)) {
    return { ok: false, code: 'invalid-host', message: 'Ambiguous numeric host.' };
  } else if (isDnsName(hostname)) {
    classification = { isLoopback: hostname === 'localhost', isPrivate: false };
  }
  if (!classification) {
    return { ok: false, code: 'invalid-host', message: 'Host is not a valid address.' };
  }

  if (scheme === 'http' && !classification.isLoopback && !classification.isPrivate) {
    return {
      ok: false,
      code: 'plaintext-not-allowed',
      message: 'Plain HTTP is only allowed for loopback or a private LAN literal.',
    };
  }

  // Re-serialise through URL so the returned origin is canonical.
  const canonical = new URL(`${scheme}://${url.hostname}:${port}`).origin;
  return {
    ok: true,
    origin: canonical,
    hostname,
    port,
    scheme,
    isLoopback: classification.isLoopback,
    requiresPlaintextAcknowledgement: scheme === 'http' && !classification.isLoopback,
  };
}

/**
 * Returns the `host:port` upstream address for a fixed origin.
 * IPv6 literals are bracketed so the CLI receives an unambiguous target.
 */
function upstreamAddress(endpoint) {
  const host = endpoint.hostname.includes(':') ? `[${endpoint.hostname}]` : endpoint.hostname;
  return `${host}:${endpoint.port}`;
}

module.exports = { parseOrigin, upstreamAddress };
