// Web-crashherstel "later" (audit 2026-09-26): kiest de gebruiker in het herstel-venster voor
// uitstellen, dan moeten de gevonden snapshots de volgende crashherstel-rondes overleven. Op het web
// deelt een herlaad dezelfde sessie-id; `saveWeb` overschreef daardoor het manifest en wiste elk
// documentrecord dat niet meer open was — precies de uitgestelde snapshots.
// Loopt door de publieke grens van `recoveryStore` tegen een minimale IndexedDB-/sessionStorage-dubbel.
// Het tweede deel doet hetzelfde voor de desktop (Tauri), tegen een nep-`invoke` voor plugin-fs.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { ownRecoveryNames, type RecoveryManifest } from '@/hooks/recoveryPaths';
import {
  clearOwnRecovery, clearRecovery, fullRecoverySave, holdRecoveryForLater, loadRecovery, saveRecovery,
  RECOVERY_MANIFEST_VERSION, RecoveryManifestError,
} from '@/services/recovery/recoveryStore';
import { IndexedDbUpgradeBlockedError, openDbStores } from '@/utils/idb';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

let failRecordRead = false;
const idb = installFakeRecoveryIndexedDb({ onRead: (store, method) => {
  if (failRecordRead && store === 'records' && method === 'getAll') throw new Error('Gesimuleerde IDB-leesfout');
} });
const session = new Map<string, string>();
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => { session.set(k, v); },
  removeItem: (k: string) => { session.delete(k); },
};

// Knownbug 99: op een HTTP-adres ontbreekt randomUUID. Forceer bovendien een bezette
// eerste sessieclaim, zodat ook het duplicaat-tabpad een nieuwe id moet maken.
const uuidDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
const randomDescriptor = Object.getOwnPropertyDescriptor(Math, 'random')!;
Object.defineProperty(Math, 'random', {
  configurable: true,
  value: () => { throw new Error('Herstelidentiteiten mogen geen Math.random gebruiken'); },
});
const valuesDescriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
const getRandomValues = crypto.getRandomValues.bind(crypto);
const randomByteLengths: number[] = [];
Object.defineProperty(crypto, 'getRandomValues', {
  configurable: true,
  value: (bytes: Uint8Array) => {
    randomByteLengths.push(bytes.byteLength);
    return getRandomValues(bytes);
  },
});
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const claimed: string[] = [];
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { locks: {
    request: (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
      claimed.push(name);
      callback(claimed.length <= 2 ? null : { name });
      return Promise.resolve();
    },
  } },
});

const doc = (id: string) => ({ id, ifc: `ISO-10303-21; /* ${id} */`, filePath: null, isDirty: true, datesAsRecorded: false });
const ids = async () => (await loadRecovery()).docs.map((d) => d.id).sort();

// Vorige sessie liet document A achter.
await saveRecovery(fullRecoverySave('A', [doc('A')]));
eq('voorwaarde: A staat klaar voor herstel', await ids(), ['A']);
const firstSession = session.get('ops-recovery-session');
eq('zonder randomUUID ontstaat een eigen opgeslagen sessie-id', !!firstSession && firstSession !== 'default', true);
eq('de HTTP-terugval bewaart alle 128 willekeurige bits als hex', /^inst-[0-9a-f]{32}$/.test(firstSession ?? ''), true);
eq('aanmaken en duplicaat-tabrotatie gebruiken elk 16 cryptografische bytes', randomByteLengths, [16, 16]);
eq('een bezette claim krijgt precies één retry en een nieuwe id', claimed.length, 3);
eq('de retry gebruikt dezelfde eerste id', claimed[0], claimed[1]);
eq('het gedupliceerde tab krijgt een andere id', claimed[2] !== claimed[0], true);


// Gebruiker kiest "later"; daarna schrijft de crashherstel-ronde het nieuwe (lege) document B.
// Ook een aanwezige maar werpende randomUUID gebruikt de sterke HTTP-terugval.
Object.defineProperty(crypto, 'randomUUID', {
  configurable: true,
  value: () => { throw new Error('randomUUID is niet beschikbaar'); },
});
await holdRecoveryForLater();
eq('uitstellen roteert de sessie ook zonder randomUUID', session.get('ops-recovery-session') !== firstSession, true);
eq('uitstellen na een werpende randomUUID gebruikt opnieuw 16 cryptografische bytes', randomByteLengths, [16, 16, 16]);
await saveRecovery(fullRecoverySave('B', [doc('B')]));
eq('A overleeft de volgende crashherstel-ronde', await ids(), ['A', 'B']);

// Nog een ronde met een ander document: A blijft, B's generatie volgt het open-venster.
await saveRecovery(fullRecoverySave('C', [doc('C')]));
eq('A blijft vastgehouden, eigen generatie ruimt B op', await ids(), ['A', 'C']);

// Een tweede keer uitstellen stapelt, niet vervangen.
await holdRecoveryForLater();
await saveRecovery(fullRecoverySave('D', [doc('D')]));
eq('twee vastgehouden generaties + de eigen', await ids(), ['A', 'C', 'D']);

// Hetzelfde document in eigen én vastgehouden generatie: één keer, de eigen (nieuwste) wint.
await saveRecovery(fullRecoverySave('A', [doc('A'), doc('D')]));
eq('dubbele id wordt één keer aangeboden', await ids(), ['A', 'C', 'D']);

// "Niet herstellen" / schone exit wist alles, ook de vastgehouden generaties.
await clearRecovery();
eq('clearRecovery wist eigen + vastgehouden', await ids(), []);
eq('geen records meer over', idb.store('records').size + idb.store('xer-archives').size, 0);

