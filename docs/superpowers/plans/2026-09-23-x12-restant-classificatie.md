# X12-restant: classificatie in homogene brokken

*Gemeten op 2026-09-23 in een eigen detached worktree `/tmp/ops-x12-meet`. De kop van `claude/rekenprofielen` was inmiddels `86d720fb`; dat is `1b45218a` plus één commit die alleen documentatie wijzigt (`git diff --stat 1b45218a 86d720fb`: 1 bestand, `docs/…overdracht.md`). De motor is dus identiek. Er is niets in de repo gewijzigd. Alle hulpscripts en tussenresultaten staan in `/tmp/x12scripts/`.*

## Populatie na besluit 23-09

*Bijgewerkt 2026-09-23 op `claude/x12-manifest-p6-orakels` (Claude Opus 5.5). De rest van dit document
beschrijft de stand van 15.056 cellen op het oude orakel en blijft als geschiedenis staan.*

**Besluit.** Eigenaar, 23-09, letterlijk: "Ja die alleen die p6 Bestände" (overdracht §1a). Het orakel is
voortaan alleen een bestand met minstens één project dat aantoonbaar door P6 is doorgerekend. Het bewijs
per project komt uit `scripts/xer-p6-computed.ts`: een SCHEDOPTIONS-rij, `rem_late_start_date` gevuld op
alle open taken, en `driving_path_flag` ergens Y. Er gingen 32 manifestentries naar de rol `reader-only`
(met `exclusionReason`): rehab-2 (P3), S1–S10, hb-intel, stack_data_center, de vier kopieën van DCP-03
As-Built (p6Computed `unknown`: geen open taak) en de delay-analysis-revisies A/B/C. Er blijven 13
orakelentries over. Na byte- en schemadedup zijn dat 9 geselecteerde entries, met 21 projecten en 5.983
taken.

**Nieuwe stand (X12, gemeten na de herpin, kop brok 4 = C7):** **1.274** zesassige afwijkingen. Per as:
es 271, ef 280, ls 267, lf 282, tf 120, ff 54. Daarvan sameday: es 2, ef 2, ls 1, lf 13. drivingPath:
176 (was 417). De 11.529 − 1.274 = 10.255 cellen die wegvallen, zijn 8.441 uit rehab-2 en 1.814 uit de
niet-P6-bestanden. Geen enkele cel in de P6-bestanden veranderde; alleen de populatie werd kleiner.

| bestand | es | ef | ls | lf | tf | ff | totaal | drivingPath |
|---|---|---|---|---|---|---|---|---|
| Roads_Project_TEC | 195 | 197 | 178 | 178 | 49 | 14 | **811** | 0 |
| HarbourPointe_AssistedLiving | 36 | 39 | 39 | 35 | 32 | 11 | **192** | 7 |
| OZB-Start-09Dec24 (12 projecten) | 18 | 18 | 23 | 23 | 13 | 3 | **98** | 29 |
| DCP-03 Baseline Rev 0 | 20 | 22 | 4 | 4 | 22 | 20 | **92** | 7 |
| Hotel_Construction_TEC (HBTF-2 + CR) | 0 | 2 | 22 | 36 | 1 | 3 | **64** | 88 |
| Sample_Construction_TEC | 2 | 2 | 1 | 2 | 3 | 3 | **13** | 0 |
| ashspace sample | 0 | 0 | 0 | 4 | 0 | 0 | **4** | 10 |
| TERMINAL BUILDING-AIRPORT | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 35 |
| xernative sample | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 0 |

**Brokkentelling op alleen de P6-bestanden.** Elke overgebleven cel kreeg het brok uit de toewijzing van
§1 (`/tmp/x12scripts/assign.json`, cel voor cel op sleutel label|project|task_id|as). Alle 1.274 cellen
hadden een toewijzing. Kanttekening: die toewijzing is gemaakt op de stand van 15.056. Na C1–C4, C6 en
C7 kan een wortel verschoven zijn. De telling geeft dus de oorsprong aan, geen nieuwe classificatie.

| brok | es | ef | ls | lf | tf | ff | **totaal** | sameday | bestanden |
|---|---|---|---|---|---|---|---|---|---|
| B07 voltooide CP_Phys | 226 | 223 | 193 | 193 | 27 | 13 | **875** | 0 | Roads 754; HarbourPointe 67; OZB 54 |
| U2 onverklaard | 12 | 15 | 25 | 22 | 33 | 10 | **117** | 4 | HarbourPointe 82; OZB 23; Sample_Construction 12 |
| B10 startmijlpaal met targetvenster (n=1) | 20 | 22 | 0 | 0 | 18 | 15 | **75** | 1 | DCP-03 Baseline 75 |
| B09 bandgrens-weergave | 1 | 8 | 21 | 41 | 0 | 0 | **71** | 11 | Hotel 58; ashspace 4; Roads 4; OZB 2; HarbourPointe, Sample_Construction, DCP-03 1 elk |
| B08 FF naar startmijlpaal (rest na C6) | 0 | 0 | 14 | 14 | 21 | 0 | **49** | 0 | Roads 49 |
| B12 ALAP | 12 | 12 | 3 | 2 | 10 | 5 | **44** | 2 | HarbourPointe 41; Hotel 3 |
| B13 CS_MSOA | 0 | 0 | 5 | 5 | 5 | 0 | **15** | 0 | OZB 15 |
| B14 LOE zonder relaties | 0 | 0 | 4 | 3 | 4 | 0 | **11** | 0 | DCP-03 Baseline 11 |
| B15 vrije speling, overig | 0 | 0 | 0 | 0 | 0 | 11 | **11** | 0 | DCP-03 5; Hotel 3; OZB, HarbourPointe, Roads 1 elk |
| B11 actief, restart-ES (rest na C7) | 0 | 0 | 2 | 2 | 2 | 0 | **6** | 0 | OZB 3; Roads 3 |
| **som** | **271** | **280** | **267** | **282** | **120** | **54** | **1.274** | **18** | |

