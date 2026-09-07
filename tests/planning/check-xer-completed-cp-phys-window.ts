import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import { parseInstant } from '@/utils/dateUtils';
import { scanXerGroundTruth } from './xerGroundTruth';
import {
  explainP6CompletedDataDateWindow,
  type P6CompletedWindowReason,
} from '@/utils/p6CompletedTargetWindow';
import type { Task } from '@/types/task';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

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

const baselinePhysical = solveFixture();
eq('CP_Phys bewaart de bronvorm maar opent zonder discriminator geen completed-windowroute',
  baselinePhysical.decision, { eligible: false, reason: 'wrongCompletePctType' });
eq('CP_Phys zonder route schrijft geen completed-display als projecteinde in de backward pass',
  baselinePhysical.trace?.projectEndSource, 'maxEarlyFinish');
eq('CP_Phys zonder route behoudt een niet-invers vroeg venster',
  !!baselinePhysical.scheduled
    && baselinePhysical.scheduled.earlyStart <= baselinePhysical.scheduled.earlyFinish, true);

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
    label: 'onparseerbare actualFinish blijft zonder suspend/resume fail-closed',
    mutate: (_imported, task) => { task.time.actualFinish = 'geen-datum'; },
    reason: 'notCompleted',
  },
  {
    label: 'actualFinish ná de statusdatum blijft zonder suspend/resume fail-closed',
    mutate: (_imported, task) => { task.time.actualFinish = '2026-08-17T10:01'; },
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
eq('CP_Phys: actualFinish precies op de statusdatum is syntactisch en temporeel geldig, maar de route blijft gesloten',
  decisionOf((_imported, task) => { task.time.actualFinish = '2026-08-17T10:00'; }).decision,
  { eligible: false, reason: 'wrongCompletePctType' });

function listXerFiles(root: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...listXerFiles(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xer')) paths.push(path);
  }
  return paths.sort();
}

function canonicalMinute(value: string | undefined): string | null {
  if (!value) return null;
  return value.length === 10 ? `${value}T00:00` : value.slice(0, 16);
}

/**
 * Corpusbewijs voor de CP_Phys-grens. De tien bronvormen die de eerdere kandidaat toeliet zijn
 * in P6 niet uniform: acht hebben een gelijk vroeg statuspunt, twee hebben geen early/late-orakel.
 * Zonder een toegestane broninvoer die dat onderscheid maakt blijft de route dus gesloten. De
 * werkelijke productpopulatie is nul en kan geen nieuwe early/late-kalenderinversie veroorzaken.
 */
const corpusRoot = process.env.OPS_XER_CORPUS;
if (!corpusRoot) {
  console.log('OK  XER CP_Phys corpusinversie: corpus niet aanwezig (OPS_XER_CORPUS) — overgeslagen');
} else if (!existsSync(corpusRoot)) {
  diffs.push('XER CP_Phys corpusinversie: OPS_XER_CORPUS wijst niet naar een bestaande corpusmap');
} else {
  const sourceForms: Array<{
    file: string;
    projectId: string;
    taskId: string;
    taskCode: string;
    truth: [string | null, string | null, string | null, string | null];
  }> = [];
  const activeProductCases: Array<{
    file: string;
    projectId: string;
    taskId: string;
    product: [string | null, string | null, string | null, string | null];
    truth: [string | null, string | null, string | null, string |null];
  }> = [];
  for (const path of listXerFiles(corpusRoot)) {
    const bytes = readFileSync(path);
    const truth = scanXerGroundTruth(bytes);
    if (truth.errors.length > 0) continue;
    const truthByTask = new Map(truth.tasks.map(task => [`${task.projectId}\u0000${task.taskId}`, task] as const));
    // De brede crawl bevat bewust corrupte parserfixtures. Zij dragen geen CP_Phys-orakel en
    // horen bij de reader-foutpadbatterij, niet bij deze productinvariantselectie.
    let opened: ImportResult | ReturnType<typeof readXER>;
    try {
      opened = readXER(bytes);
    } catch {
      continue;
    }
    const imports = isMultiDocumentImport(opened) ? opened.taskProjects.map(project => project.result) : [opened];
    for (const imported of imports) {
      const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
      const physical = imported.tasks.filter(task => task.p6CompletePctType === 'CP_Phys');
      const sourceForm = physical.filter(task => {
        if (task.time.completion < 1 || !task.time.actualFinish) return false;
        const asDuration = structuredClone(task);
        asDuration.p6CompletePctType = 'CP_Drtn';
        return explainP6CompletedDataDateWindow(asDuration, dataDate, imported.project.schedulingOptions).eligible;
      });
      const sourceFormIds = new Set(sourceForm.map(task => task.id));
      const eligible = physical.filter(task =>
        explainP6CompletedDataDateWindow(task, dataDate, imported.project.schedulingOptions).eligible,
      );
      if (sourceForm.length === 0 && eligible.length === 0) continue;
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
      if (result.error) throw new Error(`CP_Phys-corpussolve ${path}/${imported.project.id}: ${result.error}`);
      for (const task of sourceForm) {
        const oracle = truthByTask.get(`${imported.project.id}\u0000${task.id}`);
        if (!oracle) {
          diffs.push(`CP_Phys-corpus: ontbrekende orakel-taak ${relative(corpusRoot, path)}/${imported.project.id}/${task.id}`);
          continue;
        }
        sourceForms.push({
          file: relative(corpusRoot, path).split('\\').join('/'),
          projectId: imported.project.id,
          taskId: task.id,
          taskCode: task.wbsCode,
          truth: [oracle.axes.es as string | null, oracle.axes.ef as string | null,
            oracle.axes.ls as string | null, oracle.axes.lf as string | null],
        });
      }
      for (const task of eligible) {
        if (!sourceFormIds.has(task.id)) continue;
        const oracle = truthByTask.get(`${imported.project.id}\u0000${task.id}`);
        const product = result.tasks.get(task.id);
        if (!oracle || !product) {
          diffs.push(`CP_Phys-corpus: ontbrekende product/orakel-taak ${relative(corpusRoot, path)}/${imported.project.id}/${task.id}`);
          continue;
        }
        activeProductCases.push({
          file: relative(corpusRoot, path).split('\\').join('/'), projectId: imported.project.id, taskId: task.id,
          product: [canonicalMinute(product.earlyStart), canonicalMinute(product.earlyFinish), canonicalMinute(product.lateStart), canonicalMinute(product.lateFinish)],
          truth: [oracle.axes.es as string | null, oracle.axes.ef as string | null, oracle.axes.ls as string | null, oracle.axes.lf as string | null],
        });
      }
    }
  }
  eq('CP_Phys corpus: exact tien eerdere kandidaatvormen zijn onderzocht', sourceForms.length, 10);
  eq('CP_Phys corpus: acht kandidaatvormen hebben een gelijk P6 vroeg statuspunt',
    sourceForms.filter(item => item.truth[0] !== null && item.truth[0] === item.truth[1]).length, 8);
  eq('CP_Phys corpus: twee kandidaatvormen hebben geen P6 early/late-orakel',
    sourceForms.filter(item => item.truth[0] === null && item.truth[1] === null
      && item.truth[2] === null && item.truth[3] === null).length, 2);
  eq('CP_Phys corpus: de werkelijk geactiveerde productpopulatie blijft fail-closed', activeProductCases.length, 0);
  for (const item of activeProductCases) {
    const [productEs, productEf, productLs, productLf] = item.product;
    const [truthEs, truthEf, truthLs, truthLf] = item.truth;
    eq(`CP_Phys corpus ${item.file}/${item.projectId}/${item.taskId}: product ES<=EF`, productEs !== null && productEf !== null && productEs <= productEf, true);
    eq(`CP_Phys corpus ${item.file}/${item.projectId}/${item.taskId}: product LS<=LF`, productLs !== null && productLf !== null && productLs <= productLf, true);
    if (truthEs === null || truthEf === null || truthLs === null || truthLf === null) {
      diffs.push(`CP_Phys corpus ${item.file}/${item.projectId}/${item.taskId}: route mag niet openen zonder volledig P6 early/late-orakel`);
      continue;
    }
    eq(`CP_Phys corpus ${item.file}/${item.projectId}/${item.taskId}: P6 ES<=EF`, truthEs <= truthEf, true);
    eq(`CP_Phys corpus ${item.file}/${item.projectId}/${item.taskId}: P6 LS<=LF`, truthLs <= truthLf, true);
  }
}

if (diffs.length > 0) {
  console.error(`XER completed CP_Phys window RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER completed CP_Phys window GREEN: ${checks} checks groen`);
