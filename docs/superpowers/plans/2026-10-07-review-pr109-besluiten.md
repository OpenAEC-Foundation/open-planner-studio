# PR #109 — alle besluiten die de XER/P6-lezer vormden

PR #109 maakt dat de app Primavera P6-bestanden (`.xer`) opent. De PR is op 2026-09-25 gemerged als `1d8f2df6`. Dit document zet alle besluiten op een rij die de PR vormden. Bij elk besluit staat wie het nam, waarom het logisch is en of het nog geldt.

Opgesteld door Claude Opus 5.5 (`uitvoerder-opus-midden`), alleen lezend, op 2026-10-07. Codeverwijzingen gelden voor `main` op `82213573`.

**Afkortingen en bronnen**

- **Plan** = `docs/superpowers/plans/2026-08-20-plan-xer-p6-lezer.md`.
- **Overdracht** = `docs/superpowers/plans/2026-09-22-rekenprofielen-overdracht.md`. Dit bestand staat op `origin/claude/rekenprofielen` en niet op `main`.
- **Fable-review** = `docs/superpowers/plans/2026-09-24-fable-critreview-pr109.md`.
- **X12** = de meting die per cel ons resultaat vergelijkt met de opgeslagen uitvoer van P6. Er zijn zes assen: ES, EF, LS, LF, TF en FF.
- **Modus** = de weergave "Datums zoals opgeslagen".
- **Eigenaar** = Ethan. **Orkestrator** = de hoofd-Claude-sessie die het werk verdeelde.
- **Datumnoot** uit Overdracht §1a: een deel van wat daar "24-09" heet, gebeurde volgens de systeemklok op de avond van 23-09.

---

## 1. Wat telt als meetlat

### B1 — Nuldoel: nul afwijkingen op zes assen, tot op de minuut, zonder "pinnen met reden"

- **Wie en wanneer:** de orkestrator schreef het in het plan op 2026-08-20 (Plan §1, §6 X12). De eigenaar bevestigde het twee keer. Op 2026-09-09 (Plan §10.f): "het nuldoel (§1) [blijft] de lat … deze PR [is] een gemeten tussenstand". Op 2026-09-22 (Overdracht §1a): "de planregel 'geen pinnen met reden' blijft". Op 2026-09-22 (avond) zei de eigenaar ook: "de endstate van deze hele sessie is dat we nul afwijkingen hebben met XER" (Overdracht §0).
- **Wat het is:** na openen en F5 moet elke datum en speling gelijk zijn aan wat P6 zelf in het bestand opsloeg, tot op de minuut. Een afwijking mag je niet "accepteren met een reden". Voorbeeld: in `rehab-2.xer` hoort taak `V3109400` op ES 2008-12-04 te staan. 12-06 is fout, ook als we de oorzaak kennen.
- **Waarom logisch:** de eigenaar definieert in de vault wanneer een formaat af is: "als de gebruiker een bestandsformaat opent moet hij precies hetzelfde zien als in het originele … programma" (`werk/wanneer is een bestands implementatie af?.md`). Het alternatief is een tolerantie of een gepinde reden. Dan groeit een stapel uitzonderingen die niemand meer controleert. Bij de `.mpp`-etappe werkte dat al niet.
- **Status:** het doel geldt nog. Het is niet gehaald. Op `main` staan 76 cellen open (Overdracht §0).
- **Waar te zien:** `tests/planning/check-xer-product-fidelity-x12.ts`. Met `OPS_XER_CORPUS` faalt de suite op precies drie nuldoelregels.

### B2 — Twee meetlatten: het corpus-orakel en dertien echte P6-23.12-casussen

- **Wie en wanneer:** de orkestrator, 2026-08-20, na de hyperkritische planreview (Plan §3).
- **Wat het is:** meetlat 1 is de rekenuitvoer die P6 in de TASK-tabel opsloeg. Een eigen, losse parser leest die (`xerGroundTruth`), niet de echte lezer. Meetlat 2 is `cases-p6-verified.json`. Daarin staan alleen de `*_p6`-kolommen van 13 kleine casussen die echt in P6 23.12 zijn doorgerekend. De code en de "PASS"-oordelen van dat externe project tellen niet.
- **Waarom logisch:** een tweede parser voorkomt een fout die in beide kanten tegelijk zit. Als lezer en meetlat dezelfde veldkaart delen, zien ze dezelfde fout niet (les F7 uit etappe 1). Het externe raamwerk liet de tijd weg en paste zijn engine aan op de uitkomst. Plan §3 noemt het voorbeeld: in casus 01 telde `EF_engine=2026-01-12` daar als gelijk aan `EF_p6=2026-01-09 17:00`.
- **Status:** geldt nog.
- **Waar te zien:** `tests/planning/check-p6-verified-cases-engine.ts`, `tests/planning/check-xer-product-fidelity-x12.ts`.

### B3 — Totale en vrije speling tellen volwaardig mee

- **Wie en wanneer:** eigenaar, 2026-08-20, "conform voorstel" (Plan §5, X-O3).
- **Wat het is:** TF en FF zijn gewone assen met dezelfde nul-eis. De vergelijking is `onze minuten === round(P6-uren × 60)`, via de kalender van de taak. Zie je een verschil in hoe P6 speling definieert, dan beslist de eigenaar. Je maakt de eis nooit zelf losser.
- **Waarom logisch:** de gebruiker ziet speling en het kritieke pad. Een fout in de speling is net zo zichtbaar als een fout in een datum. Het alternatief is alleen datums meten. Dan blijft een fout in het kritieke pad onzichtbaar.
- **Status:** geldt nog.
- **Waar te zien:** Plan §1, alinea "Float-precisie".

### B4 — De opgeslagen P6-uitvoer is meetlat, nooit invoer: vier "bakken" met kolommen

- **Wie en wanneer:** de orkestrator, 2026-08-20 (Plan §4.1, "WHITELIST"). De eigenaar voegde op 2026-09-04 bak 4 toe met het laag-3-besluit (Plan §5, X-O7.3).
- **Wat het is:** elke TASK-kolom uit het corpus staat in precies één bak. Bak 1 is toegestane invoer. Bak 2 is verboden rekenuitvoer, bijvoorbeeld `restart_date` en `driving_path_flag`. Bak 3 is "geen planningsdata". Bak 4 bevat de zes P6-uitvoerkolommen. Die mogen alleen naar de weergave, nooit naar de solver. Een kolom zonder bak is een poortfout.
- **Waarom logisch:** als de lezer P6's antwoord als invoer gebruikt, haal je de meting "100 % goed" zonder dat de motor iets kan. Dat ging in etappe 1 drie keer mis (Plan §4.1, "Drie afgekeurde pogingen"). Een lijst met toegestane kolommen faalt veilig. Een lijst met verboden kolommen faalt open.
- **Status:** geldt nog.
- **Waar te zien:** `tests/planning/check-xer-field-whitelist.ts`. Bak 4 wordt alleen gelezen in `src/services/xer/xerRecordedTimes.ts:87`.

### B5 — De poort op verboden kolommen werkt op de AST, niet met een regex

