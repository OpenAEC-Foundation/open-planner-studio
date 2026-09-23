/** Voortgangs-scheduling-modus (P6, fase 2.6). undefined ⇒ RETAINED_LOGIC (de default). */
export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

/**
 * Project-scoped reken-opties (fase 2.9, §3.4/§7). ELKE default = het huidige gedrag ⇒ een afwezig
 * (of leeg) blok is byte-identiek aan vóór 2.9. Deze opties horen bij het BESTAND (net als
 * statusDate/progressMode), niet bij de app-settings — anders zou hetzelfde bestand op twee machines
 * een ander schema geven (§7). De solver leest ze via `CPMOptions.schedulingOptions`.
 */
export interface SchedulingOptions {
  /** Kalender voor relatie-lag (P6 4-way, Rapport B §7.1). Default 'predecessor' ⇒ byte-identiek
   *  met de oude vaste voorgangerskalender. LET OP (XER-etappe X5, eindreview bevinding 5): tot
   *  september 2026 was dit een dode instelling — de UI bood de keuze en het IFC bewaarde haar, maar
   *  de solver las een constante. Sinds `relDeps.lagEngine` (`CPMSolver.ts`) is ze effectief, voor
   *  ELK formaat en niet alleen achter de XER-bronmarkering: een bestaand document waarin ooit 'successor',
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
   *  Afwezig/false houdt de algemene/MSP-conventie byte-identiek.
   *  A15 — sinds rekenprofielen baan B is de vlag zelf de conventie, zonder bronpoort.
   *  P6 aan / MS Project uit / OPS uit. */
  p6ZeroDurationUsesPlannedBoundary?: boolean;
  /** XER TASK.target_start_date kan bij P6 naast het netwerk een geplande vloer vertegenwoordigen,
   *  maar alleen wanneer start én finish meer dan één kalenderdag later liggen dan de berekende
   *  netwerkgrens. Een gewone volgende-bandstart is geen vrije planning en activeert deze regel
   *  niet. Alleen XER zet de vlag; andere bronnen houden de generieke netwerksemantiek.
   *  A16 — sinds rekenprofielen baan B is de vlag zelf de conventie, zonder bronpoort.
   *  P6 aan / MS Project uit / OPS uit. */
  p6UseTaskPlannedStartFloor?: boolean;
  /** P6 kan een TT_FinMile als twee aangrenzende kalendergrenzen opslaan (ES op bandstart,
   *  EF op het vorige bandeinde). Alleen XER activeert deze representatie.
   *  A17 — sinds rekenprofielen baan B is de vlag zelf de conventie, zonder bronpoort.
   *  P6 aan / MS Project uit / OPS uit. */
  p6FinishMilestoneBoundaryWindow?: boolean;
  /** XER/P6: geregistreerde actual start/finish zijn broninstants en worden niet naar een
   *  kalenderband genormaliseerd. Default afwezig houdt de bestaande formaatsemantiek.
   *  A18 — sinds rekenprofielen baan B is de vlag zelf de conventie, zonder bronpoort.
   *  P6 aan / MS Project uit / OPS uit. */
  p6PreserveActualInstants?: boolean;
  /** XER/P6 bewaart Actual Start als historie, maar de zesassige Early/Late Start van een lopende
   *  activiteit beschrijft de start van het resterende werk (`max(statusdatum, relatiegrens)`).
   *  Alleen het XER-importpad zet deze bronvlag; andere formaten blijven hun bestaande zichtbare
   *  actual-startvenster gebruiken.
   *  A19 — conventie (spec v3); sinds rekenprofielen baan B is de vlag zelf de conventie, zonder
   *  bronpoort. P6 uit (standaard; de XER-lezer zet hem per bestand als override uit
   *  `rem_target_link_flag`) / MS Project uit / OPS uit. */
  p6UseRemainingStartForProgress?: boolean;
  /** XER/P6: een datetime-SNLT/MSO/FNLT/MFO op een nulduurmijlpaal is een exact bronpunt,
   *  ook wanneer dat punt de inclusieve start van een werkband is. Default uit.
   *  A20 — sinds rekenprofielen baan B is de vlag zelf de conventie, zonder bronpoort.
   *  P6 aan / MS Project uit / OPS uit. */
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
   *  (`xerScheduleOptions.ts`). Sinds rekenprofielen baan B is de vlag zelf de conventie (geen
   *  bronpoort meer); hij werkt alleen samen met `p6CompletedDataDateWindow` (B3), want de regel
   *  meet tegen dat statusdatumvenster.
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

