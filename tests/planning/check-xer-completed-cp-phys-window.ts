import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import { parseInstant } from '@/utils/dateUtils';
import {
  explainP6CompletedDataDateWindow,
  type P6CompletedWindowReason,
} from '@/utils/p6CompletedTargetWindow';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const calendarData = '(0||CalendarData()(    (0||DaysOfWeek()(      (0||1()(        (0||0(s|07:00|f|15:00)())))      (0||2()(        (0||0(s|07:00|f|15:00)())))      (0||3()(        (0||0(s|07:00|f|15:00)())))      (0||4()(        (0||0(s|07:00|f|15:00)())))      (0||5()(        (0||0(s|07:00|f|15:00)())))      (0||6()())      (0||7()())))    (0||Exceptions()())))';

function fixtureBytes(): Uint8Array {
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-08-17\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tVroege ploeg\tP1\tCA_Project\t8\t40\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tCompleted CP_Phys\tC1\t2026-08-17 10:00\t2026-08-03 07:00\t2026-08-20 15:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date',
    '%R\tC\tP1\tC1\tCPHYS\tCompleted physical\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Phys\t0\t100\t8\t0\t2026-08-04 07:00\t2026-08-04 15:00\t2026-08-04 07:00\t2026-08-04 15:00\t\t',
    '%E',
  ].join('\n'));
}

function importedFixture(): ImportResult {
  const imported = readXER(fixtureBytes());
  if (isMultiDocumentImport(imported)) throw new Error('CP_Phys-fixture moet precies één project openen');
  return imported;
}

function taskOf(imported: ImportResult): Task {
  const task = imported.tasks.find(candidate => candidate.id === 'C');
  if (!task) throw new Error('CP_Phys-fixture mist taak C');
  return task;
}

function decisionOf(
  mutate?: (imported: ImportResult, task: Task) => void,
): { decision: { eligible: boolean; reason: P6CompletedWindowReason }; task: Task; imported: ImportResult } {
  const imported = structuredClone(importedFixture());
  const task = taskOf(imported);
  mutate?.(imported, task);
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  return {
    decision: explainP6CompletedDataDateWindow(task, dataDate, imported.project.schedulingOptions),
    task,
    imported,
  };
}

function solveFixture(mutate?: (imported: ImportResult, task: Task) => void) {
  const { imported, task, decision } = decisionOf(mutate);
  const result = solveProject({
    tasks: imported.tasks,
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
  const scheduled = result.tasks.get(task.id);
  const trace = result.backwardFloatTrace?.byTaskId[task.id];
  return {
    source: {
      p6Source: imported.project.schedulingOptions?.p6Source,
      p6UseRemainingStartForProgress: imported.project.schedulingOptions?.p6UseRemainingStartForProgress,
      p6CompletePctType: task.p6CompletePctType,
      p6DurationType: task.p6DurationType,
      p6ActivityType: task.p6ActivityType,
      p6ProjectId: task.p6ProjectId,
      p6TaskId: task.p6TaskId,
      p6ExplicitTargetWindow: task.p6ExplicitTargetWindow,
      actualFinish: task.time.actualFinish,
      completion: task.time.completion,
    },
    decision,
    scheduled: scheduled ? {
      earlyStart: scheduled.earlyStart,
      earlyFinish: scheduled.earlyFinish,
      lateStart: scheduled.lateStart,
      lateFinish: scheduled.lateFinish,
    } : null,
    trace: trace ? {
      projectEndSource: result.backwardFloatTrace?.projectEndSource,
      completedWindow: trace.completedWindow,
    } : null,
  };
}

eq('CP_Phys XER-leaf wordt rechtstreeks gelezen en gebruikt de completed-windowroute', solveFixture(), {
  source: {
    p6Source: 'XER',
    p6UseRemainingStartForProgress: true,
    p6CompletePctType: 'CP_Phys',
    p6DurationType: 'DT_FixedDUR2',
    p6ActivityType: 'TT_Task',
    p6ProjectId: 'P1',
    p6TaskId: 'C',
    p6ExplicitTargetWindow: true,
    actualFinish: '2026-08-04T15:00',
    completion: 1,
  },
  decision: { eligible: true, reason: 'eligible' },
  scheduled: {
    earlyStart: '2026-08-17T10:00',
    earlyFinish: '2026-08-17T10:00',
    lateStart: '2026-08-04T07:00',
    lateFinish: '2026-08-04T15:00',
  },
  trace: {
    projectEndSource: 'completedDisplayWindow',
    completedWindow: { eligible: true, reason: 'eligible' },
  },
});

const negativeCases: Array<{
  label: string;
  mutate: (imported: ImportResult, task: Task) => void;
  reason: P6CompletedWindowReason;
}> = [
  {
    label: 'TT_Rsrc blijft buiten de CP_Phys-uitbreiding',
    mutate: (_imported, task) => { task.p6ActivityType = 'TT_Rsrc'; },
    reason: 'wrongActivityType',
  },
  {
    label: 'andere duration type blijft buiten de CP_Phys-uitbreiding',
    mutate: (_imported, task) => { task.p6DurationType = 'DT_FixedDrtn'; },
    reason: 'wrongDurationType',
  },
  {
    label: 'in-progress blijft buiten de CP_Phys-uitbreiding',
    mutate: (_imported, task) => { task.time.completion = 0.5; },
    reason: 'notCompleted',
  },
  {
    label: 'ontbrekende actualFinish blijft fail-closed',
    mutate: (_imported, task) => { task.time.actualFinish = undefined; },
    reason: 'notCompleted',
  },
  {
    label: 'ontbrekende expliciete targetwindow blijft fail-closed',
    mutate: (_imported, task) => { task.p6ExplicitTargetWindow = false; },
    reason: 'missingExplicitTargetWindow',
  },
  {
    label: 'ontbrekende taakprovenance blijft fail-closed',
    mutate: (_imported, task) => { task.p6TaskId = undefined; },
    reason: 'missingTaskProvenance',
  },
  {
    label: 'ontbrekende projectprovenance blijft fail-closed',
    mutate: (_imported, task) => { task.p6ProjectId = undefined; },
    reason: 'missingProjectProvenance',
  },
  {
    label: 'ontbrekende statusdatum blijft fail-closed',
    mutate: imported => { imported.project.statusDate = undefined; },
    reason: 'missingDataDate',
  },
  {
    label: 'suspend/resume blijft buiten de CP_Phys-uitbreiding',
    mutate: (_imported, task) => { task.p6SuspendResume = true; },
    reason: 'hasSuspendResume',
  },
  {
    label: 'nulduurmijlpaal blijft buiten de CP_Phys-uitbreiding',
    mutate: (_imported, task) => {
      task.isMilestone = true;
      task.time.scheduleDuration = 0;
    },
    reason: 'zeroDurationMilestone',
  },
];

for (const testCase of negativeCases) {
  eq(`CP_Phys fail-closed: ${testCase.label}`, decisionOf(testCase.mutate).decision, {
    eligible: false,
    reason: testCase.reason,
  });
}

if (diffs.length > 0) {
  console.error(`XER completed CP_Phys window RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER completed CP_Phys window GREEN: ${checks} checks groen`);
