import type { DocumentPayload } from '@/state/documentContract';
import type { WorkCalendar } from '@/types/calendar';
import type { MilestoneKind, Task, TaskTime } from '@/types/task';
import type { Baseline, BaselineTask } from '@/types/baseline';
import { isElapsedTask, isPinnedComplete, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { settleFixedWorkMeasure, type WorkRuleDeps } from '@/engine/work/workRuleApply';
import { scalarBreakIssue } from '@/utils/effectiveWorkTime';
import {
  blocksClock, dayEndInstant, dayStartInstant, ELAPSED_CLOCK, isDateOnly, isInstant,
  type DayClock, type InstantSide,
} from '@/engine/calendar/workdayRules';

/**
 * De migratie naar het minutenmodel (spec `docs/superpowers/specs/2026-10-20-alleen-uren-design.md`, §5.2):
 * één zuivere functie op de laadgrens. Ze heeft twee delen.
 *
 *  1. **Normalisatie** (altijd, technische keuze T17): elke datum zonder tijd in een startachtig of
 *     eindachtig taakveld wordt een moment, met de regels D1–D7 (§4.2). Een moment blijft een moment.
 *  2. **Schemamigratie** (alleen een oud bestand, zonder `TimeModel = 'MINUTES-1'`): kalenderherstel T1
 *     (§3.1) en de vlag "omzetting open" voor de B5-overgang (in het rapport; F2 zet hem in
 *     `DOCUMENT_FIELDS`). De profielregel T12 hoort bij de conventie dagenmaat en komt in F3.
 *
 * Projectdatums (`project.startDate`, `statusDate`, `endDate`) blijven zoals ingevoerd (§3.6); de motor
 * leest ze vanaf F2 met D1, D5 en D2. De vastlegging van "datums zoals opgeslagen" zit niet in de payload;
 * F2 normaliseert die bij `captureAllowed` met {@link normalizeTaskDate}.
 *
 * F0 leverde deze zuivere bouwsteen. Sinds F2 roept `payloadFromImport` hem vóór elke laadberekening
 * aan; de invoerroutes delen {@link normalizeTaskDates}.
 */

/** De markering `OPS_Project.TimeModel` van een bestand dat met het minutenmodel berekend is. */
export const MINUTE_MODEL_TIME_MODEL = 'MINUTES-1';

/** Een startachtig of eindachtig datumveld van een taak (§4.2), met de varianten die een eigen regel
 *  hebben: de kant van een beperking of extern anker, en het baseline-einde naar de voortgang. */
export type TaskDateField =
  | 'scheduleStart' | 'earlyStart' | 'lateStart' | 'actualStart' | 'resume'
  | 'scheduleFinish' | 'earlyFinish' | 'lateFinish' | 'actualFinish' | 'stop'
  | 'deadline' | 'constraintStart' | 'constraintFinish'
  | 'externalAnchorStart' | 'externalAnchorFinish'
  | 'baselineStart'
  /** Baseline-einde van een taak die bij het openen niet voltooid is (of niet meer bestaat). */
  | 'baselineFinish'
  /** Baseline-einde van een taak die bij het openen voltooid is (`isPinnedComplete`). */
  | 'baselineFinishCompleted';

interface FieldRule {
  side: InstantSide;
  /** D3: het einde van een kalendertijd-taak in dit veld. `exclusive` = 00:00 van de datum (de motor
   *  schreef start + n kalenderdagen); `inclusive` = 24:00 (de planner of de motor bedoelde de hele dag). */
  elapsedEnd?: 'exclusive' | 'inclusive';
  /** D7: een eigen start- of eindveld van de mijlpaal (niet een beperking, deadline of anker). */
  milestoneOwn: boolean;
}

const FIELD_RULES: Record<TaskDateField, FieldRule> = {
  scheduleStart: { side: 'start', milestoneOwn: true },
  earlyStart: { side: 'start', milestoneOwn: true },
  lateStart: { side: 'start', milestoneOwn: true },
  actualStart: { side: 'start', milestoneOwn: true },
  resume: { side: 'start', milestoneOwn: false },
  scheduleFinish: { side: 'end', elapsedEnd: 'exclusive', milestoneOwn: true },
  earlyFinish: { side: 'end', elapsedEnd: 'exclusive', milestoneOwn: true },
  lateFinish: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: true },
  actualFinish: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: true },
  stop: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: false },
  deadline: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: false },
  constraintStart: { side: 'start', milestoneOwn: false },
  constraintFinish: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: false },
  externalAnchorStart: { side: 'start', milestoneOwn: false },
  externalAnchorFinish: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: false },
  baselineStart: { side: 'start', milestoneOwn: true },
  baselineFinish: { side: 'end', elapsedEnd: 'exclusive', milestoneOwn: true },
  baselineFinishCompleted: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: true },
};

