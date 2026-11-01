// @vitest-environment node
/**
 * Real local FRM integration tests (loopback HTTP, dummy token).
 *
 * Requirements: REQ-008, REQ-015, REQ-018.
 * Oracle: the actual client/probe code rejects an anonymous request, accepts the
 * authenticated one, rejects a redirect without the redirect target receiving a
 * request, and never sends the token to another origin.
 * Fixture: owned loopback Node servers; no game, provider or public network.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { fetchEndpoint } from '../api';
import { probeSharing } from '../../../electron/frm-probe.js';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length) await closers.pop()!();
});

/** Starts a server and registers cleanup. */
async function serve(handler: Parameters<typeof createServer>[0]) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  closers.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return port;
}

const config = (port: number, token: string) => ({ host: '127.0.0.1', port: String(port), password: token, refreshRate: 5000 });

describe('local FRM integration', () => {
  it('enforces the dummy token and passes the real sharing probe', async () => {
    const token = 'sim-token-not-a-secret';
    const port = await serve((request, response) => {
      const authorized = request.headers['x-frm-authorization'] === token;
      response.writeHead(authorized ? 200 : 401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(authorized ? [] : { error: 'unauthorized' }));
    });

    await expect(probeSharing({ origin: `http://127.0.0.1:${port}`, token })).resolves.toEqual({ ok: true });
    await expect(probeSharing({ origin: `http://127.0.0.1:${port}`, token: 'wrong-token' }))
      .resolves.toEqual({ ok: false, code: 'auth-rejected' });
    await expect(fetchEndpoint(config(port, token), 'getPower')).resolves.toEqual([]);
  });

  it('rejects a credential-bearing redirect and never contacts the target origin', async () => {
    const token = 'sim-token-not-a-secret';
    let targetHits = 0;
    const targetPort = await serve((_request, response) => {
      targetHits += 1;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('[]');
    });
    const sourcePort = await serve((_request, response) => {
      response.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/getPower` });
      response.end();
    });

    const failure = await fetchEndpoint(config(sourcePort, token), 'getPower').catch((error) => error);
    expect(failure.code).toBe('redirect');
    expect(targetHits).toBe(0);
  });

  it('rejects malformed and oversized real responses', async () => {
    const token = 'sim-token-not-a-secret';
    const malformedPort = await serve((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{not json');
    });
    await expect(fetchEndpoint(config(malformedPort, token), 'getPower')).rejects.toMatchObject({ code: 'malformed' });

    const hugePort = await serve((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': String(20 * 1024 * 1024) });
      response.end('[]');
    });
    await expect(fetchEndpoint(config(hugePort, token), 'getPower')).rejects.toMatchObject({ code: 'too-large' });
  });
});