- **Wie en wanneer:** de orkestrator en een agent (Opus 5.5), 2026-09-24, na Fable-review bevinding 3. Commit `62d1fa348`.
- **Wat het is:** de oude grep bleef groen bij vier van vijf gewone schrijfwijzen, bijvoorbeeld `row.cells?.restart_date`. De nieuwe poort leest de TypeScript-AST van heel `src/` en kijkt naar de naam van de kolom. De vijf mutanten van de review staan in de poort als zelftest.
- **Waarom logisch:** de regex-poort bewees alleen het ene voorbeeld dat men zelf had gekozen. Een AST-poort volgt het patroon van `verify:store-boundaries` en vangt ook alias en optional chaining.
- **Status:** geldt nog.
- **Waar te zien:** `tests/planning/check-xer-field-whitelist.ts:38` (laadt TypeScript via `createRequire`).

### B6 — De oude v1-celbaseline blijft naast de v2-baseline staan

- **Wie en wanneer:** een agent of de orkestrator, 2026-09-05, commit `cd0381b99` ("Besluit: v1 blijft").
- **Wat het is:** v2 telt afwijkingen per bestand. v1 onthoudt welke cellen exact waren. De twee bestanden hadden per ongeluk dezelfde naam. Nu heeft elk een eigen naam.
- **Waarom logisch:** stel dat twee cellen van plaats ruilen. Dan blijft de som van v2 gelijk, maar v1 ziet de achteruitgang wel. Als je v1 weggooit, verdwijnt die bewaking.
- **Status:** later aangevuld met de cel-ratchet en de grootte-ratchet (B9).
- **Waar te zien:** `tests/planning/check-xer-product-fidelity.ts`, `check-xer-fidelity-baseline-schema.ts`.

### B7 — Driving path: eerst alleen rapportage, daarna een zevende poort-as

- **Wie en wanneer:** de orkestrator, 2026-08-20: rapportage, geen poort (Plan §3). De eigenaar, 2026-09-22: "(7) Driving path wordt de zevende poort-as, met de longest-path-wandeling als instelling" (Overdracht §1a).
- **Wat het is:** P6 zet per taak `driving_path_flag`. Wij vergelijken dat met ons oordeel "kritiek". Bij de overdracht verschilden 417 cellen, waarvan 301 keer "P6 nee, wij ja" (Plan §10.b).
- **Waarom logisch:** de vlag is de goedkoopste externe test van onze logica voor het kritieke pad. Het alternatief is hem nooit meten. Dan blijft een systematisch verschil tussen ons "kritiek" en P6's "driving" onzichtbaar. Plan §5 laat zo'n verschil al zien bij zes taken in rehab-2.
- **Status:** gedeeltelijk gebouwd. De as is een cel-ratchet (`check-xer-product-fidelity-x12.ts:2590`), maar telt niet mee in het nuldoel. Een aparte instelling "longest-path-wandeling" voor deze vergelijking vond ik niet. De bestaande kritiek-definitie "Langste pad" bestaat wel [VERMOED: de eigenaar bedoelde die].
- **Waar te zien:** in de app via Bestand › Projectinfo › Reken-opties › Kritiek-definitie.

### B8 — De orakelpopulatie is alleen wat P6 aantoonbaar zelf doorrekende

- **Wie en wanneer:** eigenaar, 23-09, letterlijk: **"Ja die alleen die p6 Bestände"** (Overdracht §1a). Dit beantwoordt de vragen §1d-1, §1d-2 en §1d-5.
- **Wat het is:** een bestand telt alleen als orakel als het drie P6-kenmerken heeft: een SCHEDOPTIONS-rij, gevulde `rem_late_start_date` en ergens `driving_path_flag=Y`. `rehab-2.xer` bleek P3-uitvoer. Die tabel ontbreekt, en `rem_late_start_date` is in 0 van de 4.940 rijen gevuld. Ook de synthetische bestanden S1–S10 vallen af. Ze blijven lees- en prestatietest.
- **Waarom logisch:** het nuldoel heet "zoals P6". Een P3-bestand of een generatorbestand meet iets anders. Het alternatief was op de oude populatie doorbouwen. Dan maak je P3-gedrag tot P6-standaard, zoals C1/C3/C4 eerst deden (Plan §9, 7b-4). Van de 15.056 cellen lagen er maar 1.516 in echte P6-bestanden (Overdracht §1d-5).
- **Status:** geldt nog. Het kwam ná de inhoud van #109. Het verklaart waarom 15.056 op #109 later 76 werd: het meeste kwam door de nieuwe populatie, niet door betere motorcode.
- **Waar te zien:** `tests/planning/xer-corpus-manifest.json` (velden `role`/`included`), `scripts/xer-p6-computed.ts`.

### B9 — Een grootte-ratchet per cel

- **Wie en wanneer:** eigenaar, 23-09, letterlijk: **"2. Invoeren"** (Overdracht §1a, antwoord op §1d-3). De orkestrator werkte het uit, ook de regel dat een cel die verandert van `diff` naar `sameday` maar meer minuten afwijkt, ROOD is (Overdracht §1c).
- **Wat het is:** naast exact/sameday/diff/missing mag een cel ook niet verder van P6 af komen te liggen. Voorbeeld: bij brok 2 kwamen 761 cellen verder van P6, binnen de emmer `diff`. De oude ratchet zag dat niet.
- **Waarom logisch:** zonder deze regel kan een totaal verbeteren terwijl losse cellen slechter worden, en dat compenseert elkaar. Het alternatief was "het nuldoel dwingt het vanzelf af". Dat werkt pas op het eind, en niet bij elke tussenstap.
- **Status:** geldt nog. Het kwam na #109.
- **Waar te zien:** `tests/planning/xer-product-fidelity-cells.json` (versie 2, `ratchetDebt`).

---

## 2. Uitsluitingen uit de meting

Alle uitsluitingen kwamen na de inhoud van #109. Ze bepalen wel wat "76" op `main` betekent. Elke uitsluiting staat in het manifest met een `decision`-regel.

### B10 — DCP-03 Baseline uit het orakel

- **Wie en wanneer:** eerst de orkestrator (24-09). Daarna de eigenaar, vraag 11: **"bevestigen, lijkt me logisch"** (Overdracht §1a).
- **Wat het is:** het script `build_programmes.py` maakt dit bestand byte-exact na. Het is generatoruitvoer en geen P6-uitvoer.
- **Waarom logisch:** het volgt direct uit B8. Het alternatief is een gegenereerd bestand als P6-waarheid behandelen.
- **Status:** geldt nog. X12 ging van 284 naar 192.
- **Waar te zien:** `xer-corpus-manifest.json`.

### B11 — OZB project 9033 uit: P6 heeft het genivelleerd

- **Wie en wanneer:** eigenaar, vraag 10, letterlijk: **"uitsluiten"** (Overdracht §1a).
- **Wat het is:** P6 nivelleerde resource PM-1. Nivellering is een aparte P6-stap en geen CPM-regel.
- **Waarom logisch:** zonder nivellering in de motor is dit project niet te halen. Het alternatief is nivellering nu bouwen. Daarvoor komt een eigen etappe (`docs/TODO.md`, "P6-nivellering").
- **Status:** geldt nog.
- **Waar te zien:** `excludeProjects` in het manifest.

