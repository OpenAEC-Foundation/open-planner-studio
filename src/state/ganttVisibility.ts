import type { UIState } from './slices/types';

/**
 * Staat de Gantt-tijdlijn in de werkruimte? Nee op de werkruimtes die hem vervangen (Tabel, IFC,
 * Rapport) en onder het VOLLEDIGE resourcepaneel; het gedockte paneel deelt de werkruimte juist
 * mét de Gantt. De backstage (`file`) telt hier niet: die ligt er tijdelijk
 * overheen en de Gantt komt ongewijzigd terug.
 *
 * Eén bron voor de werkruimtekeuze in `App` én voor de Gantt-gebonden modi (relatie tekenen,
 * taak splitsen): die kunnen alleen iets doen met een balk onder de muis.
 */
export function isGanttWorkspaceVisible(
  ui: Pick<UIState, 'activeRibbonTab' | 'showResourcePanel' | 'resourcePanelDocked'>,
): boolean {
  if (ui.showResourcePanel && !ui.resourcePanelDocked) return false;
  return ui.activeRibbonTab !== 'table' && ui.activeRibbonTab !== 'ifc' && ui.activeRibbonTab !== 'report';
}

/**
 * Staat de takenlijst (de planning) in beeld? Delete/Backspace/Ctrl+C/Ctrl+V, koppelen (lint en
 * Ctrl+F2) en toewijzen werken alleen dan. In Backstage (tabblad `file`), op de tabbladen Rapport en
 * IFC en onder het VOLLEDIGE resourcepaneel staat de takenlijst niet in beeld; daar verwijderde Delete
 * met de focus op bv. *Terug*, *Exporteer PDF* of de lintknop *Resources* een taak die de gebruiker
 * niet zag, en ving Ctrl+C het kopiëren van gidstekst weg. Ctrl+Z blijft daar wel werken
 * (Projectinstellingen in Backstage leunt erop). De presentatie toont altijd de Gantt.
 *
 * Bewust niet {@link isGanttWorkspaceVisible}: die is ook `false` op het tabblad Tabel, en daar staat
 * de takenlijst juist wél in beeld. Wel dezelfde paneelregel: een gedockt resourcepaneel deelt de
 * werkruimte met de planning, een volledig paneel vervangt hem.
 */
export function isTaskListInView(
  ui: Pick<UIState, 'presentationMode' | 'activeRibbonTab' | 'showResourcePanel' | 'resourcePanelDocked'>,
): boolean {
  if (ui.presentationMode) return true;
  if (ui.showResourcePanel && !ui.resourcePanelDocked) return false;
  return ui.activeRibbonTab !== 'file' && ui.activeRibbonTab !== 'report' && ui.activeRibbonTab !== 'ifc';
}
