import { Task, type TaskConstraint, type ExternalLink } from '@/types/task';
import type { EffectiveSchedulingOptions } from '@/types/project';
import { Sequence, LagUnit } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { calendarWithEffectiveWorkTime } from '@/utils/effectiveWorkTime';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import {
  parseDate, formatDate, parseInstant, utcDayStart, MS_PER_DAY, type DateMode,
} from '@/utils/dateUtils';
import {
  durationMinutesOf, elapsedMinutesOf, addElapsedMinutes, subtractElapsedMinutes,
  signedElapsedSpan, isZeroDurationMilestone, splitTotalSpanMinutes, splitTotalSpanDays,
  taskDurationUnit, writeDerivedSpan, isPinnedComplete, isPinnedInProgress, isElapsedTask,
} from './duration';
import { computeScheduleResults } from './scheduleAnalysis';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
import {
  explainP6CompletedDataDateWindowResolved,
  explainP6CompletedPhysicalPoint,
  type P6CompletedWindowDecision,
} from '@/engine/scheduler/p6CompletedTargetWindow';
import {
  explainBackwardActualPinEligibility,
  explainCompletedXerLoeActualFinishEligibilityResolved,
  explainP6CompletedLateRemainingWindowEligibilityResolved,
  type CpmBackwardActualPinDecision,
  type CpmDisplayActualLateDecision,
} from './p6CompletedRouteTrace';
import { explainOpenXerLoeTargetSpanEligibilityResolved } from './p6OpenLoeTargetSpanTrace';
import {
  forwardConstraint, forwardFinishFloor, backwardConstraint, MS_PER_MIN, type RelationDeps,
} from './relationMath';
import { isFiniteNumber } from '@/utils/guards';

export interface CPMResult {
  tasks: Map<string, CPMTaskResult>;
  criticalPath: string[];
  /** Optionele, niet-persistente XER-diagnose van de backward/float-beslissingen. */
  backwardFloatTrace?: CpmBackwardFloatTrace;
  /**
   * Optionele, niet-persistente XER-diagnose van de geplande-startvloer. Alleen gevuld voor
   * ingelezen P6-activiteiten waarvoor de bronoptie actief is en het volledige doelvenster
   * beschikbaar is. Dit zijspoor beschrijft de beslissing; het neemt er niet aan deel.
   */
  plannedFloorTraceByTaskId?: Readonly<Record<string, CPMPlannedFloorTrace>>;
  /**
   * Ids van driving relaties (P6-definitie): de door de relatie gegenereerde grens ís de
   * aangenomen early-datum van de opvolger (relationship free float = 0). Gelijkspel is
   * toegestaan — een opvolger kan meerdere driving voorgangers hebben. Rekenresultaat,
   * wordt bewust niet gepersisteerd (ook niet in IFC).
   */
  drivingSequenceIds: string[];
  /** Vrije speling per relatie (werkdagen tussen de geëiste en de werkelijke vroegste datum
   *  van de opvolger). 0 = driving. Basis voor de relatietabel. */
  sequenceFreeFloat: Record<string, number>;
  /** Relaties met een lead (negatieve lag) die door de projectstart-vloer is afgekapt: de lead
   *  wilde de opvolger vóór het projectbegin trekken en is dus niet volledig benut. */
  truncatedLeadSequenceIds: string[];
  /** Taken waarvan de late-zijde-constraint (SNLT/FNLT/MSO/MFO) door de logica wordt
   *  overschreden — de bron van hun negatieve float. */
  violatedConstraintTaskIds: string[];
  /** Taken waarvan de vroege finish voorbij de (zachte) deadline valt. */
  missedDeadlineTaskIds: string[];
  /** Relaties waarvan de opvolger progress/actuals heeft die de voorganger-logica tegenspreekt
   *  (out-of-sequence). Waarschuwing, geen fout — het gedrag volgt uit de progressMode. */
  outOfSequenceSequenceIds: string[];
  /** Near-critical-taken: 0 < tf ≤ drempel. Leeg als de drempel ongezet is. */
  nearCriticalTaskIds: string[];
  /** Alle kritieke ketens. ALTIJD aanwezig, lengte ≥1; `criticalPaths[0] ==
   *  criticalPath`. Staat `floatPaths` uit, dan is dit precies `[criticalPath]` — zo hoeven
   *  consumenten nooit op `undefined` te checken. */
  criticalPaths: string[][];
  /** Float-path-nummer per taak: 1 = meest kritiek. Leeg als `floatPaths` uit. */
  floatPathByTask: Record<string, number>;
  /** Hammocks zónder finish-driver (geen FF/SF-voorganger): hun EF valt terug op de ES
   *  (nul-lengte). Waarschuwingssignaal — de span kan niet uit een finish-driver worden afgeleid. */
  hammockNoFinishDriverTaskIds: string[];
  /** OPTIONEEL: taak-ids waarvan de earlyFinish-berekening tegen
   *  de MAX_SCAN/MAX_DAYS-cap van `addWorkDays` liep — een kalender die het taakvenster onwerkbaar
   *  maakt levert anders stil een onzin-datum. ZACHTE, niet-blokkerende waarschuwing: `error` blijft
   *  leeg, de overige taken rekenen normaal door. */
  cappedTaskIds?: string[];
  /** OPTIONEEL: relatie-id's die de solver heeft genegeerd omdat voorganger of opvolger geen
   *  bladtaak is in de meegegeven set. Relaties op een WBS-samenvattingstaak herschrijft
   *  `expandSummaryRelations` vooraf naar bladrelaties; wat hier landt is dus een écht verweesd id,
   *  of een aanroeper die die expansie oversloeg. Genegeerd i.p.v. gecrasht. */
  droppedSequenceIds?: string[];
  projectEnd: string;
  projectDuration: number; // work days
  /** Gezet als de solve niet kon rekenen (kring, kalender zonder werkdagen, ongeldige invoer). De
   *  vaste tekst die MCP-tools, extensies (`scheduleCalculated`) en logs al kennen — ongewijzigd,
   *  en deels Nederlands, deels Engels. Gebruikerszichtbare UI vertaalt `errorInfo` in plaats hiervan. */
  error?: string;
  /** Dezelfde fout als code + parameters: de UI vertaalt hem via `scheduleErrors.<code>`
   *  (`src/i18n/scheduleErrors.ts`). Altijd samen met `error` gezet door `solve()`. */
  errorInfo?: ScheduleErrorInfo;
  /** OPTIONEEL (waarschuwingenpaneel): de taak-ids van de gedetecteerde cyclus, in
   *  loopvolgorde — dezelfde ids waarvan `error` de namen noemt. Alleen gezet op het cyclus-pad;
   *  afwezig op elk ander pad, zodat een consument de cyclus kan
   *  navigeren/markeren in plaats van namen uit de foutstring te moeten parsen. */
  cycleTaskIds?: string[];
}

export type CpmProjectEndSource =
  | 'maxEarlyFinish'
  | 'completedDisplayWindow'
  | 'useProjectEndDateForFloat';

export type CpmLateFinishSource =
  | 'projectEnd'
  | 'successorConstraint'
  | 'completedRemainingWindow';

export type CpmLateStartSource =
  | 'subDuration'
  | 'subRemainingDuration'
  | 'completedRemainingWindow';

export type CpmFreeFloatSource =
  | 'derivedFromSuccessor'
  | 'projectEndFinishMilestoneBoundary'
  | 'clampedZero';

export interface CpmTaskBackwardFloatTrace {
  lateFinishSource: CpmLateFinishSource;
  lateStartSource: CpmLateStartSource;
  freeFloatSource: CpmFreeFloatSource;
  displayActualLate: boolean;
  completedWindow: P6CompletedWindowDecision;
  backwardActualPin: CpmBackwardActualPinDecision;
  displayActualLateDecision: CpmDisplayActualLateDecision;
}

export interface CpmBackwardFloatTrace {
  projectEndSource: CpmProjectEndSource;
  byTaskId: Record<string, CpmTaskBackwardFloatTrace>;
}

export interface CPMPlannedFloorTrace {
  preFloorEarlyStart: string;
  preFloorEarlyFinish: string;
  targetStart: string;
  targetFinish: string;
  plannedWindowIsLater: boolean;
  /** Of de vloer daadwerkelijk is toegepast: `plannedWindowIsLater` en niet overruled door C8
   *  (`p6StartedTaskIgnoresPlannedStartFloor`, lopende taak). */
  floorApplied: boolean;
  boundarySource: 'project-start' | 'relationship' | 'relationship:p6-predecessor-finish-boundary';
  boundarySequenceId?: string;
  boundaryPredecessorTaskCode?: string;
}

/** Voortgangs-opties. Leeg ⇒ geen statusdatum-gedrag. */
export interface CPMOptions {
  dataDate?: string;                                     // ISO date; undefined ⇒ geen statusdatum-gedrag
  progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE'; // default RETAINED_LOGIC
  /** Rekenprofielen: verplicht en uitsluitend het opgeloste type. Aanroepers komen
   *  hier via `solveOptionsFor`/`solveInputFor` (`solveInput.ts`) of `effectiveSchedulingOptions`. */
  schedulingOptions: EffectiveSchedulingOptions;
  /** De geconfigureerde PROJECTSTARTDATUM (`Project.startDate`, ISO-datum): ondergrens voor de
   *  early-start-berekening van ELKE taak MET voorganger (en hammocks) — niet alleen tegen leads:
   *  ook een gewone FS/FF-relatie met lag 0 van een vroege wortel-taak wordt hier gevloerd. Alleen
   *  de gebruikerszichtbare markering (`truncatedLeadIds`, "afgekapte lead") is lead-specifiek.
   *  Afwezig/onparseerbaar ⇒ "de projectstart" is het minimum van de wortel-taken onderling.
   *
   *  Een taak ZONDER voorganger klemt deze optie NIET: die gebruikt altijd haar eigen
   *  `scheduleStart` (`ownAnchor`), ook vóór de projectstart — "een ingelezen anker wordt nooit door
   *  de vloer overruled". Zie de docstrings van `rootFloor`/`ownAnchor`. */
  projectStartDate?: string;
  /** Geconfigureerde projecteinddatum. Alleen actief wanneer de brongebonden
   *  `useProjectEndDateForFloat`-optie aan staat; anders blijft max(EF) leidend. Leeg of
   *  onparseerbaar mét de optie ⇒ exact het netwerkeinde (zie `withEffectiveProjectEndAnchor`). */
  projectEndDate?: string;
}

/**
 * `useProjectEndDateForFloat` zonder bruikbare projecteinddatum is een no-op: de late pass
 * verankert dan op het netwerkeinde, max(EF) — precies wat P6 doet wanneer "Must Finish By" leeg
 * is (Oracle P6 Help, *Schedule Options → Compute Total Float As / Calculate float based on finish
 * date of*: zonder projecteinddatum is het laatste (vroege) activiteiteneinde de basis).
 *
 * De optie stuurt naast het anker zelf nog drie takken (de open-finishmijlpaalgrens hier en in
 * `scheduleAnalysis`, en de FF=0-klem van een eindmijlpaal). Zonder datum mogen die níét anders
 * lopen dan met de optie uit, anders is "netwerkeinde" alleen op het anker waar. Daarom normaliseert
 * de solver op één plek: optie aan + geen geldige datum ⇒ de optie geldt als uit. Met een geldige
 * datum of met de optie uit blijft `options` hetzelfde object.
 */
export function withEffectiveProjectEndAnchor(options: CPMOptions): CPMOptions {
  const so = options.schedulingOptions;
  if (so?.useProjectEndDateForFloat !== true) return options;
  if (!isNaN(parseInstant(options.projectEndDate ?? '').getTime())) return options;
  return { ...options, schedulingOptions: { ...so, useProjectEndDateForFloat: false } };
}

/**
 * Eerste geldige werk-instant OP-of-NÁ `from`, in `eng` (dag ⇒ `nextWorkDay`, uur ⇒
 * `nextWorkInstant`). Top-level EXPORT zodat zowel de solver zélf (`ownAnchor`/`rootFloor`, via de
 * instance-tunnel `snapOnOrAfter`) als `projectStartAnchorClamp.ts` (de projectstartklem, vanuit
 * `projectSlice.setProject` én `mcpTransaction.ts`'s `draft.setProject`) EXACT dezelfde anker-snap
 * gebruiken — een kale datumstring zonder kalender-snap landt in uurmodus op middernacht i.p.v. de
 * eerste werkband. Puur, geen instantie-state.
 */
export function snapWorkInstantOnOrAfter(eng: CalendarEngine, from: Date): Date {
  return eng.isHourMode ? eng.nextWorkInstant(from) : eng.nextWorkDay(from);
}

/**
 * DE kalenderkeuze voor de engine waarin `task` rekent, op de al opgeloste kalender `cal` (de
 * taakkalender via `resolveCalendar`, of bij een resourcekalender-wandeling die van de resource).
 * Top-level EXPORT met dezelfde reden als `snapWorkInstantOnOrAfter` hierboven: de solver
 * (`calendarFor` en de wandelingen, via de instance-tunnel `engineForCal`) én
 * `projectStartAnchorClamp.ts` (de projectstartklem) gebruiken deze ene functie, zodat de klem een anker
 * in exact de engine snapt waarin de solver het daarna leest.
 *
 * Regel: een URENtaak (`taskDurationUnit(task) === 'hours'`) rekent in de EFFECTIEVE uurbanden van
 * `cal` (`calendarWithEffectiveWorkTime`). Een scalaire kalender zonder `workTime` — zoals de
 * standaardprojectkalender — krijgt die banden alléén in deze afgeleide engine; valt er niets af te
 * leiden, dan blijft het `cal` zelf. Een DAGtaak rekent in `cal` zelf. De persistente kalender en
 * alle dagtaken blijven dus ongewijzigd daggranulair.
 *
 * `cache` is van de aanroeper (vers per berekening). De sleutel draagt het uur-/dagonderscheid
 * (`<id>` tegenover `<id>\0effective-hour`), zodat een uur- en een dagengine op dezelfde kalender
 * elkaar nooit lekken; de effectieve kalender wordt pas bij een cache-miss afgeleid.
 */
export function engineForTaskCalendar(
  cache: Map<string, CalendarEngine>,
  cal: WorkCalendar,
  task: Task,
): CalendarEngine {
  const effectiveHourBands = taskDurationUnit(task) === 'hours';
  const key = effectiveHourBands ? `${cal.id}\u0000effective-hour` : cal.id;
  let e = cache.get(key);
  if (!e) {
    const engineCalendar = effectiveHourBands ? calendarWithEffectiveWorkTime(cal) : cal;
    e = new CalendarEngine(engineCalendar ?? cal);
    cache.set(key, e);
  }
  return e;
}

/**
 * Effectieve lag in dagen van een relatie: procent-lag wordt uit de ACTUELE voorgangerduur
 * opgelost (MSP-semantiek, afgerond op hele dagen), anders geldt lagDays. Gedeeld met de UI
 * (relatietabel-waarschuwingen) zodat er één definitie bestaat.
 *
 * `hoursPerDay` (optioneel) = de dag↔minuut-factor van de kalender waarin de lag telt —
 * de lag-kalender voor WORKTIME (`schedulingOptions.lagCalendar`, default de VOORGANGER-kalender),
 * 24 voor ELAPSEDTIME. Alleen
 * mét die factor kan een lag die uitsluitend als `lagMinutes` bestaat (`lagDays = 0`) in DAGEN
 * uitgedrukt worden. Zonder de factor (UI-aanroepers) telt alleen `lagDays`.
 */
export function resolveEffectiveLagDays(seq: Sequence, predTask: Task, hoursPerDay?: number): number {
  if (isFiniteNumber(seq.lagPercent)) {
    const predDur = isZeroDurationMilestone(predTask) ? 0 : predTask.time.scheduleDuration;
    return Math.round((predDur * seq.lagPercent) / 100);
  }
  const days = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  // Minuut-lag ZONDER dag-lag. `p6xmlReader`/`mspdiReader` schrijven `lagDays: 0` +
  // `lagMinutes` zodra de OPVOLGER in uur-modus staat, terwijl de solver de lag in de VOORGANGER-
  // kalender oplost. Bij een DAG-voorganger viel de lag daardoor stil weg (exact lag 0, forward én
  // backward) — stil dataverlies op een reëel importpad. Reken hem om naar hele dagen met de
  // meegegeven factor; half rondt van nul af, zodat een lead (negatief) symmetrisch behandeld wordt.
  // `lagDays ≠ 0` blijft leidend: het IFC-pad vult beide velden (`parseDurationDays` rondt `PT4H`
  // naar boven op 1 dag).
  if (
    days === 0 && typeof hoursPerDay === 'number' && hoursPerDay > 0 &&
    isFiniteNumber(seq.lagMinutes) && seq.lagMinutes !== 0
  ) {
    const raw = seq.lagMinutes / (hoursPerDay * 60);
    return Math.sign(raw) * Math.round(Math.abs(raw));
  }
  return days;
}

export interface CPMTaskResult {
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
  /** OPTIONEEL — interfererende speling = totalFloat − freeFloat. Alleen
   *  geschreven wanneer de analyse-laag draait. */
  interferingFloat?: number;
  /** OPTIONEEL — near-critical. Alleen geschreven bij ingestelde drempel. */
  isNearCritical?: boolean;
  /** OPTIONEEL — float-path-nummer. Alleen geschreven bij floatPaths. */
  floatPath?: number;
}

const TWENTY_FOUR_HOUR_LAG_CALENDAR: WorkCalendar = {
  id: 'ops-p6-24hour-lag',
  name: '24 uur',
  description: 'Interne P6-relatielagkalender',
  workDays: [1, 2, 3, 4, 5, 6, 7],
  workStartHour: 0,
  workEndHour: 24,
  hoursPerDay: 24,
  holidays: [],
  workTime: {
    byWeekday: {
      1: [{ start: 0, end: 1440 }],
      2: [{ start: 0, end: 1440 }],
      3: [{ start: 0, end: 1440 }],
      4: [{ start: 0, end: 1440 }],
      5: [{ start: 0, end: 1440 }],
      6: [{ start: 0, end: 1440 }],
      7: [{ start: 0, end: 1440 }],
    },
  },
};

/** Waarom een solve niet kon rekenen — één code per guard in `solve()`. */
export type ScheduleErrorCode =
  | 'cycle'
  | 'noWorkingDays'
  | 'invalidDayDuration'
  | 'invalidHourDuration'
  | 'hourTaskWithoutWorkHours'
  | 'invalidStartDate';

/** Solverfout als code + parameters; de vertaling hoort in de UI-laag, niet in de solver. */
export interface ScheduleErrorInfo {
  code: ScheduleErrorCode;
  /** De betrokken taak (alle codes behalve `cycle` en `noWorkingDays`). */
  taskName?: string;
  /** Alleen `cycle`: de taaknamen van de kring in loopvolgorde; de eerste staat ook achteraan. */
  cycleNames?: string[];
}

/** De vaste `error`-tekst per code (MCP en extensies lezen hem letterlijk; `mapTransactionError` herkent een kring aan "Circular dependency"). */
function scheduleErrorLegacyText(info: ScheduleErrorInfo): string {
  const name = info.taskName ?? '';
  switch (info.code) {
    case 'cycle': return `Circular dependency detected: ${(info.cycleNames ?? []).join(' -> ')}`;
    case 'noWorkingDays': return 'Kalender heeft geen werkdagen ingesteld';
    case 'invalidDayDuration': return `Ongeldige dagduur voor taak "${name}"`;
    case 'invalidHourDuration': return `Ongeldige urenduur voor taak "${name}"`;
    case 'hourTaskWithoutWorkHours': return `Uurtaak "${name}" heeft geen geldige werktijden in zijn kalender`;
    case 'invalidStartDate': return `Ongeldige startdatum voor taak "${name}"`;
  }
}

/**
 * Leeg `CPMResult` voor de degradatiepaden in `solve()` (cyclus, kalender zonder werkdagen,
 * ongeldige duur, urentaak zonder werktijden, onparseerbare startdatum): alle verzamelingen leeg,
 * alleen de fout verschilt per pad. Eén fabriek zodat de guards nooit kunnen divergeren.
 */
function emptyResult(errorInfo: ScheduleErrorInfo, cycleTaskIds?: string[]): CPMResult {
  return {
    tasks: new Map(),
    criticalPath: [],
    drivingSequenceIds: [],
    sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [],
    violatedConstraintTaskIds: [],
    missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [],
    nearCriticalTaskIds: [],
    criticalPaths: [[]],
    floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [],
    projectEnd: '',
    projectDuration: 0,
    error: scheduleErrorLegacyText(errorInfo),
    errorInfo,
    ...(cycleTaskIds ? { cycleTaskIds } : {}),
  };
}

export class CPMSolver {
  private tasks: Map<string, Task>;
  private sequences: Sequence[];
  // Per-taak-kalender: de projectdefault-engine voor project-brede grenslogica,
  // plus een cache van engines per bibliotheek-kalender. `calendarFor(task)` levert de engine waarin
  // de duur/constraints/float van díé taak rekenen; zonder afwijkende `task.calendarId` valt alles
  // terug op `projectEngine`.
  private projectCal: WorkCalendar;
  private registry: WorkCalendar[];
  private projectEngine: CalendarEngine;
  private readonly twentyFourHourLagEngine = new CalendarEngine(TWENTY_FOUR_HOUR_LAG_CALENDAR);
  private engineCache = new Map<string, CalendarEngine>();

  // Adjacency lists
  private successors: Map<string, Sequence[]>; // taskId -> outgoing sequences
  private predecessors: Map<string, Sequence[]>; // taskId -> incoming sequences

  // Per relatie de in de forward-pass gegenereerde (ruwe) vroegst-toegestane start van de
  // opvolger, vóór de projectstart-vloer en de werkdag-snap. Eén bron van waarheid voor
  // vrije speling én driving-markering, ongeacht lag-eenheid.
  private seqConstraint: Map<string, Date> = new Map();
  /** Conventie C4: begin (ES) van het naar achteren geschoven nul-restvenster per voltooide taak
   *  buiten volgorde. Alleen gevuld als het venster ná het statusdatumvenster ligt. */
  private completedOutOfSequenceEs: Map<string, Date> = new Map();
  /** Conventie C4: het relatie-instant van dat venster (de grens op de kalender van de voorganger). */
  private completedOutOfSequenceRelation: Map<string, { at: Date; eng: CalendarEngine }> = new Map();
  /** Conventie C5: het ene punt (ES = EF) van een voltooide CP_Phys-activiteit, forward bepaald. */
  private completedPhysicalPoints: Map<string, Date> = new Map();
  // Relaties waarvan de lead in de forward-pass door de projectstart-vloer is afgekapt.
  private truncatedLeadIds: string[] = [];
  // Taken met een harde MSO/MFO-pin waarvan de voorganger-druk (`rawMax`) later
  // valt dan de pin ⇒ de logica is gebroken (taak start vóór z'n voorganger klaar is). Verzameld in
  // de forward pass, samengevoegd met `violatedConstraintTaskIds` in `computeResults`.
  private hardPinViolatedIds: string[] = [];
  // Hammocks zónder finish-driver: EF valt terug op ES (nul-lengte). Verzameld in de
  // forward pass, gerapporteerd als waarschuwing in `hammockNoFinishDriverTaskIds`.
  private hammockNoFinishDriverIds: string[] = [];
  // Taken waarvan de earlyFinish-berekening tegen de MAX_SCAN/MAX_DAYS-cap van `addWorkDays` liep:
  // een onwerkbaar taakvenster (bv. een aaneengesloten holiday-
  // blok). Verzameld in de forward pass, zacht gerapporteerd als `cappedTaskIds`. Geen error, geen
  // rollback — de kalenderwijziging is legitiem; de waarschuwing wijst de te repareren taak aan.
  private cappedTaskIds: string[] = [];
  // Test-/replaydiagnose van de P6-planned-floor-beslissing. Nooit teruggeschreven naar Task/IFC.
  private plannedFloorTraceByTaskId: Record<string, CPMPlannedFloorTrace> = {};
  // Test-/replaydiagnose van completed backward/float-bronnen. Alleen XER, nooit Task/IFC.
  private backwardFloatTrace: CpmBackwardFloatTrace | undefined;

  private options: CPMOptions;
  // Werkdag-gesnapte statusdatum, of null ⇒ geen statusdatum-gedrag. Gezet in solve().
  private dataDate: Date | null = null;
  /** De statusdatum zoals opgegeven, NIET gesnapt op de projectkalender (conventie C5: het punt van een
   *  voltooide CP_Phys-activiteit ligt in P6 op dit rauwe instant, ook buiten de werktijd). */
  private rawDataDate: Date | null = null;
  // RUWE (ongesnapte) geconfigureerde projectstartdatum, of null ⇒ geen ondergrens-gedrag. Ongesnapt omdat elke wortel-taak 'm in zíjn EIGEN kalender snapt
  // (`rootFloor`) — een taak op een kalender met een afwijkende werkweek mag de vloer dus op een
  // andere dag landen dan de projectkalender zelf zou geven. Gezet in solve().
  private projectStartRaw: Date | null = null;
  // Relaties waarvan voorganger- of opvolger-id niet in `this.tasks` zit — genegeerd bij de
  // constructie (zie de guard hieronder). Constant per instance (afgeleid uit de constructor-
  // input), dus NIET onderdeel van de idempotentie-reset in solve().
  private readonly droppedSequenceIds: string[];
  /** Opvolgers van een door de XER-reader bewezen gedeelde FS-finish/startgrens. Afgeleid uit de
   *  relaties bij iedere solve; andere formaten hebben geen vlag en blijven volledig onaangeraakt. */
  private readonly p6FinishBoundaryStartTaskIds: Set<string>;
  // Dedup-sleutel voor de dropped-relaties-waarschuwing hieronder, STATIC (gedeeld
  // over alle instanties) — `ResourceLeveler` bouwt binnen één nivelleeraanroep O(taken) solvers,
  // typisch allemaal met DEZELFDE gedropte relatieset (die hangt af van welke taak-ids bestaan, niet
  // van de per-kandidaat `levelingDelay`-varianten die tussen die constructies verschillen). Zonder
  // dedup logt dat de identieke waarschuwing tientallen tot honderden keren per nivellering. Een
  // ECHTE wijziging in de gedropte set (ander document, andere relaties) logt gewoon opnieuw.
  private static lastDroppedWarningSignature: string | null = null;