B01–B06 en S1–S10 zijn uit het orakel verdwenen: ze lagen alleen in rehab-2 en de synthetische
bestanden, of ze zijn opgelost (B06 door C2). drivingPath 176: P6 N / OPS J met tf exact 75, P6 J / OPS N
met tf exact 59, en tf leeg of afwijkend 42. Van die 42 zijn er 19 van Hotel-project CR (2665, niet
P6-doorgerekend, geen enkele zesassige cel). Het manifest kan niet per project uitsluiten, dus CR blijft
meetellen; dat is een vervolgpunt.

**Bouwvolgorde op de nieuwe populatie.** B07 is nu 69 % van het restant. Een eerdere naïeve poort voor
B07 gaf 216 verslechteringen, allemaal in DCP-03 As-Built. As-Built hoort sinds dit besluit niet meer bij
het orakel, dus regel A ziet die verslechteringen niet meer. Het vangnet moet dan uit een corpusloze
casus komen: voltooide CP_Drtn/FixedDrtn-taken houden hun werkelijke datums. Daarna komen U2 (117) en de
kleine brokken B09, B08, B12, B13, B14, B15 en B11. B10 (n = 1) blijft staan.

**Conventies die op rehab-2 gebouwd zijn, gemeten op de nieuwe populatie.** Per conventie is de
P6-waarde tijdelijk uitgezet (register `builtIn.p6 = false`), X12 in detail gedraaid en per cel
vergeleken. Het register is daarna teruggezet (`git diff --exit-code src` = 0).

| conventie | X12 | beter | slechter | waar |
|---|---|---|---|---|
| B1 `p6RelationFinishBoundary` | 4.366 (+3.092) | 27 (+2 dp) | 3.119 | alleen Hotel: es 942, ef 942, tf 926, ff 309 slechter; ls 9, lf 18 beter |
| B2 `p6BackwardLagFinishBoundary` | 1.383 (+109) | 0 | 109 | Hotel lf 104, ls 2, tf 2; Sample_Construction lf 1 |
| B3 `p6CompletedDataDateWindow` | 1.274 (0) | 0 | 0 | inert |
| B4 `p6CompletedLoeActualFinish` | 1.274 (0) | 0 | 0 | inert |
| B5 `p6OpenLoeTargetSpan` | 1.294 (+20) | 0 | 20 | ashspace sample ef 10, lf 10 |
| C1 `p6CompletedPredecessorAtDataDate` | 1.274 (0) | 0 | 0 | inert |
| C3 `p6CompletedRemainingLag` | 1.274 (0) | 0 | 0 | inert |
| C4 `p6CompletedOutOfSequenceWindow` | 1.274 (0) | 0 | 0 | inert |
| A17 `p6FinishMilestoneBoundaryWindow` (extra) | 1.274 (0) | 0 | 0 | inert |

B1, B2 en B5 worden gedragen door P6-doorgerekende bestanden. B3, B4, C1, C3, C4 en A17 hebben op de
nieuwe populatie geen enkel effect, in geen van beide richtingen. Wat de P6-standaard van die zes wordt,
beslist de eigenaar (overdracht §1a). Dit document kiest niet. Gevolg voor de openbare replay-pin: de
negatieve controle `drop-p6-finish-milestone-boundary` (A17) gaf op deze populatie 0 regressies. Die
rol is daarom overgegaan naar `drop-p6-relation-finish-boundary` (B1).

## 0. Totaal en meetmethode

| meting | commando | uitkomst |
|---|---|---|
| officieel detailrapport | `OPS_XER_FIDELITY_REPORT=detail bash tests/planning/run.sh check-xer-product-fidelity-x12.ts > /tmp/x12-detail.txt` | `34 entries; 47 projecten; 13982 taken; 15056 zesassige afwijkingen` |
| cellen per as/bucket | `grep -oE " (es\|ef\|ls\|lf\|tf\|ff\|drivingPath): [a-z]+;" /tmp/x12-detail.txt \| sort \| uniq -c` | es 1477+96sd, ef 1530+97sd, ls 3448+129sd, lf 3521+93sd, tf 4041, ff 624, drivingPath 417 (missing 0) |
| dump per taak (dezelfde pijplijn als X12: `readXER`→`solveProject(solveOptionsFor)`→`measureXerProductFidelity`, plus task_id/kalender/taakvelden) | `/tmp/x12scripts/dump.ts`, gebundeld zoals `run.sh` doet (`b.sh`), `node dump.mjs` | 13.982 taken; herteld: **15.056** zesassige cellen en **417** drivingPath-cellen, gelijk aan het rapport |
| XER-rijen erbij (TASK, PROJECT, SCHEDOPTIONS, CALENDAR, TASKPRED) | `python3 /tmp/x12scripts/build.py` | `cells.json` (15.473 cellen), `tasks_enriched.jsonl` |
| tegenfeiten (dezelfde solve, met een geïnjecteerde invoerwijziging) | `INJECT=<json> [ONLY=rehab-2] OUTP=<naam> node dump.mjs` + `python3 cmp.py <naam>.jsonl` | per as: beter / slechter / onveranderd |
| kalenderrekenwerk op P6's eigen datums | `/tmp/x12scripts/wm.ts` (`CalendarEngine.workMinutesBetween`) | vrije-spelingskalender (B06) en werk-as-gelijkheid (B09) |
| indeling van elke cel | `python3 /tmp/x12scripts/classify.py` → `assign.json`, `assign_dp.json`; tabellen: `python3 tables.py` | som = **15.056 + 417** |

