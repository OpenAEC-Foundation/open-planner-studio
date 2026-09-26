import type { UIState } from './slices/types';

/**
 * Staat de Gantt-tijdlijn in de werkruimte? Nee op de werkruimtes die hem vervangen (Tabel, IFC,
 * Rapport) en onder het VOLLEDIGE resourcepaneel; het gedockte paneel deelt de werkruimte juist
 * mét de Gantt (fase 2.10 item 6). De backstage (`file`) telt hier niet: die ligt er tijdelijk
 * overheen en de Gantt komt ongewijzigd terug.
 *
 * Eén bron voor de werkruimtekeuze in `App` én voor de Gantt-gebonden modi (relatie tekenen,
 * taak splitsen — issue #174): die kunnen alleen iets doen met een balk onder de muis.
 */
export function isGanttWorkspaceVisible(
  ui: Pick<UIState, 'activeRibbonTab' | 'showResourcePanel' | 'resourcePanelDocked'>,
): boolean {
  if (ui.showResourcePanel && !ui.resourcePanelDocked) return false;
  return ui.activeRibbonTab !== 'table' && ui.activeRibbonTab !== 'ifc' && ui.activeRibbonTab !== 'report';
}
