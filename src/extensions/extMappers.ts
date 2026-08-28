/**
 * Grensvertaling tussen het interne domeinmodel (`src/types/`) en het publieke extensie-contract
 * (`extTypes.ts`). ALLE conversie tussen die twee werelden loopt hierdoorheen — nergens anders in de
 * extensie-laag mag een interne `Task`/`Project`/… rechtstreeks naar buiten of naar binnen.
 *
 * Twee richtingen:
 *   • `toExt*`   — interne (Immer-BEVROREN) store-objecten → VERSE, MUTEERBARE `Ext*`-kopieën.
 *                  Diep gekopieerd, zodat een extensie z'n kopie mag muteren zónder de store te raken.
 *   • `fromExt*` — `Ext*`-invoer van een extensie → interne vorm voor de store-acties / `loadState`.
 *
 * Elke mapper bouwt zijn resultaat VELD-VOOR-VELD met een expliciet return-type. Zo geldt:
 *   (a) voeg je een VERPLICHT `Ext*`-veld toe zonder het hier te mappen → compileerfout; voor
 *       OPTIONELE velden vangt de compiler dat niet (weglaten uit een object-literal is legaal) —
 *       die moet je bij een DTO-uitbreiding zelf in álle betrokken mappers nalopen (incl. de
 *       `fromExt*Input`/`fromExt*Updates`-paden, die per veld `if (x !== undefined)` doorgeven);
 *   (b) hernoem je een INTERN veld → dat duikt alléén hier op, nooit in extensie-code.
 */
import { formatDate } from '@/utils/dateUtils';
import type { Project } from '@/types/project';
import type { WorkCalendar, Holiday, WorkTimeBands, WorkingException } from '@/types/calendar';
import type { Task, TaskTime, TaskConstraint, ExternalLink } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment, AvailabilityStep } from '@/types/resource';
import type { ImportResult } from '@/services/importTypes';
import type { RibbonTab } from '@/state/slices/types';
import type { CjkFontProvider } from '@/services/pdf/fontRegistry';
import type {
  ExtProject,
  ExtSchedulingOptions,
  ExtCalendar,
  ExtHoliday,
  ExtWorkingException,
  ExtWorkTimeBands,
  ExtTask,
  ExtTaskTime,
  ExtTaskConstraint,
  ExtExternalLink,
  ExtTaskNote,
  ExtSequence,
  ExtResource,
  ExtAvailabilityStep,
  ExtAssignment,
  ExtImportResult,
  ExtRibbonTab,
  ExtFontProvider,
} from './extTypes';

// ── Kleine helpers (diepe kopie van geneste, mogelijk bevroren, waarden) ──

/** `SchedulingOptions`/`ExtSchedulingOptions` zijn structureel gelijk; één helper dekt beide
 *  richtingen. De geneste `criticalDefinition`/`floatPaths` MOETEN mee-gekopieerd worden —
 *  een kale spread zou daar bevroren store-referenties doorgeven (reviewbevinding pakket N). */
function copySchedulingOptions<T extends ExtSchedulingOptions>(o: T): T {
  const copy = { ...o };
  if (copy.criticalDefinition) copy.criticalDefinition = { ...copy.criticalDefinition };
  if (copy.floatPaths) copy.floatPaths = { ...copy.floatPaths };
  return copy;
}

function copyConstraint(c: TaskConstraint): ExtTaskConstraint {
  return { type: c.type, date: c.date, hard: c.hard };
}
function toIntConstraint(c: ExtTaskConstraint): TaskConstraint {
  return { type: c.type, date: c.date, hard: c.hard };
}

function copyExternalLink(l: ExternalLink): ExtExternalLink {
  return {
    id: l.id,
    direction: l.direction,
    relType: l.relType,
    lagDays: l.lagDays,
    lagMinutes: l.lagMinutes,
    anchorDate: l.anchorDate,
    sourceRef: { ...l.sourceRef },
    sourceMissing: l.sourceMissing,
  };
}
function toIntExternalLink(l: ExtExternalLink): ExternalLink {
  return {
    id: l.id,
    direction: l.direction,
    relType: l.relType,
    lagDays: l.lagDays,
    lagMinutes: l.lagMinutes,
    anchorDate: l.anchorDate,
    sourceRef: { ...l.sourceRef },
    sourceMissing: l.sourceMissing,
  };
}

function copyNote(n: { id: string; text: string; done: boolean }): ExtTaskNote {
  return { id: n.id, text: n.text, done: n.done };
}

