# Prestaties op grote planningen — rehab-2.xer (2026-10-07)

Met rehab-2.xer (6.978 taken, 10.730 relaties, 52.640 toewijzingen) was de app onbruikbaar: een taak
kiezen kostte 47 s, een veld wijzigen 105 s en elke scrollstap in de Gantt ongeveer 1 s. Na vier fixes
duurt een selectie 0,2 s, een wijziging 0,3 s en een scrollstap minder dan 0,15 s. Het openen kost
nog ±10 s, waarvan het meeste in het XER-bronarchief zit (dat is een andere baan).

Uitgevoerd door Claude Opus 5.5 (`uitvoerder-opus-midden`) op branch `claude/perf-grote-planningen`
(basis `origin/main` 822135735). Oorzakenonderzoek: `/tmp/ops-perf-rehab2/rapport.md` (kopie in
`review-pr109/docs/superpowers/plans/review-pr109-perf/`).

## Meetopzet

Dezelfde route als het oorzakenrapport: `measure.mjs` in de map
`2026-10-07-perf-grote-planningen/` naast dit document. Eigen dev-server (poort 3047), Playwright
Chromium headless, 1600×1000, nl-NL, CPU-profiel aan (sample 0,5 ms). Openen via de echte
bestandskiezer, daarna fasen 2–7. Nieuw is fase 8: Gantt scrollen/zoomen **na F5**. Fase 3 draait
namelijk in "Datums zoals opgeslagen"; fase 8 meet de berekende stand, met gestreepte niet-driving
relaties. `sub.mjs` telt de tijd onder één functie in een `.cpuprofile`.

Kolommen: totale tijd · langste blokkade (langste long task) · aantal long tasks > 200 ms.
"Vóór" komt uit het oorzakenrapport (zelfde machine, zelfde route, `origin/main` 822135735).

### rehab-2.xer

| Fase | Vóór | Na |
|---|---|---|
| 1 openen | 27,2 s · 17,8 s · 4 | 9,8 s · 5,6 s · 2 |
| 2 tabel scrollen (40 stappen) | 94,3 s · 2,4 s · 80 | 4,0 s · 0,08 s · 0 |
| 3 Gantt scroll/zoom (60 stappen, opgeslagen datums) | 44,2 s · 2,4 s · 50 | 5,7 s · 0,11 s · 0 |
| 4 taak selecteren | 49,7 s · 47,2 s · 3 | 1,3 s · 0,19 s · 0 |
| 5 veld wijzigen (naam) | 110,3 s · 104,8 s · 7 | 1,5 s · 0,32 s · 1 |
| 6 F5 | 122,3 s · 117,4 s · 5 | 5,4 s · 2,7 s · 3 |
| 8 Gantt scroll/zoom na F5 (nieuw) | niet gemeten | 5,3 s · 0,13 s · 0 |
| 7 30 s stil | 30,2 s · 0 · 0 | 30,2 s · 0 · 0 |

Controle voor fix 2 (knippen): dezelfde route met alleen de knipcommit teruggedraaid. Fase 8 gaf
toen 23,2 s · 0,74 s · 42. Knippen brengt een scrollstap in de berekende stand dus van ±0,5–0,7 s
naar < 0,15 s. In fase 2/3 zit die winst niet: daar zorgt N4 (opgeslagen datums worden doorgetrokken
getekend) al voor.

### Hotel_Construction_TEC.xer (4.236 taken, 7.586 relaties, 2.278 toewijzingen)

| Fase | Vóór | Na |
|---|---|---|
| 1 openen | 6,0 s · 2,8 s · 2 | 4,1 s · 1,5 s · 2 |
| 2 tabel scrollen | 5,1 s · 0,11 s · 0 | 3,8 s · 0,07 s · 0 |
| 3 Gantt scroll/zoom | 6,4 s · 0,14 s · 0 | 5,3 s · 0,11 s · 0 |
| 4 taak selecteren | 1,5 s · 0,30 s · 1 | 1,3 s · 0,15 s · 0 |
| 5 veld wijzigen | 1,7 s · 0,35 s · 1 | 1,5 s · 0,23 s · 1 |
| 6 F5 | 4,1 s · 1,9 s · 1 | 3,9 s · 1,2 s · 2 |
| 8 Gantt na F5 (nieuw) | niet gemeten | 4,7 s · 0,11 s · 0 |
| 7 30 s stil | 30,2 s · 0,53 s · 2 | 30,2 s · 0 · 0 |

Fase 7 heeft na de fix geen auto-save-tick meer, omdat die nu al in fase 5/6/8 valt.

## Winst per fix

| # | Oorzaak | Fix | Gemeten effect (rehab-2) |
|---|---|---|---|
| 1 | `moveCandidates` per render: rijen × taken × toewijzingen | index resource → taken (`moveCandidates.ts`), `has` met vroege uitstap, lijst pas bij openen (`MoveToSelect`) | selecteren 47,2 → 0,19 s; wijzigen 104,8 → 0,32 s; F5 117 → 2,7 s |
| 2a | N4: opgeslagen datums streepten alle relaties | `CPMResult.drivingUnknown` + `knownDrivingSequenceIds` ⇒ doorgetrokken | fase 2: 94,3 → 4,0 s; fase 3: 44,2 → 5,7 s |
| 2b | streeppatroon over de volle offscreen-lengte | pijlsegmenten knippen op canvas + 16 px, streepfase via `lineDashOffset` | fase 8: 23,2 → 5,3 s; langste stap 0,74 → 0,13 s |
| 3 | `parseXerNumber`: nieuwe RegExp per getal | patroon per notatie gecachet; `decodeTextCell` sneller pad | multi-project combineren 4,0 → 0,9 s (profiel) |
| 4 | rasterbewerking rekent altijd de belasting | hergebruik bij alleen neutrale taakvelden (`resourceLoadReuse.ts`) | naamwijziging: geen `computeResourceLoad` meer (was 0,75 s) |
| 5 | multi-project 4,0 s / toepassen na laden 4,2 s | zie hieronder | — |

