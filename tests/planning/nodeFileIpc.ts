// Testadapter voor de bestaande headless batterijen: de ECHTE plugin-fs-JS-client praat via
// nep-IPC met Node-fs. Bewijst openflags, bytes en OS-bestandssemantiek in CI, niet de Rust-scope,
// de echte desktopruntime of Windows/macOS wanneer CI alleen op Linux draait.
// De adapter zit op `window.__TAURI_INTERNALS__.invoke`: precies de payload die Tauri daarna als rauwe
// body of als JSON verstuurt (`rawBody`/`bytesInObject` per aanroep). Of de echte webview de rauwe route
// neemt of terugvalt op `postMessage`, bewijst dit niet.
import * as fs from 'node:fs';

interface OpenOptions {
  read?: boolean; write?: boolean; create?: boolean; createNew?: boolean; truncate?: boolean; append?: boolean; mode?: number;
}
interface IpcCall {
  command: string; path?: string; options?: OpenOptions;
  /** De payload is zelf een `Uint8Array`/`ArrayBuffer`: Tauri stuurt hem als rauwe body. */
  rawBody: boolean;
  /** Ergens in een object-payload zit een `Uint8Array`/`ArrayBuffer`: Tauri maakt daar JSON van, één getal per byte. */
  bytesInObject: boolean;
  /** Er is werkelijk een bestand voor schrijven geopend (of via een handle geschreven); een geweigerde
   *  aanmaak of opening telt niet. */
  wrote: boolean;
  /** `writeFile`/`writeTextFile`: de opties in de kop waren niet te lezen; de aanroep faalde. */
  optionsError?: string;
}

/** `writeFile`/`writeTextFile`: de bytes als hele payload, met de opties in de kop. */
export const writeFileCall = (c: { command: string }): boolean =>
  c.command === 'plugin:fs|write_file' || c.command === 'plugin:fs|write_text_file';
/** Elke aanroep die bytes naar een bestand schrijft, ook via een open handle. */
export const byteWrite = (c: { command: string }): boolean => c.command === 'plugin:fs|write' || writeFileCall(c);

const isBytes = (value: unknown): boolean => value instanceof ArrayBuffer || ArrayBuffer.isView(value);
const containsBytes = (value: unknown): boolean => isBytes(value)
  || (value !== null && typeof value === 'object' && Object.values(value).some(containsBytes));

/** De kop `options` van `writeFile`/`writeTextFile` zoals `parse_write_file_options` in tauri-plugin-fs
 *  2.7.1 (`commands.rs:1212-1224`) hem leest: geen kop, leeg, `undefined` of `null` ⇒ de standaarden;
 *  anders moet het `WriteFileOptions` zijn, of de aanroep faalt (sinds 2.6.0; daarvóór vielen onleesbare
 *  opties stil terug op aanmaken en afkappen, ook zonder `createNew`). Onbekende velden telt serde niet. */
function sentWriteOptions(header: string | undefined): { options?: OpenOptions; error?: string } {
  const text = header?.trim() ?? '';
  if (text === '' || text === 'undefined' || text === 'null') return {};
  const invalid = (why: string) => ({ error: `invalid write file options ${text}: ${why}` });
  let o: unknown;
  try { o = JSON.parse(text); } catch (error) { return invalid(String(error)); }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return invalid('expected struct WriteFileOptions');
  const v = o as Record<string, unknown>;
  for (const key of ['append', 'create', 'createNew'] as const) {
    if (v[key] !== undefined && typeof v[key] !== 'boolean') return invalid(`invalid type for ${key}, expected a boolean`);
  }
  const u32 = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffff_ffff;
  if (v.mode !== undefined && v.mode !== null && !u32(v.mode)) return invalid('invalid type for mode, expected u32');
  if (v.baseDir !== undefined && v.baseDir !== null && !u32(v.baseDir)) return invalid('invalid value for baseDir');
  return { options: o as OpenOptions };
}

/** Zoals `write_file_inner` in tauri-plugin-fs 2.7.1 (`commands.rs:1125-1210`): uit de opties in de kop;
 *  zijn die er niet, dan gelden de standaarden (aanmaken en afkappen). */
function writeFileOpenOptions(o: OpenOptions | undefined): OpenOptions {
  if (o === undefined) {
    return { read: false, write: true, create: true, truncate: true, append: false, createNew: false };
  }
  const append = o.append ?? false;
  return {
    read: false, write: true, create: o.create ?? true, truncate: !append, append, createNew: o.createNew ?? false,
    ...(o.mode === undefined ? {} : { mode: o.mode }),
  };
}

