// Een mislukte schrijfactie geeft nooit een successtatus (issue #405 deel 2, criteria 1 en 2).
//
// Wat hier vastligt, voor elke foutroute van Opslaan en Opslaan als:
//   - de fout komt als `notifications.saveFailed` (ernst `error`), met de reden in het detail;
//   - er komt geen andere melding bij (geen info over een download, geen "opgeslagen");
//   - `isDirty` blijft `true` (titelbalk `* `, statusbalk "Niet opgeslagen");
//   - het opslagdoel van het document en de recente bestanden veranderen niet;
//   - het doelbestand houdt zijn oude inhoud.
//
// Routes:
//   §1  de schrijf-en-vervang-kern (`replaceUserFile`) tegen een alleen-lezen doel (nep-fs);
//   §1R dezelfde kern tegen het ECHTE bestandssysteem (Linux/macOS; overgeslagen als root);
//   §2  Tauri via de echte store-actie: een nep-`__TAURI_INTERNALS__.invoke` speelt plugin-fs en
//       plugin-dialog na, met de fouttekst die plugin-fs echt geeft (een string, geen Error);
//   §3  web met een FileSystemFileHandle: echte fouten uit createWritable/write/close worden vóór
//       de terugval gemeld; annuleren, mislukte/geslaagde kopie en wijzigen tijdens de kiezer;
//       NotAllowedError blijft de download-terugval gebruiken;
//   §4  de site (`window.openaecHost`): Opslaan als naar een nieuw site-bestand mislukt, en Opslaan
//       naar een bestaand site-bestand mislukt.
//
// Wat hier NIET kan: de echte Tauri-desktopapp en een echte Chromium-bestandskiezer. De nep-randen
// spelen exact de aanroepen na die de app doet (`plugin:fs|…`, `showSaveFilePicker`, `createWritable`).
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

type AnyRecord = Record<string, unknown>;
const g = globalThis as unknown as AnyRecord;
const win: AnyRecord = {};
win.parent = win;
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
const mem = new Map<string, string>();
const storage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
};
g.sessionStorage = storage;
g.localStorage = storage;
installFakeRecoveryIndexedDb();

const { replaceUserFile, USER_FILE_TMP_SUFFIX } = await import('@/services/fileAccess/atomicWrite');
type UserFileFs<D> = import('@/services/fileAccess/atomicWrite').UserFileFs<D>;
const { useAppStore } = await import('@/state/appStore');
const { saveToRefWeb, webWriteRefusedByPlatform, resetWebWriteRefusalForTests } = await import('@/services/fileAccess/webBackend');
const { setSiteSaveAsker, resetSiteAskers } = await import('@/services/fileAccess/siteDialogs');
const { resetBrowserSaveNoticeForTests } = await import('@/state/browserSaveNotice');
const nodeFs = await import('node:fs');
const nodePath = await import('node:path');
const nodeOs = await import('node:os');

declare const process: { exit(code: number): never; getuid?: () => number };

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const truthy = (label: string, cond: unknown) => {
  checks++;
  if (!cond) diffs.push(label);
};

/**
 * De vier vaste toetsen na een mislukte opslag. `run` doet de opslag; `target` leest het doelbestand.
 * `detail` moet in de foutmelding staan (de reden die de gebruiker te zien krijgt).
 */
async function eistMislukt(label: string, run: () => Promise<unknown>, opts: {
  target: () => unknown; targetBefore: unknown; detail: RegExp;
}) {
  const voor = {
    dirty: S().isDirty,
    filePath: S().filePath,
    fileHandle: S().fileHandle,
    siteFileId: S().siteFileId,
    siteFileVersion: S().siteFileVersion,
    recents: S().recentFiles.map((r) => r.id),
  };
  truthy(`${label} voorwaarde: het document is gewijzigd`, voor.dirty);
  leegMeldingen();
  downloads.length = 0;
  await run();
  const nieuw = S().ui.notifications;
  eq(`${label} (1) precies één melding, en dat is saveFailed`,
    nieuw.map((n) => [n.severity, n.messageKey]), [['error', 'notifications.saveFailed']]);
  eq(`${label} (1a) geen dubbele telling binnen één opslagpoging`, nieuw[0]?.count, 1);
  truthy(`${label} (1b) de melding noemt de reden (kreeg ${J(nieuw[0]?.detail)})`, opts.detail.test(String(nieuw[0]?.detail ?? '')));
  eq(`${label} (2) isDirty blijft true`, S().isDirty, true);
  eq(`${label} (3) geen opgeslagen-toestand: opslagdoel en recente bestanden ongewijzigd`,
    [S().filePath, S().fileHandle === voor.fileHandle, S().siteFileId, S().siteFileVersion, S().recentFiles.map((r) => r.id)],
    [voor.filePath, true, voor.siteFileId, voor.siteFileVersion, voor.recents]);
  eq(`${label} (3b) geen download als stille terugval`, downloads, []);
  eq(`${label} (4) het doelbestand is ongewijzigd`, opts.target(), opts.targetBefore);
}

