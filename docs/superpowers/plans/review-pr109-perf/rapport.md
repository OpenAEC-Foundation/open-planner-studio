# Prestatiemeting rehab-2.xer — waarom de app vastloopt

De app is met rehab-2 traag door twee fouten in de code, niet door het bestand zelf. Fout 1: als u een taak kiest, rekent het eigenschappenpaneel een lijst "verplaats naar…" uit die bij elke klik en elke wijziging 45 tot 115 seconden kost. Fout 2: de Gantt tekent gestippelde relatiepijlen zo duur dat elke scrollstap ongeveer 1 seconde vastloopt; het XER-archief in de auto-save is maar een klein deel van het probleem.

Gemeten door Claude Opus 5.5 (`uitvoerder-opus-midden`), 2026-10-07, op `origin/main` 822135735, eigen dev-server (poort 3044, nu gestopt), Playwright Chromium headless, viewport 1600×1000, locale nl-NL.
Scripts: `/tmp/ops-perf-rehab2/measure.mjs` (route), `analyze.mjs` (CPU-profiel), `probe*.mjs` (ablaties), `trace-an.mjs` (trace).
Ruwe data: `/tmp/ops-perf-rehab2/out/<label>/` (`phases.json`, `<fase>.cpuprofile`, `<fase>.png`).

## Meetopzet

- Route zoals de browsertests: verse context, welkomstdialoog weg, `newProject()`, dan de ribbonknop **Openen** → echte `filechooser` → `setFiles` (zoals `tests/browser/recorded-dates.spec.ts`).
- Fasen: 1 openen (tot 2 s zonder nieuwe long task) · 2 tabel: 40 wielstappen op het raster naast de Gantt · 3 Gantt: 20× verticaal, 20× horizontaal, 20× Ctrl+wiel · 4 klik op een naamcel (rij 6) · 5 naam wijzigen (Enter, typen, Enter) · 6 F5 · 7 30 s stil.
- Per fase: wandkloktijd, Long Tasks (`PerformanceObserver('longtask')`), CPU-profiel (CDP `Profiler`, sample 0,5 ms), heap.
- Ablaties in `probe3/5/6.mjs`: paneel uit, canvas verborgen, `setLineDash` als no-op, Latijnse namen, `writeIFC` met/zonder archief.
- Simulatie "na fix 1+2" (`--no-panel --no-dash`): eigenschappenpaneel dicht en `setLineDash` no-op. Dit benadert de winst; het is geen echte fix.

Beperkingen:
- Dev-build (React dev, onverkleind). Dat is waarschijnlijk ook wat de eigenaar op 3042 zag. De twee hoofdoorzaken zijn algoritmisch; in een productiebuild blijven ze naar verwachting even groot [VERMOED, niet gemeten].
- Headless Chromium rastert canvas in software. Met GPU-raster kan oorzaak 2 kleiner zijn [VERMOED]. De eigenaar meldt wel dezelfde lag.
- In fase 1 zit 2,1 s Playwright-overhead (`setInputFiles`, base64 naar File; profielframe `(anon):7476` onder `setInputFiles`). Een echte bestandskiezer heeft die overhead niet. Ik heb hem in de analyse afgetrokken, maar niet in de tabel.

## Tabel per fase

Kolommen: totale tijd (wandklok) · langste blokkade (langste long task) · aantal long tasks > 200 ms.

| Fase | rehab-2 (6.978 taken, 10.730 rel., 52.640 toewijzingen) | Hotel_Construction_TEC (4.236 taken, 7.586 rel., 2.278 toewijzingen) | rehab-2, gesimuleerd na fix 1+2 |
|---|---|---|---|
| 1 openen | 27,2 s · 17,8 s · 4 | 6,0 s · 2,8 s · 2 | 18,5 s · 11,9 s · 2 |
| 2 tabel scrollen (40 stappen) | 94,3 s · 2,4 s · 80 | 5,1 s · 0,11 s · 0 | 6,2 s · 0,15 s · 0 |
| 3 Gantt scroll/zoom (60 stappen) | 44,2 s · 2,4 s · 50 | 6,4 s · 0,14 s · 0 | 7,3 s · 0,17 s · 0 |
| 4 taak selecteren | 49,7 s · **47,2 s** · 3 | 1,5 s · 0,30 s · 1 | 1,4 s · 0,22 s · 1 |
| 5 veld wijzigen (naam) | 110,3 s · **104,8 s** · 7 | 1,7 s · 0,35 s · 1 | 7,2 s · 3,4 s · 3 |
| 6 F5 | 122,3 s · **117,4 s** · 5 | 4,1 s · 1,9 s · 1 | 11,4 s · 6,1 s · 3 |
| 7 30 s stil | 30,2 s · 0 · 0 | 30,2 s · 0,53 s · 2 | 30,2 s · 0 · 0 |