  // ── Groep B (rekenprofielen baan B, spec 2026-09-22 bijlage A) ─────────────────────────────
  // Vijf P6-conventies die tot baan B alleen achter de XER-bronmarkering stonden. Elk: P6 aan /
  // MS Project uit / OPS uit. Sinds C3 komen ze uitsluitend uit het rekenprofiel; een oud bestand
  // met de bronmarkering migreert via `legacyOptionsToProfile` (B1–B5 aan).

  /** B1 — FS-nul-lag op een gedeelde bandgrens: een relatie met
   *  `Sequence.p6StartAtPredecessorFinishBoundary` laat de opvolger op de finishgrens van de
   *  voorganger starten (forward) en spiegelt dat backward (`relationMath`, `CPMSolver`'s
   *  `snapSuccessorEarlyStart` via `preserveP6FinishBoundary`). Staat de conventie uit, dan stript
   *  de `CPMSolver`-constructor die relatievlag en heeft ze geen enkel effect.
   *  P6 aan / MS Project uit / OPS uit. */
  p6RelationFinishBoundary?: boolean;
  /** B2 — backward WORKTIME-lag vanaf een exacte bandeinde-grens die precies op een bandstart
   *  landt, geeft de complementaire vorige finishgrens terug (wo 17:00 − 2 werkdagen = ma 17:00,
   *  niet di 08:00; `CPMSolver.shiftLagPred`). Alleen uurmodus, alleen de aftrek met positieve lag.
   *  P6 aan / MS Project uit / OPS uit. */
  p6BackwardLagFinishBoundary?: boolean;
  /** B3 — een voltooide XER-bladactiviteit (nauwe provenance-poort in
   *  `explainP6CompletedDataDateWindow`) krijgt ES/EF als statusdatumvenster, dat venster telt mee
   *  voor het projecteinde (`CPMSolver.backwardPass`) en de float-weergave (`scheduleAnalysis`).
   *  Schakelt ook de diagnose-trace `backwardFloatTrace` in. Werkt alleen samen met
   *  `p6UseRemainingStartForProgress`. P6 aan / MS Project uit / OPS uit. */
  p6CompletedDataDateWindow?: boolean;
  /** B4 — een voltooide LOE met alleen SS-ingang en zonder opvolger volgt de actual-finish-route
   *  i.p.v. de hammockroute (`explainCompletedXerLoeActualFinishEligibility`, `CPMSolver`'s
   *  forward pass). Werkt alleen samen met `p6UseRemainingStartForProgress`,
   *  `preserveActualDatesInBackwardPass` en `p6PreserveActualInstants`.
   *  P6 aan / MS Project uit / OPS uit. */
  p6CompletedLoeActualFinish?: boolean;
  /** B5 — een niet-gestarte LOE met volledig targetvenster, alleen nul-lag SS-ingang en nul-lag
   *  FF-uitgang neemt dat targetvenster als span (`explainOpenXerLoeTargetSpanEligibility`,
   *  `CPMSolver`'s hammocktak). P6 aan / MS Project uit / OPS uit. */
  p6OpenLoeTargetSpan?: boolean;

  // ── Groep C (X12 naar nul, 2026-09-23): conventies die pas ná de rekenprofielen uit de
  // corpusmeting kwamen. Nooit achter een bronmarkering geweest. Een P6-profiel zet ze aan (ook een
  // legacy-XER-blob, die naar het P6-profiel migreert); een profiel-pset van vóór 2026-09-23 die de
  // sleutel niet kent krijgt `legacyValue` = uit.

