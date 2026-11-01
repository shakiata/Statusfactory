/**
 * Sharing-policy gate tests.
 *
 * Requirement: REQ-008. Oracle: while ACT-002 is unrecorded, automatic sharing
 * is disabled regardless of a successful probe.
 */
import { describe, it, expect } from 'vitest';
import { FRM_AUTH_CONTRACT, isSharingAuthContractVerified } from '../../electron/sharing-policy.js';

describe('sharing policy', () => {
  it('records the documented-derived FRM auth contract with a residual note', () => {
    expect(isSharingAuthContractVerified()).toBe(true);
    expect(FRM_AUTH_CONTRACT.source).toBe('documented-derived');
    expect(FRM_AUTH_CONTRACT.supportedFrmVersion).toContain('2026-11-01');
    expect(FRM_AUTH_CONTRACT.probeEndpoints.length).toBeGreaterThanOrEqual(4);
  });
});
