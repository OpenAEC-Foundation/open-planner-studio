import { Task, type TaskConstraint, type ExternalLink } from '@/types/task';
import type { SchedulingOptions } from '@/types/project';
import { Sequence, LagUnit } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import {
  parseDate, formatDate, parseInstant, type DateMode,
} from '@/utils/dateUtils';
import {
  durationMinutesOf, elapsedMinutesOf, addElapsedMinutes, subtractElapsedMinutes,
  signedElapsedSpan, isZeroDurationMilestone, splitTotalSpanMinutes, splitTotalSpanDays,
} from './duration';
import { computeScheduleResults } from './scheduleAnalysis';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
import {
  forwardConstraint, forwardFinishFloor, backwardConstraint, MS_PER_MIN, MS_PER_DAY, type RelationDeps,
} from './relationMath';

export interface CPMResult {
  tasks: Map<string, CPMTaskResult>;
  criticalPath: string[];
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
   *  (out-of-sequence, fase 2.6). Waarschuwing, geen fout — het gedrag volgt uit de progressMode. */
  outOfSequenceSequenceIds: string[];
  /** Near-critical-taken (fase 2.9, §4.6): 0 < tf ≤ drempel. Leeg als de drempel ongezet is. */
  nearCriticalTaskIds: string[];
  /** Alle kritieke ketens (fase 2.9, §4.6). ALTIJD aanwezig, lengte ≥1; `criticalPaths[0] ==
   *  criticalPath`. Staat `floatPaths` uit, dan is dit precies `[criticalPath]` — zo hoeven
   *  consumenten nooit op `undefined` te checken (byte-compat: één keten in een array gewikkeld). */
  criticalPaths: string[][];
  /** Float-path-nummer per taak (fase 2.9, §4.6): 1 = meest kritiek. Leeg als `floatPaths` uit. */
  floatPathByTask: Record<string, number>;
  /** Hammocks (§4.4) zónder finish-driver (geen FF/SF-voorganger): hun EF valt terug op de ES
   *  (nul-lengte). Waarschuwingssignaal — de span kan niet uit een finish-driver worden afgeleid. */
  hammockNoFinishDriverTaskIds: string[];
  /** OPTIONEEL (WP7 "Onwerkbaar-venster-detectie"): taak-ids waarvan de earlyFinish-berekening tegen
   *  de MAX_SCAN/MAX_DAYS-cap van `addWorkDays` liep — een kalender die het taakvenster onwerkbaar
   *  maakt levert anders stil een onzin-datum. ZACHTE, niet-blokkerende waarschuwing: `error` blijft
   *  leeg, de overige taken rekenen normaal door. Afwezig/leeg ⇒ byte-identiek default. */
  cappedTaskIds?: string[];
  /** OPTIONEEL (T8-rooktest): relatie-id's die de solver heeft genegeerd omdat voorganger of
   *  opvolger geen bladtaak is in de meegegeven set — typisch een relatie die een WBS-samenvattings-
   *  taak raakt (in MS Project legaal, maar deze solver rekent alleen bladtaken; de samenvatting
   *  krijgt zijn datums via de rollup in `applyCpmResult`, niet als eigen CPM-knoop). Interim-gedrag:
   *  genegeerd i.p.v. gecrasht — volledige samenvattingsrelatie-propagatie naar bladtaken is een
   *  aparte, grotere wijziging. Afwezig/leeg ⇒ byte-identiek default. */
  droppedSequenceIds?: string[];
  projectEnd: string;
  projectDuration: number; // work days
  error?: string; // Set if circular dependency detected
}

/** Voortgangs-opties (fase 2.6). Leeg ⇒ geen statusdatum-gedrag (byte-identiek aan vóór 2.6). */
export interface CPMOptions {
  dataDate?: string;                                     // ISO date; undefined ⇒ geen statusdatum-gedrag
  progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE'; // default RETAINED_LOGIC
  /** Project-scoped rekenopties. Afwezig ⇒ elke brongebonden uitbreiding blijft uit en het
   *  algemene solvergedrag blijft byte-identiek. */
  schedulingOptions?: SchedulingOptions;
  /** De geconfigureerde PROJECTSTARTDATUM (`Project.startDate`, ISO-datum), gebruikstest-bevinding
   *  2026-08: ondergrens voor de early-start-berekening van ELKE taak MET voorganger (en
   *  hammocks) — NIET uitsluitend tegen leads (T7-review M2, gecorrigeerd): ook een gewone FS/FF-
   *  relatie met lag 0 van een vroege wortel-taak (die sinds T7 z'n eigen anker vóór de
   *  projectstart mag houden, zie hieronder) wordt hier gevloerd. Alleen de gebruikerszichtbare
   *  markering (`truncatedLeadIds`, "afgekapte lead") is wél lead-specifiek — die signaleert
   *  uitsluitend een negatieve lag die de vloer raakt, niet elke geflooerde relatie in het
   *  algemeen. Vóór deze optie leidde de forward pass "de projectstart" stilzwijgend af als het
   *  minimum van de wortel-taken ONDERLING. Afwezig/onparseerbaar ⇒ terugval op het oude gedrag —
   *  byte-identiek voor elke bestaande aanroeper die deze optie niet meegeeft.
   *
   *  SINDS T7 (§9/O2, de brede regel "een ingelezen anker wordt nooit door de vloer overruled")
   *  klemt deze optie NIET meer de eigen ES van een taak ZONDER voorganger — die gebruikt altijd
   *  zijn eigen `scheduleStart` (`ownAnchor`), ook als die vóór de projectstart ligt. De vloer
   *  (`rootFloor`) is versmald tot uitsluitend de early-start-ondergrens voor taken MÉT voorganger
   *  (en hammocks) hierboven; zie de docstrings van `rootFloor`/`ownAnchor` in `CPMSolver` voor de
   *  volledige motivatie. */
  projectStartDate?: string;
  /** Geconfigureerde projecteinddatum. Alleen actief wanneer de brongebonden
   *  `useProjectEndDateForFloat`-optie aan staat; anders blijft max(EF) leidend. */
  projectEndDate?: string;
}

/**
 * Eerste geldige werk-instant OP-of-NÁ `from`, in `eng` (dag ⇒ `nextWorkDay`, uur ⇒
 * `nextWorkInstant`). Top-level EXPORT (T7-review H1/H3) zodat zowel de solver zélf (`ownAnchor`/
 * `rootFloor` hierboven, via de instance-tunnel `snapOnOrAfter`) als `projectStartAnchorClamp.ts`
 * (de T7b-klem, aangeroepen vanuit zowel `projectSlice.setProject` als `mcpTransaction.ts`'s
 * `draft.setProject`) EXACT dezelfde anker-snap gebruiken. Vóór deze review deed de T7b-klem het
 * anker een kale datumstring toekennen zonder kalender-snap — in uurmodus landde dat na de
 * eerstvolgende `runCPM` op middernacht (H3a) i.p.v. de eerste werkband; nu delen beide plekken
 * één definitie, dus kan dat niet meer uiteenlopen. Puur, geen instantie-state.
 */
export function snapWorkInstantOnOrAfter(eng: CalendarEngine, from: Date): Date {
  return eng.isHourMode ? eng.nextWorkInstant(from) : eng.nextWorkDay(from);
}

/**
 * Effectieve lag in dagen van een relatie: procent-lag wordt uit de ACTUELE voorgangerduur
 * opgelost (MSP-semantiek, afgerond op hele dagen), anders geldt lagDays. Gedeeld met de UI
 * (relatietabel-waarschuwingen) zodat er één definitie bestaat.
 *
 * `hoursPerDay` (optioneel, fase 2.10) = de dag↔minuut-factor van de kalender waarin de lag telt —
 * de VOORGANGER-kalender voor WORKTIME (`LAG_CALENDAR='predecessor'`), 24 voor ELAPSEDTIME. Alleen
 * mét die factor kan een lag die uitsluitend als `lagMinutes` bestaat (`lagDays = 0`) in DAGEN
 * uitgedrukt worden. Zonder de factor (UI-aanroepers) is de functie byte-identiek aan vóór 2.10.
 */
export function resolveEffectiveLagDays(seq: Sequence, predTask: Task, hoursPerDay?: number): number {
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    const predDur = isZeroDurationMilestone(predTask) ? 0 : predTask.time.scheduleDuration;
    return Math.round((predDur * seq.lagPercent) / 100);
  }
  const days = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  // Minuut-lag ZONDER dag-lag (fase 2.10). `p6xmlReader`/`mspdiReader` schrijven `lagDays: 0` +
  // `lagMinutes` zodra de OPVOLGER in uur-modus staat, terwijl de solver de lag in de VOORGANGER-
  // kalender oplost. Bij een DAG-voorganger viel de lag daardoor stil weg (exact lag 0, forward én
  // backward) — stil dataverlies op een reëel importpad. Reken hem om naar hele dagen met de
  // meegegeven factor; half rondt van nul af, zodat een lead (negatief) symmetrisch behandeld wordt.
  // `lagDays ≠ 0` blijft leidend: het IFC-pad vult beide velden (`parseDurationDays` rondt `PT4H`
  // naar boven op 1 dag) en blijft zo byte-identiek.
  if (
    days === 0 && typeof hoursPerDay === 'number' && hoursPerDay > 0 &&
    typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes) && seq.lagMinutes !== 0
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
  /** OPTIONEEL — interfererende speling = totalFloat − freeFloat (fase 2.9, §4.6). Alleen
   *  geschreven wanneer de analyse-laag draait; ongeschreven ⇒ byte-identiek default. */
  interferingFloat?: number;
  /** OPTIONEEL — near-critical (fase 2.9, §4.6). Alleen geschreven bij ingestelde drempel. */
  isNearCritical?: boolean;
  /** OPTIONEEL — float-path-nummer (fase 2.9, §4.6). Alleen geschreven bij floatPaths. */
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

/**
 * Leeg `CPMResult` voor de degradatiepaden in `solve()` (cyclus, kalender zonder werkdagen,
 * onparseerbare startdatum): alle verzamelingen leeg, alleen de foutmelding verschilt per pad.
 * Eén fabriek zodat de drie guards nooit kunnen divergeren.
 */
function emptyResult(error: string): CPMResult {
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
    error,
  };
}

export class CPMSolver {
  private tasks: Map<string, Task>;
  private sequences: Sequence[];
  // Per-taak-kalender (fase 2.8a, §5.1): de projectdefault-engine voor project-brede grenslogica,
  // plus een cache van engines per bibliotheek-kalender. `calendarFor(task)` levert de engine waarin
  // de duur/constraints/float van díé taak rekenen; zonder afwijkende `task.calendarId` valt alles
  // terug op `projectEngine` ⇒ byte-identiek aan het één-kalender-gedrag van vóór 2.8a.
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
  // Relaties waarvan de lead in de forward-pass door de projectstart-vloer is afgekapt.
  private truncatedLeadIds: string[] = [];
  // Taken met een harde MSO/MFO-pin (fase 2.9, §4.2) waarvan de voorganger-druk (`rawMax`) later
  // valt dan de pin ⇒ de logica is gebroken (taak start vóór z'n voorganger klaar is). Verzameld in
  // de forward pass, samengevoegd met `violatedConstraintTaskIds` in `computeResults`.
  private hardPinViolatedIds: string[] = [];
  // Hammocks (fase 2.9, §4.4) zónder finish-driver: EF valt terug op ES (nul-lengte). Verzameld in de
  // forward pass, gerapporteerd als waarschuwing in `hammockNoFinishDriverTaskIds`.
  private hammockNoFinishDriverIds: string[] = [];
  // Taken waarvan de earlyFinish-berekening tegen de MAX_SCAN/MAX_DAYS-cap van `addWorkDays` liep
  // (WP7 "Onwerkbaar-venster-detectie"): een onwerkbaar taakvenster (bv. een aaneengesloten holiday-
  // blok). Verzameld in de forward pass, zacht gerapporteerd als `cappedTaskIds`. Geen error, geen
  // rollback — de kalenderwijziging is legitiem; de waarschuwing wijst de te repareren taak aan.
  private cappedTaskIds: string[] = [];

