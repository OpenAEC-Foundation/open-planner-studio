import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { isMultiDocumentImport } from '@/services/importTypes';
import type { XerScheduleOptionsMetadata } from '@/services/xer/xerScheduleOptions';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import {
  expectedXerScheduleOptions,
  scanRawXerScheduleOptions,
} from './xerScheduleOptionsGroundTruth';

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

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

function scheduleMetadata(result: XerReadResult): XerScheduleOptionsMetadata {
  return result.xer.scheduleOptions;
}

function legacyMetadata(metadata: XerScheduleOptionsMetadata) {
  return {
    source: metadata.source,
    retainedSource: metadata.retainedSource,
    fallbacks: metadata.fallbacks,
    sourceRows: metadata.sourceRows,
  };
}

function openedProjects(source: Uint8Array): XerReadResult[] {
  const opened = readXER(source);
  return isMultiDocumentImport(opened)
    ? opened.results as XerReadResult[]
    : [opened];
}

const multiSource = bytes([
  'ERMHDR\t23.12\t2026-08-25\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC4\tVier uur\t4\t20\t',
  '%R\tC8\tAcht uur\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tcritical_path_type\tcritical_drtn_hr_cnt',
  '%R\tP-A\tProject A\tC4\t2026-01-05 08:00\tCT_TotFloat\t8',
  '%R\tP-B\tProject B\tC8\t2026-01-05 08:00\tCT_DrivPath\t0',
  '%T\tSCHEDOPTIONS',
  '%F\tproj_id\tsched_calendar_on_relationship_lag\tsched_float_type\tsched_retained_logic\tsched_progress_override\tsched_open_critical_flag\tsched_use_expect_end_flag\tsched_use_project_end_date_for_float\tlevelprioritylist\tschedhash',
  '%R\tP-A\trcal_Successor\tft_ss\tN\tY\tY\tN\tY\tA-RAW\tHASH-A',
  '%R\tP-B\tRCAL_24Hour\tST_TotalFloat\tY\tN\tN\tY\tN\tB-RAW\tHASH-B',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
  '%R\tA1\tP-A\tA1\tTaak A\tC4\t2026-01-05 08:00\t2026-01-05 12:00\t4\t4\t1900-01-01 00:00\t1900-01-02 00:00\t2099-01-01 00:00\t2099-01-02 00:00\t999\t-999',
  '%R\tB1\tP-B\tB1\tTaak B1\tC8\t2026-01-05 08:00\t2026-01-05 16:00\t8\t8\t2001-01-01 00:00\t2001-01-02 00:00\t2088-01-01 00:00\t2088-01-02 00:00\t888\t-888',
  '%R\tB2\tP-B\tB2\tTaak B2\tC8\t2026-01-06 08:00\t2026-01-06 16:00\t8\t8\t2002-01-01 00:00\t2002-01-02 00:00\t2087-01-01 00:00\t2087-01-02 00:00\t777\t-777',
  '%E',
]);

const multiOpened = readXER(multiSource);
ok('1 twee projectrijen leveren de X4b-meerdocumentvorm', isMultiDocumentImport(multiOpened));
if (!isMultiDocumentImport(multiOpened)) {
  throw new Error('X5-wiringfixture leverde geen meervoudige import');
}
const [projectA, projectB] = multiOpened.results as XerReadResult[];

eq('bestandsbreed raw-archief heeft één gedeelde bronkopie met projectviews als referenties', {
  sameArchive: projectA?.xer.scheduleOptions.sourceArchive === projectB?.xer.scheduleOptions.sourceArchive,
  rows: projectA?.xer.scheduleOptions.sourceArchive.rows.length,
  projectARefs: projectA?.xer.scheduleOptions.sourceRows.every((row, index) =>
    row === projectA.xer.scheduleOptions.sourceArchive.rows[projectA.xer.scheduleOptions.sourceRowIndexes[index]]),
  projectBRefs: projectB?.xer.scheduleOptions.sourceRows.every((row, index) =>
    row === projectB.xer.scheduleOptions.sourceArchive.rows[projectB.xer.scheduleOptions.sourceRowIndexes[index]]),
}, { sameArchive: true, rows: 4, projectARefs: true, projectBRefs: true });

