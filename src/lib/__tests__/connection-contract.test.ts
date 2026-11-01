/**
 * Endpoint parsing and transport-policy tests.
 *
 * Requirements: REQ-014, REQ-015, REQ-016.
 * Oracle: each documented input produces the exact canonical origin or a typed
 * rejection — never a silent scheme/port change.
 * Fixtures: pure strings; no network. Isolation: none needed (pure functions).
 */
import { describe, it, expect } from 'vitest';
import { parseEndpoint } from '../connection/contract';

/** Convenience: parses and asserts success, returning the endpoint. */
function ok(host: string, port = '') {
  const result = parseEndpoint(host, port);
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.endpoint;
}

/** Convenience: parses and asserts the failure code. */
function code(host: string, port = '') {
  const result = parseEndpoint(host, port);
  if (result.ok) throw new Error(`expected failure, got ${result.endpoint.origin}`);
  return result.error.code;
}

describe('parseEndpoint', () => {
  it('keeps loopback and private LAN on plaintext HTTP with the explicit port', () => {
    expect(ok('localhost', '8080')).toMatchObject({ origin: 'http://localhost:8080', scheme: 'http', isLoopback: true });
    expect(ok('127.0.0.1', '8080').origin).toBe('http://127.0.0.1:8080');
    expect(ok('[::1]', '8080')).toMatchObject({ origin: 'http://[::1]:8080', isLoopback: true });
    expect(ok('192.168.1.5', '8080')).toMatchObject({ requiresPlaintextAcknowledgement: true, isPrivate: true });
    expect(ok('10.0.0.5', '80').origin).toBe('http://10.0.0.5');
    expect(ok('172.31.255.254', '8080').origin).toBe('http://172.31.255.254:8080');
    expect(ok('[fd12:3456::1]', '8080').isPrivate).toBe(true);
  });

  it('never classifies a DNS name as private and defaults it to HTTPS', () => {
    expect(ok('frm.example.com', '')).toMatchObject({ scheme: 'https', origin: 'https://frm.example.com', isPrivate: false });
    expect(ok('10.example.com', '')).toMatchObject({ scheme: 'https', isPrivate: false });
    expect(ok('172.32.0.1', '443').scheme).toBe('https');
  });

  it('preserves an explicit HTTPS scheme and port', () => {
    expect(ok('https://example.com:8443', '').origin).toBe('https://example.com:8443');
    expect(ok('https://192.168.1.5:9443', '').origin).toBe('https://192.168.1.5:9443');
  });

  it('refuses plaintext HTTP for public literals and DNS names', () => {
    expect(code('http://8.8.8.8')).toBe('plaintext-public');
    expect(code('http://frm.example.com')).toBe('plaintext-dns');
    // A bare DNS name defaults to HTTPS even when a port is supplied.
    expect(ok('example.com', '80').origin).toBe('https://example.com:80');
  });

  it('rejects ambiguous URLs, userinfo, paths and conflicting ports', () => {
    expect(code('http://user:pass@localhost')).toBe('ambiguous-url');
    expect(code('http://localhost/api')).toBe('ambiguous-url');
    expect(code('http://localhost?x=1')).toBe('ambiguous-url');
    expect(code('localhost', 'abc')).toBe('invalid-port');
    expect(code('localhost:3000', '8080')).toBe('port-conflict');
    expect(code('localhost', '70000')).toBe('invalid-port');
  });

  it('rejects ambiguous numeric and invalid IPv6 forms', () => {
    expect(code('010.0.0.1', '8080')).toBe('invalid-host');
    expect(code('999.1.1.1', '8080')).toBe('invalid-host');
    expect(code('[fe80::1%eth0]', '8080')).toBe('invalid-host');
    expect(code('localhost:notaport')).toBe('unsupported-scheme');
  });

  it('normalises a trailing root slash and IPv4-mapped IPv6', () => {
    expect(ok('http://localhost/').origin).toBe('http://localhost');
    expect(ok('[::ffff:192.168.1.5]', '8080')).toMatchObject({ isPrivate: true, origin: 'http://[::ffff:c0a8:105]:8080' });
  });
});
