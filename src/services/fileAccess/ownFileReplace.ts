/**
 * #804, knownbug 1131 stap 5 (deel a): het eigen bestand van een document met een gebouwmodel op de desktop vervangen,
 * zonder dat ooit een versie verloren gaat die de app niet zelf gecontroleerd heeft (ontwerp §4.10, "Bestand buiten
 * de app vervangen", stappen 1 tot en met 5; stap 0 en 6 zijn het herstelrecord (`replaceRecords.ts`), het
 * herstelmanifest en de broncommit, `state/ownFileReplace.ts`).
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
import { createOwnTemp, tauriUserFileFs, userFileDir, userFileTempPath } from './atomicWrite';
import { missingTarget } from './fileIdentity';
import { sourceTargetContentOfPathTauri } from './tauriBackend';
import { placeFileExclusive, type PlaceFileOutcome } from './placeFileExclusive';
import type { SourceTargetContent } from './sourceTargetContent';
import type { ReplaceRecord } from './replaceRecords';

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
  /** Het id van de hulpnamen, gelijk aan dat van het herstelrecord. */
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
 *  niet te bekijken is, komt in stap 2 als weg of onleesbaar terug. Plugin-fs 2.7.1 geeft op Windows `nlink: null`:
 *  daar ziet deze voorcontrole een harde link niet (knownbug 1820; dicht in `place_file_exclusive` vóór deel b). */
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
    try { await fs.remove(temp); } catch { /* blijft achter; het herstelrecord blijft dan ook, herstel handelt het af */ }
  };

  // Stap 1. Geen terugval naar een directe aanmaak: dit is geen nieuwe naam.
  const created = await createOwnTemp(fs, temp, bytes, input.mode);
  if (created.failed === 'forbidden') return { code: 'save-as-only', why: 'forbidden path' };
  if (created.failed) return { code: 'failed', detail: created.cause instanceof Error ? created.cause.message : String(created.cause) };

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
  const before = await fs.content(previous, source);
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

/** Staat er nog een hulpbestand van de vervanging met dit id? Zo niet, dan mag het herstelrecord weg. Een naam die
 *  niet te bekijken is, telt als aanwezig. */
export async function replaceHelpersGone(fs: Pick<OwnFileReplaceFs, 'content'>, path: string, id: string): Promise<boolean> {
  const none = new Uint8Array(0);
  for (const helper of [userFileTempPath(path, id), previousVersionPath(path, id)]) {
    if (await fs.content(helper, none) !== 'missing') return false;
  }
  return true;
}

export interface ReplaceRemnantsFs {
  /** De inhoud van een gewoon bestand; `null` als er niets staat. Een link of een leesfout gooit. */
  read(path: string): Promise<Uint8Array | null>;
  remove(path: string): Promise<void>;
  place(from: string, to: string): Promise<PlaceFileOutcome>;
}

/** Wat het afhandelen deed; alleen dat wat de planner moet weten. */
export type RemnantEvent =
  /** Het tijdelijke bestand met de volledige nieuwe planning, die niet op het doel kwam, nu onder deze naam. */
  | { kind: 'unsaved-schedule'; target: string; copy: string }
  /** Een bestand onder een hulpnaam dat niet aantoonbaar van deze operatie is, of nog niet weg of opzij kon: het
   *  blijft staan, en het herstelrecord ook. */
  | { kind: 'left-over'; target: string; path: string };

type Seen = string | 'missing' | 'unreadable';

/**
 * De restbestanden van één onderbroken vervanging afhandelen. Alleen `save-<id>.ops-save.tmp` en
 * `<naam>.ops-vorige-<id>` met het id uit het record; een bestand met een ander id raakt dit niet aan. De naam bewijst
 * niets: eigendom volgt uit de inhoud (sha256) en de stand van het doel.
 * - `.ops-vorige` met `vorigeSha256` en het doel weg: de versie die stap 3 opzijzette, terwijl stap 4 niet op het doel
 *   kwam. Exclusief terug op het doel.
 * - `.ops-vorige` met `vorigeSha256` en het doel met `pendingSha256`: stap 4 lukte, dus stap 3 ook, en stap 5 had deze
 *   gecontroleerde versie gewist. Weg.
 * - Het tijdelijke bestand met `pendingSha256` en het doel ook: een dubbel van wat op het doel staat. Weg.
 * - Het tijdelijke bestand met `pendingSha256` en het doel niet: de eigen nieuwe planning, die niet op het doel kwam
 *   (de herstelsnapshot kan tot 10 s achterlopen). Exclusief naar "niet opgeslagen planning"; niets gewist.
 * - Al het andere (een andere inhoud, onleesbaar, of een stap die faalde) blijft staan en wordt gemeld (`left-over`).
 * `resolved`: er staat geen hulpbestand van de operatie meer; het record mag weg.
 */
export async function settleReplaceRemnants(
  fs: ReplaceRemnantsFs, record: ReplaceRecord, label: ReplaceCopyLabel, sha256: (bytes: Uint8Array) => Promise<string>,
): Promise<{ events: RemnantEvent[]; resolved: boolean }> {
  const { path, id, vorigeSha256, pendingSha256 } = record;
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
  const removeOrLeave = async (file: string) => {
    try { await fs.remove(file); } catch { leave(file); }
  };

  let target = await see(path);
  const before = await see(previous);
  if (before === vorigeSha256 && target === 'missing') {
    if (placedOk(await fs.place(previous, path))) target = before;
    else leave(previous);
  } else if (before === vorigeSha256 && target === pendingSha256) {
    await removeOrLeave(previous);
  } else if (before !== 'missing') await removeOrLeave(previous); // MUTATIE a: op naam

  const written = await see(temp);
  if (written === pendingSha256 && target === pendingSha256) {
    await removeOrLeave(temp);
  } else if (written === pendingSha256) {
    const copy = replaceCopyPath(path, label('unsaved-schedule'));
    if (placedOk(await fs.place(temp, copy))) events.push({ kind: 'unsaved-schedule', target: path, copy });
    else leave(temp);
  } else if (written !== 'missing') await removeOrLeave(temp); // MUTATIE a: op naam
  return { events, resolved: !events.some(event => event.kind === 'left-over') };
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
