import type { Task } from '@/types/task';
import type { GridIntent, GridWriteIntent } from '@/types/taskGrid';
import type { ViewRow } from '@/engine/view/visibleRows';

/**
 * De spookregel onderaan het taakraster (review vader 2026-10-06, punt 1).
 *
 * Onder de laatste taak staat altijd één lege, grijze regel. Dat is GEEN taak: hij staat niet in de
 * store, niet in de Gantt en niet in het bestand. Het raster behandelt hem als een gewone taakrij,
 * zodat klikken, pijltjes, Tab en Enter er vanzelf naartoe gaan. Pas zodra er in een cel van die
 * regel iets wordt vastgelegd, maakt het raster in één undo-stap een echte taak en schrijft de
 * waarde daarop (`retargetGhostIntents`). Vul je niets in en ga je weg, dan is er dus niets
 * gebeurd: geen taak, geen undo-stap, geen gewijzigd document.
 *
 * Alleen in de boomweergave (zonder filter, groepering of sortering): daar is "onderaan" ook echt
 * de plek waar de nieuwe taak landt.
 */
export const GHOST_ROW_KEY = 'ops-ghost-row';
export const GHOST_TASK_ID = 'ops-ghost-task';

export function isGhostTaskId(id: string | null | undefined): boolean {
  return id === GHOST_TASK_ID;
}

/** De laatste ECHTE taakrij: het anker waaronder de nieuwe taak komt, en het niveau van de spookregel. */
export function lastTaskRow(rows: readonly ViewRow[]): Extract<ViewRow, { kind: 'task' }> | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index];
    if (row.kind === 'task' && !isGhostTaskId(row.task.id)) return row;
  }
  return null;
}

/** Rijen van het raster mét de spookregel achteraan, op het niveau van de laatste taak. */
export function appendGhostRow(rows: readonly ViewRow[], ghostTask: Task): ViewRow[] {
  const last = lastTaskRow(rows);
  return [...rows, { kind: 'task', rowKey: GHOST_ROW_KEY, task: ghostTask, depth: last?.depth ?? 0, dimmed: false }];
}

export function intentsTouchGhost(intents: readonly GridIntent[]): boolean {
  return intents.some(intent => intent.kind === 'paste'
    ? intent.writes.some(write => isGhostTaskId(write.taskId))
    : isGhostTaskId(intent.taskId));
}

function retargetWrite(write: GridWriteIntent, taskId: string): GridWriteIntent {
  return isGhostTaskId(write.taskId) ? { ...write, taskId } : write;
}

/** Dezelfde writes, maar op de zojuist aangemaakte taak in plaats van op de spookregel. */
export function retargetGhostIntents(intents: readonly GridIntent[], taskId: string): GridIntent[] {
  return intents.map(intent => intent.kind === 'paste'
    ? { ...intent, writes: intent.writes.map(write => retargetWrite(write, taskId)) }
    : retargetWrite(intent, taskId));
}
