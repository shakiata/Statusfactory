# Implementation authorization record

**Recorded:** 2026-10-31 · **Register revision before change:** 1.0.
**Authority:** repository owner instruction supplied with this working session
(the `/goal` implementation brief and the accompanying
`Statusfactory_Security_Review_2026-10-31.zip`).

## 1. Historical planning authorization (preserved)

The review package records that the planning phase authorized research,
isolated diagnostics and planning artifacts only:

```json
{ "planning": true, "implementation": false, "skill_installation": false,
  "publication": false, "live_mutation": false }
```

That record is historical. It is preserved unchanged in the canonical register
under `authorization.planning_history`. It is not a current prohibition on the
work authorized below.

## 2. New authorization for local implementation

The owner authorized:

- finding or cloning the public repository `https://github.com/shakiata/Statusfactory`;
- creating an isolated local remediation branch or worktree;
- ordinary reversible repository edits;
- adopting the designed repository-local skills, `AGENTS.md` files and
  documentation;
- local dependency resolution, installation, tests and builds after their
  prerequisite gates;
- creating local release artifacts and supporting evidence for review.

The owner did **not** authorize: purchases, global or personal skill
installation, production credentials, public tunnels, account or infrastructure
changes, messages to other people, public disclosures, pushing changes upstream,
publishing releases or deployment. Those require separate authorization.

## 3. Recorded operating facts at authorization

| Item | Observed value |
| --- | --- |
| Repository | `https://github.com/shakiata/Statusfactory` |
| Clone | `/home/james/repos/Statusfactory` |
| Origin HEAD at clone | `d0338043169b7af80cedacd2feb838bb705b16a5` (`1.5 release Bug fixes and improvments`) |
| Reviewed baseline | `d0338043169b7af80cedacd2feb838bb705b16a5` — **identical**, no intervening changes |
| Work branch | `security/remediation-2026-10-31` |
| Dirty state before edits | clean |
| OS | Ubuntu, Linux 7.0.0-42-generic, x86_64 |
| Build Node / npm | v22.22.2 / 10.9.7 |
| OpenCode | v2.1.1 |
| Codex CLI | **not installed** on `PATH` (a Codex desktop app state directory exists at `~/.codex`, but it provides no CLI). G-00 cannot pass without it. |
| Python (package validator) | 3.14.4 |
| Git | 2.53.0 |

## 4. Register change control

The register revision is incremented to **1.1** by this adoption. Changes:

- `authorization` gains `implementation_authorization` and preserves the
  historical planning flags under `planning_history`;
- `scope_history` gains `CHG-005` (implementation authorization);
- `work_packages` and `release_gates` are updated only with evidence produced by
  this implementation; unexecuted gates stay `not_run`.

Workbook cells remain proposals. Publication (G-05) remains separately
authorized and is **not** granted by this record.
