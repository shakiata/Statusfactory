# Hooks

Custom React hooks in `src/lib/` provide reusable stateful logic for config persistence, UI preferences, theme management, and time-series data buffering.

---

## `useConfig`

`src/lib/useConfig.ts`

**Purpose:** Persist and manage the **nonsecret** connection profile (host, port,
refresh rate) in localStorage and perform the one-time legacy token migration.

### Return Value

```typescript
{
  config: FRMConfig;              // never contains a token
  saveConfig: (newConfig: FRMConfig) => void;
  loaded: boolean;
  notice: string | null;          // migration/storage message
  dismissNotice: () => void;
}
```

### Behavior

- **On mount:** reads `frm-config`, validates host/port/refresh rate, removes any
  legacy `password` field and writes the sanitized schema back.
- **`saveConfig`:** writes only `{schemaVersion, host, port, refreshRate}`; a token
  passed by callers is ignored.
- **`loaded`:** `false` until the storage read completes.
- **Default profile:** `{ host: 'localhost', port: '8080', refreshRate: 5000 }`.

The session token lives in `src/app/page.tsx` React state, not in this hook.
See `docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md` section 5.

### Edge Cases

- Corrupt/legacy JSON → sanitized defaults plus a recoverable notice.
- Storage write failure → in-memory state still updates and a notice is shown.
- Unsupported refresh values revert to the documented default.

---

## `useAppSettings`

`src/lib/useAppSettings.ts`

**Purpose:** Persist and manage UI preferences (`AppSettings`) in localStorage.

### Return Value

```typescript
{
  settings: AppSettings;
  saveSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loaded: boolean;
}
```

### Behavior

- **On mount:** Reads `frm-app-settings` from localStorage, merges with `DEFAULT_SETTINGS`.
- **`saveSettings(partial)`:** Merges partial into current settings, persists JSON.
- **`resetSettings()`:** Removes localStorage key, resets state to `DEFAULT_SETTINGS`.
- **`loaded`:** Same pattern as `useConfig` — prevents flicker.

### Usage

```typescript
const { settings, saveSettings, resetSettings } = useAppSettings();

// Persist tab change
saveSettings({ activeTab: "production" });

// Reset everything
resetSettings();
```

---

## `useTheme`

`src/lib/useTheme.tsx`

**Purpose:** Full-theme customization via React Context. Injects CSS custom properties into `document.documentElement` for immediate visual updates.

### Exports

- `ThemeProvider({ children })` — context provider, must wrap the app.
- `useTheme()` → `ThemeContextType`

### `ThemeContextType`

```typescript
{
  theme: DashboardTheme;
  updateTheme: (partial: Partial<DashboardTheme>) => void;
  resetTheme: () => void;
}
```

### Behavior

- **On mount:** Reads `frm-theme` from localStorage. If no custom theme is saved, checks `frm-app-settings` for `themeMode` — if `'light'`, loads `LIGHT_THEME` instead of `DEFAULT_THEME`. Applies 12 CSS custom properties via `applyThemeCssVars()`.
- **`updateTheme(partial)`:** Merges partial, writes to localStorage, calls `applyThemeCssVars()`.
- **`resetTheme()`:** Clears localStorage, resets to `DEFAULT_THEME`.
- **`mounted` state:** Provider doesn't render children until theme is loaded — prevents flash of default colors then switching to saved.

### CSS Variable Injection

```typescript
function applyThemeCssVars(t: DashboardTheme) {
  root.style.setProperty("--bg-primary", t.bgPrimary);
  root.style.setProperty("--bg-secondary", t.bgSecondary);
  // ... all 12 properties
}
```

Components reference these via `var(--bg-primary)` in inline styles or `style={{ color: theme.textPrimary }}`.

### Edge Cases

- Corrupt localStorage → caught, defaults to `DEFAULT_THEME`.
- Server-side rendering → `loadTheme()` returns defaults (no `window`).
- Mount delay prevents FOUC (flash of unstyled content).

---

## `useTimeBuffer`

`src/lib/useTimeBuffer.ts`

**Purpose:** Bounded time-series buffer for windowed averaging. Live polling and
retained history are separate; a selector never implies more coverage than was
actually retained.

### Return Value

```typescript
{
  getWindowData: (windowMs: number) => T[];
  getWindowAverage: (windowMs: number, mapFn: (item: T) => number) => number;
  bufferSize: number;
  retainedMs: number;   // actual coverage
  truncated: boolean;   // a time/count/byte limit evicted data
}
```

### Behavior

- **On `data` change:** appends a snapshot unless the previous one is younger than
  5 seconds.
- **Limits:** one hour, 720 samples and 64 MiB of accounted retained telemetry,
  whichever is reached first; oldest entries are evicted.
- **`getWindowData(ms)`:** entries where `timestamp >= now - ms`.
- **`getWindowAverage(ms, mapFn)`:** mean over the window, `0` when empty.

`appendBoundedSample` and `createBuffer` are exported pure helpers for tests.

### Exported Helpers

The averaging helpers (`averageProdStats`, `averagePowerStats`,
`extractItemTimeSeries`) are unchanged.

### Edge Cases

- **Empty buffer:** `[]` / `0`.
- **Single snapshot:** average equals the single value.
- **Truncation:** `truncated` becomes `true`; panels should show actual coverage.
