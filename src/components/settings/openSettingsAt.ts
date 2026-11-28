import { useAppStore } from '@/state/appStore';
import type { SettingId } from '@/utils/settingIds';

export function openSettingsAt(id: SettingId): void {
  const { ui, setUI } = useAppStore.getState();
  if (ui.activeRibbonTab === 'file') setUI({ backstageSection: 'settings', settingsFocusId: id });
  else setUI({ showSettingsDialog: true, settingsFocusId: id });
}
