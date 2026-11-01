# Domain and security contracts

Status: design for owner implementation, 2026-10-31. Applies to source baseline `d0338043169b7af80cedacd2feb838bb705b16a5`. These contracts preserve direct FRM access, browser use, Electron desktop use, local/LAN hosts and remote HTTPS tunnels. The numerical values below are selected initial defaults for implementation and fixture validation, not measured capacity claims. The integrator reconciled these values with ADR-003/005 and the roadmap. They remain proposed acceptance targets, not implemented behavior.

## 1. Endpoint identity and transport

Use one canonical endpoint model: `{scheme, hostname, effectivePort, origin}`. The canonical origin is the WHATWG URL origin, including a non-default port. The same parser owns connection display, token lookup, API Explorer and chat requests. Do not keep independent URL logic in each component.

Accept HTTP or HTTPS only. Reject URL username/password, non-root pathname, query, fragment, invalid numeric ports and malformed host syntax. A port must be an integer from 1 to 65535. IPv6 literals must use bracket notation when combined with a port. Reject conflicting explicitly entered ports, or update the visible separate Port field when a complete URL is pasted; never silently discard either value. Add the selected endpoint path from the internal endpoint registry, never from arbitrary remote response text.

Preserve an explicit HTTPS scheme. Certificate failure ends that attempt; it must not produce an HTTP retry. A bare DNS host defaults to HTTPS. Existing bare loopback/LAN configurations remain usable through the plaintext policy below. If private-address classification is needed, parse an actual address and use the exact RFC1918 ranges; a DNS name beginning with `10.` is still a DNS name, and all `172.*` addresses are not private.

Credentials belong to an exact normalized origin, not to a textual Host input or registrable domain. Changing the origin invalidates the connection generation, cancels all outstanding work and clears the live token selection. Re-entering or explicitly selecting a token for the new origin is required. Changing only a refresh preference must not clear credentials or start a second connection.

## 2. Plaintext compatibility policy

HTTPS is the default for non-loopback endpoints. Preserve deliberate `http://localhost`, `http://127.0.0.1` and `http://[::1]` compatibility for a local game; identify that traffic as local HTTP. Do not tell users that loopback prevents malicious software on their own machine from accessing data.

Allow non-loopback LAN HTTP only after an explicit per-origin acknowledgement stating that the FRM token and factory/chat data travel without encryption. Display the effective destination and `HTTP — unencrypted` persistently while connected. This is a compatibility choice, not a security certification for private networks. The acknowledgement is session-only nonsecret state keyed to exact origin. Reconfirm it after restart or origin change; it cannot authorize a different origin. Permit plain HTTP only for localhost/loopback and parsed RFC1918 IPv4 or IPv6 ULA (fc00::/7) literals. Reject public literals, other special-use addresses and plain HTTP DNS names; a LAN DNS user can enter the private literal or use HTTPS. This conservative policy is identical in browser and Electron and avoids claiming that a browser has verified DNS locality. Normalize IPv4-mapped IPv6 before classification; reject ambiguous numeric host spellings and zone identifiers. A later wider hostname policy needs an explicit reviewed decision, not a prefix heuristic.

Neither an HTTPS tunnel nor a familiar DNS suffix proves FRM authentication. The tunnel's public TLS connection and the upstream LAN transport are separate legs. Sharing needs its own server-side authentication gate; the connection form's password being nonempty does not verify that gate.

## 3. Requests, redirects and write behavior

Every FRM request uses the shared transport. Authenticated GETs and chat POSTs set `redirect: "error"`; reject all 301, 302, 303, 307 and 308 responses. Configure the final canonical origin instead of transparently following redirects. Checking a final URL after the request completes is too late to protect a header already sent. API Explorer must not bypass this rule.

Attach `X-FRM-Authorization` only to the selected origin and omit it when no token was supplied. Do not put tokens in URLs, query strings, browser navigation, logs, clipboard output, exception text or telemetry. Match ngrok-specific compatibility behavior using parsed host boundaries rather than a substring search. This header is not an authorization policy or an excuse to disable browser web security.

Chat is a write. Use one in-flight send per connection, preserve the draft until acknowledged, and impose a 2,000-code-point draft limit with an explanatory counter. Do not automatically retry an ambiguous POST: the FRM API has not been shown to support idempotency keys. After a timeout or connection change, tell the user that delivery is unknown and ask them to inspect chat before resending. Server-side limits and privileges remain FRM's responsibility.

