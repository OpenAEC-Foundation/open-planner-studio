/** Voortgangsmodus (P6). undefined ⇒ RETAINED_LOGIC. */
export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

/** Eén sleutel uit de nivelleerprioriteitslijst (P6 "Leveling priorities"; bovenste wint). */
export interface LevelingPriorityKey {
  /** De bronveldnaam letterlijk zoals het bestand hem noemt (P6: een TASK-/PROJECT-kolomnaam zoals
   *  `priority_type`), ongeïnterpreteerd. De betekenis komt uit `levelingPriorityQuantity`
   *  (`levelingInput.ts`): altijd een eigen berekende of invoergrootheid, nooit opgeslagen P6-uitvoer. */
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
 * Nivelleerinstellingen als data: de P6-dialoog "Level Resources", geen nivelleerrun (het bestand zegt
 * niet óf P6 genivelleerd heeft). Bewust geen aan/uit-veld: of nivelleren een projectoptie of een eigen
 * knop wordt ligt nog open, en een vroeg verplicht `enabled` zou in opgeslagen IFC's vastzitten.
 * Geen rekeneffect: de motor en `ResourceLeveler.ts` lezen dit blok niet. De XER-lezer vult het, IFC
 * round-tript het en de MSPDI-export meldt het verlies van een niet-default blok
 * (`isP6DialogDefaultLeveling`).
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
 * Reken-opties per project. Een afwezig (of leeg) blok ≡ alle defaults. Ze horen bij het BESTAND (net
 * als statusDate/progressMode), niet bij de app-instellingen: anders geeft hetzelfde bestand op twee
 * machines een ander schema. Twee disjuncte sleutelverzamelingen: de pakketconventies (`ConventionKey`,
 * uit het rekenprofiel) en de per-bestand projectopties (`ProjectOptionKey`). De solver krijgt ze
 * samen als `EffectiveSchedulingOptions` (`CPMOptions.schedulingOptions`).
 *
 * Per conventie staat hieronder wat hij doet, de waarde in de drie ingebouwde profielen en de bron.
 * "Empirisch" = afgelezen aan de opgeslagen datums van P6-doorgerekende XER's, zonder Oracle-tekst;
 * `rehab-2.xer` is P3-uitvoer en telt niet als P6-bewijs.
 */
export interface SchedulingOptions {
  /** Kalender waarin een relatie-lag telt (P6 4-way). Default 'predecessor'. Geldt voor elk formaat
   *  (`relDeps.lagEngine`, `CPMSolver.ts`). */
  lagCalendar?: 'predecessor' | 'successor' | '24hour' | 'projectDefault';
  /** Kritiek-definitie. `threshold` is de grens in taakdagen; `thresholdHours` bewaart een
   *  P6/XER-grens in bronuren en wordt per taak tegen floaturen op diens effectieve kalender
   *  vergeleken. Bij beide wint `thresholdHours`. Beide grenzen mogen negatief zijn. */
  criticalDefinition?: {
    mode: 'totalFloat' | 'longestPath';
    threshold?: number;
    thresholdHours?: number;
  };
  /** TF-berekeningswijze. Default 'smallest' = min(start-, finish-float). */
  totalFloatMode?: 'start' | 'finish' | 'smallest';
  /** Open-ended taken kritiek? Afwezig/false: een eindtaak krijgt tf via LF−EF. */
  makeOpenEndedCritical?: boolean;
  /** P6 "Use Expected Finish Dates" (`SCHEDOPTIONS.sched_use_expect_end_flag`): aan ⇒ een lopende
   *  P6-taak met `Task.p6ExpectedFinish` krijgt die datum als vroege finish (`CPMSolver`,
   *  voortgangstak). */
  useExpectedFinishDates?: boolean;
  /** A12 — late zijde bij voortgang: een gestarte activiteit houdt haar geregistreerde start als LS,
   *  een voltooide activiteit haar actual-venster als LS/LF, en zo'n voltooide opvolger trekt een nog
   *  open voorganger niet historisch terug. Afwezig/false ⇒ de algemene OPS-semantiek.
   *  P6 aan / MS Project uit / OPS uit. */
  preserveActualDatesInBackwardPass?: boolean;
  /** A13 — P6 rapporteert vrije float niet negatief: bij een onhaalbare late constraint blijft TF
   *  negatief maar wordt FF nul. Afwezig/false ⇒ de getekende OPS-semantiek.
   *  P6 aan / MS Project uit / OPS uit. */
  clampNegativeFreeFloat?: boolean;
  /** A15 — een nulduurmijlpaal gebruikt de in TASK geplande kalendergrens: een geplande dagstart
   *  blijft startmijlpaal, een gepland bandeinde mag op de voorgangerfinish landen.
   *  P6 aan / MS Project uit / OPS uit. */
  p6ZeroDurationUsesPlannedBoundary?: boolean;
  /** A16 — XER `TASK.target_start_date` als geplande vloer naast het netwerk, maar alleen wanneer
   *  start én finish meer dan één kalenderdag later liggen dan de berekende netwerkgrens; een gewone
   *  volgende-bandstart activeert de regel niet.
   *  P6 aan / MS Project uit / OPS uit. */
  p6UseTaskPlannedStartFloor?: boolean;
  /** A17 — P6 kan een TT_FinMile als twee aangrenzende kalendergrenzen opslaan (ES op bandstart, EF
   *  op het vorige bandeinde). Alleen gezien in P3-uitvoer, geen effect op P6-doorgerekende bestanden.
   *  P6 uit / MS Project uit / OPS uit. */
  p6FinishMilestoneBoundaryWindow?: boolean;
  /** A18 — geregistreerde actual start/finish zijn broninstants en worden niet naar een kalenderband
   *  genormaliseerd.
   *  P6 aan / MS Project uit / OPS uit. */
  p6PreserveActualInstants?: boolean;
  /** A19 — P6 bewaart Actual Start als historie, maar de Early/Late Start van een lopende activiteit
   *  is de start van het resterende werk (`max(statusdatum, relatiegrens)`). De XER-vlag
   *  `PROJECT.rem_target_link_flag` stuurt dit niet (de lezer leest hem alleen als diagnose).
   *  Late kant: P6 plant een lopende activiteit op haar restduur (Oracle P6 Help, Durations Columns,
   *  https://docs.oracle.com/cd/F37125_01/p6help/en/47223.htm). Achterwaarts over een SS-relatie is de
   *  late finish van een lopende voorganger dus de toegelaten late start plus de restduur, niet plus de
   *  volle duur; rest 0 ⇒ LS = LF (`CPMSolver.remainingDurationTaskForStartRelation`). Empirisch
   *  bevestigd op één relatie; SF valt er bewust buiten (ongemeten).
   *  P6 aan / MS Project uit / OPS uit (lopende taken houden hun actual-startvenster). */
  p6UseRemainingStartForProgress?: boolean;
  /** A20 — een datetime-SNLT/MSO/FNLT/MFO op een nulduurmijlpaal is een exact bronpunt, ook wanneer
   *  dat punt de inclusieve start van een werkband is.
   *  P6 aan / MS Project uit / OPS uit. */
  p6PreserveZeroDurationConstraintInstants?: boolean;
  /** P6 `SCHEDOPTIONS.sched_use_project_end_date_for_float`: gebruik `project.endDate` (XER
   *  `PROJECT.plan_end_date`) als late-pass-anker. Default uit. Zonder `plan_end_date` blijft
   *  `project.endDate` leeg en rekent de solver op het netwerkeinde, max(EF), alsof de vlag uit staat
   *  (`withEffectiveProjectEndAnchor`) — zoals P6 zonder "Must Finish By". De lezer verzint bewust geen
   *  einde: een verzonnen anker maskeert fouten aan de vroege kant. Heeft het bestand ook geen enkele
   *  `target_end_date`, dan zet de lezer de vlag gerapporteerd uit. */
  useProjectEndDateForFloat?: boolean;
  /** Near-critical-drempel in werkdagen (fractioneel in uur-modus). Afwezig ⇒ uit. */
  nearCriticalThreshold?: number;
  /** Multiple float paths. Afwezig ⇒ uit. */
  floatPaths?: { enabled: boolean; method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number };
  /** A22 — MS Project hervat het restwerk van een lopende taak niet op `max(statusDate,
   *  voorgangerdruk)` (P6 RETAINED_LOGIC, de voortgangstak van `CPMSolver.ts`) maar op `actualStart +
   *  reeds verstreken duur` (`scheduleDuration`/`durationMinutes` − rest, via dezelfde werk-optelling
   *  als het restwerk): een derde, uitsluitend verhogende vloer. Uit ⇒ het P6-gedrag dat
   *  `cases-progress.json` (Scenario A/B/C) bewaakt.
   *  MS Project aan (het profiel van elke `.mpp`-import) / P6 uit / OPS uit. */
  resumeFromActualElapsed?: boolean;
  /** A23 — MS Project verschuift een niet-gestarte taak (`completion === 0`) niet naar op-of-ná de
   *  statusdatum; die vloer (forward pass van `CPMSolver.ts`, vóór `addDurationChecked`) is
   *  P6-RETAINED_LOGIC. Met de vloer wijkt `calendar-exception-precedence.mpp` jaren af van MS
   *  Project, zonder is hij minuut-exact. Een eigen vlag naast `resumeFromActualElapsed`: de twee
   *  bestrijken disjuncte taken (`completion === 0` resp. `> 0`) en delen geen gedrag.
   *  MS Project aan / P6 uit / OPS uit. */
  unstartedIgnoresStatusDate?: boolean;
  /** Projectoptie (geen conventie): P6 zet een VOLTOOIDE activiteit ook aan de late zijde neer als
   *  taak met nul restduur op de statusdatum, niet op haar actual-venster (vgl.
   *  `preserveActualDatesInBackwardPass`). `LS` = de vroegste door haar opvolgers toegestane late
   *  finish, geklemd op `nextWorkInstant(statusdatum)`; `LF = prevWorkInstant(LS)` op de eigen
   *  (voortgangs)kalender. De relatie-lag telt niet tussen twee voltooide activiteiten, wel zolang de
   *  opvolger nog restwerk heeft. Zo krijgt een voltooide activiteit een zinvolle totale float en
   *  oefent ze backward-druk uit op haar voorgangers. Afwezig/false ⇒ de actual-venster-pin.
   *  Alleen de XER-lezer zet dit (`xerScheduleOptions.ts`, P6-default aan). Werkt alleen samen met B3
   *  (`p6CompletedDataDateWindow`), die in elk ingebouwd profiel uit staat: onder het P6-profiel is
   *  deze optie dus inert (`explainP6CompletedLateRemainingWindowEligibilityResolved` ⇒ `conventionOff`).
   *
   *  VALKUIL: de regel is gemeten op één bestand (`rehab-2.xer`); de rest van het corpus is alleen
   *  beschermd door de nauwe poort (`DT_FixedDUR2` + `rem_target_link_flag=Y` + expliciet targetvenster
   *  + `CP_Drtn`). Die poort is correlationeel, geen P6-mechanisme: bij "open voorganger → voltooide
   *  opvolger" spreekt echt P6-gedrag (`cases-p6-verified.json` casus 09 en 10) de regel tegen. Verruim
   *  de poort niet zonder meting. Alleen gemeten onder RETAINED_LOGIC: de lezer zet de optie
   *  fail-closed uit zodra de bron iets anders declareert (`declaresRetainedLogic`). */
  p6CompletedLateFromRemainingWindow?: boolean;
  /** P6-projectoptie "Calculate Start-to-Start lag from" (XER `SCHEDOPTIONS.sched_lag_early_start_flag`:
   *  Y of leeg ⇒ `earlyStart`, N ⇒ `actualStart`; `xerScheduleOptions.ts`). Kiest de variant van C6
   *  (`p6InProgressStartLagElapsed`); staat C6 uit, dan doet deze optie niets. Voor een SS-relatie met
   *  positieve WORKTIME-lag uit een LOPENDE voorganger:
   *   - `'earlyStart'` (afwezig ≡ dit; P6-standaard): de opvolger start op de restwerkstart van de
   *     voorganger plus de rest-lag;
   *   - `'actualStart'`: de opvolger start op de STATUSDATUM plus de rest-lag
   *     (`CPMSolver.inProgressStartLagAnchor`), en de relatie begrenst de lopende voorganger
   *     achterwaarts niet (anders ontstaat onechte negatieve speling).
   *  Rest-lag = `max(0, lag − werktijd(werkelijke start → statusdatum))`, in beide varianten gelijk.
   *  Bron: Oracle P6 Help "Calculate Start-to-Start lag from"
   *  (https://docs.oracle.com/cd/G18294_01/p6help/en/99348.htm). De achterwaartse kant van
   *  `'actualStart'` is niet tegen P6 gemeten. Lag ≤ 0, ELAPSEDTIME-lag en dagmodus houden het gewone
   *  anker en de gewone late kant. Werkt alleen met A19 aan. Per bestand, dus een projectoptie. */
  startToStartLagFrom?: 'earlyStart' | 'actualStart';
  /** Nivelleerinstellingen van het bestand (zie `LevelingSettings`). Afwezig ≡ geen instellingen
   *  bekend (elk formaat behalve XER, en XER zonder SCHEDOPTIONS-rij of zonder `level_*`-kolom). */
  leveling?: LevelingSettings;

