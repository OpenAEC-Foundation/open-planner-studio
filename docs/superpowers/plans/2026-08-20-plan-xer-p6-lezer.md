# Etappe 2 — Primavera XER lezen, getrouw aan P6 op vier assen

*Levend etappeplan. Concept 2026-08-20 na drie verkenningsrondes; herwerkt dezelfde dag na de
hyperkritische planreview (verdict: herwerken — alle blokkerende en zware punten zijn in deze
versie verwerkt; de review mat vrijwel alle corpusgetallen zelf na en de gecorrigeerde cijfers
hieronder zijn de zijne). Eigenaar van dit document is de orkestrator; besluiten en bevindingen
worden hier bijgeschreven zoals bij `2026-08-17-plan-mpp-nul-afwijkingen.md`. Overgenomen
2026-09-04 door de Claude-hoofdsessie na het einde van de Codex-thread; besluiten X-O6 t/m X-O8
en de laagbijstelling stammen uit die overname.*

## §1 Doel

**Open Planner Studio opent Primavera XER-bestanden (.xer) native, en is daarbij getrouw aan
P6's eigen opgeslagen rekenuitvoer op vier assen: early start, early finish, late start en late
finish — plus de totale en vrije float.** Over alle leesbare, door P6 doorgerekende bestanden
van het XER-corpus geldt na import + herberekening (`runCPM`): exact nul afwijkingen, per as
geteld over de taken waar die as meetbaar is. De baseline bestaat uitsluitend uit nullen, zonder
één reason-pin — het `GOAL_ZERO_DEVIATIONS`-model van etappe 1, uitgebreid met per as een
afwijkings- én een meetbaar-teller.

**Granulariteit (planreview B1 — dit beslist alles):** 98,9% van de orakeldatums draagt een
echte tijd (73.408 van 74.212 gemeten datumwaarden staan niet op middernacht; 08:00, 16:00 en
17:00 domineren). De meetlat is dus **minuut-exact**, wat betekent dat élk orakelbestand in
uurmodus gelezen moet worden — anders landt elke taak in `sameday`, en sameday moet nul zijn.
De kalenderdecoder en de uurmodus-promotie (X3) zijn daarmee niet een tussenstap maar de
kritieke taak van de etappe.

**Float-precisie (planreview V2), als formule:** P6 slaat float op in uren
(`total_float_hr_cnt`/`free_float_hr_cnt`; 70 van de ±18.400 gevulde waarden zijn fractioneel,
dus "hele uren" is geen geldige aanname). Wij rekenen float in werkdagen. De vergelijking is:
`ons_float_in_minuten === round(p6_float_uren × 60)`, waarbij onze werkdag→minuten-omrekening
loopt via de taak-effectieve kalender — dezelfde uren-per-dag-bron als de duren, inclusief de
afleiding-uit-weekuren wanneer P6's eigen uren-per-dag-veld leeg is (dat is het hóófdpad: in
het rijkste corpusbestand is dat veld voor alle 124 kalenders leeg). Exact, geen tolerantie;
blijkt een klasse fractionele gevallen structureel onbeslisbaar, dan is dat een X-O3-escalatie,
geen stille afronding.

**Wat er níét in deze etappe zit**: XER schríjven (export) — eigen latere etappe (MPXJ's
`PrimaveraXERFileWriter` als referentie; TODO-registratie in X12). De taaktypes/effort-driven-
mótor blijft de aparte etappe uit `2026-08-18-spec-taaktypes-effort-driven.md`; P6's duration-
en activiteitstypes worden hier wél gelezen en bewaard als data. X0 legt daarbij vast dat de
latere motor-etappe `mspTaskType` en de nieuwe P6-typevelden naar één interne superset mapt —
twee opslagvelden nu, één rekenmodel straks, geen twee eilanden.

## §2 Waarom dit de juiste volgende stap is

- `docs/TODO.md` (issue #17): *"Primavera XER import/export — tekstformaat, native in TS
  haalbaar (geen JVM); samen met ons bestaande PMXML dekt dit de P6-wereld. Hoogste
  interop-prioriteit."* In de bouwpraktijk is de .xer vaak het enige dat een aannemer krijgt.
- Het fundament ligt er: de format-registry maakt een `.xer`-entry een patroonvolgend haakje
  (lazy chunk, dialoogfilters, i18n-fouten — het .mpp-stramien). De solver leest
  `schedulingOptions` volledig; `mppReader.ts` en `mspdiReader.ts` vullen ze al gedeeltelijk —
  XER's SCHEDOPTIONS-tabel wordt de derde vuller en de eerste met P6's eigen
  instellingsbegrippen (planreview F1: het plan claimde eerder "de eerste" — onjuist).
- Het corpus is publiek: 93 crawl-bestanden (P6 5.0 t/m 24.x). **Eerlijke telling van de
  meetmassa (planreview B3/licht):** 18.489 taken dragen de vier datum-assen; 17.963 dragen
  álle zes assen. Let op de duplicaten (her-check-meting): byte-dedup (md5) houdt 84 unieke
  bestanden over met 17.600 orakeltaken in 23 unieke orakelbestanden — maar het gróótste
  duplicaat vangt een inhoudshash juist níét: de twee Hotel-bestanden (samen 47% van het
  orakel) dragen dezelfde vier projecten en dezelfde 4.236 taken in nét verschillende bytes.
  De pinning dedupliceert daarom tweeledig: byte-hash voor de exacte kopieën (twee Harbour
  Point-bestanden staan er 4× in, drie 2×) én een schema-vingerafdruk (proj_id-set +
  taakcodes + orakelwaarden) die het Hotel-paar als bekend duplicaat markeert. Het unieke
  orakel is dan 13.383 taken over 22 bestanden — nog altijd ~4× het .mpp-corpus, zonder
  bedrijfsdata: bestandsnamen mogen gewoon in tests en commits.

## §3 De twee meetlatten

1. **Corpus-orakel (bulk).** P6 bewaart zijn laatste rekenuitvoer per taak in de TASK-tabel.
   Een eigen `xerGroundTruth` leest die velden met een **onafhankelijke, minimale tabelscan** —
   bewust een tweede parser naast de echte lezer (F7-les uit etappe 1: gedeelde veldkaarten
   zijn common-mode; hier blijft zelfs de tokenizer gescheiden, en de "veldkaart" is per
   bestand de eigen `%F`-regel). Statussemantiek hoort bij de meetlat: voltooide taken meten op
   `act_`-datums; per as geldt een meetbaar-aantal naast het afwijkingental, want de dekking is
   scheef (her-check-meting, gevulde cellen over de 60 orakelbestanden: ES/EF in 48
   bestanden, LS/LF in 36, TF ±18.400 cellen, FF ±18.000 — er bestaan bestanden met alleen
   float en geen datums, en andersom).
   **Beide tellers worden gepind** (planreview M1): een lezer die stilletjes minder gaat meten
   maakt de suite net zo rood als een lezer die fout meet.
   Daarnaast rapporteert (buiten de nul-poort) een zevende as: `driving_path_flag` — P6's eigen
   kritiek/driving-oordeel, gevuld in 18.321 cellen over 30 bestanden, de goedkoopste externe
   toets op onze kritiek-padlogica die er bestaat (planreview M3). Promotie van die as tot
   poort is een expliciet latere afweging.
2. **P6-geverifieerde scenario's (scherp).** De `p6-comparison`-map bevat 13 kleine cases met
   per case ES/EF/LS/LF/TF/FF zoals **echt P6 23.12** ze produceerde. Alleen de `*_p6`-kolommen
   zijn meetlat — mét hun tijden. De `*_engine`-kolommen en de PASS-oordelen van dat raamwerk
   zijn géén referentie: hun "PASS" is geveld ná een normalisatie die de tijd volledig laat
   vallen én een exclusief-vs-inclusief-finish-conventie overbrugt (gemeten in case 01:
   `EF_engine=2026-01-12` vs `EF_p6=2026-01-09 17:00` telt daar als gelijk), en hun README
   meldt zelf dat de engine op deze capture is nagefit (planreview M4). Wij nemen uitsluitend
   P6's kolom over, onvertaald, en bouwen daar `cases-p6-verified.json` uit (herkomst: alleen
   de data; de engine-code van dat project is geen referentie). De twee cases die het raamwerk
   buiten zijn matrix hield (fractional-lag, dangling-relationship) worden gedocumenteerde
   niet-in-P6-reproduceerbaar-randgevallen, geen poort.

Niet-orakel-bestanden (de ongerekende generator-fixtures onder `xer-corpus/cases/` — planreview
M5: die dragen géén orakelvelden, hun TASK-header stopt bij constraints en actuals — de
robuustheidsbestanden en het 8-byte-DROID-skelet) tellen niet in de fidelity-poort maar in de
**parser-poort**: leesbaar-of-nette-typed-fout, nooit een crash of een stil half project.

## §4 Harde regels (geërfd uit etappe 1, plus de XER-eigen)

