// #804 fase 1a, fixronde 1 (review van #864, ronde 1): drie verliesroutes met de flag `ifcForeignContent`. Headless
// tegen de echte store, met de echte bestandslaag (browser: een nep-`showSaveFilePicker` met handles; Tauri: de echte
// plugin-JS met nep-IPC naar Node-fs; site: een nep-`window.openaecHost`). Bewaakt:
//   1. BLOKKEERT 1: wisselt het actieve document tijdens het wachten van Opslaan of Opslaan als (de afhankelijke
//      projecten), dan stopt opslaan stil: geen dialoog, niets geschreven, geen melding over een model;
//   2. BLOKKEERT 2: een export (elk formaat) of Opslaan als naar het bronbestand van een open document met een vreemd
//      deel weigert, met de rode melding, vóór het schrijven; elke route herkent dat bestand (handle: `isSameEntry`; pad:
//      hetzelfde pad of dezelfde bestandsidentiteit; site: hetzelfde `siteFileId`), en een ander bestand mag;
//   3. BLOKKEERT 3: na crashherstel (snapshot, manifest, lezen, herstellen) heeft het document het kenmerk van de bron,
//      zonder bronbytes en zonder handle; een export naar het oude bestand weigert. Fixronde 2 van #886 (Sol, besluit
//      Trias): elke IFC-uitvoer weigert, ook naar een nieuw bestand en ook met de flag uit, en de volgende snapshot draagt
//      het kenmerk nog; een eigen planning zonder model herstelt en slaat op (flag uit en aan); een oude snapshot zonder
//      kenmerk werkt zoals altijd;
//   4. het kenmerk in het documentcontract: buiten undo, mee bij wissel en kopie, niet in een gewone opslag;
//   5. fixronde 2 (review van #864, ronde 2): de app leest het gekozen bestaande doel zelf. Een IFC met een gebouwmodel
//      krijgt geen planning eroverheen: na herstel ook een gewijzigde modelversie (Sol: één ander byte, een extra
//      commentaarregel), een modelbestand dat niet open is, en bij AutoSave (twee documenten, één doel: model intact, A
//      gewijzigd, precies één melding, geen nieuwe poging). Een bestaand CSV, een eigen IFC en een doel dat de app niet
//      kan lezen, mogen. Per route (handle, Tauri-pad via plugin-fs `read`, site) en voor de dev-bridge; met de flag uit
//      geen inhoudscontrole;
//   6. fixronde 3, BLOKKEERT 1: een lange kop (Sol: 2 MiB + 1 commentaar na `HEADER;`) geeft geen vrijbrief: Opslaan
//      als, export (IFC, CSV) en AutoSave weigeren, via de handle-route (stroom in stukken van 64 KiB) en het Tauri-pad
//      (plugin-fs `read` in stukken van 1 MiB); dezelfde lange kop zonder model mag, na het hele bestand;
//   7. fixronde 3, BLOKKEERT 2: een MCP-backup houdt het kenmerk (vingerafdruk en doel in de pset). De backup openen in
//      een nieuwe sessie: Ctrl+S wordt Opslaan als, de bron als doel weigert (handle: inhoud; Tauri: pad, ook na een
//      wijziging van de bron), een ander bestand mag en krijgt de pset nooit; de pset telt als eigen planning (100 % P);
//      fase 1c PR 9d: met de flag aan is de bron ontbrekend, iedere IFC-route weigert en CSV blijft mogelijk;
//   8. fixronde 3: hoogstens één `getFile()` en één SHA-256 van het doel per controle;
//   9. fixronde 4: Terra's bestand (kapotte kop, alles op één regel) en Sol's bestand (kapotte kop, `#30=\nIFCWALL(`)
//      als doel: Opslaan als, CSV-export en AutoSave schrijven niet, de bestaande tekst blijft, A blijft gewijzigd; per
//      route (handle en Tauri-pad). Review van #870, ronde 6 (besluit Trias): een kapotte kop, ook van een eigen
//      planning, en een STEP-bestand zonder DATA-sectie weigeren met de melding 'niet goed te lezen' (de scanner zegt
//      'unreadable'), zonder terugspoelen. Een eigen bestand met `#900000=IFCWALL(` in commentaar of `#9=IFCWALL(` in een
//      meerregelige string als doel: er komt een write.
//      Ook `council/fix3-twee-data.ifc` (een wand in de tweede DATA-sectie) als doel, ook met parameters bij beide
//      sectiekoppen (`DATA('…',(…));`): geen write.
// Exit 0 = alles groen.
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { installNodeFileIpc } from './nodeFileIpc';
import { brokenNameFiles, commentFile, dataKopBestanden, paramDataFile, solFile, solFileAllSplit, stringFile, terraFile, verstopteWandBestanden } from './ifcDoelBestanden';

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
const { readsAsBytes, readIfcFromText } = await import('@/services/formatRegistry');
const { IfcForeignOpenError, readIfcBytesDetailed } = await import('@/services/ifc/foreign/ifcBytesRoute');
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
// Gesloten bron: alleen een externe pset en haar property, zonder gebouwmodel.
const externalPset = enc.encode(dec(showcase).replace('ENDSEC;\nEND-ISO-10303-21;',
  "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n" +
  "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\nENDSEC;\nEND-ISO-10303-21;"));
const SAVE_BLOCKED = 'notifications.ifcForeignSaveBlocked';
const SOURCE_MISSING = 'notifications.ifcForeignSourceMissing';
const TARGET_SAVE = 'notifications.ifcForeignTargetSave';
const TARGET_EXPORT = 'notifications.ifcForeignTargetExport';
const TARGET_AUTOSAVE = 'notifications.ifcForeignTargetAutoSave';
const UNREADABLE_SAVE = 'notifications.ifcUnreadableTargetSave';
const UNREADABLE_AUTOSAVE = 'notifications.ifcUnreadableTargetAutoSave';
const MODEL_KEYS = [SAVE_BLOCKED, SOURCE_MISSING, TARGET_SAVE, TARGET_EXPORT, TARGET_AUTOSAVE];


/** Een nep-FSA-handle met echte `isSameEntry` (zelfde object), `getFile` en `createWritable`. Functies erin: een
 *  `structuredClone` van iets wat de handle bevat, faalt (zo bewijst de test dat hij niet in Worker of manifest komt). */
function fakeHandle(name: string, initial: Uint8Array, opts: { streamChunk?: number } = {}) {
  let data = initial;
  let streamed = 0;
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
      const file = new File([data as BlobPart], name);
      const chunk = opts.streamChunk;
      if (chunk) {
        // Node levert een `Blob` als één stuk; een browser levert in stukken. `streamChunk` doet dat na.
        const bytes = data;
        Object.defineProperty(file, 'stream', { value: () => {
          let at = 0;
          return new ReadableStream<Uint8Array>({ pull(c) {
            if (at >= bytes.length) { c.close(); return; }
            streamed++;
            c.enqueue(bytes.slice(at, at += chunk));
          } });
        } });
      }
      return file;
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
    /** Het aantal stukken dat een lezer van `getFile().stream()` haalde (alleen met `streamChunk`). */
    streamedChunks: () => streamed,
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
async function open(name: string, bytes: Uint8Array, ref: import('@/services/fileAccess').FileRef | null, into?: Store, flag = true): Promise<Store> {
  reseed(0x804);
  const store = into ?? createAppStoreContext().store;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: flag }; });
  const asBytes = readsAsBytes(name, { ifcBytes: flag });
  await store.getState().openOpenedFile({ name, content: asBytes ? '' : dec(bytes), ...(asBytes ? { bytes } : {}), ref });
  return store;
}
const modelNotices = (store: Store) => store.getState().ui.notifications.filter(n => MODEL_KEYS.includes(n.messageKey));
const noticeKeys = (store: Store) => modelNotices(store).map(n => [n.messageKey, n.severity, n.refusal === true]);
const noticeCount = (store: Store, key: string) =>
  store.getState().ui.notifications.filter(n => n.messageKey === key).reduce((sum, n) => sum + n.count, 0);

const { setIfcMissingSourceAsker, resetIfcMissingSourceAsker } = await import('@/services/ifc/ifcMissingSourceQuestion');
const { readRecoveryDocument } = await import('@/state/readRecoveryDocument');
const { recoverySourceDocument } = await import('@/state/recoverySourceDocument');

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
    [{ sha256: sha(bonsai), byteLength: bonsai.length, filePath: 'bonsai-4d.ifc', siteFileId: null, handle: null, sourceMissing: true }, false, null]);
  ok('herstel: de planning van voor de crash is er', R().tasks.some(t => t.name === 'Werk van voor de crash'));
  eq('herstel: geen melding bij het herstel', noticeKeys(restored), []);

  // #886 fixronde 2 (Sol, BLOKKEERT; besluit Trias 11 november 2026): de bronbytes zijn weg, dus weigert elke IFC-uitvoer,
  // zoals vóór de crash, met de bestaande melding. Eerst schreef Opslaan als naar een nieuw bestand de planning zonder
  // model en zonder kenmerk, en was het document daarna niet meer gewijzigd.
  // Na een herstart is de handle van het oude bestand een nieuw object: de app herkent het aan de inhoud.
  const oldFile = fakeHandle('bonsai-4d.ifc', bonsai);
  pick = oldFile;
  pickerCalls = 0;
  await R().saveFile();
  eq('herstel: Opslaan geweigerd, geen dialoog, het oude bestand blijft', [pickerCalls, oldFile.writables(), sha(oldFile.text())], [0, 0, sha(bonsai)]);
  ok('herstel: met de melding van een vreemd deel', modelNotices(restored).some(n => n.messageKey === SOURCE_MISSING && n.refusal === true));
  const csv = await R().exportAs('csv');
  eq('herstel: export naar het oude bestand geweigerd', [csv, oldFile.writables()], [{ ok: true, warnings: [], cancelled: true }, 0]);
  ok('herstel: met de melding "naar te exporteren"', modelNotices(restored).some(n => n.messageKey === TARGET_EXPORT));
  const fresh = fakeHandle('nieuw.ifc', new Uint8Array());
  pick = fresh;
  pickerCalls = 0;
  await R().saveFileAs();
  const ifcExport = await R().exportAs('ifc');
  eq('herstel (Sol): Opslaan als en de IFC-export naar een nieuw bestand geweigerd, nul writes, het document blijft gewijzigd',
    [pickerCalls, fresh.writables(), ifcExport, R().isDirty, R().filePath, R().fileHandle],
    [0, 0, { ok: true, warnings: [], cancelled: true }, true, null, null]);
  ok('herstel (Sol): met de melding van een vreemd deel, als één melding',
    noticeCount(restored, SOURCE_MISSING) === 2 && modelNotices(restored).filter(n => n.messageKey === SOURCE_MISSING).length === 1);
  // Twee keer crashen verliest de bescherming niet: de volgende herstelsnapshot draagt het kenmerk nog.
  const again = serializeRecoverySnapshot(R());
  ok('herstel: de snapshot ná herstel draagt het kenmerk', again.includes("'OPS_RecoveryForeignSource'") && again.includes(sha(bonsai)));
  const twice = createAppStoreContext().store;
  twice.getState().restoreDocuments([recoveryInputFromParsed(await readIfcFromText(again, {}, { ifcBytes: true }), {
    id: 'twee', filePath: null, foreignSource: { filePath: 'bonsai-4d.ifc', siteFileId: null }, isDirty: true, datesAsRecorded: false,
  })], 'twee');
  await twice.getState().saveFileAs();
  eq('herstel, tweede keer: het kenmerk blijft en Opslaan als weigert (ook met de flag uit)',
    [twice.getState().foreignSourceMark?.sourceMissing, fresh.writables(), noticeCount(twice, SOURCE_MISSING)], [true, 0, 1]);
  ok('herstel: het kenmerk blijft tot het document sluit', R().foreignSourceMark?.sha256 === sha(bonsai));
  pick = null;
}

