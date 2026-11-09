// #804 fase 1a, fixronde 1 (review van #864, ronde 1): drie verliesroutes met de flag `ifcForeignContent`. Headless
// tegen de echte store, met de echte bestandslaag (browser: een nep-`showSaveFilePicker` met handles; Tauri: de echte
// plugin-JS met nep-IPC naar Node-fs; site: een nep-`window.openaecHost`). Bewaakt:
//   1. BLOKKEERT 1: wisselt het actieve document tijdens het wachten van Opslaan of Opslaan als (de afhankelijke
//      projecten), dan stopt opslaan stil: geen dialoog, niets geschreven, geen melding over een model;
//   2. BLOKKEERT 2: een export (elk formaat) of Opslaan als naar het bronbestand van een open document met een vreemd
//      deel weigert, met de rode melding, vóór het schrijven; elke route herkent dat bestand (handle: `isSameEntry`; pad:
//      hetzelfde pad of dezelfde bestandsidentiteit; site: hetzelfde `siteFileId`), en een ander bestand mag;
//   3. BLOKKEERT 3: na crashherstel (snapshot, manifest, lezen, herstellen) heeft het document het kenmerk van de bron,
//      zonder bronbytes en zonder handle; Opslaan als en een export naar het oude bestand weigeren, een ander bestand
//      krijgt alleen de planning; een oude snapshot zonder kenmerk werkt zoals altijd;
//   4. het kenmerk in het documentcontract: buiten undo, mee bij wissel en kopie, niet in een gewone opslag.
// Exit 0 = alles groen.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { installNodeFileIpc } from './nodeFileIpc';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
installBrowserStubs();
const idb = installFakeRecoveryIndexedDb();
const reseed = installDeterminism();
const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
const realError = console.error;
const realWarn = console.warn;
console.error = () => {};
console.warn = () => {};

const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { FEATURE_FLAGS } = await import('@/utils/featureFlags');
const { readsAsBytes, readIfcFromText } = await import('@/services/formatRegistry');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { recoverySnapshotInput, serializeRecoverySnapshot } = await import('@/services/recovery/recoverySnapshotInput');
const { RecoveryDeltaTracker } = await import('@/services/recovery/recoveryDelta');
const { runRecoveryTick } = await import('@/services/recovery/recoverySnapshot');
const { loadRecovery, foreignSourceMetaFields } = await import('@/services/recovery/recoveryStore');
const { recoverySaveTarget } = await import('@/state/ifcForeignGuard');
const { DOCUMENT_FIELDS, recoveryInputFromParsed } = await import('@/state/documentContract');
const { createSnapshot } = await import('@/state/snapshot');
const { isForeignSourceTarget } = await import('@/services/fileAccess/foreignSourceTarget');
const { parseForeignSourceFingerprint } = await import('@/services/ifc/foreign/foreignSourceMark');
type Store = ReturnType<typeof createAppStoreContext>['store'];
type RecoverySourceDocument = import('@/services/recovery/recoveryDelta').RecoverySourceDocument;
type ForeignSourceMark = import('@/services/ifc/foreign/foreignSourceMark').ForeignSourceMark;