function copyWorkTime(w: WorkTimeBands): ExtWorkTimeBands {
  const src = w.byWeekday;
  return {
    byWeekday: {
      1: src[1].map((b) => ({ start: b.start, end: b.end })),
      2: src[2].map((b) => ({ start: b.start, end: b.end })),
      3: src[3].map((b) => ({ start: b.start, end: b.end })),
      4: src[4].map((b) => ({ start: b.start, end: b.end })),
      5: src[5].map((b) => ({ start: b.start, end: b.end })),
      6: src[6].map((b) => ({ start: b.start, end: b.end })),
      7: src[7].map((b) => ({ start: b.start, end: b.end })),
    },
  };
}
function toIntWorkTime(w: ExtWorkTimeBands): WorkTimeBands {
  const src = w.byWeekday;
  return {
    byWeekday: {
      1: src[1].map((b) => ({ start: b.start, end: b.end })),
      2: src[2].map((b) => ({ start: b.start, end: b.end })),
      3: src[3].map((b) => ({ start: b.start, end: b.end })),
      4: src[4].map((b) => ({ start: b.start, end: b.end })),
      5: src[5].map((b) => ({ start: b.start, end: b.end })),
      6: src[6].map((b) => ({ start: b.start, end: b.end })),
      7: src[7].map((b) => ({ start: b.start, end: b.end })),
    },
  };
}

function copyHoliday(h: Holiday): ExtHoliday {
  return { name: h.name, startDate: h.startDate, endDate: h.endDate };
}
function toIntHoliday(h: ExtHoliday): Holiday {
  return { name: h.name, startDate: h.startDate, endDate: h.endDate };
}

/** T13 (§T2-afwijking): `bands` mee-kopiëren (niet spreaden) — een kale spread zou anders het
 *  bevroren store-array-object doorgeven (zelfde reviewbevinding als `copySchedulingOptions`). */
function copyWorkingException(w: WorkingException): ExtWorkingException {
  return { name: w.name, startDate: w.startDate, endDate: w.endDate, ...(w.bands ? { bands: w.bands.map((b) => ({ start: b.start, end: b.end })) } : {}) };
}
function toIntWorkingException(w: ExtWorkingException): WorkingException {
  return { name: w.name, startDate: w.startDate, endDate: w.endDate, ...(w.bands ? { bands: w.bands.map((b) => ({ start: b.start, end: b.end })) } : {}) };
}

function copyAvailStep(s: AvailabilityStep): ExtAvailabilityStep {
  return { from: s.from, maxUnits: s.maxUnits };
}
function toIntAvailStep(s: ExtAvailabilityStep): AvailabilityStep {
  return { from: s.from, maxUnits: s.maxUnits };
}

// ── Project ──

export function toExtProject(p: Project): ExtProject {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    endDate: p.endDate,
    calendarId: p.calendarId,
    createdAt: p.createdAt,
    modifiedAt: p.modifiedAt,
    author: p.author,
    company: p.company,
    wbsAutoNumber: p.wbsAutoNumber,
    statusDate: p.statusDate,
    progressMode: p.progressMode,
    defaultTaskDurationUnit: p.defaultTaskDurationUnit,
    schedulingOptions: p.schedulingOptions ? copySchedulingOptions(p.schedulingOptions) : undefined,
  };
}

export function fromExtProject(p: ExtProject): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    endDate: p.endDate,
    calendarId: p.calendarId,
    createdAt: p.createdAt,
    modifiedAt: p.modifiedAt,
    author: p.author,
    company: p.company,
    wbsAutoNumber: p.wbsAutoNumber,
    statusDate: p.statusDate,
    progressMode: p.progressMode,
    defaultTaskDurationUnit: p.defaultTaskDurationUnit,
    schedulingOptions: p.schedulingOptions ? copySchedulingOptions(p.schedulingOptions) : undefined,
  };
}

// ── Kalender ──

export function toExtCalendar(c: WorkCalendar): ExtCalendar {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    workDays: [...c.workDays],
    workStartHour: c.workStartHour,
    workEndHour: c.workEndHour,
    hoursPerDay: c.hoursPerDay,
    simpleBreakStartMinute: c.simpleBreakStartMinute,
    simpleBreakDurationMinutes: c.simpleBreakDurationMinutes,
    holidays: c.holidays.map(copyHoliday),
    workTime: c.workTime ? copyWorkTime(c.workTime) : undefined,
    shift: c.shift,
    workingExceptions: c.workingExceptions ? c.workingExceptions.map(copyWorkingException) : undefined,
  };
}

export function fromExtCalendar(c: ExtCalendar): WorkCalendar {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    workDays: [...c.workDays],
    workStartHour: c.workStartHour,
    workEndHour: c.workEndHour,
    hoursPerDay: c.hoursPerDay,
    simpleBreakStartMinute: c.simpleBreakStartMinute,
    simpleBreakDurationMinutes: c.simpleBreakDurationMinutes,
    holidays: c.holidays.map(toIntHoliday),
    workTime: c.workTime ? toIntWorkTime(c.workTime) : undefined,
    shift: c.shift,
    workingExceptions: c.workingExceptions ? c.workingExceptions.map(toIntWorkingException) : undefined,
  };
}

