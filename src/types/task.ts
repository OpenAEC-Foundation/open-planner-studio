import type { CustomFieldValue } from '@/types/structure';

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
 * Alle geldige `TaskType`-waarden als runtime-lijst voor de import-readers (IFC/CSV) — F5-g.
 * `satisfies Record<TaskType, true>` dwingt af dat de tabel EXACT de union dekt: een nieuw
 * TaskType-lid zonder sleutel geeft een compileerfout, een sleutel die geen lid is ook. Zo kan de
 * lijst niet stil verouderen. De readers houden hun eigen normalisatie (IFC strip punten, CSV
 * uppercase) en gebruiken alleen deze verzameling voor de geldigheidscheck.
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
 * Datum-constraints (fase 2.3), P6-soft-semantiek: een constraint breekt nooit de
 * netwerklogica — vroege-zijde types (SNET/FNET) zijn ondergrenzen in de forward pass,
 * late-zijde types (SNLT/FNLT) bovengrenzen in de backward pass; overtreding uit zich
 * als negatieve float, niet als verschoven balken. MSO/MFO werken als P6's "Start On"/
 * "Finish On": onder- én bovengrens tegelijk (de logica-brekende harde pin is bewust
 * niet geïmplementeerd; zie docs/superpowers/specs/2026-07-02-constraints-deadlines-design.md).
 * ALAP schuift de vroege datums op tot de vrije speling 0 is (P6-model).
 */
export type ConstraintType = 'ASAP' | 'ALAP' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO';

export interface TaskConstraint {
  type: ConstraintType;
  /** Vereist voor alle types behalve ASAP/ALAP; wordt bij toepassing op een werkdag gesnapt. */
  date?: string;
  /** OPTIONEEL — logica-brekende Mandatory-pin (fase 2.9). Alleen zinvol voor MSO/MFO.
   *  Afwezig/false ⇒ P6-soft "Start On"/"Finish On" (het huidige gedrag, byte-identiek).
   *  true ⇒ P6 Mandatory Start/Finish: pint ES én LF (MSO) resp. EF én LS (MFO) op de datum,
   *  overschrijft de logica, houdt TF=0 op de pin en drijft negatieve float upstream (§4.2). */
  hard?: boolean;
}

/**
 * Externe (cross-project) dependency (fase 2.9, §3.3). GEEN live multi-document-solve: de link
 * rekent altijd op de bevroren `anchorDate` (P6 External Dates). `sourceMissing` is puur een
 * UI-/versheids-signaal (§4.5/§5.5) — het gedrag hangt er niet van af.
 */
export interface ExternalLink {
  id: string;
  direction: 'predecessor' | 'successor';   // is de externe taak mijn voorganger of opvolger?
  relType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number;
  lagMinutes?: number;                       // zelfde eenheid-conventie als Sequence (2.8b §3.3)
  /** Bevroren driving-datum van de andere kant (P6 External Dates, Rapport B §3.1). */
  anchorDate: string;                        // date-only (dag) of datetime (uur)
  sourceRef: { projectId: string; projectName?: string; taskId: string; taskName?: string; filePath?: string };
  /** true ⇒ bronproject niet beschikbaar; de link rekent op de gecachte anchorDate (ghost, §5.5). */
  sourceMissing: boolean;
}

export type DurationType = 'WORKTIME' | 'ELAPSEDTIME';

/**
 * Eén werkonderbreking in een gesplitste taak (MS Project: "split") — etappe "nul afwijkingen"
 * (Z0/Z4 leidden dit af, Z7 consumeert het in de CPM: `CPMSolver.ts`/`duration.ts`'s
 * `splitTotalSpanMinutes`).
 *
 * OFFSET-GEBASEERD, niet absoluut, in MINUTEN — MAAR (Z7-fixronde-H1, WORTELFIX: as-verwarring
 * gecorrigeerd) NIET op de "zuivere werkduur"-as (`TaskTime.durationMinutes`s eenheid, die per
 * definitie GEEN gaten telt). `afterMinutes`/`gapMinutes` staan op MPXJ/MSP's eigen cumulatieve
 * `elapsedWorkMinutes`-as (zie `mppTimephased.ts`'s `TimephasedWorkPeriod`, de bron van deze
 * afleiding, `Z4`-paragraaf in de moduleheader): die as loopt CUMULATIEF door de tijdgefaseerde
 * periodes en telt daarbij ELKE periode mee — óók een periode met `workMinutes===0` (een gat telt
 * dus zelf ook mee in hoeveel de as voor een VOLGEND gat al is opgeschoven). Voor een taak met twee
 * of meer gaten is `afterMinutes` van het TWEEDE (en latere) gat dus NIET gelijk aan "zuivere
 * werktijd sinds taakstart" — het incorporeert de voorgaande gaten al. Consumenten mogen `afterMinutes`
 * daarom NOOIT rechtstreeks tegen een zuivere-werkduur-getal (`durationMinutesOf`/`scheduleDuration`)
 * vergelijken of tegen een vast venster klemmen — dat trunceerde eerder legitieme gaten (reviewer-
 * bewijs: `mpxj/junit/data/mpp14timephased.mpp`s "Task 5 - 24 Hour", `afterMinutes:1440`/
 * `gapMinutes:5760`, MSP's eigen finish reproduceert alleen via de ONGEKLEMDE as-wandeling
 * `splitTotalSpanMinutes` in `duration.ts`, niet via een `[0, duur)`-venster). "Het restwerk hervat
 * daarna" blijft de betekenis: elk gat is een periode waarin niet gewerkt wordt, op de eigen positie
 * langs deze as — zie `duration.ts`'s moduleheader voor het volledige as-wandelalgoritme.
 *
 * Offsets in plaats van absolute datumparen om drie redenen: shift-invariant (een herberekening/
 * verplaatsing van de taak verschuift de gaten automatisch mee, absolute segmenten zouden bij elke
 * herberekening verouderen), geen INPUT/COMPUTED-dubbelrol (de gaten zijn brondata; de absolute
 * segmenten die de renderer/print tekenen zijn AFGELEID uit `earlyStart` + een kalenderwandeling),
 * en een triviaal `moveProject.ts`-verdict (er staat geen datum in, dus "n/a" is aantoonbaar
 * correct — zelfde taxonomie als `levelingDelay` — in plaats van een handgeschreven shift).
 */
