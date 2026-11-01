# Implementation roadmap

This roadmap is derived from `data/security_plan.json`, revision 1.0. All application work packages are **not started** and all release gates are **not run**. Planning-artifact validation is reported separately.

## Phase summary

| Phase | Outcome | Gate |
| --- | --- | --- |
| P0 | Operating kit and baseline | G-00 |
| P1 | Contain credential and tunnel exposure | G-01 |
| P2 | Repair the complete dependency and native-binary graph | G-02 |
| P3 | Harden connection, storage, input and UI behavior | G-03 |
| P4 | Verify local release candidates | G-04 |
| P5 | Approve distribution and maintain | G-05 |

## Exact first task: WP-00

Read `00_START_HERE.md`, `data/security_plan.json`, `09_SECURITY_REVIEW.md`, `04_SKILL_AND_AGENT_DESIGNS.md` and current repository/local AGENTS. In the owner checkout, inspect `git status --short`, `git rev-parse HEAD`, `node --version`, `npm --version`, `opencode --version` and `codex --version`. These are inspection commands, not proof that tools are installed here. The review snapshot itself has no Git directory. Record the actual values and preserve unrelated changes.

Install the designed repo-local operating kit only under the owner's new implementation instruction. Preserve useful existing `.opencode` domain guidance, remove superseded unsafe patterns, and validate V2 schema rather than assuming V1 syntax is accepted. Run each harness-evaluation case from a fresh disposable fixture. Both tool results are required before claiming portability. No new application scaffold is needed.

## Task packages

### P0: Operating kit and baseline

Read-only checks can begin immediately; local kit installation requires the owner's implementation instruction. Record both tool versions and source differences. Do not let old generated project instructions authorize unsafe behavior.

#### WP-00 - Establish operating kit and verified baseline

**Owner:** Integrator. **Dependencies:** None. **Exit gate:** G-00. **Requirements:** REQ-001, REQ-005, REQ-023, REQ-025, REQ-026, REQ-027, REQ-028, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036.

**Implementation work:** Read 00, the canonical register, findings and local AGENTS; record source SHA, both CLI versions and dirty worktree. Install only repo-local guide/skill files after implementation authorization. Run the harness evaluation matrix in disposable fixtures. Assign disjoint work areas.

**Acceptance oracle:** Both actual harnesses discover the canonical workflows, respect deny rules, load nested guidance and resume a fresh handoff. Preserve existing unrelated edits. No application code is changed by this package.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 4/8/12 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

### P1: Contain credential and tunnel exposure

Once WP-00 passes and local implementation is authorized, separate credentials and make sharing fail closed. Work on IPC and lifecycle in owned files with integration checkpoints.

#### WP-01 - Separate credentials and restrict public sharing

**Owner:** Desktop implementer. **Dependencies:** WP-00. **Exit gate:** G-01. **Requirements:** REQ-007, REQ-008.

**Implementation work:** Remove FRM-token flow into ngrok auth configuration/argv. Separate the FRM credential from provider account credentials in types, UI and main-process configuration. Refuse automatic public sharing until selected FRM authentication and target are verified; document complete API exposure.

**Acceptance oracle:** Dummy FRM token cannot reach ngrok options, argv, logs or provider configuration. Empty/failed FRM authentication blocks public sharing. Normal private FRM connections still work.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 4/8/12 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

#### WP-02 - Make tunnel lifecycle serialized and observable

**Owner:** Desktop implementer. **Dependencies:** WP-01. **Exit gate:** G-01. **Requirements:** REQ-009.

**Implementation work:** Replace multiple global/process paths with one tunnel adapter and explicit state machine. Serialize start/stop, retain ownership until child exit, abort starts on Stop, bound output, and kill owned process trees on failure and shutdown.

**Acceptance oracle:** Timeout, exit, cancellation, concurrent starts and stop-during-start cannot leave an untracked tunnel. UI never reports stopped while closure is unconfirmed. Mocks plus local real-process tests pass.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 6/12/20 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

#### WP-03 - Constrain Electron IPC and navigation

**Owner:** Desktop implementer. **Dependencies:** WP-00. **Exit gate:** G-01. **Requirements:** REQ-010.

**Implementation work:** Validate WebContents/main-frame sender and expected local app URL on every IPC channel. Validate typed input in main, bind tunnel targets to the approved FRM profile, deny unexpected navigation/windows and permissions. Keep Node integration disabled and context isolation enabled.

**Acceptance oracle:** Untrusted frame/sender, malformed ports/hosts and mismatched targets are rejected before any side effect. Expected UI operations pass. Renderer sandbox and security defaults remain enabled.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 4/8/12 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

### P2: Repair the complete dependency and native-binary graph

Can run alongside independent P1 source work after WP-00. One dependency implementer owns manifest/lock edits. Native/tunnel integration joins only after relevant contracts are agreed.

#### WP-04 - Upgrade supported desktop runtime and packaging

**Owner:** Dependency implementer. **Dependencies:** WP-00. **Exit gate:** G-02. **Requirements:** REQ-011.

