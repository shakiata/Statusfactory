# Master plan

## 1. Problem, users and successful outcome

Statusfactory is an existing browser/Electron companion for Satisfactory using the external Ficsit Remote Monitoring API. The remediation users are its maintainer, contributors and future OpenCode v2/Codex agents. Application users need factory monitoring without accidental credential disclosure, unintended public exposure or unsupported bundled runtimes.

Success is a release candidate whose source, lockfile, native binaries and tests are traceable to one revision; whose public sharing cannot outlive a confirmed Stop; whose FRM secret remains scoped to the selected server; and whose dependency exceptions are justified by executable-path evidence. Distribution is separately approved by the repository owner.

The source baseline, scanner population and methodology are in `00_START_HERE.md` and `09_SECURITY_REVIEW.md`. The existing application uses a static Next export and direct FRM requests. Its 12 areas are Power, Production, Factory, Resources, Generators, Trains, Inventory, Players, Chat, Fluids, API Explorer and Settings. Preserve those capabilities, browser mode and the currently distributed Windows/Linux modes. [Pinned application](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/app/page.tsx), [static configuration](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/next.config.js).

## 2. Scope and authority

| Classification | Decision |
| --- | --- |
| Explicit request | Current dependency CVE/advisory review, source security review, full owner report and phased implementation-ready planning files |
| Explicit constraints | Planning only; local validation; no added GitHub Actions; maintainability for people and agents; useful comments, documentation and meaningful tests |
| Delegated selections | Severity context, evidence format, coherent remediation architecture, numerical safety targets, phases, compact skills and authoritative record format |
| Preserved prior context | Repository identity, FRM integration, browser/Electron modes, Windows/Linux release artifacts |
| Assumptions | Current main is intended baseline; owned Windows/Linux test environments will be available; ordinary FRM servers may require LAN HTTP |
| Activation inputs | Exact owner checkout, installed harness builds, FRM/mod version, actual packaged native binaries, provider test account, signing/publication policy |
| Rejected expansion | Rust rewrite, new backend/database, accounts/billing, multi-tenancy, new MCP server, hosted AI/runtime memory, Kubernetes |
| Deferred | macOS distribution, optional protected persistent tokens, broad UX redesign, full historical secret/incident forensics, binary exploit testing |

There is no new application to scaffold. The operating kit gate precedes future remediation, adapting the request's scaffolding-first ordering to this existing repository. No requirement is silently removed: visual planning becomes a focused security interaction specification; public-web SEO, subscription economics and customer-agent memory are not applicable to this private game dashboard review.

## 3. Selected architecture and alternatives

**Retain Next/React static export and Electron.** The reviewed defects are in boundary handling, stale dependencies and distribution controls. A rewrite introduces new behavior and regression risk without proving these defects disappear. Upgrade supported families and share small validation/polling utilities. Revisit architecture only if measured compatibility or capability requirements demand it.

**Use one direct, pinned ngrok CLI adapter.** The current code already has a child-process path. Removing the old npm wrapper avoids its unpatched advisory and mutable postinstall binary acquisition. The official native SDK is a credible alternative, but it introduces a new platform-packaging dependency and is unnecessary for this narrowly scoped repair. The selected CLI must have an exact version/digest and supported machine-readable lifecycle contract. Artifact identity is an activation gate, not an invented current hash.

**Keep FRM tokens only in session memory for the security release.** Persist host/port/preferences, never the token. Remove legacy token fields and provide Forget. OS-backed opt-in persistence is deferred; it needs platform-specific behavior and unavailable-store tests. Merely encoding a token or encrypting it with an application-embedded key is not a substitute.

**Preserve deliberate LAN HTTP.** Explicit HTTPS is never rewritten. A private-network HTTP connection requires a visible acknowledgement, while public-IP and DNS-name HTTP are refused by the selected policy. Use a parsed private address literal for an unencrypted LAN server, or HTTPS for a DNS name. An unencrypted local FRM service remains possible without pretending that a private IP makes its traffic confidential. HTTPS/VPN remains the owner's remote-access choice.

