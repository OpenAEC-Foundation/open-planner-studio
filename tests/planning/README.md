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

Fixtures die door MEER DAN ÉÉN suite gebruikt worden staan in `tests/fixtures/` — nu alleen
`recordedDatesIfc.ts`, de IFC van issue #63 (twee taken, één FS-relatie, opgeslagen datums die niet
uit de logica volgen), gedeeld door `check-recorded-dates.ts` en `tests/mcp/cases-recorded-dates.ts`.
Eén bron, zodat de twee batterijen niet uit elkaar lopen over wat het geval precies ís. Fixtures die
maar één batterij dient horen gewoon in die batterij thuis.

## Een geval toevoegen

Voeg een object toe aan de `cases`-array van het passende bestand (schema in `BRIEF.md`). Geef alléén de
velden die je wilt asserten. Reken de verwachte waarden met de hand na uit de CPM-theorie — niet uit de
solver — en draai `run.sh`.

## Achtergrond

De aanleiding en de oorspronkelijke bevindingen staan in
[`docs/planning-test-bevindingen.md`](../../docs/planning-test-bevindingen.md).
