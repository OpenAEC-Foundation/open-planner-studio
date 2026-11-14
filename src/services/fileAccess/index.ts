import { isTauri } from '@/utils/platform';
import {
  openFileDialogTauri, saveFileDialogTauri, saveBytesDialogTauri, saveToRefTauri, readFromRefTauri, readBytesFromRefTauri,
  fileIdentityFsTauri, scanTargetPathTauri,
  saveBytePartsDialogTauri, saveBytePartsToRefTauri,
} from './tauriBackend';
import type { FileIdentityFs } from './fileIdentity';
import type { TargetReaders } from './foreignSourceTarget';
import { readSiteSourceFile } from './siteBackend';
import {
  openFileDialogWeb, saveFileDialogWeb, saveBytesDialogWeb, saveToRefWeb, saveToRefWithoutPromptWeb, canWriteToRefWithoutPromptWeb, readFromRefWeb, readBytesFromRefWeb,
  saveBytePartsDialogWeb, saveBytePartsToRefWeb,
} from './webBackend';
import { siteStorageAvailable } from './siteHost';

/** Bestandsfilter (naam + extensies zonder punt), zoals de bestaande dialoog-aanroepen. */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * Opake verwijzing naar een bestand als opslaan-doel.
 * - `path`   : Tauri — echt OS-pad; herbruikbaar voor in-place opslaan.
 * - `handle` : Chromium-web — FileSystemFileHandle; herbruikbaar voor in-place opslaan.
 * - `site`   : opslag via de site die de tool host (`siteHost.ts`, issue #309) — het vaste id van
 *              het bestand op de site; elke opslag schrijft daar een nieuwe versie.
 * Fallback-web (Firefox/Safari) heeft geen herbruikbare ref → `null`.
 */
export type FileRef =
  | { kind: 'path'; path: string }
  | { kind: 'handle'; handle: FileSystemFileHandle }
  | { kind: 'site'; id: string };

/** De velden van een document die samen zijn opslagdoel bepalen (`DocumentPayload`/live state). */
export interface SaveTargetFields {
  filePath: string | null;
  fileHandle: FileSystemFileHandle | null;
  siteFileId: string | null;
}

/**
 * HET opslagdoel van een document als `FileRef`, of `null` als er geen bestaand doel is (dan wordt
 * opslaan "opslaan als"). Eén afleiding voor Opslaan, de echte AutoSave en de AutoSave-knop in de
 * titelbalk. Die laatste twee laten een site-doel bewust links liggen: automatisch opslaan staat voor
 * een site-bestand uit (zie `siteHost.ts`).
 *
 *  - `siteFileId` → site-bestand (alleen gezet als het document van de site kwam of erheen ging);
 *  - `fileHandle` → Chromium-handle;
 *  - `filePath`   → alleen in Tauri een echt pad. In de browser is `filePath` slechts de
 *    bestandsnaam (titel), dus géén doel.
 *
 * `tauri` is injecteerbaar voor de headless test; standaard de echte platformcheck.
 */
export function saveTargetRef(doc: SaveTargetFields, tauri: boolean = isTauri()): FileRef | null {
  if (doc.siteFileId) return { kind: 'site', id: doc.siteFileId };
  if (doc.fileHandle) return { kind: 'handle', handle: doc.fileHandle };
  if (tauri && doc.filePath) return { kind: 'path', path: doc.filePath };
  return null;
}

export interface OpenedFile {
  name: string;
  /** Tekstinhoud; bij een binair formaat (opts.binaryExtensions) leeg — gebruik dan `bytes`. */
  content: string;
  bytes?: Uint8Array;
  ref: FileRef | null;
}

export interface OpenDialogOpts {
  /** Extensies (zonder punt, lowercase) die als bytes gelezen moeten worden i.p.v. tekst. */
  binaryExtensions?: string[];
}

/** Extra sturing voor `saveFileDialog` — optioneel (o.a. de voortgangsblad-export).
 *  `preferDownloads` opent de dialoog waar mogelijk al in de downloadmap:
 *  Tauri kan dat via een volledig `defaultPath` (downloadDir() + bestandsnaam); Chromium-web kent
 *  `showSaveFilePicker({ startIn: 'downloads' })`. Firefox/Safari (geen FSA) landen sowieso al in
 *  de downloadmap via de bestaande `downloadBlob`-terugval — daar verandert deze vlag niets aan. */
export interface SaveDialogOpts {
  preferDownloads?: boolean;
  /**
   * MIME-type voor de download-terugval in de browser (`saveBytesDialog`/`saveFileDialog` op
   * Firefox/Safari of een policy-geblokkeerde webview). Alleen de terugval kent het: het
   * FSA-pad schrijft naar een door de gebruiker gekozen bestand en heeft geen MIME nodig.
   * Zonder waarde blijft het `application/octet-stream` — precies wat elke bestaande caller had.
   */
  mime?: string;
  /**
   * #804 fase 1a (fixronde 1): de laatste controle op het gekozen doel, vóór het schrijven (Tauri: na de padkeuze;
   * browser: na `showSaveFilePicker`, vóór `createWritable()`). `true` = niet schrijven; de dialoog geeft dan `null`,
   * zoals bij annuleren. De controle meldt zelf waarom (de weigering via het meldingenkanaal). Een download heeft geen
   * doel en wordt niet gecontroleerd. Zie `SaveTargetCheck`.
   */
  refuseTarget?: SaveTargetCheck | null;
  /**
   * Review #872 ronde 7 (Terra): de laatste controle vóór de download-terugval in de browser. Die terugval komt ook ná een
   * wachtende bestandskiezer die de omgeving weigert; de inhoud is dan misschien oud. `true` = niet downloaden; de
   * dialoog geeft dan `null`, zoals bij annuleren. De controle meldt zelf waarom.
   */
  refuseDownload?: (() => boolean) | null;
}

/** Controle op het gekozen doel van een opslag of export; `true` = weigeren. Zie `SaveDialogOpts.refuseTarget`. */
export type SaveTargetCheck = (target: FileRef) => Promise<boolean>;

/** De opties van `saveFileDialog`/`saveBytesDialog`: de doelcontrole is verplicht, zodat geen route haar vergeet (een
 *  aanroeper zonder controle geeft expliciet `null`). */
export type CheckedSaveDialogOpts = SaveDialogOpts & { refuseTarget: SaveTargetCheck | null };

export interface SaveOutcome {
  ref: FileRef | null;
  name: string;
  /**
   * Het bestand is via de browser-download bij de gebruiker gekomen in plaats van naar de gekozen
   * locatie geschreven — omdat de omgeving geen File System Access-schrijfrechten geeft (embedded
   * webviews) of de API helemaal niet heeft (Firefox/Safari). Het opslaan is dus GESLAAGD, maar het
   * bestand staat in de downloadmap en niet waar de gebruiker het aanwees. De aanroeper meldt dat.
   */
  viaDownload?: boolean;
}

/** Capability-vlag voor UI-beslissingen (recents tonen/verbergen). */
export function supportsHandles(): boolean {
  return isTauri() || (typeof window !== 'undefined' && 'showOpenFilePicker' in window);
}

/** Recente bestanden tonen? Alleen als er herbruikbare refs kunnen bestaan: een Tauri-pad, een
 *  Chromium-handle of een bestand op de site. Zonder site-opslag gelijk aan `supportsHandles()`. */
export function supportsRecentFiles(): boolean {
  return supportsHandles() || siteStorageAvailable();
}

/** Openen via picker/input. `null` = geannuleerd. */
export function openFileDialog(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  return isTauri() ? openFileDialogTauri(filters, opts) : openFileDialogWeb(filters, opts);
}

/** De bestandsidentiteit voor `compareFilePaths`: in Tauri plugin-fs `stat`, in de browser geen (#804 fixronde 1). */
export function fileIdentityFs(): Promise<FileIdentityFs | undefined> {
  return isTauri() ? fileIdentityFsTauri() : Promise.resolve(undefined);
}

/** De lezers van een bestaand doel voor de doelcontrole (#804 fixronde 2): in Tauri het pad als stroom, met site-opslag
 *  het site-bestand. In de browser leest de controle de handle zelf (`getFile()`). */
export function writeTargetReaders(): TargetReaders {
  return {
    ...(isTauri() ? { scanPath: scanTargetPathTauri } : {}),
    ...(siteStorageAvailable() ? { readSite: async (id: string) => (await readSiteSourceFile(id)).bytes() } : {}),
  };
}

/** Opslaan-als / export via picker. `null` = geannuleerd. */
export function saveFileDialog(
  defaultName: string, content: string, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return isTauri()
    ? saveFileDialogTauri(defaultName, content, filters, opts)
    : saveFileDialogWeb(defaultName, content, filters, opts);
}

/**
 * Opslaan-als / export van BYTES via picker — de binaire tegenhanger van `saveFileDialog`,
 * met dezelfde annuleer-, weigerings- en download-terugvalafhandeling. Dit is het bestaande
 * byte-schrijfpad voor binaire exports; de strikte delen-ingang hieronder vervangt nooit een lokaal bestand.
 */
export function saveBytesDialog(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return isTauri()
    ? saveBytesDialogTauri(defaultName, bytes, filters, opts)
    : saveBytesDialogWeb(defaultName, bytes, filters, opts);
}

/**
 * #804, T1: voorbereid schrijfresultaat als delen. Desktop maakt alleen een nieuw einddoel aan;
 * web downloadt altijd. De doelcontrole blijft verplicht, ook bij een nieuw bedoelde naam.
 * Site-opslag gebruikt de delen-functies in siteBackend, met de documentversie als verplichte basis.
 */
export function saveBytePartsDialog(
  defaultName: string, parts: readonly Uint8Array[], filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return isTauri()
    ? saveBytePartsDialogTauri(defaultName, parts, filters, opts)
    : saveBytePartsDialogWeb(defaultName, parts, opts);
}

/** Een nieuw lokaal doel; een bestaand pad of browserhandle geeft een BytePartsWriteError.
 * Geen permissieprompt of terugval. Een site-ref geeft false: daar is de basisversie nodig. */
export function saveBytePartsToRef(ref: FileRef, parts: readonly Uint8Array[]): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveBytePartsToRefTauri(ref, parts) : saveBytePartsToRefWeb(ref, parts);
}

