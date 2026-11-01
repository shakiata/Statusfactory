# Pinned tunnel CLI directory

The release build copies this directory to `resources/tunnel`. There is no
bundled ngrok binary in the local release candidate.

The repository owner must place an exact vendor CLI artifact at:

```text
electron/tunnel/bin/<platform>-<arch>/ngrok      (linux-x64, linux-arm64, darwin-*/…)
electron/tunnel/bin/<platform>-<arch>/ngrok.exe  (win32-x64)
```

and record its reviewed SHA-256 in `electron/tunnel/ngrok-artifact.json`.
`electron/tunnel/cli-artifact.js` verifies the digest and executable magic before
every start and fails closed when the entry is missing or mismatched. The adapter
never falls back to `PATH` and never downloads a binary at runtime.
