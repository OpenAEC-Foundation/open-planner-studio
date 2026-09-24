/** Voortgangs-scheduling-modus (P6, fase 2.6). undefined ⇒ RETAINED_LOGIC (de default). */
export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

/** Eén sleutel uit de nivelleerprioriteitslijst (P6 "Leveling priorities"; bovenste wint). */
export interface LevelingPriorityKey {
  /** De bronveldnaam LETTERLIJK zoals het bestand hem noemt (P6: een TASK-/PROJECT-kolomnaam zoals
   *  `priority_type`), ongeïnterpreteerd. Wat een sleutel betekent en welke waarde hij straks leest
   *  (altijd de EIGEN berekening, nooit opgeslagen P6-rekenuitvoer: bak 4) beslist de nivelleeretappe. */
  field: string;
  direction: 'ASC' | 'DESC';
}

/** Eén resource uit de nivelleerlijst (P6 RSRCLEVELLIST, "Select resources"). */
export interface LevelingResourceSetting {
  /** Interne resource-id van dit document (XER: `xer-resource:<rsrc_id>`). De IFC-lezer regenereert
   *  resource-ids en mapt deze via de GlobalId terug (`ifcReader.remapLevelingResourceIds`), net als
   *  `TaskTimephasedContour.resourceId`. Een id zonder resource (bv. na verwijderen) blijft staan. */
  resourceId: string;
  /** P6 Max Units/Time (`RSRCRATE.max_qty_per_hr`), alleen als alle tariefrijen van deze resource
   *  dezelfde waarde dragen; anders afwezig (de tijdsafhankelijke waarde staat in
   *  `Resource.availabilitySteps`). Eenheden per uur. */
  maxUnitsPerHour?: number;
}

/**
 * Nivelleerinstellingen als DATA (etappe P6-nivellering, fundament). Het bestand zegt niet óf P6
 * genivelleerd heeft (onderzoek §2b: OZB 9045/9047/9049 dragen dezelfde instellingen als het wél
 * genivelleerde 9033), dus dit blok is de dialoog "Level Resources", niet een nivelleerrun.
 * Er is bewust GEEN aan/uit-veld: of nivelleren een projectoptie of een eigen knop wordt is
 * eigenaarsbeslissing 1 (open). Een vroegtijdig verplicht `enabled: false` zou in opgeslagen IFC's
 * vastzitten. Niets leest dit blok: het heeft vandaag geen rekeneffect.
 */
