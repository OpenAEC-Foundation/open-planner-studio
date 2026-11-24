import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installNodeFileIpc } from './nodeFileIpc';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { mergeProblems, tryMerge } from './ifcMergeKern';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { hasPendingIfcSource } from '@/services/recovery/recoveryPendingSource';
import { replaceRecordId, settlePendingReplaces } from '@/services/fileAccess/replaceRecords';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { recoverySnapshotInput, serializeRecoverySnapshot, writeRecoverySnapshot } from '@/services/recovery/recoverySnapshotInput';
import { recoveryIdentityRows, type RecoveryIdentityRow } from '@/services/recovery/recoveryIdentity';
import { ifcGuid128 } from '@/services/ifc/ifcWriter';

installDeterminism();
await loadStore();
let failCopy = false;
installFakeRecoveryIndexedDb({
  onPut: store => { if (store === 'sources' && failCopy) throw new DOMException('quotum', 'QuotaExceededError'); },
});
const session = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v),
  removeItem: (k: string) => session.delete(k),
} });

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = mkdtempSync(join(tmpdir(), 'ops-gedeelde-globalids-'));
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const SCAFFOLDERS = 'Steigerbouwers', CRANE = 'Kraanmachinisten', THIRD = 'Derde ploeg';

type Store = ReturnType<Awaited<ReturnType<typeof loadStore>>['createAppStoreContext']>['store'];
type Loaded = Awaited<ReturnType<typeof loadRecovery>>;
function desktop(appDataDir?: string) {
  const ipc = installNodeFileIpc(appDataDir ? { appDataDir } : {});
  const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  const invoke = internals.invoke;
  let target: string | null = null;
  internals.invoke = async (c, a, o) => c === 'plugin:dialog|save' ? target
    : c === 'plugin:fs|read_file' ? new Uint8Array(readFileSync((a as { path: string }).path)) : invoke(c, a, o);
  return { ...ipc, choose: (p: string) => { target = p; } };
}
async function freshStore(): Promise<Store> {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  return store;
}
async function openAt(data: Uint8Array, path: string | null): Promise<Store> {
  if (path) writeFileSync(path, data);
  const store = await freshStore();
  await store.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes: data, ref: path ? { kind: 'path', path } : null });
  return store;
}
async function saveAs(store: Store, name: string): Promise<Uint8Array> {
  const ipc = desktop(), target = join(dir, name); ipc.choose(target);
  try { await store.getState().saveFileAs(); } finally { ipc.dispose(); }
  assert(existsSync(target), `bestand geschreven: ${name} (${store.getState().ui.notifications.map(n => n.messageKey).join(', ')})`);
  return new Uint8Array(readFileSync(target));
}
function pinMain(loaded: Loaded, store: Store, label: string, enabled = true) {
  let pinned = 0;
  for (const { id, payload } of store.getState().getOpenDocumentPayloads()) {
    const doc = loaded.docs.find(d => d.id === id);
    if (!doc) continue;
    assert.equal(doc.ifc, serializeRecoverySnapshot(recoverySourceDocument(id, payload, enabled).source), `${label}: de snapshot is precies die van main`);
    pinned++;
  }
  assert(pinned > 0, `${label}: er is een snapshot vergeleken`);
}
async function tick(store: Store, label: string, enabled = true, onDesktop = true) {
  const capture = onDesktop ? desktop() : null;
  let docs;
  try { docs = store.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, enabled)); }
  finally { capture?.dispose(); }
  await runRecoveryTick(new RecoveryDeltaTracker(), store.getState().activeDocumentId, docs, undefined, undefined, () => {});
  const loaded = await loadRecovery();
  pinMain(loaded, store, label, enabled);
  return loaded;
}
async function restore(loaded: Loaded, enabled = true, appDataDir?: string | null): Promise<Store> {
  const store = await freshStore();
  const ipc = appDataDir === null ? null : desktop(appDataDir);
  try {
    const inputs = [];
    for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, enabled));
    assert.equal(store.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
  } finally { ipc?.dispose(); }
  return store;
}
const withoutField = (loaded: Loaded): Loaded => ({ ...loaded, docs: loaded.docs.map(({ snapshotIdentities: _rows, ...doc }) => doc) });
const withRows = (loaded: Loaded, id: string, rows: unknown): Loaded => ({
  ...loaded, docs: loaded.docs.map(doc => doc.id === id ? { ...doc, snapshotIdentities: rows as readonly RecoveryIdentityRow[] } : doc),
});

