# 06 — Security and operations

**Status:** proposed operating contracts, 31 October 2026. **Authority:** planning only. This document implements ADR-001–006 and ADR-010–012 in [the canonical register](data/security_plan.json); it authorizes no application changes, installations, credential rotation, infrastructure mutation or publication. Detailed findings and evidence belong to [09_SECURITY_REVIEW.md](09_SECURITY_REVIEW.md).

The reviewed source is commit `d0338043169b7af80cedacd2feb838bb705b16a5`. Its local copy is a read-only source snapshot without `.git`, not a clean development checkout. Windows/Linux packaged-runtime tests have **not run**. Isolated diagnostics demonstrated control-flow defects with fake processes; they did not open a tunnel or establish compromise.

## 1. Boundaries and operating baseline

Retain the static Next/React frontend and Electron shell. Preserve browser use, all 12 dashboard areas, loopback connections and explicitly acknowledged private-LAN HTTP. Honor HTTPS and explicit ports; reject public-internet HTTP. No new backend, account system or operational platform is required.

| Boundary | Required security contract | Observable acceptance |
| --- | --- | --- |
| FRM server → renderer | Treat responses as untrusted; validate shape/size, preserve escaped text and cancel stale work | Oversized, malformed and delayed fixtures produce bounded errors without crossing connection generations |
| Renderer → Electron main | Authorize the expected WebContents, main frame and application document on every IPC call; validate typed arguments | Unexpected origins, frames and targets cause zero native side effects |
| Main → ngrok CLI | One owned child, fixed executable identity, argument arrays, isolated configuration | Wrong digest/platform fails closed; no shell or automatic PATH fallback |
| Internet → shared FRM API | Share only an authenticated, verified target; disclose that the entire reachable API is exposed | Empty/incorrect authentication, unknown enforcement or changed target blocks Share |
| Dependency/build tooling → release | Build without publication credentials; preserve exact inputs and native identities | Manifest, SBOM, tests and final artifact hashes refer to the same commit |
| Application → local persistence | Store nonsecret preferences only; FRM credentials remain session memory | Restart, reload, Forget and origin change require re-entry; exports contain no secret |

The current lock resolves Electron **33.4.11**. Electron 33 reached end of support on 28 April 2025. The selected upgrade candidate is **45.2.1**, listed on 31 October 2026 with Chromium **156.0.8078.75** and Node **24.22.1**. This is an untested candidate, not a shipped or automatically compatible upgrade. WP-04 must review intervening breaking changes, resolve the exact toolchain and validate packaged behavior. Recheck support and advisories when implementation begins and before distribution. [Lockfile](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/package-lock.json) · [Official releases](https://releases.electronjs.org/?channel=stable) · [Support schedule](https://releases.electronjs.org/schedule)

Keep Node integration disabled and context isolation/sandbox enabled. Add tested navigation, window, permission and CSP restrictions; do not weaken browser security to repair CORS. Missing explicit sandbox configuration in the baseline is not evidence that Electron 33 disabled its default sandbox. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)

## 2. Credentials and public sharing

**FRM tokens are session-only for this security release. OS-backed persistent FRM storage is deferred.** WP-08 removes legacy password fields from durable settings while retaining valid nonsecret preferences. Never recover an old token silently from a backup. Clear the current token and cancel work when the effective scheme, host or port changes. Session memory reduces persistence; it does not protect against a compromised host or renderer.

Replace legacy npm `ngrok@5.0.0-beta.2` with one direct vendor CLI adapter. Its matched advisory, CVE-2025-57282, concerns a vulnerable package API; the review did **not** demonstrate application RCE through `getVersion()`. Remove the wrapper and its unused vulnerable surface rather than downgrade to another affected version.

The new adapter acquires an **exact versioned vendor artifact**, verifies a reviewed digest/signature through a trusted acquisition path, and launches its approved absolute path. The precise CLI version, Windows/Linux architecture and digest remain required WP-06 inputs; none was verified here. A mutable “stable” URL or a checksum downloaded alongside untrusted replacement content is insufficient. Record acquisition provenance. Reject a missing, mismatched or wrong-platform binary without searching PATH.

Provider credentials stay in a separately selected local provider configuration, accessible only to its owner and main-process adapter; never place them in renderer state or argv. FRM tokens must never enter provider options, config, argv or logs. Do not mutate unrelated global ngrok configuration.

