// Veilig opslaan van een GEBRUIKERSbestand (Opslaan, Opslaan als, automatisch opslaan, export) —
// headless tegen een nep-fs én de echte Node-fs via de plugin-JS-client; geen Tauri-runtime.
//
// Waarom deze batterij bestaat. `saveToRefTauri` en de opslaan-als-kiezers schreven met een kale
// `writeTextFile`/`writeFile`. plugin-fs opent het doel met `truncate: true` en schrijft daarna
// (tauri-plugin-fs 2.5.0 tot en met 2.7.1, commands.rs `write_file_inner`), dus een volle schijf, I/O-fout of crash
// midden in die write liet het projectbestand van de gebruiker leeg of afgekapt achter. De nep-fs
// hieronder doet precies dat: `write` truncate't eerst en kan daarna "vol raken".
//
// Draaien: bundel met esbuild zoals run.sh dat doet en start met node. Exit 0 = alles groen.
import {
  readFileSync, mkdtempSync, mkdirSync, writeFileSync, readlinkSync, symlinkSync, linkSync, lstatSync, readdirSync, rmSync, chmodSync, unlinkSync,
  existsSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { installNodeFileIpc, realPath, writeFileCall as fileWrite } from './nodeFileIpc';
import { basename, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  replaceUserFile, isForbiddenPathError, OwnFileWriteError, USER_FILE_TMP_SUFFIX, writeUserTextFileTauri, writeUserFileTauri,
  createOwnTemp, tauriUserBytesFs, USER_FILE_CHUNK_BYTES, WRITE_AFTER_CREATE_ERROR,
  type UserFileFs,
} from '@/services/fileAccess/atomicWrite';
import { compareFilePaths, type FileIdentityInfo, type FileIdentityFs } from '@/services/fileAccess/fileIdentity';

declare const process: { exit(code: number): never; umask(): number; getuid?(): number };

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const truthy = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

interface Entry { data: string; mode: number; link?: 'sym' | 'hard' }

/** Nep-fs met de truncate-then-write-semantiek van plugin-fs. */
function fakeFs(initial: Record<string, Entry>) {
  const files = new Map<string, Entry>(Object.entries(initial));
  const calls: string[] = [];
  const opts = {
    /** Paden waarvoor schrijven een scope-weigering geeft. */
    forbidden: new Set<string>(),
    /** Na zoveel tekens raakt de schijf vol (per write). */
    diskFullAfter: null as number | null,
    renameFails: false,
    createError: null as unknown,
    /** Schrijffout ná een geslaagde aanmaak (de adapter meldt dat als `OwnFileWriteError`). */
    writeAfterCreateError: null as unknown,
    forbidTemps: false,
  };
  const temps: string[] = [];
  const fs: UserFileFs<string> = {
    lstat: async (p) => {
      calls.push(`lstat ${p}`);
      const e = files.get(p);
      if (!e) throw new Error(`No such file or directory: ${p}`);
      return { isSymlink: e.link === 'sym', nlink: e.link === 'hard' ? 2 : 1, mode: 0o100000 | e.mode };
    },
    createNew: async (p, data, mode) => {
      calls.push(`createNew ${p}${mode === undefined ? '' : ` mode=${mode.toString(8)}`}`);
      temps.push(p);
      if (opts.forbidTemps || opts.forbidden.has(p)) throw `forbidden path: ${p}`;
      if (opts.createError !== null) throw opts.createError;
      if (files.has(p)) throw new Error('File exists (os error 17)');
      const entry: Entry = { data: '', mode: mode ?? 0o644 };
      files.set(p, entry);
      if (opts.writeAfterCreateError !== null) throw new OwnFileWriteError(opts.writeAfterCreateError);
      if (opts.diskFullAfter !== null && data.length > opts.diskFullAfter) {
        entry.data = data.slice(0, opts.diskFullAfter);
        throw new OwnFileWriteError(new Error('No space left on device (os error 28)'));
      }
      entry.data = data;
    },
    write: async (p, data, mode) => {
      calls.push(`write ${p}${mode === undefined ? '' : ` mode=${mode.toString(8)}`}`);
      if (opts.forbidden.has(p)) {
        throw `forbidden path: ${p}, maybe it is not allowed on the scope for \`allow-write-text-file\` permission in your capability file`;
      }
      const prev = files.get(p);
      const entry: Entry = { data: '', mode: mode ?? prev?.mode ?? 0o644, link: prev?.link };
      files.set(p, entry); // truncate: de oude inhoud is vanaf hier weg
      if (opts.diskFullAfter !== null && data.length > opts.diskFullAfter) {
        entry.data = data.slice(0, opts.diskFullAfter);
        throw new Error('No space left on device (os error 28)');
      }
      entry.data = data;
    },
    rename: async (a, b) => {
      calls.push(`rename ${a} -> ${b}`);
      if (opts.renameFails) throw new Error('Access is denied. (os error 5)');
      const e = files.get(a);
      if (!e) throw new Error(`No such file or directory: ${a}`);
      files.set(b, { ...e, link: undefined });
      files.delete(a);
    },
    remove: async (p) => {
      calls.push(`remove ${p}`);
      if (opts.forbidden.has(p)) throw `forbidden path: ${p}`;
      files.delete(p);
    },
  };
  return { fs, files, calls, opts, temps };
}

const P = '/home/u/project.ifc';
const TMP = P + USER_FILE_TMP_SUFFIX;
const OUD = 'OUD-PROJECT-COMPLEET';
const NIEUW = 'NIEUW-PROJECT-COMPLEET';

// 1. Normaal vervangen: via het halffabricaat, en er blijft niets naast staan.
{
  const { fs, files, calls, temps } = fakeFs({ [P]: { data: OUD, mode: 0o600 } });
  await replaceUserFile(fs, P, NIEUW);
  eq('1a het doel heeft de nieuwe inhoud', files.get(P)?.data, NIEUW);
  eq('1b geen halffabricaat achtergebleven', [...files.keys()], [P]);
  truthy('1c het doel zelf is nooit direct beschreven', !calls.includes(`write ${P}`));
  truthy('1d het halffabricaat kreeg de rechten van het origineel (0600)', calls.includes(`createNew ${temps[0]} mode=600`));
  eq('1e en het vervangen bestand houdt die rechten', files.get(P)?.mode, 0o600);
}

// 2. De kern van de fix: de schijf raakt vol tijdens het schrijven.
{
  const { fs, files, opts } = fakeFs({ [P]: { data: OUD, mode: 0o644 } });
  opts.diskFullAfter = 5;
  const err = await replaceUserFile(fs, P, NIEUW).then(() => null, (e: unknown) => e);
  truthy('2a een volle schijf komt als fout terug', err instanceof Error && /No space left/.test(err.message));
  eq('2b het projectbestand is daarna nog het complete oude bestand', files.get(P)?.data, OUD);
  eq('2c het halve halffabricaat is opgeruimd', [...files.keys()], [P]);
}

// 2'. Ter vergelijking: exact wat de oude code deed (kale write op het doel) — het bestand is stuk.
{
  const { fs, files, opts } = fakeFs({ [P]: { data: OUD, mode: 0o644 } });
  opts.diskFullAfter = 5;
  await fs.write(P, NIEUW).catch(() => undefined);
  eq('2d (oude route) een kale write op het doel laat een afgekapt bestand achter', files.get(P)?.data, NIEUW.slice(0, 5));
}

// 3. Buiten de scope (map buiten $HOME, alleen het bestand zelf vrijgegeven): terugval op direct.
{
  const Q = '/mnt/netwerk/project.ifc';
  const { fs, files, opts } = fakeFs({ [Q]: { data: OUD, mode: 0o644 } });
  opts.forbidTemps = true;
  await replaceUserFile(fs, Q, NIEUW);
  eq('3a zonder recht op een halffabricaat wordt er gewoon opgeslagen', files.get(Q)?.data, NIEUW);
  eq('3b en er staat niets naast', [...files.keys()], [Q]);
  truthy('3c isForbiddenPathError herkent de plugin-fs-tekst',
    isForbiddenPathError('forbidden path: /x, maybe it is not allowed on the scope')
      && isForbiddenPathError(new Error('forbidden path: /x'))
      && !isForbiddenPathError(new Error('No space left on device (os error 28)')));
}

// 4. Vervangen geweigerd (Windows: doel geopend zonder deel-toegang): terugval op direct.
{
  const { fs, files, opts } = fakeFs({ [P]: { data: OUD, mode: 0o644 } });
  opts.renameFails = true;
  await replaceUserFile(fs, P, NIEUW);
  eq('4a opslaan lukt zoals vroeger', files.get(P)?.data, NIEUW);
  eq('4b het halffabricaat is opgeruimd', [...files.keys()], [P]);
}

// 5. Links: nooit vervangen, want dat zou de link breken.
for (const link of ['sym', 'hard'] as const) {
  const { fs, files, calls } = fakeFs({ [P]: { data: OUD, mode: 0o644, link } });
  await replaceUserFile(fs, P, NIEUW);
  eq(`5 ${link}link: direct beschreven`, files.get(P)?.data, NIEUW);
  eq(`5 ${link}link: de link blijft een link`, files.get(P)?.link, link);
  truthy(`5 ${link}link: geen halffabricaat en geen rename`, !calls.some(c => c.startsWith('rename') || c.startsWith('createNew')) && !files.has(TMP));
}

// 6. Opslaan als naar een nieuwe naam (lstat faalt): gewoon via het halffabricaat.
{
  const N = '/home/u/nieuw.ifc';
  const { fs, files } = fakeFs({});
  await replaceUserFile(fs, N, NIEUW);
  eq('6 een nieuw bestand wordt aangemaakt', files.get(N)?.data, NIEUW);
  eq('6b zonder resten', [...files.keys()], [N]);
}

// De zelfstandige naam blijft naast het gekozen doel: Windows-drive, UNC en een POSIX-naam
// met een letterlijke backslash. Dit deel toetst padtekst; echte OS-creatie staat in deel 7.
for (const [target, directory] of [
  ['C:\\werk\\project.ifc', 'C:\\werk\\'],
  ['\\\\server\\share\\project.ifc', '\\\\server\\share\\'],
  ['/home/u/lang\\bestand.ifc', '/home/u/'],
]) {
  const { fs, files, temps } = fakeFs({});
  await replaceUserFile(fs, target, NIEUW);
  eq(`6 pad ${target}: complete uitvoer zonder resten`, [...files.keys()], [target]);
  truthy(`6 pad ${target}: korte zelfstandige naam in de gekozen map`, temps.length === 1
    && temps[0].startsWith(directory) && !/[\\/]/.test(temps[0].slice(directory.length))
    && temps[0].length - directory.length < 80);
}

// 6a. Een fout vóór de exclusieve aanmaak geeft geen eigendom; nooit opruimen/direct terugvallen.
for (const error of [new Error('File exists (os error 17)'), new Error('Permission denied (os error 13)')]) {
  const { fs, files, calls, opts } = fakeFs({ [P]: { data: OUD, mode: 0o600 } });
  opts.createError = error;
  truthy('6a de aanmaakfout komt ongewijzigd terug', await replaceUserFile(fs, P, NIEUW).catch(e => e) === error);
  eq('6a het doel is nog compleet', files.get(P)?.data, OUD);
  truthy('6a geen cleanup, rename of directe write na mislukte aanmaak',
    !calls.some(c => /^(remove|rename|write) /.test(c)));
}
// Ook een scope-achtige schrijffout ná aanmaak mag geen directe truncate op het doel veroorzaken.
{
  const { fs, files, opts } = fakeFs({ [P]: { data: OUD, mode: 0o600 } });
  opts.writeAfterCreateError = new Error('forbidden path: schrijven mislukt');
  const err = await replaceUserFile(fs, P, NIEUW).catch(e => e);
  truthy('6b de schrijffout blijft een fout', err === opts.writeAfterCreateError);
  eq('6b doel ongewijzigd, eigen halffabricaat opgeruimd', [...files.entries()], [[P, { data: OUD, mode: 0o600 }]]);
}

// 7. ECHTE filesystemgevallen voor CI, door de echte Tauri-JS-adapter voor zowel tekst als bytes.
// De IPC-rand gebruikt Node-fs: geen Tauri-runtime of capabilitybewijs. Fouten worden
// geïnjecteerd; creatie met O_EXCL, links, inodebehoud en rename draaien op het CI-OS.
/** De eigen exclusieve aanmaak van het tijdelijke bestand (`createNew`, met de inhoud erin). */
const created = (c: { command: string; options?: { createNew?: boolean } }) => fileWrite(c) && c.options?.createNew === true;
/** De terugval die het doel zelf afkapt en beschrijft. */
const direct = (c: { command: string; options?: { createNew?: boolean; append?: boolean } }) =>
  fileWrite(c) && !c.options?.createNew && !c.options?.append;
for (const kind of ['text', 'bytes'] as const) {
  const root = mkdtempSync(join(tmpdir(), 'ops-user-write-'));
  const ipc = installNodeFileIpc();
  const payload = kind === 'text' ? new TextEncoder().encode('NIEUW – bouw 🏗\u0000 einde') : new Uint8Array([0, 255, 128, 1, 13, 10, 254, 42]);
  const save = (p: string) => kind === 'text'
    ? writeUserTextFileTauri(p, new TextDecoder().decode(payload)) : writeUserFileTauri(p, payload);
  const source = join(root, 'bron.ifc');
  const target = join(root, 'kopie.ifc');
  const legacy = target + USER_FILE_TMP_SUFFIX;
  const read = (p: string) => [...readFileSync(p)];
  const reset = () => {
    for (const p of readdirSync(root)) rmSync(join(root, p), { force: true, recursive: true });
    writeFileSync(source, OUD);
    ipc.calls.length = 0;
  };
  try {
    const cases = sep === '\\' ? ['missing', 'file'] : ['missing', 'file', 'symlink', 'hardlink', 'dangling'];
    for (const preplaced of cases) {
      reset();
      if (preplaced === 'file') writeFileSync(legacy, 'ANDERMANS TMP');
      if (preplaced === 'symlink') symlinkSync(source, legacy);
      if (preplaced === 'hardlink') linkSync(source, legacy);
      if (preplaced === 'dangling') symlinkSync(join(root, 'bestaat-niet.ifc'), legacy);
      const before = preplaced === 'missing' ? null : lstatSync(legacy);
      await save(target);
      eq(`7 ${kind}/${preplaced}: bron compleet`, readFileSync(source, 'utf8'), OUD);
      eq(`7 ${kind}/${preplaced}: uitvoer exact`, read(target), [...payload]);
      eq(`7 ${kind}/${preplaced}: alleen uitvoer erbij, geen eigen resten`, readdirSync(root).sort(),
        ['bron.ifc', 'kopie.ifc', ...(before ? ['kopie.ifc' + USER_FILE_TMP_SUFFIX] : [])].sort());
      if (before) {
        const after = lstatSync(legacy);
        eq(`7 ${kind}/${preplaced}: vooraf bestaand tmp-inode behouden`, [after.dev, after.ino], [before.dev, before.ino]);
        if (preplaced === 'symlink' || preplaced === 'dangling') {
          eq(`7 ${kind}/${preplaced}: link zelf behouden`, readlinkSync(legacy), preplaced === 'symlink' ? source : join(root, 'bestaat-niet.ifc'));
        } else eq(`7 ${kind}/${preplaced}: oude tmp-inhoud behouden`, readFileSync(legacy, 'utf8'), preplaced === 'file' ? 'ANDERMANS TMP' : OUD);
      }
      const opened = ipc.calls.filter(created);
      truthy(`7 ${kind}/${preplaced}: verse naam exclusief aangemaakt`, opened.length === 1 && opened[0].path !== legacy);
      truthy(`7 ${kind}/${preplaced}: aangemaakt en geschreven vóór rename`, ipc.calls.findIndex(created)
        < ipc.calls.findIndex(c => c.command === 'plugin:fs|rename'));
      eq(`7 ${kind}/${preplaced}: geen open handles`, ipc.openHandles(), 0);
    }

    // Proef 1 (rauwe bytes): elke aanroep die bytes meegeeft, geeft ze als kale Uint8Array (rauwe body).
    // In een object maakt Tauri er JSON van met één getal per byte (`process-ipc-message-fn.js`).
    // Het eigen tijdelijke bestand ontstaat met createNew en de modus van het oude bestand, met de
    // inhoud in dezelfde aanroep (één open bestand, zoals de handle hiervoor).
    {
      reset();
      writeFileSync(target, OUD, { mode: 0o640 });
      await save(target);
      eq(`7 ${kind}/rauw: uitvoer exact`, read(target), [...payload]);
      truthy(`7 ${kind}/rauw: geen bytes in een object naar Tauri`, !ipc.calls.some(c => c.bytesInObject));
      truthy(`7 ${kind}/rauw: geen handle-route`, !ipc.calls.some(c => c.command === 'plugin:fs|open' || c.command === 'plugin:fs|write'));
      const made = ipc.calls.filter(created);
      truthy(`7 ${kind}/rauw: eigen tijdelijk bestand exclusief aangemaakt met de inhoud als rauwe body`, made.length === 1
        && made[0].rawBody && dirname(made[0].path!) === root && made[0].path !== target && !made[0].options?.append);
      if (sep !== '\\') eq(`7 ${kind}/rauw: modus van het oude bestand gaat mee`, made[0]?.options?.mode, 0o640);
      eq(`7 ${kind}/rauw: precies die ene schrijfaanroep, dan één rename naar het doel`,
        ipc.calls.filter(c => fileWrite(c) || c.command === 'plugin:fs|rename').map(c => c.command),
        [made[0]?.command, 'plugin:fs|rename']);
    }

    // R1: 236 ASCII-a's + .ifc = 240 bytes; het oude vaste tmp paste met 253 bytes nog op
    // Ext4. Een id achter de hele doelnaam overschreed 255 bytes. Echte CI-fs onder HOME,
    // zowel nieuw exportdoel als bestaand opslagdoel; nooit terugvallen op het oude tmp.
    if (sep !== '\\') {
      const longRoot = mkdtempSync(join(homedir(), 'ops-long-save-'));
      const longName = `${'a'.repeat(236)}.ifc`;
      const longTarget = join(longRoot, longName);
      const oldTemp = longTarget + USER_FILE_TMP_SUFFIX;
      try {
        eq(`7 ${kind}/lange naam: doel heeft 240 bytes`, new TextEncoder().encode(longName).length, 240);
        writeFileSync(oldTemp, 'ANDERMANS LANG TMP');
        for (const existing of [false, true]) {
          if (existing) writeFileSync(longTarget, OUD);
          ipc.calls.length = 0;
          await save(longTarget);
          eq(`7 ${kind}/lange naam/${existing}: uitvoer exact`, read(longTarget), [...payload]);
          eq(`7 ${kind}/lange naam/${existing}: oud tijdelijk bestand intact`, readFileSync(oldTemp, 'utf8'), 'ANDERMANS LANG TMP');
          const opens = ipc.calls.filter(created);
          truthy(`7 ${kind}/lange naam/${existing}: korte basename in dezelfde map exclusief aangemaakt`, opens.length === 1
            && opens[0].path !== undefined && dirname(opens[0].path) === longRoot
            && new TextEncoder().encode(basename(opens[0].path)).length < 80);
          truthy(`7 ${kind}/lange naam/${existing}: geen directe terugval`, !ipc.calls.some(direct));
          eq(`7 ${kind}/lange naam/${existing}: alleen doel en oud tmp, geen handles`,
            [readdirSync(longRoot).sort(), ipc.openHandles()], [[longName, longName + USER_FILE_TMP_SUFFIX], 0]);
        }
      } finally {
        rmSync(longRoot, { recursive: true, force: true });
      }
    }

    // Botsing juist op de verse naam: echte EEXIST, ook bij een link die naar de bron wijst.
    for (const collision of (sep === '\\' ? ['file'] : ['file', 'symlink', 'dangling', 'directory'])) {
      reset();
      writeFileSync(target, OUD);
      let collided = '';
      ipc.faults.beforeOpen = p => {
        collided = p;
        if (collision === 'symlink') symlinkSync(source, p);
        else if (collision === 'dangling') symlinkSync(join(root, 'bestaat-niet.ifc'), p);
        else if (collision === 'directory') mkdirSync(p);
        else writeFileSync(p, 'ANDERMANS VERS PAD');
      };
      const err = await save(target).catch(e => e);
      ipc.faults.beforeOpen = null;
      truthy(`7 ${kind}/${collision}: echte aanmaakbotsing gemeld`, /EEXIST/.test(String(err)));
      eq(`7 ${kind}/${collision}: bron en doel ongewijzigd`, [readFileSync(source, 'utf8'), readFileSync(target, 'utf8')], [OUD, OUD]);
      truthy(`7 ${kind}/${collision}: botsend object bestaat nog`, !!collided && !!lstatSync(collided, { throwIfNoEntry: false }));
      const still = !!collided && !!lstatSync(collided, { throwIfNoEntry: false });
      if (collision === 'file') eq(`7 ${kind}/botsing: bestandinhoud behouden`, still && readFileSync(collided, 'utf8'), 'ANDERMANS VERS PAD');
      if (collision === 'symlink') eq(`7 ${kind}/botsing: bronlink behouden`, still && readlinkSync(collided), source);
      truthy(`7 ${kind}/${collision}: alleen de ene geweigerde aanmaak; geen schrijven, rename of cleanup na botsing`,
        ipc.calls.filter(fileWrite).length === 1 && ipc.calls.filter(created).length === 1
        && !ipc.calls.some(c => ['plugin:fs|write', 'plugin:fs|rename', 'plugin:fs|remove'].includes(c.command)));
    }

    // Fouten na geslaagde aanmaak: het originele doel blijft staan; alleen ons eigen pad opruimen.
    // plugin-fs schrijft met write_all en sluit binnen dezelfde aanroep: korte writes en een aparte
    // sluitfout bestaan op deze route niet meer; een schijffout halverwege wel.
    for (const failure of ['write', 'cleanup'] as const) {
      reset();
      writeFileSync(target, OUD, { mode: 0o600 });
      writeFileSync(legacy, 'ANDERMANS TMP');
      ipc.faults.writeErrorAfter = 5;
      ipc.faults.removeError = failure === 'cleanup' ? new Error('cleanup mislukt') : null;
      const err = await save(target).catch(e => e);
      truthy(`7 ${kind}/${failure}: de juiste fout komt terug`, /No space left/.test(String(err)));
      eq(`7 ${kind}/${failure}: oorspronkelijke inhoud behouden`, readFileSync(target, 'utf8'), OUD);
      eq(`7 ${kind}/${failure}: ander tmp behouden`, readFileSync(legacy, 'utf8'), 'ANDERMANS TMP');
      eq(`7 ${kind}/${failure}: resten alleen bij geweigerde cleanup`, readdirSync(root).length, failure === 'cleanup' ? 4 : 3);
      truthy(`7 ${kind}/${failure}: geen rename of directe terugval`, !ipc.calls.some(c => c.command === 'plugin:fs|rename' || direct(c)));
      eq(`7 ${kind}/${failure}: handle gesloten`, ipc.openHandles(), 0);
    }
    ipc.faults.writeErrorAfter = null;
    ipc.faults.removeError = null;

    for (const fallback of ['scope', 'rename', 'rename-and-cleanup'] as const) {
      reset();
      writeFileSync(target, OUD);
      writeFileSync(legacy, 'ANDERMANS TMP');
      // Scope: buiten $HOME geeft de kiezer alleen het gekozen bestand vrij, niet een tijdelijk bestand ernaast.
      ipc.faults.forbidden = fallback === 'scope' ? (p => p !== target) : null;
      ipc.faults.renameError = fallback === 'scope' ? null : new Error('rename geweigerd');
      ipc.faults.removeError = fallback === 'rename-and-cleanup' ? new Error('cleanup geweigerd') : null;
      await save(target);
      eq(`7 ${kind}/${fallback}: directe terugval heeft exacte uitvoer`, read(target), [...payload]);
      eq(`7 ${kind}/${fallback}: oude tmp behouden`, readFileSync(legacy, 'utf8'), 'ANDERMANS TMP');
      eq(`7 ${kind}/${fallback}: alleen eigen rest bij cleanupfout`, readdirSync(root).length, fallback === 'rename-and-cleanup' ? 4 : 3);
      if (fallback === 'scope') truthy(`7 ${kind}/scope: niets opgeruimd`, !ipc.calls.some(c => c.command === 'plugin:fs|remove'));
    }
    ipc.faults.forbidden = null;
    ipc.faults.removeError = null;

    reset();
    writeFileSync(target, OUD);
    ipc.faults.directWriteError = new Error('direct schrijven geweigerd');
    const fallbackError = await save(target).catch(e => e);
    truthy(`7 ${kind}/rename+direct: schrijffout doorgegeven`, fallbackError === ipc.faults.directWriteError);
    eq(`7 ${kind}/rename+direct: doel compleet, eigen tmp weg`, [readFileSync(target, 'utf8'), readdirSync(root).sort()], [OUD, ['bron.ifc', 'kopie.ifc']]);
    ipc.faults.directWriteError = null;
    ipc.faults.renameError = null;

    // Knownbug 1797 (plugin-fs 2.7.0): de map van het bestand is een link naar buiten de scope, zoals
    // `~/projecten` → `/data/projecten`. `root` staat hier voor `$HOME/**`. De dialoog gaf het gekozen
    // bestand vrij (Tauri neemt ook zijn echte vorm op), het halffabricaat ernaast niet, en 2.7.1 toetst
    // de toestemming op het echte pad (de map van een nieuw bestand opgelost). Opslaan valt dan terug op
    // direct schrijven; 2.5.0 toetste de tekst en schreef het halffabricaat buiten de scope. Een link
    // binnen de scope houdt het halffabricaat.
    if (sep !== '\\') {
      const buiten = mkdtempSync(join(tmpdir(), 'ops-user-write-buiten-'));
      try {
        for (const link of ['buiten', 'binnen'] as const) {
          reset();
          const echteMap = link === 'buiten' ? buiten : join(root, 'echt');
          if (link === 'binnen') mkdirSync(echteMap);
          const map = join(root, 'projecten');
          symlinkSync(echteMap, map);
          const gekozen = join(map, 'plan.ifc');
          writeFileSync(gekozen, OUD);
          const wortel = `${realPath(root)}/`;
          const vrijgegeven = realPath(gekozen);
          ipc.faults.forbidden = p => { const echt = realPath(p); return echt !== vrijgegeven && !echt.startsWith(wortel); };
          await save(gekozen);
          eq(`7 ${kind}/link ${link}: uitvoer exact`, read(gekozen), [...payload]);
          eq(`7 ${kind}/link ${link}: geen resten in de echte map`, readdirSync(echteMap), ['plan.ifc']);
          // Per schrijfaanroep: exclusieve aanmaak of directe terugval, en of er werkelijk geschreven is.
          const route = ipc.calls.filter(c => fileWrite(c) || c.command === 'plugin:fs|rename' || c.command === 'plugin:fs|remove')
            .map(c => fileWrite(c) ? `${created(c) ? 'createNew' : direct(c) ? 'direct' : 'anders'}:${c.wrote ? 'geschreven' : 'geweigerd'}` : c.command);
          eq(`7 ${kind}/link ${link}: route`, route, link === 'buiten'
            ? ['createNew:geweigerd', 'direct:geschreven'] : ['createNew:geschreven', 'plugin:fs|rename']);
        }
      } finally {
        ipc.faults.forbidden = null;
        rmSync(buiten, { recursive: true, force: true });
      }
    }

    reset();
    writeFileSync(target, OUD);
    if (kind === 'text') await writeUserTextFileTauri(target, '');
    else await writeUserFileTauri(target, new Uint8Array());
    eq(`7 ${kind}/leeg: oude inhoud volledig vervangen`, read(target), []);
    eq(`7 ${kind}/leeg: geen resten of handles`, [readdirSync(root).sort(), ipc.openHandles()], [['bron.ifc', 'kopie.ifc'], 0]);

    if (sep !== '\\') {
      reset();
      writeFileSync(target, OUD, { mode: 0o600 });
      await save(target);
      eq(`7 ${kind}/mode: aanmaakmode 0600 begrensd door de CI-umask`, lstatSync(target).mode & 0o777, 0o600 & ~process.umask());
      eq(`7 ${kind}/mode: uitvoer compleet`, read(target), [...payload]);
      // Knownbug 162 blijft zoals hij is: een alleen-lezen bestand in een schrijfbare map wordt vervangen
      // en blijft 0444. Aanmaken en schrijven in één aanroep; een tweede opening van het 0444-halffabricaat
      // zou (behalve als root) met EACCES falen en de opslag laten mislukken.
      reset();
      writeFileSync(target, OUD, { mode: 0o444 });
      eq(`7 ${kind}/mode 0444: opslaan slaagt`, String(await save(target).then(() => '', (e: unknown) => e)), '');
      eq(`7 ${kind}/mode 0444: uitvoer compleet, zoals vóór de rauwe route`, read(target), [...payload]);
      eq(`7 ${kind}/mode 0444: blijft alleen-lezen`, lstatSync(target).mode & 0o777, 0o444 & ~process.umask());
      eq(`7 ${kind}/mode 0444: geen resten`, readdirSync(root).sort(), ['bron.ifc', 'kopie.ifc']);
      // Ook doel-links blijven direct beschreven: link en alle andere namen behouden hun inode.
      for (const link of ['symlink', 'hardlink']) {
        reset();
        if (link === 'symlink') symlinkSync(source, target); else linkSync(source, target);
        const before = lstatSync(target);
        await save(target);
        eq(`7 ${kind}/${link}doel: bron bijgewerkt`, read(source), [...payload]);
        eq(`7 ${kind}/${link}doel: link-inode behouden`, lstatSync(target).ino, before.ino);
        truthy(`7 ${kind}/${link}doel: geen tijdelijke aanmaak`, !ipc.calls.some(c => c.command === 'plugin:fs|open' || created(c)));
      }
    }
    reset();
    await Promise.all([save(target), kind === 'text' ? writeUserTextFileTauri(target, 'TWEEDE') : writeUserFileTauri(target, new Uint8Array([9, 8]))]);
    const temps = ipc.calls.filter(created).map(c => c.path);
    eq(`7 ${kind}/gelijktijdig: twee eigen tijdelijke paden`, new Set(temps).size, 2);
    truthy(`7 ${kind}/gelijktijdig: één complete save op het doel`, [J([...payload]), J(kind === 'text' ? [...new TextEncoder().encode('TWEEDE')] : [9, 8])].includes(J(read(target))));
    eq(`7 ${kind}/gelijktijdig: geen resten/handles`, [readdirSync(root).sort(), ipc.openHandles()], [['bron.ifc', 'kopie.ifc'], 0]);
  } finally {
    ipc.dispose();
    rmSync(root, { recursive: true, force: true });
  }
}

// 8. Elke Tauri-schrijfroute naar een gebruikersbestand loopt via de veilige route, niet via een
//    kale `writeTextFile(`/`writeFile(` (die faalde op de code vóór deze fix).
{
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) => readFileSync(join(here, '..', '..', 'src', rel), 'utf8');
  const backend = read('services/fileAccess/tauriBackend.ts');
  truthy('8a tauriBackend: geen kale writeTextFile( of writeFile(', !/\b(writeTextFile|writeFile)\(/.test(backend));
  // #804 stap 6: tekst en bytes gaan door één hulp met de laatste controle (`writeUserFileTauri`).
  truthy('8b tauriBackend: Opslaan, Opslaan als en export via writeUserFileTauri',
    (backend.match(/writeUserFileTauri\(/g) ?? []).length >= 2);
  const fileTools = read('services/mcp/tools/fileTools.ts');
  truthy('8c MCP export_ifc (overwrite) via writeUserTextFileTauri', fileTools.includes('writeUserTextFileTauri(')
    && !/\bwriteTextFile\(p,/.test(fileTools));
}

// 8. Identiteitsbewaking vóór een stille MCP-export. `stat` volgt links; de fixture beschrijft
//    daarom OS-objecten (dev+ino), niet de tekst van een pad of de bytes van een bestand.
{
  const source = '/volume/Model.ifc';
  const entries = new Map<string, FileIdentityInfo>([
    [source, { isFile: true, dev: 1, ino: 20 }],
    ['/volume/model.ifc', { isFile: true, dev: 1, ino: 21 }], // case-sensitive: ander bestand
    ['/volume/link.ifc', { isFile: true, dev: 1, ino: 20 }],
    ['/volume/maplink/Model.ifc', { isFile: true, dev: 1, ino: 20 }],
    ['/ander-volume/Model.ifc', { isFile: true, dev: 2, ino: 20 }],
  ]);
  const fs: FileIdentityFs = {
    stat: async path => {
      const entry = entries.get(path);
      if (!entry) throw `failed to get metadata of path: ${path} with error: No such file or directory (os error 2)`;
      return entry;
    },
  };
  eq('8a hetzelfde pad is hetzelfde bestand', await compareFilePaths(fs, source, source), 'same');
  eq('8b twee bestaande case-sensitive namen zijn verschillend',
    await compareFilePaths(fs, '/volume/model.ifc', source), 'different');
  for (const alias of ['/volume/link.ifc', '/volume/maplink/Model.ifc']) {
    eq(`8c ${alias} volgt de bronidentiteit`, await compareFilePaths(fs, alias, source), 'same');
  }
  entries.set('/volume/model.ifc', entries.get(source)!); // case-insensitive: hetzelfde OS-object
  eq('8d een case-alias met dezelfde identiteit is hetzelfde bestand',
    await compareFilePaths(fs, '/volume/model.ifc', source), 'same');
  eq('8e hetzelfde inode-nummer op een ander device is een ander bestand',
    await compareFilePaths(fs, '/ander-volume/Model.ifc', source), 'different');
  eq('8f een nieuw exportpad is vrij zonder metadata van een mogelijk ontoegankelijke bron',
    await compareFilePaths(fs, '/volume/nieuw.ifc', '/ontoegankelijk/bron.ifc'), 'different');
  const missingAsError: FileIdentityFs = { stat: async () => {
    throw new Error('failed to get metadata of path: /volume/nieuw.ifc with error: No such file or directory (os error 2)');
  } };
  eq('8f een Error met ENOENT wordt net als de native string als nieuw doel herkend',
    await compareFilePaths(missingAsError, '/volume/nieuw.ifc', source), 'different');

  // Ontbrekende en onbetrouwbare IDs zijn geen bewijs van verschil, ook als het andere veld verschilt.
  for (const info of [
    { isFile: true, dev: null, ino: null },
    { isFile: true, dev: 2, ino: null },
    { isFile: true, dev: null, ino: 30 },
    { isFile: true, dev: 2, ino: 0 },
    { isFile: true, dev: 2, ino: Number.MAX_SAFE_INTEGER + 1 },
    { isFile: true, dev: Number.MAX_SAFE_INTEGER + 1, ino: 30 },
    { isFile: true, dev: 2, ino: NaN },
    { isFile: true, dev: -1, ino: 30 },
    { isFile: true, dev: 2, ino: 1.5 },
    { isFile: false, dev: 2, ino: 30 },
  ]) {
    entries.set('/volume/onbekend.ifc', info);
    eq(`8g onbetrouwbare doelmetadata ${J(info)}`, await compareFilePaths(fs, '/volume/onbekend.ifc', source), 'unknown');
    eq(`8h onbetrouwbare bronmetadata ${J(info)}`, await compareFilePaths(fs, source, '/volume/onbekend.ifc'), 'unknown');
  }

  for (const error of [
    'forbidden path: /volume/model.ifc',
    new Error('failed to get metadata of path: /volume/model.ifc with error: Permission denied (os error 13)'),
    'failed to get metadata of path: /volume/model.ifc with error: Too many levels of symbolic links (os error 40)',
    'failed to get metadata of path: /volume/model.ifc with error: I/O error (os error 5)',
    'failed to get metadata of path: /volume/model.ifc with error: Unknown failure (os error 3)',
    'unknown metadata error (os error 2)', // niet de concrete plugin-fs-foutvorm
  ]) {
    const failing: FileIdentityFs = { stat: async () => { throw error; } };
    eq(`8i fout is geen bewijs van een vrij doel: ${String(error)}`,
      await compareFilePaths(failing, '/volume/model.ifc', source), 'unknown');
  }
  eq('8j een ontbrekende bron bewijst niet dat een bestaand exportdoel veilig is',
    await compareFilePaths(fs, source, '/volume/verdwenen.ifc'), 'unknown');
}

// 9. plugin-fs 2.6.0+ (knownbug 1797): `writeFile`/`writeTextFile` falen als de opties in de kop niet te
//    lezen zijn, vóór het openen; daarvóór vielen ze stil terug op aanmaken en afkappen, ook zonder
//    `createNew`. Een JSON-lijst als inhoud moet uit bytes bestaan. De adapter volgt 2.7.1; de opslagroutes
//    van blok 7 slagen er alleen mee als ze leesbare opties sturen.
{
  const root = mkdtempSync(join(tmpdir(), 'ops-write-options-'));
  const ipc = installNodeFileIpc();
  try {
    const fs = await import('@tauri-apps/plugin-fs');
    const invoke = (globalThis as unknown as { window: { __TAURI_INTERNALS__: { invoke(
      cmd: string, args: unknown, options?: { headers?: Record<string, string> }): Promise<unknown> } } })
      .window.__TAURI_INTERNALS__.invoke;
    const bytes = new Uint8Array([1, 2, 3]);
    const fout = (p: Promise<unknown>) => p.then(() => '', (e: unknown) => String(e));
    const pad = (naam: string) => join(root, naam);
    eq('9a de echte client stuurt een verkeerd type mee: geweigerd, geen bestand',
      [/^invalid write file options /.test(await fout(fs.writeFile(pad('a.bin'), bytes, { append: 'ja' as unknown as boolean }))),
        readdirSync(root)], [true, []]);
    for (const kop of ['{kapot', '[]', '5', '{"createNew":1}', '{"mode":-1}', '{"mode":1.5}']) {
      eq(`9b onleesbare kop ${kop}: geweigerd, geen bestand`,
        [/^invalid write file options /.test(await fout(invoke('plugin:fs|write_file', bytes,
          { headers: { path: encodeURIComponent(pad('b.bin')), options: kop } }))), readdirSync(root)], [true, []]);
    }
    for (const kop of ['undefined', 'null', '', '{"onbekend":true}']) {
      eq(`9c kop ${J(kop)}: de standaarden, aanmaken en schrijven`,
        [await fout(invoke('plugin:fs|write_file', bytes, { headers: { path: encodeURIComponent(pad('c.bin')), options: kop } })),
          [...readFileSync(pad('c.bin'))]], ['', [1, 2, 3]]);
    }
    // In de volgorde van `write_file_inner`: eerst openen met de opties (standaard aanmaken en afkappen), dan
    // de inhoud omzetten. De fout komt dus ná het openen: een nieuw bestand blijft leeg achter, een bestaand
    // bestand is afgekapt. Met `createNew` weigert een bestaand doel al bij het openen.
    for (const vooraf of [null, 'OUDE INHOUD'] as const) {
      if (vooraf === null) rmSync(pad('d.bin'), { force: true }); else writeFileSync(pad('d.bin'), vooraf);
      const melding = await fout(invoke('plugin:fs|write_file', [1, 256],
        { headers: { path: encodeURIComponent(pad('d.bin')), options: 'null' } }));
      eq(`9d een JSON-lijst met een waarde die geen byte is (${vooraf === null ? 'nieuw' : 'bestaand'} doel): geweigerd ná het openen`,
        [/^invalid byte in the data to write: 256/.test(melding),
          lstatSync(pad('d.bin'), { throwIfNoEntry: false }) ? [...readFileSync(pad('d.bin'))] : 'geen bestand'], [true, []]);
    }
    writeFileSync(pad('d.bin'), 'OUDE INHOUD');
    eq('9d met createNew en een bestaand doel: geweigerd bij het openen, inhoud behouden',
      [/^failed to open file at path: /.test(await fout(invoke('plugin:fs|write_file', [1, 256],
        { headers: { path: encodeURIComponent(pad('d.bin')), options: '{"createNew":true}' } }))),
      readFileSync(pad('d.bin'), 'utf8')], [true, 'OUDE INHOUD']);
    eq('9e de opties van de opslagroute (createNew en modus) zijn leesbaar',
      await fout(fs.writeFile(pad('e.bin'), bytes, { createNew: true, mode: 0o640 })), '');
  } finally {
    ipc.dispose();
    rmSync(root, { recursive: true, force: true });
  }
}

// 10. #804, knownbug 1936: de bytes van een gebruikersbestand gaan op de desktop in stukken naar Rust
//     (`tauriUserBytesFs`). Het eerste stuk maakt exclusief aan, met de modus; elk volgend stuk voegt toe zonder aan te
//     maken (`{ append: true, create: false }`); elk stuk is een eigen kopie. Na een geslaagd eerste stuk is het bestand
//     van ons. De stukgrootte is hier `C` bytes; 10h toont dat de productie-ingang 16 MiB gebruikt.
{
  const root = mkdtempSync(join(tmpdir(), 'ops-user-chunks-'));
  /** De losse aanmaken van 10a–10f, en de routes van 10g–10h, elk in een eigen map. */
  const parts = join(root, 'stukken'), routes = join(root, 'routes');
  mkdirSync(parts); mkdirSync(routes);
  const ipc = installNodeFileIpc();
  const C = 8;
  const chunked = tauriUserBytesFs(await import('@tauri-apps/plugin-fs'), C);
  /** `n` bytes met een vast patroon dat per stuk anders is, zodat een verwisseld of ontbrekend stuk opvalt. */
  const pattern = (n: number) => {
    const data = new Uint8Array(n);
    for (let i = 0; i < n; i++) data[i] = (i * 37 + 11) % 251;
    return data;
  };
  const writes = () => ipc.calls.filter(fileWrite);
  /** Per schrijfaanroep: de opties zoals Rust ze leest, de bytes van de payload en die van de buffer eronder. */
  const shape = () => writes().map(c => [c.options, c.bodyBytes, c.bufferBytes]);
  const firstOptions = (mode?: number) => ({ createNew: true, ...(mode === undefined ? {} : { mode }) });
  /** De verwachte aanroepen voor `size` bytes in stukken van `C`; met de eerste op `firstOptions(mode)`. */
  const chunkShape = (size: number, mode?: number) => Array.from({ length: Math.ceil(size / C) }, (_, i) => {
    const len = Math.min(C, size - i * C);
    return [i === 0 ? firstOptions(mode) : { append: true, create: false }, len, len];
  });
  let fileNo = 0;
  const fresh = () => { ipc.calls.length = 0; return join(parts, `save-${++fileNo}.ops-save.tmp`); };
  const sameBytes = (p: string, data: Uint8Array) => Buffer.from(readFileSync(p)).equals(Buffer.from(data));
  const caught = (run: Promise<unknown>) => run.then(() => null, (e: unknown) => e);
  try {
    // 10a. Rond de grens: 0, 1, één stuk min één, precies één stuk, één stuk plus één byte, meerdere stukken met en
    //      zonder rest. Tot en met één stuk precies de ene aanroep van main.
    for (const size of [0, 1, C - 1, C, C + 1, 2 * C, 3 * C + 3]) {
      const p = fresh(), data = pattern(size);
      await chunked.createNew(p, data, 0o640);
      truthy(`10a ${size} bytes: bestand bytegelijk aan de buffer`, sameBytes(p, data));
      eq(`10a ${size} bytes: aanroepen (opties, bytes, buffer)`, shape(),
        size <= C ? [[firstOptions(0o640), size, size]] : chunkShape(size, 0o640));
      truthy(`10a ${size} bytes: alles als rauwe body, nooit in een object`, writes().every(c => c.rawBody && !c.bytesInObject));
      if (sep !== '\\') eq(`10a ${size} bytes: modus van de aanmaak`, lstatSync(p).mode & 0o777, 0o640 & ~process.umask());
    }

    // 10b. Hoogstens één stuk: de payload is de buffer van de aanroeper zelf, ook als die een view op een grotere is,
    //      zoals op main. Geen kopie, geen andere opties.
    {
      const p = fresh(), big = pattern(5 * C), view = big.subarray(C + 2, 2 * C + 2);
      await chunked.createNew(p, view);
      eq('10b één stuk: de ene aanroep van main, met de view zelf als payload', shape(), [[firstOptions(), C, 5 * C]]);
      truthy('10b één stuk: bytegelijk aan de view', sameBytes(p, view));
    }

    // 10c. Een webview die van een view de hele onderliggende buffer zou sturen: elk stuk heeft een eigen buffer, dus
    //      ook dan staat er precies de buffer van de aanroeper (hier zelf een view met een offset).
    {
      const big = pattern(7 * C), view = big.subarray(3, 3 + 3 * C + 3);
      ipc.faults.wholeBufferBody = true;
      try {
        const p = fresh();
        await chunked.createNew(p, view);
        truthy('10c hele buffer per view: toch bytegelijk', sameBytes(p, view));
        eq('10c hele buffer per view: vier stukken, elk in een eigen buffer', shape(), chunkShape(3 * C + 3));
      } finally { ipc.faults.wholeBufferBody = false; }
    }

    // 10d. Een modus zonder schrijfrecht voor de eigenaar (knownbug 162): een tweede opening zou falen, dus één aanroep
    //      zoals main. Met schrijfrecht gewoon in stukken.
    if (sep !== '\\') {
      for (const mode of [0o444, 0o555, 0o400]) {
        const p = fresh(), data = pattern(3 * C + 3);
        eq(`10d modus ${mode.toString(8)}: aanmaken slaagt`, await caught(chunked.createNew(p, data, mode)), null);
        eq(`10d modus ${mode.toString(8)}: één aanroep met de hele buffer`, shape(), [[firstOptions(mode), 3 * C + 3, 3 * C + 3]]);
        truthy(`10d modus ${mode.toString(8)}: bytegelijk`, sameBytes(p, data));
        eq(`10d modus ${mode.toString(8)}: modus behouden`, lstatSync(p).mode & 0o777, mode & ~process.umask());
      }
      const p = fresh(), data = pattern(3 * C + 3);
      await chunked.createNew(p, data, 0o200);
      eq('10d modus 200 (eigenaar mag schrijven): in stukken', shape(), chunkShape(3 * C + 3, 0o200));
      chmodSync(p, 0o600);
      truthy('10d modus 200: bytegelijk', sameBytes(p, data));
    }

    // 10e. Het eerste stuk faalt: precies zoals main. Bij het openen (hier EEXIST) geen eigendom en geen volgend stuk;
    //      bij het schrijven de fout van `write_file_inner` als `OwnFileWriteError`.
    {
      const p = fresh();
      ipc.faults.beforeOpen = q => { if (q === p) writeFileSync(q, 'VAN EEN ANDER'); };
      const err = await caught(chunked.createNew(p, pattern(3 * C)));
      ipc.faults.beforeOpen = null;
      truthy('10e eerste stuk, openen: geen eigendom', !(err instanceof OwnFileWriteError) && /^failed to open file at path: .*EEXIST/.test(String(err)));
      eq('10e eerste stuk, openen: het andere bestand onaangeroerd, geen volgend stuk',
        [readFileSync(p, 'utf8'), writes().length], ['VAN EEN ANDER', 1]);
    }
    {
      const p = fresh();
      ipc.faults.writeErrorAfter = 3;
      const err = await caught(chunked.createNew(p, pattern(3 * C)));
      ipc.faults.writeErrorAfter = null;
      truthy('10e eerste stuk, schrijven: eigen bestand', err instanceof OwnFileWriteError
        && String((err as OwnFileWriteError).cause).startsWith(WRITE_AFTER_CREATE_ERROR));
      eq('10e eerste stuk, schrijven: geen volgend stuk', writes().length, 1);
    }

    // 10f. Een later stuk faalt, bij het schrijven of bij het openen: het bestand is dan van ons (`OwnFileWriteError`).
    //      Is het tijdelijke bestand intussen weg, dan maakt het volgende stuk het niet opnieuw aan.
    const laterFailures: [string, (p: string) => void, RegExp, boolean][] = [
      ['schrijven (schijf vol in stuk 2)', () => { ipc.faults.writeErrorAfter = C + 2; }, /^failed to write bytes to file at path: .*No space left/, true],
      ['openen (bestand weg vóór stuk 2)', p => {
        let opens = 0;
        ipc.faults.beforeOpen = q => { if (q === p && ++opens === 2) unlinkSync(q); };
      }, /^failed to open file at path: .*ENOENT/, false],
      ['openen (buiten de scope vóór stuk 3)', p => {
        let opens = 0;
        ipc.faults.forbidden = q => q === p && ++opens === 3;
      }, /^forbidden path: /, true],
    ];
    if (sep !== '\\' && process.getuid?.() !== 0) {
      laterFailures.push(['openen (geen schrijfrecht meer vóór stuk 3)', p => {
        let opens = 0;
        ipc.faults.beforeOpen = q => { if (q === p && ++opens === 3) chmodSync(q, 0o444); };
      }, /^failed to open file at path: .*EACCES/, true]);
    }
    for (const [what, arrange, cause, stays] of laterFailures) {
      const p = fresh();
      arrange(p);
      const err = await caught(chunked.createNew(p, pattern(3 * C + 3)));
      ipc.faults.writeErrorAfter = null; ipc.faults.beforeOpen = null; ipc.faults.forbidden = null;
      truthy(`10f later stuk, ${what}: eigen bestand, met de fout van plugin-fs`, err instanceof OwnFileWriteError
        && cause.test(String((err as OwnFileWriteError).cause)));
      eq(`10f later stuk, ${what}: geen stuk meer na de fout`, writes().length, what.includes('stuk 3') ? 3 : 2);
      eq(`10f later stuk, ${what}: geen nieuw bestand aangemaakt`, existsSync(p), stays);
    }

    // 10g. Zo komt dat bij de aanroepers aan. `createOwnTemp`: een fout in een later stuk is `write` (nooit `forbidden`,
    //      dat naar de directe aanmaak zou gaan), en het onvolledige eigen bestand is weg. `replaceUserFile`: het doel
    //      blijft, geen hernoeming, geen directe terugval, de fout van plugin-fs komt terug.
    {
      const p = fresh();
      let opens = 0;
      ipc.faults.forbidden = q => q === p && ++opens === 2;
      const result = await createOwnTemp(chunked, p, pattern(3 * C));
      ipc.faults.forbidden = null;
      eq('10g createOwnTemp, later stuk buiten de scope: write, niet forbidden', result.failed, 'write');
      eq('10g createOwnTemp, later stuk buiten de scope: eigen bestand weg', existsSync(p), false);
    }
    for (const failing of [false, true]) {
      const target = join(routes, `doel-${failing}.ifc`), data = pattern(3 * C + 3);
      writeFileSync(target, OUD, { mode: 0o640 });
      ipc.calls.length = 0;
      if (failing) ipc.faults.writeErrorAfter = 2 * C + 1;
      const err = await caught(replaceUserFile(chunked, target, data));
      ipc.faults.writeErrorAfter = null;
      const label = failing ? 'later stuk faalt' : 'goede weg';
      if (failing) {
        truthy(`10g replaceUserFile, ${label}: de schrijffout komt terug`, /^failed to write bytes to file at path: /.test(String(err)));
        eq(`10g replaceUserFile, ${label}: doel onveranderd`, readFileSync(target, 'utf8'), OUD);
      } else {
        eq(`10g replaceUserFile, ${label}: geen fout`, err, null);
        truthy(`10g replaceUserFile, ${label}: doel bytegelijk`, sameBytes(target, data));
      }
      eq(`10g replaceUserFile, ${label}: alleen het doel, geen tijdelijk bestand over`,
        readdirSync(routes), [basename(target)]);
      rmSync(target);
      eq(`10g replaceUserFile, ${label}: hernoemd alleen als alles geschreven is, geen directe terugval`,
        [ipc.calls.some(c => c.command === 'plugin:fs|rename'), ipc.calls.some(direct)], [!failing, false]);
    }

    // 10h. De productie-ingang gebruikt 16 MiB: precies één stuk is de ene aanroep van main, één byte meer twee.
    eq('10h stukgrootte 16 MiB', USER_FILE_CHUNK_BYTES, 16 * 1024 * 1024);
    for (const size of [USER_FILE_CHUNK_BYTES, USER_FILE_CHUNK_BYTES + 1]) {
      const target = join(routes, `groot-${size}.ifc`), data = pattern(size);
      ipc.calls.length = 0;
      await writeUserFileTauri(target, data);
      truthy(`10h ${size} bytes via writeUserFileTauri: bytegelijk`, sameBytes(target, data));
      eq(`10h ${size} bytes via writeUserFileTauri: alleen het doel`, readdirSync(routes), [basename(target)]);
      eq(`10h ${size} bytes via writeUserFileTauri: aanroepen`, writes().map(c => [c.options, c.bodyBytes]),
        size === USER_FILE_CHUNK_BYTES ? [[{ createNew: true }, size]]
          : [[{ createNew: true }, USER_FILE_CHUNK_BYTES], [{ append: true, create: false }, 1]]);
      rmSync(target);
    }
  } finally {
    ipc.dispose();
    rmSync(root, { recursive: true, force: true });
  }
}

if (diffs.length === 0) {
  console.log(`OK  user-file-write: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  user-file-write: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
