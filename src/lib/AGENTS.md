# src/lib/ instructions

Owner: API/config/data owners listed per module. Exclusive task paths:
`src/lib/**` (except `src/lib/__tests__/**`, owned with the independent
reviewer). Shared policy: `../../docs/security/development-policy.md`.
Contracts: `docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md` sections 1–6
(REQ-014…REQ-019).
This guide adds boundary facts; it does not duplicate or expand shared authority.

Purpose and entrypoints: `connection/contract.ts` parses and normalizes the
endpoint and owns the plaintext policy; `connection/profile.ts` owns the
nonsecret persisted profile and legacy migration; `api.ts` is the single
authenticated request path; `request-bounds.ts` owns deadline/size/schema
helpers; `polling.ts` owns one-flight/backoff scheduling; `useTimeBuffer.ts`
owns bounded retained history.

Allowed dependencies: browser-safe Web APIs, React hooks, `src/lib/types.ts`.
Forbidden dependencies: React components/panels, Electron/Node process or
filesystem APIs, and any second authenticated-fetch implementation.

Inputs/trust: remote FRM responses and localStorage are untrusted. Validate
shape/size before panels consume data; never place a token in a URL, log or
error message.

Invariants: exact-origin credential binding; `redirect: "error"` on every
authenticated request; 15 s deadline; 16 MiB decoded cap; one in-flight request
per origin/endpoint and four per connection; stale generation results are
discarded; invalid saved settings revert to documented defaults with a notice.

State ownership: persisted state is nonsecret only (`frm-profile`, app
settings, theme). The token is session memory owned by `page.tsx`.

Search these helpers/tests first: `src/lib/connection/`, `src/lib/__tests__/`.
Meaningful tests: parser/redirect/bounds/migration/stale-generation fixtures
with controlled clocks.
Documentation to update: `docs/api-client.md`, `docs/hooks.md`, this guide.
