import { ScopeEscapeError } from '@/services/mcp/fileScopeError';
export { ScopeEscapeError } from '@/services/mcp/fileScopeError';
import {
  closeSync, constants as fsConstants, fchmodSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync,
  promises as fsp, readFileSync, readlinkSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync,
  type BigIntStats, type Stats,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { decodeXmlBytes } from './xmlEncoding';
import type { McpFileFs } from '@/services/mcp/tools/fileTools';
import type { FileIdentityInfo } from '@/services/fileAccess/fileIdentity';
import { noAppLock, type AppLock } from './appLock';
import { scanForeignTargetBytes } from '@/services/ifc/foreign/targetForeignScan';
import { IFC_FOREIGN_SCAN_MAX_BYTES } from '@/services/ifc/foreign/foreignScan';
import { ByteWriteError } from '@/services/fileAccess/byteWrite';

export function isInside(parent: string, child: string, sep: string = path.sep): boolean {
  if (child === parent) return true;
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child.startsWith(prefix);
}

function errCode(e: unknown): string | undefined {
  return e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

export class WorkingDirectoryRestoreError extends Error {
  constructor(readonly errors: readonly unknown[]) {
    super('Could not restore the process working directory or its fallback; '
      + 'the process directory remains unrestored. ' + errors.map(String).join(' | '));
    this.name = 'WorkingDirectoryRestoreError';
  }
}
interface Identity { dev: bigint; ino: bigint }
const idOf = (s: BigIntStats): Identity => ({ dev: s.dev, ino: s.ino });
const sameId = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino;

interface Checked {
  real: string;
  dir: string;
  base: string;
  anchor: string;
  subdirs: string[];
  file: { id: Identity; mode: number; isFile: boolean } | null;
}

export type NodeFsPhase =
  | 'realpath'
  | 'open' | 'create'
  | 'rename'
  | 'commit';

export interface NodeFsHooks {
  afterCheck?: (phase: NodeFsPhase, target: string) => void;
  fault?: (phase: 'write' | 'rename') => void;
  syncDirectory?: (fd: number) => void;
}

const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

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

  async function check(target: string): Promise<Checked> {
    if (!sameId(idOf(await fsp.stat(realRoot, { bigint: true })), rootId)) throw rootReplaced();
    const native = path.resolve(target);
    let existing = native;
    const missing: string[] = [];
    for (;;) {
      try {
        await fsp.lstat(existing);
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

  function assertHere(target: string): void {
    let here: string;
    try {
      here = realpathSync.native('.');
    } catch {
      throw changed(target);
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

  function assertFdInside(fd: number, target: string): void {
    if (process.platform !== 'linux') return;
    let where: string;
    try {
      where = readlinkSync(`/proc/self/fd/${fd}`);
    } catch {
      return;
    }
    if (!isInside(realRoot, where)) throw outside(target);
  }

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

  function openHere(name: string, flags: number, target: string, mode?: number): number {
    try {
      return openSync(name, flags | O_NOFOLLOW, mode);
    } catch (e) {
      const code = errCode(e);
      if (code === 'ELOOP' || code === 'EMLINK' || code === 'ENOENT') throw changed(target);
      throw e;
    }
  }

  async function readChecked(target: string, maxBytes = Infinity): Promise<Buffer> {
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
        if (opened.size > BigInt(Number.isFinite(maxBytes) ? maxBytes : Number.MAX_SAFE_INTEGER)) {
          throw new Error('The existing target is too large to scan safely');
        }
        const data = readFileSync(fd);
        assertHere(target);
        assertFdInside(fd, target);
        return data;
      } finally {
        closeSync(fd);
      }
    });
  }

  async function writeChecked(target: string, content: string | Uint8Array, exclusive = false): Promise<void> {
    const c = await check(target);
    if (exclusive && c.file) throw new ByteWriteError('create-new');
    if (c.file && !c.file.isFile) throw new Error(`'${target}' is a folder, not a file`);
    const locked = await appLock(c.real);
    if (locked !== null) throw new ScopeEscapeError(locked);
    hooks.afterCheck?.('create', c.real);
    inDir(c.anchor, target, () => {
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
        if (!info.isDirectory()) throw changed(target);
        process.chdir(name);
        assertHere(target);
      }
      writeHere(c, target, content, exclusive);
    });
  }

  function placeExclusive(tmpName: string, base: string, tmpId: Identity, target: string): void {
    try {
      linkSync(tmpName, base);
    } catch (e) {
      if (errCode(e) === 'EEXIST') throw new ByteWriteError('create-new', e);
      throw e;
    }
    let placed: Identity;
    try {
      placed = idOf(lstatSync(base, { bigint: true }));
    } catch {
      throw changed(target);
    }
    if (!sameId(placed, tmpId)) throw changed(target);
  }

  function writeHere(c: Checked, target: string, content: string | Uint8Array, exclusive: boolean): void {
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
      if (c.file) fchmodSync(fd, c.file.mode);
      fsyncSync(fd);
      closeSync(fd);
      open = false;
      hooks.afterCheck?.('rename', c.real);
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
      if (exclusive) {
        placeExclusive(tmpName, c.base, tmpId, target);
        renamed = true;
        try {
          unlinkSync(tmpName);
        } catch (error) {
          throw new Error(`'${target}' was placed, but removing its temporary name '${tmpName}' next to it failed `
            + `(${String(error)}). The final folder check and the folder sync did not run, so crash durability is unconfirmed. `
            + `If '${tmpName}' still exists, the file has two names and the server refuses to read it until that name is deleted.`);
        }
      } else {
        renameSync(tmpName, c.base);
        renamed = true;
      }
      try {
        assertHere(target);
      } catch {
        throw movedDuringSave(target);
      }
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
        try { closeSync(fd); } catch { }
      }
      if (tmpId && !renamed) {
        try {
          if (sameId(idOf(lstatSync(tmpName, { bigint: true })), tmpId)) unlinkSync(tmpName);
        } catch { }
      }
      throw error;
    }
  }

  async function statChecked(target: string): Promise<{ id: Identity; isFile: boolean; mtime: Date } | null> {
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
      return { id: idOf(info), isFile: info.isFile(), mtime: info.mtime };
    });
  }

  return {
    root: realRoot,
    homeDir: async () => realRoot,
    confine,
    exists: async (p) => (await statChecked(p)) !== null,
    stat: async (p): Promise<FileIdentityInfo> => {
      const info = await statChecked(p);
      if (!info) throw new Error(`failed to get metadata of path: ${p} with error: No such file or directory (os error 2)`);
      const safe = (n: bigint): number | null => (n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : null);
      return { isFile: info.isFile, dev: safe(info.id.dev), ino: safe(info.id.ino), mtime: info.mtime };
    },
    readTextFile: async (p) => {
      const bytes = await readChecked(p);
      return path.extname(p).toLowerCase() === '.xml' ? decodeXmlBytes(bytes) : bytes.toString('utf8');
    },
    readFile: async (p) => new Uint8Array(await readChecked(p)),
    protectExistingTargets: true,
    scanTarget: async p => {
      try { return scanForeignTargetBytes(await readChecked(p, IFC_FOREIGN_SCAN_MAX_BYTES)); }
      catch (e) {
        if (e instanceof ScopeEscapeError) throw e;
        return errCode(e) === 'ENOENT' ? null : 'unreadable';
      }
    },
    writeTextFile: (p, content) => writeChecked(p, content),
    writeNewUserBytes: (p, bytes) => writeChecked(p, bytes, true),
  };
}
