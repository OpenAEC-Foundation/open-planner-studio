# Spoor O — Rekenprofielen, kritisch: auditrapport (stap 1, alleen lezen)

Werkmap: `/home/user/audit/o2`, worktree van `main` @ `91da0168`. Corpus: `/home/user/ops-xer-corpus`
(`ccc952c`, alleen gelezen). Datum: 2026-09-28. Geen bestaande bestanden gewijzigd, geen commits.
Alle eigen scripts en uitvoer staan in `audit-o/` (zie §6).

Labels (draaiboek §2.2): **zeker** = gereproduceerd met script en uitvoer; **afgeleid** = redenering uit code
met `pad:regel`; **onbekend** = geen bron. Een uitspraak over P6 of MS Project zonder orakel of
Oracle/Microsoft-tekst is *onbekend*. De docblokken in `src/types/project.ts` en het register zijn
*beweringen die hier getoetst worden*, geen bron.

## 0. Samenvatting

- `npm run measure:profiles` (1 van de 2 toegestane runs gebruikt) is op deze corpusclone **niet uit te voeren**.
  De P6-poort weigert omdat 41 niet-orakelbestanden uit het manifest ontbreken. De MSP-poort ziet 49 van de
  213 gepinde bestanden, omdat `OPS_MPP_CRAWL` naar de corpus-**root** moet wijzen en niet naar `crawl-mpp`.
  Met de root is de losse batterij `check-mpp-fidelity.ts` groen (213/213, 0 afwijkingen).
- Een eigen meting op alleen de 9 orakels, met exact de meetlat van de X12-check (`audit-o/measure-oracles.ts`),
  reproduceert de gepinde cellen **exact**: 221 gepind, 0 nieuw inexact, 0 nieuw exact, 0 van emmer gewisseld.
  Regel A houdt dus op `main`, ook ná de ALAP- en dag→uur-fixes van #241, die daar niet tegen het corpus gemeten
  waren. De 76 zesassige restafwijkingen uit `docs/TODO.md` kloppen tot op de cel: HarbourPointe 61, Sample 12, Hotel 3.
- Per conventie omgezet onder het P6-profiel: **geen enkele omzetting maakt een zesassige cel beter**. 18
  omzettingen maken cellen slechter; 9 hebben geen effect. Vijf daarvan zijn waarden in het P6-profiel (A12, A15,
  A16 en A18 staan aan, A23 staat uit). De andere vier staan in elk profiel uit (B3, B4, C1, C4). Onder het
  MSP-profiel (213 `.mpp`) idem: niets wordt beter, 4 omzettingen maken slechter (A16, A19, A22, A23).
- De registertekst over A17 ("aan of uit verandert geen enkele gemeten cel") is **onjuist**: A17 aan maakt 118
  exacte OZB-cellen inexact. "P6 uit" is daarmee juist beter onderbouwd dan de tekst zegt.
- Kleinere functionele bevindingen: de A19-achterdeur breekt een wissel na opslaan (2 van 324 paden).
  "Standaardopties" overschrijft opties die de UI zelf als alleen-lezen bronsignaal toont. Het MSP-profiel
  krijgt zijn float-standaard (`smallest`) niet bij een `.mpp`-import.

## 1. Conventies (27) en projectopties (11): waarde per profiel, bron en oordeel

### 1.1 Meetmethode

- **Orakel-P6.** 9 orakels (`role: oracle, included: true`). Daarvan telt de officiële poort er 8:
  `P6-Viewer/XER Files/Hotel Project.xer` heeft dezelfde schema-vingerafdruk als `Hotel_Construction_TEC.xer`
  (`f1e5f479674e3ce4`, zeker, `audit-o/fingerprint.ts`) en valt in `buildXerTargetBaseline` af
  (`tests/planning/xerFidelity.ts:417`). De getallen hieronder zijn over die **8 officiële bestanden** en tellen
  cellen die exact waren en inexact worden, over zes assen plus drivingPath (`audit-o/oracles-variants-8files.tsv`).
  Zesassig apart: `audit-o/oracles-variants-6as.txt`. In geen enkele omzetting wordt een zesassige cel beter.
- **Orakel-MSP.** 213 bruikbare `.mpp`-bestanden uit de crawl; MS Project slaat alleen Start/Finish op (twee
  assen). De basismeting heeft 0 niet-exacte cellen (`audit-o/mpp-variants.txt`).
- Een conventie die bij omzetten niets verandert, heeft **geen orakelbewijs** voor haar waarde, in welke richting ook.
- **MSP "+0": twee soorten.** Een conventie achter een P6-datagate is op een `.mpp`-import *structureel* niet te
  meten, want de lezer zet die velden niet. Dat geldt voor `p6ProjectId`, `p6ActivityType`,
  `p6ExplicitTargetWindow`, `p6CompletePctType`, `p6DurationType` en de relatievlag van B1 (A15, A18, B1, B3–B5, C5
  en een deel van A16/A20/C1/C4). Voor de conventies zonder zo'n poort (onder meer A12, A13, A17, B2, C2, C3, C6,
  C7, C9, C11, C12, C14) betekent +0 wél "getest en neutraal op dit corpus". In beide gevallen blijft de MSP-waarde
  onbekend. De indeling per conventie is afgeleid uit de docblokken en de poorten (`explain…`-functies), niet
  per conventie nagemeten.
- **OPS-kolom.** OPS is per definitie het eigen gedrag van de app (spec rekenprofielen, `legacyValue = builtIn.ops`,
  `registry.ts:86`). Daar is geen externe bron voor nodig en die wordt ook niet beoordeeld. Voor elke conventie
  is OPS = uit.

