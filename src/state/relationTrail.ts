import { useAppStore, type AppState } from '@/state/appStore';
import type { RelationTrail } from '@/state/slices/types';

/**
 * Terug en vooruit in het relatiepaneel (issue #888, eigenaarsbesluit 2026-11-14 "3").
 *
 * Alleen sprongen via het paneel tellen: het nummer van een voorganger of opvolger aanklikken. Een eigen
 * keuze in tabel of Gantt telt niet mee en wist het spoor ook niet; terug en vooruit lopen vanaf de plek
 * in het spoor, niet vanaf de taak die toevallig geselecteerd is. Springt het paneel vanaf zo'n zelf
 * gekozen taak, dan komt die taak als vertrekpunt in het spoor: terug brengt je daar weer.
 *
 * Het spoor hoort bij het document (`ui.relationTrails`, sessie, geen undo). Een verwijderde taak blijft
 * erin staan en wordt bij terug en vooruit overgeslagen, zodat ongedaan maken haar terugbrengt; de taak
 * waar je al op staat wordt ook overgeslagen, anders doet een klik zichtbaar niets.
 */

export type TrailDirection = 'back' | 'forward';

function trailOf(state: AppState): RelationTrail | undefined {
  return state.ui.relationTrails.find(t => t.documentId === state.activeDocumentId);
}

function targetIndex(state: AppState, direction: TrailDirection): number | null {
  const trail = trailOf(state);
  if (!trail) return null;
  const step = direction === 'back' ? -1 : 1;
  const exists = new Set(state.tasks.map(t => t.id));
  for (let i = trail.index + step; i >= 0 && i < trail.taskIds.length; i += step) {
    const id = trail.taskIds[i];
    if (exists.has(id) && id !== state.activeTaskId) return i;
  }
  return null;
}

/** De taak waar terug of vooruit heen gaat, of `null` als de knop grijs is. */
export function relationTrailTarget(state: AppState, direction: TrailDirection): string | null {
  const index = targetIndex(state, direction);
  return index === null ? null : trailOf(state)!.taskIds[index];
}

/** Schrijf het spoor van het actieve document; sporen van gesloten documenten vallen af. */
function writeTrail(state: AppState, taskIds: string[], index: number): void {
  const open = new Set(state.documents.map(d => d.id));
  const documentId = state.activeDocumentId;
  state.setUI({
    relationTrails: [
      ...state.ui.relationTrails.filter(t => t.documentId !== documentId && open.has(t.documentId)),
      { documentId, taskIds, index },
    ],
  });
}

/** Spring via het paneel naar een gekoppelde taak en leg de sprong vast in het spoor. */
export function jumpToRelatedTask(taskId: string): void {
  const state = useAppStore.getState();
  const from = state.activeTaskId;
  const trail = trailOf(state);
  // Wat vooruit lag vervalt, zoals in een browser.
  const ids = trail ? trail.taskIds.slice(0, trail.index + 1) : [];
  if (from && ids[ids.length - 1] !== from) ids.push(from);
  if (ids[ids.length - 1] !== taskId) ids.push(taskId);
  writeTrail(state, ids, ids.length - 1);
  state.focusOnTask(taskId);
}

/** Terug of vooruit in het spoor. Geeft `false` als er niets is om heen te gaan. */
export function stepRelationTrail(direction: TrailDirection): boolean {
  const state = useAppStore.getState();
  const index = targetIndex(state, direction);
  if (index === null) return false;
  const trail = trailOf(state)!;
  writeTrail(state, trail.taskIds, index);
  state.focusOnTask(trail.taskIds[index]);
  return true;
}
