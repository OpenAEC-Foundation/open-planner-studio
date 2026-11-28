import { generateId } from '@/utils/id';
import { appLog } from '@/services/debug/appLog';
import { ByteWriteError } from './byteWrite';
import { placeFileExclusive, type PlaceFileOutcome } from './placeFileExclusive';
import type { FileData, RefuseBeforePlace } from './index';

export interface AtomicWriteFs {
  writeTextFile(path: string, text: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export async function writeViaTemp(fs: AtomicWriteFs, target: string, tmp: string, text: string): Promise<void> {
  await fs.writeTextFile(tmp, text);
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    try { await fs.remove(tmp); } catch { }
    throw err;
  }
}

export async function writeTextFileAtomic(dir: string, name: string, text: string, tmpSuffix = '.tmp'): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  await writeViaTemp(
    { writeTextFile: (p, t) => fs.writeTextFile(p, t), rename: (a, b) => fs.rename(a, b), remove: p => fs.remove(p) },
    await join(dir, name),
    await join(dir, `${name}${tmpSuffix}`),
    text,
  );
}

export async function writeBytesFileAtomic(dir: string, name: string, bytes: Uint8Array, tmpSuffix = '.tmp'): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const target = await join(dir, name);
  const tmp = await join(dir, `${name}${tmpSuffix}`);
  await fs.writeFile(tmp, bytes);
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    try { await fs.remove(tmp); } catch { }
    throw err;
  }
}

export const USER_FILE_TMP_SUFFIX = '.ops-save.tmp';

export function userFileTempPath(path: string, id: string = userFileHelperId()): string {
  return `${userFileDir(path)}save-${id}${USER_FILE_TMP_SUFFIX}`;
}

export function userFileHelperId(): string {
  return generateId();
}

export function userFileDir(path: string): string {
  const windowsPath = /^[a-z]:[\\/]|^\\\\/i.test(path);
  const lastSeparator = windowsPath ? Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) : path.lastIndexOf('/');
  return path.slice(0, lastSeparator + 1);
}

