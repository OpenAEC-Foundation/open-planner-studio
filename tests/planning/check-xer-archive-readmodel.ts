// X9 reviewronde 1 — het exacte bytearchief draagt één versiegebonden, getypeerd readmodel.
// De fixture gaat door de echte XER-reader en daarna per project door writeIFC/readIFC.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';
import {
  decodeXerSourceArchive,
  sha256Hex,
  XerSourceArchiveValidationError,
} from '@/services/xerSourceArchive';
import { useAppStore } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { writeExpandedLegacyXerArchiveFixture } from './xerArchiveLegacyFixture';

declare const process: { exit(code: number): never };
const failures: string[] = [];
let checks = 0;
const equal = (label: string, actual: unknown, expected: unknown) => {
  checks += 1;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
};
const truthy = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};

const source = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tCURRTYPE',
  '%F\tcurr_short_name\tdecimal_symbol\tdigit_group_symbol',
  '%R\tEUR\tcomma\tperiod',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tsum_base_proj_id',
  '%R\tP-A\tProject A\tC\t2026-08-01 08:00\tP-BASE',
  '%R\tP-B\tProject B\tC\t2026-08-01 08:00\tP-MISSING',
  '%R\tP-BASE\tRetained baseline\tC\t2026-07-01 08:00\t',
  '%R\tP-EMPTY\tLeeg legacyproject\tC\t2026-08-01 08:00\t',
  '%T\tSCHEDOPTIONS',
  '%F\tproj_id',
  '%R\tP-A',
  '%R\tP-B',
  '%R\tP-B',
  '%R\tP-UNMATCHED',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tsuspend_date\tresume_date',
  '%R\tT-A\tP-A\tA-1\tTaak A\tC\t2026-08-01 08:00\t2026-08-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t\t\t',
  '%R\tT-A2\tP-A\tA-2\tTaak A2\tC\t2026-08-03 08:00\t2026-08-03 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t\t\t',
  '%R\tT-B\tP-B\tB-1\tTaak B\tC\t2026-08-02 08:00\t2026-08-02 16:00\t8\tTT_Task\tDT_FixedRate\tTK_NotStart\tCP_Phys\t\t',
  '%R\tT-BASE\tP-BASE\tBL-1\tBaselinedata\tC\t2026-07-01 08:00\t2026-07-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t\t\t',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\tproj_id\tpred_proj_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt',
  '%R\tREL-AB\tP-B\tP-A\tT-B\tT-A\tPR_FS\t0',
  '%T\tROLES',
  '%F\trole_id\trole_name',
  '%R\tROLE-1\tUitvoerder',
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr\trole_id',
  '%R\tR-1\tVakman\tRT_Labor\tC\t2\tROLE-1',
  '%T\tRSRCRATE',
  '%F\trsrc_rate_id\trsrc_id\tmax_qty_per_hr\tcost_per_qty\tstart_date',
  '%R\tRATE-1\tR-1\t1\t25,50\t2026-08-01 00:00',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trole_id\ttarget_qty_per_hr\tremain_qty_per_hr\tremain_qty\ttarget_qty',
  '%R\tAS-A\tP-A\tT-A\tR-1\tROLE-1\t0,5\t0,5\t4\t4',
  '%R\tAS-A-UNLINKED\tP-A\tT-A-MISSING\tR-1\t\t0,1\t0,1\t1\t1',
  '%R\tAS-A-UNLINKED-RESOURCE\tP-A\tT-A-MISSING-2\tR-MISSING\t\t0,1\t0,1\t1\t1',
  '%R\tAS-A-ROLE-MISSING\tP-A\tT-A\t\tROLE-MISSING\t0,1\t0,1\t1\t1',
  '%R\tAS-UNSCOPED\t\tT-A\tR-1\t\t0,1\t0,1\t1\t1',
  '%R\tAS-B\tP-B\tT-B\tR-1\t\t0,25\t0,25\t2\t2',
  '%R\tAS-BASE\tP-BASE\tT-BASE\tR-1\t\t0,2\t0,2\t2\t2',
  '%T\tACTVTYPE',
  '%F\tactv_code_type_id\tactv_code_type\tseq_num',
  '%R\tTYPE\tFase\t1',
  '%T\tACTVCODE',
  '%F\tactv_code_id\tactv_code_type_id\tshort_name\tseq_num',
  '%R\tV-A\tTYPE\tA\t1',
  '%R\tV-B\tTYPE\tB\t2',
  '%T\tTASKACTV',
  '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id',
  '%R\tP-A\tT-A\tTYPE\tV-A',
  '%R\tP-B\tT-B\tTYPE\tV-B',
  '%R\tP-BASE\tT-BASE\tTYPE\tV-A',
  '%T\tUDFTYPE',
  '%F\tudf_type_id\ttable_name\tudf_type_label\tlogical_data_type',
  '%R\tUF\tTASK\tKeuze\tFT_STATICTYPE',
  '%T\tUDFVALUE',
  '%F\tudf_type_id\tproj_id\tfk_id\tudf_text',
  '%R\tUF\tP-A\tT-A\tAlleen A',
  '%E',
].join('\r\n'));

const opened = readXER(source);
if (!isMultiDocumentImport(opened)) throw new Error('De readmodel-fixture moet twee projecten openen');
const [a, b] = opened.results;
if (!a || !b || !a.xerSourceArchive) throw new Error('XER-resultaat mist project of archief');
const archive = a.xerSourceArchive as typeof a.xerSourceArchive & {
  readModel?: {
    schemaVersion: number;
    numberFormat: unknown;
    scheduleOptionsSourceArchive?: unknown;
    resourceCatalog: unknown;
    metadataCatalog: unknown;
  };
  diagnostics: Record<string, unknown> & { schemaVersion?: number; file?: unknown; documentViews?: Record<string, unknown> };
};

equal('1 archive-readmodel is versiegebonden en bewaart CURRTYPE exact',
  [archive.readModel?.schemaVersion, archive.readModel?.numberFormat],
  [1, { decimal: ',', group: '.', source: 'currtype', currencyCode: 'EUR' }]);
