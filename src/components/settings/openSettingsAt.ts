import { useAppStore } from '@/state/appStore';
import type { SettingId } from '@/utils/settingIds';

/**
 * Opent de app-instellingen op precies één instelling: het paneel gaat naar de groep, laat de
 * instelling even oplichten en geeft hem de focus. Staat Backstage open (bv. vanuit de Help), dan
 * gebeurt dat in Backstage → App-instellingen; anders in de instellingendialoog.
 */
export function openSettingsAt(id: SettingId): void {
  const { ui, setUI } = useAppStore.getState();
  if (ui.activeRibbonTab === 'file') setUI({ backstageSection: 'settings', settingsFocusId: id });
  else setUI({ showSettingsDialog: true, settingsFocusId: id });
}
