// Workergrens en races van crashherstel: echte IFC-writer en recovery-backend, vertraagde transportdubbel.
import assert from 'node:assert/strict';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { capturePayload } from '@/state/documentContract';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';
import { recoverySnapshotInput, serializeRecoveryInput, serializeRecoverySnapshot } from '@/services/recovery/recoverySnapshotInput';
import { createRecoverySnapshotSerializer, type RecoveryWorker } from '@/services/recovery/recoverySnapshotSerializer';
import type { RecoveryWorkerRequest, RecoveryWorkerResponse } from '@/services/recovery/recoverySnapshot.worker';
import { RecoveryDeltaTracker, type RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { clearRecovery, loadRecovery } from '@/services/recovery/recoveryStore';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { createRecoveryTickQueue } from '@/services/recovery/recoveryTickQueue';
import { registerRecoveryFlush, flushRecoveryNow } from '@/services/recovery/recoveryFlush';

const writes: string[] = [];
installFakeRecoveryIndexedDb({ onPut: (_store, value) => {
  const ifc = (value as { ifc?: string }).ifc;
  if (ifc) writes.push(ifc);
} });
const ctx = createAppStoreContext();
const s = () => ctx.store.getState();
s().newProject();
const taskId = s().addTask({ name: 'Versie oud' });
const old = capturePayload(s());
s().updateTask(taskId, { name: 'Versie nieuw' });
const newer = capturePayload(s());
const doc = (source: IFCSaveSource): RecoverySourceDocument => ({
  id: 'a', source, filePath: null, isDirty: true, datesAsRecorded: false,
  siteFileId: 'site-a', siteFileVersion: '7',
});
const normalize = (ifc: string) => {
  const stamp = /^FILE_NAME\('[^']*','([^']*)'/m.exec(ifc)?.[1];
  return (stamp ? ifc.split(`'${stamp}'`).join("'<tijd>'") : ifc)
    .replace(/^(#\d+=IFCOWNERHISTORY\((?:[^,]*,){7})\d+\)/m, '$1<tijd>)');
};
const parity = (source: IFCSaveSource, actual: string) => assert.equal(normalize(actual), normalize(
  writeIFC({ ...buildWriteIFCInput(source), xerSourceArchiveStorage: 'recovery-reference' }),
));

class Transport implements RecoveryWorker {
  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  requests: RecoveryWorkerRequest[] = [];
  terminated = false;
  postMessage(message: RecoveryWorkerRequest) { this.requests.push(structuredClone(message)); }
  terminate() { this.terminated = true; }
  reply(index: number) {
    const request = this.requests[index]!;
    this.emit({ id: request.id, ifc: serializeRecoveryInput(request.snapshot) });
  }
  emit(data: RecoveryWorkerResponse) {
    this.onmessage?.call(this as unknown as Worker, { data } as MessageEvent<RecoveryWorkerResponse>);
  }
}
const turn = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

// Werkelijke payload kan niet-clonebare filehandles en UI-functies dragen. Die mogen de grens niet over.
const withHandle = { ...old, fileHandle: { cannotClone: () => undefined }, siteFileId: 'site-a' };
const transport = new Transport();
let starts = 0;
const client = createRecoverySnapshotSerializer(() => { starts++; return transport; });
const first = client.serialize(withHandle);
const second = client.serialize(newer);
await turn();
assert.equal(starts, 1);
assert.equal(transport.requests.length, 1, 'maximaal één actieve serialisatie');
assert.equal('fileHandle' in transport.requests[0]!.snapshot.input, false);
assert.equal('siteFileId' in transport.requests[0]!.snapshot.input, false);
let completed = false;
void first.then(() => { completed = true; });
transport.emit({ id: 999, ifc: 'achterhaald antwoord' });
await turn();
assert.equal(completed, false, 'verkeerd verzoek-id wordt genegeerd');
transport.reply(0);
parity(old, await first);
await turn();
assert.equal(transport.requests.length, 2);
transport.reply(1);
parity(newer, await second);
assert.equal(starts, 1, 'dezelfde worker wordt hergebruikt');
client.dispose();
assert.equal(transport.terminated, true);

// No-Worker, opstartfout en postMessage-/clonefout blijven inhoudelijk gelijk aan de oude writer.
for (const factory of [() => null, () => { throw new Error('CSP'); }, () => ({
  ...new Transport(), postMessage: () => { throw new Error('DataCloneError'); }, terminate: () => undefined,
})]) {
  const fallback = createRecoverySnapshotSerializer(factory);
  parity(old, await fallback.serialize(old));
  fallback.dispose();
}
const badTransport = new Transport();
const badClient = createRecoverySnapshotSerializer(() => badTransport);
const badResult = badClient.serialize(old);
await turn();
badTransport.onerror?.call(badTransport as unknown as Worker, {
  message: 'workerstartfout', preventDefault: () => undefined,
} as ErrorEvent);
parity(old, await badResult);
assert.equal(badTransport.terminated, true);
badClient.dispose();
const writerFailure = new Transport();
const reusable = createRecoverySnapshotSerializer(() => writerFailure);
const failedSerialization = reusable.serialize(old);
await turn();
writerFailure.emit({ id: writerFailure.requests[0]!.id, error: 'ongeldige bron' });
await assert.rejects(failedSerialization, /ongeldige bron/);
assert.equal(writerFailure.terminated, false, 'inhoudsfout schakelt de worker niet uit');
const nextSerialization = reusable.serialize(newer);
await turn();
writerFailure.reply(1);
parity(newer, await nextSerialization);
reusable.dispose();

// XER: de writer gebruikt alleen de verwijzing en selectorgeldigheid. Geen bytes, readModel,
// diagnostiekcatalogus of importmetadata in het bericht; ook geen getter op die grote velden lezen.
const xer = readXER(new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-01-01', '%T\tPROJECT', '%F\tproj_id\tproj_short_name', '%R\tP1\tProject',
  '%T\tTASK', '%F\ttask_id\tproj_id\ttask_code\ttask_name', '%R\tT1\tP1\tA1\tTaak', '%E',
].join('\n')));
const imported = isMultiDocumentImport(xer) ? xer.results[0]! : xer;
ctx.store.getState().applyOpenedImport(imported, {
  filePath: null, fileHandle: null, recompute: false, fit: false, linkedOpen: false,
});
const xerSource = capturePayload(s());
assert.ok(xerSource.xerSourceArchive);
const originalArchive = xerSource.xerSourceArchive;
const guarded = { ...xerSource, xerSourceArchive: new Proxy(originalArchive, { get(target, key, receiver) {
  if (key === 'byteChunks' || key === 'readModel') throw new Error(`Verboden archiefkopie: ${String(key)}`);
  return Reflect.get(target, key, receiver) as unknown;
} }) };
const projected = recoverySnapshotInput(guarded);
assert.deepEqual(Object.keys(projected.archive!).sort(), ['byteLength', 'format', 'selectorValid', 'sha256']);
assert.equal('xer' in projected.input, false);
parity(xerSource, serializeRecoveryInput(structuredClone(projected)));
for (const selector of [undefined, 'bestaat-niet']) {
  const invalid = { ...xerSource, xerImportMetadata: null, xerSourceProjectId: selector };
  assert.throws(() => serializeRecoverySnapshot(invalid), /selector/);
}

// Twee vertraagde versies: jongere tick kan niet eerder committen dan oudere; metadata en bron
// worden uit precies dezelfde payload vastgelegd, ook als de live store ondertussen wijzigt.
let release!: (ifc: string) => void;
let serializations = 0;
const tracker = new RecoveryDeltaTracker();
const serialize = async (source: IFCSaveSource) => {
  serializations++;
  if (serializations === 1) return new Promise<string>(resolve => { release = resolve; });
  return serializeRecoverySnapshot(source);
};
const a = runRecoveryTick(tracker, 'a', [doc(old)], serialize);
const b = runRecoveryTick(tracker, 'a', [doc(newer)], serialize);
await turn();
assert.equal(serializations, 1);
release(serializeRecoverySnapshot(old));
assert.equal(await a, true);
assert.equal(await b, true);
assert.equal(writes.length, 2);
assert.ok(writes[0]!.includes('Versie oud'));
assert.ok(writes[1]!.includes('Versie nieuw'));
const loaded = await loadRecovery();
assert.ok(loaded.docs[0]!.ifc.includes('Versie nieuw'));
assert.equal(loaded.docs[0]!.siteFileId, 'site-a');
assert.equal(await runRecoveryTick(tracker, 'a', [doc(newer)], serialize), false);
assert.equal(serializations, 2, 'ongewijzigde versie doet geen extra workerwerk');

// Stop en clean quit terwijl de worker nog werkt: late voltooiing zet gewiste snapshots niet terug.
let enabled = true;
const stoppedTracker = new RecoveryDeltaTracker();
const stopped = runRecoveryTick(stoppedTracker, 'a', [doc(old)], async () =>
  new Promise<string>(resolve => { release = resolve; }), () => enabled);
await turn();
enabled = false;
await clearRecovery();
release(serializeRecoverySnapshot(old));
assert.equal(await stopped, false);
assert.equal((await loadRecovery()).docs.length, 0);
assert.equal(stoppedTracker.hasPersistedSnapshot, false);

// Een serialisatiefout promoveert de basis niet, blokkeert de rij niet en verliest geen documenten.
const retryTracker = new RecoveryDeltaTracker();
await assert.rejects(runRecoveryTick(retryTracker, 'a', [doc(old)], async () => { throw new Error('writerfout'); }));
assert.equal(retryTracker.hasPersistedSnapshot, false);
assert.equal(await runRecoveryTick(retryTracker, 'a', [doc(newer)]), true);
const cached = new RecoveryDeltaTracker();
let count = 0;
const cachedSerialize = async (source: IFCSaveSource) => { count++; return serializeRecoverySnapshot(source); };
await cached.prepareAsync('a', [doc(old)], cachedSerialize);
// Geen commit = storagefout; opnieuw aanbieden met dezelfde tekst uit de cache.
assert.equal((await cached.prepareAsync('a', [doc(old)], cachedSerialize))!.upserts.length, 1);
assert.equal(count, 1);

// Expliciete flush tijdens workerwerk wacht ook op de nieuwere documentversie. Geen tijdslimiet,
// geen losgestarte vervolgronde en geen verlies van een verzoek dat tijdens de eerste ronde kwam.
let releaseRound!: () => void;
let currentVersion = 'oud';
const rounds: string[] = [];
const queue = createRecoveryTickQueue(async () => {
  rounds.push(currentVersion);
  await new Promise<void>(resolve => { releaseRound = resolve; });
}, () => true);
const running = queue();
await turn();
const unregister = registerRecoveryFlush(queue);
currentVersion = 'nieuw';
let flushed = false;
const flush = flushRecoveryNow().then(() => { flushed = true; });
await turn();
assert.equal(flushed, false);
releaseRound();
await turn();
assert.deepEqual(rounds, ['oud', 'nieuw']);
assert.equal(flushed, false, 'flush wacht ook op de tweede ronde');
releaseRound();
await Promise.all([running, flush]);
assert.equal(flushed, true);
unregister();
let queueEnabled = true;
let stoppedRounds = 0;
const stopQueue = createRecoveryTickQueue(async () => {
  stoppedRounds++;
  await new Promise<void>(resolve => { releaseRound = resolve; });
}, () => queueEnabled);
const activeRound = stopQueue();
await turn();
const pendingRound = stopQueue();
queueEnabled = false;
releaseRound();
await Promise.all([activeRound, pendingRound]);
assert.equal(stoppedRounds, 1, 'stop annuleert de nog niet begonnen vervolgronde');
let attempts = 0;
const rejectingQueue = createRecoveryTickQueue(() => {
  if (++attempts === 1) throw new Error('synchrone fout');
  return Promise.resolve();
}, () => true);
await assert.rejects(rejectingQueue(), /synchrone fout/);
await rejectingQueue();
assert.equal(attempts, 2, 'ook een synchrone fout houdt de flushrij niet bezet');

// Review PR #483 P2: zoek het microtaskvenster aan het EINDE van een drain deterministisch.
// Dit draait de productiehelper van useAutoSave met de echte delta/IFC/opslagketen. Een losse
// .finally(() => inFlight = null) verliest op minstens één diepte de tweede expliciete flush.
for (let depth = 0; depth <= 64; depth++) {
  await clearRecovery();
  const gapTracker = new RecoveryDeltaTracker();
  let current = old;
  let hold = true;
  let releaseFirst!: (ifc: string) => void;
  const request = createRecoveryTickQueue(async () => {
    const captured = current;
    await runRecoveryTick(gapTracker, 'a', [doc(captured)], async source => {
      if (hold) return new Promise<string>(resolve => { releaseFirst = resolve; });
      return serializeRecoverySnapshot(source);
    });
  }, () => true);
  const firstFlush = request();
  await turn();
  hold = false;
  releaseFirst(serializeRecoverySnapshot(old));
  let secondFlush: Promise<void> | undefined;
  await new Promise<void>(resolve => {
    const editAndFlush = (remaining: number) => {
      if (remaining > 0) { queueMicrotask(() => editAndFlush(remaining - 1)); return; }
      current = newer;
      secondFlush = request();
      resolve();
    };
    editAndFlush(depth);
  });
  await firstFlush;
  await secondFlush;
  assert.ok((await loadRecovery()).docs[0]!.ifc.includes('Versie nieuw'),
    `microtask-flush op diepte ${depth} resolveert vóór persistentie van de nieuwe versie`);
}

// Unmount stopt ook een actieve én al wachtende opdracht zonder fallback of hangende beloften.
const disposedTransport = new Transport();
const disposable = createRecoverySnapshotSerializer(() => disposedTransport);
const active = disposable.serialize(old);
const queued = disposable.serialize(newer);
await turn();
const rejected = Promise.all([assert.rejects(active, /gestopt/), assert.rejects(queued, /gestopt/)]);
disposable.dispose();
await rejected;
assert.equal(disposedTransport.requests.length, 1);
console.log('OK  recovery-worker: pariteit, archiefgrens, volgorde, cache, fallback en stopraces groen');