  constructor(
    tasks: Task[],
    sequences: Sequence[],
    projectCalendar: WorkCalendar,
    registry: WorkCalendar[] = [],
    options: CPMOptions,
  ) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));

    // Guard: de aanroepers geven alleen semantische BLADTAKEN mee — een samenvattingstaak krijgt
    // haar datums via de rollup in `applyCpmResult`, niet als eigen CPM-knoop. `sequences` kan een
    // taak-id bevatten dat niet in `this.tasks` zit; zo'n fantoom-id zou de topologische sortering in
    // gaan (`topologicalSort` telt `inDegree` voor élke `successorId`) en de forward/backward pass
    // laten crashen op een `this.tasks.get(id)!` — een throw die `openFile`s catch opslokt, zodat de
    // planning stil onberekend blijft.
    //
    // Semantiek: zo'n relatie wordt genegeerd i.p.v. de solver te laten crashen. Dit is het VANGNET
    // voor écht verweesde/ongeldige taak-ids: de reguliere aanroepers (o.a. `solveProject`,
    // `benchmark/runner.ts`) herschrijven een relatie op een WBS-samenvattingstaak al via
    // `expandSummaryRelations` naar bladrelaties. Wie die expansie overslaat (bv. een test direct
    // tegen de solver), krijgt droppen i.p.v. crashen.
    const kept: Sequence[] = [];
    const dropped: string[] = [];
    for (const seq of sequences) {
      if (this.tasks.has(seq.predecessorId) && this.tasks.has(seq.successorId)) {
        kept.push(seq);
      } else {
        dropped.push(seq.id);
      }
    }
    // Conventie B1 `p6RelationFinishBoundary`. RelationMath en alle solverpaden zien uitsluitend deze
    // effectieve relaties: staat de conventie niet aan, dan wordt de relatievlag
    // `p6StartAtPredecessorFinishBoundary` gestript, zodat een LOSSE relatievlag geen P6-gedrag kan
    // activeren. Dit is geen bescherming tegen een vervalst projectbestand: de vlag round-tript
    // bewust door het `OPS_SchedulingProfile`-pset, dus wie een IFC met de conventie aan opent,
    // kiest daarmee voor die P6-semantiek.
    const schedulingOptions = options.schedulingOptions;
    this.sequences = schedulingOptions?.p6RelationFinishBoundary === true
      ? kept
      : kept.map(sequence => sequence.p6StartAtPredecessorFinishBoundary === true
        ? { ...sequence, p6StartAtPredecessorFinishBoundary: undefined }
        : sequence);
    this.droppedSequenceIds = dropped;
    this.p6FinishBoundaryStartTaskIds = new Set(
      this.sequences.filter(sequence => sequence.p6StartAtPredecessorFinishBoundary === true)
        .map(sequence => sequence.successorId),
    );
    if (dropped.length > 0) {
      // Alleen loggen als de gedropte SET (niet de instantie) daadwerkelijk is veranderd sinds
      // de vorige constructie — zie de toelichting bij `lastDroppedWarningSignature`.
      const signature = [...dropped].sort().join(',');
      if (signature !== CPMSolver.lastDroppedWarningSignature) {
        CPMSolver.lastDroppedWarningSignature = signature;
        console.warn(
          `CPMSolver: ${dropped.length} relatie(s) genegeerd omdat voorganger of opvolger geen ` +
          'bladtaak is in de meegegeven set (verweesd/ongeldig taak-id, of een aanroeper die ' +
          `expandSummaryRelations niet gebruikt). Relatie-id's: ${dropped.join(', ')}.`,
        );
      }
    }

    this.projectCal = projectCalendar;
    this.registry = registry;
    this.projectEngine = new CalendarEngine(projectCalendar);
    this.engineCache.set(projectCalendar.id, this.projectEngine);
    this.options = withEffectiveProjectEndAnchor(options);
    this.successors = new Map();
    this.predecessors = new Map();

    for (const task of tasks) {
      this.successors.set(task.id, []);
      this.predecessors.set(task.id, []);
    }
    for (const seq of this.sequences) {
      this.successors.get(seq.predecessorId)?.push(seq);
      this.predecessors.get(seq.successorId)?.push(seq);
    }
  }

  /**
   * Engine voor `task` op een concrete kalender. Instance-tunnel naar de gedeelde
   * `engineForTaskCalendar` (top-level, zie daar de uur-/dagregel en de cache-sleutel) op deze
   * solver-cache — die de constructor al met de projectengine onder `projectCal.id` vult.
   */
  private engineForCal(cal: WorkCalendar, task: Task): CalendarEngine {
    return engineForTaskCalendar(this.engineCache, cal, task);
  }

  /** De kalender-engine waarin de duur/constraints/float van `task` rekenen. */
  private calendarFor(task: Task): CalendarEngine {
    return this.engineForCal(resolveCalendar(task.calendarId, this.registry, this.projectCal), task);
  }

  private p6CompletedDataDateWindowDecision(task: Task): P6CompletedWindowDecision {
    return explainP6CompletedDataDateWindowResolved(task, this.dataDate, this.options.schedulingOptions);
  }

  /**
   * Conventie C1 `p6CompletedPredecessorAtDataDate` (docblok + bron bij de sleutel in
   * `types/project.ts`): het venster waarmee een VOLTOOIDE voorganger zijn opvolgers vasthoudt. Een
   * werkelijk einde ná de statusdatum telt voor de relatiegrens als de werkgrens vlak vóór de
   * statusdatum op de voortgangskalender (dezelfde grens als het B3-statusdatumvenster). Alleen het
   * einde wordt begrensd: FS/FF lezen `ef`; SS/SF (`es`) blijven ongemoeid. Conventie uit, geen
   * statusdatum, dagmodus, niet voltooid of einde op/vóór die grens ⇒ exact `window` (dezelfde
   * referentie).
   */
  private completedPredecessorRelationWindow(
    predTask: Task,
    window: { es: Date; ef: Date },
  ): { es: Date; ef: Date } {
    // C4: een nul-restvenster buiten volgorde is voor de relatie één instant (ES = EF): de grens
    // die zijn eigen maatgevende voorganger oplegde, op de kalender van díe voorganger — niet het
    // op de eigen kalender gesnapte vensterbegin. Gemeten (rehab-2): V3163130 (kal. 842, venster
    // 10-11) → V3163135 (kal. 893) start in P6 op 09-29 08:00, direct na de voorganger-EF 09-28;
    // V3119130 → V3119135 op 09-13 08:00, direct na de voorganger-EF 09-12.
    const outOfSequenceRelation = this.completedOutOfSequenceRelation.get(predTask.id);
    if (outOfSequenceRelation) return { es: outOfSequenceRelation.at, ef: outOfSequenceRelation.at };
    // C5: het punt van een voltooide CP_Phys-voorganger ligt al op of ná de statusdatum en is zelf de
    // relatiegrens; de C1-klem (die een werkelijk einde terugzet) geldt daar niet.
    if (this.completedPhysicalPoints.has(predTask.id)) return window;
    if (this.options.schedulingOptions?.p6CompletedPredecessorAtDataDate !== true) return window;
    if (this.dataDate === null) return window;
    const t = predTask.time;
    if (!(t.actualFinish && t.completion >= 1)) return window;
    const progressCal = this.progressCalendarFor(predTask);
    // Instantgrens: alleen uurmodus (P6-kalenders zijn altijd uurprecies); dagmodus ongewijzigd.
    if (!progressCal.isHourMode) return window;
    const cap = progressCal.prevWorkInstant(this.snapOnOrAfter(progressCal, this.dataDate));
    if (Number.isNaN(cap.getTime()) || window.ef <= cap) return window;
    return { es: window.es, ef: cap };
  }

  /**
   * Conventie C4, relatiekant: uit een voltooide voorganger met een verschoven nul-restvenster telt
   * van een positieve lag alleen het deel dat op de statusdatum nog niet verstreken is — dezelfde
   * rekenregel als C3 (`completedRemainingLagSeq`, en alleen als C3 aan staat), nu voorwaarts.
   * Gemeten: rehab-2 V3117150 → V3117160 (FS+8 h, werkelijk einde 04-03) en V3229080 → V3229090
   * (FS+16 h): P6 start de opvolger op het vensterbegin zelf. Geen verschoven venster ⇒ `seq` zelf.
   */
  /** De kalender waarin een relatie uit `predTask` rekent: bij een C4-venster de kalender van zijn
   *  relatie-instant (een nul-restvenster heeft geen eigen werktijd), anders zijn eigen kalender. */
  private relationEngineFor(predTask: Task): CalendarEngine {
    return this.completedOutOfSequenceRelation.get(predTask.id)?.eng ?? this.calendarFor(predTask);
  }

  private completedOutOfSequenceRelationSeq(predTask: Task, seq: Sequence, succCal: CalendarEngine): Sequence {
    // C5 deelt deze regel: uit het punt van een voltooide CP_Phys-voorganger telt alleen de nog niet
    // verstreken lag (Roads A15087 → A15089, SS+30 h: P6 start de opvolger direct na het punt).
    if (!this.completedOutOfSequenceEs.has(predTask.id) && !this.completedPhysicalPoints.has(predTask.id)) return seq;
    const lagEng = this.relDeps.lagEngine(this.relationEngineFor(predTask), succCal);
    return this.completedRemainingLagSeq(seq, predTask, lagEng);
  }

  /**
   * Conventie C5 `p6CompletedPhysicalAtDataDate` (docblok + bron bij de sleutel in `types/project.ts`):
   * het ene punt (ES = EF) van een voltooide CP_Phys-activiteit. Begint op het RAUWE statusdatum-
   * instant (niet gesnapt) en schuift naar de laatste rauwe relatiegrens uit een voorganger die zelf
   * nog niet klaar is (FS/FF: zijn EF, SS/SF: zijn ES, plus de volle lag met een finishgrens — niet
   * naar de volgende werkstart) of uit een voorganger die zelf zo'n punt heeft (plus alleen de nog
   * niet verstreken lag, rekenregel C3). Een gewone voltooide voorganger is historie en telt niet.
   * Poort: `explainP6CompletedPhysicalPoint`; uurmodus vereist (P6-kalenders zijn uurprecies).
   */
  private recordCompletedPhysicalPoint(
    task: Task,
    preds: Sequence[],
    results: Map<string, { es: Date; ef: Date }>,
    progressCal: CalendarEngine,
  ): Date | null {
    if (this.dataDate === null || this.rawDataDate === null || !progressCal.isHourMode) return null;
    if (!explainP6CompletedPhysicalPoint(task, this.rawDataDate, this.options.schedulingOptions).eligible) return null;
    let point = new Date(this.rawDataDate.getTime());
    for (const seq of preds) {
      const predTask = this.tasks.get(seq.predecessorId);
      const predResult = results.get(seq.predecessorId);
      if (!predTask || !predResult || predTask.isHammock) continue;
      const predPoint = this.completedPhysicalPoints.get(predTask.id);
      if (!predPoint && predTask.time.completion >= 1) continue;
      const predEng = this.calendarFor(predTask);
      const lagEng = this.relDeps.lagEngine(predEng, progressCal);
      const relSeq = predPoint
        ? this.completedRemainingLagSeq(seq, predTask, lagEng)
        : this.inProgressStartLagSeq(predTask, seq, lagEng);
      const fromStart = seq.type === 'START_START' || seq.type === 'START_FINISH';
      const anchorResult = predPoint ? predResult : this.inProgressStartLagAnchor(predTask, seq, lagEng, predResult);
      const anchor = predPoint ?? (fromStart ? anchorResult.es : anchorResult.ef);
      const bound = this.physicalPointLag(anchor, relSeq, predTask, lagEng, 1);
      if (Number.isNaN(bound.getTime())) continue;
      if (bound > point) point = bound;
    }
    this.completedPhysicalPoints.set(task.id, point);
    return point;
  }

  /**
   * Conventie C6 `p6InProgressStartLagElapsed` (docblok + bron bij de sleutel in `types/project.ts`):
   * van een positieve WORKTIME-lag op een SS-relatie uit een LOPENDE voorganger (werkelijke start,
   * niet voltooid) telt voorwaarts alleen het deel dat op de statusdatum nog niet verstreken is sinds
   * die werkelijke start: `max(0, lag − werktijd(werkelijke start → statusdatum))` in de lag-kalender.
   * Alleen met A19 (de ES van een lopende taak is dan haar restwerkstart). Conventie uit, geen
   * statusdatum, dagmodus, ander relatietype, ELAPSEDTIME- of niet-positieve lag ⇒ `seq` zelf.
   */
  private inProgressStartLagSeq(predTask: Task, seq: Sequence, lagEng: CalendarEngine): Sequence {
    const lag = this.inProgressStartLag(predTask, seq, lagEng);
    if (!lag || lag.remaining === lag.lagMinutes) return seq;
    const remaining = lag.remaining;
    return { ...seq, lagMinutes: remaining, lagDays: remaining / (lagEng.hoursPerDay * 60), lagPercent: undefined };
  }

  /** De C6-poort en de rest-lag, gedeeld door `inProgressStartLagSeq` en `inProgressStartLagAnchor`:
   *  `null` ⇒ C6 geldt niet voor deze relatie (zie het docblok van `inProgressStartLagSeq`). */
  private inProgressStartLag(
    predTask: Task, seq: Sequence, lagEng: CalendarEngine,
  ): { lagMinutes: number; remaining: number } | null {
    const so = this.options.schedulingOptions;
    if (so?.p6InProgressStartLagElapsed !== true || so.p6UseRemainingStartForProgress !== true) return null;
    if (seq.type !== 'START_START' || this.dataDate === null || !lagEng.isHourMode) return null;
    if (seq.lagUnit === 'ELAPSEDTIME') return null;
    const t = predTask.time;
    if (!t.actualStart || t.completion >= 1) return null;
    const lagMinutes = this.resolveLagMinutes(seq, predTask, lagEng);
    if (!(lagMinutes > 0)) return null;
    const actualStart = this.parseIn(lagEng, t.actualStart);
    if (Number.isNaN(actualStart.getTime()) || actualStart >= this.dataDate) return null;
    const remaining = Math.max(0, lagMinutes - lagEng.workMinutesBetween(actualStart, this.dataDate));
    return { lagMinutes, remaining };
  }

  /**
   * Projectoptie `startToStartLagFrom` (P6 "Calculate Start-to-Start lag from", docblok bij de sleutel
   * in `types/project.ts`): de variant van C6, VOORWAARTS. `'actualStart'` ankert de rest-lag van een
   * SS-relatie uit een lopende voorganger op de STATUSDATUM in plaats van op diens restwerkstart ("the
   * data date plus any remaining lag"). Zelfde poort als C6 (`inProgressStartLag`); optie afwezig of
   * `'earlyStart'`, of C6 geldt niet ⇒ `predResult` zelf. Late kant, spiegel: bij `'actualStart'` (en
   * geldende C6-poort) begrenst de relatie de lopende voorganger achterwaarts NIET (zie `backwardPass`);
   * [VERMOED] intern consistent, P6's achterwaartse gedrag is ongemeten (geen orakel met
   * `sched_lag_early_start_flag` = N).
   */
  private inProgressStartLagAnchor<T extends { es: Date }>(
    predTask: Task, seq: Sequence, lagEng: CalendarEngine, predResult: T,
  ): T {
    if (this.options.schedulingOptions?.startToStartLagFrom !== 'actualStart') return predResult;
    if (this.dataDate === null || !this.inProgressStartLag(predTask, seq, lagEng)) return predResult;
    return { ...predResult, es: new Date(this.dataDate.getTime()) };
  }

  /** C5: verschuif een rauw instant met de relatie-lag, zonder te snappen: WORKTIME via de bandwandeling
   *  (een landing op een band-eind blijft dat eind), ELAPSEDTIME als klokminuten. `sign` −1 = achterwaarts. */
  private physicalPointLag(anchor: Date, seq: Sequence, predTask: Task, lagEng: CalendarEngine, sign: 1 | -1): Date {
    if (seq.lagUnit === 'ELAPSEDTIME') {
      const minutes = this.resolveElapsedMinutes(seq, predTask);
      return new Date(anchor.getTime() + sign * minutes * 60_000);
    }
    const minutes = sign * this.resolveLagMinutes(seq, predTask, lagEng);
    if (minutes > 0) return lagEng.addWorkMinutes(anchor, minutes);
    if (minutes < 0) return lagEng.subtractWorkMinutes(anchor, -minutes);
    return new Date(anchor.getTime());
  }

  /**
   * Conventie C4 `p6CompletedOutOfSequenceWindow` (docblok + bron bij de sleutel in
   * `types/project.ts`): Retained Logic voor een voltooide taak buiten volgorde. Het nul-restvenster
   * van een taak op de statusdatumroute (B3-poort) begint op de laatste van: de statusdatumgrens en
   * de voorwaartse FS/SS-relatiegrens uit elke voorganger die nog niet klaar is. Een voorganger die
   * zelf op de B3-route staat, telt met zijn eigen (eventueel verschoven) venster en alleen als dat
   * venster verschoven is; een gewone voltooide voorganger telt niet (zijn voortgang is historie).
   * Ligt de uitkomst ná het statusdatumvenster, dan komt ze in `completedOutOfSequenceEs`; die map
   * stuurt de weergave (`scheduleAnalysis`) en de relatiegrens naar opvolgers
   * (`completedPredecessorRelationWindow`). Conventie uit, Progress Override, geen statusdatum,
   * dagmodus of niet op de B3-route ⇒ geen effect.
   */
  private recordCompletedOutOfSequenceWindow(
    task: Task,
    preds: Sequence[],
    results: Map<string, { es: Date; ef: Date }>,
    progressCal: CalendarEngine,
  ): void {
    if (this.options.schedulingOptions?.p6CompletedOutOfSequenceWindow !== true) return;
    if (this.options.progressMode === 'PROGRESS_OVERRIDE') return;
    if (this.dataDate === null || !progressCal.isHourMode || preds.length === 0) return;
    if (!this.p6CompletedDataDateWindowDecision(task).eligible) return;
    const windowEs = this.snapOnOrAfter(progressCal, this.dataDate);
    let anchor = windowEs;
    let relation: { at: Date; eng: CalendarEngine } | null = null;
    for (const seq of preds) {
      // FF/SF: de relatie ankert op de finish van deze taak; ongemeten, dus geen effect.
      if (seq.type !== 'FINISH_START' && seq.type !== 'START_START') continue;
      const predTask = this.tasks.get(seq.predecessorId);
      const rawPredResult = results.get(seq.predecessorId);
      if (!predTask || !rawPredResult || predTask.isHammock) continue;
      const predOnWindowRoute = this.p6CompletedDataDateWindowDecision(predTask).eligible;
      if (predOnWindowRoute) {
        if (!this.completedOutOfSequenceEs.has(predTask.id)) continue;
      } else if (predTask.time.completion >= 1) {
        continue;
      }
      const predResult = this.completedPredecessorRelationWindow(predTask, rawPredResult);
      const relSeq = this.completedOutOfSequenceRelationSeq(predTask, seq, progressCal);
      // De grens op de kalender van de voorganger (een nul-restvenster heeft geen eigen werktijd);
      // het weergegeven vensterbegin is die grens gesnapt op de eigen voortgangskalender.
      const predEng = this.relationEngineFor(predTask);
      const bound = forwardConstraint(this.relDeps, predResult, predTask, relSeq, task, predEng, predEng, false);
      if (Number.isNaN(bound.getTime())) continue;
      const es = this.snapOnOrAfter(progressCal, bound);
      if (es > anchor) anchor = es;
      if (relation === null || bound > relation.at) relation = { at: bound, eng: predEng };
    }
    if (anchor > windowEs && relation !== null) {
      this.completedOutOfSequenceEs.set(task.id, anchor);
      this.completedOutOfSequenceRelation.set(task.id, relation);
    }
  }

  /**
   * Conventie C9 `p6LateFinishOnOwnCalendar` (docblok + bron bij de sleutel in `types/project.ts`):
   * de late finish op de eigen kalender. Ligt de grens buiten de werktijd van de taak (niet binnen een
   * band en niet op een band-rand), dan wordt hij het einde van de vorige werkperiode. Een grens op of
   * binnen de werktijd blijft staan. De aanroeper past dit alleen toe als een opvolgergrens de late
   * finish bepaalt, ook ná de late-zijde-constraints (projecteinde en een strakkere constraint/deadline
   * zijn ongemeten). Conventie uit of dagmodus ⇒ `lateFinish` zelf.
   */
  private lateFinishOnOwnCalendar(eng: CalendarEngine, lateFinish: Date): Date {
    if (this.options.schedulingOptions?.p6LateFinishOnOwnCalendar !== true || !eng.isHourMode) return lateFinish;
    const t = lateFinish.getTime();
    if (eng.nextWorkInstant(lateFinish).getTime() === t || eng.prevWorkInstant(lateFinish).getTime() === t) return lateFinish;
    const snapped = eng.prevWorkInstant(lateFinish);
    return Number.isNaN(snapped.getTime()) ? lateFinish : snapped;
  }

  /**
   * A19 `p6UseRemainingStartForProgress`, late kant (docblok bij de sleutel in `types/project.ts`):
   * de restduurregel. P6 plant een LOPENDE activiteit op haar RESTduur ("The total
   * working time from the activity remaining start date to the remaining finish date", Oracle P6 Help,
   * Durations Columns, https://docs.oracle.com/cd/F37125_01/p6help/en/47223.htm); achterwaarts over een
   * SS-relatie is haar late finish dus de late start die de relatie toelaat plus de restduur, niet plus de
   * volle geplande duur. Rest 0 ⇒ een nulduur (LS = LF). Alleen SS: SF is niet gepind. Anders ⇒ `task`.
   */
  private remainingDurationTaskForStartRelation(task: Task, eng: CalendarEngine): Task {
    if (this.options.schedulingOptions?.p6UseRemainingStartForProgress !== true || !eng.isHourMode) return task;
    const t = task.time;
    if (t.actualStart === undefined || !(t.completion > 0 && t.completion < 1)) return task;
    if (t.durationType === 'ELAPSEDTIME' || (task.splitGaps?.length ?? 0) > 0) return task;
    const planned = durationMinutesOf(task, eng);
    const rest = t.remainingMinutes;
    if (rest === undefined || !(rest >= 0) || rest >= planned) return task;
    if (rest === 0) {
      return { ...task, isMilestone: true, milestoneKind: undefined, time: { ...t, scheduleDuration: 0, durationMinutes: 0 } };
    }
    return taskDurationUnit(task) === 'hours'
      ? { ...task, time: { ...t, durationMinutes: rest } }
      : { ...task, time: { ...t, scheduleDuration: rest / (eng.hoursPerDay * 60) } };
  }

  /**
   * Conventie C11 `p6ProgressOverrideIgnoresStartedSuccessor` (docblok + bron bij de sleutel in
   * `types/project.ts`): onder Progress Override negeert de planning de netwerklogica naar een al
   * gestarte, nog lopende opvolger — niet alleen voorwaarts (de voortgangstak rekent daar al zonder
   * voorgangerdruk), maar ook achterwaarts en in de vrije speling. Waar voor deze relatie: conventie
   * aan, `progressMode === 'PROGRESS_OVERRIDE'`, de opvolger heeft een werkelijke start (of voortgang)
   * en is niet voltooid, en de voorganger is niet voltooid.
   */
  private progressOverrideIgnoresRelation(predTask: Task, succTask: Task): boolean {
    if (this.options.schedulingOptions?.p6ProgressOverrideIgnoresStartedSuccessor !== true) return false;
    if (this.options.progressMode !== 'PROGRESS_OVERRIDE') return false;
    const succStarted = !!succTask.time.actualStart || succTask.time.completion > 0;
    return succStarted && succTask.time.completion < 1 && predTask.time.completion < 1;
  }

  /**
   * Conventie C12 `p6FinishNotBeforeFinishFinishBound` (docblok + bron bij de sleutel in
   * `types/project.ts`): de vroege finish ligt in kloktijd nooit vóór de grens van een FF-relatie.
   * Per WORKTIME-FF-voorganger: grens X = voorgangerfinish + lag (lagkalender), genormaliseerd naar de
   * finish-kant (`prevWorkInstant`: een interne bandstart wordt het vorige bandeinde), behalve als de
   * voorganger een startmijlpaal is (die ankert op een start-instant). Ligt X ná de berekende EF met nul
   * werkminuten ertussen op de eigen kalender, dan wordt EF de eerste werkgrens op of ná X. Conventie
   * uit of dagmodus ⇒ `earlyFinish` zelf.
   */
  private finishNotBeforeFinishFinishBound(
    preds: Sequence[], results: Map<string, { es: Date; ef: Date }>, cal: CalendarEngine, earlyFinish: Date,
  ): Date {
    if (this.options.schedulingOptions?.p6FinishNotBeforeFinishFinishBound !== true || !cal.isHourMode) return earlyFinish;
    let out = earlyFinish;
    for (const seq of preds) {
      if (seq.type !== 'FINISH_FINISH' || seq.lagUnit === 'ELAPSEDTIME') continue;
      const predTask = this.tasks.get(seq.predecessorId);
      const rawPredResult = results.get(seq.predecessorId);
      if (!predTask || !rawPredResult || predTask.isHammock) continue;
      const predResult = this.completedPredecessorRelationWindow(predTask, rawPredResult);
      const lagEng = this.relDeps.lagEngine(this.relationEngineFor(predTask), cal);
      let bound = this.shiftLagPred(lagEng, predResult.ef, seq, predTask, 1);
      const predIsStartMilestone = isZeroDurationMilestone(predTask) && predTask.milestoneKind !== 'FINISH'
        && predTask.time.completion < 1;
      if (!predIsStartMilestone) bound = lagEng.prevWorkInstant(bound);
      if (Number.isNaN(bound.getTime()) || bound <= out || cal.workMinutesBetween(out, bound) !== 0) continue;
      const snapped = this.snapOnOrAfter(cal, bound);
      if (!Number.isNaN(snapped.getTime()) && snapped > out) out = snapped;
    }
    return out;
  }

  /**
   * Conventie C7 `p6FinishFinishStartMilestoneLateFinish` (docblok + bron bij de sleutel in
   * `types/project.ts`): bindt een FF-relatie naar een nulduur-STARTmijlpaal aan de mijlpaal zelf
   * in plaats van aan haar dagbegin-anker — terugwaarts de late finish van de mijlpaal, voorwaarts
   * alleen de relatiegrens voor de vrije speling van een NIET-bindende FF (de vroege start van de
   * mijlpaal verandert nooit). Niet in de nulrestduur-voortgangstak van de terugwaartse pass.
   * Alleen uur-modus aan beide kanten: het insluiten van uur-modus is gemeten, het uitsluiten van
   * dagmodus niet — de poort is een bewuste beperking, geen gemeten grens. Een eindmijlpaal
   * (`milestoneKind: 'FINISH'`) valt er per definitie buiten. Voorwaarts doet C7 onder P6 niets meer
   * sinds C12 dezelfde vrije speling levert (vrije-spelingkant van C12); arm 3 (OPS-basis) van de
   * groep-C-fixture bewaakt hem.
   */
  private finishFinishAtStartMilestoneLateFinish(
    seq: Sequence, succTask: Task, predEng: CalendarEngine, succEng: CalendarEngine,
  ): boolean {
    return this.options.schedulingOptions?.p6FinishFinishStartMilestoneLateFinish === true
      && seq.type === 'FINISH_FINISH'
      && predEng.isHourMode && succEng.isHourMode
      && succTask.isMilestone && succTask.milestoneKind === 'START'
      && isZeroDurationMilestone(succTask);
  }

  /**
   * Conventie C3 `p6CompletedRemainingLag` (docblok + bron bij de sleutel in `types/project.ts`): aan
   * de late kant van een voltooide voorganger telt alleen het deel van een positieve WORKTIME-lag dat
   * na zijn werkelijke einde op de statusdatum nog niet verstreken is:
   * `max(0, lag − werktijd(werkelijk einde → statusdatum))` in de lag-kalender. Conventie uit, geen
   * statusdatum, dagmodus, ELAPSEDTIME- of niet-positieve lag, of geen werkelijk einde ⇒ `seq` zelf.
   */
  private completedRemainingLagSeq(seq: Sequence, task: Task, lagEng: CalendarEngine): Sequence {
    if (this.options.schedulingOptions?.p6CompletedRemainingLag !== true) return seq;
    if (this.dataDate === null || !lagEng.isHourMode || seq.lagUnit === 'ELAPSEDTIME') return seq;
    if (!task.time.actualFinish || task.time.completion < 1) return seq;
    const lagMinutes = this.resolveLagMinutes(seq, task, lagEng);
    if (!(lagMinutes > 0)) return seq;
    const actualFinish = this.parseIn(lagEng, task.time.actualFinish);
    if (Number.isNaN(actualFinish.getTime()) || actualFinish >= this.dataDate) return seq;
    const elapsed = lagEng.workMinutesBetween(actualFinish, this.dataDate);
    const remaining = Math.max(0, lagMinutes - elapsed);
    if (remaining === lagMinutes) return seq;
    return { ...seq, lagMinutes: remaining, lagDays: remaining / (lagEng.hoursPerDay * 60), lagPercent: undefined };
  }

  private recordBackwardFloatTrace(
    taskId: string,
    update: Partial<CpmTaskBackwardFloatTrace>,
  ): void {
    if (!this.backwardFloatTrace) return;
    const previous = this.backwardFloatTrace.byTaskId[taskId] ?? {
      lateFinishSource: 'projectEnd',
      lateStartSource: 'subDuration',
      freeFloatSource: 'derivedFromSuccessor',
      displayActualLate: false,
      completedWindow: { eligible: false, reason: 'conventionOff' } as const,
      backwardActualPin: { eligible: false, reason: 'missingDataDate' } as const,
      displayActualLateDecision: { eligible: false, reason: 'missingDataDate' } as const,
    };
    this.backwardFloatTrace.byTaskId[taskId] = { ...previous, ...update };
  }

  /** De voortgangstakken gebruiken soms de resourcekalender van exact één walk als effectieve klok. */
  private progressCalendarFor(task: Task, fallback = this.calendarFor(task)): CalendarEngine {
    let progressCal = fallback;
    if (task.timephasedDurationWalks && task.timephasedDurationWalks.length === 1) {
      const candidate = this.engineForCal(
        resolveCalendar(task.timephasedDurationWalks[0].resourceCalendarId, this.registry, this.projectCal),
        task,
      );
      if (candidate.isHourMode) progressCal = candidate;
    }
    return progressCal;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MODUS-BEWUSTE rekenkern. Elke helper reduceert in DAG-modus tot de
  //  dag-expressie; alleen een UUR-kalender (`isHourMode`) activeert het
  //  minuut-native pad.
  // ═══════════════════════════════════════════════════════════════════════════
  /** Parse een datum-string in de kalendermodus: dag ⇒ `parseDate` (middernacht),
   *  uur ⇒ `parseInstant` (behoudt tijd-van-de-dag). */
  private parseIn(eng: CalendarEngine, iso: string): Date {
    return eng.isHourMode ? parseInstant(iso) : parseDate(iso);
  }
  /** Snap op-of-ná (voorwaarts): dag ⇒ `nextWorkDay`, uur ⇒ `nextWorkInstant`. Instance-tunnel naar
   *  de top-level, GEDEELDE `snapWorkInstantOnOrAfter`: één definitie voor de solver-interne
   *  aanroepen hier ÉN voor `projectStartAnchorClamp.ts`. */
  private snapOnOrAfter(eng: CalendarEngine, d: Date): Date {
    return snapWorkInstantOnOrAfter(eng, d);
  }
  /** Snap een geregistreerd FEIT (actualStart/actualFinish)
   *  VOORWAARTS naar de eerstvolgende werk-instant, MAAR alleen als die instant op DEZELFDE
   *  kalenderdag blijft — kruist de snap naar een andere dag, dan blijft het rauwe instant staan.
   *  Reconcilieert twee tegenstrijdige corpusmetingen: `mpp14resource.mpp`'s "Completed Task"
   *  (actualStart zaterdag, MSP-eigen SCHEDULED_START blijft zaterdag — GEEN dag-kruisende snap)
   *  tegenover `mpp14timephasedsegmentsmanual.mpp`'s "Task Three"/"Task Four" (actualStart 07:00,
   *  buiten de band maar op een GEWONE werkdag — MSP-eigen SCHEDULED_START snapt hier WEL door naar
   *  08:00, een BINNEN-dag-snap). MSP normaliseert dus
   *  een sub-dag-afwijking BINNEN dezelfde dag, maar verplaatst een geregistreerd feit nooit naar
   *  een ANDERE kalenderdag — precies wat deze functie doet. Gebruikt in zowel de VOLTOOID- als de
   *  IN-PROGRESS-branch van de voortgangstak.
   *
   *  NÁ-BAND-UITKOMST: `d` NÁ de laatste band van zijn EIGEN
   *  kalenderdag (bv. 20:00 op een werkdag waarvan de laatste band om 17:00 eindigt) laat
   *  `snapOnOrAfter` naar de EERSTVOLGENDE werk-instant snappen — die valt per definitie op een
   *  ANDERE kalenderdag (`nextWorkInstant` heeft op de eigen dag niets meer te vinden). De
   *  `utcDayStart`-gelijkheidstoets hierboven verwerpt die snap dan ook, en de functie geeft het
   *  RAUWE `d` terug (20:00 blijft 20:00) — géén werk-instant, maar wél de dag die MSP zelf opsloeg.
   *  Dit is een CONSERVATIEVE, maar ONGETOETSTE extrapolatie van de corpusbreed geverifieerde
   *  dag-behoudende regel (geen corpusbestand draagt een `actualStart`/`actualFinish` ná de laatste
   *  band van zijn eigen dag) — bewust geen derde snapregel zonder bewijs. */
  private snapActualForward(eng: CalendarEngine, d: Date): Date {
    const snapped = this.snapOnOrAfter(eng, d);
    return utcDayStart(snapped).getTime() === utcDayStart(d).getTime() ? snapped : d;
  }
  /** Snap op-of-vóór (achterwaarts): dag ⇒ `prevWorkDay`, uur ⇒ `prevWorkInstant`. */
  private snapOnOrBefore(eng: CalendarEngine, d: Date): Date {
    return eng.isHourMode ? eng.prevWorkInstant(d) : eng.prevWorkDay(d);
  }
  /** Snap strikt ná: dag ⇒ `nextWorkDayAfter`, uur ⇒ `nextWorkInstantAfter`. */
  private snapStrictAfter(eng: CalendarEngine, d: Date): Date {
    return eng.isHourMode ? eng.nextWorkInstantAfter(d) : eng.nextWorkDayAfter(d);
  }
  /** Snap strikt vóór: dag ⇒ `prevWorkDayBefore`, uur ⇒ `prevWorkInstantBefore`. */
  private snapStrictBefore(eng: CalendarEngine, d: Date): Date {
    return eng.isHourMode ? eng.prevWorkInstantBefore(d) : eng.prevWorkDayBefore(d);
  }
  /** Voorwaartse her-snap van een OPVOLGER-earlyStart die MSP-pariteit respecteert voor
   *  een EINDmijlpaal: `snapOnOrAfter` normaliseert met `nextWorkInstant` (rand `[start,end)`), dat
   *  een instant EXACT op een band-eind (bv. di 17:00) altijd naar de volgende werk-instant duwt —
   *  precies de dubbele snap die `relationMath`'s FS-tak met de `lagIsZero`-kortsluiting al voorkomt
   *  vóórdat de waarde hier aankomt. Zonder deze wacht herintroduceert de generieke her-snap
   *  (voor de "constrained root-taak op middernacht"-situatie) diezelfde dubbele snap op het
   *  volgende niveau. `snapOnOrBefore(...) === d` is de test "`d` is
   *  al een geldige `(start,end]`-instant" (band-interieur of band-eind) — precies de conventie
   *  waarmee `finishFromStart` een `ef` bouwt; bij een niet-milestone of een dag-kalender reduceert
   *  dit tot de kale `snapOnOrAfter`. */
  private snapSuccessorEarlyStart(
    eng: CalendarEngine,
    d: Date,
    task: Task,
    preserveP6FinishBoundary = false,
  ): Date {
    // Een ELAPSEDTIME-opvolger krijgt hier GEEN werk-instant-snap: MS Project plant elapsed-taken
    // puur in kalendertijd, ook op een niet-werk-instant. Deze generieke her-snap draait na ELKE
    // forward-constraint; zonder bypass wordt bv. een FF+0-opvolger die op zaterdag moet landen alsnog
    // naar de eerstvolgende werk-instant geduwd, en schuift haar EF mee. Een ECHTE (0-duur) mijlpaal
    // (`isZeroDurationMilestone`, niet de kale vlag) blijft uitgesloten: de FINISH-mijlpaal-tak
    // hieronder regelt haar eigen landing. Een mijlpaal-MET-duur die ELAPSEDTIME is, valt wél onder
    // de bypass.
    if (isElapsedTask(task)) return d;
    if (preserveP6FinishBoundary && eng.isHourMode
      && this.snapOnOrBefore(eng, d).getTime() === d.getTime()) return d;
    const p6FinishBoundary = this.p6ZeroDurationUsesFinishBoundary(task, eng);
    if (eng.isHourMode && isZeroDurationMilestone(task)
      && (task.milestoneKind === 'FINISH' || p6FinishBoundary)) {
      if (this.snapOnOrBefore(eng, d).getTime() === d.getTime()) return d;
    }
    return this.snapOnOrAfter(eng, d);
  }

  /** P6 bewaart TT_Mile als één enum, maar de geplande TASK-grens maakt het operationele verschil:
   *  start van een band ⇒ volgende werkstart; einde van een band ⇒ voorgangerfinish blijft geldig. */
  private p6ZeroDurationUsesFinishBoundary(task: Task, eng: CalendarEngine): boolean {
    if (this.options.schedulingOptions?.p6ZeroDurationUsesPlannedBoundary !== true
      || !eng.isHourMode || !isZeroDurationMilestone(task)) return false;
    const planned = parseInstant(task.time.scheduleStart);
    if (Number.isNaN(planned.getTime())) return false;
    const minute = planned.getUTCHours() * 60 + planned.getUTCMinutes();
    return eng.effectiveBandsOn(planned).some(band => band.end === minute);
  }
  /** P6 bewaart ook een gewone Task-/Resource Dependent-activiteit met nul duur soms als een
   *  aangrenzend grensPAAR: start op de volgende bandstart, finish op het vorige bandeinde. Het
   *  geïnverteerde geplande venster is het invoersignaal; zonder XER-vlag of op andere taaktypen
   *  blijft de algemene nulduursemantiek ongewijzigd. */
  private p6ZeroDurationActivityUsesBoundaryPair(task: Task, eng: CalendarEngine): boolean {
    if (this.options.schedulingOptions?.p6ZeroDurationUsesPlannedBoundary !== true
      || !eng.isHourMode || task.time.scheduleDuration !== 0
      || (task.p6ActivityType !== 'TT_Task' && task.p6ActivityType !== 'TT_Rsrc')) return false;
    const plannedStart = parseInstant(task.time.scheduleStart);
    const plannedFinish = parseInstant(task.time.scheduleFinish);
    return !Number.isNaN(plannedStart.getTime()) && !Number.isNaN(plannedFinish.getTime())
      && plannedFinish < plannedStart;
  }
  /** Finishzijde van P6's gewone nulduur-grenspaar. Dit is de VORIGE KALENDERDAG op de klok van
   *  het geplande finishanker, ook wanneer die dag voor de effectieve kalender niet werkt. P6's
   *  hb-intel-vensters tonen daardoor bijvoorbeeld zondag 17:00 naast maandag 08:00 op een
   *  vijfdaagse kalender; `prevWorkInstant` zou ten onrechte naar vrijdag teruglopen. */
  private p6PreviousCalendarFinishBoundary(task: Task, start: Date): Date {
    const plannedFinish = parseInstant(task.time.scheduleFinish);
    const clockMs = (plannedFinish.getUTCHours() * 60 + plannedFinish.getUTCMinutes()) * 60_000;
    return new Date(utcDayStart(start).getTime() - MS_PER_DAY + clockMs);
  }
  private modeOf(eng: CalendarEngine): DateMode {
    return eng.isHourMode ? 'hour' : 'day';
  }

  /**
   * De `projectStart`-ONDERGRENS: het MAXIMUM van de taak-eigen gesnapte
   * `scheduleStart` en de geconfigureerde projectstartdatum (zelf ook per `eng` gesnapt — een
   * taak op een afwijkende kalender mag de vloer dus op een andere dag landen dan de
   * projectkalender zelf zou geven). `projectStartRaw` afwezig (optie niet meegegeven, of
   * onparseerbaar) ⇒ puur de eigen start.
   *
   * UITSLUITEND gebruikt voor de `projectStart`-precompute in `forwardPass` (taken MET voorganger
   * + hammocks) — de early-start-ONDERGRENS voor die hele categorie, niet alleen tegen relatie-LEADS:
   * ook een gewone FS/FF-relatie met lag 0 van een vroege wortel-taak wordt hier gevloerd. Alleen
   * de gebruikerszichtbare `truncatedLeadIds`-markering is lead-specifiek. Zo blijft een VEROUDERDE
   * `scheduleStart` (bv. van vóór een wijziging van de projectstartdatum) niet stil vóór het
   * projectbegin doorlopen.
   *
   * NIET gebruikt voor de eigen ES van een wortel-taak ("een ingelezen anker wordt nooit door de
   * vloer overruled") — zie `ownAnchor`; minuut-exactheid tegen het corpus eist dat het eigen anker
   * wint.
   *
   * ELAPSEDTIME wortel-taak: geef de rauwe `own` terug, ONGESNAPT. Zo'n taak levert mee aan de
   * `projectStart`-vloer (het MINIMUM over alle wortel-taken); een gesnapt zaterdag-anker zou die
   * vloer naar maandag duwen en via de vloer ook niet-wortel-taken onterecht dichttrekken. De
   * `projectStartRaw`-vergelijking (een expliciet gezette ondergrens) blijft wél gesnapt, net als
   * een constraint: een opgelegde grens is geen relatie-afgeleide instant. */
  private rootFloor(eng: CalendarEngine, scheduleStart: string, elapsedTask: boolean): Date {
    const own = elapsedTask
      ? this.parseIn(eng, scheduleStart)
      : this.snapOnOrAfter(eng, this.parseIn(eng, scheduleStart));
    if (!this.projectStartRaw) return own;
    const floor = this.snapOnOrAfter(eng, this.projectStartRaw);
    return floor > own ? floor : own;
  }

  /**
   * Taak-eigen gesnapte start, ONGEKLEMD tegen de projectstart. Gebruikt voor de ES
   * van een taak ZONDER voorganger (`forwardPass`, `preds.length === 0`-tak): een ingelezen
   * anker wordt nooit door de vloer overruled, ook niet als het vóór de geconfigureerde
   * projectstartdatum ligt. De vloer (`rootFloor`) geldt alleen als early-start-ondergrens voor
   * taken MET voorganger. Een taak zónder voorganger kan dus vóór de projectstart staan als het
   * eigen anker dat zegt — de MS Project-semantiek die de fidelity-audit meet.
   *
   * RAUW ANKER OP EEN BAND-EIND: een instant exact op
   * het LAATSTE band-eind van zijn eigen kalenderdag (bv. `…T17:00` op een 08:00–17:00-band — niet
   * een TUSSEN-band-eind zoals `12:00` op een 08–12/13–17-dag, zie `isExactBandEnd`'s docblok) is
   * een gedegenereerd geval — er valt niets te snappen, het eerstvolgende werk-instant ÍS de
   * volgende bandstart, maar MSP bewaart het instant zelf (corpusbewijs:
   * `mpxj/junit/data/timephased-prorated-cost-resource.mpp`, taak "No Progress - Actual Cost" —
   * MSP's eigen SCHEDULED_START blijft `2026-01-29T17:00`; `snapOnOrAfter` zou 'm naar
   * `2026-01-30T08:00` duwen). `isExactBandEnd` is hier ONVOORWAARDELIJK toegepast (niet tot
   * mijlpalen beperkt) — anders dan `snapSuccessorEarlyStart`s bestaande FINISH-mijlpaal-
   * uitzondering hierboven (die deze (start,end]-vrijheid alleen aan een mijlpaal geeft): een
   * WORTEL-anker is per definitie ALTIJD een gelezen waarde, nooit een CPM-berekende — dezelfde
   * grond die `ownAnchor` hierboven al ONGEKLEMD tegen de projectstart houdt. Voor een normale
   * werk-instant-start is `snapOnOrAfter` toch al een no-op. In het corpus heeft precies 1
   * wortel-taak een rauw anker exact op een bandgrens (het LAATSTE band-eind van haar dag);
   * `cases-advanced-cpm.json` pint dit geval, het band-interieur- en het tussen-band-eind-gedrag.
   *
   * EEN 0-DUURMIJLPAAL SNAPT NOOIT — zelfde regel als bij `forwardBoundOf` — MAAR uitsluitend bij
   * een ECHT datetime-anker (`scheduleStart` draagt een tijdcomponent) in uur-modus (een
   * date-only-anker is dag-verankerd en blijft naar het eerste werk-instant van de dag snappen).
   * `isExactBandEnd`-check hierboven blijft ONVOORWAARDELIJK bestaan voor taken MET duur en voor
   * date-only-geankerde mijlpalen. */
  private ownAnchor(eng: CalendarEngine, scheduleStart: string, task: Task): Date {
    const raw = this.parseIn(eng, scheduleStart);
    if (isZeroDurationMilestone(task) && eng.isHourMode && scheduleStart.includes('T')) return raw;
    if (this.isExactBandEnd(eng, raw)) return raw;
    return this.snapOnOrAfter(eng, raw);
  }

  /** `d` valt EXACT op het LAATSTE band-eind van zijn eigen kalenderdag (uur-modus) — niet zelf een
   *  werk-instant (`[start,end)`), maar wél al een geldige `(start,end]`-instant, ÉN geen TUSSEN-
   *  band-eind (bv. `12:00` in een 08–12/13–17-dag). De bredere test (`snapOnOrBefore(eng,d)===d`)
   *  zou ook op `12:00` vuren — dan telt `dayFirstBandStart` stil de hele OCHTEND mee bij de
   *  duur-optelling, terwijl het corpusbewijs (`timephased-prorated-cost-resource.mpp`) UITSLUITEND
   *  het LAATSTE band-eind van de dag betreft. Vandaar de expliciete vergelijking met `bands[bands.length-1].end` i.p.v. de kale
   *  `(start,end]`-test. Dag-modus kent geen bandgrenzen ⇒ altijd `false`. */
  private isExactBandEnd(eng: CalendarEngine, d: Date): boolean {
    if (!eng.isHourMode) return false;
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return false;
    const lastBandEndMs = utcDayStart(d).getTime() + bands[bands.length - 1].end * MS_PER_MIN;
    return d.getTime() === lastBandEndMs;
  }

  /** Het EERSTE band-begin op `d`'s eigen kalenderdag (gebruikt door `addDurationChecked`s
   *  band-eind-wacht hierboven én `subDuration`s backward-spiegel verderop) — `effectiveBandsOn`
   *  levert de banden al MET geldende werkende uitzonderingen/holidays voor die specifieke dag,
   *  dus dit volgt dezelfde bron als elke andere band-vergelijking in dit bestand. `bands.length===0`
   *  is hier PROVEERBAAR onbereikbaar bij elke aanroeper: beide aanroepers gaten deze functie
   *  UITSLUITEND achter `isExactBandEnd(eng, d)`, en die functie zelf retourneert al `false` zodra
   *  `effectiveBandsOn(d)` leeg is (zie hierboven) — een dag zonder enige band kan dus nooit als
   *  "band-eind" gekwalificeerd zijn geweest. Geen corpusloze rode-pad-fixture nodig/mogelijk: een
   *  synthetische holiday-op-de-ankerdag-case zou per constructie nooit `isExactBandEnd` passeren,
   *  dus nooit hier aankomen. De `?? start`/`?? d`-terugval bij de aanroepplekken is pure
   *  verdediging-in-de-diepte. */
  private dayFirstBandStart(eng: CalendarEngine, d: Date): Date | null {
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return null;
    return new Date(utcDayStart(d).getTime() + bands[0].start * MS_PER_MIN);
  }

  /** Het LAATSTE band-EIND op `d`'s eigen kalenderdag (backward-spiegel van `dayFirstBandStart`
   *  hierboven — uitsluitend gebruikt door `subDuration`s float-bewuste band-eind-wacht). Zelfde
   *  onbereikbaarheids-redenering als `dayFirstBandStart`'s docblok voor de `bands.length===0`-tak. */
  private dayLastBandEnd(eng: CalendarEngine, d: Date): Date | null {
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return null;
    return new Date(utcDayStart(d).getTime() + bands[bands.length - 1].end * MS_PER_MIN);
  }

  /** De mode-bewuste primitieven die de relatie-wiskunde (`relationMath.ts`) geïnjecteerd
   *  krijgt aangereikt. Ze blijven hier gedefinieerd (delen de dag↔uur-reductie met de rest van de
   *  solver); `forwardConstraint`/`backwardConstraint` draaien de FS/SS/FF/SF-formules erop. */
  private readonly relDeps: RelationDeps = {
    lagEngine: (predEng, succEng) => {
      switch (this.options.schedulingOptions?.lagCalendar) {
        case 'successor': return succEng;
        case 'projectDefault': return this.projectEngine;
        case '24hour': return this.twentyFourHourLagEngine;
        case 'predecessor':
        default: return predEng;
      }
    },
    resolveLag: (seq, predTask, predEng) => this.resolveLag(seq, predTask, predEng),
    resolveEffectiveLagDays: (seq, predTask, predEng) =>
      resolveEffectiveLagDays(seq, predTask, predEng.hoursPerDay),
    resolveElapsedMinutes: (seq, predTask) => this.resolveElapsedMinutes(seq, predTask),
    shiftLagPred: (predEng, base, seq, predTask, sign) => this.shiftLagPred(predEng, base, seq, predTask, sign),
    startFromFinish: (eng, finish, task) => this.startFromFinish(eng, finish, task),
    finishFromStart: (eng, start, task) => this.finishFromStart(eng, start, task),
    snapOnOrAfter: (eng, d) => this.snapOnOrAfter(eng, d),
    snapOnOrBefore: (eng, d) => this.snapOnOrBefore(eng, d),
    snapStrictAfter: (eng, d) => this.snapStrictAfter(eng, d),
    snapStrictBefore: (eng, d) => this.snapStrictBefore(eng, d),
    startOfDay: utcDayStart,
  };

  /** Vroege finish = start ⊕ duur. Mijlpaal ⇒ 0; ELAPSEDTIME ⇒ kale 24/7-klokoptelling
   *  (zoals `resolveElapsedMinutes`/`relationMath.ts`, GEEN kalenderband-toetsing); uur
   *  (WORKTIME) ⇒ `addWorkMinutes(durationMinutesOf)`; dag (WORKTIME) ⇒ `addWorkDays(durationDaysOf)`
   *  (`durationDaysOf` levert op een dag-kalender altijd de integer `scheduleDuration`).
   *
   *  Splits: `task.splitGaps` telt hier mee als EXTRA werkminuten/-dagen bovenop de gewone duur, via
   *  `splitTotalSpanMinutes`/`splitTotalSpanDays` (`duration.ts` — een wandeling over de cumulatieve
   *  gaten-as, zie daar). ELAPSEDTIME blijft bewust ONGEMOEID — splits zijn een WERK-tijd-concept
   *  (24/7 kent geen "gat"). Zonder `splitGaps` geven die helpers de kale duur terug. */
  private addDuration(eng: CalendarEngine, start: Date, task: Task): Date {
    return this.addDurationChecked(eng, start, task).date;
  }
  /** `addDuration` mét CAP-signaal: identieke datum-uitkomst, plus `capped` uit de dag-modus-
   *  `addWorkDaysChecked` — een onwerkbaar taakvenster (holiday-blok) dat de earlyFinish tegen de
   *  MAX_SCAN/MAX_DAYS-grens duwt. Mijlpaal, ELAPSEDTIME en uur-modus cappen hier nooit (`false`):
   *  een mijlpaal heeft geen duur, ELAPSEDTIME kent geen onwerkbaar-venster-begrip (24/7), en de
   *  minuut-lussen hebben hun eigen best-effort-terugval buiten dit signaal. */
  private addDurationChecked(eng: CalendarEngine, start: Date, task: Task): { date: Date; capped: boolean } {
    if (isZeroDurationMilestone(task)) return { date: new Date(start.getTime()), capped: false };
    if (task.time.durationType === 'ELAPSEDTIME') {
      return { date: addElapsedMinutes(start, elapsedMinutesOf(task, eng)), capped: false };
    }
    if (eng.isHourMode && taskDurationUnit(task) === 'hours') {
      const totalMinutes = splitTotalSpanMinutes(task.splitGaps, durationMinutesOf(task, eng));
      if (totalMinutes > 0 && this.p6FinishBoundaryStartTaskIds.has(task.id)
        && this.isExactBandEnd(eng, start)) {
        return {
          date: eng.addWorkMinutes(eng.nextWorkInstantAfter(start), totalMinutes),
          capped: false,
        };
      }
      // Rauw anker op een band-eind: `start` exact op een band-eind (`ownAnchor` laat zo'n
      // wortel-anker bewust RAUW) — INVOERBEWIJS (corpusbestand
      // `timephased-prorated-cost-resource.mpp`, 4 taken, identieke duur/kalender): MSP's eigen
      // `SCHEDULED_FINISH` is voor ALLE VIER de taken hetzelfde instant (`2026-02-02T17:00`) — óók
      // voor "No Progress - Actual Cost", die als ENIGE om `17:00` (band-eind) start i.p.v. `08:00`
      // (band-begin) zoals de andere drie. MSP rekent de ankerdag van die taak dus als VOLLEDIG
      // verbruikt mee in de duur, ongeacht dat er op klokinstant-niveau nul minuten van die dag
      // resteren. Reken de duur daarom vanaf de EERSTE band van diezelfde kalenderdag i.p.v. vanaf
      // het band-eind-instant zelf — de GERAPPORTEERDE `earlyStart` blijft ongewijzigd het rauwe
      // band-eind-anker, dit raakt uitsluitend het interne rekenpunt voor de
      // duur-optelling. `totalMinutes > 0`-wacht: anders verlegt dit ook de RETURN van een
      // NUL-duur, niet-mijlpaal-taak (`isZeroDurationMilestone` vereist óók `task.isMilestone`) van
      // `addWorkMinutes`'s `minutes ≤ 0`-kortsluiting naar de band-begin-waarde (dataDate-vloer-cases
      // `msp-06`/`msp-06b`). Band-INTERIEUR/normale starts ⇒ `isExactBandEnd` levert `false`.
      const walkStart = totalMinutes > 0 && this.isExactBandEnd(eng, start)
        ? this.dayFirstBandStart(eng, start) ?? start
        : start;
      return { date: eng.addWorkMinutes(walkStart, totalMinutes), capped: false };
    }
    if (eng.isHourMode) {
      // Ook een DAG-taak op een kalender MÉT banden telt `splitGaps` mee (via `splitTotalSpanDays`,
      // dat voor een gatloze taak `scheduleDuration` RAUW teruggeeft).
      const totalDays = splitTotalSpanDays(task, eng);
      if (totalDays <= 0) return { date: new Date(start.getTime()), capped: false };
      const dayResult = eng.addWorkDaysChecked(utcDayStart(start), totalDays);
      return {
        date: this.dayLastBandEnd(eng, dayResult.date) ?? dayResult.date,
        capped: dayResult.capped,
      };
    }
    const totalDays = splitTotalSpanDays(task, eng);
    return eng.addWorkDaysChecked(start, totalDays);
  }
  /** Late start = late finish ⊖ duur (spiegel van `addDuration`). BEWUST GEEN
   *  `levelingDelay`/`levelingDelayMinutes`-aftrek hier: `end` (= `lateFinish`) komt hier al onafhankelijk van deze taak se eigen
   *  `earlyStart` binnen, dus een aftrek HIER zou de vertraging DUBBEL verrekenen in
   *  `totalFloat`. Dat is een ander mechanisme dan de backward-DOORGIFTE-spiegel in
   *  `backwardPass` (`shiftByLevelingDelay`s aanroep daar): die corrigeert wat
   *  een VOORGANGER van deze taak als late-zijde-druk ziet, niet wat déze taak zelf met haar
   *  eigen duur doet — de twee plekken lossen verschillende problemen op en bijten elkaar niet.
   *
   *  Splits — spiegel van `addDurationChecked` hierboven: zónder deze spiegel zou de backward-pass een LS berekenen die niet
   *  bij de gaten-bewuste EF van dezelfde taak hoort — LF-EF zou dan systematisch afwijken van
   *  LS-ES, wat via `totalFloat`/`freeFloat` een spook-speling introduceert op elke gesplitste
   *  taak. Zelfde venster `[0, totale duur)`, zelfde ELAPSEDTIME-uitsluiting. */
  /** `actualEarlyStart`: de ES die `earlyDates` voor DEZE taak in DIT solve
   *  daadwerkelijk droeg (uit `backwardPass`s eigen `earlyDates`-map, niet `task.time.earlyStart` —
   *  dat veld wordt pas ná `backwardPass` door `computeScheduleResults` geschreven, dus zou hier
   *  een stale waarde van de VORIGE solve teruggeven). Optioneel/`null` voor de dag-modus-tak en
   *  voor aanroepers die 'm niet kennen; de band-eind-wacht hieronder gebruikt 'm om te bevestigen
   *  dat `ownAnchor` de ES ook WERKELIJK leverde (zie die wacht se toelichting). */
  private subDuration(eng: CalendarEngine, end: Date, task: Task, actualEarlyStart: Date | null = null): Date {
    if (isZeroDurationMilestone(task)) return new Date(end.getTime());
    if (task.time.durationType === 'ELAPSEDTIME') {
      return subtractElapsedMinutes(end, elapsedMinutesOf(task, eng));
    }
    if (eng.isHourMode && taskDurationUnit(task) === 'hours') {
      const totalMinutes = splitTotalSpanMinutes(task.splitGaps, durationMinutesOf(task, eng));
      const natural = eng.subtractWorkMinutes(end, totalMinutes);
      // B1: de late start van een opvolger op een voorgangerfinishgrens-relatie is een gewone
      // bandSTART (P6: Hotel HCSWB1Z1240 LS 03-04 08:00). De finishgrens voor de voorganger legt de
      // gewone FS-backward in `relationMath` (`prevWorkInstant` op de voorgangerkalender), niet
      // `prevWorkInstantBefore(natural)` hier.
      // Backward-spiegel van `addDurationChecked`s band-eind-wacht: een WORTEL-taak wier `ownAnchor`
      // het rauwe band-eind-anker behoudt, telt de EIGEN kalenderdag van dat anker als volledig
      // verbruikt (`dayFirstBandStart`), terwijl `es` het rauwe band-eind blijft. Een kale
      // duur-aftrek vanaf `end` landt dan vóór `es` (negatieve `tf` zonder oorzaak) of geeft mét
      // speling een `tf` die één werkdag te klein is (LF−EF ≠ LS−ES) — de fidelity-meting ziet alleen
      // ES/EF, geen float.
      //
      // De wacht toetst of `natural` op een kalenderdag D exact op de EERSTE band landt
      // (`dayFirstBandStart(natural) === natural`) — wat een "hele-werkdagen"-aftrek altijd doet — en
      // geeft dan het LAATSTE band-eind van D terug (`dayLastBandEnd`). Zonder speling is D de
      // ankerdag zelf. Gepind in `cases-advanced-cpm.json` (`z13-root-anchor-band-eind-speling`).
      //
      // GATING: `preds.length===0` + `isExactBandEnd(rawOwn)` zijn nodig maar niet voldoende — een
      // harde pin of bindende SNET/MSO-constraint kan `earlyStart` elders gezet hebben.
      // `actualEarlyStart === rawOwn` (de ECHTE ES van dit solve) bevestigt dat `ownAnchor` de ES
      // leverde. Voor élke andere taak is dit `false`.
      if (
        totalMinutes > 0
        && (this.predecessors.get(task.id) ?? []).length === 0
        && task.time.scheduleStart
        && actualEarlyStart
      ) {
        const rawOwn = this.parseIn(eng, task.time.scheduleStart);
        if (this.isExactBandEnd(eng, rawOwn) && actualEarlyStart.getTime() === rawOwn.getTime()) {
          const naturalDayStart = this.dayFirstBandStart(eng, natural);
          if (naturalDayStart && naturalDayStart.getTime() === natural.getTime()) {
            const mirrored = this.dayLastBandEnd(eng, natural);
            if (mirrored) return mirrored;
          }
        }
      }
      return natural;
    }
    if (eng.isHourMode) {
      // Spiegel van `addDurationChecked`s dag-taak-op-bandenkalender-tak: zonder dezelfde
      // gaten-bewuste aftrek wijkt LS−ES af van LF−EF en ontstaat er spookfloat op elke gesplitste
      // dag-taak die op een uur-kalender staat.
      const totalDays = splitTotalSpanDays(task, eng);
      if (totalDays <= 0) return new Date(end.getTime());
      const firstDay = eng.subtractWorkDays(utcDayStart(end), totalDays);
      return this.dayFirstBandStart(eng, firstDay) ?? firstDay;
    }
    const totalDays = splitTotalSpanDays(task, eng);
    return eng.subtractWorkDays(end, totalDays);
  }

  /** P6-XER late-passspiegel voor een lopende taak: alleen het resterende werk ligt nog op de
   *  Early/Late-as. Actual Start en het voltooide duurdeel zijn historie. De berekening spiegelt
   *  exact de resterende-duurtak uit `forwardPass`, inclusief het nog niet verbruikte deel van
   *  splitgaten; ze leest uitsluitend taakvoortgang, duur en kalenderinvoer. */
  private subRemainingDuration(eng: CalendarEngine, end: Date, task: Task): Date {
    const t = task.time;
    const totalSpan = eng.isHourMode ? durationMinutesOf(task, eng) : t.scheduleDuration;
    const remaining = eng.isHourMode
      ? Math.max(0, t.remainingMinutes ?? Math.round(totalSpan * (1 - t.completion)))
      : Math.max(0, t.remainingTime ?? Math.round(totalSpan * (1 - t.completion)));
    if (!isZeroDurationMilestone(task) && t.durationType === 'ELAPSEDTIME') {
      return subtractElapsedMinutes(end, eng.isHourMode ? remaining : remaining * 24 * 60);
    }
    let remainingWithGaps = remaining;
    if (task.splitGaps && task.splitGaps.length > 0) {
      const totalSpanMinutes = eng.isHourMode ? totalSpan : totalSpan * eng.hoursPerDay * 60;
      const remainingMinutes = eng.isHourMode ? remaining : remaining * eng.hoursPerDay * 60;
      const completedSpanMinutes = Math.max(0, totalSpanMinutes - remainingMinutes);
      remainingWithGaps = (
        splitTotalSpanMinutes(task.splitGaps, totalSpanMinutes)
        - splitTotalSpanMinutes(task.splitGaps, completedSpanMinutes)
      ) / (eng.isHourMode ? 1 : eng.hoursPerDay * 60);
    }
    return eng.isHourMode
      ? eng.subtractWorkMinutes(end, remainingWithGaps)
      : eng.subtractWorkDays(end, remainingWithGaps);
  }

  /** Verschuift `date` met de nivelleer-vertraging van `task` (uur-/minuutprecisie,
   *  elapsed-bewust). `sign=1` (forward, `forwardPass`s eigen early
   *  start van `task` zelf) of `sign=-1` (backward-DOORGIFTE, `backwardPass`s constraint-druk
   *  die `task` als OPVOLGER op haar voorganger legt — zie de toelichting bij de aanroepplek in
   *  `backwardPass`). Geen delay ingesteld ⇒ `date` ongewijzigd, ongeacht `sign`.
   *
   *  VALKUIL: `eng.addWorkingMinutesSigned` is
   *  een UUR-modus-primitief — `CalendarEngine`'s `bandCache` bestaat uitsluitend wanneer de
   *  kalender `workTime` draagt (constructor, `this.mode==='hour'`-tak); op een DAG-kalender blijft
   *  `bandCache` `undefined` en crasht `bandsStartingOn`'s `this.bandCache!`-assertion. `mppReader.ts`
   *  zet `levelingDelayMinutes` op `raw.levelingDelayRaw !== 0`, ONGEACHT het kalender-type van het
   *  project — een `.mpp`-bestand met nivelleervertraging op een gewone DAG-kalender bereikt deze
   *  tak dus. Terugval-conventie: identiek aan `durationDaysOf`s "sub-dag-duur
   *  bestaat niet op een dag-kalender"-precedent en `resolveEffectiveLagDays`s minuten→dagen-
   *  omrekening (`Math.sign(raw) * Math.round(Math.abs(raw))`, half rondt van nul af) — reken de
   *  minuten om naar HELE werkdagen en gebruik `addWorkingDaysSigned` (de dag-modus-tegenhanger). */
  private shiftByLevelingDelay(eng: CalendarEngine, task: Task, date: Date, sign: 1 | -1): Date {
    const taskElapsed = isElapsedTask(task);
    if (task.levelingDelayMinutes) {
      if (taskElapsed || task.levelingDelayElapsed) {
        return addElapsedMinutes(date, sign * task.levelingDelayMinutes);
      }
      if (!eng.isHourMode) {
        const raw = task.levelingDelayMinutes / (eng.hoursPerDay * 60);
        const days = Math.sign(raw) * Math.round(Math.abs(raw));
        return eng.addWorkingDaysSigned(date, sign * days);
      }
      return eng.addWorkingMinutesSigned(date, sign * task.levelingDelayMinutes);
    }
    if (task.levelingDelay) {
      return taskElapsed
        ? addElapsedMinutes(date, sign * task.levelingDelay * 24 * 60)
        : eng.addWorkingDaysSigned(date, sign * task.levelingDelay);
    }
    return date;
  }

  /** WORKTIME-lag in MINUTEN in de voorganger-kalender: procent ⇒ uit `durationMinutesOf(pred)`;
   *  `lagMinutes` ⇒ bron; anders `lagDays × pred-hoursPerDay × 60` (naakt getal = werkdagen). */
  private resolveLagMinutes(seq: Sequence, predTask: Task, predEng: CalendarEngine): number {
    if (isFiniteNumber(seq.lagPercent)) {
      const predMin = isZeroDurationMilestone(predTask) ? 0 : durationMinutesOf(predTask, predEng);
      return Math.round((predMin * seq.lagPercent) / 100);
    }
    if (isFiniteNumber(seq.lagMinutes)) return seq.lagMinutes;
    const days = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
    return days * predEng.hoursPerDay * 60;
  }
  /** ELAPSEDTIME-lag in KLOK-minuten (24/7): `lagMinutes` ⇒ bron; anders (procent/)dagen × 24 × 60. */
  private resolveElapsedMinutes(seq: Sequence, predTask: Task): number {
    if (isFiniteNumber(seq.lagMinutes)) return seq.lagMinutes;
    return resolveEffectiveLagDays(seq, predTask) * 24 * 60;
  }
  /** Verschuif `base` met de relatie-lag in de meegegeven lag-engine (de parameter heet `predEng`,
   *  maar elke aanroeper geeft `lagEng` uit `relDeps.lagEngine` door — `schedulingOptions.lagCalendar`,
   *  default voorganger).
   *  Uur-pred ⇒ minuten via `addWorkingMinutesSigned`; dag-pred ⇒ dagen via `addWorkingDaysSigned`
   *  (dag-lag blijft exact als nu). `sign` = +1 voorwaarts, −1 achterwaarts (spiegel). */
  private shiftLagPred(
    predEng: CalendarEngine, base: Date, seq: Sequence, predTask: Task, sign: 1 | -1,
  ): Date {
    if (predEng.isHourMode) {
      const minutes = this.resolveLagMinutes(seq, predTask, predEng);
      if (sign < 0 && minutes > 0) {
        const projected = predEng.subtractWorkMinutes(base, minutes);
        // P6 WORKTIME-lag is een grensafstand. Vanaf een finishgrens moet een aftrek die exact op
        // een bandstart landt daarom de complementaire vorige finishgrens teruggeven: wo 17:00
        // min twee werkdagen = ma 17:00, niet di 08:00. Alleen de XER-resultaatprojectie krijgt
        // deze conventie; duur-aftrek en de generieke kalenderprimitieven blijven fysiek/invers.
        const projectedDayStart = this.dayFirstBandStart(predEng, projected);
        if (this.options.schedulingOptions?.p6BackwardLagFinishBoundary === true
          && this.isExactBandEnd(predEng, base)
          && projectedDayStart?.getTime() === projected.getTime()) {
          return predEng.prevWorkInstantBefore(projected);
        }
        return projected;
      }
      // B2 bij lag 0: een FF-grens op een exact bandeinde blijft die finishgrens; de
      // generieke normalisatie (`nextWorkInstant`) zou hem naar de volgende bandstart duwen.
      if (sign < 0 && minutes === 0 && seq.type === 'FINISH_FINISH'
        && this.options.schedulingOptions?.p6BackwardLagFinishBoundary === true
        && this.isExactBandEnd(predEng, base)) {
        return new Date(base.getTime());
      }
      return predEng.addWorkingMinutesSigned(base, sign * minutes);
    }
    // Dag-voorganger: WORKTIME-lag in dagen; `hoursPerDay` van de voorganger-kalender vertaalt een
    // lag die alleen als `lagMinutes` bestaat.
    return predEng.addWorkingDaysSigned(
      base, sign * resolveEffectiveLagDays(seq, predTask, predEng.hoursPerDay),
    );
  }

  /** Leid de opvolger-START af uit zijn geëiste FINISH (FF/SF): ELAPSEDTIME ⇒ kale 24/7-
   *  klokaftrek (vóór de hour/day-splitsing — geen kalenderband-toetsing, dus modus-onafhankelijk);
   *  uur (WORKTIME) ⇒ `subtractWorkMinutes`; dag (WORKTIME) ⇒ `addWorkingDaysSigned(−(dur−1))` — de
   *  inclusieve-dag-aftrek. Mijlpaal-afhandeling verschilt per tak: de dag-tak snapt een mijlpaal via `addWorkingDaysSigned(finish, 0)` = `nextWorkDay`, de uur-tak
   *  geeft de rauwe finish terug ongesnapt — niet symmetrisch, dus niet naar bóven de modus-split
   *  te hijsen zonder dat gedrag te veranderen).
   *
   *  Splits: gebruikt door de FF/SF-armen in `relationMath.ts` en door
   *  `forwardBoundOf`/`backwardBoundOf`/`hardPinStart`/`hardPinFinish` — een gesplitste taak als
   *  FF-voorganger zou zonder deze gaten-optelling een START teruggeven die haar EIGEN duur negeert.
   *  Zelfde as-wandeling/ELAPSEDTIME-uitsluiting als `addDurationChecked` (`splitTotalSpanMinutes`/
   *  `splitTotalSpanDays`, `duration.ts`). */
  private startFromFinish(eng: CalendarEngine, finish: Date, task: Task): Date {
    if (eng.isHourMode && taskDurationUnit(task) === 'hours') {
      if (isZeroDurationMilestone(task)) return new Date(finish.getTime());
      if (task.time.durationType === 'ELAPSEDTIME') {
        return subtractElapsedMinutes(finish, elapsedMinutesOf(task, eng));
      }
      const totalMinutes = splitTotalSpanMinutes(task.splitGaps, durationMinutesOf(task, eng));
      const natural = eng.subtractWorkMinutes(finish, totalMinutes);
      if (totalMinutes > 0 && this.p6FinishBoundaryStartTaskIds.has(task.id)) {
        const naturalDayStart = this.dayFirstBandStart(eng, natural);
        if (naturalDayStart?.getTime() === natural.getTime()) {
          return eng.prevWorkInstantBefore(natural);
        }
      }
      return natural;
    }
    if (eng.isHourMode) {
      if (isZeroDurationMilestone(task)) return new Date(finish.getTime());
      if (task.time.durationType === 'ELAPSEDTIME') return subtractElapsedMinutes(finish, elapsedMinutesOf(task, eng));
      const totalDays = task.time.scheduleDuration;
      if (totalDays <= 0) return new Date(finish.getTime());
      const firstDay = eng.subtractWorkDays(utcDayStart(finish), totalDays);
      return this.dayFirstBandStart(eng, firstDay) ?? firstDay;
    }
    // `isZeroDurationMilestone` i.p.v. de kale vlag — anders valt een dag-modus mijlpaal-met-duur-ELAPSEDTIME-taak hier stil
    // terug op de WORKTIME-tak (`addWorkingDaysSigned`, telt werkdagen, slaat weekend over) i.p.v.
    // de kloktijd-aftrek — exact het patroon dat msp-30 (FF+0 naar zo'n taak) blootlegde.
    if (isElapsedTask(task)) {
      return subtractElapsedMinutes(finish, elapsedMinutesOf(task, eng));
    }
    // `splitTotalSpanDays` geeft bij `dur===0` zelf al 0 terug (`splitTotalSpanMinutes`s
    // `workMinutes<=0`-kortsluiting, spiegelt `addWorkMinutes`) — geen aparte `dur>0`-wacht nodig.
    const totalDur = splitTotalSpanDays(task, eng);
    return eng.addWorkingDaysSigned(finish, -(totalDur > 0 ? totalDur - 1 : 0));
  }
  /** Leid de voorganger-FINISH af uit zijn late START (SS/SF backward, spiegel van
   *  `startFromFinish`): ELAPSEDTIME ⇒ kale 24/7-klokoptelling; uur (WORKTIME) ⇒ `addWorkMinutes`;
   *  dag (WORKTIME) ⇒ `addWorkingDaysSigned(dur−1)`. Zelfde mijlpaal-asymmetrie-voorbehoud als
   *  `startFromFinish` hierboven.
   *
   *  Splits — zelfde as-wandeling, spiegel van `startFromFinish` hierboven. */
  private finishFromStart(eng: CalendarEngine, start: Date, task: Task): Date {
    if (eng.isHourMode && taskDurationUnit(task) === 'hours') {
      if (isZeroDurationMilestone(task)) return new Date(start.getTime());
      if (task.time.durationType === 'ELAPSEDTIME') {
        return addElapsedMinutes(start, elapsedMinutesOf(task, eng));
      }
      const totalMinutes = splitTotalSpanMinutes(task.splitGaps, durationMinutesOf(task, eng));
      const walkStart = totalMinutes > 0 && this.p6FinishBoundaryStartTaskIds.has(task.id)
        && this.isExactBandEnd(eng, start)
        ? eng.nextWorkInstantAfter(start)
        : start;
      return eng.addWorkMinutes(walkStart, totalMinutes);
    }
    if (eng.isHourMode) {
      if (isZeroDurationMilestone(task)) return new Date(start.getTime());
      if (task.time.durationType === 'ELAPSEDTIME') return addElapsedMinutes(start, elapsedMinutesOf(task, eng));
      const totalDays = task.time.scheduleDuration;
      if (totalDays <= 0) return new Date(start.getTime());
      const lastDay = eng.addWorkDaysChecked(utcDayStart(start), totalDays).date;
      return this.dayLastBandEnd(eng, lastDay) ?? lastDay;
    }
    // `isZeroDurationMilestone` — zelfde reden als `startFromFinish` hierboven.
    if (isElapsedTask(task)) {
      return addElapsedMinutes(start, elapsedMinutesOf(task, eng));
    }
    const totalDur = splitTotalSpanDays(task, eng);
    return eng.addWorkingDaysSigned(start, totalDur > 0 ? totalDur - 1 : 0);
  }
  /** Getekende float in eigen-kalender-WERKDAGEN: uur ⇒ fractioneel
   *  `workMinutesBetween / (hoursPerDay × 60)`; dag ⇒ de integer `signedWorkDaysBetween`.
   *  ELAPSEDTIME (msp-14): `a`/`b` mogen op een niet-werkdag liggen (24/7-taak) —
   *  `workDaysBetween`/`signedWorkDaysBetween` gaan daar stuk (spook-tf, zie `signedElapsedSpan`'s
   *  moduleheader in `duration.ts`), dus een ELAPSEDTIME-taak krijgt de kale klok-span i.p.v.
   *  werkdag-telling. `task` optioneel: afwezig (of WORKTIME) ⇒ de uur-/dagtak. */
  private signedFloat(a: Date, b: Date, eng: CalendarEngine, task?: Task): number {
    if (task?.time.durationType === 'ELAPSEDTIME') return signedElapsedSpan(a, b, eng);
    if (eng.isHourMode && (!task || isZeroDurationMilestone(task) || taskDurationUnit(task) === 'hours')) {
      return eng.workMinutesBetween(a, b) / (eng.hoursPerDay * 60);
    }
    return eng.signedWorkDaysBetween(a, b);
  }

  solve(): CPMResult {
    // Idempotentie: reset ALLE per-solve accumulerende instance-state, zodat een tweede
    // solve() op dezelfde instance gelijk is aan een verse instance (geen duplicaten
    // uit een vorige run in de side-channels). De overige velden zijn constructor-vast
    // (graaf/kalenders/opties) of worden per solve onvoorwaardelijk herschreven; de
    // engine-cache is deterministisch per kalender-id en mag blijven staan.
    this.seqConstraint.clear();
    this.completedOutOfSequenceEs.clear();
    this.completedOutOfSequenceRelation.clear();
    this.completedPhysicalPoints.clear();
    this.truncatedLeadIds = [];
    this.hardPinViolatedIds = [];
    this.hammockNoFinishDriverIds = [];
    this.cappedTaskIds = [];
    this.plannedFloorTraceByTaskId = {};
    // Diagnose-trace zonder rekeneffect; volgt conventie B3 als aan-schakelaar. Omdat B3 in elk
    // ingebouwd profiel uit staat, is de trace onder P6 standaard uit; de
    // enige lezer (`check-xer-backward-float-trace`) zet B3 als afwijking aan. Bewust niet
    // losgekoppeld: de trace beschrijft de B3-vensterroute en `result.backwardFloatTrace` hoort
    // afwezig te zijn als die route uit staat (gepind in diezelfde check).
    this.backwardFloatTrace = this.options.schedulingOptions?.p6CompletedDataDateWindow === true
      ? { projectEndSource: 'maxEarlyFinish', byTaskId: {} }
      : undefined;
    this.dataDate = null; // wordt hieronder herzet; zo blijft hij ook over guard-returns heen nooit stale
    this.rawDataDate = null;
    this.projectStartRaw = null; // idem — herzet vóór elke solve, nooit stale over guard-returns heen

    // Check for circular dependencies before running CPM
    const cycle = this.detectCycle();
    if (cycle) {
      const cycleNames = cycle.map(id => this.tasks.get(id)?.name || id);
      // `cycle` sluit de lus (eerste knoop staat ook achteraan); voor navigatie tellen unieke ids.
      return emptyResult({ code: 'cycle', cycleNames }, [...new Set(cycle)]);
    }

    // Guard: een kalender zonder werkdagen zou anders (via de MAX_SCAN-fallback) stil
    // datums ver in de toekomst opleveren zonder enige waarschuwing. Degradeer met een fout.
    if (!this.projectEngine.hasWorkingDays()) {
      return emptyResult({ code: 'noWorkingDays' });
    }

    // Elke expliciete eenheid heeft precies een eigen invoerbron. Valideer die bron voor er ook
    // maar een datum of afgeleide duur wordt teruggeschreven: anders zou een ontbrekende/negatieve
    // urenduur via `?? 0` stil als nulpunt worden gepland, of een corrupte dagduur achteruit lopen.
    for (const task of this.tasks.values()) {
      const unit = taskDurationUnit(task);
      const source = unit === 'hours' ? task.time.durationMinutes : task.time.scheduleDuration;
      if (typeof source !== 'number' || !Number.isFinite(source) || source < 0) {
        const code = unit === 'hours' ? 'invalidHourDuration' : 'invalidDayDuration';
        return emptyResult({ code, taskName: task.name });
      }
    }

    // Een WORKTIME-urentaak heeft geen geldige dagfallback: haar exacte minuten kunnen uitsluitend
    // door concrete werkblokken worden verdeeld. Dit vangt ook bestaande/geïmporteerde urentaken
    // wanneer hun kalender later naar een bandloze dagkalender wordt gewisseld. De taakbron blijft
    // onaangeroerd; de solve stopt vóór enige datum- of duurmutatie.
    for (const task of this.tasks.values()) {
      if (taskDurationUnit(task) === 'hours'
        && task.time.durationType === 'WORKTIME'
        && !this.calendarFor(task).isHourMode) {
        return emptyResult({ code: 'hourTaskWithoutWorkHours', taskName: task.name });
      }
    }

    // Guard: een taak met een onparseerbare startdatum zou anders Invalid Dates
    // opleveren die het formatteren laten crashen (en vóór de lus-grenzen: hangen).
    // Degradeer netjes met een foutmelding i.p.v. te crashen.
    for (const task of this.tasks.values()) {
      if (isNaN(parseDate(task.time.scheduleStart).getTime())) {
        return emptyResult({ code: 'invalidStartDate', taskName: task.name });
      }
    }

    // Werkdag-gesnapte statusdatum. Ongeldig/afwezig ⇒ null (alle voortgangstakken no-op).
    // Uur-projectkalender ⇒ instant-snap via `nextWorkInstant`; dag ⇒ `nextWorkDay`.
    const dd = this.options.dataDate ? this.parseIn(this.projectEngine, this.options.dataDate) : null;
    this.dataDate = dd && !isNaN(dd.getTime()) ? this.snapOnOrAfter(this.projectEngine, dd) : null;
    this.rawDataDate = this.dataDate === null ? null : dd;

    // Projectstartdatum (RUW, ongesnapt — zie `rootFloor`/`projectStartRaw`). Date-only strings
    // (het enige wat de wizard/`DateTextInput` produceren) parsen via `parseDate` modus-onafhankelijk
    // identiek aan `parseInstant`, dus één simpele `parseDate` hier volstaat (geen `this.parseIn`
    // nodig — die zou voor een instant-projectkalender de tijd-component willen behouden, die
    // `project.startDate` nooit heeft).
    const psd = this.options.projectStartDate ? parseDate(this.options.projectStartDate) : null;
    this.projectStartRaw = psd && !isNaN(psd.getTime()) ? psd : null;

    const order = this.topologicalSort();
    const earlyDates = this.forwardPass(order);
    const lateDates = this.backwardPass(order, earlyDates);
    this.applyAlap(order, earlyDates, lateDates);
    const outOfSequenceSequenceIds = this.detectOutOfSequence(earlyDates);
    // Resultaat-post-pass (geëxtraheerd naar `scheduleAnalysis.ts`): pure functie over de vaste
    // early/late-datums + de forward-pass-side-channels; de helpers zijn stateless en gebonden.
    const result = computeScheduleResults({
      order,
      earlyDates,
      lateDates,
      outOfSequenceSequenceIds,
      tasks: this.tasks,
      sequences: this.sequences,
      successors: this.successors,
      seqConstraint: this.seqConstraint,
      schedulingOptions: this.options.schedulingOptions,
      dataDate: this.dataDate,
      truncatedLeadIds: this.truncatedLeadIds,
      hardPinViolatedIds: this.hardPinViolatedIds,
      hammockNoFinishDriverIds: this.hammockNoFinishDriverIds,
      projectEngine: this.projectEngine,
      calendarFor: (t) => this.calendarFor(t),
      progressCalendarFor: (t) => this.progressCalendarFor(t),
      signedFloat: (a, b, eng, task) => this.signedFloat(a, b, eng, task),
      constraintInstant: (c, eng) => this.constraintInstant(c, eng),
      snapOnOrAfter: (eng, d) => this.snapOnOrAfter(eng, d),
      snapOnOrBefore: (eng, d) => this.snapOnOrBefore(eng, d),
      modeOf: (eng) => this.modeOf(eng),
      backwardFloatTrace: this.backwardFloatTrace,
      completedOutOfSequenceEs: this.completedOutOfSequenceEs,
      completedPhysicalPoints: this.completedPhysicalPoints,
    });
    // Zachte waarschuwing: alleen bij een echt onwerkbaar venster het veld zetten (anders afwezig).
    // `Set`-dedupe: de voortgangstak kan per taak TWEE checked-aanroepen doen (het
    // `elapsedAnchor`-hervattingspunt én de `ef`-restwerk-optelling), die allebei tegen de cap kunnen
    // lopen.
    if (this.cappedTaskIds.length > 0) result.cappedTaskIds = [...new Set(this.cappedTaskIds)];
    if (Object.keys(this.plannedFloorTraceByTaskId).length > 0) {
      result.plannedFloorTraceByTaskId = { ...this.plannedFloorTraceByTaskId };
    }
    if (this.backwardFloatTrace) {
      result.backwardFloatTrace = {
        projectEndSource: this.backwardFloatTrace.projectEndSource,
        byTaskId: { ...this.backwardFloatTrace.byTaskId },
      };
    }
    // Idem voor relaties die een niet-bladtaak raakten en al bij de constructie genegeerd zijn (zie
    // de guard in de constructor); anders afwezig.
    if (this.droppedSequenceIds.length > 0) result.droppedSequenceIds = [...this.droppedSequenceIds];
    return result;
  }

  /** Detect cycles using DFS. Returns array of task IDs in the cycle, or null. */
  private detectCycle(): string[] | null {
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const id of this.tasks.keys()) {
      color.set(id, 0); // WHITE
    }

    for (const id of this.tasks.keys()) {
      if (color.get(id) === 0) {
        const cycle = this.dfsVisit(id, color, parent);
        if (cycle) return cycle;
      }
    }
    return null;
  }

  private dfsVisit(
    u: string,
    color: Map<string, number>,
    parent: Map<string, string | null>,
  ): string[] | null {
    color.set(u, 1); // GRAY

    for (const seq of this.successors.get(u) || []) {
      const v = seq.successorId;
      if (!this.tasks.has(v)) continue;

      if (color.get(v) === 1) { // GRAY = back edge
        // Back edge found - reconstruct cycle
        const cycle: string[] = [v, u];
        let current = u;
        while (current !== v) {
          const p = parent.get(current);
          if (p === null || p === undefined) break;
          cycle.push(p);
          current = p;
          if (current === v) break;
        }
        cycle.reverse();
        return cycle;
      }

      if (color.get(v) === 0) { // WHITE
        parent.set(v, u);
        const cycle = this.dfsVisit(v, color, parent);
        if (cycle) return cycle;
      }
    }

    color.set(u, 2); // BLACK
    return null;
  }

  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    for (const id of this.tasks.keys()) {
      inDegree.set(id, 0);
    }
    for (const seq of this.sequences) {
      inDegree.set(seq.successorId, (inDegree.get(seq.successorId) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      result.push(id);
      for (const seq of this.successors.get(id) || []) {
        const newDeg = (inDegree.get(seq.successorId) || 1) - 1;
        inDegree.set(seq.successorId, newDeg);
        if (newDeg === 0) queue.push(seq.successorId);
      }
    }

    // Tasks not in the dependency graph (isolated) are still included
    for (const id of this.tasks.keys()) {
      if (!result.includes(id)) result.push(id);
    }

    return result;
  }

  private forwardPass(order: string[]): Map<string, { es: Date; ef: Date }> {
    const results = new Map<string, { es: Date; ef: Date }>();
    // Vroegste projectstart (= vroegste start onder de taken zónder voorganger, ELK al geklemd op
    // de geconfigureerde projectstartdatum via `rootFloor`). Dient als ondergrens zodat een
    // negatieve lag (lead) een taak niet vóór het projectbegin trekt. Vooraf bepaald, zodat de
    // topologische volgorde de uitkomst niet beïnvloedt. Dit is de ENIGE plek waar `rootFloor`
    // klemt — de eigen ES-tak van een wortel-taak hieronder gebruikt `ownAnchor` (ongeklemd);
    // `hammockEarlyStart` gebruikt `projectStart` als basis.
    let projectStart: Date | null = null;
    for (const t of this.tasks.values()) {
      if ((this.predecessors.get(t.id) || []).length > 0) continue;
      const eng = this.calendarFor(t);
      // `isZeroDurationMilestone` i.p.v. de kale vlag — een mijlpaal-met-duur die zelf ELAPSEDTIME is,
      // telt als "root-elapsed" (spiegelt `snapSuccessorEarlyStart` hierboven).
      const s = this.rootFloor(eng, t.time.scheduleStart, isElapsedTask(t));
      if (!projectStart || s < projectStart) projectStart = s;
    }

    for (const taskId of order) {
      const task = this.tasks.get(taskId)!;
      const cal = this.calendarFor(task);
      const preds = this.predecessors.get(taskId) || [];
      // Hier al berekend: de IN-PROGRESS-tak hieronder (`if (usedResumeOverride...) { ...
      // results.set(...); continue; }`) heeft haar EIGEN `ef`-berekening en `continue`t vóór de gewone
      // AUTO-tak, en de timephased-finish-override moet op beide plekken gelden. `hardPinFinish` is
      // een pure functie van `task`/`cal` — één berekening, twee toepassingsplekken.
      const hardFinishPin = this.hardPinFinish(task, cal);

      // ── Hammock / Level of Effort ───────────────────────────────────
      // Een hammock loopt mee in topologische volgorde (drivers staan er per definitie vóór). ES =
      // de gewone forward-max over SS/FS-voorganger-bounds + projectstart-vloer; EF = de max over de
      // FF/SF-voorganger-bounds (ondergrens ES). De AFGELEIDE duur (span ES→EF) wordt naar
      // precies één afgeleide duurbron (`scheduleDuration` of `durationMinutes`) geschreven; eigen duur-invoer
      // wordt genegeerd. `isHammock` afwezig ⇒ deze tak draait niet.
      // Gebruik hier bewust de rauwe XER-datadatum, vóór kalendersnap. De smalle guard vergelijkt
      // haar met het opgeslagen actual-finish-instant; een naar de volgende werkband gesnapte datum
      // zou een actualFinish ná P6's datadatum ten onrechte toelaten.
      const completedXerLoeActualFinish = explainCompletedXerLoeActualFinishEligibilityResolved(
        task,
        this.options.dataDate ? parseInstant(this.options.dataDate) : null,
        this.options.schedulingOptions,
        preds,
        this.successors.get(taskId) || [],
      );
      if (task.isHammock && !completedXerLoeActualFinish.eligible) {
        const relationalEarlyStart = this.hammockEarlyStart(task, preds, results, projectStart, cal);
        // De duurmeting is een uurkalender-primitief en hoort pas ná de expliciete XER-bronpoort
        // bereikbaar te zijn. Generieke hammocks en een onvolledige XER-dagkalender sluiten hier
        // fail-closed via NaN; `explainOpenXerLoeTargetSpanEligibilityResolved` leest dat alleen nadat alle
        // voorafgaande bron-/provenance-/taakpoorten zijn gepasseerd.
        const targetWindowWorkMinutes = this.options.schedulingOptions?.p6OpenLoeTargetSpan === true
          && cal.isHourMode
          ? cal.workMinutesBetween(
              parseInstant(task.time.scheduleStart),
              parseInstant(task.time.scheduleFinish),
            )
          : Number.NaN;
        const openXerLoeTargetSpan = explainOpenXerLoeTargetSpanEligibilityResolved(
          task,
          this.options.schedulingOptions,
          preds,
          this.successors.get(taskId) || [],
          relationalEarlyStart,
          targetWindowWorkMinutes,
          cal.hoursPerDay * 60,
        );
        const es = openXerLoeTargetSpan.eligible
          ? parseInstant(task.time.scheduleStart)
          : relationalEarlyStart;
        const { ef, hasFinishDriver } = openXerLoeTargetSpan.eligible
          ? { ef: parseInstant(task.time.scheduleFinish), hasFinishDriver: true }
          : this.hammockEarlyFinish(task, preds, results, es, cal);
        if (!hasFinishDriver) this.hammockNoFinishDriverIds.push(taskId);
        // Een ELAPSEDTIME-hammock drukt zijn afgeleide span uit in KLOK-tijd, niet in WERKtijd
        // (`workMinutesBetween`/`workDaysBetween` tellen alleen tijd binnen kalenderbanden); de
        // uur-omrekening deelt door de VASTE klokdag (24 × 60), NOOIT door `cal.hoursPerDay`
        // (dubbele-deling-valkuil).
        // Hammockduur is volledig afgeleid, niet door de gebruiker gekozen. Leg na elke solve
        // precies één passende bron vast: minuten als de kalender concrete banden heeft, anders
        // werkdagen. De vier takken staan in `duration.ts`s `writeDerivedSpan`, gedeeld met de
        // verzameltaak-rollup (`applyCpmResult`).
        writeDerivedSpan(task, es, ef, cal);
        results.set(taskId, { es, ef });
        continue;
      }

      // ── Handmatig gepland ──────────────────────────────────────────────────────────────────
      // MS Project "Manually Scheduled": een `manuallyScheduled`-taak houdt haar EIGEN opgeslagen
      // `time.scheduleStart`/`scheduleFinish` RAUW aan — geen kalendersnap (MSP snapt een
      // manual-anker nooit naar de werkband), geen relatiedruk (haar OPVOLGERS rekenen gewoon door op
      // `results`) en geen constraint-afdwinging. `mppReader.ts`'s `resolveScheduleField` zorgt dat
      // een `.mpp`-import al het JUISTE veldpaar draagt (1283/1284 i.p.v. 35/36).
      //
      // CONSTRAINT VS. MANUAL: MANUAL WINT — ook boven een harde MSO/MFO-pin; de constraint is dan
      // een dode letter (`msp-58-z9a-manual-wint-van-constraint`, `violatedConstraintsSet` leeg).
      //
      // PRECEDENTIE: deze tak staat vóór de resume-override, het progressCal/timephased-venster en de
      // leveling-delay-ankerregel — een manual taak met voortgang/venster/delay behoudt haar eigen
      // rauwe anker. Gemeten: 10 van de 1659 corpusbrede manual-taken dragen óók voortgang en
      // `resume` (o.a. `mpp14timephasedsegmentsmanual.mpp`'s "Task Three"/"Task Four": de rauwe
      // manual-start 07:00 is MSP's eigen opgeslagen START). Geen gemeten manual-taak draagt
      // `levelingDelayMinutes`.
      //
      // Spiegelt de VOLTOOID-tak qua vorm: `parseIn` (GEEN snap) + dezelfde ef<es-inversiecorrectie
      // voor een bestand dat een finish vóór de start opslaat.
      if (task.manuallyScheduled) {
        let es = this.parseIn(cal, task.time.scheduleStart);
        const ef = this.parseIn(cal, task.time.scheduleFinish);
        if (ef < es) es = ef;
        results.set(taskId, { es, ef });
        continue;
      }

      let earlyStart: Date;
      // START_FINISH (`mpp14relations.mpp`/"Task 5"): een SF-vereiste-finish
      // ("niet eerder dan pred.START + lag") is een APARTE ondergrens op de EARLY FINISH, naast de
      // gewone `earlyStart`-druk die `forwardConstraint` hierboven al levert — zie
      // `forwardFinishFloor`'s moduleheader in `relationMath.ts` voor de volledige diagnose (het
      // symptoom: `earlyFinish` hieronder wordt UNIFORM als `ES + duur` VOORWAARTS herberekend, wat
      // voor SF de vereiste finish verliest zodra de terugtelling exact een niet-werkperiode
      // overspant). `null` ⇒ geen SF-voorganger (de `if` bij de toepassing hieronder is dan een
      // no-op). Blijft `null` bij `preds.length === 0` (een wortel-taak heeft geen
      // voorganger-relatie om een finish te eisen).
      let sfFinishFloor: Date | null = null;
      // Gezet in de `noPreds`-tak hieronder zodra de taak-eigen `scheduleStart` een gedegenereerd
      // band-eind-anker is (zie `rootAnchorIsBandEnd`/`timephasedAnchorIsDegenerateResnap` daar) —
      // `timephasedFinish()` gebruikt deze vlag om `task.timephasedFinishFloor` in dat geval over te
      // slaan, spiegelt de START-kant.
      let timephasedFinishFloorIsDegenerateResnap = false;

      // ANKERREGEL: `preds.length === 0` bepaalt hieronder al welke tak `earlyStart`
      // levert (eigen anker vs. voorganger-gedreven herrekening) — hergebruikt verderop om de
      // nivelleer-vertraging te clausuleren (zie de toelichting daar). Eén boolean, geen tweede
      // `preds.length`-check die uit de pas zou kunnen lopen met de branch-keuze hieronder.
      const noPreds = preds.length === 0;
      if (noPreds) {
        // Dezelfde ELAPSEDTIME-bypass als `snapSuccessorEarlyStart`, hier voor de WORTEL-taak: zonder
        // wacht duwt `ownAnchor`s `snapOnOrAfter` een elapsed-taak met een weekend-anker (bv.
        // scheduleStart = zaterdag, geen voorganger) alsnog naar maandag. Het constraint-PAD
        // (`applyForwardConstraints`/`forwardBoundOf`) blijft bewust ONGEMOEID (zie `hardPinStart`):
        // een SNET/MSO-datum snapt nog steeds naar een werk-instant, ook op een elapsed taak.
        // `isZeroDurationMilestone` i.p.v. de kale vlag — zelfde reden als de precompute-lus hierboven.
        const rootElapsed = isElapsedTask(task);
        // Timephased-anker (zie `mppReader.ts`'s `deriveTimephasedWindowsForTasks`-moduleheader voor
        // het corpusbewijs): een wortel-taak met een timephased-toewijzing
        // wier eigen `AssignmentField.START` buiten de TAAK-kalenderband ligt maar binnen haar EIGEN
        // resourcekalender (corpusvoorbeeld: een "Night Shift"-resource om 23:00) draagt dat instant
        // al RAUW, precies zoals `rootElapsed` hieronder — MSP snapt dat niet naar de eerstvolgende
        // taak-kalender-werk-instant, `ownAnchor` zou dat wél doen. Afwezig ⇒ de `ownAnchor`-tak.
        //
        // Geen teruggelezen rekenuitvoer: bij een WORTEL-taak (geen voorganger) is de start per
        // definitie ALTIJD een gelezen anker — nooit een CPM-berekende waarde — dat is precies
        // `ownAnchor` (`task.time.scheduleStart`). `timephasedAnchor` (`task.timephasedStartAnchor`,
        // `AssignmentField.START`) is dus geen ALTERNATIEF soort mechanisme t.o.v. ownAnchor — het is
        // een PRECIEZER gelezen anker uit een ANDERE bronlocatie (toewijzingsniveau i.p.v. taakniveau),
        // beide even "gelezen". De rechtvaardiging is het INVOERFEIT: MSP bewaart op toewijzings-
        // niveau een ONGESNAPT instant (`AssignmentField.START` ligt in het corpusvoorbeeld buiten
        // de taak-kalenderband en binnen de resourcekalender) — het toewijzingsveld draagt dus
        // broninformatie die het taakveld mist, en die lezen we, net als `ownAnchor`, als anker. Zonder
        // deze tak verandert het gedrag meetbaar (o.a. mpp14timephased.mpp en
        // mpp14timephasedsegmentsmanual(offsets).mpp op hun wortel-taken).
        // Uitzondering (`timephased-prorated-cost-resource.mpp`, taak "No Progress - Actual Cost"):
        // `timephasedAnchor` hierboven is normaal een PRECIEZER
        // gelezen anker dan `ownAnchor` (zie de toelichting hierboven) — maar in dit ene corpusgeval
        // is de taak-eigen `scheduleStart` een gedegenereerd BAND-EIND-anker (`ownAnchor`s eigen
        // vrijstelling hierboven), en is `timephasedAnchor` daar NIET onafhankelijk van: hij valt op
        // het bandgrens-gesnapte taak-anker. MSP's EIGEN `SCHEDULED_START` houdt hier het rauwe
        // band-eind aan. De regel is een invoer-conditie, geen vergelijking met onze eigen
        // berekening: ELKE wortel-taak met een gedegenereerd band-eind-anker negeert laag 3 volledig
        // (`timephasedAnchor`/`timephasedFinishFloor`); voor élke andere taak (zoals de "Night
        // Shift"-populatie) is dit `false` en houdt `timephasedAnchor` de voorkeur.
        const rawOwnAnchor = this.parseIn(cal, task.time.scheduleStart);
        const rootAnchorIsBandEnd = this.isExactBandEnd(cal, rawOwnAnchor);
        const timephasedAnchorIsDegenerateResnap = !!task.timephasedStartAnchor && rootAnchorIsBandEnd;
        const timephasedAnchor = timephasedAnchorIsDegenerateResnap ? undefined : task.timephasedStartAnchor;
        // FINISH-tegenhanger van de vlag hierboven: `task.timephasedFinishFloor` (laag 3) komt
        // van DEZELFDE toewijzing als `timephasedStartAnchor`, dus geldt dezelfde invoer-conditie.
        // `timephasedFinish()` leest deze vlag verderop om `task.timephasedFinishFloor` in dat geval
        // over te slaan, zodat `addDurationChecked`s eigen band-eind-correctie (zie die functie) het
        // laatste woord houdt — anders zou laag 3 die correctie hier alsnog ongedaan maken.
        timephasedFinishFloorIsDegenerateResnap = !!task.timephasedFinishFloor && rootAnchorIsBandEnd;
        // Geen voorganger: de eigen geplande start, ONGEKLEMD tegen de projectstart ("een ingelezen
        // anker wordt nooit door de vloer overruled"; zie `ownAnchor`). Een harde
        // MSO/MFO-pin (hieronder in `applyForwardConstraints`) wint hier nog steeds
        // onvoorwaardelijk: die controleert `hardPinStart` EERST en retourneert dan meteen, vóór
        // deze waarde ooit gezien wordt.
        earlyStart = rootElapsed
          ? this.parseIn(cal, task.time.scheduleStart)
          : timephasedAnchor
            ? parseInstant(timephasedAnchor)
            : this.ownAnchor(cal, task.time.scheduleStart, task);
        // Conventie C14 `p6AlapPositionedFromSuccessors`: een niet-gestarte ALAP-wortel heeft geen
        // eigen anker; haar vroege start is de statusdatum, en `applyAlapFromSuccessors` legt haar
        // daarna zo laat als haar opvolgers toestaan.
        if (this.dataDate && this.isUnstartedAlapPositionedFromSuccessors(task, cal)) {
          earlyStart = this.snapOnOrAfter(cal, this.dataDate);
        }
        // Geen voorganger-druk ⇒ rawMax null ⇒ een (root-)pin kan de logica niet breken.
        const beforeConstraint = earlyStart;
        earlyStart = this.applyForwardConstraints(task, earlyStart, null, cal);
        // Heeft de constraint-toepassing hierboven `earlyStart` daadwerkelijk VERPLAATST (een
        // bindende constraint-grens)? Zo niet — geen constraint, of wel een constraint maar niet
        // bindend — dan is `earlyStart` nog altijd exact `ownAnchor`s eigen resultaat, en heeft de
        // her-snap hieronder NIETS te doen: `ownAnchor` heeft de band-eind-vrijstelling (zie haar
        // docblok) al zelf correct toegepast; zonder wacht zou de her-snap die vrijstelling ongedaan
        // maken (`snapOnOrAfter` behandelt een band-eind-instant als "niet-werk").
        const constraintMoved = earlyStart.getTime() !== beforeConstraint.getTime();
        // Her-snap ná de constraint — spiegelt de voorganger-tak.
        // `applyForwardConstraint` levert een DAG-conceptuele grens (`nextWorkDay`/
        // `addWorkingDaysSigned`), in uur-modus een middernacht-instant die NIET op een
        // werk-instant valt; zonder her-snap rapporteert een constrained root-taak zijn ES op 00:00
        // i.p.v. de bandstart (de `earlyFinish` rekent al vanaf de bandstart ⇒ interne inconsistentie).
        // Idempotent in dag-modus (`nextWorkDay` van een werkdag = diezelfde werkdag) en bij een
        // niet-bindende constraint (ES al gesnapt).
        // `rootElapsed`/`timephasedAnchor`/`!constraintMoved` slaan deze her-snap over (zelfde
        // MSP-pariteitsgrond als hierboven) — een ONgeconstrainde taak (of een niet-bindende
        // constraint) met zo'n raw anker had hier toch al niets te her-snappen; alleen mét een
        // WERKELIJK bindende (werk-instant-snappende) constraint kan deze tak ooit iets anders dan
        // het rauwe anker geven.
        earlyStart = (rootElapsed || timephasedAnchor || !constraintMoved) ? earlyStart : this.snapOnOrAfter(cal, earlyStart);
      } else {
        // Early start = max van alle voorganger-constraints, met de projectstart als ondergrens.
        // Die ondergrens is correct vóór ÉLKE relatie: relatie-constraints (FS/SS/FF/SF) zijn
        // ondergrenzen ("niet eerder dan…"), nooit gelijkheden — een taak start dus op z'n
        // vroegst bij het projectbegin. Zo blijft een niet-bindende FF/SF gewoon op de anker
        // (de opvolger haalt de eis vanzelf) en wordt een lead niet vóór dag 1 getrokken.
        earlyStart = projectStart ? new Date(projectStart.getTime()) : new Date(0);
        let rawMax: Date | null = null;
        const c6FloatBoundaries: Array<[string, Date, Date]> = [];
        for (const seq of preds) {
          const rawPredResult = results.get(seq.predecessorId);
          const predTask = this.tasks.get(seq.predecessorId);
          if (!rawPredResult || !predTask) continue;
          const c6LagEng = this.relDeps.lagEngine(this.relationEngineFor(predTask), cal);
          const oosSeq = this.completedOutOfSequenceRelationSeq(predTask, seq, cal);
          const relSeq = this.inProgressStartLagSeq(predTask, oosSeq, c6LagEng);
          // Projectoptie `startToStartLagFrom` = 'actualStart': de rest-lag vanaf de statusdatum.
          const predResult = this.inProgressStartLagAnchor(
            predTask, oosSeq, c6LagEng, this.completedPredecessorRelationWindow(predTask, rawPredResult),
          );
          const constraintDate = forwardConstraint(
            this.relDeps, predResult, predTask, relSeq, task, this.relationEngineFor(predTask), cal,
            this.p6ZeroDurationUsesFinishBoundary(task, cal),
          );
          this.seqConstraint.set(seq.id, constraintDate);
          // Conventie C7 voorwaarts: alleen de relatiegrens voor de vrije speling, nooit de vroege
          // start van de mijlpaal (die blijft op de gewone grens; zie het docblok in `types/project.ts`).
          if (this.finishFinishAtStartMilestoneLateFinish(seq, task, this.relationEngineFor(predTask), cal)) {
            c6FloatBoundaries.push([seq.id, forwardConstraint(
              this.relDeps, predResult, predTask, relSeq, task, this.relationEngineFor(predTask), cal,
              this.p6ZeroDurationUsesFinishBoundary(task, cal), true,
            ), constraintDate]);
          }
          if (!rawMax || constraintDate > rawMax) rawMax = constraintDate;
          if (constraintDate > earlyStart) {
            earlyStart = constraintDate;
          }
          // SF-vereiste-finish als aparte ondergrens (zie de toelichting bij `sfFinishFloor`s
          // declaratie hierboven) — `null` voor alle andere relatietypes, dus deze regel is een
          // no-op zonder SF-voorganger.
          const finishFloor = forwardFinishFloor(
            this.relDeps, predResult, predTask, relSeq, task, this.relationEngineFor(predTask), cal,
            this.p6ZeroDurationUsesFinishBoundary(task, cal),
          );
          if (finishFloor && (!sfFinishFloor || finishFloor > sfFinishFloor)) sfFinishFloor = finishFloor;
        }
        // C7: een niet-bindende FF naar de startmijlpaal krijgt de grens zonder dagsprong, zodat de
        // vrije speling tot de mijlpaal zelf telt. Een bindende (= maximale) relatie houdt de gewone
        // grens: zij blijft driving en de vroege start verschuift niet.
        for (const [seqId, c6Boundary, normalBoundary] of c6FloatBoundaries) {
          if (rawMax && normalBoundary < rawMax) this.seqConstraint.set(seqId, c6Boundary);
        }
        // P6-bronsemantiek: target_start is alleen een aanvullende geplande vloer wanneer zowel
        // het geplande begin als einde meer dan één kalenderdag ná het netwerkvenster liggen. Dat
        // dubbele criterium voorkomt dat een lang targetvenster of een gewone volgende-bandstart
        // als impliciete constraint wordt behandeld. Relatiedruk die later ligt blijft altijd winnen.
        if (this.options.schedulingOptions?.p6UseTaskPlannedStartFloor === true) {
          const plannedFloor = this.ownAnchor(cal, task.time.scheduleStart, task);
          const networkFinish = this.finishFromStart(cal, earlyStart, task);
          const plannedFinish = this.parseIn(cal, task.time.scheduleFinish);
          const p6InvertedFinishBoundary = isZeroDurationMilestone(task)
            && task.milestoneKind === 'FINISH' && plannedFinish < plannedFloor;
          const plannedWindowIsLater = p6InvertedFinishBoundary
            ? plannedFloor > earlyStart
            : plannedFloor.getTime() - earlyStart.getTime() > MS_PER_DAY
              && plannedFinish.getTime() - networkFinish.getTime() > MS_PER_DAY;
          // Conventie C8 `p6StartedTaskIgnoresPlannedStartFloor` (docblok + bron bij de sleutel in
          // `types/project.ts`): voor een lopende taak (werkelijke start, nog niet voltooid) is het
          // geplande venster geen vloer; haar resterende werk start op statusdatum + relatiegrens.
          const startedTaskSkipsFloor = this.options.schedulingOptions?.p6StartedTaskIgnoresPlannedStartFloor === true
            && !!task.time.actualStart && task.time.completion < 1;
          // Conventie C14 `p6AlapPositionedFromSuccessors`: voor een niet-gestarte ALAP-taak telt het
          // eigen geplande venster niet (`applyAlapFromSuccessors` positioneert haar vanuit de opvolgers).
          const alapSkipsFloor = this.isUnstartedAlapPositionedFromSuccessors(task, cal);
          if (
            task.p6ActivityType !== undefined
            && task.p6ExplicitTargetWindow === true
            && !Number.isNaN(plannedFloor.getTime())
            && !Number.isNaN(plannedFinish.getTime())
            && !Number.isNaN(networkFinish.getTime())
          ) {
            const drivingSequences = preds.filter(sequence =>
              this.seqConstraint.get(sequence.id)?.getTime() === earlyStart.getTime());
            const drivingSequence = drivingSequences.length === 1 ? drivingSequences[0] : undefined;
            const projectStartIsBoundary = drivingSequences.length === 0
              && projectStart?.getTime() === earlyStart.getTime();
            const drivingPredecessor = drivingSequence
              ? this.tasks.get(drivingSequence.predecessorId)
              : undefined;
            const boundarySource = drivingSequence
              ? drivingSequence.p6StartAtPredecessorFinishBoundary
                ? 'relationship:p6-predecessor-finish-boundary' as const
                : 'relationship' as const
              : 'project-start' as const;
            // Bij meerdere gelijke relatiedrivers is er geen unieke voorgangerbron. Laat de trace
            // dan geheel weg in plaats van een willekeurige relatie of projectstart te rapporteren.
            if (drivingSequence || projectStartIsBoundary) {
              this.plannedFloorTraceByTaskId[taskId] = {
                preFloorEarlyStart: earlyStart.toISOString().slice(0, 16),
                preFloorEarlyFinish: networkFinish.toISOString().slice(0, 16),
                targetStart: plannedFloor.toISOString().slice(0, 16),
                targetFinish: plannedFinish.toISOString().slice(0, 16),
                plannedWindowIsLater,
                floorApplied: plannedWindowIsLater && !startedTaskSkipsFloor && !alapSkipsFloor,
                boundarySource,
                ...(drivingSequence ? { boundarySequenceId: drivingSequence.id } : {}),
                ...(drivingPredecessor ? { boundaryPredecessorTaskCode: drivingPredecessor.wbsCode } : {}),
              };
            }
          }
          if (plannedWindowIsLater && !startedTaskSkipsFloor && !alapSkipsFloor) earlyStart = plannedFloor;
        }
        // Vloer-afkap: wilde óók de strengste relatie de taak nog vóór het projectbegin trekken,
        // markeer dan de bindende lead(s) als afgekapt — de gebruiker moet kunnen zien dat een
        // lead niet volledig benut wordt. Gedomineerde leads zijn gewoon non-driving, geen afkap.
        if (rawMax && projectStart && rawMax < projectStart) {
          for (const seq of preds) {
            const c = this.seqConstraint.get(seq.id);
            const predTask = this.tasks.get(seq.predecessorId);
            if (!c || !predTask) continue;
            // Zelfde lag-resolutie als de relatie-wiskunde zelf (incl. `lagMinutes`-only),
            // anders wordt een lead die alleen in minuten bestaat niet als afgekapt gemarkeerd.
            const predLagDays = resolveEffectiveLagDays(
              seq, predTask, this.calendarFor(predTask).hoursPerDay,
            );
            if (formatDate(c) === formatDate(rawMax) && predLagDays < 0) {
              this.truncatedLeadIds.push(seq.id);
            }
          }
        }
        // `rawMax` (voorganger-druk) voedt de harde-pin-logicaschending-detectie.
        earlyStart = this.applyForwardConstraints(task, earlyStart, rawMax, cal);
        const preserveP6FinishBoundary = preds.some(sequence =>
          sequence.p6StartAtPredecessorFinishBoundary === true
          && this.seqConstraint.get(sequence.id)?.getTime() === earlyStart.getTime());
        earlyStart = this.snapSuccessorEarlyStart(
          cal,
          earlyStart,
          task,
          preserveP6FinishBoundary,
        );
      }

      // Nivelleer-vertraging: TWEE BRONNEN, TWEE REGELS (zie de precedentie in
      // `shiftByLevelingDelay`s docblok):
      //
      // (1) `task.levelingDelay` (hele WERKdagen) — alleen door `ResourceLeveler` gezet. Altijd
      //     toegepast: de opgeslagen `scheduleStart` weet niets van de nivellering, ook bij een
      //     wortel-taak (anders blijft bv. `lvl-basic-conflict`s "B" ongenivelleerd).
      // (2) `task.levelingDelayMinutes`/`.levelingDelayElapsed` — alleen door `mppReader.ts` gezet uit
      //     `.mpp`'s LEVELING_DELAY. ANKERREGEL: alleen toegepast als `earlyStart` VOORGANGER-GEDREVEN
      //     is (`!noPreds`). Voor een `.mpp`-wortel-taak IS `scheduleStart` al MSP's eindantwoord,
      //     inclusief nivellering; nogmaals toepassen telt dubbel (`mpp14barstyle.mpp`). Een
      //     voorganger-gedreven early start wordt vers berekend en kent de vertraging nog niet (MSP:
      //     precedence-feasible start + delay).
      //
      // Corpus: van 19 `.mpp`-taken met `levelingDelayMinutes` hebben er 14 een voorganger (echte
      // nivellering); de 5 zonder zijn precies `mpp14barstyle.mpp`. Wortel + constraint + delay komt
      // niet voor en volgt de `noPreds`-regel (`msp-53-z6-anker-regel-wortel-met-constraint`).
      //
      // Backward: GEEN aftrek in `subDuration` zelf; de DOORGIFTE naar de voorganger staat bij de
      // aanroepplek in `backwardPass`. Beide bronnen afwezig/0 ⇒ no-op.
      if (task.levelingDelay) {
        earlyStart = this.shiftByLevelingDelay(cal, task, earlyStart, 1);
      } else if (!noPreds && task.levelingDelayMinutes) {
        earlyStart = this.shiftByLevelingDelay(cal, task, earlyStart, 1);
        // Een ELAPSED-FORMAAT vertraging
        // (`levelingDelayElapsed`) op een NIET-elapsed taak is een kale kloktijd-optelling die het
        // anker buiten de werkband kan duwen — de taak zelf blijft WORKTIME en moet dus alsnog op
        // een geldig werk-instant landen (`snapOnOrAfter`, dezelfde functie die de gewone
        // constraint-snap elders gebruikt). Een ELAPSEDTIME-taak zelf blijft bewust ONGESNAPT — die
        // mag legitiem buiten de band staan (`msp-51-z6-invariant-elapsed-opvolger-hele-dagen-delay`).
        // Zonder deze snap gaf het gemengde
        // ES 04:49/03:39 tegen MSP's 08:00 op twee WORKTIME-taken met een elapsed-vertraging); met
        // de snap exact. `msp-48-z6-elapsed-delay` pint dit corpusloos.
        const taskElapsedForSnap = isElapsedTask(task);
        if (!taskElapsedForSnap && task.levelingDelayElapsed) {
          earlyStart = this.snapOnOrAfter(cal, earlyStart);
        }
      }

      // Voortgang: actual-pinning + data-date-vloer. dataDate === null ⇒ elke tak is
      // een no-op (backwards-compat). `earlyStart` is hier al de retained-logic voorganger-druk.
      const dataDate = this.dataDate;
      // `progressCal`: de VOLTOOID-/IN-PROGRESS-tak hieronder rekent normaal in `cal` (de TAAK-eigen
      // kalender); voor een taak wier ENIGE toewijzing een écht afwijkende resourcekalender draagt
      // (`mppReader.ts`'s laag-4-activeringscriterium) is dat fout, óók als de taak al gestart/voltooid
      // is. `task.timephasedDurationWalks` (mppReader.ts zet 'm ook op completion>0-taken, uitsluitend
      // als kalenderREFERENTIE — geen gelezen datum, dus geen cirkelmeting) draagt bij precies 1 item de
      // te gebruiken resourcekalender-id. `progressCal` vervangt `cal` voor de VOLLEDIGE tak (niet
      // alleen de eind-`ef`): `remStart`/`actualES`/splits/resume rekenen anders half in de taak- en
      // half in de resourcekalender. Afwezig/niet-activeerbaar (>1 toewijzing, dag-modus-
      // resourcekalender, geen echte afwijking) ⇒ `progressCal = cal` — de overgrote meerderheid.
      const progressCal = this.progressCalendarFor(task, cal);
      this.recordCompletedOutOfSequenceWindow(task, preds, results, progressCal);
      const physicalPoint = this.recordCompletedPhysicalPoint(task, preds, results, progressCal);
      if (physicalPoint !== null) {
        // C5: één punt, ES = EF. Net als een gewone voltooide taak (hieronder) levert een voltooide
        // opvolger onder A12 geen relatiegrens voor vrije speling of driving.
        if (this.options.schedulingOptions?.preserveActualDatesInBackwardPass === true) {
          for (const seq of preds) this.seqConstraint.delete(seq.id);
        }
        results.set(taskId, { es: physicalPoint, ef: new Date(physicalPoint.getTime()) });
        continue;
      }
      {
        const t = task.time;
        if (isPinnedComplete(t)) {
          // (1) VOLTOOID: volledig gepind op actuals — geen forward-drift voorbij actualFinish.
          // `snapActualForward` i.p.v. een kale parse — snapt BINNEN dezelfde dag (bv. 07:00 →
          // 08:00), maar verplaatst nooit naar een andere dag (bv. zaterdag → maandag). Zie die
          // functie se docblock voor de twee corpusmetingen die dit reconcilieert.
          const preserveP6ActualInstants = task.p6ProjectId !== undefined
            && this.options.schedulingOptions?.p6PreserveActualInstants === true;
          const actualStart = this.parseIn(progressCal, t.actualStart ?? t.actualFinish);
          let es = preserveP6ActualInstants
            ? actualStart
            : this.snapActualForward(progressCal, actualStart);
          // Milestone: start én finish landen op dezelfde werk(dag)-grens (snap op-of-ná, niet -vóór).
          // `isZeroDurationMilestone` i.p.v. de kale vlag — een VOLTOOIDE mijlpaal-met-duur is voor de
          // PLANNING een gewone taak en volgt de NORMALE `snapOnOrBefore`-tak (haar `actualFinish` kan
          // dagen ná haar `actualStart` liggen); `snapOnOrAfter` zou haar EF voorbij haar eigen
          // actualFinish kunnen duwen.
          const actualFinish = this.parseIn(progressCal, t.actualFinish);
          let ef = preserveP6ActualInstants
            ? actualFinish
            : isZeroDurationMilestone(task)
              ? this.snapOnOrAfter(progressCal, actualFinish)
              : this.snapOnOrBefore(progressCal, actualFinish);
          // Inversie-randgeval: het HELE geregistreerde venster valt in onwerkbare tijd (weekend,
          // bouwvak, feestdagenblok) — dan snapt de start vóóruit tot ná de finish, die achteruit
          // snapte. Er bestaat dan geen werkdag binnen het feit, dus één van beide moet wijken.
          // Dat MOET de start zijn: een taak die is afgemeld hoort per definitie in het VERLEDEN,
          // nooit voorbij zijn eigen `actualFinish` (en al helemaal niet voorbij de statusdatum).
          // `ef = es` zou een op 2 augustus afgemelde taak naar de eerste werkdag ná de bouwvak tillen
          // (een week ná de statusdatum) en zijn opvolger vertragen. Met `es = ef` landt het paar op de
          // laatste werkdag op-of-vóór de `actualFinish` en start de opvolger op de eerste werkdag
          // daarna — precies waar het feit hem zet. Buiten dit randgeval (ef ≥ es) verandert er niets.
          if (ef < es) es = ef;
          // LAAG 1 van de gelaagde beslistabel (zie `mppReader.ts`'s
          // `deriveTimephasedWindowsForTasks`-moduleheader): een VOLTOOIDE taak plant onvoorwaardelijk
          // op `t.actualFinish` — GEEN timephased-venster hier (dat zou een cirkelmeting zijn;
          // `mppReader.ts` zet `timephasedFinishFloor`/`timephasedDurationWalks` nooit op een taak met
          // `completion >= 1`).
          // XER/P6-bronsemantiek: een voltooide opvolger is historisch en levert daarom ook geen
          // relatievrije-speling/driving-grens voor een nog open voorganger. De algemene solver-
          // default blijft ongewijzigd; alleen de expliciete bronvlag verwijdert deze grenzen.
          if (this.options.schedulingOptions?.preserveActualDatesInBackwardPass === true) {
            for (const seq of preds) this.seqConstraint.delete(seq.id);
          }
          results.set(taskId, { es, ef });
          continue;
        }
        if (isPinnedInProgress(t)) {
          // (2) IN PROGRESS — actualStart (store-route) óf impliciete actualStart = de gewone
          //     forward-pass-earlyStart (2b, vangnet voor rauwe legacy/externe data).
          // Niet achter `dataDate &&`: een taak die aantoonbaar gestart is (`actualStart`/`completion>0`)
          // pint haar ES op die start, MET of ZONDER statusdatum. `remStart` hieronder valt zonder
          // statusdatum terug op `actualES` zelf (RETAINED_LOGIC's `max(dataDate, voorganger-druk)`
          // krijgt alleen een andere startwaarde vóór de max).
          // `snapActualForward` i.p.v. een kale parse — dezelfde dag-behoudende snap als de
          // VOLTOOID-branch, zodat een lopende en een voltooide taak met dezelfde weekend-actualStart
          // hetzelfde antwoord krijgen.
          const actualES = t.actualStart
            ? task.p6ProjectId !== undefined
                && this.options.schedulingOptions?.p6PreserveActualInstants === true
              ? this.parseIn(progressCal, t.actualStart)
              : this.snapActualForward(progressCal, this.parseIn(progressCal, t.actualStart))
            : earlyStart;
          // Restwerk volgt de blijvende TAAK-eenheid, nooit de kalenderidentiteit: uur ⇒
          // `remainingMinutes ?? durationMinutes × (1−completion)`; dag ⇒ werkdagen.
          const progressInHours = taskDurationUnit(task) === 'hours';
          const totalSpan = progressInHours ? durationMinutesOf(task, progressCal) : t.scheduleDuration;
          const remaining = progressInHours
            ? Math.max(0, t.remainingMinutes ?? Math.round(totalSpan * (1 - t.completion)))
            : Math.max(0, t.remainingTime ?? Math.round(totalSpan * (1 - t.completion)));
          // ELAPSEDTIME-bewust, zoals `addDurationChecked` (`addElapsedMinutes`, GEEN kalenderband-
          // toetsing): anders klapt een ELAPSEDTIME-taak met `completion > 0` stil om naar
          // WORKTIME-semantiek. `totalSpan`/`remaining` staan al in de "eigen eenheid" van de taak
          // (minuten in uur-modus, dagen in dag-modus — voor ELAPSEDTIME elapsed-klok-consistent gevuld,
          // zie `mppReader.ts`'s `raw.isElapsedDuration`-tak); alleen de dag→minuut-omrekening voor het
          // dag-modus-pad komt erbij (`scheduleDuration × 24 × 60`, zoals `elapsedMinutesOf`).
          // `isElapsedTask` sluit een ECHTE (0-duur) mijlpaal uit (`isZeroDurationMilestone`, niet de
          // kale vlag).
          const isElapsedTask = !isZeroDurationMilestone(task) && t.durationType === 'ELAPSEDTIME';
          const remainingElapsedMinutes = isElapsedTask ? (progressInHours ? remaining : remaining * 24 * 60) : 0;
          let remStart = dataDate ?? actualES;                      // ondergrens: statusdatum, anders de eigen actualStart
          // `true` zodra `remStart` hieronder uit het RESUME-veld komt i.p.v. de gewone
          // voorganger-druk/elapsed-vloer — stuurt de ef<es-inversiecorrectie ná de gedeelde
          // ef-berekening (zie die toelichting verderop).
          let usedResumeOverride = false;
          // C11: onder Progress Override telt de relatie van een open voorganger naar deze lopende taak
          // nergens mee; zonder relatiegrens geen vrije speling en geen driving-markering voor haar.
          for (const seq of preds) {
            const predTask = this.tasks.get(seq.predecessorId);
            if (predTask && this.progressOverrideIgnoresRelation(predTask, task)) this.seqConstraint.delete(seq.id);
          }
          if (this.options.progressMode !== 'PROGRESS_OVERRIDE') {
            // RESUME-override: MSP slaat het hervattingsinstant voor een IN-PROGRESS-taak LETTERLIJK
            // op in het bestand — MPP-veld-id 99 (`TaskField.RESUME`, `DataType.DATE`,
            // `FieldMap14.java` blok 0 offset 20), gelezen door `mppReader.ts` naar `task.time.resume`.
            // Geen afgeleide waarde: de invoer staat in het bestand. Corpusmeting:
            // `finish = addWork(resume, remaining)` op de taak-EIGEN kalender is 17/17 EXACT op alle
            // out-of-sequence-in-progress-BLADtaken en 4/4 minuut-exact op de OzBuild-snapshots.
            // Hervattingsanker en restwerk zijn in MSP's data ONAFHANKELIJKE feiten: de afgeleide
            // `elapsed = totalSpan − remaining` (RETAINED_LOGIC) kan beide niet tegelijk reproduceren.
            //
            // Regel: AANWEZIG ⇒ gebruik het rechtstreeks, MAAR ALLEEN bij ≤1 toewijzing
            // (`task.resourceIds`, door `mppReader.ts` gevuld). Bij >1 GELIJKTIJDIGE toewijzing is het
            // taakbrede `remaining`/`resume`-paar geen rechtlijnige kalenderwandeling — elke toewijzing
            // wandelt haar EIGEN werk (zie mppReader.ts's `decodeAssignmentWorkMinutes`-docblok):
            // `mpp14assignmentfields.mpp`'s "Task One" (2 toewijzingen) wijkt via resume ~4,5 uur af,
            // terwijl RETAINED_LOGIC daar exact is. Corpusbreed blijft de fidelity-pin op alle
            // bestanden gelijk; dat de ≤1-toewijzing-populatie via beide routes vaak dezelfde datum
            // geeft, is buiten dit corpus niet getoetst.
            //
            // `cases-progress.json`'s P6-RETAINED_LOGIC-scenario's dragen `resume` per constructie
            // nooit (mpp-exclusief); `prog-Z19-resume-root-no-predecessor` dekt een WORTELtaak zonder
            // voorganger. De `resumeFromActualElapsed`-vloer (de `else`-tak hieronder) staat hier los van.
            // `time.resume` is universele brondata. Het MPP-pad blijft veldgedreven, maar een
            // XER-taak mag nooit door kale veld-aanwezigheid als MPP behandeld worden: P6 activeert
            // zijn eigen route alleen na de gevalideerde suspend/resume-opt-in.
            const mayUseResume = task.p6ProjectId ? hasValidP6SuspendResume(task) : true;
            const resumeOverride = mayUseResume && t.resume && task.resourceIds.length <= 1
              ? this.parseIn(progressCal, t.resume)
              : null;
            if (resumeOverride && !isNaN(resumeOverride.getTime())) {
              remStart = resumeOverride;
              usedResumeOverride = true;
            } else {
            // RETAINED_LOGIC: remaining respecteert óók de voorganger-druk (earlyStart).
            if (earlyStart > remStart) remStart = earlyStart;
            // Conventie A22 `resumeFromActualElapsed`: MS Project hervat het restwerk NIET op de
            // statusdatum zelf, maar op `actualStart + reeds-verstreken-duur` (`totalSpan − remaining`,
            // vanaf de eigen `actualES`), doorgesnapt via dezelfde werk-optelling als het restwerk.
            // Bewijs (OzBuild "Create Technical Specification": 20% van 5d ⇒ verstreken 1d; actualStart
            // vr 08:00 + 1 werkdag → ma 08:00; + 4 werkdagen restwerk = MSP's eigen opgeslagen finish
            // EXACT). De statusdatum-vloer alléén geeft hier te vroeg.
            //
            // NIET UNIVERSEEL: dit is MSP-eigen gedrag. P6's RETAINED_LOGIC ("max(dataDate,
            // voorganger-druk)", zonder deze derde vloer) staat getest in `cases-progress.json`'s
            // Scenario A/B/C; daar zou deze vloer bv. taak B (dur 5, completion 0.4, actualStart ==
            // statusDate) 2 werkdagen later laten landen. Vandaar de conventie (default uit; in het MS
            // Project-profiel aan).
            // Alleen bij `remaining > 0`: de `elapsed + 1`-telescopie (dag ÉÉN NA het verstreken venster)
            // klopt alleen als er daarna nog restwerk volgt (dag `elapsed+1` + `(remaining−1)` = dag
            // `totalSpan`). Bij `remaining === 0` (inconsistente brondata) geven `addWorkDaysChecked(
            // remStart, 0)`/`addWorkMinutes(remStart, 0)` `remStart` ongewijzigd terug en zou de finish
            // één werkdag/bandgat VOORBIJ de natuurlijke finish staan; dan blijft `remStart` de gewone
            // `max(dataDate, voorganger-druk)` (`prog-T9-remaining-nul-hervattingspunt-onaangeroerd`).
            const elapsed = this.options.schedulingOptions?.resumeFromActualElapsed && remaining > 0
              ? Math.max(0, totalSpan - remaining)
              : 0;
            if (elapsed > 0) {
              // ELAPSEDTIME rekent hier 24/7 in klok-minuten (`addElapsedMinutes`)
              // — GEEN `snapOnOrAfter` (die zou een legitiem weekend-/nachtinstant, precies het punt
              // van ELAPSEDTIME, alsnog naar de eerstvolgende werkband duwen) en GEEN dag-inclusieve
              // `+1`-telescopie (die hoort bij `addWorkDaysChecked`s "hoeveelste-werkdag"-conventie,
              // niet bij een kale klok-optelling). Uur (WORKTIME): `addWorkMinutes` is een echte
              // klok-optelling (kan exact op een bandgrens landen, bv. vr 17:00) — `snapOnOrAfter`
              // duwt zo'n grensinstant door naar de eerstvolgende geldige werk-instant (ma 08:00),
              // precies zoals elders in deze functie (`actualES`) een opgeslagen datum snapt. Dag
              // (WORKTIME): `addWorkDaysChecked(actualES, N)` is INCLUSIEF (dag 1 = `actualES` zelf,
              // de "hoeveelste-werkdag-vanaf-hier"-conventie die ook `remaining`/`ef` verderop
              // gebruikt) — de dag ÉÉN NA de `elapsed`-ste werkdag is dus dag `elapsed + 1`, niet dag
              // `elapsed` (anders zou elapsed=1 op `actualES` zelf blijven staan i.p.v. doorschuiven
              // naar de eerstvolgende werkdag — geverifieerd tegen `CalendarEngine.addWorkDaysChecked`:
              // dag 1 vanaf een vrijdag = die vrijdag zelf, dag 2 = de eerstvolgende maandag).
              const elapsedAnchor = isElapsedTask
                ? addElapsedMinutes(actualES, progressInHours ? elapsed : elapsed * 24 * 60)
                : progressInHours
                  ? this.snapOnOrAfter(progressCal, progressCal.addWorkMinutes(actualES, elapsed))
                  : (() => {
                      const r = progressCal.addWorkDaysChecked(actualES, elapsed + 1);
                      if (r.capped) this.cappedTaskIds.push(taskId);
                      return r.date;
                    })();
              if (elapsedAnchor > remStart) remStart = elapsedAnchor;
            }
            }
          }
          // SPLITS IN HET RESTWERK: deze IN-PROGRESS-tak heeft haar EIGEN duur-optelling
          // (`addWorkMinutes`/`addWorkDaysChecked` op `remStart`) en loopt NIET door
          // `addDurationChecked` — de gaten-optelling moet hier dus apart (juist taken MET voortgang
          // dragen `splitGaps` uit MPP's timephased-data, zie `mppTimephased.ts`). Gepind in
          // `cases-advanced-cpm.json` (`z7-split-*`, geval (d)).
          //
          // VENSTER: anders dan de volledige-duur-helpers (`addDurationChecked`/`subDuration`/
          // `finishFromStart`/`startFromFinish`, venster `[0, totale duur)`) telt hier alleen het
          // RESTWERK-venster `[reeds-afgewerkt, totale duur)` mee — een gat vóór het reeds-afgewerkte
          // deel zit al in de historie die `actualStart`/`remStart` vertegenwoordigt. `remStart`/
          // `actualES` zelf verschuift nooit door een gat: voltooid blijft staan, restwerk schuift.
          //
          // `resume` en `splitGaps` leven op verschillende assen: `resume` is het KALENDER-anker van
          // het restwerk (waar `remStart` landt), `splitGaps` leeft op de WERK-as (`completedSpan`).
          // Het venster wordt onafhankelijk van de `remStart`-keuze berekend en op `remaining`
          // toegepast; de twee zijn orthogonaal. (In het corpus geldt voor elke taak met splits én
          // voortgang `resume === stop`.)
          //
          // `mpp14timephased.mpp`'s "Task 5 - 24 Hour" klopt toevallig met een kloktijd-som, maar dat
          // is geen regel: dezelfde kalender reproduceert in `mpp14splittask.mpp` MSP's finish alleen
          // via de kalenderbewuste werkminuten-wandeling. De afwijkingen in die familie komen uit
          // resource-/timephased-data (zie `mpp-fidelity-baseline.json`).
          //
          // `totalSpan`/`remaining` staan in de "eigen eenheid" van de taak — omgerekend naar
          // werkMINUTEN (`TaskSplitGap`s eenheid) vóór de as-wandeling, en de uitkomst weer terug.
          // ELAPSEDTIME blijft ONGEMOEID (24/7 kent geen "gat").
          //
          // De restwerk-as-lengte is het VERSCHIL van twee `splitTotalSpanMinutes`-wandelingen (TOTAAL
          // en REEDS-AFGEWERKT); een zuiver-werk-hoeveelheid direct tegen `afterMinutes` vergelijken
          // telt bij ≥2 gaten een gepasseerd gat dubbel (zie `duration.ts`). `Math.max(0, …)` op
          // `completedSpanMinutes` klemt tegen hostiele invoer (`remainingMinutes` > totale duur) —
          // anders wordt het doel negatief en tellen alle gaten mee
          // (`z7-split-h-hostile-remaining-boven-totalspan`).
          //
          // Die klem raakt BEWUST alleen de gaten-tak: een gatloze taak met een absurd
          // `remainingMinutes` loopt ongeklemd naar een verre (maar eindige) datum, zoals altijd.
          // `remaining` in het algemeen op de eigen duur klemmen zou progress-gedrag van élke taak
          // wijzigen zonder bewijs dat dat gewenst is.
          let remainingWithGaps = remaining;
          if (!isElapsedTask && task.splitGaps && task.splitGaps.length > 0) {
            const totalSpanMinutes = progressInHours ? totalSpan : totalSpan * progressCal.hoursPerDay * 60;
            const remainingMinutesUnits = progressInHours ? remaining : remaining * progressCal.hoursPerDay * 60;
            const completedSpanMinutes = Math.max(0, totalSpanMinutes - remainingMinutesUnits);
            const totalAxisMinutes = splitTotalSpanMinutes(task.splitGaps, totalSpanMinutes);
            const completedAxisMinutes = splitTotalSpanMinutes(task.splitGaps, completedSpanMinutes);
            const remainingAxisMinutes = Math.max(0, totalAxisMinutes - completedAxisMinutes);
            remainingWithGaps = progressInHours
              ? remainingAxisMinutes
              : remainingAxisMinutes / (progressCal.hoursPerDay * 60);
          }
          let ef: Date;
          if (isElapsedTask) {
            ef = addElapsedMinutes(remStart, remainingElapsedMinutes);
          } else if (progressInHours) {
            ef = progressCal.addWorkMinutes(remStart, remainingWithGaps);
          } else {
            // Ook het rest-werk-pad kan tegen de onwerkbaar-venster-cap lopen ⇒ checked-variant.
            const r = progressCal.addWorkDaysChecked(remStart, remainingWithGaps);
            // Een dagtaak op een kalender met banden omvat de volledige laatste beschikbare dag.
            ef = progressCal.isHourMode ? (this.dayLastBandEnd(progressCal, r.date) ?? r.date) : r.date;
            if (r.capped) this.cappedTaskIds.push(taskId);
          }
          // Inversiewacht: de VOLTOOID-tak (`if (ef < es) es = ef`) bewaakt dat een taak nooit
          // "eindigt vóór ze begint". Bij `usedResumeOverride` komt `remStart` (dus ook
          // `ef = addWork(remStart, remaining)`) rechtstreeks uit het RESUME-veld — een bestand met
          // RESUME vóór de eigen `actualStart` zou anders een `ef` vóór `actualES` geven terwijl `es`
          // `actualES` blijft. Klem `ef` dan op `actualES` (nooit `es` verlagen: `actualES` is hier een
          // aantoonbaar feit). Zonder override is `remStart` altijd ≥ `actualES`.
          if (usedResumeOverride && ef < actualES) ef = actualES;
          // De verwachte einddatum is bewaarde P6-brondata totdat de projectoptie
          // `useExpectedFinishDates` hem activeert; zonder die optie blijft de taak op de gewone
          // restduurroute.
          if (task.p6ProjectId && this.options.schedulingOptions?.useExpectedFinishDates === true
              && task.p6ExpectedFinish) {
            const parsedExpected = this.parseIn(progressCal, task.p6ExpectedFinish);
            // Date-only Expected Finish heeft FINISH-dagprecisie, ook wanneer een ander veld de
            // taakkalender naar uurmodus promoveerde. Zoek vanaf de volgende daggrens begrensd
            // terug naar het laatste effectieve band-einde op of vóór de bedoelde kalenderdag.
            // `null` betekent: binnen CalendarEngine.MAX_SCAN bestaat aantoonbaar geen bandpunt;
            // dan blijft de al berekende finish staan i.p.v. een middernachtanker te verzinnen.
            const expected = progressCal.isHourMode && !task.p6ExpectedFinish.includes('T')
              ? progressCal.prevWorkInstantOrNull(new Date(
                utcDayStart(parsedExpected).getTime() + MS_PER_DAY,
              ))
              : parsedExpected;
            if (expected && !isNaN(expected.getTime())) ef = expected;
          }
          // LAAG 2 van de gelaagde beslistabel: een IN-PROGRESS-taak plant op haar resume-/actuals-pad
          // hierboven — GEEN timephased-venster (`mppReader.ts` zet die velden nooit op een taak met
          // `0 < completion < 1`).
          // XER exporteert op de zesassige Early Start-as het begin van het RESTERENDE werk, niet
          // de historische Actual Start. `remStart` is hierboven uitsluitend uit invoersemantiek
          // opgebouwd (statusdatum, relatiegrens en eventueel gevalideerde suspend/resume); er
          // wordt geen P6 early/late-uitvoer gelezen. Andere formaten houden hun bestaande
          // actual-startweergave doordat alleen het XER-pad deze vlag zet.
          // C12, lopende taak (Roads A10660): dezelfde FF-grens op het restwerk.
          ef = this.finishNotBeforeFinishFinishBound(preds, results, progressCal, ef);
          const displayedEarlyStart =
            this.options.schedulingOptions?.p6UseRemainingStartForProgress === true
            ? remStart
            : actualES;
          results.set(taskId, { es: displayedEarlyStart, ef });
          continue;
        }
        // Conventie A23 `unstartedIgnoresStatusDate`: deze vloer is P6-eigen RETAINED_LOGIC-semantiek
        // ("remaining werk nooit in het verleden") — MS Project verschuift een niet-gestarte taak NIET
        // automatisch naar op-of-ná de statusdatum (`calendar-exception-precedence.mpp`: zonder de
        // vloer minuut-exact, mét de vloer ~8 jaar afwijkend). Zie het docblok bij de sleutel in
        // `src/types/project.ts`.
        if (
          dataDate && t.completion === 0 && earlyStart < dataDate
          && !this.options.schedulingOptions?.unstartedIgnoresStatusDate
        ) {
          // (3) NIET GESTART: statusdatum als ondergrens (remaining werk nooit in het verleden).
          earlyStart = dataDate;
        }
      }

      const { date: earlyFinishRaw, capped } = this.addDurationChecked(cal, earlyStart, task);
      if (capped) this.cappedTaskIds.push(taskId); // onwerkbaar venster ⇒ zachte waarschuwing
      // De harde pin wint: een taak met een harde MFO/MSO-finish-pin belooft EF = LF = de pin, tf = 0
      // (`hardPinFinish`/`applyBackwardBound`). Anders duwt de SF-vloer EF ná de pin zodra dezelfde
      // taak óók een SF-opvolger is, terwijl LF op de pin blijft (de backward pass kent de vloer niet)
      // ⇒ negatieve tf. `hardPinViolatedIds` (`applyForwardConstraints`) blijft het signaal voor een
      // echt pinconflict; deze wacht voorkomt alleen een tweede, eigen schending (`msp-36`).
      // (`hardFinishPin` is vooraan deze functie al berekend.)
      // De SF-vereiste-finish is een ondergrens op de early finish (zie `sfFinishFloor`s declaratie)
      // — vuurt alleen als de gewone `ES + duur`-herberekening er ONDER blijft.
      let earlyFinish = !hardFinishPin && sfFinishFloor && sfFinishFloor > earlyFinishRaw
        ? sfFinishFloor
        : earlyFinishRaw;
      // Timephased-venster (zie `mppReader.ts`'s `deriveTimephasedWindowsForTasks`-moduleheader voor
      // het corpusbewijs, en `timephasedFinish()`'s docblok voor de precedentie t.o.v.
      // `sfFinishFloor`): het venster wint van de kale duur-gebaseerde `earlyFinishRaw` (ook als die
      // LATER was), maar nooit van een harde MFO/MSO-pin en nooit van een échte SF-vereiste-finish
      // (verrekend in `timephasedFinish()` zelf). `task.timephasedFinishFloor` afwezig ⇒
      // `tf === null`. De veldnaam ("Floor") dekt het override-gedrag niet; hernoemen raakt
      // Task/mppReader/moveProject/check-ifc-roundtrip.
      const tf = this.timephasedFinish(task, cal, hardFinishPin, sfFinishFloor, timephasedFinishFloorIsDegenerateResnap);
      if (tf) earlyFinish = tf;
      // Dezelfde EF<ES-inversiewacht als de VOLTOOID- en IN-PROGRESS-tak: `tf` (laag 3, een
      // LETTERLIJK gelezen venster) kan vóór `earlyStart` liggen wanneer een voorganger-push of een
      // SNET/MSO-constraint `earlyStart` ná het geïmporteerde venster duwt. Hier is `earlyStart` het
      // hardere feit, dus klem `earlyFinish` omhoog naar `earlyStart`. In het corpus nooit gezien —
      // verdedigend, gepind in cases-advanced-cpm.json.
      if (tf && earlyFinish < earlyStart) earlyFinish = earlyStart;
      // C12: de vroege finish niet in kloktijd vóór een FF-relatiegrens (geen harde finish-pin).
      if (!hardFinishPin) earlyFinish = this.finishNotBeforeFinishFinishBound(preds, results, cal, earlyFinish);

      // XER/P6-grensvenster voor de zeldzame TT_FinMile-vorm waarin scheduleStart de eerste
      // bandstart en scheduleFinish het vorige bandeinde draagt. Alleen toepassen zolang de
      // netwerkuitkomst exact op dat geplande startanker staat; latere relatiedruk wint gewoon.
      if (this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow === true
        && isZeroDurationMilestone(task) && task.milestoneKind === 'FINISH') {
        const plannedStart = this.parseIn(cal, task.time.scheduleStart);
        const plannedFinish = this.parseIn(cal, task.time.scheduleFinish);
        if (plannedFinish < plannedStart && earlyStart.getTime() === plannedStart.getTime()) {
          earlyFinish = plannedFinish;
        }
      } else if (this.p6ZeroDurationActivityUsesBoundaryPair(task, cal)) {
        earlyFinish = this.p6PreviousCalendarFinishBoundary(task, earlyStart);
      }

      results.set(taskId, { es: earlyStart, ef: earlyFinish });
    }

    return results;
  }

  /** Hammock-ES: de gewone forward-`max` over de START-drivers (SS/FS-voorgangers), met de
   *  projectstart als vloer. FF/SF-voorgangers (finish-drivers) doen hier NIET mee — die bepalen de
   *  EF. `forwardConstraint` levert voor SS/FS een start-grens; `seqConstraint` wordt bewust NIET
   *  gezet, zodat de hammock-relaties buiten de driving-/float-path-analyse blijven.
   *
   *  BEKENDE BEPERKING: een hammock-taak die TEGELIJK `isMilestone` is,
   *  volgt de MSP-instantconventie hier NIET — `snapOnOrAfter` is de kale her-snap, niet de
   *  mijlpaal-bewuste `landRawInstant`/`snapSuccessorEarlyStart`. Bewust niet gefixt: de combinatie
   *  hammock+mijlpaal is pathologisch (een hammock leidt zijn eigen duur af uit ES→EF; een mijlpaal
   *  hééft geen duur) en geen van beide bronbestandsformaten (`.mpp`/MSPDI) schrijft 'm zo. */
  private hammockEarlyStart(
    task: Task,
    preds: Sequence[],
    results: Map<string, { es: Date; ef: Date }>,
    projectStart: Date | null,
    cal: CalendarEngine,
  ): Date {
    let es = projectStart ? new Date(projectStart.getTime()) : new Date(0);
    for (const seq of preds) {
      if (seq.type !== 'START_START' && seq.type !== 'FINISH_START') continue;
      const predResult = results.get(seq.predecessorId);
      const predTask = this.tasks.get(seq.predecessorId);
      if (!predResult || !predTask) continue;
      const c = forwardConstraint(
        this.relDeps, predResult, predTask, seq, task, this.calendarFor(predTask), cal,
        this.p6ZeroDurationUsesFinishBoundary(task, cal),
      );
      if (c > es) es = c;
    }
    return this.snapOnOrAfter(cal, es);
  }

  /** Hammock-EF: de `max` over de FINISH-drivers (FF/SF-voorgangers), met ondergrens `es` (een
   *  hammock is nooit negatief lang). `forwardConstraint` levert de start-equivalente grens; die
   *  wordt via `finishFromStart` terug naar de finish-grens vertaald (de duur-conversie valt weg — de
   *  finish is duur-onafhankelijk, dus idempotent ongeacht de genegeerde duur-invoer). Zonder
   *  finish-driver valt EF terug op ES (nul-lengte, met waarschuwing bij de aanroeper). */
  private hammockEarlyFinish(
    task: Task,
    preds: Sequence[],
    results: Map<string, { es: Date; ef: Date }>,
    es: Date,
    cal: CalendarEngine,
  ): { ef: Date; hasFinishDriver: boolean } {
    let ef: Date | null = null;
    for (const seq of preds) {
      if (seq.type !== 'FINISH_FINISH' && seq.type !== 'START_FINISH') continue;
      const predResult = results.get(seq.predecessorId);
      const predTask = this.tasks.get(seq.predecessorId);
      if (!predResult || !predTask) continue;
      const startEquiv = forwardConstraint(
        this.relDeps, predResult, predTask, seq, task, this.calendarFor(predTask), cal,
        this.p6ZeroDurationUsesFinishBoundary(task, cal),
      );
      const finishBound = this.finishFromStart(cal, startEquiv, task);
      if (!ef || finishBound > ef) ef = finishBound;
    }
    const hasFinishDriver = ef !== null;
    let earlyFinish = ef ?? new Date(es.getTime());
    if (earlyFinish < es) earlyFinish = new Date(es.getTime());   // vloer: nooit negatief lang
    return { ef: earlyFinish, hasFinishDriver };
  }

  /**
   * Out-of-sequence-detectie: relaties waarvan de opvolger progress/actuals heeft
   * die de voorganger-logica tegenspreekt. Waarschuwing, geen correctie — het gedrag volgt uit de
   * gekozen progressMode.
   *
   * Geen `dataDate`-poort: de detectie gebruikt uitsluitend `earlyDates` (de al-berekende
   * voorganger-EF) en elke taak se eigen `actualStart`/`actualFinish`, nooit `this.dataDate`. Een
   * relatie kan out-of-sequence zijn ongeacht of het project een statusdatum heeft.
   */
  private detectOutOfSequence(earlyDates: Map<string, { es: Date; ef: Date }>): string[] {
    const out: string[] = [];
    for (const seq of this.sequences) {
      const pred = this.tasks.get(seq.predecessorId);
      const succ = this.tasks.get(seq.successorId);
      if (!pred || !succ) continue;
      // Sub-dag-actuals moeten in uur-modus als out-of-sequence tellen ⇒ `parseInstant`;
      // elke taak in zijn eigen engine. Dag ⇒ `parseDate`.
      const succEng = this.calendarFor(succ);
      const predEng = this.calendarFor(pred);
      const succAS = succ.time.actualStart ? this.parseIn(succEng, succ.time.actualStart) : null;
      const succAF = succ.time.actualFinish ? this.parseIn(succEng, succ.time.actualFinish) : null;
      const predAS = pred.time.actualStart ? this.parseIn(predEng, pred.time.actualStart) : null;
      const predAF = pred.time.actualFinish ? this.parseIn(predEng, pred.time.actualFinish) : null;
      const predEF = earlyDates.get(seq.predecessorId)?.ef ?? null;
      switch (seq.type) {
        case 'START_START': {
          // Opvolger gestart vóór de voorganger.
          if (succAS && predAS && succAS < predAS) out.push(seq.id);
          break;
        }
        case 'FINISH_FINISH':
        case 'START_FINISH': {
          // Finish-zijde: opvolger voltooid terwijl de voorganger nog niet voltooid is (of eerder).
          if (succAF) {
            const predFin = predAF ?? predEF;
            if (!predAF || (predFin && succAF < predFin)) out.push(seq.id);
          }
          break;
        }
        case 'FINISH_START':
        default: {
          // Opvolger gestart terwijl de voorganger nog niet voltooid is (of vóór diens finish).
          if (succAS) {
            const prefEF = predAF ?? predEF;
            if (!predAF || (prefEF && succAS < prefEF)) out.push(seq.id);
          }
          break;
        }
      }
    }
    return out;
  }

  /** Constraint-instant in de kalendermodus, of null bij afwezig/onparseerbaar (soft:
   *  negeren). Dag ⇒ `parseDate` (middernacht); uur ⇒ `parseInstant` (behoudt tijd-
   *  van-de-dag). Een date-only-string op een uur-taak = middernacht ⇒ dag-verankerd: de instant-
   *  vinders snappen hem naar de eerste/laatste werk-instant van die dag (S13). Een datetime-string
   *  draagt tijd-van-de-dag en wordt tot de minuut gehonoreerd. */
  private constraintInstant(c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const raw = c?.date;
    if (!raw) return null;
    const d = this.parseIn(eng, raw);
    return isNaN(d.getTime()) ? null : d;
  }

  /** De harde-pin-START, of null als de PRIMAIRE constraint geen harde MSO/MFO-pin is.
   *  MSO pint de START op de datum; MFO pint de FINISH ⇒ start = finish ⊖ duur. Modus-neutraal
   *  (dag: bevroren dag-primitieven; uur: instant-vinders + minuut-aftrek via `durationMinutesOf`).
   *
   *  ELAPSEDTIME-REIKWIJDTE: alleen de DUUR-terugstap hier (MFO ⇒ `startFromFinish`, MSO ⇒
   *  `addDuration`) is ELAPSEDTIME-bewust. De CONSTRAINT-SNAP zelf (`this.snapOnOrAfter(eng, d)`, en
   *  `constraintInstant`/`snapOnOrBefore` in `forwardBoundOf`/`backwardBoundOf`) is dat NIET: een
   *  MSO/MFO-datum snapt altijd naar een WERK-instant, ook op een ELAPSEDTIME-taak. Bewuste
   *  afbakening, niet door een case gepind. */
  private hardPinStart(task: Task, eng: CalendarEngine): Date | null {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return null;
    const d = this.constraintInstant(c, eng);
    if (!d) return null;
    const snapped = this.snapOnOrAfter(eng, d);
    return c.type === 'MSO' ? snapped : this.startFromFinish(eng, snapped, task);
  }

  /** De harde-pin-FINISH, spiegel van `hardPinStart` (⇒ EF=LF én ES=LS op de pin, tf=0).
   *  MFO: EF = snap(datum); MSO: EF = gepinde-start ⊕ duur. */
  private hardPinFinish(task: Task, eng: CalendarEngine): Date | null {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return null;
    const d = this.constraintInstant(c, eng);
    if (!d) return null;
    const snapped = this.snapOnOrAfter(eng, d);
    return c.type === 'MFO' ? snapped : this.addDuration(eng, snapped, task);
  }

  /**
   * De gelaagde beslistabel, LAAG 3 en LAAG 4 (zie `mppReader.ts`'s
   * `deriveTimephasedWindowsForTasks`-moduleheader voor de volledige toelichting). Mutueel exclusief
   * per taak (`mppReader.ts` zet nooit beide velden op dezelfde taak) — `timephasedFinishFloor`
   * afwezig ⇒ laag 4 geprobeerd, ook die afwezig ⇒ `null` (laag 5). Lagen 1/2 (VOLTOOID/IN-PROGRESS)
   * komen hier niet: `mppReader.ts` zet deze velden uitsluitend op `completion === 0`-taken.
   *
   * LAAG 3 — gelezen venster (`timephasedFinishFloor`, MSP's eigen `AssignmentField.FINISH`). Dit
   * venster verrekent NIET altijd de volledige relatiewiskunde: voor `mpp14relations.mpp`'s "Task 5"
   * (SF-opvolger) draagt het de naïeve `ES+duur`-datum, niet de SF-aangepaste datum die
   * `sfFinishFloor` berekent. Dus:
   * het venster wint van `earlyFinishRaw` (hier niet eens meer geraadpleegd), maar NOOIT van een
   * echte SF-vereiste (`sfFinishFloor`) — die blijft een `Math.max`-ondergrens.
   *
   * LAAG 4 — VERSE herberekening (`timephasedDurationWalks`): GEEN gelezen antwoord, dus GEEN
   * cirkelmeting-risico — `task.time.durationMinutes` is een gewoon, edit-live veld. Voor ELK item
   * in de lijst: wandel een duur door de toewijzings-eigen resourcekalender vanaf haar `anchor`, en
   * neem het MAXIMUM over de lijst ("langste toewijzing bepaalt de finish"). Zelfde
   * `sfFinishFloor`-precedentie als laag 3. Een item wiens resourcekalender NIET naar uur-modus
   * promoveert (dag-modus-kalender) draagt geen bruikbare `addWorkMinutes` en wordt overgeslagen —
   * ontbreken ALLE items dan (zeldzaam; `mppReader.ts` activeert laag 4 alleen als er minstens één
   * structureel afwijkende, dus doorgaans al gepromoveerde, kalender is) ⇒ `null`.
   *
   * WELKE duur per item — `walk.workMinutes` als die
   * gezet is, anders de VOLLE `task.time.durationMinutes`. `mppReader.ts` zet `workMinutes`
   * UITSLUITEND bij >1 toewijzing (`deriveTimephasedWindowsForTasks`'s finalisatielus): bij meerdere
   * GELIJKTIJDIGE toewijzingen wandelt geen enkele toewijzing de volle taakduur — elke toewijzing
   * wandelt alleen haar eigen werk-aandeel (geen partitie: de som over de toewijzingen hoeft niet
   * gelijk te zijn aan de taakduur), niet de volle taakduur (die aanname bleek BEWEZEN onjuist —
   * `mpp14resource.mpp`'s "Task A", drie toewijzingen, gaf zonder apportionering een ~2× te late
   * datum). LET OP: leid uit een lijst van lengte 1 NIET af dat `workMinutes` ontbreekt — 19
   * corpustaken dragen een lengte-1-lijst mét `workMinutes` (de MATERIAL-gefilterde >1-tak in
   * `mppReader.ts`); de garantie zit op de producerende tak, dus dit pad toetst per item
   * `walk.workMinutes ?? durMin` en nooit de lengte.
   */
  private timephasedFinish(
    task: Task, cal: CalendarEngine, hardFinishPin: Date | null, sfFinishFloor: Date | null,
    finishFloorIsDegenerateResnap = false,
  ): Date | null {
    if (hardFinishPin) return null;
    let windowValue: Date | null = null;
    // `finishFloorIsDegenerateResnap` (gezet in de `noPreds`-tak, zie de toelichting daar) — sla
    // laag 3 in dat ene band-eind-geval over, zodat `addDurationChecked`s eigen correctie (via
    // `earlyFinishRaw` in `forwardPass`) het laatste woord houdt.
    if (cal.isHourMode && task.timephasedFinishFloor && !finishFloorIsDegenerateResnap) {
      windowValue = parseInstant(task.timephasedFinishFloor);
    } else if (task.timephasedDurationWalks && task.timephasedDurationWalks.length > 0) {
      const durMin = task.time.durationMinutes;
      if (durMin != null) {
        for (const walk of task.timephasedDurationWalks) {
          const resCal = resolveCalendar(walk.resourceCalendarId, this.registry, this.projectCal);
          const resEng = this.engineForCal(resCal, task);
          if (!resEng.isHourMode) continue;
          // Apportionering: `workMinutes` (alleen gezet bij >1 toewijzing) wint van de volle
          // taakduur — zie het docblok hierboven.
          const walkMinutes = walk.workMinutes ?? durMin;
          const candidate = resEng.addWorkMinutes(parseInstant(walk.anchor), walkMinutes);
          if (!windowValue || candidate > windowValue) windowValue = candidate;
        }
      }
    }
    if (!windowValue) return null;
    return sfFinishFloor && sfFinishFloor > windowValue ? sfFinishFloor : windowValue;
  }

  /**
   * Detector-gate voor de harde-pin-logica-schending. Een taak met een geregistreerd
   * feit (`actualStart` gezet voor MSO, `actualFinish` gezet voor MFO) waarvan dat feit EXACT op de
   * pin valt, heeft de pin al aantoonbaar gerespecteerd — een later/gevloerd berekende voorganger-EF
   * (`rawMax`, bv. via een niet-afgemelde startmijlpaal die door de data-date-vloer omhoog is
   * geschoven) is dan een achterhaald forward-signaal, geen echte logica-schending. Wijkt het
   * geregistreerde feit zelf af van de pin (te vroeg/te laat), of ontbreekt het feit nog, dan gate
   * dit NIETS — de bestaande melding blijft vuren. Bewust smal: alleen dit ene detector-moment,
   * de data-date-vloer zelf blijft ongewijzigd.
   */
  private hardPinRespectedByActual(task: Task, eng: CalendarEngine): boolean {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return false;
    const t = task.time;
    if (c.type === 'MSO') {
      if (!t.actualStart) return false;
      const pin = this.hardPinStart(task, eng);
      if (!pin) return false;
      const actualES = this.snapOnOrAfter(eng, this.parseIn(eng, t.actualStart));
      return formatDate(actualES) === formatDate(pin);
    }
    // MFO
    if (!t.actualFinish) return false;
    const pinFinish = this.hardPinFinish(task, eng);
    if (!pinFinish) return false;
    const actualEF = this.snapOnOrAfter(eng, this.parseIn(eng, t.actualFinish));
    return formatDate(actualEF) === formatDate(pinFinish);
  }

  /** Forward-ondergrens (start) van ÉÉN soft constraint, of null zonder forward-effect.
   *  SNET/MSO ⇒ start-ondergrens; FNET/MFO ⇒ finish-ondergrens vertaald naar de start. Dag-modus
   *  reduceert tot `nextWorkDay`/`addWorkingDaysSigned`; uur-modus gebruikt de instant-
   *  vinders + de minuut-aftrek van `startFromFinish` (via `durationMinutesOf`).
   *
   *  EEN 0-DUURMIJLPAAL SNAPT NIET (corpusfeit): een wortelmijlpaal (duur 0) met SNET vóór de eerste
   *  band van haar dag (bv. `…T07:15` op een 08:00–17:00-band) houdt in MSP's eigen
   *  `SCHEDULED_START` `07:15`, ongesnapt — een mijlpaal is een puntmarkering, geen werk dat binnen
   *  werktijd moet passen. Taken MÉT duur snappen gewoon (`isZeroDurationMilestone`-poort hieronder).
   *  Compatibel met de 41 FNLT-bandeind-mijlpalen (regressiepoort, `check-advanced-cpm.ts`): die
   *  krijgen hun landingsinstant uit een RELATIE, en FNLT is een BACKWARD-constraint
   *  (`backwardBoundOf`).
   *
   *  VERWANTE OORZAAK: de `dataDate`-vloer ("NIET GESTART", `forwardPass`) snapt in de
   *  PROJECT-kalender (`this.projectEngine`), niet in de eigen kalender van de taak — bij
   *  verschillende bandstructuren kan dat een ES opleveren die in de EIGEN taak-kalender géén
   *  `[start,end)`-instant is (`msp-06` in `cases-msp-pariteit.json`, en de FS-tak rond
   *  `predEndsBeginOfDay` in `relationMath.ts`). Niet gefixt hier: dit blok blijft puur
   *  constraint-ondergrenzen. */
  private forwardBoundOf(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const d = this.constraintInstant(c, eng);
    if (!c || !d) return null;
    // Geen snap voor een 0-duurmijlpaal — MAAR uitsluitend bij een ECHT datetime-anker (`c.date`
    // draagt een tijdcomponent) in uur-modus. Een DATE-ONLY constraint-string is dag-verankerd
    // ("ergens op die dag", `constraintInstant`) en blijft naar het eerste werk-instant van de dag
    // snappen (`rr-fs-pred-startms`-familie in `cases-hours-relations.json`,
    // `msp-56-z9a-manual-anchor-raw-no-snap`). Dag-modus blijft ongewijzigd.
    //
    // De `noSnap`-guard staat BINNEN de SNET/MSO- en FNET/MFO-takken, niet als vroege `return d`
    // vóór de type-switch: FNLT/SNLT hebben hier GEEN forward-effect (`null`), en een vroege return
    // zou een FNLT-deadline op een mijlpaal een forward-ondergrens geven en de mijlpaal naar de
    // deadline duwen (`z19-milestone-fnlt-no-forward-push` in `cases-hours.json`).
    const noSnap = isZeroDurationMilestone(task) && eng.isHourMode && c.date?.includes('T');
    if (c.type === 'SNET' || c.type === 'MSO') return noSnap ? d : this.snapOnOrAfter(eng, d);
    if (c.type === 'FNET' || c.type === 'MFO') {
      return this.startFromFinish(eng, noSnap ? d : this.snapOnOrAfter(eng, d), task);
    }
    return null;
  }

  /** Backward-bovengrens (late finish) van ÉÉN soft constraint, of null zonder backward-
   *  effect. FNLT/MFO ⇒ finish-bovengrens direct; SNLT/MSO ⇒ start-bovengrens vertaald naar de finish.
   *  Dag-modus via `prevWorkDay`/`addWorkingDaysSigned`; uur-modus via de instant-vinders. */
  private backwardBoundOf(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const d = this.constraintInstant(c, eng);
    if (!c || !d) return null;
    const preserveMilestoneInstant =
      this.options.schedulingOptions?.p6PreserveZeroDurationConstraintInstants === true
      && isZeroDurationMilestone(task) && eng.isHourMode && c.date?.includes('T');
    const dW = preserveMilestoneInstant ? d : this.snapOnOrBefore(eng, d);
    if (c.type === 'FNLT' || c.type === 'MFO') return dW;
    if (c.type === 'SNLT' || c.type === 'MSO') return this.finishFromStart(eng, dW, task);
    return null;
  }

  /** Externe-link-lag in MINUTEN (uur-modus): `lagMinutes` ⇒ bron; anders `lagDays × hoursPerDay ×
   *  60` (naakt getal = werkdagen — dezelfde conventie als de Sequence-lag). */
  private externalLagMinutes(link: ExternalLink, eng: CalendarEngine): number {
    if (isFiniteNumber(link.lagMinutes)) return link.lagMinutes;
    const days = isFiniteNumber(link.lagDays) ? link.lagDays : 0;
    return days * eng.hoursPerDay * 60;
  }
  /** Externe-link-lag in DAGEN (dag-modus). Afwezig ⇒ 0. */
  private externalLagDays(link: ExternalLink): number {
    return isFiniteNumber(link.lagDays) ? link.lagDays : 0;
  }

  /**
   * Forward-ondergrens (start-equivalent) van een externe PREDECESSOR-link. De bevroren
   * `anchorDate` speelt de rol van de driving-datum van de externe taak (de ververs-actie schrijft
   * daar de source-`earlyFinish` bij FS/FF resp. `earlyStart` bij SS/SF in).
   * Het TWEEDE relType-teken bepaalt de zijde: FS/SS ⇒ START-grens, FF/SF ⇒ FINISH-grens (via
   * `startFromFinish` naar een start terugvertaald). Het EERSTE teken de dag-boundary-overgang:
   * alleen FS (externe finish → mijn start) krijgt de `nextWorkDayAfter`-+1 (spiegel van
   * `forwardConstraint` FS); SS/FF/SF ankeren op dezelfde grens (geen +1). In uur-modus valt de
   * +1 weg (continue tijd) ⇒ `nextWorkInstant`. `sourceMissing` speelt GEEN rol — er wordt altijd op
   * het anker gerekend (P6 External Dates). Retourneert null voor een successor-link.
   */
  private externalForwardBound(task: Task, link: ExternalLink, eng: CalendarEngine): Date | null {
    if (link.direction !== 'predecessor') return null;
    const anchor = this.parseIn(eng, link.anchorDate);
    if (isNaN(anchor.getTime())) return null;
    const rel = link.relType;
    const startSide = rel === 'FS' || rel === 'SS';   // tweede teken S ⇒ mijn start; F ⇒ mijn finish
    if (eng.isHourMode) {
      const shifted = eng.addWorkingMinutesSigned(anchor, this.externalLagMinutes(link, eng));
      return startSide ? shifted : this.startFromFinish(eng, shifted, task);
    }
    const lag = this.externalLagDays(link);
    // FS: de werkdag ná het finish-anker (finish→start). Anders: het anker zelf (addWorkingDaysSigned
    // snapt zelf voorwaarts naar een werkdag). Beide takken tellen daarna `lag` werkdagen bij.
    const base = rel === 'FS' ? eng.nextWorkDayAfter(anchor) : anchor;
    const shifted = eng.addWorkingDaysSigned(base, lag);
    return startSide ? shifted : this.startFromFinish(eng, shifted, task);
  }

  /**
   * Backward-bovengrens (late finish) van een externe SUCCESSOR-link. Spiegel van
   * `externalForwardBound`: `anchorDate` is de driving-datum van de externe opvolger. Het EERSTE
   * relType-teken bepaalt mijn zijde: FS/FF ⇒ LF-grens direct; SS/SF ⇒ LS-grens (via `finishFromStart`
   * naar mijn LF vertaald). De dag-boundary-overgang zit alleen op FS (mijn finish → externe start ⇒
   * `prevWorkDayBefore`, spiegel van de forward-FS); SS/FF/SF ankeren op `prevWorkDay`. Uur-modus:
   * continue tijd ⇒ geen −1. Retourneert null voor een predecessor-link.
   */
  private externalBackwardBound(task: Task, link: ExternalLink, eng: CalendarEngine): Date | null {
    if (link.direction !== 'successor') return null;
    const anchor = this.parseIn(eng, link.anchorDate);
    if (isNaN(anchor.getTime())) return null;
    const rel = link.relType;
    const finishSide = rel === 'FS' || rel === 'FF';   // eerste teken F ⇒ mijn finish; S ⇒ mijn start
    if (eng.isHourMode) {
      const shifted = eng.addWorkingMinutesSigned(anchor, -this.externalLagMinutes(link, eng));
      return finishSide ? shifted : this.finishFromStart(eng, shifted, task);
    }
    const lag = this.externalLagDays(link);
    const base = rel === 'FS' ? eng.prevWorkDayBefore(anchor) : eng.prevWorkDay(anchor);
    const shifted = eng.addWorkingDaysSigned(base, -lag);
    return finishSide ? shifted : this.finishFromStart(eng, shifted, task);
  }

  /**
   * Vroege-zijde constraints. Een harde MSO/MFO-pin
   * OVERSCHRIJFT de voorganger-druk onvoorwaardelijk (barrière) en registreert een
   * logica-schending zodra die druk (`rawMax`, of null bij een worteltaak) later valt dan de pin
   * — dán start de taak vóór z'n voorganger klaar is. Zonder pin stapelen de PRIMAIRE en
   * SECUNDAIRE forward-constraints (SNET/FNET/MSO/MFO) als max-ondergrenzen. `hard`/`constraint2`
   * afwezig ⇒ alleen de soft-tak.
   */
  private applyForwardConstraints(task: Task, earlyStart: Date, rawMax: Date | null, eng: CalendarEngine): Date {
    const pin = this.hardPinStart(task, eng);
    if (pin) {
      // Een gevloerde/berekende voorganger-EF (bv. een niet-afgemelde startmijlpaal
      // ná de data-date-vloer) mag geen valse schending melden op een taak die al een geregistreerd
      // feit heeft dat de pin AANTOONBAAR respecteert (gate hieronder). Een ECHTE schending —
      // actual wijkt af van de pin, of er is nog geen feit en de logica is structureel te laat —
      // blijft gewoon vuren.
      if (rawMax && rawMax > pin && !this.hardPinRespectedByActual(task, eng)) {
        this.hardPinViolatedIds.push(task.id);
      }
      return pin;
    }
    let es = earlyStart;
    for (const cc of [task.constraint, task.constraint2]) {
      const bound = this.forwardBoundOf(task, cc, eng);
      if (bound && bound > es) es = bound;
    }
    // Externe predecessor-links: bevroren forward-ondergrenzen, gestapeld als extra max-terms
    // (net als een SNET/FNET). Afwezig ⇒ deze lus draait niet.
    if (task.externalLinks && task.externalLinks.length > 0) {
      for (const link of task.externalLinks) {
        const bound = this.externalForwardBound(task, link, eng);
        if (bound && bound > es) es = bound;
      }
    }
    return es;
  }

  /**
   * Late-zijde grenzen. Een harde MSO/MFO-pin zet de late
   * finish ONVOORWAARDELIJK op de gepinde waarde (override de successor-druk) ⇒ LS=ES/LF=EF ⇒
   * tf=0 op de pin, en een strengere late-constraint verder downstream propageert zijn negatieve
   * float NIET dóór de pin heen (P6-barrière). Zonder pin stapelen de PRIMAIRE en SECUNDAIRE
   * backward-constraints (SNLT/FNLT/MSO/MFO) + de zachte deadline als min-bovengrenzen; vroege
   * datums bewegen nooit, overschrijding wordt negatieve float.
   */
  private applyBackwardBound(task: Task, lateFinish: Date, eng: CalendarEngine): Date {
    const pinFinish = this.hardPinFinish(task, eng);
    if (pinFinish) return pinFinish;
    let lf = lateFinish;
    for (const cc of [task.constraint, task.constraint2]) {
      const bound = this.backwardBoundOf(task, cc, eng);
      if (bound && bound < lf) lf = bound;
    }
    // Externe successor-links: bevroren backward-bovengrenzen (net als een SNLT/FNLT).
    // Afwezig ⇒ deze lus draait niet.
    if (task.externalLinks && task.externalLinks.length > 0) {
      for (const link of task.externalLinks) {
        const bound = this.externalBackwardBound(task, link, eng);
        if (bound && bound < lf) lf = bound;
      }
    }
    if (task.deadline) {
      const dl = parseDate(task.deadline);
      if (!isNaN(dl.getTime())) {
        const dlW = eng.prevWorkDay(dl);
        if (dlW < lf) lf = dlW;
      }
    }
    return lf;
  }

  /**
   * ALAP (P6-semantiek, zero free float): schuif de vroege datums van ALAP-taken op met
   * hun eigen vrije speling — opvolgers bewegen per definitie niet. Draait ná de backward
   * pass; de constraint-cache van uitgaande relaties wordt geactualiseerd zodat de
   * relatie-floats en driving-markering daarna kloppen (de relatie wordt precies bindend).
   *
   * Handmatig gepland — TWEE aparte uitsluitingen, niet één:
   * (1) een manual taak ZELF wordt NOOIT vooruitgeschoven, ook niet als ze toevallig
   *     `constraint.type === 'ALAP'` draagt (een geïmporteerd/legacy-veld dat een manual taak
   *     evengoed kan meedragen) — MS Project plant een manual taak op haar getypte datum, ALAP
   *     is daar een dode letter, precies zoals de bestaande MSO/MFO-precedentie in `forwardPass`
   *     (`msp-58-z9a-manual-wint-van-constraint`). Zonder deze uitsluiting zou deze functie de
   *     rauwe `early.es`/`early.ef` die `forwardPass` voor een manual taak zette, alsnog met
   *     `addWorkingDaysSigned` opschuiven — de manual-pin zou dan hier, ná de forward pass, alsnog
   *     verbroken worden.
   * (2) een manual taak als OPVOLGER van een (niet-manual) ALAP-taak krijgt GEEN bijgewerkte
   *     `seqConstraint`-invoer voor die relatie. `forwardPass` zet `seqConstraint` voor een manual
   *     opvolger sowieso nooit (haar eigen voorganger-lus in `forwardPass` wordt door de manual-
   *     `continue` nooit bereikt, zie de toelichting daar) — dat laat de relatie in
   *     `scheduleAnalysis.computeScheduleResults` terecht ONGEZIEN (`seqConstraint.get(seq.id)` is
   *     dan `undefined` ⇒ de relatie doet niet mee aan `sequenceFreeFloat`/`drivingSequenceIds`,
   *     precies de bestaande hammock-precedentie in `hammockEarlyStart`/`hammockEarlyFinish`: "de
   *     hammock-relaties blijven buiten de driving-/float-path-analyse"). ZONDER deze uitsluiting
   *     zou déze functie die relatie alsnog een `seqConstraint` geven — gebaseerd op de (eventueel
   *     ALAP-verschoven) `early` van de VOORGANGER, niet op iets waar de manual opvolger ooit op
   *     reageert (haar `earlyStart`/`earlyFinish` blijven haar eigen rauwe anker) — een relFloat
   *     die daarna in `sequenceFreeFloat` verschijnt zonder enige betekenis, in plaats van
   *     terecht afwezig te blijven.
   */
  private applyAlap(
    order: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
    lateDates: Map<string, { ls: Date; lf: Date }>,
  ): void {
    // Conventie C14 `p6AlapPositionedFromSuccessors`: dezelfde ALAP-selectie (incl. uitsluiting (1));
    // een niet-gestarte ALAP-taak op een uurkalender wordt daarna in `applyAlapFromSuccessors`
    // gepositioneerd, opvolgers eerst. Alle andere ALAP-taken volgen de stap hieronder.
    const fromSuccessors = this.options.schedulingOptions?.p6AlapPositionedFromSuccessors === true;
    const alapTaskIds: string[] = [];
    for (const taskId of order) {
      const task = this.tasks.get(taskId);
      if (task?.constraint?.type !== 'ALAP') continue;
      if (task.manuallyScheduled) continue;   // uitsluiting (1) — zie docblok hierboven.
      if (fromSuccessors && this.isUnstartedAlapPositionedFromSuccessors(task, this.calendarFor(task))) {
        alapTaskIds.push(taskId);
        continue;
      }
      const early = earlyDates.get(taskId);
      const late = lateDates.get(taskId);
      if (!early || !late) continue;

      const cal = this.calendarFor(task);
      const succs = this.successors.get(taskId) || [];
      let ff = Infinity;
      if (succs.length === 0) {
        ff = cal.signedWorkDaysBetween(early.ef, late.lf);
      } else {
        for (const seq of succs) {
          const cRaw = this.seqConstraint.get(seq.id);
          const succEarly = earlyDates.get(seq.successorId);
          const succTask = this.tasks.get(seq.successorId);
          if (!cRaw || !succEarly || !succTask) continue;
          const succCal = this.calendarFor(succTask);
          const f = succCal.workDaysBetween(succCal.nextWorkDay(cRaw), succEarly.es) - 1;
          if (f < ff) ff = f;
        }
      }
      if (!Number.isFinite(ff) || ff <= 0) continue;

      early.es = cal.addWorkingDaysSigned(early.es, ff);
      early.ef = cal.addWorkingDaysSigned(early.ef, ff);
      for (const seq of succs) {
        const succTask = this.tasks.get(seq.successorId);
        if (!succTask) continue;
        if (succTask.manuallyScheduled) continue;   // uitsluiting (2) — zie docblok hierboven.
        this.seqConstraint.set(
          seq.id,
          forwardConstraint(
            this.relDeps, early, task, seq, succTask, cal, this.calendarFor(succTask),
            this.p6ZeroDurationUsesFinishBoundary(succTask, this.calendarFor(succTask)),
          ),
        );
      }
    }
    if (fromSuccessors) this.applyAlapFromSuccessors(alapTaskIds, earlyDates, lateDates);
  }

  /** Conventie C14: valt deze taak onder de ALAP-positionering vanuit de opvolgers? Niet-gestart,
   *  uurkalender. (Een handmatig geplande taak bereikt de aanroepers niet: `forwardPass` handelt
   *  haar vooraf af, `applyAlap` filtert haar weg.) */
  private isUnstartedAlapPositionedFromSuccessors(task: Task, cal: CalendarEngine): boolean {
    return this.options.schedulingOptions?.p6AlapPositionedFromSuccessors === true
      && task.constraint?.type === 'ALAP' && cal.isHourMode
      && !task.time.actualStart && task.time.completion === 0;
  }

  /**
   * Conventie C14 `p6AlapPositionedFromSuccessors` (docblok + bron bij de sleutel in
   * `types/project.ts`): een ALAP-taak krijgt als vroege finish de strengste grens die haar
   * opvolgers (met hun vroege datums) via de relatiewiskunde van de achterwaartse berekening
   * toestaan, in werktijd; zonder opvolger haar late finish. Opvolgers eerst (omgekeerde
   * topologische volgorde), zodat een keten van ALAP-taken achter elkaar aansluit. Ondergrens: de
   * relatiegrenzen van haar voorgangers en de statusdatum — haar eigen geplande start (A16) of
   * eigen anker telt niet. Een secundaire constraint (`constraint2`) blijft gelden: SNLT/FNLT als
   * bovengrens, SNET/FNET als ondergrens; de ondergrens wint (bron en corpusstand in `types/project.ts`).
   * Opvolgers bewegen niet. `alapTaskIds` staat in topologische volgorde.
   */
  private applyAlapFromSuccessors(
    alapTaskIds: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
    lateDates: Map<string, { ls: Date; lf: Date }>,
  ): void {
    for (let i = alapTaskIds.length - 1; i >= 0; i--) {
      const taskId = alapTaskIds[i];
      const task = this.tasks.get(taskId);
      if (!task) continue;
      const cal = this.calendarFor(task);
      const early = earlyDates.get(taskId);
      const late = lateDates.get(taskId);
      if (!early || !late) continue;
      const succs = this.successors.get(taskId) || [];
      let finish: Date | null = succs.length === 0 ? late.lf : null;
      for (const seq of succs) {
        const succTask = this.tasks.get(seq.successorId);
        const succEarly = earlyDates.get(seq.successorId);
        // Uitsluiting (2): `forwardPass` zet nooit een `seqConstraint` naar een handmatige opvolger; zo'n
        // relatie doet hier dus ook niet mee.
        if (!succTask || !succEarly || !this.seqConstraint.has(seq.id)) continue;
        const succCal = this.calendarFor(succTask);
        const bound = backwardConstraint(
          this.relDeps, { ls: succEarly.es, lf: succEarly.ef }, seq, task, succTask, cal, succCal,
          this.p6ZeroDurationUsesFinishBoundary(succTask, succCal),
          this.finishFinishAtStartMilestoneLateFinish(seq, succTask, cal, succCal),
        );
        if (!finish || bound < finish) finish = bound;
      }
      if (!finish) continue;
      // Secundaire constraint (`constraint2`; de primaire ís ALAP). Bovengrens: SNLT/FNLT (en een
      // zachte MSO/MFO) via dezelfde `backwardBoundOf` als `applyBackwardBound` — de ALAP-taak schuift
      // nooit over haar eigen FNLT heen. Ondergrens hieronder: SNET/FNET via `forwardBoundOf`, net als
      // `applyForwardConstraints`. Botsen ze, dan wint de ondergrens (vroege datums liggen nooit vóór een
      // SNET/FNET; een overschreden FNLT wordt negatieve speling aan de late kant, zoals overal).
      const upper = this.backwardBoundOf(task, task.constraint2, cal);
      if (upper && finish > upper) finish = upper;
      let start = this.startFromFinish(cal, finish, task);
      // Ondergrens: voorgangerrelaties (`seqConstraint`, voorwaarts), de statusdatum en de secundaire
      // SNET/FNET.
      let floor: Date | null = this.dataDate;
      for (const seq of this.predecessors.get(taskId) || []) {
        const c = this.seqConstraint.get(seq.id);
        if (c && (!floor || c > floor)) floor = c;
      }
      const secondaryFloor = this.forwardBoundOf(task, task.constraint2, cal);
      if (secondaryFloor && (!floor || secondaryFloor > floor)) floor = secondaryFloor;
      if (floor && start < floor) {
        start = this.snapOnOrAfter(cal, floor);
        finish = this.finishFromStart(cal, start, task);
      }
      if (start.getTime() === early.es.getTime() && finish.getTime() === early.ef.getTime()) continue;
      early.es = start;
      early.ef = finish;
      for (const seq of succs) {
        const succTask = this.tasks.get(seq.successorId);
        if (!succTask || !this.seqConstraint.has(seq.id)) continue;   // uitsluiting (2), zie hierboven.
        this.seqConstraint.set(
          seq.id,
          forwardConstraint(
            this.relDeps, early, task, seq, succTask, cal, this.calendarFor(succTask),
            this.p6ZeroDurationUsesFinishBoundary(succTask, this.calendarFor(succTask)),
          ),
        );
      }
    }
  }

  /** Effectieve lag van een relatie: dagen (via resolveEffectiveLagDays) + eenheid. De dag↔minuut-
   *  factor waarmee een `lagMinutes`-only-lag in dagen wordt uitgedrukt volgt de eenheid: WORKTIME
   *  telt in WERKuren van de VOORGANGER-kalender, ELAPSEDTIME 24/7 in klokuren — exact de
   *  factoren die `resolveLagMinutes`/`resolveElapsedMinutes` in uur-modus gebruiken. */
  private resolveLag(seq: Sequence, predTask: Task, predEng: CalendarEngine): { days: number; unit: LagUnit } {
    const unit: LagUnit = seq.lagUnit === 'ELAPSEDTIME' ? 'ELAPSEDTIME' : 'WORKTIME';
    const hpd = unit === 'ELAPSEDTIME' ? 24 : predEng.hoursPerDay;
    return { days: resolveEffectiveLagDays(seq, predTask, hpd), unit };
  }

  private backwardPass(
    order: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
  ): Map<string, { ls: Date; lf: Date }> {
    const results = new Map<string, { ls: Date; lf: Date }>();

    // Find project end date (latest early finish)
    let projectEnd = new Date(0);
    for (const taskId of order) {
      const early = earlyDates.get(taskId);
      const task = this.tasks.get(taskId);
      if (!early || !task) continue;
      const completedWindow = this.p6CompletedDataDateWindowDecision(task);
      const usesCompletedDisplayWindow = completedWindow.eligible;
      let candidateEf = early.ef;
      if (usesCompletedDisplayWindow) {
        const progressCal = this.progressCalendarFor(task);
        const projectedEs = this.completedOutOfSequenceEs.get(taskId)
          ?? this.snapOnOrAfter(progressCal, this.dataDate!);
        candidateEf = progressCal.prevWorkInstant(projectedEs);
      }
      if (candidateEf > projectEnd) {
        projectEnd = candidateEf;
        if (this.backwardFloatTrace) {
          this.backwardFloatTrace.projectEndSource = usesCompletedDisplayWindow
            ? 'completedDisplayWindow'
            : 'maxEarlyFinish';
        }
      }
    }
    if (this.options.schedulingOptions?.useProjectEndDateForFloat === true) {
      const configuredProjectEnd = parseInstant(this.options.projectEndDate ?? '');
      if (!isNaN(configuredProjectEnd.getTime())) {
        projectEnd = this.snapOnOrBefore(this.projectEngine, configuredProjectEnd);
        if (this.backwardFloatTrace) this.backwardFloatTrace.projectEndSource = 'useProjectEndDateForFloat';
      }
    }

    // Backward pass in reverse topological order
    const reversed = [...order].reverse();
    const preserveActualDates = this.dataDate !== null
      && this.options.schedulingOptions?.preserveActualDatesInBackwardPass === true;
    for (const taskId of reversed) {
      const task = this.tasks.get(taskId)!;
      const succs = this.successors.get(taskId) || [];
      const completedWindow = this.p6CompletedDataDateWindowDecision(task);
      const backwardActualPin = explainBackwardActualPinEligibility(
        task,
        this.dataDate,
        this.options.schedulingOptions,
      );
      this.recordBackwardFloatTrace(taskId, { completedWindow, backwardActualPin });

      // C5: ook de late kant is één punt, LS = LF = de vroegste rauwe grens die de opvolgers stellen
      // (FS/SS: hun LS, FF/SF: hun LF, min alleen de nog niet verstreken lag), zonder statusdatumklem.
      // Gemeten: alle 187 voltooide CP_Phys-activiteiten met een laat orakel in Roads, HarbourPointe en
      // OZB; zonder opvolger (HarbourPointe EC1040/EC1050) het projecteinde.
      const physicalPoint = this.completedPhysicalPoints.get(taskId);
      if (physicalPoint) {
        let latePoint: Date | null = null;
        const ownEng = this.calendarFor(task);
        for (const seq of succs) {
          const succResult = results.get(seq.successorId);
          const succTask = this.tasks.get(seq.successorId);
          if (!succResult || !succTask || succTask.isHammock) continue;
          const succCompleted = !!succTask.time.actualFinish && succTask.time.completion >= 1;
          if (succCompleted && !this.completedPhysicalPoints.has(succTask.id)
            && !explainP6CompletedLateRemainingWindowEligibilityResolved(
              succTask, this.dataDate, this.options.schedulingOptions,
            ).eligible) continue;
          const lagEng = this.relDeps.lagEngine(ownEng, this.calendarFor(succTask));
          const relSeq = this.completedRemainingLagSeq(seq, task, lagEng);
          const toStart = seq.type === 'FINISH_START' || seq.type === 'START_START';
          const bound = this.physicalPointLag(toStart ? succResult.ls : succResult.lf, relSeq, task, lagEng, -1);
          if (Number.isNaN(bound.getTime())) continue;
          if (latePoint === null || bound < latePoint) latePoint = bound;
        }
        const late = latePoint ?? new Date(projectEnd.getTime());
        this.recordBackwardFloatTrace(taskId, {
          lateFinishSource: latePoint === null ? 'projectEnd' : 'successorConstraint',
        });
        results.set(taskId, { ls: late, lf: new Date(late.getTime()) });
        continue;
      }

      // Brongebonden XER-beleid: een voltooide activiteit houdt haar bestaande completed-pin aan
      // de late zijde. De smalle data-date-route verandert uitsluitend de forwarddatums; opgeslagen
      // XER early/late/float-uitkomsten zijn op geen van beide paden solverinvoer.
      if (backwardActualPin.eligible) {
        // Dezelfde gedeelde poort als `scheduleAnalysis`
        // (`explainP6CompletedLateRemainingWindowEligibilityResolved`) — inclusief de `backwardActualPin`-
        // voorwaarde die hierboven al gold, zodat een taak nooit "tussen de twee poorten in" kan
        // vallen (bv. `TK_Complete` zonder `act_end_date`: wel completedWindow-eligible, niet
        // backwardActualPin-eligible — de weergave mag dan niet stilzwijgend meebewegen terwijl
        // deze tak overgeslagen wordt).
        if (explainP6CompletedLateRemainingWindowEligibilityResolved(
          task, this.dataDate, this.options.schedulingOptions,
        ).eligible) {
          // Gemeten (rehab-2, 2.036 voltooide taken, 99,9% dekking): een
          // voltooide activiteit staat aan de late zijde óók op nul restduur op de statusdatum —
          // `LF = prevWorkInstant(LS)` op de taak-eigen (voortgangs)kalender, `LS` = de vroegste
          // van de door haar opvolgers toegestane late finishen, geklemd op de statusdatum. Geen
          // opvolger ⇒ `LS` = de statusdatumklem zelf (dezelfde `nextWorkInstant`-grens als de
          // forward completed-display-window hierboven).
          //
          // Bewust gepoort op `completedWindow.eligible` (dezelfde `explainP6CompletedDataDateWindow`
          // die ook de FORWARD-display stuurt): ES
          // toont daar al het statusdatumvenster, dus LS hoort dat ook te doen. Een voltooide taak
          // die niet door die (nauwe) poort komt — de CP_Phys-route of de LOE/hammock-actual-finish-
          // uitzondering (`explainCompletedXerLoeActualFinishEligibilityResolved`, expliciet ZONDER
          // uitgaande relatie) — heeft geen zinvol statusdatumvenster aan de vroege kant en moet dus
          // ook aan de late kant op haar bestaande actual-pin blijven staan; anders raakt LS/LF los
          // van de eigen (niet-venster-)ES/EF van diezelfde taak.
          const progressCal = this.progressCalendarFor(task);
          const windowEs = this.snapOnOrAfter(progressCal, this.dataDate!);
          let candidateLs: Date | null = null;
          for (const seq of succs) {
            const succResult = results.get(seq.successorId);
            const succTask = this.tasks.get(seq.successorId);
            if (!succResult || !succTask) continue;
            if (succTask.isHammock) continue;
            const succCal = this.calendarFor(succTask);
            const succRawCompleted = !!succTask.time.actualFinish && succTask.time.completion >= 1;
            // Zelfde gedeelde poort als hierboven/verderop — niet alleen
            // `completedWindow.eligible`: een opvolger zonder `act_end_date` kan wél door de
            // (bron-onafhankelijke) completedWindow-poort komen maar zelf NIET door
            // `backwardActualPin`, en heeft dan géén door deze tak berekende ls/lf om op terug te
            // rekenen (poortdivergentie).
            const succUsesRemainingWindow = explainP6CompletedLateRemainingWindowEligibilityResolved(
              succTask, this.dataDate, this.options.schedulingOptions,
            ).eligible;
            // Een voltooide opvolger die zelf niet door de gedeelde poort kwam (CP_Phys, de
            // LOE/hammock-actual-finish-uitzondering, of ontbrekende `act_end_date`) draagt nog
            // steeds haar ongewijzigde actual-pin — pure historie, net als in de generieke tak
            // hierboven — en mag deze taak dus niet terugtrekken.
            if (succRawCompleted && !succUsesRemainingWindow) continue;
            // Gemeten uitzondering: de relatie-lag telt NIET mee tussen twee voltooide
            // activiteiten (R1 zonder lag: 2.033/2.036), maar WEL zolang de opvolger nog restwerk
            // heeft (R2 mét lag altijd: slechts 1.796/2.036 — de drie R1-uitzonderingen hebben
            // stuk voor stuk een NIET-voltooide maatgevende opvolger).
            // Een PROCENTUELE lag wordt tegen de voorgangerduur opgelost, en de nulrestduur-kloon
            // hieronder zet die duur voor SS/SF op 0 — de lag zou stil verdwijnen. Daarom hier eerst tegen de ONGEWIJZIGDE taak vastzetten,
            // in de eenheid die de relatiewiskunde voor deze lag-soort leest (WORKTIME: minuten in de
            // lag-kalender én dagen; ELAPSEDTIME: alleen dagen — `resolveElapsedMinutes` zou een
            // minutenwaarde als klokminuten lezen), en `lagPercent` wissen. Daarna is de kloon een
            // zuivere duur-neutralisatie die de lag niet meer raakt.
            const hasPercentLag = typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent);
            const lagEng = this.relDeps.lagEngine(progressCal, succCal);
            const percentResolvedSeq: Sequence = !hasPercentLag
              ? seq
              : seq.lagUnit === 'ELAPSEDTIME'
                // `lagMinutes` blijft staan: `resolveElapsedMinutes` geeft hem voorrang, en dat moet
                // hier niet omkeren — alleen de PROCENT-tak wordt tegen de echte duur
                // in dagen vastgezet.
                ? { ...seq, lagDays: resolveEffectiveLagDays(seq, task), lagPercent: undefined }
                : {
                  ...seq,
                  lagDays: resolveEffectiveLagDays(seq, task, lagEng.hoursPerDay),
                  lagMinutes: this.resolveLagMinutes(seq, task, lagEng),
                  lagPercent: undefined,
                };
            const effectiveSeq = succUsesRemainingWindow
              ? { ...seq, lagDays: 0, lagMinutes: 0, lagPercent: undefined }
              : this.completedRemainingLagSeq(percentResolvedSeq, task, lagEng);
            const delayShiftedSuccResult = {
              ls: this.shiftByLevelingDelay(succCal, succTask, succResult.ls, -1),
              lf: this.shiftByLevelingDelay(succCal, succTask, succResult.lf, -1),
            };
            // Voor START_START/START_FINISH geeft `backwardConstraint` de late
            // START van de voorganger terug via `finishFromStart(pe, predLS, predTask)` — d.w.z.
            // `predLS` plus de VOLLE geplande duur van de voorganger (spiegel van de forward-
            // duurtoepassing, normaal correct). Voor een voltooide taak met nul restduur is die
            // duur-optelling dubbelop: de klem hieronder behandelt het resultaat toch al als een
            // 0-duur-finish. Een voorganger met `scheduleDuration`/`durationMinutes` op 0 (en
            // `isMilestone: true`, zodat ook `relationBoundaryFlags`/`isZeroDurationMilestone`
            // consistent nul-duur zien) maakt `finishFromStart` voor die twee typen een no-op, zodat
            // `constraintFinish` de late START zelf teruggeeft — precies de nulrestduur-aanname die
            // deze hele tak al maakt, nu voor ALLE vier de relatietypen op één plek. FS/FF blijven
            // ongewijzigd: `backwardConstraint` geeft daar al een echte LF terug, onafhankelijk van
            // de voorgangerduur.
            const isStartSideRelation = seq.type === 'START_START' || seq.type === 'START_FINISH';
            // `milestoneKind: undefined`: `relationBoundaryFlags` leidt `predStartsNextDay` af uit
            // `scheduleDuration <= 0` PLUS `milestoneKind === 'FINISH'`. Door de duur op 0 te zetten
            // wordt de eerste helft altijd waar, dus zonder deze regel zou een voltooide EINDmijlpaal-
            // met-duur hier een extra werkdaggrens-sprong krijgen die een gewone voltooide
            // taak niet krijgt. Onder de aanname van deze tak — nul restduur, LS is het anker,
            // `LF = prevWorkInstant(LS)` — bestaat die aparte finishgrens niet.
            // DEFENSIEF en via de XER-lezer ONBEREIKBAAR — `xerReader` zet `milestoneKind` alleen voor
            // `TT_Mile`/`TT_FinMile`, en die weigert de gedeelde poort al met `wrongActivityType`. Het
            // pad bestaat alleen via een IFC-round-trip plus handmatig markeren als mijlpaal; geen test
            // raakt het.
            const zeroRemainingPredTask: Task = isStartSideRelation
              ? {
                ...task,
                isMilestone: true,
                milestoneKind: undefined,
                time: { ...task.time, scheduleDuration: 0, durationMinutes: 0 },
              }
              : task;
            const constraintFinish = backwardConstraint(
              this.relDeps, delayShiftedSuccResult, effectiveSeq, zeroRemainingPredTask, succTask,
              progressCal, succCal, this.p6ZeroDurationUsesFinishBoundary(succTask, succCal),
              // C7 bewust NIET in deze nulrestduur-voortgangstak: ongemeten.
            );
            // FS/FF: `constraintFinish` is een echte late FINISH van de voorganger — de
            // nulrestduur-conversie naar een late START loopt via `nextWorkInstant` (spiegel van
            // `prevWorkInstant(LS)` verderop). SS/SF: dankzij `zeroRemainingPredTask` hierboven is
            // `constraintFinish` de late START zelf al (`finishFromStart` deed niets) — die nogmaals
            // door `nextWorkInstant` halen zou 'm een vol bandsprong verder duwen zodra de opvolger
            // exact op een bandgrens eindigt (mutatiebewijs: SF-fixture, `check-xer-completed-late`).
            const candidateLsFromSeq = isStartSideRelation
              ? constraintFinish
              : progressCal.nextWorkInstant(constraintFinish);
            if (candidateLs === null || candidateLsFromSeq < candidateLs) candidateLs = candidateLsFromSeq;
          }
          const ls = candidateLs === null || candidateLs < windowEs ? windowEs : candidateLs;
          const lf = progressCal.prevWorkInstant(ls);
          this.recordBackwardFloatTrace(taskId, {
            lateFinishSource: 'completedRemainingWindow',
            lateStartSource: 'completedRemainingWindow',
          });
          results.set(taskId, { ls, lf });
          continue;
        }
        const ed = earlyDates.get(taskId)!;
        this.recordBackwardFloatTrace(taskId, {
          lateStartSource: this.options.schedulingOptions?.p6UseRemainingStartForProgress === true
            ? 'subRemainingDuration'
            : 'subDuration',
        });
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      // Hammock (normatief): een gevolg, geen oorzaak. GEEN backward-`min`-doorgifte; per
      // definitie `LS = ES` en `LF = EF` (⇒ tf=ff=0, kritiek-neutraal — geforceerd in computeResults).
      // De gewone min-combinatie wordt overgeslagen.
      if (task.isHammock) {
        const ed = earlyDates.get(taskId)!;
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      // Handmatig gepland: VERPLICHTE early-return, zelfde vorm als de hammock-tak hierboven —
      // `LS = ES`, `LF = EF`. Zonder deze return herrekent de gewone backward-combinatie hieronder
      // (`applyBackwardBound` + `subDuration(predCal, lateFinish, task)`) een `lateFinish`/`lateStart`
      // die NIETS met de gepinde `earlyStart`/`earlyFinish` te maken heeft (de afgeleide duur van een
      // manual taak is geen contract) ⇒ spookfloat (`msp-57-z9a-manual-pin-forward`).
      //
      // `totalFloat`/`freeFloat` worden in `scheduleAnalysis.computeScheduleResults` DEFINITORISCH op
      // 0 gezet voor een manual taak (de werkdag-tellende `signedFloat` geeft op een niet-werkdag-anker
      // een artefact, `msp-56`). `isCritical` wordt BEWUST NIET geforceerd: met tf op 0 geeft de gewone
      // `tf ≤ drempel`-regel het juiste antwoord, en een manual taak is, anders dan een hammock, een
      // ECHT anker dat legitiem kritiek kan zijn.
      //
      // BACKWARDDRUK: anders dan een hammock legt een manual taak WEL backward-druk op haar eigen
      // voorgangers. Haar doorgegeven `ls`/`lf` zijn identiek aan haar rauw gelezen ES/EF — een
      // echt, MSP-getrouw finish-punt. Dat kan negatieve float op een voorganger geven wanneer de
      // manual opvolger vroeger ligt; dat is correct (een gepinde datum kan een reëel logicaprobleem
      // blootleggen). Geen corpusgeval raakt dit.
      if (task.manuallyScheduled) {
        const ed = earlyDates.get(taskId)!;
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      // P6/XER: een verbonden open TT_FinMile is een zelfstandig contracteindpunt. Zijn vroege
      // start-/vorige-finishgrens is daarom óók zijn late grens en legt vanaf daar backward-druk op
      // de voorgangerketen, zelfs wanneer een andere open taak het latere projecteinde bepaalt.
      // Dit is niet de expliciete PROJECT.plan_end-variant: wanneer die bronoptie aan staat, blijft
      // dat projecteinde juist de late-passgrens (Terminal-fixture). De voorgangerpoort houdt een
      // volledig geïsoleerde finishmijlpaal buiten deze regel. Alleen de bestaande XER-vlag kan de
      // tak activeren.
      if (this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow === true
        && this.options.schedulingOptions?.useProjectEndDateForFloat !== true
        && succs.length === 0
        && (this.predecessors.get(taskId)?.length ?? 0) > 0
        && task.milestoneKind === 'FINISH' && isZeroDurationMilestone(task)) {
        const ed = earlyDates.get(taskId)!;
        this.recordBackwardFloatTrace(taskId, { lateFinishSource: 'projectEnd', lateStartSource: 'subDuration' });
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      // Niets kan ná het projecteinde eindigen — dat is de bovengrens voor élke taak. Opvolger-
      // constraints kunnen de late finish alleen verder naar voren halen (anders kan een
      // Start-Start-opvolger een late finish ná het projecteinde opleveren, en krijgt de voorganger
      // ten onrechte speling).
      const predCal = this.calendarFor(task);
      let lateFinish = projectEnd;
      let lateFinishSource: CpmLateFinishSource = 'projectEnd';
      for (const seq of succs) {
        const succResult = results.get(seq.successorId);
        const succTask = this.tasks.get(seq.successorId);
        if (!succResult || !succTask) continue;
        // Een voltooide P6-opvolger beschrijft historie en mag de late finish van een nog open
        // voorganger niet door haar historische actual finish terugtrekken — TENZIJ de opvolger
        // zelf door de completedWindow-poort kwam (de tak hierboven, `p6CompletedLateFromRemainingWindow`):
        // dan draagt die opvolger al een zinvolle, statusdatum-gebaseerde late kant en hoort ze,
        // net als elke andere opvolger, gewone backward-druk te leggen op haar eigen voorgangers.
        // Een voltooide opvolger die niet door die (nauwe) poort kwam — CP_Phys of de LOE/hammock-
        // actual-finish-uitzondering — blijft wel uitgesloten: haar ls/lf zijn dan nog steeds de
        // rauwe actual-pin (ongewijzigd hierboven), niet iets zinvols om op terug te rekenen.
        const succCompletedHistoric = preserveActualDates && !!succTask.time.actualFinish
          && succTask.time.completion >= 1;
        // Zelfde gedeelde poort als hierboven: alleen een opvolger die er zelf
        // door komt draagt een zinvolle late kant om op terug te rekenen.
        const succUsesRemainingWindow = explainP6CompletedLateRemainingWindowEligibilityResolved(
          succTask, this.dataDate, this.options.schedulingOptions,
        ).eligible;
        // C5, late kant: een voltooide CP_Phys-opvolger met een statusdatumpunt draagt een zinvolle
        // late kant (LS = LF = zijn punt) en legt dus gewone backward-druk op een open voorganger.
        // Gemeten: Roads B2911 → OCEC11361, A33 → A65, OCEC10851 —SS→ OCEC10791.
        const succIsPhysicalPoint = this.completedPhysicalPoints.has(succTask.id);
        if (succCompletedHistoric && !succUsesRemainingWindow && !succIsPhysicalPoint) continue;
        // C11: onder Progress Override legt een lopende opvolger geen backward-druk op een open voorganger.
        if (this.progressOverrideIgnoresRelation(task, succTask)) continue;
        // Een hammock is een gevolg, geen oorzaak: hij legt GEEN backward-druk op zijn
        // voorgangers (drivers). Een strakke opvolger van de hammock kan zo nooit via de hammock heen
        // negatieve float op de start-/finish-driver leggen — de driver ziet alleen zijn eigen
        // (niet-hammock) opvolgers.
        if (succTask.isHammock) continue;
        // Backward-DOORGIFTE-spiegel van de nivelleer-vertraging: `succTask` heeft hier per
        // constructie minstens één voorganger (`task`), dus de ANKERREGEL in `forwardPass` heeft haar
        // `levelingDelay` al op haar early start toegepast. `succResult.ls`/`.lf` blijven daar bewust
        // onafhankelijk van (`subDuration`s docblok), dus de late-zijde-druk op `task` kent de
        // vertraging nog niet: zonder correctie toont `task` een `delay`-hoeveelheid speling die ze niet
        // heeft (een P→A(delay)→S-keten gaf P.tf=`delay` i.p.v. 0). Spiegelt hoe `shiftLagPred` een
        // gewone relatie-lag symmetrisch toepast: de delay komt NÁ de relatiewiskunde, dus de spiegel
        // ervóór. `projectEnd` komt los hiervan al uit `earlyDates` (inclusief elke delay).
        const succCal = this.calendarFor(succTask);
        const delayShiftedSuccResult = {
          ls: this.shiftByLevelingDelay(succCal, succTask, succResult.ls, -1),
          lf: this.shiftByLevelingDelay(succCal, succTask, succResult.lf, -1),
        };
        // C6, late kant: van een SS-lag uit deze LOPENDE taak telt ook achterwaarts alleen de rest-lag
        // (Roads OCEC10311 —SS+70 h→ OCEC10851: P6-LS = de LS van de opvolger). Conventie uit ⇒ `seq`.
        const lateLagEng = this.relDeps.lagEngine(predCal, succCal);
        // Projectoptie `startToStartLagFrom` = 'actualStart', late kant (SPIEGEL van het anker): voorwaarts
        // hangt deze SS-relatie aan de statusdatum, niet aan deze lopende taak — dus begrenst ze haar
        // achterwaarts ook niet (anders onechte negatieve speling). Wat P6 hier doet is ongemeten.
        if (this.options.schedulingOptions?.startToStartLagFrom === 'actualStart'
          && this.dataDate !== null && this.inProgressStartLag(task, seq, lateLagEng)) continue;
        const lateSeq = this.inProgressStartLagSeq(task, seq, lateLagEng);
        // A19, late kant: een lopende taak telt achterwaarts over een SS-grens alleen haar restduur.
        const remainingTask = seq.type === 'START_START'
          ? this.remainingDurationTaskForStartRelation(task, predCal) : task;
        const constraintDate = backwardConstraint(
          this.relDeps, delayShiftedSuccResult, lateSeq, remainingTask, succTask, predCal, succCal,
          this.p6ZeroDurationUsesFinishBoundary(succTask, succCal),
          this.finishFinishAtStartMilestoneLateFinish(seq, succTask, predCal, succCal),
        );
        if (constraintDate < lateFinish) {
          lateFinish = constraintDate;
          lateFinishSource = 'successorConstraint';
        }
      }

      // Late-zijde datum-constraints + deadline als extra bovengrens.
      const successorBound = lateFinish;
      lateFinish = this.applyBackwardBound(task, lateFinish, predCal);
      // C9: een opvolgergrens buiten de eigen werktijd naar het einde van de vorige werkperiode — alleen
      // als die grens ook ná de late-zijde-constraints de late finish bepaalt.
      if (lateFinishSource === 'successorConstraint' && lateFinish.getTime() === successorBound.getTime()) {
        lateFinish = this.lateFinishOnOwnCalendar(predCal, lateFinish);
      }
      if (this.p6ZeroDurationActivityUsesBoundaryPair(task, predCal)) {
        // Een opvolgergrens kan als volgende bandSTART binnenkomen. P6 toont voor deze
        // geïnverteerde nulduurvorm de complementaire finishrand; op een echt bandeinde is deze
        // operatie idempotent.
        lateFinish = predCal.prevWorkInstant(lateFinish);
      }

      const useP6RemainingProgress = this.options.schedulingOptions?.p6UseRemainingStartForProgress === true
        && task.time.actualStart !== undefined && task.time.completion > 0 && task.time.completion < 1;
      const computedLateStart = useP6RemainingProgress
        ? this.subRemainingDuration(predCal, lateFinish, task)
        : this.subDuration(predCal, lateFinish, task, earlyDates.get(taskId)?.es ?? null);
      // Bij P6-voortgang is een geregistreerde actual start ook de getoonde LS; LF blijft uit het
      // resterende netwerk volgen. Zonder bronvlag blijft de berekende late start leidend.
      let lateStart = preserveActualDates && task.time.actualStart && task.time.completion < 1
          && this.options.schedulingOptions?.p6UseRemainingStartForProgress !== true
        ? new Date(earlyDates.get(taskId)!.es.getTime())
        : computedLateStart;
      if (this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow === true
        && isZeroDurationMilestone(task) && task.milestoneKind === 'FINISH') {
        const plannedStart = this.parseIn(predCal, task.time.scheduleStart);
        const plannedFinish = this.parseIn(predCal, task.time.scheduleFinish);
        if (plannedFinish < plannedStart && lateFinish.getTime() === plannedFinish.getTime()) {
          lateStart = plannedStart;
        }
      } else if (this.p6ZeroDurationActivityUsesBoundaryPair(task, predCal)) {
        // De backward-spiegel van het forward-grenspaar: LF is een finishrand en LS de eerste
        // start-rand op-of-na die grens. Een exact bandeinde springt zo naar de volgende bandstart.
        lateStart = predCal.nextWorkInstant(lateFinish);
      }

      this.recordBackwardFloatTrace(taskId, {
        lateFinishSource,
        lateStartSource: useP6RemainingProgress ? 'subRemainingDuration' : 'subDuration',
      });
      results.set(taskId, { ls: lateStart, lf: lateFinish });
    }

    return results;
  }

}
