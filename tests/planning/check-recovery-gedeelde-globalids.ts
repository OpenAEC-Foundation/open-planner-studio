import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { mergeProblems } from './ifcMergeKern';
import {
  CRANE, SCAFFOLDERS, THIRD, desktop, freshStore, hash, mergeKinds, openAt, pinMain, renameFirstTask, resourceId,
  resourceLine, restore, root, sameIdentities, saveAs, sharedGlobalIdSource, tick, withField, withoutField,
  installSessionStorage, recoveryDocuments, identities, type Loaded, type Store,
} from './recoveryIdentityFixture';
import { RecoveryDeltaTracker, persistedRecoveryState } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { hasPendingIfcSource } from '@/services/recovery/recoveryPendingSource';
import { replaceRecordId, settlePendingReplaces } from '@/services/fileAccess/replaceRecords';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { recoverySnapshotInput, writeRecoverySnapshot, type RecoverySnapshotInput } from '@/services/recovery/recoverySnapshotInput';
import { recoveryIdentityRows, withRecoveryIdentities } from '@/services/recovery/recoveryIdentity';
import { ifcGuid128, writeIFC } from '@/services/ifc/ifcWriter';
import { createRecoverySnapshotSerializer, type RecoveryWorker } from '@/services/recovery/recoverySnapshotSerializer';
import type { RecoveryWorkerRequest, RecoveryWorkerResponse } from '@/services/recovery/recoverySnapshot.worker';

installDeterminism();
await loadStore();
let failCopy = false;
let webFault: ((store: string, value: { id: string }) => boolean) | null = null;
let docRecordPuts = 0;
const db = installFakeRecoveryIndexedDb({
  onPut: (store, value) => {
    if (store === 'sources' && failCopy) throw new DOMException('quotum', 'QuotaExceededError');
    if (webFault?.(store, value)) throw new DOMException('snapshotquotum', 'QuotaExceededError');
    if (store === 'records' && value.id.includes('::doc::')) docRecordPuts++;
  },
});
installSessionStorage();

const dir = mkdtempSync(join(tmpdir(), 'ops-gedeelde-globalids-'));
const envelope = <T,>(ifc: string, rows: T) => ({ sha256: hash(Buffer.from(ifc)), rows });

type WorkerScope = { onmessage: ((event: { data: RecoveryWorkerRequest }) => void) | null; postMessage: (data: RecoveryWorkerResponse) => void };
const workerScope: WorkerScope = { onmessage: null, postMessage: () => undefined };
Object.defineProperty(globalThis, 'self', { configurable: true, value: workerScope });
await import('@/services/recovery/recoverySnapshot.worker');
const workerHandler = workerScope.onmessage!;
const workerRequests: RecoveryWorkerRequest[] = [];
class RealHandlerWorker implements RecoveryWorker {
  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  postMessage(message: RecoveryWorkerRequest) {
    const data = structuredClone(message);
    workerRequests.push(data);
    queueMicrotask(() => {
      workerScope.postMessage = response => this.onmessage?.call(this as unknown as Worker, { data: structuredClone(response) } as MessageEvent<RecoveryWorkerResponse>);
      workerHandler({ data });
    });
  }
  terminate() { }
}
const transport = createRecoverySnapshotSerializer(() => new RealHandlerWorker());
const { model, source, scaffolders, crane, calendarA, calendarB, H, withForeignSet } = await sharedGlobalIdSource(dir);

const opened = await openAt(source, join(dir, 'sessie.ifc'));
assert(opened.getState().ifcSource?.foreign, 'de bron heeft een vreemd deel');
const craneId = resourceId(opened, CRANE)!;
assert.match(craneId, /-dup-2$/, 'de lezer geeft de tweede resource een -dup-N-id');
assert.equal(resourceId(opened, THIRD), `res-ifc-${H}`);
const crewBId = opened.getState().calendars.find(c => c.name === 'Ploeg B')!.id;
assert(opened.getState().calendars.some(c => /^rescal-ifc-.*-dup-2$/.test(c.id)), 'een van het kalenderpaar krijgt een -dup-N-id');
assert(opened.getState().sequences.some(q => /^seq-ifc-.*-dup-2$/.test(q.id)));
assert.equal(opened.getState().resources.find(r => r.id === craneId)!.calendarId, crewBId, 'de tweede resource verwijst naar de tweede kalender');
assert(opened.getState().assignments.some(a => a.resourceId === craneId), 'de toewijzing wijst naar de tweede resource');
assert.equal(opened.getState().ifcSource!.stepIds[`res:${craneId}`], Number(crane.stepId));
console.log(`BRON: vier paren met een gedeelde GlobalId, een derde resource met H, ${CRANE} ${craneId} op #${crane.stepId}.`);

