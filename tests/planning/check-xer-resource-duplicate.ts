/**
 * X6/storecontract: documentduplicatie kloont de mutable projectview, maar materialiseert de
 * bestandsbrede immutable XER-catalogus en haar ruwe rijen niet opnieuw.
 */
import { createAppStore } from '@/state/appStore';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function present<T>(label: string, value: T | null | undefined): value is T {
  checks++;
  if (value === null || value === undefined) {
    diffs.push(`${label}: verplichte testdata ontbreekt`);
    return false;
  }
  return true;
}

const RAW_ASSIGNMENT_COUNT = 52_640;

function largeSyntheticXer(): Uint8Array {
  const lines = [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tdef_duration_type\tlast_recalc_date',
    '%R\tP1\tGrote duplicatieproef\tCP\tDT_FixedDUR2\t2026-01-01',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_name\ttask_code\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tstatus_code',
    '%R\tT1\tP1\tTaak\tA1\t2026-01-01\t2026-01-02\t8\tTT_Task\tTK_NotStart',
    '%T\tRSRC',
    '%F\trsrc_id\trsrc_name\trsrc_type\tdef_qty_per_hr',
    '%R\tR1\tVakman\tRT_Labor\t1',
    '%T\tTASKRSRC',
    '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\ttarget_qty_per_hr\tremain_qty\ttarget_cost',
    '%R\tA-PROJECT\tP1\tT1\tR1\t0.5\t4\t100',
  ];
  for (let index = 1; index < RAW_ASSIGNMENT_COUNT; index++) {
    lines.push(`%R\tA-RETAINED-${index}\tB9\tTB-${index}\tR1\t1\t8\t10`);
  }
  lines.push('%E');
  return new TextEncoder().encode(lines.join('\n'));
}

const parsed = readXER(largeSyntheticXer());
if (isMultiDocumentImport(parsed)) {
  diffs.push('X6-storefixture hoort één projectdocument op te leveren');
} else {
  const store = createAppStore();
  store.getState().applyLoadedProject(parsed, {
    filePath: null,
    fileHandle: null,
    recompute: false,
    fit: false,
    hourDataNotice: false,
    linkedOpen: true,
  });
  const sourceDocumentId = store.getState().activeDocumentId;
  const sourceMetadata = store.getState().xerImportMetadata;
  const sourceResources = sourceMetadata?.resources;
  const sourceCatalog = sourceResources?.catalog;
  const sourceProjectAssignment = sourceResources?.assignments.find(source => source.sourceId === 'A-PROJECT');
  const sourceRawRow = sourceCatalog?.rows.assignments.find(row => row.cells.taskrsrc_id === 'A-PROJECT');
  const sourceLastRawRow = sourceCatalog?.rows.assignments[RAW_ASSIGNMENT_COUNT - 1];

  eq('X6-storefixture valideert eerst catalogusomvang en projectview', {
    rawRows: sourceCatalog?.rows.assignments.length,
    projectSources: sourceResources?.assignments.map(source => source.sourceId),
    domainAssignments: store.getState().assignments.map(assignment => assignment.id),
  }, {
    rawRows: RAW_ASSIGNMENT_COUNT,
    projectSources: ['A-PROJECT'],
    domainAssignments: ['xer-assignment:A-PROJECT'],
  });

  if (present('X6-storefixture heeft broncatalogus', sourceCatalog)
    && present('X6-storefixture heeft projectassignmentbron', sourceProjectAssignment)
    && present('X6-storefixture heeft eerste raw projectrij', sourceRawRow)
    && present('X6-storefixture heeft laatste retained raw rij', sourceLastRawRow)) {
    const duplicateId = store.getState().duplicateDocument('Grote duplicatieproef — kopie');
    const duplicateMetadata = store.getState().xerImportMetadata;
    const duplicateResources = duplicateMetadata?.resources;
    const duplicateProjectAssignment = duplicateResources?.assignments.find(source => source.sourceId === 'A-PROJECT');
    const parkedSource = store.getState().documents.find(entry => entry.id === sourceDocumentId)?.payload;

    eq('duplicateDocument behoudt één file-wide catalogus en alle raw-rowidentiteiten', {
      duplicateActive: store.getState().activeDocumentId === duplicateId,
      sourceCatalog: parkedSource?.xerImportMetadata?.resources?.catalog === sourceCatalog,
      duplicateCatalog: duplicateResources?.catalog === sourceCatalog,
      firstRaw: duplicateResources?.catalog.rows.assignments[0] === sourceCatalog.rows.assignments[0],
      projectRaw: duplicateProjectAssignment?.rawRow === sourceRawRow,
      lastRaw: duplicateResources?.catalog.rows.assignments[RAW_ASSIGNMENT_COUNT - 1] === sourceLastRawRow,
    }, {
      duplicateActive: true,
      sourceCatalog: true,
      duplicateCatalog: true,
      firstRaw: true,
      projectRaw: true,
      lastRaw: true,
    });

    eq('duplicateDocument kloont uitsluitend documentgebonden mutable XER-metadata', {
      metadataCloned: duplicateMetadata !== sourceMetadata,
      resourceMetadataCloned: duplicateResources !== sourceResources,
      assignmentArrayCloned: duplicateResources?.assignments !== sourceResources?.assignments,
      assignmentCloned: duplicateProjectAssignment !== sourceProjectAssignment,
      entityCloned: duplicateProjectAssignment?.entity !== sourceProjectAssignment.entity,
      quantitiesCloned: duplicateProjectAssignment?.quantities !== sourceProjectAssignment.quantities,
      costsCloned: duplicateProjectAssignment?.costs !== sourceProjectAssignment.costs,
      rawCurvesCloned: duplicateProjectAssignment?.rawCurves !== sourceProjectAssignment.rawCurves,
    }, {
      metadataCloned: true,
      resourceMetadataCloned: true,
      assignmentArrayCloned: true,
      assignmentCloned: true,
      entityCloned: true,
      quantitiesCloned: true,
      costsCloned: true,
      rawCurvesCloned: true,
    });
  }
}

if (diffs.length > 0) {
  console.error(`XX X6 duplicateDocument (${checks} checks)\n${diffs.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`OK X6 duplicateDocument (${checks} checks)`);
}
