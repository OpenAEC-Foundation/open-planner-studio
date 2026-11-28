import { readMPP } from '@/services/mpp/mppReader';
import { solveProject } from '@/engine/scheduler/solveProject';
import { scanGroundTruthTasks, type RawTask } from './mppGroundTruth';
import { classify, compareFidelityRow, countFidelityAxis } from './fidelityCore';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Project } from '@/types/project';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';

export { classify } from './fidelityCore';

const iso = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 16) : null);
const dayOf = (s: string): string => s.slice(0, 10);

function dayDelta(ours: string, truth: string): number {
  const a = parseInstant(dayOf(ours)).getTime();
  const b = parseInstant(dayOf(truth)).getTime();
  return Math.round((a - b) / 86400000);
}

export interface SolvedMpp {
  tasks: Task[];
  sequences: Sequence[];
  project: Project;
  cpmError: string | null;
}

export function solveMppBytes(bytes: Uint8Array): SolvedMpp {
  const result = readMPP(bytes);
  const cpm = solveProject({
    tasks: result.tasks,
    sequences: result.sequences,
    calendar: result.calendar,
    calendars: result.resourceCalendars ?? [],
    dataDate: result.project.statusDate,
    progressMode: result.project.progressMode,
    schedulingOptions: solveOptionsFor(result.project).schedulingOptions,
    projectStartDate: result.project.startDate,
  });
  return { tasks: result.tasks, sequences: result.sequences, project: result.project, cpmError: cpm.error ?? null };
}

export interface DiffTaskDetail {
  id: string;
  name: string;
  msStart: string | null;
  ourStart: string;
  msFinish: string | null;
  ourFinish: string;
  startMark: ' ' | '~' | 'X';
  finishMark: ' ' | '~' | 'X';
  durationDays: number;
  isMilestone: boolean;
  constraint: string;
  completionPct: number;
  actualStart: string;
  calendarId: string;
  preds: string;
}

export interface FidelityRow {
  status: 'ok' | 'rejected' | 'error';
  errCode?: string;
  errMsg?: string;
  tasks: number;
  startExact: number;
  startSameday: number;
  startDiff: number;
  finishExact: number;
  finishSameday: number;
  finishDiff: number;
  diffBuckets: Record<string, number>;
  diffTasks: DiffTaskDetail[];
}

function rejectedRow(errCode: string, errMsg: string): FidelityRow {
  return {
    status: 'rejected', errCode, errMsg, tasks: 0,
    startExact: 0, startSameday: 0, startDiff: 0, finishExact: 0, finishSameday: 0, finishDiff: 0,
    diffBuckets: {}, diffTasks: [],
  };
}

function errorRow(errMsg: string): FidelityRow {
  return {
    status: 'error', errMsg, tasks: 0,
    startExact: 0, startSameday: 0, startDiff: 0, finishExact: 0, finishSameday: 0, finishDiff: 0,
    diffBuckets: {}, diffTasks: [],
  };
}