/** Begin elke toets met een lege meldingenlijst: de lijst is begrensd (MAX_NOTIFICATIONS), dus een
 *  nieuwe fout kan een oude wegduwen en "wat kwam erbij" is dan niet aan de lengte te zien. */
const leegMeldingen = () => useAppStore.setState((s) => { s.ui.notifications = []; });

const OUD = 'ISO-10303-21; OUD-PROJECT-COMPLEET END-ISO-10303-21;';

// ═══ §1 De kern: alleen-lezen doel tegen een nep-fs ════════════════════════════════════════════
// Unix: map én bestand alleen-lezen ⇒ het halffabricaat ernaast mag niet ontstaan (EACCES).
// Windows: het bestand heeft het kenmerk "alleen-lezen" ⇒ het halffabricaat lukt, de rename over het
// doel wordt geweigerd, en de terugval (direct schrijven) ook — vóór er iets afgekapt is.
interface Entry { data: string; readonly: boolean }
function fakeFs(initial: Record<string, Entry>, roDirs: string[], windows: boolean) {
  const files = new Map<string, Entry>(Object.entries(initial));
  const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/'));
  const denied = (p: string) => (windows
    ? `failed to open file at path: ${p} with error: Access is denied. (os error 5)`
    : `failed to open file at path: ${p} with error: Permission denied (os error 13)`);
  const fs: UserFileFs<string> = {
    lstat: async (p) => {
      const e = files.get(p);
      if (!e) throw `No such file or directory (os error 2)`;
      return { isSymlink: false, nlink: 1, mode: 0o100000 | (e.readonly ? 0o444 : 0o644) };
    },
    createNew: async (p, mode) => {
      if (files.has(p)) throw 'File exists (os error 17)';
      if (roDirs.includes(dirOf(p))) throw denied(p);
      const entry: Entry = { data: '', readonly: mode !== undefined && (mode & 0o222) === 0 };
      files.set(p, entry);
      return {
        write: async data => { entry.data = data; },
        close: async () => {},
      };
    },
    write: async (p, data, mode) => {
      const prev = files.get(p);
      if (prev?.readonly || (!prev && roDirs.includes(dirOf(p)))) throw denied(p);
      void mode;
      files.set(p, { data, readonly: false });
    },
    rename: async (a, b) => {
      if (roDirs.includes(dirOf(b))) throw 'Permission denied (os error 13)';
      if (windows && files.get(b)?.readonly) throw 'Access is denied. (os error 5)';
      const e = files.get(a);
      if (!e) throw 'No such file or directory (os error 2)';
      files.set(b, e);
      files.delete(a);
    },
    remove: async (p) => {
      if (roDirs.includes(dirOf(p))) throw 'Permission denied (os error 13)';
      files.delete(p);
    },
  };
  return { fs, files };
}
{
  const P = '/data/ro/project.ifc';
  for (const windows of [false, true]) {
    const naam = windows ? 'Windows (alleen-lezen-kenmerk)' : 'Unix (map en bestand alleen-lezen)';
    const { fs, files } = fakeFs({ [P]: { data: OUD, readonly: true } }, windows ? [] : ['/data/ro'], windows);
    const err = await replaceUserFile(fs, P, 'NIEUW').then(() => null, (e: unknown) => e);
    truthy(`1a ${naam}: de weigering komt als fout terug`, /Permission denied|Access is denied/.test(String(err)));
    eq(`1b ${naam}: het doel heeft nog de complete oude inhoud`, files.get(P)?.data, OUD);
    eq(`1c ${naam}: geen halffabricaat achtergebleven`, [...files.keys()].some(p => p.endsWith(USER_FILE_TMP_SUFFIX)), false);
  }
}