1. **Het opgeslagen antwoord is meetlat, nooit uitkomst — als WHITELIST (planreview M2,
   dichtgemaakt na de her-check).** De lezer mag uit de TASK-tabel uitsluitend deze
   invoervelden importeren: identiteit/structuur (`task_id`, `task_code`, `task_name`,
   `wbs_id`, `clndr_id`, `proj_id`, `guid`, `rsrc_id`), `status_code`, `task_type`,
   `duration_type`, `priority_type`; voortgang: `complete_pct_type`, `complete_pct`,
   `phys_complete_pct` (dé kolom voor de CP_Phys-taken, 18.607 gevulde cellen),
   `act_start_date`/`act_end_date`; duren: `target_drtn_hr_cnt`/`remain_drtn_hr_cnt`;
   geplande datums: `target_start_date`/`target_end_date`; werk-hoeveelheden (als data):
   `target_work_qty`/`remain_work_qty`/`act_work_qty`/`act_this_per_work_qty` en de
   `*_equip_qty`-familie; constraints: `cstr_type`/`cstr_date` (+`2`);
   `suspend_date`/`resume_date`; `task_notes` (échte notitiedata, X8); `constraint_type`
   (dialect-alias van `cstr_type` in de ProjectLens-bestanden); en `expect_end_date`
   (uitsluitend samen met de bijbehorende SCHEDOPTIONS-vlag, zie X5). **Alles wat niet op
   deze lijst staat is verboden terrein voor de lezer** — expliciet inclusief álle rekenuitvoer die er als gewone velden uitziet:
   `restart_date`/`reend_date` (15.328/15.329 gevulde cellen),
   `rem_late_start_date`/`rem_late_end_date` (10.193 elk), `driving_path_flag`,
   `float_path`(`_order`),
   `external_early_start_date`/`external_late_end_date` (die onder X-O1 relevant lijken maar
   uitvoer zijn), `old_restart_date`/`old_reend_date`/`old_remain_drtn_hr_cnt`,
   `crt_path_num`, `critical_drtn_hr_cnt`, `act_drtn_hr_cnt` en
   `plan_start_date`/`plan_end_date`. Naast deze twee lijsten is er een
   **derde bak: "genegeerd — geen planningsdata"** (delta-check: 32 corpuskolommen vielen
   buiten beide lijsten en de poortregel was daarmee op dag één onvervulbaar): audittrail
   (`create_date`/`update_date`/`create_user`/`update_user`), vlaggen
   (`rev_fdbk_flag`/`lock_plan_flag`/`auto_compute_act_flag`), kosten
   (`remain_cost`/`plan_cost`/`act_cost`), review/locatie
   (`review_type`/`review_end_date`/`location_id`), `est_wt`, `tmpl_guid`,
   `target_qty_per_hr`/`act_reg_qty`/`act_ot_qty`, `plan_start_date`/`plan_end_date`-achtige
   restvelden voor zover niet al verboden, de pseudo-XER-kolommen uit bestanden die X2 toch
   weigert, en de lege kolomnaam die een afsluitende tab op een `%F`-regel oplevert
   (tokenizer-nota in X2). Voorbehoud: blijkt tijdens de bouw dat een bak-3-veld tóch
   planningsinvoer draagt (kandidaten: `est_wt`, `review_type`, `tmpl_guid` — op naam
   ingedeeld, niet doorgelezen), dan verhuist het expliciet naar bak 1, nooit stilzwijgend.
   Naast deze drie bakken is er een **vierde bak: "uitsluitend weergave/meetlat, nooit
   solverinvoer"** (X-O7, §5): `early_start_date`, `early_end_date`, `late_start_date`,
   `late_end_date`, `total_float_hr_cnt`, `free_float_hr_cnt`. De lezer draagt ze in een apart,
   waardedragend contractveld (werknaam `ImportResult.recordedTimes`), nooit in `Task.time` en
   nooit in de solverinvoer — mutatiebewijs in X12-stijl: gemuteerde opgeslagen uitvoer
   verplaatst de solve niet, maar verplaatst de weergavemodus (het issue-#63-mechanisme van
   X-O7.3) wél.
   **Een corpus-%F-kolom die in géén van de vier bakken staat is een X0-poortfout, geen vrije
   keuze.** De X12-sluiproute-scan grept tegen de whitelist. Drie afgekeurde pogingen in
   etappe 1 zijn het precedent.
7. **De enum-tokenregel (delta-check — twee mechanismen, niet één):** (a) hoofdletter-
   varianten van bekende tokens worden case-insensitief gematcht (het corpus draagt
   `RCAL_SUCCESSOR` naast `rcal_Successor` en `TT_mile` naast `TT_Mile`); (b) een token dat
   ook ná case-fold onbekend is — zoals `ST_TotalFloat`, een PMXML-vorm in een XER die géén
   case-variant van de XER-tokens is — wordt een **gerapporteerde** terugval naar de default,
   nooit een stille. Implementatie in X4a/X5 (de semantische lagen; de X2-tokenizer kent geen
   enums), elk met een mutatiebewijs: case-fold uit ⇒ de `RCAL_SUCCESSOR`-fixture ROOD;
   rapportage uit ⇒ de `ST_TotalFloat`-fixture ROOD.
2. **De veld-als-signaal-regel** (etappe-1-registratie): veld-aanwezigheid op `Task` ís
   semantiek-signaal. De XER-lezer zet een bestaand veld alleen als de P6-betekenis aantoonbaar
   identiek is; elke afwijkende semantiek wordt een **bron-vlag** naar het O6-patroon (default
   uit ⇒ byte-identiek, uitsluitend door de betreffende lezer gezet). Verwachte kandidaten:
   de lag-kalender, retained logic vs. progress override, de Z10/Z11-relatieregels, en de
   suspend/resume-semantiek (X7).
   **Opgeleverde O6-bronvlaggen (`SchedulingOptions`, alle alleen actief onder
   `p6Source === 'XER'`)**: `p6PreserveActualInstants`, `p6UseRemainingStartForProgress`,
   `p6PreserveZeroDurationConstraintInstants`, `p6FinishMilestoneBoundaryWindow` en — sinds
   2026-09-05, X-O7 laag 1 klasse (i) — `p6CompletedLateFromRemainingWindow`. Die laatste wijkt
   op één punt af van het stramien: hij staat in de XER-defaultset standaard **aan**, maar
   `deriveXerScheduleOptions` zet hem weer **uit** zodra de bron `sched_progress_override = Y`
   declareert, omdat alle corpusbewijs uitsluitend RETAINED_LOGIC is. Zie het docblok bij het veld
   in `src/types/project.ts` voor de volledige bewijsbasis.
3. **Corpus is publiek**; bedrijfs-XER-bestanden zouden hash-only zijn, maar het corpus bevat
   ze niet.
4. **MPXJ (LGPL-2.1) uitsluitend lezen-om-te-begrijpen**; onafhankelijk herimplementeren,
   herkomstvermelding per bestand. Zelfde regel voor het cpp-cpm-engine-raamwerk: alleen de
   `*_p6`-data is meetlat, hun code is geen referentie.
5. **Exitcode is de poort, nooit de tail**; blast-radius meten vóór verbreden; regels op de
   invoer; diagnose op bladniveau; elke nieuwe decodeerregel een corpusloze fixture naast zijn
   corpuspin; élke taak minstens één mutatiebewijs in zijn acceptatie (planreview: X4/X5/X6
   misten dat in het concept — hersteld hieronder).
6. **Reviewpijplijn**: verse Sonnet-implementer per taak → review via de
   `hyperkritische-review`-skill (tier 2/Opus voor motor-, meetlat- en grammatica-werk, tier
   1/Sonnet voor mechanisch werk) → fixronde bij dezelfde implementer → her-check bij dezelfde
   reviewer; [BEVESTIGD]/[VERMOED]-labels blijven intact in de doorgeleiding. Mergen één taak
   per keer met de tellers vóór/ná in het merge-commit.

## §5 Openstaande eigenaarsbesluiten

- **X-O1 — BESLOTEN (eigenaar, 2026-08-20): álles wordt geïmporteerd.** De leidende regel:
  wie het bestand hier opent, ziet hetzelfde als in Primavera. Elk project in het bestand
  wordt een eigen document in het bestaande multi-documentmodel; het project met de meeste
  taken wordt het actieve tabblad (de export-vlag discrimineert niet — gemeten 15/15 en 4/4
  'Y' — en "het eerste project" draagt in de Hotel-bestanden nul taken). Cross-project-
  relaties worden `externalLinks` tussen de geopende documenten — let wel (her-check):
  cross-project-relaties komen in het corpus exact nul keer voor, dus deze tak krijgt een
  synthetische fixture en `externalLinks` is data, geen solverinvoer. De openingsmelding
  benoemt hoeveel projecten er geopend zijn. **Lege projecten** (gemeten: 3 van de 15 in het
  OZB-bestand en 2 van de 4 in het Hotel-bestand dragen géén taken) worden overgeslagen en
  geteld in de melding — geen lege tabbladen (orkestratorbesluit, eigenaar kan overrulen).
  Uitzondering: een project dat door een ánder project in hetzelfde bestand als baseline
  wordt aangewezen (X-O2) opent níét als los document — in Primavera is een baseline ook
  geen open project. **Begrenzing (her-check)**: die uitsluiting mag de verzameling nooit
  leegmaken — bij wederzijdse of zelfverwijzing, of wanneer álle projecten als baseline zijn
  aangewezen, opent alles alsnog als gewoon document mét melding; en de
  meeste-taken-heuristiek voor het actieve tabblad telt uitsluitend de daadwerkelijk
  geopende projecten. Gevolg voor de meetlat: het volledige orakel is bereikbaar; de
  fidelity meet per project en pint per bestand de som.
- **X-O2 — BESLOTEN (eigenaar, 2026-08-20): baselines blijven gewoon bewaard.** Een
  gekoppeld baselineproject (`sum_base_proj_id` → aanwezige PROJECT-rij) wordt als
  OPS-baseline op het hoofdproject gematerialiseerd — **verplichte deliverable van de
  etappe** (blijft buiten de nul-poort: baselines dragen geen orakelvelden voor de vier
  assen). Dangling-tak verplicht: 9 van de 10 gemeten corpuskoppelingen verwijzen naar een
  proj_id dat níét in het bestand zit — dangling wordt genegeerd én geteld in de
  openingsmelding, nooit een crash of stil half project. `stack_data_center_baseline.xer` is
  de positieve testcase.
- **X-O3 — BESLOTEN (eigenaar, 2026-08-20, conform voorstel).** TF/FF tellen volwaardig mee, met de formule uit
  §1 en per as de dubbele teller (afwijkingen + meetbaar). Legt de residu-iteratie een
  principieel P6-float-definitieverschil bloot dat niet via `schedulingOptions` te vangen is,
  dan is dat een eigenaarsbeslispunt — nooit stilzwijgend versoepelen.
