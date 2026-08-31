import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import { parseInstant } from '@/utils/dateUtils';
import { explainP6CompletedDataDateWindow } from '@/utils/p6CompletedTargetWindow';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const earlyShiftCalendar = '(0||CalendarData()(    (0||DaysOfWeek()(      (0||1()(        (0||0(s|07:00|f|15:00)())))      (0||2()(        (0||0(s|07:00|f|15:00)())))      (0||3()(        (0||0(s|07:00|f|15:00)())))      (0||4()(        (0||0(s|07:00|f|15:00)())))      (0||5()(        (0||0(s|07:00|f|15:00)())))      (0||6()())      (0||7()())))    (0||Exceptions()())))';

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

function importFixture(): ImportResult {
  const opened = readXER(bytes([
    'ERMHDR\t23.12\t2026-08-17\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tVroege ploeg\tP1\tCA_Project\t8\t40\t${earlyShiftCalendar}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tCompleted suspend/resume\tC1\t2026-08-17 10:00\t2026-08-03 07:00\t2026-08-20 15:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date',
    '%R\tC\tP1\tC1\tCOMP\tCompleted diag\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t8\t0\t2026-08-04 07:00\t2026-08-04 15:00\t2026-08-04 07:00\t2026-08-14 15:00\t2026-08-10 15:00\t2026-08-12 07:00',
    '%E',
  ]));
  if (isMultiDocumentImport(opened)) throw new Error('completed suspend/resume fixture moet precies één project openen');
  return opened;
}

function taskOf(imported: ImportResult): Task {
  const task = imported.tasks.find(candidate => candidate.id === 'C');
  if (!task) throw new Error('fixture mist taak C');
  return task;
}