**Use local validation and separate publishing credentials.** Existing workflows are review evidence. This plan adds no Actions. The owner can retain and harden, disable or replace existing release automation later; none of those choices permits repository-write credentials during dependency installation or test execution.

## 4. Dependency selection policy

The complete inventory and applicability records are canonical evidence, not a list of blanket exploit claims. The supported-runtime candidate is Electron 45.2.1; the smaller frontend-family change is Next 15.5.28 with matching eslint-config-next and the compatible React/React DOM 19.2.7 pair. Safe resolved PostCSS/sharp versions and the test/packaging graph also need attention. The dependency appendix contains exact upstream metadata and any isolated resolution experiment performed.

Candidate versions are dated selections, not an application-tested upgrade or a fixed release. Copied-manifest lock resolution and npm/OSV cross-checks succeeded; installation, build, runtime and package compatibility remain unperformed. Re-resolve on the implementation date, inspect peer/engine constraints, install only in an authorized disposable build environment, then run actual test/build/package gates. Avoid `npm audit fix --force`: its proposed ngrok 4.3.3 downgrade is also covered by the same advisory. A maintenance line is chosen because it can be supported and verified, not because its CVE count looks smaller.

The shipped static app does not expose a Next request server or image optimizer. Server-only Next advisories are therefore classified as not reachable in that intended artifact, subject to verifying packaged contents and deployment mode. This does not exempt the development server, a future server deployment, build dependencies or the Electron runtime. [Static configuration](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/next.config.js), [Electron support schedule](https://releases.electronjs.org/schedule).

## 5. Release scope and later work

The first security release must implement P1 sharing/IPC containment, P2 supported dependencies/native provenance, P3 connection/storage/data controls and P4 local verification. Public sharing stays unavailable until G-01/G-02/applicable G-03 and integrated G-04 checks pass; this is deliberate temporary containment. Private monitoring and all current panels remain acceptance requirements. New monitoring services, cloud storage or billing would require a separate scope decision.

Later protected token persistence can reuse the same origin-binding and Forget contracts. macOS should be claimed only after a maintainer owns test, packaging and distribution evidence. Source code review does not certify past released binaries or the external FRM mod.

## 6. Acceptance and evidence

Each permanent test maps to a requirement and states an observable oracle. Examples include zero network requests at a redirect target, zero owned children after confirmed Stop, unchanged nonsecret preferences after a legacy-token migration, and a capped number/size of retained snapshots. Fixture owners and clocks/barriers are part of the test definition. Existing utility tests are retained if they protect current behavior; this review did not execute that suite.

`data/security_plan.json` holds 36 stable requirements, 14 work packages and six release gates. The roadmap derives from it. Requirements have a planning state distinct from implementation delivery, and scope authority distinct from test evidence. Unknown results are not converted to successful zeros.

## 7. Resource and cost assumptions

The editable workbook supplies low/base/high task-hour estimates, a selected case, hourly rate and unknown nonlabor inputs. The initial rate is **CAD 100/hour**, a planning allowance rather than a quotation. This is remediation labor, not hosting revenue or profit. Native runtime upgrades and Windows/Linux verification drive uncertainty; a larger dependency migration or incident investigation must be re-estimated as a scope change.

No new server is selected. Build/test capacity uses an owner-controlled workstation and disposable local fixtures. New test devices, code-signing, provider-account charges and storage are not priced without the owner's choices; their cost remains unknown, not zero. A completed labor subtotal is not a complete project total until nonlabor inputs are entered. No purchases are authorized.

## 8. Change and reconsideration rules

When an owner instruction changes transport support, persistence, distribution targets or sharing behavior, assign a change ID, preserve the prior decision, list affected requirements/work/gates and record approval authority. An integrator merges task records and updates the canonical revision. Fresh agents reread current records before trusting old handoffs.

Stop a task at a failed contract, incompatible candidate family, untrusted binary, conflicting unrelated edit or missing authority for publication/live changes. Continue independent authorized work. Do not turn missing optional signing/provider inputs into a blocker for source fixes, documentation or mocked tests.
