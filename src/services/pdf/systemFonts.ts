// Waar het eigen rapportlettertype vandaan komt (issue #770, besluit Ethan 14 november 2026, keuze 2c): de
// lijst van de computer waar dat kan, en altijd een lettertypebestand als tweede weg.
//
// - Desktopapp (Windows, macOS, Linux): de app leest de lettertypemappen zelf, via plugin-fs, met een
//   scope op die mappen voor alleen `read_dir`, `open` en `read_file` (`src-tauri/capabilities/default.json`). De webviews van macOS en Linux
//   kennen `queryLocalFonts` niet, dus één route voor alle drie. Per bestand alleen kop, naamtabel en OS/2.
// - Browser: alleen Chrome en Edge (`queryLocalFonts`, na een toestemmingsvraag van de browser).
// - Overal: een `.ttf`/`.otf`/`.ttc` dat de planner kiest.
// Alle drie eindigen in {@link PickedFont}: losse bestanden voor gewoon en (als die er is) vet.
import {
  bytesReader, extractFace, groupFontFamilies, readFontFaces,
  type ByteReader, type FontFaceInfo, type FontFamilyChoice, type FontRefusal,
} from './customReportFont';

export interface PickedFont {
  name: string;
  regular: Uint8Array;
  /** `null`: geen vette variant (besluit 3a: vet in de gewone letter, met een melding). */
  bold: Uint8Array | null;
}

/** Waarom een keuze niet doorging: een weigering met reden, of het bestand is geen (leesbaar) lettertype. */
export type FontPickFailure = FontRefusal | 'unreadable';

export class FontPickError extends Error {
  constructor(readonly reason: FontPickFailure) {
    super(`Lettertype niet bruikbaar: ${reason}`);
    this.name = 'FontPickError';
  }
}

