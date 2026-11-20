import { isTauri } from '@/utils/platform';
import {
  saveDataDialogTauri, saveToRefTauri, readFromRefTauri, readBytesFromRefTauri,
  fileIdentityFsTauri, scanTargetPathTauri, sourceTargetContentOfPathTauri,
  saveNewBytesDialogTauri, saveNewBytesToRefTauri, pickSaveTargetTauri, isRegularFileTauri,
} from './tauriBackend';
import { openFileDialogTauri, readOpenedPathTauri } from './tauriOpenPath';
import type { FileIdentityFs } from './fileIdentity';
import type { RemnantEvent } from './ownFileReplace';
import type { TargetReaders } from './foreignSourceTarget';
import { readSiteSourceFile } from './siteBackend';
import {
  openFileDialogWeb, saveDataDialogWeb, saveToRefWeb, saveToRefWithoutPromptWeb, canWriteToRefWithoutPromptWeb, readFromRefWeb, readBytesFromRefWeb,
  saveNewBytesDialogWeb, saveNewBytesToRefWeb, handleWritePermissionWeb, replaceHandleWithBytesWeb,
} from './webBackend';
import { siteStorageAvailable } from './siteHost';
import { sourceTargetContentOfHandle, type SourceTargetContent } from './sourceTargetContent';

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
/** Hetzelfde doel? Een handle telt als hetzelfde object (de doelcontrole zelf gebruikt `isSameEntry`). */
export function sameFileRef(a: FileRef, b: FileRef): boolean {
  if (a.kind === 'path' && b.kind === 'path') return a.path === b.path;
  if (a.kind === 'site' && b.kind === 'site') return a.id === b.id;
  return a.kind === 'handle' && b.kind === 'handle' && a.handle === b.handle;
}

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
  /** Desktop: wat het afhandelen van een onafgeronde vervanging van dit pad vóór het lezen deed (`readOpenedTauriPath`);
   *  `openOpenedFile` meldt het. */
  replaceRemnants?: RemnantEvent[];
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
  /**
   * Knownbug 1896 (#804 stap 6): de laatste controle van de aanroeper, op het laatste punt waar de opslag nog kan
   * stoppen zonder het einddoel te wijzigen. Zie `RefuseBeforePlace`. De dialoog geeft bij een weigering `null`, zoals
   * bij annuleren. Niet op een handle uit de opslaankiezer van de browser: die heeft een bestaand doel al leeggemaakt
   * (knownbug 1899), dus daar maakt de dialoog het bestand af en beslist de aanroeper alleen nog over de commit.
   */
  refuseBeforePlace?: RefuseBeforePlace | null;
}

/** Controle op het gekozen doel van een opslag of export; `true` = weigeren. Zie `SaveDialogOpts.refuseTarget`. */
export type SaveTargetCheck = (target: FileRef) => Promise<boolean>;

/**
 * Knownbug 1896 (#804 stap 6): de laatste controle van de aanroeper, synchroon, vlak vóór de definitieve
 * bestandsbewerking: vóór `close()` van een browserhandle, vóór de hernoeming van het eigen tijdelijke bestand (of de
 * directe schrijfactie die daar de terugval is), vóór de exclusieve plaatsing of aanmaak van een nieuwe naam en vóór het
 * opzijzetten van een bestaande naam. `true` = stoppen: het einddoel blijft zoals het was, een eigen tijdelijk bestand
 * gaat weg en de functie meldt "niet geschreven" (`false` of `null`). De controle meldt zelf waarom; de bestandslaag
 * kent de store niet. De documentroutes geven hier `refuseChangedDocumentWrite` (`fileSlice.ts`).
 */
export type RefuseBeforePlace = () => boolean;

/** Wat een schrijfroute wegschrijft: tekst, of bytes (de opslagworker codeert de gewone writer zelf, #804 stap 6). Op
 *  schijf is het hetzelfde: tekst gaat als UTF-8 (`TextEncoder` in plugin-fs, een `Blob` of de schrijfstroom van de
 *  browser). */
export type FileData = string | Uint8Array;

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

/** Een lokaal doel om te vervangen: een pad (desktop) of een bestandshandle (browser). Een site-bestand en een
 *  download hebben geen doel om op inhoud te vergelijken. */
export type LocalTargetRef = Extract<FileRef, { kind: 'path' | 'handle' }>;

