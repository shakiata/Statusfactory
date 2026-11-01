# Architecture

## Overview

Statusfactory is a **Next.js 15 + Electron 33 desktop application** that monitors Satisfactory factory statistics in real-time via the **Ficsit Remote Monitoring (FRM)** mod API. It renders as a single-page dashboard with 12 tabbed views, each polling specific FRM REST endpoints.

```mermaid
graph TD
    subgraph "Satisfactory Game"
        FRM["FRM Mod<br/>(REST API on :8080)"]
    end
    subgraph "Electron Shell"
        MAIN["main.js<br/>BrowserWindow + IPC"]
        PRELOAD["preload.js<br/>contextBridge"]
        NGROK["ngrok tunnel<br/>(optional share)"]
    end
    subgraph "Next.js App"
        PAGE["page.tsx<br/>Tab router + state"]
        HOOKS["Hooks<br/>useConfig / useTheme / useTimeBuffer"]
        API["api.ts<br/>buildUrl / fetchEndpoint"]
        COMPONENTS["13 Components<br/>11 tabs + 2 shared"]
        LIBS["Shared libs<br/>formatters colors names"]
        GLOBALS["globals.css<br/>CSS custom properties"]
    end
    FRM -->|HTTP| API
    API --> HOOKS
    HOOKS --> COMPONENTS
    LIBS --> COMPONENTS
    COMPONENTS --> PAGE
    MAIN --> PRELOAD
    PRELOAD --> NGROK
    PAGE -->|rendered in| MAIN
    GLOBALS --> COMPONENTS
```

---

## Tech Stack

| Layer              | Technology                           | Version   |
| ------------------ | ------------------------------------ | --------- |
| Frontend Framework | Next.js (static export)              | 15.x      |
| UI Library         | React                                | 19.x      |
| Language           | TypeScript (strict mode)             | 5.x       |
| Styling            | Tailwind CSS + CSS custom properties | 3.4       |
| Desktop Shell      | Electron                             | 33.x      |
| Packaging          | electron-builder                     | 25.x      |
| Tunneling          | ngrok                                | 5.x beta  |
| Dev orchestration  | concurrently + wait-on               | 9.x / 8.x |

---

## Build Pipeline

### Development

```
npm run dev               → Next.js dev server on :3000
npm run electron:dev      → concurrently:
                              1. next dev (port 3000)
                              2. wait-on :3000 → electron . --dev
```

Electron loads `http://localhost:3000` with HMR and DevTools. Production
navigation is restricted to the exact packaged document.

### Production Build

```
npm run build             → next build (static export → out/)
                            + scripts/postbuild-csp.mjs (script hashes)
npm run electron:build    → build → electron-builder → dist/
```

`next.config.js` sets `output: "export"` and `assetPrefix: "./"` so the static
HTML works via `file://` inside Electron. The builder packages `out/**/*` and
`electron/**/*` (no `node_modules`), plus the fixed `electron/tunnel/bin` tree as
`resources/tunnel`.

- **Windows:** portable `.exe`
- **Linux:** AppImage
- **macOS:** deferred

### Existing release automation

`.github/workflows/release.yml` remains unchanged and is reviewed as source
only; this remediation adds no Actions. It deliberately skips patch-only
versions, so the local patch-release path is documented in
`docs/security/release/RELEASE_RUNBOOK.md`. Publication requires G-05 owner
approval of exact hashes.

---

## Data Flow

1. **User enters endpoint + token** → `ConnectionBar` → `parseEndpoint` validates
   the canonical origin; `useConfig` persists only nonsecret fields.
2. **Connect** → main selects the profile/generation (Electron) → `testConnection`
   reads `getPower` through the bounded client.
3. **On success** → `connected = true`; the token is bound to that exact origin in
   `page.tsx` memory.
4. **Panels** poll endpoints on their interval; the shared client enforces
   one-flight, four-per-origin, deadline, size and redirect rules.
5. **`useTimeBuffer`** retains at most one hour / 720 samples / 64 MiB and lags
   live polling by at least five seconds per sample.
6. **`useTheme`** injects CSS custom properties from localStorage.
7. **`lib/fluids.ts`** classifies liquids/gases and traces recipe inputs.

### Connection URL Logic

`src/lib/connection/contract.ts` is the single parser:

- explicit scheme and port are preserved (no silent HTTP downgrade);
- bare loopback/private literals default to HTTP; bare DNS names default to HTTPS;
- public/DNS plaintext is refused; non-loopback LAN HTTP needs an acknowledgement;
- `origin` includes a non-default port and binds the session credential.

### Authentication

`X-FRM-Authorization` is attached only for the selected canonical origin and only
when a session token exists. Authenticated requests use `redirect: "error"`.
ngrok's warning bypass header is added only for parsed ngrok host boundaries.

## Directory Structure

```
satisfactoryStats/
├── electron/
│   ├── main.js            # Electron main process, window creation, IPC handlers
│   └── preload.js         # contextBridge exposing tunnel APIs to renderer
├── public/
│   └── Icons/             # PNG icons for buildings/items (referenced by className)
├── src/
│   ├── app/
│   │   ├── globals.css    # CSS custom properties, Tailwind directives, global resets
│   │   ├── layout.tsx     # Next.js root layout (metadata, font loading)
│   │   └── page.tsx       # Main dashboard — tab router, connection state, theme provider
│   ├── components/
│   │   ├── ConnectionBar.tsx
│   │   ├── EndpointList.tsx
│   │   ├── TimeWindowSelector.tsx
│   │   └── dashboard/
│   │       ├── ChatPanel.tsx
│   │       ├── FactoryEfficiency.tsx
│   │       ├── FluidDashboard.tsx
    │       ├── GeneratorStatus.tsx
    │       ├── InventoryPanel.tsx
    │       ├── PlayerMap.tsx
    │       ├── PowerDashboard.tsx
    │       ├── ProductionMonitor.tsx
    │       ├── ResourceTracker.tsx
    │       ├── SettingsPanel.tsx
    │       └── TrainControlTower.tsx
    └── lib/
        ├── api.ts          # FRM API client + endpoint registry
        ├── fluids.ts       # Fluid identification + raw material tracing
│       ├── types.ts        # TypeScript type definitions
│       ├── useConfig.ts    # FRM config persistence hook
│       ├── useAppSettings.ts # UI preferences hook
│       ├── useTheme.tsx    # Theme context + CSS variable injection
│       ├── useTimeBuffer.ts # Rolling time-series buffer hook
│       └── electron.d.ts   # Type declarations for window.electronAPI
├── docs/                   # This documentation
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Key Conventions

- **All interactive components** are `'use client'` (React 19 Client Components).
- **No external state management** — pure React hooks (`useState`, `useContext`, `useCallback`).
- **localStorage** is the persistence layer for config, settings, and theme.
- **Time-series averaging** is handled by `useTimeBuffer` — each panel can average metrics over 1m–1h windows.
- **Theme is CSS custom properties** injected at `:root` level, not Tailwind config or CSS-in-JS.
- **Icons** are PNG files in `public/Icons/` matched by `ClassName` property from FRM responses.
- **Canvas 2D** is used for `TrainControlTower` track map for high-performance rendering.
- **ngrok sharing** is available in the Electron build via IPC — spawns a tunnel process and exposes the public URL.