eq('2 ieder project krijgt uitsluitend zijn eigen SCHEDOPTIONS-semantiek', [
  {
    id: projectA?.project.id,
    progressMode: projectA?.project.progressMode,
    schedulingOptions: projectA?.project.schedulingOptions,
  },
  {
    id: projectB?.project.id,
    progressMode: projectB?.project.progressMode,
    schedulingOptions: projectB?.project.schedulingOptions,
  },
], [
  {
    id: 'P-A',
    progressMode: 'PROGRESS_OVERRIDE',
    schedulingOptions: {
      lagCalendar: 'successor',
      criticalDefinition: { mode: 'totalFloat', thresholdHours: 8 },
      totalFloatMode: 'start',
      makeOpenEndedCritical: true,
      useExpectedFinishDates: false,
      preserveActualDatesInBackwardPass: true,
      clampNegativeFreeFloat: true,
    },
  },
  {
    id: 'P-B',
    progressMode: 'RETAINED_LOGIC',
    schedulingOptions: {
      lagCalendar: '24hour',
      criticalDefinition: { mode: 'longestPath' },
      totalFloatMode: 'finish',
      makeOpenEndedCritical: false,
      useExpectedFinishDates: true,
      preserveActualDatesInBackwardPass: true,
      clampNegativeFreeFloat: true,
    },
  },
]);

eq('3 retained bronvlag, onbekend enumtoken en volledige bronrij blijven per project zichtbaar', [
  scheduleMetadata(projectA!),
  scheduleMetadata(projectB!),
].map(metadata => metadata && ({
  source: metadata.source,
  retainedSource: metadata.retainedSource,
  fallbacks: metadata.fallbacks,
  rows: metadata.sourceRows.map(row => ({
    table: row.table,
    line: row.line,
    projectId: row.cells.proj_id,
    floatToken: row.cells.sched_float_type,
    retainedToken: row.cells.sched_use_project_end_date_for_float,
    ignoredRawToken: row.cells.levelprioritylist,
    hash: row.cells.schedhash,
  })),
})), [
  {
    source: 'schedoptions',
    retainedSource: { sched_use_project_end_date_for_float: true },
    fallbacks: [],
    rows: [
      {
        table: 'PROJECT', line: 8, projectId: 'P-A',
        floatToken: undefined, retainedToken: undefined, ignoredRawToken: undefined, hash: undefined,
      },
      {
        table: 'SCHEDOPTIONS', line: 12, projectId: 'P-A',
        floatToken: 'ft_ss', retainedToken: 'Y', ignoredRawToken: 'A-RAW', hash: 'HASH-A',
      },
    ],
  },
  {
    source: 'schedoptions',
    retainedSource: { sched_use_project_end_date_for_float: false },
    fallbacks: [{
      field: 'sched_float_type', token: 'ST_TotalFloat', fallback: 'finish', line: 13,
    }],
    rows: [
      {
        table: 'PROJECT', line: 9, projectId: 'P-B',
        floatToken: undefined, retainedToken: undefined, ignoredRawToken: undefined, hash: undefined,
      },
      {
        table: 'SCHEDOPTIONS', line: 13, projectId: 'P-B',
        floatToken: 'ST_TotalFloat', retainedToken: 'N', ignoredRawToken: 'B-RAW', hash: 'HASH-B',
      },
    ],
  },
]);