**Hoe cellen aan een brok worden toegewezen.** Elke cel krijgt precies één brok. De eerste regel die past wint:

1. Het bestand is synthetisch (S-brokken, bewijs in §3).
2. Werk-as-gelijk: P6 en OPS noemen hetzelfde werkmoment op de taakkalender, alleen met een andere wandkloktijd (`workMinutesBetween == 0`) → **B09**.
3. Het vrije-spelingskalenderpatroon → **B06**.
4. Alleen rehab-2: een keten van tegenfeiten. Een cel hoort bij de eerste stap die haar exact maakt: B01, dan B02, dan B03.
5. De rest: **wortelattributie**. Een wortel is een afwijkende taak waarvan geen voorganger (voorwaarts) of opvolger (achterwaarts) zelf afwijkt. Elke afwijkende taak wordt toegewezen aan het soort wortel dat haar bereikt:
   - ES/EF via de voorwaartse wortels;
   - LS/LF via de achterwaartse wortels;
   - tf via de kant die afwijkt;
   - ff via de eigen ES/EF of via een afwijkende opvolger-ES;
   - anders valt de cel in "ALLEEN".

Toewijzing via wortels is een meting van de graaf, geen tegenfeit. Bij elk brok staat welke van de twee methodes gebruikt is.

## 1. Overzicht: de brokken tellen op tot het hele restant

| brok | es | ef | ls | lf | tf | ff | **totaal** | waarvan sameday |
|---|---|---|---|---|---|---|---|---|
| B01 rehab-2: zes TF-0-ankers zonder logische oorzaak | 0 | 0 | 2625 | 2625 | 2266 | 0 | **7516** | 0 |
| B02 rehab-2: voltooide voorganger met werkelijk einde ná het statusdatum-instant (= 7b-4) | 497 | 497 | 0 | 0 | 497 | 40 | **1531** | 0 |
| B03 rehab-2: resterende lag van een voltooide voorganger (achterwaarts) | 0 | 0 | 265 | 265 | 242 | 0 | **772** | 0 |
| B04 rehab-2: voltooid of actief met restduur 0, buiten volgorde (voorwaarts) | 435 | 435 | 0 | 0 | 433 | 49 | **1352** | 0 |
| B05 rehab-2: actief met restduur 0, late kant | 0 | 0 | 30 | 30 | 30 | 0 | **90** | 0 |
| B06 vrije speling op de kalender van de opvolger in plaats van de taak zelf | 0 | 0 | 0 | 0 | 0 | 362 | **362** | 0 |
| B07 voltooide CP_Phys-activiteiten (P6 zet ze op één punt: de statusdatum) | 232 | 229 | 193 | 193 | 30 | 15 | **892** | 0 |
| B08 FF-relatie naar een startmijlpaal (Roads) | 0 | 0 | 72 | 72 | 66 | 0 | **210** | 67 |
| B09 bandgrens-weergave (werk-as gelijk, wandklok anders) | 1 | 8 | 21 | 41 | 0 | 0 | **71** | 11 |
| B10 startmijlpaal met targetvenster (DCP-03, n=1) | 20 | 22 | 0 | 0 | 18 | 15 | **75** | 1 |
| B11 actieve taak: vroege start = P6-`restart_date` | 18 | 18 | 2 | 2 | 20 | 4 | **64** | 0 |
| B12 ALAP | 12 | 12 | 3 | 2 | 10 | 5 | **44** | 2 |
| B13 CS_MSOA-constraint (OZB) | 0 | 0 | 5 | 5 | 5 | 0 | **15** | 0 |
| B14 LOE zonder relaties (DCP-03) | 0 | 0 | 4 | 3 | 4 | 0 | **11** | 0 |
| B15 vrije speling, overig (relaties met lag/FF/SS) | 0 | 0 | 0 | 0 | 0 | 78 | **78** | 0 |
| S1 MER-1 (2×) | 137 | 162 | 139 | 163 | 235 | 0 | **836** | 0 |
| S2 groupdocs | 70 | 70 | 70 | 70 | 0 | 0 | **280** | 280 |
| S3 ProjectLens (5×) | 90 | 94 | 0 | 0 | 96 | 0 | **280** | 48 |
| S4 gimmer-crag | 6 | 0 | 71 | 69 | 0 | 0 | **146** | 0 |
| S5 meridianiq (2×) | 10 | 16 | 24 | 28 | 15 | 9 | **102** | 0 |
| S6 p6diff (3×) | 12 | 13 | 15 | 16 | 12 | 3 | **71** | 0 |
| S7 P6-Viewer sample | 9 | 11 | 11 | 2 | 1 | 7 | **41** | 0 |
| S8 delay-analysis revA/B/C | 3 | 13 | 0 | 0 | 10 | 0 | **26** | 0 |
| S9 planning-risk-intelligent | 0 | 3 | 1 | 5 | 4 | 3 | **16** | 2 |
| S10 APEX (schedulevisualiser, stack_data_center) | 1 | 1 | 1 | 1 | 6 | 6 | **16** | 0 |
| U1 onverklaard in rehab-2 | 8 | 8 | 0 | 0 | 8 | 18 | **42** | 0 |
| U2 onverklaard in HarbourPointe (82), OZB (23) en Sample_Construction (12) | 12 | 15 | 25 | 22 | 33 | 10 | **117** | 4 |
| **som** | **1573** | **1627** | **3577** | **3614** | **4041** | **624** | **15056** | **415** |

