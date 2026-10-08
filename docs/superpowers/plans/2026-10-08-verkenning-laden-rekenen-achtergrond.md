# Verkenning: laadindicator en bruikbare UI tijdens openen en rekenen

De app doet openen en rekenen nu helemaal op de hoofdthread. Daardoor bevriest het scherm, en een indicator kan niet eens verschijnen. Het lezen en rekenen zelf is pure code zonder store of DOM. Die code kan naar een Web Worker, en de app heeft al zo'n worker voor nivelleren. Wat op de hoofdthread blijft, is het overzetten van het resultaat naar de store en het tekenen. Bij rehab-2 kost dat naar schatting 0,3–1,5 s per keer. "Volledig bruikbaar" lukt dus niet helemaal, maar "geen bevriezing langer dan ±0,5 s" is haalbaar als de grote XER-metadata slim wordt overgedragen.

Uitgevoerd door Claude Opus 5.5 (`uitvoerder-opus-midden`), 2026-10-08. Alleen gelezen en gemeten, geen productcode gewijzigd.
Worktree: `/home/nozzit/open-aec/open-planner-studio/.claude/worktrees/agent-verkenning-laden` op `origin/main` d233d578c. Proefmetingen ook op `origin/claude/perf-grote-planningen` + `origin/claude/xer-archief-eenmalig` samen (lokale merge zonder commit, daarna teruggezet).
Meetscripts: `/tmp/ops-verkenning-laden/src/meet.ts`, `meet2.ts`/`meet3.ts`, `incl.mjs`; uitvoer: `meet-main.log`, `meet-combo.log`, `meet2.log`, `prof/`.

## Bronnen voor de getallen

- **Browser, na #294** (dev-build, Chromium headless, CPU-profiel): `/tmp/ops-perf-fixes/out/rehab2-na/{1-openen,6-F5}.cpuprofile` en `rehab2-na.log`. Dat is de meting achter "openen ±10 s, blokkade 5,6 s; F5 blokkade 2,7 s". Ik heb die profielen zelf uitgesplitst met `/tmp/ops-perf-fixes/sub.mjs` en `/tmp/ops-verkenning-laden/incl.mjs`.
- **Node 22, headless store** (mijn eigen proefmeting, productie-defines, geen React): `meet.ts`. Machine was niet stil: twee runs verschillen ±20 %. Lees de Node-getallen als orde van grootte.
- `structuredClone` en `v8.serialize/deserialize` in Node gebruiken dezelfde V8-serializer als `postMessage` [VERMOED: in Chromium is de verdeling serialiseren/deserialiseren ongeveer gelijk; niet in de browser gemeten].

---

## 1. Openen: route per formaat

### Ingangen (main)

| Ingang | Bestand:regel | Wat er gebeurt |
|---|---|---|
| Lint/Backstage **Openen** | `Backstage.tsx:232`, `NewOrOpenProjectDialog.tsx:16` → `fileSlice.ts:685` `openFile` | `await openFileDialog` → `await parseOpenedFile` → `openAsDocument` (sync) → `await pushRecent` |
| Recente bestanden | `ribbonWidgets.tsx:465`, `Backstage.tsx:269` → `fileSlice.ts:1083` `openRecentFile` | `readFromRef`/`readBytesFromRef` → `parseOpenedFile` → `openAsDocument` |
| Voorbeelden | `fileSlice.ts:1117` `openExampleFromString` | `readIFCWithXerReconstruction` → `applyLoadedProject` |
| MCP `planner_import_schedule` | `services/mcp/tools/fileTools.ts:365` (parse), `:386` (`openAsDocument`) | zelfde naad, al `async` |
| Crashherstel bij start | `hooks/useRecoveryRestore.ts:62-78` → `documentSlice.ts:602` `restoreDocuments` | per snapshot `readIFCWithXerReconstruction` |
| Externe ankers (Tauri) | `fileSlice.ts:930` `parseExternalSource` | `readFormatInput` → `parseOpenedFile` |
| Slepen en neerzetten | **bestaat niet** | geen `onDrop`/`dataTransfer.files`/Tauri drag-drop in `src/` (grep) |

### Gedeelde stappen (alle formaten)