Fase 7: de auto-save draait alleen na een store-wijziging (`useAutoSave.ts`, subscribe → throttle). Bij rehab-2 viel de tick al in fase 5/6, want die duurden langer dan 10 s. Stilzitten zonder wijziging kost niets.

### Top-5 functies per fase (CPU-profiel, eigen tijd; `(program)`/GC apart)

rehab-2:
- **1 openen** (24,4 s bezet, waarvan 2,1 s Playwright): `xerSourceArchive.ts:validateSourceRow` 2,1 s · `xerSourceArchive.ts:processBlock` (sha256) 2,1 s · `xerTables.ts:parseXerNumber` 0,8 s · `xerTables.ts:decodeTextCell` 0,8 s · `xerTables.ts:escapeRegExp` 0,7 s. `(program)` 4,1 s.
- **2 tabel scrollen** (92,9 s bezet): `(program)` **88,1 s** (native: canvas-raster, zie oorzaak 2) · `react jsxDEV` 1,7 s · `DataGridCore.tsx:synchronizeDataGridScrollPosition` 0,16 s · `dateUtils.ts:parseInstant` 0,15 s · `GanttRenderer.ts:drawDependencyArrows` 0,06 s.
- **3 Gantt scroll/zoom** (40,6 s bezet): `(program)` **38,3 s** · `jsxDEV` 1,0 s · `parseInstant` 0,05 s · `createElement` 0,03 s · `drawDependencyArrows` 0,02 s.
- **4 selecteren** (48,7 s bezet): `TaskAssignmentsSection.tsx` filter-callback in `moveCandidates` **46,2 s (94,7 %)** · `jsxDEV` 0,2 s · `getBoundingClientRect` 0,1 s · `moveCandidates` 0,04 s · `createElement` 0,03 s.
- **5 veld wijzigen** (109,2 s bezet): `moveCandidates`-callback **102,3 s (93,6 %)** · `ifcWriter.ts:addLine` 0,4 s · `ifcWriter.ts:issueGuid` 0,3 s · `jsxDEV` 0,2 s · `ResourceLoad.ts:computeResourceLoad` 0,2 s.
- **6 F5** (120,2 s bezet): `moveCandidates`-callback **112,9 s (94,0 %)** · Immer `shallowCopy` 0,4 s · Immer `isDraftable` 0,3 s · `ifcWriter.ts:addLine` 0,3 s · `ifcWriter.ts:issueGuid` 0,3 s.
- **7 stil**: niets van betekenis (0,35 s bezet).

Hotel:
- **1 openen** (3,7 s bezet): Playwright 0,44 s · `processBlock` 0,23 s · `CalendarEngine.ts:bandsStartingOn` 0,15 s · `decodeTextCell` 0,13 s · `jsxDEV` 0,11 s.
- **2/3/4/5**: `jsxDEV` voert aan (0,15–0,96 s), daarna `synchronizeDataGridScrollPosition`, `drawDependencyArrows`. Er is geen dominante app-functie.
- **6 F5** (2,0 s bezet): Immer `isDraftable` 0,23 s · `bandsStartingOn` 0,20 s · `CPMSolver.ts:forwardPass` 0,08 s · `scheduleAnalysis.ts:computeScheduleResults` 0,06 s · Immer `has` 0,06 s.
- **7 stil** (1,0 s bezet, auto-save-tick): `ifcWriter.ts:addLine` 0,12 s · `issueGuid` 0,11 s · IndexedDB `put` 0,10 s · `recoveryStore.ts` `getAll`-onsuccess 0,09 s · `writeIFC` 0,05 s.

## Oorzaken, gerangschikt naar winst

Totaal bezette hoofdthread op de rehab-2-route (fase 1–6, zonder Playwright-overhead): ±434 s.

### 1. `moveCandidates` in het eigenschappenpaneel: ±261 s, ±60 % — BEWEZEN

- Bron: `src/components/task-sections/TaskAssignmentsSection.tsx:130-133`, aangeroepen op regel 166 **per toewijzingsrij bij elke render**:
  `tasks.filter(t => … && isLeafTask(t) && !assignments.some(a => a.taskId === t.id && a.resourceId === resourceId))`.
  Kosten per render: (toewijzingen van de taak) × 6.978 taken × tot 52.640 toewijzingen.
