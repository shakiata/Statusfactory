# Testing

Statusfactory uses **Vitest** for unit and integration testing. Tests live alongside source files in `__tests__/` directories.

---

## Quick Start

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-run on file changes)
npx vitest

# Run a specific test file
npx vitest src/lib/__tests__/api.test.ts
```

---

## Test Structure

```
src/
├── lib/
│   ├── __tests__/
│   │   ├── api.test.ts                 # canonical URL, redirect, bounds, chat
│   │   ├── connection-contract.test.ts # endpoint/transport policy matrix
│   │   ├── profile.test.ts             # nonsecret persistence + token migration
│   │   ├── request-bounds.test.ts      # size/schema/history limits
│   │   ├── useTimeBuffer.test.ts       # averaging helpers
│   │   └── types.test.ts               # type/default smoke tests
electron/
└── __tests__/
    ├── state-machine.test.ts           # lifecycle/generation transitions
    ├── permit-registry.test.ts         # single-use/expiry/binding
    ├── artifact-and-marker.test.ts     # digest verification + ownership marker
    ├── endpoint-policy.test.ts         # main-side origin validation
    └── service.test.ts                 # serialized start/stop/cancel/recovery
```

---

## What We Test

- **Connection policy** — scheme/port preservation, private/loopback plaintext,
  public/DNS HTTP refusal, ambiguous input rejection.
- **Bounded client** — 15 s deadline wiring, 16 MiB cap, `redirect: 'error'`,
  401/403 mapping, malformed/schema rejection, one chat send in flight.
- **Session secret** — legacy token removal, nonsecret preservation, malformed
  settings recovery, write failure handling.
- **History** — 5 s sample spacing, 720-sample cap, one-hour pruning, truncation.
- **Desktop boundary** — lifecycle transitions, permit reuse/expiry, CLI digest
  failure, marker recovery, Stop-during-Start, closure_unknown.
- **Existing helpers** — averages, formatting, fluids, trains, types.

Every permanent test names its requirement IDs and oracle in a header comment.
Fixtures use synthetic data, dummy secrets, controlled clocks and temporary
directories; no test uses a real FRM server or public tunnel.

---

## Configuration

`vitest.config.ts` includes both `src/**` and `electron/**` test files, uses
`jsdom` and maps `@/` to `src/`.

---

## Conventions

1. **Test files** live in `__tests__/` next to the code; Electron modules are
   tested under `electron/__tests__/`.
2. **Naming:** `*.test.ts`.
3. **One `describe` per exported behaviour**, with an observable oracle.
4. **Mock `fetch`** for client tests — never hit the real network.
5. **No sleeps/races by luck** — use barriers, controlled clocks and owned
   temporary files.
6. **Run `npm test` and `npm run build` before claiming done.**
