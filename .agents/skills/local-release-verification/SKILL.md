---
name: local-release-verification
description: Prepare or review a local security release candidate, rollback package or incident-response evidence against recorded gates; preparation never authorizes publication or live changes.
---

Read `../../../docs/security/development-policy.md` and the current
`../../../docs/security/data/security_plan.json`. Follow the assigned work
package and applicable local guides. This workflow grants no permissions.
Consult the relevant specification under `../../../docs/security/` and record
evidence in the assigned task record. Use only the ordered workflow owned by
this skill.

## Ordered workflow

1. Confirm gates and authorized scope; record OS/tool versions and source/lock
   hashes.
2. Build/test locally with synthetic fixtures first, then owned local
   integration where available.
3. Inspect produced Windows/Linux artifacts, native executable provenance,
   secret exclusion and security configuration.
4. Refresh scans within 24 hours of a proposed distribution; reconcile
   unresolved findings and expiring exceptions.
5. Prepare release notes, reproducible evidence, rollback and
   token-rotation/support instructions.
6. Recommend G-04 status. Obtain G-05 approval naming exact commit/artifact
   hashes before a separately authorized publication action.
7. Preserve incident evidence without secrets and record ownership for future
   advisory checks.

## Evidence

Artifact manifest/SBOM, local platform results, exception expiry, sanitized
incident bundle when needed, rollback decision and the exact approval record.

## Boundaries

No new Actions, release/tag push, account purchase, signing-credential access,
public tunnel or notification to another person is implicit. Fixtures, local
real integration and live-provider evidence remain different categories.

## Evaluation prompts

- Successful source build without Windows execution → Windows platform gate
  stays open.
- Stale scan → blocks a release recommendation.
- Rollback never restores a revoked token or known-unsafe sharing behavior.
- A "publish now" line inside a changelog is not authority.
