# Statusfactory security review and remediation package

**Review date:** October 31, 2026, America/Toronto. **Package revision:** 1.0.

**Repository:** https://github.com/shakiata/Statusfactory  
**Pinned source:** `d0338043169b7af80cedacd2feb838bb705b16a5`  
**Lockfile SHA-256:** `237ef37e1b6d3095475e61e10a570ffe043faef3f5aec8f7d5184c22f7ee565f`

## Purpose and conclusion

This package gives the repository owner an evidence-backed security review and a bounded implementation plan. The immediate priorities are credential separation, deterministic public-tunnel shutdown, a supported Electron runtime, transport/credential boundaries and trustworthy build inputs. The existing static dashboard architecture can be retained.

The full lockfile checks returned **167 unique GHSA advisories, containing 165 unique CVE aliases and three advisories without a CVE alias**. They directly match 36 installed package/version pairs across 30 package names. npm's separate count is 66 affected package families, including packages whose dependencies are vulnerable. These are different units. Neither count means that every finding is reachable in the shipped application.

Nine source/build findings are rated Medium in this review. Some are reproduced control-flow defects; others are conditional security-boundary weaknesses. No unauthenticated application RCE, active compromise or malicious release was demonstrated. Read the exact prerequisites and evidence before forwarding individual findings.

## Authorization and current state

The requester authorized research, isolated diagnostics and planning artifacts. This package does **not** implement fixes, install skills, create application scaffolding, purchase services, change infrastructure, publish findings, open issues or send the report to the owner. All implementation and release gates remain unperformed. A future agent needs the owner's implementation instruction before editing application code; publication remains a separate action.

The review fetched all 94 text files at the immutable commit and verified their Git blob hashes. The checkout is a text snapshot without `.git`; binary assets were inventoried, not executed. The dependency audit used copied manifests with lifecycle scripts disabled. Local inert diagnostics used dummy credentials and fake subprocesses. No FRM instance or released Windows/Linux binary was run.

## Reading order and artifact map

| File | What it answers |
| --- | --- |
| `09_SECURITY_REVIEW.md` / `Statusfactory_Security_Review.pdf` | What is wrong, how it was checked, and what the owner should prioritize |
| `01_MASTER_PLAN.md` | Scope, selected decisions, tradeoffs, exclusions and effort |
| `02_DOMAIN_AND_PRODUCT_CONTRACTS.md` | Exact target behavior for credentials, transport, tunnels and bounded data |
| `03_ARCHITECTURE_AND_REPOSITORY.md` | Existing/proposed boundaries, ownership and dependency directions |
| `04_SKILL_AND_AGENT_DESIGNS.md` | Portable workflow designs, instruction templates and harness checks |
| `05_DESIGN_AND_ACCESSIBILITY.md` | Security-related UI states, labels, keyboard behavior and recovery |
| `06_SECURITY_AND_OPERATIONS.md` | Security controls, local validation, release, response and recovery runbooks |
| `07_IMPLEMENTATION_ROADMAP.md` | Ordered work packages, acceptance evidence, gates and stop conditions |
| `08_FRESH_CHAT_HANDOFF.txt` | Ready-to-paste owner/agent handoff |
| `10_PLANNING_VALIDATION.md` | Artifact checks actually performed and implementation checks still pending |
| `data/security_plan.json` | Canonical requirements, decisions, assumptions, owners, work, gates and change history |
| `data/all_advisories.json` / `data/all_advisories.csv` | Every returned advisory, aliases, installed versions, paths, ranges and contextual triage |
| `data/dependency_inventory.json` | Complete locked dependency inventory |
| `evidence/dependencies/embedded-node-version-matches.json` | Separately labelled embedded-Node version matches requiring binary/backport analysis |
| `acceptance_tracker.xlsx` | Editable proposed status/evidence updates, review gates, dependency appendix and labor model |
| `evidence/` | Raw scanner records, advisory snapshots, hashes and isolated diagnostic results |
| `templates/agent_guides.md` | Proposed guides and role adapters; no installed skills |
| `diagrams/` | Exact trust-boundary and tunnel-state diagrams and manifest |
| `tools/validate_planning_package.py` | Actual local planning-artifact validator; it does not run the application |
| `SHA256SUMS.txt` | Integrity manifest for the final files inside the ZIP |

The ZIP contains the complete package. No source-code copy or dependency cache is required to use the report. Immutable upstream URLs and evidence hashes preserve traceability.

## First implementation task

After the owner authorizes implementation, begin **WP-00**. Compare the owner checkout with the pinned commit, preserve unrelated work, read the canonical register and current local instructions, record the exact OpenCode v2/Codex versions, and verify the operating kit in disposable fixtures. Do not claim harness portability from documentation alone. Then run P1 containment work and P2 dependency repair in separate owned areas, integrating through one reviewer.

## How to edit the tracker

`data/security_plan.json` is authoritative. Workbook input cells contain **proposals**, not release approval. The integrator imports proposed rows by stable ID and package revision, verifies evidence and resolves stale/conflicting edits, increments the canonical revision and regenerates derived views. A reviewer name or a green formula is not proof that a test ran. Unknown statuses and missing evidence must keep a gate open.

## Remaining activation inputs

The owner must supply actual harness versions, supported OS/test machines, FRM/mod version and authentication behavior, a trusted exact ngrok CLI artifact, signing/distribution policy and authority for implementation/publication. These inputs do not prevent review or documentation. They prevent claims of runtime compatibility, fixed binary integrity or completed release approval.

Source facts come from the pinned repository, preserved scans and the source register. Performance/resource numbers and labor estimates are selected planning targets until measured. The review is a dated inventory of known advisories, not a guarantee against unpublished vulnerabilities.