### B12 — Hotel deelproject CR (2665) uit

- **Wie en wanneer:** eigenaar, vraag 12, letterlijk: **"ja, uitsluiten"** (Overdracht §1a).
- **Wat het is:** P6 heeft dit deelproject niet doorgerekend. Het gaf alleen drivingPath-cellen.
- **Waarom logisch:** het volgt uit B8.
- **Status:** geldt nog.
- **Waar te zien:** het manifest.

### B13 — HarbourPointe: acht taken met verouderde P6-uitvoer, plus EC1420

- **Wie en wanneer:** eigenaar, vraag 8: **"ja"**, en vraag 13: **"Vraag 13, ja uitsluiten"** (Overdracht §1a).
- **Wat het is:** bij acht taken, waaronder EC1430, is de span van P6 24–240 uur korter dan de opgeslagen restduur. De invoerkolommen verklaren dat niet. EC1420 haalt zijn datum uit EC1430.
- **Waarom logisch:** de taken zijn vermoedelijk bewerkt na de laatste doorrekening in P6. Het alternatief was laten staan, maar dan kan de ALAP-regel C14 niet landen. Let op: de 48 cellen op de opvolgers blijven gewoon meetellen.
- **Status:** geldt nog. In totaal zijn 42 taken uitgesloten.
- **Waar te zien:** `excludeTasks` in het manifest; `.claude/rules/xer.md`.

---

## 3. Openen en melden

### B14 — Alles importeren: elk project wordt een eigen document

- **Wie en wanneer:** eigenaar, 2026-08-20 (Plan §5, X-O1): "álles wordt geïmporteerd … wie het bestand hier opent, ziet hetzelfde als in Primavera."
- **Wat het is:** een `.xer` met 15 projecten opent als meerdere tabbladen. Het project met de meeste taken wordt het actieve tabblad. Een relatie tussen projecten wordt bewaard als `externalLinks`. Het is data en geen solverinvoer.
- **Waarom logisch:** "het eerste project" heeft in de Hotel-bestanden nul taken, en de exportvlag maakt geen onderscheid (15/15 'Y'). Het alternatief is één project kiezen. Dan verliest de gebruiker stil projecten.
- **Status:** geldt nog.
- **Waar te zien:** open `OZB-Start-09Dec24.xer` en je krijgt 12 tabbladen. Code: `src/services/xer/xerMultiProject.ts`.

### B15 — Lege projecten openen niet, maar de melding telt ze

- **Wie en wanneer:** de orkestrator, 2026-08-20, "eigenaar kan overrulen" (Plan §5, X-O1).
- **Wat het is:** een project zonder taken krijgt geen tabblad. De melding zegt bijvoorbeeld "3 lege projecten overgeslagen".
- **Waarom logisch:** lege tabbladen zijn ruis. Er gaat geen planning verloren. De telling maakt het zichtbaar.
- **Status:** geldt nog. De eigenaar heeft het niet expliciet bevestigd.
- **Waar te zien:** `xerMultiProject.ts:315` (`emptyProjectsSkipped`).

### B16 — Baselines blijven bewaard; een baselineproject opent niet als tabblad

- **Wie en wanneer:** eigenaar, 2026-08-20 (Plan §5, X-O2): "baselines blijven gewoon bewaard". De begrenzingsregel komt van de orkestrator (her-check, Plan §5 X-O1).
- **Wat het is:** wijst project A naar project B als baseline, dan wordt B een OPS-baseline op A. Bij een zelfverwijzing, een kring, of als "alles is baseline", opent alles gewoon. Ook dat staat in de melding. Een verwijzing naar een project dat niet in het bestand staat (9 van 10 in het corpus) wordt geteld en genegeerd.
- **Waarom logisch:** in Primavera is een baseline ook geen open project. De begrenzing voorkomt dat een bestand niets opent.
- **Status:** geldt nog.
- **Waar te zien:** `stack_data_center_baseline.xer`. De gids `howto-xer-openen.md` legt "Beschermende baseline-terugval" uit.

### B17 — Tekencodering: UTF-8, anders Windows-1252, en de melding noemt de keuze

- **Wie en wanneer:** eigenaar, 2026-08-20, "conform voorstel" (Plan §5, X-O4).
- **Wat het is:** is het bestand geen geldige UTF-8, dan leest de app het als Windows-1252. De melding noemt de codering. Er is geen instelling.
- **Waarom logisch:** het corpus heeft geen enkel bestand met BOM. Bij weinig bijzondere bytes kan de app het verschil niet bepalen. Daarom is de melding de eigenlijke bescherming.
- **Status:** geldt nog. Er is een bekend gevolg. In `rehab-2.xer` worden Arabische namen onleesbare tekens (Plan §10.c). Andere codetabellen, zoals 1256, herkent de app niet.
- **Waar te zien:** `src/services/xer/xerTables.ts:9`; de melding "Tekstcodering vastgesteld als …".

### B18 — Getalnotatie komt uit CURRTYPE; bij twijfel weigert de app

- **Wie en wanneer:** eigenaar, 2026-08-20 (Plan §5, X-O5). De eigenaar eiste uitleg op drie plekken: een docblok, de foutmelding in 14 talen en een paragraaf in de gids.
- **Wat het is:** het bestand zegt zelf welk teken het decimaalteken is. Zonder CURRTYPE gebruikt de app een punt. Is het bestand aantoonbaar komma-decimaal zonder CURRTYPE, dan geeft de app een fout en opent er niets.
- **Waarom logisch:** een verkeerd gelezen getal is een stille fout in elke duur en elke speling. Een fout bij het openen is beter dan een verkeerd getal.
- **Status:** het gedrag geldt nog. **Let op:** de gidsparagraaf die de eigenaar eiste, vond ik niet meer in de nl-gidsen op `main` [VERMOED: verdwenen bij de Diátaxis-omzetting `6e7c30bab`, 2026-10-05]. Het merge-punt van #109 had hem nog in `gids-xer-import.md` (§"Tekencodering en getallen").
- **Waar te zien:** het docblok in `xerTables.ts`. `ref-meldingen.md` noemt alleen "N getalnotatieproblemen".

### B19 — Onbekende tokens: case-insensitief matchen, en een terugval altijd melden

- **Wie en wanneer:** de orkestrator, delta-check 2026-08-20 (Plan §4.7). Voor FF/SF zonder voorvoegsel: agent en orkestrator, 2026-09-24, Fable-review bevinding 9, commit `32849caf7`.
- **Wat het is:** `TT_mile` geldt als `TT_Mile`. Een echt onbekend token, zoals `ST_TotalFloat`, valt terug op de standaard, en de melding telt dat. Een relatietype zonder voorvoegsel (`FS/SS/FF/SF`) wordt nu voor alle vier herkend.
- **Waarom logisch:** het corpus heeft echte varianten in hoofdletters. Een stille terugval verbergt dataverlies. Een halve regel (alleen FS/SS) gaf voor `FF` stil een FS-relatie.
- **Status:** geldt nog.
- **Waar te zien:** `xerReader.ts:425`; de melding "N enum-terugvallen".

### B20 — TT_Rsrc en TT_WBS: lezen als data, plannen als een gewone taak, melden