export interface SystemFontFamily {
  name: string;
  /** De reden waarom de familie niet kiesbaar is; `undefined` = nog niet bekend (browser: pas bij kiezen). */
  refusal: FontRefusal | null | undefined;
  load(): Promise<PickedFont>;
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Kan de app hier de lettertypen van de computer opsommen? Desktop altijd; browser alleen Chrome/Edge. */
export function canListSystemFonts(): boolean {
  return isTauri() || (typeof window !== 'undefined' && 'queryLocalFonts' in window);
}

/** Een face met de plek waar zijn bytes vandaan komen. */
interface SourcedFace extends FontFaceInfo {
  bytes(): Promise<Uint8Array>;
}

async function pickedFrom(choice: FontFamilyChoice<SourcedFace>): Promise<PickedFont> {
  if (choice.refusal || !choice.regular) throw new FontPickError(choice.refusal ?? 'noRegular');
  const extract = async (face: SourcedFace) => extractFace(bytesReader(await face.bytes()), face);
  try {
    const [regular, bold] = await Promise.all([extract(choice.regular), choice.bold ? extract(choice.bold) : null]);
    return { name: choice.family, regular, bold };
  } catch (err) {
    if (err instanceof FontPickError) throw err;
    throw new FontPickError('unreadable');
  }
}

/**
 * Een of meer lettertypebestanden die de planner koos. Uit de faces van alle bestanden samen kiest dit de
 * eerste familie op naam die bruikbaar is (gewoon + zo mogelijk vet); is geen enkele bruikbaar, dan de reden
 * van de eerste.
 */
export async function fontFromFiles(files: readonly File[]): Promise<PickedFont> {
  const faces: SourcedFace[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let found: FontFaceInfo[];
    try { found = await readFontFaces(bytesReader(bytes)); } catch { continue; }
    faces.push(...found.map(face => ({ ...face, bytes: async () => bytes })));
  }
  const families = groupFontFamilies(faces);
  if (families.length === 0) throw new FontPickError('unreadable');
  return pickedFrom(families.find(f => f.refusal === null) ?? families[0]);
}

/**
 * De lettertypen van de computer, per familie op naam. Desktop: met de reden erbij voor wat niet kiesbaar is.
 * Browser: na de toestemmingsvraag; de reden blijkt daar pas bij het kiezen (de bytes lezen kost per lettertype
 * het hele bestand). Gooit als de browser geen toegang geeft.
 */
export async function listSystemFonts(): Promise<SystemFontFamily[]> {
  return isTauri() ? listDesktopFonts() : listBrowserFonts();
}

// ── Browser (Chrome/Edge) ───────────────────────────────────────────────────────────────────────

interface LocalFontData {
  family: string;
  style: string;
  postscriptName: string;
  blob(): Promise<Blob>;
}

async function listBrowserFonts(): Promise<SystemFontFamily[]> {
  const query = (window as unknown as { queryLocalFonts?: () => Promise<LocalFontData[]> }).queryLocalFonts;
  if (!query) return [];
  const all = await query.call(window);
  const byFamily = new Map<string, LocalFontData[]>();
  for (const font of all) {
    const list = byFamily.get(font.family);
    if (list) list.push(font); else byFamily.set(font.family, [font]);
  }
  return [...byFamily].map(([name, fonts]): SystemFontFamily => ({
    name,
    refusal: undefined,
    load: async () => {
      // Alleen de rechte stijlen; per bestand de face met dezelfde PostScript-naam (een collectie bevat er meer).
      const faces: SourcedFace[] = [];
      for (const font of fonts.filter(f => !/italic|oblique/i.test(f.style))) {
        try {
          const bytes = new Uint8Array(await (await font.blob()).arrayBuffer());
          const found = await readFontFaces(bytesReader(bytes));
          const face = found.find(f => f.postscriptName === font.postscriptName) ?? (found.length === 1 ? found[0] : undefined);
          if (face) faces.push({ ...face, family: name, bytes: async () => bytes });
        } catch { /* een onleesbaar lettertype slaat de rest van de familie niet over */ }
      }
      const [choice] = groupFontFamilies(faces);
      if (!choice) throw new FontPickError('unreadable');
      return pickedFrom(choice);
    },
  })).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

// ── Desktop ─────────────────────────────────────────────────────────────────────────────────────

/** De lettertypemappen per besturingssysteem; dezelfde paden staan als scope in de capability (lezen, openen, map lezen). */
async function desktopFontDirs(): Promise<string[]> {
  const [{ platform }, { homeDir, join }] = await Promise.all([import('@tauri-apps/plugin-os'), import('@tauri-apps/api/path')]);
  const home = await homeDir();
  switch (platform()) {
    case 'windows':
      return ['C:\\Windows\\Fonts', await join(home, 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts')];
    case 'macos':
      return ['/System/Library/Fonts', '/Library/Fonts', await join(home, 'Library', 'Fonts')];
    default:
      return ['/usr/share/fonts', '/usr/local/share/fonts', await join(home, '.local', 'share', 'fonts'), await join(home, '.fonts')];
  }
}

const FONT_FILE = /\.(ttf|otf|ttc)$/i;

let desktopList: Promise<SystemFontFamily[]> | null = null;

/** Eén keer per sessie: honderden bestanden openen kost een paar seconden. */
function listDesktopFonts(): Promise<SystemFontFamily[]> {
  desktopList ??= readDesktopFonts().catch(err => { desktopList = null; throw err; });
  return desktopList;
}

async function readDesktopFonts(): Promise<SystemFontFamily[]> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const files: string[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    let entries: Awaited<ReturnType<typeof fs.readDir>>;
    try { entries = await fs.readDir(dir); } catch { return; } // map bestaat niet of is niet leesbaar
    for (const entry of entries) {
      const path = await join(dir, entry.name);
      if (entry.isDirectory && depth < 6) await walk(path, depth + 1);
      else if (entry.isFile && FONT_FILE.test(entry.name)) files.push(path);
    }
  };
  for (const dir of await desktopFontDirs()) await walk(dir, 0);

  const faces: SourcedFace[] = [];
  const readOne = async (path: string) => {
    let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
    try {
      handle = await fs.open(path, { read: true });
      const h = handle;
      const read: ByteReader = async (offset, length) => {
        await h.seek(offset, fs.SeekMode.Start);
        const buf = new Uint8Array(length);
        let filled = 0;
        while (filled < length) {
          const n = await h.read(buf.subarray(filled));
          if (!n) break;
          filled += n;
        }
        return buf.subarray(0, filled);
      };
      const found = await readFontFaces(read);
      faces.push(...found.map(face => ({ ...face, bytes: () => fs.readFile(path) })));
    } catch { /* geen lettertype of niet leesbaar: overslaan */ } finally {
      await handle?.close().catch(() => undefined);
    }
  };
  // Een paar tegelijk: elk bestand kost een handvol kleine leesacties.
  for (let i = 0; i < files.length; i += 8) await Promise.all(files.slice(i, i + 8).map(readOne));

  return groupFontFamilies(faces).map((choice): SystemFontFamily => ({
    name: choice.family,
    refusal: choice.refusal,
    load: () => pickedFrom(choice),
  }));
}