truthy('2 beide documenten gebruiken de catalogi uit exact hetzelfde archive-readmodel',
  a.xer?.resources?.catalog === archive.readModel?.resourceCatalog
  && b.xer?.resources?.catalog === archive.readModel?.resourceCatalog
  && a.xer?.metadata?.catalog === archive.readModel?.metadataCatalog
  && b.xer?.metadata?.catalog === archive.readModel?.metadataCatalog);
truthy('2a projectprovenance heeft geen tweede persistente bronkopie naast de immutable documentview',
  a.xer?.resources?.assignments === a.xerSourceArchive?.diagnostics.documentViews['P-A']?.resources?.assignments
  && b.xer?.resources?.assignments === b.xerSourceArchive?.diagnostics.documentViews['P-B']?.resources?.assignments
  && Object.isFrozen(a.xer?.resources?.assignments)
  && Object.isFrozen(a.xer?.resources?.assignments[0]));
truthy('2b X5 bewaart precies één file-wide sourceArchive in het archive-readmodel',
  a.xer?.scheduleOptions.sourceArchive === archive.readModel?.scheduleOptionsSourceArchive
  && b.xer?.scheduleOptions.sourceArchive === archive.readModel?.scheduleOptionsSourceArchive
  && a.xer?.scheduleOptions.sourceArchive === b.xer?.scheduleOptions.sourceArchive);
truthy('2c X5-projectviews verwijzen met sourceRows naar die ene immutable filecache',
  [a, b].every(result => result.xer?.scheduleOptions.sourceRows.every((row, index) =>
    row === result.xer?.scheduleOptions.sourceArchive.rows[result.xer.scheduleOptions.sourceRowIndexes[index]!]))
  && Object.isFrozen(a.xer?.scheduleOptions.sourceArchive)
  && Object.isFrozen(a.xer?.scheduleOptions.sourceRows));
equal('3 diagnostics hebben een getypeerde versie, file-view en beide projectviews',
  [archive.diagnostics.schemaVersion, Boolean(archive.diagnostics.file), Object.keys(archive.diagnostics.documentViews ?? {}).sort()],
  [1, true, ['P-A', 'P-B']]);
equal('3a rijke meerprojectfixture bewaart baseline, dangling verwijzing en leeg legacyproject zonder documentview', {
  report: a.xer?.report,
  baselineNames: a.baselines?.map(item => item.name),
  sourceProjects: Object.keys(archive.readModel?.taskSourceRowsByProject ?? {}).sort(),
  projectRows: archive.readModel?.scheduleOptionsSourceArchive?.rows
    .filter(row => row.table === 'PROJECT').map(row => [row.cells.proj_id, row.cells.sum_base_proj_id]),
  metadataTasks: archive.readModel?.metadataCatalog.taskProjections
    .map(item => `${item.projectId}/${item.taskId}`),
}, {
  report: {
    projectsSeen: 4, documentsOpened: 2, emptyProjectsSkipped: 1,
    baselineProjectsExcluded: 1, baselinesMaterialized: 1, danglingBaselineReferences: 1,
    externalLinksPreserved: 1, baselineExclusionReverted: false, baselineFallbackReasons: [],
  },
  baselineNames: ['Retained baseline'],
  sourceProjects: ['P-A', 'P-B', 'P-BASE'],
  projectRows: [['P-A', 'P-BASE'], ['P-B', 'P-MISSING'], ['P-BASE', ''], ['P-EMPTY', '']],
  metadataTasks: ['P-A/T-A', 'P-B/T-B', 'P-BASE/T-BASE'],
});
equal('3b cross-project TASKPRED blijft brondata in beide endpointviews en wordt nooit lokale solverinvoer',
  [a.xer?.externalRelations.map(item => [item.id, item.direction]),
    b.xer?.externalRelations.map(item => [item.id, item.direction]),
    a.xer?.externalLinks.map(item => item.id), b.xer?.externalLinks.map(item => item.id),
    a.sequences.length, b.sequences.length],
  [[['REL-AB', 'successor']], [['REL-AB', 'predecessor']], ['REL-AB'], ['REL-AB'], 0, 0]);
equal('3c X6 bewaart gekoppelde, ongekoppelde en baseline-TASKRSRC als onderscheiden provenance', {
  canonical: archive.readModel?.resourceCatalog.rows.assignments.map(row => row.cells.taskrsrc_id),
  a: a.xer?.resources?.assignments.map(item => item.sourceId),
  b: b.xer?.resources?.assignments.map(item => item.sourceId),
  missing: a.xer?.resources?.issues.filter(item => item.code === 'XER_ASSIGNMENT_TASK_MISSING').map(item => item.sourceId),
  skipped: a.xer?.resources?.issues.filter(item => item.fallback === 'SKIPPED').map(item => [item.code, item.sourceId]),
}, {
  canonical: ['AS-A', 'AS-A-UNLINKED', 'AS-A-UNLINKED-RESOURCE', 'AS-A-ROLE-MISSING', 'AS-UNSCOPED', 'AS-B', 'AS-BASE'],
  a: ['AS-A', 'AS-A-UNLINKED', 'AS-A-UNLINKED-RESOURCE', 'AS-A-ROLE-MISSING'], b: ['AS-B'],
  missing: ['AS-A-UNLINKED'],
  skipped: [['XER_ASSIGNMENT_TASK_MISSING', 'AS-A-UNLINKED'],
    ['XER_ASSIGNMENT_RESOURCE_MISSING', 'AS-A-UNLINKED-RESOURCE'],
    ['XER_ASSIGNMENT_ROLE_MISSING', 'AS-A-ROLE-MISSING']],
});
equal('3d X5 bewaart gewone, dubbele en unmatched SCHEDOPTIONS zonder bronverlies', {
  diagnostics: archive.readModel?.scheduleOptionsSourceArchive.diagnostics.map(item => [item.projectId, item.rowIndexes.length]),
  unmatched: archive.readModel?.scheduleOptionsSourceArchive.unmatchedScheduleOptionsRowIndexes.length,
  sources: [a.xer?.scheduleOptions.source, b.xer?.scheduleOptions.source],
}, { diagnostics: [['P-B', 2]], unmatched: 1, sources: ['schedoptions', 'xer-defaults'] });

