# Statusfactory security review and phased remediation report

**Review date:** 31 October 2026 · **Revision:** 1.0 · **Scope:** source, locked npm dependencies and release configuration

**Repository:** [https://github.com/shakiata/Statusfactory](https://github.com/shakiata/Statusfactory)  
**Pinned commit:** `d0338043169b7af80cedacd2feb838bb705b16a5`  
**Lockfile SHA-256:** `237ef37e1b6d3095475e61e10a570ffe043faef3f5aec8f7d5184c22f7ee565f`

## 1. Decision for the repository owner

Prioritize a security maintenance release. The strongest immediate concerns are an unsupported shipped Electron runtime, incorrect separation of FRM and ngrok credentials, and tunnel cleanup paths that can lose ownership of a running agent. Contain automatic public sharing until G-01, G-02, applicable G-03 and integrated G-04 evidence passes. G-01 alone is a containment/source-contract gate, not permission to re-enable sharing. Preserve private dashboard use while repairing these boundaries.

The review identifies **nine source/configuration findings**, each rated **Medium in this application context**, plus six dependency-remediation groups. The full lockfile matches **167 unique published, non-withdrawn GHSA advisories with 165 distinct CVE aliases**. These are version matches, not 167 demonstrated remote exploits. No compromise or standalone remote-code-execution chain was demonstrated.

A copied-manifest dependency experiment reduces the matching set to **one advisory** after compatible family upgrades and transitive refresh. It did not install, build or run the application. The remaining minimatch issue, native artifact verification and all runtime/harness gates remain open. This report does not authorize production implementation or publishing.

## 2. Evidence, coverage and limitations

All 94 repository text files were retrieved at the immutable commit and checked against their Git blob IDs: **94 of 94 matched**. Reviewed surfaces include renderer/API/configuration state, every panel and hook, Electron main/preload, package/lock metadata, local tests, release workflows and existing agent guidance. Binary/image assets were inventoried; image pixels and executable contents were not forensically reviewed. [Source evidence](evidence/source_hash_verification.json).

| Evidence class | Completed | What it does not establish |
| --- | --- | --- |
| Source review | Full text snapshot; exact source and line links below | Absence of all possible defects or malicious history |
| Dependency match | npm lock-only audit plus OSV queries for all 863 unique versions;167 full records | Live exploitability or independently discovered vulnerabilities |
| Inert diagnostics | Pure URL normalization/request stubs; fake Electron/IPC/process/timer lifecycle probes | Browser CORS behavior, actual public tunnels or platform runtime security |
| Upgrade experiment | Candidate lock resolution, full npm/OSV check; no installed modules | Compatibility, application tests, packaging or successful release |
| Secret-pattern check | Selected high-confidence token/private-key patterns: no match in 94 text files | Full history, arbitrary secret detection, local profiles or provider accounts |

The scanners share advisory sources, so their agreement is a cross-check of matching and coverage. `npm audit` exit 1 means vulnerabilities were reported, not that this completed audit failed. Raw queries, responses and complete GHSA records are retained. [npm semantics](https://docs.npmjs.com/cli/v11/commands/npm-audit) · [OSV API](https://google.github.io/osv.dev/api/).

No dependency lifecycle script, application, released Windows executable, AppImage, real ngrok agent, FRM service or live exploit was executed. The attempted loopback redirect diagnostic was blocked by the environment (EPERM), so redirect behavior is a standards/source inference pending browser and Electron tests. No full Git history, branch protection, account permissions or signing secrets were available. No claim is made about unindexed/unknown vulnerabilities. The exact external FRM version and bundled native CLI version are unknown.

## 3. Count the right unit

| Metric | Baseline result |
| --- | ---: |
| Package paths in lockfile | 962 |
| Unique npm name/version pairs queried | 863 |
| Unique matched GHSA records | 167 |
| Distinct CVE aliases | 165 |
| GHSA records with no CVE alias | 3 |
| Directly matched package/version pairs | 36 |
| Directly matched package names | 30 |
| npm affected package families, including propagated metavulnerabilities | 66 |

**Severity breakdown**

| Severity unit | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Distinct advisory records | 7 | 75 | 72 | 13 |
| npm affected families including metavulnerabilities | 6 | 28 | 32 | 0 |

CVE aliases and GHSA records are not a one-to-one mapping. A package family can inherit risk through a dependency without containing its own advisory. These totals must not be added together. Source findings below have separate application-context severity judgments; upstream scores are preserved unchanged in the catalogue.

## 4. Source and configuration findings

| ID | Finding | Contextual severity | Work package |
| --- | --- | --- | --- |
| SEC-001 | FRM authentication token is sent to ngrok as its account credential | Medium | WP-01 |
| SEC-002 | Tunnel failures and start/stop races can leave public exposure outside application control | Medium | WP-02 |
| SEC-003 | Tunnel IPC trusts every sender and accepts unvalidated arbitrary targets | Medium | WP-03 |
| SEC-004 | Packaged ngrok native binary is a mutable postinstall download outside lockfile integrity | Medium | WP-06 |
| SEC-005 | Release dependency builds receive repository-write credentials and mutable actions | Medium | WP-12 |
| SEC-006 | Endpoint normalization silently downgrades explicitly requested HTTPS and misclassifies hosts | Medium | WP-07 |
| SEC-007 | Credentialed fetches allow redirects to carry the custom FRM token to another origin | Medium | WP-07 |
| SEC-008 | FRM credentials are persisted in renderer localStorage by default without an explicit secret lifecycle | Medium | WP-08 |
| SEC-009 | Remote responses and polling have no application-level schema, size, deadline, or concurrency bounds | Medium | WP-09 |

### SEC-001 — FRM authentication token is sent to ngrok as its account credential

**Severity:** Medium · **Evidence:** Confirmed data-flow defect; dummy-token mock reproduced  
**Owner:** Desktop implementer · **Phase:** P1 · **Task:** WP-01 · **Gate:** G-01

ConnectionBar passes config.password, labeled as the FRM Auth Token from WebServer.cfg, to tunnelStart. Preload forwards it unchanged. Main names the same argument authtoken and supplies it to ngrok.connect or the CLI --authtoken argument. The locked ngrok package also inserts this value into its agent argv. These are independent credentials for different services.

**Conditions and impact**

- Electron Share is used with a nonempty FRM auth token.
- At least one ngrok execution path is available.


The FRM secret reaches an unrelated subprocess and its process arguments; it is treated as a credential for the ngrok service and may cause sharing to fail or expose the secret to observers of command lines/agent diagnostics. Whether a malformed token is transmitted to ngrok or rejected locally was not tested. No claim that this call persists the token to ngrok's config: the exact locked connect implementation does not call setAuthtoken.

**Rating rationale:** A concrete credential-boundary violation requiring the normal Share action. Scope is the FRM credential and sharing availability; no proven remote compromise or arbitrary command execution.

**Evidence**

- [src/components/ConnectionBar.tsx:41-56,108-115](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/ConnectionBar.tsx#L41-L56)
- [electron/preload.js:3-8](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/electron/preload.js#L3-L8)
- [electron/main.js:168,223-231,267-278](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/electron/main.js#L223-L231)
- [audit_work/ngrok_package_source/src_process.js:36-44](https://registry.npmjs.org/ngrok/-/ngrok-5.0.0-beta.2.tgz)


**Required remediation**

- Remove FRM credentials and arbitrary host/port from tunnelStart. The selected contract is tunnelStart({permitId}) after a separate main-owned FRM authentication probe; see 02 section 10. ngrok uses only its separately configured provider credential.
- If in-app ngrok credential management is retained later, give it a distinct typed field and main-process/OS-backed storage; never reuse config.password or renderer localStorage for it.
- Redact secrets in raw provider errors and logs. Keep FRM credentials limited to requests to the authorized FRM origin.
- Update electron.d.ts and all setup docs to distinguish FRM API tokens from ngrok account tokens.


**Acceptance evidence required**

- With distinct FRM_DUMMY and NGROK_DUMMY sentinels, assert FRM_DUMMY never appears in ngrok options, subprocess argv, provider errors, logs or ngrok configuration.
- Verify Share works with a configured ngrok account when the FRM server requires authentication, and a missing ngrok credential produces a provider-specific error without changing the FRM token.
- Exercise both the packaged binary and supported development execution path using dummy credentials and mocks first; any live integration test requires an isolated test account/service.


### SEC-002 — Tunnel failures and start/stop races can leave public exposure outside application control

**Severity:** Medium · **Evidence:** Confirmed with isolated timeout and late-completion mocks  
**Owner:** Desktop implementer · **Phase:** P1 · **Task:** WP-02 · **Gate:** G-01

On CLI timeout or other caught start error, main clears ngrokProcess without first killing and awaiting the child. Subsequent Stop and window-close inspect only the cleared handle. Separately, a pending npm connect can finish after Stop has returned and reestablish ngrokUrl because start/stop have no serialization or cancellation generation. CLI success detection only recognizes human Forwarding lines despite requesting piped --log=stdout, for which ngrok documents structured/non-TTY log formats; valid structured success logs can therefore lead into the timeout path.

**Conditions and impact**

- User initiates sharing.
- For the forgotten-child case, CLI fallback starts a real agent but the app does not recognize its URL before timeout; public impact requires the agent to have established a tunnel.
- For the race case, Stop/shutdown or another operation overlaps a pending start. The current UI disables repeated start clicks while loading, but main-process IPC has no concurrency guard.


The application can report sharing failed/inactive or stopped while a tunnel remains live, or report a late active tunnel after Stop succeeded. An unauthenticated or weakly protected upstream service would remain internet reachable unexpectedly. Even an authenticated FRM service loses the intended exposure lifecycle. Severity can increase with the sensitivity/authentication of the selected upstream; no real tunnel or compromise was demonstrated.

**Rating rationale:** Concrete loss of network-exposure control, but exploitation/data impact depends on an actual successful public tunnel and upstream authorization. Rated Medium for this game-dashboard scope rather than assuming full host compromise.

**Evidence**

- [electron/main.js:264-340](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/electron/main.js#L264-L340)
- [electron/main.js:344-381,386-413](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/electron/main.js#L344-L413)


**Required remediation**

- Introduce one main-process tunnel owner with explicit idle/starting/active/stopping/error state, serialized operations and a generation/cancellation token.
- Hold child handles locally during start. Every timeout, cancellation, parse failure, spawn error and shutdown must terminate the owned child, await exit, and verify cleanup before dropping ownership. Escalate kill only for that owned child if graceful termination fails.
- Ignore and immediately clean up late results from cancelled starts. Make Stop idempotent and make its result reflect confirmed closure, not cleared variables.
- Use a supported structured readiness mechanism: a parsed JSON log contract or the owned agent's loopback management API. Do not infer readiness solely from terminal UI text.
- Bound/redact log buffers and remove listeners/timers on completion. Handle child error/exit directly; remove the global uncaughtException swallowing workaround.
- Drive UI state from the owner, propagate start/stop errors, and await shutdown cleanup rather than fire-and-forget promises.


**Acceptance evidence required**

- Fake a running CLI that never yields a recognized URL: timeout must call terminate and await exit; status cannot become inactive while the owned child is alive.
- Provide representative structured success logs with split chunks; readiness is detected once and buffers remain bounded.
- Race start/start, start/stop, timeout/start and shutdown/start; after Stop/shutdown returns, no earlier generation can become active and every child has one accountable owner.
- Exercise spawn errors, zero/nonzero exit before readiness, exit after readiness, delayed npm connect, cleanup failures and platform-specific process termination with fake children.
- In an isolated integration environment, prove the public endpoint is unreachable after stop/failure and verify that unrelated ngrok processes are unaffected.


### SEC-003 — Tunnel IPC trusts every sender and accepts unvalidated arbitrary targets

**Severity:** Medium · **Evidence:** Confirmed missing controls; no independent renderer compromise found  
**Owner:** Desktop implementer · **Phase:** P1 · **Task:** WP-03 · **Gate:** G-01

The preload exposes tunnel start/stop/status to its page. Main ignores the event for start and does not inspect events for stop/status; host and port are interpolated without type, scheme, port-range or target-authorization validation. BrowserWindow has no navigation/window-open restrictions, so navigation to untrusted content is not explicitly prevented. A renderer that gains access to this bridge can request a public tunnel to an HTTP-reachable local/LAN service, stop the user's tunnel or read its URL.

**Conditions and impact**

- Attacker must first gain JavaScript execution in a bridge-enabled renderer or cause bridge-enabled untrusted content to load, or have equivalent local execution/IPC access.
- A usable ngrok account/agent is required for successful exposure.
- No XSS or remote navigation entry point was demonstrated in the inspected renderer; its external text is predominantly React-escaped. A normal web page outside this Electron window cannot simply invoke these handlers.


Missing trust-boundary checks amplify a future renderer compromise into native public-tunnel control and potential exposure of unrelated local/LAN HTTP services. This is not evidence of generic command execution: the app's ngrok CLI call uses an argument array with no shell, and nodeIntegration is explicitly disabled.

**Rating rationale:** A sensitive native capability lacks both caller and target authorization, but a prerequisite renderer compromise/navigation path is unresolved. Medium, not an unauthenticated standalone RCE claim.

**Evidence**

- [electron/preload.js:3-8](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/electron/preload.js#L3-L8)
- [electron/main.js:21-68,168,202-204,345,380](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/electron/main.js#L168-L204)


**Required remediation**

- Validate every IPC sender: the expected live mainWindow.webContents, its top-level frame and a precisely authorized application origin/document; reject missing/destroyed frames, subframes, child windows and all unrelated origins. Avoid prefix matching and do not accept all file: URLs merely because their origin is null.
- Prefer a dedicated secure application protocol with a fixed origin and constrained resource root. Until migrated, strictly identify the exact packaged document and its expected top-level frame.
- Deny unintended navigation and new windows; add deny-by-default permission request/check handlers. Production packaged builds must not switch to localhost content merely because NODE_ENV or --dev is set.
- Use a validated main-process FRM connection profile for sharing instead of a general arbitrary host/port tunnel primitive. Preserve legitimate local/LAN FRM support while parsing a hostname/IP, numeric port 1–65535, approved scheme and a user-selected target; reject file:, credential-bearing URLs, path/query/fragment injection, option-like inputs and malformed IPv6.
- Keep nodeIntegration false and contextIsolation true. Explicit sandbox/webSecurity true can document intent, but their absence as explicit keys is not itself a defect on Electron 33.


**Acceptance evidence required**

- Send mocked IPC from an unrelated webContents, child frame, missing senderFrame, https://untrusted.invalid, about:blank and arbitrary file URL: all handlers reject before calling ngrok or returning a URL.
- Allow only the real main-frame application origin/document; packaged mode ignores developer environment switches.
- External navigation/new-window attempts and unneeded permission requests are denied while all 12 dashboard tabs still work.
- Reject non-string/oversized hosts, out-of-range ports, unsupported schemes, credentials, fragments, leading options and unrelated profile IDs; accept and correctly canonicalize supported localhost/LAN/IPv6 FRM profiles.
- Ensure the hardened IPC does not expose raw ipcRenderer, generic process launch or arbitrary filesystem methods.


### SEC-004 — Packaged ngrok native binary is a mutable postinstall download outside lockfile integrity

**Severity:** Medium · **Evidence:** Confirmed build supply-chain control gap; no malicious binary observed  
**Owner:** Desktop implementer · **Phase:** P2 · **Task:** WP-06 · **Gate:** G-02

package-lock pins the npm ngrok wrapper, but that wrapper's postinstall downloads ngrok-v3-stable from a mutable CDN URL and extracts it without a pinned cryptographic digest/signature check. package.json copies node_modules/ngrok/bin into the application. Runtime ensureNgrokNpmBinary checks executable magic/permission, which detects corrupt downloads but does not authenticate a native program. The fallback also resolves ngrok from PATH, outside the packaged binary's identity.

**Conditions and impact**

- Dependencies are installed with lifecycle scripts enabled, as in release.yml npm ci.
- The resulting native binary is packaged and later used for Share.
- Compromise requires replacement of a trusted distribution/cache/build input or executable resolution; no such compromise was observed. HTTPS is used for the default download and was not found disabled.


Identical repository/lockfile inputs need not produce the same native binary, and reviewers cannot determine its version/content from the lockfile. A malicious substituted native binary would execute with the desktop user's privileges. This is a supply-chain gap, not proof that the current binary is malicious.

**Rating rationale:** Native executable content lacks immutable identity, but adversarial exploitation requires compromise/tampering of an upstream or local build source. Medium hardening priority, with high potential impact if that prerequisite occurs.

**Evidence**

- [package-lock.json:9811-9831](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/package-lock.json#L9811-L9831)
- [package.json:30-38](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/package.json#L30-L38)
- [electron/main.js:94-165,264-278](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/electron/main.js#L94-L165)
- [audit_work/ngrok_package_source/download.js:30-59,79-84,106-145,148-168](https://registry.npmjs.org/ngrok/-/ngrok-5.0.0-beta.2.tgz)
- [audit_work/ngrok_package_source/postinstall.js:6-28](https://registry.npmjs.org/ngrok/-/ngrok-5.0.0-beta.2.tgz)


**Required remediation**

- Choose a supported tunneling implementation after resolving the ngrok package advisory; do not downgrade blindly to another affected wrapper.
- If shipping a native agent, pin its version and platform/architecture-specific trusted digest or signed manifest in reviewed build inputs, verify before packaging, and record the packaged binary's version/hash in an SBOM/release manifest.
- Avoid implicit lifecycle-script downloads for release builds. Fetch verified native assets in an explicit auditable build step.
- Do not silently replace a rejected/missing packaged binary with an arbitrary PATH result. Either fail closed or use an explicit separately selected, verified executable path with clear support semantics.
- Keep magic/architecture checks as corruption diagnostics, not as the authenticity check.


**Acceptance evidence required**

- Two clean builds use the same recorded native agent digest; changing upstream stable content cannot silently change the shipped executable.
- A tampered binary retaining valid ELF/PE/Mach-O magic fails verification and is never executed or packaged.
- A missing or mismatched packaged binary produces a clear error without executing an unexpected PATH binary.
- Every supported Windows/Linux package contains an agent matching its manifest's version, platform, architecture and digest.


### SEC-005 — Release dependency builds receive repository-write credentials and mutable actions

**Severity:** Medium · **Evidence:** Confirmed workflow least-privilege and immutability gaps  
**Owner:** Release operator · **Phase:** P4 · **Task:** WP-12 · **Gate:** G-04

release.yml grants contents: write at workflow scope. Build jobs checkout with default credential persistence, run npm ci lifecycle scripts and tests, and explicitly expose GH_TOKEN during the build even though --publish never is set. Actions are referenced by movable v4/v2 tags. Therefore third-party install/build code and mutable action updates run in a job that can write repository content, although only the final release job needs that privilege.

**Conditions and impact**

- The upstream release workflow is enabled and triggered by an authorized push to main.
- An action, package lifecycle script or build dependency is compromised, or malicious code has already entered a trusted build input.
- No evidence of a compromised action/package, stolen token, or bypass of repository protection was found. Release does not use pull_request_target.


A build-chain compromise may gain repository/tag/release write capability in addition to altering its immediate artifact. Mutable action tags can change executed workflow code without a diff in this repository.

**Rating rationale:** Avoidable privilege amplification and mutable build dependencies, but not a direct untrusted-PR execution finding. Repository-level protection settings and external organizational controls were not inspected.

**Evidence**

- [.github/workflows/release.yml:10-17,29-30,67-105,110-140](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/.github/workflows/release.yml#L67-L105)
- [.github/workflows/codeql.yml:56-68,96-99](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/.github/workflows/codeql.yml#L56-L68)


**Required remediation**

- If retaining this upstream GitHub Actions release mechanism, default workflow permissions to contents: read and grant contents: write only to the final isolated publish job.
- Set persist-credentials: false for checkouts and remove GH_TOKEN from dependency installation, tests and build steps; no publishing credential should be available during arbitrary dependency script execution.
- Pin actions to reviewed immutable commits, or adopt GitHub's supported workflow dependency lockfile where available, including transitive action dependencies.
- The publish job should consume only artifacts/digests from the same verified workflow commit, verify manifests, and receive credentials only at publication time.
- If the chosen project policy is local testing/releases without GitHub Actions, preserve these same build/publish credential separation and immutable-input requirements in the local process instead. Do not enable Actions as part of this planning review.


**Acceptance evidence required**

- Static workflow validation proves all non-publish jobs have read-only or no repository token and no inherited contents: write.
- A benign isolated build fixture cannot obtain write-capable credentials from environment or persisted git config; no real token is printed or exfiltrated.
- Every action is locked to reviewed immutable code and dependency updates require a reviewable diff.
- Release publication verifies commit identity and artifact hashes; normal build failures cannot publish and package scripts never run in the credentialed publisher.


### SEC-006 — Endpoint normalization silently downgrades explicitly requested HTTPS and misclassifies hosts

**Severity:** Medium · **Evidence:** confirmed_source_and_pure_function_probe  
**Owner:** Frontend implementer · **Phase:** P3 · **Task:** WP-07 · **Gate:** G-03

buildUrl discards an explicitly supplied http/https scheme and chooses HTTP for any host beginning 192.168., 10., or 172. It does not parse an IP address or respect an HTTPS user's choice. X-FRM-Authorization is then attached to the resulting URL. Explicit custom ports on DNS/IPv6 hosts are also silently discarded.

**Conditions and impact**

- A user connects with an FRM token to an HTTP-reachable server, with network observation/modification possible. The downgrade is directly relevant to Electron/local HTTP app use. A browser serving the dashboard over HTTPS may block mixed-content requests instead; that is not an application-level guarantee.


Possible disclosure of the FRM token and monitored/game-chat data to an on-path party, and unintended connections or failure after custom ports are lost. No actual real-token disclosure was attempted.

**Evidence**

- [src/lib/api.ts:107-143](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/api.ts#L107-L143)
- [src/lib/api.ts:157-174](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/api.ts#L157-L174)
- [src/lib/__tests__/api.test.ts:31-90](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/__tests__/api.test.ts#L31-L90)


| Input | Observed baseline output |
| --- | --- |
| host=https://192.168.1.50, port=8080 | http://192.168.1.50:8080/getPower |
| host=https://172.1.2.3, port=8080 | http://172.1.2.3:8080/getPower |
| host=https://10.audit.invalid, port=8080 | http://10.audit.invalid:8080/getPower |
| host=https://factory.example:8443, port=8080 | https://factory.example/getPower |

**Required remediation**

- Use one URL parser/canonicalizer shared by the connection UI and all transports. Preserve explicit HTTPS and effective ports. Reject userinfo, unexpected paths, query/fragment, unsupported schemes and invalid ports. Keep deliberate loopback/LAN HTTP compatibility but expose an explicit insecure-transport acknowledgement for non-loopback HTTP with a token. Private address classification never makes plaintext safe. Never downgrade after a certificate error.


**Acceptance evidence required**

- Explicit https://192.168.1.50 stays HTTPS; no HTTP request occurs.
- 172.16.0.0/12 versus 172.1.2.3 and DNS names beginning 10./172./192.168. are distinguished correctly if address classification is needed.
- Explicit :8443 survives normalization for DNS and IPv6; conflicting Host/Port entries produce a visible deterministic result.
- Only HTTP(S) endpoints without credentials/query/fragment/path confusion can reach fetch; a real intended LAN HTTP configuration still works after acknowledgement.


### SEC-007 — Credentialed fetches allow redirects to carry the custom FRM token to another origin

**Severity:** Medium · **Evidence:** confirmed_missing_control_exploitability_conditional  
**Owner:** Frontend implementer · **Phase:** P3 · **Task:** WP-07 · **Gate:** G-03

Both the shared client and API Explorer send X-FRM-Authorization with the default redirect policy. WHATWG Fetch follows redirects by default and removes the standard Authorization header when origins change, not arbitrary custom credential headers. The application does not enforce an origin boundary before redirects.

**Conditions and impact**

- The configured server or an intervening HTTP/tunnel/reverse-proxy response redirects to another origin, and the browser's CORS/preflight rules permit that chain and target. A malicious target can permit the custom header; a fully compromised source server already sees the token, so redirects are not needed in that stronger scenario. Accidental/misconfigured redirects and HTTP on-path injection are the relevant incremental exposures.


FRM credentials can leave the selected origin. This is source/spec-supported; a Chromium/browser integration proof was not run because the sandbox denied a local listener with EPERM.

**Evidence**

- [src/lib/api.ts:129-143](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/api.ts#L129-L143)
- [src/lib/api.ts:157-174](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/api.ts#L157-L174)
- [src/components/EndpointList.tsx:56-72](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/EndpointList.tsx#L56-L72)


**Required remediation**

- Set redirect:'error' on every authenticated FRM request and consolidate API Explorer through the same transport policy. Ask users to configure a canonical final server origin. Do not rely on checking response.redirected or response.url after following because the token may already have been sent. Keep tokens keyed to exact normalized origin.


**Acceptance evidence required**

- A permitted local mock server returns 301/302/303/307/308 to a second mock origin; the second origin receives zero requests and zero token bytes.
- Same-origin redirects are rejected consistently by the chosen simple policy; explain canonical-endpoint remediation in UI.
- GET, chat POST and API Explorer all exercise the same redirect and token policy.
- Tests use dummy tokens, isolated server ports and explicit CORS fixtures; run once in supported browser and once in the chosen Electron runtime.


### SEC-008 — FRM credentials are persisted in renderer localStorage by default without an explicit secret lifecycle

**Severity:** Medium · **Evidence:** confirmed_source_requires_local_or_renderer_access  
**Owner:** Frontend implementer · **Phase:** P3 · **Task:** WP-08 · **Gate:** G-03

Every config edit serializes the complete config, including password, to localStorage. It is restored automatically on startup. The password-type input masks display but does not protect storage. Host changes preserve the previous password through object spreading, and no distinct Forget Token/connection-generation boundary exists.

**Conditions and impact**

- A party can read the relevant browser/Electron profile or execute JavaScript in that renderer origin. No independent renderer XSS or unrestricted remote read of localStorage was demonstrated. Endpoint changes create an additional user-error disclosure risk when the old token is retained for a different chosen server.


Long-lived FRM tokens persist in a renderer-readable profile and can be reused after app close or accidentally submitted to another server. This does not establish an unauthenticated remote exploit by itself.

**Evidence**

- [src/lib/useConfig.ts:8-40](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/useConfig.ts#L8-L40)
- [src/components/ConnectionBar.tsx:84-116](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/ConnectionBar.tsx#L84-L116)
- [src/app/page.tsx:76-93](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/app/page.tsx#L76-L93)


**Required remediation**

- Keep the FRM credential in session memory in both browser and desktop. Persist only schema-validated nonsecret preferences. Protected persistent secret storage is deferred (ADR-003).
- Delete legacy password fields during idempotent settings migration. Clear the live token on reload, restart, Forget, or any change of canonical origin.
- Cancel old requests and invalidate their generation before replacing the connection. Do not export tokens or restore them from backups.


**Acceptance evidence required**

- After saving/reloading settings, active localStorage and new settings/theme exports contain no dummy token.
- Legacy password migration preserves valid nonsecret settings; interrupted migration never revives a secret. Historical filesystem backups are outside app erasure control.
- Forget, restart, reload, origin change and token change clear/invalidate the applicable live secret, cancel work and initiate owned-tunnel teardown before replacement.
- A blocked request to A followed by a change to B cannot mark B connected or send the token for A to B.
- No remember-token feature or plaintext fallback is introduced in either platform during this security release; later OS-protected persistence requires a separate decision and tests.


### SEC-009 — Remote responses and polling have no application-level schema, size, deadline, or concurrency bounds

**Severity:** Medium · **Evidence:** confirmed_source_and_stub_probe_availability_impact_unmeasured  
**Owner:** Frontend implementer · **Phase:** P3 · **Task:** WP-09 · **Gate:** G-03

fetchEndpoint<T> returns response.json() without runtime validation or request/body bounds. Several components assume arrays and scalar field types. Polling uses setInterval without abort or single-flight control. The one-hour buffer prunes by time only and retains whole snapshots. API Explorer has a second unbounded JSON path.

**Conditions and impact**

- A configured FRM server, mod incompatibility, corrupted network response, large factory, or malicious API response supplies malformed/large/slow data. Local configuration tampering can also make refresh values invalid; the normal UI restricts selectable rates.


Renderer crashes, excessive CPU/memory, stale data and accumulated requests are possible. No measured production DoS or RCE is claimed; browser networking imposes some independent implementation limits.

**Evidence**

- [src/lib/api.ts:129-150](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/api.ts#L129-L150)
- [src/components/dashboard/PlayerMap.tsx:22-38](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/dashboard/PlayerMap.tsx#L22-L38)
- [src/components/dashboard/PlayerMap.tsx:85-113](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/dashboard/PlayerMap.tsx#L85-L113)
- [src/components/dashboard/ProductionMonitor.tsx:550-579](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/dashboard/ProductionMonitor.tsx#L550-L579)
- [src/components/dashboard/ProductionMonitor.tsx:603-634](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/dashboard/ProductionMonitor.tsx#L603-L634)
- [src/lib/useTimeBuffer.ts:10-32](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/useTimeBuffer.ts#L10-L32)
- [src/components/EndpointList.tsx:56-72](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/EndpointList.tsx#L56-L72)


**Required remediation**

- Create a small shared bounded request/polling layer with per-endpoint validators, response-byte caps, a deadline covering body reads, caller cancellation, one in-flight request per endpoint and stale-generation rejection. Validate persisted settings. Keep only bounded/aggregated history. Keep prior valid data visibly stale after rejection; provide recovery without crashing the entire app. Preserve escaped React text rendering.


**Acceptance evidence required**

- Wrong top-level shape, wrong scalar type, oversized strings and over-limit streamed/chunked bodies produce an explicit recoverable error, not an unhandled render exception.
- A never-resolving response is aborted by a controlled deadline; unmount/origin change aborts it earlier.
- Barrier-based overlapping tick test never sees more than one in-flight request per origin/endpoint.
- Fake clock plus max-sized fixtures prove history count/byte bounds across an hour and after clock jumps.
- A stale response from a previous connection is discarded and cannot replace newer data.
- Large representative legitimate factory fixtures pass chosen limits; limits and tuning decisions are recorded instead of claiming measured capacity now.


## 5. Dependency remediation groups

Priorities reflect the shipped desktop runtime, native artifacts and actual application surfaces. All six groups map to the P2 dependency repair gate; urgent containment in P1 proceeds independently. Upstream severity is retained even when a server/API-specific exploit path is absent. The complete167-row catalogue and full affected ranges follow in the appendices.

### DEP-001 — Unsupported Electron 33 engine ships with 46 matching advisories

**Assessment:** high · **Confidence:** version-confirmed; exploitability varies  
**Owner:** Dependency implementer · **Task:** WP-04 · **Gate:** G-02

**Locked versions:** electron 33.4.11.

Desktop runtime remains affected even though Electron is declared as a devDependency. Native browser/Node engine age also lies beyond npm-only coverage. Network-reachable TLS and conditional contextBridge issues justify prompt upgrade; API-specific advisories are not all proven reachable.

**Remediation:** Proposed target Electron 45.2.1, using build Node 24.22.1 or newer supported24.x security patch. Rebuild both Windows and Linux; verify embedded versions from artifacts and update Electron hardening. Target is metadata-checked, not build-tested.

**Exit evidence**

- No Electron 33 artifacts distributed after migration
- Supported engine and exact Chromium/Node versions recorded in release SBOM
- Full lockfile rescan and artifact startup/network/IPC tests pass
- Each retained advisory has reviewer, rationale, expiry and revisit trigger


**Traceability:** 46 advisory records; IDs and all dependency paths are linked through `data/security_plan.json` and `data/all_advisories.json`.

### DEP-002 — ngrok beta wrapper matches command-injection CVE; scanner downgrade also vulnerable

**Assessment:** high-upstream; application exploit path not shown · **Confidence:** version-confirmed; vulnerable API not called by app  
**Owner:** Desktop implementer · **Task:** WP-06 · **Gate:** G-02

**Locked versions:** ngrok 5.0.0-beta.2.

CVE-2025-57282 concerns shell construction in getVersion/binPath. Statusfactory calls connect and does not call getVersion or expose binPath input. Do not report confirmed remote app RCE. The package also pulls vulnerable archive/UUID dependencies and mutable native agent bytes, separately reviewed.

**Remediation:** Remove old ngrok wrapper through the selected tunnel replacement design; retain equivalent user sharing capability behind explicit consent and bounded processes. Do not downgrade to 4.3.3, which is explicitly affected. Official @ngrok/ngrok1.7.0 is a metadata-inspected alternative, not a compatible drop-in claim.

**Exit evidence**

- Old ngrok package and extract-zip path absent from final lock/SBOM unless specifically justified
- No getVersion/binPath shell-interpolation path in replacement
- Tunnel authentication, lifecycle and packaging verified locally with fake credentials/endpoints


**Traceability:** 1 advisory records; IDs and all dependency paths are linked through `data/security_plan.json` and `data/all_advisories.json`.

### DEP-003 — Next 15.5.19 matches14 advisories but shipped static export lacks affected server surfaces

**Assessment:** medium in current architecture; upstream includes critical · **Confidence:** version-confirmed; production-static non-reachability supported by configuration  
**Owner:** Dependency implementer · **Task:** WP-05 · **Gate:** G-02

**Locked versions:** next 15.5.19, eslint-config-next 15.5.19.

CVE-2026-75604 requires a Windows-hosted Next server. Image RCE advisories require server image optimization. Server Actions/cache/rewrite advisories require absent runtime features. Static output is not a Next server. Development or future deployment can change applicability.

**Remediation:** Proposed same-family next15.5.28 + eslint-config-next15.5.28, retain React/DOM 19.2.7. Explicitly address nested PostCSS and sharp; a Next-only version bump does not establish a clean graph. Keep development binds loopback-only.

**Exit evidence**

- All listed Next matches removed from resolved lock
- Output still static; no unintended request server, Server Actions or image optimizer
- Windows desktop and browser static build smoke tests recorded
- Development servers bound to 127.0.0.1 by default


**Traceability:** 14 advisory records; IDs and all dependency paths are linked through `data/security_plan.json` and `data/all_advisories.json`.

### DEP-004 — Vulnerable CSS/source-map and native image build dependencies remain nested

**Assessment:** high-upstream; build/input-conditional · **Confidence:** version-confirmed; remote runtime exploit not demonstrated  
**Owner:** Dependency implementer · **Task:** WP-05 · **Gate:** G-02

**Locked versions:** postcss ['8.4.31', '8.5.15'], sharp 0.34.5, source-map-js 1.2.1.

Build-time CSS/source maps can disclose files or exhaust resources when malicious content reaches parsers. Sharp aggregates native libvips/libheif/librsvg vulnerabilities. images.unoptimized prevents the normal Next image server surface but does not replace dependency repair.

**Remediation:** Propose direct postcss8.5.32 and scoped next->postcss8.5.32 override after compatibility checks; explicitly resolve sharp>=0.35.5 and remove older copies. Next 15.5.28 still pins PostCSS 8.4.31 and allows older sharp branch; re-resolve and inspect all paths.

**Exit evidence**

- Every PostCSS path resolves beyond all affected ranges
- Every sharp/native resource path meets selected version and SBOM records native versions
- Build output and style smoke tests pass
- No production claim based only on top-level package.json versions


**Traceability:** 12 advisory records; IDs and all dependency paths are linked through `data/security_plan.json` and `data/all_advisories.json`.

### DEP-005 — Packaging chain includes archive flaws and vulnerable generated AppImage search paths

**Assessment:** high · **Confidence:** version-confirmed; release binaries not inspected  
**Owner:** Dependency implementer · **Task:** WP-04 · **Gate:** G-02

**Locked versions:** electron-builder 25.1.8, app-builder-lib 25.1.8, builder-util-runtime 9.2.10, tar 6.2.1, extract-zip 2.0.1, @xmldom/xmldom 0.9.10.

CVE-2026-54672 affects AppImage runtime search paths created by old builder versions, demonstrating why build dependencies can affect shipped apps. Other archive/download/XML issues threaten release hosts if malicious inputs reach relevant APIs.

**Remediation:** Propose electron-builder26.18.0 (app-builder-lib26.18.0, builder-util-runtime9.7.0) and rebuild artifacts. Inspect generated AppRun search-path logic, binary provenance and extraction containment.

**Exit evidence**

- Generated AppImage contains no empty current-directory search components when relevant environment variables are unset
- Both platform artifacts rebuilt from reviewed source and lock
- Archive traversal tests and release reproducibility evidence recorded
- No remaining vulnerable archive toolchain paths without reviewed exception


**Traceability:** 29 advisory records; IDs and all dependency paths are linked through `data/security_plan.json` and `data/all_advisories.json`.

### DEP-006 — Test, lint and development helpers contain many additional advisories

**Assessment:** medium aggregate with conditional high/critical upstream issues · **Confidence:** version-confirmed; tool exposure depends on developer workflow  
**Owner:** Dependency implementer · **Task:** WP-05 · **Gate:** G-02

**Locked versions:** vitest 3.2.6, @vitest/mocker 3.2.6, vite 6.4.3, tinypool 1.1.1, axios 1.17.0, shell-quote 1.8.3.

Critical Tinypool advisories need prototype-pollution prerequisites; mocked/dev endpoints need exposure. Axios comes through wait-on; shell-quote through concurrently. These are not evidence of remote dashboard RCE, but developer and release-host risk remains.

**Remediation:** Propose compatible test cohort Vitest 4.1.12 + Vite 6.4.5 + existing plugin-react4.7.0, then refresh and scan all allowed transitive versions. Reassess Vite 6 support horizon before retaining it; a supported newer cohort can be selected with its matching React plugin. Do not apply arbitrary major minimatch/brace-expansion overrides to incompatible parents.

**Exit evidence**

- Full dev+prod+optional scan runs, not --omit=dev only
- All remaining matches assigned owner and explained context
- Unit/API fixtures remain meaningful through toolchain migration
- Watch/UI/dev endpoints are not exposed publicly or through sharing


**Traceability:** 65 advisory records; IDs and all dependency paths are linked through `data/security_plan.json` and `data/all_advisories.json`.

### Supported runtime and native coverage

Electron 33 reached end of life on28 April 2025. Electron 43,44 and 45 are supported in the31 October 2026 schedule; the selected candidate is45.2.1. Electron being declared a devDependency does not exclude it from the distributed desktop application. [Official support schedule](https://releases.electronjs.org/schedule).

Electron 33.4.11 reports Chromium 130.0.6723.191, Node 20.18.3 and V813.0.245.25. A separate index retains17 Node version-range candidates. They are **not confirmed additional Electron CVEs**: embedded builds, V8/BoringSSL differences, backports and API reachability must be checked. A broad Chrome CPE search was rejected because wildcard/unrelated matches were not defensible findings. [Electron 33.4.11 release](https://releases.electronjs.org/release/v33.4.11) · [separate candidates](evidence/dependencies/embedded-node-version-matches.json).

The owner must inventory the exact native binaries actually packaged, including Chromium/Node/OpenSSL-or-BoringSSL components, native image libraries and ngrok CLI version. FRM itself is an external service: no version was supplied, so this package cannot give it a version-specific CVE verdict. These are explicit activation inputs, not zero-vulnerability claims.

## 6. Resolved candidate and remaining advisory

| Component | Baseline | Candidate tested for resolution only |
| --- | --- | --- |
| electron | 33.4.11 | 45.2.1 |
| electron-builder | 25.1.8 | 26.18.0 |
| next + eslint-config-next | 15.5.19 | 15.5.28 |
| react + react-dom | 19.2.7 | retain19.2.7 initially |
| postcss | 8.5.15 direct;8.4.31 nested | 8.5.32 all required paths |
| sharp | 0.34.5 | >=0.35.5, exact resolved version locked |
| vitest + vite + @vitejs/plugin-react | 3.2.6 +6.4.3 +4.7.0 | 4.1.12 +6.4.5 +4.7.0 |
| ngrok | 5.0.0-beta.2 | remove legacy wrapper under selected tunnel replacement design |

The experiment used Node 24.22.1 and npm11.9.0 with package-lock-only/ignore-scripts options. No `node_modules` directory was created. The exact candidate manifest and lock are retained as research evidence, not a complete patch: the source still needs the planned ngrok adapter and packaging changes.

| Stage | Package paths | Unique matching advisories | npm affected families |
| --- | ---: | ---: | ---: |
| Baseline | 962 | 167 | 66 |
| Initial candidate retaining permitted stale transitives | 829 | 49 | 40 |
| Corrected Vite patch plus permitted transitive refresh | 834 | 1 | 28 |

OSV queried all 782 unique candidate package/version pairs and agreed on the single remaining record. All28 candidate npm affected families are moderate and propagate this same advisory; no high/critical candidate package families were returned. Candidate lock SHA-256: `f35a293ddb90fa3befcbacdefcbab2542b15d4b67cd3d54e32e5c4efe9a589f1`.

**Remaining:** CVE-2026-118764 / GHSA-g3hv-75wg-m249 (minimatch pattern amplification). Candidate versions 3.1.5, 5.1.9, 9.0.9 and 10.2.6 occur at 12 paths owned through electron-builder, eslint and eslint-config-next. The advisory describes attacker-controlled patterns with `optimizationLevel >= 2`; its narrative discusses10.2.6 while its machine range covers versions below 11.0.1. Verify the API/feature and input provenance at each path. Do not globally force incompatible major11 into older parents. [Advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) · [path evidence](evidence/dependencies/proposal/minimatch-residual-paths.json).

Preferred resolution is a compatible parent upgrade that removes the affected path. A **maximum 30-day tooling exception is proposed, not approved**, only if a reviewer demonstrates those paths do not process untrusted glob patterns, enforces bounded build/lint execution and assigns weekly review. If accepted on31 October it expires30 November 2026. Any untrusted pattern, tooling exposure, changed callsite or new upstream evidence reopens it immediately. G-02/G-04 cannot be marked complete from a scanner count alone.

**Superseded candidate:** Vite 6.4.4 introduced CVE-2026-118662 / GHSA-8g5g-mxqh-grgj. The experiment caught this and selected6.4.5. The new issue does not affect baseline 6.4.3 and is not included in the original167 records. [Upstream advisory](https://github.com/vitejs/vite/security/advisories/GHSA-8g5g-mxqh-grgj).

## 7. Additional observations and retained controls

### OBS-001 — No explicit CSP/permission policy; file protocol and development-mode production switch need hardening

**Classification:** Low / defense in depth · **Task:** WP-10

No CSP or permission handler was found in the inspected source; the packaged document is file:// and development content can be selected by NODE_ENV or --dev without app.isPackaged gating. These increase the consequence of untrusted content but do not establish XSS on their own. Prefer a fixed app origin, deny unneeded permissions, and a production CSP compatible with Next static export: hash required inline bootstrap scripts, avoid script unsafe-inline/eval, constrain connect-src to selected FRM endpoints, and self-host fonts if feasible. Do not add a blanket policy that breaks required FRM connections or silently weaken it with wildcards.

**Evidence:** electron/main.js:23-67; src/app/layout.tsx:17-21; next.config.js:3-9.

### OBS-002 — Patch-only security versions deliberately do not produce releases

**Classification:** Operational delivery risk · **Task:** WP-12

A patch bump inside the same major.minor is skipped. A source security fix shipped only as 1.5.1 after 1.5.0 will not automatically produce release artifacts through this workflow. Plan a reviewed release policy that can publish every security fix, or explicitly choose a minor version when using the existing policy. This is a deterministic release-policy limitation, not a privilege exploit.

**Evidence:** .github/workflows/release.yml:1-3,38-58.

### OBS-003 — Repository does not enforce release signing/provenance evidence

**Classification:** Build provenance observation · **Task:** WP-12

No required signing, signature verification or external native-binary manifest gate is visible in these files. This is not proof that published binaries are unsigned; external build environment/secrets and actual release artifacts were not inspected. Add verifiable hashes/SBOM and platform signing/provenance as appropriate after selecting the delivery process.

**Evidence:** package.json:20-54; .github/workflows/release.yml:95-140.

### OBS-004 — Persisted settings and theme imports are merged without runtime schema validation

**Classification:** Low · **Task:** WP-08

Treat storage/imports as untrusted input. Allow only documented keys and bounded values; validate colors and refresh range. No prototype-pollution or script-execution exploit demonstrated. Fold into R-04.

**Evidence:** [src/lib/useConfig.ts:23-38](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/useConfig.ts#L23-L38); [src/lib/useAppSettings.ts:16-33](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/useAppSettings.ts#L16-L33); [src/components/dashboard/SettingsPanel.tsx:370-377](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/dashboard/SettingsPanel.tsx#L370-L377); [src/lib/useTheme.tsx:43-62](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/lib/useTheme.tsx#L43-L62).

### OBS-005 — Remote fonts create an unnecessary third-party privacy/offline dependency

**Classification:** Low · **Task:** WP-10

Self-host the existing font assets with license/provenance or use a system stack as part of CSP/offline hardening. Do not describe the stylesheet as a demonstrated script injection.

**Evidence:** [src/app/layout.tsx:18-20](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/app/layout.tsx#L18-L20).

### OBS-006 — Remote ClassName strings are inserted into local icon paths

**Classification:** Low · **Task:** WP-09

Validate identifier format or resolve against a generated icon manifest to prevent path traversal requests and invalid names. The fixed relative prefix does not establish arbitrary remote URL loading or local-file content exfiltration, so no standalone exploit is claimed.

**Evidence:** [src/components/ui/ItemIcon.tsx:69-75](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/src/components/ui/ItemIcon.tsx#L69-L75).

### OBS-007 — Existing agent kit mixes V1 syntax with stale security guidance

**Classification:** Maintenance/portability observation · **Task:** WP-00

Existing OpenCode skill path object and permission map do not establish V2 compatibility. The satisfactory-stats skill repeats old token storage, URL and runtime advice. Replace those instructions only in the future authorized operating-kit work; this is not an application exploit.

**Evidence:** 04_SKILL_AND_AGENT_DESIGNS.md; templates/agent_guides.md.

Useful existing controls should remain: `nodeIntegration:false`, `contextIsolation:true`, Electron’s existing sandbox default, argument-array process invocation, ordinary React escaping of API/chat text, and graph traversal visited/depth guards. No inspected raw-HTML or eval-style renderer sink established XSS; no custom internet-facing backend or conventional server SSRF entrypoint was found. These are bounded negative observations, not a proof of immunity.

## 8. Phased remediation and delivery gates

| Phase | Intended outcome | Tasks | Exit gate |
| --- | --- | --- | --- |
| P0 | Operating kit, provenance and both-harness checks | WP-00 | G-00 |
| P1 | Credential separation and controlled public sharing | WP-01–03 | G-01 |
| P2 | Supported runtime, patched graph and verified CLI | WP-04–06 | G-02 |
| P3 | Origin, secret, response and UI boundaries | WP-07–10 | G-03 |
| P4 | Local browser/Windows/Linux validation and artifact provenance | WP-11–12 | G-04 |
| P5 | Owner-approved distribution and maintenance | WP-13 | G-05 |

The exact task prerequisites, owners, acceptance evidence and stop conditions are in [07_IMPLEMENTATION_ROADMAP.md](07_IMPLEMENTATION_ROADMAP.md). Phase labels communicate priority; dependency and frontend repairs can proceed in parallel after P0 using disjoint file ownership. One integrator owns the shared lockfile, canonical register and final merge. Do not serialize unrelated work merely because its phase number is later.

The first future implementation task is WP-00: verify the current checkout against this commit, read existing instructions and canonical records, record the actual OpenCode v2 and Codex versions, adopt only the designed repo-local operating kit, and run the disposable dual-harness matrix. Current documentation is researched, but neither executable is present here. Do not start application scaffolding or claim portability before that gate.

No new GitHub Actions are part of the plan. Local builds/tests are authoritative. Existing workflows require an owner decision to disable or harden with least privilege. Building, verifying and publishing are separate states. Only the owner may approve distribution of the exact reviewed commit and artifact hashes.

### Reviewed boundary refinements

The final contract makes main own the selected profile and issue a single-use, 60-second permit after independently checking the FRM auth policy. `tunnelStart` receives that permit, never an FRM token or arbitrary target. Origin/token change, Forget, disconnect, reload or renderer loss invalidates permits and invokes the same owned-process teardown before replacement. See 02 sections 10–11 for exact inputs, outputs, races and failure states.

Abrupt main-process death is a distinct residual: a nonsecret ownership marker must preserve `closure_unknown` on restart, block new sharing and require verified process identity before cleanup. Graceful-shutdown mocks cannot establish crash closure. The owner must accept this recoverable residual at G-04 or require validated platform supervision. Never kill a process on PID alone.

The selected cross-platform plaintext policy accepts only localhost/loopback and private IPv4 or IPv6 ULA literals, with session acknowledgement where required. Plain HTTP DNS names and public literals are rejected; a LAN hostname user can use a private literal or HTTPS. This is a deliberate conservative compatibility tradeoff, recorded in CHG-004, not an assertion that a browser can establish DNS locality.

## 9. Resource estimate and activation inputs

Estimated effort is **68 / 129 / 205 hours (low/base/high)**. At the explicitly assumed CAD 100/hour allowance, labor is **CAD 6,800 / 12,900 / 20,500**. This is an editable planning estimate, not a quote or measured delivery forecast. Nonlabor costs are unknown: test-device availability, platform signing, ngrok plan and operator time must be entered before claiming an all-in cost. The workbook leaves total cost unavailable until that input is supplied. No purchase is authorized.

There is no new hosting service, database, account system, billing platform, AI runtime or Kubernetes requirement. Current desktop/static architecture is retained. Selected limits and performance targets are contractual proposals awaiting representative FRM datasets; they are not benchmark claims.

| Activation input | Owner | Consequence while missing | Work that can continue |
| --- | --- | --- | --- |
| Actual OpenCode v2 and Codex versions/executables | Integrator | No runtime portability claim or application implementation gate closure | Review, kit preparation and fixture design |
| FRM/mod/game version and documented auth/CORS behavior | Repository owner | Public sharing remains unavailable if auth cannot be verified | Credential separation, URL parser, cancellation, dependency upgrades |
| Pinned native ngrok CLI version, platform assets and trustworthy digest/signature | Release operator | No native artifact can be accepted without provenance | Mock adapter and lifecycle tests |
| Windows/Linux test hosts, supported OS versions and signing policy | Repository owner | Cannot claim real platform compatibility or signed distribution | Pure contract tests and source changes |
| Disposition of residual minimatch advisory and existing workflow | Repository owner | Release remains blocked without compatible-parent fix or precise approved expiring exception | All independent repairs and local tests |
| Exact revision/artifact publication authority and actual cash allowances | Repository owner | No publication and no claim of fully funded total | All local planning/implementation/build evidence |

## 10. Acceptance and maintenance

Every lasting test must name a current requirement, observable oracle, fixture owner, isolation/concurrency assumptions and a review trigger. Use dummy secrets, controlled timers and barriers for races. Ordinary tests must not open public tunnels or reuse live game credentials. Unit mocks establish control-flow behavior; separate local browser/Electron/platform tests establish actual behavior. An owner-authorized isolated provider account may be used only for a separately recorded integration check.

Before release, rerun the complete graph scan within 24 hours, recheck the supported Electron line and native binary identity, review expiring exceptions and verify all existing panels. Record source commit, lock hash, tooling/runtime versions, artifact hashes, build/test evidence and owner approval independently. Review dependencies weekly and update Electron before support expires; critical exposed issues trigger an immediate maintenance review.

If evidence of actual credential exposure or an orphaned public endpoint emerges, stop/verify the affected owned tunnel, revoke the affected FRM/provider credential in its own service, retain only redacted evidence and follow the incident runbook. Do not restore revoked tokens from profiles or old backups. Source findings alone do not establish that this incident has occurred.

## 11. Appendices and machine-readable authority

- [All167 advisories, exact affected/fixed ranges and source links](appendices/ALL_ADVISORIES.md)
- [Complete dependency path inventory](data/dependency_inventory.json)
- [Full advisory JSON](data/all_advisories.json) and [spreadsheet-friendly CSV](data/all_advisories.csv)
- [Canonical requirements, decisions, tasks, gates, sources and scope history](data/security_plan.json)
- [Planning validation report](10_PLANNING_VALIDATION.md)
- [Raw evidence and interpretation](evidence/README.md)

The JSON register is authoritative for plan status; the workbook is an editable proposal view. An integrator reconciles edits by stable ID and baseline revision before they become accepted records. Scope approval is distinct from implementation verification. All future remediation and release gates remain not run/not started in this package.