// ── Versiecontract (knownbug 96), echte opslaggrens met bestaande dubbels ────────────────────
const rejectsManifest = async (label: string, action: () => Promise<unknown>) => {
  let refused = false;
  try { await action(); } catch (error) { refused = error instanceof RecoveryManifestError; }
  eq(label + ': expliciete manifestweigering', refused, true);
};
const webBytes = () => JSON.stringify(['records', 'xer-archives'].map(name =>
  [name, [...idb.store(name)].sort(([a], [b]) => a.localeCompare(b))]),
  (_key, value: unknown) => {
    // Alleen observeren: ook het verschil tussen een hole en een aanwezige undefined/null bewaren.
    if (Array.isArray(value) && Object.keys(value).length < value.length) {
      return { type: 'sparse-array', length: value.length, entries: Object.entries(value) };
    }
    return value === undefined ? { type: 'undefined' }
      : typeof value === 'number' && !Number.isFinite(value) ? { type: 'number', value: String(value) } : value;
  });
const webSid = session.get('ops-recovery-session')!;
const webDoc = { ...doc('oud'), filePath: 'oud.ifc', isDirty: false };
const webRecord = { id: webSid + '::doc::oud', kind: 'doc', sessionId: webSid,
  docId: 'oud', ifc: webDoc.ifc, filePath: webDoc.filePath, isDirty: false, addedAt: 1 };
const webManifest = { id: webSid + '::manifest', kind: 'manifest', sessionId: webSid,
  version: 5, activeDocumentId: 'oud', addedAt: 1,
  documents: [{ id: 'oud', ifc: webRecord.id, filePath: 'oud.ifc', isDirty: false,
    datesAsRecorded: true, siteFileId: 'site-oud', siteFileVersion: 'basis-oud' }] };
for (const version of [1, 2, 3, 4, 5]) {
  idb.store('records').set(webRecord.id, webRecord);
  idb.store('records').set(webManifest.id, { ...webManifest, version });
  const loaded = await loadRecovery();
  eq('web v' + version + ': bytes en metadata blijven behouden', loaded.docs.map(d =>
    [d.ifc, d.filePath, d.isDirty, d.datesAsRecorded, d.siteFileId, d.siteFileVersion]),
  [[webDoc.ifc, 'oud.ifc', false, true, 'site-oud', 'basis-oud']]);
  await saveRecovery(fullRecoverySave('oud', [webDoc]));
  eq('web v' + version + ': volgende commit gebruikt actueel contract',
    (idb.store('records').get(webManifest.id) as { version: number }).version, 5);
  idb.store('records').set(webManifest.id, { ...webManifest, version, documents: [] });
  eq('web v' + version + ': geldig leeg manifest blijft leesbaar', (await loadRecovery()).docs, []);
  await clearRecovery();
}
// Historische webvorm b1c174f4e: géén version, docIds en metadata in doc-record.
idb.store('records').set(webRecord.id, webRecord);
idb.store('records').set(webManifest.id, { id: webManifest.id, kind: 'manifest', sessionId: webSid,
  activeDocumentId: 'oud', docIds: ['oud'], addedAt: 1 });
eq('versieloos webmanifest: bestaand pad, bewaarde dirty-vlag en geen verzonnen datumstand/site-doel',
  (await loadRecovery()).docs.map(d => [d.id, d.filePath, d.isDirty, d.datesAsRecorded, d.siteFileId ?? null]),
  [['oud', 'oud.ifc', false, false, null]]);
await clearRecovery();

// Knownbug 201: oude docIds-generaties bewaren de vlag in het documentrecord.
for (const version of [null, 1, 2]) {
  for (const dirty of [false, true, undefined]) {
    const record: Omit<typeof webRecord, 'isDirty'> & { isDirty?: boolean } = { ...webRecord, isDirty: dirty };
    if (dirty === undefined) delete record.isDirty;
    idb.store('records').set(record.id, record);
    idb.store('records').set(webManifest.id, { id: webManifest.id, kind: 'manifest', sessionId: webSid,
      ...(version === null ? {} : { version }), activeDocumentId: 'oud', docIds: ['oud'], addedAt: 1 });
    const before = webBytes();
    eq(`docIds v${version} dirty=${dirty}: opgeslagen vlag of veilige ontbrekend-terugval`,
      (await loadRecovery()).docs.map(d => d.isDirty), [dirty ?? true]);
    eq(`docIds v${version} dirty=${dirty}: lezen verandert de generatie niet`, webBytes(), before);
    await clearRecovery();
  }
}
// Moderne metadata is gezaghebbend, ook wanneer het oude record juist het omgekeerde zegt.
for (const dirty of [false, true]) {
  idb.store('records').set(webRecord.id, { ...webRecord, isDirty: !dirty });
  idb.store('records').set(webManifest.id, { ...webManifest,
    documents: webManifest.documents.map(d => ({ ...d, isDirty: dirty })) });
  eq(`v5 manifest dirty=${dirty}: manifest wint van oud record`, (await loadRecovery()).docs.map(d => d.isDirty), [dirty]);
  await clearRecovery();
}

for (const version of [null, 1, 2]) {
  idb.store('records').set(webManifest.id, { id: webManifest.id, kind: 'manifest', sessionId: webSid,
    ...(version === null ? {} : { version }), activeDocumentId: null, docIds: [], addedAt: 1 });
  eq('historisch web ' + version + ': geldige lege docIds blijven leesbaar', (await loadRecovery()).docs, []);
  await clearRecovery();
}

// R3-bronrepro (niet lokaal uitgevoerd): één echte hole naast een geldige documentidentiteit.
// structuredClone bewaart de ontbrekende positie; geen JSON-rondgang van de opgeslagen fixture.
const sparseDocuments = structuredClone(webManifest.documents);
sparseDocuments.length++;
const sparseDocIds = ['oud'];
sparseDocIds.length++;
eq('sparse documents-fixture heeft één afwezige positie na structured clone',
  [structuredClone(sparseDocuments).length, Object.keys(structuredClone(sparseDocuments))], [2, ['0']]);
eq('sparse docIds-fixture heeft één afwezige positie na structured clone',
  [structuredClone(sparseDocIds).length, Object.keys(structuredClone(sparseDocIds))], [2, ['0']]);