// ═══ §1R Dezelfde kern tegen het echte bestandssysteem ═════════════════════════════════════════
// Root negeert bestandsrechten; dan bewijst dit deel niets en slaat het zich over (met een regel).
{
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const isWindows = nodePath.sep === '\\';
  if (isRoot || isWindows) {
    console.log(`   save-failure-status §1R overgeslagen (${isRoot ? 'root negeert bestandsrechten' : 'Windows-rechtenmodel'})`);
  } else {
    const realFs: UserFileFs<string> = {
      lstat: async (p) => {
        const st = nodeFs.lstatSync(p);
        return { isSymlink: st.isSymbolicLink(), nlink: st.nlink, mode: st.mode };
      },
      createNew: async (p, mode) => {
        const fd = nodeFs.openSync(p, 'wx', mode);
        return {
          write: async data => { nodeFs.writeFileSync(fd, data); },
          close: async () => { nodeFs.closeSync(fd); },
        };
      },
      write: async (p, data, mode) => { nodeFs.writeFileSync(p, data, mode === undefined ? {} : { mode }); },
      rename: async (a, b) => { nodeFs.renameSync(a, b); },
      remove: async (p) => { nodeFs.rmSync(p, { force: true }); },
    };
    const root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'ops-alleen-lezen-'));
    try {
      // 1R-a: map en bestand alleen-lezen ⇒ EACCES, doel ongewijzigd, niets ernaast.
      const dir = nodePath.join(root, 'ro');
      nodeFs.mkdirSync(dir);
      const file = nodePath.join(dir, 'project.ifc');
      nodeFs.writeFileSync(file, OUD);
      nodeFs.chmodSync(file, 0o444);
      nodeFs.chmodSync(dir, 0o555);
      const err = await replaceUserFile(realFs, file, 'NIEUW').then(() => null, (e: unknown) => e);
      truthy(`1R-a echte fs, alleen-lezen map: EACCES komt als fout terug (kreeg ${String(err)})`, /EACCES/.test(String(err)));
      eq('1R-b echte fs: het doel heeft nog de complete oude inhoud', nodeFs.readFileSync(file, 'utf8'), OUD);
      eq('1R-c echte fs: geen halffabricaat in de map', nodeFs.readdirSync(dir), ['project.ifc']);
      nodeFs.chmodSync(dir, 0o755);

      // 1R-d (meting, geen poort): alleen het BESTAND alleen-lezen, de map schrijfbaar. Op POSIX mag
      // een rename een alleen-lezen bestand vervangen; de app overschrijft het dan. Zie knownbugs.
      const file2 = nodePath.join(root, 'alleen-bestand.ifc');
      nodeFs.writeFileSync(file2, OUD);
      nodeFs.chmodSync(file2, 0o444);
      const err2 = await replaceUserFile(realFs, file2, 'NIEUW').then(() => null, (e: unknown) => e);
      const inhoud = nodeFs.readFileSync(file2, 'utf8');
      const rechten = (nodeFs.statSync(file2).mode & 0o777).toString(8);
      console.log(`   save-failure-status MEETING 1R-d alleen-lezen bestand in schrijfbare map: fout=${err2 === null ? 'geen' : String(err2)}, inhoud=${inhoud === OUD ? 'oud' : 'NIEUW (overschreven)'}, rechten na afloop=${rechten}`);
    } finally {
      nodeFs.chmodSync(root, 0o755);
      for (const p of nodeFs.readdirSync(root)) { try { nodeFs.chmodSync(nodePath.join(root, p), 0o755); } catch { /* weg */ } }
      nodeFs.rmSync(root, { recursive: true, force: true });
    }
  }
}

// ═══ §2 Tauri via de echte store-actie ═════════════════════════════════════════════════════════
// Een nep-`__TAURI_INTERNALS__` met precies de plugin-commando's die Opslaan/Opslaan als aanroepen.
// Fouten zijn strings, zoals plugin-fs ze echt teruggeeft (`Error` serialiseert naar zijn tekst).
const tauri = {
  files: new Map<string, Entry>(),
  roDirs: [] as string[],
  windows: false,
  dialogAnswer: null as string | null,
  calls: [] as string[],
  handles: new Map<number, Entry>(),
  nextRid: 1,
};
const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/'));
const deniedText = (p: string) => (tauri.windows
  ? `failed to open file at path: ${p} with error: Access is denied. (os error 5)`
  : `failed to open file at path: ${p} with error: Permission denied (os error 13)`);
