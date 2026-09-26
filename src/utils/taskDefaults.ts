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

// ── Bewerkregels die per-taak-herkomst lezen (E6, PR #101 baan 1) ───────────────────────────────
// Deze twee lezen `mspTaskType` — bewaarde bronherkomst van één taak — om te bepalen hoe een
// BEWERKING uitpakt (contour herschalen, 8-B-effort-driven). Dat is geen solverinvoer en geen
// conventie (regel B): de motor (`src/engine/`) mag geen bronformaat lezen, dus ze wonen hier, naast
// `rescaleTaskContours`, dat de uitkomst van `contourKeepsWork` als `keepWork` krijgt.

/** Bewaard MSP-vinkje voor beslispunt 8-B: alleen betekenisvol op een taak met MSP-herkomst
 *  (`mspTaskType`); daar is "afwezig" letterlijk "niet effort-driven". Zonder herkomst ⇒ zuiver P6.
 *  Formaatafhankelijke BEWERKREGEL (driehoek, paneel), niet iets wat de solver leest. */
export function effectiveEffortDriven(task: Pick<Task, 'mspTaskType' | 'effortDriven'>): boolean | undefined {
  return task.mspTaskType ? (task.effortDriven ?? false) : undefined;
}

/**
 * Herschaalt een contour met werkbehoud onder de werkbeschermende regels (spec §6.3). Zonder eigen
 * `workRule` geldt de oude MSP-afleiding (`mspTaskType === 'FIXED_WORK'`) náást de projectstandaard,
 * zodat een vóór deze etappe opgeslagen MSP-import byte-identiek blijft herschalen.
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
   *  WERKMINUTEN op deze kalender (met tijd), zie {@link hourTaskInputFinish}. Zonder kalender blijft
   *  het oude werkdagen-einde staan — alleen lezers laten hem weg, en die overschrijven het einde
   *  direct met de bronwaarde (xerReader). Elke app-ingang (nieuwe taak, MCP, wizard) geeft hem mee. */
  calendar?: WorkCalendar,
): TaskTime {
  // Derive a finish consistent with the duration so the Gantt bar spans the
  // right number of days before CPM runs. Matches CalendarEngine.addWorkDays
  // (inclusive, weekends skipped); runCPM later refines it with the full calendar.
  // Bij een onparseerbare start (bv. corrupte import) NIET formatteren — formatDate
  // (toISOString) gooit dan. Val terug op `start`; de CPM-solver vangt de ongeldige
  // datum verderop af met een nette foutmelding i.p.v. een crash.
  //
  // UURTAAK (B1-vervolg, critreview 24-09): de solve schrijft `scheduleFinish` sinds B1 niet meer
  // terug, dus dit einde BLIJFT staan als ingevoerd einde ("Gepland einde", IfcTaskTime.ScheduleFinish,
  // het IFC-werkplan-einde). Het oude werkdagen-einde las het tweede argument (hier UREN) als
  // werkdagen: een nieuwe taak van 5 u eindigde zo 5 werkdagen later, zonder tijd.
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

// ── Ingevoerd einde van een urentaak (B1-vervolg, critreview 24-09) ─────────────────────────────
//
// `scheduleFinish` is INVOER: de solve schrijft hem sinds gebruikstest 24-09 (B1) niet meer terug,
// want de P6-conventies lezen hem als het geplande bronvenster (`target_end_date`) — de uitvoer van de
// ene berekening werd zo invoer voor de volgende. Tot B1 hield juist die terugschrijving het einde van
// een urentaak actueel (d67b26a7, juli: "scheduleFinish liep stale na een duur-wijziging"). Zonder haar
// moet de INVOERKANT het einde coherent houden: bij aanmaken en bij elke duur-, start-, eenheids-,
// duurtype- of kalenderwijziging leidt de bewerking het einde af uit start + duur op de kalender van
// de taak zelf. Nooit vanuit de solve, en alleen voor een urentaak — een dagtaak blijft byte-identiek
// (daar volgde het einde ook vóór B1 de solve niet).
//
// Paden die het einde WEL herleiden: `taskSlice.updateTask`/`setTaskCalendar`, de MCP-tweelingen
// `updateTaskFields`/`patchTaskFields`, het taakraster (`taskEditPlan.ts`, ook de gesplitste
// kalenderroute in `gridTransaction.ts`), en — sinds baan 2 van de overname van PR #101 — elke duur
// die uit de WERKDRIEHOEK komt: inzet, werk of resource erbij/eraf onder Vast werk/Vaste inzet
// (`resourceSlice` `updateAssignment`/`setAssignmentWork`/`assignResource`/`unassignResource`/
// `moveAssignment`/`removeResource`, het assignment-set-pad van het raster, en de MCP-toewijzingen
// achter `planner_manage_assignments`/`planner_manage_resources`). Die komen allemaal samen in
// `workRuleApply.ts`'s `settleDurationAftermath`, die de basis van VÓÓR de bewerking als verplichte
// parameter krijgt en in dezelfde volgorde als `updateTask` eerst `clearLevelingGaps` en dan
// `reconcileHourInputFinish` draait. Laden (`applyOpenedImport`) loopt daar nooit doorheen.
//
// Wat NIET meebeweegt (zie `hourInputFinishFollowsEdits`): een gestarte of voltooide taak (het geplande
// einde is dan geschiedenis, zoals in P6), een taak met een expliciet P6-targetvenster uit de XER
// (`p6ExplicitTargetWindow`: dat venster mag planningsruimte bevatten en is bronwaarde), een handmatig
// geplande taak (daar IS `scheduleFinish` het einde), een hammock (afgeleide span) en een samenvattende
// taak. Een lezer loopt hier nooit doorheen: het einde uit het bestand blijft dus staan tot de gebruiker
// de taak bewerkt.
//
// Wat het einde bewust NIET herleidt (orkestratorbesluit fixronde 2: niet herleiden, wél documenteren;
// het einde volgt bij de volgende invoerbewerking van de taak): wijzigingen aan de project- of een
// gedeelde kalender of haar uitzonderingen (`setCalendar`, `updateCalendar`, `setProjectCalendar`),
// het verwijderen van een taakkalender (`resourceSlice.removeCalendar`: de taak valt terug op de
// projectkalender, haar einde blijft staan — Fable-critreview PR #169, bevinding 10), splits zonder
// duurwijziging, de uitvoer van de nivelleerder, `moveProject`, en de resourcekalender
// van een `.mpp`-taak (de afleiding rekent op de taakkalender). Nieuwe taken: store-`addTask`,
// MCP-`draft.addTask` en de extensie-API `api.data.addTask` (via `fromExtTaskAddInput`) leiden het
// einde af met `seedNewHourTaskFinish`; `sdk.factory.createTask` is een DTO-bouwer zonder document of
// kalender en leidt niets af (een importresultaat is bronwaarde, zoals bij een lezer). De reconcile draait ná
// `clearLevelingGaps`, zodat nivelleergaten die dezelfde bewerking wist niet meetellen.

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
 * én de MCP-`draft.addTask` (die mochten nooit stil uit elkaar drijven, Z0-reviewbevinding 3). Wat
 * per pad verschilt geeft de aanroeper mee: het id, de (gevalideerde) ouder en de beginduur (`time`,
 * al gemerged met `partial.time`, T14b — een ongemerged `time` liet writeIFC crashen op een
 * ontbrekend `completion`). Plaatsing, WBS-code en undo/dirty blijven bij de aanroeper.
 *
 * Overerving (2026-08-14): zonder eigen `taskType` neemt een taak met een ouder diens taskType (en bij
 * USERDEFINED diens eigen taaktype-id) over, vóór de bouwmodus-brede default (bouwmodus 2026-07-13:
 * neutraal USERDEFINED i.p.v. CONSTRUCTION). Geldt alleen bij aanmaken; indenteren/verslepen laat
 * taskType met rust. `priority` via `??`: 0 is geldig (laagste, levelt als eerste weg). De optionele
 * velden (constraint2/isHammock/externalLinks, fase 2.9; notes; de Z0-typecontractvelden
 * splitGaps/manuallyScheduled/levelingDelayMinutes/-Elapsed) gaan ongewijzigd mee: afwezig ⇒
 * undefined ⇒ byte-identiek default-document. `levelingDelay` zelf bewust NIET: dat zet uitsluitend
 * de nivelleerder.
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
  };
}

