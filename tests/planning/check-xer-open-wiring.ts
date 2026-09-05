import { parseOpenedFile } from '@/services/formatRegistry';
import { isMultiDocumentImport } from '@/services/importTypes';
import type { XerMultiProjectImport } from '@/services/xer/xerMultiProject';
import { useAppStore } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
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

// ── XER-etappeplan §3.5/§3.7/§3.10, taak T4 — standaard-aan bij het laden + de melding ─────────
// Corpusloos, draait altijd. Één taak per project, target ver uiteen van het early-orakel ⇒
// gegarandeerd één verschoven taak — geen calendar-/uurmodus-fijnrekenwerk nodig.
{
  const restXerBytes = (projId: string, taskId: string, taskCode: string) => [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandaard\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    `%R\t${projId}\tRestverschillen\tC1\t2026-01-01`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    `%R\t${taskId}\t${projId}\tC1\t${taskCode}\tTaak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-02-01\t2026-02-08\t2026-02-01\t2026-02-08\t0\t0`,
    '%E',
  ].join('\n');
  const noRecordedXerBytes = (projId: string, taskId: string, taskCode: string) => [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandaard\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    `%R\t${projId}\tZonderOrakel\tC1\t2026-01-01`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    `%R\t${taskId}\t${projId}\tC1\t${taskCode}\tTaak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09`,
    '%E',
  ].join('\n');

  const single = await parseOpenedFile({ name: 't4-rest.xer', bytes: new TextEncoder().encode(restXerBytes('PX', 'TX', 'AX')) });
  if (isMultiDocumentImport(single)) throw new Error('T4-restfixture moet enkelproject zijn');
  eq('T4-1 recordedTimesOrigin is xer', single.recordedTimesOrigin, 'xer');

  useAppStore.getState().newDocument();
  const undoBefore = useAppStore.getState().historyEvents.filter((e) => e.state === 'applied').length;
  // ID-diff i.p.v. lengte-delta: `notify()` begrenst de stapel (MAX_NOTIFICATIONS) en verdringt
  // dan de OUDSTE info-melding — bij een volle stapel verandert `.length` dus niet, terwijl er wél
  // een nieuwe melding bij kwam. Een set van bestaande id's blijft correct ongeacht verdringing.
  const notifBefore = new Set(useAppStore.getState().ui.notifications.map((n) => n.id));
  useAppStore.getState().applyOpenedImport(single, { filePath: null, recompute: true });

  eq('T4-2 corpusloze XER met restverschillen opent MET de modus aan', useAppStore.getState().datesAsRecorded, true);
  eq('T4-3 scheduleStale blijft false in de modus (risico §5.1)', useAppStore.getState().scheduleStale, false);
  ok('T4-4 recordedDates is gevuld', useAppStore.getState().recordedDates !== null);
  eq('T4-5 shifted telt de enige taak', useAppStore.getState().recordedDates?.shifted, 1);
  eq('T4-6 het laden pusht geen undo-snapshot',
    useAppStore.getState().historyEvents.filter((e) => e.state === 'applied').length, undoBefore);

  const notifsAfterSingle = useAppStore.getState().ui.notifications.filter((n) => !notifBefore.has(n.id));
  eq('T4-7 precies één melding voor dit bestand', notifsAfterSingle.length, 1);
  const singleDetail = notifsAfterSingle[0]?.detailLines
    ?.find((d) => d.messageKey === 'notifications.xerImportDatesAsRecorded');
  ok('T4-8 de melding noemt "datums zoals opgeslagen"', singleDetail);
  eq('T4-9 …met het juiste aantal afwijkende taken', singleDetail?.params?.count, 1);

  useAppStore.getState().undo();
  eq('T4-10 undo() direct na het laden raakt de modus niet (er is niets om naar terug te gaan)',
    useAppStore.getState().datesAsRecorded, true);

  // Tegenproef: een XER zónder enige P6-rekenuitvoer opent volledig normaal — geen aanbod, geen modus.
  const clean = await parseOpenedFile({ name: 't4-clean.xer', bytes: new TextEncoder().encode(noRecordedXerBytes('PZ', 'TZ', 'AZ')) });
  if (isMultiDocumentImport(clean)) throw new Error('T4-cleanfixture moet enkelproject zijn');
  eq('T4-11 fixture zonder P6-uitvoer draagt een lege recordedTimes-map (geen enkele taak met early-paar)', clean.recordedTimes, {});
  useAppStore.getState().newDocument();
  useAppStore.getState().applyOpenedImport(clean, { filePath: null, recompute: true });
  eq('T4-12 XER zonder P6-rekenuitvoer opent normaal: modus uit', useAppStore.getState().datesAsRecorded, false);
  eq('T4-13 …en geen aanbod', useAppStore.getState().recordedDates, null);

  // Multi-project: twee zelfstandige XER-projecten, elk met een eigen restverschil ⇒ twee
  // ONAFHANKELIJKE modusvlaggen, maar de MELDING blijft er één per bestand (plan §3.7 punt 1).
  const twoProjBytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandaard\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    '%R\tPA\tProjectA\tC1\t2026-01-01',
    '%R\tPB\tProjectB\tC1\t2026-01-01',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    '%R\tTA\tPA\tC1\tAA\tTaakA\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-02-01\t2026-02-08\t2026-02-01\t2026-02-08\t0\t0',
    '%R\tTB\tPB\tC1\tAB\tTaakB\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-03-02\t2026-03-09\t2026-04-01\t2026-04-08\t2026-04-01\t2026-04-08\t0\t0',
    '%E',
  ].join('\n'));
  const twoProj = await parseOpenedFile({ name: 't4-twee-projecten.xer', bytes: twoProjBytes });
  if (!isMultiDocumentImport(twoProj)) throw new Error('T4-multifixture moet meervoudig zijn');
  const notifBeforeMulti = new Set(useAppStore.getState().ui.notifications.map((n) => n.id));
  const openedMulti = useAppStore.getState().applyOpenedImport(twoProj, { filePath: null, recompute: true });
  eq('T4-14 twee projecten geven twee documenten', openedMulti.documentIds.length, 2);
  const openedDocs = useAppStore.getState().getOpenDocumentPayloads()
    .filter((d) => openedMulti.documentIds.includes(d.id));
  eq('T4-15 twee documenten, elk zijn EIGEN modusvlag aan',
    openedDocs.map((d) => d.payload.datesAsRecorded), [true, true]);
  eq('T4-16 elk document telt zijn eigen verschoven taak (1 elk)',
    openedDocs.map((d) => d.payload.recordedDates?.shifted), [1, 1]);
  const notifsAfterMulti = useAppStore.getState().ui.notifications.filter((n) => !notifBeforeMulti.has(n.id));
  eq('T4-17 twee documenten ⇒ TOCH precies één melding (niet twee)', notifsAfterMulti.length, 1);
  const multiDetail = notifsAfterMulti[0]?.detailLines
    ?.find((d) => d.messageKey === 'notifications.xerImportDatesAsRecorded');
  eq('T4-18 …de teller is de SOM over beide documenten (1+1=2), niet per document',
    multiDetail?.params?.count, 2);

  // MUTATIEBEWIJS (O6-patroon): zet `recordedTimesOrigin` NIET ⇒ de modus blijft UIT, ook al is
  // exact dezelfde vastlegging (`recordedTimes`) aanwezig. Bewijst dat de auto-aan-route
  // uitsluitend op de herkomstvlag draait — en dus dat IFC/CSV/MSPDI/MPP/P6XML (die dit veld nooit
  // zetten) byte-identiek #63-gedrag houden.
  const singleAgain = await parseOpenedFile({ name: 't4-rest-2.xer', bytes: new TextEncoder().encode(restXerBytes('PX2', 'TX2', 'AX2')) });
  if (isMultiDocumentImport(singleAgain)) throw new Error('T4-restfixture (2) moet enkelproject zijn');
  const singleWithoutOrigin = { ...singleAgain, recordedTimesOrigin: undefined };
  useAppStore.getState().newDocument();
  useAppStore.getState().applyLoadedProject(singleWithoutOrigin, { filePath: null, recompute: true });
  eq('T4-19 zonder recordedTimesOrigin blijft de modus UIT (O6-mutatiebewijs)', useAppStore.getState().datesAsRecorded, false);
  ok('T4-20 …maar het aanbod verschijnt nog gewoon (recordedDates gevuld)', useAppStore.getState().recordedDates !== null);
  eq('T4-21 …met dezelfde teller als de aan-route', useAppStore.getState().recordedDates?.shifted, 1);
}

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

  // XER-etappeplan §4/T4, acceptatie: "een corpus-XER met restverschillen opent MET de modus aan;
  // een XER zonder verschillen opent normaal" — met ECHTE corpusbestanden, niet alleen de
  // corpusloze fixtures hierboven. `rehab-2.xer` (project 761, gemeten in de X-O7-bijstelling: 813
  // van 6.976 vastgelegde taken wijken ná de solve nog af) en `p6diff-baseline.xer` (8 vastgelegde
  // taken, gemeten: 0 wijken af — dit bestand won onderweg mee met de laag-1-fixes op main).
  const openSingle = async (relativePath: string) => {
    const bytes = new Uint8Array(readFileSync(join(corpusRoot, relativePath)));
    const opened = await parseOpenedFile({ name: relativePath, bytes });
    if (isMultiDocumentImport(opened)) throw new Error(`${relativePath}: verwacht een enkelvoudige XER-import`);
    return opened;
  };

  const rehab = await openSingle('crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer');
  useAppStore.getState().newDocument();
  useAppStore.getState().applyOpenedImport(rehab, { filePath: null, recompute: true });
  eq('12 rehab-2.xer (échte restverschillen) opent MET de modus aan', useAppStore.getState().datesAsRecorded, true);
  ok('13 …met een gevulde recordedDates', useAppStore.getState().recordedDates !== null);
  ok('14 …en minstens één verschoven taak', (useAppStore.getState().recordedDates?.shifted ?? 0) > 0);
  console.log(`.   T4 rehab-2.xer: shifted=${useAppStore.getState().recordedDates?.shifted} total=${useAppStore.getState().recordedDates?.total}`);

  const p6diff = await openSingle('crawl-xer/p6diff-baseline.xer');
  useAppStore.getState().newDocument();
  useAppStore.getState().applyOpenedImport(p6diff, { filePath: null, recompute: true });
  ok('15 voorwaarde: p6diff-baseline.xer draagt écht recordedTimes', (p6diff.recordedTimes && Object.keys(p6diff.recordedTimes).length > 0));
  eq('16 p6diff-baseline.xer (0 restverschillen) opent NORMAAL: modus uit', useAppStore.getState().datesAsRecorded, false);
  eq('17 …en geen aanbod (de vastgelegde datums kwamen exact uit de solve)', useAppStore.getState().recordedDates, null);
} else {
  console.log('OK  XER-open-wiring: openbare baseline- en 15-projectenpins overgeslagen (OPS_XER_CORPUS)');
}

if (diffs.length > 0) {
  console.error(`XER-open-wiring: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-open-wiring: alle ${checks} centrale open/document/recovery-checks groen`);