**drivingPath (417):**

| deel | inhoud | cellen |
|---|---|---|
| E1 | echt bestand, P6 N / OPS J, tf exact | 161 |
| E2 | echt bestand, P6 J / OPS N, tf exact | 59 |
| E3 | echt bestand, tf leeg of afwijkend | 42 |
| E4 | synthetisch bestand | 155 |
| | **som** | **417** |

Commando: `python3 tables.py`.

**Waar de voorbeeldgroepen uit de opdracht terechtkomen:**

- **(a) Projecteinde-anker: 0 cellen in X12.**
  - Alle 18 projecten met `sched_use_project_end_date_for_float=Y` hebben in OPS `endDate = scd_end_date`. Er valt er geen terug op de projectstart (dump `*.projects.jsonl`).
  - Tegenfeit met de optie overal uit (`inj_upe.json`): 0 beter, 296 slechter (ls 105, lf 105, tf 83, es/ef/ff 1), drivingPath 41 beter.
  - De "36 van 39 rijen" uit de goal prompt komen dus uit de verified-cases-check (`cases-import.xer`, plan §9), niet uit dit corpus.
- **(b) 7b-4 = B02: 1.531 cellen.** Dat is meer dan de ≤ 690 uit het dossier, omdat tf en ff meetellen. Alle vijf de gevolgde taken uit het dossier (V3109400, V3109300, V3109420, V3109220, V3109480) worden in dit tegenfeit exact op ES, EF en tf.
- **(c) De 215 tf-cellen TK_Complete/DT_FixedDUR2 met P6 tf 0:** 214 vallen in **B01**, 1 in B04. Ze staan stroomafwaarts van de zes ankers en worden exact zodra die vastgezet zijn.
- **(d) sameday (415):**

  | brok | cellen |
  |---|---|
  | S2 groupdocs | 280 |
  | B08 | 67 |
  | S3 (northstar-/riverside-previous, 24 elk) | 48 |
  | B09 | 11 |
  | U2 (Sample_Construction, :01/:59-minuten) | 4 |
  | B12 | 2 |
  | S9 | 2 |
  | B10 | 1 |

  Sameday is dus geen oorzaak maar een symptoom van meerdere brokken.
- **(e) drivingPath (417):** zie E1–E4 in §4.

## 2. De bouwbare brokken, per brok

### B01 · rehab-2: zes TF-0-ankers zonder zichtbare oorzaak: 7.516 cellen (ls 2625 / lf 2625 / tf 2266)

- **Signatuur.** De zes taken V3114490, V3118490, V3120490, V3154490, V3163490 en V3227490 hebben veel gemeen: alle `TT_Task`, `TK_NotStart`, `DT_FixedDUR2`, kalender 842, resource 2344 en dezelfde taaknaam. Elk heeft een FS0-relatie naar de eindmijlpaal V000040 (LS 2010-05-02); vier hebben daarnaast een ketenopvolger met een P6-LS die maanden later ligt.
  - P6 geeft ze TF = 0 en LS = ES / LF = EF.
  - Drie hebben tegelijk FF > TF (72 h, 1.152 h, 1.856 h). Dat kan niet uit één CPM-achterwaartse doorgang met deze relaties komen.
  - De strakheidstoets (`req_tight.json`): van de 4.138 niet-voltooide rehab-2-taken met alleen FS0-opvolgers hebben er maar **4** werktijd tussen de eigen LF en de LS van de opvolger. Alle vier horen bij deze zes (de andere twee hebben een SS-opvolger).
- **Meting (tegenfeit `inj490.json`).** Zet de LF van deze zes vast met FNLT = P6-LF: **7.516 cellen worden exact, 0 zesassige cellen slechter**, 167 drivingPath-cellen slechter.
- **Wortelattributie.** Alle 2.920 foute LS/LF-taken van rehab-2 hebben een keten naar 21 wortels. De zes x490-taken zijn goed voor 302 tot 1.032 bereikte taken elk; de overige 15 zijn voltooide of actieve taken die in B03/B05 terugkomen.
- **Hypothese: niet af te leiden uit het bestand.** Geen standaard P6-planningsoptie maakt een activiteit mét opvolgers TF 0 met FF > 0 zonder constraint, en het bestand draagt geen constraint (`cstr_type` leeg) en geen externe datums. Twee kandidaten, geen van beide aantoonbaar:
  - (i) relaties die de splitter weggooide. Daartegen pleit dat `task_pred_id` aaneengesloten loopt van 72750 tot 83479 (precies 10.730 rijen, geen gaten).
  - (ii) een constraint die bij een import verloren ging, bijvoorbeeld P3-"zero total float". Voor een import pleit dat alle taken dezelfde `create_date` hebben (2010-05-05, admin).