Afkortingen: "+N (bestand)" = N cellen worden inexact als de waarde wordt omgezet. Ook genoemd: 99348 = Oracle P6
EPPM Help *Scheduling Settings* (https://docs.oracle.com/cd/F88966_01/p6help/en/99348.htm) en SO-client = P6
Professional Help *General tab – Schedule Options dialog box*
(https://docs.oracle.com/cd/F25600_01/client_help/en_US/general_tab_-_schedule_options_dialog_box.htm).

### 1.2 De 27 conventies

| id | P6 | MSP | OPS | bron per waarde | oordeel | label |
|---|---|---|---|---|---|---|
| A12 `preserveActualDatesInBackwardPass` | aan | uit | uit | P6: omzetten +0 op alle orakels, geen Oracle-tekst ⇒ **geen bron**. MSP: aanzetten +0 ⇒ geen bron. | P6 onbekend · MSP onbekend | zeker |
| A13 `clampNegativeFreeFloat` | aan | uit | uit | P6: uit ⇒ +3 (OZB). MSP: aan ⇒ +0; Microsoft *Free Slack*-pagina zegt niets over negatieve vrije speling (https://support.microsoft.com/en-us/office/free-slack-task-field-87145b2b-8d50-45a1-b89b-89aa73015d17). | P6 juist · MSP onbekend | zeker |
| A15 `p6ZeroDurationUsesPlannedBoundary` | aan | uit | uit | P6: +0 (alleen niet-orakels zoals hb-intel dragen het). MSP: +0. | P6 onbekend · MSP onbekend | zeker |
| A16 `p6UseTaskPlannedStartFloor` | aan | uit | uit | P6: +0. MSP: aan ⇒ **+23** (2 `.mpp`). | P6 onbekend · MSP juist | zeker |
| A17 `p6FinishMilestoneBoundaryWindow` | uit | uit | uit | P6: aan ⇒ **+118** (OZB), in tegenspraak met `registry.ts:94-95` en `types/project.ts:95-97`. MSP: +0. | P6 juist · MSP onbekend | zeker |
| A18 `p6PreserveActualInstants` | aan | uit | uit | P6: +0. MSP: +0. | P6 onbekend · MSP onbekend | zeker |
| A19 `p6UseRemainingStartForProgress` | aan | uit | uit | P6: uit ⇒ **+978** (OZB 80, HP 77, Roads 821). Oracle *Durations Columns* (https://docs.oracle.com/cd/F37125_01/p6help/en/47223.htm): "The total working time from the activity remaining start date to the remaining finish date." MSP: aan ⇒ **+58** (31 `.mpp`). | P6 juist · MSP juist | zeker |
| A20 `p6PreserveZeroDurationConstraintInstants` | aan | uit | uit | P6: uit ⇒ +2 (TERMINAL, één bestand). MSP: +0. | P6 juist (n=1) · MSP onbekend | zeker |
| A22 `resumeFromActualElapsed` | uit | aan | uit | P6: aan ⇒ +200 (OZB 48, HP 152). MSP: uit ⇒ **+3** (3 `.mpp`). | P6 juist · MSP juist | zeker |
| A23 `unstartedIgnoresStatusDate` | uit | aan | uit | P6: aan ⇒ +0 (geen bron voor "uit"). MSP: uit ⇒ **+1** (1 `.mpp`). | P6 onbekend · MSP juist (n=1) | zeker |
| B1 `p6RelationFinishBoundary` | aan | uit | uit | P6: uit ⇒ **+3131** (Hotel). MSP: +0. | P6 juist · MSP onbekend | zeker |
| B2 `p6BackwardLagFinishBoundary` | aan | uit | uit | P6: uit ⇒ +117 (Hotel 111, Sample 2, ashspace 4). MSP: +0. | P6 juist · MSP onbekend | zeker |
| B3 `p6CompletedDataDateWindow` | uit | uit | uit | P6: aan ⇒ +0 (alleen rehab-2/P3). MSP: +0. | P6 onbekend · MSP onbekend | zeker |
| B4 `p6CompletedLoeActualFinish` | uit | uit | uit | P6: aan ⇒ +0. MSP: +0. | P6 onbekend · MSP onbekend | zeker |
| B5 `p6OpenLoeTargetSpan` | aan | uit | uit | P6: uit ⇒ +20, **alleen** `ashspace-primeveraxereditor/sample.xer`, een twijfelachtig orakel (§2.3). MSP: +0. | P6 twijfel · MSP onbekend | zeker |
| C1 `p6CompletedPredecessorAtDataDate` | uit | uit | uit | P6: aan ⇒ +0. MSP: +0. Er is geen Microsoft-tekst gevonden voor de MSP-bewering in de docblok. | P6 onbekend · MSP onbekend | zeker |
| C2 `p6FreeFloatOnOwnCalendar` | aan | uit | uit | P6: uit ⇒ +259 (Hotel 247, Roads 12). Geen Oracle-tekst (docblok: T. Boyle 2018, geen primaire bron). MSP: +0. | P6 juist (orakel) · MSP onbekend | zeker |
| C3 `p6CompletedRemainingLag` | aan | uit | uit | P6: uit ⇒ +674 (HP 158, Roads 516). MSP: +0. | P6 juist · MSP onbekend | zeker |
| C4 `p6CompletedOutOfSequenceWindow` | uit | uit | uit | P6: aan ⇒ +0. MSP: +0. | P6 onbekend · MSP onbekend | zeker |
| C5 `p6CompletedPhysicalAtDataDate` | aan | uit | uit | P6: uit ⇒ +833 (OZB 56, HP 68, Roads 709). MSP: +0. | P6 juist · MSP onbekend | zeker |
| C6 `p6InProgressStartLagElapsed` | aan | uit | uit | P6: uit ⇒ +201 (Roads). SO-client: "The expired lag is calculated as the number of workperiods between the actual start and the data date. The successor's start date is the predecessor's internal early start plus any remaining lag." MSP: +0. | P6 juist · MSP onbekend | zeker |
| C7 `p6FinishFinishStartMilestoneLateFinish` | aan | uit | uit | P6: uit ⇒ +228 (Roads). MSP: +0. | P6 juist · MSP onbekend | zeker |
| C8 `p6StartedTaskIgnoresPlannedStartFloor` | aan | uit | uit | P6: uit ⇒ +79 (OZB 58, Roads 21). MSP: +0. | P6 juist · MSP onbekend | zeker |
| C9 `p6LateFinishOnOwnCalendar` | aan | uit | uit | P6: uit ⇒ +24 (Hotel). MSP: +0. | P6 juist · MSP onbekend | zeker |
| C11 `p6ProgressOverrideIgnoresStartedSuccessor` | aan | uit | uit | P6: uit ⇒ +4 zesassig, +1 drivingPath (OZB, één Progress-Override-project). 99348: "Progress Override: The schedule ignores network logic and allows the activity to progress without delay." MSP: +0. | P6 juist (n=1 project) · MSP onbekend | zeker |
| C12 `p6FinishNotBeforeFinishFinishBound` | aan | uit | uit | P6: uit ⇒ +9 (Hotel 4, Roads 5). *About Relationships* (https://docs.oracle.com/cd/F88966_01/p6help/en/6616.htm): "The successor activity cannot finish until its predecessor finishes." MSP: +0. | P6 juist · MSP onbekend | zeker |
| C14 `p6AlapPositionedFromSuccessors` | aan | uit | uit | P6: uit ⇒ +23 (HP). Oracle *As Late as Possible Constraint* (https://docs.oracle.com/cd/F51303_01/client_help/en_US/as_late_as_possible_constraint.htm): "This constraint sets the early dates as late as possible without affecting successor activities." MSP: +0 op de `.mpp`. Microsoft (https://support.microsoft.com/en-us/office/set-a-task-start-or-finish-date-constraint-for-a-task-3a7544fa-e992-4647-911b-54cdbe508784): "The task starts as late as it can without delaying other tasks." Dat ondersteunt de docblokbewering "MSP plant ALAP vanaf de late datums" niet. | P6 juist · MSP twijfel | zeker (meting), afgeleid (MSP-tekst) |

Oordelen per kolom, over 27 conventies:
- **P6-waarde:** juist 17 (A13, A17, A19, A20, A22, B1, B2, C2, C3, C5, C6, C7, C8, C9, C11, C12, C14),
  twijfel 1 (B5), onbekend 9 (A12, A15, A16, A18, A23, B3, B4, C1, C4), onjuist 0.
- **MSP-waarde:** juist 4 (A16, A19, A22, A23), twijfel 1 (C14), onbekend 22, onjuist 0.
- **OPS-waarde:** ontwerpkeuze, geen oordeel.

### 1.3 De 11 projectopties

"P6" = `p6OptionDefaults()` (`registry.ts:236-255`), tevens de terugval van de XER-lezer; "MSP" =
`defaultOptionsFor('msproject')` (`registry.ts:265-266`); "OPS" = afwezig, dus de solverstandaard. Belangrijk:
de P6- en MSP-waarden gelden alleen bij de wizard en bij "Standaardopties". Een XER-import leest de waarde uit het
bestand; een `.mpp`-import zet géén opties (zie bevinding O-9).

| id | P6 | MSP | OPS | bron per waarde | oordeel | label |
|---|---|---|---|---|---|---|
| `lagCalendar` | `predecessor` | afwezig (≡ predecessor) | afwezig (≡ predecessor) | Orakel: volgens de lezer hebben 7 van de 8 officiële bestanden `predecessor` en HP `successor` (6 rauw gelezen in SCHEDOPTIONS; Roads alleen via de lezer, want de rauwe extractie faalde op de codering). Omzetten naar successor/24h/projectDefault kost +7321/+16720/+12901 cellen, dus de lezer moet de bestandswaarde volgen, en dat doet hij. **Standaard:** SO-client zegt "If you do not select a calendar, Successor Activity Calendar is used to calculate lag." De WS-referentie zegt hetzelfde (https://docs.oracle.com/cd/G18294_01/English/Integration_Documentation/p6_eppm_web_services_reference/42402.htm). De lezer valt bij een leeg veld terug op `predecessor` (`xerScheduleOptions.ts:520-527`). MSP: geen bron. | P6 twijfel (terugval tegen Oracle-tekst, ongemeten) · MSP onbekend | zeker (meting), afgeleid (terugval) |
| `criticalDefinition` | `{totalFloat, thresholdHours 0}` | afwezig | afwezig | Oracle beschrijft de keuze (SO-client "Define critical activities as") maar noemt geen standaard. Orakel: Roads draagt `longestPath` uit het bestand; op de zes assen geen effect. Zie O-15 voor drivingPath. | P6 onbekend (standaard) · MSP onbekend | zeker |
| `totalFloatMode` | `finish` | `smallest` | afwezig = hybride (lopend ⇒ finish, anders min) | Orakel: alle bestanden `FT_FF`. smallest/start/afwezig verandert **0** cellen, dus het orakel onderscheidt de modi niet. Oracle noemt geen standaard. MSP: Microsoft *Total Slack* (https://support.microsoft.com/en-us/project/total-slack-task-field): "Total slack is calculated as the smaller value of the Late Finish minus the Early Finish field, and the Late Start minus the Early Start field." | P6 onbekend · MSP juist (doc), maar niet toegepast bij `.mpp` (O-9) | zeker |
| `makeOpenEndedCritical` | `false` | afwezig | afwezig | Orakel: alle bestanden N; `true` ⇒ +111 (alle bestanden). Standaard: geen Oracle-tekst. | P6 juist (orakel voor bestandswaarde), standaard geen bron · MSP onbekend | zeker |
| `useExpectedFinishDates` | `true` | afwezig | afwezig | SO-client: "This option is checked by default." Orakel: omzetten +0 (geen expected-finish-taken). | P6 juist (doc) · MSP n.v.t. | zeker |
| `useProjectEndDateForFloat` | (niet in defaults; uit bestand) | afwezig | afwezig | Orakel: omzetten ⇒ +195 (TERMINAL), dus bestandswaarde lezen is nodig. Standaard: geen bron. | P6 juist (bestandswaarde) · MSP n.v.t. | zeker |
| `nearCriticalThreshold` | afwezig | afwezig | afwezig | Eigen OPS-functie; geen P6/MSP-claim in de code. | n.v.t. | afgeleid |
| `floatPaths` | afwezig (uit bestand) | afwezig | afwezig | Oracle beschrijft de optie (99348), geen standaard; geen orakelas. | onbekend | afgeleid |
| `p6CompletedLateFromRemainingWindow` | `true` | afwezig | afwezig | Alleen rehab-2 (P3). Onder elk ingebouwd profiel inert, omdat B3 uit staat; omzetten +0. Tegenspraak: `types/project.ts:149` ("Alleen de XER-lezer zet dit") ↔ `defaultOptionsFor('p6')` zet hem ook (O-6). | P6 onbekend · MSP n.v.t. | zeker |
| `startToStartLagFrom` | `earlyStart` | afwezig (≡ earlyStart) | afwezig | Orakel: alle bestanden Y; `actualStart` ⇒ +28 (Roads). SO-client beschrijft beide varianten, zonder standaard. | P6 juist (bestandswaarde), standaard geen bron · MSP onbekend | zeker |
| `leveling` | afwezig (uit bestand) | afwezig | afwezig | Alleen data, geen rekeneffect (`.claude/rules/rekenprofielen.md`). | n.v.t. | afgeleid |

Oordelen over de 11 projectopties:
- **P6-waarde:** juist 4 (makeOpenEndedCritical, useExpectedFinishDates, useProjectEndDateForFloat,
  startToStartLagFrom), twijfel 1 (lagCalendar), onbekend 4 (criticalDefinition, totalFloatMode, floatPaths,
  p6CompletedLateFromRemainingWindow), n.v.t. 2 (nearCriticalThreshold, leveling), onjuist 0.
- **MSP-waarde:** juist 1 (totalFloatMode `smallest`, Microsoft-tekst), onbekend 5, n.v.t. 5.

## 2. Bevindingen

| nr | titel | ernst | pad:regel | mechanisme | reproductie | label |
|---|---|---|---|---|---|---|
| O-1 | `measure:profiles` weigert op de corpusclone van de sweep | hoog (proces: poort 3 van §4 is hier niet uit te voeren) | `tests/planning/xerFidelity.ts:338-340`; `tests/planning/check-mpp-fidelity.ts:493,731-744` | `buildXerTargetBaseline` eist élk manifestbestand (93). In de clone ontbreken 41 niet-orakelbestanden (ProjectLens, cpp-cpm-engine, delay-analysis-toolkit, mpxj-xer, p6flow); de 9 orakels zijn er wel. De MSP-telpin wil 213 bestanden en telt labels relatief aan `OPS_MPP_CRAWL`. Met `…/crawl-mpp` worden er 49 gezien, met de corpus-root 658 (213 bruikbaar). Het antwoord op §5 stap 4 is dus: het meet niet stil minder, het stopt. | `audit-o/measure-profiles-run1.txt` (UITSLAG ROOD; P6 "X1-manifest/grondwaarheid faalt: manifestbestand ontbreekt…"; MSP "verwacht 213, kreeg 49"); `audit-o/mpp-fidelity-root.txt` (root ⇒ GROEN, 2173 checks) | zeker |
| O-2 | Regel A houdt op `main`, ook na #241 | info | — | Oracle-only meting met de meetlat van de X12-check reproduceert de 221 gepinde cellen exact. #241 zei dat de ALAP- en dag→uur-fixes "niet gemeten" waren tegen het corpus; ze raken geen orakelcel. | `audit-o/oracles-variants.txt` regel "base vs pin: gepind 221, gemeten 312 [+91 = het duplicaat Hotel Project.xer], nieuw exact 0, emmer gewijzigd 0" | zeker |
| O-3 | Registertekst over A17 is onjuist | laag (documentatie; waarde zelf juist) | `src/engine/scheduler/conventions/registry.ts:94-95`; `src/types/project.ts:95-97` | Tekst: "aan of uit verandert geen enkele gemeten cel" en "geen effect op P6-doorgerekende bestanden". Gemeten: A17 aan ⇒ +118 zesassige cellen op OZB (P6-doorgerekend). Voor B3, B4, C1 en C4 klopt "geen effect" wel. | `flip:p6FinishMilestoneBoundaryWindow` in `audit-o/oracles-variants-6as.txt` | zeker |
| O-4 | A19-achterdeur: OPS/MSP{A19 aan} → P6 → opslaan → heropenen → terugwissel verliest A19 | laag | `src/services/ifc/schedulingOptionsRead.ts:237` | De sanitizer laat een letterlijke A19-override `true` onder id `p6` vallen, voor oude bestanden. Dezelfde vorm ontstaat ook via `switchProfile` vanuit OPS/MSP met A19 aan. Zonder opslaan komt het origineel terug, na opslaan niet. 2 van 324 geteste wisselpaden (27 conventies × 6 basisparen × 2 waarden). | `audit-o/probe-profiles.txt` P1/P2: "terug naar OPS zonder opslaan: A19=true; met opslaan: A19=false" | zeker |
| O-5 | "Standaardopties van dit profiel" overschrijft opties die de UI als alleen-lezen bronsignaal toont | middel | `src/state/schedulingProfileDraft.ts:177`, `:181-189`; `src/components/settings/SchedulingProfileSection.tsx:54`, `:309`; docblok `:72` | Twee lijsten spreken elkaar tegen. Het bewerkmodel beschermt `useProjectEndDateForFloat` en `leveling`. De UI toont `useExpectedFinishDates`, `useProjectEndDateForFloat` en `p6CompletedLateFromRemainingWindow` als "niet bewerkbaar". Onder P6 zet de knop `useExpectedFinishDates` en de fail-closed `p6CompletedLateFromRemainingWindow` terug op `true` (OZB 10093 draagt `false`). De gebruiker kan dat daarna alleen via Annuleren of Ctrl+Z terugzetten. De docblok (`:72`) zegt dat `useProjectEndDateForFloat`/`leveling` "vallen dan weg"; de code bewaart ze. Op de 9 orakels geeft de knop 0 celverschil (gemeten), omdat de orakels de standaardwaarden dragen of de optie inert is. | `audit-o/probe-profiles.txt` P4; `ui:standaardopties(P6)` in `audit-o/oracles-variants-6as.txt` | zeker |
| O-6 | Wizard met P6 op een nieuw project zet P6-bronsignalen | laag | `src/engine/scheduler/conventions/registry.ts:236-255`; `src/components/settings/SchedulingProfileSection.tsx:132`, `:175-176`; `src/types/project.ts:149` | `defaultOptionsFor('p6')` zet `useExpectedFinishDates` en `p6CompletedLateFromRemainingWindow`. Het blok "bronopties uit het bestand" verschijnt dan bij een project zonder P6-bron. Dat spreekt het commentaar op `:175` ("een project zonder P6-bron toont het blok niet") en `types/project.ts:149` ("Alleen de XER-lezer zet dit") tegen. Inert (B3 uit, geen `p6ExpectedFinish`). | `audit-o/probe-profiles.txt` P4 "wizard … P6: {…useExpectedFinishDates:true, p6CompletedLateFromRemainingWindow:true…}" | zeker |
| O-7 | Wissel van eigen naar ingebouwd profiel gooit afwijkingen uit het bestand weg | laag | `src/engine/scheduler/conventions/registry.ts:282-285`; `src/state/schedulingProfileDraft.ts:47-59` | Bewust ontwerp ("kale basis"). Maar een bestand met gemigreerde afwijkingen (legacy XER {A13 uit}) ⇒ één conventie bewerken ⇒ eigen profiel "Kopie van P6" ⇒ terug naar "P6" geeft A13 aan. De bestandswaarde is stil weg, zonder melding. | `audit-o/probe-profiles.txt` P3 "A13 na terugkeer: true (was false)" | zeker |
| O-8 | Onzichtbare letterlijke afwijking onder OPS | laag | `src/state/schedulingProfileDraft.ts:208-213`; `SchedulingProfileSection.tsx:260`, `:285` | Na P6{A13 uit} → OPS staat `A13:false` letterlijk in OPS (gelijk aan de basis). De UI toont geen afwijking en geen "terug naar basis"-knop, en `sameSettings` ziet het weghalen als "geen wijziging". Bij een latere wissel naar P6 komt de afwijking terug ("P6 (aangepast)"). Dit is precies het herkomstontwerp; het punt is alleen dat de gebruiker het niet ziet. | `audit-o/probe-profiles.txt` P5 | zeker |
| O-9 | MSP-profiel: de float-standaard `smallest` geldt niet bij een `.mpp`-import | middel | `src/services/mpp/mppReader.ts:988`; `src/engine/scheduler/conventions/registry.ts:265-266`; `src/engine/scheduler/scheduleAnalysis.ts:321-327` | De `.mpp`-lezer zet profiel `msproject` maar geen opties. `totalFloatMode` afwezig betekent de hybride formule: een gestarte taak krijgt finish-float. Een nieuw project met het MSP-profiel krijgt wel `smallest`. Hetzelfde profiel rekent zo op twee manieren; Microsoft zegt "the smaller value". Ongemeten: het MPP-orakel meet geen speling. | code (drie plaatsen hierboven) | afgeleid |
| O-10 | MSPDI-export meldt `totalFloatMode: 'smallest'` niet als verlies, maar MSPDI heropent zonder die optie | laag (zone spoor F) | `src/services/msproject/mspdiWriter.ts:388`; `src/services/msproject/mspdiReader.ts:742` | De schrijver behandelt `smallest` als native. De MSPDI-lezer zet geen `totalFloatMode` en opent als OPS, dus als de hybride formule. Na een round-trip verandert de speling van gestarte taken stil. | code | afgeleid |
| O-11 | XER-terugval voor `lagCalendar` tegen de Oracle-tekst | laag | `src/services/xer/xerScheduleOptions.ts:520-527` | Een leeg of onbekend `sched_calendar_on_relationship_lag` ⇒ `predecessor`. Oracle: "If you do not select a calendar, Successor Activity Calendar is used" (SO-client en WS-referentie). Geen orakelbestand heeft een leeg veld, dus ongemeten. | code + citaten §1.3 | afgeleid |
| O-12 | Een herkomst-datagate buiten elke conventie: een omweg die `verify:conventions` niet ziet | laag | `src/engine/scheduler/CPMSolver.ts:2357` | `task.p6ProjectId ? hasValidP6SuspendResume(task) : true` kiest per bronformaat of `time.resume` gebruikt wordt. Er staat geen conventie of optie omheen. De poort telt datagates alleen (`scripts/verify-conventions.mjs`, regel 2), terwijl de regel (`.claude/rules/rekenprofielen.md`) zegt dat ze "bínnen conventies" staan. Inhoudelijk verdedigbaar als datavalidatie, maar het is letterlijk een formaat-`if` in de motor. Alle andere solver-ingangen gaan via `solveOptionsFor`/`solveInputFor` (projectSlice:384, documentSlice:756, documentActivation:238, scheduleSlice:133, occupancy:78/151, benchmark/runner:155). `npm run verify:conventions`: OK. | `grep -n p6ProjectId src/engine/scheduler/CPMSolver.ts` | afgeleid |
| O-13 | Negen conventiewaarden zonder orakelbewijs; B5 alleen op het twijfelachtige orakel | info (voor de eigenaar) | `registry.ts:97-130` | A12, A15, A16 en A18 (P6 aan) en A23 (P6 uit): omzetten verandert op geen enkel P6-orakel een cel. B3, B4, C1 en C4 (overal uit): aanzetten ook niet. B5: +20, alleen op ashspace. | `audit-o/oracles-variants-8files.tsv` | zeker |
| O-14 | Het P6-profiel is per conventie een lokaal optimum; MSP ook | info | — | Geen enkele omzetting van één conventie maakt een zesassige P6-cel beter; onder MSP maakt geen omzetting een `.mpp`-cel beter. Profielwissel op de orakels: OPS +5031, MSP +6459. Op de `.mpp`: OPS +4 en P6 +82 t.o.v. MSP. | `audit-o/oracles-variants-6as.txt`, `audit-o/mpp-variants.txt` | zeker |
| O-15 | drivingPath-as meet `isCritical`, niet het "driving path" | laag (meetlat, zone A/T) | `tests/planning/check-xer-product-fidelity-x12.ts` (`solveImported`: `drivingPath: task.time.isCritical`) | Met `criticalDefinition: longestPath` dalen de drivingPath-afwijkingen van 233 naar 54 (8+1 bestanden), zonder zesassig effect. De as volgt de kritiekdefinitie van het bestand, niet P6's `driving_path_flag`-begrip. Dat de solver onder TF≤0 de driving-vlag goed zou hebben, wordt hier dus niet gemeten. | `opt:criticalDefinition=longestPath` in `audit-o/oracles-variants-6as.txt` | zeker (meting), afgeleid (interpretatie) |
| O-16 | E4-orakel "Hotel Project.xer" meet niets extra, en de manifestuitsluiting verschilt | laag (manifest = eigenaarsterrein) | `tests/planning/xerFidelity.ts:416-420`; `tests/planning/xer-corpus-manifest.json` | Zelfde schema-vingerafdruk als `Hotel_Construction_TEC.xer`, dus de poort slaat hem over. De TEC-versie sluit project CR (2665, `p6Computed: false`) uit, de P6-Viewer-versie niet. Nu onschadelijk; wordt het TEC-bestand ooit verwijderd, dan komen 19 drivingPath-cellen van een niet-doorgerekend project in de meting. `readManifestExclusions` controleert alleen byte-identieke labels. | `audit-o/fingerprint.ts` (beide `f1e5f479674e3ce4`); drivingPath 88 vs 69 in `audit-o/oracles-base.json` | zeker |
| O-17 | Extensie-API: 6 van de 11 opties, zonder waardecontrole | laag | `src/extensions/extMappers.ts:57-66`, `:175`, `:203`; `src/extensions/extTypes.ts:63-70` | Richting extensie ontbreken `thresholdHours` (een XER-drempel komt door als `threshold: undefined`), `useExpectedFinishDates`, `useProjectEndDateForFloat`, `startToStartLagFrom`, `p6CompletedLateFromRemainingWindow` en `leveling`. Richting app (`fromExtProject`/extensie-import): de enum- en getalwaarden worden niet gevalideerd. De IFC-lezer filtert ze pas bij heropenen. Het profiel zelf is correct alleen-lezen. | code | afgeleid |
| O-18 | Eigen profiel met naam van alleen witruimte uit een bestand blokkeert Projectinfo | laag | `src/services/ifc/schedulingOptionsRead.ts:177-178`, `:228`; `src/components/settings/ProjectInfoPanelContent.tsx:218`, `:236` | `validName` accepteert `'   '`. `hasValidProfileName` is dan false en elke Projectinfo-wijziging, ook alleen metadata, wordt geweigerd tot de gebruiker het profiel hernoemt. Het naamveld staat wel in beeld met "verplicht". Alleen via een gemaakt of vreemd bestand. | `audit-o/probe-profiles.txt` P7 | zeker (sanitizer), afgeleid (UI-gevolg) |
| O-19 | Docblokken in de profieltypen die niet kloppen met de code | laag | `src/types/project.ts:69`; `src/engine/scheduler/conventions/registry.ts` (C6-bron in `types/project.ts`, ~r. 320) | `totalFloatMode`: "Default 'smallest'", terwijl afwezig de hybride formule is (`scheduleAnalysis.ts:321-327`). C6 citeert 99348 (G18294_01) voor de "remaining lag"-vloer; die pagina zegt daar niets over. De Professional-helptekst (SO-client) zegt het wel. | WebFetch-citaten §1.2/§1.3 | zeker |
| O-20 | MCP: profiel en opties alleen-lezen, schrijven expliciet geweigerd | info (geen probleem) | `src/services/mcp/tools/calendarResourceTools.ts:1810-1820`; `readTools.ts:238-252` | `planner_update_project` weigert `schedulingOptions`/`schedulingProfile`/`floatPaths`/`leveling` met een reden; `get_project_info` toont het opgeloste profiel. | code | afgeleid |
| O-21 | IFC-round-trip van `OPS_SchedulingProfile` + `OPS_SchedulingOptions` | info (geen probleem) | `schedulingOptionsRead.ts`, `ifcWriter.ts:432-436`, `ifcReader.ts:274-278` | Alle 11 opties op niet-standaardwaarden plus een eigen profiel (naam met `"`, `\`, `é`, `€`) komen byte-gelijk terug. Conventiesleutels in `schedulingOptions` worden gestript (ze hadden al geen effect: het profiel wint in `effectiveSchedulingOptions`). | `audit-o/probe-profiles.txt` P8 | zeker |
| O-22 | `suggestedProfileId` per formaat klopt met de regel | info | `xerReader.ts:1014` (p6), `mppReader.ts:1671` (msproject), `mspdiReader.ts:742`, `p6xmlReader.ts:798`, `csvReader.ts:520` (ops); `xerExportLoss.ts:66` | Zoals `.claude/rules/rekenprofielen.md` beschrijft. Of "deze etappe" nog de goede keuze is: zie E5-vraag V2. | grep | zeker |

Legacy-migratie (zoekpunt): de probes P6 in `audit-o/probe-profiles.txt` volgen `legacyOptionsToProfile` zoals
gedocumenteerd. Een leeg XER-blok zonder A-sleutels ⇒ P6 met A12, A13, A15, A16, A18 en A20 **uit**, als
afwijking. Dat is het bedoelde gedrag ("de solver rekende een ontbrekende vlag als uit",
`schedulingProfileMigration.ts:124-125`). Oude XER-IFC's bestaan volgens `:77-78` alleen in dev-builds. Er is geen
bevinding: of de oude lezer die sleutels altijd schreef, is met de huidige code niet te toetsen (onbekend).

## 3. `measure:profiles` en de restafwijkingen uit `docs/TODO.md`

**Officiële run** (1 van de 2 toegestaan; `audit-o/measure-profiles-run1.txt`):

| profiel | meting | exit | status |
|---|---|---|---|
| P6 | X12 productfidelity | 1 | ROOD: "manifestbestand ontbreekt in corpus" (41×), meting niet gestart |
| MS Project | mpp-fidelity | 1 | ROOD: "verwacht 213, kreeg 49" (`OPS_MPP_CRAWL=…/crawl-mpp`) |
| corpusloos | vangrails | 0 | GROEN: 8 entries, 221 inexacte cellen, 76 met grootte |

De tweede run is bewust niet gebruikt. Hij zou om dezelfde omgevingsreden rood blijven (O-1). De MSP-kant is
apart bevestigd met de losse batterij en de corpus-root: GROEN, 213 ongewijzigd (`audit-o/mpp-fidelity-root.txt`).

**Vervangende oracle-only meting** (`audit-o/oracles-variants.txt`): reproduceert de pin exact (O-2).
Zesassig op de 8 officiële bestanden: **76** = HarbourPointe 61 + Sample 12 + Hotel 3. Dat is gelijk aan
`docs/TODO.md:14`. Per cel: `audit-o/oracles-base-detail.tsv`.

**Herbeoordeling van de 76:**

| groep | cellen | wat het is (gemeten) | bron / verklaring | oordeel |
|---|---:|---|---|---|
| HarbourPointe 4408, opvolgers van verouderde uitvoer | 54 | 19 taken (EC1020…EC2420), vooral ls/lf/tf | *Afgeleid* uit `docs/superpowers/plans/2026-09-24-x12-harbourpointe-kalender.md` (tabel "Uitkomst"): acht taken hebben een duur die niet past bij P6's eigen ES→EF, en de oude duur staat niet in het bestand. Het manifest sluit de bron-taak EC1420 al uit. Niet opnieuw gemeten in deze audit. Een P6-bron voor "verouderd" bestaat niet; het is een inferentie uit het bestand zelf. | te verklaren (orakelartefact), bron = eigen meetonderzoek, geen Oracle |
| HarbourPointe EC2390/EC2400, eindmijlpalen op de geplande-beginvloer (07:00) | 7 | es/ef/tf/ff | Hetzelfde document, rij (3b): "onbekend, n = 1 bestand". Geen Oracle-tekst gevonden. | onbekend |
| Sample 771, SF-relatie met lag 0, één minuut | 12 | REPLBE01–03, RDARCH02: truth 08:01/15:59 tegen ons 08:00/16:00; tf 11998,99998 tegen 12000 | `docs/superpowers/plans/2026-09-24-x12-sample-sf-lag0.md`. Oracle *About Relationships*: "The successor activity cannot finish until its predecessor starts." Dat zegt niets over een minuutstap. n=1 in het hele corpus. | onbekend (geen bron voor de minuut) |
| Hotel 2666 ATWTPR000, ALAP-eindmijlpaal kal. 844 | 3 | ls/lf 17:00 tegen ons 16:00, tf 60 tegen 0 | n=1. De ALAP-tekst van Oracle (§1.2 C14) gaat over vroege datums, niet over de late kant van een eindmijlpaal. | onbekend |

Conclusie: van de 76 zijn er 54 te verklaren als orakelartefact (verouderde P6-uitvoer), maar alleen met
eigen meetonderzoek als bron, niet met Oracle-tekst. 22 blijven onbekend (n=1 per patroon). Er is niets gevonden
dat een regelwijziging rechtvaardigt: elke conventie-omzetting maakt het slechter (O-14), en E4 laat
gedragswijzigingen in deze sweep niet toe.

## 4. Open vragen voor de eigenaar (E5)

Eerst wat na onderzoek één logisch antwoord heeft en dus **beslist** is, niet gevraagd:

- **B-1 (O-5).** De twee "bronsignaal"-lijsten gelijktrekken: "Standaardopties" laat álle alleen-lezen opties
  staan (`useExpectedFinishDates`, `useProjectEndDateForFloat`, `p6CompletedLateFromRemainingWindow`, `leveling`).
  Reden: de UI verklaart ze zelf onbewerkbaar, en een knop die ze onherstelbaar omzet spreekt dat tegen. Geen
  celverschil op de orakels.
- **B-2 (O-3, O-19).** De docblokken rechtzetten: A17 wél effect (+118, OZB); `totalFloatMode` afwezig = hybride;
  voor C6 de Professional-helptekst citeren.
- **B-3 (O-13).** A12/A15/A16/A18 aan en A23 uit in P6 laten staan, en als "geen orakelbewijs" markeren. Er is
  geen bewijs in welke richting ook. Omzetten zou P6-bestanden stil van gedrag laten veranderen en valt onder E4.
- **B-4 (O-4).** De A19-achterdeur alleen laten gelden voor een bestand zonder `overrides`-veld in de pset (het oude
  formaat). Zo overleeft een nieuwe letterlijke A19 uit een wissel. Klein, en alleen de lezer.

Echte keuzes:

1. **V1 — Meetomgeving voor regel A (O-1).** Poort 3 (§4) is op de sweepclone niet uit te voeren.
   Opties: (a) de volledige lokale crawlmap (93 bestanden) beschikbaar maken voor de orkestrator; (b) de X12-check
   een expliciete modus "alleen orakels" geven: een ontbrekend niet-orakelbestand wordt gemeld, alleen een
   ontbrekend orakel is rood; (c) de oracle-only meting uit `audit-o/measure-oracles.ts` als tijdelijke vervanging
   gebruiken. **Advies:** (b). De orakelpopulatie is het enige wat regel A meet; (c) als brug zolang (b) er niet is.
   Daarnaast `OPS_MPP_CRAWL` in het draaiboek op de corpus-root zetten.
2. **V2 — `suggestedProfileId` voor MSPDI en P6-XML (O-22).** Nu: MSPDI ⇒ ops, P6-XML ⇒ ops.
   Bewijs: op 213 `.mpp` rekent het MSP-profiel 4 cellen beter dan OPS, en A22/A23 hangen niet aan bronvelden.
   Het corpus bevat geen MSP-doorgerekende MSPDI (`crawl-mspdi` ontbreekt in de clone). De 9 PMXML-samples zijn
   geen orakel en zijn niet gemeten: mijn harnas las er 0 taken uit, de oorzaak is niet onderzocht. De P6-XML-lezer
   leest geen SCHEDOPTIONS en zet de datagates niet (`p6xmlReader.ts:796-798`). Onder P6 zouden alleen de
   conventies zonder datagate aangaan, zoals A13, B2, C2, C9, C12 en C14. Opties: (a) zo laten; (b) MSPDI ⇒
   msproject, nadat MSPDI-orakels (door MS Project opgeslagen XML) gemeten zijn; (c) P6-XML ⇒ p6, pas nadat de lezer
   ScheduleOptions leest en er PMXML-orakels zijn. **Advies:** (b) zodra er MSPDI-orakels zijn; P6-XML voorlopig (a).
3. **V3 — Float-standaard van het MSP-profiel bij `.mpp` (O-9).** Opties: (a) de `.mpp`-lezer zet
   `defaultOptionsFor('msproject')`. Dat verandert de tf van gestarte taken in elke `.mpp` en valt onder E4, dus
   niet in deze sweep. (b) `smallest` uit de MSP-standaard halen, zodat wizard en import gelijk zijn. (c) Eerst de
   door MS Project opgeslagen Total Slack uit `.mpp` meten (het veld bestaat; de huidige scanner leest alleen
   Start/Finish). **Advies:** (c), daarna (a) als de meting het draagt. Microsoft-tekst: "the smaller value".
4. **V4 — `lagCalendar` bij een leeg XER-veld (O-11).** Oracle zegt dat de opvolgerkalender dan geldt; de lezer
   neemt de voorganger. Geen corpusbestand heeft een leeg veld. Opties: (a) de Oracle-tekst volgen (successor);
   (b) zo laten. **Advies:** (a), maar dat is een rekengedragswijziging voor zulke bestanden, dus volgens E4 pas na
   de sweep en met een terugvalmelding.
5. **V5 — Manifest: Hotel Project.xer (O-16).** Opties: (a) dezelfde uitsluiting van project 2665 toevoegen;
   (b) het bestand als duplicaat markeren of uitsluiten; (c) zo laten, want het telt nu niet mee. **Advies:** (a),
   zodat de twee labels van één schema niet uiteenlopen. Het manifest is eigenaarsterrein.
6. **V6 — Eigen → ingebouwd profiel en bestandsafwijkingen (O-7).** Opties: (a) zo laten ("kale basis") met een
   melding dat bestandsafwijkingen vervallen; (b) de afwijkingen die bij het maken van de kopie uit het bestand
   kwamen, bewaren en bij terugkeer weer toepassen. **Advies:** (a). Dat is minder state, en de melding lost het
   stille verlies op. Een smaakkeuze.

## 5. Gevolgen voor de gidsen (E8)

- `gids-rekenprofielen` (nl/en): als B-2/B-3 landen, moet de gids per conventie kunnen zeggen of er orakelbewijs
  is (A12/A15/A16/A18: "geen bewijs op door P6 doorgerekende bestanden"). Ook dat "Standaardopties" de
  bronopties uit het bestand niet aanraakt (na B-1).
- Import/export-gids: MSPDI-export en de speling van gestarte taken (O-10), zodra dat is opgelost.

## 6. Scripts en uitvoer in `audit-o/`

| bestand | wat |
|---|---|
| `measure-oracles.ts` → `oracles-variants.{txt,json}`, `oracles-variants-6as.txt`, `oracles-variants-8files.tsv`, `oracles-base.json`, `oracles-base-detail.tsv` | Oracle-only X12-meting (kopie van `solveImported`/`materializedBaselineProjects` uit de X12-check, manifestuitsluitingen via `readManifestExclusions`; het manifest alleen gelezen, subset in het geheugen) met 47 varianten |
| `measure-mpp.ts` → `mpp-variants.{txt,json}` | MSP-meting (meetlat van `mppFidelity.ts`) met 30 varianten over 213 `.mpp` |
| `probe-profiles.ts` → `probe-profiles.txt` | P1–P8: wissel-round-trip over IFC (324 paden), A19-achterdeur, eigen→ingebouwd, Standaardopties, migratie, sanitizer, IFC-round-trip van de opties |
| `fingerprint.ts` | schema-vingerafdruk van de twee Hotel-bestanden |
| `probe-pmxml.ts` → `probe-pmxml.txt` | poging tot PMXML-indicatie (0 taken gelezen; niet gebruikt als bewijs) |
| `measure-profiles-run1.txt`, `mpp-fidelity-root.txt` | officiële run en de MSP-batterij met root |

Bundelen: `node_modules/.bin/esbuild <script>.ts --bundle --platform=node --format=esm --alias:@=<werkmap>/src
--external:react-dom/server --define:import.meta.env.DEV=false --define:import.meta.env.PROD=true
--define:import.meta.env.MODE='"production"' --define:__OPS_DEV_INSTANCE__='"test"' --outfile=audit-o/tmp/<x>.mjs`,
daarna `AUDIT_ROOT=<werkmap> OPS_XER_CORPUS=/home/user/ops-xer-corpus AUDIT_OUT=… node audit-o/tmp/<x>.mjs`
(MSP: `OPS_MPP_CRAWL=/home/user/ops-xer-corpus`). `npm run verify:conventions`: OK (98 motorbestanden, datagates
ongewijzigd).