  /** C1 — RETAINED LOGIC rond de statusdatum: een VOLTOOIDE voorganger houdt zijn opvolgers niet
   *  langer vast dan de statusdatum. Ligt zijn werkelijke einde ná de statusdatum (P6 laat zo'n
   *  actual toe; de statusdatum is het instant waarop het restwerk begint), dan geldt voor de
   *  RELATIEGRENS naar zijn opvolgers de werkgrens vlak vóór de statusdatum als einde
   *  (`prevWorkInstant(snapOnOrAfter(statusdatum))` op zijn voortgangskalender — dezelfde grens als
   *  het statusdatumvenster van conventie B3). Zijn eigen weergegeven datums veranderen niet;
   *  werkelijke einden op of vóór de statusdatum ook niet.
   *
   *  - P6: aan. Oracle P6 Professional Help, "Using the data date": "The data date is the last
   *    date you recorded progress in the form of actual dates …", "Activities are scheduled from
   *    the project data date" en "Work accomplished on the data date is not included because it is
   *    the beginning of the period" (docs.oracle.com/cd/G18296_01/client_help, `using_the_data_date`).
   *    Onder Retained Logic rekent P6 het restwerk na de voorgangers, maar een voltooide voorganger
   *    heeft geen restwerk: zijn voortgang ligt per definitie vóór de statusdatum. Gemeten:
   *    `rehab-2.xer` (P6 6.0), vijf voltooide taken met `act_end_date` 2008-05-27 17:00 bij
   *    statusdatum 2008-05-27 00:00; P6 start hun opvolgers op 05-27 08:00, niet 05-28 (plan XER §9
   *    dossier 7b-4, classificatie brok B02; 1.301 cellen zonder B01, 0 slechter samen met C2).
   *  - MS Project: uit. MS Project rekent een koppeling vanaf de (werkelijke) Finish van de
   *    voorganger; de statusdatum verschuift alleen onvoltooid werk via Project → Update Project →
   *    "Reschedule uncompleted work to start after". Hetzelfde MSP-gedrag ligt al vast in
   *    `unstartedIgnoresStatusDate` (MSP aan).
   *  - OPS: uit (het gedrag van vóór deze conventie: de relatie rekent vanaf het werkelijke einde). */
  p6CompletedPredecessorAtDataDate?: boolean;
  /** C2 — de vrije speling van een niet-voltooide taak over een FS-nul-lag-relatie telt in de
   *  kalender van de TAAK zelf (werktijd tussen haar vroege einde en de vroege start van de
   *  opvolger), niet in die van de opvolger. Een FS-nul-lag-relatie naar een VOLTOOIDE opvolger
   *  (buiten volgorde) laat geen speling: P6 legt diens nul-restvenster direct achter de taak.
   *  Alleen uurmodus, alleen FS met lag 0; andere relatietypes en voltooide taken houden de
   *  bestaande berekening.
   *
   *  - P6: aan. Oracle P6 Help, "View activity float values": free float is "the maximum number of
   *    hours or days an activity can be delayed without also delaying the early start dates of any
   *    immediate successor activities" — uitstel van de ACTIVITEIT, dus op haar eigen kalender
   *    (net als totale speling hier al per taak op de eigen kalender rekent). Gemeten: op P6's eigen
   *    datums is P6-FF = werkminuten tussen EF en de vroegste opvolger-ES op de taakkalender in alle
   *    362 ff-cellen met een andere opvolgerkalender (Hotel, rehab-2, Roads, DCP-03; classificatie
   *    brok B06); samen met C1 471 ff-cellen beter, 0 slechter.
   *  - MS Project: uit. Ons MPP-orakel meet alleen start en einde, niet de vrije speling; zonder
   *    meting verandert het MSP-profiel niet.
   *  - OPS: uit (relatie-vrije-speling in de kalender van de opvolger, `scheduleAnalysis`). */
  p6FreeFloatOnOwnCalendar?: boolean;
  /** C3 — RETAINED LOGIC, late kant: van een positieve WORKTIME-lag uit een VOLTOOIDE voorganger
   *  (op de statusdatum-restvensterroute, `p6CompletedLateFromRemainingWindow`) telt achterwaarts alleen
   *  het deel dat na zijn werkelijke einde op de statusdatum nog niet verstreken is:
   *  `max(0, lag − werktijd(werkelijk einde → statusdatum))` in de lag-kalender (`CPMSolver`).
   *
   *  - P6: aan. Zelfde bron als C1 ("Using the data date": voortgang ligt vóór de statusdatum, er wordt
   *    vanaf de statusdatum gepland) — het verstreken deel van de lag is historie. Gemeten: rehab-2,
   *    gelagde FS-relaties uit voltooide voorgangers (classificatie brok B03): volledig verstreken lag
   *    (V3122120 → V3122070, FS+168 h, einde 04-15) ⇒ P6 trekt niets af; niet verstreken
   *    (V3238110, einde 05-26 17:00, FS+120 h) ⇒ de volle lag; deels verstreken (V3120120, FS+168 h):
   *    de afstand LF → opvolger-LS is gelijk aan die van P6 (die cel zelf wacht op brok B01, de LS van
   *    de opvolger). Samen 351 cellen (ls 122, lf 122, tf 107), 0 slechter; de rest van brok B03 hangt
   *    aan B01 of aan actieve taken met restduur 0 (buiten deze conventie).
   *    Alleen de B3-restvensterroute; een voltooide taak op de generieke actual-pin houdt de volle lag.
   *  - MS Project: uit. MS Project kent geen late-kant-statusdatumvenster voor voltooide taken (zie C1).
   *  - OPS: uit (de volle lag, het gedrag van vóór deze conventie). */
  p6CompletedRemainingLag?: boolean;
  /** C4 — RETAINED LOGIC voor een voltooide activiteit buiten volgorde (out-of-sequence): het
   *  nul-restvenster van een voltooide taak op de statusdatumroute (conventie B3,
   *  `explainP6CompletedDataDateWindow`) ligt niet vóór de relatiegrens van een voorganger die nog
   *  niet klaar is. Voor elke FS- of SS-relatie uit een open voorganger (of uit een voltooide
   *  voorganger die zelf zo'n verschoven venster heeft) telt de gewone voorwaartse relatiegrens; het
   *  venster begint op de laatste van die grenzen en de statusdatum (`CPMSolver`, alleen bij
   *  Retained Logic, dus niet onder `progressMode: 'PROGRESS_OVERRIDE'`). Het verschoven venster
   *  bepaalt de weergave (ES/EF, en daarmee de speling) en de relatiegrens naar de opvolgers; de
   *  late kant blijft ongewijzigd. FF/SF-relaties naar zo'n taak doen (nog) niet mee: ongemeten.
   *
   *  - P6: aan. Oracle P6 Professional Help, "General tab - Schedule Options dialog box": "Retained
   *    Logic: The remaining duration of a progressed activity is not scheduled until all of its
   *    predecessors are finished" (docs.oracle.com/cd/F25600_01/client_help, `general_tab_-_
   *    schedule_options_dialog_box`); de restduur 0 van een voltooide activiteit valt daar ook onder.
   *    Gemeten: `rehab-2.xer`, 36 voltooide of actieve taken met restduur 0 en een onvoltooide
   *    voorganger (classificatie brok B04): P6 zet ES op de eerste werkgrens ná de relatiegrens
   *    (bv. V3117130: voorganger V3209135 EF 08-19 17:00 ⇒ ES 08-20 08:00 / EF 08-19 17:00; met
   *    FS+240 h en SS evenzo), niet op de statusdatum 05-27.
   *  - MS Project: uit. Een voltooide taak houdt in MS Project haar werkelijke Start en Finish; de
   *    koppeling naar een onvoltooide voorganger verschuift alleen onvoltooid werk.
   *  - OPS: uit (het venster op de statusdatum, het gedrag van vóór deze conventie). */
  p6CompletedOutOfSequenceWindow?: boolean;
  /** C6 — een FF-relatie naar een STARTmijlpaal (nulduur, `milestoneKind: 'START'`; in P6 een
   *  `TT_Mile`) bindt in de terugwaartse berekening aan de LATE FINISH van die mijlpaal zelf. Zonder
   *  deze conventie behandelt de motor een startmijlpaal als dagbegin-anker: de late finish van de
   *  FF-voorganger moet dan op de werkgrens vóór dat anker liggen (`relationMath.backwardHour`,
   *  `snapStrictBefore` plus de lag-0-normalisatie ⇒ het begin van de mijlpaaldag), en voorwaarts
   *  op de werkgrens strikt ná de voorgangerfinish (`forwardHour`, `snapStrictAfter`), wat de vrije
   *  speling van de voorganger een werkdag korter maakt. Met de conventie vervallen beide sprongen:
   *  de FF-grens is de late finish van de mijlpaal zelf, resp. de voorgangerfinish zelf. Alleen in
   *  uur-modus aan beide kanten; een eindmijlpaal (`TT_FinMile`) blijft ongewijzigd.
   *
   *  - P6: aan. Gemeten: `Roads_Project_TEC.xer`, vijf voorgangers (OCEC11971, OCEC11851,
   *    OCEC18821, OCEC11911, OCEC18751), elk met `PR_FF` lag 0 naar de `TT_Mile` OCEC12101
   *    (ES 2014-01-15 07:00, LS = LF 2014-01-15 16:00): P6 zet hun LF op 2014-01-15 16:00, de late
   *    finish van de mijlpaal, niet op 07:00 (classificatiebrok B08); hun vrije speling telt P6 tot
   *    de mijlpaal zelf (OCEC11971: 32.400 min, zonder conventie 31.800). FF-relaties naar een
   *    `TT_FinMile` (34 in het corpus) staan zonder deze regel al goed en worden niet geraakt.
   *  - MS Project: uit. MS Project kent geen apart dagbegin-anker voor een startmijlpaal in de late
   *    berekening van een FF-relatie; ongemeten, dus het gedrag van vóór deze conventie.
   *  - OPS: uit (de werkgrens vóór het dagbegin van de mijlpaal, het gedrag van vóór deze conventie). */
  p6FinishFinishStartMilestoneLateFinish?: boolean;
  /** C7 — de geplande-startvloer van A16 (`p6UseTaskPlannedStartFloor`: `TASK.target_start_date`
   *  als vloer zodra het geplande venster ruim ná de netwerkgrens ligt) geldt niet voor een LOPENDE
   *  taak (werkelijke start, voortgang < 100%). Haar resterende werk begint dan op de statusdatum en
   *  de relatiegrens uit haar voorgangers (`CPMSolver.forwardPass`, voortgangstak: `remStart`), en
   *  haar opvolgers volgen. Zonder deze conventie tilt A16 ook een lopende taak naar haar geplande
   *  start. Leest geen `restart_date` (bak 2, `check-xer-field-whitelist.ts`): P6's opgeslagen
   *  herstart is alleen de meetlat.
   *
   *  - P6: aan. Gemeten op P6-doorgerekende bestanden (classificatiebrok B11):
   *    `eh_P6Workshops/OZB-Start-09Dec24.xer`, projecten 9032 en 10096 (statusdatum 2024-12-23
   *    08:00): de lopende OZ1040 (target_start 12-30 08:00) start in P6 op 12-24 12:00, het einde van
   *    haar lopende voorganger OZ1030; zonder conventie 12-30 08:00, en de keten OZ1050–OZ1130 schuift
   *    mee. `Roads_Project_TEC.xer`: de lopende B3071 en B2591 (target 05-01 resp. 05-05) starten op
   *    de statusdatum 2013-04-23 07:00. `rehab-2.xer` telt hier niet mee: zijn orakel is P3-uitvoer,
   *    geen P6.
   *  - MS Project: uit. A16 is een P6-conventie; het MS Project-profiel kent de vloer niet, dus deze
   *    uitzondering erop is daar zonder betekenis. Het gedrag van vóór deze conventie.
   *  - OPS: uit (het gedrag van vóór deze conventie). */
  p6StartedTaskIgnoresPlannedStartFloor?: boolean;
  /** C9 — een niet-gestarte ALAP-activiteit (`constraint.type === 'ALAP'`, P6 `CS_ALAP`) krijgt als
   *  vroege finish de strengste grens die haar opvolgers met hun VROEGE datums via de gewone
   *  achterwaartse relatiewiskunde toestaan (zonder opvolger: haar late finish), en als vroege start
   *  die finish min haar duur — in werktijd op de minuut, niet in hele werkdagen. Opvolgers eerst
   *  (omgekeerde topologische volgorde), zodat een keten van ALAP-taken aaneensluit; de opvolgers
   *  zelf bewegen niet. Ondergrens: de relatiegrenzen van haar voorgangers en de statusdatum. Haar
   *  eigen geplande venster telt niet: een ALAP-wortel start voorwaarts op de statusdatum, niet op
   *  haar eigen anker, en de geplande-startvloer van A16 geldt niet voor haar
   *  (`CPMSolver.forwardPass`, `applyAlapFromSuccessors`). Een gestarte of voltooide ALAP-taak houdt
   *  haar werkelijke datums. Alleen uurkalenders.
   *
   *  - P6: aan. Oracle P6 Help, constraint "As Late As Possible": de activiteit wordt zo laat
   *    ingepland als kan zonder haar opvolgers te vertragen, dus binnen haar vrije speling. Gemeten
   *    (classificatiebrok B12): `HarbourPointe_AssistedLiving.xer` (P6-doorgerekend), de ALAP-keten
   *    EC1420 (startmijlpaal zonder voorganger, target 2011-06-27 07:00) → EC1430 → EC1810 (beide
   *    ALAP, 720 u) → EC2090: P6 zet EC1810 op EF 2012-03-06 16:49 = de start van EC2090, en EC2090
   *    zelf op zijn geplande start (A16), niet achter het geplande venster van EC1420. Zonder deze
   *    conventie staat EC1420 op haar eigen target en schuift de hele keten (EC1430 … EC2400) enkele
   *    werkdagen later; met de conventie worden 27 cellen exact (es/ef/tf/ff), 0 slechter.
   *    `Hotel_Construction_TEC.xer` (vier ALAP-taken) verandert niet: daar vallen de geplande datums
   *    al samen met de ALAP-positie. Wat niet klopt: EC1420/EC1430 zelf komen op ES 2011-06-21 16:49
   *    (720 werkuren vóór EC1810), P6 toont 06-24 16:49 — een span van 696 werkuren op dezelfde
   *    kalender; ongeklaard.
   *  - MS Project: uit. MS Project plant ALAP vanaf de late datums van de taak (zijn eigen
   *    ALAP-semantiek, niet gemeten tegen ons MPP-orakel); het gedrag van vóór deze conventie.
   *  - OPS: uit (de oude stap: de vroege datums schuiven in hele werkdagen op met de vrije speling,
   *    in topologische volgorde, ook bij een gestarte taak). */
  p6AlapPositionedFromSuccessors?: boolean;
}

