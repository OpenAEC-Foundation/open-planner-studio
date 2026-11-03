// Een nieuwe versie van een bron eerst bekijken, dan accepteren (keuze 1, Ethan 2026-11-03; stap 1.5 in
// `docs/relaties-tussen-projecten.md`). Puur: geen store, geen bestanden. De balk telt met
// `externalAnchorChanges` hoeveel koppelingen veranderen; het venster *Bekijken* toont met
// `previewExternalRefresh` per koppeling het oude en het nieuwe anker en wat er in het eigen plan verschuift.
import type { ExternalLink, Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { CPMResult } from './scheduler/CPMSolver';
import { cloneTasksForSolve, solveProject } from './scheduler/solveProject';
import { solveInputFor, type SolveProjectFields } from './scheduler/solveInput';

/** Eén koppeling die verandert: het anker schuift, of de brontaak staat niet meer in de bron (of weer wel). */
export interface ExternalAnchorChange {
  taskId: string;
  linkId: string;
  /** De koppeling zoals ze na verversen is. */
  link: ExternalLink;
  before: Pick<ExternalLink, 'anchorDate' | 'sourceMissing'>;
}

/**
 * De koppelingen die tussen `before` en `after` (de uitkomst van `refreshExternalAnchors`) een ander anker
 * of een andere status *brontaak ontbreekt* kregen. Alleen een nieuwe herkomst (versie, leestijd) of een
 * nieuwe naam telt niet: dan verandert er voor de planning niets.
 */
export function externalAnchorChanges(before: readonly Task[], after: readonly Task[]): ExternalAnchorChange[] {
  const beforeById = new Map(before.map(task => [task.id, task] as const));
  const out: ExternalAnchorChange[] = [];
  for (const task of after) {
    const previous = beforeById.get(task.id);
    if (!previous || previous === task) continue;
    const previousLinks = new Map((previous.externalLinks ?? []).map(link => [link.id, link] as const));
    for (const link of task.externalLinks ?? []) {
      const old = previousLinks.get(link.id);
      if (!old || old === link) continue;
      if (old.anchorDate === link.anchorDate && old.sourceMissing === link.sourceMissing) continue;
      out.push({ taskId: task.id, linkId: link.id, link, before: { anchorDate: old.anchorDate, sourceMissing: old.sourceMissing } });
    }
  }
  return out;
}

export interface ExternalRefreshDoc {
  project: SolveProjectFields;
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
}

export interface ExternalRefreshPreview {
  changes: ExternalAnchorChange[];
  /** Bladtaken waarvan de vroege start of het vroege einde verschuift. */
  shiftedTaskIds: string[];
  /** Het projecteinde vóór en na accepteren (`''` zonder taken). */
  endBefore: string;
  endAfter: string;
  /** De projectduur in werkdagen vóór en na accepteren. */
  durationBefore: number;
  durationAfter: number;
  /** Een fout van de berekening (een kring e.d.); dan zijn de verschuivingen niet bekend. */
  failed?: Pick<CPMResult, 'error' | 'errorInfo'>;
}

/**
 * Rekent het plan door zoals het nu is en zoals het na accepteren is, elk op een kopie (zoals F5, via
 * `solveInputFor`). Beide kanten rekenen opnieuw, zodat voor en na met dezelfde motor en dezelfde opties
 * gemeten zijn, ook als het plan verouderd is of de datums uit het bestand toont.
 */
export function previewExternalRefresh(doc: ExternalRefreshDoc, refreshed: Task[]): ExternalRefreshPreview {
  const changes = externalAnchorChanges(doc.tasks, refreshed);
  const solve = (tasks: Task[]) => {
    const copy = cloneTasksForSolve(tasks);
    const result = solveProject(solveInputFor(doc.project, copy, doc.sequences, doc.calendar, doc.calendars));
    return { copy, result };
  };
  const before = solve(doc.tasks);
  const after = solve(refreshed);
  const failed = before.result.error ? before.result : after.result.error ? after.result : null;
  if (failed) {
    return {
      changes, shiftedTaskIds: [], endBefore: '', endAfter: '', durationBefore: 0, durationAfter: 0,
      failed: { error: failed.error, errorInfo: failed.errorInfo },
    };
  }
  const beforeById = new Map(before.copy.map(task => [task.id, task] as const));
  const shiftedTaskIds = after.copy
    .filter(task => task.childIds.length === 0)
    .filter(task => {
      const old = beforeById.get(task.id);
      return !!old && (old.time.earlyStart !== task.time.earlyStart || old.time.earlyFinish !== task.time.earlyFinish);
    })
    .map(task => task.id);
  return {
    changes,
    shiftedTaskIds,
    endBefore: before.result.projectEnd,
    endAfter: after.result.projectEnd,
    durationBefore: before.result.projectDuration,
    durationAfter: after.result.projectDuration,
  };
}
