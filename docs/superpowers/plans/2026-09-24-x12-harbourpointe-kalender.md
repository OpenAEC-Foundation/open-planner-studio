# X12 — HarbourPointe: is het de kalender? (meetonderzoek)

**In gewone taal.** De vreemde tijdstippen in HarbourPointe (16:49, 11:28, 10:40) komen niet van een
andere kalender: ze vallen allemaal netjes binnen de werktijden van de kalender die in het bestand staat,
en ze ontstaan doordat vier lopende activiteiten een restduur hebben die niet op een heel uur uitkomt.
Onze lezer en motor rekenen die minuten al goed uit. Het grootste deel van de 124 afwijkingen (81) komt
door acht activiteiten waarvan de duur in het bestand niet klopt met de datums die P6 zelf heeft opgeslagen;
die oude duur staat nergens in het bestand, dus die cellen zijn niet af te leiden. De rest is de
ALAP-keten (bekend als geparkeerde C10) plus een paar kleine restjes.

Model: Claude Opus 5.5 (uitvoerder-opus-midden). Kop: `066dfa43` (X12 284). Bestand:
`crawl-xer/HarbourPointe_AssistedLiving.xer`, sha256 `b9547eb9…0167`, 131 taken in project 4408, ERMHDR
17.12 (export 2018-06-23), data date `2011-05-01 00:00`. Alleen gemeten; `src/` is ongewijzigd
(`git diff --exit-code src` = 0). De tijdelijke experimenten staan onder *Experimenten*.

## Uitkomst in één tabel

Volgorde: eerst de duur-tegenfeit, daarna de ALAP-anker-tegenfeit op wat overblijft. Onder die tweede
tegenfeit worden 3 cellen die eerst exact waren inexact (EC1430 ff, EC1810 ff en EC2380 ff: de ALAP-keten
staat dan te vroeg). Die tellen hieronder niet mee, want het zijn geen cellen van de 124. Beide zijn
**diagnose**: ze gebruiken wat P6 heeft uitgerekend als invoer (bak 4) en mogen nooit zo gebouwd worden.

| oorzaak | cellen | afleidbaar? |
|---|---:|---|
| (1) acht taken met een duur die niet past bij P6's eigen ES→EF (verouderde uitvoer) | **81** | nee, de oude duur staat niet in het bestand |
| (2) ALAP-wortel/-keten: het geplande begin wordt als anker gebruikt (na (1)) | **25** | deels; de naïeve regel breekt Hotel (regel A), zie H2/H3 |
| (3a) ALAP-verschuiving per dag in plaats van per minuut (EC1420/EC1430/EC1810 es/ef/tf) | 9 | ja, dit is C10 (geparkeerd) |
| (3b) eindmijlpalen EC2400 (es/ef/tf) en EC2390 (es/ef/tf/ff) op de geplande-beginvloer van 07:00 | 7 | onbekend, n = 1 bestand |
| (3c) EC1600 tf/ff: orakel 396640,00002 tegen 396640 (6-decimale uren) | 2 | meetlatrest, geen motorfout |
| **totaal** | **124** | |

Per as (X12-detail, gelijk aan de gepinde stand): es 18, ef 21, ls 23, lf 19, tf 32, ff 11 = 124.

## Vraag 1 — kent `clndr_data` minuten, en decoderen wij goed?

**BEVESTIGD: de drie kalenders hebben alleen hele uren. Onze decoder en een eigen minimale decoder geven
precies dezelfde banden.**

| clndr_id | naam | type | banden ma–vr | uitzonderingen |
|---|---|---|---|---|
| 178 | Corporate - Standard Full Time (default) | CA_Base | 08:00–16:00 | 24 vrije dagen, zonder eigen banden |
| 5829 | Trades - 5 Day Workweek (**PROJECT.clndr_id, alle 131 taken**) | CA_Base | 08:00–12:00, 13:00–17:00 | 24 vrije dagen, zonder eigen banden |
| 6565 | Carpenters Shared 5x8 (base 178) | CA_Rsrc | 08:00–16:00 | 24 vrije dagen, zonder eigen banden |

- `decodeXerCalendarData` (via `parseXerTables`) geeft voor 5829 `{start:480,end:720},{start:780,end:1020}`
  op ISO 1–5, 24 vrije dagen, geen werkende uitzonderingen en geen herstelcodes. De kalender die `readXER`
  aan de motor geeft (`calendar.workTime`) is exact dezelfde. Er wordt niet afgerond en er is geen
  `day_hr_cnt`-normalisatie die iets verandert (`day_hr_cnt` = 8 = de banden).