/** Een urentaak draagt zijn duur in `durationMinutes`; leid `scheduleDuration` (werkdagen) daaruit af
 *  met de uren/dag van zijn kalender (0 bij een kalender zonder uren). No-op voor een dagentaak. */
export function deriveScheduleDurationFromMinutes(time: TaskTime, hoursPerDay: number): void {
  if (time.durationUnit !== 'hours') return;
  time.scheduleDuration = hoursPerDay > 0 ? (time.durationMinutes ?? 0) / (hoursPerDay * 60) : 0;
}

/**
 * T14b (gebruikstestbevinding, ernst hoog): `addTask` accepteert een meegegeven `partial.time` als
 * TYPE `TaskTime` (volledig), maar callers buiten de TS-typechecker (de extensie-sandbox draait
 * ongetypeerde `new Function`-code; MCP-tool-payloads worden alleen tegen JSON-schema gevalideerd,
 * niet tegen deze interface) kunnen op RUNTIME best een onvolledig object opsturen. Vóór deze fix
 * gebruikten `taskSlice.addTask` en `mcpTransaction.ts`'s `draft.addTask` domweg
 * `partial.time || createDefaultTaskTime(...)` — een meegegeven-maar-onvolledig object werd
 * ONGEWIJZIGD gebruikt, dus een ontbrekend `completion` bleef `undefined` tot de eerstvolgende
 * `writeIFC` crashte op `time.completion.toFixed(1)` (`src/services/ifc/ifcTaskSlots.ts`) — dat trof
 * auto-save, Opslaan/Opslaan-als én `planner_export_ifc` in één keer.
 *
 * **Twee aanroepsituaties, één functie — de `base` bepaalt het verschil:**
 *  - ADD (`taskSlice.addTask`, `mcpTransaction.draft.addTask`): `base` = een VERSE
 *    `createDefaultTaskTime(...)`. Er is nog geen bestaande taak, dus "ontbrekend ⇒ default" is
 *    ondubbelzinnig juist.
 *  - UPDATE (`taskSlice.updateTask`, T14b-vervolg — gebruikstestbevinding "partiële time-update wist
 *    bestaande waarden"): `base` = de BESTAANDE `time` van de taak, NOOIT een verse default. Een
 *    `Object.assign(task, { time: partial })` verving voorheen de HELE `time`-tak: een aanroeper die
 *    alleen `scheduleStart` wilde bijwerken (bv. via de publieke `api.data.updateTask`, waar
 *    `ExtTaskTime` z'n eigen `Required<>`-belofte op runtime niet afdwingt) wiste zo stil
 *    `completion`/`freeFloat`/`totalFloat`/etc. — dezelfde schadeklasse als de ADD-bug, alleen ipv.
 *    een crash een STILLE dataverlies.
 *
 * **Verplichte velden** (nooit `undefined` op `TaskTime`: durationType/scheduleDuration/
 * scheduleStart/scheduleFinish/early-/lateStart/-Finish/freeFloat/totalFloat/isCritical/completion)
 * krijgen de terugval-merge (`??`, dus expliciete `false`/`0` blijven staan).
 *
 * **Optionele velden** (interferingFloat/isNearCritical/floatPath/actualStart/
 * -Finish/actualDuration/remainingTime/-Minutes/resume/stop) krijgen de SLEUTEL-AANWEZIGHEID-conventie
 * (spec-review-fixronde 2026-08-17 — de eerdere "altijd 1-op-1 uit `partial`" bleek zelf een gat: een
 * partiële update die alleen `scheduleStart` noemde, wiste zo alsnog `durationMinutes`/`actualStart`/
 * `remainingTime`/etc., want die stonden simpelweg niet in `partial` — exact dezelfde schadeklasse als
 * de bug die deze hele helper moest dichten):
 *   - `'veld' in partial` **false** (de sleutel komt niet voor in het object) ⇒ AANROEPER NOEMDE HET
 *     NIET ⇒ behoud `base.veld` (de bestaande waarde bij UPDATE; bij ADD toch altijd `undefined`, want
 *     de verse default zet deze velden nooit).
 *   - `'veld' in partial` **true**, ook als de waarde `undefined` is ⇒ BEWUSTE CLEAR ⇒ neem
 *     `partial.veld` over (dus `undefined`). Dit is de vorm die het dialoog-Opslaan (`state/taskDialogSave.ts`) nu gebruikt
 *     Voor `durationMinutes` geldt sinds de expliciete taakeenheid een strengere invariant: bij een
 *     urentaak is dat veld de verplichte bron van waarheid en kan een losse `undefined` de bron dus
 *     niet wissen. Wisselen naar `durationUnit: 'days'` wist hem wel atomair.
 * Dit is de enige manier waarop JS/TS "bewust gewist" van "nooit genoemd" kán onderscheiden — beide
 * zien er identiek uit zodra je alleen naar de WAARDE kijkt (`??`), dus de eerdere `??`-vorm voor
 * optionele velden kon de twee wensen fundamenteel niet uit elkaar houden. Voor ADD is dit
 * gedragsgelijk aan de vorige versie (de default zet deze velden nooit, dus `base.veld` is toch altijd
 * `undefined`); voor UPDATE is dit nu de correcte oplossing voor BEIDE wensen tegelijk (bestaande
 * optionele waarden overleven een partiële update, én een bewuste clear via `= undefined` werkt nog
 * steeds) — de eerdere docstring noemde dit ten onrechte "onverenigbaar".
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
    // Z12-herwerk — resume/stop, zelfde sleutel-aanwezigheid-conventie als actualStart/actualFinish
    // hierboven. Gevonden tijdens fase-2-implementatie (T14b-achtige bugklasse): deze functie
    // somt elk TaskTime-veld EXPLICIET op (geen spread), dus een nieuw optioneel veld dat hier niet
    // genoemd wordt, wordt STIL gedropt bij elke `updateTask({ time: {...} })`-aanroep — `tsc` ziet
    // dat niet (het returntype `TaskTime` staat een object toe dat een optioneel veld weglaat).
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
 * Z14b — edit-time-invalidatie van het GELEZEN Z8-venster (plan-Z14, "Nataken vóór Z17" punt 1;
 * EIGENAARSPRINCIPE 2026-08-18: "er gaat nooit stilzwijgend broninformatie verloren, ook niet ná
 * bewerken"). Wanneer een gebruiker een taak inhoudelijk bewerkt, mag de gelezen venster-sturing de
 * motor niet langer ankeren — maar de RAUWE bron (`Task.timephasedContours`) blijft ALTIJD staan,
 * ook ná die bewerking; alleen de AFGELEIDE sturing wordt uitgeschakeld. Deze twee functies zijn de
 * ENIGE plek die dat doet, aangeroepen vanuit `taskSlice.ts` (`updateTask`/`setTaskCalendar`),
 * `mcpTransaction.ts` (`updateTaskFields`/`patchTaskFields`/`assignResource`/`unassignResource`/
 * `moveAssignment`) en `resourceSlice.ts` (`assignResource`/`unassignResource`/`moveAssignment`) —
 * de gedocumenteerde tweeling-paden, zodat ze niet uit de pas kunnen lopen.
 *
 * SCOPE — twee aparte wis-functies, want de twee lagen hebben ANDERE stale-voorwaarden:
 *  - `clearTimephasedWindow` — LAAG 3 (`timephasedFinishFloor`, een GELEZEN, bevroren MSP-antwoord;
 *    `CPMSolver.ts`'s `timephasedFinish`) + het RAUWE wortel-anker (`timephasedStartAnchor`,
 *    `forwardPass`'s `preds.length===0`-tak). Beide zijn GELEZEN waarden die niet reageren op een
 *    latere duur-/datum-/kalenderwijziging — MOET dus bij die triggerset invalideren.
 *  - `clearTimephasedDurationWalks` — LAAG 4 (`timephasedDurationWalks`). GEEN gelezen antwoord op
 *    de ANKERS zelf (`anchor`/`resourceCalendarId` blijven geldig): `CPMSolver.ts` wandelt
 *    `task.time.durationMinutes` (edit-live) door elke toewijzing se EIGEN resourcekalender bij
 *    ELKE `runCPM` — MAAR alleen voor een item ZONDER `workMinutes`. N2 (Opus-her-check, tweede
 *    ronde, corpusbevinding): bij >1 toewijzing zet `mppReader.ts` per item een BEVROREN
 *    `workMinutes` (F2-apportionering), en `CPMSolver.ts`'s `timephasedFinish` gebruikt
 *    `walk.workMinutes ?? durMin` — die bevroren waarde WINT dus altijd van een latere duur-/datum-
 *    wijziging zodra ze gezet is (`durMin` = `task.time.durationMinutes`, een stabiel veld — een
 *    taakkalenderwissel raakt het NIET, zie de "kalender"-paragraaf hieronder, dus DIE trigger valt
 *    hier bewust buiten scope). De eerdere claim hier ("stroomt AL vanzelf mee") was dus alleen waar
 *    voor de PRECIES-1-toewijzing-tak (waar `workMinutes` per constructie ontbreekt); voor de
 *    walks>1-apportioneringstak (148 corpustaken, zie N3-blast-radius in `mppReader.ts`) deed een
 *    duur-/datumwijziging tot deze fix NIETS.
 *    MAAR (F2-fixronde, spec-review op 526af9f9): elk item in de `walks`-lijst is zelf een BEVROREN
 *    import-snapshot PER TOEWIJZING (`{ anchor, resourceCalendarId }`, `mppReader.ts`'s
 *    `deriveTimephasedWindowsForTasks`) — verandert de TOEWIJZINGENSET (een andere resource, dus
 *    mogelijk een andere resourcekalender: precies de laag-4-activeringsvoorwaarde,
 *    `calendarBandsDiffer`/`calendarDiffersIncludingExceptions`), dan is die bevroren lijst stale.
 *    Vandaar WEL een aanroep bij de toewijzingen-trigger.
 *  - `splitGaps`/`timephasedContours` — de RAUWE bron/reeds-geconsumeerde CPM-invoer, geen "gelezen
 *    venster dat de motor ankert" in dezelfde bevroren zin; het eigenaarsprincipe eist juist dat
 *    déze blijven staan. NOOIT hier wissen, in GEEN van beide functies.
 *
 * TRIGGERSET (plan: "duur, datums, kalender, toewijzingen") — bepaald en hier vastgelegd. Een
 * trigger vuurt op een ECHT gewijzigde waarde, niet op een alleen meegestuurde sleutel: zie
 * `taskTriggerChanges` hieronder, de ene poort voor store, MCP-draft en taakraster.
 *  - duur/datums: `time.scheduleDuration`/`durationMinutes`/`scheduleStart`/`scheduleFinish`/
 *    `durationType` — elke sleutel die de solver rechtstreeks voor de LAAG-3/4-berekening gebruikt
 *    (`durationType` telt mee omdat WORKTIME↔ELAPSEDTIME de hele kalenderwandeling omslaat).
 *    Raakt laag 3 (`clearTimephasedWindow`) ALTIJD, én raakt laag 4 (`clearTimephasedDurationWalks`)
 *    zodra `timephasedDurationWalksHaveFrozenWork` waar is (N2-correctie: laag 4 stroomt NIET
 *    altijd live mee, zie hierboven) — bij géén bevroren `workMinutes` blijft laag 4 met rust,
 *    want die tak wandelt toch al de live duur.
 *  - kalender: `Task.calendarId` (bepaalt de kalender waarin het venster ooit berekend werd).
 *    Raakt UITSLUITEND laag 3 — GEEN N2-uitbreiding hier: `CPMSolver.ts`'s `timephasedFinish`
 *    resolvet per walk-item ZIJN EIGEN `resourceCalendarId` (nooit `task.calendarId`), en
 *    `durMin`/`task.time.durationMinutes` is een stabiel veld dat `setTaskCalendar` niet aanraakt
 *    (geverifieerd: de enige `task.time.durationMinutes = `-schrijfplekken in CPMSolver.ts zitten
 *    in de hammock-tak, hierboven expliciet buiten laag 3/4 gehouden) — een taakkalenderwissel kan
 *    de laag-4-uitkomst dus letterlijk niet beïnvloeden, met of zonder bevroren `workMinutes`.
 *    De andere helft van de reden (Opus-her-check ronde 3, gemeten): een edit op de
 *    RESOURCEkalender zelf (`resourceSlice.updateCalendar`) is wél relevant voor de walk-uitkomst,
 *    maar stroomt LIVE door zonder invalidatie — elke walk resolvet zijn `resourceCalendarId`
 *    opnieuw bij élke `runCPM` (meting: bandwijziging op de walk-kalender verschoof de ef van
 *    13:10 naar de volgende ochtend 08:10, zonder enige clear). Ook die trigger hoort er dus
 *    bewust NIET bij.
 *  - toewijzingen: resource-assign/unassign/verplaatsen (aparte aanroepplekken, zie hierboven) —
 *    raakt BEIDE lagen ONVOORWAARDELIJK (`clearTimephasedWindow` ÉN `clearTimephasedDurationWalks`):
 *    een andere resource kan een andere resourcekalender betekenen, en dat is exact de
 *    laag-4-discriminator (F2). Ook `resourceSlice.removeCalendar`/`commitCalendarLibrary` (F3): die
 *    zetten `t.calendarId = undefined` rechtstreeks, buiten `setTaskCalendar` om, dus die twee roepen
 *    `clearTimephasedWindow` zelf aan voor elke geraakte taak.
 *  GEEN trigger: alles wat de solver zelf terugschrijft (earlyStart/earlyFinish/floats/…, zie
 *  `TaskTimeComputed`/`TaskTimeAnalysis` in task.ts) — F5/`runCPM`/documentwissel gaan nooit via
 *  `updateTask`/`updateTaskFields`/`patchTaskFields` (ze muteren de Immer-draft rechtstreeks), dus
 *  dat onderscheid hoeft hier niet apart bewaakt te worden.
 */
