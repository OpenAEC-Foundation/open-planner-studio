// Eén registry voor de extensie→reader-dispatch (fileSlice.openFile/openRecentFile/
// parseExternalSource, fileTools.parseByExtension, devBridge.openFromPath) plus de bijbehorende
// exportlijst (Backstage).

import type { XerWriteInput, XerWriteResult } from '@/services/xerWriteTypes';
import type { BuiltInProfileId } from '@/types/project';
import { readIFCWithXerReconstruction } from '@/services/ifc/ifcReadWithXer';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { readCSV } from '@/services/csv/csvReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import type { ImportLabels, OpenedImport } from '@/services/importTypes';
import type { FileFilter, FileRef } from '@/services/fileAccess';
import { basename, extensionOf } from '@/utils/filePath';

/** Invoer voor een reader: tekstformaten krijgen `text`, binaire formaten `bytes`. */
export interface FormatInput { name: string; text?: string; bytes?: Uint8Array }

export interface ReadFormat {
  id: string;
  extensions: string[];
  kind: 'text' | 'binary';
  /** Dialoogfilterlabel — bewust hard-coded Engels (bestaande conventie: 'IFC Files'). */
  filterName: string;
  /** Mag een geopend bestand van dit formaat het OPSLAGDOEL (filePath/fileHandle) van het document
   *  worden? Opslaan schrijft ALTIJD IFC-tekst
   *  terug — dat is alleen correct als de bron zelf ook IFC was; élk ander bronformaat zou de
   *  eerstvolgende Ctrl+S zijn eigen bronbestand met IFC-inhoud laten overschrijven. Ontbreekt
   *  (`undefined`) ⇒ `false`, dus alleen de IFC-entry hoeft 'm expliciet op `true` te zetten.
   *  Eén vlag voor `fileSlice.ts` en `fileTools.ts`. */
  canBeSaveTarget?: boolean;
  read(input: FormatInput, labels?: ImportLabels, opts?: FormatReadOptions): Promise<OpenedImport>;
}

/** Keuzes van de open-route die het formaat niet zelf kent. */
export interface FormatReadOptions {
  /** De flag `ifcForeignContent` staat aan (#804 fase 1a): IFC leest als bytes, via de scanner en de indeling. Zonder
   *  deze optie is alles zoals vóór #804. De open-routes geven hem mee met `ifcForeignContentEnabled(ui.featureFlags)`. */
  ifcBytes?: boolean;
}

/** Het root-element van een XML-document: lokale naam (zonder prefix) en de namespace die voor dat
 *  prefix (of de default) op het element zelf gedeclareerd is. Leest alleen de proloog (BOM, XML-
 *  declaratie, commentaar, DOCTYPE) en de start-tag — geen DOM, zodat de MCP-laag (label) en de
 *  registry (lezerkeuze) hetzelfde goedkope antwoord krijgen. `null` als er geen start-tag is. */
