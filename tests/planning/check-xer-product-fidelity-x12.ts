import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { solveProject } from '@/engine/scheduler/solveProject';
import {
  fromExtCalendar, fromExtProject, fromExtSequence, fromExtTask, toExtTask,
} from '@/extensions/extMappers';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import type { WorkCalendar } from '@/types/calendar';
import { buildXerTargetBaseline, type XerCorpusFile, type XerCorpusManifest, type XerSolvedProject } from './xerFidelity';
import { scanXerGroundTruth, XER_FIDELITY_AXES, type XerFidelityAxis } from './xerGroundTruth';
import { measureXerProductFidelity, type XerProductAxisCounts } from './xerProductFidelity';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPORT = process.env.OPS_XER_FIDELITY_REPORT;
const REPORT_MODES = new Set(['baseline', 'detail', 'summary']);
const diffs: string[] = [];
let checks = 0;

interface ProductBaselineEntry {
  sha256: string;
  schemaFingerprint: string;
  projects: number;
  tasks: number;
  counters: Record<XerFidelityAxis, XerProductAxisCounts>;
  drivingPath: XerProductAxisCounts;
  identityErrors: string[];
  scannerErrors: string[];
  gatePassed: boolean;
}
interface ProductBaseline { version: 2; manifestSha256: string; files: Record<string, ProductBaselineEntry>; }

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function hash(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
function xerStructuredRecord(
  number: string,
  name: string,
  fields: string,
  children: readonly string[],
): string {
  return `(${number}||${name}(${fields})(${children.join('')}))`;
}
function fiveDayCalendarData(start: string, finish: string): string {
  const days = [2, 3, 4, 5, 6].map(day => xerStructuredRecord('0', String(day), '', [
    xerStructuredRecord('0', '0', `s|${start}|f|${finish}`, []),
  ]));
  return xerStructuredRecord('0', 'CalendarData', '', [
    xerStructuredRecord('0', 'DaysOfWeek', '', days),
    xerStructuredRecord('0', 'Exceptions', '', []),
  ]);
}
function totalDeviations(entry: ProductBaselineEntry): number {
  return XER_FIDELITY_AXES.reduce((total, axis) => total + entry.counters[axis].deviations, 0);
}
/** De solver bewaart dagmodus bewust compact; de X12-meetlat vergelijkt dezelfde P6-betekenis per minuut. */
function canonicalProductMinute(value: string | undefined): string | undefined {
  return value?.match(/^\d{4}-\d{2}-\d{2}$/) ? `${value}T00:00` : value;
}
eq('X12 canonicaliseert uitsluitend datumrepresentatie naar de P6-minuut',
  canonicalProductMinute('2026-01-01'), '2026-01-01T00:00');
function listXerFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listXerFiles(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xer')) found.push(path);
  }
  return found;
}

/** Alleen echte TASK-bladen, met float op de effectieve taak-kalender in P6-minuten. */
function solveImported(imported: ImportResult): XerSolvedProject {
  const cpm = solveProject({
    tasks: imported.tasks, sequences: imported.sequences, calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [], dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode, schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate, projectEndDate: imported.project.endDate,
  });
  if (cpm.error) throw new Error(`${imported.project.id}: ${cpm.error}`);
  const calendars = new Map([[imported.calendar.id, imported.calendar], ...(imported.resourceCalendars ?? [])
    .map(calendar => [calendar.id, calendar] as const)]);
  const floatMinutesPerDay = new Map([...calendars].map(([id, calendar]) => [
    id,
    new CalendarEngine(calendar).hoursPerDay * 60,
  ]));
  return {
    projectId: imported.project.id,
    tasks: imported.tasks.filter(task => task.p6ActivityType !== undefined).map(task => {
      const calendar = (task.calendarId ? calendars.get(task.calendarId) : undefined) ?? imported.calendar;
      const minutesPerDay = floatMinutesPerDay.get(calendar.id)!;
      return {
        sourceTaskId: task.id, taskCode: task.wbsCode,
        earlyStart: canonicalProductMinute(task.time.earlyStart), earlyFinish: canonicalProductMinute(task.time.earlyFinish),
        lateStart: canonicalProductMinute(task.time.lateStart), lateFinish: canonicalProductMinute(task.time.lateFinish),
        totalFloatMinutes: task.time.totalFloat * minutesPerDay,
        freeFloatMinutes: task.time.freeFloat * minutesPerDay,
        drivingPath: task.time.isCritical,
      };
    }),
  };
}

/** Productprojecties uit X4b-baselines; bronidentiteit komt uitsluitend uit de importpayload. */
function materializedBaselineProjects(imported: ImportResult): XerSolvedProject[] {
  return (imported.baselines ?? []).flatMap((baseline) => {
    if (!baseline.sourceProjectId) return [];
    return [{
      projectId: baseline.sourceProjectId,
      tasks: baseline.tasks.map(task => ({
        sourceTaskId: task.sourceTaskId ?? task.taskId,
        taskCode: task.sourceTaskCode ?? '',
        earlyStart: canonicalProductMinute(task.start),
        earlyFinish: canonicalProductMinute(task.finish),
      })),
    }];
  });
}

/** Alle geopende én als baseline gematerialiseerde productuitkomsten, één keer per bronproject. */
function solveProductProjects(imports: readonly ImportResult[]): XerSolvedProject[] {
  const byProjectId = new Map<string, XerSolvedProject>();
  for (const imported of imports) {
    const opened = solveImported(imported);
    byProjectId.set(opened.projectId, opened);
  }
  for (const imported of imports) {
    for (const baseline of materializedBaselineProjects(imported)) {
      if (!byProjectId.has(baseline.projectId)) byProjectId.set(baseline.projectId, baseline);
    }
  }
  return [...byProjectId.values()];
}

function productBaseline(corpus: readonly XerCorpusFile[], manifest: XerCorpusManifest): ProductBaseline {
  const target = buildXerTargetBaseline(corpus, manifest);
  if (target.errors.length > 0) throw new Error(`X1-manifest/grondwaarheid faalt: ${target.errors.join('; ')}`);
  const byLabel = new Map(corpus.map(file => [file.label, file]));
  const files: Record<string, ProductBaselineEntry> = {};
  for (const targetEntry of Object.values(target.baseline.files).sort((a, b) => a.label.localeCompare(b.label))) {
    const file = byLabel.get(targetEntry.label);
    if (!file) throw new Error(`geselecteerde X1-entry ontbreekt: ${targetEntry.label}`);
    const opened = readXER(file.bytes);
    const imports = isMultiDocumentImport(opened) ? opened.taskProjects.map(document => document.result) : [opened];
    const solvedProjects = solveProductProjects(imports);
    const result = measureXerProductFidelity(scanXerGroundTruth(file.bytes), solvedProjects);
    if (REPORT === undefined && targetEntry.label === 'crawl-xer/p6diff-baseline.xer') {
      const publicTask = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.sourceTaskId === '1010');
      eq('publieke p6diff-baseline taak A1010 eindigt op P6-bandeinde 17:00',
        publicTask?.earlyFinish, '2026-04-07T17:00');
    }
    if (REPORT === undefined
      && targetEntry.label === 'crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer') {
      const publicTask = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'V000040');
      const earlierFinishMilestone = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'V000030');
      eq('publieke rehab-2 TT_FinMile bewaart P6 start-/vorige-finishgrens', {
        earlyStart: publicTask?.earlyStart,
        earlyFinish: publicTask?.earlyFinish,
      }, {
        earlyStart: '2010-05-02T08:00',
        earlyFinish: '2010-05-01T17:00',
      });
      eq('publieke rehab-2 open TT_FinMile ankert late datums op zijn eigen vroege grens', {
        lateStart: earlierFinishMilestone?.lateStart,
        lateFinish: earlierFinishMilestone?.lateFinish,
        totalFloatMinutes: earlierFinishMilestone?.totalFloatMinutes,
      }, {
        lateStart: '2009-04-29T08:00',
        lateFinish: '2009-04-28T17:00',
        totalFloatMinutes: 0,
      });
      const holidayWindowTask = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'V3153490');
      eq('publieke rehab-2 taak V3153490 rekent P6-kalenderanomalieën in late datums en finish-float', {
        lateStart: holidayWindowTask?.lateStart,
        lateFinish: holidayWindowTask?.lateFinish,
        totalFloatMinutes: holidayWindowTask?.totalFloatMinutes,
        freeFloatMinutes: holidayWindowTask?.freeFloatMinutes,
      }, {
        lateStart: '2009-11-16T08:00',
        lateFinish: '2009-12-12T17:00',
        totalFloatMinutes: 48480,
        freeFloatMinutes: 6720,
      });
      const runningRemainingTask = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'V3101180');
      eq('publieke rehab-2 lopende taak toont de resterende vroege start, niet de historische actual start',
        runningRemainingTask?.earlyStart, '2008-05-27T08:00');
      const finishLagBoundaryTask = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'V3102370');
      eq('publieke rehab-2 FF+2d-taak bewaart de P6-finishgrens', {
        lateStart: finishLagBoundaryTask?.lateStart,
        lateFinish: finishLagBoundaryTask?.lateFinish,
      }, {
        lateStart: '2009-12-28T08:00',
        lateFinish: '2010-01-05T17:00',
      });
    }
    if (REPORT === undefined && targetEntry.label === 'crawl-xer/gimmer-crag-mountain-refuge.xer') {
      const publicTask = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'ACT-3');
      eq('publieke Gimmer-taak ACT-3 bewaart de geplande FS-start op de voorganger-finishgrens', {
        earlyStart: publicTask?.earlyStart,
        earlyFinish: publicTask?.earlyFinish,
      }, {
        earlyStart: '2025-06-19T17:00',
        earlyFinish: '2025-06-26T17:00',
      });
    }
    if (REPORT === undefined && targetEntry.label === 'crawl-xer/hb-intel_Project_Schedule.xer') {
      const zeroActivity = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'B01-019');
      eq('publieke hb-intel nulduuractiviteit bewaart P6 start-/vorige-finishgrenzen', {
        earlyStart: zeroActivity?.earlyStart,
        earlyFinish: zeroActivity?.earlyFinish,
        lateStart: zeroActivity?.lateStart,
        lateFinish: zeroActivity?.lateFinish,
      }, {
        earlyStart: '2026-08-06T08:00',
        earlyFinish: '2026-08-05T17:00',
        lateStart: '2026-08-06T08:00',
        lateFinish: '2026-08-05T17:00',
      });
    }
    if (REPORT === undefined && targetEntry.label === 'crawl-xer/Roads_Project_TEC.xer') {
      const publicTask = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'A10500');
      const effectiveCalendarFloat = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'A14610');
      eq('publieke Roads-taak A10500 behoudt voltooide P6-actuals op middernacht', {
        earlyStart: publicTask?.earlyStart,
        earlyFinish: publicTask?.earlyFinish,
      }, {
        earlyStart: '2013-01-19T00:00',
        earlyFinish: '2013-01-26T00:00',
      });
      eq('publieke Roads-taak A14610 zet float om met de afgeleide effectieve kalenderdag',
        effectiveCalendarFloat?.totalFloatMinutes, 8520);
    }
    if (REPORT === undefined
      && targetEntry.label === 'P6-Viewer/XER Files/TERMINAL BUILDING-AIRPORT.xer') {
      const publicTask = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'A3450');
      const publicStart = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'A1010');
      const publicEnd = solvedProjects.flatMap(project => project.tasks)
        .find(task => task.taskCode === 'A5800');
      eq('publieke Terminal-taak A3450 gebruikt PROJECT.plan_end_date voor de late floatzijde', {
        lateFinish: publicTask?.lateFinish,
        totalFloatMinutes: publicTask?.totalFloatMinutes,
        startMilestoneLateStart: publicStart?.lateStart,
        endMilestoneFreeFloatMinutes: publicEnd?.freeFloatMinutes,
      }, {
        lateFinish: '2013-02-28T17:00',
        totalFloatMinutes: 480,
        startMilestoneLateStart: '2012-05-01T08:00',
        endMilestoneFreeFloatMinutes: 0,
      });
    }
    if (REPORT === 'detail') {
      console.log(`. ${targetEntry.label}: projecten ${result.truthProjects}/${result.solvedProjects}; taken ${result.truthTasks}/${result.solvedTasks}`);
      for (const axis of XER_FIDELITY_AXES) console.log(`.   ${axis} ${JSON.stringify(result.counters[axis])}`);
      for (const item of result.detail) console.log(`.   ${item.projectId}/${item.taskCode} ${item.axis}: ${item.bucket}; p6=${JSON.stringify(item.truth)} ops=${JSON.stringify(item.ours)}`);
      for (const error of result.errors) console.log(`.   IDENTITEIT ${error}`);
    }
    files[targetEntry.label] = {
      sha256: hash(file.bytes), schemaFingerprint: targetEntry.schemaFingerprint ?? '',
      projects: result.truthProjects, tasks: result.truthTasks,
      counters: result.counters, drivingPath: result.drivingPath,
      identityErrors: result.identityErrors,
      scannerErrors: result.scannerErrors,
      gatePassed: result.gatePassed,
    };
  }
  return { version: 2, manifestSha256: hash(readFileSync(join(HERE, 'xer-corpus-manifest.json'))), files };
}

