// Eén registry voor de extensie→reader-dispatch, die tot nu toe 5× gedupliceerd was
// (fileSlice.openFile/openRecentFile/parseExternalSource, fileTools.parseByExtension,
// devBridge.openFromPath) plus de bijbehorende exportlijst (Backstage). Pure refactor —
// gedrag ongewijzigd (fase 3.8 etappe 1, taak T1).

import { readIFC } from '@/services/ifc/ifcReader';
import { readCSV } from '@/services/csv/csvReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readP6XML } from '@/services/p6/p6xmlReader';
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import type { FileFilter, FileRef } from '@/services/fileAccess';
import { extensionOf } from '@/utils/filePath';

/** Invoer voor een reader: tekstformaten krijgen `text`, binaire formaten `bytes`. */
export interface FormatInput { name: string; text?: string; bytes?: Uint8Array }

export interface ReadFormat {
  id: string;
  extensions: string[];
  kind: 'text' | 'binary';
  /** Dialoogfilterlabel — bewust hard-coded Engels (bestaande conventie: 'IFC Files'). */
  filterName: string;
  /** Mag een geopend bestand van dit formaat het OPSLAGDOEL (filePath/fileHandle) van het document
   *  worden? (T11, T8-kwaliteitsreview-agenda, stap 0-ter b.) Opslaan schrijft ALTIJD IFC-tekst
   *  terug — dat is alleen correct als de bron zelf ook IFC was; élk ander bronformaat zou de
   *  eerstvolgende Ctrl+S zijn eigen bronbestand met IFC-inhoud laten overschrijven. Ontbreekt
   *  (`undefined`) ⇒ `false`, dus alleen de IFC-entry hoeft 'm expliciet op `true` te zetten.
   *  Vervangt de eerdere `id === 'ifc'`/`format === 'IFC' && !isBinary`-vergelijkingen in
   *  `fileSlice.ts` en `fileTools.ts` — één vlag, één plek. */
  canBeSaveTarget?: boolean;
  read(input: FormatInput, labels?: ImportLabels): Promise<ImportResult>;
}

/** Interne subdispatch voor de xml-entry van `READ_FORMATS`: kies de juiste XML-reader op basis
 *  van inhoudsmarkers (P6 vóór MS Project). Gooit bij een onbekend formaat i.p.v. stil als MSPDI
 *  te parsen. Niet geëxporteerd (T1-restpunt): geen afnemer buiten deze module — de enige
 *  aanroeper is de xml-entry hieronder. */
function parseProjectXml(content: string): ImportResult {
  const isP6 = content.includes('APIBusinessObjects') || content.includes('Primavera');
  const isMsProject =
    content.includes('schemas.microsoft.com/project') || content.includes('<Project');
  if (isP6) return readP6XML(content);
  if (isMsProject) return readMSPDI(content);
  throw new Error('Onbekend XML-formaat: geen MS Project- of Primavera-markers gevonden');
}

/** Default-formaat bij een onbekende extensie (bestaand gedrag: de else-tak van alle vijf
 *  kopieën). Een APARTE, benoemde const-entry (T1-restpunt) i.p.v. `READ_FORMATS.find(...)!` —
 *  zo kan de default nooit "zoek 'm op en forceer met `!`" zijn (een niet-gevonden id zou dat stil
 *  tot een runtime-crash maken); de entry staat bovendien nog steeds gewoon IN `READ_FORMATS`,
 *  dus herordenen wisselt 'm nooit stilzwijgend. */
const IFC_FORMAT: ReadFormat = {
  id: 'ifc', extensions: ['ifc'], kind: 'text', filterName: 'IFC Files', canBeSaveTarget: true,
  read: async (i, labels) => readIFC(i.text ?? '', labels),
};

// Volgorde = bestaande filtervolgorde in openFile ('All Supported' met ifc,csv,xml,mpp).
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
];

/** Extensie-match; onbekende extensie ⇒ de default (IFC). */
export function readFormatForFile(name: string): ReadFormat {
  const ext = extensionOf(name);
  return READ_FORMATS.find((f) => f.extensions.includes(ext)) ?? IFC_FORMAT;
}

export function openDialogFilters(): FileFilter[] {
  return [
    { name: 'All Supported', extensions: READ_FORMATS.flatMap((f) => f.extensions) },
    ...READ_FORMATS.map((f) => ({ name: f.filterName, extensions: f.extensions })),
  ];
}

export function binaryExtensions(): string[] {
  return READ_FORMATS.filter((f) => f.kind === 'binary').flatMap((f) => f.extensions);
}

/** Alle geregistreerde leesformaten (T11) — puur voor tests: `check-mpp-open-guard.ts` bewijst
 *  hiermee dat exact één formaat `canBeSaveTarget` draagt, zonder de private `READ_FORMATS`-array
 *  zelf te moeten exporteren. Geen productie-afnemer; introduceer er geen. */
export function allReadFormats(): readonly ReadFormat[] {
  return READ_FORMATS;
}

