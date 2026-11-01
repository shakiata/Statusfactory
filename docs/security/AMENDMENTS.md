# Scope amendments to the adopted planning package

This file records owner instructions that changed the adopted plan after the
package was delivered. The numbered planning documents remain unchanged as
historical design records; the canonical register
(`data/security_plan.json`) and this file carry the effective scope.

## CHG-006 — OpenCode v2 is the only harness (2026-10-31)

**Origin:** owner instruction during the implementation session: "we are using
opencode. Forget codex. remove mention of codex and continue working towards the
goal."

**Decision:** Remove Codex from the operating-kit acceptance scope. G-00 harness
evidence now requires **OpenCode v2 only** (discovery, explicit invocation,
natural triggering, nested instructions, permissions, concurrency, fresh-session
continuity). No Codex CLI installation, configuration or test is required.

**Supersedes:** the two-harness matrix in `04_SKILL_AND_AGENT_DESIGNS.md`
section 6, the Codex rows in section 4, and the Codex role brief in
`templates/agent_guides.md` section 6. Those texts are retained as superseded
history.

**Affected IDs:** REQ-026 (harness verification), WP-00, G-00.

**Authority:** repository owner. This is a harness-scope decision, not a waiver
of any security contract.

**Unchanged:** all P1–P4 security contracts, gate evidence requirements and the
separate G-05 publication approval remain in force.
