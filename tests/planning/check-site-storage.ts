// Opslag via de site (issue #309) — headless checks op de hele keten zonder browser.
//
// Wat hier vastligt:
//   A. Het hostcontract: `getSiteStorage()` vindt een geldige host op het eigen venster en op een
//      same-origin parent, valt stil terug bij een cross-origin parent (die gooit bij lezen), weigert
//      een host zonder vier functies, en ziet in Tauri nooit een site. Plus `siteInitialFileId`,
//      `siteHostWindows` (waar het ready-event kan komen), de foutcodes, `runsEmbedded` en `siteLanguageHints` (#716).
//   B. De dispatch in `fileAccess/index.ts`: de algemene schrijffuncties schrijven NOOIT naar de site
//      (ook niet met host), lezen mag wel; een handle-ref blijft bij de webbackend.
//   C. De site-backend: openen geeft de gelezen versie (verplicht), een oudere versie geeft geen doel
//      en geen basis; opslaan stuurt de basis van het document mee en controleert het antwoord.
//   D. Recente bestanden: site-refs dedupliceren op id.
//   E. `saveTargetRef`: alle combinaties van filePath/fileHandle/siteFileId, Tauri en web.
//   F. Crashherstel: manifestronde met en zonder site-doel (web-IndexedDB en het Tauri-plan), een
//      oud manifest zonder veld, de recoverydelta, en `restoreDocuments` zet doel én basis terug.
//   G. De opslaanroute in de store, met de basis PER DOCUMENT: Ctrl+S met site-doel (geen vraag),
//      conflict, een onvolledig antwoord, nieuw document naar de site, "Op deze pc…", openen van de
//      nieuwste en van een oudere versie, Recent (alleen `not-found` ruimt op), twee tabbladen op één
//      bestand plus een heropening — en ZONDER host geen enkele site-vraag.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.

// ── Omgeving: window, document, IndexedDB en sessionStorage ──────────────────────────────────────
// Eerst de globals, dan pas de app-modules (die lezen sommige globals bij het laden).
type AnyRecord = Record<string, unknown>;
const g = globalThis as unknown as AnyRecord;
const win: AnyRecord = {};
win.parent = win; // geen iframe
g.window = win;

const downloads: string[] = [];
g.document = {
  createElement: (tag: string) => {
    if (tag !== 'a') throw new Error(`onverwacht element ${tag}`);
    const el = { href: '', download: '', click: () => { downloads.push(el.download); } };
    return el;
  },
};
(globalThis.URL as unknown as AnyRecord).createObjectURL = () => 'blob:test';
(globalThis.URL as unknown as AnyRecord).revokeObjectURL = () => undefined;

const session = new Map<string, string>();
g.sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => { session.set(k, v); },
  removeItem: (k: string) => { session.delete(k); },
};
g.localStorage = {
  getItem: () => null, setItem: () => undefined, removeItem: () => undefined,
};

/**
 * Kleine IndexedDB-dubbel: per database en per object-store een eigen Map, keyPath `id`. Crashherstel
 * gebruikt twee stores in één transactie (`records` en `xer-archives`, PR #295) en leest per ronde
 * alleen sleutels (`getAllKeys`) en de manifesten (`get`).
 */
