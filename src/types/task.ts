import type { CustomFieldValue } from '@/types/structure';
export type { CustomTaskType } from '@/types/taskType';

export type TaskType =
  | 'CONSTRUCTION'
  | 'INSTALLATION'
  | 'DEMOLITION'
  | 'LOGISTIC'
  | 'ATTENDANCE'
  | 'MOVE'
  | 'RENOVATION'
  | 'MAINTENANCE'
  | 'USERDEFINED';

/**
 * Alle geldige `TaskType`-waarden als runtime-lijst voor de import-readers (IFC/CSV).
 * `satisfies Record<TaskType, true>` dwingt af dat de tabel EXACT de union dekt, zodat de lijst niet
 * stil kan verouderen. De readers houden hun eigen normalisatie (IFC strip punten, CSV uppercase) en
 * gebruiken alleen deze verzameling voor de geldigheidscheck.
 */
const TASK_TYPE_TABLE = {
  CONSTRUCTION: true,
  INSTALLATION: true,
  DEMOLITION: true,
  LOGISTIC: true,
  ATTENDANCE: true,
  MOVE: true,
  RENOVATION: true,
  MAINTENANCE: true,
  USERDEFINED: true,
} satisfies Record<TaskType, true>;

export const TASK_TYPES = Object.keys(TASK_TYPE_TABLE) as TaskType[];

export type TaskStatus = 'NOT_STARTED' | 'STARTED' | 'COMPLETED';

/**
 * Datum-constraints, P6-soft-semantiek: een constraint breekt de netwerklogica niet — vroege-zijde
 * types (SNET/FNET) zijn ondergrenzen in de forward pass, late-zijde types (SNLT/FNLT) bovengrenzen in
 * de backward pass; overtreding uit zich als negatieve float, niet als verschoven balken. MSO/MFO
 * werken als P6's "Start On"/"Finish On": onder- én bovengrens tegelijk. De logica-brekende harde pin
 * is opt-in via `TaskConstraint.hard`. ALAP schuift de vroege datums op tot de vrije speling 0 is
 * (onder conventie C14 anders, zie `SchedulingOptions.p6AlapPositionedFromSuccessors`).
 */
export type ConstraintType = 'ASAP' | 'ALAP' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO';

export interface TaskConstraint {
  type: ConstraintType;
  /** Vereist voor alle types behalve ASAP/ALAP; wordt bij toepassing op een werkdag gesnapt. */
  date?: string;
  /** Logica-brekende Mandatory-pin; alleen zinvol voor MSO/MFO. Afwezig/false ⇒ P6-soft "Start On"/
   *  "Finish On". true ⇒ P6 Mandatory Start/Finish: pint ES én LF (MSO) resp. EF én LS (MFO) op de
   *  datum, overschrijft de logica, houdt TF=0 op de pin en drijft negatieve float upstream. */
  hard?: boolean;
}

/**
 * Externe (cross-project) dependency. GEEN live multi-document-solve: de link rekent altijd op de
 * bevroren `anchorDate` (P6 External Dates). `sourceMissing` is puur een UI-/versheidssignaal; het
 * rekengedrag hangt er niet van af.
 */
export interface ExternalLink {
  id: string;
  direction: 'predecessor' | 'successor';   // is de externe taak mijn voorganger of opvolger?
  relType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number;
  lagMinutes?: number;                       // zelfde eenheid-conventie als Sequence
  /** Bevroren driving-datum van de andere kant (P6 External Dates). */
  anchorDate: string;                        // date-only (dag) of datetime (uur)
  sourceRef: { projectId: string; projectName?: string; taskId: string; taskName?: string; filePath?: string };
  /** true ⇒ bronproject niet beschikbaar; de link rekent op de gecachte anchorDate (ghost). */
  sourceMissing: boolean;
}

export type DurationType = 'WORKTIME' | 'ELAPSEDTIME';

/**
 * De door de gebruiker gekozen, blijvende eenheid van een taakduur.
 *
 * INVARIANT: bij `days` is `scheduleDuration` de enige invoerbron; bij `hours` is
 * `durationMinutes` de enige invoerbron. Een kalender bepaalt uitsluitend waar die hoeveelheid
 * past en mag deze identiteit nooit afleiden, converteren of overschrijven.
 */
export type TaskDurationUnit = 'days' | 'hours';