// Corpusloze RED-/GREEN-probe voor de vier expliciete productbakken.
{
  const truth = scanXerGroundTruth(new TextEncoder().encode([
    '%T\tTASK',
    '%F\tproj_id\ttask_id\ttask_code\tstatus_code\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    '%R\tP\t1\tA\tTK_NotStart\t2026-01-01 08:00\t2026-01-01 17:00\t\t\t1\t', '%E',
  ].join('\n')));
  const measured = measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [{
    sourceTaskId: '1', taskCode: 'A', earlyStart: '2026-01-01T08:00', earlyFinish: '2026-01-01T08:00', totalFloatMinutes: 60,
  }] }]);
  eq('X12 vierbakken houden exact, diff en meetbare missing gescheiden', measured.counters, {
    es: { exact: 1, sameday: 0, diff: 0, missing: 0, measurable: 1, deviations: 0 },
    ef: { exact: 0, sameday: 1, diff: 0, missing: 0, measurable: 1, deviations: 1 },
    ls: { exact: 0, sameday: 0, diff: 0, missing: 0, measurable: 0, deviations: 0 },
    lf: { exact: 0, sameday: 0, diff: 0, missing: 0, measurable: 0, deviations: 0 },
    tf: { exact: 1, sameday: 0, diff: 0, missing: 0, measurable: 1, deviations: 0 },
    ff: { exact: 0, sameday: 0, diff: 0, missing: 0, measurable: 0, deviations: 0 },
  });
}

// De veldlijst alleen inventariseren is onvoldoende: alle verboden TASK-resultaatkolommen moeten
// operationeel non-interferent zijn. De onafhankelijke scanner moet juist wél op de zes orakelassen
// en driving reageren, terwijl readerinvoer en productsolve bytegelijk blijven.
{
  const forbiddenFields = [
    'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
    'restart_date', 'reend_date', 'rem_late_start_date', 'rem_late_end_date',
    'total_float_hr_cnt', 'free_float_hr_cnt', 'driving_path_flag',
    'float_path', 'float_path_order',
    'old_restart_date', 'old_reend_date', 'old_remain_drtn_hr_cnt', 'crt_path_num',
    'critical_drtn_hr_cnt', 'act_drtn_hr_cnt', 'plan_start_date', 'plan_end_date',
  ] as const;
  const dateFields = new Set([
    'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
    'restart_date', 'reend_date', 'rem_late_start_date', 'rem_late_end_date',
    'old_restart_date', 'old_reend_date',
    'plan_start_date', 'plan_end_date',
  ]);
  const primaryValues: Record<string, string> = {
    early_start_date: '2026-01-05 08:00', early_end_date: '2026-01-05 16:00',
    late_start_date: '2026-01-06 08:00', late_end_date: '2026-01-06 16:00',
    total_float_hr_cnt: '8', free_float_hr_cnt: '4', driving_path_flag: 'Y',
  };
  const taskPrefixFields = [
    'task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type',
    'status_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
  ];
  const statusCases = [
    { id: 'not-started', status: 'TK_NotStart', actualStart: '', actualFinish: '', remaining: '8' },
    { id: 'active', status: 'TK_Active', actualStart: '2026-01-05 08:00', actualFinish: '', remaining: '4' },
    { id: 'complete', status: 'TK_Complete', actualStart: '2026-01-05 08:00', actualFinish: '2026-01-05 16:00', remaining: '0' },
  ] as const;
  const makeBytes = (statusCase: typeof statusCases[number], absurd: boolean) => new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tNon-interference\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    `%F\t${[...taskPrefixFields, 'act_start_date', 'act_end_date', ...forbiddenFields].join('\t')}`,
    `%R\t${[
      'T1', 'P', 'C1', 'A100', `Non-interference ${statusCase.id}`, 'TT_Task', 'DT_FixedDUR',
      statusCase.status, '8', statusCase.remaining, '2026-01-05 08:00', '2026-01-05 16:00',
      statusCase.actualStart, statusCase.actualFinish,
      ...forbiddenFields.map((field, index) => absurd
        ? field === 'driving_path_flag' ? 'N'
          : dateFields.has(field) ? `2099-12-${String((index % 20) + 1).padStart(2, '0')} 23:59`
            : String(-1000 - index)
        : primaryValues[field] ?? (dateFields.has(field) ? '2026-01-07 12:34' : String(index + 1))),
    ].join('\t')}`,
    '%E',
  ].join('\n'));
  const solverInput = (input: ImportResult) => ({
    project: {
      startDate: input.project.startDate, endDate: input.project.endDate,
      statusDate: input.project.statusDate, progressMode: input.project.progressMode,
      schedulingOptions: input.project.schedulingOptions,
    },
    calendar: input.calendar,
    resourceCalendars: input.resourceCalendars ?? [],
    tasks: input.tasks,
    sequences: input.sequences,
  });
  const axes = (input: ImportResult) => {
    const solved = solveImported(input).tasks;
    return solved.map(task => [task.taskCode, task.earlyStart, task.earlyFinish,
      task.lateStart, task.lateFinish, task.totalFloatMinutes, task.freeFloatMinutes]);
  };
  for (const statusCase of statusCases) {
    const normalBytes = makeBytes(statusCase, false);
    const absurdBytes = makeBytes(statusCase, true);
    const normal = readXER(normalBytes);
    const absurd = readXER(absurdBytes);
    if (isMultiDocumentImport(normal) || isMultiDocumentImport(absurd)) {
      throw new Error('X12 forbidden-fieldfixture moet enkelproject zijn');
    }
    eq(`X12 ${statusCase.id}: verboden stored output is non-interferent voor import/solverinvoer`,
      solverInput(absurd), solverInput(normal));
    eq(`X12 ${statusCase.id}: verboden stored output is non-interferent voor zes productassen`,
      axes(absurd), axes(normal));
    const normalTruth = scanXerGroundTruth(normalBytes);
    const absurdTruth = scanXerGroundTruth(absurdBytes);
    eq(`X12 ${statusCase.id}: scannertruth reageert wel op zes raw stored assen`, {
      normalErrors: normalTruth.errors,
      absurdErrors: absurdTruth.errors,
      sixAxesChanged: XER_FIDELITY_AXES.every(axis =>
        normalTruth.tasks[0]?.axes[axis] !== absurdTruth.tasks[0]?.axes[axis]),
      drivingChanged: normalTruth.tasks[0]?.drivingPath !== absurdTruth.tasks[0]?.drivingPath,
    }, {
      normalErrors: [], absurdErrors: [], sixAxesChanged: true, drivingChanged: true,
    });

    const ifcNormal = readIFC(writeIFC(normal));
    const ifcAbsurd = readIFC(writeIFC(absurd));
    eq(`X12 ${statusCase.id}: XER→solve→IFC→solve laat forbidden output niet teruglekken`,
      axes(ifcAbsurd), axes(ifcNormal));

    const extNormal: ImportResult = { ...normal, tasks: normal.tasks.map(task => fromExtTask(toExtTask(task))) };
    const extAbsurd: ImportResult = { ...absurd, tasks: absurd.tasks.map(task => fromExtTask(toExtTask(task))) };
    eq(`X12 ${statusCase.id}: volledige ExtTask/TaskTime-round-trip laat forbidden output niet teruglekken`,
      axes(extAbsurd), axes(extNormal));
  }

  const makeExternalProxyBytes = (absurd: boolean) => new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tExternal proxy\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    `%F\t${[...taskPrefixFields, 'external_early_start_date', 'external_late_end_date'].join('\t')}`,
    `%R\t${[
      'T1', 'P', 'C1', 'A100', 'External proxy', 'TT_Task', 'DT_FixedDUR',
      'TK_NotStart', '8', '8', '2026-01-05 08:00', '2026-01-05 16:00',
      absurd ? '2099-12-01 23:59' : '2026-01-04 08:00',
      absurd ? '2099-12-31 23:59' : '2026-01-07 16:00',
    ].join('\t')}`,
    '%E',
  ].join('\n'));
  const externalNormal = readXER(makeExternalProxyBytes(false));
  const externalAbsurd = readXER(makeExternalProxyBytes(true));
  if (isMultiDocumentImport(externalNormal) || isMultiDocumentImport(externalAbsurd)) {
    throw new Error('X12 external-proxyfixture moet enkelproject zijn');
  }
  eq('X12 unsupported external-dependency proxy/input is bewust non-interferent voor reader/solver',
    solverInput(externalAbsurd), solverInput(externalNormal));
  eq('X12 unsupported external-dependency proxy/input is bewust non-interferent voor solve-resultaat',
    axes(externalAbsurd), axes(externalNormal));
}

