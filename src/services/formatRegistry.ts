import type { XerWriteInput, XerWriteResult } from '@/services/xerWriteTypes';
import type { BuiltInProfileId } from '@/types/project';
import { readIFCWithXerReconstruction, type IfcReadWithXerOptions } from '@/services/ifc/ifcReadWithXer';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { readCSV } from '@/services/csv/csvReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import type { ImportLabels, ImportResult, OpenedImport } from '@/services/importTypes';
import type { FileFilter, FileRef } from '@/services/fileAccess';
import { basename, extensionOf, isIfcxName } from '@/utils/filePath';
import { ifcForeignContentEnabled, ifcxEnabled, type FeatureFlagValues } from '@/utils/featureFlags';

export interface FormatInput { name: string; text?: string; bytes?: Uint8Array }

export interface ReadFormat {
  id: string;
  extensions: string[];
  kind: 'text' | 'binary';
  filterName: string;
  canBeSaveTarget?: boolean;
  read(input: FormatInput, labels?: ImportLabels, opts?: FormatReadOptions): Promise<OpenedImport>;
}

export interface FormatReadOptions {
  ifcBytes?: boolean;
  ifcx?: boolean;
}

export function readOptionsFor(featureFlags: Readonly<FeatureFlagValues>): FormatReadOptions {
  return { ifcBytes: ifcForeignContentEnabled(featureFlags), ...(ifcxEnabled(featureFlags) ? { ifcx: true } : {}) };
}

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

export function detectXmlFlavor(content: string): 'p6' | 'mspdi' | null {
  const root = xmlRootElement(content);
  if (!root) return null;
  if (root.localName === 'APIBusinessObjects' || root.namespace.startsWith('http://xmlns.oracle.com/Primavera')) return 'p6';
  if (root.localName === 'Project' && (root.namespace === '' || root.namespace.startsWith('http://schemas.microsoft.com/project'))) return 'mspdi';
  return null;
}

export class UnknownScheduleXmlError extends Error {
  readonly xmlCode = 'XML_UNKNOWN_SCHEDULE';
  constructor() {
    super('Unknown XML format: the root element is not an MS Project (Project) or Primavera P6 (APIBusinessObjects) schedule');
    this.name = 'UnknownScheduleXmlError';
  }
}

async function parseProjectXml(content: string): Promise<OpenedImport> {
  const flavor = detectXmlFlavor(content);
  if (flavor === 'p6') {
    const { readP6XMLDocuments } = await import('@/services/p6/p6xmlReader');
    return readP6XMLDocuments(content);
  }
  if (flavor === 'mspdi') return readMSPDI(content);
  throw new UnknownScheduleXmlError();
}

export { readIFCWithXerReconstruction } from '@/services/ifc/ifcReadWithXer';

const IFC_FORMAT: ReadFormat = {
  id: 'ifc', extensions: ['ifc'], kind: 'text', filterName: 'IFC Files', canBeSaveTarget: true,
  read: async (i, labels, opts) => {
    if (!opts?.ifcBytes) return readIFCWithXerReconstruction(i.text ?? '', labels);
    return i.bytes ? readIfcViaBytesRoute(i.bytes, labels) : readIfcFromText(i.text ?? '', labels, opts);
  },
};

async function readIfcViaBytesRoute(
  bytes: Uint8Array, labels?: ImportLabels, options: Pick<IfcReadWithXerOptions, 'resolveXerArchiveReference'> = {},
): Promise<ImportResult> {
  const { readIfcBytes } = await import('@/services/ifc/foreign/ifcBytesRoute');
  return readIfcBytes(bytes, labels, options.resolveXerArchiveReference ? { resolveXerArchiveReference: options.resolveXerArchiveReference } : {});
}

export function readIfcFromText(
  text: string, labels?: ImportLabels, opts?: FormatReadOptions & Pick<IfcReadWithXerOptions, 'resolveXerArchiveReference'>,
): Promise<ImportResult> {
  const xer = opts?.resolveXerArchiveReference ? { resolveXerArchiveReference: opts.resolveXerArchiveReference } : {};
  if (!opts?.ifcBytes) return readIFCWithXerReconstruction(text, labels, xer);
  return readIfcViaBytesRoute(new TextEncoder().encode(text), labels, xer);
}

const READ_FORMATS: ReadFormat[] = [
  IFC_FORMAT,
  { id: 'csv', extensions: ['csv'], kind: 'text', filterName: 'CSV Files',
    read: async (i) => readCSV(i.text ?? '') },
  { id: 'xml', extensions: ['xml'], kind: 'text', filterName: 'XML Files',
    read: async (i) => parseProjectXml(i.text ?? '') },
  { id: 'mpp', extensions: ['mpp'], kind: 'binary', filterName: 'MS Project Files',
    read: async (i, labels) => {
      if (!i.bytes) throw new Error('MPP requires binary content');
      const { readMPP } = await import('@/services/mpp/mppReader');
      return readMPP(i.bytes, labels);
    } },
  { id: 'xer', extensions: ['xer'], kind: 'binary', filterName: 'Primavera XER Files',
    read: async (i) => {
      if (!i.bytes) throw new Error('XER requires original binary content');
      const { readXER } = await import('@/services/xer/xerReader');
      await precomputeSha256(i.bytes);
      return readXER(i.bytes);
    } },
];