// ── 3a. Fixronde 2 (eis van Trias): een eigen planning zonder model herstelt en slaat gewoon op, flag uit en aan ─────
for (const flag of [false, true]) {
  const label = flag ? 'flag aan' : 'flag uit';
  reseed(0x804);
  const own = createAppStoreContext().store;
  if (flag) own.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await own.getState().openOpenedFile({ name: 'showcase.ifc', content: dec(showcase), ref: null });
  own.getState().addTask({ name: 'Eigen werk van voor de crash' });
  const snapshot = serializeRecoverySnapshot(own.getState());
  ok(`eigen planning (${label}): geen kenmerk in de snapshot`, !snapshot.includes('OPS_RecoveryForeignSource'));
  const back = createAppStoreContext().store;
  if (flag) back.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  back.getState().restoreDocuments([recoveryInputFromParsed(await readIfcFromText(snapshot, {}, { ifcBytes: flag }), {
    id: 'eigen', filePath: null, isDirty: true, datesAsRecorded: false,
  })], 'eigen');
  const target = fakeHandle('eigen-na-herstel.ifc', new Uint8Array());
  pick = target;
  await back.getState().saveFileAs();
  eq(`eigen planning (${label}): na herstel schrijft Opslaan als, zonder melding`,
    [back.getState().foreignSourceMark, target.writes.length, back.getState().isDirty, noticeKeys(back)], [null, 1, false, []]);
  ok(`eigen planning (${label}): de planning staat erin`, target.text().includes('Eigen werk van voor de crash'));
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
    ok('Tauri herstel: met de melding van een vreemd deel (fixronde 2 van #886)', modelNotices(restored).some(n => n.messageKey === SOURCE_MISSING));
    dialogAnswer = join(dir, 'link.csv');
    const tauriCsv = await restored.getState().exportAs('csv');
    eq('Tauri herstel: export via een link naar het oude pad geweigerd', [tauriCsv, unchanged()], [{ ok: true, warnings: [], cancelled: true }, sha(bonsai)]);
    ok('Tauri herstel: met de melding "naar te exporteren"', modelNotices(restored).some(n => n.messageKey === TARGET_EXPORT));
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
  ok('contract: een gewone opslag schrijft het kenmerk niet', !writeIFC(buildWriteIFCInput(S(), 'merge')).includes('OPS_RecoveryForeignSource')
    && !('recoveryForeignSource' in buildWriteIFCInput(S(), 'merge')));
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
// `IfcProduct`/`IfcTypeProduct`), dan schrijft de app niet. PR 4: ook C/A/V of onleesbaar ⇒ weigeren; alleen met de flag aan.
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
    const csv = await R().exportAs('csv');
    eq(`herstel 2, ${label}: export geweigerd, het model is er nog`,
      [target.writables(), csv, target.text() === dec(bytes)], [0, { ok: true, warnings: [], cancelled: true }, true]);
  }
  // Sinds fixronde 2 van #886 weigert na herstel elke IFC-opslag al vóór het doel; de doelcontrole na herstel loopt hier
  // via de export naar CSV.
  eq('herstel 2: met de melding "naar te exporteren"', noticeCount(store, TARGET_EXPORT) > 0, true);
  const otherModel = fakeHandle('ander-model.ifc', modelIfc4);
  pick = otherModel;
  const otherCsv = await R().exportAs('csv');
  eq('herstel 2: een modelbestand dat niet open is, geweigerd', [otherModel.writables(), otherCsv], [0, { ok: true, warnings: [], cancelled: true }]);
  const csvFile = fakeHandle('planning.csv', enc.encode(OLD_CONTENT));
  pick = csvFile;
  const csvAllowed = await R().exportAs('csv');
  eq('herstel 2: een bestaand CSV als doel mag', [csvAllowed.ok && !('cancelled' in csvAllowed && csvAllowed.cancelled),
    csvFile.writes.length, csvFile.text().includes('OUDE-INHOUD')], [true, 1, false]);
  const ownIfc = fakeHandle('eigen.ifc', showcase);
  pick = ownIfc;
  await R().exportAs('csv');
  eq('herstel 2: een bestaande eigen IFC (geen model) als doel mag', ownIfc.writes.length, 1);
  // PR 4: niet leesbaar is met de flag aan geen bewijs voor een veilig doel.
  const locked = fakeHandle('vergrendeld.ifc', modelIfc4);
  locked.unreadableUntilWrite();
  pick = locked;
  await R().exportAs('csv');
  eq('herstel 2: onleesbaar doel weigert zonder write', [locked.writes.length, locked.writables(), noticeCount(store, 'notifications.ifcUnreadableTargetExport')], [0, 0, 1]);
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
  // PR 4: ook AutoSave weigert een onleesbaar bestaand doel.
  const locked = fakeHandle('eigen-3.ifc', showcase);
  const store3 = await open('eigen-3.ifc', showcase, { kind: 'handle', handle: locked.handle });
  store3.getState().setAutoSaveToFile(true);
  locked.replace(modelIfc4);
  locked.unreadableUntilWrite();
  store3.getState().addTask({ name: 'Werk' });
  await createFileAutoSaveController({ getState: () => store3.getState(), enabled: () => true }).flush();
  eq('AutoSave: onleesbaar doel weigert zonder write', [locked.writes.length, store3.getState().isDirty, noticeCount(store3, UNREADABLE_AUTOSAVE)], [0, true, 1]);
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
    // PR 4: niet leesbaar is met de flag aan geen bewijs voor een veilig doel.
    ipc.faults.readError = new Error('Input/output error (os error 5)');
    await S().saveFile();
    ipc.faults.readError = null;
    eq('Tauri 2: onleesbaar bestaand doel weigert', [sha(readFileSync(ownPath)), S().isDirty, noticeCount(store, UNREADABLE_SAVE)],
      [sha(modelIfc4), true, 1]);
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
  const siteData: Record<string, Uint8Array> = { M1: modelIfc4, O1: showcase, P1: externalPset };
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
  store.setState(s => { s.siteFileId = 'P1'; s.siteFileVersion = 'v1'; s.filePath = 'P1.ifc'; });
  S().addTask({ name: 'Werk voor pset' });
  await S().saveFile();
  eq('site 2: gesloten externe pset weigert op inhoud, ander id', [saves, noticeCount(store, TARGET_SAVE)], [['O1'], 2]);
  store.setState(s => { s.siteFileId = 'X1'; s.siteFileVersion = 'v1'; s.filePath = 'X1.ifc'; });
  S().addTask({ name: 'Meer werk' });
  await S().saveFile();
  eq('site 2: een site-bestand dat de app niet kan lezen weigert', [saves, noticeCount(store, UNREADABLE_SAVE)], [['O1'], 1]);
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

