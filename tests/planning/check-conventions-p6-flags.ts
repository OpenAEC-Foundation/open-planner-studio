import { solveProject } from '@/engine/scheduler/solveProject';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { CONVENTIONS, diffAgainstBase, resolveConventions } from '@/engine/scheduler/conventions/registry';
import { setConvention, withoutP6Semantics } from './p6SemanticsOff';
import { explainP6CompletedDataDateWindow } from '@/engine/scheduler/p6CompletedTargetWindow';
import {
  explainCompletedXerLoeActualFinishEligibilityResolved,
  explainP6CompletedLateRemainingWindowEligibilityResolved,
} from '@/engine/scheduler/p6CompletedRouteTrace';
import { explainOpenXerLoeTargetSpanEligibilityResolved } from '@/engine/scheduler/p6OpenLoeTargetSpanTrace';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import type { ConventionKey, EffectiveSchedulingOptions, ProjectSchedulingOptions, SchedulingConventions } from '@/types/project';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function calendarData(bands: ReadonlyArray<readonly [string, string]>): string {
  const day = (n: number) => {
    const works = n >= 2 && n <= 6;
    const inner = works
      ? bands.map(([start, finish], i) => `(0||${i}(s|${start}|f|${finish})())`).join('')
      : '';
    return `(0||${n}()(${inner}))`;
  };
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
}

const SPLIT_DAY = calendarData([['08:00', '12:00'], ['13:00', '17:00']]);

const P6_OFF_GROUP_B: readonly ConventionKey[] = ['p6CompletedDataDateWindow', 'p6CompletedLoeActualFinish'];

const FIXTURE_POOL: string[][] = [];
function importXerAsRead(lines: string[]): ImportResult {
  FIXTURE_POOL.push([...lines]);
  const opened = readXER(new TextEncoder().encode(lines.join('\n')));
  if (isMultiDocumentImport(opened)) throw new Error('conventiefixture moet één project openen');
  return opened;
}

function importXer(lines: string[]): ImportResult {
  const opened = importXerAsRead(lines);
  for (const key of P6_OFF_GROUP_B) setConvention(opened, key, true);
  return opened;
}

interface Axes { es: string; ef: string; ls: string; lf: string; tf: number; ff: number }

const GROUP_B = [
  'p6RelationFinishBoundary', 'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow',
  'p6CompletedLoeActualFinish', 'p6OpenLoeTargetSpan',
] as const satisfies readonly ConventionKey[];
type GroupBKey = typeof GROUP_B[number];

function solveTasks(input: ImportResult) {
  const imported = structuredClone(input);
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: solveOptionsFor(imported.project).schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (result.error) throw new Error(result.error);
  return result.tasks;
}

function axesOf(tasks: ReturnType<typeof solveTasks>, taskId: string): Axes {
  const solved = tasks.get(taskId);
  if (!solved) throw new Error(`solver mist taak ${taskId}`);
  return {
    es: solved.earlyStart, ef: solved.earlyFinish,
    ls: solved.lateStart, lf: solved.lateFinish,
    tf: solved.totalFloat, ff: solved.freeFloat,
  };
}

function solveAxes(input: ImportResult, taskId: string): Axes {
  return axesOf(solveTasks(input), taskId);
}

function solveAllAxes(input: ImportResult): Record<string, Axes> {
  const tasks = solveTasks(input);
  const out: Record<string, Axes> = {};
  for (const task of input.tasks) out[task.id] = axesOf(tasks, task.id);
  return out;
}

function withProfile(input: ImportResult, mutate: (copy: ImportResult) => void): ImportResult {
  const copy = structuredClone(input);
  mutate(copy);
  return copy;
}

function withConventions(input: ImportResult, baseId: 'p6' | 'ops', values: SchedulingConventions): ImportResult {
  const copy = structuredClone(input);
  copy.project.schedulingProfile = { baseId, id: `test-${baseId}`, name: 'test', overrides: diffAgainstBase(baseId, values) };
  return copy;
}

interface ConventionFixture {
  flag: GroupBKey;
  label: string;
  input: ImportResult;
  taskId: string;
  pick: (axes: Axes) => Partial<Axes>;
  on: Partial<Axes>;
  off: Partial<Axes>;
}

const fixtures: ConventionFixture[] = [];

fixtures.push({
  flag: 'p6RelationFinishBoundary',
  label: 'B1 FS-nul-lag op gedeelde finishgrens',
  input: importXer([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x9\tCA_Base\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tB1-fixture\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tB\tP\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 17:00\t2026-01-06 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP\tP\tPR_FS\t0',
    '%E',
  ]),
  taskId: 'B',
  pick: axes => ({ es: axes.es }),
  on: { es: '2026-01-05T17:00' },
  off: { es: '2026-01-06T08:00' },
});