const original = renameFirstTask(opened, 'Bewerkt vóór de crash');
renameFirstTask(opened, 'Nog een bewerking'); opened.getState().undo();
assert(opened.getState().tasks.some(t => t.name === 'Bewerkt vóór de crash'), 'Ctrl+Z zette de tweede bewerking terug');
const sessionId = opened.getState().activeDocumentId!;
opened.getState().newDocument();
const crashed = await tick(opened, 'deel 1', true, true, transport.serialize);
assert.deepEqual(workerRequests.map(r => r.snapshot.identities ?? false), [true, false],
  'door de Worker: alleen het document met een vreemd deel vraagt om een koppeling');
const crashedField = crashed.docs.find(d => d.id === sessionId)!.snapshotIdentities!;
const rows = crashedField.rows;
assert.equal(crashedField.sha256, hash(Buffer.from(crashed.docs.find(d => d.id === sessionId)!.ifc)), 'de koppeling noemt de sha256 van haar eigen snapshot');
assert.deepEqual(rows.map(([seed]) => seed.split(':')[0]).sort(), ['cal', 'cal', 'res', 'res', 'seq', 'seq', 'task', 'task'],
  'de koppeling noemt elk object uit een gedeelde groep, ook van een tabblad op de achtergrond');
assert(!rows.some(([seed]) => seed === `res:res-ifc-${H}`), 'de derde resource deelt geen GlobalId en staat niet in de koppeling');
const recovered = await restore(crashed);
const fromMain = await restore(withoutField(crashed));
for (const store of [opened, recovered, fromMain]) store.getState().switchDocument(sessionId);
sameIdentities(recovered, opened, 'na herstel: ids, verwijzingen, GlobalIds en bronkaart als in de sessie');
assert.notEqual(resourceId(fromMain, CRANE), craneId, 'main geeft de tweede resource hier een ander id');
assert.equal(resourceId(fromMain, THIRD), resourceId(recovered, THIRD), 'de derde resource houdt haar id, zoals op main');
assert.equal(resourceId(fromMain, SCAFFOLDERS), resourceId(recovered, SCAFFOLDERS), 'de eerste houder houdt zijn id, zoals op main');
assert.equal(await mergeKinds(recovered), await mergeKinds(opened), 'na herstel weigert of schrijft de merge zoals in de sessie');
renameFirstTask(opened, original); renameFirstTask(recovered, original);
assert.equal(planningCanon(buildWriteIFCInput(recovered.getState(), 'merge')), planningCanon(recovered.getState().ifcSource!.opened!),
  'na herstel en terugdraaien is de planning die van de bron');
const fromSession = await saveAs(opened, join(dir, 'sessie-opslag.ifc')), fromRecovery = await saveAs(recovered, join(dir, 'herstel-opslag.ifc'));
assert.equal(hash(fromRecovery), hash(fromSession), 'herstel schrijft dezelfde bytes als de sessie');
assert.equal(hash(fromRecovery), hash(source), 'en dat is de bron zelf');
assert.deepEqual(mergeProblems(source, fromRecovery), []);
assert.deepEqual(resourceLine(fromRecovery, CRANE), { ...crane, guid: scaffolders.guid }, 'de tweede staat op haar #id met haar GlobalId');
console.log('PROEF 1 GROEN: bewerken, Ctrl+Z, tabbladwissel, crash via de Worker-handler en de serializer-client, herstel: ids, verwijzingen, GlobalIds en bronkaart als in de sessie; de derde resource met H blijft de derde.');

