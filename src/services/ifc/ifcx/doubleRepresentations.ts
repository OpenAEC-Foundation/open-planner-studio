import { isPinnedComplete } from '@/engine/scheduler/duration';
import { startIsActual } from '@/utils/taskDates';
import type { Project } from '@/types/project';
import type { DocumentReadTarget } from './fields/documentFields';
import type { TaskReadTarget } from './fields/taskFields';
import { lagFromShared, type SequenceReadTarget } from './fields/sequenceFields';
import { existingDatePart, momentOfSharedDate, nextCalendarDate, taskWindow } from './dateProjection';
import { ATTRIBUTE } from './profile';

export interface ReadTargets {
  readonly document: DocumentReadTarget;
  readonly tasks: readonly TaskReadTarget[];
  readonly sequences: readonly SequenceReadTarget[];
  readonly calendarIdAt: ReadonlyMap<string, string>;
}

export interface RepresentationProblem {
  readonly path?: string;
  readonly attribute: string;
  readonly field: string;
  readonly detail: string;
}

export interface DoubleRepresentation {
  readonly id: string;
  readonly shared: readonly string[];
  readonly precise: readonly string[];
  readonly conversion: string;
  readonly precedence: string;
  readonly resolve: (read: ReadTargets) => RepresentationProblem | number;
}

const ACTIVITY = ATTRIBUTE.activity;

function windowProblem(target: TaskReadTarget): RepresentationProblem | undefined {
  const { start, endExclusive } = target.span;
  const at = (field: string, detail: string) => ({ path: target.path, attribute: ACTIVITY, field, detail });
  if ((start === undefined) !== (endExclusive === undefined)) {
    return at(start === undefined ? 'start' : 'endExclusive', 'start en endExclusive staan er samen of geen van beide');
  }
  if (start === undefined || endExclusive === undefined) return undefined;
  if (endExclusive <= start) return at('endExclusive', 'endExclusive ligt niet na start');
  if (target.task.isMilestone && endExclusive !== nextCalendarDate(start)) return at('endExclusive', 'Een mijlpaal heeft een venster van precies één dag');
  const original = taskWindow(target.task);
  if (start !== original.start && startIsActual(target.task)) return at('start', 'De gedeelde start spreekt de werkelijke start tegen');
  if (endExclusive !== original.endExclusive && isPinnedComplete(target.task.time)) return at('endExclusive', 'Het gedeelde einde spreekt het werkelijke einde tegen');
  return undefined;
}

function applyWindow(target: TaskReadTarget): boolean {
  const { task, span } = target;
  if (span.start === undefined || span.endExclusive === undefined) return false;
  const original = taskWindow(task);
  const startMoves = span.start !== original.start;
  const endMoves = span.endExclusive !== original.endExclusive;
  if (!startMoves && !endMoves) return false;
  if (startMoves) task.time.scheduleStart = task.time.earlyStart = task.time.lateStart = momentOfSharedDate(span.start);
  if (endMoves || (startMoves && task.isMilestone)) {
    const moment = task.isMilestone ? task.time.scheduleStart : momentOfSharedDate(span.endExclusive);
    task.time.scheduleFinish = task.time.earlyFinish = task.time.lateFinish = moment;
  }
  task.manuallyScheduled = true;
  return true;
}

const finiteOrAbsent = (value: number | undefined) => value === undefined || Number.isFinite(value);