/** #804, knownbug 1131 stap 1: staat op het eigen doel nog precies `expected` (de bronbytes)? Zie
 *  `sourceTargetContent.ts`. Een pad is alleen op de desktop een doel. */
export function sourceTargetContent(ref: LocalTargetRef, expected: Uint8Array): Promise<SourceTargetContent> {
  if (ref.kind === 'handle') return sourceTargetContentOfHandle(ref.handle, expected);
  if (!isTauri()) return Promise.reject(new Error('Een pad is in de browser geen doel om te vergelijken.'));
  return sourceTargetContentOfPathTauri(ref.path, expected);
}

/** Knownbug 1131 stap 2: het eigen bestand van een document met een gebouwmodel achter een bestandshandle (alleen de
 *  browser; de desktop heeft paden). Eerst de schrijftoestemming, vóór de merge; dan de vervanging met een tweede
 *  inhoudscontrole vlak vóór `close()`. Zie `webBackend.ts`. */
export function handleWritePermission(ref: Extract<FileRef, { kind: 'handle' }>): Promise<boolean> {
  return handleWritePermissionWeb(ref.handle);
}
export function replaceHandleWithBytes(
  ref: Extract<FileRef, { kind: 'handle' }>, bytes: Uint8Array, stillSource: () => Promise<boolean>,
  refuseBeforePlace: RefuseBeforePlace,
): Promise<boolean> {
  return replaceHandleWithBytesWeb(ref.handle, bytes, stillSource, refuseBeforePlace);
}

/** Opslaan-als / export via picker, met tekst of bytes (#804 stap 6: de bytes van de opslagworker gaan zonder omweg via
 *  tekst naar de byteroute). Overschrijft een bestaand doel atomair (`replaceUserFile`), zoals altijd. `null` =
 *  geannuleerd of geweigerd. */
export function saveDataDialog(
  defaultName: string, data: FileData, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return isTauri() ? saveDataDialogTauri(defaultName, data, filters, opts) : saveDataDialogWeb(defaultName, data, filters, opts);
}

/** Opslaan-als / export van tekst via picker. `null` = geannuleerd. */
export function saveFileDialog(
  defaultName: string, content: string, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return saveDataDialog(defaultName, content, filters, opts);
}

/**
 * Opslaan-als / export van BYTES via picker — de binaire tegenhanger van `saveFileDialog`,
 * met dezelfde annuleer-, weigerings- en download-terugvalafhandeling. Dit is het bestaande
 * byte-schrijfpad voor binaire exports; de strikte ingang hieronder vervangt nooit een lokaal bestand.
 */
export function saveBytesDialog(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return saveDataDialog(defaultName, bytes, filters, opts);
}

/**
 * #804, T1: het voorbereide schrijfresultaat (één buffer). Desktop maakt alleen een nieuw einddoel aan;
 * web downloadt altijd. De doelcontrole blijft verplicht, ook bij een nieuw bedoelde naam.
 * Site-opslag gebruikt de byte-functies in siteBackend, met de documentversie als verplichte basis.
 */
export function saveNewBytesDialog(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return isTauri()
    ? saveNewBytesDialogTauri(defaultName, bytes, filters, opts)
    : saveNewBytesDialogWeb(defaultName, bytes, opts);
}

/** Het doel van *Opslaan als* op de desktop (#804 keuze 4, knownbug 1891): het pad uit de bestandskiezer en wat er direct
 *  na zijn terugkeer op stond. `current`: de inhoud van een gewoon bestand (de verwachte inhoud van de vervanging en het
 *  enige wat de doelcontrole scant), `'unreadable'` als dat bestand niet te lezen was, `null` als er geen gewoon bestand
 *  stond (een vrije naam, een link of een map: de exclusieve aanmaak, die een bestaande naam weigert). */
export interface PickedSaveTarget {
  path: string;
  current: Uint8Array | 'unreadable' | null;
}

/** Desktop: de bestandskiezer van Opslaan als, zonder te schrijven; `null` = geannuleerd. De aanroeper kiest zelf
 *  tussen de exclusieve aanmaak (`saveNewBytesToRef`) en de vervanging van het bestaande bestand. De kiezer opent het
 *  bestand niet (plugin-dialog `save`), dus `current` is wat er stond toen de planner het vervangen bevestigde, op het
 *  venster van knownbug 1890 na. */
export function pickSaveTarget(defaultName: string, filters: FileFilter[]): Promise<PickedSaveTarget | null> {
  if (!isTauri()) return Promise.reject(new Error('De bestandskiezer zonder schrijven bestaat alleen op de desktop.'));
  return pickSaveTargetTauri(defaultName, filters);
}