const craneRow = rows.find(row => row[0] === `res:${craneId}`)!;
const firstRow = rows.find(row => row[0] === `res:res-ifc-${scaffolders.guid}`)!;
const crashedDoc = crashed.docs.find(d => d.id === sessionId)!;
const twiceInSnapshot: Loaded = { ...crashed, docs: crashed.docs.map(d => d === crashedDoc ? { ...d, ifc: d.ifc.split(`'${H}'`).join(`'${craneRow[2]}'`) } : d) };
const broken: readonly (readonly [string, unknown, boolean, Loaded])[] = [
  ['dubbele sleutel', [...rows, rows[0]], false, crashed],
  ['ontbrekende identiteit', rows.map(row => row === craneRow ? [row[0], row[1], ifcGuid128('bestaat-niet')] : row), true, crashed],
  ['een rij te veel', [...rows, ['res:res-erbij', craneRow[1], craneRow[2]]], false, crashed],
  ['een kapotte rij', [...rows.slice(1), [rows[0][0], rows[0][1]]], false, crashed],
  ['doel bezet', rows.map(row => row === firstRow ? [row[0], row[1], H] : row), true, crashed],
  ['geschreven identiteit twee keer in de snapshot', rows, true, twiceInSnapshot],
];
for (const [label, wrong, shapeOk, base] of broken) {
  assert.equal(recoveryIdentityRows(wrong) !== null, shapeOk, `${label}: de vormtoets`);
  const baseIfc = base.docs.find(d => d.id === sessionId)!.ifc;
  const tried = await restore(withField(base, sessionId, envelope(baseIfc, wrong))), main = await restore(withoutField(base));
  for (const store of [tried, main]) store.getState().switchDocument(sessionId);
  sameIdentities(tried, main, `${label}: niets half toegepast, het herstel van main`);
}
console.log('PROEF 2 GROEN: een koppeling die niet klopt (dubbele sleutel, ontbrekende identiteit, een rij te veel, een kapotte rij, doel bezet, dubbel in de snapshot) laat het herstel van main staan.');
await clearRecovery();

const firstGone = await openAt(source, join(dir, 'eerste-weg.ifc'));
firstGone.getState().removeResource(resourceId(firstGone, SCAFFOLDERS)!);
const recoveredGone = await restore(await tick(firstGone, 'deel 3'));
assert.equal(resourceId(recoveredGone, SCAFFOLDERS), undefined);
sameIdentities(recoveredGone, firstGone, 'de eerste houder weg: de tweede houdt toch haar identiteit');
const goneKinds = await mergeKinds(firstGone);
assert.equal(await mergeKinds(recoveredGone), goneKinds, 'na herstel weigert de merge zoals in de sessie');
assert.equal(goneKinds, 'niet-gedragen', 'main weigert hier de opslag (knownbug 2236)');
console.log('PROEF 3 GROEN: eerste houder verwijderd, crash, herstel: de tweede houdt id, GlobalId en bron-#id.');
await clearRecovery();

failCopy = true;
const browser = await openAt(source, null);
const browserLoaded = await tick(browser, 'deel 4', true, false);
failCopy = false;
const browserDoc = browserLoaded.docs[0];
assert.equal(browserDoc.ifcSource, undefined, 'de mislukte bronkopie haalde de bronverwijzing weg');
assert(browserDoc.snapshotIdentities?.rows.length, 'de koppeling bleef staan');
const browserBack = await restore(browserLoaded, true, null), browserMain = await restore(withoutField(browserLoaded), true, null);
sameIdentities(browserBack, browser, 'quotaweigering: ids, verwijzingen en GlobalIds als in de sessie', false);
assert.equal(resourceId(browserMain, SCAFFOLDERS), resourceId(browserBack, SCAFFOLDERS), 'quotaweigering: de eerste houder zoals op main');
assert.equal(browserBack.getState().foreignSourceMark?.sourceMissing, true, 'de bestaande toestand bron ontbreekt blijft');
console.log('PROEF 4 GROEN: een mislukte bronkopie in de browser laat de koppeling staan; de eerste houder blijft wat main herstelt.');
await clearRecovery();

const shortSource = withForeignSet([[scaffolders.guid, 'Kort'], [crane.guid, 'Kort'], [calendarB.guid, calendarA.guid]]);
const shortOpened = await openAt(shortSource, join(dir, 'kort.ifc'));
assert.equal(resourceId(shortOpened, SCAFFOLDERS), 'res-ifc-Kort', 'de lezer neemt de korte GlobalId aan');
const shortLoaded = await tick(shortOpened, 'deel 5');
assert(shortLoaded.docs[0].snapshotIdentities?.rows.some(([seed]) => seed === 'res:res-ifc-Kort'), 'de koppeling draagt de korte GlobalId');
const shortBack = await restore(shortLoaded), shortMain = await restore(withoutField(shortLoaded));
sameIdentities(shortBack, shortOpened, 'korte GlobalId naast een geldig kalenderpaar: alles als in de sessie');
assert.equal(resourceId(shortMain, SCAFFOLDERS), 'res-ifc-Kort', 'main houdt de eerste houder');
console.log('PROEF 5 GROEN: twee resources met GlobalId "Kort" naast een geldig kalenderpaar herstellen allebei.');
await clearRecovery();

