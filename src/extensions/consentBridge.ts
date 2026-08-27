/**
 * Bedrading tussen de toestemmingsvraag (`consent.ts`) en de dialoog die hem stelt.
 *
 * WAAROM EEN APARTE MODULE EN NIET IN DE DIALOOG. `ExtensionConsentDialog` wordt in `App.tsx` LAZY
 * geladen, net als de andere dialogen. De vrager moet daarentegen METEEN bij het opstarten
 * geregistreerd staan: de faalstand van `askExtensionConsent` is weigeren, dus zou een installatie
 * die start vóór het dialoogchunk binnen is stilzwijgend afketsen. Deze module is klein en
 * component-vrij, dus `App.tsx` kan hem eager importeren zonder de dialoog mee te trekken.
 *
 * De RESOLVER staat bewust in module-state en niet in de store: een promise-resolver is geen
 * documentdata en heeft in een snapshot of payload niets te zoeken — dezelfde afweging als de
 * coalesce-marker in `state/transaction.ts`. De store draagt alleen de VRAAG
 * (`ui.pendingExtensionConsent`), zodat de dialoog er reactief op kan renderen.
 */
import { useAppStore } from '@/state/appStore';
import { setConsentAsker } from './consent';

let resolvePending: ((granted: boolean) => void) | null = null;

/** Beantwoord de openstaande vraag. Geen openstaande vraag ⇒ no-op (dubbelklik op de knop). */
export function resolveExtensionConsent(granted: boolean): void {
  const resolve = resolvePending;
  if (!resolve) return;
  resolvePending = null;
  useAppStore.getState().setUI({ pendingExtensionConsent: null });
  resolve(granted);
}

/**
 * Registreer de dialoog als vrager. Eén keer aanroepen bij het opstarten.
 *
 * Er kan maar één vraag tegelijk openstaan. Komt er tóch een tweede binnen (twee installaties vlak
 * na elkaar aangeklikt), dan wordt de EERSTE geweigerd in plaats van vervangen — anders blijft die
 * promise voor eeuwig hangen en wacht het eerste installatiepad oneindig.
 */
export function installConsentDialogAsker(): void {
  setConsentAsker((request) => new Promise<boolean>((resolve) => {
    if (resolvePending) {
      const vorige = resolvePending;
      resolvePending = null;
      vorige(false);
    }
    resolvePending = (granted: boolean) => {
      resolvePending = null;
      useAppStore.getState().setUI({ pendingExtensionConsent: null });
      resolve(granted);
    };
    useAppStore.getState().setUI({ pendingExtensionConsent: request });
  }));
}
