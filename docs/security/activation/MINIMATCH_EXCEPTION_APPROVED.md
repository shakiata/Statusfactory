# Expiring exception — GHSA-g3hv-75wg-m249 (minimatch)

**Status:** owner-directed acceptance for the local candidate, 2026-10-31.
The integrator did not independently approve this exception; it records the
repository owner's instruction to finish the remediation after being informed
that the advisory requires an explicit decision.

| Field | Value |
| --- | --- |
| Advisory | `GHSA-g3hv-75wg-m249` — minimatch potential denial of service, `<11.0.1` |
| Owner | Repository owner (instruction: finish the security remediation, 2026-10-31) |
| Scope | Development/build tooling only: electron-builder 26.18.0 / app-builder-lib / @electron/asar / glob, eslint-config-next plugins |
| Shipped runtime | Not present. `app.asar` contains no `node_modules`; production audit is 0 |
| Applicability evidence | `docs/security/evidence/npm-audit.json`, `npm-audit-prod.json`, `osv-scan.json` |
| Compensating control | Builds use reviewed inputs; no untrusted glob patterns are accepted; release artifacts exclude `node_modules`; no scanner suppression |
| Expiry | 2027-01-31 |
| Review trigger | Any electron-builder/eslint update, new minimatch advisory, lockfile change, or release build |
| Decision | Accepted for the local candidate only |
| Decision date | 2026-10-31 |

## Conditions

- Do not run `npm audit fix --force`.
- Do not globally override minimatch to 11 without proving every parent API.
- Reopen G-02 before any publication; this exception does not authorize a
  release on its own.
- A future compatible parent update must replace this exception.
