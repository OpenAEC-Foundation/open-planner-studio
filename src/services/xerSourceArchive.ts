/**
 * De onveranderde brontekst van een geïmporteerd XER-bestand. Dit is bewust
 * een algemene service: de IFC-laag moet het archief kunnen verwerken zonder
 * de lazy XER-parserchunk te laden.
 */

import type {
  XerImportMetadata,
  XerImportReport,
  XerScheduleOptionsDiagnostic,
  XerScheduleOptionsMetadata,
  XerScheduleOptionsSourceArchive,
  XerTableReportMetadata,
} from './importTypes';
import type { XerMetadataCatalog } from './xer/xerMetadataTypes';
import type { XerResourceCatalog } from './xer/xerResources';
import type { XerResourceIssue, XerTaskResourceSource } from './xer/xerResourceTypes';
import {
  deriveXerAssignmentSkipExpectation,
  xerAssignmentSourceId,
  type XerAssignmentSkipExpectation,
  type XerAssignmentSkipReason,
} from './xer/xerAssignmentProvenance';

export const XER_SOURCE_ARCHIVE_SCHEMA_VERSION = 1;
export const XER_SOURCE_ARCHIVE_CHUNK_BYTES = 196_608;
/**
 * IFC-envelopeversie. De runtime-archivevorm blijft schema 1: alleen de persistente container
 * verandert. Schema 2 bewaart geen projecteerbare metadata, maar reconstrueert die uit de bytes.
 */
export const XER_SOURCE_ARCHIVE_COMPACT_STORAGE_SCHEMA_VERSION = 2;
export const XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT = 'raw-source-reconstruction-v1';

export type XerSourceArchiveEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
export type XerSourceArchiveBom = 'utf-8' | 'utf-16le' | 'utf-16be' | 'none';
export type XerSourceArchiveNewline = 'crlf' | 'lf' | 'cr' | 'mixed' | 'none';

export interface XerNumberFormatMetadata {
  readonly decimal: '.' | ',';
  readonly group: '.' | ',' | null;
  readonly source: 'currtype' | 'default';
  readonly currencyCode: string;
}

export interface XerArchiveSourceRowV1 {
  readonly line: number;
  readonly cells: Readonly<Record<string, string>>;
}

export interface XerArchiveReadModelV1 {
  readonly schemaVersion: 1;
  readonly numberFormat: XerNumberFormatMetadata;
  /** X5: de enige file-wide PROJECT/SCHEDOPTIONS-broncache. */
  readonly scheduleOptionsSourceArchive: XerScheduleOptionsSourceArchive;
  readonly resourceCatalog: XerResourceCatalog;
  readonly metadataCatalog: XerMetadataCatalog;
  /** TASK-cellen blijven met lege/letterlijke tokens beschikbaar nadat de semantische taak is genormaliseerd. */
  readonly taskSourceRowsByProject: Readonly<Record<string, readonly XerArchiveSourceRowV1[]>>;
}

export type XerArchiveScheduleOptionsViewV1 = Omit<
  XerScheduleOptionsMetadata,
  'sourceArchive' | 'sourceRows'
>;

export type XerArchiveDocumentViewV1 = Omit<
  XerImportMetadata,
  'resources' | 'metadata' | 'scheduleOptions'
> & {
  sourceProjectId: string;
  scheduleOptions: XerArchiveScheduleOptionsViewV1;
  resources?: {
    assignments: XerTaskResourceSource[];
    issues: XerResourceIssue[];
  };
};

export interface XerArchiveDiagnosticsV1 {
  readonly schemaVersion: 1;
  readonly file: {
    readonly tableReport: XerTableReportMetadata;
    readonly scheduleOptions: readonly XerScheduleOptionsDiagnostic[];
    readonly relationResolutionIssues: readonly {
      reason: 'ambiguous' | 'dangling';
      line: number;
      field: 'task_id' | 'pred_task_id' | 'proj_id';
      taskId: string;
      predecessorTaskId: string;
    }[];
    readonly resourceCatalogIssues: readonly XerResourceIssue[];
    readonly metadataCatalogIssues: XerMetadataCatalog['issues'];
    readonly importReport: XerImportReport;
  };
  readonly documentViews: Readonly<Record<string, XerArchiveDocumentViewV1>>;
  /** Alleen voor extensies; kern/UI leest dit nooit zonder een eigen versiegebonden validator. */
  readonly opaqueExtensions?: Readonly<Record<string, unknown>>;
}

export interface XerArchiveMetadataPayloadV1 {
  readonly schemaVersion: 1;
  readonly diagnostics: XerArchiveDiagnosticsV1;
  readonly readModel: XerArchiveReadModelV1;
}

export class XerSourceArchiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XerSourceArchiveValidationError';
  }
}

export interface XerSourceArchive {
  readonly schemaVersion: typeof XER_SOURCE_ARCHIVE_SCHEMA_VERSION;
  readonly format: 'primavera-p6-xer';
  readonly byteLength: number;
  readonly sha256: string;
  readonly encoding: XerSourceArchiveEncoding;
  readonly bom: XerSourceArchiveBom;
  readonly newline: XerSourceArchiveNewline;
  readonly byteChunks: readonly string[];
  readonly diagnostics: XerArchiveDiagnosticsV1;
  readonly readModel: XerArchiveReadModelV1;
}

export interface XerSourceArchivePresentation {
  readonly schemaVersion?: typeof XER_SOURCE_ARCHIVE_SCHEMA_VERSION;
  readonly format?: 'primavera-p6-xer';
  readonly encoding: XerSourceArchiveEncoding;
  readonly bom: XerSourceArchiveBom;
  readonly newline: XerSourceArchiveNewline;
  readonly diagnostics: XerArchiveDiagnosticsV1;
  readonly readModel: XerArchiveReadModelV1;
}

export interface XerChunkedBytes {
  readonly byteLength: number;
  readonly sha256: string;
  readonly byteChunks: readonly string[];
}

export function chunkXerArchiveBytes(bytes: Uint8Array): XerChunkedBytes {
  const byteChunks: string[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += XER_SOURCE_ARCHIVE_CHUNK_BYTES) {
    byteChunks.push(bytesToBase64(bytes.subarray(offset, offset + XER_SOURCE_ARCHIVE_CHUNK_BYTES)));
  }
  return { byteLength: bytes.byteLength, sha256: sha256Hex(bytes), byteChunks };
}

/**
 * Maakt één gedeeld, diep onveranderlijk archief. De diagnostics worden eerst
 * gekopieerd zodat een invoeralias de bewaarde importdiagnostiek nooit later
 * kan wijzigen.
 */
export function createXerSourceArchive(
  bytes: Uint8Array,
  presentation: XerSourceArchivePresentation,
): XerSourceArchive {
  return buildXerSourceArchive(bytes, presentation, true);
}

/**
 * Ownership-transfer voor readers die diagnostics/readmodel in dezelfde call vers hebben gebouwd
 * en geen referentie buiten het resultaat publiceren. Dit voorkomt bij grote X6/X8-catalogi een
 * tweede volledige heapkopie. Algemene aanroepers gebruiken altijd `createXerSourceArchive`, dat
 * invoeraliasing door een defensive clone uitsluit.
 */
export function createXerSourceArchiveFromOwnedMetadata(
  bytes: Uint8Array,
  presentation: XerSourceArchivePresentation,
): XerSourceArchive {
  return buildXerSourceArchive(bytes, presentation, false);
}

function buildXerSourceArchive(
  bytes: Uint8Array,
  presentation: XerSourceArchivePresentation,
  copyMetadata: boolean,
): XerSourceArchive {
  // Valideer vóór de base64-chunks worden gereserveerd. De structurele validator maakt bij een
  // groot X8-readmodel kortlevende pad-/sleutelwaarden; als de blijvende chunks dan al live zijn,
  // moet V8 daarvoor extra heap-pagina's openen en blijft de verse reader onnodig veel RSS houden.
  validateXerArchiveDiagnosticsV1(presentation.diagnostics);
  validateXerArchiveReadModelV1(presentation.readModel);
  validateArchiveMetadataRelations(presentation.diagnostics, presentation.readModel);
  const copiedDiagnostics = copyMetadata
    ? structuredClone(presentation.diagnostics)
    : presentation.diagnostics;
  const copiedReadModel = copyMetadata
    ? structuredClone(presentation.readModel)
    : presentation.readModel;
  const chunked = chunkXerArchiveBytes(bytes);
  return deepFreeze({
    schemaVersion: presentation.schemaVersion ?? XER_SOURCE_ARCHIVE_SCHEMA_VERSION,
    format: 'primavera-p6-xer' as const,
    byteLength: chunked.byteLength,
    sha256: chunked.sha256,
    encoding: presentation.encoding,
    bom: presentation.bom,
    newline: presentation.newline,
    byteChunks: chunked.byteChunks,
    diagnostics: copiedDiagnostics,
    readModel: copiedReadModel,
  });
}

export function createEmptyXerArchiveDiagnostics(): XerArchiveDiagnosticsV1 {
  return {
    schemaVersion: 1,
    file: {
      tableReport: { encoding: 'utf-8', endMarkerSeen: true, issues: [], unknownTables: [] },
      scheduleOptions: [],
      relationResolutionIssues: [],
      resourceCatalogIssues: [],
      metadataCatalogIssues: [],
      importReport: {
        projectsSeen: 0,
        documentsOpened: 0,
        emptyProjectsSkipped: 0,
        baselineProjectsExcluded: 0,
        baselinesMaterialized: 0,
        danglingBaselineReferences: 0,
        externalLinksPreserved: 0,
        baselineExclusionReverted: false,
        baselineFallbackReasons: [],
      },
    },
    documentViews: {},
  };
}

export function createEmptyXerArchiveDocumentView(sourceProjectId: string): XerArchiveDocumentViewV1 {
  return {
    sourceProjectId,
    defaultCurrencyCode: '',
    tableReport: { encoding: 'utf-8', endMarkerSeen: true, issues: [], unknownTables: [] },
    calendarIssues: [],
    enumFallbacks: [],
    scheduleOptions: {
      source: 'xer-defaults', retainedSource: {}, fallbacks: [], diagnostics: [],
      sourceRowIndexes: [],
    },
    externalRelations: [],
    externalLinks: [],
    report: {
      projectsSeen: 0, documentsOpened: 0, emptyProjectsSkipped: 0,
      baselineProjectsExcluded: 0, baselinesMaterialized: 0, danglingBaselineReferences: 0,
      externalLinksPreserved: 0, baselineExclusionReverted: false, baselineFallbackReasons: [],
    },
  };
}

