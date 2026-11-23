// De proef achter `check-ifc-foreign-grens.ts` (#804, fixronde 3 van #1127, route A). Twee getallen, elk op één plek:
// de productgrens voor het openen van een model (`IFC_MODEL_OPEN_MAX_BYTES`, 150 MiB) en de technische grens van de
// bytes-route (`IFC_FOREIGN_SCAN_MAX_BYTES`, 300 MiB, zoals main). De proef verlaagt alleen de productgrens, met de
// proefnaad, tot `GRENS` (64 KiB); de technische grens blijft die van main. Zo ligt een bestand van `GRENS + 1` bytes
// tussen de twee grenzen, zonder bestand van 150 MiB.
//
// `node grens.mjs web`: browser (nagebootste IndexedDB), delen 1 tot 4. `node grens.mjs desktop <map>`: nagebootste
// Tauri-IPC op die map, deel 3 voor een bron op schijf. De bundel vervangt `react` en `react-i18next` in
// `useRecoveryRestore.ts` door `reactHookDouble.ts`: het herstel loopt door de echte callback van de herstelvraag.
// Exit 0 = alles groen.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { installNodeFileIpc } from './nodeFileIpc';
import { mount } from './reactHookDouble';
import type { RecoveryState } from '@/hooks/useRecoveryRestore';

export const GRENS = 65536;
const mode = process.argv[2] === 'desktop' ? 'desktop' : 'web';
const appData = process.argv[3] ?? '';

installBrowserStubs();
installDeterminism();
/** Bestanden achter een nagemaakte handle. De methoden staan op het prototype, zodat de opslagronde de handle net als een
 *  echte `FileSystemFileHandle` kan klonen; na het lezen uit de IndexedDB-dubbel krijgt hij zijn prototype terug. */
