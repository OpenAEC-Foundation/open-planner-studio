export const TASK_NAME_INDENT_UNIT = 20;

export const GROUPED_NAME_INDENT_UNIT = 14;

export const SUMMARY_ADD_SLOT_WIDTH = 28;

export type TaskNameIndentMode = 'tree' | 'grouped';

export function taskNameIndent(depth: number, hasDisclosure: boolean, mode: TaskNameIndentMode = 'tree'): number {
  const level = Math.max(0, Math.floor(depth));
  if (mode === 'grouped') return level * GROUPED_NAME_INDENT_UNIT;
  return level * TASK_NAME_INDENT_UNIT + (hasDisclosure ? 0 : TASK_NAME_INDENT_UNIT);
}

export function taskNameFixedWidth(depth: number, hasDisclosure: boolean, mode: TaskNameIndentMode = 'tree'): number {
  return taskNameIndent(depth, hasDisclosure, mode)
    + (hasDisclosure ? TASK_NAME_INDENT_UNIT + SUMMARY_ADD_SLOT_WIDTH : 0);
}
