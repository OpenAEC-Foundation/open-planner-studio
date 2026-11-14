// Bewaarde instellingen in de store zetten vóór de eerste render (issue #895).
//
// Vroeger hydrateerde `useSettingsBootstrap` ze pas na het mounten: de eerste weergave stond dan op de
// standaardwaarden en sprong een frame later naar de keuze van de gebruiker (lettertype, schaal,
// panelen, …). `main.tsx` wacht hierop vóór `render`; App.tsx zet lettertype en thema in een
// layout-effect, dus ze staan er vóór het eerste frame. Laat instellingen van een host blijven via
// `useSiteHostPreferences` lopen.
import { useAppStore } from '@/state/appStore';
import { loadAllSettings } from '@/utils/settingsRegistry';

/** Laadt alle instellingen in de store. Gooit nooit: bij een leesfout start de app op de standaardwaarden. */
export async function loadSettingsBeforeFirstRender(): Promise<void> {
  try {
    useAppStore.getState().setUI(await loadAllSettings());
  } catch (error) {
    console.error('Instellingen laden mislukt; de app draait op de standaardwaarden:', error);
  }
}