const roundTrips = [a, b].map(result => readIFC(writeIFC(result)));
equal('4 per zelfstandig IFC herleven X6-resources, rates en projecttoewijzingen werkelijk',
  roundTrips.map(result => ({
    catalogResources: result.xer?.resources?.catalog?.resources.length,
    rates: result.xer?.resources?.catalog?.rows.rates.length,
    assignments: result.xer?.resources?.assignments.map(item => item.sourceId),
  })), [
    { catalogResources: 1, rates: 1, assignments: ['AS-A', 'AS-A-UNLINKED', 'AS-A-UNLINKED-RESOURCE', 'AS-A-ROLE-MISSING'] },
    { catalogResources: 1, rates: 1, assignments: ['AS-B'] },
  ]);
equal('5 per zelfstandig IFC herleven X8-catalogus en documentspecifieke projectie werkelijk',
  roundTrips.map(result => ({
    catalogTypes: result.xer?.metadata?.catalog?.activityCodeTypes.map(type => type.id),
    taskCodes: result.tasks.find(task => task.wbsCode === (result.xerSourceProjectId === 'P-A' ? 'A-1' : 'B-1'))?.activityCodes,
    udf: result.tasks.find(task => task.wbsCode === 'A-1')?.customFields,
  })), [
    { catalogTypes: ['TYPE'], taskCodes: { TYPE: 'V-A' }, udf: { UF: 'Alleen A' } },
    { catalogTypes: ['TYPE'], taskCodes: { TYPE: 'V-B' }, udf: undefined },
  ]);
truthy('6 IFC-read gebruikt per document de catalogusrefs uit zijn archive-readmodel', roundTrips.every(result => {
  const readModel = (result.xerSourceArchive as typeof archive | undefined)?.readModel;
  return result.xer?.resources?.catalog === readModel?.resourceCatalog
    && result.xer?.metadata?.catalog === readModel?.metadataCatalog;
}));
truthy('6a IFC-read materialiseert geen tweede X6-provenancekopie buiten zijn archive-documentview',
  roundTrips.every(result => result.xer?.resources?.assignments
    === result.xerSourceArchive?.diagnostics.documentViews[result.xerSourceProjectId ?? '']?.resources?.assignments));
truthy('6b IFC-read bindt X5 sourceArchive/sourceRows opnieuw aan de ene archivecache',
  roundTrips.every(result => {
    const metadata = result.xer;
    return metadata !== undefined
      && metadata.scheduleOptions.sourceArchive === result.xerSourceArchive?.readModel.scheduleOptionsSourceArchive
      && metadata.scheduleOptions.sourceRows.every((row, index) =>
        row === result.xerSourceArchive?.readModel.scheduleOptionsSourceArchive.rows[
          metadata.scheduleOptions.sourceRowIndexes[index]!
        ]);
  }));

const originalIfc = writeExpandedLegacyXerArchiveFixture(a);
const diagnosticChunkPattern = /IFCPROPERTYSINGLEVALUE\('DiagnosticsChunk(\d{6})',\$,IFCTEXT\('([A-Za-z0-9+/=]+)'\),\$\)/g;
const diagnosticChunks = [...originalIfc.matchAll(diagnosticChunkPattern)]
  .sort((left, right) => left[1]!.localeCompare(right[1]!));
if (diagnosticChunks.length === 0) throw new Error('DiagnosticsChunk-container ontbreekt');
const decodeBase64 = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const diagnosticBytes = new Uint8Array(diagnosticChunks.reduce((total, chunk) => total + decodeBase64(chunk[2]!).length, 0));
let diagnosticOffset = 0;
for (const chunk of diagnosticChunks) {
  const decoded = decodeBase64(chunk[2]!);
  diagnosticBytes.set(decoded, diagnosticOffset);
  diagnosticOffset += decoded.length;
}
const payload = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
const ifcWithMetadataBytes = (encoded: Uint8Array) => {
  const rebuiltChunks: string[] = [];
  for (let offset = 0; offset < encoded.length; offset += 196_608) {
    rebuiltChunks.push(Buffer.from(encoded.subarray(offset, offset + 196_608)).toString('base64'));
  }
  if (rebuiltChunks.length !== diagnosticChunks.length) {
    throw new Error('Testfixture wijzigde onverwacht het diagnostics-chunkaantal');
  }
  let result = originalIfc;
  for (let index = 0; index < diagnosticChunks.length; index += 1) {
    result = result.replace(diagnosticChunks[index]![2]!, rebuiltChunks[index]!);
  }
  const independentSha256 = createHash('sha256').update(encoded).digest('hex');
  return result
    .replace(/(IFCPROPERTYSINGLEVALUE\('DiagnosticsByteLength',\$,IFCINTEGER\()\d+(\),\$\))/, `$1${encoded.length}$2`)
    .replace(/(IFCPROPERTYSINGLEVALUE\('DiagnosticsSha256',\$,IFCTEXT\(')[0-9a-f]{64}('\),\$\))/, `$1${independentSha256}$2`);
};
const ifcWithMetadataPayload = (metadataPayload: Record<string, unknown>) =>
  ifcWithMetadataBytes(new TextEncoder().encode(JSON.stringify(metadataPayload)));
const legacySelectorPayload = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
const legacyTaskRows = (legacySelectorPayload.readModel as Record<string, unknown>)
  .taskSourceRowsByProject as Record<string, Array<Record<string, unknown>>>;
delete legacyTaskRows['P-A'];
let legacySelectorAccepted = true;
try { readIFC(ifcWithMetadataPayload(legacySelectorPayload)); }
catch { legacySelectorAccepted = false; }
truthy('6c volledig ontbrekende legacy-TASK-groep blijft een geldige verliesvrije archiefgrens', legacySelectorAccepted);
const presentEmptyTaskGroupPayload = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
const presentEmptyTaskRows = (presentEmptyTaskGroupPayload.readModel as Record<string, unknown>)
  .taskSourceRowsByProject as Record<string, Array<Record<string, unknown>>>;
