/** Voortgangs-scheduling-modus (P6, fase 2.6). undefined ⇒ RETAINED_LOGIC (de default). */
export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

/**
 * Project-scoped reken-opties (fase 2.9, §3.4/§7). ELKE default = het huidige gedrag ⇒ een afwezig
 * (of leeg) blok is byte-identiek aan vóór 2.9. Deze opties horen bij het BESTAND (net als
 * statusDate/progressMode), niet bij de app-settings — anders zou hetzelfde bestand op twee machines
 * een ander schema geven (§7). De solver leest ze via `CPMOptions.schedulingOptions`.
 */
export interface SchedulingOptions {
  /** Expliciete provenance voor P6-XER-projectieregels. Alleen de XER-reader zet deze waarde;
   *  IFC bewaart haar uitsluitend om een XER-import semantisch gelijk te round-trippen. */
  p6Source?: 'XER';
  /** Kalender voor relatie-lag (P6 4-way, Rapport B §7.1). Default 'predecessor' ⇒ byte-identiek
   *  met de oude vaste voorgangerskalender. LET OP (XER-etappe X5, eindreview bevinding 5): tot
   *  september 2026 was dit een dode instelling — de UI bood de keuze en het IFC bewaarde haar, maar
   *  de solver las een constante. Sinds `relDeps.lagEngine` (`CPMSolver.ts`) is ze effectief, voor
   *  ELK formaat en niet alleen achter `p6Source`: een bestaand document waarin ooit 'successor',
   *  '24hour' of 'projectDefault' is gekozen, plant sindsdien naar die keuze. Eigenaarsbesluit,
   *  plan §10.f. */
  lagCalendar?: 'predecessor' | 'successor' | '24hour' | 'projectDefault';
  /** Kritiek-definitie. `threshold` is de bestaande grens in taakdagen; `thresholdHours` bewaart
   *  een P6/XER-grens in bronuren en wordt per taak tegen floaturen op diens effectieve kalender
   *  vergeleken. Bij beide wint `thresholdHours`. Beide grenzen mogen negatief zijn. */
  criticalDefinition?: {
    mode: 'totalFloat' | 'longestPath';
    threshold?: number;
    thresholdHours?: number;
  };
  /** TF-berekeningswijze. Default 'smallest' = de huidige min(finish,start)-float. */
  totalFloatMode?: 'start' | 'finish' | 'smallest';
  /** Open-ended taken kritiek? Default = huidig gedrag (een eindtaak krijgt tf via LF−EF). */
  makeOpenEndedCritical?: boolean;
  /** P6/XER-bronsignaal: verwachte einddatums mogen de resterende duur begrenzen. X7 consumeert
   *  dit pas samen met het taakveld; bewaren voorkomt dat de SCHEDOPTIONS-keuze verloren gaat. */
  useExpectedFinishDates?: boolean;
  /** P6/XER-bronsemantiek voor de late zijde bij voortgang: een gestart activiteit houdt zijn
   *  geregistreerde start als LS, een voltooide activiteit houdt haar actual-venster als LS/LF,
   *  en zo'n voltooide opvolger trekt een nog open voorganger niet historisch terug. Afwezig/false
   *  bewaart de bestaande niet-XER-semantiek. */
  preserveActualDatesInBackwardPass?: boolean;
  /** P6/XER rapporteert vrije float niet negatief: bij een onhaalbare late constraint blijft TF
   *  negatief maar wordt FF nul. Afwezig/false bewaart de algemene getekende OPS-semantiek. */
  clampNegativeFreeFloat?: boolean;
  /** P6/XER gebruikt voor een nulduurmijlpaal de in TASK geplande kalendergrens: een geplande
   *  dagstart blijft startmijlpaal, een gepland bandeinde mag op de voorgangerfinish landen.
   *  Afwezig/false houdt de algemene/MSP-conventie byte-identiek. */
  p6ZeroDurationUsesPlannedBoundary?: boolean;
  /** XER TASK.target_start_date kan bij P6 naast het netwerk een geplande vloer vertegenwoordigen,
   *  maar alleen wanneer start én finish meer dan één kalenderdag later liggen dan de berekende
   *  netwerkgrens. Een gewone volgende-bandstart is geen vrije planning en activeert deze regel
   *  niet. Alleen XER zet de vlag; andere bronnen houden de generieke netwerksemantiek. */
  p6UseTaskPlannedStartFloor?: boolean;
  /** P6 kan een TT_FinMile als twee aangrenzende kalendergrenzen opslaan (ES op bandstart,
   *  EF op het vorige bandeinde). Alleen XER activeert deze representatie. */
  p6FinishMilestoneBoundaryWindow?: boolean;
  /** XER/P6: geregistreerde actual start/finish zijn broninstants en worden niet naar een
   *  kalenderband genormaliseerd. Default afwezig houdt de bestaande formaatsemantiek. */
  p6PreserveActualInstants?: boolean;
  /** XER/P6 bewaart Actual Start als historie, maar de zesassige Early/Late Start van een lopende
   *  activiteit beschrijft de start van het resterende werk (`max(statusdatum, relatiegrens)`).
   *  Alleen het XER-importpad zet deze bronvlag; andere formaten blijven hun bestaande zichtbare
   *  actual-startvenster gebruiken. */
  p6UseRemainingStartForProgress?: boolean;
  /** XER/P6: een datetime-SNLT/MSO/FNLT/MFO op een nulduurmijlpaal is een exact bronpunt,
   *  ook wanneer dat punt de inclusieve start van een werkband is. Default uit. */
  p6PreserveZeroDurationConstraintInstants?: boolean;
  /** XER/P6: gebruik PROJECT.plan_end_date als late-pass-anker wanneer
   *  SCHEDOPTIONS.sched_use_project_end_date_for_float=Y. De datum zelf blijft project.endDate;
   *  deze vlag bepaalt uitsluitend of de solver hem voor float gebruikt. Default uit. */
  useProjectEndDateForFloat?: boolean;
  /** Near-critical-drempel in werkdagen (fractioneel in uur-modus). Default undefined ⇒ feature uit. */
  nearCriticalThreshold?: number;
  /** Multiple float paths. Default undefined ⇒ uit (byte-identiek). */
  floatPaths?: { enabled: boolean; method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number };
  /** T9 (voortgangsafronding, MSP-pariteit): MS Project hervat het restwerk van een IN PROGRESS-
   *  taak NIET op `max(statusDate, voorganger-druk)` (P6's eigen RETAINED_LOGIC-conventie, de
   *  huidige/default-berekening — zie `CPMSolver.ts`'s voortgangstak) maar op `actualStart +
   *  reeds-verstreken-duur` (`scheduleDuration/durationMinutes − remaining`, doorgesnapt via
   *  dezelfde werk-optelling als het restwerk zelf) — als DERDE, uitsluitend VERHOGENDE vloer naast
   *  de bestaande twee. Default `undefined`/`false` ⇒ het bestaande, P6-getrouwe gedrag, byte-
   *  identiek (bewaakt door `cases-progress.json`'s Scenario A/B/C, die P6's eigen gedocumenteerde
   *  RETAINED_LOGIC-semantiek toetsen — dít veld mag die niet stilzwijgend wijzigen). Uitsluitend
   *  `true` gezet door `mppReader.ts` (élke `.mpp`-import) — MSPDI/P6/CSV/IFC blijven op de
   *  bestaande P6-semantiek tot een eigen, apart gemeten reden om ze ook om te zetten. */
  resumeFromActualElapsed?: boolean;
  /** B1 (eindreview T16c, dossier (c)4-herdiagnose): MS Project verschuift een NIET-GESTARTE taak
   *  (`completion === 0`) NIET automatisch naar op-of-ná de statusdatum — dat "NIET GESTART:
   *  statusdatum als ondergrens"-gedrag (`CPMSolver.ts`'s forward-pass, vlak vóór
   *  `addDurationChecked`) is P6-eigen RETAINED_LOGIC-semantiek, net als `resumeFromActualElapsed`
   *  hierboven een P6-conventie vervangt voor de VOORTGANG-tak. Bewijs (reviewer-meting,
   *  `calendar-exception-precedence.mpp`, publiek MPXJ-fixture): mét de vloer wijkt de taak ~8 jaar
   *  af van MS Project se eigen opgeslagen Start/Finish (de statusdatum, 2023-05-01, ligt ver ná de
   *  taak se eigen 2015-10-01-anker); zónder de vloer is het resultaat minuut-exact. Een EIGEN,
   *  sibling-vlag i.p.v. hergebruik van `resumeFromActualElapsed` zelf: die twee bestrijken
   *  disjuncte taak-populaties (`completion > 0` resp. `completion === 0`) en een taak kan hooguit
   *  in één van beide vallen — samenvoegen tot één vlag zou geen enkel gedrag delen, alleen de
   *  "MSP-voortgangsconventie i.p.v. P6-RETAINED_LOGIC"-FAMILIE is gedeeld. Default `undefined`/
   *  `false` ⇒ het bestaande, P6-getrouwe gedrag, byte-identiek (bewaakt door dezelfde
   *  `cases-progress.json`-scenario's als `resumeFromActualElapsed`). Uitsluitend `true` gezet door
   *  `mppReader.ts` (élke `.mpp`-import); MSPDI/P6/CSV/IFC blijven op de bestaande P6-semantiek —
   *  het P6-pad (`progressMode`/statusdatum-gedreven planningen) behoudt de vloer bewust: dat is
   *  precies de RETAINED_LOGIC-conventie die P6 zélf documenteert. */
  unstartedIgnoresStatusDate?: boolean;
  /** XER/P6 (diagnose laag 1, klasse (i)): P6 zet een VOLTOOIDE activiteit ook aan de LATE zijde
   *  neer als een taak met nul restduur op de statusdatum — niet op haar historische actual-
   *  venster (dat `preserveActualDatesInBackwardPass` hierboven wél als LS/LF-PIN gebruikt). De
   *  gemeten regel (rehab-2, 2.036 voltooide taken, 99,9% dekking): `LF = prevWorkInstant(LS)` op
   *  de taak-eigen (voortgangs)kalender, en `LS` = de vroegste van de door haar opvolgers
   *  toegestane late finishen — geklemd op de statusdatum (`nextWorkInstant(statusdatum)`) zodat
   *  ze nooit vóór de statusdatum lijkt te vallen. De relatie-lag telt daarbij NIET mee tussen
   *  twee voltooide activiteiten (2.033/2.036), maar WEL zolang de opvolger nog restwerk heeft
   *  (240/2.036 faalt juist zónder die uitzondering). Dat geeft een voltooide activiteit voor het
   *  eerst een zinvolle totale float in plaats van 0, en laat haar backward-druk uitoefenen op
   *  haar eigen voorgangers zoals elke andere taak. Default afwezig/false ⇒ de bestaande
   *  actual-venster-pin blijft behouden, byte-identiek voor IFC/MSPDI/MPP en voor elke XER die
   *  vóór deze vlag is ingelezen en als IFC is opgeslagen. Uitsluitend gezet door `xerReader`
   *  (`xerScheduleOptions.ts`), en alleen effectief onder `p6Source === 'XER'`
   *  (`CPMSolver.p6XerOption`) — exact het `p6FinishMilestoneBoundaryWindow`-stramien.
   *
   *  BEWIJSBASIS (review-bevinding 6, eerlijk afgebakend): de regel is gemeten op precies ÉÉN
   *  corpusbestand. Over het hele XER-corpus komen 2.042 voltooide taken door de venster-poort;
   *  2.040 daarvan staan in `rehab-2.xer`, de twee overige zijn losse mpxj-fixtures met één taak
   *  en zonder ls/lf-orakel. De 591 voltooide taken in de 28 andere corpusbestanden vallen
   *  allemaal buiten de poort (`wrongDurationType` 430, `remainingStartOff` 146, …). Wat de rest
   *  van het corpus beschermt is dus niet de regel maar de NAUWTE van de poort
   *  (`DT_FixedDUR2` + `rem_target_link_flag=Y` + expliciet targetvenster + `CP_Drtn`) — verruimt
   *  iemand die poort, dan landt deze regel in één klap op honderden ongevalideerde taken.
   *
   *  RETAINED LOGIC: élk gemeten corpusbestand draait `RETAINED_LOGIC` (rehab-2 heeft zelfs geen
   *  SCHEDOPTIONS-rij en valt op de defaults terug). Er is dus GEEN meting van P6-gedrag onder
   *  `sched_progress_override = Y`, en evenmin onder P6's "Actual Dates" (N/N).
   *  `deriveXerScheduleOptions` zet de vlag daarom expliciet weer UIT zodra de bron iets anders
   *  dan retained logic declareert (N/Y, N/N, Y/Y of een onbekend token; `declaresRetainedLogic`)
   *  — fail-closed, byte-identiek aan vóór deze etappe. Wie hem daar wil openzetten heeft eerst
   *  een meting onder die modus nodig.
   *
   *  BEWIJSSTATUS (her-review 2026-09-07, bevinding 1): de poort is CORRELATIONEEL, geen
   *  P6-mechanisme. Het enige directe P6-bewijs voor de topologie "open voorganger → voltooide
   *  opvolger" (casus 09 en 10 van `cases-p6-verified.json`, echt P6 23.12) spreekt de regel
   *  tegen zodra de poort daar opengaat: P6 geeft de open voorganger tf 0, deze regel tf −5.
   *  Op de echte bron (`cases-import.xer`: `DT_FixedDrtn`, geen `target_end_date`) blijft de
   *  poort dicht op `wrongDurationType`/`missingExplicitTargetWindow`; dat is een toevallige
   *  nauwte, geen semantische verzoening. Zie plan §5 X-O7 laag 1. */
  p6CompletedLateFromRemainingWindow?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string; // ISO 8601
  endDate: string;
  calendarId: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
  company: string;
  /** Projectstandaard voor handmatig aangemaakte taken. De urenplanning-hoofdschakelaar blijft de
   *  capabilitypoort: staat die uit, dan maakt de UI ondanks deze bewaarde voorkeur dagtaken. */
  defaultTaskDurationUnit?: import('@/types/task').TaskDurationUnit;
  /**
   * WBS-codes automatisch nummeren (1.2.3.4, afgeleid uit de boompositie): aan ⇒ live
   * hernummeren bij elke structuurmutatie; uit/ontbreekt ⇒ vrije tekst (bestaand gedrag),
   * met een expliciete "Hernummer WBS"-actie. Nieuwe projecten krijgen true; geladen
   * bestanden zonder vlag blijven op vrije tekst (MSP-stabiliteitsmodel: codes in
   * omloop worden niet stilzwijgend herschreven).
   */
  wbsAutoNumber?: boolean;
  /** P6 "data date" (fase 2.6): de grens verleden/toekomst. undefined = geen statusdatum ⇒ gedrag
   *  exact als vóór 2.6. Gezet ⇒ remaining werk kan niet vóór deze dag starten. */
  statusDate?: string;    // ISO — date-only in dag-modus; mag datetime zijn in uur-modus (fase 2.8b, §3.4)
  /** Voortgangs-scheduling-modus (fase 2.6). undefined ⇒ RETAINED_LOGIC. Documentinstelling. */
  progressMode?: ProgressMode;
  /** OPTIONEEL — project-scoped reken-opties (fase 2.9, §3.4/§7). Afwezig ⇒ elke default ⇒
   *  byte-identiek gedrag. */
  schedulingOptions?: SchedulingOptions;
  /** OPTIONEEL — projectbinding aan een bedrijfsbibliotheek (spec B1, §2). Afwezig ⇒ project is
   *  (nog) aan geen enkel bedrijf gebonden; heropening zonder de pool is onschuldig. `companyName`
   *  is een gedenormaliseerde cache zodat een gedeeld bestand het bedrijf toont zonder de pool. */
  companyId?: string;
  companyName?: string;
}

export interface ProjectStats {
  totalTasks: number;
  totalMilestones: number;
  criticalPathLength: number; // in work days
  totalFloat: number; // in work days
  percentComplete: number; // 0-100
}