// Elke geweigerde vorm blijft ook zonder voorafgaande read beschermd tegen schrijven/wissen/rotatie.
const invalidWebManifests = [
  ...[6, 999, 0, -1, 1.5, NaN, Infinity, '5', null, true, undefined].map(version => ({ ...webManifest, version })),
  { ...webManifest, documents: sparseDocuments },
  { ...webManifest, documents: new Array<unknown>(1) }, // ook een uitsluitend ontbrekende positie is ongeldig
  ...[null, 1, 2].flatMap(version => [sparseDocIds, new Array<unknown>(1)].map(docIds => ({
    id: webManifest.id, kind: 'manifest', sessionId: webSid,
    ...(version === null ? {} : { version }), activeDocumentId: 'oud', docIds, addedAt: 1,
  }))),
  { ...webManifest, documents: {} },
  { ...webManifest, documents: [null] },
  { ...webManifest, documents: [{ id: 'oud' }] },
  { ...webManifest, kind: 'doc' }, // canonieke sleutel, maar ontbreekt in de kind=manifest-index
  { ...webManifest, documents: [webManifest.documents[0], { ...webManifest.documents[0], ifc: webSid + '::doc::andere' }] },
  ...[null, 1, 2].map(version => ({ id: webManifest.id, kind: 'manifest', sessionId: webSid,
    ...(version === null ? {} : { version }), activeDocumentId: 'oud', docIds: ['oud', 'oud'], addedAt: 1 })),
];
for (const [index, manifest] of invalidWebManifests.entries()) {
  idb.store('records').set(webRecord.id, structuredClone(webRecord));
  idb.store('records').set(webManifest.id, structuredClone(manifest));
  idb.store('xer-archives').set('onbekende-blob', { id: 'onbekende-blob', bytes: new Uint8Array([0, 255, 42]) });
  const before = webBytes();
  const sessionBefore = [...session];
  const input = fullRecoverySave('nieuw', [doc('nieuw')]);
  const sourceBefore = JSON.stringify(input);
  for (const [name, action] of [
    ['save vóór read', () => saveRecovery(input)],
    ['load', () => loadRecovery()],
    ['save na geweigerde read', () => saveRecovery(input)],
    ['clear', () => clearRecovery()],
    ['hold', () => holdRecoveryForLater()],
  ] as const) {
    await rejectsManifest('web ' + index + ' ' + name, action);
    eq('web ' + index + ' ' + name + ': alle records/archiefbytes intact', webBytes(), before);
    eq('web ' + index + ' ' + name + ': geen sessierotatie', [...session], sessionBefore);
    eq('web ' + index + ' ' + name + ': broninhoud intact', JSON.stringify(input), sourceBefore);
  }
  idb.store('records').clear();
  idb.store('xer-archives').clear();
}

// R1: iedere kind=manifest is kandidaat, ongeacht sleutel en aanwezigheid/volgorde van de canonieke.
// Deze bronrepro's zijn hier regressies voor CI; lokaal zijn ze niet uitgevoerd.
for (const suffix of ['::aaa-manifest-v6', '::zzz-manifest-v6', '::doc::metadata', '']) {
  for (const order of ['alleen-afwijkend', 'canoniek-eerst', 'afwijkend-eerst']) {
    const alias = { ...webManifest, id: webSid + suffix, version: 99 };
    const candidates = order === 'alleen-afwijkend' ? [alias]
      : order === 'canoniek-eerst' ? [webManifest, alias] : [alias, webManifest];
    for (const candidate of candidates) idb.store('records').set(candidate.id, structuredClone(candidate));
    idb.store('records').set(webRecord.id, structuredClone(webRecord));
    idb.store('xer-archives').set('andere-vorm-blob', { id: 'andere-vorm-blob', bytes: new Uint8Array([0, 255, 91]) });
    const before = webBytes();
    const sessionBefore = [...session];
    for (const [name, action] of [
      ['save vóór read', () => saveRecovery(fullRecoverySave('nieuw', [doc('nieuw')]))],
      ['load', () => loadRecovery()], ['save na read', () => saveRecovery(fullRecoverySave('nieuw', [doc('nieuw')]))],
      ['clear', () => clearRecovery()], ['hold', () => holdRecoveryForLater()],
    ] as const) {
      const label = 'web kandidaat ' + suffix + ' ' + order + ' ' + name;
      await rejectsManifest(label, action);
      eq(label + ': manifesten/documenten/blobs behouden', webBytes(), before);
      eq(label + ': geen rotatie of wijziging van held-lijst', [...session], sessionBefore);
    }
    idb.store('records').clear(); idb.store('xer-archives').clear();
  }
}
// Ook de sleutel kan een EIGEN write raken terwijl de declaratie een andere sessie noemt.
idb.store('records').set(webSid + '::doc::nieuw', { ...webManifest, id: webSid + '::doc::nieuw', sessionId: 'andere-sessie', version: 99 });
const crossSessionBefore = webBytes();
await rejectsManifest('afwijkende manifestdeclaratie onder te overschrijven eigen docsleutel',
  () => saveRecovery(fullRecoverySave('nieuw', [doc('nieuw')])));
eq('afwijkende declaratie: geen overschrijving', webBytes(), crossSessionBefore);
idb.store('records').clear();

// Een mislukte kandidaatinventarisatie geeft uitstellen geen recht op rotatie.
idb.store('records').set(webSid + '::manifest-v6', { ...webManifest, id: webSid + '::manifest-v6', version: 99 });
idb.store('records').set(webRecord.id, structuredClone(webRecord));
const unreadableWebBefore = webBytes();
const unreadableSessionBefore = [...session];
failRecordRead = true;
let holdReadRejected = false;
try { await holdRecoveryForLater(); } catch { holdReadRejected = true; }
finally { failRecordRead = false; }
eq('uitstellen na IDB-leesfout wordt geweigerd', holdReadRejected, true);
eq('uitstellen na IDB-leesfout bewaart herstelbytes', webBytes(), unreadableWebBefore);
eq('uitstellen na IDB-leesfout roteert niet', [...session], unreadableSessionBefore);
idb.store('records').clear();

