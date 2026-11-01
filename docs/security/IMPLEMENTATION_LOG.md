# Implementation log

Append-only phase records for the authorized local remediation. New sessions
must reread the canonical register (`data/security_plan.json`), this log and the
current Git state before trusting an older summary.

---

## P0 — Operating kit and baseline (WP-00)

**Status:** complete · **Gate:** G-00 passed (OpenCode v2, owner-amended
criteria CHG-006) · **Source:** `d0338043169b7af80cedacd2feb838bb705b16a5`
(identical to the reviewed baseline) · **Register revision:** 1.1.

### Verified inputs

- Archive `cee5882eaccda6f5f128f5ea91b35b5ffca658f72039253d7d2c2fdd0ae9fbe1`;
  both copies identical. Extraction safe (1 root dir, no absolute/traversal/
  symlink entries), 287/287 `SHA256SUMS.txt` entries OK.
- Package validator read-only: 34/34 planning checks passed, no
  `--write-reports`. This validates planning artifacts only.
- Tooling: Node v22.22.2, npm 10.9.7, OpenCode v2.1.1, Git 2.53.0, Python
  3.14.4, Linux x86_64. Codex removed from scope by owner (CHG-006).
- Lockfile SHA-256 `237ef37e…655f` matches the reviewed lockfile.
- Clone dirty state: clean; no unrelated work existed.

### Changed files

`AGENTS.md` (rewritten, supersession note for stale token/URL/polling guidance),
`electron/AGENTS.md`, `src/lib/AGENTS.md`, `src/components/AGENTS.md`,
`docs/security/AGENTS.md`, `docs/security/{00…10, PACKAGE_MATCHES}.md`,
`docs/security/data/security_plan.json` (rev 1.1),
`docs/security/templates/agent_guides.md`,
`docs/security/development-policy.md`, `docs/security/AMENDMENTS.md`,
`docs/security/IMPLEMENTATION_AUTHORIZATION.md`,
`docs/security/evidence/*`, `docs/security/tasks/WP-00-task-01.json`,
`.agents/skills/{scope-and-continuity,dependency-triage,boundary-hardening,local-release-verification}/SKILL.md`,
`.opencode/opencode.json` (V2; removed V1 `skills.paths` object),
`.opencode/agents/panel-builder.md` (V2 `permissions` array),
`.opencode/agents/security-reviewer.md` (new),
`.opencode/skills/satisfactory-stats/SKILL.md` (domain-only; stale security
guidance removed).

### Evidence and results

- `evidence/package-verification.txt`, `evidence/tooling-versions.txt`,
  `evidence/opencode-harness-checks.md`.
- OpenCode v2 discovery returned the four canonical IDs from `.agents/skills/`;
  `@boundary-hardening` loaded the exact body; a natural dependency request
  selected `dependency-triage`; nested `electron/AGENTS.md` loaded; the
  `security-reviewer` subagent had no write/shell capability and created no
  file; a fresh session read register revision 1.1 and CHG-006 and treated the
  quoted owner text as data.
- Concurrency: structural ownership only (disjoint task paths; integrator owns
  shared files). A live two-writer race was not executed and is not claimed.

### Reviewer findings / open items

- No application source changed in WP-00.
- Independent reviewer assessment is deferred to the release gate; this log does
  not claim independent review.
- Owner decision CHG-006 removed Codex from harness scope.

### Next unblocked work package

P1 / WP-01 (credential separation and restricted public sharing), then WP-02
(tunnel lifecycle) and WP-03 (IPC/navigation).

---

## P1 — Sharing and desktop boundary containment (WP-01..03)

**Status:** implemented, test-backed · **Gate:** G-01 pending independent review ·
**Requirements:** REQ-007, REQ-008, REQ-009, REQ-010.

### Changed files

`electron/main.js` (rewritten), `electron/preload.js`, `electron/ipc-guards.js`
(new), `electron/frm-probe.js` (new), `electron/provider-credentials.js` (new),
`electron/tunnel/{constants,endpoint-policy,permit-registry,ownership-marker,cli-artifact,cli-adapter,state-machine,service}.js`
(new), `electron/AGENTS.md`, `src/lib/electron.d.ts`,
`src/lib/tunnel-types.ts`, `src/components/ConnectionBar.tsx`,
`src/app/page.tsx`, `electron/__tests__/*`.