function resourceLine(data: Uint8Array, name: string) {
  const index = scanForeignStep(data);
  for (let c = 0; c < index.count; c++) {
    if (!index.isEntity(c) || !index.type(c).endsWith('RESOURCE')) continue;
    if (index.argTokens(c)![2] === `'${name}'`) return { stepId: index.id(c), type: index.type(c), guid: index.globalId(c) };
  }
  return null;
}
const byText = (a: unknown, b: unknown) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
function identities(store: Store, withSource = true) {
  const s = store.getState();
  const live = new Map<string, ReadonlySet<string>>([
    ['task', new Set(s.tasks.map(t => t.id))], ['res', new Set(s.resources.map(r => r.id))],
    ['cal', new Set([s.calendar.id, ...s.calendars.map(c => c.id)])], ['seq', new Set(s.sequences.map(q => q.id))],
  ]);
  const isLive = (seed: string) => {
    const at = seed.indexOf(':'), ids = live.get(seed.slice(0, at));
    return !ids || ids.has(seed.slice(at + 1));
  };
  return {
    resources: s.resources.map(r => [r.id, r.name, r.calendarId ?? null]).sort(byText),
    calendars: s.calendars.map(c => [c.id, c.name]).sort(byText),
    sequences: s.sequences.map(q => [q.id, q.predecessorId, q.successorId]).sort(byText),
    tasks: s.tasks.map(t => [t.id, t.name, t.calendarId ?? null, [...t.resourceIds].sort()]).sort(byText),
    assignments: s.assignments.map(a => [a.taskId, a.resourceId]).sort(byText),
    globalIds: Object.entries(s.ifcGlobalIds ?? {}).filter(([seed]) => isLive(seed)).sort(byText),
    stepIds: withSource ? Object.entries(s.ifcSource?.stepIds ?? {}).sort(byText) : [],
  };
}
const sameIdentities = (actual: Store, expected: Store, label: string, withSource = true) =>
  assert.deepEqual(identities(actual, withSource), identities(expected, withSource), label);