## 4. Bounded parsing, polling and retention

Select an initial 15-second deadline covering connection, headers and body consumption; caller cancellation takes precedence. Limit each decoded response body to 16 MiB (16,777,216 bytes), regardless of Content-Length. A streaming body reader must stop and abort at that boundary. Header values alone cannot establish the received size.

Validate each known endpoint at the transport boundary: correct top-level collection/object, required scalar fields, finite numeric values, documented optional fields and identifier syntax. Select an initial maximum of 50,000 top-level entities per endpoint, 4,096 code points for general textual fields, 256 for names/identifiers and a JSON nesting limit of 32. Use an iterative validator or equivalent bounded traversal. Endpoint-specific legitimate exceptions must have a fixture and an explicit documented limit; do not disable all validation after encountering one large save.

The default poll interval remains 5,000 ms; accept only the existing UI choices from 1,000 to 60,000 ms. Invalid saved settings revert to the documented default with a recoverable notice. There is at most one request in flight per origin/endpoint and four total data requests per connection. Schedule the next poll after completion rather than queuing interval ticks. Failed reads back off through 2, 4, 8, 16 and 30 seconds, remaining capped at 30 seconds; an explicit user Retry can make one immediate attempt.

Connection changes and component unmounts abort outstanding work. Each response carries a local connection generation and request sequence; only the current generation may update state. An older result cannot overwrite a newer snapshot or mark another server connected.

History remains ephemeral with an upper time limit of one hour. Sample retained history at most every five seconds, cap it at 720 samples and 64 MiB of accounted retained telemetry per active panel, and evict oldest samples when any limit is reached. Show actual retained coverage; an hour selector must not imply an hour of data exists. Keep live polling separate from history sampling. Retain only fields needed by supported views rather than cloning entire unused response trees.

Review limits using anonymized small, typical and largest available factory fixtures. Record decoded bytes, entity counts, peak memory and UI response time. A legitimate fixture exceeding a limit triggers documented tuning or aggregation, never a claim that the fixture is malicious. No benchmark was executed during this review.

## 5. Credential lifecycle and migration

Browser tokens are session-memory data by default. Persist host, port and display preferences without the token or session transport acknowledgement. Do not substitute sessionStorage or base64 for protection. Both remain available to renderer JavaScript.

For this security release, Electron also keeps FRM tokens in session memory. Protected opt-in persistence is deferred under ADR-003. If separately authorized later, use an origin-keyed main-process store, verify the chosen Electron APIs and fail to session-only when the platform has no protected backend. Do not add a plaintext fallback or claim that OS protection defeats a compromised same-user process.

A one-time versioned migration removes legacy `frm-config.password` without destroying nonsecret preferences. It does not claim secure erasure of historical profile copies or backups. Forget Token clears memory and any obsolete legacy records, cancels authenticated work and leaves the connection disconnected. Do not export secrets in settings or diagnostic bundles. The owner must provide server-side token rotation instructions for users who may have disclosed a token; an app-local delete does not revoke an FRM credential.

## 6. Observable security UX and tests

| State | Visible behavior | Required action |
| --- | --- | --- |
| Invalid endpoint | Explain the exact invalid field; show no Connected state | No request or secret lookup |
| HTTP LAN acknowledgement pending | Show effective origin and plaintext impact | No credentialed request until accepted |
| Connecting | Destination and cancel control remain visible | Disable duplicate Connect; permit safe edits by invalidating generation |
| Redirect rejected | Explain canonical endpoint configuration | No request reaches the redirect target |
| Malformed/oversized/timed-out response | Keep last valid values marked stale with time and reason | Bounded retry or explicit Retry |
| Origin changed/forgotten token | Disconnected, live token cleared | Abort old work and ignore late results |
| Chat delivery unknown | Preserve draft and indicate possible prior delivery | No automatic resend |

Use labelled controls, keyboard-accessible actions, focus on errors without trapping users, and text as well as color for insecure/stale states. Security-review deliverables need this contract and exact state table; generated UI mockups would not verify the controls and are not applicable to this audit.