// ── 6. Fixronde 3, BLOKKEERT 1: een lange kop omzeilt de doelcontrole niet (Sol's bestand) ───────────────────────────
// `model-ifc4.ifc` met 2 MiB + 1 commentaar na `HEADER;`. Eerst gaf de scanner na de kopgrens `not-ifc`, en de write ging
// door. Nu: een scan zonder uitkomst is geen vrijbrief; 'geen model' pas als het hele bestand gelezen is.
const longComment = `/*${'x'.repeat((2 << 20) + 1)}*/`;
const solBytes = enc.encode(dec(modelIfc4).replace('HEADER;', `HEADER;${longComment}`));
const ownLongHeader = enc.encode(dec(showcase).replace('HEADER;', `HEADER;${longComment}`));
eq('lange kop: Sol\'s bestand is 2.101.711 bytes', solBytes.length, 2_101_711);
// 6a. Handle-route (browser): Opslaan als, export (IFC en CSV) en AutoSave.
{
  const { createFileAutoSaveController } = await import('@/services/actualAutosave/fileAutoSave');
  const own = fakeHandle('eigen.ifc', showcase);
  const store = await open('eigen.ifc', showcase, { kind: 'handle', handle: own.handle });
  const S = () => store.getState();
  S().addTask({ name: 'Eigen werk' });
  const CHUNK = 64 << 10;
  const target = fakeHandle('sol.ifc', solBytes, { streamChunk: CHUNK });
  pick = target;
  await S().saveFileAs();
  ok('lange kop, handle: de lezer las voorbij de kop, in stukken', target.streamedChunks() > (2 << 20) / CHUNK);
  const ifcExport = await S().exportAs('ifc');
  const csvExport = await S().exportAs('csv');
  eq('lange kop, handle: Opslaan als en export (IFC, CSV) geweigerd, het model is er nog',
    [target.writables(), ifcExport, csvExport, target.text() === dec(solBytes), S().fileHandle === own.handle],
    [0, { ok: true, warnings: [], cancelled: true }, { ok: true, warnings: [], cancelled: true }, true, true]);
  eq('lange kop, handle: met de meldingen "op te slaan" en "naar te exporteren"',
    [noticeCount(store, TARGET_SAVE) > 0, noticeCount(store, TARGET_EXPORT) >= 2], [true, true]);
  // Een lange kop zonder model: de app leest het hele bestand en schrijft dan wel.
  const plainLong = fakeHandle('lang-eigen.ifc', ownLongHeader, { streamChunk: CHUNK });
  pick = plainLong;
  await S().saveFileAs();
  eq('lange kop zonder model, handle: Opslaan als mag', [plainLong.writes.length, S().fileHandle === plainLong.handle], [1, true]);
  pick = null;
  // AutoSave: een ander programma zet Sol's bestand op de plek van het eigen bestand.
  S().setAutoSaveToFile(true);
  plainLong.replace(solBytes);
  S().addTask({ name: 'Werk voor AutoSave' });
  await createFileAutoSaveController({ getState: S, enabled: () => true }).flush();
  eq('lange kop, handle: AutoSave schrijft niet, gewijzigd, één melding',
    [plainLong.writes.length, plainLong.text() === dec(solBytes), S().isDirty, noticeCount(store, TARGET_AUTOSAVE)], [1, true, true, 1]);
}
// 6b. Tauri-pad: dezelfde bytes, gelezen via plugin-fs `read` in stukken van 1 MiB.
{
  const { createFileAutoSaveController } = await import('@/services/actualAutosave/fileAutoSave');
  const dir = mkdtempSync(join(tmpdir(), 'ops-804-kop-'));
  const solPath = join(dir, 'sol.ifc');
  writeFileSync(solPath, solBytes);
  // De Tauri-route zet `.csv` achter een gekozen pad zonder die extensie (`ensureExtension`): een CSV-export naar
  // `sol.ifc` wordt een nieuw bestand `sol.ifc.csv`. Daarom ook Sol's bytes onder een naam op `.csv`.
  const solCsvPath = join(dir, 'sol-model.csv');
  writeFileSync(solCsvPath, solBytes);
  const longOwnPath = join(dir, 'lang-eigen.ifc');
  writeFileSync(longOwnPath, ownLongHeader);
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
    S().addTask({ name: 'Eigen werk' });
    dialogAnswer = solPath;
    const before = ipc.bytesRead();
    await S().saveFileAs();
    const readForSol = ipc.bytesRead() - before;
    const ifcExport = await S().exportAs('ifc');
    dialogAnswer = solCsvPath;
    const csvExport = await S().exportAs('csv');
    eq('lange kop, Tauri: Opslaan als en export (IFC, CSV) geweigerd, het model is er nog',
      [sha(readFileSync(solPath)), sha(readFileSync(solCsvPath)), ifcExport, csvExport, S().filePath],
      [sha(solBytes), sha(solBytes), { ok: true, warnings: [], cancelled: true }, { ok: true, warnings: [], cancelled: true }, ownPath]);
    eq('lange kop, Tauri: de lezer las voorbij de kop (meer dan één stuk), hoogstens het hele bestand',
      [readForSol > (1 << 20), readForSol <= solBytes.length], [true, true]);
    eq('lange kop, Tauri: met de meldingen "op te slaan" en "naar te exporteren"',
      [noticeCount(store, TARGET_SAVE) > 0, noticeCount(store, TARGET_EXPORT) >= 2], [true, true]);
    // Een lange kop zonder model: het hele bestand gelezen, dan mag het.
    dialogAnswer = longOwnPath;
    const beforeOwn = ipc.bytesRead();
    await S().saveFileAs();
    eq('lange kop zonder model, Tauri: Opslaan als mag, na het hele bestand',
      [S().filePath, readFileSync(longOwnPath, 'utf8').includes('Eigen werk'), ipc.bytesRead() - beforeOwn >= ownLongHeader.length],
      [longOwnPath, true, true]);
    // AutoSave naar het Tauri-pad: een ander programma zet Sol's bestand op die plek.
    S().setAutoSaveToFile(true);
    writeFileSync(longOwnPath, solBytes);
    S().addTask({ name: 'Werk voor AutoSave' });
    await createFileAutoSaveController({ getState: S, enabled: () => true }).flush();
    eq('lange kop, Tauri: AutoSave schrijft niet, gewijzigd, één melding',
      [sha(readFileSync(longOwnPath)), S().isDirty, noticeCount(store, TARGET_AUTOSAVE)], [sha(solBytes), true, 1]);
    eq('lange kop, Tauri: de lezer sluit elk bestand', ipc.openHandles(), 0);
  } finally {
    ipc.dispose();
    (globalThis as { window?: unknown }).window = savedWindow;
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── 7. Fixronde 3, BLOKKEERT 2: de MCP-backup houdt het kenmerk (Sol's proef) ─────────────────────────────────────
// Een eigen IFC met een externe pset `ExternInformatie` (geen IfcProduct, wel een vreemd deel) → openen → backup → de
// backup openen in een nieuwe sessie → Opslaan als naar de bron. Eerst schreef de backup het kenmerk niet, en ging die
// write door: `ExternInformatie` weg. Nu: het kenmerk komt mee (vingerafdruk en doel), Ctrl+S wordt Opslaan als, en de
// bron als doel weigert.
const { createAppBackupService } = await import('@/services/mcp/backupService');
const { readIFC } = await import('@/services/ifc/ifcReader');
const externBytes = (() => {
  const text = dec(showcase);
  const project = /#(\d+)=IFCPROJECT\(/.exec(text)![1];
  const at = text.lastIndexOf('ENDSEC;');
  return enc.encode(text.slice(0, at)
    + "#990001=IFCPROPERTYSINGLEVALUE('Bron',$,IFCLABEL('ander programma'),$);\n"
    + "#990002=IFCPROPERTYSET('0Ext0000000000000000aa',$,'ExternInformatie',$,(#990001));\n"
    + `#990003=IFCRELDEFINESBYPROPERTIES('0Ext0000000000000000ab',$,$,$,(#${project}),#990002);\n` + text.slice(at));
})();
const PSET_NAME = 'OPS_RecoveryForeignSource';
/** Een MCP-backup van het actieve document in `ctx`, met een nep-fs in het geheugen. */
async function backupOf(ctx: ReturnType<typeof createAppStoreContext>): Promise<string> {
  const files = new Map<string, string>();
  const service = createAppBackupService(ctx, {
    getFs: async () => ({
      appDataDir: async () => '/data',
      join: async (...parts: string[]) => parts.join('/'),
      mkdir: async () => {},
      writeTextFile: async (p: string, c: string) => { files.set(p, c); },
      readDir: async () => [],
      remove: async () => {},
    }),
    autoBackupEnabled: async () => true,
    now: () => Date.parse('2026-11-10T12:00:00Z'),
  });
  return files.get(await service.makeManualBackup())!;
}
// 7a. Het kenmerk in de pset: heen en terug, met een lastig pad en een site-bestand.
{
  const parsed = readIFC(writeIFC({ ...buildWriteIFCInput(createAppStoreContext().store.getState(), 'planOnly'), recoveryForeignSource: {
    sha256: sha(externBytes), byteLength: externBytes.length,
    target: { filePath: "C:\\Users\\Jan's map\\modèl één.ifc", siteFileId: 'S-1' },
  } }));
  eq('backup-pset: vingerafdruk en doel heen en terug', parsed.recoveryForeignSource, {
    sha256: sha(externBytes), byteLength: externBytes.length, target: { filePath: "C:\\Users\\Jan's map\\modèl één.ifc", siteFileId: 'S-1' },
  });
}
// 7b. Handle-route (browser), flag uit: bestaand gedrag blijft gelijk.
{
  const orig = fakeHandle('extern.ifc', externBytes);
  const ctxA = createAppStoreContext();
  await open('extern.ifc', externBytes, { kind: 'handle', handle: orig.handle }, ctxA.store);
  eq('backup: de bron heeft een vreemd deel en een kenmerk', [ctxA.store.getState().ifcSource?.foreign,
    ctxA.store.getState().foreignSourceMark?.sha256], [true, sha(externBytes)]);
  const backup = await backupOf(ctxA);
  eq('backup: het kenmerk staat erin (vingerafdruk en doel), het vreemde deel niet',
    [backup.includes(PSET_NAME), backup.includes(`'SourcePath',$,IFCTEXT('extern.ifc')`), backup.includes(sha(externBytes)),
      backup.includes('ExternInformatie')], [true, true, true, false]);
  // Een nieuwe sessie: een verse store opent de backup.
  const backupFile = fakeHandle('backup.ifc', enc.encode(backup));
  const store = await open('backup.ifc', enc.encode(backup), { kind: 'handle', handle: backupFile.handle }, undefined, false);
  const S = () => store.getState();
  const mark = S().foreignSourceMark;
  eq('backup geopend: het kenmerk van de bron, zonder handle; geen opslagdoel',
    [mark?.sha256, mark?.byteLength, mark?.filePath, mark?.handle, S().filePath, S().fileHandle],
    [sha(externBytes), externBytes.length, 'extern.ifc', null, null, null]);
  eq('backup geopend: de pset is eigen planning (100 % P, geen vreemd deel)', S().ifcSource?.foreign ?? false, false);
  // Ctrl+S wordt Opslaan als; de bron als doel weigert.
  S().addTask({ name: 'Werk in de backup' });
  pick = orig;
  const pickerBefore = pickerCalls;
  await S().saveFile();
  eq('backup: Ctrl+S opent Opslaan als en weigert de bron', [pickerCalls - pickerBefore, orig.writables(), backupFile.writables(),
    S().isDirty, noticeCount(store, TARGET_SAVE)], [1, 0, 0, true, 1]);
  await S().saveFileAs();
  const ifcExport = await S().exportAs('ifc');
  const csvExport = await S().exportAs('csv');
  eq('backup: Opslaan als en export (IFC, CSV) naar de bron geweigerd, de bron is ongewijzigd',
    [orig.writables(), ifcExport, csvExport, orig.text() === dec(externBytes), noticeCount(store, TARGET_EXPORT) >= 2],
    [0, { ok: true, warnings: [], cancelled: true }, { ok: true, warnings: [], cancelled: true }, true, true]);
  // Een ander bestand mag, en krijgt alleen planning: nooit de pset.
  const other = fakeHandle('ander.ifc', new Uint8Array());
  pick = other;
  const exported = await S().exportAs('ifc');
  await S().saveFileAs();
  S().addTask({ name: 'Nog meer werk' });
  await S().saveFile();
  pick = null;
  eq('backup: een ander bestand mag (export, Opslaan als, Ctrl+S), zonder de pset',
    [exported.ok && !('cancelled' in exported && exported.cancelled), other.writes.length,
      other.writes.some(w => w.includes(PSET_NAME)), S().fileHandle === other.handle, S().isDirty], [true, 3, false, true, false]);
  eq('backup: het kenmerk blijft na Opslaan als in een ander bestand', S().foreignSourceMark?.sha256, sha(externBytes));
  // Een gewone opslag van de bron zelf (met een kenmerk) schrijft de pset ook niet.
  const plainSave = writeIFC(buildWriteIFCInput(ctxA.store.getState(), 'merge'));
  ok('backup: buildWriteIFCInput schrijft de pset nooit', !plainSave.includes(PSET_NAME));
}
// 7c. Tauri-pad, flag uit: het doel uit de pset (`SourcePath`); de bron mag intussen veranderd zijn.
{
  const dir = mkdtempSync(join(tmpdir(), 'ops-804-backup-'));
  const externPath = join(dir, 'extern.ifc');
  writeFileSync(externPath, externBytes);
  const backupPath = join(dir, 'backup.ifc');
  const otherPath = join(dir, 'ander.ifc');
  const savedWindow = (globalThis as { window?: unknown }).window;
  const ipc = installNodeFileIpc();
  const tauriWin = (globalThis as unknown as { window: Record<string, unknown> }).window;
  tauriWin.parent = tauriWin;
  let dialogAnswer: string | null = null;
  let dialogs = 0;
  const internals = tauriWin.__TAURI_INTERNALS__ as { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> };
  const innerInvoke = internals.invoke;
  internals.invoke = async (command, args, options) => {
    if (command === 'plugin:dialog|save') { dialogs++; return dialogAnswer; }
    return innerInvoke(command, args, options);
  };
  try {
    const ctxA = createAppStoreContext();
    await open('extern.ifc', externBytes, { kind: 'path', path: externPath }, ctxA.store);
    const backup = await backupOf(ctxA);
    writeFileSync(backupPath, backup);
    const store = await open('backup.ifc', enc.encode(backup), { kind: 'path', path: backupPath }, undefined, false);
    const S = () => store.getState();
    eq('Tauri, backup geopend: het kenmerk met het pad van de bron; geen opslagdoel',
      [S().foreignSourceMark?.filePath, S().filePath], [externPath, null]);
    // Een ander programma wijzigt de bron: de inhoud klopt niet meer, het pad wel.
    writeFileSync(externPath, `${dec(externBytes)}/* gewijzigd */\n`);
    const changed = sha(readFileSync(externPath));
    S().addTask({ name: 'Werk in de backup' });
    dialogAnswer = externPath;
    await S().saveFile();
    await S().saveFileAs();
    const ifcExport = await S().exportAs('ifc');
    eq('Tauri, backup: Ctrl+S opent de dialoog; Opslaan als en export naar de bron geweigerd',
      [dialogs, sha(readFileSync(externPath)), ifcExport, S().filePath, readFileSync(backupPath, 'utf8') === backup],
      [3, changed, { ok: true, warnings: [], cancelled: true }, null, true]);
    dialogAnswer = otherPath;
    await S().saveFileAs();
    const otherText = existsSync(otherPath) ? readFileSync(otherPath, 'utf8') : '';
    eq('Tauri, backup: een ander bestand mag, zonder de pset',
      [S().filePath, otherText.includes('Werk in de backup'), otherText.includes(PSET_NAME)], [otherPath, true, false]);
  } finally {
    ipc.dispose();
    (globalThis as { window?: unknown }).window = savedWindow;
    rmSync(dir, { recursive: true, force: true });
  }
}

// 7d. #804 fase 1c: echte MCP-backup met gebouwmodel, openen zonder bronbytes.
// Dezelfde open- en opslagacties voor handles en paden; flag uit en gewone backups blijven schrijfbaar.
const { createFileAutoSaveController: backupAutoSave } = await import('@/services/actualAutosave/fileAutoSave');
const { createCloseDocumentDialogActions: backupCloseActions } = await import('@/components/layout/DocumentChrome/closeDocumentActions');
const { createMcpContext } = await import('@/services/mcp/context');
const { createMcpTransactions } = await import('@/state/runtime/createMcpTransactions');
const { fileTools, fileToolDeps } = await import('@/services/mcp/tools/fileTools');
const { setSiteSaveAsker, resetSiteAskers } = await import('@/services/fileAccess/siteDialogs');
for (const route of ['handle', 'pad'] as const) for (const foreign of [true, false]) for (const flag of [true, false]) {
  const label = `backup 9d, ${route}, ${foreign ? 'gebouwmodel' : 'gewone planning'}, flag ${flag ? 'aan' : 'uit'}`;
  const bytes = foreign ? eigenPlus : showcase;
  const dir = mkdtempSync(join(tmpdir(), 'ops-backup-9d-'));
  const sourcePath = join(dir, 'bron.ifc'), backupPath = join(dir, 'backup.ifc'), otherPath = join(dir, 'ander.ifc');
  const orig = fakeHandle('bron.ifc', bytes), backupFile = fakeHandle('backup.ifc', new Uint8Array());
  const other = fakeHandle('ander.ifc', new Uint8Array());
  writeFileSync(sourcePath, bytes);
  const ipc = route === 'pad' ? installNodeFileIpc() : null;
  const activeWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
  activeWindow.parent = activeWindow;
  let dialogAnswer = otherPath, dialogs = 0;
  if (ipc) {
    const internals = activeWindow.__TAURI_INTERNALS__ as { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> };
    const invoke = internals.invoke;
    internals.invoke = async (command, args, options) => {
      if (command === 'plugin:dialog|save') { dialogs++; return dialogAnswer; }
      return invoke(command, args, options);
    };
  }
  try {
    const ctxA = createAppStoreContext();
    await open('bron.ifc', bytes, route === 'pad' ? { kind: 'path', path: sourcePath }
      : { kind: 'handle', handle: orig.handle }, ctxA.store, foreign || flag);
    eq(`${label}: de echte bron geopend`, ctxA.store.getState().ifcSource?.foreign === true, foreign);
    const backup = await backupOf(ctxA);
    writeFileSync(backupPath, backup);
    backupFile.replace(enc.encode(backup));
    eq(`${label}: backup bevat planning en alleen bij vreemd deel het kenmerk`,
      [readIFC(backup).tasks.length > 0, backup.includes(PSET_NAME), backup.includes('IFCWALL(')], [true, foreign, false]);
    const ctxB = createAppStoreContext();
    const store = await open('backup.ifc', enc.encode(backup), route === 'pad' ? { kind: 'path', path: backupPath }
      : { kind: 'handle', handle: backupFile.handle }, ctxB.store, flag);
    const S = () => store.getState();
    const blocked = foreign && flag;
    eq(`${label}: ontbrekende bron alleen met flag aan en bronkenmerk`, S().foreignSourceMark?.sourceMissing === true, blocked);
    eq(`${label}: gewoon openen meldt niets`, noticeKeys(store), []);
    S().addTask({ name: 'Werk uit de backup 9d' });
    pick = other;
    const pickerBefore = pickerCalls;
    const writesBefore = ipc?.calls.length ?? 0;
    if (blocked) {
      await S().saveFile();
      await S().saveFileAs();
      const exported = await S().exportAs('ifc');
      eq(`${label}: IFC-export geweigerd`, exported, { ok: true, warnings: [], cancelled: true });
      // Een bestaand schrijfrecht/doel mag de bestands-AutoSave evenmin vrijgeven.
      store.setState(s => {
        s.filePath = route === 'pad' ? otherPath : 'ander.ifc';
        s.fileHandle = route === 'handle' ? other.handle : null;
      });
      S().setAutoSaveToFile(true);
      const autosave = backupAutoSave({ getState: S, enabled: () => true });
      await autosave.flush();
      await autosave.flush();
      let closed = false;
      await backupCloseActions({
        pendingId: S().activeDocumentId, getActiveDocumentId: () => S().activeDocumentId,
        switchDocument: S().switchDocument, closeDocument: () => { closed = true; },
        saveFile: () => S().saveFileForDocument(S().activeDocumentId),
        clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
      }).save();
      eq(`${label}: sluitvraag laat gewijzigd document open`, [closed, S().isDirty], [false, true]);
      if (route === 'handle') {
        let siteWrites = 0;
        activeWindow.openaecHost = { storage: {
          list: async () => [], versions: async () => [],
          open: async () => ({ file: { id: 'backup-site', name: 'backup.ifc', version: 'v1' }, data: enc.encode(backup) }),
          save: async (request: { name: string }) => { siteWrites++; return { id: 'backup-site', name: request.name, version: 'v2' }; },
        } };
        setSiteSaveAsker(async () => ({ kind: 'site', name: 'nieuwe-backup.ifc' }));
        try {
          store.setState(s => { s.siteFileId = 'backup-site'; s.siteFileVersion = 'v1'; s.fileHandle = null; });
          await S().saveFile();
          await S().saveFileAs();
          eq(`${label}: site schrijft niets`, siteWrites, 0);
        } finally { delete activeWindow.openaecHost; resetSiteAskers(); }
        // Ook zonder FSA-kiezer mag geen Blob voor download ontstaan.
        const createUrl = URL.createObjectURL;
        const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
        Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ click() {} }) } });
        let downloads = 0;
        URL.createObjectURL = () => { downloads++; return 'blob:backup-9d'; };
        delete win.showSaveFilePicker;
        delete win.showOpenFilePicker;
        try {
          await S().saveFileAs();
          await S().exportAs('ifc');
          eq(`${label}: download schrijft niets`, downloads, 0);
        } finally {
          URL.createObjectURL = createUrl;
          if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument);
          else Reflect.deleteProperty(globalThis, 'document');
          win.showOpenFilePicker = () => { throw new Error('niet in deze test'); };
          win.showSaveFilePicker = async () => { pickerCalls++; return other.handle; };
        }
      }
      const oldFs = fileToolDeps.getFs;
      let mcpWrites = 0;
      fileToolDeps.getFs = async () => ({
        homeDir: async () => '/home/proef', exists: async () => false,
        stat: async () => { throw new Error('bestaat niet'); },
        scanTarget: async () => null,
        writeTextFile: async () => { mcpWrites++; },
        readTextFile: async () => '', readFile: async () => new Uint8Array(),
      });
      try {
        const result = await fileTools.find(t => t.name === 'planner_export_ifc')!.handler({ path: '/home/proef/nieuw.ifc' },
          createMcpContext(ctxB, createMcpTransactions(ctxB), { ensureBackup: async () => null, markDuplicateBorn: () => {} }));
        eq(`${label}: MCP-export weigert vóór schrijven`, [result.ok, !result.ok && result.code, mcpWrites], [false, 'VALIDATION', 0]);
      } finally { fileToolDeps.getFs = oldFs; }
      eq(`${label}: nergens een schrijfpoging of dialoog`,
        [orig.writables(), backupFile.writables(), other.writables(), existsSync(otherPath), pickerCalls - pickerBefore, dialogs,
          ipc?.calls.slice(writesBefore).some(c => c.options?.write || ['plugin:fs|write', 'plugin:fs|write_text_file', 'plugin:fs|write_file'].includes(c.command)) ?? false],
        [0, 0, 0, false, 0, 0, false]);
      eq(`${label}: één rode melding voor alle opslagweigeringen`, noticeKeys(store), [[SOURCE_MISSING, 'error', true]]);
      ok(`${label}: herhalingen tellen op in diezelfde melding`, noticeCount(store, SOURCE_MISSING) >= 4);
      // Een niet-IFC-export blijft mogelijk; hij krijgt een ander doel.
      store.setState(s => { s.filePath = null; s.fileHandle = null; s.siteFileId = null; s.siteFileVersion = null; });
      dialogAnswer = join(dir, 'planning.csv');
      const csv = await S().exportAs('csv');
      const csvText = route === 'pad' ? readFileSync(dialogAnswer, 'utf8') : other.text();
      eq(`${label}: CSV schrijft de bewerkte planning`, [csv.ok, csvText.includes('Werk uit de backup 9d')], [true, true]);
    } else {
      await S().saveFileAs();
      await S().exportAs('ifc');
      S().addTask({ name: 'Meer werk uit de backup 9d' });
      await S().saveFile();
      const output = route === 'pad' ? readFileSync(otherPath, 'utf8') : other.text();
      eq(`${label}: Opslaan als, export en Ctrl+S blijven werken`,
        [S().isDirty, output.includes('Meer werk uit de backup 9d'), output.includes(PSET_NAME), noticeKeys(store)], [false, true, false, []]);
    }
    eq(`${label}: bron en backup blijven sha256-gelijk`,
      [sha(readFileSync(sourcePath)), sha(orig.text()), sha(readFileSync(backupPath)), sha(backupFile.text())],
      [sha(bytes), sha(bytes), sha(backup), sha(backup)]);
  } finally {
    ipc?.dispose();
    pick = null;
    win.showSaveFilePicker = async () => {
      pickerCalls++;
      if (!pick) throw new DOMException('geannuleerd', 'AbortError');
      return pick.handle;
    };
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── 7e. Opslaan als zonder gevonden gebouwmodel, na herstel en bij een MCP-backup. ──────────────────────────────
for (const entry of ['herstel', 'backup'] as const) for (const route of ['handle', 'pad'] as const) {
  const label = `9e ${entry}, ${route}`;
  const dir = mkdtempSync(join(tmpdir(), 'ops-9e-'));
  const sourcePath = join(dir, 'oorspronkelijk.ifc'), newPath = join(dir, 'alleen-planning.ifc');
  const orig = fakeHandle('oorspronkelijk.ifc', eigenPlus), fresh = fakeHandle('alleen-planning.ifc', new Uint8Array());
  writeFileSync(sourcePath, eigenPlus);
  const ipc = route === 'pad' ? installNodeFileIpc() : null;
  const activeWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
  activeWindow.parent = activeWindow;
  let target: string | null = newPath;
  let dialogs = 0, questions = 0, answer = false;
  if (ipc) {
    const internals = activeWindow.__TAURI_INTERNALS__ as { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> };
    const invoke = internals.invoke;
    internals.invoke = async (c, a, o) => {
      if (c === 'plugin:dialog|save') { dialogs++; return target; }
      return invoke(c, a, o);
    };
  }
  const tick = async (store: Store) => {
    const docs = store.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true));
    const internals = activeWindow.__TAURI_INTERNALS__;
    delete activeWindow.__TAURI_INTERNALS__;
    try { await runRecoveryTick(new RecoveryDeltaTracker(), store.getState().activeDocumentId, docs); return await loadRecovery(); }
    finally { if (internals) activeWindow.__TAURI_INTERNALS__ = internals; }
  };
  const restore = async (loaded: Awaited<ReturnType<typeof loadRecovery>>): Promise<Store> => {
    const inputs = [];
    for (const d of loaded.docs) inputs.push(await readRecoveryDocument(d, loaded.archives, true));
    const restored = createAppStoreContext().store;
    restored.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    restored.getState().restoreDocuments(inputs, loaded.activeDocumentId);
    return restored;
  };
  try {
    const ctx = createAppStoreContext();
    await open('oorspronkelijk.ifc', eigenPlus, route === 'pad' ? { kind: 'path', path: sourcePath }
      : entry === 'herstel' ? null : { kind: 'handle', handle: orig.handle }, ctx.store);
    ctx.store.getState().addTask({ name: 'Werk vóór de crash of backup 9e' });
    let store: Store;
    if (entry === 'backup') store = await open('backup.ifc', enc.encode(await backupOf(ctx)), null);
    else {
      const loaded = await tick(ctx.store);
      const { SOURCE_COPY_DB } = await import('@/services/recovery/recoverySourceCopies');
      idb.store('sources', SOURCE_COPY_DB).clear(); // De bewaarde kopie is niet terug te vinden.
      if (ipc) ipc.faults.readError = new Error('geen toegang tot de bron');
      store = await restore(loaded);
      if (ipc) ipc.faults.readError = null;
    }
    let S = () => store.getState();
    eq(`${label}: de werkelijke ingang geeft bron ontbreekt`, S().foreignSourceMark?.sourceMissing, true);
    ok(`${label}: de eerdere bewerking is hersteld`, S().tasks.some(t => t.name === 'Werk vóór de crash of backup 9e'));
    const beforeMark = S().foreignSourceMark;
    setIfcMissingSourceAsker(async () => { questions++; return answer; });
    pick = fresh; pickerCalls = 0;
    await S().saveFileAs();
    eq(`${label}: annuleren stelt één vraag, geen kiezer of write`, [questions, pickerCalls, dialogs, fresh.writables(), existsSync(newPath)], [1, 0, 0, 0, false]);
    eq(`${label}: annuleren bewaart de toestand`, [S().foreignSourceMark === beforeMark, S().filePath], [true, null]);
    // Geen andere IFC-route stelt de vraag, ook niet met een bestaand doel of een site.
    const beforeQuestions = questions;
    await S().saveFile();
    await S().exportAs('ifc');
    store.setState(s => { s.filePath = route === 'pad' ? newPath : fresh.handle.name; s.fileHandle = route === 'handle' ? fresh.handle : null; });
    S().setAutoSaveToFile(true);
    await backupAutoSave({ getState: S, enabled: () => true }).flush();
    let closed = false;
    await backupCloseActions({ pendingId: S().activeDocumentId, getActiveDocumentId: () => S().activeDocumentId,
      switchDocument: S().switchDocument, closeDocument: () => { closed = true; }, saveFile: () => S().saveFileForDocument(S().activeDocumentId),
      clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {} }).save();
    let siteWrites = 0;
    activeWindow.openaecHost = { storage: {
      list: async () => [], versions: async () => [],
      open: async () => ({ file: { id: 'origineel', name: 'model.ifc', version: 'v1' }, data: eigenPlus }),
      save: async () => { siteWrites++; return { id: 'origineel', name: 'model.ifc', version: 'v2' }; },
    } };
    store.setState(s => { s.siteFileId = 'origineel'; s.siteFileVersion = 'v1'; });
    await S().saveFile();
    delete activeWindow.openaecHost;
    eq(`${label}: andere opslag weigert zonder vraag of bytes`, [questions, closed, siteWrites, fresh.writables(), existsSync(newPath)], [beforeQuestions, false, 0, 0, false]);
    const mcpContext = { ...createAppStoreContext(), store };
    const oldFs = fileToolDeps.getFs;
    let mcpWrites = 0;
    fileToolDeps.getFs = async () => ({ homeDir: async () => '/home/proef', exists: async () => false,
      stat: async () => { throw new Error('bestaat niet'); }, scanTarget: async () => null,
      writeTextFile: async () => { mcpWrites++; }, readTextFile: async () => '', readFile: async () => new Uint8Array() });
    try {
      const result = await fileTools.find(t => t.name === 'planner_export_ifc')!.handler({ path: '/home/proef/9e.ifc' },
        createMcpContext(mcpContext, createMcpTransactions(mcpContext), { ensureBackup: async () => null, markDuplicateBorn: () => {} }));
      eq(`${label}: MCP-export weigert zonder vraag`, [result.ok, mcpWrites, questions], [false, 0, beforeQuestions]);
    } finally { fileToolDeps.getFs = oldFs; }
    if (route === 'handle') {
      const createUrl = URL.createObjectURL, picker = win.showSaveFilePicker, opener = win.showOpenFilePicker;
      let downloads = 0;
      URL.createObjectURL = () => { downloads++; return 'blob:9e'; };
      delete win.showSaveFilePicker; delete win.showOpenFilePicker;
      try {
        await S().saveFile(); await S().exportAs('ifc');
        eq(`${label}: de downloadroute weigert zonder vraag`, [downloads, questions], [0, beforeQuestions]);
      } finally { URL.createObjectURL = createUrl; win.showSaveFilePicker = picker; win.showOpenFilePicker = opener; }
    }
    store.setState(s => { s.filePath = null; s.fileHandle = null; s.siteFileId = null; s.siteFileVersion = null; });
    store = await restore(await tick(store)); S = () => store.getState();
    eq(`${label}: tweede crash houdt bron ontbreekt`, S().foreignSourceMark?.sourceMissing, true);
    answer = true;
    pick = null; target = null;
    await S().saveFileAs();
    eq(`${label}: kiezer annuleren houdt de toestand en schrijft niets`, [S().foreignSourceMark?.sourceMissing, fresh.writables(), existsSync(newPath)], [true, 0, false]);
    pick = orig; target = sourcePath;
    await S().saveFileAs();
    eq(`${label}: oorspronkelijk doel geweigerd na bevestigen`, [orig.writables(), sha(readFileSync(sourcePath)), S().foreignSourceMark?.sourceMissing], [0, sha(eigenPlus), true]);
    pick = fresh; target = newPath;
    await S().saveFileAs();
    const written = route === 'pad' && existsSync(newPath) ? readFileSync(newPath, 'utf8') : fresh.text();
    ok(`${label}: nieuwe planning geschreven`, !!written && readIFC(written).tasks.some(t => t.name === 'Werk vóór de crash of backup 9e'));
    ok(`${label}: geen gebouwmodel of herstelkenmerk in uitvoer`, !!written && !written.includes('IFCWALL(') && !written.includes('OPS_RecoveryForeignSource'));
    const reopened = written ? await open('alleen-planning.ifc', enc.encode(written), null) : null;
    ok(`${label}: echte heropening houdt de bewerking zonder vreemd deel`, !!reopened && !reopened.getState().ifcSource?.foreign
      && reopened.getState().tasks.some(t => t.name === 'Werk vóór de crash of backup 9e'));
    eq(`${label}: gewoon document met bescherming van het oorspronkelijke doel`, [S().foreignSourceMark?.sourceMissing, S().ifcSource?.foreign === true, S().isDirty], [false, false, false]);
    const ordinaryContext = { ...createAppStoreContext(), store };
    ok(`${label}: een nieuwe MCP-backup is alleen gewone planning`, !(await backupOf(ordinaryContext)).includes(PSET_NAME));
    S().addTask({ name: 'Ctrl+S na gewone opslag 9e' });
    await S().saveFile();
    const latest = route === 'pad' && existsSync(newPath) ? readFileSync(newPath, 'utf8') : fresh.text();
    ok(`${label}: Ctrl+S schrijft het nieuwe doel`, latest.includes('Ctrl+S na gewone opslag 9e'));
    S().setAutoSaveToFile(true); S().addTask({ name: 'AutoSave na gewone opslag 9e' });
    await backupAutoSave({ getState: S, enabled: () => true }).flush();
    const autoText = route === 'pad' && existsSync(newPath) ? readFileSync(newPath, 'utf8') : fresh.text();
    ok(`${label}: AutoSave schrijft het nieuwe doel`, autoText.includes('AutoSave na gewone opslag 9e'));
    S().addTask({ name: 'Sluitvraag na gewone opslag 9e' });
    closed = false;
    await backupCloseActions({ pendingId: S().activeDocumentId, getActiveDocumentId: () => S().activeDocumentId,
      switchDocument: S().switchDocument, closeDocument: () => { closed = true; }, saveFile: () => S().saveFileForDocument(S().activeDocumentId),
      clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {} }).save();
    eq(`${label}: de sluitvraag kan het gewone document opslaan en sluiten`, [closed, S().isDirty], [true, false]);
    pick = orig; target = sourcePath;
    await S().saveFileAs();
    eq(`${label}: latere Opslaan als beschermt het oorspronkelijke doel`, [orig.writables(), sha(readFileSync(sourcePath))], [0, sha(eigenPlus)]);
    store = await restore(await tick(store)); S = () => store.getState();
    eq(`${label}: crash erna is een gewoon document`, S().foreignSourceMark?.sourceMissing, false);
    await S().saveFileAs();
    eq(`${label}: ook na crash blijft het oorspronkelijke doel beschermd`, [orig.writables(), sha(readFileSync(sourcePath))], [0, sha(eigenPlus)]);
  } finally {
    resetIfcMissingSourceAsker(); ipc?.dispose();
    (globalThis as { window?: unknown }).window = win;
    delete win.openaecHost; pick = null; rmSync(dir, { recursive: true, force: true });
  }
}

