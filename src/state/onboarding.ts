/**
 * De eerste-startervaring als pure regels: welkomstdialoog → rondleiding → tutorialvraag.
 *
 * Bladmodule (alleen typen uit `slices/types`), zodat `tests/planning/check-first-start.ts` de
 * regels headless kan aflopen en zowel `TourOverlay` als `useUpdateCheck` dezelfde bron lezen.
 *
 * DE DRIE REGELS (eigenaarsbesluit 2026-09-28).
 *  1. De tutorialvraag komt alleen na een VOLTOOIDE rondleiding (Volgende/Klaar op de laatste stap),
 *     niet na Overslaan, Escape of een afgebroken rondleiding, en alleen zolang hij nog niet
 *     beantwoord is — eenmalig, ook als de gebruiker de rondleiding later opnieuw afmaakt.
 *  2. Zolang de eerste-startervaring loopt (welkomst op komst of open, rondleiding open,
 *     tutorialvraag open) wacht "Update beschikbaar": er komt niets over elkaar heen.
 *  3. De overgangen gebeuren in ÉÉN `setUI`: welkomst dicht + rondleiding open, en rondleiding dicht +
 *     tutorialvraag open. Anders ziet een store-abonnee (de wachtende updatedialoog) tussendoor een
 *     moment waarop "alles dicht" lijkt.
 */
import type { TourUiSnapshot, UIState } from './slices/types';

/** Loopt de eerste-startervaring nog? Zie regel 2. */
export function isOnboardingActive(
  ui: Pick<UIState, 'welcomePending' | 'showWelcomeDialog' | 'showTourOverlay' | 'showTutorialOffer'>,
): boolean {
  return ui.welcomePending || ui.showWelcomeDialog || ui.showTourOverlay || ui.showTutorialOffer;
}

/** Hoe een rondleiding eindigde: `completed` alleen via Volgende/Klaar op de laatste stap. */
export type TourEnd = 'completed' | 'aborted';

/**
 * De `setUI`-patch waarmee een rondleiding sluit: de door de tour aangeraakte velden terug naar de
 * stand van vóór de start (of het Start-tabblad zonder snapshot), de tour dicht, en — alleen bij een
 * voltooide rondleiding die de vraag nog niet stelde — de tutorialvraag open. Eén patch: regel 3.
 */
export function tourFinishPatch(
  ui: Pick<UIState, 'tourSnapshot' | 'tutorialOfferAnswered'>,
  end: TourEnd,
): Partial<UIState> {
  const restore: Partial<TourUiSnapshot> = ui.tourSnapshot ?? { activeRibbonTab: 'start' };
  return {
    ...restore,
    tourSnapshot: null,
    showTourOverlay: false,
    ...(end === 'completed' && !ui.tutorialOfferAnswered ? { showTutorialOffer: true } : {}),
  };
}
