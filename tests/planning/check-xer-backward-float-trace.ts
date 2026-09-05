import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import { solveProject } from '@/engine/scheduler/solveProject';
import { replayXerProductBeforeOracle, syntheticZeroRegressionCandidate } from './xerTaskReplayProduct';
import type { CpmBackwardFloatTrace, CpmProjectEndSource, CpmTaskBackwardFloatTrace } from '@/engine/scheduler/CPMSolver';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const earlyShiftCalendar = '(0||CalendarData()(    (0||DaysOfWeek()(      (0||1()(        (0||0(s|07:00|f|15:00)())))      (0||2()(        (0||0(s|07:00|f|15:00)())))      (0||3()(        (0||0(s|07:00|f|15:00)())))      (0||4()(        (0||0(s|07:00|f|15:00)())))      (0||5()(        (0||0(s|07:00|f|15:00)())))      (0||6()())      (0||7()())))    (0||Exceptions()())))';

interface Variant {
  id: string;
  remainingStart: boolean;
  useProjectEndDateForFloat: boolean;
  finishMilestoneBoundary: boolean;
  fixtureShape?: 'network' | 'completedOnly';
  laterOpenTaskWinsProjectEnd?: boolean;
  expected: {
    projectEndSource?: string;
    completedLateStartSource: string;
    milestoneFreeFloatSource?: string;
    taskIds: string[];
  };
}

function fixtureBytes(variant: Variant): Uint8Array {
  const taskRows = variant.fixtureShape === 'completedOnly'
    ? [
      '%R\tC\tP1\tC1\tCOMP\tVoltooide winnaar\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t8\t0\t2026-08-04 07:00\t2026-08-04 15:00\t2026-08-04 07:00\t2026-08-04 15:00',
    ]
    : [
      '%R\tP\tP1\tC1\tPRED\tEchte voorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-08-03 07:00\t2026-08-03 15:00\t\t',
      '%R\tC\tP1\tC1\tDUP\tVoltooide leaf\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t8\t0\t2026-08-04 07:00\t2026-08-04 15:00\t2026-08-04 07:00\t2026-08-04 15:00',
      '%R\tO\tP1\tC1\tOPEN\tOpen opvolger\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-08-05 07:00\t2026-08-05 15:00\t\t',
      '%R\tM\tP1\tC1\tDUP\tFinish milestone\tTT_FinMile\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t0\t0\t2026-08-06 07:01\t2026-08-06 07:01\t\t',
    ];
  const laterOpenWinnerRows = variant.laterOpenTaskWinsProjectEnd
    ? [
      '%R\tL\tP1\tC1\tLATE\tLatere open winnaar\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-08-20 07:00\t2026-08-20 15:00\t\t',
    ]
    : [];
  const taskPredRows = variant.fixtureShape === 'completedOnly'
    ? []
    : [
      '%R\tR-PC\tC\tP\tP1\tP1\tPR_FS\t0',
      '%R\tR-PO\tO\tP\tP1\tP1\tPR_FS\t0',
      '%R\tR-OM\tM\tO\tP1\tP1\tPR_FS\t0',
    ];
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-08-17\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tVroege ploeg\tP1\tCA_Project\t8\t40\t${earlyShiftCalendar}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    `%R\tP1\tBackward float trace\tC1\t2026-08-17 07:00\t2026-08-03 07:00\t2026-08-20 15:00\t${variant.remainingStart ? 'Y' : 'N'}`,
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    `%R\tP1\t${variant.useProjectEndDateForFloat ? 'Y' : 'N'}`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    ...taskRows,
    ...laterOpenWinnerRows,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    ...taskPredRows,
    '%E',
  ].join('\n'));
}

function importFixture(bytes: Uint8Array): ImportResult {
  const opened = readXER(bytes);
  if (isMultiDocumentImport(opened)) throw new Error('tracefixture moet precies één project openen');
  return opened;
}

interface TraceProjection {
  projectEndSource: CpmProjectEndSource | undefined;
  taskIds: string[];
  completed: CpmTaskBackwardFloatTrace | undefined;
  milestone: CpmTaskBackwardFloatTrace | undefined;
}

interface GuardDecisionProjection {
  eligible: boolean;
  reason: string;
}

interface CompletedGuardTraceProjection {
  displayActualLate: boolean | undefined;
  completedWindow: GuardDecisionProjection | undefined;
  backwardActualPin: GuardDecisionProjection | undefined;
  displayActualLateDecision: GuardDecisionProjection | undefined;
}