{
  const b1 = importXer([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t${calendarData([['08:00', '16:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tB1-laat\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tX\tP\tC1\tX100\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t40\t40\t2026-01-05 08:00\t2026-01-09 16:00',
    '%R\tT\tP\tC1\tT100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tS\tP\tC1\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 16:00\t2026-01-06 16:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tT\tP\tP\tPR_FS\t0',
    '%E',
  ]);
  eq('B1-laat fixture: de relatie staat op de voorgangerfinishgrens', b1.sequences[0].p6StartAtPredecessorFinishBoundary, true);
  eq('B1-laat: de opvolger toont haar late start als bandstart', (({ ls, lf }) => ({ ls, lf }))(solveAxes(b1, 'S')),
    { ls: '2026-01-09T08:00', lf: '2026-01-09T16:00' });
  eq('B1-laat: de voorganger krijgt de finishgrens ervóór', solveAxes(b1, 'T').lf, '2026-01-08T16:00');
}

fixtures.push({
  flag: 'p6BackwardLagFinishBoundary',
  label: 'B2 backward WORKTIME-lag vanaf finishgrens',
  input: importXer([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t${calendarData([['08:00', '16:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tB2-fixture\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tB\tP\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-07 08:00\t2026-01-07 16:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP\tP\tPR_FF\t16',
    '%E',
  ]),
  taskId: 'A',
  pick: axes => ({ lf: axes.lf }),
  on: { lf: '2026-01-05T16:00' },
  off: { lf: '2026-01-06T08:00' },
});

{
  const ff0 = importXer([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t${calendarData([['08:00', '16:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tB2-lag0\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tX\tP\tC1\tX100\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t40\t40\t2026-01-05 08:00\t2026-01-09 16:00',
    '%R\tA\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tB\tP\tC1\tB100\tMidden\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tC\tP\tC1\tC100\tSlot\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-06 08:00\t2026-01-06 16:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP\tP\tPR_FF\t0',
    '%R\tR2\tC\tB\tP\tP\tPR_FS\t0',
    '%E',
  ]);
  eq('B2 lag 0 fixture: B.LF op de finishgrens do 8 jan 16:00', solveAxes(ff0, 'B').lf, '2026-01-08T16:00');
  eq('B2 FF+0 vanaf een bandeinde ⇒ de finishgrens zelf', solveAxes(ff0, 'A').lf, '2026-01-08T16:00');
  eq('B2 uit ⇒ FF+0 normaliseert naar de volgende bandstart',
    solveAxes(withProfile(ff0, copy => setConvention(copy, 'p6BackwardLagFinishBoundary', false)), 'A').lf, '2026-01-09T08:00');
}

fixtures.push({
  flag: 'p6CompletedDataDateWindow',
  label: 'B3 voltooide taak op statusdatumvenster',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${SPLIT_DAY}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tB3-fixture\tC1\t2026-01-14 17:00\t2026-01-05 08:00\t2026-01-30 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tC\tP1\tC1\tDONE\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t8\t0\t2026-01-05 08:00\t2026-01-05 17:00\t2026-01-05 08:00\t2026-01-05 17:00',
    '%E',
  ]),
  taskId: 'C',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-15T08:00', ef: '2026-01-14T17:00' },
  off: { es: '2026-01-05T08:00', ef: '2026-01-05T17:00' },
});

fixtures.push({
  flag: 'p6CompletedLoeActualFinish',
  label: 'B4 voltooide LOE via actual-finishroute',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${SPLIT_DAY}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tB4-fixture\tC1\t2026-06-30 17:00\t2026-01-05 08:00\t2026-06-30 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tP\tP1\tC1\tPRED\tSS voorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-01-05 08:00\t2026-01-05 17:00\t\t',
    '%R\tL\tP1\tC1\tLOE\tVoltooide LOE\tTT_LOE\tDT_FixedDrtn\tTK_Complete\tCP_Drtn\t352\t0\t2026-01-05 08:00\t2026-03-06 17:00\t2026-01-05 08:00\t2026-03-06 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR-SS\tL\tP\tP1\tP1\tPR_SS\t0',
    '%E',
  ]),
  taskId: 'L',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-05T08:00', ef: '2026-03-06T17:00' },
  off: { es: '2026-07-01T08:00', ef: '2026-07-01T08:00' },
});

fixtures.push({
  flag: 'p6OpenLoeTargetSpan',
  label: 'B5 open LOE neemt targetvenster als span',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${SPLIT_DAY}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tB5-fixture\tC1\t2025-12-31 17:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tP\tP1\tC1\tPRED\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t8\t8\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tL\tP1\tC1\tLOE\tOpen LOE\tTT_LOE\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t80\t80\t2026-01-05 08:00\t2026-01-16 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t8\t8\t2026-01-16 08:00\t2026-01-16 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR-SS\tL\tP\tP1\tP1\tPR_SS\t0',
    '%R\tR-FF\tS\tL\tP1\tP1\tPR_FF\t0',
    '%E',
  ]),
  taskId: 'L',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-05T08:00', ef: '2026-01-16T17:00' },
  off: { es: '2026-01-05T08:00', ef: '2026-01-05T08:00' },
});

eq('inventaris: één fixture per groep-B-conventie',
  fixtures.map(fixture => fixture.flag), [...GROUP_B]);

for (const fixture of fixtures) {
  const { flag, label, input, taskId, pick } = fixture;
  eq(`${label}: fixture draagt het P6-profiel`, input.project.schedulingProfile?.baseId, 'p6');
  eq(`${label}: AAN en UIT verschillen (fixture is onderscheidend)`,
    JSON.stringify(fixture.on) !== JSON.stringify(fixture.off), true);

  const asRead = resolveConventions(input.project.schedulingProfile);
  if ((P6_OFF_GROUP_B as readonly string[]).includes(flag)) {
    eq(`${label}: 0. ingebouwd P6-profiel ⇒ ${flag} staat uit (§1d-7)`,
      resolveConventions({ baseId: 'p6', id: 'p6', name: '', overrides: {} })[flag], false);
    eq(`${label}: 0b. zoals gelezen (P6-profiel, geen afwijking) ⇒ UIT`,
      pick(solveAxes(withProfile(input, copy => setConvention(copy, flag, false)), taskId)), fixture.off);
  }
  eq(`${label}: 1. XER-import (P6-profiel; B3/B4 als afwijking aan) ⇒ AAN`,
    pick(solveAxes(input, taskId)), fixture.on);
  eq(`${label}: 2. alleen ${flag} uit ⇒ UIT`,
    pick(solveAxes(withProfile(input, copy => setConvention(copy, flag, false)), taskId)), fixture.off);
  const onlyThisB = { ...asRead };
  for (const key of GROUP_B) onlyThisB[key] = key === flag;
  eq(`${label}: 3. OPS-basis, A-waarden van het bestand, alleen ${flag} aan ⇒ AAN (de vlag schakelt, niet de basis)`,
    pick(solveAxes(withConventions(input, 'ops', onlyThisB), taskId)), fixture.on);
  eq(`${label}: 4. alle P6-gepoorte conventies uit ⇒ UIT`,
    pick(solveAxes(withProfile(input, withoutP6Semantics), taskId)), fixture.off);
  const noB = { ...asRead };
  for (const key of GROUP_B) noB[key] = false;
  eq(`${label}: 5. P6-basis met alle vijf B-conventies uit ⇒ UIT (de basis alleen doet niets)`,
    pick(solveAxes(withConventions(input, 'p6', noB), taskId)), fixture.off);
}

for (const fixture of fixtures) {
  const plain = solveAllAxes(fixture.input);
  const stray = structuredClone(fixture.input);
  stray.project.schedulingOptions = {
    ...stray.project.schedulingOptions, p6Source: 'XER',
  } as unknown as ProjectSchedulingOptions;
  eq(`${fixture.label}: verdwaalde bronmarkering is zesassig inert`, solveAllAxes(stray), plain);
  const noB = { ...resolveConventions(fixture.input.project.schedulingProfile) };
  for (const key of GROUP_B) noB[key] = false;
  eq(`${fixture.label}: P6-basis = OPS-basis bij gelijke opgeloste waarden (zesassig)`,
    solveAllAxes(withConventions(fixture.input, 'p6', noB)), solveAllAxes(withConventions(fixture.input, 'ops', noB)));
}

for (const fixture of fixtures.filter(f => f.flag === 'p6CompletedDataDateWindow' || f.flag === 'p6CompletedLoeActualFinish')) {
  eq(`${fixture.label}: ${fixture.flag} aan, A19 uit ⇒ UIT`,
    fixture.pick(solveAxes(withProfile(fixture.input, copy => setConvention(copy, 'p6UseRemainingStartForProgress', false)), fixture.taskId)),
    fixture.off);
}

{
  const b3 = fixtures.find(f => f.flag === 'p6CompletedDataDateWindow')!.input;
  const b4 = fixtures.find(f => f.flag === 'p6CompletedLoeActualFinish')!.input;
  const done = b3.tasks.find(task => task.id === 'C')!;
  const loe = b4.tasks.find(task => task.id === 'L')!;
  const b3Date = parseInstant(b3.project.statusDate!);
  const b4Date = parseInstant(b4.project.statusDate!);
  const so = (input: ImportResult, patch: Partial<EffectiveSchedulingOptions>): EffectiveSchedulingOptions =>
    ({ ...solveOptionsFor(input.project).schedulingOptions, ...patch });
  const loeIn = b4.sequences.filter(sequence => sequence.successorId === loe.id);
  const loeOut = b4.sequences.filter(sequence => sequence.predecessorId === loe.id);

  eq('guardvolgorde B3: statusdatum ontbreekt én conventie uit ⇒ missingDataDate',
    explainP6CompletedDataDateWindow(done, null, so(b3, { p6CompletedDataDateWindow: false })).reason, 'missingDataDate');
  eq('guardvolgorde B3: conventie uit én A19 uit ⇒ conventionOff',
    explainP6CompletedDataDateWindow(done, b3Date, so(b3, { p6CompletedDataDateWindow: false, p6UseRemainingStartForProgress: false })).reason,
    'conventionOff');
  eq('guardvolgorde B3: conventie aan, A19 uit ⇒ remainingStartOff',
    explainP6CompletedDataDateWindow(done, b3Date, so(b3, { p6UseRemainingStartForProgress: false })).reason, 'remainingStartOff');

  eq('guardvolgorde B4: statusdatum ontbreekt én conventie uit ⇒ missingDataDate',
    explainCompletedXerLoeActualFinishEligibilityResolved(loe, null, so(b4, { p6CompletedLoeActualFinish: false }), loeIn, loeOut).reason,
    'missingDataDate');
  eq('guardvolgorde B4: ongeldige statusdatum én conventie uit ⇒ invalidDataDate',
    explainCompletedXerLoeActualFinishEligibilityResolved(loe, new Date(Number.NaN), so(b4, { p6CompletedLoeActualFinish: false }), loeIn, loeOut).reason,
    'invalidDataDate');
  eq('guardvolgorde B4: conventie uit én A19 uit ⇒ conventionOff',
    explainCompletedXerLoeActualFinishEligibilityResolved(loe, b4Date, so(b4, { p6CompletedLoeActualFinish: false, p6UseRemainingStartForProgress: false }), loeIn, loeOut).reason,
    'conventionOff');

  eq('guardvolgorde A21: A21-vlag uit én B3 uit ⇒ conventionOff (B3 vóór de vlag)',
    explainP6CompletedLateRemainingWindowEligibilityResolved(done, b3Date, so(b3, { p6CompletedLateFromRemainingWindow: false, p6CompletedDataDateWindow: false })).reason,
    'conventionOff');
  eq('guardvolgorde A21: A21-vlag uit, B3 aan ⇒ flagOff',
    explainP6CompletedLateRemainingWindowEligibilityResolved(done, b3Date, so(b3, { p6CompletedLateFromRemainingWindow: false })).reason,
    'flagOff');
  eq('guardvolgorde A21: statusdatum ontbreekt én B3 uit ⇒ missingDataDate (actual-pin eerst)',
    explainP6CompletedLateRemainingWindowEligibilityResolved(done, null, so(b3, { p6CompletedDataDateWindow: false })).reason,
    'missingDataDate');

  const openLoeArgs = [[], [], b3Date, 0, 0] as const;
  eq('guardvolgorde B5: conventie uit op een niet-LOE ⇒ conventionOff (vóór de taakchecks)',
    explainOpenXerLoeTargetSpanEligibilityResolved(done, so(b3, { p6OpenLoeTargetSpan: false }), ...openLoeArgs).reason, 'conventionOff');
  eq('guardvolgorde B5: conventie aan op een niet-LOE ⇒ wrongActivityType',
    explainOpenXerLoeTargetSpanEligibilityResolved(done, so(b3, { p6OpenLoeTargetSpan: true }), ...openLoeArgs).reason, 'wrongActivityType');
}

{
  const here = fileURLToPath(new URL('.', import.meta.url));
  const engineRoot = join(here, '..', '..', 'src', 'engine');
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && readFileSync(full, 'utf8').includes('p6Source')) {
        hits.push(relative(engineRoot, full).split('\\').join('/'));
      }
    }
  };
  walk(engineRoot);
  eq('bronscan: p6Source komt nergens onder src/engine/ voor', hits.sort(), []);
}

const GROUP_C = [
  'p6CompletedPredecessorAtDataDate', 'p6FreeFloatOnOwnCalendar', 'p6CompletedRemainingLag', 'p6CompletedOutOfSequenceWindow',
  'p6CompletedPhysicalAtDataDate', 'p6InProgressStartLagElapsed',
  'p6FinishFinishStartMilestoneLateFinish', 'p6StartedTaskIgnoresPlannedStartFloor', 'p6LateFinishOnOwnCalendar',
  'p6ProgressOverrideIgnoresStartedSuccessor', 'p6FinishNotBeforeFinishFinishBound',
  'p6AlapPositionedFromSuccessors',
] as const satisfies readonly ConventionKey[];

function calendarDataOn(workDays: readonly number[], bands: ReadonlyArray<readonly [string, string]>): string {
  const day = (n: number) => {
    const inner = workDays.includes(n)
      ? bands.map(([s, f]) => `(0||0(s|${s}|f|${f})())`).join('')
      : '';
    return `(0||${n}()(${inner}))`;
  };
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
}

interface GroupCFixture {
  flag: typeof GROUP_C[number];
  label: string;
  input: ImportResult;
  taskId: string;
  pick: (axes: Axes) => Partial<Axes>;
  on: Partial<Axes>;
  off: Partial<Axes>;
  builtInOff?: Partial<Axes>;
  builtInOffByBase?: Record<'ops' | 'msproject', Partial<Axes>>;
  p6BuiltInOff?: true;
}
const groupC: GroupCFixture[] = [];

function enabledOverP6(flag: typeof GROUP_C[number], input: ImportResult): ImportResult {
  return withProfile(input, copy => setConvention(copy, flag, true));
}

groupC.push({
  flag: 'p6CompletedPredecessorAtDataDate',
  label: 'C1 voltooide voorganger met einde ná de statusdatum',
  input: enabledOverP6('p6CompletedPredecessorAtDataDate', importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC1-fixture\tC1\t2026-01-07 00:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tA\tP1\tC1\tA100\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t27\t0\t2026-01-05 08:00\t2026-01-07 17:00\t2026-01-05 08:00\t2026-01-07 17:00',
    '%R\tB\tP1\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-08 08:00\t2026-01-08 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP1\tP1\tPR_FS\t0',
    '%E',
  ])),
  p6BuiltInOff: true,
  taskId: 'B',
  pick: axes => ({ es: axes.es }),
  on: { es: '2026-01-07T08:00' },
  off: { es: '2026-01-08T08:00' },
});

groupC.push({
  flag: 'p6FreeFloatOnOwnCalendar',
  label: 'C2 vrije speling in de eigen kalender',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC5\tVijfdaags\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    `%R\tC4\tVierdaags\tP1\tCA_Project\t9\t36\t${calendarDataOn([2, 3, 4, 5], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC2-fixture\tC5\t2026-01-05 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tT\tP1\tC5\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t36\t36\t2026-01-05 08:00\t2026-01-08 17:00',
    '%R\tS\tP1\tC4\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-12 08:00\t2026-01-12 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tT\tP1\tP1\tPR_FS\t0',
    '%E',
  ]),
  taskId: 'T',
  pick: axes => ({ ef: axes.ef, ff: axes.ff }),
  on: { ef: '2026-01-08T17:00', ff: 1 },
  off: { ef: '2026-01-08T17:00', ff: 0 },
});

groupC.push({
  flag: 'p6CompletedRemainingLag',
  label: 'C3 verstreken lag uit een voltooide voorganger',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC3-fixture\tC1\t2026-01-14 17:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tC\tP1\tC1\tDONE\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t2026-01-05 08:00\t2026-01-05 17:00\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-15 08:00\t2026-01-15 17:00\t\t',
    '%R\tX\tP1\tC1\tLONG\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t180\t180\t2026-01-15 08:00\t2026-02-11 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tC\tP1\tP1\tPR_FS\t45',
    '%E',
  ]),
  taskId: 'C',
  pick: axes => ({ ls: axes.ls, lf: axes.lf }),
  on: { ls: '2026-02-11T08:00', lf: '2026-02-10T17:00' },
  off: { ls: '2026-02-04T08:00', lf: '2026-02-03T17:00' },
  builtInOff: { ls: '2026-02-03T08:00', lf: '2026-02-03T17:00' },
});

groupC.push({
  flag: 'p6CompletedOutOfSequenceWindow',
  label: 'C4 voltooide taak buiten volgorde',
  input: enabledOverP6('p6CompletedOutOfSequenceWindow', importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC4-fixture\tC1\t2026-01-14 17:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float\tsched_retained_logic',
    '%R\tP1\tN\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tP\tP1\tC1\tPRED\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-15 08:00\t2026-01-19 17:00\t\t',
    '%R\tC\tP1\tC1\tDONE\tVoltooid buiten volgorde\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t2026-01-05 08:00\t2026-01-05 17:00\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-15 08:00\t2026-01-15 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tC\tP\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tS\tC\tP1\tP1\tPR_FS\t0',
    '%E',
  ])),
  p6BuiltInOff: true,
  taskId: 'C',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-20T08:00', ef: '2026-01-19T17:00' },
  off: { es: '2026-01-15T08:00', ef: '2026-01-14T17:00' },
  builtInOff: { es: '2026-01-05T08:00', ef: '2026-01-05T17:00' },
});

function c5Fixture(extraTasks: string[] = [], extraRelations: string[] = []): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC5-fixture\tC1\t2026-01-14 00:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tD\tP1\tC1\tDONE\tVoltooid fysiek\tTT_Task\tDT_FixedDrtn\tTK_Complete\tCP_Phys\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t2026-01-06 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    ...extraTasks,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tD\tP1\tP1\tPR_FS\t0',
    ...extraRelations,
    '%E',
  ]);
}
groupC.push({
  flag: 'p6CompletedPhysicalAtDataDate',
  label: 'C5 voltooide CP_Phys-taak op de statusdatum',
  input: c5Fixture(),
  taskId: 'D',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-14T00:00', ef: '2026-01-14T00:00' },
  off: { es: '2026-01-05T08:00', ef: '2026-01-06T17:00' },
});

{
  const input = c5Fixture([
    '%R\tO\tP1\tC1\tOPEN1\tKorte voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    '%R\tQ\tP1\tC1\tOPEN2\tLange voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-14 08:00\t2026-01-16 17:00\t\t',
  ], ['%R\tR2\tD\tO\tP1\tP1\tPR_FS\t0', '%R\tR3\tD\tQ\tP1\tP1\tPR_FS\t0']);
  eq('C5 ff-kant fixture: het punt van D ligt op de grens van Q', (({ es, ef }) => ({ es, ef }))(solveAxes(input, 'D')),
    { es: '2026-01-16T17:00', ef: '2026-01-16T17:00' });
  eq('C5 ff-kant: vrije speling van O tot het punt van D', solveAxes(input, 'O').ff, 2);
  eq('C5 uit ⇒ geen punt, vrije speling 0',
    solveAxes(withProfile(input, copy => setConvention(copy, 'p6CompletedPhysicalAtDataDate', false)), 'O').ff, 0);
  const lagged = structuredClone(input);
  const rel = lagged.sequences.find(seq => seq.predecessorId === 'O')!;
  rel.lagMinutes = 540;
  rel.lagDays = 1;
  eq('C5 ff-kant niet bij een FS-relatie met lag', solveAxes(lagged, 'O').ff, 0);
  for (const type of ['START_START', 'FINISH_FINISH'] as const) {
    const typed = structuredClone(input);
    typed.sequences.find(seq => seq.predecessorId === 'O')!.type = type;
    eq(`C5 ff-kant niet bij een ${type}-relatie naar het punt`, solveAxes(typed, 'O').ff, 0);
  }
  const donePred = c5Fixture([
    '%R\tO\tP1\tC1\tDONE1\tVoltooide voorganger\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t2026-01-07 08:00\t2026-01-07 17:00\t2026-01-07 08:00\t2026-01-07 17:00',
    '%R\tQ\tP1\tC1\tOPEN2\tLange voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-14 08:00\t2026-01-16 17:00\t\t',
  ], ['%R\tR2\tD\tO\tP1\tP1\tPR_FS\t0', '%R\tR3\tD\tQ\tP1\tP1\tPR_FS\t0']);
  eq('C5 ff-kant: voltooide voorganger van het punt heeft vrije speling 0', solveAxes(donePred, 'O').ff, 0);
  eq('C5 ff-kant: voltooide voorganger, A12 uit ⇒ eigen relatiegrens (ff 7)',
    solveAxes(withProfile(donePred, copy => setConvention(copy, 'preserveActualDatesInBackwardPass', false)), 'O').ff, 7);
}

function c6Fixture(
  actualStart = '2026-01-05 08:00', extraTasks: string[] = [], extraRelations: string[] = [],
  ssLagEarlyStartFlag?: 'Y' | 'N',
): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC6-fixture\tC1\t2026-01-14 00:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    ...(ssLagEarlyStartFlag
      ? ['%T\tSCHEDOPTIONS', '%F\tproj_id\tsched_lag_early_start_flag', `%R\tP1\t${ssLagEarlyStartFlag}`]
      : []),
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    `%R\tA\tP1\tC1\tRUN\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t45\t18\t2026-01-05 08:00\t2026-01-15 17:00\t${actualStart}\t`,
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    ...extraTasks,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tA\tP1\tP1\tPR_SS\t18',
    ...extraRelations,
    '%E',
  ]);
}
groupC.push({
  flag: 'p6InProgressStartLagElapsed',
  label: 'C6 verstreken SS-lag uit een lopende voorganger',
  input: c6Fixture(),
  taskId: 'S',
  pick: axes => ({ es: axes.es }),
  on: { es: '2026-01-14T08:00' },
  off: { es: '2026-01-16T08:00' },
  builtInOffByBase: { ops: { es: '2026-01-14T08:00' }, msproject: { es: '2026-01-07T08:00' } },
});

function c7Fixture(milestoneType: 'TT_Mile' | 'TT_FinMile', withDriver = true): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC6-fixture\tC1\t2026-01-05 08:00\t2026-01-05 08:00\t2026-03-31 17:00',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP1\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00',
    `%R\tM\tP1\tC1\tM100\tMijlpaal\t${milestoneType}\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-06 08:00\t2026-01-06 08:00`,
    '%R\tZ\tP1\tC1\tZ100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-06 08:00\t2026-01-06 17:00',
    '%R\tY\tP1\tC1\tY100\tDrijver\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-05 08:00\t2026-01-07 17:00',
    '%R\tX\tP1\tC1\tX100\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t90\t90\t2026-01-05 08:00\t2026-01-16 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tM\tA\tP1\tP1\tPR_FF\t0',
    '%R\tR2\tZ\tM\tP1\tP1\tPR_FF\t0',
    ...(withDriver ? ['%R\tR3\tM\tY\tP1\tP1\tPR_FS\t0'] : []),
    '%E',
  ]);
}
groupC.push({
  flag: 'p6FinishFinishStartMilestoneLateFinish',
  label: 'C7 FF-relatie naar een startmijlpaal',
  input: c7Fixture('TT_Mile'),
  taskId: 'A',
  pick: axes => ({ ls: axes.ls, lf: axes.lf, tf: axes.tf, ff: axes.ff }),
  on: { ls: '2026-01-16T08:00', lf: '2026-01-16T17:00', tf: 9, ff: 2 },
  off: { ls: '2026-01-15T08:00', lf: '2026-01-15T17:00', tf: 8, ff: 2 },
  builtInOff: { ls: '2026-01-15T08:00', lf: '2026-01-16T08:00', tf: 8, ff: 1 },
});

function c8Fixture(started: boolean): ImportResult {
  const task = started
    ? '%R\tT\tP1\tC1\tT100\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t27\t18\t2026-01-19 08:00\t2026-01-21 17:00\t2026-01-05 08:00\t'
    : '%R\tT\tP1\tC1\tT100\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-19 08:00\t2026-01-21 17:00\t\t';
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC7-fixture\tC1\t2026-01-12 08:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tQ\tP1\tC1\tQ100\tLopende voorganger\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t18\t9\t2026-01-12 08:00\t2026-01-12 17:00\t2026-01-05 08:00\t',
    task,
    '%R\tS\tP1\tC1\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tT\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tT\tQ\tP1\tP1\tPR_FS\t0',
    '%E',
  ]);
}
groupC.push({
  flag: 'p6StartedTaskIgnoresPlannedStartFloor',
  label: 'C8 geplande-startvloer niet voor een lopende taak',
  input: c8Fixture(true),
  taskId: 'T',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-13T08:00', ef: '2026-01-14T17:00' },
  off: { es: '2026-01-19T08:00', ef: '2026-01-20T17:00' },
  builtInOff: { es: '2026-01-05T08:00', ef: '2026-01-14T17:00' },
});

function c9Fixture(): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC5\tVijfdaags\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    `%R\tC4\tVierdaags\tP1\tCA_Project\t9\t36\t${calendarDataOn([2, 3, 4, 5], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC9-fixture\tC5\t2026-01-05 08:00\t2026-01-05 08:00\t2026-03-31 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tX\tP1\tC5\tLANG\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t135\t135\t2026-01-05 08:00\t2026-01-23 17:00\t\t',
    '%R\tM\tP1\tC4\tM100\tStartmijlpaal\tTT_Mile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-05 08:00\t2026-01-05 08:00\t\t',
    '%R\tS\tP1\tC5\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t1\t1\t2026-01-05 08:00\t2026-01-05 09:00\t\t',
    '%R\tZ\tP1\tC5\tZ100\tSlot\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-01-05 09:00\t2026-01-12 09:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tM\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tZ\tS\tP1\tP1\tPR_FS\t0',
    '%E',
  ]);
}
groupC.push({
  flag: 'p6LateFinishOnOwnCalendar',
  label: 'C9 late finish op de eigen kalender',
  input: c9Fixture(),
  taskId: 'M',
  pick: axes => ({ lf: axes.lf }),
  on: { lf: '2026-01-15T17:00' },
  off: { lf: '2026-01-16T16:00' },
});

{
  const input = c9Fixture();
  input.tasks.find(task => task.id === 'M')!.constraint = { type: 'FNLT', date: '2026-01-16T12:00' };
  eq('C9 bronvoorwaarde: een strakkere FNLT buiten de werktijd wint en wordt niet gesnapt',
    (({ lf }) => ({ lf }))(solveAxes(input, 'M')), { lf: '2026-01-16T12:00' });
}

function c11Fixture(successorStarted = true, predecessorCompleted = false): ImportResult {
  const a = predecessorCompleted
    ? '%R\tA\tP1\tC1\tA100\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t2026-01-09 17:00'
    : '%R\tA\tP1\tC1\tA100\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t18\t9\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t';
  const b = successorStarted
    ? '%R\tB\tP1\tC1\tB100\tGestarte opvolger\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t27\t18\t2026-01-06 08:00\t2026-01-08 17:00\t2026-01-06 08:00\t'
    : '%R\tB\tP1\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-13 08:00\t2026-01-14 17:00\t\t';
  const input = importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC11-fixture\tC1\t2026-01-12 08:00\t2026-01-05 08:00\t2026-03-31 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tX\tP1\tC1\tLANG\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t72\t72\t2026-01-12 08:00\t2026-01-21 17:00\t\t',
    a,
    b,
    '%R\tC\tP1\tC1\tC100\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-15 08:00\t2026-01-19 17:00\t\t',
    '%R\tD\tP1\tC1\tD100\tAndere voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-12 08:00\t2026-01-14 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tC\tA\tP1\tP1\tPR_FS\t0',
    '%R\tR3\tC\tD\tP1\tP1\tPR_FS\t0',
    '%E',
  ]);
  input.project.progressMode = 'PROGRESS_OVERRIDE';
  setConvention(input, 'p6UseRemainingStartForProgress', false);
  return input;
}
groupC.push({
  flag: 'p6ProgressOverrideIgnoresStartedSuccessor',
  label: 'C11 Progress Override negeert de gestarte opvolger ook achterwaarts',
  input: c11Fixture(),
  taskId: 'A',
  pick: axes => ({ lf: axes.lf, tf: axes.tf, ff: axes.ff }),
  on: { lf: '2026-01-16T17:00', tf: 4, ff: 2 },
  off: { lf: '2026-01-05T17:00', tf: -5, ff: 0 },
  builtInOff: { lf: '2026-01-16T17:00', tf: 4, ff: -5 },
});