function xmlRootElement(content: string): { localName: string; namespace: string } | null {
  let i = content.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (;;) {
    while (i < content.length && /\s/.test(content[i])) i++;
    if (content.startsWith('<?', i)) {
      const end = content.indexOf('?>', i + 2);
      if (end < 0) return null;
      i = end + 2;
    } else if (content.startsWith('<!--', i)) {
      const end = content.indexOf('-->', i + 4);
      if (end < 0) return null;
      i = end + 3;
    } else if (content.startsWith('<!', i)) {
      // <!DOCTYPE …> — eventueel met interne subset `[ … ]`.
      const bracket = content.indexOf('[', i);
      const close = content.indexOf('>', i);
      if (close < 0) return null;
      const end = bracket >= 0 && bracket < close ? content.indexOf(']>', bracket) : close - 1;
      if (end < 0) return null;
      i = end + 2;
    } else {
      break;
    }
  }
  // Sticky (`y`) vanaf `i`: geen kopie van een document van vele MB's.
  const startTag = /<([A-Za-z_][\w.-]*)(?::([A-Za-z_][\w.-]*))?((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/y;
  startTag.lastIndex = i;
  const tag = startTag.exec(content);
  if (!tag) return null;
  const prefix = tag[2] ? tag[1] : '';
  const localName = tag[2] ?? tag[1];
  const nsAttr = prefix ? `xmlns:${prefix}` : 'xmlns';
  let namespace = '';
  for (const m of tag[3].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    if (m[1] === nsAttr) namespace = m[2] ?? m[3] ?? '';
  }
  return { localName, namespace };
}

/** Welke XML-planning dit is, op basis van het ROOT-ELEMENT en zijn namespace — nooit op vrije
 *  tekst (`content.includes('Primavera')` zou een MS Project-XML met "Primavera" in een project- of
 *  taaknaam naar de P6-lezer sturen, die er zonder fout een leeg project "P6 Import" van maakt). Primavera P6-XML heeft altijd de root
 *  `APIBusinessObjects` (namespace `http://xmlns.oracle.com/Primavera/…`); MSPDI heeft de root
 *  `Project` in de MS Project-namespace (`http://schemas.microsoft.com/project`) — een `Project`
 *  zonder namespace blijft MSPDI. Eén beslissing voor de registry (lezerkeuze) en
 *  de MCP-import (`formatOf`-label), zodat die twee nooit uit elkaar kunnen lopen. */
export function detectXmlFlavor(content: string): 'p6' | 'mspdi' | null {
  const root = xmlRootElement(content);
  if (!root) return null;
  if (root.localName === 'APIBusinessObjects' || root.namespace.startsWith('http://xmlns.oracle.com/Primavera')) return 'p6';
  if (root.localName === 'Project' && (root.namespace === '' || root.namespace.startsWith('http://schemas.microsoft.com/project'))) return 'mspdi';
  return null;
}

/** Technische fout voor MCP; de app vertaalt de code aan de notificatiegrens. */
export class UnknownScheduleXmlError extends Error {
  readonly xmlCode = 'XML_UNKNOWN_SCHEDULE';
  constructor() {
    super('Unknown XML format: the root element is not an MS Project (Project) or Primavera P6 (APIBusinessObjects) schedule');
    this.name = 'UnknownScheduleXmlError';
  }
}

/** Interne subdispatch voor de xml-entry van `READ_FORMATS`: kies de juiste XML-reader op basis
 *  van het root-element (`detectXmlFlavor`). Gooit bij een onbekend formaat i.p.v. stil als MSPDI
 *  te parsen. Niet geëxporteerd: geen afnemer buiten deze module — de enige
 *  aanroeper is de xml-entry hieronder. */
async function parseProjectXml(content: string): Promise<OpenedImport> {
  const flavor = detectXmlFlavor(content);
  if (flavor === 'p6') {
    // Dynamic import: de P6 XML-lezer leidt de rekenopties af met de XER-code (#775), en die blijft buiten
    // de main chunk.
    const { readP6XMLDocuments } = await import('@/services/p6/p6xmlReader');
    return readP6XMLDocuments(content);
  }
  if (flavor === 'mspdi') return readMSPDI(content);
  throw new UnknownScheduleXmlError();
}

// `readIFCWithXerReconstruction` woont in `ifc/ifcReadWithXer.ts` (#804 fase 1a); hier opnieuw geëxporteerd voor de
// bestaande aanroepers.
export { readIFCWithXerReconstruction } from '@/services/ifc/ifcReadWithXer';

/** Default-formaat bij een onbekende extensie. Een APARTE, benoemde const-entry i.p.v. `READ_FORMATS.find(...)!` —
 *  zo kan de default nooit "zoek 'm op en forceer met `!`" zijn (een niet-gevonden id zou dat stil
 *  tot een runtime-crash maken); de entry staat bovendien nog steeds gewoon IN `READ_FORMATS`,
 *  dus herordenen wisselt 'm nooit stilzwijgend. */
const IFC_FORMAT: ReadFormat = {
  id: 'ifc', extensions: ['ifc'], kind: 'text', filterName: 'IFC Files', canBeSaveTarget: true,
  read: async (i, labels, opts) => {
    if (!opts?.ifcBytes) return readIFCWithXerReconstruction(i.text ?? '', labels);
    // Flag `ifcForeignContent` (#804 fase 1a): de bytes-route, lui geladen (scanner en indeling blijven buiten de
    // hoofdbundel). Een route die nog tekst gaf (voorbeelden, §4.9 punt 1) gaat via `TextEncoder`; dat is byte-gelijk
    // voor geldige UTF-8.
    const { readIfcBytes } = await import('@/services/ifc/foreign/ifcBytesRoute');
    return readIfcBytes(i.bytes ?? new TextEncoder().encode(i.text ?? ''), labels);
  },
};

// Volgorde = filtervolgorde in openFile ('All Supported' met ifc,csv,xml,mpp,xer).
const READ_FORMATS: ReadFormat[] = [
  IFC_FORMAT,
  { id: 'csv', extensions: ['csv'], kind: 'text', filterName: 'CSV Files',
    read: async (i) => readCSV(i.text ?? '') },
  { id: 'xml', extensions: ['xml'], kind: 'text', filterName: 'XML Files',
    read: async (i) => parseProjectXml(i.text ?? '') },
  { id: 'mpp', extensions: ['mpp'], kind: 'binary', filterName: 'MS Project Files',
    read: async (i, labels) => {
      if (!i.bytes) throw new Error('MPP requires binary content');
      // Dynamic import: de parser (CFB + fieldmaps) blijft buiten de main chunk.
      const { readMPP } = await import('@/services/mpp/mppReader');
      return readMPP(i.bytes, labels);
    } },
  { id: 'xer', extensions: ['xer'], kind: 'binary', filterName: 'Primavera XER Files',
    read: async (i) => {
      if (!i.bytes) throw new Error('XER requires original binary content');
      // Dynamic import: encodingdetectie en de semantische reader blijven buiten de main chunk.
      const { readXER } = await import('@/services/xer/xerReader');
      // De archief-SHA-256 eerst native (`crypto.subtle`); `readXER` hergebruikt hem synchroon.
      await precomputeSha256(i.bytes);
      return readXER(i.bytes);
    } },
];

/** Extensie-match; onbekende extensie ⇒ de default (IFC). */
export function readFormatForFile(name: string): ReadFormat {
  const ext = extensionOf(name);
  return READ_FORMATS.find((f) => f.extensions.includes(ext)) ?? IFC_FORMAT;
}

/** Kan de app dit bestand openen? Strikt op de extensie, zonder de IFC-terugval van
 *  `readFormatForFile`: een gesleept `tekening.pdf` of `notities` (geen punt) is géén IFC. Eén regel
 *  voor de keuze openen of weigeren bij slepen en neerzetten (`fileAccess/fileDrop.ts`). */
export function isReadableFileName(name: string): boolean {
  const base = basename(name);
  const dot = base.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = base.slice(dot + 1).toLowerCase();
  return READ_FORMATS.some((f) => f.extensions.includes(ext));
}

export function openDialogFilters(): FileFilter[] {
  return [
    { name: 'All Supported', extensions: READ_FORMATS.flatMap((f) => f.extensions) },
    ...READ_FORMATS.map((f) => ({ name: f.filterName, extensions: f.extensions })),
  ];
}

/** Leest de open-route dit formaat als bytes? Binaire formaten altijd; IFC alleen met `opts.ifcBytes` (#804). */
function readsFormatAsBytes(format: ReadFormat, opts?: FormatReadOptions): boolean {
  return format.kind === 'binary' || (!!opts?.ifcBytes && format === IFC_FORMAT);
}

/** De extensies die de bestandslaag als bytes leest (`binaryExtensions` van `OpenFileOptions`). */
export function binaryExtensions(opts?: FormatReadOptions): string[] {
  return READ_FORMATS.filter((f) => readsFormatAsBytes(f, opts)).flatMap((f) => f.extensions);
}

/** Leest de open-route `name` als bytes (Recent, `readFormatInput`)? Zelfde regel als `binaryExtensions`, met de
 *  IFC-terugval van `readFormatForFile` voor een onbekende extensie. */
export function readsAsBytes(name: string, opts?: FormatReadOptions): boolean {
  return readsFormatAsBytes(readFormatForFile(name), opts);
}

/** Alle geregistreerde leesformaten — puur voor tests: `check-mpp-open-guard.ts` bewijst
 *  hiermee dat exact één formaat `canBeSaveTarget` draagt, zonder de private `READ_FORMATS`-array
 *  zelf te moeten exporteren. Geen productie-afnemer; introduceer er geen. */
export function allReadFormats(): readonly ReadFormat[] {
  return READ_FORMATS;
}

export function parseOpenedFile(input: FormatInput, labels?: ImportLabels, opts?: FormatReadOptions): Promise<OpenedImport> {
  return readFormatForFile(input.name).read(input, labels, opts);
}

/** Injecteerbare lees-naad voor `readFormatInput` — bewust een structureel subset-compatibele vorm
 *  van `McpFileFs` (fileTools.ts), zodat de MCP-kant 'm zonder wrapper kan meegeven; de twee
 *  Tauri-directe aanroepers (fileSlice, devBridge) geven de destructured `plugin-fs`-functies mee
 *  (`{ readTextFile, readFile }`), die dezelfde vorm hebben. */
export interface FormatIO {
  readTextFile(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

/** Leest `name` als tekst óf bytes — welke van de twee hangt af van het geregistreerde formaat.
 *  Eén plek voor de "isBinary ? readFile : readTextFile"-beslissing (fileSlice.parseExternalSource,
 *  devBridge.openFromPath, fileTools.ts's `import_schedule`-handler); de
 *  aanroeper blijft verantwoordelijk voor foutafhandeling rond de I/O zelf. */
export async function readFormatInput(name: string, io: FormatIO, opts?: FormatReadOptions): Promise<FormatInput> {
  return readsAsBytes(name, opts) ? { name, bytes: await io.readFile(name) } : { name, text: await io.readTextFile(name) };
}

/** Opslagdoel-beslissing: één plek voor de filePath/fileHandle/siteFileId-afleiding die
 *  `fileSlice.openAsDocument` (Bestand → Openen, Recente bestanden, Openen van de site) en de
 *  dev-brug nodig hebben. Een
 *  bestand van een niet-`canBeSaveTarget`-formaat krijgt GEEN opslagdoel (opslaan wordt dan
 *  opslaan-als); `ref` is de herbruikbare handle/pad/site-ref van de open-actie (`null` bij de
 *  download-terugval, een niet-herbruikbare bron of een oudere site-versie), `name` de bestandsnaam
 *  als terugvalwaarde voor `filePath` wanneer er geen pad-ref is (Tauri levert een pad,
 *  web-FSA een handle, de site een id, de input-terugval geen van drieën — dan blijft alleen de naam
 *  over). */
export function saveTargetFor(
  readFormat: ReadFormat,
  ref: FileRef | null,
  name: string,
): { filePath: string | null; fileHandle: FileSystemFileHandle | null; siteFileId: string | null } {
  if (!readFormat.canBeSaveTarget) return { filePath: null, fileHandle: null, siteFileId: null };
  return {
    filePath: ref?.kind === 'path' ? ref.path : name,
    fileHandle: ref?.kind === 'handle' ? ref.handle : null,
    siteFileId: ref?.kind === 'site' ? ref.id : null,
  };
}

/** Vertaalsleutel voor een mislukte open-actie. Duck-typed op `mppCode` zodat deze module de
 *  (lazy geladen) mpp-chunk niet statisch hoeft te importeren. Returntype is de letterlijke
 *  union die de afnemer (`notify({ messageKey: … })`) verwacht — bewust
 *  hier als losse literals herhaald i.p.v. `NotificationMessageKey` te importeren, zodat deze
 *  laag (services/) niet van state/ afhangt. */
export function importErrorMessageKey(
  err: unknown,
):
  | 'notifications.openFailed'
  | 'notifications.xmlUnknownSchedule'
  | 'notifications.mppEncrypted'
  | 'notifications.mppLegacy'
  | 'notifications.mppInvalidContainer'
  | 'notifications.xerInvalidInput'
  | 'notifications.xerInvalidFile'
  | 'notifications.xerInvalidEncoding'
  | 'notifications.xerDuplicateTable'
  | 'notifications.xerMissingRequiredColumns'
  | 'notifications.xerMissingRequiredValue'
  | 'notifications.xerAmbiguousDecimal'
  | 'notifications.xerInvalidNumberFormat'
  | 'notifications.xerInvalidNumber'
  | 'notifications.xerSingleProjectRequired'
  | 'notifications.xerEmptyProject'
  | 'notifications.xerDuplicateId'
  | 'notifications.xerAmbiguousLocalRelation'
  | 'notifications.xerDanglingLocalRelation' {
  const typed = err as { mppCode?: string; xerCode?: string; xmlCode?: string; cfbCode?: string } | null | undefined;
  if (typed?.xmlCode === 'XML_UNKNOWN_SCHEDULE') return 'notifications.xmlUnknownSchedule';
  if (typed?.cfbCode === 'CFB_INVALID') return 'notifications.mppInvalidContainer';
  if (typed?.mppCode === 'MPP_ENCRYPTED') return 'notifications.mppEncrypted';
  if (typed?.mppCode === 'MPP_LEGACY') return 'notifications.mppLegacy';
  const xerKeys = {
    XER_INVALID_INPUT: 'notifications.xerInvalidInput',
    XER_INVALID_FILE: 'notifications.xerInvalidFile',
    XER_INVALID_ENCODING: 'notifications.xerInvalidEncoding',
    XER_DUPLICATE_TABLE: 'notifications.xerDuplicateTable',
    XER_MISSING_REQUIRED_COLUMNS: 'notifications.xerMissingRequiredColumns',
    XER_MISSING_REQUIRED_VALUE: 'notifications.xerMissingRequiredValue',
    XER_AMBIGUOUS_DECIMAL: 'notifications.xerAmbiguousDecimal',
    XER_INVALID_NUMBER_FORMAT: 'notifications.xerInvalidNumberFormat',
    XER_INVALID_NUMBER: 'notifications.xerInvalidNumber',
    XER_SINGLE_PROJECT_REQUIRED: 'notifications.xerSingleProjectRequired',
    XER_EMPTY_PROJECT: 'notifications.xerEmptyProject',
    XER_DUPLICATE_ID: 'notifications.xerDuplicateId',
    XER_AMBIGUOUS_LOCAL_RELATION: 'notifications.xerAmbiguousLocalRelation',
    XER_DANGLING_LOCAL_RELATION: 'notifications.xerDanglingLocalRelation',
  } as const;
  if (typed?.xerCode && typed.xerCode in xerKeys) {
    return xerKeys[typed.xerCode as keyof typeof xerKeys];
  }
  return 'notifications.openFailed';
}

// ── Export-kant ──

/**
 * De XER-schrijver, achter dezelfde lazy grens als de XER-lezer (`services/xer/` is een eigen chunk,
 * `check-xer-chunk-boundary.ts`): de hoofdbundel laadt hem pas bij een XER-export.
 */
export async function writeXerExport(input: XerWriteInput): Promise<XerWriteResult> {
  const { writeXER } = await import('@/services/xer/xerWriter');
  return writeXER(input);
}

export type ExportFormat = 'ifc' | 'csv' | 'mspdi' | 'p6' | 'xer' | 'progress-xlsx';

export interface ExportFormatMeta {
  format: ExportFormat;
  icon: string;
  labelKey: string;
  descKey: string;
  /** Korte variant voor de ribbon-exportdropdown (ExportDropdown); alleen csv wijkt af van
   *  `labelKey` — de overige drie hergebruiken hun volle label. */
  shortLabelKey?: string;
  /** Toon het label "Experimenteel" bij deze keuze (Backstage-kaart en ExportDropdown). Voor een
   *  export die niet in het doelprogramma zelf getest is en waarbij veel verloren gaat (eigenaar, 2026-10-29). */
  experimental?: boolean;
  /** Het ingebouwde profiel dat bij dit formaat past; rekent het project anders, dan volgt een hint
   *  (`exportProfileAdvice`). Geen waarde ⇒ geen hint. */
  recommendedProfile?: BuiltInProfileId;
}

/** Volgorde = de Backstage-volgorde (en die van ExportDropdown). */
export const EXPORT_FORMATS = [
  { format: 'progress-xlsx', icon: 'XLSX', labelKey: 'export.progressXlsxLabel', descKey: 'export.progressXlsxDesc', shortLabelKey: 'export.progressXlsxShort' },
  { format: 'csv', icon: 'CSV', labelKey: 'export.csvLabel', descKey: 'export.csvDesc', shortLabelKey: 'export.csvShort' },
  { format: 'mspdi', icon: 'XML', labelKey: 'export.mspdiLabel', descKey: 'export.mspdiDesc', shortLabelKey: undefined, recommendedProfile: 'msproject' },
  { format: 'p6', icon: 'P6', labelKey: 'export.p6Label', descKey: 'export.p6Desc', shortLabelKey: undefined, experimental: true, recommendedProfile: 'p6' },
  { format: 'xer', icon: 'XER', labelKey: 'export.xerLabel', descKey: 'export.xerDesc', shortLabelKey: undefined, experimental: true, recommendedProfile: 'p6' },
  { format: 'ifc', icon: 'IFC', labelKey: 'export.ifcLabel', descKey: 'export.ifcDesc', shortLabelKey: undefined },
] as const satisfies readonly ExportFormatMeta[];
