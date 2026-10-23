# Planning-CPM-regressietests

Datagestuurde tests voor de **correctheid van de planningsberekening** (kritiek pad, relatietypes,
mijlpalen, kalender). Ze draaien tegen de **échte** store + rekenmotor (`src/state/appStore` →
`runCPM` → `CPMSolver`/`CalendarEngine`), headless, dus precies de code die ook in de desktop-app draait.

## Draaien

```bash
bash tests/planning/run.sh            # alle batterijen + alle check-*.ts + de tijdzone-matrix
bash tests/planning/run.sh cases-relations.json                    # één CPM-batterij
bash tests/planning/run.sh check-document-contract.ts              # één losse check
bash tests/planning/run.sh cases-relations.json check-document-contract.ts   # door elkaar
```

Exit 0 = alles groen, exit 1 = afwijking (toont per geval het verschil verwacht↔actueel). De laatste
regel, `EINDOORDEEL planningssuite: GROEN/ROOD`, volgt altijd de exitcode; tussenregels als
"(alles groen)" gaan alleen over hun eigen deel.
`run.sh` bundelt `harness.ts` met esbuild (komt met Vite mee) en draait het op Node — geen extra deps.

De tijdzone-matrix aan het eind (alle bundels opnieuw onder vijf tijdzones) draait de zones
tegelijk, hoogstens zoveel als er processorkernen zijn; `OPS_TZ_JOBS=1 bash tests/planning/run.sh`
draait ze één voor één, zoals vroeger. De uitvoer staat altijd in vaste zonevolgorde.

### Gerichte runs

Zodra je één of meer bestandsnamen meegeeft — `cases-*.json` en/of `check-*.ts`, door elkaar — draait
`run.sh` **uitsluitend** die batterijen/checks. Een gerichte run slaat daarmee stilzwijgend de rest
van de losse `check-*.ts`-regressiebatterijen (zie hieronder) én de tijdzone-matrix onderaan het
script over — dat gebeurde altijd al zodra je een argument meegaf, ook toen alleen `cases-*.json`
mogelijk was. Sinds deze paragraaf print `run.sh` daarom aan het eind van een gerichte run een
zichtbare waarschuwing met het aantal overgeslagen checks, dynamisch geteld uit het script zelf —
er staat bewust geen getal in deze README, want dat veroudert bij elke nieuwe of verwijderde check;
laat `bash tests/planning/run.sh <iets ongeldigs>` of een gerichte run het actuele aantal tonen.
Een nieuwe `check-*.ts` hoef je **niet** in `run.sh` te bedraden: de volledige run bundelt en draait
elke `check-*.ts` zonder eigen `bundle_check`-regel automatisch, inclusief de tijdzone-matrix (de
check-scriptinventaris bovenin `run.sh` somt ze op). Een eigen regel is alleen nodig voor een check
die iets bijzonders vraagt — een omgevingsvariabele, een vaste plek, of juist niet in de
tijdzone-matrix (zie de twee performance-checks). Een check die bewust níét mag meedraaien, zet je
met een reden op `CHECK_SCRIPT_ALLOWLIST`.
Vertrouw pas op een gerichte run voor snel itereren; draai vóór een commit/PR altijd `run.sh` zonder
argumenten. Een onbekende bestandsnaam (geen bestaand `cases-*.json`/`check-*.ts` in deze map) geeft
een `XX`-foutregel en exitcode ≠ 0, zonder de rest van de gevraagde bestanden te blokkeren.

### Optionele MPP-corpora: brede root en rooktestset

De scopes hebben verschillende, ongewijzigde meetlatten. `mppCorpus.ts` kiest de paden zonder
bestanden te lezen, mapnamen te raden of een ontbrekende scope door een andere te vervangen.

| Optie | Scope | Checks |
|---|---|---|
| `OPS_MPP_CORPUS` | Bedrijfscorpus, los van de crawl | Bestaande corpuschecks; samen met de brede crawl de F4-pin van 216 bestanden / 3413 taken |
| `OPS_MPP_CRAWL` | Brede `testdata-crawl`-root, met onder meer `mpxj/junit/data` en `crawl-mpp` | Import H4/F4/Z2/Z3/Z4; F4 telt recursief samen met het bedrijfscorpus |
| `OPS_MPP_CRAWL_SMOKE` | Exacte map voor de rooktestset; standaard `<OPS_MPP_CRAWL>/crawl-mpp` | T9-import (49 bestanden / 788 taken), T7-relaties en T6-kalenders |

