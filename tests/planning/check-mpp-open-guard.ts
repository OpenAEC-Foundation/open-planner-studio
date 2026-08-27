// Opslagdoel-guard voor niet-IFC bronformaten (fase 3.8 e1, T8-stap 5a; verbreed T8-spec-review F4).
//
// De bug die dit vastzet: `fileSlice.openFile`/`openRecentFile` zetten historisch ALTIJD een
// opslagdoel (filePath/fileHandle) op het geopende bestand. Opslaan schrijft ALTIJD IFC-tekst terug
// — dat is alleen correct als de bron zelf ook IFC was. Voor elk ANDER bronformaat (CSV, MS-Project-
// /P6-XML, en sinds T8 het binaire .mpp) zou de eerstvolgende Ctrl+S het bronbestand stil
// overschrijven met IFC-inhoud onder dezelfde naam. De guard is dus NIET "binair vs. tekst" (dat was
// de T8-oorspronkelijke, te smalle vorm) maar "IFC vs. niet-IFC" — exact de regel die de MCP-kant al
// had (`fileTools.ts`: `format === 'IFC' && !isBinary`).
//
// Deze check drijft de ECHTE productieroute aan (`useAppStore.getState().openFile(...)`) — niet een
// herimplementatie van de guard-formule — via de `<input type=file>`-terugval van
// `fileAccess/webBackend.ts` (`openViaInput`): `document.createElement`/`window` worden minimaal
// gestubt (zelfde stijl als `check-mspdi-baseline-export.ts`), zodat `isTauri()` false blijft en
// `hasFSA()` (geen `showOpenFilePicker` op de gestubte `window`) de input-terugval kiest.
//
// Delen:
//  A.  ALTIJD (geen corpus nodig): IFC door dezelfde open-route krijgt WÉL een opslagdoel (contrast).
//  A2. ALTIJD: CSV door dezelfde open-route krijgt GEEN opslagdoel.
//  A3. ALTIJD: MS-Project-XML (MSPDI) door dezelfde open-route krijgt GEEN opslagdoel.
//  B.  CORPUS-GEDREVEN (skip-OK zonder corpus, zelfde conventie als check-mpp-import.ts): ELK
//      `.mpp`-bestand in het corpus door de open-route — bewijst dat na een geslaagde MPP-open
//      `filePath`/`fileHandle` leeg blijven, terwijl taken/kalender/CPM wél degelijk geladen/
//      herrekend zijn (T11: alle drie ground-truth-bestanden, niet meer één handmatig gekozen
//      "veilig" bestand — zie de toelichting bij Part B hieronder).
//  C.  `openRecentFile` — HET ANDERE open-pad, met een eigen `saveTargetFor`-callsite en een ander
//      lees-mechanisme (`readBytesFromRef`/`readFromRef` op een bewaarde `FileRef` i.p.v. een
//      dialoog-/`<input>`-bestand). C1 CORPUS-GEDREVEN: .mpp via recents ⇒ GEEN opslagdoel, entry
//      blijft (verplaatst) in recents. C2 ALTIJD: contrast — IFC via recents krijgt WÉL een
//      opslagdoel (eindreview-restpunt: dit was het enige bedrade pad zonder eigen poort).
//
// Draait via run.sh. Exit 0 = alles groen.
//
// DEKKINGSKAART (T9, uitgebreid T11 — dit bestand toetst GEEN mpp-domeindata, alleen het
// opslagdoel-gedrag van de open-routes): A/A2/A3/C2 → SYNTHETISCH (in-memory stubs, altijd); B/C1
// → CORPUS (B: alle beschikbare bestanden; C1: het eerste — géén crawl-sectie, want dit is geen
// lezer-correctheidscheck). C draait uitsluitend de WEB-backend-route (handle-based `FileRef`);
// de Tauri-backend (pad-based ref) blijft in dit headless bestand bewust ongetest, net als A/A2/
// A3/B dat al deden. Zie check-mpp-import.ts, check-mpp-calendars.ts en check-mpp-relations.ts
// voor de dekkingskaarten van de mpp-lezer zelf (CFB/container/primitieven/taken/kalenders/
// relaties/resources/assignments).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { installDOMParser } from './xmldom-shim';

// ── Headless browser-stubs (vóór de eerste store-import) ─────────────────────────────────────
const g = globalThis as any;
g.window = g.window ?? {}; // GEEN showOpenFilePicker ⇒ hasFSA() false ⇒ input-terugval; isTauri() blijft ook false.

type FakeInput = {
  type: string;
  accept: string;
  files?: unknown[];
  onchange: (() => void | Promise<void>) | null;
  addEventListener: (event: string, cb: () => void) => void;
  click: () => void;
};

