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
//   4. het kenmerk in het documentcontract: buiten undo, mee bij wissel en kopie, niet in een gewone opslag;
//   5. fixronde 2 (review van #864, ronde 2): de app leest het gekozen bestaande doel zelf. Een IFC met een gebouwmodel
//      krijgt geen planning eroverheen: na herstel ook een gewijzigde modelversie (Sol: één ander byte, een extra
//      commentaarregel), een modelbestand dat niet open is, en bij AutoSave (twee documenten, één doel: model intact, A
//      gewijzigd, precies één melding, geen nieuwe poging). Een bestaand CSV, een eigen IFC en een doel dat de app niet
//      kan lezen, mogen. Per route (handle, Tauri-pad via plugin-fs `read`, site) en voor de dev-bridge; met de flag uit
//      geen inhoudscontrole.
// Exit 0 = alles groen.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
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
const TARGET_AUTOSAVE = 'notifications.ifcForeignTargetAutoSave';
const MODEL_KEYS = [SAVE_BLOCKED, TARGET_SAVE, TARGET_EXPORT, TARGET_AUTOSAVE];

// Alleen in deze test: de flag bruikbaar maken, zoals in `check-ifc-foreign-open.ts`.
FEATURE_FLAGS.find(f => f.id === 'ifcForeignContent')!.writesNewIfcData = false;

/** Een nep-FSA-handle met echte `isSameEntry` (zelfde object), `getFile` en `createWritable`. Functies erin: een
 *  `structuredClone` van iets wat de handle bevat, faalt (zo bewijst de test dat hij niet in Worker of manifest komt). */