// ── Taaktijd ──

export function toExtTaskTime(tt: TaskTime): ExtTaskTime {
  return {
    durationType: tt.durationType,
    durationUnit: tt.durationUnit,
    scheduleDuration: tt.scheduleDuration,
    durationMinutes: tt.durationMinutes,
    scheduleStart: tt.scheduleStart,
    scheduleFinish: tt.scheduleFinish,
    earlyStart: tt.earlyStart,
    earlyFinish: tt.earlyFinish,
    lateStart: tt.lateStart,
    lateFinish: tt.lateFinish,
    freeFloat: tt.freeFloat,
    totalFloat: tt.totalFloat,
    isCritical: tt.isCritical,
    interferingFloat: tt.interferingFloat,
    isNearCritical: tt.isNearCritical,
    floatPath: tt.floatPath,
    actualStart: tt.actualStart,
    actualFinish: tt.actualFinish,
    actualDuration: tt.actualDuration,
    remainingTime: tt.remainingTime,
    remainingMinutes: tt.remainingMinutes,
    completion: tt.completion,
    // Z14 (Z12-herwerk): resume/stop, zelfde onvoorwaardelijke doorgifte als de andere optionele
    // tracking-velden hierboven (`undefined` blijft `undefined`).
    resume: tt.resume,
    stop: tt.stop,
  };
}

/**
 * T14b (gebruikstestbevinding, ernst hoog — dataverlies): `ExtTaskTime` declareert `durationType`/
 * `scheduleDuration`/`scheduleStart`/`scheduleFinish`/`earlyStart`/`earlyFinish`/`lateStart`/
 * `lateFinish`/`freeFloat`/`totalFloat`/`isCritical`/`completion` als VERPLICHT — maar dat is alleen
 * een TS-compileertijd-garantie. Een extensie draait ONGETYPEERD (`new Function`-sandbox, CommonJS);
 * niets valideert op runtime dat een binnenkomend object die velden ook echt draagt. Vóór deze fix
 * gaf een ontbrekend `completion` hier `undefined` door tot in `Task.time`, en de eerstvolgende
 * `writeIFC` crashte op `time.completion.toFixed(1)` (`ifcTaskSlots.ts`) — bereikbaar via de publieke,
 * gedocumenteerde `api.data.addTask`. Elk verplicht veld krijgt daarom een expliciete, niet-crashende
 * terugval (`??`, dus `false`/`0` blijven staan): datumvelden vallen terug op `scheduleStart`/
 * `-Finish` (zelf terugvallend op vandaag), getallen op 0, `isCritical` op `false`, `completion` op 0
 * — dezelfde geest als `createDefaultTaskTime`. De bron-laag (`taskSlice`/`mcpTransaction`, zie hun
 * `mergeTaskTime`) herstelt daarna evt. datum-samenhang tegen het echte projectanker; dit is de
 * grensverdediging die voorkomt dat een onvolledig extensie-object hier al een writer-crash veroorzaakt.
 */
export function fromExtTaskTime(tt: ExtTaskTime): TaskTime {
  const start = tt.scheduleStart ?? formatDate(new Date());
  const finish = tt.scheduleFinish ?? start;
  return {
    durationType: tt.durationType ?? 'WORKTIME',
    durationUnit: tt.durationUnit ?? (tt.durationMinutes != null ? 'hours' : 'days'),
    scheduleDuration: tt.scheduleDuration ?? 0,
    durationMinutes: tt.durationMinutes,
    scheduleStart: start,
    scheduleFinish: finish,
    earlyStart: tt.earlyStart ?? start,
    earlyFinish: tt.earlyFinish ?? finish,
    lateStart: tt.lateStart ?? start,
    lateFinish: tt.lateFinish ?? finish,
    freeFloat: tt.freeFloat ?? 0,
    totalFloat: tt.totalFloat ?? 0,
    isCritical: tt.isCritical ?? false,
    interferingFloat: tt.interferingFloat,
    isNearCritical: tt.isNearCritical,
    floatPath: tt.floatPath,
    actualStart: tt.actualStart,
    actualFinish: tt.actualFinish,
    actualDuration: tt.actualDuration,
    remainingTime: tt.remainingTime,
    remainingMinutes: tt.remainingMinutes,
    completion: tt.completion ?? 0,
    // Z14 (Z12-herwerk): resume/stop hebben geen zinvolle generieke fallback (net als
    // actualStart/actualFinish hierboven) — afwezig blijft afwezig.
    resume: tt.resume,
    stop: tt.stop,
  };
}