/** Startkant of eindkant van een veld, voor de werkdag van een moment. */
export function taskDateFieldSide(field: TaskDateField): InstantSide {
  return FIELD_RULES[field].side;
}

/** Hoe een datum van één taak wordt omgezet: haar klok en, bij een nulduur-mijlpaal, haar soort (D7). */
export interface TaskDateContext {
  /** Kalendertijd voor een kalendertijd-taak (D3), anders de werkblokken van de taakkalender. */
  clock: DayClock;
  /** Alleen bij een nulduur-mijlpaal: de soort die D7 gebruikt (zonder soort en zonder hint: START). */
  milestoneKind: MilestoneKind | null;
}

/** Zoekt per kalender één klok, zodat een document niet per taak een engine bouwt. */
export class DayClockCache {
  private readonly byCalendar = new Map<WorkCalendar, DayClock>();

  constructor(
    readonly projectCalendar: WorkCalendar,
    readonly calendars: readonly WorkCalendar[],
  ) {}

  /** Werkblokkenklok van de effectieve kalender van een taak (eigen `calendarId`, anders het project). */
  calendarClock(calendarId: string | undefined): DayClock {
    const cal = resolveCalendar(calendarId, this.calendars as WorkCalendar[], this.projectCalendar);
    let clock = this.byCalendar.get(cal);
    if (!clock) {
      clock = blocksClock(cal);
      this.byCalendar.set(cal, clock);
    }
    return clock;
  }
}

/**
 * De context voor de datums van één taak. `milestonesAtDayEnd`: de taken waarvoor het bestand de hint
 * `AtDayEnd` in `OPS_Milestone` draagt (D7, vanaf F2 door de IFC-lezer gevuld).
 */
export function taskDateContext(
  task: Task,
  clocks: DayClockCache,
  milestonesAtDayEnd?: ReadonlySet<string>,
): TaskDateContext {
  const clock = isElapsedTask(task) ? ELAPSED_CLOCK : clocks.calendarClock(task.calendarId);
  const milestoneKind = isZeroDurationMilestone(task)
    ? (task.milestoneKind ?? (milestonesAtDayEnd?.has(task.id) ? 'FINISH' : 'START'))
    : null;
  return { clock, milestoneKind };
}

/**
 * Zet één datum van een taak om naar een moment, met de regel van het veld (§4.2):
 *  - D7: een eigen start- of eindveld van een nulduur-mijlpaal krijgt één moment: D2 bij FINISH, D1 bij
 *    START;
 *  - D3: op kalendertijd wordt een startachtige datum 00:00, en een eindachtige 00:00 (exclusief veld) of
 *    24:00 (inclusief veld);
 *  - anders D1 voor een startachtig en D2 voor een eindachtig veld, met D4 voor een datum zonder werkblok.
 *
 * Een moment, een lege waarde en elke andere tekst komen ongewijzigd terug. `null`: een datum zonder tijd
 * waarvoor de kalender geen moment geeft (geen werkblokken en geen geldige begin- of eindtijd).
 */
