# Security remediation report — Statusfactory 1.5.1

**Branch:** `security/remediation-2026-10-31`  
**Implementation commit:** `38fd5c9`  
**Evidence commit:** `d908a1f`  
**Canonical register:** revision `1.6`  
**Prepared:** 2026-11-01

---

## 1. Executive summary

This branch implements the security remediation plan delivered in
`Statusfactory_Security_Review_2026-10-31.zip` against the reviewed baseline
`d0338043169b7af80cedacd2feb838bb705b16a5`.

The local remediation is complete and reviewable:

- credential separation and session-only FRM tokens;
- permit-gated, main-owned public sharing with a documented FRM auth contract;
- serialized tunnel lifecycle with verified teardown and `closure_unknown` recovery;
- validated Electron IPC, navigation and permissions;
- canonical transport/origin policy with redirect rejection and LAN HTTP policy;
- bounded requests, polling and retained history;
- supported dependency graph and a pinned, digest-verified ngrok CLI;
- Linux AppImage and Windows portable candidates, SBOM, native inventory and hashes.

What is **not** claimed: Windows execution, a sandboxed Electron run on this host,
or a live provider authentication/closure test. Those remain gate G-04 items.
Publication remains G-05 and is not authorized by this branch.

---

## 2. Authorization and package verification

The review package records planning-only authorization. This work was performed
under the owner's later implementation instruction, recorded at
`docs/security/IMPLEMENTATION_AUTHORIZATION.md`.

- ZIP SHA-256: `cee5882eaccda6f5f128f5ea91b35b5ffca658f72039253d7d2c2fdd0ae9fbe1`
- Archive safety: one top-level directory; no absolute paths, traversal entries or symlinks
- `SHA256SUMS.txt`: **287/287 OK**
- Planning validator: **34/34 passed**, read-only, no `--write-reports`
- Repository HEAD at clone: reviewed baseline, no intervening changes
- Original package preserved immutably outside the repository

Planning validation verifies package artifacts only; it does not pass application
or release gates.

---

## 3. Operating kit (WP-00 / G-00)

Adopted and verified:

- `docs/security/` canonical register, policy, specification copies and evidence;
- four portable skills under `.agents/skills/`: `scope-and-continuity`,
  `dependency-triage`, `boundary-hardening`, `local-release-verification`;
- root and nested `AGENTS.md` files with ownership and stale-guidance supersession;
- OpenCode v2 config and thin role adapters (`.opencode/config`, `panel-builder`,
  `security-reviewer`);
- documented owner decision CHG-006: OpenCode v2 only; Codex removed from scope.

OpenCode v2 evidence: discovery of all four IDs, `@` invocation, natural trigger,
nested guide loading, deny-by-default reviewer permissions, fresh-session
continuity and untrusted-content handling. See
`docs/security/evidence/opencode-harness-checks.md`.

---

## 4. Security changes by phase

### P1 — Credential and tunnel containment

- Session-only FRM token in browser and desktop; no durable token field.
- Main-owned connection profile and monotonic generation; compare-and-set selection.
- Single-use, 128-bit, ≤60 s sharing permits bound to sender/profile/origin/generation.
- Independent main-process FRM probe over representative protected endpoints;
  anonymous 401/403 and authenticated 2xx required.
- One serialized tunnel service: `idle`, `starting`, `active`, `stopping`,
  `failed_closed`, `closure_unknown`.
- Stop-during-Start aborts readiness; late URLs cannot reactivate.
- Nonsecret ownership marker; verified recovery only; no global process kills.
- IPC sender/main-frame/document validation, typed payload validation, denied
  navigation/window creation/webviews/permissions; renderer loss triggers teardown.
- Legacy `ngrok` npm wrapper removed.

Key files: `electron/main.js`, `electron/preload.js`, `electron/ipc-guards.js`,
`electron/frm-probe.js`, `electron/share-authorization.js`,
`electron/sharing-policy.js`, `electron/tunnel/*`, `src/components/ConnectionBar.tsx`.