const resourceId = (store: Store, name: string) => store.getState().resources.find(r => r.name === name)?.id;
const renameFirstTask = (store: Store, name: string) => {
  const task = store.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0)!;
  const previous = task.name;
  store.getState().updateTask(task.id, { name });
  return previous;
};
const mergeKinds = async (store: Store) => {
  const outcome = await tryMerge(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
  return outcome.ok ? 'ok' : outcome.kinds.join(',');
};
function entities(data: Uint8Array, type: string) {
  const index = scanForeignStep(data), out: { stepId: string; type: string; guid: string; name: string }[] = [];
  for (let c = 0; c < index.count; c++) {
    if (index.isEntity(c) && index.type(c) === type) out.push({ stepId: index.id(c), type, guid: index.globalId(c), name: index.argTokens(c)![2] });
  }
  return out;
}

const model = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const builder = await openAt(model, join(dir, 'bouw.ifc'));
for (const name of [SCAFFOLDERS, CRANE, THIRD]) builder.getState().addResource({ name, type: 'LABOR', description: '', maxUnits: 1, costPerHour: 0 });
const { id: _projectCalendar, ...calendarBody } = builder.getState().calendar; void _projectCalendar;
builder.getState().addCalendar({ ...calendarBody, name: 'Ploeg A' });
const crewB = builder.getState().addCalendar({ ...calendarBody, name: 'Ploeg B' });
const craneAtBuild = resourceId(builder, CRANE)!;
builder.getState().updateResource(craneAtBuild, { calendarId: crewB });
const assignedTask = builder.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0 && t.resourceIds.length === 0)!;
builder.getState().assignResource(assignedTask.id, craneAtBuild, 1);
assert(builder.getState().assignments.some(a => a.resourceId === craneAtBuild), 'de tweede resource is toegewezen');
const built = await saveAs(builder, 'bouw-opgeslagen.ifc');
const builtText = Buffer.from(built).toString('latin1');
const occurrences = (guid: string) => builtText.split(guid).length - 1;
const scaffolders = resourceLine(built, SCAFFOLDERS)!, crane = resourceLine(built, CRANE)!, third = resourceLine(built, THIRD)!;
const calendars = entities(built, 'IFCWORKCALENDAR'), calendarA = calendars.find(c => c.name === "'Ploeg A'")!, calendarB = calendars.find(c => c.name === "'Ploeg B'")!;
const [sequenceA, sequenceB] = entities(built, 'IFCRELSEQUENCE').filter(e => occurrences(e.guid) === 1);
const [taskA, taskB] = entities(built, 'IFCTASK').filter(e => occurrences(e.guid) === 1);
const pairs = [[scaffolders, crane], [calendarA, calendarB], [sequenceA, sequenceB], [taskA, taskB]] as const;
for (const [first, second] of pairs) assert(first && second && occurrences(first.guid) === 1, 'de bouwbron heeft van elke soort een paar');
assert(occurrences(crane.guid) > 1, 'de tweede resource heeft een verwijzing (de toewijzing)');
const H = ifcGuid128(`res:res-ifc-${scaffolders.guid}`);
const index = scanForeignStep(built);
let highest = 0, foreignApplication = '';
for (let c = 0; c < index.count; c++) {
  if (!index.isEntity(c)) continue;
  highest = Math.max(highest, Number(index.id(c)));
  if (index.type(c) === 'IFCAPPLICATION' && index.argTokens(c)![2] === "'Corpus modelleur'") foreignApplication = `#${index.id(c)}`;
}
let history = '';
for (let c = 0; c < index.count && !history; c++) {
  if (index.isEntity(c) && index.type(c) === 'IFCOWNERHISTORY' && index.argTokens(c)![1] === foreignApplication) history = `#${index.id(c)}`;
}
assert(history, 'de fixture heeft een owner history van een ander programma');
const [pset, prop, rel] = [highest + 1, highest + 2, highest + 3];
const withForeignSet = (replacements: readonly (readonly [string, string])[]) => {
  let out = builtText;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  return Uint8Array.from(out.replace(/ENDSEC;\r?\nEND-ISO-10303-21;/, end => [
    `#${pset}=IFCPROPERTYSET('1VreemdePsetOpKraanAaa',${history},'Vreemd_Planning',$,(#${prop}));`,
    `#${prop}=IFCPROPERTYSINGLEVALUE('Opmerking',$,IFCLABEL('van een ander programma'),$);`,
    `#${rel}=IFCRELDEFINESBYPROPERTIES('2VreemdeRelOpKraanAaaa',${history},$,$,(#${crane.stepId}),#${pset});`,
    end,
  ].join('\n')), c => c.charCodeAt(0));
};
const source = withForeignSet([...pairs.map(([first, second]) => [second.guid, first.guid] as const), [third.guid, H]]);
assert.equal(resourceLine(source, THIRD)!.guid, H, 'de derde resource draagt H = ifcGuid128("res:res-ifc-" + G)');

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
const crashed = await tick(opened, 'deel 1');
const rows = crashed.docs.find(d => d.id === sessionId)!.snapshotIdentities!;
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
const fromSession = await saveAs(opened, 'sessie-opslag.ifc'), fromRecovery = await saveAs(recovered, 'herstel-opslag.ifc');
assert.equal(hash(fromRecovery), hash(fromSession), 'herstel schrijft dezelfde bytes als de sessie');
assert.equal(hash(fromRecovery), hash(source), 'en dat is de bron zelf');
assert.deepEqual(mergeProblems(source, fromRecovery), []);
assert.deepEqual(resourceLine(fromRecovery, CRANE), { ...crane, guid: scaffolders.guid }, 'de tweede staat op haar #id met haar GlobalId');
console.log('PROEF 1 GROEN: bewerken, Ctrl+Z, tabbladwissel, crash, herstel: ids, verwijzingen, GlobalIds en bronkaart als in de sessie; de derde resource met H blijft de derde.');

