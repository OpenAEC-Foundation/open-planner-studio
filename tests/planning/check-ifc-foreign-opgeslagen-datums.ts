import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMergeOutput, MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { prepareIfcOutput } from '@/state/prepareIfcOutput';
import type { ImportResult } from '@/services/importTypes';
import { MSPDI_FIXTURE, P6XML_FIXTURE } from '../fixtures/recordedTimesFormats';
import { loadStore, openInStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installDOMParser } from './xmldom-shim';

installDeterminism();
installDOMParser();
const { createAppStoreContext, buildWriteIFCInput } = await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const example = new Uint8Array(readFileSync(join(root, 'public/examples/showcase-verbouwing-eengezinswoning.ifc')));
const enc = new TextEncoder(), dec = new TextDecoder();

let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<void>) {
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) {
    failed++;
    console.error(`XX ${name}: ${(error instanceof Error ? error.message : String(error)).slice(0, 1600)}`);
  }
}

type Store = Awaited<ReturnType<typeof openInStore>>['store'];
const WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);',
  "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
].join('\n');
const withWall = (text: string) => {
  const at = text.lastIndexOf('ENDSEC;');
  return enc.encode(`${text.slice(0, at)}${WALL}\n${text.slice(at)}`);
};
const TIME_KEYS = ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'freeFloat', 'isCritical'] as const;
const shown = (store: Store) => store.getState().tasks.map(t => [t.name, ...TIME_KEYS.map(k => t.time[k])]);
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const refusal = (error: unknown) => error instanceof MergeNeedsPhase2Error
  ? `${[...new Set(error.cases.map(c => c.kind))].sort().join(', ')}: ${error.cases.map(c => c.detail).join(' | ').slice(0, 900)}`
  : String(error);

async function merged(store: Store): Promise<Uint8Array> {
  const state = store.getState();
  try { return (await prepareIfcWrite(buildWriteIFCInput(state, 'merge'), state.ifcSource!)).bytes; }
  catch (error) { throw new Error(`de merge weigerde: ${refusal(error)}`); }
}

async function opened(bytes: Uint8Array): Promise<Store> {
  const { store } = await openInStore(bytes, 'met-model.ifc');
  const s = store.getState();
  assert(s.ifcSource?.foreign, 'geopend met een vreemd deel');
  return store;
}

async function recordedExample(edit: (input: WriteIFCInput) => void = () => {}, wall = true): Promise<Uint8Array> {
  const { store } = await openInStore(example, 'voorbeeld.ifc');
  const input = structuredClone(buildWriteIFCInput(store.getState(), 'merge'));
  const task = input.tasks.find(t => t.name === 'Set up site')!;
  assert.notEqual(task.time.earlyStart, task.time.scheduleStart, 'de berekening wijkt af van de planstart');
  task.time = { ...task.time, earlyStart: task.time.scheduleStart };
  input.recordedSourceFormat = 'mspdi';
  edit(input);
  return wall ? withWall(writeIFC(input)) : enc.encode(writeIFC(input));
}

async function importedThenSaved(parsed: ImportResult): Promise<Uint8Array> {
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  store.getState().applyOpenedImport(parsed, { filePath: null, recompute: true });
  assert.equal(store.getState().datesAsRecorded, true, 'de verse import staat in de modus');
  return withWall(writeIFC(buildWriteIFCInput(store.getState(), 'merge')));
}

const STANDS: ReadonlyArray<readonly [string, () => Promise<Uint8Array>]> = [
  ['MSPDI-herkomst (de reproductie van de review)', () => recordedExample()],
  ['MSPDI-herkomst, ongewijzigd sinds import', () => recordedExample(input => { input.importPristine = true; })],
  ['rekenprofiel P6', () => recordedExample(input => { input.project = { ...input.project, schedulingProfile: { baseId: 'p6', id: 'p6', name: 'P6', overrides: {} } }; })],
  ['rekenprofiel MS Project', () => recordedExample(input => { input.project = { ...input.project, schedulingProfile: { baseId: 'msproject', id: 'msproject', name: 'MS Project', overrides: {} } }; })],
  ['echte MSPDI-import, opgeslagen als IFC', () => importedThenSaved(readMSPDI(MSPDI_FIXTURE))],
  ['echte P6 XML-import, opgeslagen als IFC', () => importedThenSaved(readP6XML(P6XML_FIXTURE))],
];