/**
 * Eén werkonderbreking in een gesplitste taak (MS Project: "split"). De CPM wandelt de gaten via
 * `splitTotalSpanMinutes` (`duration.ts`); elk gat is een periode waarin niet gewerkt wordt, daarna
 * hervat het restwerk.
 *
 * OFFSET-GEBASEERD, in MINUTEN, maar NIET op de "zuivere werkduur"-as van `TaskTime.durationMinutes`
 * (die telt geen gaten). `afterMinutes`/`gapMinutes` staan op MPXJ/MSP's cumulatieve
 * `elapsedWorkMinutes`-as (`mppTimephased.ts`'s `TimephasedWorkPeriod`), die ELKE periode meetelt,
 * ook een gat (`workMinutes===0`). Vanaf het tweede gat incorporeert `afterMinutes` dus de voorgaande
 * gaten. VALKUIL: vergelijk `afterMinutes` nooit met een zuivere-werkduurgetal
 * (`durationMinutesOf`/`scheduleDuration`) en klem het niet op een `[0, duur)`-venster — dat
 * trunceert legitieme gaten. Het as-wandelalgoritme staat in de moduleheader van `duration.ts`.
 *
 * Offsets in plaats van absolute datumparen: shift-invariant (verplaatsen of herberekenen neemt de
 * gaten vanzelf mee), geen invoer/uitvoer-dubbelrol (de absolute segmenten die renderer en print
 * tekenen zijn AFGELEID uit `earlyStart` + een kalenderwandeling), en `moveProject.ts` kan ze als
 * "n/a" markeren (net als `levelingDelay`).
 */
export interface TaskSplitGap {
  afterMinutes: number;
  gapMinutes: number;
  /** Herkomst van het gat. AFWEZIG = brondata: een split uit een import (`.mpp`:
   *  `deriveSplitGapsForTasks`); de nivelleerder raakt die NOOIT aan. `'leveling'` = door de verdeler
   *  ingevoegde pauzedag: idempotent herschreven bij een nieuwe nivellering, gewist door "nivellering
   *  wissen"/"alles terugdraaien" (`clearLevelingGaps`, `taskDefaults.ts`) en zodra de tijdbasis van de
   *  taak wijzigt (een gat op een verouderde as is ruis). `'user'` = door de gebruiker gemaakt of
   *  bewerkt (eigenschappenpaneel/Gantt/MCP): nooit aangeraakt door de nivelleerder of "nivellering
   *  wissen"; `rescaleSplitGaps` snapt zo'n gat bij een duurwijziging op de eenheid van de taak (hele
   *  werkdag, of een uur bij een urentaak). */
  source?: 'leveling' | 'user';
}

/**
 * Eén rauwe periode uit een timephased-contour (zie `Task.timephasedContours`). `afterMinutes`/`minutes`
 * liggen op DEZELFDE cumulatieve-werkminuten-as als `TaskSplitGap` (taak-as, niet toewijzings-as);
 * `minutes` is de periodelengte op die as. `workMinutes` kan 0 zijn: een periode zonder werk, het gat
 * dat `deriveSplitGapsFromPeriods` als split herkent. `kind`: verricht werk (`'actual'`, MPXJ
 * `getCompleteWork`) of resterend/gepland werk (`'remaining'`, MPXJ `getPlannedWork`).
 */
export interface TimephasedContourPeriod {
  afterMinutes: number;
  minutes: number;
  workMinutes: number;
  kind: 'actual' | 'remaining';
}

/** Alle rauwe contourperiodes van ÉÉN toewijzing van de taak (zie `Task.timephasedContours`). */
export interface TaskTimephasedContour {
  /** MSP's resource-uniqueId (`AssignmentField.RESOURCE_UNIQUE_ID`): puur herkomst, geen live
   *  resourceverwijzing (de toewijzing kan in het app-model allang gewijzigd of weg zijn; de rauwe
   *  periode blijft staan). `null` wanneer de toewijzing geen (vindbare) resource droeg. */
  resourceUid: number | null;
  /** Het OPS-`Resource.id` van de toewijzing waar deze contour bij hoort: de sleutel waarmee
   *  `matchContoursToAssignments` (`contourEngine.ts`) een contour aan een `ResourceAssignment`
   *  koppelt (zelfde resource, in volgorde, elke contour hooguit één keer). Elke lezer zet het.
   *  Afwezig (oudere bestanden) ⇒ alleen bij precies één contour én één toewijzing op de taak
   *  gekoppeld; anders blijft de contour puur data. */
  resourceId?: string;
  periods: TimephasedContourPeriod[];
}

