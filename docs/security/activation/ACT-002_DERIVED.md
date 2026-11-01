# ACT-002 — derived FRM authentication contract

**Status:** documented-derived by owner direction, 2026-11-01. This is not a
live-server test and does not replace a real FRM instance check.

## Sources (accessed 2026-11-01 UTC)

- FRM Authentication:
  <https://docs.ficsit.app/ficsitremotemonitoring/latest/json/authentication.html>
- FRM Web Server:
  <https://docs.ficsit.app/ficsitremotemonitoring/latest/webserver.html>

## Derived facts

| Field | Value |
| --- | --- |
| Token generation | Automatically generated when the mod loads |
| Token location | `Configs/FicsitRemoteMonitoring/WebServer.cfg`, `Authentication_Token` key |
| Custom token | Supported by editing the config file; empty regenerates |
| Request header | `X-FRM-Authorization: <token>` |
| Default port | 8080 (configurable) |
| Server start | `/frm http start` (or `Web_Autostart`) |
| Protected surface | All documented API read paths and `sendChatMessage` share the mod's HTTP server/token configuration |
| Unauthenticated result | HTTP 401 (the probe also accepts 403) |
| Authenticated result | 2xx with JSON |

## Selected probe set

`getPower`, `getFactory`, `getWorldInv`, `getPlayer` — nonmutating read endpoints
covering four feature families. Runtime authorization still requires every
probe to return 401/403 anonymously and 2xx with the token.

## Residuals

- No live FRM server was available; response bodies/status codes beyond the
  documented header contract are not observed.
- Endpoint-level authorization is assumed uniform; the four-endpoint probe is
  evidence for those paths, not proof for every path.
- FRM/mod version is the current documentation set, not a pinned game build.
- A future real-server test must confirm the endpoint set and status codes.

## Effect

`electron/sharing-policy.js` records this as `verified: true` with
`source: "documented-derived"`. Sharing still requires a configured provider
credential, a verified CLI artifact, and a successful runtime probe.
