// X9 — IFC-container voor het zelfstandige XER-bronarchief. Geen reader-mock: echte STEP-tekst
// gaat door writeIFC én readIFC.
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultProject } from '@/state/defaults';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import {
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveReadModel,
  createXerSourceArchive,
  decodeXerSourceArchive,
  sha256Hex,
} from '@/services/xerSourceArchive';

declare const process: { exit(code: number): never };
const failures: string[] = [];
const expect = (label: string, condition: boolean) => { if (!condition) failures.push(label); };

const bytes = new Uint8Array(196_608 + 5);
for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
const archive = createXerSourceArchive(bytes, {
  encoding: 'windows-1252', bom: 'utf-8', newline: 'crlf',
  diagnostics: createEmptyXerArchiveDiagnostics(), readModel: createEmptyXerArchiveReadModel(),
});
const project = createDefaultProject();
project.id = 'OPS-XER-PROJECT'; project.name = 'XER archief';
const calendar = createDefaultCalendar(); project.calendarId = calendar.id;
const ifc = writeIFC({ project, calendar, tasks: [], sequences: [], resources: [], assignments: [], xerSourceArchive: archive, xer: {
  sourceProjectId: 'P6-ARCHIVE', defaultCurrencyCode: '', tableReport: { encoding: 'windows-1252', endMarkerSeen: true, issues: [], unknownTables: [] },
  calendarIssues: [], enumFallbacks: [], scheduleOptions: { source: 'xer-defaults', retainedSource: {}, fallbacks: [], diagnostics: [], sourceArchive: { rows: [], unmatchedScheduleOptionsRowIndexes: [], diagnostics: [] }, sourceRowIndexes: [], sourceRows: [] },
  externalRelations: [{ id: 'EXT-1', localProjectId: 'P6-ARCHIVE', localTaskId: 'A', externalProjectId: 'B', externalTaskId: 'B', direction: 'predecessor', type: 'FS', lagMinutes: 15 }],
  externalLinks: [{ id: 'LINK-1', predecessor: { projectId: 'B', taskId: 'B' }, successor: { projectId: 'P6-ARCHIVE', taskId: 'A' }, type: 'FS', lagMinutes: 15 }],
  report: { projectsSeen: 2, documentsOpened: 1, emptyProjectsSkipped: 1, baselineProjectsExcluded: 0, baselinesMaterialized: 0, danglingBaselineReferences: 0, externalLinksPreserved: 1, baselineExclusionReverted: false, baselineFallbackReasons: [] },
  resources: { catalog: {} as never, assignments: [], issues: [{ code: 'XER_RESOURCE_TYPE_FALLBACK', table: 'RSRC', line: 1, sourceId: 'R', fallback: 'LABOR' }] },
} });

expect('1 schrijft precies één manifestcontainer', (ifc.match(/OPS_XerSourceArchive/g) ?? []).length === 1);
expect('2 schrijft selector met P6-project', ifc.includes('OPS_XerDocument') && ifc.includes('P6-ARCHIVE'));
expect('3 volle chunk heeft 196608 bytes', archive.byteChunks.length === 2);
const read = readIFC(ifc);
expect('4 archive wordt uit IFC herlezen', read.xerSourceArchive !== undefined);
if (read.xerSourceArchive) {
  expect('5 bytes zijn exact gelijk', sha256Hex(decodeXerSourceArchive(read.xerSourceArchive)) === sha256Hex(bytes));
  expect('6 projectselector herleeft naast het archief', read.xerSourceProjectId === 'P6-ARCHIVE');
  expect('6a externe links, projectrapport en X6-provenance herleven uit diagnostics',
    JSON.stringify({
      links: read.xer?.externalLinks,
      report: read.xer?.report,
      provenance: read.xer?.resources && {
        assignments: read.xer.resources.assignments,
        issues: read.xer.resources.issues,
      },
    }) === JSON.stringify({
      links: [{ id: 'LINK-1', predecessor: { projectId: 'B', taskId: 'B' }, successor: { projectId: 'P6-ARCHIVE', taskId: 'A' }, type: 'FS', lagMinutes: 15 }],
      report: { projectsSeen: 2, documentsOpened: 1, emptyProjectsSkipped: 1, baselineProjectsExcluded: 0, baselinesMaterialized: 0, danglingBaselineReferences: 0, externalLinksPreserved: 1, baselineExclusionReverted: false, baselineFallbackReasons: [] },
      provenance: { assignments: [], issues: [{ code: 'XER_RESOURCE_TYPE_FALLBACK', table: 'RSRC', line: 1, sourceId: 'R', fallback: 'LABOR' }] },
    }));
}
const rejectsArchive = (value: string) => {
  try { readIFC(value); return false; }
  catch (error) { return error instanceof IfcParseError && error.reason === 'xer-source-archive'; }
};
const rejectsArchiveWith = (value: string, fragment: string) => {
  try { readIFC(value); return false; }
  catch (error) {
    return error instanceof IfcParseError
      && error.reason === 'xer-source-archive'
      && error.message.includes(fragment);
  }
};
const replaceIntegerProperty = (content: string, name: string, value: number) => content.replace(
  new RegExp(`(IFCPROPERTYSINGLEVALUE\\('${name}',\\$,IFCINTEGER\\()\\d+(\\),\\$\\))`),
  `$1${value}$2`,
);
const psetId = (content: string, name: string) => {
  const match = new RegExp(`#([A-Za-z0-9_]+)=IFCPROPERTYSET\\([^\\n]*'${name}'`).exec(content);
  if (!match) throw new Error(`Pset ${name} ontbreekt in fixture`);
  return match[1]!;
};
const propertyRelationLine = (content: string, setId: string) => {
  const line = content.split('\n').find(candidate =>
    candidate.includes('IFCRELDEFINESBYPROPERTIES(') && candidate.endsWith(`,#${setId});`));
  if (!line) throw new Error(`Relatie voor Pset #${setId} ontbreekt in fixture`);
  return line;
};
expect('7 corrupte base64 valt niet stil terug naar legacy-IFC', rejectsArchive(ifc.replace(archive.byteChunks[0]!, `!${archive.byteChunks[0]!.slice(1)}`)));
expect('8 ontbrekende chunk valt niet stil terug naar legacy-IFC', rejectsArchive(ifc.replace('ByteChunk000001', 'ByteChunkAfwezig')));
expect('9 mismatchende bronhash valt niet stil terug naar legacy-IFC', rejectsArchive(ifc.replace(archive.sha256, `0${archive.sha256.slice(1)}`)));
expect('10 verkeerde manifestchunkgrootte valt niet stil terug naar legacy-IFC', rejectsArchive(ifc.replace('IFCINTEGER(196608)', 'IFCINTEGER(196607)')));
expect('10a onbekende archiefschemaversie wordt getypeerd geweigerd',
  rejectsArchiveWith(replaceIntegerProperty(ifc, 'SchemaVersion', 2), 'SchemaVersion'));