const files = new Map<string, Uint8Array>();
class Handle {
  readonly kind = 'file';
  constructor(readonly name: string) {}
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async getFile() { return new File([files.get(this.name)! as BlobPart], this.name); }
}
const handleOf = (name: string) => new Handle(name) as unknown as FileSystemFileHandle;
const db = installFakeRecoveryIndexedDb({
  onRead(store, _method, result) {
    if (store !== 'records' || !Array.isArray(result)) return;
    for (const record of result as { kind?: string; documents?: { ifcSource?: { handle?: object } }[] }[]) {
      if (record?.kind !== 'manifest') continue;
      for (const doc of record.documents ?? []) {
        const handle = doc.ifcSource?.handle;
        if (handle && !(handle instanceof Handle)) Object.setPrototypeOf(handle, Handle.prototype);
      }
    }
  },
});
if (mode === 'desktop') installNodeFileIpc({ appDataDir: appData });
console.error = () => {};
const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { useAppStore } = await import('@/state/appStore');
const { useRecoveryRestore } = await import('@/hooks/useRecoveryRestore');
const { readRecoveryDocument } = await import('@/state/readRecoveryDocument');
const { recoverySourceDocument } = await import('@/state/recoverySourceDocument');
const { clearRecovery, loadRecovery, saveRecovery, fullRecoverySave } = await import('@/services/recovery/recoveryStore');
const { readRecoverySourceCopy, SOURCE_COPY_DB } = await import('@/services/recovery/recoverySourceCopies');
const { runRecoveryTick } = await import('@/services/recovery/recoverySnapshot');
const { RecoveryDeltaTracker } = await import('@/services/recovery/recoveryDelta');
const { ownRecoveryNames } = await import('@/services/recovery/recoveryPaths');
const { serializeRecoverySnapshot } = await import('@/services/recovery/recoverySnapshotInput');
const { saveTargetRef } = await import('@/services/fileAccess');
const { openDroppedFiles } = await import('@/state/fileDrop');
const { IFC_FOREIGN_SCAN_MAX_BYTES, scanForeign } = await import('@/services/ifc/foreign/foreignScan');
const { IFC_MODEL_OPEN_MAX_BYTES, lowerModelOpenLimitForTests } = await import('@/services/ifc/modelOpenLimit');

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 240)} ≠ ${w?.slice(0, 240)}`);
};

// ── 0. Twee getallen, elk op één plek ─────────────────────────────────────────────────────────────────────────────
eq('de productgrens: 150 MiB', IFC_MODEL_OPEN_MAX_BYTES, 157_286_400);
eq('de technische grens van de bytes-route: 300 MiB, zoals main', IFC_FOREIGN_SCAN_MAX_BYTES, 300 * 1024 * 1024);
lowerModelOpenLimitForTests(GRENS);

const enc = new TextEncoder(), dec = new TextDecoder();
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const model = readFileSync('tests/fixtures/ifc-foreign/eigen-plus-model.ifc', 'utf8');
const plan = readFileSync('public/examples/showcase-verbouwing-eengezinswoning.ifc', 'utf8');
/** Precies `bytes` lang: een commentaar direct na `DATA;`. */
const pad = (text: string, bytes: number) => {
  const out = enc.encode(text.replace('\nDATA;\n', `\nDATA;\n/*${' '.repeat(bytes - enc.encode(text).length - 4)}*/`));
  assert.equal(out.length, bytes);
  return out;
};
const withPset = (text: string) => text.replace(/ENDSEC;\s*END-ISO-10303-21;/,
  "#999997=IFCPROPERTYSINGLEVALUE('ExternKenmerk',$,IFCLABEL('moet blijven'),$);\n"
  + "#999998=IFCPROPERTYSET('0123456789012345678901',$,'ExternPakket',$,(#999997));\nENDSEC;\nEND-ISO-10303-21;");
const newStore = () => {
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  return store;
};
type Store = ReturnType<typeof newStore>;
const notices = (store: Store | typeof useAppStore) => store.getState().ui.notifications.map(n => [n.messageKey, n.params ?? null]);
const TOO_LARGE = [['notifications.ifcForeignOpenTooLarge', { limit: 0 }]];

if (mode === 'web') {
  // ── 1. Openen met de productgrens ─────────────────────────────────────────────────────────────────────────────────
  const open = async (bytes: Uint8Array, name = 'bestand.ifc') => {
    const store = newStore();
    await store.getState().openOpenedFile({ name, content: '', bytes, ref: null }, {}, { modelOpenLimit: true });
    return store;
  };
  const atLimit = pad(model, GRENS);
  const over = pad(model, GRENS + 1);
  const opened = await open(atLimit);
  eq('openen, model precies op de productgrens: opent met zijn bron', [opened.getState().ifcSource?.sha256 ?? null, notices(opened)],
    [sha(atLimit), []]);
  const refused = await open(over);
  eq('openen, model één byte boven de productgrens: geweigerd met de groottemelding',
    [refused.getState().ifcSource?.sha256 ?? null, refused.getState().filePath, notices(refused)], [null, null, TOO_LARGE]);
  const pset = await open(pad(withPset(plan), GRENS + 1));
  eq('openen, vreemde pset boven de productgrens: geweigerd met de groottemelding', [pset.getState().ifcSource?.sha256 ?? null, notices(pset)], [null, TOO_LARGE]);

  // Het geval van de reviewer (ronde 3): een planning zonder model met een taak van OPS 0.1 met de letterlijke naam
  // `Planning \X2\00E9\X0\ deel` naast taken van OPS 0.2, boven de productgrens en onder de technische. Main opent haar
  // via de bytes-route met de codering per stuk en houdt de letterlijke naam; hier precies zo, ook na Opslaan als en
  // heropenen.
  const literal = String.raw`Planning \X2\00E9\X0\ deel`;
  const mixedText = plan.replace("'Start of refurbishment'", `'${literal}'`)
    .replace(/(#47=IFCTASK\('[^']+',)#6,/, '$1#9002,')
    .replace(/\nENDSEC;\s*END-ISO-10303-21;/,
      "\n#9001=IFCAPPLICATION(#4,'0.1','Open Planner Studio','OPS');\n#9002=IFCOWNERHISTORY(#3,#9001,$,.NOCHANGE.,$,$,$,1793014266);\nENDSEC;\nEND-ISO-10303-21;");
  assert(mixedText.includes(literal) && mixedText.includes('#9002,'), 'de gemengde proeftekst is niet opgebouwd');
  const mixed = pad(mixedText, GRENS + 1);
  const scan = scanForeign(mixed);
  eq('gemengd: alleen eigen stukken (P)', scan.ok ? scan.counts.C + scan.counts.A + scan.counts.V : 'scanfout', 0);
  const plain = await open(mixed, 'gemengd.ifc');
  const names = (store: Store) => store.getState().tasks.map(t => t.name);
  eq('gemengd boven de productgrens: opent met bron, de letterlijke naam van OPS 0.1 blijft (zoals main)',
    [plain.getState().ifcSource?.sha256 ?? null, plain.getState().tasks.length, names(plain).filter(n => n === literal).length, notices(plain)],
    [sha(mixed), 20, 1, []]);
  let written = '';
  // De webroute kiest de bestandskiezer alleen als `showOpenFilePicker` bestaat (`hasFSA`).
  Reflect.set(window, 'showOpenFilePicker', async () => []);
  Reflect.set(window, 'showSaveFilePicker', async () => ({
    kind: 'file', name: 'kopie.ifc', getFile: async () => new File([], 'kopie.ifc'), queryPermission: async () => 'granted',
    createWritable: async () => ({
      write: async (chunk: string | Uint8Array | Blob) => {
        written += typeof chunk === 'string' ? chunk : chunk instanceof Blob ? await chunk.text() : dec.decode(chunk);
      },
      close: async () => {},
    }),
  }));
  await plain.getState().saveFileAs();
  eq('gemengd: Opslaan als zonder melding', notices(plain), []);
  const reopened = await open(enc.encode(written), 'kopie.ifc');
  eq('gemengd: na Opslaan als en heropenen dezelfde taaknamen', names(reopened), names(plain));
  eq('gemengd: de heropende kopie draagt de letterlijke naam', [written.length > 0, names(reopened).includes(literal)], [true, true]);

  // ── 2. Per openroute: de controle zit erin ───────────────────────────────────────────────────────────────────────
  files.set('model.ifc', over);
  {
    const store = newStore();
    Reflect.set(window, 'showOpenFilePicker', async () => [handleOf('model.ifc')]);
    await store.getState().openFile({});
    eq('route Bestand → Openen: geweigerd', [store.getState().ifcSource?.sha256 ?? null, notices(store)], [null, TOO_LARGE]);
    Reflect.deleteProperty(window, 'showOpenFilePicker');
  }
  {
    const store = newStore();
    store.setState(s => { s.recentFiles = [{ id: 'r1', name: 'model.ifc', ref: { kind: 'handle', handle: handleOf('model.ifc') }, addedAt: 0 }]; });
    await store.getState().openRecentFile('r1', {});
    eq('route Recent: geweigerd', [store.getState().ifcSource?.sha256 ?? null, notices(store)], [null, TOO_LARGE]);
  }
  {
    // Slepen; het startbestand gaat door dezelfde functie (`openLaunchFiles` → `openDroppedFiles`).
    const store = newStore();
    await openDroppedFiles(store, [{ name: 'model.ifc', read: async () => ({ name: 'model.ifc', content: '', bytes: over, ref: null }) }], {}, () => false);
    eq('route slepen en startbestand: geweigerd', [store.getState().ifcSource?.sha256 ?? null, notices(store)], [null, TOO_LARGE]);
  }
  {
    const store = newStore();
    Reflect.set(window, 'parent', window);
    Reflect.set(window, 'openaecHost', { storage: {
      list: async () => [], versions: async () => [], save: async () => { throw new Error('niet in deze proef'); },
      open: async (id: string) => ({ file: { id, name: 'model.ifc', version: 'v1' }, data: over }),
    } });
    await store.getState().openFromSite('site-model', {});
    eq('route site: geweigerd', [store.getState().ifcSource?.sha256 ?? null, notices(store)], [null, TOO_LARGE]);
    Reflect.deleteProperty(window, 'openaecHost');
  }
  {
    // De dev-link `?open=` (alleen de dev-server; hier met een nagemaakte `fetch`), op de ene app-store.
    // De dev-link laadt de i18n-instelling van de app; die zet taal en richting op `document.documentElement`.
    if (typeof document === 'undefined') Reflect.set(globalThis, 'document', { documentElement: { dir: '', lang: '' } });
    const { openDevLinkOnce } = await import('@/utils/devOpenLink');
    Object.defineProperty(window, 'location', { configurable: true, value: { search: '?open=examples/model.ifc&flag=ifcForeignContent' } });
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(over as BlobPart, { headers: { 'content-type': 'application/octet-stream' } })) as typeof fetch;
    try {
      await openDevLinkOnce();
    } finally { globalThis.fetch = realFetch; }
    eq('route dev-link: geweigerd', [useAppStore.getState().ifcSource?.sha256 ?? null, notices(useAppStore)], [null, TOO_LARGE]);
    useAppStore.setState(s => { s.ui.notifications = []; });
  }
  {
    // Zonder de keuze voor de productgrens (zoals het crashherstel `openOpenedFile` gebruikt) opent het model.
    const store = newStore();
    await store.getState().openOpenedFile({ name: 'model.ifc', content: '', bytes: over, ref: null }, {});
    eq('zonder modelOpenLimit (de herstellezing): het model opent met zijn bron', store.getState().ifcSource?.sha256 ?? null, sha(over));
  }
}

// ── 3. Herstel is main: een modelbron tussen de productgrens en de technische grens komt volledig terug ─────────────
// Door de echte herstelactie: de hook `useRecoveryRestore`, de herstelvraag en zijn callback `onRestore`.
const snapshotText = (taskName: string) => {
  const app = newStore();
  app.getState().addTask({ name: taskName });
  return serializeRecoverySnapshot(app.getState());
};
const restoreViaDialog = async () => {
  useAppStore.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const frame = mount(useRecoveryRestore);
  const dialog = await frame.until(() => (frame.values[0] ? frame.values[0] as RecoveryState : false));
  dialog.onRestore();
  await frame.until(() => frame.values[1] === true);
  return { state: useAppStore.getState(), ids: dialog.entries.map(entry => entry.id) };
};
const persist = async (tracker = new RecoveryDeltaTracker()) => {
  const s = useAppStore.getState();
  await runRecoveryTick(tracker, s.activeDocumentId, s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
};
const bytes = pad(model, GRENS + 1);
const reference = { foreign: true as const, byteLength: bytes.length, sha256: sha(bytes) };
const diskPath = join(appData, 'bron.ifc');
const restart = () => {
  if (mode !== 'desktop') return;
  const manifest = join(appData, ownRecoveryNames.manifest);
  writeFileSync(manifest, JSON.stringify({ ...JSON.parse(readFileSync(manifest, 'utf8')), ownerId: 'vorige-start' }));
};
const cases = mode === 'desktop' ? ['desktop'] : ['zonder handle', 'met handle', 'sitebestand', 'twee tabbladen'];
for (const label of cases) {
  await clearRecovery();
  if (mode === 'desktop') writeFileSync(diskPath, bytes);
  if (label === 'met handle') files.set('herstel.ifc', bytes);
  const siteFileId = label === 'sitebestand' ? 'site-model' : null;
  const id = `model-${label}`;
  const record = { id, isDirty: true, filePath: null, datesAsRecorded: false, ifc: snapshotText('Voor de crash'),
    foreignSource: { filePath: mode === 'desktop' ? diskPath : null, siteFileId },
    ifcSource: { ...reference, ...(label === 'met handle' ? { handle: handleOf('herstel.ifc') } : {}) } };
  const healthy = { id: 'gezond', isDirty: true, filePath: null, datesAsRecorded: false, ifc: snapshotText('Gezond tabblad') };
  const hasCopy = mode === 'web' && label !== 'met handle';
  await saveRecovery({
    ...fullRecoverySave(id, label === 'twee tabbladen' ? [record, healthy] : [record]),
    ...(hasCopy ? { ifcSourceCopies: new Map([[id, { bytes, siteFileId, siteFileVersion: siteFileId ? 'v1' : null }]]) } : {}),
  });
  restart();
  const first = await restoreViaDialog();
  const doc = (s: typeof first.state) => [s.ifcSource?.sha256 ?? null, s.ifcSource?.buildingModel ?? false, s.tasks[0]?.name ?? null];
  eq(`herstel ${label}: model en planning terug`, doc(first.state), [reference.sha256, true, 'Voor de crash']);
  eq(`herstel ${label}: het opslagdoel`, saveTargetRef(first.state)?.kind ?? null,
    mode === 'desktop' ? 'path' : label === 'met handle' ? 'handle' : siteFileId ? 'site' : null);
  eq(`herstel ${label}: opgeruimd na Herstellen`, (await loadRecovery()).docs.length, 0);

  const tracker = new RecoveryDeltaTracker();
  useAppStore.getState().updateTask(first.state.tasks[0].id, { name: 'Na eerste Herstellen' });
  await persist(tracker);
  if (label === 'twee tabbladen') {
    eq('twee tabbladen: allebei terug', first.ids.includes('gezond'), true);
    assert(useAppStore.getState().closeDocument('gezond'));
    await persist(tracker);
  }
  restart();
  const next = await loadRecovery();
  eq(`herstel ${label}: de nieuwe snapshot draagt de bron`, next.docs.map(d => [d.id, d.ifcSource?.sha256 ?? null]), [[id, reference.sha256]]);
  if (hasCopy) {
    const copy = await readRecoverySourceCopy(next.docs[0].sourceCopyDocumentKey!, reference.sha256);
    eq(`herstel ${label}: de bronkopie bij de tweede snapshot`, copy ? sha(copy.bytes) : null, reference.sha256);
  }
  const second = await restoreViaDialog();
  eq(`herstel ${label}: tweede Herstellen, model en de bewerkte planning`, [doc(second.state), second.ids], [[reference.sha256, true, 'Na eerste Herstellen'], [id]]);
  eq(`herstel ${label}: opgeruimd na het tweede Herstellen`,
    [(await loadRecovery()).docs.length, mode === 'web' ? db.store('sources', SOURCE_COPY_DB).size : 0], [0, 0]);
  if (mode === 'desktop') eq(`herstel ${label}: het bestand op schijf ongewijzigd`, sha(readFileSync(diskPath)), reference.sha256);
}

if (mode === 'web') {
  // ── 4. Een onderbroken opslag: dezelfde uitkomst als main ─────────────────────────────────────────────────────────
  // Het geval van de reviewer (ronde 3): openen via een handle, één taak wijzigen tot een uitvoer boven de productgrens,
  // de normale herstelronde legt `pendingSha256` vast, en het crashmoment ligt tussen schrijven en broncommit. Het
  // herstelpad is byte-gelijk aan main (de technische grens van 300 MiB): main herstelt de geschreven versie op haar
  // hash; een derde versie met dezelfde lengte niet. De productgrens speelt bij herstel geen rol.
  const { prepareIfcOutput } = await import('@/state/prepareIfcOutput');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { registerRecoveryFlush } = await import('@/services/recovery/recoveryFlush');
  const { replaceWithRecoveryPending } = await import('@/services/recovery/recoveryPendingSource');
  const { runProjectFileWrite } = await import('@/services/fileAccess/writeCoordinator');
  await clearRecovery();
  const app = newStore();
  const before = enc.encode(model);
  files.set('onderbroken.ifc', before);
  await app.getState().openOpenedFile({ name: 'onderbroken.ifc', content: '', bytes: before, ref: { kind: 'handle', handle: handleOf('onderbroken.ifc') } },
    {}, { modelOpenLimit: true });
  const edit = `Planning uit herstel ${'a'.repeat(GRENS * 2)}`;
  app.getState().updateTask(app.getState().tasks[0].id, { name: edit });
  const output = await prepareIfcOutput(app.getState(), buildWriteIFCInput(app.getState(), 'merge'));
  assert(output.prepared, 'de mergevoorbereiding gaf geen uitvoer');
  const written = output.prepared.bytes;
  const docId = app.getState().activeDocumentId!;
  const tracker = new RecoveryDeltaTracker();
  const unregister = registerRecoveryFlush(async () => {
    const s = app.getState();
    await runRecoveryTick(tracker, s.activeDocumentId, s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
  });
  try {
    const outcome = await runProjectFileWrite(() => replaceWithRecoveryPending(docId, output.prepared!.sha256, {
      replace: async () => {
        const loaded = await loadRecovery();
        const recordNow = loaded.docs.find(d => d.id === docId)!;
        eq('onderbroken: manifest met de oude lengte en de nieuwe hash', [recordNow.ifcSource?.byteLength, recordNow.ifcSource?.pendingSha256,
          written.length > GRENS], [before.length, sha(written), true]);
        files.set('onderbroken.ifc', written);
        const recovered = await readRecoveryDocument(recordNow, loaded.archives, true);
        eq('onderbroken: de geschreven versie komt terug op haar hash, zoals main', [recovered.sourceRestored ?? false,
          recovered.ifcSource?.sha256 ?? null, recovered.tasks[0].name === edit], [true, sha(written), true]);
        const third = written.slice();
        third[third.length - 2] ^= 1;
        files.set('onderbroken.ifc', third);
        const unexpected = await readRecoveryDocument(recordNow, loaded.archives, true);
        eq('onderbroken: een derde versie komt niet terug, zoals main', unexpected.sourceRestored ?? false, false);
        return false;
      },
      commit: () => assert.fail('de crashproef hoort geen broncommit te doen'),
    }), () => assert.fail('geen afsluiting in deze proef'));
    eq('onderbroken: niet vervangen', outcome, 'not-replaced');
  } finally {
    unregister();
  }
}

lowerModelOpenLimitForTests();
if (diffs.length) {
  console.log(`XX  ifc-foreign-grens (${mode}): ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-grens (${mode}): alle checks groen (${checks}; productgrens verlaagd tot ${GRENS} bytes)`);