export function normalizeTaskDate(value: string, field: TaskDateField, ctx: TaskDateContext): string | null {
  if (!isDateOnly(value)) return value;
  const rule = FIELD_RULES[field];
  if (rule.milestoneOwn && ctx.milestoneKind !== null) {
    return ctx.milestoneKind === 'FINISH' ? dayEndInstant(ctx.clock, value) : dayStartInstant(ctx.clock, value);
  }
  if (rule.side === 'start') return dayStartInstant(ctx.clock, value);
  if (ctx.clock.kind === 'elapsed' && rule.elapsedEnd === 'exclusive') return dayStartInstant(ctx.clock, value);
  return dayEndInstant(ctx.clock, value);
}

/**
 * De regel voor een datum zonder tijd die een planner in de tabel typt of plakt. Hij leest de datum zoals
 * de tabel haar toont (B4): een eindachtig veld is het einde van die dag, ook bij een kalendertijd-taak.
 * Daar is dat 24:00, dus 00:00 van de dag erna. Een kalendertijd-taak van 1 d vanaf ma 00:00 toont
 * "einde ma 1 jun"; wie "ma 1 jun" typt, krijgt dus weer di 00:00 en niet ma 00:00.
 *
 * De exclusieve lezing van D3 ({@link normalizeTaskDate}: `scheduleFinish` en `earlyFinish` op 00:00 van
 * de datum) blijft de regel voor de laadgrens. Die past bij een oud bestand, waar de motor start + n
 * kalenderdagen schreef; een getypte datum komt van het scherm (aanval a08 na #600). Startachtige velden
 * en de eigen velden van een mijlpaal (D7) volgen hier dezelfde regel als bij het laden.
 */
export function normalizeTaskDateInput(value: string, field: TaskDateField, ctx: TaskDateContext): string | null {
  if (!isDateOnly(value)) return value;
  const rule = FIELD_RULES[field];
  const milestone = rule.milestoneOwn && ctx.milestoneKind !== null;
  if (!milestone && rule.side === 'end' && ctx.clock.kind === 'elapsed') return dayEndInstant(ctx.clock, value);
  return normalizeTaskDate(value, field, ctx);
}

/** De kant van een beperkingsdatum: SNET/SNLT/MSO startachtig, FNET/FNLT/MFO eindachtig. */
export function constraintDateField(type: string): TaskDateField | null {
  if (type === 'SNET' || type === 'SNLT' || type === 'MSO') return 'constraintStart';
  if (type === 'FNET' || type === 'FNLT' || type === 'MFO') return 'constraintFinish';
  return null;
}

/** De kant van het anker van een externe link (§4.2): bij een externe voorganger de eerste letter van
 *  het relatietype, bij een externe opvolger de tweede; F ⇒ eindachtig. */
export function externalAnchorField(direction: 'predecessor' | 'successor', relType: string): TaskDateField {
  const letter = direction === 'predecessor' ? relType.charAt(0) : relType.charAt(1);
  return letter === 'F' ? 'externalAnchorFinish' : 'externalAnchorStart';
}

// ── Rapport ──────────────────────────────────────────────────────────────────────────────────

/** Kalenderherstel T1 (§3.1), alleen bij een oud bestand. */
export interface CalendarRepair {
  calendarId: string;
  calendarName: string;
  /** `dropBreak`: een ongeldige pauze vervalt. `extendEnd`: uren per dag groter dan de spanne; het einde
   *  wordt begin + uren per dag. */
  kind: 'dropBreak' | 'extendEnd';
  before: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;
  after: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;
}

/** Een waarde die de normalisatie niet kon omzetten; ze blijft ongewijzigd staan. */
export interface UnresolvedDate {
  where: 'task' | 'baseline' | 'calendar';
  /** Taak-id, baseline-id of kalender-id. */
  id: string;
  field: TaskDateField | 'projectEnd' | 'workEndHour';
  value: string;
  reason: 'notADate' | 'noWorkTime' | 'endPastMidnight';
}

