// Veilig opslaan van een GEBRUIKERSbestand (Opslaan, Opslaan als, automatisch opslaan, export) —
// headless tegen een nep-fs én de echte Node-fs via de plugin-JS-client; geen Tauri-runtime.
//
// Waarom deze batterij bestaat. `saveToRefTauri` en de opslaan-als-kiezers schreven met een kale
// `writeTextFile`/`writeFile`. plugin-fs opent het doel met `truncate: true` en schrijft daarna
// (tauri-plugin-fs 2.5.0, commands.rs `write_file_inner`), dus een volle schijf, I/O-fout of crash
// midden in die write liet het projectbestand van de gebruiker leeg of afgekapt achter. De nep-fs
// hieronder doet precies dat: `write` truncate't eerst en kan daarna "vol raken".
//
// Draaien: bundel met esbuild zoals run.sh dat doet en start met node. Exit 0 = alles groen.
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readlinkSync, symlinkSync, linkSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { installNodeFileIpc } from './nodeFileIpc';
import { basename, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  replaceUserFile, isForbiddenPathError, USER_FILE_TMP_SUFFIX, writeUserTextFileTauri, writeUserBytesTauri, type UserFileFs,
} from '@/services/fileAccess/atomicWrite';
import { compareFilePaths, type FileIdentityInfo, type FileIdentityFs } from '@/services/fileAccess/fileIdentity';

declare const process: { exit(code: number): never; umask(): number };

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
    closeError: null as unknown,
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
    createNew: async (p, mode) => {
      calls.push(`createNew ${p}${mode === undefined ? '' : ` mode=${mode.toString(8)}`}`);
      temps.push(p);
      if (opts.forbidTemps || opts.forbidden.has(p)) throw `forbidden path: ${p}`;
      if (opts.createError !== null) throw opts.createError;
      if (files.has(p)) throw new Error('File exists (os error 17)');
      const entry: Entry = { data: '', mode: mode ?? 0o644 };
      files.set(p, entry);
      return {
        write: async data => {
          calls.push(`handle.write ${p}`);
          if (opts.diskFullAfter !== null && data.length > opts.diskFullAfter) {
            entry.data = data.slice(0, opts.diskFullAfter);
            throw new Error('No space left on device (os error 28)');
          }
          entry.data = data;
        },
        close: async () => {
          calls.push(`close ${p}`);
          if (opts.closeError !== null) throw opts.closeError;
        },
      };
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
  opts.closeError = new Error('forbidden path: sluiten mislukt');
  const err = await replaceUserFile(fs, P, NIEUW).catch(e => e);
  truthy('6b de sluitfout blijft een fout', err === opts.closeError);
  eq('6b doel ongewijzigd, eigen halffabricaat opgeruimd', [...files.entries()], [[P, { data: OUD, mode: 0o600 }]]);
}