function noScheduleSource(p6Date: string, p6Float: string): Uint8Array {
  return bytes([
    'ERMHDR\t23.12\t2026-08-25\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC8\tAcht uur\t8\t40\t',
    '%R\tC4\tVier uur\t4\t20\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|12:00)())))(0||3()((0||0(s|08:00|f|12:00)())))(0||4()((0||0(s|08:00|f|12:00)())))(0||5()((0||0(s|08:00|f|12:00)())))(0||6()((0||0(s|08:00|f|12:00)())))))(0||Exceptions()())))',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tcritical_path_type\tcritical_drtn_hr_cnt',
    '%R\tP-DEFAULT\tZonder tabel\tC8\t2026-01-05 08:00\tCT_TotFloat\t8',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    `%R\tSHORT\tP-DEFAULT\tSHORT\tVieruurstaak\tC4\t2026-01-05 08:00\t2026-01-05 12:00\t4\t4\t${p6Date}\t${p6Date}\t${p6Date}\t${p6Date}\t${p6Float}\t${p6Float}`,
    `%R\tDRIVER\tP-DEFAULT\tDRIVER\tDrijver\tC8\t2026-01-05 08:00\t2026-01-07 16:00\t24\t24\t${p6Date}\t${p6Date}\t${p6Date}\t${p6Date}\t${p6Float}\t${p6Float}`,
    '%E',
  ]);
}

const defaultProject = openedProjects(noScheduleSource('1900-01-01 00:00', '999'))[0]!;
eq('4 ontbrekende SCHEDOPTIONS krijgt altijd de expliciete P6-defaultset op de 4h/8h-fixture', {
  progressMode: defaultProject.project.progressMode,
  schedulingOptions: defaultProject.project.schedulingOptions,
  projectHours: defaultProject.calendar.hoursPerDay,
  taskHours: defaultProject.resourceCalendars?.find(calendar => calendar.id === 'C4')?.hoursPerDay,
  metadata: legacyMetadata(scheduleMetadata(defaultProject)),
}, {
  progressMode: 'RETAINED_LOGIC',
  schedulingOptions: {
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 8 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
  },
  projectHours: 8,
  taskHours: 4,
  metadata: {
    source: 'xer-defaults',
    retainedSource: {},
    fallbacks: [],
    sourceRows: [{
      table: 'PROJECT',
      line: 8,
      cells: {
        proj_id: 'P-DEFAULT',
        proj_short_name: 'Zonder tabel',
        clndr_id: 'C8',
        last_recalc_date: '2026-01-05 08:00',
        critical_path_type: 'CT_TotFloat',
        critical_drtn_hr_cnt: '8',
      },
    }],
  },
});

const hostileProject = openedProjects(bytes([
  'ERMHDR\t23.12\t2026-08-25\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tcritical_path_type\tcritical_drtn_hr_cnt',
  '%R\tP-HOSTILE\tHostile\tCT_TotFloat\t8',
  '%T\tSCHEDOPTIONS',
  '%F\tproj_id\tsched_float_type\tsched_retained_logic\tsched_progress_override',
  '%R\tP-HOSTILE\tFT_SS\tN\tY',
  '%R\tP-HOSTILE\tFT_FF\tY\tN',
  '%R\tORPHAN\tFT_MIN\tN\tY',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt',
  '%R\tT1\tP-HOSTILE\tT1\tTaak\t2026-01-05\t2026-01-06\t8',
  '%E',
]))[0]!;
eq('hostile reader bewaart orphan/duplicates eenmaal en past geen onzekere rijsemantiek toe', {
  source: hostileProject.xer.scheduleOptions.source,
  progressMode: hostileProject.project.progressMode,
  floatMode: hostileProject.project.schedulingOptions?.totalFloatMode,
  sourceRowIndexes: hostileProject.xer.scheduleOptions.sourceRowIndexes,
  sourceProjectIds: hostileProject.xer.scheduleOptions.sourceRows.map(row => row.cells.proj_id),
  archiveProjectIds: hostileProject.xer.scheduleOptions.sourceArchive.rows.map(row => row.cells.proj_id),
  unmatched: hostileProject.xer.scheduleOptions.sourceArchive.unmatchedScheduleOptionsRowIndexes,
  diagnostics: hostileProject.xer.scheduleOptions.diagnostics,
}, {
  source: 'xer-defaults',
  progressMode: 'RETAINED_LOGIC',
  floatMode: 'finish',
  sourceRowIndexes: [0, 1, 2],
  sourceProjectIds: ['P-HOSTILE', 'P-HOSTILE', 'P-HOSTILE'],
  archiveProjectIds: ['P-HOSTILE', 'P-HOSTILE', 'P-HOSTILE', 'ORPHAN'],
  unmatched: [3],
  diagnostics: [{
    code: 'XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID',
    projectId: 'P-HOSTILE',
    rowIndexes: [1, 2],
    lines: [7, 8],
  }],
});

