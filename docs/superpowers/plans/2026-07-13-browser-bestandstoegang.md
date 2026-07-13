# Browser-bestandstoegang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De browser-build (nu Tauri-only voor bestand-I/O) laten openen, opslaan, opslaan-als en exporteren met handle-backed recente bestanden en crash-recovery, zonder Rust of nieuwe runtime-dependencies en zonder de desktop-flow te breken.

**Architecture:** Eén nieuwe abstractielaag `src/services/fileAccess/` presenteert een uniforme API (`openFileDialog`/`saveFileDialog`/`saveToRef`/`readFromRef`/`supportsHandles`) met drie backends: Tauri (`plugin-dialog`+`plugin-fs`, huidige logica), Chromium-web (File System Access API met `FileSystemFileHandle`) en fallback-web (`<input type=file>` + blob-download). De store krijgt per document één extra veld `fileHandle` naast `filePath`. Recente bestanden en crash-recovery krijgen elk een web-backend via rauwe IndexedDB (`src/utils/idb.ts`), 1-op-1 met het bestaande recovery-manifest.

**Tech Stack:** File System Access API (ambient d.ts-augmentatie), rauwe IndexedDB (geen wrapper-dep), Zustand + Immer store, Tauri `@tauri-apps/plugin-fs`/`plugin-dialog` (dynamische imports achter `isTauri()`), de bestaande pure `readIFC`/`writeIFC`/CSV/MSPDI/P6-adapters.

---

## Geverifieerde bron-feiten (gecontroleerd tegen de echte code op 2026-07-13)

Regelnummers/signaturen die dit plan hergebruikt zijn geverifieerd:

- **`src/utils/platform.ts:8`** — `export const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;`
- **`src/state/slices/fileSlice.ts`** — 6 acties: `openFile` (`:88`), `saveFile` (`:160`), `saveFileAs` (`:200`), `exportAs` (`:235`), `getRecentFiles` (`:301`), `openRecentFile` (`:359`); plus `parseExternalSource` (`:303`), `refreshExternalAnchorsFrom` (`:322`), `refreshAllExternalAnchors` (`:341`), `openExampleFromString` (`:415`). Recents-helpers: `RECENT_FILES_KEY = 'open-planner-studio-recent-files'` (`:46`), `MAX_RECENT_FILES = 10` (`:47`), `readRecentFiles` (`:49`), `addRecentFile` (`:58`). `parseProjectXml` (`:34`). `isActivePristine` (`:22`). Import `ensureExtension` (`:9`). Import `isTauri` (`:13`).
- **`src/state/slices/documentSlice.ts`** — `DocumentPayload` (`:34`, `filePath` op `:59`, `isDirty` op `:60`), `capturePayload` (`:116`), `normalizeView` (`:147`), `hydratePayload` (`:167`, `filePath` op `:188`), `freshPayload` (`:197`, `filePath` op `:218`), `payloadFromInput` (`:224`, `filePath` op `:246`), `RecoveryDocInput` (`:80`), `getOpenDocuments` (`:347`), `getOpenDocumentPayloads` (`:358`), `restoreDocuments` (`:366`), `documentTitle` (`:251`).
- **`src/state/slices/projectSlice.ts`** — `ProjectSlice` interface `filePath: string | null` (`:35`); initiële state `filePath: null` (`:96`); `newProject` `s.filePath = null` (`:180`); `createNewProject` `s.filePath = null` (`:237`); `setFilePath` (`:242`).
- **`src/state/snapshot.ts`** — `Snapshot` (`:14`) bevat **noch `filePath` noch `fileHandle`**; `createSnapshot` (`:38`) evenmin. **Geen wijziging nodig** — undo/redo kan de handle niet clobberen.
- **`src/state/appStore.ts`** — `create<AppState>()(immer(...))` (`:42`), **geen `persist`-middleware**; `enableMapSet()` (`:21`).
- **`src/App.tsx`** — recovery-constanten `recoveryBase`/`recoveryManifestName`/`legacyRecoveryFile`/`recoveryIfcName` + `RecoveryManifest`-interface (`:19-28`); auto-save-effect (`:282-357`, top-guard `if (!isTauri()) return;` op `:283`; `writeIFC`-velden `:305-317`); recovery-check-effect (`:361-483`, non-Tauri-kortsluiting `:367`, `finish()` `:370`); init-effect (`:156-217`, `void loadAllExtensions()` `:216`); titel-effect (`:270-274`). Import `writeIFC`/`readIFC`/`isTauri`/`documentTitle`/`RecoveryDocInput`/`RecoveryEntry` aanwezig.
- **`src/services/ifc/ifcReader.ts:43`** — `export function readIFC(content: string): ImportResult`.
- **`src/services/ifc/ifcWriter.ts:98,100`** — `export type WriteIFCInput = ImportResult;` en `export function writeIFC(input: WriteIFCInput): string`.
- **`src/services/importTypes.ts:22`** — `ImportResult` kernvelden + optionele `resourceCalendars/activityCodeTypes/customFieldDefs/baselines/activeBaselineId`.
- **`src/extensions/extensionLoader.ts:34-106`** — rauw-IndexedDB-patroon (`indexedDB.open('ops-extensions',1)`, `onupgradeneeded`/`onversionchange`, `getAll`/`put`/`delete` via `IDBTransaction`) dat `src/utils/idb.ts` generaliseert.
- **`src/components/panels/ReportPanel.tsx:134-155`** — bestaande web-blob-download (`new Blob(...)`, `URL.createObjectURL`, `<a download>`, `URL.revokeObjectURL`) als referentie voor de fallback-save.
- **Recents-consumenten:** `src/components/layout/Ribbon/Ribbon.tsx:461-525` (`RecentFilesDropdown`, `getRecentFiles()` `:464`, `openRecentFile(fp)` `:512`), `src/components/backstage/Backstage.tsx:161-195` (`RecentSection`, `:163`/`:164`/`:175-190`), `src/components/dialogs/ExternalLinkDialog.tsx:21-25,30,130-133` (`getRecentFiles` `:21`, `useMemo` `:25`, `useState(recent.length===0)` `:30`, select-map `:132`).
- **`src/components/layout/MenuBar/MenuBar.tsx`** — **nergens geïmporteerd** (grep leeg); map bevat alleen `MenuBar.tsx` (geen css/index). Bevat een onvolledig `writeIFC`-save-pad (footgun).
- **`tsconfig.json`** — `strict`, `noUnusedLocals`, `noUnusedParameters`; `lib: ["ES2020","DOM","DOM.Iterable"]`; `@/*`→`src/*`; `include: ["src"]` (dus een nieuwe `src/types/*.d.ts` wordt automatisch meegenomen).
- **TypeScript 5.9.3 lib.dom.d.ts** (geverifieerd tegen `node_modules/typescript/lib/lib.dom.d.ts`): `FileSystemHandle` (met `kind`/`name`/`isSameEntry`), `FileSystemFileHandle` (met `createWritable`/`getFile`) en `FileSystemWritableFileStream` (met `write(data)`) **bestaan al**. `Window.showOpenFilePicker`/`showSaveFilePicker`, `FileSystemHandle.queryPermission`/`requestPermission` en de picker-optietypes **ontbreken** → ambient augmentatie nodig (Task 1).
- **`__OPS_DEV_INSTANCE__`** — bestaand globaal `define` (gebruikt in `App.tsx:19` zonder import) → herbruikbaar in `recoveryStore.ts` zonder nieuwe declaratie.
- **`generateId(prefix = '')`** in `src/utils/id.ts` — herbruikbaar voor recent/record-id's.
- **`window.__OPS__`** (dev-only, `src/utils/devBridge.ts`) exposeert `store` (Zustand) + `log`; zelf-tests asserten op store-state.

**Sequencing-noot (waarom de fasegrenzen zo liggen):** de recents-datavorm verandert van `string[]` naar `RecentEntry[]` (een breaking store-contract). Daarom worden in **fase A** alleen `openFile`/`saveFile`/`saveFileAs`/`exportAs` omgezet en blijft de localStorage-string-recents-laag tijdelijk staan (alleen gevuld voor Tauri-`path`-refs). **Fase B** vervangt de hele recents-laag én `openRecentFile` én de 3 UI-consumenten in één samenhangende taak (Task 7), zodat de build nooit tussen een verwijderde `getRecentFiles` en niet-aangepaste UI in blijft hangen. `parseExternalSource` blijft in alle fasen Tauri-only (spec §2/§5).

---

## Phase A — fileAccess-abstractie + store-veld + 4 acties

### Task 1: Ambient File System Access-typen

**Files:**
```
Create: src/types/file-system-access.d.ts
```

- [ ] Maak `src/types/file-system-access.d.ts`. Dit bestand heeft **geen** top-level `import`/`export` → het is een globaal script; top-level `interface`-declaraties mergen met de globale scope. Declareer alleen de leden die de rest van dit plan gebruikt (spec §8), zonder de al bestaande lib.dom-typen te herdeclareren:

```ts
// Ambient File System Access API-typen (spec §8).
//
// TypeScript 5.9.3's lib.dom.d.ts kent FileSystemHandle / FileSystemFileHandle /
// FileSystemWritableFileStream al, maar NIET:
//   - Window.showOpenFilePicker / showSaveFilePicker
//   - FileSystemHandle.queryPermission / requestPermission
//   - de picker-optietypes
// Zonder deze augmentatie faalt `npm run build`. We voegen uitsluitend de gebruikte
// leden toe; @types/wicg-file-system-access wordt bewust NIET als dependency gekozen
// (dep-lijst schoon houden). Geen `import`/`export` in dit bestand → globale merge.

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

// Permissie-descriptor voor de FSA-permissie-API (Chromium-only, optioneel).
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

// Augmenteer de bestaande lib.dom-interface (merge, geen herdeclaratie van kind/name/isSameEntry).
interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
```

  De `?`-optionaliteit op `queryPermission`/`requestPermission`/`showOpenFilePicker`/`showSaveFilePicker` is bewust: Firefox/Safari missen ze, dus de code roept ze aan met `?.` of achter een `'showOpenFilePicker' in window`-guard.

- [ ] Run: `npm run build` → verwacht: groen (tsc compileert; het d.ts wordt via `include: ["src"]` meegenomen, geen "duplicate identifier"-fout omdat we bestaande leden niet herdeclareren).

