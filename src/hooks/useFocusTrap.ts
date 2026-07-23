import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Focus-trap voor modale dialogen (a11y): houdt Tab/Shift+Tab binnen het dialoogpaneel, zodat de
 * toetsenbord-focus niet vanuit een open modaal de ribbon/quick-access/vensterknoppen erachter in
 * loopt. Complement van {@link useDialogKeys} (Escape/Enter) — samen geven ze een dialoog het
 * volledige `role="dialog"`/`aria-modal`-toetsenbordgedrag.
 *
 * Werking (één effect, draait exact één keer per open — `panelRef` is stabiel):
 *  - Bij mount: onthoud het actieve element als `trigger` (de knop die de dialoog opende) en zet de
 *    focus op het EERSTE focusbare element in het paneel; is er geen, krijgt het paneel zelf
 *    `tabindex="-1"` en de focus.
 *  - De keydown-listener zit OP HET PANEEL, niet op `document`. Dat is bewust: bij gestapelde
 *    dialogen (bv. `ConfirmDialog` met `z-[60]` boven een andere `Dialog`) heeft alleen het paneel
 *    met de focus de listener actief, dus de bovenste dialoog vangt Tab vanzelf.
 *  - Bij mount-cleanup: listener weg + focus terug naar `trigger`, maar alleen als die er nog is en
 *    focusbaar is (de trigger kan intussen verdwenen zijn — bv. een menu dat sloot bij het openen).
 *
 * Zichtbaarheidsfilter: `getClientRects().length > 0` — NIET `offsetParent`. De overlay is
 * `position: fixed`, en binnen een fixed-container is `offsetParent` altijd `null`, dus die zou
 * élk element wegfilteren.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      // Zichtbaar (fixed-proof, zie boven) en niet disabled.
      el.getClientRects().length > 0 && !(el as HTMLButtonElement).disabled,
  );
}

export function useFocusTrap(panelRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Onthoud wie de dialoog opende, zodat we de focus daar bij het sluiten weer terugleggen.
    const trigger = document.activeElement as HTMLElement | null;

    // Eerste focusbare element focussen; is er niets, dan het paneel zelf.
    const initial = getFocusable(panel);
    if (initial.length > 0) {
      initial[0].focus();
    } else {
      panel.setAttribute('tabindex', '-1');
      panel.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      // Inhoud kan intussen gewijzigd zijn (velden verschijnen/verdwijnen) → nú opnieuw bepalen.
      const focusable = getFocusable(panel);
      if (focusable.length === 0) {
        // Niets te focussen: houd de focus op het paneel i.p.v. hem te laten ontsnappen.
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Focus buiten het paneel (of erop belandde iets raars) → terug naar binnen.
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey) {
        // Shift+Tab op het eerste element → wrap naar het laatste.
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab op het laatste element → wrap naar het eerste.
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    panel.addEventListener('keydown', onKeyDown);

    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      // Focus terug naar de opener — maar alleen als die er nog is en focusbaar.
      if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    };
  }, [panelRef]);
}