- **X-O4 — BESLOTEN (eigenaar, 2026-08-20, conform voorstel; gecorrigeerd na planreview).** Het corpus bevat géén enkel BOM-dragend bestand — de
  BOM-tak is een formaliteit, **de heuristiek draagt alles**: geldige-UTF-8-toets over het
  hele bestand, bij falen Windows-1252 (gemeten: 22 bestanden met high-bit-bytes, 12 daarvan
  geen geldige UTF-8). Voor kleine bestanden is de toets principieel onbeslisbaar (3
  high-bit-bytes kunnen toevallig geldige UTF-8 zijn); daarom is de vermelding van de gemaakte
  keuze in de openingsmelding **de eigenlijke mitigatie**, geen extraatje. Geen
  gebruikersinstelling in deze etappe.
- **X-O5 — BESLOTEN (eigenaar, 2026-08-20): getalnotatie uit CURRTYPE, conform voorstel,
  mét documentatie-eis.** De decimaal/duizend-tekens komen uit het bestand zelf en zijn niet
  altijd letterlijk: naast `.`/`,` bestaan symbolische tokens (`ds_Period`, `dg_Comma`).
  Regel: bekende tokens decoderen; ontbrekende CURRTYPE-tabel (62 van de 93 bestanden!) ⇒
  default punt-decimaal; een aantoonbaar komma-decimaal-bestand zonder CURRTYPE ⇒ typed fout
  ("dit bestand kan ik niet betrouwbaar lezen") boven een stil verkeerd geparsed getal. Dit
  raakt élk getal — duren en floats incluis — en krijgt een eigen fixture-batterij in X2.
  **Documentatie-eis (eigenaar)**: dit gedrag wordt op drie plekken vastgelegd — een
  docblok-uitleg bij de CURRTYPE-tweepas in `xerTables.ts` (X2), de typed-foutmelding zelf in
  alle 14 talen (X2 werpt de getypeerde foutcode, X4a mapt hem naar de vertaalde tekst —
  exact het bestaande `mppCode`-patroon), en een eigen paragraaf in de .xer-gids (X10) die in
  gebruikerstaal uitlegt wat het bestand wel/niet zegt over zijn getalnotatie en wanneer de
  app weigert te gokken. `verify:docs` bewaakt de gidsparagraaf zoals altijd.
- **X-O6 — BESLOTEN (eigenaar, 2026-09-04): main wordt gemergd in de etappebranch, geen
  rebase.** De commit-identiteiten van de branch blijven intact (reviewrapporten en het
  X11-browserbewijs pinnen erop). Alle vier de openstaande zijbranches
  (`codex/xer-mcp-read`, `codex/xer-ext-read`, `codex/xer-x12-v2-rebased`,
  `codex/xer-schedoptions-provenance`) blijven onderdeel van deze etappe.