function installTauri() {
  win.__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, args: AnyRecord, options?: { headers?: Record<string, string> }) => {
      tauri.calls.push(cmd);
      switch (cmd) {
        case 'plugin:dialog|save': return tauri.dialogAnswer;
        case 'plugin:fs|lstat': {
          const e = tauri.files.get(String(args.path));
          if (!e) throw 'No such file or directory (os error 2)';
          return {
            isFile: true, isDirectory: false, isSymlink: false, size: e.data.length, mtime: null, atime: null,
            birthtime: null, readonly: e.readonly, fileAttributes: null, dev: 1, ino: 1,
            mode: 0o100000 | (e.readonly ? 0o444 : 0o644), nlink: 1, uid: 1000, gid: 1000, rdev: 0, blksize: 4096, blocks: 1,
          };
        }
        case 'plugin:fs|open': {
          const p = String(args.path);
          const o = args.options as { createNew?: boolean; write?: boolean; mode?: number };
          if (!o.createNew || !o.write) throw 'exclusieve aanmaak verwacht';
          if (tauri.files.has(p)) throw 'File exists (os error 17)';
          if (tauri.roDirs.includes(dirOf(p))) throw deniedText(p);
          const entry: Entry = { data: '', readonly: o.mode !== undefined && (o.mode & 0o222) === 0 };
          tauri.files.set(p, entry);
          const rid = tauri.nextRid++;
          tauri.handles.set(rid, entry);
          return rid;
        }
        case 'plugin:fs|write': {
          const entry = tauri.handles.get(Number(args.rid));
          if (!entry) throw 'onbekende handle';
          const bytes = args.data as Uint8Array;
          entry.data += new TextDecoder().decode(bytes);
          return bytes.length;
        }
        case 'plugin:resources|close': {
          if (!tauri.handles.delete(Number(args.rid))) throw 'onbekende handle';
          return null;
        }
        case 'plugin:fs|write_text_file': {
          const p = decodeURIComponent(options?.headers?.path ?? '');
          const prev = tauri.files.get(p);
          if (prev?.readonly || (!prev && tauri.roDirs.includes(dirOf(p)))) throw deniedText(p);
          tauri.files.set(p, { data: new TextDecoder().decode(args as unknown as Uint8Array), readonly: false });
          return null;
        }
        case 'plugin:fs|rename': {
          const a = String(args.oldPath);
          const b = String(args.newPath);
          if (tauri.roDirs.includes(dirOf(b))) throw 'Permission denied (os error 13)';
          if (tauri.windows && tauri.files.get(b)?.readonly) throw 'Access is denied. (os error 5)';
          const e = tauri.files.get(a);
          if (!e) throw 'No such file or directory (os error 2)';
          tauri.files.set(b, e);
          tauri.files.delete(a);
          return null;
        }
        case 'plugin:fs|remove': {
          const p = String(args.path);
          if (tauri.roDirs.includes(dirOf(p))) throw 'Permission denied (os error 13)';
          tauri.files.delete(p);
          return null;
        }
        default: throw new Error(`onverwacht Tauri-commando in deze check: ${cmd}`);
      }
    },
    transformCallback: () => 0,
  };
}
const uninstallTauri = () => { delete win.__TAURI_INTERNALS__; };

