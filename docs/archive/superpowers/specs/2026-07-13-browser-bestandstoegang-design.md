# Browser-bestandstoegang — ontwerp

**Datum:** 2026-07-13
**Status:** goedgekeurd (kritische review: AKKOORD MITS 7 correcties, alle verwerkt in deze spec)
**Doel:** de browser-build (nu Tauri-only voor bestand-I/O) bestanden laten openen, opslaan en exporteren, met crash-recovery — zonder de desktop-flow te breken en zonder Rust of nieuwe runtime-dependencies.

---

## 1. Context & probleem

De app is vrijwel volledig TypeScript; de web-dev-build (`open-planner-studio.open-aec.com`, gedeployed vanaf `dist/`) is functioneel behalve bestand-I/O, auto-save en de updater, die achter `isTauri()` (`'__TAURI_INTERNALS__' in window`, `src/utils/platform.ts:8`) zitten. Concreet: de zes projectbestand-acties in `src/state/slices/fileSlice.ts` beginnen met `if (!isTauri()) return;` en zijn in de browser een **stille no-op** — de knoppen reageren, maar er gebeurt niets.

De IFC-laag maakt dit goedkoop op te lossen: `readIFC(content: string): ImportResult` (`src/services/ifc/ifcReader.ts:43`) en `writeIFC(input): string` (`src/services/ifc/ifcWriter.ts:100`) zijn **pure `string ↔ state`-functies zonder enige filesystem-koppeling**. Alle adapters (CSV/MSPDI/P6) zijn eveneens pure string-transformaties. Al het pad-gebonden I/O zit in een dunne aanroeplaag (`fileSlice`, `App.tsx`). Alleen die laag krijgt een web-backend.

## 2. Doelen en niet-doelen

**Doelen**
- Openen, opslaan, opslaan-als en exporteren (IFC/CSV/MSPDI/P6) werken in de browser.
- "Native gevoel" op Chromium (File System Access API: in-place opslaan op hetzelfde bestand), met nette terugval op upload/download in Firefox/Safari.
- Recente bestanden zijn in Chromium écht opnieuw te openen (handle-backed).
- Crash-recovery/auto-save in de browser, met pariteit met de desktop (herstel-dialoog bij opstart).
- `npm run build` (tsc, strict, `noUnusedLocals`/`noUnusedParameters`) blijft groen.

**Niet-doelen (bewust buiten scope)**
- **Externe links naar bestanden** (`parseExternalSource`, `sourceRef.filePath`) blijven **Tauri-only**. Ze zijn intrinsiek pad-gebaseerd (absolute OS-paden gepersisteerd naar IFC + ververst via `refreshExternalAnchorsFrom`); ze naar web tillen zou het hele externe-links-model raken. In web toont de externe-link-dialoog alleen de handmatige route.
- De updater blijft Tauri-only (ongewijzigd).
- Geen OS-drag-and-drop-open (bestaat nu ook niet).

## 3. Architectuur — één abstractie, drie backends

Nieuwe map `src/services/fileAccess/` presenteert een uniforme API; de backend wordt bij runtime gekozen.

| Runtime | Detectie | Openen | In-place opslaan | Opslaan-als / export |
|---|---|---|---|---|
| **Tauri (desktop)** | `isTauri()` | `plugin-dialog` open + `plugin-fs` readTextFile | `writeTextFile(pad)` | save-dialog + writeTextFile |
| **Chromium web** | `'showOpenFilePicker' in window` | `showOpenFilePicker()` → `FileSystemFileHandle` | `handle.createWritable()` | `showSaveFilePicker()` |
| **Fallback web** (Firefox/Safari) | anders | `<input type=file>` → `file.text()` | *n.v.t.* → download | `Blob` + `<a download>` |

### 3.1 Publieke API (`src/services/fileAccess/index.ts`)