G-01 verifies source-contract containment: caller/target authorization, credential separation, server-side authentication and deterministic teardown. Public sharing remains unavailable until G-01, G-02, applicable G-03 controls and integrated G-04 validation all pass. A live-provider test still needs its own isolated account/service authorization. A nonempty password field is not proof of authentication. Use an isolated FRM fixture to prove unauthorized requests fail and the credential permits only expected operations; unresolved authentication coverage blocks public sharing. Private dashboard operation remains supported.

Use one serialized lifecycle: idle, starting, active, stopping, failed_closed and closure_unknown. Origin/token change, Forget, disconnect, renderer reload/crash and navigation invalidate permits and invoke the same stop path; main retains closure_unknown even if the renderer disappears. Stop invalidates pending starts and retains ownership until child exit is confirmed. Timeout cleanup must terminate its own child; late success must be rejected and cleaned up. Show **“closure unconfirmed”** when termination cannot be verified. Parse machine-readable readiness and bound child output. Never kill every ngrok process on the machine. The baseline loses its child handle on certain failures; therefore its existing Stop indicator alone is not closure evidence. [Pinned lifecycle source](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/electron/main.js#L264-L381)

## 3. Proposed privacy and retention targets

These are **design targets requiring fixtures and owner acceptance**, not claims about current behavior. Numerical request/data limits are governed by [02_DOMAIN_AND_PRODUCT_CONTRACTS.md](02_DOMAIN_AND_PRODUCT_CONTRACTS.md).

| Data | Proposed retention and handling |
| --- | --- |
| FRM token | Memory for the current origin/session only; remove on reload, restart, Forget or origin change; zero durable copies in app storage, exports, fixtures and logs |
| Provider token | Dedicated owner-protected provider configuration; Linux mode `0600` or equivalent Windows user-only ACL; excluded from application backups/support bundles |
| Factory/chat/player payloads | Memory only; history capped at 1 hour, 720 samples and 64 MiB per active panel, whichever limit applies first; clear on disconnect/Forget |
| Routine diagnostics | In-memory ring, maximum 1 MiB or 1,000 records, whichever comes first; clear on application exit; no automatic upload |
| Child-process output | Redacted 64 KiB maximum tail per owned process; discard at session end; never accumulate unlimited stdout/stderr |
| Optional support export | User-initiated, sanitized metadata only; proposed deletion within 7 days or incident closure, whichever is sooner, unless an owner records a preservation reason |
| Release/security evidence | Secret-free manifests, scan dates, test results and approval records retained for 12 months after the release is superseded |

Allowlisted diagnostics contain timestamp, version, opaque connection ID, operation, state transition, duration and error code. Exclude authorization headers, full URLs containing secrets, chat content, player details, request bodies, raw exception dumps and unreviewed environment/process dumps. No automatic crash-memory upload. Provider-side retention is independent: inspect account settings when authorized; do not promise the application can erase provider records.

Acceptance uses distinct dummy secrets across logs, storage, exports and migration fixtures. Inspect generated bundles for the sentinels. The release reviewer rejects any leak and checks that limits do not break representative large factories.

## 4. Runbook: suspected credential or tunnel exposure

**Trigger:** unexpected public endpoint, Share failure with an agent still running, a token in diagnostics, or observed unauthorized FRM activity. These triggers warrant investigation; the review itself established no historical compromise.

1. **Inspect and preserve:** security reviewer records times, app/build hash, redacted target identity, process identity and observed endpoint state. Inspect only the relevant machine/provider/FRM evidence already authorized. Collect metadata, not live tokens or whole process dumps. Keep incident records separate from public issues.
2. **Contain with owner authority:** the machine/account owner authorizes termination of the identified app-owned process or endpoint. Verify both local ownership and provider closure where available. If state is uncertain, keep sharing disabled. Changes to firewall, FRM service or provider account are mutations requiring specific authority; read-only inspection is not permission to make them.
3. **Revoke affected credentials:** the FRM owner rotates an exposed FRM token; the provider account owner revokes provider credentials only when implicated or deliberately chosen as a precaution. Record credential identifiers and revocation time, never values. Restarting a live game/service or removing other users’ access requires its owner’s decision.
4. **Verify and recover:** prove old credentials fail, the unintended endpoint is closed and the repaired client uses freshly entered credentials. Recover nonsecret settings from a validated backup; do not restore revoked tokens, old provider configs or unverified binaries. Test locally before separately authorizing any public tunnel.
5. **Close:** security reviewer documents evidence, scope, uncertainty, corrective work and residual risk. Repository owner decides whether a disclosure or release notice is needed. Nothing in this package sends notices or publishes findings automatically.

## 5. Local validation and reproducible release

### Baseline inspection

In a disposable directory containing copies of `package.json` and the pinned lockfile, record file hashes and tool versions. The following is a **read-oriented advisory scan**, not an upgrade instruction:

```bash
node --version
npm --version
npm audit --package-lock-only --ignore-scripts --include=dev --include=optional --json --fetch-retries=0 --fetch-timeout=20000 --cache ./audit-cache > npm-audit.json
```

Record the exit code separately: a valid vulnerability report can return nonzero; distinguish that from registry/network failure. This scan sends dependency metadata to the registry. Re-query every exact locked package/version through the documented OSV batch API, preserving raw results and dates. npm and OSV can share advisory sources; agreement does not prove completeness. **Never run `npm audit fix --force`.** Upgrades require reviewed diffs and compatibility evidence. [npm audit semantics](https://docs.npmjs.com/cli/v11/commands/npm-audit/) · [OSV API](https://google.github.io/osv.dev/api/)

### Implementation and candidate verification

After separate implementation authorization, use a real isolated checkout, verify its commit/dirty state and preserve unrelated work. Install exact lockfile dependencies without lifecycle scripts first; then permit only reviewed required build actions and explicitly verified native acquisition. `--ignore-scripts` alone does not create a runnable Electron installation.

Run meaningful contract tests and the existing `npm test` / `npm run build` gates. Build Windows portable and Linux AppImage candidates locally with publication disabled. Test both actual operating systems plus browser mode against synthetic FRM data: all dashboard areas, HTTPS/IPv6/ports, redirects, token migration, limits, cancellation, sender checks and tunnel teardown. A Linux build of a Windows artifact does not substitute for Windows execution. macOS remains deferred until an owned test/signing path exists.

For each candidate, record source commit, lockfile hash, exact Node/npm/builder versions, OS/architecture, build commands, scan inputs/dates, test results and artifact SHA-256. Generate an npm SBOM **and** a native inventory covering packaged Electron/Chromium/Node, ngrok CLI and other shipped native components; lockfile declarations alone cannot identify every binary. Attach acquisition source, digest and signature/provenance verification status. Compare source, unpacked package and manifest identities. Reproducibility means controlled inputs and explainable output differences; do not claim byte-identical signed artifacts without checking.

Keep signing/publishing credentials outside install, test and build processes. If signing is unavailable, label the artifact unsigned and require the owner’s explicit distribution decision; a checksum identifies bytes but does not establish publisher identity by itself.

## 6. Gates, patching and recovery ownership

All gates below are **not run** at planning delivery. Assign named people before activation.

| Gate | Accountable reviewer | Required evidence |
| --- | --- | --- |
| G-00 | Integrator | Baseline/operating-kit records and actual harness checks; implementation authority recorded separately |
| G-01 | Security reviewer | Authenticated sharing, caller/target checks and confirmed lifecycle cleanup |
| G-02 | Dependency reviewer | Complete refreshed scans, reviewed applicability, supported packaged runtime and native provenance |
| G-03 | Security reviewer | Transport, session-secret migration, resource limits, cancellation and truthful UI tests |
| G-04 | Release reviewer | Browser/Windows/Linux execution evidence, matching manifests/hashes and expiring exceptions |
| G-05 | Repository owner | Approval of exact commit, artifact hashes, audience/channel and publication action; scans no older than 24 hours |

Add **no GitHub Actions**. The owner must choose whether existing workflows are retained, disabled or later hardened; no existing workflow is changed by this plan. Local validation proceeds independently. Existing release logic deliberately skips patch-only versions, so WP-12 must provide a local patch-release path without requiring a minor bump. Any retained publisher must separate read-only builds from narrowly credentialed publication. [Existing release workflow](https://github.com/shakiata/Statusfactory/blob/d0338043169b7af80cedacd2feb838bb705b16a5/.github/workflows/release.yml)

Proposed maintenance targets: weekly full dependency/runtime review, recheck after every lock/native change, and triage a newly reachable high/critical advisory within one business day. These are operating assignments, not scheduled automations. Exceptions require a named owner, applicability evidence, compensating control, expiry and review trigger; untriaged high/critical runtime findings block release.

Rollback is an owner-approved recovery action using a previously verified manifest and compatible nonsecret settings. Do not restore the vulnerable wrapper, unsafe sharing, revoked credentials or an unsupported runtime merely to make a build launch. If no verified safe candidate exists, withhold sharing/distribution while preserving the owner’s usable private dashboard path and recording the unresolved gate.
