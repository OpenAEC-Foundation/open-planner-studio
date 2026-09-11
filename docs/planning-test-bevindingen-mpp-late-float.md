# MPP-meting: late datums en speling tegen MS Project (2026-09-11)

Meetopdracht, geen fix. De bestaande `.mpp`-meetlat (`tests/planning/check-mpp-fidelity.ts`,
`GOAL_ZERO_DEVIATIONS`) meet alleen start en finish: nul afwijkingen over 216 bestanden. Late
start, late finish, totale speling en vrije speling waren nog nooit tegen MS Projects eigen
opgeslagen waarden gelegd. Dit document legt vast wat die vier assen vandaag doen, hoe dat gemeten
is, welke afwijkingsklassen er zijn en wat er niet verklaard is. Er is niets aan de solver of de
`.mpp`-lezer gewijzigd.

Elke bewering draagt een label: **ZEKER** (gemeten of letterlijk in de bron gelezen), **AFGELEID**
(beredeneerd uit gemeten feiten of uit MPXJ-broncode) of **ONBEKEND**. Het document is na een
hyperkritische review herschreven; de reviewbevindingen die de cijfers raakten (de "grensvorm"-
klasse, §2 en §5.3) zijn verwerkt en als zodanig gemarkeerd.

## 1. Gereedschap

| onderdeel | bestand | rol |
|---|---|---|
| grondwaarheid | `tests/planning/mppGroundTruth.ts` | leest nu per taak óók `LATE_START`/`LATE_FINISH` (veld 39/40), `START_SLACK`/`FINISH_SLACK`/`FREE_SLACK` (438/439/21), `ACTUAL_START`/`ACTUAL_FINISH` (41/42) en de TASK_MODE-vlag; zoekt `TOTAL_SLACK` (22) op in de data-gedreven veldkaart |
| meetkern | `tests/planning/mppLateFloatFidelity.ts` | `measureLateFloat(bytes)`: `readMPP` + `solveProject` (dezelfde `solveMppBytes` als de meetlat, dus de echte `runCPM`-keten) tegen die grondwaarheid, vier assen, per populatie en per diagnosevlag |
| rapport | `tests/planning/report-mpp-late-float.ts` + `.sh` | rapportmodus: `OPS_MPP_CORPUS=… OPS_MPP_CRAWL=… bash tests/planning/report-mpp-late-float.sh`; `OPS_MPP_LATE_FLOAT_DETAIL=<deel van de tag>` print per taak alle assen |

Het rapport is **geen poort**: het staat niet in `run.sh`, pint niets in
`mpp-fidelity-baseline.json` en raakt `GOAL_ZERO_DEVIATIONS` niet. De enige wijziging aan bestaande
testcode is additief: `RawTask` kreeg extra velden en `SolvedMpp` geeft de kalenders van dezelfde
`readMPP`-uitkomst mee (nodig om de taak-effectieve `CalendarEngine` exact zo op te bouwen als
`CPMSolver.calendarFor`). `check-mpp-fidelity.ts` en de baseline zijn ongewijzigd. De meetkern
staat bewust buiten elk vangnet: verandert de semantiek van `signedFloat` of `sequenceFreeFloat`,
dan meet dit rapport stil anders — het is een meetinstrument, geen regressietest (bekende
beperkingen staan in de moduleheader van `mppLateFloatFidelity.ts`).

## 2. Hoe de grondwaarheid gelezen wordt

**ZEKER (bron gelezen)** — veld-id's en blok-0-offsets uit MPXJ 16.7.0 (commit `ac7aa7b8`,
`src/main/java/org/mpxj/mpp/FieldMap14.java`, `getDefaultTaskData()`):

| veld | id | offset | regel |
|---|---|---|---|
| `LATE_START` | 39 | 12 | r. 67 |
| `LATE_FINISH` | 40 | 110 | r. 95 |
| `FREE_SLACK` | 21 | 24 | r. 70 |
| `START_SLACK` | 438 | 28 | r. 71 |
| `FINISH_SLACK` | 439 | 32 | r. 72 |
| `ACTUAL_START` | 41 | 72 | r. 84 |
| `ACTUAL_FINISH` | 42 | 76 | r. 85 |

