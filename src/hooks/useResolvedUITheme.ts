import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import type { ResolvedUITheme } from '@/utils/theme';
import { detectSystemPrefersDark, resolveUITheme, subscribeSystemPrefersDark } from '@/utils/theme';

/**
 * Houdt `ui.systemPrefersDark` gelijk aan het OS/browser-kleurschema. Eén abonnement voor de hele
 * app (aangeroepen in `App.tsx`), en bewust ONVOORWAARDELIJK — ook wanneer de gebruiker een vast
 * thema koos. Zo staat de actuele systeemstand al in de store op het moment dat hij naar
 * "Systeem" schakelt, en hoeft die schakeling geen extra detectie te doen.
 *
 * De initiële uitlezing wordt herhaald bij het mounten: tussen het bouwen van de store
 * (`uiSlice`, synchroon) en de eerste effect-run kan het systeem al omgezet zijn.
 */
export function useSystemColorSchemeSync(): void {
  useEffect(() => {
    const setUI = useAppStore.getState().setUI;
    const apply = (prefersDark: boolean) => {
      if (useAppStore.getState().ui.systemPrefersDark !== prefersDark) setUI({ systemPrefersDark: prefersDark });
    };
    apply(detectSystemPrefersDark());
    return subscribeSystemPrefersDark(apply);
  }, []);
}

/**
 * Het thema zoals het daadwerkelijk getekend moet worden: de voorkeur met `'system'` al opgelost.
 * Iedere consument die een thema TOEPAST (het `data-theme`-attribuut, de Canvas-2D-renderers)
 * gebruikt deze hook in plaats van `ui.uiTheme` — dat laatste is de voorkeur en kan `'system'`
 * zijn, wat geen geldig `data-theme` is. De settings-UI leest juist wél de voorkeur.
 *
 * De selector levert een primitieve string, dus hij is veilig voor Zustand's referentievergelijking.
 */
export function useResolvedUITheme(): ResolvedUITheme {
  return useAppStore(s => resolveUITheme(s.ui.uiTheme, s.ui.systemPrefersDark));
}
