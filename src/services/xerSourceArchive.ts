/**
 * De onveranderde brontekst van een geïmporteerd XER-bestand. Dit is bewust
 * een algemene service: de IFC-laag moet het archief kunnen verwerken zonder
 * de lazy XER-parserchunk te laden.
 */

import type {
  XerImportMetadata,
  XerImportReport,
  XerTableReportMetadata,
} from './importTypes';
import type { XerMetadataCatalog } from './xer/xerMetadataTypes';
import type { XerResourceCatalog } from './xer/xerResources';
import type { XerResourceIssue, XerTaskResourceSource } from './xer/xerResourceTypes';

export const XER_SOURCE_ARCHIVE_SCHEMA_VERSION = 1;
export const XER_SOURCE_ARCHIVE_CHUNK_BYTES = 196_608;

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
  readonly resourceCatalog: XerResourceCatalog;
  readonly metadataCatalog: XerMetadataCatalog;
  /** TASK-cellen blijven met lege/letterlijke tokens beschikbaar nadat de semantische taak is genormaliseerd. */
  readonly taskSourceRowsByProject: Readonly<Record<string, readonly XerArchiveSourceRowV1[]>>;
}

export type XerArchiveDocumentViewV1 = Omit<XerImportMetadata, 'resources' | 'metadata'> & {
  sourceProjectId: string;
  resources?: {
    assignments: XerTaskResourceSource[];
    issues: XerResourceIssue[];
  };
};