**Implementation work:** Update Electron to the selected supported candidate, modernize builder and its transitive graph, and keep React/Next separate from desktop runtime reachability. Inventory packaged modules and exact Chromium/Node/native binaries. Validate Windows and Linux locally.

**Acceptance oracle:** Exact resolved Electron version is supported on release day; packaged runtime versions/SBOM match source/build evidence. No untriaged high/critical runtime finding. Both desktop packaging baselines launch and exercise connection/IPC tests; integrated CLI/tunnel validation is owned by WP-06/WP-11 at G-04.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 6/12/20 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

#### WP-05 - Patch frontend and development dependency families

**Owner:** Dependency implementer. **Dependencies:** WP-00. **Exit gate:** G-02. **Requirements:** REQ-002, REQ-003, REQ-013.

**Implementation work:** Upgrade the current Next 15 patch family and matching eslint config; retain compatible React pair. Resolve patched PostCSS/sharp and upgrade the Vitest/Vite family. Review all direct and transitive entries, never run blind audit fix --force.

**Acceptance oracle:** Both full lockfile scans rerun successfully, exact fixed ranges are satisfied, and static build/test behavior is validated. Exceptions record reachability evidence, owner and expiry, not only a scanner suppression.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 6/10/18 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

#### WP-06 - Remove legacy ngrok wrapper and verify native artifact

**Owner:** Desktop implementer. **Dependencies:** WP-01, WP-02, WP-03, WP-04. **Exit gate:** G-02. **Requirements:** REQ-012.

**Implementation work:** Replace legacy npm ngrok with one narrow direct CLI adapter, reusing existing child-process concepts. Pin the vendor CLI version and digest through a trusted acquisition path; use machine-readable status/config, never PATH fallback or a mutable stable download. Keep provider credentials outside renderer/argv.

**Acceptance oracle:** No old wrapper or its advisory paths remain in either lockfile or packages. Build manifest proves bundled CLI version, source and digest. Wrong-platform/tampered artifact fails closed. No lifecycle scripts download an unrecorded native binary.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 6/12/18 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

### P3: Harden connection, storage, input and UI behavior

API/config owner defines shared contracts before parallel panel adaptation. Preserve intentional LAN operation. Do not implement a global data layer beyond the needed request/polling helpers.

#### WP-07 - Preserve transport intent and bind credentials to origin

**Owner:** Frontend implementer. **Dependencies:** WP-00. **Exit gate:** G-03. **Requirements:** REQ-014, REQ-015, REQ-016.

**Implementation work:** Centralize URL parsing and validation. Preserve explicit scheme/port, support IPv6, reject userinfo/query/fragment/path ambiguity, correctly classify private addresses, and require explicit acknowledgement for plaintext LAN credentials. Reject authenticated redirects and clear secret on origin change.

**Acceptance oracle:** HTTPS never becomes HTTP; ports survive normalization. Cross-origin or downgraded redirects never receive the token. Changing origin requires a newly entered credential. Loopback and allowed LAN use remain possible.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 5/9/15 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

#### WP-08 - Remove durable plaintext tokens and migrate settings

**Owner:** Frontend implementer. **Dependencies:** WP-07. **Exit gate:** G-03. **Requirements:** REQ-017.

**Implementation work:** Persist only schema-validated nonsecret preferences. Keep FRM token in memory for this security release; remove legacy password fields and add Forget connection. Reject malformed local settings safely. Defer protected persistent secret storage to a separate change.

**Acceptance oracle:** Reload, restart, Forget and origin change remove the in-memory token. Existing localStorage token is deleted during migration. New app-generated exports, logs, fixtures, crash samples and backups contain no token; active legacy storage is migrated, but historical copies outside app control cannot be erased by the app.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 3/6/10 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

#### WP-09 - Bound API work and ignore stale responses

**Owner:** Frontend implementer. **Dependencies:** WP-07. **Exit gate:** G-03. **Requirements:** REQ-018, REQ-019.

**Implementation work:** Add shared cancellation/timeout, response byte and shape limits, in-flight limits, connection generation guards, backoff and bounded polling history. Preserve escaped text rendering; validate numeric/array fields before expensive map/recipe operations.

**Acceptance oracle:** Oversized or malformed responses and never-ending requests fail with a recoverable error. An old response cannot populate a new connection. Polling cannot multiply after remounts or failures. Boundary fixtures pass under controlled clocks.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 6/10/16 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

#### WP-10 - Add defensive document policy and truthful security UX

**Owner:** Frontend implementer. **Dependencies:** WP-02, WP-03, WP-07. **Exit gate:** G-03. **Requirements:** REQ-020, REQ-022.

**Implementation work:** Introduce a production CSP compatible with static Next hydration, restrictive executable sources and documented connection policy. Label secret purposes; expose sharing/error/unknown states and keyboard-accessible stop/recovery actions. Restrict desktop navigation/permissions.

**Acceptance oracle:** Production app has a tested CSP without unsafe-eval or unrestricted script sources; no required panel breaks. Keyboard users can connect/cancel/stop/recover, and status announces the actual state. No claim that broad HTTP(S) connect-src alone prevents exfiltration.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 4/8/12 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