export const DOUBLE_REPRESENTATIONS: readonly DoubleRepresentation[] = [
  {
    id: 'taakvenster',
    shared: ['openaec::planning::activity.start', 'openaec::planning::activity.endExclusive'],
    precise: ['openaec::ops::task.time'],
    conversion: 'start en endExclusive zijn de projectie van de getoonde start en het getoonde einde (taskWindow).',
    precedence: 'De gedeelde datum gaat voor en de taak telt mee in ifcxSharedDatesApplied. Een werkelijke start en het einde van een voltooide taak zijn een feit: spreekt de gedeelde datum dat tegen, dan is het bestand invalid.',
    resolve: ({ tasks }) => {
      let applied = 0;
      for (const target of tasks) {
        const problem = windowProblem(target);
        if (problem) return problem;
        if (applyWindow(target)) applied++;
      }
      return applied;
    },
  },
  {
    id: 'taakkalender',
    shared: ['openaec::planning::activity.calendar'],
    precise: ['openaec::ops::task.calendarId'],
    conversion: 'Het pad wijst de kalender aan; calendarId is het id van een kalender die niet als pad te schrijven is.',
    precedence: 'Ze sluiten elkaar uit: staan ze er allebei, dan is het bestand invalid.',
    resolve: ({ tasks, calendarIdAt }) => {
      for (const target of tasks) {
        if (target.calendarPath === undefined) continue;
        if (target.task.calendarId !== undefined) {
          return { path: target.path, attribute: ATTRIBUTE.opsTask, field: 'calendarId', detail: 'calendarId staat er naast een kalenderpad' };
        }
        target.task.calendarId = calendarIdAt.get(target.calendarPath)!;
      }
      return 0;
    },
  },
  {
    id: 'lag',
    shared: ['openaec::planning::sequence.timeLag', 'openaec::planning::sequence.timeLagRatio'],
    precise: ['openaec::ops::sequence.lagDays', 'openaec::ops::sequence.lagMinutes', 'openaec::ops::sequence.lagPercent'],
    conversion: 'lagFromShared en sharedLagOf: P<n>D in dagen, PT<n>M in minuten, timeLagRatio × 100 in procenten.',
    precedence: 'Eén gedeelde vorm; ze moet ook omgerekend eindig zijn. De precieze waarde gaat voor.',
    resolve: ({ sequences }) => {
      for (const target of sequences) {
        const { shared, precise, sequence } = target;
        const at = (field: string, detail: string) => ({ path: target.path, attribute: ATTRIBUTE.sequence, field, detail });
        if (shared.timeLag !== undefined && shared.timeLagRatio !== undefined) return at('timeLagRatio', 'timeLag en timeLagRatio staan er allebei');
        const derived = lagFromShared(shared);
        if (!Number.isFinite(derived.lagDays) || !finiteOrAbsent(derived.lagMinutes) || !finiteOrAbsent(derived.lagPercent)) {
          return at(shared.timeLagRatio !== undefined ? 'timeLagRatio' : 'timeLag', 'De gedeelde lag is omgerekend geen eindig getal');
        }
        sequence.lagDays = precise.lagDays ?? derived.lagDays;
        const lagMinutes = precise.lagMinutes ?? derived.lagMinutes;
        if (lagMinutes !== undefined) sequence.lagMinutes = lagMinutes;
        const lagPercent = precise.lagPercent ?? derived.lagPercent;
        if (lagPercent !== undefined) sequence.lagPercent = lagPercent;
      }
      return 0;
    },
  },
  {
    id: 'projectdatums',
    shared: ['openaec::planning::workplan.start', 'openaec::planning::workplan.finish'],
    precise: ['openaec::ops::document.startDate', 'openaec::ops::document.endDate'],
    conversion: 'start en finish zijn de datum van startDate en endDate (existingDatePart).',
    precedence: 'De gedeelde datum gaat voor als de datum van de precieze waarde afwijkt; het project telt dan mee in ifcxSharedDatesApplied.',
    resolve: ({ document }) => {
      let applied = 0;
      const pairs: [keyof Pick<Project, 'startDate' | 'endDate'>, string | undefined, string | undefined][] = [
        ['startDate', document.sharedStart, document.preciseStart],
        ['endDate', document.sharedFinish, document.preciseFinish],
      ];
      for (const [key, shared, precise] of pairs) {
        const differs = precise !== undefined && shared !== undefined && existingDatePart(precise) !== shared;
        if (differs) applied++;
        document.project[key] = differs ? shared : precise ?? shared ?? '';
      }
      return applied > 0 ? 1 : 0;
    },
  },
  {
    id: 'auteur',
    shared: ['header.author'],
    precise: ['openaec::ops::document.author'],
    conversion: 'De kop draagt de auteur van het project, of Open Planner Studio als die leeg is.',
    precedence: 'De precieze waarde gaat voor; de writer schrijft haar alleen als ze afwijkt van de kop.',
    resolve: ({ document }) => {
      document.project.author = document.preciseAuthor ?? document.headerAuthor;
      return 0;
    },
  },
];

export function resolveDoubleRepresentations(read: ReadTargets): RepresentationProblem | number {
  let applied = 0;
  for (const row of DOUBLE_REPRESENTATIONS) {
    const outcome = row.resolve(read);
    if (typeof outcome !== 'number') return outcome;
    applied += outcome;
  }
  return applied;
}
