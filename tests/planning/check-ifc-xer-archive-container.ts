// X9 — IFC-container voor het zelfstandige XER-bronarchief. Geen reader-mock: echte STEP-tekst
// gaat door writeIFC én readIFC. De bron is geldige XER, want schema 2 reconstrueert daaruit.
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import {
  decodeXerSourceArchive,
  sha256Hex,
} from '@/services/xerSourceArchive';
import { readXER } from '@/services/xer/xerReader';

declare const process: { exit(code: number): never };
const failures: string[] = [];
const expect = (label: string, condition: boolean) => { if (!condition) failures.push(label); };

const sourceText = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP6-ARCHIVE\tContainerfixture\tC\t2026-08-01 08:00',
  '%T\tSCHEDOPTIONS',
  '%F\tschedoptions_id\tproj_id\tsched_use_expect_end_flag',
  '%R\tSO\tP6-ARCHIVE\tY',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
  '%R\tA\tP6-ARCHIVE\tA-1\tArchieftaak\tC\t2026-08-01 08:00\t2026-08-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
  '%R\tR\tVakman\tRT_Labor\tC\t1',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trole_id\ttarget_qty_per_hr\tremain_qty\ttarget_qty',
  '%R\tAS\tP6-ARCHIVE\tA\tR\t\t1\t8\t8',
  '%T\tUNKNOWN',
  '%F\tpayload',
  `%R\t${'x'.repeat(196_608)}`,
  '%E',
].join('\r\n');
const bytes = new TextEncoder().encode(sourceText);
const opened = readXER(bytes);
if ('kind' in opened) throw new Error('Containerfixture moet één XER-document openen');
const archive = opened.xerSourceArchive;
if (!archive || !opened.xer) throw new Error('Containerfixture mist XER-bronarchief');
const ifc = writeIFC(opened);

expect('1 schrijft precies één manifestcontainer', (ifc.match(/OPS_XerSourceArchive/g) ?? []).length === 1);
expect('2 schrijft selector met P6-project', ifc.includes('OPS_XerDocument') && ifc.includes('P6-ARCHIVE'));
expect('3 volle chunk heeft 196608 bytes', archive.byteChunks.length === 2);
const read = readIFC(ifc);
expect('4 archive wordt uit IFC herlezen', read.xerSourceArchive !== undefined);
if (read.xerSourceArchive) {
  expect('5 bytes zijn exact gelijk', sha256Hex(decodeXerSourceArchive(read.xerSourceArchive)) === sha256Hex(bytes));
  expect('6 projectselector herleeft naast het archief', read.xerSourceProjectId === 'P6-ARCHIVE');
  expect('6a X5- en X6-bronmateriaal herleeft uit de compacte bronreconstructie',
    read.xer?.sourceProjectId === 'P6-ARCHIVE'
    && (read.xer.scheduleOptions.sourceRows.length ?? 0) > 0
    && read.xer.resources?.assignments.length === 1
    && read.xer.resources.assignments[0]?.sourceId === 'AS'
    && read.xer.resources.assignments[0]?.rawRow.cells.taskrsrc_id === 'AS');
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
  rejectsArchiveWith(replaceIntegerProperty(ifc, 'SchemaVersion', 3), 'SchemaVersion'));
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
const injectedDiagnostics = ifc.replace('ByteChunk000000', 'DiagnosticsChunk000000');
expect('12 schema-2 accepteert geen ingespoten uitgebreide diagnosticschunk',
  rejectsArchiveWith(injectedDiagnostics, 'geordend'));

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

const legacyIfc = writeIFC({ project: opened.project, calendar: opened.calendar, tasks: [], sequences: [], resources: [], assignments: [] });
const legacyRead = readIFC(legacyIfc);
expect('16 geldige oudere IFC zonder XER-Psets blijft legacy-compatibel',
  legacyRead.xerSourceArchive === undefined && legacyRead.xerSourceProjectId === undefined && legacyRead.xer === undefined);

if (failures.length === 0) { console.log('OK  ifc-xer-archive-container: alle checks groen (22)'); process.exit(0); }
console.log(`XX  ifc-xer-archive-container: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
