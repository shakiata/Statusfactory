---
name: satisfactory-stats
description: "Statusfactory domain orientation — Satisfactory/FRM data model, the 12 dashboard areas, panel conventions and repository navigation. Use for domain questions about panels, FRM endpoints or item/fluid classification. Security, credential, transport and release behavior is owned by docs/security/development-policy.md and the boundary-hardening skill, not by this file."
---

# Statusfactory — domain orientation

Next.js static export + Electron shell monitoring Satisfactory factories via
the Ficsit Remote Monitoring (FRM) REST API.

**Authority:** `docs/security/development-policy.md` owns security and workflow
policy; `docs/security/data/security_plan.json` owns requirements and gates;
`docs/architecture.md` and `docs/api-client.md` own current implementation
details. This skill is domain context only. It intentionally does **not**
restate token, transport, polling or release rules.

## The 12 dashboard areas

Power, Production, Factory, Resources, Generators, Trains, Inventory, Players,
Chat, Fluids, API Explorer, Settings. Each panel lives in
`src/components/dashboard/<Name>.tsx` and is registered in `src/app/page.tsx`.

## Panel pattern

```tsx
'use client';

import { useEffect, useState } from 'react';
import { fetchEndpoint } from '@/lib/api';
import type { FRMConfig } from '@/lib/types';

/**
 * Displays the factory's <domain> data from <endpoint>.
 * Uses the shared bounded request path; never builds URLs or adds headers.
 */
export function PanelName({ config }: { config: FRMConfig }) {
  const [data, setData] = useState<SomeType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <div role="alert">Error: {error}</div>;
  return <div>{/* render */}</div>;
}
```

Call `fetchEndpoint` for reads and `sendChatMessage` for the chat write. Both
enforce the origin, redirect, deadline and size contracts.

## FRM endpoint families

- Power: `getPower`, `getPowerUsage`, `getCables`, `getSwitches`
- Generators: `getGenerators` and per-type variants (`getCoalGenerator`, …)
- Factory buildings: `getFactory` and per-type variants (`getAssembler`, …)
- Resources/logistics: `getExtractor`, `getPump`, `getPipes`, `getHypertube`, …
- Transport: `getTrains`, `getTrainStation`, `getDroneStation`, `getTruckStation`
- Session: `getPlayer`, `getModList`, `getMapMarkers`, `getProdStats`
- Inventory: `getWorldInv`, `getStorageInv`, `getCloudInv`, `getCrateInv`
- Research/events/creatures: `getRecipes`, `getSchematics`, `getArtifacts`, …
- Chat write: `sendChatMessage`

The registry lives in `src/lib/api.ts`; endpoint paths come from that registry,
never from remote response text.

## Domain helpers

- `src/lib/fluids.ts` — synchronous ClassName matching for liquids/gases and
  raw-material tracing.
- `src/lib/names.ts` — display-name normalization.
- `src/lib/formatters.ts` — number/rate formatting.
- `src/lib/colors.ts` — stable per-item colors.
- `src/components/ui/ItemIcon.tsx` — `public/Icons/` lookup by `ClassName`.

## Navigation

Read `AGENTS.md`, the applicable local `AGENTS.md`, `docs/README.md` and the
owning component doc before editing. Run `npm test && npm run build` for
verification; record what actually ran.
