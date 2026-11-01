# Owner approval request — Statusfactory 1.5.1 security candidate

**Prepared:** 2026-10-31 · **Register revision:** 1.1 · **Status:** awaiting
owner decisions. Nothing here grants publication, deployment or exception
approval.

## 1. What is ready for review

A local remediation candidate on `security/remediation-2026-10-31` that:

- adopts the repository-local operating kit and OpenCode v2 workflows;
- separates FRM and provider credentials and removes the legacy `ngrok` wrapper;
- makes sharing permit-gated, main-owned and fail-closed (currently disabled
  pending ACT-002);
- implements a serialized tunnel lifecycle with `closure_unknown` recovery and a
  nonsecret ownership marker;
- validates IPC sender/frame/document and typed input, denies navigation/windows/
  permissions and keeps renderer sandboxing;
- migrates FRM tokens to session-only memory and removes legacy durable tokens;
- adds canonical origin/transport policy, rejects authenticated redirects,
  preserves HTTPS/ports and requires LAN plaintext acknowledgement;
- bounds requests, responses, polling and history and rejects stale work;
- upgrades Electron 33.4.11 → 45.2.1, Next 15.5.19 → 15.5.28, React 19.2.7,
  Vitest 5/Vite 8, PostCSS 8.5.32 and electron-builder 26.18.0;
- builds a Linux AppImage plus SBOM/native inventory and hashes.

## 2. Evidence to review

| Evidence | Path |
| --- | --- |
| Phase records and review rounds | `docs/security/IMPLEMENTATION_LOG.md` |
| Canonical register | `docs/security/data/security_plan.json` |
| Release hashes/native inventory | `docs/security/release/RELEASE_EVIDENCE.json`, `NATIVE_INVENTORY.json` |
| SBOM | `docs/security/release/sbom.cdx.json` |
| Full / production audits | `docs/security/evidence/npm-audit.json`, `npm-audit-prod.json` |
| OSV scan | `docs/security/evidence/osv-scan.json` |
| Harness checks | `docs/security/evidence/opencode-harness-checks.md` |
| Runbook / rollback | `docs/security/release/RELEASE_RUNBOOK.md` |

Test result at preparation: **22 files / 225 tests passed**; `tsc --noEmit` and
`npm run build` pass; Chrome headless renders the static export with no CSP
violation. These are local results, not platform or provider certification.

## 3. Gate status

| Gate | Status | Reason |
| --- | --- | --- |
| G-00 | passed | OpenCode v2 discovery/invocation/nested/permission/fresh-session evidence; Codex removed by owner CHG-006 |
| G-01 | **blocked** | Containment is implemented and reviewed, but public sharing is disabled pending ACT-002 and a trusted CLI artifact |
| G-02 | **blocked** | Production audit clean and Electron 45.2.1 resolved; minimatch dev/build advisory needs owner-approved exception; no CLI artifact/Windows runtime evidence |
| G-03 | pass-with-findings (source review) | Contract tests pass; runtime browser/Electron evidence belongs to G-04 |
| G-04 | **blocked** | Windows execution, sandboxed Electron launch and real FRM/provider integration not run |
| G-05 | **not run** | Owner approval required |

## 4. Decisions requested from the owner

1. **G-05 publication approval** — name the exact commit and artifact hashes,
   audience/channel and publication action. Publication is not authorized by this
   document.
2. **ACT-002** — record the supported FRM/mod version and the exact
   protected-endpoint/auth response contract. Until then, sharing remains disabled
   even if probes pass.
3. **Native CLI** — supply an exact ngrok CLI artifact per platform, its reviewed
   SHA-256, and the trusted acquisition path; then approve enabling sharing after
   G-01/G-02/G-03/G-04.
4. **Minimatch exception** — approve or reject an expiring exception for
   `GHSA-g3hv-75wg-m249` (dev/build tooling only, not shipped). Required fields:
   owner, applicability evidence, compensating control, expiry, review trigger.
   The integrator does not self-approve this.
5. **Platform evidence** — provide/authorize owned Windows and Linux machines for
   packaged-runtime tests, and fix the local Electron sandbox helper permissions if
   this host is to be used.
6. **Signing/distribution policy** — decide signing/provenance and whether the
   existing GitHub workflows are retained, hardened or disabled. No workflow was
   changed and no Actions were added.
7. **Credential hygiene** — if any token may have been exposed historically, rotate
   it server-side; deleting a local copy is not revocation.

## 5. Explicit non-claims

- No remediation is claimed for Windows, macOS, a real FRM server or a real
  provider tunnel; those checks are blocked or not run.
- Passing tests do not prove runtime compatibility, provider closure or absence of
  unpublished vulnerabilities.
- The app is not signed; the artifact hash is not publisher identity.
- No purchase, publication, push, deployment, global skill installation,
  production credential or public tunnel was performed.
EOF