/**
 * MSP's eigen "Task Type" (Fixed Units/Fixed Duration/Fixed Work — `TaskField.TYPE`). NIET te
 * verwarren met `Task.taskType` (de OPS-domeinclassificatie CONSTRUCTION/INSTALLATION/…). Bewaard
 * zodat een .mpp-import hem niet weggooit; de CPM leest het niet. Het bewerkgedrag loopt via
 * `Task.workRule`, dat bij import uit dit veld (+ `effortDriven`) wordt afgeleid.
 */
export type MspTaskType = 'FIXED_UNITS' | 'FIXED_DURATION' | 'FIXED_WORK';

/** De neutrale werkregel, zie `@/types/workRule`. */
export type { WorkRule } from '@/types/workRule';

/**
 * P6's eigen "Duration Type" (XER `TASK.duration_type`: hoe P6 duur/eenheden/snelheid aan elkaar
 * koppelt bij een bewerking). Vier canonieke tokens: Fixed Duration & Units, Fixed Duration &
 * Units/Time, Fixed Units/Time, Fixed Units. De XER-lezer matcht corpusvarianten case-insensitief
 * tegen deze lijst en meldt — nooit stil — een token dat ook ná case-fold onbekend blijft. NIET te
 * verwarren met `MspTaskType`: een ander bronformaat met een andere waardenverzameling.
 */
export type P6DurationType = 'DT_FixedDrtn' | 'DT_FixedDUR2' | 'DT_FixedRate' | 'DT_FixedQty';

/** P6/XER `complete_pct_type`: bronsoort van voortgang en restduur. */
export type P6CompletePctType = 'CP_Drtn' | 'CP_Phys' | 'CP_Units';

/**
 * P6's eigen "Activity Type" (XER `TASK.task_type`): Task Dependent, Resource Dependent, Level of
 * Effort, Start Milestone, Finish Milestone, WBS Summary. Zelfde case-insensitieve matching als
 * `P6DurationType`.
 */
export type P6ActivityType = 'TT_Task' | 'TT_Rsrc' | 'TT_LOE' | 'TT_Mile' | 'TT_FinMile' | 'TT_WBS';

/**
 * Soort mijlpaal (P6 Start/Finish Milestone). Dag-granulair grensmodel: START ankert op een dagbegin,
 * FINISH op een dageinde (einde werkdag F = begin eerstvolgende werkdag). undefined = automatisch:
 * het anker volgt de bindende relatiezijde (FS/SS → start, FF/SF → finish).
 */
export type MilestoneKind = 'START' | 'FINISH';

export interface TaskTime {
  durationType: DurationType;
  durationUnit: TaskDurationUnit;
  /** Canonieke invoerbron wanneer `durationUnit === 'days'`: gehele werkbare kalenderdagen. */
  scheduleDuration: number;
  /** Canonieke invoerbron wanneer `durationUnit === 'hours'`: exacte werkminuten. Oude data zonder
   *  `durationUnit` migreert deterministisch naar uren zodra dit veld aanwezig is; minuutprecisie
   *  uit imports blijft daarbij ongewijzigd. */
  durationMinutes?: number;
  scheduleStart: string;    // ISO 8601 — date-only in dag-modus, datetime in uur-modus
  /** ISO 8601 — date-only in dag-modus, datetime in uur-modus. INVOER ("Gepland einde"): de solve schrijft
   *  hem nooit terug. Bij een niet-gestarte urentaak houdt de invoerkant hem gelijk aan start + duur
   *  op de taakkalender (`reconcileHourInputFinish`, utils/taskDefaults.ts); lezers zetten de bronwaarde. */
  scheduleFinish: string;
  /** MSP's opgeslagen hervattingsinstant van een lopende taak (`.mpp`-veld-id 99, `TaskField.RESUME`).
   *  Brondata zoals `scheduleStart`/`scheduleFinish`, geen afgeleide waarde (vandaar de rol
   *  `TaskTimeInput`). `CPMSolver.ts` gebruikt het voor een aantoonbaar out-of-sequence
   *  FINISH_START-opvolger (`isOutOfSequenceFsPredecessor`): `finish = addWork(resume, remaining)` op
   *  de eigen taakkalender. Bij een P6-taak alleen via `p6SuspendResume`. Afwezig ⇒ het
   *  RETAINED_LOGIC/`resumeFromActualElapsed`-pad. */
  resume?: string;
  /** Tegenhanger van `resume` (`.mpp`-veld-id 100, `TaskField.STOP`; P6 suspend): de grens van het
   *  reeds afgewerkte deel. De solver rekent niet met de waarde; `hasValidP6SuspendResume` gebruikt
   *  hem alleen om de P6-suspend/resume-route te poorten. */
  stop?: string;