// Vreemde kandidaten: bescherm zowel hun fysieke sleutel als gedeclareerde/key-sessie en alle blobs.
for (const aliasId of ['vreemd::manifest-v6', 'vreemd::doc::metadata', 'opaque-v6', 'andere-prefix::metadata']) {
  for (const version of [5, 99]) {
    const canonical = { ...webManifest, id: 'vreemd::manifest', sessionId: 'vreemd' };
    const alias = { ...canonical, id: aliasId, version };
    const foreignDoc = { ...webRecord, id: 'vreemd::doc::oud', sessionId: 'vreemd' };
    for (const record of [canonical, alias, foreignDoc,
      ...(aliasId.startsWith('andere-prefix::')
        ? [{ ...webRecord, id: 'andere-prefix::doc::oud', sessionId: 'andere-prefix' }] : [])]) {
      idb.store('records').set(record.id, structuredClone(record));
    }
    idb.store('xer-archives').set('vorm-onbekende-blob', { id: 'vorm-onbekende-blob', bytes: new Uint8Array([2, 0, 255]) });
    const before = webBytes();
    await saveRecovery(fullRecoverySave('eigen', [doc('eigen')]));
    eq('vreemde afwijkende kandidaat laat eigen ondersteunde read toe', await ids(), ['eigen']);
    await clearRecovery();
    eq('vreemde ' + aliasId + ' v' + version + ': save/GC/clear bewaren alle vreemde bytes', webBytes(), before);
    idb.store('records').clear(); idb.store('xer-archives').clear();
  }
}

// Een onbekende VREEMDE sessie mag niet door zeven-dagen-GC of gedeelde blob-GC verdwijnen.
const futureSid = 'vreemde-toekomst';
const futureManifest = { ...webManifest, id: futureSid + '::manifest', sessionId: futureSid, version: 99 };
const futureDoc = { ...webRecord, id: futureSid + '::doc::oud', sessionId: futureSid };
idb.store('records').set(futureManifest.id, structuredClone(futureManifest));
idb.store('records').set(futureDoc.id, structuredClone(futureDoc));
idb.store('xer-archives').set('toekomstige-blob', { id: 'toekomstige-blob', bytes: new Uint8Array([12, 0, 255]) });
await saveRecovery(fullRecoverySave('eigen', [doc('eigen')]));
eq('onbekend vreemd manifest blokkeert eigen ondersteunde herstelset niet', await ids(), ['eigen']);
eq('onbekend vreemd manifest blijft na verlopen ouderdom bytegelijk', idb.store('records').get(futureManifest.id), futureManifest);
eq('onbekend vreemd document blijft na verlopen ouderdom bytegelijk', idb.store('records').get(futureDoc.id), futureDoc);
await clearRecovery();
eq('eigen clear bewaart onbekende vreemde records en alle gedeelde blobs',
  [idb.store('records').size, idb.store('xer-archives').size], [2, 1]);

// Ook een vastgehouden onbekende generatie mag niet via de verse sessie worden omzeild.
idb.store('records').clear(); idb.store('xer-archives').clear();
await saveRecovery(fullRecoverySave('oud', [webDoc]));
await holdRecoveryForLater();
const heldId = webSid + '::manifest';
const heldManifest = idb.store('records').get(heldId) as object;
idb.store('records').set(heldId, { ...heldManifest, version: 99 });
const heldBefore = webBytes();
for (const [name, action] of [
  ['load', () => loadRecovery()], ['save', () => saveRecovery(fullRecoverySave('nieuw', [doc('nieuw')]))],
  ['hold', () => holdRecoveryForLater()], ['clear', () => clearRecovery()],
] as const) {
  await rejectsManifest('web vastgehouden ' + name, action);
  eq('web vastgehouden ' + name + ': alle bytes intact', webBytes(), heldBefore);
}
idb.store('records').set(heldId, heldManifest);
for (const aliasFirst of [true, false]) {
  idb.store('records').clear();
  const alias = { ...heldManifest, id: webSid + '::manifest-v6', kind: 'manifest', sessionId: webSid, version: 99 };
  const canonical = { id: heldId, ...heldManifest };
  for (const candidate of aliasFirst ? [alias, canonical] : [canonical, alias]) {
    idb.store('records').set(candidate.id, candidate);
  }
  idb.store('records').set(webRecord.id, structuredClone(webRecord));
  const before = webBytes();
  const sessionBefore = [...session];
  for (const [name, action] of [
    ['load', () => loadRecovery()], ['save', () => saveRecovery(fullRecoverySave('nieuw', [doc('nieuw')]))],
    ['clear', () => clearRecovery()], ['hold', () => holdRecoveryForLater()],
  ] as const) {
    await rejectsManifest('vastgehouden kandidaat ' + aliasFirst + ' ' + name, action);
    eq('vastgehouden kandidaat: alle bytes intact', webBytes(), before);
    eq('vastgehouden kandidaat: geen rotatie', [...session], sessionBefore);
  }
}
idb.store('records').clear();
idb.store('records').set(heldId, heldManifest);
await clearRecovery();

if (uuidDescriptor) Object.defineProperty(crypto, 'randomUUID', uuidDescriptor);
else Reflect.deleteProperty(crypto, 'randomUUID');
Object.defineProperty(Math, 'random', randomDescriptor);
if (valuesDescriptor) Object.defineProperty(crypto, 'getRandomValues', valuesDescriptor);
else Reflect.deleteProperty(crypto, 'getRandomValues');
if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
else Reflect.deleteProperty(globalThis, 'navigator');

