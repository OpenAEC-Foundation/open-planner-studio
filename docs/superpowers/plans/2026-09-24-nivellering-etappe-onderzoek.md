# P6-resource-nivellering als eigen etappe: voorbereiding met OZB 9033 als casus (onderzoek)

**In gewone taal.** P6 heeft in project 9033 de projectmanager (PM-1) zo ingepland dat hij nooit twee
taken tegelijk doet. Daardoor schuiven zes taken naar achteren, en P6 heeft daarna ook de late datums
opnieuw uitgerekend. Met een eenvoudig model van P6's nivelleerregels komen we op alle 84 datum- en
spelingswaarden van 9033 precies uit. Het bestand zegt alleen niet óf P6 genivelleerd heeft: drie
andere projecten in hetzelfde bestand hebben exact dezelfde instellingen en zijn níét genivelleerd.
Nivellering kan dus geen automatische vlag uit de XER worden. Het wordt een instelling die de gebruiker
(of, voor de meting, het manifest) aanzet, met een eigen tweede pas ná de CPM in `solveProject`.

Model: Claude Opus 5.5 (uitvoerder-opus-midden). Basis: `d981ed33` (branch `claude/x12-nivellering-onderzoek`).
Alleen onderzoek: `src/` is niet gewijzigd. Meetinstrumenten: een los Python-model van P6's nivellering
op dagniveau (`/tmp/lvl/sim.py`, `run2.py`, `run3.py`; alle 9033-taken hebben hele dagen van 8 uur en
starten om 08:00, dus dagniveau is hier exact) en een esbuild-script (`/tmp/lvl/ops.ts`) dat onze eigen
`levelResources` op 9033 draait. Die scripts staan in `/tmp` en zijn dus niet blijvend; de werkwijze staat
hieronder volledig beschreven. Vorige stand: `2026-09-24-x12-restant-onderzoek-284.md` §2a (de nabootsing met
drie FS-relaties: OZB 42 → 6). Eigenaarsbesluit van vandaag: 9033 gaat uit het X12-orakel en nivellering
wordt een eigen etappe ná het nuldoel.

**Plan-noot — fundament gelegd (2026-09-24, branch `claude/x12-nivellering-fundament`).** Stap 1 van §7 is
gebouwd als pure data, zonder motorstap en zonder effect op X12: projectoptie `schedulingOptions.leveling`,
XER-lezer, IFC-round-trip, MCP alleen-lezen en het manifestmechanisme `leveledProjects` (zonder data). Details
en metingen in §9.

## Uitkomst in één tabel

| vraag | antwoord | status |
|---|---|---|
| (1) wat staat er in het bestand | SCHEDOPTIONS `level_*` + `LevelPriorityList`, RSRCLEVELLIST (alleen PM-1), RSRCRATE `max_qty_per_hr = 1`; **geen** veld "Level resources during scheduling" | BEVESTIGD (alle 16 SCHEDOPTIONS-koppen in het corpus) |
| … zegt het bestand óf er genivelleerd is? | **nee**: 9045/9047/9049 hebben dezelfde instellingen en dezelfde PM-1-lijst, maar in P6's datums lopen daar OZ1060 en OZ1100 tegelijk op PM-1 (6 overbelaste resourcedagen) | BEVESTIGD |
| (2) welke taken schoof P6 | OZ1060 (+2 wd), OZ1100 (+8), OZ1090/1110/1120 (+3), en via logica OZ1070/1080 (+2), OZ1130 (+2) | BEVESTIGD (CPM zonder nivellering vs P6) |
| … welke prioriteitsregel | tijdgestuurd (per moment: wie is klaar om te beginnen) + Early Start oplopend + Activity ID als laatste scheidsrechter: **14/14** ES/EF, 8/8 PM-1-taken. Tijdgestuurd reproduceert met 10 van de 12 geteste regels; serieel alleen met ES of EF | BEVESTIGD voor 9033; welke tie-break precies is met n = 1 niet te onderscheiden |
| (3) achterwaarts | P6 herrekent de late datums **met behoud van de genivelleerde PM-1-volgorde**: 14/14 LS/LF. Een zelfstandige achterwaartse nivellering op de ongenivelleerde LF gaat mis (12/14) | BEVESTIGD voor 9033 (twee modellen gelijkwaardig) |
| … speling | TF = LF − EF op de genivelleerde datums; FF alleen tegen **logische** opvolgers: 14/14 TF, 14/14 FF | BEVESTIGD |
| onze `levelResources` op 9033 | 9/14 ES (P6-profiel) en 5/14 (A16 uit): serieel met TF voorop kiest anders dan P6 | BEVESTIGD (gemeten, §4) |
| (4) past het als conventie? | nee, niet als één vlag. De **aan/uit** is een projectoptie (default uit in elk profiel), de **parameters** zijn projectopties uit SCHEDOPTIONS, en de **manier** waarop P6 nivelleert (tijdgestuurd, late pas met behoud van volgorde, FF alleen logisch) is een set conventies | voorstel |
| … meetlat | manifest krijgt per project `leveled: true` (menselijke herkomstclassificatie, geen lezerafleiding); de meting zet voor precies die projecten de optie aan; 9033 komt terug met doel 0 | voorstel, eigenaarsbesluit |

---

## 1. Bronnen (Oracle, P6 Professional 26 / EPPM 24)

- *Leveling resources* (https://docs.oracle.com/cd/G48902_01/client_help/en_US/leveling_resources.htm, idem v24
  `cd/F88968_01/English/User_Guides/p6_pro_user/leveling_resources.htm`): *"Typically, you level during the
  forward pass through a project. This determines the earliest dates to schedule an activity when sufficient
  resources will be available to perform the task. If forward leveling delays the project's early finish date,
  late dates remain unchanged unless you clear the checkbox to preserve scheduled early and late dates in the
  Level Resources dialog box. In this case, a backward pass recalculates late dates."* En: *"The maximum amount
  of work that a resource is capable of doing for a given timeperiod is defined by the resource's Max Units/Time
  value"*, *"Resource curves are not used when leveling"*.
