/**
 * Sharing-policy gate tests.
 *
 * Requirement: REQ-008. Oracle: while ACT-002 is unrecorded, automatic sharing
 * is disabled regardless of a successful probe.
 */
import { describe, it, expect } from 'vitest';
import { FRM_AUTH_CONTRACT, isSharingAuthContractVerified } from '../../electron/sharing-policy.js';

describe('sharing policy', () => {
  it('fails closed until the owner records the FRM auth contract', () => {
    expect(isSharingAuthContractVerified()).toBe(false);
    expect(FRM_AUTH_CONTRACT.supportedFrmVersion).toBeNull();
    expect(FRM_AUTH_CONTRACT.probeEndpoints.length).toBeGreaterThanOrEqual(4);
  });
});
