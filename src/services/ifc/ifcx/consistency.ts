import type { WriteIFCInput } from '../ifcWriter';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { finishInstant, finishIsActual, shownFinish, shownStart, startIsActual } from '@/utils/taskDates';
import { parseInstant } from '@/utils/dateUtils';
import { writeFields } from './fieldTable';
import { CALENDAR_AREA } from './fieldGroups';
import { placesNeededForOrder, taskInParentCycle } from './childOrder';
import { momentOfSharedDate, nextCalendarDate, taskWindow, type SharedSpan } from './dateProjection';
import { identityProblems, intendedGlobalIds, type PlanningModel } from './identity';
import { ifcObjectSeed } from '../ifcWriter';
import { ATTRIBUTE, type IfcxAttributeName } from './profile';

export interface Inconsistency {
  readonly field: string;
  readonly detail: string;
}

export interface RuleSubject {
  readonly model: PlanningModel;
  readonly windowOf: (task: Task) => SharedSpan;
}

export interface ConsistencyRule {
  readonly id: string;
  readonly reason: string;
  readonly onPlanning?: (subject: RuleSubject) => Inconsistency[];
  readonly onAttribute?: {
    readonly name: IfcxAttributeName;
    readonly problem: (value: Readonly<Record<string, unknown>>) => Inconsistency | undefined;
  };
}

function writtenCalendar(calendar: WorkCalendar): string {
  const source = { calendar, isProjectCalendar: true, identity: { path: '' } };
  return JSON.stringify([writeFields(CALENDAR_AREA.planning, source), writeFields(CALENDAR_AREA.ops, source)]);
}

const finiteOrAbsent = (value: number | undefined) => value === undefined || Number.isFinite(value);

function effectiveWindow(task: Task, window: SharedSpan): { start: number; end: number } | undefined {
  if (window.start === undefined || window.endExclusive === undefined) return undefined;
  const start = startIsActual(task) ? parseInstant(shownStart(task)) : parseInstant(momentOfSharedDate(window.start));
  const end = finishIsActual(task) ? finishInstant(shownFinish(task)) : parseInstant(momentOfSharedDate(window.endExclusive));
  return { start: start.getTime(), end: end.getTime() };
}