presentEmptyTaskRows['P-A'] = [];
let presentEmptyTaskGroupRejection: unknown;
try { readIFC(ifcWithMetadataPayload(presentEmptyTaskGroupPayload)); }
catch (error) { presentEmptyTaskGroupRejection = error; }
truthy('6d aanwezige maar lege TASK-groep blijft hard gebonden en wordt specifiek geweigerd',
  presentEmptyTaskGroupRejection instanceof IfcParseError
  && presentEmptyTaskGroupRejection.reason === 'xer-source-archive'
  && presentEmptyTaskGroupRejection.message.includes('ontbrekende TASK-identiteit'));
const byProject = ((payload.diagnostics as Record<string, unknown>).documentViews) as Record<string, Record<string, unknown>>;
byProject['P-A']!.calendarIssues = [{
  code: 'XER_CALENDAR_RECOVERED', calendarId: 'C', line: 1, reason: 'fixture', resolution: 'BROKEN',
}];
let hostileTyped = false;
try { readIFC(ifcWithMetadataPayload(payload)); }
catch (error) { hostileTyped = error instanceof IfcParseError && error.reason === 'xer-source-archive'; }
truthy('7 hostile nested diagnostic-enum wordt totaal en getypeerd geweigerd', hostileTyped);

const hostileNumberPayload = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
const hostileNumberFormat = ((hostileNumberPayload.readModel as Record<string, unknown>).numberFormat) as Record<string, unknown>;
hostileNumberFormat.decimal = ';';
let hostileNumberTyped = false;
try { readIFC(ifcWithMetadataPayload(hostileNumberPayload)); }
catch (error) { hostileNumberTyped = error instanceof IfcParseError && error.reason === 'xer-source-archive'; }
truthy('7a hostile CURRTYPE-numberFormatvorm wordt getypeerd geweigerd', hostileNumberTyped);

const reviewerCorruptions: readonly [string, (candidate: Record<string, unknown>) => void][] = [
  ['X6 resourceobject [42]', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    (readModel.resourceCatalog as Record<string, unknown>).resources = [42];
  }],
  ['X8 activityCodeTypes [false]', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    (readModel.metadataCatalog as Record<string, unknown>).activityCodeTypes = [false];
  }],
  ['document externalLink zonder kernvelden', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = (diagnostics.documentViews as Record<string, Record<string, unknown>>);
    views['P-A']!.externalLinks = [{ definitely: 'not-an-XerDocumentExternalLink' }];
  }],
];
for (const [label, mutate] of reviewerCorruptions) {
  const candidate = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
  mutate(candidate);
  let rejected = false;
  try { readIFC(ifcWithMetadataPayload(candidate)); }
  catch (error) { rejected = error instanceof IfcParseError && error.reason === 'xer-source-archive'; }
  truthy(`7b reviewerpayload ${label} wordt ondanks correcte hash getypeerd geweigerd`, rejected);
}

