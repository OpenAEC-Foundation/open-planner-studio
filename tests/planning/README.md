# Planning-CPM-regressietests

Datagestuurde tests voor de **correctheid van de planningsberekening** (kritiek pad, relatietypes,
mijlpalen, kalender). Ze draaien tegen de **échte** store + rekenmotor (`src/state/appStore` →
`runCPM` → `CPMSolver`/`CalendarEngine`), headless, dus precies de code die ook in de desktop-app draait.

## Draaien

```bash
bash tests/planning/run.sh            # alle batterijen
bash tests/planning/run.sh cases-relations.json
```

Exit 0 = alles groen, exit 1 = afwijking (toont per geval het verschil verwacht↔actueel).
`run.sh` bundelt `harness.ts` met esbuild (komt met Vite mee) en draait het op Node — geen extra deps.

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

| Bestand | Dekt |
|---|---|
| `cases-calibration.json` | basisconventies (ijking) |
| `cases-probes.json` | minimale gevallen per (voorheen) bug — regressiebewaking |
| `cases-relations.json` | FS/SS/FF/SF + lag/lead, meerdere voorgangers, ladder (SS+FF) |
| `cases-float.json` | totale vs. vrije speling, kritiek pad, diamanten/ladders |
| `cases-milestones.json` | mijlpalen (duur 0): start/eind/tussen/fork/join |
| `cases-calendar.json` | weekenden, feestdagen, afwijkende werkweek |
| `cases-edge.json` | cyclus, leeg, lange keten, WBS-/fase-oprol |
| `cases-lag-advanced.json` | lag-eenheid (werkdagen vs. kalenderdagen/elapsed) + procent-lag (fase 2.1) |
| `cases-driving.json` | driving/non-driving relaties + afgekapte leads (fase 2.1) |
| `cases-constraints.json` | datum-constraints, deadlines, negatieve float (fase 2.3) |
| `cases-resource-load.json` | resources/toewijzingen/curves/kalenders/availabilitySteps → `resourceLoadResult` (belasting/capaciteit/overallocatie, fase 2.5) |
| `cases-move-project.json` | "Project verplaatsen" (pakket D1): verschuiving vooruit/terug, shift-dan-snap, kalender die NIET meeschuift (jaargrens/bouwvak), constraints/deadlines/harde pins/externe ankers/actuals die wél meeschuiven, uur-modus, undo, Δ=0-no-op |

De losse check-batterijen (geen JSON-cases, eigen scripts die `run.sh` bij een volledige run meestart)
staan bovenin `run.sh`. Nieuw in pakket D1: `check-move-project.ts` — de veld-voor-veld shift-verdicten
uit de veld-inventarisatie, de feestdagendekking (R7), de preview-zuiverheid en de Δ=0/ongeldige-datum-
guards; alles wat de JSON-batterij niet kan zien omdat het niet via de solver loopt.

## Een geval toevoegen

Voeg een object toe aan de `cases`-array van het passende bestand (schema in `BRIEF.md`). Geef alléén de
velden die je wilt asserten. Reken de verwachte waarden met de hand na uit de CPM-theorie — niet uit de
solver — en draai `run.sh`.

## Achtergrond

De aanleiding en de oorspronkelijke bevindingen staan in
[`docs/planning-test-bevindingen.md`](../../docs/planning-test-bevindingen.md).