export interface XerArchiveDiagnosticsV1 {
  readonly schemaVersion: 1;
  readonly file: {
    readonly tableReport: XerTableReportMetadata;
    readonly scheduleOptions: readonly unknown[];
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
      sourceArchive: { rows: [], unmatchedScheduleOptionsRowIndexes: [], diagnostics: [] },
      sourceRowIndexes: [], sourceRows: [],
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
  validateXerArchiveDiagnosticsV1(payload.diagnostics);
  validateXerArchiveReadModelV1(payload.readModel);
  return payload as unknown as XerArchiveMetadataPayloadV1;
}

export function archiveDocumentView(source: XerImportMetadata): XerArchiveDocumentViewV1 {
  const { resources, metadata: _metadata, ...documentFields } = source;
  if (!source.sourceProjectId) invalid('documentview mist sourceProjectId');
  return {
    ...structuredClone(documentFields),
    sourceProjectId: source.sourceProjectId,
    // Deze projectprojectie is zelf het te bewaren X6-bronbewijs. Het archive neemt ownership en
    // bevriest de grafiek; een tweede structuredClone zou bij grote TASKRSRC-sets tientallen MiB
    // identieke persistente data naast dezelfde documentview leggen.
    ...(resources ? { resources: { assignments: resources.assignments, issues: resources.issues } } : {}),
  };
}

export function withXerArchiveDocumentView(
  archive: XerSourceArchive, source: XerImportMetadata,
): XerSourceArchive {
  const view = archiveDocumentView(source);
  if (archive.diagnostics.documentViews[view.sourceProjectId]) return archive;
  const diagnostics: XerArchiveDiagnosticsV1 = {
    ...structuredClone(archive.diagnostics),
    documentViews: {
      ...structuredClone(archive.diagnostics.documentViews),
      [view.sourceProjectId]: view,
    },
  };
  validateXerArchiveDiagnosticsV1(diagnostics);
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

function validateScheduleOptions(value: unknown, path: string): void {
  const options = objectOf(value, path);
  exactKeys(options, ['source', 'retainedSource', 'fallbacks', 'diagnostics', 'sourceArchive', 'sourceRowIndexes', 'sourceRows'], path);
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
  const archive = objectOf(options.sourceArchive, `${path}.sourceArchive`);
  exactKeys(archive, ['rows', 'unmatchedScheduleOptionsRowIndexes', 'diagnostics'], `${path}.sourceArchive`);
  arrayOf(archive.rows, `${path}.sourceArchive.rows`).forEach((row, index) => {
    const item = objectOf(row, `${path}.sourceArchive.rows[${index}]`);
    exactKeys(item, ['table', 'line', 'cells'], `${path}.sourceArchive.rows[${index}]`);
    oneOf(item.table, ['PROJECT', 'SCHEDOPTIONS'], `${path}.sourceArchive.rows[${index}].table`);
    validateSourceRow({ line: item.line, cells: item.cells }, `${path}.sourceArchive.rows[${index}]`);
  });
  for (const arrayPath of ['diagnostics', 'sourceRowIndexes'] as const) {
    arrayOf(arrayPath === 'diagnostics' ? options.diagnostics : options.sourceRowIndexes, `${path}.${arrayPath}`)
      .forEach((item, index) => arrayPath === 'diagnostics'
        ? jsonValue(item, `${path}.${arrayPath}[${index}]`)
        : nonNegativeInteger(item, `${path}.${arrayPath}[${index}]`));
  }
  arrayOf(archive.unmatchedScheduleOptionsRowIndexes, `${path}.sourceArchive.unmatchedScheduleOptionsRowIndexes`)
    .forEach((item, index) => nonNegativeInteger(item, `${path}.sourceArchive.unmatchedScheduleOptionsRowIndexes[${index}]`));
  arrayOf(archive.diagnostics, `${path}.sourceArchive.diagnostics`).forEach((item, index) => jsonValue(item, `${path}.sourceArchive.diagnostics[${index}]`));
  arrayOf(options.sourceRows, `${path}.sourceRows`).forEach((row, index) => {
    const item = objectOf(row, `${path}.sourceRows[${index}]`);
    exactKeys(item, ['table', 'line', 'cells'], `${path}.sourceRows[${index}]`);
    oneOf(item.table, ['PROJECT', 'SCHEDOPTIONS'], `${path}.sourceRows[${index}].table`);
    validateSourceRow({ line: item.line, cells: item.cells }, `${path}.sourceRows[${index}]`);
  });
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
  validateScheduleOptions(view.scheduleOptions, `${path}.scheduleOptions`);
  for (const key of ['externalRelations', 'externalLinks'] as const) {
    arrayOf(view[key], `${path}.${key}`).forEach((item, index) => jsonValue(item, `${path}.${key}[${index}]`));
  }
  validateImportReport(view.report, `${path}.report`);
  if (view.resources !== undefined) {
    const resources = objectOf(view.resources, `${path}.resources`);
    exactKeys(resources, ['assignments', 'issues'], `${path}.resources`);
    arrayOf(resources.assignments, `${path}.resources.assignments`).forEach((item, index) => jsonValue(item, `${path}.resources.assignments[${index}]`));
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
  arrayOf(file.scheduleOptions, 'diagnostics.file.scheduleOptions').forEach((item, index) => jsonValue(item, `diagnostics.file.scheduleOptions[${index}]`));
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

export function validateXerArchiveReadModelV1(value: unknown): asserts value is XerArchiveReadModelV1 {
  const model = objectOf(value, 'readModel');
  exactKeys(model, ['schemaVersion', 'numberFormat', 'resourceCatalog', 'metadataCatalog', 'taskSourceRowsByProject'], 'readModel');
  if (model.schemaVersion !== 1) invalid('readModel.schemaVersion is onbekend');
  const numberFormat = objectOf(model.numberFormat, 'readModel.numberFormat');
  exactKeys(numberFormat, ['decimal', 'group', 'source', 'currencyCode'], 'readModel.numberFormat');
  const decimal = oneOf(numberFormat.decimal, ['.', ','], 'readModel.numberFormat.decimal');
  const group = numberFormat.group === null ? null : oneOf(numberFormat.group, ['.', ','], 'readModel.numberFormat.group');
  if (group === decimal) invalid('readModel.numberFormat.group is gelijk aan decimal');
  oneOf(numberFormat.source, ['currtype', 'default'], 'readModel.numberFormat.source');
  stringOf(numberFormat.currencyCode, 'readModel.numberFormat.currencyCode');

  const resources = objectOf(model.resourceCatalog, 'readModel.resourceCatalog');
  exactKeys(resources, ['resources', 'identities', 'rows', 'issues'], 'readModel.resourceCatalog');
  for (const key of ['resources', 'identities'] as const) arrayOf(resources[key], `readModel.resourceCatalog.${key}`).forEach((item, index) => jsonValue(item, `readModel.resourceCatalog.${key}[${index}]`));
  const resourceRows = objectOf(resources.rows, 'readModel.resourceCatalog.rows');
  exactKeys(resourceRows, ['resources', 'roles', 'rates', 'curves', 'assignments'], 'readModel.resourceCatalog.rows');
  for (const key of ['resources', 'roles', 'rates', 'curves'] as const) {
    arrayOf(resourceRows[key], `readModel.resourceCatalog.rows.${key}`).forEach((item, index) => jsonValue(item, `readModel.resourceCatalog.rows.${key}[${index}]`));
  }
  arrayOf(resourceRows.assignments, 'readModel.resourceCatalog.rows.assignments').forEach((row, index) => validateSourceRow(row, `readModel.resourceCatalog.rows.assignments[${index}]`));
  arrayOf(resources.issues, 'readModel.resourceCatalog.issues').forEach((item, index) => validateResourceIssue(item, `readModel.resourceCatalog.issues[${index}]`));

  const metadata = objectOf(model.metadataCatalog, 'readModel.metadataCatalog');
  exactKeys(metadata, ['activityCodeTypes', 'customFieldDefs', 'taskProjections', 'taskProjectionsByProject', 'issues', 'issueCounts', 'sourceData'], 'readModel.metadataCatalog');
  for (const key of ['activityCodeTypes', 'customFieldDefs', 'taskProjections'] as const) arrayOf(metadata[key], `readModel.metadataCatalog.${key}`).forEach((item, index) => jsonValue(item, `readModel.metadataCatalog.${key}[${index}]`));
  const byProject = objectOf(metadata.taskProjectionsByProject, 'readModel.metadataCatalog.taskProjectionsByProject');
  for (const [projectId, projections] of Object.entries(byProject)) {
    if (!projectId) invalid('readModel.metadataCatalog.taskProjectionsByProject bevat lege selector');
    arrayOf(projections, `readModel.metadataCatalog.taskProjectionsByProject.${projectId}`).forEach((item, index) => jsonValue(item, `readModel.metadataCatalog.taskProjectionsByProject.${projectId}[${index}]`));
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
    if (!projectId) invalid('readModel.taskSourceRowsByProject bevat lege selector');
    arrayOf(rows, `readModel.taskSourceRowsByProject.${projectId}`).forEach((row, index) => validateSourceRow(row, `readModel.taskSourceRowsByProject.${projectId}[${index}]`));
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