### P4: Verify local release candidates

Integrate only completed owned changes, then run meaningful current tests and platform packaging. Investigate actual failures; no blanket suppressions or mock-only release claims.

#### WP-11 - Execute regression and adversarial acceptance suites

**Owner:** Independent reviewer. **Dependencies:** WP-02, WP-03, WP-04, WP-05, WP-06, WP-08, WP-09, WP-10. **Exit gate:** G-04. **Requirements:** REQ-004, REQ-021, REQ-024, REQ-029.

**Implementation work:** Run existing meaningful tests plus contract-driven cases and local Windows/Linux/browser smoke tests against synthetic FRM fixtures. Measure selected limits on representative small and large datasets. Check source/release artifact parity and test independence.

**Acceptance oracle:** Every release requirement has an observable result, fixture owner and reviewed evidence. No live game token or public tunnel is used in ordinary tests. Failed/blocked checks stay visible; existing functional panels pass.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 8/14/22 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

#### WP-12 - Make local release evidence reproducible

**Owner:** Release operator. **Dependencies:** WP-04, WP-05, WP-06, WP-11. **Exit gate:** G-04. **Requirements:** REQ-006, REQ-030.

**Implementation work:** Document exact build inputs, integrity/SBOM generation, checksums, distribution trust, patch release path and rollback. Existing workflow findings are reviewed as existing source; add no GitHub Actions. Owner decides whether existing automation is disabled or retained with least privilege.

**Acceptance oracle:** Clean local builds produce identifiable artifacts and complete evidence. A security patch can be released without a minor bump. Unsigned status is explicit where signing is unavailable. No write credential is exposed to untrusted dependency build steps.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 4/8/12 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

### P5: Approve distribution and maintain

Provide the exact candidate and evidence for owner review. Publication is separate from builds and from this planning request; do not send public advisories/issues automatically.

#### WP-13 - Approve distribution and maintain advisory watch

**Owner:** Repository owner. **Dependencies:** WP-12. **Exit gate:** G-05. **Requirements:** REQ-031.

**Implementation work:** Review residual-risk register, recheck advisories within 24 hours of release, choose the release channel, privately address potentially exposed credentials and publish only with owner authorization. Establish weekly full dependency review and a supported-Electron update cadence.

**Acceptance oracle:** Owner approves the exact commit and artifact hashes. Publication is recorded separately from build success. Recovery procedure and a responsible maintainer exist; open exceptions have explicit expiry and a review trigger.

**Evidence:** Exact revision/diff, commands and exit status, fixture IDs, observed output and reviewer decision. Link to the relevant code finding/advisory; keep secrets out of records.

**Estimate:** 2/4/6 hours (low/base/high), not measured duration.

**Stop condition:** Do not cross an unpassed predecessor/contract, conflicting unrelated edit, untrusted input/artifact or missing live/publication authority. Continue independent work and record the owner/resolution of the blocker.

## Milestone handoff format

At each phase boundary write a task-scoped handoff with: task/requirement IDs; current source SHA and canonical revision; files owned/changed; evidence paths and results; unresolved issues and rejected approaches; exactly one next unblocked task; remaining authorization boundary. Integrator reconciles shared indexes and decisions. New sessions reread the current register before trusting a handoff. An obsolete handoff cannot supersede a newer owner instruction.

## Parallel work and overlap

After WP-00, dependency updates may run in an isolated branch/worktree while the desktop owner repairs credential/lifecycle code and the API owner repairs connection policy. Do not let two agents edit package-lock.json, the shared API client or the canonical register. The integrator alone merges shared changes; an independent reviewer evaluates each gate. Give subagents explicit file ownership and the same permission boundaries, since child-agent permission inheritance is not universal.

## Dependency experiment and residual issue

The report includes a planning-only candidate lockfile experiment. It is not an application patch and must not be pasted over the real manifest without reviewing all contracts and current changes. The baseline scan and candidate scan are separate populations. The remaining minimatch advisory requires parent-compatible remediation or a narrowly evidenced, owner-approved, expiring tooling exception. Never force every minimatch major to version 11 just to make the scanner quiet. G-02 remains open until this is resolved and the actual upgrade is tested.

## Delivery rule

Continue already authorized local implementation until the selected work package and its acceptance checks are complete. Do not ask repeatedly to continue routine reversible work. When an essential owner input is missing, finish independent tasks and state the exact consequence and resolution step. No plan wording grants credentials, publication rights, purchases, live exposure or authority to override an approval failure.

## Final contract reconciliation from independent review

WP-01 implements02 section10's main-owned profile and single-use share authorization permit; no renderer-supplied authentication boolean is authoritative. WP-02 includes connection/token edits, Forget, disconnect, renderer loss and abrupt-main-death recovery from02 section11. WP-06 joins WP-01/02/03/04 before integrating the verified CLI. G-01 alone cannot restore public sharing: require G-02, applicable G-03 and integrated G-04 evidence too. These clarifications are CHG-004 and do not mark any gate passed.