- *Leveling priority definitions* (`…/leveling_priority_definitions.htm`): *"If two activities from different
  chains are ready for leveling, P6 Professional chooses one using the priorities you specify in the Leveling
  Priorities area of the Level Resources dialog box. Then, it sorts numbers first, then alphabetic characters,
  followed by blank values. If you specify no prioritization codes, P6 Professional sorts by activity ID."*
  Plus de tabel met 14 sleutels (Activity ID, Activity Priority, Early Finish, Early Start, Free Float, Late
  Finish, Late Start, Original/Planned Duration, Planned Finish, Project Planned Start, Project Priority,
  Remaining Duration, Total Float), elk oplopend of aflopend.
- *Specify leveling priorities*: *"A priority within the table takes precedence over any priorities below it."*
- *Level resources automatically* (`…/level_resources_automatically_2.htm`): *"Mark the Automatically Level
  Resources When Scheduling checkbox to automatically level resources each time you schedule a project."*
- *Limit resource leveling*: *"Mark the Level Resources Only Within Activity Total Float checkbox to delay
  activities with resource conflicts only up to their late dates … In the Max Percent to Overallocate Resources
  field, specify the maximum percentage by which resource availability can be increased. This increased
  resource availability is used for leveling if resources assigned to an activity cannot be leveled after using
  the activity's float limit."* Het overallocatiepercentage werkt dus alleen samen met "binnen float".
- *Level resources*: *"Mark the Consider Assignments in Other Projects With Priority Equal/Higher Than checkbox
  … to consider other project assignments when determining whether a resource is overallocated."* En: *"A
  Resource assigned to a suspended activity is considered available … until the resume date."*
- *Leveling resources on Task, Resource Dependent, and WBS summary activities*: een Task Dependent-activiteit
  wordt pas geplaatst als **alle** toegewezen resources beschikbaar zijn; WBS Summary wordt genegeerd.
- EPPM-dialoog (https://docs.oracle.com/cd/F88966_01/p6help/en/91573.htm): *"Preserve minimum activity float —
  The minimum amount of total float time expressed in hours that you want to maintain for each activity during
  leveling"*, *"Recalculate assignment costs when leveling"*.

Wat Oracle **niet** beschrijft: of het algoritme tijdgestuurd of serieel werkt, hoe de achterwaartse pas met
resources omgaat (alleen "a backward pass recalculates late dates"), en hoe de vrije speling na nivellering
wordt gemeten. Die drie volgen hieronder uit 9033 (n = 1).

## 2. Wat staat er in het bestand

### 2a. De instellingen van 9033

| tabel.veld | waarde in 9033 | betekenis (dialoog Level Resources) | waarde in de andere 11 OZB-projecten en alle overige orakels |
|---|---|---|---|
| SCHEDOPTIONS.`level_keep_sched_date_flag` | **N** | Preserve scheduled early and late dates: uit ⇒ late datums worden herrekend | Y |
| SCHEDOPTIONS.`level_all_rsrc_flag` | **N** | Level all resources: uit ⇒ lijst in RSRCLEVELLIST | Y |
| RSRCLEVELLIST (`schedoptions_id` 8) | **rsrc_id 6900 = PM-1** | Select resources | leeg |
| SCHEDOPTIONS.`LevelPriorityList` | **`early_start_date,/ASC`** | Leveling priorities: Early Start oplopend | `priority_type,ASC_BY_FIELD/ASC` of `priority_type,ASC` (= Activity Priority, de default) |
| SCHEDOPTIONS.`level_within_float_flag` | N | Level resources only within activity Total Float | N |
| SCHEDOPTIONS.`level_float_thrs_cnt` | 0 | Preserve minimum float | 0 |
| SCHEDOPTIONS.`level_over_alloc_pct` | 25 | Max percent to over-allocate (alleen bij "binnen float") | 25 |
| SCHEDOPTIONS.`level_outer_assign_flag` / `_priority` | N / 5 | Consider assignments in other projects | N / 5 |
| RSRCRATE PM-1 (`rsrc_id` 6900) | `max_qty_per_hr = 1` | Max Units/Time | – |
| RSRC PM-1 | `clndr_id` 178 (Corporate Standard, zonder feestdagen in 2024/25) | resourcekalender | – |
| TASK.`priority_type` | PT_Normal op alle 14 taken | Activity Leveling Priority | – |
| TASKRSRC PM-1 | 8 toewijzingen, alle `qty_per_hr = 1`, geen curve, geen lag | – | – |

Er is **geen** kolom voor "Automatically Level Resources When Scheduling". Alle 16 corpusbestanden met een volledige
SCHEDOPTIONS-kop hebben dezelfde 27 kolommen (gemeten over het hele corpus). Onze lezer markeert de acht `level_*`-kolommen
nu als `ignored` (`xerScheduleOptions.ts:66–73`, reden "De CPM-solver voert geen resource-nivellering uit") en
leest RSRCLEVELLIST helemaal niet.

### 2b. Zegt het bestand óf er genivelleerd is? Nee

Indicator: tel de dagen waarop een resource op P6's eigen resterende toewijzingsdatums (`TASKRSRC.restart_date`
… `reend_date`, werkdagen, niet-materiaal, niet voltooid) boven `max_qty_per_hr` komt. Na een nivelleerrun waarin
die resource meedoet kan dat niet. Dit is alleen een analysemiddel, geen solverinvoer (bak 4, zie §6).

