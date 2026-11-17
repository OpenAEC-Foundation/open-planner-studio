/**
 * #804, knownbug 1131 stap 5 (deel a): het eigen bestand van een document met een gebouwmodel op de desktop vervangen,
 * zonder dat ooit een versie verloren gaat die de app niet zelf gecontroleerd heeft (ontwerp §4.10, "Bestand buiten
 * de app vervangen", stappen 1 tot en met 5; stap 0 en 6 zijn het herstelmanifest, `state/ownFileReplace.ts`).
 *
 * 1. De hele uitvoer in één `createNew`-aanroep naar `save-<id>.ops-save.tmp` in dezelfde map (geen directe aanmaak
 *    als terugval: dit is geen nieuwe naam).
 * 2. Het doel opnieuw vergelijken met de bron in het geheugen (`sourceTargetContent`, in stukken van 1 MiB).
 * 3. Het doel met `place_file_exclusive` naar `<naam>.ops-vorige-<id>`.
 * 4. Het tijdelijke bestand met `place_file_exclusive` naar het doel.
 * 5. `.ops-vorige` opnieuw vergelijken met de bron. Gelijk: verwijderen. Anders schreef een ander programma via een al
 *    open handle in het oude bestand: exclusief naar `<naam> (versie van ander programma <datum tijd>).ifc`.
 *
 * Geen stap vervangt een bestaand bestand; er is geen directe terugval (§4.10: buiten de scope, bij een gelinkt doel of
 * als een stap faalt, schrijft de app niet en biedt hij Opslaan als aan). Garantie: elke versie die op het doelpad
 * stond, staat daarna nog als bestand (op het doel, als `.ops-vorige` of onder de naam "versie van ander programma"),
 * of de vervanging stopt. Grens: een programma dat via een al open handle schrijft tussen de controle van stap 5 en het
 * verwijderen (één systeemaanroep), en de grens van het commando zelf (knownbugs 1795 en 1799).
 */
import { isForbiddenPathError, OwnFileWriteError, tauriUserFileFs, userFileDir, userFileTempPath } from './atomicWrite';
import { missingTarget } from './fileIdentity';
import { sourceTargetContentOfPathTauri } from './tauriBackend';
import { placeFileExclusive, type PlaceFileOutcome } from './placeFileExclusive';
import type { SourceTargetContent } from './sourceTargetContent';

/** De bestandsbewerkingen van de vervanging; injecteerbaar voor de proeven (`tests/planning/nodeFileIpc.ts`). */
export interface OwnFileReplaceFs {
  lstat(path: string): Promise<{ isSymlink: boolean; nlink: number | null; mode: number | null }>;
  /** Zie `UserFileFs.createNew`: alleen een `OwnFileWriteError` geeft eigendom van een onvolledig bestand. */
  createNew(path: string, data: Uint8Array, mode?: number): Promise<void>;
  remove(path: string): Promise<void>;
  place(from: string, to: string): Promise<PlaceFileOutcome>;
  /** Staat op `path` precies `expected`? (`sourceTargetContent`) */
  content(path: string, expected: Uint8Array): Promise<SourceTargetContent>;
}

/** De vorige versie van het doel tijdens een vervanging: `<naam>.ops-vorige-<id>`, naast het doel. */
export function previousVersionPath(path: string, id: string): string {
  return `${path}.ops-vorige-${id}`;
}

/** De twee kopieën van §4.10, "Namen van de kopieën": de versie van een ander programma en de eigen planning die na
 *  een crash niet op het doel kwam. */
export type ReplaceCopyKind = 'other-program' | 'unsaved-schedule';
/** Het deel tussen haakjes, in de taal van de app (`i18n/replaceCopyName.ts`). */
export type ReplaceCopyLabel = (kind: ReplaceCopyKind) => string;

/** `<map>/<naam> (<label>).<ext>`, in dezelfde map als het doel. */
export function replaceCopyPath(path: string, label: string): string {
  const dir = userFileDir(path), base = path.slice(dir.length), dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
  return `${dir}${stem} (${label})${ext}`;
}