// ── Taak ──

export function toExtTask(t: Task): ExtTask {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    wbsCode: t.wbsCode,
    taskType: t.taskType,
    status: t.status,
    isMilestone: t.isMilestone,
    milestoneKind: t.milestoneKind,
    mandatory: t.mandatory,
    priority: t.priority,
    levelingDelay: t.levelingDelay,
    // Z14: vier Z0-typecontractvelden — zelfde onvoorwaardelijke doorgifte als levelingDelay hierboven.
    levelingDelayMinutes: t.levelingDelayMinutes,
    levelingDelayElapsed: t.levelingDelayElapsed,
    splitGaps: t.splitGaps ? t.splitGaps.map(g => ({ ...g })) : undefined,
    manuallyScheduled: t.manuallyScheduled,
    // Z14b (F5) + main-merge vóór v2026.8.1 (herzien): deze .mpp-importvelden reizen WEL mee door
    // de VOLLEDIGE vertaling (`fromExtTask` — het invoerpad van een extensie-importer mag geen
    // velden laten vallen, contract-poort `check-ext-contract.ts`), maar blijven buiten de
    // create-/update-paden (`fromExtTaskInput`) en de MCP-zetbaarheid (`taskFields.ts` REJECT_HINTS).
    mspTaskType: t.mspTaskType,
    effortDriven: t.effortDriven,
    timephasedContours: t.timephasedContours ? t.timephasedContours.map(c => ({ resourceUid: c.resourceUid, periods: c.periods.map(p => ({ ...p })) })) : undefined,
    timephasedFinishFloor: t.timephasedFinishFloor,
    timephasedStartAnchor: t.timephasedStartAnchor,
    timephasedDurationWalks: t.timephasedDurationWalks ? t.timephasedDurationWalks.map(w => ({ ...w })) : undefined,
    parentId: t.parentId,
    childIds: [...t.childIds],
    time: toExtTaskTime(t.time),
    resourceIds: [...t.resourceIds],
    color: t.color,
    activityCodes: t.activityCodes ? { ...t.activityCodes } : undefined,
    customFields: t.customFields ? { ...t.customFields } : undefined,
    constraint: t.constraint ? copyConstraint(t.constraint) : undefined,
    constraint2: t.constraint2 ? copyConstraint(t.constraint2) : undefined,
    isHammock: t.isHammock,
    externalLinks: t.externalLinks ? t.externalLinks.map(copyExternalLink) : undefined,
    deadline: t.deadline,
    calendarId: t.calendarId,
    notes: t.notes ? t.notes.map(copyNote) : undefined,
  };
}

/** Volledige Ext→intern taakvertaling (bv. binnen een geladen project). */
export function fromExtTask(t: ExtTask): Task {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    wbsCode: t.wbsCode,
    taskType: t.taskType,
    status: t.status,
    isMilestone: t.isMilestone,
    milestoneKind: t.milestoneKind,
    mandatory: t.mandatory,
    priority: t.priority,
    levelingDelay: t.levelingDelay,
    // Z14: vier Z0-typecontractvelden — zelfde onvoorwaardelijke doorgifte als levelingDelay hierboven.
    levelingDelayMinutes: t.levelingDelayMinutes,
    levelingDelayElapsed: t.levelingDelayElapsed,
    splitGaps: t.splitGaps ? t.splitGaps.map(g => ({ ...g })) : undefined,
    manuallyScheduled: t.manuallyScheduled,
    // Main-merge vóór v2026.8.1 (contract-poort `check-ext-contract.ts`): de VOLLEDIGE vertaling
    // vernietigt geen data — ook de .mpp-leeskant-velden reizen mee terug. De create-/update-paden
    // (`fromExtTaskInput`, extensie-API) blijven hier bewust buiten (leeskant-alleen-besluit F5).
    mspTaskType: t.mspTaskType,
    effortDriven: t.effortDriven,
    timephasedContours: t.timephasedContours ? t.timephasedContours.map(c => ({ resourceUid: c.resourceUid, periods: c.periods.map(p => ({ ...p })) })) : undefined,
    timephasedFinishFloor: t.timephasedFinishFloor,
    timephasedStartAnchor: t.timephasedStartAnchor,
    timephasedDurationWalks: t.timephasedDurationWalks ? t.timephasedDurationWalks.map(w => ({ ...w })) : undefined,
    parentId: t.parentId,
    childIds: [...t.childIds],
    time: fromExtTaskTime(t.time),
    resourceIds: [...t.resourceIds],
    color: t.color,
    activityCodes: t.activityCodes ? { ...t.activityCodes } : undefined,
    customFields: t.customFields ? { ...t.customFields } : undefined,
    constraint: t.constraint ? toIntConstraint(t.constraint) : undefined,
    constraint2: t.constraint2 ? toIntConstraint(t.constraint2) : undefined,
    isHammock: t.isHammock,
    externalLinks: t.externalLinks ? t.externalLinks.map(toIntExternalLink) : undefined,
    deadline: t.deadline,
    calendarId: t.calendarId,
    notes: t.notes ? t.notes.map(copyNote) : undefined,
  };
}