### Punt 5: geen extra goedkope winst

- **Multi-project combineren** (`assembleXerMultiProjectImport`): van de 4,0 s was 1,5 s
  `parseXerNumber` + `escapeRegExp`. Die zijn weg door fix 3; nu 0,9 s. Wat overblijft:
  `structuredClone` van het documentproject (0,1–0,5 s; bewust, zie `cloneMappedProject`) en het
  lezen van 52.640 TASKRSRC-rijen (±0,1–0,45 s). Daar zit geen goedkope winst meer in.
- **Project toepassen na laden** (`applyLoadedProject`): de solve (±0,6–2,3 s), één
  belastingberekening (±0,4–1,1 s) en de Immer-`setState` (±0,25–0,5 s). Alle drie zijn nodig en
  draaien maar één keer. Geen goedkope winst; een echte winst vraagt sneller rekenen in
  `computeResourceLoad` (`taskWorkDayIsos`, datumstrings) of de solve. Dat is apart werk.

## Tests en mutanten

Nieuwe checks (allemaal eerst rood tegen de oude code):

- `tests/planning/check-move-candidates-scale.ts`: gelijk aan de oude regel; leesbudget ≤ 2 ×
  toewijzingen (proxy, breekt af); vroege uitstap; tijdsbudget op ±7.000 taken / ±53.000 toewijzingen.
  Rood: 77 s voor `has` op negen rijen.
- `tests/browser/move-assignment-lazy.spec.ts`: dicht één optie, met de muis open ⇒ kandidaten,
  keuze verplaatst; zonder kandidaat geen keuzelijst.
- `tests/planning/check-gantt-render-options.ts` 28b–28d: opgeslagen datums ⇒ `drivingSequenceIds`
  undefined; berekend en niets driving blijft `[]`.
- `tests/planning/check-gantt-arrow-clip.ts`: op ±7.000 taken / 10.000 relaties geen getekend punt
  ver buiten de canvas en begrensde lengte. Vóór: 4,6 miljoen px over 61 strokes. Verder: streepfase
  gelijk aan het ongeknipte pad, en `lineDashOffset` daarna weer 0.
- `tests/planning/check-xer-number-pattern-cache.ts`: gedrag per notatie; ≤ 3 RegExp-objecten voor
  30.000 getallen. Vóór: 30.000.
- `tests/planning/check-grid-resource-load-reuse.ts`: de neutrale lijst is exact gepind. Een
  proxy bewijst dat de motor geen neutraal veld leest. Verder: de beslisregel per veld, en via de
  store: naam ⇒ zelfde object, duur ⇒ nieuw resultaat gelijk aan een verse berekening.
- Gedeelde fixture: `tests/planning/largeScheduleFixture.ts` (benchmarkgenerator + aanvulling).

Mutanten (elk handmatig ingevoerd en teruggedraaid; alle twaalf rood):

| Mutant | Rood in |
|---|---|
| `has` zonder vroege uitstap | move-candidates 3 |
| index genegeerd in `list` | move-candidates 1 |
| `lineDashOffset` altijd 0 bij knippen | arrow-clip B |
| offset niet teruggezet | arrow-clip A |
| nooit knippen | arrow-clip A |
| `drivingUnknown` genegeerd in de lezer | render-options 28b |
| reconstructie zonder `drivingUnknown` | render-options 28b |
| geen `sameValue`-terugval | load-reuse 3k, 4b |
| toewijzingen niet vergeleken | load-reuse 3g |
| `time` als neutraal veld | load-reuse 1, 2 |
| cachesleutel zonder groepsteken | number-cache (crash op geldig getal) |
| geen cache | number-cache 2 |

## Wat overblijft

- **Openen ±10 s, waarvan 5,6 s in één blok.** `createXerSourceArchiveFromOwnedMetadata` kost
  ±2,2 s (sha256 in JS, regelvalidatie). Dat is de baan `claude/xer-archief-eenmalig`, hier niet
  aangeraakt. Verder `parseXerTables` ±0,5 s en de solve.
- **F5 ±2,7 s langste blokkade.** Daarvan is ±0,7 s Immer (`shallowCopy`/`isDraftable`, de
  undo-snapshot van de hele state) en ±0,15 s belasting. Daarna volgt een auto-save-tick.
- **Afdrukken/rapport** tekent pijlen met eigen code (`printPreview.ts`). Die knipt niet; dat is offline
  en niet per scrollstap. Hier niet gewijzigd.
- **Andere lezers van `drivingSequenceIds`.** Het taakpaneel ("bepalend"), path tracing en de MCP-tool
  lezen de lijst rechtstreeks. In de opgeslagen-modus tonen die terecht "geen driving". Alleen Gantt en
  rapport behandelen "onbekend" nu apart.
- **Paneelpatronen.** De andere paneelselectoren zijn nagelopen. Geen ander geval van taken ×
  toewijzingen per render gevonden. `ResourcePanel.assignmentCount` loopt alleen bij een klik op
  verwijderen.