export interface TaskSplitGap { afterMinutes: number; gapMinutes: number }

/**
 * Eén rauwe periode uit een gedecodeerd .mpp-timephased-blok (Z14b — zie `Task.timephasedContours`
 * se docblok voor de volledige rol/eigenaarsprincipe-toelichting). `afterMinutes`/`minutes` liggen
 * op DEZELFDE cumulatieve-werkminuten-as als `TaskSplitGap.afterMinutes`/`gapMinutes` (taak-as, niet
 * toewijzings-as — zie die interface se docblok); `minutes` is de periodelengte op die as
 * (`elapsedWorkMinutesEnd − elapsedWorkMinutesStart` in `mppTimephased.ts`'s `TimephasedWorkPeriod`).
 * `workMinutes` kan 0 zijn (een periode met verstreken werkminuten maar zonder werk — het gat dat
 * `deriveSplitGapsFromPeriods` als split herkent). `kind` onderscheidt reeds-verricht werk
 * (`'actual'`, MPXJ `getCompleteWork`) van resterend/gepland werk (`'remaining'`, MPXJ
 * `getPlannedWork`) — dezelfde twee tracks die `deriveSplitGapsForTasks` al combineert.
 */
export interface TimephasedContourPeriod {
  afterMinutes: number;
  minutes: number;
  workMinutes: number;
  kind: 'actual' | 'remaining';
}

/** Alle rauwe contourperiodes van ÉÉN toewijzing van de taak (zie `Task.timephasedContours`). */
export interface TaskTimephasedContour {
  /** MSP's eigen resource-uniqueId (`AssignmentField.RESOURCE_UNIQUE_ID`) — PUUR herkomst/
   *  traceability, geen live-resource-referentie (deze toewijzing is mogelijk allang gewijzigd of
   *  verdwenen in het app-model; de rauwe periode blijft desondanks staan, eigenaarsprincipe).
   *  `null` wanneer de toewijzing geen (vindbare) resource droeg. */
  resourceUid: number | null;
  periods: TimephasedContourPeriod[];
}

/**
 * MSP's eigen "Task Type" (Fixed Units/Fixed Duration/Fixed Work — `TaskField.TYPE`, `DataType.
 * TASK_TYPE`). NIET te verwarren met `Task.taskType` hierboven (dat is een OPS-eigen domeinclassi-
 * ficatie — CONSTRUCTION/INSTALLATION/…, een ander concept met toevallig een gelijkende naam).
 * Eigenaarsbesluit 2026-08-18 (plan §10, punt 1): puur data, bewaard zodat een .mpp-import 'm niet
 * weggooit — GEEN rekengedrag; geen enkele solverstap leest `Task.mspTaskType`. Task type als
 * projecteigenschap-met-per-taak-keuze (en het bijbehorende bewerkgedrag) is een latere, aparte
 * etappe (zelfde besluit, punt 2).
 */
export type MspTaskType = 'FIXED_UNITS' | 'FIXED_DURATION' | 'FIXED_WORK';

/**
 * P6's eigen "Duration Type" (XER `TASK.duration_type` — Primavera "Duration Type" op de
 * activiteit: stuurt hoe P6 zelf duur/eenheden/snelheid aan elkaar koppelt bij een bewerking).
 * VIER canonieke P6-tokens (Oracle P6-schema): Fixed Duration & Units, Fixed Duration & Units/Time,
 * Fixed Units/Time, Fixed Units. Deze unie draagt de canonieke schrijfwijze; de XER-etappe se
 * generieke enum-tokenregel (§4.7 van het XER-etappeplan, geïmplementeerd in X4a/X5) matcht
 * corpusvarianten case-insensitief tegen deze lijst en rapporteert — nooit stil — een token dat ook
 * ná case-fold onbekend blijft. NIET te verwarren met `MspTaskType` hierboven: twee bronformaten,
 * twee taaktypeconcepten met een andere waardenverzameling.
 */