export function createEmptyXerArchiveReadModel(): XerArchiveReadModelV1 {
  return {
    schemaVersion: 1,
    numberFormat: { decimal: '.', group: null, source: 'default', currencyCode: '' },
    scheduleOptionsSourceArchive: { rows: [], unmatchedScheduleOptionsRowIndexes: [], diagnostics: [] },
    resourceCatalog: {
      resources: [], identities: [],
      rows: { resources: [], roles: [], rates: [], curves: [], assignments: [] },
      issues: [],
    },
    metadataCatalog: {
      activityCodeTypes: [], customFieldDefs: [], taskProjections: [], taskProjectionsByProject: {},
      issues: [], issueCounts: {
        XER_ACTIVITY_CODE_MISSING_TYPE_ID: 0, XER_ACTIVITY_CODE_MISSING_VALUE_ID: 0,
        XER_ACTIVITY_CODE_DUPLICATE_TYPE_ID: 0, XER_ACTIVITY_CODE_DUPLICATE_VALUE_ID: 0,
        XER_ACTIVITY_CODE_DUPLICATE_LINK: 0, XER_ACTIVITY_CODE_DANGLING_TYPE_PARENT: 0,
        XER_ACTIVITY_CODE_DANGLING_VALUE_PARENT: 0, XER_ACTIVITY_CODE_DANGLING_TASK: 0,
        XER_ACTIVITY_CODE_DANGLING_TYPE: 0, XER_ACTIVITY_CODE_DANGLING_VALUE: 0,
        XER_UDF_MISSING_TYPE_ID: 0, XER_UDF_DUPLICATE_TYPE_ID: 0, XER_UDF_DUPLICATE_VALUE: 0,
        XER_UDF_DANGLING_TYPE: 0, XER_UDF_DANGLING_ENTITY: 0, XER_UDF_AMBIGUOUS_TASK: 0,
        XER_UDF_UNKNOWN_DATA_TYPE: 0, XER_UDF_INVALID_VALUE: 0, XER_UDF_DEFERRED_ENTITY: 0,
        XER_NOTE_DUPLICATE_MEMO_ID: 0, XER_NOTE_DANGLING_MEMO_TYPE: 0,
        XER_NOTE_DANGLING_TASK: 0, XER_NOTE_AMBIGUOUS_TASK: 0,
      },
      sourceData: {
        ACTVTYPE: [], ACTVCODE: [], TASKACTV: [], UDFTYPE: [], UDFVALUE: [], MEMOTYPE: [],
        TASKNOTE: [], TASKMEMO: [], TASK_NOTES: [], deferredUdfValues: [], unknownUdfTypes: [],
      },
    },
    taskSourceRowsByProject: {},
  };
}

/** Seriële envelope achter de gehashte DiagnosticsChunk-reeks. */
export function encodeXerArchiveMetadataPayload(archive: XerSourceArchive): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({
    schemaVersion: 1,
    diagnostics: archive.diagnostics,
    readModel: archive.readModel,
  } satisfies XerArchiveMetadataPayloadV1));
}

export function parseXerArchiveMetadataPayload(value: unknown): XerArchiveMetadataPayloadV1 {
  const payload = objectOf(value, 'archive-metadata');
  exactKeys(payload, ['schemaVersion', 'diagnostics', 'readModel'], 'archive-metadata');
  if (payload.schemaVersion !== 1) invalid('archive-metadata.schemaVersion is onbekend');
  const diagnostics = payload.diagnostics;
  const readModel = payload.readModel;
  validateXerArchiveDiagnosticsV1(diagnostics);
  validateXerArchiveReadModelV1(readModel);
  validateArchiveMetadataRelations(diagnostics, readModel);
  return { schemaVersion: 1, diagnostics, readModel };
}

function buildArchiveDocumentView(
  source: XerImportMetadata,
  transferOwnedProvenance: boolean,
): XerArchiveDocumentViewV1 {
  const {
    resources,
    metadata: _metadata,
    scheduleOptions: { sourceArchive: _sourceArchive, sourceRows: _sourceRows, ...scheduleOptions },
    ...documentFields
  } = source;
  if (!source.sourceProjectId) invalid('documentview mist sourceProjectId');
  return {
    ...structuredClone(documentFields),
    sourceProjectId: source.sourceProjectId,
    scheduleOptions: structuredClone(scheduleOptions),
    ...(resources ? {
      resources: transferOwnedProvenance
        ? { assignments: resources.assignments, issues: resources.issues }
        : structuredClone({ assignments: resources.assignments, issues: resources.issues }),
    } : {}),
  };
}

/** Defensieve publieke grens: caller-owned provenance wordt nooit bevroren of als alias bewaard. */
export function archiveDocumentView(source: XerImportMetadata): XerArchiveDocumentViewV1 {
  return buildArchiveDocumentView(source, false);
}

/**
 * Interne reader-ownershiptransfer. Alleen `readXER` gebruikt dit op vers gematerialiseerde
 * projectmetadata die vóór deze call nergens als publiek resultaat is uitgegeven.
 */
export function archiveDocumentViewFromOwnedReaderMetadata(
  source: XerImportMetadata,
): XerArchiveDocumentViewV1 {
  return buildArchiveDocumentView(source, true);
}

/** Herbouw één documentspecifieke runtimeview uitsluitend uit de canonieke archiefgrafiek. */
export function bindXerImportMetadataToArchive(
  archive: XerSourceArchive,
  sourceProjectId: string,
): XerImportMetadata {
  const view = archive.diagnostics.documentViews[sourceProjectId];
  if (!view) invalid('selector wijst naar ontbrekende documentview');
  const sourceArchive = archive.readModel.scheduleOptionsSourceArchive;
  const sourceRows = view.scheduleOptions.sourceRowIndexes.map((index, position) => {
    const row = sourceArchive.rows[index];
    if (!row) invalid(`documentview sourceRowIndexes[${position}] wijst buiten de X5-filecache`);
    return row;
  });
  Object.freeze(sourceRows);
  const { resources, ...documentFields } = view;
  return {
    ...structuredClone(documentFields),
    scheduleOptions: {
      ...structuredClone(view.scheduleOptions),
      sourceArchive,
      sourceRows,
    },
    ...(resources ? {
      resources: {
        catalog: archive.readModel.resourceCatalog,
        assignments: resources.assignments,
        issues: resources.issues,
      },
    } : {}),
    metadata: { catalog: archive.readModel.metadataCatalog },
  };
}

export function withXerArchiveDocumentView(
  archive: XerSourceArchive, source: XerImportMetadata,
): XerSourceArchive {
  const view = archiveDocumentView(source);
  if (archive.diagnostics.documentViews[view.sourceProjectId]) return archive;
  const diagnostics: XerArchiveDiagnosticsV1 = {
    ...archive.diagnostics,
    documentViews: {
      ...archive.diagnostics.documentViews,
      [view.sourceProjectId]: view,
    },
  };
  validateXerArchiveDiagnosticsV1(diagnostics);
  validateArchiveMetadataRelations(diagnostics, archive.readModel);
  return deepFreeze({ ...archive, diagnostics });
}

export function decodeXerSourceArchive(archive: XerSourceArchive): Uint8Array {
  const chunks = archive.byteChunks.map(decodeXerBase64Chunk);
  const result = new Uint8Array(archive.byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (offset !== archive.byteLength) {
    throw new Error('XER-bronarchief heeft een ongeldige byteLength.');
  }
  return result;
}

export function decodeXerBase64Chunk(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('XER-bronarchief bevat ongeldige base64.');
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function detectXerSourcePresentation(bytes: Uint8Array): XerSourceArchivePresentation {
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const hasUtf16LeBom = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
  const hasUtf16BeBom = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
  const encoding: XerSourceArchiveEncoding = hasUtf8Bom ? 'utf-8'
    : hasUtf16LeBom ? 'utf-16le'
      : hasUtf16BeBom ? 'utf-16be'
        : 'windows-1252';
  const bom: XerSourceArchiveBom = hasUtf8Bom ? 'utf-8'
    : hasUtf16LeBom ? 'utf-16le'
      : hasUtf16BeBom ? 'utf-16be'
        : 'none';
  const offset = hasUtf8Bom ? 3 : hasUtf16LeBom || hasUtf16BeBom ? 2 : 0;
  const text = new TextDecoder(encoding === 'windows-1252' ? 'windows-1252' : encoding)
    .decode(bytes.subarray(offset));
  const crlf = /\r\n/.test(text);
  const lf = /(^|[^\r])\n/.test(text);
  const cr = /\r(?!\n)/.test(text);
  const lineKinds = Number(crlf) + Number(lf) + Number(cr);
  return {
    encoding,
    bom,
    newline: lineKinds === 0 ? 'none' : lineKinds > 1 ? 'mixed' : crlf ? 'crlf' : lf ? 'lf' : 'cr',
    diagnostics: createEmptyXerArchiveDiagnostics(),
    readModel: createEmptyXerArchiveReadModel(),
  };
}

/**
 * Synchrone SHA-256 zonder omgevingsafhankelijke crypto-import. Deze functie
 * is klein maar volledig; XER-archivering moet in browser en Node identiek
 * zijn.
 */
export function sha256Hex(input: Uint8Array): string {
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotateRight = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
  const processBlock = (block: Uint8Array) => {
    const schedule = new Uint32Array(64);
    for (let index = 0; index < 16; index += 1) {
      const offset = index * 4;
      schedule[index] = ((block[offset] << 24) | (block[offset + 1] << 16) | (block[offset + 2] << 8) | block[offset + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const a = schedule[index - 15];
      const b = schedule[index - 2];
      schedule[index] = (((rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3)) + schedule[index - 7]
        + (rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10)) + schedule[index - 16]) | 0);
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choose + constants[index] + schedule[index]) | 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) | 0;
      h = g; g = f; f = e; e = (d + temporary1) | 0;
      d = c; c = b; b = a; a = (temporary1 + temporary2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  };
  let offset = 0;
  while (offset + 64 <= input.byteLength) {
    processBlock(input.subarray(offset, offset + 64));
    offset += 64;
  }
  const tail = new Uint8Array(input.byteLength - offset + 128);
  tail.set(input.subarray(offset));
  tail[input.byteLength - offset] = 0x80;
  const bitLength = BigInt(input.byteLength) * 8n;
  const lengthOffset = input.byteLength - offset < 56 ? 56 : 120;
  for (let index = 0; index < 8; index += 1) {
    tail[lengthOffset + 7 - index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
  }
  processBlock(tail.subarray(0, 64));
  if (lengthOffset === 120) processBlock(tail.subarray(64, 128));
  return hash.map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function invalid(message: string): never {
  throw new XerSourceArchiveValidationError(message);
}

function objectOf(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid(`${path} is geen gewoon object`);
  }
  return value as Record<string, unknown>;
}

function arrayOf(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${path} is geen array`);
  return value;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  if (extras.length > 0) invalid(`${path} bevat onbekende velden: ${extras.join(', ')}`);
}

function stringOf(value: unknown, path: string, allowEmpty = true): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) invalid(`${path} is geen geldige tekenreeks`);
  return value;
}

function booleanOf(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(`${path} is geen boolean`);
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid(`${path} is geen niet-negatief safe integer`);
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${path} is geen eindig getal`);
  return value;
}

function nullableFiniteNumber(value: unknown, path: string): number | null {
  return value === null ? null : finiteNumber(value, path);
}

function optionalStringFields(
  value: Record<string, unknown>, keys: readonly string[], path: string,
): void {
  for (const key of keys) if (value[key] !== undefined) stringOf(value[key], `${path}.${key}`);
}

function optionalFiniteNumberFields(
  value: Record<string, unknown>, keys: readonly string[], path: string,
): void {
  for (const key of keys) if (value[key] !== undefined) finiteNumber(value[key], `${path}.${key}`);
}

function oneOf<T extends string>(value: unknown, choices: readonly T[], path: string): T {
  if (typeof value !== 'string' || !(choices as readonly string[]).includes(value)) invalid(`${path} bevat onbekende enumwaarde`);
  return value as T;
}

function jsonValue(value: unknown, path: string): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid(`${path} bevat geen eindig getal`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => jsonValue(item, `${path}[${index}]`));
    return;
  }
  const object = objectOf(value, path);
  for (const [key, child] of Object.entries(object)) jsonValue(child, `${path}.${key}`);
}