- **Gevolg van een fix.** Een motorregel is niet te bouwen zonder het orakel als invoer te gebruiken. Dat is verboden: "opgeslagen uitvoer is meetlat, nooit invoer".
- **Advies.** Volgens regel 4 van de goal prompt hoort dit als open vraag in plan §9. De helft van het X12-restant hangt aan deze zes taken. Het nuldoel op rehab-2 is zonder eigenaarsbesluit dus niet haalbaar.

### B02 · rehab-2: werkelijk einde ná het statusdatum-instant (dossier 7b-4): 1.531 cellen (es 497 / ef 497 / tf 497 / ff 40)

- **Signatuur.** Vijf wortels, alle `TK_Complete`: V3209120, V3227100, V3247140, V3248140 en V3265140. Hun `act_end_date` is 2008-05-27 17:00, terwijl de statusdatum 2008-05-27 00:00 is.
  - P6 laat de opvolger starten op 05-27 08:00, OPS pas ná het werkelijke einde (05-28 08:00).
  - Het effect loopt via FS0-ketens 1–2 werkdagen naar rechts door. Dat is precies het 7b-4-patroon.
- **Meting (tegenfeit `inj490_f2.json`, bovenop B01).** Werkelijk einde van die vijf → 2008-05-26T17:00: **+1.532 / −1** (1 ff). De dossiertaak V3109400 gaat van ES 12-06 naar 12-04, gelijk aan P6.
- **Hypothese.** P6 behandelt een relatie vanuit een voltooide voorganger als voldaan op de statusdatum; een werkelijk einde ná de statusdatum schuift de opvolger niet op. Bron: gedrag in het corpus. In de P6-documentatie is de statusdatum het vroegste moment waarop restwerk gepland wordt.
- **Verwacht effect.** De 1.531 cellen hierboven.
- **Risico.** Buiten rehab-2 zijn er vier voltooide taken met een werkelijk einde ná de statusdatum, alle vier nu exact:
  - DCP-03 **As-Built** H-5030 en H-5040 (dat bestand heeft nu 0 afwijkingen);
  - planning-risk A1020 en A1030.
- **Waar in de motor.** De voorwaartse relatiegrens vanaf voltooide voorgangers (`relationRules`/`CPMSolver`, voorwaartse doorgang).

### B03 · rehab-2: resterende lag van een voltooide voorganger, achterwaarts: 772 cellen (ls 265 / lf 265 / tf 242)

- **Signatuur.** Een voltooide voorganger (of een actieve met restduur 0) met een gelagde opvolger.
  - Voorbeeld volledig verstreken lag: V3122120 → V3122070, FS+168 h, werkelijk einde 04-15. P6 zet LF = LS(opvolger) − 0; OPS trekt de volle 21 werkdagen af.
  - Voorbeeld niet verstreken lag: V3238110, werkelijk einde 05-26 17:00, FS+120 h. P6 trekt de volle lag af.
  - Voorbeeld deels verstreken: V3120120. P6-LF 06-25, precies tussen de twee gevallen in.
- **Meting.**
  - Tegenfeit `inj_b1.json` (lag = 0 op 348 relaties vanuit voltooide of rest-0-voorgangers): **+724 / −34**. De −34 komen doordat lag = 0 ook de voorwaartse kant raakt; een fix die alleen achterwaarts werkt, heeft dat niet.
  - De overige 48 cellen (wortels V3120120, V3238110, V3245120) zijn via wortelattributie toegewezen; daar is de lag maar deels verstreken.
- **Hypothese.** Resterende lag = max(0, lag − werktijd(werkelijk einde → statusdatum)), gebruikt in de achterwaartse doorgang. Dit is hetzelfde begrip als bij B02. Een bouwagent kan B02 en B03 als één P6-regel formuleren, maar moet ze voor regel A in twee fixes landen.
- **Risico.** Gelagde relaties vanuit voltooide voorgangers bestaan ook in HarbourPointe (5) en Roads (6).

### B04 · rehab-2: voltooid of actief-rest-0 met een onvoltooide voorganger (out-of-sequence), voorwaarts: 1.352 cellen (es 435 / ef 435 / tf 433 / ff 49)

- **Signatuur.** 29 voorwaartse wortels, alle `TK_Complete` of `TK_Active` met `remain_drtn_hr_cnt=0` en minstens één niet-voltooide voorganger. Voorbeelden:
  - V3258180: voorganger V3264180 is actief, FS+240 h. P6 zet het venster op 07-05/07-03, OPS op de statusdatum 05-27.
  - V3235065: voorganger V3221080 is niet gestart. P6 zet ES op 06-07.
  - 435 taken worden in de toestand ná B01–B03 uitsluitend door deze wortels bereikt (`ffront.py`, `CF=cfb1.jsonl`).
- **Hypothese.** P6 legt het nul-restvenster van een voltooide activiteit ná de EF (+ lag) van onvoltooide voorgangers, niet op de statusdatum: retained logic geldt ook voor rest = 0. Getoetst op 5 van de 29 wortels.
- **Niet met een tegenfeit gemeten.** Een SNET-injectie op voltooide taken wordt door de motor genegeerd: 0 verandering.
- **Risico.** Out-of-sequence voltooide taken bestaan verder alleen in Roads (8, waarvan er 7 nu fout staan; die vallen in B07) en in meridianiq/sample_update2 (1, nu exact).

### B05 · rehab-2: actief met restduur 0, late kant: 90 cellen (ls/lf/tf 30 elk)