- [ ] Commit:
```bash
git add src/types/file-system-access.d.ts
git commit -m "feat(types): ambient File System Access-typen (showOpen/SaveFilePicker, query/requestPermission)

Fase A van browser-bestandstoegang (spec §8): lib.dom kent de picker- en
permissie-API niet; deze augmentatie voorkomt een build-blocker zonder een
nieuwe @types-dependency.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Gedeeld rauw-IndexedDB-helpertje

**Files:**
```
Create: src/utils/idb.ts
```

Nog geen consument (recents=fase B, recovery=fase C). Ongebruikte **exports** breken `noUnusedLocals` niet (die geldt alleen voor ongebruikte locals/params bínnen een bestand), dus de build blijft groen.

- [ ] Maak `src/utils/idb.ts` — generaliseert het patroon uit `extensionLoader.ts`. Elke DB heeft één object-store met `keyPath: 'id'`. **Alle** toegang in try/catch, zodat een IDB-fout (private-mode/quota) de app nooit blokkeert; consumenten falen dan stil (leeg / geen recovery):

```ts
/**
 * Piepklein rauw-IndexedDB-helpertje (spec §9). Generaliseert het open/get/put/getAll/delete-
 * patroon uit `src/extensions/extensionLoader.ts`. Elke database heeft één object-store met
 * `keyPath: 'id'`. ALLE toegang zit in try/catch: een IDB-fout (private-mode, quota, geblokkeerd)
 * mag de app-start nooit blokkeren — recents/recovery vallen dan stil terug op "leeg".
 */

const dbPromises = new Map<string, Promise<IDBDatabase>>();

function openDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  const cacheKey = `${dbName}::${storeName}`;
  const existing = dbPromises.get(cacheKey);
  if (existing) return existing;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Sluit de verbinding als een andere tab een versie-upgrade wil (voorkomt blocking).
      db.onversionchange = () => {
        db.close();
        dbPromises.delete(cacheKey);
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromises.delete(cacheKey);
      reject(req.error);
    };
  });
  dbPromises.set(cacheKey, p);
  return p;
}