// Minuutprecisie betekent letterlijk minuutprecisie: 08:00 en 08:01 zijn niet "binnen een
// minuut" gelijk. Deze corpusloze rij houdt alle andere assen exact, zodat uitsluitend ES rood is.
{
  const truth = scanXerGroundTruth(new TextEncoder().encode([
    '%T\tTASK',
    '%F\tproj_id\ttask_id\ttask_code\tstatus_code\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    '%R\tP\tMIN\tMIN\tTK_NotStart\t2026-01-01 08:01\t2026-01-01 16:00\t2026-01-01 08:00\t2026-01-01 16:00\t0\t0',
    '%E',
  ].join('\n')));
  const measured = measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [{
    sourceTaskId: 'MIN', taskCode: 'MIN', earlyStart: '2026-01-01T08:00',
    earlyFinish: '2026-01-01T16:00', lateStart: '2026-01-01T08:00',
    lateFinish: '2026-01-01T16:00', totalFloatMinutes: 0, freeFloatMinutes: 0,
  }] }]);
  eq('X12 08:00 versus 08:01 geeft exact één minuutafwijking', {
    total: XER_FIDELITY_AXES.reduce((sum, axis) => sum + measured.counters[axis].deviations, 0),
    es: measured.counters.es,
  }, {
    total: 1,
    es: { exact: 0, sameday: 1, diff: 0, missing: 0, measurable: 1, deviations: 1 },
  });
}

// Fractionele P6-minuten blijven exacte getallen: de comparator mag geen halve minuut afronden.
{
  const bytes = new TextEncoder().encode([
    '%T\tTASK',
    '%F\tproj_id\ttask_id\ttask_code\tstatus_code\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    '%R\tP\tPOS\tPOS\tTK_NotStart\t2026-01-01 08:00:30\t2026-01-01 16:00\t2026-01-01 08:00\t2026-01-01 16:00\t0.125\t-0.125',
    '%E',
  ].join('\n'));
  const truth = scanXerGroundTruth(bytes);
  const exact = measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [{
    sourceTaskId: 'POS', taskCode: 'POS',
    earlyStart: '2026-01-01T08:00', earlyFinish: '2026-01-01T16:00',
    lateStart: '2026-01-01T08:00', lateFinish: '2026-01-01T16:00',
    totalFloatMinutes: 7.5, freeFloatMinutes: -7.5,
  }] }]);
  eq('X12 fractionele minuten vergelijken exact en subminuutdatum blijft apart gepind', {
    tf: exact.counters.tf, ff: exact.counters.ff, es: exact.counters.es,
    precision: truth.precision,
  }, {
    tf: { exact: 1, sameday: 0, diff: 0, missing: 0, measurable: 1, deviations: 0 },
    ff: { exact: 1, sameday: 0, diff: 0, missing: 0, measurable: 1, deviations: 0 },
    es: { exact: 1, sameday: 0, diff: 0, missing: 0, measurable: 1, deviations: 0 },
    precision: {
      dateSecondCells: { es: 1, ef: 0, ls: 0, lf: 0 },
      dateNonZeroSubminuteCells: { es: 1, ef: 0, ls: 0, lf: 0 },
      floatFractionalMinuteCells: { tf: 1, ff: 1 },
    },
  });
  const rounded = measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [{
    sourceTaskId: 'POS', taskCode: 'POS',
    earlyStart: '2026-01-01T08:00', earlyFinish: '2026-01-01T16:00',
    lateStart: '2026-01-01T08:00', lateFinish: '2026-01-01T16:00',
    totalFloatMinutes: 8, freeFloatMinutes: -7,
  }] }]);
  eq('X12 integerafronding van halve minuten is hard rood', {
    tf: rounded.counters.tf.deviations, ff: rounded.counters.ff.deviations,
  }, { tf: 1, ff: 1 });
}

// Productmeetlat: missing/identiteit zijn harde, afzonderlijke kanalen; driving blijft bewust
// rapportage buiten de zesassige nulpoort.
{
  const bytes = new TextEncoder().encode([
    '%T\tTASK',
    '%F\tproj_id\ttask_id\ttask_code\tstatus_code\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt\tdriving_path_flag',
    '%R\tP\t1\tA\tTK_NotStart\t2026-01-01 08:00\t2026-01-01 16:00\t2026-01-01 08:00\t2026-01-01 16:00\t0\t0\tY',
    '%E',
  ].join('\n'));
  const truth = scanXerGroundTruth(bytes);
  const exactTask = {
    sourceTaskId: '1', taskCode: 'A', earlyStart: '2026-01-01T08:00',
    earlyFinish: '2026-01-01T16:00', lateStart: '2026-01-01T08:00',
    lateFinish: '2026-01-01T16:00', totalFloatMinutes: 0, freeFloatMinutes: 0,
    drivingPath: false,
  };
  const missing = measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [{
    ...exactTask, earlyStart: undefined,
  }] }]);
  eq('X12 truth aanwezig plus ours ontbreekt telt meetbaar missing en deviation', missing.counters.es,
    { exact: 0, sameday: 0, diff: 0, missing: 1, measurable: 1, deviations: 1 });

  const errorCases = {
    extraProject: measureXerProductFidelity(truth, [
      { projectId: 'P', tasks: [exactTask] }, { projectId: 'Q', tasks: [] },
    ]).errors,
    missingProject: measureXerProductFidelity(truth, []).errors,
    duplicateProject: measureXerProductFidelity(truth, [
      { projectId: 'P', tasks: [exactTask] }, { projectId: 'P', tasks: [exactTask] },
    ]).errors,
    extraTask: measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [
      exactTask, { ...exactTask, sourceTaskId: '2', taskCode: 'B' },
    ] }]).errors,
    missingTask: measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [] }]).errors,
    duplicateTask: measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [exactTask, exactTask] }]).errors,
    emptyCode: measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [{ ...exactTask, taskCode: '' }] }]).errors,
    wrongCode: measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [{ ...exactTask, taskCode: 'B' }] }]).errors,
  };
  eq('X12 project-/taakidentiteitsfouten blijven hard en afzonderlijk benoemd', errorCases, {
    extraProject: ['extra project Q'],
    missingProject: ['ontbrekend project P', 'project P: ontbrekende taak 1'],
    duplicateProject: ['dubbel opgelost project P'],
    extraTask: ['project P: extra taak 2'],
    missingTask: ['project P: ontbrekende taak 1'],
    duplicateTask: ['project P: dubbele opgeloste taak-id 1'],
    emptyCode: ['project P/taak 1: taskCode is leeg'],
    wrongCode: ['project P/taak 1: code verwacht A, kreeg B'],
  });
  const invalidDateTruth = scanXerGroundTruth(new TextEncoder().encode([
    '%T\tTASK',
    '%F\tproj_id\ttask_id\ttask_code\tstatus_code\tearly_start_date',
    '%R\tP\t1\tA\tTK_NotStart\tgeen-datum',
    '%E',
  ].join('\n')));
  const separatedErrors = measureXerProductFidelity(invalidDateTruth, [{
    projectId: 'P', tasks: [{ sourceTaskId: '1', taskCode: 'A' }],
  }]);
  eq('X12 scanner- en identiteitsfouten blijven afzonderlijke harde kanalen', {
    scannerErrors: separatedErrors.scannerErrors,
    identityErrors: separatedErrors.identityErrors,
    gatePassed: separatedErrors.gatePassed,
  }, {
    scannerErrors: ['TASK 1/early_start_date: ongeldige datum "geen-datum"'],
    identityErrors: [],
    gatePassed: false,
  });
  const drivingOnly = measureXerProductFidelity(truth, [{ projectId: 'P', tasks: [exactTask] }]);
  eq('X12 driving-path wijkt apart af maar blokkeert de zesassige nulpoort niet', {
    drivingPath: drivingOnly.drivingPath,
    sixAxisDeviations: XER_FIDELITY_AXES.reduce(
      (sum, axis) => sum + drivingOnly.counters[axis].deviations, 0),
    gatePassed: drivingOnly.gatePassed,
  }, {
    drivingPath: { exact: 0, sameday: 0, diff: 1, missing: 0, measurable: 1, deviations: 1 },
    sixAxisDeviations: 0,
    gatePassed: true,
  });
}

// X-O2/X4b-contract: een uitgesloten baseline-PROJECT blijft via `project.baselines` een echte
// productuitkomst. De meetadapter mag daarom niet alleen de geopende documentresultaten tellen.
// Deze fixture bevat bewust geen P6-rekenuitvoer; hij beschermt uitsluitend bronidentiteit.
{
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tsum_base_proj_id\tplan_start_date',
    '%R\tP-MAIN\tHuidig\tP-BASE\t2026-01-01 08:00',
    '%R\tP-BASE\tBaseline\t\t2025-12-01 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    '%R\tM-1\tP-MAIN\tMAIN-100\tHuidige taak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-01-01 08:00\t2026-01-01 16:00\t0\t0',
    '%R\tB-1\tP-BASE\tBASE-100\tBaselinetaak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2025-12-01 08:00\t2025-12-01 16:00\t0\t0',
    '%E',
  ].join('\n'));
  const opened = readXER(bytes);
  if (!isMultiDocumentImport(opened)) throw new Error('X12-baselinefixture moet meervoudig importeren');
  const truth = scanXerGroundTruth(bytes);
  const baselineIdentity = measureXerProductFidelity(
    truth,
    solveProductProjects(opened.results),
  );
  const measured = measureXerProductFidelity(
    truth,
    solveProductProjects(opened.taskProjects.map(document => document.result)),
  );
  eq('X12 productadapter telt gematerialiseerd baselineproject en brontaakidentiteit', {
    truthProjects: measured.truthProjects,
    solvedProjects: measured.solvedProjects,
    truthTasks: measured.truthTasks,
    solvedTasks: measured.solvedTasks,
    baselineIdentityErrors: baselineIdentity.errors,
    errors: measured.errors,
    tf: measured.counters.tf,
    ff: measured.counters.ff,
  }, {
    truthProjects: 2,
    solvedProjects: 2,
    truthTasks: 2,
    solvedTasks: 2,
    baselineIdentityErrors: [],
    errors: [],
    tf: { exact: 2, sameday: 0, diff: 0, missing: 0, measurable: 2, deviations: 0 },
    ff: { exact: 2, sameday: 0, diff: 0, missing: 0, measurable: 2, deviations: 0 },
  });
}