/**
 * Ext-taakINVOER voor `api.data.addTask` → interne invoer voor de store-actie. Alleen de door de
 * extensie gezette velden worden doorgegeven; de store-actie vult zelf de defaults aan. `name` is
 * verplicht (zoals de store-actie eist); `time` wordt naar interne vorm gemapt indien meegegeven.
 */
export function fromExtTaskInput(
  input: Partial<ExtTask> & { name: string },
): Partial<Task> & { name: string } {
  const out: Partial<Task> & { name: string } = { name: input.name };
  if (input.id !== undefined) out.id = input.id;
  if (input.description !== undefined) out.description = input.description;
  if (input.wbsCode !== undefined) out.wbsCode = input.wbsCode;
  if (input.taskType !== undefined) out.taskType = input.taskType;
  if (input.status !== undefined) out.status = input.status;
  if (input.isMilestone !== undefined) out.isMilestone = input.isMilestone;
  if (input.milestoneKind !== undefined) out.milestoneKind = input.milestoneKind;
  if (input.mandatory !== undefined) out.mandatory = input.mandatory;
  if (input.priority !== undefined) out.priority = input.priority;
  if (input.levelingDelay !== undefined) out.levelingDelay = input.levelingDelay;
  // Z14: vier Z0-typecontractvelden — zelfde "alleen-als-gezet"-vorm als levelingDelay hierboven.
  if (input.levelingDelayMinutes !== undefined) out.levelingDelayMinutes = input.levelingDelayMinutes;
  if (input.levelingDelayElapsed !== undefined) out.levelingDelayElapsed = input.levelingDelayElapsed;
  if (input.splitGaps !== undefined) out.splitGaps = input.splitGaps.map(g => ({ ...g }));
  if (input.manuallyScheduled !== undefined) out.manuallyScheduled = input.manuallyScheduled;
  if (input.parentId !== undefined) out.parentId = input.parentId;
  if (input.childIds !== undefined) out.childIds = [...input.childIds];
  if (input.time !== undefined) out.time = fromExtTaskTime(input.time);
  if (input.resourceIds !== undefined) out.resourceIds = [...input.resourceIds];
  if (input.color !== undefined) out.color = input.color;
  if (input.activityCodes !== undefined) out.activityCodes = { ...input.activityCodes };
  if (input.customFields !== undefined) out.customFields = { ...input.customFields };
  if (input.constraint !== undefined) out.constraint = toIntConstraint(input.constraint);
  if (input.constraint2 !== undefined) out.constraint2 = toIntConstraint(input.constraint2);
  if (input.isHammock !== undefined) out.isHammock = input.isHammock;
  if (input.externalLinks !== undefined) out.externalLinks = input.externalLinks.map(toIntExternalLink);
  if (input.deadline !== undefined) out.deadline = input.deadline;
  if (input.calendarId !== undefined) out.calendarId = input.calendarId;
  if (input.notes !== undefined) out.notes = input.notes.map(copyNote);
  return out;
}