### P2 — Dependencies and native CLI

| Package | Before | After |
| --- | --- | --- |
| electron | 33.4.11 | **45.2.1** |
| next | 15.5.19 | **15.5.28** |
| react / react-dom | 19.x | **19.2.7** |
| vitest / vite | 3.x / 6.x | **5.0.5 / 8.3.5** |
| postcss | 8.4.31 nested | **8.5.32** |
| electron-builder | 25.x | **26.18.0** |
| ngrok (npm) | 5.0.0-beta.2 | **removed** |

Runtime: Electron 45.2.1 / Chromium 156.0.8078.75 / Node 24.22.1.

Native CLI: ngrok **3.39.13**, official vendor distribution.

- Linux binary SHA-256 `4399384bf4d6a5ad65136770a931536db9e97911f52686e3419dc434a74df75f`
- Windows binary SHA-256 `5089402d3a5cb601d75e98231c799c1b770b894a381190a5a1c2f4a57482c8a3`
- Manifest: `electron/tunnel/ngrok-artifact.json`
- Real Linux spawn with invalid dummy token: `spawned: true`,
  `confirmedClosure: true`, no tunnel, no surviving process.
- Binaries are acquired locally, excluded from git, and included in packages.

Dependency scans:

- production audit: **0 vulnerabilities**
- full audit: **1 advisory / 28 moderate families** from
  `GHSA-g3hv-75wg-m249` (minimatch <11.0.1) in dev/build tooling only
- OSV: 715 packages, same single advisory
- exception recorded to 2027-01-31 in
  `docs/security/activation/MINIMATCH_EXCEPTION_APPROVED.md`

### P3 — Transport, session, bounds and UI

- Canonical endpoint parser: preserves scheme/port, rejects userinfo/path/query,
  private/loopback HTTP, LAN acknowledgement, IPv6/ULA and mapped IPv4.
- Exact-origin credential binding; origin/token change clears the token and work.
- Authenticated requests use `redirect: "error"`; redirect targets receive no request.
- Legacy `frm-config.password` removed by versioned migration; only nonsecret profile
  fields persist; malformed records recover safely; Forget implemented.
- 15 s deadline, 16 MiB streaming cap, four in-flight requests per origin,
  2–30 s backoff, structural payload validation and stale-generation remounting.
- History capped at 1 h / 720 samples / 64 MiB; 5 s sampling.
- Chat: 2,000 code points, single-flight, no automatic resend.
- Production CSP injected with hashes of inline bootstrap scripts; no `unsafe-eval`,
  no remote scripts/fonts.
- Accessible connection/sharing/error/unknown states; keyboard-operable controls.

---

## 5. Verification evidence

| Check | Result |
| --- | --- |
| Unit/contract/adversarial tests | **24 files / 230 tests passed** |
| TypeScript | `tsc --noEmit` passed |
| Production build | passed; CSP injected into 2 HTML files |
| Browser smoke | Chrome headless rendered the export with no CSP violations |
| Electron GUI smoke | window rendered under Xvfb; simulation banner visible |
| Loopback FRM integration | real 401/200 probe, malformed/oversized, cross-origin 302 with **zero** target hits |
| Real CLI process | spawn + exit + confirmed closure, no tunnel |
| Linux package | AppImage built |
| Windows package | portable cross-built, unsigned, not executed |
| SBOM | CycloneDX generated |

Test oracles name their requirement IDs, fixtures, isolation assumptions and
review triggers in the test headers.

---

## 6. Artifacts and hashes