const TIMEPHASED_WINDOW_TIME_TRIGGERS = new Set<keyof TaskTime>([
  'scheduleDuration', 'durationMinutes', 'durationUnit', 'scheduleStart', 'scheduleFinish', 'durationType',
]);

/**
 * B1c-plan-2 spec §4 "Invalidatie", bedraad in de fixronde op etappe 3 (bevinding B7).
 *
 * De triggerset voor `clearLevelingGaps` is BREDER dan die van het Z8-venster hierboven. De spec
 * noemt vier klassen — duur, kalender, handmatige datums en VOORTGANG — en die vierde ontbrak: geen
 * enkel voortgangspad raakt `clearTimephasedWindow` aan (voortgang wist de MSP-urensturing niet, en
 * dát is terecht), dus de eerste bedrading langs de Z8-venstertriggers liet 'm vallen.
 * Een leveling-gat ligt op de WERKMINUTEN-as van de taak (`TaskSplitGap.afterMinutes`); voortgang
 * verzet die as wel degelijk — `applyProgressInvariants` leidt er `remainingTime`/`actualStart` uit
 * af en `CPMSolver` plant een IN-PROGRESS-taak vanaf haar actuals. Een gat dat vóór de fix bleef
 * staan, lag daarna op een dag die niet meer bestaat.
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
 *  ongeldig maken). `calendarId` deelt de trigger met het Z8-venster; de twee constraints zijn
 *  leveling-gat-eigen. */
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
 *  op een taak zonder Z8-venster. Muteert `task` in-place (Immer-draft-stijl, spiegelt de rest van
 *  taskSlice.ts/mcpTransaction.ts). Retourneert `true` als er ECHT iets gewist is (mpp-nul-data-
 *  etappe, bewerkmelding): de aanroepers gebruiken dat om te bepalen of een gebruiker zojuist
 *  aantoonbaar de MSP-sturing van een taak heeft losgemaakt (voor de eenmalige K8a-melding, zie
 *  `state/timephasedLossNotice.ts`) — een `false` betekent een no-op-aanroep (bv. een edit op een
 *  taak die nooit een Z8-venster had), waarvoor NOOIT gemeld mag worden. */