// ── 7f. 9e op de site: het oorspronkelijke sitebestand blijft beschermd, Opslaan als maakt een nieuw sitebestand ──
// Herstel van een document dat van de site kwam; de bewaarde kopie is weg, dus het gebouwmodel ontbreekt.
{
  const label = '9e site';
  const siteData: Record<string, Uint8Array> = { origineel: eigenPlus };
  const saves: (string | null)[] = [];
  win.openaecHost = { storage: {
    list: async () => [],
    versions: async () => [{ version: 'v1' }],
    open: async (id: string) => {
      if (!(id in siteData)) throw new Error('niet gevonden');
      return { file: { id, name: 'model.ifc', version: 'v1' }, data: siteData[id] };
    },
    save: async (request: { id?: string; name: string; data: Blob }) => {
      const id = request.id ?? `nieuw${saves.length + 1}`;
      saves.push(request.id ?? null);
      siteData[id] = new Uint8Array(await request.data.arrayBuffer());
      return { id, name: request.name, version: `v${saves.length + 1}` };
    },
  } };
  const tick = async (store: Store) => {
    const docs = store.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true));
    await runRecoveryTick(new RecoveryDeltaTracker(), store.getState().activeDocumentId, docs);
    return loadRecovery();
  };
  const restore = async (loaded: Awaited<ReturnType<typeof loadRecovery>>): Promise<Store> => {
    const inputs = [];
    for (const d of loaded.docs) inputs.push(await readRecoveryDocument(d, loaded.archives, true));
    const restored = createAppStoreContext().store;
    restored.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    restored.getState().restoreDocuments(inputs, loaded.activeDocumentId);
    return restored;
  };
  let questions = 0;
  try {
    const ctx = createAppStoreContext();
    await open('model.ifc', eigenPlus, { kind: 'site', id: 'origineel' }, ctx.store);
    eq(`${label}: het kenmerk kent het oorspronkelijke sitebestand`, ctx.store.getState().foreignSourceMark?.siteFileId, 'origineel');
    ctx.store.getState().addTask({ name: 'Werk vóór de crash 9e site' });
    const loaded = await tick(ctx.store);
    const { SOURCE_COPY_DB } = await import('@/services/recovery/recoverySourceCopies');
    idb.store('sources', SOURCE_COPY_DB).clear();
    let store = await restore(loaded);
    let S = () => store.getState();
    eq(`${label}: herstel geeft bron ontbreekt zonder sitedoel`, [S().foreignSourceMark?.sourceMissing, S().siteFileId], [true, null]);
    setIfcMissingSourceAsker(async () => { questions++; return true; });
    // Dezelfde naam als het oorspronkelijke sitebestand: Opslaan op de site maakt toch een nieuw bestand.
    setSiteSaveAsker(async () => ({ kind: 'site', name: 'model.ifc' }));
    await S().saveFileAs();
    eq(`${label}: na bevestigen één nieuw sitebestand, het oorspronkelijke ongewijzigd`,
      [questions, saves, sha(siteData.origineel), S().siteFileId], [1, [null], sha(eigenPlus), 'nieuw1']);
    const written = dec(siteData.nieuw1 ?? new Uint8Array());
    ok(`${label}: het nieuwe sitebestand heeft de planning zonder gebouwmodel`,
      readIFC(written).tasks.some(t => t.name === 'Werk vóór de crash 9e site') && !written.includes('IFCWALL(')
      && !written.includes(PSET_NAME));
    eq(`${label}: gewoon document dat het oorspronkelijke sitebestand blijft kennen`,
      [S().foreignSourceMark?.sourceMissing, S().foreignSourceMark?.siteFileId], [false, 'origineel']);
    S().addTask({ name: 'Ctrl+S op de site 9e' });
    await S().saveFile();
    eq(`${label}: Ctrl+S schrijft een nieuwe versie van het nieuwe sitebestand`, saves, [null, 'nieuw1']);
    ok(`${label}: met de nieuwe taak`, dec(siteData.nieuw1).includes('Ctrl+S op de site 9e'));
    // Het oorspronkelijke sitebestand als doel: weigert op de inhoud (flag aan) én op het kenmerk (flag uit).
    for (const flag of [true, false]) {
      store.setState(s => { s.ui.featureFlags = { ifcForeignContent: flag }; s.siteFileId = 'origineel'; s.siteFileVersion = 'v1'; });
      S().addTask({ name: `Naar het oorspronkelijke sitebestand 9e ${flag}` });
      const notices = noticeCount(store, TARGET_SAVE);
      await S().saveFile();
      eq(`${label}: oorspronkelijk sitebestand als doel geweigerd (flag ${flag ? 'aan' : 'uit'})`,
        [saves, sha(siteData.origineel), noticeCount(store, TARGET_SAVE) > notices], [[null, 'nieuw1'], sha(eigenPlus), true]);
    }
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; s.siteFileId = 'nieuw1'; s.siteFileVersion = 'v3'; });
    store = await restore(await tick(store)); S = () => store.getState();
    eq(`${label}: crash erna houdt het nieuwe sitedoel en de bescherming`,
      [S().foreignSourceMark?.sourceMissing, S().foreignSourceMark?.siteFileId, S().siteFileId], [false, 'origineel', 'nieuw1']);
    eq(`${label}: geen vraag meer voor het gewone document`, questions, 1);
  } finally {
    resetIfcMissingSourceAsker(); resetSiteAskers(); delete win.openaecHost;
  }
}

