# Spoor O — Rekenprofielen, kritisch: auditrapport

Basis: `main` @ `91da0168` (worktree `/home/user/audit/o1`). Datum 2026-09-28. Alleen lezen: geen wijziging aan bestaande
bestanden, geen commit, geen branch. Alle eigen scripts en uitvoer staan in `audit-o/` (index onderaan, §6).
Corpus: `/home/user/ops-xer-corpus` @ `ccc952c`, alleen gelezen. Het manifest is niet aangeraakt.

Leeswijzer voor de woorden:
- **Oordeel** per waarde: *juist* = door een orakelcel-meting (mijn ablatie, zie hieronder) of door letterlijke documentatie
  bevestigd; *twijfel* = dun (één bestand / enkele cellen), of twee bronnen spreken elkaar tegen; *onjuist* = een bron weerlegt de
  waarde (geen enkele waarde kreeg dit oordeel); *onbekend* = geen bron. Per §2.2 is een uitspraak over P6/MSP-gedrag zonder
  bron *onbekend*, ook als niets ertegen pleit.
- **Label** per bevinding/regel: *zeker* = door mij met script of test gereproduceerd, *afgeleid* = uit code/documentatie geredeneerd,
  *onbekend*.
- **Ablatie** (mijn eigen methode, `audit-o/variant/ablate.ts`, `ablate-mpp.ts`): de waarde van één conventie of optie wordt in het
  ingebouwde profiel omgekeerd en het corpus opnieuw doorgerekend; geteld wordt hoeveel cellen (bestand, project, taak, as) van
  exact naar inexact gaan ("+N") of omgekeerd. Populatie P6: de 8 gemeten orakelentries (zie §3) met de manifestuitsluitingen,
  6 assen + drivingPath. Populatie MSP: 213 `.mpp`-bestanden (3013 taken), start/einde. "0 cellen" betekent: het corpus kan die
  waarde niet onderscheiden van de tegenovergestelde. Bij een waarde met 0 cellen is de waarde dus niet fout, maar ook niet
  bewezen.

---

## 0. Samenvatting

- 27 conventies + 11 projectopties = 38 waarden per profiel. Oordelen (P6 / MSP; OPS is eigen ontwerp en telt niet mee):

  | oordeel | P6 (38) | MSP (38) |
  |---|---|---|
  | juist | 18 | 4 |
  | twijfel | 8 | 3 |
  | onjuist | 0 | 0 |
  | onbekend | 10 | 25 |
  | n.v.t. (concept bestaat niet in dat pakket) | 2 | 6 |

- 16 bevindingen: 0 kritiek, 2 hoog, 5 middel, 9 laag. Labels: 12 zeker, 3 afgeleid, 1 onbekend (§2).
- Profiel wisselen, IFC-round-trip van `OPS_SchedulingProfile`/`OPS_SchedulingOptions` en de migratie van oude optieblokken houden
  stand (P6 → OPS → P6 = origineel in 5000 van 5000 willekeurige ketens; IFC-round-trip 3000 van 3000, mét vijandige namen;
  migratie-uitkomsten kloppen met het docblok). Zie §2.2.
- `measure:profiles` is in deze omgeving rood door de omgeving, niet door de motor (§3). De equivalente meting op de
  orakelbestanden (variant in `audit-o/`) laat de gepinde stand zien: 221 inexacte cellen, 76 zesassige afwijkingen,
  CELLDELTA overal 0.
- De 76 restafwijkingen zijn op 17 na aantoonbaar verklaard (§3.3): 54 zijn een neerslag van verouderde P6-uitvoer (bewezen met
  een tegenfeit: HarbourPointe 61 → 7), 5 zijn afronding van P6 zelf in het bestand. De overige 17 (7 + 7 + 3) hebben n=1 en geen bron.

De drie belangrijkste bevindingen:
1. **O-01** `measure:profiles` kan het P6-deel op deze corpuskopie niet uitvoeren (41 niet-orakelbestanden ontbreken, de poort is
   fail-closed op het hele manifest); er is dus in cloudsessies geen regel-A-uitslag. Ook is `OPS_MPP_CRAWL` fout opgegeven (**O-02**).
2. **O-03** `readP6XML` leest 0 taken uit alle 9 echte P6-XML-exports in het corpus (`getAllByLocalName` kijkt alleen naar
   kinderen van de root; echte exports nesten `Activity` onder `Project`) — stil leeg project, spoor E. Daardoor is
   `suggestedProfileId = 'ops'` voor P6-XML niet te toetsen.
3. **O-04/O-05** Een onbruikbare of weggevallen `OPS_SchedulingProfile`-pset geeft stil OPS (uitkomst wijkt op de P6-orakels bij
   5104 cellen af), en het MSP-profiel is alleen op start/einde gemeten: voor voltooide taken wijkt opgeslagen speling/kritiek van
   MS Project af (51 van 68 voltooide taken, TF).

---

## 1. Tabel: 27 conventies en 11 projectopties

Bronnen: `orakel` = de meting in `audit-o/ablate.log` (P6, 8 XER-entries) of `audit-o/ablate-mpp.log` (MSP, 213 `.mpp`); een getal is het
aantal cellen dat inexact wordt als de waarde omgekeerd wordt. `doc:` = documentatie met letterlijk citaat in §5.
De in de code aangehaalde bronnen (docblokken in `src/types/project.ts`) staan in de kolom alleen als ik ze heb nagelopen.
OPS-kolom: overal "eigen ontwerp, geen externe bron van toepassing" (`legacyValue` = OPS-waarde, `registry.ts:86`).

### 1.1 Conventies (`registry.ts:97-130`)