let checks = 0;
const diffs: string[] = [];
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 240)} ≠ ${w?.slice(0, 240)}`);
};
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const fileBytes = (pad: string) => new Uint8Array(readFileSync(join(ROOT, pad)));
const enc = new TextEncoder();
const dec = (b: Uint8Array) => new TextDecoder('utf-8').decode(b);
const bonsai = fileBytes('tests/fixtures/ifc-foreign/bonsai-4d.ifc');
const eigenPlus = fileBytes('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
const showcase = fileBytes('public/examples/showcase-verbouwing-eengezinswoning.ifc');
const SAVE_BLOCKED = 'notifications.ifcForeignSaveBlocked';
const TARGET_SAVE = 'notifications.ifcForeignTargetSave';
const TARGET_EXPORT = 'notifications.ifcForeignTargetExport';
const MODEL_KEYS = [SAVE_BLOCKED, TARGET_SAVE, TARGET_EXPORT];

// Alleen in deze test: de flag bruikbaar maken, zoals in `check-ifc-foreign-open.ts`.
FEATURE_FLAGS.find(f => f.id === 'ifcForeignContent')!.writesNewIfcData = false;

/** Een nep-FSA-handle met echte `isSameEntry` (zelfde object), `getFile` en `createWritable`. Functies erin: een
 *  `structuredClone` van iets wat de handle bevat, faalt (zo bewijst de test dat hij niet in Worker of manifest komt). */
function fakeHandle(name: string, initial: Uint8Array) {
  let data = initial;
  const writes: string[] = [];
  let writables = 0;
  const handle = {
    kind: 'file' as const,
    name,
    isSameEntry: async (other: unknown) => other === handle,
    getFile: async () => new File([data as BlobPart], name),
    createWritable: async () => {
      writables++;
      let buffer = '';
      return {
        write: async (chunk: unknown) => { buffer += typeof chunk === 'string' ? chunk : dec(chunk as Uint8Array); },
        close: async () => { data = enc.encode(buffer); writes.push(buffer); },
      };
    },
    queryPermission: async () => 'granted' as const,
    requestPermission: async () => 'granted' as const,
  };
  return { handle: handle as unknown as FileSystemFileHandle, writes, writables: () => writables, text: () => dec(data) };
}
type FakeHandle = ReturnType<typeof fakeHandle>;

let pickerCalls = 0;
let pick: FakeHandle | null = null;
win.showOpenFilePicker = () => { throw new Error('niet in deze test'); };
win.showSaveFilePicker = async () => {
  pickerCalls++;
  if (!pick) throw new DOMException('geannuleerd', 'AbortError');
  return pick.handle;
};

/** Open `bytes` als Bestand → Openen (met de flag), in een verse store of `into`. */
async function open(name: string, bytes: Uint8Array, ref: import('@/services/fileAccess').FileRef | null, into?: Store): Promise<Store> {
  reseed(0x804);
  const store = into ?? createAppStoreContext().store;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const asBytes = readsAsBytes(name, { ifcBytes: true });
  await store.getState().openOpenedFile({ name, content: asBytes ? '' : dec(bytes), ...(asBytes ? { bytes } : {}), ref });
  return store;
}
const modelNotices = (store: Store) => store.getState().ui.notifications.filter(n => MODEL_KEYS.includes(n.messageKey));
const noticeKeys = (store: Store) => modelNotices(store).map(n => [n.messageKey, n.severity, n.refusal === true]);

// ── 1. BLOKKEERT 1: documentwissel tijdens het wachten ─────────────────────────────────────────────────────────
// De wachttijd is die van de afhankelijke projecten (`settleDependentAnchors`: schrijven, lezen en doorrekenen op een
// kopie). Het wisselen gebeurt binnen dat wachten, op een vaste plek: de eerste lezing van de koppeling na het lezen van
// de kopie (`tightDependentAnchors`). Zo dwingt de test de volgorde af die Terra met een timer vond.
for (const action of ['saveFile', 'saveFileAs'] as const) {
  const store = await open('showcase.ifc', showcase, null);
  const S = () => store.getState();
  const ownId = S().activeDocumentId;
  await open('eigen-plus-model.ifc', eigenPlus, null, store);
  const modelId = S().activeDocumentId;
  ok(`${action} wissel: twee documenten, het tweede met een vreemd deel`, ownId !== modelId && S().ifcSource?.foreign === true);
  S().switchDocument(ownId);
  let armed = false;
  let switched = 0;
  const link = {
    projectId: 'afnemer', projectName: 'Afnemer', taskId: 't-af', taskName: 'Afnemer-taak', linkId: 'l-1',
    direction: 'predecessor', relType: 'FS', anchorDate: '2026-01-01',
  } as Record<string, unknown>;
  Object.defineProperty(link, 'ownTaskId', {
    enumerable: true,
    get() {
      if (armed) { armed = false; switched++; store.getState().switchDocument(modelId); }
      return 'geen-taak';
    },
  });
  store.setState(s => {
    s.ui.dependentProjects = [{ documentId: ownId, projectId: s.project.id, links: [link] }] as typeof s.ui.dependentProjects;
  });
  // Controle: zonder wissel komt dezelfde route tot de opslagdialoog (anders bewijst het rode geval niets).
  pickerCalls = 0;
  pick = null;
  await S()[action]();
  eq(`${action} wissel: zonder wissel tot de dialoog`, [pickerCalls, S().activeDocumentId === ownId, switched], [1, true, 0]);
  // Nu wisselen tijdens het wachten.
  const target = fakeHandle('doel.ifc', new Uint8Array());
  pick = target;
  pickerCalls = 0;
  armed = true;
  await S()[action]();
  eq(`${action} wissel: gewisseld tijdens het wachten`, [switched, S().activeDocumentId === modelId], [1, true]);
  eq(`${action} wissel: geen dialoog en niets geschreven`, [pickerCalls, target.writables(), target.writes.length], [0, 0, 0]);
  eq(`${action} wissel: geen melding over een model`, noticeKeys(store), []);
  pick = null;
}

// ── 2a. BLOKKEERT 2, browser (FSA-handle) ──────────────────────────────────────────────────────────────────────
{
  const source = fakeHandle('bonsai-4d.ifc', bonsai);
  const store = await open('bonsai-4d.ifc', bonsai, { kind: 'handle', handle: source.handle });
  const S = () => store.getState();
  const modelId = S().activeDocumentId;
  ok('FSA: het document heeft een vreemd deel en het kenmerk met de handle',
    S().ifcSource?.foreign === true && S().foreignSourceMark?.handle === source.handle && S().foreignSourceMark?.sha256 === sha(bonsai));
  for (const format of ['csv', 'mspdi'] as const) {
    pick = source;
    pickerCalls = 0;
    const result = await S().exportAs(format);
    eq(`FSA ${format}: naar de bron geweigerd, telt als geannuleerd`, result, { ok: true, warnings: [], cancelled: true });
    eq(`FSA ${format}: de dialoog kwam, er is niets geschreven`, [pickerCalls, source.writables(), sha(source.text())], [1, 0, sha(bonsai)]);
  }
  eq('FSA: twee exportweigeringen, één rode melding', noticeKeys(store), [[TARGET_EXPORT, 'error', true]]);
  // Een ander bestand mag.
  const other = fakeHandle('planning.csv', new Uint8Array());
  pick = other;
  const allowed = await S().exportAs('csv');
  eq('FSA: een ander bestand krijgt de export', [allowed.ok, 'cancelled' in allowed && allowed.cancelled, other.writes.length], [true, false, 1]);
  // Opslaan als van een ánder open document (zonder vreemd deel) naar het bronbestand: de tekst "op te slaan".
  await open('showcase.ifc', showcase, null, store);
  ok('FSA: een tweede document zonder vreemd deel', S().activeDocumentId !== modelId && S().foreignSourceMark === null);
  pick = source;
  await S().saveFileAs();
  eq('FSA Opslaan als: naar de bron van het andere document geweigerd', [source.writables(), S().filePath], [0, 'showcase.ifc']);
  ok('FSA Opslaan als: met de melding "op te slaan"', modelNotices(store).some(n => n.messageKey === TARGET_SAVE && n.refusal === true));
  const saveTarget = fakeHandle('kopie.ifc', new Uint8Array());
  pick = saveTarget;
  await S().saveFileAs();
  eq('FSA Opslaan als: een ander bestand mag', [saveTarget.writes.length, S().fileHandle === saveTarget.handle], [1, true]);
  // De controle voor de dialogen buiten de store (bibliotheek, rapport).
  eq('FSA: de store-controle weigert de bron en laat een ander bestand door', [
    await S().foreignTargetCheck('export')({ kind: 'handle', handle: source.handle }),
    await S().foreignTargetCheck('export')({ kind: 'handle', handle: other.handle }),
  ], [true, false]);
  // Een kopie met dezelfde inhoud op een andere plek is een ander bestand (de handle van de bron is bekend).
  const copy = fakeHandle('kopie-van-model.ifc', bonsai);
  eq('FSA: een andere handle met dezelfde inhoud mag als de bronhandle bekend is',
    await isForeignSourceTarget({ kind: 'handle', handle: copy.handle }, [S().getOpenDocumentPayloads().find(d => d.id === modelId)!.payload.foreignSourceMark!]), false);
  pick = null;
}

// ── 2b. BLOKKEERT 2, site (SuperCloud / `window.openaecHost`) ──────────────────────────────────────────────────
{
  const saves: { id?: string; name: string }[] = [];
  const storage = {
    list: async () => [],
    open: async (id: string) => ({ file: { id, name: 'bonsai-4d.ifc', version: 'v1' }, data: bonsai }),
    save: async (request: { id?: string; name: string; data: Blob }) => {
      saves.push({ id: request.id, name: request.name });
      return { id: request.id ?? 'nieuw', name: request.name, version: 'v2' };
    },
    versions: async () => [{ version: 'v1' }],
  };
  win.openaecHost = { storage };
  const store = await open('bonsai-4d.ifc', bonsai, { kind: 'site', id: 'S1' });
  const S = () => store.getState();
  eq('site: het kenmerk kent het site-bestand', [S().foreignSourceMark?.siteFileId, S().ifcSource?.foreign], ['S1', true]);
  // Een ander document met hetzelfde site-doel (bijv. tweemaal geopend): Ctrl+S weigert vóór de site-write.
  S().newDocument();
  S().addTask({ name: 'Eigen werk' });
  store.setState(s => { s.siteFileId = 'S1'; s.siteFileVersion = 'v1'; s.filePath = 'bonsai-4d.ifc'; });
  await S().saveFile();
  eq('site: Ctrl+S naar het site-bestand van de bron geweigerd, niets op de site', saves, []);
  ok('site: met de melding "op te slaan"', modelNotices(store).some(n => n.messageKey === TARGET_SAVE));
  store.setState(s => { s.siteFileId = 'S2'; s.siteFileVersion = 'v1'; s.filePath = 'eigen.ifc'; });
  await S().saveFile();
  eq('site: een ander site-bestand krijgt de nieuwe versie', saves.map(x => x.id), ['S2']);
  eq('site: de route herkent het id, en niet een ander id', [
    await isForeignSourceTarget({ kind: 'site', id: 'S1' }, [S().getOpenDocumentPayloads().find(d => d.payload.foreignSourceMark)!.payload.foreignSourceMark!]),
    await isForeignSourceTarget({ kind: 'site', id: 'S2' }, [S().getOpenDocumentPayloads().find(d => d.payload.foreignSourceMark)!.payload.foreignSourceMark!]),
  ], [true, false]);
  delete win.openaecHost;
}

// ── 3. BLOKKEERT 3: crashherstel, browser ──────────────────────────────────────────────────────────────────────
let recoveryText = '';
let oldRecoveryText = '';
{
  const source = fakeHandle('bonsai-4d.ifc', bonsai);
  const store = await open('bonsai-4d.ifc', bonsai, { kind: 'handle', handle: source.handle });
  const S = () => store.getState();
  S().addTask({ name: 'Werk van voor de crash' });
  // Een snapshot zoals vóór de fixronde: dezelfde writer, zonder kenmerk.
  oldRecoveryText = serializeRecoverySnapshot({ ...S(), foreignSourceMark: null });
  // Wat naar de Worker gaat: alleen de vingerafdruk, geen bronbytes en geen handle (structuredClone van een handle
  // met functies faalt; dat van de invoer niet).
  const input = recoverySnapshotInput(S());
  eq('herstel: de Worker-invoer draagt alleen de vingerafdruk',
    input.input.recoveryForeignSource, { sha256: sha(bonsai), byteLength: bonsai.length });
  let cloneError = '';
  try { structuredClone(input); } catch (e) { cloneError = (e as Error).name; }
  ok('herstel: de Worker-invoer is te klonen (geen handle, geen functie)', cloneError === '' && !JSON.stringify(input).includes('"bytes"'));
  // De route van `useAutoSave`: metadata met `recoverySaveTarget`, dan de echte herstelronde naar de web-opslag.
  const docs: RecoverySourceDocument[] = S().getOpenDocumentPayloads().map(({ id, payload }) => ({
    id, source: payload, isDirty: payload.isDirty, datesAsRecorded: payload.datesAsRecorded, ...recoverySaveTarget(payload),
  }));
  ok('herstel: de herstelronde schreef', await runRecoveryTick(new RecoveryDeltaTracker(), S().activeDocumentId, docs));
  const manifest = [...idb.store('records').values()].find(r => (r as { kind?: string }).kind === 'manifest') as
    { documents: Record<string, unknown>[] } | undefined;
  eq('herstel: het manifest heeft geen opslagdoel maar wel het doel van de bron', manifest?.documents.map(d => [d.filePath, d.foreignSource]),
    [[null, { filePath: 'bonsai-4d.ifc', siteFileId: null }]]);
  ok('herstel: geen bronbytes en geen handle in het manifest', !JSON.stringify(manifest).includes('"bytes"') && !JSON.stringify(manifest).includes('isSameEntry'));

  const loaded = await loadRecovery();
  eq('herstel: één kopie', loaded.docs.length, 1);
  recoveryText = loaded.docs[0].ifc;
  ok('herstel: de snapshot draagt het kenmerk', recoveryText.includes("'OPS_RecoveryForeignSource'") && recoveryText.includes(sha(bonsai)));
  ok('herstel: geen model in de snapshot', !recoveryText.includes('IFCWALL'));
  const parsed = await readIfcFromText(recoveryText, {}, { ifcBytes: true, resolveXerArchiveReference: (h) => loaded.archives.get(h) });
  eq('herstel: de lezer leest de vingerafdruk', parsed.recoveryForeignSource, { sha256: sha(bonsai), byteLength: bonsai.length });
  ok('herstel: de herstelkopie heeft geen vreemd deel (het kenmerk is eigen data)', parsed.ifcSource?.foreign === false);
  const d = loaded.docs[0];
  const restored = createAppStoreContext().store;
  restored.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  restored.getState().restoreDocuments([recoveryInputFromParsed(parsed, {
    id: d.id, filePath: d.filePath, siteFileId: d.siteFileId ?? null, siteFileVersion: d.siteFileVersion ?? null,
    foreignSource: d.foreignSource ?? null, isDirty: d.isDirty, datesAsRecorded: d.datesAsRecorded,
  })], loaded.activeDocumentId);
  const R = () => restored.getState();
  eq('herstel: het document heeft het kenmerk, zonder handle, zonder vreemd deel en zonder doel',
    [R().foreignSourceMark, R().ifcSource?.foreign === true, R().filePath],
    [{ sha256: sha(bonsai), byteLength: bonsai.length, filePath: 'bonsai-4d.ifc', siteFileId: null, handle: null }, false, null]);
  ok('herstel: de planning van voor de crash is er', R().tasks.some(t => t.name === 'Werk van voor de crash'));
  eq('herstel: geen melding bij het herstel', noticeKeys(restored), []);

  // Na een herstart is de handle van het oude bestand een nieuw object: de app herkent het aan de inhoud.
  const oldFile = fakeHandle('bonsai-4d.ifc', bonsai);
  pick = oldFile;
  pickerCalls = 0;
  await R().saveFile();
  eq('herstel: Opslaan wordt Opslaan als, naar het oude bestand geweigerd', [pickerCalls, oldFile.writables(), sha(oldFile.text())], [1, 0, sha(bonsai)]);
  ok('herstel: met de melding "op te slaan"', modelNotices(restored).some(n => n.messageKey === TARGET_SAVE && n.refusal === true));
  await R().saveFileAs();
  eq('herstel: Opslaan als naar het oude bestand geweigerd', oldFile.writables(), 0);
  const csv = await R().exportAs('csv');
  eq('herstel: export naar het oude bestand geweigerd', [csv, oldFile.writables()], [{ ok: true, warnings: [], cancelled: true }, 0]);
  ok('herstel: met de melding "naar te exporteren"', modelNotices(restored).some(n => n.messageKey === TARGET_EXPORT));
  const fresh = fakeHandle('nieuw.ifc', new Uint8Array());
  pick = fresh;
  await R().saveFileAs();
  const written = fresh.writes[0] ?? '';
  ok('herstel: een ander bestand krijgt de planning', written.includes('Werk van voor de crash') && R().isDirty === false);
  ok('herstel: alleen de planning: geen model en geen herstelkenmerk', !written.includes('IFCWALL') && !written.includes('OPS_RecoveryForeignSource'));
  // Daarna is het nieuwe bestand het doel; Ctrl+S schrijft er weer naar (de inhoud verschilt van de bron).
  R().addTask({ name: 'Na herstel' });
  await R().saveFile();
  eq('herstel: Ctrl+S naar het nieuwe bestand', [fresh.writes.length, R().isDirty], [2, false]);
  ok('herstel: het kenmerk blijft tot het document sluit', R().foreignSourceMark?.sha256 === sha(bonsai));
  pick = null;
}

// ── 3b. Oude snapshot en oud manifest ──────────────────────────────────────────────────────────────────────────
{
  // Een oude snapshot (zonder de pset) en een oud manifest (zonder `foreignSource`): geen kenmerk, alles mag.
  ok('oude snapshot: zonder de pset', !oldRecoveryText.includes('OPS_RecoveryForeignSource'));
  const oldParsed = await readIfcFromText(oldRecoveryText, {}, { ifcBytes: true });
  eq('oude snapshot: geen vingerafdruk', oldParsed.recoveryForeignSource, undefined);
  const store = createAppStoreContext().store;
  store.getState().restoreDocuments([recoveryInputFromParsed(oldParsed, {
    id: 'oud', filePath: null, isDirty: true, datesAsRecorded: false,
  })], 'oud');
  eq('oude snapshot: geen kenmerk', store.getState().foreignSourceMark, null);
  const anyFile = fakeHandle('bonsai-4d.ifc', bonsai);
  pick = anyFile;
  await store.getState().saveFileAs();
  eq('oude snapshot: Opslaan als werkt zoals altijd', [anyFile.writes.length, noticeKeys(store)], [1, []]);
  // Nieuwe snapshot, oud manifest: het kenmerk zonder doel; de inhoud herkent het oude bestand nog.
  const parsed = await readIfcFromText(recoveryText, {}, { ifcBytes: true });
  const store2 = createAppStoreContext().store;
  store2.getState().restoreDocuments([recoveryInputFromParsed(parsed, { id: 'half', filePath: null, isDirty: true, datesAsRecorded: false })], 'half');
  eq('oud manifest: het kenmerk zonder doel', [store2.getState().foreignSourceMark?.filePath, store2.getState().foreignSourceMark?.siteFileId], [null, null]);
  const old2 = fakeHandle('model.ifc', bonsai);
  pick = old2;
  await store2.getState().saveFileAs();
  eq('oud manifest: het oude bestand blijft geweigerd (inhoud)', old2.writables(), 0);
  pick = null;
  // Soepel lezen: een kapotte vingerafdruk of een vreemde manifestvorm telt als afwezig.
  eq('soepel: ongeldige vingerafdruk', [parseForeignSourceFingerprint('abc', 1), parseForeignSourceFingerprint(sha(bonsai), -1),
    parseForeignSourceFingerprint(sha(bonsai), 1.5)], [null, null, null]);
  eq('soepel: manifestvorm', [foreignSourceMetaFields({}), foreignSourceMetaFields({ foreignSource: 'x' }),
    foreignSourceMetaFields({ foreignSource: { filePath: 3, siteFileId: 'S' } })],
    [{}, {}, { foreignSource: { filePath: null, siteFileId: 'S' } }]);
}

// ── 2c en 3c. Tauri: pad en bestandsidentiteit (echte plugin-JS, nep-IPC naar Node-fs) ─────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), 'ops-804-doel-'));
  const modelPath = join(dir, 'model.ifc');
  writeFileSync(modelPath, bonsai);
  symlinkSync(modelPath, join(dir, 'link.csv'));
  symlinkSync(modelPath, join(dir, 'link.ifc'));
  const savedWindow = (globalThis as { window?: unknown }).window;
  const ipc = installNodeFileIpc();
  const tauriWin = (globalThis as unknown as { window: Record<string, unknown> }).window;
  tauriWin.parent = tauriWin;
  let dialogAnswer: string | null = null;
  const internals = tauriWin.__TAURI_INTERNALS__ as { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> };
  const innerInvoke = internals.invoke;
  internals.invoke = async (command, args, options) => {
    if (command === 'plugin:dialog|save') return dialogAnswer;
    return innerInvoke(command, args, options);
  };
  try {
    const store = createAppStoreContext().store;
    reseed(0x804);
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    // Openen gaat in Tauri via het pad; de store-route is dezelfde als in de browser.
    await store.getState().openOpenedFile({ name: 'model.ifc', content: '', bytes: bonsai, ref: { kind: 'path', path: modelPath } });
    const S = () => store.getState();
    eq('Tauri: het kenmerk kent het pad', [S().foreignSourceMark?.filePath, S().ifcSource?.foreign], [modelPath, true]);
    const unchanged = () => sha(readFileSync(modelPath));
    // Export via een link met een andere naam (de extensie plakt de dialoog er niet aan): dezelfde bestandsidentiteit.
    dialogAnswer = join(dir, 'link.csv');
    const viaLink = await S().exportAs('csv');
    eq('Tauri export: via een link naar de bron geweigerd, niets geschreven', [viaLink, unchanged()],
      [{ ok: true, warnings: [], cancelled: true }, sha(bonsai)]);
    ok('Tauri export: met de melding "naar te exporteren"', modelNotices(store).some(n => n.messageKey === TARGET_EXPORT));
    dialogAnswer = join(dir, 'planning.csv');
    const allowed = await S().exportAs('csv');
    ok('Tauri export: een ander bestand mag', allowed.ok && !('cancelled' in allowed && allowed.cancelled) && readFileSync(join(dir, 'planning.csv')).length > 0);
    // Opslaan als vanuit een ander document: hetzelfde pad (anders gespeld) en dezelfde identiteit.
    S().newDocument();
    S().addTask({ name: 'Eigen werk' });
    for (const answer of [modelPath, `${dir}//model.ifc`, join(dir, 'link.ifc')]) {
      dialogAnswer = answer;
      await S().saveFileAs();
      eq(`Tauri Opslaan als ${answer.slice(dir.length)}: geweigerd, niets geschreven`, [unchanged(), S().filePath], [sha(bonsai), null]);
    }
    ok('Tauri Opslaan als: met de melding "op te slaan"', modelNotices(store).some(n => n.messageKey === TARGET_SAVE));
    dialogAnswer = join(dir, 'eigen.ifc');
    await S().saveFileAs();
    eq('Tauri Opslaan als: een ander bestand mag', [S().filePath, readFileSync(join(dir, 'eigen.ifc'), 'utf8').includes('Eigen werk')],
      [join(dir, 'eigen.ifc'), true]);

    // Na crashherstel: het pad komt uit het manifest, de vingerafdruk uit de snapshot.
    const parsed = await readIfcFromText(recoveryText, {}, { ifcBytes: true });
    const restored = createAppStoreContext().store;
    restored.getState().restoreDocuments([recoveryInputFromParsed(parsed, {
      id: 'tauri', filePath: null, foreignSource: { filePath: modelPath, siteFileId: null }, isDirty: true, datesAsRecorded: false,
    })], 'tauri');
    dialogAnswer = modelPath;
    await restored.getState().saveFileAs();
    eq('Tauri herstel: Opslaan als naar het oude pad geweigerd', [unchanged(), restored.getState().filePath], [sha(bonsai), null]);
    ok('Tauri herstel: met de melding "op te slaan"', modelNotices(restored).some(n => n.messageKey === TARGET_SAVE));
    const restoredMarks = [restored.getState().foreignSourceMark].filter((m): m is ForeignSourceMark => m !== null);
    eq('Tauri: de route herkent een pad met dezelfde identiteit, en niet een ander bestand', [
      await isForeignSourceTarget({ kind: 'path', path: join(dir, 'link.ifc') }, restoredMarks,
        { identityFs: { stat: async (p) => { const st = (await import('node:fs')).statSync(p); return { isFile: true, dev: st.dev, ino: st.ino }; } } }),
      await isForeignSourceTarget({ kind: 'path', path: join(dir, 'eigen.ifc') }, restoredMarks),
    ], [true, false]);
  } finally {
    ipc.dispose();
    (globalThis as { window?: unknown }).window = savedWindow;
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── 4. Het kenmerk in het documentcontract ─────────────────────────────────────────────────────────────────────
{
  const field = DOCUMENT_FIELDS.find(f => f.key === 'foreignSourceMark');
  eq('contract: in DOCUMENT_FIELDS, buiten undo', field?.snapshot, 'none');
  const source = fakeHandle('bonsai-4d.ifc', bonsai);
  const store = await open('bonsai-4d.ifc', bonsai, { kind: 'handle', handle: source.handle });
  const S = () => store.getState();
  const mark = S().foreignSourceMark;
  ok('contract: niet in de undo-snapshot', !('foreignSourceMark' in createSnapshot(S())));
  S().addTask({ name: 'Bewerking' });
  S().undo();
  ok('contract: bewerking plus undo houdt het kenmerk', S().foreignSourceMark === mark);
  ok('contract: een gewone opslag schrijft het kenmerk niet', !writeIFC(buildWriteIFCInput(S())).includes('OPS_RecoveryForeignSource')
    && !('recoveryForeignSource' in buildWriteIFCInput(S())));
  ok('contract: de herstelsnapshot wel', serializeRecoverySnapshot(S()).includes('OPS_RecoveryForeignSource'));
  S().duplicateDocument();
  ok('contract: een kopie deelt het kenmerk', S().foreignSourceMark === mark);
  const copyId = S().activeDocumentId;
  S().newDocument();
  eq('contract: een nieuw document heeft geen kenmerk', S().foreignSourceMark, null);
  S().switchDocument(copyId);
  ok('contract: documentwissel brengt het kenmerk terug', S().foreignSourceMark === mark);
  // Een ander bestand openen op een eigen doel geeft geen kenmerk (geen vreemd deel).
  await open('showcase.ifc', showcase, null, store);
  eq('contract: een eigen bestand zonder model heeft geen kenmerk', S().foreignSourceMark, null);
}

console.error = realError;
console.warn = realWarn;
if (diffs.length > 0) {
  console.log(`XX  ifc-foreign-target: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 60)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-target: alle checks groen (${checks})`);
process.exit(0);