/** Alle records uit de store. Bij een IDB-fout: lege lijst (stil). */
export async function idbGetAll<T>(dbName: string, storeName: string): Promise<T[]> {
  try {
    const db = await openDb(dbName, storeName);
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Eén record op id. Bij een IDB-fout of ontbreken: undefined (stil). */
export async function idbGet<T>(dbName: string, storeName: string, id: string): Promise<T | undefined> {
  try {
    const db = await openDb(dbName, storeName);
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

/** Schrijf/vervang een record (moet een `id`-veld hebben). Faalt stil. */
export async function idbPut(dbName: string, storeName: string, value: { id: string } & Record<string, unknown>): Promise<void> {
  try {
    const db = await openDb(dbName, storeName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* stil falen (spec §10) */
  }
}

/** Verwijder een record op id. Faalt stil. */
export async function idbDelete(dbName: string, storeName: string, id: string): Promise<void> {
  try {
    const db = await openDb(dbName, storeName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* stil falen */
  }
}
```

- [ ] Run: `npm run build` → verwacht: groen.

- [ ] Commit:
```bash
git add src/utils/idb.ts
git commit -m "feat(utils): gedeeld rauw-IndexedDB-helpertje (open/get/put/getAll/delete)

Fase A (spec §9): generaliseert het IDB-patroon uit extensionLoader; alle toegang in
try/catch zodat recents/recovery bij een IDB-fout stil leeg blijven i.p.v. de app te
blokkeren. Nog geen consument — die volgen in fase B (recents) en C (recovery).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: fileAccess-abstractie (index + tauriBackend + webBackend)

**Files:**
```
Create: src/services/fileAccess/index.ts
Create: src/services/fileAccess/tauriBackend.ts
Create: src/services/fileAccess/webBackend.ts
```

De drie bestanden zijn onderling afhankelijk (backends `import type` uit `index`; `index` importeert de backend-functies als waarde). Ze worden in één taak gemaakt zodat de build pas aan het eind groen hoeft te zijn. Belangrijk: `tauriBackend.ts` importeert `@tauri-apps/*` **uitsluitend dynamisch bínnen functies** en op top-level alleen de pure `ensureExtension`-util — zo is het module veilig te laden in de web-build.

- [ ] Maak `src/services/fileAccess/index.ts` — publieke typen + API + backend-keuze + `supportsHandles`:

```ts
import { isTauri } from '@/utils/platform';
import {
  openFileDialogTauri, saveFileDialogTauri, saveToRefTauri, readFromRefTauri,
} from './tauriBackend';
import {
  openFileDialogWeb, saveFileDialogWeb, saveToRefWeb, readFromRefWeb,
} from './webBackend';

/** Bestandsfilter (naam + extensies zonder punt), zoals de bestaande dialoog-aanroepen. */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * Opake verwijzing naar een bestand als opslaan-doel (spec §3.1).
 * - `path`   : Tauri — echt OS-pad; herbruikbaar voor in-place opslaan.
 * - `handle` : Chromium-web — FileSystemFileHandle; herbruikbaar voor in-place opslaan.
 * Fallback-web (Firefox/Safari) heeft geen herbruikbare ref → `null`.
 */
export type FileRef =
  | { kind: 'path'; path: string }
  | { kind: 'handle'; handle: FileSystemFileHandle };

export interface OpenedFile {
  name: string;
  content: string;
  ref: FileRef | null;
}

export interface SaveOutcome {
  ref: FileRef | null;
  name: string;
}

/** Capability-vlag voor UI-beslissingen (recents tonen/verbergen). */
export function supportsHandles(): boolean {
  return isTauri() || (typeof window !== 'undefined' && 'showOpenFilePicker' in window);
}

/** Openen via picker/input. `null` = geannuleerd. */
export function openFileDialog(filters: FileFilter[]): Promise<OpenedFile | null> {
  return isTauri() ? openFileDialogTauri(filters) : openFileDialogWeb(filters);
}

/** Opslaan-als / export via picker. `null` = geannuleerd. */
export function saveFileDialog(defaultName: string, content: string, filters: FileFilter[]): Promise<SaveOutcome | null> {
  return isTauri() ? saveFileDialogTauri(defaultName, content, filters) : saveFileDialogWeb(defaultName, content, filters);
}

/** In-place opslaan naar een bestaande ref. `false` als onmogelijk (fallback-web of geweigerde
 *  permissie) → de aanroeper valt terug op `saveFileDialog`. */
export function saveToRef(ref: FileRef, content: string): Promise<boolean> {
  return isTauri() ? saveToRefTauri(ref, content) : saveToRefWeb(ref, content);
}

/** Inhoud van een bewaarde ref herlezen (recents heropenen). `null` bij fout/geweigerd. */
export function readFromRef(ref: FileRef): Promise<string | null> {
  return isTauri() ? readFromRefTauri(ref) : readFromRefWeb(ref);
}
```

- [ ] Maak `src/services/fileAccess/tauriBackend.ts` — exact de huidige Tauri-logica, verpakt in de abstractie. `FileRef.kind === 'path'` draagt het **volledige** OS-pad (identiteit voor in-place opslaan én titel); `name` is de basename:

```ts
import type { FileFilter, FileRef, OpenedFile, SaveOutcome } from './index';
import { ensureExtension } from '@/utils/filePath';

const basename = (p: string): string => p.split(/[\\/]/).pop() || p;

export async function openFileDialogTauri(filters: FileFilter[]): Promise<OpenedFile | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const selected = await open({ multiple: false, filters });
  if (!selected) return null;
  const path = selected as string;
  const content = await readTextFile(path);
  return { name: basename(path), content, ref: { kind: 'path', path } };
}

export async function saveFileDialogTauri(defaultName: string, content: string, filters: FileFilter[]): Promise<SaveOutcome | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const picked = await save({ defaultPath: defaultName, filters });
  if (!picked) return null;
  // Linux/GTK plakt de filter-extensie niet automatisch → normaliseren (net als de oude code).
  const ext = filters[0]?.extensions[0] ?? '';
  const savedPath = ext ? ensureExtension(picked, ext) : picked;
  await writeTextFile(savedPath, content);
  return { ref: { kind: 'path', path: savedPath }, name: basename(savedPath) };
}

export async function saveToRefTauri(ref: FileRef, content: string): Promise<boolean> {
  if (ref.kind !== 'path') return false;
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(ref.path, content);
  return true;
}

export async function readFromRefTauri(ref: FileRef): Promise<string | null> {
  if (ref.kind !== 'path') return null;
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    return await readTextFile(ref.path);
  } catch {
    return null;
  }
}
```

- [ ] Maak `src/services/fileAccess/webBackend.ts` — FSA (Chromium) + fallback (`<input>`/blob), met de capability-switch binnenin. Web-`FileRef.kind === 'handle'`; `filePath` in de store wordt dan de **bestandsnaam** (spec §4-invariant). Annuleren van picker/input → `null`:

```ts
import type { FileFilter, FileRef, OpenedFile, SaveOutcome } from './index';

const hasFSA = (): boolean => typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/** Onze FileFilter[] → de picker `types`-vorm (accept: MIME → extensies met punt). */
function toAcceptTypes(filters: FileFilter[]): FilePickerAcceptType[] {
  return filters.map((f) => ({
    description: f.name,
    accept: { 'application/octet-stream': f.extensions.map((e) => `.${e}`) },
  }));
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

// ---- Fallback (Firefox/Safari): <input type=file> + blob-download ----

function openViaInput(filters: FileFilter[]): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const content = await file.text();
      resolve({ name: file.name, content, ref: null });
    };
    input.click();
  });
}

function downloadBlob(name: string, content: string): void {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Publieke web-backend ----

export async function openFileDialogWeb(filters: FileFilter[]): Promise<OpenedFile | null> {
  if (hasFSA()) {
    try {
      const [handle] = await window.showOpenFilePicker!({ multiple: false, types: toAcceptTypes(filters) });
      const file = await handle.getFile();
      const content = await file.text();
      return { name: file.name, content, ref: { kind: 'handle', handle } };
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }
  return openViaInput(filters);
}

export async function saveFileDialogWeb(defaultName: string, content: string, filters: FileFilter[]): Promise<SaveOutcome | null> {
  if (hasFSA()) {
    try {
      const handle = await window.showSaveFilePicker!({ suggestedName: defaultName, types: toAcceptTypes(filters) });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      const file = await handle.getFile();
      return { ref: { kind: 'handle', handle }, name: file.name };
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }
  // Fallback: download; geen herbruikbare ref.
  downloadBlob(defaultName, content);
  return { ref: null, name: defaultName };
}

export async function saveToRefWeb(ref: FileRef, content: string): Promise<boolean> {
  if (ref.kind !== 'handle') return false;
  const { handle } = ref;
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
  // In-place opslaan vereist readwrite; showOpenFilePicker geeft alleen read (spec §3.2).
  try {
    if ((await handle.queryPermission?.(opts)) !== 'granted') {
      if ((await handle.requestPermission?.(opts)) !== 'granted') return false;
    }
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function readFromRefWeb(ref: FileRef): Promise<string | null> {
  if (ref.kind !== 'handle') return null;
  const { handle } = ref;
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  try {
    if ((await handle.queryPermission?.(opts)) !== 'granted') {
      if ((await handle.requestPermission?.(opts)) !== 'granted') return null;
    }
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}
```

- [ ] Run: `npm run build` → verwacht: groen. Let op ongebruikte imports: `index.ts` gebruikt alle geïmporteerde backend-functies; backends gebruiken alle `import type`-leden.

- [ ] Self-test (browser dev-build, poort 3007): laad de app en evalueer in de pagina dat de web-backend en `supportsHandles` correct laden via de Vite-modulegraaf:
```js
// via preview_eval / browser_evaluate:
(async () => {
  const m = await import('/src/services/fileAccess/index.ts');
  return { supportsHandles: m.supportsHandles(), hasFSA: 'showOpenFilePicker' in window };
})()
// Verwacht in Chromium: { supportsHandles: true, hasFSA: true }.
```

- [ ] Commit:
```bash
git add src/services/fileAccess/
git commit -m "feat(fileAccess): uniforme bestand-I/O-abstractie met 3 backends

Fase A (spec §3): openFileDialog/saveFileDialog/saveToRef/readFromRef/supportsHandles
met Tauri- (plugin-dialog+fs), Chromium-web- (File System Access) en fallback-web-backend
(input+blob). tauriBackend importeert @tauri-apps uitsluitend dynamisch → veilig in de
web-build. Nog niet bedraad in fileSlice (volgende taak).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `fileHandle` naast `filePath` op alle store-/payload-sites

**Files:**
```
Modify: src/state/slices/projectSlice.ts:35, :96, :180, :237
Modify: src/state/slices/documentSlice.ts:59, :137, :188, :218, :246
```

`fileHandle: FileSystemFileHandle | null` moet consistent op **elke** swap/reset-site (spec §4.2), anders latente bug. `FileSystemFileHandle` is globaal beschikbaar (lib.dom) → geen import nodig. Invariant documenteren: `filePath` = identiteit/titel; `fileHandle` = alleen web-opslaan-doel.

- [ ] `projectSlice.ts` — voeg het veld toe aan de `ProjectSlice`-interface direct onder `filePath: string | null;` (`:35`):
```ts
  filePath: string | null;
  /** Web-opslaan-doel (spec §4). ALLEEN het FSA-opslaan-doel — nooit voor identiteit/titel;
   *  die blijven bij `filePath` (echt pad in Tauri, bestandsnaam in web). `null` in Tauri/fallback-web. */
  fileHandle: FileSystemFileHandle | null;
```

- [ ] `projectSlice.ts` — initiële state onder `filePath: null,` (`:96`):
```ts
  filePath: null,
  fileHandle: null,
```

- [ ] `projectSlice.ts` — `newProject`, direct onder `s.filePath = null;` (`:180`):
```ts
      s.filePath = null;
      s.fileHandle = null;
```

- [ ] `projectSlice.ts` — `createNewProject`, direct onder `s.filePath = null;` (`:237`):
```ts
      s.filePath = null;
      s.fileHandle = null;
```

- [ ] `documentSlice.ts` — voeg toe aan de `DocumentPayload`-interface direct onder `filePath: string | null;` (`:59`):
```ts
  filePath: string | null;
  /** Web-opslaan-doel (spec §4). Alleen FSA; nooit identiteit/titel. */
  fileHandle: FileSystemFileHandle | null;
```

- [ ] `documentSlice.ts` — `capturePayload`, direct onder `filePath: s.filePath,` (`:137`):
```ts
    filePath: s.filePath,
    fileHandle: s.fileHandle,
```

- [ ] `documentSlice.ts` — `hydratePayload`, direct onder `s.filePath = p.filePath;` (`:188`). `?? null` voor oude payloads/recovery zonder het veld:
```ts
  s.filePath = p.filePath;
  s.fileHandle = p.fileHandle ?? null;
```

- [ ] `documentSlice.ts` — `freshPayload`, direct onder `filePath: null,` (`:218`):
```ts
    filePath: null,
    fileHandle: null,
```

- [ ] `documentSlice.ts` — `payloadFromInput`, direct onder `filePath: d.filePath,` (`:246`). Recovery draagt **nooit** een handle mee (spec §7 user-gesture) → altijd `null`; een herstelde web-doc valt terug op opslaan-als:
```ts
    filePath: d.filePath,
    fileHandle: null,
```

- [ ] Bevestig (geen wijziging): `src/state/snapshot.ts` bevat `fileHandle` niet en hoeft dat niet — undo/redo mag de handle niet clobberen (spec §4.1). `getOpenDocuments`/`getOpenDocumentPayloads` hebben geen aparte `fileHandle`-behandeling nodig (titel komt uit `filePath`; `capturePayload` neemt de handle al mee). `RecoveryDocInput` krijgt géén `fileHandle`.

- [ ] Run: `npm run build` → verwacht: groen (elke `DocumentPayload`-constructiesite levert nu `fileHandle`; tsc dwingt volledigheid af, dus een vergeten site faalt hier zichtbaar).

- [ ] Self-test (browser dev-build): verifieer dat `fileHandle` door de document-swap round-trip't en bij `newProject` reset:
```js
(() => {
  const s = window.__OPS__.store;
  const fake = { name: 'demo.ifc' }; // opake stand-in voor een echte handle
  s.setState({ fileHandle: fake });
  const firstId = s.getState().activeDocumentId;
  s.getState().newDocument();                 // capture eerste doc, hydrate verse
  const afterNew = s.getState().fileHandle;   // moet null zijn (verse payload)
  s.getState().switchDocument(firstId);       // terug → payload gehydrateerd
  const afterBack = s.getState().fileHandle;  // moet weer `fake` zijn
  s.getState().newProject();                  // reset
  const afterReset = s.getState().fileHandle; // moet null zijn
  return { afterNew, roundTripped: afterBack === fake, afterReset };
})()
// Verwacht: { afterNew: null, roundTripped: true, afterReset: null }.
```

- [ ] Commit:
```bash
git add src/state/slices/projectSlice.ts src/state/slices/documentSlice.ts
git commit -m "feat(state): fileHandle naast filePath op alle document-swap/reset-sites

Fase A (spec §4): per document één extra veld fileHandle (web-opslaan-doel, nooit identiteit).
Consistent gezet in capture/hydrate/fresh/payloadFromInput + newProject/createNewProject.
Snapshot blijft ongewijzigd (undo/redo mag de handle niet clobberen).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `openFile`/`saveFile`/`saveFileAs`/`exportAs` op de abstractie

**Files:**
```
Modify: src/state/slices/fileSlice.ts (imports :1-18; :88-158 openFile; :160-198 saveFile; :200-233 saveFileAs; :235-299 exportAs)
```

De vier acties verliezen `if (!isTauri()) return` en hun directe `@tauri-apps/*`-imports; ze gaan door de abstractie. De extensie-routing (IFC/CSV/XML), `runCPM()`, `requestFitToProject()`, `emit('projectLoaded')` en dirty-handling blijven identiek. `filePath` wordt gezet uit de ref (`path` → volledig pad; `handle`/fallback → bestandsnaam) en `fileHandle` navenant. Recents blijven in deze fase de bestaande localStorage-string-laag — alleen gevuld voor `path`-refs (Tauri). `openRecentFile` en `parseExternalSource` blijven ongewijzigd in deze taak (fase B resp. Tauri-only).

- [ ] `fileSlice.ts` — imports: **verwijder** `import { ensureExtension } from '@/utils/filePath';` (`:9`, wordt ongebruikt → zou `noUnusedLocals` breken) en voeg de abstractie-import toe. `import { isTauri }` (`:13`) blijft (nog gebruikt door `parseExternalSource`/`openRecentFile`). Voeg toe bij de imports:
```ts
import { openFileDialog, saveFileDialog, saveToRef, type FileRef } from '@/services/fileAccess';
```

- [ ] `fileSlice.ts` — vervang de **hele** `openFile`-actie (`:88-158`) door:
```ts
  openFile: async () => {
    const opened = await openFileDialog([
      { name: 'All Supported', extensions: ['ifc', 'csv', 'xml'] },
      { name: 'IFC Files', extensions: ['ifc'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'XML Files', extensions: ['xml'] },
    ]);
    if (!opened) return;
    try {
      const ext = opened.name.split('.').pop()?.toLowerCase() || '';
      let parsed: ImportResult;

      if (ext === 'csv') {
        parsed = readCSV(opened.content);
      } else if (ext === 'xml') {
        parsed = parseProjectXml(opened.content);
      } else {
        parsed = readIFC(opened.content);
      }

      // Multi-document: open het bestand in een eigen tabblad. Hergebruik het
      // actieve tabblad alleen als dat nog leeg en ongewijzigd is.
      if (!isActivePristine(get())) get().newDocument();

      set((s) => {
        s.project = parsed.project;
        s.calendar = parsed.calendar;
        s.tasks = parsed.tasks;
        s.sequences = parsed.sequences;
        s.resources = parsed.resources;
        s.assignments = parsed.assignments;
        s.calendars = parsed.resourceCalendars ?? [];
        // §4.3-migratie: bestand zonder bibliotheek-entry voor zijn projectkalender krijgt de eerste.
        promoteProjectCalendarToLibrary(s);
        // Uur-data-melding (§6.8): bevat het bestand urenplanning terwijl de hoofdschakelaar uit
        // staat, toon de niet-blokkerende melding — nooit stil wegronden (de engine rekent sowieso).
        s.ui.hourDataNotice = !s.ui.enableHourPlanning && fileHasHourData(s.tasks, [s.calendar, ...s.calendars]);
        // Baselines (fase 2.6, §8.3): IFC/MSPDI leveren ze; CSV/P6 niet (dan leeg).
        s.baselines = parsed.baselines ?? [];
        s.activeBaselineId = parsed.activeBaselineId ?? null;
        s.selectedTaskIds = [];
        s.cpmResult = null;
        s.resourceLoadResult = null;
        s.scheduleStale = false;
        s.undoStack = [];
        s.redoStack = [];
        s.isDirty = false;
        // Identiteit: echt pad (Tauri) of bestandsnaam (web); handle alleen als web-opslaan-doel.
        s.filePath = opened.ref?.kind === 'path' ? opened.ref.path : opened.name;
        s.fileHandle = opened.ref?.kind === 'handle' ? opened.ref.handle : null;
      });
      // Na een IFC-load meteen doorrekenen (CLAUDE.md "after an IFC load"), consistent met de
      // IFCPanel-plakroute — anders blijven statusbalk/histogram leeg tot de gebruiker F5 drukt (A5).
      get().runCPM();
      get().requestFitToProject(); // Issue #16: open het canvas met het HELE project in beeld.
      emitExtensionEvent(HOST_EVENTS.projectLoaded, {
        tasks: parsed.tasks.length,
        sequences: parsed.sequences.length,
        resources: parsed.resources.length,
      });
      // Recents (fase A): alleen Tauri-paden; web-handle-recents volgen in fase B.
      if (opened.ref?.kind === 'path') addRecentFile(opened.ref.path);
    } catch (err) {
      console.error('Failed to parse file:', err);
    }
  },
```

- [ ] `fileSlice.ts` — vervang de **hele** `saveFile`-actie (`:160-198`) door. In-place opslaan als er een bruikbare ref is (web-handle of Tauri-pad); anders opslaan-als:
```ts
  saveFile: async () => {
    const state = get();
    const content = writeIFC({
      project: state.project,
      calendar: state.calendar,
      tasks: state.tasks,
      sequences: state.sequences,
      resources: state.resources,
      assignments: state.assignments,
      activityCodeTypes: state.activityCodeTypes,
      customFieldDefs: state.customFieldDefs,
      resourceCalendars: state.calendars,
      baselines: state.baselines,
      activeBaselineId: state.activeBaselineId,
    });

    // Bestaand opslaan-doel? Web: fileHandle. Tauri: het echte pad in filePath.
    const ref: FileRef | null = state.fileHandle
      ? { kind: 'handle', handle: state.fileHandle }
      : (isTauri() && state.filePath ? { kind: 'path', path: state.filePath } : null);

    if (ref && await saveToRef(ref, content)) {
      set((s) => { s.isDirty = false; });
      return;
    }

    // Geen (bruikbare) ref, of in-place opslaan geweigerd → opslaan-als.
    const outcome = await saveFileDialog(
      `${state.project.name || 'project'}.ifc`,
      content,
      [{ name: 'IFC Files', extensions: ['ifc'] }],
    );
    if (!outcome) return;
    set((s) => {
      s.filePath = outcome.ref?.kind === 'path' ? outcome.ref.path : outcome.name;
      s.fileHandle = outcome.ref?.kind === 'handle' ? outcome.ref.handle : null;
      s.isDirty = false;
    });
    if (outcome.ref?.kind === 'path') addRecentFile(outcome.ref.path);
  },
```

- [ ] `fileSlice.ts` — vervang de **hele** `saveFileAs`-actie (`:200-233`) door:
```ts
  saveFileAs: async () => {
    const state = get();
    const content = writeIFC({
      project: state.project,
      calendar: state.calendar,
      tasks: state.tasks,
      sequences: state.sequences,
      resources: state.resources,
      assignments: state.assignments,
      activityCodeTypes: state.activityCodeTypes,
      customFieldDefs: state.customFieldDefs,
      resourceCalendars: state.calendars,
      baselines: state.baselines,
      activeBaselineId: state.activeBaselineId,
    });

    const outcome = await saveFileDialog(
      state.filePath ?? `${state.project.name || 'project'}.ifc`,
      content,
      [{ name: 'IFC Files', extensions: ['ifc'] }],
    );
    if (!outcome) return;
    set((s) => {
      s.filePath = outcome.ref?.kind === 'path' ? outcome.ref.path : outcome.name;
      s.fileHandle = outcome.ref?.kind === 'handle' ? outcome.ref.handle : null;
      s.isDirty = false;
    });
    if (outcome.ref?.kind === 'path') addRecentFile(outcome.ref.path);
  },
```

- [ ] `fileSlice.ts` — vervang de **hele** `exportAs`-actie (`:235-299`) door. Export raakt `filePath`/`fileHandle`/`isDirty` niet aan (huidig gedrag); de content-/filter-opbouw per formaat blijft gelijk, alleen de save-dialoog gaat door de abstractie:
```ts
  exportAs: async (format: ExportFormat) => {
    const state = get();

    let content: string;
    let ext: string;
    let filters: { name: string; extensions: string[] }[];

    switch (format) {
      case 'csv':
        content = writeCSV(
          state.project, state.calendar, state.tasks,
          state.sequences, state.resources, state.assignments,
        );
        ext = 'csv';
        filters = [{ name: 'CSV Files', extensions: ['csv'] }];
        break;
      case 'mspdi':
        content = writeMSPDI(
          state.project, state.calendar, state.tasks,
          state.sequences, state.resources, state.assignments, state.calendars,
        );
        ext = 'xml';
        filters = [{ name: 'XML Files', extensions: ['xml'] }];
        break;
      case 'p6':
        content = writeP6XML(
          state.project, state.calendar, state.tasks,
          state.sequences, state.resources, state.assignments, state.calendars,
        );
        ext = 'xml';
        filters = [{ name: 'XML Files', extensions: ['xml'] }];
        break;
      case 'ifc':
      default:
        content = writeIFC({
          project: state.project,
          calendar: state.calendar,
          tasks: state.tasks,
          sequences: state.sequences,
          resources: state.resources,
          assignments: state.assignments,
          activityCodeTypes: state.activityCodeTypes,
          customFieldDefs: state.customFieldDefs,
          resourceCalendars: state.calendars,
          baselines: state.baselines,
          activeBaselineId: state.activeBaselineId,
        });
        ext = 'ifc';
        filters = [{ name: 'IFC Files', extensions: ['ifc'] }];
        break;
    }

    const outcome = await saveFileDialog(`${state.project.name || 'project'}.${ext}`, content, filters);
    if (outcome?.ref?.kind === 'path') addRecentFile(outcome.ref.path);
  },
```

- [ ] Bevestig (geen wijziging in deze taak): `getRecentFiles` (`:301`), `parseExternalSource` (`:303`), `refreshExternalAnchorsFrom` (`:322`), `refreshAllExternalAnchors` (`:341`), `openRecentFile` (`:359`), `openExampleFromString` (`:415`) en de recents-helpers `readRecentFiles`/`addRecentFile`/`RECENT_FILES_KEY`/`MAX_RECENT_FILES` blijven staan. `addRecentFile` blijft gebruikt (Tauri-paden hierboven); `ExportFormat` blijft geëxporteerd.

- [ ] Run: `npm run build` → verwacht: groen. Controleer expliciet: `ensureExtension`-import verwijderd (anders "declared but never read"); `isTauri` nog gebruikt; `writeCSV/writeMSPDI/writeP6XML/readCSV/readIFC/parseProjectXml` nog gebruikt.

- [ ] Self-test (browser dev-build, Chromium): de FSA-picker zelf is een native OS-dialoog die automation niet kan aanklikken (spec §11) — test daarom de **fallback-save-download** en de store-wiring rechtstreeks. Verifieer dat `saveFile` zonder ref de download-tak neemt en `isDirty` op false zet:
```js
(async () => {
  const s = window.__OPS__.store;
  // Forceer de fallback-download-tak: geen handle, geen Tauri-pad.
  s.setState({ fileHandle: null, filePath: null, isDirty: true });
  // Onderschep de download zodat de test geen bestand naar Downloads schrijft.
  const origCreate = document.createElement.bind(document);
  let downloaded = null;
  document.createElement = (tag) => {
    const el = origCreate(tag);
    if (tag === 'a') { el.click = () => { downloaded = el.download; }; }
    return el;
  };
  // Duw de web-backend naar fallback (geen FSA) voor deze test:
  const hadFSA = 'showOpenFilePicker' in window;
  const desc = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');
  delete window.showOpenFilePicker;
  await s.getState().saveFile();
  document.createElement = origCreate;
  if (hadFSA && desc) Object.defineProperty(window, 'showOpenFilePicker', desc);
  return { downloaded, isDirty: s.getState().isDirty };
})()
// Verwacht: { downloaded: /project.*\.ifc/, isDirty: false } — fallback-download markeert niet-dirty.
```

- [ ] Commit:
```bash
git add src/state/slices/fileSlice.ts
git commit -m "feat(file): openen/opslaan/opslaan-als/exporteren via de fileAccess-abstractie

Fase A (spec §5): de 4 kern-acties verliezen de isTauri-no-op-guard en gaan door
openFileDialog/saveFileDialog/saveToRef. filePath = echt pad (Tauri) of bestandsnaam (web),
fileHandle = web-opslaan-doel. Recents blijven tijdelijk de localStorage-string-laag (alleen
Tauri-paden); web-handle-recents volgen in fase B. openen/opslaan werken nu in alle browsers.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase B — handle-backed recente bestanden

### Task 6: recentFiles-service (RecentEntry + IDB + migratie)

**Files:**
```
Create: src/services/fileAccess/recentFiles.ts
```

Nog geen consument (die volgt in Task 7) → build groen ondanks ongebruikte exports.

- [ ] Maak `src/services/fileAccess/recentFiles.ts`:
```ts
import type { FileRef } from './index';
import { idbGetAll, idbPut, idbDelete } from '@/utils/idb';
import { generateId } from '@/utils/id';

/** Recent-bestand-entry (spec §6). `ref` is herbruikbaar (Tauri-pad of Chromium-handle). */
export interface RecentEntry {
  id: string;
  name: string;
  ref: FileRef;
  addedAt: number;
}

const DB = 'ops-recent-files';
const STORE = 'recents';
const MAX = 10;
const LEGACY_KEY = 'open-planner-studio-recent-files';

const basename = (p: string): string => p.split(/[\\/]/).pop() || p;

/** Ref-identiteit voor dedupe: paden op string, handles op isSameEntry. */
async function sameRef(a: FileRef, b: FileRef): Promise<boolean> {
  if (a.kind === 'path' && b.kind === 'path') return a.path === b.path;
  if (a.kind === 'handle' && b.kind === 'handle') {
    try { return await a.handle.isSameEntry(b.handle); } catch { return false; }
  }
  return false;
}

/** Eenmalige migratie van de oude localStorage-padlijst → IDB-entries. Idempotent: na migratie
 *  wordt de legacy-sleutel verwijderd zodat dit niet opnieuw draait. */
async function migrateLegacy(existing: RecentEntry[]): Promise<RecentEntry[]> {
  if (existing.length > 0) return existing; // al IDB-data → niets te migreren
  let paths: string[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    paths = raw ? JSON.parse(raw) : [];
  } catch {
    paths = [];
  }
  if (!Array.isArray(paths) || paths.length === 0) return existing;
  const now = Date.now();
  const migrated: RecentEntry[] = paths.slice(0, MAX).map((p, i) => ({
    id: generateId('recent'),
    name: basename(p),
    ref: { kind: 'path', path: p },
    addedAt: now - i, // bewaar MRU-volgorde
  }));
  for (const e of migrated) await idbPut(DB, STORE, e);
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* geen localStorage — negeren */ }
  return migrated;
}

/** Lees de recents (MRU-gesorteerd), migreert eenmalig de oude localStorage-lijst. */
export async function loadRecents(): Promise<RecentEntry[]> {
  const all = await idbGetAll<RecentEntry>(DB, STORE);
  const migrated = await migrateLegacy(all);
  return [...migrated].sort((a, b) => b.addedAt - a.addedAt).slice(0, MAX);
}

/** Voeg een bestand toe (MRU, dedupe op ref-identiteit, cap op MAX). Geeft de nieuwe lijst terug. */
export async function addRecent(ref: FileRef, name: string): Promise<RecentEntry[]> {
  const existing = await loadRecents();
  const kept: RecentEntry[] = [];
  for (const e of existing) {
    if (!(await sameRef(e.ref, ref))) kept.push(e);
  }
  const entry: RecentEntry = { id: generateId('recent'), name, ref, addedAt: Date.now() };
  const next = [entry, ...kept].slice(0, MAX);

  // Persisteer: nieuwe entry erin, verdrongen/gededupte entries eruit.
  await idbPut(DB, STORE, entry);
  const nextIds = new Set(next.map((e) => e.id));
  for (const e of existing) {
    if (!nextIds.has(e.id)) await idbDelete(DB, STORE, e.id);
  }
  return next;
}

/** Verwijder één entry (verdwenen/geweigerd bestand). Geeft de nieuwe lijst terug. */
export async function removeRecent(id: string): Promise<RecentEntry[]> {
  await idbDelete(DB, STORE, id);
  return loadRecents();
}
```

- [ ] Run: `npm run build` → verwacht: groen.

- [ ] Commit:
```bash
git add src/services/fileAccess/recentFiles.ts
git commit -m "feat(recents): handle-backed recente bestanden in IndexedDB + legacy-migratie

Fase B (spec §6): RecentEntry{id,name,ref,addedAt} in IDB 'ops-recent-files'; MRU, dedupe op
ref-identiteit (isSameEntry voor handles), cap 10; eenmalige migratie van de oude
localStorage-padlijst. Nog niet bedraad (volgende taak).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: fileSlice-recents omzetten + `openRecentFile` + 3 UI-consumenten

**Files:**
```
Modify: src/state/slices/fileSlice.ts (imports; :46-63 helpers/constanten; :65-85 interface; :301 getRecentFiles; :359-413 openRecentFile; recent-add-sites in openFile/saveFile/saveFileAs/exportAs)
Modify: src/App.tsx (init-effect :156-217)
Modify: src/components/layout/Ribbon/Ribbon.tsx:461-525
Modify: src/components/backstage/Backstage.tsx:161-195
Modify: src/components/dialogs/ExternalLinkDialog.tsx:1-55, :112-146
```

Dit is één samenhangende contract-wijziging (`string[]` → `RecentEntry[]`): de store-state, `openRecentFile(id)`, en de 3 UI-consumenten worden samen omgezet zodat de build pas aan het eind groen hoeft. Recents-UI wordt verborgen als `!supportsHandles()` (spec §6, "geen dode klikbare items").

- [ ] `fileSlice.ts` — imports: verwijder de localStorage-recents-helpers en voeg de service-import toe. Vervang het blok `:45-63` (`// ---- Recente bestanden (localStorage) ----` t/m de sluitende `}` van `addRecentFile`) volledig door **niets** (weg), en voeg bij de imports toe:
```ts
import { openFileDialog, saveFileDialog, saveToRef, readFromRef, type FileRef } from '@/services/fileAccess';
import { loadRecents, addRecent, removeRecent, type RecentEntry } from '@/services/fileAccess/recentFiles';
```
  (De regel uit Task 5 `import { openFileDialog, saveFileDialog, saveToRef, type FileRef } ...` wordt door de eerste regel hierboven vervangen — `readFromRef` erbij.)

- [ ] `fileSlice.ts` — `FileSlice`-interface (`:65-85`): vervang `getRecentFiles: () => string[];` (`:70`) en pas `openRecentFile` (`:71`) aan; voeg state + hydrate toe:
```ts
  /** App-globale MRU-lijst van recente bestanden (spec §6). Async gehydrateerd bij opstart. */
  recentFiles: RecentEntry[];
  /** Lees de recents uit IndexedDB (met eenmalige localStorage-migratie) in de store. */
  hydrateRecentFiles: () => Promise<void>;
```
  en wijzig de `openRecentFile`-signatuur naar id:
```ts
  openRecentFile: (id: string) => Promise<void>;
```
  (Verwijder de `getRecentFiles`-regel volledig.)

- [ ] `fileSlice.ts` — initiële state van de slice-creator: voeg `recentFiles: []` toe en verwijder de `getRecentFiles: () => readRecentFiles(),`-regel (`:301`). Voeg de hydrate-actie toe (bv. vlak vóór `openRecentFile`):
```ts
  recentFiles: [],

  hydrateRecentFiles: async () => {
    const list = await loadRecents();
    set((s) => { s.recentFiles = list; });
  },
```

- [ ] `fileSlice.ts` — vervang in `openFile`/`saveFile`/`saveFileAs`/`exportAs` elke regel `if (opened.ref?.kind === 'path') addRecentFile(opened.ref.path);` resp. `if (outcome.ref?.kind === 'path') addRecentFile(outcome.ref.path);` / `if (outcome?.ref?.kind === 'path') addRecentFile(outcome.ref.path);` door een aanroep die **elke** herbruikbare ref (pad én handle) toevoegt en de store bijwerkt. Definieer bovenaan de slice-creator één helper en gebruik die:
```ts
  // Voeg een geopend/opgeslagen bestand toe aan de recents (elke herbruikbare ref).
  const pushRecent = async (ref: FileRef | null, name: string) => {
    if (!ref) return; // fallback-web: geen herbruikbare ref → niet aan recents (spec §6)
    const list = await addRecent(ref, name);
    set((s) => { s.recentFiles = list; });
  };
```
  en in de vier acties:
  - `openFile`: `await pushRecent(opened.ref, opened.name);`
  - `saveFile` (opslaan-als-tak): `await pushRecent(outcome.ref, outcome.name);`
  - `saveFileAs`: `await pushRecent(outcome.ref, outcome.name);`
  - `exportAs`: `await pushRecent(outcome?.ref ?? null, outcome?.name ?? '');`

  > Let op: `createFileSlice: AppSlice<FileSlice> = (set, get) => ({ ... })` gebruikt een object-body. Een lokale `const pushRecent` kan niet binnen het object-literal staan. Zet daarom de helper **binnen elke actie** als kleine inline-aanroep, óf herstructureer de slice-creator naar een block-body: `= (set, get) => { const pushRecent = ...; return ({ ...acties... }); }`. Kies de block-body-variant (één keer, netjes) — zo staat `pushRecent` één keer gedefinieerd.

- [ ] `fileSlice.ts` — vervang de **hele** `openRecentFile`-actie (`:359-413`) door de id-variant die via `readFromRef` leest en verdwenen/geweigerde entries opruimt:
```ts
  openRecentFile: async (id: string) => {
    const entry = get().recentFiles.find((e) => e.id === id);
    if (!entry) return;
    const content = await readFromRef(entry.ref);
    if (content === null) {
      // Geweigerd of verdwenen → entry stil verwijderen.
      const list = await removeRecent(entry.id);
      set((s) => { s.recentFiles = list; });
      return;
    }
    try {
      const ext = entry.name.split('.').pop()?.toLowerCase() || '';
      let parsed: ImportResult;

      if (ext === 'csv') {
        parsed = readCSV(content);
      } else if (ext === 'xml') {
        parsed = parseProjectXml(content);
      } else {
        parsed = readIFC(content);
      }

      if (!isActivePristine(get())) get().newDocument();

      set((s) => {
        s.project = parsed.project;
        s.calendar = parsed.calendar;
        s.tasks = parsed.tasks;
        s.sequences = parsed.sequences;
        s.resources = parsed.resources;
        s.assignments = parsed.assignments;
        s.calendars = parsed.resourceCalendars ?? [];
        promoteProjectCalendarToLibrary(s);
        s.ui.hourDataNotice = !s.ui.enableHourPlanning && fileHasHourData(s.tasks, [s.calendar, ...s.calendars]);
        s.baselines = parsed.baselines ?? [];
        s.activeBaselineId = parsed.activeBaselineId ?? null;
        s.selectedTaskIds = [];
        s.cpmResult = null;
        s.resourceLoadResult = null;
        s.scheduleStale = false;
        s.undoStack = [];
        s.redoStack = [];
        s.isDirty = false;
        s.filePath = entry.ref.kind === 'path' ? entry.ref.path : entry.name;
        s.fileHandle = entry.ref.kind === 'handle' ? entry.ref.handle : null;
      });
      get().runCPM();
      get().requestFitToProject();
      emitExtensionEvent(HOST_EVENTS.projectLoaded, {
        tasks: parsed.tasks.length,
        sequences: parsed.sequences.length,
        resources: parsed.resources.length,
      });
      // MRU verversen: het net-geopende bestand naar boven.
      const list = await addRecent(entry.ref, entry.name);
      set((s) => { s.recentFiles = list; });
    } catch (err) {
      console.error('Failed to open recent file:', err);
    }
  },
```

- [ ] `App.tsx` — roep `hydrateRecentFiles` aan bij opstart. Voeg in de grote init-`useEffect` (naast `void loadAllExtensions();`, `:216`) toe:
```ts
    void useAppStore.getState().hydrateRecentFiles();
```

- [ ] `Ribbon.tsx` — vervang in `RecentFilesDropdown` (`:461-525`) de recents-bron en render. Voeg bovenaan de component een capability-guard toe en gebruik `s.recentFiles`. Import `supportsHandles` uit `@/services/fileAccess`. Vervang `:464`:
```ts
  const recentFiles = useAppStore(s => s.recentFiles);
  const openRecentFile = useAppStore(s => s.openRecentFile);
```
  Voeg direct onder de hooks (na `dropdownRef`/`useEffect`) een vroege return toe:
```ts
  if (!supportsHandles()) return null; // fallback-web: geen herbruikbare recents (spec §6)
```
  en vervang de map (`:500-519`) door:
```ts
            recentFiles.map((e) => (
              <button
                key={e.id}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 12px', fontSize: 11, border: 'none',
                  background: 'transparent', color: 'var(--theme-text)',
                  cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                title={e.ref.kind === 'path' ? e.ref.path : e.name}
                onMouseOver={ev => (ev.currentTarget.style.background = 'var(--theme-hover)')}
                onMouseOut={ev => (ev.currentTarget.style.background = 'transparent')}
                onClick={() => { void openRecentFile(e.id); setOpen(false); }}
              >
                {e.name}
                <span style={{ display: 'block', fontSize: 9, color: 'var(--theme-text-dim)', marginTop: 1 }}>
                  {e.ref.kind === 'path' ? e.ref.path : e.name}
                </span>
              </button>
            ))
```
  Voeg de import toe bovenin `Ribbon.tsx`: `import { supportsHandles } from '@/services/fileAccess';`

- [ ] `Backstage.tsx` — vervang in `RecentSection` (`:161-195`) de bron + render. Vervang `:163-164`:
```ts
  const recentFiles = useAppStore(s => s.recentFiles);
  const openRecentFile = useAppStore(s => s.openRecentFile);
```
  Voeg direct daaronder toe:
```ts
  if (!supportsHandles()) return null; // fallback-web: recents verbergen (spec §6)
```
  en vervang de map (`:175-190`) door:
```ts
          {recentFiles.map(e => (
            <button
              key={e.id}
              className="backstage-recent-item"
              onClick={() => {
                void openRecentFile(e.id);
                setUI({ activeRibbonTab: 'start' });
              }}
            >
              <span className="backstage-recent-thumb"><FileType size={20} /></span>
              <span className="backstage-recent-info">
                <span className="backstage-recent-name">{e.name}</span>
                <span className="backstage-recent-path">{e.ref.kind === 'path' ? e.ref.path : e.name}</span>
              </span>
            </button>
          ))}
```
  Voeg de import toe bovenin `Backstage.tsx`: `import { supportsHandles } from '@/services/fileAccess';`

- [ ] `ExternalLinkDialog.tsx` — de recent-route blijft Tauri-only (spec §2/§5/§6: `parseExternalSource` werkt alleen in Tauri). Zet de recents op `s.recentFiles`, gefilterd op `path`-refs, en maak de begin-modus een `useEffect` op de gehydrateerde lijst. Vervang `:21-25`:
```ts
  const recentFiles = useAppStore((s) => s.recentFiles);
  const parseExternalSource = useAppStore((s) => s.parseExternalSource);
  const addExternalLink = useAppStore((s) => s.addExternalLink);

  // Alleen pad-refs zijn read-only te parsen (parseExternalSource is Tauri-only).
  const recent = useMemo(
    () => recentFiles.flatMap((e) => (e.ref.kind === 'path' ? [{ id: e.id, name: e.name, path: e.ref.path }] : [])),
    [recentFiles],
  );
```
  Vervang `const [manual, setManual] = useState<boolean>(recent.length === 0);` (`:30`) door een default + eenmalige auto-switch bij hydratatie:
```ts
  const [manual, setManual] = useState<boolean>(true);
  const modeInited = useRef(false);
  useEffect(() => {
    if (modeInited.current) return;
    if (recent.length > 0) { setManual(false); modeInited.current = true; }
  }, [recent.length]);
```
  (Voeg `useRef` toe aan de React-import op `:1`: `import { useEffect, useMemo, useRef, useState } from 'react';`.)
  Vervang de select-map (`:130-133`) door:
```ts
                <select className="input" value={sourceFile} onChange={(e) => setSourceFile(e.target.value)}>
                  <option value="">—</option>
                  {recent.map((r) => <option key={r.id} value={r.path}>{r.name}</option>)}
                </select>
```
  De rest van de dialoog (`recent.length === 0`-disables, `sourceFile` als pad-string naar `parseExternalSource`) blijft werken: `recent` is nu `{id,name,path}[]`, `recent.length` en de `value={r.path}` sluiten aan. Verwijder de nu-ongebruikte `fileLabel`-helper (`:96`) als die nergens anders meer gebruikt wordt (controleer: alleen de select gebruikte 'm) — anders faalt `noUnusedLocals`.

- [ ] Run: `npm run build` → verwacht: groen. Controleer expliciet op ongebruikte symbolen: `getRecentFiles` volledig weg (interface + impl + 3 callsites), `readRecentFiles`/`addRecentFile`/`RECENT_FILES_KEY`/`MAX_RECENT_FILES` weg, `fileLabel` in ExternalLinkDialog weg indien ongebruikt, `useMemo`/`useRef`/`useEffect` allemaal gebruikt.

- [ ] Self-test (browser dev-build): verifieer hydratatie + legacy-migratie + MRU via store-state:
```js
(async () => {
  const s = window.__OPS__.store;
  // Seed de oude localStorage-lijst en wis IDB-cache-effect door directe hydrate.
  localStorage.setItem('open-planner-studio-recent-files', JSON.stringify(['/a/b/foo.ifc', '/c/bar.ifc']));
  await s.getState().hydrateRecentFiles();
  const afterMigrate = s.getState().recentFiles.map(e => ({ name: e.name, kind: e.ref.kind, path: e.ref.kind === 'path' ? e.ref.path : null }));
  const legacyCleared = localStorage.getItem('open-planner-studio-recent-files');
  return { afterMigrate, legacyCleared };
})()
// Verwacht: afterMigrate bevat {name:'foo.ifc',kind:'path',path:'/a/b/foo.ifc'} en {name:'bar.ifc',...};
//           legacyCleared === null (eenmalige migratie ruimde de sleutel op).
```

- [ ] Commit:
```bash
git add src/state/slices/fileSlice.ts src/App.tsx src/components/layout/Ribbon/Ribbon.tsx src/components/backstage/Backstage.tsx src/components/dialogs/ExternalLinkDialog.tsx
git commit -m "feat(recents): store-state RecentEntry[] + handle-backed heropenen + 3 UI-consumenten

Fase B (spec §6): recents verhuizen van localStorage-paden naar store-state recentFiles
(async gehydrateerd uit IDB, eenmalige migratie). openRecentFile leest via readFromRef en
ruimt geweigerde/verdwenen entries op. Ribbon/Backstage/ExternalLinkDialog lezen s.recentFiles;
recents-UI verborgen als !supportsHandles(). Externe-link-recent-route blijft Tauri-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase C — auto-save & crash-recovery in de browser

### Task 8: recoveryStore-backend (Tauri + web-IDB)

**Files:**
```
Create: src/services/recovery/recoveryStore.ts
```

Trekt de opslag-logica uit `App.tsx`. De Tauri-backend is 1-op-1 de huidige `appDataDir`+`plugin-fs`-logica (dev-slug behouden). De web-backend gebruikt IDB `ops-recovery` met per-tab `sessionId`-scoping. De `readIFC`/`writeIFC`-serialisatie blijft in `App.tsx` (deze module hanteert alleen IFC-**content**-strings, geen parsing).

- [ ] Maak `src/services/recovery/recoveryStore.ts`:
```ts
import { isTauri } from '@/utils/platform';
import { idbGetAll, idbPut, idbDelete } from '@/utils/idb';

/** Eén recovery-document (IFC-CONTENT, niet de bestandsnaam). */
export interface RecoveryDocContent {
  id: string;
  ifc: string;
  filePath: string | null;
  isDirty: boolean;
}

/** Geladen record incl. weergave-mtime (Tauri: bestand-mtime; web: addedAt). */
export interface LoadedRecoveryDoc extends RecoveryDocContent {
  mtime: Date | null;
}

export interface LoadedRecovery {
  activeDocumentId: string | null;
  docs: LoadedRecoveryDoc[];
}

// ---------------------------------------------------------------------------
// Tauri-backend — appDataDir + plugin-fs (dev-slug-isolatie behouden, spec §7).
// ---------------------------------------------------------------------------

const recoveryBase = __OPS_DEV_INSTANCE__ ? `recovery.${__OPS_DEV_INSTANCE__}` : 'recovery';
const manifestName = `${recoveryBase}.documents.json`;
const legacyFile = `${recoveryBase}.ifc`;
const ifcName = (docId: string): string => `${recoveryBase}.${docId}.ifc`;

interface TauriManifest {
  version: number;
  activeDocumentId: string | null;
  documents: { id: string; ifc: string; filePath: string | null; isDirty: boolean }[];
}

async function saveTauri(activeId: string, docs: RecoveryDocContent[]): Promise<void> {
  const { writeTextFile, readDir, remove } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();

  for (const d of docs) {
    await writeTextFile(await join(dir, ifcName(d.id)), d.ifc);
  }

  const manifest: TauriManifest = {
    version: 1,
    activeDocumentId: activeId,
    documents: docs.map((d) => ({ id: d.id, ifc: ifcName(d.id), filePath: d.filePath, isDirty: d.isDirty })),
  };
  await writeTextFile(await join(dir, manifestName), JSON.stringify(manifest));

  // Ruim snapshots op van documenten die niet meer open zijn (zelfde slug).
  const keep = new Set(docs.map((d) => ifcName(d.id)));
  const prefix = `${recoveryBase}.`;
  for (const entry of await readDir(dir)) {
    const name = entry.name;
    if (name && name.startsWith(prefix) && name.endsWith('.ifc') && !keep.has(name)) {
      await remove(await join(dir, name));
    }
  }
}

async function loadTauri(): Promise<LoadedRecovery> {
  const { readTextFile, exists, stat } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const manifestPath = await join(dir, manifestName);

  if (await exists(manifestPath)) {
    const manifest = JSON.parse(await readTextFile(manifestPath)) as TauriManifest;
    const docs: LoadedRecoveryDoc[] = [];
    for (const d of manifest.documents) {
      try {
        const ifcPath = await join(dir, d.ifc);
        const ifc = await readTextFile(ifcPath);
        let mtime: Date | null = null;
        try { mtime = (await stat(ifcPath)).mtime; } catch { /* geen mtime — laat null */ }
        docs.push({ id: d.id, ifc, filePath: d.filePath ?? null, isDirty: d.isDirty ?? true, mtime });
      } catch (err) {
        console.error('Recovery: kon documentsnapshot niet lezen:', d.id, err);
      }
    }
    return { activeDocumentId: manifest.activeDocumentId ?? null, docs };
  }

  // Terugval: oude losse <base>.ifc (één document).
  const legacyPath = await join(dir, legacyFile);
  if (await exists(legacyPath)) {
    const ifc = await readTextFile(legacyPath);
    let mtime: Date | null = null;
    try { mtime = (await stat(legacyPath)).mtime; } catch { /* geen mtime */ }
    return { activeDocumentId: 'legacy', docs: [{ id: 'legacy', ifc, filePath: null, isDirty: true, mtime }] };
  }

  return { activeDocumentId: null, docs: [] };
}

async function clearTauri(): Promise<void> {
  const { exists, readTextFile, remove } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  const manifestPath = await join(dir, manifestName);
  if (await exists(manifestPath)) {
    try {
      const manifest = JSON.parse(await readTextFile(manifestPath)) as TauriManifest;
      for (const d of manifest.documents) {
        try { await remove(await join(dir, d.ifc)); } catch { /* al weg */ }
      }
    } catch { /* corrupt manifest — negeren */ }
    try { await remove(manifestPath); } catch { /* al weg */ }
  }
  const legacyPath = await join(dir, legacyFile);
  if (await exists(legacyPath)) {
    try { await remove(legacyPath); } catch { /* al weg */ }
  }
}

// ---------------------------------------------------------------------------
// Web-backend — IndexedDB 'ops-recovery', per-tab sessionId-scoping (spec §7).
// ---------------------------------------------------------------------------

const WEB_DB = 'ops-recovery';
const WEB_STORE = 'records';
const SESSION_KEY = 'ops-recovery-session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dagen

/** Per-tab id: overleeft reload/crash van hetzelfde tab (sessionStorage), niet tab-sluiten. */
function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch {
    return 'default'; // sessionStorage geblokkeerd → vaste sleutel
  }
}

interface WebDocRecord {
  id: string; // `${sid}::doc::${docId}`
  kind: 'doc';
  sessionId: string;
  docId: string;
  ifc: string;
  filePath: string | null;
  isDirty: boolean;
  addedAt: number;
}
interface WebManifestRecord {
  id: string; // `${sid}::manifest`
  kind: 'manifest';
  sessionId: string;
  activeDocumentId: string | null;
  docIds: string[];
  addedAt: number;
}
type WebRecord = WebDocRecord | WebManifestRecord;

const docKey = (sid: string, docId: string): string => `${sid}::doc::${docId}`;
const manifestKey = (sid: string): string => `${sid}::manifest`;

async function saveWeb(activeId: string, docs: RecoveryDocContent[]): Promise<void> {
  const sid = sessionId();
  const now = Date.now();
  const all = await idbGetAll<WebRecord>(WEB_DB, WEB_STORE);

  // Ruim verweesde vreemde sessies op (ouder dan 7 dagen).
  for (const r of all) {
    if (r.sessionId !== sid && now - r.addedAt > MAX_AGE_MS) {
      await idbDelete(WEB_DB, WEB_STORE, r.id);
    }
  }

  // Schrijf de huidige docs van deze sessie.
  for (const d of docs) {
    const rec: WebDocRecord = {
      id: docKey(sid, d.id), kind: 'doc', sessionId: sid, docId: d.id,
      ifc: d.ifc, filePath: d.filePath, isDirty: d.isDirty, addedAt: now,
    };
    await idbPut(WEB_DB, WEB_STORE, rec);
  }
  const manifest: WebManifestRecord = {
    id: manifestKey(sid), kind: 'manifest', sessionId: sid,
    activeDocumentId: activeId, docIds: docs.map((d) => d.id), addedAt: now,
  };
  await idbPut(WEB_DB, WEB_STORE, manifest);

  // Ruim doc-records van DEZE sessie op die niet meer open zijn.
  const keep = new Set(docs.map((d) => docKey(sid, d.id)));
  for (const r of all) {
    if (r.sessionId === sid && r.kind === 'doc' && !keep.has(r.id)) {
      await idbDelete(WEB_DB, WEB_STORE, r.id);
    }
  }
}

async function loadWeb(): Promise<LoadedRecovery> {
  const sid = sessionId();
  const all = await idbGetAll<WebRecord>(WEB_DB, WEB_STORE);
  const manifest = all.find((r) => r.kind === 'manifest' && r.sessionId === sid) as WebManifestRecord | undefined;
  if (!manifest) return { activeDocumentId: null, docs: [] };
  const docs: LoadedRecoveryDoc[] = [];
  for (const docId of manifest.docIds) {
    const rec = all.find((r) => r.kind === 'doc' && r.id === docKey(sid, docId)) as WebDocRecord | undefined;
    if (!rec) continue;
    docs.push({ id: rec.docId, ifc: rec.ifc, filePath: rec.filePath, isDirty: rec.isDirty, mtime: new Date(rec.addedAt) });
  }
  return { activeDocumentId: manifest.activeDocumentId, docs };
}

async function clearWeb(): Promise<void> {
  const sid = sessionId();
  const all = await idbGetAll<WebRecord>(WEB_DB, WEB_STORE);
  for (const r of all) {
    if (r.sessionId === sid) await idbDelete(WEB_DB, WEB_STORE, r.id);
  }
}

// ---------------------------------------------------------------------------
// Publieke API — backend-keuze bij runtime.
// ---------------------------------------------------------------------------

export function saveRecovery(activeId: string, docs: RecoveryDocContent[]): Promise<void> {
  return isTauri() ? saveTauri(activeId, docs) : saveWeb(activeId, docs);
}

export function loadRecovery(): Promise<LoadedRecovery> {
  return isTauri() ? loadTauri() : loadWeb();
}

export function clearRecovery(): Promise<void> {
  return isTauri() ? clearTauri() : clearWeb();
}
```

- [ ] Run: `npm run build` → verwacht: groen. (`__OPS_DEV_INSTANCE__` is een bestaand globaal define — geen import nodig; controleer geen ongebruikte imports.)

- [ ] Self-test (browser dev-build): test de web-IDB-round-trip rechtstreeks via de Vite-modulegraaf (de picker-onafhankelijke logica; spec §11):
```js
(async () => {
  const m = await import('/src/services/recovery/recoveryStore.ts');
  await m.clearRecovery();
  await m.saveRecovery('d1', [
    { id: 'd1', ifc: 'IFC-CONTENT-1', filePath: '/x/foo.ifc', isDirty: true },
    { id: 'd2', ifc: 'IFC-CONTENT-2', filePath: null, isDirty: true },
  ]);
  const loaded = await m.loadRecovery();
  const summary = { active: loaded.activeDocumentId, ids: loaded.docs.map(d => d.id), ifc0: loaded.docs[0]?.ifc };
  await m.clearRecovery();
  const cleared = await m.loadRecovery();
  return { summary, clearedCount: cleared.docs.length };
})()
// Verwacht: summary { active:'d1', ids:['d1','d2'], ifc0:'IFC-CONTENT-1' }, clearedCount: 0.
```

- [ ] Commit:
```bash
git add src/services/recovery/recoveryStore.ts
git commit -m "feat(recovery): recovery-opslagbackend uit App getrokken (Tauri fs + web IndexedDB)

Fase C (spec §7): saveRecovery/loadRecovery/clearRecovery met Tauri-backend (huidige
appDataDir+plugin-fs-logica, dev-slug + legacy-fallback behouden) en web-backend (IDB
'ops-recovery' met per-tab sessionId-scoping + 7-dagen-prune). IFC-serialisatie blijft in App.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: App.tsx auto-save + recovery-check op de backend + `beforeunload`-guard

**Files:**
```
Modify: src/App.tsx (imports :7-28; auto-save-effect :282-357; recovery-check-effect :361-483; nieuw beforeunload-effect)
```

- [ ] `App.tsx` — imports: verwijder de recovery-constantenblok + `RecoveryManifest`-interface (`:11-28`, de `const recoveryBase`/`recoveryManifestName`/`legacyRecoveryFile`/`recoveryIfcName` + `interface RecoveryManifest {...}`) en voeg de recoveryStore-import toe. `writeIFC` (`:7`), `readIFC` (`:8`), `isTauri` (`:9`), `documentTitle` (`:59`), `RecoveryDocInput` (`:68`), `RecoveryEntry` (`:56`) blijven geïmporteerd. Voeg toe (bv. bij de service-imports):
```ts
import { saveRecovery, loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
```

- [ ] `App.tsx` — vervang het **hele** auto-save-effect (`:282-357`). Verwijder de top-`if (!isTauri()) return;` (web doet nu ook auto-save) en vervang het inline `@tauri-apps`-fs-blok door het bouwen van `docs` + één `saveRecovery`-aanroep; debounce/`autoSaveEnabled`/`saving`/`pending` blijven:
```ts
  useEffect(() => {
    let saving = false;
    let pending = false;

    const runAutoSave = async () => {
      // Wacht tot de recovery-keuze gemaakt is (anders overschrijven we de snapshots te vroeg).
      if (!autoSaveEnabled.current) return;
      if (saving) { pending = true; return; }
      const state = useAppStore.getState();
      const payloads = state.getOpenDocumentPayloads();
      if (!payloads.some((d) => d.payload.isDirty)) return;
      saving = true;
      try {
        const docs = payloads.map(({ id, payload }) => ({
          id,
          ifc: writeIFC({
            project: payload.project,
            calendar: payload.calendar,
            tasks: payload.tasks,
            sequences: payload.sequences,
            resources: payload.resources,
            assignments: payload.assignments,
            activityCodeTypes: payload.activityCodeTypes,
            customFieldDefs: payload.customFieldDefs,
            resourceCalendars: payload.calendars,
            baselines: payload.baselines,
            activeBaselineId: payload.activeBaselineId,
          }),
          filePath: payload.filePath,
          isDirty: payload.isDirty,
        }));
        await saveRecovery(state.activeDocumentId, docs);
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        saving = false;
        if (pending) { pending = false; void runAutoSave(); }
      }
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useAppStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void runAutoSave(); }, 800);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
```

- [ ] `App.tsx` — vervang het **hele** recovery-check-effect (`:361-483`). Verwijder de niet-Tauri-kortsluiting (`:367`) en de inline manifest/legacy-fs-logica; laad via `loadRecovery()`, parse elk IFC met `readIFC` voor de dialoog-entries + herstel-inputs, en ruim op via `clearRecovery()`:
```ts
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;

    (async () => {
      // Poort opent zodra de keuze gemaakt is (of er niets te herstellen valt).
      const finish = () => { autoSaveEnabled.current = true; setRecoveryResolved(true); };
      try {
        const { activeDocumentId, docs } = await loadRecovery();
        if (docs.length === 0) { finish(); return; }

        const restored: RecoveryDocInput[] = [];
        const entries: RecoveryEntry[] = [];
        for (const d of docs) {
          try {
            const parsed = readIFC(d.ifc);
            restored.push({
              id: d.id,
              project: parsed.project, calendar: parsed.calendar, tasks: parsed.tasks,
              sequences: parsed.sequences, resources: parsed.resources, assignments: parsed.assignments,
              activityCodeTypes: parsed.activityCodeTypes, customFieldDefs: parsed.customFieldDefs,
              resourceCalendars: parsed.resourceCalendars,
              filePath: d.filePath, isDirty: d.isDirty,
            });
            entries.push({
              id: d.id,
              name: documentTitle(d.filePath, parsed.project.name),
              filePath: d.filePath,
              taskCount: parsed.tasks.length,
              mtime: d.mtime,
            });
          } catch (err) {
            console.error('Failed to read recovery document:', d.id, err);
          }
        }

        // Niets bruikbaars geparst → stil opruimen, geen dialoog.
        if (entries.length === 0) { await clearRecovery(); finish(); return; }

        setRecovery({
          entries,
          onRestore: () => {
            if (restored.length > 0) {
              useAppStore.getState().restoreDocuments(restored, activeDocumentId);
            }
            void clearRecovery();
            setRecovery(null);
            finish();
          },
          onDiscard: () => { void clearRecovery(); setRecovery(null); finish(); },
          // Uitstellen: data laten staan, niet herstellen (zie RecoveryDialog).
          onClose: () => { setRecovery(null); finish(); },
        });
      } catch (err) {
        console.error('Recovery check failed:', err);
        finish();
      }
    })();
  }, []);
```

- [ ] `App.tsx` — voeg een nieuw `beforeunload`-effect toe (spec §7), **achter `if (isTauri()) return;`** zodat de desktop-webview niet dubbel-prompt bovenop `CloseDocumentDialog`. Plaats het bijvoorbeeld direct na het recovery-check-effect:
```ts
  // Web-only: waarschuw bij het sluiten van het tabblad met niet-opgeslagen wijzigingen.
  // Tauri heeft hiervoor al de CloseDocumentDialog; een ongeguarde handler zou in de
  // desktop-webview dubbel-prompten (spec §7).
  useEffect(() => {
    if (isTauri()) return;
    const handler = (e: BeforeUnloadEvent) => {
      const anyDirty = useAppStore.getState().getOpenDocumentPayloads().some((d) => d.payload.isDirty);
      if (anyDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
```

- [ ] Run: `npm run build` → verwacht: groen. Controleer op ongebruikte symbolen na het verwijderen van de constanten: geen verwijzing meer naar `recoveryBase`/`recoveryIfcName`/`recoveryManifestName`/`legacyRecoveryFile`/`RecoveryManifest`; `writeIFC`/`readIFC`/`isTauri`/`documentTitle`/`RecoveryDocInput`/`RecoveryEntry` nog gebruikt.

- [ ] Self-test (browser dev-build): verifieer dat auto-save in web naar IDB schrijft en de recovery-check-flow de auto-save-poort opent. Maak een dirty wijziging, wacht op de debounce en lees de web-recovery terug:
```js
(async () => {
  const s = window.__OPS__.store;
  const rec = await import('/src/services/recovery/recoveryStore.ts');
  await rec.clearRecovery();
  // Forceer een dirty document en trigger een store-notificatie voor de debounce.
  s.getState().addTask ? s.getState().addTask({ name: 'recovery-probe' }) : s.setState({ isDirty: true });
  s.setState({ isDirty: true });
  await new Promise(r => setTimeout(r, 1100)); // > 800ms debounce
  const loaded = await rec.loadRecovery();
  const out = { docCount: loaded.docs.length, anyIfc: !!loaded.docs[0]?.ifc };
  await rec.clearRecovery();
  return out;
})()
// Verwacht: docCount >= 1 en anyIfc === true (auto-save schreef een IFC-snapshot naar IDB).
// Noot: dit vereist dat de recovery-check-poort al geopend is (autoSaveEnabled), wat in de
// web-build direct na mount gebeurt zodra loadRecovery leeg terugkomt.
```
  De picker-onafhankelijke herstel-dialoog kan ook end-to-end (Playwright): seed een web-recovery-record met `saveRecovery`, herlaad de pagina (sessionStorage blijft → zelfde sessionId), en assert dat `RecoveryDialog` verschijnt. Wat niet via automation aanklikbaar is (FSA-pickers), expliciet als zodanig rapporteren (spec §11).

- [ ] Commit:
```bash
git add src/App.tsx
git commit -m "feat(recovery): auto-save + herstel-dialoog in de browser via recoveryStore

Fase C (spec §7): auto-save en recovery-check verliezen hun isTauri-guard en draaien via
saveRecovery/loadRecovery/clearRecovery (web = IndexedDB, Tauri = ongewijzigd). Nieuwe
beforeunload-waarschuwing achter !isTauri() zodat de desktop niet dubbel-prompt bovenop
CloseDocumentDialog. Debounce/serialisatie/RecoveryDialog blijven gelijk voor beide backends.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase D — opruimen + volledige verificatie

### Task 10: dode `MenuBar` verwijderen

**Files:**
```
Delete: src/components/layout/MenuBar/MenuBar.tsx
```

- [ ] Bevestig opnieuw dat `MenuBar` nergens geïmporteerd is:
```bash
grep -rn "MenuBar" src/ | grep -v "src/components/layout/MenuBar/"
# Verwacht: geen output.
```

- [ ] Verwijder het bestand (en de daarna lege map):
```bash
git rm src/components/layout/MenuBar/MenuBar.tsx
rmdir src/components/layout/MenuBar 2>/dev/null || true
```
  `MenuBar.tsx` is dode, nergens-gerenderde code met een onvolledig `writeIFC`-save-pad (footgun; spec §9). Er zijn geen bijbehorende css/index-bestanden (map bevatte alleen `MenuBar.tsx`). De `menuBar.*`-i18n-sleutels blijven ongebruikt in de JSON-bestanden staan — dat is geen build-impact en valt buiten scope.

- [ ] Run: `npm run build` → verwacht: groen.

- [ ] Commit:
```bash
git add -A
git commit -m "chore(cleanup): dode MenuBar verwijderd (onvolledig writeIFC-save-pad)

Fase D (spec §9): MenuBar.tsx werd nergens gerenderd en bevatte een onvolledig
writeIFC-save-pad (footgun). Verwijderd.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: volledige zelf-verificatie

**Files:**
```
(geen wijzigingen — verificatie)
```

- [ ] Run: `npm run build` → verwacht: groen (statische poort, tsc strict + noUnusedLocals/noUnusedParameters).

- [ ] Run de scheduling-regressiesuite (raakt bestand-I/O niet, maar bevestigt geen collateral):
```bash
bash tests/planning/run.sh
# Verwacht: exit 0 (alle cases groen). Noot: in een worktree kan de suite een symlink naar de
# parent-esbuild nodig hebben (zie MEMORY: reference_worktree_planning_suite_esbuild) — regel dat
# als run.sh met exit 127 faalt op de esbuild-binary.
```

- [ ] Self-test (browser dev-build, Chromium) — end-to-end store-state-checklist (spec §11), asserterend op store-state, niet op canvas-pixels:
```js
(async () => {
  const s = window.__OPS__.store;
  const fa = await import('/src/services/fileAccess/index.ts');
  const rec = await import('/src/services/recovery/recoveryStore.ts');

  // 1. Backend-keuze.
  const supportsHandles = fa.supportsHandles();

  // 2. fileHandle-reset bij newProject + document-swap round-trip.
  s.setState({ fileHandle: { name: 'probe' } });
  const firstId = s.getState().activeDocumentId;
  s.getState().newDocument();
  const freshHandle = s.getState().fileHandle;        // null
  s.getState().switchDocument(firstId);
  const swappedBack = s.getState().fileHandle;         // { name:'probe' }
  s.getState().newProject();
  const resetHandle = s.getState().fileHandle;         // null

  // 3. Recents-hydratatie + migratie.
  localStorage.setItem('open-planner-studio-recent-files', JSON.stringify(['/p/q/plan.ifc']));
  await s.getState().hydrateRecentFiles();
  const recentOk = s.getState().recentFiles.some(e => e.ref.kind === 'path' && e.name === 'plan.ifc');

  // 4. Recovery web-IDB round-trip.
  await rec.clearRecovery();
  await rec.saveRecovery('rA', [{ id: 'rA', ifc: 'X', filePath: null, isDirty: true }]);
  const recovered = (await rec.loadRecovery()).docs.length === 1;
  await rec.clearRecovery();

  return { supportsHandles, freshHandle, swappedBack, resetHandle, recentOk, recovered };
})()
// Verwacht: { supportsHandles:true, freshHandle:null, swappedBack:{name:'probe'},
//             resetHandle:null, recentOk:true, recovered:true }.
```

- [ ] Rapporteer expliciet wat **niet** via automation kon worden aangeklikt: de native FSA-pickers (`showOpenFilePicker`/`showSaveFilePicker`) en de Tauri-native open/save-dialogen. De onderliggende logica (`saveToRef`/`readFromRef`/permissie-branches/fallback-download/recents/recovery) is wél via directe aanroep + store-state geverifieerd (spec §11).

- [ ] Optioneel — visuele bevestiging in de browser: open de app, klik **Openen** in het lint (Chromium toont de FSA-picker; kies een IFC), verifieer dat het project laadt en dat het bestand in **Recent** verschijnt; klik **Opslaan** en bevestig in-place opslaan (geen tweede prompt). Dit is handmatig (picker niet automatiseerbaar).

- [ ] Geen aparte commit nodig (verificatie zonder codewijziging). Als tests aanpassingen afdwongen: commit die met een `test`/`fix`-message in dezelfde stijl.

---

## Samenvatting van bestanden

**Nieuw (7):**
- `src/types/file-system-access.d.ts` (Task 1)
- `src/utils/idb.ts` (Task 2)
- `src/services/fileAccess/index.ts` (Task 3)
- `src/services/fileAccess/tauriBackend.ts` (Task 3)
- `src/services/fileAccess/webBackend.ts` (Task 3)
- `src/services/fileAccess/recentFiles.ts` (Task 6)
- `src/services/recovery/recoveryStore.ts` (Task 8)

**Gewijzigd (7):**
- `src/state/slices/projectSlice.ts` (Task 4)
- `src/state/slices/documentSlice.ts` (Task 4)
- `src/state/slices/fileSlice.ts` (Task 5, Task 7)
- `src/App.tsx` (Task 7, Task 9)
- `src/components/layout/Ribbon/Ribbon.tsx` (Task 7)
- `src/components/backstage/Backstage.tsx` (Task 7)
- `src/components/dialogs/ExternalLinkDialog.tsx` (Task 7)

**Verwijderd (1):**
- `src/components/layout/MenuBar/MenuBar.tsx` (Task 10)

**Ongewijzigd, bevestigd (geen code nodig):**
- `src/state/snapshot.ts` — `Snapshot` bevat `filePath`/`fileHandle` niet; undo/redo kan de handle niet clobberen (spec §4.1).
