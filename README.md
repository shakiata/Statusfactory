# Statusfactory

A desktop stats dashboard for Satisfactory, powered by [Ficsit Remote Monitoring](https://docs.ficsit.app/ficsitremotemonitoring/latest/index.html). Built with a static Next.js export plus an Electron shell.

## Prerequisites

| Tool | Why |
| --- | --- |
| [Node.js](https://nodejs.org) 22.12+ | Build/test toolchain (Electron embeds its own Node) |
| npm (ships with Node) | Package manager |
| Satisfactory with [FRM mod](https://ficsit.app/mod/FicsitRemoteMonitoring) | Data source |
| A verified ngrok CLI artifact | Optional; required only for public sharing |

## Quick Start

```bash
npm ci --ignore-scripts     # review install scripts before allowing them
npm run dev                 # browser at http://localhost:3000
npm run electron:dev        # Electron + Next dev
```

Production:

```bash
npm run build               # static export to out/ + CSP hash injection
npm start                   # serve out/ on 127.0.0.1:3000
npm run electron:build:linux
npm run electron:build:win  # run on Windows for real platform evidence
```

## Configuration

1. Enter the FRM host and port (default `localhost:8080`). Explicit HTTPS and
   non-default ports are preserved.
2. Enter the FRM API token. It is **session memory only** — never written to
   localStorage, and cleared on reload, origin change, Forget or disconnect.
3. Connect.

Plain HTTP is allowed for loopback and, after an explicit per-origin
acknowledgement, private LAN literals. Public addresses and DNS names must use
HTTPS. Authenticated requests never follow redirects.

FRM server setup: `/frm http start` in the Satisfactory chat console.

## Sharing

Sharing exposes the **entire reachable FRM API** through a provider tunnel, not a
screenshot. The desktop app requires a connected profile and token, verifies FRM
authentication in the main process, then starts one pinned CLI process with a
single-use permit.

Setup (owner-supplied; nothing is bundled):

1. Put the exact vendor CLI at `electron/tunnel/bin/<platform>-<arch>/ngrok`.
2. Record its version and SHA-256 in `electron/tunnel/ngrok-artifact.json`.
3. Create `<Electron userData>/ngrok-provider.json` with mode `0600` containing
   `{"authtoken":"..."}`.

Sharing fails closed when the artifact, provider credential or FRM authentication
probe is missing or ambiguous. This release candidate also disables automatic
sharing until the owner records the supported FRM version and authentication
coverage (ACT-002), because a probe cannot prove every exposed endpoint is
protected. Public sharing stays disabled until the recorded
security gates are satisfied; a source-contract pass alone is not enough.

## Maintaining Statusfactory

Start with `docs/security/00_START_HERE.md`, `docs/security/development-policy.md`,
the current register (`docs/security/data/security_plan.json`) and the owning
directory's `AGENTS.md`/README. The source and a release artifact are different
identities: record the current commit and built artifact hashes.

Inspect without changing:

```bash
git status --short
git rev-parse HEAD
rg "<symbol>" src electron
```

Validate in an authorized worktree with `npm test && npm run build`. Dependency
installation downloads packages and may run lifecycle scripts; use the reviewed
procedure, never `npm audit fix --force`. Record actual Node/npm/Electron
versions, commands, exit status and evidence; do not label a command verified
because it appears here.

Canonical agent workflows live in `.agents/skills/`: `scope-and-continuity`,
`dependency-triage`, `boundary-hardening`, `local-release-verification`
(OpenCode v2 loads them with `@<id>`).

For endpoint/token/connection behavior read
`docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md`. For release, rollback,
credential incidents and dependency maintenance read
`docs/security/06_SECURITY_AND_OPERATIONS.md`. Remove secrets before sharing logs.
Report suspected credential exposure privately through an owner-confirmed
channel; never include a live credential in a public issue or fixture.

## Documentation

| Document | Topic |
| --- | --- |
| [getting-started.md](./docs/getting-started.md) | Setup, scripts, transport policy, troubleshooting |
| [architecture.md](./docs/architecture.md) | System design, data flow, build pipeline |
| [api-client.md](./docs/api-client.md) | Bounded FRM client and endpoint registry |
| [hooks.md](./docs/hooks.md) | useConfig migration, bounded history, theme |
| [electron-integration.md](./docs/electron-integration.md) | Main/preload/IPC, tunnel lifecycle, recovery |
| [testing.md](./docs/testing.md) | Contract tests, fixtures and conventions |
| [security/](./docs/security/) | Canonical register, policy, evidence and release records |

## Running Tests

```bash
npm test            # unit, contract and Electron-module tests
npm run test:watch  # watch mode
npm run build       # production export + CSP
```
