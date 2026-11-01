# Simulated local integration evidence

**Date:** 2026-10-31 · **Host:** Linux x86_64 · **Status:** SIMULATION ONLY.
This evidence exercises the real client/probe/service code against owned local
fixtures. It does **not** verify ACT-002, a real provider tunnel, a packaged
Windows build or public endpoint closure, and it does not pass G-01/G-02/G-04.

## Synthetic FRM server

`scripts/fixtures/frm-fixture.mjs` (`npm run sim:frm`) serves representative
arrays on loopback. Every data endpoint requires a dummy token
(`sim-token-not-a-secret`); an unauthenticated request returns 401. It never
contacts a game or the internet and contains no real credential.

## Executed tests

`src/lib/__tests__/integration-frm.test.ts` (real loopback HTTP):

- the real `probeSharing` accepts a correct dummy token and rejects a wrong one;
- the real `fetchEndpoint` returns fixture data with the token;
- a credential-bearing 302 is rejected with `redirect`, and the target origin
  records **zero** requests (real cross-origin assertion, not a mock);
- malformed JSON and declared-oversized responses are rejected.

`electron/__tests__/integration-simulation.test.ts` (simulator adapter):

- the real tunnel service reaches `active` with `https://simulated.invalid`;
- Stop reports confirmed closure and clears the ownership marker;
- Stop-during-Start is cancelled and leaves the service `idle`.

Full suite after adding these: **24 files / 230 tests passed**; `tsc --noEmit`
and `npm run build` pass.

## Electron GUI smoke

`xvfb-run … STATUSFACTORY_TUNNEL_SIMULATOR=1 npx electron . --no-sandbox`
loaded the packaged static export and captured
`docs/security/evidence/electron-simulation.png`. The window shows the
SIMULATION MODE banner, disabled sharing until connection, and no CSP errors.

**Caveat:** `--no-sandbox` was required only because this host's
`chrome-sandbox` is not root-owned mode 4755. This is a visual smoke, not
security validation; do not use it as sandbox evidence.

## Boundaries

- Simulation is selected only when `!app.isPackaged` and
  `STATUSFACTORY_TUNNEL_SIMULATOR=1`.
- The simulator never spawns a process, opens a socket, or returns a routable
  URL (reserved `.invalid` TLD).
- `sharing.verified` remains `false` in normal builds; the simulated policy is
  labelled and cannot satisfy ACT-002.
- No real FRM token, provider account or public tunnel was used.