// ── Desktop (Tauri): gedeeltelijk herstel houdt de onleesbare snapshot vast (knownbug 37) ──────
// De echte `saveTauri`/`loadTauri`/`holdTauri` tegen een nep-`invoke` met een map als schijf.
// Nagebootst wordt wat `useRecoveryRestore` doet: laden, het leesbare document herstellen, het
// onleesbare niet, `holdRecoveryForLater()`, en daarna gewone auto-saverondes met alleen het
// herstelde document open.
const DIR = '/appdata';
const disk = new Map<string, Uint8Array>();
let failManifestCommit = false;
const unreadableSnapshots = new Set<string>();
let failSnapshotStat = false;
const enc = new TextEncoder();
const dec = new TextDecoder();
type TauriArgs = { path: string; paths: string[]; oldPath: string; newPath: string };
(globalThis as unknown as { window: unknown }).window = { __TAURI_INTERNALS__: {
  invoke: async (cmd: string, args: TauriArgs & Uint8Array, options?: { headers?: { path?: string } }) => {
    const need = (p: string) => { const b = disk.get(p); if (!b) throw new Error(`No such file: ${p}`); return b; };
    switch (cmd) {
      case 'plugin:path|resolve_directory': return DIR;
      case 'plugin:path|join': return args.paths.join('/');
      case 'plugin:fs|mkdir': return null;
      case 'plugin:fs|exists': return disk.has(args.path);
      case 'plugin:fs|read_dir': return [...disk.keys()].map((p) => ({ name: p.slice(DIR.length + 1) }));
      case 'plugin:fs|read_text_file': case 'plugin:fs|read_file':
        if (unreadableSnapshots.has(args.path)) throw new Error('Snapshot tijdelijk onleesbaar');
        return need(args.path);
      case 'plugin:fs|stat':
        need(args.path);
        if (failSnapshotStat) throw new Error('Stat niet beschikbaar');
        return { mtime: 0, atime: null, birthtime: null };
      case 'plugin:fs|write_text_file': case 'plugin:fs|write_file':
        disk.set(decodeURIComponent(options!.headers!.path!), new Uint8Array(args)); return null;
      case 'plugin:fs|rename':
        if (failManifestCommit && args.newPath === DIR + '/' + ownRecoveryNames.manifest) {
          throw new Error('Gesimuleerde mislukte manifestcommit');
        }
        disk.set(args.newPath, need(args.oldPath)); disk.delete(args.oldPath); return null;
      case 'plugin:fs|remove': need(args.path); disk.delete(args.path); return null;
      default: throw new Error(`nep-Tauri kent ${cmd} niet`);
    }
  },
} };

const N = ownRecoveryNames;
const BROKEN = 'BROKEN_RECOVERY_FIXTURE';
const put = (name: string, text: string) => { disk.set(`${DIR}/${name}`, enc.encode(text)); };
const bytesOf = (name: string) => { const b = disk.get(`${DIR}/${name}`); return b ? dec.decode(b) : null; };
const manifestRefs = () => (JSON.parse(bytesOf(N.manifest) ?? '{"documents":[]}') as RecoveryManifest)
  .documents.map((d) => `${d.id}=${d.ifc}`).sort();
const offered = async () => (await loadRecovery()).docs.map((d) => `${d.id}:${d.ifc}`).sort();
const restored = (ifc: string) => ({ ...doc('doc-a'), ifc });
/** Na elke ronde: bytes, manifestverwijzing en aanbod van het onleesbare document doc-b. */
const expectHeld = async (label: string, brokenName: string) => {
  eq(`${label}: bytes van doc-b staan nog op schijf`, bytesOf(brokenName), BROKEN);
  eq(`${label}: manifest verwijst nog naar doc-b`, manifestRefs().includes(`doc-b=${brokenName}`), true);
  eq(`${label}: loadRecovery biedt doc-b nog aan`, (await offered()).includes(`doc-b:${BROKEN}`), true);
};

// 1. v1-manifest zonder ownerId (legacy). Zonder vasthouden ruimde de eerste ronde doc-b op.
{
  put(N.manifest, JSON.stringify({ version: 1, activeDocumentId: 'doc-a', documents: [
    { id: 'doc-a', ifc: N.ifcName('doc-a'), filePath: null, isDirty: true },
    { id: 'doc-b', ifc: N.ifcName('doc-b'), filePath: null, isDirty: true },
  ] }));
  put(N.ifcName('doc-a'), 'ISO-10303-21; /* A0 */');
  put(N.ifcName('doc-b'), BROKEN);
  eq('tauri v1: voorwaarde, beide worden aangeboden', (await offered()).map((s) => s.split(':')[0]), ['doc-a', 'doc-b']);
  await holdRecoveryForLater();
  await saveRecovery(fullRecoverySave('doc-a', [restored('ISO-10303-21; /* A1 */')]));
  await expectHeld('tauri v1 ronde 1', N.ifcName('doc-b'));
  await saveRecovery(fullRecoverySave('doc-a', [restored('ISO-10303-21; /* A2 */')]));
  await expectHeld('tauri v1 ronde 2', N.ifcName('doc-b'));
  eq('tauri v1: zonder bevestigde herstel-ids blijft oude doc-a beschermd', bytesOf(N.ifcName('doc-a')), 'ISO-10303-21; /* A0 */');
  // Schone afsluiting haalt alleen de eigen snapshots weg; doc-b blijft voor de volgende start.
  await clearOwnRecovery();
  eq('tauri v1: na schone afsluiting alleen doc-b', (await offered()), [`doc-b:${BROKEN}`]);
  // Verwerpen blijft de uitweg: alles van deze base weg.
  await clearRecovery();
  eq('tauri v1: verwerpen wist alles', [...disk.keys()].filter((p) => N.isOwnFile(p.slice(DIR.length + 1))), []);
}