{
  {
    const withA19 = withProfile(c11Fixture(), copy => setConvention(copy, 'p6UseRemainingStartForProgress', true));
    eq('C11 met A19 aan: C11 aan', (({ lf, tf, ff }) => ({ lf, tf, ff }))(solveAxes(withA19, 'A')), { lf: '2026-01-16T17:00', tf: 4, ff: 2 });
    eq('C11 met A19 aan: C11 uit ⇒ alleen de vrije speling verschilt',
      (({ lf, tf, ff }) => ({ lf, tf, ff }))(solveAxes(withProfile(withA19, copy => setConvention(copy, 'p6ProgressOverrideIgnoresStartedSuccessor', false)), 'A')),
      { lf: '2026-01-16T17:00', tf: 4, ff: 0 });
  }
  const pickA = (axes: Axes) => ({ ls: axes.ls, lf: axes.lf, tf: axes.tf, ff: axes.ff });
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6ProgressOverrideIgnoresStartedSuccessor', false));
  const retained = c11Fixture();
  retained.project.progressMode = 'RETAINED_LOGIC';
  eq('C11 onder Retained Logic ⇒ geen effect', pickA(solveAxes(retained, 'A')), pickA(solveAxes(off(retained), 'A')));
  const unstarted = c11Fixture(false);
  eq('C11 naar een niet-gestarte opvolger ⇒ geen effect', pickA(solveAxes(unstarted, 'A')), pickA(solveAxes(off(unstarted), 'A')));
  const completed = c11Fixture(true, true);
  eq('C11 vanuit een voltooide voorganger ⇒ geen effect', pickA(solveAxes(completed, 'A')), pickA(solveAxes(off(completed), 'A')));
  const opsOnly = (input: ImportResult, on: boolean) => withProfile(input, copy => {
    copy.project.schedulingProfile = { baseId: 'ops', id: 'test-ops', name: 'test', overrides: on ? { p6ProgressOverrideIgnoresStartedSuccessor: true } : {} };
  });
  eq('C11 vanuit een voltooide voorganger, OPS-basis ⇒ geen effect',
    pickA(solveAxes(opsOnly(completed, true), 'A')), pickA(solveAxes(opsOnly(completed, false), 'A')));
  const input = c11Fixture();
  eq('C11 laat de gestarte opvolger zelf ongemoeid', solveAxes(input, 'B'), solveAxes(off(input), 'B'));
}

