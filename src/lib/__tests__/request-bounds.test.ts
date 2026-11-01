/**
 * Bounded request/history tests.
 *
 * Requirements: REQ-018, REQ-019.
 * Oracle: oversized bodies/entities/nesting are rejected; retained history
 * honours the 5 s sample spacing, 720-sample and 1-hour limits.
 * Fixtures: synthetic Response streams and pure buffer inputs; controlled clock.
 */
import { describe, it, expect } from 'vitest';
import {
  FrmRequestError,
  MAX_ENTITIES,
  readBoundedBody,
  validateEndpointPayload,
  validatePayload,
} from '../request-bounds';
import { MAX_BUFFER_SAMPLES, MIN_SAMPLE_MS, appendBoundedSample, createBuffer } from '../useTimeBuffer';

describe('readBoundedBody', () => {
  it('reads a normal body and enforces the decoded byte cap while streaming', async () => {
    await expect(readBoundedBody(new Response('{"ok":true}'), 64)).resolves.toBe('{"ok":true}');
    const oversized = new Response('x'.repeat(128));
    await expect(readBoundedBody(oversized, 64)).rejects.toMatchObject({ code: 'too-large' });
  });

  it('ignores a lying Content-Length in the accepting direction', async () => {
    const response = new Response('abcdef', { headers: { 'content-length': '2' } });
    await expect(readBoundedBody(response, 64)).resolves.toBe('abcdef');
  });
});

describe('validatePayload', () => {
  it('accepts a representative FRM array', () => {
    expect(() => validatePayload([{ CircuitID: 1, PowerConsumed: 12.5, Name: 'A' }])).not.toThrow();
  });

  it('rejects non-object roots, non-finite numbers and excessive entities', () => {
    expect(() => validatePayload(null)).toThrow(FrmRequestError);
    expect(() => validatePayload(42)).toThrow(/unexpected data shape/);
    expect(() => validatePayload({ ratio: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
    expect(() => validatePayload(new Array(MAX_ENTITIES + 1).fill(0))).toThrow(/too many entities/);
  });

  it('requires an array shape for read endpoints', () => {
    expect(() => validateEndpointPayload('getPower', [])).not.toThrow();
    expect(() => validateEndpointPayload('getPower', {})).toThrow(/collection shape/);
    expect(() => validateEndpointPayload('getProdStats', { production: [] })).not.toThrow();
    expect(() => validateEndpointPayload('getProdStats', { other: 1 })).toThrow(/collection shape/);
  });

  it('rejects over-long strings and deep nesting', () => {
    expect(() => validatePayload({ Name: 'x'.repeat(5000) })).toThrow(/text field/);
    let deep: unknown = 1;
    for (let i = 0; i < 40; i += 1) deep = { nested: deep };
    expect(() => validatePayload(deep)).toThrow(/nested too deeply/);
  });
});

describe('bounded history', () => {
  it('skips samples closer than five seconds', () => {
    let buffer = createBuffer<number>();
    buffer = appendBoundedSample(buffer, 1, 1_000);
    buffer = appendBoundedSample(buffer, 2, 1_000 + MIN_SAMPLE_MS - 1);
    expect(buffer.entries.map((entry) => entry.data)).toEqual([1]);
    buffer = appendBoundedSample(buffer, 3, 1_000 + MIN_SAMPLE_MS);
    expect(buffer.entries.map((entry) => entry.data)).toEqual([1, 3]);
  });

  it('does not report truncation when nothing was evicted', () => {
    let buffer = createBuffer<number>();
    buffer = appendBoundedSample(buffer, 1, 0);
    buffer = appendBoundedSample(buffer, 2, MIN_SAMPLE_MS);
    expect(buffer.entries).toHaveLength(2);
    expect(buffer.truncated).toBe(false);
  });

  it('evicts the oldest samples at the 720-sample cap and marks truncation', () => {
    let buffer = createBuffer<number>();
    const start = 1_000_000;
    for (let i = 0; i < MAX_BUFFER_SAMPLES + 5; i += 1) {
      buffer = appendBoundedSample(buffer, i, start + i * MIN_SAMPLE_MS);
    }
    expect(buffer.entries).toHaveLength(MAX_BUFFER_SAMPLES);
    expect(buffer.truncated).toBe(true);
    expect(buffer.entries[0].data).toBe(5);
  });

  it('evicts on the accounted byte budget, including non-ASCII data', () => {
    let buffer = createBuffer<string>();
    buffer = appendBoundedSample(buffer, 'aaaa', 0, 12);
    buffer = appendBoundedSample(buffer, 'éééé', MIN_SAMPLE_MS, 12);
    expect(buffer.entries.map((entry) => entry.data)).toEqual(['éééé']);
    expect(buffer.truncated).toBe(true);
  });

  it('evicts entries older than one hour', () => {
    let buffer = createBuffer<number>();
    buffer = appendBoundedSample(buffer, 1, 0);
    buffer = appendBoundedSample(buffer, 2, 60 * 60 * 1000 + 1);
    expect(buffer.entries.map((entry) => entry.data)).toEqual([2]);
  });
});