### Implemented contracts

- FRM token is no longer accepted by `tunnel:start`; that channel accepts only a
  128-bit single-use permit (`{permitId}`), consumed before any spawn and bound
  to sender/profile/origin/generation and a ≤60 s monotonic expiry.
- Main owns the selected profile and generation. `connection:select` is
  compare-and-set, invalidates permits and awaits tunnel closure before committing
  a new profile; unknown closure returns `recovery-required`.
- `share:authorize` performs a credential-free denial probe and an authenticated
  success probe in main, discards the token, and refuses sharing when
  authentication is not enforced.
- Provider credentials load from a user-only file and reach the CLI only through
  its environment; they never enter argv, renderer state or logs.
- One serialized service owns at most one child. States: idle, starting, active,
  stopping, failed_closed, closure_unknown. Stop during start cancels and tears
  down; late readiness is rejected by generation.
- Teardown waits 5 s graceful, then forces the same owned group and waits 5 s for
  confirmation. Failure is `closure_unknown`, never "stopped".
- A nonsecret ownership marker is written before spawn and cleared only after
  confirmed closure. Startup with a marker enters `closure_unknown`; recovery
  kills only a verified path+creation-identity match.
- IPC handlers validate WebContents, main frame and exact app document before
  typed input. Navigation, window creation, webviews and permissions are denied
  by default; renderer loss triggers the same stop path.
- Legacy `ngrok` npm wrapper and its argv/authtoken path are removed.

### Tests and results

`npx vitest run` → 17 files / 198 tests passed, including lifecycle, permit,
artifact/marker, adapter, endpoint-policy and service concurrency tests.
`npx tsc --noEmit` and `npm run build` pass.

### Open items

- No ngrok binary is available, so real subprocess/provider closure is not
  executed. Wrong-digest/missing-artifact behavior is tested.
- Electron GUI launch is blocked on this host by the sandbox helper permissions
  (see P4); IPC integration is unit-tested, not GUI-tested.

---

## P2 — Dependency and native-runtime repair (WP-04..06)

**Status:** upgrades complete; G-02 **blocked** on owner inputs · **Requirements:**
REQ-002, REQ-003, REQ-011, REQ-012, REQ-013.

### Resolved versions

| Package | Before | After |
| --- | --- | --- |
| electron | 33.4.11 | **45.2.1** (Chromium 156.0.8078.75, Node 24.22.1) |
| next | 15.5.19 | **15.5.28** |
| react / react-dom | 19.x | **19.2.7 / 19.2.7** |
| eslint-config-next | 15.x | **15.5.28** |
| vitest / vite | 3.x / 6.x | **5.0.5 / 8.3.5** |
| @vitejs/plugin-react | 4.x | **6.1.2** |
| postcss | 8.4.31 nested | **8.5.32** (targeted Next override) |
| sharp | transitive | **0.35.5** |
| electron-builder | 25.x | **26.18.0** |
| ngrok (npm) | 5.0.0-beta.2 | **removed** |

Lockfile `f4a9271c…cff76`; production audit **0 vulnerabilities**; full audit
**28 moderate families, 1 advisory** (`GHSA-g3hv-75wg-m249`, minimatch <11.0.1)
in build/dev tooling only. OSV querybatch: 715 packages, 1 unique advisory, same
ID (`evidence/osv-scan.json`).

### Native CLI

`electron/tunnel/ngrok-artifact.json` is a pinned-artifact manifest with empty
`artifacts` (`owner-input-required`). The adapter verifies path, executable magic
and SHA-256 before every start, uses fixed args, no shell and an empty PATH, and
fails closed. No binary is bundled, so a real provider start cannot run.

### Blocking owner inputs

1. Trusted ngrok CLI version + SHA-256 for each supported platform.
2. Explicit decision on the minimatch exception (dev/build DoS, not shipped):
   owner, compensating control, expiry, review trigger. **Not self-approved.**