// Bronsemantische readerprobe voor de finishmijlpaalgrens. Positief is uitsluitend de gesloten
// TT_FinMile-vorm op bandstart+1; een gewone taak en een andere minuut zijn negatieve controles.
{
  const calendarData = fiveDayCalendarData('08:00', '16:00');
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tGrenskalender\tCA_Base\t8\t40\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tMijlpaalgrens\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tF\tP\tC1\tF\tFinishgrens\tTT_FinMile\tDT_FixedDUR2\tTK_NotStart\t0\t0\t2026-01-05 08:01\t2026-01-05 08:01',
    '%R\tN\tP\tC1\tN\tAndere minuut\tTT_FinMile\tDT_FixedDUR2\tTK_NotStart\t0\t0\t2026-01-05 08:02\t2026-01-05 08:02',
    '%R\tT\tP\tC1\tT\tGewone taak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t0\t0\t2026-01-05 08:01\t2026-01-05 08:01',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 finishgrens-readerfixture moet enkelproject zijn');
  const byCode = (code: string) => imported.tasks.find(task => task.wbsCode === code)?.time;
  eq('X12 TT_FinMile-correctie is positief en negatief bronmatig begrensd', {
    positive: [byCode('F')?.scheduleStart, byCode('F')?.scheduleFinish],
    otherMinute: [byCode('N')?.scheduleStart, byCode('N')?.scheduleFinish],
    ordinaryTask: [byCode('T')?.scheduleStart, byCode('T')?.scheduleFinish],
  }, {
    positive: ['2026-01-05T08:00', '2026-01-02T16:00'],
    otherMinute: ['2026-01-05T08:02', '2026-01-05T08:02'],
    ordinaryTask: ['2026-01-05T08:01', '2026-01-05T08:01'],
  });
}

// Bronsemantische duurprobe voor lege CALENDAR.clndr_data: een hele-dag-anker maakt de band
// afleidbaar; een fractionele slotdag mag dan het duurvenster herstellen, een breed venster niet.
{
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tLege bronkalender\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tDuurvenster\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP\tC1\tA\tBandanker\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tF\tP\tC1\tF\tFractionele slotdag\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t11\t11\t2026-01-05 08:00\t2026-01-06 12:00',
    '%R\tW\tP\tC1\tW\tBreed doelvenster\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-09 16:00',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 duurvensterfixture moet enkelproject zijn');
  const duration = (code: string) => imported.tasks.find(task => task.wbsCode === code)?.time.durationMinutes;
  eq('X12 targetvenster herstelt alleen de afleidbare fractionele slotdag', {
    anchor: duration('A'), fractional: duration('F'), wide: duration('W'),
  }, { anchor: 480, fractional: 720, wide: 480 });
}

// Corpusloze P6 case 09: een historische, voltooide opvolger is géén late-pass-eindpunt voor
// een nog open voorganger. Deze invoer volgt uitsluitend de invoerzijde van de P6-23.12-capture
// (projectstart/statusdatum, FS, actuals). BELANGRIJK voor D3/D4: de capture normaliseert bij een
// gestarte taak ACT_START naar ES én LS, en bij een voltooide taak ACT_END naar EF én LF. De B-
// verwachting hieronder beschermt dus de captureweergave en de backward-doorwerking op A, maar is
// UITDRUKKELIJK GEEN raw-XER-bewijs dat P6 late datums algemeen op actuals zet. Raw-XER-orakels
// (zoals rehab-2) blijven de enige meetlat voor die afzonderlijke semantiek.
{
  const calendarData = fiveDayCalendarData('08:00', '17:00');
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tP6 5x9\tCA_Base\t9\t45\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tP6 case 09\tC1\t2026-01-05 08:00\t2025-12-01 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tact_start_date\tact_end_date',
    '%R\tA\tP\tC1\tA100\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t45\t45\t\t',
    '%R\tB\tP\tC1\tB100\tVoltooide opvolger\tTT_Task\tDT_FixedDUR2\tTK_Complete\t99\t0\t2025-12-15 08:00\t2025-12-30 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 P6 case-09-fixture moet enkelproject zijn');
  const solved = solveImported(imported).tasks;
  const open = solved.find(task => task.taskCode === 'A100');
  const completed = solved.find(task => task.taskCode === 'B100');
  eq('X12 P6 case 09: historical completed successor releases the predecessor late pass', {
    open: [open?.earlyStart, open?.earlyFinish, open?.lateStart, open?.lateFinish,
      open?.totalFloatMinutes, open?.freeFloatMinutes],
    completed: [completed?.earlyStart, completed?.earlyFinish, completed?.lateStart, completed?.lateFinish],
  }, {
    open: ['2026-01-05T08:00', '2026-01-09T17:00', '2026-01-05T08:00', '2026-01-09T17:00', 0, 0],
    completed: ['2025-12-15T08:00', '2025-12-30T17:00', '2025-12-15T08:00', '2025-12-30T17:00'],
  });
}

// X12 late-passfixture: P6 behandelt een verbonden, open TT_FinMile als een eigen
// contracteindpunt. LS/LF blijven op de geplande start-/vorige-finishgrens, terwijl FF nog steeds
// de vrije ruimte tot het latere projecteinde meet. Een losse finishmijlpaal mag deze bronregel niet
// activeren; de echte voorgangerverbinding is onderdeel van het contract.

// D1/D2 gebruiken dezelfde korte P6-FS-keten. P6's opgeslagen rekenuitvoer komt nergens in deze
// invoer voor; ES/EF/LS/LF/TF/FF worden uitsluitend door de productsolver bepaald. De finishmijlpaal
// maakt de start-/finishgrens zichtbaar zonder een tweede, niet-gerelateerde eindtak als projectanker.
{
  const calendarData = fiveDayCalendarData('08:00', '17:00');
  function d1Bytes(withScheduleOptions: boolean): Uint8Array {
    return new TextEncoder().encode([
      'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
      '%T\tCALENDAR',
      '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
      `%R\tC1\tD1 5x9\tCA_Base\t9\t45\t${calendarData}`,
      '%T\tPROJECT',
      '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
      '%R\tP\tD1 einde als floatgrens\tC1\t2026-01-05 08:00\t2026-01-05 08:00\t2026-01-09 17:00',
      '%T\tTASK',
      '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
      '%R\tA\tP\tC1\tA100\tFS-voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00',
      '%R\tM\tP\tC1\tM100\tFinishmijlpaal\tTT_FinMile\tDT_FixedDUR2\tTK_NotStart\t0\t0\t2026-01-06 08:01\t2026-01-06 08:01',
      '%T\tTASKPRED',
      '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
      '%R\tR1\tM\tA\tP\tP\tPR_FS\t0',
      ...(withScheduleOptions ? [
        '%T\tSCHEDOPTIONS',
        '%F\tproj_id\tsched_float_type\tsched_use_project_end_date_for_float',
        '%R\tP\tFT_FF\tY',
      ] : []),
      '%E',
    ].join('\n'));
  }
  const without = readXER(d1Bytes(false));
  const explicit = readXER(d1Bytes(true));
  if (isMultiDocumentImport(without) || isMultiDocumentImport(explicit)) {
    throw new Error('X12 D1 moet tweemaal enkelproject importeren');
  }
  const defaultTasks = solveImported(without).tasks;
  const explicitTasks = solveImported(explicit).tasks;
  const pick = (tasks: XerSolvedProject['tasks'], code: string) => tasks.find(task => task.taskCode === code);
  const defaultPredecessor = pick(defaultTasks, 'A100');
  const defaultMilestone = pick(defaultTasks, 'M100');
  const explicitPredecessor = pick(explicitTasks, 'A100');
  const explicitMilestone = pick(explicitTasks, 'M100');
  // D1: alleen de expliciete P6-einddatumschakelaar mag het PROJECT-einde als late-pass-anker maken.
  eq('X12 D1: expliciete P6-projecteindfloat stuurt de verbonden finishmijlpaal en FS-voorganger', {
    options: [explicit.project.schedulingOptions?.totalFloatMode,
      explicit.project.schedulingOptions?.useProjectEndDateForFloat],
    explicitPredecessor: [explicitPredecessor?.lateStart, explicitPredecessor?.lateFinish,
      explicitPredecessor?.totalFloatMinutes, explicitPredecessor?.freeFloatMinutes],
    explicitMilestone: [explicitMilestone?.lateStart, explicitMilestone?.lateFinish,
      explicitMilestone?.totalFloatMinutes, explicitMilestone?.freeFloatMinutes],
  }, {
    options: ['finish', true],
    explicitPredecessor: ['2026-01-09T08:00', '2026-01-09T17:00', 2160, 0],
    explicitMilestone: ['2026-01-09T17:00', '2026-01-09T17:00', 2160, 0],
  });
  // D2 volgt pas na D1: FT_FF is al de XER-default, maar de afwezige end-date-vlag houdt
  // PROJECT.plan_end_date nadrukkelijk buiten de late pass. Daardoor is de vergelijking geen
  // impliciete omschakeling naar OPS' algemene `smallest`-modus.
  eq('X12 D2: zonder SCHEDOPTIONS blijft FT_FF actief maar is de projecteindfloat uit', {
    defaultOptions: [without.project.schedulingOptions?.totalFloatMode,
      without.project.schedulingOptions?.useProjectEndDateForFloat],
    defaultPredecessor: [defaultPredecessor?.lateStart, defaultPredecessor?.lateFinish,
      defaultPredecessor?.totalFloatMinutes, defaultPredecessor?.freeFloatMinutes],
    defaultMilestone: [defaultMilestone?.lateStart, defaultMilestone?.lateFinish,
      defaultMilestone?.totalFloatMinutes, defaultMilestone?.freeFloatMinutes],
    differsFromD1: defaultPredecessor?.lateFinish !== explicitPredecessor?.lateFinish,
  }, {
    defaultOptions: ['finish', undefined],
    defaultPredecessor: ['2026-01-05T08:00', '2026-01-05T17:00', 0, 0],
    defaultMilestone: ['2026-01-06T08:00', '2026-01-05T17:00', 0, 0],
    differsFromD1: true,
  });
}

