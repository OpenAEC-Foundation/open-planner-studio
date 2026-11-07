import { useAppStore } from '@/state/appStore';
import { isFeatureEnabled } from '@/utils/featureFlags';

/**
 * Staan de B2-iconen aan (`?icons=b2`)? Standaard niet: dan ziet de app eruit als vóór B2 (#765).
 * Geen hook: `Icon` draait ook in tests met een eigen kopie van React. De vlag geldt vanaf het laden.
 * Plekken waar B2 een teken (✓, ▸, ⚠, ×, ▾) door een icoon verving, kiezen hiermee tussen oud en nieuw.
 */
export function b2IconsOn(): boolean {
  return isFeatureEnabled(useAppStore.getState().ui.featureFlags, 'b2-icons');
}