Tests use isolated dummy tokens, controlled clocks and barriers. Exercise each redirect status against two local fixture origins with explicit CORS, repeat in a supported browser and the upgraded Electron runtime, and assert the target receives no credential. Test delayed A-to-B connection races, cancellation during a streamed body, malformed valid JSON, retained-history limits, session-only restart behavior and migration recovery. Review fixture limits when FRM schemas or supported game versions change. These are future acceptance gates, not tests already passed.


## 7. Tunnel capability and state machine

The main process owns exactly one automatic-share operation and its child. Its states are `idle`, `starting`, `active`, `stopping`, `failed_closed` and `closure_unknown`. A monotonically increasing operation generation invalidates late completion. Status includes generation, state, approved profile ID, a public URL only while verified active, and a redacted error category. No token is returned.

| Event | Required transition and invariant |
| --- | --- |
| Start in idle/failed_closed | Validate main-frame sender, selected FRM target/auth policy and immutable CLI identity; create one owner; enter starting. |
| Start while starting/active/stopping | Return typed already-starting/active/busy state or the existing operation result; never create a second child. |
| Readiness success | Accept only a supported structured event from the current owned child/generation; verify the HTTPS public URL; enter active. |
| Startup timeout/error | Terminate the owned child and await exit; enter failed_closed only after proof of closure; otherwise closure_unknown. |
| Stop during starting/active | Increment cancellation generation, enter stopping, request termination and await exit; a late URL cannot reactivate sharing. |
| Stop after confirmed closure | Return idempotent success without touching unrelated processes. |
| Origin/token change, Forget or disconnect | Invalidate profile permits and pending starts, run the same stop path, then commit the new/disconnected profile only after confirmed closure. Unknown closure blocks new sharing and remains visible. |
| Renderer reload, crash, destruction or navigation | Main independently invalidates permits and starts teardown; a disappearing renderer cannot cancel cleanup or erase closure_unknown. |
| Shutdown | Begin the same bounded stop path and await it; unknown closure must remain recoverable and must not be silently labelled stopped. |
| Child exits after readiness | Clear active status only after exit is observed; record a redacted reason and return failed_closed/idle as appropriate. |

Initial limits: one owned CLI process tree, a 15-second readiness deadline, up to five seconds graceful termination followed by a platform-appropriate forced termination of that same owned tree and a further five-second confirmation window. A missed confirmation enters closure_unknown. These are test targets, not observed current behavior. Never kill all ngrok processes globally. The allowed structured log tail is 64 KiB; drop old content, redact secrets and remove listeners/timers after completion.

Provider credentials come from a separately configured local provider credential source under the main process's authority. FRM credentials never appear in provider options/config/argv and provider account credentials never appear in the renderer. No generic executable/binPath is accepted through IPC. Direct CLI invocation uses fixed argument arrays without shell interpolation, a fixed verified executable path, a restricted environment and no automatic PATH fallback.

Before sharing, the owner must identify the supported FRM version and expected auth response. A credential-free probe of the relevant protected endpoints must fail with the documented unauthorized response while an authenticated nonmutating probe succeeds. Failure/ambiguity blocks automatic sharing. A password input being nonempty is insufficient. Sharing forwards the selected API; disclose that scope and do not claim endpoint-level/read-only privileges unless FRM or a separately reviewed policy actually enforces them.

## 8. Persistence, logging and recovery invariants

Nonsecret profile migration is idempotent and versioned. A crash between dropping a legacy token and saving nonsecret fields must prefer a clean disconnected state over restoring a secret. No profile recovery, export, rollback or support bundle revives a token the user forgot or the server revoked. Local deletion is not server revocation and does not erase old filesystem backups.

Retain ordinary diagnostics in memory only, bounded by both 1 MiB and 1,000 events; use the tighter bound. Support export is opt-in, redacted and retained by its recipient for at most seven days or until the issue closes, whichever is earlier, unless the owner records a justified incident hold. Release evidence contains no tokens and is retained for 12 months after the version is superseded. These are selected policy targets; no telemetry service or automated retention job exists today.

## 9. Test contract format

Each lasting test records requirement ID, owning fixture, observable oracle, isolation and concurrency assumptions, review trigger and execution environment. Fixtures use dummy secrets and owned local ports/process objects. Controlled clocks establish deadlines; barriers establish race ordering. No test depends on a previous test's state or repairs another test's fixture. Boundary tests fail without the relevant control and pass for a legitimate representative FRM sample. Remove obsolete expectations when the requirement changes, preserving the decision history.