export function measureFidelity(bytes: Uint8Array): FidelityRow {
  let solved: SolvedMpp;
  try {
    solved = solveMppBytes(bytes);
  } catch (e: unknown) {
    const err = e as { mppCode?: string; message?: unknown; name?: unknown };
    if (err && typeof err.mppCode === 'string') {
      return rejectedRow(err.mppCode, String(err.message ?? e).slice(0, 200));
    }
    return errorRow(String((e as Error)?.message ?? e).slice(0, 300));
  }

  let raws: RawTask[];
  try {
    ({ raws } = scanGroundTruthTasks(bytes));
  } catch (e: unknown) {
    return errorRow(`scanGroundTruthTasks: ${String((e as Error)?.message ?? e)}`);
  }

  const { tasks, sequences, project } = solved;
  if (raws.length !== tasks.length) {
    return errorRow(`grondwaarheid-uitlijning mislukt: ${raws.length} raw vs ${tasks.length} taken (readTasks/scanGroundTruthTasks lopen niet meer synchroon op ID)`);
  }
  for (let i = 0; i < raws.length; i++) {
    if (raws[i].name !== tasks[i].name) {
      return errorRow(
        `grondwaarheid-uitlijning mislukt op positie ${i}: raw naamlengte ${raws[i].name.length} `
        + `(MSP-id ${raws[i].id}) ≠ readMPP-naamlengte ${tasks[i].name.length} — de twee scans zijn losgeraakt `
        + `(namen bewust niet in deze melding — draai OPS_MPP_FIDELITY_REPORT=detail voor de inhoud)`,
      );
    }
  }

  const truthStart = new Map<string, string | null>();
  const truthFinish = new Map<string, string | null>();
  raws.forEach((r, i) => {
    truthStart.set(tasks[i].id, iso(r.start));
    truthFinish.set(tasks[i].id, iso(r.finish));
  });

  if (solved.cpmError) {
    return errorRow(`CPM-fout: ${solved.cpmError}`);
  }

  const predsOf = new Map<string, string[]>();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const s of sequences) {
    const list = predsOf.get(s.successorId) ?? [];
    list.push(`${byId.get(s.predecessorId)?.name.slice(0, 18) ?? '?'}[${s.type}]`);
    predsOf.set(s.successorId, list);
  }

  const comparisonRows = tasks.map(t => compareFidelityRow(t.id, {
    start: { ours: t.time.earlyStart, truth: truthStart.get(t.id) ?? null },
    finish: { ours: t.time.earlyFinish, truth: truthFinish.get(t.id) ?? null },
  }));
  const startCounts = countFidelityAxis(comparisonRows, 'start');
  const finishCounts = countFidelityAxis(comparisonRows, 'finish');
  const buckets: Record<string, number> = {};
  const bump = (k: string) => { buckets[k] = (buckets[k] ?? 0) + 1; };
  const diffTasks: DiffTaskDetail[] = [];

  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
    const t = tasks[taskIndex];
    const comparison = comparisonRows[taskIndex];
    const truthS = truthStart.get(t.id) ?? null;
    const truthF = truthFinish.get(t.id) ?? null;
    const cs = comparison.axes.start.verdict;
    const cf = comparison.axes.finish.verdict;

    if (cs === 'diff') {
      const delta = dayDelta(t.time.earlyStart, truthS!);
      if (truthS! < project.startDate) bump('storedVoorProjectstart');
      if ((t.time.completion ?? 0) > 0) bump('heeftVoortgang');
      if (t.childIds.length > 0) bump('samenvattingstaak');
      if (t.constraint) bump('heeftConstraint');
      bump(delta > 0 ? 'wijLater' : 'wijVroeger');
      bump('totaal');
    }

    if (cs !== 'exact' || cf !== 'exact') {
      const mark = (c: ReturnType<typeof classify>): ' ' | '~' | 'X' => (c === 'exact' ? ' ' : c === 'sameday' ? '~' : 'X');
      diffTasks.push({
        id: t.id,
        name: t.name,
        msStart: truthS,
        ourStart: t.time.earlyStart,
        msFinish: truthF,
        ourFinish: t.time.earlyFinish,
        startMark: mark(cs),
        finishMark: mark(cf),
        durationDays: t.time.scheduleDuration,
        isMilestone: t.isMilestone,
        constraint: t.constraint ? `${t.constraint.type}${t.constraint.date ?? ''}` : '-',
        completionPct: Math.round((t.time.completion ?? 0) * 100),
        actualStart: t.time.actualStart ?? '-',
        calendarId: t.calendarId ?? '-',
        preds: (predsOf.get(t.id) ?? []).join(','),
      });
    }
  }

  return {
    status: 'ok',
    tasks: tasks.length,
    startExact: startCounts.exact, startSameday: startCounts.sameday, startDiff: startCounts.diff,
    finishExact: finishCounts.exact, finishSameday: finishCounts.sameday, finishDiff: finishCounts.diff,
    diffBuckets: buckets,
    diffTasks,
  };
}