**ZEKER (code)** — de lezing gaat uitsluitend via de data-gedreven veldkaart (`fixedOffsetOf`),
zoals de bestaande grondwaarheid. Er is **geen terugval** op bovenstaande offsets: `DEFAULT_TASK_
FIELDS` in `fieldMap14.ts` kent voor 39/40/21/438/439/22 geen entry en `buildFieldMap` vervangt de
defaults door de data-gedreven kaart. Een bestand zonder `TASK_FIELD_MAP` telt daarom `missing` op
alle vier de assen (zichtbaar in de kolom "ontbrekend"; corpusbreed 0). Alle 164 zichtbare
bestanden dragen zo'n kaart.

**ZEKER (bron gelezen)** — eenheid van de spelingen: `TaskField.java` r. 73/287/288 koppelt
`FREE_SLACK`/`START_SLACK`/`FINISH_SLACK` aan de eenhedenbron `ACTUAL_DURATION_UNITS` (id 181,
offset 46) — hetzelfde veld dat de grondwaarheid al als `durUnit` leest. De ruwe int is tienden van
een minuut (`MPPUtility.java` r. 504: "Value is given in 1/10 of minute"); `getAdjustedDuration`
(r. 694 e.v.) deelt voor dagen door `minutesPerDay × 10`, voor uren door 600, dus `raw / 10` is
altijd het aantal werkminuten, onafhankelijk van de weergave-eenheid. Sentinel `-1` ⇒ geen waarde
(r. 698). Bij een elapsed-eenheid zijn het kalenderminuten.

**ZEKER (bron gelezen + corpus gemeten)** — `TOTAL_SLACK` wordt door MPXJ **niet** uit een MPP14-
bestand gelezen: het veld heeft geen entry in `getDefaultTaskData()`, en `Task.java` r. 7274
registreert het als berekend veld (`MicrosoftSlackCalculator.calculateTotalSlack`). Corpusbreed
gemeten: in geen van de 164 zichtbare bestanden komt veld-id 22 in blok 0 van de veldkaart voor
(rapportregel "TOTAL_SLACK opgeslagen bij 0 taken").

**AFGELEID** — de as "totale speling" is daarom een afgeleide grondwaarheid, volgens MPXJ's regel
(`cpm/MicrosoftSlackCalculator.java`, standaardinstelling `SMALLEST_SLACK` — MPXJ leest die
instelling niet uit MPP, `ProjectPropertiesReader.java` kent alleen `CRITICAL_SLACK_LIMIT`; in alle
164 MPXJ-dumps staat `totalSlackCalc=SMALLEST_SLACK`): `actualStart ≠ null ⇒ finishSlack`, anders
`min(startSlack, finishSlack)`. De Java-tak `duration == null ⇒ null` is niet overgenomen (de
grondwaarheid leest de duur niet als nullable; corpusbreed 0 verschillen met MPXJ's
`getTotalSlack`). De vier assen zijn dus drie letterlijk opgeslagen velden en één afgeleide.

**Omrekening naar één as** (dezelfde afspraak als de XER-etappe: onze float in minuten tegen
round(bron-float × 60), via de taak-effectieve kalender):

- MSP: `round(raw / 10)`; bij een elapsed-eenheid `round(raw / 10 × (hoursPerDay × 60) / 1440)`,
  omdat onze `signedElapsedSpan` kalenderdagen geeft die op dezelfde werkdag-as landen.
- Wij: `Task.time.totalFloat`/`freeFloat` zijn werkdagen; `CPMSolver.signedFloat` rekent in
  uur-modus `workMinutesBetween / (hoursPerDay × 60)` op de taak-effectieve `CalendarEngine`. De
  meting neemt de inverse `round(float × hoursPerDay × 60)` met exact die engine
  (`resolveCalendar` + `calendarWithEffectiveWorkTime` bij uur-taken); `hoursPerDay ≤ 0` ⇒ `missing`.
- Late datums: `classify` uit `mppFidelity.ts` (exact / zelfde dag, ander tijdstip / andere dag),
  aangevuld met de klasse **grensvorm**: twee verschillende instanten met nul werkminuten ertussen
  op de taak-effectieve kalender (zie §2.2). Voor de spelingsassen is de tussenbucket "binnen één
  werkdag" (|Δ| < hoursPerDay × 60).