| bestand / project | `keep`/`all`/prioriteit | resourcedagen | overbelast | genivelleerd? |
|---|---|---:|---:|---|
| OZB 9033 | N / N (PM-1) / ES | 69 | **0** | ja (§3) |
| OZB 9045, 9047 | N / N (PM-1) / ES | 51 | **6** | nee: OZ1100 en OZ1060 lopen allebei op PM-1 vanaf 01-02 |
| OZB 9049 | N / N (PM-1) / ES | 75 | **6** | nee: idem (OZ1060 01-02…01-23, OZ1100 01-08…01-15) |
| HarbourPointe 4408 | Y / Y / Activity Priority | 7.857 | 122 | nee |
| Hotel 2666 (twee kopieën) | Y / Y / Activity Priority | 1.349 | 1.133 | nee |
| Roads 1346 | Y / Y / Activity Priority | 6.531 | 1.279 | nee |
| Sample 771 | Y / Y / Activity Priority | 90 | 18 | nee |
| xernative sample 368 | Y / Y / default | 6 | 0 | onbeslist (één toewijzing) |
| ashspace sample, TERMINAL BUILDING | – | geen resterende toewijzingen met datums | – | onbeslist |

Conclusie: **9033 is het enige genivelleerde project in de orakelpopulatie** [VERMOED, sterk: de indicator is
grof (ma–vr, geen resourcekalender), maar de verschillen zijn groot]. En vooral: 9045/9047/9049 dragen precies
dezelfde nivelleerinstellingen, maar hun laatste berekening was níét genivelleerd. De `level_*`-kolommen zijn
dus de instellingen van de dialoog (bij de meeste projecten nooit aangeraakt: de defaults), geen bewijs van een
nivelleerrun. De gedachte "P6 aan als `sched_level_*` dat zegt" is daarmee **weerlegd**: zou de lezer
nivellering aanzetten op basis van deze kolommen, dan worden 9045/9047/9049 (nu exact) fout. Dat breekt regel A.

## 3. Reconstructie: wat deed P6 in 9033

### 3a. CPM zonder nivellering tegenover P6

Het Python-model rekent de zuivere CPM (FS0, statusdatum 12-09, MSOA op OZ1060, MEOB 01-27 16:00 op OZ1130,
kalenders 8402 = 5d/w en 8409 = 6d/w met hun feestdagen). Uitkomst: OZ1000…OZ1050 zijn gelijk aan P6, vanaf
OZ1060 niet.

| taak | PM-1 | duur (wd) | CPM ES…EF | P6 ES…EF | vertraging (wd) | oorzaak |
|---|:-:|---:|---|---|---:|---|
| OZ1000 | | 0 | 12-09 | 12-09 | 0 | |
| OZ1010 | ✓ | 4 | 12-09…12-12 | 12-09…12-12 | 0 | |
| OZ1020 | | 5 | 12-13…12-19 | 12-13…12-19 | 0 | |
| OZ1030 | | 2 | 12-20…12-23 | 12-20…12-23 | 0 | |
| OZ1040 | ✓ | 2 | 12-24…12-27 | 12-24…12-27 | 0 | |
| OZ1050 | ✓ | 4 | 12-30…01-03 | 12-30…01-03 | 0 | eerst aan de beurt (ES 12-30) |
| OZ1060 | ✓ | 8 | 01-02…01-13 | 01-06…01-15 | **2** | PM-1 bezet door OZ1050 tot 01-03 |
| OZ1070 | | 3 | 01-14…01-16 | 01-16…01-18 | 2 | logica (na OZ1060) |
| OZ1080 | | 3 | 01-17…01-20 | 01-20…01-22 | 2 | logica |
| OZ1090 | ✓ | 1 | 01-21 | 01-24 | **3** | logica wordt 01-23, PM-1 bezet door OZ1100 tot 01-23 |
| OZ1100 | ✓ | 6 | 01-06…01-13 | 01-16…01-23 | **8** | op 01-06 klaar, gelijk met OZ1060; OZ1060 wint |
| OZ1110 | ✓ | 2 | 01-22…01-23 | 01-27…01-28 | 3 | logica (na OZ1090) |
| OZ1120 | ✓ | 2 | 01-24…01-27 | 01-29…01-30 | 3 | logica |
| OZ1130 | | 0 | 01-27 | 01-30 16:00 | 2 | logica; MEOB 01-27 ⇒ TF −3 d |

Er zijn precies **twee prioriteitsbeslissingen**: (1) OZ1050 tegen OZ1060 (overlap op 01-02/01-03) en (2) OZ1060
tegen OZ1100, die allebei op maandag 01-06 klaar zijn om te beginnen. Bij OZ1090 is er geen keuze: OZ1100 loopt al.
De genivelleerde PM-1-volgorde is 1010 – 1040 – 1050 – 1060 – 1100 – 1090 – 1110 – 1120.

### 3b. Hypothesetoets vooruit: welke regel reproduceert die volgorde?

Twee plaatsingsschema's, elk met twaalf prioriteitssleutels. **Serieel**: kies steeds de beste taak waarvan alle
voorgangers geplaatst zijn, en zet die zo vroeg mogelijk waar PM-1 vrij is. Dat doet onze `ResourceLeveler` nu.
**Tijdgestuurd**: loop de werkdagen af; op elke dag concurreren alleen de taken die op dat moment logisch kunnen
beginnen, in prioriteitsvolgorde. Dat past bij Oracles "if two activities … are ready for leveling". "Statisch"
betekent: de sleutel komt uit de CPM zonder nivellering. "Dynamisch" betekent: de actuele logische ES op het
moment van kiezen. Telling: taken met ES én EF gelijk aan P6 (x/14), en PM-1-taken met de juiste ES (x/8).

