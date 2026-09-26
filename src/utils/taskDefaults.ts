import { parseDate, formatDate, addBusinessDays, parseInstant, formatInstant } from '@/utils/dateUtils';
import type { Task, TaskDurationUnit, TaskSplitGap, TaskTime } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { sameValue } from '@/utils/sameValue';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addElapsedMinutes, splitTotalSpanMinutes } from '@/engine/scheduler/duration';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { effHoursPerDay } from '@/utils/taskDuration';
import { clipUserGapsToWork, splitUnitMinutes } from '@/engine/scheduler/splitEdit';
import {
  rescaleContourForDuration, rescaleFactor, rescaleSplitGaps, taskWorkMinutes,
} from '@/engine/contour/contourEngine';
import { DEFAULT_WORK_RULE, type WorkRule } from '@/types/workRule';
import { ruleProtectsWork } from '@/engine/work/workTriangle';

// ── Bewerkregels die per-taak-herkomst lezen ─────────────────────────────────────────────────────
// Deze twee lezen `mspTaskType` — bewaarde bronherkomst van één taak — om te bepalen hoe een
// BEWERKING uitpakt (contour herschalen, effort-driven). Dat is geen solverinvoer en geen conventie:
// de motor (`src/engine/`) mag geen bronformaat lezen, dus ze wonen hier, naast
// `rescaleTaskContours`, dat de uitkomst van `contourKeepsWork` als `keepWork` krijgt.

/** Bewaard MSP-vinkje "effort-driven": alleen betekenisvol op een taak met MSP-herkomst
 *  (`mspTaskType`); daar is "afwezig" letterlijk "niet effort-driven". Zonder herkomst ⇒ zuiver P6.
 *  Formaatafhankelijke BEWERKREGEL (driehoek, paneel), niet iets wat de solver leest. */
export function effectiveEffortDriven(task: Pick<Task, 'mspTaskType' | 'effortDriven'>): boolean | undefined {
  return task.mspTaskType ? (task.effortDriven ?? false) : undefined;
}

/**
 * Herschaalt een contour met werkbehoud onder de werkbeschermende regels. Zonder eigen `workRule`
 * geldt de MSP-afleiding (`mspTaskType === 'FIXED_WORK'`) náást de projectstandaard, zodat een
 * MSP-import zonder werkregel blijft herschalen zoals zijn bron.
 */
export function contourKeepsWork(task: Pick<Task, 'workRule' | 'mspTaskType'>, defaultWorkRule?: WorkRule): boolean {
  if (task.workRule !== undefined) return ruleProtectsWork(task.workRule);
  return task.mspTaskType === 'FIXED_WORK' || ruleProtectsWork(defaultWorkRule ?? DEFAULT_WORK_RULE);
}

/**
 * Fabrieksfunctie voor een verse {@link TaskTime}. Leeft in de utils-laag (niet in `src/types/`)
 * omdat ze datum-helpers als WAARDE nodig heeft — `src/types/` blijft zo puur (alleen types).
 */
export function createDefaultTaskTime(
  start: string,
  durationDays: number,
  durationUnit: TaskDurationUnit = 'days',
  /** De effectieve taakkalender. Alleen gebruikt voor een urentaak: dan is het einde start + duur in
   *  WERKMINUTEN op deze kalender (met tijd), zie {@link hourTaskInputFinish}. Zonder kalender geldt
   *  het werkdagen-einde — alleen lezers laten hem weg, en die overschrijven het einde direct met de
   *  bronwaarde (xerReader). Elke app-ingang (nieuwe taak, MCP, wizard) geeft hem mee. */
  calendar?: WorkCalendar,
): TaskTime {
  // Een einde dat bij de duur past, zodat de Gantt-balk vóór de eerste CPM-run al klopt
  // (inclusief, weekenden overgeslagen, zoals CalendarEngine.addWorkDays); runCPM verfijnt het.
  // Bij een onparseerbare start (bv. corrupte import) NIET formatteren — formatDate
  // (toISOString) gooit dan. Val terug op `start`; de CPM-solver vangt de ongeldige
  // datum verderop af met een nette foutmelding i.p.v. een crash.
  //
  // UURTAAK: de solve schrijft `scheduleFinish` niet terug, dus dit einde BLIJFT staan als ingevoerd
  // einde ("Gepland einde", IfcTaskTime.ScheduleFinish). Het werkdagen-einde zou het tweede argument
  // (hier UREN) als werkdagen lezen: 5 u werd dan 5 werkdagen, zonder tijd.
  const startDate = parseDate(start);
  const hourFinish = durationUnit === 'hours' && calendar
    ? hourTaskInputFinish({ scheduleStart: start, durationMinutes: durationDays * 60, durationType: 'WORKTIME' }, calendar)
    : undefined;
  const finish = hourFinish
    ?? (durationDays > 0 && !isNaN(startDate.getTime())
      ? formatDate(addBusinessDays(startDate, durationDays))
      : start);
  return {
    durationType: 'WORKTIME',
    durationUnit,
    scheduleDuration: durationDays,
    ...(durationUnit === 'hours' ? { durationMinutes: durationDays * 60 } : {}),
    scheduleStart: start,
    scheduleFinish: finish,
    earlyStart: start,
    earlyFinish: finish,
    lateStart: start,
    lateFinish: finish,
    freeFloat: 0,
    totalFloat: 0,
    isCritical: false,
    completion: 0,
  };
}

// ── Ingevoerd einde van een urentaak ─────────────────────────────────────────────────────────────
//
// `scheduleFinish` is INVOER: de solve schrijft hem niet terug, want de P6-conventies lezen hem als
// het geplande bronvenster (`target_end_date`) — anders werd de uitvoer van de ene berekening invoer
// voor de volgende. Daarom houdt de INVOERKANT het einde coherent: bij aanmaken en bij elke duur-,
// start-, eenheids-, duurtype- of kalenderwijziging leidt de bewerking het einde af uit start + duur
// op de kalender van de taak zelf. Nooit vanuit de solve, en alleen voor een urentaak.
//
// Paden die het einde WEL herleiden: `taskSlice.updateTask`/`setTaskCalendar`, de MCP-tweelingen
// `updateTaskFields`/`patchTaskFields`, het taakraster (`taskEditPlan.ts`, ook de gesplitste
// kalenderroute in `gridTransaction.ts`), en elke duur die uit de WERKDRIEHOEK komt: inzet, werk of
// resource erbij/eraf onder Vast werk/Vaste inzet (`resourceSlice` `updateAssignment`/
// `setAssignmentWork`/`assignResource`/`unassignResource`/`moveAssignment`/`removeResource`, het
// assignment-set-pad van het raster, en de MCP-toewijzingen achter `planner_manage_assignments`/
// `planner_manage_resources`). Die komen allemaal samen in `workRuleApply.ts`'s
// `settleDurationAftermath`, die de basis van VÓÓR de bewerking als verplichte parameter krijgt en in
// dezelfde volgorde als `updateTask` eerst `clearLevelingGaps` en dan `reconcileHourInputFinish`
// draait. Laden (`applyOpenedImport`) loopt daar nooit doorheen.
//
// Wat NIET meebeweegt (zie `hourInputFinishFollowsEdits`): een gestarte of voltooide taak (het geplande
// einde is dan geschiedenis, zoals in P6), een taak met een expliciet P6-targetvenster uit de XER
// (`p6ExplicitTargetWindow`: dat venster mag planningsruimte bevatten en is bronwaarde), een handmatig
// geplande taak (daar IS `scheduleFinish` het einde), een hammock (afgeleide span) en een samenvattende
// taak. Een lezer loopt hier nooit doorheen: het einde uit het bestand blijft dus staan tot de gebruiker
// de taak bewerkt.
//
// Bewust NIET herleid (het einde volgt bij de volgende invoerbewerking van de taak): wijzigingen aan de
// project- of een gedeelde kalender of haar uitzonderingen (`setCalendar`, `updateCalendar`,
// `setProjectCalendar`), het verwijderen van een taakkalender (`resourceSlice.removeCalendar`: de taak
// valt terug op de projectkalender, haar einde blijft staan), splits zonder duurwijziging, de uitvoer
// van de nivelleerder, `moveProject`, en de resourcekalender van een `.mpp`-taak (de afleiding rekent
// op de taakkalender). Nieuwe taken: store-`addTask`, MCP-`draft.addTask` en de extensie-API
// `api.data.addTask` (via `fromExtTaskAddInput`) leiden het einde af met `seedNewHourTaskFinish`;
// `sdk.factory.createTask` is een DTO-bouwer zonder document of kalender en leidt niets af (een
// importresultaat is bronwaarde, zoals bij een lezer). De reconcile draait ná `clearLevelingGaps`,
// zodat nivelleergaten die dezelfde bewerking wist niet meetellen.