export type P6DurationType = 'DT_FixedDrtn' | 'DT_FixedDUR2' | 'DT_FixedRate' | 'DT_FixedQty';

/**
 * P6's eigen "Activity Type" (XER `TASK.task_type`): Task Dependent, Resource Dependent, Level of
 * Effort, Start Milestone, Finish Milestone, WBS Summary. ZES canonieke P6-tokens; zie
 * `P6DurationType` voor de case-insensitieve-matchafspraak (§4.7).
 */
export type P6ActivityType = 'TT_Task' | 'TT_Rsrc' | 'TT_LOE' | 'TT_Mile' | 'TT_FinMile' | 'TT_WBS';

/**
 * Soort mijlpaal (fase 2.4, P6 Start/Finish Milestone). Dag-granulair grens-model:
 * START ankert op een dagbegin, FINISH op een dageinde (einde werkdag F = begin
 * eerstvolgende werkdag). undefined = automatisch: het anker volgt de bindende
 * relatiezijde (FS/SS → start, FF/SF → finish) — het gedrag van vóór fase 2.4.
 */
export type MilestoneKind = 'START' | 'FINISH';

export interface TaskTime {
  durationType: DurationType;
  scheduleDuration: number; // in work days
  /** OPTIONEEL — canonieke duur in integer MINUTEN (fase 2.8b, §3.1). Aanwezig ⇒ bron van
   *  waarheid; het effectieve `scheduleDuration` is dan de afgeleide `minuten / (effHoursPerDay
   *  × 60)`. Afwezig ⇒ `scheduleDuration` (werkdagen) is de bron (dag-modus, byte-identiek).
   *  INVARIANT (Bevinding 2): `durationMinutes` wordt alleen gezet én gerespecteerd wanneer de
   *  effectieve kalender uur-modus is; op een dag-kalender is sub-dag-duur ongedefinieerd en
   *  valt `durationDaysOf` ALTIJD terug op `scheduleDuration` (nooit een fractionele dag in
   *  `addWorkDays`). Zie `src/engine/scheduler/duration.ts`. */
  durationMinutes?: number;
  scheduleStart: string;    // ISO 8601 — date-only in dag-modus, datetime in uur-modus
  scheduleFinish: string;   // ISO 8601 — date-only in dag-modus, datetime in uur-modus
  /** OPTIONEEL — MSP's EIGEN opgeslagen hervattingsinstant voor een IN-PROGRESS-taak (`.mpp`-
   *  veld-id 99, `TaskField.RESUME`, `DataType.DATE`; Z12-herwerk, dossier out-of-sequence-
   *  actuals). Geen afgeleide/herberekende waarde — de invoer staat letterlijk in het bestand,
   *  net als `scheduleStart`/`scheduleFinish` hierboven (vandaar dezelfde rol, `TaskTimeInput`,
   *  i.p.v. `TaskTimeTracking` waar `actualStart`/`actualFinish` in zitten). `CPMSolver.ts` leest
   *  dit veld voor een aantoonbaar out-of-sequence FINISH_START-opvolger (`isOutOfSequenceFsPredecessor`):
   *  `finish = addWork(resume, remaining)` op de taak-EIGEN kalender — corpusmeting (fase 1):
   *  17/17 exact op alle out-of-sequence-in-progress-bladtaken, 4/4 op de gemeten OzBuild-
   *  snapshots minuut-exact. Afwezig (niet-`.mpp`-bronnen, of een `.mpp`-bestand waarvan de field
   *  map veld 99 mist) ⇒ het bestaande RETAINED_LOGIC/`resumeFromActualElapsed`-pad, ongewijzigd. */
  resume?: string;
  /** OPTIONEEL — spiegelt `resume` hierboven (`.mpp`-veld-id 100, `TaskField.STOP`): MSP's eigen
   *  grens van het reeds-afgewerkte deel. Door GEEN enkele solverberekening gelezen (de
   *  `finish = addWork(resume, remaining)`-formule haalde 17/17 zonder `stop`) — hier alleen
   *  meegenomen als rauw, ongebruikt feit voor een latere taak (splits-/actual-grens-rendering). */
  stop?: string;

  // CPM-computed
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  freeFloat: number;   // work days (fractioneel in uur-modus, §5.5)
  totalFloat: number;  // work days (fractioneel in uur-modus, §5.5)
  isCritical: boolean;
  /** OPTIONEEL — interfererende speling = totalFloat − freeFloat (getekend, fractioneel in
   *  uur-modus; fase 2.9, §4.6). Alleen geschreven wanneer de analyse-laag draait; afwezig ⇒
   *  byte-identiek default-document. */
  interferingFloat?: number;
  /** OPTIONEEL — near-critical-markering (fase 2.9, §4.6). Alleen geschreven bij ingestelde drempel. */
  isNearCritical?: boolean;
  /** OPTIONEEL — float-path-nummer (1 = meest kritiek; fase 2.9, §4.6). Alleen geschreven bij floatPaths. */
  floatPath?: number;