- **X-O7 — BESLOTEN (eigenaar, 2026-09-04): P6-getrouwheid in drie lagen, bijgesteld na de
  kalibratiemeting van dezelfde dag.** Primavera is per definitie de referentie voor wat een
  XER-project toont.
  1. *Primavera-gedrag nabouwen* — **het zwaartepunt na de bijstelling**: conventieverschillen
     (bv. LS/LF van voltooide taken = werkelijke datums) worden nagebouwd achter een bron-vlag
     die uitsluitend de XER-lezer zet (O6-patroon); de motor verandert niet voor IFC/MSP-
     projecten. Dossier `rehab-2.xer` (14.812 cellen) is hierbij motorsemantiek, geen
     ontbrekende invoer: (i) late zijde + float van voltooide activiteiten, 5.620 cellen — P6
     rekent voltooide activiteiten door tot de statusdatum en geeft ze echte float; (ii) late
     zijde van niet-gestarte activiteiten, 7.056 cellen — wij systematisch later, 140
     verschillende delta's, anker klopt. Samen 69% van het corpustotaal (18.398 gemeten
     cellen), beide achter een XER-bron-vlag. Echte eigen rekenfouten die daarbij boven komen
     worden voor alle projecten gefixt, met eigen test.

     **Stand 2026-09-05 — klasse (i) OPGELEVERD** (baan 7a, vlag
     `p6CompletedLateFromRemainingWindow`). Corpusbreed gemeten: zesassige afwijkingen
     18.398 → 16.261, ls 4.791 → 3.901, lf 4.781 → 3.891, tf 4.592 → 4.235; alle beweging zit in
     één bestand (rehab-2), de overige 33 zijn byte-identiek. Vier dingen die je moet weten vóór
     je hier verder bouwt:
     - De winst hangt aan klasse (ii). Per cel op rehab-2: 890 ls- en 890 lf-cellen worden exact,
       **0** verslechteren; tf wint er 572 en verliest er **215**. Alle 215 zijn voltooide
       taken waar P6 `tf = 0` geeft en onze afgeleide LS nog van een zélf foute opvolger-LS komt.
       Vóór deze etappe was hun `tf = 0` degeneratie (LS = de historische actual-start), dus per
       ongeluk goed. Een fixpuntoplossing op P6's eigen opvolgerwaarden dekt 98,8%, op de onze
       44,4% — klasse (ii) is dus de vervolgstap, niet een losstaand dossier.
     - `drivingPath` verliest 6 cellen (`87418, 87419, 87420, 87421, 87422, 87426`). Dat is geen
       ruis: het zijn zes OPEN taken waarvan ls/lf/tf nu exact P6 worden, inclusief `tf = 0`,
       waarna onze `isCritical = tf ≤ drempel` ze kritiek maakt terwijl P6's `driving_path_flag`
       `false` zegt. Een systematisch gat tussen OPS-kritiek en P6's driving-padbegrip, blootgelegd
       dóór de verbetering; eigen vervolgetappe.
     - De bewijsbasis is één bestand. Corpusbreed komen 2.042 voltooide taken door de poort, 2.040
       daarvan in rehab-2. Wat de rest beschermt is de nauwte van de poort (`DT_FixedDUR2` +
       `rem_target_link_flag=Y` + expliciet targetvenster + `CP_Drtn`), niet de regel.
     - De poort staat óók tussen deze regel en de dertien P6-23.12-casussen. In
       `cases-p6-verified.json` casus `09-completed-successor` (open A → FS → voltooide B) geeft
       P6 `LS = ES`, `TF = 0`; wij ook — maar alleen omdat de poort daar dicht staat op
       `missingExplicitTargetWindow` (de echte bron `cases-import.xer` declareert wél
       `rem_target_link_flag=Y` en `DT_FixedDrtn`, maar geen `target_end_date`). Gaat de poort op
       diezelfde topologie open (sectie 3 van de check), dan geeft de regel A tf −5 waar P6 0 zegt.
       `check-p6-verified-cases-engine.ts` haalt alle dertien casussen brongetrouw door de motor en
       pint dat cel voor cel: 156 van 160 cellen eens met P6; de vier afwijkingen (casus 08 A en
       casus 10 B, ES én LS) hebben één oorzaak buiten deze regel — onder `rem_target_link_flag=Y`
       wordt de vroege start van een bezig zijnde taak de reststart, waar P6 de werkelijke start
       opneemt (het orakel draagt daar het `A`-suffix); zie §9. Op de echte bytes zijn het 77/160
       door de projecteinde-fout (`docs/TODO.md`), 156/160 zonder die optie.
     **Bewijsstatus klasse (i) (her-review 7a, 2026-09-07).** De poort van
     `p6CompletedLateFromRemainingWindow` (`DT_FixedDUR2` + `rem_target_link_flag=Y` + expliciet
     targetvenster + `CP_Drtn`) is CORRELATIONEEL, geen P6-mechanisme: de winst is echt en per cel
     gemeten (rehab-2: ls/lf −969, tf −427 netto), maar het énige directe P6-bewijs voor de
     topologie "open voorganger → voltooide opvolger" — casus 09 en 10 van `cases-p6-verified.json`
     (echt P6 23.12) — spreekt de regel tegen zodra de poort daar opengaat (P6 geeft de open
     voorganger tf 0, de regel tf −5). Op de echte bron (`cases-import.xer`) blijft de poort dicht
     op `missingExplicitTargetWindow`; dat is een toevallige nauwte, geen verzoening. Wie de poort
     verruimt, landt met deze regel op honderden ongevalideerde taken. Dossier, geen residu.
  2. *Ontbrekende instellingen afleiden* — **vervalt** (kalibratiemeting 2026-09-04, meting,
     geen aanname): 384 combinaties van échte P6-instellingen over 34 orakelbestanden gaven een
     beste denkbare winst van 1.033 van 18.398 cellen (5,6%), **0 bestanden met een uniek
     optimum**, en op 2 van 9 valideerbare bestanden sprak de afleiding de gedeclareerde
     SCHEDOPTIONS tegen. De vaste defaults uit §X5(b) blijven de weg; kalibratie wordt niet
     gebouwd.
  3. *Opgeslagen datums tonen* (issue #63-mechanisme): voor XER staat "Datums zoals
     opgeslagen" standaard aan zodra er restverschillen zijn; de melding noemt het aantal
     afwijkende taken en die taken krijgen een markering in tabel en eigenschappenpaneel.
     Bewerken of F5 verlaat de modus zoals nu. Vereist een §4.1-uitbreiding — het laag-3-
     besluit: de zes orakelkolommen (`early_start_date`, `early_end_date`, `late_start_date`,
     `late_end_date`, `total_float_hr_cnt`, `free_float_hr_cnt`) verhuizen uit de verboden bak
     naar de vierde bak "uitsluitend weergave/meetlat, nooit solverinvoer" (zie §4.1); uren →
     werkdagen via de taak-effectieve kalender, geen `?? rec.start`/`?? 0`-terugval voor XER
     maar een "niet vastgelegd"-representatie. Dekking gemeten: 18.388 van 18.398 cellen.
  Poort: nul verschil na laag 1 voor bestanden mét SCHEDOPTIONS; de rest per bestand gepind met
  aantal en oorzaak. Meetbaar-tellers blijven gepind (M1).
- **X-O8 — VERVALLEN (eigenaar, 2026-09-04, na de kalibratiemeting): afgeleide instellingen
  toepassen en melden.** Was bedoeld voor laag 2 van X-O7 (ontbrekende SCHEDOPTIONS afleiden
  uit een begrensd rooster van échte P6-instellingen, met een opening die de afgeleide waarden
  toont en linkt naar de projectinstellingen). Doordat die laag verviel — geen enkel bestand
  met een uniek optimum — is X-O8 zonder object en vervalt eveneens.

### Afspraken met de etappe taaktypes / opgeslagen werk (2026-09-04)

- **Volgorde**: de taaktypes-etappe start op een main waar XER al in zit; de tweede merge
  (origin/main ná f16bfff7, incl. contour-engine PR #95) volgt direct na de eerste.
- **Curves**: na de tweede merge vervangt `normalizeCurveValues` + `matchCurveValues`
  (`contourEngine.ts`) de eigen `bestFitXerCurve`, met terugval op `P6_NAME_TO_CURVE` op naam;
  de 21 punten gaan naar `ResourceAssignment.curveValues`. Corpusfeit: RSRCCURV bestaat niet,
  alleen RSRCCURVDATA (kolommen `pct_usage_0`..`pct_usage_20`, lineair); `curv_id` is
  corpusbreed 2× gevuld. Het pad hoeft correct te zijn, niet rijk.
- **Taaktype**: `Task.p6DurationType` (pset `OPS_P6Progress`, property `DurationType`) is de
  opslag waar de taaktypes-spec naar verwijst; de spec definieert alleen de vertaling van
  `mspTaskType`+`effortDriven` naar dezelfde vier keuzes. Het neutrale documentveld bouwt de
  taaktypes-etappe, niet XER. `p6xmlReader` leest `<DurationType>` nog niet: meenemen zodat
  beide P6-paden gelijk zijn. Corpusfeit: `DT_FixedRate` 0× in het corpus, `DT_FixedQty` 153×
  in 2 bestanden.
- **Opgeslagen werk**: geen nieuw modelveld vanuit XER. De spec definieert het eersteklasveld
  op `ResourceAssignment`; XER zet het daarna over uit het bronarchief — alleen wanneer
  `target_qty` afwijkt van `target_drtn_hr_cnt × target_qty_per_hr`, anders blijft het veld
  afwezig (byte-identiek). Meetlat: HarbourPointe_AssistedLiving (98 afwijkende rijen, factor
  3), Harbour Point DCP-03 (factor 4; `remain_qty` zonder resttarief), p6_torture_test_v1
  (duur 0 met werk), plus 263 rijen zonder `target_qty_per_hr` in 5 bestanden. Corpusbreed: 176
  afwijkende werkrijen in 5 bestanden; het resttarief wijkt af in 27,5% van rehab-2.
- **Additief blijven**: `types/task.ts`, `types/resource.ts`, `taskSlice`, `resourceSlice`,
  `documentContract`, `ifcPsets`, `taskColumnRegistry`, `fieldCoverage`. TODO-registratie in de
  sectie "Contour-engine (2026-09)".

- **X-O7 — VASTGELEGD (2026-09-05, met één genoteerde uitzondering): een fidelity-stap mag geen
  as slechter maken.** De regel bestaat om te voorkomen dat een totaalcijfer gekocht wordt door
  fouten van de ene as naar de andere te verschuiven. Hij verbiedt níét elke stap die een
  *compensatiefout* blootlegt.

  **Uitzondering, etappe 7b (weekend-klemherstel in `xerCalendarData.ts`).** Deze stap verbetert
  ls/lf/tf/ff met 1.426 cellen en verslechtert es/ef met 449 (es 618→940, ef 813→940 op
  `rehab-2.xer`; 344 resp. 327 taken nieuw fout, 281× één en 56× twee werkdagen te laat, vrijwel
  alle op de 842-kalendergroep). De uitzondering is toegestaan omdat de BRON de kalender bevestigt
  en de rest als dossier is geregistreerd:

  1. P6 zet nul ES/EF/LS/LF ín alle negen gereconstrueerde blokken tegen 811 in de drie dagen
     eromheen, en die 811 zit volledig op de vier blokken binnen de projectperiode
     (167/214/178/252) terwijl de overige vijf 0 ín én 0 in de rand hebben en dus niets bewijzen;
  2. P6's eigen opgeslagen vensters tellen op de OUDE kalender 10,00 werkdagen voor een taak van 7
     (`V3109400`) en 24,00 voor een taak van 21 (`V3109300`) — intern inconsistent — en op de
     gereconstrueerde kalender exact 7,00 en 21,00.

  Daaruit volgt dat een deel van de eerdere es-treffers een compensatiefout was tussen een te korte
  kalender en een te vroeg startanker. Zulke fidelity is niet beschermenswaardig, en een regel die
  deze stap blokkeert maakt de volgorde onmogelijk: het ankergat is niet te diagnosticeren zolang de
  kalender de fout in de vensterlengte verstopt. **Een geschonden planregel zonder geschreven
  uitzondering is een tijdbom voor de volgende reviewer — vandaar deze notitie.**

## §6 Banen en taken

Vier banen, elk een eigen worktree (`.claude/worktrees/xer-{meetlat,lezer,motor,data}`).
X-nummering; volgorde binnen een baan is dwingend, banen parallel na X0/X1.

### SERIEEL VOORAF

**X0 — Typen, harness-skelet, superset-registratie.** Task-/ImportResult-velden als
compile-gedekte typen: P6-duration-type en -activiteitstype als eigen opgeslagen velden naast
`mspTaskType` (veld-als-signaal geldt ook voor typen), mét de vastgelegde afspraak dat de
latere taaktypes-etappe beide naar één interne superset mapt; suspend/resume-herkomstvlag
(X7); corpusscan-tooling (`OPS_XER_CORPUS`). Geen registry-entry (die komt bij X4).
**Acceptatie**: typecheck-poorten; lege-lezer-run produceert een lege maar welgevormde
baseline; mutatiebewijs: een veld uit de typelijst verwijderen ⇒ compile-fout in het
harness-skelet.

**X1 — De meetlat éérst (baan M).** Eerst de meetkern eerlijk maken (planreview F2):
`measureFidelity` roept vandaag hard `solveMppBytes`/`scanGroundTruthTasks` aan — X1 begint
met het uitfactoriseren van het formaat-agnostische deel (`classify()`, de rijvorm, de
delta-administratie) naar een gedeelde kern, mutatie-bewezen byte-identiek voor de bestaande
.mpp-suite. Daarop: `xerGroundTruth.ts` (onafhankelijke %T/%F/%R-scan, zes assen + status +
act-datums + `driving_path_flag`, eigen encoding-afhandeling), `xerFidelity.ts`,
`check-xer-fidelity.ts` met **per-project-meting binnen het bestand** (X-O1: één bestand
kan meerdere projecten dragen; de grondwaarheidsscan leest álle taken, een opgelost document
draagt er één project van — de meetkern krijgt dus een expliciete per-project-lus in plaats
van de bestaande alles-of-niets-assertie op de taaktelling) en per-bestand-pinning van de
som, gededupliceerd per §2 (byte-hash + schema-vingerafdruk), per as afwijkings- én
meetbaar-tellers,
`OPS_XER_FIDELITY_REPORT`-modi, reason-verplichting bij elke niet-nul-pin. Plus de
p6-comparison-extractie naar `cases-p6-verified.json`: uitsluitend de `*_p6`-kolommen, mét
tijden, met een generator-script en een herkomstkop die de M4-voorbehouden documenteert.
**Acceptatie**: mutatie-bewezen (meetlatveld verleggen ⇒ rood; meetbaar-teller verlagen ⇒
rood); de .mpp-suite draait byte-identiek op de uitgefactoriseerde kern.

### BAAN F — formaat en lezer

**X2 — XER-grammatica.** `src/services/xer/xerTables.ts`: ERMHDR (versie + veld 9 =
default-valuta), %T/%F/%R/%E, tabs zonder escaping, `""`-quotes, DEL-DEL-multiline in
notitievelden (incl. BOM/NUL-strip — herkomst MPXJ `NotesHelper`), de lege-eerste-token-
continuatieregel, onbekende tabellen overslaan, en de **CURRTYPE-tweepas** conform X-O5
(inclusief token-decodering en de geen-CURRTYPE-default). Encoding per X-O4. Fout-tolerantie
als bewuste keuze: kapotte rijen verzamelen in een import-rapportstructuur (geen stille skip,
geen harde crash); de openingsmelding (X10) toont het aantal. De enum-tokenregel
(§4.7) geldt in de semantische lagen (X4a/X5), niet hier — de tokenizer kent geen enums;
X2 levert alleen de rauwe tokens plus de lege-kolomnaam-afhandeling (afsluitende tab). **Failure-mode-model
(gecorrigeerd, planreview)**: de echte poort is *verplichte P6-kolommen ontbreken ⇒ typed
fout* — het corpus bevat namelijk pseudo-XER-bestanden mét `%F`-headers maar niet-P6-kolommen
(`p6xer-basic.xer`: `Task_ID`/`Start_Date`/`Duration`); die mogen nooit als leeg-maar-geldig
project openen. **Acceptatie**: de robuustheids- en `kedular-*`-bestanden gepind op hun
verwachte rapportinhoud (NB: `p6xer-encodings.xer` is géén kapot bestand — geldige UTF-8 met
verzonnen tabelnamen; pin hem als "onbekende tabellen overgeslagen"); synthetische fixtures
per grammaticaregel; mutatiebewijs: CURRTYPE-tweepas uitschakelen ⇒ het komma-decimaal-fixture
ROOD.

**X3 — De kalenderdecoder (DE KRITIEKE TAAK, zie §1-granulariteit).**
`src/services/xer/xerCalendarData.ts`: de structured-text-grammatica
(`(nr||naam(veld|waarde|…)(kinderen…))`, DEL-DEL-gescheiden) als eigen tokenizer; DaysOfWeek
(dag 1-7, s/f-uurblokken, 24-uurs én AM/PM-notatie), Exceptions (`d|n` = dagen sinds
1899-12-30, mét of zónder afwijkende uren), lege kalender ⇒ P6-default ma-vr 08:00-16:00,
`base_clndr_id`-hiërarchie in een tweede pas, `clndr_type`, en de uren-per-periode-velden met
de afleiding-uit-weekuren als **hoofdpad** (gemeten: in `rehab-2.xer` is `day_hr_cnt` voor
alle 124 kalenders leeg). **De XER-uurmodus-discriminator wordt hier expliciet uitgeschreven
en apart geaccepteerd (planreview V1)**: de bestaande promotieregels (a) >1 band/dag,
(b) middernacht-wrap, (b2) ≥1440 min dekken een één-bands-kalender 08:00-16:00 niet, terwijl
het orakel wél 16:00-tijden draagt — de XER-lezer krijgt een eigen (c)-anker
("XER-kalenderbanden dragen kloktijden ⇒ promoveerbaar"), met blast-radius-meting over het
corpus en een pin op het aantal gepromoveerde kalenders per bestand. **Acceptatie**:
corpusloze fixtures per grammatica-element (incl. AM/PM en de epoch-conversie); corpuspin op
het 124-kalender-monster; pariteitstest tegen de P6-XML-kalenderroute op een equivalent paar —
waarvoor `parseP6StandardWorkWeek` (nu niet-geëxporteerd, `p6xmlReader.ts:96`) geëxporteerd
wordt of de toets via `readP6XML` loopt; mutatiebewijs: de weekuren-afleiding uitschakelen ⇒
de rehab-pin ROOD.

**X4a — Kern-mapping + registry-entry (enkelproject).** `src/services/xer/xerReader.ts`,
eerst voor het geval één (niet-leeg) project — dit deblokkeert baan S en D. De PROJECT-rij
van dat ene project hoort hier (delta-check: die viel bij de knip tussen wal en schip):
projectnaam, datadatum, projectkalender-verwijzing en default-valuta; de *selectie* uit
meerdere projecten is X4b. PROJWBS (sorteren op `(parent_wbs_id, seq_num)`;
**WBS-rijen worden verzameltaken in onze bestaande structuur, nooit extra bladtaken — de
taaktelling moet 1:1 op het orakel passen, anders klapt elke meting** — planreview V8), TASK
(statussen; milestones uit het activiteitstype, **case-insensitief** — het corpus bevat
`TT_mile`/`TT_finmile`-kleine-lettervarianten; `TT_LOE` → `isHammock`; `TT_Rsrc` (2 corpusrijen)
en `TT_WBS` (1 rij) worden **als data gelezen, als gewone taak gepland en in de melding
genoemd** — geen eigen rekenmodel deze etappe, wél elk een synthetische fixture; duration- en
activiteitstype als opgeslagen data), TASKPRED (`PR_*` én de prefixloze variant uit 3 echte
bestanden — 5 dragers, waarvan 2 pseudo-XER die X2 weigert), constraints (`CS_*` incl. mandatory → `hard`), `ExternalRelation` voor
cross-project-randen. Format-registry-entry (`kind: 'text'`, lazy chunk, `canBeSaveTarget`
blijft IFC-only), i18n-foutmeldingen 14 talen. **Acceptatie**: eerste fidelity-nulmeting
draait en pint; `crawl-xer/p6diff-baseline.xer` (8 taken, alle zes assen) en
`crawl-xer-extra/p6difftool/sample-target.xer` exact op de datum-assen (planreview M5: de
`xer-corpus/cases/*`-fixtures dragen géén orakel en zijn parser-poort, geen fidelity-poort);
mutatiebewijzen: de prefixloze-`PR_`-tak uit ⇒ de **3** echte bestanden met een prefixloos
`pred_type` ROOD (her-check: 5 dragers waarvan 2 pseudo-XER die X2 weigert); de
case-insensitieve typematch uit ⇒ de kleine-letter-fixture ROOD.

**X4b — Meervoudige import en baselines (X-O1 + X-O2 — dit ís de X-O2-taak).** Het
meervoudig-`ImportResult`-pad in de open-pijplijn (het eerste formaat dat één bestand tot
meerdere documenten opent): projectselectie en lege-project-regel per X-O1,
baseline-materialisatie per X-O2 (gekoppeld baselineproject → OPS-baseline op het
hoofdproject; dangling genegeerd + geteld; de begrenzingsregel dat de uitsluiting de
verzameling nooit leegmaakt, incl. cyclus- en zelfverwijzing), `externalLinks` met
synthetische fixture (nul corpusdekking), en een open-tijd-meting op het
15-projecten-bestand. **Acceptatie**: `stack_data_center_baseline.xer` levert één document
mét OPS-baseline; het OZB-bestand opent 12 documenten (3 lege overgeslagen en gemeld, 9
dangling-baselines gemeld); mutatiebewijzen: de begrenzingsregel uit ⇒ de
zelfverwijzings-fixture opent niets ⇒ ROOD; baseline-materialisatie uit ⇒ de
stack-case ROOD.

### BAAN S — motor en semantiek

**X5 — SCHEDOPTIONS en de defaults-vraag.** Twee helften, beide verplicht:
*(a) de tabel lezen* — `sched_calendar_on_relationship_lag` → `lagCalendar` (P6-default:
predecessor), retained logic/progress override → `progressMode`, critical-definitie en
float-modus; **elke kolom uit de corpus-union wordt belegd als gemapt / genegeerd-met-reden /
TODO** (planreview V7 — o.a. `sched_use_project_end_date_for_float` en
`sched_lag_early_start_flag` raken float en hebben geen tegenhanger in `SchedulingOptions`;
die worden op zijn minst geregistreerd), en de mapping verhoudt zich expliciet tot wat
`mppReader`/`mspdiReader` al zetten én tot de `OPS_SchedulingOptions`-IFC-round-trip.
*(b) de defaults-paragraaf (planreview B2 — het meerderheidsgeval!)*: 36 van de 60
orakelbestanden hebben géén SCHEDOPTIONS, waaronder `rehab-2.xer` (60% van het orakel). Voor
die populatie geldt een expliciet vastgelegde default-set, gefundeerd op **de gemeten
meerderheid in de SCHEDOPTIONS-dragende bestanden** (her-check: `sched_float_type` = `FT_FF`
in 41/50 rijen ⇒ finish float — een échte gedragsomslag t.o.v. onze 'smallest'-huisdefault;
retained logic 48/50 aan; open-eindes-niet-kritiek en lag-op-voorgangerskalender sporen met
onze defaults), per default blast-radius-gemeten over het corpus en gepind. **Acceptatie**: de
in-progress/retained-logic- en completed-successor-cases uit `cases-p6-verified.json` groen;
de 36-zonder-SCHEDOPTIONS-populatie per default-keuze gemeten en gepind; mutatiebewijs:
`lagCalendar` naar successor forceren ⇒ de multi-kalender-case ROOD.

**X6 — Resources en toewijzingen** *(parallel aan X5 — geen afhankelijkheid, planreview §5)*.
RSRC/RSRCRATE/TASKRSRC: rollen-vs-resources-ID-naamruimten, units-schalen (1.000.000- en
×100-conventies per veld — herkomst MPXJ, onafhankelijk geverifieerd tegen corpuswaarden),
resourcekalender-koppeling. Curves-dossier klein en afgebakend: 2 corpusrijen met `curv_id`
plus RSRCCURVDATA (21-punts verdeling) — best-fit naar onze curve-typen, met de rauwe 21
punten als opgeslagen data (eigenaarsprincipe; `timephasedContours`-patroon). **Acceptatie**:
corpuspins op `Roads_Project_TEC.xer` en `rehab-2.xer`; geen datumbeweging op bestanden zonder
resources; mutatiebewijs: de units-schaal op ×100 zetten ⇒ de resourcecase ROOD.

**X7 — Suspend/resume en voortgang.** P6's suspend/resume ↔ `TaskTime.stop`/`resume`: het
veld bestaat, maar de solver-semantiek eromheen is de MSP-conventie uit etappe 1 — eerst meten
(22 corpustaken met suspend), dan per verschil een bron-vlag (O6-patroon). Voortgang per
`complete_pct_type` met **een expliciet criterium per variant (planreview V5)**: `CP_Drtn`
(16.813 taken — percentage stuurt restduur), `CP_Phys` (1.492 — percentage stuurt de datums
NIET; restduur komt uit `remain_drtn_hr_cnt`) en `CP_Units` (8 — idem, units-gedreven; als
data gelezen, gedrag gelijk aan CP_Phys deze etappe, geregistreerd). `expect_end_date` (246
cellen, 3 bestanden) uitsluitend gehonoreerd wanneer `sched_use_expect_end_flag` het zegt
(planreview V6) — anders als data bewaard. **Acceptatie**: het out-of-sequence-scenario uit de
P6-geverifieerde cases groen; de suspend-dragende bestanden gepind; mutatiebewijs op elke
nieuwe vlag-tak én op de CP_Phys-scheiding (percentage wijzigen ⇒ datums bewegen NIET).

### BAAN D — data en randen

**X8 — Activity codes, UDF's, notities.** ACTVTYPE/ACTVCODE/TASKACTV → `activityCodeTypes`
(119.878 corpus-koppelingen — prestatie meten op `rehab-2.xer` en het Hotel-schema);
UDFTYPE/UDFVALUE → `customFieldDefs`; memo-tabellen → taaknotities (DEL-DEL uit X2).
**Acceptatie**: IFC-round-trip aangetoond; tellingen gepind; mutatiebewijs: de
TASKACTV-koppeltabel overslaan ⇒ de telling-pin ROOD.

**X9 — Documentcontract, round-trip, exportranden én de P6-XML-drift.** Alle nieuwe velden
door documentcontract en IFC-round-trip; exportranden warnen (patroon etappe 1);
`moveProject`-verdicten; MCP-leeskant conform het etappe-1-besluit. **Nieuw (planreview V3)**:
na deze etappe leest een `.xer` méér P6-data dan onze eigen `.xml`-lezer (activity codes,
UDF's, typen, schedulingOptions) — die asymmetrie wordt niet stil: een geregistreerd besluit
plus TODO ("p6xmlReader bijtrekken tot pariteit") én een pariteits-smoketest die de asymmetrie
expliciet documenteert in plaats van hem te laten verrassen. **Acceptatie**: het
Z14-mutatiestramien (property weg ⇒ rood op precies dat veld; byte-identieke examples).

**X10 — Melding en gidsen.** Openingsmelding naar het Z16-model: echte tellingen (kapotte
rijen; geopende projecten, overgeslagen lege projecten en als baseline gematerialiseerde
projecten (X-O1/X-O2); dangling baselines; encoding-keuze bij niet-ASCII (X-O4)), severity
info, 14 talen, CLDR-pluralen. Gidsen (nl+en): "Primavera P6
(.xer) openen" naar het model van de .mpp-gids — elke claim code-/testverwezen, mét de
X-O5-getalnotatie-paragraaf (de derde documentatieplek uit dat besluit), en eerlijk over wat
(nog) niet meekomt (TT_Rsrc/TT_WBS-rekenmodel, curves-als-verdeling, P6-XML-asymmetrie —
multi-document komt per X-O1 juist wél mee en staat in het geopende-projecten-deel van de
melding en de gids). **Acceptatie**: de Z16-mutatiebewijzen (melding/i18n/manifest).

### SERIEEL — afronding

**X11 — Browser-gebruikstest** (aparte agent, tier 1; mag parallel aan X12's residu-iteratie):
de dossierselectie openen (`p6diff-baseline`, `rehab-2.xer`, multi-kalender, negatieve float,
het torture-bestand, en het 15-projecten-bestand als multi-document-stresstest: 12 documenten
in één keer — raakt de auto-save (één recovery-snapshot per document), de documenttabbalk bij
12+ tabbladen en de Ctrl/⌘ 1–9-navigatie die maar tot negen reikt), IFC-opslaan/heropenen met
veldbehoud,
F5-stabiliteit, meldingen en gidslinks, taalwissel, undo/documentwissel — het Z18-draaiboek,
plus: blijft de app vlot op het 119k-koppelingen-bestand.

**X12 — Residu naar nul en de eindpoort.** Detail-rapportage per as → classificeren op
bladniveau → echte fout fixen met bewijs, of escaleren (X-O3); "pinnen met reden" bestaat niet
als uitweg. Daarna `GOAL_ZERO_DEVIATIONS_XER` aan: nul op alle afwijkingstellers, per as
`gemetenExact === meetbaar` én het **gepinde meetbaar-aantal** zelf (planreview M1 — een as
die stil naar nul meetbaar zakt is rood), reason-verbod, en de tweeledige dedup-bewaking (byte-hash + schema-vingerafdruk, §2).
TODO-registraties (XER-export; p6xml-pariteit; driving-path-as als poortkandidaat). Hyperkritische Opus-eindreview over de volledige etappe-diff, inclusief de
whitelist-sluiproute-scan van §4.1.

## §7 Parallellisering

```
X0 ─ X1 (serieel; X1 bevat de meetkern-uitfactorisering + per-project-lus)
          ├── baan F: X2 → X3 → X4a → X4b ─┐   X3 = kritieke taak (uurmodus beslist alles)
          ├── baan S: (na X4a) X5 ─┐       │
          │            (na X4a) X6 ─┤ → X7 ─┤
          ├── baan D: (na X4a) X8 → X9 ──────┤
          │              (na X9 én X4b) X10 ──┤
          └──────────────── X11 ∥ X12 (X11 mag parallel aan de residu-iteratie)
```
X4b (meervoudige import) loopt parallel aan de banen S en D; X10 wacht op X9 én X4b (de
meldingstellingen over geopende/lege/baseline-projecten bestaan pas met X4b), en X11 wacht
op X4b voor de 12-documenten-stresstest.
X5 en X6 zijn onderling onafhankelijk en lopen parallel; X7 wacht op beide (voortgang leunt op
actuals-invarianten én toewijzingen). De meetlat (X1) staat vóór alles — wie eerst bouwt en
dan meet, meet zijn eigen aannames.

## §8 Risico's, eerlijk benoemd

1. **De float-assen zijn onontgonnen terrein**, en het defaults-gat maakt het scherper: voor
   60% van de orakelbestanden (36 van 60, incl. de grootste massa) bepalen ónze
   default-aannames de late datums en de float. X5(b) is daarom geen administratie maar een
   meetprogramma. Negatieve float zit in **zes** bestanden (45/6/6/3/2/1 taken — planreview
   B4; het concept zei twee), waarvan vijf zonder SCHEDOPTIONS — dat wordt een dossier.
2. **`clndr_data` is de bytepuzzel én de kritieke taak** — de uurmodus-promotie (§1) en de
   uren-per-dag-afleiding (hoofdpad, niet randgeval) bepalen de meetbaarheid van élk bestand.
3. **Encoding en getalnotatie zitten ín het bestand** (X-O4/X-O5); fouten hier zijn stil.
   Vandaar eigen fixture-batterijen in X2 en de meldings-mitigatie.
4. **Schaal**: `rehab-2.xer` (6.976 orakeltaken, 52.640 toewijzingen, 81k code-koppelingen) is
   ~2× het grootste bestand dat de app ooit las; X11 meet het expliciet.
5. **Scope**: multi-document-import en baseline-materialisatie zijn per eigenaarsbesluit
   onderdeel van de etappe geworden (X-O1/X-O2) — dat is de bewuste verzwaring; XER-export,
   het TT_Rsrc-rekenmodel en p6xml-pariteit blijven begrensde vervolgtrajecten. De goal is
   lezen-getrouw-op-vier-assen; de multi-documentroute is er de gebruikerszichtbare helft van.

## §9 Dossiers uit de etappe

### 7b-4 — forward-anker na gereconstrueerde kalenderblokken

**Status:** geregistreerd, niet gebouwd. Ontstaan bij etappe 7b (weekend-klemherstel), her-check
2026-09-05.

**Wat er staat.** Op `rehab-2.xer` verschuiven 344 ES- en 327 EF-cellen van goed naar fout
(es 618→940, ef 813→940), 343 daarvan op de 842-kalendergroep; 281× één werkdag te laat, 56× twee,
2× zes en 3× elf. Ze lopen van 2008-11 t/m 2010-03, dus vanaf direct ná het oktoberblok.

**Wat het NIET is.** Geen kalenderfout. Gemeten op de gereconstrueerde kalender telt ons ES→EF-venster
voor alle vijf de getraceerde taken exact evenveel werkminuten als dat van P6:

| taak | duur | P6-venster op de OUDE kalender | op de NIEUWE kalender | ons venster (nieuw) |
|---|---|---|---|---|
| `V3109400` | 7 d | 10,00 werkdagen | 7,00 | 7,00 |
| `V3109300` | 21 d | 24,00 werkdagen | 21,00 | 21,00 |
| `V3109420` | 7 d | 7,00 | 7,00 | 7,00 |
| `V3109220` | 3 d | 3,00 | 3,00 | 3,00 |
| `V3109480` | 7 d | 7,00 | 7,00 | 7,00 |

De duurwandeling klopt dus; alleen het STARTANKER ligt één tot twee werkdagen te laat. Concreet:
P6 zet `V3109400` op 2008-12-04 → 12-24, wij op 12-06 → 12-25 — hetzelfde venster van zeven
werkdagen, twee werkdagen naar rechts.

**Waar te beginnen.** Die vijf taken, en de vraag wat P6 aan de forwardkant doet dat wij niet doen
zodra een keten een meerdaags vrij blok kruist (kandidaten: retained-logic/voortgangssemantiek rond
de statusdatum, of de `ownAnchor`-vloer voor taken met een voorganger vlak vóór een blok).

**n=1-basis.** Het weekend-klemherstel zelf is afgeleid uit één bestand van 93
(`crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer`, P6 6.0-export, kalenderdata gedeeld door 119 van
de 124 kalenders). De reconstructie wordt binnen dat bestand door de bron bevestigd (zie de twee
metingen bij X-O7 hierboven). Wat er níét is: een tweede bestand. MPXJ, de referentie-implementatie,
kent het verschijnsel niet en leest de `Exceptions`-lijst letterlijk
(`TableContextReader.processCalendarExceptions`). De poort is daarom bewust record-lokaal en
conservatief — drie eisen op het record zelf, corpusloos gepind in `check-xer-calendar-data.ts`
sectie 22a–22g. Duikt er een tweede bestand op, dan bevestigt of ontkracht dat de regel; het mag er
niet stil op meeliften.

**Meting 2026-09-07 (volledig corpus, per cel, pre-7b `0b8dbeb3^` → nu).** 7b maakte op rehab-2
exact 344 ES- en 327 EF-cellen fout die daarvóór exact waren (bevestigt de tabel hierboven). Van
die 344 taken houden 249 hun venster (ES en EF verschuiven identiek) en liggen 247 één tot twee
werkdagen naar rechts (237× één kalenderdag, 10× twee) — de 7b-4-signatuur; de overige 95 hebben
een niet-identieke ES/EF-verschuiving en horen dus niet (alleen) bij dit dossier. Over ÁLLE huidige
ES/EF-afwijkingen van rehab-2 (940 taken, 1.880 cellen) dragen 345 taken die signatuur: dossier
7b-4 verklaart dus ten hoogste **690 cellen** (2 × 345), waarvan 494 door 7b zelf foutgemaakt.
Bouwbesluit is aan de eigenaar (§10.f); niets gebouwd.

### rem_target_link_flag=Y en de vroege start van bezig zijnde taken (her-review 7a, 2026-09-07)

**Status:** geregistreerd, niet gebouwd. Bron: `check-p6-verified-cases-engine.ts` op de
brongetrouwe transcriptie én de echte `cases-import.xer` (156/160 zonder de projecteinde-fout).
De vier resterende cellen (casus 08 A en casus 10 B: ES én LS) hebben één oorzaak: onder
`rem_target_link_flag = Y` zet de lezer `p6UseRemainingStartForProgress`, en dan wordt de VROEGE
START van een bezig zijnde taak de reststart (statusdatum, of ná de voorganger), terwijl P6 23.12
in `early_start_date` de WERKELIJKE start opneemt en de reststart apart in `restart_date` (bak 2)
bewaart. Klasse (ii)-materiaal (bezig zijnde taken rond de statusdatum, X5-vlag), geen 7a.

### Projecteinde valt terug op de projectstart bij leeg `plan_end_date` (her-review 7a, 2026-09-07)

**Status:** geregistreerd in `docs/TODO.md`, niet gefixt. `sched_use_project_end_date_for_float = Y`
zonder `plan_end_date` en zonder één `target_end_date` (de echte `cases-import.xer`) ⇒ het
taak-afgeleide projecteinde is de projectSTART en de hele late zijde verankert daarop: 77/160
P6-cellen zoals gelezen, 156/160 met de optie uit. Gepind in sectie 7 van de engine-check.

### De ONBEKENDE categorieën, gemeten (2026-09-07, volledig corpus)

- **Sameday** (zelfde dag, ander tijdstip): 415 cellen corpusbreed, ongewijzigd sinds de
  v2-baseline: `groupdocs-conversion/sample.xer` 280 (70 per as, alle vier de datumassen),
  `Roads_Project_TEC.xer` 67 (ls 58, lf 9), `northstar-previous`/`riverside-previous` 24 elk
  (es/ef 12), `Hotel_Construction_TEC.xer` 13, `Sample_Construction_TEC.xer` 4,
  `planning-risk-intelligent` 2, `Harbour Point DCP-03` 1. Plan §1 eist nul; open categorie.
- **Driving path** (rapportage-as, geen poort): 417 afwijkende cellen op 13.596 meetbare —
  301× P6 `false`/wij `true`, 116× andersom — over 15 bestanden: Hotel 88, rehab-2 86,
  groupdocs 70, TERMINAL BUILDING-AIRPORT 35, OZB 29, gimmer-crag 24, meridianiq 20+18, ashspace
  10, p6diff 8+7, HarbourPointe 7, Harbour Point DCP-03 7, sample-target 4, stack_data_center 4.
  Of die as poort wordt is een eigenaarsbesluit (§3).

## §10 Overdrachtsstand 2026-09-07 — herzien na de integratie (avond)

*Herschreven door de Claude-sessie die op 2026-09-07 de etappe overnam, 7a en laag 3 landde en de
PR naar main voorbereidde. De ochtendversie van §10 (kop `1206e010`) is vervangen; wat daar
stond en nog geldt is hier opgenomen. Labels: ZEKER (zelf gemeten of in git controleerbaar),
AFGELEID (uit een subagentrapport, niet zelf nagemeten), ONBEKEND.*

### 10.0 Waar het werk staat

- **ZEKER.** Etappebranch `claude/file-formats-support-phase-3-a0ebe2`; bevat origin/main t/m
  `d808fdec` (PR #107). Gelande banen sinds de ochtend, in deze volgorde en telkens met de X12-
  tellers vóór/ná in het merge-commit: `claude/xer-7a` (kop `63901793`, = `bd1a7ab3` + fixronde op
  de her-review), `claude/xer-6` (kop `dd8331a1`, = `6f6013e6` + fixronde op de her-check; daarna
  ronde 2 `213d6f5a` op de etappebranch), origin/main (`365ff274`), één herpin (`c6f4ac2a`), docs
  (`15e76f23`), 7a ronde 2 (`1339d9b9`). De zijbranches `claude/xer-6`/`-7a` op origin dragen de
  oude koppen; de fixcommits staan alleen lokaal en in de merges — historie, geen werk meer.
- **ZEKER.** Reviewspoor van deze dag (rapporten in de sessie-scratchpad, niet in de repo): 7a
  her-review → LANDEN-MET-FIXES (7 must-fixes) → fixronde → her-check LANDEN-MET-FIXES (2 doc-
  punten + 3 kleine) → ronde 2; laag 3 her-check → LANDEN-MET-FIXES (5 zwaar) → fixronde → her-check
  LANDEN-MET-FIXES (R1 blokkerend + R2–R5) → ronde 2. De letterlijke bevindingenlijsten staan in de
  commitberichten van `63901793`, `dd8331a1`, `213d6f5a`, `1339d9b9`.

### 10.a Het corpus

- **ZEKER.** Volledig reproduceerbaar op een verse machine: de privé-repo
  `OpenAEC-Foundation/ops-xer-corpus` (kop `e141664`) draagt `crawl-xer/`, `crawl-xer-extra/` (met
  `MANIFEST.md`), `pmxml-samples/`, `CORPUS-OVERZICHT.md` en `MANIFEST.md`; de zes git-clones uit de
  ochtendversie (cpp-cpm-engine `c279a5c`, delay-analysis-toolkit `ecab947`, mpxj `68d36e9` — alleen
  de `.xer`-fixtures zijn nodig —, P6-Viewer `c32dc4c`, ProjectLens `fe33382`, p6flow `637c12e`)
  ernaast in dezelfde corpusroot (zonder `.git`) geeft **93/93 sha256-treffers, 45/45 orakel, 0
  extra `.xer` buiten het manifest**. `OPS_XER_CORPUS` wijst naar die root. De corpusgebonden checks
  eisen het VOLLEDIGE manifest (`buildXerTargetBaseline` gooit bij elk ontbrekend bestand); een
  partieel corpus meet dus alleen via een eigen omweg — die is na 93/93 weggegooid.
- **ZEKER (nog steeds).** De corpus-`.xer`-bestanden liggen buiten de repo; CI draait corpusloos.

### 10.b De stand van X12 (productfidelity)

- **ZEKER.** Eén herpin (`c6f4ac2a`), volledig corpus (34 entries/47 projecten/13.982 taken):
  **18.398** (v2-baseline, vóór 7b) → **17.421** (kop `1206e010`, ná 7b) → **15.056** (nu; 7a+7b,
  laag 3 en main veranderen daar niets aan — gemeten, niet aangenomen). Alle beweging in rehab-2;
  de overige 33 entries zijn byte-identiek aan de v2-baseline. Per as: 7b es +322/ef +127 slechter
  (gedocumenteerde uitzondering), ls/lf/tf/ff beter; 7a ls −969, lf −969 (diff→exact, 0 andersom),
  tf netto −427 (642 beter, 215 slechter — alle 215 `TK_Complete`/`DT_FixedDUR2` met P6 tf 0),
  drivingPath 80→86. Herpind: v2-baseline, in-bron `EXPECTED` van de corpusloze poort (met de
  attributie als toelichting), blast-radius-baseline, task-replay-pin, en de v1-herbasis (harness
  gaf tot 7a de P6-opties niet door; productsolve op die twee bestanden ongewijzigd).
- **ZEKER (sameday).** Corpusbreed 415 cellen, ongewijzigd sinds de v2-baseline (es 96, ef 97,
  ls 129, lf 93, tf 0, ff 0); per bestand in §9. Open categorie — plan §1 eist nul.
- **ZEKER (driving path).** 417 afwijkende cellen op 13.596 meetbare (301× P6 false/wij true,
  116× andersom), 15 bestanden; per bestand in §9. Rapportage-as; promotie tot poort is een
  eigenaarsbesluit dat niet is genomen.
- **ZEKER (7b-4).** Per cel gemeten (§9): 7b maakte 344 ES + 327 EF fout op rehab-2; 247 taken
  dragen de 7b-4-signatuur (venster behouden, 1–2 werkdagen naar rechts); over alle huidige ES/EF-
  afwijkingen van rehab-2 verklaart het dossier ten hoogste 690 van 1.880 cellen. Niet gebouwd.
- **ZEKER.** Mét corpus is de planningssuite rood op uitsluitend de drie X12-nuldoel-regels
  (by design zolang het nuldoel niet gehaald is); de vierde regel ("baseline is de verse meting")
  is sinds de herpin groen.

### 10.c De stand van X11 (browsergebruikstest)

- **ZEKER.** Nieuw: `tests/browser/recorded-dates.spec.ts` (Playwright, echte bestandskiezer):
  XER met restverschillen opent in de modus, strook noemt Primavera, `lateStart`/`totalFloat`
  tonen "Niet vastgelegd" mét de product-datumnotatie, badge zegt "deels niet vastgelegd" resp.
  Primavera-tekst, Herberekenen verlaat de modus. Groen gedraaid (1 passed).
- **ZEKER (gebruikstest met de gids als meetlat, dev-build in Chromium, 2026-09-07).**
  `ProjectLens/docs/demo/northstar-current.xer`: opent in de modus; strook "You're viewing the
  schedule as Primavera recorded it; recalculating would shift 21 tasks"; openingsmelding "XER file
  opened: 1 project document" + "21 tasks show the dates as Primavera recorded them (not
  recalculated)"; kolom **Late start** via de kolomkiezer toont "Not recorded" op alle bladtaken,
  kolom **Recorded-dates source** toont "Partly unrecorded"; eigenschappenpaneel-badge "Recorded
  data is partly incomplete — see the late/float columns" + Read more; **Recalculate** haalt strook,
  "Not recorded" en de herkomstkolom weg en zet berekende datums. `rehab-2.xer`: opent in de modus
  ("recalculating would shift 940 tasks" = de 940 ES-afwijkingen); ná Recalculate tonen 1.679 van
  2.037 voltooide taken een totale speling > 0 (7a-effect; bv. V3101090: werkelijk einde 15-08-2007,
  late start 04-08-2008, totale speling 59 dagen in het eigenschappenpaneel) — conform de gidstekst
  "een voltooide activiteit toont voortaan een echte totale speling".
- **ZEKER (waarneming, niet gefixt).** (1) In de modus tonen SAMENVATTINGSRIJEN (XER-WBS) een
  opgerolde late start (afgeleid uit de `?? rec.start`-terugval van hun kinderen) terwijl diezelfde
  kinderen "Niet vastgelegd" zeggen; de herkomstkolom toont daar "—". Ontwerpkeuze uit her-check
  R1 (oprollen), eigenaarsbesluit of een samenvatting daar "Niet vastgelegd" hoort te tonen. (2)
  rehab-2's Arabische taaknamen renderen als Windows-1252-mojibake: het bestand is geen geldige
  UTF-8 en de X-O4-heuristiek kent alleen 1252 als terugval; de openingsmelding noemt de keuze.
  Pre-existent (X-O4), niet deze etappe; een 1256-/CURRTYPE-taal-hint is een eigen afweging.
- **X11-evidence (`npm run test:browser:x11`) — ZEKER: niet uitvoerbaar vanuit een verse clone.**
  Het script pint `PHASE_2A_BASE = 790d6cd8…` en die commit bestaat in geen enkele ref of tag op
  origin (volledige fetch, 1.948 commits); het git-bewijs stopt dan met "fase-2A-basis niet
  leesbaar" in alle vier de scenario's (small-a, multidoc-help, multidoc-recovery,
  large-resources; Xvfb, Chromium 1194 via `OPS_CHROMIUM_PATH`). De X11-uitkomsten in de
  ochtendversie van deze paragraaf zijn dus alleen op de machine van de eigenaar reproduceerbaar
  (AFGELEID). Fix hoort bij het script: een basis kiezen die op origin bestaat, of de basis uit
  een gepushte tag lezen.

### 10.d Dossier 7b-4

- **ZEKER.** Gemeten, niet gebouwd — §9 draagt de cijfers. Bouwbesluit bij de eigenaar.

### 10.e Poorten op de kop van de branch

- **ZEKER.** Corpusloos `npm run verify` op `1339d9b9`: typecheck, lint, planning 560/560 + 5-TZ-
  matrix, library, mcp 39, dev-server groen; `test:browser` 119 passed / 2 failed — beide
  `just-updated-dialog.spec.ts` op `net::ERR_CERT_AUTHORITY_INVALID` (de TLS-proxy van de
  sessieomgeving vóór de GitHub Releases-API; spec en updater zijn in deze etappe niet geraakt),
  waardoor `verify` daar stopt; de resterende poorten (examples, docs, i18n, store-/gantt-
  boundaries, cycles) los gedraaid: groen. Mét corpus: planning rood op uitsluitend de drie
  nuldoel-regels (10.b). Ná `1339d9b9` kwamen alleen docs en de merge van PR #108 (typecheck,
  lint, i18n, docs, X12 15.056 opnieuw gemeten).
- **ZEKER.** Op deze machine (Playwright 1.62.1 verwacht headless-shell 1234, geïnstalleerd is 1194)
  is `test:browser` alleen te draaien met een alias van de verwachte buildmap naar de geïnstalleerde
  — een omgevingsdetail, niets in de repo.


**Eindreview (2026-09-07, hele diff t.o.v. `origin/main` `d808fdec`, incl. bak-4-sluiproutescan).**
Oordeel: landen-met-fixes. Vier blokkers, verwerkt in de fixcommit ná `f94122d3`: (1) de
whitelist-sluiproute-grep dekte bak 2 niet — mutatiebewijs M-B (`restart_date` achter
`task_type === 'TT_Rsrc'`) kwam door álle corpusloze poorten; nu grept
`check-xer-field-whitelist.ts` bak 2 over heel `src/` met twee gepinde andere-tabel-uitzonderingen
(`PROJECT.plan_end_date`, `SCHEDOPTIONS.critical_drtn_hr_cnt`) en herkent aanroepargumenten op elke
positie; (2) `extractSchedulingOptions` deed `JSON.parse` + cast — nu `sanitizeSchedulingOptions`
(bekende sleutels, enums, eindige getallen), en het commentaar bij `p6SourceActive` in `CPMSolver.ts`
zegt niet meer dat de XER-lezer de enige schrijver is (het IFC round-tript `p6Source` legitiem);
(3) de projecteinde-fout (36 van 39 corpus-SCHEDOPTIONS-rijen met `Y` hebben een leeg
`plan_end_date`, 16 daarvan ook geen `target_end_date`) landt NIET gefixt — een solverwijziging
vraagt een nieuwe corpusmeting en herpin, en de etappe had er één — maar nu wél benoemd in
`gids-xer-import.md` (nl+en) als bekende fout; (4) `check-mpp-fidelity.ts` kon de reviewer niet draaien (geen `OPS_MPP_CORPUS`/`OPS_MPP_CRAWL`);
daarna alsnog gedraaid tegen een sparse clone van `joniles/mpxj` (`junit/data`, 609 `.mpp`, 445
overgeslagen als MPP_LEGACY/MPP_ENCRYPTED): 164 van de 213 gepinde bestanden gezien — de 49
OzBuild-workshopbestanden zijn niet publiek — en op die 164 "0 verbeterd, 0 verslechterd, 164
ongewijzigd"; de enige rode regel is de telling 164 ≠ 213 (bedrijfs-/OzBuild-deel niet
beschikbaar). Het gedeelde relatie-/solverwerk van deze etappe raakt de MPP-datums op het publieke
deel dus niet; de 49 OzBuild-pins blijven ONBEKEND tot de eigenaar ze draait. Kleinere bevindingen, verwerkt: dode `lagCalendar.ts` weg en drie stale docblokken
bijgetrokken; drie Nederlandse holidaynamen in het IFC ⇒ Engels (`'Calendar exception'`,
`'Calendar exception (weekend reconstruction)'`; digest van het 124-dossier herpind om die naam
alleen); het weekend-klemherstel laat nu een herstelcode `WEEKEND_CLAMP_RECONSTRUCTED` /
`XER_CALENDAR_WEEKEND_CLAMP_RECONSTRUCTED` achter (telt mee in de kalenderbevindingen van de
openingsmelding; gids nl+en); de rapporten/PDF krijgen in de modus één melding bovenaan
(`tableReports.recordedDatesNote`, 14 talen) in plaats van de "niet vastgelegd"-poort zelf (die
blijft open, zie 10.f); `importSource` krijgt in de consentdialoog een vertaalde toelichting;
`check-xer-archive-scale.ts` bewaakt de serialisatieverhouding (≤ 1,6 IFC-tekens per bronbyte,
gemeten 1,33) in plaats van "eindig en positief"; CLAUDE.md heeft een XER-sectie. Niet verwerkt
(eigenaar): de onbegrensde archiefretentie (bevinding 1; nu benoemd in de gids), het moment van de
exportverliesmelding (ná het schrijven), een bovengrens op documenten per bestand (VERMOED).

### 10.f Wat niet in het plan staat

- **Valse sporen (nieuw).** (5) "Einde vóór start weigeren" in de vastlegging (her-check laag 3,
  bevinding 6): gemeten en verworpen — P6's voltooid-conventie, 2.049 van 11.953 taken, docblok
  `readXerRecordedTimes`. (6) "Poort dicht in casus 09" als verzoening: de transcriptie was
  onbrongetrouw; brongetrouw is de poort dicht op `missingExplicitTargetWindow` en het bewijs
  correlationeel (§5).
- **Besluiten van de orkestrator die de eigenaar nog moet bevestigen** (ongewijzigd uit de
  ochtend, plus twee nieuwe): heropen-beleid `'xer'` vs `'xer-archive'`; crashherstel behoudt de
  modus alleen met de manifestvlag (v4); CSV/MCP geven bij een niet-vastgelegde as leeg/`null`;
  MCP-provenance toont `name`/`code` zonder opt-in; 7b's ES/EF-regressie onder de X-O7-uitzondering;
  NIEUW: samenvattingen rollen in de modus op uit vastgelegde kinderen (R1; vastgelegde
  samenvattingen blijven staan) en `isCritical` is "niet vastgelegd" onder longest-path-kritiek
  of niet-omrekenbare speling.
  UIT DE EINDREVIEW (2026-09-07), vier nieuwe: (a) onbegrensde bronretentie in projectbestand én
  auto-save (17,7 MB `.xer` ⇒ 50 MB IFC, 73 s / 3,1 GB per herstelronde) — begrenzen, één keer
  schrijven, of bewust accepteren; (b) uitleveren mét de projecteinde-fout (`docs/TODO.md`,
  nu in de gids benoemd) — de fix is drie regels in `deriveXerScheduleOptions` maar vraagt een
  corpusmeting en herpin; (c) `lagCalendar` is effectief geworden voor bestaande niet-XER-
  documenten waarin ooit 'successor'/'24hour'/'projectDefault' is gekozen (stille herplanning bij
  upgrade; releasenotitie nodig); (d) de kalenderdecoder reconstrueert vrije weekenddagen op een
  n=1-basis — nu mét herstelcode en gidstekst, maar de heuristiek zelf blijft een keuze. Plus:
  de "niet vastgelegd"-poort ontbreekt in de tien rapporten/PDF/renderer (0,7–1,6% van de
  corpustaken heeft geen volledig late-paar of geen `total_float_hr_cnt`); in de modus staat er nu
  één melding bovenaan elk rapport, de cel zelf toont nog leeg/0.
- **Bekende losse eindjes.** (1) Zes main-bestanden met `childIds.length > 0` i.p.v.
  `isSummaryTask()` — niet aangeraakt, niet stil om te zetten. (2) `readIFCWithXerReconstruction`
  vs de 7b-kalender op al opgeslagen documenten — niet uitgezocht. (3) rehab-2 heropenen uit IFC
  ±21 s. (4) `DT_FixedQty` alleen in twee bestanden. (5) Dossiers uit de her-reviews die als
  vervolg zijn geregistreerd: bandrand-asymmetrie SS/SF vs FS/FF met lag (gepind, niet
  gesymmetriseerd), de statusdatumklem die ook voorgangers een ruimere LS aanreikt (VERMOED), de
  kalendermix `progressCalendarFor` vs `calendarFor` in de floatformule (VERMOED), bibliotheek-
  refresh in de modus verliest zijn stale-signaal (VERMOED), `applyBackwardBound`/projecteinde
  worden in de completed-late-tak overgeslagen (bewust, nergens opgeschreven behalve hier),
  ongepind duurtype was dicht (nu gepind, 3b). (6) `docs/TODO.md`: projecteinde-fout en
  reststart-ES (§9).
- **Wat ik de opvolger zou zeggen.** PR #101 (taaktypes) merget ná deze PR. Het nuldoel is niet
  gehaald en dat is zichtbaar rood mét corpus; wie verder wil: 7b-4 (690 cellen bovengrens), de
  215 tf-cellen van klasse (ii), sameday (415, waarvan 280 in één bestand met een tijdstip-
  conventie), en de driving-path-as als eventuele poort. Alles wat hier "gemeten" heet staat in
  een commitbericht of in §9 met het commando erbij.