  // CPM-computed
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  freeFloat: number;   // work days (fractioneel in uur-modus)
  totalFloat: number;  // work days (fractioneel in uur-modus)
  isCritical: boolean;
  /** Interfererende speling = totalFloat − freeFloat (getekend, fractioneel in uur-modus). Afwezig
   *  zolang er niet is doorgerekend. */
  interferingFloat?: number;
  /** Near-critical-markering. Alleen geschreven bij een ingestelde drempel. */
  isNearCritical?: boolean;
  /** Float-path-nummer (1 = meest kritiek). Alleen geschreven bij floatPaths. */
  floatPath?: number;

  // Tracking
  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  /** Restduur in werkdagen, in de vorm van `scheduleDuration`: hele dagen bij een dagtaak, een
   *  onafgeronde fractie (afgeleid van `remainingMinutes`) bij een urentaak (`applyRemainingDuration`). */
  remainingTime?: number;
  /** Resterend werk in integer MINUTEN: de restduur van een urentaak, in de vorm van
   *  `durationMinutes`. */
  remainingMinutes?: number;
  completion: number; // 0.0 - 1.0
}

/**
 * TYPE-ONLY rolsplitsing van `TaskTime`: welke velden een consument mag SCHRIJVEN en welke `runCPM`
 * OVERSCHRIJFT. `Task.time` blijft de volledige `TaskTime`. Elk veld hoort in PRECIES één rol; de
 * compile-assert onderaan dwingt volledige en disjuncte dekking af, zodat een nieuw veld
 * gecategoriseerd moet worden.
 */

/** INVOER — door de gebruiker/importers geschreven. `runCPM` raakt deze normaliter niet aan, MAAR
 *  normaliseert in UUR-modus de VORM van `scheduleStart` (datetime, zelfde instant — `applyCpmResult`)
 *  en overschrijft de passende afgeleide duurbron (`scheduleDuration` of `durationMinutes`) voor
 *  HAMMOCK-taken (afgeleide span, `CPMSolver`). `durationType` blijft puur invoer, en `scheduleFinish`
 *  ook: de solve schrijft hem nooit terug (anders leest de volgende berekening onder een P6-conventie
 *  de uitvoer van de vorige als gepland bronvenster). Bij een urentaak houdt de INVOERKANT hem
 *  coherent met start + duur (`reconcileHourInputFinish` in utils/taskDefaults.ts). */
export type TaskTimeInput = Pick<
  TaskTime,
  'durationType' | 'durationUnit' | 'scheduleDuration' | 'durationMinutes' | 'scheduleStart' | 'scheduleFinish'
  | 'resume' | 'stop'
>;

/** CPM-COMPUTED — geschreven door `runCPM` (CPMSolver). Normaliter niet handmatig muteren; de
 *  legitieme uitzonderingen zijn restore-paden (IFC-import herstelt deze velden, benchmark-runner). */
export type TaskTimeComputed = Pick<
  TaskTime,
  'earlyStart' | 'earlyFinish' | 'lateStart' | 'lateFinish' | 'freeFloat' | 'totalFloat' | 'isCritical'
>;

/** ANALYSE — afgeleiden bovenop de CPM-output. `interferingFloat` (= tf − ff) wordt
 *  ALTIJD elke `runCPM` (her)berekend en teruggeschreven; `isNearCritical`/`floatPath` alleen wanneer
 *  de bijbehorende optie/drempel draait (anders gewist, om stale markering te voorkomen). */
export type TaskTimeAnalysis = Pick<
  TaskTime,
  'interferingFloat' | 'isNearCritical' | 'floatPath'