// 2. Huidig manifest van een vorige start (`foreign`). De eerste ronde droeg doc-b al mee; de
//    tweede ronde (manifest nu van ons) liet de verwijzing vallen en hield weesbytes over.
{
  const brokenName = N.generationIfcName('doc-b', 'g0');
  put(N.manifest, JSON.stringify({
    version: RECOVERY_MANIFEST_VERSION, activeDocumentId: 'doc-a', ownerId: 'vorige-start', heartbeatAt: 1,
    documents: [
      { id: 'doc-a', ifc: N.generationIfcName('doc-a', 'g0'), filePath: null, isDirty: true, datesAsRecorded: false },
      { id: 'doc-b', ifc: brokenName, filePath: null, isDirty: true, datesAsRecorded: false },
    ],
  }));
  put(N.generationIfcName('doc-a', 'g0'), 'ISO-10303-21; /* A0 */');
  put(brokenName, BROKEN);
  eq('tauri v5: voorwaarde, beide worden aangeboden', (await offered()).map((s) => s.split(':')[0]), ['doc-a', 'doc-b']);
  await holdRecoveryForLater();
  await saveRecovery(fullRecoverySave('doc-a', [restored('ISO-10303-21; /* A1 */')]));
  await expectHeld('tauri v5 ronde 1', brokenName);
  await saveRecovery(fullRecoverySave('doc-a', [restored('ISO-10303-21; /* A2 */')]));
  await expectHeld('tauri v5 ronde 2', brokenName);
  // Ronde 3 zonder nieuwe inhoud (alleen metadata): doc-a houdt zijn generatie, doc-b gaat mee.
  await saveRecovery({
    activeDocumentId: 'doc-a',
    documents: [{ id: 'doc-a', filePath: null, isDirty: false, datesAsRecorded: false }],
    upserts: [],
  });
  await expectHeld('tauri v5 ronde 3', brokenName);
  await clearRecovery();
}
// 3. Geslaagd gedeeltelijk herstel: alleen de bevestigde gezonde generatie mag verdwijnen,
//    en pas ná de nieuwe manifestcommit. De onleesbare kopie blijft ook na 250 rondes aangeboden.
for (const legacy of [true, false]) {
  const label = legacy ? 'v1' : 'v5';
  const healthyName = legacy ? N.ifcName('doc-a') : N.generationIfcName('doc-a', 'herstel');
  const brokenName = legacy ? N.ifcName('doc-b') : N.generationIfcName('doc-b', 'herstel');
  const healthy = 'ISO-10303-21; /* herstelde oude A */';
  put(N.manifest, JSON.stringify({
    version: legacy ? 1 : RECOVERY_MANIFEST_VERSION,
    ...(legacy ? {} : { ownerId: 'vorige-start', heartbeatAt: 1 }),
    activeDocumentId: 'doc-a',
    documents: [
      { id: 'doc-a', ifc: healthyName, filePath: null, isDirty: true, datesAsRecorded: false },
      { id: 'doc-b', ifc: brokenName, filePath: null, isDirty: true, datesAsRecorded: false },
    ],
  }));
  put(healthyName, healthy);
  put(brokenName, BROKEN);
  await holdRecoveryForLater(['doc-a']);
  eq(label + ': vasthouden verwijdert nog niets', bytesOf(healthyName), healthy);
  const oldManifest = bytesOf(N.manifest);
  failManifestCommit = true;
  let rejected = false;
  try { await saveRecovery(fullRecoverySave('doc-a', [restored('ISO-10303-21; /* poging */')])); }
  catch { rejected = true; }
  finally { failManifestCommit = false; }
  eq(label + ': de gesimuleerde commitfout bereikt de aanroeper', rejected, true);
  eq(label + ': oude manifest blijft intact bij commitfout', bytesOf(N.manifest), oldManifest);
  eq(label + ': gezonde oude snapshot blijft intact bij commitfout', bytesOf(healthyName), healthy);
  await expectHeld(label + ' mislukte commit', brokenName);
  for (let round = 0; round < 250; round++) {
    await saveRecovery(fullRecoverySave('doc-a', [restored('ISO-10303-21; /* ronde ' + round + ' */')]));
    eq(label + ': vervangen gezonde snapshot weg in ronde ' + round, bytesOf(healthyName), null);
    await expectHeld(label + ' ronde ' + round, brokenName);
  }
  eq(label + ': alleen actuele gezonde en beschermde onleesbare snapshot staan op schijf',
    [...disk.keys()].filter(path => N.snapshotDocId(path.slice(DIR.length + 1)) !== null).length, 2);
  await clearOwnRecovery();
  eq(label + ': na schone afsluiting geen gezonde weesbytes',
    [...disk.keys()].filter(path => N.snapshotDocId(path.slice(DIR.length + 1)) !== null),
    [DIR + '/' + brokenName]);
  await expectHeld(label + ' schone afsluiting', brokenName);
  await clearRecovery();
}
// Knownbug 202: een echte I/O-fout is iets anders dan leesbare maar onparseerbare IFC.
// Zowel gemengd als volledig onleesbaar moet een keuze opleveren en de manifestregels behouden.
for (const version of [1, RECOVERY_MANIFEST_VERSION]) {
  for (const allUnreadable of [false, true]) {
    const a = version === 1 ? N.ifcName('io-a') : N.generationIfcName('io-a', 'oud');
    const b = version === 1 ? N.ifcName('io-b') : N.generationIfcName('io-b', 'oud');
    put(a, 'A origineel'); put(b, 'B enige kopie');
    put(N.manifest, JSON.stringify({ version, activeDocumentId: 'io-a', documents: [
      { id: 'io-a', ifc: a, filePath: null, isDirty: true },
      { id: 'io-b', ifc: b, filePath: null, isDirty: true },
    ] }));
    unreadableSnapshots.add(`${DIR}/${b}`);
    if (allUnreadable) unreadableSnapshots.add(`${DIR}/${a}`);
    const loaded = await loadRecovery();
    const label = `I/O v${version}, alles onleesbaar=${allUnreadable}`;
    eq(label + ': leesbare documenten', loaded.docs.map(d => d.id), allUnreadable ? [] : ['io-a']);
    eq(label + ': I/O-uitval wordt expliciet doorgegeven', loaded.readFailures?.map(f => f.id),
      allUnreadable ? ['io-a', 'io-b'] : ['io-b']);
    eq(label + ': reden blijft beschikbaar', loaded.readFailures?.every(f => f.detail.includes('tijdelijk onleesbaar')), true);
    // Dezelfde keuze als de hook: een onvolledige set wordt vastgehouden, niet gewist.
    if (loaded.readFailures?.length) await holdRecoveryForLater(loaded.docs.map(d => d.id));
    else await clearRecovery();
    for (let round = 1; round <= 2; round++) {
      await saveRecovery(fullRecoverySave('io-a', [{ ...doc('io-a'), ifc: 'A nieuw ' + round }]));
      eq(label + `: ronde ${round} bewaart bytes B`, bytesOf(b), 'B enige kopie');
      eq(label + `: ronde ${round} bewaart verwijzing B`, manifestRefs().includes(`io-b=${b}`), true);
    }
    await clearOwnRecovery();
    eq(label + ': afsluiten bewaart B', bytesOf(b), 'B enige kopie');
    unreadableSnapshots.clear();
    eq(label + ': na herstel I/O opnieuw aangeboden', (await loadRecovery()).docs.some(d => d.id === 'io-b' && d.ifc === 'B enige kopie'), true);
    await clearRecovery();
    eq(label + ': expliciet verwerpen mag B wissen', bytesOf(b), null);
  }
}
{
  put(N.ifcName('stat'), 'leesbare bron');
  put(N.manifest, JSON.stringify({ version: 1, documents: [{ id: 'stat', ifc: N.ifcName('stat') }] }));
  failSnapshotStat = true;
  const loaded = await loadRecovery();
  eq('stat-fout is geen snapshotleesfout', loaded.readFailures ?? [], []);
  eq('stat-fout houdt leesbare IFC met onbekende mtime', loaded.docs.map(d => [d.ifc, d.mtime]), [['leesbare bron', null]]);
  failSnapshotStat = false;
  await clearRecovery();
}