/**
 * Het pad waarop het systeem werkt, zoals `resolve_real_path` in tauri-plugin-fs 2.7.1
 * (`commands.rs:1673-1725`): het canonieke pad als het bestaat, anders het canonieke pad van de
 * dichtstbijzijnde bestaande bovenliggende map met de rest erachter; een dode link wordt gevolgd (een
 * relatief doel vanaf de map van de link), een lus geeft een fout. Voor proeven die de scopecontrole van
 * 2.7.1 nabootsen via `faults.forbidden` (alleen Unix-paden).
 */
export function realPath(path: string, followed = 0): string {
  try { return fs.realpathSync.native(path); } catch { /* bestaat niet, of een dode link */ }
  if (fs.lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) {
    if (followed >= 40) throw new Error('too many levels of symbolic links');
    const target = fs.readlinkSync(path);
    const slash = path.lastIndexOf('/');
    return realPath(target.startsWith('/') ? target : `${path.slice(0, slash + 1)}${target}`, followed + 1);
  }
  const trimmed = path.replace(/\/+$/, '');
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0) return path;
  const parent = trimmed.slice(0, slash), last = trimmed.slice(slash + 1);
  if (last === '..') return realPath(parent, followed).replace(/\/[^/]*$/, '') || '/';
  if (last === '.' || last === '') return realPath(parent, followed);
  return `${realPath(parent, followed)}/${last}`;
}

function openFlags(o: OpenOptions): number {
  const c = fs.constants;
  let flags = o.write ? (o.read === false ? c.O_WRONLY : c.O_RDWR) : c.O_RDONLY;
  // Zoals std::fs::OpenOptions: createNew negeert create en truncate.
  if (o.createNew) flags |= c.O_CREAT | c.O_EXCL;
  else {
    if (o.create) flags |= c.O_CREAT;
    if (o.truncate) flags |= c.O_TRUNC;
  }
  if (o.append) flags |= c.O_APPEND;
  return flags;
}