function c12Fixture(opts: { predMilestone?: boolean; sameCalendar?: boolean; predHours?: number; lagHours?: number } = {}): ImportResult {
  const hours = opts.predHours ?? 31;
  const succCal = opts.sameCalendar ? 'C7' : 'C3';
  const pred = opts.predMilestone
    ? '%R\tP\tP1\tC7\tP100\tStartmijlpaal\tTT_Mile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-08 08:00\t2026-01-08 08:00\t\t'
    : `%R\tP\tP1\tC7\tP100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t${hours}\t${hours}\t2026-01-05 08:00\t2026-01-08 12:00\t\t`;
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC7\tZevendaags\tP1\tCA_Project\t9\t63\t${calendarDataOn([1, 2, 3, 4, 5, 6, 7], [['08:00', '17:00']])}`,
    `%R\tC3\tMa-wo\tP1\tCA_Project\t9\t27\t${calendarDataOn([2, 3, 4], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC12-fixture\tC7\t2026-01-05 08:00\t2026-01-05 08:00\t2026-03-31 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tX\tP1\tC7\tLANG\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t180\t180\t2026-01-05 08:00\t2026-01-24 17:00\t\t',
    pred,
    `%R\tS\tP1\t${succCal}\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00\t\t`,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tP\tP1\tP1\tPR_FF\t${opts.lagHours ?? 0}`,
    '%E',
  ]);
}
groupC.push({
  flag: 'p6FinishNotBeforeFinishFinishBound',
  label: 'C12 vroege finish niet vóór de FF-grens',
  input: c12Fixture(),
  taskId: 'S',
  pick: axes => ({ ef: axes.ef }),
  on: { ef: '2026-01-12T08:00' },
  off: { ef: '2026-01-07T17:00' },
});

{
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6FinishNotBeforeFinishFinishBound', false));
  const base = c12Fixture();
  eq('C12 vrije speling van de FF-voorganger tot de vroege finish van de opvolger', solveAxes(base, 'P').ff, 32 / 9);
  eq('C12 uit ⇒ vrije speling via de afgeleide startgrens', solveAxes(off(base), 'P').ff, 0);
  const milestone = c12Fixture({ predMilestone: true, sameCalendar: true });
  eq('C12 FF vanaf een startmijlpaal: EF op de start van de mijlpaal', solveAxes(milestone, 'S').ef, '2026-01-08T08:00');
  eq('C12 uit, FF vanaf een startmijlpaal: het bandeinde ervóór', solveAxes(off(milestone), 'S').ef, '2026-01-07T17:00');
  const plain = c12Fixture({ sameCalendar: true, predHours: 27 });
  eq('C12 fixture: gewone FF eindigt op het bandeinde van de voorganger', solveAxes(plain, 'S').ef, '2026-01-07T17:00');
  eq('C12 gewone FF op dezelfde kalender ⇒ geen effect', solveAxes(plain, 'S'), solveAxes(off(plain), 'S'));
  const running = c12Fixture();
  const r = running.tasks.find(task => task.id === 'S')!;
  r.time.actualStart = '2026-01-05T08:00';
  r.time.completion = 0.01;
  r.time.remainingMinutes = 540;
  running.project.statusDate = '2026-01-05T13:00';
  eq('C12 lopende opvolger: restwerk eindigt niet vóór de FF-grens', solveAxes(running, 'S').ef, '2026-01-12T08:00');
  eq('C12 uit, lopende opvolger: het bandeinde ervóór', solveAxes(off(running), 'S').ef, '2026-01-07T17:00');
  const started = c12Fixture({ sameCalendar: true });
  const s = started.tasks.find(task => task.id === 'S')!;
  s.time.actualStart = '2026-01-05T08:00';
  s.time.completion = 0.5;
  s.time.remainingMinutes = 270;
  started.project.statusDate = '2026-01-05T13:00';
  started.project.progressMode = 'PROGRESS_OVERRIDE';
  eq('C12 legt geen grens met werktijd ertussen op', solveAxes(started, 'S').ef, solveAxes(off(started), 'S').ef);
  const lagged = c12Fixture({ lagHours: 4 });
  const c2off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', false));
  eq('C12 FF+4 u: grens nog in vrije tijd van S', solveAxes(lagged, 'S').ef, '2026-01-12T08:00');
  eq('C12 FF+4 u (C2 uit): vrije speling springt niet naar de vroege finish van S', solveAxes(c2off(lagged), 'P').ff, 0);
  eq('C12 FF+4 u (C2 uit): vrije speling gelijk aan C12 uit', solveAxes(c2off(lagged), 'P').ff, solveAxes(off(c2off(lagged)), 'P').ff);
  eq('C12 FF+4 u onder P6: C2 telt vanaf de grens tot de vroege finish van S (28/9)', solveAxes(lagged, 'P').ff, 28 / 9);
  const runningPo = structuredClone(running);
  runningPo.project.progressMode = 'PROGRESS_OVERRIDE';
  runningPo.tasks.find(task => task.id === 'S')!.time.remainingMinutes = 1320;
  eq('C12 lopende opvolger onder Progress Override: grens in vrije tijd wordt opgelegd', solveAxes(runningPo, 'S').ef, '2026-01-12T08:00');
  eq('C12 uit, lopende opvolger onder Progress Override: het bandeinde', solveAxes(off(runningPo), 'S').ef, '2026-01-07T17:00');
  const a12off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'preserveActualDatesInBackwardPass', false));
  const donePred = c12Fixture();
  const dp = donePred.tasks.find(task => task.id === 'P')!;
  dp.time.actualStart = '2026-01-05T08:00';
  dp.time.actualFinish = '2026-01-08T12:00';
  dp.time.completion = 1;
  dp.time.remainingMinutes = 0;
  donePred.project.statusDate = '2026-01-09T08:00';
  eq('C12 voltooide FF-voorganger (A12 uit): vrije speling via de afgeleide startgrens', solveAxes(a12off(donePred), 'P').ff, 1);
  eq('C12 voltooide FF-voorganger (A12 uit): gelijk aan C12 uit',
    solveAxes(a12off(donePred), 'P').ff, solveAxes(off(a12off(donePred)), 'P').ff);
  eq('C12 voltooide FF-voorganger onder P6 (A12 aan): vrije speling 0', solveAxes(donePred, 'P').ff, 0);
}

function c14Fixture(alapTargetStart: string, alapTargetEnd: string, withPred = false): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC14-fixture\tC1\t2026-01-05 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tcstr_type',
    `%R\tA\tP1\tC1\tA100\tZo laat mogelijk\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t${alapTargetStart}\t${alapTargetEnd}\t\t\tCS_ALAP`,
    '%R\tC\tP1\tC1\tC100\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t31\t31\t2026-01-05 08:00\t2026-01-08 12:00\t\t\t',
    '%R\tB\tP1\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-08 12:00\t2026-01-09 12:00\t\t\t',
    ...(withPred ? ['%R\tQ\tP1\tC1\tQ100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t3\t3\t2026-01-05 08:00\t2026-01-05 11:00\t\t\t'] : []),
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tB\tC\tP1\tP1\tPR_FS\t0',
    ...(withPred ? ['%R\tR3\tA\tQ\tP1\tP1\tPR_FS\t0'] : []),
    '%E',
  ]);
}
groupC.push({
  flag: 'p6AlapPositionedFromSuccessors',
  label: 'C14 ALAP zo laat als de opvolgers toestaan, in werktijd',
  input: c14Fixture('2026-01-12 08:00', '2026-01-12 17:00'),
  taskId: 'A',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-07T12:00', ef: '2026-01-08T12:00' },
  off: { es: '2026-01-12T08:00', ef: '2026-01-12T17:00' },
});

{
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6AlapPositionedFromSuccessors', false));
  const pickEsEf = (axes: Axes) => ({ es: axes.es, ef: axes.ef });
  const later = c14Fixture('2026-01-12 08:00', '2026-01-12 17:00');
  eq('C14 ALAP-wortel met later gepland venster ⇒ vóór haar opvolger', pickEsEf(solveAxes(later, 'A')),
    { es: '2026-01-07T12:00', ef: '2026-01-08T12:00' });
  eq('C14 uit ⇒ ALAP-wortel op haar eigen geplande venster', pickEsEf(solveAxes(off(later), 'A')),
    { es: '2026-01-12T08:00', ef: '2026-01-12T17:00' });
  eq('C14 opvolger blijft op de grens van C', solveAxes(later, 'B').es, '2026-01-08T12:00');
  eq('C14 uit ⇒ opvolger achter het geplande venster van A', solveAxes(off(later), 'B').es, '2026-01-13T08:00');
  eq('C14 uit ⇒ gewone ALAP-stap sluit met haar duur aan op B',
    pickEsEf(solveAxes(off(c14Fixture('2026-01-05 08:00', '2026-01-05 17:00')), 'A')),
    { es: '2026-01-07T12:00', ef: '2026-01-08T12:00' });
  const laterWithPred = c14Fixture('2026-01-12 08:00', '2026-01-12 17:00', true);
  eq('C14 ALAP met voorganger en later gepland venster: A16-vloer telt niet', pickEsEf(solveAxes(laterWithPred, 'A')),
    { es: '2026-01-07T12:00', ef: '2026-01-08T12:00' });
  eq('C14 ALAP met voorganger: opvolger blijft op de grens van C', solveAxes(laterWithPred, 'B').es, '2026-01-08T12:00');
  eq('C14 uit ⇒ A16-vloer zet de ALAP-taak op haar venster', solveAxes(off(laterWithPred), 'A').es, '2026-01-12T08:00');
  const started = c14Fixture('2026-01-05 08:00', '2026-01-05 17:00');
  const a = started.tasks.find(task => task.id === 'A')!;
  a.time.actualStart = '2026-01-05T08:00';
  a.time.completion = 0.5;
  eq('C14 raakt geen gestarte ALAP-taak', solveAllAxes(started), solveAllAxes(off(started)));
  const chain = c14Fixture('2026-01-05 08:00', '2026-01-05 17:00');
  const a0 = structuredClone(chain.tasks.find(task => task.id === 'A')!);
  chain.tasks.unshift({ ...a0, id: 'A0', wbsCode: 'A000', name: 'Zo laat mogelijk (eerder)', p6TaskId: 'A0' });
  chain.sequences.push({ id: 'R0', predecessorId: 'A0', successorId: 'A', type: 'FINISH_START', lagDays: 0, lagMinutes: 0 });
  eq('C14 ALAP-keten sluit aaneen (A)', pickEsEf(solveAxes(chain, 'A')), { es: '2026-01-07T12:00', ef: '2026-01-08T12:00' });
  eq('C14 ALAP-keten sluit aaneen (A0 direct vóór A)', pickEsEf(solveAxes(chain, 'A0')),
    { es: '2026-01-06T12:00', ef: '2026-01-07T12:00' });
  const fnlt = c14Fixture('2026-01-05 08:00', '2026-01-05 17:00');
  fnlt.tasks.find(task => task.id === 'A')!.constraint2 = { type: 'FNLT', date: '2026-01-07T17:00' };
  eq('C14 ALAP + FNLT als tweede constraint: A schuift niet over haar FNLT', pickEsEf(solveAxes(fnlt, 'A')),
    { es: '2026-01-07T08:00', ef: '2026-01-07T17:00' });
  const snet = c14Fixture('2026-01-05 08:00', '2026-01-05 17:00');
  snet.tasks.find(task => task.id === 'A')!.constraint2 = { type: 'SNET', date: '2026-01-08T08:00' };
  snet.tasks.find(task => task.id === 'B')!.constraint = { type: 'MSO', date: '2026-01-07T08:00', hard: true };
  eq('C14 ALAP + SNET als tweede constraint: de opvolger trekt A niet vóór haar SNET', pickEsEf(solveAxes(snet, 'A')),
    { es: '2026-01-08T08:00', ef: '2026-01-08T17:00' });
}

eq('inventaris: één fixture per groep-C-conventie', groupC.map(fixture => fixture.flag), [...GROUP_C]);
for (const fixture of groupC) {
  const { flag, label, input, taskId, pick } = fixture;
  eq(`${label}: fixture draagt het P6-profiel`, input.project.schedulingProfile?.baseId, 'p6');
  eq(`${label}: AAN en UIT verschillen (fixture is onderscheidend)`,
    JSON.stringify(fixture.on) !== JSON.stringify(fixture.off), true);
  const asRead = resolveConventions(input.project.schedulingProfile);
  if (fixture.p6BuiltInOff) {
    const asImported = withProfile(input, copy => setConvention(copy, flag, false));
    eq(`${label}: 0. ingebouwd P6-profiel ⇒ ${flag} staat uit`,
      resolveConventions({ baseId: 'p6', id: 'p6', name: '', overrides: {} })[flag], false);
    eq(`${label}: 0b. zoals gelezen draagt geen afwijking op ${flag}`,
      asImported.project.schedulingProfile?.overrides?.[flag], undefined);
    eq(`${label}: 1. XER-import zoals gelezen (P6-profiel) ⇒ UIT`, pick(solveAxes(asImported, taskId)), fixture.off);
    eq(`${label}: 1b. P6-profiel met ${flag} als afwijking aan ⇒ AAN`, pick(solveAxes(input, taskId)), fixture.on);
  } else {
    eq(`${label}: 1. XER-import zoals gelezen (P6-profiel) ⇒ AAN`, pick(solveAxes(input, taskId)), fixture.on);
  }
  eq(`${label}: 2. alleen ${flag} uit ⇒ UIT`,
    pick(solveAxes(withProfile(input, copy => setConvention(copy, flag, false)), taskId)), fixture.off);
  const onlyThis = { ...asRead };
  for (const key of GROUP_C) onlyThis[key] = key === flag;
  eq(`${label}: 3. OPS-basis, overige waarden van het bestand, alleen ${flag} aan ⇒ AAN`,
    pick(solveAxes(withConventions(input, 'ops', onlyThis), taskId)), fixture.on);
  for (const baseId of ['ops', 'msproject'] as const) {
    const plain = structuredClone(input);
    plain.project.schedulingProfile = { baseId, id: baseId, name: '', overrides: {} };
    eq(`${label}: 4. ingebouwd profiel ${baseId} ⇒ UIT`, pick(solveAxes(plain, taskId)), fixture.builtInOffByBase?.[baseId] ?? fixture.builtInOff ?? fixture.off);
  }
}

{
  const floor = c6Fixture('2026-01-05 08:00',
    ['%R\tB\tP1\tC1\tPRE\tVoorganger A\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-14 08:00\t2026-01-15 17:00\t\t'],
    ['%R\tR2\tA\tB\tP1\tP1\tPR_FS\t0']);
  eq('C6-vloer fixture: A\'s restwerkstart ligt ná de statusdatum', solveAxes(floor, 'A').es, '2026-01-16T08:00');
  eq('C6-vloer: volledig verstreken lag ⇒ rest-lag 0, S op A\'s restwerkstart', solveAxes(floor, 'S').es, '2026-01-16T08:00');
}

{
  const c4 = groupC.find(fixture => fixture.flag === 'p6CompletedOutOfSequenceWindow')!;
  eq('C4 opvolger start ná het verschoven venster', solveAxes(c4.input, 'S').es, '2026-01-20T08:00');
  eq('C4 uit ⇒ opvolger op de statusdatum',
    solveAxes(withProfile(c4.input, copy => setConvention(copy, 'p6CompletedOutOfSequenceWindow', false)), 'S').es,
    '2026-01-15T08:00');
  const override = structuredClone(c4.input);
  override.project.progressMode = 'PROGRESS_OVERRIDE';
  eq('C4 onder Progress Override ⇒ venster op de statusdatum',
    (({ es, ef }) => ({ es, ef }))(solveAxes(override, 'C')), c4.off);
  for (const type of ['FINISH_FINISH', 'START_FINISH'] as const) {
    const variant = structuredClone(c4.input);
    variant.sequences.find(seq => seq.successorId === 'C')!.type = type;
    eq(`C4 raakt geen ${type}-relatie naar de voltooide taak`,
      (({ es, ef }) => ({ es, ef }))(solveAxes(variant, 'C')), c4.off);
  }
  const hammock = structuredClone(c4.input);
  const hammockP = hammock.tasks.find(task => task.id === 'P')!;
  hammock.tasks.push({ ...structuredClone(hammockP), id: 'Q', wbsCode: 'SPAN', name: 'Overspannen', p6TaskId: 'Q' });
  hammockP.isHammock = true;
  hammock.sequences.push(
    { id: 'H-SS', predecessorId: 'Q', successorId: 'P', type: 'START_START', lagDays: 0 },
    { id: 'H-FF', predecessorId: 'Q', successorId: 'P', type: 'FINISH_FINISH', lagDays: 0 },
  );
  eq('C4 hammock-fixture: de hammock eindigt ná de statusdatum', solveAxes(hammock, 'P').ef, '2026-01-19T17:00');
  eq('C4 raakt geen LOE/hammock-voorganger', (({ es, ef }) => ({ es, ef }))(solveAxes(hammock, 'C')), c4.off);
  const anchored = structuredClone(c4.input);
  const s = anchored.tasks.find(task => task.id === 'S')!;
  anchored.tasks.push({
    ...structuredClone(s), id: 'X', wbsCode: 'LONG', name: 'Lang', p6TaskId: 'X',
    time: { ...structuredClone(s.time), durationMinutes: 180 * 60, remainingMinutes: 180 * 60, scheduleDuration: 20, scheduleFinish: '2026-02-11T17:00' },
  });
  const lateOn = solveAxes(anchored, 'C');
  const lateOff = solveAxes(withProfile(anchored, copy => setConvention(copy, 'p6CompletedOutOfSequenceWindow', false)), 'C');
  eq('C4 laat de late kant ongemoeid', [lateOn.ls, lateOn.lf], [lateOff.ls, lateOff.lf]);
  eq('C4 late kant fixture: X legt het projecteinde vast', solveAxes(anchored, 'X').ef, '2026-02-11T17:00');
}

{
  const c5 = groupC.find(fixture => fixture.flag === 'p6CompletedPhysicalAtDataDate')!;
  eq('C5 late kant: één punt op de LS van de opvolger',
    (({ ls, lf }) => ({ ls, lf }))(solveAxes(c5.input, 'D')), { ls: '2026-01-14T08:00', lf: '2026-01-14T08:00' });
  eq('C5 uit ⇒ late kant op de werkelijke datums (A12)',
    (({ ls, lf }) => ({ ls, lf }))(solveAxes(withProfile(c5.input, copy => setConvention(copy, 'p6CompletedPhysicalAtDataDate', false)), 'D')),
    { ls: '2026-01-05T08:00', lf: '2026-01-06T17:00' });
  const openPred = '%R\tP\tP1\tC1\tPRED\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-14 08:00\t2026-01-15 17:00\t\t';
  const point = (lagHours: number) => {
    const input = c5Fixture([openPred], [`%R\tR0\tD\tP\tP1\tP1\tPR_FS\t${lagHours}`]);
    const d = solveAxes(input, 'D');
    return { es: d.es, ef: d.ef, s: solveAxes(input, 'S').es };
  };
  eq('C5 open voorganger FS0 ⇒ punt op zijn rauwe einde', point(0),
    { es: '2026-01-15T17:00', ef: '2026-01-15T17:00', s: '2026-01-16T08:00' });
  eq('C5 open voorganger FS+4 h ⇒ punt na de volle lag', point(4),
    { es: '2026-01-16T12:00', ef: '2026-01-16T12:00', s: '2026-01-16T12:00' });
  eq('C5 lag die op een band-eind landt blijft op dat eind (rand)', point(9),
    { es: '2026-01-16T17:00', ef: '2026-01-16T17:00', s: '2026-01-19T08:00' });
  eq('C5 uit ⇒ werkelijke datums, ook met een open voorganger',
    (({ es, ef }) => ({ es, ef }))(solveAxes(withProfile(c5Fixture([openPred], ['%R\tR0\tD\tP\tP1\tP1\tPR_FS\t0']),
      copy => setConvention(copy, 'p6CompletedPhysicalAtDataDate', false)), 'D')),
    { es: '2026-01-05T08:00', ef: '2026-01-06T17:00' });
  const gated = (mutate: (task: Task, input: ImportResult) => void) => {
    const input = structuredClone(c5.input);
    mutate(input.tasks.find(task => task.id === 'D')!, input);
    return solveAxes(input, 'D').es;
  };
  eq('C5 poort: CP_Drtn doet niet mee', gated(task => { task.p6CompletePctType = 'CP_Drtn'; }), '2026-01-05T08:00');
  eq('C5 poort: suspend/resume doet niet mee', gated(task => { task.p6SuspendResume = true; }), '2026-01-05T08:00');
  eq('C5 poort: werkelijk einde ná de statusdatum doet niet mee',
    gated(task => { task.time.actualFinish = '2026-01-14T09:00'; }), '2026-01-05T08:00');
  eq('C5 poort: zonder A19 geen punt',
    gated((_task, input) => setConvention(input, 'p6UseRemainingStartForProgress', false)), '2026-01-05T08:00');
  const lone = c5Fixture();
  lone.sequences = [];
  eq('C5 zonder opvolger ⇒ late kant op het projecteinde',
    (({ ls, lf }) => ({ ls, lf }))(solveAxes(lone, 'D')), { ls: '2026-01-14T17:00', lf: '2026-01-14T17:00' });
}

{
  const completed = (id: string, pctType: string, durationType: string) =>
    `%R\t${id}\tP1\tC1\t${id}00\tVoltooid ${pctType}/${durationType}\tTT_Task\t${durationType}\tTK_Complete\t${pctType}\t18\t0\t2026-01-07 08:00\t2026-01-08 17:00\t2026-01-05 08:00\t2026-01-06 17:00`;
  const net = c5Fixture([
    completed('V1', 'CP_Drtn', 'DT_FixedDrtn'),
    completed('V2', 'CP_Units', 'DT_FixedDUR2'),
    completed('V3', 'CP_Units', 'DT_FixedDrtn'),
  ]);
  eq('C5-vangnet fixture draagt het P6-profiel', net.project.schedulingProfile?.baseId, 'p6');
  const actuals = { es: '2026-01-05T08:00', ef: '2026-01-06T17:00' };
  for (const id of ['V1', 'V2', 'V3']) {
    eq(`C5-vangnet: voltooide ${id} (geen CP_Phys) houdt haar werkelijke datums onder P6`,
      (({ es, ef }) => ({ es, ef }))(solveAxes(net, id)), actuals);
  }
  eq('C5-vangnet: de CP_Phys-tegenhanger staat op het statusdatumpunt',
    (({ es, ef }) => ({ es, ef }))(solveAxes(net, 'D')), { es: '2026-01-14T00:00', ef: '2026-01-14T00:00' });
}

{
  const partial = solveAxes(c6Fixture('2026-01-13 08:00'), 'S').es;
  eq('C6 deels verstreken lag ⇒ alleen de rest telt', partial, '2026-01-15T08:00');
  const fs = c6Fixture();
  fs.sequences[0].type = 'FINISH_START';
  eq('C6 raakt geen FS-relatie',
    solveAxes(fs, 'S').es,
    solveAxes(withProfile(fs, copy => setConvention(copy, 'p6InProgressStartLagElapsed', false)), 'S').es);
}

{
  const B_TASK = '%R\tB\tP1\tC1\tPRE\tVoorganger A\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-14 08:00\t2026-01-15 17:00\t\t';
  const B_REL = '%R\tR2\tA\tB\tP1\tP1\tPR_FS\t0';
  const floorEs = c6Fixture('2026-01-05 08:00', [B_TASK], [B_REL], 'Y');
  const floorAs = c6Fixture('2026-01-05 08:00', [B_TASK], [B_REL], 'N');
  eq('SS-lag-variant: Y ⇒ projectoptie earlyStart, N ⇒ actualStart', [
    floorEs.project.schedulingOptions?.startToStartLagFrom, floorAs.project.schedulingOptions?.startToStartLagFrom,
  ], ['earlyStart', 'actualStart']);
  eq('SS-lag-variant (a): Early Start ⇒ S op A\'s restwerkstart', solveAxes(floorEs, 'S').es, '2026-01-16T08:00');
  eq('SS-lag-variant (a): Actual Start ⇒ S op de statusdatum + rest-lag 0', solveAxes(floorAs, 'S').es, '2026-01-14T08:00');
  eq('SS-lag-variant (a): de voorganger zelf verschuift niet mee', solveAxes(floorAs, 'A').es, '2026-01-16T08:00');
  eq('SS-lag-variant (b): Early Start ⇒ restwerkstart + 9 h rest-lag',
    solveAxes(c6Fixture('2026-01-13 08:00', [B_TASK], [B_REL], 'Y'), 'S').es, '2026-01-19T08:00');
  eq('SS-lag-variant (b): Actual Start ⇒ statusdatum + 9 h rest-lag',
    solveAxes(c6Fixture('2026-01-13 08:00', [B_TASK], [B_REL], 'N'), 'S').es, '2026-01-15T08:00');
  eq('SS-lag-variant (c): restwerkstart op de statusdatumgrens ⇒ beide varianten gelijk',
    [solveAxes(c6Fixture(undefined, [], [], 'Y'), 'S').es, solveAxes(c6Fixture(undefined, [], [], 'N'), 'S').es],
    ['2026-01-14T08:00', '2026-01-14T08:00']);
  const c6Off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6InProgressStartLagElapsed', false));
  eq('SS-lag-variant (d): C6 uit ⇒ optie inert (volle lag vanaf A\'s vroege start)',
    [solveAxes(c6Off(floorEs), 'S').es, solveAxes(c6Off(floorAs), 'S').es], ['2026-01-20T08:00', '2026-01-20T08:00']);
  for (const baseId of ['ops', 'msproject'] as const) {
    const plain = (input: ImportResult) => withProfile(input, copy => {
      copy.project.schedulingProfile = { baseId, id: baseId, name: '', overrides: {} };
    });
    eq(`SS-lag-variant (d): ingebouwd profiel ${baseId} ⇒ optie inert`,
      solveAxes(plain(floorAs), 'S'), solveAxes(plain(floorEs), 'S'));
  }
  const L_TASK = '%R\tL\tP1\tC1\tLONG\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t180\t180\t2026-01-15 08:00\t2026-02-11 17:00\t\t';
  const L_REL = '%R\tR3\tL\tS\tP1\tP1\tPR_FS\t0';
  const critAs = c6Fixture('2026-01-05 08:00', [B_TASK, L_TASK], [B_REL, L_REL], 'N');
  const critEs = c6Fixture('2026-01-05 08:00', [B_TASK, L_TASK], [B_REL, L_REL], 'Y');
  eq('SS-lag-variant (e): Actual Start ⇒ S kritiek (tf 0)', solveAxes(critAs, 'S').tf, 0);
  eq('SS-lag-variant (e): Actual Start ⇒ lopende A niet door S begrensd (tf 17, geen −2)', solveAxes(critAs, 'A').tf, 17);
  eq('SS-lag-variant (e): Actual Start ⇒ B niet via A door S begrensd (tf 17, geen −2)', solveAxes(critAs, 'B').tf, 17);
  eq('SS-lag-variant (e): Early Start ⇒ A, B, S kritiek (tf 0)',
    ['A', 'B', 'S'].map(id => solveAxes(critEs, id).tf), [0, 0, 0]);
}

function lateSideFixture(tasks: string[], relations: string[]): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tLaat-fixture\tC1\t2026-01-14 00:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tX\tP1\tC1\tLANG\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t90\t90\t2026-01-14 08:00\t2026-01-27 17:00\t\t',
    ...tasks,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    ...relations,
    '%E',
  ]);
}
const lateSideOf = (input: ImportResult, id: string) => (({ ls, lf }) => ({ ls, lf }))(solveAxes(input, id));

{
  const input = lateSideFixture([
    '%R\tP\tP1\tC1\tPRED\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-14 08:00\t2026-01-15 17:00\t\t',
    '%R\tD\tP1\tC1\tDONE\tVoltooid fysiek\tTT_Task\tDT_FixedDrtn\tTK_Complete\tCP_Phys\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t2026-01-06 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-16 08:00\t2026-01-16 17:00\t\t',
  ], ['%R\tR0\tD\tP\tP1\tP1\tPR_FS\t0', '%R\tR1\tS\tD\tP1\tP1\tPR_FS\t0']);
  eq('C5 late kant fixture: D staat op het punt van haar voorganger', solveAxes(input, 'D').es, '2026-01-15T17:00');
  eq('C5 late kant fixture: het punt volgt de LS van S', lateSideOf(input, 'D'), { ls: '2026-01-27T08:00', lf: '2026-01-27T08:00' });
  eq('C5 late kant: het punt legt backward-druk op de open voorganger', lateSideOf(input, 'P'),
    { ls: '2026-01-23T08:00', lf: '2026-01-26T17:00' });
  eq('C5 uit ⇒ de open voorganger valt op het projecteinde (voltooide opvolger is historie)',
    lateSideOf(withProfile(input, copy => setConvention(copy, 'p6CompletedPhysicalAtDataDate', false)), 'P'),
    { ls: '2026-01-26T08:00', lf: '2026-01-27T17:00' });
}

{
  const input = lateSideFixture([
    '%R\tA\tP1\tC1\tRUN\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t18\t18\t2026-01-05 08:00\t2026-01-15 17:00\t2026-01-05 08:00\t',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-14 08:00\t2026-01-16 17:00\t\t',
  ], ['%R\tR1\tS\tA\tP1\tP1\tPR_SS\t18']);
  eq('C6 late kant fixture: S op A\'s restwerkstart', solveAxes(input, 'S').es, '2026-01-14T08:00');
  eq('C6 late kant fixture: S op het projecteinde', lateSideOf(input, 'S'), { ls: '2026-01-23T08:00', lf: '2026-01-27T17:00' });
  eq('C6 late kant: verstreken SS-lag telt ook achterwaarts niet', lateSideOf(input, 'A'),
    { ls: '2026-01-23T08:00', lf: '2026-01-26T17:00' });
  eq('C6 uit ⇒ de volle lag, voorwaarts én achterwaarts',
    lateSideOf(withProfile(input, copy => setConvention(copy, 'p6InProgressStartLagElapsed', false)), 'A'),
    { ls: '2026-01-21T08:00', lf: '2026-01-22T17:00' });
  const fs = structuredClone(input);
  fs.sequences[0].type = 'FINISH_START';
  eq('C6 late kant raakt geen FS-relatie', lateSideOf(fs, 'A'),
    lateSideOf(withProfile(fs, copy => setConvention(copy, 'p6InProgressStartLagElapsed', false)), 'A'));
}

{
  const input = lateSideFixture([
    '%R\tA\tP1\tC1\tRUN\tLopend fysiek\tTT_Task\tDT_FixedDrtn\tTK_Active\tCP_Phys\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
  ], ['%R\tR1\tS\tA\tP1\tP1\tPR_SS\t0']);
  input.tasks.find(task => task.id === 'A')!.time.completion = 0.5;
  eq('A19-laat fixture: A is lopend met rest 0', (({ completion, remainingMinutes }) => ({ completion, remainingMinutes }))(input.tasks.find(task => task.id === 'A')!.time), { completion: 0.5, remainingMinutes: 0 });
  eq('A19-laat fixture: S.LS di 27 jan 08:00', lateSideOf(input, 'S').ls, '2026-01-27T08:00');
  eq('A19-laat: lopende taak met rest 0 is achterwaarts een nulduur', lateSideOf(input, 'A'), { ls: '2026-01-27T08:00', lf: '2026-01-27T08:00' });
  eq('A19 uit ⇒ geen effect van deze regel op de late finish',
    lateSideOf(withProfile(input, copy => setConvention(copy, 'p6UseRemainingStartForProgress', false)), 'A').lf, '2026-01-27T17:00');
}

{
  const c7 = groupC.find(fixture => fixture.flag === 'p6FinishFinishStartMilestoneLateFinish')!;
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6FinishFinishStartMilestoneLateFinish', false));
  eq('C7 fixture: Y zet de startmijlpaal op do 8 jan', solveAxes(c7.input, 'M').es, '2026-01-08T08:00');
  eq('C7 laat de startmijlpaal zelf ongemoeid', solveAxes(c7.input, 'M'), solveAxes(off(c7.input), 'M'));
  const finMile = c7Fixture('TT_FinMile');
  eq('C7 fixture: de eindmijlpaal is een FINISH-mijlpaal', finMile.tasks.find(task => task.id === 'M')?.milestoneKind, 'FINISH');
  eq('C7 raakt geen FF-relatie naar een eindmijlpaal (alle assen, alle taken)', solveAllAxes(finMile), solveAllAxes(off(finMile)));
}

{
  const floating = c7Fixture('TT_Mile', false);
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6FinishFinishStartMilestoneLateFinish', false));
  eq('C7 drijvend: M.es blijft wo 7 jan 08:00', solveAxes(floating, 'M').es, '2026-01-07T08:00');
  const early = (input: ImportResult) => Object.fromEntries(['A', 'M', 'Z', 'X'].map(id => {
    const axes = solveAxes(input, id);
    return [id, { es: axes.es, ef: axes.ef }];
  }));
  eq('C7 drijvend: vroege datums van alle taken ongewijzigd', early(floating), early(off(floating)));
  eq('C7 drijvend: de bindende FF blijft driving (ff A = 0)', solveAxes(floating, 'A').ff, solveAxes(off(floating), 'A').ff);
}

{
  const c8 = groupC.find(fixture => fixture.flag === 'p6StartedTaskIgnoresPlannedStartFloor')!;
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6StartedTaskIgnoresPlannedStartFloor', false));
  eq('C8 opvolger volgt het restwerk', solveAxes(c8.input, 'S').es, '2026-01-15T08:00');
  eq('C8 uit ⇒ opvolger ná het geplande venster', solveAxes(off(c8.input), 'S').es, '2026-01-21T08:00');
  const unstarted = c8Fixture(false);
  eq('C8 fixture: niet-gestarte taak staat op de vloer van A16', solveAxes(unstarted, 'T').es, '2026-01-19T08:00');
  eq('C8 raakt geen niet-gestarte taak', solveAllAxes(unstarted), solveAllAxes(off(unstarted)));
}

function c3Variant(actStart: string, actEnd: string, lagHours: number): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC3-variant\tC1\t2026-01-14 17:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    `%R\tC\tP1\tC1\tDONE\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t${actStart}\t${actEnd}\t${actStart}\t${actEnd}`,
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-15 08:00\t2026-01-15 17:00\t\t',
    '%R\tX\tP1\tC1\tLONG\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t180\t180\t2026-01-15 08:00\t2026-02-11 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tC\tP1\tP1\tPR_FS\t${lagHours}`,
    '%E',
  ]);
}
const lateOf = (input: ImportResult, id: string) => {
  const axes = solveAxes(input, id);
  return { ls: axes.ls, lf: axes.lf };
};
{
  const partial = c3Variant('2026-01-05 08:00', '2026-01-05 17:00', 81);
  eq('C3 deels verstreken: alleen de rest-lag (18 u) telt', lateOf(partial, 'C'),
    { ls: '2026-02-09T08:00', lf: '2026-02-06T17:00' });
  eq('C3 deels verstreken, C3 uit: de volle lag (81 u)',
    lateOf(withProfile(partial, copy => setConvention(copy, 'p6CompletedRemainingLag', false)), 'C'),
    { ls: '2026-01-29T08:00', lf: '2026-01-28T17:00' });
  const fresh = c3Variant('2026-01-14 08:00', '2026-01-14 17:00', 45);
  eq('C3 niet verstreken: de volle lag blijft', lateOf(fresh, 'C'), { ls: '2026-02-04T08:00', lf: '2026-02-03T17:00' });
  eq('C3 niet verstreken, C3 uit: identiek',
    lateOf(withProfile(fresh, copy => setConvention(copy, 'p6CompletedRemainingLag', false)), 'C'),
    { ls: '2026-02-04T08:00', lf: '2026-02-03T17:00' });
}
{
  const ss = importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC1-SS\tC1\t2026-01-07 00:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tA\tP1\tC1\tA100\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t7\t0\t2026-01-05 08:00\t2026-01-05 16:00\t2026-01-07 10:00\t2026-01-07 17:00',
    '%R\tB\tP1\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-07 08:00\t2026-01-07 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP1\tP1\tPR_SS\t0',
    '%E',
  ]);
  eq('C1 met SS-opvolger: de start wordt niet begrensd (B.ES = A\'s werkelijke start)',
    solveAxes(ss, 'B').es, '2026-01-07T10:00');
}
{
  const withDone = importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC2-voltooid\tC1\t2026-01-05 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tT\tP1\tC1\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00\t\t',
    '%R\tX\tP1\tC1\tX100\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-01-05 08:00\t2026-01-09 17:00\t\t',
    '%R\tS\tP1\tC1\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-12 08:00\t2026-01-12 17:00\t\t',
    '%R\tK\tP1\tC1\tK100\tAl voltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t2026-01-02 08:00\t2026-01-02 17:00\t2026-01-02 08:00\t2026-01-02 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tT\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tS\tX\tP1\tP1\tPR_FS\t0',
    '%R\tR3\tK\tT\tP1\tP1\tPR_FS\t0',
    '%E',
  ]);
  eq('C2 aan, voltooide opvolger: geen deeltak meer, ff via S = 4 werkdagen', solveAxes(withDone, 'T').ff, 4);
  eq('C2 uit: de voltooide opvolger telt niet, ff via S = 4 werkdagen',
    solveAxes(withProfile(withDone, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', false)), 'T').ff, 4);
}

{
  const c2Variant = (tRow: string, lagHours: number, statusDate: string) => importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC5\tVijfdaags\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    `%R\tC4\tVierdaags\tP1\tCA_Project\t9\t36\t${calendarDataOn([2, 3, 4, 5], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    `%R\tP1\tC2-grens\tC5\t${statusDate}\t2026-01-05 08:00\t2026-01-30 17:00`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    tRow,
    '%R\tS\tP1\tC4\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-12 08:00\t2026-01-12 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tT\tP1\tP1\tPR_FS\t${lagHours}`,
    '%E',
  ]);
  const ffOf = (input: ImportResult, on: boolean, a12 = true) =>
    solveAxes(withProfile(input, copy => {
      setConvention(copy, 'p6FreeFloatOnOwnCalendar', on);
      setConvention(copy, 'preserveActualDatesInBackwardPass', a12);
    }), 'T').ff;
  const done = c2Variant(
    '%R\tT\tP1\tC5\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t36\t0\t2026-01-05 08:00\t2026-01-08 17:00\t2026-01-05 08:00\t2026-01-08 17:00',
    0, '2026-01-08 17:00');
  eq('C2 geldt niet voor een voltooide taak (A12 uit): ff met C2 = ff zonder C2', ffOf(done, true, false), ffOf(done, false, false));
  const lagged = c2Variant(
    '%R\tT\tP1\tC5\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t36\t36\t2026-01-05 08:00\t2026-01-08 17:00\t\t',
    4, '2026-01-05 08:00');
  eq('C2 verbreed, FS+4 u: ff = vr 12:00–17:00 op de eigen kalender = 5/9 dag', ffOf(lagged, true), 300 / 540);
  eq('C2 uit, FS+4 u: ff op de kalender van S = 0', ffOf(lagged, false), 0);
}