| # | Stap | Bestand:regel | Puur? | Waar moet het draaien |
|---|---|---|---|---|
| 1 | Bestandskiezer + lezen | web: `fileAccess/webBackend.ts:121-123` (`file.arrayBuffer()`/`file.text()`); Tauri: `tauriBackend.ts:19-22` (`plugin-fs`) | async I/O | hoofdthread, maar blokkeert niet (await). Tauri: 18,6 MB over IPC [VERMOED: kort, niet gemeten] |
| 2 | Formaat kiezen + parsen | `formatRegistry.ts:173` `parseOpenedFile` → `READ_FORMATS` `:122-146` | ja, behalve XML (zie onder) | **worker-kandidaat** |
| 3 | Unieke id's | `fileSlice.ts:449` `ensureUniqueImportIds` | ja | worker |
| 4 | Payload bouwen | `fileSlice.ts:450` `payloadFromImport`, `stripLibraryOrigins`, `refreshProjectCalendarCache` | ja (plain data) | worker |
| 5 | Kalender + **solve** | `fileSlice.ts:461` → `documentActivation.ts:226-243` `prepareLoadedPayload` → `solveProject` op een kloon | ja; muteert de invoer niet | worker |
| 6 | Datums zoals opgeslagen | `fileSlice.ts:468` `applyRecordedDatesOnLoad` | ja (op payload) | worker |
| 7 | Bibliotheekgrens + **resourcebelasting** + viewRows | `fileSlice.ts:470` → `documentActivation.ts:187-213` `materializeLibraryBoundary` (`computeReliableResourceLoad` r. 200) | ja, maar leest `companies`/`pools` (app-globale bibliotheek) | worker, met een kopie van de bibliotheek; bij toepassen controleren of die niet wijzigde |
| 8 | Store vullen | `fileSlice.ts:476-489` één `set`: `hydratePayload` (r. 481), viewRows, `resourceLoadResult` | nee | **hoofdthread** |
| 9 | Meldingen, host-events, fit | `fileSlice.ts:492-561`, `applyOpenedImport` `:565-662` | nee | hoofdthread (goedkoop) |
| 10 | React + canvas tekenen | raster gevirtualiseerd (31 rijen, zie `/tmp/ops-perf-rehab2/rapport.md`) | nee | hoofdthread |

`applyLoadedProject` is al zo gebouwd dat stap 3–7 buiten de store draaien en alleen stap 8 de store raakt (commentaar `documentActivation.ts:225`: "zonder de live store tussentijds te publiceren"). Dat is de natuurlijke knip voor een worker.

### Per formaat (stap 2)

| Formaat | Reader | Invoer | Puur / worker-geschikt | Bijzonderheid |
|---|---|---|---|---|
| XER | `formatRegistry.ts:140-146` → `xer/xerReader.ts` `readXER` (dynamische import) | bytes | ja (draait in Node zonder DOM; mijn meting) | bouwt ook het bronarchief (`xerSourceArchive.ts`), sha256 in JS. #295 zet de sha256 vooraf via `crypto.subtle` (`precomputeSha256`, cache in een `WeakMap` per bytes-object): die cache moet dan ín de worker zitten |
| IFC | `formatRegistry.ts:106-124` `readIFCWithXerReconstruction` → `ifc/ifcReader.ts` `readIFC` | tekst | ja (checks draaien hem in Node) | een eigen IFC van een XER-import draait bij heropenen **opnieuw `readXER`** over het archief (zie meting) |
| CSV | `csv/csvReader.ts` `readCSV` | tekst | ja | klein |
| MSPDI | `msproject/mspdiReader.ts:224` | tekst | **nee: `new DOMParser()`** | `DOMParser` bestaat niet in een Web Worker. Tests gebruiken een shim (`tests/planning/xmldom-shim.ts`, niet meegeleverd) |
| P6 XML | `p6/p6xmlReader.ts:205` | tekst | **nee: `new DOMParser()`** | idem |
| .mpp | `mpp/mppReader.ts` `readMPP` (dynamische import) | bytes | ja (geen DOM-gebruik gevonden; `window` op r. 1634 is een lokale variabele) | — |

### Duur bij rehab-2 (6.978 taken, 10.730 relaties, 52.640 toewijzingen, 18,6 MB)

Browser, na #294, fase "openen" (bron: `rehab2-na/1-openen.cpuprofile`, totaal 9,8 s, langste blok 5.557 ms):

| Stap | Tijd | Opmerking |
|---|---|---|
| Playwright `setInputFiles` | 1.169 ms | meetartefact; een echte kiezer heeft dit niet |
| `readXER` totaal | 3.778 ms | |
| ↳ bronarchief bouwen (`createXerSourceArchiveFromOwnedMetadata`) | 2.186 ms | waarvan sha256 (`processBlock`) 811 ms self / 874 ms incl., `validateSourceRow` 618 ms, `bytesToBase64` 249 ms. Met #295: sha256 native async ⇒ ±0,9 s minder in dit blok |
| ↳ `assembleXerMultiProjectImport` | 875 ms | |
| ↳ `parseXerTables` | 496 ms | |
| ↳ `buildXerMetadataCatalog` | 152 ms | |
| `openAsDocument` → `applyLoadedProject` | 1.242 ms | |
| ↳ `prepareLoadedPayload` (solve) | 558 ms | `solveProject` 555 ms |
| ↳ `materializeLibraryBoundary` (belasting) | 368 ms | |
| ↳ Immer `setState` (`hydratePayload`) | 247 ms | |
| React (`react-dom`) | ±264 ms | dev-build |
| GC | 374 ms | |