const relationCorruptions: readonly [string, (candidate: Record<string, unknown>) => void][] = [
  ['X8 canonieke én projectview wijzen coherent naar niet-bestaande T-A-GHOST', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    const metadata = readModel.metadataCatalog as Record<string, unknown>;
    const canonical = metadata.taskProjections as Array<Record<string, unknown>>;
    const projections = metadata.taskProjectionsByProject as Record<string, Array<Record<string, unknown>>>;
    const canonicalA = canonical.find(item => item.projectId === 'P-A' && item.taskId === 'T-A');
    const projectA = projections['P-A']?.find(item => item.taskId === 'T-A');
    if (!canonicalA || !projectA) throw new Error('X8 T-A-aanvalsdoel ontbreekt');
    canonicalA.taskId = 'T-A-GHOST';
    projectA.taskId = 'T-A-GHOST';
  }],
  ['X6 assignment kruist coherent als typed taskSourceId=T-B terwijl raw TASKRSRC T-A draagt', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const resources = views['P-A']!.resources as Record<string, unknown>;
    const assignments = resources.assignments as Array<Record<string, unknown>>;
    const assignment = assignments.find(item => item.sourceId === 'AS-A');
    if (!assignment) throw new Error('X6 AS-A-aanvalsdoel ontbreekt');
    assignment.taskSourceId = 'T-B';
  }],
  ['externalRelation gebruikt een niet-bestaand lokaal TASK-eindpunt T-A-GHOST', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    (views['P-A']!.externalRelations as Array<Record<string, unknown>>)[0]!.localTaskId = 'T-A-GHOST';
  }],
  ['beide externalRelations zijn weg maar hun afgeleide externalLink blijft bestaan', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    views['P-A']!.externalRelations = [];
    views['P-B']!.externalRelations = [];
  }],
  ['externalLink is in beide endpointviews coherent omgebogen naar ghost-taken', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    for (const projectId of ['P-A', 'P-B']) {
      const link = (views[projectId]!.externalLinks as Array<Record<string, unknown>>)[0]!;
      (link.predecessor as Record<string, unknown>).taskId = 'T-A-GHOST';
      (link.successor as Record<string, unknown>).taskId = 'T-B-GHOST';
    }
  }],
  ['externalLink wijst naar niet-bestaand opvolgerproject en verdwijnt uit P-B terwijl bronrelatie blijft', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const link = (views['P-A']!.externalLinks as Array<Record<string, unknown>>)[0]!;
    const successor = link.successor as Record<string, unknown>;
    successor.projectId = 'P-NIET-BESTAAND';
    successor.taskId = 'T-NIET-BESTAAND';
    views['P-B']!.externalLinks = [];
  }],
  ['X5 PROJECT-bronrijen zijn omgewisseld en alle documentindexen volgen coherent mee', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    const sourceArchive = readModel.scheduleOptionsSourceArchive as Record<string, unknown>;
    const rows = sourceArchive.rows as Array<Record<string, unknown>>;
    [rows[0], rows[1]] = [rows[1]!, rows[0]!];
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    for (const view of Object.values(views)) {
      const schedule = view.scheduleOptions as Record<string, unknown>;
      schedule.sourceRowIndexes = (schedule.sourceRowIndexes as number[]).map(index =>
        index === 0 ? 1 : index === 1 ? 0 : index);
    }
  }],
  ['X6 canonieke TASKRSRC-rijen en P-A-documentview zijn samen omgewisseld', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    const resourceCatalog = readModel.resourceCatalog as Record<string, unknown>;
    const rows = (resourceCatalog.rows as Record<string, unknown>).assignments as Array<Record<string, unknown>>;
    [rows[0], rows[1]] = [rows[1]!, rows[0]!];
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const resources = views['P-A']!.resources as Record<string, unknown>;
    const assignments = resources.assignments as Array<Record<string, unknown>>;
    [assignments[0], assignments[1]] = [assignments[1]!, assignments[0]!];
  }],
  ['X8-projectie onder P-A draagt projectId P-B', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    const metadata = readModel.metadataCatalog as Record<string, unknown>;
    const projections = metadata.taskProjectionsByProject as Record<string, Array<Record<string, unknown>>>;
    projections['P-A']![0]!.projectId = 'P-B';
  }],
  ['X8-projectindex dupliceert een canonieke projectie', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    const metadata = readModel.metadataCatalog as Record<string, unknown>;
    const projections = metadata.taskProjectionsByProject as Record<string, Array<Record<string, unknown>>>;
    projections['P-A']!.push(structuredClone(projections['P-A']![0]!));
  }],
  ['X8-projectindex laat een canonieke projectie weg', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    const metadata = readModel.metadataCatalog as Record<string, unknown>;
    const projections = metadata.taskProjectionsByProject as Record<string, Array<Record<string, unknown>>>;
    projections['P-A'] = [];
  }],
  ['X8-canonieke projectielijst staat niet in project-/taakvolgorde', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    const metadata = readModel.metadataCatalog as Record<string, unknown>;
    (metadata.taskProjections as Array<Record<string, unknown>>).reverse();
  }],
  ['X5-view P-A verwijst naar een bronrij van P-B', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const scheduleA = views['P-A']!.scheduleOptions as Record<string, unknown>;
    const scheduleB = views['P-B']!.scheduleOptions as Record<string, unknown>;
    (scheduleA.sourceRowIndexes as number[])[0] = (scheduleB.sourceRowIndexes as number[])[0]!;
  }],
  ['X5-view P-A verliest zijn verplichte PROJECT-rij door een verkeerd tabeltype', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const scheduleA = views['P-A']!.scheduleOptions as Record<string, unknown>;
    const readModel = candidate.readModel as Record<string, unknown>;
    const sourceArchive = readModel.scheduleOptionsSourceArchive as Record<string, unknown>;
    const rows = sourceArchive.rows as Array<Record<string, unknown>>;
    rows[(scheduleA.sourceRowIndexes as number[])[0]!]!.table = 'SCHEDOPTIONS';
  }],
  ['X5-view P-A laat een canonieke bronrij weg', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const scheduleA = views['P-A']!.scheduleOptions as Record<string, unknown>;
    (scheduleA.sourceRowIndexes as number[]).pop();
  }],
  ['X5-unmatched-index claimt een aan P-A gekoppelde SCHEDOPTIONS-rij', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const scheduleA = views['P-A']!.scheduleOptions as Record<string, unknown>;
    const readModel = candidate.readModel as Record<string, unknown>;
    const sourceArchive = readModel.scheduleOptionsSourceArchive as Record<string, unknown>;
    (sourceArchive.unmatchedScheduleOptionsRowIndexes as number[]).push(
      (scheduleA.sourceRowIndexes as number[])[1]!,
    );
  }],
  ['X6-assignment van P-A draagt projectSourceId P-B', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const resources = views['P-A']!.resources as Record<string, unknown>;
    (resources.assignments as Array<Record<string, unknown>>)[0]!.projectSourceId = 'P-B';
  }],
  ['X6-assignment in een documentview verliest zijn vereiste projectSourceId', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    const resources = views['P-A']!.resources as Record<string, unknown>;
    delete (resources.assignments as Array<Record<string, unknown>>)[0]!.projectSourceId;
  }],
  ['TASK-sourceview onder P-A draagt proj_id P-B', candidate => {
    const readModel = candidate.readModel as Record<string, unknown>;
    const taskRows = readModel.taskSourceRowsByProject as Record<string, Array<Record<string, unknown>>>;
    const cells = taskRows['P-A']![0]!.cells as Record<string, unknown>;
    cells.proj_id = 'P-B';
  }],
  ['externe documentrelatie onder P-A draagt localProjectId P-B', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    (views['P-A']!.externalRelations as Array<Record<string, unknown>>).push({
      id: 'cross-project-probe', localProjectId: 'P-B', localTaskId: 'T-A',
      externalProjectId: 'P-B', externalTaskId: 'T-B', direction: 'successor', type: 'FS', lagMinutes: 0,
    });
  }],
  ['canonieke externalLink onder P-A heeft geen P-A-eindpunt', candidate => {
    const diagnostics = candidate.diagnostics as Record<string, unknown>;
    const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
    (views['P-A']!.externalLinks as Array<Record<string, unknown>>).push({
      id: 'detached-link-probe', predecessor: { projectId: 'P-B', taskId: 'T-B' },
      successor: { projectId: 'P-C', taskId: 'T-C' }, type: 'FS', lagMinutes: 0,
    });
  }],
];
for (const [label, mutate] of relationCorruptions) {
  const candidate = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
  mutate(candidate);
  let rejected = false;
  try { readIFC(ifcWithMetadataPayload(candidate)); }
  catch (error) { rejected = error instanceof IfcParseError && error.reason === 'xer-source-archive'; }
  truthy(`7c relationele reviewerpayload ${label} wordt met coherente chunks getypeerd geweigerd`, rejected);
}

