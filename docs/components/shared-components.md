# Shared Components

Three components are always accessible (not tab-specific): `ConnectionBar`, `EndpointList`, and `TimeWindowSelector`.

---

## ConnectionBar

`src/components/ConnectionBar.tsx`

**Purpose:** presents the connection and sharing security states. It never owns
the token or persists it.

### Props

```typescript
{
  config: FRMConfig;            // nonsecret host/port/refresh
  token: string;                // session memory, owned by page.tsx
  onTokenChange, onConfigChange,
  onConnect, onCancel, onForget, onDisconnect,
  connected, connecting, error,
  endpoint, endpointError,
  plaintextAck, onPlaintextAckChange,
  profile: { id, generation, origin } | null;
}
```

### Security states

| State | UI contract |
| --- | --- |
| Invalid endpoint | Field-level message from the parser; Connect disabled |
| Plaintext LAN pending | Exact origin + unencrypted warning + per-origin acknowledgement |
| Connecting | Cancel remains reachable; Connect disabled |
| Connected | Canonical origin shown in the title bar; Disconnect/Forget available |
| Share idle | Scope warning; Start disabled until connected + profile + token |
| Share starting | "Authorizing…" then "Starting — waiting for a verified HTTPS URL" |
| Share active | Verified HTTPS URL + Copy URL + Stop |
| Share stopping | "Stopping — confirming closure" |
| Share failed | Error category; closure confirmed |
| Closure unknown | Assertive warning, Retry Stop, manual recovery text, no false inactive claim |

### Sharing flow

1. `shareAuthorize({profileId, generation, frmToken})` — main probes FRM auth.
2. `tunnelStart({permitId})` — only the single-use permit is sent.
3. `onTunnelState` supplies authoritative state; a URL appears only when active.

Copy failure is reported instead of a false "Copied". Provider credentials are
configured outside the renderer.

## ItemIcon

`src/components/ui/ItemIcon.tsx`

**Purpose:** Shared item icon component extracted from `InventoryPanel` and `ProductionMonitor`. Renders a PNG icon from `public/Icons/` or falls back to a colored initial circle using a deterministic hash-based color (`nameToColor`).

### Props

```typescript
interface ItemIconProps {
  className?: string;
  name: string;
  size?: number; // default: 32
  prod?: number; // production rate — tints background green when > cons
  cons?: number; // consumption rate — tints background red when > prod
}
```

### Behavior

- Loads `public/Icons/{className}.png`; shows initials on error.
- When `prod` and `cons` are provided, background color indicates net balance.
- Uses an internal `nameToColor()` fallback to avoid `'use client'` boundary issues.

---

## EndpointList

`src/components/EndpointList.tsx`

**Purpose:** The "🔧 API Explorer" tab — browse all FRM endpoints, filter by category, fetch and display raw JSON responses.

### Props

```typescript
interface EndpointListProps {
  config: FRMConfig;
  endpoints: EndpointInfo[];
  categories: Map<string, EndpointInfo[]>;
}
```

### Features

- **Search bar:** Filters endpoints by path name, description, or category. Case-insensitive.
- **Category filters:** 13 toggle buttons with icons — ⚡🔥🏭⛏️🔧🚗🚂🏢👤📦🔬🎄🐾. Click to show/hide each category.
- **Endpoint cards:** Each card shows:
  - Category icon + badge color (unique per category)
  - Endpoint path in code-style text
  - Description
  - `requiresGameThread` badge (amber if true)
  - **Fetch button:** Expands to show live JSON response
  - Response header shows the full GET URL
  - Entry count displayed (e.g., "42 items")
- **Color coding:** Each category has a distinct border-left color and background opacity for quick visual scanning.

### Edge Cases

- Fetch errors show inline in the expanded card — don't crash the list.
- Multiple endpoint cards can be expanded simultaneously.
- Search + category filters compose (AND logic).

---

## TimeWindowSelector

`src/components/TimeWindowSelector.tsx`

**Purpose:** Shared control that lets the user pick a time window for averaging metrics across dashboard panels. Rendered above the tab content when connected.

### Props

```typescript
function TimeWindowSelector(props: {
  value: TimeWindowMs;
  onChange: (v: TimeWindowMs) => void;
}): JSX.Element;
```

### Windows

```typescript
const TIME_WINDOWS = [
  { value: 0, label: "Live" },
  { value: 60_000, label: "1m" },
  { value: 300_000, label: "5m" },
  { value: 600_000, label: "10m" },
  { value: 900_000, label: "15m" },
  { value: 1_800_000, label: "30m" },
  { value: 3_600_000, label: "1h" },
];
```

### Behavior

- **Inline button group** — all options visible at once.
- **Active button** highlighted with accent color.
- **"Live" (0)** means no averaging — show current API response directly.
- **Persistence:** Selection saved to `AppSettings.timeWindow` via `saveSettings()` in `page.tsx`.
- **Scope:** All time-aware panels read the same `timeWindow` value. Changing it affects PowerDashboard, ProductionMonitor, FactoryEfficiency, GeneratorStatus, and ResourceTracker simultaneously.