Zonder opties blijven de historische standaardpaden gelijk: de brede root is
`/home/nozzit/open-aec/voor claude/testdata-crawl`, de rooktestset de submap `crawl-mpp`.
`OPS_MPP_CRAWL_SMOKE` kan ook zonder `OPS_MPP_CRAWL` worden gezet; de brede root houdt dan zijn
standaard. `OPS_MPP_DURATION_FIXTURE` blijft een afzonderlijke override voor de T10-fixture.
Ontbrekende mappen blijven optioneel en geven de bestaande skipmelding; een aanwezige map kiest
geen andere baseline en schakelt geen inhoudelijke guard uit.

Bestaande configuraties bewust migreren:

- `OPS_MPP_CRAWL=/data/testdata-crawl` blijft de brede root. T6/T7/T9 gebruiken voortaan de submap
  `crawl-mpp`, precies zoals bij de configuratie zonder override.
- `OPS_MPP_CRAWL=/data/testdata-crawl/crawl-mpp` koos vroeger alleen voor T6/T7/T9 de juiste scope
  en gaf F4 de verkeerde meetlat. Zet voortaan `OPS_MPP_CRAWL=/data/testdata-crawl`. Staat de
  rooktestset elders, stel daarnaast `OPS_MPP_CRAWL_SMOKE=/andere/rooktestset` in. Een kale map
  met alleen rooktestbestanden is geen vervanging voor de brede root.
- Om beide crawls bewust over te slaan, moet de brede root ontbreken en mag er geen bestaande
  rooktestoverride zijn. `OPS_MPP_CRAWL=/niet-aanwezig` kiest standaard ook een ontbrekende
  `/niet-aanwezig/crawl-mpp`; het bedrijfscorpus blijft apart via `OPS_MPP_CORPUS` instelbaar.

T6 krijgt uitsluitend dezelfde padselectie: zijn kalenderverwachtingen blijven gelijk. De overige
optionele corpuschecks (onder meer fidelity en recorded-times) houden hun bestaande brede
`OPS_MPP_CRAWL`-scope en vallen buiten deze wijziging.

T7 en F4 onderscheiden ondersteund MPP14 van bewust geweigerd MPP8/9/12. De container moet
onafhankelijk de oude variant herkennen én de echte lezer moet `MppUnsupportedError` met
`MPP_LEGACY` gooien. Die bestanden tellen apart, niet als gelezen bestanden of leesfouten.
Alle andere fouten blijven rood: gewone lees-/containerfouten, onbekende formaten, versleuteling,
een legacyfout op MPP14 en een lezer die een oude variant ineens accepteert. F4 meldt onverwachte
fouten alleen met hash (indien leesbaar) en fouttype om bedrijfsnamen buiten de uitvoer te houden.
De 216/3413-pins, TYPE/EFFORT_DRIVEN-pins en T7-domeinbaselines blijven staan, ook als alle
gevonden bestanden geweigerd of onleesbaar zijn. T9 blijft een strikte rooktest van 49 bestanden
met 788 taken; daar worden geen versieafwijzingen vrijgesteld.

`check-mpp-corpus-contract.ts` draait automatisch in de gewone suite, ook zonder extern corpus.
Hij controleert standaardpaden, verplaatste roots, beide onafhankelijke overrides en migratie,
en gebruikt synthetische CFB/MPP-bytes met de echte reader plus geïnjecteerde foutpaden voor de
versieclassificatie. Dit bewijst niet dat de optionele echte corpora hun historische totalen of
fidelity behouden: zonder die data slaat CI die corpuslagen over.

## Hoe het werkt (en waarom zo)

Een testgeval is **data**: een netwerkje van taken + relaties + de verwachte uitkomst. `harness.ts`
bouwt elk geval via de echte store-acties (`addTask`, `addSequence`, `setCalendar`, `runCPM`) en leest
de berekende velden terug (`earlyStart/Finish`, `lateStart/Finish`, `totalFloat`, `freeFloat`,
`isCritical`, kritiek pad, projecteinde/-duur), en vergelijkt met `expect`.

**Anti-circulariteit:** de verwachte waarden zijn afgeleid uit standaard CPM-theorie (PMI/leerboek),
niet uit de solver-code. Zie [`BRIEF.md`](BRIEF.md) voor de conventies (inclusieve einddag, FS = werkdag
ná de finish, lag in werkdagen, lead = negatieve lag, FF = finishes uitlijnen, enz.) en de werkdag-tabel.
`caldict.mjs` is een onafhankelijke werkdag-rekenaar om verwachte datums mee na te rekenen.

