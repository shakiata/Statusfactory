/**
 * FRM sharing-probe tests.
 *
 * Requirements: REQ-008. Oracle: sharing is allowed only when every probed
 * endpoint rejects an anonymous request and accepts the authenticated request;
 * oversized probe bodies are cancelled.
 * Fixture: mocked fetch responses; no network or real token.
 */
import { describe, it, expect, vi } from 'vitest';
import { probeSharing } from '../../electron/frm-probe.js';

/** Builds a minimal Response-like object with status/ok/body. */
function response(status: number, body = '[]') {
  return new Response(body, { status });
}

describe('probeSharing', () => {
  const input = { origin: 'http://192.168.1.5:8080', token: 'dummy-token', endpoints: ['getPower', 'getFactory'] };

  it('locks the production probe set and passes when every probe enforces auth', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const authorized = 'X-FRM-Authorization' in (init.headers as Record<string, string>);
      return response(authorized ? 200 : 401);
    });
    // No endpoint override: exercises the real PROBE_ENDPOINTS list (4 x 2).
    await expect(probeSharing({ origin: input.origin, token: input.token, fetchImpl })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });

  it('blocks when any probed endpoint does not enforce authentication', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      const authorized = 'X-FRM-Authorization' in (init.headers as Record<string, string>);
      if (!authorized && url.endsWith('getFactory')) return response(200);
      return response(authorized ? 200 : 401);
    });
    await expect(probeSharing({ ...input, fetchImpl })).resolves.toEqual({ ok: false, code: 'auth-not-enforced' });
  });

  it('blocks when the token is rejected', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const authorized = 'X-FRM-Authorization' in (init.headers as Record<string, string>);
      return response(authorized ? 403 : 401);
    });
    await expect(probeSharing({ ...input, fetchImpl })).resolves.toEqual({ ok: false, code: 'auth-rejected' });
  });

  it('cancels an oversized probe body instead of buffering it', async () => {
    const large = 'x'.repeat(2 * 1024 * 1024);
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const authorized = 'X-FRM-Authorization' in (init.headers as Record<string, string>);
      return response(authorized ? 200 : 401, large);
    });
    const result = await probeSharing({ ...input, fetchImpl });
    expect(result).toEqual({ ok: false, code: 'probe-too-large' });
  });
});