```ts
// Opake verwijzing naar een bestand als opslaan-doel.
type FileRef =
  | { kind: 'path'; path: string }        // Tauri
  | { kind: 'handle'; handle: FileSystemFileHandle }; // Chromium web
// (fallback-web heeft geen herbruikbare ref → null)

interface OpenedFile { name: string; content: string; ref: FileRef | null }
interface SaveOutcome { ref: FileRef | null; name: string }

// Openen (altijd picker/input). null = geannuleerd.
openFileDialog(filters: FileFilter[]): Promise<OpenedFile | null>
// Opslaan-als / export (altijd picker). null = geannuleerd.
saveFileDialog(defaultName: string, content: string, filters: FileFilter[]): Promise<SaveOutcome | null>
// In-place opslaan naar bestaande ref. Retourneert false als onmogelijk
// (fallback-web, of geweigerde permissie) → caller valt terug op saveFileDialog.
saveToRef(ref: FileRef, content: string): Promise<boolean>
// Inhoud van een bewaarde ref herlezen (recents heropenen). null bij fout/geweigerd.
readFromRef(ref: FileRef): Promise<string | null>
// Capability-vlag voor UI-beslissingen (recents tonen/verbergen).
supportsHandles(): boolean   // isTauri() || 'showOpenFilePicker' in window
```

Backends: `tauriBackend.ts` (dynamische `@tauri-apps/*`-imports, exact de huidige logica), `webBackend.ts` (FSA + fallback, met capability-switch binnenin). De backend-keuze zit in `index.ts`.

### 3.2 FSA-permissiemodel (belangrijk, platformgedrag)

- `showOpenFilePicker()` geeft een handle met **read**-permissie. In-place opslaan vereist een **readwrite**-permissie: `saveToRef` roept eerst `handle.queryPermission({mode:'readwrite'})` en zo nodig `requestPermission({mode:'readwrite'})` aan; geweigerd → `false`.
- `showSaveFilePicker()` (opslaan-als) geeft al een **readwrite**-handle → geen extra prompt.
- **User-gesture-constraint:** `requestPermission` moet vanuit een gebruikersinteractie komen. Daarom kan crash-recovery een bewaarde handle **niet stil** her-autoriseren (zie §6): een herstelde web-doc valt terug op "opslaan-als" tot de gebruiker de handle handmatig re-autoriseert bij de eerste opslag.

## 4. Store-wijziging: `fileHandle` naast `filePath`

Per document komt naast `filePath: string | null` één veld: `fileHandle: FileSystemFileHandle | null`.

**Invariant (verplicht te documenteren in code):**
> `filePath` = identiteit + weergave (echt pad in Tauri; **bestandsnaam** in web). `fileHandle` = **uitsluitend** het web-opslaan-doel, nooit gebruikt voor identiteit/titel.

Hierdoor blijft `documentTitle(filePath, …)` / `getOpenDocuments` (`documentSlice.ts:251-257, 347-355`) ongewijzigd werken. Een gekozen `FileRef` van kind `handle` wordt in de store uitgepakt: `filePath = ref…name`, `fileHandle = ref.handle`.

### 4.1 Waarom een handle veilig in de store mag (geverifieerd)

- De store heeft **geen** `persist`-middleware (`appStore.ts:48`) → geen automatische JSON-serialisatie die de handle tot `{}` reduceert.
- De undo/redo-`Snapshot` (`src/state/snapshot.ts:14-53`) bevat **noch `filePath` noch `fileHandle`** — undo/redo kan de handle nooit clobberen (`historySlice.ts:16-68` raakt die velden niet aan).
- Document-swap is **referentie-toewijzing**, geen serialisatie (`documentSlice.ts:116-140` capture, `167-194` hydrate).
- Immer (`enableMapSet()`, autoFreeze default) behandelt een class-instance als opake, niet-draftable leaf — net als het bestaande `Map` in `cpmResult`. Geen freeze/draft-probleem.

### 4.2 Verplichte payload-sites (anders latente bug)