function fakeHandle(name: string, initial: Uint8Array) {
  let data = initial;
  const writes: string[] = [];
  let writables = 0;
  let permissionQueries = 0;
  let unreadable = false;
  const handle = {
    kind: 'file' as const,
    name,
    isSameEntry: async (other: unknown) => other === handle,
    getFile: async () => {
      if (unreadable) throw new DOMException('niet leesbaar', 'NotReadableError');
      return new File([data as BlobPart], name);
    },
    createWritable: async () => {
      writables++;
      let buffer = '';
      return {
        write: async (chunk: unknown) => { buffer += typeof chunk === 'string' ? chunk : dec(chunk as Uint8Array); },
        close: async () => { data = enc.encode(buffer); writes.push(buffer); unreadable = false; },
      };
    },
    queryPermission: async () => { permissionQueries++; return 'granted' as const; },
    requestPermission: async () => 'granted' as const,
  };
  return {
    handle: handle as unknown as FileSystemFileHandle, writes, writables: () => writables, text: () => dec(data),
    /** Een ander programma vervangt het bestand. */
    replace: (bytes: Uint8Array) => { data = bytes; },
    permissionQueries: () => permissionQueries,
    /** `getFile()` faalt tot de eerste write (fixronde 2: een doel dat de app vóór het schrijven niet kan lezen). */
    unreadableUntilWrite: () => { unreadable = true; },
  };
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
  // Fixronde 2: de app leest een bestaand site-doel; S1 is het modelbestand, S2 een eigen planning.
  const storage = {
    list: async () => [],
    open: async (id: string) => ({ file: { id, name: 'bonsai-4d.ifc', version: 'v1' }, data: id === 'S1' ? bonsai : showcase }),
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

// ── 5. Fixronde 2 (review van #864, ronde 2): de app leest het gekozen bestaande doel zelf ─────────────────────────
// Besluit Trias (wrakko, 9 november 2026): bevat een bestaand doel dat de app kan lezen een gebouwmodel (een IFC met
// `IfcProduct`/`IfcTypeProduct`), dan schrijft de app niet. Niet leesbaar ⇒ schrijven mag. Alleen met de flag aan.
const modelIfc4 = fileBytes('tests/fixtures/ifc-foreign/model-ifc4.ifc');
/** Sol's twee scenario's na herstel: dezelfde lengte met één ander byte, en een extra commentaarregel. */
const oneByteChanged = (() => {
  const copy = bonsai.slice();
  const at = dec(bonsai).indexOf("FILE_NAME('") + "FILE_NAME('".length;
  copy[at] = copy[at] === 0x62 ? 0x63 : 0x62;
  return copy;
})();
const extraComment = (() => {
  const text = dec(bonsai);
  const at = text.indexOf('DATA;') + 'DATA;'.length;
  return enc.encode(`${text.slice(0, at)}\n/* een extra regel van een ander programma */${text.slice(at)}`);
})();
const noticeCount = (store: Store, key: string) =>
  store.getState().ui.notifications.filter(n => n.messageKey === key).reduce((sum, n) => sum + n.count, 0);
const OLD_CONTENT = 'OUDE-INHOUD;van;een;ander;programma\n';

// ── 5a. Na herstel (browser): een gewijzigde modelversie, een ander modelbestand, CSV, een eigen IFC, niet leesbaar ──
{
  const parsed = await readIfcFromText(recoveryText, {}, { ifcBytes: true });
  const store = createAppStoreContext().store;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  store.getState().restoreDocuments([recoveryInputFromParsed(parsed, {
    id: 'hersteld', filePath: null, foreignSource: { filePath: 'bonsai-4d.ifc', siteFileId: null }, isDirty: true, datesAsRecorded: false,
  })], 'hersteld');
  const R = () => store.getState();
  const mark = R().foreignSourceMark!;
  eq('herstel 2: het kenmerk van bonsai-4d.ifc', [mark.sha256, mark.handle], [sha(bonsai), null]);
  for (const [label, bytes] of [['één ander byte, zelfde lengte', oneByteChanged], ['een extra commentaarregel', extraComment]] as const) {
    const target = fakeHandle('bonsai-4d.ifc', bytes);
    eq(`herstel 2, ${label}: de identiteitscontrole van ronde 1 ziet een ander bestand`, [
      bytes.length === bonsai.length || label.includes('commentaar'), sha(bytes) !== sha(bonsai),
      await isForeignSourceTarget({ kind: 'handle', handle: target.handle }, [mark]),
    ], [true, true, false]);
    pick = target;
    await R().saveFileAs();
    const csv = await R().exportAs('csv');
    eq(`herstel 2, ${label}: Opslaan als en export geweigerd, het model is er nog`,
      [target.writables(), csv, target.text() === dec(bytes)], [0, { ok: true, warnings: [], cancelled: true }, true]);
  }
  eq('herstel 2: met de meldingen "op te slaan" en "naar te exporteren"',
    [noticeCount(store, TARGET_SAVE) > 0, noticeCount(store, TARGET_EXPORT) > 0], [true, true]);
  const otherModel = fakeHandle('ander-model.ifc', modelIfc4);
  pick = otherModel;
  await R().saveFileAs();
  eq('herstel 2: een modelbestand dat niet open is, geweigerd', [otherModel.writables(), R().fileHandle], [0, null]);
  const csvFile = fakeHandle('planning.csv', enc.encode(OLD_CONTENT));
  pick = csvFile;
  const csvAllowed = await R().exportAs('csv');
  eq('herstel 2: een bestaand CSV als doel mag', [csvAllowed.ok && !('cancelled' in csvAllowed && csvAllowed.cancelled),
    csvFile.writes.length, csvFile.text().includes('OUDE-INHOUD')], [true, 1, false]);
  const ownIfc = fakeHandle('eigen.ifc', showcase);
  pick = ownIfc;
  await R().saveFileAs();
  eq('herstel 2: een bestaande eigen IFC (geen model) mag', [ownIfc.writes.length, R().fileHandle === ownIfc.handle], [1, true]);
  // Niet leesbaar ⇒ schrijven mag door (besluit wrakko, 9 november 2026).
  const locked = fakeHandle('vergrendeld.ifc', modelIfc4);
  locked.unreadableUntilWrite();
  pick = locked;
  await R().saveFileAs();
  eq('herstel 2: een doel dat de app niet kan lezen, mag', [locked.writes.length, R().fileHandle === locked.handle], [1, true]);
  pick = null;
}

// ── 5b. Met de flag uit: geen inhoudscontrole (de app blijft byte-gelijk aan main) ─────────────────────────────────
{
  reseed(0x804);
  const store = createAppStoreContext().store;
  await store.getState().openOpenedFile({ name: 'showcase.ifc', content: dec(showcase), ref: null });
  const target = fakeHandle('ander-model.ifc', modelIfc4);
  pick = target;
  await store.getState().saveFileAs();
  eq('flag uit: Opslaan als naar een modelbestand schrijft, zoals op main', [target.writes.length, noticeKeys(store)], [1, []]);
  pick = null;
}

// ── 5c. BLOKKEERT 1: AutoSave, twee documenten en één doel (Sol's proef) ────────────────────────────────────────────
{
  const { createFileAutoSaveController } = await import('@/services/actualAutosave/fileAutoSave');
  const shared = fakeHandle('planning.ifc', showcase);
  const store = await open('planning.ifc', showcase, { kind: 'handle', handle: shared.handle });
  const S = () => store.getState();
  const aId = S().activeDocumentId;
  S().setAutoSaveToFile(true);
  // Een ander programma vervangt het bestand door een versie met model; de planner opent die als document B.
  shared.replace(bonsai);
  await open('planning.ifc', bonsai, { kind: 'handle', handle: shared.handle }, store);
  const bId = S().activeDocumentId;
  ok('AutoSave: B is het modelbestand, met een vreemd deel en dezelfde handle',
    bId !== aId && S().ifcSource?.foreign === true && S().foreignSourceMark?.handle === shared.handle);
  S().switchDocument(aId);
  S().addTask({ name: 'Werk in A' });
  const payloadA = () => S().getOpenDocumentPayloads().find(d => d.id === aId)!.payload;
  ok('AutoSave: A staat aan en is gewijzigd', payloadA().autoSaveToFile && payloadA().isDirty);
  const controller = createFileAutoSaveController({ getState: S, enabled: () => true });
  await controller.flush();
  eq('AutoSave: niets geschreven, het model is er nog, A blijft gewijzigd, precies één melding',
    [shared.writables(), shared.text() === dec(bonsai), payloadA().isDirty, noticeCount(store, TARGET_AUTOSAVE)], [0, true, true, 1]);
  ok('AutoSave: de melding is rood en een weigering',
    S().ui.notifications.some(n => n.messageKey === TARGET_AUTOSAVE && n.severity === 'error' && n.refusal === true));
  // Daarna probeert AutoSave niet opnieuw naar dat doel: geen permissievraag, geen write, geen tweede melding.
  const queries = shared.permissionQueries();
  S().addTask({ name: 'Nog meer werk in A' });
  await controller.flush();
  await controller.flush();
  eq('AutoSave: geen nieuwe poging naar dat doel', [shared.permissionQueries() - queries, shared.writables(),
    noticeCount(store, TARGET_AUTOSAVE)], [0, 0, 1]);
  // De planner slaat zelf op, in een ander bestand: AutoSave gaat daar verder.
  const fresh = fakeHandle('planning-2.ifc', new Uint8Array());
  pick = fresh;
  await S().saveFileAs();
  pick = null;
  S().addTask({ name: 'Na opslaan' });
  await controller.flush();
  eq('AutoSave: na Opslaan als in een ander bestand weer actief', [fresh.writes.length, payloadA().isDirty, shared.writables(),
    noticeCount(store, TARGET_AUTOSAVE)], [2, false, 0, 1]);
}
{
  const { createFileAutoSaveController } = await import('@/services/actualAutosave/fileAutoSave');
  // Het eigen bestand van een document wordt buiten de app een modelbestand (dat niet open is).
  const own = fakeHandle('eigen.ifc', showcase);
  const store = await open('eigen.ifc', showcase, { kind: 'handle', handle: own.handle });
  store.getState().setAutoSaveToFile(true);
  own.replace(modelIfc4);
  store.getState().addTask({ name: 'Werk' });
  await createFileAutoSaveController({ getState: () => store.getState(), enabled: () => true }).flush();
  eq('AutoSave: een eigen doel dat nu een model bevat: niets geschreven, gewijzigd, één melding',
    [own.writables(), own.text() === dec(modelIfc4), store.getState().isDirty, noticeCount(store, TARGET_AUTOSAVE)], [0, true, true, 1]);
  // Niet leesbaar ⇒ AutoSave mag.
  const locked = fakeHandle('eigen-3.ifc', showcase);
  const store3 = await open('eigen-3.ifc', showcase, { kind: 'handle', handle: locked.handle });
  store3.getState().setAutoSaveToFile(true);
  locked.replace(modelIfc4);
  locked.unreadableUntilWrite();
  store3.getState().addTask({ name: 'Werk' });
  await createFileAutoSaveController({ getState: () => store3.getState(), enabled: () => true }).flush();
  eq('AutoSave: een doel dat de app niet kan lezen, mag', [locked.writes.length, store3.getState().isDirty, noticeKeys(store3)], [1, false, []]);
  // Met de flag uit: AutoSave schrijft zoals op main.
  const plainTarget = fakeHandle('eigen-2.ifc', showcase);
  reseed(0x804);
  const plain = createAppStoreContext().store;
  await plain.getState().openOpenedFile({ name: 'eigen-2.ifc', content: dec(showcase), ref: { kind: 'handle', handle: plainTarget.handle } });
  plain.getState().setAutoSaveToFile(true);
  plainTarget.replace(modelIfc4);
  plain.getState().addTask({ name: 'Werk' });
  await createFileAutoSaveController({ getState: () => plain.getState(), enabled: () => true }).flush();
  eq('AutoSave met de flag uit: schrijft zoals op main', [plainTarget.writes.length, plain.getState().isDirty, noticeKeys(plain)], [1, false, []]);
}

// ── 5d. Tauri: het doel als stroom via plugin-fs `read` (echte plugin-JS, nep-IPC naar Node-fs) ─────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), 'ops-804-doel2-'));
  const modelPath = join(dir, 'ander-model.ifc');
  writeFileSync(modelPath, modelIfc4);
  // Een groot modelbestand: het model vooraan, daarna ruim 4 MiB eigenschappen. De lezer stopt na het eerste stuk.
  const bigPath = join(dir, 'groot-model.ifc');
  const bonsaiText = dec(bonsai);
  const endsec = bonsaiText.lastIndexOf('ENDSEC;');
  writeFileSync(bigPath, bonsaiText.slice(0, endsec)
    + "#900000=IFCPROPERTYSINGLEVALUE('Vulling',$,IFCLABEL('x'),$);\n".repeat(75_000) + bonsaiText.slice(endsec));
  const csvPath = join(dir, 'planning.csv');
  writeFileSync(csvPath, OLD_CONTENT);
  const ownPath = join(dir, 'eigen.ifc');
  writeFileSync(ownPath, showcase);
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
    reseed(0x804);
    const store = createAppStoreContext().store;
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    await store.getState().openOpenedFile({ name: 'eigen.ifc', content: dec(showcase), ref: { kind: 'path', path: ownPath } });
    const S = () => store.getState();
    eq('Tauri 2: een eigen bestand, zonder vreemd deel', [S().filePath, S().foreignSourceMark], [ownPath, null]);
    dialogAnswer = modelPath;
    await S().saveFileAs();
    eq('Tauri 2: Opslaan als naar een modelbestand dat niet open is, geweigerd', [sha(readFileSync(modelPath)), S().filePath],
      [sha(modelIfc4), ownPath]);
    ok('Tauri 2: met de melding "op te slaan"', noticeCount(store, TARGET_SAVE) > 0);
    const before = ipc.bytesRead();
    dialogAnswer = bigPath;
    const t0 = performance.now();
    await S().saveFileAs();
    const ms = performance.now() - t0;
    const read = ipc.bytesRead() - before;
    const bigSize = statSync(bigPath).size;
    eq('Tauri 2: een groot modelbestand geweigerd na één stuk van 1 MiB', [read > 0 && read <= (1 << 20), bigSize > (4 << 20),
      S().filePath], [true, true, ownPath]);
    console.log(`..  Tauri: Opslaan als naar een modelbestand van ${(bigSize / 1048576).toFixed(1)} MiB geweigerd in `
      + `${ms.toFixed(0)} ms (${read} bytes gelezen)`);
    dialogAnswer = csvPath;
    const csv = await S().exportAs('csv');
    ok('Tauri 2: een bestaand CSV als doel mag', csv.ok && !('cancelled' in csv && csv.cancelled)
      && !readFileSync(csvPath, 'utf8').includes('OUDE-INHOUD'));
    // Ctrl+S: een ander programma maakt van het eigen bestand een modelbestand.
    writeFileSync(ownPath, modelIfc4);
    S().addTask({ name: 'Werk na de wissel' });
    await S().saveFile();
    eq('Tauri 2: Ctrl+S naar het eigen bestand met nu een model geweigerd', [sha(readFileSync(ownPath)), S().isDirty],
      [sha(modelIfc4), true]);
    // Niet leesbaar ⇒ schrijven mag door (besluit wrakko, 9 november 2026).
    ipc.faults.readError = new Error('Input/output error (os error 5)');
    await S().saveFile();
    ipc.faults.readError = null;
    eq('Tauri 2: een doel dat de app niet kan lezen, mag', [readFileSync(ownPath, 'utf8').includes('Werk na de wissel'), S().isDirty],
      [true, false]);
    eq('Tauri 2: de lezer sluit elk bestand', ipc.openHandles(), 0);
    ok('Tauri 2: de lezer las via plugin-fs read', ipc.calls.some(c => c.command === 'plugin:fs|read'));
  } finally {
    ipc.dispose();
    (globalThis as { window?: unknown }).window = savedWindow;
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── 5e. Site: het bestaande site-bestand lezen ───────────────────────────────────────────────────────────────────
{
  const saves: string[] = [];
  const siteData: Record<string, Uint8Array> = { M1: modelIfc4, O1: showcase };
  win.openaecHost = { storage: {
    list: async () => [],
    open: async (id: string) => {
      if (!(id in siteData)) throw new Error('niet gevonden');
      return { file: { id, name: `${id}.ifc`, version: 'v1' }, data: siteData[id] };
    },
    save: async (request: { id?: string; name: string }) => {
      saves.push(request.id ?? 'nieuw');
      return { id: request.id ?? 'nieuw', name: request.name, version: 'v2' };
    },
    versions: async () => [{ version: 'v1' }],
  } };
  const store = await open('showcase.ifc', showcase, null);
  const S = () => store.getState();
  S().addTask({ name: 'Eigen werk' });
  store.setState(s => { s.siteFileId = 'M1'; s.siteFileVersion = 'v1'; s.filePath = 'M1.ifc'; });
  await S().saveFile();
  eq('site 2: Ctrl+S naar een site-bestand met een model geweigerd', [saves, noticeCount(store, TARGET_SAVE) > 0, S().isDirty],
    [[], true, true]);
  store.setState(s => { s.siteFileId = 'O1'; s.siteFileVersion = 'v1'; s.filePath = 'O1.ifc'; });
  await S().saveFile();
  eq('site 2: een site-bestand zonder model krijgt de nieuwe versie', saves, ['O1']);
  store.setState(s => { s.siteFileId = 'X1'; s.siteFileVersion = 'v1'; s.filePath = 'X1.ifc'; });
  S().addTask({ name: 'Meer werk' });
  await S().saveFile();
  eq('site 2: een site-bestand dat de app niet kan lezen, mag', saves, ['O1', 'X1']);
  delete win.openaecHost;
}

// ── 5f. Dev-bridge `saveToPath`: dezelfde doelcontrole vóór de write ─────────────────────────────────────────────────
{
  // De dev-bridge laadt de i18n-config (taalrichting op `document`): een kleine stub, alleen voor dit deel.
  (globalThis as unknown as { document?: unknown }).document ??= { documentElement: { dir: '', lang: '' } };
  const { useAppStore } = await import('@/state/appStore');
  const { saveToPathWithIO } = await import('@/utils/devBridge');
  const G = () => useAppStore.getState();
  useAppStore.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  reseed(0x804);
  await G().openOpenedFile({ name: 'bron.ifc', content: '', bytes: bonsai, ref: { kind: 'path', path: '/werk/bron.ifc' } });
  ok('dev-bridge: de bron heeft een vreemd deel', G().foreignSourceMark?.filePath === '/werk/bron.ifc');
  G().newDocument();
  G().addTask({ name: 'Eigen werk' });
  const written: string[] = [];
  const io = { writeTextFile: async (p: string) => { written.push(p); } };
  const deps = {
    identityFs: async () => undefined,
    readers: () => ({ scanPath: async (p: string) => (p === '/werk/model.ifc' ? 'model' as const : p === '/werk/eigen.ifc' ? 'no-model' as const : null) }),
  };
  const attempt = async (p: string) => {
    try { await saveToPathWithIO(p, io, deps); return 'geschreven'; } catch (e) { return (e as Error).message; }
  };
  const bronResult = await attempt('/werk/bron.ifc');
  const modelResult = await attempt('/werk/model.ifc');
  eq('dev-bridge: niet naar de bron van een open document en niet naar een modelbestand',
    [bronResult.includes('gebouwmodel'), modelResult.includes('gebouwmodel'), written], [true, true, []]);
  eq('dev-bridge: een eigen of nieuw bestand mag', [await attempt('/werk/eigen.ifc'), await attempt('/werk/nieuw.ifc'), written],
    ['geschreven', 'geschreven', ['/werk/eigen.ifc', '/werk/nieuw.ifc']]);
  useAppStore.setState(s => { s.ui.featureFlags = {}; });
  eq('dev-bridge met de flag uit: een modelbestand mag, zoals op main', [await attempt('/werk/model.ifc'), written.length], ['geschreven', 3]);
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