// 7. ECHTE filesystemgevallen voor CI, door de echte Tauri-JS-adapter voor zowel tekst als bytes.
// De IPC-rand gebruikt Node-fs: geen Tauri-runtime of capabilitybewijs. Korte writes en fouten
// worden geïnjecteerd; creatie met O_EXCL, links, inodebehoud en rename draaien op het CI-OS.
for (const kind of ['text', 'bytes'] as const) {
  const root = mkdtempSync(join(tmpdir(), 'ops-user-write-'));
  const ipc = installNodeFileIpc();
  const payload = kind === 'text' ? new TextEncoder().encode('NIEUW – bouw 🏗\u0000 einde') : new Uint8Array([0, 255, 128, 1, 13, 10, 254, 42]);
  const save = (p: string) => kind === 'text'
    ? writeUserTextFileTauri(p, new TextDecoder().decode(payload)) : writeUserBytesTauri(p, payload);
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
      ipc.faults.writeChunkSize = 3; // meer dan één write; ook midden in UTF-8-codepoints
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
      const opened = ipc.calls.filter(c => c.command === 'plugin:fs|open');
      truthy(`7 ${kind}/${preplaced}: verse naam exclusief geopend`, opened.length === 1 && opened[0].path !== legacy
        && opened[0].options?.createNew === true && opened[0].options?.write === true && opened[0].options?.read === false);
      truthy(`7 ${kind}/${preplaced}: sluit vóór rename`, ipc.calls.findIndex(c => c.command === 'plugin:resources|close')
        < ipc.calls.findIndex(c => c.command === 'plugin:fs|rename'));
      eq(`7 ${kind}/${preplaced}: geen open handles`, ipc.openHandles(), 0);
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
          const opens = ipc.calls.filter(c => c.command === 'plugin:fs|open');
          truthy(`7 ${kind}/lange naam/${existing}: korte basename in dezelfde map exclusief geopend`, opens.length === 1
            && opens[0].path !== undefined && dirname(opens[0].path) === longRoot
            && new TextEncoder().encode(basename(opens[0].path)).length < 80 && opens[0].options?.createNew === true);
          truthy(`7 ${kind}/lange naam/${existing}: geen directe terugval`,
            !ipc.calls.some(c => c.command === 'plugin:fs|write_text_file' || c.command === 'plugin:fs|write_file'));
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
      truthy(`7 ${kind}/${collision}: botsend object bestaat nog`, !!collided && !!lstatSync(collided));
      if (collision === 'file') eq(`7 ${kind}/botsing: bestandinhoud behouden`, readFileSync(collided, 'utf8'), 'ANDERMANS VERS PAD');
      if (collision === 'symlink') eq(`7 ${kind}/botsing: bronlink behouden`, readlinkSync(collided), source);
      truthy(`7 ${kind}/${collision}: geen schrijven, rename of cleanup na botsing`,
        !ipc.calls.some(c => ['plugin:fs|write', 'plugin:fs|write_file', 'plugin:fs|write_text_file', 'plugin:fs|rename', 'plugin:fs|remove'].includes(c.command)));
    }

    // Fouten na geslaagde aanmaak: het originele doel blijft staan; alleen ons eigen pad opruimen.
    for (const failure of ['write', 'close', 'zero-write', 'cleanup'] as const) {
      reset();
      writeFileSync(target, OUD, { mode: 0o600 });
      writeFileSync(legacy, 'ANDERMANS TMP');
      ipc.faults.writeErrorAfter = failure === 'write' || failure === 'cleanup' ? 5 : null;
      ipc.faults.zeroWrite = failure === 'zero-write';
      ipc.faults.closeError = failure === 'close' ? new Error('close mislukt') : null;
      ipc.faults.removeError = failure === 'cleanup' ? new Error('cleanup mislukt') : null;
      const err = await save(target).catch(e => e);
      truthy(`7 ${kind}/${failure}: de juiste fout komt terug`, (failure === 'close' ? /close mislukt/
        : failure === 'zero-write' ? /Incomplete/ : /No space left/).test(String(err)));
      eq(`7 ${kind}/${failure}: oorspronkelijke inhoud behouden`, readFileSync(target, 'utf8'), OUD);
      eq(`7 ${kind}/${failure}: ander tmp behouden`, readFileSync(legacy, 'utf8'), 'ANDERMANS TMP');
      eq(`7 ${kind}/${failure}: resten alleen bij geweigerde cleanup`, readdirSync(root).length, failure === 'cleanup' ? 4 : 3);
      truthy(`7 ${kind}/${failure}: geen rename of directe terugval`, !ipc.calls.some(c => ['plugin:fs|rename', 'plugin:fs|write_text_file', 'plugin:fs|write_file'].includes(c.command)));
      eq(`7 ${kind}/${failure}: handle gesloten`, ipc.openHandles(), 0);
    }
    ipc.faults.writeErrorAfter = null;
    ipc.faults.zeroWrite = false;
    ipc.faults.closeError = null;
    ipc.faults.removeError = null;

    for (const fallback of ['scope', 'rename', 'rename-and-cleanup'] as const) {
      reset();
      writeFileSync(target, OUD);
      writeFileSync(legacy, 'ANDERMANS TMP');
      ipc.faults.openError = fallback === 'scope' ? 'forbidden path: tijdelijk pad buiten scope' : null;
      ipc.faults.renameError = fallback === 'scope' ? null : new Error('rename geweigerd');
      ipc.faults.removeError = fallback === 'rename-and-cleanup' ? new Error('cleanup geweigerd') : null;
      await save(target);
      eq(`7 ${kind}/${fallback}: directe terugval heeft exacte uitvoer`, read(target), [...payload]);
      eq(`7 ${kind}/${fallback}: oude tmp behouden`, readFileSync(legacy, 'utf8'), 'ANDERMANS TMP');
      eq(`7 ${kind}/${fallback}: alleen eigen rest bij cleanupfout`, readdirSync(root).length, fallback === 'rename-and-cleanup' ? 4 : 3);
      if (fallback === 'scope') truthy(`7 ${kind}/scope: niets opgeruimd`, !ipc.calls.some(c => c.command === 'plugin:fs|remove'));
    }
    ipc.faults.openError = null;
    ipc.faults.removeError = null;
    reset();
    writeFileSync(target, OUD);
    ipc.faults.directWriteError = new Error('direct schrijven geweigerd');
    const fallbackError = await save(target).catch(e => e);
    truthy(`7 ${kind}/rename+direct: schrijffout doorgegeven`, fallbackError === ipc.faults.directWriteError);
    eq(`7 ${kind}/rename+direct: doel compleet, eigen tmp weg`, [readFileSync(target, 'utf8'), readdirSync(root).sort()], [OUD, ['bron.ifc', 'kopie.ifc']]);
    ipc.faults.directWriteError = null;
    ipc.faults.renameError = null;

    reset();
    writeFileSync(target, OUD);
    if (kind === 'text') await writeUserTextFileTauri(target, '');
    else await writeUserBytesTauri(target, new Uint8Array());
    eq(`7 ${kind}/leeg: oude inhoud volledig vervangen`, read(target), []);
    eq(`7 ${kind}/leeg: geen resten of handles`, [readdirSync(root).sort(), ipc.openHandles()], [['bron.ifc', 'kopie.ifc'], 0]);

    if (sep !== '\\') {
      reset();
      writeFileSync(target, OUD, { mode: 0o600 });
      await save(target);
      eq(`7 ${kind}/mode: aanmaakmode 0600 begrensd door de CI-umask`, lstatSync(target).mode & 0o777, 0o600 & ~process.umask());
      eq(`7 ${kind}/mode: uitvoer compleet`, read(target), [...payload]);
      // Ook doel-links blijven direct beschreven: link en alle andere namen behouden hun inode.
      for (const link of ['symlink', 'hardlink']) {
        reset();
        if (link === 'symlink') symlinkSync(source, target); else linkSync(source, target);
        const before = lstatSync(target);
        await save(target);
        eq(`7 ${kind}/${link}doel: bron bijgewerkt`, read(source), [...payload]);
        eq(`7 ${kind}/${link}doel: link-inode behouden`, lstatSync(target).ino, before.ino);
        truthy(`7 ${kind}/${link}doel: geen tijdelijke aanmaak`, !ipc.calls.some(c => c.command === 'plugin:fs|open'));
      }
    }
    reset();
    await Promise.all([save(target), kind === 'text' ? writeUserTextFileTauri(target, 'TWEEDE') : writeUserBytesTauri(target, new Uint8Array([9, 8]))]);
    const temps = ipc.calls.filter(c => c.command === 'plugin:fs|open').map(c => c.path);
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
  truthy('8b tauriBackend: Opslaan, Opslaan als en export via writeUser…Tauri',
    (backend.match(/writeUserTextFileTauri\(/g) ?? []).length >= 2 && backend.includes('writeUserBytesTauri('));
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

if (diffs.length === 0) {
  console.log(`OK  user-file-write: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  user-file-write: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