export function clearTimephasedWindow(task: Task): boolean {
  let cleared = false;
  if (task.timephasedFinishFloor !== undefined) { delete task.timephasedFinishFloor; cleared = true; }
  if (task.timephasedStartAnchor !== undefined) { delete task.timephasedStartAnchor; cleared = true; }
  return cleared;
}

/** F2 (spec-review-fixronde op 526af9f9) — wist `timephasedDurationWalks` (LAAG 4) als gezet.
 *  Aanroepen bij een toewijzingswijziging (assign/unassign/move) ONVOORWAARDELIJK, én — sinds N2
 *  (Opus-her-check, tweede ronde) — bij een duur-/datumwijziging (GEEN kalenderwijziging, zie deze
 *  module se hoofddocblok "kalender"-paragraaf voor het waarom niet) zodra
 *  `timephasedDurationWalksHaveFrozenWork(task)` waar is (zie die functie hieronder en deze module
 *  se hoofddocblok hierboven voor het WAAROM). Zonder bevroren `workMinutes` blijft laag 4 met rust:
 *  die tak wandelt toch al de live `task.time.durationMinutes`, dus wissen zou alleen een gratis
 *  laag-4→laag-5-degradatie zijn zonder dat er iets stale was.
 *  Elk item in de lijst is een bevroren `{ anchor, resourceCalendarId, workMinutes? }`-snapshot per
 *  toewijzing uit de .mpp-import; een andere resource kan een andere resourcekalender betekenen (de
 *  laag-4-activeringsvoorwaarde), dus die lijst is sowieso stale zodra de toewijzingenset verandert.
 *  Na het wissen valt de taak terug op laag 5 (gewone CPM-duurberekening, geen Z8-venster) totdat
 *  een volgende .mpp-import de lijst opnieuw vult — er is geen "live herberekende" laag-4-vervanger.
 *  Retourneert `true` als er ECHT iets gewist is — zelfde reden/gebruik als `clearTimephasedWindow`
 *  hierboven (mpp-nul-data-etappe, bewerkmelding). */