- **Wie en wanneer:** de orkestrator, 2026-08-20 (Plan §6, X4a).
- **Wat het is:** P6 heeft twee speciale activiteitstypen (2 rijen en 1 rij in het corpus). De app bewaart het type, maar rekent de taak als een gewone taak.
- **Waarom logisch:** een eigen rekenmodel voor drie rijen kost veel en is niet te meten.
- **Status:** geldt nog. Plan §8.5 noemt het een begrensd vervolg.
- **Waar te zien:** `xerReader.ts:178`.

### B21 — Documentnaam is "Projectnaam (Project-ID)"

- **Wie en wanneer:** eigenaar, 24-09 ~19:10, vraag 17, letterlijk: **"projectnaam"** (Overdracht §1a). Commits `2946f7244` en `4a4540475`.
- **Wat het is:** het tabblad heette eerst "HBTF-2", dat is de P6-code. Nu heet het bijvoorbeeld "HarbourPointe Assisted Living (4408)". Volgorde: `proj_name`, dan de naam van de WBS-wortel, dan het ID. Opslaan en het bezettingsoverzicht gebruiken dezelfde naam.
- **Waarom logisch:** een code zegt de gebruiker weinig. MPXJ neemt ook de naam (Fable-review bevinding 7). Het ID tussen haakjes houdt de koppeling met P6 zichtbaar.
- **Status:** geldt nog.
- **Waar te zien:** in de app: open een `.xer` en kijk naar de tabbalk. Code: `src/utils/xerDocumentName.ts:10` en `xerReader.ts:466`.

---

## 4. Datums zoals opgeslagen (laag 3)

### B22 — Bij restverschillen opent een XER meteen in de modus

- **Wie en wanneer:** eigenaar, 2026-09-04 (Plan §5, X-O7.3).
- **Wat het is:** wijkt onze berekening af van P6, dan toont de app eerst de datums van P6. Er komt een strook ("Je ziet de planning zoals Primavera hem opsloeg; bij herberekenen wijkt 1 taak af") en een melding met het aantal taken. F5 of een echte bewerking verlaat de modus.
- **Waarom logisch:** zolang het nuldoel niet gehaald is, ziet de gebruiker zo toch eerst wat P6 zei. Het alternatief is meteen onze eigen uitkomst tonen. Dan ziet de gebruiker andere datums dan zijn opdrachtgever.
- **Status:** geldt nog. Later uitgebreid (B27).
- **Waar te zien:** open `northstar-current.xer`. Je ziet de strook met 21 taken (Plan §10.c). Code: `src/state/documentActivation.ts:329`.

### B23 — "Niet vastgelegd" is nooit 0: CSV laat de cel leeg, MCP geeft `null`

- **Wie en wanneer:** de orkestrator, 2026-09-05, commit `79a06cf0e`. Eigenaar, 2026-09-22, letterlijk: **"(3) Niet-vastgelegde as: CSV leeg, MCP `null`, nooit 0."** (Overdracht §1a).
- **Wat het is:** legt P6 voor een taak geen late datum of speling vast, dan verzint de app geen waarde. De tabel toont "Niet vastgelegd". De CSV-cel blijft leeg. MCP geeft `null` en een lijst van de lege assen.
- **Waarom logisch:** een CSV-lezer of AI-client kan een verzonnen `0` niet onderscheiden van een echte nul-speling. Een AI-client ziet de strook niet.
- **Status:** geldt nog. De rapporten en de PDF tonen per cel nog wel een terugvalwaarde. Zie B29.
- **Waar te zien:** `src/state/recordedDatesSelectors.ts:68` (`unrecordedExportGate`).

### B24 — "Niet vastgelegd" verschijnt alleen in de modus

- **Wie en wanneer:** agent en orkestrator, 2026-09-05, critreview laag 3 bevinding 1, commit `4277c5fe9`.
- **Wat het is:** buiten de modus zijn de getallen onze echte berekening. Die mag het label niet verbergen.
- **Waarom logisch:** de oude bedrading toonde ook bij een gewoon IFC-aanbod "Niet vastgelegd". Dat was een regressie voor elk document.
- **Status:** geldt nog.
- **Waar te zien:** `recordedGridBinding` in `recordedDatesSelectors.ts`.

### B25 — Samenvattingen rollen in de modus op uit hun kinderen

- **Wie en wanneer:** de orkestrator, 2026-09-07, her-check R1, commit `213d6f5a1`. Eigenaar, 2026-09-22, letterlijk: **"(6) Samenvattingen rollen op uit hun kinderen, zoals P6."**
- **Wat het is:** een WBS-rij zonder eigen vastlegging krijgt de datums uit haar taken. Een samenvatting mét vastlegging houdt die.
- **Waarom logisch:** zo doet P6 het. Het alternatief is "Niet vastgelegd" op elke WBS-rij. Dan is de rij leeg terwijl de taken data hebben. Er blijft één nadeel (Plan §10.c): de samenvatting toont een opgerolde late start, terwijl haar kinderen "Niet vastgelegd" zeggen.
- **Status:** geldt nog.
- **Waar te zien:** in de modus, op een XER-WBS-rij.

### B26 — "Kritiek" is "niet vastgelegd" bij langste-pad-kritiek of als de speling niet om te rekenen is

- **Wie en wanneer:** de orkestrator, 2026-09-07, her-check R3, commit `213d6f5a1`. De orkestrator vroeg de eigenaar om bevestiging (Plan §10.f).
- **Wat het is:** kan de app uit P6's speling niet bepalen of een taak kritiek is, dan toont ze geen "nee".
- **Waarom logisch:** dezelfde regel als B23: geen verzonnen waarde.
- **Status:** geldt. Bij de antwoorden van de eigenaar op 22-09 vond ik geen expliciet antwoord op dit deel. Zie "Niet traceerbaar".
- **Waar te zien:** fixture 9c in `check-recorded-dates.ts`.

### B27 — Heropenen: eerst "alleen aanbieden", daarna optie B; daarna geldt de modus voor alle formaten met rekenuitvoer

- **Wie en wanneer:**
  1. Orkestrator, 2026-09-05, commit `f44e03209`: alleen een verse `.xer` zet de modus aan. Een heropend IFC biedt de modus alleen aan.
  2. Eigenaar, 2026-09-09, **optie B**: een heropend eigen IFC gaat automatisch in de modus zolang het sinds de import niet is bewerkt. Daarbij: "elk formaat moet zich als XER gedragen" (Plan §10.f, commit `2b8cd8fa9`).
  3. Eigenaar, 24-09 ~08:50, letterlijk: **"2.beperken"**. De modus geldt alleen voor formaten met echte rekenuitvoer (XER, P6 XML, MSPDI, `.mpp`). CSV en vreemde IFC's openen zonder de modus (Overdracht §1a).
- **Wat het is:** regel 1 voorkwam dat een bewerkte planning stil P6's oude datums toont. Optie B herstelt het gemak voor een onbewerkt bestand.
- **Waarom logisch:** "onbewerkt sinds import" (`importPristine`) is een hard kenmerk. Het alternatief, altijd aan, toont na een bewerking verouderde P6-datums. "Beperken" voorkomt dat bij een CSV invoer met invoer wordt vergeleken.
- **Status:** optie B en "beperken" zijn gebouwd in PR #167, niet in #109.
- **Waar te zien:** `src/state/documentContract.ts:96` (`importPristine`); gids `uitleg-datums-zoals-opgeslagen.md` §"Opslaan en heropenen".

