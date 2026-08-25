import { parseOpenedFile } from '@/services/formatRegistry';
import { isMultiDocumentImport } from '@/services/importTypes';
import type { XerMultiProjectImport } from '@/services/xer/xerMultiProject';
import { useAppStore } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function ok(label: string, value: unknown): void {
  eq(label, Boolean(value), true);
}

const source = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-25\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_data',
  '%R\tC1\tStandaard\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tsum_base_proj_id',
  '%R\tMAIN\tHoofd\tC1\t2026-01-01 08:00\tBASE',
  '%R\tBASE\tNulmeting\tC1\t2026-01-01 08:00\t',
  '%R\tOTHER\tGrootste\tC1\t2026-01-01 08:00\t',
  '%R\tEMPTY\tLeeg\tC1\t2026-01-01 08:00\t',
  '%R\tDANGLING\tLos\tC1\t2026-01-01 08:00\tVERDWENEN',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
  '%R\tM1\tMAIN\tM1\tHoofdtaak\t2026-01-02 08:00\t2026-01-02 16:00',
  '%R\tB1\tBASE\tM1\tNulmetingstaak\t2025-12-02 08:00\t2025-12-02 16:00',
  '%R\tO1\tOTHER\tO1\tEerste\t2026-01-03 08:00\t2026-01-03 16:00',
  '%R\tO2\tOTHER\tO2\tTweede\t2026-01-04 08:00\t2026-01-04 16:00',
  '%R\tD1\tDANGLING\tD1\tLosse taak\t2026-01-05 08:00\t2026-01-05 16:00',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR-CROSS\tO1\tM1\tOTHER\tMAIN\tPR_FS\t0',
  '%E',
].join('\n'));

const parsed = await parseOpenedFile({ name: 'meerdere.xer', bytes: source });
ok('1 readXER retourneert bij meerdere PROJECT-rijen de meervoudige returnvorm',
  isMultiDocumentImport(parsed));
if (!isMultiDocumentImport(parsed)) {
  throw new Error('XER-meerprojectfixture leverde geen meervoudige import op');
}
const multi = parsed as XerMultiProjectImport;
eq('2 lezer behoudt selectie-, baseline- en danglingtellingen', multi.report, {
  projectsSeen: 5,
  documentsOpened: 3,
  emptyProjectsSkipped: 1,
  baselineProjectsExcluded: 1,
  baselinesMaterialized: 1,
  danglingBaselineReferences: 1,
  externalLinksPreserved: 1,
  baselineExclusionReverted: false,
  baselineFallbackReasons: [],
});
eq('3 actieve import is het project met de meeste bladtaken', multi.activeDocumentIndex, 1);

const store = useAppStore.getState();
// Het startdocument is vers en mag voor het eerste geopende project worden hergebruikt.
store.applyOpenedImport(multi, {
  filePath: null,
  fileHandle: null,
  recompute: true,
  fit: true,
  hourDataNotice: true,
  linkedOpen: true,
});

const after = useAppStore.getState();
const docs = after.getOpenDocumentPayloads();
eq('4 echte openroute hergebruikt pristine tab en opent de overige projecten los', {
  documentCount: docs.length,
  ids: docs.map(document => document.payload.project.id),
  active: after.project.id,
}, {
  documentCount: 3,
  ids: ['MAIN', 'OTHER', 'DANGLING'],
  active: 'OTHER',
});
eq('5 ieder XER-document is schoon en heeft nooit het bronbestand als save-target',
  docs.map(document => ({
    id: document.payload.project.id,
    dirty: document.payload.isDirty,
    filePath: document.payload.filePath,
    fileHandle: document.payload.fileHandle,
  })), [
    { id: 'MAIN', dirty: false, filePath: null, fileHandle: null },
    { id: 'OTHER', dirty: false, filePath: null, fileHandle: null },
    { id: 'DANGLING', dirty: false, filePath: null, fileHandle: null },
  ]);