const assignmentSkipCorruptions: readonly [string, string, (candidate: Record<string, unknown>) => void][] = [
  ['A1 TASK_MISSING is herlabeld naar RESOURCE_MISSING terwijl de resource bestaat',
    'TASKRSRC-skipdiagnostiek', candidate => {
      const diagnostics = candidate.diagnostics as Record<string, unknown>;
      const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
      const resources = views['P-A']!.resources as Record<string, unknown>;
      const issues = resources.issues as Array<Record<string, unknown>>;
      const issue = issues.find(item => item.sourceId === 'AS-A-UNLINKED');
      if (!issue) throw new Error('A1-doelissue ontbreekt');
      issue.code = 'XER_ASSIGNMENT_RESOURCE_MISSING';
    }],
  ['A2 een volledig geldige assignment draagt een verzonnen TASK_MISSING-issue',
    'TASKRSRC-skipdiagnostiek', candidate => {
      const diagnostics = candidate.diagnostics as Record<string, unknown>;
      const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
      const resources = views['P-A']!.resources as Record<string, unknown>;
      const assignments = resources.assignments as Array<Record<string, unknown>>;
      const issues = resources.issues as Array<Record<string, unknown>>;
      const assignment = assignments.find(item => item.sourceId === 'AS-A');
      if (!assignment) throw new Error('A2-doelassignment ontbreekt');
      issues.push({ code: 'XER_ASSIGNMENT_TASK_MISSING', table: 'TASKRSRC',
        line: assignment.line, sourceId: assignment.sourceId, fallback: 'SKIPPED' });
    }],
  ['A3 RESOURCE_MISSING is herlabeld naar TASK_MISSING terwijl resource én taak ontbreken',
    'TASKRSRC-skipdiagnostiek', candidate => {
      const diagnostics = candidate.diagnostics as Record<string, unknown>;
      const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
      const resources = views['P-A']!.resources as Record<string, unknown>;
      const issues = resources.issues as Array<Record<string, unknown>>;
      const issue = issues.find(item => item.sourceId === 'AS-A-UNLINKED-RESOURCE');
      if (!issue) throw new Error('A3-doelissue ontbreekt');
      issue.code = 'XER_ASSIGNMENT_TASK_MISSING';
    }],
  ['A4 ROLE_MISSING is herlabeld naar TASK_MISSING',
    'TASKRSRC-skipdiagnostiek', candidate => {
      const diagnostics = candidate.diagnostics as Record<string, unknown>;
      const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
      const resources = views['P-A']!.resources as Record<string, unknown>;
      const issues = resources.issues as Array<Record<string, unknown>>;
      const issue = issues.find(item => item.sourceId === 'AS-A-ROLE-MISSING');
      if (!issue) throw new Error('A4-doelissue ontbreekt');
      issue.code = 'XER_ASSIGNMENT_TASK_MISSING';
    }],
  ['A6 een vereiste TASK_MISSING-diagnose ontbreekt volledig',
    'TASKRSRC-skipdiagnostiek', candidate => {
      const diagnostics = candidate.diagnostics as Record<string, unknown>;
      const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
      const resources = views['P-A']!.resources as Record<string, unknown>;
      const issues = resources.issues as Array<Record<string, unknown>>;
      resources.issues = issues.filter(item => item.sourceId !== 'AS-A-UNLINKED');
    }],
  ['A7 een TASK_MISSING-diagnose komt dubbel voor',
    'TASKRSRC-skipdiagnostiek', candidate => {
      const diagnostics = candidate.diagnostics as Record<string, unknown>;
      const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
      const resources = views['P-A']!.resources as Record<string, unknown>;
      const issues = resources.issues as Array<Record<string, unknown>>;
      const issue = issues.find(item => item.sourceId === 'AS-A-UNLINKED');
      if (!issue) throw new Error('A7-doelissue ontbreekt');
      issues.push(structuredClone(issue));
    }],
  ['A8 een TASK_MISSING-diagnose is aan de verkeerde bronregel gekoppeld',
    'TASKRSRC-skipdiagnostiek', candidate => {
      const diagnostics = candidate.diagnostics as Record<string, unknown>;
      const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
      const resources = views['P-A']!.resources as Record<string, unknown>;
      const issues = resources.issues as Array<Record<string, unknown>>;
      const issue = issues.find(item => item.sourceId === 'AS-A-UNLINKED');
      if (!issue) throw new Error('A8-doelissue ontbreekt');
      issue.line = Number(issue.line) + 1;
    }],
];
for (const [label, expectedRule, mutate] of assignmentSkipCorruptions) {
  const candidate = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
  mutate(candidate);
  let rejection: unknown;
  try { readIFC(ifcWithMetadataPayload(candidate)); }
  catch (error) { rejection = error; }
  truthy(`7d ${label} raakt de specifieke getypeerde assignmentregel`,
    rejection instanceof IfcParseError
    && rejection.reason === 'xer-source-archive'
    && rejection.message.includes(expectedRule));
}

const staleResourceSkipPayload = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
{
  const readModel = staleResourceSkipPayload.readModel as Record<string, unknown>;
  const catalog = readModel.resourceCatalog as Record<string, unknown>;
  const canonicalRows = (catalog.rows as Record<string, unknown>).assignments as Array<Record<string, unknown>>;
  const canonicalRow = canonicalRows.find(row =>
    (row.cells as Record<string, unknown>).taskrsrc_id === 'AS-A-UNLINKED-RESOURCE');
  const diagnostics = staleResourceSkipPayload.diagnostics as Record<string, unknown>;
  const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
  const resources = views['P-A']!.resources as Record<string, unknown>;
  const assignment = (resources.assignments as Array<Record<string, unknown>>)
    .find(item => item.sourceId === 'AS-A-UNLINKED-RESOURCE');
  const issue = (resources.issues as Array<Record<string, unknown>>)
    .find(item => item.sourceId === 'AS-A-UNLINKED-RESOURCE');
  if (!canonicalRow || !assignment || issue?.code !== 'XER_ASSIGNMENT_RESOURCE_MISSING') {
    throw new Error('A9-resourceaanvalsdoel ontbreekt of heeft niet de verwachte uitgangstoestand');
  }
  (canonicalRow.cells as Record<string, unknown>).rsrc_id = 'R-1';
  const rawRow = assignment.rawRow as Record<string, unknown>;
  (rawRow.cells as Record<string, unknown>).rsrc_id = 'R-1';
  assignment.entity = { kind: 'RESOURCE', sourceId: 'R-1', internalId: 'xer-resource:R-1' };
}
let staleResourceSkipRejection: unknown;
try { readIFC(ifcWithMetadataPayload(staleResourceSkipPayload)); }
catch (error) { staleResourceSkipRejection = error; }
truthy('7d A9 canonieke resource bestaat weer maar de oude RESOURCE_MISSING-diagnose blijft specifiek rood',
  staleResourceSkipRejection instanceof IfcParseError
  && staleResourceSkipRejection.reason === 'xer-source-archive'
  && staleResourceSkipRejection.message.includes('TASKRSRC-skipdiagnostiek'));