>;

/** TRACKING — voortgang/actuals; door de gebruiker geschreven, niet door de solver. */
export type TaskTimeTracking = Pick<
  TaskTime,
  'actualStart' | 'actualFinish' | 'actualDuration' | 'remainingTime' | 'remainingMinutes' | 'completion'
>;

// --- Compile-assert: de vier rollen vormen een EXACTE partitie van `keyof TaskTime` ---------------
// VOLLEDIGHEID: een niet-gecategoriseerd veld maakt `_UncategorizedTaskTimeField` ≠ `never` → tsc-fout.
// DISJUNCTHEID: een veld in twee rollen maakt `_OverlappingRole` ≠ `never` → tsc-fout.
// Een niet-bestaande sleutel faalt al in de Pick zelf.
type _TaskTimeRoleKeys =
  | keyof TaskTimeInput
  | keyof TaskTimeComputed
  | keyof TaskTimeAnalysis
  | keyof TaskTimeTracking;

type _UncategorizedTaskTimeField = Exclude<keyof TaskTime, _TaskTimeRoleKeys>;

type _OverlappingRole =
  | (keyof TaskTimeInput & keyof TaskTimeComputed)
  | (keyof TaskTimeInput & keyof TaskTimeAnalysis)
  | (keyof TaskTimeInput & keyof TaskTimeTracking)
  | (keyof TaskTimeComputed & keyof TaskTimeAnalysis)
  | (keyof TaskTimeComputed & keyof TaskTimeTracking)
  | (keyof TaskTimeAnalysis & keyof TaskTimeTracking);

// `[T] extends [never]` is de robuuste "is exact never"-check (geen distributie over unies).
type _Expect<T extends true> = T;
type _IsNever<T> = [T] extends [never] ? true : false;
// Waarde-vorm + `void` zodat `noUnusedLocals` ze niet als dood markeert; ze minificeren weg.
const _assertTaskTimeComplete: _Expect<_IsNever<_UncategorizedTaskTimeField>> = true;
const _assertTaskTimeDisjoint: _Expect<_IsNever<_OverlappingRole>> = true;
void _assertTaskTimeComplete;
void _assertTaskTimeDisjoint;

