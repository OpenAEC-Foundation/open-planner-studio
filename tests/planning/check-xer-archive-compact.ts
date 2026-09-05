// X9-compactopslag — corpusloze contracttest voor een zelfstandig, uit ruwe bytes herbouwd archief.
import { isMultiDocumentImport } from '@/services/importTypes';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';
import {
  chunkXerArchiveBytes,
  decodeXerSourceArchive,
  encodeXerArchiveMetadataPayload,
  sha256Hex,
  type XerSourceArchive,
} from '@/services/xerSourceArchive';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean): void => {
  checks += 1;
  if (!condition) failures.push(label);
};

const source = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP-A\tAlpha\tC\t2026-08-01 08:00',
  '%R\tP-B\tBeta\tC\t2026-08-02 08:00',
  '%T\tSCHEDOPTIONS',
  '%F\tschedoptions_id\tproj_id\tsched_use_expect_end_flag',
  '%R\tSO-A\tP-A\tY',
  '%R\tSO-B\tP-B\tN',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
  '%R\tT-A\tP-A\tA-1\tAlpha-taak\tC\t2026-08-01 08:00\t2026-08-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
  '%R\tT-B\tP-B\tB-1\tBeta-taak\tC\t2026-08-02 08:00\t2026-08-02 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
  '%R\tR-1\tVakman\tRT_Labor\tC\t1',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trole_id\ttarget_qty_per_hr\tremain_qty\ttarget_qty',
  '%R\tAS-A\tP-A\tT-A\tR-1\t\t1\t8\t8',
  '%R\tAS-B\tP-B\tT-B\tR-1\t\t1\t8\t8',
  '%T\tACTVTYPE',
  '%F\tactv_code_type_id\tactv_code_type\tseq_num',
  '%R\tTYPE\tFase\t1',
  '%T\tACTVCODE',
  '%F\tactv_code_id\tactv_code_type_id\tshort_name\tseq_num',
  '%R\tVALUE\tTYPE\tVoorbereiding\t1',
  '%T\tTASKACTV',
  '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id',
  '%R\tP-A\tT-A\tTYPE\tVALUE',
  '%T\tUDFTYPE',
  '%F\tudf_type_id\ttable_name\tudf_type_label\tlogical_data_type',
  '%R\tUF\tTASK\tBronveld\tFT_STATICTYPE',
  '%T\tUDFVALUE',
  '%F\tudf_type_id\tproj_id\tfk_id\tudf_text',
  '%R\tUF\tP-A\tT-A\tBronwaarde',
  '%E',
].join('\r\n'));

const opened = readXER(source);
if (!isMultiDocumentImport(opened)) throw new Error('Compactfixture moet twee documenten openen');
const alpha = opened.results.find(result => result.xer?.sourceProjectId === 'P-A');
if (!alpha?.xerSourceArchive || !alpha.xer) throw new Error('Compactfixture mist P-A-bronarchief');
const archive = alpha.xerSourceArchive;
const beta = opened.results.find(result => result.xer?.sourceProjectId === 'P-B');
if (!beta?.xerSourceArchive || !beta.xer) throw new Error('Compactfixture mist P-B-bronarchief');

const compactIfc = writeIFC(alpha);
const parsedCompact = readIFC(compactIfc);
const compactBetaIfc = writeIFC(beta);
const parsedCompactBeta = readIFC(compactBetaIfc);

