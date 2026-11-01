/**
 * Contract tests for the bounded FRM client.
 *
 * Requirements: REQ-014 (origin/port preservation), REQ-015 (redirect
 * rejection), REQ-018 (deadline/size/schema), REQ-019 (one in-flight chat).
 * Fixture: mocked global fetch only; no network, no real credentials.
 * Isolation: each test restores mocks; timing uses the production deadline
 * constant rather than sleeps.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  abortAllRequests,
  buildUrl,
  fetchEndpoint,
  testConnection,
  sendChatMessage,
  getEndpoints,
  getEndpointsByCategory,
} from '../api';
import { FrmRequestError } from '../request-bounds';
import type { FRMConfig } from '../types';

/** Creates a minimal FRMConfig with overrides. */
function makeConfig(overrides: Partial<FRMConfig> = {}): FRMConfig {
  return { host: 'localhost', port: '8080', password: '', refreshRate: 5000, ...overrides };
}

describe('buildUrl', () => {
  beforeEach(() => abortAllRequests());

  it('constructs loopback and private-LAN HTTP URLs with the explicit port', () => {
    expect(buildUrl(makeConfig(), 'getPower')).toBe('http://localhost:8080/getPower');
    expect(buildUrl(makeConfig({ host: '127.0.0.1' }), 'getTrains')).toBe('http://127.0.0.1:8080/getTrains');
    expect(buildUrl(makeConfig({ host: '192.168.1.50' }), 'getPower')).toBe('http://192.168.1.50:8080/getPower');
    expect(buildUrl(makeConfig({ host: '10.0.0.5' }), 'getPower')).toBe('http://10.0.0.5:8080/getPower');
    expect(buildUrl(makeConfig({ host: '172.16.0.1' }), 'getPower')).toBe('http://172.16.0.1:8080/getPower');
  });

  it('defaults a DNS name to HTTPS and preserves an explicit non-default port', () => {
    expect(buildUrl(makeConfig({ host: 'abc.ngrok-free.app', port: '' }), 'getPower'))
      .toBe('https://abc.ngrok-free.app/getPower');
    expect(buildUrl(makeConfig({ host: 'myserver.example.com', port: '8443' }), 'getPower'))
      .toBe('https://myserver.example.com:8443/getPower');
  });

  it('preserves a pasted explicit scheme and root trailing slash', () => {
    expect(buildUrl(makeConfig({ host: 'http://localhost/' }), 'getPower')).toBe('http://localhost:8080/getPower');
    expect(buildUrl(makeConfig({ host: 'https://abc.ngrok-free.app' }), 'getPower'))
      .toBe('https://abc.ngrok-free.app:8080/getPower');
  });

  it('rejects conflicting embedded and separate ports instead of discarding one', () => {
    expect(() => buildUrl(makeConfig({ host: 'localhost:3000', port: '8080' }), 'getPower'))
      .toThrow(/port 3000/);
  });

  it('rejects an empty host rather than guessing localhost', () => {
    expect(() => buildUrl(makeConfig({ host: '', port: '' }), 'getPower')).toThrow(/Enter a server address/);
  });

  it('omits the default port and keeps a non-default one', () => {
    expect(buildUrl(makeConfig({ port: '80' }), 'getPower')).toBe('http://localhost/getPower');
    expect(buildUrl(makeConfig({ port: '443' }), 'getPower')).toBe('http://localhost:443/getPower');
  });
});

