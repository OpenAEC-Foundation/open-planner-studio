import {
  TASK_TABLE_MAX_WIDTH,
  TASK_TABLE_MIN_WIDTH,
} from '@/utils/settingsStore';

export const GANTT_MIN_TIMELINE_WIDTH = 180;

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