3. Windows execution evidence and a successful sandboxed Electron GUI launch.

---

## P3 — Connection, session-secret and data-boundary hardening (WP-07..10)

**Status:** implemented, test-backed · **Gate:** G-03 pending independent review ·
**Requirements:** REQ-014..REQ-020, REQ-022.

### Changed files

`src/lib/connection/contract.ts` (new), `src/lib/connection/profile.ts` (new),
`src/lib/request-bounds.ts` (new), `src/lib/api.ts` (rewritten),
`src/lib/useConfig.ts`, `src/lib/useTimeBuffer.ts`, `src/app/page.tsx`,
`src/app/layout.tsx`, `src/app/globals.css`, `src/components/ConnectionBar.tsx`,
`src/components/EndpointList.tsx`, `scripts/postbuild-csp.mjs`,
`scripts/serve-static.mjs`, `src/lib/__tests__/*`.

### Implemented contracts

- Canonical endpoint parser: explicit scheme/port preserved; loopback/private
  literals allowed on HTTP; non-loopback LAN HTTP requires per-origin
  acknowledgement; public/DNS HTTP refused; userinfo/path/query/fragment and
  conflicting ports rejected; IPv6/ULA and IPv4-mapped forms handled.
- Exact-origin session token binding; origin/token change, Forget and disconnect
  clear the token, abort requests, remount panels and stop/select main state.
- Legacy `frm-config.password` removed during a versioned migration; only
  `{schemaVersion, host, port, refreshRate}` is persisted; malformed settings fall
  back safely with a notice.
- Shared bounded client: 15 s deadline, 16 MiB streaming cap, `redirect:'error'`,
  one in-flight per endpoint, four per origin, 2–30 s backoff, structural schema
  validation, typed errors, `abortAllRequests`.
- History capped at 1 h / 720 samples / 64 MiB with ≥5 s sample spacing and
  actual-coverage reporting.
- Chat: 2,000-code-point limit, one in-flight send, no automatic retry.
- Production CSP injected with hashes of inline bootstrap scripts; no
  `unsafe-eval` and no remote script/font sources. Remote Google Fonts removed.
- Browser/desktop security states and keyboard-operable actions implemented in
  `ConnectionBar`.

### Tests and results

Endpoint-policy matrix, profile migration, request bounds, history limits,
redirect/auth/size/schema failures, chat single-flight and stale-generation
behaviour are covered. `npm test` 198/198; `npm run build` + CSP injection
succeeds; Chrome headless rendered the exported app with no CSP violations other
than the expected ignored `frame-ancestors` meta (removed).

### Residuals (recorded, not hidden)

- `style-src 'unsafe-inline'` remains for React/Tailwind inline styles.
- `connect-src http: https:` is broad because the FRM endpoint is user-selected;
  origin binding/redirect rejection are enforced in the client, not by CSP.

---

## P4 — Local release verification (WP-11..12)

**Status:** in progress · **Requirements:** REQ-004, REQ-006, REQ-021, REQ-024,
REQ-029, REQ-030.

### Results

- `npm test`: 17 files, 198 tests passed.
- `npm run build`: Next 15.5.28 static export, CSP injected into 2 HTML files.
- Chrome headless (`google-chrome --headless=new`) loaded `out/` from the local
  static server, rendered "Connect to Your Factory", and logged no CSP violation.
- Linux AppImage built: `dist/Statusfactory-1.5.1.AppImage`
  `4601a072f196700dbfdde06ee717c873cb53055a5044f4a5cb01d78b953626cc`
  (245,155,375 bytes); `app.asar` 125,808,435 bytes, no `node_modules`, tests or
  AGENTS files; `resources/tunnel` contains only the owner README (no binary).
- SBOM (CycloneDX) generated and copied to
  `docs/security/release/sbom.cdx.json`; native inventory records Electron
  45.2.1 / Chromium 156.0.8078.75 / Node 24.22.1.
- Not run / blocked: Windows build and execution (host is Linux); sandboxed
  Electron GUI launch (chrome-sandbox is not root-owned 4755); real FRM/provider
  integration; screen-reader audit; 200% zoom matrix.