| Artifact | SHA-256 | Size |
| --- | --- | --- |
| `dist/Statusfactory-1.5.1.AppImage` | `f168e9b11a6fca815763c14fd04264a2d8db639b7804b47596cc3256555099bc` | 269,289,222 |
| `dist/Statusfactory 1.5.1.exe` | `7a5c3dada1e38e0354e2f1a38091a2c38a6c1dc2de8b0d9dd0e3d310e7f54cc8` | 209,407,477 |
| `app.asar` | `6f065af0e01001c5fa831e6c60d64bfba51aa7d6c49080471b16db0c4834cc8f` | 125,826,588 |
| SBOM | `9084b9d01967caac95c472fb53fecb78440ed8e26a4861f35da2258a062fe3e1` | 1,072,027 |
| `package-lock.json` | `f4a9271ce6792b906a21e58977c4452403aadae3aca14ca44d428dea8d3cff76` | 386,412 |

Artifacts are **unsigned**. Checksums identify bytes, not publisher identity.
`docs/security/release/RELEASE_EVIDENCE.json` is the machine-readable record.

---

## 7. Gate status

| Gate | Status | Basis |
| --- | --- | --- |
| G-00 baseline/kit | **passed** | package/baseline + OpenCode v2 matrix |
| G-01 sharing containment | **passed** | permits, probe, IPC, lifecycle, real CLI teardown |
| G-02 dependencies/CLI | **passed with platform gap** | clean production graph, pinned CLI, scans; Windows execution not run |
| G-03 connection/data | **passed with findings** | contract tests + source review; runtime evidence partial |
| G-04 release verification | **blocked** | Windows execution, sandboxed Electron, live provider closure |
| G-05 publication | **not run** | owner approval required |

Public sharing requires a configured provider credential and a successful runtime
FRM probe. No real provider tunnel was opened in this work.

---

## 8. Residual risks and deferred checks

1. **Windows execution** — portable artifact cross-built only.
2. **Sandboxed Electron** — this host denies unprivileged user namespaces and
   `chrome-sandbox` is not root-owned 4755; `--no-sandbox` was used for visual
   inspection only and is not security evidence.
3. **Live provider closure** — no provider account or public tunnel test.
4. **Live FRM contract** — ACT-002 is derived from official documentation, not a
   live server; runtime probe still required.
5. **Minimatch** — dev/build advisory accepted only through 2027-01-31.
6. **CSP** — `style-src 'unsafe-inline'` and broad `connect-src` remain documented
   compatibility residuals; origin binding/redirect rejection are enforced in code.
7. **Signing** — artifacts unsigned.

---

## 9. Goal progress

- Goal ID: `a49a121c-70a8-48d2-9a4d-b484f55c3074`
- Plan revision: **3**
- Phases P0–P5: **completed**
- Goal status: **paused** — completion audit requires real G-04 evidence
  (Windows execution, sandboxed Electron, live provider closure).
- The blocking condition is evidence availability, not unimplemented source work.

Continuation instructions are in `docs/security/HANDOFF.md`.

---

## 10. Reproduction

```bash
npm ci --ignore-scripts
npm rebuild electron
npm test
npm run build
npm run electron:build:linux
npx electron-builder --win portable
npm run sbom
npm run release:evidence
node scripts/tunnel-cli-smoke.mjs
```

Synthetic FRM server / simulation:

```bash
npm run sim:frm
STATUSFACTORY_TUNNEL_SIMULATOR=1 npm run electron:dev
# token: sim-token-not-a-secret
```

---

## 11. Non-claims

- No Windows execution or sandboxed Electron certification.
- No live provider authentication, public endpoint closure or FRM server test.
- No compatibility guarantee beyond the executed tests.
- No security certification or absence of unpublished vulnerabilities.
- No purchase, publication, deployment, push of releases, production credential
  or public tunnel as part of this remediation.

---

## 12. Review pointers

- `docs/security/IMPLEMENTATION_LOG.md` — phase and review records
- `docs/security/data/security_plan.json` — canonical register
- `docs/security/release/RELEASE_RUNBOOK.md` — build, patch, rollback, recovery
- `docs/security/release/OWNER_APPROVAL_REQUEST.md` — remaining owner decisions
- `docs/security/HANDOFF.md` — agent continuation instructions