export interface UserFileFs<D> {
  lstat(path: string): Promise<{ isSymlink: boolean; nlink: number | null; mode: number | null }>;
  createNew(path: string, data: D, mode?: number): Promise<void>;
  write(path: string, data: D, mode?: number): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export class OwnFileWriteError extends Error {
  constructor(readonly cause: unknown) {
    super(String(cause instanceof Error ? cause.message : cause));
    this.name = 'OwnFileWriteError';
  }
}

export function isForbiddenPathError(err: unknown): boolean {
  return String(err instanceof Error ? err.message : err).includes('forbidden path');
}

export async function replaceUserFile<D>(
  fs: UserFileFs<D>, path: string, data: D, refuseBeforePlace?: RefuseBeforePlace | null,
): Promise<boolean> {
  const refused = () => refuseBeforePlace?.() === true;
  let info: Awaited<ReturnType<UserFileFs<D>['lstat']>> | null = null;
  try {
    info = await fs.lstat(path);
  } catch {
  }
  if (info && (info.isSymlink || (info.nlink ?? 1) > 1)) {
    if (refused()) return false;
    await fs.write(path, data);
    return true;
  }
  const tmp = userFileTempPath(path);
  const mode = info?.mode != null ? info.mode & 0o777 : undefined;
  const removeOwnTemp = async () => {
    try { await fs.remove(tmp); } catch { }
  };
  try {
    await fs.createNew(tmp, data, mode);
  } catch (err) {
    if (err instanceof OwnFileWriteError) {
      await removeOwnTemp();
      throw err.cause;
    }
    if (isForbiddenPathError(err)) {
      if (refused()) return false;
      await fs.write(path, data);
      return true;
    }
    throw err;
  }
  if (refused()) {
    await removeOwnTemp();
    return false;
  }
  try {
    await fs.rename(tmp, path);
  } catch {
    await removeOwnTemp();
    if (refused()) return false;
    await fs.write(path, data);
  }
  return true;
}

type TauriFs = typeof import('@tauri-apps/plugin-fs');
export const WRITE_AFTER_CREATE_ERROR = 'failed to write bytes to file at path:';
type TauriWriteOptions = import('@tauri-apps/plugin-fs').WriteFileOptions;

export function tauriUserFileFs<D>(fs: TauriFs, write: (path: string, data: D, options?: TauriWriteOptions) => Promise<void>): UserFileFs<D> {
  return {
    lstat: p => fs.lstat(p),
    createNew: async (p, data, mode) => {
      try {
        await write(p, data, { createNew: true, ...(mode === undefined ? {} : { mode }) });
      } catch (err) {
        if (String(err instanceof Error ? err.message : err).startsWith(WRITE_AFTER_CREATE_ERROR)) throw new OwnFileWriteError(err);
        throw err;
      }
    },
    write: (p, data, mode) => write(p, data, mode === undefined ? undefined : { mode }),
    rename: (a, b) => fs.rename(a, b),
    remove: p => fs.remove(p),
  };
}

export async function writeUserTextFileTauri(path: string, text: string): Promise<void> {
  await writeUserFileTauri(path, text);
}

export async function writeUserFileTauri(path: string, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  const fs = await import('@tauri-apps/plugin-fs');
  return typeof data === 'string'
    ? replaceUserFile(tauriUserFileFs<string>(fs, (p, t, o) => fs.writeTextFile(p, t, o)), path, data, refuseBeforePlace)
    : replaceUserFile(tauriUserFileFs<Uint8Array>(fs, (p, b, o) => fs.writeFile(p, b, o)), path, data, refuseBeforePlace);
}

export type NewUserBytesFs = Pick<UserFileFs<Uint8Array>, 'createNew' | 'remove'> & {
  place(from: string, to: string): Promise<PlaceFileOutcome>;
};

export const NEW_NAME_LOG_CHANNEL = 'nieuweNaam';
const logWay = (path: string, way: string) => appLog.emit('event', NEW_NAME_LOG_CHANNEL, `${path}: ${way}`);

async function removeQuietly(fs: Pick<UserFileFs<Uint8Array>, 'remove'>, path: string): Promise<void> {
  try { await fs.remove(path); } catch { }
}

export async function createOwnTemp(
  fs: Pick<UserFileFs<Uint8Array>, 'createNew' | 'remove'>, tmp: string, bytes: Uint8Array, mode?: number,
): Promise<{ failed: null } | { failed: 'forbidden' | 'write'; cause: unknown }> {
  try {
    await fs.createNew(tmp, bytes, mode);
    return { failed: null };
  } catch (error) {
    if (error instanceof OwnFileWriteError) {
      await removeQuietly(fs, tmp);
      return { failed: 'write', cause: error.cause };
    }
    return { failed: isForbiddenPathError(error) ? 'forbidden' : 'write', cause: error };
  }
}

export async function writeNewUserBytes(
  fs: NewUserBytesFs, path: string, bytes: Uint8Array, refuseBeforePlace?: RefuseBeforePlace | null,
): Promise<boolean> {
  const tmp = userFileTempPath(path);
  const removeOwnTemp = () => removeQuietly(fs, tmp);
  const stopped = () => {
    if (refuseBeforePlace?.() !== true) return false;
    logWay(path, 'niet geplaatst (gestopt vóór de plaatsing)');
    return true;
  };
  const directly = async (why: string) => {
    if (stopped()) return false;
    await createNewDirectly(fs, path, bytes, why);
    return true;
  };
  const created = await createOwnTemp(fs, tmp, bytes);
  if (created.failed === 'forbidden') return directly('forbidden path');
  if (created.failed) throw new ByteWriteError('write', created.cause);
  if (stopped()) {
    await removeOwnTemp();
    return false;
  }
  const outcome = await fs.place(tmp, path);
  switch (outcome.code) {
    case 'placed':
      logWay(path, 'geplaatst (placed)');
      return true;
    case 'dir-not-synced':
      logWay(path, 'geplaatst (dir-not-synced)');
      console.warn(`Opgeslagen, maar de map is niet vastgelegd: ${outcome.message}`);
      return true;
    case 'target-exists':
      logWay(path, 'niet geplaatst (target-exists)');
      await removeOwnTemp();
      throw new ByteWriteError('create-new');
    case 'unsupported':
      await removeOwnTemp();
      return directly('unsupported');
    case 'refused':
      if (outcome.reason === 'scope') {
        await removeOwnTemp();
        return directly('refused/scope');
      }
      logWay(path, `niet geplaatst (refused/${outcome.reason})`);
      if (outcome.reason !== 'not-regular-file') await removeOwnTemp();
      throw new ByteWriteError('write', new Error(`place_file_exclusive: refused (${outcome.reason})`));
    case 'source-changed':
      logWay(path, 'niet geplaatst (source-changed)');
      throw new ByteWriteError('source-changed');
    case 'io':
      logWay(path, 'niet geplaatst (io)');
      await removeOwnTemp();
      throw new ByteWriteError('write', new Error(outcome.message));
  }
}

async function createNewDirectly(fs: Pick<NewUserBytesFs, 'createNew' | 'remove'>, path: string, bytes: Uint8Array, why: string): Promise<void> {
  logWay(path, `directe aanmaak (${why})`);
  try {
    await fs.createNew(path, bytes);
  } catch (error) {
    if (!(error instanceof OwnFileWriteError)) throw new ByteWriteError('create-new', error);
    try { await fs.remove(path); } catch { }
    throw new ByteWriteError('write', error.cause);
  }
}

export async function writeNewUserBytesTauri(path: string, bytes: Uint8Array, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  const fs = await import('@tauri-apps/plugin-fs');
  return writeNewUserBytes({
    ...tauriUserFileFs<Uint8Array>(fs, (p, b, o) => fs.writeFile(p, b, o)),
    place: placeFileExclusive,
  }, path, bytes, refuseBeforePlace);
}