| id (code) | P6 / MSP / OPS | bron per waarde | oordeel P6 / MSP | label |
|---|---|---|---|---|
| preserveActualDatesInBackwardPass (A12) | aan / uit / uit | P6: orakel 0 cellen; docblok noemt geen bron. MSP: orakel 0 | onbekend / onbekend | zeker (0 cellen) |
| clampNegativeFreeFloat (A13) | aan / uit / uit | P6: orakel +3 (OZB, ff; 1 bestand). Het docblok-getal "63 negatieve TF-cellen" (`scheduleAnalysis.ts:370`) hoort bij een oudere populatie en is door mij niet nagerekend. MSP: 0 | twijfel / onbekend | zeker |
| p6ZeroDurationUsesPlannedBoundary (A15) | aan / uit / uit | P6: orakel 0. MSP: 0 | onbekend / onbekend | zeker |
| p6UseTaskPlannedStartFloor (A16) | aan / uit / uit | P6: orakel 0 (de meetbare tegenhanger C8 heeft wel +79). MSP: orakel +11 start/+12 einde bij aan (2 bestanden, OzBuild Workshop 17) ⇒ uit ondersteund | onbekend / juist | zeker |
| p6FinishMilestoneBoundaryWindow (A17) | uit / uit / uit | P6: orakel +118 bij aan (OZB: ls 42, lf 42, tf 34) ⇒ uit ondersteund. MSP: 0 | juist / onbekend | zeker |
| p6PreserveActualInstants (A18) | aan / uit / uit | P6: orakel 0. MSP: 0 | onbekend / onbekend | zeker |
| p6UseRemainingStartForProgress (A19) | aan / uit / uit | P6: orakel +978 bij uit (HarbourPointe 77, Roads 821, OZB 80); de aangehaalde Oracle-bron (47223) ondersteunt de claim niet, zie O-12. MSP: orakel +55 start (31 bestanden) bij aan ⇒ uit ondersteund | juist / juist | zeker |
| p6PreserveZeroDurationConstraintInstants (A20) | aan / uit / uit | P6: orakel +2 (TERMINAL, ls/lf; 1 bestand). MSP: 0 | twijfel / onbekend | zeker |
| resumeFromActualElapsed (A22) | uit / aan / uit | P6: orakel +200 bij aan (HarbourPointe 152, OZB 48) ⇒ uit ondersteund. MSP: orakel +2 einde +1 sameday bij uit (3 bestanden: mpp14assignmentfields, timephased-end-cost-resource, timephased-material-resource). doc: Microsoft beschrijft het verplaatsen van restwerk naar de statusdatum als optie (zie O-10) | juist / twijfel | zeker |
| unstartedIgnoresStatusDate (A23) | uit / aan / uit | P6: orakel 0 (geen onderscheid). MSP: orakel +1 start bij uit (1 bestand: calendar-exception-precedence.mpp) | onbekend / twijfel | zeker |
| p6RelationFinishBoundary (B1) | aan / uit / uit | P6: orakel +3131 bij uit (alleen Hotel; es 942, ef 950, tf 926, ff 313). MSP: 0 | juist / onbekend | zeker |
| p6BackwardLagFinishBoundary (B2) | aan / uit / uit | P6: orakel +117 bij uit (Hotel 111, ashspace 4, Sample 2). MSP: 0 | juist / onbekend | zeker |
| p6CompletedDataDateWindow (B3) | uit / uit / uit | P6: orakel 0 (docblok: alleen P3-uitvoer). MSP: 0 | onbekend / onbekend | zeker |
| p6CompletedLoeActualFinish (B4) | uit / uit / uit | P6: orakel 0. MSP: 0 | onbekend / onbekend | zeker |
| p6OpenLoeTargetSpan (B5) | aan / uit / uit | P6: orakel +20 bij uit, uitsluitend in `ashspace-primeveraxereditor/sample.xer` (ef 10, lf 10), door het manifest zelf "twijfelachtig orakel" genoemd. MSP: 0 | twijfel / onbekend | zeker |
| p6CompletedPredecessorAtDataDate (C1) | uit / uit / uit | P6: orakel 0 (docblok: alleen P3, "geen Oracle-bron"). MSP: 0 | onbekend / onbekend | zeker |
| p6FreeFloatOnOwnCalendar (C2) | aan / uit / uit | P6: orakel +259 bij uit (Hotel 247, Roads 12). doc: Boyle 2018, "Relationship free float … computed according to the PREDECESSOR's calendar" (voor de taak zelf als voorganger = eigen kalender). MSP: 0 | juist / onbekend | zeker |
| p6CompletedRemainingLag (C3) | aan / uit / uit | P6: orakel +674 bij uit (HarbourPointe 158, Roads 516); geen documentatie. MSP: 0 | juist / onbekend | zeker |
| p6CompletedOutOfSequenceWindow (C4) | uit / uit / uit | P6: orakel 0 (docblok: alleen P3). MSP: 0 | onbekend / onbekend | zeker |
| p6CompletedPhysicalAtDataDate (C5) | aan / uit / uit | P6: orakel +833 bij uit (HarbourPointe 68, Roads 709, OZB 56). MSP: 0 (MS Project kent wel een Physical % Complete-veld maar het stuurt de planning niet aan; niet nagegaan, dus geen bron) | juist / onbekend | zeker |
| p6InProgressStartLagElapsed (C6) | aan / uit / uit | P6: orakel +201 bij uit (Roads); doc: Oracle 99348 "Early Start: Calculates the expired lag as the number of work periods between the actual start and the data date …". MSP: 0 | juist / onbekend | zeker |
| p6FinishFinishStartMilestoneLateFinish (C7) | aan / uit / uit | P6: orakel +228 bij uit (alleen Roads, 1 bestand maar 228 cellen); geen documentatie. MSP: 0 | juist / onbekend | zeker |
| p6StartedTaskIgnoresPlannedStartFloor (C8) | aan / uit / uit | P6: orakel +79 bij uit (Roads 21, OZB 58). MSP: 0 | juist / onbekend | zeker |
| p6LateFinishOnOwnCalendar (C9) | aan / uit / uit | P6: orakel +24 bij uit (alleen Hotel); geen documentatie. MSP: 0 | twijfel / onbekend | zeker |
| p6ProgressOverrideIgnoresStartedSuccessor (C11) | aan / uit / uit | P6: orakel +5 bij uit (alleen OZB, het enige Progress-Override-project); doc: Oracle 99348 "Progress Override: The schedule ignores network logic and allows the activity to progress without delay." MSP: 0 | twijfel / onbekend | zeker |
| p6FinishNotBeforeFinishFinishBound (C12) | aan / uit / uit | P6: orakel +9 bij uit (Hotel 4, Roads 5); doc: Oracle 6616 "Finish to Finish: The successor activity cannot finish until its predecessor finishes." MSP: 0 | juist / onbekend | zeker |
| p6AlapPositionedFromSuccessors (C14) | aan / uit / uit | P6: orakel +23 bij uit (alleen HarbourPointe; +9 verschoven); doc: Oracle "As late as possible constraint: … allows it to start as late as possible without delaying its successors." MSP: 0 (docblok: MSP plant ALAP vanaf de late datums, ongemeten) | twijfel / onbekend | zeker |

Telling: P6 juist 12, twijfel 6, onbekend 9. MSP juist 2, twijfel 2, onbekend 23.
Alle 27 conventies worden gelezen: `npm run verify:conventions` is groen (98 motorbestanden, elke conventie in een vanuit `solveProject.ts`
bereikbaar bestand gelezen). "Gelezen" is niet "heeft effect": A12, A15, A18, B3, B4, C1, C4 hebben in beide corpora geen
enkel meetbaar effect (wel in eigen fixtures, `check-conventions-p6-flags.ts`, 301 checks groen).

### 1.2 Projectopties (`types/project.ts`, standaarden in `registry.ts:236-270`)

De XER-lezer zet de opties per bestand uit `SCHEDOPTIONS`; de waarden hieronder zijn de standaarden voor een nieuw of bronloos
project (`defaultOptionsFor`), plus wat de lezers zaaien. Uit de 9 orakelbestanden zelf (SCHEDOPTIONS-rijen, eigen telling):
`sched_float_type=FT_FF` 9/9; `sched_calendar_on_relationship_lag=rcal_Predecessor` 8/9 (HarbourPointe: `rcal_Successor`);
`sched_open_critical_flag=N` 9/9; `sched_use_expect_end_flag=Y` 9/9; `sched_lag_early_start_flag=Y` 9/9;
`sched_use_project_end_date_for_float=Y` 8/9 (Sample: kolom ontbreekt); `enable_multiple_longest_path_calc=N` 7/9 (HarbourPointe Y, Sample: kolom ontbreekt); PROJECT
`critical_path_type=CT_TotFloat` 7/8 uniek (Roads: `CT_DrivPath`), `critical_drtn_hr_cnt=0`.

