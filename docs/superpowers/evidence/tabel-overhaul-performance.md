# Tabel-overhaul — performancebewijs

**Datum:** 2026-08-26
**Branch:** `codex/tabel-overhaul`
**Basiscommit tijdens de meting:** `9b23b9730e200ee4d5bb08643ca96716c1115e7b`
**Machine:** Linux x64, Node v24.15.0, Intel Core i7-1260P, 16 logische CPU's

## Wat werkelijk wordt gemeten

`tests/planning/taskGridPerformanceHarness.ts` bouwt één deterministische fixture die zowel de
blokkerende planningcheck als `scripts/bench-task-grid.mjs` gebruikt:

- 50.000 zichtbare taakrijen;
- 24 zichtbare kolommen;
- 100.000 interne relaties, in twee vaste relatiegolven zonder self-links;
- rijhoogte 28 px, viewport 900 px en overscan 8;
- 1.000 navigatiecommando's en 1.000 enkelvoudige selectiecommando's per meetrun.

Iedere tijdmeting krijgt twee warmups. Het gerapporteerde getal is de mediaan van negen runs. De
generator- en rij-indexbouw vallen buiten de gemeten tijd; relation-index, navigatie, selectie en
`computeVirtualWindow` zijn de echte productie-implementaties.

De harde poorten zijn:

| Onderdeel | Poort |
|---|---:|
| Gemounte rijen | `<= ceil(900 / 28) + 16` = 49 |
| Gemounte datacellen | `<= gemounte rijen × 24` = 1.176 |
| Relation-index | mediaan `<= 500 ms` |
| 1.000 navigatiecommando's | mediaan `<= 100 ms` |
| 1.000 selectiecommando's | mediaan `<= 100 ms` |
| Virtual-windowberekening | mediaan `<= 5 ms` |

## Drie onafhankelijke blokkerende runs

De check is eenmaal gebundeld en daarna driemaal als nieuw Node-proces gestart met
`OPS_RELAX_PERF=0`. Alle drie processen eindigden met exitcode 0 en `23/23` groene checks. De twee
extra checks tellen de werkelijk door `DataGridCore` gerenderde servermarkup, niet een afgeleid
celgetal.

| Run | Relation-index | Navigatie | Selectie | Virtual window | Exit |
|---:|---:|---:|---:|---:|---:|
| 1 | 266,11 ms | 0,18 ms | 0,33 ms | 0,009 ms | 0 |
| 2 | 250,02 ms | 0,17 ms | 0,26 ms | 0,008 ms | 0 |
| 3 | 238,50 ms | 0,25 ms | 0,33 ms | 0,009 ms | 0 |

Alle runs monteerden werkelijk én berekend 49 rijen en 1.176 datacellen. De langzaamste
relation-indexrun houdt 233,89 ms, ongeveer 47%, marge tot de blokkerende grens.

## Onderzoek van de eerste uitschieter

De allereerste strenge run na het schrijven van het harnas eindigde rood op alleen de
relation-indexgrens. Die vroege versie drukte bij een fout de mediaan nog niet af, zodat van die run
geen verantwoord exact getal kan worden vermeld. Eerst is daarom de diagnose-uitvoer gerepareerd;
aan `buildTaskRelationIndex` is niets gewijzigd.

Daarna volgden, zonder productcodewijziging, een strenge run van 307,06 ms, een alleen-meten-run van
320,13 ms, meerdere JSON- en ontwikkelruns en uiteindelijk de drie formele runs hierboven. Geen van
die herhalingen overschreed 500 ms. De eerste fout is daarmee niet reproduceerbaar en past bij
tijdelijke hostbelasting; de grens is niet verruimd en de relation-index is niet op basis van één
koude uitschieter herschreven.

## JSON-benchmark en vergelijking

Commando's op dezelfde machine:

```text
node scripts/bench-task-grid.mjs --out /tmp/task-grid-benchmark-before.json
node scripts/bench-task-grid.mjs --out /tmp/task-grid-benchmark-final.json --compare /tmp/task-grid-benchmark-before.json
```

Beide eindigden met exitcode 0. Er was in Task 22B geen productcode-optimalisatie nodig; “voor” is de
eerste geldige harnasmeting en “na” de finale harnas-/scriptversie. De vergelijking bewaakt dus hier
vooral meetstabiliteit op exact dezelfde productimplementatie.

| Onderdeel | Eerste meting | Finale meting | Verschil | >25% regressie |
|---|---:|---:|---:|---:|
| Relation-index | 415,606 ms | 386,786 ms | -6,934% | nee |
| Navigatie | 0,313 ms | 0,284 ms | -9,265% | nee |
| Selectie | 0,500 ms | 0,481 ms | -3,800% | nee |
| Virtual window | 0,015 ms | 0,014 ms | -6,667% | nee |

De blijvende JSON-velden omvatten schema-versie, tijdstip, Node, platform, architectuur, CPU-model,
logische CPU-count, buildhash, alle fixtureaantallen, protocol, budgetten, medianen, DOM-budgetten en
de vergelijking.

De rode vergelijkroute is apart bewezen met een kunstmatig veel snellere baseline. Het script
markeerde alle verschillen boven 25% als regressie en eindigde met exitcode 2. De tijdelijke JSON-
bestanden staan alleen onder `/tmp` en worden niet gecommit.

## CI- en relaxcontract

- Een directe run met `OPS_RELAX_PERF=1` print de fixtureaantallen en medianen en slaat alleen de
  tijdpoorten over; structuur-, tel- en geldigheidschecks blijven actief.
- `tests/planning/run.sh` zet voor de geregistreerde check altijd expliciet `OPS_RELAX_PERF=0`.
  Een geërfde shellvariabele kan de normale CI-poort dus niet stil uitschakelen.
- De zware check wordt na zijn ene normale uitvoering uit de tijdzonematrix gehaald. De gemeten
  functies zijn tijdzone-onafhankelijk; vijf extra kopieën zouden alleen looptijd en meetruis geven.

## Overige verificatie

- `npm run typecheck` — exitcode 0 na de finale harnaswijzigingen.
- De definitieve checkprocessen leveren na hun eindregel expliciet exitcode 0; de React-serverimport
  kan het Node-proces niet onbedoeld actief laten staan.
- Finale JSON-schema-smoke — exitcode 0; alle zes budgetvlaggen waar, inclusief gemounte rijen en
  datacellen, en negen ruwe samples per tijdmeting aanwezig. Deze extra hostmomentopname vervangt de
  drie formele runs hierboven niet.
- `git diff --check` — exitcode 0 vóór het schrijven van dit bewijsdocument.
- Het benchmarkwerk raakt geen resourceweergave of resourcecode.