export interface MinuteModelReport {
  /** Geen `TimeModel = 'MINUTES-1'`: de schemamigratie liep. */
  legacyFile: boolean;
  /** De beginwaarde van de documentvlag "omzetting open" (B5, §5.2). F2 zet hem in `DOCUMENT_FIELDS`. */
  conversionPending: boolean;
  /** Aantal waarden dat van datum zonder tijd een moment werd. */
  normalizedCount: number;
  normalizedByField: Partial<Record<TaskDateField | 'projectEnd', number>>;
  calendarRepairs: CalendarRepair[];
  unresolved: UnresolvedDate[];
  /** B1a (§3.2): taken onder vast werk (eigen of geërfde regel) die van de dagenmaat naar de urenmaat
   *  gingen. Niet leeg ⇒ ook de vlag "omzetting open", zodat een verschuiving via B5 loopt. */
  fixedWorkToHours: string[];
}

export interface MinuteModelOptions {
  /** De waarde van `OPS_Project.TimeModel` uit het bestand; ontbreekt hij, dan is het een oud bestand. */
  timeModel?: string | null;
  /** Taken met de hint `AtDayEnd` in `OPS_Milestone` (D7). */
  milestonesAtDayEnd?: ReadonlySet<string>;
}

export interface MinuteModelMigration {
  payload: DocumentPayload;
  report: MinuteModelReport;
}

// ── Kalenderherstel T1 ───────────────────────────────────────────────────────────────────────

type ScalarFields = CalendarRepair['before'];

function scalarFields(cal: WorkCalendar): ScalarFields {
  return {
    workStartHour: cal.workStartHour,
    workEndHour: cal.workEndHour,
    hoursPerDay: cal.hoursPerDay,
    simpleBreakStartMinute: cal.simpleBreakStartMinute,
    simpleBreakDurationMinutes: cal.simpleBreakDurationMinutes,
  };
}

/** T1 op één scalaire kalender: een ongeldige pauze vervalt; uren per dag groter dan de spanne verlengt
 *  het einde tot begin + uren per dag. Een kalender met eigen werkblokken blijft zoals hij is. */
function repairCalendar(cal: WorkCalendar, repairs: CalendarRepair[], unresolved: UnresolvedDate[]): WorkCalendar {
  if (cal.workTime) return cal;
  let next = cal;
  const startMin = cal.workStartHour * 60;
  const endMin = cal.workEndHour * 60;
  const hasBreak = cal.simpleBreakStartMinute !== undefined || cal.simpleBreakDurationMinutes !== undefined;
  if (hasBreak && scalarBreakIssue(startMin, endMin, cal.simpleBreakStartMinute, cal.simpleBreakDurationMinutes)) {
    const { simpleBreakStartMinute: _s, simpleBreakDurationMinutes: _d, ...rest } = next;
    void _s; void _d;
    const dropped: WorkCalendar = rest;
    repairs.push({ calendarId: cal.id, calendarName: cal.name, kind: 'dropBreak', before: scalarFields(next), after: scalarFields(dropped) });
    next = dropped;
  }
  const noBreak = next.simpleBreakStartMinute === undefined && next.simpleBreakDurationMinutes === undefined;
  const target = Math.round(next.hoursPerDay * 60);
  if (noBreak && Number.isFinite(target) && endMin > startMin && target > endMin - startMin) {
    const newEnd = startMin + target;
    if (newEnd <= 1440) {
      const extended: WorkCalendar = { ...next, workEndHour: newEnd / 60 };
      repairs.push({ calendarId: cal.id, calendarName: cal.name, kind: 'extendEnd', before: scalarFields(next), after: scalarFields(extended) });
      next = extended;
    } else {
      unresolved.push({ where: 'calendar', id: cal.id, field: 'workEndHour', value: String(newEnd / 60), reason: 'endPastMidnight' });
    }
  }
  return next;
}

// ── De migratie ──────────────────────────────────────────────────────────────────────────────

export const TIME_FIELDS = [
  'scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish',
  'actualStart', 'actualFinish', 'resume', 'stop',
] as const satisfies readonly (keyof TaskTime & TaskDateField)[];

