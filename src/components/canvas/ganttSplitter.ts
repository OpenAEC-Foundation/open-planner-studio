import {
  TASK_TABLE_MAX_WIDTH,
  TASK_TABLE_MIN_WIDTH,
} from '@/utils/settingsStore';

export const GANTT_MIN_TIMELINE_WIDTH = 180;

/**
 * Breedte van de grijpzone van `.gantt-workspace-splitter` (globals.css: `width: 5px` en
 * `margin-inline-end: -5px`). De zone ligt over de eerste 5 px van de Gantt, aan de kant van de
 * takenlijst, en staat boven de Gantt (z 6). De zwevende horizontale Gantt-balk begint daarom pas
 * ná deze zone; anders lagen zijn eerste 5 px onder de splitter (eigenaarscheck 2026-10-20, PR #362).
 */
export const GANTT_WORKSPACE_SPLITTER_GRIP = 5;

export function effectiveTaskGridMax(workspaceWidth: number): number {
  return Math.min(
    TASK_TABLE_MAX_WIDTH,
    Math.max(TASK_TABLE_MIN_WIDTH, Math.round(workspaceWidth) - GANTT_MIN_TIMELINE_WIDTH),
  );
}

export function clampTaskGridWidth(width: number, workspaceWidth: number): number {
  return Math.min(
    effectiveTaskGridMax(workspaceWidth),
    Math.max(TASK_TABLE_MIN_WIDTH, Math.round(width)),
  );
}