## Batterijen

De JSON-batterijen staan hieronder op alfabet. `run.sh` globt ze, maar vergelijkt de glob met de
expliciete lijst `EXPECTED_BATTERIES` bovenin het script (bevinding K10b): een verdwenen bestand is
rood, en een **nieuw `cases-*.json` dat niet in `EXPECTED_BATTERIES` staat óók** (`XX  batterij-inventaris:
… niet in EXPECTED_BATTERIES`). Zet bij een nieuwe batterij dus de naam (zonder `cases-` en `.json`) in
die lijst, en vul deze tabel aan.

| Bestand | Dekt |
|---|---|
| `cases-advanced-cpm.json` | geavanceerde constraints (Mandatory-pin, secundaire constraint, uur-modus-constraints) en de analyselaag (interfering float, near-critical, kritiek-definitie-opties), plus hammocks, externe relaties, float-paden en werkonderbrekingen (splits) (fase 2.9 e.v.) |
| `cases-baselines.json` | baselinevariantie: op schema/te laat/te vroeg, projecteinde-delta, nieuwe en verwijderde taken |
| `cases-boundary.json` | randgevallen: SF/FF-lead als ondergrens, kalender zonder werkdagen (fout), losse deelnetten, feestdag op de FS-overgang, afwijkende werkweek |
| `cases-calendar.json` | weekenden, feestdagen, afwijkende werkweek |
| `cases-calibration.json` | basisconventies (ijking) |
| `cases-constraints.json` | datum-constraints, deadlines, negatieve float (fase 2.3) |
| `cases-driving.json` | driving/non-driving relaties + afgekapte leads (fase 2.1) |
| `cases-edge.json` | cyclus, leeg, lange keten, WBS-/fase-oprol |
| `cases-float.json` | totale vs. vrije speling, kritiek pad, diamanten/ladders |
| `cases-hours.json` | uur-modus met de referentiekalenders: binnen-dag-FS, float in minuten, lunchpauze, nachtploeg over middernacht, 24/7, WORKTIME vs. ELAPSED (fase 2.8b) |
| `cases-hours-blokgrenzen.json` | urenpad op een blokgrens (F1, knownbugs 138–142, 145 en 147): deadline zonder/met tijd, zachte MSO/SNLT op een blokbegin, nivelleervertraging die op een blokeinde landt, externe FS/FF-opvolger op een blokbegin, FF tussen dagtaken op een kalender met werkblokken, ook met een vrije dag op de opvolgerkalender en na een ELAPSEDTIME-voorganger; SNLT van een ELAPSEDTIME-taak en van een urenmijlpaal buiten werktijd; landing in de pauze en op een feestdag; eindmijlpalen na FF/FS met lag, FNET/FNLT/MFO zonder tijd, FF met splits en externe voorganger, en N2 met dagen- én minutenwaarde |
| `cases-hours-relations.json` | SS/FF/SF met lag > 0, = 0 en < 0 in uur-modus, vooruit én terug, plus pauze-, nacht-, weekend-, elapsed-, kruiskalender- en mijlpaalvarianten (vangnet voor de relatiewiskunde, P15) |
| `cases-kalenders.json` | taakkalenders: lag in de voorgangerkalender, merges en SS/FF/SF over verschillende kalenders, geen-taakkalender-no-op, leveler, werkende uitzonderingen, undo |
| `cases-lag-advanced.json` | lag-eenheid (werkdagen vs. kalenderdagen/elapsed) + procent-lag (fase 2.1) |
| `cases-milestone-kinds.json` | start- vs. eindmijlpaal: waar een FS naar of vanaf een mijlpaal landt, en de invariant dat een eindmijlpaal in een keten niets verschuift |
| `cases-milestones.json` | mijlpalen (duur 0): start/eind/tussen/fork/join |
| `cases-move-project.json` | "Project verplaatsen" (pakket D1): verschuiving vooruit/terug, shift-dan-snap, kalender die NIET meeschuift (jaargrens/bouwvak), constraints/deadlines/harde pins/externe ankers/actuals die wél meeschuiven, uur-modus, undo, Δ=0-no-op |
| `cases-msp-pariteit.json` | MS Project-pariteit: de mijlpaal-instantconventie (eindmijlpaal op de rauwe voorganger-finish) met controlecases, en verder o.a. negatieve lag, elapsed, kruiskalender-bandgrenzen, ankerregels en handmatig geplande taken |
| `cases-probes.json` | minimale gevallen per (voorheen) bug — regressiebewaking |
| `cases-progress.json` | voortgang: drie voortgangsstaten, data-date-vloer, out-of-sequence (retained logic vs. progress override), voltooide pins, hervatten van restwerk |
| `cases-relations.json` | FS/SS/FF/SF + lag/lead, meerdere voorgangers, ladder (SS+FF) |
| `cases-resource-leveling.json` | resource leveling en smoothing: conflictoplossing, prioriteit en pin (1000), deterministische tiebreak, eerlijk herrekende float |
| `cases-resource-load.json` | resources/toewijzingen/curves/kalenders/availabilitySteps → `resourceLoadResult` (belasting/capaciteit/overallocatie, fase 2.5) |
| `cases-view.json` | de headless view-engine (fase 2.7): filters, sorteren, groeperen, inklappen, boommodus, de volledige pijplijn, ontbrekende verwijzingen, tijdschaal-round-trip en tabel-/Gantt-pariteit |