// Desktopversies blijven leesbaar, zonder verzonnen metadata of migratie van IFC-bytes.
for (const version of [1, 2, 3, 4, 5]) {
  const snapshot = version <= 2 ? N.ifcName('contract') : N.generationIfcName('contract', 'oud');
  put(snapshot, 'ongewijzigde IFC-bron');
  put(N.manifest, JSON.stringify({ version, activeDocumentId: 'contract', documents: [
    { id: 'contract', ifc: snapshot, filePath: '/project.ifc', isDirty: false },
  ] }));
  const loaded = await loadRecovery();
  eq('tauri v' + version + ': legacydefaults en bronbytes', loaded.docs.map(d =>
    [d.ifc, d.filePath, d.isDirty, d.datesAsRecorded, d.siteFileId ?? null]),
  [['ongewijzigde IFC-bron', '/project.ifc', false, false, null]]);
  await clearRecovery();
}

const diskBytes = () => [...disk].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => [name, [...bytes]]);
const invalidTauriManifests = [
  ...[6, 999, 0, -1, 1.5, '5', null, true, undefined].map(version => JSON.stringify({ version,
    documents: [{ id: 'contract', ifc: N.ifcName('contract') }] })),
  '{"version":5,"documents":{}}', '{"version":5,"documents":[null]}',
  '{"version":5,"documents":[{"id":"contract"}]}', '[]', 'null',
];
for (const [index, raw] of invalidTauriManifests.entries()) {
  // Eerst eigen bytes schrijven: ook clearOwn mag deze straks niet weghalen onder een onbekend contract.
  await saveRecovery(fullRecoverySave('eigen', [doc('eigen')]));
  put(N.manifest, raw);
  put(N.ifcName('contract'), 'stabiele snapshot: geen terugval bij onbekende versie');
  put(N.legacy, 'legacy: geen terugval bij onbekende versie');
  put(N.archiveName('a'.repeat(64)), 'archiefbytes');
  put(N.manifest + '.tmp', 'halffabricaat');
  const before = diskBytes();
  const input = fullRecoverySave('nieuw', [doc('nieuw')]);
  const sourceBefore = JSON.stringify(input);
  for (const [name, action] of [
    ['save vóór read', () => saveRecovery(input)], ['load', () => loadRecovery()],
    ['save na geweigerde read', () => saveRecovery(input)], ['clear', () => clearRecovery()],
    ['clearOwn', () => clearOwnRecovery()], ['hold', () => holdRecoveryForLater()],
  ] as const) {
    await rejectsManifest('tauri ' + index + ' ' + name, action);
    eq('tauri ' + index + ' ' + name + ': alle bytes/manifest intact', diskBytes(), before);
    eq('tauri ' + index + ' ' + name + ': broninhoud intact', JSON.stringify(input), sourceBefore);
  }
  disk.clear();
}
// R1: twee verschillende, geldige snapshots met dezelfde documentidentiteit mogen niet samenvallen.
const duplicateSnapshots = ['Generatie Alfa', 'Generatie Beta'].map((name, index) => {
  const ifc = writeIFC({ project: { ...createDefaultProject(), name }, calendar: createDefaultCalendar(),
    tasks: [], sequences: [], resources: [], assignments: [] });
  eq('dubbele-id fixture ' + name + ' is afzonderlijk leesbare IFC', readIFC(ifc).project.name, name);
  return { name: N.generationIfcName('dup', 'generatie-' + index), ifc };
});
for (const reverse of [false, true]) {
  const snapshots = reverse ? [...duplicateSnapshots].reverse() : duplicateSnapshots;
  put(N.manifest, JSON.stringify({ version: 5, activeDocumentId: 'dup', documents: snapshots.map(snapshot =>
    ({ id: 'dup', ifc: snapshot.name, filePath: null, isDirty: true })) }));
  for (const snapshot of snapshots) put(snapshot.name, snapshot.ifc);
  const before = diskBytes();
  for (const [name, action] of [
    ['load', () => loadRecovery()], ['save', () => saveRecovery(fullRecoverySave('nieuw', [doc('nieuw')]))],
    ['clear', () => clearRecovery()], ['clearOwn', () => clearOwnRecovery()], ['hold', () => holdRecoveryForLater()],
  ] as const) {
    await rejectsManifest('tauri dubbele id, volgorde ' + reverse + ' ' + name, action);
    eq('tauri dubbele id: beide generaties en manifest blijven exact behouden', diskBytes(), before);
  }
  disk.clear();
}
// De bestaande terugval bij onparseerbare JSON blijft uitsluitend stabiele snapshots lezen.
put(N.manifest, '{"version":');
put(N.ifcName('stabiel'), 'stabiele legacybron');
put(N.generationIfcName('ongecommit', 'g1'), 'ongecommitte generatie');
eq('afgekapt JSON: alleen stabiele legacybron aangeboden', await offered(), ['stabiel:stabiele legacybron']);
const corruptBefore = diskBytes();
for (const [name, action] of [
  ['save', () => saveRecovery(fullRecoverySave('nieuw', [doc('nieuw')]))],
  ['clear', () => clearRecovery()], ['clearOwn', () => clearOwnRecovery()], ['hold', () => holdRecoveryForLater()],
] as const) {
  await rejectsManifest('tauri afgekapt JSON ' + name, action);
  eq('tauri afgekapt JSON ' + name + ': alle bytes intact', diskBytes(), corruptBefore);
}
disk.clear();
// Zonder manifest blijft de oude enkele herstelkopie leesbaar.
put(N.legacy, 'enkele legacybron');
eq('manifestloze legacykopie blijft leesbaar', await offered(), ['legacy:enkele legacybron']);
await clearRecovery();
Reflect.deleteProperty(globalThis, 'window');