function makeFakeFile(name: string, opts: { text?: string; bytes?: Uint8Array }): unknown {
  return {
    name,
    text: async () => opts.text ?? '',
    arrayBuffer: async () => {
      const bytes = opts.bytes ?? new Uint8Array(0);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

/** De volgende `document.createElement('input')` levert dit bestand op bij `.click()`. */
let nextFile: unknown = null;

g.document = {
  createElement: (tag: string) => {
    if (tag !== 'input') return {};
    const input: FakeInput = {
      type: '',
      accept: '',
      files: undefined,
      onchange: null,
      addEventListener: () => { /* 'cancel' wordt in deze check nooit gebruikt */ },
      click: () => {
        input.files = nextFile ? [nextFile] : [];
        void input.onchange?.();
      },
    };
    return input;
  },
};

const { useAppStore } = await import('@/state/appStore');
const { readFormatForFile, allReadFormats } = await import('@/services/formatRegistry');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { writeCSV } = await import('@/services/csv/csvWriter');
const { writeMSPDI } = await import('@/services/msproject/mspdiWriter');

const S = () => useAppStore.getState();

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// ── Classificatie-slot: de guard leunt op `readFormatForFile(...).id` (F4: niet meer `.kind`) ─
eq('00 readFormatForFile: .mpp heeft id "mpp" (binair)', readFormatForFile('plan.mpp').id, 'mpp');
eq('00b readFormatForFile: .ifc heeft id "ifc"', readFormatForFile('plan.ifc').id, 'ifc');
eq('00c readFormatForFile: .csv heeft id "csv" (niet "ifc")', readFormatForFile('plan.csv').id, 'csv');
eq('00d readFormatForFile: .xml heeft id "xml" (niet "ifc")', readFormatForFile('plan.xml').id, 'xml');

// ── T11 (stap 0-ter b): exact ÉÉN formaat draagt `canBeSaveTarget` — de vlag die `fileSlice.ts`
// (via `saveTargetFor`) en `fileTools.ts` allebei rechtstreeks lezen i.p.v. een `id`/`format`-
// vergelijking. Twee `true`-dragers zou betekenen dat een niet-IFC-open zijn eigen bronbestand
// met IFC-tekst kan laten overschrijven; nul zou betekenen dat NIETS meer een opslagdoel krijgt
// (ook niet IFC zelf) — beide zijn een stille regressie op de opslagdoel-guard. ─────────────────
{
  const saveTargets = allReadFormats().filter((f) => f.canBeSaveTarget === true);
  eq('00e exact één formaat draagt canBeSaveTarget', saveTargets.length, 1);
  eq('00f canBeSaveTarget staat op de IFC-entry', saveTargets[0]?.id, 'ifc');
}

// ── A. IFC door de open-route: opslagdoel WORDT gezet (contrast — de enige bron die dat mag) ──
{
  S().newProject();
  S().setProject({ name: 'Guard-IFC-bron', startDate: '2026-08-03' });
  S().addTask({ name: 'Los werkje' });
  const ifcText = writeIFC(buildWriteIFCInput(S()));

  S().newProject(); // vers, ongewijzigd actief tabblad — wordt hergebruikt (isActivePristine)
  nextFile = makeFakeFile('bron.ifc', { text: ifcText });
  await S().openFile();

  eq('01 IFC-open: document telt de geïmporteerde taak', S().tasks.length, 1);
  eq('02 IFC-open: filePath WORDT gezet (IFC-bron ⇒ enige formaat dat de guard doorlaat)', S().filePath, 'bron.ifc');
}

// ── A2. CSV door de open-route (T8-spec-review F4): GEEN opslagdoel — voorheen (vóór F4) kon
// Ctrl+S na een CSV-open het CSV-bronbestand met IFC-tekst overschrijven, want de oorspronkelijke
// guard keek alleen naar `kind === 'binary'` en CSV is een tekstformaat. ─────────────────────────
{
  S().newProject();
  S().setProject({ name: 'Guard-CSV-bron', startDate: '2026-08-03' });
  S().addTask({ name: 'CSV-werkje' });
  const state = S();
  const csvText = writeCSV(state.project, state.calendar, state.tasks, state.sequences, state.resources, state.assignments);

  S().newProject();
  nextFile = makeFakeFile('bron.csv', { text: csvText });
  await S().openFile();

  eq('03 CSV-open: document telt de geïmporteerde taak', S().tasks.length, 1);
  eq('04 CSV-open: GEEN filePath (F4: niet-IFC-bron krijgt geen opslagdoel)', S().filePath, null);
  eq('05 CSV-open: GEEN fileHandle', S().fileHandle, null);
}

// ── A3. MS-Project-XML (MSPDI) door de open-route (T8-spec-review F4): idem, GEEN opslagdoel. ──
installDOMParser(); // readMSPDI (via parseProjectXml) gebruikt de browser-DOMParser, ontbreekt in Node.
{
  S().newProject();
  S().setProject({ name: 'Guard-XML-bron', startDate: '2026-08-03' });
  S().addTask({ name: 'XML-werkje' });
  const state = S();
  const xmlText = writeMSPDI(
    state.project, state.calendar, state.tasks, state.sequences, state.resources, state.assignments,
    state.calendars, state.baselines, state.activeBaselineId,
  );

  S().newProject();
  nextFile = makeFakeFile('bron.xml', { text: xmlText });
  await S().openFile();

  eq('06 XML-open: document telt de geïmporteerde taak', S().tasks.length, 1);
  eq('07 XML-open: GEEN filePath (F4: niet-IFC-bron krijgt geen opslagdoel)', S().filePath, null);
  eq('08 XML-open: GEEN fileHandle', S().fileHandle, null);
}

// ── B. Corpus-gedreven: .mpp door de open-route ───────────────────────────────────────────────
//
// T11 (stap 1g): dit deel testte ooit alleen het EERSTE corpusbestand ZONDER een relatie op een
// niet-leaf (WBS-samenvattings-)taak — `CPMSolver.topologicalSort()`/`forwardPass` crashte vóór
// de CPM-fix op zo'n relatie (`s.sequences` gaat ongefilterd de solver in, ook al filtert
// `runCPM` de taakinvoer zelf op leaf-taken). Die fix is geland (04909f36: samenvattingsrelaties
// propageren naar leaf-taken; 130e7750: voorouder-guard + terugvouwing) en gereviewd — het
// `findSafeCorpusFile`-filter dat om die crash heen koos is nu dood gewicht. Alle drie
// ground-truth-bestanden lopen hieronder door de ECHTE open-route (incl. 870d339f60603f71,
// hash-only §8, die wél zo'n relatie draagt), net als check-mpp-import.ts/-relations.ts al deden.
const CORPUS =
  process.env.OPS_MPP_CORPUS ??
  '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const corpusPresent = existsSync(CORPUS);
const corpusFiles = corpusPresent ? readdirSync(CORPUS).filter((f) => f.toLowerCase().endsWith('.mpp')) : [];

if (!corpusPresent || corpusFiles.length === 0) {
  console.log('OK  mpp-open-guard: corpus niet aanwezig (OPS_MPP_CORPUS) — corpusdeel overgeslagen');
} else {
  for (const name of corpusFiles) {
    const mppPath = join(CORPUS, name);
    const bytes = new Uint8Array(readFileSync(mppPath));
    // Hash-only (§8, Z20-veeg): `name` blijft nodig als functionele invoer (simuleert de echte
    // `File.name` die de app krijgt), maar élke DIAGNOSEREGEL hieronder gebruikt `tag` (de hash),
    // nooit `name` zelf.
    const tag = createHash('sha256').update(bytes).digest('hex').slice(0, 16);

    S().newProject(); // vers, ongewijzigd actief tabblad
    nextFile = makeFakeFile(name, { bytes });
    await S().openFile();

    truthy(`09 [${tag}] MPP-open: taken geladen`, S().tasks.length > 0);
    truthy(`10 [${tag}] MPP-open: kalender gezet (id aanwezig)`, !!S().calendar?.id);
    truthy(`11 [${tag}] MPP-open: planning herberekend (cpmResult aanwezig, geen crash)`, S().cpmResult !== null);
    eq(`12 [${tag}] MPP-open: GEEN filePath (opslagdoel-guard, T8-stap 5a/F4)`, S().filePath, null);
    eq(`13 [${tag}] MPP-open: GEEN fileHandle`, S().fileHandle, null);
    eq(`14 [${tag}] MPP-open: document blijft "ongewijzigd naamloos" — isDirty volgt de normale open-semantiek`, S().isDirty, false);
  }
}

// ── C. openRecentFile — het enige bedrade opslagdoel-lees-pad zonder eigen poort (eindreview-
// restpunt): tot hier toetste dit bestand alleen `openFile`. `openRecentFile` heeft dezelfde
// `saveTargetFor`-guard maar een ANDER lees-pad (`readBytesFromRef`/`readFromRef` op een bewaarde
// `FileRef`, i.p.v. een dialoog/`<input>`-bestand) — dat pad had nog geen enkele regressietest.
//
// Deze omgeving (`isTauri()` blijft false — geen `__TAURI_INTERNALS__` op de gestubte `window`)
// stuurt `readBytesFromRef`/`readFromRef` altijd naar de WEB-backend. Die backend leest alleen een
// HANDLE-ref (`ref.kind === 'path'` levert daar meteen `null` op, spiegelt de Chromium-FSA-route);
// een pad-ref hoort bij de Tauri-backend (`tauriBackend.ts`), die in deze headless run sowieso nooit
// geraakt wordt (geen `@tauri-apps/*`-mocking hier) — dat pad blijft dus bewust ongetest in déze
// check, net zoals de rest van dit bestand al uitsluitend de web-route drijft. De gestubte handle
// hieronder (queryPermission/requestPermission/getFile) spiegelt `webBackend.ts`'s `readRefWeb`
// (T11-consolidatie) letterlijk, naar het patroon van `check-web-save-fallback.ts`'s `makeHandle`.
//
// Recents zelf lopen door IndexedDB (`fileAccess/recentFiles.ts`); zonder een echte `indexedDB`-
// global in Node faalt die laag stil (`idb.ts`'s eigen ontwerp — spec §10, "een IDB-fout mag de
// app-start nooit blokkeren") en valt terug op een in-memory lege lijst. `pushRecent` (in
// `openRecentFile`'s succespad) bouwt de nieuwe lijst dan uitsluitend uit DEZE aanroep, dus de
// test zet de startlijst rechtstreeks via `useAppStore.setState` — hetzelfde patroon als
// `tests/mcp/cases-doc-file.ts` gebruikt voor store-setup buiten de normale acties om.
function makeFakeHandle(file: unknown): FileSystemFileHandle {
  return {
    kind: 'file',
    name: 'fixture',
    isSameEntry: () => Promise.resolve(false),
    getFile: () => Promise.resolve(file),
    queryPermission: () => Promise.resolve('granted'),
    requestPermission: () => Promise.resolve('granted'),
  } as unknown as FileSystemFileHandle;
}

// C1. CORPUS-GEDREVEN: .mpp via recents ⇒ GEEN opslagdoel; de entry blijft (verplaatst naar de
// MRU-top via `pushRecent`, niet verwijderd — verwijderen gebeurt alleen als de READ zelf faalt).
{
  if (!corpusPresent || corpusFiles.length === 0) {
    console.log('OK  mpp-open-guard: corpus niet aanwezig (OPS_MPP_CORPUS) — recents-deel overgeslagen');
  } else {
    const name = corpusFiles[0];
    const bytes = new Uint8Array(readFileSync(join(CORPUS, name)));
    const handle = makeFakeHandle(makeFakeFile(name, { bytes }));
    // Hash-only (§8): `name` blijft functionele invoer (echte `File.name`/recent-entry-naam),
    // diagnoseregels gebruiken `tag`.
    const tag = createHash('sha256').update(bytes).digest('hex').slice(0, 16);

    S().newProject(); // vers, ongewijzigd actief tabblad
    useAppStore.setState({ recentFiles: [{ id: 'recent-test-mpp', name, ref: { kind: 'handle', handle }, addedAt: Date.now() }] });
    await S().openRecentFile('recent-test-mpp');

    truthy(`15 [${tag}] openRecentFile(.mpp): taken geladen`, S().tasks.length > 0);
    eq(`16 [${tag}] openRecentFile(.mpp): GEEN filePath (saveTargetFor: canBeSaveTarget=false)`, S().filePath, null);
    eq(`17 [${tag}] openRecentFile(.mpp): GEEN fileHandle`, S().fileHandle, null);
    eq(`18 [${tag}] openRecentFile(.mpp): entry blijft in recents (verplaatst, niet verwijderd)`, S().recentFiles.length, 1);
  }
}

// C2. ALTIJD (geen corpus nodig): contrast — IFC via recents krijgt WÉL een opslagdoel. De ref is
// hier handle-based (web-FSA), dus `saveTargetFor`'s `ref?.kind === 'path' ? ref.path : name`-
// terugval geeft `filePath === name` (geen echt OS-pad in deze route) en `fileHandle === handle`.
{
  S().newProject();
  S().setProject({ name: 'Guard-Recents-IFC-bron', startDate: '2026-08-03' });
  S().addTask({ name: 'Recents-werkje' });
  const ifcText = writeIFC(buildWriteIFCInput(S()));
  const handle = makeFakeHandle(makeFakeFile('recents-bron.ifc', { text: ifcText }));

  S().newProject();
  useAppStore.setState({ recentFiles: [{ id: 'recent-test-ifc', name: 'recents-bron.ifc', ref: { kind: 'handle', handle }, addedAt: Date.now() }] });
  await S().openRecentFile('recent-test-ifc');

  eq('19 openRecentFile(.ifc): document telt de geïmporteerde taak', S().tasks.length, 1);
  eq('20 openRecentFile(.ifc): filePath WÉL gezet (contrast, canBeSaveTarget=true)', S().filePath, 'recents-bron.ifc');
  truthy('21 openRecentFile(.ifc): fileHandle gezet (handle-ref)', S().fileHandle === handle);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  mpp-open-guard-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  mpp-open-guard-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