| prioriteitsregel | serieel ES/EF | serieel PM-1 | tijdgestuurd ES/EF | tijdgestuurd PM-1 |
|---|---:|---:|---:|---:|
| **Early Start ↑ (statisch), dan Activity ID** (lijst uit het bestand) | **14/14** | **8/8** | **14/14** | **8/8** |
| Early Start ↑ (dynamisch), dan Activity ID | 14/14 | 8/8 | 14/14 | 8/8 |
| Early Finish ↑, dan ID | 14/14 | 8/8 | 14/14 | 8/8 |
| Activity Priority (alle Normal), dan ID (P6-default) | 9/14 | 4/8 | 14/14 | 8/8 |
| alleen Activity ID ↑ (Oracle: "no prioritization codes") | 9/14 | 4/8 | 14/14 | 8/8 |
| Total Float ↑, dan ES | 5/14 | 2/8 | 14/14 | 8/8 |
| **onze `ResourceLeveler`-sortering** (priority ↓, TF ↑, ES ↑, aanmaak) | 5/14 | 2/8 | 14/14 | 8/8 |
| Late Start ↑, dan ID | 5/14 | 2/8 | 14/14 | 8/8 |
| Late Finish ↑, dan ID | 9/14 | 4/8 | 14/14 | 8/8 |
| duur ↓, dan ID | 5/14 | 2/8 | 14/14 | 8/8 |
| duur ↑, dan ID | 6/14 | 3/8 | 6/14 | 3/8 |
| Activity ID ↓ | 5/14 | 2/8 | 6/14 | 3/8 |

Lezing:
- **Serieel werkt alleen met een datum-sleutel (ES/EF).** Met TF voorop (onze sortering) kiest de seriële lus
  eerst OZ1060 (TF 0) boven OZ1050 (TF 6). Dan schuift OZ1050 naar ná OZ1060 en loopt alles uit de pas (5/14).
  P6 deed dat niet.
- **Tijdgestuurd maakt de prioriteit bijna irrelevant**: alleen beslissing (2) is een echte gelijkstand. Die
  wint OZ1060 bij elke sleutel behalve "korte duur eerst" en "ID aflopend". De bestandsregel (ES ↑) geeft zelf
  een gelijkstand (dynamisch allebei 01-06); de beslissing valt dan op de tie-break. Activity ID oplopend
  (Oracle: "sorts by activity ID") en statische ES (01-02 < 01-06) kiezen allebei OZ1060.
- **Wat 9033 niet kan onderscheiden:** tijdgestuurd tegenover serieel met ES, statische tegenover dynamische
  ES, en de exacte tie-break. Wel uitgesloten voor P6: serieel met TF/LS/ID-voorop, en "korte duur eerst".
  Daarmee is onze huidige sortering (TF voorop, serieel) **niet** P6-conform. Of dat komt door de sortering
  of door het schema, is met één project niet uit elkaar te halen.

### 3c. Hypothesetoets achteruit (`level_keep_sched_date_flag = N`)

De late kant begint bij de MEOB van OZ1130 (01-27). Getest op de genivelleerde ES/EF uit 3b:

| model voor de late datums | LS/LF exact |
|---|---:|
| B0: gewone CPM-achterwaarts, zonder resources (wat OPS nu doet) | 6/14 |
| **B1: CPM-achterwaarts met de genivelleerde PM-1-volgorde als extra FS-ketting** (1010→1040→1050→1060→1100→1090→1110→1120) | **14/14** |
| B2: tijdgestuurd achterwaarts nivelleren, prioriteit "EF ↓" (spiegel van ES ↑) | **14/14** |
| B2: idem, "voorwaartse volgorde omgekeerd" | 14/14 |
| B2: idem, "LF ↓ (ongenivelleerd), dan ID" | 12/14 (OZ1050/OZ1060 wisselen) |
| B2: idem, "Late Start ↓" of "Activity ID ↑" | 11/14 |
| B2: idem, "ES ↑", "ID ↓" of "LF ↓, ID ↓" | 3/14 |

P6 herrekent de late datums dus zó dat **de PM-1-volgorde van de vooruitpas blijft staan**. OZ1050 moet vóór
OZ1060 klaar zijn (LF 12-30), OZ1060 vóór OZ1100 (LF 01-10) en OZ1100 vóór OZ1090 (LF 01-20). Een zelfstandige
achterwaartse nivellering die de volgorde opnieuw kiest op de ongenivelleerde LF, wisselt OZ1050 en OZ1060 om. P6
doet dat niet. B1 en B2 met "EF ↓" zijn in 9033 niet te onderscheiden. B1 is het eenvoudigst te bouwen.

### 3d. Speling na nivellering

Met ES/EF uit 3b en LS/LF uit B1:

| as | exact | regel |
|---|---:|---|
| TF | **14/14** | LF − EF (mijlpaal OZ1000: LS − ES) op de genivelleerde datums; −3 d op de keten, −2 d op OZ1070/1080 (kalender 8409) |
| FF | **14/14** | alleen tegen de **logische** opvolgers (TASKPRED), niet tegen de PM-1-ketting: OZ1050 8 d (tot OZ1100 ES 01-16), OZ1100 1 d (tot OZ1110), OZ1080 1 d (tot OZ1090) |

Totaal: **84/84** waarden (14 taken × 6 assen). De eerdere nabootsing met drie echte FS-relaties (§2a van het
284-onderzoek) had OZ1050 ff en OZ1100 ff fout, omdat een echte relatie wél in de FF telt. De resourcevolgorde is
dus een **aparte soort voorganger**: hij telt in de late pas, maar niet in de FF. Of hij meetelt voor het
drijvende pad (`driving_path_flag`) is niet gemeten; in de basisrun is `drivingPath` van 9033 al fout op zes
taken. [OPEN]

## 4. Onze nivelleerder tegenover P6

`src/engine/scheduler/ResourceLeveler.ts` (`levelResources`) is een seriële SGS. Hij rekent op een eigen verse
CPM-solve, sorteert op priority ↓, TF ↑, ES ↑, aanmaakvolgorde, plaatst per taak het eerste passende venster en
levert een voorstel (`delays` in **hele werkdagen**, `shifts`, `unresolved`). Hij draait **nooit** in
`solveProject`. Alleen de gebruiker start hem (lint/dialoog, MCP `planner_level_resources`, de B1c-verdeler)
via `scheduleSlice.levelResources` (preview) en `applyLeveling`. Die schrijft `task.levelingDelay` als
**documentdata** (undo, `isDirty`) en draait daarna `runCPM`. De `CPMSolver` past `levelingDelay` in de
voorwaartse pas toe (`shiftByLevelingDelay`). De achterwaartse pas kent geen resources.