const IFCX_FORMAT: ReadFormat = {
  id: 'ifcx', extensions: ['ifcx'], kind: 'binary', filterName: 'IFCX Files', canBeSaveTarget: true,
  read: async (i, labels) => {
    if (!i.bytes) throw new Error('IFCX requires binary content');
    const { openIfcx } = await import('@/services/ifc/ifcxOpen');
    return openIfcx(i.bytes, i.name, labels);
  },
};

const READ_FORMATS_WITH_IFCX: readonly ReadFormat[] = [IFC_FORMAT, IFCX_FORMAT, ...READ_FORMATS.slice(1)];

function readFormats(opts?: FormatReadOptions): readonly ReadFormat[] {
  return opts?.ifcx ? READ_FORMATS_WITH_IFCX : READ_FORMATS;
}

export function readFormatForFile(name: string, opts?: FormatReadOptions): ReadFormat {
  const ext = extensionOf(name);
  return readFormats(opts).find((f) => f.extensions.includes(ext) && (f !== IFCX_FORMAT || isIfcxName(name))) ?? IFC_FORMAT;
}

export const IFCX_FILE_FILTERS: readonly FileFilter[] = [{ name: IFCX_FORMAT.filterName, extensions: IFCX_FORMAT.extensions }];

export function isReadableFileName(name: string, opts?: FormatReadOptions): boolean {
  const base = basename(name);
  const dot = base.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = base.slice(dot + 1).toLowerCase();
  return readFormats(opts).some((f) => f.extensions.includes(ext));
}

export function openDialogFilters(opts?: FormatReadOptions): FileFilter[] {
  const formats = readFormats(opts);
  return [
    { name: 'All Supported', extensions: formats.flatMap((f) => f.extensions) },
    ...formats.map((f) => ({ name: f.filterName, extensions: f.extensions })),
  ];
}

function readsFormatAsBytes(format: ReadFormat, opts?: FormatReadOptions): boolean {
  return format.kind === 'binary' || (!!opts?.ifcBytes && format === IFC_FORMAT);
}

export function binaryExtensions(opts?: FormatReadOptions): string[] {
  return readFormats(opts).filter((f) => readsFormatAsBytes(f, opts)).flatMap((f) => f.extensions);
}

export function readsAsBytes(name: string, opts?: FormatReadOptions): boolean {
  return readsFormatAsBytes(readFormatForFile(name, opts), opts);
}

export function allReadFormats(): readonly ReadFormat[] {
  return READ_FORMATS;
}

export function parseOpenedFile(input: FormatInput, labels?: ImportLabels, opts?: FormatReadOptions): Promise<OpenedImport> {
  return readFormatForFile(input.name, opts).read(input, labels, opts);
}

export interface FormatIO {
  readTextFile(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

export async function readFormatInput(name: string, io: FormatIO, opts?: FormatReadOptions): Promise<FormatInput> {
  return readsAsBytes(name, opts) ? { name, bytes: await io.readFile(name) } : { name, text: await io.readTextFile(name) };
}

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

export function importErrorMessageKey(
  err: unknown,
):
  | 'notifications.ifcForeignOpenSchema'
  | 'notifications.ifcForeignOpenUnsafe'
  | 'ifcx.open.foreign'
  | 'ifcx.open.noPlanning'
  | 'ifcx.open.newer'
  | 'ifcx.open.unsupportedVersion'
  | 'ifcx.open.invalid'
  | 'ifcx.open.notIfcx'
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
  const typed = err as { name?: string; mppCode?: string; xerCode?: string; xmlCode?: string; cfbCode?: string; code?: string; fallback?: { kind?: string } } | null | undefined;
  if (typed?.name === 'IfcxReadError') {
    if (typed.code === 'foreign') return 'ifcx.open.foreign';
    if (typed.code === 'no-planning') return 'ifcx.open.noPlanning';
    if (typed.code === 'version') return 'ifcx.open.unsupportedVersion';
    if (typed.code === 'newer-profile') return 'ifcx.open.newer';
    if (typed.code === 'not-ifcx') return 'ifcx.open.notIfcx';
    return 'ifcx.open.invalid';
  }
  if (typed?.code === 'IFC_FOREIGN_OPEN_REFUSED') return typed.fallback?.kind === 'schema'
    ? 'notifications.ifcForeignOpenSchema' : 'notifications.ifcForeignOpenUnsafe';
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
  shortLabelKey?: string;
  experimental?: boolean;
  recommendedProfile?: BuiltInProfileId;
}

export const EXPORT_FORMATS = [
  { format: 'progress-xlsx', icon: 'XLSX', labelKey: 'export.progressXlsxLabel', descKey: 'export.progressXlsxDesc', shortLabelKey: 'export.progressXlsxShort' },
  { format: 'csv', icon: 'CSV', labelKey: 'export.csvLabel', descKey: 'export.csvDesc', shortLabelKey: 'export.csvShort' },
  { format: 'mspdi', icon: 'XML', labelKey: 'export.mspdiLabel', descKey: 'export.mspdiDesc', shortLabelKey: undefined, recommendedProfile: 'msproject' },
  { format: 'p6', icon: 'P6', labelKey: 'export.p6Label', descKey: 'export.p6Desc', shortLabelKey: undefined, experimental: true, recommendedProfile: 'p6' },
  { format: 'xer', icon: 'XER', labelKey: 'export.xerLabel', descKey: 'export.xerDesc', shortLabelKey: undefined, experimental: true, recommendedProfile: 'p6' },
  { format: 'ifc', icon: 'IFC', labelKey: 'export.ifcLabel', descKey: 'export.ifcDesc', shortLabelKey: undefined },
] as const satisfies readonly ExportFormatMeta[];