- Bewijs: in de profielen van fase 4, 5 en 6 komt 94 % van de tijd uit precies deze callback (46,2 + 102,3 + 112,9 s). Fase 5 en 6 renderen het paneel opnieuw omdat de geselecteerde taak/store verandert.
- Waarom niet bij Hotel: Hotel heeft 2.278 toewijzingen tegen 52.640 bij rehab-2 (23×). De kosten stijgen ongeveer kwadratisch.
- Het eigenschappenpaneel staat standaard open (`showPropertiesPanel: true` in een verse context). Elke gebruiker loopt hier dus tegenaan.
- Voorstel: bereken de kandidaten pas als het menu "verplaats naar…" opengaat (lazy), en gebruik één `Map<resourceId, Set<taskId>>` (O(toewijzingen) één keer, daarna O(taken)). Haal ook `assignments.filter(a => a.taskId === taskId)` (r. 91) uit een index.
- Geschatte winst: selecteren 48,7 → ±0,3 s; wijzigen −102 s; F5 −113 s. Simulatie met paneel dicht gaf: selecteren 0,22 s, wijzigen 7,2 s, F5 11,4 s. Wat het paneel zelf zonder `moveCandidates` kost, heb ik niet apart gemeten [VERMOED: klein].

### 2. Gestippelde relatiepijlen in de Gantt-canvas: ±126 s, ±29 % — BEWEZEN (mechanisme VERMOED)

- Bron: `src/engine/renderer/GanttRenderer.ts:2102`: `ctx.setLineDash(outsideTrace ? [1, 4] : isDriving ? [] : [4, 3])`. Elke niet-drijvende relatie wordt gestippeld. In "datums zoals opgeslagen" is er geen `drivingSequenceIds`, maar ook na F5 blijft het even traag. De oorzaak zit dus in alle niet-drijvende relaties, niet alleen in de modus.
- Bewijs:
  - CPU-profiel fase 2/3: `(program)` 88,1 s + 38,3 s; JS zelf < 3 s.
  - Trace (`out/rehab2-p4/scroll-trace2.json`): per frame `Commit` → `LayerTreeHost::DoUpdateLayers` → `Canvas2DResourceProviderSharedImage::ProduceCanvasResource` 0,8–1,8 s. Dat is het rasteren van de opgenomen canvas-opdrachten.
  - Ablatie (3 scrollstappen): basis 4.274 ms long tasks → `setLineDash` no-op **305 ms (−93 %)** → weer aan 2.995 ms. Paneel dicht: 4.703 ms (geen effect). Latijnse namen: 3.750 ms (geen wezenlijk effect, Arabisch is dus niet de oorzaak). Canvas verborgen: 2.361 ms.
  - Per frame ±950 `setLineDash`-, ±1.000 `stroke`- en ±6.000 `lineTo`-aanroepen.
- [VERMOED] Mechanisme: pijlen tussen ver uit elkaar liggende rijen hebben verticale segmenten van tienduizenden pixels buiten beeld (raster 195.000 px hoog). Skia streept het hele pad, ook het deel buiten de canvas. De cull op r. ~2090 houdt pijlen die het beeld kruisen terecht, maar knipt hun coördinaten niet bij.
- Voorstel: knip elk routesegment af op de canvasrechthoek (± marge) vóór `stroke()`. Het streeppatroon blijft dan alleen in beeld, met behoud van fase via `lineDashOffset` = afgeknipte lengte. Een alternatief is een zichtbaar segment > N px doorgetrokken met lage alpha, maar dat verandert de P6-conventie. Dat vraagt een besluit.
- Geschatte winst: per scroll-/zoomstap ±1 s → < 0,15 s. Op deze route 126 s → ±6 s (simulatie: fase 2+3 samen 6,2 s long tasks).

### 3. Openen: ±22 s, ±5 % — BEWEZEN

Inclusieve tijd (`out/rehab2/1-openen.cpuprofile`):
- `xerReader.ts:readXER` 12,2 s:
  - Archief bouwen (`xerSourceArchive.ts:buildXerSourceArchive`) **6,4 s**: `sha256Hex` in pure JS 2,3 s; regelvalidatie `validateSourceRow` 2,2 s; `validateXerArchiveDiagnosticsV1`/`validateDocumentView`/`validateTaskResourceSource` 1,5 s; `validateXerArchiveReadModelV1` 1,2 s; `bytesToBase64` 0,6 s.
  - `readXerProject` 3,4 s.
  - `parseXerTables` 1,5 s.
- `xerMultiProject.ts:assembleXerMultiProjectImport` 4,0 s, waarvan `xerResourceAssignments.ts:readXerResourceAssignments` 2,5 s. Daarin zit `parseXerNumber` 1,7 s: die functie bouwt **per getal** een nieuwe `RegExp` (`xerTables.ts:491-494`, met `escapeRegExp`).
- `fileSlice.ts:applyLoadedProject` 4,2 s: `solveProject` 2,3 s, `materializeLibraryBoundary` 1,1 s, `computeReliableResourceLoad` 1,1 s.
- Het toepassen van recorded dates (`applyRecordedDatesOnLoad`) kost maar 43 ms. Dat is géén oorzaak.