{
  const hotel = (rows: { t: string; s: string; x?: string; rel: string; xrel?: string; sCal?: string; lagCal?: string }) => importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tK17\tTot vijf\tP1\tCA_Project\t9\t63\t${calendarDataOn([1, 2, 3, 4, 5, 6, 7], [['08:00', '17:00']])}`,
    `%R\tK16\tTot vier\tP1\tCA_Project\t8\t56\t${calendarDataOn([1, 2, 3, 4, 5, 6, 7], [['08:00', '16:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC2-breed\tK17\t2026-01-05 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    ...(rows.lagCal ? ['%T\tSCHEDOPTIONS', '%F\tproj_id\tsched_calendar_on_relationship_lag', `%R\tP1\t${rows.lagCal}`] : []),
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    `%R\tT\tP1\tK17\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t${rows.t}`,
    `%R\tS\tP1\t${rows.sCal ?? 'K16'}\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t${rows.s}`,
    ...(rows.x ? [`%R\tX\tP1\tK16\tX100\tDrijver\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t${rows.x}`] : []),
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tT\tP1\tP1\t${rows.rel}`,
    ...(rows.xrel ? [`%R\tR2\tS\tX\tP1\tP1\t${rows.xrel}`] : []),
    '%E',
  ]);
  const ffWith = (input: ImportResult, on: boolean) =>
    solveAxes(withProfile(input, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', on)), 'T').ff;

  const ssLag = hotel({ t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '8\t8\t2026-01-06 08:00\t2026-01-06 16:00', rel: 'PR_SS\t8' });
  eq('C2 verbreed, SS+8 u: ff = ma 16:00–17:00 op de eigen kalender = 60 min', ffWith(ssLag, true), 60 / 540);
  eq('C2 uit, SS+8 u: ff op de opvolgerkalender = 0', ffWith(ssLag, false), 0);

  const ffLag = hotel({
    t: '34\t34\t2026-01-05 08:00\t2026-01-08 15:00', s: '4\t4\t2026-01-09 08:00\t2026-01-09 12:00',
    x: '32\t32\t2026-01-05 08:00\t2026-01-08 16:00', rel: 'PR_FF\t1', xrel: 'PR_FS\t0',
  });
  eq('FF+1 u-fixture: S loopt vr 9 jan 08:00–12:00', [solveAxes(ffLag, 'S').es, solveAxes(ffLag, 'S').ef], ['2026-01-09T08:00', '2026-01-09T12:00']);
  eq('C2 verbreed, FF+1 u: ff = do 16:00 → vr 12:00 op de eigen kalender = 5/9 dag', ffWith(ffLag, true), 300 / 540);
  eq('C2 uit, FF+1 u: ff op de opvolgerkalender = 0,5 dag', ffWith(ffLag, false), 0.5);

  const sameCal = hotel({ t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '8\t8\t2026-01-05 16:00\t2026-01-06 15:00', rel: 'PR_SS\t8', sCal: 'K17' });
  eq('C2 verbreed, zelfde kalender: ff met C2 = ff zonder C2 = 0', [ffWith(sameCal, true), ffWith(sameCal, false)], [0, 0]);

  const elapsed = withProfile(ssLag, copy => { for (const q of copy.sequences) q.lagUnit = 'ELAPSEDTIME'; });
  eq('C2 niet bij een ELAPSEDTIME-lag: ff met C2 = ff zonder C2', ffWith(elapsed, true), ffWith(elapsed, false));
  const percent = withProfile(ssLag, copy => { for (const q of copy.sequences) { q.lagPercent = 25; q.lagMinutes = undefined; q.lagDays = 0; } });
  eq('C2 niet bij een procentlag: ff met C2 = ff zonder C2', ffWith(percent, true), ffWith(percent, false));
  const succLagCal = hotel({ t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '8\t8\t2026-01-06 08:00\t2026-01-06 16:00', rel: 'PR_SS\t8', lagCal: 'rcal_Successor' });
  eq('lagkalender = opvolger zit in de fixture', solveOptionsFor(succLagCal.project).schedulingOptions.lagCalendar, 'successor');
  eq('C2 niet bij een lag op de opvolgerkalender: ff met C2 = ff zonder C2', ffWith(succLagCal, true), ffWith(succLagCal, false));

  const lag0SuccCal = hotel({ t: '35.5\t35.5\t2026-01-05 08:00\t2026-01-08 16:30', s: '8\t8\t2026-01-09 08:00\t2026-01-09 16:00', rel: 'PR_FS\t0', lagCal: 'rcal_Successor' });
  eq('lag 0 onder rcal_Successor: C2 geldt, ff = 30 min op de eigen kalender', [ffWith(lag0SuccCal, true), ffWith(lag0SuccCal, false)], [30 / 540, 0]);
  const ssLagDays = withProfile(ssLag, copy => { for (const q of copy.sequences) { q.lagMinutes = undefined; q.lagDays = 8 / 9; } });
  eq('C2 verbreed, SS-lag via lagDays (8/9 dag): ff = 60 min op de eigen kalender', ffWith(ssLagDays, true), 60 / 540);
  const negLag = hotel({ t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '8\t8\t2026-01-09 08:00\t2026-01-09 16:00', rel: 'PR_FS\t-1' });
  eq('C2 verbreed, FS −1 u (extrapolatie): ff = do 16:00–17:00 op de eigen kalender = 60 min', ffWith(negLag, true), 60 / 540);
  const sfLag = hotel({
    t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '1\t1\t2026-01-06 09:00\t2026-01-06 10:00',
    x: '9\t9\t2026-01-05 08:00\t2026-01-06 09:00', rel: 'PR_SF\t8', xrel: 'PR_FS\t0',
  });
  eq('SF-fixture: S loopt di 6 jan 09:00–10:00', [solveAxes(sfLag, 'S').es, solveAxes(sfLag, 'S').ef], ['2026-01-06T09:00', '2026-01-06T10:00']);
  eq('C2 niet bij SF: ff met C2 = ff zonder C2 ≠ 1/3 dag (eigen-kalenderformule)', [ffWith(sfLag, true) === ffWith(sfLag, false), ffWith(sfLag, true) === 3 / 9], [true, false]);
}

{
  const started = (lagHours: number) => importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC5\tVijfdaags\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    `%R\tC4\tVierdaags\tP1\tCA_Project\t9\t36\t${calendarDataOn([2, 3, 4, 5], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC2-gestart\tC5\t2026-01-06 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tT\tP1\tC5\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t36\t27\t2026-01-05 08:00\t2026-01-08 17:00\t2026-01-05 08:00\t',
    '%R\tS\tP1\tC4\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-12 08:00\t2026-01-12 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tT\tP1\tP1\tPR_FS\t${lagHours}`,
    '%E',
  ]);
  const ffS = (input: ImportResult, on: boolean) =>
    solveAxes(withProfile(input, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', on)), 'T').ff;
  eq('gestarte taak, FS0: oude C2 blijft, ff = vr 9 jan op de eigen kalender = 1 dag', [ffS(started(0), true), ffS(started(0), false)], [1, 0]);
  eq('gestarte taak, FS+4 u: buiten de verbreding, ff met C2 = ff zonder C2', ffS(started(4), true), ffS(started(4), false));
}

{
  const pool = [...new Map(FIXTURE_POOL.map(lines => [lines.join('\n'), lines])).values()];
  const header = ['ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tRequires\tC1\t2026-01-05 08:00\t2026-01-05 08:00\t2026-02-27 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tcstr_type\tcstr_date'];
  const relations = (...rows: string[]) => ['%T\tTASKPRED', '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt', ...rows, '%E'];
  const pre = '%R\tT1\tP1\tC1\tT1\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00\t\t';
  pool.push([...header, pre, '%R\tM1\tP1\tC1\tM1\tMijlpaal\tTT_Mile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-05 17:00\t2026-01-05 17:00\t\t',
    ...relations('%R\tR1\tM1\tT1\tP1\tP1\tPR_FS\t0')]);
  pool.push([...header, pre, '%R\tM1\tP1\tC1\tM1\tEinde\tTT_FinMile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-06 08:00\t2026-01-05 17:00\t\t',
    ...relations('%R\tR1\tM1\tT1\tP1\tP1\tPR_FS\t0')]);
  pool.push([...header, pre, '%R\tT3\tP1\tC1\tT3\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-01-05 08:00\t2026-01-09 17:00\t\t',
    '%R\tM1\tP1\tC1\tM1\tUiterlijk\tTT_FinMile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-05 17:00\t2026-01-05 17:00\tCS_MEOB\t2026-01-07 08:00',
    ...relations('%R\tR1\tM1\tT1\tP1\tP1\tPR_FS\t0')]);

  pool.push([...header,
    '%R\tM1\tP1\tC1\tM1\tLosse mijlpaal\tTT_Mile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-05 08:00\t2026-01-05 08:00\t\t',
    ...relations()]);

  const readPlain = (lines: string[]): ImportResult => {
    const opened = readXER(new TextEncoder().encode(lines.join('\n')));
    if (isMultiDocumentImport(opened)) throw new Error('pool: één project verwacht');
    return opened;
  };
  const withoutHourPlanning = (input: ImportResult): ImportResult => {
    const copy = structuredClone(input);
    for (const cal of [copy.calendar, ...(copy.resourceCalendars ?? [])]) delete (cal as { workTime?: unknown }).workTime;
    const hpd = copy.calendar.hoursPerDay || 8;
    for (const task of copy.tasks) {
      const time = task.time as Task['time'] & { durationUnit?: 'days' | 'hours' };
      if (time.remainingMinutes != null) time.remainingTime = time.remainingMinutes / (hpd * 60);
      delete time.remainingMinutes;
      delete time.durationMinutes;
      time.durationUnit = 'days';
    }
    for (const seq of copy.sequences) delete seq.p6StartAtPredecessorFinishBoundary;
    if (copy.project.schedulingOptions?.lagCalendar === '24hour') copy.project.schedulingOptions = { ...copy.project.schedulingOptions, lagCalendar: undefined };
    return copy;
  };
  const withoutProvenance = (input: ImportResult): ImportResult => {
    const copy = structuredClone(input);
    for (const task of copy.tasks) for (const key of Object.keys(task)) if (/^(p6|xer)[A-Z]/.test(key)) delete (task as unknown as Record<string, unknown>)[key];
    for (const seq of copy.sequences) for (const key of Object.keys(seq)) if (/^p6[A-Z]/.test(key)) delete (seq as unknown as Record<string, unknown>)[key];
    return copy;
  };
  const fingerprint = (input: ImportResult): string => {
    try { return JSON.stringify(solveAllAxes(input)); } catch (error) { return `fout: ${(error as Error).message}`; }
  };
  const toggles = (input: ImportResult, key: ConventionKey, workdays = false): boolean => {
    for (const progressMode of [input.project.progressMode, 'PROGRESS_OVERRIDE' as const]) {
      const moded = structuredClone(input);
      moded.project.progressMode = progressMode;
      for (const baseId of ['p6', 'ops'] as const) {
        const values = resolveConventions({ baseId, id: baseId, name: '', overrides: {} });
        if (baseId === 'p6') for (const k of P6_OFF_GROUP_B) values[k] = true;
        if (workdays) values.workdayDurationMeasure = true;
        if (fingerprint(withConventions(moded, baseId, { ...values, [key]: true }))
          !== fingerprint(withConventions(moded, baseId, { ...values, [key]: false }))) return true;
      }
    }
    return false;
  };
  const variants = pool.map(lines => {
    const orig = readPlain(lines);
    return { orig, day: withoutHourPlanning(orig), plain: withoutProvenance(orig) };
  });
  const NO_DAY_TRIGGER: Partial<Record<ConventionKey, string>> = {};
  const NO_PLAIN_TRIGGER: Partial<Record<ConventionKey, string>> = {
    workdayDurationMeasure: 'de XER-pool heeft geen taak of lag in dagen; de dag-variant toont het effect',
  };
  const count = (key: ConventionKey, pick: (v: typeof variants[number]) => ImportResult, workdays = false) =>
    variants.filter(v => toggles(pick(v), key, workdays)).length;
  for (const d of CONVENTIONS) {
    const orig = count(d.id, v => v.orig);
    const day = count(d.id, v => v.day, true);
    const plain = count(d.id, v => v.plain);
    if (process.env.OPS_REQUIRES_MATRIX) console.log(d.id.padEnd(45), 'orig', orig, 'dag', day, 'zonderHerkomst', plain, JSON.stringify(d.requires ?? {}));
    if (d.requires?.hourPlanning) {
      eq(`requires ${d.id}: alleen uurplanning ⇒ geen verschil zonder uurplanning (fixtures met verschil)`, day, 0);
      eq(`requires ${d.id}: alleen uurplanning ⇒ wel een fixture met verschil`, orig > 0, true);
    } else {
      eq(`requires ${d.id}: zonder label ⇒ verschil zonder uurplanning (of NO_DAY_TRIGGER)`, day > 0 || d.id in NO_DAY_TRIGGER, true);
      if (d.id in NO_DAY_TRIGGER) eq(`requires ${d.id}: NO_DAY_TRIGGER nog nodig`, day, 0);
    }
    if (d.requires?.xerOrigin) {
      eq(`requires ${d.id}: alleen .xer ⇒ geen verschil zonder P6-herkomst (fixtures met verschil)`, plain, 0);
      eq(`requires ${d.id}: alleen .xer ⇒ wel een fixture met verschil`, orig > 0, true);
    } else {
      eq(`requires ${d.id}: zonder label ⇒ verschil zonder P6-herkomst (of NO_PLAIN_TRIGGER)`, plain > 0 || d.id in NO_PLAIN_TRIGGER, true);
      if (d.id in NO_PLAIN_TRIGGER) eq(`requires ${d.id}: NO_PLAIN_TRIGGER nog nodig`, plain, 0);
    }
  }
  const xerReaderSource = readFileSync(join(fileURLToPath(new URL('../../src/services/xer/xerReader.ts', import.meta.url))), 'utf8');
  eq('requires B1: de XER-lezer zet de relatievlag alleen bij predecessorCalendar.isHourMode',
    /const p6StartAtPredecessorFinishBoundary = [^;]*predecessorCalendar\.isHourMode/.test(xerReaderSource), true);
}

if (diffs.length > 0) {
  console.error(`conventions-p6-flags RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`OK  conventions-p6-flags: ${checks} checks groen (5 groep-B- en ${GROUP_C.length} groep-C-conventies, aan/uit + bron- en basisinertheid)`);