// ── 8. Fixronde 3 (Sol, VERVOLG): hoogstens één vingerafdruk van het doel per controle ─────────────────────────────
{
  let getFiles = 0;
  let buffers = 0;
  const bytes = bonsai;
  const handle = {
    kind: 'file' as const, name: 'doel.ifc',
    isSameEntry: async () => false,
    getFile: async () => {
      getFiles++;
      const file = new File([bytes as BlobPart], 'doel.ifc');
      const read = file.arrayBuffer.bind(file);
      Object.defineProperty(file, 'arrayBuffer', { value: () => { buffers++; return read(); } });
      return file;
    },
  } as unknown as FileSystemFileHandle;
  const markOf = (sha256: string, byteLength: number): ForeignSourceMark =>
    ({ sha256, byteLength, filePath: null, siteFileId: null, handle: null });
  const other = sha('een andere bron');
  const marks = [markOf(other, bytes.length + 1), markOf(other, bytes.length), markOf(sha(bytes.slice(1)), bytes.length), markOf(sha(bytes), bytes.length)];
  const found = await isForeignSourceTarget({ kind: 'handle', handle }, marks);
  eq('vier kenmerken, drie met dezelfde lengte: één getFile, één SHA-256, en de bron gevonden', [found, getFiles, buffers], [true, 1, 1]);
  getFiles = 0;
  buffers = 0;
  const none = await isForeignSourceTarget({ kind: 'handle', handle }, [markOf(other, 1), markOf(other, 2)]);
  eq('geen kenmerk met dezelfde lengte: één getFile, geen SHA-256', [none, getFiles, buffers], [false, 1, 0]);
}