`fileHandle` moet consistent worden bijgewerkt op **alle** swap/reset-sites, niet één:
- `capturePayload` / `hydratePayload` / `freshPayload` / `payloadFromInput` (`documentSlice.ts:116, 167, 197, 224`)
- `getOpenDocuments` / `getOpenDocumentPayloads` (`documentSlice.ts:347, 358`) voor zover nodig
- `newProject` (`projectSlice.ts:158-181`) en `createNewProject` (`projectSlice.ts:185-237`) → `s.fileHandle = null` mee-resetten
- Elke `s.filePath = …`-set in `fileSlice` (`openFile`, `openRecentFile`, `saveFile`, `saveFileAs`, `openExampleFromString`) → `s.fileHandle` consistent zetten/wissen (`openExampleFromString` en fallback-web-openen zetten `fileHandle = null`).

Het `DocumentPayload`-type en `slices/types.ts` krijgen het extra veld.

## 5. `fileSlice`-acties (guards weg, abstractie erin)

De zes acties verliezen `if (!isTauri()) return` en roepen de abstractie aan. De bestaande extensie-routing (IFC/CSV/XML), `runCPM()`, `requestFitToProject()`, `emit('projectLoaded')` en dirty-handling blijven gelijk.

- **`openFile`** → `openFileDialog(filters)`; bij `null` netjes terug (spiegel `if (!selected) return`, `fileSlice.ts:101`). Route op extensie, zet `filePath`/`fileHandle` uit de ref, `addRecentFile(ref, name)`.
- **`saveFile`** → `writeIFC(...)`; als het doc een `FileRef` heeft (`fileHandle` of Tauri-`filePath`) en `saveToRef` slaagt → klaar; anders `saveFileDialog`.
- **`saveFileAs`** → altijd `saveFileDialog`.
- **`exportAs`** → juiste writer + filters → `saveFileDialog`.
- **`openRecentFile`** → `readFromRef(entry.ref)` (Chromium: permissie-check + `handle.getFile().text()`); route op extensie. Geweigerd/verdwenen → entry verwijderen.
- **`parseExternalSource`** → **Tauri-only houden** (vroege `return null` in web). Externe-links-refresh (`refreshExternalAnchorsFrom`/`refreshAllExternalAnchors`) blijft dus desktop.

**Reeds web-werkende paden (niet aanraken, expliciet buiten de abstractie):** PDF-/rapport-export (`ReportPanel.tsx:134-150`, heeft al web-blob-fallback) en extensie-importers (`Backstage.tsx:473-497`, al `<input type=file>`). `openExampleFromString` blijft ongated.

## 6. Recente bestanden — handle-backed via IndexedDB

Handles zijn niet JSON-serialiseerbaar → recents verhuizen van `localStorage` (pad-strings, key `open-planner-studio-recent-files`, `fileSlice.ts:46`) naar **IndexedDB** `ops-recent-files`, volgens het raw-IndexedDB-patroon van `src/extensions/extensionLoader.ts`.

**Datavorm verandert (niet alleen opslag):**
```ts
interface RecentEntry { id: string; name: string; ref: FileRef; addedAt: number }
```

- Nieuwe store-state `recentFiles: RecentEntry[]` in `fileSlice`, plus actie `hydrateRecentFiles()` die bij app-start async uit IDB leest en de oude `localStorage`-paden **eenmalig migreert** naar `{kind:'path'}`-entries.
- `addRecentFile` schrijft naar IDB én de in-memory array (MRU, max 10, dedupe op ref-identiteit).
- **Fallback-web (geen handles):** open levert geen herbruikbare ref → niet aan recents toevoegen; recents-UI wordt **verborgen** als `!supportsHandles()`. Zo geen dode klikbare items.
- Consumenten die nu synchroon `getRecentFiles()` renderen worden op `s.recentFiles` (store-state) gezet — **herschrijven van 3 sites**: `Ribbon.tsx:464/512`, `Backstage.tsx:163/171-180`, `ExternalLinkDialog.tsx:25/132`. In `ExternalLinkDialog` bepaalt `useState(recent.length === 0)` (`:30`) de begin-modus eenmalig bij mount; dit wordt een `useEffect` op de gehydrateerde lijst, en de recent-route is daar sowieso Tauri-only (§2).

