import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MCP_DISCOVERY_TMP_SUFFIX, mcpDiscoveryDirs, openFilesWritePolicy, readOpenFilesFile, type PidState,
} from '@/services/mcp/discoveryContract';

export type AppLock = (realPath: string) => Promise<string | null>;

export const noAppLock: AppLock = async () => null;

export function platformDiscoveryDirs(env: Record<string, string | undefined> = process.env): string[] {
  return mcpDiscoveryDirs({ platform: process.platform, home: os.homedir(), env });
}

function errCode(e: unknown): string {
  return e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : 'unknown error';
}

export function nodePidState(pid: number): PidState {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (e) {
    const code = errCode(e);
    if (code === 'ESRCH') return 'dead';
    if (code === 'EPERM') return 'alive';
    return 'unknown';
  }
}

export function isOpenFilesName(name: string): boolean {
  return name.startsWith('open-files') && name.endsWith('.json') && !name.endsWith(MCP_DISCOVERY_TMP_SUFFIX);
}

type Ident =
  | { kind: 'file' }
  | { kind: 'missing'; key: string }
  | { kind: 'uncertain'; code: string };

const notThere = (code: string) => code === 'ENOENT' || code === 'ENOTDIR';

async function identify(p: string): Promise<Ident> {
  if (!path.isAbsolute(p)) return { kind: 'uncertain', code: 'not an absolute path' };
  try {
    await fsp.lstat(p);
  } catch (e) {
    const code = errCode(e);
    if (!notThere(code)) return { kind: 'uncertain', code };
    return missingKey(p);
  }
  try {
    await fsp.stat(await fsp.realpath(p));
    return { kind: 'file' };
  } catch (e) {
    return { kind: 'uncertain', code: errCode(e) };
  }
}

async function missingKey(p: string): Promise<Ident> {
  const tail: string[] = [];
  let cur = p;
  for (;;) {
    const parent = path.dirname(cur);
    if (parent === cur) return { kind: 'uncertain', code: 'no existing parent folder' };
    tail.unshift(path.basename(cur));
    cur = parent;
    try {
      await fsp.lstat(cur);
      break;
    } catch (e) {
      const code = errCode(e);
      if (!notThere(code)) return { kind: 'uncertain', code };
    }
  }
  let realParent: string;
  try {
    realParent = await fsp.realpath(cur);
  } catch (e) {
    return { kind: 'uncertain', code: errCode(e) };
  }
  const key = `${realParent.endsWith(path.sep) ? realParent : realParent + path.sep}${tail.join(path.sep)}`;
  return { kind: 'missing', key: process.platform === 'darwin' || process.platform === 'win32' ? key.toLowerCase() : key };
}

export function openInAppText(realPath: string): string {
  return `'${realPath}' is open in the Open Planner Studio desktop app. The server does not write a file that is ` +
    'open in the app: two programs writing one file lose each other\'s changes. Reading it still works. Save under ' +
    'a different name, or ask the user to close the file in the app or to start the MCP bridge there.';
}

export function appRunningText(realPath: string): string {
  return `Open Planner Studio is running, so the server does not replace the existing file '${realPath}': the app may ` +
    'have it open, also when it opened it just now. Two programs writing one file lose each other\'s changes. Reading ' +
    'it still works. Save under a new file name, or ask the user to start the MCP bridge in the app or to close the app.';
}

export function registerUnusableText(where: string, detail: string): string {
  return `Open Planner Studio may be running, but its list of open files '${where}' cannot be used (${detail}). ` +
    'Until that is solved, the server writes no file at all; reading still works. ' +
    'Ask the user to close Open Planner Studio or to start the MCP bridge there. If the app is newer than this ' +
    'server, update the server.';
}

export function identityUncertainText(realPath: string, side: 'target' | 'open-file', code: string): string {
  return side === 'target'
    ? `The server cannot establish the identity of '${realPath}' (${code}), so it cannot rule out that this file ` +
      'is open in the Open Planner Studio desktop app. It does not write there. Save under a different name, or ' +
      'ask the user to close the file in the app or to start the MCP bridge there.'
    : `The server cannot establish the identity of a file that is open in the Open Planner Studio desktop app ` +
      `(${code}), so it cannot rule out that '${realPath}' is that file. It does not write while that is uncertain. ` +
      'Ask the user to close that file in the app or to start the MCP bridge there.';
}

export interface AppLockDeps {
  pidState?: (pid: number) => PidState;
}

export function createAppLock(dirs: readonly string[], deps: AppLockDeps = {}): AppLock {
  const pidState = deps.pidState ?? nodePidState;
  return async (realPath) => {
    const listed: string[] = [];
    let appRunning = false;
    for (const dir of dirs) {
      let names: string[];
      try {
        names = await fsp.readdir(dir);
      } catch (e) {
        const code = errCode(e);
        if (notThere(code)) continue;
        return registerUnusableText(dir, code);
      }
      for (const name of names.filter(isOpenFilesName).sort()) {
        const file = path.join(dir, name);
        let text: string | null;
        try {
          text = await fsp.readFile(file, 'utf8');
        } catch (e) {
          const code = errCode(e);
          if (code !== 'ENOENT') return registerUnusableText(file, code);
          text = null;
        }
        const read = readOpenFilesFile(text);
        const policy = openFilesWritePolicy(read, pidState);
        if (policy === 'refuse-all') return registerUnusableText(file, 'it is damaged or in a format this server does not know');
        if (policy === 'check-files' && read.status === 'valid') {
          appRunning = true;
          listed.push(...read.file.files);
        }
      }
    }
    if (!appRunning) return null;
    const target = await identify(realPath);
    if (target.kind === 'uncertain') return identityUncertainText(realPath, 'target', target.code);
    if (target.kind === 'file') return appRunningText(realPath);
    for (const p of listed) {
      const id = await identify(p);
      if (id.kind === 'uncertain') return identityUncertainText(realPath, 'open-file', id.code);
      if (id.kind === 'missing' && id.key === target.key) return openInAppText(realPath);
    }
    return null;
  };
}