### B28 — Crashherstel: alleen de vlag in het manifest telt

- **Wie en wanneer:** de orkestrator, 2026-09-05, commit `635b50fde`. Eigenaar, 2026-09-22, letterlijk: **"(2) Crashherstel: alleen de manifestvlag telt, geen heuristiek voor oude snapshots."**
- **Wat het is:** het recovery-manifest (v4) slaat per document `datesAsRecorded` op. Een ouder manifest zonder die vlag levert "uit".
- **Waarom logisch:** de oude heuristiek ("0 verschoven, dus de modus stond aan") gaf een fout. Er zat een gat tussen een bewerking en de herberekening (`setTimeout(0)`). In dat gat zette het herstel een half bewerkte planning terug als "zoals Primavera".
- **Status:** geldt nog.
- **Waar te zien:** `src/services/recovery/recoveryStore.ts:15`; `docs/xer-recovery-guardrails.md`.

### B29 — Rapporten en PDF: één melding bovenaan in plaats van "niet vastgelegd" per cel

- **Wie en wanneer:** de orkestrator, 2026-09-07, eindreview, commit `783996998`.
- **Wat het is:** in de modus staat bovenaan elk rapport een melding (`tableReports.recordedDatesNote`). De cel zelf toont nog 0 of leeg.
- **Waarom logisch:** het was een snelle, eerlijke tussenstap. De volledige poort door alle tien rapporten was groter werk.
- **Status:** open. `docs/TODO.md`: "XER: 'niet vastgelegd' bestaat in tabel, CSV en MCP, maar niet in de rapporten …".
- **Waar te zien:** maak een rapport in de modus.

### B30 — De vastlegging gaat mee via het bronarchief, niet via een eigen IFC-pset

- **Wie en wanneer:** agent en orkestrator, 2026-09-05, commit `e663d2f7b` ("Ontwerpkeuze … de ARCHIEFROUTE, geen eigen `OPS_`-pset").
- **Wat het is:** bij heropenen leest de app het opgeslagen `.xer` opnieuw. Zo krijgt ze dezelfde vastlegging met dezelfde code.
- **Waarom logisch:** er is geen tweede afleiding en geen wijziging aan het documentcontract. Het werkt ook als je buiten de modus opslaat. Een pset had het veld nodig dat `runCPM` juist wist.
- **Status:** geldt nog. Schema-1-archieven geven geen vastlegging terug (bekende grens).
- **Waar te zien:** `readIFCWithXerReconstruction`.

### B31 — "Einde vóór start weigeren" in de vastlegging: verworpen

- **Wie en wanneer:** de orkestrator, 2026-09-07 (Plan §10.f, "Valse sporen" punt 5).
- **Wat het is:** een voltooide P6-taak kan een einde vóór haar start hebben. Dat is P6's conventie voor voltooide taken (2.049 van 11.953 taken).
- **Waarom logisch:** weigeren zou echte P6-data weggooien.
- **Status:** geldt nog.
- **Waar te zien:** het docblok bij `readXerRecordedTimes`.

---

## 5. Rekenen bij openen (laag 1 en de motor)

### B32 — Drie lagen; laag 2 ("instellingen afleiden") vervalt na een meting

- **Wie en wanneer:** eigenaar, 2026-09-04 (Plan §5, X-O7 en X-O8 "VERVALLEN").
- **Wat het is:** laag 1 bouwt P6-gedrag na. Laag 2 zou ontbrekende P6-instellingen raden. Laag 3 toont de datums van P6. Een meting van 384 instellingscombinaties gaf maximaal 5,6 % winst. Geen enkel bestand had één beste combinatie, en twee bestanden spraken hun eigen SCHEDOPTIONS tegen.
- **Waarom logisch:** een afleiding zonder uniek antwoord is gokken. Met X-O8 viel ook de melding "afgeleide instellingen" weg.
- **Status:** geldt nog.
- **Waar te zien:** Plan §5 X-O7.2.

### B33 — Standaardwaarden voor bestanden zonder SCHEDOPTIONS komen uit de gemeten meerderheid

- **Wie en wanneer:** de orkestrator, 2026-08-20 (Plan §6, X5(b)).
- **Wat het is:** 36 van de 60 orakelbestanden hebben geen SCHEDOPTIONS. Daarvoor kiest de app wat de meeste bestanden met die tabel doen: finish float (41/50), retained logic, lag op de kalender van de voorganger.
- **Waarom logisch:** een meting is beter dan onze eigen huisstandaard ("smallest").
- **Status:** geldt nog, nu als de opties van het profiel Primavera P6.
- **Waar te zien:** `ref-rekenopties-en-conventies.md` (standaardwaarden per profiel); `p6OptionDefaults()` in `src/engine/scheduler/conventions/registry.ts`.

### B34 — P6-gedrag via een bronvlag, later via rekenprofielen; regels A en B

- **Wie en wanneer:** de orkestrator, 2026-08-20: de bronvlag (Plan §4.2, O6-patroon). Eigenaar, 2026-09-22: "Regel A … en regel B … gaan beide in de goal prompt", en het rekenprofiel komt vóór X12 (Overdracht §1a/§1b; Plan §10.f).
- **Wat het is:** gedrag dat alleen bij P6 hoort, staat achter een benoemde conventie. Regel A: een motorwijziging landt alleen als geen exacte cel inexact wordt. Regel B: wat per pakket verschilt, wordt een instelling en nooit een `if` op het bronformaat.
- **Waarom logisch:** de eigenaar wil geen compromissen in de gedeelde motor: "dan rekent het raar voor wie MS Project gewend is" (Overdracht §1b punt 1).
- **Status:** geldt nog. `p6Source` bestaat niet meer (`.claude/rules/xer.md`).
- **Waar te zien:** Bestand › Projectinfo › Rekenprofiel; `npm run verify:conventions`.

### B35 — Regel 7a "voltooide activiteiten krijgen echte speling": correlationeel, eerlijk in de gids, en "laten"

- **Wie en wanneer:** gebouwd door de orkestrator en agents, 2026-09-05 (Plan §5, "klasse (i) OPGELEVERD"). Gids eerlijk gemaakt op 2026-09-24, commit `657f035e3` (Fable bevinding 4). Eigenaar, 24-09 ~18:45, vraag 14, letterlijk: **"laten"** (Overdracht §1a).
- **Wat het is:** een voltooide taak krijgt in P6 een late kant vanaf de statusdatum. Daardoor heeft ze echte speling. Voorbeeld uit de gebruikstest: in rehab-2 heeft V3101090 een TF van 59 dagen. De regel werkt alleen onder vijf bronvoorwaarden. Het enige directe P6-bewijs (casus 09/10) spreekt hem tegen.
- **Waarom logisch:** de regel won 969 LS- en 969 LF-cellen, en geen enkele cel werd slechter. Maar de bewijsbasis is één bestand. Daarom eerlijk in de gids en geen extra instelling. Het alternatief was een zichtbare optie die standaard uit staat (Fable-advies).
- **Status:** de regel staat nog in de code. **Let op:** A21 werkt alleen samen met B3, en B3 staat in het profiel P6 uit (eigenaar, vraag 7: **"ja"**). In het standaardprofiel is 7a dus feitelijk uit. `ref-rekenopties-en-conventies.md` noemt B3 "Alleen gezien in P3-uitvoer. Standaard: uit". De eerlijke gidsparagraaf van het merge-punt vond ik niet terug in de nl-gidsen op `main` [VERMOED: verdwenen bij de Diátaxis-omzetting].
- **Waar te zien:** het docblok in `src/types/project.ts:163`.