  // Tracking
  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  remainingTime?: number;
  /** OPTIONEEL — resterend werk in integer MINUTEN (uur-modus voortgang, fase 2.8b §5.3). */
  remainingMinutes?: number;
  completion: number; // 0.0 - 1.0
}

/**
 * TYPE-ONLY rol-splitsing van `TaskTime` (Bevinding A7). `TaskTime` mengt vier rollen in één plat
 * type; een consument kan niet zien welke velden hij mag SCHRIJVEN en welke `runCPM` OVERSCHRIJFT.
 * De vier `Pick<>`-aliassen hieronder maken die rollen expliciet — puur documentair/afdwingend,
 * ZONDER runtime-verandering en ZONDER `TaskTime` zelf te herstructureren. `Task.time` blijft de
 * volledige `TaskTime`; alle bestaande lezers/schrijvers blijven ongewijzigd. Elk `TaskTime`-veld
 * hoort in PRECIES één rol; de compile-assert onderaan dwingt volledige + disjuncte dekking af,
 * zodat een nieuw veld gedwongen wordt gecategoriseerd.
 */

/** INVOER — door de gebruiker/importers geschreven. `runCPM` raakt deze normaliter niet aan, MAAR
 *  overschrijft in UUR-modus `scheduleStart`/`scheduleFinish` (naar de berekende instants,
 *  `scheduleSlice.ts`) en `scheduleDuration` (+ `durationMinutes` op een uur-kalender) voor
 *  HAMMOCK-taken (afgeleide span, `CPMSolver`). `durationType` blijft puur invoer. */
export type TaskTimeInput = Pick<
  TaskTime,
  'durationType' | 'scheduleDuration' | 'durationMinutes' | 'scheduleStart' | 'scheduleFinish'
  | 'resume' | 'stop'
>;

/** CPM-COMPUTED — geschreven door `runCPM` (CPMSolver). Normaliter niet handmatig muteren; de
 *  legitieme uitzonderingen zijn restore-paden (IFC-import herstelt deze velden, benchmark-runner). */
export type TaskTimeComputed = Pick<
  TaskTime,
  'earlyStart' | 'earlyFinish' | 'lateStart' | 'lateFinish' | 'freeFloat' | 'totalFloat' | 'isCritical'
>;