const databases = new Map<string, Map<string, Map<string, unknown>>>();
function storeRecords(dbName: string, storeName: string): Map<string, unknown> {
  let stores = databases.get(dbName);
  if (!stores) { stores = new Map(); databases.set(dbName, stores); }
  let records = stores.get(storeName);
  if (!records) { records = new Map(); stores.set(storeName, records); }
  return records;
}
function fakeRequest(compute: () => unknown) {
  const request = { result: undefined as unknown, error: null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
  queueMicrotask(() => { request.result = compute(); request.onsuccess?.(); });
  return request;
}
function fakeDb(name: string) {
  const indexes = new Map<string, string>();
  return {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    close: () => undefined,
    onversionchange: null as (() => void) | null,
    transaction: () => {
      const tx = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        error: null,
        objectStore: (storeName: string) => {
          const records = storeRecords(name, storeName);
          return {
            indexNames: { contains: (indexName: string) => indexes.has(storeName + '::' + indexName) },
            createIndex: (indexName: string, keyPath: string) => { indexes.set(storeName + '::' + indexName, keyPath); },
            index: (indexName: string) => {
              const keyPath = indexes.get(storeName + '::' + indexName);
              if (!keyPath) throw new Error('Ontbrekende testindex ' + indexName);
              return { keyPath, unique: false, getAll: (query: unknown) => fakeRequest(() => [...records.values()]
                .filter(value => value !== null && typeof value === 'object' && Reflect.get(value, keyPath) === query)
                .map(value => structuredClone(value))) };
            },
            getAll: () => fakeRequest(() => [...records.values()].map((r) => structuredClone(r))),
            getAllKeys: () => fakeRequest(() => [...records.keys()]),
            get: (key: string) => fakeRequest(() => structuredClone(records.get(key))),
            put: (value: { id: string }) => { records.set(value.id, structuredClone(value)); queueMicrotask(() => tx.oncomplete?.()); },
            delete: (id: string) => { records.delete(id); queueMicrotask(() => tx.oncomplete?.()); },
          };
        },
      };
      return tx;
    },
  };
}
g.indexedDB = {
  open: (name: string) => {
    const db = fakeDb(name);
    const request = { result: db, transaction: db.transaction(), error: null, onupgradeneeded: null as (() => void) | null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
    queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
  },
};

// ── Imports (na de globals) ────────────────────────────────────────────────────────────────────
const {
  getSiteStorage, isSiteStorage, siteInitialFileId, isSiteConflict, isSiteNotFound, siteStorageAvailable, siteHostWindows,
  runsEmbedded, siteLanguageHints,
} = await import('@/services/fileAccess/siteHost');
const {
  saveToRef, saveToRefWithoutPrompt, canWriteToRefWithoutPrompt, readFromRef, readBytesFromRef, saveTargetRef,
  supportsRecentFiles,
} = await import('@/services/fileAccess');
const {
  openSiteFile, saveNewSiteFile, saveSiteFileVersion, siteDataToText, listSiteFiles,
} = await import('@/services/fileAccess/siteBackend');
const { addRecent, loadRecents, sameRef } = await import('@/services/fileAccess/recentFiles');
const {
  saveRecovery, loadRecovery, clearRecovery, fullRecoverySave, planTauriV3RecoverySave, parseRecoveryManifest, recoverySiteMeta,
} = await import('@/services/recovery/recoveryStore');
const { planRecoveryDelta, persistedRecoveryState } = await import('@/services/recovery/recoveryDelta');
const { recoveryNames } = await import('@/hooks/recoveryPaths');
const { setSiteOpenAsker, setSiteSaveAsker, resetSiteAskers } = await import('@/services/fileAccess/siteDialogs');
const { useAppStore } = await import('@/state/appStore');
const { isActivePristine, siteSaveDefaultName, siteVersionCopyName } = await import('@/state/slices/fileSlice');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { readIFC } = await import('@/services/ifc/ifcReader');
const { recoveryInputFromParsed } = await import('@/state/documentContract');
type FileRef = import('@/services/fileAccess').FileRef;
type SiteStorage = import('@/services/fileAccess/siteHost').SiteStorage;
type SiteFileInfo = import('@/services/fileAccess/siteHost').SiteFileInfo;

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const truthy = (label: string, cond: unknown) => {
  checks++;
  if (!cond) diffs.push(label);
};
const rejects = async (label: string, run: () => Promise<unknown>, match: RegExp) => {
  checks++;
  try {
    await run();
    diffs.push(`${label}: verwacht een fout, kreeg geen`);
  } catch (err) {
    if (!match.test(String((err as Error)?.message ?? err))) diffs.push(`${label}: andere fout: ${String((err as Error)?.message ?? err)}`);
  }
};
const S = () => useAppStore.getState();

// ── Een in-memory site die elke aanroep telt ───────────────────────────────────────────────────
interface Call { fn: string; args: unknown[] }
interface MemFile { id: string; name: string; versions: { version: string; data: string }[] }
interface MemSiteOptions {
  /** Elke opslag faalt met deze tekst (code `other`). */
  fail?: string;
  /** Het antwoord van `save` breekt het contract. */
  badAnswer?: 'no-version' | 'other-id' | 'no-id';
  /** `open` faalt met deze tekst (code `other`), ook voor bestaande bestanden. */
  openFail?: string;
  /** `open` geeft geen versie terug. */
  openWithoutVersion?: boolean;
}
function memorySite(opts: MemSiteOptions = {}) {
  const calls: Call[] = [];
  const files = new Map<string, MemFile>();
  let seq = 0;
  const latest = (f: MemFile) => f.versions[f.versions.length - 1];
  const info = (f: MemFile, v = latest(f)): SiteFileInfo => ({ id: f.id, name: f.name, version: v.version });
  const storage: SiteStorage = {
    list: async (query) => { calls.push({ fn: 'list', args: [query] }); return [...files.values()].map((f) => info(f)); },
    open: async (id, version) => {
      calls.push({ fn: 'open', args: [id, version] });
      if (opts.openFail) throw { code: 'other', message: opts.openFail };
      const f = files.get(id);
      if (!f) throw Object.assign(new Error(`Bestand ${id} bestaat niet.`), { code: 'not-found' });
      const v = version === undefined ? latest(f) : f.versions.find((x) => x.version === version)!;
      const file = opts.openWithoutVersion ? { id: f.id, name: f.name } : info(f, v);
      return { file, data: new TextEncoder().encode(v.data) };
    },
    save: async (request) => {
      const text = await request.data.text();
      calls.push({ fn: 'save', args: [{ id: request.id, name: request.name, baseVersion: request.baseVersion, type: request.data.type }] });
      if (opts.fail) throw { code: 'other', message: opts.fail };
      let f: MemFile;
      if (request.id === undefined) {
        f = { id: `id-${++seq}`, name: request.name, versions: [{ version: 'v1', data: text }] };
        files.set(f.id, f);
      } else {
        f = files.get(request.id)!;
        if (request.baseVersion !== undefined && request.baseVersion !== latest(f).version) {
          throw Object.assign(new Error('Iemand anders was eerder.'), { code: 'conflict' });
        }
        f.versions.push({ version: `v${f.versions.length + 1}`, data: text });
      }
      if (opts.badAnswer === 'no-version') return { id: f.id, name: f.name };
      if (opts.badAnswer === 'other-id') return { ...info(f), id: 'ander-id' };
      if (opts.badAnswer === 'no-id') return { name: f.name, version: latest(f).version } as SiteFileInfo;
      return info(f);
    },
    versions: async (id) => { calls.push({ fn: 'versions', args: [id] }); return [...files.get(id)!.versions].reverse().map((v) => ({ version: v.version })); },
  };
  const put = (id: string, name: string, versions: string[]) => {
    files.set(id, { id, name, versions: versions.map((data, i) => ({ version: `v${i + 1}`, data })) });
  };
  /** "Iemand anders slaat op": een nieuwe versie direct op de site. */
  const otherUserSaves = (id: string, data?: string) => {
    const f = files.get(id)!;
    f.versions.push({ version: `v${f.versions.length + 1}`, data: data ?? latest(f).data });
  };
  const saves = () => calls.filter((c) => c.fn === 'save').map((c) => c.args[0] as AnyRecord);
  return { storage, calls, files, put, latest, otherUserSaves, saves };
}
const setHost = (host: unknown) => { win.openaecHost = host; };
const clearHost = () => { delete win.openaecHost; win.parent = win; delete win.__TAURI_INTERNALS__; };
/** Een same-origin parent-venster met `addEventListener`. */
const sameOriginParent = (extra: AnyRecord = {}): AnyRecord => ({ addEventListener: () => undefined, ...extra });

// ═══ A. Hostcontract ═══════════════════════════════════════════════════════════════════════════
{
  clearHost();
  eq('A1 geen host ⇒ geen opslag', getSiteStorage(), null);
  eq('A1 geen host ⇒ niet beschikbaar', siteStorageAvailable(), false);
  const site = memorySite();
  setHost({ storage: site.storage });
  truthy('A2 eigen window.openaecHost ⇒ opslag gevonden', getSiteStorage() === site.storage);
  setHost({ storage: { list: () => 0, open: () => 0, save: () => 0 } });
  eq('A3 host met drie functies ⇒ ongeldig', getSiteStorage(), null);
  eq('A3 isSiteStorage(null)', isSiteStorage(null), false);
  setHost('geen object');
  eq('A4 host is geen object ⇒ geen opslag', getSiteStorage(), null);
  clearHost();

  // Same-origin parent.
  const parentSite = memorySite();
  const parentWin = sameOriginParent({ openaecHost: { storage: parentSite.storage, initialFileId: 'start-1' } });
  win.parent = parentWin;
  truthy('A5 same-origin parent ⇒ opslag van de parent', getSiteStorage() === parentSite.storage);
  eq('A5 initialFileId van de parent', siteInitialFileId(), 'start-1');
  truthy('A5 ready-event: eigen venster én parent', siteHostWindows().length === 2 && (siteHostWindows()[1] as unknown) === parentWin);
  // Eigen venster gaat vóór de parent.
  const ownSite = memorySite();
  setHost({ storage: ownSite.storage });
  truthy('A6 eigen venster gaat vóór de parent', getSiteStorage() === ownSite.storage);
  eq('A6 initialFileId volgt de gekozen host (eigen, zonder id)', siteInitialFileId(), null);
  clearHost();
  truthy('A6b geen iframe ⇒ alleen het eigen venster', siteHostWindows().length === 1 && (siteHostWindows()[0] as unknown) === win);

  // Cross-origin parent: lezen gooit.
  const crossOrigin: AnyRecord = {};
  for (const key of ['openaecHost', 'addEventListener']) {
    Object.defineProperty(crossOrigin, key, { get() { throw new Error('SecurityError: cross-origin'); } });
  }
  win.parent = crossOrigin;
  let threw = false;
  try {
    eq('A7 cross-origin parent ⇒ geen opslag, geen fout', getSiteStorage(), null);
    eq('A7 cross-origin parent ⇒ ready-event alleen op het eigen venster', siteHostWindows().length, 1);
  } catch { threw = true; }
  eq('A7 cross-origin gooit niet door', threw, false);
  eq('A7 cross-origin initialFileId ⇒ null', siteInitialFileId(), null);
  clearHost();

  // Tauri: nooit een site.
  setHost({ storage: memorySite().storage, initialFileId: 'x' });
  win.__TAURI_INTERNALS__ = {};
  eq('A8 Tauri ⇒ nooit site-opslag', getSiteStorage(), null);
  eq('A8 Tauri ⇒ geen startbestand', siteInitialFileId(), null);
  eq('A8 Tauri ⇒ geen venster voor het ready-event', siteHostWindows().length, 0);
  clearHost();

  // Host zonder geldige opslag levert ook geen startbestand.
  setHost({ initialFileId: 'x' });
  eq('A9 startbestand zonder opslag ⇒ null', siteInitialFileId(), null);
  setHost({ storage: memorySite().storage, initialFileId: '' });
  eq('A9 lege initialFileId ⇒ null', siteInitialFileId(), null);
  clearHost();

  eq('A10 isSiteConflict op code', isSiteConflict({ code: 'conflict' }), true);
  eq('A10 andere code is geen conflict', isSiteConflict({ code: 'other' }), false);
  eq('A10 een gewone Error is geen conflict', isSiteConflict(new Error('x')), false);
  eq('A11 isSiteNotFound op code', isSiteNotFound({ code: 'not-found' }), true);
  eq('A11 conflict is geen not-found', isSiteNotFound({ code: 'conflict' }), false);
  eq('A11 null is geen not-found', isSiteNotFound(null), false);

  // Ingebed (#716): elk host-object telt, ook zonder opslag en ook op de same-origin parent. Desktop nooit.
  eq('A12 geen host ⇒ niet ingebed', runsEmbedded(), false);
  setHost({});
  eq('A12 leeg host-object ⇒ ingebed', runsEmbedded(), true);
  eq('A12 leeg host-object maakt nog geen site', getSiteStorage(), null);
  clearHost();
  setHost('geen object');
  eq('A12 host die geen object is ⇒ niet ingebed', runsEmbedded(), false);
  clearHost();
  win.parent = sameOriginParent({ openaecHost: {} });
  eq('A12 host op de same-origin parent ⇒ ingebed', runsEmbedded(), true);
  clearHost();
  setHost({});
  win.__TAURI_INTERNALS__ = {};
  eq('A12 Tauri ⇒ nooit ingebed', runsEmbedded(), false);
  clearHost();

  // De taal van de host (#716), in volgorde: `taal` op de host, `lang` van de same-origin parent, `taal=`
  // in de hash. Alleen tekst telt; een cross-origin parent of een kapotte hash is "niets".
  const parentWithLang = (lang: string) => sameOriginParent({ document: { documentElement: { lang } } });
  eq('A13 geen host, geen parent, geen hash ⇒ geen taal', siteLanguageHints(), []);
  setHost({ taal: 'de' });
  win.parent = parentWithLang('fr-FR');
  win.location = { hash: '#x=1&taal=es' };
  eq('A13 volgorde host, parent, hash', siteLanguageHints(), ['de', 'fr-FR', 'es']);
  setHost({ taal: 3 });
  eq('A13 taal die geen tekst is telt niet', siteLanguageHints(), ['fr-FR', 'es']);
  win.parent = parentWithLang('');
  win.location = { hash: '#taal=tr' };
  eq('A13 lege lang van de parent telt niet; hash aan het begin', siteLanguageHints(), ['tr']);
  win.parent = { get document(): never { throw new Error('SecurityError'); } };
  win.location = { hash: '#taal=%E0%A4' };
  eq('A13 cross-origin parent ⇒ niets; kapotte codering blijft ruwe tekst', siteLanguageHints(), ['%E0%A4']);
  win.location = { hash: '#mijntaal=nl' };
  eq('A13 alleen de sleutel taal= telt', siteLanguageHints(), []);
  delete win.location;
  clearHost();
}

// ═══ B. Dispatch in fileAccess/index.ts ════════════════════════════════════════════════════════
{
  clearHost();
  const ref: FileRef = { kind: 'site', id: 'f1' };
  eq('B1 zonder host: readFromRef(site) ⇒ null', await readFromRef(ref), null);
  eq('B1 zonder host: readBytesFromRef(site) ⇒ null', await readBytesFromRef(ref), null);
  eq('B1 zonder host: supportsRecentFiles = supportsHandles (web zonder FSA)', supportsRecentFiles(), false);

  const site = memorySite();
  site.put('f1', 'Plan.ifc', ['﻿een', 'twee']);
  setHost({ storage: site.storage });
  eq('B2 met host: supportsRecentFiles', supportsRecentFiles(), true);
  // De algemene schrijffuncties hebben geen basis van een document: ze schrijven nooit naar de site.
  eq('B3 saveToRef(site) ⇒ false, ook met host', await saveToRef(ref, 'x'), false);
  eq('B3 saveToRefWithoutPrompt(site) ⇒ false (geen AutoSave naar de site)', await saveToRefWithoutPrompt(ref, 'x'), false);
  eq('B3 canWriteToRefWithoutPrompt(site) ⇒ false', await canWriteToRefWithoutPrompt(ref), false);
  eq('B3 geen enkele save-aanroep', site.saves().length, 0);
  // Een site-bestand heropent de store via `openSiteFile` (basisversie, foutcodes); de algemene
  // leesfuncties lezen een site-ref nooit, net zoals `saveToRef` er nooit naar schrijft.
  const callsBefore = site.calls.length;
  eq('B4 readFromRef(site) ⇒ null', await readFromRef(ref), null);
  eq('B5 readBytesFromRef(site) ⇒ null', await readBytesFromRef(ref), null);
  eq('B4/B5 roepen de site niet aan', site.calls.length, callsBefore);
  // Een handle-ref blijft bij de webbackend (die leest via getFile).
  const handle = {
    kind: 'file', name: 'h.ifc', isSameEntry: async () => false,
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFile: async () => ({ text: async () => 'handle-inhoud', arrayBuffer: async () => new ArrayBuffer(0) }),
  } as unknown as FileSystemFileHandle;
  const before = site.calls.length;
  eq('B6 handle-ref ⇒ webbackend', await readFromRef({ kind: 'handle', handle }), 'handle-inhoud');
  eq('B6 handle-ref raakt de site niet', site.calls.length, before);
  // UTF-8-BOM valt weg zoals bij File.text().
  eq('B7 BOM valt weg bij tekst', await siteDataToText(new TextEncoder().encode('﻿abc')), 'abc');
  clearHost();
}

// ═══ C. De site-backend ════════════════════════════════════════════════════════════════════════
{
  const site = memorySite();
  site.put('f2', 'B.ifc', ['1', '2', '3']);
  setHost({ storage: site.storage });
  const opened = await openSiteFile('f2');
  eq('C1 nieuwste openen ⇒ site-ref', opened.ref, { kind: 'site', id: 'f2' });
  eq('C1 nieuwste openen ⇒ gelezen versie', opened.version, 'v3');
  const older = await openSiteFile('f2', { version: 'v1' });
  eq('C2 oudere versie ⇒ geen ref', older.ref, null);
  eq('C2 oudere versie ⇒ geen basis', older.version, null);
  eq('C2 oudere versie ⇒ inhoud van v1', older.content, '1');

  const saved = await saveSiteFileVersion('f2', 'B.ifc', '4', 'v3');
  eq('C3 opslaan stuurt de basis van het document mee', site.saves().at(-1), {
    id: 'f2', name: 'B.ifc', baseVersion: 'v3', type: 'application/x-step',
  });
  eq('C3 opslaan geeft de nieuwe versie terug', saved, { id: 'f2', name: 'B.ifc', version: 'v4' });
  await saveSiteFileVersion('f2', 'B.ifc', '5', null);
  eq('C3 geen basis ⇒ geen baseVersion-veld', 'baseVersion' in site.saves().at(-1)! && site.saves().at(-1)!.baseVersion !== undefined, false);
  // Basis loopt achter (iemand anders sloeg op) ⇒ conflict.
  let err: unknown = null;
  try { await saveSiteFileVersion('f2', 'B.ifc', '6', 'v4'); } catch (e) { err = e; }
  eq('C4 conflict gooit door met code', isSiteConflict(err), true);

  // De site filtert niet: de tool toont alleen wat hij kan openen (extensie van de naam).
  site.put('pdf', 'Tekening.PDF', ['x']);
  site.put('xer', 'Bron.XER', ['x']);
  eq('C5 lijst gefilterd op extensie (hoofdletterongevoelig)', (await listSiteFiles(['ifc', 'xer'])).map((f) => f.id), ['f2', 'xer']);
  eq('C5 lijst vraagt de extensies aan de site', site.calls.at(-1), { fn: 'list', args: [{ extensions: ['ifc', 'xer'] }] });

  const created = await saveNewSiteFile('Nieuw.ifc', 'inhoud');
  eq('C6 nieuw bestand: save zonder id en zonder baseVersion', site.saves().at(-1), {
    id: undefined, name: 'Nieuw.ifc', baseVersion: undefined, type: 'application/x-step',
  });
  eq('C6 nieuw bestand: id en versie uit het antwoord', created, { id: 'id-1', name: 'Nieuw.ifc', version: 'v1' });

  // Het antwoord van de site moet kloppen; anders is de opslag mislukt.
  for (const [mode, match] of [
    ['no-version', /geen versie/], ['other-id', /ander bestand-id/], ['no-id', /geen bestand-id/],
  ] as const) {
    const bad = memorySite({ badAnswer: mode });
    bad.put('b', 'B.ifc', ['1']);
    setHost({ storage: bad.storage });
    await rejects(`C7 nieuwe versie, antwoord ${mode} ⇒ fout`, () => saveSiteFileVersion('b', 'B.ifc', 'x', 'v1'), match);
    if (mode !== 'other-id') await rejects(`C7 nieuw bestand, antwoord ${mode} ⇒ fout`, () => saveNewSiteFile('N.ifc', 'x'), match);
  }
  const noVersion = memorySite({ openWithoutVersion: true });
  noVersion.put('nv', 'NV.ifc', ['1']);
  setHost({ storage: noVersion.storage });
  await rejects('C8 nieuwste openen zonder versie in het antwoord ⇒ fout', () => openSiteFile('nv'), /geen versie/);
  eq('C8 een oudere versie mag zonder versie in het antwoord', (await openSiteFile('nv', { version: 'v1' })).content, '1');
  clearHost();
}

// ═══ D. Recente bestanden ══════════════════════════════════════════════════════════════════════
{
  eq('D1 sameRef op id', await sameRef({ kind: 'site', id: 'a' }, { kind: 'site', id: 'a' }), true);
  eq('D1 ander id ⇒ anders', await sameRef({ kind: 'site', id: 'a' }, { kind: 'site', id: 'b' }), false);
  eq('D1 site vs pad ⇒ anders', await sameRef({ kind: 'site', id: 'a' }, { kind: 'path', path: 'a' }), false);
  await addRecent({ kind: 'site', id: 'r1' }, 'Eén.ifc');
  await addRecent({ kind: 'path', path: '/tmp/x.ifc' }, 'x.ifc');
  await addRecent({ kind: 'site', id: 'r1' }, 'Eén (hernoemd).ifc');
  const list = await loadRecents();
  // Alleen de dedupe telt hier; de volgorde hangt van `addedAt` (Date.now) af en is binnen één
  // milliseconde niet vast.
  eq('D2 één entry per site-bestand, met de nieuwste naam', list.filter((e) => e.ref.kind === 'site').map((e) => e.name), ['Eén (hernoemd).ifc']);
  eq('D2 de pad-entry blijft staan', list.filter((e) => e.ref.kind === 'path').map((e) => e.name), ['x.ifc']);
}

// ═══ E. saveTargetRef ══════════════════════════════════════════════════════════════════════════
{
  const handle = { kind: 'file', name: 'h.ifc' } as unknown as FileSystemFileHandle;
  const none = { filePath: null, fileHandle: null, siteFileId: null };
  eq('E1 niets ⇒ null (web)', saveTargetRef(none, false), null);
  eq('E1 niets ⇒ null (Tauri)', saveTargetRef(none, true), null);
  eq('E2 alleen naam (web) ⇒ geen doel', saveTargetRef({ ...none, filePath: 'a.ifc' }, false), null);
  eq('E2 pad (Tauri) ⇒ pad', saveTargetRef({ ...none, filePath: '/p/a.ifc' }, true), { kind: 'path', path: '/p/a.ifc' });
  truthy('E3 handle ⇒ handle (web)', saveTargetRef({ ...none, filePath: 'a.ifc', fileHandle: handle }, false)?.kind === 'handle');
  truthy('E3 handle ⇒ handle (Tauri, gaat vóór pad)', saveTargetRef({ ...none, filePath: '/p', fileHandle: handle }, true)?.kind === 'handle');
  eq('E4 site ⇒ site (web)', saveTargetRef({ ...none, filePath: 'a.ifc', siteFileId: 's1' }, false), { kind: 'site', id: 's1' });
  eq('E4 site gaat vóór handle en pad', saveTargetRef({ filePath: '/p', fileHandle: handle, siteFileId: 's1' }, true), { kind: 'site', id: 's1' });
  eq('E5 lege siteFileId telt niet', saveTargetRef({ ...none, siteFileId: '' }, false), null);
}

// ═══ F. Crashherstel ═══════════════════════════════════════════════════════════════════════════
{
  const doc = (id: string, site?: { id: string; version?: string }) => ({
    id, ifc: `ISO-10303-21; /* ${id} */`, filePath: `${id}.ifc`, isDirty: true, datesAsRecorded: false,
    ...(site ? { siteFileId: site.id, ...(site.version ? { siteFileVersion: site.version } : {}) } : {}),
  });
  await saveRecovery(fullRecoverySave('A', [doc('A', { id: 'site-a', version: 'v7' }), doc('B')]));
  const loaded = await loadRecovery();
  const byId = new Map(loaded.docs.map((d) => [d.id, d]));
  eq('F1 web: siteFileId komt terug', byId.get('A')?.siteFileId, 'site-a');
  eq('F1 web: siteFileVersion komt terug', byId.get('A')?.siteFileVersion, 'v7');
  eq('F1 web: zonder site geen veld', 'siteFileId' in (byId.get('B') ?? {}), false);
  // Het manifestrecord zelf: zonder site is de regel gelijk aan vóór #309. De site-velden zijn
  // optioneel en kregen geen eigen versienummer; 5 komt van de XER-archiefverwijzing (PR #295).
  const manifestRecord = [...databases.get('ops-recovery')?.get('records')?.values() ?? []]
    .find((r) => (r as AnyRecord).kind === 'manifest') as { version: number; documents: AnyRecord[] } | undefined;
  eq('F2 manifestversie is 5 (XER-archiefverwijzing; de site-velden zijn optioneel)', manifestRecord?.version, 5);
  eq('F2 manifestregel zonder site heeft geen site-velden',
    Object.keys(manifestRecord?.documents.find((d) => d.id === 'B') ?? {}).sort(),
    ['datesAsRecorded', 'filePath', 'id', 'ifc', 'isDirty']);
  await clearRecovery();

  // Tauri-plan + een oud manifest zonder veld.
  const names = recoveryNames('recovery.test');
  const plan = planTauriV3RecoverySave(null, fullRecoverySave('A', [doc('A', { id: 'site-a', version: 'v2' }), doc('B')]), 'g1', names);
  eq('F3 Tauri-plan: site-doel in de manifestregel', plan.documents.map((d) => d.siteFileId ?? null), ['site-a', null]);
  eq('F3 Tauri-plan: basis in de manifestregel', plan.documents.map((d) => d.siteFileVersion ?? null), ['v2', null]);
  const old = parseRecoveryManifest(JSON.stringify({
    version: 4, activeDocumentId: 'A', documents: [{ id: 'A', ifc: 'x', filePath: null, isDirty: true, datesAsRecorded: false }],
  }));
  eq('F4 oud manifest leest zonder site-doel', recoverySiteMeta(old?.documents[0]), { siteFileId: null, siteFileVersion: null });
  eq('F4 vreemde waarden tellen niet', recoverySiteMeta({ siteFileId: 12, siteFileVersion: 'v1' }), { siteFileId: null, siteFileVersion: null });
  eq('F4 versie zonder id telt niet', recoverySiteMeta({ siteFileVersion: 'v1' }), { siteFileId: null, siteFileVersion: null });

  // Recoverydelta: een nieuwe site-versie (na opslaan) is een manifest-only wijziging.
  const source = {} as never;
  const metaA = { id: 'A', filePath: 'A.ifc', isDirty: false, datesAsRecorded: false, siteFileId: 'site-a', siteFileVersion: 'v1', source };
  const persisted = persistedRecoveryState('A', [metaA]);
  const same = planRecoveryDelta('A', [metaA], persisted);
  eq('F5 zelfde site-versie ⇒ geen I/O', same.needsPersist, false);
  const bumped = planRecoveryDelta('A', [{ ...metaA, siteFileVersion: 'v2' }], persisted);
  eq('F5 nieuwe site-versie ⇒ manifest-only', [bumped.manifestChanged, bumped.changedDocuments.length], [true, 0]);
  const noSite = { id: 'A', filePath: 'A.ifc', isDirty: false, datesAsRecorded: false, siteFileId: null, siteFileVersion: null, source };
  const persistedNoSite = persistedRecoveryState('A', [{ id: 'A', filePath: 'A.ifc', isDirty: false, datesAsRecorded: false, source }]);
  eq('F5 null en ontbrekend zijn gelijk', planRecoveryDelta('A', [noSite], persistedNoSite).needsPersist, false);

  // restoreDocuments zet doel én basis terug; Ctrl+S stuurt die basis mee.
  S().newProject();
  S().setProject({ name: 'Herstel-site', startDate: '2026-08-03' });
  S().addTask({ name: 'Werk' });
  const ifc = writeIFC(buildWriteIFCInput(S()));
  const parsed = readIFC(ifc);
  S().restoreDocuments([
    recoveryInputFromParsed(parsed, { id: 'rs-1', filePath: 'Herstel.ifc', siteFileId: 'site-r', siteFileVersion: 'v4', isDirty: true, datesAsRecorded: false }),
    recoveryInputFromParsed(parsed, { id: 'rs-2', filePath: 'Lokaal.ifc', siteFileVersion: 'v9', isDirty: true, datesAsRecorded: false }),
  ], 'rs-1');
  eq('F6 hersteld actief document: siteFileId terug', S().siteFileId, 'site-r');
  eq('F6 hersteld actief document: basis terug', S().siteFileVersion, 'v4');
  eq('F6 hersteld document: opslagdoel is de site', saveTargetRef(S(), false), { kind: 'site', id: 'site-r' });
  const site = memorySite();
  site.put('site-r', 'Herstel.ifc', [ifc, ifc, ifc, ifc]);
  setHost({ storage: site.storage });
  await S().saveFile();
  eq('F6 Ctrl+S na herstel stuurt de herstelde basis mee', site.saves().at(-1)?.baseVersion, 'v4');
  eq('F6 daarna is de basis de nieuwe versie', S().siteFileVersion, 'v5');
  clearHost();
  S().switchDocument('rs-2');
  eq('F7 hersteld document zonder site: null', [S().siteFileId, S().siteFileVersion], [null, null]);
}

// ═══ G. De opslaanroute in de store ════════════════════════════════════════════════════════════
{
  resetSiteAskers();
  clearHost();
  const asked: string[] = [];
  setSiteOpenAsker(async () => { asked.push('open'); return null; });
  setSiteSaveAsker(async () => { asked.push('save'); return null; });

  // G0 — ZONDER host: geen enkele site-vraag; de gewone route (hier: download-terugval).
  S().newProject();
  S().setProject({ name: 'Zonder site', startDate: '2026-08-03' });
  S().addTask({ name: 'Taak' });
  downloads.length = 0;
  await S().saveFile();
  eq('G0 zonder host: geen site-vraag bij opslaan', asked, []);
  eq('G0 zonder host: gewone route (download)', downloads, ['Zonder site.ifc']);
  eq('G0 zonder host: siteFileId blijft null', S().siteFileId, null);
  await S().saveFileAs();
  eq('G0 zonder host: ook opslaan als vraagt niets', asked, []);
  eq('G0 isActivePristine kijkt ook naar siteFileId', isActivePristine({ ...S(), tasks: [], sequences: [], resources: [], filePath: null, isDirty: false, siteFileId: 'x' }), false);

  // Site met één IFC-bestand.
  const site = memorySite();
  setHost({ storage: site.storage });
  S().newProject();
  S().setProject({ name: 'Site-project', startDate: '2026-08-03' });
  S().addTask({ name: 'Fundering' });
  const ifc = writeIFC(buildWriteIFCInput(S()));
  site.put('p1', 'Site-project.ifc', [ifc, ifc]);

  // G1 — Openen van de site (nieuwste versie).
  asked.length = 0;
  setSiteOpenAsker(async (req) => { asked.push(`open:${req.extensions.includes('ifc')}`); return { kind: 'site', id: 'p1' }; });
  S().newProject();
  await S().openFile();
  eq('G1 openFile stelt de site-vraag met de open-extensies', asked, ['open:true']);
  eq('G1 nieuwste versie ⇒ site-doel en basis', [S().siteFileId, S().siteFileVersion], ['p1', 'v2']);
  eq('G1 filePath = naam van de site', S().filePath, 'Site-project.ifc');
  eq('G1 taken geladen', S().tasks.map((t) => t.name), ['Fundering']);
  eq('G1 in de recente bestanden', S().recentFiles[0]?.ref, { kind: 'site', id: 'p1' });

  // G2 — wijzigen + Ctrl+S ⇒ save met id + baseVersion, zonder vraag.
  asked.length = 0;
  S().addTask({ name: 'Ruwbouw' });
  eq('G2 voorwaarde: gewijzigd', S().isDirty, true);
  await S().saveFile();
  eq('G2 geen vraag bij Ctrl+S met site-doel', asked, []);
  eq('G2 save met id en baseVersion', site.saves().at(-1), {
    id: 'p1', name: 'Site-project.ifc', baseVersion: 'v2', type: 'application/x-step',
  });
  eq('G2 isDirty uit na opslaan', S().isDirty, false);
  eq('G2 nieuwe basis v3 op het document', S().siteFileVersion, 'v3');

  // G3 — conflict: eigen melding, document blijft gewijzigd, basis blijft.
  site.otherUserSaves('p1');
  S().addTask({ name: 'Afbouw' });
  await S().saveFile();
  const last = S().ui.notifications.at(-1);
  eq('G3 conflictmelding', [last?.messageKey, last?.params?.name], ['notifications.siteSaveConflict', 'Site-project.ifc']);
  eq('G3 document blijft gewijzigd', S().isDirty, true);
  eq('G3 site-doel en basis blijven', [S().siteFileId, S().siteFileVersion], ['p1', 'v3']);

  // G4 — andere sitefout: saveFailed met de tekst van de site.
  const failing = memorySite({ fail: 'Schijf vol op de site' });
  failing.put('p1', 'Site-project.ifc', [ifc]);
  setHost({ storage: failing.storage });
  await S().saveFile();
  const failNote = S().ui.notifications.at(-1);
  eq('G4 andere fout ⇒ saveFailed met detail', [failNote?.messageKey, failNote?.detail], ['notifications.saveFailed', 'Schijf vol op de site']);
  eq('G4 document blijft gewijzigd', S().isDirty, true);

  // G4b — een antwoord zonder versie telt als mislukt: anders viel de conflictcontrole stil uit.
  const noVersion = memorySite({ badAnswer: 'no-version' });
  noVersion.put('p1', 'Site-project.ifc', [ifc, ifc, ifc]); // nieuwste = v3 = de basis van het document
  setHost({ storage: noVersion.storage });
  await S().saveFile();
  const badNote = S().ui.notifications.at(-1);
  eq('G4b antwoord zonder versie ⇒ saveFailed', badNote?.messageKey, 'notifications.saveFailed');
  truthy('G4b met uitleg in het detail', /geen versie/.test(String(badNote?.detail)));
  eq('G4b document blijft gewijzigd, basis blijft', [S().isDirty, S().siteFileVersion], [true, 'v3']);
  setHost({ storage: site.storage });

  // G5 — Opslaan als ⇒ altijd een NIEUW site-bestand; AutoSave gaat uit.
  asked.length = 0;
  S().setAutoSaveToFile(true);
  setSiteSaveAsker(async (req) => { asked.push(`save:${req.defaultName}`); return { kind: 'site', name: 'Variant.ifc' }; });
  await S().saveFileAs();
  eq('G5 opslaan als stelt de vraag met de huidige naam', asked, ['save:Site-project.ifc']);
  eq('G5 save zonder id', site.saves().at(-1)?.id, undefined);
  truthy('G5 nieuw site-doel', S().siteFileId !== null && S().siteFileId !== 'p1');
  eq('G5 basis = versie uit het antwoord', S().siteFileVersion, 'v1');
  eq('G5 filePath = nieuwe naam', S().filePath, 'Variant.ifc');
  eq('G5 isDirty uit', S().isDirty, false);
  eq('G5 AutoSave uit voor een site-document', S().autoSaveToFile, false);
  eq('G5 nieuw bestand bovenaan in Recent', S().recentFiles[0]?.name, 'Variant.ifc');

  // G6 — nieuw document, Ctrl+S ⇒ site-vraag ⇒ naam ⇒ opgeslagen.
  asked.length = 0;
  S().newDocument();
  S().setProject({ name: 'Nieuw op de site', startDate: '2026-08-03' });
  S().addTask({ name: 'X' });
  setSiteSaveAsker(async (req) => { asked.push(`save:${req.defaultName}`); return { kind: 'site', name: 'Eigen naam.ifc' }; });
  await S().saveFile();
  eq('G6 vraag met voorgestelde naam', asked, ['save:Nieuw op de site.ifc']);
  eq('G6 opgeslagen onder de gekozen naam', [S().filePath, S().isDirty, S().siteFileVersion], ['Eigen naam.ifc', false, 'v1']);
  truthy('G6 site-doel gezet', !!S().siteFileId);

  // G7 — annuleren in de vraag ⇒ niets opgeslagen.
  S().addTask({ name: 'Y' });
  const savesBefore = site.saves().length;
  setSiteSaveAsker(async () => null);
  await S().saveFileAs();
  eq('G7 annuleren ⇒ geen save', site.saves().length, savesBefore);
  eq('G7 annuleren ⇒ blijft gewijzigd', S().isDirty, true);

  // G8 — "Op deze pc…" ⇒ bestaande route; het site-doel en de basis vervallen.
  downloads.length = 0;
  setSiteSaveAsker(async () => ({ kind: 'local' }));
  await S().saveFileAs();
  eq('G8 lokale route (download)', downloads.length, 1);
  eq('G8 site-doel en basis vervallen na lokaal opslaan', [S().siteFileId, S().siteFileVersion], [null, null]);

  // G9 — oudere versie openen ⇒ kopie zonder doel, niet in Recent.
  const recentBefore = S().recentFiles.map((e) => e.id);
  setSiteOpenAsker(async () => ({ kind: 'site', id: 'p1', version: 'v1', copyName: 'Site-project (versie v1)' }));
  await S().openFile();
  eq('G9 kopie: geen site-doel en geen basis', [S().siteFileId, S().siteFileVersion], [null, null]);
  eq('G9 kopie: naam met versie', S().filePath, 'Site-project (versie v1).ifc');
  eq('G9 kopie: geen opslagdoel', saveTargetRef(S(), false), null);
  eq('G9 kopie: Recent ongewijzigd', S().recentFiles.map((e) => e.id), recentBefore);

  // G10 — annuleren in "Openen van de site" ⇒ niets gelezen.
  const opensBefore = site.calls.filter((c) => c.fn === 'open').length;
  setSiteOpenAsker(async () => null);
  await S().openFile();
  eq('G10 annuleren ⇒ niets geopend', site.calls.filter((c) => c.fn === 'open').length, opensBefore);

  // G11 — kopie van een document met site-doel krijgt geen site-doel en geen basis.
  setSiteOpenAsker(async () => ({ kind: 'site', id: 'p1' }));
  await S().openFile();
  eq('G11 voorwaarde: site-doel', S().siteFileId, 'p1');
  S().duplicateDocument();
  eq('G11 duplicaat zonder site-doel en basis', [S().siteFileId, S().siteFileVersion], [null, null]);

  // G12 — openFromSite (startbestand) en een mislukte open.
  S().newDocument();
  eq('G12 openFromSite ⇒ true', await S().openFromSite('p1'), true);
  eq('G12 site-doel gezet', S().siteFileId, 'p1');
  eq('G12 onbekend id ⇒ false + melding', [await S().openFromSite('bestaat-niet'), S().ui.notifications.at(-1)?.messageKey], [false, 'notifications.openFailed']);

  // G13 — Recent: heropenen; een TIJDELIJKE fout laat de entry staan (met melding); alleen
  // `not-found` haalt hem weg (ook met melding).
  S().newDocument();
  const recentP1 = () => S().recentFiles.find((e) => e.ref.kind === 'site' && e.ref.id === 'p1');
  // Knownbug 95 is verouderd: de site is de bron voor de actuele naam, niet de bewaarde MRU-naam.
  const oldName = recentP1()!.name;
  const renamed = 'Hernoemd op de site.ifc';
  site.files.get('p1')!.name = renamed;
  eq('G13 voorwaarde: Recent kent nog de oude naam', recentP1()!.name, oldName);
  truthy('G13 voorwaarde: de sitenaam is echt anders', oldName !== renamed);
  await S().openRecentFile(recentP1()!.id);
  eq('G13 heropenen uit Recent ⇒ site-doel en basis', [S().siteFileId, S().siteFileVersion], ['p1', site.latest(site.files.get('p1')!).version]);
  eq('G13 actuele sitenaam wordt opslagnaam', S().filePath, renamed);
  eq('G13 Recent krijgt de nieuwe naam', recentP1()!.name, renamed);
  eq('G13 hernoemen maakt geen dubbele recent-entry', S().recentFiles.filter(e => e.ref.kind === 'site' && e.ref.id === 'p1').length, 1);
  eq('G13 eerder opgeslagen bestandinhoud blijft dezelfde', S().tasks.map(t => t.name), ['Fundering', 'Ruwbouw']);
  eq('G13 documenttitel gebruikt de nieuwe naam', S().getOpenDocuments().find(d => d.isActive)?.title, 'Hernoemd op de site');
  const flaky = memorySite({ openFail: 'Netwerkfout: geen verbinding' });
  setHost({ storage: flaky.storage });
  await S().openRecentFile(recentP1()!.id);
  const flakyNote = S().ui.notifications.at(-1);
  eq('G13 tijdelijke fout ⇒ melding met de tekst van de site', [flakyNote?.messageKey, flakyNote?.detail], ['notifications.openFailed', 'Netwerkfout: geen verbinding']);
  truthy('G13 tijdelijke fout ⇒ entry blijft in Recent', !!recentP1());
  setHost({ storage: site.storage });
  site.files.delete('p1');
  const gone = recentP1()!;
  await S().openRecentFile(gone.id);
  const goneNote = S().ui.notifications.at(-1);
  eq('G13 not-found ⇒ melding met de naam', [goneNote?.messageKey, goneNote?.params?.name], ['notifications.siteFileGone', gone.name]);
  eq('G13 not-found ⇒ entry uit Recent', !!recentP1(), false);

  // G14 — namen.
  eq('G14 standaardnaam eindigt op .ifc', siteSaveDefaultName({ filePath: 'plan', project: S().project, xerImportMetadata: null }), 'plan.ifc');
  eq('G14 kopienaam behoudt de extensie', siteVersionCopyName('bron.xer', '3', 'bron (versie 3)'), 'bron (versie 3).xer');
  eq('G14 kopienaam zonder label', siteVersionCopyName('a.ifc', '2'), 'a (2).ifc');

  // G15 — TWEE TABBLADEN op één site-bestand, plus een heropening. Elk document heeft zijn eigen
  // basis: een heropening in tab B mag de basis van tab A niet verschuiven, anders overschrijft
  // Ctrl+S in A het werk van een collega zonder conflict.
  site.put('x', 'Gedeeld.ifc', [ifc]);
  setSiteOpenAsker(async () => ({ kind: 'site', id: 'x' }));
  S().newDocument();
  await S().openFile();
  const tabA = S().activeDocumentId;
  eq('G15 tab A rust op v1', [S().siteFileId, S().siteFileVersion], ['x', 'v1']);
  S().addTask({ name: 'Werk in A' });
  site.otherUserSaves('x'); // collega slaat v2 op
  S().newDocument();
  await S().openFile();
  const tabB = S().activeDocumentId;
  truthy('G15 tab B is een ander document', tabB !== tabA);
  eq('G15 tab B rust op v2', [S().siteFileId, S().siteFileVersion], ['x', 'v2']);
  // Een heropening die bij het parsen faalt, verschuift ook niets.
  site.files.get('x')!.versions.push({ version: 'v3', data: 'GEEN IFC' });
  S().newDocument();
  await S().openFile();
  eq('G15 kapotte heropening ⇒ melding', S().ui.notifications.at(-1)?.messageKey, 'notifications.openFailed');
  site.files.get('x')!.versions.pop(); // terug naar v2 als nieuwste
  S().switchDocument(tabA);
  eq('G15 tab A rust nog op v1', S().siteFileVersion, 'v1');
  await S().saveFile();
  eq('G15 Ctrl+S in A stuurt v1 mee', site.saves().at(-1)?.baseVersion, 'v1');
  eq('G15 ⇒ conflict, het werk van de collega blijft', [S().ui.notifications.at(-1)?.messageKey, site.latest(site.files.get('x')!).version], ['notifications.siteSaveConflict', 'v2']);
  eq('G15 A blijft gewijzigd op v1', [S().isDirty, S().siteFileVersion], [true, 'v1']);
  S().switchDocument(tabB);
  S().addTask({ name: 'Werk in B' });
  await S().saveFile();
  eq('G15 Ctrl+S in B stuurt v2 mee en slaagt', [site.saves().at(-1)?.baseVersion, S().isDirty, S().siteFileVersion], ['v2', false, 'v3']);
  S().switchDocument(tabA);
  eq('G15 A houdt zijn eigen basis', S().siteFileVersion, 'v1');

  resetSiteAskers();
  clearHost();
}

if (diffs.length === 0) {
  console.log(`OK  site-storage: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  site-storage: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
