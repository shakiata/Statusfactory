/**
 * Canonical endpoint parsing and transport policy.
 *
 * This module is the single source of truth for connection identity in browser
 * and Electron renderer code. It is intentionally pure (no DOM, no React, no
 * Node APIs) so the same rules can be tested and mirrored by the Electron main
 * process.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md sections 1–2
 * (REQ-014, REQ-016).
 */

/** Supported URL schemes. Plain HTTP is only permitted under the policy below. */
export type TransportScheme = 'http' | 'https';

/**
 * A validated connection endpoint.
 * `origin` is the WHATWG origin, including a non-default port, and is the key
 * used to bind a session credential.
 */
export interface ConnectionEndpoint {
  scheme: TransportScheme;
  /** Lowercase hostname without brackets; IPv6 literals keep their colons. */
  hostname: string;
  /** Effective port (defaults applied). */
  port: number;
  /** Canonical origin, e.g. `https://frm.example:8443`. */
  origin: string;
  /** True for 127.0.0.0/8 and ::1. */
  isLoopback: boolean;
  /** True for RFC1918 IPv4 or IPv6 ULA literals (not DNS names). */
  isPrivate: boolean;
  /** True when non-loopback plaintext LAN HTTP needs a per-origin acknowledgement. */
  requiresPlaintextAcknowledgement: boolean;
}

export type EndpointField = 'host' | 'port' | 'scheme';

export interface EndpointError {
  code:
    | 'empty-host'
    | 'invalid-host'
    | 'invalid-port'
    | 'port-conflict'
    | 'unsupported-scheme'
    | 'ambiguous-url'
    | 'plaintext-public'
    | 'plaintext-dns';
  message: string;
  field: EndpointField;
}

export type EndpointParseResult =
  | { ok: true; endpoint: ConnectionEndpoint }
  | { ok: false; error: EndpointError };

const DEFAULT_HTTPS_PORT = 443;
const DEFAULT_HTTP_PORT = 80;
const MAX_PORT = 65535;

/** Builds a typed parse failure without throwing. */
function fail(
  code: EndpointError['code'],
  message: string,
  field: EndpointField,
): EndpointParseResult {
  return { ok: false, error: { code, message, field } };
}

/**
 * Classifies an IPv4 literal.
 * Returns `null` for anything that is not a well-formed dotted quad (including
 * leading-zero forms such as `010.0.0.1`, which are ambiguous).
 */
function classifyIPv4(
  value: string,
): { isLoopback: boolean; isPrivate: boolean } | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    // Reject leading zeros: "01" is ambiguous across resolvers.
    if (part.length > 1 && part.startsWith('0')) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    octets.push(n);
  }
  const [a, b] = octets;
  const isLoopback = a === 127;
  const isPrivate =
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
  return { isLoopback, isPrivate };
}

/**
 * Classifies an IPv6 literal. Only loopback and ULA (`fc00::/7`) count as
 * local; link-local, multicast and other special-use ranges are not accepted
 * for plaintext HTTP. IPv4-mapped forms are normalised to their IPv4 rules.
 */
function classifyIPv6(
  value: string,
): { isLoopback: boolean; isPrivate: boolean } | null {
  if (value.includes('%')) return null; // zone identifiers are ambiguous
  let host = value.toLowerCase();
  // Normalise IPv4-mapped IPv6 (::ffff:192.168.1.5) to IPv4 rules.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  if (mapped) return classifyIPv4(mapped[1]);
  // A canonical serialisation can be hex (::ffff:c0a8:105) after URL parsing.
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return classifyIPv4(`${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`);
  }
  try {
    // URL validates the compressed/expanded syntax without resolving DNS.
    const parsed = new URL(`http://[${host}]/`);
    host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return null;
  }
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') {
    return { isLoopback: true, isPrivate: false };
  }
  const first = host.split(':')[0];
  const firstByte = parseInt(first.padEnd(4, '0').slice(0, 2), 16);
  const isUla = Number.isFinite(firstByte) && (firstByte & 0xfe) === 0xfc;
  return { isLoopback: false, isPrivate: isUla };
}

/** Validates a DNS name (labels, hyphens, no leading/trailing hyphen). */
function isDnsName(value: string): boolean {
  if (value.length === 0 || value.length > 253) return false;
  const labels = value.split('.');
  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}

/** Extracts a host and an optional embedded port from user input. */
function splitHostPort(raw: string): { host: string; port?: string } | null {
  if (raw.startsWith('[')) {
    const match = /^\[([^\]]+)\](?::(\d+))?$/.exec(raw);
    if (!match) return null;
    return { host: match[1], port: match[2] };
  }
  const colons = (raw.match(/:/g) ?? []).length;
  if (colons === 0) return { host: raw };
  if (colons === 1) {
    const [host, port] = raw.split(':');
    if (!/^\d+$/.test(port)) return null;
    return { host, port };
  }
  // Multiple colons without brackets is a bare IPv6 literal, not host:port.
  return { host: raw };
}

/**
 * Parses user input into a canonical endpoint or a typed error.
 *
 * Inputs: the host field (may include a scheme, brackets and/or a port) and the
 * separate port field (may be empty).
 * Side effects: none. Errors are returned, never thrown.
 *
 * Invariants: an explicit scheme is never changed; an explicit port is never
 * silently discarded; plaintext HTTP is refused for public or DNS endpoints.
 */