const placedOk = (outcome: PlaceFileOutcome) => outcome.code === 'placed' || outcome.code === 'dir-not-synced';
const describePlace = (outcome: PlaceFileOutcome) =>
  `place_file_exclusive: ${outcome.code}${outcome.code === 'refused' ? ` (${outcome.reason})` : ''}`
  + ('message' in outcome ? `: ${outcome.message}` : '');

/** Elke uitkomst van de vervanging. Alleen `replaced` zet de nieuwe versie op het doel. */
export type OwnFileReplaceOutcome =
  /** Het doel heeft de nieuwe versie. `otherVersion`: waar de versie van een ander programma nu staat (stap 5);
   *  `leftOver`: een `.ops-vorige` die niet weg of opzij kon (onleesbaar, of verwijderen of verplaatsen mislukte). */
  | { code: 'replaced'; otherVersion: string | null; leftOver: string | null }
  /** Stap 2: op het doel staat niet meer de bron. Niets veranderd, het eigen tijdelijke bestand is weg. */
  | { code: 'target-changed'; content: Exclude<SourceTargetContent, 'same'> }
  /** Vervangen kan hier niet veilig (gelinkt doel, buiten de scope, het bestandssysteem kent de exclusieve stap niet,
   *  of het commando weigert): het doel staat er zoals het stond. Alleen Opslaan als. */
  | { code: 'save-as-only'; why: string }
  /** Niet vervangen; het doel staat er zoals het stond (stap 1, stap 3, of stap 4 na het terugzetten). */
  | { code: 'failed'; detail: string }
  /** `source-changed` in stap 3 of 4: de stand op schijf is onbekend. Niets teruggezet, niets opgeruimd. */
  | { code: 'unknown' }
  /** Stap 4: er stond weer een bestand op het doel. Alle drie de bestanden blijven staan. */
  | { code: 'target-taken'; target: string; temp: string; previous: string }
  /** Stap 4 faalde om een andere reden en ook het terugzetten van de vorige versie lukte niet: die staat in `previous`. */
  | { code: 'previous-stranded'; previous: string; detail: string };

export interface OwnFileReplaceInput {
  /** Het doel: het eigen bestand van het document. */
  path: string;
  /** Het id van de hulpnamen, gelijk aan `pendingReplace.id` in het manifest. */
  id: string;
  /** De voorbereide uitvoer (`PreparedIfcWrite.bytes`); de aanroeper wijzigt die niet tot de vervanging klaar is. */
  bytes: Uint8Array;
  /** De bron in het geheugen (`ifcSource.bytes`): wat er op het doel hoort te staan. */
  source: Uint8Array;
  /** De modus van het oude bestand voor het nieuwe (Unix); de umask kan haar beperken. */
  mode?: number;
  label: ReplaceCopyLabel;
}

/** Is het doel een link (symbolisch, of een harde link met meer namen)? Dan vervangt de app niet (§4.10). Een doel dat
 *  niet te bekijken is, komt in stap 2 als weg of onleesbaar terug. */
export async function linkedOwnFile(fs: Pick<OwnFileReplaceFs, 'lstat'>, path: string): Promise<{ linked: boolean; mode?: number }> {
  try {
    const info = await fs.lstat(path);
    return { linked: info.isSymlink || (info.nlink ?? 1) > 1, ...(info.mode != null ? { mode: info.mode & 0o777 } : {}) };
  } catch {
    return { linked: false };
  }
}

/** Stap 1 tot en met 5 van §4.10. Gooit alleen bij een onverwachte fout van een bestandsbewerking; dan ruimt de
 *  functie niets op. */
