import { ScopeEscapeError } from '@/services/mcp/fileScopeError';
export { ScopeEscapeError } from '@/services/mcp/fileScopeError';
// Bestandstoegang van de headless MCP-server: de `McpFileFs`-naad van `planner_export_ifc` en
// `planner_import_schedule` (`src/services/mcp/tools/fileTools.ts`) op Node `fs`, opgesloten in één
// werkmap (`--root`).
//
// Twee poorten, net als in de app:
//  1. LEXICAAL — `checkScope` in fileTools: het pad wordt genormaliseerd (`..`, `.`, dubbele scheiders,
//     `~`) en moet onder `homeDir()` liggen. Hier is `homeDir()` de werkmap, dus `~/plan.ifc` is
//     `<root>/plan.ifc`.
//  2. FYSIEK — `check()` hieronder: de `realpath` van het pad (of van de dichtstbijzijnde bestaande
//     bovenmap) moet binnen de `realpath` van de werkmap liggen. Die vergelijking is EXACT, teken voor
//     teken: geen aanname over hoofdletters per besturingssysteem. Geweigerd met `SCOPE`: een link of
//     junction naar buiten, een dode link, een bestand met meer dan één harde link (niet te bewijzen dat
//     elke naam binnen ligt).
//  3. SLOT — alleen bij SCHRIJVEN (`writeChecked`), ná de fysieke poort: staat het doel open in de
//     desktop-app (register `open-files*.json`, `appLock.ts`), dan `SCOPE`. Lezen blijft mogen.
//
// DE OPERATIE ZELF IS GEBONDEN AAN DE LIGGING (review PR #572, ronde 1 en 2, bevinding 2). `check()` is
// alleen een controle vooraf; een ander proces kan daarna een map door een link vervangen, of een map
// mét inhoud naar buiten verplaatsen. Node kent geen `openat`/`renameat`, maar wel de werkmap van het
// proces: die wijst naar een map-OBJECT, niet naar een pad. Daarom doet elke operatie dit, in één
// synchroon blok (geen andere code kan ertussen, en de procesmap wordt erna hersteld, met de werkmap als terugval; beide kunnen verdwijnen):
//   - `chdir` naar de echte map van het bestand;
//   - `realpath('.')` (de native variant: de kernel geeft het huidige pad van dát map-object) moet binnen
//     de werkmap liggen, en de werkmap zelf moet nog dezelfde `dev`/`ino` hebben;
//   - openen, aanmaken en hernoemen gebeuren met ALLEEN de bestandsnaam, relatief aan die map, met
//     `O_NOFOLLOW`; er wordt geen mappad meer opgelost;
//   - op Linux moet ook `/proc/self/fd/<fd>` van het geopende bestand binnen de werkmap liggen;
//   - de ligging van de map wordt opnieuw gecontroleerd ná het lezen, vóór de `rename` en ná de `rename`.
// Wat overblijft, per besturingssysteem, staat in `docs/headless-mcp.md` (sectie Beveiliging).
//
// SCHRIJVEN IS ALTIJD ATOMAIR (review PR #572, bevinding 1). Eerst een eigen halffabricaat naast het
// ECHTE doel, `fsync`, dan `rename`. Een link naar een bestand binnen de werkmap blijft een link: het
// echte doel wordt vervangen. Mislukt schrijven of `rename`, dan probeert de server het eigen
// halffabricaat op te ruimen en geeft de tool een fout; het origineel blijft byte-gelijk. Er is GEEN
// terugval op direct schrijven (die in de app bestaat voor Tauri-scope en gelinkte bestanden; daar
// verandert niets).
import {
  closeSync, constants as fsConstants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync,
  promises as fsp, readFileSync, readlinkSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync,
  type BigIntStats, type Stats,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { decodeXmlBytes } from './xmlEncoding';
import type { McpFileFs } from '@/services/mcp/tools/fileTools';
import type { FileIdentityInfo } from '@/services/fileAccess/fileIdentity';
import { noAppLock, type AppLock } from './appLock';

/** Is `child` gelijk aan of binnen `parent`? Beide zijn absolute, door `realpath` opgeloste paden.
 *  Exacte vergelijking, ook op Windows en macOS: liever een terechte weigering dan een ontsnapping. */
export function isInside(parent: string, child: string, sep: string = path.sep): boolean {
  if (child === parent) return true;
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child.startsWith(prefix);
}

function errCode(e: unknown): string | undefined {
  return e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/** Beide herstelpaden zijn verdwenen: bewaar de operatie- én herstelfouten zonder ErrorOptions/ES2021. */
export class WorkingDirectoryRestoreError extends Error {
  constructor(readonly errors: readonly unknown[]) {
    super('Could not restore the process working directory or its fallback; '
      + 'the process directory remains unrestored. ' + errors.map(String).join(' | '));
    this.name = 'WorkingDirectoryRestoreError';
  }
}
/** `dev` + `ino` van een bestand of map. */
interface Identity { dev: bigint; ino: bigint }
const idOf = (s: BigIntStats): Identity => ({ dev: s.dev, ino: s.ino });
const sameId = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino;

/** Wat `check()` vaststelde over één pad. */
interface Checked {
  /** Het echte pad (bestaande delen via `realpath`), binnen de werkmap. */
  real: string;
  /** De echte map waarin het bestand staat of komt, en de bestandsnaam. */
  dir: string;
  base: string;
  /** De diepste bestaande map op weg naar `dir`, en de mappen daaronder die nog gemaakt moeten worden. */
  anchor: string;
  subdirs: string[];
  /** Bestaat het doel? Dan zijn identiteit en permissiebits. */
  file: { id: Identity; mode: number; isFile: boolean } | null;
}

/** Momenten waarop een test een map kan wisselen. */
export type NodeFsPhase =
  /** in `check()`, direct na `realpath` en vóór de `stat`-aanroepen (route A van review ronde 2) */
  | 'realpath'
  /** na de controle, vóór het lezen of aanmaken */
  | 'open' | 'create'
  /** na het schrijven, vóór de laatste controle (route B van review ronde 2) */
  | 'rename'
  /** na de laatste controle, direct vóór de `rename` (de resterende grens) */
  | 'commit';

/**
 * Testhaken (alleen voor `tests/mcp/cases-headless-server.ts`, die `createNodeFileFs` direct aanroept):
 * `afterCheck` draait op een gekozen moment (om daar een map te wisselen), `fault` gooit op een gekozen
 * moment (om een schrijf- of rename-fout na te bootsen). Synchroon, omdat de operatie zelf synchroon is.
 * De server zelf geeft geen haken mee.
 */
export interface NodeFsHooks {
  afterCheck?: (phase: NodeFsPhase, target: string) => void;
  fault?: (phase: 'write' | 'rename') => void;
  /** Alleen de directory-fsync vervangen/observeren in tests; standaard de echte syscall. */
  syncDirectory?: (fd: number) => void;
}

const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

/**
 * Maak de bestandstoegang voor één werkmap. `root` moet de `realpath` van een bestaande map zijn
 * (`host.ts` controleert dat). `appLock` is het slot voor schrijfacties (`appLock.ts`); de host geeft
 * altijd het echte slot mee, de standaard (nooit open) is alleen voor tests.
 */
export async function createNodeFileFs(
  root: string,
  appLock: AppLock = noAppLock,
  hooks: NodeFsHooks = {},
): Promise<McpFileFs & { root: string }> {
  const realRoot = root;
  const rootId = idOf(await fsp.stat(realRoot, { bigint: true }));

  const outside = (target: string) => new ScopeEscapeError(
    `Path '${target}' leads outside the working folder '${realRoot}' (through a symbolic link, junction, ` +
    'other alias or a different spelling). The headless server may only read and write inside its working folder.');
  const rootReplaced = () => new ScopeEscapeError(
    `The working folder '${realRoot}' was replaced while the server runs; refusing file access.`);
  const changed = (target: string) => new ScopeEscapeError(
    `Path '${target}' changed while the server was checking it (a folder or file was replaced or moved). ` +
    'Nothing was read or written; try again.');
  const movedDuringSave = (target: string) => new ScopeEscapeError(
    `The folder of '${target}' was moved out of the working folder while the server saved. The file was saved ` +
    'in that moved folder, not in the working folder. Check where the folder went.');

  /** De fysieke poort. Gooit `ScopeEscapeError` bij een weigering. */
  async function check(target: string): Promise<Checked> {
    if (!sameId(idOf(await fsp.stat(realRoot, { bigint: true })), rootId)) throw rootReplaced();
    const native = path.resolve(target);
    // Loop omhoog tot een bestaand deel; alles daaronder bestaat (nog) niet en kan dus geen link zijn.
    let existing = native;
    const missing: string[] = [];
    for (;;) {
      try {
        await fsp.lstat(existing); // ook een dode link bestaat voor `lstat`; `realpath` weigert hem
        break;
      } catch (e) {
        if (errCode(e) !== 'ENOENT' && errCode(e) !== 'ENOTDIR') throw e;
        const parent = path.dirname(existing);
        if (parent === existing) break;
        missing.unshift(path.basename(existing));
        existing = parent;
      }
    }
    let realExisting: string;
    try {
      realExisting = await fsp.realpath(existing);
    } catch (e) {
      if (errCode(e) === 'ENOENT') {
        throw new ScopeEscapeError(`Path '${target}' contains a link that points to nothing (a dangling symbolic ` +
          'link). The server refuses it, because writing there would create a file wherever the link points.');
      }
      throw e;
    }
    const real = missing.length > 0 ? path.join(realExisting, ...missing) : realExisting;
    hooks.afterCheck?.('realpath', real);
    if (!isInside(realRoot, real) || real === realRoot) {
      if (real === realRoot) throw new ScopeEscapeError(`Path '${target}' is the working folder itself, not a file in it.`);
      throw outside(target);
    }
    let file: Checked['file'] = null;
    if (missing.length === 0) {
      const info = await fsp.stat(real, { bigint: true });
      if (info.isFile() && info.nlink > 1n) {
        throw new ScopeEscapeError(`Path '${target}' is a file with ${info.nlink} hard links. The server cannot prove ` +
          'that every name of that file is inside its working folder, so it does not read or write it. Copy the file first.');
      }
      file = { id: idOf(info), mode: Number(info.mode & 0o777n), isFile: info.isFile() };
    }
    const dir = path.dirname(real);
    return {
      real,
      dir,
      base: path.basename(real),
      anchor: missing.length > 0 ? realExisting : dir,
      subdirs: missing.slice(0, -1),
      file,
    };
  }

  async function confine(target: string): Promise<string | null> {
    try {
      await check(target);
      return null;
    } catch (e) {
      if (e instanceof ScopeEscapeError) return e.message;
      throw e;
    }
  }

  // --- De gebonden operatie: synchroon, in de map-OBJECT van het bestand -----------------------------

  /** Ligt de huidige procesmap (het map-object, niet een pad) binnen de werkmap? */
  function assertHere(target: string): void {
    let here: string;
    try {
      here = realpathSync.native('.');
    } catch {
      throw changed(target); // de map is weg
    }
    let rootNow: Identity;
    try {
      rootNow = idOf(statSync(realRoot, { bigint: true }));
    } catch {
      throw rootReplaced();
    }
    if (!sameId(rootNow, rootId)) throw rootReplaced();
    if (!isInside(realRoot, here)) throw outside(target);
  }

  /** Linux: het pad dat de kernel voor een geopend bestand kent, moet binnen de werkmap liggen. */
  function assertFdInside(fd: number, target: string): void {
    if (process.platform !== 'linux') return;
    let where: string;
    try {
      where = readlinkSync(`/proc/self/fd/${fd}`);
    } catch {
      return; // geen /proc (zeldzame container); de mapcontrole blijft
    }
    if (!isInside(realRoot, where)) throw outside(target);
  }

  /** Voer `fn` synchroon uit in de gecontroleerde map; probeer daarna de oude map of de werkmap. */
  function inDir<T>(dir: string, target: string, fn: () => T): T {
    let previous: string;
    try {
      previous = process.cwd();
    } catch {
      previous = realRoot;
    }
    try {
      process.chdir(dir);
    } catch (e) {
      const code = errCode(e);
      if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP') throw changed(target);
      throw e;
    }
    let operationFailed = false;
    let operationError: unknown;
    try {
      assertHere(target);
      return fn();
    } catch (error) {
      operationFailed = true;
      operationError = error;
      throw error;
    } finally {
      try {
        process.chdir(previous);
      } catch (restoreError) {
        try {
          process.chdir(realRoot);
        } catch (fallbackError) {
          throw new WorkingDirectoryRestoreError([
            ...(operationFailed ? [operationError] : []), restoreError, fallbackError,
          ]);
        }
      }
    }
  }

  /** Open een naam in de procesmap zonder een link te volgen; een link of verdwenen naam is een wissel. */
  function openHere(name: string, flags: number, target: string, mode?: number): number {
    try {
      return openSync(name, flags | O_NOFOLLOW, mode);
    } catch (e) {
      const code = errCode(e);
      if (code === 'ELOOP' || code === 'EMLINK' || code === 'ENOENT') throw changed(target);
      throw e;
    }
  }

  /** Lees een bestaand bestand via een handle die aantoonbaar het gecontroleerde bestand binnen de werkmap is. */
  async function readChecked(target: string): Promise<Buffer> {
    const c = await check(target);
    if (!c.file) {
      const err = new Error(`ENOENT: no such file or directory, open '${target}'`) as Error & { code: string };
      err.code = 'ENOENT';
      throw err;
    }
    if (!c.file.isFile) throw new Error(`'${target}' is not a file`);
    const expected = c.file.id;
    hooks.afterCheck?.('open', c.real);
    return inDir(c.dir, target, () => {
      const fd = openHere(c.base, fsConstants.O_RDONLY, target);
      try {
        const opened = fstatSync(fd, { bigint: true });
        if (!opened.isFile() || opened.nlink > 1n || !sameId(idOf(opened), expected)) throw changed(target);
        assertFdInside(fd, target);
        const data = readFileSync(fd);
        // Ná het lezen opnieuw: is de map intussen naar buiten verplaatst, dan geeft de server niets terug.
        assertHere(target);
        assertFdInside(fd, target);
        return data;
      } finally {
        closeSync(fd);
      }
    });
  }

  /** Schrijf atomair: eigen halffabricaat in de echte map, `fsync`, `rename`, alles relatief aan die map. */
  async function writeChecked(target: string, content: string): Promise<void> {
    const c = await check(target);
    if (c.file && !c.file.isFile) throw new Error(`'${target}' is a folder, not a file`);
    // Het slot: per schrijfactie het register opnieuw lezen en op bestandsidentiteit toetsen.
    const locked = await appLock(c.real);
    if (locked !== null) throw new ScopeEscapeError(locked);
    hooks.afterCheck?.('create', c.real);
    inDir(c.anchor, target, () => {
      // Ontbrekende mappen één voor één, elk relatief aan de vorige en elk opnieuw gecontroleerd.
      for (const name of c.subdirs) {
        try {
          mkdirSync(name);
        } catch (e) {
          if (errCode(e) !== 'EEXIST') throw e;
        }
        let info: Stats;
        try {
          info = lstatSync(name);
        } catch {
          throw changed(target);
        }
        if (!info.isDirectory()) throw changed(target); // een link is voor `lstat` geen map
        process.chdir(name);
        assertHere(target);
      }
      writeHere(c, target, content);
    });
  }

  function writeHere(c: Checked, target: string, content: string): void {
    // De doelnaam kan zelf al bijna NAME_MAX bytes zijn; voeg daar niets aan toe.
    // O_EXCL en de inodecontrole blijven het eigendom van deze korte eigen naam bewaken.
    const tmpName = `.${randomBytes(6).toString('hex')}.ops-save.tmp`;
    const fd = openHere(tmpName, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, target, c.file?.mode ?? 0o666);
    let tmpId: Identity | null = null;
    let open = true;
    let renamed = false;
    try {
      tmpId = idOf(fstatSync(fd, { bigint: true }));
      assertFdInside(fd, target);
      hooks.fault?.('write');
      writeFileSync(fd, content, 'utf8');
      if (c.file) fchmodSync(fd, c.file.mode); // permissiebits van het origineel, los van de umask
      fsyncSync(fd); // de data staat op schijf vóór de rename
      closeSync(fd);
      open = false;
      hooks.afterCheck?.('rename', c.real);
      // De laatste controle: de map ligt nog binnen, het gevraagde pad wijst nog naar deze map, en de
      // naam van het halffabricaat wijst nog naar ons eigen bestand.
      assertHere(target);
      let here: Identity;
      let asked: Identity;
      let tmpNow: Identity;
      try {
        here = idOf(statSync('.', { bigint: true }));
        asked = idOf(statSync(c.dir, { bigint: true }));
        tmpNow = idOf(lstatSync(tmpName, { bigint: true }));
      } catch {
        throw changed(target);
      }
      if (!sameId(here, asked) || !sameId(tmpNow, tmpId)) throw changed(target);
      hooks.afterCheck?.('commit', c.real);
      hooks.fault?.('rename');
      renameSync(tmpName, c.base);
      renamed = true;
      try {
        assertHere(target);
      } catch {
        throw movedDuringSave(target);
      }
      // De bestands-fsync bewaart niet automatisch de nieuwe naam in de doelmap.
      // Open '.' relatief aan het al gebonden map-object, niet opnieuw via c.dir.
      // Windows ondersteunt deze POSIX-directoryroute niet; geen schijnzekerheid daar.
      if (process.platform !== 'win32') {
        try {
          const directoryFd = openSync('.', fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0));
          try {
            (hooks.syncDirectory ?? fsyncSync)(directoryFd);
          } finally {
            closeSync(directoryFd);
          }
        } catch (error) {
          throw new Error(`File '${target}' was replaced, but synchronizing its directory failed; `
            + `crash durability is unconfirmed. Inspect the saved file before retrying. ${String(error)}`);
        }
      }
      try {
        assertHere(target);
      } catch {
        throw movedDuringSave(target);
      }
    } catch (error) {
      if (open) {
        try { closeSync(fd); } catch { /* al dicht */ }
      }
      // Alleen ons eigen halffabricaat opruimen, in dezelfde map-object: wijst de naam nog naar ons bestand?
      // Lukt dat niet (map weg), dan blijft het staan; de fout gaat altijd door.
      if (tmpId && !renamed) {
        try {
          if (sameId(idOf(lstatSync(tmpName, { bigint: true })), tmpId)) unlinkSync(tmpName);
        } catch { /* al weg, of niet meer bereikbaar */ }
      }
      throw error;
    }
  }

  /** Metadata van een bestaand doel, ook gebonden aan de ligging van zijn map. */
  async function statChecked(target: string): Promise<{ id: Identity; isFile: boolean } | null> {
    const c = await check(target);
    if (!c.file) return null;
    return inDir(c.dir, target, () => {
      let info: BigIntStats;
      try {
        info = lstatSync(c.base, { bigint: true });
      } catch {
        throw changed(target);
      }
      if (info.isSymbolicLink()) throw changed(target);
      return { id: idOf(info), isFile: info.isFile() };
    });
  }

  return {
    root: realRoot,
    homeDir: async () => realRoot,
    confine,
    exists: async (p) => (await statChecked(p)) !== null,
    stat: async (p): Promise<FileIdentityInfo> => {
      const info = await statChecked(p);
      // `compareFilePaths` (fileIdentity.ts) herkent een ontbrekend doel alleen aan de foutvorm van
      // Tauri plugin-fs. Geef het ontbreken in precies die vorm door, anders telt een nieuw bestand als
      // "onbekend" en weigert de export het.
      if (!info) throw new Error(`failed to get metadata of path: ${p} with error: No such file or directory (os error 2)`);
      const safe = (n: bigint): number | null => (n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : null);
      return { isFile: info.isFile, dev: safe(info.id.dev), ino: safe(info.id.ino) };
    },
    readTextFile: async (p) => {
      const bytes = await readChecked(p);
      return path.extname(p).toLowerCase() === '.xml' ? decodeXmlBytes(bytes) : bytes.toString('utf8');
    },
    readFile: async (p) => new Uint8Array(await readChecked(p)),
    writeTextFile: (p, content) => writeChecked(p, content),
  };
}