### 2.1 Toets van de lezing tegen MPXJ

**ZEKER (gemeten)** — op alle 164 zichtbare bestanden (2225 taken) is de TypeScript-lezing per taak
vergeleken met wat MPXJ 16.7.0 zelf teruggeeft (`UniversalProjectReader`, Maven-artefact
`net.sf.mpxj:mpxj:16.7.0`; dump van `getLateStart/getLateFinish/getStartSlack/getFinishSlack/
getFreeSlack/getTotalSlack/getTaskMode/getActualStart/getActualFinish`):

| vergeleken | overeenkomst |
|---|---|
| taakmodus (manual/auto) | 2225 / 2225 |
| late start, late finish | 2225 / 2225 |
| actual start, actual finish | 2225 / 2225 |
| start-, finish-, free-slack (minuten) | 2225 / 2225 (twee maand-eenheid-taken in `mpp14duration.mpp` kloppen na omrekening 0,1 mo = 960 min) |
| totale speling volgens de afgeleide regel | 2225 / 2225 |

Het vergelijkingsharnas (Java-dump + TypeScript-probe) is **niet gecommit**; het is een eenmalige
wegwerptoets in de sessiescratch. De reviewer heeft hem onafhankelijk herhaald (2200/2200 taken
over 158 bestanden, 0 verschillen; 6 bestanden vielen af op een rijtellingsartefact van de dump).
Dat bewijst dat de lezing MPXJ reproduceert — niet dat de bytes betekenen wat MPXJ zegt.

### 2.2 Toets zonder MPXJ: MS Projects eigen MSPDI-export

**ZEKER (gemeten)** — het corpus bevat vier projecten die zowel als MPP14 als als MSPDI-export
(door MS Project zelf geschreven) aanwezig zijn en die échte late datums en speling dragen:
`generated/task-links/task-links-project{2010,2013,2016,2019}-{mpp14.mpp,mspdi.xml}` (16 taken,
6 verschillende late starts, speling tot 52800 tienden van minuten). Per taak vergeleken:
late start, late finish, de drie opgeslagen spelingen, de afgeleide totale speling en de manual-vlag.

