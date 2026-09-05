// X9 — onafhankelijke contractcheck voor het canonieke, byte-exacte XER-bronarchief.
//
// Deze test gebruikt doelbewust ruwe bytes (geen XER-reader), zodat de productmapper niet zijn
// eigen orakel kan leveren. De module bestond bij de eerste rode run nog niet.
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveDocumentView,
  createEmptyXerArchiveReadModel,
  createXerSourceArchive,
  decodeXerSourceArchive,
  detectXerSourcePresentation,
  sha256Hex,
  withXerArchiveDocumentView,
} from '@/services/xerSourceArchive';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
const equal = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
};
const truthy = (label: string, condition: boolean) => {
  checks++;
  if (!condition) failures.push(`${label}: verwacht waar, kreeg onwaar`);
};

const encoder = new TextEncoder();
const raw = new Uint8Array([
  0xef, 0xbb, 0xbf,
  ...encoder.encode('%T\tPROJECT\r\n%F\tproj_id\tproj_short_name\r\n%R\tP-1\tOlé\r\n%T\tUNKNOWN\r\n%F\ta\r\n%R\t¤\r\n%E\r\n'),
]);
const documentView = createEmptyXerArchiveDocumentView('P-1');
documentView.tableReport.encoding = 'windows-1252';
documentView.tableReport.issues.push({ code: 'XER_ROW_FIELD_COUNT_MISMATCH', line: 4, expected: 2, actual: 1 });
documentView.tableReport.unknownTables.push({ name: 'UNKNOWN', rows: 1 });
documentView.calendarIssues.push({ code: 'XER_CALENDAR_RECOVERED', calendarId: 'C', line: 5, reason: 'fixture', resolution: 'RECOVERED' });
documentView.enumFallbacks.push({ family: 'durationType', token: 'ST_TotalFloat', fallback: 'DT_FixedDUR2', table: 'TASK', field: 'duration_type', line: 4 });
const diagnostics = {
  ...createEmptyXerArchiveDiagnostics(),
  file: {
    ...createEmptyXerArchiveDiagnostics().file,
    tableReport: documentView.tableReport,
  },
  documentViews: { 'P-1': documentView },
};
const expectedDiagnostics = structuredClone(diagnostics);

const archive = createXerSourceArchive(raw, {
  schemaVersion: 1,
  format: 'primavera-p6-xer',
  encoding: 'windows-1252',
  bom: 'utf-8',
  newline: 'crlf',
  diagnostics,
  readModel: createEmptyXerArchiveReadModel(),
});

equal('1 chunkgrootte is bindend', XER_SOURCE_ARCHIVE_CHUNK_BYTES, 196608);
equal('2 bytes komen byte-identiek terug', [...decodeXerSourceArchive(archive)], [...raw]);
equal('3 lengte komt uit de oorspronkelijke bytes', archive.byteLength, raw.byteLength);
equal('4 schema en bronvorm blijven expliciet', [archive.schemaVersion, archive.format, archive.encoding, archive.bom, archive.newline], [1, 'primavera-p6-xer', 'windows-1252', 'utf-8', 'crlf']);
equal('5 onbekende tabeldiagnostic blijft getypeerd', archive.diagnostics, diagnostics);
truthy('6 archive en alle diagnostische containers zijn diep immutable',
  Object.isFrozen(archive) && Object.isFrozen(archive.byteChunks) && Object.isFrozen(archive.diagnostics)
  && Object.isFrozen(archive.diagnostics.file)
  && Object.isFrozen(archive.diagnostics.file.tableReport)
  && Object.isFrozen(archive.diagnostics.file.tableReport.issues)
  && Object.isFrozen(archive.diagnostics.file.tableReport.unknownTables)
  && Object.isFrozen(archive.diagnostics.documentViews['P-1'])
  && Object.isFrozen(archive.diagnostics.documentViews['P-1']!.calendarIssues)
  && Object.isFrozen(archive.diagnostics.documentViews['P-1']!.enumFallbacks));
