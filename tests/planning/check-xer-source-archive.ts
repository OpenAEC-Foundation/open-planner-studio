// X9 — onafhankelijke contractcheck voor het canonieke, byte-exacte XER-bronarchief.
//
// Deze test gebruikt doelbewust ruwe bytes (geen XER-reader), zodat de productmapper niet zijn
// eigen orakel kan leveren. De module bestond bij de eerste rode run nog niet.
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
  createXerSourceArchive,
  decodeXerSourceArchive,
  sha256Hex,
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
const diagnostics = {
  tableReport: { encoding: 'windows-1252' as const, endMarkerSeen: true, issues: [{ code: 'XER_ROW_FIELD_COUNT_MISMATCH' }], unknownTables: [{ name: 'UNKNOWN', rows: 1 }] },
  calendarIssues: [{ code: 'XER_CALENDAR_RECOVERED' }], enumFallbacks: [{ token: 'ST_TotalFloat' }],
};

const archive = createXerSourceArchive(raw, {
  schemaVersion: 1,
  format: 'primavera-p6-xer',
  encoding: 'windows-1252',
  bom: 'utf-8',
  newline: 'crlf',
  diagnostics,
});

equal('1 chunkgrootte is bindend', XER_SOURCE_ARCHIVE_CHUNK_BYTES, 196608);
equal('2 bytes komen byte-identiek terug', [...decodeXerSourceArchive(archive)], [...raw]);
equal('3 lengte komt uit de oorspronkelijke bytes', archive.byteLength, raw.byteLength);
equal('4 schema en bronvorm blijven expliciet', [archive.schemaVersion, archive.format, archive.encoding, archive.bom, archive.newline], [1, 'primavera-p6-xer', 'windows-1252', 'utf-8', 'crlf']);
equal('5 onbekende tabeldiagnostic blijft getypeerd', archive.diagnostics, diagnostics);
truthy('6 archive en alle diagnostische containers zijn diep immutable',
  Object.isFrozen(archive) && Object.isFrozen(archive.byteChunks) && Object.isFrozen(archive.diagnostics)
  && Object.isFrozen(archive.diagnostics.tableReport as object)
  && Object.isFrozen((archive.diagnostics.tableReport as { issues: unknown[] }).issues)
  && Object.isFrozen((archive.diagnostics.tableReport as { unknownTables: unknown[] }).unknownTables)
  && Object.isFrozen(archive.diagnostics.calendarIssues as object)
  && Object.isFrozen(archive.diagnostics.enumFallbacks as object));
truthy('7 diagnostics zijn geen mutable invoeralias', archive.diagnostics !== diagnostics);
let callerCanMutateDiagnostics = true;
try {
  diagnostics.tableReport.issues.push({ code: 'LATE_MUTATION' });
  diagnostics.calendarIssues.push({ code: 'LATE_MUTATION' });
} catch { callerCanMutateDiagnostics = false; }
truthy('8 aanroeper behoudt zijn eigen mutable diagnostics-object', callerCanMutateDiagnostics);
equal('9 latere invoermutatie raakt het archive niet', archive.diagnostics, {
  tableReport: { encoding: 'windows-1252', endMarkerSeen: true, issues: [{ code: 'XER_ROW_FIELD_COUNT_MISMATCH' }], unknownTables: [{ name: 'UNKNOWN', rows: 1 }] },
  calendarIssues: [{ code: 'XER_CALENDAR_RECOVERED' }], enumFallbacks: [{ token: 'ST_TotalFloat' }],
});
truthy('10 SHA-256 is lowercase hex over bytes', /^[0-9a-f]{64}$/.test(archive.sha256));
equal('10a SHA-256 volgt het onafhankelijke bekende testvector-orakel',
  sha256Hex(encoder.encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
const large = new Uint8Array(XER_SOURCE_ARCHIVE_CHUNK_BYTES * 4 + 31);
large.fill(0xa5);
const largeArchive = createXerSourceArchive(large, {
  schemaVersion: 1, format: 'primavera-p6-xer', encoding: 'windows-1252', bom: 'none', newline: 'lf', diagnostics: {},
});
equal('11 groot archief kent geen beleidsmatige bestandsgroottegrens', [...decodeXerSourceArchive(largeArchive)], [...large]);

if (failures.length === 0) {
  console.log(`OK  xer-source-archive: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-source-archive: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