eq('6 baseline is documentgebonden en de andere projecten erven haar niet',
  docs.map(document => ({
    id: document.payload.project.id,
    activeBaselineId: document.payload.activeBaselineId,
    baselines: document.payload.baselines.map(baseline => baseline.id),
  })), [
    { id: 'MAIN', activeBaselineId: 'xer-baseline:MAIN:BASE', baselines: ['xer-baseline:MAIN:BASE'] },
    { id: 'OTHER', activeBaselineId: null, baselines: [] },
    { id: 'DANGLING', activeBaselineId: null, baselines: [] },
  ]);
ok('7 documentpayloads delen geen mutabele project- of taakobjecten',
  docs.length >= 2
  && docs[0].payload.project !== docs[1].payload.project
  && docs[0].payload.tasks !== docs[1].payload.tasks
  && docs[0].payload.calendar !== docs[1].payload.calendar);
eq('8 elk geopend document kan onafhankelijk als IFC recoverypayload rond-tripen',
  docs.map(document => {
    const roundTripped = readIFC(writeIFC(buildWriteIFCInput(document.payload)));
    return {
      name: roundTripped.project.name,
      baselines: roundTripped.baselines?.map(baseline => baseline.id) ?? [],
    };
  }), [
    { name: 'Hoofd', baselines: ['xer-baseline:MAIN:BASE'] },
    { name: 'Grootste', baselines: [] },
    { name: 'Los', baselines: [] },
  ]);

const linkIds = (metadata: typeof docs[number]['payload']['xerImportMetadata']) =>
  metadata?.externalLinks.map(link => link.id) ?? [];
eq('8a geconsolideerde cross-documentlink hangt exact aan beide betrokken documenten',
  docs.map(document => ({
    projectId: document.payload.project.id,
    links: linkIds(document.payload.xerImportMetadata),
    solverSequences: document.payload.sequences.map(sequence => sequence.id),
    taskLinks: document.payload.tasks.flatMap(task => task.externalLinks ?? []).length,
  })), [
    { projectId: 'MAIN', links: ['R-CROSS'], solverSequences: [], taskLinks: 0 },
    { projectId: 'OTHER', links: ['R-CROSS'], solverSequences: [], taskLinks: 0 },
    { projectId: 'DANGLING', links: [], solverSequences: [], taskLinks: 0 },
  ]);
ok('8b betrokken documenten delen geen mutable externalLinks-array',
  docs.length >= 2
    && docs[0].payload.xerImportMetadata?.externalLinks
    !== docs[1].payload.xerImportMetadata?.externalLinks);

const mainDocumentId = docs.find(document => document.payload.project.id === 'MAIN')?.id;
const otherDocumentId = docs.find(document => document.payload.project.id === 'OTHER')?.id;
ok('8c MAIN en OTHER bestaan beide als schakelbare documenten', mainDocumentId && otherDocumentId);
if (mainDocumentId && otherDocumentId) {
  after.switchDocument(mainDocumentId);
  eq('8d documentwissel hydrateert de eigen geconsolideerde XER-links',
    linkIds(useAppStore.getState().xerImportMetadata), ['R-CROSS']);
  after.switchDocument(otherDocumentId);
  const linksBeforeUndo = JSON.stringify(linkIds(useAppStore.getState().xerImportMetadata));
  useAppStore.getState().setProject({ description: 'Undo-proef zonder brondatawijziging' });
  useAppStore.getState().undo();
  eq('8e gewone bewerking plus undo laat documentgebonden XER-links exact intact',
    JSON.stringify(linkIds(useAppStore.getState().xerImportMetadata)), linksBeforeUndo);
}