class Normalizer {
  readonly report: MinuteModelReport;

  constructor(report: MinuteModelReport) {
    this.report = report;
  }

  /** Zet één waarde om; telt en meldt. Geeft de nieuwe waarde (of de oude als er niets verandert). */
  value(value: string, field: TaskDateField, ctx: TaskDateContext, where: UnresolvedDate['where'], id: string): string {
    if (value === '' || isInstant(value)) return value;
    if (!isDateOnly(value)) {
      this.report.unresolved.push({ where, id, field, value, reason: 'notADate' });
      return value;
    }
    const out = normalizeTaskDate(value, field, ctx);
    if (out === null) {
      this.report.unresolved.push({ where, id, field, value, reason: 'noWorkTime' });
      return value;
    }
    this.report.normalizedCount++;
    this.report.normalizedByField[field] = (this.report.normalizedByField[field] ?? 0) + 1;
    return out;
  }
}

export function mapTaskDates(task: Task, valueOf: (value: string, field: TaskDateField) => string): Task {
  let time: TaskTime | null = null;
  for (const field of TIME_FIELDS) {
    const v = task.time[field];
    if (typeof v !== 'string') continue;
    const out = valueOf(v, field);
    if (out !== v) {
      time ??= { ...task.time };
      time[field] = out;
    }
  }
  let deadline = task.deadline;
  if (typeof deadline === 'string') deadline = valueOf(deadline, 'deadline');
  const constraintOf = (c: Task['constraint']) => {
    if (!c || typeof c.date !== 'string') return c;
    const field = constraintDateField(c.type);
    if (!field) return c;
    const date = valueOf(c.date, field);
    return date === c.date ? c : { ...c, date };
  };
  const constraint = constraintOf(task.constraint);
  const constraint2 = constraintOf(task.constraint2);
  let externalLinks = task.externalLinks;
  if (externalLinks) {
    const mapped = externalLinks.map((e) => {
      if (typeof e.anchorDate !== 'string') return e;
      const anchorDate = valueOf(e.anchorDate, externalAnchorField(e.direction, e.relType));
      return anchorDate === e.anchorDate ? e : { ...e, anchorDate };
    });
    if (mapped.some((e, i) => e !== externalLinks![i])) externalLinks = mapped;
  }
  if (!time && deadline === task.deadline && constraint === task.constraint && constraint2 === task.constraint2
    && externalLinks === task.externalLinks) {
    return task;
  }
  return {
    ...task,
    ...(time ? { time } : {}),
    ...(deadline !== task.deadline ? { deadline } : {}),
    ...(constraint !== task.constraint ? { constraint } : {}),
    ...(constraint2 !== task.constraint2 ? { constraint2 } : {}),
    ...(externalLinks !== task.externalLinks ? { externalLinks } : {}),
  };
}


function migrateTask(task: Task, ctx: TaskDateContext, n: Normalizer): Task {
  return mapTaskDates(task, (value, field) => n.value(value, field, ctx, 'task', task.id));
}

/** Dezelfde D1–D7 bij invoer, zonder schemamigratie of wijziging aan duur/werk. */
export function normalizeTaskDates(task: Task, calendars: Pick<DocumentPayload, 'calendar' | 'calendars'>): Task {
  let ctx: TaskDateContext | undefined;
  return mapTaskDates(task, (value, field) => {
    if (!isDateOnly(value)) return value;
    ctx ??= taskDateContext(task, new DayClockCache(calendars.calendar, calendars.calendars));
    return normalizeTaskDate(value, field, ctx) ?? value;
  });
}