| id | P6 / MSP / OPS | bron per waarde | oordeel P6 / MSP | label |
|---|---|---|---|---|
| lagCalendar | predecessor / (afwezig ⇒ predecessor) / (afwezig ⇒ predecessor) | P6: bestanden 8/9 predecessor; orakel: `successor` afdwingen geeft +7321 (Hotel), dus de per-bestandswaarde wordt goed gelezen. Maar doc: Oracle P6 Professional Help (General tab) "If you do not select a calendar, Successor Activity Calendar is used to calculate lag." tegenover `p6OptionDefaults` = predecessor (`registry.ts:246`). MSP: doc (secundair): Boyle "Relationship lags are computed according to the Task Calendar of the successor task, if it has one, or the Project Calendar."; het MSP-profiel zet niets (`registry.ts:266`) ⇒ predecessor. Orakel: predecessor/successor/projectDefault op 213 `.mpp` allemaal 0 (alleen `24hour` geeft +5/+6) | twijfel / twijfel | onbekend (zie O-09) |
| criticalDefinition | totalFloat ≤ 0 (uren 0) / afwezig ⇒ totalFloat ≤ 0 / idem | P6: 7/8 bestanden `CT_TotFloat`, `critical_drtn_hr_cnt=0`; doc: Oracle 99348 "Define critical activities as … Total Float less than or equal to". MSP: doc: Microsoft "It has no slack (or float)."; MSPDI-lezer neemt `CriticalSlackLimit` over (`mspdiReader.ts:771-778`), de `.mpp`-lezer niet (§2 O-05 noot) | juist / juist | afgeleid |
| totalFloatMode | finish / smallest (alleen via wizard; import: afwezig ⇒ hybride) / afwezig ⇒ hybride | P6: 9/9 bestanden FT_FF; orakel 0 cellen (start/smallest geven hetzelfde); Oracle noemt drie methoden, geen default. MSP: doc: Microsoft "Total slack is calculated as the smaller value of the Late Finish minus the Early Finish field, and the Late Start minus the Early Start field."; `.mpp` orakel: afwezig en `smallest` geven hetzelfde (1015/1144 TF gelijk) | juist / juist | afgeleid |
| makeOpenEndedCritical | uit / afwezig (uit) / afwezig (uit) | P6: 9/9 bestanden N; orakel +111 bij aan. MSP: geen bron | juist / onbekend | zeker |
| useExpectedFinishDates | aan / afwezig / afwezig | P6: doc: Oracle Help "Use Expected Finish Dates … This option is checked by default." en 9/9 bestanden Y; orakel 0 bij uit (inert in dit corpus). MSP: concept bestaat niet | juist / n.v.t. | afgeleid |
| useProjectEndDateForFloat | (afwezig ⇒ uit) / afwezig / afwezig | P6: bestanden 8/9 Y, orakel +195 bij uit (TERMINAL) — de lezer neemt het per bestand, maar de standaard "uit" voor een nieuw P6-project is niet onderbouwd (`p6OptionDefaults` heeft de sleutel niet). MSP: concept bestaat niet | twijfel / n.v.t. | zeker |
| nearCriticalThreshold | afwezig / afwezig / afwezig | Geen P6/MSP-concept als projectoptie (OPS-uitbreiding); orakel 0 | n.v.t. / n.v.t. | afgeleid |
| floatPaths | afwezig (uit) / afwezig / afwezig | P6: bestanden `enable_multiple_longest_path_calc=N` 7/9 (HarbourPointe Y, Sample zonder kolom); orakel 0. MSP: doc: Microsoft "you can set up your project plan to see multiple critical paths for each independent network …", default niet vermeld | juist / onbekend | afgeleid |
| p6CompletedLateFromRemainingWindow | aan / afwezig / afwezig | P6: lezer zet aan; orakel 0 (inert omdat B3 in alle ingebouwde profielen uit staat); geen documentatie. MSP: n.v.t. | onbekend / n.v.t. | zeker |
| startToStartLagFrom | earlyStart / afwezig ⇒ earlyStart / idem | P6: 9/9 bestanden `sched_lag_early_start_flag=Y`; orakel +28 bij actualStart (Roads); doc: Oracle 99348 "Early Start: … determines the successor's start date as the predecessor's remaining early start plus any remaining lag." (default niet vermeld). MSP: concept bestaat niet | juist / n.v.t. | zeker |
| leveling | afwezig (XER: data) / afwezig / afwezig | Alleen data; motor leest het niet (docblok en `rekenprofielen.md`); niet toetsbaar | n.v.t. / n.v.t. | afgeleid |

Telling: P6 juist 6, twijfel 2, onbekend 1, n.v.t. 2. MSP juist 2, twijfel 1, onbekend 2, n.v.t. 6.

---

## 2. Bevindingen

### 2.1 Tabel