  // ── Groep B: P6-conventies die een oud bestand alleen via de XER-bronmarkering kende. Zo'n bestand
  // (`p6Source`, zonder profiel) migreert via `legacyOptionsToProfile`.

  /** B1 — FS-nul-lag op een gedeelde bandgrens: een relatie met
   *  `Sequence.p6StartAtPredecessorFinishBoundary` laat de opvolger op de finishgrens van de voorganger
   *  starten (`relationMath`, `CPMSolver`'s `snapSuccessorEarlyStart` via `preserveP6FinishBoundary`).
   *  Achterwaarts heeft B1 geen eigen tak: de opvolger toont haar LS als gewone bandstart en de LF van
   *  de voorganger komt uit de gewone FS-backward (`prevWorkInstant` op de voorgangerkalender). Staat
   *  de conventie uit, dan stript de `CPMSolver`-constructor de relatievlag.
   *  P6 aan / MS Project uit / OPS uit. */
  p6RelationFinishBoundary?: boolean;
  /** B2 — backward WORKTIME-lag vanaf een exacte bandeinde-grens die precies op een bandstart landt,
   *  geeft de complementaire vorige finishgrens (wo 17:00 − 2 werkdagen = ma 17:00, niet di 08:00;
   *  `CPMSolver.shiftLagPred`). Ook bij FF met lag 0: een late finish van de opvolger op een exact
   *  bandeinde blijft die finishgrens voor de voorganger. Andere relatietypen met lag 0 zijn ongemeten
   *  en ongewijzigd. Alleen uurmodus.
   *  P6 aan / MS Project uit / OPS uit. */
  p6BackwardLagFinishBoundary?: boolean;
  /** B3 — een voltooide XER-bladactiviteit (nauwe herkomstpoort in `explainP6CompletedDataDateWindow`)
   *  krijgt ES/EF als statusdatumvenster; dat venster telt mee voor het projecteinde
   *  (`CPMSolver.backwardPass`) en de float-weergave (`scheduleAnalysis`). Schakelt ook de diagnose-trace
   *  `backwardFloatTrace` in (alleen `check-xer-backward-float-trace` leest die en zet B3 daar zelf aan).
   *  Werkt alleen samen met A19. Alleen gezien in P3-uitvoer, geen effect op P6-doorgerekende bestanden.
   *  P6 uit / MS Project uit / OPS uit. */
  p6CompletedDataDateWindow?: boolean;
  /** B4 — een voltooide LOE met alleen SS-ingang en zonder opvolger volgt de actual-finish-route
   *  i.p.v. de hammockroute (`explainCompletedXerLoeActualFinishEligibilityResolved`, forward pass van
   *  `CPMSolver`). Werkt alleen samen met A19, `preserveActualDatesInBackwardPass` en
   *  `p6PreserveActualInstants`. Alleen gezien in P3-uitvoer, geen effect op P6-doorgerekende bestanden.
   *  P6 uit / MS Project uit / OPS uit. */
  p6CompletedLoeActualFinish?: boolean;
  /** B5 — een niet-gestarte LOE met volledig targetvenster, alleen nul-lag SS-ingang en nul-lag
   *  FF-uitgang neemt dat targetvenster als span (`explainOpenXerLoeTargetSpanEligibilityResolved`,
   *  hammocktak van `CPMSolver`). Zwak bewijs: het enige bestand waarin de regel iets verandert
   *  (`ashspace-primeveraxereditor/sample.xer`) komt uit een XER-editor-repo die de vlaggen zelf kan
   *  zetten.
   *  P6 aan / MS Project uit / OPS uit. */
  p6OpenLoeTargetSpan?: boolean;

