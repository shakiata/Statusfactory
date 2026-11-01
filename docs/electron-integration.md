# Electron Integration

Statusfactory's Electron shell loads the static Next export and owns the native
tunnel capability. The renderer never receives filesystem, process or provider
credentials.

Contract: `docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md` sections 7, 10, 11
(REQ-007–REQ-010, REQ-012, REQ-020, REQ-022).

---

## Process boundaries

```text
Main (electron/main.js)
├── one BrowserWindow (nodeIntegration:false, contextIsolation:true, sandbox:true)
├── one connection profile {id, origin, generation, target}
├── permit registry (128-bit, single-use, <=60 s)
├── FRM auth probe (credential-free denial + authenticated success)
├── one tunnel service + one owned CLI process tree
└── nonsecret ownership marker under userData

Preload (electron/preload.js)
└── connectionSelect, shareAuthorize, tunnelStart, tunnelStop, tunnelStatus,
    onTunnelState

Renderer (src/)
├── session token in page.tsx memory only
├── ConnectionBar (connection + sharing UI)
└── panels using the shared bounded API client
```

`electron/tunnel/` contains the adapter, state machine, permit registry,
ownership marker, endpoint policy and CLI artifact verification. The adapter,
state machine, permits, marker, policy, provider loader, authorization sequencing
and service are unit-tested under `electron/__tests__/`; the `main.js` wiring is
not GUI-integration-tested on this host.

---

## IPC channels

| Channel | Input | Notes |
| --- | --- | --- |
| `connection:select` | `{origin, expectedGeneration}` | compare-and-set; stops any owned tunnel and awaits closure; null disconnects |
| `share:authorize` | `{profileId, generation, frmToken}` | main probes FRM auth, then issues one permit; token discarded |
| `tunnel:start` | `{permitId}` | permit consumed before spawn; no host/path/credential accepted |
| `tunnel:stop` | empty | idempotent, bounded, reports confirmed/unknown |
| `tunnel:status` | empty | authoritative state; URL only while active |
| `tunnel:state` event | state object | pushed on every transition |

Every handler first validates the sender WebContents, main frame and exact
application document (`electron/ipc-guards.js`), then the typed payload.

---

## Tunnel lifecycle

```text
idle -> starting -> active -> stopping -> idle
             \-> failed_closed (closure confirmed)
             \-> closure_unknown (closure not proven)
```

- One child maximum; concurrent starts return `already-starting`/`busy`.
- Stop during start cancels the pending operation and tears down the owned child.
- A late readiness URL cannot reactivate a stopped operation (generation check).
- Child output is parsed as JSON and retained only as a 64 KiB tail.
- Stop waits 5 s for graceful exit, then forces the same owned process group and
  waits 5 s for confirmation. Anything else is `closure_unknown`.
- Origin/token change, Forget, disconnect, renderer crash and window close all
  invalidate permits and run the same stop path.

---

## Ownership marker and recovery

Before spawning, main atomically writes `userData/tunnel-ownership.json` with the
operation/app-session IDs and executable identity; the PID and Linux creation
identity are added after spawn. The marker contains no token. It is removed only
after confirmed closure.

On startup an existing marker forces `closure_unknown`. Recovery terminates a
surviving process only when the recorded executable path, creation identity and
current PID all match. Unverified processes are never killed; the UI shows manual
provider/OS recovery guidance instead.

---

## Sharing authorization

`share:authorize` performs two probes against representative protected endpoints
(`getPower`, `getFactory`, `getWorldInv`, `getPlayer`):

1. every credential-free request must return 401/403;
2. every authenticated request must return 2xx.

If authentication is not enforced on any probed endpoint, the token is rejected,
or a probe fails, sharing is blocked. This is evidence about the probed set, not
a proof for every endpoint reachable through the tunnel. Because ACT-002 (the
supported FRM version and exact auth contract) is still an owner input,
`electron/sharing-policy.js` **disables automatic sharing entirely** in this
release candidate (`auth-contract-unverified`). A nonempty password field
is never accepted as proof. The FRM token is used only for these probes and the
renderer's direct reads; provider credentials are read from
`userData/ngrok-provider.json` (mode 0600) and passed to the CLI through its
environment only.

---

## Native CLI

`electron/tunnel/ngrok-artifact.json` is the pinned-artifact manifest. The adapter
launches a fixed absolute path, verifies SHA-256 and executable magic before every
start, uses a fixed argument array without a shell, empties `PATH`, and fails
closed when the artifact is missing or mismatched. The current repository ships
no binary; the owner must supply a trusted artifact and digest. The legacy
`ngrok` npm wrapper is removed.

---

## Content policy

`nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`,
`webSecurity:true`. Navigation and window creation are denied unless the target
is the exact application document. Permission requests are denied by default.
No remote fonts or executable remote scripts are loaded. A production CSP is
injected after `next build` by `scripts/postbuild-csp.mjs` using hashes of the
static export's inline bootstrap scripts.

`frame-ancestors` is ignored in a `<meta>` CSP; browser deployments that need
anti-framing must send it as an HTTP header from their static host. Electron does
not embed the app in a frame.

---

## Local commands

```bash
npm run electron:dev      # next dev + Electron
npm run build             # static export + CSP injection
npm run electron:build:linux
npm run electron:build:win
```

Electron's embedded Node (24.22.1 in 45.2.1) is separate from the build Node
(22.22.2 in this environment). Release evidence records both.