`cases-p6-verified.json` draagt de verplichte naam maar is **geen** batterij in dit schema: het is
meetlatdata uit een P6-capture (gegenereerd door `scripts/generate-p6-verified-cases.mjs`), die
`run.sh` via `is_auxiliary_case_data` overslaat en die door eigen checks wordt gelezen
(`check-p6-verified-cases.ts`, `check-p6-verified-cases-engine.ts`). Hij staat dus niet in
`EXPECTED_BATTERIES`.

De losse check-batterijen (geen JSON-cases, eigen scripts die `run.sh` bij een volledige run meestart,
en die je sinds de paragraaf *Gerichte runs* hierboven ook los met hun bestandsnaam kunt aanroepen)
staan bovenin `run.sh`. Nieuw in pakket D1: `check-move-project.ts` — de veld-voor-veld shift-verdicten
uit de veld-inventarisatie, de feestdagendekking (R7), de preview-zuiverheid en de Δ=0/ongeldige-datum-
guards; alles wat de JSON-batterij niet kan zien omdat het niet via de solver loopt.

### Gedeelde fixtures (`tests/fixtures/`)

Fixtures die door MEER DAN ÉÉN suite gebruikt worden staan in `tests/fixtures/`: `recordedDatesIfc.ts`
(de IFC van issue #63: twee taken, één FS-relatie, opgeslagen datums die niet uit de logica volgen) en
`recordedTimesFormats.ts` (de "datums zoals opgeslagen"-formaten). Zoek de gebruikers met grep; noem ze hier niet.
Eén bron, zodat de batterijen niet uit elkaar lopen over wat het geval precies ís. Fixtures die
maar één batterij dient horen gewoon in die batterij thuis.

## Minutenmodel: twee extra runs en de voorbeeldensnapshot

Fase F0 van "alleen uren" (spec `docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §6.1 en §6.3).
De volledige `run.sh` draait de harness daarna nog twee keer, niet in de tijdzone-matrix:

- `OPS_MINUTE_MODEL_RUN=1`: run 1, de dagenmaat. Taken, lags en nivelleervertraging blijven in dagen.
- `OPS_MINUTE_MODEL_RUN=2`: run 2, de urenmaat. Duur en lag gaan bij de invoer naar minuten.

Beide runs zetten elke dagcase om naar de tijdas in minuten, met de productiefunctie
`migrateToMinuteModel` (`src/state/migrations/minuteModel.ts`), en vergelijken op dagniveau met de
werkdag van een moment (`src/engine/calendar/workdayRules.ts`). Een urencase telt niet mee. Per batterij
staat een regel `MM …` in de uitvoer, en per case die niet gelijk is een regel `MMCASE`.

**Redencodes.** Een case die bewust anders uitkomt, krijgt een sleutel `minuteModel` met een code uit
§6.1 (`CONV-SF`, `PCT-LAG-EXACT`, `REST-EXACT`, `KALENDERTIJD-EINDE`, `PROFIEL-URENMAAT`), een `note` en
een `expect` met het doel. Alleen de velden die de code verandert, staan in die `expect`. Een datum
zonder tijd leest de vergelijker met de regel van het veld; een datum met tijd vergelijkt hij exact.
Een fout krijgt nooit een code. Verander de gewone `expect` van een case hiervoor niet.

**Het vangnet `minute-model-runs.json`.** Per run en per batterij staan daar de dagcases die na de
redencodes niet gelijk zijn. De run is rood als er een case bijkomt of afgaat. Heb je een fout in het
urenpad opgelost, haal de case dan uit de lijst. Bijwerken na een bewuste wijziging:

```bash
bash tests/planning/run.sh   # eerst: zie welke cases erbij komen of afgaan (regels "XX  minutenmodel")
# daarna de lijst opnieuw laten schrijven, met de harness-bundel die run.sh achterlaat
# (zonder cases-p6-verified.json, zoals run.sh):
CASES=$(ls tests/planning/cases-*.json | grep -v cases-p6-verified.json)
OPS_MINUTE_MODEL_UPDATE=1 OPS_MINUTE_MODEL_RUN=1 node tests/planning/.harness.mjs $CASES
OPS_MINUTE_MODEL_UPDATE=1 OPS_MINUTE_MODEL_RUN=2 node tests/planning/.harness.mjs $CASES
```

Analyseren:
`OPS_MINUTE_MODEL_VERBOSE=1` toont de verschillen per case, `OPS_MINUTE_MODEL_DEBUG=1` daarbij de
datums van alle taken uit de motor.

**De voorbeeldensnapshot.** `check-minute-model-examples.ts` laadt elk IFC-voorbeeld uit `examples/`,
rekent het en vergelijkt per taak (WBS-code plus naam) vroege en late start, vroeg en laat einde en de
speling met `fixtures/minute-model-examples.json`, op dagniveau. F2 en F3 moeten die snapshot halen.
Bijwerken alleen na een bewuste wijziging, met de reden in de commit:

```bash
OPS_MINUTE_MODEL_EXAMPLES_UPDATE=1 bash tests/planning/run.sh check-minute-model-examples.ts
```

`check-minute-model.ts` toetst de dagregels (werkdag van een moment, D1–D7) en de migratiefunctie los.
De werkdagfunctie staat bij de gedeelde kalenderregels in `src/engine/calendar/workdayRules.ts`.
Een nachtblok di 22:00–wo 06:00 hoort bij dinsdag, ook voor een moment wo 02:00 en het einde wo 06:00.
Buiten een echt werkblok geldt de klokdatum; de functie verzint geen blok op een vrije dag.
Een eindmoment om 24:00 (00:00 van de volgende dag) hoort bij de vorige dag. De check bewaakt ook
vrije dagen, een feestdag en kalendertijd. Deze regels zijn nog niet aangesloten op de app.

## Een geval toevoegen

Voeg een object toe aan de `cases`-array van het passende bestand (schema in `BRIEF.md`). Geef alléén de
velden die je wilt asserten. Reken de verwachte waarden met de hand na uit de CPM-theorie — niet uit de
solver — en draai `run.sh`.

## Achtergrond

De aanleiding en de oorspronkelijke bevindingen staan in
[`docs/planning-test-bevindingen.md`](../../docs/planning-test-bevindingen.md).

### F1: urenfouten en de statusregel

De blokgrensbatterij bevat 48 cases (30 uit PR #402, 18 uit F1b).
check-hours-f1-status.ts controleert de echte dialoogopslag, paneelsetters, raster, plakken en
MCP-validatie: D6 op de statusdag, datumloze invoer bij een expliciet statusmoment, weigeren van
een latere letterlijke tijd, nachtdiensten, afgeleide voltooiing en de deadline in opgeslagen datums.
De browserroute in task-dialog-save.spec.ts typt het werkelijke einde in de dialoog.

De minutenmodelmeting bewaart de statusdatum zoals ingevoerd; de solver leest een datum zonder
tijd zelf als begin van de statuswerkdag. In run 2 telt een kalendertijdvertraging 24 uur per dag.
Na de F1-fixes zijn alleen verdwenen afwijkingen uit minute-model-runs.json verwijderd:
run 1 van 57 naar 12, run 2 van 30 naar 11. Die oude lijsten waren al achterhaald door PR #402.
De echte nulmeting op 12abaabf2 gaf 34 en 21 afwijkende cases; F1b geeft er 12 en 11.
Er zijn geen nieuwe afwijkingen toegestaan.
De lege sleutel hours-blokgrenzen ontbrak nog na PR #402 en staat nu in beide runs.
