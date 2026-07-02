import type { Task } from '@/types/task';
import type { ActivityCodeType } from '@/types/structure';

/**
 * Groeperingsweergave (fase 2.2, "meerdere WBS-indelingen"): banden per
 * activity-code-waarde. Alleen bladtaken — samenvattingsrijen zijn een
 * boom-concept en vervallen in een codegroepering (P6-gedrag). Taken zonder
 * waarde komen achteraan onder het (vertaalde) "(geen)"-label; lege groepen
 * worden weggelaten. Gedeeld door TableEditor en GanttRenderer zodat beide
 * weergaven exact dezelfde banden tonen.
 */
export interface TaskGroup {
  label: string;
  color?: string;
  taskIds: string[];
}

export function groupTasksByCode(
  tasks: Task[],
  type: ActivityCodeType,
  noneLabel: string,
): TaskGroup[] {
  const leaves = tasks.filter(t => t.childIds.length === 0);
  const groups: TaskGroup[] = type.values.map(v => ({
    label: v.description ? `${v.code} — ${v.description}` : v.code,
    color: v.color,
    taskIds: leaves.filter(t => t.activityCodes?.[type.id] === v.id).map(t => t.id),
  }));
  const none = leaves.filter(t => !t.activityCodes?.[type.id]);
  if (none.length > 0) {
    groups.push({ label: noneLabel, taskIds: none.map(t => t.id) });
  }
  return groups.filter(g => g.taskIds.length > 0);
}
