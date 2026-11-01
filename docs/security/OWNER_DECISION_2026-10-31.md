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
   - ACT-002 (supported FRM version and exact endpoint/auth contract);
   - a trusted ngrok CLI artifact and provider closure test;
   - Windows packaged execution;
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
| `GHSA-g3hv-75wg-m249` minimatch `<11.0.1` in dev/build tooling | Accepted for this local candidate only; not shipped; must be revisited for a release. No scanner suppression. |
| No ACT-002 / live FRM auth contract | Sharing disabled; simulated policy labelled. |
| No real CLI artifact / provider closure proof | Sharing disabled; adapter fails closed. |
| Windows not executed | Linux artifact only; Windows remains unverified. |
| Sandboxed Electron not validated on this host | GUI smoke used `--no-sandbox` for visual inspection only; not security evidence. |
| Unsigned artifacts | Checksums identify bytes only; distribution decision deferred. |
| Broad CSP `connect-src http: https:` | Documented compatibility residual; origin binding and redirect rejection are enforced in the client. |

## Effect on gates

G-01, G-02 and G-04 are closed **with residual risk** for this local candidate,
not marked as passed. G-03 remains a source pass-with-findings. G-05 remains not
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