- **Signatuur.** Vier wortels: V3204155, V3166145, V3260190 en V3259190. P6 zet LS/LF als nul-venster vlak vóór de LS van de opvolger; OPS gebruikt een venster vanaf de werkelijke start.
- **Hypothese.** Een actieve taak met restduur 0 volgt aan de late kant de regel voor voltooide taken (`p6CompletedLateFromRemainingWindow`).
- **Risico.** Actief-rest-0 elders: Roads 5 (3 nu exact).

### B06 · vrije speling op de kalender van de opvolger in plaats van de taak zelf: 362 ff-cellen

Verdeling: Hotel 182, rehab-2 167, Roads 12, DCP-03 Baseline 1.

- **Signatuur, rekenkundig bewezen.** Alleen FS0-opvolgers. Op P6's eigen datums geldt:
  - P6-FF = `workMinutesBetween(EF, min opvolger-ES)` op de **kalender van de taak**;
  - OPS-FF = dezelfde grootheid op de **kalender van de opvolger** (in alle 362 gevallen verschillen de twee kalenders; `req_ff.json`/`wm_ff.json`);
  - in rehab-2: taak op kalender 893, opvolger op 842.
- **Hypothese.** P6 drukt speling uit in de kalender van de activiteit zelf.
- **Risico.** Onder de nu exacte ff-cellen met gemengde kalenders en FS0:
  - de 2 niet-voltooide gevallen (Hotel 1, OZB 1) zijn al gelijk aan de waarde op de eigen kalender en blijven exact;
  - de 43 voltooide rehab-2-gevallen (plus 3 in DCP-03) hebben P6-FF 0 en vallen onder de regel voor voltooide taken.

  Beperk de fix daarom tot niet-voltooide taken. Verwacht effect: 362 cellen, en mogelijk een deel van B15.

### B07 · voltooide CP_Phys-activiteiten: 892 cellen

Verdeling: Roads 771, HarbourPointe 67, OZB 54.

- **Signatuur.**
  - In Roads, HarbourPointe en OZB zet P6 elke voltooide CP_Phys-taak op **ES = EF = precies de statusdatum**, niet gesnapt: bij Roads 2013-04-23T00:00. Dat geldt voor 134 + 18 + 14 taken.
  - LS = LF is één punt vóór de LS van de opvolger.
  - OPS toont de werkelijke datums. De poort in `p6CompletedTargetWindow.ts` wijst CP_Phys af (`wrongCompletePctType`) en ook `DT_FixedDrtn`.
  - Stroomafwaarts: bij Roads bereikt de voltooide startmijlpaal A1 190 taken, omdat de lags van de opvolgers bij P6 vanaf de statusdatum tellen.
- **Meting.**
  - Tegenfeit `inj_cphys.json` (poort openzetten door de taken als CP_Drtn/FixedDUR2 te labelen): **+320** (Roads 292, HarbourPointe 17, OZB 11) en **−216**, allemaal in DCP-03 **As-Built**. Dat bestand heeft CP_Drtn/DT_FixedDrtn-taken waarvoor P6 de werkelijke datums houdt (61/61).
  - Een ES = EF = statusdatum-regel is dus een **aparte CP_Phys-tak**, geen verbreding van de CP_Drtn-poort.
- **Bron.** Gedrag in het corpus. Het docblok in `p6CompletedTargetWindow.ts` noemt de CP_Phys-proeven al ("acht P6-statuspunten en twee ontbrekende orakels"; in mijn telling zijn het er 3, alle drie in OZB met een leeg orakel).

### B08 · FF-relatie naar een startmijlpaal (Roads): 210 cellen (ls 72 / lf 72 / tf 66; 67 sameday)

- **Signatuur.** Wortels OCEC11971, 11851, 18821, 11911 en 18751, elk met `PR_FF 0` naar OCEC12101. Dat is een `TT_Mile` met ES 2014-01-15 07:00 en LS/LF 16:00. P6 zet de LF van de voorganger op 16:00, OPS op 07:00.
- **Hypothese.** P6 bindt de FF-relatie aan de LF van de startmijlpaal (einde van de dag); OPS gebruikt de startgrens.
- **Risico.** FF-relaties naar een `TT_Mile` elders: alleen Roads (7 fout, 1 exact). Naar een `TT_FinMile` (27 + 4 + 2 + 1, bijna allemaal exact) moet de fix niet aan komen.

### B09 · bandgrens-weergave: 71 cellen (11 sameday)

Verdeling: Hotel 58, ashspace 4, Roads 4, OZB 2, HarbourPointe 1, Sample_Construction 1, DCP-03 1.

- **Signatuur.** Tussen de OPS-waarde en de P6-waarde ligt 0 werkminuten op de taakkalender (`req_eq.json`). Voorbeelden:
  - Hotel: LS op kalender 3196, P6 08:00 de volgende dag, OPS 17:00 de dag ervoor;
  - Hotel: LF op kalender 3195 (eindigt 16:00), P6 16:00, OPS 17:00;
  - ashspace: LF via FF0 naar een FinMile, P6 16:00, OPS 08:00 de volgende dag.
- **Hypothese.** P6 toont een start als het begin van de volgende werkband en een finish als het einde van de vorige, op de **eigen** kalender. De OPS-waarde komt bij gemengde kalenders van de buur en wordt niet opnieuw gesnapt.
- **Risico: hoog.** Dit raakt alle datumuitvoer. Houd de fix beperkt tot "opnieuw snappen naar de eigen kalender als de waarde van een andere kalender komt".