function validateSourceRow(value: unknown, path: string): void {
  const row = objectOf(value, path);
  exactKeys(row, ['line', 'cells'], path);
  nonNegativeInteger(row.line, `${path}.line`);
  const cells = objectOf(row.cells, `${path}.cells`);
  for (const [field, cell] of Object.entries(cells)) {
    // Ruwe bronrijen zijn een lossless cache naast de exacte bytes. Legacy XER kan een lege
    // kolomkop bevatten; die celnaam mag daarom niet genormaliseerd of afgewezen worden.
    stringOf(cell, `${path}.cells.${field || '<empty>'}`);
  }
}

function validateTableReport(value: unknown, path: string): void {
  const report = objectOf(value, path);
  exactKeys(report, ['encoding', 'endMarkerSeen', 'issues', 'unknownTables'], path);
  oneOf(report.encoding, ['utf-8', 'utf-16le', 'utf-16be', 'windows-1252'], `${path}.encoding`);
  booleanOf(report.endMarkerSeen, `${path}.endMarkerSeen`);
  for (const [index, issueValue] of arrayOf(report.issues, `${path}.issues`).entries()) {
    const issue = objectOf(issueValue, `${path}.issues[${index}]`);
    exactKeys(issue, ['code', 'line', 'table', 'expected', 'actual', 'field', 'currencyCode', 'ignoredRecords', 'ignoredLines'], `${path}.issues[${index}]`);
    oneOf(issue.code, [
      'XER_MISSING_END_MARKER', 'XER_TRAILING_RECORDS_AFTER_END', 'XER_CURRENCY_NOT_FOUND',
      'XER_ROW_FIELD_COUNT_MISMATCH', 'XER_DATA_WITHOUT_FIELDS', 'XER_ORPHAN_CONTINUATION',
      'XER_DUPLICATE_FIELD', 'XER_UNKNOWN_RECORD',
    ], `${path}.issues[${index}].code`);
    nonNegativeInteger(issue.line, `${path}.issues[${index}].line`);
    for (const key of ['table', 'field', 'currencyCode'] as const) if (issue[key] !== undefined) stringOf(issue[key], `${path}.issues[${index}].${key}`);
    for (const key of ['expected', 'actual', 'ignoredRecords', 'ignoredLines'] as const) if (issue[key] !== undefined) nonNegativeInteger(issue[key], `${path}.issues[${index}].${key}`);
  }
  for (const [index, tableValue] of arrayOf(report.unknownTables, `${path}.unknownTables`).entries()) {
    const table = objectOf(tableValue, `${path}.unknownTables[${index}]`);
    exactKeys(table, ['name', 'rows'], `${path}.unknownTables[${index}]`);
    stringOf(table.name, `${path}.unknownTables[${index}].name`, false);
    nonNegativeInteger(table.rows, `${path}.unknownTables[${index}].rows`);
  }
}

const RESOURCE_ISSUE_CODES = [
  'XER_RESOURCE_CALENDAR_MISSING', 'XER_RESOURCE_NONLABOR_FALLBACK', 'XER_RESOURCE_TYPE_FALLBACK',
  'XER_RESOURCE_PARENT_MISSING', 'XER_RESOURCE_DEFAULT_ROLE_MISSING', 'XER_ROLE_PARENT_MISSING',
  'XER_RESOURCE_RATE_OWNER_MISSING', 'XER_ROLE_RATE_OWNER_MISSING', 'XER_CURVE_INVALID_POINTS',
  'XER_ASSIGNMENT_CURVE_MISSING', 'XER_ASSIGNMENT_RESOURCE_MISSING', 'XER_ASSIGNMENT_ROLE_MISSING',
  'XER_ASSIGNMENT_ASSIGNED_ROLE_MISSING', 'XER_ASSIGNMENT_TASK_MISSING',
] as const;
const RESOURCE_TABLES = ['RSRC', 'ROLES', 'RSRCRATE', 'ROLERATE', 'RSRCCURVDATA', 'TASKRSRC'] as const;
const RESOURCE_FALLBACKS = ['PROJECT_CALENDAR', 'EQUIPMENT', 'LABOR', 'UNIFORM', 'SKIPPED', 'RELATION_OMITTED'] as const;

function validateResourceIssue(value: unknown, path: string): void {
  const issue = objectOf(value, path);
  exactKeys(issue, ['code', 'table', 'line', 'sourceId', 'fallback'], path);
  oneOf(issue.code, RESOURCE_ISSUE_CODES, `${path}.code`);
  oneOf(issue.table, RESOURCE_TABLES, `${path}.table`);
  nonNegativeInteger(issue.line, `${path}.line`);
  stringOf(issue.sourceId, `${path}.sourceId`);
  oneOf(issue.fallback, RESOURCE_FALLBACKS, `${path}.fallback`);
}

const METADATA_ISSUE_CODES = [
  'XER_ACTIVITY_CODE_MISSING_TYPE_ID', 'XER_ACTIVITY_CODE_MISSING_VALUE_ID',
  'XER_ACTIVITY_CODE_DUPLICATE_TYPE_ID', 'XER_ACTIVITY_CODE_DUPLICATE_VALUE_ID',
  'XER_ACTIVITY_CODE_DUPLICATE_LINK', 'XER_ACTIVITY_CODE_DANGLING_TYPE_PARENT',
  'XER_ACTIVITY_CODE_DANGLING_VALUE_PARENT', 'XER_ACTIVITY_CODE_DANGLING_TASK',
  'XER_ACTIVITY_CODE_DANGLING_TYPE', 'XER_ACTIVITY_CODE_DANGLING_VALUE',
  'XER_UDF_MISSING_TYPE_ID', 'XER_UDF_DUPLICATE_TYPE_ID', 'XER_UDF_DUPLICATE_VALUE',
  'XER_UDF_DANGLING_TYPE', 'XER_UDF_DANGLING_ENTITY', 'XER_UDF_AMBIGUOUS_TASK',
  'XER_UDF_UNKNOWN_DATA_TYPE', 'XER_UDF_INVALID_VALUE', 'XER_UDF_DEFERRED_ENTITY',
  'XER_NOTE_DUPLICATE_MEMO_ID', 'XER_NOTE_DANGLING_MEMO_TYPE', 'XER_NOTE_DANGLING_TASK',
  'XER_NOTE_AMBIGUOUS_TASK',
] as const;
const METADATA_TABLES = ['ACTVTYPE', 'ACTVCODE', 'TASKACTV', 'UDFTYPE', 'UDFVALUE', 'TASK', 'TASKNOTE', 'TASKMEMO'] as const;

function validateMetadataIssue(value: unknown, path: string): void {
  const issue = objectOf(value, path);
  exactKeys(issue, ['code', 'table', 'line', 'lines'], path);
  oneOf(issue.code, METADATA_ISSUE_CODES, `${path}.code`);
  oneOf(issue.table, METADATA_TABLES, `${path}.table`);
  nonNegativeInteger(issue.line, `${path}.line`);
  if (issue.lines !== undefined) arrayOf(issue.lines, `${path}.lines`).forEach((line, index) => nonNegativeInteger(line, `${path}.lines[${index}]`));
}

function validateImportReport(value: unknown, path: string): void {
  const report = objectOf(value, path);
  exactKeys(report, [
    'projectsSeen', 'documentsOpened', 'emptyProjectsSkipped', 'baselineProjectsExcluded',
    'baselinesMaterialized', 'danglingBaselineReferences', 'externalLinksPreserved',
    'baselineExclusionReverted', 'baselineFallbackReasons',
  ], path);
  for (const key of [
    'projectsSeen', 'documentsOpened', 'emptyProjectsSkipped', 'baselineProjectsExcluded',
    'baselinesMaterialized', 'danglingBaselineReferences', 'externalLinksPreserved',
  ] as const) nonNegativeInteger(report[key], `${path}.${key}`);
  booleanOf(report.baselineExclusionReverted, `${path}.baselineExclusionReverted`);
  arrayOf(report.baselineFallbackReasons, `${path}.baselineFallbackReasons`).forEach((reason, index) =>
    oneOf(reason, ['self-reference', 'cycle', 'all-projects-baselines'], `${path}.baselineFallbackReasons[${index}]`));
}