function traceProjection(trace: CpmBackwardFloatTrace | undefined): TraceProjection {
  return {
    projectEndSource: trace?.projectEndSource,
    taskIds: Object.keys(trace?.byTaskId ?? {}).sort(),
    completed: trace?.byTaskId.C,
    milestone: trace?.byTaskId.M,
  };
}

function solveTraceVariant(variant: Variant): TraceProjection {
  const imported = structuredClone(importFixture(fixtureBytes(variant)));
  imported.project.schedulingOptions = {
    ...imported.project.schedulingOptions,
    p6FinishMilestoneBoundaryWindow: variant.finishMilestoneBoundary,
  };
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
  return traceProjection(result.backwardFloatTrace);
}

function completedGuardFixtureBytes(): Uint8Array {
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-08-17\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tVroege ploeg\tP1\tCA_Project\t8\t40\t${earlyShiftCalendar}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tCompleted guard trace\tC1\t2026-08-17 07:00\t2026-08-03 07:00\t2026-08-20 15:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date',
    '%R\tC\tP1\tC1\tCOMP\tCompleted diag\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t8\t0\t2026-08-04 07:00\t2026-08-04 15:00\t2026-08-04 07:00\t2026-08-04 15:00\t\t',
    '%E',
  ].join('\n'));
}

function solveCompletedGuardFixture(
  mutate?: (imported: ImportResult) => void,
) {
  const imported = structuredClone(importFixture(completedGuardFixtureBytes()));
  mutate?.(imported);
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
  return result;
}

function solveCompletedGuardTrace(
  mutate?: (imported: ImportResult) => void,
): CompletedGuardTraceProjection {
  const result = solveCompletedGuardFixture(mutate);
  const trace = result.backwardFloatTrace?.byTaskId.C as
    | (CpmTaskBackwardFloatTrace & {
      completedWindow?: GuardDecisionProjection;
      backwardActualPin?: GuardDecisionProjection;
      displayActualLateDecision?: GuardDecisionProjection;
    })
    | undefined;
  return {
    displayActualLate: trace?.displayActualLate,
    completedWindow: trace?.completedWindow,
    backwardActualPin: trace?.backwardActualPin,
    displayActualLateDecision: trace?.displayActualLateDecision,
  };
}

const variants: Variant[] = [
  {
    id: 'completed-window-wint',
    remainingStart: true,
    useProjectEndDateForFloat: false,
    finishMilestoneBoundary: true,
    fixtureShape: 'completedOnly',
    expected: {
      projectEndSource: 'completedDisplayWindow',
      completedLateStartSource: 'subRemainingDuration',
      taskIds: ['C'],
    },
  },
  {
    id: 'completed-window-verliest-van-latere-open-taak',
    remainingStart: true,
    useProjectEndDateForFloat: false,
    finishMilestoneBoundary: true,
    fixtureShape: 'network',
    laterOpenTaskWinsProjectEnd: true,
    expected: {
      projectEndSource: 'maxEarlyFinish',
      completedLateStartSource: 'subRemainingDuration',
      milestoneFreeFloatSource: 'projectEndFinishMilestoneBoundary',
      taskIds: ['C', 'L', 'M', 'O', 'P'],
    },
  },
  {
    id: 'remaining-start-uit', remainingStart: false, useProjectEndDateForFloat: false,
    finishMilestoneBoundary: true,
    fixtureShape: 'network',
    expected: {
      projectEndSource: 'maxEarlyFinish',
      completedLateStartSource: 'subDuration',
      milestoneFreeFloatSource: 'projectEndFinishMilestoneBoundary',
      taskIds: ['C', 'M', 'O', 'P'],
    },
  },
  {
    id: 'expliciet-projecteinde', remainingStart: true, useProjectEndDateForFloat: true,
    finishMilestoneBoundary: true,
    fixtureShape: 'network',
    expected: {
      projectEndSource: 'useProjectEndDateForFloat',
      completedLateStartSource: 'subRemainingDuration',
      milestoneFreeFloatSource: 'clampedZero',
      taskIds: ['C', 'M', 'O', 'P'],
    },
  },
  {
    id: 'finish-boundary-uit', remainingStart: true, useProjectEndDateForFloat: false,
    finishMilestoneBoundary: false,
    fixtureShape: 'network',
    expected: {
      completedLateStartSource: 'subRemainingDuration',
      milestoneFreeFloatSource: 'derivedFromSuccessor',
      taskIds: ['C', 'M', 'O', 'P'],
    },
  },
];