### B10 · DCP-03 Baseline: startmijlpaal E-1000 met targetvenster 08:00–17:00: 75 cellen

- **Signatuur.** P6-EF = 17:00 (= `target_end_date`); OPS-EF = 08:00. De cascade raakt 22 taken.
- **Zwak: n = 1.** Dit is de enige `TT_Mile`/`TK_NotStart` met `target_start ≠ target_end` in 15 bestanden. Alle andere startmijlpalen hebben EF = ES en staan exact. Er is geen bron; kans op overfitten. Bouw dit pas als een tweede bestand het bevestigt.

### B11 · actieve taak: vroege start = P6 `restart_date`: 64 cellen (OZB 61, Roads 3)

- **Signatuur.** OZ1040: `TK_Active` met `restart_date` 2024-12-24 12:00. P6-ES is gelijk aan die restart; OPS gebruikt `target_start` 12-30 08:00.
- **Hoort bij** het §9-dossier over `rem_target_link_flag` en de vroege start van lopende taken.
- **Hypothese.** De resterende vroege start van een lopende taak volgt uit de statusdatum en de voorgangers (P6 bewaart die als `restart_date`), niet uit het targetvenster.

### B12 · ALAP: 44 cellen (HarbourPointe 41, Hotel 3)

- **Signatuur.** EC1420 is een startmijlpaal met `CS_ALAP`. P6-ES = 2011-06-24T16:49; OPS = 06-27 07:00 (het targetvenster).
- **Opmerking.** HarbourPointe rekent met afwijkende minuutbanden (16:49, 10:40).
- **Hypothese.** P6 legt ALAP-datums anders op de kalender dan de OPS-verschuiving "vrije speling = 0" (`CPMSolver`, ALAP-blok).

### B13 · CS_MSOA (OZB): 15 cellen

Achterwaartse wortels onder OZ1060 met een `CS_MSOA`-constraint.

### B14 · LOE zonder relaties (DCP-03 Baseline): 11 cellen

Z-9000 en Z-9010: P6 spant het targetvenster met een late kant tot het projecteinde; OPS geeft nul lengte op de statusdatum. `p6OpenLoeTargetSpan` grijpt hier niet.

### B15 · vrije speling, overig: 78 cellen

Verdeling: Hotel 65, Roads 6, DCP-03 5, OZB 1, HarbourPointe 1.

- **Signatuur.** Alleen ff fout. Het gaat om opvolgers met lag, FF of SS, vooral Hotel-FinMiles met gelagde FS-opvolgers; OPS-FF ligt 1 tot 140 uur lager.
- **Hypothese.** Hetzelfde als B06, maar met lag erbij. Niet rekenkundig getoetst.

## 3. Synthetische bestanden: 1.814 cellen

Bij deze bestanden is het orakel aantoonbaar niet door P6 op de gegeven invoer berekend.

- **Wat een fix hier zou betekenen.** Het generatorgedrag nabootsen, en dat past niet bij het P6-profiel.
- **Wat er nodig is.** Een eigenaarsbesluit: manifest, orakelstatus. Dat besluit neem ik niet.

| brok | bestand(en) | bewijs uit de kop en interne tegenspraak |
|---|---|---|
| S1 | MER-1 epc + update (836) | kop "MERIDIAN EPC"; geen CALENDAR-tabel; `status_code` leeg; geen duurvelden, dus de motor ziet duur 0; late = vroege datums voor 120/120 terwijl tf ≠ 0 voor 104 (intern tegenstrijdig) |
| S2 | groupdocs (280, alle sameday) | geen TASKPRED; es = ef = ls = lf = 2019-05-31T00:00 voor alle 70 taken |
| S3 | ProjectLens × 5 (280) | kop "ProjectLens synthetic evidence"; ls/lf niet meetbaar; alle datums om 00:00 |
| S4 | gimmer-crag (146) | kop "nPlan GraphGen v2"; late = vroege datums 93/93; 37 van 92 FS0-taken zijn niet strak (LF ligt vóór de LS van de opvolger) |
| S5 | meridianiq × 2 (102) | kop `yyyy-mm-dd` letterlijk |
| S6 | p6diff × 3 (71) | late = vroege datums 8/8, tf ≠ 0 voor 2 |
| S7 | P6-Viewer sample (41) | kop "Sample XER Export"; EF vóór ES (M001: ES 03-15, EF 02-21) |
| S8 | revA/B/C (26) | 1 relatie; ls/lf niet meetbaar |
| S9 | planning-risk (16) | kop "Planning Risk Demo" |
| S10 | schedulevisualiser + stack_data_center (16) | kop "APEX"/"StackDC-BaselineGolden"; stack heeft geen CALENDAR |

Commando's: kopregels en tabelgroottes via `xer.py` in de lus in §0; consistentie via het inline script "INCONS" (zie `/tmp/x12scripts`).

## 4. drivingPath: 417 cellen (rapportage-as)

| deel | cellen | verdeling | wat er aan de hand is |
|---|---|---|---|
| E1: P6 N / OPS J, tf exact | 161 | rehab-2 86, Hotel 67, OZB 8 | OPS vlagt TF = 0; P6 vlagt niet |
| E2: P6 J / OPS N, tf exact | 59 | TERMINAL 35 (TF 480 door `plan_end_date`), ashspace-LOE 10, OZB 12, Hotel 2 | P6 vlagt ondanks positieve float |
| E3: echt, tf leeg of afwijkend | 42 | | volgt uit de brokken hierboven |
| E4: synthetisch | 155 | | zie §3 |