  // ── Groep C: P6-conventies uit de corpusmeting, nooit achter een bronmarkering. Een profiel-pset die
  // een sleutel niet kent, krijgt `legacyValue` (uit); een legacy-XER-blob migreert naar het P6-profiel
  // en volgt diens waarden.

  /** C1 — Retained Logic rond de statusdatum: bij een VOLTOOIDE voorganger met een werkelijk einde ná
   *  de statusdatum rekenen de relaties die op zijn einde steunen (FS, FF) vanaf
   *  `prevWorkInstant(snapOnOrAfter(statusdatum))` op zijn voortgangskalender — dezelfde grens als het
   *  B3-venster (`CPMSolver.completedPredecessorRelationWindow`). SS/SF blijven op de werkelijke start.
   *  Geen effect bij: conventie uit, geen statusdatum, dagmodus, een niet-voltooide voorganger, of een
   *  werkelijk einde op/vóór die grens. De eigen datums van de voorganger veranderen nooit. De
   *  grenskeuze (met of zonder `prevWorkInstant`) is ongemeten en volgt B3.
   *
   *  - P6: uit — alleen gezien in P3-uitvoer; geen P6-doorgerekend bestand bevat zo'n geval. Geen
   *    Oracle-bron voor de regel.
   *  - MS Project: uit. Rekent een koppeling vanaf de werkelijke Finish van de voorganger; de
   *    statusdatum verschuift alleen onvoltooid werk (vgl. `unstartedIgnoresStatusDate`).
   *  - OPS: uit (de relatie rekent vanaf het werkelijke einde). */
  p6CompletedPredecessorAtDataDate?: boolean;
  /** C2 — de vrije speling van een NIET-GESTARTE taak telt per relatie in de kalender van de TAAK zelf,
   *  niet in die van de opvolger, voor FS, SS en FF en elke lag: werktijd op de eigen kalender van de
   *  ONGESNAPTE relatiegrens (anker ES bij SS, EF bij FS/FF, plus de lag) tot de vroege opvolgerdatum
   *  (ES bij FS/SS, EF bij FF); de taak-ff is het minimum over de opvolgers (`scheduleAnalysis`). Alleen
   *  uurmodus. Een lag ≠ 0 telt alleen als de lagkalender de voorganger is (`lagCalendar` afwezig of
   *  `predecessor`); lag 0 telt onder elke lagkalender. Een negatieve lag volgt dezelfde regel (gekozen
   *  gedrag, gepind in `check-conventions-p6-flags.ts`). Een GESTARTE, niet-voltooide taak: alleen FS
   *  met lag 0 (breder gaf negatieve waarden die A13 alleen maskeert).
   *  Buiten C2 (ongemeten; de opvolgerkalender blijft): SF, ELAPSEDTIME- en procentlags, een lag ≠ 0 op
   *  een andere lagkalender, elke lag of niet-FS-relatie uit een gestarte taak, en voltooide taken. Een
   *  relatie zonder eigen vrije speling (zoals naar een voltooide opvolger) telt niet mee.
   *  `sequenceFreeFloat` en de driving-markering blijven ongemoeid.
   *
   *  - P6: aan. Empirisch (Hotel, Roads, DCP-03); Oracle zegt niets over kalenders ("op de eigen
   *    kalender" is onze interpretatie, naar analogie van de totale speling). SS+lag en FF+lag zijn elk
   *    op één geval gemeten; FS+lag en negatieve lag zijn extrapolatie via T. Boyle, "Relationship Free
   *    Float and Float Paths in Multi-Calendar Projects" (2018).
   *  - MS Project: uit (ongemeten: het MPP-orakel meet geen vrije speling).
   *  - OPS: uit (relatie-vrije-speling in de kalender van de opvolger). */
  p6FreeFloatOnOwnCalendar?: boolean;
  /** C3 — Retained Logic, verstreken lag: van een positieve WORKTIME-lag uit een VOLTOOIDE voorganger
   *  telt alleen het deel dat na zijn werkelijke einde op de statusdatum nog niet verstreken is:
   *  `max(0, lag − werktijd(werkelijk einde → statusdatum))` in de lagkalender
   *  (`CPMSolver.completedRemainingLagSeq`). Twee routes:
   *  - achterwaarts: op de statusdatum-restvensterroute (`p6CompletedLateFromRemainingWindow`);
   *  - voorwaarts: uit een voltooide voorganger met een C4-venster of een C5-punt
   *    (`CPMSolver.completedOutOfSequenceRelationSeq`).
   *  Een voltooide taak op de generieke actual-pin houdt de volle lag.
   *
   *  - P6: aan — C5 rekent de lag tussen zijn statusdatumpunt en een opvolger met deze regel; C3 uit
   *    maakt honderden exacte cellen in Roads en HarbourPointe inexact. Geen documentatiebron; de regel
   *    is afgelezen aan P3-uitvoer.
   *  - MS Project: uit. Kent geen late-kant-statusdatumvenster voor voltooide taken (zie C1).
   *  - OPS: uit (de volle lag). */
  p6CompletedRemainingLag?: boolean;
  /** C4 — Retained Logic voor een voltooide activiteit buiten volgorde: het nul-restvenster van een
   *  voltooide taak op de statusdatumroute (B3, `explainP6CompletedDataDateWindow`) ligt niet vóór de
   *  relatiegrens van een voorganger die nog niet klaar is. Voor elke FS- of SS-relatie uit een open
   *  voorganger (of uit een voltooide voorganger met zo'n verschoven venster) telt de gewone voorwaartse
   *  relatiegrens; het venster begint op de laatste van die grenzen en de statusdatum (`CPMSolver`,
   *  niet onder `progressMode: 'PROGRESS_OVERRIDE'`). Het verschoven venster bepaalt ES/EF (en daarmee
   *  de speling) en de relatiegrens naar de opvolgers; de late kant blijft ongewijzigd. FF/SF-relaties
   *  doen niet mee (ongemeten).
   *
   *  - P6: uit — alleen gezien in P3-uitvoer, geen effect op P6-doorgerekende bestanden. Context, geen
   *    bewijs: Oracle P6 Professional Help, "General tab - Schedule Options dialog box" (Retained Logic:
   *    de restduur wordt pas gepland als alle voorgangers klaar zijn).
   *  - MS Project: uit. Een voltooide taak houdt haar werkelijke Start en Finish.
   *  - OPS: uit (het venster op de statusdatum). */
  p6CompletedOutOfSequenceWindow?: boolean;
  /** C5 — een VOLTOOIDE activiteit met fysiek voortgangspercentage (`p6CompletePctType === 'CP_Phys'`)
   *  staat als één punt op de statusdatum: ES = EF = het RAUWE statusdatum-instant (niet gesnapt), of
   *  later als een voorganger dat eist — de rauwe relatiegrens (FS/FF: het einde, SS/SF: de start van
   *  een voorganger die nog niet klaar is), of het punt van een voorganger die zelf zo'n punt heeft. De
   *  lag uit een LOPENDE voorganger is de volle lag, behalve bij SS met C6 aan (`inProgressStartLagSeq`:
   *  alleen de rest-lag). Late kant ook één punt: LS = LF = de vroegste grens die de opvolgers stellen
   *  (FS/SS: hun LS, FF/SF: hun LF), zonder statusdatumklem; een voltooide opvolger zonder eigen punt en
   *  zonder restvenster telt niet mee. Zonder opvolger: het projecteinde. Als OPVOLGER legt het punt
   *  gewone backward-druk op een open voorganger. De lag tussen zo'n punt en een buur volgt rekenregel
   *  C3. Vrije speling: over een FS0-relatie naar een punt telt de vrije speling van de voorganger in
   *  haar eigen kalender tot dat punt (`scheduleAnalysis.computeScheduleResults`); andere relatietypen
   *  en lag houden de terugval 0 (ongemeten). Valt C5 uit, dan bestaan er geen punten.
   *  Poort: P6-herkomst, blad, `p6ExplicitTargetWindow`, A19, voltooid met een werkelijk einde op of
   *  vóór de statusdatum, TT_Task of TT_Mile/TT_FinMile, geen suspend/resume; geen eis op het duurtype
   *  (`explainP6CompletedPhysicalPoint`, `CPMSolver.recordCompletedPhysicalPoint`). Geen
   *  Progress-Override-poort (C4 heeft die wel).
   *
   *  - P6: aan. Empirisch (Roads, HarbourPointe, OZB): alle voltooide CP_Phys-activiteiten staan zo.
   *    VALKUIL: de poort is bewust smal. Een brede poort (elke voltooide taak) geeft op de
   *    P6-doorgerekende bestanden hetzelfde, maar verslechtert DCP-03 As-Built (voltooide CP_Drtn-taken
   *    die hun werkelijke datums houden; herkomst onbekend). CP_Drtn/CP_Units zijn niet gemeten en P6's
   *    standaard is CP_Drtn: niet verbreden zonder zo'n bestand. Gepind in `check-conventions-p6-flags.ts`.
   *  - MS Project: uit. Kent geen voortgangstype per activiteit; een voltooide taak houdt haar
   *    werkelijke Start en Finish.
   *  - OPS: uit (de werkelijke datums). */
  p6CompletedPhysicalAtDataDate?: boolean;
  /** C6 — de lag van een SS-relatie uit een LOPENDE voorganger (werkelijke start, niet voltooid) loopt
   *  vanaf die werkelijke start: voorwaarts telt alleen de rest-lag `max(0, lag − werktijd(werkelijke
   *  start → statusdatum))` in de lagkalender, bovenop de restwerkstart van de voorganger; achterwaarts
   *  ligt de LS van de lopende voorganger op de LS van de opvolger min de rest-lag. Alleen positieve
   *  WORKTIME-lag, alleen met A19. FS/FF/SF en ELAPSEDTIME-lag ongewijzigd (ongemeten).
   *  `CPMSolver.inProgressStartLagSeq`. De variant kiest de projectoptie `startToStartLagFrom`.
   *
   *  - P6: aan. Oracle P6 Help "Calculate Start-to-Start lag from"
   *    (https://docs.oracle.com/cd/G18294_01/p6help/en/99348.htm): C6 is de Early-Start-variant,
   *    inclusief de max(0)-vloer ("remaining lag"). Empirisch bevestigd (Roads); het deels verstreken
   *    geval (0 < rest-lag < lag) komt in het corpus niet voor, en de late kant is alleen gemeten bij
   *    rest = geplande duur.
   *  - MS Project: uit. De lag loopt vanaf de start van de voorganger zoals die op de balk staat.
   *  - OPS: uit (de volle lag vanaf de vroege start). */
  p6InProgressStartLagElapsed?: boolean;
  /** C7 — een FF-relatie naar een STARTmijlpaal (nulduur, `milestoneKind: 'START'`; P6 `TT_Mile`) bindt
   *  achterwaarts aan de LATE FINISH van die mijlpaal zelf. Zonder deze conventie behandelt de motor een
   *  startmijlpaal als dagbegin-anker: de LF van de FF-voorganger ligt dan op de werkgrens vóór dat anker
   *  (`relationMath.backwardHour`, `snapStrictBefore` plus de lag-0-normalisatie), en voorwaarts op de
   *  werkgrens strikt ná de voorgangerfinish (`forwardHour`, `snapStrictAfter`), wat de vrije speling van
   *  de voorganger een werkdag korter maakt. Met de conventie vervallen beide sprongen (voorwaarts alleen
   *  voor de vrije speling van een niet-bindende FF). De vroege start van de mijlpaal verandert nooit. De
   *  nulrestduur-voortgangstak van de backward pass valt erbuiten (ongemeten). Alleen uurmodus (dagmodus
   *  is ongemeten; bewuste beperking). Een eindmijlpaal (`TT_FinMile`) blijft ongewijzigd.
   *
   *  - P6: aan. Empirisch (Roads, FF0 naar een `TT_Mile`).
   *  - MS Project: uit (ongemeten).
   *  - OPS: uit (de werkgrens vóór het dagbegin van de mijlpaal). */
  p6FinishFinishStartMilestoneLateFinish?: boolean;
  /** C8 — de geplande-startvloer van A16 (`p6UseTaskPlannedStartFloor`) geldt niet voor een LOPENDE
   *  taak (werkelijke start, voortgang < 100%): haar restwerk begint op de statusdatum en de relatiegrens
   *  uit haar voorgangers (`CPMSolver.forwardPass`, voortgangstak: `remStart`). Leest geen
   *  `restart_date` (verboden bronuitvoer, `check-xer-field-whitelist.ts`): P6's opgeslagen herstart is
   *  alleen de meetlat.
   *
   *  - P6: aan. Empirisch (OZB, Roads).
   *  - MS Project: uit. Het profiel kent de A16-vloer niet.
   *  - OPS: uit. */
  p6StartedTaskIgnoresPlannedStartFloor?: boolean;
  /** C9 — de late finish staat op de EIGEN kalender van de activiteit. Bepaalt een opvolgergrens de late
   *  finish (ook ná de late-zijde-constraints: een strakkere constraint of deadline wint en blijft staan)
   *  en ligt die grens buiten de werktijd van de taak zelf, dan wordt de late finish het einde van de
   *  vorige werkperiode op de eigen kalender. Een grens op of binnen de werktijd (ook op een bandrand)
   *  blijft staan. Niet voor het projecteinde, alleen uurmodus, alleen de generieke backward pass (niet
   *  de voortgangs-, C5-, hammock- of handmatige takken). `CPMSolver.lateFinishOnOwnCalendar`.
   *
   *  - P6: aan. Empirisch (Hotel); er is geen P6-instelling voor gevonden, dus een vaste rekenregel en
   *    geen projectoptie. Late-kant-tegenhanger van C2. Een bredere variant (elke late finish op een
   *    bandstart naar het vorige bandeinde) breekt exacte startmijlpalen; die gevallen vallen onder B2.
   *  - MS Project: uit (ongemeten).
   *  - OPS: uit (de rauwe grens). */
  p6LateFinishOnOwnCalendar?: boolean;
  /** C11 — onder Progress Override (`progressMode: 'PROGRESS_OVERRIDE'`) negeert de planning de relatie
   *  van een NIET-voltooide voorganger naar een al GESTARTE, nog lopende opvolger ook aan de late kant en
   *  in de vrije speling (voorwaarts rekent de voortgangstak al zonder voorgangerdruk): geen
   *  backward-druk op de voorganger en geen relatiegrens in diens vrije speling, dus ook geen
   *  driving-markering. Poort: conventie aan, Progress Override, opvolger gestart en niet voltooid,
   *  voorganger niet voltooid (dat laatste is verdedigend, niet gemeten).
   *  `CPMSolver.progressOverrideIgnoresRelation`.
   *
   *  - P6: aan. Oracle P6 EPPM Help, "Scheduling Settings"
   *    (https://docs.oracle.com/cd/F88966_01/p6help/en/99348.htm): "Progress Override: The schedule
   *    ignores network logic and allows the activity to progress without delay." Gemeten op één project
   *    (OZB), het enige Progress-Override-project in het corpus.
   *  - MS Project: uit. Kent geen Progress Override.
   *  - OPS: uit. */
  p6ProgressOverrideIgnoresStartedSuccessor?: boolean;
  /** C12 — bij een FF-relatie ligt de vroege finish van de opvolger in KLOKTIJD nooit vóór de
   *  relatiegrens X = voorgangerfinish + lag (WORKTIME, lagkalender), eerst genormaliseerd naar de
   *  finish-kant (`prevWorkInstant`: de motor draagt een finish op een bandeinde intern als de volgende
   *  bandstart), behalve als de voorganger een open STARTmijlpaal is (die ankert op een bandstart). Ligt
   *  X ná de berekende vroege finish met nul werktijd ertussen op de eigen kalender (X valt in vrije tijd
   *  van de opvolger), dan wordt de vroege finish de eerste werkgrens op of ná X; de vroege start blijft
   *  staan. Geldt in de niet-gestarte tak en op het restwerk van een lopende taak; niet bij een harde
   *  finish-pin, ELAPSEDTIME-lag, dagmodus of vanuit een hammock (verdedigende poorten, ongemeten). Geen
   *  Progress-Override-poort (fixture pint dat gedrag; ongemeten). Vrije speling: over een FF-relatie
   *  zonder lag telt de vrije speling van een open voorganger in haar eigen kalender tot de vroege FINISH
   *  van de opvolger. `CPMSolver.finishNotBeforeFinishFinishBound`, `scheduleAnalysis.computeScheduleResults`.
   *
   *  - P6: aan. Oracle P6 EPPM Help, "About Relationships"
   *    (https://docs.oracle.com/cd/F88966_01/p6help/en/6616.htm): "The successor activity cannot finish
   *    until its predecessor finishes." Dat P6 dan de volgende bandstart toont is empirisch (Roads,
   *    Hotel). Zonder de normalisatie naar de finish-kant springt elke gewone FF-finish op een bandeinde
   *    een dag vooruit. Bij FF0 naar een startmijlpaal geeft de vrije-spelingkant dezelfde waarde als C7.
   *  - MS Project: uit (ongemeten).
   *  - OPS: uit (het laatste bandeinde vóór de grens; vrije speling via de startgrens). */
  p6FinishNotBeforeFinishFinishBound?: boolean;
  /** C14 — een niet-gestarte ALAP-activiteit (`constraint.type === 'ALAP'`, P6 `CS_ALAP`) op een
   *  uurkalender krijgt als vroege finish de strengste grens die haar opvolgers met hun VROEGE datums via
   *  de gewone achterwaartse relatiewiskunde toestaan (zonder opvolger: haar late finish), en als vroege
   *  start die finish min haar duur, in werktijd op de minuut. Opvolgers eerst (omgekeerde topologische
   *  volgorde), zodat een ALAP-keten aaneensluit; de opvolgers zelf bewegen niet. Ondergrens: de
   *  relatiegrenzen van haar voorgangers en de statusdatum. Haar eigen geplande venster telt niet (een
   *  ALAP-wortel start voorwaarts op de statusdatum) en de A16-vloer geldt niet (`CPMSolver.forwardPass`,
   *  `applyAlapFromSuccessors`). Een `constraint2` blijft gelden: SNLT/FNLT begrenzen de vroege finish
   *  van boven, SNET/FNET de start van onder (`backwardBoundOf`/`forwardBoundOf`); bij een botsing wint
   *  de ondergrens (eigen keuze, niet tegen P6 geijkt).
   *  Bewuste beperkingen (geen P6-bron, geijkt op het corpus): alleen een UURkalender — een ALAP-taak op
   *  een dagkalender houdt de gewone OPS-stap in hele werkdagen (ongemeten; niet veranderen zonder meting); en
   *  alleen niet-gestarte taken (een voltooide ALAP-taak kwam anders verder van P6 te staan).
   *
   *  - P6: aan. Oracle P6 Help, constraint "As Late As Possible": zo laat als kan zonder de opvolgers te
   *    vertragen, dus binnen de vrije speling. Empirisch (HarbourPointe, ALAP-keten).
   *  - MS Project: uit. Plant ALAP vanaf de late datums van de taak (ongemeten).
   *  - OPS: uit (de gewone stap: de vroege datums schuiven in hele werkdagen op met de vrije speling, in
   *    topologische volgorde, ook bij een gestarte taak). */
  p6AlapPositionedFromSuccessors?: boolean;
}

/**
 * Rekenprofielen (tweelagenmodel): de zevenentwintig PAKKETCONVENTIES — regels die per planningspakket
 * verschillen en niet per bestand. Ze leven in het profiel (`Project.schedulingProfile`), niet in
 * `Project.schedulingOptions`; die draagt de per-bestand projectinstellingen. De twee
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

/** Wat `Project.schedulingOptions` draagt: uitsluitend projectopties. */
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
  /** Projectstandaard-werkregel voor elke taak zonder eigen `workRule`. Afwezig ⇒ FIXED_DURATION_RATE.
   *  Round-tript via `OPS_ProjectSettings` (`DefaultWorkRule`). */
  defaultWorkRule?: import('@/types/workRule').WorkRule;
  /**
   * WBS-codes automatisch nummeren (1.2.3.4, afgeleid uit de boompositie): aan ⇒ live
   * hernummeren bij elke structuurmutatie; uit/ontbreekt ⇒ vrije tekst, met een expliciete
   * "Hernummer WBS"-actie. Nieuwe projecten krijgen true; geladen bestanden zonder vlag blijven op
   * vrije tekst (MSP-stabiliteitsmodel: codes in omloop worden niet stilzwijgend herschreven).
   */
  wbsAutoNumber?: boolean;
  /** P6 "data date": de grens verleden/toekomst. undefined = geen statusdatum. Gezet ⇒ restwerk
   *  start niet vóór deze datum. */
  statusDate?: string;    // ISO — date-only in dag-modus; mag datetime zijn in uur-modus
  /** Voortgangsmodus; undefined ⇒ RETAINED_LOGIC. Documentinstelling. */
  progressMode?: ProgressMode;
  /** Per-bestand projectopties; afwezig ⇒ alle defaults. De conventies staan in `schedulingProfile`. */
  schedulingOptions?: ProjectSchedulingOptions;
  /** Rekenprofiel (de pakketconventies). Afwezig ≡ het ingebouwde `ops`-profiel zonder afwijkingen.
   *  De solver krijgt één set via `effectiveSchedulingOptions(project)`
   *  (`engine/scheduler/conventions/registry.ts`). */
  schedulingProfile?: SchedulingProfile;
  /** Binding aan een resourcebibliotheek. Afwezig ⇒ aan geen bibliotheek gebonden; heropenen zonder
   *  de pool is onschuldig. `companyName` is een gedenormaliseerde cache zodat een gedeeld bestand de
   *  naam toont zonder de pool. */
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