/**
 * De patch van een invoerroute met de momenten uit `next`: de genormaliseerde taak die de patch
 * achterlaat (`normalizeTaskDates(merge(taak, patch))`). Zo gebruikt een route één genormaliseerde
 * wijziging voor de no-op-toets, voor de gevolgregels (`taskTriggerChanges`) en voor het schrijven.
 * Zonder deze stap zag de gevolgregel een opnieuw ingevoerde SNET "2026-06-01" als een andere waarde dan
 * het opgeslagen "2026-06-01T07:00", en wiste hij de nivelleerpauze (review ronde 1 van PR #559, deel B,
 * punt 1).
 *
 * Alleen waarden die de normalisatie veranderde, worden vervangen. Een top-level veld verandert alleen
 * van referentie als `mapTaskDates` het omzette (de merge deelt de referentie). Een `time`-sleutel alleen
 * als de patch er een tekst in had; een lege of `undefined`-waarde blijft precies zoals de aanroeper hem
 * meegaf, zodat `mergeTaskTime` hem op dezelfde manier leest.
 */
export function normalizeTaskPatch(updates: Partial<Task>, next: Task): Partial<Task> {
  let out: Partial<Task> | null = null;
  for (const key of Object.keys(updates) as (keyof Task)[]) {
    if (key === 'time' || next[key] === updates[key]) continue;
    out ??= { ...updates };
    (out as Record<string, unknown>)[key] = next[key];
  }
  const time = updates.time;
  if (time) {
    // Getypeerd als de patch zelf (`Partial<Task>['time']`); in de praktijk een deel van de tak.
    let normalizedTime: TaskTime | null = null;
    for (const field of TIME_FIELDS) {
      const raw = time[field];
      if (typeof raw !== 'string' || next.time[field] === raw) continue;
      normalizedTime ??= { ...time };
      (normalizedTime as unknown as Record<string, unknown>)[field] = next.time[field];
    }
    if (normalizedTime) (out ??= { ...updates }).time = normalizedTime;
  }
  return out ?? updates;
}

function migrateBaseline(
  baseline: Baseline,
  taskById: ReadonlyMap<string, Task>,
  clocks: DayClockCache,
  n: Normalizer,
  milestonesAtDayEnd: ReadonlySet<string> | undefined,
): Baseline {
  const projectClock = clocks.calendarClock(undefined);
  let changed = false;
  const tasks = baseline.tasks.map((bt): BaselineTask => {
    const task = taskById.get(bt.taskId);
    // De kalender van de taak; bestaat de taak niet meer, dan de projectkalender (§3.6).
    const clock = task ? taskDateContext(task, clocks, milestonesAtDayEnd).clock : projectClock;
    // D7 volgt de mijlpaal zoals de baseline hem vastlegde.
    const milestoneKind: MilestoneKind | null = bt.isMilestone && bt.duration === 0
      ? (bt.milestoneKind ?? (milestonesAtDayEnd?.has(bt.taskId) ? 'FINISH' : 'START'))
      : null;
    const ctx: TaskDateContext = { clock, milestoneKind };
    const finishField: TaskDateField = task && isPinnedComplete(task.time) ? 'baselineFinishCompleted' : 'baselineFinish';
    const start = n.value(bt.start, 'baselineStart', ctx, 'baseline', baseline.id);
    const finish = n.value(bt.finish, finishField, ctx, 'baseline', baseline.id);
    if (start === bt.start && finish === bt.finish) return bt;
    changed = true;
    return { ...bt, start, finish };
  });
  let projectEnd = baseline.projectEnd;
  if (typeof projectEnd === 'string' && isDateOnly(projectEnd)) {
    const out = dayEndInstant(projectClock, projectEnd);
    if (out === null) {
      n.report.unresolved.push({ where: 'baseline', id: baseline.id, field: 'projectEnd', value: projectEnd, reason: 'noWorkTime' });
    } else {
      n.report.normalizedCount++;
      n.report.normalizedByField.projectEnd = (n.report.normalizedByField.projectEnd ?? 0) + 1;
      projectEnd = out;
    }
  }
  if (!changed && projectEnd === baseline.projectEnd) return baseline;
  return { ...baseline, tasks, projectEnd };
}