Bij heropenen van een handle-entry: eerst `queryPermission`/`requestPermission({mode:'read'})`; geweigerd/verdwenen → entry stil verwijderen.

## 7. Auto-save & crash-recovery — IndexedDB-backend, pariteit

De recovery-logica in `App.tsx:282-483` (debounced 800 ms IFC-snapshots naar `appDataDir` + `RecoveryManifest`, `App.tsx:24-28`) krijgt een tweede backend via nieuwe `src/services/recovery/recoveryStore.ts`:

- **Tauri-backend:** exact de huidige `appDataDir` + `plugin-fs`-logica (verplaatst, niet gewijzigd; dev-slug-isolatie behouden).
- **Web-backend:** IndexedDB-store `ops-recovery`: per-doc record `{ id, ifc, filePath, isDirty }` + één manifest-record `{ version, activeDocumentId, ids }` — 1-op-1 met de huidige manifest. De opruimlogica ("verwijder wat niet in de huidige doc-set zit", `App.tsx:331-338`) vertaalt naar IDB-delete.

De debounce, de `writeIFC`-serialisatie (**compleet** — alle velden incl. `activityCodeTypes/customFieldDefs/resourceCalendars/baselines/activeBaselineId`, `App.tsx:305-317`) en de bestaande herstel-dialoog bij opstart (`RecoveryDialog`) werken voor beide backends.

**Web-specifieke correcties:**
- **`beforeunload`-waarschuwing** bij dirty state — **achter `!isTauri()`** (Tauri heeft al `CloseDocumentDialog`; een ongeguarde handler zou in de desktop-webview dubbel-prompten).
- **User-gesture (§3.2):** een herstelde web-doc bewaart in het manifest géén herbruikbare handle; na herstel valt opslaan terug op "opslaan-als" tot de gebruiker de handle opnieuw kiest.
- **Multi-tab:** twee tabs op dezelfde origin delen `ops-recovery`. Om te voorkomen dat tabs elkaars snapshots wissen, worden recovery-records gescoped met een per-tab `sessionId` (`crypto.randomUUID()` in `sessionStorage`, overleeft reload/crash van hetzelfde tab). Een tab pruned alleen records van de eigen `sessionId`; bij opstart wordt de eigen sessie hersteld, en sessies ouder dan 7 dagen (op `addedAt`/mtime) worden opgeruimd. `appDataDir`/dev-slug worden in web betekenisloos → web gebruikt vaste DB-naam; origin-per-poort geeft gratis dev-isolatie.

## 8. TypeScript-typen (build-blocker — verplicht)

`showOpenFilePicker`/`showSaveFilePicker` en `FileSystemHandle.queryPermission`/`requestPermission` staan **niet** in de `lib.dom.d.ts` van `typescript@5.9.3` (geverifieerd: 0 hits; de `requestPermission`-treffers zijn `Notification`). `@types/wicg-file-system-access` is niet geïnstalleerd. Zonder augmentatie faalt `npm run build`.

**Keuze:** een zelfstandige ambient declaratie `src/types/file-system-access.d.ts` (`declare global`) voor uitsluitend de gebruikte leden (`Window.showOpenFilePicker/showSaveFilePicker`, `FileSystemHandle.queryPermission/requestPermission`, `showSaveFilePicker`-opties). Geen dependency, volledig onder eigen beheer. (Alternatief `@types/wicg-file-system-access` bewust niet gekozen om de dep-lijst schoon te houden.)

## 9. Modules (elk één taak)

