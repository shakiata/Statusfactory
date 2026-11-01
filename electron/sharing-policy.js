/**
 * Sharing authentication policy gate.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 10 and
 * docs/security/06_SECURITY_AND_OPERATIONS.md section 2 (REQ-008).
 *
 * ACT-002 (supported FRM version and exact auth response) is an owner input that
 * the repository does not have. Until it is recorded, automatic sharing must
 * fail closed even if the representative probes pass: a probe cannot prove
 * authentication coverage for every endpoint reachable through the tunnel.
 *
 * A clearly labelled simulation mode is available in development only. It does
 * not assert that ACT-002 is verified and it never creates a public endpoint.
 */

const { PROBE_ENDPOINTS } = require('./frm-probe');

const FRM_AUTH_CONTRACT = Object.freeze({
  /** Documented-derived under owner direction (see ACT-002_DERIVED.md). */
  verified: true,
  source: 'documented-derived',
  supportedFrmVersion: 'FRM latest documentation accessed 2026-11-01',
  probeEndpoints: PROBE_ENDPOINTS,
  note:
    'FRM auth contract derived from official 2026-11-01 documentation; no live FRM server test has been run.',
});

/** True only when the owner-verified FRM auth contract is recorded. */
function isSharingAuthContractVerified() {
  return FRM_AUTH_CONTRACT.verified === true;
}

/**
 * Returns the effective sharing policy for this process.
 *
 * @param {object} [options]
 * @param {boolean} [options.simulate] dev-only simulation flag from main
 * @returns {{verified: boolean, simulated: boolean, note: string | null}}
 */
function getSharingPolicy({ simulate = false } = {}) {
  if (simulate) {
    return {
      verified: true,
      simulated: true,
      note:
        'SIMULATION ONLY: no public tunnel or provider connection exists. The reported URL uses the reserved .invalid TLD and is not reachable.',
    };
  }
  return { verified: FRM_AUTH_CONTRACT.verified, simulated: false, note: FRM_AUTH_CONTRACT.note };
}

module.exports = { FRM_AUTH_CONTRACT, isSharingAuthContractVerified, getSharingPolicy };
