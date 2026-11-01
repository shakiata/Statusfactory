# Owner decision — finish local remediation under simulation

**Date:** 2026-10-31 · **Authority:** repository owner instruction in this
session: no ACT-002, CLI artifact, Windows or provider account are available;
simulate from the endpoints and finish the security remediation.

## Decision

1. The **local remediation is complete** for owner review. Source contracts,
   tests, Linux packaging, SBOM and evidence are delivered on branch
   `security/remediation-2026-10-31`.
2. Real-world verification that requires resources the owner does not have is
   **deferred**, not claimed:
   - a live FRM server/auth-response test (the contract is documented-derived);
   - a real provider closure test (the CLI artifact is pinned and its Linux
     spawn/teardown path is verified);
   - Windows packaged execution (the portable artifact is cross-built only);
   - a sandboxed Electron GUI run on a correctly configured host;
   - release signing/provenance.
3. **Automatic public sharing remains disabled in normal and packaged builds.**
   The dev-only simulator is labelled, uses a reserved `.invalid` URL, creates no
   process or socket, and is not available in packaged builds.
4. **Publication, deployment, pushing upstream and credential rotation remain
   separately unauthorized.** G-05 is not approved by this decision.
5. The dev-only simulation and loopback fixture count as local integration
   evidence only. They are not provider, platform, compatibility or security
   certification.

## Accepted residual risks (owner-directed, local candidate)

| Residual | Disposition |
| --- | --- |
| `GHSA-g3hv-75wg-m249` minimatch `<11.0.1` in dev/build tooling | Formal exception recorded to 2027-01-31; not shipped; no scanner suppression. |
| ACT-002 documented-derived, no live server test | Runtime probe still required before a permit; live test deferred. |
| No real provider closure proof | ngrok 3.39.13 Linux/Windows digests pinned; Linux spawn/teardown verified; provider test deferred. |
| Windows not executed | Linux artifact only; Windows remains unverified. |
| Sandboxed Electron not validated on this host | GUI smoke used `--no-sandbox` for visual inspection only; not security evidence. |
| Unsigned artifacts | Checksums identify bytes only; distribution decision deferred. |
| Broad CSP `connect-src http: https:` | Documented compatibility residual; origin binding and redirect rejection are enforced in the client. |

## Effect on gates

G-01 is **passed**. G-02 is **passed with a platform gap** (Windows execution
not run). G-04 remains **blocked** (Windows execution, sandboxed Electron, live
provider closure). G-03 remains a source pass-with-findings. G-05 remains not
run. A future release must reopen the deferred items and obtain explicit
approval before distribution.

## Reproduction

```bash
npm test                 # 24 files / 230 tests
npm run build            # static export + CSP
npm run sim:frm          # synthetic FRM server (separate terminal)
STATUSFACTORY_TUNNEL_SIMULATOR=1 npm run electron:dev
```

Synthetic token: `sim-token-not-a-secret`. Simulated URL:
`https://simulated.invalid` (not reachable).