/**
 * T14b-vervolg (extensie-rand, UPDATE-pad): `fromExtTaskTime` (hierboven) is bedoeld voor `addTask` —
 * een ontbrekend verplicht veld krijgt daar een GENERIEKE default (vandaag/0/false), want er is nog
 * geen bestaande taak om uit te putten. Voor `api.data.updateTask` is dat verkeerd: zou
 * `fromExtTaskUpdates` hier ook `fromExtTaskTime` gebruiken, dan fabriceert die al een VOLLEDIG
 * `TaskTime`-object mét generieke defaults vóórdat `taskSlice.updateTask`'s `mergeTaskTime` er ooit
 * aan te pas komt — de merge ziet dan een reeds-compleet object en kan de ECHTE bestaande
 * completion/floats/etc. niet meer terugvinden. Deze functie kopieert daarom VELD-VOOR-VELD zonder
 * enige fallback-fabricage (ontbrekend blijft ontbrekend); `taskSlice.updateTask`'s `mergeTaskTime`
 * (basis = de bestaande taaktijd) vult het ontbrekende aan tegen de ECHTE waarden.
 *
 * SPEC-REVIEW-FIXRONDE (2026-08-17): een object-LITERAL met elke sleutel expliciet genoemd
 * (`{ durationMinutes: tt.durationMinutes, ... }`) zet die sleutel ALTIJD als eigen property, ook al
 * is `tt.durationMinutes` `undefined` omdat de sleutel op `tt` zelf gewoon nooit voorkwam. Dat verslikt
 * zich in `mergeTaskTime`'s sleutel-aanwezigheid-conventie: élk optioneel veld leek dan "expliciet
 * gewist", ook velden die de aanroeper nooit noemde — een partiële `api.data.updateTask({time:
 * {scheduleStart:...}})` wiste zo alsnog `durationMinutes`/`actualStart`/`actualFinish`/
 * `remainingTime`/`remainingMinutes` (bewezen in blok (10b) van check-ifc-roundtrip.ts, pad 3). Elk
 * optioneel veld wordt daarom pas op `out` gezet als de sleutel ook ECHT op `tt` aanwezig is
 * (`'veld' in tt`, NIET `tt.veld !== undefined` — dat laatste zou een BEWUSTE clear via een
 * expliciete `undefined`-waarde weer verkeerd als "niet genoemd" lezen, het spiegelbeeld-gat).
 *
 * T16-VEEGLIJST (theoretische fractionele-remaining-kier, becommentarieerd — bewust niet dichtgetimmerd):
 * `remainingTime`/`remainingMinutes` gaan hier ONGEVALIDEERD door naar `TaskTime`, ZONDER de
 * consistentiecheck tegen `completion` die T9 voor de MPP-lezer bouwde (die leest een bestandseigen,
 * al-MSP-getrouw-afgeronde `RemainingDuration` i.p.v. hem uit `completion` af te leiden — precies om
 * de "klokstanden die MSP nooit toont"-fout te voorkomen). De MCP-tools (`planner_*`) SLUITEN dit gat
 * al af: `taskFields.ts`'s `PROGRESS_REJECT_HINTS` weigert `remaining`/`remainingTime` expliciet bij
 * naam ("de resterende duur wordt afgeleid uit `completion`"). Extensies hebben dat hek niet — een
 * extensie die `completion` en een daarmee INCONSISTENTE `remainingTime` in dezelfde
 * `api.data.updateTask`-aanroep zet, kan dus in principe dezelfde niet-ronde klokstand produceren die
 * T9 voor MPP-import wegnam. Bewust ongefixt: dit vergt een schrijvende, kwaadwillige of onzorgvuldige
 * extensie (geen bereikbaar pad via import/UI/MCP), en directe veldtoegang is precies het contract dat
 * de extensie-API voor `TaskTime` biedt — een consistentiecheck hier zou legitiem gebruik (een
 * extensie die zelf een precieze restduur bijhoudt) net zo goed blokkeren als het misbruikgeval.
 */
function fromExtTaskTimePatch(tt: Partial<ExtTaskTime>): Partial<TaskTime> {
  const out: Partial<TaskTime> = {};
  if ('durationType' in tt) out.durationType = tt.durationType;
  if ('scheduleDuration' in tt) out.scheduleDuration = tt.scheduleDuration;
  if ('durationMinutes' in tt) out.durationMinutes = tt.durationMinutes;
  if ('scheduleStart' in tt) out.scheduleStart = tt.scheduleStart;
  if ('scheduleFinish' in tt) out.scheduleFinish = tt.scheduleFinish;
  if ('earlyStart' in tt) out.earlyStart = tt.earlyStart;
  if ('earlyFinish' in tt) out.earlyFinish = tt.earlyFinish;
  if ('lateStart' in tt) out.lateStart = tt.lateStart;
  if ('lateFinish' in tt) out.lateFinish = tt.lateFinish;
  if ('freeFloat' in tt) out.freeFloat = tt.freeFloat;
  if ('totalFloat' in tt) out.totalFloat = tt.totalFloat;
  if ('isCritical' in tt) out.isCritical = tt.isCritical;
  if ('interferingFloat' in tt) out.interferingFloat = tt.interferingFloat;
  if ('isNearCritical' in tt) out.isNearCritical = tt.isNearCritical;
  if ('floatPath' in tt) out.floatPath = tt.floatPath;
  if ('actualStart' in tt) out.actualStart = tt.actualStart;
  if ('actualFinish' in tt) out.actualFinish = tt.actualFinish;
  if ('actualDuration' in tt) out.actualDuration = tt.actualDuration;
  if ('remainingTime' in tt) out.remainingTime = tt.remainingTime;
  if ('remainingMinutes' in tt) out.remainingMinutes = tt.remainingMinutes;
  if ('completion' in tt) out.completion = tt.completion;
  // Z14 (Z12-herwerk): resume/stop volgen dezelfde sleutel-aanwezigheid-conventie als de andere
  // optionele velden hierboven — cruciaal voor dezelfde reden (zie de docstring boven deze functie):
  // `mergeTaskTime` (taskDefaults.ts) onderscheidt "niet genoemd" van "bewust gewist" via `in`.
  if ('resume' in tt) out.resume = tt.resume;
  if ('stop' in tt) out.stop = tt.stop;
  return out;
}

