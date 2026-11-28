import { appStoreContext, type AppStoreContext } from '@/state/appStore';
import { ensureFreshSchedule as ensureFreshScheduleFor, type FreshResult } from './freshness';

export { ensureFreshScheduleForRead, type FreshResult, type ReadFreshResult } from './freshness';

export function ensureFreshSchedule(app: AppStoreContext = appStoreContext): FreshResult {
  return ensureFreshScheduleFor(app);
}
