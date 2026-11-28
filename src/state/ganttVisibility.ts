import type { UIState } from './slices/types';

export function isGanttWorkspaceVisible(
  ui: Pick<UIState, 'activeRibbonTab' | 'showResourcePanel' | 'resourcePanelDocked'>,
): boolean {
  if (ui.showResourcePanel && !ui.resourcePanelDocked) return false;
  return ui.activeRibbonTab !== 'table' && ui.activeRibbonTab !== 'ifc' && ui.activeRibbonTab !== 'report';
}

export function isTaskListInView(
  ui: Pick<UIState, 'presentationMode' | 'activeRibbonTab' | 'showResourcePanel' | 'resourcePanelDocked'>,
): boolean {
  if (ui.presentationMode) return true;
  if (ui.showResourcePanel && !ui.resourcePanelDocked) return false;
  return ui.activeRibbonTab !== 'file' && ui.activeRibbonTab !== 'report' && ui.activeRibbonTab !== 'ifc';
}