export function clearTimephasedDurationWalks(task: Task): boolean {
  if (task.timephasedDurationWalks !== undefined) { delete task.timephasedDurationWalks; return true; }
  return false;
}

/**
 * Wist de door de nivelleerder ingevoegde werkonderbrekingen (`source === 'leveling'`) van `task` en
 * laat IMPORTSPLITS (gaten zonder `source`) staan — B1c-plan-2 taak 7, spec §4, "Herkomst"/
 * "Invalidatie". Geeft `true` terug wanneer er daadwerkelijk iets gewist is; zelfde contract als
 * `clearTimephasedWindow` hierboven (mpp-nul-data-etappe, bewerkmelding). Blijft er niets over, dan
 * wordt `splitGaps` op `undefined` gezet (niet op een lege array) — de golden rule van de
 * IFC-round-trip is "leeg/afwezig ⇒ niets geschreven".
 *
 * De AANROEPPLEKKEN (bewerkingen die de tijdbasis van een taak raken: duur, kalender, handmatige
 * datums, voortgang) zijn bedraad via `taskTriggerChanges(...).levelingGaps` hierboven — lees bij
 * `LEVELING_GAP_TIME_TRIGGERS` welke velden meetellen en waarom de set breder is dan die van het
 * Z8-venster.
 */