| aspect | P6 (9033 + Oracle) | OPS nu | gevolg voor de etappe |
|---|---|---|---|
| wanneer | handmatig ("Level") of bij elke Schedule als "Automatically level … when scheduling" aan staat (instelling niet in de XER) | alleen handmatig, als voorstel + toepassen | nieuwe tweede pas in `solveProject` achter een optie |
| resultaat | berekende datums (XER-TASK kent geen vertragingsveld) | persistente `levelingDelay` op de taak | in de solve: vertragingen **efemeer**, niet als documentdata |
| schema / volgorde | tijdgestuurd of serieel-met-ES (3b) | serieel, TF voorop | 5/14 met onze sortering serieel. Nieuwe sleutels nodig uit `LevelPriorityList` |
| prioriteitssleutels | 14 sleutels, ↑/↓, lijst, tie-break Activity ID | vast: priority/TF/ES/aanmaak | projectoptie `levelingPriorities` |
| resources | lijst (RSRCLEVELLIST) of alle | `resourceIds` of alle renewables | projectoptie; bestaat al als parameter |
| granulariteit | uur (Max Units/Time per uur) | hele werkdagen (D29) | in 9033 niet merkbaar; elders wel [OPEN] |
| late datums | herrekend met behoud van de volgorde (3c) als "preserve" uit; anders ongewijzigd | nooit geraakt door nivellering | nieuw in de `CPMSolver`: resourcevolgorde als voorganger die alleen in de late pas telt |
| vrije speling | alleen logisch (3d) | n.v.t. | volgt vanzelf als de resourcevolgorde geen `Sequence` is |
| binnen float / min. float / over-allocatie % | opties | `constrainToFloat`, `overrunCeilingDays` | gedeeltelijk aanwezig. Niet gemeten (geen orakel met "binnen float") |
| andere projecten | optie met prioriteitsdrempel | B1c-poolgrootboek (`LevelingPoolLedger`) | nu buiten scope |
| lopende/voltooide taken | "Level … on or after data date" [VERMOED] | onverplaatsbaar, boeken vaste last (D28) | niet gemeten: 9033 heeft geen voortgang |

**Gemeten: onze `levelResources` op 9033.** `/tmp/lvl/ops.ts` importeert het bestand, draait `solveProject`,
dan `levelResources` (PM-1, `constrainToFloat: false`), zet de delays en draait opnieuw. Dat gebeurt twee keer:
met conventie A16 (`p6UseTaskPlannedStartFloor`, de geplande-startvloer) aan zoals in het P6-profiel, en uit.

| variant | vertragingen van onze nivelleerder | ES exact | EF exact | LS exact | LF exact |
|---|---|---:|---:|---:|---:|
| A16 aan (P6-profiel) | OZ1100 +6 wd | 9/14 | 9/14 | 6/14 | 6/14 |
| A16 uit | OZ1050 +10 wd, OZ1100 +2 wd | 5/14 | 5/14 | 5/14 | 6/14 |
| P6-model uit §3 (tijdgestuurd, ES ↑/ID, late pas B1) | – | 14/14 | 14/14 | 14/14 | 14/14 |

- **A16 uit** laat precies zien wat het Python-model voorspelde voor "onze sortering, serieel" (5/14). TF voorop
  plaatst OZ1060 vóór OZ1050, en OZ1050 schuift 10 werkdagen op. P6 deed het omgekeerde. Het model en onze motor
  zijn het hier eens. Dat is een onafhankelijke bevestiging van de tabel in §3b.
- **A16 aan**: de geplande-startvloer heeft OZ1060 en OZ1100 al op P6's datums gezet (§4a). Onze nivelleerder
  ziet daarna nog één conflict: OZ1090 (logisch 01-23) tegen OZ1100 (01-16…01-23). Hij geeft OZ1090 voorrang,
  waardoor OZ1100 naar 01-24…01-31 gaat. P6 liet OZ1100 doorlopen, want die was al begonnen toen OZ1090 klaar
  was (tijdgestuurd). Daarnaast staan in deze variant de late datums van OZ1000…OZ1060 gelijk aan de vroege (TF 0
  in plaats van −3 d onder de MEOB), en OZ1100 LS/LF wijkt af. Die bijvangst is niet onderzocht [OPEN]. Hij
  laat wel zien dat `levelingDelay`, A16 en een late constraint samen een pad vormen dat nu niet getest wordt.

### 4a. Samenspel met A16 (geplande-startvloer)

Belangrijke bijvangst: in de huidige basisrun heeft OPS voor OZ1060 (01-06) en OZ1100 (01-16) **al** P6's
genivelleerde ES. Dat is geen nivellering. A16 leest `TASK.target_start_date` als vloer zodra het geplande venster
meer dan één kalenderdag later ligt dan het netwerk. P6 schrijft bij een niet-gestarte taak zijn genivelleerde
datums ook als geplande datums weg. A16 neemt dus een deel van P6's nivelleeruitkomst via de geplande datums
over: OZ1060 +2 d en OZ1100 +8 d, allebei meer dan een dag. OZ1090 lag maar één dag later (01-24 tegen 01-23) en
bleef daardoor onder de drempel. Daardoor lopen OZ1090/1110/1120/1130 in de basisrun precies een dag voor op P6.

Gevolgen voor de etappe:
- Met een P6-conforme nivelleerpas wordt A16 op deze taken overbodig: de vloer valt samen met de genivelleerde ES.
  Dubbeltelling is niet te verwachten, want de vloer is een ondergrens en geen optelling [VERMOED, meten in stap 5].
  Met onze huidige nivelleerder gaat het wél mis (tabel hierboven: OZ1100 +6 wd bovenop de vloer, omdat de seriële
  keuze anders valt).
- In een bestand dat P6 genivelleerd heeft maar waar OPS níét nivelleert, maskeert A16 de nivellering half. Dat
  is geen fout van A16 (P6 doet die vloer echt), maar het maakt "gedeeltelijk goed" misleidend. De meetlat moet
  9033 dus met nivellering meten, niet met A16 als stille vervanger.

