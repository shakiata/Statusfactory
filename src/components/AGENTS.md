# src/components/ instructions

Owner: UI owner. Exclusive task paths: `src/components/**`.
Shared policy: `../../docs/security/development-policy.md`.
Contracts: `docs/security/05_DESIGN_AND_ACCESSIBILITY.md` and
`docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md` section 6 (REQ-022).
This guide adds boundary facts; it does not duplicate or expand shared authority.

Purpose and entrypoints: `ConnectionBar.tsx` owns the connection and sharing
interaction states; `dashboard/SettingsPanel.tsx` owns nonsecret preferences and
Forget; the 12 dashboard panels consume `config` (origin + session token) and
render data.

Allowed dependencies: `src/lib/` hooks/helpers and `src/components/ui/`.
Forbidden dependencies: direct `fetch` for authenticated data, Electron
`ipcRenderer`, filesystem/process APIs, or a parallel URL builder.

Inputs/trust: panel data is untrusted and may be malformed, oversized or stale.
Render text escaped by React; never inject remote HTML.

Invariants: every security state in the package state table is visible with text
and color; Connect/Cancel/Forget/Start/Stop/copy are keyboard operable; a busy
state never removes the only cancellation/stop path; unknown closure is never
shown as stopped; copy failures are reported instead of a false "Copied".

State ownership: ephemeral component state only. No token in props beyond the
session config object; no token in localStorage, URLs or clipboard.

Search these helpers first: `src/components/ui/`, `src/lib/connection/`.
Meaningful tests: keyboard/focus and state-oracle fixtures owned by the UI
owner with the security reviewer's oracle.
Documentation to update: `docs/components/*.md`, this guide.
