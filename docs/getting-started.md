# Getting Started

## Prerequisites

- **Node.js 22.12 or later** for building; Electron's embedded Node is separate.
- **npm** (bundled with Node.js).
- **Satisfactory** with the [Ficsit Remote Monitoring (FRM)](https://ficsit.app/mod/FRM) mod.
- Optional: a verified ngrok CLI artifact and a provider account for public
  sharing (desktop only). No artifact is bundled in the repository.

---

## Quick Start (Browser)

```bash
git clone https://github.com/shakiata/Statusfactory.git
cd Statusfactory
npm ci --ignore-scripts     # review install scripts before allowing them
npm run dev                 # http://localhost:3000
```

Enter the FRM address, port and token, then Connect. The token is kept in memory
for this tab; it is never written to localStorage.

For the production static export:

```bash
npm run build               # next build + CSP hash injection into out/
npm start                   # static server for out/ on 127.0.0.1:3000
```

`next start` is not valid for `output: 'export'`; `npm start` runs
`scripts/serve-static.mjs`.

---

## Quick Start (Electron Desktop App)

```bash
npm install
npm run electron:dev        # next dev + Electron
```

The app title bar shows "Statusfactory". Renderer sandboxing requires a correctly
installed Electron package; on Linux the `chrome-sandbox` helper must be owned by
root with mode 4755 (or user namespaces must be enabled). Do not run release
validation with `--no-sandbox`.

---

## FRM Configuration

| Setting | Default | Notes |
| --- | --- | --- |
| Host | `localhost` | IP/URL is preserved; HTTPS is never downgraded |
| Port | `8080` | Explicit ports survive normalization |
| Auth Token | _(empty)_ | Session memory only; cleared on reload/origin change/Forget |
| Refresh Rate | `5000` ms | One of 1, 2, 3, 5, 10, 15, 30, 60 s |

Transport rules:

- HTTPS is the default for DNS names; an explicit `https://` is preserved.
- Loopback (`localhost`, `127.0.0.1`, `::1`) may use plain HTTP.
- A private LAN literal may use plain HTTP only after an explicit per-origin
  acknowledgement; public addresses and DNS names over HTTP are refused.
- Authenticated requests never follow redirects.

See `docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md` for the full contract.

---

## Public Sharing (Desktop only)

Sharing exposes the **entire reachable FRM API**, not a screenshot. The app:

1. requires a connected FRM profile and a session token;
2. performs an independent credential-free denial probe and authenticated success
   probe in the main process;
3. issues a single-use, ≤60 s permit;
4. starts one pinned CLI process with a fixed argument array.

Setup inputs that the repository cannot supply:

- a trusted ngrok CLI artifact for each target platform at
  `electron/tunnel/bin/<platform>-<arch>/ngrok`;
- its exact version and SHA-256 in `electron/tunnel/ngrok-artifact.json`;
- a user-only provider credential file at
  `<Electron userData>/ngrok-provider.json` with mode `0600`, containing
  `{"authtoken":"..."}`.

Without these, Share fails closed with an explicit reason. The legacy `ngrok`
npm wrapper is gone; there is no PATH fallback or runtime download.

Public sharing remains unavailable until the source-contract gates, dependency
gate, applicable connection-hardening checks and integrated local verification
pass. A green G-01 alone does not enable it.

---

## Available npm Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js dev server on port 3000 |
| `npm run build` | Static export to `out/` + CSP injection |
| `npm start` | Serve `out/` on loopback |
| `npm test` | Vitest (unit/contract/Electron-module tests) |
| `npm run electron:dev` | Electron + Next dev |
| `npm run electron:build:linux` | Linux AppImage |
| `npm run electron:build:win` | Windows portable (run on Windows for real evidence) |
| `npm run sbom` | CycloneDX SBOM |
| `npm run release:evidence` | Hash/artifact/native inventory |

---

## Build Output

Production artifacts go to `dist/`:

- **Windows:** `Statusfactory 1.5.1.exe` (portable)
- **Linux:** `Statusfactory-1.5.1.AppImage`
- **macOS:** deferred; no owned test/signing path

A Linux build of a Windows artifact is not Windows evidence. Signing is not
configured; artifacts must be labelled unsigned until the owner supplies a
signing policy.

---

## Releases

Existing GitHub workflows are reviewed as source only. This remediation adds no
GitHub Actions. The existing release workflow skips patch-only version bumps, so
the local patch-release path is documented in
`docs/security/release/RELEASE_RUNBOOK.md`. Publication requires the owner's G-05
approval of exact commit and artifact hashes.

---

## Troubleshooting

### "Connection failed"
Check the scheme/host/port shown in the canonical badge, the FRM HTTP server is
running (`/frm http start` in game), and the token matches `WebServer.cfg`. An
authentication failure is shown separately from a transport failure. Plain HTTP
to a public address or DNS name is intentionally refused.

### Blank screen in Electron
Run `node scripts/serve-static.mjs` and open the URL in a browser to isolate a
renderer issue from an Electron issue. Check the main-process log for IPC
rejection codes. Do not disable sandboxing or web security to work around it.

### "Share failed"
Read the displayed category: provider not configured, CLI artifact unverified,
FRM authentication not enforced, token rejected, profile conflict, or closure
unknown. Verify closure before retrying after `closure_unknown`.

### Token was removed after upgrade
This is expected. The legacy `frm-config.password` field is migrated out on first
load. Re-enter the token for the session. Rotate the token server-side if it may
have been exposed; deleting a local copy is not revocation.