{
  installTauri();
  const RO = '/home/u/alleen-lezen/project.ifc';
  const RW = '/home/u/werk/project.ifc';

  // 2-controle: een schrijfbaar doel slaagt via dezelfde nep-route (anders bewijzen de rode routes niets).
  tauri.files.set(RW, { data: OUD, readonly: false });
  S().newProject();
  S().setProject({ name: 'Tauri-proef', startDate: '2026-06-01' });
  S().addTask({ name: 'Fundering' });
  useAppStore.setState({ filePath: RW });
  await S().saveFile();
  eq('2-controle schrijfbaar doel: opgeslagen (isDirty false)', S().isDirty, false);
  truthy('2-controle het bestand heeft de nieuwe IFC-inhoud', tauri.files.get(RW)!.data.includes('Fundering'));
  eq('2-controle geen saveFailed', S().ui.notifications.filter((n) => n.messageKey === 'notifications.saveFailed').length, 0);
  truthy('2-controle de route liep via plugin-fs (halffabricaat + rename)',
    tauri.calls.includes('plugin:fs|open') && tauri.calls.includes('plugin:fs|write')
      && tauri.calls.includes('plugin:resources|close') && tauri.calls.includes('plugin:fs|rename'));

  for (const windows of [false, true]) {
    const naam = windows ? 'Windows-kenmerk' : 'Unix-rechten';
    tauri.windows = windows;
    tauri.roDirs = windows ? [] : ['/home/u/alleen-lezen'];
    tauri.files.set(RO, { data: OUD, readonly: true });

    // 2a Opslaan (Ctrl+S) naar een bestaand, alleen-lezen projectbestand.
    S().newDocument();
    S().setProject({ name: `Alleen-lezen ${naam}`, startDate: '2026-06-01' });
    S().addTask({ name: 'Wijziging' });
    useAppStore.setState({ filePath: RO });
    tauri.calls = [];
    await eistMislukt(`2a Tauri Opslaan, ${naam}`, () => S().saveFile(), {
      target: () => tauri.files.get(RO)?.data, targetBefore: OUD, detail: /Permission denied|Access is denied/,
    });
    eq(`2a Tauri Opslaan, ${naam}: geen halffabricaat`, [...tauri.files.keys()].some(p => dirOf(p) === dirOf(RO) && p.endsWith(USER_FILE_TMP_SUFFIX)), false);
    eq(`2a Tauri Opslaan, ${naam}: geen automatische terugvalkiezer`, tauri.calls.includes('plugin:dialog|save'), false);

    // 2b Opslaan als: de gebruiker kiest in de dialoog het alleen-lezen bestand.
    S().newDocument();
    S().addTask({ name: 'Nieuw document' });
    tauri.dialogAnswer = RO;
    await eistMislukt(`2b Tauri Opslaan als, ${naam}`, () => S().saveFileAs(), {
      target: () => tauri.files.get(RO)?.data, targetBefore: OUD, detail: /Permission denied|Access is denied/,
    });

    // 2c De sluitvraag ("Opslaan" in CloseDocumentDialog en bij afsluiten) krijgt `false` terug: dan
    // breekt het sluiten af en blijft het document open.
    useAppStore.setState({ filePath: RO });
    const ok = await S().saveFileForDocument(S().activeDocumentId);
    eq(`2c Tauri sluitvraag-opslaan, ${naam}: meldt false (sluiten breekt af)`, [ok, S().isDirty], [false, true]);
  }
  uninstallTauri();
  tauri.windows = false;
}