export interface LevelingSettings {
  /** P6 "Preserve scheduled early and late dates" (`SCHEDOPTIONS.level_keep_sched_date_flag`). */
  preserveScheduledDates?: boolean;
  /** P6 "Level all resources" (`SCHEDOPTIONS.level_all_rsrc_flag`); uit ⇒ alleen `resources`. */
  levelAllResources?: boolean;
  /** P6 `SCHEDOPTIONS.LevelPriorityList`, in bronvolgorde; `[]` = kolom aanwezig maar leeg (P6 sorteert
   *  dan op Activity ID). */
  priority?: LevelingPriorityKey[];
  /** P6 RSRCLEVELLIST voor de SCHEDOPTIONS-rij van dit project, in bronvolgorde; alleen aanwezig als
   *  de lijst rijen draagt. */
  resources?: LevelingResourceSetting[];
}

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
   *  P6: uit — geen effect op P6-doorgerekende bestanden; gebouwd op rehab-2 (P3). Sinds 2026-09-23
   *  (eigenaarsvraag §1d-7) uit in elk ingebouwd profiel; gemeten 0 cellen, X12 blijft 192.
   *  P6 uit / MS Project uit / OPS uit. */
  p6FinishMilestoneBoundaryWindow?: boolean;
  /** XER/P6: geregistreerde actual start/finish zijn broninstants en worden niet naar een
   *  kalenderband genormaliseerd. Default afwezig houdt de bestaande formaatsemantiek.
   *  A18 — sinds rekenprofielen baan B is de vlag zelf de conventie, zonder bronpoort.
   *  P6 aan / MS Project uit / OPS uit. */
  p6PreserveActualInstants?: boolean;
  /** XER/P6 bewaart Actual Start als historie, maar de zesassige Early/Late Start van een lopende
   *  activiteit beschrijft de start van het resterende werk (`max(statusdatum, relatiegrens)`).
   *  Onder het MS Project- en OPS-profiel blijven lopende taken hun bestaande zichtbare
   *  actual-startvenster gebruiken.
   *  A19 — conventie (spec v3); sinds rekenprofielen baan B is de vlag zelf de conventie, zonder
   *  bronpoort. P6 AAN / MS Project uit / OPS uit — sinds 2026-09-24 (eigenaarsbesluit "a",
   *  Fable-critreview PR #169 bevinding 2): in de zeven P6-doorgerekende bestanden hebben alle 60
   *  lopende taken `early_start_date == restart_date`, 0× `== act_start_date`. Tot dan was de P6-basis
   *  uit en zette de XER-lezer A19 per bestand aan bij `PROJECT.rem_target_link_flag` = Y; die koppeling
   *  was nooit getoetst (corpus: Y = 62, N = 0, leeg = 40 projecten, alle lege zonder P6-uitvoer) en is
   *  vervallen: de lezer leest de vlag alleen nog als diagnose. [VERMOED · hoog, Oracle-doc niet
   *  geraadpleegd] het P6-veld is `LinkPlannedAndAtCompletionFlag`, een eenheden-/kostenkoppeling en
   *  geen datumregel. Of een P6-bestand dat écht anders rekent bestaat, is onbekend: er is geen
   *  P6-doorgerekend bestand met N.
   *  Late kant (X12 brok 6, 2026-09-23) — de restduurregel: P6 plant een lopende activiteit op haar
   *  RESTduur ("The total working time from the activity remaining start date to the remaining finish
   *  date", Oracle P6 Help, Durations Columns, https://docs.oracle.com/cd/F37125_01/p6help/en/47223.htm).
   *  Achterwaarts over een SS-relatie is de late finish van een lopende voorganger dus de late start die
   *  de relatie toelaat plus de restduur, niet plus de volle geplande duur; rest 0 ⇒ LS = LF
   *  (`CPMSolver.remainingDurationTaskForStartRelation`). Het is een gedocumenteerd P6-principe, niet
   *  uit het bestand afgeleid, maar het corpusbewijs is smal: ÉÉN relatie, `Roads_Project_TEC.xer`
   *  OCEC11731 (lopend, rest 0) —SS+70 h→ OCEC12121 (LS 08-18 16:00) ⇒ P6 LS = LF = 08-18 16:00, met het
   *  CP_Phys-punt OCEC11721 ervóór (5 cellen, 0 slechter, X12 298 → 293). De 7 andere lopende
   *  SS-voorgangers in het corpus hebben rest = gepland en onderscheiden de varianten niet. SF valt er
   *  bewust buiten (geen enkel geval, niet gepind). Het ene bewijsbestand heeft
   *  `rem_target_link_flag` = Y; of de regel ook bij een andere waarde van die vlag geldt, is ongetoetst
   *  (er is geen P6-doorgerekend bestand met N). */
  p6UseRemainingStartForProgress?: boolean;
  /** XER/P6: een datetime-SNLT/MSO/FNLT/MFO op een nulduurmijlpaal is een exact bronpunt,
   *  ook wanneer dat punt de inclusieve start van een werkband is. Default uit.
   *  A20 — sinds rekenprofielen baan B is de vlag zelf de conventie, zonder bronpoort.
   *  P6 aan / MS Project uit / OPS uit. */
  p6PreserveZeroDurationConstraintInstants?: boolean;
  /** XER/P6: gebruik PROJECT.plan_end_date als late-pass-anker wanneer
   *  SCHEDOPTIONS.sched_use_project_end_date_for_float=Y. De datum zelf blijft project.endDate;
   *  deze vlag bepaalt uitsluitend of de solver hem voor float gebruikt. Default uit. Zonder
   *  plan_end_date valt de lezer terug op het taak-afgeleide einde (max target_end_date); heeft het
   *  bestand ook geen enkele target_end_date, dan zet de lezer de vlag gerapporteerd uit (X12-brok 1,
   *  plan XER §9) zodat de solver op max(EF) verankert zoals P6 zonder Must Finish By. */
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
   *  meet tegen dat statusdatumvenster. Sinds 2026-09-23 (eigenaarsvraag §1d-7) staat B3 in elk
   *  ingebouwd profiel uit: deze projectoptie (P6-default true) is daarmee onder het P6-profiel
   *  INERT (`explainP6CompletedLateRemainingWindowEligibilityResolved` ⇒ `conventionOff`) en doet
   *  pas iets als B3 in een eigen profiel of als afwijking aan staat. Geen gedragswijziging: gemeten
   *  0 cellen op de P6-doorgerekende orakels.
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
  /** Projectoptie "Calculate Start-to-Start lag from" (P6, Schedule Options; plan XER §9, vervolgpunt
   *  X12 brok 3). Kiest de VARIANT van conventie C6 (`p6InProgressStartLagElapsed`); de conventie zelf
   *  blijft de schakelaar "P6-lagregel aan". Staat C6 uit (MS Project, OPS), dan doet deze optie niets.
   *  Met C6 aan, voor een SS-relatie met positieve WORKTIME-lag uit een LOPENDE voorganger:
   *   - `'earlyStart'` (afwezig ≡ dit; P6's eigen standaard): de opvolger start op de restwerkstart
   *     van de voorganger plus de rest-lag — exact het C6-gedrag van vóór deze optie;
   *   - `'actualStart'`: de opvolger start op de STATUSDATUM plus de rest-lag, los van de
   *     restwerkstart van de voorganger (`CPMSolver.inProgressStartLagAnchor`).
   *  Bron: Oracle P6 Help "Calculate Start-to-Start lag from"
   *  (https://docs.oracle.com/cd/G18294_01/p6help/en/99348.htm) — *Early Start*: "the predecessor's
   *  remaining early start plus any remaining lag"; *Actual Start*: "the data date plus any remaining
   *  lag". In XER `SCHEDOPTIONS.sched_lag_early_start_flag` (Y ⇒ `earlyStart`, N ⇒ `actualStart`, leeg
   *  ⇒ `earlyStart`; `xerScheduleOptions.ts`). De rest-lag (`max(0, lag − werktijd(werkelijke start →
   *  statusdatum))`) is in beide varianten gelijk. Late kant: bij `'earlyStart'` begrenst de relatie de
   *  voorganger achterwaarts met de C6-rest-lag; bij `'actualStart'` begrenst ze de lopende voorganger
   *  achterwaarts NIET (spiegel van het statusdatumanker: de voorganger kan de opvolger via deze relatie
   *  niet vertragen, dus geen onechte negatieve speling). [VERMOED] intern consistent; wat P6 achterwaarts
   *  doet is ONGEMETEN — geen enkel P6-doorgerekend orakelbestand heeft N (corpus: Y bij OZB,
   *  HarbourPointe, Hotel, Roads, Sample, ashspace, xernative en TERMINAL; N alleen bij DCP-03, dat sinds
   *  2026-09-23 geen orakel meer is). Buiten de C6-poort blijft de optie inert, ook bij `'actualStart'`:
   *  lag 0 (of negatief), een ELAPSEDTIME-lag en dagmodus houden het gewone anker (restwerkstart) en de
   *  gewone late kant. Oracle's helptekst noemt voor die gevallen geen uitzondering; ongemeten, er is geen
   *  orakel met N. Werkt alleen met A19 (`p6UseRemainingStartForProgress`) aan, net als C6 zelf.
   *  Per bestand, dus een projectoptie en geen conventie (regel B). */
  startToStartLagFrom?: 'earlyStart' | 'actualStart';
  /** Nivelleerinstellingen van het bestand (etappe P6-nivellering, FUNDAMENT; onderzoek
   *  `docs/superpowers/plans/2026-09-24-nivellering-etappe-onderzoek.md` §5 en §7 stap 1). Uitsluitend
   *  DATA: niets in de motor, de UI of de handmatige nivelleerder (`ResourceLeveler.ts`) leest dit blok.
   *  Afwezig ≡ geen instellingen bekend (elk formaat behalve XER, en XER zonder SCHEDOPTIONS-rij of
   *  zonder één `level_*`-kolom). Per bestand, dus een projectoptie en geen conventie (regel B).
   *  Zie `LevelingSettings` voor de velden en hun bron. */
  leveling?: LevelingSettings;

  // ── Groep B (rekenprofielen baan B, spec 2026-09-22 bijlage A) ─────────────────────────────
  // Vijf P6-conventies die tot baan B alleen achter de XER-bronmarkering stonden. Elk: P6 aan /
  // MS Project uit / OPS uit. Sinds C3 komen ze uitsluitend uit het rekenprofiel; een oud bestand
  // met de bronmarkering migreert via `legacyOptionsToProfile` (B1–B5 aan).

  /** B1 — FS-nul-lag op een gedeelde bandgrens: een relatie met
   *  `Sequence.p6StartAtPredecessorFinishBoundary` laat de opvolger op de finishgrens van de
   *  voorganger starten (forward) en spiegelt dat backward (`relationMath`, `CPMSolver`'s
   *  `snapSuccessorEarlyStart` via `preserveP6FinishBoundary`). Staat de conventie uit, dan stript
   *  de `CPMSolver`-constructor die relatievlag en heeft ze geen enkel effect.
   *  Backward werkt B1 alleen nog via de weergave van de opvolger (X12 brok 6, 2026-09-23): de
   *  achterwaartse duurwandeling (`CPMSolver.subDuration`) trok de late start van een opvolger op zo'n
   *  relatie vroeger één band terug naar de finishgrens (do 17:00) zodra ze op een bandstart landde; die
   *  spiegel is weg, de opvolger toont haar LS als gewone bandSTART. De late finish van de voorganger
   *  komt uit de gewone FS-backward (`relationMath`, `prevWorkInstant` op de voorgangerkalender) — B1
   *  heeft daar geen eigen tak (een tak `prevWorkInstant(succ.LS)` gaf 0 cellen verschil en is
   *  weggehaald). Gemeten op het P6-doorgerekende Hotel HBTF-2: HCSWB1Z1240 LS 03-04 08:00 (vroeger
   *  03-03 17:00) e.a., 9 ls-cellen beter, 0 slechter (X12 293 → 284); de voorganger-LF (HCSWB1Z1230
   *  03-03 16:00) blijft exact.
   *  P6 aan / MS Project uit / OPS uit. */
  p6RelationFinishBoundary?: boolean;
  /** B2 — backward WORKTIME-lag vanaf een exacte bandeinde-grens die precies op een bandstart
   *  landt, geeft de complementaire vorige finishgrens terug (wo 17:00 − 2 werkdagen = ma 17:00,
   *  niet di 08:00; `CPMSolver.shiftLagPred`). Alleen uurmodus. Sinds X12 brok 6 (2026-09-23) ook bij
   *  een FF-relatie met lag 0: een late finish van de opvolger op een exact bandeinde blijft die
   *  finishgrens voor de voorganger, in plaats van naar de volgende bandstart te normaliseren. Gemeten
   *  op P6-doorgerekende bestanden: Hotel_Construction_TEC (HBTF-2) HMMOAZ040 —FF0→ HMMOAZ000 (LF 08-04
   *  16:00 ⇒ P6 16:00, zonder de regel 08-05 08:00) en vier andere, Sample_Construction_TEC 1 en ashspace
   *  A1050/A2050/A3050/A4050 —FF0→ eindmijlpaal: X12 308 → 298, 0 slechter, 0 groter. Let op: 4 van
   *  die 10 cellen komen uit ashspace, een twijfelachtig orakel (zie B5); daartegenover staan 94
   *  FF0-relaties in het corpus die met de regel consistent exact zijn. Andere relatietypen met lag 0
   *  ongemeten en ongewijzigd.
   *  P6 aan / MS Project uit / OPS uit. */
  p6BackwardLagFinishBoundary?: boolean;
  /** B3 — een voltooide XER-bladactiviteit (nauwe provenance-poort in
   *  `explainP6CompletedDataDateWindow`) krijgt ES/EF als statusdatumvenster, dat venster telt mee
   *  voor het projecteinde (`CPMSolver.backwardPass`) en de float-weergave (`scheduleAnalysis`).
   *  Schakelt ook de diagnose-trace `backwardFloatTrace` in (sinds B3 in P6 uit is, is die trace
   *  onder het P6-profiel dus leeg; alleen `check-xer-backward-float-trace` leest hem en zet B3
   *  daar zelf aan — de replay-pins in `check-xer-task-replay` gebruiken hem niet). Werkt alleen samen met
   *  `p6UseRemainingStartForProgress`.
   *  P6: uit — geen effect op P6-doorgerekende bestanden; gebouwd op rehab-2 (P3). Sinds 2026-09-23
   *  (eigenaarsvraag §1d-7) uit in elk ingebouwd profiel; gemeten 0 cellen, X12 blijft 192.
   *  P6 uit / MS Project uit / OPS uit. */
  p6CompletedDataDateWindow?: boolean;
  /** B4 — een voltooide LOE met alleen SS-ingang en zonder opvolger volgt de actual-finish-route
   *  i.p.v. de hammockroute (`explainCompletedXerLoeActualFinishEligibilityResolved`, `CPMSolver`'s
   *  forward pass). Werkt alleen samen met `p6UseRemainingStartForProgress`,
   *  `preserveActualDatesInBackwardPass` en `p6PreserveActualInstants`.
   *  P6: uit — geen effect op P6-doorgerekende bestanden; gebouwd op rehab-2 (P3). Sinds 2026-09-23
   *  (eigenaarsvraag §1d-7) uit in elk ingebouwd profiel; gemeten 0 cellen, X12 blijft 192.
   *  P6 uit / MS Project uit / OPS uit. */
  p6CompletedLoeActualFinish?: boolean;
  /** B5 — een niet-gestarte LOE met volledig targetvenster, alleen nul-lag SS-ingang en nul-lag
   *  FF-uitgang neemt dat targetvenster als span (`explainOpenXerLoeTargetSpanEligibilityResolved`,
   *  `CPMSolver`'s hammocktak). P6 aan / MS Project uit / OPS uit.
   *  Bewijs op de P6-doorgerekende populatie (besluit 2026-09-23): één bestand, en dat is twijfelachtig —
   *  uitzetten kost +20 cellen (ef 10, lf 10), uitsluitend in `ashspace-primeveraxereditor/sample.xer`.
   *  Dat bestand heeft de drie P6-kenmerken, maar komt uit een XER-editor-repo die die vlaggen zelf kan
   *  zetten (manifest-`note` bij de entry; `docs/superpowers/plans/2026-09-23-x12-restant-classificatie.md`). */
  p6OpenLoeTargetSpan?: boolean;

  // ── Groep C (X12 naar nul, 2026-09-23): conventies die pas ná de rekenprofielen uit de
  // corpusmeting kwamen. Nooit achter een bronmarkering geweest. Een P6-profiel zet ze aan, behalve
  // C1 en C4 (sinds 2026-09-23 in elk ingebouwd profiel uit; ook een legacy-XER-blob, die naar het
  // P6-profiel migreert, volgt die waarde); een profiel-pset van vóór 2026-09-23 die de
  // sleutel niet kent krijgt `legacyValue` = uit.

  /** C1 — RETAINED LOGIC rond de statusdatum: bij een VOLTOOIDE voorganger is het relatie-EINDE
   *  begrensd op de statusdatum. Ligt zijn werkelijke einde ná de statusdatum (P6 laat zo'n actual
   *  toe; de statusdatum is het instant waarop het restwerk begint), dan rekenen de relaties die op
   *  zijn einde steunen (FS, FF) vanaf de werkgrens vlak vóór de statusdatum op zijn
   *  voortgangskalender — `prevWorkInstant(snapOnOrAfter(statusdatum))`, dezelfde grens als het
   *  statusdatumvenster van conventie B3 (`CPMSolver.completedPredecessorRelationWindow`). Alleen het
   *  einde wordt begrensd: relaties die op zijn START steunen (SS, SF) blijven op de werkelijke start,
   *  ook als die ná de statusdatum ligt. Geen effect bij: conventie uit, geen statusdatum, dagmodus,
   *  een niet-voltooide voorganger, of een werkelijk einde op/vóór die grens. Zijn eigen weergegeven
   *  datums veranderen nooit — de begrenzing geldt alleen voor de relatie naar de opvolgers.
   *  De GRENSKEUZE is ongemeten: `prevWorkInstant(snapOnOrAfter(statusdatum))` en de variant zonder
   *  `prevWorkInstant` geven op het corpus (X12, 12.973) en in alle corpusloze fixtures dezelfde
   *  uitkomst (mutant M5, critreview her-check brok 2); ook een FS-kruiskalenderfixture (opvolger op
   *  06:00–17:00, lag in de opvolgerkalender) onderscheidt ze niet. De keuze volgt B3, niet een meting.
   *
   *  - P6: uit — geen effect op P6-doorgerekende bestanden; gemeten in rehab-2 = P3-uitvoer (geen
   *    SCHEDOPTIONS, `rem_late_start_date` 0/4.940, geen `driving_path_flag`; zie
   *    `docs/superpowers/plans/2026-09-23-x12-c1-c4-toets-buiten-rehab2.md` §3 en §5). Besluit
   *    2026-09-23 (overdracht §1a/§1c: alleen P6-doorgerekende orakels): P3-gedrag hoort niet als
   *    P6-standaard aan; de conventie blijft bestaan en is per project aan te zetten. Buiten
   *    rehab-2 verandert C1 geen enkele cel; geen P6-doorgerekend bestand in het corpus heeft een open
   *    opvolger van een voltooide voorganger die ná de statusdatum eindigt.
   *    Meting: vijf voltooide taken met `act_end_date` 2008-05-27 17:00 bij statusdatum 2008-05-27
   *    00:00; het orakel start hun opvolgers op 05-27 08:00, niet 05-28 (plan XER §9 dossier 7b-4,
   *    classificatie brok B02; 1.301 cellen zonder B01, 0 slechter samen met C2).
   *    Geen documentatiebron voor de regel zelf. Oracle Primavera P6 Professional Help Version 24,
   *    "Using the data date" (https://docs.oracle.com/cd/F88968_01/client_help/en_US/using_the_data_date.htm)
   *    zegt dat de statusdatum de laatste voortgangsdatum is en dat er vanaf de statusdatum gepland
   *    wordt, maar beschrijft NIET wat P6 doet met een werkelijk einde ná de statusdatum; P6 EPPM Help
   *    "Invalid Progress Dates - Activities with Actual Dates After the Data Date …"
   *    (https://docs.oracle.com/cd/F88966_01/p6help/en/46280.htm) noemt zo'n actual alleen ongeldige
   *    voortgang. Beide zijn context, geen bewijs.
   *  - MS Project: uit. MS Project rekent een koppeling vanaf de (werkelijke) Finish van de
   *    voorganger; de statusdatum verschuift alleen onvoltooid werk via Project → Update Project →
   *    "Reschedule uncompleted work to start after". Hetzelfde MSP-gedrag ligt al vast in
   *    `unstartedIgnoresStatusDate` (MSP aan).
   *  - OPS: uit (het gedrag van vóór deze conventie: de relatie rekent vanaf het werkelijke einde). */
  p6CompletedPredecessorAtDataDate?: boolean;
  /** C2 — de vrije speling van een NIET-GESTARTE taak telt per relatie in de kalender van de TAAK
   *  zelf, niet in die van de opvolger, voor FS, SS en FF en elke lag: werktijd op de eigen kalender van
   *  de ONGESNAPTE relatiegrens (anker ES bij SS, EF bij FS/FF, plus de lag) tot de vroege opvolgerdatum
   *  (ES bij FS/SS, EF bij FF); de taak-ff is het minimum over de opvolgers (`scheduleAnalysis`). Alleen
   *  uurmodus. Een lag ≠ 0 telt alleen als de lagkalender de voorganger is (`lagCalendar` afwezig of
   *  `predecessor`; dan is lagkalender = eigen kalender); lag 0 telt onder elke lagkalender. Een negatieve
   *  lag volgt dezelfde regel (gekozen gedrag, extrapolatie; gepind in `check-conventions-p6-flags.ts`).
   *  Een GESTARTE, niet-voltooide taak houdt het oude C2: alleen FS met lag 0 (letterlijk het predicaat van
   *  vóór brok 9). BUITEN C2, want ONGEMETEN (de bestaande berekening op de opvolgerkalender blijft): SF,
   *  ELAPSEDTIME-lags, procentlags, een lag ≠ 0 op een andere lagkalender (`successor`/`24hour`/
   *  `projectDefault`; in het corpus hebben de 111 taken onder `rcal_Successor` voorganger en opvolger op
   *  dezelfde kalender), elke lag of niet-FS-relatie uit een gestarte taak, en voltooide taken. Voor
   *  gestarte taken gaf de formule bij de 9 populatiemissers −1800…−4200 min, die A13 op 0 klemt: dat is
   *  gemaskeerd, niet correct, dus uitgesloten (0 cellen effect). Een relatie zonder eigen vrije speling
   *  (zoals naar een VOLTOOIDE opvolger waarvan de achterwaartse pass de grens wist) telt niet mee; C2
   *  geeft zo'n opvolger geen aparte regel. `sequenceFreeFloat` en de driving-markering blijven ongemoeid.
   *
   *  Verbreding (X12 brok 9, 2026-09-23; tot dan alleen FS met lag 0; fixronde na critreview: SF en
   *  gestarte taken eruit): meetonderzoek `docs/superpowers/plans/2026-09-24-x12-hotel-ff-60min.md`.
   *  Derde-partijbron (waargenomen gedrag, geen Oracle-tekst): T. Boyle, "Relationship Free Float and
   *  Float Paths in Multi-Calendar Projects"
   *  (2018, https://boyleprojectconsulting.com/TomsBlog/2018/07/18/relationship-free-float-and-float-paths-in-multi-calendar-projects-p6-mfp-free-float-option/):
   *  "Relationship free float and total float use the predecessor calendar" en "RelFF = (Early Date of
   *  Relationship Successor Activity, ES for FS and SS links, EF for FF and SF links) – RelEF".
   *  Bewijs op P6's eigen datums: 4 discriminerende taken (oud en nieuw C2 verschillen bij precies 4 van de 5.650 open uurtaken met open opvolgers: Hotel HCSWB4Z4240 FF+lag, HCSWB2Z2240 FF+lag, HEPSS00020 SS+lag, Roads A10650 FF0 — die laatste al gedekt door C12), 4/4 goed. SS+lag en FF+lag zijn dus gemeten met n=1 elk, op één kalenderpaar; FS+lag, negatieve lag en SF zijn EXTRAPOLATIE via Boyle (geen Oracle-bron).
   *
   *  - P6: aan. Oracle P6 Help, "View activity float values"
   *    (https://docs.oracle.com/cd/F88968_01/client_help/en_US/view_activity_float_values.htm, P6
   *    Professional 24, opgehaald 2026-09-23): "The Free Float field displays the amount of time the
   *    selected activity can be delayed without delaying the activities that immediately follow
   *    (successor activities)." (Het eerder geciteerde "maximum number of hours or days …" staat NIET
   *    op die pagina.) Over kalenders zegt die zin niets; "uitstel van de ACTIVITEIT, dus op haar eigen kalender" is ONZE INTERPRETATIE (naar
   *    analogie van de totale speling, die hier al per taak op de eigen kalender rekent). Gemeten: op P6's eigen
   *    datums is P6-FF = werkminuten tussen EF en de vroegste opvolger-ES op de taakkalender in alle
   *    362 ff-cellen met een andere opvolgerkalender (Hotel, rehab-2, Roads, DCP-03; classificatie
   *    brok B06); samen met C1 471 ff-cellen beter, 0 slechter. Steun uit echte P6-uitvoer, los van
   *    rehab-2 (dat P3-uitvoer is): Hotel_Construction_TEC +244, Roads_Project_TEC +11 en Harbour Point
   *    DCP-03 Baseline Rev 0 +1 = 256 ff-cellen, 0 slechter — alle drie P6-doorgerekend
   *    (`docs/superpowers/plans/2026-09-23-x12-c1-c4-toets-buiten-rehab2.md` §5). C2 is sindsdien
   *    uitsluitend deze hoofdregel (eigen kalender), gedragen door Hotel, Roads en DCP-03. De vroegere
   *    deeltak "voltooide opvolger ⇒ ff = 0" is op 2026-09-23 VERWIJDERD (besluit, zelfde criterium
   *    als C1/C4): hij was alleen in `rehab-2.xer` gemeten (P3-uitvoer, geen orakel meer) en had op de
   *    P6-populatie 0 cellen effect (mutant tak-weg: cel-delta nieuw=0 verslechterd=0 groter=0).
   *  - MS Project: uit. Ons MPP-orakel meet alleen start en einde, niet de vrije speling; zonder
   *    meting verandert het MSP-profiel niet.
   *  - OPS: uit (relatie-vrije-speling in de kalender van de opvolger, `scheduleAnalysis`). */
  p6FreeFloatOnOwnCalendar?: boolean;
  /** C3 — RETAINED LOGIC, verstreken lag: van een positieve WORKTIME-lag uit een VOLTOOIDE voorganger
   *  telt alleen het deel dat na zijn werkelijke einde op de statusdatum nog niet verstreken is:
   *  `max(0, lag − werktijd(werkelijk einde → statusdatum))` in de lag-kalender
   *  (`CPMSolver.completedRemainingLagSeq`). Twee routes:
   *  - late kant (achterwaarts): op de statusdatum-restvensterroute (`p6CompletedLateFromRemainingWindow`);
   *  - VOORWAARTS: uit een voltooide voorganger met een C4-venster of een C5-punt, via
   *    `CPMSolver.completedOutOfSequenceRelationSeq` (de C4/C5-route). Dat is geen bijzaak: de es- en
   *    ef-cellen in de meting hieronder (Roads es 153 / ef 153, HarbourPointe es 50 / ef 48) kunnen
   *    alleen via deze voorwaartse route bewegen.
   *
   *  - P6: aan — gemeten via C5 op de P6-doorgerekende bestanden `Roads_Project_TEC.xer` (503 cellen:
   *    es 153, ef 153, tf 142, ff 41, ls 7, lf 7) en `HarbourPointe_AssistedLiving.xer` (137: es 50,
   *    ef 48, tf 34, ff 3, ls 1, lf 1): C5 rekent de lag tussen zijn statusdatumpunt en een opvolger met deze
   *    regel, en C3 uit maakt die 640 exacte cellen inexact (X12 428 → 1.068, gemeten 2026-09-23 op
   *    de P6-populatie); daarnaast worden bij C3 uit 56 al inexacte cellen GROTER (grootte-ratchet,
   *    critreview integratie-eindstand 2026-09-23). `rehab-2.xer` was de eerste vindplaats (P3-uitvoer, geen orakel meer; zie C1 en
   *    `docs/superpowers/plans/2026-09-23-x12-c1-c4-toets-buiten-rehab2.md` §5). Vóór C5 gold: buiten
   *    rehab-2 verandert C3 geen enkele cel (de voltooide voorgangers met lag in Roads en
   *    HarbourPointe zijn `CP_Phys` en vallen buiten de B3-route). Geen documentatiebron voor de
   *    rekenregel; hij is afgelezen aan rehab-2-relaties (classificatie brok B03): volledig verstreken
   *    lag (V3122120 → V3122070, FS+168 h, einde 04-15) ⇒ het orakel trekt niets af; niet verstreken
   *    (V3238110, einde 05-26 17:00, FS+120 h) ⇒ de volle lag; deels verstreken (V3120120, FS+168 h):
   *    de afstand LF → opvolger-LS is gelijk aan die van het orakel (die cel zelf wacht op brok B01,
   *    de LS van de opvolger). Samen 351 cellen (ls 122, lf 122, tf 107), 0 slechter; de rest van brok
   *    B03 hangt aan B01 of aan actieve taken met restduur 0 (buiten deze conventie).
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
   *  - P6: uit — geen effect op P6-doorgerekende bestanden; gemeten in rehab-2 = P3-uitvoer. Besluit
   *    2026-09-23 (alleen P6-doorgerekende orakels): P3-gedrag hoort niet als P6-standaard aan; de
   *    conventie blijft bestaan en is per project aan te zetten. Context (geen bewijs dat P6 deze vorm
   *    zo rekent): Oracle P6 Professional Help, "General tab - Schedule Options dialog box": "Retained
   *    Logic: The remaining duration of a progressed activity is not scheduled until all of its
   *    predecessors are finished" (docs.oracle.com/cd/F25600_01/client_help, `general_tab_-_
   *    schedule_options_dialog_box`); de restduur 0 van een voltooide activiteit valt daar ook onder.
   *    Gemeten: `rehab-2.xer`, 36 voltooide of actieve taken met restduur 0 en een onvoltooide
   *    voorganger (classificatie brok B04): P6 zet ES op de eerste werkgrens ná de relatiegrens
   *    (bv. V3117130: voorganger V3209135 EF 08-19 17:00 ⇒ ES 08-20 08:00 / EF 08-19 17:00; met
   *    FS+240 h en SS evenzo), niet op de statusdatum 05-27. LET OP: het rehab-2-orakel is
   *    P3-uitvoer, geen P6-uitvoer (geen SCHEDOPTIONS, lege `rem_late_start_date`; zie
   *    `docs/superpowers/plans/2026-09-23-x12-c1-c4-toets-buiten-rehab2.md` en het B01-onderzoek). De
   *    B3-vorm waarop deze regel rust komt in het corpus alleen in rehab-2 voor; buiten rehab-2 verandert
   *    C4 geen cel. rehab-2 is dus GEEN bewijs dat P6 zo rekent — alleen de Oracle-tekst hierboven is dat.
   *  - MS Project: uit. Een voltooide taak houdt in MS Project haar werkelijke Start en Finish; de
   *    koppeling naar een onvoltooide voorganger verschuift alleen onvoltooid werk.
   *  - OPS: uit (het venster op de statusdatum, het gedrag van vóór deze conventie). */
  p6CompletedOutOfSequenceWindow?: boolean;
  /** C5 — een VOLTOOIDE activiteit met fysiek voortgangspercentage (`p6CompletePctType === 'CP_Phys'`)
   *  staat als één punt op de statusdatum: ES = EF = het RAUWE statusdatum-instant (niet gesnapt op de
   *  werktijd), of later als een voorganger dat eist — de rauwe relatiegrens (FS/FF: het einde, SS/SF:
   *  de start van een voorganger die nog niet klaar is, met een finishgrens: niet naar de volgende
   *  werkstart geschoven), of het punt van een voorganger die zelf zo'n punt heeft. De lag uit een
   *  LOPENDE voorganger is de volle lag, behalve bij SS met C6 aan: dan telt via
   *  `inProgressStartLagSeq` alleen de rest-lag. Ook de late kant is één punt: LS = LF = de vroegste
   *  grens die de opvolgers stellen (FS/SS: hun LS, FF/SF: hun LF), zonder statusdatumklem; een
   *  VOLTOOIDE opvolger zonder eigen punt en zonder rest-venster (C2) telt daarbij niet mee (de
   *  achterwaartse tak slaat die over). Zonder opvolger het projecteinde — dat steunt op slechts twee
   *  taken (HarbourPointe EC1040/EC1050). Omgekeerd legt het punt als OPVOLGER gewone backward-druk op
   *  een open voorganger (FS/SS: zijn LS, FF/SF: zijn LF, met de gewone relatiewiskunde); de generieke
   *  backward pass slaat een voltooide opvolger anders als historie over. Van de lag tussen zo'n punt en
   *  een opvolger of voorganger telt alleen het deel dat na het werkelijke einde op de statusdatum nog
   *  niet verstreken is (rekenregel C3). Poort: P6-herkomst, blad, `p6ExplicitTargetWindow`, A19
   *  (`p6UseRemainingStartForProgress`), voltooid met een werkelijk einde op of vóór de statusdatum,
   *  TT_Task of TT_Mile/TT_FinMile, geen suspend/resume; geen eis op het duurtype
   *  (`explainP6CompletedPhysicalPoint`, `CPMSolver.recordCompletedPhysicalPoint` en de backward pass).
   *
   *  - P6: aan. Gemeten, niet uit de documentatie: in `Roads_Project_TEC.xer`, `HarbourPointe_
   *    AssistedLiving.xer` en `OZB-Start-09Dec24.xer` staan alle voltooide CP_Phys-activiteiten met een
   *    orakel op één punt: 134 + 18 + 14 op precies de statusdatum (Roads 2013-04-23T00:00, ook buiten
   *    de werktijd), de rest op de rauwe relatiegrens van een voorganger (Roads A10: voorganger A7 EF
   *    06-03 17:00 ⇒ ES = EF = 06-03 17:00; A15081: voorganger A15069 ES 05-06 07:00 SS+60 h ⇒ 05-13
   *    17:00; A15087 —SS+30 h→ A15089 start 05-14 07:00, de lag is verstreken). De late kant klopt bij
   *    alle 187 met een laat orakel met de vroegste opvolgergrens (Roads 157, HarbourPointe 16 + 2 zonder
   *    opvolger op het projecteinde, OZB 14). De backward-druk op een open voorganger (X12 brok 6,
   *    2026-09-23): in Roads staat elke open taak waarvan alle opvolgers zo'n punt zijn in P6 op dat punt
   *    (B2911 LF 09-10 16:00 = LS van OCEC11361; A33 LS = LF 05-11 10:00 = LS van A65; OCEC10851 —SS0→
   *    OCEC10791: LS 09-29 16:00; volgens de critreview 13 relaties in Roads), niet op het projecteinde;
   *    samen met de late kant van C6 X12 428 → 350
   *    (ls 29, lf 29, tf 20 beter, 0 slechter, 0 groter), waaronder de 14 schuldcellen. Dit zijn
   *    P6-doorgerekende bestanden; rehab-2 (P3-orakel,
   *    zie C4) heeft geen voltooide CP_Phys-activiteiten en is hier geen bron.
   *    Bewust smal (CP_Phys): een brede poort "elke voltooide taak met werkelijk einde op/vóór de
   *    statusdatum" (B3 wint waar die geldt) maakt in de meting precies dezelfde cellen goed, maar
   *    verslechtert DCP-03 As-Built: 57 voltooide CP_Drtn/DT_FixedDrtn-taken waarvan het orakel de
   *    werkelijke datums houdt (285 cellen); de variant die ook B3 vervangt verslechtert daarnaast
   *    rehab-2 (5.340 cellen). Of As-Built door P6 is doorgerekend is niet vastgesteld (herkomst
   *    onbekend). De P6-regel zelf lijkt dus breed — op de P6-doorgerekende bestanden is smal = breed —
   *    en CP_Phys is een beschermgrens vanwege DCP-03 As-Built, geen bewezen P6-onderscheid. Dat
   *    onderscheid kan net zo goed in het duurtype zitten (B3 eist `DT_FixedDUR2`, As-Built is
   *    `DT_FixedDrtn`). [VERMOED] C5 kent geen Progress-Override-poort, C4 wel; zie plan §9.
   *    Vrije-spelingkant (X12 brok 8, 2026-09-23; `scheduleAnalysis.computeScheduleResults`): een punt heeft
   *    geen relatiegrens naar zijn voorgangers, dus over een FS0-relatie naar een punt telt de vrije speling
   *    van de voorganger in haar eigen kalender tot dat punt (niet de terugval 0). Gemeten: in de
   *    orakelpopulatie hebben drie open taken alleen voltooide CP_Phys-opvolgers en alle drie volgen dit:
   *    Roads OCEC18201 (EF 06-16 17:00, punt OCEC18381 06-23 17:00: P6 ff 3000 min, zonder 0), B2911 en A33
   *    (EF = punt: 0). X12 181 → 180, 0 slechter, 0 groter; precies één OPS-waarde verandert. Bewust geen
   *    eigen conventie (brok-8-opdracht noemde het C13): het is de ff-spiegel van dezelfde P6-regel, net
   *    als de late kant van C5 in brok 6, en valt met C5 uit vanzelf weg (punten bestaan alleen met C5).
   *    Alleen FS zonder lag: bewuste beperking, niet gemeten (zoals C7) — andere relatietypen en lag
   *    houden de terugval. Een voltooide voorganger krijgt via A12 al vrije speling 0; daar is geen
   *    eigen poort voor (die zou dood zijn, zie review integratieronde 2).
   *  - MS Project: uit. MS Project kent geen voortgangstype per activiteit; een voltooide taak houdt
   *    haar werkelijke Start en Finish.
   *  - OPS: uit (de werkelijke datums, het gedrag van vóór deze conventie). */
  p6CompletedPhysicalAtDataDate?: boolean;
  /** C6 — de lag van een SS-relatie uit een LOPENDE voorganger (werkelijke start, niet voltooid) loopt
   *  vanaf die werkelijke start: voorwaarts telt alleen het deel dat op de statusdatum nog niet
   *  verstreken is, `max(0, lag − werktijd(werkelijke start → statusdatum))` in de lag-kalender, bovenop
   *  de restwerkstart van de voorganger. Alleen positieve WORKTIME-lag, alleen met A19
   *  (`p6UseRemainingStartForProgress`, de vroege start van een lopende taak is dan haar restwerkstart);
   *  ook achterwaarts: de late start van de lopende voorganger ligt op de LS van de opvolger min alleen de
   *  rest-lag (X12 brok 6). FS/FF/SF en ELAPSEDTIME-lag ongewijzigd (ongemeten). `CPMSolver.inProgressStartLagSeq`.
   *
   *  - P6: aan. Bron: Oracle P6 Help "Calculate Start-to-Start lag from"
   *    (https://docs.oracle.com/cd/G18294_01/p6help/en/99348.htm). *Early Start*: "Calculates the
   *    expired lag as the number of work periods between the actual start and the data date and
   *    determines the successor's start date as the predecessor's remaining early start plus any
   *    remaining lag"; *Actual Start*: "the data date plus any remaining lag". C6 is exact de
   *    Early-Start-variant; de max(0)-vloer is gedocumenteerd ("remaining lag"). In XER is dit
   *    `sched_lag_early_start_flag` (corpus: Y 40, N 8, leeg 2; Roads Y, DCP-03 Baseline/As-Built N).
   *    Het deels-verstreken geval (0 < rest-lag < lag) komt in het corpus niet voor.
   *    De keuze tussen beide varianten is sinds 2026-09-23 de projectoptie `startToStartLagFrom`
   *    (uit `sched_lag_early_start_flag`; N = "statusdatum + rest-lag"); C6 blijft de schakelaar.
   *    Meting die de Early-Start-variant bevestigt: alle niet-gestarte opvolgers met een SS+lag-relatie
   *    uit een lopende voorganger in het P6-doorgerekende `Roads_Project_TEC.xer` (8) starten op de
   *    restwerkstart van die voorganger zelf, niet een volle lag later: OCEC11371 (werkelijk gestart
   *    2013-02-23, restwerkstart 06-24 07:00) —SS+60 h→ OCEC11381 ES 06-24 07:00; evenzo OCEC10811
   *    —SS+30 h→ OCEC18251 en OCEC18391 —SS+40 h→ OCEC18401. (rehab-2 V3259300 —SS+56 h→ V3259220 volgt
   *    hetzelfde patroon, maar dat orakel is P3-uitvoer, zie C4: geen bewijs.) Zichtbaar geworden met
   *    C5: de voorganger stond daarvóór zelf verkeerd, waardoor de opvolger toevallig goed uitkwam.
   *    De late kant (X12 brok 6, 2026-09-23): Roads OCEC10311 (lopend, 140 h rest) —SS+70 h→ OCEC10851
   *    (LS 09-29 16:00): P6 zet OCEC10311 LS op 09-29 16:00, dus zonder de verstreken lag; met alleen de
   *    voorwaartse kant groeide de totale speling van de opvolgers met de volle lag (70 h = 4.200 min:
   *    de acht tf-schuldcellen OCEC10851/11701/20101/11741/11751/11762/11771/12121, gemeten door C6 uit
   *    te zetten). Critreview 23-09: vijf onafhankelijke relaties in Roads dragen de late kant
   *    (OCEC10311 —SS→ OCEC10851, OCEC10771, OCEC10881, OCEC10811 → OCEC18251, OCEC11731 → OCEC12121).
   *    Alleen gemeten bij rest = geplande duur (OCEC10311 140/140 h).
   *  - MS Project: uit. MS Project kent geen P6-restwerkstart als vroege start; de lag loopt vanaf de
   *    start van de voorganger zoals die op de balk staat.
   *  - OPS: uit (de volle lag vanaf de vroege start, het gedrag van vóór deze conventie). */
  p6InProgressStartLagElapsed?: boolean;
  /** C7 — een FF-relatie naar een STARTmijlpaal (nulduur, `milestoneKind: 'START'`; in P6 een
   *  `TT_Mile`) bindt in de terugwaartse berekening aan de LATE FINISH van die mijlpaal zelf. Zonder
   *  deze conventie behandelt de motor een startmijlpaal als dagbegin-anker: de late finish van de
   *  FF-voorganger moet dan op de werkgrens vóór dat anker liggen (`relationMath.backwardHour`,
   *  `snapStrictBefore` plus de lag-0-normalisatie ⇒ het begin van de mijlpaaldag), en voorwaarts
   *  op de werkgrens strikt ná de voorgangerfinish (`forwardHour`, `snapStrictAfter`), wat de vrije
   *  speling van de voorganger een werkdag korter maakt. Met de conventie vervallen beide sprongen:
   *  de FF-grens is de late finish van de mijlpaal zelf, resp. — alleen voor de vrije speling van een
   *  NIET-bindende FF — de voorgangerfinish zelf. De vroege start van de mijlpaal verandert nooit:
   *  een bindende FF houdt de gewone grens (het drijvende geval heeft geen P6-orakel in het corpus).
   *  De nulrestduur-voortgangstak van de terugwaartse pass valt er bewust buiten (ongemeten).
   *  Alleen in uur-modus aan beide kanten: het insluiten van uur-modus is gemeten, het uitsluiten
   *  van dagmodus niet — dagmodus is ongemeten en de poort is een bewuste beperking, geen gemeten
   *  grens. Een eindmijlpaal (`TT_FinMile`) blijft ongewijzigd.
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
  /** C8 — de geplande-startvloer van A16 (`p6UseTaskPlannedStartFloor`: `TASK.target_start_date`
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
  /** C9 — de late finish staat op de EIGEN kalender van de activiteit. Bepaalt een opvolgergrens de late
   *  finish (ook ná de late-zijde-constraints: een strakkere constraint of deadline wint en blijft staan)
   *  en ligt die grens buiten de werktijd van de taak zelf — in het corpus steeds omdat de opvolger op
   *  een andere kalender rekent, maar de code toetst alleen de eigen werktijd —, dan wordt de late finish
   *  het einde van de vorige werkperiode op de eigen kalender. Een grens op of binnen de werktijd (ook op
   *  een band-rand) blijft staan. Niet voor het projecteinde (ongemeten; op het corpus identiek), alleen
   *  uurmodus, alleen de generieke backward pass (niet de voortgangs-, C5-, hammock- of handmatige
   *  takken). `CPMSolver.lateFinishOnOwnCalendar`.
   *
   *  - P6: aan. Gemeten, niet uit de documentatie (X12 brok 6, classificatiebrok B09, 2026-09-23), op
   *    het P6-doorgerekende `Hotel_Construction_TEC.xer`, project HBTF-2 (2666; SCHEDOPTIONS-rij,
   *    `rem_late_start_date` gevuld, `driving_path_flag` Y — `xer-corpus-p6computed.json`): 42 cellen
   *    (lf 30, ls 12), 0 slechter, 0 groter (X12 350 → 308). Er is geen P6-instelling (SCHEDOPTIONS- of
   *    PROJECT-veld) voor gevonden: het is een vaste P6-rekenregel, dus een conventie en geen
   *    projectoptie. Inhoudelijk de late-kant-tegenhanger van C2 (vrije speling op de eigen kalender) en
   *    van de bandgrens-weergave B09: P6 drukt de datums van een activiteit uit in haar eigen kalender.
   *    Voorbeelden: startmijlpaal HCMEF6Z5565 op kalender 844 (vrijdag vrij),
   *    opvolger-LS vr 2013-12-27 16:00 op kalender 843: P6 do 12-26 17:00, zonder C9 vr 12-27 16:00;
   *    taken op kalender 3195 (08:00–16:00) met een opvolgergrens 17:00 van kalender 3196: P6 16:00
   *    (HCSWB1Z1230 → HCSWB1Z1240, een FS0-relatie op de voorgangerfinishgrens, B1, die de LS van de
   *    opvolger ongesnapt doorgeeft — sinds de B1-late-kant van brok 6 legt die relatie de finishgrens
   *    zelf, en dragen nog 24 cellen C9: twaalf startmijlpalen op kalender 844 als HCMEF6Z5565, met C9 uit
   *    24 slechter). Beperkt tot een door een opvolger bepaalde late finish: op het
   *    corpus identiek aan de variant die ook het projecteinde snapt (0 cellen verschil).
   *    Een BREDERE variant (elke late finish op een bandSTART ook naar het vorige band-einde) maakt 10
   *    cellen meer goed (FF0-relaties in Hotel, ashspace en Sample_Construction), maar breekt 54 exacte
   *    startmijlpalen (LS = LF 08:00) en valt samen met B2; die 10 cellen zijn als aanscherping van B2
   *    (FF-lag 0) geland, niet hier.
   *  - MS Project: uit. Ons MPP-orakel meet alleen start en einde (vroege datums), niet de late kant;
   *    ongemeten, dus het gedrag van vóór deze conventie.
   *  - OPS: uit (de rauwe grens, het gedrag van vóór deze conventie). */
  p6LateFinishOnOwnCalendar?: boolean;
  /** C11 — onder Progress Override (`progressMode: 'PROGRESS_OVERRIDE'`) negeert de planning de
   *  relatie van een NIET-voltooide voorganger naar een al GESTARTE, nog lopende opvolger ook aan de
   *  late kant en in de vrije speling. Voorwaarts deed de motor dat al (de voortgangstak van de lopende
   *  opvolger rekent onder Progress Override zonder voorgangerdruk); met C11 legt die opvolger ook geen
   *  backward-druk op de voorganger, en telt de relatie niet in diens vrije speling (geen relatiegrens,
   *  dus ook geen driving-markering). Poort: conventie aan, projectoptie Progress Override (zoals C4 die
   *  leest: `this.options.progressMode`), opvolger met werkelijke start of voortgang en niet voltooid,
   *  voorganger niet voltooid (die laatste poort is verdedigend, niet gemeten: onder P6 wist A12 de grens
   *  van een voltooide voorganger al). `CPMSolver.progressOverrideIgnoresRelation`. Nummer C11: C10 is bezet door
   *  de geparkeerde ALAP-conventie (plan XER §9).
   *
   *  - P6: aan. Bron: Oracle P6 EPPM Help, "Scheduling Settings"
   *    (https://docs.oracle.com/cd/F88966_01/p6help/en/99348.htm): "Progress Override: The schedule
   *    ignores network logic and allows the activity to progress without delay." — de logica wordt
   *    genegeerd, niet alleen de voorwaartse druk. Gemeten (X12 brok 8, 2026-09-23, n = 1 project,
   *    toegestaan onder het n = 1-criterium omdat het principe gedocumenteerd is): `eh_P6Workshops/
   *    OZB-Start-09Dec24.xer`, project 10093 (`sched_progress_override = Y`, `sched_retained_logic = N`;
   *    het enige Progress-Override-project in de orakelpopulatie). OZ1030 (lopend, rest 16 h) heeft twee
   *    FS-opvolgers: de al op 12-20 gestarte OZ1040 en de niet-gestarte OZ1060 (MSOA 01-02). P6: LF
   *    12-31 16:00 (de dag vóór OZ1060 LS 01-02; 01-01 is een feestdag), tf 1440, ff 1440; zonder C11 LF
   *    12-20 16:00 (via OZ1040, wier LS A12 op de werkelijke start houdt), tf −960, ff 0. X12 284 → 280
   *    (ls, lf, tf, ff van OZ1030; ook de driving-markering klopt dan), 0 slechter, 0 groter.
   *    Risicokring in de orakelpopulatie: precies die ene relatie (OZ1030 → OZ1040); geen ander project
   *    rekent met Progress Override.
   *  - MS Project: uit. MS Project kent geen Progress Override-instelling; ongemeten, dus het gedrag van
   *    vóór deze conventie.
   *  - OPS: uit (de relatie telt achterwaarts en in de vrije speling mee, het gedrag van vóór deze
   *    conventie). */
  p6ProgressOverrideIgnoresStartedSuccessor?: boolean;
  /** C12 — bij een FF-relatie ligt de vroege finish van de opvolger in KLOKTIJD nooit vóór de relatiegrens.
   *  Grens X = voorgangerfinish + lag (WORKTIME, lagkalender), eerst genormaliseerd naar de finish-kant
   *  (`prevWorkInstant`: de motor draagt een finish op een bandeinde intern als de volgende bandstart),
   *  behalve als de voorganger een open STARTmijlpaal is — die ankert op een start-instant (bandstart).
   *  Ligt X ná de berekende vroege finish met nul werktijd ertussen op de eigen kalender (X valt in vrije
   *  tijd van de opvolger), dan wordt de vroege finish de eerste werkgrens op of ná X; de vroege start
   *  blijft staan. Geldt in de niet-gestarte tak en op het restwerk van een lopende taak (niet bij een harde
   *  finish-pin, niet bij ELAPSEDTIME-lag, alleen uurmodus, niet vanuit een hammock — deze vier poorten
   *  zijn verdedigend, niet gemeten). De lopende tak heeft geen Progress-Override-poort: onder Progress
   *  Override met een FF-grens in vrije tijd legt C12 de grens nog steeds op (fixture pint dat gedrag;
   *  ongemeten, geen P6-orakel). De nul-werktijd-eis is niet gemeten; ontwerpgrens: C12 is een
   *  kloktijdcorrectie, geen extra relatielogica. Vrije-spelingkant: over een FF-relatie zonder lag telt
   *  de vrije speling van een open (niet-voltooide) voorganger in haar eigen kalender tot de vroege
   *  FINISH van de opvolger (niet via de afgeleide startgrens, die C12 niet verplaatst).
   *  `CPMSolver.finishNotBeforeFinishFinishBound`, `scheduleAnalysis.computeScheduleResults`.
   *
   *  - P6: aan. Bron: Oracle P6 EPPM Help, "About Relationships"
   *    (https://docs.oracle.com/cd/F88966_01/p6help/en/6616.htm), Finish to Finish: "The successor
   *    activity cannot finish until its predecessor finishes." Dat P6 dan de volgende bandstart toont (en
   *    niet de grens zelf) is corpusgedrag, niet beschreven. Gemeten (X12 brok 8, 2026-09-23, restant-
   *    onderzoek 284 §3a): `Roads_Project_TEC.xer` OCEC9761 (FF0 vanaf de open startmijlpaal OCEC12101, ES
   *    2014-01-15 07:00): P6 EF 01-15 07:00, zonder C12 01-14 17:00; OCEC6681 (FinMile, FF0 vanaf
   *    OCEC9761) es/ef mee; A10660 (lopend, kal. 1473 za–wo, FF0 vanaf A10650 op kal. 1474 met EF do 05-23
   *    11:00): P6 EF za 05-25 07:00, en A10650 ff 960 min (16 h tot die finish); `Hotel_Construction_TEC.xer`
   *    HCSWB3Z2190/HCSWB2Z6190 (FF+32 h, grens in een meerdaags vrij blok van kal. 3195): P6 de eerste
   *    bandstart ná de grens. X12 280 → 273: 7 cellen beter, 0 slechter, 0 groter; precies die 7
   *    OPS-waarden veranderen over alle 5.983 orakeltaken. Risicokring: 759 FF-relaties naar een open
   *    opvolger in de orakelprojecten, waarvan alleen deze vijf C12 raken. Zonder de normalisatie naar de
   *    finish-kant: 72 cellen slechter (elke gewone FF-finish op een bandeinde sprong een dag vooruit).
   *    Samenloop met C7: bij FF0 naar een startmijlpaal geeft de vrije-spelingkant van C12 dezelfde P6-
   *    waarde als C7 voorwaarts (vrije speling tot de mijlpaal zelf).
   *  - MS Project: uit. Ons MPP-orakel heeft geen gemeten FF-grens in vrije tijd van de opvolger;
   *    ongemeten, dus het gedrag van vóór deze conventie.
   *  - OPS: uit (het laatste bandeinde vóór de grens, werktijd-gelijk; vrije speling via de startgrens —
   *    het gedrag van vóór deze conventie). */
  p6FinishNotBeforeFinishFinishBound?: boolean;
  /** C14 (in plan XER §9 "C10" genoemd; vóór 23-09 "C9") — een niet-gestarte ALAP-activiteit
   *  (`constraint.type === 'ALAP'`, P6 `CS_ALAP`) op een uurkalender krijgt als vroege finish de strengste
   *  grens die haar opvolgers met hun VROEGE datums via de gewone achterwaartse relatiewiskunde toestaan
   *  (zonder opvolger: haar late finish), en als vroege start die finish min haar duur — in werktijd op de
   *  minuut, niet in hele werkdagen. Opvolgers eerst (omgekeerde topologische volgorde), zodat een keten
   *  van ALAP-taken aaneensluit; de opvolgers zelf bewegen niet. Ondergrens: de relatiegrenzen van haar
   *  voorgangers en de statusdatum. Haar eigen geplande venster telt niet: een ALAP-wortel start
   *  voorwaarts op de statusdatum, niet op haar eigen anker, en de geplande-startvloer van A16 geldt niet
   *  voor haar (`CPMSolver.forwardPass`, `applyAlapFromSuccessors`). Een secundaire constraint
   *  (`constraint2`) blijft gelden: SNLT/FNLT begrenzen de vroege finish van boven, SNET/FNET de start
   *  van onder (via `backwardBoundOf`/`forwardBoundOf`, dezelfde grenzen als de gewone passes); botsen
   *  ze, dan wint de ondergrens. Bron: Oracle P6 Help "Working with Activity Constraints" — alleen bij
   *  Start On/Finish On/Mandatory Start/Mandatory Finish als primaire is geen secundaire toegestaan, dus
   *  ALAP mag er een dragen en beide gelden; hoe P6 een botsing oplost staat daar niet (eigen keuze, in
   *  lijn met "vroege datums nooit vóór een SNET/FNET"). Corpus: 0 van de 46 ALAP-taken in de negen
   *  orakelbestanden draagt een `cstr_type2` (gemeten 2026-09-24), dus dit deel is niet tegen P6 geijkt.
   *
   *  BEWUSTE, GEMETEN BEPERKINGEN — geen P6-bron, geijkt op het corpus (critreview C14-landing 24-09):
   *  (1) alleen op een UURkalender (`cal.isHourMode`): een ALAP-taak op een dagkalender houdt stil de oude
   *      stap in hele werkdagen — het corpus heeft geen P6-doorgerekende ALAP-taak op een dagkalender,
   *      dus er is niets om een wijziging tegen te meten; niet veranderen zonder meting;
   *  (2) alleen NIET-GESTARTE taken: een gestarte of voltooide ALAP-taak houdt de oude stap (gemeten: een
   *      voltooide ALAP-taak, HarbourPointe EC1030, kwam anders verder van P6 te staan);
   *  (3) een ALAP-WORTEL begint voorwaarts op de statusdatum, niet op haar eigen gepland venster
   *      (gemeten: EC1420, target 2011-06-27, staat in P6 vóór haar opvolger).
   *
   *  - P6: aan. Oracle P6 Help, constraint "As Late As Possible": de activiteit wordt zo laat
   *    ingepland als kan zonder haar opvolgers te vertragen, dus binnen haar vrije speling. Gemeten
   *    (classificatiebrok B12, geparkeerd in brok 5 en 7, gebouwd in brok 10):
   *    `HarbourPointe_AssistedLiving.xer` (P6-doorgerekend), de ALAP-keten EC1420 (startmijlpaal zonder
   *    voorganger, target 2011-06-27 07:00) → EC1430 → EC1810 (beide ALAP) → EC2090: P6 zet EC1810 op
   *    EF 2012-03-06 16:49 = de start van EC2090, niet achter het geplande venster van EC1420. Zonder
   *    deze conventie staat EC1420 op haar eigen target en schuift de hele keten enkele werkdagen later.
   *    Gemeten op de populatie van 24-09 (X12 175 → 148): 27 cellen exact (es 8, ef 8, tf 7, ff 4), 11
   *    kleiner (EC2280/2310/2380/2390/2400: 4.331 → 2.880 en 18.731 → 14.400 min), 0 slechter, maar 3
   *    groter: EC1420 es/ef (3.731 → 4.320 min) en EC1430 es (3.791 → 4.320 min). Oorzaak buiten ALAP: P6
   *    geeft EC1430 een span van 696 werkuren bij `remain_drtn_hr_cnt` 720 (plan XER §9); EC1430 is een
   *    van de acht verouderde HarbourPointe-taken die het eigenaarsbesluit van 24-09 uit het orakel haalt.
   *    Geland 2026-09-24 samen met eigenaarsbesluit vraag 13 ("Vraag 13, ja uitsluiten": EC1420, die haar
   *    datums uit de uitgesloten EC1430 krijgt, gaat ook uit de meetlat): X12 104 → 76, CELLDELTA nieuw=0
   *    verslechterd=0 groter=0 verbeterd=23 kleiner=9 schuld=0.
   *    `Hotel_Construction_TEC.xer` ATWTPR000 (ALAP-eindmijlpaal zonder opvolgers, kal. 844) valt er
   *    formeel onder, maar haar es/ef waren al exact en haar afwijking zit aan de late kant (P6 LF 17:00 op
   *    het einde van haar eigen werkdag, wij 16:00 = het projecteinde): ls/lf 60 min en tf 60 min blijven
   *    met en zonder deze conventie gelijk (gemeten).
   *  - MS Project: uit. MS Project plant ALAP vanaf de late datums van de taak (zijn eigen
   *    ALAP-semantiek, niet gemeten tegen ons MPP-orakel); het gedrag van vóór deze conventie.
   *  - OPS: uit (de oude stap: de vroege datums schuiven in hele werkdagen op met de vrije speling,
   *    in topologische volgorde, ook bij een gestarte taak). */
  p6AlapPositionedFromSuccessors?: boolean;
}

/**
 * Rekenprofielen (spec 2026-09-22 v3, tweelagenmodel): de zevenentwintig PAKKETCONVENTIES — regels die per
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
  | 'p6CompletedPhysicalAtDataDate'
  | 'p6InProgressStartLagElapsed'
  | 'p6FinishFinishStartMilestoneLateFinish'
  | 'p6StartedTaskIgnoresPlannedStartFloor'
  | 'p6LateFinishOnOwnCalendar'
  | 'p6ProgressOverrideIgnoresStartedSuccessor'
  | 'p6FinishNotBeforeFinishFinishBound'
  | 'p6AlapPositionedFromSuccessors';

/** De elf per-bestand projectinstellingen: alles in `SchedulingOptions` behalve de conventies. */
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
