# Security interaction design and accessibility

## Scope and visual artifacts

This package reviews an existing UI and plans security remediation. It does not redesign branding, layouts or dashboard aesthetics. Generated image mockups would not establish whether a token or process boundary is safe, so no mockup images are required or claimed. Exact state tables, interaction contracts and diagrams are the design deliverables. The diagrams manifest explicitly records that distinction. Public-web SEO, sitemaps and marketing metadata are not relevant to this private game dashboard scope; robots rules must never be presented as access control.

## 1. Connection journey

Preserve host/port entry and all current panels. Label the FRM token precisely and explain that it is scoped to the selected server and forgotten when the session ends. Scheme and port must remain visible after normalization. A user's explicit HTTPS choice must never be silently replaced. Editing the origin clears the token, disconnects/cancels work and awaits the same owned-tunnel stop path; unconfirmed closure remains visible and blocks new sharing; editing a visual theme does not change the server identity.

| State | Visible behavior | Allowed actions / recovery |
| --- | --- | --- |
| Empty | Endpoint instructions, no live indicator, token field empty | Enter target; validation errors identify the field |
| Ready | Canonical scheme/host/port shown; token purpose clear | Connect, edit, Forget |
| Plaintext LAN confirmation | Explicit notice that HTTP exposes credentials to network observers | Acknowledge this exact target/session or switch to HTTPS; no silent saved global consent |
| Connecting | Busy label and deadline; existing data not marked live | Cancel; avoid duplicate connection submissions |
| Connected | Exact server identity and last successful update | Use panels, disconnect, Forget |
| Stale | Last-valid data labelled stale with timestamp and retry state | Retry, disconnect; do not replace with healthy zero values |
| Authentication failure | Token/authorization failure distinguished from transport or CORS | Edit credential; no echo of token or provider diagnostics |
| Redirect refused | Explain that the canonical final endpoint is required | Edit address; token is not automatically sent to the destination |
| Malformed/over-limit data | Affected panel has a readable error; other panels remain usable | Retry with supported FRM version or review limit with owner |
| Forgotten | Empty token, pending requests aborted, nonsecret settings retained if selected | Re-enter credential; no background automatic reconnect |

## 2. Sharing journey

Sharing exposes the FRM API through a provider; it does not share a screenshot. Label that scope before Start. Keep the FRM token separate from the provider account setup. Do not place a provider account token in a renderer input for this release. Browser mode explains that built-in sharing is a desktop capability.

| Tunnel state | UI contract |
| --- | --- |
| Idle | No public URL. Start enabled only after approved target/auth checks. |
| Starting | Progress and Cancel/Stop remain reachable. No guessed URL or active badge. |
| Active | Show exact verified HTTPS URL and explicit Stop. Copy only the URL, never a token. |
| Stopping | Explain that closure is being confirmed. Do not immediately remove evidence of exposure. |
| Failed and closed | Error category and retry; closure has been verified. |
| Closure unknown | Warning remains visible with retry Stop and documented local/provider recovery. Do not claim inactive. |

A late start completion cannot restore Active after a confirmed Stop. Failure to close must remain an observable state. Copy errors must be reported instead of showing a false Copied label. Provider errors are mapped to useful categories and redacted before presentation. Correct existing label associations (`htmlFor`/`id`) during the affected UI changes.

## 3. Accessibility acceptance

Use native buttons and labels, a visible keyboard focus ring, meaningful accessible names and status text independent of color. Connect, Cancel, Forget, Start, Stop and copy controls are keyboard operable. Announce state/error changes with appropriate polite live regions; use an assertive alert only when user action is needed for unknown ongoing exposure. Move focus to a validation summary or first invalid field after failed submission and return it predictably after confirmation dialogs.

Busy state must not remove a user's only cancellation/stop path. At 200% zoom and a narrow browser viewport, fields and recovery actions remain reachable without overlaying each other. Maintain at least WCAG AA text/control contrast targets (4.5:1 normal text, 3:1 large text and relevant graphical controls) and honor reduced motion for progress effects. These are planned acceptance checks, not a certification of the existing UI.

## 4. Test examples and ownership

The UI owner owns label/focus fixtures; the security reviewer supplies the state oracle. Test keyboard-only empty-to-connected, failed token, refused redirect, canceled connect, active-to-unknown-stop and Forget journeys. Use dummy credentials and synthetic FRM responses. A test must inspect an observable state/event and zero forbidden network/process side effects, not only the presence of a CSS class.

A useful screen-reader check verifies that a rejected response is announced once and that a late async result does not announce a new connection after cancellation. Run visual checks in the browser and supported Electron builds. No live provider endpoint is needed for normal UI tests; real public endpoint closure belongs in a separately authorized isolated integration test.

Sources: current repository connection controls and main-process behavior, `09_SECURITY_REVIEW.md`; [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for contrast, keyboard and status-message targets. All new wording/state behavior is proposed, not implemented.