  private options: CPMOptions;
  // Werkdag-gesnapte statusdatum (fase 2.6), of null ⇒ geen statusdatum-gedrag. Gezet in solve().
  private dataDate: Date | null = null;
  // RUWE (ongesnapte) geconfigureerde projectstartdatum, of null ⇒ geen ondergrens-gedrag (byte-
  // identiek aan vóór deze optie). Ongesnapt omdat elke wortel-taak 'm in zíjn EIGEN kalender snapt
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
  // M7 (CPM-review): dedup-sleutel voor de dropped-relaties-waarschuwing hieronder, STATIC (gedeeld
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
    options: CPMOptions = {},
  ) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));

    // Guard (T8-rooktest, 870d339f60603f71 — hash-only §8): de aanroepers (`runCPM`/`levelResources` in
    // `scheduleSlice.ts`, de leveler in `ResourceLeveler.ts`, `benchmark/runner.ts`) geven hier
    // opzettelijk alleen semantische BLADTAKEN aan mee — een samenvattingstaak krijgt
    // zijn datums via de rollup in `applyCpmResult`, niet als eigen CPM-knoop. `sequences` komt
    // ONGEFILTERD binnen: in MS Project is een relatie op een samenvattingstaak legaal (mspdiReader/
    // ifcReader/mppReader lezen 'm gewoon in), maar deze solver kent geen samenvattingstaken. Vóór
    // deze guard duwde zo'n relatie het niet-bestaande taak-id de topologische sortering in
    // (`topologicalSort` telt `inDegree` onvoorwaardelijk voor élke `successorId`, ook een dat niet
    // in `this.tasks` zit) en crashte de forward/backward pass op een `this.tasks.get(id)!`-aanname
    // zodra dat fantoom-id in `order` viel — geen nette foutmelding, een onbehandelde throw die
    // `openFile`s catch opslokt, zodat het bestand opent maar de planning stil onberekend blijft.
    //
    // Semantiek: een relatie die een taak raakt die niet in de meegegeven set zit wordt genegeerd
    // i.p.v. de solver te laten crashen. Dit blijft het VANGNET voor écht verweesde/ongeldige
    // taak-ids — sinds `expandSummaryRelations` (vervolgtaak op deze guard) herschrijven de reguliere
    // aanroepers (`runCPM`/`levelResources` in `scheduleSlice.ts`, de leveler in
    // `ResourceLeveler.ts`, `benchmark/runner.ts`) een relatie op een WBS-samenvattingstaak ZELF al
    // naar bladtaak-relaties vóórdat de solver ze ziet; die relaties bereiken deze guard dus normaal
    // niet meer. Een aanroeper die `expandSummaryRelations` overslaat (bv. rechtstreeks tegen de
    // solver getest) valt terug op het oude gedrag: droppen, niet crashen.
    const kept: Sequence[] = [];
    const dropped: string[] = [];
    for (const seq of sequences) {
      if (this.tasks.has(seq.predecessorId) && this.tasks.has(seq.successorId)) {
        kept.push(seq);
      } else {
        dropped.push(seq.id);
      }
    }
    // X12: relationele P6/XER-ankers vormen één brongepoorte grens. RelationMath en alle solver-
    // paden zien uitsluitend deze effectieve relaties; een losse vlag in generieke IFC/ext-data kan
    // daarmee nooit P6-gedrag activeren. De XER-reader is de enige schrijver van `p6Source`.
    const p6SourceActive = options.schedulingOptions?.p6Source === 'XER';
    this.sequences = p6SourceActive
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
      // M7: alleen loggen als de gedropte SET (niet de instantie) daadwerkelijk is veranderd sinds
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
    this.options = options;
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

  /** Engine voor een concrete kalender (gecachet op kalender-id). */
  private engineForCal(cal: WorkCalendar): CalendarEngine {
    let e = this.engineCache.get(cal.id);
    if (!e) { e = new CalendarEngine(cal); this.engineCache.set(cal.id, e); }
    return e;
  }

  /** De kalender-engine waarin de duur/constraints/float van `task` rekenen (§5.2). */
  private calendarFor(task: Task): CalendarEngine {
    return this.engineForCal(resolveCalendar(task.calendarId, this.registry, this.projectCal));
  }

  private p6XerOption(value: boolean | undefined): boolean {
    return this.options.schedulingOptions?.p6Source === 'XER' && value === true;
  }

  /** Smalle P6-XER-resultaatprojectie; de CalendarEngine-primitieven blijven formaatneutraal. */
  private p6ProjectedSubtract(eng: CalendarEngine, end: Date, minutes: number): Date {
    return this.options.schedulingOptions?.p6Source === 'XER'
      ? eng.subtractP6XerProjectedWorkMinutes(end, minutes)
      : eng.subtractWorkMinutes(end, minutes);
  }

  /** Smalle P6-XER-projectie voor TF/FF en relationship free float. */
  private projectedWorkMinutesBetween(eng: CalendarEngine, a: Date, b: Date): number {
    return this.options.schedulingOptions?.p6Source === 'XER'
      ? eng.p6XerProjectedWorkMinutesBetween(a, b)
      : eng.workMinutesBetween(a, b);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Fase 2.8b (golf 2) — MODUS-BEWUSTE rekenkern (§5). Elke helper reduceert in
  //  DAG-modus tot exact de bestaande dag-expressie (byte-identiek); alleen een
  //  UUR-kalender (`isHourMode`) activeert het minuut-native pad. Zo blijven de 290
  //  dag-cases + 23 examples ongemoeid — de constructie, niet een her-derivatie (§2.2).
  // ═══════════════════════════════════════════════════════════════════════════
  private static readonly MS_PER_DAY = 86_400_000;

  /** Parse een datum-string in de kalendermodus: dag ⇒ `parseDate` (middernacht, byte-identiek),
   *  uur ⇒ `parseInstant` (behoudt tijd-van-de-dag). */
  private parseIn(eng: CalendarEngine, iso: string): Date {
    return eng.isHourMode ? parseInstant(iso) : parseDate(iso);
  }
  /** Snap op-of-ná (voorwaarts): dag ⇒ `nextWorkDay`, uur ⇒ `nextWorkInstant`. Instance-tunnel naar
   *  de top-level, GEDEELDE `snapWorkInstantOnOrAfter` (T7-review H1/H3): één definitie voor de
   *  solver-interne aanroepen hier ÉN voor `projectStartAnchorClamp.ts` (de T7b-klem in
   *  `projectSlice.setProject`/`mcpTransaction.ts`'s `draft.setProject`) — geen tweede snap-
   *  implementatie die stil van deze kan afdrijven. */
  private snapOnOrAfter(eng: CalendarEngine, d: Date): Date {
    return snapWorkInstantOnOrAfter(eng, d);
  }
  /** B4 (Opus-her-check T15-fixronde): snap een geregistreerd FEIT (actualStart/actualFinish)
   *  VOORWAARTS naar de eerstvolgende werk-instant, MAAR alleen als die instant op DEZELFDE
   *  kalenderdag blijft — kruist de snap naar een andere dag, dan blijft het rauwe instant staan.
   *  Reconcilieert twee tegenstrijdige corpusmetingen: `mpp14resource.mpp`'s "Completed Task"
   *  (actualStart zaterdag, MSP-eigen SCHEDULED_START blijft zaterdag — GEEN dag-kruisende snap;
   *  de aanleiding voor H1/c2's oorspronkelijke "nooit snappen"-aanname) tegenover
   *  `mpp14timephasedsegmentsmanual.mpp`'s "Task Three"/"Task Four" (actualStart 07:00, buiten de
   *  band maar op een GEWONE werkdag — MSP-eigen SCHEDULED_START snapt hier WEL door naar 08:00,
   *  een BINNEN-dag-snap; gevonden via B4's eigen corpus-verificatie, die de kale "nooit snappen"-
   *  variant op dit bestand van 100% exact naar 2 sameday-taken liet zakken). MSP normaliseert dus
   *  een sub-dag-afwijking BINNEN dezelfde dag, maar verplaatst een geregistreerd feit nooit naar
   *  een ANDERE kalenderdag — precies wat deze functie doet. Vervangt de kale `snapOnOrAfter`/
   *  `parseIn`-keuze in zowel de VOLTOOID- als de IN-PROGRESS-branch van de voortgangstak.
   *
   *  T16-VEEGLIJST (ná-band-uitkomst, expliciet uitgesproken): `d` NÁ de laatste band van zijn EIGEN
   *  kalenderdag (bv. 20:00 op een werkdag waarvan de laatste band om 17:00 eindigt) laat
   *  `snapOnOrAfter` naar de EERSTVOLGENDE werk-instant snappen — die valt per definitie op een
   *  ANDERE kalenderdag (`nextWorkInstant` heeft op de eigen dag niets meer te vinden). De
   *  `startOfDay`-gelijkheidstoets hierboven verwerpt die snap dan ook, en de functie geeft het
   *  RAUWE `d` terug (20:00 blijft 20:00) — géén werk-instant, maar wél de dag die MSP zelf opsloeg.
   *  Dit is een CONSERVATIEVE, maar ONGETOETSTE extrapolatie van dezelfde dag-behoudende regel die
   *  B4 wél corpusbreed verifieerde (geen gemeten corpusbestand draagt een `actualStart`/
   *  `actualFinish` ná de laatste band van zijn eigen dag) — bewust zo gelaten i.p.v. gegokt op een
   *  derde snapregel zonder bewijs. */
  private snapActualForward(eng: CalendarEngine, d: Date): Date {
    const snapped = this.snapOnOrAfter(eng, d);
    return this.startOfDay(snapped).getTime() === this.startOfDay(d).getTime() ? snapped : d;
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
  /** Voorwaartse her-snap van een OPVOLGER-earlyStart die MSP-pariteit (T6, §9/O6) respecteert voor
   *  een EINDmijlpaal: `snapOnOrAfter` normaliseert met `nextWorkInstant` (rand `[start,end)`), dat
   *  een instant EXACT op een band-eind (bv. di 17:00) altijd naar de volgende werk-instant duwt —
   *  precies de dubbele snap die `relationMath`'s FS-tak met de `lagIsZero`-kortsluiting al voorkomt
   *  vóórdat de waarde hier aankomt. Zonder deze wacht herintroduceert de generieke her-snap
   *  hieronder (regel 686/728, bestond al vóór T6 voor de "constrained root-taak op middernacht"-
   *  situatie) diezelfde bug op het volgende niveau. `snapOnOrBefore(...) === d` is de test "`d` is
   *  al een geldige `(start,end]`-instant" (band-interieur of band-eind) — precies de conventie
   *  waarmee `finishFromStart` een `ef` bouwt; bij een niet-milestone of een dag-kalender reduceert
   *  dit byte-identiek tot de kale `snapOnOrAfter`. */
  private snapSuccessorEarlyStart(
    eng: CalendarEngine,
    d: Date,
    task: Task,
    preserveP6FinishBoundary = false,
  ): Date {
    // T8-review-BLOCKER (Opus-hercheck 72486257): een ELAPSEDTIME-opvolger krijgt hier GEEN
    // werk-instant-snap. Orkestratorbesluit op de semantische vraag ("mag een 24/7-taak op een
    // niet-werk-instant starten?"): JA — MS Project plant elapsed-taken puur in kalendertijd, de
    // werkkalender is er per definitie niet op van toepassing (dat IS het punt van ELAPSEDTIME).
    // Zonder deze bypass herintroduceerde deze generieke her-snap (die na ELKE forward-constraint-
    // berekening draait, dus ook ná H1's al-correcte `deps.startFromFinish`-uitkomst) precies de
    // H1-schending één stap verderop: een FF+0 naar een elapsed-opvolger die op zaterdag moest
    // landen, werd hier alsnog naar de eerstvolgende werk-instant/-dag geduwd — de opvolger se EF
    // schoof daardoor mee, ondanks dat forwardConstraint zelf al goed rekende. `isZeroDurationMilestone`
    // (niet de kale `task.isMilestone`) blijft uitgesloten: een ECHTE (0-duur) mijlpaal heeft geen
    // eigen duur/durationType-semantiek, de bestaande FINISH-mijlpaal-tak hieronder regelt zijn eigen
    // — orthogonale — landing. H3 (Opus-review T15-iteratie-2): met de kale `task.isMilestone` sloot
    // een MIJLPAAL-MET-DUUR (isMilestone=true, reële duur, T15) die ZELF ELAPSEDTIME is deze bypass
    // stil uit — precies de H1-schending hierboven (FF-relatie-schending, opvolger op een
    // zaterdag-einde geduwd) herleeft dan voor die taak, ook al is ze voor de PLANNING geen mijlpaal.
    if (!isZeroDurationMilestone(task) && task.time.durationType === 'ELAPSEDTIME') return d;
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
    if (!this.p6XerOption(this.options.schedulingOptions?.p6ZeroDurationUsesPlannedBoundary)
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
    if (!this.p6XerOption(this.options.schedulingOptions?.p6ZeroDurationUsesPlannedBoundary)
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
    return new Date(this.startOfDay(start).getTime() - CPMSolver.MS_PER_DAY + clockMs);
  }
  private modeOf(eng: CalendarEngine): DateMode {
    return eng.isHourMode ? 'hour' : 'day';
  }
  /** UTC-middernacht van de dag die `d` bevat (voor de cross-modus-dagrand, §4.3/§5.2). */
  private startOfDay(d: Date): Date {
    return new Date(Math.floor(d.getTime() / CPMSolver.MS_PER_DAY) * CPMSolver.MS_PER_DAY);
  }

  /**
   * De `projectStart`-ONDERGRENS (T7, §9/O2): het MAXIMUM van de taak-eigen gesnapte
   * `scheduleStart` en de geconfigureerde projectstartdatum (zelf ook per `eng` gesnapt — een
   * taak op een afwijkende kalender mag de vloer dus op een andere dag landen dan de
   * projectkalender zelf zou geven). `projectStartRaw` afwezig (optie niet meegegeven, of
   * onparseerbaar) ⇒ puur de eigen start, byte-identiek aan vóór deze optie.
   *
   * UITSLUITEND nog gebruikt voor de `projectStart`-precompute hieronder in `forwardPass`
   * (taken MET voorganger + hammocks) — dat is de early-start-ONDERGRENS voor DIE hele categorie,
   * niet uitsluitend tegen relatie-LEADS (T7-review M2, gecorrigeerd): ook een gewone FS/FF-
   * relatie met lag 0 van een vroege wortel-taak wordt hier gevloerd, niet alleen een negatieve
   * lag. Alleen de gebruikerszichtbare `truncatedLeadIds`-markering is wél lead-specifiek. Dát is
   * exact de bescherming die het oorspronkelijke vloer-scenario (gebruikstest-bevinding 2026-08: een
   * VEROUDERDE `scheduleStart` — bv. gezet vóór een latere wijziging van de projectstartdatum —
   * die stil vóór het officiële projectbegin bleef doorlopen, in het verkeerde geval zelfs een
   * weekend "terug" t.o.v. een za/zo-projectstart) beoogde, en die blijft hier onverkort staan.
   *
   * Sinds T7 NIET meer gebruikt voor de eigen ES van een wortel-taak zelf (§9/O2, de brede regel:
   * "een ingelezen anker wordt nooit door de vloer overruled") — zie `ownAnchor` daarvoor. Vóór
   * T7 leverde deze functie ook dié waarde, wat 25 taken in 12 corpusbestanden vooruit duwde
   * t.o.v. hun eigen, in het bronbestand opgeslagen anker (11 met een expliciete SNET vóór
   * projectstart, 14 zonder enige constraint) — minuut-exactheid eist dat het eigen anker wint.
   *
   * T8-review-BLOCKER (Opus-hercheck 72486257, uitgebreid — derde gevonden hersnap-plek): `own`
   * snapte tot nu toe ALTIJD naar een werk-instant, ook voor een ELAPSEDTIME wortel-taak. Zo'n
   * taak levert de `projectStart`-vloer (het MINIMUM over alle wortel-taken hieronder) — een
   * elapsed wortel-taak met bv. een zaterdag-anker duwde die vloer dan naar maandag, wat via de
   * vloer óók niet-wortel-taken (SS/FS/…) onterecht dichttrok, ook al is de EIGEN ES van die
   * elapsed taak zelf al correct (`ownAnchor`, hierboven bewust ongesnapt). `elapsedTask`: geef
   * de rauwe `own` terug, ONGESNAPT — de `projectStartRaw`-vergelijking (een EXPLICIET door de
   * gebruiker gezette ondergrens) blijft wél gesnapt, net als een constraint (L1-afbakening: een
   * opgelegde grens is geen relatie-afgeleide instant). */
  private rootFloor(eng: CalendarEngine, scheduleStart: string, elapsedTask: boolean): Date {
    const own = elapsedTask
      ? this.parseIn(eng, scheduleStart)
      : this.snapOnOrAfter(eng, this.parseIn(eng, scheduleStart));
    if (!this.projectStartRaw) return own;
    const floor = this.snapOnOrAfter(eng, this.projectStartRaw);
    return floor > own ? floor : own;
  }

  /**
   * Taak-eigen gesnapte start, ONGEKLEMD tegen de projectstart (T7, §9/O2). Gebruikt voor de ES
   * van een taak ZONDER voorganger (`forwardPass`, `preds.length === 0`-tak): een ingelezen
   * anker wordt nooit door de vloer overruled, ook niet als het vóór de geconfigureerde
   * projectstartdatum ligt. De vloer zelf (`rootFloor`) bestaat nog onverkort — maar uitsluitend
   * nog als early-start-ondergrens voor taken MET voorganger (zie `rootFloor`'s docstring: dat
   * geldt breder dan alleen relatie-leads). Een taak zónder voorganger én zónder relatie kan dus vanaf nu vóór de
   * projectstart staan als het eigen anker dat zegt — exact de MS Project-semantiek die de
   * fidelity-audit meet.
   *
   * Z13 (etappe "nul afwijkingen", dossier "rauw anker zonder constraint"): een instant exact op
   * het LAATSTE band-eind van zijn eigen kalenderdag (bv. `…T17:00` op een 08:00–17:00-band — niet
   * een TUSSEN-band-eind zoals `12:00` op een 08–12/13–17-dag, zie `isExactBandEnd`'s docblok) is
   * een gedegenereerd geval — er valt niets te snappen, het eerstvolgende werk-instant ÍS de
   * volgende bandstart, maar MSP bewaart het instant zelf (corpusbewijs:
   * `mpxj/junit/data/timephased-prorated-cost-resource.mpp`, taak "No Progress - Actual Cost" —
   * MSP's eigen SCHEDULED_START blijft `2026-01-29T17:00`, onze `snapOnOrAfter` duwde 'm vóór deze
   * fix naar `2026-01-30T08:00`). `isExactBandEnd` is hier ONVOORWAARDELIJK toegepast (niet tot
   * mijlpalen beperkt) — anders dan `snapSuccessorEarlyStart`s bestaande FINISH-mijlpaal-
   * uitzondering hierboven (die deze (start,end]-vrijheid alleen aan een mijlpaal geeft): een
   * WORTEL-anker is per definitie ALTIJD een gelezen waarde, nooit een CPM-berekende — dezelfde
   * grond die `ownAnchor` hierboven al ONGEKLEMD tegen de projectstart houdt. Voor een normale
   * werk-instant-start is dit byte-identiek (`snapOnOrAfter` was daar toch al een no-op).
   * Corpusbreed gemeten (216 leesbare bestanden corpus+crawl, wortel-taken zonder manual-vlag/
   * constraint met een uur-kalender): PRECIES 1 taak in de HELE populatie heeft een raw anker exact
   * op een bandgrens — de hierboven genoemde, en die bandgrens is het LAATSTE band-eind van haar dag
   * (geen enkel corpusgeval op een tussen-band-eind). Geen enkel ander bestand raakt deze tak dus
   * ooit; `cases-advanced-cpm.json` pint zowel dit geval, het band-interieur-gedrag als het
   * tussen-band-eind-gedrag (mutatiebewijs: zie de case-notities daar).
   *
   * Z19 (residu-iteratie "nul afwijkingen", klokdossier-mijlpaaldossier): EEN 0-DUURMIJLPAAL SNAPT
   * NOOIT — zelfde regel als `forwardBoundOf`'s eigen Z19-toelichting (die de T6-her-review-aanname
   * met een corpusfeit weerlegt) — MAAR uitsluitend bij een ECHT datetime-anker (`scheduleStart`
   * draagt een tijdcomponent) in uur-modus, zelfde "S13"-conventie/mutatiebewijs als daar (een
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
   *  band-eind (bv. `12:00` in een 08–12/13–17-dag). Reviewbevinding (fixronde ná Opus-afkeuring
   *  6f4c903f): de eerdere, bredere test (`snapOnOrBefore(eng,d)===d` zonder de laatste-band-eis)
   *  vuurde ook op `12:00` — daar telt `dayFirstBandStart` dan stilzwijgend de hele OCHTEND mee bij
   *  de duur-optelling, terwijl het corpusbewijs (`timephased-prorated-cost-resource.mpp`)
   *  UITSLUITEND het LAATSTE band-eind van de dag betreft (corpusincidentie op een tussen-band-eind:
   *  0). Vandaar de expliciete vergelijking met `bands[bands.length-1].end` i.p.v. de kale
   *  `(start,end]`-test. Dag-modus kent geen bandgrenzen ⇒ altijd `false`. */
  private isExactBandEnd(eng: CalendarEngine, d: Date): boolean {
    if (!eng.isHourMode) return false;
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return false;
    const lastBandEndMs = this.startOfDay(d).getTime() + bands[bands.length - 1].end * MS_PER_MIN;
    return d.getTime() === lastBandEndMs;
  }

  /** Het EERSTE band-begin op `d`'s eigen kalenderdag (Z13, gebruikt door `addDurationChecked`s
   *  band-eind-wacht hierboven én `subDuration`s backward-spiegel verderop) — `effectiveBandsOn`
   *  levert de banden al MET geldende werkende uitzonderingen/holidays voor die specifieke dag,
   *  dus dit volgt dezelfde bron als elke andere band-vergelijking in dit bestand. `bands.length===0`
   *  is hier PROVEERBAAR onbereikbaar bij elke aanroeper: beide aanroepers gaten deze functie
   *  UITSLUITEND achter `isExactBandEnd(eng, d)`, en die functie zelf retourneert al `false` zodra
   *  `effectiveBandsOn(d)` leeg is (zie hierboven) — een dag zonder enige band kan dus nooit als
   *  "band-eind" gekwalificeerd zijn geweest. Geen corpusloze rode-pad-fixture nodig/mogelijk: een
   *  synthetische holiday-op-de-ankerdag-case zou per constructie nooit `isExactBandEnd` passeren,
   *  dus nooit hier aankomen. De `?? start`/`?? d`-terugval bij de aanroepplekken blijft staan als
   *  pure verdediging-in-de-diepte (nooit geraakt, geen dode-code-claim in een testcommentaar). */
  private dayFirstBandStart(eng: CalendarEngine, d: Date): Date | null {
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return null;
    return new Date(this.startOfDay(d).getTime() + bands[0].start * MS_PER_MIN);
  }

  /** Het LAATSTE band-EIND op `d`'s eigen kalenderdag (Z13, backward-spiegel van `dayFirstBandStart`
   *  hierboven — uitsluitend gebruikt door `subDuration`s float-bewuste band-eind-wacht). Zelfde
   *  onbereikbaarheids-redenering als `dayFirstBandStart`'s docblok voor de `bands.length===0`-tak. */
  private dayLastBandEnd(eng: CalendarEngine, d: Date): Date | null {
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return null;
    return new Date(this.startOfDay(d).getTime() + bands[bands.length - 1].end * MS_PER_MIN);
  }

  /** De mode-bewuste primitieven die de relatie-wiskunde (`relationMath.ts`, audit P15) injectief
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
    startOfDay: (d) => this.startOfDay(d),
  };

  /** Vroege finish = start ⊕ duur (§5.1). Mijlpaal ⇒ 0; ELAPSEDTIME ⇒ kale 24/7-klokoptelling
   *  (T8, precedent `resolveElapsedMinutes`/`relationMath.ts`, GEEN kalenderband-toetsing); uur
   *  (WORKTIME) ⇒ `addWorkMinutes(durationMinutesOf)`; dag (WORKTIME) ⇒ `addWorkDays(durationDaysOf)`
   *  — LETTERLIJK de huidige regel (`durationDaysOf` levert op een dag-kalender altijd de integer
   *  `scheduleDuration`, nooit een fractionele dag, Bevinding 2).
   *
   *  Z7 (aangrijpingspunt 1, splits): `task.splitGaps` telt hier mee als EXTRA werkminuten/-dagen
   *  bovenop de gewone duur, via `splitTotalSpanMinutes`/`splitTotalSpanDays` (`duration.ts` —
   *  wandelt de synthetische gaten-as i.p.v. een vast venster te klemmen, Z7-fixronde-H1: de
   *  vroegere venster-vorm trunceerde een gat dat over de `durationMinutesOf`-grens heen liep,
   *  omdat `TaskSplitGap.afterMinutes` NIET op de zuivere-werkduur-as staat maar op MSP's eigen
   *  cumulatieve `elapsedWorkMinutes`-as, die voorgaande gaten al meetelt). ELAPSEDTIME blijft
   *  bewust ONGEMOEID — splits zijn een WERK-tijd-concept (24/7 kent geen "gat", zie `duration.ts`'s
   *  moduleheader bij deze functies). `task.splitGaps` afwezig ⇒ `splitTotalSpanMinutes`/
   *  `splitTotalSpanDays` geven de kale duur ongewijzigd terug ⇒ byte-identiek aan vóór Z7. */
  private addDuration(eng: CalendarEngine, start: Date, task: Task): Date {
    return this.addDurationChecked(eng, start, task).date;
  }
  /** `addDuration` mét CAP-signaal (WP7): identieke datum-uitkomst, plus `capped` uit de dag-modus-
   *  `addWorkDaysChecked` — een onwerkbaar taakvenster (holiday-blok) dat de earlyFinish tegen de
   *  MAX_SCAN/MAX_DAYS-grens duwt. Mijlpaal, ELAPSEDTIME en uur-modus cappen hier nooit (`false`):
   *  een mijlpaal heeft geen duur, ELAPSEDTIME kent geen onwerkbaar-venster-begrip (24/7), en de
   *  minuut-lussen hebben hun eigen best-effort-terugval buiten dit signaal. */
  private addDurationChecked(eng: CalendarEngine, start: Date, task: Task): { date: Date; capped: boolean } {
    if (isZeroDurationMilestone(task)) return { date: new Date(start.getTime()), capped: false };
    if (task.time.durationType === 'ELAPSEDTIME') {
      return { date: addElapsedMinutes(start, elapsedMinutesOf(task, eng)), capped: false };
    }
    if (eng.isHourMode) {
      const totalMinutes = splitTotalSpanMinutes(task.splitGaps, durationMinutesOf(task, eng));
      if (totalMinutes > 0 && this.p6FinishBoundaryStartTaskIds.has(task.id)
        && this.isExactBandEnd(eng, start)) {
        return {
          date: eng.addWorkMinutes(eng.nextWorkInstantAfter(start), totalMinutes),
          capped: false,
        };
      }
      // Z13 (dossier "rauw anker zonder constraint"): `start` exact op een band-eind (`ownAnchor`
      // hierboven laat zo'n wortel-anker sinds deze fix bewust RAUW) — INVOERBEWIJS (corpusbestand
      // `timephased-prorated-cost-resource.mpp`, 4 taken, identieke duur/kalender): MSP's eigen
      // `SCHEDULED_FINISH` is voor ALLE VIER de taken hetzelfde instant (`2026-02-02T17:00`) — óók
      // voor "No Progress - Actual Cost", die als ENIGE om `17:00` (band-eind) start i.p.v. `08:00`
      // (band-begin) zoals de andere drie. MSP rekent de ankerdag van die taak dus als VOLLEDIG
      // verbruikt mee in de duur, ongeacht dat er op klokinstant-niveau nul minuten van die dag
      // resteren. Reken de duur daarom vanaf de EERSTE band van diezelfde kalenderdag i.p.v. vanaf
      // het band-eind-instant zelf — de GERAPPORTEERDE `earlyStart` blijft ongewijzigd het rauwe
      // band-eind-anker, dit raakt uitsluitend het interne rekenpunt voor de
      // duur-optelling. `totalMinutes > 0`-wacht (reviewbevinding, `msp-06`/`msp-06b` her-check):
      // ZONDER die wacht verlegde deze aanpassing ook de RETURN van een NUL-duur, niet-mijlpaal-
      // taak (`isZeroDurationMilestone` sluit die niet uit — vereist óók `task.isMilestone`) van
      // `addWorkMinutes`'s eigen `minutes ≤ 0`-kortsluiting (die geeft `startInstant` ONGEWIJZIGD
      // terug) naar de band-begin-waarde — exact de dataDate-vloer-cases `msp-06`/`msp-06b` (Z's
      // `ef` verschoof van 17:00 naar 08:00, want Z heeft `dur:0` zonder `milestone:true`). Met
      // `totalMinutes > 0` raakt deze wacht uitsluitend een taak die ECHT werk-minuten optelt.
      // Band-INTERIEUR/normale starts ⇒ `isExactBandEnd` levert `false` ⇒ byte-identiek aan vóór
      // Z13.
      const walkStart = totalMinutes > 0 && this.isExactBandEnd(eng, start)
        ? this.dayFirstBandStart(eng, start) ?? start
        : start;
      return { date: eng.addWorkMinutes(walkStart, totalMinutes), capped: false };
    }
    const totalDays = splitTotalSpanDays(task, eng);
    return eng.addWorkDaysChecked(start, totalDays);
  }
  /** Late start = late finish ⊖ duur (§5.1, spiegel van `addDuration`). BEWUST GEEN
   *  `levelingDelay`/`levelingDelayMinutes`-aftrek hier (Z6-besluit, ongewijzigd na de Z6-
   *  fixronde): `end` (= `lateFinish`) komt hier al onafhankelijk van deze taak se eigen
   *  `earlyStart` binnen, dus een aftrek HIER zou de vertraging DUBBEL verrekenen in
   *  `totalFloat`. Dat is een ander mechanisme dan de backward-DOORGIFTE-spiegel in
   *  `backwardPass` (Z6-fixronde B2, `shiftByLevelingDelay`s aanroep daar): die corrigeert wat
   *  een VOORGANGER van deze taak als late-zijde-druk ziet, niet wat déze taak zelf met haar
   *  eigen duur doet — de twee plekken lossen verschillende problemen op en bijten elkaar niet.
   *
   *  Z7 (aangrijpingspunt 3, splits — spiegel van `addDurationChecked` hierboven, "anders
   *  spookfloat", plan-§Z7): zónder deze spiegel zou de backward-pass een LS berekenen die niet
   *  bij de gaten-bewuste EF van dezelfde taak hoort — LF-EF zou dan systematisch afwijken van
   *  LS-ES, wat via `totalFloat`/`freeFloat` een spook-speling introduceert op elke gesplitste
   *  taak. Zelfde venster `[0, totale duur)`, zelfde ELAPSEDTIME-uitsluiting. */
  /** `actualEarlyStart` (Z13-fixronde, punt B7): de ES die `earlyDates` voor DEZE taak in DIT solve
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
    if (eng.isHourMode) {
      const totalMinutes = splitTotalSpanMinutes(task.splitGaps, durationMinutesOf(task, eng));
      const natural = this.p6ProjectedSubtract(eng, end, totalMinutes);
      if (totalMinutes > 0 && this.p6FinishBoundaryStartTaskIds.has(task.id)) {
        const naturalDayStart = this.dayFirstBandStart(eng, natural);
        if (naturalDayStart?.getTime() === natural.getTime()) {
          return eng.prevWorkInstantBefore(natural);
        }
      }
      // Z13 (backward-spiegel van `addDurationChecked`s band-eind-wacht): voor een WORTEL-taak
      // (geen voorganger) wier eigen `ownAnchor` het rauwe band-eind-anker behoudt (zie die
      // functie), telt `addDurationChecked` de EIGEN kalenderdag van dat anker mee als volledig
      // verbruikt (`dayFirstBandStart`) — `es` blijft desondanks het RAUWE, latere band-eind-
      // instant. Zonder deze spiegel weet de backward-pass daar niets van: `subtractWorkMinutes`
      // hierboven wandelt vanaf `end` terug met de KALE duur — voor een taak zonder speling
      // (`end` = de eigen `ef`) landt dat vóór `es` (negatieve `tf` op een taak die door NIETS
      // anders begrensd wordt, een innerlijke tegenstrijdigheid, geen MSP-gedrag); mét speling
      // (`end` > `ef`, reviewbevinding B3) geeft de kale aftrek een `tf` die stelselmatig één
      // werkdag te klein is (`lateFinish−earlyFinish` ≠ `lateStart−earlyStart`), onbewaakt door de
      // fidelity-meting (die alleen ES/EF ziet, geen float).
      //
      // ALGEMENE SPIEGEL (fixronde ná Opus-afkeuring 6f4c903f, punt B3 — niet langer alleen het
      // nul-speling-geval): in plaats van te toetsen of `natural` toevallig EXACT op `task`'s eigen
      // ankerdag landt, toetst deze wacht of `natural` op ÉÉN of andere kalenderdag D exact op de
      // EERSTE band landt (`dayFirstBandStart(natural) === natural`) — dat is precies wat een
      // kale, "hele-werkdagen"-duur-aftrek altijd doet, met of zonder speling. Zo ja: net als
      // `addDurationChecked` de EERSTE band van de ankerdag als volledig-verbruikt-krediet gebruikt
      // (in plaats van het rauwe eind-instant), geeft deze spiegel het LAATSTE band-eind van
      // diezelfde dag D terug (`dayLastBandEnd`) — mét speling is D een LATERE dag dan `task`'s
      // eigen ankerdag; zónder speling ís D letterlijk de ankerdag, en dit reduceert tot de oude,
      // geteste nul-speling-uitkomst (`dayLastBandEnd(dayFirstBandStart(rawOwn)) === rawOwn`,
      // want `rawOwn` IS per definitie het laatste band-eind van zijn eigen dag). Corpusloos
      // mutatiebewezen met een taak-mét-speling-case (`cases-advanced-cpm.json`,
      // `z13-root-anchor-band-eind-speling`): `LF−EF` en `LS−ES` komen daar op hetzelfde aantal
      // werkdagen uit.
      //
      // GATING (B7-fixronde): `preds.length===0` (alleen wortel-taken hebben `ownAnchor`) +
      // `isExactBandEnd(rawOwn)` (de taak-eigen `scheduleStart` is zelf gedegenereerd) zijn
      // NOODZAKELIJK maar niet VOLDOENDE — een harde MSO/MFO-pin of een bindende SNET/MSO-constraint
      // kan `earlyStart` op een heel ANDERE waarde dan `ownAnchor`s rauwe anker gezet hebben
      // (`applyForwardConstraints` wint dan van `ownAnchor`). `actualEarlyStart === rawOwn` (uit
      // `earlyDates`, dus de ECHTE ES van DIT solve) bevestigt dat `ownAnchor` de ES werkelijk
      // leverde — zonder die toets zou deze spiegel op een gepinde/geconstrainde wortel-taak een
      // `lateStart` kunnen teruggeven die niets met haar echte `es` te maken heeft. Voor élke andere
      // taak (voorganger-gedreven, een niet-band-eind-anker, of een anker dat door een pin/
      // constraint overruled is) is dit `false` ⇒ byte-identiek aan vóór Z13.
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
      ? this.p6ProjectedSubtract(eng, end, remainingWithGaps)
      : eng.subtractWorkDays(end, remainingWithGaps);
  }

  /** Verschuift `date` met de nivelleer-vertraging van `task` (fase 2.5 §5.6; Z6 uur-/minuut-
   *  precisie + elapsed-bewustheid; Z6-fixronde). `sign=1` (forward, `forwardPass`s eigen early
   *  start van `task` zelf) of `sign=-1` (backward-DOORGIFTE, `backwardPass`s constraint-druk
   *  die `task` als OPVOLGER op haar voorganger legt — Z6-fixronde B2, zie de toelichting bij de
   *  aanroepplek in `backwardPass`). Geen delay ingesteld ⇒ `date` ongewijzigd (no-op, byte-
   *  identiek), ongeacht `sign`.
   *
   *  Z7-fixronde (EXTRA, reviewbevinding — crash los van splits): `eng.addWorkingMinutesSigned` is
   *  een UUR-modus-primitief — `CalendarEngine`'s `bandCache` bestaat uitsluitend wanneer de
   *  kalender `workTime` draagt (constructor, `this.mode==='hour'`-tak); op een DAG-kalender blijft
   *  `bandCache` `undefined` en crasht `bandsStartingOn`'s `this.bandCache!`-assertion. `mppReader.ts`
   *  zet `levelingDelayMinutes` op `raw.levelingDelayRaw !== 0`, ONGEACHT het kalender-type van het
   *  project — een `.mpp`-bestand met nivelleervertraging op een gewone DAG-kalender bereikte deze
   *  tak dus altijd al, en crashte. Terugval-conventie: identiek aan `durationDaysOf`s "sub-dag-duur
   *  bestaat niet op een dag-kalender"-precedent en `resolveEffectiveLagDays`s minuten→dagen-
   *  omrekening (`Math.sign(raw) * Math.round(Math.abs(raw))`, half rondt van nul af) — reken de
   *  minuten om naar HELE werkdagen en gebruik `addWorkingDaysSigned` (de dag-modus-tegenhanger). */
  private shiftByLevelingDelay(eng: CalendarEngine, task: Task, date: Date, sign: 1 | -1): Date {
    const taskElapsed = !isZeroDurationMilestone(task) && task.time.durationType === 'ELAPSEDTIME';
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

  /** WORKTIME-lag in MINUTEN in de voorganger-kalender (§5.2): procent ⇒ uit `durationMinutesOf(pred)`;
   *  `lagMinutes` ⇒ bron; anders `lagDays × pred-hoursPerDay × 60` (naakt getal = werkdagen). */
  private resolveLagMinutes(seq: Sequence, predTask: Task, predEng: CalendarEngine): number {
    if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
      const predMin = isZeroDurationMilestone(predTask) ? 0 : durationMinutesOf(predTask, predEng);
      return Math.round((predMin * seq.lagPercent) / 100);
    }
    if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) return seq.lagMinutes;
    const days = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
    return days * predEng.hoursPerDay * 60;
  }
  /** ELAPSEDTIME-lag in KLOK-minuten (24/7, §5.2): `lagMinutes` ⇒ bron; anders (procent/)dagen × 24 × 60. */
  private resolveElapsedMinutes(seq: Sequence, predTask: Task): number {
    if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) return seq.lagMinutes;
    return resolveEffectiveLagDays(seq, predTask) * 24 * 60;
  }
  /** Verschuif `base` met de relatie-lag in de VOORGANGER-engine (`LAG_CALENDAR='predecessor'`, §5.2).
   *  Uur-pred ⇒ minuten via `addWorkingMinutesSigned`; dag-pred ⇒ dagen via `addWorkingDaysSigned`
   *  (dag-lag blijft exact als nu). `sign` = +1 voorwaarts, −1 achterwaarts (spiegel). */
  private shiftLagPred(
    predEng: CalendarEngine, base: Date, seq: Sequence, predTask: Task, sign: 1 | -1,
  ): Date {
    if (predEng.isHourMode) {
      const minutes = this.resolveLagMinutes(seq, predTask, predEng);
      if (sign < 0 && minutes > 0) {
        const projected = this.p6ProjectedSubtract(predEng, base, minutes);
        // P6 WORKTIME-lag is een grensafstand. Vanaf een finishgrens moet een aftrek die exact op
        // een bandstart landt daarom de complementaire vorige finishgrens teruggeven: wo 17:00
        // min twee werkdagen = ma 17:00, niet di 08:00. Alleen de XER-resultaatprojectie krijgt
        // deze conventie; duur-aftrek en de generieke kalenderprimitieven blijven fysiek/invers.
        const projectedDayStart = this.dayFirstBandStart(predEng, projected);
        if (this.options.schedulingOptions?.p6Source === 'XER'
          && this.isExactBandEnd(predEng, base)
          && projectedDayStart?.getTime() === projected.getTime()) {
          return predEng.prevWorkInstantBefore(projected);
        }
        return projected;
      }
      return predEng.addWorkingMinutesSigned(base, sign * minutes);
    }
    // Dag-voorganger: WORKTIME-lag in dagen; `hoursPerDay` van de voorganger-kalender vertaalt een
    // lag die alleen als `lagMinutes` bestaat (fase 2.10, zie `resolveEffectiveLagDays`).
    return predEng.addWorkingDaysSigned(
      base, sign * resolveEffectiveLagDays(seq, predTask, predEng.hoursPerDay),
    );
  }

  /** Leid de opvolger-START af uit zijn geëiste FINISH (FF/SF, §5.2): ELAPSEDTIME ⇒ kale 24/7-
   *  klokaftrek (T8, vóór de hour/day-splitsing — geen kalenderband-toetsing, dus modus-onafhankelijk);
   *  uur (WORKTIME) ⇒ `subtractWorkMinutes`; dag (WORKTIME) ⇒ `addWorkingDaysSigned(−(dur−1))` — de
   *  bestaande inclusieve-dag-aftrek. Mijlpaal-afhandeling ONGEWIJZIGD per tak (Bevinding, T8-review:
   *  de dag-tak snapt een mijlpaal via `addWorkingDaysSigned(finish, 0)` = `nextWorkDay`, de uur-tak
   *  geeft de rauwe finish terug ongesnapt — niet symmetrisch, dus niet naar bóven de modus-split
   *  te hijsen zonder dat gedrag te veranderen).
   *
   *  Z7 (aangrijpingspunt 4, splits): gebruikt door de FF/SF-armen in `relationMath.ts` en door
   *  `forwardBoundOf`/`backwardBoundOf`/`hardPinStart`/`hardPinFinish` — een gesplitste taak als
   *  FF-voorganger zou zonder deze gaten-optelling een START teruggeven die haar EIGEN duur negeert.
   *  Zelfde as-wandeling/ELAPSEDTIME-uitsluiting als `addDurationChecked` (`splitTotalSpanMinutes`/
   *  `splitTotalSpanDays`, `duration.ts` — Z7-fixronde-H1). */
  private startFromFinish(eng: CalendarEngine, finish: Date, task: Task): Date {
    if (eng.isHourMode) {
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
    // H3 (Opus-review T15-iteratie-2, herbevestigd via msp-30-mutatiebewijs): `isZeroDurationMilestone`
    // i.p.v. de kale vlag — anders viel een dag-modus mijlpaal-met-duur-ELAPSEDTIME-taak hier stil
    // terug op de WORKTIME-tak (`addWorkingDaysSigned`, telt werkdagen, slaat weekend over) i.p.v.
    // de kloktijd-aftrek — exact het patroon dat msp-30 (FF+0 naar zo'n taak) blootlegde.
    if (!isZeroDurationMilestone(task) && task.time.durationType === 'ELAPSEDTIME') {
      return subtractElapsedMinutes(finish, elapsedMinutesOf(task, eng));
    }
    // `splitTotalSpanDays` geeft bij `dur===0` zelf al 0 terug (`splitTotalSpanMinutes`s
    // `workMinutes<=0`-kortsluiting, spiegelt `addWorkMinutes`) — geen aparte `dur>0`-wacht nodig.
    const totalDur = splitTotalSpanDays(task, eng);
    return eng.addWorkingDaysSigned(finish, -(totalDur > 0 ? totalDur - 1 : 0));
  }
  /** Leid de voorganger-FINISH af uit zijn late START (SS/SF backward, §5.2, spiegel van
   *  `startFromFinish`): ELAPSEDTIME ⇒ kale 24/7-klokoptelling (T8); uur (WORKTIME) ⇒ `addWorkMinutes`;
   *  dag (WORKTIME) ⇒ `addWorkingDaysSigned(dur−1)`. Zelfde mijlpaal-asymmetrie-voorbehoud als
   *  `startFromFinish` hierboven.
   *
   *  Z7 (aangrijpingspunt 4, splits) — zelfde as-wandeling, spiegel van `startFromFinish`
   *  hierboven (Z7-fixronde-H1). */
  private finishFromStart(eng: CalendarEngine, start: Date, task: Task): Date {
    if (eng.isHourMode) {
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
    // H3 (Opus-review T15-iteratie-2) — zelfde reden als `startFromFinish` hierboven.
    if (!isZeroDurationMilestone(task) && task.time.durationType === 'ELAPSEDTIME') {
      return addElapsedMinutes(start, elapsedMinutesOf(task, eng));
    }
    const totalDur = splitTotalSpanDays(task, eng);
    return eng.addWorkingDaysSigned(start, totalDur > 0 ? totalDur - 1 : 0);
  }
  /** Getekende float in eigen-kalender-WERKDAGEN (§5.5, Bevinding 1): uur ⇒ fractioneel
   *  `workMinutesBetween / (hoursPerDay × 60)`; dag ⇒ de bestaande integer `signedWorkDays`.
   *  ELAPSEDTIME (T8, msp-14-mutatiebewijs): `a`/`b` mogen op een niet-werkdag liggen (24/7-taak) —
   *  `workDaysBetween`/`signedWorkDays` gaan daar stuk (spook-tf, zie `signedElapsedSpan`'s
   *  moduleheader in `duration.ts`), dus een ELAPSEDTIME-taak krijgt de kale klok-span i.p.v.
   *  werkdag-telling. `task` optioneel: afwezig (of WORKTIME) ⇒ exact de oude twee takken. */
  private signedFloat(a: Date, b: Date, eng: CalendarEngine, task?: Task): number {
    if (task?.time.durationType === 'ELAPSEDTIME') return signedElapsedSpan(a, b, eng);
    if (eng.isHourMode) return this.projectedWorkMinutesBetween(eng, a, b) / (eng.hoursPerDay * 60);
    return this.signedWorkDays(a, b, eng);
  }

  solve(): CPMResult {
    // Idempotentie: reset ALLE per-solve accumulerende instance-state, zodat een tweede
    // solve() op dezelfde instance byte-identiek is aan een verse instance (geen duplicaten
    // uit een vorige run in de side-channels). De overige velden zijn constructor-vast
    // (graaf/kalenders/opties) of worden per solve onvoorwaardelijk herschreven; de
    // engine-cache is deterministisch per kalender-id en mag blijven staan.
    this.seqConstraint.clear();
    this.truncatedLeadIds = [];
    this.hardPinViolatedIds = [];
    this.hammockNoFinishDriverIds = [];
    this.cappedTaskIds = [];
    this.dataDate = null; // wordt hieronder herzet; zo blijft hij ook over guard-returns heen nooit stale
    this.projectStartRaw = null; // idem — herzet vóór elke solve, nooit stale over guard-returns heen

    // Check for circular dependencies before running CPM
    const cycle = this.detectCycle();
    if (cycle) {
      const cycleNames = cycle.map(id => this.tasks.get(id)?.name || id).join(' -> ');
      return emptyResult(`Circular dependency detected: ${cycleNames}`);
    }

    // Guard: een kalender zonder werkdagen zou anders (via de MAX_SCAN-fallback) stil
    // datums ver in de toekomst opleveren zonder enige waarschuwing. Degradeer met een fout.
    if (!this.projectEngine.hasWorkingDays()) {
      return emptyResult('Kalender heeft geen werkdagen ingesteld');
    }

    // Guard: een taak met een onparseerbare startdatum zou anders Invalid Dates
    // opleveren die het formatteren laten crashen (en vóór de lus-grenzen: hangen).
    // Degradeer netjes met een foutmelding i.p.v. te crashen.
    for (const task of this.tasks.values()) {
      if (isNaN(parseDate(task.time.scheduleStart).getTime())) {
        return emptyResult(`Ongeldige startdatum voor taak "${task.name}"`);
      }
    }

    // Werkdag-gesnapte statusdatum (fase 2.6). Ongeldig/afwezig ⇒ null (alle voortgangstakken no-op).
    // Uur-projectkalender ⇒ instant-snap via `nextWorkInstant` (§5.3); dag ⇒ `nextWorkDay` (byte-identiek).
    const dd = this.options.dataDate ? this.parseIn(this.projectEngine, this.options.dataDate) : null;
    this.dataDate = dd && !isNaN(dd.getTime()) ? this.snapOnOrAfter(this.projectEngine, dd) : null;

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
      signedFloat: (a, b, eng, task) => this.signedFloat(a, b, eng, task),
      projectedWorkMinutesBetween: (eng, a, b) => this.projectedWorkMinutesBetween(eng, a, b),
      constraintInstant: (c, eng) => this.constraintInstant(c, eng),
      snapOnOrAfter: (eng, d) => this.snapOnOrAfter(eng, d),
      snapOnOrBefore: (eng, d) => this.snapOnOrBefore(eng, d),
      modeOf: (eng) => this.modeOf(eng),
    });
    // Zachte WP7-waarschuwing: alleen bij een echt onwerkbaar venster het veld zetten, zodat een
    // normale solve byte-identiek blijft (veld afwezig ⇒ geen wijziging aan bestaande consumenten).
    // N4 (Opus-review, T9): `Set`-dedupe — sinds T9's voortgangstak TWEE aparte checked-aanroepen
    // per taak kan doen (de `elapsedAnchor`-hervattingspunt-berekening én de `ef`-restwerk-optelling
    // erna), kan dezelfde `taskId` twee keer gepusht worden als BEIDE tegen de onwerkbaar-venster-cap
    // lopen — vóór T9 kon een taak hoogstens via één pad hier terechtkomen, dus dit kon niet.
    if (this.cappedTaskIds.length > 0) result.cappedTaskIds = [...new Set(this.cappedTaskIds)];
    // T8-rooktest: idem voor relaties die een niet-bladtaak raakten en al bij de constructie
    // genegeerd zijn (zie de guard in de constructor) — byte-identiek default zolang dat niet gebeurt.
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
    // de geconfigureerde projectstartdatum via `rootFloor` — gebruikstest-bevinding 2026-08). Dient
    // als ondergrens zodat een negatieve lag (lead) een taak niet vóór het projectbegin trekt.
    // Vooraf bepaald, zodat de topologische volgorde de uitkomst niet beïnvloedt. Sinds T7 (§9/O2)
    // is dit de ENIGE plek waar `rootFloor` nog klemt — de eigen ES-tak van een wortel-taak
    // hieronder gebruikt `ownAnchor` (ongeklemd); deze precompute-lus en `hammockEarlyStart`
    // (die `projectStart` als basis gebruikt) blijven ongewijzigd.
    let projectStart: Date | null = null;
    for (const t of this.tasks.values()) {
      if ((this.predecessors.get(t.id) || []).length > 0) continue;
      const eng = this.calendarFor(t);
      // H3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` i.p.v. de kale vlag — een
      // mijlpaal-met-duur (T15) die zelf ELAPSEDTIME is, is voor de PLANNING geen mijlpaal en moet
      // dus wél als "root-elapsed" behandeld worden (spiegelt `snapSuccessorEarlyStart` hierboven).
      const s = this.rootFloor(eng, t.time.scheduleStart, !isZeroDurationMilestone(t) && t.time.durationType === 'ELAPSEDTIME');
      if (!projectStart || s < projectStart) projectStart = s;
    }

    for (const taskId of order) {
      const task = this.tasks.get(taskId)!;
      const cal = this.calendarFor(task);
      const preds = this.predecessors.get(taskId) || [];
      // Z8-fixronde (VERPLAATST naar hier, was verderop in deze functie): de IN-PROGRESS-tak
      // hieronder (`if (usedResumeOverride...) { ... results.set(...); continue; }`) heeft haar
      // EIGEN `ef`-berekening en `continue`t VÓÓR het punt waar dit vroeger stond — de
      // timephased-finish-override (zie verderop) moet dus ook DÁÁR al gelden, niet alleen in de
      // gewone AUTO-tak. `hardPinFinish` is een pure functie van `task`/`cal` (geen loop-state),
      // dus vervroegen is veilig — één berekening, twee toepassingsplekken, geen dubbel werk.
      const hardFinishPin = this.hardPinFinish(task, cal);

      // ── Hammock / Level of Effort (§4.4) ───────────────────────────────────
      // Een hammock loopt mee in topologische volgorde (drivers staan er per definitie vóór). ES =
      // de gewone forward-max over SS/FS-voorganger-bounds + projectstart-vloer; EF = de max over de
      // FF/SF-voorganger-bounds (ondergrens ES). De AFGELEIDE duur (span ES→EF) wordt naar
      // `scheduleDuration` (+ `durationMinutes` op een uur-kalender) geschreven; eigen duur-invoer
      // wordt genegeerd. `isHammock` afwezig ⇒ deze tak draait niet (byte-identiek).
      if (task.isHammock) {
        const es = this.hammockEarlyStart(task, preds, results, projectStart, cal);
        const { ef, hasFinishDriver } = this.hammockEarlyFinish(task, preds, results, es, cal);
        if (!hasFinishDriver) this.hammockNoFinishDriverIds.push(taskId);
        // T8 (T10-reviewtoevoeging): een ELAPSEDTIME-hammock drukt zijn afgeleide span uit in KLOK-
        // tijd, niet in WERKtijd — `cal.workMinutesBetween`/`workDaysBetween` tellen alleen tijd
        // binnen kalenderbanden, wat voor een 24/7-taak een te korte duur zou geven. De
        // uur-omrekening deelt daarbij door de VASTE klokdag (24 × 60), NOOIT door `cal.hoursPerDay`
        // — dat zou dezelfde dubbele-deling-valkuil zijn die T10 in de lezer fixte, hier toegepast
        // op de duur-herberekening i.p.v. op de leeskant.
        if (task.time.durationType === 'ELAPSEDTIME') {
          if (cal.isHourMode) {
            const mins = Math.round((ef.getTime() - es.getTime()) / MS_PER_MIN);
            task.time.durationMinutes = mins;
            task.time.scheduleDuration = mins / (24 * 60);
          } else {
            task.time.scheduleDuration = (ef.getTime() - es.getTime()) / MS_PER_DAY;
          }
        } else if (cal.isHourMode) {
          const mins = cal.workMinutesBetween(es, ef);
          task.time.durationMinutes = mins;
          task.time.scheduleDuration = mins / (cal.hoursPerDay * 60);
        } else {
          task.time.scheduleDuration = cal.workDaysBetween(es, ef);
        }
        results.set(taskId, { es, ef });
        continue;
      }

      // ── Handmatig gepland (Z9a, etappe "nul afwijkingen") ──────────────────────────────────
      // MS Project "Manually Scheduled": een `manuallyScheduled`-taak houdt haar EIGEN opgeslagen
      // `time.scheduleStart`/`scheduleFinish` RAUW aan — geen kalendersnap (`ownAnchor`/
      // `snapOnOrAfter` bewust NIET aangeroepen: dát is precies het punt, MSP snapt een manual-
      // anker nooit naar de werkband), geen relatiedruk (voorganger-`earlyStart`/`rawMax` wordt
      // hieronder voor deze taak nooit berekend — haar OPVOLGERS lezen gewoon `results` en
      // rekenen normaal door, `forwardConstraint` kent geen bijzonder manual-geval nodig) en geen
      // constraint-afdwinging. `mppReader.ts`'s `resolveScheduleField` (zie haar docblok) zorgt
      // dat `scheduleStart`/`scheduleFinish` voor een `.mpp`-import al het JUISTE veldpaar dragen
      // (1283/1284 i.p.v. 35/36) — deze tak hoeft dus geen tweede veldkeuze te maken, ze
      // respecteert gewoon wat er ligt (ook voor MSPDI/P6/CSV/IFC-bronnen, waar `scheduleStart`/
      // `scheduleFinish` per definitie al "het" antwoord zijn).
      //
      // BESLUIT (constraint vs. manual, plan-§Z9a): MANUAL WINT. `applyForwardConstraints`/
      // `hardPinStart`/`hardPinFinish` worden voor deze taak NOOIT aangeroepen, ook niet bij een
      // harde MSO/MFO-pin — MS Project plant een manual taak op haar getypte datum, een
      // gelijktijdige constraint is dan een dode letter (gepind: `msp-58-z9a-manual-wint-van-
      // constraint` in cases-msp-pariteit.json — `violatedConstraintsSet` blijft daar leeg).
      //
      // PRECEDENTIE t.o.v. Z12 (resume-override)/Z8 (progressCal/timephased-venster)/Z6
      // (leveling-delay-ankerregel): deze tak MOET vóór al die takken staan (topologisch de EERSTE
      // afvangst in de niet-hammock-tak) — een manual taak met voortgang/venster/delay behoudt
      // nog steeds haar eigen rauwe anker, niet de door die takken herberekende waarde.
      // GEMETEN, niet aangenomen (Z9a-probe, wegwerpscript, 2026-08-18): 10 van de 1659
      // corpusbrede manual-taken dragen ÓÓK voortgang (`percentComplete`/`actualStart`) en een
      // `resume`-veld — `mpp14timephasedsegmentsmanual.mpp`'s "Task Three"/"Task Four" (pct 50,
      // actualStart/manualStart 07:00, scheduledStart 08:00 — exact de −60min-translatie uit de
      // Z1-reviewobservatie) en de vier `assignment-assignments-*`-varianten se "Task 2"/"Task 3".
      // Voor "Task Three"/"Task Four" is de rauwe manual-start (07:00) MSP's EIGEN opgeslagen
      // antwoord (START, veld 1283, geverifieerd via de fidelity-meetlat) — niet de via
      // resume/restwerk herberekende waarde die de IN-PROGRESS-tak verderop zou geven. Geen enkele
      // gemeten manual-taak draagt `levelingDelayMinutes` (0/1659) — die interactie blijft dus
      // ONGETOETST tegen een echt samenvallend geval, maar kan de precedentie per constructie niet
      // schenden (deze tak `continue`t vóór de leveling-toepassing wordt bereikt).
      //
      // Spiegelt de VOLTOOID-tak (voortgangsblok verderop) qua vorm: `parseIn` (dag ⇒ `parseDate`,
      // uur ⇒ `parseInstant`, GEEN snap) + dezelfde ef<es-inversiecorrectie voor het randgeval
      // waarin een bestand een finish vóór de start opslaat.
      if (task.manuallyScheduled) {
        let es = this.parseIn(cal, task.time.scheduleStart);
        const ef = this.parseIn(cal, task.time.scheduleFinish);
        if (ef < es) es = ef;
        results.set(taskId, { es, ef });
        continue;
      }

      let earlyStart: Date;
      // Z10 (dossier START_FINISH-semantiek, `mpp14relations.mpp`/"Task 5"): een SF-vereiste-finish
      // ("niet eerder dan pred.START + lag") is een APARTE ondergrens op de EARLY FINISH, naast de
      // gewone `earlyStart`-druk die `forwardConstraint` hierboven al levert — zie
      // `forwardFinishFloor`'s moduleheader in `relationMath.ts` voor de volledige diagnose (het
      // symptoom: `earlyFinish` hieronder wordt UNIFORM als `ES + duur` VOORWAARTS herberekend, wat
      // voor SF de vereiste finish verliest zodra de terugtelling exact een niet-werkperiode
      // overspant). `null` ⇒ geen SF-voorganger ⇒ byte-identiek (de `if` bij de toepassing hieronder
      // is dan een no-op). Blijft `null` bij `preds.length === 0` (een wortel-taak heeft geen
      // voorganger-relatie om een finish te eisen).
      let sfFinishFloor: Date | null = null;
      // Z13: gezet in de `noPreds`-tak hieronder zodra de taak-eigen `scheduleStart` een gedegenereerd
      // band-eind-anker is (zie `rootAnchorIsBandEnd`/`timephasedAnchorIsDegenerateResnap` daar) —
      // `timephasedFinish()` gebruikt deze vlag om `task.timephasedFinishFloor` in dat geval over te
      // slaan, spiegelt de START-kant.
      let timephasedFinishFloorIsDegenerateResnap = false;

      // Z6-fixronde (ANKERREGEL): `preds.length === 0` bepaalt hieronder al welke tak `earlyStart`
      // levert (eigen anker vs. voorganger-gedreven herrekening) — hergebruikt verderop om de
      // nivelleer-vertraging te clausuleren (zie de toelichting daar). Eén boolean, geen tweede
      // `preds.length`-check die uit de pas zou kunnen lopen met de branch-keuze hieronder.
      const noPreds = preds.length === 0;
      if (noPreds) {
        // T8-review-BLOCKER (Opus-hercheck 72486257, uitgebreid): dezelfde bypass als
        // `snapSuccessorEarlyStart` hieronder — hier voor de WORTEL-taak-tegenhanger. Zonder wacht
        // duwde `ownAnchor`s `snapOnOrAfter` een elapsed-taak met een op zichzelf staand weekend-
        // anker (bv. ingelezen scheduleStart = zaterdag, geen voorganger) alsnog naar maandag —
        // dezelfde H1-schending, maar op de EIGEN-anker-plek i.p.v. de relatie-plek (gevonden bij het
        // doorzoeken van alle hersnap-plekken die de reviewer vroeg). Het constraint-PAD
        // (`applyForwardConstraints`/`forwardBoundOf`) blijft bewust ONGEMOEID — dat is de al-
        // gedocumenteerde L1-afbakening (zie `hardPinStart`): een SNET/MSO-datum snapt nog steeds
        // naar een werk-instant, ook op een elapsed taak.
        // H3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` i.p.v. de kale vlag — zelfde
        // reden als de precompute-lus hierboven (regel ~797) en `snapSuccessorEarlyStart`.
        const rootElapsed = !isZeroDurationMilestone(task) && task.time.durationType === 'ELAPSEDTIME';
        // Z8 (etappe "nul afwijkingen", gemeten — zie `mppReader.ts`'s `deriveTimephasedWindowsFor
        // Tasks`-moduleheader voor het corpusbewijs): een wortel-taak met een timephased-toewijzing
        // wier eigen `AssignmentField.START` buiten de TAAK-kalenderband ligt maar binnen haar EIGEN
        // resourcekalender (corpusvoorbeeld: een "Night Shift"-resource om 23:00) draagt dat instant
        // al RAUW, precies zoals `rootElapsed` hieronder — MSP snapt dat niet naar de eerstvolgende
        // taak-kalender-werk-instant, onze `ownAnchor`-snap deed dat vóór deze fixronde wél. Afwezig
        // ⇒ byte-identiek (de `ownAnchor`-tak hieronder draait ongewijzigd).
        //
        // HERWERKRONDE-SLOTRONDE (reviewer-eis: "meet wat het is" — dezelfde scrutiny als de
        // afgekeurde vlakke-finish-terugval): dit is NIET dezelfde categorie als die terugval. Bij
        // een WORTEL-taak (geen voorganger) is de start per definitie ALTIJD een gelezen anker — nooit
        // een CPM-berekende waarde — dat is precies `ownAnchor` (`task.time.scheduleStart`, al sinds
        // etappe 1 geaccepteerd, ONGEWIJZIGD hier). `timephasedAnchor` (`task.timephasedStartAnchor`,
        // `AssignmentField.START`) is dus geen ALTERNATIEF soort mechanisme t.o.v. ownAnchor — het is
        // een PRECIEZER gelezen anker uit een ANDERE bronlocatie (toewijzingsniveau i.p.v. taakniveau),
        // beide even "gelezen". De rechtvaardiging is het INVOERFEIT: MSP bewaart op toewijzings-
        // niveau een ONGESNAPT instant (`AssignmentField.START` ligt in het corpusvoorbeeld buiten
        // de taak-kalenderband en binnen de resourcekalender) — het toewijzingsveld draagt dus
        // broninformatie die het taakveld mist, en die lezen we, net als `ownAnchor`, als anker.
        // De mutatieproef (tijdelijk uitgeschakeld, altijd ownAnchor) dient uitsluitend als
        // niet-circulariteitscontrole: een teruggelezen antwoord zou bij verwijdering GEEN verschil
        // maken t.o.v. de toch-al-juiste motoruitkomst, terwijl deze tak dan meetbaar ander gedrag
        // toont (o.a. mpp14timephased.mpp en mpp14timephasedsegmentsmanual(offsets).mpp op hun
        // wortel-taken). Blijft dus staan.
        // Z13 (dossier "rauw anker zonder constraint", `timephased-prorated-cost-resource.mpp`,
        // taak "No Progress - Actual Cost"): `timephasedAnchor` hierboven is normaal een PRECIEZER
        // gelezen anker dan `ownAnchor` (zie de toelichting hierboven) — maar in dit ene corpusgeval
        // is de taak-eigen `scheduleStart` een gedegenereerd BAND-EIND-anker (`ownAnchor`s eigen
        // vrijstelling hierboven), en blijkt `timephasedAnchor` daar NIET onafhankelijk van te zijn:
        // hij komt uit vóór deze fix op precies dezelfde (verkeerde) waarde uit als het bandgrens-
        // gesnapte taak-anker. MSP's EIGEN `SCHEDULED_START` (de fidelity-grondwaarheid) houdt hier
        // het rauwe band-eind aan — `timephasedAnchor` zou die vrijstelling dus ongedaan maken.
        // FIXRONDE (Opus-afkeuring 6f4c903f, punt B1): de vorige versie discrimineerde op een
        // BYTE-GELIJKHEID met `snapOnOrAfter(rawOwnAnchor)` — dat is een eigenschap van ONZE eigen
        // (vóór-Z13) berekening, niet van de invoer, en dus geen geldige generieke regel. Gemeten
        // (reviewer): de invoer-conditie alléén (`!!veld && isExactBandEnd`, zonder de byte-
        // gelijkheidsclausule) geeft dezelfde 553/553 en dezelfde fidelity-delta — de bytegelijkheid
        // voegde dus niets toe buiten dit ene corpusgeval en werd geschrapt. De regel is nu: ELKE
        // wortel-taak met een gedegenereerd band-eind-anker negeert laag 3 volledig (`timephasedAnchor`/
        // `timephasedFinishFloor`), ongeacht wat laag 3 concreet draagt — voor élke andere taak
        // (geen band-eind-anker, zoals de bestaande "Night Shift"-populatie) is dit `false` en blijft
        // `timephasedAnchor` byte-identiek de voorkeur houden.
        const rawOwnAnchor = this.parseIn(cal, task.time.scheduleStart);
        const rootAnchorIsBandEnd = this.isExactBandEnd(cal, rawOwnAnchor);
        const timephasedAnchorIsDegenerateResnap = !!task.timephasedStartAnchor && rootAnchorIsBandEnd;
        const timephasedAnchor = timephasedAnchorIsDegenerateResnap ? undefined : task.timephasedStartAnchor;
        // Z13, FINISH-tegenhanger van de vlag hierboven: `task.timephasedFinishFloor` (laag 3) komt
        // van DEZELFDE toewijzing als `timephasedStartAnchor`, dus geldt dezelfde invoer-conditie.
        // `timephasedFinish()` leest deze vlag verderop om `task.timephasedFinishFloor` in dat geval
        // over te slaan, zodat `addDurationChecked`s eigen band-eind-correctie (zie die functie) het
        // laatste woord houdt — anders zou laag 3 die correctie hier alsnog ongedaan maken.
        timephasedFinishFloorIsDegenerateResnap = !!task.timephasedFinishFloor && rootAnchorIsBandEnd;
        // Geen voorganger: de eigen geplande start, ONGEKLEMD tegen de projectstart (T7, §9/O2 —
        // "een ingelezen anker wordt nooit door de vloer overruled"; zie `ownAnchor`). Een harde
        // MSO/MFO-pin (hieronder in `applyForwardConstraints`) wint hier nog steeds
        // onvoorwaardelijk: die controleert `hardPinStart` EERST en retourneert dan meteen, vóór
        // deze waarde ooit gezien wordt.
        earlyStart = rootElapsed
          ? this.parseIn(cal, task.time.scheduleStart)
          : timephasedAnchor
            ? parseInstant(timephasedAnchor)
            : this.ownAnchor(cal, task.time.scheduleStart, task);
        // Geen voorganger-druk ⇒ rawMax null ⇒ een (root-)pin kan de logica niet breken (§4.2).
        const beforeConstraint = earlyStart;
        earlyStart = this.applyForwardConstraints(task, earlyStart, null, cal);
        // Z13: heeft de constraint-toepassing hierboven `earlyStart` daadwerkelijk VERPLAATST (een
        // bindende constraint-grens)? Zo niet — geen constraint, of wel een constraint maar niet
        // bindend — dan is `earlyStart` nog altijd exact `ownAnchor`s eigen resultaat, en heeft de
        // her-snap hieronder NIETS te doen: `ownAnchor` heeft de band-eind-vrijstelling (zie haar
        // docblok) al zelf correct toegepast. Vóór Z13 was die her-snap voor een ongeconstrainde
        // taak sowieso al een no-op (ownAnchor snapte toen onvoorwaardelijk) — deze wacht maakt dat
        // nu EXPLICIET i.p.v. impliciet-toevallig, want zonder wacht zou de her-snap de nieuwe
        // band-eind-vrijstelling meteen weer ongedaan maken (`snapOnOrAfter` behandelt een band-eind
        // instant nog steeds als "niet-werk", precies het gedrag dat `ownAnchor` net vermeed).
        const constraintMoved = earlyStart.getTime() !== beforeConstraint.getTime();
        // Fase 2.8b (golf 3): her-snap ná de constraint — spiegelt de voorganger-tak (regel 466).
        // `applyForwardConstraint` levert een DAG-conceptuele grens (`nextWorkDay`/
        // `addWorkingDaysSigned`, §5.2), in uur-modus een middernacht-instant die NIET op een
        // werk-instant valt; zonder her-snap rapporteert een constrained root-taak zijn ES op 00:00
        // i.p.v. de bandstart (de `earlyFinish` rekent al vanaf de bandstart ⇒ interne inconsistentie).
        // Idempotent in dag-modus (`nextWorkDay` van een werkdag = diezelfde werkdag) en bij een
        // niet-bindende constraint (ES al gesnapt op regel 429) ⇒ byte-identiek voor de 290.
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
        for (const seq of preds) {
          const predResult = results.get(seq.predecessorId);
          const predTask = this.tasks.get(seq.predecessorId);
          if (!predResult || !predTask) continue;
          const constraintDate = forwardConstraint(
            this.relDeps, predResult, predTask, seq, task, this.calendarFor(predTask), cal,
            this.p6ZeroDurationUsesFinishBoundary(task, cal),
          );
          this.seqConstraint.set(seq.id, constraintDate);
          if (!rawMax || constraintDate > rawMax) rawMax = constraintDate;
          if (constraintDate > earlyStart) {
            earlyStart = constraintDate;
          }
          // Z10: SF-vereiste-finish als aparte ondergrens (zie de toelichting bij `sfFinishFloor`s
          // declaratie hierboven) — `null` voor alle andere relatietypes, dus deze regel is een
          // no-op zonder SF-voorganger.
          const finishFloor = forwardFinishFloor(
            this.relDeps, predResult, predTask, seq, task, this.calendarFor(predTask), cal,
            this.p6ZeroDurationUsesFinishBoundary(task, cal),
          );
          if (finishFloor && (!sfFinishFloor || finishFloor > sfFinishFloor)) sfFinishFloor = finishFloor;
        }
        // P6-bronsemantiek: target_start is alleen een aanvullende geplande vloer wanneer zowel
        // het geplande begin als einde meer dan één kalenderdag ná het netwerkvenster liggen. Dat
        // dubbele criterium voorkomt dat een lang targetvenster of een gewone volgende-bandstart
        // als impliciete constraint wordt behandeld. Relatiedruk die later ligt blijft altijd winnen.
        if (this.p6XerOption(this.options.schedulingOptions?.p6UseTaskPlannedStartFloor)) {
          const plannedFloor = this.ownAnchor(cal, task.time.scheduleStart, task);
          const networkFinish = this.finishFromStart(cal, earlyStart, task);
          const plannedFinish = this.parseIn(cal, task.time.scheduleFinish);
          const p6InvertedFinishBoundary = isZeroDurationMilestone(task)
            && task.milestoneKind === 'FINISH' && plannedFinish < plannedFloor;
          const plannedWindowIsLater = p6InvertedFinishBoundary
            ? plannedFloor > earlyStart
            : plannedFloor.getTime() - earlyStart.getTime() > MS_PER_DAY
              && plannedFinish.getTime() - networkFinish.getTime() > MS_PER_DAY;
          if (plannedWindowIsLater) earlyStart = plannedFloor;
        }
        // Vloer-afkap: wilde óók de strengste relatie de taak nog vóór het projectbegin trekken,
        // markeer dan de bindende lead(s) als afgekapt — de gebruiker moet kunnen zien dat een
        // lead niet volledig benut wordt. Gedomineerde leads zijn gewoon non-driving, geen afkap.
        if (rawMax && projectStart && rawMax < projectStart) {
          for (const seq of preds) {
            const c = this.seqConstraint.get(seq.id);
            const predTask = this.tasks.get(seq.predecessorId);
            if (!c || !predTask) continue;
            // Zelfde lag-resolutie als de relatie-wiskunde zelf (incl. `lagMinutes`-only, fase 2.10),
            // anders wordt een lead die alleen in minuten bestaat niet als afgekapt gemarkeerd.
            const predLagDays = resolveEffectiveLagDays(
              seq, predTask, this.calendarFor(predTask).hoursPerDay,
            );
            if (formatDate(c) === formatDate(rawMax) && predLagDays < 0) {
              this.truncatedLeadIds.push(seq.id);
            }
          }
        }
        // `rawMax` (voorganger-druk) voedt de harde-pin-logicaschending-detectie (§4.2).
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

      // Nivelleer-vertraging (fase 2.5, §5.6; Z6 — uur-/minuutprecisie + elapsed-bewustheid;
      // Z6-fixronde — de ANKERREGEL). TWEE APARTE BRONNEN, TWEE APARTE REGELS — zie de
      // "aanwezig ⇒ bron van waarheid"-precedentie in `shiftByLevelingDelay`s docblok:
      //
      // (1) `task.levelingDelay` (hele WERKdagen) — UITSLUITEND door `ResourceLeveler` gezet (nooit
      //     door `mppReader.ts`, zie de moduleheader-toelichting daar). Blijft ONGECLAUSULEERD
      //     toegepast, exact zoals vóór Z6 en vóór de ankerregel: `task.time.scheduleStart` reflecteert
      //     hier NOOIT de nivellering (`ResourceLeveler` herschrijft dat veld niet, alleen
      //     `levelingDelay` zelf, vóór de volgende `runCPM`) — of de taak nu een wortel-taak is of
      //     voorganger-gedreven, de opgeslagen anker weet in BEIDE gevallen niets van de delay, dus
      //     de ankerregel hieronder is hier niet van toepassing. Mutatiebewijs (deze fixronde): de
      //     ankerregel per ongeluk óók op dit pad toepassen brak `cases-resource-leveling.json`
      //     (11/25 i.p.v. 25/25 — genivelleerde WORTEL-taken zoals `lvl-basic-conflict`s "B" bleven
      //     ongenivelleerd) en `kal-leveler-apply`/`kal-leveler-preview-puur`; teruggedraaid naar
      //     ongeclausuleerd ⇒ weer groen.
      // (2) `task.levelingDelayMinutes`/`.levelingDelayElapsed` (uur-/minuutprecisie) — UITSLUITEND
      //     door `mppReader.ts` gezet uit `.mpp`'s eigen LEVELING_DELAY-veld. HIER geldt de
      //     ANKERREGEL wél: toegepast UITSLUITEND wanneer `earlyStart` hierboven VOORGANGER-GEDREVEN
      //     herrekend is (`!noPreds`) — NOOIT wanneer ze uit het eigen opgeslagen anker komt
      //     (`noPreds`, de `preds.length === 0`/`ownAnchor`-tak). Reden: voor een `.mpp`-geïmporteerde
      //     wortel-taak IS `task.time.scheduleStart` MSP's EIGEN, AL-berekende eindantwoord
      //     (inclusief eventueel toegepaste nivellering) — letterlijk wat MSP zelf naar
      //     SCHEDULED_START schreef, geen tussenstap. Onze vertraging DAAR ook nog eens toepassen zou
      //     'm dubbel tellen (de eerste Z6-oplevering deed dit ongeclausuleerd en regresseerde
      //     `mpp14barstyle.mpp` van 0 naar 6 afwijkingen — een PRELEVELED-poort maskeerde dat
      //     eerst, zie de revert-commit, vóórdat deze ankerregel het onderliggende motorprobleem
      //     repareerde). Voor een voorganger-gedreven taak berekent `forwardPass` de early start VERS
      //     uit de relatiewiskunde, zonder ooit de opgeslagen `scheduleStart` te raadplegen — die
      //     verse berekening kent de vertraging nog niet, dus die ÉÉN keer toepassen is hier wél
      //     correct (spiegelt MSP's eigen leveler: precedence-feasible-start + delay).
      //
      // Corpusmeting (scratchpad, 19 `.mpp`-taken met non-zero `levelingDelayMinutes` over
      // corpus+crawl): 14/19 hebben een voorganger, 5/19 niet — en die 5 zijn EXACT
      // `mpp14barstyle.mpp`'s taken (LEVELING_DELAY nooit door MSP geconsumeerd in SCHEDULED_START).
      // De 14 voorganger-gedreven taken (OzBuild Workshop 17.mpp/…17 Leveling.mpp + het gemengde
      // corpusbestand a69fec157074d056) zijn stuk voor stuk GENUINE, door MSP toegepaste nivellering.
      //
      // CONSTRAINT-GEVAL (expliciet gemeten, niet aangenomen): van de 19 delay-taken dragen er 11
      // óók een SNET/MSO-achtige constraint — ALLE 11 hebben een voorganger (0 wortel-taken met
      // zowel een constraint als een delay in het gemeten corpus+crawl). Het wortel-plus-constraint-
      // geval is dus ONGEMETEN voor `levelingDelayMinutes`; deze regel behandelt het net als het kale
      // wortel-geval (nog steeds de `noPreds`-tak, ongeacht of een constraint dat anker verder
      // beïnvloedt) — gepind met een synthetische case
      // (`msp-53-z6-anker-regel-wortel-met-constraint`) i.p.v. stilzwijgend aangenomen.
      //
      // Backward-spiegel — ONGEWIJZIGD besluit: GEEN aftrek van de vertraging in `subDuration` zelf
      // (zie die functie se docblok). Voor de DOORGIFTE naar de voorganger in `backwardPass` geldt
      // een ANDER, wél noodzakelijk mechanisme (BEIDE bronnen, `shiftByLevelingDelay` maakt zelf geen
      // onderscheid) — zie de toelichting bij de aanroepplek in `backwardPass` (Z6-fixronde B2).
      //
      // `levelingDelay`/`levelingDelayMinutes` beide afwezig/0 ⇒ exacte no-op in beide takken —
      // byte-identiek aan vóór Z6.
      if (task.levelingDelay) {
        earlyStart = this.shiftByLevelingDelay(cal, task, earlyStart, 1);
      } else if (!noPreds && task.levelingDelayMinutes) {
        earlyStart = this.shiftByLevelingDelay(cal, task, earlyStart, 1);
        // M1 (Z6-fixronde, mixed-corpus-probefix): een ELAPSED-FORMAAT vertraging
        // (`levelingDelayElapsed`) op een NIET-elapsed taak is een kale kloktijd-optelling die het
        // anker buiten de werkband kan duwen — de taak zelf blijft WORKTIME en moet dus alsnog op
        // een geldig werk-instant landen (`snapOnOrAfter`, dezelfde functie die de gewone
        // constraint-snap elders gebruikt). Een ELAPSEDTIME-taak zelf blijft bewust ONGESNAPT — die
        // mag legitiem buiten de band staan (T8/Z6-invariant,
        // `msp-51-z6-invariant-elapsed-opvolger-hele-dagen-delay`). Mutatiebewijs: het gemengde
        // corpusbestand (hash a69fec157074d056) had zonder deze snap 2 sameday-afwijkingen (onze
        // ES 04:49/03:39 tegen MSP's 08:00 op twee WORKTIME-taken met een elapsed-vertraging); met
        // de snap exact. `msp-48-z6-elapsed-delay` pint dit corpusloos.
        const taskElapsedForSnap = !isZeroDurationMilestone(task) && task.time.durationType === 'ELAPSEDTIME';
        if (!taskElapsedForSnap && task.levelingDelayElapsed) {
          earlyStart = this.snapOnOrAfter(cal, earlyStart);
        }
      }

      // Voortgang (fase 2.6): actual-pinning + data-date-vloer. dataDate === null ⇒ elke tak is
      // een no-op (backwards-compat). `earlyStart` is hier al de retained-logic voorganger-druk.
      const dataDate = this.dataDate;
      // Z8-HERWERKRONDE-FIXRONDE 2 ("laag 1/2-gat"): de VOLTOOID-/IN-PROGRESS-tak hieronder rekende
      // altijd in `cal` (de TAAK-eigen kalender) — voor een taak wier ENIGE toewijzing een écht
      // afwijkende resourcekalender draagt (`mppReader.ts`'s laag-4-activeringscriterium, HIER
      // ONGEWIJZIGD gebruikt, GEEN aparte tweede gate) geeft dat een verkeerd antwoord, óók als de
      // taak allang gestart/voltooid is — exact de 10 resterende afwijkingen ná de eerste
      // herwerkronde-commit (fee9ecb4→087721bf). `task.timephasedDurationWalks` (mppReader.ts zet
      // 'm sinds deze fixronde OOK op completion>0-taken, uitsluitend als kalenderREFERENTIE — GEEN
      // gelezen datum, dus GEEN cirkelmeting-risico) draagt bij precies 1 item de te gebruiken
      // resourcekalender-id. `progressCal` vervangt `cal` voor de VOLLEDIGE VOLTOOID-/IN-PROGRESS-
      // tak (niet alleen de eind-`ef`): `remStart`/`actualES`/Z7-splits/Z12-resume rekenen anders
      // half in de taak- en half in de resourcekalender, een interne inconsistentie die de
      // "Task A"-multi-toewijzing-bugronde (mppReader.ts) al aantoonde bij een vergelijkbare
      // gedeeltelijke wandeling. Afwezig/niet-activeerbaar (>1 toewijzing, dag-modus-resourcekalender,
      // geen echte afwijking) ⇒ `progressCal = cal`, BYTE-IDENTIEK — dat is de overgrote meerderheid
      // van alle taken, inclusief de volledige Z12-/Z6-/Z7-populaties (regressiewacht hieronder).
      let progressCal = cal;
      if (task.timephasedDurationWalks && task.timephasedDurationWalks.length === 1) {
        const candidate = this.engineForCal(
          resolveCalendar(task.timephasedDurationWalks[0].resourceCalendarId, this.registry, this.projectCal),
        );
        if (candidate.isHourMode) progressCal = candidate;
      }
      {
        const t = task.time;
        if (t.actualFinish && t.completion >= 1) {
          // (1) VOLTOOID: volledig gepind op actuals — geen forward-drift voorbij actualFinish.
          // B4 (Opus-her-check T15-fixronde): `snapActualForward` i.p.v. een kale parse — snapt
          // BINNEN dezelfde dag (bv. 07:00 → 08:00), maar verplaatst nooit naar een andere dag (bv.
          // zaterdag → maandag). Zie die functie se docblock voor de twee tegenstrijdige
          // corpusmetingen die dit reconcilieert.
          const preserveP6ActualInstants = task.p6ProjectId !== undefined
            && this.p6XerOption(this.options.schedulingOptions?.p6PreserveActualInstants);
          const actualStart = this.parseIn(progressCal, t.actualStart ?? t.actualFinish);
          let es = preserveP6ActualInstants
            ? actualStart
            : this.snapActualForward(progressCal, actualStart);
          // Milestone: start én finish landen op dezelfde werk(dag)-grens (snap op-of-ná, niet -vóór).
          // H3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` i.p.v. de kale vlag — een
          // VOLTOOIDE mijlpaal-met-duur (T15) is voor de PLANNING een gewone taak en hoort dus de
          // NORMALE `snapOnOrBefore`-tak te volgen (haar `actualFinish` kan legitiem dagen ná haar
          // `actualStart` liggen); met de kale vlag zou `snapOnOrAfter` haar EF stelselmatig vóór of
          // op haar ES kunnen duwen — "ze eindigt ná haar eigen actualFinish" (reviewer-meting).
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
          // Vroeger stond hier `ef = es` — dat tilde een op 2 augustus afgemelde taak naar de eerste
          // werkdag ná de bouwvak (24 augustus, een week ná de statusdatum) en vertraagde daarmee óók
          // zijn opvolger een dag. Met `es = ef` landt het paar op de laatste werkdag op-of-vóór de
          // `actualFinish` en start de opvolger op de eerste werkdag daarna — precies waar het feit
          // hem zet. Buiten dit randgeval (ef ≥ es) verandert er niets.
          if (ef < es) es = ef;
          // Z8-HERWERKRONDE (LAAG 1 van de gelaagde beslistabel, zie `mppReader.ts`'s
          // `deriveTimephasedWindowsForTasks`-moduleheader): een VOLTOOIDE taak plant onvoorwaardelijk
          // op `t.actualFinish` — GEEN Z8-venster-raadpleging hier. De EERSTE Z8-versie deed dat nog
          // wél (via `timephasedFinish()`, hier verwijderd) — de Opus-review wees aan dat dat een
          // vrijwel volledige cirkelmeting was; `mppReader.ts` zet sinds de herwerkronde
          // `timephasedFinishFloor`/`timephasedDurationWalks` NOOIT meer op een taak met
          // `completion >= 1`, dus een raadpleging hier zou toch altijd `null` opleveren — bewust
          // weggelaten in plaats van dode code te laten staan.
          // XER/P6-bronsemantiek: een voltooide opvolger is historisch en levert daarom ook geen
          // relatievrije-speling/driving-grens voor een nog open voorganger. De algemene solver-
          // default blijft ongewijzigd; alleen de expliciete bronvlag verwijdert deze grenzen.
          if (this.options.schedulingOptions?.preserveActualDatesInBackwardPass === true) {
            for (const seq of preds) this.seqConstraint.delete(seq.id);
          }
          results.set(taskId, { es, ef });
          continue;
        }
        if ((t.actualStart || t.completion > 0) && t.completion < 1) {
          // (2) IN PROGRESS — actualStart (store-route) óf impliciete actualStart = de gewone
          //     forward-pass-earlyStart (2b, vangnet voor rauwe legacy/externe data).
          // M1 (Opus-review T15-iteratie-2): niet langer achter `dataDate &&` — een taak die
          // aantoonbaar gestart is (`actualStart`/`completion>0`) pint haar ES op die start, MET of
          // ZONDER statusdatum (zelfde MSP-redenering als de VOLTOOID-fix, H1/c2). `remStart`
          // hieronder valt zonder statusdatum terug op `actualES` zelf (de enige zinvolle "as of"-
          // ondergrens die overblijft — RETAINED_LOGIC's `max(dataDate, voorganger-druk)`-formule
          // blijft verder ONGEWIJZIGD, ze krijgt alleen een andere startwaarde vóór de max).
          // B4 (Opus-her-check T15-fixronde): `snapActualForward` i.p.v. een kale parse — dezelfde
          // dag-behoudende-snap-redenering als de VOLTOOID-branch hierboven (zie
          // `snapActualForward`'s docblock voor de twee tegenstrijdige corpusmetingen die dit
          // reconcilieert: dag-kruisend blijft ongesnapt, binnen-dag snapt wél). Vóór deze fix
          // snapte een IN-PROGRESS-taak se weekend-actualStart altijd naar de eerstvolgende werkdag
          // terwijl een VOLTOOIDE taak se weekend-actualStart dat niet deed — dezelfde soort taak
          // kreeg zo een ANDER antwoord al naargelang completion toevallig <1 of ===1 stond.
          const actualES = t.actualStart
            ? task.p6ProjectId !== undefined
                && this.p6XerOption(this.options.schedulingOptions?.p6PreserveActualInstants)
              ? this.parseIn(progressCal, t.actualStart)
              : this.snapActualForward(progressCal, this.parseIn(progressCal, t.actualStart))
            : earlyStart;
          // Restwerk: uur ⇒ `remainingMinutes ?? durationMinutes × (1−completion)`; dag ⇒ werkdagen (§5.3).
          const totalSpan = progressCal.isHourMode ? durationMinutesOf(task, progressCal) : t.scheduleDuration;
          const remaining = progressCal.isHourMode
            ? Math.max(0, t.remainingMinutes ?? Math.round(totalSpan * (1 - t.completion)))
            : Math.max(0, t.remainingTime ?? Math.round(totalSpan * (1 - t.completion)));
          // M2 (Opus-review, 2026-08-17): ELAPSEDTIME-bewustheid — T8 maakte de rest van de solver
          // elapsed-bewust (`addDurationChecked` hierboven: `addElapsedMinutes(start,
          // elapsedMinutesOf(task, eng))`, GEEN kalenderband-toetsing); deze voortgangstak rekende
          // tot nu toe ONVOORWAARDELIJK met `progressCal.addWorkMinutes`/`progressCal.addWorkDaysChecked` (WERKtijd),
          // dus een ELAPSEDTIME-taak met `completion > 0` klapte stil om naar WORKTIME-semantiek —
          // precies het gat dat T8 elders dichtte. `totalSpan`/`remaining` hierboven staan al in de
          // "eigen eenheid" van de taak (minuten in uur-modus, dagen in dag-modus — BEIDE al
          // elapsed-klok-consistent gevuld voor een ELAPSEDTIME-taak, zie `mppReader.ts`'s
          // `raw.isElapsedDuration`-tak voor zowel `duration`/`durationMinutes` als
          // `remainingTime`/`remainingMinutes`); alleen de dag→minuut-omrekening ontbreekt nog voor
          // het dag-modus-pad — exact dezelfde stap als `elapsedMinutesOf`'s eigen dag-tak
          // (`scheduleDuration × 24 × 60`). `isElapsedTask` sluit een ECHTE (0-duur) mijlpaal uit
          // (spiegelt de `!isZeroDurationMilestone(...) && durationType === 'ELAPSEDTIME'`-guard die
          // overal elders in dit bestand staat) — H3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone`
          // i.p.v. de kale vlag, anders klapt het restwerk van een VOORTGANG-dragende mijlpaal-met-duur-
          // ELAPSEDTIME-taak stil om naar WORKTIME-semantiek (zelfde bugklasse als msp-30).
          const isElapsedTask = !isZeroDurationMilestone(task) && t.durationType === 'ELAPSEDTIME';
          const remainingElapsedMinutes = isElapsedTask ? (progressCal.isHourMode ? remaining : remaining * 24 * 60) : 0;
          let remStart = dataDate ?? actualES;                      // ondergrens: statusdatum, anders de eigen actualStart (M1)
          // Z12-herwerk (dossier out-of-sequence-actuals): `true` zodra `remStart` hieronder uit het
          // RESUME-veld komt i.p.v. de gewone voorganger-druk/elapsed-vloer — stuurt de ef<es-
          // inversiecorrectie ná de gedeelde ef-berekening (zie die toelichting verderop).
          let usedResumeOverride = false;
          if (this.options.progressMode !== 'PROGRESS_OVERRIDE') {
            // Z12-herwerk (dossier out-of-sequence-actuals, ná Opus-weerlegging van het eerdere
            // anker-ontwerp) → Z8-HERWERKRONDE-FIXRONDE 2 ("laag 1/2-gat") → Z19 (residu-iteratie
            // "nul afwijkingen", dossier "resumeOverride-gate-verbreding"): MSP slaat het
            // hervattingsinstant voor een IN-PROGRESS-taak LETTERLIJK op in het bestand — MPP-veld-id
            // 99 (`TaskField.RESUME`, `DataType.DATE`, `FieldMap14.java` blok 0 offset 20), gelezen
            // door `mppReader.ts` naar `task.time.resume`. Dit is dus GEEN afgeleide/herberekende
            // waarde en GEEN historie-afhankelijke aanname — de invoer staat gewoon in het bestand.
            // Corpusmeting (fase 1, Z12): `finish = addWork(resume, remaining)` op de taak-EIGEN
            // kalender is 17/17 EXACT op alle out-of-sequence-in-progress-BLADtaken corpusbreed en
            // 4/4 minuut-exact op de gemeten OzBuild-snapshots.
            //
            // TWEE EERDERE, SMALLERE POGINGEN (Z12: AANTOONBAAR out-of-sequence FS-voorganger via
            // het inmiddels VERWIJDERDE `isOutOfSequenceFsPredecessor`; Z8-fixronde-2: afwijkende
            // resourcekalender) bleken geen eigen semantische regel — dossier-voor-dossier ontdekte
            // DEELVERZAMELINGEN. Vijf resterende taken (Task 6/Task 6 - 50%/Task 6 - 150% in
            // mpp14timephased.mpp, Task 2/Task 3 in timephased-actual-overtime-work.mpp) zijn
            // WORTELTAKEN (geen voorgangers) met een STRUCTUREEL IDENTIEKE resourcekalender — beide
            // sub-condities bleven dicht, dus viel de solver terug op de RETAINED_LOGIC-afleiding
            // (`elapsed = totalSpan − remaining`, hieronder). Gemeten (Z19-probe): die afgeleide
            // `elapsed` wijkt structureel af van het ware kalender-werkminuten-verschil tussen
            // `actualStart` en `t.resume` — er bestaat wiskundig geen `remaining`-waarde die beide
            // feiten tegelijk reproduceert, want hervattingsanker en restwerk zijn in MSP's data
            // ONAFHANKELIJKE, apart opgeslagen feiten.
            //
            // EEN DERDE POGING, "AANWEZIGHEID ALLEEN IS AL HET SIGNAAL" (`t.resume` is UITSLUITEND
            // door `mppReader.ts` gezet — een niet-`.mpp`-bron draagt dit veld domweg nooit, zie
            // `cases-progress.json`'s `prog-Z12-p6-contrast-resume-forced-present`), bleek ZELF TE
            // BREED: `mpp14assignmentfields.mpp`'s "Task One" (2 toewijzingen, units [1, 0.25],
            // completion 6%) heeft óók `t.resume` gezet, maar `finish = addWork(resume, remaining)`
            // wijkt daar ~4,5 uur af van MSP's eigen antwoord — de RETAINED_LOGIC-afleiding was daar
            // AL exact. Dezelfde les als de "mpp14resource-apportionering"-dossier (Z19, elders in
            // deze etappe): bij >1 GELIJKTIJDIGE toewijzing is het TAAK-brede `remaining`/`resume`-
            // paar niet zomaar één rechtlijnige kalenderwandeling — elke toewijzing wandelt haar
            // EIGEN werk, geen partitie van de taakduur (L2-correctie, zie mppReader.ts's
            // `decodeAssignmentWorkMinutes`-docblok voor de volledige toelichting).
            // Discriminator (gemeten, niet aangenomen): ALLE 17 Z12-referentietaken én de 5 hierboven
            // genoemde dragen PRECIES 0 of 1 toewijzing; "Task One" draagt er 2. `task.resourceIds`
            // (Z19: sinds deze taak ook door `mppReader.ts` gevuld — spiegelt `ifcReader.ts`'s
            // `reconstructResourceIds`, was voorheen voor MPP-taken altijd `[]`) geeft die telling.
            // AANWEZIG ⇒ gebruik het rechtstreeks, MAAR ALLEEN bij ≤1 toewijzing.
            // `isOutOfSequenceFsPredecessor` is met deze regel overbodig geworden (elke situatie
            // waarin ze `true` gaf had ook ≤1 toewijzing) en is daarom verwijderd i.p.v. als dode
            // code te laten staan.
            //
            // BLAST-RADIUS >1-TOEWIJZING (Z19-probe, wegwerpscript, corpus+crawl 216 bestanden,
            // GECORRIGEERD ná Opus-reviewbevinding B1 — de eerdere versie van deze toelichting
            // beweerde "geen van de 14 viel ooit onder de oude gate", dat was ONWAAR): 137
            // bladtaken dragen `t.resume`, 23 daarvan hebben >1 toewijzing — 10 VOLTOOID (completion
            // 1, bereiken deze IN-PROGRESS-tak sowieso nooit) en 13 IN-PROGRESS: `mpp14assignmentfields
            // .mpp`'s "Task One" (het dossier hierboven), "Some Progress"/"Task 2"
            // (timephased-end-cost-resource.mpp/timephased-material-resource.mpp), en 10×
            // "Create Technical Specification" (de OzBuild-"After/End Para"-familie — Z12/T9's eigen
            // canonieke voorbeeldtaak, over TIEN bestandsvarianten). Van die 10 "Create Technical
            // Specification"-instanties zijn er 7 (After Papa 12/16, End Para 14/16/17/18/20)
            // WÉL aantoonbaar out-of-sequence (hun FS-voorganger "Determine Installation
            // Requirements" is voltooid, maar haar `actualFinish` ligt NÁ déze taak se eigen
            // `actualStart`) — voor die 7 was de OUDE gate dus WEL open (`isOutOfSequenceFsPredecessor`
            // gaf `true`), en sluit de NIEUWE ≤1-toewijzing-guard 'm nu juist. Ze WISSELEN dus van
            // route (resumeOverride → RETAINED_LOGIC), geen "route al vóór deze wijziging
            // ongewijzigd"-geval zoals eerder beweerd. Per taak nagerekend (Z19-probe): voor ALLE
            // ZEVEN geeft `addWork(resume, remaining)` [de oude, nu-verlaten route] HETZELFDE
            // antwoord als de RETAINED_LOGIC/`resumeFromActualElapsed`-afleiding [de nieuwe route] —
            // en beide zijn gelijk aan MSP's eigen opgeslagen finish (bevestigd via de corpusbrede
            // fidelity-pin op deze bestanden, die byte-identiek blijft t.o.v. vóór deze wijziging).
            // De overige 3 ("Create Technical Specification" op After Papa 08/End Para 11/12, plus
            // "Task One"/"Some Progress"/"Task 2") waren NOOIT out-of-sequence EN droegen geen
            // afwijkende resourcekalender (`task.timephasedDurationWalks === undefined`) — die
            // stonden al vóór deze wijziging op de RETAINED_LOGIC-vloer en blijven daar,
            // ONGEWIJZIGD, via dezelfde ≤1-toewijzing-guard.
            //
            // BLAST-RADIUS ≤1-TOEWIJZING (reviewbevinding B2 — eerlijk vastleggen, niet verbloemen
            // achter de >1-toewijzing-analyse hierboven): van de 137 `t.resume`-dragende bladtaken
            // hebben 114 ≤1 toewijzing; 56 daarvan zijn IN-PROGRESS (dezelfde `(actualStart ||
            // completion>0) && completion<1`-poort als de forward-pas zelf). Van die 56 stond de
            // OUDE gate bij 15 al open (out-of-sequence FS-voorganger of afwijkende resourcekalender)
            // — ONGEWIJZIGD. Bij de overige 41 was de oude gate DICHT — dit IS de eigenlijke
            // verruiming van deze fixronde, niet een randgeval: 41 taken krijgen nu structureel de
            // resumeOverride-route waar ze voorheen op RETAINED_LOGIC zaten. Corpusbreed blijft de
            // fidelity-pin op ELK van deze 216 bestanden byte-identiek (0 regressies, per-bestand
            // geverifieerd tegen `mpp-fidelity-baseline.json`) — van de 41 verbeteren dit dossier se
            // eigen 5 target-taken (Task 6-familie/Task 2/3) van fout naar exact; de overige 36
            // komen op dezelfde datum uit als RETAINED_LOGIC al gaf (coïncidentie, geen bewijs dat de
            // twee routes ALGEMEEN equivalent zijn — buiten dít corpus is die aanname niet getoetst).
            // `isOutOfSequenceFsPredecessor` is met deze regel overbodig geworden (elke situatie
            // waarin ze `true` gaf had ook ≤1 toewijzing) en is daarom verwijderd i.p.v. als dode
            // code te laten staan.
            //
            // `cases-progress.json`'s P6-RETAINED_LOGIC-scenario's dragen `resume` per constructie
            // NOOIT (mpp-exclusief) en blijven dus byte-identiek; hun `resourceIds` staat bovendien op
            // de default `[]` (≤1). Nieuw corpusloos mutatiebewijs (reviewbevinding B3):
            // `prog-Z19-resume-root-no-predecessor` dekt een WORTELtaak zonder enige voorganger — alle
            // eerdere `resume`-cases hadden een FS-topologie, terwijl dit dossier se eigen vijf
            // target-taken PRECIES zulke voorgangerloze wortels zijn. De `resumeFromActualElapsed`-
            // vlag (default UIT) en haar hele RETAINED_LOGIC-vloer (de `else`-tak hieronder) zijn door
            // deze wijziging GEEN letter geraakt — alleen de `resumeOverride`-voorwaarde zelf kreeg de
            // extra `&&`-clausule.
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
            // T9 (voortgangsafronding, MEET-EERST-bevinding): MS Project hervat het restwerk NIET
            // op de statusdatum zelf, maar op `actualStart + reeds-verstreken-duur` (het reeds
            // AFGEWERKTE deel, `totalSpan − remaining`, vanaf de eigen `actualES`), doorgesnapt via
            // dezelfde werk-optelling als het restwerk zelf. Bewijs (corpusreconstructie, OzBuild
            // "Create Technical Specification": completion 20%, scheduleDuration 5d, remainingTime
            // (nu EXACT uit MSP, zie mppReader.ts) 4d ⇒ verstreken 1d; actualStart vr 07-12 08:00 +
            // 1 werkdag = za 08-12 → doorgesnapt naar ma 10-12 08:00; + 4 werkdagen restwerk = MSP's
            // eigen opgeslagen finish woe 12-12 17:00 EXACT. De statusdatum-vloer (`dataDate`) alléén
            // gaf hier vr 07-12 (te vroeg — MSP's eigen "reeds verstreken" venster loopt door tot in
            // het weekend, dat P6-achtige RETAINED_LOGIC-model kent dat venster niet).
            //
            // NIET UNIVERSEEL: dit is AANTOONBAAR MSP-eigen gedrag, geen (her)ontdekte P6-regel —
            // P6's eigen, gedocumenteerde RETAINED_LOGIC ("max(dataDate, voorganger-druk)", zónder
            // een derde "verstreken-vanaf-actualStart"-vloer) staat letterlijk getest in
            // `cases-progress.json`'s Scenario A/B/C (§3.3-ontwerp, uit een P6-bronvergelijking).
            // Die scenario's zetten `actualStart` BEWUST los van "wat %complete impliceert" om
            // precies de voorganger-druk/statusdatum-interactie te isoleren — met deze vloer
            // ONVOORWAARDELIJK aan zou Scenario A-taak B (dur 5, completion 0.4, actualStart ==
            // statusDate ⇒ elapsed 2 dagen ná een actualStart die zelf al op de statusdatum ligt)
            // stilzwijgend 2 werkdagen later landen — een BESLIST, expliciet geciteerd P6-gedrag
            // breken zonder eigen meting. Vandaar de `resumeFromActualElapsed`-vlag
            // (`SchedulingOptions`, project.ts): default `undefined`/`false` ⇒ deze hele tak is een
            // no-op (byte-identiek aan vóór T9), UITSLUITEND `true` voor `.mpp`-imports
            // (`mppReader.ts` zet 'm project-breed — élke MPP-taak toont dit gedrag, corpusbreed
            // gemeten, geen per-taak-signaal nodig).
            // M1 (Opus-review, 2026-08-17): deze vloer is UITSLUITEND geldig als er nog restwerk
            // ná het "verstreken" venster geplaatst moet worden (`remaining > 0`) — het is per
            // constructie de hervattingsPUNT voor dat restwerk, geen op-zichzelf-staande finish. De
            // `elapsed + 1`-telescopie hierboven (dag ÉÉN NA het verstreken venster) is correct
            // WANNEER `remaining ≥ 1` daarna nog aangevuld wordt (het `+1` en het `−1`-effect van
            // `remaining` heffen elkaar precies op: dag `elapsed+1` + `(remaining−1)` verder =
            // dag `elapsed+remaining` = dag `totalSpan` vanaf `actualES` — exact de natuurlijke
            // finish). Bij `remaining === 0` (bv. `RemainingDuration=0` terwijl `PercentComplete<100`
            // — inconsistente brondata, of een taak die precies aan haar volledige duur zit) valt
            // die opheffing weg: `addWorkDaysChecked(remStart, 0)`/`addWorkMinutes(remStart, 0)`
            // hieronder geven `remStart` ONGEWIJZIGD terug (geen "dag −1"-tegenhanger), dus de finish
            // zou dan blijven staan op de HERVATTINGSpunt-instant zelf — één werkdag/bandgat VOORBIJ
            // de natuurlijke finish (gemeten: uur ma 16:00 → di 08:00; dag vr 10-07 → ma 13-07).
            // Bij `remaining === 0` treedt deze vloer daarom NIET in werking — `remStart` blijft op
            // de bestaande `max(dataDate, voorganger-druk)`-waarde (byte-identiek aan vóór T9 voor
            // dit randgeval), zie `cases-progress.json`'s `prog-T9-remaining-nul-hervattingspunt-onaangeroerd`.
            const elapsed = this.options.schedulingOptions?.resumeFromActualElapsed && remaining > 0
              ? Math.max(0, totalSpan - remaining)
              : 0;
            if (elapsed > 0) {
              // M2: ELAPSEDTIME rekent hier 24/7 in klok-minuten (`addElapsedMinutes`, T8-precedent)
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
                ? addElapsedMinutes(actualES, progressCal.isHourMode ? elapsed : elapsed * 24 * 60)
                : progressCal.isHourMode
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
          // Z7 (aangrijpingspunt 2, splits — DE reden deze taak "de heetste motorlus" van de
          // etappe heet, plan-§Z7): deze IN-PROGRESS-tak heeft haar EIGEN duur-optelling
          // (`addWorkMinutes`/`addWorkDaysChecked` op `remStart` hierboven/hieronder) en loopt
          // NIET door `addDurationChecked` — een split-implementatie die de gaten-optelling
          // uitsluitend dáár toevoegt, werkt aantoonbaar niet voor een taak MET voortgang (dat is
          // nu juist de populatie waar `splitGaps` uit MPP's timephased-data vandaan komt, zie
          // `mppTimephased.ts`). Mutatiebewijs (`cases-advanced-cpm.json`, `z7-split-*`-cases,
          // acceptatiepunt 3): de gaten-optelling ALLEEN uit deze tak weglaten laat geval (d) ROOD
          // terwijl (a)/(b)
          // (buiten deze tak) groen blijven — precies het bewijs dat dit een EIGEN aangrijpingspunt
          // is, geen gratis neveneffect van punt 1.
          //
          // VENSTER: ANDERS dan de vier "volledige-duur"-aangrijpingspunten hierboven/hieronder
          // (`addDurationChecked`/`subDuration`/`finishFromStart`/`startFromFinish`, die altijd
          // `[0, totale duur)` gebruiken) telt hier alleen het RESTWERK-venster
          // `[reeds-afgewerkt, totale duur)` mee — `TaskSplitGap.afterMinutes` is relatief aan de
          // TAAKSTART (niet aan `remStart`), dus een gat dat vóór het reeds-afgewerkte deel ligt is
          // al voorbij: dat is GEEN extra restwerk, het zit al in de historie die `actualStart`/
          // `remStart` vertegenwoordigt. Nogmaals optellen zou de finish onterecht verder optrekken
          // dan MSP's eigen opgeslagen antwoord.
          //
          // CORPUSVRAAG (plan-§Z7, verplicht gemeten i.p.v. gegokt): "blijft het voltooide segment
          // staan terwijl het restwerk schuift, of schuift de hele taak?" ProjectLibre kiest expliciet
          // het eerste (`Assignment.java`'s `shift()` verplaatst alleen restwerk, met een zelf-erkende
          // `//TODO integrate split - still needed?` op precies die plek — alleen als HYPOTHESE
          // gebruikt, zie §9). ONZE keuze volgt daar onafhankelijk uit het VENSTER-ontwerp hierboven,
          // niet uit die referentie overgenomen: `remStart`/`actualES` (het al-afgewerkte anker)
          // wordt door GEEN van de twee `if`-takken hierboven aangeraakt — een gat kan uitsluitend het
          // RESTWERK-venster `[completedSpan, totalSpan)` verlengen, nooit `es`/`remStart` zelf
          // verschuiven. Dat IS "voltooid blijft staan, restwerk schuift" — zonder dat er een
          // aparte aftakking voor nodig was.
          //
          // `mpp14splittask.mpp` (de VERPLICHTE meetreferentie, zie `mppTimephased.ts`'s moduleheader)
          // kan deze vraag NIET beantwoorden: beide taken staan op 0% voltooid, geen voortgang om te
          // meten — ongewijzigd sinds Z4. BREDERE CORPUSMETING (dit punt, wegwerpscript op de bestaande
          // `readMPP`-infra tegen corpus+crawl): het OzBuild-materiaal draagt GEEN enkele taak met
          // zowel `splitGaps` als voortgang — de enige gevonden combinaties zitten in twee publieke
          // MPXJ-crawlbestanden, `mpp14timephased.mpp` (10 taken) en `timephased-actual-overtime-
          // work.mpp` (2 taken). In ALLE 12 gemeten taken geldt `resume === stop` EXACT (bv. Task 6:
          // resume/stop beide 2008-12-02T15:00) — MSP's eigen "hervattingsinstant" en "stop-instant"
          // vallen dus in dit corpus altijd samen, geen enkel geval van een écht UITEENLOPEND
          // resume/stop-paar naast `splitGaps` is gevonden.
          //
          // VOORRANGSREGEL (uit deze meting, niet aangenomen): `resume`/`splitGaps` zeggen in de
          // gemeten populatie HETZELFDE, maar over VERSCHILLENDE assen — `resume` (Z12, Z19) is het
          // CALENDER-anker van het restwerk-startpunt (waar `remStart` op landt, via de
          // `resumeOverride`-tak of de gewone RETAINED_LOGIC-vloer hierboven);
          // `splitGaps` (Z7) leeft op de WERK-as (hoeveel werk is al gedaan, `completedSpan`) en is
          // BLIND voor welk kalenderanker `remStart` daadwerkelijk kreeg. Er ontstaat dus GEEN
          // conflict om een voorrangsregel voor nodig te hebben: het venster
          // `[completedSpan, totalSpan)` wordt vóór — en onafhankelijk van — de resume/dataDate/
          // earlyStart-keuze voor `remStart` berekend, en toegepast op `remaining` (niet op
          // `remStart`). Áls een bestand ooit `resume ≠ stop` mét `splitGaps` zou dragen, blijft dat
          // ONGEWIJZIGD gedrag: dezelfde werk-as-vensterlogica, gewoon tegen een ANDER `remStart`-
          // anker (de resume-override raakt uitsluitend WAAR `remStart` landt, nooit HOEVEEL restwerk
          // — die twee blijven orthogonaal per ontwerp, niet toevallig).
          //
          // RESTERENDE `timephased-actual-overtime-work.mpp`-afwijking (2 taken, `mpp-fidelity-
          // baseline.json`, ongewijzigd door Z7): BEIDE gevonden taken behielden hun bestaande
          // afwijking na deze fix — de oorzaak is Z8-scope (timephased-vénster bepaalt de taakdatums,
          // nog niet gebouwd), niet een Z7/splits-tekort: dit bestand blijft `reason`-gepind als
          // "resource-gedreven/timephased-uitzondering", dezelfde categorie als `mpp14timephased.mpp`
          // (dat WEL verbeterde door Z7 — 3 taken minder afwijkend — omdat een deel van DIE taken
          // puur op de splits-fix wachtte, een ander deel nog op Z8). Twee features die uit dezelfde
          // timephased-decoder (Z3/Z4) putten, raken dus soms dezelfde taken zonder dat de een de
          // ander vervangt — verwacht, zie plan-§3(c).
          //
          // Z7-FIXRONDE (H1-VERIFICATIE, expliciet gecontroleerd i.p.v. aangenomen): de reviewer-
          // hypothese "`mpp14timephased.mpp`'s 'Task 5 - 24 Hour' klopt met een ONGEKLEMDE
          // KLOKTIJD-som (4500+5760 minuten als 24/7-klokminuten ≈ 7,125 dag = MSP's 2008-11-27T12:00)"
          // is GECONTROLEERD en WEERLEGD als universele regel: diezelfde taak se kalender is
          // BYTE-IDENTIEK aan `mpp14splittask.mpp`s "Standard"-kalender (8u/dag ma-vr, twee banden
          // 08-12/13-17) — en DIE taken reproduceren MSP's eigen finish uitsluitend via de
          // KALENDERBEWUSTE WERKMINUTEN-wandeling (`CalendarEngine.addWorkMinutes`, Z4's eigen
          // byte-bewijs: 6240 werkminuten = 13 werkdagen × 480 min/dag = precies 2006-10-09, geverifieerd
          // tot op de minuut). Een universele kloktijd-regel zou die al-bewezen referentie BREKEN.
          // Conclusie: "Task 5 - 24 Hour" (en de rest van de Night-Shift/24-Hour/50%/150%-familie in
          // dit bestand) draagt een resource-eigen werkpatroon dat NIET via de nominale taakkalender
          // loopt — MSP plant die kennelijk via timephased/resource-contourdata (Z8-domein), en de
          // kloktijd-som klopt daar toevallig mee, niet omdat kloktijd de juiste as is. De
          // werkminuten-wandeling (dit bestand, H1-fix) blijft daarom de canonieke regel; de
          // resterende afwijking in deze familie is Z8-scope, geen Z7-tekort — zie de bijgewerkte
          // `reason` bij deze hash in `mpp-fidelity-baseline.json` voor de volledige hermeting.
          //
          // `totalSpan`/`remaining` staan al in de "eigen eenheid" van de taak (minuten uur-modus,
          // dagen dag-modus, zie de toelichting bij `totalSpan` hierboven) — omgerekend naar
          // werkMINUTEN (`TaskSplitGap`s eigen eenheid, `duration.ts`) vóór de as-wandeling, en de
          // uitkomst weer terug. `!isElapsedTask`-guard: ELAPSEDTIME blijft bewust ONGEMOEID (24/7
          // kent geen "gat"-begrip, zelfde reden als overal elders in dit bestand — splits zijn een
          // WERKtijd-concept, zie `duration.ts`'s moduleheader bij deze functies).
          //
          // Z7-FIXRONDE (H2, WORTELFIX MEE — reviewbevinding): de EERSTE versie vergeleek
          // `completedSpanMinutes` (een ZUIVERE werk-hoeveelheid) rechtstreeks tegen `afterMinutes`
          // (een AS-POSITIE die voorgaande gaten al meetelt, zie H1 hierboven) — bij ≥2 gaten waarvan
          // er één al gepasseerd was liepen die twee assen uiteen en kon een gepasseerd gat dubbel
          // meetellen. Fix: DEZELFDE `splitTotalSpanMinutes`-wandeling als de vier volledige-duur-
          // aangrijpingspunten, tweemaal aangeroepen (voor de TOTALE en de REEDS-AFGEWERKTE
          // werkhoeveelheid) — het VERSCHIL is de restwerk-as-lengte. Omdat de wandeling monotoon/
          // prefix-consistent is (twee wandelingen vanaf 0 delen exact hetzelfde begin-traject), heft
          // een gat dat VOLLEDIG vóór het reeds-afgewerkte doel ligt zichzelf in dat verschil precies
          // op (nul netto bijdrage — geen dubbeltelling meer); een gat (deels) ná dat doel telt voluit
          // mee. `Math.max(0, …)` op `completedSpanMinutes` klemt tegen hostiele/inconsistente
          // invoer (`t.remainingMinutes`/`remainingTime` > de eigen totale duur, bv. via MCP gezet) —
          // zónder deze klem werd `completedSpanMinutes` negatief en viel de wandeling stil terug op
          // "alle gaten meetellen" (elk gat ligt dan per definitie "ná" een negatief doel). Rode-pad-
          // mutatiebewijs: `z7-split-h-hostile-remaining-boven-totalspan` (cases-advanced-cpm.json).
          //
          // Z7-FIXRONDE-2 (LAAG 2, klem-ASYMMETRIE — bewust, niet vergeten): deze klem raakt
          // UITSLUITEND de gaten-tak. Een GATLOZE taak met datzelfde hostiele `remainingMinutes`
          // (bv. 999999) loopt de tak hieronder NIET binnen — `remainingWithGaps` blijft dan de
          // rauwe `remaining` en gaat ONGEKLEMD naar `addWorkMinutes`/`addWorkDaysChecked`, wat een
          // even absurd-ver-in-de-toekomst (maar EINDIG, niet-crashend) antwoord geeft. Dat is GEEN
          // vergeten symmetrie-fix — het is een BEWUSTE scope-grens: de klem hierboven bestrijdt een
          // kwalitatief ANDERE faalmodus (een NEGATIEF tussendoel dat de as-wandeling semantisch laat
          // ontsporen, "alle gaten tellen mee" i.p.v. "te veel restwerk") — niet "een groot getal
          // geeft een ver-weg-datum" (dat is voor ELKE `remaining`-waarde, met of zonder gaten,
          // altijd al zo geweest, ook vóór Z7; `remainingMinutes` heeft in het datamodel geen
          // bovengrens t.o.v. de eigen duur, en dat blijft zo). Een taak MET gaten krijgt hierdoor
          // als NEVENEFFECT wel een BEGRENSD resultaat bij zo'n hostiele invoer (de wandeling valt
          // terug op "volledige duur+gaten, als 0% voltooid", zie de klem hierboven) — dat is een
          // toevallig gunstig neveneffect van de negatief-doel-klem, geen doelbewust ontworpen
          // bovengrens-klem op `remaining` zelf. Symmetrisch maken (`remaining` ook in de gatloze
          // tak klemmen op de eigen duur) zou progress-tracking-gedrag BUITEN Z7-scope wijzigen
          // (elke taak, niet alleen gesplitste) zonder corpus- of casebewijs dat dat gewenst is —
          // bewust NIET gedaan.
          let remainingWithGaps = remaining;
          if (!isElapsedTask && task.splitGaps && task.splitGaps.length > 0) {
            const totalSpanMinutes = progressCal.isHourMode ? totalSpan : totalSpan * progressCal.hoursPerDay * 60;
            const remainingMinutesUnits = progressCal.isHourMode ? remaining : remaining * progressCal.hoursPerDay * 60;
            const completedSpanMinutes = Math.max(0, totalSpanMinutes - remainingMinutesUnits);
            const totalAxisMinutes = splitTotalSpanMinutes(task.splitGaps, totalSpanMinutes);
            const completedAxisMinutes = splitTotalSpanMinutes(task.splitGaps, completedSpanMinutes);
            const remainingAxisMinutes = Math.max(0, totalAxisMinutes - completedAxisMinutes);
            remainingWithGaps = progressCal.isHourMode
              ? remainingAxisMinutes
              : remainingAxisMinutes / (progressCal.hoursPerDay * 60);
          }
          let ef: Date;
          if (isElapsedTask) {
            ef = addElapsedMinutes(remStart, remainingElapsedMinutes);
          } else if (progressCal.isHourMode) {
            ef = progressCal.addWorkMinutes(remStart, remainingWithGaps);
          } else {
            // WP7: ook het rest-werk-pad kan tegen de onwerkbaar-venster-cap lopen ⇒ checked-variant.
            const r = progressCal.addWorkDaysChecked(remStart, remainingWithGaps);
            ef = r.date;
            if (r.capped) this.cappedTaskIds.push(taskId);
          }
          // Z12-herwerk, reviewbevinding L1: de VOLTOOID-tak (hierboven, `if (ef < es) es = ef`)
          // bewaakt al dat een taak nooit "eindigt vóór ze begint"; het eerdere anker-ontwerp op
          // DEZE tak had die wacht niet. `remStart` (dus ook `ef = addWork(remStart, remaining)`)
          // komt bij `usedResumeOverride` rechtstreeks uit het RESUME-veld — een bestand met
          // inconsistente RESUME/ActualStart-velden (RESUME vóór de eigen `actualStart`, corrupt of
          // hostile) zou anders een `ef` vóór `actualES` kunnen opleveren terwijl `es` hieronder
          // altijd `actualES` blijft. Klem `ef` dan op `actualES` (nooit `es` verlagen: `actualES`
          // is hier, anders dan in de VOLTOOID-tak, een AANTOONBAAR feit, geen uit hetzelfde
          // mechanisme afgeleide waarde). Normale niet-override-pad: `remStart` is per constructie
          // altijd ≥ `actualES`, dus deze wacht is daar een no-op.
          if (usedResumeOverride && ef < actualES) ef = actualES;
          // X7: de verwachte einddatum is bewaarde P6-brondata totdat de X5-projectvlag hem
          // expliciet activeert. Daardoor blijft dezelfde taak bij MSP/IFC en bij een uitgeschakelde
          // P6-vlag volledig op de gewone restduurroute.
          if (task.p6ProjectId && this.options.schedulingOptions?.useExpectedFinishDates === true
              && task.p6ExpectedFinish) {
            const parsedExpected = this.parseIn(progressCal, task.p6ExpectedFinish);
            // X7: date-only Expected Finish heeft FINISH-dagprecisie, ook wanneer een ANDER X7-veld
            // de taakkalender naar uurmodus promoveerde. Zoek vanaf de volgende daggrens begrensd
            // terug naar het laatste effectieve band-einde op of vóór de bedoelde kalenderdag.
            // `null` betekent: binnen CalendarEngine.MAX_SCAN bestaat aantoonbaar geen bandpunt;
            // dan blijft de al berekende finish staan i.p.v. een middernachtanker te verzinnen.
            const expected = progressCal.isHourMode && !task.p6ExpectedFinish.includes('T')
              ? progressCal.prevWorkInstantOrNull(new Date(
                this.startOfDay(parsedExpected).getTime() + MS_PER_DAY,
              ))
              : parsedExpected;
            if (expected && !isNaN(expected.getTime())) ef = expected;
          }
          // Z8-HERWERKRONDE (LAAG 2 van de gelaagde beslistabel): een IN-PROGRESS-taak plant op haar
          // bestaande resume-/actuals-pad hierboven — GEEN Z8-venster-raadpleging. De EERSTE Z8-versie
          // deed dat nog wél; de herwerkronde liet die aanroep hier bewust vervallen (spiegelt de
          // VOLTOOID-tak hierboven) — `mppReader.ts` zet de Z8-velden nooit meer op een taak met
          // `0 < completion < 1`, dus de aanroep zou toch altijd `null` opleveren.
          // XER exporteert op de zesassige Early Start-as het begin van het RESTERENDE werk, niet
          // de historische Actual Start. `remStart` is hierboven uitsluitend uit invoersemantiek
          // opgebouwd (statusdatum, relatiegrens en eventueel gevalideerde suspend/resume); er
          // wordt geen P6 early/late-uitvoer gelezen. Andere formaten houden hun bestaande
          // actual-startweergave doordat alleen het XER-pad deze vlag zet.
          const displayedEarlyStart = this.p6XerOption(
            this.options.schedulingOptions?.p6UseRemainingStartForProgress,
          )
            ? remStart
            : actualES;
          results.set(taskId, { es: displayedEarlyStart, ef });
          continue;
        }
        // B1 (eindreview T16c, dossier (c)4-herdiagnose): deze vloer is P6-eigen RETAINED_LOGIC-
        // semantiek ("remaining werk nooit in het verleden") — MS Project verschuift een niet-
        // gestarte taak NIET automatisch naar op-of-ná de statusdatum (reviewer-meting:
        // `calendar-exception-precedence.mpp`, zonder de vloer minuut-exact tegen MSP's eigen
        // opgeslagen Start/Finish; mét de vloer ~8 jaar afwijkend, want de taak se eigen anker
        // 2015-10-01 ligt ver vóór de statusdatum 2023-05-01). `unstartedIgnoresStatusDate` is
        // uitsluitend `true` voor `.mpp`-imports (`mppReader.ts`); P6-brongegevens (progressMode-
        // gedreven, ook via MSPDI/CSV/IFC) behouden deze vloer bewust — zie het veld se docblock in
        // `src/types/project.ts` voor de volledige motivatie.
        if (
          dataDate && t.completion === 0 && earlyStart < dataDate
          && !this.options.schedulingOptions?.unstartedIgnoresStatusDate
        ) {
          // (3) NIET GESTART: statusdatum als ondergrens (remaining werk nooit in het verleden).
          earlyStart = dataDate;
        }
      }

      const { date: earlyFinishRaw, capped } = this.addDurationChecked(cal, earlyStart, task);
      if (capped) this.cappedTaskIds.push(taskId); // WP7: onwerkbaar venster ⇒ zachte waarschuwing
      // Z10-fixronde 2 (reviewbevinding 3, BESLUIT: de harde pin wint): een taak met een harde
      // MFO/MSO-finish-pin belooft een eigen contract — EF = LF = de pin, tf = 0 (`hardPinFinish`/
      // `applyBackwardBound`). Zonder deze wacht overrulede de SF-vloer dat contract zodra dezelfde
      // taak óók een SF-opvolger is: de vloer duwde EF ná de pin, terwijl LF op de pin bleef staan
      // (backward pass kent de vloer niet) ⇒ EF > LF ⇒ negatieve tf, het pin-contract geschonden.
      // De bestaande `hardPinViolatedIds`-detectie (§4.2, `applyForwardConstraints`) blijft het
      // signaal voor zo'n conflict — deze wacht verandert daar niets aan, ze voorkomt alleen dat de
      // vloer een EIGEN, tweede schending introduceert bovenop een taak die al hard gepind is.
      // `hardPinFinish` afwezig (geen harde pin, verreweg het gebruikelijke geval) ⇒ byte-identiek.
      // (`hardFinishPin` zelf is vooraan deze functie al berekend — Z8-fixronde, zie die toelichting.)
      // Z10: de SF-vereiste-finish is een ondergrens op de early finish (zie `sfFinishFloor`s
      // declaratie hierboven) — vuurt alleen als de gewone `ES + duur`-herberekening er daadwerkelijk
      // ONDER blijft (het normale, niet-grensoverschrijdende geval reproduceert `sfFinishFloor` toch
      // al exact, dus deze `max` is dan een no-op). `sfFinishFloor === null` (geen SF-voorganger,
      // verreweg het gebruikelijke geval) ⇒ byte-identiek aan vóór Z10.
      let earlyFinish = !hardFinishPin && sfFinishFloor && sfFinishFloor > earlyFinishRaw
        ? sfFinishFloor
        : earlyFinishRaw;
      // Z8 (etappe "nul afwijkingen", gemeten — zie `mppReader.ts`'s `deriveTimephasedWindowsFor
      // Tasks`-moduleheader voor het corpusbewijs, en `timephasedFinish()`'s eigen docblok voor de
      // fixronde-correctie op de precedentie t.o.v. `sfFinishFloor`): het timephased-venster wint
      // van de kale duur-gebaseerde `earlyFinishRaw`/`sfFinishFloor`-combinatie hierboven (dus ook
      // als dat een LATERE datum was — `earlyFinishRaw` wordt hier niet meer geraadpleegd), maar
      // nooit van een harde MFO/MSO-pin en nooit van een échte SF-vereiste-finish (die blijft zijn
      // eigen `Math.max`-ondergrens, verrekend in `timephasedFinish()` zelf). `task.
      // timephasedFinishFloor` afwezig ⇒ `tf === null` ⇒ byte-identiek (het overgrote deel van de
      // taken heeft geen timephased-toewijzingen). Veldnaam ("Floor") bewust ongewijzigd gelaten
      // ondanks dat het gedrag een override is, geen vloer — hernoemen zou Task/mppReader/
      // moveProject/check-ifc-roundtrip opnieuw raken voor een zuiver cosmetische reden.
      const tf = this.timephasedFinish(task, cal, hardFinishPin, sfFinishFloor, timephasedFinishFloorIsDegenerateResnap);
      if (tf) earlyFinish = tf;
      // Herwerkronde-slotronde (reviewer-eis 4): dezelfde EF<ES-inversiewacht als de VOLTOOID-tak
      // (`if (ef < es) es = ef`) en de IN-PROGRESS-tak (`if (usedResumeOverride && ef < actualES) ef
      // = actualES`) ontbrak hier. `tf` (laag 3, een LETTERLIJK gelezen venster) kan in theorie vóór
      // `earlyStart` liggen wanneer een voorganger-push (of een SNET/MSO-constraint) `earlyStart` ná
      // het geïmporteerde venster duwt — een bestand-inconsistentie die zonder wacht een taak zou
      // laten "eindigen vóór ze begint". ANDERS dan de VOLTOOID-tak (waar `es` mag zakken naar `ef`,
      // want `actualFinish` is daar het hardere feit) is hier `earlyStart` het hardere feit (voorganger-
      // druk/constraint, niet zelf een gelezen "antwoord") — dus klem `earlyFinish` omhoog naar
      // `earlyStart`, spiegelt de IN-PROGRESS-tak se klemrichting. Corpusbreed (3105 bladtaken,
      // corpus+crawl) BLEEF dit vóór de wacht al 0/0 — de wacht is dus verdedigend (defense-in-depth
      // tegen een nog niet waargenomen bestand-vorm), corpusloos mutatiebewijs in cases-advanced-cpm.json.
      if (tf && earlyFinish < earlyStart) earlyFinish = earlyStart;

      // XER/P6-grensvenster voor de zeldzame TT_FinMile-vorm waarin scheduleStart de eerste
      // bandstart en scheduleFinish het vorige bandeinde draagt. Alleen toepassen zolang de
      // netwerkuitkomst exact op dat geplande startanker staat; latere relatiedruk wint gewoon.
      if (this.p6XerOption(this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow)
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

  /** Hammock-ES (§4.4): de gewone forward-`max` over de START-drivers (SS/FS-voorgangers), met de
   *  projectstart als vloer. FF/SF-voorgangers (finish-drivers) doen hier NIET mee — die bepalen de
   *  EF. `forwardConstraint` levert voor SS/FS een start-grens; `seqConstraint` wordt bewust NIET
   *  gezet, zodat de hammock-relaties buiten de driving-/float-path-analyse blijven (§4.4).
   *
   *  BEKENDE BEPERKING (L4, T6-her-review, §9/O1): een hammock-taak die TEGELIJK `isMilestone` is,
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

  /** Hammock-EF (§4.4): de `max` over de FINISH-drivers (FF/SF-voorgangers), met ondergrens `es` (een
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

  // Z19 (residu-iteratie "nul afwijkingen", dossier "resumeOverride-gate-verbreding", L4-
  // reviewcorrectie — dit was eerder abusievelijk TUSSEN `detectOutOfSequence`'s eigen docblok en
  // haar functiesignatuur gezet): de vroegere `isOutOfSequenceFsPredecessor` (Z12) — de LIVE,
  // tijdens-de-forward-pas-tegenhanger van `detectOutOfSequence`'s eigen FINISH_START-tak, gebruikt
  // om de `resumeOverride`-gate hierboven te openen — is VERWIJDERD: de gate is vereenvoudigd tot
  // "AANWEZIG `t.resume` (bij ≤1 toewijzing) ⇒ gebruik het rechtstreeks" (zie de
  // `resumeOverride`-toelichting in de forward-pas hierboven), waarmee elke situatie die deze
  // functie ooit `true` liet geven nu al via die bredere regel afgehandeld wordt.
  // `detectOutOfSequence` hieronder is een ANDERE, ONGEWIJZIGDE functie (de post-hoc WAARSCHUWING
  // over out-of-sequence-relaties, geen gate) — niet te verwarren met de verwijderde functie.
  /**
   * Out-of-sequence-detectie (fase 2.6, §4.4): relaties waarvan de opvolger progress/actuals heeft
   * die de voorganger-logica tegenspreekt. Waarschuwing, geen correctie — het gedrag volgt uit de
   * gekozen progressMode.
   *
   * M2 (Opus-review T15-iteratie-2): de vroegere `if (!this.dataDate) return [];`-poort was
   * KUNSTMATIG — de detectie hieronder gebruikt uitsluitend `earlyDates` (de al-berekende
   * voorganger-EF) en elke taak se eigen `actualStart`/`actualFinish`, nooit `this.dataDate` zelf.
   * Dezelfde soort poort als de VOLTOOID-/IN-PROGRESS-branches (H1/c2, M1) die T15 al wegsneed —
   * een relatie kan aantoonbaar out-of-sequence zijn (opvolger-actuals tegenspreken de voorganger-
   * logica) ongeacht of het project een statusbrede statusdatum heeft.
   */
  private detectOutOfSequence(earlyDates: Map<string, { es: Date; ef: Date }>): string[] {
    const out: string[] = [];
    for (const seq of this.sequences) {
      const pred = this.tasks.get(seq.predecessorId);
      const succ = this.tasks.get(seq.successorId);
      if (!pred || !succ) continue;
      // Sub-dag-actuals moeten in uur-modus als out-of-sequence tellen ⇒ `parseInstant` (§5.3);
      // elke taak in zijn eigen engine. Dag ⇒ `parseDate` (byte-identiek).
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

  /** Getekend werkdag-verschil in kalender `eng`: a≤b ⇒ +stappen, a>b ⇒ −stappen (negatief mogelijk). */
  private signedWorkDays(a: Date, b: Date, eng: CalendarEngine): number {
    return a <= b
      ? eng.workDaysBetween(a, b) - 1
      : -(eng.workDaysBetween(b, a) - 1);
  }

  /** Constraint-instant in de kalendermodus (§4.1), of null bij afwezig/onparseerbaar (soft:
   *  negeren). Dag ⇒ `parseDate` (middernacht, byte-identiek); uur ⇒ `parseInstant` (behoudt tijd-
   *  van-de-dag). Een date-only-string op een uur-taak = middernacht ⇒ dag-verankerd: de instant-
   *  vinders snappen hem naar de eerste/laatste werk-instant van die dag (S13). Een datetime-string
   *  draagt tijd-van-de-dag en wordt tot de minuut gehonoreerd. */
  private constraintInstant(c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const raw = c?.date;
    if (!raw) return null;
    const d = this.parseIn(eng, raw);
    return isNaN(d.getTime()) ? null : d;
  }

  /** De harde-pin-START (§4.2), of null als de PRIMAIRE constraint geen harde MSO/MFO-pin is.
   *  MSO pint de START op de datum; MFO pint de FINISH ⇒ start = finish ⊖ duur. Modus-neutraal
   *  (dag: bevroren dag-primitieven; uur: instant-vinders + minuut-aftrek via `durationMinutesOf`).
   *
   *  T8-REIKWIJDTE (L1, T8-review — correctie op de T8-commitboodschap, die "MSO/MFO-constraints"
   *  noemde als afnemer van `finishFromStart`/`startFromFinish`): dat klopt alleen voor de
   *  DUUR-terugstap hier (MFO ⇒ `startFromFinish`, hierbeneden MSO ⇒ `addDuration`) — dié is
   *  ELAPSEDTIME-bewust sinds T8. De CONSTRAINT-SNAP zelf (`this.snapOnOrAfter(eng, d)` hierboven,
   *  en `constraintInstant`/`snapOnOrBefore` in de soft-constraint-tegenhangers `forwardBoundOf`/
   *  `backwardBoundOf` hieronder) is dat NIET: een MSO/MFO-datum op een taak snapt altijd naar een
   *  WERK-instant, ook als die taak zelf ELAPSEDTIME is. Bewuste afbakening (niet gefixt in T8 of
   *  deze reviewronde) — geen synthetische case dekt dit, dus geen mutatiebewijs voor deze regel. */
  private hardPinStart(task: Task, eng: CalendarEngine): Date | null {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return null;
    const d = this.constraintInstant(c, eng);
    if (!d) return null;
    const snapped = this.snapOnOrAfter(eng, d);
    return c.type === 'MSO' ? snapped : this.startFromFinish(eng, snapped, task);
  }

  /** De harde-pin-FINISH (§4.2), spiegel van `hardPinStart` (⇒ EF=LF én ES=LS op de pin, tf=0).
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
   * Z8-HERWERKRONDE (etappe "nul afwijkingen") — de gelaagde beslistabel, LAAG 3 en LAAG 4 (zie
   * `mppReader.ts`'s `deriveTimephasedWindowsForTasks`-moduleheader voor de VOLLEDIGE toelichting,
   * inclusief de weerlegde eerdere hypotheses). Mutueel exclusief per taak (`mppReader.ts` zet
   * nooit beide velden op dezelfde taak) — `timephasedFinishFloor` afwezig ⇒ laag-4-tak geprobeerd,
   * ook die afwezig ⇒ `null` (laag 5, geen Z8-bemoeienis). Lagen 1/2 (VOLTOOID/IN-PROGRESS) worden
   * hier NOOIT bereikt: `mppReader.ts` zet deze velden uitsluitend op `completion === 0`-taken, dus
   * de twee call sites in die branches zijn bewust VERWIJDERD (zie hun eigen toelichting).
   *
   * LAAG 3 — gelezen venster (`timephasedFinishFloor`, MSP's eigen `AssignmentField.FINISH`).
   * FIXRONDE-CORRECTIE (regressie gevonden op `mpp14relations.mpp`'s "Task 5", de Z10-dossier-
   * taak — START_FINISH-opvolger): een EERSTE versie liet dit venster de hele `earlyFinish`
   * ONVOORWAARDELIJK overschrijven. MSP's per-toewijzing `FINISH`-veld blijkt echter NIET altijd
   * al de volledige relatiewiskunde te verrekenen — voor Task 5 droeg het de NAÏEVE `ES+duur`-
   * datum, niet de SF-aangepaste datum die `sfFinishFloor` (Z10) al correct berekent. Conclusie:
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
   * WELKE duur per item (Z19, residu-iteratie "nul afwijkingen") — `walk.workMinutes` als die
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
    // Z13: `finishFloorIsDegenerateResnap` (gezet in de `noPreds`-tak, zie de toelichting daar) —
    // sla laag 3 in dat ene band-eind-corpusgeval over, zodat `addDurationChecked`s eigen correctie
    // (aangeroepen om `earlyFinishRaw` te leveren, hierboven in `forwardPass`) het laatste woord
    // houdt. Elders (`false`, verreweg de meerderheid) byte-identiek.
    if (cal.isHourMode && task.timephasedFinishFloor && !finishFloorIsDegenerateResnap) {
      windowValue = parseInstant(task.timephasedFinishFloor);
    } else if (task.timephasedDurationWalks && task.timephasedDurationWalks.length > 0) {
      const durMin = task.time.durationMinutes;
      if (durMin != null) {
        for (const walk of task.timephasedDurationWalks) {
          const resCal = resolveCalendar(walk.resourceCalendarId, this.registry, this.projectCal);
          const resEng = this.engineForCal(resCal);
          if (!resEng.isHourMode) continue;
          // Z19-apportionering: `workMinutes` (alleen gezet bij >1 toewijzing) wint van de volle
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
   * Detector-gate voor de harde-pin-logica-schending (fase 2.10, P1). Een taak met een geregistreerd
   * feit (`actualStart` gezet voor MSO, `actualFinish` gezet voor MFO) waarvan dat feit EXACT op de
   * pin valt, heeft de pin al aantoonbaar gerespecteerd — een later/gevloerd berekende voorganger-EF
   * (`rawMax`, bv. via een niet-afgemelde startmijlpaal die door de data-date-vloer omhoog is
   * geschoven) is dan een achterhaald forward-signaal, geen echte logica-schending. Wijkt het
   * geregistreerde feit zelf af van de pin (te vroeg/te laat), of ontbreekt het feit nog, dan gate
   * dit NIETS — de bestaande melding blijft vuren. Bewust smal: alleen dit ene detector-moment,
   * de data-date-vloer zelf (§P6) blijft ongewijzigd.
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

  /** Forward-ondergrens (start) van ÉÉN soft constraint (§4.1/§4.3), of null zonder forward-effect.
   *  SNET/MSO ⇒ start-ondergrens; FNET/MFO ⇒ finish-ondergrens vertaald naar de start. Dag-modus
   *  reduceert byte-identiek tot `nextWorkDay`/`addWorkingDaysSigned`; uur-modus gebruikt de instant-
   *  vinders + de minuut-aftrek van `startFromFinish` (via `durationMinutesOf`).
   *
   *  VOORHEEN (L5, T6-her-review, §9/O6, WEERLEGD): een SNET/MSO exact op een band-eind (bv. "niet
   *  vóór di 17:00") volgt de mijlpaal-instantconventie NIET — `snapOnOrAfter` snapt hier altijd
   *  vooruit via `nextWorkInstant`, ook op een eindmijlpaal. Die claim was NOOIT corpusgetoetst
   *  (T6-her-review's eigen bewoording: "MS Project zelf leest dit ook als..." — een aanname, geen
   *  meting).
   *
   *  Z19-WEERLEGGING (residu-iteratie "nul afwijkingen", klokdossier-mijlpaaldossier, §9-precedent
   *  "corpus wint"): het EERSTE corpusfeit over deze vraag zegt het TEGENOVERGESTELDE. Een
   *  wortelmijlpaal (duur 0) met SNET vóór de eerste band van haar dag (bv. `…T07:15` op een
   *  08:00–17:00-band — geen bandgrens, een echt gat vóórdat de werkdag begint): MSP's eigen
   *  `SCHEDULED_START` bleef `07:15`, ONGESNAPT. De juiste, nauwe regel: EEN 0-DUURMIJLPAAL SNAPT
   *  NIET — er is geen werk te plaatsen dat een "eerstvolgende werk-instant" nodig heeft, een
   *  mijlpaal is een puntmarkering, geen taak die binnen werktijd moet passen. Taken MÉT duur
   *  behouden het bestaande snap-gedrag ONGEWIJZIGD (`isZeroDurationMilestone`-poort hieronder).
   *  Compatibel met de 41 FNLT-bandeind-mijlpalen (regressiepoort, `check-advanced-cpm.ts`): die
   *  krijgen hun landingsinstant uit een RELATIE (niet uit deze forward-constraint-tak — FNLT is een
   *  BACKWARD-constraint, `backwardBoundOf`, hier niet aangeraakt) en blijven dus exact.
   *
   *  VERWANTE OORZAAK (T6-her-review): de `dataDate`-vloer ("NIET GESTART", `forwardPass`) snapt
   *  in de PROJECT-kalender (`this.projectEngine`), niet in de eigen kalender van de taak — bij
   *  verschillende bandstructuren kan dat een ES opleveren die in de EIGEN taak-kalender géén
   *  `[start,end)`-instant is. Dat is precies het mechanisme achter `msp-06` in
   *  `cases-msp-pariteit.json` (en de FS-tak-verbreding rond `predEndsBeginOfDay` in
   *  `relationMath.ts`, L3): een relatie-afgeleide instant kan dus, via een taak wiens ES zelf al
   *  "vuil" is t.o.v. haar eigen kalender, alsnog een constraint-achtig gemengd-kalender-effect
   *  krijgen — niet gefixt hier (dit blok blijft puur constraint-ondergrenzen), maar wel de
   *  brug tussen deze beperking en de mijlpaal-instantconventie hierboven. */
  private forwardBoundOf(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const d = this.constraintInstant(c, eng);
    if (!c || !d) return null;
    // Z19: geen snap voor een 0-duurmijlpaal — MAAR uitsluitend bij een ECHT datetime-anker
    // (`c.date` draagt een tijdcomponent) in uur-modus. Zelfde "S13"-conventie als elders in dit
    // bestand (`constraintInstant`'s eigen docblok): een DATE-ONLY constraint-string is per
    // conventie dag-verankerd — "ergens op die dag" — en blijft dus naar het eerste werk-instant
    // van de dag snappen (mutatiebewijs: `rr-fs-pred-startms`-familie in `cases-hours-relations.json`
    // en `msp-56-z9a-manual-anchor-raw-no-snap`/dag-modus in `cases-msp-pariteit.json` gingen ROOD
    // op een eerdere, te brede versie zonder deze guard). Dag-modus (`!eng.isHourMode`) blijft
    // hoe dan ook ONGEWIJZIGD (`isExactBandEnd`-precedent: geen corpusmeting op dag-modus gedaan).
    //
    // N1 (Opus-her-check, blokkerende fout in de eerdere versie): de `noSnap`-guard stond hier als
    // een VROEGE `return d;` VÓÓR de type-switch — dat gaf `d` ALTIJD terug zodra een 0-duurmijlpaal
    // matchte, ONGEACHT `c.type`. FNLT/SNLT hebben in DEZE functie GEEN forward-effect (ze horen
    // `null` te geven — `backwardBoundOf` hierboven is hun kant) — met de vroege return kreeg een
    // FNLT-DEADLINE op een mijlpaal plotseling een FORWARD-ondergrens gelijk aan de deadline zelf,
    // en duwde de mijlpaal naar de deadline toe (of erover heen) i.p.v. 'm als bovengrens te laten
    // functioneren. Corpusloos gereproduceerd (`cases-hours.json`,
    // `z19-milestone-fnlt-no-forward-push`): een FNLT-deadline een week ná een ma 09:00-mijlpaal
    // duwde de mijlpaal daadwerkelijk naar de week erna. De 41 corpus-FNLT-bandeind-mijlpalen vingen
    // dit niet (hun relatie-instant valt daar toevallig samen met de FNLT-datum, dus de bug bleef
    // onzichtbaar in de fidelity-cijfers). Fix: de guard ÍN de SNET/MSO- en FNET/MFO-takken zetten,
    // zodat de FNLT/SNLT-tak (die toch al op `return null` uitkomt) 'm nooit ziet.
    const noSnap = isZeroDurationMilestone(task) && eng.isHourMode && c.date?.includes('T');
    if (c.type === 'SNET' || c.type === 'MSO') return noSnap ? d : this.snapOnOrAfter(eng, d);
    if (c.type === 'FNET' || c.type === 'MFO') {
      return this.startFromFinish(eng, noSnap ? d : this.snapOnOrAfter(eng, d), task);
    }
    return null;
  }

  /** Backward-bovengrens (late finish) van ÉÉN soft constraint (§4.1/§4.3), of null zonder backward-
   *  effect. FNLT/MFO ⇒ finish-bovengrens direct; SNLT/MSO ⇒ start-bovengrens vertaald naar de finish.
   *  Dag-modus byte-identiek (`prevWorkDay`/`addWorkingDaysSigned`); uur-modus via de instant-vinders. */
  private backwardBoundOf(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const d = this.constraintInstant(c, eng);
    if (!c || !d) return null;
    const preserveMilestoneInstant = this.p6XerOption(
      this.options.schedulingOptions?.p6PreserveZeroDurationConstraintInstants,
    )
      && isZeroDurationMilestone(task) && eng.isHourMode && c.date?.includes('T');
    const dW = preserveMilestoneInstant ? d : this.snapOnOrBefore(eng, d);
    if (c.type === 'FNLT' || c.type === 'MFO') return dW;
    if (c.type === 'SNLT' || c.type === 'MSO') return this.finishFromStart(eng, dW, task);
    return null;
  }

  /** Externe-link-lag in MINUTEN (uur-modus, §4.5): `lagMinutes` ⇒ bron; anders `lagDays × hoursPerDay ×
   *  60` (naakt getal = werkdagen — dezelfde conventie als de Sequence-lag, 2.8b §3.3). */
  private externalLagMinutes(link: ExternalLink, eng: CalendarEngine): number {
    if (typeof link.lagMinutes === 'number' && Number.isFinite(link.lagMinutes)) return link.lagMinutes;
    const days = typeof link.lagDays === 'number' && Number.isFinite(link.lagDays) ? link.lagDays : 0;
    return days * eng.hoursPerDay * 60;
  }
  /** Externe-link-lag in DAGEN (dag-modus). Afwezig ⇒ 0. */
  private externalLagDays(link: ExternalLink): number {
    return typeof link.lagDays === 'number' && Number.isFinite(link.lagDays) ? link.lagDays : 0;
  }

  /**
   * Forward-ondergrens (start-equivalent) van een externe PREDECESSOR-link (§4.5). De bevroren
   * `anchorDate` speelt de rol van de driving-datum van de externe taak (de ververs-actie schrijft
   * daar de source-`earlyFinish` bij FS/FF resp. `earlyStart` bij SS/SF in — §refreshExternalAnchors).
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
   * Backward-bovengrens (late finish) van een externe SUCCESSOR-link (§4.5). Spiegel van
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
   * Vroege-zijde constraints (fase 2.3, uitgebreid 2.9 §4.1-4.3). Een harde MSO/MFO-pin
   * OVERSCHRIJFT de voorganger-druk onvoorwaardelijk (barrière, §4.2) en registreert een
   * logica-schending zodra die druk (`rawMax`, of null bij een worteltaak) later valt dan de pin
   * — dán start de taak vóór z'n voorganger klaar is. Zonder pin stapelen de PRIMAIRE en
   * SECUNDAIRE forward-constraints (SNET/FNET/MSO/MFO) als max-ondergrenzen. `hard`/`constraint2`
   * afwezig ⇒ exact de bestaande soft-tak (byte-identiek: de 319 cases kennen ze nergens).
   */
  private applyForwardConstraints(task: Task, earlyStart: Date, rawMax: Date | null, eng: CalendarEngine): Date {
    const pin = this.hardPinStart(task, eng);
    if (pin) {
      // Fase 2.10 (P1): een gevloerde/berekende voorganger-EF (bv. een niet-afgemelde startmijlpaal
      // ná de data-date-vloer) mag geen valse schending melden op een taak die al een geregistreerd
      // feit heeft dat de pin AANTOONBAAR respecteert (§ gate hieronder). Een ECHTE schending —
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
    // Externe predecessor-links (§4.5): bevroren forward-ondergrenzen, gestapeld als extra max-terms
    // (net als een SNET/FNET). Afwezig ⇒ deze lus draait niet (byte-identiek).
    if (task.externalLinks && task.externalLinks.length > 0) {
      for (const link of task.externalLinks) {
        const bound = this.externalForwardBound(task, link, eng);
        if (bound && bound > es) es = bound;
      }
    }
    return es;
  }

  /**
   * Late-zijde grenzen (fase 2.3, uitgebreid 2.9 §4.1-4.3). Een harde MSO/MFO-pin zet de late
   * finish ONVOORWAARDELIJK op de gepinde waarde (override de successor-druk) ⇒ LS=ES/LF=EF ⇒
   * tf=0 op de pin, en een strengere late-constraint verder downstream propageert zijn negatieve
   * float NIET dóór de pin heen (P6-barrière, §4.2). Zonder pin stapelen de PRIMAIRE en SECUNDAIRE
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
    // Externe successor-links (§4.5): bevroren backward-bovengrenzen (net als een SNLT/FNLT).
    // Afwezig ⇒ deze lus draait niet (byte-identiek).
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
   * Handmatig gepland (Z9b, etappe "nul afwijkingen") — TWEE aparte uitsluitingen, niet één:
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
    for (const taskId of order) {
      const task = this.tasks.get(taskId);
      if (task?.constraint?.type !== 'ALAP') continue;
      if (task.manuallyScheduled) continue;   // Z9b, uitsluiting (1) — zie moduleheader hierboven.
      const early = earlyDates.get(taskId);
      const late = lateDates.get(taskId);
      if (!early || !late) continue;

      const cal = this.calendarFor(task);
      const succs = this.successors.get(taskId) || [];
      let ff = Infinity;
      if (succs.length === 0) {
        ff = this.signedWorkDays(early.ef, late.lf, cal);
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
        if (succTask.manuallyScheduled) continue;   // Z9b, uitsluiting (2) — zie moduleheader hierboven.
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
   *  telt in WERKuren van de VOORGANGER-kalender (§5.2), ELAPSEDTIME 24/7 in klokuren — exact de
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
    for (const { ef } of earlyDates.values()) {
      if (ef > projectEnd) projectEnd = ef;
    }
    if (this.options.schedulingOptions?.useProjectEndDateForFloat === true) {
      const configuredProjectEnd = parseInstant(this.options.projectEndDate ?? '');
      if (!isNaN(configuredProjectEnd.getTime())) {
        projectEnd = this.snapOnOrBefore(this.projectEngine, configuredProjectEnd);
      }
    }

    // Backward pass in reverse topological order
    const reversed = [...order].reverse();
    const preserveActualDates = this.dataDate !== null
      && this.options.schedulingOptions?.preserveActualDatesInBackwardPass === true;
    for (const taskId of reversed) {
      const task = this.tasks.get(taskId)!;
      const succs = this.successors.get(taskId) || [];

      // Brongebonden XER-beleid: een voltooide activiteit houdt haar geregistreerde actual-window
      // aan de late zijde. Dit leest uitsluitend toegestane actuals; opgeslagen XER early/late/
      // float-uitkomsten zijn bewust nooit solverinvoer. Niet-XER-projecten behouden hun bestaande
      // gedrag. De raw-XER-meetlat bewaakt deze beleidskeuze afzonderlijk van haar bronuitkomsten.
      if (preserveActualDates && task.time.actualFinish && task.time.completion >= 1) {
        const ed = earlyDates.get(taskId)!;
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      // Hammock (§4.4, normatief): een gevolg, geen oorzaak. GEEN backward-`min`-doorgifte; per
      // definitie `LS = ES` en `LF = EF` (⇒ tf=ff=0, kritiek-neutraal — geforceerd in computeResults).
      // De gewone min-combinatie wordt overgeslagen.
      if (task.isHammock) {
        const ed = earlyDates.get(taskId)!;
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      // Handmatig gepland (Z9a): VERPLICHTE early-return, zelfde vorm als de hammock-tak
      // hierboven — `LS = ES`, `LF = EF`. Zonder deze return zou de gewone backward-combinatie
      // hieronder (`applyBackwardBound` + `subDuration(predCal, lateFinish, task)`) een
      // `lateFinish`/`lateStart` herrekenen die NIETS met de gepinde `earlyStart`/`earlyFinish`
      // te maken heeft (`subDuration` trekt de TAAKDUUR van `lateFinish` af — voor een manual
      // taak is die afgeleide duur toevallig, geen contract) ⇒ spookfloat (mutatiebewijs: deze
      // return weghalen laat de `A`-cel in `msp-57-z9a-manual-pin-forward` ROOD, zie cases-msp-
      // pariteit.json — `A` erft dan `B`'s slack via de FS-backward-bound).
      //
      // Z9b (UITKOMST — deze paragraaf was hier eerder een vooruitwijzing naar nog te maken werk;
      // bijgewerkt naar het daadwerkelijke besluit): `totalFloat`/`freeFloat` worden in
      // `scheduleAnalysis.computeScheduleResults` DEFINITORISCH op 0 geforceerd voor een manual
      // taak (`ls=es`/`lf=ef` ligt hier vast door CONSTRUCTIE, niet door berekening — elke afwijking
      // van 0 die de generieke werkdag-tellende `signedFloat`-formule daarop teruggeeft is een
      // FORMULE-ARTEFACT, geen echte speling; gemeten op het `msp-56`-geval, A op zaterdag: tf=-1
      // zónder de forcing). `isCritical` wordt DAARENTEGEN BEWUST NIET geforceerd (géén
      // hammock-achtige `isHammock ? false : ...`-tak) — met tf op 0 geeft de gewone
      // `tf ≤ drempel`-regel vanzelf het juiste antwoord, en een manual taak is, anders dan een
      // hammock, een ECHT anker dat legitiem kritiek kan zijn. Zie `scheduleAnalysis.ts` voor de
      // forcing zelf en `msp-56`/`msp-57` in cases-msp-pariteit.json voor het mutatiebewijs
      // (resp. het niet-werkdag- en het werkdag-ankergeval).
      //
      // BACKWARDDRUK-BESLUIT (Z9b, expliciet vastgelegd — was hier eerder "Z9b-scope, nog niet
      // vooruitgegrepen"): ANDERS dan de hammock-tak hierboven krijgt een manual taak GEEN
      // opvolger-uitsluiting (`succTask.isHammock`-achtige skip in de lus hieronder) — BEHOUDEN
      // ZOALS HET IS, geen open punt. Motivering: de `ls`/`lf` die een manual taak via de lus
      // hieronder (`delayShiftedSuccResult`/`backwardConstraint`) aan haar EIGEN voorgangers
      // doorgeeft zijn NIET afgeleid (zoals bij een hammock, wiens LS/LF een kunstmatige "geen
      // kritiek-signaal"-waarde is) — ze zijn IDENTIEK aan haar eigen, rauw gelezen ES/EF (dezelfde
      // `ed.es`/`ed.ef` die twee regels hierboven worden teruggegeven). Een voorganger die via deze
      // route backward-druk van een manual opvolger ontvangt, ontvangt dus een ECHT, MSP-getrouw
      // finish-punt — precies het gedrag dat je van elke andere (auto) opvolger ook zou verwachten.
      // Dat kan in theorie negatieve float op een voorganger geven wanneer de manual opvolger
      // vroeger ligt dan de voorganger "zou willen" — dat is inhoudelijk correct MSP-gedrag (een
      // gepinde datum kan een reëel logicaprobleem blootleggen), geen motor-bug. Geen corpusgeval
      // gevonden dat dit raakt; bij een toekomstig tegenvoorbeeld wint dat corpusgeval.
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
      // tak activeren; alle andere formaten blijven byte-identiek.
      if (this.p6XerOption(this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow)
        && this.options.schedulingOptions?.useProjectEndDateForFloat !== true
        && succs.length === 0
        && (this.predecessors.get(taskId)?.length ?? 0) > 0
        && task.milestoneKind === 'FINISH' && isZeroDurationMilestone(task)) {
        const ed = earlyDates.get(taskId)!;
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      // Niets kan ná het projecteinde eindigen — dat is de bovengrens voor élke taak. Opvolger-
      // constraints kunnen de late finish alleen verder naar voren halen. (Voorheen kon een
      // Start-Start-opvolger een late finish ná het projecteinde opleveren, waardoor de
      // voorganger ten onrechte speling/niet-kritiek kreeg.)
      const predCal = this.calendarFor(task);
      let lateFinish = projectEnd;
      for (const seq of succs) {
        const succResult = results.get(seq.successorId);
        const succTask = this.tasks.get(seq.successorId);
        if (!succResult || !succTask) continue;
        // Een voltooide P6-opvolger beschrijft historie en mag de late finish van een nog open
        // voorganger niet door haar historische actual finish terugtrekken.
        if (preserveActualDates && succTask.time.actualFinish && succTask.time.completion >= 1) continue;
        // Een hammock is een gevolg, geen oorzaak (§4.4): hij legt GEEN backward-druk op zijn
        // voorgangers (drivers). Een strakke opvolger van de hammock kan zo nooit via de hammock heen
        // negatieve float op de start-/finish-driver leggen — de driver ziet alleen zijn eigen
        // (niet-hammock) opvolgers.
        if (succTask.isHammock) continue;
        // Z6-fixronde B2 (backward-DOORGIFTE-spiegel, Opus-review-probe P→A(delay)→S): `succTask`
        // heeft hier per constructie minstens één voorganger (`task`, via déze `seq`), dus de
        // ANKERREGEL hierboven in `forwardPass` heeft haar eigen `levelingDelay` al toegepast op
        // haar early start (mits ingesteld). `succResult.ls`/`.lf` zelf blijven daar bewust
        // ONAFHANKELIJK van (§`subDuration`s docblok, "geen-phantom-float" voor `succTask` zelf) —
        // maar DAARDOOR kent de late-zijde-druk die `succTask` op HAAR EIGEN voorganger (`task`,
        // hier) legt de vertraging nog niet: zonder correctie zou `task`s berekende `lateFinish`
        // een vaste `delay`-hoeveelheid speling tonen die ze feitelijk niet heeft (mutatiebewijs:
        // een P→A(delay)→S-keten gaf P.tf=`delay` i.p.v. 0, en P kwam ten onrechte niet-kritiek uit
        // — terwijl elke verschuiving van P via A's vaste delay 1-op-1 doorwerkt naar S en dus naar
        // `projectEnd`). Spiegelt exact hoe `shiftLagPred` een GEWONE relatie-lag al symmetrisch
        // forward/backward toepast — `levelingDelay` is hier gewoon een lag die NÁ de relatiewiskunde
        // wordt opgeteld i.p.v. erin verwerkt, dus de spiegel moet ervóór (backward) plaatsvinden.
        // EERLIJKE KANTTEKENING: dit repareert de doorgifte VIA de relatie-keten; het herstelt NIET
        // vanzelf een `projectEnd`-vertekening als de genivelleerde taak zelf (indirect, via een
        // langere keten) `projectEnd = max(EF)` bepaalt — dat blijft correct omdat `projectEnd`
        // hierboven al UIT `earlyDates` komt (dus al inclusief elke toegepaste delay), niet omdat
        // deze spiegel dat apart zou garanderen; de twee mechanismen werken hier los van elkaar
        // samen, niet omdat het één het ander bewijst.
        const succCal = this.calendarFor(succTask);
        const delayShiftedSuccResult = {
          ls: this.shiftByLevelingDelay(succCal, succTask, succResult.ls, -1),
          lf: this.shiftByLevelingDelay(succCal, succTask, succResult.lf, -1),
        };
        const constraintDate = backwardConstraint(
          this.relDeps, delayShiftedSuccResult, seq, task, succTask, predCal, succCal,
          this.p6ZeroDurationUsesFinishBoundary(succTask, succCal),
        );
        if (constraintDate < lateFinish) {
          lateFinish = constraintDate;
        }
      }

      // Late-zijde datum-constraints + deadline (fase 2.3) als extra bovengrens.
      lateFinish = this.applyBackwardBound(task, lateFinish, predCal);
      if (this.p6ZeroDurationActivityUsesBoundaryPair(task, predCal)) {
        // Een opvolgergrens kan als volgende bandSTART binnenkomen. P6 toont voor deze
        // geïnverteerde nulduurvorm de complementaire finishrand; op een echt bandeinde is deze
        // operatie idempotent.
        lateFinish = predCal.prevWorkInstant(lateFinish);
      }

      const useP6RemainingProgress = this.p6XerOption(
        this.options.schedulingOptions?.p6UseRemainingStartForProgress,
      )
        && task.time.actualStart !== undefined && task.time.completion > 0 && task.time.completion < 1;
      const computedLateStart = useP6RemainingProgress
        ? this.subRemainingDuration(predCal, lateFinish, task)
        : this.subDuration(predCal, lateFinish, task, earlyDates.get(taskId)?.es ?? null);
      // Bij P6-voortgang is een geregistreerde actual start ook de getoonde LS; LF blijft uit het
      // resterende netwerk volgen. Zonder bronvlag blijft de berekende late start leidend.
      let lateStart = preserveActualDates && task.time.actualStart && task.time.completion < 1
          && !this.p6XerOption(this.options.schedulingOptions?.p6UseRemainingStartForProgress)
        ? new Date(earlyDates.get(taskId)!.es.getTime())
        : computedLateStart;
      if (this.p6XerOption(this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow)
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

      results.set(taskId, { ls: lateStart, lf: lateFinish });
    }

    return results;
  }

}