| paar | volledig gelijk | verschillen |
|---|---|---|
| 2016 | 16 / 16 | — |
| 2019 | 16 / 16 | — |
| 2010 | 0 / 16 | (a) late finish van 6 FS-voorgangers: `.mpp` = begin volgende werkdag (`#9`: 2014-10-20T08:00), XML = einde werkdag (2014-10-17T17:00); (b) `#11`/`#13`: late datums en speling 1 werkdag anders (`.mpp` 52800 vs XML 48000); (c) `<Manual>` = 0 voor alle 16 taken in de XML, TASK_MODE-bit = manual in de `.mpp` (MPXJ leest 'm ook als manual) |
| 2013 | 0 / 16 | identiek aan 2010 |

Wat dit zegt:

- **ZEKER**: late start en de drie spelingen zijn in alle vier de paren identiek tussen `.mpp` en
  MSP's eigen export (op `#11`/`#13` in 2010/2013 na, zie (b)). De lezing is dus ook zonder MPXJ
  getoetst op niet-triviale waarden. (De eerste versie van dit rapport gebruikte hiervoor
  `task-dates-project{2013,2016}` — twintig taken met allemaal late = early en speling 0; die
  toets kon niets onderscheiden en is vervangen, reviewbevinding.)
- **ZEKER (grensvorm)**: MS Project slaat in de 2010/2013-bestanden de late finish van een FS-
  voorganger op als het **begin van de volgende werkdag**, terwijl zijn eigen MSPDI-export én onze
  motor het einde van de vorige werkdag geven. In de 2016/2019-bestanden staat de einde-werkdag-vorm
  ook in de `.mpp`. Dat is een representatieverschil, geen planningsverschil; de meting telt het
  sinds de review als eigen klasse "grensvorm" (nul werkminuten tussen de twee instanten), niet als
  exact en niet als afwijking. Corpusbreed: 8 taken op late finish, 2 op late start.
- **ONBEKEND** (b) en (c): of `.mpp` en XML in de 2010/2013-paren dezelfde projecttoestand zijn,
  is niet vast te stellen (alle vier de XML's dragen `SaveVersion` 14). Punt (c) verdient aandacht
  buiten deze meting: MSP's eigen export zegt "niet handmatig" waar de TASK_MODE-bit (Z1-lezing,
  masker 0x08 voor `applicationVersion ≤ 14`) en MPXJ "handmatig" zeggen. Dat is óf een andere
  save, óf een aanwijzing dat de bit-decodering voor Project-2010-bestanden anders ligt. Niet
  onderzocht, niets gewijzigd.

## 3. Corpus en zichtbaarheid

**ZEKER** — gemeten op de publieke helft van de crawl: MPXJ's `junit/data` (sparse clone van
`joniles/mpxj`, commit `ac7aa7b8`, 2026-08-23), gemonteerd als `OPS_MPP_CRAWL` zodat de labels
`mpxj/junit/data/…` uit de baseline overeenkomen. Van de 609 `.mpp`-bestanden daar zijn er 445
MPP8/9/12 (geweigerd, zoals de meetlat ook doet) en 164 MPP14 leesbaar. Die 164 zijn exact de 164
niet-OzBuild-pins in `mpp-fidelity-baseline.json` (hash-match). De bestaande meetlat geeft in deze
configuratie één rode regel — `globaal[crawl]: verwacht 213, kreeg 164`, de ongeziene OzBuild-
pins — en verder `164 ongewijzigd, 0 verbeterd, 0 verslechterd` op start/finish. De
grondwaarheidsuitbreiding heeft die uitkomst niet veranderd (vóór en ná gemeten). Corpusloos
(zoals CI) is `npm run test:planning` groen.

**Niet gezien**: de 49 OzBuild-workshopbestanden (`crawl-mpp/MSP2016_OzBuild/…`,
`crawl-mpp/MSP2021_OzBuild/…`, samen 788 gepinde taken) en de 3 bedrijfscorpusbestanden
(`OPS_MPP_CORPUS`). Het rapport print die lijst zelf (sectie 4). Daar staat hier niets over
beweerd; de twee zuivere leveling-bestanden (`OzBuild Workshop 17*.mpp`) en het gemengde
corpusbestand zitten erin, dus de klasse `levelingDelay` is in deze meting **niet geoefend**
(0 taken met een leveling delay in de zichtbare 164).

## 4. Uitkomst per as (164 bestanden, 2225 taken)

**ZEKER (gemeten)**. Kolommen: meetbaar | exact | grensvorm | zelfde dag, ander tijdstip (datums)
resp. binnen één werkdag (spelingen) | afwijkend | %exact van meetbaar. Populaties zijn disjunct,
in deze prioriteit: handmatig gepland (TASK_MODE-bit) > voltooid (`completion ≥ 1` of
`actualFinish`) > samenvatting (kinderen) > overig. Grensvorm telt niet als exact; de %-kolom is
daardoor een ondergrens.

Late start

| populatie | meetbaar | exact | grensvorm | zelfde dag | afwijkend | %exact |
|---|---|---|---|---|---|---|
| alle | 2225 | 2017 | 2 | 2 | 204 | 90,7 % |
| handmatig gepland | 1648 | 1545 | 1 | 0 | 102 | 93,8 % |
| voltooid | 30 | 16 | 0 | 0 | 14 | 53,3 % |
| samenvatting | 53 | 53 | 0 | 0 | 0 | 100 % |
| overig (blad, auto, niet voltooid) | 494 | 403 | 1 | 2 | 88 | 81,6 % |

Late finish

| populatie | meetbaar | exact | grensvorm | zelfde dag | afwijkend | %exact |
|---|---|---|---|---|---|---|
| alle | 2225 | 2029 | 8 | 2 | 186 | 91,2 % |
| handmatig gepland | 1648 | 1539 | 6 | 0 | 103 | 93,4 % |
| voltooid | 30 | 17 | 0 | 0 | 13 | 56,7 % |
| samenvatting | 53 | 53 | 0 | 0 | 0 | 100 % |
| overig | 494 | 420 | 2 | 2 | 70 | 85,0 % |