export async function replaceOwnFileBytes(fs: OwnFileReplaceFs, input: OwnFileReplaceInput): Promise<OwnFileReplaceOutcome> {
  const { path, id, bytes, source } = input;
  const temp = userFileTempPath(path, id), previous = previousVersionPath(path, id);
  const removeOwnTemp = async () => {
    try { await fs.remove(temp); } catch { /* blijft achter; het id staat niet meer in het manifest */ }
  };

  // Stap 1. Geen eigendom bij een mislukte aanmaak (ook EEXIST op de hulpnaam): niets verwijderen.
  try {
    await fs.createNew(temp, bytes, input.mode);
  } catch (error) {
    if (error instanceof OwnFileWriteError) {
      await removeOwnTemp();
      return { code: 'failed', detail: String(error.message) };
    }
    if (isForbiddenPathError(error)) return { code: 'save-as-only', why: 'forbidden path' };
    return { code: 'failed', detail: error instanceof Error ? error.message : String(error) };
  }

  // Stap 2.
  const content = await fs.content(path, source);
  if (content !== 'same') {
    await removeOwnTemp();
    return { code: 'target-changed', content };
  }

  // Stap 3. Alleen `source-changed` laat het tijdelijke bestand staan: de stand op schijf is onbekend.
  const aside = await fs.place(path, previous);
  if (!placedOk(aside)) {
    if (aside.code === 'source-changed') return { code: 'unknown' };
    await removeOwnTemp();
    if (aside.code === 'unsupported' || aside.code === 'refused') return { code: 'save-as-only', why: describePlace(aside) };
    return { code: 'failed', detail: describePlace(aside) };
  }

  // Stap 4.
  const placed = await fs.place(temp, path);
  if (!placedOk(placed)) {
    if (placed.code === 'source-changed') return { code: 'unknown' };
    if (placed.code === 'target-exists') return { code: 'target-taken', target: path, temp, previous };
    // Een andere reden: de vorige versie exclusief terug op het doel.
    const back = await fs.place(previous, path);
    if (back.code === 'source-changed') return { code: 'unknown' };
    await removeOwnTemp();
    if (!placedOk(back)) return { code: 'previous-stranded', previous, detail: `${describePlace(placed)}; ${describePlace(back)}` };
    return { code: 'failed', detail: describePlace(placed) };
  }

  // Stap 5.
  // MUTATIE (b): .ops-vorige verwijderen zonder narekenen.
  const before: SourceTargetContent = 'same';
  if (before === 'missing') return { code: 'replaced', otherVersion: null, leftOver: null };
  if (before === 'same') {
    try {
      await fs.remove(previous);
      return { code: 'replaced', otherVersion: null, leftOver: null };
    } catch {
      return { code: 'replaced', otherVersion: null, leftOver: previous };
    }
  }
  if (before === 'changed') {
    const copy = replaceCopyPath(path, input.label('other-program'));
    if (placedOk(await fs.place(previous, copy))) return { code: 'replaced', otherVersion: copy, leftOver: null };
  }
  return { code: 'replaced', otherVersion: null, leftOver: previous };
}

// ── Restbestanden na een crash (§4.10) ──────────────────────────────────────────────────────────────────────────

/** Wat het manifest van een onderbroken vervanging weet: het doel, het id en de drie versies. */
export interface PendingReplaceRecord {
  path: string;
  id: string;
  /** De versie die de app in stap 2 op het doel controleerde. */
  vorigeSha256: string;
  /** De versie die op het doel zou komen. */
  pendingSha256: string;
  /** De bron van het document volgens het manifest (gewoonlijk gelijk aan `vorigeSha256`). */
  sha256: string;
}

export interface ReplaceRemnantsFs {
  /** De inhoud van een gewoon bestand; `null` als er niets staat. Een link of een leesfout gooit. */
  read(path: string): Promise<Uint8Array | null>;
  remove(path: string): Promise<void>;
  place(from: string, to: string): Promise<PlaceFileOutcome>;
}

/** Wat het opruimen deed; alleen dat wat de planner moet weten. */
export type RemnantEvent =
  /** De vorige versie stond naast een leeg doel en staat er weer op. */
  | { kind: 'previous-back'; target: string }
  /** Een `.ops-vorige` met een andere inhoud: de versie van een ander programma, nu onder deze naam. */
  | { kind: 'other-version'; target: string; copy: string }
  /** Het tijdelijke bestand met de volledige nieuwe planning, die niet op het doel kwam, nu onder deze naam. */
  | { kind: 'unsaved-schedule'; target: string; copy: string }
  /** Een restbestand dat de app niet zeker kon thuisbrengen; het blijft staan. */
  | { kind: 'left-over'; target: string; path: string };

type Seen = string | 'missing' | 'unreadable';