Current inert URL/IPC/process diagnostics are evidence of baseline defects. They do not prove the replacement code, supported browser CORS behavior, Windows process trees, actual public endpoint closure or the final packaged runtime. Those are WP-11 and G-04 checks.

## 10. Exact desktop profile and sharing authorization handoff

Main owns the selected nonsecret connection profile, a monotonically increasing connection generation, pending authorization probe and one permit. The renderer keeps its session token for direct FRM requests; main receives it only for an explicitly requested FRM authentication probe and discards it after that probe. This is a narrow fixed-endpoint FRM verifier, not a general network proxy or provider credential channel.

| Preload method / main channel | Input and authority | Output / failure behavior |
| --- | --- | --- |
| `connectionSelect` / `connection:select` | `{origin: string or null, expectedGeneration: integer}`; same trusted main-frame guard as all IPC. Validate canonical HTTP(S) origin and selected transport policy. Call on initial connect, origin/token edit, Forget or disconnect. | Serialize compare-and-set; stale generation returns conflict without effects. Invalidate old permits/requests, stop any owned tunnel and await closure before committing the new profile/generation. Null selects disconnected. Unknown closure returns typed recovery-required, never a false successful replacement. |
| `shareAuthorize` / `share:authorize` | `{profileId, generation, frmToken}`; token is a bounded string up to4096 characters, no CR/LF. Profile must be current and selected in main. One in-flight probe per profile. | Main performs credential-free denial and authenticated nonmutating success probes against fixed documented endpoints for the supported FRM version, using the same deadline/size/no-redirect rules. Discard token in success/failure/finally. Never trust a renderer-supplied auth-success flag. |
| `tunnelStart` / `tunnel:start` | `{permitId}` only; no host, executable path or credential. Permit is a cryptographically random128-bit opaque ID, single-use and valid for at most60seconds on a monotonic clock. Bind it to sender WebContents/main frame, selected profile/origin and generation. | Consume before spawning. Revalidate current profile, sender, expiry, verified native CLI and state. Reject unknown/expired/reused permits without a subprocess. Return authoritative state/generation, not provider secrets. |
| `tunnelStop` / `tunnel:stop` | Empty typed input; expected trusted caller. | Idempotent bounded teardown with confirmed/unknown closure result. No generic process ID or command input. |
| `tunnelStatus` / `tunnel:status` and state event | Trusted caller only; no caller-selected target. | Return current profile ID/generation and tunnel state; public URL only when verified active. Never include a token or raw provider log. |

Any profile generation change, token change, cancellation, reload/navigation or renderer destruction invalidates outstanding permits. Selection and Start are serialized by the same owner so a permit cannot race a target change. The connection UI must await selection/teardown before sending authenticated requests for the replacement profile. The expected-generation check and controlled barriers are tested explicitly. The auth probe establishes policy at start time; it is not continuous protection if an administrator later disables FRM authentication. Document that residual and stop sharing before changing server auth settings.

Supported FRM version and exact protected endpoint/auth response contract remain ACT-002 inputs. Unknown endpoint coverage blocks automatic sharing; never substitute an empty/nonempty password check. This selected interface is planned and must be implemented/tested before claiming it exists.

## 11. Abrupt process death and ownership recovery

Graceful teardown cannot prove closure after the main process is forcibly killed. Before spawning, atomically write a nonsecret pending-ownership marker; after spawn update it with executable absolute path/digest, PID, process creation identity, operation ID and app-session ID. Never write a token or full provider log. Remove the marker only after confirmed closure. A crash between spawn and PID recording leaves an unresolved marker, never an assumption that nothing started.

On restart, an unresolved marker forces `closure_unknown` and blocks a new Share. Verify executable identity, creation identity and recorded ownership before terminating any surviving process; PID alone is insufficient because of reuse. If identity cannot be proven, do not kill it blindly: show manual provider/OS recovery instructions and require verified closure before clearing the marker. Where a supported platform supervision mechanism can guarantee child termination after parent loss, it may strengthen this policy only after an actual kill-main integration test.

The selected baseline recovery policy does not guarantee immediate public-endpoint closure after abrupt main-process death. This residual requires owner acceptance at G-04 or a verified platform supervisor before distribution. Local tests forcibly stop main, restart, confirm the marker/unknown state and prove unrelated process IDs are never killed. A separately authorized provider test checks real endpoint closure; an inert mock cannot establish it.