export function parseOpenedFile(input: FormatInput, labels?: ImportLabels): Promise<ImportResult> {
  return readFormatForFile(input.name).read(input, labels);
}

/** Injecteerbare lees-naad voor `readFormatInput` — bewust een structureel subset-compatibele vorm
 *  van `McpFileFs` (fileTools.ts), zodat de MCP-kant 'm zonder wrapper kan meegeven; de twee
 *  Tauri-directe aanroepers (fileSlice, devBridge) geven de destructured `plugin-fs`-functies mee
 *  (`{ readTextFile, readFile }`), die dezelfde vorm hebben. */
export interface FormatIO {
  readTextFile(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

/** Leest `name` als tekst óf bytes — welke van de twee hangt af van het geregistreerde formaat
 *  (T11, T2-kwaliteitsreview-agenda stap 0 a): de "isBinary ? readFile : readTextFile"-tak stond
 *  tot deze refactor 3x los (fileSlice.parseExternalSource, devBridge.openFromPath, en in
 *  aangepaste vorm fileTools.ts's `import_schedule`-handler). Eén plek voor de beslissing; de
 *  aanroeper blijft verantwoordelijk voor foutafhandeling rond de I/O zelf. */
export async function readFormatInput(name: string, io: FormatIO): Promise<FormatInput> {
  const isBinary = readFormatForFile(name).kind === 'binary';
  return isBinary ? { name, bytes: await io.readFile(name) } : { name, text: await io.readTextFile(name) };
}

/** Opslagdoel-beslissing (T11, T8-kwaliteitsreview-agenda stap 0-ter b): één plek voor de
 *  filePath/fileHandle-afleiding die `fileSlice.openFile` en `openRecentFile` allebei nodig
 *  hebben — vóór deze helper stond die logica tweemaal, geformuleerd als `id === 'ifc'`. Een
 *  bestand van een niet-`canBeSaveTarget`-formaat krijgt GEEN opslagdoel (opslaan wordt dan
 *  opslaan-als); `ref` is de herbruikbare handle/pad van de open-actie (`null` bij de download-
 *  terugval of een niet-herbruikbare bron), `name` de bestandsnaam als terugvalwaarde voor
 *  `filePath` wanneer er geen pad-ref is (spiegelt het bestaande gedrag: Tauri levert een pad,
 *  web-FSA een handle, de input-terugval geen van beide — dan blijft alleen de naam over). */
export function saveTargetFor(
  readFormat: ReadFormat,
  ref: FileRef | null,
  name: string,
): { filePath: string | null; fileHandle: FileSystemFileHandle | null } {
  if (!readFormat.canBeSaveTarget) return { filePath: null, fileHandle: null };
  return {
    filePath: ref?.kind === 'path' ? ref.path : name,
    fileHandle: ref?.kind === 'handle' ? ref.handle : null,
  };
}

/** Vertaalsleutel voor een mislukte open-actie. Duck-typed op `mppCode` zodat deze module de
 *  (lazy geladen) mpp-chunk niet statisch hoeft te importeren. Returntype is de letterlijke
 *  union die de enige geplande afnemer (T8: `notify({ messageKey: … })`) verwacht — bewust
 *  hier als losse literals herhaald i.p.v. `NotificationMessageKey` te importeren, zodat deze
 *  laag (services/) niet van state/ afhangt. */
export function importErrorMessageKey(
  err: unknown,
): 'notifications.openFailed' | 'notifications.mppEncrypted' | 'notifications.mppLegacy' {
  const code = (err as { mppCode?: string } | null | undefined)?.mppCode;
  if (code === 'MPP_ENCRYPTED') return 'notifications.mppEncrypted';
  if (code === 'MPP_LEGACY') return 'notifications.mppLegacy';
  return 'notifications.openFailed';
}

// ── Export-kant ──

export type ExportFormat = 'ifc' | 'csv' | 'mspdi' | 'p6';

export interface ExportFormatMeta {
  format: ExportFormat;
  icon: string;
  labelKey: string;
  descKey: string;
  /** Korte variant voor de ribbon-exportdropdown (ExportDropdown); alleen csv wijkt af van
   *  `labelKey` — de overige drie hergebruiken hun volle label. */
  shortLabelKey?: string;
}

/** Volgorde = bestaande Backstage-volgorde (en, sinds de review-fix, ook ExportDropdown). */
export const EXPORT_FORMATS = [
  { format: 'csv', icon: 'CSV', labelKey: 'export.csvLabel', descKey: 'export.csvDesc', shortLabelKey: 'export.csvShort' },
  { format: 'mspdi', icon: 'XML', labelKey: 'export.mspdiLabel', descKey: 'export.mspdiDesc', shortLabelKey: undefined },
  { format: 'p6', icon: 'P6', labelKey: 'export.p6Label', descKey: 'export.p6Desc', shortLabelKey: undefined },
  { format: 'ifc', icon: 'IFC', labelKey: 'export.ifcLabel', descKey: 'export.ifcDesc', shortLabelKey: undefined },
] as const satisfies readonly ExportFormatMeta[];