{
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-04-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tOpen eindmijlpaal\tC1\t2026-04-01 08:00\t2026-04-01 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\t1\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-04-01 08:00\t2026-04-01 17:00',
    '%R\t2\tP\tC1\tA200\tContracteinde\tTT_FinMile\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-04-02 08:01\t2026-04-02 08:01',
    '%R\t3\tP\tC1\tA300\tLater projecteinde\tTT_FinMile\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-04-10 08:01\t2026-04-10 08:01',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\t2\t1\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 open-eindfixture moet enkelproject zijn');
  const task = solveImported(imported).tasks.find(candidate => candidate.taskCode === 'A200');
  eq('X12 verbonden open TT_FinMile houdt late grens maar behoudt vrije ruimte tot projecteinde', {
    lateStart: task?.lateStart,
    lateFinish: task?.lateFinish,
    totalFloatMinutes: task?.totalFloatMinutes,
    freeFloatMinutes: task?.freeFloatMinutes,
  }, {
    lateStart: '2026-04-02T08:00',
    lateFinish: '2026-04-01T17:00',
    totalFloatMinutes: 0,
    freeFloatMinutes: 2880,
  });
  const noSource = readXER(bytes);
  const explicitOff = readXER(bytes);
  if (isMultiDocumentImport(noSource) || isMultiDocumentImport(explicitOff)) {
    throw new Error('X12 finishmijlpaal-provenancefixture moet enkelproject zijn');
  }
  delete noSource.project.schedulingOptions?.p6Source;
  delete explicitOff.project.schedulingOptions?.p6Source;
  if (explicitOff.project.schedulingOptions) {
    explicitOff.project.schedulingOptions.p6FinishMilestoneBoundaryWindow = false;
  }
  const noSourceTask = solveImported(noSource).tasks.find(candidate => candidate.taskCode === 'A200');
  const explicitOffTask = solveImported(explicitOff).tasks.find(candidate => candidate.taskCode === 'A200');
  eq('X12 p6FinishMilestoneBoundaryWindow is inert zonder XER-projectprovenance', {
    noSource: [noSourceTask?.lateStart, noSourceTask?.lateFinish, noSourceTask?.totalFloatMinutes],
    explicitOff: [explicitOffTask?.lateStart, explicitOffTask?.lateFinish, explicitOffTask?.totalFloatMinutes],
    differsFromProven: noSourceTask?.lateFinish !== task?.lateFinish,
  }, {
    noSource: [explicitOffTask?.lateStart, explicitOffTask?.lateFinish, explicitOffTask?.totalFloatMinutes],
    explicitOff: [explicitOffTask?.lateStart, explicitOffTask?.lateFinish, explicitOffTask?.totalFloatMinutes],
    differsFromProven: true,
  });
}

// Ook taakvloer en exact constraint-instant zijn uitsluitend P6-XER-projecties. Een gewone
// solver/IFC-payload die alleen gelijknamige booleans bevat, maar geen bronstempel, moet exact het
// expliciet-uitgeschakelde gedrag houden.
{
  const calendarData = fiveDayCalendarData('08:00', '16:00');
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tP6 taakprovenance\tC1\t2026-01-01 08:00\t2026-01-01 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tcstr_type\tcstr_date',
    '%R\tPRED\tP\tC1\tPRED\tVoorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-01-01 08:00\t2026-01-01 16:00\t\t',
    '%R\tFLOOR\tP\tC1\tFLOOR\tGeplande vloer\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00\t\t',
    '%R\tMILE\tP\tC1\tMILE\tExacte grens\tTT_Mile\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-01-08 08:00\t2026-01-08 08:00\tCS_MSOB\t2026-01-08 08:00',
    '%R\tLATE\tP\tC1\tLATE\tLater einde\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-01-12 08:00\t2026-01-12 16:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tFLOOR\tPRED\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const proven = readXER(bytes);
  const noSource = readXER(bytes);
  const explicitOff = readXER(bytes);
  if (isMultiDocumentImport(proven) || isMultiDocumentImport(noSource)
    || isMultiDocumentImport(explicitOff)) throw new Error('X12 taakprovenancefixture moet enkelproject zijn');
  delete noSource.project.schedulingOptions?.p6Source;
  delete explicitOff.project.schedulingOptions?.p6Source;
  if (explicitOff.project.schedulingOptions) {
    explicitOff.project.schedulingOptions.p6UseTaskPlannedStartFloor = false;
    explicitOff.project.schedulingOptions.p6PreserveZeroDurationConstraintInstants = false;
  }
  const resultOf = (input: ImportResult) => {
    const solved = solveImported(input).tasks;
    const floor = solved.find(task => task.taskCode === 'FLOOR');
    const milestone = solved.find(task => task.taskCode === 'MILE');
    return [floor?.earlyStart, milestone?.lateStart, milestone?.lateFinish];
  };
  const provenResult = resultOf(proven);
  const noSourceResult = resultOf(noSource);
  const offResult = resultOf(explicitOff);
  eq('X12 taakvloer en nulduurconstraint vereisen XER-projectprovenance', {
    proven: provenResult,
    noSource: noSourceResult,
    explicitOff: offResult,
  }, {
    proven: ['2026-01-05T08:00', '2026-01-08T08:00', '2026-01-08T08:00'],
    noSource: offResult,
    explicitOff: offResult,
  });
  const hostileExt = readXER(bytes);
  if (isMultiDocumentImport(hostileExt)) throw new Error('X12 extensiesolvefixture moet enkelproject zijn');
  const hostilePredecessor = hostileExt.tasks.find(task => task.wbsCode === 'PRED');
  const hostileSourceTask = hostileExt.tasks.find(task => task.wbsCode === 'FLOOR');
  const hostileSequence = hostileExt.sequences.find(sequence => sequence.successorId === hostileSourceTask?.id);
  if (!hostilePredecessor || !hostileSourceTask || !hostileSequence) {
    throw new Error('X12 extensiesolvefixture mist PRED → FLOOR');
  }
  // Dit object stelt rechtstreeks een ongetypeerde JS-extensieruntime voor. Er loopt bewust geen
  // `toExtProject`/`toExtTask` vóór: die uitleesmappers zouden de vervalste invoer al saneren en
  // daarmee precies de from-extensiongrens maskeren die deze fixture moet bewaken.
  const hostileRuntimeProject = {
    ...hostileExt.project,
    schedulingOptions: {
      ...hostileExt.project.schedulingOptions,
      p6Source: 'XER',
      p6UseTaskPlannedStartFloor: true,
      p6PreserveZeroDurationConstraintInstants: true,
    },
  } as unknown as Parameters<typeof fromExtProject>[0];
  const hostileRuntimeTask = {
    ...hostileSourceTask,
    time: {
      ...hostileSourceTask.time,
      completion: 0.5,
      actualStart: '2026-01-01T08:00',
      actualFinish: undefined,
      remainingTime: 1,
      remainingMinutes: 480,
      resume: '2026-01-06T08:00',
      stop: undefined,
    },
    p6DurationType: 'DT_FixedDUR2',
    p6ActivityType: 'TT_Rsrc',
    p6ProjectId: 'FORGED-PROJECT',
    p6TaskId: 'FORGED-TASK',
    p6CompletePctType: 'CP_Phys',
    p6ExpectedFinish: '2026-01-30T17:00',
    p6SuspendResume: true,
  } as unknown as Parameters<typeof fromExtTask>[0];
  const importedHostileTask = fromExtTask(hostileRuntimeTask);
  const genericExtensionImport: ImportResult = {
    ...hostileExt,
    project: fromExtProject(hostileRuntimeProject),
    calendar: fromExtCalendar({ ...hostileExt.calendar } as Parameters<typeof fromExtCalendar>[0]),
    // De echte netwerkrelatie blijft bewust in de hostile invoer. Zonder PRED → FLOOR is de
    // planned-start-floor niet te onderscheiden van een gewone worteltaakstart en meet deze
    // fixture een objectvorm in plaats van de solveruitkomst die door de vervalste vlag wijzigt.
    tasks: [
      fromExtTask({ ...hostilePredecessor } as Parameters<typeof fromExtTask>[0]),
      importedHostileTask,
    ],
    sequences: [fromExtSequence({ ...hostileSequence } as Parameters<typeof fromExtSequence>[0])],
  };
  const hostileSolve = solveProject({
    tasks: genericExtensionImport.tasks,
    sequences: genericExtensionImport.sequences,
    calendar: genericExtensionImport.calendar,
    calendars: genericExtensionImport.resourceCalendars ?? [],
    dataDate: genericExtensionImport.project.statusDate,
    progressMode: genericExtensionImport.project.progressMode,
    schedulingOptions: genericExtensionImport.project.schedulingOptions,
    projectStartDate: genericExtensionImport.project.startDate,
    projectEndDate: genericExtensionImport.project.endDate,
  });
  if (hostileSolve.error) throw new Error(`X12 hostile extensiesolve faalt: ${hostileSolve.error}`);
  const hostileSolvedTask = hostileSolve.tasks.get(importedHostileTask.id);
  eq('X12 generieke extensie-import kan interne P6-opties niet via de echte solve activeren', {
    projectSource: genericExtensionImport.project.schedulingOptions?.p6Source,
    plannedStartFloor: genericExtensionImport.project.schedulingOptions?.p6UseTaskPlannedStartFloor,
    taskProvenance: {
      p6DurationType: importedHostileTask.p6DurationType,
      p6ActivityType: importedHostileTask.p6ActivityType,
      p6ProjectId: importedHostileTask.p6ProjectId,
      p6TaskId: importedHostileTask.p6TaskId,
      p6CompletePctType: importedHostileTask.p6CompletePctType,
      p6ExpectedFinish: importedHostileTask.p6ExpectedFinish,
      p6SuspendResume: importedHostileTask.p6SuspendResume,
    },
    solvedEarlyStart: hostileSolvedTask?.earlyStart,
    solvedEarlyFinish: hostileSolvedTask?.earlyFinish,
    appliedEarlyStart: hostileSolvedTask?.earlyStart,
  }, {
    projectSource: undefined,
    plannedStartFloor: undefined,
    taskProvenance: {},
    // Zonder vervalste P6-bronstempel blijft de planned-start-floor inert. De generieke solver
    // kiest hier zijn gewone project-/netwerkvenster; een mutatie die `fromExtProject` met een
    // objectspread laat terugschrijven activeert de P6-vloer en maakt precies deze solve-assert
    // rood (FLOOR schuift dan naar zijn geplande 5 januari-anker).
    solvedEarlyStart: '2026-01-01T08:00',
    solvedEarlyFinish: '2026-01-06T16:00',
    appliedEarlyStart: '2026-01-01T08:00',
  });
}