Voorstellen met geschatte winst:
- Regex per `XerNumberFormat` cachen: ±1,3 s.
- `sha256` via `crypto.subtle.digest` (native, async): ±2 s.
- Archiefvalidatie die alleen dubbel werk doet, één keer doen [VERMOED: deels dubbel, niet uitgezocht]: tot ±2 s.
- Parse + archief in een Web Worker: de UI bevriest dan niet, maar de doorlooptijd blijft gelijk.
- Samen ±5 s winst, en zonder de freeze als de worker-route wordt gekozen.

### 4. Auto-save na een wijziging: 2–3,4 s per tick, hiervan archief 0,5–1,5 s — BEWEZEN

- Gemeten:
  - In de route `writeIFC` 1,2–3,1 s per tick (`useAutoSave.ts` → `recoveryDelta.ts:prepare` → `ifcWriter.ts:writeIFC`), plus `recoveryStore.ts` 0,3–0,85 s.
  - Los gemeten (`probe6`, 4 rondes wisselend): met archief `writeIFC` 2,2–3,6 s (IFC 60,5 MB) + `saveRecovery` 0,5–0,7 s. Zonder archief 1,7–2,6 s (35,7 MB) + 0,3–0,6 s.
  - Het archief is dus ±0,5–1,5 s van ±3 s per tick (±20–40 %, veel ruis).
  - `writeXerSourceArchive` zelf kost maar 14–25 ms in het profiel (de chunks zijn al base64). De extra kosten zitten in de grotere string en in de IndexedDB-klonen.
- Bijvangst: `saveWeb` doet `store.getAll()` (`src/services/recovery/recoveryStore.ts:820`, ook r. 922). Dat leest bij elke tick **alle** records, inclusief de vorige IFC-strings van 60 MB, alleen om bestaande doc-id's te kennen. Voorstel: `getAllKeys()` of een sleutel-cursor. Geschatte winst ±0,3–0,8 s per tick.
- Aandeel op deze route: < 1 % (twee ticks). Het archief verklaart dus niet de freeze die de eigenaar zag. De archieffix (branch `claude/xer-archief-eenmalig`) is **nog niet gepusht**: `git ls-remote` vindt alleen `claude/xer-archief-fallback`, en die heb ik niet gemeten. De fix scheelt naar schatting 0,5–1,5 s per tick.

### 5. Rest na fix 1+2 (simulatie): F5 ±8,4 s, wijzigen ±5,8 s — BEWEZEN

- F5 (`scheduleSlice.ts:runCPM` 5,7 s): `solveProject` 2,5 s · `computeReliableResourceLoad` 1,5 s · Immer-snapshot `storeRuntime.ts:snapshotOfCurrentState` → `immerDraft.ts:currentAppState` **1,3 s** (undo-snapshot van de hele state) · `computeScheduleResults` 0,55 s. Daarna een auto-save-tick van 2,1 s.
- Naam wijzigen (1,2 s commit + 3,4 s auto-save): `gridTransaction.ts:1031` rekent `computeReliableResourceLoad` **onvoorwaardelijk** opnieuw uit, ook bij een naamwijziging (0,75 s). Voorstel: alleen herrekenen als tijd, toewijzing of kalender verandert. Winst ±0,75 s per bewerking.
- Undo-geschiedenis: alleen zichtbaar als die snapshot van 1,3 s bij F5. Er is geen groei gezien (1 historie-event na de wijziging).

## Oorzaken die het NIET zijn (gemeten)

- Tabelvirtualisatie werkt: 31 gerenderde rijen, 640 DOM-nodes.
- Arabische tekst/RTL: Latijnse namen geven geen wezenlijk verschil.
- Recorded dates toepassen: 43 ms.
- Niet-werktijdarcering (`drawGridBackground`): loopt alleen over zichtbare dagen. In de call-telling domineren `lineTo`/`stroke`/`setLineDash` van de pijlen. Niet apart geablateerd [VERMOED: klein].
- Stilzitten: de auto-save tikt niet zonder wijziging.

## Kort

1. `moveCandidates` in `TaskAssignmentsSection.tsx:130` is ±60 % (±261 s op de route; 47 s per selectie, 100+ s per wijziging/F5).
2. Gestippelde relatiepijlen (`GanttRenderer.ts:2102`) die de canvas-raster ±1 s per frame laten kosten zijn ±29 % (±126 s; −93 % met `setLineDash` uit).
3. Openen is ±5 % (±22 s; archief bouwen 6,4 s, regex per getal 1,7 s, solve 2,3 s).

De auto-save met archief is < 1 % van deze route (archief ±0,5–1,5 s per tick na een wijziging).