/** Ext-taakWIJZIGINGEN voor `api.data.updateTask` → interne `Partial<Task>`. */
export function fromExtTaskUpdates(updates: Partial<ExtTask>): Partial<Task> {
  const out: Partial<Task> = {};
  if (updates.name !== undefined) out.name = updates.name;
  if (updates.description !== undefined) out.description = updates.description;
  if (updates.wbsCode !== undefined) out.wbsCode = updates.wbsCode;
  if (updates.taskType !== undefined) out.taskType = updates.taskType;
  if (updates.status !== undefined) out.status = updates.status;
  if (updates.isMilestone !== undefined) out.isMilestone = updates.isMilestone;
  if (updates.milestoneKind !== undefined) out.milestoneKind = updates.milestoneKind;
  if (updates.mandatory !== undefined) out.mandatory = updates.mandatory;
  if (updates.priority !== undefined) out.priority = updates.priority;
  if (updates.levelingDelay !== undefined) out.levelingDelay = updates.levelingDelay;
  // Z14: vier Z0-typecontractvelden — zelfde "alleen-als-gezet"-vorm als levelingDelay hierboven.
  if (updates.levelingDelayMinutes !== undefined) out.levelingDelayMinutes = updates.levelingDelayMinutes;
  if (updates.levelingDelayElapsed !== undefined) out.levelingDelayElapsed = updates.levelingDelayElapsed;
  if (updates.splitGaps !== undefined) out.splitGaps = updates.splitGaps.map(g => ({ ...g }));
  if (updates.manuallyScheduled !== undefined) out.manuallyScheduled = updates.manuallyScheduled;
  if (updates.parentId !== undefined) out.parentId = updates.parentId;
  if (updates.childIds !== undefined) out.childIds = [...updates.childIds];
  // T14b-vervolg: `fromExtTaskTimePatch`, NIET `fromExtTaskTime` — zie de docstring daarboven. `out.time`
  // is hier op TS-niveau een volledige `TaskTime`, maar dat is dezelfde bewuste afwijking als
  // `addTask`'s `partial.time`: de echte volledigheid wordt pas door `taskSlice.updateTask`'s
  // `mergeTaskTime` (tegen de bestaande taaktijd) gegarandeerd, niet hier.
  if (updates.time !== undefined) out.time = fromExtTaskTimePatch(updates.time) as TaskTime;
  if (updates.resourceIds !== undefined) out.resourceIds = [...updates.resourceIds];
  if (updates.color !== undefined) out.color = updates.color;
  if (updates.activityCodes !== undefined) out.activityCodes = { ...updates.activityCodes };
  if (updates.customFields !== undefined) out.customFields = { ...updates.customFields };
  if (updates.constraint !== undefined) out.constraint = toIntConstraint(updates.constraint);
  if (updates.constraint2 !== undefined) out.constraint2 = toIntConstraint(updates.constraint2);
  if (updates.isHammock !== undefined) out.isHammock = updates.isHammock;
  if (updates.externalLinks !== undefined) out.externalLinks = updates.externalLinks.map(toIntExternalLink);
  if (updates.deadline !== undefined) out.deadline = updates.deadline;
  if (updates.calendarId !== undefined) out.calendarId = updates.calendarId;
  if (updates.notes !== undefined) out.notes = updates.notes.map(copyNote);
  return out;
}

// ── Relatie ──

export function toExtSequence(s: Sequence): ExtSequence {
  return {
    id: s.id,
    predecessorId: s.predecessorId,
    successorId: s.successorId,
    type: s.type,
    lagDays: s.lagDays,
    lagMinutes: s.lagMinutes,
    lagUnit: s.lagUnit,
    lagPercent: s.lagPercent,
  };
}

export function fromExtSequence(s: ExtSequence): Sequence {
  return {
    id: s.id,
    predecessorId: s.predecessorId,
    successorId: s.successorId,
    type: s.type,
    lagDays: s.lagDays,
    lagMinutes: s.lagMinutes,
    lagUnit: s.lagUnit,
    lagPercent: s.lagPercent,
  };
}

/** Ext-relatieINVOER voor `api.data.addSequence` (zonder id) → interne invoer. */
export function fromExtSequenceInput(seq: Omit<ExtSequence, 'id'>): Omit<Sequence, 'id'> {
  return {
    predecessorId: seq.predecessorId,
    successorId: seq.successorId,
    type: seq.type,
    lagDays: seq.lagDays,
    lagMinutes: seq.lagMinutes,
    lagUnit: seq.lagUnit,
    lagPercent: seq.lagPercent,
  };
}