describe('fetchEndpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    abortAllRequests();
  });

  it('fetches JSON through the canonical URL and forbids redirects', async () => {
    const mockData = [{ CircuitID: 1 }];
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );
    const result = await fetchEndpoint(makeConfig(), 'getPower');
    expect(result).toEqual(mockData);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('sets the token only when provided and the ngrok header only for ngrok hosts', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200 }));
    await fetchEndpoint(makeConfig({ password: 'secret123' }), 'getPower');
    expect((spy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Accept: 'application/json',
      'X-FRM-Authorization': 'secret123',
    });
    await fetchEndpoint(makeConfig({ host: 'myapp.ngrok-free.app', port: '' }), 'getPower');
    expect((spy.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      'ngrok-skip-browser-warning': '1',
    });
  });

  it('rejects a redirect status without reading a target body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 302, statusText: 'Found' }),
    );
    await expect(fetchEndpoint(makeConfig(), 'getPower')).rejects.toMatchObject({ code: 'redirect' });
  });

  it('maps 401/403 to an auth error without echoing the token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
    const failure = await fetchEndpoint(makeConfig({ password: 'top-secret' }), 'getPower').catch((e) => e as FrmRequestError);
    expect(failure.code).toBe('auth');
    expect(failure.message).not.toContain('top-secret');
  });

  it('rejects a declared oversized body and malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('x', { status: 200, headers: { 'content-length': String(20 * 1024 * 1024) } }),
    );
    await expect(fetchEndpoint(makeConfig(), 'getPower')).rejects.toMatchObject({ code: 'too-large' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{not json', { status: 200 }));
    await expect(fetchEndpoint(makeConfig(), 'getPower')).rejects.toMatchObject({ code: 'malformed' });
  });

  it('rejects an object where a collection is expected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(fetchEndpoint(makeConfig(), 'getPower')).rejects.toMatchObject({ code: 'schema' });
  });

  it('rejects non-finite numbers and over-deep payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"x":1e999}', { status: 200 }));
    await expect(fetchEndpoint(makeConfig(), 'getPower')).rejects.toMatchObject({ code: 'schema' });

    let deep: unknown = 1;
    for (let i = 0; i < 40; i += 1) deep = { nested: deep };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(deep), { status: 200 }));
    await expect(fetchEndpoint(makeConfig(), 'getPower')).rejects.toMatchObject({ code: 'schema' });
  });
});

describe('testConnection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    abortAllRequests();
  });

  it('returns ok on a successful read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await expect(testConnection(makeConfig())).resolves.toEqual({ ok: true });
  });

  it('returns a typed transport failure without leaking details', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error with http://secret'));
    const result = await testConnection(makeConfig({ password: 'secret' }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('transport');
    expect(result.error).not.toContain('secret');
  });
});

describe('sendChatMessage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    abortAllRequests();
  });

  it('POSTs the message and accepts an empty success body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }));
    await sendChatMessage(makeConfig(), 'Hello world');
    expect(spy).toHaveBeenCalledWith(
      'http://localhost:8080/sendChatMessage',
      expect.objectContaining({ method: 'POST', redirect: 'error', body: JSON.stringify({ message: 'Hello world' }) }),
    );
  });

  it('rejects an oversized draft before any request', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(sendChatMessage(makeConfig(), 'x'.repeat(2001))).rejects.toMatchObject({ code: 'schema' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not allow a second concurrent send for the same origin', async () => {
    let release!: () => void;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () => new Promise<Response>((resolve) => { release = () => resolve(new Response(null, { status: 200 })); }),
    );
    const first = sendChatMessage(makeConfig(), 'one');
    await expect(sendChatMessage(makeConfig(), 'two')).rejects.toMatchObject({ code: 'chat-in-flight' });
    release();
    await first;
  });
});

describe('endpoint registry', () => {
  it('returns endpoints with required fields', () => {
    const endpoints = getEndpoints();
    expect(endpoints.length).toBeGreaterThan(0);
    for (const ep of endpoints) {
      expect(typeof ep.path).toBe('string');
      expect(typeof ep.category).toBe('string');
      expect(typeof ep.description).toBe('string');
      expect(typeof ep.requiresGameThread).toBe('boolean');
    }
  });

  it('groups every endpoint exactly once', () => {
    const categories = getEndpointsByCategory();
    const total = [...categories.values()].reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(getEndpoints().length);
  });
});