/**
 * De migratie op de laadgrens (§5.2). Zuiver en deterministisch: de invoer verandert niet (ook een
 * bevroren payload mag), onveranderde taken en baselines houden hun identiteit, en twee keer draaien geeft
 * hetzelfde (een moment blijft een moment; een herstelde kalender heeft niets meer te herstellen).
 */
export function migrateToMinuteModel(payload: DocumentPayload, options: MinuteModelOptions = {}): MinuteModelMigration {
  const legacyFile = options.timeModel !== MINUTE_MODEL_TIME_MODEL;
  const report: MinuteModelReport = {
    legacyFile,
    conversionPending: legacyFile,
    normalizedCount: 0,
    normalizedByField: {},
    calendarRepairs: [],
    unresolved: [],
    fixedWorkToHours: [],
  };

  // 1. Schemamigratie (oud bestand): eerst de kalenders, want de normalisatie leest hun werkblokken.
  let calendar = payload.calendar;
  let calendars = payload.calendars;
  if (legacyFile) {
    const seen = new Set<string>();
    const repairOnce = (cal: WorkCalendar): WorkCalendar => {
      const repairs: CalendarRepair[] = [];
      const unresolved: UnresolvedDate[] = [];
      const out = repairCalendar(cal, repairs, unresolved);
      // De projectkalender staat twee keer in de payload (cache en bibliotheek-entry): één melding per id.
      if (!seen.has(cal.id)) {
        seen.add(cal.id);
        report.calendarRepairs.push(...repairs);
        report.unresolved.push(...unresolved);
      }
      return out;
    };
    calendar = repairOnce(calendar);
    const mapped = calendars.map(repairOnce);
    if (mapped.some((c, i) => c !== calendars[i])) calendars = mapped;
  }

  // 2. Normalisatie (altijd).
  const clocks = new DayClockCache(calendar, calendars);
  const n = new Normalizer(report);
  const normalized = payload.tasks.map((t) => migrateTask(t, taskDateContext(t, clocks, options.milestonesAtDayEnd), n));

  // 3. B1a (altijd): vast werk is urenmaat. Een bestand van vóór B1a kan een gewone taak onder vast werk
  //    (eigen regel of de projectstandaard) in de dagenmaat hebben. Die wordt hier urenmaat, met dezelfde
  //    omzetting als een typewissel; rest en verricht werk blijven. Een verschuiving van datums loopt
  //    via B5: de vlag "omzetting open" gaat aan, ook in een bestand mét `TimeModel`.
  const deps: WorkRuleDeps = { calendar, calendars, project: payload.project, resources: payload.resources };
  const tasks = normalized.map((t) => {
    // Een beschadigde hersteldsnapshot (geen kinderlijst) komt als gewone payload binnen en valt pas
    // bij het doorrekenen om (`check-recovery-integrity.ts` 8n): de laadgrens mag er niet op stuklopen.
    if (!Array.isArray(t.childIds)) return t;
    const copy: Task = { ...t, time: { ...t.time } };
    if (!settleFixedWorkMeasure(copy, deps)) return t;
    report.fixedWorkToHours.push(t.id);
    return copy;
  });
  if (report.fixedWorkToHours.length > 0) report.conversionPending = true;
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const baselines = payload.baselines.map((b) => migrateBaseline(b, taskById, clocks, n, options.milestonesAtDayEnd));

  const same = calendar === payload.calendar && calendars === payload.calendars
    && tasks.every((t, i) => t === payload.tasks[i]) && baselines.every((b, i) => b === payload.baselines[i]);
  return {
    payload: same ? payload : { ...payload, calendar, calendars, tasks, baselines },
    report,
  };
}

/** Ontwikkelcontrole op de laadinvariant; projectdatums vallen bewust buiten deze regel. */
export function assertMinuteModelTaskDates(tasks: readonly Task[]): void {
  for (const task of tasks) mapTaskDates(task, (value, field) => {
    if (isDateOnly(value)) throw new Error(`Taak ${task.id}: ${field} mist een tijd na normalisatie`);
    return value;
  });
}