Node, eigen meting (`meet-main.log` op main; `meet-combo.log` op #294+#295):

| Stap | main | #294+#295 |
|---|---|---|
| `parseOpenedFile` XER | 4.161 ms (`readXER` direct) | 3.350 ms |
| `openAsDocument` | 1.061 ms | 1.346 ms |
| solve buiten de store | 433 ms | 596 ms |
| belasting buiten de store | 287 ms | 387 ms |

Andere formaten, Node, rehab-2 eerst geëxporteerd en dan heropend (`meet2.log`, `meet3` + `prof/`):

| Formaat | Grootte | Parse | `openAsDocument` |
|---|---|---|---|
| IFC (eigen opslag, mét XER-archief) | 60,5 MB | **7.073–7.286 ms**, waarvan `readXerArchiveOrIssue` 4.448 ms (heropent het archief via `readXER`), `parseSTEP` 428 ms, `extractStructure` 296 ms | 1.223–1.250 ms |
| MSPDI | 21,8 MB | 1.761 ms met de test-shim; [VERMOED: met de native `DOMParser` in de browser sneller, niet gemeten] | 1.310 ms |
| CSV | 1,0 MB | 294 ms | 290 ms |
| P6 XML | — | niet gemeten: de shim was na >5 min niet klaar; geen bruikbare maat | — |
| .mpp | — | geen groot .mpp-bestand van deze omvang bij de hand; niet gemeten | — |

Belangrijk: het dagelijkse pad (eigen IFC heropenen) is bij rehab-2 **trager** dan de eerste XER-import, omdat het archief opnieuw door `readXER` gaat.

### Overdrachtskosten worker → hoofdthread (Node, `meet-main.log`)

| Wat | Serialiseren (worker) | Deserialiseren (hoofdthread) | Grootte |
|---|---|---|---|
| Volledig `OpenedImport` | 455–522 ms | **1.256–1.296 ms** | 175 MB (v8) / 403 MB JSON |
| Zonder bronarchief | 410–482 ms | 979–1.065 ms | 136 MB |
| Zonder bronarchief én zonder `xer`-metadata | 58–60 ms | **106–124 ms** | 17 MB |

Per veld (JSON-maat / `structuredClone`): `xer` 174,6 MB / 795–866 ms; `xerSourceArchive` 210,6 MB / 879–1.158 ms; `tasks` 8,7 MB / 76–88 ms; `assignments` 5,7 MB / 43–49 ms. De XER-metadata en het archief zijn dus 85–90 % van de overdracht. Een worker die het hele `ImportResult` terugstuurt, verplaatst ±1,3 s blokkade naar de ontvangst. [VERMOED: het archief als `ArrayBuffer` (transferable) in plaats van base64-chunks zou die kosten bijna wegnemen; niet uitgezocht of het archiefformaat dat toelaat.]

---

## 2. Rekenen

### Route

| Stap | Bestand:regel |
|---|---|
| F5 | `hooks/keyboard/useKeyboardShortcuts.ts:77`, `shortcutRegistry.ts:146` |
| Knop Berekenen | `Ribbon/ribbonConfig.tsx:122-123` |
| Overige UI-aanroepers | `WarningsPanel.tsx:160`, `RecordedDatesNotice.tsx:50`, `CalendarDialog.tsx:83`, `ReportPanel.tsx:1265`, `useExitRecordedDates.ts:55` |
| Store-acties die zelf rekenen | `projectSlice.ts:223, 344`, `schedulingProfileSlice.ts:73`, `scheduleSlice.ts:274, 296` (nivelleren toepassen/wissen), `fileSlice.ts:746, 902, 974, 1077` (export/ankers) |
| Automatisch berekenen | `hooks/useAutoCalcCPM.ts:15-41`: store-subscribe, 100 ms debounce (r. 26-31), wacht op `isAutoCalcHeld()` en `failedSolveGate` |
| `runCPM` | `state/slices/scheduleSlice.ts:94-175` |

`runCPM` doet in **één Immer-producer** (`set`, r. 95-157):
1. Alleen in "datums zoals opgeslagen": `beginUndoable` + modus uit (r. 119-124). Dit is de enige keer dat `runCPM` een undo-stap maakt.
2. `scheduleStale = false` (r. 125).
3. `solveProject(solveInputFor(...))` **rechtstreeks op de draft** (r. 133): `s.tasks` wordt in-place gemuteerd via Immer-proxies.
4. Bij een fout: `cpmResult` met fout, `markScheduleStale` (r. 136-146).
5. `computeReliableResourceLoad` op de draft (r. 152-154).
6. `finishUndoable` óf `refreshLatestDocumentDataHistoryAfter` (r. 155-156): die laatste herschrijft de "na"-snapshot van het laatste history-event met de berekende datums (`runtime/storeRuntime.ts:246-268`, via `snapshotOfCurrentState` → Immer `current()`, r. 117).

Daarna, buiten de producer: `recomputeViewRows` (r. 160), foutmelding via het meldingenkanaal (r. 166-167), host-event `scheduleCalculated` voor extensies (r. 170-174).
Auto-save volgt later via de store-subscribe (`hooks/useAutoSave.ts:22` throttle 10 s, `:66` `writeIFC`).

### Is de solver puur genoeg voor een worker? Ja.

- `solveProject.ts:23-48`: `SolveProjectInput` is plain data (taken, relaties, kalender, kalenders, opties). Commentaar r. 9: puur, muteert alleen `input.tasks`.
- `src/engine/scheduler/` importeert alleen `@/types/*`, `@/utils/*` (datum, hiërarchie, duur) en `@/engine/contour`; geen `localStorage`, `window`, `document`, `i18n` of store (grep).
- `cloneTasksForSolve` (`solveProject.ts`) bestaat al voor rekenen op een kopie (bezettingsoverzicht, slapende documenten `documentSlice.ts:756`, laden).
- `computeReliableResourceLoad` (`ResourceLoad.ts:429`) is ook puur.
- Nivelleren draait al zo in een worker (zie punt 3); dat bewijst het patroon.

### Duur bij rehab-2

Browser F5 na #294 (`rehab2-na/6-F5.cpuprofile`; fase 5,4 s, langste blok 2.657 ms):

| Deel | Tijd |
|---|---|
| `runCPM` totaal (één `setState`) | 2.402 ms |
| ↳ `solveProject` | 1.028 ms |
| ↳ `computeReliableResourceLoad` | 630 ms |
| ↳ undo-snapshot (`snapshotOfCurrentState` → `currentAppState`) | 557 ms |
| ↳ rest: Immer-afronding (`shallowCopy` 354 ms self, `isDraftable` 323 ms self, deels in de snapshot) | ±190 ms |
| Auto-save-tick erna (`recoveryDelta.prepare` → `writeIFC`) | 1.174 ms |
| IndexedDB (`recoveryStore.ts` `allRequest.onsuccess`) | 333 ms (#295 vervangt dit door alleen sleutels lezen) |
| React | ±180 ms |

Node, headless store (`meet-main.log` / `meet-combo.log`):

| Meting | main | #294+#295 |
|---|---|---|
| `runCPM` vanuit "datums zoals opgeslagen" | 2.537–2.642 ms | 3.147 ms |
| `runCPM` gewone stale | 2.195–2.215 ms | 2.530 ms |
| **Zelfde werk buiten de store** (kloon + solve + belasting) | 908–920 ms | 1.011–1.061 ms |
| ↳ resultaat in de store zetten (`set` met nieuwe `tasks`, `cpmResult`, `resourceLoadResult`) | **31–32 ms** | 35–36 ms |
| ↳ `recomputeViewRows` | 4–7 ms | 4–5 ms |
| `undo` (ter vergelijking) | 575–584 ms | 826 ms |

Conclusie: **±1,2–1,5 s van een F5 is Immer-overhead** omdat de solver op de draft rekent, plus de `current()`-snapshot. Buiten de draft rekenen en het resultaat in één `set` zetten, scheelt dat al zonder worker.

### Serialisatie bij 7.000 taken (Node, `structuredClone`)

| Richting | Inhoud | Tijd |
|---|---|---|
| hoofd → worker | solve-invoer (taken, relaties, kalenders, opties) | 94–111 ms (serialiseren + deserialiseren samen) |
| worker → hoofd | `CPMResult` | 24–28 ms |
| worker → hoofd | alle taken na solve | 73–81 ms |
| worker → hoofd | alleen `task.time[]` | 12–13 ms |
| worker → hoofd | `resourceLoadResult` | 85–114 ms |

Een worker-F5 kost de hoofdthread dus ±0,1–0,25 s aan overdracht. Teruggeven van alleen `time`-velden per taak-id is het goedkoopst.

---

## 3. Bestaande infrastructuur

### Web Workers: ja, één

- `src/services/leveling/backgroundLeveling.ts:22-56` `levelInBackground`: `new Worker(new URL('../../engine/scheduler/levelingWorker.ts', import.meta.url), { type: 'module' })` (r. 34), `cancel()` = `worker.terminate()`, terugval zonder `Worker` (headless) via `setTimeout` (r. 23-32).
- `src/engine/scheduler/levelingWorker.ts`: `onmessage` → `levelResources(...input)` → `postMessage({ ok, result })`.
- Afnemer: `components/dialogs/LevelingDialog.tsx:70-110`, met een verouderingscheck `unchanged()` (r. 75-83: vergelijkt referenties van `tasks`, `sequences`, `resources`, `assignments`, `calendar`, `calendars`, `cpmResult`, `project`) en een "Stoppen"-knop.
- Geen comlink of andere worker-bibliotheek (grep).

### Build

- `vite.config.ts:45-47`: `worker: { format: 'es' }`.
- `npm`-loze `vite build` in mijn worktree: exit 0, levert `dist/assets/levelingWorker-DfifTWUq.js` (100 kB). Web- en Tauri-build gebruiken dezelfde `dist/`.
- Tauri: `src-tauri/tauri.conf.json:55` `"csp": null` ⇒ geen `worker-src`-blokkade.
- De worker-commit `164aa9499` zit nog in **geen enkele release-tag** (`git tag --contains` is leeg). Module-workers in de Tauri-webview (WebKitGTK op Linux, WebView2 op Windows, WKWebView op macOS) zijn dus nog niet in het veld bewezen [VERMOED: wel ondersteund in recente versies; niet getest].

### Indicatoren en meldingen

| Wat | Bestand:regel | Bruikbaar voor |
|---|---|---|
| Statusbalk | `components/layout/StatusBar/StatusBar.tsx:58-125`, `!text-body`, toont al "⚠ verouderd" (r. 92-96) | plek voor "Bezig met berekenen…" / "Bezig met openen…" |
| Accentstrook | `components/layout/NoticeStrip.tsx` (icoon, tekst, één knop, optioneel kruisje, `text-small`) | "Bezig met openen van rehab-2.xer — Annuleren" past op dit model (en op de memory-regel "info in gekleurde blokken") |
| Meldingenkanaal (K8a) | `slices/types.ts:159` `NotificationSeverity = 'error' \| 'info'`; `NotificationHost.tsx:111-121` (info verdwijnt na 5 s of `durationMs`) | eindmelding ("geopend", "berekend", fout). Er is géén voortgangs- of "bezig"-soort |
| Tabbladen | `components/layout/DocumentChrome/` (`DocumentTabBar`, `ProjectRail`, `SwitcherPill`) | plek voor een tijdelijk "laadt…"-tabblad |
| Draaiende iconen | `UpdateDialog.tsx:167, 227` (`RefreshCw` + `animate-spin`, lucide); `aria-busy` in `CloseDocumentDialogControl.tsx:33`, `TutorialOfferDialog.tsx:117` | spinnervorm bestaat al |
| `holdAutoCalc` | `state/editHold.ts:16-35`; gebruikt in `useBarDrag.ts:260`, `useSplitGesture.ts:191`, `TaskProgressFields.tsx:133`, `useTextEntryAutoCalcHold.ts:21` | geen indicator; houdt auto-calc vast tijdens een gebaar |

Tekstrollen: alleen `text-caption`/`small`/`body`/`large`/`heading`/`title` (`verify:text-roles`). Statusbalk = `text-body`, strook = `text-small`. Elke nieuwe tekst via `t(...)` in alle veertien locales; een nieuwe melding ook in de gesloten sleutelunie van `slices/types.ts`.

Belangrijk feit: omdat parse en solve nu synchroon zijn, **kan geen enkele indicator verschijnen** tijdens het werk. Een `set({ busy: true })` vlak ervoor rendert pas na de blokkade, tenzij de code eerst één frame teruggeeft aan de browser.

---

## 4. Bruikbaar blijven tijdens rekenen

### Nu

- De solve draait synchroon in een `set`-producer. Toetsen en klikken wachten in de event-queue en worden ná de solve uitgevoerd op de nieuwe state. Er is dus geen race, wel een bevriezing.
- Auto-calc wacht tijdens gebaren en tekstinvoer (`editHold.ts`) en coalesceert met 100 ms debounce (`useAutoCalcCPM.ts:26`).

### Mechanismen die al bestaan voor "verouderd resultaat"

| Mechanisme | Bestand:regel | Wat het vergelijkt |
|---|---|---|
| `failedSolveGate` | `state/failedSolveGate.ts:35-75` | `planningInputOf`: referenties van `tasks`, `sequences`, `calendar`, `calendars` + zes projectvelden (`statusDate`, `progressMode`, `schedulingOptions`, `schedulingProfile`, `startDate`, `endDate`) |
| `LevelingDialog.unchanged()` | `LevelingDialog.tsx:75-83` | referenties van de invoerlijsten + `cpmResult` + `project` |
| `runtime.mutationSeq()` | `state/runtime/storeRuntime.ts:101`; afnemer `services/library/proposalFingerprint.ts:55` | grofmazige teller per mutatie; commentaar r. 96-99: "`runCPM` muteert datums zonder ooit langs `beginUndoable` te komen", dus referenties zijn de sluitende check |
| Neutrale taakvelden (alleen op #294) | `src/state/resourceLoadReuse.ts` (`RESOURCE_LOAD_NEUTRAL_TASK_KEYS`: naam, omschrijving, wbsCode, kleur, …) | per taak: wijzigde alleen een neutraal veld? |

### Hoe een achtergrond-solve veilig terugkomt (ontwerpvoorstel, niet gebouwd)

1. Bij start: noteer `activeDocumentId`, `planningInputOf(state)` (zelfde vorm als `failedSolveGate`), en een volgnummer `solveGeneration++`.
2. Stuur `solveInputFor(...)` naar de worker (±0,1 s).
3. Bij terugkomst, in één `set`:
   - ander document actief, of `solveGeneration` is niet meer de laatste ⇒ weggooien;
   - `planningInputOf` gelijk ⇒ toepassen (datums per taak-id, `cpmResult`, `resourceLoadResult`, `scheduleStale = false`);
   - alleen neutrale velden gewijzigd ⇒ datums per taak-id samenvoegen met de huidige taken [VERMOED: haalbaar met de logica van `resourceLoadReuse.ts`, maar die lijst is voor de belasting gemaakt, niet voor de solver; eigen lijst nodig];
   - anders ⇒ weggooien, `scheduleStale` blijft staan; met auto-calc aan start de hook vanzelf een nieuwe run.
4. History: nu herschrijft `runCPM` de "na"-snapshot van het laatste history-event (`storeRuntime.ts:246-268`). Asynchroon mag dat alleen als dat event nog het laatste is (volgnummer `event.sequence` noteren bij start). De snapshot zelf goedkoop maken: na de `set` uit plain state (`createSnapshot(get())` kost 0 ms per referentie) in plaats van `current()` op de draft (557 ms).
5. "Datums zoals opgeslagen": de modus-verlaat-snapshot (`scheduleSlice.ts:119-124`) moet in de toepas-producer, niet bij de start, anders kan een undo tussendoor een halve toestand geven.
6. Een nieuwe F5 tijdens een lopende solve: oude worker beëindigen (`terminate`, zoals nivelleren) of laten aflopen en via `solveGeneration` weggooien.

### Undo/redo en auto-save in de tussentijd

- Undo/redo wisselt `tasks`-referenties ⇒ stap 3 gooit het resultaat weg; auto-calc rekent opnieuw. Undo zelf kost bij rehab-2 0,58–0,83 s op de hoofdthread (Node), los van dit voorstel.
- Auto-save schrijft de toestand van dat moment (met verouderde datums). Dat gebeurt nu ook al tussen een bewerking en F5, dus geen nieuw risico [VERMOED: de manifest-vlag `datesAsRecorded` blijft kloppen omdat de modus pas bij toepassen wijzigt]. Maar de tick zelf (`writeIFC` ±1,0–1,2 s + IndexedDB) is óók een hoofdthread-blokkade; `writeIFC` is puur (`buildWriteIFCInput` → string) en dus ook worker-kandidaat.

---

## 5. Bruikbaar blijven tijdens openen

- `openFile` maakt het document pas aan bij het toepassen. De keuze "leeg tabblad hergebruiken" valt opnieuw per document op dat moment (`fileSlice.ts:590`, `isActivePristine(get())`). Werken in een ander document terwijl een bestand op de achtergrond laadt, is daardoor in principe veilig.
- Randgevallen:
  - gebruiker begint te typen in het lege starttabblad ⇒ dat tabblad is niet meer pristine ⇒ het bestand komt in een nieuw tabblad. Correct gedrag.
  - de bibliotheek (`companies`/`pools`) wijzigt tijdens het laden ⇒ de bibliotheekgrens (stap 7) is op oude data berekend. Bij toepassen vergelijken en zo nodig op de hoofdthread herhalen (±0,4 s) [VERMOED: zeldzaam].
  - twee bestanden tegelijk openen ⇒ elk een eigen worker; de volgorde van toepassen bepaalt de tabvolgorde.
- Placeholder-tabblad: een echt document met een "laadt"-status zou in `DOCUMENT_FIELDS` (`documentContract.ts`) moeten, met gevolgen voor undo, crashherstel en opslaan. Eenvoudiger: een **UI-only lijst lopende opens** (bijv. `ui.pendingOpens: { id, name, startedAt }[]`, geen documentdata) die de tabbalk als tijdelijk tabblad met spinner en kruisje toont. Kruisje = annuleren = `worker.terminate()` + item weg, zoals `backgroundLeveling.ts:51-54`.
- Wat niet kan tijdens laden: in het nieuwe document werken (het bestaat nog niet). Dat is acceptabel.
- Crashherstel bij start parseert alle snapshots vóór de vraag aan de gebruiker (`useRecoveryRestore.ts:62-78`). Bij een rehab-2-snapshot is dat ±7 s IFC-parse; dezelfde worker kan dat overnemen.

---

## 6. MCP en extensie-API

### Synchrone aanroepers die direct een resultaat verwachten

| Pad | Bestand:regel | Verwachting |
|---|---|---|
| `ensureFreshSchedule` (baseline, nivelleren) | `services/mcp/staleGuard.ts:52-60` | `runCPM()` en dan meteen `cpmResult.error` lezen |
| `freshenScheduleForRead` / `runReadTool` | `services/mcp/tools/runtime.ts:284-307, 329-332` | `runReadTool` is synchroon; leest state direct na de herrekening |
| `planner_batch` `recomputeMidBatch` | `services/mcp/tools/batchTool.ts:234-239` | synchroon midden in een transactie; commentaar r. 3, 28, 66-71: draaiboek is bewust synchroon |
| MCP-transactie eindherberekening | `state/runtime/createMcpTransactions.ts:1075` (gooit bij een Promise), `:1089` | callback **moet** synchroon zijn |
| `planner_import_schedule` | `fileTools.ts:365, 386` | parse is al `await`; `openAsDocument` synchroon, daarna leest de tool de documenten |
| Extensie `data.recalculate()` | `extensions/extensionApi.ts:307`; type `extensions/types.ts:291` (`recalculate(): void`) | synchroon; extensies lezen daarna `getTasks()` |
| Extensie `data.loadProject()` | `extensionApi.ts:302-306` | `loadState` + `runCPM` synchroon |
| Host-event `scheduleCalculated` | `scheduleSlice.ts:170-174`, `fileSlice.ts:507-511`; `docs/extensions.md:624` | vuurt direct na de solve |

De dispatcher zelf is wel async (`services/mcp/dispatcher.ts:191` `await def.handler(...)`), en de MCP-wachtrij heeft 110 s deadline (`server.ts:211`).

### Wat breekt als solve asynchroon wordt

- Als `runCPM` zelf async wordt: `planner_batch`, de MCP-transacties en `staleGuard` breken (contract "strikt synchroon"), en extensies die na `recalculate()` lezen, krijgen oude datums. Dat is een publieke API-wijziging (extensiecontract).
- **Daarom: `runCPM` synchroon laten** (de sync-route blijft één implementatie via `solveProject`) en een aparte UI-route toevoegen (bijv. `requestCalculate()`) voor F5, de knop, auto-calc en openen. MCP en extensies merken dan niets.
- Wisselwerking: een MCP-leestool kan synchroon rekenen terwijl een UI-worker loopt. De generatiecheck (punt 4) gooit het latere worker-resultaat dan weg, omdat `cpmResult`/`tasks` intussen nieuwe referenties hebben. Geen dubbel schrijven.
- `planner_import_schedule` kan optioneel de worker-parse gebruiken (hij is al async), zonder contractwijziging.

---

## 7. Risico's en grenzen

### Wat op de hoofdthread blijft (rehab-2)

| Moment | Onvermijdelijk deel | Schatting |
|---|---|---|
| Openen, volledige `ImportResult` terugsturen | deserialiseren 1,0–1,3 s + `set` 0,25 s + React/canvas ±0,3 s (dev) | **±1,5–1,9 s in 2–3 blokken** |
| Openen, XER-metadata/archief slim overgedragen | deserialiseren ±0,1 s + `set` 0,25 s + render ±0,3 s | **±0,4–0,6 s** [VERMOED: vraagt een andere vorm voor `xer`/`xerSourceArchive`] |
| F5 via worker | invoer serialiseren ±0,05–0,1 s; resultaat ontvangen ±0,1–0,2 s; `set` ±0,04 s; viewRows ±0,005 s; render ±0,2 s | **±0,3–0,5 s** |
| Auto-save-tick (blijft, tenzij ook naar een worker) | `writeIFC` ±1,0–1,2 s + IndexedDB 0,3 s (vóór #295) | ±1,2–1,5 s, elke 10 s na een wijziging |
| Undo/redo | Immer-hydrate | 0,6–0,8 s (Node) |

React rendert geen 7.000 rijen: het raster is gevirtualiseerd (31 rijen, 640 DOM-nodes; `/tmp/ops-perf-rehab2/rapport.md`). React kost ±0,2–0,3 s per grote wijziging in de dev-build.

### Conclusie haalbaarheid

"Volledig bruikbaar" in de strikte zin (nooit een hapering) is niet haalbaar zonder ook auto-save, undo en de XER-metadata aan te pakken. Wel haalbaar: **een zichtbare indicator, en geen bevriezing langer dan ±0,5 s bij F5 en ±0,5–1,9 s bij openen**, afhankelijk van hoe de XER-metadata wordt overgedragen.

### Overige risico's

- **XML (MSPDI, P6 XML) kan niet naar een worker** zonder een XML-parser die zonder `DOMParser` werkt (nieuwe afhankelijkheid) of zonder de shim te verzwaren. Alternatief: XML op de hoofdthread laten, met alleen indicator + yield.
- **Twee rekenroutes** (sync voor MCP/extensies, async voor UI) moeten dezelfde uitkomst geven. Beide via `solveProject` + `solveInputFor` houdt dat by construction gelijk; de toepas-producer is nieuw en moet de bijzonderheden van `runCPM` herhalen (modus verlaten, history-refresh, fout ⇒ `markScheduleStale`, meldingen, host-event).
- **`WeakMap`-caches** (#295 `precomputeSha256`) en `deepFreeze` overleven `postMessage` niet. Wat in de worker wordt berekend, moet daar ook gecachet worden.
- **Bundelgrootte**: een import-worker neemt alle readers mee [VERMOED: honderden kB tot ±1 MB extra worker-chunk].
- **Tauri-veldtest**: module-workers zijn nog niet in een release gebruikt (zie punt 3).
- **Geheugen**: worker en hoofdthread hebben tijdelijk elk een kopie (175 MB v8-serialisatie bij rehab-2). Bij `rehab2-na` was de heap al 344–574 MB.
- **Headless tests** hebben geen `Worker`; de terugval van `backgroundLeveling.ts:23-32` is het patroon (zelfde functie, volgende macrotask).
- **Verify-poorten**: nieuwe teksten ⇒ `verify:i18n` (14 locales); nieuwe meldingssleutel ⇒ sleutelunie; gebruikerszichtbaar ⇒ gids in `public/docs/{nl,en}/`; `verify:store-boundaries` (worker-code mag geen `useAppStore` importeren); `verify:cycles`.

---

## Mogelijke aanpakken

### A — Indicator + één frame teruggeven + rekenen buiten de Immer-draft

- **Gebruiker merkt**: bij openen en F5 verschijnt direct een indicator (statusbalk of strook: "Bezig met openen van rehab-2.xer…", "Bezig met berekenen…"). Daarna bevriest het scherm nog steeds, maar korter: F5 ±1,0–1,2 s in plaats van 2,7 s; openen in 2–4 blokken (parse ±2,9 s na #295, dan solve/belasting ±1 s, dan `set`). Tussen de blokken kan de browser tekenen. Annuleren is niet mogelijk.
- **Wat verandert**:
  - `scheduleSlice.ts` `runCPM`: solve en belasting op een kloon buiten de producer (`cloneTasksForSolve`), daarna één `set`; history-snapshot uit plain state. Dit is ook winst voor MCP en extensies.
  - `fileSlice.ts` `openFile`/`openRecentFile`: `ui`-vlag zetten, `await` een frame (`requestAnimationFrame` + `setTimeout`), dan parse; tussen parse en `openAsDocument` nog een frame.
  - F5/knop/auto-calc: eerst de vlag, dan een frame, dan `runCPM`.
  - `StatusBar.tsx` of een `NoticeStrip`-variant; i18n-sleutels; gids-regel.
- **Risico's**: laag. De volgorde van store-mutaties blijft gelijk. Let op: een frame teruggeven betekent dat input tussendoor kan binnenkomen; een F5-klik terwijl de vorige wacht moet worden samengevoegd.
- **Grootte**: S (indicator + yield), M met de draft-fix en zijn tests (`check-recorded-dates`, history-refresh).
- **MCP/extensies**: merken alleen dat `runCPM` sneller is. Geen contractwijziging.

### B — Parse + solve in een Web Worker, met generatieteller (aanbevolen)

- **Gebruiker merkt**: openen toont direct een tijdelijk tabblad met spinner en kruisje (annuleren). Intussen werkt hij gewoon in andere documenten. Aan het eind één korte hapering (±0,5 s met slimme XER-overdracht, anders ±1,5 s). F5 en auto-calc: indicator in de statusbalk, de UI blijft werken; datums verschijnen na ±1 s; een bewerking tussendoor laat het resultaat vervallen en (met auto-calc) start een nieuwe run.
- **Wat verandert**:
  - Nieuw: `src/services/background/importWorker.ts` (+ `.worker.ts`): `parseOpenedFile` + stappen 3–7 (`prepareLoadedPayload`, `applyRecordedDatesOnLoad`, `materializeLibraryBoundary`) → `DocumentPayload` + viewRows + belasting. Patroon `backgroundLeveling.ts`.
  - Nieuw: `src/services/background/solveWorker.ts`: `solveProject` + `computeReliableResourceLoad` → datums per taak-id + `cpmResult` + belasting.
  - `fileSlice.ts`: `applyLoadedProject` splitsen in "voorbereiden" (worker) en "toepassen" (store); `openFile`/`openRecentFile`/crashherstel gebruiken de worker; `openExampleFromString` en MCP mogen sync blijven.
  - `scheduleSlice.ts`: `runCPM` blijft sync (MCP, extensies, batch); nieuw `requestCalculate()` + een toepas-actie met de check uit punt 4 (`failedSolveGate.planningInputOf` hergebruiken, `solveGeneration`, history-event-volgnummer).
  - `useAutoCalcCPM.ts`, `useKeyboardShortcuts.ts:77`, `ribbonConfig.tsx:122`, `WarningsPanel.tsx:160`, `RecordedDatesNotice.tsx:50` → `requestCalculate()`.
  - UI: `ui.pendingOpens` en `ui.calculating` (geen documentdata), tabbalk-placeholder, statusbalk-indicator; i18n (14 locales); gids.
  - XER-metadata/archief: vorm voor goedkope overdracht kiezen (bijv. archief als `ArrayBuffer` transferable) of accepteren dat het einde ±1 s hapert.
  - MSPDI/P6 XML: blijven op de hoofdthread met aanpak A, of krijgen een worker-geschikte XML-parser (apart besluit).
  - Tests: worker-terugval headless; check dat de async route dezelfde uitkomst geeft als `runCPM` (pariteit); browsertest "bewerken tijdens rekenen" en "annuleren tijdens openen"; Tauri-rooktest.
- **Risico's**: middel. Twee routes naar dezelfde toestand (pariteit bewaken), toepas-logica van `runCPM` dupliceren, history-refresh bij verschoven events, geheugenpiek, eerste worker in een Tauri-release.
- **Grootte**: L in totaal; in drie plakken te leveren: B1 = aanpak A (S/M), B2 = rekenen in een worker (M), B3 = openen in een worker met placeholder-tab en annuleren (M/L).
- **MCP/extensies**: merken niets; ze houden de synchrone `runCPM`. Een lopende UI-solve wordt door een MCP-herrekening ongeldig en weggegooid. Optioneel kan `planner_import_schedule` de worker-parse gebruiken.

### C — De hele store (of een kopie) in een worker

- **Gebruiker merkt**: in theorie het minst; alle zware acties draaien buiten de hoofdthread.
- **Wat verandert**: Zustand+Immer-store dupliceren of verplaatsen; elke mutatie (UI, MCP, extensies) via berichten; React leest een gespiegelde toestand. Raakt `appStore.ts`, alle slices, `storeRuntime`, MCP-transacties (strikt synchroon), extensie-API (sync `get*`), de renderer.
- **Risico's**: zeer hoog. Botst met de synchrone contracten van MCP-batch en extensies, met de undo-architectuur (`historyEvents`), en met de regel "één store". De overdracht van de volledige state per wijziging kost meer dan de solve zelf (175 MB bij rehab-2).
- **Grootte**: XL.
- **MCP/extensies**: alles wordt asynchroon ⇒ publieke API-breuk.

## Mijn keuze

**B, in drie plakken, te beginnen met B1 (= A).** B1 levert direct een zichtbare indicator en haalt de Immer-overhead weg (F5 ±2,7 → ±1,1 s blokkade) zonder risico voor MCP/extensies. B2 (rekenen in een worker) maakt F5 en auto-calc bijna haperingsvrij (±0,3–0,5 s) met het bestaande worker-patroon en de bestaande verouderingschecks. B3 (openen in een worker) is het grootste stuk; vóór B3 moet er een besluit komen over de overdracht van de XER-metadata en het archief, want die bepalen of het einde van het openen ±0,5 s of ±1,5 s hapert. C raad ik af.

Los van deze vraag, maar wel zichtbaar in de metingen: de auto-save-tick (`writeIFC` ±1 s) en undo (0,6–0,8 s) blijven hoofdthread-blokkades bij rehab-2. Een eigen IFC heropenen (7 s, waarvan 4,4 s `readXER` over het archief) is trager dan de eerste XER-import.