**Hypothese.** P6's `driving_path_flag` is het **longest path**: de keten van sturende relaties terug vanaf het projecteinde. Het is niet "TF ≤ 0".

Bewijs:

- de B01-taken hebben TF 0 en toch vlag N;
- TERMINAL vlagt het longest path bij een TF van 480;
- B01 vastzetten maakt drivingPath 167 slechter;
- de projecteinde-optie uitzetten maakt drivingPath 41 beter.

**Fix.** Een aparte uitvoer "longest path" naast `isCritical`, zonder dat datums veranderen. Dat maakt ten hoogste 220 echte en 114 synthetische tf-exacte cellen exact.

## 5. Onverklaard: 159 cellen, met kenmerken

- **U1 · rehab-2 (42).**
  - Voorwaartse wortels V3143175, V3163170, V3166100, V3166110, V3251175, V3261400, V3245070 en V3120070 (NotStart/Active): ES 1 dag later of juist eerder.
  - Daarnaast 8 ff-only-cellen (NotStart, 842/842, OPS-FF > P6).
- **U2 · HarbourPointe (82).** Late kant rond FS0-relaties naar FinMiles (EC2410, EC2060, EC2380): P6-LS ligt 1–10 dagen later. Kalenders met minuutbanden (16:49, 10:40).
- **U2 · OZB (23).** OZ1090 +1 dag, OZ1100 en OZ1060 1–2 dagen.
- **U2 · Sample_Construction (12).** SF/SS/FF-kruisrelaties met P6-minuutverschuivingen (08:01, 15:59); daarvan 4 sameday.

## 6. Bouwvolgorde: cellen per eenheid werk

Een eenheid is mijn schatting: 1 = één regel in de motor met een duidelijke poort.

| # | brok | cellen | eenheden | cellen/eenheid | zekerheid | andere bestanden die dezelfde code raken |
|---|---|---|---|---|---|---|
| 1 | B02 AF ná statusdatum | 1.531 | 1 | 1.531 | tegenfeit +1.532/−1 | As-Built H-5030/5040, planning-risk A1020/1030 (nu exact) |
| 2 | B03 resterende lag, achterwaarts | 772 | 1 | 772 | tegenfeit (benadering) +724/−34, plus 48 via wortels | HarbourPointe 5 en Roads 6 gelagde relaties |
| 3 | B04 out-of-sequence nul-venster | 1.352 | 2 | 676 | wortelattributie, 5/29 wortels nagerekend | Roads 8 (onder B07), meridianiq 1 |
| 4 | B07 CP_Phys voltooid = punt op statusdatum | 892 | 2 | 446 | signatuur 166/189 exact; naïeve poort +320/−216 | As-Built (CP_Drtn/FixedDrtn moet werkelijke datums houden) |
| 5 | B06 FF op de eigen kalender | 362 | 1 | 362 | rekenkundig op P6-datums | 0 nu exacte niet-voltooide cellen veranderen |
| 6 | B08 FF naar startmijlpaal | 210 | 1 | 210 | wortelattributie | Roads 1 exacte FF→TT_Mile |
| 7 | B05 actief rest-0, late kant | 90 | 1 | 90 | wortelattributie | Roads 5 |
| 8 | B15 FF met lag/FF/SS | 78 | 1,5 | 52 | niet getoetst | als B06 |
| 9 | B09 bandgrens-weergave | 71 | 1,5 | 47 | werk-as-gelijkheid bewezen | alle bestanden (breed) |
| 10 | B11 restart-ES actief | 64 | 1,5 | 43 | 1 wortel bekeken | §9-dossier `rem_target_link` |
| 11 | B12 ALAP | 44 | 1,5 | 29 | 1 wortel bekeken | ALAP-blok, `CPMSolver` |
| 12 | B13, B14 | 26 | 2 | 13 | wortelattributie | — |
| — | B10 startmijlpaal met targetvenster | 75 | 1 | — | n = 1, niet bouwen | — |
| — | **B01** zes ankers | **7.516** | onderzoek | — | tegenfeit 7.516/0, geen P6-regel bekend | escaleren naar plan §9 |
| — | S1–S10 synthetisch | 1.814 | eigenaarsbesluit | — | bewijs per bestand | — |
| — | E drivingPath | 417 | 1–2 (longest path) | — | hypothese met 4 bewijzen | alleen uitvoer |
| — | U1/U2 onverklaard | 159 | — | — | — | — |

**Kanttekeningen voor de bouwagent.**

1. **Volgorde telt.** B02 en B03 zijn gemeten bovenop het vastgezette B01. Zonder B01 maakt B02 dezelfde ES/EF-cellen exact, maar blijven hun LS/LF-cellen fout: die horen bij B01.
2. **Regel A.** Regel A verbiedt ook één verslechtering. Bij B02 is dat 1 ff-cel, bij B07 met de naïeve poort 216 cellen in As-Built. Beide moeten opgelost zijn voordat een wijziging landt.
3. **Toets per wortel.** De wortelattributie (B04, B05, B08, …) geeft het verwachte maximum. Toets per fix of de wortel echt de enige oorzaak is.
4. **Het nuldoel.** Zonder een besluit over B01 (7.516) en S1–S10 (1.814) is 0 op het volledige corpus niet haalbaar met P6-regels die uit de bestanden af te leiden zijn. Samen is dat 62% van het restant.