// ── Resource + toewijzing ──

export function toExtResource(r: Resource): ExtResource {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    color: r.color,
    costPerHour: r.costPerHour,
    maxUnits: r.maxUnits,
    calendarId: r.calendarId,
    availabilitySteps: r.availabilitySteps ? r.availabilitySteps.map(copyAvailStep) : undefined,
    unitOfMeasure: r.unitOfMeasure,
    parentId: r.parentId,
  };
}

export function fromExtResource(r: ExtResource): Resource {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    color: r.color,
    costPerHour: r.costPerHour,
    maxUnits: r.maxUnits,
    calendarId: r.calendarId,
    availabilitySteps: r.availabilitySteps ? r.availabilitySteps.map(toIntAvailStep) : undefined,
    unitOfMeasure: r.unitOfMeasure,
    parentId: r.parentId,
  };
}

export function toExtAssignment(a: ResourceAssignment): ExtAssignment {
  return {
    id: a.id,
    taskId: a.taskId,
    resourceId: a.resourceId,
    unitsPerDay: a.unitsPerDay,
    curve: a.curve,
    workWindowStart: a.workWindowStart,
    workWindowFinish: a.workWindowFinish,
  };
}

export function fromExtAssignment(a: ExtAssignment): ResourceAssignment {
  return {
    id: a.id,
    taskId: a.taskId,
    resourceId: a.resourceId,
    unitsPerDay: a.unitsPerDay,
    curve: a.curve,
    workWindowStart: a.workWindowStart,
    workWindowFinish: a.workWindowFinish,
  };
}

// ── Importresultaat ──

/**
 * Ext-importresultaat → interne `ImportResult` (de vorm die `loadState`/de open-paden verwachten).
 * De rijkere optionele velden (resourceCalendars, activityCodeTypes, …) zet een extensie niet; die
 * blijven `undefined` en de store valt terug op zijn defaults.
 */
export function fromExtImportResult(r: ExtImportResult): ImportResult {
  return {
    project: fromExtProject(r.project),
    calendar: fromExtCalendar(r.calendar),
    tasks: r.tasks.map(fromExtTask),
    sequences: r.sequences.map(fromExtSequence),
    resources: r.resources.map(fromExtResource),
    assignments: r.assignments.map(fromExtAssignment),
  };
}

// ── UI-grens: ribbontabblad ──

/**
 * Ext-facing tabblad-id → intern tabblad-id.
 *
 * Vandaag is dat één-op-één, en de TABEL is het punt — niet de conversie. Zonder tabel zou een
 * interne hernoeming (`'beeld'` → `'view'`) stil doorlekken naar elk geïnstalleerd manifest; nu
 * breekt hij hier op de compiler en verhuist de vertaling naar deze ene regel. De `Record` over de
 * volledige `ExtRibbonTab`-unie dwingt bovendien af dat een NIEUW ext-tabblad ook echt ergens op
 * uitkomt: een gat geeft een compileerfout in plaats van `undefined` in de store.
 */
const RIBBON_TAB_MAP: Record<ExtRibbonTab, RibbonTab> = {
  file: 'file',
  start: 'start',
  planning: 'planning',
  resources: 'resources',
  relations: 'relations',
  beeld: 'beeld',
  instellingen: 'instellingen',
  table: 'table',
  ifc: 'ifc',
  report: 'report',
  ai: 'ai',
};

export function fromExtRibbonTab(tab: ExtRibbonTab): RibbonTab {
  return RIBBON_TAB_MAP[tab];
}

// ── PDF-fontprovider ──

/**
 * Ext-facing font-provider → interne `CjkFontProvider`.
 *
 * Bewust een NIEUW object en geen doorgeef-referentie: de registry bewaart wat hij krijgt, en een
 * extensie die z'n eigen provider-object naderhand muteert (of er velden aan toevoegt die de
 * pagineerder ooit gaat lezen) zou anders rechtstreeks in de host-registry zitten. De methodes
 * worden gebonden aan het originele object, zodat een provider met interne state (bv. een
 * bytes-cache) gewoon blijft werken.
 *
 * `getBoldBytes` wordt alleen doorgegeven als hij er is — een sleutel met `undefined` erin zou de
 * `getBoldBytes?` -check in de pagineerder laten slagen op een niet-functie.
 */
export function fromExtFontProvider(p: ExtFontProvider): CjkFontProvider {
  const out: CjkFontProvider = {
    id: p.id,
    covers: (codepoint: number) => p.covers(codepoint),
    getRegularBytes: () => p.getRegularBytes(),
  };
  if (p.getBoldBytes) {
    const bold = p.getBoldBytes.bind(p);
    out.getBoldBytes = () => bold();
  }
  return out;
}
