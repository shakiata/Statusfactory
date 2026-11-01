# electron/ instructions

Owner: Desktop implementer. Exclusive task paths: `electron/**`.
Shared policy: `../docs/security/development-policy.md`.
Contracts: `../docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md` sections 7,
10 and 11 (REQ-007, REQ-008, REQ-009, REQ-010, REQ-012, REQ-020, REQ-022).
This guide adds boundary facts; it does not duplicate or expand shared authority.

Purpose and entrypoints: `main.js` owns the window, IPC handlers, the single
connection profile, the sharing permit registry and the tunnel adapter. The
adapter lives in `electron/tunnel/`; `preload.js` exposes only the narrow
`electronAPI` methods.

Allowed dependencies: Electron APIs, Node `child_process`/`fs`/`crypto`/`path`,
and pure helpers under `electron/tunnel/`. Main must never import React or
renderer state.
Forbidden dependencies: renderer code must not reach `ipcRenderer` directly,
filesystem or process APIs; main must not accept a host, executable path,
command line or provider credential from IPC.

Inputs/trust: every IPC payload is untrusted. Validate the sender WebContents,
main frame and exact app document, then the typed fields, before any side
effect. The canonical endpoint policy (`src/lib/connection/contract.ts`) is
mirrored in `electron/tunnel/endpoint-policy.js`; keep them in sync with the
shared fixture test.

Invariants: one owned tunnel process tree; serialized `idle`/`starting`/
`active`/`stopping`/`failed_closed`/`closure_unknown`; no false "stopped";
permits are random, single-use, ≤60 s, bound to sender/profile/generation;
origin/token change, Forget, disconnect, reload, crash and shutdown all run the
same stop path; an unresolved ownership marker forces `closure_unknown`.

State ownership: the pending-ownership marker under Electron `userData` is the
only durable tunnel state and contains no secrets.

Search these helpers first: `electron/tunnel/`, `src/lib/connection/`.
Meaningful tests: `electron/__tests__/*.test.ts` (permit, state machine, marker,
sender guard).
Documentation to update: `docs/electron-integration.md`, this guide.
