# Release runbook — Statusfactory 1.5.1 security candidate

**Status:** local release candidate prepared for owner review. **Not published,
not signed, not deployed.** Publication requires G-05 approval of the exact
commit and artifact hashes in `RELEASE_EVIDENCE.json`.

## 1. Candidate identity

| Item | Value |
| --- | --- |
| Version | 1.5.1 (patch) |
| Branch | `security/remediation-2026-10-31` |
| Source | remediation commit recorded as `source.head` in `RELEASE_EVIDENCE.json` |
| Build Node / npm | v22.22.2 / 10.9.7 |
| Electron | 45.2.1 (Chromium 156.0.8078.75, Node 24.22.1) |
| Lockfile SHA-256 | `f4a9271ce6792b906a21e58977c4452403aadae3aca14ca44d428dea8d3cff76` |
| AppImage SHA-256 | `a878a8f08c5a29993dd4a7b0488328b5ed3b2fc7e9554020c25661300d512862` |
| AppImage size | 245,161,240 bytes |
| app.asar SHA-256 | `38dc925c050792ef851ca319497a93d65eac652028cd9e214556f58b0f186c61` |
| SBOM SHA-256 | `3e4db169660c63b3ec3597fb6eb9427e01f0c2591d7e23d941b3b2f7386a7258` |

Artifacts are **unsigned**. A checksum identifies bytes, not publisher identity.

## 2. Build inputs and commands

```bash
npm ci --ignore-scripts                  # reviewed; no lifecycle scripts
npm rebuild electron                     # reviewed download of Electron 45.2.1
npm test                                 # 22 files, 225 tests
npm run build                            # Next static export + CSP hashes
npm run electron:build:linux             # AppImage
npm run sbom                             # CycloneDX SBOM
npm run release:evidence                 # hashes + native inventory
```

The build does not receive repository-write or publishing credentials. No
GitHub Actions were added or changed.

## 3. Verification evidence

- `docs/security/release/RELEASE_EVIDENCE.json` — exact source/artifact hashes.
- `docs/security/release/NATIVE_INVENTORY.json` — native runtime and packaged
  resources.
- `docs/security/release/sbom.cdx.json` — CycloneDX SBOM.
- `docs/security/evidence/npm-audit.json` (full) and
  `npm-audit-prod.json` (production: 0 vulnerabilities).
- `docs/security/evidence/osv-scan.json` — 715 packages, 1 advisory.
- `docs/security/evidence/opencode-harness-checks.md` — harness evidence.
- `docs/security/IMPLEMENTATION_LOG.md` — phase and review records.

## 4. Known residuals and open gates

| Item | Status / owner action |
| --- | --- |
| `GHSA-g3hv-75wg-m249` minimatch <11.0.1 (dev/build tooling only) | **Owner approval required** for an expiring exception; no compatible parent fix in electron-builder 26.18.0 / eslint 9 chain. Not shipped in the app. |
| Public sharing | Disabled (`auth-contract-unverified`). Owner must record ACT-002 (supported FRM version and endpoint/auth contract), supply a trusted CLI artifact + digest, and approve enabling after G-01/G-02/G-03/G-04. |
| Windows build/execution | Not run on this Linux host. Build on an owned Windows machine and record the result. |
| Sandboxed Electron GUI launch | Blocked locally: `node_modules/electron/dist/chrome-sandbox` is not root-owned mode 4755. Owner/sudo fix: `sudo chown root:root …/chrome-sandbox && sudo chmod 4755 …/chrome-sandbox`. Do not validate with `--no-sandbox`. |
| Real FRM/provider integration | Not run; no live token or public tunnel authorized. Dev-only simulation evidence exists (`evidence/simulated-integration.md`) and does not satisfy this row. |
| Signing/provenance | Not configured; artifacts are unsigned. Owner supplies policy. |
| macOS | Deferred (no owned test/signing path). |

## 5. Patch-release path

The existing release workflow skips patch-only version bumps. For a local or
owner-run patch release:

1. Build and verify from the exact commit with the commands above.
2. Re-run `npm audit` and `npm run release:evidence`.
3. Record new artifact hashes in `RELEASE_EVIDENCE.json`.
4. Obtain G-05 approval naming commit, artifact hashes, audience/channel and the
   publication action.
5. Publish only through the owner-approved channel; keep build credentials
   separate from publication credentials.
6. Retain secret-free evidence for 12 months after the version is superseded.

## 6. Rollback and recovery

- **Rollback:** restore the previously verified commit/artifact pair and its
  nonsecret settings. Never restore a revoked FRM token, unsafe sharing behavior,
  the `ngrok` npm wrapper or an unsupported Electron runtime merely to make the
  app launch.
- **Tunnel closure unknown:** the app blocks new sharing. Verify the endpoint in
  the provider account and the OS process list; retry Stop only after verifying
  closure. The app never kills an unverified PID.
- **Suspected credential exposure:** follow
  `docs/security/06_SECURITY_AND_OPERATIONS.md` section 4. Rotate the FRM token
  server-side; deleting a local copy is not revocation.
- **Settings recovery:** nonsecret profile only. A malformed legacy record is
  reset; if reset fails, clear site data manually. Do not restore old tokens.

## 7. Maintenance

- Weekly full dependency/runtime review; recheck after every lock or native
  change.
- Triage a newly reachable high/critical advisory within one business day.
- Recheck Electron support before each distribution; track the supported
  Chromium/Node pair.
- Exceptions must name an owner, applicability evidence, compensating control,
  expiry and review trigger.
EOF
