/**
 * Bounded response reading and validation for the FRM client.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 4
 * (REQ-018). All values are selected initial defaults and are covered by
 * tests in `src/lib/__tests__/request-bounds.test.ts`.
 */

/** Initial end-to-end deadline for connection, headers and body. */
export const REQUEST_DEADLINE_MS = 15_000;
/** Maximum decoded response body accepted from FRM. */
export const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
/** Maximum top-level entities accepted from one endpoint. */
export const MAX_ENTITIES = 50_000;
/** Maximum length of a general textual field. */
export const MAX_STRING_CODEPOINTS = 4_096;
/** Maximum length of a name or identifier field. */
export const MAX_NAME_CHARS = 256;
/** Maximum JSON nesting depth. */
export const MAX_JSON_DEPTH = 32;
/** Maximum total nodes visited during validation (CPU bound). */
export const MAX_JSON_NODES = 500_000;

/** Typed request failure used by the UI to show a recoverable category. */
export class FrmRequestError extends Error {
  /**
   * @param code stable machine category shown to the UI
   * @param message safe, token-free explanation
   * @param status optional HTTP status
   */
  constructor(
    public readonly code:
      | 'invalid-endpoint'
      | 'timeout'
      | 'aborted'
      | 'too-large'
      | 'malformed'
      | 'schema'
      | 'redirect'
      | 'auth'
      | 'rate-limit'
      | 'transport'
      | 'chat-in-flight',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'FrmRequestError';
  }
}

/**
 * Reads a response body while enforcing a hard decoded byte limit.
 * A streaming reader stops and aborts at the boundary; Content-Length alone is
 * never trusted.
 *
 * @param response fetch Response
 * @param maxBytes inclusive limit
 * @returns decoded UTF-8 text
 * @throws FrmRequestError('too-large') when the body exceeds the limit
 */
export async function readBoundedBody(
  response: Response,
  maxBytes = MAX_RESPONSE_BYTES,
): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    // Stop the transfer rather than merely refusing to read it.
    await response.body?.cancel().catch(() => {});
    throw new FrmRequestError('too-large', 'The server response is larger than the supported limit.');
  }
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new FrmRequestError('too-large', 'The server response is larger than the supported limit.');
    }
    return new TextDecoder().decode(buffer);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new FrmRequestError('too-large', 'The server response is larger than the supported limit.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock?.();
  }
}

/**
 * Validates a decoded JSON value without recursion.
 *
 * Enforces: object/array root, finite numbers, bounded string lengths, bounded
 * array sizes, bounded nesting depth and a bounded node count. It deliberately
 * does not enforce endpoint-specific required fields; panels validate the
 * fields they consume.
 *
 * @throws FrmRequestError('schema') on any violation
 */
export function validatePayload(value: unknown): void {
  if (value === null || typeof value !== 'object') {
    throw new FrmRequestError('schema', 'The server returned an unexpected data shape.');
  }

  const stack: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 0 }];
  let nodes = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > MAX_JSON_NODES) {
      throw new FrmRequestError('schema', 'The server response is too complex to validate.');
    }
    if (current.depth > MAX_JSON_DEPTH) {
      throw new FrmRequestError('schema', 'The server response is nested too deeply.');
    }

    const node = current.node;
    if (typeof node === 'string') {
      if (node.length > MAX_STRING_CODEPOINTS) {
        throw new FrmRequestError('schema', 'A text field in the response is too long.');
      }
      continue;
    }
    if (typeof node === 'number') {
      if (!Number.isFinite(node)) {
        throw new FrmRequestError('schema', 'The response contains a non-finite number.');
      }
      continue;
    }
    if (node === null || typeof node === 'boolean') continue;
    if (Array.isArray(node)) {
      if (node.length > MAX_ENTITIES) {
        throw new FrmRequestError('schema', 'The response contains too many entities.');
      }
      for (const item of node) stack.push({ node: item, depth: current.depth + 1 });
      continue;
    }
    if (typeof node === 'object') {
      const record = node as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (key.length > MAX_NAME_CHARS) {
          throw new FrmRequestError('schema', 'A field name in the response is too long.');
        }
        stack.push({ node: record[key], depth: current.depth + 1 });
      }
      continue;
    }
    // functions/symbols/undefined cannot come from JSON, but reject defensively.
    throw new FrmRequestError('schema', 'The response contains an unsupported value.');
  }
}

/**
 * Validates the top-level collection shape for a known FRM read endpoint.
 *
 * Panels consume arrays; accepting `{}` would cast malformed valid JSON to a
 * panel's expected type. `getProdStats` is also accepted as an object containing
 * a `production` array for FRM versions that wrap the collection.
 *
 * @throws FrmRequestError('schema') when the shape is not usable
 */
export function validateEndpointPayload(endpointName: string, value: unknown): void {
  if (Array.isArray(value)) return;
  if (
    endpointName === 'getProdStats' &&
    value !== null &&
    typeof value === 'object' &&
    Array.isArray((value as { production?: unknown }).production)
  ) {
    return;
  }
  throw new FrmRequestError('schema', 'The server returned an unexpected collection shape.');
}

/**
 * Approximate retained size of one snapshot for history budgeting.
 * Uses JSON length as a stable estimate; it is not an exact memory measurement.
 */
export function estimateSnapshotBytes(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return 0;
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(json).byteLength;
    return json.length;
  } catch {
    return MAX_RESPONSE_BYTES;
  }
}