const escapeIfcText = (value: string): string => value.replace(/'/g, "''");

/** Bouw in de test zelf een echte schema-1-container om de leescompatibiliteit te bewaken.
 * Productcode schrijft dit formaat nooit meer; dit is uitsluitend een historische invoerfixture. */
function appendLegacyExpandedContainer(ifc: string, sourceArchive: XerSourceArchive, sourceProjectId: string): string {
  const project = /#([A-Za-z0-9_]+)=IFCPROJECT\([^,]+,#([A-Za-z0-9_]+)/.exec(ifc);
  if (!project) throw new Error('Basis-IFC mist IFCPROJECT/eigenaar');
  const diagnostics = chunkXerArchiveBytes(encodeXerArchiveMetadataPayload(sourceArchive));
  let nextId = 900000;
  const lines: string[] = [];
  const propertyIds: number[] = [];
  const property = (name: string, value: string): void => {
    const id = nextId++;
    propertyIds.push(id);
    lines.push(`#${id}=IFCPROPERTYSINGLEVALUE('${name}',$,${value},$);`);
  };
  property('SchemaVersion', 'IFCINTEGER(1)');
  property('Format', `IFCLABEL('${escapeIfcText(sourceArchive.format)}')`);
  property('ByteLength', `IFCINTEGER(${sourceArchive.byteLength})`);
  property('Sha256', `IFCTEXT('${sourceArchive.sha256}')`);
  property('Encoding', `IFCLABEL('${sourceArchive.encoding}')`);
  property('Bom', `IFCLABEL('${sourceArchive.bom}')`);
  property('Newline', `IFCLABEL('${sourceArchive.newline}')`);
  property('ByteChunkSize', 'IFCINTEGER(196608)');
  property('ByteChunkCount', `IFCINTEGER(${sourceArchive.byteChunks.length})`);
  property('DiagnosticsByteLength', `IFCINTEGER(${diagnostics.byteLength})`);
  property('DiagnosticsSha256', `IFCTEXT('${diagnostics.sha256}')`);
  property('DiagnosticsChunkCount', `IFCINTEGER(${diagnostics.byteChunks.length})`);
  sourceArchive.byteChunks.forEach((chunk, index) => property(
    `ByteChunk${String(index).padStart(6, '0')}`,
    `IFCTEXT('${chunk}')`,
  ));
  diagnostics.byteChunks.forEach((chunk, index) => property(
    `DiagnosticsChunk${String(index).padStart(6, '0')}`,
    `IFCTEXT('${chunk}')`,
  ));
  const archiveSet = nextId++;
  lines.push(`#${archiveSet}=IFCPROPERTYSET('0xxxxxxxxxxxxxxxxxxxxx',#${project[2]},'OPS_XerSourceArchive',$,(${propertyIds.map(id => `#${id}`).join(',')}));`);
  lines.push(`#${nextId++}=IFCRELDEFINESBYPROPERTIES('1xxxxxxxxxxxxxxxxxxxxx',#${project[2]},$,$,(#${project[1]}),#${archiveSet});`);
  const selectorIds: number[] = [];
  const selector = (name: string, value: string): void => {
    const id = nextId++;
    selectorIds.push(id);
    lines.push(`#${id}=IFCPROPERTYSINGLEVALUE('${name}',$,${value},$);`);
  };
  selector('ArchiveSha256', `IFCTEXT('${sourceArchive.sha256}')`);
  selector('SourceProjectId', `IFCTEXT('${escapeIfcText(sourceProjectId)}')`);
  const selectorSet = nextId++;
  lines.push(`#${selectorSet}=IFCPROPERTYSET('2xxxxxxxxxxxxxxxxxxxxx',#${project[2]},'OPS_XerDocument',$,(${selectorIds.map(id => `#${id}`).join(',')}));`);
  lines.push(`#${nextId++}=IFCRELDEFINESBYPROPERTIES('3xxxxxxxxxxxxxxxxxxxxx',#${project[2]},$,$,(#${project[1]}),#${selectorSet});`);
  return ifc.replace(
    '\nENDSEC;\nEND-ISO-10303-21;\n',
    `\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`,
  );
}

const legacyBase = writeIFC({ ...alpha, xer: undefined, xerSourceArchive: undefined, xerSourceProjectId: undefined });
const legacyIfc = appendLegacyExpandedContainer(legacyBase, archive, 'P-A');
const parsedLegacy = readIFC(legacyIfc);

const rejectsCompact = (candidate: string, fragment: string): boolean => {
  try {
    readIFC(candidate);
    return false;
  } catch (error) {
    return error instanceof IfcParseError
      && error.reason === 'xer-source-archive'
      && error.message.includes(fragment);
  }
};

expect('1 schrijver markeert uitsluitend schema-2 compacte bronreconstructie',
  compactIfc.includes("IFCPROPERTYSINGLEVALUE('SchemaVersion',$,IFCINTEGER(2),$)")
  && compactIfc.includes("IFCPROPERTYSINGLEVALUE('StorageFormat',$,IFCLABEL('raw-source-reconstruction-v1'),$)"));
expect('2 schrijver neemt geen afgeleide diagnostics/readmodel-projecties op',
  !compactIfc.includes('DiagnosticsChunk')
  && !compactIfc.includes('DiagnosticsByteLength')
  && !compactIfc.includes('documentViews')
  && !compactIfc.includes('taskSourceRowsByProject'));
expect('3 compacte IFC is werkelijk kleiner dan dezelfde zelfstandige schema-1-container',
  compactIfc.length < legacyIfc.length);
expect('4 compact herstel bewaart exact de oorspronkelijke bytes en checksum',
  parsedCompact.xerSourceArchive !== undefined
  && sha256Hex(decodeXerSourceArchive(parsedCompact.xerSourceArchive)) === archive.sha256
  && parsedCompact.xerSourceArchive.sha256 === archive.sha256);
expect('5 compact herstel reconstrueert diagnostics en readmodel volledig en semantisch gelijkwaardig',
  JSON.stringify(parsedCompact.xerSourceArchive?.diagnostics) === JSON.stringify(archive.diagnostics)
  && JSON.stringify(parsedCompact.xerSourceArchive?.readModel) === JSON.stringify(archive.readModel));
expect('6 compact herstel bindt de juiste projectview met X5/X6/X8-bronmateriaal',
  parsedCompact.xerSourceProjectId === 'P-A'
  && parsedCompact.xer?.sourceProjectId === 'P-A'
  && (parsedCompact.xer?.resources?.assignments.length ?? 0) === (alpha.xer.resources?.assignments.length ?? 0)
  && (parsedCompact.xer?.metadata?.catalog.taskProjectionsByProject['P-A']?.length ?? 0)
    === (alpha.xer.metadata?.catalog.taskProjectionsByProject['P-A']?.length ?? 0)
  && (parsedCompact.xer?.scheduleOptions.sourceRows.length ?? 0) === alpha.xer.scheduleOptions.sourceRows.length);
expect('6a iedere zelfstandige schema-2-IFC reconstrueert de bijbehorende selectorview uit dezelfde bron',
  parsedCompactBeta.xerSourceArchive?.sha256 === archive.sha256
  && parsedCompactBeta.xerSourceProjectId === 'P-B'
  && parsedCompactBeta.xer?.sourceProjectId === 'P-B'
  && (parsedCompactBeta.xer?.resources?.assignments.length ?? 0) === (beta.xer.resources?.assignments.length ?? 0)
  && (parsedCompactBeta.xer?.metadata?.catalog.taskProjectionsByProject['P-B']?.length ?? 0)
    === (beta.xer.metadata?.catalog.taskProjectionsByProject['P-B']?.length ?? 0)
  && (parsedCompactBeta.xer?.scheduleOptions.sourceRows.length ?? 0) === beta.xer.scheduleOptions.sourceRows.length);
expect('7 gereconstrueerde compacte archivegraaf blijft diep immutable',
  Object.isFrozen(parsedCompact.xerSourceArchive)
  && Object.isFrozen(parsedCompact.xerSourceArchive?.diagnostics)
  && Object.isFrozen(parsedCompact.xerSourceArchive?.readModel)
  && Object.isFrozen(parsedCompact.xerSourceArchive?.readModel.resourceCatalog));
expect('8 schema-1 uitgebreide X9-container blijft achterwaarts leesbaar',
  parsedLegacy.xerSourceArchive !== undefined
  && parsedLegacy.xerSourceProjectId === 'P-A'
  && JSON.stringify(parsedLegacy.xerSourceArchive.diagnostics) === JSON.stringify(archive.diagnostics)
  && JSON.stringify(parsedLegacy.xerSourceArchive.readModel) === JSON.stringify(archive.readModel));
expect('9 gewijzigde bronhash blijft fail-closed getypeerd geweigerd',
  rejectsCompact(compactIfc.replace(archive.sha256, `0${archive.sha256.slice(1)}`), 'Sha256'));
expect('10 onbekende compacte formaatmarkering blijft fail-closed getypeerd geweigerd',
  rejectsCompact(compactIfc.replace('raw-source-reconstruction-v1', 'raw-source-reconstruction-x'), 'StorageFormat'));
expect('11 schema-2-uitvoer houdt de originele bron ongewijzigd na een gewone IFC-ronde',
  parsedCompact.xerSourceArchive !== undefined
  && sha256Hex(decodeXerSourceArchive(parsedCompact.xerSourceArchive)) === sha256Hex(source));

console.log(`X9 compact fixture: source=${source.length} compact-ifc=${compactIfc.length} legacy-ifc=${legacyIfc.length}`);
if (failures.length === 0) {
  console.log(`OK  xer-archive-compact: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-archive-compact: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