function validateScheduleOptionsDiagnostic(value: unknown, path: string): void {
  const diagnostic = objectOf(value, path);
  exactKeys(diagnostic, ['code', 'projectId', 'rowIndexes', 'lines'], path);
  oneOf(diagnostic.code, ['XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID'], `${path}.code`);
  stringOf(diagnostic.projectId, `${path}.projectId`);
  for (const key of ['rowIndexes', 'lines'] as const) {
    arrayOf(diagnostic[key], `${path}.${key}`).forEach((item, index) =>
      nonNegativeInteger(item, `${path}.${key}[${index}]`));
  }
}

function validateScheduleOptionsSourceArchive(value: unknown, path: string): void {
  const archive = objectOf(value, path);
  exactKeys(archive, ['rows', 'unmatchedScheduleOptionsRowIndexes', 'diagnostics'], path);
  arrayOf(archive.rows, `${path}.rows`).forEach((row, index) => {
    const item = objectOf(row, `${path}.rows[${index}]`);
    exactKeys(item, ['table', 'line', 'cells'], `${path}.rows[${index}]`);
    oneOf(item.table, ['PROJECT', 'SCHEDOPTIONS'], `${path}.rows[${index}].table`);
    validateSourceRow({ line: item.line, cells: item.cells }, `${path}.rows[${index}]`);
  });
  arrayOf(archive.unmatchedScheduleOptionsRowIndexes, `${path}.unmatchedScheduleOptionsRowIndexes`)
    .forEach((item, index) => nonNegativeInteger(item, `${path}.unmatchedScheduleOptionsRowIndexes[${index}]`));
  arrayOf(archive.diagnostics, `${path}.diagnostics`)
    .forEach((item, index) => validateScheduleOptionsDiagnostic(item, `${path}.diagnostics[${index}]`));
}

function validateScheduleOptionsView(value: unknown, path: string): void {
  const options = objectOf(value, path);
  exactKeys(options, ['source', 'retainedSource', 'fallbacks', 'diagnostics', 'sourceRowIndexes'], path);
  oneOf(options.source, ['schedoptions', 'xer-defaults'], `${path}.source`);
  const retained = objectOf(options.retainedSource, `${path}.retainedSource`);
  exactKeys(retained, ['sched_use_project_end_date_for_float'], `${path}.retainedSource`);
  if (retained.sched_use_project_end_date_for_float !== undefined) booleanOf(retained.sched_use_project_end_date_for_float, `${path}.retainedSource.sched_use_project_end_date_for_float`);
  arrayOf(options.fallbacks, `${path}.fallbacks`).forEach((fallback, index) => {
    const item = objectOf(fallback, `${path}.fallbacks[${index}]`);
    exactKeys(item, ['field', 'token', 'fallback', 'line'], `${path}.fallbacks[${index}]`);
    stringOf(item.field, `${path}.fallbacks[${index}].field`);
    stringOf(item.token, `${path}.fallbacks[${index}].token`);
    stringOf(item.fallback, `${path}.fallbacks[${index}].fallback`);
    nonNegativeInteger(item.line, `${path}.fallbacks[${index}].line`);
  });
  arrayOf(options.diagnostics, `${path}.diagnostics`).forEach((item, index) =>
    validateScheduleOptionsDiagnostic(item, `${path}.diagnostics[${index}]`));
  arrayOf(options.sourceRowIndexes, `${path}.sourceRowIndexes`).forEach((item, index) =>
    nonNegativeInteger(item, `${path}.sourceRowIndexes[${index}]`));
}