export const CONSISTENCY_RULES: readonly ConsistencyRule[] = [
  {
    id: 'identiteit',
    reason: 'Elk id is uniek binnen zijn soort, elke GlobalId is uniek over alle objecten (project, werkplan en werkschema inbegrepen), en elke verwijzing heeft een doel.',
    onPlanning: ({ model }) => {
      const intended = intendedGlobalIds(model);
      return identityProblems(model, (kind, id) => intended.get(ifcObjectSeed(kind, id))!);
    },
  },
  {
    id: 'boom', reason: 'De kinderen van een taak zijn precies de taken die haar als ouder noemen, en geen taak is haar eigen voorouder.',
    onPlanning: ({ model }) => {
      const found: Inconsistency[] = [];
      const ids = new Set(model.tasks.map(task => task.id));
      const children = new Map<string, string[]>();
      for (const task of model.tasks) {
        if (task.parentId === null || task.parentId === undefined || !ids.has(task.parentId)) continue;
        const list = children.get(task.parentId);
        if (list) list.push(task.id); else children.set(task.parentId, [task.id]);
      }
      const wrong = model.tasks.find(task => placesNeededForOrder(children.get(task.id) ?? [], task.childIds ?? []) === undefined);
      if (wrong) found.push({ field: 'task.childIds', detail: `De kinderen van taak ${wrong.id} kloppen niet met de taken die haar als ouder noemen` });
      const cycle = taskInParentCycle(model.tasks);
      if (cycle !== undefined) found.push({ field: 'task.parentId', detail: `Taak ${cycle} is haar eigen voorouder` });
      return found;
    },
  },
  {
    id: 'venster',
    reason: 'Het venster dat telt (een werkelijke start of een voltooid einde gaat voor het gedeelde venster) eindigt niet vóór zijn start.',
    onPlanning: ({ model, windowOf }) => {
      for (const task of model.tasks) {
        const window = effectiveWindow(task, windowOf(task));
        if (window && window.end < window.start) {
          return [{ field: 'task.time', detail: `Taak ${task.id} eindigt vóór haar start` }];
        }
      }
      return [];
    },
  },
  {
    id: 'lag-eindig', reason: 'Een lag in dagen, minuten of procenten is een eindig getal; een oneindige lag kan de rekenmotor niet gebruiken.',
    onPlanning: ({ model }) => {
      const wrong = model.sequences.find(sequence => !Number.isFinite(sequence.lagDays)
        || !finiteOrAbsent(sequence.lagMinutes) || !finiteOrAbsent(sequence.lagPercent));
      return wrong ? [{ field: 'sequence.lag', detail: `Relatie ${wrong.id} heeft een lag die geen eindig getal is` }] : [];
    },
  },
  {
    id: 'projectkalender-in-bibliotheek',
    reason: 'De bibliotheekentry van de projectkalender is dezelfde kalender als de projectkalender; IFCX schrijft haar één keer.',
    onPlanning: ({ model }) => {
      const library = model.resourceCalendars ?? [];
      const entries = library.filter(calendar => calendar.id === model.calendar.id);
      const differs = entries.length > 1 || entries.some(entry => entry !== model.calendar && writtenCalendar(entry) !== writtenCalendar(model.calendar));
      const elsewhere = model.project.calendarId !== model.calendar.id && library.some(calendar => calendar.id === model.project.calendarId);
      return differs || elsewhere
        ? [{ field: 'resourceCalendars', detail: `De bibliotheek heeft een andere kalender ${differs ? model.calendar.id : model.project.calendarId} dan de projectkalender` }]
        : [];
    },
  },
  {
    id: 'een-lagvorm',
    reason: 'Een relatie heeft één gedeelde lag: een duur of een verhouding, niet allebei.',
    onAttribute: {
      name: ATTRIBUTE.sequence,
      problem: value => (value.timeLag !== undefined && value.timeLagRatio !== undefined
        ? { field: 'timeLagRatio', detail: 'timeLag en timeLagRatio staan er allebei' } : undefined),
    },
  },
  {
    id: 'gedeeld-venster',
    reason: 'start en endExclusive staan er samen of geen van beide, het einde ligt na de start, en een mijlpaal heeft een venster van één dag.',
    onAttribute: {
      name: ATTRIBUTE.activity,
      problem: value => {
        const start = value.start as string | undefined, endExclusive = value.endExclusive as string | undefined;
        if ((start === undefined) !== (endExclusive === undefined)) {
          return { field: start === undefined ? 'start' : 'endExclusive', detail: 'start en endExclusive staan er samen of geen van beide' };
        }
        if (start === undefined || endExclusive === undefined) return undefined;
        if (endExclusive <= start) return { field: 'endExclusive', detail: 'endExclusive ligt niet na start' };
        if (value.isMilestone === true && endExclusive !== nextCalendarDate(start)) {
          return { field: 'endExclusive', detail: 'Een mijlpaal heeft een venster van precies één dag' };
        }
        return undefined;
      },
    },
  },
];

export function planningRuleProblems(subject: RuleSubject): Inconsistency[] {
  return CONSISTENCY_RULES.flatMap(rule => rule.onPlanning?.(subject) ?? []);
}

export function attributeRuleProblem(name: string, value: Readonly<Record<string, unknown>>): Inconsistency | undefined {
  for (const rule of CONSISTENCY_RULES) {
    const problem = rule.onAttribute?.name === name ? rule.onAttribute.problem(value) : undefined;
    if (problem) return problem;
  }
  return undefined;
}

export function inconsistentContent(input: WriteIFCInput): Inconsistency[] {
  return planningRuleProblems({ model: input, windowOf: taskWindow });
}