// ── 9. Fixronde 4: de doelcontrole volgt de route van `readIFC` (Terra en Sol), via de echte opslagroutes ─────────────
// Terra: kapotte kop, alle entiteiten op één regel. Sol: kapotte kop, `#30=\nIFCWALL(` (en dezelfde vorm op elke
// entiteit: zo gaf de scanner van 343b74300 "no-model", zoals Sol meldde). Allemaal weigert `readIFC` als model,
// dus geen write. Het commentaar met `#900000=IFCWALL(` en de meerregelige string met `#9=IFCWALL(` zijn eigen bestanden
// zonder model: die mogen. "Groot" is Terra met 2 MiB commentaar in de kop. Ronde 6: een kapotte kop weigert als niet
// leesbaar (`refuse: 'unreadable'`), zonder terugspoelen; ook een eigen planning met een kapotte naam.
{
  const modelText = dec(modelIfc4);
  const ownText = dec(showcase);
  type Refuse = 'model' | 'foreign' | 'unreadable' | null;
  const targets: Array<{ name: string; bytes: Uint8Array; refuse: Refuse; openRefusal?: true }> = [
    { name: 'externe-pset-zonder-model', bytes: externalPset, refuse: 'foreign' },
    { name: 'terra', bytes: enc.encode(terraFile(modelText)), refuse: 'unreadable' },
    { name: 'sol', bytes: enc.encode(solFile(modelText)), refuse: 'unreadable' },
    { name: 'sol-alles', bytes: enc.encode(solFileAllSplit(modelText)), refuse: 'unreadable' },
    { name: 'terra-groot', bytes: enc.encode(terraFile(modelText).replace('HEADER;', `HEADER;${longComment}`)), refuse: 'unreadable' },
    // Ronde 6 (besluit Trias): een STEP-bestand waarin de app geen DATA-sectie vindt, weigert als doel.
    { name: 'zonder-data', bytes: enc.encode(`${ownText.slice(0, ownText.indexOf('\nDATA;') + 1)}END-ISO-10303-21;\n`), refuse: 'unreadable' },
    { name: 'commentaar', bytes: enc.encode(commentFile(ownText)), refuse: null },
    { name: 'string', bytes: enc.encode(stringFile(ownText)), refuse: 'foreign' },
    // Meer DATA-secties: de wand #99999 staat in de tweede sectie. Vóór de fix las de doelcontrole (zoals `readIFC`) maar
    // tot de eerste `ENDSEC;` en gaf hij "no-model": Opslaan als schreef de planning over het model heen.
    { name: 'twee-data', bytes: new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/council/fix3-twee-data.ifc'))), refuse: 'model' as const },
    // Sol en Terra (review van #870): dezelfde, met parameters bij beide sectiekoppen. Vóór de fix: één write, wand weg.
    { name: 'twee-data-param', bytes: enc.encode(paramDataFile(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/council/fix3-twee-data.ifc'), 'utf8'))), refuse: 'model' as const },
    // Ronde 2 (Sol): witruimte, commentaar of een regeleinde vóór de `(`, en gemengd. Vóór de fix: Opslaan als, CSV en
    // AutoSave schreven over de wand heen.
    // De tabel van de kopvormen uit ISO 10303-21 (`DATA_KOP_VORMEN`, eis van Trias): elke vorm op fix3 (ook gemengd), op
    // een model in de enige sectie, en op de eigen planning (die blijft een doel).
    ...dataKopBestanden(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/council/fix3-twee-data.ifc'), 'utf8'))
      .map(([name, text]) => ({ name: `twee-data-${name}`, bytes: enc.encode(text), refuse: 'model' as const })),
    ...dataKopBestanden(modelText).map(([name, text]) => ({ name: `model-${name}`, bytes: enc.encode(text), refuse: 'model' as const })),
    // PR 4: de hele C/A/V-indeling moet slagen. De 26 ondersteunde eigen kopvormen blijven schrijfbaar;
    // de 16 al als scannerWeigert benoemde vormen krijgen 'unreadable' (96 routeasserties, knownbug 1134).
    // Dit zijn gemaakte vormen: kleine letters buiten de norm, of de bestaande scannergrens bij afdruk-/stuurtekens
    // en ANCHOR. De gewone lezer en de route met de flag uit veranderen niet.
    ...dataKopBestanden(ownText, 'scanner').map(([name, text]) => ({ name: `eigen-${name}`, bytes: enc.encode(text), refuse: null })),
    ...dataKopBestanden(ownText, 'scannerWeigert').map(([name, text]) => ({ name: `eigen-${name}`, bytes: enc.encode(text), refuse: 'unreadable' as const })),
    // #916: alle 13 kapotte naamvormen onder de huidige IFC4X3_ADD2-kop vallen buiten het exact gemeten oude
    // LF/IFC4X3-sjabloon. De 12 eerder toegestane vormen worden unreadable; het regeleinde bleef al geweigerd.
    // De echte oude fixtures en de geldige DATA-kopvormen hierboven blijven doelen.
    ...brokenNameFiles(modelText).map(([name, text]) => ({ name: `model-${name}`, bytes: enc.encode(text), refuse: 'unreadable' as const })),
    ...brokenNameFiles(ownText).map(([name, text]) => ({ name: `eigen-${name}`, bytes: enc.encode(text),
      refuse: 'unreadable' as const, openRefusal: true as const })),
    // #916 fixronde 1: alle kapotte naamvarianten van de huidige IFC4X3_ADD2-kop vallen buiten het gemeten oude
    // LF/IFC4X3-sjabloon, dus van toegestaan (behalve regeleinde) naar unreadable. De echte oude fixtures blijven doelen.
    // Ronde 8 (Trias): echte bestanden van de writer van v2026.7.12 (`scripts/proef/maak-oude-uitvoer.mjs`), met de
    // projectnaam `O'Hara Tower` (kapotte kop) en `Fase DATA; Noord`. Ze blijven een doel.
    // Ronde 8 (Sol, BLOKKEERT): een wand in een binaire waarde, een URI-parameter of een REFERENCE-sectie na DATA, in een
    // bestand van een ander programma. Op a026bed zei de grammatica 'valid' en schreven alle routes over het model heen.
    ...verstopteWandBestanden(ownText).map(([name, text]) => ({ name: `vreemd-${name}`, bytes: enc.encode(text), refuse: 'unreadable' as const })),
    ...['ohara', 'data'].map(naam => ({ name: `eigen-naam-v2026.7.12-${naam}`, refuse: null,
      bytes: new Uint8Array(readFileSync(join(ROOT, `tests/planning/fixtures/oude-tags/v2026.7.12-${naam}-showcase-verbouwing-eengezinswoning.ifc`))) })),
  ];
  const cancelled = { ok: true, warnings: [], cancelled: true };
  // 9a. Handle-route (browser): Opslaan als, CSV-export en AutoSave, de doelen als stroom in stukken van 64 KiB.
  const { createFileAutoSaveController } = await import('@/services/actualAutosave/fileAutoSave');
  for (const t of targets) {
    // E6: de 13 gemaakte namen onder een huidige kop weigeren bij openen; ze vallen buiten #916.
    // De twee echte oude releasebestanden blijven openen en naar zichzelf opslaan zoals main.
    if (t.name.startsWith('eigen-naam')) {
      if (t.openRefusal) {
        const error: unknown = await readIfcBytesDetailed(t.bytes).catch((e: unknown) => e);
        ok(`E6 ${t.name}: getypeerd geweigerd met vaste scannerreden`, error instanceof IfcForeignOpenError
          && error.code === 'IFC_FOREIGN_OPEN_REFUSED' && error.fallback.kind === 'scanner'
          && error.fallback.reason === 'tekst-zonder-einde');
        const self = fakeHandle(`${t.name}-zelf.ifc`, t.bytes);
        const refused = await open(`${t.name}-zelf.ifc`, t.bytes, { kind: 'handle', handle: self.handle });
        const state = refused.getState();
        eq(`E6 ${t.name}: geen document, nul writes en bron intact`,
          [state.tasks.length, state.filePath, state.fileHandle, self.writables(), sha(self.text())],
          [0, null, null, 0, sha(t.bytes)]);
        eq(`E6 ${t.name}: scannerweigering via het meldingenkanaal`,
          state.ui.notifications.map(n => [n.messageKey, n.severity, n.detail]),
          [['notifications.ifcForeignOpenUnsafe', 'error', 'IFC open refused: unsafe scanner fallback']]);
        // Flag uit houdt de gewone route: twintig taken en één gewone opslag, zoals vóór E6.
        const offSource = fakeHandle(`${t.name}-uit.ifc`, t.bytes);
        const off = createAppStoreContext().store;
        off.setState(s => { s.ui.featureFlags = {}; });
        await off.getState().openOpenedFile({ name: `${t.name}-uit.ifc`, content: dec(t.bytes),
          ref: { kind: 'handle', handle: offSource.handle } });
        await off.getState().saveFile();
        eq(`E6 ${t.name}: flag uit opent en slaat op zoals main`,
          [off.getState().tasks.length, offSource.writes.length, noticeCount(off, 'notifications.ifcForeignOpenUnsafe')], [20, 1, 0]);
      } else {
        const opened = await open(`${t.name}.ifc`, t.bytes, null);
        eq(`fixronde 4, ${t.name}: opent zoals main, met 20 taken en zonder modelweigering`,
          [opened.getState().tasks.length, modelNotices(opened).length], [20, 0]);
        for (const route of ['Ctrl+S', 'AutoSave'] as const) {
          const self = fakeHandle(`${t.name}-zelf.ifc`, t.bytes);
          const selfStore = await open(`${t.name}-zelf.ifc`, t.bytes, { kind: 'handle', handle: self.handle });
          const D = () => selfStore.getState();
          D().addTask({ name: 'Nieuw werk' });
          if (route === 'Ctrl+S') await D().saveFile();
          else {
            D().setAutoSaveToFile(true);
            await createFileAutoSaveController({ getState: D, enabled: () => true }).flush();
          }
          eq(`ronde 8, ${t.name}: ${route} naar het eigen bestand schrijft`, [self.writes.length, D().isDirty], [1, false]);
        }
      }
      // En een IFC-export over dat bestand, vanuit een andere planning.
      const other = await open('ander.ifc', showcase, null);
      const exportTarget = fakeHandle(`${t.name}-export.ifc`, t.bytes, { streamChunk: 64 << 10 });
      pick = exportTarget;
      await other.getState().exportAs('ifc');
      pick = null;
      eq(`ronde 8, ${t.name}: IFC-export over het bestand ${t.refuse ? 'weigert' : 'schrijft'}`,
        exportTarget.writes.length, t.refuse ? 0 : 1);
    }
    const own = fakeHandle('eigen.ifc', showcase);
    const store = await open('eigen.ifc', showcase, { kind: 'handle', handle: own.handle });
    const S = () => store.getState();
    S().addTask({ name: 'Eigen werk' });
    const target = fakeHandle(`${t.name}.ifc`, t.bytes, { streamChunk: 64 << 10 });
    pick = target;
    await S().saveFileAs();
    const saveKey = t.refuse === 'unreadable' ? UNREADABLE_SAVE : TARGET_SAVE;
    const autoKey = t.refuse === 'unreadable' ? UNREADABLE_AUTOSAVE : TARGET_AUTOSAVE;
    const otherSave = t.refuse === 'unreadable' ? TARGET_SAVE : UNREADABLE_SAVE;
    if (t.refuse) {
      eq(`fixronde 4, handle, ${t.name}: Opslaan als schrijft niet, de bestaande tekst, A blijft gewijzigd, melding ${t.refuse}`,
        [target.writables(), target.text() === dec(t.bytes), S().fileHandle === own.handle, S().isDirty, noticeCount(store, saveKey) > 0,
          noticeCount(store, otherSave)],
        [0, true, true, true, true, 0]);
    } else {
      eq(`fixronde 4, handle, ${t.name}: Opslaan als schrijft`, [target.writes.length, S().fileHandle === target.handle], [1, true]);
    }
    const csvTarget = fakeHandle(`${t.name}.csv`, t.bytes, { streamChunk: 64 << 10 });
    pick = csvTarget;
    const csv = await S().exportAs('csv');
    eq(`fixronde 4, handle, ${t.name}: CSV-export ${t.refuse ? 'geweigerd, de bestaande tekst' : 'schrijft'}`,
      t.refuse ? [csv, csvTarget.writables(), csvTarget.text() === dec(t.bytes)] : [csvTarget.writes.length],
      t.refuse ? [cancelled, 0, true] : [1]);
    pick = null;
    // AutoSave: een ander programma zet het doel op de plek van het eigen bestand van A.
    const auto = fakeHandle('auto.ifc', showcase);
    const autoStore = await open('auto.ifc', showcase, { kind: 'handle', handle: auto.handle });
    const A = () => autoStore.getState();
    A().setAutoSaveToFile(true);
    auto.replace(t.bytes);
    A().addTask({ name: 'Werk voor AutoSave' });
    await createFileAutoSaveController({ getState: A, enabled: () => true }).flush();
    eq(`fixronde 4, handle, ${t.name}: AutoSave ${t.refuse ? 'schrijft niet, de bestaande tekst, A blijft gewijzigd, één melding' : 'schrijft'}`,
      t.refuse ? [auto.writes.length, auto.text() === dec(t.bytes), A().isDirty, noticeCount(autoStore, autoKey)]
        : [auto.writes.length, A().isDirty, noticeCount(autoStore, TARGET_AUTOSAVE) + noticeCount(autoStore, UNREADABLE_AUTOSAVE)],
      t.refuse ? [0, true, true, 1] : [1, false, 0]);
  }
  // 9b. Tauri-pad: dezelfde doelen via de echte plugin-JS (`open`, `read`, `seek`) met nep-IPC naar Node-fs.
  const dir = mkdtempSync(join(tmpdir(), 'ops-804-r4-'));
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
    for (const t of targets) {
      const ownPath = join(dir, `eigen-${t.name}.ifc`);
      writeFileSync(ownPath, showcase);
      const targetPath = join(dir, `${t.name}.ifc`);
      writeFileSync(targetPath, t.bytes);
      // De Tauri-route zet `.csv` achter een pad zonder die extensie (`ensureExtension`): het doel heet op `.csv`.
      const csvPath = join(dir, `${t.name}-doel.csv`);
      writeFileSync(csvPath, t.bytes);
      reseed(0x804);
      const store = createAppStoreContext().store;
      store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
      await store.getState().openOpenedFile({ name: 'eigen.ifc', content: ownText, ref: { kind: 'path', path: ownPath } });
      const S = () => store.getState();
      S().addTask({ name: 'Eigen werk' });
      const seeks = ipc.seeks();
      dialogAnswer = targetPath;
      await S().saveFileAs();
      const saveKey = t.refuse === 'unreadable' ? UNREADABLE_SAVE : TARGET_SAVE;
      const autoKey = t.refuse === 'unreadable' ? UNREADABLE_AUTOSAVE : TARGET_AUTOSAVE;
      if (t.refuse) {
        eq(`fixronde 4, Tauri, ${t.name}: Opslaan als schrijft niet, de bestaande tekst, A blijft gewijzigd, melding ${t.refuse}`,
          [sha(readFileSync(targetPath)), S().filePath, S().isDirty, noticeCount(store, saveKey) > 0],
          [sha(t.bytes), ownPath, true, true]);
      } else {
        eq(`fixronde 4, Tauri, ${t.name}: Opslaan als schrijft`,
          [S().filePath, readFileSync(targetPath, 'utf8').includes('Eigen werk')], [targetPath, true]);
      }
      if (t.name === 'terra-groot') {
        eq('fixronde 4, Tauri, terra-groot: de lezer beslist in de kop, zonder terugspoelen (plugin-fs seek)', ipc.seeks(), seeks);
      }
      dialogAnswer = csvPath;
      const csv = await S().exportAs('csv');
      eq(`fixronde 4, Tauri, ${t.name}: CSV-export ${t.refuse ? 'geweigerd, de bestaande tekst' : 'schrijft'}`,
        t.refuse ? [csv, sha(readFileSync(csvPath))] : [readFileSync(csvPath, 'utf8') !== dec(t.bytes)],
        t.refuse ? [cancelled, sha(t.bytes)] : [true]);
      // AutoSave: een ander programma zet het doel op de plek van het eigen bestand.
      const autoPath = join(dir, `auto-${t.name}.ifc`);
      writeFileSync(autoPath, showcase);
      reseed(0x804);
      const autoStore = createAppStoreContext().store;
      autoStore.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
      await autoStore.getState().openOpenedFile({ name: 'auto.ifc', content: ownText, ref: { kind: 'path', path: autoPath } });
      const A = () => autoStore.getState();
      A().setAutoSaveToFile(true);
      writeFileSync(autoPath, t.bytes);
      A().addTask({ name: 'Werk voor AutoSave' });
      await createFileAutoSaveController({ getState: A, enabled: () => true }).flush();
      eq(`fixronde 4, Tauri, ${t.name}: AutoSave ${t.refuse ? 'schrijft niet, de bestaande tekst, A blijft gewijzigd, één melding' : 'schrijft'}`,
        t.refuse ? [sha(readFileSync(autoPath)), A().isDirty, noticeCount(autoStore, autoKey)]
          : [readFileSync(autoPath, 'utf8').includes('Werk voor AutoSave'), A().isDirty, noticeCount(autoStore, TARGET_AUTOSAVE) + noticeCount(autoStore, UNREADABLE_AUTOSAVE)],
        t.refuse ? [sha(t.bytes), true, 1] : [true, false, 0]);
    }
    eq('fixronde 4, Tauri: de lezer sluit elk bestand', ipc.openHandles(), 0);
  } finally {
    ipc.dispose();
    (globalThis as { window?: unknown }).window = savedWindow;
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── 9. Fase 1c: gesloten vreemde doelen via elke overige schrijfroute, met echte tijdelijke bestanden ──
{
  const dir = mkdtempSync(join(tmpdir(), 'ops-804-1c-doelen-'));
  const savedWindow = (globalThis as { window?: unknown }).window;
  const ipc = installNodeFileIpc();
  const tauriWin = (globalThis as unknown as { window: Record<string, unknown> }).window;
  tauriWin.parent = tauriWin;
  let answers: string[] = [];
  const internals = tauriWin.__TAURI_INTERNALS__ as { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> };
  const invoke = internals.invoke;
  internals.invoke = async (command, args, options) => command === 'plugin:dialog|save'
    ? answers.shift() ?? null : invoke(command, args, options);
  try {
    const { saveFileDialog, fileIdentityFs, writeTargetReaders } = await import('@/services/fileAccess');
    const { writeUserTextFileTauri } = await import('@/services/fileAccess/atomicWrite');
    const { saveToPathWithIO } = await import('@/utils/devBridge');
    const { useAppStore } = await import('@/state/appStore');
    const { scanForeign } = await import('@/services/ifc/foreign/foreignScan');
    const { refusedWriteTarget } = await import('@/state/ifcForeignGuard');
    const scan = scanForeign(externalPset);
    ok('1c: de pset is volgens de open-scanner vreemd', scan.ok && scan.counts.V > 0);
    for (const [name, bytes] of [['pset', externalPset], ['model', modelIfc4]] as const) {
      const target = join(dir, `${name}.ifc`);
      const alias = join(dir, `${name}-link.ifc`);
      writeFileSync(target, bytes);
      symlinkSync(target, alias);
      const csvAlias = join(dir, `${name}-link.csv`);
      symlinkSync(target, csvAlias);
      for (const route of ['Opslaan als', 'IFC-export', 'CSV-export', 'pool-project', 'pool-bibliotheek', 'bibliotheek', 'dev-bridge'] as const) {
        const store = await open('eigen.ifc', showcase, null);
        const S = () => store.getState();
        S().addTask({ name: 'Wijziging voor export' });
        const companyId = S().seedDemoLibrary();
        S().setProject({ companyId, companyName: 'Proefbedrijf' });
        const projectPath = join(dir, `${name}-${route}-nieuw.ifc`);
        // De kiezer normaliseert de extensie; ook de CSV-route moet de bestaande IFC-bytes raken.
        const chosen = route === 'CSV-export' ? csvAlias : alias;
        answers = route === 'pool-bibliotheek' ? [projectPath, chosen] : [chosen];
        const before = ipc.calls.length;
        if (route === 'Opslaan als') await S().saveFileAs();
        else if (route === 'IFC-export') await S().exportAs('ifc');
        else if (route === 'CSV-export') await S().exportAs('csv');
        else if (route.startsWith('pool-')) await S().exportProjectWithPool();
        else if (route === 'bibliotheek') {
          const content = S().exportPoolIFC(companyId);
          ok(`1c ${name}: bibliotheek heeft echte IFC-uitvoer`, content !== null);
          await saveFileDialog('bibliotheek.ifc', content!, [{ name: 'IFC', extensions: ['ifc'] }],
            { refuseTarget: S().foreignTargetCheck('export') });
        } else {
          // De echte dev-functie is aan de singleton gebonden; alleen de invoer komt uit dezelfde open-route.
          await open('eigen.ifc', showcase, null, useAppStore);
          let refused = false;
          try { await saveToPathWithIO(alias, { writeTextFile: writeUserTextFileTauri }); } catch { refused = true; }
          ok(`1c ${name}: dev-bridge geeft een weigering`, refused);
        }
        eq(`1c ${name} ${route}: doel en link bytegelijk`, [sha(readFileSync(target)), sha(readFileSync(alias))], [sha(bytes), sha(bytes)]);
        // De tweede pooldialoog mag alleen het nieuwe projectbestand hebben geschreven.
        const writes = ipc.calls.slice(before).filter(c => c.command === 'plugin:fs|write' || c.command === 'plugin:fs|write_text_file');
        ok(`1c ${name} ${route}: nul doelwrites`, route === 'pool-bibliotheek' ? writes.length > 0 && existsSync(projectPath) : writes.length === 0);
        const reason = await refusedWriteTarget(S(), { kind: 'path', path: alias }, { identityFs: fileIdentityFs, readers: writeTargetReaders });
        eq(`1c ${name} ${route}: getypeerde weigering`, reason, name === 'pset' ? 'foreign-content' : 'building-model');
      }
    }
    // Ook een bestaand eigen bibliotheekbestand blijft een gewoon doel; geen vrijbrief op bestandsnaam.
    const libraryStore = await open('eigen.ifc', showcase, null);
    const libraryId = libraryStore.getState().seedDemoLibrary();
    const library = libraryStore.getState().exportPoolIFC(libraryId)!;
    const libraryPath = join(dir, 'eigen-bibliotheek.ifc');
    writeFileSync(libraryPath, library);
    answers = [libraryPath];
    const libraryWrites = ipc.calls.length;
    const libraryResult = await saveFileDialog('bibliotheek.ifc', library, [{ name: 'IFC', extensions: ['ifc'] }],
      { refuseTarget: libraryStore.getState().foreignTargetCheck('export') });
    ok('1c: bestaande eigen bibliotheek blijft schrijfbaar', libraryResult !== null);
    ok('1c: bestaande eigen bibliotheek echt geschreven', ipc.calls.slice(libraryWrites).some(c => c.command === 'plugin:fs|write'));
    eq('1c: gewone bibliotheekwriter blijft bytegelijk', readFileSync(libraryPath, 'utf8'), library);
    eq('1c: alle echte bestanden gesloten', ipc.openHandles(), 0);
  } finally {
    ipc.dispose();
    (globalThis as { window?: unknown }).window = savedWindow;
    rmSync(dir, { recursive: true, force: true });
  }
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