- Het formaat kent wel minuten (`s|HH:MM`), maar dit bestand gebruikt ze niet. Geen enkele uitzondering
  `(d|…)` heeft eigen banden.
- Het uitgangspunt van de bouwagent ("P6-waarden op minuten die de opgeslagen kalender niet kent") klopt dus
  niet. De minuten komen uit **fractionele restduren** van vier lopende taken op 5829, vanaf data date
  `2011-05-02 08:00`:

| taak | remain_drtn_hr_cnt | minuten | P6 EF | = 08:00 + minuten op 08–12/13–17 |
|---|---:|---:|---|---|
| EC1290 | 7,816667 | 469 | 2011-05-02 16:49 | ja |
| EC1240 | 26,666667 | 1600 | 2011-05-05 10:40 | ja |
| EC1200 | 39,716667 | 2383 | 2011-05-06 16:43 | ja |
| EC1180 | 51,466667 | 3088 | 2011-05-10 11:28 | ja |

Opvolgers erven die tijdstippen (P6 laat een FS-opvolger om 16:49 op dezelfde dag beginnen). **Onze motor
rekent deze minuten al goed uit**: geen van deze vier taken zit in de restcellen, en OPS schrijft zelf ook
16:49/11:28 (bv. EC2170 ef ops `2013-04-25T16:49`, EC2420 ops `…T16:49`).

## Vraag 2 — op welke kalendergrens valt elk P6-tijdstip?

Van de 124 cellen zijn er 81 datumcellen (es/ef/ls/lf) en 43 speling-cellen (tf/ff).

| telling (datumcellen, n = 81) | taakkalender 5829 | 178 | 6565 |
|---|---:|---:|---:|
| precies op een bandgrens | 0 | – | – |
| binnen een werkband | **81** | 46 | 46 |
| buiten werktijd | 0 | 35 | 35 |

- **(a) De taakkalender zoals wij hem decoderen: 81/81 datumcellen liggen binnen een werkband van 5829.**
  Geen ervan ligt op een bandgrens; dat verwachtten we ook niet, want de tijdstippen komen uit fractionele
  duur en niet uit een grens.
- **(b) Een andere kalender: uitgesloten.** 35 van de 81 (alle 16:49/16:43) liggen buiten werktijd van
  178 en 6565 (die stoppen om 16:00). De andere 46 (10:40, 11:28) passen ook in 178/6565, dus die zeggen
  niets. Alle taken en de TASK.clndr_id staan op 5829. De resourcekalender 6565 zit op 68 toewijzingen
  (Rough/Finish Carpenter), maar geen P6-datum volgt 6565. De lag-kalender (`rcal_Successor`) is ook 5829.
- **(c) Geen enkele kalender: 0.**
- Speling-cellen: **32/32 tf** zijn precies de werkminuten tussen P6's eigen EF en LF op 5829, en **11/11 ff**
  zijn precies de werkminuten tot de vroegste opvolgergrens op 5829 (EC1600 op 0,00002 min na).
- Breder: alle 452 early/late-datums van de 113 niet-voltooide taken liggen op 5829 (445 binnen een band,
  7 op een grens, 0 buiten werktijd).

**Conclusie van vraag 2: (a) domineert, 100 %.** Toch zijn de cellen niet exact. De oorzaak is geen
kalender- of lezerfout maar zit in de duur (H1) en in ALAP (H2/H3).

## H1 — de duur past niet bij P6's eigen datums (81 cellen)

**BEVESTIGD:** bij 105 van de 113 niet-voltooide taken is `werkminuten_5829(P6 ES, P6 EF)` precies gelijk
aan `remain_drtn_hr_cnt × 60`, ook als er feestdagen in de span vallen (bv. EC1550: 1968 h met 48 feestdaguren).
Dat bewijst nog een keer dat kalender en feestdagen kloppen. Bij 8 taken is P6's span **korter** dan de
opgeslagen restduur:

| taak | P6-span (h) | remain = target (h) | verschil | langste toewijzing (lag + qty/rate) |
|---|---:|---:|---:|---|
| EC1430 (ALAP) | 696 | 720 | 24 | Concrete lag 24 + 696; PM 720 |
| EC2380 | 96 | 144 | 48 | PM 144 (Concrete 96) |
| EC2170 | 1968 | 2208 | 240 | Electrician lag 240 + 1968 |
| EC2200 | 1944 | 2184 | 240 | Electrician lag 240 + 1944 |
| EC2410 | 720 | 920 | 200 | Electrician lag 200 + 720 |
| EC1590 | 696 | 720 | 24 | PM 720 (anderen 696) |
| EC1680 | 840 | 864 | 24 | Concrete lag 24 + 840 |
| EC2060 | 480 | 552 | 72 | Concrete lag 72 + 480 |