function solvedAxes(source: Uint8Array): unknown {
  const imported = openedProjects(source)[0]!;
  const tasks = cloneTasksForSolve(imported.tasks);
  const result = solveProject({
    tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate,
  });
  return tasks.map(task => ({
    id: task.id,
    es: task.time.earlyStart,
    ef: task.time.earlyFinish,
    ls: task.time.lateStart,
    lf: task.time.lateFinish,
    tf: task.time.totalFloat,
    ff: task.time.freeFloat,
    critical: result.tasks.get(task.id)?.isCritical,
  }));
}

const solvedDefault = solvedAxes(noScheduleSource('1900-01-01 00:00', '999'));
eq('5 8h-kritiekdrempel wordt na echte readerwiring per effectieve 4h-taakkalender toegepast',
  solvedDefault, [
    {
      id: 'SHORT', es: '2026-01-05T08:00', ef: '2026-01-05T12:00',
      ls: '2026-01-07T08:00', lf: '2026-01-07T16:00', tf: 2, ff: 2, critical: true,
    },
    {
      id: 'DRIVER', es: '2026-01-05T08:00', ef: '2026-01-07T16:00',
      ls: '2026-01-05T08:00', lf: '2026-01-07T16:00', tf: 0, ff: 0, critical: true,
    },
  ]);
eq('6 P6 early/late/float-bronvelden zijn geen solverinvoer', {
  first: solvedDefault,
  second: solvedAxes(noScheduleSource('2099-12-31 23:59', '-12345')),
}, {
  first: solvedDefault,
  second: solvedDefault,
});

useAppStore.getState().applyOpenedImport(multiOpened, {
  filePath: null,
  fileHandle: null,
  recompute: true,
  fit: false,
  hourDataNotice: false,
  linkedOpen: true,
});
const openedDocs = useAppStore.getState().getOpenDocumentPayloads();
eq('7 X4b-file-openfan-out bewaart per document zijn eigen projectinstellingen en bronmetadata',
  openedDocs.map(document => ({
    id: document.payload.project.id,
    progressMode: document.payload.project.progressMode,
    floatMode: document.payload.project.schedulingOptions?.totalFloatMode,
    sourceProjectIds: document.payload.xerImportMetadata?.scheduleOptions.sourceRows
      .map(row => row.cells.proj_id),
  })), [
    { id: 'P-A', progressMode: 'PROGRESS_OVERRIDE', floatMode: 'start', sourceProjectIds: ['P-A', 'P-A'] },
    { id: 'P-B', progressMode: 'RETAINED_LOGIC', floatMode: 'finish', sourceProjectIds: ['P-B', 'P-B'] },
  ]);
eq('file-open bewaart de file-wide bronkopie gedeeld tussen de documentpayloads',
  openedDocs[0]?.payload.xerImportMetadata?.scheduleOptions.sourceArchive
    === openedDocs[1]?.payload.xerImportMetadata?.scheduleOptions.sourceArchive,
  true);