for (const [stand, make] of STANDS) {
  await check(`2231 ${stand}: Ctrl+S zonder bewerking geeft de bron byte voor byte terug`, async () => {
    const source = await make(), store = await opened(source);
    assert.equal(store.getState().datesAsRecorded, true, 'geopend in "datums zoals opgeslagen"');
    assert(sameBytes(await merged(store), source), 'de merge geeft de bron terug');
    const output = await prepareIfcOutput(store.getState(), buildWriteIFCInput(store.getState(), 'merge'));
    assert(output.prepared && sameBytes(output.prepared.bytes, source), 'de gedeelde ingang van Ctrl+S ook');
  });

  await check(`2231 ${stand}: Ctrl+S na een bewerking schrijft, en heropenen toont de datums die de planner zag`, async () => {
    const store = await opened(await make());
    const task = store.getState().tasks.find(t => !t.childIds.length)!;
    store.getState().updateTask(task.id, { name: `${task.name} (hernoemd)` });
    assert.equal(store.getState().datesAsRecorded, true, 'een naam laat de modus staan');
    const reopened = await opened(await merged(store));
    assert.equal(reopened.getState().datesAsRecorded, true, 'heropend in de modus');
    assert.deepEqual(shown(reopened), shown(store));
  });
}

await check('2231 Set up site: de modus toont de opgeslagen vroege start, niet de berekening', async () => {
  const store = await opened(await recordedExample());
  const s = store.getState(), task = s.tasks.find(t => t.name === 'Set up site')!;
  assert.equal(task.time.earlyStart, task.time.scheduleStart);
  assert.equal(s.recordedDates?.total, s.tasks.length, 'alle taken zijn vastgelegd');
});

await check('2231 een datumbewerking zonder herberekening (scheduleStale): Ctrl+S schrijft, en heropenen toont wat main toont voor hetzelfde bestand zonder gebouwmodel', async () => {
  const lengthen = (store: Store) => {
    const task = store.getState().tasks.find(t => t.name === 'Set up site')!;
    store.getState().updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
    assert.equal(store.getState().datesAsRecorded, false, 'een duurwijziging verlaat de modus');
    assert.equal(store.getState().scheduleStale, true, 'nog niet herberekend');
  };
  const store = await opened(await recordedExample());
  lengthen(store);
  const reopened = await opened(await merged(store));
  const { store: plain } = await openInStore(await recordedExample(() => {}, false), 'zonder-model.ifc');
  assert.equal(plain.getState().ifcSource?.foreign, false);
  lengthen(plain);
  const written = await prepareIfcOutput(plain.getState(), buildWriteIFCInput(plain.getState(), 'merge'));
  assert(!written.prepared, 'zonder gebouwmodel de gewone writer, zoals main');
  const { store: plainReopened } = await openInStore(enc.encode(written.content), 'zonder-model.ifc');
  assert.equal(reopened.getState().datesAsRecorded, plainReopened.getState().datesAsRecorded);
  assert.deepEqual(shown(reopened), shown(plainReopened));
});

await check('2231 een nagebootste fout in de writer (een andere opgeslagen vroege start) weigert nog met planning-na-openen', async () => {
  const store = await opened(await recordedExample());
  const task = store.getState().tasks.find(t => !t.childIds.length)!;
  store.getState().updateTask(task.id, { name: `${task.name} (hernoemd)` });
  const state = store.getState(), input = buildWriteIFCInput(state, 'merge');
  const good = await merged(store), text = dec.decode(good);
  const line = text.split('\n').find(l => l.includes("IFCTASKTIME('Set up site Time'"))!;
  assert(line, 'de proef vond de taaktijd');
  for (const wrong of ["'2027-05-05T07:00:00'", '$']) {
    const args = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')')).split(',');
    args[7] = wrong;
    const faulty = enc.encode(text.replace(line, `${line.slice(0, line.indexOf('(') + 1)}${args.join(',')});`));
    await assert.rejects(checkMergeOutput(faulty, input, state.ifcSource!), (error: unknown) => {
      assert(error instanceof MergeNeedsPhase2Error, String(error));
      assert.deepEqual([...new Set(error.cases.map(c => c.kind))], ['planning-na-openen'], refusal(error));
      return true;
    }, `vroege start ${wrong}`);
  }
});

console.log(`Opgeslagen datums bij de merge: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
