import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { installDOMParser } from './xmldom-shim';

const g = globalThis as any;
g.window = g.window ?? {};

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

let nextFile: unknown = null;

g.document = {
  createElement: (tag: string) => {
    if (tag !== 'input') return {};
    const input: FakeInput = {
      type: '',
      accept: '',
      files: undefined,
      onchange: null,
      addEventListener: () => { },
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

eq('00 readFormatForFile: .mpp heeft id "mpp" (binair)', readFormatForFile('plan.mpp').id, 'mpp');
eq('00b readFormatForFile: .ifc heeft id "ifc"', readFormatForFile('plan.ifc').id, 'ifc');
eq('00c readFormatForFile: .csv heeft id "csv" (niet "ifc")', readFormatForFile('plan.csv').id, 'csv');
eq('00d readFormatForFile: .xml heeft id "xml" (niet "ifc")', readFormatForFile('plan.xml').id, 'xml');

{
  const saveTargets = allReadFormats().filter((f) => f.canBeSaveTarget === true);
  eq('00e exact één formaat draagt canBeSaveTarget', saveTargets.length, 1);
  eq('00f canBeSaveTarget staat op de IFC-entry', saveTargets[0]?.id, 'ifc');
}

{
  S().newProject();
  S().setProject({ name: 'Guard-IFC-bron', startDate: '2026-08-03' });
  S().addTask({ name: 'Los werkje' });
  const ifcText = writeIFC(buildWriteIFCInput(S(), 'planOnly'));

  S().newProject();
  nextFile = makeFakeFile('bron.ifc', { text: ifcText });
  await S().openFile();

  eq('01 IFC-open: document telt de geïmporteerde taak', S().tasks.length, 1);
  eq('02 IFC-open: filePath WORDT gezet (IFC-bron ⇒ enige formaat dat de guard doorlaat)', S().filePath, 'bron.ifc');
}

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

installDOMParser();
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
    const tag = createHash('sha256').update(bytes).digest('hex').slice(0, 16);

    S().newProject();
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

{
  if (!corpusPresent || corpusFiles.length === 0) {
    console.log('OK  mpp-open-guard: corpus niet aanwezig (OPS_MPP_CORPUS) — recents-deel overgeslagen');
  } else {
    const name = corpusFiles[0];
    const bytes = new Uint8Array(readFileSync(join(CORPUS, name)));
    const handle = makeFakeHandle(makeFakeFile(name, { bytes }));
    const tag = createHash('sha256').update(bytes).digest('hex').slice(0, 16);

    S().newProject();
    useAppStore.setState({ recentFiles: [{ id: 'recent-test-mpp', name, ref: { kind: 'handle', handle }, addedAt: Date.now() }] });
    await S().openRecentFile('recent-test-mpp');

    truthy(`15 [${tag}] openRecentFile(.mpp): taken geladen`, S().tasks.length > 0);
    eq(`16 [${tag}] openRecentFile(.mpp): GEEN filePath (saveTargetFor: canBeSaveTarget=false)`, S().filePath, null);
    eq(`17 [${tag}] openRecentFile(.mpp): GEEN fileHandle`, S().fileHandle, null);
    eq(`18 [${tag}] openRecentFile(.mpp): entry blijft in recents (verplaatst, niet verwijderd)`, S().recentFiles.length, 1);
  }
}

{
  S().newProject();
  S().setProject({ name: 'Guard-Recents-IFC-bron', startDate: '2026-08-03' });
  S().addTask({ name: 'Recents-werkje' });
  const ifcText = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const handle = makeFakeHandle(makeFakeFile('recents-bron.ifc', { text: ifcText }));

  S().newProject();
  useAppStore.setState({ recentFiles: [{ id: 'recent-test-ifc', name: 'recents-bron.ifc', ref: { kind: 'handle', handle }, addedAt: Date.now() }] });
  await S().openRecentFile('recent-test-ifc');

  eq('19 openRecentFile(.ifc): document telt de geïmporteerde taak', S().tasks.length, 1);
  eq('20 openRecentFile(.ifc): filePath WÉL gezet (contrast, canBeSaveTarget=true)', S().filePath, 'recents-bron.ifc');
  truthy('21 openRecentFile(.ifc): fileHandle gezet (handle-ref)', S().fileHandle === handle);
}

if (diffs.length === 0) {
  console.log(`OK  mpp-open-guard-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  mpp-open-guard-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
