---
name: boundary-hardening
description: Implement or review an authorized network, credential, IPC, process, persistence, rendering or configuration change with meaningful tests, reuse and owning documentation. Do not use it to justify unrelated rewrites.
---

Read `../../../docs/security/development-policy.md` and the current
`../../../docs/security/data/security_plan.json`. Follow the assigned work
package and applicable local guides. This workflow grants no permissions.
Consult the relevant specification under `../../../docs/security/` and record
evidence in the assigned task record. Use only the ordered workflow owned by
this skill.

## Ordered workflow

1. Read the relevant domain contract (`02_DOMAIN_AND_PRODUCT_CONTRACTS.md`) and
   trace untrusted input to side effects and outputs.
2. Search existing helpers/callers. Decide reuse, compatible extension or
   justified extraction; record the decision.
3. Define one observable success/failure oracle per changed requirement before
   coding.
4. Implement only assigned paths after authorization; validate on the
   privileged side of the boundary, not only in the UI.
5. Add isolated positive/adversarial tests with controlled clocks/barriers and
   useful function comments.
6. Update local README/`AGENTS.md`, configuration/recovery documentation and the
   changed contracts.
7. Submit the diff, test evidence and residual risks to another reviewer;
   resolve concrete failures.

## Evidence

Small reviewed patch, requirement-linked tests, migration/recovery evidence and
synchronized documentation.

## Boundaries

Do not expose a real game server, use real tokens in tests, disable Electron web
security, or loosen a control to make a test pass. Session-only tokens are
selected for this release; protected persistence is later scope.

## Evaluation prompts

- Redirect fixture proves zero credential-bearing target requests.
- A Stop-during-Start barrier proves no late tunnel survives.
- A delayed A→B connection result is discarded.
- A test asserting only an internal mock call count is insufficient unless the
  count protects an externally meaningful invariant.
- An existing parser is reused instead of duplicated in API Explorer.
