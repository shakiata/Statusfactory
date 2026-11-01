# Trusted tunnel CLI activation input

Sharing is disabled until an exact artifact is supplied and verified. This
template records the owner's acquisition and digest decision.

## Per-platform entries

| Field | linux-x64 | linux-arm64 | win32-x64 |
| --- | --- | --- | --- |
| Vendor version | `<exact>` | `<exact>` | `<exact>` |
| Trusted source | `<vendor URL or offline path>` | | |
| Access date | `<YYYY-MM-DD>` | | |
| SHA-256 | `<64 hex>` | | |
| File size | `<bytes>` | | |
| Signature/provenance | `<signed / checksum from vendor / none>` | | |

## Procedure

1. Acquire the artifact through the recorded trusted source.
2. Do **not** execute it before hashing.
3. Run:

   ```bash
   node scripts/hash-tunnel-artifact.mjs <path> <version> <platform-arch>
   ```

4. Confirm the reported magic is `ELF` (Linux) or `PE` (Windows), not
   `unknown/text`.
5. Paste the reported `manifestEntry` into
   `electron/tunnel/ngrok-artifact.json` `artifacts`, replacing placeholders.
6. Place the artifact at
   `electron/tunnel/bin/<platform-arch>/ngrok` (or `ngrok.exe`).
7. Run the adapter tests and rebuild the platform artifact.
8. Record the resulting manifest/artifact hashes in
   `docs/security/release/RELEASE_EVIDENCE.json`.

Wrong-platform, missing, oversized-text or digest-mismatched files fail closed
and are never launched. The adapter never searches `PATH` and never downloads a
binary at runtime.

## Provider credential

Create `<Electron userData>/ngrok-provider.json` with mode `0600`:

```json
{ "authtoken": "<provider account token>" }
```

Do not put the FRM token in this file. Do not pass provider credentials on the
command line or expose them to the renderer.
