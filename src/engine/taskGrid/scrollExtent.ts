export const OVERLAY_SCROLLBAR_SIZE = 8;

export const TASK_GRID_CHOOSER_STRIP = 32;

export function taskListScrollContentHeight(viewRowCount: number, rowHeight: number, hasGhostRow: boolean): number {
  return (Math.max(0, viewRowCount) + (hasGhostRow ? 1 : 0)) * rowHeight + OVERLAY_SCROLLBAR_SIZE;
}
