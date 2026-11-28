import { useAppStore } from '@/state/appStore';
import { loadAllSettings } from '@/utils/settingsRegistry';

export async function loadSettingsBeforeFirstRender(): Promise<void> {
  try {
    useAppStore.getState().setUI(await loadAllSettings());
  } catch (error) {
    console.error('Instellingen laden mislukt; de app draait op de standaardwaarden:', error);
  }
}