expect('10b mismatchende ByteLength wordt vóór samenvoegen getypeerd geweigerd',
  rejectsArchiveWith(ifc.replace(`IFCINTEGER(${bytes.length})`, `IFCINTEGER(${bytes.length + 1})`), 'heeft'));
const reorderedChunks = ifc
  .replace('ByteChunk000000', 'ByteChunkTMP')
  .replace('ByteChunk000001', 'ByteChunk000000')
  .replace('ByteChunkTMP', 'ByteChunk000001');
expect('10c verwisselde chunkvolgorde wordt vóór decode getypeerd geweigerd',
  rejectsArchiveWith(reorderedChunks, 'geordend'));
const validButChangedChunk = `${archive.byteChunks[0]![0] === 'A' ? 'B' : 'A'}${archive.byteChunks[0]!.slice(1)}`;
expect('10d geldige base64 met gewijzigde bytes faalt op SHA',
  rejectsArchiveWith(ifc.replace(archive.byteChunks[0]!, validButChangedChunk), 'Sha256'));
expect('10e selector naar ontbrekende documentview wordt nooit stil geaccepteerd',
  rejectsArchiveWith(ifc.replace("IFCTEXT('P6-ARCHIVE')", "IFCTEXT('P6-ONTBREEKT')"), 'documentview'));
const hugeCount = 4_294_967_296;
const hugeLength = hugeCount * 196_608;
const hugeBytes = replaceIntegerProperty(
  replaceIntegerProperty(ifc, 'ByteLength', hugeLength),
  'ByteChunkCount', hugeCount,
);
expect('11 enorme coherente bytecount wordt vóór Array.from/allocatie getypeerd geweigerd',
  rejectsArchiveWith(hugeBytes, 'propertybudget'));
const hugeDiagnostics = replaceIntegerProperty(
  replaceIntegerProperty(ifc, 'DiagnosticsByteLength', hugeLength),
  'DiagnosticsChunkCount', hugeCount,
);
expect('12 enorme coherente diagnosticscount wordt vóór Array.from/allocatie getypeerd geweigerd',
  rejectsArchiveWith(hugeDiagnostics, 'propertybudget'));

const projectLine = ifc.split('\n').find(line => line.includes('=IFCPROJECT('));
if (!projectLine) throw new Error('IFCPROJECT ontbreekt in fixture');
const duplicateProject = ifc.replace(projectLine, `${projectLine}\n${projectLine.replace(/^#[A-Za-z0-9_]+=/, '#999991=')}`);
expect('13 archive-IFC met twee IFCPROJECT-entiteiten wordt geweigerd',
  rejectsArchiveWith(duplicateProject, 'exact één IFCPROJECT'));

const selectorSetId = psetId(ifc, 'OPS_XerDocument');
const selectorRelation = propertyRelationLine(ifc, selectorSetId);
const danglingSelector = ifc.replace(selectorRelation, selectorRelation.replace(/\(#[A-Za-z0-9_]+\),#[A-Za-z0-9_]+\);$/, '(#999992),#' + selectorSetId + ');'));
expect('14 selectorrelatie naar een dangling project wordt geweigerd',
  rejectsArchiveWith(danglingSelector, 'hangt niet één-op-één'));

const archiveSetId = psetId(ifc, 'OPS_XerSourceArchive');
const duplicateRelation = ifc.replace(
  selectorRelation,
  selectorRelation.replace(new RegExp(`#${selectorSetId}\\);$`), `#${archiveSetId});`),
);
expect('15 dubbele propertyrelatie naar het archief wordt geweigerd',
  rejectsArchiveWith(duplicateRelation, 'hangt niet één-op-één'));

const legacyIfc = writeIFC({ project, calendar, tasks: [], sequences: [], resources: [], assignments: [] });
const legacyRead = readIFC(legacyIfc);
expect('16 geldige oudere IFC zonder XER-Psets blijft legacy-compatibel',
  legacyRead.xerSourceArchive === undefined && legacyRead.xerSourceProjectId === undefined && legacyRead.xer === undefined);

if (failures.length === 0) { console.log('OK  ifc-xer-archive-container: alle checks groen (22)'); process.exit(0); }
console.log(`XX  ifc-xer-archive-container: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
