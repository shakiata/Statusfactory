/**
 * IPC guard tests.
 *
 * Requirements: REQ-010. Oracle: only the main window's main frame showing the
 * exact application document may call a channel; payload validation rejects
 * malformed types/values before any side effect.
 * Fixture: plain objects; no Electron runtime.
 */
import { describe, it, expect } from 'vitest';
import { pathToFileURL } from 'node:url';
import {
  createSenderGuard,
  validateConnectionSelect,
  validateShareAuthorize,
  validateTunnelStart,
} from '../../electron/ipc-guards.js';

const indexPath = '/opt/statusfactory/out/index.html';
const fileUrl = pathToFileURL(indexPath).href;

/** Builds a guard plus a matching event for the packaged document. */
function fixture(overrides: Record<string, unknown> = {}) {
  const mainFrame = { url: fileUrl };
  const webContents = { mainFrame, id: 1 };
  const window = { isDestroyed: () => false, webContents };
  const guard = createSenderGuard({ getWindow: () => window, isDev: false, indexPath });
  const event = { sender: webContents, senderFrame: mainFrame, ...overrides };
  return { guard, event, webContents, mainFrame };
}

describe('sender guard', () => {
  it('accepts the main frame of the packaged document', () => {
    const { guard, event } = fixture();
    expect(() => guard.assertTrusted(event)).not.toThrow();
  });

  it('rejects a foreign sender, a subframe and a different document', () => {
    const { guard, webContents, mainFrame } = fixture();
    expect(() => guard.assertTrusted({ sender: {}, senderFrame: {} })).toThrow(/Unexpected sender/);
    expect(() => guard.assertTrusted({ sender: webContents, senderFrame: { url: fileUrl } })).toThrow(/main frame/);
    mainFrame.url = 'https://evil.example/';
    expect(() => guard.assertTrusted({ sender: webContents, senderFrame: mainFrame })).toThrow(/application document/);
  });

  it('does not trust a localhost frame in a packaged build', () => {
    const { guard, webContents, mainFrame } = fixture();
    mainFrame.url = 'http://localhost:3000/';
    expect(() => guard.assertTrusted({ sender: webContents, senderFrame: mainFrame })).toThrow(/application document/);
  });
});

describe('payload validation', () => {
  it('accepts canonical origins and null disconnect', () => {
    expect(validateConnectionSelect({ origin: 'http://192.168.1.5:8080', expectedGeneration: 1 }))
      .toMatchObject({ origin: 'http://192.168.1.5:8080', expectedGeneration: 1 });
    expect(validateConnectionSelect({ origin: null, expectedGeneration: 0 })).toEqual({ origin: null, expectedGeneration: 0 });
  });

  it('rejects public plaintext origins and unknown fields', () => {
    expect(() => validateConnectionSelect({ origin: 'http://8.8.8.8:8080', expectedGeneration: 1 })).toThrow(/Plain HTTP/);
    expect(() => validateConnectionSelect({ origin: 'http://localhost:8080', expectedGeneration: 1, host: 'x' })).toThrow(/Unexpected field/);
  });

  it('rejects CR/LF and oversized tokens before probing', () => {
    const base = { profileId: 'p1', generation: 1 };
    expect(() => validateShareAuthorize({ ...base, frmToken: 'abc\r\nInjected: 1' })).toThrow(/invalid format/);
    expect(() => validateShareAuthorize({ ...base, frmToken: 'x'.repeat(4097) })).toThrow(/too long/);
  });

  it('accepts only a 32-hex permit ID for tunnel start', () => {
    expect(validateTunnelStart({ permitId: 'a'.repeat(32) })).toEqual({ permitId: 'a'.repeat(32) });
    expect(() => validateTunnelStart({ permitId: 'a'.repeat(31) })).toThrow(/missing or too long/);
    expect(() => validateTunnelStart({ permitId: 'a'.repeat(32), host: 'evil' })).toThrow(/Unexpected field/);
  });
});