/**
 * Rekenprofielen (spec 2026-09-22 v3, tweelagenmodel): de tweeëntwintig PAKKETCONVENTIES — regels die per
 * planningspakket verschillen en niet per bestand. Ze leven in het profiel (`Project.schedulingProfile`),
 * niet in `Project.schedulingOptions`; die draagt de per-bestand projectinstellingen. De twee
 * sleutelverzamelingen zijn disjunct (compile-time bewaakt in `conventions/registry.ts`).
 */
export type ConventionKey =
  | 'preserveActualDatesInBackwardPass'
  | 'clampNegativeFreeFloat'
  | 'p6ZeroDurationUsesPlannedBoundary'
  | 'p6UseTaskPlannedStartFloor'
  | 'p6FinishMilestoneBoundaryWindow'
  | 'p6PreserveActualInstants'
  | 'p6PreserveZeroDurationConstraintInstants'
  | 'p6UseRemainingStartForProgress'
  | 'resumeFromActualElapsed'
  | 'unstartedIgnoresStatusDate'
  | 'p6RelationFinishBoundary'
  | 'p6BackwardLagFinishBoundary'
  | 'p6CompletedDataDateWindow'
  | 'p6CompletedLoeActualFinish'
  | 'p6OpenLoeTargetSpan'
  | 'p6CompletedPredecessorAtDataDate'
  | 'p6FreeFloatOnOwnCalendar'
  | 'p6CompletedRemainingLag'
  | 'p6CompletedOutOfSequenceWindow'
  | 'p6FinishFinishStartMilestoneLateFinish'
  | 'p6StartedTaskIgnoresPlannedStartFloor'
  | 'p6AlapPositionedFromSuccessors';