## 5. Waar het in de architectuur past (regel B)

Regel B zegt: verschil per school is een conventie, en een waarde per bestand is een projectoptie. Nivellering
bestaat uit drie lagen, en elke laag hoort ergens anders:

| laag | voorbeeld | per school of per bestand? | plaats |
|---|---|---|---|
| **aan/uit**: nivelleren tijdens berekenen | P6 "Automatically level … when scheduling"; MS Project "Automatic" leveling [VERMOED: in MSP een project-/applicatie-instelling, niet gemeten] | per project, maar **niet uit de XER af te leiden** (§2) | projectoptie `levelDuringCalculation`, default **uit** in alle drie de profielen; de gebruiker zet hem aan (Projectinfo); de XER-lezer zet hem nooit |
| **parameters** | prioriteitslijst, resourcelijst, preserve dates, binnen float, min. float, over-allocatie %, andere projecten | per bestand (SCHEDOPTIONS, RSRCLEVELLIST) | projectopties (`levelingOptions`-blok), door de XER-lezer gevuld; profiel geeft de defaults (P6: Activity Priority ↑, alle resources, preserve aan) |
| **methode** | tijdgestuurd plaatsen; late pas met behoud van de resourcevolgorde; FF alleen logisch; tie-break Activity ID | per school | conventies, alleen als OPS/MSP echt anders rekenen. Kandidaten: `levelingTimeBased`, `levelingBackwardKeepsOrder`, `levelingFreeFloatLogicOnly` |

Een enkele conventie "nivelleren zoals P6" per profiel werkt niet. Dan zou het P6-profiel nivelleren in 9045/9047/9049
(nu exact) en in elk ander P6-bestand met resources, en dat breekt regel A meteen. De aan/uit moet dus een
projectoptie zijn, met default uit.

**Waar in de code.** Een tweede pas in `solveProject` (`src/engine/scheduler/solveProject.ts`), alleen als
`levelDuringCalculation` aan staat:
1. CPM zoals nu (voorwaarts + achterwaarts).
2. Nivelleren vooruit: plaatsen volgens de prioriteitslijst (tijdgestuurd), met vertragingen die **alleen in
   deze solve** bestaan (niet in `task.levelingDelay`: die blijft van de gebruikersactie en van de `.mpp`-lezer).
3. Voorwaartse pas opnieuw met die vertragingen.
4. Als "preserve scheduled dates" uit staat: de achterwaartse pas opnieuw, met de resourcevolgorde als interne
   voorganger (B1). Die voorganger is **geen `Sequence`**: hij telt niet in de FF, niet in de relatie-uitvoer
   (`seqConstraint`, driving-relaties) en niet in de relatielijnen van de Gantt. Staat "preserve" aan, dan
   blijven de late datums van stap 1 staan (Oracle-citaat §1), en de TF volgt daaruit.
5. `applyCpmResult` zoals nu.

De bestaande `levelResources` blijft de handmatige actie. De prioriteitslogica en de capaciteitsboekhouding
(`assignmentDayUnits`, `maxUnitsOn`, `enumerateTaskWorkDays`) kunnen gedeeld worden. De plaatsingslus niet
zomaar: die is serieel en dag-granulair, en de A1-proef-solves maken hem O(n) solves per run. Binnen elke
berekening is dat te duur voor grote bestanden (Roads 3.575 toewijzingen) [VERMOED, meten].

**Bak 4 blijft dicht.** De tweede pas leest uitsluitend invoer (toewijzingen, capaciteit, instellingen), nooit
P6's opgeslagen datums of `TASKRSRC.restart_date`. De indicator uit §2b is alleen een analysemiddel en mag geen
lezerregel worden: "geen overbelasting in de opgeslagen datums ⇒ nivelleren aan" zou rekenuitvoer als
solversturing gebruiken. Dat verbiedt `check-xer-field-whitelist.ts`, en het is een eigenaarsbesluit (§7, besluit 2).

## 6. Meetlat en regel A

**Meetlat.** X12 meet nu alleen CPM. Voorstel: het manifest (`xer-corpus-manifest.json`) krijgt per project een
herkomstveld `leveledProjects: ["9033"]`. Dat is een menselijke classificatie, net als `role`/`included`, en
geen lezerafleiding. De meetharnas (`xerFidelity.ts` / `check-xer-product-fidelity-x12.ts`) zet voor precies die
projecten `levelDuringCalculation` aan vóór `solveProject`. Zolang 9033 volgens het besluit van vandaag uit het
orakel is, is dit het mechanisme om hem terug te halen: dan met doel 0 op 84 cellen + `drivingPath`.
Tussenstap: een corpusloze fixture die 9033 nabouwt (14 taken, één resource, synthetisch, zonder P6-bytes) met
de 84 verwachte waarden uit §3. Die mag in de repo en maakt de etappe CI-bewaakt.

**Regel A-risico's.**

| risico | waarom | maatregel |
|---|---|---|
| andere P6-bestanden veranderen | alleen als de optie aan staat; default uit en de lezer zet hem nooit | per constructie byte-identiek; `measure:profiles` moet 0/0/0 geven op alle andere cellen |
| 9045/9047/9049 | zelfde instellingen, maar niet genivelleerd | krijgen **geen** `leveledProjects`-vermelding; test dat ze exact blijven |
| MS Project-profiel | `.mpp` bewaart MSP's eigen nivellering al als `levelingDelayMinutes` (ankerregel in `CPMSolver`) | optie default uit onder MSP; `check-mpp-fidelity` 216 pins ongewijzigd |
| OPS-profiel / bestaande nivelleerder | handmatig nivelleren en `levelingDelay` blijven ongewijzigd | de solve-pas raakt `levelingDelay` niet; `cases-resource-leveling.json`, `check-leveler-scope.ts` groen |
| A16 | geplande vloer en nivellering overlappen op dezelfde taken | in stap 5 meten met A16 aan én uit (§4a) |
| n = 1 | tijdgestuurd, late pas met behoud van volgorde en FF alleen logisch komen uit één project | het principe (vooruit nivelleren, late datums herrekend, prioriteitslijst, ID als laatste sleutel) is door Oracle gedocumenteerd; de drie details niet ⇒ eigenaarsbesluit 3 |
| prestaties | een nivelleerpas binnen elke berekening | meten op Roads/HarbourPointe met de optie aan; een budget in de benchmark |

