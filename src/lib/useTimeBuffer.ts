'use client';

import { useState, useEffect, useCallback } from 'react';
import { estimateSnapshotBytes } from './request-bounds';

export interface TimedEntry<T> {
  timestamp: number;
  data: T;
}

/** Maximum retained history window (contract section 4). */
export const MAX_BUFFER_MS = 60 * 60 * 1000;
/** Maximum retained samples per active panel. */
export const MAX_BUFFER_SAMPLES = 720;
/** Maximum accounted retained telemetry per active panel (64 MiB). */
export const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
/** Minimum spacing between retained samples. */
export const MIN_SAMPLE_MS = 5_000;

export interface BoundedBuffer<T> {
  entries: TimedEntry<T>[];
  bytes: number;
  truncated: boolean;
}

/** Creates an empty bounded buffer. */
export function createBuffer<T>(): BoundedBuffer<T> {
  return { entries: [], bytes: 0, truncated: false };
}

/**
 * Appends one snapshot while enforcing time, sample-count and byte limits.
 *
 * Inputs: current buffer, new data and the current time (injectable for tests).
 * Output: a new buffer; the oldest samples are evicted first. Samples closer
 * than five seconds to the previous one are skipped, so live polling and
 * retained history stay separate.
 * Invariant: `entries.length <= MAX_BUFFER_SAMPLES` and `bytes <= MAX_BUFFER_BYTES`.
 */
export function appendBoundedSample<T>(
  buffer: BoundedBuffer<T>,
  data: T,
  now: number,
  maxBytes = MAX_BUFFER_BYTES,
): BoundedBuffer<T> {
  const last = buffer.entries[buffer.entries.length - 1];
  if (last && now - last.timestamp < MIN_SAMPLE_MS) return buffer;

  const cutoff = now - MAX_BUFFER_MS;
  const entries = buffer.entries.filter((entry) => entry.timestamp > cutoff);
  let bytes = entries.reduce((sum, entry) => sum + estimateSnapshotBytes(entry.data), 0);
  entries.push({ timestamp: now, data });
  bytes += estimateSnapshotBytes(data);

  // Any time-, count- or byte-based eviction is surfaced to the UI.
  let truncated = buffer.truncated || entries.length !== buffer.entries.length + 1 || entries.length > MAX_BUFFER_SAMPLES;
  while (entries.length > MAX_BUFFER_SAMPLES) {
    const removed = entries.shift()!;
    bytes -= estimateSnapshotBytes(removed.data);
    truncated = true;
  }
  while (bytes > maxBytes && entries.length > 0) {
    const removed = entries.shift()!;
    bytes -= estimateSnapshotBytes(removed.data);
    truncated = true;
  }
  return { entries, bytes: Math.max(0, bytes), truncated };
}

/**
 * Stores timestamped snapshots of data and provides windowed queries.
 *
 * Each accepted data change is pushed into a buffer bounded to one hour, 720
 * samples and 64 MiB. Panels show live data separately; the buffer is only for
 * windowed views, so a selector never implies more coverage than was retained.
 */
export function useTimeBuffer<T>(data: T | null) {
  const [buffer, setBuffer] = useState<BoundedBuffer<T>>(() => createBuffer<T>());

  useEffect(() => {
    if (data !== null) {
      setBuffer((prev) => appendBoundedSample(prev, data, Date.now()));
    }
  }, [data]);

  /** All snapshots whose timestamp falls within [now - windowMs, now]. */
  const getWindowData = useCallback(
    (windowMs: number): T[] => {
      const cutoff = Date.now() - windowMs;
      return buffer.entries.filter((e) => e.timestamp >= cutoff).map((e) => e.data);
    },
    [buffer],
  );

  /** Average of mapFn(item) over the window. Returns 0 if no data. */
  const getWindowAverage = useCallback(
    (windowMs: number, mapFn: (item: T) => number): number => {
      const cutoff = Date.now() - windowMs;
      const entries = buffer.entries.filter((e) => e.timestamp >= cutoff);
      if (entries.length === 0) return 0;
      return entries.reduce((s, e) => s + mapFn(e.data), 0) / entries.length;
    },
    [buffer],
  );

  const first = buffer.entries[0]?.timestamp;
  const last = buffer.entries[buffer.entries.length - 1]?.timestamp;

  return {
    getWindowData,
    getWindowAverage,
    bufferSize: buffer.entries.length,
    retainedMs: first !== undefined && last !== undefined ? last - first : 0,
    truncated: buffer.truncated,
  };
}

