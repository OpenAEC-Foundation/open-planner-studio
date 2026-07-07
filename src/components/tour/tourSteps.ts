import { useAppStore } from '@/state/appStore';

export interface TourStep {
  /** Waarde van het `data-tour-anchor` attribuut op het ankerelement (zie de componenten die dit
   *  attribuut zetten: Ribbon.tsx, App.tsx, GanttCanvas.tsx, Backstage.tsx). Geen CSS-selector —
   *  `TourOverlay` bouwt zelf `[data-tour-anchor="<anchor>"]`. */
  anchor: string;
  titleKey: string;
  bodyKey: string;
  /** Voorbereiding vóór het meten van het anker: dezelfde `setUI(...)`-aanroepen die de Ribbon-
   *  knoppen/Backstage-navigatie zelf al gebruiken (zie ontwerpdocument §4/§6). */
  prepare: () => void;
}

// Stappenlijst + ankers bewust in ÉÉN bestand (risico §7.4 uit het ontwerpdocument): een
// toekomstige ribbon-/layout-refactor die een `data-tour-anchor` verplaatst of hernoemt moet
// hier meegroeien. `TourOverlay` slaat een stap over (nooit een crash) als het anker ontbreekt.
export const TOUR_STEPS: TourStep[] = [
  {
    // Stap 1 — lint-tabs. Altijd zichtbaar (ook tijdens Backstage), dus geen prepare nodig.
    anchor: 'ribbon-tabs',
    titleKey: 'tour.step1Title',
    bodyKey: 'tour.step1Body',
    prepare: () => { /* tabstrip altijd zichtbaar, geen voorbereiding nodig */ },
  },
  {
    // Stap 2 — taaktabel + Gantt. 'start'-tab garandeert dat isFullPanel false is (App.tsx),
    // zodat de Gantt-kaart (met ingebedde taaktabel) zichtbaar is i.p.v. een full-panel-view.
    anchor: 'gantt-panel',
    titleKey: 'tour.step2Title',
    bodyKey: 'tour.step2Body',
    prepare: () => { useAppStore.getState().setUI({ activeRibbonTab: 'start' }); },
  },
  {
    // Stap 3 — eigenschappenpaneel. Klapt het rechterpaneel uit (indien dichtgeklapt).
    anchor: 'properties-panel',
    titleKey: 'tour.step3Title',
    bodyKey: 'tour.step3Body',
    prepare: () => {
      useAppStore.getState().setUI({ activeRibbonTab: 'start', rightPanelCollapsed: false });
    },
  },
  {
    // Stap 4 — histogram. De strook rendert binnen GanttCanvas zodra showHistogram aan staat,
    // ongeacht welke niet-full-panel ribbon-tab actief is — 'start' houdt het consistent met stap 2.
    anchor: 'histogram-strip',
    titleKey: 'tour.step4Title',
    bodyKey: 'tour.step4Body',
    prepare: () => {
      useAppStore.getState().setUI({ activeRibbonTab: 'start', showHistogram: true });
    },
  },
  {
    // Stap 5 — rapporten. 'report'-tab triggert de full-panel-tak in App.tsx (ReportPanel).
    anchor: 'report-panel',
    titleKey: 'tour.step5Title',
    bodyKey: 'tour.step5Body',
    prepare: () => { useAppStore.getState().setUI({ activeRibbonTab: 'report' }); },
  },
  {
    // Stap 6 — voorbeelden. Springt naar Backstage → Voorbeelden (vervangt de hele body, zie
    // ontwerpdocument §4 randgeval) — het anker zit op de Backstage-NavItem zelf.
    anchor: 'backstage-examples',
    titleKey: 'tour.step6Title',
    bodyKey: 'tour.step6Body',
    prepare: () => {
      useAppStore.getState().setUI({ activeRibbonTab: 'file', backstageSection: 'examples' });
    },
  },
  {
    // Stap 7 (aanvulling tijdens implementatie) — feedback-knop in de titelbalk, ALTIJD
    // zichtbaar bovenin (ook tijdens Backstage), dus geen prepare() nodig. Afsluitende stap:
    // de "Sluiten"-knop + de opruiming-naar-start-tab (in TourOverlay's `finish()`) landen hier
    // vanzelf, omdat dit de laatste stap in de lijst is.
    anchor: 'feedback-button',
    titleKey: 'tour.step7Title',
    bodyKey: 'tour.step7Body',
    prepare: () => { /* knop staat altijd bovenin, geen voorbereiding nodig */ },
  },
];