export function parseEndpoint(
  hostInput: string,
  portInput = '',
): EndpointParseResult {
  const rawHost = (hostInput ?? '').trim();
  if (rawHost.length === 0) return fail('empty-host', 'Enter a server address.', 'host');
  if (/[\s\u0000-\u001f\u007f]/.test(rawHost)) {
    return fail('invalid-host', 'The address contains whitespace or control characters.', 'host');
  }
  if (rawHost.includes('@')) {
    return fail('ambiguous-url', 'Do not include a username or password in the address.', 'host');
  }

  let scheme: TransportScheme | null = null;
  let remainder = rawHost;
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(rawHost);
  if (schemeMatch) {
    const candidate = schemeMatch[1].toLowerCase();
    if (candidate !== 'http' && candidate !== 'https') {
      return fail('unsupported-scheme', 'Only http:// and https:// are supported.', 'scheme');
    }
    scheme = candidate;
    remainder = rawHost.slice(schemeMatch[0].length);
    if (remainder.length === 0) {
      return fail('empty-host', 'Enter a server address after the scheme.', 'host');
    }
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawHost) && !rawHost.startsWith('[')) {
    // Something like "ftp:example" or a malformed "localhost:abc".
    const tail = rawHost.slice(rawHost.indexOf(':') + 1);
    if (!/^\d+$/.test(tail)) {
      return fail('unsupported-scheme', 'Use http:// or https://, or host:port.', 'scheme');
    }
  }

  // A trailing root slash is cosmetic (`http://localhost/`); deeper paths are
  // still rejected here, after the scheme prefix has been removed.
  remainder = remainder.replace(/\/+$/, '');
  if (/[?#/]/.test(remainder)) {
    return fail('ambiguous-url', 'Enter only scheme, host and port — no path, query or fragment.', 'host');
  }

  const split = splitHostPort(remainder);
  if (!split || split.host.length === 0) {
    return fail('invalid-host', 'The host is not a valid address.', 'host');
  }

  const explicitPort = split.port;
  const fieldPort = (portInput ?? '').trim();
  if (explicitPort && fieldPort && explicitPort !== fieldPort) {
    return fail(
      'port-conflict',
      `The address says port ${explicitPort} but the Port field says ${fieldPort}.`,
      'port',
    );
  }
  const portText = explicitPort ?? fieldPort;
  let port: number | undefined;
  if (portText !== '') {
    if (!/^\d{1,5}$/.test(portText)) {
      return fail('invalid-port', 'Port must be a whole number from 1 to 65535.', 'port');
    }
    port = Number(portText);
    if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
      return fail('invalid-port', 'Port must be a whole number from 1 to 65535.', 'port');
    }
  }

  const host = split.host.toLowerCase();
  const isBracketedIPv6 = host.includes(':');
  let classification: { isLoopback: boolean; isPrivate: boolean } | null = null;
  let hostname: string;
  /** Distinguishes an address literal from a DNS name for the plaintext policy. */
  let isIpLiteral = false;

  if (isBracketedIPv6) {
    isIpLiteral = true;
    classification = classifyIPv6(host);
    if (!classification) {
      return fail('invalid-host', 'The IPv6 address is not valid.', 'host');
    }
    hostname = host;
  } else if (/^\d+(?:\.\d+){3}$/.test(host)) {
    isIpLiteral = true;
    classification = classifyIPv4(host);
    if (!classification) {
      return fail('invalid-host', 'The IPv4 address is not valid.', 'host');
    }
    hostname = host;
  } else if (/^\d+$/.test(host)) {
    return fail('invalid-host', 'Ambiguous numeric host; enter a full address or DNS name.', 'host');
  } else {
    if (!isDnsName(host)) {
      return fail('invalid-host', 'The hostname is not valid.', 'host');
    }
    hostname = host;
    classification = {
      isLoopback: host === 'localhost',
      isPrivate: false,
    };
  }

  const effectiveScheme: TransportScheme =
    scheme ?? (classification.isLoopback || classification.isPrivate ? 'http' : 'https');
  const effectivePort =
    port ?? (effectiveScheme === 'https' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT);

  if (effectiveScheme === 'http') {
    if (!classification.isLoopback && !classification.isPrivate) {
      if (!isIpLiteral) {
        return fail(
          'plaintext-dns',
          'Plain HTTP is not allowed for DNS names. Use https:// or the server’s private IP address.',
          'scheme',
        );
      }
      return fail(
        'plaintext-public',
        'Plain HTTP is only allowed for loopback or a private LAN address. Use https://.',
        'scheme',
      );
    }
  }

  const hostForUrl = hostname.includes(':') ? `[${hostname}]` : hostname;
  let origin: string;
  try {
    origin = new URL(`${effectiveScheme}://${hostForUrl}:${effectivePort}`).origin;
  } catch {
    return fail('invalid-host', 'The address could not be normalised.', 'host');
  }

  return {
    ok: true,
    endpoint: {
      scheme: effectiveScheme,
      hostname,
      port: effectivePort,
      origin,
      isLoopback: classification.isLoopback,
      isPrivate: classification.isPrivate,
      requiresPlaintextAcknowledgement:
        effectiveScheme === 'http' && !classification.isLoopback,
    },
  };
}

/** Parses the `{host, port}` fields of a connection config. */
export function parseConfigEndpoint(config: { host: string; port: string }): EndpointParseResult {
  return parseEndpoint(config.host, config.port);
}

/**
 * Builds a request URL for a fixed endpoint name.
 * The endpoint name must be an internal identifier, never remote text.
 */
export function buildEndpointUrl(endpoint: ConnectionEndpoint, endpointName: string): string {
  if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(endpointName)) {
    throw new Error('Invalid endpoint name.');
  }
  return `${endpoint.origin}/${endpointName}`;
}

/**
 * Returns true when two origins are byte-identical after normalisation.
 * Credentials must never be reused across origins.
 */
export function sameOrigin(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a === b;
}