// Negatieve bronprobe voor de geplande startvloer: een doelstart precies één kalenderdag na een
// geldige netwerkgrens is geen impliciete constraint. Alleen de ruimere positieve vorm hierboven
// (begin én einde meer dan één dag later) mag de XER-vloer activeren.
{
  const calendarData = fiveDayCalendarData('08:00', '16:00');
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStartvloer\tCA_Base\t8\t40\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tStartvloergrens\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tM\tP\tC1\tM\tNetwerkpunt\tTT_Mile\tDT_FixedDUR2\tTK_NotStart\t0\t0\t2026-01-05 08:00\t2026-01-05 08:00',
    '%R\tN\tP\tC1\tN\tVolgende dag is geen vloer\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-06 08:00\t2026-01-06 16:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tN\tM\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 startvloer-negatief moet enkelproject zijn');
  const successor = solveImported(imported).tasks.find(task => task.taskCode === 'N');
  eq('X12 geplande startvloer blijft uit op de één-daggrens', {
    source: imported.project.schedulingOptions?.p6Source,
    option: imported.project.schedulingOptions?.p6UseTaskPlannedStartFloor,
    earlyStart: successor?.earlyStart,
  }, { source: 'XER', option: true, earlyStart: '2026-01-05T08:00' });
}

// P6-XER gebruikt voor een lopende activiteit de start van het resterende werk als Early Start.
// Actual Start blijft bronhistorie, maar mag de zesassige resterende netwerkdatum niet vervangen.
// De vlag komt uitsluitend uit het XER-importpad; dezelfde solver zonder vlag houdt zijn bestaande
// MSP/IFC-actual-weergave.
{
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-12\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||3()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||4()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||5()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||6()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||7()())))(0||Exceptions())))',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\trem_target_link_flag\tlast_recalc_date\tplan_start_date',
    '%R\tP\tResterend werk\tC1\tY\t2026-01-12 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tact_start_date\ttarget_start_date\ttarget_end_date',
    '%R\t1\tP\tC1\tA100\tLopende taak\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Phys\t50\t24\t16\t2026-01-06 08:00\t2026-01-05 08:00\t2026-01-07 17:00',
    '%R\t2\tP\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Phys\t0\t8\t8\t\t2026-01-08 08:00\t2026-01-08 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\t2\t1\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 resterend-werkfixture moet enkelproject zijn');
  const task = solveImported(imported).tasks.find(candidate => candidate.taskCode === 'A100');
  eq('X12 lopende XER-taak gebruikt resterende start op de statusdatum voor ES en LS', {
    earlyStart: task?.earlyStart,
    lateStart: task?.lateStart,
  }, {
    earlyStart: '2026-01-12T08:00',
    lateStart: '2026-01-12T08:00',
  });
  const unlinkedBytes = new TextEncoder().encode(
    new TextDecoder().decode(bytes).replace('\tY\t2026-01-12 08:00', '\tN\t2026-01-12 08:00'),
  );
  const unlinked = readXER(unlinkedBytes);
  if (isMultiDocumentImport(unlinked)) throw new Error('X12 actual-starttegenvoorbeeld moet enkelproject zijn');
  const unlinkedTask = solveImported(unlinked).tasks.find(candidate => candidate.taskCode === 'A100');
  eq('X12 zonder resterend-doelkoppeling blijft de zichtbare Actual Start ongewijzigd', {
    sourceFlag: unlinked.project.schedulingOptions?.p6UseRemainingStartForProgress,
    earlyStart: unlinkedTask?.earlyStart,
  }, {
    sourceFlag: false,
    earlyStart: '2026-01-06T08:00',
  });
}

// Afzonderlijke auditgrensprobe. De oude gecombineerde completed-chainfixture had ongeldige
// `clndr_data`: de reader meldde XER_CALENDAR_INVALID_STRUCTURE en viel gedocumenteerd terug op
// 08:00-16:00. Daardoor ontstond 16:00; dat was geen finish-inclusiviteits- of late-passfout.
// Deze fixture bewijst uitsluitend dat één effectieve dag op een syntactisch geldige 08:00-17:00-
// kalender exact op 17:00 eindigt. Completed-successorsemantiek blijft onafhankelijk gepind door
// de gehashte echte P6-capture in cases-p6-verified.json geval 09 en check-p6-verified-cases.ts.
{
  const calendarData = fiveDayCalendarData('08:00', '17:00');
  const xerLines = [
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x9\tCA_Base\t9\t45\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tFinishgrensprobe\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\t1\tP\tC1\tA100\tEen effectieve dag\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00',
    '%E',
  ];
  const bytes = new TextEncoder().encode(xerLines.join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 finishgrensfixture moet enkelproject zijn');
  const engine = new CalendarEngine(imported.calendar);
  const start = new Date('2026-01-05T08:00:00Z');
  const solved = solveImported(imported).tasks.find(task => task.taskCode === 'A100');
  eq('X12 geldige negenuurskalender bewaart de 17:00-finishgrens', {
    bands: engine.effectiveBandsOn(start),
    effectiveDayMinutes: engine.hoursPerDay * 60,
    calendarFinish: engine.addWorkMinutes(start, engine.hoursPerDay * 60).toISOString().slice(0, 16),
    productEarlyFinish: solved?.earlyFinish,
  }, {
    bands: [{ start: 480, end: 1020 }],
    effectiveDayMinutes: 540,
    calendarFinish: '2026-01-05T17:00',
    productEarlyFinish: '2026-01-05T17:00',
  });

  // Mutatiebewijs: breek alleen de kalenderstructuur terug naar de oude recordvorm. De reader
  // activeert dan aantoonbaar de 08:00-16:00-fallback en uitsluitend deze grensprobe verliest 17:00.
  const malformedCalendarData = '(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|17:00)())))(0||3()((0||0(s|08:00|f|17:00)())))(0||4()((0||0(s|08:00|f|17:00)())))(0||5()((0||0(s|08:00|f|17:00)())))(0||6()((0||0(s|08:00|f|17:00)())))))(0||Exceptions())))';
  const malformedBytes = new TextEncoder().encode(
    xerLines.join('\n').replace(calendarData, malformedCalendarData),
  );
  const malformed = readXER(malformedBytes);
  if (isMultiDocumentImport(malformed)) throw new Error('X12 gemuteerde finishgrensfixture moet enkelproject zijn');
  const malformedEngine = new CalendarEngine(malformed.calendar);
  eq('X12 kalenderstructuurmutatie maakt precies de 17:00-grensprobe rood', {
    bands: malformedEngine.effectiveBandsOn(start),
    effectiveDayMinutes: malformedEngine.hoursPerDay * 60,
    mutatedFinish: malformedEngine.addWorkMinutes(start, malformedEngine.hoursPerDay * 60)
      .toISOString().slice(0, 16),
    wouldPassBoundaryProbe: malformedEngine.addWorkMinutes(start, malformedEngine.hoursPerDay * 60)
      .toISOString().slice(0, 16) === '2026-01-05T17:00',
  }, {
    bands: [{ start: 480, end: 960 }],
    effectiveDayMinutes: 480,
    mutatedFinish: '2026-01-05T16:00',
    wouldPassBoundaryProbe: false,
  });
}

// Een P6-FS met nul lag mag de opvolger exact op de finishgrens van zijn voorganger zetten.
// Dit is niet de algemene halfopen-bandregel: uitsluitend de reader mag de brongebonden vlag
// afleiden uit de geplande P6-invoer. De fixture is de kleine, corpusloze tegenhanger van de
// 17:00-grenzen die in rehab-2 en Gimmer voorkomen.
{
  const calendarData = fiveDayCalendarData('08:00', '17:00');
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x9\tCA_Base\t9\t45\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tFS-finishgrens\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tB\tP\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 17:00\t2026-01-06 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 FS-finishgrensfixture moet enkelproject zijn');
  const predecessor = solveImported(imported).tasks.find(task => task.taskCode === 'A100');
  const successor = solveImported(imported).tasks.find(task => task.taskCode === 'B100');
  eq('X12 P6 FS-nul-lag bewaart de gedeelde finish/start-minuut', {
    sourceFlag: imported.sequences.find(sequence => sequence.id === 'R1')?.p6StartAtPredecessorFinishBoundary,
    predecessorFinish: predecessor?.earlyFinish,
    successorStart: successor?.earlyStart,
    successorFinish: successor?.earlyFinish,
  }, {
    sourceFlag: true,
    predecessorFinish: '2026-01-05T17:00',
    successorStart: '2026-01-05T17:00',
    successorFinish: '2026-01-06T17:00',
  });

  // De relatievlag kan in een generieke payload nog aanwezig zijn, maar mag zonder de centrale
  // XER-bronstempel geen enkel forward- of backward-pad bereiken. Vergelijk met dezelfde XER
  // input waarin uitsluitend de vlag zelf is weggehaald: alle zes taakassen moeten identiek zijn.
  const genericPayload = readXER(bytes);
  const explicitNoBoundary = readXER(bytes);
  if (isMultiDocumentImport(genericPayload) || isMultiDocumentImport(explicitNoBoundary)) {
    throw new Error('X12 relatie-firewallfixture moet enkelproject zijn');
  }
  delete genericPayload.project.schedulingOptions?.p6Source;
  delete explicitNoBoundary.sequences[0]?.p6StartAtPredecessorFinishBoundary;
  const relationAxes = (input: ImportResult) => solveImported(input).tasks.map(task => [
    task.taskCode, task.earlyStart, task.earlyFinish, task.lateStart, task.lateFinish,
    task.totalFloatMinutes, task.freeFloatMinutes,
  ]);
  eq('X12 generieke payload met rauwe P6-relatievlag is solver-identiek aan geen vlag',
    relationAxes(genericPayload), relationAxes(explicitNoBoundary));

  // De vlag is niet alleen opgeslagen metadata: na XER → IFC → inlezen moet hij nog steeds de
  // exacte 17:00-boundary dragen. Dit maakt de IFC-ronde een datumpariteitscheck, geen velddump.
  const roundTripped = readIFC(writeIFC(imported));
  const roundTripSolve = solveProject({
    tasks: roundTripped.tasks,
    sequences: roundTripped.sequences,
    calendar: roundTripped.calendar,
    calendars: roundTripped.resourceCalendars ?? [],
    dataDate: roundTripped.project.statusDate,
    progressMode: roundTripped.project.progressMode,
    schedulingOptions: roundTripped.project.schedulingOptions,
    projectStartDate: roundTripped.project.startDate,
    projectEndDate: roundTripped.project.endDate,
  });
  if (roundTripSolve.error) throw new Error(roundTripSolve.error);
  // XER-bronidentiteiten zijn na IFC bewust niet nodig voor de app-solve; de taaknamen zijn hier
  // het stabiele, door IFC bewaarde identificatiemiddel van deze synthetische tweetaaksfixture.
  const rtPredecessor = roundTripped.tasks.find(task => task.name === 'Voorganger');
  const rtSuccessor = roundTripped.tasks.find(task => task.name === 'Opvolger');
  eq('X12 XER-IFC-XER bewaart de P6-FS-finishgrens in de echte datumuitkomst', {
    relationFlag: roundTripped.sequences[0]?.p6StartAtPredecessorFinishBoundary,
    predecessorFinish: rtPredecessor?.time.earlyFinish,
    successorStart: rtSuccessor?.time.earlyStart,
    successorFinish: rtSuccessor?.time.earlyFinish,
  }, {
    relationFlag: true,
    predecessorFinish: '2026-01-05T17:00',
    successorStart: '2026-01-05T17:00',
    successorFinish: '2026-01-06T17:00',
  });
}

// P6 werkdaglag op een finish-finishgrens bewaart de finishklok. Twee effectieve dagen terug vanaf
// woensdag 17:00 is maandag 17:00, niet dinsdag 08:00. Dit is een smalle XER-backwardprojectie;
// de generieke add/subtract-kalenderalgebra en andere formaten blijven fysiek.
{
  const calendarData = fiveDayCalendarData('08:00', '17:00');
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x9\tCA_Base\t9\t45\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tFF-lagfinishgrens\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\t1\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\t2\tP\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-07 08:00\t2026-01-07 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\t2\t1\tP\tP\tPR_FF\t18',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 FF-lagfinishgrensfixture moet enkelproject zijn');
  const tasks = solveImported(imported).tasks;
  const predecessor = tasks.find(task => task.taskCode === 'A100');
  const successor = tasks.find(task => task.taskCode === 'B100');
  eq('X12 P6 backward-werkdaglag bewaart de finishgrens', {
    predecessorLateFinish: predecessor?.lateFinish,
    successorLateFinish: successor?.lateFinish,
  }, {
    predecessorLateFinish: '2026-01-05T17:00',
    successorLateFinish: '2026-01-07T17:00',
  });
}