// X4b kan de metadata al door het document-/recovery-inputcontract dragen. De daadwerkelijke
// IFC-serialisatie van `xerImportMetadata.externalLinks` blijft bewust de geregistreerde X9-taak.
const recoveryDocs = docs.map(({ id, payload }) => ({
  id,
  filePath: payload.filePath,
  isDirty: payload.isDirty,
  project: payload.project,
  calendar: payload.calendar,
  tasks: payload.tasks,
  sequences: payload.sequences,
  resources: payload.resources,
  assignments: payload.assignments,
  resourceCalendars: payload.calendars,
  activityCodeTypes: payload.activityCodeTypes,
  customFieldDefs: payload.customFieldDefs,
  baselines: payload.baselines,
  activeBaselineId: payload.activeBaselineId,
  xer: payload.xerImportMetadata ?? undefined,
}));
useAppStore.getState().restoreDocuments(recoveryDocs, otherDocumentId ?? null);
eq('8f recovery-inputoverdracht herstelt links per document zonder solverdoorwerking',
  useAppStore.getState().getOpenDocumentPayloads().map(document => ({
    projectId: document.payload.project.id,
    links: linkIds(document.payload.xerImportMetadata),
    sequences: document.payload.sequences.map(sequence => sequence.id),
  })), [
    { projectId: 'MAIN', links: ['R-CROSS'], sequences: [] },
    { projectId: 'OTHER', links: ['R-CROSS'], sequences: [] },
    { projectId: 'DANGLING', links: [], sequences: [] },
  ]);

const corpusRoot = process.env.OPS_XER_CORPUS;
if (corpusRoot && existsSync(corpusRoot)) {
  const openPublicXer = async (relativePath: string) => {
    const bytes = new Uint8Array(readFileSync(join(corpusRoot, relativePath)));
    const opened = await parseOpenedFile({ name: relativePath, bytes });
    if (!isMultiDocumentImport(opened)) throw new Error(`${relativePath}: verwacht een meervoudige XER-import`);
    return opened as XerMultiProjectImport;
  };

  const stack = await openPublicXer('crawl-xer/stack_data_center_baseline.xer');
  eq('9 openbare baselinefixture levert één document met een OPS-baseline', {
    documents: stack.results.length,
    baselines: stack.results[0]?.baselines?.length,
    active: stack.results[0]?.activeBaselineId === stack.results[0]?.baselines?.[0]?.id,
  }, { documents: 1, baselines: 1, active: true });

  const ozbStarted = performance.now();
  const ozbHeapBefore = process.memoryUsage().heapUsed;
  const ozb = await openPublicXer('crawl-xer/eh_P6Workshops/OZB-Start-09Dec24.xer');
  const openedBefore = useAppStore.getState().getOpenDocumentPayloads().length;
  useAppStore.getState().applyOpenedImport(ozb, {
    filePath: null,
    fileHandle: null,
    recompute: true,
    fit: true,
    hourDataNotice: true,
    linkedOpen: true,
  });
  const ozbElapsedMs = performance.now() - ozbStarted;
  const ozbHeapDeltaBytes = process.memoryUsage().heapUsed - ozbHeapBefore;
  const openedAfter = useAppStore.getState().getOpenDocumentPayloads();
  eq('10 openbare 15-projectenfixture gaat door de echte openroute als 12 losse documenten', {
    projects: ozb.report.projectsSeen,
    documents: ozb.results.length,
    empty: ozb.report.emptyProjectsSkipped,
    dangling: ozb.report.danglingBaselineReferences,
    addedTabs: openedAfter.length - openedBefore,
    activeProjectId: useAppStore.getState().project.id,
    expectedActiveProjectId: ozb.results[ozb.activeDocumentIndex]?.project.id,
  }, {
    projects: 15,
    documents: 12,
    empty: 3,
    dangling: 9,
    addedTabs: 12,
    activeProjectId: ozb.results[ozb.activeDocumentIndex]?.project.id,
    expectedActiveProjectId: ozb.results[ozb.activeDocumentIndex]?.project.id,
  });
  ok('11 openbare 15-projecten-openroute meet eindige tijd en heapdelta',
    Number.isFinite(ozbElapsedMs) && Number.isFinite(ozbHeapDeltaBytes));
  console.log(`.   X4b-wiring openbaar: 15→${ozb.results.length} leeg=${ozb.report.emptyProjectsSkipped} dangling=${ozb.report.danglingBaselineReferences} elapsedMs=${ozbElapsedMs.toFixed(1)} heapDeltaBytes=${ozbHeapDeltaBytes}`);
} else {
  console.log('OK  XER-open-wiring: openbare baseline- en 15-projectenpins overgeslagen (OPS_XER_CORPUS)');
}

if (diffs.length > 0) {
  console.error(`XER-open-wiring: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-open-wiring: alle ${checks} centrale open/document/recovery-checks groen`);