/** De invoervelden waaruit het einde van een urentaak volgt. */
type HourInputFinishTime = Pick<TaskTime, 'scheduleStart' | 'durationType'> & { durationMinutes?: number };

/**
 * Het ingevoerde einde van een urentaak: `scheduleStart` + `durationMinutes` op de (effectieve)
 * taakkalender, in de datetime-vorm (`YYYY-MM-DDTHH:MM`). WORKTIME wandelt werkminuten
 * (`CalendarEngine.addWorkMinutes`, dezelfde wandeling als de solver voor een taak zonder voorganger,
 * inclusief importsplits via `splitTotalSpanMinutes`); ELAPSEDTIME telt klokminuten. Duur 0 ⇒ de
 * start zelf. `undefined` bij een onleesbare start of een kalender zonder werkbare uurbanden — dan
 * raakt de aanroeper het einde niet aan.
 */
export function hourTaskInputFinish(
  time: HourInputFinishTime,
  calendar: WorkCalendar,
  splitGaps?: readonly TaskSplitGap[],
): string | undefined {
  const start = parseInstant(time.scheduleStart);
  if (Number.isNaN(start.getTime())) return undefined;
  const minutes = Math.max(0, time.durationMinutes ?? 0);
  if (time.durationType === 'ELAPSEDTIME') return formatInstant(addElapsedMinutes(start, minutes), 'hour');
  const engine = new CalendarEngine(calendarForEngine(calendar));
  if (!engine.isHourMode) return undefined;
  const total = splitTotalSpanMinutes(splitGaps, minutes);
  return formatInstant(total > 0 ? engine.addWorkMinutes(start, total) : start, 'hour');
}

/** `true` als het ingevoerde einde van deze taak met haar invoer mee hoort te bewegen — zie het
 *  sectieblok hierboven voor de uitzonderingen en waarom. */
export function hourInputFinishFollowsEdits(task: Task): boolean {
  const legacy = task.time as TaskTime & { durationUnit?: TaskDurationUnit };
  const unit = legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
  if (unit !== 'hours') return false;
  if (task.isSummary || task.childIds.length > 0 || task.isHammock) return false;
  if (task.manuallyScheduled || task.p6ExplicitTargetWindow === true) return false;
  if (task.status !== 'NOT_STARTED') return false;
  const time = task.time;
  return !time.actualStart && !time.actualFinish && !(time.completion > 0);
}

/** Momentopname van de invoer waar het einde van afhangt, vóór een bewerking vastgelegd. */
export interface HourInputFinishBasis {
  readonly key: string;
  readonly scheduleFinish: string;
}

export function hourInputFinishBasis(task: Task): HourInputFinishBasis {
  const t = task.time;
  return {
    key: JSON.stringify([
      t.scheduleStart, t.durationUnit, t.durationMinutes, t.scheduleDuration, t.durationType,
      task.calendarId, task.isMilestone,
    ]),
    scheduleFinish: t.scheduleFinish,
  };
}

/**
 * Houdt het ingevoerde einde van `task` na een invoerbewerking coherent (muteert in-place,
 * Immer-draft-stijl). Doet alleen iets als (a) de taak meebeweegt (`hourInputFinishFollowsEdits`),
 * (b) de bewerking de invoer echt veranderde (`before` ≠ nu), en (c) de bewerking het einde zelf NIET
 * wijzigde (detectie `!==` t.o.v. vóór; een einde dat gelijk aan het oude wordt meegegeven telt dus
 * niet als gezet) — een in dezelfde bewerking gewijzigd einde (grid-kolom "Gepland einde", uursleep, extensie) wint.
 * `calendar` is de kalender waar de taak NA de bewerking in rekent (projectkalender als `calendarId`
 * leeg is). Geeft `true` als het einde veranderde.
 */
export function reconcileHourInputFinish(task: Task, before: HourInputFinishBasis, calendar: WorkCalendar): boolean {
  if (task.time.scheduleFinish !== before.scheduleFinish) return false;
  if (hourInputFinishBasis(task).key === before.key) return false;
  if (!hourInputFinishFollowsEdits(task)) return false;
  const finish = hourTaskInputFinish(task.time, calendar, task.splitGaps);
  if (!finish || finish === task.time.scheduleFinish) return false;
  task.time.scheduleFinish = finish;
  return true;
}

/**
 * Nieuwe taak (store-`addTask` en MCP-`draft.addTask`): leid het einde van een urentaak af uit de
 * DEFINITIEVE invoer (na de merge met `partialTime`), tenzij de aanroeper zelf een `scheduleFinish`
 * meegaf. De vroege/late finish volgen mee zolang de aanroeper die niet noemde, zodat de balk vóór de
 * eerste berekening al klopt. Muteert `task` in-place.
 */
export function seedNewHourTaskFinish(task: Task, partialTime: Partial<TaskTime> | undefined, calendar: WorkCalendar): void {
  if (partialTime?.scheduleFinish !== undefined) return;
  if (!hourInputFinishFollowsEdits(task)) return;
  const finish = hourTaskInputFinish(task.time, calendar, task.splitGaps);
  if (!finish) return;
  task.time.scheduleFinish = finish;
  if (partialTime?.earlyFinish === undefined) task.time.earlyFinish = finish;
  if (partialTime?.lateFinish === undefined) task.time.lateFinish = finish;
}