// X12 kalender-/late-passfixture: oude P6-XER-kalenders kunnen een vrije dag ook op een al
// niet-werkende weekdag opslaan en dezelfde vrije datum direct naast zichzelf herhalen. P6 telt
// beide bronvormen als een extra niet-werkdag in backward- en floatwandelingen; de forwardzijde
// blijft de fysieke kalender volgen. Een latere, niet-aangrenzende herhaling is alleen schema-
// herhaling en mag die straf niet nogmaals toevoegen.
{
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2025-12-31\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tP6 anomaliekalender\tCA_Base\t\t40\t(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||3()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||4()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||5()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||6()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||7()())))(0||Exceptions()((0||0(d|46025)())(0||1(d|46027)())(0||2(d|46027)())(0||3(d|46028)((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||4(d|46027)())))))',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tP6 kalenderanomalie\tC1\t2025-12-31 08:00\t2025-12-31 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\t1\tP\tC1\tA100\tWerk over anomalieën\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2025-12-31 08:00\t2026-01-08 17:00',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 kalenderanomaliefixture moet enkelproject zijn');
  const engine = new CalendarEngine(imported.calendar);
  const start = new Date('2025-12-31T08:00:00Z');
  const finish = new Date('2026-01-08T17:00:00Z');
  const physicalFinish = engine.addWorkMinutes(start, 1920);
  eq('X12 generieke kalenderalgebra blijft fysiek en in beide richtingen invers', {
    p6Source: imported.calendar.p6Source,
    penaltyDates: imported.calendar.p6NonWorkPenaltyDates,
    physicalFinish: physicalFinish.toISOString().slice(0, 16),
    subtractAdd: engine.subtractWorkMinutes(physicalFinish, 1920).toISOString().slice(0, 16),
    addSubtract: engine.addWorkMinutes(engine.subtractWorkMinutes(finish, 1920), 1920)
      .toISOString().slice(0, 16),
    betweenForward: engine.workMinutesBetween(start, physicalFinish),
    betweenBackward: engine.workMinutesBetween(physicalFinish, start),
  }, {
    p6Source: 'XER',
    penaltyDates: ['2026-01-03', '2026-01-05'],
    physicalFinish: '2026-01-06T17:00',
    subtractAdd: '2025-12-31T08:00',
    addSubtract: '2026-01-08T17:00',
    betweenForward: 1920,
    betweenBackward: -1920,
  });
  // Negatieve recordvormen in dezelfde bron: de werkende uitzondering (d|46028 met banden) en
  // de latere, niet-aangrenzende herhaling van d|46027 leveren geen derde strafdatum op.
  eq('X12 werkende en niet-aangrenzend herhaalde uitzonderingen activeren geen extra P6-straf',
    imported.calendar.p6NonWorkPenaltyDates, ['2026-01-03', '2026-01-05']);

  const explicitHoursBytes = new TextEncoder().encode(
    new TextDecoder().decode(bytes).replace('\tCA_Base\t\t40\t', '\tCA_Base\t8\t40\t'),
  );
  const explicitHours = readXER(explicitHoursBytes);
  if (isMultiDocumentImport(explicitHours)) throw new Error('X12 expliciete-dagurenfixture moet enkelproject zijn');
  eq('X12 dezelfde uitzonderingsrecords met expliciete day_hr_cnt krijgen geen afgeleide strafvlag',
    explicitHours.calendar.p6NonWorkPenaltyDates, undefined);

  const genericCalendar: WorkCalendar = { ...imported.calendar };
  delete genericCalendar.p6Source;
  const genericEngine = new CalendarEngine(genericCalendar);
  eq('X12 dezelfde datums zonder XER-provenance kunnen generieke kalenderalgebra niet wijzigen', {
    retainedDates: genericCalendar.p6NonWorkPenaltyDates,
    added: genericEngine.addWorkMinutes(start, 1920).toISOString().slice(0, 16),
    subtracted: genericEngine.subtractWorkMinutes(finish, 1920).toISOString().slice(0, 16),
    between: genericEngine.workMinutesBetween(start, finish),
  }, {
    retainedDates: ['2026-01-03', '2026-01-05'],
    added: '2026-01-06T17:00',
    subtracted: '2026-01-02T08:00',
    between: 2880,
  });

  const projectionBytes = new TextEncoder().encode(new TextDecoder().decode(bytes).replace(
    '%R\t1\tP\tC1\tA100\tWerk over anomalieën\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2025-12-31 08:00\t2026-01-08 17:00',
    [
      '%R\tA\tP\tC1\tA100\tBackward-projectie\tTT_Task\tDT_FixedDUR\tTK_NotStart\t24\t24\t2025-12-31 08:00\t2026-01-02 17:00',
      '%R\tX\tP\tC1\tX100\tVrije-floatprojectie\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2025-12-31 08:00\t2025-12-31 17:00',
      '%R\tB\tP\tC1\tB100\tGeplande opvolger\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-01-08 08:00\t2026-01-08 17:00',
      '%R\tLP\tP\tC1\tLP100\tLagvoorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2025-12-30 08:00\t2025-12-30 17:00',
      '%R\tLS\tP\tC1\tLS100\tLagopvolger\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-01-08 08:00\t2026-01-08 17:00',
      '%T\tTASKPRED',
      '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
      '%R\tR-A\tB\tA\tP\tP\tPR_FS\t0',
      '%R\tR-X\tB\tX\tP\tP\tPR_FS\t0',
      '%R\tR-LAG\tLS\tLP\tP\tP\tPR_FS\t32',
    ].join('\n'),
  ));
  const projectionImport = readXER(projectionBytes);
  if (isMultiDocumentImport(projectionImport)) throw new Error('X12 P6-projectiefixture moet enkelproject zijn');
  const projected = solveImported(projectionImport).tasks;
  const projectedTask = (code: string) => projected.find(task => task.taskCode === code);
  eq('X12 P6-XER-projectie raakt alleen backward, lag en float; forward blijft fysiek', {
    projectSource: projectionImport.project.schedulingOptions?.p6Source,
    calendarSource: projectionImport.calendar.p6Source,
    aEarlyFinish: projectedTask('A100')?.earlyFinish,
    aLateStart: projectedTask('A100')?.lateStart,
    aTotalFloat: projectedTask('A100')?.totalFloatMinutes,
    xTotalFloat: projectedTask('X100')?.totalFloatMinutes,
    xFreeFloat: projectedTask('X100')?.freeFloatMinutes,
    lagPredecessorLateFinish: projectedTask('LP100')?.lateFinish,
    successorEarlyStart: projectedTask('B100')?.earlyStart,
  }, {
    projectSource: 'XER',
    calendarSource: 'XER',
    aEarlyFinish: '2026-01-02T17:00',
    aLateStart: '2025-12-31T08:00',
    aTotalFloat: 0,
    xTotalFloat: 960,
    xFreeFloat: 960,
    lagPredecessorLateFinish: '2025-12-29T17:00',
    successorEarlyStart: '2026-01-08T08:00',
  });

  const sixAxes = (input: ImportResult) => {
    const result = solveProject({
      tasks: input.tasks,
      sequences: input.sequences,
      calendar: input.calendar,
      calendars: input.resourceCalendars ?? [],
      dataDate: input.project.statusDate,
      progressMode: input.project.progressMode,
      schedulingOptions: input.project.schedulingOptions,
      projectStartDate: input.project.startDate,
      projectEndDate: input.project.endDate,
    });
    if (result.error) throw new Error(result.error);
    return input.tasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode))
      .map(task => [task.wbsCode, task.time.earlyStart, task.time.earlyFinish,
        task.time.lateStart, task.time.lateFinish, task.time.totalFloat, task.time.freeFloat]);
  };
  const xerForIfc = readXER(projectionBytes);
  if (isMultiDocumentImport(xerForIfc)) throw new Error('X12 XER-naar-IFC-fixture moet enkelproject zijn');
  const ifcRoundTrip = readIFC(writeIFC(xerForIfc));
  const directForParity = readXER(projectionBytes);
  if (isMultiDocumentImport(directForParity)) throw new Error('X12 directe pariteitsfixture moet enkelproject zijn');
  eq('X12 XER-naar-IFC bewaart P6-provenance en alle zes solve-assen', {
    projectSource: ifcRoundTrip.project.schedulingOptions?.p6Source,
    calendarSource: ifcRoundTrip.calendar.p6Source,
    axes: sixAxes(ifcRoundTrip),
  }, {
    projectSource: 'XER',
    calendarSource: 'XER',
    axes: sixAxes(directForParity),
  });

  const ordinaryIfcSource = readXER(projectionBytes);
  const ordinaryDirect = readXER(projectionBytes);
  if (isMultiDocumentImport(ordinaryIfcSource) || isMultiDocumentImport(ordinaryDirect)) {
    throw new Error('X12 gewone-IFC-provenancefixture moet enkelproject zijn');
  }
  delete ordinaryIfcSource.project.schedulingOptions?.p6Source;
  delete ordinaryIfcSource.calendar.p6Source;
  delete ordinaryDirect.project.schedulingOptions?.p6Source;
  delete ordinaryDirect.calendar.p6Source;
  const ordinaryIfc = readIFC(writeIFC(ordinaryIfcSource));
  eq('X12 gewone IFC zonder XER-bronstempels blijft zesassig formaatneutraal', {
    projectSource: ordinaryIfc.project.schedulingOptions?.p6Source,
    calendarSource: ordinaryIfc.calendar.p6Source,
    axes: sixAxes(ordinaryIfc),
  }, {
    projectSource: undefined,
    calendarSource: undefined,
    axes: sixAxes(ordinaryDirect),
  });

  const unprovenImport = readXER(projectionBytes);
  if (isMultiDocumentImport(unprovenImport)) throw new Error('X12 provenance-tegenvoorbeeld moet enkelproject zijn');
  delete unprovenImport.calendar.p6Source;
  const unproven = solveImported(unprovenImport).tasks;
  const unprovenTask = (code: string) => unproven.find(task => task.taskCode === code);
  eq('X12 penaltymetadata zonder XER-kalenderprovenance is volledig inert', {
    aLateStart: unprovenTask('A100')?.lateStart,
    aTotalFloat: unprovenTask('A100')?.totalFloatMinutes,
    xTotalFloat: unprovenTask('X100')?.totalFloatMinutes,
    xFreeFloat: unprovenTask('X100')?.freeFloatMinutes,
    lagPredecessorLateFinish: unprovenTask('LP100')?.lateFinish,
  }, {
    aLateStart: '2026-01-02T08:00',
    aTotalFloat: 960,
    xTotalFloat: 1920,
    xFreeFloat: 1920,
    lagPredecessorLateFinish: '2025-12-31T17:00',
  });
}