function validateResource(value: unknown, path: string): void {
  const resource = objectOf(value, path);
  exactKeys(resource, [
    'id', 'name', 'type', 'description', 'costPerHour', 'availability', 'maxUnits', 'calendarId',
    'availabilitySteps', 'unitOfMeasure', 'parentId', 'libraryOrigin',
  ], path);
  for (const key of ['id', 'name', 'description'] as const) stringOf(resource[key], `${path}.${key}`);
  oneOf(resource.type, ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW'], `${path}.type`);
  finiteNumber(resource.maxUnits, `${path}.maxUnits`);
  optionalFiniteNumberFields(resource, ['costPerHour', 'availability'], path);
  optionalStringFields(resource, ['calendarId', 'unitOfMeasure', 'parentId'], path);
  if (resource.availabilitySteps !== undefined) {
    arrayOf(resource.availabilitySteps, `${path}.availabilitySteps`).forEach((stepValue, index) => {
      const stepPath = `${path}.availabilitySteps[${index}]`;
      const step = objectOf(stepValue, stepPath);
      exactKeys(step, ['from', 'maxUnits'], stepPath);
      stringOf(step.from, `${stepPath}.from`, false);
      finiteNumber(step.maxUnits, `${stepPath}.maxUnits`);
    });
  }
  if (resource.libraryOrigin !== undefined) {
    const origin = objectOf(resource.libraryOrigin, `${path}.libraryOrigin`);
    exactKeys(origin, ['companyId', 'libraryItemId', 'poolVersion', 'syncedHash'], `${path}.libraryOrigin`);
    stringOf(origin.companyId, `${path}.libraryOrigin.companyId`, false);
    stringOf(origin.libraryItemId, `${path}.libraryOrigin.libraryItemId`, false);
    nonNegativeInteger(origin.poolVersion, `${path}.libraryOrigin.poolVersion`);
    if (origin.syncedHash !== undefined) stringOf(origin.syncedHash, `${path}.libraryOrigin.syncedHash`);
  }
}

function validateEntityIdentity(value: unknown, path: string): void {
  const identity = objectOf(value, path);
  exactKeys(identity, ['kind', 'sourceId', 'internalId', 'line'], path);
  oneOf(identity.kind, ['RESOURCE', 'ROLE'], `${path}.kind`);
  stringOf(identity.sourceId, `${path}.sourceId`);
  stringOf(identity.internalId, `${path}.internalId`);
  nonNegativeInteger(identity.line, `${path}.line`);
}

function validateEntitySource(value: unknown, path: string): void {
  const entity = objectOf(value, path);
  exactKeys(entity, ['kind', 'sourceId', 'internalId'], path);
  oneOf(entity.kind, ['RESOURCE', 'ROLE'], `${path}.kind`);
  stringOf(entity.sourceId, `${path}.sourceId`);
  stringOf(entity.internalId, `${path}.internalId`);
}

function validateResourceSource(value: unknown, path: string): void {
  const source = objectOf(value, path);
  exactKeys(source, [
    'rawRow', 'sourceId', 'internalId', 'line', 'rawType', 'parentSourceId', 'calendarSourceId',
    'defaultRoleSourceId', 'unitSourceId',
  ], path);
  validateSourceRow(source.rawRow, `${path}.rawRow`);
  for (const key of ['sourceId', 'internalId', 'rawType'] as const) stringOf(source[key], `${path}.${key}`);
  nonNegativeInteger(source.line, `${path}.line`);
  optionalStringFields(source, ['parentSourceId', 'calendarSourceId', 'defaultRoleSourceId', 'unitSourceId'], path);
}

function validateRoleSource(value: unknown, path: string): void {
  const source = objectOf(value, path);
  exactKeys(source, ['rawRow', 'sourceId', 'internalId', 'line', 'name', 'shortName', 'description', 'parentSourceId'], path);
  validateSourceRow(source.rawRow, `${path}.rawRow`);
  for (const key of ['sourceId', 'internalId', 'name', 'shortName', 'description'] as const) stringOf(source[key], `${path}.${key}`);
  nonNegativeInteger(source.line, `${path}.line`);
  optionalStringFields(source, ['parentSourceId'], path);
}

function validateRateSource(value: unknown, path: string): void {
  const source = objectOf(value, path);
  exactKeys(source, ['rawRow', 'sourceId', 'internalId', 'entity', 'line', 'effectiveDate', 'maxUnitsPerTime', 'costs'], path);
  validateSourceRow(source.rawRow, `${path}.rawRow`);
  stringOf(source.sourceId, `${path}.sourceId`);
  stringOf(source.internalId, `${path}.internalId`);
  validateEntitySource(source.entity, `${path}.entity`);
  nonNegativeInteger(source.line, `${path}.line`);
  if (source.effectiveDate !== undefined) stringOf(source.effectiveDate, `${path}.effectiveDate`);
  nullableFiniteNumber(source.maxUnitsPerTime, `${path}.maxUnitsPerTime`);
  const costs = arrayOf(source.costs, `${path}.costs`);
  if (costs.length !== 5) invalid(`${path}.costs is geen tuple van lengte 5`);
  costs.forEach((cost, index) => nullableFiniteNumber(cost, `${path}.costs[${index}]`));
}

function validateCurveSource(value: unknown, path: string): void {
  const source = objectOf(value, path);
  exactKeys(source, ['rawRow', 'sourceId', 'internalId', 'line', 'name', 'rawPoints', 'numericPoints', 'bestFit'], path);
  validateSourceRow(source.rawRow, `${path}.rawRow`);
  for (const key of ['sourceId', 'internalId', 'name'] as const) stringOf(source[key], `${path}.${key}`);
  nonNegativeInteger(source.line, `${path}.line`);
  const rawPoints = arrayOf(source.rawPoints, `${path}.rawPoints`);
  if (rawPoints.length !== 21) invalid(`${path}.rawPoints is geen tuple van lengte 21`);
  rawPoints.forEach((point, index) => stringOf(point, `${path}.rawPoints[${index}]`));
  if (source.numericPoints !== undefined) {
    const numericPoints = arrayOf(source.numericPoints, `${path}.numericPoints`);
    if (numericPoints.length !== 21) invalid(`${path}.numericPoints is geen tuple van lengte 21`);
    numericPoints.forEach((point, index) => finiteNumber(point, `${path}.numericPoints[${index}]`));
  }
  if (source.bestFit !== undefined) oneOf(source.bestFit,
    ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK'], `${path}.bestFit`);
}

function validateTaskResourceSource(value: unknown, path: string): void {
  const source = objectOf(value, path);
  exactKeys(source, [
    'rawRow', 'sourceId', 'internalId', 'taskSourceId', 'projectSourceId', 'line', 'entity',
    'assignedRole', 'unitScale', 'quantities', 'curveSourceId', 'rawCurves', 'costs', 'rateType',
    'costSourceType', 'rawResourceType',
  ], path);
  validateSourceRow(source.rawRow, `${path}.rawRow`);
  for (const key of ['sourceId', 'internalId', 'taskSourceId'] as const) stringOf(source[key], `${path}.${key}`);
  optionalStringFields(source, ['projectSourceId', 'curveSourceId', 'rateType', 'costSourceType', 'rawResourceType'], path);
  nonNegativeInteger(source.line, `${path}.line`);
  validateEntitySource(source.entity, `${path}.entity`);
  if (source.assignedRole !== undefined) validateEntitySource(source.assignedRole, `${path}.assignedRole`);
  oneOf(source.unitScale, ['DIRECT_FRACTION', 'MATERIAL_PER_HOUR'], `${path}.unitScale`);
  const quantities = objectOf(source.quantities, `${path}.quantities`);
  exactKeys(quantities, ['remaining', 'target', 'actualRegular', 'actualOvertime', 'thisPeriod', 'remainingPerHour', 'targetPerHour'], `${path}.quantities`);
  optionalFiniteNumberFields(quantities, Object.keys(quantities), `${path}.quantities`);
  const curves = objectOf(source.rawCurves, `${path}.rawCurves`);
  exactKeys(curves, ['target', 'remaining', 'actual'], `${path}.rawCurves`);
  optionalStringFields(curves, ['target', 'remaining', 'actual'], `${path}.rawCurves`);
  const costs = objectOf(source.costs, `${path}.costs`);
  exactKeys(costs, ['perQuantity', 'target', 'remaining', 'actualRegular', 'actualOvertime', 'thisPeriod'], `${path}.costs`);
  optionalFiniteNumberFields(costs, Object.keys(costs), `${path}.costs`);
}

function validateExternalRelation(value: unknown, path: string): void {
  const relation = objectOf(value, path);
  exactKeys(relation, ['id', 'localProjectId', 'localTaskId', 'externalProjectId', 'externalTaskId', 'direction', 'type', 'lagMinutes'], path);
  for (const key of ['id', 'localProjectId', 'localTaskId', 'externalProjectId', 'externalTaskId'] as const) stringOf(relation[key], `${path}.${key}`);
  oneOf(relation.direction, ['predecessor', 'successor'], `${path}.direction`);
  oneOf(relation.type, ['FS', 'SS', 'FF', 'SF'], `${path}.type`);
  finiteNumber(relation.lagMinutes, `${path}.lagMinutes`);
}

function validateExternalLink(value: unknown, path: string): void {
  const link = objectOf(value, path);
  exactKeys(link, ['id', 'predecessor', 'successor', 'type', 'lagMinutes'], path);
  stringOf(link.id, `${path}.id`);
  for (const endpoint of ['predecessor', 'successor'] as const) {
    const item = objectOf(link[endpoint], `${path}.${endpoint}`);
    exactKeys(item, ['projectId', 'taskId'], `${path}.${endpoint}`);
    stringOf(item.projectId, `${path}.${endpoint}.projectId`);
    stringOf(item.taskId, `${path}.${endpoint}.taskId`);
  }
  oneOf(link.type, ['FS', 'SS', 'FF', 'SF'], `${path}.type`);
  finiteNumber(link.lagMinutes, `${path}.lagMinutes`);
}

function validateDocumentView(value: unknown, projectId: string, path: string): void {
  const view = objectOf(value, path);
  exactKeys(view, [
    'sourceProjectId', 'defaultCurrencyCode', 'tableReport', 'calendarIssues', 'enumFallbacks',
    'scheduleOptions', 'externalRelations', 'externalLinks', 'report', 'resources',
  ], path);
  if (stringOf(view.sourceProjectId, `${path}.sourceProjectId`, false) !== projectId) invalid(`${path}.sourceProjectId past niet bij projectselector`);
  stringOf(view.defaultCurrencyCode, `${path}.defaultCurrencyCode`);
  validateTableReport(view.tableReport, `${path}.tableReport`);
  arrayOf(view.calendarIssues, `${path}.calendarIssues`).forEach((issueValue, index) => {
    const issue = objectOf(issueValue, `${path}.calendarIssues[${index}]`);
    exactKeys(issue, ['code', 'calendarId', 'line', 'reason', 'resolution'], `${path}.calendarIssues[${index}]`);
    stringOf(issue.code, `${path}.calendarIssues[${index}].code`, false);
    stringOf(issue.calendarId, `${path}.calendarIssues[${index}].calendarId`);
    nonNegativeInteger(issue.line, `${path}.calendarIssues[${index}].line`);
    stringOf(issue.reason, `${path}.calendarIssues[${index}].reason`);
    oneOf(issue.resolution, ['RECOVERED', 'REJECTED', 'UNLINKED'], `${path}.calendarIssues[${index}].resolution`);
  });
  arrayOf(view.enumFallbacks, `${path}.enumFallbacks`).forEach((fallbackValue, index) => {
    const fallback = objectOf(fallbackValue, `${path}.enumFallbacks[${index}]`);
    exactKeys(fallback, ['family', 'token', 'fallback', 'table', 'field', 'line'], `${path}.enumFallbacks[${index}]`);
    oneOf(fallback.family, ['activityType', 'durationType', 'completePctType', 'status', 'priority', 'constraint', 'relation'], `${path}.enumFallbacks[${index}].family`);
    oneOf(fallback.table, ['PROJECT', 'TASK', 'TASKPRED'], `${path}.enumFallbacks[${index}].table`);
    for (const key of ['token', 'fallback', 'field'] as const) stringOf(fallback[key], `${path}.enumFallbacks[${index}].${key}`);
    nonNegativeInteger(fallback.line, `${path}.enumFallbacks[${index}].line`);
  });
  validateScheduleOptionsView(view.scheduleOptions, `${path}.scheduleOptions`);
  arrayOf(view.externalRelations, `${path}.externalRelations`).forEach((item, index) =>
    validateExternalRelation(item, `${path}.externalRelations[${index}]`));
  arrayOf(view.externalLinks, `${path}.externalLinks`).forEach((item, index) =>
    validateExternalLink(item, `${path}.externalLinks[${index}]`));
  validateImportReport(view.report, `${path}.report`);
  if (view.resources !== undefined) {
    const resources = objectOf(view.resources, `${path}.resources`);
    exactKeys(resources, ['assignments', 'issues'], `${path}.resources`);
    arrayOf(resources.assignments, `${path}.resources.assignments`).forEach((item, index) =>
      validateTaskResourceSource(item, `${path}.resources.assignments[${index}]`));
    arrayOf(resources.issues, `${path}.resources.issues`).forEach((item, index) => validateResourceIssue(item, `${path}.resources.issues[${index}]`));
  }
}

export function validateXerArchiveDiagnosticsV1(value: unknown): asserts value is XerArchiveDiagnosticsV1 {
  const diagnostics = objectOf(value, 'diagnostics');
  exactKeys(diagnostics, ['schemaVersion', 'file', 'documentViews', 'opaqueExtensions'], 'diagnostics');
  if (diagnostics.schemaVersion !== 1) invalid('diagnostics.schemaVersion is onbekend');
  const file = objectOf(diagnostics.file, 'diagnostics.file');
  exactKeys(file, ['tableReport', 'scheduleOptions', 'relationResolutionIssues', 'resourceCatalogIssues', 'metadataCatalogIssues', 'importReport'], 'diagnostics.file');
  validateTableReport(file.tableReport, 'diagnostics.file.tableReport');
  arrayOf(file.scheduleOptions, 'diagnostics.file.scheduleOptions').forEach((item, index) =>
    validateScheduleOptionsDiagnostic(item, `diagnostics.file.scheduleOptions[${index}]`));
  arrayOf(file.relationResolutionIssues, 'diagnostics.file.relationResolutionIssues').forEach((issueValue, index) => {
    const issue = objectOf(issueValue, `diagnostics.file.relationResolutionIssues[${index}]`);
    exactKeys(issue, ['reason', 'line', 'field', 'taskId', 'predecessorTaskId'], `diagnostics.file.relationResolutionIssues[${index}]`);
    oneOf(issue.reason, ['ambiguous', 'dangling'], `diagnostics.file.relationResolutionIssues[${index}].reason`);
    oneOf(issue.field, ['task_id', 'pred_task_id', 'proj_id'], `diagnostics.file.relationResolutionIssues[${index}].field`);
    nonNegativeInteger(issue.line, `diagnostics.file.relationResolutionIssues[${index}].line`);
    stringOf(issue.taskId, `diagnostics.file.relationResolutionIssues[${index}].taskId`);
    stringOf(issue.predecessorTaskId, `diagnostics.file.relationResolutionIssues[${index}].predecessorTaskId`);
  });
  arrayOf(file.resourceCatalogIssues, 'diagnostics.file.resourceCatalogIssues').forEach((item, index) => validateResourceIssue(item, `diagnostics.file.resourceCatalogIssues[${index}]`));
  arrayOf(file.metadataCatalogIssues, 'diagnostics.file.metadataCatalogIssues').forEach((item, index) => validateMetadataIssue(item, `diagnostics.file.metadataCatalogIssues[${index}]`));
  validateImportReport(file.importReport, 'diagnostics.file.importReport');
  const views = objectOf(diagnostics.documentViews, 'diagnostics.documentViews');
  for (const [projectId, view] of Object.entries(views)) {
    if (!projectId) invalid('diagnostics.documentViews bevat een lege projectselector');
    validateDocumentView(view, projectId, `diagnostics.documentViews.${projectId}`);
  }
  if (diagnostics.opaqueExtensions !== undefined) jsonValue(objectOf(diagnostics.opaqueExtensions, 'diagnostics.opaqueExtensions'), 'diagnostics.opaqueExtensions');
}

function validateActivityCodeType(value: unknown, path: string): void {
  const type = objectOf(value, path);
  exactKeys(type, ['id', 'name', 'values'], path);
  stringOf(type.id, `${path}.id`);
  stringOf(type.name, `${path}.name`);
  arrayOf(type.values, `${path}.values`).forEach((valueItem, index) => {
    const valuePath = `${path}.values[${index}]`;
    const code = objectOf(valueItem, valuePath);
    exactKeys(code, ['id', 'code', 'description', 'color'], valuePath);
    stringOf(code.id, `${valuePath}.id`);
    stringOf(code.code, `${valuePath}.code`);
    optionalStringFields(code, ['description', 'color'], valuePath);
  });
}

function validateCustomFieldDef(value: unknown, path: string): void {
  const field = objectOf(value, path);
  exactKeys(field, ['id', 'name', 'type'], path);
  stringOf(field.id, `${path}.id`);
  stringOf(field.name, `${path}.name`);
  oneOf(field.type, ['text', 'number', 'integer', 'cost', 'date', 'boolean'], `${path}.type`);
}

function validateTaskProjection(value: unknown, path: string): void {
  const projection = objectOf(value, path);
  exactKeys(projection, ['projectId', 'taskId', 'activityCodes', 'customFields', 'notes'], path);
  stringOf(projection.projectId, `${path}.projectId`);
  stringOf(projection.taskId, `${path}.taskId`);
  if (projection.activityCodes !== undefined) {
    const codes = objectOf(projection.activityCodes, `${path}.activityCodes`);
    for (const [key, code] of Object.entries(codes)) stringOf(code, `${path}.activityCodes.${key || '<empty>'}`);
  }
  if (projection.customFields !== undefined) {
    const fields = objectOf(projection.customFields, `${path}.customFields`);
    for (const [key, field] of Object.entries(fields)) {
      if (typeof field === 'number') finiteNumber(field, `${path}.customFields.${key || '<empty>'}`);
      else if (typeof field !== 'string' && typeof field !== 'boolean') invalid(`${path}.customFields.${key || '<empty>'} heeft een ongeldige waarde`);
    }
  }
  if (projection.notes !== undefined) {
    arrayOf(projection.notes, `${path}.notes`).forEach((noteValue, index) => {
      const notePath = `${path}.notes[${index}]`;
      const note = objectOf(noteValue, notePath);
      exactKeys(note, ['id', 'text', 'done'], notePath);
      stringOf(note.id, `${notePath}.id`);
      stringOf(note.text, `${notePath}.text`);
      booleanOf(note.done, `${notePath}.done`);
    });
  }
}

export function validateXerArchiveReadModelV1(value: unknown): asserts value is XerArchiveReadModelV1 {
  const model = objectOf(value, 'readModel');
  exactKeys(model, ['schemaVersion', 'numberFormat', 'scheduleOptionsSourceArchive', 'resourceCatalog', 'metadataCatalog', 'taskSourceRowsByProject'], 'readModel');
  if (model.schemaVersion !== 1) invalid('readModel.schemaVersion is onbekend');
  const numberFormat = objectOf(model.numberFormat, 'readModel.numberFormat');
  exactKeys(numberFormat, ['decimal', 'group', 'source', 'currencyCode'], 'readModel.numberFormat');
  const decimal = oneOf(numberFormat.decimal, ['.', ','], 'readModel.numberFormat.decimal');
  const group = numberFormat.group === null ? null : oneOf(numberFormat.group, ['.', ','], 'readModel.numberFormat.group');
  if (group === decimal) invalid('readModel.numberFormat.group is gelijk aan decimal');
  oneOf(numberFormat.source, ['currtype', 'default'], 'readModel.numberFormat.source');
  stringOf(numberFormat.currencyCode, 'readModel.numberFormat.currencyCode');
  validateScheduleOptionsSourceArchive(model.scheduleOptionsSourceArchive, 'readModel.scheduleOptionsSourceArchive');

  const resources = objectOf(model.resourceCatalog, 'readModel.resourceCatalog');
  exactKeys(resources, ['resources', 'identities', 'rows', 'issues'], 'readModel.resourceCatalog');
  arrayOf(resources.resources, 'readModel.resourceCatalog.resources').forEach((item, index) =>
    validateResource(item, `readModel.resourceCatalog.resources[${index}]`));
  arrayOf(resources.identities, 'readModel.resourceCatalog.identities').forEach((item, index) =>
    validateEntityIdentity(item, `readModel.resourceCatalog.identities[${index}]`));
  const resourceRows = objectOf(resources.rows, 'readModel.resourceCatalog.rows');
  exactKeys(resourceRows, ['resources', 'roles', 'rates', 'curves', 'assignments'], 'readModel.resourceCatalog.rows');
  arrayOf(resourceRows.resources, 'readModel.resourceCatalog.rows.resources').forEach((item, index) =>
    validateResourceSource(item, `readModel.resourceCatalog.rows.resources[${index}]`));
  arrayOf(resourceRows.roles, 'readModel.resourceCatalog.rows.roles').forEach((item, index) =>
    validateRoleSource(item, `readModel.resourceCatalog.rows.roles[${index}]`));
  arrayOf(resourceRows.rates, 'readModel.resourceCatalog.rows.rates').forEach((item, index) =>
    validateRateSource(item, `readModel.resourceCatalog.rows.rates[${index}]`));
  arrayOf(resourceRows.curves, 'readModel.resourceCatalog.rows.curves').forEach((item, index) =>
    validateCurveSource(item, `readModel.resourceCatalog.rows.curves[${index}]`));
  arrayOf(resourceRows.assignments, 'readModel.resourceCatalog.rows.assignments').forEach((row, index) => validateSourceRow(row, `readModel.resourceCatalog.rows.assignments[${index}]`));
  arrayOf(resources.issues, 'readModel.resourceCatalog.issues').forEach((item, index) => validateResourceIssue(item, `readModel.resourceCatalog.issues[${index}]`));

  const metadata = objectOf(model.metadataCatalog, 'readModel.metadataCatalog');
  exactKeys(metadata, ['activityCodeTypes', 'customFieldDefs', 'taskProjections', 'taskProjectionsByProject', 'issues', 'issueCounts', 'sourceData'], 'readModel.metadataCatalog');
  arrayOf(metadata.activityCodeTypes, 'readModel.metadataCatalog.activityCodeTypes').forEach((item, index) =>
    validateActivityCodeType(item, `readModel.metadataCatalog.activityCodeTypes[${index}]`));
  arrayOf(metadata.customFieldDefs, 'readModel.metadataCatalog.customFieldDefs').forEach((item, index) =>
    validateCustomFieldDef(item, `readModel.metadataCatalog.customFieldDefs[${index}]`));
  arrayOf(metadata.taskProjections, 'readModel.metadataCatalog.taskProjections').forEach((item, index) =>
    validateTaskProjection(item, `readModel.metadataCatalog.taskProjections[${index}]`));
  const byProject = objectOf(metadata.taskProjectionsByProject, 'readModel.metadataCatalog.taskProjectionsByProject');
  for (const [projectId, projections] of Object.entries(byProject)) {
    arrayOf(projections, `readModel.metadataCatalog.taskProjectionsByProject.${projectId}`).forEach((item, index) =>
      validateTaskProjection(item, `readModel.metadataCatalog.taskProjectionsByProject.${projectId}[${index}]`));
  }
  arrayOf(metadata.issues, 'readModel.metadataCatalog.issues').forEach((item, index) => validateMetadataIssue(item, `readModel.metadataCatalog.issues[${index}]`));
  const counts = objectOf(metadata.issueCounts, 'readModel.metadataCatalog.issueCounts');
  for (const code of METADATA_ISSUE_CODES) nonNegativeInteger(counts[code], `readModel.metadataCatalog.issueCounts.${code}`);
  if (Object.keys(counts).length !== METADATA_ISSUE_CODES.length) invalid('readModel.metadataCatalog.issueCounts bevat onbekende codes');
  const sourceData = objectOf(metadata.sourceData, 'readModel.metadataCatalog.sourceData');
  const sourceKeys = ['ACTVTYPE', 'ACTVCODE', 'TASKACTV', 'UDFTYPE', 'UDFVALUE', 'MEMOTYPE', 'TASKNOTE', 'TASKMEMO', 'TASK_NOTES', 'deferredUdfValues', 'unknownUdfTypes'] as const;
  exactKeys(sourceData, sourceKeys, 'readModel.metadataCatalog.sourceData');
  for (const key of sourceKeys) arrayOf(sourceData[key], `readModel.metadataCatalog.sourceData.${key}`).forEach((row, index) => validateSourceRow(row, `readModel.metadataCatalog.sourceData.${key}[${index}]`));

  const taskRows = objectOf(model.taskSourceRowsByProject, 'readModel.taskSourceRowsByProject');
  for (const [projectId, rows] of Object.entries(taskRows)) {
    arrayOf(rows, `readModel.taskSourceRowsByProject.${projectId}`).forEach((row, index) => validateSourceRow(row, `readModel.taskSourceRowsByProject.${projectId}[${index}]`));
  }
}

function validateArchiveMetadataRelations(
  diagnostics: XerArchiveDiagnosticsV1,
  readModel: XerArchiveReadModelV1,
): void {
  const sameValue = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
      return Array.isArray(left) && Array.isArray(right)
        && left.length === right.length
        && left.every((item, index) => sameValue(item, right[index]));
    }
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    const leftObject = left as Record<string, unknown>;
    const rightObject = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftObject).sort();
    const rightKeys = Object.keys(rightObject).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index]
        && sameValue(leftObject[key], rightObject[key]));
  };
  const sameIntegerSequence = (actual: readonly number[], expected: readonly number[], path: string) => {
    if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
      invalid(`${path} is geen volledige canonieke indexreeks`);
    }
  };

  // TASK is de gezaghebbende lokale identiteit voor alle latere projecties. Baselineprojecten
  // mogen hier bewust bestaan zonder documentview; een lege legacyselector blijft eveneens een
  // geldige, verliesvrije groep. Alleen aanwezige rijen moeten selectorvast, uniek en geordend zijn.
  const taskIdsByProject = new Map<string, Set<string>>();
  for (const [projectId, rows] of Object.entries(readModel.taskSourceRowsByProject)) {
    const taskIds = new Set<string>();
    let previousLine = -1;
    for (const [index, row] of rows.entries()) {
      const rowProjectId = row.cells.proj_id?.trim() ?? '';
      const taskId = row.cells.task_id?.trim() ?? '';
      if (rowProjectId !== projectId) invalid(`readModel.taskSourceRowsByProject.${projectId}[${index}] kruist de projectselector`);
      if (!taskId || taskIds.has(taskId)) invalid(`readModel.taskSourceRowsByProject.${projectId} bevat een lege of dubbele taakidentiteit`);
      if (row.line <= previousLine) invalid(`readModel.taskSourceRowsByProject.${projectId} staat niet in bronvolgorde`);
      taskIds.add(taskId);
      previousLine = row.line;
    }
    taskIdsByProject.set(projectId, taskIds);
  }

  // X8 bewaart één canonieke, op projectId+taskId gesorteerde lijst. De byProject-index is geen
  // tweede waarheid: hij moet die lijst volledig opdelen én elke projectie moet naar TASK wijzen.
  const expectedProjections = new Map<string, XerMetadataCatalog['taskProjections'] extends readonly (infer T)[] ? T[] : never>();
  const projectionIdentities = new Set<string>();
  let previousProjection: { projectId: string; taskId: string } | undefined;
  for (const projection of readModel.metadataCatalog.taskProjections) {
    const identity = `${projection.projectId}\u0000${projection.taskId}`;
    if (projectionIdentities.has(identity)) invalid(`readModel.metadataCatalog.taskProjections bevat dubbele identiteit ${projection.projectId}/${projection.taskId}`);
    const projectionTaskIds = taskIdsByProject.get(projection.projectId);
    if (projectionTaskIds && !projectionTaskIds.has(projection.taskId)) {
      invalid(`readModel.metadataCatalog.taskProjections wijst naar ontbrekende TASK-identiteit ${projection.projectId}/${projection.taskId}`);
    }
    projectionIdentities.add(identity);
    if (previousProjection && (previousProjection.projectId > projection.projectId
      || (previousProjection.projectId === projection.projectId && previousProjection.taskId > projection.taskId))) {
      invalid('readModel.metadataCatalog.taskProjections staat niet in canonieke project-/taakvolgorde');
    }
    previousProjection = projection;
    const group = expectedProjections.get(projection.projectId) ?? [];
    group.push(projection);
    expectedProjections.set(projection.projectId, group);
  }
  const actualProjectionKeys = Object.keys(readModel.metadataCatalog.taskProjectionsByProject);
  if (actualProjectionKeys.length !== expectedProjections.size
    || actualProjectionKeys.some(projectId => !expectedProjections.has(projectId))) {
    invalid('readModel.metadataCatalog.taskProjectionsByProject partitioneert de canonieke projecties niet volledig');
  }
  for (const [projectId, expected] of expectedProjections) {
    const actual = readModel.metadataCatalog.taskProjectionsByProject[projectId];
    if (!actual || actual.length !== expected.length
      || actual.some((projection, index) => projection.projectId !== projectId
        || !sameValue(projection, expected[index]))) {
      invalid(`readModel.metadataCatalog.taskProjectionsByProject.${projectId} is geen canonieke projectpartitie`);
    }
  }

  const sourceArchive = readModel.scheduleOptionsSourceArchive;
  const rowCount = sourceArchive.rows.length;
  const assertIndex = (index: number, path: string) => {
    if (index >= rowCount) invalid(`${path} wijst buiten de X5-filecache`);
  };
  const projectIndexes = new Map<string, number[]>();
  const scheduleIndexes = new Map<string, number[]>();
  const sourceIndexesByProject = new Map<string, number[]>();
  let scheduleTableStarted = false;
  let previousProjectLine = -1;
  let previousScheduleLine = -1;
  sourceArchive.rows.forEach((row, index) => {
    const projectId = row.cells.proj_id?.trim() ?? '';
    if (row.table === 'SCHEDOPTIONS') {
      scheduleTableStarted = true;
      if (row.line <= previousScheduleLine) invalid('readModel.scheduleOptionsSourceArchive.SCHEDOPTIONS staat niet in oorspronkelijke bronvolgorde');
      previousScheduleLine = row.line;
    } else {
      if (scheduleTableStarted) invalid('readModel.scheduleOptionsSourceArchive.rows doorbreekt PROJECT-voor-SCHEDOPTIONS-volgorde');
      if (row.line <= previousProjectLine) invalid('readModel.scheduleOptionsSourceArchive.PROJECT staat niet in oorspronkelijke bronvolgorde');
      previousProjectLine = row.line;
    }
    const target = row.table === 'PROJECT' ? projectIndexes : scheduleIndexes;
    const indexes = target.get(projectId) ?? [];
    indexes.push(index);
    target.set(projectId, indexes);
    const sourceIndexes = sourceIndexesByProject.get(projectId) ?? [];
    sourceIndexes.push(index);
    sourceIndexesByProject.set(projectId, sourceIndexes);
  });
  const expectedUnmatched = [...scheduleIndexes]
    .filter(([projectId]) => !projectIndexes.has(projectId))
    .flatMap(([, indexes]) => indexes);
  sameIntegerSequence(sourceArchive.unmatchedScheduleOptionsRowIndexes, expectedUnmatched,
    'readModel.scheduleOptionsSourceArchive.unmatchedScheduleOptionsRowIndexes');
  const expectedScheduleDiagnostics = [...scheduleIndexes]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([projectId, rowIndexes]) => ({
      code: 'XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID' as const,
      projectId,
      rowIndexes,
      lines: rowIndexes.map(index => sourceArchive.rows[index]!.line),
    }));
  if (!sameValue(sourceArchive.diagnostics, expectedScheduleDiagnostics)) {
    invalid('readModel.scheduleOptionsSourceArchive.diagnostics is geen canonieke duplicaatdiagnostiek');
  }
  if (!sameValue(diagnostics.file.scheduleOptions, sourceArchive.diagnostics)) {
    invalid('diagnostics.file.scheduleOptions wijkt af van de ene X5-filecache');
  }
  sourceArchive.diagnostics.forEach((diagnostic, diagnosticIndex) =>
    diagnostic.rowIndexes.forEach((index, position) => assertIndex(index,
      `readModel.scheduleOptionsSourceArchive.diagnostics[${diagnosticIndex}].rowIndexes[${position}]`)));

  const canonicalAssignmentRows = readModel.resourceCatalog.rows.assignments;
  let previousAssignmentLine = -1;
  for (const [index, row] of canonicalAssignmentRows.entries()) {
    if (row.line <= previousAssignmentLine) {
      invalid(`readModel.resourceCatalog.rows.assignments[${index}] staat niet in oorspronkelijke TASKRSRC-bronvolgorde`);
    }
    previousAssignmentLine = row.line;
  }
  const resourceSourceIds = new Set(readModel.resourceCatalog.rows.resources.map(source => source.sourceId));
  const roleSourceIds = new Set(readModel.resourceCatalog.rows.roles.map(source => source.sourceId));
  const expectedAssignmentSkip = (
    row: XerArchiveReadModelV1['resourceCatalog']['rows']['assignments'][number],
    projectId: string,
  ): XerAssignmentSkipExpectation => deriveXerAssignmentSkipExpectation(
    row.cells,
    resourceSourceIds,
    roleSourceIds,
    taskIdsByProject.get(projectId),
  );

  type ExternalLink = XerArchiveDocumentViewV1['externalLinks'][number];
  const linkKey = (link: ExternalLink): string => [
    link.id, link.predecessor.projectId, link.predecessor.taskId,
    link.successor.projectId, link.successor.taskId, link.type, link.lagMinutes,
  ].join('\u0000');
  const sourceLinks = new Map<string, ExternalLink>();
  const assertOpenEndpointTask = (
    endpointProjectId: string,
    endpointTaskId: string,
    path: string,
    endpointKind: 'lokaal' | 'extern',
  ): void => {
    if (!diagnostics.documentViews[endpointProjectId]) return;
    const endpointTaskIds = taskIdsByProject.get(endpointProjectId);
    // Een vroege schema-1-documentview kan de volledige TASK-groep missen. Alleen dat werkelijk
    // afwezige bronsignaal is legacy-onbeslisbaar; een aanwezige lege of gemuteerde groep is hard.
    if (!endpointTaskIds) return;
    if (!endpointTaskIds.has(endpointTaskId)) {
      invalid(`${path} wijst naar ontbrekend ${endpointKind} TASK-eindpunt ${endpointProjectId}/${endpointTaskId}`);
    }
  };
  for (const [projectId, view] of Object.entries(diagnostics.documentViews)) {
    // Vroege schema-1-containerfixtures konden al een documentview bewaren terwijl de later
    // toegevoegde TASK-bronindex voor dat project volledig ontbrak. Zo'n legacyview blijft
    // leesbaar; zodra de selector wél een canonieke TASK-groep heeft is de binding hard.
    if (!taskIdsByProject.has(projectId)) continue;
    for (const [index, relation] of view.externalRelations.entries()) {
      if (relation.localProjectId !== projectId) {
        invalid(`diagnostics.documentViews.${projectId}.externalRelations[${index}] kruist de projectselector`);
      }
      if (!taskIdsByProject.get(projectId)?.has(relation.localTaskId)) {
        invalid(`diagnostics.documentViews.${projectId}.externalRelations[${index}] wijst naar ontbrekend lokaal TASK-eindpunt`);
      }
      assertOpenEndpointTask(
        relation.externalProjectId,
        relation.externalTaskId,
        `diagnostics.documentViews.${projectId}.externalRelations[${index}]`,
        'extern',
      );
      const link: ExternalLink = relation.direction === 'predecessor' ? {
        id: relation.id,
        predecessor: { projectId: relation.externalProjectId, taskId: relation.externalTaskId },
        successor: { projectId: relation.localProjectId, taskId: relation.localTaskId },
        type: relation.type,
        lagMinutes: relation.lagMinutes,
      } : {
        id: relation.id,
        predecessor: { projectId: relation.localProjectId, taskId: relation.localTaskId },
        successor: { projectId: relation.externalProjectId, taskId: relation.externalTaskId },
        type: relation.type,
        lagMinutes: relation.lagMinutes,
      };
      const key = linkKey(link);
      const known = sourceLinks.get(key);
      if (known && !sameValue(known, link)) invalid(`diagnostics.documentViews.externalRelations bevat botsende bronrelatie ${relation.id}`);
      sourceLinks.set(key, link);
    }
  }

  const linksByKey = new Map<string, { link: ExternalLink; owners: Set<string> }>();
  for (const [projectId, view] of Object.entries(diagnostics.documentViews)) {
    view.scheduleOptions.sourceRowIndexes.forEach((index, position) => assertIndex(index,
      `diagnostics.documentViews.${projectId}.scheduleOptions.sourceRowIndexes[${position}]`));
    const expectedSourceIndexes = sourceIndexesByProject.get(projectId) ?? [];
    sameIntegerSequence(view.scheduleOptions.sourceRowIndexes, expectedSourceIndexes,
      `diagnostics.documentViews.${projectId}.scheduleOptions.sourceRowIndexes`);
    if (rowCount > 0 && (projectIndexes.get(projectId)?.length ?? 0) !== 1) {
      invalid(`diagnostics.documentViews.${projectId} heeft niet exact één PROJECT-bronrij`);
    }
    const projectScheduleIndexes = scheduleIndexes.get(projectId) ?? [];
    const expectedSource = projectScheduleIndexes.length === 1 ? 'schedoptions' : 'xer-defaults';
    if (view.scheduleOptions.source !== expectedSource) {
      invalid(`diagnostics.documentViews.${projectId}.scheduleOptions.source past niet bij de X5-bronrijen`);
    }
    const expectedDiagnostics = sourceArchive.diagnostics.filter(item => item.projectId === projectId);
    if (!sameValue(view.scheduleOptions.diagnostics, expectedDiagnostics)) {
      invalid(`diagnostics.documentViews.${projectId}.scheduleOptions.diagnostics kruist de projectselector`);
    }

    const expectedAssignmentRows = canonicalAssignmentRows.filter(row =>
      (row.cells.proj_id?.trim() ?? '') === projectId);
    const assignments = view.resources?.assignments ?? [];
    if (assignments.length !== expectedAssignmentRows.length) {
      invalid(`diagnostics.documentViews.${projectId}.resources.assignments is geen volledige projectpartitie`);
    }
    const assignmentIds = new Set<string>();
    assignments.forEach((assignment, index) => {
      const rawProjectId = assignment.rawRow.cells.proj_id?.trim() ?? '';
      if (assignment.projectSourceId !== projectId || rawProjectId !== projectId) {
        invalid(`diagnostics.documentViews.${projectId}.resources.assignments[${index}] kruist de projectselector`);
      }
      if (assignmentIds.has(assignment.sourceId)) {
        invalid(`diagnostics.documentViews.${projectId}.resources.assignments bevat dubbele identiteit ${assignment.sourceId}`);
      }
      assignmentIds.add(assignment.sourceId);
      if (!sameValue(assignment.rawRow, expectedAssignmentRows[index])) {
        invalid(`diagnostics.documentViews.${projectId}.resources.assignments[${index}] staat niet in canonieke bronvolgorde`);
      }
      const rawRow = expectedAssignmentRows[index]!;
      const sourceId = xerAssignmentSourceId(rawRow.cells, rawRow.line);
      const taskSourceId = rawRow.cells.task_id?.trim() ?? '';
      const resourceSourceId = rawRow.cells.rsrc_id?.trim() || undefined;
      const roleSourceId = rawRow.cells.role_id?.trim() || undefined;
      const entityKind = resourceSourceId ? 'RESOURCE' : 'ROLE';
      const entitySourceId = resourceSourceId ?? roleSourceId ?? '';
      const entityInternalId = `${entityKind === 'RESOURCE' ? 'xer-resource' : 'xer-role'}:${entitySourceId}`;
      if (assignment.sourceId !== sourceId
        || assignment.internalId !== `xer-assignment:${sourceId}`
        || assignment.line !== rawRow.line
        || assignment.taskSourceId !== taskSourceId
        || assignment.entity.kind !== entityKind
        || assignment.entity.sourceId !== entitySourceId
        || assignment.entity.internalId !== entityInternalId) {
        invalid(`diagnostics.documentViews.${projectId}.resources.assignments[${index}] wijkt af van de canonieke TASKRSRC-identiteit`);
      }
      for (const [field, rawField] of [
        ['curveSourceId', 'curv_id'], ['rateType', 'rate_type'],
        ['costSourceType', 'cost_per_qty_source_type'], ['rawResourceType', 'rsrc_type'],
      ] as const) {
        const expected = rawRow.cells[rawField]?.trim() || undefined;
        if (assignment[field] !== expected) {
          invalid(`diagnostics.documentViews.${projectId}.resources.assignments[${index}].${field} wijkt af van TASKRSRC.${rawField}`);
        }
      }
    });
    const skipCodes = new Set<XerAssignmentSkipReason>([
      'XER_ASSIGNMENT_RESOURCE_MISSING',
      'XER_ASSIGNMENT_ROLE_MISSING',
      'XER_ASSIGNMENT_TASK_MISSING',
    ]);
    const actualSkipIssues = (view.resources?.issues ?? []).filter(
      (issue): issue is XerResourceIssue & { code: XerAssignmentSkipReason } =>
        skipCodes.has(issue.code as XerAssignmentSkipReason),
    );
    const expectedByIdentity = new Map<string, XerAssignmentSkipExpectation>();
    for (const row of expectedAssignmentRows) {
      const sourceId = xerAssignmentSourceId(row.cells, row.line);
      expectedByIdentity.set(`${sourceId}\u0000${row.line}`, expectedAssignmentSkip(row, projectId));
    }
    const seenSkipIssueIdentities = new Set<string>();
    for (const issue of actualSkipIssues) {
      const identity = `${issue.sourceId}\u0000${issue.line}`;
      const expected = expectedByIdentity.get(identity);
      const exactEnvelope = issue.table === 'TASKRSRC' && issue.fallback === 'SKIPPED';
      const exactCode = issue.code === expected;
      const optionalLegacyTaskIssue = expected === 'LEGACY_TASK_UNKNOWN'
        && issue.code === 'XER_ASSIGNMENT_TASK_MISSING';
      if (!exactEnvelope || (!exactCode && !optionalLegacyTaskIssue)
        || seenSkipIssueIdentities.has(identity)) {
        invalid(`diagnostics.documentViews.${projectId}.resources.issues is geen exacte TASKRSRC-skipdiagnostiek`);
      }
      seenSkipIssueIdentities.add(identity);
    }
    for (const [identity, expected] of expectedByIdentity) {
      if (expected && expected !== 'LEGACY_TASK_UNKNOWN' && !seenSkipIssueIdentities.has(identity)) {
        invalid(`diagnostics.documentViews.${projectId}.resources.issues is geen exacte TASKRSRC-skipdiagnostiek`);
      }
    }

    const linkKeys = new Set<string>();
    for (const [index, link] of view.externalLinks.entries()) {
      const key = linkKey(link);
      if (linkKeys.has(key)) invalid(`diagnostics.documentViews.${projectId}.externalLinks bevat dubbele relatie ${link.id}`);
      linkKeys.add(key);
      if (link.predecessor.projectId !== projectId && link.successor.projectId !== projectId) {
        invalid(`diagnostics.documentViews.${projectId}.externalLinks[${index}] heeft geen lokaal eindpunt`);
      }
      assertOpenEndpointTask(
        link.predecessor.projectId,
        link.predecessor.taskId,
        `diagnostics.documentViews.${projectId}.externalLinks[${index}].predecessor`,
        link.predecessor.projectId === projectId ? 'lokaal' : 'extern',
      );
      assertOpenEndpointTask(
        link.successor.projectId,
        link.successor.taskId,
        `diagnostics.documentViews.${projectId}.externalLinks[${index}].successor`,
        link.successor.projectId === projectId ? 'lokaal' : 'extern',
      );
      if (taskIdsByProject.has(projectId) && !sourceLinks.has(key)) {
        invalid(`diagnostics.documentViews.${projectId}.externalLinks[${index}] is niet afgeleid uit een bewaarde TASKPRED-bronrelatie`);
      }
      const known = linksByKey.get(key);
      if (known && !sameValue(known.link, link)) invalid(`diagnostics.documentViews.externalLinks bevat botsende relatie ${link.id}`);
      if (known) known.owners.add(projectId);
      else linksByKey.set(key, { link, owners: new Set([projectId]) });
    }
  }
  for (const [key, { link, owners }] of linksByKey) {
    for (const endpoint of [link.predecessor.projectId, link.successor.projectId]) {
      if (diagnostics.documentViews[endpoint] && !owners.has(endpoint)) {
        invalid(`diagnostics.documentViews.externalLinks.${link.id} ontbreekt in endpointproject ${endpoint}`);
      }
    }
    const hasCanonicalOwner = [...owners].some(projectId => taskIdsByProject.has(projectId));
    if (hasCanonicalOwner && !sourceLinks.has(key)) {
      invalid(`diagnostics.documentViews.externalLinks.${link.id} mist zijn TASKPRED-bronrelatie`);
    }
  }
  for (const [key, link] of sourceLinks) {
    const predecessorIsOpen = diagnostics.documentViews[link.predecessor.projectId]
      && taskIdsByProject.get(link.predecessor.projectId)?.has(link.predecessor.taskId);
    const successorIsOpen = diagnostics.documentViews[link.successor.projectId]
      && taskIdsByProject.get(link.successor.projectId)?.has(link.successor.taskId);
    if (!predecessorIsOpen || !successorIsOpen) continue;
    const derived = linksByKey.get(key);
    if (!derived) invalid(`diagnostics.documentViews.externalLinks mist afleiding voor bronrelatie ${link.id}`);
    for (const endpoint of [link.predecessor.projectId, link.successor.projectId]) {
      if (!derived.owners.has(endpoint)) {
        invalid(`diagnostics.documentViews.externalLinks.${link.id} ontbreekt in bronendpoint ${endpoint}`);
      }
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