/** ANALYSE (fase 2.9, §4.6) — afgeleiden bovenop de CPM-output. `interferingFloat` (= tf − ff) wordt
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
// Puur type-niveau (verdwijnt bij compilatie). Dwingt twee dingen af, zodat de rol-splitsing niet
// stil kan verouderen:
//   1) VOLLEDIGHEID — elk TaskTime-veld zit in minstens één rol (een nieuw, niet-gecategoriseerd
//      veld laat `_UncategorizedTaskTimeField` iets anders dan `never` worden → tsc-fout).
//   2) DISJUNCTHEID — geen veld zit in twee rollen (een dubbel geplaatst veld laat `_OverlappingRole`
//      iets anders dan `never` worden → tsc-fout).
// (Elke Pick is per definitie al een subset van `keyof TaskTime`, dus een getypte sleutel die niet
//  bestaat geeft al bij de Pick zelf een fout — een aparte "extra keys"-check is overbodig.)
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
// Deze twee asserts compileren alleen wanneer beide condities `never` zijn. Waarde-vorm + `void`
// (zoals snapshot.ts/documentContract.ts) zodat `noUnusedLocals` ze niet als dood markeert; de
// twee const-declaraties minificeren weg (inert).
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
  status: TaskStatus;
  isMilestone: boolean;
  /** Alleen relevant bij isMilestone; undefined = automatisch (zie MilestoneKind). */
  milestoneKind?: MilestoneKind;
  /** Verplichte (contractuele) mijlpaal — inspectie-/keurings-/opleverpunt. Markering
   *  voor rapportage & Gantt; datumbewaking loopt via constraint/deadline (fase 2.3). */
  mandatory?: boolean;
  /** Leveling-prioriteit (MSP-conventie, P6 "Activity Priority" analoog): 0–1000, default 500.
   *  1000 = "Do Not Level" (vastgepind, wordt door de nivelleerder nooit verschoven). Ongebruikt
   *  vóór fase 2.5 (was hardcoded 0 overal); vanaf 2.5 stuurt dit de nivelleervolgorde. */
  priority: number;
  /** Vertraging in werkdagen t.o.v. de precedence-feasible early start (de ES die de forward
   *  pass berekent nadat óók de voorgangers hun levelingDelay hebben gekregen — NIET t.o.v. de
   *  oorspronkelijke CPM-ES, dat zou voorgangersverschuivingen dubbel tellen). Gezet door de
   *  nivelleerder (fase 2.5, nog niet gebouwd). undefined = geen nivellering toegepast.
   *  "Nivellering wissen" zet dit overal terug naar undefined. */
  levelingDelay?: number;
  /** OPTIONEEL — subdag-precisie voor `levelingDelay` (etappe "nul afwijkingen", Z0, voorlopig
   *  ONGEBRUIKT). MSP levert de nivelleervertraging in tienden-van-een-minuut; `levelingDelay`
   *  (hele werkdagen) kan dat niet exact dragen. Zelfde precedent als `durationMinutes` naast
   *  `scheduleDuration`: AANWEZIG ⇒ bron van waarheid, AFWEZIG ⇒ `levelingDelay` (werkdagen) blijft
   *  de bron (byte-identiek). Nog door geen enkele solver-stap gelezen. */
  levelingDelayMinutes?: number;
  /** OPTIONEEL — begeleidt `levelingDelayMinutes` (Z0, voorlopig ONGEBRUIKT). MSP's
   *  `LevelingDelayFormat` kent een ELAPSED-variant (kloktijd i.p.v. werktijd), net als
   *  `durationType`/MSPDI's elapsed-vlag op een duur. Afwezig ⇒ WORKTIME (byte-identiek). Alleen
   *  betekenisvol wanneer `levelingDelayMinutes` ook gezet is. */
  levelingDelayElapsed?: boolean;
  /** OPTIONEEL — werkonderbrekingen (MS Project "split"), zie `TaskSplitGap` (die interface se
   *  eigen docblok draagt de as-definitie — lees die vóórdat je dit veld raadpleegt). Sinds Z4 ECHT
   *  gevuld: `mppReader.ts` leidt dit af uit de timephased-werksegmenten van een `.mpp`-import
   *  (`deriveSplitGapsForTasks`, `mppTimephased.ts`), en round-trippt sinds Z14 door IFC
   *  (`OPS_TaskSplits`-pset, `ifcPsets.ts`). Sinds Z7 ECHT geconsumeerd door de CPM: `CPMSolver.ts`'s
   *  vier aangrijpingspunten (`addDurationChecked`/`subDuration`/`finishFromStart`/`startFromFinish`
   *  + de IN-PROGRESS-restwerktak) wandelen dit via `duration.ts`'s `splitTotalSpanMinutes`. De
   *  renderer tekent sinds Z15 al een onderbroken balk in Gantt/print/PDF. Afwezig ⇒ geen splits
   *  (byte-identiek). */
  splitGaps?: TaskSplitGap[];
  /** OPTIONEEL — GELAAGDE BESLISKOLOM (Z8-herwerkronde, etappe "nul afwijkingen"). Drie van de vijf
   *  lagen raken taakvelden; deze eerste, `timephasedFinishFloor`, is LAAG 3: het MAXIMUM van
   *  `AssignmentField.FINISH` over de toewijzingen van deze taak die ≥1 ÉCHTE gedecodeerde
   *  timephased-periode droegen (Format A/B, `mppTimephased.ts` — NIET het kale "een `TBkndAssn`-
   *  record bestaat"-signaal, dat bleek een vrijwel volledige cirkelmeting, zie de Z8-herwerkronde-
   *  rapportage). Alleen gezet op taken met `time.completion === 0` (lagen 1/2 — voltooid resp.
   *  in-progress — plannen op hun bestaande actuals-/resume-paden, GEEN venster, zie
   *  `CPMSolver.ts`). MSP's EIGEN al berekende antwoord — geen eigen kalenderwandeling nodig.
   *  `CPMSolver.ts`'s `forwardPass` past 'm toe op dezelfde plek als `sfFinishFloor` (die blijft een
   *  onbreekbare `Math.max`-ondergrens; het venster zelf overschrijft de kale duur-gebaseerde
   *  berekening volledig), nooit bij een harde MFO/MSO-pin, alleen in uur-modus. ISO-instant,
   *  minuutprecisie (`formatInstant(d,'hour')`). Mutueel exclusief met `timephasedDurationWalks`
   *  (LAAG 4, zie die docstring) — `mppReader.ts` zet nooit beide op dezelfde taak. Afwezig ⇒ geen
   *  echte periode-data op deze taak, byte-identiek. Round-tript sinds Z14b via `OPS_TimephasedWindow`
   *  (`ifcPsets.ts`). EIGENAARSPRINCIPE (2026-08-18) — dit veld is AFGELEIDE sturing: een
   *  inhoudelijke bewerking (duur/datums/kalender/toewijzingen) wist dit veld weer (zie
   *  `taskDefaults.ts`'s `clearTimephasedWindow`, aangeroepen vanuit `taskSlice.ts`/
   *  `mcpTransaction.ts`/`resourceSlice.ts`) — de RAUWE bron blijft dan in `timephasedContours`
   *  staan, dat wordt nooit gewist door een edit. */
  timephasedFinishFloor?: string;
  /** OPTIONEEL — RAUW startanker (Z8-herwerkronde), gebruikt door zowel LAAG 3 als LAAG 4: het
   *  MINIMUM van `AssignmentField.START` over de LAAG-3-toewijzingen (bij `timephasedFinishFloor`)
   *  resp. de eerste/vroegste ankerdatum van de LAAG-4-toewijzingen (bij `timephasedDurationWalks`
   *  — daar puur het startpunt van de wandeling, de LAAG-4-finish zelf komt uit die wandeling, niet
   *  uit dit veld). Uitsluitend gebruikt voor een taak ZONDER voorganger (`CPMSolver.ts`'s
   *  `forwardPass`, `preds.length===0`-tak) wier eigen `time.scheduleStart` buiten de taak-
   *  kalender-band ligt maar de toewijzing wél binnen haar EIGEN resourcekalender (corpusvoorbeeld:
   *  een "Night Shift"-resource op 23:00, buiten de taak se "Standard"-band) — MSP snapt zo'n
   *  anker niet, de gewone `ownAnchor`-snap deed dat vóór Z8 wél. Afwezig ⇒ byte-identiek. Zelfde
   *  IFC-round-trip/eigenaarsprincipe-kanttekening als `timephasedFinishFloor`. */
  timephasedStartAnchor?: string;
  /** OPTIONEEL — LAAG 4 van de Z8-herwerkronde-beslistabel: taken met een VLAK timephased-record
   *  (`blockCount===0`, GEEN echte periode — dus `timephasedFinishFloor` blijft hier afwezig) MAAR
   *  wier toewijzing(en) een NIET-STANDAARD resourcekalender dragen (corpusbewijs: de "Night Shift"/
   *  "24 Hours"-families in `mpp14timephased.mpp`, en `mpp14resource.mpp`'s "Task A" — een gemengde
   *  toewijzingsset waar één van de drie resources een sterk afwijkende kalender draagt). Anders dan
   *  `timephasedFinishFloor` (een GELEZEN, bevroren MSP-antwoord) is dit een VERSE HERBEREKENING:
   *  `CPMSolver.ts` wandelt per item DOOR de toewijzing se EIGEN resourcekalender vanaf haar
   *  `anchor`, en neemt het MAXIMUM over de lijst (dezelfde "langste toewijzing bepaalt de finish"-
   *  regel als laag 3, hier alleen zonder gelezen eindantwoord). N2-CORRECTIE (Opus-her-check,
   *  tweede ronde): dit "GEEN invalidatie nodig, stroomt vanzelf mee" gold zo alleen voor een item
   *  ZONDER `workMinutes` (het wandelt dan `task.time.durationMinutes`, edit-live). Een item MET
   *  `workMinutes` (zie hieronder) wandelt die BEVROREN waarde in plaats daarvan — die volgt een
   *  latere duur-/datum-/kalenderwijziging dus NIET vanzelf. Vandaar dat `updateTask`/
   *  `updateTaskFields`/`patchTaskFields` deze lijst sinds N2 wél wissen zodra ze zo'n item bevat
   *  (`taskDefaults.ts`'s `timephasedDurationWalksHaveFrozenWork`/`clearTimephasedDurationWalks`),
   *  precies zoals bij `timephasedFinishFloor`/`timephasedStartAnchor` — de taak valt dan terug op
   *  laag 5 tot een volgende .mpp-import de lijst opnieuw vult.
   *  `resourceCalendarId` verwijst in de gedeelde kalenderbibliotheek (`CPMSolver`'s `registry`,
   *  `resolveCalendar`); een taak zonder voorganger gebruikt bovendien het VROEGSTE `anchor` uit
   *  deze lijst als `timephasedStartAnchor` (zie hierboven). Mutueel exclusief met
   *  `timephasedFinishFloor`.
   *
   *  `workMinutes` (Z19, residu-iteratie "nul afwijkingen") — optioneel per item; ONTBREEKT het,
   *  dan wandelt `CPMSolver.ts` `task.time.durationMinutes` (de volle taakduur, edit-live). De
   *  garantie zit op de PRODUCERENDE tak in `mppReader.ts`, NIET op de array-lengte: 19 corpustaken
   *  dragen een lijst van lengte 1 mét `workMinutes` (de MATERIAL-gefilterde >1-tak).
   *  Corpusbewijs: 9/9 (mpp14timephased2.mpp) en 20/20 (mpp14timephasedsegments.mpp) op de volledige
   *  populatie, en de 0%-populatie van mpp14timephased.mpp (zie de Z8-herwerkronde-rapportage). AANWEZIG
   *  bij >1 item — bij meerdere GELIJKTIJDIGE toewijzingen wandelt geen enkele toewijzing de volle
   *  taakduur; elke toewijzing wandelt alleen haar EIGEN, per-toewijzing gedecodeerde werk-aandeel
   *  (`decodeAssignmentWorkMinutes`, `mppReader.ts`), en de LANGSTE wandeling bepaalt de finish
   *  (die volle-duur-aanname is BEWEZEN onjuist bij >1 toewijzing —
   *  `mpp14resource.mpp`'s "Task A", drie toewijzingen, gaf zonder apportionering een ~2× te late
   *  datum). Afwezig ⇒ byte-identiek. Round-tript sinds Z14b via `OPS_TimephasedWindow`
   *  (`ifcPsets.ts`). Wordt NOOIT door `clearTimephasedWindow` gewist (dat blijft `timephasedFinishFloor`/
   *  `timephasedStartAnchor`-only) — maar sinds N2 wél door de aparte `clearTimephasedDurationWalks`,
   *  onder de voorwaarde hierboven (`workMinutes` gezet op minstens één item). Zie
   *  `taskDefaults.ts`'s hoofddocblok voor de volledige triggerset-toelichting. */
  timephasedDurationWalks?: { anchor: string; resourceCalendarId: string; workMinutes?: number }[];
  /** OPTIONEEL — RAUWE, gedecodeerde .mpp-timephased-contourperiodes (Z14b, eigenaarsprincipe
   *  2026-08-18: "er gaat nooit stilzwijgend broninformatie verloren, ook niet ná bewerken"). Dit is
   *  de bron ONDER `splitGaps`/`timephasedFinishFloor`/`timephasedStartAnchor` — die drie zijn
   *  AFGELEIDE sturing (splitGaps voedt de CPM rechtstreeks, de twee venstervelden worden bij een
   *  inhoudelijke bewerking ontkoppeld, zie `clearTimephasedWindow` in `taskDefaults.ts`) — dit veld
   *  blijft ALTIJD staan, ook ná zo'n bewerking: geen enkele actie in deze etappe wist het. Eén
   *  entry per toewijzing van deze taak die daadwerkelijk een ECHTE dagverdeling droeg (vlakke
   *  samenvattingsrecords — MPXJ's `blockCount===0`-speciale geval — tellen niet mee, zelfde filter
   *  als `mppReader.ts`'s `deriveSplitGapsForTasks` al toepast op `splitGaps`). Periodes liggen op
   *  DEZELFDE as als `TaskSplitGap` (cumulatieve werkminuten sinds taakstart — zie die interface se
   *  eigen "TAAK-AS, NIET TOEWIJZINGS-AS"-docblok voor de volledige as-definitie). Puur data: geen
   *  enkele solverstap leest dit veld — voedingsdata voor de latere contour-engine (eigenaarsbesluit
   *  2026-08-18, plan §10). Round-tript via `OPS_TimephasedContours` (`ifcPsets.ts`). Afwezig ⇒ geen
   *  echte periode-data op deze taak (byte-identiek). */
  timephasedContours?: TaskTimephasedContour[];
  /** OPTIONEEL — handmatig geplande taak (MS Project "Manually Scheduled", Z0, voorlopig
   *  ONGEBRUIKT). De datums zelf blijven `time.scheduleStart`/`scheduleFinish` — dit is puur het
   *  SIGNAAL dat de solver ze straks RAUW moet respecteren (geen kalendersnap, geen relatiedruk,
   *  geen constraint-afdwinging) in plaats van te herrekenen; nog door geen enkele solver-stap
   *  gelezen. Afwezig/false ⇒ normale (auto-geplande) taak, byte-identiek. */
  manuallyScheduled?: boolean;
  /** OPTIONEEL — MSP's eigen Task Type bij .mpp-import (zie `MspTaskType`). Puur data (eigenaars-
   *  besluit 2026-08-18): geen enkele solverstap leest dit veld. Afwezig ⇒ veld niet gelezen/niet
   *  van toepassing (byte-identiek), NIET hetzelfde als "FIXED_UNITS" (MSP's eigen stille default
   *  voor een nieuwe taak) — een afwezig veld is hier "onbekend", geen aanname. Round-tript via
   *  `OPS_MspTaskType` (`ifcPsets.ts`). */
  mspTaskType?: MspTaskType;
  /** OPTIONEEL — MSP's "Effort Driven"-vlag bij .mpp-import (`TaskField.EFFORT_DRIVEN`). Puur data,
   *  zelfde eigenaarsbesluit als `mspTaskType` hierboven — geen enkele solverstap leest dit veld.
   *  Afwezig/false ⇒ byte-identiek. Round-tript via `OPS_MspTaskType` (`ifcPsets.ts`, zelfde pset
   *  als `mspTaskType` — het is hetzelfde MSP-taaktypeconcept-paar). */
  effortDriven?: boolean;
  /** OPTIONEEL — P6's eigen Duration Type bij .xer-import (zie `P6DurationType`). VELD-ALS-SIGNAAL,
   *  eigen opgeslagen veld NAAST `mspTaskType` — géén hergebruik: de twee bronformaten kennen elk
   *  hun eigen taaktypeconcept met een andere waardenverzameling en een andere reken-relatie (MSP:
   *  Fixed Units/Duration/Work; P6: Fixed Duration&Units/Duration&Units-per-Time/Units-per-Time/
   *  Units). Puur data — eigenaarsbesluit XER-etappeplan §1/X0 (2026-08-20): GEEN enkele solverstap
   *  leest dit veld deze etappe. VASTGELEGDE AFSPRAAK (§1 van het plan): de latere taaktypes/effort-
   *  driven-motor-etappe (`2026-08-18-spec-taaktypes-effort-driven.md`) mapt zowel `mspTaskType` als
   *  `p6DurationType` naar ÉÉN interne superset-rekenmodel — twee opslagvelden nu, één rekenmodel
   *  straks, geen twee eilanden. Afwezig ⇒ geen .xer-herkomst of onbekend token (byte-identiek). */
  p6DurationType?: P6DurationType;
  /** OPTIONEEL — P6's eigen Activity Type bij .xer-import (zie `P6ActivityType`). Zelfde
   *  eigenaarsbesluit/superset-afspraak als `p6DurationType` hierboven — puur data, geen solverstap
   *  leest dit veld deze etappe (de XER-lezer leidt `isMilestone`/`isHammock` er later wél
   *  OPERATIONEEL uit af — TT_Mile/TT_FinMile resp. TT_LOE, zie X4a — maar dat zijn AFGELEIDEN, niet
   *  dit veld zelf, dat blijft de rauwe herkomst). Afwezig ⇒ geen .xer-herkomst (byte-identiek). */
  p6ActivityType?: P6ActivityType;
  /** OPTIONEEL — herkomstvlag voor `time.resume`/`time.stop` (O6-patroon; zie `resumeFromActualElapsed`
   *  in `types/project.ts` voor het precedent van een default-uit, uitsluitend-door-de-eigen-lezer-
   *  gezette opt-invlag). P6 kent EIGEN suspend/resume-semantiek (XER `TASK.suspend_date`/
   *  `resume_date`) die het bestaande MSP-conventiepad rond `time.resume`/`time.stop` (Z12-herwerk)
   *  niet zonder meer deelt. DIT VELD IS EEN STUB: X0 (typecontract) legt alleen de aanwezigheid en
   *  de naam vast — de XER-etappe se X7-taak meet EERST of/waar P6's suspend/resume-gedrag afwijkt
   *  van de MSP-solversemantiek, en vult dit veld pas dan daadwerkelijk (geen enkele lezer zet het
   *  vóór die meting). Default/afwezig ⇒ MSP-conventie, byte-identiek. */
  p6SuspendResume?: boolean;
  parentId: string | null; // WBS parent
  childIds: string[];      // WBS children
  time: TaskTime;
  resourceIds: string[];
  color?: string;
  /** Activity-code-toewijzingen: codetype-id → waarde-id (max één waarde per type, P6-invariant). */
  activityCodes?: Record<string, string>;
  /** Custom-field-waarden: velddefinitie-id → waarde (getypeerd volgens CustomFieldDef.type). */
  customFields?: Record<string, CustomFieldValue>;
  /** Datum-constraint (fase 2.3); afwezig = ASAP. PRIMAIR. */
  constraint?: TaskConstraint;
  /** OPTIONEEL — SECUNDAIRE constraint (fase 2.9, P6). Altijd soft (hard verboden op secundair).
   *  Combinatie-regel (P6, Rapport B §1.3): secundair NIET toegestaan als primair Start On/Finish On/
   *  Mandatory is; verder één forward-type + één backward-type die elkaar niet tegenspreken.
   *  Afwezig ⇒ geen tweede grens (byte-identiek). */
  constraint2?: TaskConstraint;
  /** OPTIONEEL — hammock/LOE (fase 2.9, §3.2/§4.4). Afwezig/false ⇒ gewone taak (byte-identiek).
   *  true ⇒ duur wordt AFGELEID (span tussen start-driver en finish-driver);
   *  scheduleDuration/durationMinutes worden genegeerd als invoer en overschreven met de span.
   *  Uitgesloten van het kritieke pad (isCritical altijd false). */
  isHammock?: boolean;
  /** OPTIONEEL — externe (cross-project) dependencies (fase 2.9, §3.3). Afwezig ⇒ geen (byte-identiek). */
  externalLinks?: ExternalLink[];
  /** Zachte deadline (MSP-model): begrenst alleen de late finish — balken bewegen nooit;
   *  overschrijding (earlyFinish > deadline) geeft negatieve float + waarschuwing. */
  deadline?: string;
  /** OPTIONEEL — id in de kalender-bibliotheek (fase 2.8a, §4). undefined = projectkalender
   *  (project.calendarId). Symmetrisch met Resource.calendarId. Bepaalt de kalender waarin de DUUR
   *  en de constraints van deze taak rekenen (§5). */
  calendarId?: string;
  /** OPTIONEEL — vrije aantekeningen/checklist per taak (fase 2.10, item 1). Afwezig ⇒ geen
   *  aantekeningen (byte-identiek). Puur een array-veld, geen dedicated store-acties nodig
   *  (mutaties via `updateTask(taskId, { notes })`). */
  notes?: { id: string; text: string; done: boolean }[];
}

