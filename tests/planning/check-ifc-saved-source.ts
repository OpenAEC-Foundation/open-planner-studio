// #804 fase 1c PR 8b: afronden na geslaagde I/O, zonder de opslagblokkade te openen.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWriteIFCInput, sameIFCSource } from '@/state/ifcSaveInput';
import { createSnapshot } from '@/state/snapshot';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { recoverySnapshotInput } from '@/services/recovery/recoverySnapshotInput';
import { planRecoveryDelta, persistedRecoveryState, type RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { ifcSaveBlocked } from '@/state/ifcForeignGuard';
import { openInStore, lengthenedTask } from './ifcAppRoute';
import { concat, mergeProblems, openForeign } from './ifcMergeKern';
import { generatedModel } from './ifcGeneratedModel';
import { installDeterminism } from './ifcPariteitKern';

installDeterminism();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string) => new Uint8Array(readFileSync(join(root, path)));
const office = read('public/examples/03-kantoorgebouw-zuidas.ifc');
const sources = [
  ['eigen-plus-model', read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')],
  ['kantoor-plus-wand', generatedModel(root, new TextDecoder().decode(office), 0)],
] as const;
type Store = Awaited<ReturnType<typeof openInStore>>['store'];
const payload = (store: Store, id = store.getState().activeDocumentId) =>
  store.getState().getOpenDocumentPayloads().find(d => d.id === id)!.payload;
const recoveryDoc = (store: Store, id: string): RecoverySourceDocument => {
  const source = payload(store, id);
  return { id, filePath: source.filePath, isDirty: source.isDirty, datesAsRecorded: source.datesAsRecorded, source };
};
const longer = (store: Store) => {
  const state = store.getState(), task = state.tasks.find(t => !t.childIds.length && !t.isMilestone && t.time.durationUnit !== 'hours')!;
  assert(task, 'de gewone bron heeft een dagtaak');
  state.updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
  store.getState().runCPM();
  return task.id;
};
let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<void>) {
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}`, error); }
}

for (const [name, bytes] of sources) for (const sleeping of [false, true]) {
  const label = `${name}, ${sleeping ? 'slapend' : 'actief'}`;
  await check(`${label}: drie opslagcommits = de keten van 8a`, async () => {
    const { store } = await openInStore(bytes);
    const id = store.getState().activeDocumentId, other = store.getState().newDocument();
    store.getState().switchDocument(id);
    let reference = payload(store).ifcSource!, added = '';
    for (let step = 0; step < 3; step++) {
      store.getState().switchDocument(id);
      if (step === 0) longer(store);
      if (step === 1) added = store.getState().addTask({ name: 'Nieuwe taak 8b' }, { phaseAssignments: 'move', answered: true });
      if (step === 2) store.getState().deleteTask(added);
      store.getState().runCPM();
      const saved = payload(store), input = buildWriteIFCInput(saved);
      const expected = await prepareIfcWrite(input, reference);
      const prepared = await prepareIfcWrite(input, saved.ifcSource!);
      assert.deepEqual(concat(prepared.parts), concat(expected.parts), `stap ${step}: dezelfde invoer als de zelfstandige 8a-keten`);
      assert.deepEqual(mergeProblems(bytes, prepared.source.bytes), []);
      if (sleeping) store.getState().switchDocument(other);
      const publications: { source: unknown; dirty: boolean; path: string | null }[] = [];
      const unsubscribe = store.subscribe(() => {
        const current = payload(store, id);
        publications.push({ source: current.ifcSource, dirty: current.isDirty, path: current.filePath });
      });
      const destination = { filePath: `${name}-${step}.ifc`, fileHandle: null, siteFileId: null, siteFileVersion: null };
      const unchanged = store.getState().commitSavedDocument(id, saved, destination, prepared);
      unsubscribe();
      assert.equal(unchanged, true);
      assert.deepEqual(publications, [{ source: prepared.source, dirty: false, path: destination.filePath }], 'één atomaire publicatie');
      const current = payload(store, id);
      assert.strictEqual(current.ifcSource, prepared.source);
      assert.equal(current.isDirty, false);
      for (const cal of prepared.literalCalendarIds) assert(current.ifcLiteralCalendarIds?.includes(cal));
      assert.equal(store.getState().activeDocumentId, sleeping ? other : id);
      reference = expected.source;
    }
    store.getState().switchDocument(id);
    const current = payload(store).ifcSource;
    store.getState().undo(); assert.strictEqual(payload(store).ifcSource, current);
    store.getState().redo(); assert.strictEqual(payload(store).ifcSource, current);
    store.getState().switchDocument(other); store.getState().switchDocument(id);
    assert.strictEqual(payload(store).ifcSource, current, 'wisselen bewaart de nieuwe bron');
    assert(ifcSaveBlocked(payload(store)), 'de opslagblokkade blijft dicht');
  });

  await check(`${label}: doorwerken houdt dirty, bron volgt de geschreven versie`, async () => {
    const { store } = await openInStore(bytes);
    const id = store.getState().activeDocumentId, task = longer(store);
    const saved = payload(store), prepared = await prepareIfcWrite(buildWriteIFCInput(saved), saved.ifcSource!);
    const lateName = `${store.getState().tasks.find(t => t.id === task)!.name} (tijdens schrijven)`;
    store.getState().updateTask(task, { name: lateName });
    const other = sleeping ? store.getState().newDocument() : id;
    store.getState().markAutoSaveVersionSaved(id, saved, prepared);
    const current = payload(store, id);
    assert.strictEqual(current.ifcSource, prepared.source);
    assert.equal(current.isDirty, true, 'een tussentijdse bewerking blijft ongeopgeslagen');
    assert(!prepared.source.opened!.tasks.some(t => t.name === lateName), 'opened is de geschreven, eerdere stand');
    const next = await prepareIfcWrite(buildWriteIFCInput(current), current.ifcSource!);
    const reopened = await openForeign(concat(next.parts));
    assert.equal(reopened.tasks.find(t => t.id === task)!.name, lateName, 'de volgende opslag draagt het tussentijdse werk');
    assert.deepEqual(mergeProblems(bytes, next.source.bytes), []);
    store.getState().markAutoSaveVersionSaved(id, current, next);
    assert.equal(payload(store, id).isDirty, false);
    assert.equal(store.getState().activeDocumentId, other);
  });
}

await check('alleen een nieuwe bron: niet dirty, geen herstelsnapshot, geen AutoSave', async () => {
  const { store } = await openInStore(office);
  const id = store.getState().activeDocumentId;
  const first = payload(store), primed = await prepareIfcWrite(buildWriteIFCInput(first), first.ifcSource!);
  store.getState().commitSavedDocument(id, first, undefined, primed);
  store.getState().setAutoSaveToFile(true);
  const before = payload(store), baseline = persistedRecoveryState(id, [recoveryDoc(store, id)]);
  const prepared = await prepareIfcWrite(buildWriteIFCInput(before), before.ifcSource!);
  store.getState().commitSavedDocument(id, before, undefined, prepared);
  const after = payload(store);
  assert.notStrictEqual(after.ifcSource, before.ifcSource);
  assert(sameIFCSource(before, after), 'bronidentiteit is geen inhoudsverschil');
  assert.equal(after.isDirty, false);
  const delta = planRecoveryDelta(id, [recoveryDoc(store, id)], baseline);
  assert.deepEqual(delta.changedDocuments, []);
  assert.equal(delta.needsPersist, false, 'alleen de bron veroorzaakt geen herstelsnapshot of metadatawijziging');
  const input = recoverySnapshotInput(after);
  assert(!('ifcSource' in input.input));
  assert(!JSON.stringify(input).includes('"bytes"'));
  assert(!('ifcSource' in createSnapshot(store.getState())));
  const notices = store.getState().ui.notifications.length;
  await createFileAutoSaveController({ getState: store.getState, enabled: () => true }).flush();
  assert.equal(store.getState().ui.notifications.length, notices);
  assert.equal(payload(store).isDirty, false);
});

function fileHandle(name: string, initial = new Uint8Array(), onPermission?: () => void) {
  let data: Uint8Array = initial;
  const writes: Uint8Array[] = [];
  const handle = {
    kind: 'file', name,
    isSameEntry: async (other: unknown) => other === handle,
    getFile: async () => new File([new Uint8Array(data).buffer], name),
    queryPermission: async () => { onPermission?.(); return 'granted'; },
    createWritable: async () => {
      let buffer = new Uint8Array();
      return {
        write: async (chunk: string | Uint8Array) => { buffer = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk); },
        close: async () => { data = buffer; writes.push(data); },
      };
    },
  } as unknown as FileSystemFileHandle;
  return { handle, writes, setBytes: (bytes: Uint8Array) => { data = bytes; } };
}

await check('AutoSave: een kandidaat van de oude bron schrijft niet na een opslagcommit', async () => {
  const { store } = await openInStore(office);
  const id = store.getState().activeDocumentId;
  longer(store);
  let fired = false;
  const own = fileHandle('autosave.ifc', office, () => {
    if (fired) return;
    fired = true;
    own.setBytes(prepared.source.bytes); // De geslaagde handmatige write vóór zijn commit.
    store.getState().commitSavedDocument(id, saved, undefined, prepared);
  });
  store.setState(s => { s.fileHandle = own.handle; s.autoSaveToFile = true; });
  const saved = payload(store), prepared = await prepareIfcWrite(buildWriteIFCInput(saved), saved.ifcSource!);
  await createFileAutoSaveController({ getState: store.getState, enabled: () => true }).flush();
  assert(fired, 'de kandidaat wachtte werkelijk op de permissiecontrole');
  assert.strictEqual(payload(store).ifcSource, prepared.source);
  assert.equal(own.writes.length, 0, 'de verouderde kandidaat wordt vóór I/O geweigerd');
  assert.equal(payload(store).isDirty, false);
});

await check('E13: kalenderkeuze vastleggen, uurtaak wissen, volgende opslag blijft letterlijk', async () => {
  const { store } = await openInStore(sources[0][1]);
  const id = store.getState().activeDocumentId, state = store.getState(), cal = state.calendar.id;
  const template = lengthenedTask(buildWriteIFCInput(state));
  const added = state.addTask({ name: 'Uurtaak 8b', time: { ...template.time, durationUnit: 'hours', durationMinutes: 60, scheduleDuration: 0.125 } },
    { phaseAssignments: 'move', answered: true });
  store.getState().runCPM();
  const saved = payload(store), prepared = await prepareIfcWrite(buildWriteIFCInput(saved), saved.ifcSource!);
  assert(prepared.literalCalendarIds.includes(cal));
  store.getState().commitSavedDocument(id, saved, undefined, prepared);
  assert(payload(store).ifcLiteralCalendarIds?.includes(cal));
  store.getState().deleteTask(added); store.getState().runCPM();
  const current = payload(store), next = await prepareIfcWrite(buildWriteIFCInput(current), current.ifcSource!);
  assert(next.literalCalendarIds.includes(cal));
  assert((await openForeign(next.source.bytes)).ifcLiteralCalendarIds?.includes(cal));
});

for (const foreign of [true, false]) await check(`${foreign ? 'vreemd' : 'eigen'}: exports vernieuwen de documentbron nooit`, async () => {
  const { store } = await openInStore(foreign ? sources[0][1] : office);
  const old = store.getState().ifcSource;
  const win = window as unknown as Record<string, unknown>;
  const copy = fileHandle('export.ifc');
  win.showOpenFilePicker = () => { throw new Error('geen openactie in de exportproef'); };
  win.showSaveFilePicker = async () => copy.handle;
  try {
    for (const format of ['csv', 'ifc'] as const) {
      const result = await store.getState().exportAs(format);
      assert(result.ok);
      assert.equal(!!result.cancelled, foreign && format === 'ifc');
      assert.strictEqual(store.getState().ifcSource, old);
    }
    const pooled = await store.getState().exportProjectWithPool();
    assert(pooled.ok);
    assert.equal(!!pooled.cancelled, foreign);
    assert.strictEqual(store.getState().ifcSource, old);
    assert(copy.writes.length > 0, 'er is daadwerkelijk naar het andere doel geëxporteerd');
  } finally { delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
});

await check('zonder vreemd deel: gewone Opslaan als laat de openingsbron ongewijzigd', async () => {
  const { store } = await openInStore(office);
  longer(store);
  const old = store.getState().ifcSource!;
  const win = window as unknown as Record<string, unknown>, copy = fileHandle('gewoon.ifc');
  win.showOpenFilePicker = () => { throw new Error('geen openactie'); };
  win.showSaveFilePicker = async () => copy.handle;
  try { await store.getState().saveFileAs(); }
  finally { delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
  assert.equal(copy.writes.length, 1);
  assert.strictEqual(store.getState().ifcSource, old);
  assert.equal(store.getState().isDirty, false);
  assert.notEqual(createHash('sha256').update(copy.writes[0]).digest('hex'), old.sha256, 'de openingsbron is na een gewone opslag verouderd');
});

console.log(`Bronvastlegging: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