export function clearLevelingGaps(task: Task): boolean {
  const gaps = task.splitGaps;
  if (!gaps || gaps.length === 0) return false;
  const kept = gaps.filter(g => g.source !== 'leveling');
  if (kept.length === gaps.length) return false;
  task.splitGaps = kept.length > 0 ? kept : undefined;
  return true;
}

// ── Nivelleeruitvoer (B1c-plan-2/-plan3, M10) ────────────────────────────────────────────────────

/** Draagt `task` uitvoer van een nivellering: een vertraging — ook UITSLUITEND sub-dag-precisie
 *  (`levelingDelayMinutes`/`levelingDelayElapsed`, uit een `.mpp`) — of een ingevoegde pauzedag
 *  (`splitGaps` met `source: 'leveling'`)? De ENE definitie achter de no-op-guard van
 *  `clearLeveling`, de ribbonknop "Nivellering wissen", `planner_clear_leveling` en de
 *  verouderde-nivellering-waarschuwing van `planner_manage_resources` na een capaciteitswijziging
 *  (`resourceTools.ts`): een knop die inschakelt terwijl de actie een no-op is, of andersom, is
 *  precies de bug die B1c-plan3 taak 2 repareerde. */
export function hasLevelingOutput(task: Task): boolean {
  return task.levelingDelay !== undefined
    || task.levelingDelayMinutes !== undefined
    || task.levelingDelayElapsed !== undefined
    || (task.splitGaps ?? []).some(g => g.source === 'leveling');
}

/** Wist de sub-dag-velden die `CPMSolver.shiftByLevelingDelay` VÓÓR `levelingDelay` leest (M10:
 *  een achtergebleven waarde zou een nieuwe delay stil overrulen). `true` ⇒ er ging werkelijk
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
 * `applyLeveling` en de MCP-`draft.applyLeveling` (die twee mochten nooit uit elkaar lopen).
 * Idempotent: elke taak binnen de scope krijgt eerst haar delay uit `write.delays` (of geen), verliest
 * haar sub-dag-velden (M10) en krijgt `write.gaps[id]` als VOLLEDIGE gatenlijst (importsplits
 * inbegrepen); staat ze niet in `write.gaps`, dan gaan alleen de nivelleergaten van een vorige
 * nivellering weg. `scopeTaskIds` (B1c-plan3 taak 2): taken erbuiten zijn vaste last waarop het
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

/** De "duur/datums"-trigger (Z14b; ook de kalender in `updateTask`/`draft.updateTaskFields`/
 *  `patchTaskFields` en een splitbewerking): wis laag 3 altijd, en laag 4 alleen zodra een walk
 *  bevroren `workMinutes` draagt (N2 — zonder die bevroren waarde wandelt laag 4 al de live duur).
 *  Retourneert `true` als er MSP-sturing verloren ging. Welke bewerking de trigger raakt, beslist de
 *  aanroeper (`setTaskCalendar` wist bijvoorbeeld alleen laag 3). */
export function invalidateForTimeBaseChange(task: Task): boolean {
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = timephasedDurationWalksHaveFrozenWork(task) && clearTimephasedDurationWalks(task);
  return clearedWindow || clearedWalks;
}

/** De "toewijzingen"-trigger (zie de triggerset hierboven) voor één taak waarvan de
 *  toewijzingenset net veranderde: beide Z8-lagen ONVOORWAARDELIJK wissen (F2 — een andere resource
 *  kan een andere resourcekalender betekenen) plus de nivelleergaten (B1c-plan3 taak 3; geen
 *  melding, app-eigen afgeleide uitvoer). Retourneert `true` als er MSP-sturing verloren ging —
 *  alleen daarvoor meldt de aanroeper (mpp-nul-data-etappe, DEEL 1). */