See `docs/security/release/RELEASE_EVIDENCE.json` and `NATIVE_INVENTORY.json`.

---

## Independent review round 1 — findings and fixes

Reviewer: separate read-only session (`security-reviewer` role; no edits or
process execution). Findings were actionable and were fixed in the working tree:

| Finding | Fix |
| --- | --- |
| High: probe could authorize a different profile after `connection:select` changed it | `electron/share-authorization.js` snapshots the profile, revalidates id/origin/generation after the probe, and only then issues a permit; tests cover the change-during-probe race. |
| High: origin edits/reloads did not always stop an active tunnel | `page.tsx` calls `tunnelStop` + `connection:select(null)` on origin edits; main treats any non-in-place main-frame navigation/reload as renderer loss and runs the same teardown. |
| Medium: probe covered one endpoint and did not validate bodies | Probe now covers four representative endpoints, requires 401/403 anonymously and 2xx authenticated on each, and drains each body through a 1 MiB bounded reader. |
| Medium: unknown FRM auth coverage did not block sharing | `electron/sharing-policy.js` records ACT-002 as unverified and **disables automatic sharing** (`auth-contract-unverified`) until the owner records the supported FRM version/endpoint contract. This is the selected containment, not a gate pass. |
| Medium: packaged builds could take the dev trust path | `isDev` now requires `!app.isPackaged`; the sender guard binds to the packaged document in release builds. |
| Medium: size limits did not stop body consumption | Probe drains are cancelled at the limit; the client cancels the body when a declared length exceeds the cap. |
| Medium: unreadable marker could look absent; stuck recovery | `readState()` distinguishes absent/unreadable/present; unreadable forces `closure_unknown`; recovery clears a stale marker only when the recorded process is provably gone, and `tunnel:stop` attempts verified recovery. |
| Medium: Stop during Start waited for readiness | Start receives an `AbortSignal`; Stop aborts it so the adapter terminates the owned child immediately, then waits for confirmation. |
| Medium: endpoint-specific shape validation missing | `validateEndpointPayload` requires an array (or `getProdStats.production`) for reads. |
| Medium: migration claimed token removal on write failure | The notice now says removal failed and recommends clearing site data; tests cover both write-failure paths. |
| Low: byte budget used UTF-16 length; permits used wall clock; IPv4-mapped hex parity; CR/LF token | UTF-8 byte accounting with an eviction test; monotonic permit clock; canonical hex mapped-IPv6 handling in both parsers; token pattern rejects CR/LF. |

New tests: share-authorization sequencing, IPC guards, FRM probe, provider
credentials, sharing policy, adapter abort/readiness, unreadable marker. Test
count after fixes: **22 files / 222 tests**.

### Gate position after review

- **G-01:** containment is implemented but public sharing is deliberately
  disabled pending ACT-002 (supported FRM version/auth contract) and a real CLI
  artifact. Gate remains **blocked**, not passed.
- **G-03:** contract tests pass and the reviewed defects are fixed; independent
  re-review and browser/Electron execution evidence are still required before a
  pass can be claimed.

### Independent review round 2 — final fixes

- Recovery now distinguishes `ENOENT`/`ESRCH` from `EACCES`/`EPERM`/unknown
  inspection errors; only proven absence clears a marker, and `pidExists` treats
  `EPERM` as "process exists". Tests cover both.
- History truncation now has a no-eviction test asserting `truncated === false`;
  the eviction paths still set it.
- New tests: 225 total across 22 files.

Reviewer position after round 2: **G-01 blocked** (ACT-002 sharing policy and
real CLI artifact outstanding; containment fail-closed), **G-03 pass-with-findings
for source review only** (runtime browser/Electron evidence belongs to G-04).

---

## Post-resume preparation (owner input templates)

Added non-executing owner input templates and a safe hashing helper; no
application behavior changed.

- `docs/security/activation/ACT-002_TEMPLATE.md`
- `docs/security/activation/TUNNEL_ARTIFACT_TEMPLATE.md`
- `docs/security/activation/MINIMATCH_EXCEPTION_TEMPLATE.md`
- `scripts/hash-tunnel-artifact.mjs` — prints size, SHA-256, executable magic and
  a manifest entry without executing, trusting or installing the binary.

