# Rekenprofielen — besluiten van de eigenaar en overdrachtsstand (2026-09-22)

*Bedoeld om een compaction of sessiewissel te overleven: alles wat een opvolger nodig heeft om zonder de
eigenaar verder te kunnen. Besluiten zijn letterlijk; de stand is van het moment van schrijven en wordt
onderaan bijgewerkt. Spec: `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md` (v3.1, go van de
critreviewer). Plan: `docs/superpowers/plans/2026-09-22-plan-rekenprofielen.md` (architect-agent, in de maak
op het moment van schrijven).*

## 0. Eindtoestand van deze sessie/dit programma

**Nul afwijkingen met XER**: X12 (`check-xer-product-fidelity-x12.ts` mét corpus) op **0** zesassige
afwijkingen, sameday 0, cel-baseline leeg, `GOAL_ZERO_DEVIATIONS_XER` aan — per cel, onder regel A, zonder
pinnen. Het rekenprofielensysteem is daarvoor de voorwaarde (regel A is pas meetbaar mét profielen),
geen eindpunt. Zodra de etappe rekenprofielen geïntegreerd is, begint het "naar nul"-werk direct met de
goal prompt `docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`, autonoom, zonder op de
eigenaar te wachten. (Eigenaar, 2026-09-22 avond: "de endstate van deze hele sessie is dat we nul
afwijkingen hebben met XER".)

**Stand 2026-09-24 middag:** X12 = **175** over de P6-doorgerekende orakels (8 entries; integratieronde 2 gemerged `44639f59`; schuld 0; `verify` groen op `3b40aa0f`). Restant: HarbourPointe 122 (81 verouderde P6-uitvoer + 34 ALAP/C10 + 7 mijlpaalvloer), OZB 38 (genivelleerd project 9033), Sample 12 (SF-minuut), Hotel 3 (ALAP-eindmijlpaal, C10) — alles wacht op de eigenaarsvragen §1d 7–12; zonder die besluiten is er niets bouwbaars meer over.
(eigenaarsbesluit 23-09; was 15.056 over 34 bestanden), grootte-ratchet actief met 14 schuldcellen,
`npm run verify` groen op `9eed2903`. Volgende brok (6) loopt: schuldcellen + C5-late-kant + restant.

## 1. Besluiten van de eigenaar, 2026-09-22 — letterlijk

### 1a. Over PR #109 / X12 (ochtend, per vraag uit de PR-tekst)

- #109 merget niet met een rode productpoort. Het restant van 15.056 cellen gaat eerst omlaag; de
  planregel "geen pinnen met reden" blijft.
- Het "datums zoals opgeslagen voor alle formaten"-werk wordt een aparte PR na de merge, niet op #109.
- (2) Crashherstel: alleen de manifestvlag telt, geen heuristiek voor oude snapshots.
- (3) Niet-vastgelegde as: CSV leeg, MCP `null`, nooit 0.
- (4) MCP-provenance: codes altijd, resourcenamen alleen achter opt-in, en de AI-client moet die opt-in
  aan zijn gebruiker vragen.
- (5) De ES/EF-regressie van 7b blijft staan als tijdelijke stand, geen pin.
- (6) Samenvattingen rollen op uit hun kinderen, zoals P6.
- (7) Driving path wordt de zevende poort-as, met de longest-path-wandeling als instelling.
- (8) Dossier 7b-4 hoort bij "naar nul": eerst meten, dan bouwen.
- (9) Bronarchief één keer schrijven, in het IFC, niet per crashherstel-snapshot.
- (11) `lagCalendar` effectief voor alle formaten: accepteren, met releasenotitie.
- Regel A (landingsregel voor de gedeelde motor) en regel B (nieuwe conventies als benoemde instelling)
  gaan beide in de goal prompt.
- Solverprofiel per project: eerst geparkeerd ná X12, later op de dag herzien (zie 1b).
- De 49 OzBuild-bestanden gaan in de privérepo (optie 1). Door de eigenaar gemeten: 213 pins groen in
  de cloud. (Lokaal op deze machine zijn alle 216 pins aanwezig en gemeten.)
- Niet expliciet beantwoord: (10) de projecteinde-fout (valt onder "restant omlaag") en (12) de
  weekend-klemheuristiek (blijft zoals hij staat).

- **23-09, na het B01-onderzoek en de C1–C4-toets (vraag §1d-5), letterlijk: "Ja die alleen die p6 Bestände"** —
  alleen de aantoonbaar door P6 doorgerekende bestanden tellen als orakel voor het nuldoel (kenmerken:
  SCHEDOPTIONS-rij + `rem_late_start_date` gevuld op de open taken + `driving_path_flag` ergens Y, gemeten
  door `scripts/xer-p6-computed.ts`). rehab-2 (P3-uitvoer), hb-intel en de synthetische S1–S10 verliezen
  hun orakelrol in het manifest en blijven lezer-/prestatietest. Gevolg: C1/C3/C4 en B3 worden op de
  nieuwe populatie opnieuw beoordeeld (P3-gedrag hoort niet als P6-standaard aan); §1d-vragen 1 en 2 zijn
  hiermee beantwoord. Vragen 3 (grootte-ratchet) en 4 blijven open.

- **23-09, op §1d-vraag 3, letterlijk: "2. Invoeren"** — de grootte-ratchet komt erbij: naast de
  bucket-ratchet (exact/sameday/diff/missing) mag per cel de absolute afwijking tot P6 niet groter
  worden. Doel: compensatie-effecten (761 cellen bij brok 2, vijf lopende Roads-taken bij brok 4)
  zichtbaar maken. Vraag 3 is hiermee beantwoord; alleen vraag 4 (projecteinde/Oracle) blijft open.

- **24-09, vraag 11 (DCP-03 Baseline uit het orakel), letterlijk: "bevestigen, lijkt me logisch"** — de
  uitsluiting van de vier DCP-03-Baseline-kopieën (generatoruitvoer van `build_programmes.py`, byte-exact
  gereproduceerd) is hiermee een eigenaarsbesluit. De manifest-policy mag naar dit besluit verwijzen.

- **24-09, vraag 8 (HarbourPointe: 8 taken met verouderde P6-uitvoer uit het orakel), letterlijk: "ja"** —
  de 8 taken (project 4408; EC1430, EC1590, EC2380 e.a., zie `scripts/README.md` "Kant-en-klaar") worden
  per `excludeTasks` met `decision` uitgesloten; de 48 cellen op hun opvolgers blijven tellen.

- **24-09, vraag 10 (OZB project 9033, door P6 genivelleerd), letterlijk: "uitsluiten"** — project 9033
  gaat per `excludeProjects` met `decision` uit het orakel; P6-nivellering wordt een eigen etappe ná het
  nuldoel (niet in deze meting).

- **24-09, vraag 12 (Hotel deelproject CR 2665, niet P6-doorgerekend), letterlijk: "ja, uitsluiten"** —
  project 2665 gaat per `excludeProjects` met `decision` uit het orakel (alleen drivingPath-cellen).

### 1b. Over het systeem tegen compromissen = rekenprofielen (brainstorm, middag)

1. De compromissen die weg moeten: de conventiekeuzes in de gedeelde motor ("moeten we dit in de
   solver doen? dan rekent het raar voor wie MS Project gewend is").
2. Wie bepaalt: de gebruiker, als één profielkeuze per project — mét eigen profielen met eigen waarden;
   het bronbestand stelt voor.
3. Waar leeft een profiel: volledige opgeloste waarden in het IFC + profiel-id als herkomst; eigen
   profielen app-globaal (optie 2).
4. Het OPS-profiel is een bewuste keuze van de eigenaar, te nemen aan het eind, ná X12, als alles werkt.
   Tot dan = "wat OPS vandaag doet", byte-identiek.
5. Regel A = per cel, niet per som: een motorwijziging landt alleen als onder elk profiel met orakel geen
   enkele cel die exact was inexact wordt; verschilt iets per profiel, dan is het een benoemde
   instelling (regel B), nooit een `if` op het bronformaat. Bevestigd: "ja dit is goed".
6. Volgorde: eerst het volledige profielsysteem (incl. eigen profielen), daarna X12 eronder, daarna de
   OPS-inhoud.
7. Openen: automatisch het bronprofiel, met een melding die zegt waar je het aanpast.
8. Werkwijze vandaag: alles critreviewen; zoveel mogelijk werk tegelijk; subagents NOOIT op Opus 5
   (alias `opus` = Opus 5.5, gemeten); geen Fable in subagents.

### 1c. Besluiten die de orkestrator zelf nam (te corrigeren door de eigenaar, anders staand)

- Spec v1→v3.1 na drie critreview-rondes: twee lagen (15 pakketconventies in het profiel;
  `project.schedulingOptions` blijft voor de 9 bestandsopties + `progressMode`); migratie per veld;
  `legacyValue`; `EffectiveSchedulingOptions` als verplicht solver-type; MSPDI én P6-XML blijven deze
  etappe op OPS (geen orakel); eigen profielen = sjablonen zonder doorwerking; herkomstvelden
  (`p6ProjectId` e.d.) blijven datagates met een gepinde telling; A22/A23 gespiegeld in
  `OPS_SchedulingOptions` alleen als `true`; profielwissel bewaart bestandsoverrides (A19).
- Merge-review PR #109: voortgangsbladen krijgen geen XER-verliesmelding; tekstrol `text-small`;
  AGENTS.md 41 tools — gedaan, `bd0fb55b` op de PR-branch.
- `measure:profiles`: de bekende NULDOEL-toestand (X12 rood op precies de drie nuldoel-regels + cel-poort
  groen) telt als geslaagd; `--strict` maakt hem rood.
- `recorded-all-formats`: no-go van de review (8 punten) wordt door een fix-agent verwerkt op
  `claude/recorded-all-formats-v2`, gerebased op de PR-branch.
- **Koerswijziging X12, 23-09 ~08:30 (na B01-onderzoek + C1–C4-toets):** het orakel van `rehab-2.xer`
  is P3-uitvoer en de synthetische bestanden hebben geen P6-kenmerken; van de 11.771 restcellen liggen
  er maar 1.516 in aantoonbaar door P6 doorgerekende bestanden. Daarom: (1) nieuwe brokken worden alleen
  nog gebouwd op P6-doorgerekende bestanden (B08 Roads, B11 OZB/Roads, B09, B12, B13, B14, B15, en de
  voltooide-taakvorm in Roads/HarbourPointe/OZB — 769 cellen); B05 is geschrapt; (2) de reeds gebouwde
  C1/C3/C4 blijven op hun gemeten stand (ratchet gaat alleen omlaag) maar hun docblokken zeggen eerlijk
  dat rehab-2 een P3-orakel is en dat de P6-standaardwaarde onder voorbehoud van het manifestbesluit
  staat; hun default wordt herzien zodra de eigenaar over het orakel beslist (§1d vraag 5); (3) het
  manifest krijgt een informatief `p6Computed`-veld en de X12-samenvatting een splitsing — rapportage,
  geen poortwijziging; de populatie blijft eigenaarsbesluit.
- **Grootte-ratchet, uitwerking (23-09, na critreview):** (a) géén "accepteer bewust grotere cellen"-modus —
  dat zou pinnen met reden zijn; de 761 grotere rehab-2-cellen van brok 2 verdwijnen doordat rehab-2 uit
  het orakel gaat (besluit §1a), daarom merget de manifest-etappe vóór de ratchet; (b) `diff`→`sameday`
  met groeiende minuten is ROOD (de letter van het besluit: absolute afwijking nooit groter; de emmer is
  een kalenderdaggrens); (c) de v1→v2-overgang van het cellenbestand kan alleen met een expliciete,
  eenmalige vlag en staat daarna op de verboden-omwegenlijst.
- **Ratchet-schuld (23-09, bij de ratchet-merge):** de grootte-ratchet ving bij zijn eerste meting 14
  Roads-cellen (CP_Phys) die sinds d4a66772 groter werden. Besluit: de ratchet landt mét baseline op de
  huidige motor, en de 14 staan als `ratchetDebt` in het cellenbestand (reference = oude minuten, current =
  nieuwe): een schuldcel mag niet verder groeien, schuld kan alleen dalen, geen schrijfmodus voegt schuld
  toe, handmatig bewerken is een verboden omweg. Dat is geen pin: de cellen blijven fout en zijn de
  eerste opdracht van brok 6. — **C3 blijft P6=aan** (niet inert: C5 rekent zijn lag met de C3-regel; C3
  uit = +640 in Roads/HarbourPointe). — **Blast-radius optie (b):** defaults-detectie corpusbreed,
  fidelity-telling alleen op manifest-orakels (nu 0 meetbaar, expliciet gepind).
- **n = 1-criterium (24-09, bij brok 6 landing 4):** een regel met één corpusgeval mag landen als hij een
  gedocumenteerd P6-principe is (Oracle-bron geciteerd) en niet uit het bestand is afgeleid; anders niet
  (B10). A19-late (restduurregel aan de late kant, Roads OCEC11731) valt onder het eerste; SF zonder
  fixture eruit. — **B1-backwardtak** (landing 5) doet aantoonbaar niets ⇒ weg; B1 is alleen voorwaarts.
- **DCP-03 Baseline uit het orakel (24-09):** het restant-onderzoek bewijst dat het bestand uit het
  Python-script `build_programmes.py` komt (naast het bestand in het corpus), dat de drie P6-kenmerken zelf
  schrijft en op dagbasis plant (alle EF 17:00, ff = tf). Dat is generatoruitvoer, dus valt onder het
  besluit van 23-09 ("alleen die P6-bestanden") — tweede toepassing, geen nieuw besluit; het kenmerken-
  criterium is nodig maar niet voldoende. Verwachte stand: 284 − 92 = 192.
- **Float-ruis (24-09):** de 0,00002-min-afwijking op EC1600 is onze eigen drijvende-kommaruis (niet het
  orakel). Vergelijken op het 0,001-min-raster dat het cellenbestand al gebruikt is een meetcorrectie, geen
  pin: landt ná brok 8 (herpin opnieuw). De eigenaar kan dit terugdraaien (§1d-9).

### 1d. Open vragen voor de eigenaar (ontstaan tijdens het autonome werk; niet zelf beslist)

1. *(beantwoord 23-09, zie §1a laatste besluit)* **B01 — 7.516 van de 15.056 cellen** (de helft van het X12-restant) zitten op zes taken in
   `rehab-2.xer` (V3114490 e.a.) die bij P6 TF 0 hebben terwijl hun opvolgers maanden speling geven en
   drie van de zes FF > TF. Uit de relaties in het bestand volgt dat niet; kandidaten (relaties die de
   splitter weggooide; een constraint die bij een import verloren ging) zijn niet aantoonbaar. Volgens
   de goal prompt (regel 4) is dit escaleren, niet pinnen. Besluit nodig: dit bestand (deels) uit het
   orakel halen in het manifest, of accepteren dat het nuldoel hier niet uit P6-regels te halen is.
   Zie `docs/superpowers/plans/2026-09-23-x12-restant-classificatie.md` B01.
   **Uitkomst B01-onderzoek (23-09, `docs/superpowers/plans/2026-09-23-x12-b01-onderzoek.md`): vorm (b),
   bestandsdefect.** Het orakel van `rehab-2.xer` is P3-uitvoer, niet P6: geen SCHEDOPTIONS-tabel,
   `rem_late_start_date` 0/4.940 gevuld (elk echt P6-bestand ≈100 %), `driving_path_flag` nergens Y, alle
   taken aangemaakt 2010-05-05 13:13 met statusdatum twee jaar eerder, enige memo-type "P3 Activity Log
   Info". De zes droegen vrijwel zeker de P3-beperking "Zero Total Float", die Oracle bij P3-import
   als "Not Converted" documenteert; tegenfeit "LF := eigen EF" op de zes = +7.516/0 zonder orakeldatum.
   Aanbeveling orkestrator: rehab-2 uit het P6-orakel (manifest), houden als lezer-/prestatietest.
   Gevolg: B02–B05 zijn alleen op rehab-2 gemeten; C1–C4 worden daarom apart getoetst op de andere
   corpusbestanden (agent gestart 23-09 ~08:00) vóór ze definitief landen.
2. *(beantwoord 23-09, zie §1a)* **Synthetische bestanden S1–S10 — 1.814 cellen** (MER-1, groupdocs, ProjectLens, gimmer/nPlan
   GraphGen, meridianiq, p6diff, …): de orakels zijn intern tegenstrijdig of door een generator
   geschreven. Besluit nodig over hun status in `xer-corpus-manifest.json` (role/included). Samen met
   B01 is dat 62 % van het restant; zonder besluit is 0 op het volledige corpus niet te halen.
3. *(beantwoord 23-09: "Invoeren", zie §1a; bekende gevallen die de bucket-ratchet miste: 761 cellen brok 2 (B01-compensatie), Roads OCEC10801/10811/11371/18391/11791 sinds C7 (oorzaak B07))* **Grootte-ratchet?** De cel-ratchet ziet alleen exact/sameday/diff/missing; een cel die binnen `diff` verder van P6 af komt te liggen is onzichtbaar (brok 2: 761 zulke cellen, verklaard door B01). Besluit nodig: een extra ratchet op de afwijkingsgrootte per cel (strenger, vangt compensatie-effecten) of accepteren dat het nuldoel dat vanzelf afdwingt.
4. **Projecteinde (brok 1):** de fix landt (P6-conform voor de klasse zonder enig einde), maar Oracle
   beschrijft `CalculateFloatBasedOnFinishDate` als een multi-project-optie ("each activity's float is
   calculated based on its project's ScheduledFinishDate"), niet als Must Finish By; en OZB-Start
   registreert negatieve float zonder `plan_end_date`. Vervolgvraag in plan XER §9; `project.endDate =
   start` + `<MustFinishByDate>` in de P6-XML-export is een vervolgpunt.
6. **DCP-03 As-Built: P6-orakel of niet?** (23-09, brok 3.) Het bestand heeft een SCHEDOPTIONS-rij maar geen
   open taken, dus de kenmerken `rem_late_start_date`/`driving_path_flag` zijn niet meetbaar ("unknown").
   Het is het enige bestand met voltooide CP_Drtn/DT_FixedDrtn-taken die hun werkelijke datums houden
   (57 taken, 285 cellen). Telt het mee, dan blijft C5 smal (alleen CP_Phys); telt het niet mee, dan kan
   de brede variant (alle voltooide taken op de rauwe statusdatum) landen. Aanbeveling orkestrator:
   As-Built buiten het orakel (niet aantoonbaar P6-doorgerekend), maar C5 vooralsnog smal houden
   omdat de brede variant op de P6-bestanden geen extra cel wint.
7. *(voorbereid 24-09 op `claude/x12-vraag7-b3-b4-a17` `b3121e2e`: gemeten op de motor mét C5/C6 = 0/0/0/0, landing klaar; één woord van jou: mergen of niet. Let op: A21 `p6CompletedLateFromRemainingWindow` werkt alleen samen met B3.)* **B3, B4 en A17 (uit PR #109) hebben op de P6-populatie 0 effect** (manifest-meting 23-09); ze zijn
   destijds op rehab-2 (P3) gebouwd, net als C1/C3/C4 die nu op P6=uit gaan. Aanbeveling orkestrator:
   ook B3/B4/A17 op P6=uit (register blijft; regel B), in een aparte commit met meting 0/0 — LET OP de
   C3-les: meet op de motor mét C5/C6, want een "inerte" conventie kan via een latere conventie alsnog
   dragen; niet zelf gedaan omdat het de oudere etappe (#109) raakt. B1/B2/B5 blijven aan (Hotel/Sample/ashspace dragen ze).
8. *(beantwoord 24-09: "ja", zie §1a)* **HarbourPointe: 81 cellen zijn P6-uitvoer die verouderd is t.o.v. de opgeslagen invoer** (24-09,
   `docs/superpowers/plans/2026-09-24-x12-harbourpointe-kalender.md`): kalender en decoder kloppen (0 van 124
   op een verkeerde bandgrens); bij 8 taken is P6's eigen start–einde-span 24–240 u korter dan de opgeslagen
   restduur (span = langste toewijzing mín één, zonder vaste regel; EC1810/EC2090/EC1280 hebben dezelfde
   structuur als EC1590 maar het omgekeerde resultaat) — vermoedelijk ná de laatste P6-doorrekening bewerkt.
   Niet uit het bestand af te leiden. Aanbeveling orkestrator: laten staan als gemarkeerd open restant (het
   bestand ís P6-doorgerekend); alternatief is de 8 taken als niet-orakel markeren — dat vraagt een
   taakniveau-uitsluiting die het manifest nu niet kent (mechanisme in aanbouw op
   `claude/x12-manifest-uitsluiting-taak-project`). **Eerlijk:** de 8-taken-uitsluiting neemt maar 33 van de
   81 cellen weg — de overige 48 zitten op opvolgers die door de verouderde duren gestuurd worden en blijven
   tellen — en C10 (ALAP, −27) blijft dan vermoedelijk geblokkeerd omdat EC1420/EC1430 via diezelfde keten
   groter worden. **Consequentie:** zolang EC1430 orakel is, kan C10 niet landen. De overige 43: 34 ALAP (C10, geparkeerd op brok 5,
   alleen landbaar mét Hotel in de meting), 7 eindmijlpalen-vloer (n=1), 2 meetrest.
   **Beslisbaar met één manifestregel (mechanisme 23-09, branch `claude/x12-manifest-uitsluiting-taak-project`):**
   het manifest kent nu `excludeTasks` per entry (achter een `decision` "JJJJ-MM-DD eigenaarsbesluit: …").
   Zeg ja ⇒ `crawl-xer/HarbourPointe_AssistedLiving.xer` krijgt `excludeTasks` voor project 4408, taakcodes
   EC1430, EC1590, EC1680, EC2060, EC2170, EC2200, EC2380, EC2410 (het kant-en-klare blok staat in
   `scripts/README.md`, "Kant-en-klaar voor de eigenaarsvragen"). Eerlijk: de 8-taken-uitsluiting neemt
   **33 van de 81** cellen weg (de cellen óp die 8 taken, gemeten in de proef); de andere 48 zitten op
   andere taken en blijven meetellen, en C10 (ALAP) blijft daarmee vermoedelijk geblokkeerd (niet gemeten
   met C10 aan). De uitsluiting lost §1d-8 dus maar gedeeltelijk op.
9. *(beantwoord door meting 24-09 — geen eigenaarsbesluit nodig, orkestratorbesluit §1c)* **Meettolerantie:**
   EC1600 (HarbourPointe, 2 cellen) wijkt 0,00002 min af — **de rest zit aan ONZE kant** (wij rekenen
   396640,00002000004 uit `totalFloat × minutesPerDay`; het orakel zegt 396640): drijvende-kommaruis in onze
   omzetting, geen orakelafronding. Over 62 leesbare bestanden zijn dit de enige twee cellen onder elke
   drempel tot 1 min; datum-assen hebben nooit zo'n rest. Voorbereid op `claude/x12-tolerantie-vraag9`
   (`fcb7282a`): tf/ff exact als het verschil op het 0,001-min-raster van de cellen 0 wordt
   (`FLOAT_EXACT_TOLERANCE_MIN`, alleen float-assen, `classifyExact` blijft tekst-exact); X12 192 → 190.
10. *(beantwoord 24-09: "uitsluiten", zie §1a)* **OZB project 9033 (38 cellen): door P6 genivelleerd** (24-09, `2026-09-24-x12-restant-onderzoek-284.md`):
    resource PM-1 voor- én achterwaarts genivelleerd, "preserve scheduled dates" uit; met de nivelleervolgorde
    als drie gewone relaties nagebootst: 42 → 6. Nivellering is geen CPM-conventie maar een aparte P6-stap.
    Besluit nodig: 9033 buiten het nuldoel (projectniveau-uitsluiting, kent het manifest nog niet), of
    P6-nivellering als eigen etappe in de meting bouwen. Aanbeveling: buiten het nuldoel, als eigen etappe
    ná X12. *(beantwoord 24-09: "ja, uitsluiten", zie §1a)* **Beslisbaar met één manifestregel (mechanisme 23-09):** zeg ja ⇒
    `crawl-xer/eh_P6Workshops/OZB-Start-09Dec24.xer` krijgt `excludeProjects: [{ projId: "9033", … }]` met een
    `decision` (blok in `scripts/README.md`); proef: −38 zesassige cellen, −4 drivingPath. — Sample_Construction (12): één SF-lag-0-relatie waar P6 het einde één minuut ná de start van
    de voorganger zet (08:01/15:59 zijn echte P6-waarden); n=1 zonder Oracle-bron ⇒ open restant
    (onderzoek 24-09 bevestigt: motorproef 192 → 186 zonder verlies, maar de regel is niet als algemeen
    P6-gedrag te onderbouwen — drie kleine P6-testruns zouden het beslissen; jouw keus: laten staan, of
    die runs aanleveren). Hotel:
    3 ff-cellen van 60 min zonder formule; ATWTPR000 (3) hoort bij C10 ALAP.
11. *(beantwoord 24-09: "bevestigen, lijkt me logisch", zie §1a)* **Bevestiging gevraagd: DCP-03 Baseline uit het orakel.** Ik heb dat op eigen gezag gedaan onder het
    besluit van 23-09 ("alleen die P6-bestanden"), maar jouw lijst van toen noemde DCP-03 Baseline nog als
    P6-doorgerekend — de critreview wijst er terecht op dat een rolwissel een eigenaarsbesluit is. Bewijs:
    het script `build_programmes.py` (naast het bestand in het corpus) reproduceert het bestand **byte-exact**
    (sha 0611f905…) én de al eerder uitgesloten As-Built (816e0173…); het schrijft SCHEDOPTIONS,
    `rem_late_start_date` en `driving_path_flag` zelf, plant op dagbasis (EF 17:00, ff = tf). Het is dus geen
    P6-uitvoer. De uitsluiting staat (X12 284 → 192) en is met één manifestregel terug te draaien; de
    policytekst wordt weer onvoorwaardelijk ("elke populatiewijziging is een eigenaarsbesluit"). Eén woord
    van jou volstaat: bevestigen of terugdraaien.
12. **Hotel project CR (2665) is niet door P6 doorgerekend** (vervolgpunt uit de manifest-etappe 23-09;
    `xer-corpus-p6computed.json`: p6Computed false): 0 zesassige cellen, wel 19 drivingPath-cellen (diff).
    **Beslisbaar met één manifestregel (mechanisme 23-09):** zeg ja ⇒ `crawl-xer/Hotel_Construction_TEC.xer`
    krijgt `excludeProjects: [{ projId: "2665", … }]` met een `decision` (blok in `scripts/README.md`); proef:
    X12 ongewijzigd, drivingPath −19. Met §1d-8 en §1d-10 samen (proef 23-09, zelfde blokken): X12 192 →
    121, drivingPath 169 → 146, geen cel slechter of groter; herpin via de corpusgroei-route
    (`OPS_XER_V2_WRITE=corpus OPS_XER_CELLS_WRITE=corpus` in één run, dan de handmatige pinplekken en
    `OPS_XER_GATE_PINS=corpus`).
5. *(beantwoord 23-09: "alleen die P6-bestanden", zie §1a)* **Welke orakels tellen voor het nuldoel?** (23-09, uit `2026-09-23-x12-c1-c4-toets-buiten-rehab2.md`.)
   Aantoonbaar door P6 doorgerekend (SCHEDOPTIONS-rij + `rem_late_start_date` gevuld + `driving_path_flag`
   ergens Y): Hotel_Construction_TEC, Roads_Project_TEC, HarbourPointe, Sample_Construction_TEC, TERMINAL
   BUILDING-AIRPORT, OZB-Start (12 projecten), DCP-03 Baseline, xernative/sample, (ashspace twijfelachtig);
   niet: rehab-2 (P3), hb-intel en de synthetische S1–S10; onbepaalbaar: DCP-03 As-Built. Restant
   11.771 = 8.441 rehab-2 + 1.814 niet-P6 + 1.516 P6-doorgerekend. Aanbeveling orkestrator: het
   nuldoel definiëren over de P6-doorgerekende orakels (manifest `role`/`included`), rehab-2 en de
   synthetische bestanden houden als lezer-/prestatietest zonder orakelrol. Consequentie: C1, C3 en
   mogelijk C4 (en B3 zelf — de B3-vorm van voltooide taken komt alleen in rehab-2 voor; echte P6-
   bestanden zetten ES én EF van voltooide taken op de rauwe statusdatum) zijn P3-gedrag en horen dan
   niet als P6-standaard aan; C2 blijft (Hotel 244, Roads 11, DCP-03 1).

## 2. Waar het werk staat (bijwerken bij elke mijlpaal)

| wat | branch | stand |
|---|---|---|
| PR #109 (XER-etappe) | `claude/file-formats-support-phase-3-a0ebe2` | main t/m #166 gemerged en gepusht (`0a29147c`): planning/library/browser 164/mcp/dev-server groen, X12 15.056; draft blijft tot X12 nul is |
| rekenprofielen (etappe) | `claude/rekenprofielen` → **draft-PR #169** (gestapeld op de PR-branch van #109) | kop `3128d215`; `verify` groen op `26d5b9dc` + `measure:profiles` NULDOEL; eindreview go; gebruikstest gedaan. Volgorde van mergen: #109 (pas bij X12 = 0) → #167 (RAF-v2) → #169; of #169 in #109 opnemen — eigenaarsbesluit. Brok 2 (12.973) volgt in deze PR zodra de review go geeft |
| baan A: register/profiel/IFC/migratie/sjablonen | `claude/rekenprofielen-baan-a` | GO na fixronde (`c7e7799e`); **gemerged** (`3fdf80c6`), migratiehelpers verhuisd naar `src/services/ifc/schedulingProfileMigration.ts`. Open voor baan D: A19 bewaren bij wissel vanaf een EIGEN profiel; `defaultStorage()` buiten try; label "(aangepast)" op `diffAgainstBase` baseren |
| baan B: p6Source uit de motor | `claude/rekenprofielen-baan-b` | GO na fixronde (`893e9955`); **gemerged** in `claude/rekenprofielen` (`e3545ed7`). Integratiepunt: tabeltest op `resolveLegacyP6SourceConventions` (zes gepoorte vlaggen zonder bron ⇒ false) corpusloos toevoegen; tijdelijke laag `legacyP6Source.ts` verwijderen zodra de lezers het profiel zetten |
| cel-baseline + `measure:profiles` | `claude/rekenprofielen-celbaseline` | GO na vier fixrondes (`f639f96b`); **gemerged** (`921afa0b`); `npm run measure:profiles` mét corpus op de etappebranch: P6 NULDOEL 15.056, cellen 15.473, MS Project GROEN (661 bestanden), vangrails GROEN. Herpinrecept + verboden omwegen in `scripts/README.md` en de goal prompt |
| uitvoeringsplan | `claude/rekenprofielen` | klaar: `2026-09-22-plan-rekenprofielen.md` (`66bb8ccc`, stand-noot `be4f4206`); 31 taken; C10 (MSPDI ⇒ MS Project) geblokkeerd tot eigenaarsbesluit |
| baan C: M1.3–M1.5 + C1–C9 | `claude/rekenprofielen-baan-c` | GO (`dcbb0f6a`); **gemerged** (`29f55cc0`): X12 15.056 + cellen 0/0/0, lezerprofielen/solver-invoer/roundtrip/contract groen. Voor de PR-tekst: C5 geldt bij elk openen en crashherstel (releasenotitie); export-guard-gat `.mpp`→MSPDI; R8-markeringen en X12-testnaam r.~1178 (aanbevolen) |
| baan D (deel 1 + 2 + fixes) | `claude/rekenprofielen-baan-d` | GO; alles **gemerged** (`1fe5dfc8` + fixes `39418571`: wizard-profiel in createNewProject, migratie groep B gepind, lege naam, dode code, docs, dedupe-action, zichtbare drempeleenheid) |
| recorded-all-formats | `claude/recorded-all-formats-v2` | **draft-PR #167**, gestapeld op de PR-branch van #109; `npm run verify` groen (`eda674a9`); merget ná #109 (base dan naar main) |

| X12 naar nul — brok 1: projecteinde-fout | `claude/x12-brok1-projecteinde` (`d879c32b`) | GO; **gemerged** in de etappebranch. Vervolg (plan §9): commentaar over de P6-vlag corrigeren (Oracle: multi-project-optie op ScheduledFinishDate), `project.endDate = start` + `<MustFinishByDate>` in P6-XML-export |
| X12 naar nul — brok 2: B02+B06+B03 (C1–C3) | `claude/x12-brok2-7b4` (kop `af2a9b47`, gepusht) → **gemerged in de etappebranch (`461a310d`)**; volledige `verify` **groen** (EXIT=0, 23-09 ~12:45) | **X12 15.056 → 12.973** (−2.083, 0 slechter per cel); landfixes na her-check gedaan (C2-deeltak eerlijk, fixtures M8/M9, M5 als ongemeten benoemd, recept 6 stappen); critreview = no-go op 5 punten (migratie groep C op id pinnen; corpusloze fixtures voor C1-SS en C3 deels/niet-verstreken lag; "vijftien"→achttien; C1-commentaar/Oracle-URL; §9-dossier) — **fixronde klaar: kop `bc7f3a6b` (gepusht)**: vijf must-fixes (99h/99i + roundtrip 28/28b, fixtures C3 deels/niet-verstreken + C1-SS + C2 voltooide-opvolger met mutanten M1–M4 rood, achttien, C1/C3-docblokken eerlijk over rehab-2/P3 met echte Oracle-URL's als context, §9-dossier) + vergeten herpin van twee corpuspins (blast-radius, task-replay); measure:profiles NULDOEL 12.973 0/0/0; her-check-critreview = LANDEN-MET-FIXES (C2-deeltak "voltooide opvolger ⇒ ff=0" steunt alleen op rehab-2 en moet dat eerlijk zeggen; fixtures M8/M9, M5 pinnen of benoemen; tweede-orde pins in het herpinrecept; [VERMOED] C3 bij SS/SF meet vanaf het einde) — landfix-agent gestart ~11:15 (de eerste fixronde-agent stierf 23-09 ~03:00 door de sessielimiet ná de merge van `3128d215+` in brok 2 = `13826f20`, met de C3/C1-SS-fixtures half af; hervat door een nieuwe agent in dezelfde worktree `agent-a78788e689e933148`). Inzicht reviewer: 761 cellen kwamen binnen dezelfde bucket verder van P6 (B01-compensatie; met B01-tegenfeit zijn C1+C2 = +1.706/0 en C3 = +772/0) — de bucket-ratchet ziet dat niet; een grootte-ratchet is een apart besluit (§1d) |
| X12 naar nul — brok 3: B04 out-of-sequence (+B07 CP_Phys) | `claude/x12-brok3-oos` (kop `0e4991d1` met landfixes) → **gemerged in de etappebranch (`5e318a86`)**, lichte poorten groen | **C4 `p6CompletedOutOfSequenceWindow` geland: X12 12.973 → 11.771** (−1.202, 0 slechter, herpin in dezelfde commit). **C5 `p6CompletedPhysicalAtDataDate` + C6 `p6InProgressStartLagElapsed` geland (`fbca07ab`): 11.771 → 10.947** (−824, 0 slechter; C5 alleen gaf 65 slechter in Roads via SS+lag vanaf gestarte voorgangers ⇒ C6 erbij). Brede variant gemeten, niet geland: op de P6-bestanden identiek aan smal (alle voltooide taken daar zijn CP_Phys); verliest 285 in DCP-03 As-Built (CP_Drtn/FixedDrtn houden actuals) — As-Built is niet op de P6-lijst (onbepaalbaar) ⇒ eigenaarsvraag §1d-6. Na de merges: 699 restcellen in P6-doorgerekende projecten, 10.245 overig. 19 CP_Phys-taken houden ls/lf fout via foute opvolgers. Critreview = LANDEN-MET-FIXES: C5/C6 mogen landen; **C4 doet op de P6-bestanden 0 (1.209 cellen alleen rehab-2) ⇒ P6=uit of weghalen, pas ná het manifest (regel A)**; C6 is in P6 de instelling `sched_lag_early_start_flag` = Early Start (Oracle 99348) ⇒ vervolgpunt: projectoptie; max(0)-fixture ontbrak; C5-docblok afwijkingen (rest-lag bij lopende voorganger, overgeslagen voltooide opvolgers, CP_Phys als beschermgrens); ref-projectgegevens 18→21; [VERMOED] C5 zonder Progress-Override-poort. Landfix-agent gestart ~16:45. Nummering: brok 4 = C7/C8 |
| X12 naar nul — brok 4: B08 FF→startmijlpaal (C6) + B05 actief-rest-0 late kant (C7) | `claude/x12-brok4-ff-mijlpaal` (basis `1aa63a40` = C4; worktree `agent-x12-brok4-ff-mijlpaal`) | **gemerged in de etappebranch (`436762fe`, integratie Opus 5.5)**: C7 `p6FinishFinishStartMilestoneLateFinish` + C8 `p6StartedTaskIgnoresPlannedStartFloor` samen met C5/C6: X12 10.947 → 10.676 (−271, 0 slechter; Roads ls −65, lf −65, tf −61, ff −10, es −6, ef −6; OZB es/ef/tf −18, ff −4). Telling drieëntwintig overal; `LEGACY_XER_ALSO_ON_X12` = C1–C8. Tweede-orde pins groen zonder herpin |
| B01-onderzoek (rehab-2, 7.516 cellen) | `claude/rekenprofielen` (`ef1eb881`, doc `2026-09-23-x12-b01-onderzoek.md`) | **klaar: vorm (b)** — rehab-2-orakel is P3-uitvoer, zie §1d vraag 1. Vervolg: C1–C4-toets buiten rehab-2 |
| C1–C4-toets buiten rehab-2 | `claude/rekenprofielen` (`2c5812ef`, doc `2026-09-23-x12-c1-c4-toets-buiten-rehab2.md`) | **klaar:** C2 gesteund (256 cellen in Hotel/Roads/DCP-03), C1/C3 alleen rehab-2, C4 gemengd (Roads kent het principe in een andere vorm: ES=EF één punt, late kant schuift mee). Zie §1c koerswijziging en §1d vraag 5 |
| manifest `p6Computed` + X12-splitsing (rapportage) | `claude/rekenprofielen` (`57df6ed0`, merge `69d13d65`) | **gemerged**; critreview = LANDEN-MET-FIXES (splitsing per bestand terwijl kenmerken per project gemeten zijn: Hotel/CR telt onterecht als P6-doorgerekend; stil "onbekend" bij ontbrekende sidecar; `--check` nergens aangeroepen) — fix **gemerged** (`30503b35` → `1a73b034`: per project, Hotel = mixed, sidecar-telling, `--check` in measure:profiles): `scripts/xer-p6-computed.ts` + `tests/planning/xer-corpus-p6computed.json` (apart bestand, want de manifest-hash zit in de baselines), splitsing in X12-check en measure:profiles. Gemeten op 15.056: P6-doorgerekend 1.772 (9 entries) / niet 13.284 (24) / onbekend 0 (1, As-Built) |
| X12 naar nul — brok 5: B15 (was C8) + B12 ALAP (**C10**, vóór 23-09 "C9" genoemd — C9 is sinds brok 6 `p6LateFinishOnOwnCalendar`) + B13/B14 | `claude/x12-brok5-klein` (basis `5fcd85de` = C7; worktree `agent-x12-brok5-klein`) | kop `030e22a6` (gepusht): **C10 (destijds C9) `p6AlapPositionedFromSuccessors` (B12) 11.529 → 11.502** (−27, 0 slechter per emmer, HarbourPointe) — maar EC1420/EC1430 gingen van 11 naar 1.440 werkminuten en EC1030 van 43.680 naar 81.120 in dezelfde emmer ⇒ onder de grootte-ratchet ROOD; analyse klaar (`d9973123`): EC1030 opgelost (C9 alleen voor niet-gestarte ALAP op uurkalender); 3 cellen blijven groter (EC1420 es/ef, EC1430 es) door een P6-DUURregel buiten ALAP: EC1430 en EC1590 krijgen in P6 span 696 u bij `remain_drtn_hr_cnt` 720 = `remain_qty/remain_qty_per_hr` van resource 6686 (EC1810 zelfde patroon, wel 720 — onderscheid onbekend). C10-onderzoek klaar: over 5.660 niet-gestarte P6-taken wijken 9 spans af (8 HarbourPointe DT_FixedDrtn + E-1000/B10); beste formule max(qty/rate zonder toewijzingslag) laat 3 fouten (EC1430/EC2380/EC1590) — zes taken met identieke invoer (6604 vs overige) splitsen in P6 twee kanten op ⇒ niet uit invoer af te leiden, C10 NIET gebouwd. **C9 geparkeerd** (regel A per cel incl. grootte, geen uitzondering); dossier in plan XER §9 en C8-patch onder `docs/superpowers/plans/patches/` zijn overgenomen op de etappebranch (`5e0b88c8`); brok 5 is daarmee afgesloten, de branch blijft als naslag. C8 (B15) +2/−1 (rehab-2) als patch bewaard tot na de populatiewijziging; B13/B14 overgeslagen (n=1, mechanisme niet aangetoond). Merget ná brok 4 + manifest + ratchet |
| **manifest-etappe: populatie = P6-doorgerekende orakels** (besluit 23-09) | `claude/x12-manifest-p6-orakels` (kop `8cc5a108`, gepusht) | **gemerged (`645e604a`) + review-fixes (`23dab128`)**: populatie = 13 orakelentries (9 geselecteerd, 21 projecten); X12 10.676 → **428** (es 45, ef 54, ls 90, lf 105, tf 92, ff 42; drivingPath 176): HarbourPointe 124, DCP-03 BL 92, Roads 89, Hotel 64, OZB 42, Sample_Construction 13, ashspace 4, TERMINAL 0, xernative 0. Review-fixes: exclusionReason per meting, policy/README "eenmalig besluit", ashspace-`note` + B5-docblok, C5-vangnet (CP_Drtn/CP_Units/FixedDrtn houden actuals; mutant zonder CP_Phys-filter rood), §9-vervolgpunten. Daarna (`795dfdb1`, `9be55fdc`): **C1 en C4 in P6 uit** (0 cellen verschil); **C3 blijft aan** — C3 uit kost 640 cellen via C5 (Roads 503, HarbourPointe 137). Blast-radius (`b47f09cb`): fidelity alleen op manifest-orakels (optie b), defaults-detectie corpusbreed |
| **grootte-ratchet** (besluit 23-09) | `claude/x12-grootte-ratchet` (kop `1677c64d`, basis `d4a66772`, gepusht) | **gemerged (`ce413b72`)**: v2-kant + `OPS_XER_CELLS_WRITE=corpus`; eerste meting groter=14 (allemaal Roads, CP_Phys: A15112/B2921/B2922 ls/lf, 8× tf) ⇒ orkestratorbesluit: vastgelegd als `ratchetDebt` (reference/current, alleen dalen, eenmalige overgang `OPS_XER_CELLS_DEBT_INIT`), corpusloos bewezen in `check-fidelity-cells-gate.ts` §4. measure:profiles NULDOEL 428, groter=0, schuld=14. Oplossen = eerste opdracht volgende brok (plan XER §9) |
| X12 naar nul — brok 6: ratchet-schuld (14) + C5 late kant + restant 428 | `claude/x12-brok6-c5-late-kant` (basis `9eed2903`; worktree `agent-x12-brok6-c5-late-kant`) | **eerste landing `882873b3` (gepusht): X12 428 → 350, schuld 14 → 0** (verbeterd 78, kleiner 5, groter 0). Oorzaken bewezen: ls/lf-schuld (A15112/B2921/B2922) = C5 — de generieke backward pass sloeg een voltooide opvolger met CP_Phys-punt over; tf-schuld (8×) = C6 — verstreken SS-lag alleen voorwaarts weggehaald, nu gespiegeld. Tweede landing lokaal: **C9 `p6LateFinishOnOwnCalendar` (B09, Hotel) 350 → 308** (42 beter, 0 slechter/groter), C9 in `LEGACY_XER_ALSO_ON_X12` bevestigd. **Landing 2 `5b2c2cd1` (308) + merge etappebranch `cd69a792`** (14 cellen ONTSCHULD via schrijfmodus, schuld 0, NULDOEL 308); gate-mutanten M2/M4/M5 draaien alleen bij schuld. **Landing 3 `38fdcd24`: B2 ook bij FF-lag 0, 308 → 298** (Hotel 5, ashspace 4, Sample 1; 0 slechter/groter). Critreview landing 1+2 = LANDEN-MET-FIXES (motor gezond: C5-late 13 Roads-relaties, C6-late 5 onafhankelijke relaties, C9 30× alleen HBTF-2; fixes: 298→308 in migratiecommentaar, C9-nummerbotsing met geparkeerde ALAP ⇒ die wordt C10, C9-bron ná `applyBackwardBound`, docblokplaats, spec vierentwintig) — **verwerkt in `6bfa37a3`** (C9-bron ná `applyBackwardBound`, 0 verschil). **Landing 4 `f13705ab`: A19 late kant, lopende taak met rest 0 is achterwaarts nulduur voor SS/SF (Roads), 298 → 293. Landing 5 `4b611bc9`: B1 late kant, finishgrens hoort bij de relatie, opvolger toont LS als bandstart (Hotel), 293 → 284.** C9 blijft nodig (uit = 24 slechter, startmijlpalen kal. 844; fixture omgezet). Restant grotendeels n=1/niet afleidbaar (HarbourPointe kalender ≠ opgeslagen; DCP-03 B10/B14/B15; OZB 9033 en Sample minuutresten); **Brok 6 klaar: kop `066dfa43` (gepusht), X12 284, schuld 0**; restant: HarbourPointe 124 (onderzoek 24-09: kalender/decoder kloppen; 81 cellen = verouderde P6-uitvoer bij 8 bewerkte taken ⇒ §1d-8; 34 ALAP/C10; 7 mijlpaalvloer n=1; 2 meetrest ⇒ §1d-9), DCP-03 Baseline 92 (B10 n=1, B14, B15), OZB 42 (één project 9033), Sample 12 (minuutresten), Hotel 8, Roads 6. Critreview landing 3–5 = LANDEN-MET-FIXES (getallen kloppen; B2-lag-0 echte regel over 94 FF0-relaties; A19-laat n=1 ⇒ herformuleren als restduurregel + SF eruit; B1-backwardtak doet niets ⇒ weg; C9-bronvoorwaarde onbewaakt ⇒ fixture; help-teksten B1/B2/A19) — landfixes `a5ec2162` (C9-fixture, A19 als restduurregel zonder SF met Oracle-bron, B1-backwardtak weg, help-teksten 14 talen, B2-docblok). **Gemerged in de etappebranch (`40b90b7f`)**, lichte poorten + corpusloze gates groen; eerste `verify` rood op één MCP-case (telling 23 i.p.v. 24 — merge-drift, gefixt `6bed31ed`, MCP 41/41), `verify` opnieuw: **groen (EXIT=0 op `6bed31ed`, 24-09 ~06:00)** |
| critreview integratie-eindstand (`c3c3c475..9eed2903`) | fixes op `claude/x12-ratchet-review-fixes` (basis `9eed2903`) | LANDEN-MET-FIXES: motor/merges/migratie kloppen; twee gaten in de ratchet-schuld (init-route nog bruikbaar = pinnen via achterdeur; minuten per cel niet tegen handwerk beveiligd — mutant 105360→205360 bleef groen); C2-restanttak 0 effect op P6 (⇒ weg, zoals C1/C4); blast-radius-vectoren dode pin; C3 werkt ook voorwaarts (docblok). **Fixes gemerged (`b0c6946e`)**: initroute weg, schuldset-digest, `cellMinutesSha256` in de v2-envelop, C2-tak weg (0 cellen), blast-radius zonder dode pinnen (v9), C3-docblok; 7 gate-mutanten + reviewer-mutanten rood; her-check = LANDEN-MET-FIXES: beide gaten aantoonbaar dicht (minuten 105360→205360 rood, 15e schuldcel rood, init geweigerd, geen andere aanmaakroute; V2_WRITE neemt vervalste digest niet over); rest: blast-radius `*NegativeFloatTasks`-velden dood ⇒ **gefixt en gemerged (`f47abf3f`, v10: per bestand tegen de meting; mutanten 99999 en lezerdefault rood)**; [VERMOED] digests zijn sleutelloos — alleen diff-review vangt gecoördineerd handwerk (aanvaard) |
| X12 naar nul — brok 7: C10 ALAP (`p6AlapPositionedFromSuccessors`, geparkeerd op brok 5 `d9973123`) opnieuw op de nieuwe kop | `claude/x12-brok7-c10-alap` (basis `40b90b7f`; worktree `agent-x12-brok7-c10-alap`) | **niet geland** (naslagcommit `a03db5b2`, gepusht, niet mergen): C10 geeft 284 → 257 (27 exact, 11 kleiner) maar **3 cellen groter** (EC1420 es/ef, EC1430 es: 3731 → 4320 min) — allemaal door de EC1430-duur (P6 696 u vs opgeslagen 720; niet afleidbaar, plan §9) — Hotel ongemoeid. Geen invoer-eigenschap om ze uit te zonderen zonder orakelfit. **Landt pas na §1d-8** (de 8 verouderde HarbourPointe-taken, waaronder EC1430, uit het orakel) |
| restant-onderzoek OZB 42 / Sample 12 / Hotel 8 / Roads 6 / DCP-03 92 | `claude/rekenprofielen` (`efe8d8dd`, doc `2026-09-24-x12-restant-onderzoek-284.md`) | **klaar**: DCP-03 BL = generatoruitvoer (⇒ manifest, §1c); OZB 9033 genivelleerd (⇒ §1d-10); drie bouwbare regels (Progress Override late kant +4, FF vanaf open startmijlpaal +5(+2), ff naar C5-punt +1) ⇒ brok 8; Sample n=1 zonder bron; Hotel 3 ff onverklaard, ATWTPR000 ⇒ C10 |
| manifest: DCP-03 Baseline eruit (generator) | `claude/x12-manifest-dcp03` (basis `efe8d8dd`; worktree `agent-x12-manifest-dcp03`) | **klaar en gemerged (`ae6ddce1` → `3d51a263`)**: bewijs `build_programmes.py` r. 641/945/947 (schrijft SCHEDOPTIONS, `rem_late_start_date`, `driving_path_flag` zelf; ff = tf; EF 17:00), `generatorEvidence`-veld in `xer-p6-computed.ts` (informatief), corpus-herpin incl. drie nieuwe pinplekken in de README. **X12 284 → 192** (HarbourPointe 124, OZB 42, Sample 12, Hotel 8, Roads 6); 8 geselecteerde entries, 20 projecten, 5.923 taken; lichte poorten + corpusloze gates groen, **`verify` groen (EXIT=0 op `3d51a263`)**; critreview van deze commit gestart 24-09 ~08:30 |
| X12 naar nul — brok 8: C11 Progress Override late kant, C12 FF vanaf open startmijlpaal, C13 ff naar C5-punt | `claude/x12-brok8-po-ff-ff` (basis `efe8d8dd`; worktree `agent-x12-brok8-po-ff-ff`) | **klaar: kop `73186bc4` (gepusht), X12 192 → 180, Roads op 0.** C11 `p6ProgressOverrideIgnoresStartedSuccessor` (OZB 10093, −4), C12 `p6FinishNotBeforeFinishFinishBound` (Roads/Hotel, −7), C13 als aanscherping van C5 (ff naar het C5-punt, −1); telling zesentwintig; alle mutanten rood; test:planning mét corpus rood alleen op de drie nuldoelregels. Critreview = LANDEN-MET-FIXES: motor gezond (C12 lag-0 op P6-uitvoer 274/274 consistent; C11 citaat klopt; C13 regel-B-conform), maar overclaims ("gemeten" bij ongemeten poorten), C12-lagpoort alleen met corpus bewaakt (corpusloos slopen = 113 cellen), docblok ≠ code op "open voorganger/open startmijlpaal", C7-docblok los — **landfixes klaar (`778735c0`)**: eerlijke teksten, fixtures FS-poort/lagpoort/PO-lopende-tak, voltooiingspoorten toegevoegd (0 cellen; twee zonder fixture ⇒ integratieronde), 180/0/0/0 |
| parallelle sporen 24-09 ~08:30 (sessielimiet-reset; "berg subagents") | eigen branches `claude/x12-*` vanaf `24acf986` | vraag 7 (B3/B4/A17 P6=uit) — **gemeten op de motor mét C5/C6: 0/0/0/0 elk apart en samen, X12 192; landing voorbereid op `claude/x12-vraag7-b3-b4-a17` (`b3121e2e`, poorten groen, B-set volgt voortaan de P6-waarde in de migratie, gids-sectie "Standaard uit" = vijf) — NIET gemerged, wacht op jouw ja; kanttekening: A21 werkt alleen samen met B3 en doet dan niets meer tenzij B3 per project aan staat**; C6 als projectoptie `startToStartLagFrom` uit `sched_lag_early_start_flag` — **gebouwd (`c55fccfc`, X12 192 ongewijzigd; tiende projectoptie, lezer/IFC/UI/MCP/i18n/gids, mutanten rood; late kant bij `actualStart` ongemeten); critreview = LANDEN-MET-FIXES: `actualStart` gaf onechte negatieve speling (voorwaarts losgelaten, achterwaarts nog begrensd ⇒ tf −2; check (e) pinde het verkeerde) ⇒ orkestratorbesluit: spiegelen (achterwaarts ook loslaten, [VERMOED] t.o.v. P6), keuzelijst ook uit als A19 uit; **landfixes klaar (`2bbe7e98`)**: spiegel gebouwd (achterwaarts overslaan bij `actualStart` + C6-poort; tegenvoorbeeld pint A/B tf 17 i.p.v. −2 — terecht: na de spiegel hangen ze alleen aan het projecteinde), keuzelijst uit bij C6 óf A19 uit (browsertest uitgebreid), docblok; 192/0/0/0, poorten groen ⇒ klaar voor de integratieronde**; manifest-mechanisme uitsluiting per taak/project — **gebouwd (`4bc2060a`, X12 192 ongewijzigd; `decision` + `excludeProjects`/`excludeTasks` met reden, weigeringen, nooit stil, digest-pin, 62 corpusloze checks; proef met de drie kant-en-klare blokken: 192 → 121 (HarbourPointe 8 taken −33, OZB 9033 −38, Hotel/CR 0 zesassig), README-blok "Kant-en-klaar voor de eigenaarsvragen"); critreview = LANDEN-MET-FIXES: mechanisme gezond (solve ongefilterd, nooit stil, decision vereist), maar na de proef-herpin gaan twee corpusloze poorten rood (mutant X2, M32-fixture), `decision` is alleen vorm (2099/31-02/"GEEN eigenaarsbesluit" geaccepteerd), dekkingsuitzondering te ruim bij reden-wijziging, verborgen aantallen niet gepind, nummering §1d botst — **landfixes klaar (`23202d26`)**: X2 geïsoleerd, M32 synthetisch, `decision` strikt (`JJJJ-MM-DD eigenaarsbesluit: …`, echte datum ≤ morgen), HERPIN-regel per uitsluiting verplicht, dekkings-`fileset` alleen exact de delta, `excludedHidden` als niet-stijgende pin, README wat wel/niet filtert, proef 192 → 121 mét groene corpusloze suite, terug op lege lijst ⇒ stap 6 van integratieronde 2**; vraag 9 tolerantie 0,001 min — **klaar op `claude/x12-tolerantie-vraag9` (`fcb7282a`, 192 → 190)**: de rest blijkt ónze float-ruis ⇒ meetcorrectie (§1c), merget ná brok 8 met herpin; C5 Progress-Override-poort — **klaar, niets te bouwen** (enige PO-project 10093 heeft geen voltooide CP_Phys-taak met open voorganger; tegenfeit 0/0/0 op 192; [VERMOED] afgesloten in plan §9, `8a3108d9` overgenomen); docs-consistentie-critreview 24 conventies — **klaar en gemerged (`58c9ec4d` → `574aeceb`)**: 14 afwijkingen hersteld (CLAUDE.md 192/8 entries, spec 24 + groep C + migratie, gidsfout C2-deelregel nl/en, recept grootte/schuld, goalprompt schuld 0 + n=1-criterium, README generatorbewijs, plan §9 B15-patchnaam, superpowers-README +10 stukken, C1–C9 in commentaar); datum "24-09" voor de DCP-03-toepassing bewust gelaten; browserflake table-editor:49 — **gevonden en gefixt (alleen test, `bc0ec631`, gemerged)**: focus-race na commit (`requestCellFocus` in volgende animatieframe; Escape landde op body); fix = wachten tot de cel focus heeft vóór Escape/Enter; met frame-vertraging 6/10 rood ⇒ 10/10 groen, hele spec 40/40, browsersuite 166/166; Hotel ff 60 min (onderzoek) — **klaar (a): C2 verbreden** naar alle relatietypes en elke lag (grens ongesnapt anker + lag op de eigen kalender, minimum over opvolgers): formule klopt bij 5.641/5.650 open uurtaken en 166/166 met gemengde kalenders (opvolgerkalender 106/166); tegenfeit alleen +1, samen met C12 (brok 8) +8/0/0; bron Boyle 2018 (derde partij) + populatietoets; doc `2026-09-24-x12-hotel-ff-60min.md` (`f656d024` overgenomen) ⇒ **brok 9 gestart** op de brok-8-kop; Sample SF-lag-0 (onderzoek) — **klaar (b): open restant**; Oracle 6616 zegt niets over een minuut; 10 SF-relaties in het corpus, één bepalend; hypothese "strikt ná de start op minuutresolutie" verklaart het ene geval maar faalt als algemene regel (Roads FF-grens op bandstart zonder minuut); motorproef 192 → 186 (0 slechter) niet geland; vorm uitgeschreven in `2026-09-24-x12-sample-sf-lag0.md` (`e75d7f57` overgenomen); beslissend zouden drie kleine P6-runs zijn; critreview DCP-03-manifestcommit — **LANDEN-MET-FIXES**: inhoud klopt (script reproduceert Baseline én As-Built byte-exact; pins afleidbaar; M24 echt), maar de rolwissel was geen eigenaarsbesluit (⇒ §1d-11) en de policytekst was verruimd tot staande regel ⇒ **fix klaar op `claude/x12-manifest-policy-fix` (`40deccf6`)**: policy onvoorwaardelijk, DCP-03 als eenmalige toepassing met bevestigingsvraag, datum 23-09, M3 verhard, `generatorEvidence` = heuristiek; alleen manifest-hash-pins veranderd (bewezen), 192/0/0/0; merget in de integratieronde ná brok 8 (herpin) |
| X12 naar nul — brok 9: C2 verbreden (alle relatietypes, elke lag) | `claude/x12-brok9-c2-breed` (basis brok 8 `73186bc4`; worktree `agent-x12-brok9-c2-breed`) | **klaar: `c077fe71` (gepusht), X12 180 → 177** (drie Hotel-ff-cellen exact; 0 slechter/groter; ELAPSEDTIME/procentlag/andere lagkalender buiten C2; 7 mutanten rood; help 14 talen + gids; replay-pin ff 309 → 313). Critreview = LANDEN-MET-FIXES: motor gezond, maar bewijs overdreven ("166/166" ⇒ 4 discriminerende taken, 4/4; Boyle geen Oracle-bron), SF/negatieve lag/lagDays ongemeten en onbewaakt (M5–M8/M10 groen), gestarte taken zitten erin en worden door A13 gemaskeerd, replay-commentaar fout (vierde = HCSWB2Z4240, mutant-only). Besluiten: SF eruit, gestarte taken eruit (0 cellen), eerlijk docblok, fixtures — **landfixes klaar (`bc94a917`)**: SF en gestarte taken buiten de verbreding (oud gedrag exact behouden), 4/4-bewijs eerlijk, negatieve lag als extrapolatie gepind, replay-commentaar HCSWB2Z4240, 12 mutanten rood, 177/0/0/0 ⇒ klaar voor de integratieronde (basis brok 8) |
| **integratieronde 2** | `claude/x12-integratie-2` (basis `1b7cdebb`; worktree `agent-x12-integratie-2`) | **klaar en gemerged (`3b40aa0f` → `44639f59`)**: brok 8 → 180, tolerantie → 178, policy-fix (=corpus) 178, brok 9 → 175, C6-optie 175, uitsluitingsmechanisme 175; conflicten alleen in tellingen/docs/pins (herpind); C12-fixture (e) aangepast (C2-breed rekent FF+lag nu zelf: 28/9 gepind); C13-voltooiingspoort niet mutant-testbaar (A12 zet voltooid werk op ff 0); `verify` groen op `3b40aa0f` én op de etappebranch `44639f59` (EXIT=0); critreview van de integratie = LANDEN-MET-FIXES (geen verloren regels, pins consistent, C2×C12 correct; C13-voltooiingspoort dood ⇒ verwijderd + docblok eerlijk; spec-tellingen 26) — fixes door de orkestrator zelf, measure:profiles loopt ter bevestiging |
| X12-restant-classificatie (meting) | `docs/superpowers/plans/2026-09-23-x12-restant-classificatie.md` | klaar: 28 brokken = exact 15.056 (+417 drivingPath in 4 groepen). Bouwvolgorde: B02 7b-4 (1.531) → B03 restlag (772) → B04 out-of-sequence (~676) → B07 CP_Phys (~446) → B06 FF eigen kalender (362) → B08 (210) → B05 → B15 → B09 → B11 → B12 → B13/B14. B01 (7.516) en synthetisch (1.814) = eigenaarsbesluit (§1d) |

Zijbranches van agents staan in worktrees onder `/home/nozzit/open-aec/open-planner-studio/.claude/worktrees/agent-*`
tot ze gemerged en gepusht zijn; na merge naar `claude/rekenprofielen` pushen en de worktree opruimen.

**Sessielimiet-les (23-09):** een sessielimiet (429, reset 03:00) doodt álle lopende agents én de orkestrator; niet-gecommit werk blijft in de worktree staan. Daarom: (a) agents committen tussentijds (WIP-commit is beter dan een schone maar verloren werkboom), (b) de orkestrator zet meerdere cron-wake-ups over een langere tijd (elk uur + reserve elke 3 uur, sessiegebonden, 7 dagen), (c) bij hervatten eerst `git status`/`git log` in de worktree van de gestorven agent en dan een nieuwe agent dáár laten doorgaan.

## 3. Werkvolgorde voor de opvolger (herschreven 2026-09-24 na integratieronde 2)

Stappen 1–4 van de oorspronkelijke lijst (banen A–D, integratie, verify, gebruikstest) zijn af; X12 staat
op **175** over de P6-doorgerekende orakels (was 15.056 over het oude orakel). Wat nog telt:

1. **Eigenaarsvragen §1d 7–12 ophalen.** Zonder die besluiten is er niets bouwbaars meer over: het
   restant is HarbourPointe 122 (81 verouderde P6-uitvoer + 34 ALAP/C10 + 7 mijlpaalvloer n=1), OZB 38
   (door P6 genivelleerd project 9033), Sample 12 (SF-minuut, n=1 zonder bron), Hotel 3 (ALAP-eindmijlpaal,
   C10). Kant-en-klaar bij een "ja": vraag 7 = branch `claude/x12-vraag7-b3-b4-a17` (`b3121e2e`) mergen
   met herpin; vraag 8/10/12 = de manifestblokken uit `scripts/README.md` "Kant-en-klaar voor de
   eigenaarsvragen" plaatsen, `=corpus`-herpin + handmatige pins (verwacht 175 → ±104), daarna C10 ALAP
   (brok 5 `d9973123`/brok 7 `a03db5b2` als naslag) opnieuw meten mét Hotel; vraag 11 = bevestigen of de
   DCP-03-uitsluiting terugdraaien.
2. **Bij elke landing dezelfde discipline:** eigen branch per agent (nooit twee worktrees op
   `claude/rekenprofielen`), regel A per cel incl. grootte/schuld/uitsluiting, 6-stappen-herpin in
   dezelfde commit, critreview per landing (skill `hyperkritische-review`), `measure:profiles` vóór
   en ná, `npm run verify` één tegelijk machinebreed (flock `/tmp/ops-heavy-suite.lock`).
3. **PR-keten:** #109 (XER-etappe) blijft draft tot X12 op nul staat of de eigenaar het nuldoel
   herdefinieert; #169 (deze etappe, gestapeld op #109) daarna; #167 (recorded-all-formats) ná #109.
   Base van #169 pas naar `main` zetten als #109 gemerged is.
4. **Open vervolgpunten zonder eigenaar:** `check-xer-schedule-options-corpus` `DEFAULT_KEYS` mist
   `startToStartLagFrom` (meetgat, geen correctheidsgat); Sample SF-minuut beslisbaar met drie kleine
   P6-testruns; `expectedFinishVariant` (blast-radius) filtert niet op uitsluitingen (gedocumenteerd).

## 4. Vaste regels (uit het geheugen van de eigenaar, hier herhaald)

- Poorten op exitcode; máx. één `verify`/zware suite tegelijk machinebreed (`ps aux | grep run.sh`).
- Nooit naar `main` pushen; alles via PR; de eigenaar merget. Releasen alleen met akkoord.
- Subagents: nooit Fable, nooit Opus 5; `uitvoerder-opus-laag/-midden` (Opus 5.5); model in naam en
  rapport; critreviews via de `critreview`-skill met [BEVESTIGD]/[VERMOED].
- Corpus: `OPS_XER_CORPUS="/home/nozzit/open-aec/voor claude/testdata-crawl"` (93/93); `.mpp` vindt
  zijn 216 pins zelf. Node: `export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"`.