| nr | titel | ernst | pad:regel | mechanisme | reproductie | label |
|---|---|---|---|---|---|---|
| O-01 | `measure:profiles` (P6-deel) onuitvoerbaar op deze corpuskopie | hoog | `tests/planning/xerFidelity.ts:338-340`, `tests/planning/check-xer-product-fidelity-x12.ts:423-424`, `scripts/measure-profiles-status.mjs` | De poort zet elk manifestbestand dat niet in het corpus staat als fout (41 niet-orakelbestanden: engine-input 14, reader-only 19, parser-fixture 7, synthetic 1; uit ProjectLens, cpp-cpm-engine, delay-analysis-toolkit, mpxj/junit-`.xer`, p6flow). Alle 9 orakels bestaan wel. De run stopt met een throw, geen meting. De uitslagtabel toont alleen "ROOD (cel-poort niet groen of cel-delta ontbreekt)" en "?"; de oorzaak staat alleen in het kindlog. Antwoord op draaiboek §5.4: het stopt, het meet niet stil minder. | `OPS_XER_CORPUS=/home/user/ops-xer-corpus npm run measure:profiles` → `audit-o/measure1.log`, `measure2.log`; kindlog met de throw: `audit-o/measure1.log` verwijst naar `audit-o/tmp/ops-measure-profiles-*/p6-x12.log` | zeker |
| O-02 | `OPS_MPP_CRAWL` moet de corpuswortel zijn, niet `crawl-mpp` | middel | `tests/planning/mpp-fidelity-baseline.json` (labels wortel-relatief), `CORPUS-OVERZICHT.md` ("`OPS_MPP_CRAWL=<checkout van deze repo>`") | Met `…/crawl-mpp` scant de check 49 van de 213 gepinde bestanden: "aantal gepinde bestanden dat daadwerkelijk gezien is: verwacht 213, kreeg 49" ⇒ vals rood. Met de wortel: GROEN, 658 gescand, 445 overgeslagen (MPP_LEGACY/ENCRYPTED), 213 ongewijzigd, 2173 checks. De opdracht en het draaiboek (§5.4, §2.3) noemen de verkeerde map. | `audit-o/measure1.log` (crawl-mpp: rood) tegenover `audit-o/measure2.log` en `audit-o/mpp-fid-root.log` (wortel: groen) | zeker |
| O-03 | `readP6XML` leest 0 taken uit alle 9 echte P6-XML-exports | hoog (spoor E) | `src/services/p6/p6xmlReader.ts:192-202` (`getAllByLocalName` alleen kinderen van de root), `:378` | Echte P6-exports (bv. `EC00850_V2.xml`, V18.8) nesten `WBS`, `Activity`, `Relationship` binnen `<Project>`; OPS' eigen writer schrijft ze plat naast `<Project>` (`p6xmlWriter.ts:301,427,444`). De lezer accepteert alleen het eigen platte dialect en geeft bij de echte vorm een normaal ImportResult zonder taken, geen fout, geen melding. Het formaat wordt wel herkend (`formatRegistry.ts:86`). | `audit-o/pmxml-node.log` (Node-shim) en `audit-o/pmxml-chromium.log` (echte Chromium `DOMParser`, `audit-o/variant/pmxml-browser.mjs`): 9 van 9 bestanden `tasks: 0` terwijl er 1–120 `<Activity>` in staan | zeker |
| O-04 | Onbruikbare of ontbrekende `OPS_SchedulingProfile`-pset ⇒ stil OPS (en `conventions` ontbreekt ⇒ alles uit) | middel | `src/services/ifc/ifcReader.ts:3239-3258`, `src/services/ifc/schedulingOptionsRead.ts:217-242,287-292` | Een P6-profiel-IFC waarvan de pset afgekapt, geen object, > 64 KB of door een ander pakket weggegooid is, opent als OPS terwijl de projectopties (P6-lagkalender, floatmodus) wel blijven staan. Geen melding: `readIFC` levert geen kanaal daarvoor. Een `conventions`-object dat ontbreekt of leeg is geeft bij `baseId p6` een P6-profiel met 20 overrides ⇒ A19 en A13 uit (alles `legacyValue` = uit). Effect: op de P6-orakels rekent OPS 5104 cellen anders (ablatie `profile:ops`). Alleen bij een beschadigd of door derden bewerkt bestand. | `audit-o/probes2.log` (S3b, S3c, S3f, S3h: "geen profiel ⇒ ops"; S3e/S3g: A19=false A13=false); effectgrootte `audit-o/ablate.log` regel `profile:ops` | zeker |
| O-05 | MSP-profiel alleen op start/einde gemeten; opgeslagen speling en kritiek van MS Project wijken af voor voltooide taken | middel | `src/engine/scheduler/scheduleAnalysis.ts:283,385-391`, `src/services/mpp/mppReader.ts:126,926,988` (geen `criticalDefinition` uit de `.mpp`-limiet), `tests/planning/check-mpp-fidelity.ts` (twee assen) | (a) Totale speling van voltooide taken: MS Project slaat 0 op; de solver geeft de getekende waarde (bv. +6, −5). Van 68 voltooide leaf-taken met opgeslagen TF matchen er 17; gestart-niet-voltooid 46/59; niet gestart 952/1017. (b) `completed = !!dataDate && …` (`scheduleAnalysis.ts:283`): zonder statusdatum is een 100%-taak wel kritiek (17 taken in 213 bestanden, opgeslagen `isCritical=false`); alle 17 hebben `statusDate` leeg en TF 0. (c) 103 van de 120 kritiek-afwijkingen zijn handmatig geplande taken (MS: TF 5–11 dagen, solver 0). (d) De `.mpp`-lezer leest de kritiekgrens (`criticalSlackLimitDaysOf`) alleen voor de opgeslagen vlag; MSPDI zet hem wel in `criticalDefinition.threshold` — na herberekening geldt bij `.mpp` altijd 0. De start/einde-poort ziet hierdoor niets. | `audit-o/mpptf.log`, `audit-o/mppcrit.log` (scripts `audit-o/variant/mpptf.ts`, `mppcrit.ts`) | zeker (a–c); (d) afgeleid uit code |
| O-06 | De drivingPath-as meet een andere definitie dan het profiel rekent: 110 van 145 cellen zijn meetartefact | middel (meetlat, spoor A/T/O) | `tests/planning/check-xer-product-fidelity-x12.ts` (`drivingPath: task.time.isCritical`), `tests/planning/xer-product-fidelity-cells.json` | De orakelvlag `driving_path_flag` is het langste pad, ook wanneer het project zelf `CT_TotFloat` declareert (7 van 8 bestanden). De meting vergelijkt hem met `isCritical` onder de bestandsdefinitie (tf ≤ 0). Met `criticalDefinition = longestPath` vallen Hotel 69 → 0, TERMINAL 35 → 0, OZB 24 → 18 weg (145 → 35), 0 cellen verslechterd; het restant is ashspace 10 (LOE), HarbourPointe 7, OZB 18. Roads (`CT_DrivPath`) heeft al 0. De ratchet bewaakt dus een definitieverschil. | `audit-o/ablate-dp.log` (`ABL_DP=1 ABL_ONLY=criticalDefinition=longestPath`) | zeker (telling); oorzaak afgeleid |
| O-07 | Vier P6-conventies staan aan zonder één orakelcel; vijf hebben n=1 | laag | `registry.ts:97-130`, docblokken `types/project.ts` | A12, A15, A16, A18: omkeren verandert 0 cellen in de 8 gemeten entries. Docblokken zeggen "empirisch"/"P6-doorgerekende bestanden"; dat bewijs zit niet (meer) in de gemeten populatie (het kan in uitgesloten of niet-orakelbestanden hebben gezeten). n=1: A20 (TERMINAL, 2 cellen), C11 (OZB, 5), C9 (Hotel, 24), C14 (HarbourPointe, 23), B5 (alleen ashspace, 20; twijfelachtig orakel). Regel A kan deze waarden per constructie niet bewaken. | `audit-o/ablate.log` | zeker |
| O-08 | Vijf P6-uit-waarden en één MSP-aan-waarde onbewezen | laag | `registry.ts:111,112,118,121` (B3, B4, C1, C4), `:108` (A23) | B3, B4, C1, C4 en A23 hebben in het P6-corpus 0 cellen in beide richtingen; de "uit"-keuze rust op rehab-2 (P3) of op afwezigheid. MSP-A22/A23: 3 resp. 1 `.mpp`-bestand. | `audit-o/ablate.log`, `audit-o/ablate-mpp.log` | zeker |
| O-09 | Standaard-lagkalender: P6 en MSP botsen met de bronnen | middel | `registry.ts:246` (P6), `:261-270` (MSP), `mppReader.ts:988` | P6-profiel: `predecessor`; Oracle P6 Professional Help: "If you do not select a calendar, Successor Activity Calendar is used"; corpus: 8/9 gekozen predecessor, 1 successor. MSP-profiel zet niets (⇒ predecessor); Boyle (secundair, geen Microsoft-tekst) zegt de successor-taakkalender. Het `.mpp`-corpus onderscheidt predecessor en successor niet (0 cellen). Geen primaire MS-bron gevonden. Geldt alleen voor bronloze projecten (XER: per bestand). | zie §1.2; `audit-o/ablate.log`, `ablate-mpp.log` | onbekend |
| O-10 | MSP-voortgangsconventies negeren de MS-projectopties uit het bestand | laag | `src/services/mpp/mppReader.ts:975-990`, `src/services/msproject/mspdiReader.ts` (geen `MoveRemainingStartsForward` e.d.); grep in `src/` levert 0 treffers | Microsoft kent vier statusdatum-opties per project (twee standaard aan). A22/A23 modelleren één gedrag, gemeten op bestanden met de instellingen van de OzBuild- en MPXJ-testbestanden. Een bestand met andere instellingen rekent daarmee mogelijk anders; niet gemeten. | grep; doc-citaten §5 | afgeleid |
| O-11 | Profielwissel past de standaardopties alleen in de wizard toe; MSP-standaard `totalFloatMode` verschilt tussen wizard en import | laag | `src/components/settings/SchedulingProfileSection.tsx:129-134`, `src/state/schedulingProfileDraft.ts:181-189`, `registry.ts:266` | Wizard: `withDefaultOptions` (P6: 7 opties; MSP: `smallest`). Projectinfo (edit): alleen het profiel wisselt, de opties blijven. Een `.mpp`-import zet geen `totalFloatMode` (⇒ hybride formule `scheduleAnalysis.ts:322-335`), de wizard wel `smallest`. Beide geven op het `.mpp`-corpus dezelfde TF (1015/1144). Geen datumeffect, wel float/kritiek. | code | zeker |
| O-12 | Bronverwijzing bij A19 ondersteunt de claim niet | laag | `src/types/project.ts:106-108` | "P6 plant een lopende activiteit op haar restduur (Oracle P6 Help, Durations Columns, …/47223.htm)": de pagina definieert Remaining Duration ("The total working time from the activity remaining start date to the remaining finish date …") maar zegt niets over hoe de scheduler dit gebruikt. Bewijs voor A19 is empirisch (978 cellen), niet de URL. | WebFetch, citaat in §5 | zeker |
| O-13 | Extensie-API: `publicSchedulingOptions` laat 5 van 11 opties weg en valideert waarden niet | laag | `src/extensions/extMappers.ts:57-66`, `src/extensions/extTypes.ts:62-70` | De whitelist bevat 6 sleutels; `startToStartLagFrom`, `useExpectedFinishDates`, `useProjectEndDateForFloat`, `p6CompletedLateFromRemainingWindow` en `leveling` zijn voor een extensie onzichtbaar en niet zetbaar. Waarden worden niet gecontroleerd (anders dan `sanitizeSchedulingOptions` voor IFC): `criticalDefinition {mode:'bogus'}` wordt overgenomen en maakt dan alle taken niet-kritiek; `nearCriticalThreshold:'abc'`, `lagCalendar:'bogus'` gaan het project in; geneste sleutels worden gespreid (`thresholdHours` glipt door). IFC-opslag daarna filtert alles wat de sanitizer niet kent, dus na heropenen rekent het bestand anders. Extensies zijn geen beveiligingsgrens (K6). | `audit-o/extopt.log` | zeker |
| O-14 | Typegat en scanbereik van de conventiepoort | laag | `src/engine/scheduler/scheduleAnalysis.ts:36`, `p6CompletedTargetWindow.ts:69,115,125,179,194`, `p6CompletedRouteTrace.ts:79,156,174,209`, `p6OpenLoeTargetSpanTrace.ts:53`; `scripts/verify-conventions.mjs:82` | Deze exports nemen `SchedulingOptions \| undefined` en lezen met `?.`; een aanroeper met kale `project.schedulingOptions` compileert, terwijl `CPMOptions.schedulingOptions` wél `EffectiveSchedulingOptions` eist. `verify:conventions` scant alleen `src/engine/` en `src/utils/p6SuspendResume.ts`; wat buiten de motor opties leest of aan de solver geeft (`src/services`, `src/state`) valt buiten de poort. Ik vond nu géén omweg: alle solve-plekken (`scheduleSlice.ts:133,238`, `documentActivation.ts:238`, `documentSlice.ts:756`, `projectSlice.ts:385`, `occupancy.ts:78,151`, `benchmark/runner.ts:155`, `ResourceLeveler.ts` via `cpmOptions`) gaan via `solveInputFor`/`solveOptionsFor`. | grep + lezing | afgeleid |
| O-15 | Motivatie "P6-XML opent als OPS" is verouderd | laag | `src/services/p6/p6xmlReader.ts:796-798`, spec `2026-09-22-rekenprofielen-design.md` §6 | "onder het P6-profiel gaan A12/A13/A16/A17/A20/B2 aan zonder orakel". Nu: A17 staat uit in P6; A13, A20 en B2 hebben orakelcellen (3, 2, 117); A12 en A16 hebben er 0 — precies zoals voor XER, waar het P6-profiel ze wel krijgt. Het argument onderscheidt XER en P6-XML dus niet meer. Bovendien is P6-XML wegens O-03 niet te meten. | ablatie-tabel §1.1 | zeker |
| O-16 | Opslaan van een eigen profiel als sjabloon mislukt stil | laag | `src/components/settings/SchedulingProfileSection.tsx` (`saveTemplate`), `src/services/schedulingProfiles/profileStore.ts:106-116` | `upsertCustomProfile` geeft `false` bij vol (100 profielen), quota of ongeldig; de UI negeert dat (`if (upsert…) setTemplates(…)`), geen melding, terwijl de invarianten voor meldingen één kanaal eisen. Verwijderen van een sjabloon werkt bewust niet door naar projecten (projectkopie); dat is ontwerp. | code | afgeleid |