- De opgeslagen restduur is bij alle acht precies `max(lag + remain_qty / remain_qty_per_hr)` over de
  toewijzingen (TASKRSRC). P6's eigen span is diezelfde max **zonder** één toewijzing: de gelagde, of de
  langere PM-toewijzing.
- **Een vaste regel "P6 telt toewijzing X niet mee" bestaat niet.** EC1810, EC2090 en EC1280 hebben dezelfde
  vorm als EC1590 (Concrete korter, PM 720/960/960 langer), maar dáár volgt P6's span wél de PM-toewijzing.
  Dezelfde invoervorm geeft dus verschillende uitkomsten. Geen `driving`-vlag in TASKRSRC (kolommen
  gecontroleerd) maakt het verschil.
- Diagnose-kolommen (bak 2, alleen gelezen voor dit onderzoek, nooit in de lezer): bij de acht taken passen
  `restart_date`/`reend_date` en `target_*` bij de **nieuwe** duur. Voorbeeld: EC2170 reend `2013-04-25 16:00`,
  dezelfde dag als ons EF `2013-04-25T16:49`. `early_*` past bij de oude duur (`2013-03-14 16:49`).
  `target_start→target_end` sluit bij alle 69 niet-gestarte taken aan op `target_drtn` (tolerantie 1 u).
  De tijden staan daar wel steeds een uur verschoven (07:00/16:00), een exportartefact dat ook in X12
  elders speelt. Het bestand komt uit 2018 (ERMHDR 17.12), met data date 2011.
- [VERMOED] De acht taken zijn na de laatste doorrekening bewerkt (toewijzing/lag). P6 werkt de restduur
  en de geplande/restdatums dan meteen bij, maar de early/late/float-kolommen pas bij F9. De
  aanmaakdatums van TASKRSRC (2011-03-23) bewijzen de volgorde niet: TASKRSRC heeft geen update-datum.
- **Tegenfeit (diagnose, bak 4 als invoer):** een kopie van het bestand waarin alleen bij die acht taken
  `remain_drtn_hr_cnt`/`target_drtn_hr_cnt` op P6's eigen span zijn gezet. Resultaat: **124 → 43**
  (es 18→12, ef 21→12, ls 23→0, lf 19→0, tf 32→13, ff 11→6), en geen cel slechter. Hierdoor verdwijnen
  álle ls/lf-afwijkingen, en ook de hele late kant van de 11:28-keten (EC1180/EC1280/EC1590/EC1680/EC2060/
  EC2180/EC2190) en de 16:49-keten EC2000…EC2410.
- **Oordeel H1:** niet afleidbaar uit invoerkolommen. De enige bron voor de "oude" duur is P6's eigen
  uitvoer (bak 4), en bak-2-kolommen mogen we niet lezen. Het probleem zit dus niet in onze lezer of motor:
  P6's opgeslagen uitvoer is verouderd ten opzichte van de opgeslagen invoer.

## H2/H3 — ALAP-keten (25 + 9 cellen)

EC1420 (TT_Mile, CS_ALAP, **geen voorganger**) → EC1430 (ALAP) → EC1810 (ALAP) → EC2090 (ook gedreven
door EC2020 + 40 h). P6 legt de keten vrije-speling-nul tegen EC2090: EF EC1810 = ES EC2090 =
EC2020-EF 02-28 16:49 + 40 h = `2012-03-06 16:49`, en dan terug tot EC1420 = `2011-06-24 16:49`.

- Bij ons pakt de wortel EC1420 zijn **geplande begin** als anker (`ownAnchor(scheduleStart)`, rauw voor een
  mijlpaal ⇒ `2011-06-27T07:00`). Dat tijdstip valt buiten elke band van 5829; het is de verschoven
  `target_start_date`. De keten wordt daardoor zo laat dat EC1810 EC2090 gaat drijven. Onze
  `applyAlap` schuift daarna in hele werkdagen en in voorwaartse volgorde.
- **Experiment A** (ALAP-taken: geen geplande-beginvloer in de voorgangerstak): corpusbreed 284 → 296.
  HarbourPointe 0 beter; **Hotel_Construction_TEC 12 nieuw inexact** (HEMSSFI0550, HEMSAFI0550, CIDEEL000).
  Regel A geschonden.