const missingResourceWithoutIssuePayload = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
{
  const readModel = missingResourceWithoutIssuePayload.readModel as Record<string, unknown>;
  const catalog = readModel.resourceCatalog as Record<string, unknown>;
  const canonicalRows = (catalog.rows as Record<string, unknown>).assignments as Array<Record<string, unknown>>;
  const canonicalRow = canonicalRows.find(row => (row.cells as Record<string, unknown>).taskrsrc_id === 'AS-A');
  const diagnostics = missingResourceWithoutIssuePayload.diagnostics as Record<string, unknown>;
  const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
  const resources = views['P-A']!.resources as Record<string, unknown>;
  const assignment = (resources.assignments as Array<Record<string, unknown>>).find(item => item.sourceId === 'AS-A');
  const issue = (resources.issues as Array<Record<string, unknown>>).find(item => item.sourceId === 'AS-A');
  if (!canonicalRow || !assignment || issue) {
    throw new Error('A10-resourceaanvalsdoel ontbreekt of heeft niet de verwachte uitgangstoestand');
  }
  (canonicalRow.cells as Record<string, unknown>).rsrc_id = 'R-GHOST';
  const rawRow = assignment.rawRow as Record<string, unknown>;
  (rawRow.cells as Record<string, unknown>).rsrc_id = 'R-GHOST';
  assignment.entity = { kind: 'RESOURCE', sourceId: 'R-GHOST', internalId: 'xer-resource:R-GHOST' };
}
let missingResourceWithoutIssueRejection: unknown;
try { readIFC(ifcWithMetadataPayload(missingResourceWithoutIssuePayload)); }
catch (error) { missingResourceWithoutIssueRejection = error; }
truthy('7d A10 canonieke resource ontbreekt nu maar zonder skipdiagnose wordt specifiek rood',
  missingResourceWithoutIssueRejection instanceof IfcParseError
  && missingResourceWithoutIssueRejection.reason === 'xer-source-archive'
  && missingResourceWithoutIssueRejection.message.includes('TASKRSRC-skipdiagnostiek'));

const remoteGhostPayload = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
{
  const diagnostics = remoteGhostPayload.diagnostics as Record<string, unknown>;
  const views = diagnostics.documentViews as Record<string, Record<string, unknown>>;
  const relation = (views['P-A']!.externalRelations as Array<Record<string, unknown>>)[0]!;
  relation.externalTaskId = 'T-B-GHOST';
  views['P-B']!.externalRelations = [];
  for (const projectId of ['P-A', 'P-B']) {
    const link = (views[projectId]!.externalLinks as Array<Record<string, unknown>>)[0]!;
    (link.successor as Record<string, unknown>).taskId = 'T-B-GHOST';
  }
}
let remoteGhostRejection: unknown;
try { readIFC(ifcWithMetadataPayload(remoteGhostPayload)); }
catch (error) { remoteGhostRejection = error; }
truthy('7e A5 coherente externe ghost-taak in een open TASK-project raakt de specifieke endpointregel',
  remoteGhostRejection instanceof IfcParseError
  && remoteGhostRejection.reason === 'xer-source-archive'
  && remoteGhostRejection.message.includes('ontbrekend extern TASK-eindpunt'));

const taskGroupCorruptions: readonly [string, string, (candidate: Record<string, unknown>) => void][] = [
  ['aanwezige TASK-groep is coherent naar een ghost-identiteit gewijzigd',
    'ontbrekende TASK-identiteit', candidate => {
      const readModel = candidate.readModel as Record<string, unknown>;
      const groups = readModel.taskSourceRowsByProject as Record<string, Array<Record<string, unknown>>>;
      const cells = groups['P-A']![0]!.cells as Record<string, unknown>;
      cells.task_id = 'T-A-GHOST';
    }],
  ['aanwezige TASK-groep is buiten zijn bronvolgorde herschikt',
    'staat niet in bronvolgorde', candidate => {
      const readModel = candidate.readModel as Record<string, unknown>;
      const groups = readModel.taskSourceRowsByProject as Record<string, Array<Record<string, unknown>>>;
      [groups['P-A']![0], groups['P-A']![1]] = [groups['P-A']![1]!, groups['P-A']![0]!];
    }],
];
for (const [label, expectedRule, mutate] of taskGroupCorruptions) {
  const candidate = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
  mutate(candidate);
  let rejection: unknown;
  try { readIFC(ifcWithMetadataPayload(candidate)); }
  catch (error) { rejection = error; }
  truthy(`7f ${label} raakt de specifieke TASK-bronregel`,
    rejection instanceof IfcParseError
    && rejection.reason === 'xer-source-archive'
    && rejection.message.includes(expectedRule));
}

const invalidUtf8Payload = JSON.parse(new TextDecoder().decode(diagnosticBytes)) as Record<string, unknown>;
const invalidUtf8 = new TextEncoder().encode(JSON.stringify(invalidUtf8Payload));
const currencyNeedle = new TextEncoder().encode('"currencyCode":"EUR"');
const currencyOffset = invalidUtf8.findIndex((_byte, index) =>
  currencyNeedle.every((needleByte, needleIndex) => invalidUtf8[index + needleIndex] === needleByte));
if (currencyOffset < 0) throw new Error('UTF-8-testdoel currencyCode ontbreekt');
invalidUtf8[currencyOffset + '"currencyCode":"'.length] = 0xff;
truthy('7g niet-fatale controlemeter toont dat 0xff als U+FFFD geldige JSON zou blijven', (() => {
  try {
    const decoded = new TextDecoder().decode(invalidUtf8);
    return decoded.includes('\ufffdUR') && JSON.parse(decoded) !== null;
  } catch { return false; }
})());
let invalidUtf8Rejected = false;
try { readIFC(ifcWithMetadataBytes(invalidUtf8)); }
catch (error) { invalidUtf8Rejected = error instanceof IfcParseError && error.reason === 'xer-source-archive'; }
truthy('7h correct gehashte diagnostics met ongeldige UTF-8 wordt getypeerd geweigerd', invalidUtf8Rejected);

