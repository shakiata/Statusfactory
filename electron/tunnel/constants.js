/**
 * Shared tunnel constants.
 *
 * Values are the selected initial limits from
 * docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 7. They are test
 * targets, not measurements.
 */

/** Explicit lifecycle states; no other value may be reported to the renderer. */
const STATES = Object.freeze({
  IDLE: 'idle',
  STARTING: 'starting',
  ACTIVE: 'active',
  STOPPING: 'stopping',
  FAILED_CLOSED: 'failed_closed',
  CLOSURE_UNKNOWN: 'closure_unknown',
});

/** Ordinary request/authorization-probe deadline in milliseconds. */
const REQUEST_DEADLINE_MS = 15_000;
/** Startup readiness deadline in milliseconds. */
const READINESS_MS = 15_000;
/** Graceful termination window in milliseconds. */
const GRACE_MS = 5_000;
/** Post-termination confirmation window in milliseconds. */
const CONFIRM_MS = 5_000;
/** Maximum retained child output tail in bytes. */
const MAX_LOG_TAIL_BYTES = 64 * 1024;
/** Share permit lifetime in milliseconds (at most 60 s). */
const PERMIT_TTL_MS = 60_000;
/** Maximum accepted FRM token length for the authorize probe. */
const MAX_TOKEN_CHARS = 4_096;

module.exports = {
  STATES,
  REQUEST_DEADLINE_MS,
  READINESS_MS,
  GRACE_MS,
  CONFIRM_MS,
  MAX_LOG_TAIL_BYTES,
  PERMIT_TTL_MS,
  MAX_TOKEN_CHARS,
};
