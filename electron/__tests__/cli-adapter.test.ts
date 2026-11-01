/**
 * CLI adapter tests with a fake child process.
 *
 * Requirements: REQ-009, REQ-012.
 * Oracle: readiness accepts only structured HTTPS URLs; a readiness failure
 * terminates the owned child and reports whether closure was observed; a
 * synchronous spawn failure is distinguishable from an unknown child.
 * Fixture: EventEmitter child double; no real executable.
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createCliAdapter, pidExists } from '../../electron/tunnel/cli-adapter.js';

/** Minimal ChildProcess double with stdout/stderr streams. */
function fakeChild(pid = 4321) {
  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('CLI adapter', () => {
  it('resolves readiness only from a structured HTTPS URL', async () => {
    const child = fakeChild();
    const adapter = createCliAdapter({ spawnImpl: () => child, readinessMs: 1000 });
    const pending = adapter.start({ executablePath: '/opt/ngrok', target: 'localhost:8080', providerToken: 'p' });
    child.stdout.emit('data', Buffer.from('{"url":"http://insecure.example"}\n'));
    child.stdout.emit('data', Buffer.from('{"msg":"started tunnel","url":"https://ok.ngrok.app"}\n'));
    await expect(pending).resolves.toMatchObject({ pid: 4321, url: 'https://ok.ngrok.app' });
  });

  it('terminates the owned child and reports confirmed closure on readiness timeout', async () => {
    const child = fakeChild();
    const killImpl = vi.fn(() => child.emit('exit', 0, 'SIGTERM'));
    const adapter = createCliAdapter({ spawnImpl: () => child, killImpl, readinessMs: 20 });
    const failure = await adapter.start({ executablePath: '/opt/ngrok', target: 'localhost:8080' })
      .catch((error) => error);
    expect(failure.code).toBe('readiness-timeout');
    expect(failure.spawned).toBe(true);
    expect(failure.confirmedClosure).toBe(true);
  });

  it('treats EPERM as process-exists and only ESRCH as absence', () => {
    const denied = Object.assign(new Error('denied'), { code: 'EPERM' });
    const absent = Object.assign(new Error('gone'), { code: 'ESRCH' });
    expect(pidExists(1, () => { throw denied; })).toBe(true);
    expect(pidExists(1, () => { throw absent; })).toBe(false);
  });

  it('marks a synchronous spawn failure as never spawned', async () => {
    const adapter = createCliAdapter({ spawnImpl: () => { throw new Error('ENOENT'); }, readinessMs: 20 });
    const failure = await adapter.start({ executablePath: '/opt/ngrok', target: 'localhost:8080' })
      .catch((error) => error);
    expect(failure.spawned).toBe(false);
  });
});