/** Desktop: staat er op `path` een gewoon bestand (geen link gevolgd)? Elke fout, en de browser, geeft nee. Alleen
 *  een gewoon bestand krijgt de toestemming van Opslaan als (#804 keuze 4, `WriteTargetDeps.replaceConfirmed`). */
export function isRegularFile(path: string): Promise<boolean> {
  return isTauri() ? isRegularFileTauri(path) : Promise.resolve(false);
}

/** Een nieuw lokaal doel; een bestaand pad of browserhandle geeft een ByteWriteError.
 * Geen permissieprompt of terugval. Een site-ref geeft false: daar is de basisversie nodig. `false` ook als
 * `refuseBeforePlace` weigerde. */
export function saveNewBytesToRef(ref: FileRef, bytes: Uint8Array, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveNewBytesToRefTauri(ref, bytes, refuseBeforePlace) : saveNewBytesToRefWeb(ref, bytes);
}

// Een site-ref gaat hieronder NOOIT naar de Tauri- of webbackend. Schrijven naar de site kan via
// deze algemene functies niet: dat vraagt de basisversie van het document dat opslaat, en die kent
// alleen de opslaanroute van de store (`saveSiteFileVersion` in `siteBackend.ts`). Ze geven voor een
// site-ref dus `false`. Lezen mag wel. Zonder site-refs verandert er niets.

/** In-place opslaan naar een bestaande ref, met tekst of bytes. `false` als onmogelijk (fallback-web, geweigerde
 *  permissie of annulering) → de aanroeper kan terugvallen op `saveFileDialog`. Ook `false` als `refuseBeforePlace`
 *  weigerde; dan weet de aanroeper zelf dat hij moet stoppen. Echte schrijffouten gooien: de aanroeper meldt ze vóór
 *  een eventuele terugval. Een site-ref: altijd `false` (zie boven). `writeGranted`: de aanroeper kreeg voor deze
 *  handle al schrijftoestemming (`handleWritePermission`, vóór het rekenen); de browser vraagt dan niet opnieuw. */
export function saveToRef(
  ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null, writeGranted = false,
): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveToRefTauri(ref, data, refuseBeforePlace) : saveToRefWeb(ref, data, refuseBeforePlace, writeGranted);
}

/** Stille precheck voor timerwerk: browser-FSA mag hier nooit permissie vragen. Een site-ref: `false`
 *  — automatisch opslaan naar de site staat uit (elke ronde zou een nieuwe versie maken). */
export function canWriteToRefWithoutPrompt(ref: FileRef): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? Promise.resolve(ref.kind === 'path') : canWriteToRefWithoutPromptWeb(ref);
}

/** Schrijf naar een bestaand doel zonder dialoog, download-terugval of permissieprompt, met tekst of bytes. `false`
 *  ook als `refuseBeforePlace` weigerde. Een site-ref: altijd `false` (zie boven). */
export function saveToRefWithoutPrompt(ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveToRefTauri(ref, data, refuseBeforePlace) : saveToRefWithoutPromptWeb(ref, data, refuseBeforePlace);
}

/** Inhoud van een bewaarde ref herlezen. `null` bij onbruikbare ref/geweigerd; leesfouten gooien. Een site-ref: altijd `null`; een
 *  site-bestand heropent de store via `openSiteFile`, dat ook de basisversie en de foutcodes kent. */
export function readFromRef(ref: FileRef): Promise<string | null> {
  if (ref.kind === 'site') return Promise.resolve(null);
  return isTauri() ? readFromRefTauri(ref) : readFromRefWeb(ref);
}

/** Desktop: een lokaal pad lezen om het te openen (Recent), via dezelfde kern als de dialoog en neerzetten: eerst een
 *  onafgeronde vervanging van dat pad afhandelen, dan lezen. */
export function readOpenedPath(path: string, asBytes: boolean): Promise<OpenedFile> {
  return readOpenedPathTauri(path, asBytes);
}

/** Bytes van een bewaarde ref herlezen. `null` bij onbruikbare ref/geweigerd; leesfouten gooien. */
export function readBytesFromRef(ref: FileRef): Promise<Uint8Array | null> {
  if (ref.kind === 'site') return Promise.resolve(null);
  return isTauri() ? readBytesFromRefTauri(ref) : readBytesFromRefWeb(ref);
}