/**
 * De restbestanden van één onderbroken vervanging thuisbrengen. Alleen `save-<id>.ops-save.tmp` en
 * `<naam>.ops-vorige-<id>` met het id uit het manifest; een bestand met een ander id raakt dit niet aan.
 * - Ontbreekt het doel en staat er een `.ops-vorige`: die exclusief terug op het doel.
 * - `.ops-vorige` met `vorigeSha256` en het doel met `pendingSha256` (opslaan was klaar): `.ops-vorige` weg.
 * - `.ops-vorige` met een andere inhoud: exclusief naar "versie van ander programma".
 * - Het tijdelijke bestand met `pendingSha256` terwijl het doel die versie niet heeft: exclusief naar "niet opgeslagen
 *   planning" (de herstelsnapshot kan tot 10 s achterlopen). Anders weg zodra het doel `sha256` of `pendingSha256` heeft.
 * - Al het andere blijft staan (`left-over`). Geen stap vervangt of verwijdert een versie die niet gecontroleerd is.
 */
export async function settleReplaceRemnants(
  fs: ReplaceRemnantsFs, record: PendingReplaceRecord, label: ReplaceCopyLabel, sha256: (bytes: Uint8Array) => Promise<string>,
): Promise<RemnantEvent[]> {
  const { path, id } = record;
  const temp = userFileTempPath(path, id), previous = previousVersionPath(path, id);
  const events: RemnantEvent[] = [];
  const see = async (file: string): Promise<Seen> => {
    try {
      const data = await fs.read(file);
      return data === null ? 'missing' : await sha256(data);
    } catch {
      return 'unreadable';
    }
  };
  const leave = (file: string) => { events.push({ kind: 'left-over', target: path, path: file }); };

  let target = await see(path);
  const before = await see(previous);
  if (before !== 'missing') {
    if (target === 'missing') {
      if (placedOk(await fs.place(previous, path))) {
        target = before;
        events.push({ kind: 'previous-back', target: path });
      } else leave(previous);
    } else if (before === record.vorigeSha256 && target === record.pendingSha256) {
      try { await fs.remove(previous); } catch { leave(previous); }
    } else if (before !== 'unreadable' && before !== record.vorigeSha256) {
      const copy = replaceCopyPath(path, label('other-program'));
      if (placedOk(await fs.place(previous, copy))) events.push({ kind: 'other-version', target: path, copy });
      else leave(previous);
    } else leave(previous);
  }

  const written = await see(temp);
  if (written !== 'missing') {
    if (written === record.pendingSha256 && target !== record.pendingSha256) {
      const copy = replaceCopyPath(path, label('unsaved-schedule'));
      if (placedOk(await fs.place(temp, copy))) events.push({ kind: 'unsaved-schedule', target: path, copy });
      else leave(temp);
    } else if (target === record.sha256 || target === record.vorigeSha256 || target === record.pendingSha256) {
      // Een onvolledig eigen bestand (crash in stap 1), of een dubbel van wat al op het doel staat.
      try { await fs.remove(temp); } catch { leave(temp); }
    } else leave(temp);
  }
  return events;
}

// ── Tauri ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** De vervanging op plugin-fs en `place_file_exclusive`; bytes als rauwe body (zie `atomicWrite.ts`). */
export async function tauriOwnFileReplaceFs(): Promise<OwnFileReplaceFs> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { lstat, createNew, remove } = tauriUserFileFs<Uint8Array>(fs, (p, b, o) => fs.writeFile(p, b, o));
  return { lstat, createNew, remove, place: placeFileExclusive, content: sourceTargetContentOfPathTauri };
}

/** Het opruimen op plugin-fs: een ontbrekend bestand is `null`, een link wordt niet gelezen. */
export async function tauriReplaceRemnantsFs(): Promise<ReplaceRemnantsFs> {
  const fs = await import('@tauri-apps/plugin-fs');
  return {
    read: async p => {
      let info;
      try { info = await fs.lstat(p); } catch (error) { if (missingTarget(error)) return null; throw error; }
      if (!info.isFile) throw new Error(`Geen gewoon bestand: ${p}`);
      return fs.readFile(p);
    },
    remove: p => fs.remove(p),
    place: placeFileExclusive,
  };
}
