# Handoff — continue the Statusfactory security remediation

**Written:** 2026-11-01  
**Repository:** `/home/james/repos/Statusfactory`  
**Branch:** `security/remediation-2026-10-31`  
**Implementation commit:** `38fd5c9`  
**Evidence commit:** `d908a1f`  
**Register revision:** `1.6`  
**Goal ID:** `a49a121c-70a8-48d2-9a4d-b484f55c3074`  
**Goal status:** paused (G-04 evidence unavailable on this host)

---

## 1. How to use this handoff

Start a fresh OpenCode session in the repository and paste:

```text
Read AGENTS.md, docs/security/development-policy.md, docs/security/HANDOFF.md,
docs/security/data/security_plan.json and docs/security/IMPLEMENTATION_LOG.md
before trusting any summary. Continue the Statusfactory security remediation on
branch security/remediation-2026-10-31. Preserve unrelated work, do not publish,
and record evidence by stable ID.
```

Then resume the existing goal:

```text
/resume_goal
```

`/resume_goal` reactivates the paused goal. After it resumes, call `get_goal` (or
`get_goal view=full`) and follow the plan revision 3. If the goal is already
active, do not recreate it. If it is complete/unmet, do not reopen it.

If goal tools are unavailable, continue from this file and the canonical register;
the goal is an index into those records, not a competing source of truth.

---

## 2. Read-first order

1. `AGENTS.md`
2. `docs/security/development-policy.md`
3. `docs/security/data/security_plan.json` (authoritative; revision 1.6)
4. `docs/security/IMPLEMENTATION_LOG.md`
5. `docs/security/OWNER_DECISION_2026-10-31.md`
6. `docs/security/PR_REPORT.md`
7. Applicable local `AGENTS.md` (`electron/`, `src/lib/`, `src/components/`)
8. `git status --short` and `git rev-parse HEAD`

Do not trust an older summary, issue text or PR comment over these records.

---

## 3. Current state

- All implementation phases P0–P5 are complete.
- 24 test files / 230 tests pass; `tsc --noEmit` and `npm run build` pass.
- Linux AppImage: `f168e9b1…5099bc` (269,289,222 bytes).
- Windows portable: `7a5c3dada1e38e0354e2f1a38091a2c38a6c1dc2de8b0d9dd0e3d310e7f54cc8`
  (209,407,477 bytes, unsigned, **not executed**).
- ngrok 3.39.13 pinned for Linux/Windows; Linux real spawn/confirmed teardown
  verified with an invalid dummy token; no tunnel opened.
- Production audit clean; one dev/build minimatch advisory with a recorded
  exception to 2027-01-31.
- Normal/packaged sharing requires a provider credential and runtime FRM probe.
  A dev-only simulator exists (`STATUSFACTORY_TUNNEL_SIMULATOR=1`) and is labelled.

Gate status:

| Gate | Status |
| --- | --- |
| G-00 | passed |
| G-01 | passed |
| G-02 | passed with Windows execution gap |
| G-03 | passed with source-review findings |
| G-04 | **blocked** |
| G-05 | not run |

---

## 4. Remaining work (G-04, then G-05)

### 4.1 Windows execution

1. Copy `dist/Statusfactory 1.5.1.exe` to an owned Windows machine.
2. Verify its SHA-256 before running.
3. Launch, connect to an owned FRM fixture/server, exercise all 12 panels,
   sharing disabled/enabled states, Forget/disconnect, and tunnel closure.
4. Record OS version, artifact hash, commands, screenshots and result under
   `docs/security/evidence/` and `docs/security/release/RELEASE_EVIDENCE.json`.
5. Update `G-04` and WP-11 by stable ID; do not mark passed from a Linux run.

### 4.2 Sandboxed Electron

On a host where either:

```bash
# option A: root-owned setuid helper
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
npx electron .
```

or unprivileged user namespaces are permitted (AppArmor profile updated), run
without `--no-sandbox`. Verify `chrome://sandbox`/process sandbox state and record
the environment. `--no-sandbox` is not acceptable security evidence.

### 4.3 Live provider/FRM closure

With separate owner authorization and isolated credentials:

1. Start the FRM fixture or an owned server; verify the four-endpoint probe.
2. Configure the provider credential file (`userData/ngrok-provider.json`, 0600).
3. Start sharing; verify the public URL and that the FRM API is exposed as scoped.
4. Stop; verify closure by process, provider dashboard and endpoint probe.
5. Kill the main process abruptly; restart and verify `closure_unknown`/recovery.
6. Record results; no real token or provider secret in evidence.

### 4.4 G-05

1. Refresh `npm audit`/OSV within 24 hours of release.
2. Confirm exception expiry/status.
3. Owner approves exact commit, artifact hashes, audience/channel and publication.
4. Publish only through the separately authorized path; never from a build script.

---

## 5. Commands

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
npm run sim:frm
```

Simulation:

```bash
STATUSFACTORY_TUNNEL_SIMULATOR=1 npm run electron:dev
# host 127.0.0.1, port 8099, token sim-token-not-a-secret
```

Artifacts are gitignored; regenerate them from the pinned manifest/digests.
The ngrok binaries are acquired locally under `electron/tunnel/bin/<platform-arch>/`
and excluded from git.

---

## 6. Ownership and safety

- One integrator owns `docs/security/`, `package.json`, `package-lock.json` and the
  canonical register.
- Do not overwrite another worker's files or revert unrelated changes.
- Do not use `npm audit fix --force` or blanket incompatible overrides.
- Do not commit provider/FRM tokens, `.env` files or real tunnel URLs.
- Do not open a public tunnel, publish, deploy or rotate credentials without
  explicit owner authorization.
- Do not claim Windows, sandbox or provider evidence from mocks/simulation.

---

## 7. Evidence and record updates

At each phase boundary update:

- `docs/security/IMPLEMENTATION_LOG.md`
- `docs/security/data/security_plan.json` (increment revision, preserve history)
- `docs/security/tasks/<task>.json`
- `docs/security/release/RELEASE_EVIDENCE.json` / `NATIVE_INVENTORY.json`
- `docs/security/release/OWNER_APPROVAL_REQUEST.md`

A gate is passed only with concrete evidence in
`release_gates[].evidence`; simulation/mocks are labelled and never substituted
for platform/provider evidence.
