# API Client

`src/lib/api.ts` is the sole authenticated path to the Ficsit Remote Monitoring
(FRM) REST API. URL parsing/policy lives in `src/lib/connection/contract.ts`;
bounded reading/validation lives in `src/lib/request-bounds.ts`.

Contracts: `docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md` sections 1–4
(REQ-014, REQ-015, REQ-018, REQ-019).

---

## Endpoint registry

`getEndpoints()` returns the static registry of FRM paths and metadata
(`path`, `category`, `description`, `requiresGameThread`). `getEndpointsByCategory()`
groups the same entries. The registry is the only source of endpoint names;
remote response text is never used to build a request path.

---

## `parseEndpoint(host, port)` — connection policy

Returns either a canonical endpoint or a typed error.

```ts
parseEndpoint('192.168.1.5', '8080')
// { scheme: 'http', hostname: '192.168.1.5', port: 8080,
//   origin: 'http://192.168.1.5:8080', isLoopback: false, isPrivate: true,
//   requiresPlaintextAcknowledgement: true }

parseEndpoint('http://frm.example.com')
// { ok: false, error: { code: 'plaintext-dns', field: 'scheme', ... } }
```

Rules:

- HTTP/HTTPS only; explicit scheme is never changed.
- An explicit port is preserved; conflicting embedded/separate ports are
  rejected rather than silently discarded.
- Username/password, paths, query strings, fragments and malformed hosts are
  rejected.
- Loopback and private IPv4/IPv6 ULA literals may use plaintext HTTP. Non-loopback
  LAN HTTP requires a per-origin session acknowledgement. Public literals and
  DNS names over HTTP are refused.
- `origin` is the credential-binding key.

---

## `fetchEndpoint(config, endpoint)`

```ts
const circuits = await fetchEndpoint<PowerCircuit[]>(config, 'getPower');
```

Guarantees:

| Control | Value |
| --- | --- |
| Deadline | 15 s per request |
| Body cap | 16 MiB decoded, enforced while streaming |
| Redirects | `redirect: 'error'`; every 3xx is rejected |
| Concurrency | one in-flight request per origin/endpoint; max four per origin |
| Backoff | 2, 4, 8, 16, 30 s after failures, capped at 30 s |
| Validation | object root, finite numbers, bounded strings/entities/depth |
| Credentials | `X-FRM-Authorization` only for the selected origin |

Failures are `FrmRequestError` with a stable `code`: `invalid-endpoint`,
`timeout`, `aborted`, `too-large`, `malformed`, `schema`, `redirect`, `auth`,
`rate-limit`, `transport`, `chat-in-flight`. Messages never include the token.

`abortAllRequests()` cancels all outstanding work; the root page calls it on
origin/token change, Forget and disconnect.

---

## `testConnection(config)`

Reads `getPower` and returns `{ok: true}` or `{ok: false, error, code}`. The
connection bar uses the code to distinguish authentication, redirect and
transport failures.

---

## `sendChatMessage(config, message)`

- 2,000-code-point draft limit, enforced before any request.
- One in-flight send per connection; no automatic retry after a timeout.
- Uses the same redirect/size/deadline path as reads.
- The UI tells the user delivery is unknown after a failed/timed-out send and
  keeps the draft for inspection before resending.

---

## `buildUrl(config, endpoint)`

Backwards-compatible helper that returns the canonical URL (used for display and
tests). It throws on an invalid endpoint; do not use it to bypass
`fetchEndpoint`.

---

## ngrok compatibility

`ngrok-skip-browser-warning: 1` is added only when the parsed hostname is an
ngrok-managed boundary (`*.ngrok.io`, `*.ngrok.app`, `*.ngrok-free.app`). This is
a parsed-host check, not a substring search.