Totale speling (grondwaarheid afgeleid, zie §2)

| populatie | meetbaar | exact | binnen 1 werkdag | afwijkend | %exact |
|---|---|---|---|---|---|
| alle | 2225 | 2035 | 10 | 180 | 91,5 % |
| handmatig gepland | 1648 | 1545 | 5 | 98 | 93,8 % |
| voltooid | 30 | 17 | 0 | 13 | 56,7 % |
| samenvatting | 53 | 53 | 0 | 0 | 100 % |
| overig | 494 | 420 | 5 | 69 | 85,0 % |

Vrije speling

| populatie | meetbaar | exact | binnen 1 werkdag | afwijkend | %exact |
|---|---|---|---|---|---|
| alle | 2225 | 2066 | 7 | 152 | 92,9 % |
| handmatig gepland | 1648 | 1573 | 5 | 70 | 95,4 % |
| voltooid | 30 | 18 | 0 | 12 | 60,0 % |
| samenvatting | 53 | 53 | 0 | 0 | 100 % |
| overig | 494 | 422 | 2 | 70 | 85,4 % |

Per bestand: 142 van de 164 bestanden zijn op alle vier de assen exact voor alle taken. De 22
andere (exact / grensvorm / near / afwijkend per as):

| bestand | taken | late start | late finish | totale speling | vrije speling |
|---|---|---|---|---|---|
| generated/task-links/task-links-project{2010,2013,2016,2019}-mpp14.mpp (4×) | 16 | 2/0/0/14 | 1/1/0/14 | 2/0/0/14 | 9/0/0/7 |
| mpp14baseline.mpp | 14 | 13/0/0/1 | 13/0/0/1 | 13/0/0/1 | 14/0/0/0 |
| mpp14duration.mpp | 10 | 6/0/0/4 | 5/1/0/4 | 6/0/0/4 | 6/0/0/4 |
| mpp14resource.mpp | 3 | 1/0/0/2 | 1/1/0/1 | 1/0/0/2 | 2/0/0/1 |
| mpp14timephased.mpp | 40 | 7/0/1/32 | 12/0/2/26 | 12/0/4/24 | 12/0/2/26 |
| mpp14timephased2.mpp | 9 | 2/0/0/7 | 8/0/0/1 | 8/0/0/1 | 8/0/0/1 |
| mpp14timephasedsegments.mpp | 20 | 2/0/0/18 | 2/0/0/18 | 2/0/0/18 | 2/0/0/18 |
| mpp14timephasedsegmentsmanual.mpp | 21 | 1/0/0/20 | 1/0/0/20 | 1/0/0/20 | 1/0/0/20 |
| mpp14timephasedsegmentsmanualoffsets.mpp | 25 | 2/1/0/22 | 1/1/0/23 | 2/0/5/18 | 2/0/5/18 |
| resource/resource-type/sf235.mpp | 3 | 3/0/0/0 | 2/1/0/0 | 3/0/0/0 | 3/0/0/0 |
| taskFlags-mpp14Project{2010,2013}.mpp (2×) | 71 | 53/0/0/18 | 53/0/0/18 | 53/0/0/18 | 53/0/0/18 |
| timephased-actual-overtime-work.mpp | 3 | 1/0/1/1 | 3/0/0/0 | 2/0/1/0 | 3/0/0/0 |
| timephased-budget{,-baseline,-calendar-exceptions,-manual-edits,-manual-exceptions}.mpp (5×) | 1 | 0/0/0/1 | 1/0/0/0 | 1/0/0/0 | 1/0/0/0 |
| timephased-prorated-cost-resource.mpp | 4 | 3/1/0/0 | 4/0/0/0 | 4/0/0/0 | 4/0/0/0 |

Lees de hoge exactheid bij "handmatig gepland" niet als "manual klopt": 1648 van de 2225 taken zijn
manual (de gegenereerde MPXJ-testbestanden komen uit Project 2013+, waar manual de standaard is), en
verreweg de meeste daarvan hebben in MSP zelf speling 0 (één taak per bestand, of alle taken
eindigen op de projectfinish). Waar MSP een manual taak wél speling geeft, wijken wij altijd af
(§5.1). Zie ook §2.2 (c) voor de open vraag over de manual-vlag in Project-2010-bestanden.