const firstDocumentId = openedDocs[0]?.id;
const secondDocumentId = openedDocs[1]?.id;
if (!firstDocumentId || !secondDocumentId) throw new Error('Wiringfixture mist geopende documenten');
useAppStore.getState().switchDocument(firstDocumentId);
const beforeUndo = JSON.stringify({
  progressMode: useAppStore.getState().project.progressMode,
  schedulingOptions: useAppStore.getState().project.schedulingOptions,
  metadata: useAppStore.getState().xerImportMetadata,
});
useAppStore.getState().setProject({ description: 'undo-proef' });
useAppStore.getState().undo();
eq('8 documentwissel plus undo bewaart bedrade projectinstellingen en immutable bronmetadata',
  JSON.stringify({
    progressMode: useAppStore.getState().project.progressMode,
    schedulingOptions: useAppStore.getState().project.schedulingOptions,
    metadata: useAppStore.getState().xerImportMetadata,
  }), beforeUndo);

const recoveryInputs = (multiOpened.results as XerReadResult[]).map((result, index) =>
  recoveryInputFromParsed(result, {
    id: index === 0 ? firstDocumentId : secondDocumentId,
    filePath: null,
    isDirty: false,
  }));
useAppStore.getState().restoreDocuments(recoveryInputs, secondDocumentId);
eq('9 RecoveryDocInput bewaart instellingen en retained bronwaarde per project',
  useAppStore.getState().getOpenDocumentPayloads().map(document => ({
    id: document.payload.project.id,
    progressMode: document.payload.project.progressMode,
    floatMode: document.payload.project.schedulingOptions?.totalFloatMode,
    retained: document.payload.xerImportMetadata?.scheduleOptions.retainedSource,
  })), [
    { id: 'P-A', progressMode: 'PROGRESS_OVERRIDE', floatMode: 'start', retained: { sched_use_project_end_date_for_float: true } },
    { id: 'P-B', progressMode: 'RETAINED_LOGIC', floatMode: 'finish', retained: { sched_use_project_end_date_for_float: false } },
  ]);
const recoveredDocuments = useAppStore.getState().getOpenDocumentPayloads();
eq('RecoveryDocInput behoudt één gedeeld file-wide bronarchief',
  recoveredDocuments[0]?.payload.xerImportMetadata?.scheduleOptions.sourceArchive
    === recoveredDocuments[1]?.payload.xerImportMetadata?.scheduleOptions.sourceArchive,
  true);

eq('10 IFC bewaart X5-documentprovenance naast de bestaande projectinstellingen',
  (multiOpened.results as XerReadResult[]).map(result => {
    const roundTripped = readIFC(writeIFC(result));
    return {
      name: roundTripped.project.name,
      progressMode: roundTripped.project.progressMode,
      schedulingOptions: roundTripped.project.schedulingOptions,
      xer: {
        sourceProjectId: roundTripped.xer?.sourceProjectId,
        source: roundTripped.xer?.scheduleOptions.source,
        retained: roundTripped.xer?.scheduleOptions.retainedSource,
        report: roundTripped.xer?.report,
      },
    };
  }), [
    {
      name: 'Project A', progressMode: 'PROGRESS_OVERRIDE',
      schedulingOptions: projectA?.project.schedulingOptions,
      xer: {
        sourceProjectId: projectA?.xer.sourceProjectId,
        source: projectA?.xer.scheduleOptions.source,
        retained: projectA?.xer.scheduleOptions.retainedSource,
        report: projectA?.xer.report,
      },
    },
    {
      // RETAINED_LOGIC is IFC's bestaande canonieke default en komt daarom als `undefined` terug;
      // de solversemantiek blijft retained. Een expliciete PROGRESS_OVERRIDE hierboven blijft staan.
      name: 'Project B', progressMode: undefined,
      schedulingOptions: projectB?.project.schedulingOptions,
      xer: {
        sourceProjectId: projectB?.xer.sourceProjectId,
        source: projectB?.xer.scheduleOptions.source,
        retained: projectB?.xer.scheduleOptions.retainedSource,
        report: projectB?.xer.report,
      },
    },
  ]);