/** De negen per-bestand projectinstellingen: alles in `SchedulingOptions` behalve de conventies. */
export type ProjectOptionKey = Exclude<keyof SchedulingOptions, ConventionKey>;

/** Wat `Project.schedulingOptions` in het eindmodel draagt: uitsluitend projectopties. */
export type ProjectSchedulingOptions = Pick<SchedulingOptions, ProjectOptionKey>;

/** De volledig opgeloste set conventies: élke conventie heeft een waarde. */
export type SchedulingConventions = Required<Pick<SchedulingOptions, ConventionKey>>;

/** Een `OPS_SchedulingOptions`-blob zoals oudere bestanden hem schreven: met de XER-herkomstmarkering
 *  (en eventueel conventiesleutels). Alleen de IFC-lezer en `legacyOptionsToProfile` zien dit type;
 *  de motor en de state nooit. */
export type LegacySchedulingOptions = SchedulingOptions & { p6Source?: 'XER' };

/** De ene set die de solver krijgt: projectopties + alle opgeloste conventies. Een kale
 *  `SchedulingOptions` is hier bewust NIET aan toewijsbaar (de conventies zijn verplicht), zodat
 *  niemand het profiel per ongeluk overslaat. */
export type EffectiveSchedulingOptions = ProjectSchedulingOptions & SchedulingConventions;

