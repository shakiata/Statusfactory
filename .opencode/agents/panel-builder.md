---
description: Builds or edits Statusfactory dashboard panels. Use when adding, modifying or refactoring a dashboard tab component. Triggered by "panel", "dashboard tab", "add a tab", "new component".
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: allow
  - action: shell
    resource: "*"
    effect: allow
  - action: read
    resource: "*.env"
    effect: deny
  - action: read
    resource: "*.env.*"
    effect: deny
---

You are building or editing a **Statusfactory dashboard panel**. Read
`AGENTS.md`, `docs/security/development-policy.md`, `src/components/AGENTS.md`
and the current register before changing files.

## File Location

- New panels go in `src/components/dashboard/<Name>.tsx`
- Register the panel in `src/app/page.tsx`:
  1. Import the component
  2. Add a `{ id: 'name', label: '🔧 Label', icon: '🔧' }` entry to `TABS`
  3. Add a conditional render `{activeTab === 'name' && <Component config={config} ... />}`

## Component Template

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/useTheme';
import { useTimeBuffer } from '@/lib/useTimeBuffer';
import { fetchEndpoint } from '@/lib/api';
import type { FRMConfig } from '@/lib/types';
import type { TimeWindowMs } from '@/components/TimeWindowSelector';

/**
 * Renders <what> from the FRM endpoint <path>.
 * Inputs: the active connection config and the selected time window.
 * Side effects: one bounded poll per mounted panel; no credential persistence.
 */
export function MyNewPanel({
  config,
  timeWindow,
}: {
  config: FRMConfig;
  timeWindow: TimeWindowMs;
}) {
  const { theme } = useTheme();
  const [data, setData] = useState<SomeType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getWindowData } = useTimeBuffer(data);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchEndpoint<SomeType[]>(config, 'getSomeEndpoint')
        .then((res) => { if (!cancelled) setData(res); })
        .catch((err) => { if (!cancelled) setError(err.message); });
    };
    load();
    const interval = setInterval(load, config.refreshRate);
    return () => { cancelled = true; clearInterval(interval); };
  }, [config]);

  const windowed = timeWindow > 0 ? getWindowData(timeWindow) : data;

  if (error) {
    return <div role="alert" style={{ color: 'var(--danger)' }}>Error: {error}</div>;
  }

  return (
    <div style={{ color: theme.textPrimary, backgroundColor: theme.bgCard }}>
      {/* content */}
    </div>
  );
}
```

Do not build URLs, attach tokens or follow redirects yourself; use
`fetchEndpoint` so the shared origin/redirect/size policy applies.

## Theme Access

```tsx
const { theme } = useTheme();
// theme.textPrimary, textSecondary, bgCard, bgSecondary, bgPrimary, accent,
// accentHover, danger, success, info
```