### 2.2 Onderzocht, geen fout gevonden

- **P6 → OPS → P6**: 5000 willekeurige startprofielen (ingebouwd id, willekeurige letterlijke overrides) met 1–5 wissels en terug naar de eigen basis: 5000/5000 gelijk aan het origineel (`audit-o/probes1.log`, S1). Semantiek is de bedoelde: overrides blijven letterlijk staan; "P6 {C1 aan} → OPS" geeft "OPS (aangepast)" met C1 aan (ontwerp, `switchProfile`-docblok). Van een eigen profiel naar een ingebouwde basis vervalt bewust elke afwijking.
- **IFC-round-trip** `writeIFC → readIFC` van profiel én alle 11 opties, 3000 willekeurige combinaties met eigen profielnamen met `'`, `\`, Unicode, emoji, regeleinden, NUL, 200 tekens: 3000/3000 gelijk. Uitzondering die ik bewust buiten de telling hield: een ingebouwd `p6`-profiel met de letterlijke override `p6UseRemainingStartForProgress: true` verliest die override bij lezen (58 van 3000 gevallen). Dat is de gedocumenteerde "A19-achterdeur" (`schedulingOptionsRead.ts:234-239`); de state kan zo'n profiel in de app niet meer vormen (bewerken maakt een eigen kopie, de lezers zetten het niet), dus laag/geen effect.
- **Migratie oude optieblokken** (`legacyOptionsToProfile`): 12 gevallen doorgerekend (`audit-o/probes2.log`, S4): blok afwezig ⇒ ops; `p6Source:'XER'` ⇒ p6 met alleen de A-vlaggen die ontbraken als afwijking (A12, A13, A15, A16, A18, A20 uit), A19 en B1–B5 en C-set op P6-waarde; A22+A23 ⇒ msproject; A16/A15 zonder `p6Source` weggegooid; afwezig of `p6Source` ≠ XER ⇒ ops. Alles zoals het docblok (`schedulingProfileMigration.ts:120-134`) zegt.
- **MCP**: `planner_get_project_info` toont profiel, letterlijke overrides, opgeloste conventies en de opties (`readTools.ts:225-262`); `update_project` weigert `schedulingOptions`, `schedulingProfile`, `leveling`, `floatPaths` expliciet met reden (`calendarResourceTools.ts:1809-1830`). Geen omweg gevonden. (`progressMode`, `statusDate` en `defaultWorkRule` zijn wel schrijfbaar, ook al verschuiven ze datums even goed als een profielwissel; inconsistent met de gegeven reden, maar geen fout.)
- **Extensie-API** `ExtProject.schedulingProfile`: alleen-lezen, opgeloste conventies als kopie (`extMappers.ts:177-182`); `fromExtProject` neemt het nooit over. Een extensie-import krijgt altijd OPS (`ExtImportResult` heeft geen `suggestedProfileId`). Opmerking O-13 blijft.
- **Sjablonen (app-globaal) tegen projectkopie**: sanitizer valideert bij lezen en schrijven, dubbele id's en corrupte JSON vallen weg zonder crash, project draagt eigen kopie (`copyProfile`), matching op id. Geen fout, behalve O-16.
- **Alle solve-routes gebruiken `solveOptionsFor`/`solveInputFor`** (lijst bij O-14); ook de bezettingsoverzicht-solve van slapende documenten rekent met het profiel van dat document. `failedSolveGate` neemt profiel en opties op in de invoer.
- **`suggestedProfileId` per formaat** (antwoord op de vraag "klopt dat nog?"):

  | formaat | huidig | toets | oordeel |
  |---|---|---|---|
  | XER | p6 | 8 orakelentries, regel A groen | klopt |
  | `.mpp` | msproject | 213 bestanden 0 afwijkingen start/einde; onderscheid met OPS in 4 bestanden (A22/A23); opgeslagen speling niet gemeten (O-05) | klopt voor start/einde |
  | MSPDI | ops | geen MSPDI-corpus in deze kopie; `crawl-mspdi` (14) en MPXJ-XML zijn niet meegekopieerd; spec noemt "geen orakel" als reden | niet te toetsen (open vraag 4) |
  | P6-XML | ops | reden verouderd (O-15); lezer leest echte exports niet (O-03) | niet te toetsen |
  | CSV | ops | geen bronpakket dat rekent | klopt |

---

## 3. Uitslag van `measure:profiles` en herbeoordeling van de restafwijkingen

### 3.1 De runs (2 van 2 gebruikt)

| run | commando (env) | P6 | MSP | vangrails | logs |
|---|---|---|---|---|---|
| 1 | `OPS_MPP_CRAWL=…/crawl-mpp` (zoals opgegeven) | ROOD: throw op 41 ontbrekende niet-orakelbestanden | ROOD: 49 van 213 gescand (vals) | GROEN (8 entries, 221 inexacte cellen, 76 met grootte) | `audit-o/measure1.log` |
| 2 | `OPS_MPP_CRAWL=/home/user/ops-xer-corpus` | ROOD (idem) | GROEN: 658 gescand, 213 gepind ongewijzigd, 2173 checks, GOAL_ZERO-rood 0 | GROEN | `audit-o/measure2.log` |

Exit 1 in beide runs; de uitslag is dus wel rood, maar om O-01 (P6) resp. O-02 (MSP, run 1), niet om een regel-A-schending.

### 3.2 Equivalente P6-meting (variant, alleen in `audit-o/`)

`audit-o/variant/check-x12-variant.ts` is een kopie van de bestaande X12-check met één wijziging: manifestbestanden die in het
corpus ontbreken worden genegeerd (alleen de melding "41 niet-aanwezige manifestbestanden genegeerd" blijft), verder identiek. De
gepinde v2-baseline, de celbaseline, de uitsluitingen en de nuldoelregels lopen mee. Uitslag (`audit-o/x12-gate.log`,
`audit-o/x12-detail.log`):

- `CELLDELTA p6 nieuw=0 verslechterd=0 groter=0 verbeterd=0 kleiner=0 onmeetbaar=0 onbekend=0 ongemeten=0 schuld=0 totaal=221`
- "X12 cel-baseline (regel A): geen nieuwe, verslechterde of grotere cel over 8 bestanden; inexact per as drivingPath=145 ef=7 es=7 ff=9 lf=16 ls=16 tf=21"
- 76 zesassige afwijkingen, 0 identiteitsfouten, 0 scannerfouten; ratchet-schuld 0. De drie nuldoelregels zijn rood zolang 76 ≠ 0 (verwacht).
- **Gevolg voor #241**: het PR-bericht meldt dat de ALAP-ketenfix (`d82c95ab`) en de dag→uur-lagfix (`b8db26aa`) "niet gemeten" zijn
  tegen het corpus. Nu wel: op `main` staat elke gepinde cel ongewijzigd (0 nieuw, 0 verbeterd, 0 kleiner). Beide fixes hebben de P6-orakelcellen
  dus niet aangeraakt. Voor MSP: `.mpp`-poort groen, 213 bestanden ongewijzigd.
- 9 orakelbestanden geven 8 gemeten entries: `P6-Viewer/XER Files/Hotel Project.xer` wordt bij de selectie als schemaduplicaat van
  `crawl-xer/Hotel_Construction_TEC.xer` weggelaten (`xerFidelity.ts:414-419`, afgeleid uit de code en uit ontbreken in
  `x12-detail.log`). E4 voegde dus effectief één meetbaar orakel toe (TERMINAL BUILDING-AIRPORT).

### 3.3 De 76 restafwijkingen (`docs/TODO.md` regel 14–17)

| groep | cellen | verklaring | bron / bewijs | label |
|---|---|---|---|---|
| HarbourPointe, opvolgers van 8 taken met verouderde P6-uitvoer | 54 | Bij EC1430, EC1590, EC1680, EC2060, EC2170, EC2200, EC2380, EC2410 is P6's eigen ES→EF-spanne korter dan de opgeslagen restduur. Onafhankelijk nagerekend: zelfs zonder feestdagen (bovengrens) is de spanne < of = restduur (712 < 720, 720 = 720, 848 < 864, 496 < 552, 2016 < 2208, 1992 < 2184, 736 < 920, 96 < 144 uur); `reend_date` past bij de nieuwe duur, `early_end_date` bij de oude. **Tegenfeit**: de restduur van die 8 taken op P6's eigen spanne zetten (696/96/1968/1944/720/696/840/480 u, waarden uit `2026-09-24-x12-harbourpointe-kalender.md`, hier tegen de bovengrens getoetst) verlaagt HarbourPointe van 61 naar 7 cellen, 19 taken worden exact, 0 nieuwe afwijking. | `audit-o/hpcf.log`, `audit-o/variant/hpcf.ts`; XER-velden `remain_drtn_hr_cnt`, `early_*`, `reend_date` | zeker |
| HarbourPointe, eindmijlpalen EC2400 (es, ef, tf) en EC2390 (es, ef, tf, ff) | 7 | Geplande-beginvloer van 2013-04-29 07:00 tegenover P6 2013-04-26 16:49; n=1 bestand, geen documentatie, blijft na het tegenfeit als enige over. | `audit-o/hpcf.log` ("resterend: EC2400:3 EC2390:4"); doc `2026-09-24-x12-harbourpointe-kalender.md` | zeker (bestaan), onbekend (regel) |
| Sample_Construction: 5 cellen afronding | 5 | P6 slaat uren met 6 decimalen op (`total_float_hr_cnt` 199.983333 u = 11998.99998 min); de motor geeft 12000 min. Meetlatartefact van 0,00002 min. | XER-waarde `199.983333` (REPLBE01/03, RDARCH02); een tolerantiebesluit stond als `claude/x12-tolerantie-vraag9` klaar en is niet gemerged | zeker |
| Sample_Construction: SF-relatie met lag 0, één minuut | 7 | P6 zet EF één minuut na de start van de SF-voorganger (08:01) en LS één minuut ervoor (15:59). Bron ontbreekt: Oracle 6616 zegt alleen "Start to Finish: The successor activity cannot finish until its predecessor starts." n=1 bepalende SF-relatie in het hele corpus (10 SF-relaties, 1 bepalend). Motorproef in het onderzoeksdocument haalt 6 van 12 weg. | XER `REPLBE03 es 2010-04-15 08:01`, `RDARCH02 ef 08:01`; doc `2026-09-24-x12-sample-sf-lag0.md` (niet opnieuw uitgevoerd) | zeker (bestaan), onbekend (regel) |
| Hotel ATWTPR000 (ls, lf sameday 60 min; tf 60) | 3 | Eind-mijlpaal met `CS_ALAP` zonder opvolgers: P6 early 16:00, late 17:00, tf 1 u; wij ls/lf 16:00, tf 0. n=1, geen bron. Staat niet in de TODO-regel (die noemt alleen HarbourPointe en Sample; 61 + 12 = 73 ≠ 76). | XER-rij (`cstr_type CS_ALAP`, `TT_FinMile`, `total_float_hr_cnt 1`) | zeker (bestaan), onbekend (regel) |
| **totaal** | 76 | 54 + 7 + 5 + 7 + 3 = 76 | `audit-o/x12-detail.log`: HarbourPointe 61 (es 5, ef 5, ls 14, lf 14, tf 17, ff 6), Hotel 3, Sample 12 | |

Verklaarbaar met bron: 59 (54 verouderde uitvoer + 5 afronding). Niet verklaarbaar: 17 (7 + 7 + 3), alle n=1 en zonder bron.
De 145 drivingPath-cellen staan buiten deze 76 (aparte ratchet-as); 110 daarvan zijn een definitieverschil (O-06).
De 42 taken die het manifest uitsluit (OZB 9033: 14, HarbourPointe: 9 taken waarvan 8 verouderd, Hotel CR: 19) tellen niet mee;
hun eigenaarsbesluiten zijn onaangeroerd.

---

## 4. Open vragen voor de eigenaar (E5)

Elke vraag is na onderzoek een echte keuze; de onderzoeksstappen staan hierboven.

1. **Mag de X12-poort een corpus zonder de 41 niet-orakelbestanden accepteren?** (O-01) Zonder dit blijft er in elke cloudsessie geen regel-A-uitslag.
   - Opties: (a) `buildXerTargetBaseline` behandelt een ontbrekend niet-orakelbestand als INFO, een ontbrekend orakelbestand blijft fout; (b) het corpus in de cloud aanvullen tot alle 93 bestanden; (c) laten zoals het is en de meting alleen lokaal draaien.
   - Advies: (a), met een regel "N niet-orakelbestanden ontbreken". Het manifest blijft ongemoeid; de poort blijft fail-closed voor wat regel A werkelijk nodig heeft (de orakels). (b) kan er naast, maar drie van de vijf herkomst-repo's zijn niet bevestigd beschikbaar.
2. **De drivingPath-as met het langste pad laten meten?** (O-06) 110 van 145 cellen verdwijnen zonder één verslechtering; de gepinde ratchet zou dalen (verbeterd, geen verruiming).
   - Opties: (a) as vergelijken met `criticalDefinition = longestPath` ongeacht de bestandsdefinitie, cellenbaseline herpinnen; (b) laten; (c) een extra as ernaast.
   - Advies: (a), als afzonderlijke meetlat-wijziging met herpin (`scripts/README.md`), niet stilzwijgend. Het spec §9 heeft dit als "buiten scope" gemarkeerd; dat besluit is dus aan u.
3. **Wat te doen met conventies die aan staan zonder meetbaar effect** (A12, A15, A16, A18; n=1: A20, C9, C11, C14, B5)? (O-07)
   - Opties: (a) laten staan en in de UI/gids als "ongemeten" markeren; (b) in P6 uitzetten (0 cellen verandert, regel A kan het niet tegenhouden, maar het is gedragsverandering voor P6-gebruikers; E4); (c) eerst bewijs zoeken (P6-runs).
   - Advies: (a) nu, en (c) op de lijst "P6-runs nodig". Niet (b) in deze sweep.
4. **MSPDI ⇒ msproject en P6-XML ⇒ p6?** (§2.2, O-03, O-15) Voor MSPDI: ja/nee kan pas na een meting op MSPDI-bestanden die MS Project zelf schreef; het verschil met OPS is alleen A22/A23 (+ float). Voor P6-XML moet eerst de lezer (spoor E) echte exports leren lezen.
   - Opties: (a) ops laten tot er een MSPDI-/PMXML-corpus is; (b) MSPDI nu naar msproject zetten (verandert elk MSPDI-bestand met voortgang; de spec zegt dat expliciet).
   - Advies: (a); vraag om `crawl-mspdi` (14) en `crawl-pmxml` in de cloudkopie van het corpus, dan meet ik het verschil.
5. **P6-lagkalender-standaard en MSP-lagkalender** (O-09). Twee bronnen spreken elkaar tegen (Oracle-tekst: successor; corpus: 8/9 predecessor) en voor MS Project is er alleen een secundaire bron (successor-taakkalender).
   - Opties: (a) laten; (b) P6-standaard op `successor` (tekst) of laten op `predecessor` (praktijk); (c) MSP expliciet `successor` zetten.
   - Advies: (a) tot er een echte P6- en MS Project-run is. Concreet: één klein MS Project-bestand met twee taakkalenders en een FS-lag van enkele dagen, en dezelfde opzet in P6 met beide instellingen; dat beslist alle drie de vragen. Een wijziging zonder dat landt niet (E4).
6. **MSP-meetlat uitbreiden naar speling en kritiek, en dan de voltooide-taakregel toevoegen?** (O-05) Nu wijkt 51 van 68 voltooide taken af in opgeslagen TF en 17 taken zonder statusdatum in kritiek.
   - Opties: (a) eerst `check-mpp-fidelity` uitbreiden met TF/kritiek (spoor T/O), daarna de regel "voltooid ⇒ nooit kritiek, ook zonder statusdatum" en een MSP-conventie voor TF van voltooide taken; (b) alleen de kritiekregel zonder meting.
   - Advies: (a). De kritiekregel voor voltooide taken lijkt pakket-onafhankelijk (P6-motor doet het ook alleen mét statusdatum), dus eerst meten wat P6 doet met een 100%-taak zonder data date.
7. **`ashspace-primeveraxereditor/sample.xer` blijven behandelen als orakel?** B5 rust er alleen op (20 cellen), en de bron kan de vlaggen zelf hebben gezet (manifestnotitie). Uitsluiten haalt ook 4 cellen B2 en 10 drivingPath-cellen weg.
   - Advies: laten tot een tweede bron voor B5 bestaat; B5 blijft "twijfel" in het register.
8. **Sample SF-lag-0 (7 cellen), Hotel ATWTPR000 (3) en EC2400/EC2390 (7)**: bouwen of laten? Alle drie n=1 zonder bron.
   - Advies: laten als gemarkeerd restant; bouwen alleen na de drie kleine P6-runs uit het onderzoeksdocument (SF vanaf bandstart, midden in band, met lag > 0). De afrondingscellen (5) los oplossen met de eerder voorbereide tolerantie van 0,001 min (bron: 6-decimale uren in het XER zelf).
9. **Zou de profielwissel in Projectinfo de standaardopties moeten aanbieden?** (O-11) Nu krijgt een nieuw P6-project via de wizard andere opties dan een bestaand project dat naar P6 wordt gewisseld.
   - Advies: aanbieden via één melding/knop ("Standaardopties van dit profiel toepassen?") in plaats van automatisch, omdat opties per bestand zijn.
10. **Melding wanneer de profiel-pset ontbreekt of onleesbaar is?** (O-04) Kost een nieuw meldingskanaal-item per openen; alleen zinvol als u bestanden van derden of bewerkte IFC's verwacht.
    - Advies: ja, één `warning`-melding bij "OPS_ProjectSettings/OPS-psets aanwezig maar `OPS_SchedulingProfile` niet bruikbaar" (spoor D/O). Kleine wijziging, geen gedragsverandering voor gezonde bestanden.

Vragen zonder keuze (gewoon oppakken, met eigenaarslabel niet nodig): O-03 (P6-XML-lezer, spoor E), O-02 (opdracht/draaiboek corrigeren), O-12 (bronverwijzing in het docblok herzien), O-13, O-14, O-16.

---

## 5. Bronnen (URL + letterlijk citaat)

Let op: de citaten hieronder komen uit `WebFetch`, dat de pagina via een klein model terugbrengt; ik heb steeds om letterlijke tekst gevraagd,
maar een controle tegen de pagina zelf blijft nodig voordat een citaat in een PR of gids belandt. Waar het model zei dat een pagina iets níét bevat,
staat dat hier als "geen tekst".

Oracle P6
- https://docs.oracle.com/cd/G18294_01/p6help/en/99348.htm (Scheduling Settings Section): "Retained Logic: The remaining duration of a progressed activity is not scheduled until all of its predecessors are finished." — "Progress Override: The schedule ignores network logic and allows the activity to progress without delay." — "Actual Dates: Backward and forward passes are calculated using actual dates." — Early Start: "Calculates the expired lag as the number of work periods between the actual start and the data date and determines the successor's start date as the predecessor's remaining early start plus any remaining lag. Select this option when the successor's start depends on the amount of work that the predecessor activity accomplishes." — Actual Start: "Calculates the successor's start date as the data date plus any remaining lag." Geen default vermeld voor float-methode, lagkalender, open-ended, critical.
- https://docs.oracle.com/cd/F88966_01/p6help/en/99348.htm: hetzelfde voor Progress Override en de twee SS-lagopties; "No specific default calendar is named in the documentation" (uitkomst van de fetch).
- https://docs.oracle.com/cd/F25600_01/client_help/en_US/general_tab_-_schedule_options_dialog_box.htm (P6 Professional, General tab): "If you do not select a calendar, Successor Activity Calendar is used to calculate lag." — "Use Expected Finish Dates: Mark to schedule activity finish dates as the expected finish dates. This option is checked by default." — Compute Total Float as: "Start Float … Finish Float … and Smallest of Start Float and Finish Float is the most critical float value." (geen default).
- https://docs.oracle.com/cd/F88966_01/p6help/en/6616.htm (About Relationships): "Finish to Finish: The successor activity cannot finish until its predecessor finishes." — "Start to Finish: The successor activity cannot finish until its predecessor starts." — "Lag entered in a unit other than hours is converted to hours based on the predecessor activity's calendar."
- https://docs.oracle.com/cd/F51303_01/client_help/en_US/choose_a_calendar_for_relationship_lag.htm: "Lag entered in a unit other than hours is converted to hours based on the predecessor activity's calendar." (geen default).
- https://docs.oracle.com/cd/F51303_01/client_help/en_US/as_late_as_possible_constraint.htm: "A restriction you impose on an activity or work unit with positive float that allows it to start as late as possible without delaying its successors. This constraint sets the early dates as late as possible without affecting successor activities."
- https://docs.oracle.com/cd/F37125_01/p6help/en/47223.htm (Durations Columns, aangehaald bij A19): "Remaining Duration … The total working time from the activity remaining start date to the remaining finish date … Before the activity is started, the remaining duration is the same as the planned duration." Geen tekst over het gebruik door de scheduler (O-12).

Microsoft
- https://support.microsoft.com/en-us/project/total-slack-task-field: "Total slack is calculated as the smaller value of the Late Finish minus the Early Finish field, and the Late Start minus the Early Start field."
- https://support.microsoft.com/en-US/project/manage-your-project-s-critical-path: "It has no slack (or float)." — "you can set up your project plan to see multiple critical paths for each independent network or series of tasks" — "For example, you can make a task critical if it has one or two days of slack." (geen standaarddrempel in de tekst).
- https://support.microsoft.com/en-us/office/set-the-status-date-for-project-reporting-ef4ad175-b219-456a-8f62-2eef97a3c8ce: "When you enter progress as percent complete or actual work to date, Project uses the status date to determine where to place actual work and where to schedule remaining work." — "if a task is scheduled before the status date and you enter actuals against it, Project leaves the actual portion of the task as scheduled, but moves any remaining work to the status date."
- https://mpug.com/understanding-calculation-options-in-microsoft-project (MPUG, secundair): noemt de vier statusdatum-opties; "By default, the second and fourth options are disabled."
- https://learn.microsoft.com/en-us/office/vba/api/project.task.totalslack: "The total slack is the amount of time that a task finish date can be delayed without delaying the project finish date."

Derden (secundair, als zodanig gemarkeerd)
- https://boyleprojectconsulting.com/tomsblog/2018/06/27/impact-of-calendars-on-schedule-slack-calculation-in-microsoft-project/: "Relationship lags are computed according to the Task Calendar of the successor task, if it has one, or the Project Calendar."
- https://boyleprojectconsulting.com/tomsblog/2018/07/18/relationship-free-float-and-float-paths-in-multi-calendar-projects-p6-mfp-free-float-option/: "Relationship free float and total float use the predecessor calendar." — "The Relationship Free Float that P6 displays … is computed according to the PREDECESSOR's calendar."
- https://www.mpxj.org/howto-use-cpm/: "These schedulers have been implemented by observing and attempting to replicate the behavior of Microsoft Project and Primavera P6 … this is not guaranteed." (geen tekst over lagkalender of float).
- Niet bereikbaar (Cloudflare): tensix.com-pagina's; Ron Winter-pdf niet zelf opgehaald (alleen via het bestaande onderzoeksdocument).

---

## 6. Index van eigen bestanden en reproductie

Alles staat onder `/home/user/audit/o1/audit-o/`. Bundelen: `node_modules/.bin/esbuild <ts> --bundle --platform=node --format=esm --alias:@=$PWD/src --external:react-dom/server --define:import.meta.env.DEV=false --define:import.meta.env.PROD=true --define:import.meta.env.MODE='"production"' --define:__OPS_DEV_INSTANCE__='"test"' --outfile=<mjs>`; uitvoeren vanuit `tests/planning/` met `OPS_XER_CORPUS=/home/user/ops-xer-corpus`.

| bestand | doel | uitvoer |
|---|---|---|
| `variant/check-x12-variant.ts` | X12-check zonder de ontbrekend-in-corpus-fout (O-01) | `x12-gate.log`, `x12-detail.log` (`OPS_XER_FIDELITY_REPORT=detail`) |
| `variant/ablate.ts` | ablatie van 27 conventies, 3 profielen, 11 opties op het P6-orakelcorpus | `ablate.log`, `ablate-dp.log` |
| `variant/ablate-mpp.ts` (+ `mppFidelity-abl.ts`) | idem op 213 `.mpp` | `ablate-mpp.log` |
| `variant/hpcf.ts` | HarbourPointe-tegenfeit (8 taken op P6-spanne) | `hpcf.log` |
| `variant/probes1.ts`, `probes2.ts` | profielwissel-fuzz, IFC-round-trip-fuzz, corrupte pset, migratie | `probes1.log`, `probes2.log` |
| `variant/mppcrit.ts`, `mpptf.ts` | opgeslagen kritiek/TF van MS Project tegenover de solver | `mppcrit.log`, `mpptf.log` |
| `variant/extopt.ts` | extensie-opties zonder validatie | `extopt.log` |
| `variant/pmxml-dbg.ts`, `pmxml-browser.mjs` | P6-XML: 0 taken (Node-shim en Chromium) | `pmxml-node.log`, `pmxml-chromium.log` |
| — | `npm run measure:profiles` (2×), `check-mpp-fidelity.ts` met wortel | `measure1.log`, `measure2.log`, `mpp-fid-root.log` |

Gerichte batterijen die groen zijn gebleven (geen volledige suite): `npm run verify:conventions`;
`check-conventions-registry` (1587), `check-conventions-p6-flags` (301), `check-scheduling-profile-roundtrip` (130),
`check-scheduling-profile-draft` (59), `check-scheduling-profile-actions` (37), `check-scheduling-profile-notice` (17),
`check-import-profile` (8), `check-p6-verified-cases-engine` (bron niet aanwezig: transcriptie-deel overgeslagen), `check-profile-switch-dates` (26).

Nog niet gedaan en dus geen uitspraak: een MSPDI-corpus (afwezig), de drie bedrijfs-`.mpp`-bestanden (`OPS_MPP_CORPUS`, alleen lokaal),
een uitputtende mutatietest per conventie op "heeft een fixture een effect", Ron Winter/Ten Six primair gelezen.