/** De drie ingebouwde basisprofielen. */
export type BuiltInProfileId = 'p6' | 'msproject' | 'ops';

/**
 * Een rekenprofiel: een ingebouwde basis plus uitsluitend de afwijkingen daarvan. De opgeloste set
 * staat nooit dubbel in de state (`resolveConventions`). Eigen profielen matchen op `id`, nooit op
 * naam; een project draagt zijn eigen kopie (sjablonen in `ops-schedulingProfiles` werken niet door).
 */
export interface SchedulingProfile {
  baseId: BuiltInProfileId;
  /** 'p6' | 'msproject' | 'ops' voor een ingebouwd profiel, anders een eigen id. */
  id: string;
  /** Weergavenaam van een EIGEN profiel. Ingebouwde profielen hebben een i18n-naam
   *  (`profiles.builtIn.<id>`) en dragen dit veld leeg; het wordt nooit vertaald weggeschreven. */
  name: string;
  overrides: Partial<SchedulingConventions>;
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
   *  byte-identiek gedrag. Sinds rekenprofielen C3 alleen projectopties: de conventies staan in
   *  `schedulingProfile`. */
  schedulingOptions?: ProjectSchedulingOptions;
  /** OPTIONEEL — rekenprofiel (spec rekenprofielen, tweelagenmodel): de pakketconventies. Afwezig ≡
   *  het ingebouwde `ops`-profiel zonder afwijkingen, en zo blijft een bestaand bestand zonder
   *  `OPS_SchedulingProfile` byte-identiek. De solver krijgt één set via
   *  `effectiveSchedulingOptions(project)` (`engine/scheduler/conventions/registry.ts`). */
  schedulingProfile?: SchedulingProfile;
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
