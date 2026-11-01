---
name: dependency-triage
description: Review a lockfile change, newly disclosed advisory or release candidate for exact-version vulnerability exposure and compatible remediation, distinguishing native, runtime, build and development applicability.
---

Read `../../../docs/security/development-policy.md` and the current
`../../../docs/security/data/security_plan.json`. Follow the assigned work
package and applicable local guides. This workflow grants no permissions.
Consult the relevant specification under `../../../docs/security/` and record
evidence in the assigned task record. Use only the ordered workflow owned by
this skill.

## Ordered workflow

1. Inventory direct/transitive, development/build and native-runtime paths
   separately.
2. Deduplicate aliases while preserving every affected installed version and
   path; distinguish scanner metavulnerabilities from distinct advisories.
3. Verify affected/fixed ranges and withdrawal status in primary sources; record
   access dates.
4. Classify reachability for static export, development server, build tools and
   packaged Electron. Mark unknowns explicitly.
5. Select the smallest compatible family update or replacement consistent with
   ADR-001/ADR-004/ADR-010; resolve exact versions in an isolated worktree.
6. Rerun both scans (npm audit and OSV), relevant tests/builds and packaged
   inventory; submit residual exceptions with owner, evidence, compensating
   control and expiry.

## Evidence

Dependency/advisory register, before/after lock hashes, raw scan output and exit
status, applicability reasoning, exact candidate/resolved/shipped distinction
and a G-02 recommendation.

## Boundaries

Never run blind `npm audit fix --force`, unknown lifecycle scripts or live
exploit attempts. Package downloads/build scripts require the authorized
implementation environment. A critical server-only advisory is not
automatically a remotely exploitable static-page finding. Do not self-approve an
expiry exception.

## Evaluation prompts

- Same GHSA through two paths → one advisory with two paths.
- Vulnerable dev dependency → retained in inventory with build/dev exposure.
- Unsupported Electron runtime → release issue even when npm audit is quiet.
- A proposed patch is not labelled deployed.
