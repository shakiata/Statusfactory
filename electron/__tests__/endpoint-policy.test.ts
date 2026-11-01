/**
 * Main-process endpoint policy tests.
 *
 * Requirement: REQ-010 (main independently validates the renderer's origin).
 * Oracle: the same canonical origins as the renderer are accepted and public
 * plaintext origins are rejected.
 */
import { describe, it, expect } from 'vitest';
import { parseOrigin, upstreamAddress } from '../../electron/tunnel/endpoint-policy.js';

describe('parseOrigin', () => {
  it('accepts canonical loopback, private and HTTPS origins', () => {
    expect(parseOrigin('http://localhost:8080')).toMatchObject({ ok: true, origin: 'http://localhost:8080', isLoopback: true });
    expect(parseOrigin('http://192.168.1.5:8080')).toMatchObject({ ok: true, requiresPlaintextAcknowledgement: true });
    expect(parseOrigin('https://frm.example.com:8443')).toMatchObject({ ok: true, origin: 'https://frm.example.com:8443' });
  });

  it('rejects credentials, paths, public plaintext and non-http schemes', () => {
    expect(parseOrigin('http://user:pass@localhost:8080').ok).toBe(false);
    expect(parseOrigin('http://localhost:8080/api').ok).toBe(false);
    expect(parseOrigin('http://8.8.8.8:8080').code).toBe('plaintext-not-allowed');
    expect(parseOrigin('ftp://localhost:8080').ok).toBe(false);
    expect(parseOrigin('not a url').ok).toBe(false);
  });

  it('produces a bracketed upstream address for IPv6', () => {
    const parsed = parseOrigin('http://[::1]:8080');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(upstreamAddress(parsed)).toBe('[::1]:8080');
  });
});