// Een site-ref gaat hieronder NOOIT naar de Tauri- of webbackend. Schrijven naar de site kan via
// deze algemene functies niet: dat vraagt de basisversie van het document dat opslaat, en die kent
// alleen de opslaanroute van de store (`saveSiteFileVersion` in `siteBackend.ts`). Ze geven voor een
// site-ref dus `false`. Lezen mag wel. Zonder site-refs verandert er niets.

/** In-place opslaan naar een bestaande ref. `false` als onmogelijk (fallback-web, geweigerde
 *  permissie of annulering) → de aanroeper kan terugvallen op `saveFileDialog`. Echte schrijffouten
 *  gooien: de aanroeper meldt ze vóór een eventuele terugval. Een site-ref: altijd `false` (zie boven). */
export function saveToRef(ref: FileRef, content: string): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveToRefTauri(ref, content) : saveToRefWeb(ref, content);
}

/** Stille precheck voor timerwerk: browser-FSA mag hier nooit permissie vragen. Een site-ref: `false`
 *  — automatisch opslaan naar de site staat uit (elke ronde zou een nieuwe versie maken). */
export function canWriteToRefWithoutPrompt(ref: FileRef): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? Promise.resolve(ref.kind === 'path') : canWriteToRefWithoutPromptWeb(ref);
}

/** Schrijf naar een bestaand doel zonder dialoog, download-terugval of permissieprompt. Een site-ref:
 *  altijd `false` (zie boven). */
export function saveToRefWithoutPrompt(ref: FileRef, content: string): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveToRefTauri(ref, content) : saveToRefWithoutPromptWeb(ref, content);
}

/** Inhoud van een bewaarde ref herlezen. `null` bij onbruikbare ref/geweigerd; leesfouten gooien. Een site-ref: altijd `null`; een
 *  site-bestand heropent de store via `openSiteFile`, dat ook de basisversie en de foutcodes kent. */
export function readFromRef(ref: FileRef): Promise<string | null> {
  if (ref.kind === 'site') return Promise.resolve(null);
  return isTauri() ? readFromRefTauri(ref) : readFromRefWeb(ref);
}

/** Bytes van een bewaarde ref herlezen. `null` bij onbruikbare ref/geweigerd; leesfouten gooien. */
export function readBytesFromRef(ref: FileRef): Promise<Uint8Array | null> {
  if (ref.kind === 'site') return Promise.resolve(null);
  return isTauri() ? readBytesFromRefTauri(ref) : readBytesFromRefWeb(ref);
}