The helper was exercised against a synthetic ELF file (correct digest/magic) and
a text file (reported `unknown/text` with a do-not-record warning). Gates are
unchanged; sharing remains disabled until ACT-002 and a trusted artifact are
recorded.

---

## Simulation fallback for missing activation inputs (owner request)

The owner does not have ACT-002, a real ngrok CLI artifact, Windows access or a
provider account. A clearly labelled local simulation was added; it does **not**
change any gate status.

### Added

- `scripts/fixtures/frm-fixture.mjs` (`npm run sim:frm`) — loopback synthetic FRM
  server requiring a dummy token, representative arrays, no game/network.
- `electron/tunnel/simulator-adapter.js` — dev-only, never packaged-selectable;
  no process, no socket, URL uses reserved `.invalid`.
- `electron/sharing-policy.js` — `getSharingPolicy({simulate})` returns a labelled
  simulated policy only when main sets the dev flag; normal builds still return
  `verified: false`.
- `src/lib/__tests__/integration-frm.test.ts` — real loopback HTTP: probe
  accept/reject, malformed/oversized, and a real cross-origin redirect with zero
  target hits.
- `electron/__tests__/integration-simulation.test.ts` — real service lifecycle
  with the simulator: active `.invalid` URL, confirmed Stop, Stop-during-Start.
- `docs/security/evidence/simulated-integration.md` and Electron GUI capture.

### Results

- Full suite: **24 files / 230 tests passed**; `tsc --noEmit` and
  `npm run build` pass.
- Electron 45.2.1 GUI loaded the static export under Xvfb and displayed the
  SIMULATION MODE banner (`--no-sandbox` used only because this host's
  sandbox helper is not root-owned; not security evidence).
- Simulator mode is enabled only with `!app.isPackaged` and
  `STATUSFACTORY_TUNNEL_SIMULATOR=1`.

### Gate impact

**None.** ACT-002 remains unrecorded, the real CLI artifact is still absent,
Windows execution is still unavailable, and the minimatch exception still needs
an explicit owner decision. G-01/G-02/G-04 remain blocked; G-03 remains a source
pass-with-findings.

---

## Final real-artifact and evidence pass

After the owner asked to finish, the previously deferred inputs were reduced to
real, source-backed evidence:

- **Pinned CLI:** official ngrok **3.39.13** Linux and Windows artifacts acquired
  from the vendor distribution. Linux binary SHA-256 `4399384b…df75f`, Windows
  `5089402d…c8a3`; zip and source URLs recorded in
  `electron/tunnel/ngrok-artifact.json`. Binaries are acquired locally and
  gitignored; packaging includes them.
- **Real process smoke:** `scripts/tunnel-cli-smoke.mjs` verified the digest,
  spawned the real Linux CLI with an invalid dummy provider token, observed
  `exited-before-ready`, and proved `spawned: true` / `confirmedClosure: true`.
  No tunnel opened and no process remained (`evidence/tunnel-cli-smoke.txt`,
  `evidence/tunnel-cli-verification.md`).
- **ACT-002:** documented-derived from the official FRM authentication and web
  server documentation (token in `WebServer.cfg` `Authentication_Token`,
  `X-FRM-Authorization` header, default port 8080, `/frm http start`). Recorded as
  `docs/security/activation/ACT-002_DERIVED.md`; live-server test remains a
  residual.
- **Minimatch:** owner-directed expiring exception recorded to 2027-01-31
  (`activation/MINIMATCH_EXCEPTION_APPROVED.md`).
- **Windows:** portable artifact cross-built (unsigned) and hashed; execution
  still not run.
- **Sandbox:** `--disable-setuid-sandbox` also fails because unprivileged user
  namespaces are denied by AppArmor (`unshare -Ur` fails). Only the `--no-sandbox`
  visual smoke is possible; not security evidence.

Gate outcome: G-01 **passed**; G-02 **passed_with_platform_gap**; G-04 remains
**blocked** on Windows execution, sandboxed Electron and live provider closure.
