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
import { shownFinish, shownStart } from '@/utils/taskDates';

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
  /** De berekening die de planner nu ziet: de statusbalk toont er het projecteinde en de duur van. In de
   *  weergave *Datums zoals opgeslagen* komt ze uit het bestand (`cpmResultFromRecorded`). */
  cpmResult: CPMResult | null;
}

export interface ExternalRefreshPreview {
  changes: ExternalAnchorChange[];
  /** Bladtaken waarvan de getoonde start of het getoonde einde verschuift (`shownStart`/`shownFinish`). */
  shiftedTaskIds: string[];
  /** Het projecteinde zoals de planner het nu ziet, en na accepteren. `endBefore` is `''` zonder berekening
   *  (of na een fout); `endAfter` is `''` zonder taken. */
  endBefore: string;
  endAfter: string;
  /** De projectduur in werkdagen: zoals de planner haar nu ziet (0 zonder berekening), en na accepteren. */
  durationBefore: number;
  durationAfter: number;
  /** Een fout van de berekening (een kring e.d.); dan zijn de verschuivingen niet bekend. */
  failed?: Pick<CPMResult, 'error' | 'errorInfo'>;
}

/**
 * Rekent het plan door zoals het na accepteren is, op een kopie (zoals F5, via `solveInputFor`), en zet dat
 * naast wat de planner nu ziet: de getoonde datums van de taken en het projecteinde van de laatste berekening
 * (`doc.cpmResult`). De oude kant rekent niet opnieuw (review #811): een plan dat verouderd is (een bewerking
 * zonder F5) of de datums uit het bestand toont, gaf anders een beginstand die niet in de planning staat.
 * Accepteren rekent hetzelfde door (`applyRefreshedTasks` → `runCPM`), dus het voorstel is wat er gebeurt.
 */
export function previewExternalRefresh(doc: ExternalRefreshDoc, refreshed: Task[]): ExternalRefreshPreview {
  const changes = externalAnchorChanges(doc.tasks, refreshed);
  const copy = cloneTasksForSolve(refreshed);
  const result = solveProject(solveInputFor(doc.project, copy, doc.sequences, doc.calendar, doc.calendars));
  if (result.error) {
    return {
      changes, shiftedTaskIds: [], endBefore: '', endAfter: '', durationBefore: 0, durationAfter: 0,
      failed: { error: result.error, errorInfo: result.errorInfo },
    };
  }
  const nowById = new Map(doc.tasks.map(task => [task.id, task] as const));
  const shiftedTaskIds = copy
    .filter(task => task.childIds.length === 0)
    .filter(task => {
      const now = nowById.get(task.id);
      return !!now && (shownStart(now) !== shownStart(task) || shownFinish(now) !== shownFinish(task));
    })
    .map(task => task.id);
  const seen = doc.cpmResult && !doc.cpmResult.error ? doc.cpmResult : null;
  return {
    changes,
    shiftedTaskIds,
    endBefore: seen?.projectEnd ?? '',
    endAfter: result.projectEnd,
    durationBefore: seen?.projectDuration ?? 0,
    durationAfter: result.projectDuration,
  };
}