## 5. Diagnoseklassen

Vlaggen per taak, niet-exclusief. Aantallen zijn niet-exacte taken per as (late start / late
finish / totale speling / vrije speling), grensvorm apart; voorbeelden geven
`bestand #MSP-id: onze waarde vs MSP` (minuten voor spelingen). Taaknamen staan er bewust niet in.

### 5.1 manual — 102 / 103 / 103 / 75 (grensvorm 1 / 6 / – / –)

**ZEKER (code)** — `CPMSolver.backwardPass` geeft een `manuallyScheduled`-taak definitorisch
`ls = es`, `lf = ef` (verplichte early-return) en `scheduleAnalysis.ts` forceert `tf = ff = 0`
(plan-veeglijst Z9b: "manual taken zijn in de default-modus per constructie kritiek").

**ZEKER (gemeten)** — MS Project slaat voor manual taken echte late datums en speling op, en zijn
eigen MSPDI-export van dezelfde projecten bevestigt die waarden (§2.2):

- `generated/task-links/task-links-project2010-mpp14.mpp #1`: LS 2014-10-17T08:00 vs
  2014-10-31T08:00; LF 2014-10-17T17:00 vs 2014-11-03T08:00; TF 0 vs 4800 (10 d).
- idem `#3`: LS 2014-10-17T08:00 vs 2014-10-30T08:00; TF 0 vs 4320.
- `mpp14timephasedsegmentsmanual.mpp #1`: TF 0 vs 180000 (375 d) — een heel bestand van 21 manual
  taken waar MSP overal 360–375 d speling toont en wij 0.

**AFGELEID** — MSP rekent de late zijde voor manual taken gewoon door vanaf de projectfinish (de
late datums liggen op de projectfinish min de duur, zoals bij auto-taken). Dit is de grootste
verklaarde klasse en volledig toe te schrijven aan de Z9b-keuze; een latere verfijning zou de
backward pass voor manual taken moeten laten lopen zoals voor auto-taken. Geen wijziging gedaan.
Voorbehoud: §2.2 (c).

### 5.2 voltooid — 14 / 13 / 13 / 12

**ZEKER (gemeten)** — voor een voltooide taak slaat MSP `LS = actual start`, `LF = actual finish`
en alle spelingen 0 op (MPXJ-dump: `mpp14timephased.mpp #7` AS 2008-11-20T09:00 = LS, AF
2008-12-03T12:00 = LF; `mpp14baseline.mpp #3` AS 2006-08-30T08:00 = LS, AF 2006-09-05T17:00 = LF;
`mpp14resource.mpp #3` idem):

- `mpp14timephased.mpp #7`: LS 2008-12-22T08:00 vs 2008-11-20T09:00, LF 2009-01-02T11:00 vs
  2008-12-03T12:00; TF 10500 vs 0.
- `mpp14baseline.mpp #3`: LS 2006-09-01T08:00 vs 2006-08-30T08:00; TF 960 vs 0.
- `mpp14resource.mpp #3`: LS 2006-09-06T09:08 vs 2006-08-26T08:00; TF 3428 vs 0.

**ZEKER (code)** — wij laten een voltooide taak gewoon in de backward pass meelopen en geven haar
de speling tot de projectfinish; `isCritical` wordt wel op `false` gehouden. De 16 voltooide taken
die exact zijn, zijn taken die ook zonder die regel speling 0 hebben.

### 5.3 inUitvoering (actual start, < 100 %) — 20 / 10 / 11 / 10

**ZEKER (gemeten)** — MSP zet `LS = actual start` (MPXJ-dump: `mpp14timephased2.mpp #2` AS
2011-12-07T08:00 = LS; `mpp14timephased.mpp #28` AS 2008-11-20T09:00 = LS) en houdt de finish-zijde
open; MPXJ's totale-spelingsregel wisselt daar naar `finishSlack`:

- `mpp14timephased2.mpp #2`: LS 2011-12-08T08:00 vs 2011-12-07T08:00; LF en TF exact (480 = 480).
- `mpp14timephased.mpp #28`: LS 2008-12-08T14:00 vs 2008-11-20T09:00; LF exact; TF 6000 = 6000.
- `mpp14timephased.mpp #4`: LS 2008-12-22T08:00 vs 2008-11-20T09:00, LF 2009-01-02T11:00 vs
  2008-12-11T17:00, TF 10500 vs 3120 — de LF-afwijking hier is niet de voortgang maar de
  onverklaarde klasse van §5.6.

**AFGELEID** — de late start van een gestarte taak is bij ons een backward-pass-uitkomst
(`ls = lf − restduur`), bij MSP het anker zelf. Waar de LF overeenkomt (10 van de 20 taken), is de
totale speling toch gelijk: `scheduleAnalysis.ts` neemt `min(finishFloat, startFloat)` en de
finish-zijde is daar de kleinste. (De eerste versie van dit rapport schreef dit toe aan de
voortgangstak `hasProgress`; die vuurt alleen mét een `dataDate`, en geen van de betrokken
bestanden draagt een statusdatum — reviewbevinding, gecorrigeerd.) Het late-start-verschil is dus
onzichtbaar in tf, maar zichtbaar als datum.

### 5.4 timephased / split — 73 / 64 / 65 / 64 (grensvorm 2 / 2 / – / –) resp. 15 / 11 / 12 / 11

Taken met `Task.timephasedFinishFloor`/`timephasedDurationWalks` of `Task.splitGaps`
(`mpp14timephased.mpp`, `mpp14timephasedsegments*.mpp`, `mpp14resource.mpp`,
`timephased-budget*.mpp`, `timephased-prorated-cost-resource.mpp`).

**ZEKER (gemeten)** — twee patronen:

1. LF exact, LS één werkdag te laat, TF toch exact (0): `timephased-budget.mpp #1` LS
   2026-03-27T08:00 vs 2026-03-26T08:00 (= ES), LF 2026-04-23T17:00 exact. Vijf bestanden, één
   taak elk. **AFGELEID**: de finish van zo'n taak volgt de resource-inzet (finish floor), niet
   start + duur; onze backward pass trekt de kale duur van de LF af en landt dus later dan de ES,
   terwijl MSP de LS op de ES houdt. Omdat tf de kleinste van start- en finish-float is, blijft
   tf 0 — het datumverschil is er wel.
2. LF ver vóór de projectfinish bij MSP: `mpp14timephased.mpp #2`: LS 2008-12-11T15:00 vs
   2008-11-20T11:00, LF 2009-01-02T11:00 vs 2008-12-11T17:00, TF 7500 vs 120. Zie §5.6 — dat is
   niet met timephased-gedrag te verklaren.

`mpp14resource.mpp #1` (gecontoureerde taak): de LF is grensvorm (ons 2006-08-29T17:00, MSP
2006-08-30T08:00 — nul werkminuten ertussen), maar de LS wijkt echt af (2006-08-22T08:00 vs
2006-08-25T08:00) en onze tf is −1440 waar MSP 0 opslaat. **ONBEKEND** welke van de twee "juist"
is zonder MS Project zelf.

### 5.5 kalender — 2 / 2 / 2 / 2

`mpp14timephasedsegments.mpp #8` en `mpp14timephasedsegmentsmanual.mpp #8`: de enige twee taken
met een eigen kalender in de afwijkende verzameling. **AFGELEID**: beide wijken af om dezelfde
reden als hun buren zonder eigen kalender (§5.6 resp. §5.1); de kalender is hier geen eigen
oorzaak.

### 5.6 geen vlag / onverklaard — 42 / 42 / 42 / 42 (grensvorm – / 1 / – / –), plus het LF-patroon in §5.4

Drie concrete gevallen waar de opgeslagen MSP-waarden niet uit een gewone backward pass vanaf de
projectfinish volgen — en die ik niet kan verklaren zonder MS Project zelf:

- **`mpp14duration.mpp` #1–#4 (2 werkdagen)**: projectfinish 2009-04-24T08:00; de vijf elapsed-
  taken (#6–#10) hebben LF 2009-04-24T08:00 en zijn bij ons exact. De vier werktijd-taken hebben
  bij MSP LF 2009-04-21T17:00, bij ons 2009-04-24T08:00; TF 10559 vs 9599 (Δ 960 = 2 d). Geen
  relaties, geen constraints, geen kalenderuitzonderingen, `multipleCriticalPaths=false`
  (MPXJ-dump `DumpRel`, niet gecommit). Taak #5 (1 maand) heeft LF 2009-04-23T17:00 — wéér
  anders. **ONBEKEND.**
- **`taskFlags-mpp14Project{2010,2013}.mpp` (2 × 18 taken)**: kinderen van samenvattingstaken
  zonder relaties of constraints krijgen bij MSP een LF 1–2 werkdagen vóór die van hun ouder
  (`#7`: LS 2013-09-06T08:00 vs 2013-09-04T08:00, LF 2013-09-11T17:00 vs 2013-09-09T17:00, TF 1920
  vs 960), terwijl de samenvattingen zelf exact zijn. Het verschil is niet monotoon in de duur
  (4 d ⇒ −2 d, 6 d ⇒ −1 d, 5 d en 7 d ⇒ 0). **ONBEKEND.**
- **`mpp14timephased.mpp` #1–#24 en `mpp14timephasedsegments.mpp` #1–#18**: LF bij MSP
  2008-12-11T17:00 / 2011-03-04T17:00 terwijl de projectfinish 2009-01-02T11:00 / 2012-07-20T17:00
  is; geen enkele taak in die bestanden heeft een voorganger (MPXJ-dump: 0 relaties). In
  `mpp14timephasedsegments.mpp` liggen de late datums van #11–#14 zelfs ná de projectfinish
  (2013-04-29 … 2013-05-24). **ONBEKEND.** **AFGELEID**: een late finish ná de projectfinish kan
  niet uit één consistente backward pass vanaf die finish komen; de opgeslagen waarden zijn in die
  bestanden mogelijk niet het resultaat van één herberekening (MS Project schrijft late datums en
  speling zoals ze bij de laatste berekening stonden; met "Berekening: handmatig" of na
  tussentijdse bewerkingen kunnen die verouderd zijn). Dat is een hypothese, geen meting.

### 5.7 Niet geoefend in de zichtbare 164

- `levelingDelay`: 0 taken (de leveling-bestanden zitten bij de 49 ongeziene OzBuild-pins).
- `constraint`: 0 niet-exacte taken; `deadline`: 0; `samenvatting`: 0 (alle 53 exact);
  `elapsedEenheid`: na de omrekening 0 — en 0 elapsed-taken mét opvolger, dus de bekende
  beperking van de vrije-speling-omrekening (moduleheader) is niet geraakt.

## 6. Conclusie

- **ZEKER**: de lezing van late datums en opgeslagen spelingen is bewezen tegen MPXJ op alle 2225
  zichtbare taken en zonder MPXJ tegen MS Projects eigen MSPDI-export van vier projecten met echte
  speling (2016/2019 volledig gelijk; 2010/2013 gelijk op de grensvorm, twee taken en de
  manual-vlag na).
- **ZEKER**: corpusbreed 90,7–92,9 % exact per as (ondergrens: grensvorm telt niet mee);
  142/164 bestanden volledig exact.
- **ZEKER/AFGELEID**: de twee grootste klassen zijn beleidskeuzes van onze motor die MSP anders
  maakt — manual taken (Z9b: tf = 0, MSP rekent door) en voltooide/gestarte taken (MSP bevriest
  late datums op de actuals en zet speling 0, wij niet).
- **ONBEKEND**: drie bestanden(groepen) met opgeslagen late datums die niet uit een backward pass
  vanaf de projectfinish volgen (§5.6), en de manual-vlag-tegenspraak tussen `.mpp` en MSPDI in
  de Project-2010/2013-paren (§2.2 c); beide alleen met MS Project zelf te beslechten.
- **Niet gezien**: 49 OzBuild-pins (788 taken) en de 3 corpusbestanden — leveling is daarmee
  ongemeten.