// ═══ §3 Web met een bestandshandle ═════════════════════════════════════════════════════════════
type HandleState = {
  data: string; name?: string; permission?: PermissionState;
  writeError?: () => unknown; failAt?: 'createWritable' | 'write' | 'close';
};
const makeHandle = (state: HandleState): FileSystemFileHandle => ({
  kind: 'file',
  name: state.name ?? 'project.ifc',
  isSameEntry: () => Promise.resolve(false),
  getFile: () => Promise.resolve(new File([state.data], state.name ?? 'project.ifc')),
  queryPermission: () => Promise.resolve(state.permission ?? 'granted'),
  requestPermission: () => Promise.resolve(state.permission ?? 'granted'),
  createWritable: async () => {
    const fail = (phase: HandleState['failAt']) => {
      if (state.writeError && (state.failAt ?? 'createWritable') === phase) throw state.writeError();
    };
    fail('createWritable');
    let pending = state.data;
    return {
      write: async (data: string) => { fail('write'); pending = data; },
      close: async () => { fail('close'); state.data = pending; },
    };
  },
} as unknown as FileSystemFileHandle);
let pickerCalls = 0;
let noticesAtPicker: Array<ReturnType<typeof S>['ui']['notifications']> = [];
const installPicker = (answer: () => Promise<FileSystemFileHandle>) => {
  pickerCalls = 0;
  noticesAtPicker = [];
  win.showOpenFilePicker = () => Promise.resolve([]);
  win.showSaveFilePicker = () => {
    pickerCalls++;
    noticesAtPicker.push(S().ui.notifications);
    return answer();
  };
};
const vergrendeld = () => new DOMException('The object can not be modified in this way.', 'NoModificationAllowedError');
const geweigerd = () => new DOMException(
  "Failed to execute 'createWritable' on 'FileSystemFileHandle': The request is not allowed by the user agent or the platform in the current context.",
  'NotAllowedError',
);
{
  // 3a Opslaan naar een handle van een vergrendeld/alleen-lezen bestand. In-place schrijven mislukt;
  // de app meldt de fout VÓÓR de bestandskiezer. Kiest de gebruiker hetzelfde bestand, dan blijft
  // het één melding (ook geen ×2).
  resetWebWriteRefusalForTests();
  const ro: HandleState = { data: OUD, writeError: vergrendeld };
  const handle = makeHandle(ro);
  installPicker(() => Promise.resolve(handle));
  S().newDocument();
  S().addTask({ name: 'Web-wijziging' });
  useAppStore.setState({ filePath: 'project.ifc', fileHandle: handle });
  await eistMislukt('3a web Opslaan, NoModificationAllowedError', () => S().saveFile(), {
    target: () => ro.data, targetBefore: OUD, detail: /can not be modified/,
  });
  eq('3a de app bood na de mislukte in-place-schrijfactie de bestandskiezer aan', pickerCalls, 1);

  eq('3a de fout staat al in het centrale kanaal wanneer de kiezer opent',
    noticesAtPicker[0]?.map((n) => [n.severity, n.messageKey, n.count]), [['error', 'notifications.saveFailed', 1]]);
  eq('3a de terugval werkt dezelfde melding bij', S().ui.notifications[0]?.id, noticesAtPicker[0]?.[0]?.id);

  // 3b Zelfde, maar de gebruiker annuleert de kiezer: fout blijft zichtbaar, niets opgeslagen. De
  // sluitvraag krijgt false, zodat dit gewijzigde document niet alsnog sluit.
  installPicker(() => Promise.reject(new DOMException('The user aborted a request.', 'AbortError')));
  let cancelled: boolean | undefined;
  await eistMislukt('3b web Opslaan, terugval geannuleerd', async () => {
    cancelled = await S().saveFileForDocument(S().activeDocumentId);
  }, { target: () => ro.data, targetBefore: OUD, detail: /can not be modified/ });
  eq('3b annuleren na een mislukte schrijfactie meldt false aan de sluitvraag', cancelled, false);
  eq('3b geen dubbele kiezer', pickerCalls, 1);

  // 3c Opslaan als: de kiezer geeft een alleen-lezen bestand terug.
  installPicker(() => Promise.resolve(makeHandle(ro)));
  S().newDocument();
  S().addTask({ name: 'Web opslaan als' });
  await eistMislukt('3c web Opslaan als, NoModificationAllowedError', () => S().saveFileAs(), {
    target: () => ro.data, targetBefore: OUD, detail: /can not be modified/,
  });

  // 3c2 Ook een andere fout in de terugval vervangt de eerste reden in dezelfde melding.
  const vol: HandleState = { data: OUD, writeError: () => new DOMException('disk full', 'QuotaExceededError') };
  useAppStore.setState({ filePath: 'project.ifc', fileHandle: handle });
  installPicker(() => Promise.resolve(makeHandle(vol)));
  await eistMislukt('3c2 terugval mislukt met een andere reden', () => S().saveFile(), {
    target: () => [ro.data, vol.data], targetBefore: [OUD, OUD], detail: /disk full/,
  });
  truthy('3c2 de eerste reden was al vóór de kiezer zichtbaar', /can not be modified/.test(noticesAtPicker[0]?.[0]?.detail ?? ''));
  eq('3c2 dezelfde melding toont nu de reden van de terugval', S().ui.notifications[0]?.id, noticesAtPicker[0]?.[0]?.id);

  // 3c3 Een geslaagde kopie maakt het document schoon en wordt het volgende opslagdoel. De fout
  // over het origineel blijft staan; geen onterechte algemene uitleg over browserbeperkingen.
  const copy: HandleState = { data: '', name: 'kopie.ifc' };
  const copyHandle = makeHandle(copy);
  installPicker(() => Promise.resolve(copyHandle));
  leegMeldingen();
  const saved = await S().saveFileForDocument(S().activeDocumentId);
  eq('3c3 geslaagde terugval geeft true aan de sluitvraag en wist dirty', [saved, S().isDirty], [true, false]);
  truthy('3c3 de kopie bevat het project', copy.data.includes('Web opslaan als'));
  eq('3c3 het origineel blijft ongewijzigd', ro.data, OUD);
  eq('3c3 alle doelvelden wijzen naar de kopie',
    [S().filePath, S().fileHandle === copyHandle, S().siteFileId, S().siteFileVersion], ['kopie.ifc', true, null, null]);
  const recent = S().recentFiles[0];
  truthy('3c3 Recent wijst naar de kopie', recent?.name === 'kopie.ifc' && recent.ref.kind === 'handle' && recent.ref.handle === copyHandle);
  eq('3c3 alleen de echte fout, geen browserbeperking of dubbele melding',
    S().ui.notifications.map((n) => [n.severity, n.messageKey, n.count]), [['error', 'notifications.saveFailed', 1]]);
  S().addTask({ name: 'Naar de kopie' });
  installPicker(() => Promise.reject(new Error('geen tweede kiezer verwacht')));
  leegMeldingen();
  eq('3c3 volgende Opslaan werkt de kopie direct bij', await S().saveFileForDocument(S().activeDocumentId), true);
  truthy('3c3 de nieuwe wijziging staat in de kopie', copy.data.includes('Naar de kopie'));
  eq('3c3 geen kiezer of melding bij direct opslaan', [pickerCalls, S().ui.notifications.length], [0, 0]);

  // 3c4 Wijzigen terwijl de terugvalkiezer openstaat: de opgeslagen momentopname maakt de latere
  // wijziging niet schoon. Het nieuwe doel wordt wel onthouden voor de volgende Ctrl+S.
  S().addTask({ name: 'Voor de kiezer' });
  useAppStore.setState({ filePath: 'project.ifc', fileHandle: handle });
  installPicker(async () => { S().addTask({ name: 'Tijdens de kiezer' }); return copyHandle; });
  eq('3c4 een wijziging tijdens de terugval geeft false aan de sluitvraag', await S().saveFileForDocument(S().activeDocumentId), false);
  eq('3c4 nieuwe wijziging blijft dirty, kopie is wel het opslagdoel', [S().isDirty, S().fileHandle === copyHandle], [true, true]);
  truthy('3c4 de kopie bevat alleen de momentopname', copy.data.includes('Voor de kiezer') && !copy.data.includes('Tijdens de kiezer'));

  // 3c5 Gewoon annuleren van Opslaan als, zonder eerdere schrijffout: stil en gewijzigd.
  S().newDocument();
  S().addTask({ name: 'Annuleren' });
  installPicker(() => Promise.reject(new DOMException('Geannuleerd', 'AbortError')));
  leegMeldingen();
  await S().saveFileAs();
  eq('3c5 annuleren zonder schrijffout meldt geen fout en wist dirty niet', [S().ui.notifications.length, S().isDirty, S().fileHandle], [0, true, null]);

  // 3d NotAllowedError: de app behandelt dit BEWUST als weigering door de omgeving (embedded webview
  // zonder schrijfrecht; check-web-save-fallback §1 en §7) en levert het project als download, met
  // een uitleg. Dat is geen stille successtatus: het bestand op de oude plek blijft ongewijzigd, de
  // download bevat het project en de melding zegt waar het bestand staat.
  resetWebWriteRefusalForTests();
  const na: HandleState = { data: OUD, writeError: geweigerd };
  const handleNa = makeHandle(na);
  installPicker(() => Promise.resolve(handleNa));
  S().newDocument();
  S().setProject({ name: 'Web geweigerd', startDate: '2026-06-01' });
  S().addTask({ name: 'X' });
  useAppStore.setState({ filePath: 'project.ifc', fileHandle: handleNa });
  downloads.length = 0;
  leegMeldingen();
  await S().saveFile();
  const added3d = S().ui.notifications;
  eq('3d NotAllowedError: geen saveFailed, wel één uitleg (info)', added3d.map((n) => n.severity), ['info']);
  eq('3d de download is gebeurd', downloads.length, 1);
  eq('3d het bestand achter de handle is ongewijzigd', na.data, OUD);
  eq('3d de handle is daarna geen opslagdoel meer (volgende Ctrl+S schrijft niet stil naar de oude plek)', S().fileHandle, null);

  // 3e Het backendcontract bewaart de echte exception uit elke schrijffase; de store kan zo vóór
  // de kiezer melden wat er misging. Geen van deze fouten latcht de omgeving naar downloads.
  resetWebWriteRefusalForTests();
  for (const phase of ['createWritable', 'write', 'close'] as const) {
    for (const name of ['NoModificationAllowedError', 'NotFoundError', 'QuotaExceededError']) {
      const error = new DOMException(`schrijffout ${name}`, name);
      const target: HandleState = { data: OUD, failAt: phase, writeError: () => error };
      const result = await saveToRefWeb({ kind: 'handle', handle: makeHandle(target) }, 'NIEUW').then(() => null, (err: unknown) => err);
      truthy(`3e ${phase}/${name}: dezelfde exception bereikt de aanroeper`, result === error);
      eq(`3e ${phase}/${name}: geen permanente omgevingsweigering`, webWriteRefusedByPlatform(), false);
      eq(`3e ${phase}/${name}: geen gecommitteerde nieuwe inhoud`, target.data, OUD);
    }
  }
  const abort: HandleState = { data: OUD, writeError: () => new DOMException('Geannuleerd', 'AbortError') };
  eq('3e annulering blijft false in het backendcontract', await saveToRefWeb({ kind: 'handle', handle: makeHandle(abort) }, 'NIEUW'), false);
  eq('3e geweigerde toestemming blijft false in het backendcontract', await saveToRefWeb({ kind: 'handle', handle: makeHandle({ data: OUD, permission: 'denied' }) }, 'NIEUW'), false);
  // 3f Na de echte schrijffout kan de terugval alsnog een download worden (SecurityError bij de
  // kiezer). Zowel de eerdere fout als de downloadlocatie worden gemeld; het oude doel vervalt.
  resetBrowserSaveNoticeForTests();
  S().newDocument();
  S().addTask({ name: 'Download na schrijffout' });
  useAppStore.setState({ filePath: 'project.ifc', fileHandle: handle });
  installPicker(() => Promise.reject(new DOMException('Geen gebruikersactivatie', 'SecurityError')));
  downloads.length = 0;
  leegMeldingen();
  eq('3f download-terugval slaagt', await S().saveFileForDocument(S().activeDocumentId), true);
  eq('3f fout en downloadlocatie elk één keer gemeld', S().ui.notifications.map(n => [n.severity, n.messageKey, n.count]),
    [['error', 'notifications.saveFailed', 1], ['info', 'notifications.browserSavesAsDownload', 1]]);
  eq('3f één download, schoon document en geen oude handle', [downloads.length, S().isDirty, S().fileHandle], [1, false, null]);
  eq('3f het oorspronkelijke bestand is nog ongewijzigd', ro.data, OUD);
  resetWebWriteRefusalForTests();
  delete win.showSaveFilePicker;
  delete win.showOpenFilePicker;
}