const completedGuardVariants: Array<{
  id: string;
  mutate?: (imported: ImportResult) => void;
  expected: CompletedGuardTraceProjection;
}> = [
  {
    id: 'active',
    expected: {
      displayActualLate: true,
      completedWindow: { eligible: true, reason: 'eligible' },
      backwardActualPin: { eligible: true, reason: 'eligible' },
      displayActualLateDecision: { eligible: true, reason: 'eligible' },
    },
  },
  {
    id: 'ontbrekende-explicit-target-provenance',
    mutate: imported => {
      const task = imported.tasks.find(candidate => candidate.id === 'C');
      if (!task) throw new Error('fixture mist taak C');
      task.p6ExplicitTargetWindow = false;
    },
    expected: {
      displayActualLate: true,
      completedWindow: { eligible: false, reason: 'missingExplicitTargetWindow' },
      backwardActualPin: { eligible: true, reason: 'eligible' },
      displayActualLateDecision: { eligible: true, reason: 'eligible' },
    },
  },
  {
    id: 'suspend-resume',
    mutate: imported => {
      const task = imported.tasks.find(candidate => candidate.id === 'C');
      if (!task) throw new Error('fixture mist taak C');
      task.p6SuspendResume = true;
    },
    expected: {
      displayActualLate: true,
      completedWindow: { eligible: false, reason: 'hasSuspendResume' },
      backwardActualPin: { eligible: true, reason: 'eligible' },
      displayActualLateDecision: { eligible: true, reason: 'eligible' },
    },
  },
  {
    id: 'ontbrekende-actual-finish',
    mutate: imported => {
      const task = imported.tasks.find(candidate => candidate.id === 'C');
      if (!task) throw new Error('fixture mist taak C');
      task.time.actualFinish = '';
    },
    expected: {
      displayActualLate: true,
      completedWindow: { eligible: true, reason: 'eligible' },
      backwardActualPin: { eligible: false, reason: 'missingActualFinish' },
      displayActualLateDecision: { eligible: true, reason: 'eligible' },
    },
  },
  {
    id: 'niet-voltooid',
    mutate: imported => {
      const task = imported.tasks.find(candidate => candidate.id === 'C');
      if (!task) throw new Error('fixture mist taak C');
      task.time.completion = 0.5;
    },
    expected: {
      displayActualLate: false,
      completedWindow: { eligible: false, reason: 'notCompleted' },
      backwardActualPin: { eligible: false, reason: 'notCompleted' },
      displayActualLateDecision: { eligible: false, reason: 'notCompleted' },
    },
  },
  {
    id: 'preserve-uit',
    mutate: imported => {
      imported.project.schedulingOptions = {
        ...imported.project.schedulingOptions,
        preserveActualDatesInBackwardPass: false,
      };
    },
    expected: {
      displayActualLate: false,
      completedWindow: { eligible: true, reason: 'eligible' },
      backwardActualPin: { eligible: false, reason: 'preserveActualDatesOff' },
      displayActualLateDecision: { eligible: false, reason: 'preserveActualDatesOff' },
    },
  },
  {
    id: 'data-date-afwezig',
    mutate: imported => {
      imported.project.statusDate = undefined;
    },
    expected: {
      displayActualLate: false,
      completedWindow: { eligible: false, reason: 'missingDataDate' },
      backwardActualPin: { eligible: false, reason: 'missingDataDate' },
      displayActualLateDecision: { eligible: false, reason: 'missingDataDate' },
    },
  },
];

{
  const imported = importFixture(fixtureBytes(variants[0]!));
  const completed = imported.tasks.find(task => task.id === 'C');
  eq('backward-float-trace fixture activeert de completed-window-guard zonder oracledata', {
    p6Source: imported.project.schedulingOptions?.p6Source,
    remainingStart: imported.project.schedulingOptions?.p6UseRemainingStartForProgress,
    completion: completed?.time.completion,
    p6ProjectId: completed?.p6ProjectId,
    p6TaskId: completed?.p6TaskId,
    explicitTargetWindow: completed?.p6ExplicitTargetWindow,
    completePctType: completed?.p6CompletePctType,
    durationType: completed?.p6DurationType,
  }, {
    p6Source: 'XER',
    remainingStart: true,
    completion: 1,
    p6ProjectId: 'P1',
    p6TaskId: 'C',
    explicitTargetWindow: true,
    completePctType: 'CP_Drtn',
    durationType: 'DT_FixedDUR2',
  });
}

