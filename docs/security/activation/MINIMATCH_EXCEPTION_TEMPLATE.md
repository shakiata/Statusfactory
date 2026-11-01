# Expiring exception template — GHSA-g3hv-75wg-m249 (minimatch)

The integrator must not approve this exception. Fill every field and record the
owner's decision in the canonical register before treating G-02 as excepted.

## Finding

- Advisory: `GHSA-g3hv-75wg-m249` — minimatch potential denial of service via
  globparts amplification, affected `<11.0.1`.
- Resolved paths: electron-builder/app-builder-lib/@electron/asar/glob,
  eslint-config-next plugins and related development/build tooling.
- Not present in the shipped application bundle; production audit is clean.
- Why not fixed: the current compatible parents (electron-builder 26.18.0,
  eslint 9 / eslint-config-next 15.5.28) require minimatch 3/5/9/10 APIs; a
  blanket 11 override would break v3 consumers. No compatible parent release was
  available at review time.

## Required exception fields

| Field | Value |
| --- | --- |
| Owner (accountable) | `<name>` |
| Scope | `<exact package paths / tooling only>` |
| Applicability evidence | `<why it is not reachable in shipped runtime>` |
| Compensating control | `<e.g. builds use reviewed inputs; no untrusted glob patterns>` |
| Expiry | `<YYYY-MM-DD>` |
| Review trigger | `<upstream release, advisory update, lockfile change>` |
| Owner decision | `<approved / rejected>` |
| Decision date | `<YYYY-MM-DD>` |

## Restrictions

- Do not use `npm audit fix --force`.
- Do not override minimatch globally to 11 without proving every parent works.
- Do not suppress the scanner or label the dependency clean.
- The exception expires automatically; G-02 returns to blocked until renewed.
