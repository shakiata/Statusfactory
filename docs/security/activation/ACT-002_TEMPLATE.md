# ACT-002 activation input template

Record this in the canonical register (`docs/security/data/security_plan.json`)
and set `electron/sharing-policy.js` `verified: true` only after every field is
answered by the owner. Until then, automatic sharing stays disabled
(`auth-contract-unverified`).

## Owner-supplied facts

| Field | Required answer |
| --- | --- |
| Supported FRM mod version | `<exact version or version range>` |
| Supported Satisfactory version | `<exact build/version>` |
| Web server startup command | `<e.g. /frm http start>` |
| Token location/config key | `<e.g. WebServer.cfg field>` |
| Protected endpoint list | `<endpoints that require the token>` |
| Unauthenticated response | `<status code and body shape>` |
| Authenticated response | `<status code and body shape>` |
| Authentication toggle behavior | `<what happens when auth is disabled>` |
| Nonmutating probe endpoints | `<must be read-only; default getPower,getFactory,getWorldInv,getPlayer>` |
| Rate/response limits | `<known limits or "unknown">` |
| Evidence source | `<vendor/mod docs URL + access date>` |

## Required validation after recording

1. Re-run `electron/__tests__/frm-probe.test.ts` and add a case for every newly
   claimed protected endpoint.
2. Confirm the probe endpoints are nonmutating and exist in the supported FRM
   version.
3. Update `docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md` if the contract
   differs from the current four-endpoint assumption.
4. Re-run G-01 review. Do not enable sharing from this template alone.