for (const variant of variants) {
  const trace = solveTraceVariant(variant);
  eq(`backward-float-trace ${variant.id}: beslisbronnen`, {
    ...(variant.expected.projectEndSource !== undefined
      ? { projectEndSource: trace.projectEndSource }
      : {}),
    completedLateStartSource: (trace.completed as { lateStartSource?: string } | undefined)?.lateStartSource,
    completedDisplayActualLate: (trace.completed as { displayActualLate?: boolean } | undefined)?.displayActualLate,
    ...(variant.expected.milestoneFreeFloatSource !== undefined
      ? { milestoneFreeFloatSource: (trace.milestone as { freeFloatSource?: string } | undefined)?.freeFloatSource }
      : {}),
  }, {
    ...(variant.expected.projectEndSource !== undefined
      ? { projectEndSource: variant.expected.projectEndSource }
      : {}),
    completedLateStartSource: variant.expected.completedLateStartSource,
    completedDisplayActualLate: true,
    ...(variant.expected.milestoneFreeFloatSource !== undefined
      ? { milestoneFreeFloatSource: variant.expected.milestoneFreeFloatSource }
      : {}),
  });
  eq(`backward-float-trace ${variant.id}: task.id is de enige trace-identiteit`, {
    taskIds: trace.taskIds,
    hasTaskCodeKey: trace.taskIds.includes('DUP'),
  }, {
    taskIds: variant.expected.taskIds,
    hasTaskCodeKey: false,
  });
}

for (const variant of completedGuardVariants) {
  if (variant.id === 'data-date-afwezig') continue;
  eq(`completed-guard-trace ${variant.id}: drie routes verklaren actief/inactief`, solveCompletedGuardTrace(variant.mutate), variant.expected);
}

{
  const variant = completedGuardVariants.find(candidate => candidate.id === 'data-date-afwezig');
  if (!variant) throw new Error('statusdatumloze completed-guard-variant ontbreekt');
  let got: unknown;
  try {
    const result = solveCompletedGuardFixture(variant.mutate);
    got = {
      ...solveCompletedGuardTrace(variant.mutate),
      projectEndSourceIsCompletedDisplayWindow:
        result.backwardFloatTrace?.projectEndSource === 'completedDisplayWindow',
    };
  } catch (error) {
    got = { runtimeError: error instanceof Error ? error.name : 'onbekend' };
  }
  eq('completed-guard-trace data-date-afwezig: decision faalt gesloten en runtime gebruikt geen completedDisplayWindow', got, {
    ...variant.expected,
    projectEndSourceIsCompletedDisplayWindow: false,
  });
}

{
  const baseline = variants[0]!;
  const replay = replayXerProductBeforeOracle(fixtureBytes(baseline), syntheticZeroRegressionCandidate, {
    includeBackwardFloatTrace: true,
  });
  const source = replay.predicate.find(log => log.sourceTaskId === 'C')?.source;
  eq('backward-float-trace replay projecteert de solve-trace vóór oracle/classificatie', {
    projectEndSource: source?.backwardFloatTraceProjectEndSource,
    lateStartSource: source?.backwardFloatTraceLateStartSource,
    displayActualLate: source?.backwardFloatTraceDisplayActualLate,
    completedWindowEligible: source?.backwardFloatTraceCompletedWindowEligible,
    completedWindowReason: source?.backwardFloatTraceCompletedWindowReason,
    backwardActualPinEligible: source?.backwardFloatTraceBackwardActualPinEligible,
    backwardActualPinReason: source?.backwardFloatTraceBackwardActualPinReason,
    displayActualLateEligible: source?.backwardFloatTraceDisplayActualLateEligible,
    displayActualLateReason: source?.backwardFloatTraceDisplayActualLateReason,
  }, {
    projectEndSource: 'completedDisplayWindow',
    lateStartSource: 'subRemainingDuration',
    displayActualLate: true,
    completedWindowEligible: true,
    completedWindowReason: 'eligible',
    backwardActualPinEligible: true,
    backwardActualPinReason: 'eligible',
    displayActualLateEligible: true,
    displayActualLateReason: 'eligible',
  });
}

{
  const imported = structuredClone(importFixture(fixtureBytes(variants[0]!)));
  imported.project.schedulingOptions = {
    ...imported.project.schedulingOptions,
    p6Source: undefined,
  };
  const result = solveProject({
    tasks: imported.tasks, sequences: imported.sequences, calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [], dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode, schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate, projectEndDate: imported.project.endDate,
  });
  eq('backward-float-trace faalt gesloten zonder XER-bronsignaal', result.backwardFloatTrace, undefined);
}

if (diffs.length > 0) {
  console.error(`XER BACKWARD FLOAT TRACE RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER BACKWARD FLOAT TRACE GREEN: ${checks} checks groen`);