const corpusRoot = process.env.OPS_XER_CORPUS;
if (corpusRoot && existsSync(corpusRoot)) {
  const relativePath = 'crawl-xer/eh_P6Workshops/OZB-Start-09Dec24.xer';
  const publicBytes = new Uint8Array(readFileSync(join(corpusRoot, relativePath)));
  const publicTruth = scanRawXerScheduleOptions(publicBytes);
  const publicOpened = readXER(publicBytes);
  if (!isMultiDocumentImport(publicOpened)) throw new Error('Openbare 15-projectenfixture is niet meervoudig');
  const settings = (publicOpened.results as XerReadResult[]).map(result => {
    const expected = expectedXerScheduleOptions(publicTruth, result.project.id, {
      taskCount: result.tasks.filter(task => task.p6ActivityType !== undefined).length,
    });
    const metadata = scheduleMetadata(result);
    return {
      projectId: result.project.id,
      source: metadata?.source,
      isolated: JSON.stringify({
        progressMode: result.project.progressMode,
        schedulingOptions: result.project.schedulingOptions,
      }) === JSON.stringify({
        progressMode: expected.progressMode,
        schedulingOptions: expected.schedulingOptions,
      }) && JSON.stringify({
        source: metadata?.source,
        retainedSource: metadata?.retainedSource,
        fallbacks: metadata?.fallbacks,
        diagnostics: metadata?.diagnostics,
        sourceRowIndexes: metadata?.sourceRowIndexes,
        sourceRows: metadata?.sourceRows,
      }) === JSON.stringify({
        source: expected.source,
        retainedSource: expected.retainedSource,
        fallbacks: expected.fallbacks,
        diagnostics: expected.diagnostics,
        sourceRowIndexes: expected.sourceRowIndexes,
        sourceRows: expected.sourceRows,
      }),
      progressMode: result.project.progressMode,
      lagCalendar: result.project.schedulingOptions?.lagCalendar,
      totalFloatMode: result.project.schedulingOptions?.totalFloatMode,
      critical: result.project.schedulingOptions?.criticalDefinition,
      retainedProjectEnd: metadata?.retainedSource.sched_use_project_end_date_for_float,
      sourceRows: metadata?.sourceRows.length,
    };
  });
  eq('11 openbare 15-projectenmeting houdt alle 12 geopende settings per project geïsoleerd', {
    projectsSeen: publicOpened.report.projectsSeen,
    documentsOpened: publicOpened.results.length,
    isolated: settings.every(item => item.isolated),
    idsUnique: new Set(settings.map(item => item.projectId)).size,
  }, { projectsSeen: 15, documentsOpened: 12, isolated: true, idsUnique: 12 });
  const expectedProjectIds = [
    '9029', '9030', '9031', '9032', '9033', '9040',
    '9045', '9047', '9049', '10091', '10093', '10096',
  ];
  eq('12 openbare 15-projectenmeting pint de instellingen van ieder geopend project afzonderlijk',
    settings, expectedProjectIds.map(projectId => ({
      projectId,
      source: 'schedoptions',
      isolated: true,
      progressMode: projectId === '10093' ? 'PROGRESS_OVERRIDE' : 'RETAINED_LOGIC',
      lagCalendar: 'predecessor',
      totalFloatMode: 'finish',
      critical: { mode: 'totalFloat', thresholdHours: 0 },
      retainedProjectEnd: true,
      sourceRows: 2,
    })));
  for (const item of settings) console.log(`.   X5-settings ${JSON.stringify(item)}`);
} else {
  console.log('OK  XER-SCHEDOPTIONS-wiring: openbare 15-projectenmeting overgeslagen (OPS_XER_CORPUS)');
}

if (diffs.length > 0) {
  console.error(`XER-SCHEDOPTIONS-wiring: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-SCHEDOPTIONS-wiring: ${checks} checks groen`);