- `src/services/fileAccess/index.ts` — publieke API + backend-keuze + `supportsHandles()`
- `src/services/fileAccess/tauriBackend.ts` — Tauri dialog+fs (huidige logica)
- `src/services/fileAccess/webBackend.ts` — FSA + fallback (input/download)
- `src/services/fileAccess/recentFiles.ts` — recents-persistentie (IDB) + migratie
- `src/services/recovery/recoveryStore.ts` — recovery-backends (uit `App.tsx` getrokken)
- `src/utils/idb.ts` — piepklein gedeeld raw-IndexedDB-helpertje (open/get/put/getAll/delete), **alle toegang in try/catch** zodat een IDB-fout (private-mode/quota) app-start nooit blokkeert; recents/recovery falen dan stil
- `src/types/file-system-access.d.ts` — ambient FSA-typen
- **Opruimen:** `src/components/layout/MenuBar/MenuBar.tsx` verwijderen (dode, nergens-gerenderde code; bevat bovendien een onvolledig `writeIFC`-save-pad — een footgun)

## 10. Foutafhandeling

- Annuleren van picker/input → `null`, actie stopt schoon (geen half-geladen document).
- Geweigerde FSA-permissie → `saveToRef` false → terugval op `saveFileDialog`; `readFromRef` null → recent-entry verwijderen.
- IDB-fout → stil falen (recents leeg / geen recovery), app blijft werken.
- Bestaande `console.error`-catches in `openFile`/`openRecentFile` (`fileSlice.ts:155, 410`) behouden.

## 11. Verificatie

Geen unit-runner; `tsc` (`npm run build`) is de statische check en **moet groen** zijn (incl. de nieuwe d.ts). Gedrag wordt zelf getest via de browser-dev-build (preview, poort 3007) + de `window.__OPS__`-store-hook, assertend op **store-state**, niet op canvas-pixels (conform `docs/self-test-harness.md`).

Te verifiëren via store-state: backend-keuze (`supportsHandles`), openen (upload-pad) → `readIFC`-routing → doc geladen, opslaan-download-pad markeert niet-dirty, recents-IDB-schrijven/-hydratatie/-migratie, recovery-IDB-schrijven + herstel-dialoog, `fileHandle`-reset bij `newProject`/document-swap.

**Eerlijke beperking:** de FSA-picker-dialogen (`showOpenFilePicker`/`showSaveFilePicker`) zijn native OS-dialogen die een geautomatiseerde browser niet kan aanklikken. Die specifieke picker-interactie wordt **niet** end-to-end geautomatiseerd getest; de onderliggende logica (`saveToRef`/`readFromRef`/permissie-branches) wel via directe aanroep/store-state. Wat niet via automation aangeklikt kon worden, wordt expliciet als zodanig gerapporteerd.

## 12. Fasering (voor het implementatieplan)

- **A.** `src/utils/idb.ts` + `src/types/file-system-access.d.ts` + `fileAccess/`-abstractie (3 backends) + `fileHandle` in store/payload-sites + de 6 `fileSlice`-acties omgezet. → open/opslaan/opslaan-als/export werken in alle browsers; build groen.
- **B.** Handle-backed recents (IDB + migratie + `recentFiles`-state + 3 UI-sites + fallback-verbergen).
- **C.** Recovery-backend uit `App.tsx` getrokken + web-IDB-backend + `beforeunload`-guard + multi-tab-scoping.
- **D.** Opruimen (`MenuBar.tsx` weg) + volledige zelf-verificatie.

## 13. Verwerkte review-correcties (traceerbaarheid)

1. FSA-TS-typen toegevoegd (§8) — build-blocker.
2. `fileHandle` op álle payload-sites + invariant (§4.1/4.2).
3. Externe links/`parseExternalSource` Tauri-only; ExternalLinkDialog naar nieuwe entryvorm (§2, §5, §6).
4. `beforeunload` achter `!isTauri()` (§7).
5. Recents als entries (niet paden), async-hydratatie, migratie, 3 UI-sites, fallback verbergen (§6).
6. User-gesture-constraint voor handle-herautorisatie bij recovery (§3.2, §7).
7. Multi-tab-scoping van `ops-recovery` + graceful IDB try/catch (§7, §9).
Plus feitelijke correctie: auto-save mist géén velden (alleen het te verwijderen `MenuBar.tsx`).