export function installNodeFileIpc() {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const handles = new Map<number, { fd: number; path: string; written: number; readAt: number }>();
  let nextRid = 1;
  const calls: IpcCall[] = [];
  const faults = {
    /** Vlak vóór elke opening van een bestand (`open` en `write_file`), met het pad. */
    beforeOpen: null as ((path: string) => void) | null,
    /** Paden buiten de scope: `open` en `write_file` weigeren ze met de tekst van plugin-fs. */
    forbidden: null as ((path: string) => boolean) | null,
    writeErrorAfter: null as number | null,
    renameError: null as unknown,
    removeError: null as unknown,
    directWriteError: null as unknown,
    readError: null as unknown,
  };
  let bytesRead = 0;
  let seeks = 0;
  const invoke = async (command: string, args: Record<string, unknown> | Uint8Array,
    ipcOptions?: { headers?: Record<string, string> }) => {
    const a = args as Record<string, unknown>;
    const rawBody = isBytes(args);
    const bytesInObject = !rawBody && containsBytes(args);
    const writeFile = command === 'plugin:fs|write_file' || command === 'plugin:fs|write_text_file';
    const path = writeFile ? decodeURIComponent(ipcOptions?.headers?.path ?? '') : typeof a.path === 'string' ? a.path : undefined;
    const sent = writeFile ? sentWriteOptions(ipcOptions?.headers?.options) : {};
    const callOptions = writeFile ? sent.options : a.options as OpenOptions | undefined;
    const call: IpcCall = { command, path, options: callOptions, optionsError: sent.error, rawBody, bytesInObject, wrote: false };
    calls.push(call);
    switch (command) {
      case 'plugin:fs|stat':
      case 'plugin:fs|lstat': {
        let st: fs.Stats;
        try {
          st = command === 'plugin:fs|stat' ? fs.statSync(String(path)) : fs.lstatSync(String(path));
        } catch (error) {
          // plugin-fs 2.7.1 get_fs_metadata serialiseert ENOENT als deze string (zoals 2.5.0). Alleen Node's
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
        if (faults.forbidden?.(p)) throw `forbidden path: ${p}`;
        const o = a.options as OpenOptions;
        const fd = fs.openSync(p, openFlags(o), o.mode);
        call.wrote = o.write === true;
        const rid = nextRid++;
        handles.set(rid, { fd, path: p, written: 0, readAt: 0 });
        return rid;
      }
      case 'plugin:fs|write': {
        const h = handles.get(Number(a.rid));
        if (!h) throw new Error('Onbekende bestandshandle');
        if (faults.writeErrorAfter !== null && h.written >= faults.writeErrorAfter) {
          throw new Error('No space left on device (os error 28)');
        }
        const data = a.data as Uint8Array;
        call.wrote = true;
        const n = Math.min(data.length, faults.writeErrorAfter === null ? data.length : faults.writeErrorAfter - h.written);
        const written = fs.writeSync(h.fd, data, 0, n);
        h.written += written;
        return written;
      }
      case 'plugin:fs|read': {
        // plugin-fs 2.7.1 `FileHandle.read` (`commands.rs:511-555`): alleen de gelezen bytes, met het aantal als
        // 8 bytes big-endian erachter (0 = EOF). 2.5.x stuurde de hele gevraagde lengte; de JS-client leest in
        // beide gevallen het aantal uit de laatste 8 bytes.
        const h = handles.get(Number(a.rid));
        if (!h) throw new Error('Onbekende bestandshandle');
        if (faults.readError !== null) throw faults.readError;
        const len = Number(a.len);
        const out = new Uint8Array(len + 8);
        // Lezen op een eigen positie, zodat `plugin:fs|seek` werkt (Node-fs kent geen lseek).
        const n = fs.readSync(h.fd, out, 0, len, h.readAt);
        h.readAt += n;
        bytesRead += n;
        const result = new Uint8Array(n + 8);
        result.set(out.subarray(0, n));
        new DataView(result.buffer).setBigUint64(n, BigInt(n));
        return result;
      }
      case 'plugin:fs|seek': {
        // plugin-fs 2.7.1 `FileHandle.seek(offset, whence)`: 0 = vanaf het begin, 1 = vanaf nu, 2 = vanaf het einde;
        // een negatieve offset vanaf het begin weigert het vóór de handle (`commands.rs:884-902`, sinds 2.7.0).
        const offset = Number(a.offset);
        const whence = Number(a.whence);
        if (whence === 0 && offset < 0) {
          throw `invalid seek offset ${offset}: it must not be negative with SeekMode.Start`;
        }
        const h = handles.get(Number(a.rid));
        if (!h) throw new Error('Onbekende bestandshandle');
        const from = whence === 0 ? 0 : whence === 1 ? h.readAt : fs.fstatSync(h.fd).size;
        if (from + offset < 0) throw new Error('Invalid argument (os error 22)');
        h.readAt = from + offset;
        seeks++;
        return h.readAt;
      }
      case 'plugin:resources|close': {
        const rid = Number(a.rid);
        const h = handles.get(rid);
        if (!h) throw new Error('Onbekende bestandshandle');
        fs.closeSync(h.fd);
        handles.delete(rid);
        return null;
      }
      case 'plugin:fs|write_text_file':
      case 'plugin:fs|write_file': {
        // plugin-fs 2.7.1 `write_file_inner`: leest eerst de opties uit de kop (onleesbaar ⇒ fout, vóór het
        // openen), opent daarmee en schrijft met write_all; een rauwe body gaat letterlijk door, een
        // JSON-lijst moet uit bytes bestaan (0–255), anders faalt de aanroep (sinds 2.6.0).
        if (sent.error !== undefined) throw sent.error;
        const p = String(path), o = writeFileOpenOptions(callOptions);
        faults.beforeOpen?.(p);
        if (faults.forbidden?.(p)) throw `forbidden path: ${p}`;
        if (!o.createNew && !o.append && faults.directWriteError !== null) throw faults.directWriteError;
        const notByte = Array.isArray(args) ? (args as unknown[]).find(v => !(Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 255)) : undefined;
        if (notByte !== undefined) throw `invalid byte in the data to write: ${JSON.stringify(notByte)}`;
        const data = ArrayBuffer.isView(args) ? new Uint8Array(args.buffer, args.byteOffset, args.byteLength)
          : args instanceof ArrayBuffer ? new Uint8Array(args)
            : Array.isArray(args) ? Uint8Array.from(args as number[]) : null;
        if (data === null) throw new Error('unexpected invoke body');
        // De fouttekst van `write_file_inner`: openen en schrijven geven elk hun eigen begin.
        let fd: number;
        try { fd = fs.openSync(p, openFlags(o), o.mode); }
        catch (error) { throw `failed to open file at path: ${p} with error: ${error instanceof Error ? error.message : String(error)}`; }
        call.wrote = true;
        try {
          const size = fs.fstatSync(fd).size;
          const room = faults.writeErrorAfter === null ? data.length : Math.max(0, faults.writeErrorAfter - size);
          const n = Math.min(data.length, room);
          if (n > 0) fs.writeSync(fd, data, 0, n);
          if (n < data.length) throw `failed to write bytes to file at path: ${p} with error: No space left on device (os error 28)`;
        } finally { fs.closeSync(fd); }
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
    /** Zoveel bytes las `plugin:fs|read` in totaal. */
    bytesRead: () => bytesRead,
    /** Zo vaak vroeg de lezer `plugin:fs|seek`. */
    seeks: () => seeks,
    dispose: () => {
      for (const h of handles.values()) fs.closeSync(h.fd);
      handles.clear();
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    },
  };
}