## 7. Etappevoorstel (na het nuldoel)

| stap | wat | poort | eigenaarsbesluit? |
|---|---|---|---|
| 1 | **Parameters lezen**: `levelingOptions` als projectoptie (prioriteitslijst, resourcelijst uit RSRCLEVELLIST, preserve, binnen float, min. float, over-allocatie %, andere projecten). XER-lezer vult, IFC round-trip (`OPS_SchedulingOptions`), `xerScheduleOptions.ts` van `ignored` naar `mapped`. Nog geen rekeneffect. | `check-document-contract`, IFC-round-trip, `verify:conventions`; X12 0/0/0 | nee |
| 2 | **Aan/uit**: projectoptie `levelDuringCalculation`, default uit in alle profielen, zichtbaar in Projectinfo (blok *Rekenprofiel en reken-opties*), niet door lezers gezet | idem + gids `gids-rekenprofielen.md` (nl+en) | **ja, besluit 1:** projectoptie met default uit en nooit automatisch uit de XER (§2b)? Of liever een eigen knop "Nivelleren bij berekenen" buiten het profielblok? |
| 3 | **Corpusloze fixture 9033-nabouw** (synthetisch, 14 taken, één resource) met de 84 verwachte waarden uit §3 als rode test | `tests/planning/check-leveling-during-solve.ts` rood | nee |
| 4 | **Vooruitpas**: tijdgestuurde plaatsing met de prioriteitslijst en efemere vertragingen in `solveProject`. Deelt de capaciteitsfuncties met `ResourceLoad.ts`; `levelingDelay` blijft onaangeroerd | fixture ES/EF groen; alle bestaande nivelleersuites groen | **ja, besluit 3:** mogen de drie n = 1-details (tijdgestuurd, late pas met behoud van volgorde, FF alleen logisch) landen met 9033 als enige bewijs plus de Oracle-principes? Of eerst een tweede genivelleerd P6-orakel zoeken? |
| 5 | **Achterwaarts en speling**: resourcevolgorde als interne voorganger in de late pas (alleen bij preserve = uit), FF alleen logisch; A16 aan/uit meten | fixture 84/84; `check-recorded-dates`, driving-path-trace | nee (volgt uit besluit 3) |
| 6 | **Meetlat**: `leveledProjects` in het manifest, harnas zet de optie per project aan, 9033 terug in het orakel | `measure:profiles`: 9033 0 afwijkingen, alle andere cellen 0/0/0; `check-fidelity-cells-gate` | **ja, besluit 2:** 9033 terug in het orakel via een handmatig manifestveld (en dus nooit via een lezerheuristiek op opgeslagen datums)? |
| 7 | **Granulariteit en randen**: uurniveau (P6 Max Units/Time per uur) tegenover D29 hele werkdagen; lopende taken; meerdere resources per taak (Task Dependent: alle resources vrij); prestatiebudget | benchmark; gerichte cases | **ja, besluit 4:** D29 loslaten voor de solve-pas (uurnivellering) of dag-granulair houden? |
| 8 | **Handmatige nivelleerder gelijktrekken** (optioneel): de sortering van `levelResources` laten volgen uit `levelingPriorities` in plaats van de vaste TF-voorop-sortering; UI-keuze van de prioriteitslijst | `cases-resource-leveling.json` (verwachte waarden veranderen bewust) | **ja, besluit 5:** mag het gedrag van de bestaande knop veranderen, of blijft die de OPS-heuristiek? |

## 8. Open punten

- **Tie-break** (Activity ID tegenover statische ES) en **schema** (tijdgestuurd tegenover serieel-met-ES) zijn
  in 9033 niet te onderscheiden. Een tweede genivelleerd P6-project met ongelijke Activity ID-volgorde en
  ES-volgorde zou dat beslissen. In de openbare crawl is er geen (§2b).
- **`drivingPath`** na nivellering: telt de resourcevolgorde mee? Niet gemeten.
- **Resourcekalender** (PM-1 op kalender 178, zonder feestdagen) tegenover taakkalender 8402: in 9033 zonder
  effect, want alle PM-1-taken liggen op 8402 en er valt geen PM-1-taak op een feestdag. Niet getoetst.
- **Uurniveau, lopende taken, "binnen float", over-allocatie %, andere projecten**: geen orakel.

## 9. Fundament gelegd (2026-09-24)

Model: Claude Opus 5.5 (uitvoerder-opus-midden). Branch `claude/x12-nivellering-fundament`, basis `9bfae749`.
Alleen wat de vijf eigenaarsbeslissingen niet vooruitloopt; `ResourceLeveler.ts`, de motor en de UI zijn niet
aangeraakt.