const toUtf16 = (text: string, endian: 'le' | 'be') => {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes.set(endian === 'le' ? [0xff, 0xfe] : [0xfe, 0xff]);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[2 + index * 2 + (endian === 'le' ? 0 : 1)] = code & 0xff;
    bytes[2 + index * 2 + (endian === 'le' ? 1 : 0)] = code >>> 8;
  }
  return bytes;
};
const sourceText = new TextDecoder().decode(source);
for (const endian of ['le', 'be'] as const) {
  const encoded = toUtf16(sourceText, endian);
  const utfOpened = readXER(encoded);
  if (!isMultiDocumentImport(utfOpened)) throw new Error(`UTF-16${endian.toUpperCase()}-fixture moet multi-project zijn`);
  const firstIfcRead = readIFC(writeIFC(utfOpened.results[0]!));
  const secondIfcRead = readIFC(writeIFC(firstIfcRead));
  equal(`8 UTF-16${endian.toUpperCase()} XER→IFC→IFC bewaart presentatie en bytes`, {
    encoding: secondIfcRead.xerSourceArchive?.encoding,
    bom: secondIfcRead.xerSourceArchive?.bom,
    newline: secondIfcRead.xerSourceArchive?.newline,
    bytes: secondIfcRead.xerSourceArchive
      ? sha256Hex(decodeXerSourceArchive(secondIfcRead.xerSourceArchive))
      : null,
  }, {
    encoding: endian === 'le' ? 'utf-16le' : 'utf-16be',
    bom: endian === 'le' ? 'utf-16le' : 'utf-16be',
    newline: 'crlf',
    bytes: sha256Hex(encoded),
  });
}

const store = () => useAppStore.getState();
store().newProject();
store().applyOpenedImport(opened, {
  filePath: null, fileHandle: null, recompute: false, fit: false,
  hourDataNotice: false, linkedOpen: false,
});
store().duplicateDocument();
for (let index = 0; index < 100; index += 1) store().setProject({ description: `readmodel-${index}` });
for (let index = 0; index < 100; index += 1) store().undo();
for (let index = 0; index < 100; index += 1) store().redo();
const tabPayloads = store().getOpenDocumentPayloads();
truthy('9 projecttabs, duplicate en 100 undo/redo delen één archive/readmodel/catalogusgrafiek',
  tabPayloads.length === 3
  && new Set(tabPayloads.map(document => document.payload.xerSourceArchive)).size === 1
  && tabPayloads.every(document =>
    document.payload.xerImportMetadata?.resources?.catalog === archive.readModel?.resourceCatalog
    && document.payload.xerImportMetadata?.metadata?.catalog === archive.readModel?.metadataCatalog));
truthy('9a duplicate houdt exact dezelfde X5-filecache en bronrijrefs',
  tabPayloads.every(document => document.payload.xerImportMetadata?.scheduleOptions.sourceArchive
    === archive.readModel?.scheduleOptionsSourceArchive
    && document.payload.xerImportMetadata.scheduleOptions.sourceRows.every((row, index) =>
      row === document.payload.xerImportMetadata?.scheduleOptions.sourceArchive.rows[
        document.payload.xerImportMetadata.scheduleOptions.sourceRowIndexes[index]!
      ])));
const recoveredInputs = tabPayloads.map((document, index) => {
  const parsed = readIFC(writeIFC(buildWriteIFCInput(document.payload)));
  return recoveryInputFromParsed(parsed, { id: `readmodel-recovery-${index}`, filePath: null, isDirty: true });
});
store().restoreDocuments(recoveredInputs, recoveredInputs[0]!.id);
const recoveredPayloads = store().getOpenDocumentPayloads();
const recoveredArchive = recoveredPayloads[0]?.payload.xerSourceArchive;
truthy('10 IFC-per-document→readIFC→recovery herstelt één bruikbare gedeelde catalogusgrafiek',
  recoveredPayloads.length === 3
  && recoveredArchive !== null
  && new Set(recoveredPayloads.map(document => document.payload.xerSourceArchive)).size === 1
  && recoveredPayloads.every(document =>
    document.payload.xerImportMetadata?.resources?.catalog === recoveredArchive?.readModel.resourceCatalog
    && document.payload.xerImportMetadata?.metadata?.catalog === recoveredArchive?.readModel.metadataCatalog));
truthy('10a recovery bindt alle projectprovenance aan de canonieke selectorview en X5-cache',
  recoveredPayloads.every(document => {
    const metadata = document.payload.xerImportMetadata;
    const selector = metadata?.sourceProjectId;
    const view = selector ? recoveredArchive?.diagnostics.documentViews[selector] : undefined;
    return metadata !== null && metadata.resources !== undefined && view?.resources !== undefined
      && metadata.resources.assignments === view.resources.assignments
      && metadata.resources.issues === view.resources.issues
      && metadata.scheduleOptions.sourceArchive === recoveredArchive?.readModel.scheduleOptionsSourceArchive
      && metadata.scheduleOptions.sourceRows.every((row, index) =>
        row === recoveredArchive?.readModel.scheduleOptionsSourceArchive.rows[
          metadata.scheduleOptions.sourceRowIndexes[index]!
        ]);
  }));

const missingSelectorArchive = recoveredArchive;
let missingSelectorRejected = false;
if (missingSelectorArchive && recoveredInputs[0]) {
  try {
    store().restoreDocuments([{
      ...recoveredInputs[0],
      id: 'missing-selector-view',
      xerSourceArchive: missingSelectorArchive,
      xer: recoveredInputs[0].xer ? { ...recoveredInputs[0].xer, sourceProjectId: 'ONTBREEKT' } : undefined,
      xerSourceProjectId: 'ONTBREEKT',
    }], 'missing-selector-view');
  } catch (error) {
    missingSelectorRejected = error instanceof XerSourceArchiveValidationError;
  }
}
truthy('10b recovery weigert een ontbrekende selectorview hard en getypeerd', missingSelectorRejected);

if (failures.length === 0) {
  console.log(`OK  xer-archive-readmodel: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-archive-readmodel: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