// ── Openaanvraag-lifecycle: echte browserblokkade staat in de bestaande browserroute. ─────────
// Hier ook de defensieve gebeurtenisvolgordes die de browser niet deterministisch kan leveren:
// blocked → retry → late upgrade/error/success. Geen oude aanvraag mag een nieuwe verbinding wissen.
const openings = Array.from({ length: 6 }, () => {
  const observed = { closes: 0, aborts: 0, schemaWrites: 0, transactions: 0, unique: false };
  const store = {
    indexNames: { contains: () => false },
    createIndex: () => { observed.schemaWrites++; },
    index: () => ({ keyPath: 'kind', unique: observed.unique }),
  };
  const dbHandlers: Record<'onversionchange' | 'onclose', (() => void) | null> = { onversionchange: null, onclose: null };
  const db = {
    ...dbHandlers,
    close: () => { observed.closes++; },
    objectStoreNames: { contains: () => true },
    transaction: () => { observed.transactions++; return { objectStore: () => store }; },
  };
  const requestHandlers: Record<'onupgradeneeded' | 'onblocked' | 'onerror' | 'onsuccess', (() => void) | null> = {
    onupgradeneeded: null, onblocked: null, onerror: null, onsuccess: null,
  };
  const request = {
    ...requestHandlers,
    result: db, error: new Error('gesimuleerde openfout'),
    transaction: { abort: () => { observed.aborts++; }, objectStore: () => store },
  };
  return { observed, request };
});
let openCount = 0;
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
  open: () => openings[openCount++]!.request,
} });
const openLifecycle = () => openDbStores('recovery-open-lifecycle', 3, ['records'],
  [{ storeName: 'records', name: 'kind', keyPath: 'kind' }]);
const rejectedOpen = openLifecycle().catch((error: unknown) => error);
openings[0]!.request.onblocked?.();
const blocked = await rejectedOpen;
eq('IDB blocked: getypeerde fout zonder op succes te wachten',
  blocked instanceof IndexedDbUpgradeBlockedError && blocked.databaseName === 'recovery-open-lifecycle' && blocked.version === 3, true);
const retryOpen = openLifecycle();
eq('IDB blocked: volgende generieke open kan opnieuw proberen', openCount, 2);
openings[0]!.request.onupgradeneeded?.();
openings[0]!.request.onerror?.();
openings[0]!.request.onsuccess?.();
eq('IDB late events: upgrade afgebroken, verbinding gesloten, geen schema-/recordtransacties',
  openings[0]!.observed, { closes: 1, aborts: 1, schemaWrites: 0, transactions: 0, unique: false });
eq('IDB late error: nieuwe cache-entry blijft staan', openLifecycle() === retryOpen, true);
openings[1]!.request.onupgradeneeded?.();
openings[1]!.request.onsuccess?.();
await retryOpen;
eq('IDB gezond: index aanmaken en valideren, verbinding gecachet',
  [openings[1]!.observed.schemaWrites, openings[1]!.observed.transactions, openLifecycle() === retryOpen], [1, 1, true]);
openings[1]!.request.result.onversionchange?.();
eq('IDB versionchange: verbinding sluit', openings[1]!.observed.closes, 1);
const errorOpen = openLifecycle().catch((error: unknown) => error);
openings[2]!.request.onerror?.();
eq('IDB openfout: oorspronkelijke fout propageert', await errorOpen === openings[2]!.request.error, true);
const invalidIndex = openLifecycle().catch((error: unknown) => error);
openings[3]!.observed.unique = true;
openings[3]!.request.onsuccess?.();
eq('IDB afwijkende index: fout en verbinding gesloten',
  [await invalidIndex instanceof Error, openings[3]!.observed.closes], [true, 1]);
const healthyAgain = openLifecycle();
openings[4]!.request.onsuccess?.();
await healthyAgain;
openings[4]!.request.result.onclose?.();
const afterClose = openLifecycle();
openings[5]!.request.onsuccess?.();
await afterClose;
eq('IDB onverwacht sluiten: volgende aanroep opent opnieuw', openCount, 6);
openings[5]!.request.result.onversionchange?.();

if (diffs.length === 0) {
  console.log(`OK  recovery-web-hold: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recovery-web-hold: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