- **Experiment B** (ALAP-wortel ankert op de data date in plaats van het geplande begin): 284 → 284,
  geen effect. De vloer uit A neemt het dan over.
- **Experiment A+B samen:** 284 → 277, maar **21 beter (allemaal HarbourPointe) en 14 slechter** (Hotel 12,
  plus HarbourPointe EC1430 ff en EC1810 ff). **Regel A geschonden, niet landbaar.** [VERMOED] In Hotel valt de
  geplande datum toevallig samen met P6's ALAP-positie. Zonder vloer blijkt daar dat onze ALAP-verschuiving
  per dag telt en in de verkeerde volgorde loopt.
- Na de duur-tegenfeit én het weghalen van de ALAP-vloer (bestandsmutatie) blijven er 21 over. Daarvan
  zijn 18 van de oorspronkelijke 124: 9 ALAP-cellen op precies 11 minuten (ons 08:00/17:00, P6 16:49),
  7 op de eindmijlpalen EC2400/EC2390 en 2 van EC1600. De andere 3 zijn nieuw inexact (EC1430/EC1810/EC2380 ff).
  EC2400/EC2390 krijgen de geplande-beginvloer van `2013-04-29 07:00`: 2 d 14 h na het netwerkvenster, dus
  over de 1-dagdrempel. P6 laat ze op `2013-04-26 16:49`. Ook hier is het verschoven targetvenster de
  aanleiding (n = 1 bestand, niet verder uitgezocht).
- **Oordeel:** de juiste regel is geen vloer-uitzondering, maar **C10: ALAP als vrije-speling-nul op de
  minuut, in omgekeerde topologische volgorde, zonder het geplande begin als anker.** Die raakt HarbourPointe
  (±34 cellen: 25 + 9) en de 3 Hotel-ALAP-cellen samen. Zonder C10 is elke vloer-uitzondering een schijnwinst.

## Experimenten (tijdelijk, allemaal teruggedraaid)

- Bestandsmutaties in `/tmp` (orakel altijd uit het originele bestand, `measureXerProductFidelity` + de
  `solveImported`-kopie uit `check-xer-product-fidelity-x12.ts`): origineel 124 (reproduceert de pin);
  `dur` 43; `noalap` (CS_ALAP weg) 124; `alapnofloor` 105; `dur+alapnofloor` 21 (18 oude + 3 nieuw inexact).
- Motorexperimenten achter een `HP_EXP`-omgevingsvlag in `CPMSolver.ts`. Volledige corpusmeting met
  `OPS_XER_FIDELITY_REPORT=detail` onder `flock /tmp/ops-heavy-suite.lock`, cellen per sleutel vergeleken met
  de baseline-run (die byte-gelijk is aan de onaangeraakte kop). Na afloop `git checkout -- src/…` en
  `git diff --exit-code src` = 0.

## Aanbeveling

1. **Herlabel de 124 in de classificatie** (`2026-09-23-x12-restant-classificatie.md`): "vermoedelijk andere
   kalender" is weerlegd. Voorstel:
   - **81 × "orakel verouderd t.o.v. invoer (duur na doorrekening gewijzigd)"**: niet afleidbaar, open
     restant, eigenaarsvraag. Het bestand ís wel door P6 doorgerekend, maar niet ná de laatste bewerking.
     Uit het orakel halen is een eigenaarsbesluit. Mijn advies: laten staan als gemarkeerd restant, want
     het blijft een geldige meting van ons gedrag op niet-stale taken.
   - **34 × B12/C10 ALAP** (25 anker + 9 minuutrest).
   - **7 × eindmijlpaal-vloer EC2400/EC2390** (n = 1).
   - **2 × meetlatrest EC1600**.
2. **Geen lezerwijziging.** De kalenderdecoder is juist, en de minuutprecisie van restduur en motor is juist.
3. **C10 (ALAP op de minuut, omgekeerde volgorde) is de enige motorregel met opbrengst in dit bestand.**
   Bouwen alleen met de regel-A-meting over Hotel erbij. De vloer-uitzondering uit A/A+B niet bouwen.
4. De 2 cellen van EC1600 (396640,00002 tegen 396640) zijn een orakelafronding van 6-decimale uren. Een
   tolerantie van < 0,001 min in de vergelijker is een meetlatbesluit voor de eigenaar, geen motorwerk.
