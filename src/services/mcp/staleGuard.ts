// Versheids-guard: compatibiliteitsingang. De logica staat in `freshness.ts` (zonder app-singleton,
// zodat de headless MCP-server hem kan bundelen; issue #570). Deze module voegt alleen de
// app-singleton toe als default voor `ensureFreshSchedule()`; `verify:store-boundaries` bewaakt dat
// de singleton hier niets anders doet. Tools importeren uit `freshness.ts`.
import { appStoreContext, type AppStoreContext } from '@/state/appStore';
import { ensureFreshSchedule as ensureFreshScheduleFor, type FreshResult } from './freshness';

export { ensureFreshScheduleForRead, type FreshResult, type ReadFreshResult } from './freshness';

/** Zie `ensureFreshSchedule` in `freshness.ts`; zonder argument rekent hij op de app-singleton. */
export function ensureFreshSchedule(app: AppStoreContext = appStoreContext): FreshResult {
  return ensureFreshScheduleFor(app);
}