function solveProjection(mutate?: (imported: ImportResult, task: Task) => void) {
  const imported = structuredClone(importFixture());
  const task = taskOf(imported);
  mutate?.(imported, task);
  const solveTasks = cloneTasksForSolve(imported.tasks);
  const solveTask = solveTasks.find(candidate => candidate.id === task.id);
  if (!solveTask) throw new Error('solve-kloon mist taak C');
  const before = {
    flag: solveTask.p6SuspendResume,
    stop: solveTask.time.stop,
    resume: solveTask.time.resume,
  };
  const decision = explainP6CompletedDataDateWindow(
    task,
    imported.project.statusDate ? parseInstant(imported.project.statusDate) : null,
    imported.project.schedulingOptions,
  );
  const result = solveProject({
    tasks: solveTasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (result.error) throw new Error(result.error);
  const scheduled = result.tasks.get(solveTask.id);
  const trace = result.backwardFloatTrace?.byTaskId.C;
  return {
    before,
    after: {
      flag: solveTask.p6SuspendResume,
      stop: solveTask.time.stop,
      resume: solveTask.time.resume,
    },
    decision,
    scheduled: scheduled
      ? {
        earlyStart: scheduled.earlyStart,
        earlyFinish: scheduled.earlyFinish,
        lateStart: scheduled.lateStart,
        lateFinish: scheduled.lateFinish,
        earlyFinishAtOrAfterEarlyStart:
          parseInstant(scheduled.earlyFinish).getTime() >= parseInstant(scheduled.earlyStart).getTime(),
      }
      : null,
    trace: trace
      ? {
        projectEndSource: result.backwardFloatTrace?.projectEndSource,
        displayActualLate: trace.displayActualLate,
        completedWindow: trace.completedWindow,
        backwardActualPin: trace.backwardActualPin,
        displayActualLateDecision: trace.displayActualLateDecision,
      }
      : null,
  };
}

function decisionProjection(mutate?: (imported: ImportResult, task: Task) => void) {
  const imported = structuredClone(importFixture());
  const task = taskOf(imported);
  mutate?.(imported, task);
  return explainP6CompletedDataDateWindow(
    task,
    imported.project.statusDate ? parseInstant(imported.project.statusDate) : null,
    imported.project.schedulingOptions,
  );
}

eq('XER completed suspend/resume positive: geldige P6-vorm opent de completed-windowroute en houdt de zelfstandige fixture tijdkundig geldig', solveProjection(), {
  before: {
    flag: true,
    stop: '2026-08-10T15:00',
    resume: '2026-08-12T07:00',
  },
  after: {
    flag: true,
    stop: '2026-08-10T15:00',
    resume: '2026-08-12T07:00',
  },
  decision: { eligible: true, reason: 'eligible' },
  scheduled: {
    earlyStart: '2026-08-17T10:00',
    earlyFinish: '2026-08-17T10:00',
    lateStart: '2026-08-04T07:00',
    lateFinish: '2026-08-14T15:00',
    earlyFinishAtOrAfterEarlyStart: true,
  },
  trace: {
    projectEndSource: 'completedDisplayWindow',
    displayActualLate: true,
    completedWindow: { eligible: true, reason: 'eligible' },
    backwardActualPin: { eligible: true, reason: 'eligible' },
    displayActualLateDecision: { eligible: true, reason: 'eligible' },
  },
});

const rejectionCases: Array<{
  label: string;
  mutate: (imported: ImportResult, task: Task) => void;
  want: { eligible: boolean; reason: string };
}> = [
  {
    label: 'onvolledig paar',
    mutate: (_imported, task) => {
      task.time.resume = undefined;
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'omgekeerd paar',
    mutate: (_imported, task) => {
      task.time.stop = '2026-08-13T07:00';
      task.time.resume = '2026-08-12T07:00';
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'ongeldige resume-datum',
    mutate: (_imported, task) => {
      task.time.resume = 'geen-datum';
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'ongeldige actualFinish',
    mutate: (_imported, task) => {
      task.time.actualFinish = 'geen-datum';
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'actualFinish vóór targetFinish',
    mutate: (_imported, task) => {
      task.time.actualFinish = '2026-08-04T14:00';
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'actualFinish ná statusdatum',
    mutate: (_imported, task) => {
      task.time.actualFinish = '2026-08-18T15:00';
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'resume ná actualFinish',
    mutate: (_imported, task) => {
      task.time.resume = '2026-08-15T07:00';
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'preserve-uit',
    mutate: imported => {
      imported.project.schedulingOptions = {
        ...imported.project.schedulingOptions,
        preserveActualDatesInBackwardPass: false,
      };
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'niet-XER',
    mutate: imported => {
      imported.project.schedulingOptions = {
        ...imported.project.schedulingOptions,
        p6Source: undefined,
      };
    },
    want: { eligible: false, reason: 'notXerSource' },
  },
  {
    label: 'completion kleiner dan 1',
    mutate: (_imported, task) => {
      task.time.completion = 0.5;
    },
    want: { eligible: false, reason: 'hasSuspendResume' },
  },
  {
    label: 'CP_Phys',
    mutate: (_imported, task) => {
      task.p6CompletePctType = 'CP_Phys';
    },
    want: { eligible: false, reason: 'wrongCompletePctType' },
  },
  {
    label: 'ander durationtype',
    mutate: (_imported, task) => {
      task.p6DurationType = 'DT_FixedDrtn';
    },
    want: { eligible: false, reason: 'wrongDurationType' },
  },
  {
    label: 'LOE',
    mutate: (_imported, task) => {
      task.p6ActivityType = 'TT_LOE';
    },
    want: { eligible: false, reason: 'wrongActivityType' },
  },
  {
    label: 'ontbrekend expliciet targetwindow',
    mutate: (_imported, task) => {
      task.p6ExplicitTargetWindow = false;
    },
    want: { eligible: false, reason: 'missingExplicitTargetWindow' },
  },
];

for (const variant of rejectionCases) {
  eq(`XER completed suspend/resume reject: ${variant.label}`, decisionProjection(variant.mutate), variant.want);
}

{
  const projection = solveProjection(imported => {
    imported.project.statusDate = undefined;
  });
  eq('XER completed suspend/resume reject: statusdatumloos blijft fail-closed zonder completedDisplayWindow', {
    projectEndSource: projection.trace?.projectEndSource,
    completedWindow: projection.trace?.completedWindow,
  }, {
    projectEndSource: 'maxEarlyFinish',
    completedWindow: { eligible: false, reason: 'missingDataDate' },
  });
}

if (diffs.length > 0) {
  console.error(`XER completed suspend/resume window RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER completed suspend/resume window GREEN: ${checks} checks groen`);