// ═══ §4 De site ════════════════════════════════════════════════════════════════════════════════
{
  const versions = new Map<string, string[]>([['p1', [OUD]]]);
  let saveCalls = 0;
  const failing = {
    list: async () => [],
    open: async () => { throw { code: 'other', message: 'niet gebruikt' }; },
    save: async () => { saveCalls++; throw { code: 'other', message: 'Geen schrijfrecht op deze map van de site' }; },
    versions: async (id: string) => (versions.get(id) ?? []).map((_, i) => ({ version: `v${i + 1}` })),
  };
  win.openaecHost = { storage: failing };

  // 4a Opslaan als → "Opslaan op de site" → de site weigert.
  resetSiteAskers();
  setSiteSaveAsker(async () => ({ kind: 'site', name: 'Nieuw.ifc' }));
  S().newDocument();
  S().addTask({ name: 'Site' });
  await eistMislukt('4a site Opslaan als, de site weigert', () => S().saveFileAs(), {
    target: () => [...versions.keys()], targetBefore: ['p1'], detail: /Geen schrijfrecht/,
  });
  eq('4a de site kreeg één opslagpoging', saveCalls, 1);

  // 4b Opslaan naar een bestaand site-bestand → de site weigert (aanvulling op check-site-storage G4).
  useAppStore.setState({ filePath: 'Project.ifc', siteFileId: 'p1', siteFileVersion: 'v1' });
  await eistMislukt('4b site Opslaan, de site weigert', () => S().saveFile(), {
    target: () => versions.get('p1'), targetBefore: [OUD], detail: /Geen schrijfrecht/,
  });

  // 4c Een lokale browserhandle faalt vóór de site-vraag; ook als daarna de site weigert blijft
  // het één foutmelding, met de reden van die laatste poging en zonder opslagstatus te wijzigen.
  S().newDocument();
  S().addTask({ name: 'Lokale kopie naar de site' });
  const local: HandleState = { data: OUD, writeError: vergrendeld };
  useAppStore.setState({ filePath: 'project.ifc', fileHandle: makeHandle(local) });
  let firstNoticeId: string | undefined;
  setSiteSaveAsker(async () => {
    firstNoticeId = S().ui.notifications[0]?.id;
    eq('4c de echte handle-fout staat al vóór de site-vraag in het kanaal',
      S().ui.notifications.map(n => [n.messageKey, n.detail]), [['notifications.saveFailed', vergrendeld().message]]);
    return { kind: 'site', name: 'Kopie.ifc' };
  });
  await eistMislukt('4c handle-fout gevolgd door sitefout', () => S().saveFile(), {
    target: () => [local.data, versions.get('p1')], targetBefore: [OUD, [OUD]], detail: /Geen schrijfrecht/,
  });
  eq('4c de sitefout vervangt dezelfde melding', S().ui.notifications[0]?.id, firstNoticeId);
  resetSiteAskers();
  delete win.openaecHost;
}

if (diffs.length === 0) {
  console.log(`OK  save-failure-status: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  save-failure-status: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
