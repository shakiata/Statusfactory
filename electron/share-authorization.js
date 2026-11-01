/**
 * Share authorization sequencing.
 *
 * The FRM probe runs against a snapshot of the selected profile. The profile can
 * change while the probe is in flight, so a permit is issued only when the
 * current profile still matches the snapshot. This prevents an authenticated
 * probe for origin A from authorizing a tunnel to origin B.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 10
 * (REQ-008).
 */

/**
 * @param {object} input
 * @param {{id:string, origin:string, generation:number}} input.snapshot
 * @param {() => object | null} input.readCurrentProfile
 * @param {() => Promise<{ok:boolean, code?:string}>} input.probe
 * @param {(binding: object) => {id:string, expiresAt:number}} input.issuePermit
 * @param {number} input.senderId
 * @returns {Promise<{ok:true, permitId:string, expiresAt:number}
 *   | {ok:false, code:string}>}
 */
async function authorizeShare({ snapshot, readCurrentProfile, probe, issuePermit, senderId }) {
  const result = await probe();
  if (!result.ok) return { ok: false, code: result.code || 'probe-failed' };

  const current = readCurrentProfile();
  if (
    !current ||
    current.id !== snapshot.id ||
    current.generation !== snapshot.generation ||
    current.origin !== snapshot.origin
  ) {
    return { ok: false, code: 'profile-conflict' };
  }

  const permit = issuePermit({
    senderId,
    profileId: snapshot.id,
    origin: snapshot.origin,
    generation: snapshot.generation,
  });
  return { ok: true, permitId: permit.id, expiresAt: permit.expiresAt };
}

module.exports = { authorizeShare };
