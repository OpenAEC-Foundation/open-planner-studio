import type { ExternalLink, Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { CPMResult } from './scheduler/CPMSolver';
import { cloneTasksForSolve, solveProject } from './scheduler/solveProject';
import { solveInputFor, type SolveProjectFields } from './scheduler/solveInput';
import { shownFinish, shownStart } from '@/utils/taskDates';

export interface ExternalAnchorChange {
  taskId: string;
  linkId: string;
  link: ExternalLink;
  before: Pick<ExternalLink, 'anchorDate' | 'sourceMissing'>;
}

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
  cpmResult: CPMResult | null;
}

export interface ExternalRefreshPreview {
  changes: ExternalAnchorChange[];
  shiftedTaskIds: string[];
  endBefore: string;
  endAfter: string;
  durationBefore: number;
  durationAfter: number;
  failed?: Pick<CPMResult, 'error' | 'errorInfo'>;
}

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