### B36 — 7b: weekenddagen herstellen in de kalender, alle negen blokken, en de "penaltyprojectie" eruit

- **Wie en wanneer:** agent en orkestrator, 2026-09-05, commit `f33dbecb0` ("KEUZE: alle negen blokken"). Eigenaar, 2026-09-22: (12) niet beantwoord, dus de heuristiek "blijft zoals hij staat" (Overdracht §1a).
- **Wat het is:** sommige P6-exports klemmen een vrije zaterdag als dubbel record op de vrijdag. De lezer maakt die weekenddag weer vrij. Dat gebeurt alleen met bewijs op het record zelf, en met de herstelcode `WEEKEND_CLAMP_RECONSTRUCTED` in de melding.
- **Waarom logisch:** P6 zet nul datums ín de blokken en 811 datums eromheen. De oude kalender gaf intern foute vensters: 10 werkdagen voor een taak van 7 dagen. "Zonder dec-2008" scoorde 521 cellen beter, maar was niet brongetrouw. De commit zegt: "Een kalender bewust fout zetten om celtellingen te kopen is geen model." De penaltyprojectie verklaarde in geen enkel bestand nog een cel.
- **Status:** geldt nog. De basis is n=1: één bestand op 93. Het is nooit expliciet door de eigenaar bekrachtigd.
- **Waar te zien:** `src/services/xer/xerCalendarData.ts:57`; de kalender heet "Calendar exception (weekend reconstruction)".

### B37 — "Een stap mag geen as slechter maken", met een geschreven uitzondering voor 7b

- **Wie en wanneer:** de orkestrator, 2026-09-05 (Plan §5, "X-O7 — VASTGELEGD"). Eigenaar, 2026-09-22, letterlijk: **"(5) De ES/EF-regressie van 7b blijft staan als tijdelijke stand, geen pin."**
- **Wat het is:** 7b maakte ES en EF slechter (+449 cellen) en LS/LF/TF/FF beter (−1.426).
- **Waarom logisch:** de oude ES-treffers waren een fout die toevallig een andere fout compenseerde. Het plan zegt: "Een geschonden planregel zonder geschreven uitzondering is een tijdbom voor de volgende reviewer."
- **Status:** opgelost. Dossier 7b-4 (B38) nam de regressie weg.
- **Waar te zien:** Plan §5, onder "Afspraken met de etappe taaktypes".

### B38 — Dossier 7b-4: in #109 niet gebouwd, daarna "eerst meten, dan bouwen"

- **Wie en wanneer:** de orkestrator, 2026-09-07: gemeten en niet gebouwd (Plan §9). Eigenaar, 2026-09-22, letterlijk: **"(8) Dossier 7b-4 hoort bij 'naar nul': eerst meten, dan bouwen."**
- **Wat het is:** na 7b staat het startanker van 247 taken 1–2 werkdagen te laat, met hetzelfde venster.
- **Waarom logisch:** de oorzaak was onbekend. Bouwen zonder diagnose is gokken.
- **Status:** gebouwd na #109 als C1–C3 (X12 brok 2, 15.056 → 12.973). Daarna is C1 in P6 uitgezet, omdat het P3-gedrag bleek (B8).
- **Waar te zien:** Plan §9, "7b-4".

### B39 — Openen rekent met dezelfde invoer als F5

- **Wie en wanneer:** de orkestrator en een agent (Opus 5.5), 2026-09-24, commit `f61b7d076` (Fable bevinding 1, "minimale port … zonder de rekenprofiel-infrastructuur").
- **Wat het is:** bij het openen gaf de app het projecteinde niet aan de solver. Op Hotel_Construction veranderden daardoor 4.217 late datums en 388 kritiek-vlaggen bij de eerste F5, zonder dat je iets bewerkte. Het bezettingsoverzicht, de verdeelberekening en de benchmark gebruiken nu ook dezelfde invoer.
- **Waarom logisch:** wat je ziet na openen moet gelijk zijn aan F5. Anders meet X12 iets anders dan wat de gebruiker ziet.
- **Status:** geldt nog. Het staat in de releasenotitie van de PR.
- **Waar te zien:** `src/state/documentActivation.ts:239` (`solveInputFor`).

### B40 — Projecteinde-fout: niet gefixt in #109; vraag 16 "eigen PR", geland op #169

- **Wie en wanneer:** de orkestrator, eindreview 2026-09-07: niet fixen, wel in de gids noemen. Eigenaar, 2026-09-22: (10) niet expliciet beantwoord, het valt onder "restant omlaag". Eigenaar, 24-09 ~19:00, vraag 16, letterlijk: **"eigen PR"**. De orkestrator besloot op 25-09 de fix niet op #109 te landen (Overdracht §1d, punt 16).
- **Wat het is:** met `sched_use_project_end_date_for_float=Y` en zonder einddatum verzon de lezer een projecteinde-anker. In het ergste geval was dat de projectstart, en dan staat bijna alles kritiek.
- **Waarom logisch:** op #109 brak de fix regel A. X12 ging van 15.056 naar 15.154, met 149 slechtere cellen in OZB. Op #169 gaf hij 0 cellen verschil. Regel A volgen betekende: landen waar het niets kapotmaakt.
- **Status:** gefixt op `main` via #169 (`hasUsableProjectEnd`, `xerReader.ts:808`). Eén vraag blijft open: OZB-Start heeft negatieve float zonder `plan_end_date` (Plan §9; Overdracht §1d-4).
- **Waar te zien:** `src/services/xer/xerScheduleOptions.ts:486`.

### B41 — `lagCalendar` werkt nu voor alle formaten: accepteren, met releasenotitie

- **Wie en wanneer:** eigenaar, 2026-09-22, letterlijk: **"(11) `lagCalendar` effectief voor alle formaten: accepteren, met releasenotitie."**
- **Wat het is:** een bestaand niet-XER-document waarin ooit "successor" of "24hour" is gekozen, plant na de update anders.
- **Waarom logisch:** de instelling deed eerst niets. Nu doet ze wat ze zegt. Een migratie kost meer dan een notitie.
- **Status:** **de releasenotitie is nog open** (`docs/TODO.md`, item "`lagCalendar` is sinds X5 effectief"). Ik vond hem niet in `docs/release-notes/`.
- **Waar te zien:** `docs/TODO.md`.

---

## 6. Bronarchief

### B42 — Het volledige `.xer` gaat mee in het IFC