const craneRow = rows.find(row => row[0] === `res:${craneId}`)!;
const broken: readonly (readonly [string, unknown, boolean])[] = [
  ['dubbele sleutel', [...rows, rows[0]], false],
  ['ontbrekende identiteit', rows.map(row => row === craneRow ? [row[0], row[1], ifcGuid128('bestaat-niet')] : row), true],
  ['een rij te veel', [...rows, ['res:res-erbij', craneRow[1], craneRow[2]]], false],
  ['een kapotte rij', [...rows.slice(1), [rows[0][0], rows[0][1]]], false],
];
for (const [label, wrong, shapeOk] of broken) {
  assert.equal(recoveryIdentityRows(wrong) !== null, shapeOk, `${label}: de vormtoets`);
  const tried = await restore(withRows(crashed, sessionId, wrong)), main = await restore(withoutField(crashed));
  for (const store of [tried, main]) store.getState().switchDocument(sessionId);
  sameIdentities(tried, main, `${label}: niets half toegepast, het herstel van main`);
}
console.log('PROEF 2 GROEN: een koppeling die niet klopt (dubbele sleutel, ontbrekende identiteit, een rij te veel, een kapotte rij) laat het herstel van main staan.');
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
assert(browserDoc.snapshotIdentities?.length, 'de koppeling bleef staan');
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
assert(shortLoaded.docs[0].snapshotIdentities?.some(([seed]) => seed === 'res:res-ifc-Kort'), 'de koppeling draagt de korte GlobalId');
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
    assert(loaded.docs.find(d => d.id === replacingId)!.snapshotIdentities?.length, `${label}: het manifest op schijf draagt de koppeling`);
    pinMain(loaded, replacing, label);
    back = await restore(loaded, true, appData);
  } finally { start.dispose(); }
  assert.equal(hash(new Uint8Array(readFileSync(replacePath))), hash(source), `${label}: op het doel staat de bron`);
  sameIdentities(back!, replacing, `${label}: na de opstartroute`);
  const first = await saveAs(back!, `vervang-herstel-${n}.ifc`);
  assert.equal(hash(first), hash(source), `${label}: de opslag na herstel is de bron, met de vreemde set op de tweede`);
  const second = await saveAs(back!, `vervang-herstel-${n}-tweede.ifc`);
  assert.deepEqual(resourceLine(second, CRANE), resourceLine(first, CRANE), `${label}: een tweede opslag verandert de tweede niet`);
}
console.log('PROEF 6 GROEN: Ctrl+S op het eigen pad, crash na stap 0, na het plaatsen en vóór het opruimen; de opstartroute (afhandelen, laden, lezen) houdt de identiteit.');
await clearRecovery();

const offStore = await openAt(source, join(dir, 'flag-uit.ifc'));
const offLoaded = await tick(offStore, 'flag uit', false);
assert.equal(offLoaded.docs[0].snapshotIdentities, undefined, 'flag uit: het manifest is dat van main');
const offRead = await readRecoveryDocument(offLoaded.docs[0], offLoaded.archives, false);
const offWithRows = await readRecoveryDocument({ ...offLoaded.docs[0], snapshotIdentities: rows }, offLoaded.archives, false);
assert.deepEqual([offWithRows.resources, offWithRows.ifcGlobalIds], [offRead.resources, offRead.ifcGlobalIds], 'flag uit: het herstel leest de koppeling niet');
await clearRecovery();
const plain = await openAt(new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc'))), join(dir, 'gewoon.ifc'));
assert.equal(plain.getState().ifcSource?.foreign, false, 'het voorbeeld heeft geen vreemd deel');
const [firstSeed, secondSeed] = Object.keys(plain.getState().ifcGlobalIds ?? {}).filter(seed => seed.startsWith('res:'));
assert(firstSeed && secondSeed, 'het voorbeeld heeft twee resources met een GlobalId');
plain.setState(s => { s.ifcGlobalIds = { ...s.ifcGlobalIds!, [secondSeed]: s.ifcGlobalIds![firstSeed] }; });
assert.equal((await tick(plain, 'zonder vreemd deel')).docs[0].snapshotIdentities, undefined, 'zonder vreemd deel: geen nieuw veld');
await clearRecovery();
const own = await openAt(model, join(dir, 'zonder-gedeeld.ifc'));
const ownDoc = (await tick(own, 'zonder gedeelde GlobalId')).docs[0];
assert(ownDoc.ifcSource && ownDoc.snapshotIdentities === undefined, 'zonder gedeelde GlobalId: geen nieuw veld');
await clearRecovery();
console.log('PROEF 7 GROEN: met de flag uit, zonder vreemd deel en zonder gedeelde GlobalId geen nieuw veld; de snapshot is overal die van main.');

const snapshotInput = recoverySnapshotInput(opened.getState().getOpenDocumentPayloads().find(d => d.id === sessionId)!.payload);
const direct = writeRecoverySnapshot(snapshotInput), cloned = structuredClone(writeRecoverySnapshot(structuredClone(snapshotInput)));
assert(direct.identities?.length, 'de herstelsnapshot heeft een koppeling');
assert.deepEqual(cloned, direct, 'door de Worker: dezelfde tekst en dezelfde koppeling');
assert.deepEqual(JSON.parse(JSON.stringify(direct.identities)), direct.identities, 'door JSON (desktop): dezelfde koppeling');
assert.equal(recoveryIdentityRows([['res:__proto__', 'G', 'W'], ['res:constructor', 'G', 'V']])?.length, 2, 'zaden als __proto__ en constructor zijn gewone sleutels');
console.log('PROEF 8 GROEN: Worker en JSON geven dezelfde koppeling; vreemde zaden zijn gewone sleutels.');
