import type { TourUiSnapshot, UIState } from './slices/types';
import { EXTENSIONS_ENABLED } from '@/utils/buildFlags';

export function isOnboardingActive(
  ui: Pick<UIState, 'welcomePending' | 'showWelcomeDialog' | 'showTourOverlay' | 'showTutorialOffer'>,
): boolean {
  return ui.welcomePending || ui.showWelcomeDialog || ui.showTourOverlay || ui.showTutorialOffer;
}

export type TourEnd = 'completed' | 'aborted';

export function tourFinishPatch(
  ui: Pick<UIState, 'tourSnapshot' | 'tutorialOfferAnswered'>,
  end: TourEnd,
): Partial<UIState> {
  const restore: Partial<TourUiSnapshot> = ui.tourSnapshot ?? { activeRibbonTab: 'start' };
  return {
    ...restore,
    tourSnapshot: null,
    showTourOverlay: false,
    ...(EXTENSIONS_ENABLED && end === 'completed' && !ui.tutorialOfferAnswered ? { showTutorialOffer: true } : {}),
  };
}