- **Wie en wanneer:** de orkestrator, plan X9 (2026-08-20). De vorm (compact schema 2, alleen bytes) is gekozen tijdens de bouw [VERMOED: orkestrator en agent; geen apart besluit gevonden].
- **Wat het is:** IFC is het eigen formaat. Om niets van P6 te verliezen, bewaart het IFC het oorspronkelijke bestand. Bij openen leest de app het opnieuw (sha256 wordt gecontroleerd).
- **Waarom logisch:** zo werken herkomst, de modus na heropenen (B30) en MCP-provenance zonder dat elke P6-kolom een eigen IFC-veld nodig heeft.
- **Status:** geldt nog.
- **Waar te zien:** `src/services/xerSourceArchive.ts`; gids `ref-import-exportformaten.md` ("met het oorspronkelijke `.xer` erin").

### B43 — Archief "één keer schrijven, in het IFC, niet per crashherstel-snapshot"

- **Wie en wanneer:** de eindreview (2026-09-07) liet de keuze aan de eigenaar. Eigenaar, 2026-09-22, letterlijk: **"(9) Bronarchief één keer schrijven, in het IFC, niet per crashherstel-snapshot."**
- **Wat het is:** nu gaat het archief mee in elke auto-save. Gemeten op `rehab-2.xer` (17,7 MB): een IFC van 50 MB, een herstelronde van 73 s en 3,1 GB, en ±3,6 s hoofdthread per tik.
- **Waarom logisch:** het archief verandert nooit. Het elke 10 seconden opnieuw schrijven kost veel en levert niets op.
- **Status:** **niet gebouwd.** `docs/TODO.md` heeft het punt nog open. `.claude/rules/xer.md` zegt nog dat "elke crashherstel-snapshot … het archief [draagt], zonder bovengrens". De gidstekst over de prijs (het merge-punt, `gids-xer-import.md` §"Opslaan en uitwisselen") vond ik niet terug op `main`.
- **Waar te zien:** `docs/TODO.md`, item "XER: het bronarchief heeft geen bytegrens".

### B44 — Een onbruikbaar archief: het project opent, met een melding

- **Wie en wanneer:** eigenaar, 24-09 ~18:55, vraag 15, letterlijk: **"openen met melding"** (Overdracht §1a). Commits `33038cec2` en `389ddc061`. Dit draait het eerdere etappebesluit "geen legacy fallback" om.
- **Wat het is:** is het archief corrupt, of heeft een ander IFC-programma het herschreven, dan opent het project zonder archief. Er komt één melding: "Het XER-bronarchief in dit bestand is onbruikbaar en weggelaten; het project zelf is volledig geopend."
- **Waarom logisch:** het archief is een bijlage en niet de basis. Alle taken en relaties staan gewoon in het IFC. Eerst kon één IFC-tool die psets herordent het hele project onleesbaar maken (Fable bevinding 6).
- **Status:** geldt nog.
- **Waar te zien:** `src/state/xerArchiveIssueNotice.ts:38`; gids `howto-xer-openen.md` §"Valkuilen".

### B45 — MCP-provenance: niet in batch, vrije tekst standaard verborgen, namen…

- **Wie en wanneer:** de orkestrator en agents, 2026-09-05, commits `9c8834294` en `262a59f3f`. "Geaccepteerd risico": `name`/`code` zichtbaar. Eigenaar, 2026-09-22, letterlijk: **"(4) MCP-provenance: codes altijd, resourcenamen alleen achter opt-in, en de AI-client moet die opt-in aan zijn gebruiker vragen."**
- **Wat het is:** `planner_inspect_xer_provenance` mag geen CPM starten (daarom niet batchable). Notities en vrije tekst zijn zonder `includeRawRows` onzichtbaar. Een P6-resourcenaam is vaak een persoonsnaam.
- **Waarom logisch:** privacy. De eigenaar wil dat de gebruiker zelf kiest of een AI persoonsnamen ziet.
- **Status:** **het deel over namen is niet gebouwd.** Op `main` staat nog: "GEACCEPTEERD RISICO: `name` en `code` blijven zichtbaar" (`src/services/mcp/tools/xerProvenanceTools.ts:92`).
- **Waar te zien:** zie de regel hierboven.

### B46 — Extensie-API: de permissie `importSource` staat standaard uit

- **Wie en wanneer:** orkestrator en agents, etappe X9 [datum niet apart gevonden]. Fable-review "Wat wél klopt".
- **Wat het is:** een extensie leest het bronarchief alleen na toestemming. De consentdialoog toont deze permissie apart.
- **Waarom logisch:** het archief kan namen en notities bevatten.
- **Status:** geldt nog. Sinds vraag 15 bestaat ook `data.getImportSourceIssue()` (API 1.2.0).
- **Waar te zien:** `extConsent.permImportSource` in de i18n.

### B47 — Exportverlies: waarschuwen bij CSV, MSPDI en P6 XML; geen melding op voortgangsbladen

- **Wie en wanneer:** de orkestrator, plan X9 (de exportranden waarschuwen). Op 2026-09-22 bij de merge-review: "voortgangsbladen krijgen geen XER-verliesmelding" (Overdracht §1c, commit `bd0fb55be`).
- **Wat het is:** exporteer je een XER-project naar CSV, dan zegt de app: "Bij export naar CSV gaat XER-broninformatie verloren." IFC verliest niets.
- **Waarom logisch:** de gebruiker moet weten wat hij verliest. Een voortgangsblad is geen uitwisseling van het project. Een melding daar is ruis.
- **Status:** geldt nog. De melding komt ná de opslagdialoog (`docs/TODO.md`, open).
- **Waar te zien:** `src/services/xerExportLoss.ts:266`.

---

## 7. Proces en mergen

### B48 — Main wordt in de etappebranch gemerged, geen rebase

- **Wie en wanneer:** eigenaar, 2026-09-04 (Plan §5, X-O6).
- **Wat het is:** de commit-identiteiten blijven gelijk.
- **Waarom logisch:** reviewrapporten en browserbewijs verwijzen naar commit-sha's. Een rebase maakt die verwijzingen ongeldig.
- **Status:** afgerond.
- **Waar te zien:** de merge-commits in de geschiedenis van #109, bijvoorbeeld `c2284cf66` en `0a29147c1`.

### B49 — "#109 merget niet met een rode productpoort", en de feitelijke merge op 25-09

- **Wie en wanneer:** eigenaar, 2026-09-09: DRAFT, niet mergen (PR-tekst). Eigenaar, 2026-09-22: "#109 merget niet met een rode productpoort. Het restant van 15.056 cellen gaat eerst omlaag." Eigenaar, 25-09 ~17:30: **"doe alles wat je nog nodig is om het af te maken, wanneer deze hele etappe af is ga jij alle openstaasnde PRS mergen."** En 25-09 ~18:10: **"je mag alle openstaande PRs mergen, allemaal."** (Overdracht §1a).
- **Wat het is:** #109 is op 25-09 om 20:00 gemerged (`1d8f2df6`). Op die kop was X12 nog 15.056. Daarna volgden direct #167, #169 en #170. Aan het eind van de stapel stond X12 op 76.
- **Waarom logisch:** de stapel was één geheel. Het X12-werk zat in #169, dat op #109 bouwde. Het corpus draait niet in CI, dus CI was groen. [VERMOED: de opdracht van 25-09 gaf het oude "niet mergen bij rood" impliciet op voor de stapel als geheel. Een expliciete zin daarover vond ik niet.] Het nuldoel is ook op het eind niet gehaald (76).
- **Status:** gemerged.
- **Waar te zien:** Overdracht §0 "EINDSTAND 2026-09-26".

