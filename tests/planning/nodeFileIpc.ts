// Testadapter voor de bestaande headless batterijen: de ECHTE plugin-fs-JS-client praat via
// nep-IPC met Node-fs. Bewijst openflags, bytes en OS-bestandssemantiek in CI, niet de Rust-scope,
// de echte desktopruntime of Windows/macOS wanneer CI alleen op Linux draait.
import * as fs from 'node:fs';

interface OpenOptions {
  read?: boolean; write?: boolean; create?: boolean; createNew?: boolean; truncate?: boolean; mode?: number;
}
export function installNodeFileIpc() {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const handles = new Map<number, { fd: number; path: string; written: number }>();
  let nextRid = 1;
  const calls: Array<{ command: string; path?: string; options?: OpenOptions }> = [];
  const faults = {
    beforeOpen: null as ((path: string) => void) | null,
    openError: null as unknown,
    writeErrorAfter: null as number | null,
    writeChunkSize: Number.POSITIVE_INFINITY,
    zeroWrite: false,
    closeError: null as unknown,
    renameError: null as unknown,
    removeError: null as unknown,
    directWriteError: null as unknown,
  };
  const invoke = async (command: string, args: Record<string, unknown> | Uint8Array,
    ipcOptions?: { headers?: Record<string, string> }) => {
    const a = args as Record<string, unknown>;
    const path = typeof a.path === 'string' ? a.path : undefined;
    calls.push({ command, path, options: a.options as OpenOptions | undefined });
    switch (command) {
      case 'plugin:fs|stat':
      case 'plugin:fs|lstat': {
        let st: fs.Stats;
        try {
          st = command === 'plugin:fs|stat' ? fs.statSync(String(path)) : fs.lstatSync(String(path));
        } catch (error) {
          // plugin-fs 2.5.0 get_fs_metadata serialiseert ENOENT als deze string. Alleen Node's
          // concrete ENOENT omzetten: andere fouten mogen geen ontbrekend doel suggereren.
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            throw `failed to get metadata of path: ${path} with error: No such file or directory (os error 2)`;
          }
          throw error;
        }
        return {
          isFile: st.isFile(), isDirectory: st.isDirectory(), isSymlink: st.isSymbolicLink(),
          size: st.size, mtime: st.mtimeMs, atime: st.atimeMs, birthtime: st.birthtimeMs,
          readonly: (st.mode & 0o222) === 0, fileAttributes: null,
          dev: st.dev, ino: st.ino, mode: st.mode, nlink: st.nlink,
          uid: st.uid, gid: st.gid, rdev: st.rdev, blksize: st.blksize, blocks: st.blocks,
        };
      }
      case 'plugin:fs|open': {
        const p = String(path);
        faults.beforeOpen?.(p);
        if (faults.openError !== null) throw faults.openError;
        const o = a.options as OpenOptions;
        const c = fs.constants;
        let flags = o.write ? (o.read === false ? c.O_WRONLY : c.O_RDWR) : c.O_RDONLY;
        if (o.createNew) flags |= c.O_CREAT | c.O_EXCL;
        else {
          if (o.create) flags |= c.O_CREAT;
          if (o.truncate) flags |= c.O_TRUNC;
        }
        const fd = fs.openSync(p, flags, o.mode);
        const rid = nextRid++;
        handles.set(rid, { fd, path: p, written: 0 });
        return rid;
      }
      case 'plugin:fs|write': {
        const h = handles.get(Number(a.rid));
        if (!h) throw new Error('Onbekende bestandshandle');
        if (faults.zeroWrite) return 0;
        if (faults.writeErrorAfter !== null && h.written >= faults.writeErrorAfter) {
          throw new Error('No space left on device (os error 28)');
        }
        const data = a.data as Uint8Array;
        const n = Math.min(data.length, faults.writeChunkSize,
          faults.writeErrorAfter === null ? data.length : faults.writeErrorAfter - h.written);
        const written = fs.writeSync(h.fd, data, 0, n);
        h.written += written;
        return written;
      }
      case 'plugin:resources|close': {
        const rid = Number(a.rid);
        const h = handles.get(rid);
        if (!h) throw new Error('Onbekende bestandshandle');
        fs.closeSync(h.fd);
        handles.delete(rid);
        if (faults.closeError !== null) throw faults.closeError;
        return null;
      }
      case 'plugin:fs|write_text_file':
      case 'plugin:fs|write_file': {
        if (faults.directWriteError !== null) throw faults.directWriteError;
        const headers = ipcOptions?.headers;
        const p = decodeURIComponent(headers?.path ?? '');
        const o = JSON.parse(headers?.options ?? '{}') as { mode?: number } | null;
        fs.writeFileSync(p, args as Uint8Array, { mode: o?.mode });
        return null;
      }
      case 'plugin:fs|rename':
        if (faults.renameError !== null) throw faults.renameError;
        fs.renameSync(String(a.oldPath), String(a.newPath));
        return null;
      case 'plugin:fs|remove':
        if (faults.removeError !== null) throw faults.removeError;
        fs.unlinkSync(String(path));
        return null;
      default: throw new Error(`Onverwacht Tauri-commando in Node-fs-adapter: ${command}`);
    }
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: {
    __TAURI_INTERNALS__: { invoke },
  } });
  return {
    calls, faults,
    openHandles: () => handles.size,
    dispose: () => {
      for (const h of handles.values()) fs.closeSync(h.fd);
      handles.clear();
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    },
  };
}