export interface Task {
  id: string;
  name: string;
  description: string;
  wbsCode: string;
  taskType: TaskType;
  /** Alleen bij `USERDEFINED`: stabiele verwijzing naar de projectcatalogus. Ontbreekt bij
   * oudere IFC-bestanden die USERDEFINED zonder OPS-definitie gebruikten. */
  customTaskTypeId?: string;
  status: TaskStatus;
  isMilestone: boolean;
  /** Alleen relevant bij isMilestone; undefined = automatisch (zie MilestoneKind). */
  milestoneKind?: MilestoneKind;
  /** Verplichte (contractuele) mijlpaal — inspectie-/keurings-/opleverpunt. Markering
   *  voor rapportage & Gantt; datumbewaking loopt via constraint/deadline. */
  mandatory?: boolean;
  /** Nivelleerprioriteit (MSP-conventie, analoog aan P6 "Activity Priority"): 0–1000, default 500;
   *  stuurt de nivelleervolgorde. 1000 = "Do Not Level" (vastgepind, de nivelleerder verschuift de
   *  taak nooit). */
  priority: number;
  /** Vertraging in werkdagen t.o.v. de precedence-feasible early start (de ES die de forward
   *  pass berekent nadat óók de voorgangers hun levelingDelay hebben gekregen — NIET t.o.v. de
   *  oorspronkelijke CPM-ES, dat zou voorgangersverschuivingen dubbel tellen). Gezet door de
   *  nivelleerder (`ResourceLeveler.ts`). undefined = geen nivellering toegepast.
   *  "Nivellering wissen" zet dit overal terug naar undefined. */
  levelingDelay?: number;
  /** Subdag-precisie voor `levelingDelay`: MSP levert de nivelleervertraging in tienden van een
   *  minuut, wat hele werkdagen niet exact dragen. Zoals `durationMinutes` naast `scheduleDuration`:
   *  AANWEZIG ⇒ bron van waarheid (`CPMSolver`), AFWEZIG ⇒ `levelingDelay` (werkdagen). */
  levelingDelayMinutes?: number;
  /** MSP's `LevelingDelayFormat` ELAPSED (kloktijd i.p.v. werktijd) voor `levelingDelayMinutes`.
   *  Afwezig ⇒ WORKTIME. Alleen betekenisvol wanneer `levelingDelayMinutes` ook gezet is. */
  levelingDelayElapsed?: boolean;
  /** Werkonderbrekingen (MS Project "split"); lees de as-definitie in `TaskSplitGap` vóór gebruik.
   *  `.mpp`: afgeleid uit de timephased-werksegmenten (`deriveSplitGapsForTasks`). Round-tript via
   *  `OPS_TaskSplits` (`ifcPsets.ts`). De CPM wandelt ze in `addDurationChecked`/`subDuration`/
   *  `finishFromStart`/`startFromFinish` en de restwerktak (`splitTotalSpanMinutes`); de renderer
   *  tekent een onderbroken balk. Afwezig ⇒ geen splits. */
  splitGaps?: TaskSplitGap[];
  /** Laag 3 van de timephased-beslistabel (`.mpp`): het MAXIMUM van `AssignmentField.FINISH` over de
   *  toewijzingen die ≥1 echte gedecodeerde timephased-periode droegen — MSP's eigen berekende
   *  antwoord. Alleen op niet-gestarte taken (`time.completion === 0`); voltooide en lopende taken
   *  plannen op hun actuals-/resume-paden. `CPMSolver.forwardPass` past het toe op dezelfde plek als
   *  `sfFinishFloor` en overschrijft de duurgebaseerde finish; nooit bij een harde MFO/MSO-pin, alleen
   *  in uur-modus. ISO-instant, minuutprecisie. Nooit samen met `timephasedDurationWalks` (laag 4).
   *  Round-tript via `OPS_TimephasedWindow` (`ifcPsets.ts`). AFGELEIDE sturing: een inhoudelijke
   *  bewerking (duur/datums/kalender/toewijzingen) wist het (`clearTimephasedWindow`,
   *  `taskDefaults.ts`); de rauwe bron in `timephasedContours` blijft staan. */
  timephasedFinishFloor?: string;
  /** Rauw startanker voor laag 3 en 4: het MINIMUM van `AssignmentField.START` over de
   *  laag-3-toewijzingen, resp. het vroegste `anchor` van `timephasedDurationWalks`. Alleen gebruikt
   *  voor een taak ZONDER voorganger (`CPMSolver.forwardPass`) wier `time.scheduleStart` buiten de
   *  taakkalenderband ligt maar binnen de eigen resourcekalender van de toewijzing (bv. een
   *  nachtploeg om 23:00): MSP snapt zo'n anker niet. Zelfde round-trip en wissen als
   *  `timephasedFinishFloor`. */
  timephasedStartAnchor?: string;
  /** Laag 4 van de timephased-beslistabel (`.mpp`): taken met een VLAK timephased-record (geen echte
   *  periode) waarvan een toewijzing een niet-standaard resourcekalender draagt. Anders dan laag 3 een
   *  VERSE herberekening: `CPMSolver.ts` wandelt per item door `resourceCalendarId` (gedeelde
   *  kalenderbibliotheek, `resolveCalendar`) vanaf `anchor` en neemt het MAXIMUM ("de langste toewijzing
   *  bepaalt de finish"). Nooit samen met `timephasedFinishFloor`.
   *
   *  `workMinutes` per item: ontbreekt het, dan wandelt het item `task.time.durationMinutes` (volgt
   *  bewerkingen vanzelf). Bij meerdere gelijktijdige toewijzingen draagt elk item zijn eigen
   *  werkaandeel (`decodeAssignmentWorkMinutes`, `mppReader.ts`) — de volle taakduur per toewijzing gaf
   *  een ~2× te late finish. De garantie zit op de producerende tak in `mppReader.ts`, niet op de
   *  lengte: ook een lijst van lengte 1 kan `workMinutes` dragen. Zo'n BEVROREN waarde volgt een latere
   *  duur-/datum-/kalenderwijziging niet, dus wist `clearTimephasedDurationWalks` (`taskDefaults.ts`) de
   *  lijst zodra een item `workMinutes` draagt; de taak valt dan terug op laag 5. `clearTimephasedWindow`
   *  raakt deze lijst niet. Round-tript via `OPS_TimephasedWindow` (`ifcPsets.ts`). */
  timephasedDurationWalks?: { anchor: string; resourceCalendarId: string; workMinutes?: number }[];
  /** RAUWE timephased-contourperiodes per toewijzing: er gaat nooit stilzwijgend broninformatie
   *  verloren, ook niet ná bewerken. De bron onder de afgeleide sturing `splitGaps`/
   *  `timephasedFinishFloor`/`timephasedStartAnchor`; dit veld wordt door geen bewerking gewist. Eén
   *  entry per toewijzing met een echte dagverdeling (vlakke records tellen niet, zelfde filter als
   *  `deriveSplitGapsForTasks`). Periodes liggen op de as van `TaskSplitGap`. De CPM leest dit niet;
   *  wél de lastberekening: `assignmentDayUnits` (`ResourceLoad.ts`) verdeelt per toewijzing volgens
   *  haar contour (`matchContoursToAssignments` op `resourceId`) voor histogram, overallocatie,
   *  nivelleerder en bezettingsoverzicht; de curve-formule is de terugval. Een duurwijziging herschaalt
   *  het proportioneel (`rescaleContourForDuration`). Round-tript via `OPS_TimephasedContours`
   *  (`ifcPsets.ts`), en native via MSPDI `<TimephasedData>` en P6
   *  `<PlannedCurve>`/`<RemainingCurve>`/`<ActualCurve>`. */
  timephasedContours?: TaskTimephasedContour[];
  /** Handmatig geplande taak (MS Project "Manually Scheduled"): de solver neemt
   *  `time.scheduleStart`/`scheduleFinish` RAUW over — geen kalendersnap, geen relatiedruk, geen
   *  constraint-afdwinging (ook niet bij een harde pin); opvolgers rekenen gewoon door
   *  (`CPMSolver.forwardPass`). Afwezig/false ⇒ normale, automatisch geplande taak. */
  manuallyScheduled?: boolean;
  /** MSP's Task Type bij .mpp-import (zie `MspTaskType`); de CPM leest het niet. Afwezig ⇒ onbekend,
   *  NIET hetzelfde als "FIXED_UNITS" (MSP's stille default voor een nieuwe taak). Round-tript via
   *  `OPS_MspTaskType` (`ifcPsets.ts`). */
  mspTaskType?: MspTaskType;
  /** MSP's "Effort Driven"-vlag bij .mpp-import (`TaskField.EFFORT_DRIVEN`); de CPM leest het niet.
   *  Round-tript via `OPS_MspTaskType` (`ifcPsets.ts`), samen met `mspTaskType`. */
  effortDriven?: boolean;
  /** De WERKREGEL van deze taak: welke hoeken van werk = duur × inzet beschermd zijn bij een
   *  bewerking (`WorkRule`, neutraal tussen MSP en P6). Afwezig ⇒ `Project.defaultWorkRule`, en als
   *  die ook ontbreekt FIXED_DURATION_RATE. Bij import AFGELEID uit `mspTaskType`+`effortDriven` resp.
   *  het P6-duurtype en apart bewaard, zodat een latere typewissel de herkomst niet vernietigt. De CPM
   *  leest dit niet; alleen de bewerkingslaag (o.a. `src/engine/work/`). Round-tript via `OPS_WorkRule`
   *  (`ifcPsets.ts`). */
  workRule?: import('@/types/workRule').WorkRule;
  /** P6's Duration Type bij .xer-import (zie `P6DurationType`), een eigen veld naast `mspTaskType`:
   *  de formaten kennen elk een ander taaktypeconcept. Herkomst-datagate: de motor leest het alleen in
   *  de P6-conventiepoorten (bv. `p6CompletedTargetWindow.ts`; gepind door `verify:conventions`). Afwezig ⇒
   *  geen .xer-herkomst of onbekend token. */
  p6DurationType?: P6DurationType;
  /** P6's Activity Type bij .xer-import (zie `P6ActivityType`): de rauwe herkomst. De XER-lezer leidt
   *  `isMilestone`/`isHammock` eruit af (TT_Mile/TT_FinMile resp. TT_LOE). Herkomst-datagate zoals
   *  `p6DurationType`. Afwezig ⇒ geen .xer-herkomst. */
  p6ActivityType?: P6ActivityType;
  /** `task_id` is slechts uniek binnen dit P6-project; beide bronidentiteiten blijven bewaard. */
  p6ProjectId?: string;
  p6TaskId?: string;
  /**
   * Fail-closed XER-provenance: de bron-TASK droeg werkelijk zowel `target_start_date` als
   * `target_end_date`. Dit bewaart uitsluitend de aanwezigheid van broninvoer — nooit P6's
   * opgeslagen early/late- of floatuitkomst — zodat een readerfallback of later berekende
   * `scheduleStart` niet als bronfeit kan worden verward.
   */
  p6ExplicitTargetWindow?: boolean;
  /** CP_Phys/CP_Units gebruiken hun bronrestduur en nooit percentage-afleiding in de solver. */
  p6CompletePctType?: P6CompletePctType;
  /** XER `expect_end_date`; alleen actief met `SchedulingOptions.useExpectedFinishDates`. */
  p6ExpectedFinish?: string;
  /** P6-specifieke opt-in voor `time.resume`/`time.stop`. De XER-lezer zet dit
   *  uitsluitend bij een volledig, chronologisch suspend/resume-paar; losse of
   *  omgekeerde brondata blijft behouden maar activeert nooit de P6-route.
   *  Default/afwezig behoudt de bestaande MSP-conventie. */
  p6SuspendResume?: boolean;
  /** Expliciete WBS-/samenvattingsidentiteit. `true` betekent dat de taak ook zonder kinderen een
   *  samenvatting blijft (bijvoorbeeld een lege PROJWBS-rij uit P6). `false` verwijdert alleen die
   *  expliciete marker; taken met kinderen blijven samenvatting. Afwezig houdt bij updates de
   *  bestaande waarde ongemoeid. Gebruik `isSummaryTask`/`isLeafTask` voor de semantiek. */
  isSummary?: boolean;
  parentId: string | null; // WBS parent
  childIds: string[];      // WBS children
  time: TaskTime;
  resourceIds: string[];
  color?: string;
  /** Activity-code-toewijzingen: codetype-id → waarde-id (max één waarde per type, P6-invariant). */
  activityCodes?: Record<string, string>;
  /** Custom-field-waarden: velddefinitie-id → waarde (getypeerd volgens CustomFieldDef.type). */
  customFields?: Record<string, CustomFieldValue>;
  /** Datum-constraint; afwezig = ASAP. PRIMAIR. */
  constraint?: TaskConstraint;
  /** SECUNDAIRE constraint (P6). Altijd soft (hard is verboden op secundair). Combinatieregel (P6):
   *  niet toegestaan als de primaire Start On/Finish On/Mandatory is; verder één forward-type + één
   *  backward-type die elkaar niet tegenspreken. Afwezig ⇒ geen tweede grens. */
  constraint2?: TaskConstraint;
  /** Hammock/LOE. Afwezig/false ⇒ gewone taak. true ⇒ de duur wordt AFGELEID (span tussen
   *  start-driver en finish-driver); scheduleDuration/durationMinutes worden als invoer genegeerd en
   *  overschreven met de span. Nooit kritiek (isCritical altijd false). */
  isHammock?: boolean;
  /** Externe (cross-project) dependencies. Afwezig ⇒ geen. */
  externalLinks?: ExternalLink[];
  /** Zachte deadline (MSP-model): begrenst alleen de late finish — balken bewegen nooit;
   *  overschrijding (earlyFinish > deadline) geeft negatieve float + waarschuwing. */
  deadline?: string;
  /** Id in de kalenderbibliotheek; undefined = projectkalender (project.calendarId). Symmetrisch met
   *  Resource.calendarId. Bepaalt de kalender waarin de DUUR en de constraints van deze taak rekenen. */
  calendarId?: string;
  /** Vrije aantekeningen/checklist per taak. Afwezig ⇒ geen. Mutaties via
   *  `updateTask(taskId, { notes })`; er zijn geen eigen store-acties. */
  notes?: { id: string; text: string; done: boolean }[];
}

/** Itemtypes van de inline arrays/objecten op `Task`. De aliassen veranderen de opgeslagen vorm
 * niet, maar maken compile-time velddekking buiten dit bestand mogelijk. */
export type TaskNote = NonNullable<Task['notes']>[number];
export type TimephasedDurationWalk = NonNullable<Task['timephasedDurationWalks']>[number];
export type ExternalSourceRef = ExternalLink['sourceRef'];