### B50 — "Datums zoals opgeslagen voor alle formaten" wordt een aparte PR

- **Wie en wanneer:** eigenaar, 2026-09-22: "wordt een aparte PR na de merge, niet op #109."
- **Wat het is:** het werk werd PR #167.
- **Waarom logisch:** #109 was al 348 bestanden groot. Een kleinere PR is te reviewen.
- **Status:** afgerond. #167 is gemerged.
- **Waar te zien:** PR #167.

### B51 — Afspraken met de taaktypes-etappe (#101): volgorde, opslag van het duurtype, geen nieuw werkveld

- **Wie en wanneer:** "Afspraken met de etappe taaktypes / opgeslagen werk (2026-09-04)" (Plan §5). Commits noemen het "eigenaarsafspraak 2026-09-04" (`a5b158e70`, `5ad60044f`).
- **Wat het is:** #101 merget na #109. `Task.p6DurationType` is de opslag voor het duurtype. XER maakt geen eigen werkveld. Curves gaan via `contourEngine.ts`. `p6xmlReader` leest ook `<DurationType>`.
- **Waarom logisch:** twee etappes raken dezelfde typen. Zo ontstaan geen twee eilanden.
- **Status:** afgerond.
- **Waar te zien:** Plan §5.

### B52 — De 49 OzBuild-`.mpp`-bestanden gaan naar de privérepo

- **Wie en wanneer:** eigenaar, 2026-09-22, "optie 1". De eigenaar mat zelf: 213 pins groen (Plan §10.f).
- **Wat het is:** #109 raakte de gedeelde solver. Voor 49 van de 213 `.mpp`-pins was de uitkomst onbekend.
- **Waarom logisch:** zo kan een agent ook die bestanden meten. Zonder deze stap bleef de `.mpp`-regressie half onbewezen.
- **Status:** afgerond. `.mpp`-fidelity is 216/0/0.
- **Waar te zien:** `check-mpp-fidelity.ts`.

---

## 8. Wat bewust NIET gebouwd is

### B53 — Geen XER-export

- **Wie en wanneer:** de orkestrator, 2026-08-20 (Plan §1, "Wat er níét in deze etappe zit").
- **Wat het is:** de app leest `.xer`, maar schrijft het niet. Export naar P6 loopt via P6 XML, met een verliesmelding.
- **Waarom logisch:** lezen-getrouw was al een grote etappe. Voor schrijven is MPXJ's writer een eigen referentie.
- **Status:** open in `docs/TODO.md`, "Primavera XER export".
- **Waar te zien:** `ref-import-exportformaten.md`: "Alleen lezen zijn `.mpp` en `.xer`".

### B54 — MPXJ alleen lezen om te begrijpen

- **Wie en wanneer:** een regel uit etappe 1 (Plan §4.4).
- **Wat het is:** de XER-lezer is zelf geschreven. MPXJ (LGPL-2.1) is alleen geraadpleegd.
- **Waarom logisch:** zo is er geen licentie- of JVM-afhankelijkheid. De gids zegt het ook: "De `.xer`-lezer is geen overname".
- **Status:** geldt nog.
- **Waar te zien:** `ref-import-exportformaten.md:59`.

### B55 — Geen bovengrens op documenten per bestand, en de exportmelding komt ná het schrijven

- **Wie en wanneer:** eindreview 2026-09-07. Volgens Plan §10.e "Niet verwerkt (eigenaar)".
- **Wat het is:** elk document uit één bestand draagt een eigen archiefkopie. Het corpus heeft maximaal 15 projecten.
- **Waarom logisch:** het risico is [VERMOED] en niet gemeten.
- **Status:** open in `docs/TODO.md`.
- **Waar te zien:** `docs/TODO.md`.

### B56 — C5 krijgt geen poort onder Progress Override (na #109)

- **Wie en wanneer:** de orkestrator, 2026-09-23 (Plan §9, "Besluit: niet bouwen").
- **Wat het is:** het tegenfeit is gemeten. Het gaf 0 cellen verschil.
- **Waarom logisch:** "een poort zonder meetbaar effect is een ongetoetste conventie (regel A/B)".
- **Status:** geldt nog. De vraag gaat weer open als er een geschikt orakel komt.
- **Waar te zien:** Plan §9, "Vervolgpunten X12 brok 3".

---

## Niet traceerbaar

Bij deze punten zie ik dat er een keuze is, maar vind ik de reden of een besluit van de eigenaar niet.

1. **Isolatie van het corpus in een privérepo.** Plan §4.3 zegt "Corpus is publiek; … bestandsnamen mogen gewoon in tests en commits". Plan §10.a noemt `OpenAEC-Foundation/ops-xer-corpus` een **privé**-repo. Wie dat besloot en waarom, vond ik niet.
2. **De "kritiek"-regel van B26.** De orkestrator vroeg om bevestiging (Plan §10.f, "NIEUW"). De eigenaar beantwoordde op 22-09 alleen het deel over samenvattingen (6).
3. **De weekend-klemheuristiek (B36).** Eigenaarsvraag 12 is "niet expliciet beantwoord". Er is alleen "blijft zoals hij staat".
4. **Fable-review bevinding 8 (tokenizer verliest de rest van een rij bij een losse regeleinde), 13 (bibliotheek-refresh in de modus), 14 (`base_clndr_id`-overerving niet toegepast) en 15 (andere codetabellen).** Er is geen fix-commit en geen besluit om ze te laten. Bevinding 10 (verzonnen `0`/`.F.` in IfcTaskTime) is vermoedelijk opgelost in #167 ("`$`-slots", Overdracht §1a). Dat heb ik niet geverifieerd.
5. **De pop-up per formaat met "niet meer tonen".** De vault-definitie "wanneer is een bestandsimplementatie af?" eist een pop-up per formaat, met een knop om die niet meer te tonen. Voor XER vond ik geen pop-up en geen besluit om die te laten.
6. **De verdwenen gidsparagrafen.** Op het merge-punt had `gids-xer-import.md` paragrafen over 7a ("benadering"), de weekendreconstructie, de getalnotatie (X-O5-eis), de prijs van het archief en de projecteinde-fout. In de nl-gidsen op `main` vond ik ze niet terug. De Diátaxis-omzetting (`6e7c30bab`) is een waarschijnlijke oorzaak [VERMOED]. Een besluit om ze te schrappen vond ik niet.
7. **Het merge-moment van #109 bij een rode X12 (B49).** De opdracht van 25-09 zegt "alle PR's mergen". Ik vond geen zin die het besluit "niet met rode productpoort" van 22-09 expliciet intrekt.
8. **De vorm van het bronarchief (compact schema 2) en de permissie `importSource` (B42, B46).** Er zijn geen aparte besluitregels met reden. Het staat alleen beschreven in code en review.