// P6 kan ook een gewone TT_Task met nul duur als twee aangrenzende werkgrenzen bewaren. Anders
// dan een start-/finishmijlpaal blijft de activiteit als TT_Task getypeerd; de geïnverteerde
// target-window is het bronbewijs voor ES/LS op de volgende bandstart en EF/LF op het vorige
// bandeinde. De fixture bevat geen P6-uitvoerwaarden in het productpad.
{
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-08-06\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||3()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||4()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||5()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||6()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||7()())))(0||Exceptions())))',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tP6 nulduuractiviteit\tC1\t2026-08-06 08:00\t2026-08-06 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\t1\tP\tC1\tA100\tNulduuractiviteit\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t0\t0\t2026-08-06 08:00\t2026-08-05 16:00',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 nulduuractiviteitfixture moet enkelproject zijn');
  const task = solveImported(imported).tasks.find(candidate => candidate.taskCode === 'A100');
  eq('X12 gewone P6-nulduuractiviteit bewaart de aangrenzende werkgrenzen', {
    earlyStart: task?.earlyStart,
    earlyFinish: task?.earlyFinish,
    lateStart: task?.lateStart,
    lateFinish: task?.lateFinish,
  }, {
    earlyStart: '2026-08-06T08:00',
    earlyFinish: '2026-08-05T16:00',
    lateStart: '2026-08-06T08:00',
    lateFinish: '2026-08-05T16:00',
  });
}

// Float wordt intern in taakdagen bewaard. De productadapter moet die dagen naar P6-minuten
// terugzetten met CalendarEngine.hoursPerDay (de effectieve, uit banden afgeleide dag), niet met
// een tegenstrijdige ruwe CALENDAR.day_hr_cnt. Deze bronvorm is publiek aanwezig in Roads.
{
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tTienuursband met ruwe achturendag\tCA_Base\t8\t40\t(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|07:00|f|17:00)())))(0||3()((0||0(s|07:00|f|17:00)())))(0||4()((0||0(s|07:00|f|17:00)())))(0||5()((0||0(s|07:00|f|17:00)())))(0||6()((0||0(s|07:00|f|17:00)())))(0||7()())))(0||Exceptions())))',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tEffectieve floatkalender\tC1\t2026-01-05 07:00\t2026-01-05 07:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\t1\tP\tC1\tA100\tVroeg pad\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t10\t10\t2026-01-05 07:00\t2026-01-05 17:00',
    '%R\t2\tP\tC1\tB100\tLater pad\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t10\t10\t2026-01-06 07:00\t2026-01-06 17:00',
    '%E',
  ].join('\n'));
  const imported = readXER(bytes);
  if (isMultiDocumentImport(imported)) throw new Error('X12 effectieve-floatkalenderfixture moet enkelproject zijn');
  const tenHourBands = [{ start: 7 * 60, end: 17 * 60 }];
  const effectiveCalendar = {
    ...imported.calendar,
    workDays: [1, 2, 3, 4, 5],
    workStartHour: 7,
    workEndHour: 17,
    workTime: { byWeekday: {
      1: tenHourBands, 2: tenHourBands, 3: tenHourBands, 4: tenHourBands, 5: tenHourBands,
      6: [], 7: [],
    } },
  };
  const engine = new CalendarEngine(effectiveCalendar);
  const task = solveImported({ ...imported, calendar: effectiveCalendar }).tasks
    .find(candidate => candidate.taskCode === 'A100');
  eq('X12 productadapter zet taakdagen om met effectieve kalenderuren', {
    rawHoursPerDay: effectiveCalendar.hoursPerDay,
    effectiveHoursPerDay: engine.hoursPerDay,
    totalFloatMinutes: task?.totalFloatMinutes,
    freeFloatMinutes: task?.freeFloatMinutes,
  }, {
    rawHoursPerDay: 8,
    effectiveHoursPerDay: 10,
    totalFloatMinutes: 600,
    freeFloatMinutes: 600,
  });
}

const corpusRoot = process.env.OPS_XER_CORPUS;
if (REPORT !== undefined && !REPORT_MODES.has(REPORT)) {
  diffs.push(`onbekende OPS_XER_FIDELITY_REPORT-modus: ${REPORT}`);
}
if (!corpusRoot) console.log('X12 PRODUCTGATE: corpus niet aanwezig; alleen corpusloze bescherming uitgevoerd');
else if (!existsSync(corpusRoot)) diffs.push('OPS_XER_CORPUS wijst niet naar een bestaande corpusmap');
else {
  const corpus = listXerFiles(corpusRoot).map(path => ({ label: relative(corpusRoot, path).split('\\').join('/'), bytes: readFileSync(path) }));
  const manifest = JSON.parse(readFileSync(join(HERE, 'xer-corpus-manifest.json'), 'utf8')) as XerCorpusManifest;
  const measured = productBaseline(corpus, manifest);
  if (REPORT === 'baseline') console.log(JSON.stringify(measured, null, 2));
  else if (REPORT === 'summary' || REPORT === 'detail') {
    const entries = Object.entries(measured.files);
    const tasks = entries.reduce((total, [, entry]) => total + entry.tasks, 0);
    const projects = entries.reduce((total, [, entry]) => total + entry.projects, 0);
    const deviations = entries.reduce((total, [, entry]) => total + totalDeviations(entry), 0);
    const identityErrors = entries.reduce((total, [, entry]) => total + entry.identityErrors.length, 0);
    const scannerErrors = entries.reduce((total, [, entry]) => total + entry.scannerErrors.length, 0);
    console.log(`MEASURE ONLY X12 productfidelity: ${entries.length} entries; ${projects} projecten; ${tasks} taken; ${deviations} zesassige afwijkingen; ${identityErrors} identiteitsfouten; ${scannerErrors} scannerfouten`);
  } else {
    const entries = Object.entries(measured.files);
    const allGatePassed = entries.every(([, entry]) => entry.gatePassed === true);
    const allAxesZero = entries.every(([, entry]) => XER_FIDELITY_AXES
      .every(axis => entry.counters[axis].deviations === 0));
    const totalSixAxisDeviations = entries.reduce(
      (total, [, entry]) => total + totalDeviations(entry),
      0,
    );
    const identityErrors = entries.reduce((total, [, entry]) => total + entry.identityErrors.length, 0);
    const scannerErrors = entries.reduce((total, [, entry]) => total + entry.scannerErrors.length, 0);
    eq('X12 nuldoel is baseline-onafhankelijk: ieder bestand haalt de zesassige poort', allGatePassed, true);
    eq('X12 nuldoel is baseline-onafhankelijk: alle zes assen zijn nul', allAxesZero, true);
    eq('X12 nuldoel is baseline-onafhankelijk: totaal zesassige afwijkingen is nul', totalSixAxisDeviations, 0);
    eq('X12 nuldoel is baseline-onafhankelijk: identiteitsfouten zijn nul', identityErrors, 0);
    eq('X12 nuldoel is baseline-onafhankelijk: scannerfouten zijn nul', scannerErrors, 0);
    eq('X12 productbaseline is de verse volledige productmeting',
      JSON.parse(readFileSync(join(HERE, 'xer-product-fidelity-baseline.json'), 'utf8')) as unknown, measured);
  }
}
if (diffs.length > 0) {
  console.error(`X12 PRODUCTGATE RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
if (REPORT !== undefined) console.log(`MEASURE ONLY X12 productfidelity: meetcommando voltooid; ${checks} corpusloze checks groen`);
else console.log(`X12 PRODUCTGATE GREEN: ${checks} checks groen`);