/* ─── ProdStatItem helpers — average an array of snapshots into one ─── */

export interface ProdStatSnapshot {
  Name: string;
  ClassName: string;
  CurrentProd: number;
  MaxProd: number;
  CurrentConsumed: number;
  MaxConsumed: number;
}

/**
 * Given N snapshots of ProdStatItem[], merge them into a single
 * array where each item's rates are averaged across the window.
 */
/** A single data point for the production vs consumption time-series chart. */
export interface ProdTimePoint {
  timestamp: number;
  prod: number;
  cons: number;
}

/**
 * Extracts a time-series of production and consumption values for a specific
 * item from the buffered snapshots. Each snapshot is searched for the matching
 * ClassName, and if found, a { timestamp, prod, cons } point is emitted.
 * Points are sorted chronologically.
 *
 * @param snapshots - Chronological array of ProdStatItem[] snapshots from the buffer.
 * @param className - The ClassName of the item to track.
 * @returns Ordered array of time-points suitable for a line chart.
 */
export function extractItemTimeSeries(
  snapshots: ProdStatSnapshot[][],
  className: string,
): ProdTimePoint[] {
  // We pair each snapshot with an incrementing timestamp counter since we
  // don't have real timestamps per-snapshot in the averaged data. For the
  // live buffer (TimedEntry<T>[]), extraction happens in the component.
  return snapshots
    .map((batch, idx) => {
      const item = batch.find((i) => i.ClassName === className);
      if (!item) return null;
      return { timestamp: idx, prod: item.CurrentProd, cons: item.CurrentConsumed };
    })
    .filter((p): p is ProdTimePoint => p !== null);
}

export function averageProdStats(snapshots: ProdStatSnapshot[][]): ProdStatSnapshot[] {
  if (snapshots.length === 0) return [];
  const map = new Map<string, { sumProd: number; sumCons: number; count: number; maxProd: number; maxCons: number; name: string }>();

  for (const batch of snapshots) {
    for (const item of batch) {
      const key = item.ClassName;
      const existing = map.get(key) || { sumProd: 0, sumCons: 0, count: 0, maxProd: 0, maxCons: 0, name: item.Name };
      existing.sumProd += item.CurrentProd;
      existing.sumCons += item.CurrentConsumed;
      existing.maxProd = Math.max(existing.maxProd, item.MaxProd);
      existing.maxCons = Math.max(existing.maxCons, item.MaxConsumed);
      existing.count++;
      existing.name = item.Name;
      map.set(key, existing);
    }
  }

  return Array.from(map.entries()).map(([className, v]) => ({
    Name: v.name,
    ClassName: className,
    CurrentProd: v.sumProd / v.count,
    MaxProd: v.maxProd,
    CurrentConsumed: v.sumCons / v.count,
    MaxConsumed: v.maxCons,
  }));
}

/* ─── Power snapshot helpers ─── */

export interface PowerSnapshot {
  totalProd: number;
  totalConsumed: number;
  totalCapacity: number;
  totalMaxConsumed: number;
}

export function averagePowerStats(snapshots: PowerSnapshot[]): PowerSnapshot {
  if (snapshots.length === 0) return { totalProd: 0, totalConsumed: 0, totalCapacity: 0, totalMaxConsumed: 0 };
  const n = snapshots.length;
  return {
    totalProd: snapshots.reduce((s, x) => s + x.totalProd, 0) / n,
    totalConsumed: snapshots.reduce((s, x) => s + x.totalConsumed, 0) / n,
    totalCapacity: snapshots.reduce((s, x) => s + x.totalCapacity, 0) / n,
    totalMaxConsumed: snapshots.reduce((s, x) => s + x.totalMaxConsumed, 0) / n,
  };
}