export function invalidateForAssignmentChange(task: Task): boolean {
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = clearTimephasedDurationWalks(task);
  clearLevelingGaps(task);
  return clearedWindow || clearedWalks;
}

/** OPTIONEEL — TRUE zodra de taak nog ACTIEVE Z8-sturing draagt (laag 3 en/of laag 4): een gezet
 *  `timephasedFinishFloor`/`timephasedStartAnchor` (laag 3) of een niet-lege
 *  `timephasedDurationWalks` (laag 4). Bedoeld voor de eigenschappenpaneel-markering (mpp-nul-data-
 *  etappe, DEEL 2) — "volgt de urenverdeling uit MS Project" hoort hier, niet op de kale aanwezigheid
 *  van `timephasedContours` (dat is de rauwe bron, zie `taskHasTimephasedContours` hieronder). */
export function taskHasActiveTimephasedSteering(task: Task): boolean {
  return task.timephasedFinishFloor !== undefined
    || task.timephasedStartAnchor !== undefined
    || (task.timephasedDurationWalks?.length ?? 0) > 0;
}

/** OPTIONEEL — TRUE zodra de taak rauwe, uit een .mpp-import afkomstige contourperiodes draagt
 *  (`Task.timephasedContours`). Dit veld wordt NOOIT gewist door een edit (eigenaarsprincipe
 *  2026-08-18) — samen met `taskHasActiveTimephasedSteering` hierboven onderscheidt dit de twee
 *  paneel-toestanden (mpp-nul-data-etappe, DEEL 2): actieve sturing vs. een taak die zijn sturing
 *  ná een bewerking heeft losgelaten maar waarvan de bron nog altijd in het bestand staat. */
export function taskHasTimephasedContours(task: Task): boolean {
  return (task.timephasedContours?.length ?? 0) > 0;
}

/** N2 (Opus-her-check, tweede ronde) — TRUE zodra minstens één item in `timephasedDurationWalks`
 *  een gezette `workMinutes` draagt. `CPMSolver.ts`'s `timephasedFinish` gebruikt per item
 *  `walk.workMinutes ?? task.time.durationMinutes` — is `workMinutes` gezet, dan WINT die bevroren
 *  import-tijd-waarde altijd van een latere duur-/datumwijziging op de taak; die editie had zonder
 *  deze check dus zichtbaar GEEN effect op de berekende finish (de N2-bevinding). LET OP: toets
 *  hier NOOIT op `walks.length` — 19 corpustaken dragen een lijst van LENGTE 1 mét `workMinutes`
 *  (de MATERIAL-gefilterde >1-tak in `mppReader.ts`'s finalisatielus); de garantie "geen
 *  workMinutes" zit op de PRODUCERENDE tak, niet op de uiteindelijke array-lengte. Daarom toetst
 *  deze functie veld-aanwezigheid (`.some`). Een walk zónder `workMinutes` wandelt de live duur en
 *  blijft terecht ongemoeid door de aanroepers hieronder. */
export function timephasedDurationWalksHaveFrozenWork(task: Task): boolean {
  return (task.timephasedDurationWalks ?? []).some((w) => w.workMinutes !== undefined);
}

// ── Contour-engine (2026-09): herschaling bij een duurwijziging ──────────────────────────────────

/** `hoursPerDay` van de TAAKkalender (scalar uit de `WorkCalendar`, dezelfde bron als
 *  `CPMSolver.calendarFor`/`ResourceLoad.engineForTask`: `task.calendarId` → bibliotheek, anders
 *  de projectkalender). Voor de HERSCHALINGSFACTOR is de exacte waarde alleen relevant bij een
 *  eenheidswissel dagen↔uren (bij dagen↔dagen en uren↔uren valt hij tegen elkaar weg). */
export function taskCalendarHoursPerDay(task: Task, calendars: WorkCalendar[], projectCalendar: WorkCalendar): number {
  // Reviewronde G5 (2026-09-05): de EFFECTIEVE uren per dag — op een uurkalender uit de banden
  // afgeleid — zodat contourreferentie, werkdriehoek en raster dezelfde slot zien.
  return effHoursPerDay(resolveCalendar(task.calendarId, calendars, projectCalendar));
}

/** Werkduur van de taak in werkminuten (zie `contourEngine.ts`'s `taskWorkMinutes`) — aan te
 *  roepen VÓÓR een `mergeTaskTime`, zodat `rescaleTaskContours` de oude waarde kent. */
export function taskWorkMinutesOf(task: Task, hoursPerDay: number): number {
  return taskWorkMinutes(task.time, hoursPerDay);
}