**Wat er is.**
- Projectoptie `leveling` (`LevelingSettings` in `src/types/project.ts`; `ProjectOptionKey` telt nu elf
  sleutels) zonder aan/uit-veld (de vorm daarvan is besluit 1; een vroegtijdig verplicht `enabled: false` zou in
  opgeslagen IFC's vastzitten — fixronde 2026-09-24), `preserveScheduledDates`
  (`level_keep_sched_date_flag`), `levelAllResources` (`level_all_rsrc_flag`), `priority` (`LevelPriorityList`
  als `{ field, direction }` in bronvolgorde; het veld blijft de letterlijke P6-kolomnaam, ongeïnterpreteerd) en
  `resources` (RSRCLEVELLIST via `schedoptions_id`, met `maxUnitsPerHour` uit `RSRCRATE.max_qty_per_hr` alleen als
  alle tariefrijen één waarde dragen). Geen enkele `level_*`-kolom en geen lijst ⇒ geen blok (byte-identiek).
- XER: RSRCLEVELLIST is een bekende tabel (`XER_KNOWN_FIELDS_BY_TABLE`); in de kolomtabel van
  `xerScheduleOptions.ts` staan `level_keep_sched_date_flag`, `level_all_rsrc_flag`, `levelprioritylist` en
  `schedoptions_id` nu op `mapped`. De vijf andere `level_*`-kolommen (binnen float, min. float, over-allocatie %,
  andere projecten + prioriteit) blijven `ignored` met reden. Onbekende tokens, een sleutel buiten de vorm en een
  lijstregel zonder RSRC-rij vallen zichtbaar terug (`scheduleOptions.fallbacks`), nooit stil.
- Bakken: alle gelezen kolommen zijn **invoerinstellingen** (SCHEDOPTIONS, RSRCLEVELLIST, RSRCRATE) — geen
  TASK-kolom, dus buiten bak 1–4 van `check-xer-field-whitelist.ts`, en niets uit bak 2 of 4. Let op voor de
  vervolgetappe: een prioriteitssleutel kan een rekenuitvoerkolom *noemen* (9033: `early_start_date`); de pas moet
  dan de eigen berekende waarde gebruiken, nooit de opgeslagen P6-uitvoer.
- IFC: via `OPS_SchedulingOptions` (alleen geschreven als aanwezig), sanitizer met whitelist
  (`sanitizeLeveling`: geen verplicht veld, ongeldige elementen los weg, niets geldigs ⇒ geen blok, bovengrenzen); resource-ids worden bij
  het lezen via de GlobalId teruggemapt (`remapLevelingResourceIds`, spiegel van de contouren).
- MCP: `planner_get_project_info` toont het blok letterlijk; `planner_update_project` weigert `leveling` met de
  reden "gelezen, nog niet toegepast". MSPDI-export meldt het blok als niet uitdrukbaar, maar alleen als het
  afwijkt van de P6-dialoogdefaults (`isP6DialogDefaultLeveling`): acht van de twaalf OZB-projecten dragen
  precies die defaults, en die melding zou dan ruis zijn.
- Projectinfo "Standaardopties" en de profielwissel in de wizard laten de bronsignalen `leveling` en
  `useProjectEndDateForFloat` staan (`withDefaultOptions(profile, current)`): ze komen alleen uit het bestand,
  geen profiel kent er een default voor en de UI kan ze niet terugzetten.
- RSRCLEVELLIST-rijen met een lege of onbekende `schedoptions_id` vallen zichtbaar terug (`fallbacks`,
  `RSRCLEVELLIST.schedoptions_id`), bij elk project van het bestand.
- Manifest: `leveledProjects: [{ projId, decision, reason }]` per inbegrepen orakelentry
  (`tests/planning/xerManifestLeveling.ts`), besluit per regel verplicht. Mechanisme zonder data: het manifest
  draagt het veld nergens, X1 valideert het alleen, X12 rapporteert "genivelleerd volgens eigenaar: N projecten".
  Geen invloed op de telling (besluit 2 open). Een project dat in dezelfde entry ook in `excludeProjects` staat
  wordt geweigerd (uitgesloten én genivelleerd gemeten is tegenstrijdig).

**Harde voorwaarden voor de motoretappe (§8), nu gelegd.** `src/services/leveling/levelingInput.ts` (puur,
nog door niets gelezen) is de enige toegestane leesweg voor de motor: `resolveLevelingResources` filtert
hangende resource-ids en geeft ze terug om te melden; `levelingPriorityQuantity` is een gesloten tabel P6-kolomnaam
⇒ eigen grootheid (de zes bak-4-namen ⇒ de EIGEN berekende ES/EF/LS/LF/TF/FF, bak 2 ⇒ geen betekenis, onbekend
⇒ geen betekenis, nooit een terugval naar de bronkolom). `tests/planning/check-leveling-input.ts` haalt de
bak-2/4-namen mechanisch uit `check-xer-field-whitelist.ts` en voert ze elk als sleutel.

**Rest van stap 1 (§7), bewust niet gelezen.** Deze SCHEDOPTIONS-kolommen blijven `ignored` met reden en staan
dus niet in het blok: `level_within_float_flag` (binnen float), `level_float_thrs_cnt` (minimale float),
`level_over_alloc_pct` (over-allocatie %), `level_outer_assign_flag` en `level_outer_assign_priority`
(toewijzingen van andere projecten + hun prioriteit). Reden: geen orakel (§8, laatste punt) en geen consument;
ze lezen zonder meting zou een belofte doen die de motor niet kan houden. Ze blijven wel in het bronarchief.

**Gemeten (OZB).** 9033, 9045, 9047 en 9049 krijgen dezelfde data `{ preserveScheduledDates:
false, levelAllResources: false, priority: [early_start_date ↑], resources: [PM-1 (6900), 1/u] }`; de acht andere
projecten de dialoogdefaults (keep/all aan, Activity Priority ↑), gepind in
`check-xer-schedule-options-wiring.ts` (test 13). Zo blijft zichtbaar dat de instellingen niets zeggen over óf er
genivelleerd is (§2b).

**Regel A.** `npm run measure:profiles` (mét corpus, 2026-09-24): P6 NULDOEL met de huidige telling
(175 zesassige afwijkingen, drivingPath 168), cel-delta nieuw=0 verslechterd=0 groter=0 (en verbeterd=0: geen
motorwijziging); MS Project `mpp-fidelity` groen. Uitslag "regel A gehouden onder elk gemeten profiel". De
voorbeeld-IFC's zijn na `gen:examples` gelijk aan die van de basis (op de per run willekeurige GUID's,
tijdstempels en id's na); `verify:examples` groen. Het XER-profiel verandert per constructie niet: niets in
de motor leest `leveling`.