const appData = join(dir, 'appdata'), projectDir = join(dir, 'project'), images = join(dir, 'crashbeelden');
for (const path of [appData, projectDir, images]) mkdirSync(path);
const replacePath = join(projectDir, 'vervang.ifc');
writeFileSync(replacePath, source);
const ipc = desktop(appData);
const replacing = await freshStore();
await replacing.getState().openOpenedFile({ name: 'vervang.ifc', content: '', bytes: source, ref: { kind: 'path', path: replacePath } });
const replacingId = replacing.getState().activeDocumentId!;
renameFirstTask(replacing, renameFirstTask(replacing, 'Even anders'));
assert.equal(replacing.getState().isDirty, true, 'het document is gewijzigd, de planning is die van de bron');
const crashes: string[] = [];
const recordsNow = () => readdirSync(appData).filter(n => replaceRecordId(n) !== null).length;
const crash = (label: string) => {
  const image = join(images, String(crashes.length));
  cpSync(appData, join(image, 'appdata'), { recursive: true });
  cpSync(projectDir, join(image, 'project'), { recursive: true });
  crashes.push(label);
};
const tracker = new RecoveryDeltaTracker();
let committed = false;
const unregister = registerRecoveryFlush(async () => {
  const s = replacing.getState();
  await runRecoveryTick(tracker, s.activeDocumentId, s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
  if (hasPendingIfcSource()) crash('na stap 0');
  else if (committed) { committed = false; crash('na het vastleggen, vóór het opruimen'); }
});
let places = 0;
ipc.faults.place = async (_from, _to, real) => {
  const answer = real();
  if (++places === 2) { crash('na het plaatsen, vóór het vastleggen'); committed = true; }
  return answer;
};
try {
  assert.equal(await replacing.getState().saveFileForDocument(replacingId), true, 'Ctrl+S op het eigen pad slaagt');
} finally { unregister(); ipc.faults.place = null; ipc.dispose(); }
assert.deepEqual(crashes, ['na stap 0', 'na het plaatsen, vóór het vastleggen', 'na het vastleggen, vóór het opruimen']);
for (const [n, label] of crashes.entries()) {
  for (const [path, part] of [[appData, 'appdata'], [projectDir, 'project']] as const) {
    rmSync(path, { recursive: true });
    cpSync(join(images, String(n), part), path, { recursive: true });
  }
  assert.equal(recordsNow(), 1, `${label}: het herstelrecord staat op schijf`);
  const start = desktop(appData);
  let back: Store;
  try {
    await settlePendingReplaces();
    const loaded = await loadRecovery();
    assert(loaded.docs.find(d => d.id === replacingId)!.snapshotIdentities?.rows.length, `${label}: het manifest op schijf draagt de koppeling`);
    pinMain(loaded, replacing, label);
    back = await restore(loaded, true, appData);
  } finally { start.dispose(); }
  assert.equal(hash(new Uint8Array(readFileSync(replacePath))), hash(source), `${label}: op het doel staat de bron`);
  sameIdentities(back!, replacing, `${label}: na de opstartroute`);
  const first = await saveAs(back!, join(dir, `vervang-herstel-${n}.ifc`));
  assert.equal(hash(first), hash(source), `${label}: de opslag na herstel is de bron, met de vreemde set op de tweede`);
  const second = await saveAs(back!, join(dir, `vervang-herstel-${n}-tweede.ifc`));
  assert.deepEqual(resourceLine(second, CRANE), resourceLine(first, CRANE), `${label}: een tweede opslag verandert de tweede niet`);
}
console.log('PROEF 6 GROEN: Ctrl+S op het eigen pad, crash na stap 0, na het plaatsen en vóór het opruimen; de opstartroute (afhandelen, laden, lezen) houdt de identiteit.');
await clearRecovery();

function enumerations(snapshot: RecoverySnapshotInput) {
  assert.equal(snapshot.archive, undefined, 'de telling gebruikt een document zonder XER-archief');
  const counts = { lists: 0, keys: 0 };
  const watch = <T extends object>(list: T): T => new Proxy(list, {
    get: (target, key, receiver) => { if (key === 'length') counts.lists++; return Reflect.get(target, key, receiver); },
  });
  const { input } = snapshot;
  const watched = { ...input, tasks: watch(input.tasks), resources: watch(input.resources), sequences: watch(input.sequences),
    ...(input.resourceCalendars ? { resourceCalendars: watch(input.resourceCalendars) } : {}),
    ...(input.ifcGlobalIds ? { ifcGlobalIds: new Proxy(input.ifcGlobalIds, { ownKeys: target => { counts.keys++; return Reflect.ownKeys(target); } }) } : {}) };
  return { counts, watched };
}
function mainWriterCounts(snapshot: RecoverySnapshotInput) {
  const { counts, watched } = enumerations(snapshot);
  writeIFC({ ...watched, xerSourceArchive: undefined });
  return { ...counts };
}
function workerCounts(snapshot: RecoverySnapshotInput) {
  const { counts, watched } = enumerations(snapshot);
  let response: RecoveryWorkerResponse | undefined;
  workerScope.postMessage = data => { response = data; };
  workerHandler({ data: { id: -1, snapshot: { ...snapshot, input: watched } } });
  assert(response && !('error' in response), 'de Worker antwoordt met een snapshot');
  return { counts: { ...counts }, identities: response.identities };
}
async function sameManifestAsMain(store: Store, enabled: boolean, label: string) {
  const docs = recoveryDocuments(store, enabled, true), active = store.getState().activeDocumentId;
  const prepared = (await new RecoveryDeltaTracker().prepareAsync(active, docs, transport.serialize))!;
  const main = JSON.stringify(persistedRecoveryState(active, docs).documents);
  assert.equal(JSON.stringify(prepared.documents), main, `${label}: de manifestregels zijn die van main`);
  assert.equal(JSON.stringify(prepared.upserts.map(({ ifc: _ifc, ...metadata }) => metadata)), main, `${label}: de upserts dragen de metadata van main`);
}
const payloadOf = (store: Store) => store.getState().getOpenDocumentPayloads().find(d => d.id === store.getState().activeDocumentId)!.payload;

const offStore = await openAt(source, join(dir, 'flag-uit.ifc'));
offStore.setState(s => { s.ui.featureFlags = { ifcForeignContent: false }; });
const requestsBefore = workerRequests.length;
const offLoaded = await tick(offStore, 'flag uit', false, true, transport.serialize);
assert.equal(workerRequests.length, requestsBefore + 1, 'flag uit: één verzoek aan de Worker');
assert.equal('identities' in workerRequests.at(-1)!.snapshot, false, 'flag uit: het verzoek vraagt geen koppeling');
assert.equal(offLoaded.docs[0].snapshotIdentities, undefined, 'flag uit: het manifest is dat van main');
await sameManifestAsMain(offStore, false, 'flag uit');
const offSnapshot = recoverySnapshotInput(payloadOf(offStore));
const offCounts = workerCounts(offSnapshot);
assert.deepEqual(offCounts.counts, mainWriterCounts(offSnapshot), 'flag uit: de Worker somt niets meer op dan de writer van main');
assert.equal(offCounts.identities, undefined);
const offRead = await readRecoveryDocument(offLoaded.docs[0], offLoaded.archives, false);
const offWithRows = await readRecoveryDocument({ ...offLoaded.docs[0], snapshotIdentities: envelope(offLoaded.docs[0].ifc, rows) }, offLoaded.archives, false);
assert.deepEqual([offWithRows.resources, offWithRows.ifcGlobalIds], [offRead.resources, offRead.ifcGlobalIds], 'flag uit: het herstel leest de koppeling niet');
await clearRecovery();
const plain = await openAt(new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc'))), join(dir, 'gewoon.ifc'));
assert.equal(plain.getState().ifcSource?.foreign, false, 'het voorbeeld heeft geen vreemd deel');
const [firstSeed, secondSeed] = Object.keys(plain.getState().ifcGlobalIds ?? {}).filter(seed => seed.startsWith('res:'));
assert(firstSeed && secondSeed, 'het voorbeeld heeft twee resources met een GlobalId');
plain.setState(s => { s.ifcGlobalIds = { ...s.ifcGlobalIds!, [secondSeed]: s.ifcGlobalIds![firstSeed] }; });
assert.equal((await tick(plain, 'zonder vreemd deel', true, true, transport.serialize)).docs[0].snapshotIdentities, undefined, 'zonder vreemd deel: geen nieuw veld');
assert.equal('identities' in workerRequests.at(-1)!.snapshot, false, 'zonder vreemd deel: het verzoek vraagt geen koppeling');
await sameManifestAsMain(plain, true, 'zonder vreemd deel');
await clearRecovery();
const own = await openAt(model, join(dir, 'zonder-gedeeld.ifc'));
const ownDoc = (await tick(own, 'zonder gedeelde GlobalId', true, true, transport.serialize)).docs[0];
assert(ownDoc.ifcSource && ownDoc.snapshotIdentities === undefined, 'zonder gedeelde GlobalId: geen nieuw veld');
assert.equal(workerRequests.at(-1)!.snapshot.identities, true, 'zonder gedeelde GlobalId: het document is geschikt');
await sameManifestAsMain(own, true, 'zonder gedeelde GlobalId');
const ownSnapshot = recoverySnapshotInput(payloadOf(own), true), ownMain = mainWriterCounts(ownSnapshot), ownCounts = workerCounts(ownSnapshot);
assert.equal(ownCounts.counts.lists, ownMain.lists, 'zonder gedeelde GlobalId: de Worker somt geen objecten op');
assert.equal(ownCounts.counts.keys, ownMain.keys + 1, 'zonder gedeelde GlobalId: alleen één telling van de bewaarde GlobalIds');
assert.equal(ownCounts.identities, undefined);
const sharedSnapshot = recoverySnapshotInput(payloadOf(opened), true), sharedCounts = workerCounts(sharedSnapshot);
assert(sharedCounts.counts.lists > mainWriterCounts(sharedSnapshot).lists && sharedCounts.identities, 'met gedeelde GlobalIds somt de Worker wel op (de telling werkt)');
await clearRecovery();
console.log('PROEF 7 GROEN: met de flag uit, zonder vreemd deel en zonder gedeelde GlobalId geen nieuw veld, manifestregels en snapshot van main; de Worker somt dan geen objecten op.');

const snapshotInput = recoverySnapshotInput(opened.getState().getOpenDocumentPayloads().find(d => d.id === sessionId)!.payload, true);
const direct = writeRecoverySnapshot(snapshotInput), cloned = structuredClone(writeRecoverySnapshot(structuredClone(snapshotInput)));
assert(direct.identities?.rows.length, 'de herstelsnapshot heeft een koppeling');
assert.deepEqual(cloned, direct, 'door de Worker: dezelfde tekst en dezelfde koppeling');
assert.deepEqual(JSON.parse(JSON.stringify(direct.identities)), direct.identities, 'door JSON (desktop): dezelfde koppeling');
assert.equal(recoveryIdentityRows([['res:__proto__', 'G', 'W'], ['res:constructor', 'G', 'V']])?.length, 2, 'zaden als __proto__ en constructor zijn gewone sleutels');
console.log('PROEF 8 GROEN: Worker en JSON geven dezelfde koppeling; vreemde zaden zijn gewone sleutels.');

async function failedRoundThenUndo(route: 'browser' | 'desktop') {
  const appData = route === 'desktop' ? join(dir, 'appdata-sol') : null;
  if (appData) mkdirSync(appData);
  const ipc = appData ? desktop(appData) : null;
  try {
    const live = await openAt(source, appData ? join(dir, 'sol-desktop.ifc') : null);
    const id = live.getState().activeDocumentId!;
    live.getState().newDocument();
    const otherId = live.getState().activeDocumentId!;
    live.getState().switchDocument(id);
    const tracker = new RecoveryDeltaTracker();
    const round = () => runRecoveryTick(tracker, live.getState().activeDocumentId,
      live.getState().getOpenDocumentPayloads().map(({ id: docId, payload }) => recoverySourceDocument(docId, payload, true)), undefined, undefined, () => {});
    const stored = async () => (await loadRecovery()).docs.find(d => d.id === id)!;
    const snapshotWrites = () => appData
      ? (JSON.parse(readFileSync(join(appData, readdirSync(appData).find(n => n.endsWith('.documents.json'))!), 'utf8')) as { documents: { id: string; ifc: string }[] }).documents.find(d => d.id === id)!.ifc
      : String(docRecordPuts);
    const firstId = resourceId(live, SCAFFOLDERS)!, secondId = resourceId(live, CRANE)!;
    assert.equal(await round(), true, `${route}: snapshot A`);
    const a = await stored();
    assert(a.snapshotIdentities?.rows.some(([seed, , written]) => seed === `res:${firstId}` && written === scaffolders.guid), `${route}: in A schrijft de eerste resource G`);
    live.getState().removeResource(firstId);
    const b = writeRecoverySnapshot(recoverySnapshotInput(payloadOf(live), true));
    assert(b.identities?.rows.some(([seed, , written]) => seed === `res:${secondId}` && written === scaffolders.guid), `${route}: in B krijgt de tweede resource G`);
    if (ipc) ipc.faults.beforeOpen = path => { if (path.endsWith('.documents.json.tmp')) throw new Error('manifestruimte'); };
    else webFault = (store, value) => store === 'records' && value.id.includes('::doc::');
    try { await assert.rejects(round(), /manifestruimte|snapshotquotum/, `${route}: ronde B strandt`); }
    finally { if (ipc) ipc.faults.beforeOpen = null; webFault = null; }
    const afterFailure = await stored();
    assert.deepEqual([afterFailure.ifc, afterFailure.snapshotIdentities], [a.ifc, a.snapshotIdentities], `${route}: na de mislukte ronde staat A er nog`);
    live.getState().undo();
    assert.deepEqual([resourceId(live, SCAFFOLDERS), resourceId(live, CRANE)], [firstId, secondId], `${route}: Ctrl+Z zet de eerste resource terug`);
    const beforeReuse = snapshotWrites();
    await round();
    const afterUndo = await stored();
    assert.deepEqual([afterUndo.ifc, afterUndo.snapshotIdentities], [a.ifc, a.snapshotIdentities], `${route}: na Ctrl+Z staat A er met de koppeling van A`);
    live.getState().switchDocument(otherId);
    assert.equal(await round(), true, `${route}: een ronde met alleen een manifestwijziging`);
    assert.equal(snapshotWrites(), beforeReuse, `${route}: de rondes na Ctrl+Z schreven geen nieuwe snapshot`);
    const reused = await stored();
    assert.equal(reused.ifc, a.ifc, `${route}: de manifestronde hergebruikt snapshot A`);
    assert.deepEqual(reused.snapshotIdentities, a.snapshotIdentities, `${route}: de bewaarde koppeling is die van A`);
    const back = await restore(await loadRecovery(), true, appData);
    for (const store of [back, live]) store.getState().switchDocument(id);
    assert.deepEqual([resourceId(back, SCAFFOLDERS), resourceId(back, CRANE)], [firstId, secondId], `${route}: beide resources houden hun id`);
    assert.deepEqual([back.getState().ifcSource!.stepIds[`res:${firstId}`], back.getState().ifcSource!.stepIds[`res:${secondId}`]],
      [Number(scaffolders.stepId), Number(crane.stepId)], `${route}: beide resources houden hun bron-#id`);
    sameIdentities(back, live, `${route}: na herstel als in de sessie`);
    live.getState().redo();
    assert.equal(resourceId(live, SCAFFOLDERS), undefined, `${route}: Opnieuw verwijdert de eerste resource weer`);
    assert.equal(await round(), true, `${route}: snapshot B`);
    const committedB = await stored();
    assert.deepEqual([committedB.ifc, committedB.snapshotIdentities], [b.ifc, b.identities], `${route}: B staat er met de koppeling van B`);
    const backB = await restore(await loadRecovery(), true, appData);
    backB.getState().switchDocument(id);
    assert.deepEqual([resourceId(backB, SCAFFOLDERS), resourceId(backB, CRANE), backB.getState().ifcSource!.stepIds[`res:${secondId}`]],
      [undefined, secondId, Number(crane.stepId)], `${route}: na herstel van B houdt de tweede resource id en bron-#id`);
    return { a, b, id, secondId };
  } finally {
    ipc?.dispose();
    await clearRecovery();
  }
}
const solBrowser = await failedRoundThenUndo('browser');
await failedRoundThenUndo('desktop');
console.log('PROEF 9 GROEN: snapshot A, ronde B strandt, Ctrl+Z, manifestronde: browser en desktop bewaren de koppeling van A en beide resources houden id en bron-#id; Opnieuw bewaart B met de koppeling van B.');

const malformedStore = await openAt(source, null);
const malformedId = malformedStore.getState().activeDocumentId!;
malformedStore.getState().newDocument();
const malformedOther = malformedStore.getState().activeDocumentId!;
const malformedInitial = await tick(malformedStore, 'deel 10', true, false);
const intact = malformedInitial.docs.find(d => d.id === malformedId)!.snapshotIdentities!;
const [row, ...rest] = intact.rows;
const hole = (at: number) => { const changed: unknown[] = [...row]; delete changed[at]; return changed; };
const gap: unknown[] = [...intact.rows]; delete gap[0];
const forms: readonly (readonly [string, unknown])[] = [
  ['lege positie 0', { ...intact, rows: [hole(0), ...rest] }],
  ['lege positie 1', { ...intact, rows: [hole(1), ...rest] }],
  ['lege positie 2', { ...intact, rows: [hole(2), ...rest] }],
  ['een rij als object', { ...intact, rows: [{ 0: row[0], 1: row[1], 2: row[2], length: 3 }, ...rest] }],
  ['expliciet null in de rij', { ...intact, rows: [[row[0], null, row[2]], ...rest] }],
  ['een rij null', { ...intact, rows: [null, ...rest] }],
  ['een lege plek in de lijst', { ...intact, rows: gap }],
  ['het veld als object zonder sha256', { version: 1, rows: [row] }],
  ['het veld als lijst', intact.rows],
  ['het veld null', null],
  ['de sha256 van andere bytes', { ...intact, sha256: hash(Buffer.from('andere bytes')) }],
];
const records = db.store('records');
const manifestKey = [...records.keys()].find(k => k.endsWith('::manifest'))!;
const manifestRecord = structuredClone(records.get(manifestKey)) as { documents: { id: string; snapshotIdentities?: unknown }[] };
const mainBack = await restore(withoutField(malformedInitial), true, null);
const notices = (store: Store) => store.getState().ui.notifications.map(n => [n.messageKey, n.severity]);
const documentIdentities = (store: Store, docId: string) => { store.getState().switchDocument(docId); return JSON.stringify(identities(store)); };
const mainOther = documentIdentities(mainBack, malformedOther), mainModel = documentIdentities(mainBack, malformedId);
malformedStore.getState().switchDocument(malformedId);
assert.notEqual(resourceId(mainBack, CRANE), resourceId(malformedStore, CRANE), 'zonder koppeling geeft main de tweede resource een ander id');
for (const [label, value] of forms) {
  const changed = structuredClone(manifestRecord);
  changed.documents.find(d => d.id === malformedId)!.snapshotIdentities = value;
  records.set(manifestKey, changed);
  const loaded = await loadRecovery();
  assert.deepEqual([loaded.docs.length, loaded.activeDocumentId], [2, malformedInitial.activeDocumentId], `${label}: beide documenten en de actieve keuze`);
  const tried = await restore(loaded, true, null);
  assert.deepEqual(notices(tried), notices(mainBack), `${label}: de meldingen van main`);
  assert.equal(documentIdentities(tried, malformedId), mainModel, `${label}: het herstel van main`);
  assert.equal(documentIdentities(tried, malformedOther), mainOther, `${label}: het andere document ongemoeid`);
}
records.set(manifestKey, manifestRecord);
await clearRecovery();
console.log(`PROEF 10 GROEN: ${forms.length} beschadigde vormen (lege positie 0, 1 en 2, rij als object, null, lege plek, veldvormen, andere sha256) geven het herstel en de meldingen van main; het andere document blijft ongemoeid.`);

const mixed = withField({ activeDocumentId: solBrowser.id, docs: [{ ...solBrowser.a, snapshotIdentities: undefined }], archives: new Map() }, solBrowser.id, solBrowser.b.identities);
const mixedRead = await readRecoveryDocument(mixed.docs[0], mixed.archives, true);
const aRead = await readRecoveryDocument({ ...solBrowser.a, snapshotIdentities: undefined }, mixed.archives, true);
assert.deepEqual(mixedRead.resources, aRead.resources, 'de koppeling van B op de bytes van A: het herstel van main');
const forced = withRecoveryIdentities(aRead, solBrowser.b.identities!.rows);
assert.equal(forced.resources.find(r => r.name === SCAFFOLDERS)!.id, solBrowser.secondId, 'zonder de sha256-toets kreeg de eerste resource hier het id van de tweede');
console.log('PROEF 11 GROEN: de koppeling van B op de bytes van A wordt niet toegepast; zonder de sha256-toets kreeg de eerste resource het id van de tweede.');