/**
 * Contour-engine (2026-09) — de bewerkregel "een bewerking op een gecontourde taak neemt de
 * verdeling mee" (taaktypes-spec, "Wat er onder de motorkap nodig is" punt 3). Aan te roepen NÁ de
 * duurmutatie op een taak die `timephasedContours` draagt: herschaalt de contourperiodes én de
 * IMPORTsplits (`splitGaps` zonder `source`) proportioneel van `oldWorkMinutes` naar de nieuwe
 * werkduur van de taak, volgens `contourEngine.ts`'s `rescaleContourForDuration` (actual-periodes
 * blijven staan, FIXED_WORK houdt het werk vast). Idempotent: gelijke duur ⇒ niets gewijzigd.
 * Muteert `task` in-place (Immer-draft-stijl, zoals `clearTimephasedWindow`). Retourneert `true`
 * als er ECHT iets herschaald is.
 *
 * Bewust GEEN aanroep bij een datumverschuiving: de as is offset-gebaseerd (shift-invariant, zie
 * `TaskSplitGap`'s docblok), dus een verplaatsing kost geen herschaling. Een kalenderwissel die de
 * SLOT verandert (uren per dag) is sinds K2 (2026-09-05) wél een aanroeper — via
 * `workRuleApply.ts`'s `settleCalendarChange`: dezelfde dagen zijn dan een andere hoeveelheid
 * werkminuten, en de as leeft op werkminuten.
 *
 * `opts.keepGaps` (issue #146): sla de `rescaleSplitGaps`-stap over. `taskSlice.setTaskSplits`
 * schrijft de gatenlijst in dezelfde bewerking ZELF — die komt rechtstreeks uit het stukkenmodel en
 * is dus al op de nieuwe werkduur gerekend. Zonder deze vlag zou hij hier een tweede keer geschaald
 * worden (dubbele schaling, spec §2 stap 3).
 */
export function rescaleTaskContours(
  task: Task,
  oldWorkMinutes: number,
  hoursPerDay: number,
  // Taaktypes-etappe (2026-09, bouwstap 4): werkbehoud is een REGELkeuze (`workRuleApply.ts`'s
  // `contourKeepsWork`), niet langer alleen een MSP-herkomstvinkje. Zonder argument geldt de oude
  // afleiding, zodat elke bestaande aanroeper byte-identiek blijft.
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

// ── De gevolgregels van een duurwijziging (issue #146-vervolg) ───────────────────────────────────

/**
 * Wat een DUURWIJZIGING met de rest van de taak doet — de ENE definitie achter de drie schrijfroutes:
 * `taskSlice.updateTask` (eigenschappenpaneel, dialoog, Gantt, extensies), het taakraster
 * (`taskEditPlan.ts`: duur-, eenheid- en mijlpaalcel) en de MCP-draft (`createMcpTransactions.ts`:
 * `patchTaskFields`/`updateTaskFields`). Die routes SCHRIJVEN elk op hun eigen manier (Immer-draft,
 * losse taakkopie in een gridtransactie, MCP-draft met rollback), en dat mag zo blijven; de
 * GEVOLGEN staan alleen hier. Ze stonden eerder drie keer uitgeschreven ("tweelingen"), en toen de
 * splits-functie erbij kwam kreeg alleen `updateTask` de afknipregel — zie stap 2.
 *
 * Aan te roepen NÁ de duurmutatie, met de werkduur van VÓÓR de mutatie (`taskWorkMinutesOf`) en de
 * uren-per-dag waarmee die werd gemeten. De volgorde is betekenisvol:
 *  1. contour én importsplits proportioneel meeschalen (`rescaleTaskContours`);
 *  2. is er niets herschaald en KRIMPT het werk, dan vervallen gebruikersgaten op of voorbij het
 *     nieuwe werktotaal (`clipUserGapsToWork`, issue #146). Zonder contour schaalt niets de gaten
 *     mee; bleef zo'n gat liggen, dan was de lijst niet meer wélgevormd en werd de taak voor splits
 *     stilzwijgend ALLEEN-LEZEN — erger dan het gat laten vervallen. Importgaten en nivelleergaten
 *     volgen hun eigen levenscyclus. Staat vóór stap 4: de aspositie van een gebruikersgat telt de
 *     nivelleergaten ervóór mee (H1-as, `splitWalk.ts`);
 *  3. laag 3 (en laag 4 met bevroren werk) ontkoppelen (`invalidateForTimeBaseChange`, Z14b/N2);
 *  4. nivelleergaten wissen (`clearLevelingGaps`, B1c-plan3 taak 3) — importsplits blijven brondata.
 * Bij een gelijke werkduur doen stap 1 en 2 niets; stap 3 en 4 zijn idempotent.
 *
 * Retourneert `true` als er MSP-sturing verloren ging (voor de eenmalige melding, zie
 * `invalidateForTimeBaseChange`). WANNEER iets als duurwijziging telt, is een echte waardewijziging
 * (`taskTriggerChanges(...).timeBase`, nooit een alleen meegestuurde sleutel); wat een kalender-,
 * datum-, constraint- of voortgangswijziging daarnaast doet, beslist de aanroeper.
 *
 * `opts.rescaleContours: false` slaat stap 1 over (het raster doet dat bij een onbruikbare
 * uren-per-dag, zie `finishDurationEdit` in taskEditPlan.ts); stap 2 geldt dan zoals zonder contour.
 * `opts.keepWork` is het werkbehoud van de herschaling (`contourKeepsWork`, taaktypes-etappe);
 * afwezig ⇒ de oude afleiding van `rescaleTaskContours`.
 *
 * Integratie groep B × #170 (besluit 1): dit is de KERN van `settleDurationAftermath`
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