/**
 * De nieuwe `Task` van een aanmaakactie — de ENE veld-voor-veld-afleiding achter `taskSlice.addTask`
 * én de MCP-`draft.addTask`, zodat die twee niet stil uit elkaar drijven. Wat per pad verschilt geeft
 * de aanroeper mee: het id, de (gevalideerde) ouder en de beginduur (`time`, al gemerged met
 * `partial.time` — een ongemerged `time` laat writeIFC crashen op een ontbrekend `completion`).
 * Plaatsing, WBS-code en undo/dirty blijven bij de aanroeper.
 *
 * Overerving: zonder eigen `taskType` neemt een taak met een ouder diens taskType (en bij USERDEFINED
 * diens eigen taaktype-id) over, vóór de default (bouwmodus: CONSTRUCTION, anders neutraal
 * USERDEFINED). Geldt alleen bij aanmaken; indenteren/verslepen laat taskType met rust. `priority` via
 * `??`: 0 is geldig (laagste, levelt als eerste weg). De optionele velden gaan ongewijzigd mee:
 * afwezig ⇒ undefined ⇒ geen extra velden in het document. `levelingDelay` zelf bewust NIET: dat zet
 * uitsluitend de nivelleerder.
 */
export function buildNewTask(
  partial: Partial<Task> & { name: string },
  opts: { id: string; parentId: string | null; parentTask: Task | undefined; constructionMode: boolean; time: TaskTime },
): Task {
  const { parentTask } = opts;
  const taskType = partial.taskType || parentTask?.taskType || (opts.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED');
  return {
    id: opts.id,
    name: partial.name,
    description: partial.description || '',
    wbsCode: partial.wbsCode || '',
    taskType,
    customTaskTypeId: taskType === 'USERDEFINED'
      ? (partial.customTaskTypeId ?? (partial.taskType === undefined ? parentTask?.customTaskTypeId : undefined))
      : undefined,
    status: partial.status || 'NOT_STARTED',
    isMilestone: partial.isMilestone || false,
    milestoneKind: partial.milestoneKind,
    mandatory: partial.mandatory,
    priority: partial.priority ?? 500,
    parentId: opts.parentId,
    childIds: [],
    isSummary: partial.isSummary,
    time: opts.time,
    resourceIds: partial.resourceIds || [],
    color: partial.color,
    constraint: partial.constraint,
    constraint2: partial.constraint2,
    isHammock: partial.isHammock,
    externalLinks: partial.externalLinks,
    deadline: partial.deadline,
    calendarId: partial.calendarId,
    notes: partial.notes,
    splitGaps: partial.splitGaps,
    manuallyScheduled: partial.manuallyScheduled,
    levelingDelayMinutes: partial.levelingDelayMinutes,
    levelingDelayElapsed: partial.levelingDelayElapsed,
    // De werkregel bij aanmaak (planner_add_tasks `workRule`); een nieuwe taak heeft nog geen
    // toewijzingen, dus dit is een kaal veld zonder driehoekstap.
    workRule: partial.workRule,
  };
}

/** Een urentaak draagt zijn duur in `durationMinutes`; leid `scheduleDuration` (werkdagen) daaruit af
 *  met de uren/dag van zijn kalender (0 bij een kalender zonder uren). No-op voor een dagentaak. */
export function deriveScheduleDurationFromMinutes(time: TaskTime, hoursPerDay: number): void {
  if (time.durationUnit !== 'hours') return;
  time.scheduleDuration = hoursPerDay > 0 ? (time.durationMinutes ?? 0) / (hoursPerDay * 60) : 0;
}

/**
 * Voegt een partiële `TaskTime` samen met een basis. `partial.time` heeft wel het TYPE `TaskTime`,
 * maar aanroepers buiten de typechecker (de extensie-sandbox draait ongetypeerde `new Function`-code;
 * MCP-payloads worden alleen tegen JSON-schema gevalideerd) kunnen op RUNTIME een onvolledig object
 * sturen. Ongemerged laat een ontbrekend `completion` de eerstvolgende `writeIFC` crashen
 * (`time.completion.toFixed(1)` in `ifcTaskSlots.ts`) — auto-save, Opslaan én `planner_export_ifc`.
 *
 * **Twee aanroepsituaties, één functie — de `base` bepaalt het verschil:**
 *  - ADD (`taskSlice.addTask`, MCP-`draft.addTask`): `base` = een VERSE `createDefaultTaskTime(...)`;
 *    "ontbrekend ⇒ default" is dan ondubbelzinnig juist.
 *  - UPDATE (`taskSlice.updateTask`): `base` = de BESTAANDE `time` van de taak, NOOIT een verse
 *    default. De hele `time`-tak vervangen zou bij een aanroeper die alleen `scheduleStart` noemt
 *    (bv. de publieke `api.data.updateTask`, waar `ExtTaskTime` z'n `Required<>`-belofte op runtime
 *    niet afdwingt) stil `completion`/`freeFloat`/`totalFloat`/… wissen.
 *
 * **Verplichte velden** (nooit `undefined` op `TaskTime`: durationType/scheduleDuration/
 * scheduleStart/scheduleFinish/early-/lateStart/-Finish/freeFloat/totalFloat/isCritical/completion)
 * krijgen de terugval-merge (`??`, dus expliciete `false`/`0` blijven staan).
 *
 * **Optionele velden** (interferingFloat/isNearCritical/floatPath/actualStart/
 * -Finish/actualDuration/remainingTime/-Minutes/resume/stop) krijgen de SLEUTEL-AANWEZIGHEID-conventie:
 *   - `'veld' in partial` **false** ⇒ AANROEPER NOEMDE HET NIET ⇒ behoud `base.veld` (bij ADD toch
 *     altijd `undefined`, want de verse default zet deze velden nooit).
 *   - `'veld' in partial` **true**, ook als de waarde `undefined` is ⇒ BEWUSTE CLEAR ⇒ neem
 *     `partial.veld` over. Dit is de vorm die het dialoog-Opslaan (`state/taskDialogSave.ts`) gebruikt.
 *     Voor `durationMinutes` geldt een strengere invariant: bij een urentaak is dat veld de verplichte
 *     bron van waarheid en kan een losse `undefined` het niet wissen. Wisselen naar
 *     `durationUnit: 'days'` wist hem wel atomair.
 * Alleen zo onderscheidt JS "bewust gewist" van "nooit genoemd" — naar de WAARDE kijken (`??`) kan
 * dat niet: bestaande optionele waarden overleven een partiële update én een clear via `= undefined`
 * werkt.
 */
export function mergeTaskTime(base: TaskTime, partial: Partial<TaskTime> | undefined): TaskTime {
  if (!partial) partial = {};
  const legacyBase = base as TaskTime & { durationUnit?: TaskDurationUnit };
  const durationUnit = partial.durationUnit
    ?? (('durationMinutes' in partial && partial.durationMinutes != null) ? 'hours' : undefined)
    ?? legacyBase.durationUnit
    ?? (('durationMinutes' in partial ? partial.durationMinutes : legacyBase.durationMinutes) != null ? 'hours' : 'days');
  const merged: TaskTime = {
    durationType: partial.durationType ?? base.durationType,
    durationUnit,
    scheduleDuration: partial.scheduleDuration ?? base.scheduleDuration,
    scheduleStart: partial.scheduleStart ?? base.scheduleStart,
    scheduleFinish: partial.scheduleFinish ?? base.scheduleFinish,
    earlyStart: partial.earlyStart ?? base.earlyStart,
    earlyFinish: partial.earlyFinish ?? base.earlyFinish,
    lateStart: partial.lateStart ?? base.lateStart,
    lateFinish: partial.lateFinish ?? base.lateFinish,
    freeFloat: partial.freeFloat ?? base.freeFloat,
    totalFloat: partial.totalFloat ?? base.totalFloat,
    isCritical: partial.isCritical ?? base.isCritical,
    completion: partial.completion ?? base.completion,
    // Optioneel — sleutel-aanwezigheid, zie docstring hierboven ('in' i.p.v. '??').
    durationMinutes: 'durationMinutes' in partial ? partial.durationMinutes : base.durationMinutes,
    interferingFloat: 'interferingFloat' in partial ? partial.interferingFloat : base.interferingFloat,
    isNearCritical: 'isNearCritical' in partial ? partial.isNearCritical : base.isNearCritical,
    floatPath: 'floatPath' in partial ? partial.floatPath : base.floatPath,
    actualStart: 'actualStart' in partial ? partial.actualStart : base.actualStart,
    actualFinish: 'actualFinish' in partial ? partial.actualFinish : base.actualFinish,
    actualDuration: 'actualDuration' in partial ? partial.actualDuration : base.actualDuration,
    remainingTime: 'remainingTime' in partial ? partial.remainingTime : base.remainingTime,
    remainingMinutes: 'remainingMinutes' in partial ? partial.remainingMinutes : base.remainingMinutes,
    // VALKUIL: deze functie somt elk TaskTime-veld EXPLICIET op (geen spread), dus een nieuw
    // optioneel veld dat hier niet genoemd wordt, wordt STIL gedropt bij elke
    // `updateTask({ time: {...} })` — `tsc` ziet dat niet (het returntype staat een object toe dat een
    // optioneel veld weglaat).
    resume: 'resume' in partial ? partial.resume : base.resume,
    stop: 'stop' in partial ? partial.stop : base.stop,
  };
  if (merged.durationUnit === 'days') {
    merged.durationMinutes = undefined;
  } else if (merged.durationMinutes == null && taskDurationUnitOfTime(base) === 'hours') {
    // Een partiele update mag de enige native bron van een bestaande urentaak niet los wissen.
    // De expliciete eenheidswissel naar dagen hierboven blijft de enige geldige clear-operatie.
    merged.durationMinutes = base.durationMinutes;
  }
  return merged;
}

function taskDurationUnitOfTime(time: TaskTime): TaskDurationUnit {
  const legacy = time as TaskTime & { durationUnit?: TaskDurationUnit };
  return legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
}

/** Deterministische leesmigratie voor documentpayloads en recoverydata van vóór de eenheidskeuze. */
export function normalizeTaskDurationUnits(tasks: Task[]): Task[] {
  return tasks.map((task) => {
    // Het documentcontract wordt ook met bewust onvolledige poison-fixtures getest. Laat zulke
    // bestaande invaliditeit aan de contracttest over; de leesmigratie heeft uitsluitend iets te
    // normaliseren wanneer er daadwerkelijk een TaskTime-tak aanwezig is.
    if (!task?.time) return task;
    const legacy = task.time as TaskTime & { durationUnit?: TaskDurationUnit };
    const durationUnit = legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
    if (legacy.durationUnit === durationUnit && !(durationUnit === 'days' && legacy.durationMinutes != null)) {
      return task;
    }
    const time: TaskTime = { ...legacy, durationUnit };
    if (durationUnit === 'days') time.durationMinutes = undefined;
    return { ...task, time };
  });
}

/**
 * Invalidatie bij bewerken van het GELEZEN timephased-venster (laag 3/4). Principe: er gaat nooit
 * stilzwijgend broninformatie verloren, ook niet ná bewerken. Een inhoudelijke bewerking laat de
 * gelezen venster-sturing de motor niet langer ankeren, maar de RAUWE bron (`Task.timephasedContours`)
 * blijft ALTIJD staan; alleen de AFGELEIDE sturing wordt uitgeschakeld. De wis-functies hieronder zijn
 * de ENIGE plek die dat doet; store, MCP-draft en taakraster roepen ze aan (meestal via
 * `invalidateForTimeBaseChange`/`invalidateForAssignmentChange`), zodat die paden niet uit de pas lopen.
 *
 * SCOPE — twee aparte wis-functies, want de twee lagen hebben ANDERE stale-voorwaarden:
 *  - `clearTimephasedWindow` — LAAG 3 (`timephasedFinishFloor`, een GELEZEN, bevroren MSP-antwoord;
 *    `CPMSolver.ts`'s `timephasedFinish`) + het RAUWE wortel-anker (`timephasedStartAnchor`,
 *    `forwardPass`'s `preds.length===0`-tak). Beide reageren niet op een latere duur-/datum-/
 *    kalenderwijziging en moeten dus bij die triggerset invalideren.
 *  - `clearTimephasedDurationWalks` — LAAG 4 (`timephasedDurationWalks`). `CPMSolver.ts` wandelt
 *    `task.time.durationMinutes` (live) door de EIGEN resourcekalender van elke toewijzing bij elke
 *    `runCPM` — maar alleen voor een item ZONDER `workMinutes`. Bij >1 toewijzing zet `mppReader.ts`
 *    per item een BEVROREN `workMinutes` (apportionering), en `timephasedFinish` gebruikt
 *    `walk.workMinutes ?? durMin`: die bevroren waarde wint dan van elke latere duur-/datumwijziging.
 *    Daarnaast is elk item een bevroren import-snapshot PER TOEWIJZING (`{ anchor,
 *    resourceCalendarId }`, `deriveTimephasedWindowsForTasks`): verandert de TOEWIJZINGENSET (mogelijk
 *    een andere resourcekalender — precies de laag-4-activeringsvoorwaarde,
 *    `calendarBandsDiffer`/`calendarDiffersIncludingExceptions`), dan is de lijst stale.
 *  - `splitGaps`/`timephasedContours` — de RAUWE bron, geen gelezen venster dat de motor ankert. NOOIT
 *    hier wissen, in GEEN van beide functies.
 *
 * TRIGGERSET. Een trigger vuurt op een ECHT gewijzigde waarde, niet op een alleen meegestuurde
 * sleutel: zie `taskTriggerChanges` hieronder, de ene poort voor store, MCP-draft en taakraster.
 *  - duur/datums: `time.scheduleDuration`/`durationMinutes`/`scheduleStart`/`scheduleFinish`/
 *    `durationType` (WORKTIME↔ELAPSEDTIME slaat de hele kalenderwandeling om). Raakt laag 3 ALTIJD, en
 *    laag 4 alleen zodra `timephasedDurationWalksHaveFrozenWork` waar is — zonder bevroren
 *    `workMinutes` wandelt laag 4 toch al de live duur.
 *  - kalender: `Task.calendarId` (de kalender waarin het venster ooit berekend werd). Raakt
 *    UITSLUITEND laag 3: `timephasedFinish` resolvet per walk-item ZIJN EIGEN `resourceCalendarId`
 *    (nooit `task.calendarId`), en `setTaskCalendar` raakt `durationMinutes` niet — een
 *    taakkalenderwissel kan de laag-4-uitkomst dus niet beïnvloeden. Een edit op de RESOURCEkalender
 *    zelf (`resourceSlice.updateCalendar`) stroomt LIVE door zonder invalidatie, want elke walk
 *    resolvet zijn `resourceCalendarId` opnieuw bij élke `runCPM`; ook die hoort er dus NIET bij.
 *  - toewijzingen: resource-assign/unassign/verplaatsen — raakt BEIDE lagen ONVOORWAARDELIJK. Ook
 *    `resourceSlice.removeCalendar`/`commitCalendarLibrary` zetten `t.calendarId = undefined`
 *    rechtstreeks, buiten `setTaskCalendar` om, en roepen daarom zelf `clearTimephasedWindow` aan.
 *  GEEN trigger: alles wat de solver zelf terugschrijft (earlyStart/earlyFinish/floats/…, zie
 *  `TaskTimeComputed`/`TaskTimeAnalysis` in task.ts) — `runCPM`/documentwissel muteren de Immer-draft
 *  rechtstreeks en gaan nooit via `updateTask`/`updateTaskFields`/`patchTaskFields`.
 */
const TIMEPHASED_WINDOW_TIME_TRIGGERS = new Set<keyof TaskTime>([
  'scheduleDuration', 'durationMinutes', 'durationUnit', 'scheduleStart', 'scheduleFinish', 'durationType',
]);

/**
 * Triggerset voor `clearLevelingGaps`: BREDER dan die van het timephased-venster hierboven. Vier
 * klassen — duur, kalender, handmatige datums en VOORTGANG. Voortgang wist de MSP-urensturing terecht
 * niet (geen voortgangspad raakt `clearTimephasedWindow`), maar een leveling-gat ligt op de
 * WERKMINUTEN-as van de taak (`TaskSplitGap.afterMinutes`) en voortgang verzet die as wel degelijk —
 * `applyProgressInvariants` leidt er `remainingTime`/`actualStart` uit af en `CPMSolver` plant een
 * IN-PROGRESS-taak vanaf haar actuals. Een blijvend gat zou daarna op een dag liggen die niet meer
 * bestaat.
 *
 * Meegenomen bovenop de vier klassen: `constraint`/`constraint2` (een datum-constraint verplaatst de
 * taak net zo hard als een handmatige datum) — die staan als TOP-LEVEL veld op `Task`, niet in
 * `TaskTime`, en staan daarom in `LEVELING_GAP_TASK_TRIGGERS` hieronder.
 *
 * BEWUST NIET in de set: `priority` (pure nivelleer-INVOER, verzet geen enkele datum van de taak
 * zelf) en alles wat de solver terugschrijft. En let op de kant die je NIET ziet: `applyLeveling`
 * (`scheduleSlice.ts`) schrijft zijn gaten rechtstreeks op de Immer-draft, niet via `updateTask` —
 * de write die de gaten MAAKT kan zichzelf dus per constructie niet invalideren.
 */
const LEVELING_GAP_TIME_TRIGGERS = new Set<keyof TaskTime>([
  ...TIMEPHASED_WINDOW_TIME_TRIGGERS,
  'completion', 'actualStart', 'actualFinish',
]);

/** Top-level `Task`-velden die de tijdbasis van een taak verzetten (en dus haar leveling-gaten
 *  ongeldig maken). `calendarId` deelt de trigger met het timephased-venster; de twee constraints
 *  zijn leveling-gat-eigen. */
const LEVELING_GAP_TASK_TRIGGERS = ['calendarId', 'constraint', 'constraint2'] as const satisfies readonly (keyof Task)[];

/** Welke gevolgregels een taakbewerking ECHT raakt — zie {@link taskTriggerChanges}. */
export interface TaskTriggerChanges {
  /** Een duur-/datumtrigger (`TIMEPHASED_WINDOW_TIME_TRIGGERS`) kreeg een andere waarde: de
   *  duurgevolgen plus laag 3/4 ontkoppelen, `applyDurationChangeRules`. */
  timeBase: boolean;
  /** `calendarId` kreeg een andere waarde: laag 3 (+ bevroren laag 4) via
   *  `invalidateForTimeBaseChange`. */
  calendar: boolean;
  /** Een trigger van de nivelleergat-poort (tijdbasis, voortgang, kalender, constraints — de sets
   *  `LEVELING_GAP_TIME_TRIGGERS`/`LEVELING_GAP_TASK_TRIGGERS`) kreeg een andere waarde:
   *  `clearLevelingGaps`. */
  levelingGaps: boolean;
}

/** De velden die {@link taskTriggerChanges} leest; een volledige `Task` voldoet altijd. */
export type TaskTriggerFields = Pick<Task, 'time' | (typeof LEVELING_GAP_TASK_TRIGGERS)[number]>;

function timeTriggersChanged(before: TaskTime, after: TaskTime, keys: ReadonlySet<keyof TaskTime>): boolean {
  for (const key of keys) {
    // De eenheid op haar EFFECTIEVE waarde: een oude taak zonder `durationUnit`-sleutel krijgt die
    // bij elke `mergeTaskTime` ingevuld, maar dezelfde afgeleide eenheid is geen wijziging.
    const changed = key === 'durationUnit'
      ? taskDurationUnitOfTime(before) !== taskDurationUnitOfTime(after)
      : !sameValue(before[key], after[key]);
    if (changed) return true;
  }
  return false;
}

/**
 * WANNEER een gevolgregel vuurt — de ENE definitie voor elke schrijfroute (`taskSlice.updateTask`,
 * de MCP-draft `updateTaskFields`/`patchTaskFields` en het taakraster): alleen als de relevante
 * WAARDE echt verandert, vergeleken tussen de taak vóór en ná de bewerking (dus ná samenvoegen,
 * `mergeTaskTime`). Structureel via `sameValue`: een meegestuurd-maar-gelijk object telt niet, en
 * `undefined` is gelijk aan een afwezige sleutel. Een aanroeper die de volledige bestaande `time`
 * of `calendarId`/`constraint` terugstuurt (het venster "Taak bewerken" doet dat altijd) verandert
 * daarmee niets en mag dus ook geen MSP-sturing loslaten of nivelleergaten wissen.
 *
 * WAT een gevolgregel doet, staat bij de regels zelf (`applyDurationChangeRules`,
 * `invalidateForTimeBaseChange`, `clearLevelingGaps`); de triggersets en hun waarom in de docblokken
 * hierboven. Puur: `before` en `after` worden alleen gelezen (Immer-drafts mogen).
 */
export function taskTriggerChanges(before: TaskTriggerFields, after: TaskTriggerFields): TaskTriggerChanges {
  const timeBase = timeTriggersChanged(before.time, after.time, TIMEPHASED_WINDOW_TIME_TRIGGERS);
  const calendar = !sameValue(before.calendarId, after.calendarId);
  const levelingGaps = timeBase
    || LEVELING_GAP_TASK_TRIGGERS.some((k) => !sameValue(before[k], after[k]))
    || timeTriggersChanged(before.time, after.time, LEVELING_GAP_TIME_TRIGGERS);
  return { timeBase, calendar, levelingGaps };
}

/** De taak zoals een `updateTask`-achtige patch haar achterlaat, ZONDER te muteren: top-level velden
 *  overschreven, `time` samengevoegd via `mergeTaskTime`. De schrijfvorm van `taskSlice.updateTask`
 *  en de MCP-draft `updateTaskFields`; wat deze teruggeeft is wat hun no-op-guard (`sameValue`) en
 *  `taskTriggerChanges` met de huidige taak vergelijken. Ongewijzigde velden delen hun referentie. */
export function mergeTaskUpdate(task: Task, updates: Partial<Task>): Task {
  const { time, ...rest } = updates;
  return { ...task, ...rest, time: time ? mergeTaskTime(task.time, time) : task.time };
}

/** Wist `timephasedFinishFloor`/`timephasedStartAnchor` als ze gezet zijn — idempotent, geen effect
 *  op een taak zonder timephased-venster. Muteert `task` in-place (Immer-draft-stijl). Retourneert
 *  `true` als er ECHT iets gewist is: de aanroepers bepalen daarmee of een gebruiker zojuist
 *  aantoonbaar de MSP-sturing van een taak heeft losgemaakt (voor de eenmalige melding, zie
 *  `state/timephasedLossNotice.ts`) — een `false` is een no-op-aanroep, waarvoor NOOIT gemeld mag
 *  worden. */
export function clearTimephasedWindow(task: Task): boolean {
  let cleared = false;
  if (task.timephasedFinishFloor !== undefined) { delete task.timephasedFinishFloor; cleared = true; }
  if (task.timephasedStartAnchor !== undefined) { delete task.timephasedStartAnchor; cleared = true; }
  return cleared;
}

/** Wist `timephasedDurationWalks` (LAAG 4) als gezet. Aanroepen bij een toewijzingswijziging
 *  (assign/unassign/move) ONVOORWAARDELIJK, en bij een duur-/datumwijziging (GEEN kalenderwijziging,
 *  zie de "kalender"-paragraaf van de triggerset hierboven) alleen zodra
 *  `timephasedDurationWalksHaveFrozenWork(task)` waar is. Zonder bevroren `workMinutes` wandelt laag 4
 *  al de live `task.time.durationMinutes`; wissen zou dan alleen een onnodige terugval naar laag 5 zijn.
 *  Elk item is een bevroren `{ anchor, resourceCalendarId, workMinutes? }`-snapshot per toewijzing uit
 *  de .mpp-import, dus de lijst is stale zodra de toewijzingenset verandert. Na het wissen valt de taak
 *  terug op laag 5 (gewone CPM-duurberekening) totdat een volgende .mpp-import de lijst opnieuw vult —
 *  er is geen live herberekende vervanger. Retourneert `true` als er ECHT iets gewist is (zie
 *  `clearTimephasedWindow`). */
export function clearTimephasedDurationWalks(task: Task): boolean {
  if (task.timephasedDurationWalks !== undefined) { delete task.timephasedDurationWalks; return true; }
  return false;
}

/**
 * Wist de door de nivelleerder ingevoegde werkonderbrekingen (`source === 'leveling'`) van `task` en
 * laat IMPORTSPLITS (gaten zonder `source`) staan. Geeft `true` terug wanneer er daadwerkelijk iets
 * gewist is. Blijft er niets over, dan wordt `splitGaps` op `undefined` gezet (niet op een lege
 * array) — de IFC-round-trip-regel is "leeg/afwezig ⇒ niets geschreven".
 *
 * De AANROEPPLEKKEN (bewerkingen die de tijdbasis van een taak raken: duur, kalender, handmatige
 * datums, voortgang) zijn bedraad via `taskTriggerChanges(...).levelingGaps` hierboven — lees bij
 * `LEVELING_GAP_TIME_TRIGGERS` welke velden meetellen en waarom.
 */
export function clearLevelingGaps(task: Task): boolean {
  const gaps = task.splitGaps;
  if (!gaps || gaps.length === 0) return false;
  const kept = gaps.filter(g => g.source !== 'leveling');
  if (kept.length === gaps.length) return false;
  task.splitGaps = kept.length > 0 ? kept : undefined;
  return true;
}

// ── Nivelleeruitvoer ─────────────────────────────────────────────────────────────────────────────

/** Draagt `task` uitvoer van een nivellering: een vertraging — ook UITSLUITEND sub-dag-precisie
 *  (`levelingDelayMinutes`/`levelingDelayElapsed`, uit een `.mpp`) — of een ingevoegde pauzedag
 *  (`splitGaps` met `source: 'leveling'`)? De ENE definitie achter de no-op-guard van
 *  `clearLeveling`, de ribbonknop "Nivellering wissen", `planner_clear_leveling` en de
 *  verouderde-nivellering-waarschuwing van `planner_manage_resources` na een capaciteitswijziging
 *  (`resourceTools.ts`), zodat een knop nooit inschakelt terwijl de actie een no-op is, of andersom. */
export function hasLevelingOutput(task: Task): boolean {
  return task.levelingDelay !== undefined
    || task.levelingDelayMinutes !== undefined
    || task.levelingDelayElapsed !== undefined
    || (task.splitGaps ?? []).some(g => g.source === 'leveling');
}

/** Wist de sub-dag-velden die `CPMSolver.shiftByLevelingDelay` VÓÓR `levelingDelay` leest (een
 *  achtergebleven waarde zou een nieuwe delay stil overrulen). `true` ⇒ er ging werkelijk
 *  sub-dag-precisie verloren — de aanroeper telt dat voor `notifyLevelingDelayRounded`. */
function dropSubDayLevelingDelay(task: Task): boolean {
  const rounded = task.levelingDelayMinutes !== undefined || task.levelingDelayElapsed !== undefined;
  task.levelingDelayMinutes = undefined;
  task.levelingDelayElapsed = undefined;
  return rounded;
}

/** Wist alle nivelleeruitvoer van `task` ("Nivellering wissen"): de vertraging, de sub-dag-velden
 *  en de nivelleergaten — importsplits zijn brondata en blijven staan. Retourneert zoals
 *  {@link dropSubDayLevelingDelay} of er sub-dag-precisie verloren ging. */
export function clearLevelingOutput(task: Task): boolean {
  task.levelingDelay = undefined;
  const rounded = dropSubDayLevelingDelay(task);
  clearLevelingGaps(task);
  return rounded;
}

/**
 * Schrijft een nivelleervoorstel op de taken — de ENE implementatie achter `scheduleSlice`'s
 * `applyLeveling` en de MCP-`draft.applyLeveling`, zodat die twee niet uit elkaar lopen.
 * Idempotent: elke taak binnen de scope krijgt eerst haar delay uit `write.delays` (of geen), verliest
 * haar sub-dag-velden en krijgt `write.gaps[id]` als VOLLEDIGE gatenlijst (importsplits
 * inbegrepen); staat ze niet in `write.gaps`, dan gaan alleen de nivelleergaten van een vorige
 * nivellering weg. `scopeTaskIds`: taken erbuiten zijn vaste last waarop het
 * voorstel gerekend heeft en blijven ongemoeid; afwezig ⇒ alle taken. Retourneert het aantal taken
 * dat sub-dag-precisie verloor (voor de eenmalige melding).
 */
export function writeLevelingResult(
  tasks: Task[],
  write: Pick<LevelingResult, 'delays' | 'gaps'>,
  scopeTaskIds?: string[],
): number {
  const scope = scopeTaskIds ? new Set(scopeTaskIds) : null;
  let roundedCount = 0;
  for (const task of tasks) {
    if (scope && !scope.has(task.id)) continue;
    const d = write.delays[task.id];
    task.levelingDelay = d !== undefined && d > 0 ? d : undefined;
    if (dropSubDayLevelingDelay(task)) roundedCount++;
    const g = write.gaps[task.id];
    if (g !== undefined) task.splitGaps = g.length > 0 ? g : undefined;
    else clearLevelingGaps(task);
  }
  return roundedCount;
}

/** De "duur/datums"-trigger (ook de kalender in `updateTask`/`draft.updateTaskFields`/
 *  `patchTaskFields` en een splitbewerking): wis laag 3 altijd, en laag 4 alleen zodra een walk
 *  bevroren `workMinutes` draagt (zonder die bevroren waarde wandelt laag 4 al de live duur).
 *  Retourneert `true` als er MSP-sturing verloren ging. Welke bewerking de trigger raakt, beslist de
 *  aanroeper (`setTaskCalendar` wist bijvoorbeeld alleen laag 3). */
export function invalidateForTimeBaseChange(task: Task): boolean {
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = timephasedDurationWalksHaveFrozenWork(task) && clearTimephasedDurationWalks(task);
  return clearedWindow || clearedWalks;
}

/** De "toewijzingen"-trigger (zie de triggerset hierboven) voor één taak waarvan de
 *  toewijzingenset net veranderde: laag 3 en 4 ONVOORWAARDELIJK wissen (een andere resource kan een
 *  andere resourcekalender betekenen) plus de nivelleergaten (geen melding, app-eigen afgeleide
 *  uitvoer). Retourneert `true` als er MSP-sturing verloren ging — alleen daarvoor meldt de
 *  aanroeper. */
export function invalidateForAssignmentChange(task: Task): boolean {
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = clearTimephasedDurationWalks(task);
  clearLevelingGaps(task);
  return clearedWindow || clearedWalks;
}

/** TRUE zodra de taak nog ACTIEVE timephased-sturing draagt: een gezet
 *  `timephasedFinishFloor`/`timephasedStartAnchor` (laag 3) of een niet-lege
 *  `timephasedDurationWalks` (laag 4). Voor de eigenschappenpaneel-markering — "volgt de urenverdeling
 *  uit MS Project" hoort hier, niet op de kale aanwezigheid van `timephasedContours` (dat is de rauwe
 *  bron, zie `taskHasTimephasedContours` hieronder). */
export function taskHasActiveTimephasedSteering(task: Task): boolean {
  return task.timephasedFinishFloor !== undefined
    || task.timephasedStartAnchor !== undefined
    || (task.timephasedDurationWalks?.length ?? 0) > 0;
}

/** TRUE zodra de taak rauwe, uit een .mpp-import afkomstige contourperiodes draagt
 *  (`Task.timephasedContours`). Een edit wist dit veld NOOIT — samen met
 *  `taskHasActiveTimephasedSteering` hierboven onderscheidt dit de twee paneel-toestanden: actieve
 *  sturing vs. een taak die zijn sturing ná een bewerking heeft losgelaten maar waarvan de bron nog
 *  altijd in het bestand staat. */
export function taskHasTimephasedContours(task: Task): boolean {
  return (task.timephasedContours?.length ?? 0) > 0;
}

/** TRUE zodra minstens één item in `timephasedDurationWalks` een gezette `workMinutes` draagt.
 *  `CPMSolver.ts`'s `timephasedFinish` gebruikt per item `walk.workMinutes ?? task.time.durationMinutes`
 *  — is `workMinutes` gezet, dan WINT die bevroren importwaarde altijd van een latere duur-/
 *  datumwijziging, en zou die bewerking zonder wissen geen effect hebben op de berekende finish.
 *  VALKUIL: toets hier NOOIT op `walks.length` — een lijst van LENGTE 1 kan `workMinutes` dragen
 *  (de MATERIAL-gefilterde >1-tak in `mppReader.ts`'s finalisatielus); de garantie "geen
 *  workMinutes" zit op de PRODUCERENDE tak, niet op de array-lengte. Daarom toetst deze functie
 *  veld-aanwezigheid (`.some`). Een walk zónder `workMinutes` wandelt de live duur en blijft terecht
 *  ongemoeid. */
export function timephasedDurationWalksHaveFrozenWork(task: Task): boolean {
  return (task.timephasedDurationWalks ?? []).some((w) => w.workMinutes !== undefined);
}

// ── Contour-engine: herschaling bij een duurwijziging ────────────────────────────────────────────

/** `hoursPerDay` van de TAAKkalender (scalar uit de `WorkCalendar`, dezelfde bron als
 *  `CPMSolver.calendarFor`/`ResourceLoad.engineForTask`: `task.calendarId` → bibliotheek, anders
 *  de projectkalender). Voor de HERSCHALINGSFACTOR is de exacte waarde alleen relevant bij een
 *  eenheidswissel dagen↔uren (bij dagen↔dagen en uren↔uren valt hij tegen elkaar weg). */
export function taskCalendarHoursPerDay(task: Task, calendars: WorkCalendar[], projectCalendar: WorkCalendar): number {
  // De EFFECTIEVE uren per dag — op een uurkalender uit de banden
  // afgeleid — zodat contourreferentie, werkdriehoek en raster dezelfde slot zien.
  return effHoursPerDay(resolveCalendar(task.calendarId, calendars, projectCalendar));
}

/** Werkduur van de taak in werkminuten (zie `contourEngine.ts`'s `taskWorkMinutes`) — aan te
 *  roepen VÓÓR een `mergeTaskTime`, zodat `rescaleTaskContours` de oude waarde kent. */
export function taskWorkMinutesOf(task: Task, hoursPerDay: number): number {
  return taskWorkMinutes(task.time, hoursPerDay);
}

/**
 * De bewerkregel "een bewerking op een gecontourde taak neemt de verdeling mee". Aan te roepen NÁ de
 * duurmutatie op een taak die `timephasedContours` draagt: herschaalt de contourperiodes én de
 * IMPORTsplits (`splitGaps` zonder `source`) proportioneel van `oldWorkMinutes` naar de nieuwe
 * werkduur van de taak, volgens `contourEngine.ts`'s `rescaleContourForDuration` (actual-periodes
 * blijven staan, FIXED_WORK houdt het werk vast). Idempotent: gelijke duur ⇒ niets gewijzigd.
 * Muteert `task` in-place (Immer-draft-stijl, zoals `clearTimephasedWindow`). Retourneert `true`
 * als er ECHT iets herschaald is.
 *
 * Bewust GEEN aanroep bij een datumverschuiving: de as is offset-gebaseerd (shift-invariant, zie
 * `TaskSplitGap`'s docblok), dus een verplaatsing kost geen herschaling. Een kalenderwissel die de
 * SLOT verandert (uren per dag) is wél een aanroeper — via `workRuleApply.ts`'s
 * `settleCalendarChange`: dezelfde dagen zijn dan een andere hoeveelheid werkminuten, en de as leeft
 * op werkminuten.
 *
 * `opts.keepGaps`: sla de `rescaleSplitGaps`-stap over. `taskSlice.setTaskSplits` schrijft de
 * gatenlijst in dezelfde bewerking ZELF — die komt rechtstreeks uit het stukkenmodel en is dus al op
 * de nieuwe werkduur gerekend; zonder deze vlag zou hij hier een tweede keer geschaald worden.
 */
export function rescaleTaskContours(
  task: Task,
  oldWorkMinutes: number,
  hoursPerDay: number,
  // Werkbehoud is een REGELkeuze (`contourKeepsWork` hierboven), niet alleen een
  // MSP-herkomstvinkje. Zonder argument geldt de MSP-afleiding.
  keepWork: boolean = task.mspTaskType === 'FIXED_WORK',
  opts?: { keepGaps?: boolean },
): boolean {
  const contours = task.timephasedContours;
  if (!contours || contours.length === 0) return false;
  const newWorkMinutes = taskWorkMinutes(task.time, hoursPerDay);
  // Eén gedeeld profiel voor de factor: de contour met de langste asspanne bepaalt de taakduur
  // (dezelfde "langste toewijzing bepaalt de finish"-regel als laag 3/4), dus die is de referentie
  // voor zowel de periodes als de gaten.
  const reference = contours.reduce((best, c) => {
    const span = c.periods.reduce((m, p) => Math.max(m, p.afterMinutes + p.minutes), 0);
    return span > best.span ? { span, periods: c.periods } : best;
  }, { span: -1, periods: contours[0].periods });
  if (!rescaleFactor(reference.periods, oldWorkMinutes, newWorkMinutes)) return false;
  task.timephasedContours = contours.map((c) => ({
    ...c,
    periods: rescaleContourForDuration(c.periods, oldWorkMinutes, newWorkMinutes, keepWork ? 'FIXED_WORK' : undefined),
  }));
  if (!opts?.keepGaps) {
    const gaps = rescaleSplitGaps(
      task.splitGaps, reference.periods, oldWorkMinutes, newWorkMinutes,
      splitUnitMinutes(task, hoursPerDay),
    );
    if (gaps !== undefined) task.splitGaps = gaps;
  }
  return true;
}

// ── De gevolgregels van een duurwijziging ────────────────────────────────────────────────────────

/**
 * Wat een DUURWIJZIGING met de rest van de taak doet — de ENE definitie achter de drie schrijfroutes:
 * `taskSlice.updateTask` (eigenschappenpaneel, dialoog, Gantt, extensies), het taakraster
 * (`taskEditPlan.ts`: duur-, eenheid- en mijlpaalcel) en de MCP-draft (`createMcpTransactions.ts`:
 * `patchTaskFields`/`updateTaskFields`). Die routes SCHRIJVEN elk op hun eigen manier (Immer-draft,
 * losse taakkopie in een gridtransactie, MCP-draft met rollback), en dat mag zo blijven; de
 * GEVOLGEN staan alleen hier, zodat geen route een regel mist.
 *
 * Aan te roepen NÁ de duurmutatie, met de werkduur van VÓÓR de mutatie (`taskWorkMinutesOf`) en de
 * uren-per-dag waarmee die werd gemeten. De volgorde is betekenisvol:
 *  1. contour én importsplits proportioneel meeschalen (`rescaleTaskContours`);
 *  2. is er niets herschaald en KRIMPT het werk, dan vervallen gebruikersgaten op of voorbij het
 *     nieuwe werktotaal (`clipUserGapsToWork`). Zonder contour schaalt niets de gaten
 *     mee; bleef zo'n gat liggen, dan was de lijst niet meer wélgevormd en werd de taak voor splits
 *     stilzwijgend ALLEEN-LEZEN — erger dan het gat laten vervallen. Importgaten en nivelleergaten
 *     volgen hun eigen levenscyclus. Staat vóór stap 4: de aspositie van een gebruikersgat telt de
 *     nivelleergaten ervóór mee (`splitWalk.ts`);
 *  3. laag 3 (en laag 4 met bevroren werk) ontkoppelen (`invalidateForTimeBaseChange`);
 *  4. nivelleergaten wissen (`clearLevelingGaps`) — importsplits blijven brondata.
 * Bij een gelijke werkduur doen stap 1 en 2 niets; stap 3 en 4 zijn idempotent.
 *
 * Retourneert `true` als er MSP-sturing verloren ging (voor de eenmalige melding, zie
 * `invalidateForTimeBaseChange`). WANNEER iets als duurwijziging telt, is een echte waardewijziging
 * (`taskTriggerChanges(...).timeBase`, nooit een alleen meegestuurde sleutel); wat een kalender-,
 * datum-, constraint- of voortgangswijziging daarnaast doet, beslist de aanroeper.
 *
 * `opts.rescaleContours: false` slaat stap 1 over (het raster doet dat bij een onbruikbare
 * uren-per-dag, zie `finishDurationEdit` in taskEditPlan.ts); stap 2 geldt dan zoals zonder contour.
 * `opts.keepWork` is het werkbehoud van de herschaling (`contourKeepsWork`); afwezig ⇒ de
 * MSP-afleiding van `rescaleTaskContours`.
 *
 * Dit is de KERN van `settleDurationAftermath`
 * (workRuleApply.ts) — die voegt er het werkbehoud uit de regel en de herleiding van het ingevoerde
 * uur-einde (`reconcileHourInputFinish`) aan toe. Store en MCP roepen `settleDurationAftermath`
 * aan; het raster (geen project/kalenders in zijn omgeving) roept deze kern rechtstreeks aan en
 * herleidt het einde zelf (`reconcileGridInputFinish`).
 */
export function applyDurationChangeRules(
  task: Task,
  oldWorkMinutes: number,
  hoursPerDay: number,
  opts?: { rescaleContours?: boolean; keepWork?: boolean },
): boolean {
  const rescaled = opts?.rescaleContours !== false
    && rescaleTaskContours(task, oldWorkMinutes, hoursPerDay, opts?.keepWork);
  if (!rescaled && task.splitGaps !== undefined) {
    const newWorkMinutes = taskWorkMinutes(task.time, hoursPerDay);
    if (newWorkMinutes < oldWorkMinutes - 1e-6) {
      const clipped = clipUserGapsToWork(task.splitGaps, newWorkMinutes);
      task.splitGaps = clipped && clipped.length > 0 ? clipped : undefined;
    }
  }
  const lost = invalidateForTimeBaseChange(task);
  clearLevelingGaps(task);
  return lost;
}
