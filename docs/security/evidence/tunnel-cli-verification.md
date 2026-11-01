# Real tunnel CLI verification

**Date:** 2026-11-01 · **Host:** Linux x86_64 · **Provider tunnel:** none opened.

## Artifact provenance

| Item | Value |
| --- | --- |
| Vendor | ngrok |
| Version | 3.39.13 (`ngrok version 3.39.13`) |
| Linux source | `https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip` |
| Linux zip SHA-256 | `c3bb99ccd29f6ed4a901cf88100d646256d291d80fc94f53c241f8d544f2a8a5` |
| Linux binary SHA-256 | `4399384bf4d6a5ad65136770a931536db9e97911f52686e3419dc434a74df75f` |
| Windows source | `https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip` |
| Windows zip SHA-256 | `438bad3dbefd7e244be9dfae3889dcf99073b515845b66ab5617e4887bc24636` |
| Windows binary SHA-256 | `5089402d3a5cb601d75e98231c799c1b770b894a381190a5a1c2f4a57482c8a3` |
| Linux format | ELF 64-bit LSB executable, statically linked |
| Windows format | PE32+ console executable |

The binaries are acquired locally and excluded from git; the manifest records the
exact digests. `scripts/hash-tunnel-artifact.mjs` reproduces the hash.

## Real spawn/teardown smoke

`node scripts/tunnel-cli-smoke.mjs` verified the Linux digest, spawned the real
CLI with a deliberately invalid provider token against `127.0.0.1:9`, and
observed exit before readiness. Output (`tunnel-cli-smoke.txt`):

```text
verified 3.39.13 4399384b...
{ "code": "exited-before-ready", "spawned": true, "confirmedClosure": true }
PASS: real CLI spawned and was confirmed closed; no tunnel opened.
```

No ngrok process remained and no public URL was produced. This proves the real
process ownership/teardown path; it does **not** prove provider authentication or
public endpoint closure.

## Windows

A Windows portable artifact was cross-built and hashed
(`dist/Statusfactory 1.5.1.exe`,
`7a5c3dada1e38e0354e2f1a38091a2c38a6c1dc2de8b0d9dd0e3d310e7f54cc8`), and the
Windows CLI digest is recorded. It was **not executed**; Windows runtime remains
unverified.