truthy('7 diagnostics zijn geen mutable invoeralias', archive.diagnostics !== diagnostics);
let callerCanMutateDiagnostics = true;
try {
  diagnostics.file.tableReport.issues.push({ code: 'XER_UNKNOWN_RECORD', line: 99 });
  diagnostics.documentViews['P-1']!.calendarIssues.push({ code: 'LATE_MUTATION', calendarId: 'C', line: 99, reason: 'late', resolution: 'REJECTED' });
} catch { callerCanMutateDiagnostics = false; }
truthy('8 aanroeper behoudt zijn eigen mutable diagnostics-object', callerCanMutateDiagnostics);
equal('9 latere invoermutatie raakt het archive niet', archive.diagnostics, expectedDiagnostics);
truthy('10 SHA-256 is lowercase hex over bytes', /^[0-9a-f]{64}$/.test(archive.sha256));
equal('10a SHA-256 volgt het onafhankelijke bekende testvector-orakel',
  sha256Hex(encoder.encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
const large = new Uint8Array(XER_SOURCE_ARCHIVE_CHUNK_BYTES * 4 + 31);
large.fill(0xa5);
const largeArchive = createXerSourceArchive(large, {
  schemaVersion: 1, format: 'primavera-p6-xer', encoding: 'windows-1252', bom: 'none', newline: 'lf',
  diagnostics: createEmptyXerArchiveDiagnostics(), readModel: createEmptyXerArchiveReadModel(),
});
equal('11 groot archief kent geen beleidsmatige bestandsgroottegrens', [...decodeXerSourceArchive(largeArchive)], [...large]);

const blankLegacyFieldReadModel = {
  ...createEmptyXerArchiveReadModel(),
  taskSourceRowsByProject: {
    '': [{ line: 6, cells: { '': 'exact bewaarde celtekst', task_id: 'T-1' } }],
  },
};
let blankLegacyFieldArchive: ReturnType<typeof createXerSourceArchive> | undefined;
try {
  blankLegacyFieldArchive = createXerSourceArchive(raw, {
    schemaVersion: 1,
    format: 'primavera-p6-xer',
    encoding: 'windows-1252',
    bom: 'utf-8',
    newline: 'crlf',
    diagnostics: createEmptyXerArchiveDiagnostics(),
    readModel: blankLegacyFieldReadModel,
  });
} catch {
  // De assertion hieronder rapporteert de compatibiliteitsregressie als gewone RED-check.
}
equal('12 lege legacy veldnaam en oorspronkelijke celtekst blijven in het bronreadmodel behouden',
  blankLegacyFieldArchive?.readModel.taskSourceRowsByProject['']?.[0]?.cells[''],
  'exact bewaarde celtekst');

const utf16 = (value: string, endian: 'le' | 'be') => {
  const result = new Uint8Array(2 + value.length * 2);
  result.set(endian === 'le' ? [0xff, 0xfe] : [0xfe, 0xff]);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    result[2 + index * 2 + (endian === 'le' ? 0 : 1)] = code & 0xff;
    result[2 + index * 2 + (endian === 'le' ? 1 : 0)] = code >>> 8;
  }
  return result;
};
const utf16LePresentation = detectXerSourcePresentation(utf16('ERMHDR\r\n%T\tTASK\r\n%E\r\n', 'le'));
equal('13 UTF-16LE-BOM wordt vóór newlineclassificatie gedecodeerd',
  [utf16LePresentation.encoding, utf16LePresentation.bom, utf16LePresentation.newline],
  ['utf-16le', 'utf-16le', 'crlf']);
const utf16BePresentation = detectXerSourcePresentation(utf16('ERMHDR\n%T\tTASK\n%E\n', 'be'));
equal('14 UTF-16BE-BOM wordt vóór newlineclassificatie gedecodeerd',
  [utf16BePresentation.encoding, utf16BePresentation.bom, utf16BePresentation.newline],
  ['utf-16be', 'utf-16be', 'lf']);

const unattachedArchive = createXerSourceArchive(new Uint8Array([1, 2, 3]), {
  encoding: 'windows-1252', bom: 'none', newline: 'none',
  diagnostics: createEmptyXerArchiveDiagnostics(), readModel: createEmptyXerArchiveReadModel(),
});
const callerView = createEmptyXerArchiveDocumentView('CALLER');
const callerAssignments: never[] = [];
const callerIssues: never[] = [];
const callerMetadata = {
  ...callerView,
  scheduleOptions: {
    ...callerView.scheduleOptions,
    sourceArchive: createEmptyXerArchiveReadModel().scheduleOptionsSourceArchive,
    sourceRows: [],
  },
  resources: {
    catalog: createEmptyXerArchiveReadModel().resourceCatalog,
    assignments: callerAssignments,
    issues: callerIssues,
  },
};
const attachedArchive = withXerArchiveDocumentView(unattachedArchive, callerMetadata);
let callerArraysRemainMutable = true;
try {
  callerAssignments.push({ marker: 'late assignment' } as never);
  callerIssues.push({ marker: 'late issue' } as never);
} catch {
  callerArraysRemainMutable = false;
}
truthy('15 missing-view-pad bevriest geen caller-owned assignment- of issuearray',
  callerArraysRemainMutable
  && !Object.isFrozen(callerAssignments)
  && !Object.isFrozen(callerIssues));
equal('16 latere caller-mutatie werkt niet als alias door in de immutable documentview',
  [
    attachedArchive.diagnostics.documentViews.CALLER?.resources?.assignments.length,
    attachedArchive.diagnostics.documentViews.CALLER?.resources?.issues.length,
  ],
  [0, 0]);

if (failures.length === 0) {
  console.log(`OK  xer-source-archive: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-source-archive: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
