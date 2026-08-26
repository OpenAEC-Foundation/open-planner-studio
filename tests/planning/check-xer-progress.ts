import { solveProject } from '@/engine/scheduler/solveProject';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

function read(lines: readonly string[]): XerReadResult {
  const result = readXER(bytes(lines));
  if (isMultiDocumentImport(result)) throw new Error('De enkelprojectfixture gaf meerdere documenten terug');
  return result;
}

const header = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tVoortgang\tC1\t2026-08-10 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date\texpect_end_date',
] as const;

const progress = read([
  ...header,
  // CP_Drtn: 25% van 8 uur laat exact 6 uur over; de tegenstrijdige bronrestduur is expres 1 uur.
  '%R\tD\tP1\tC1\tD\tDuur\tTT_Task\tTK_Active\tCP_Drtn\t25\t90\t8\t1\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t\t\t',
  // CP_Phys/CP_Units bewaren het percentage, maar hun expliciete restduur is de solverinvoer.
  '%R\tP\tP1\tC1\tP\tFysiek\tTT_Task\tTK_Active\tCP_Phys\t10\t75\t8\t6\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t\t\t',
  '%R\tU\tP1\tC1\tU\tEenheden\tTT_Task\tTK_Active\tCP_Units\t50\t10\t8\t2\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t\t\t',
  // Alleen het volledige, chronologische paar mag de P6-solverroute openen.
  '%R\tSR\tP1\tC1\tSR\tStop en hervat\tTT_Task\tTK_Active\tCP_Drtn\t25\t25\t8\t6\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t2026-08-04 16:00\t2026-08-06 08:00\t2026-08-12 16:00',
  '%R\tS\tP1\tC1\tS\tAlleen stop\tTT_Task\tTK_Active\tCP_Drtn\t25\t25\t8\t6\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t2026-08-04 16:00\t\t',
  '%R\tR\tP1\tC1\tR\tAlleen hervat\tTT_Task\tTK_Active\tCP_Drtn\t25\t25\t8\t6\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t\t2026-08-06 08:00\t',
  '%R\tW\tP1\tC1\tW\tVerkeerde volgorde\tTT_Task\tTK_Active\tCP_Drtn\t25\t25\t8\t6\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t2026-08-08 16:00\t2026-08-06 08:00\t',
  '%E',
]);

const byId = new Map(progress.tasks.map(task => [task.id, task]));
eq('X7-1 complete_pct_type bewaart de onafhankelijke P6-voortgangsbron en identiteiten',
  ['D', 'P', 'U'].map(id => {
    const task = byId.get(id)!;
    return [task.p6ProjectId, task.p6TaskId, task.p6CompletePctType, task.time.completion, task.time.remainingMinutes];
  }), [
    ['P1', 'D', 'CP_Drtn', 0.25, 360],
    ['P1', 'P', 'CP_Phys', 0.75, 360],
    ['P1', 'U', 'CP_Units', 0.5, 120],
  ]);
eq('X7-2 suspend/resume is universele brondata, maar uitsluitend een geldig P6-paar opent de bronvlag',
  ['SR', 'S', 'R', 'W'].map(id => {
    const task = byId.get(id)!;
    return [task.time.stop, task.time.resume, task.p6SuspendResume];
  }), [
    ['2026-08-04T16:00', '2026-08-06T08:00', true],
    ['2026-08-04T16:00', undefined, undefined],
    [undefined, '2026-08-06T08:00', undefined],
    ['2026-08-08T16:00', '2026-08-06T08:00', undefined],
  ]);
eq('X7-3 expect_end_date blijft opgeslagen, onafhankelijk van de X5-projectvlag',
  [byId.get('SR')?.p6ExpectedFinish, progress.project.schedulingOptions?.useExpectedFinishDates],
  ['2026-08-12T16:00', true]);

function solved(expectFlag: boolean): string | undefined {
  const imported = read([
    ...header,
    '%R\tA\tP1\tC1\tA\tVerwacht einde\tTT_Task\tTK_Active\tCP_Phys\t10\t75\t8\t2\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t\t\t2026-08-12 16:00',
    '%E',
  ]);
  imported.project.schedulingOptions = { useExpectedFinishDates: expectFlag };
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: [imported.calendar, ...(imported.resourceCalendars ?? [])],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate,
  });
  return result.tasks.get('A')?.earlyFinish;
}
eq('X7-4 expect_end_date stuurt uitsluitend met de expliciete X5-vlag',
  [solved(false), solved(true)], ['2026-08-10T10:00', '2026-08-12T16:00']);

const multi = readXER(bytes([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\tP1\tEen',
  '%R\tP2\tTwee',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tGELIJK\tP1\tP1\tP1-taak\tCP_Drtn\t25\t25\t8\t6\t2026-08-03\t2026-08-03',
  '%R\tGELIJK\tP2\tP2\tP2-taak\tCP_Phys\t10\t75\t8\t2\t2026-08-03\t2026-08-03',
  '%E',
]));
if (!isMultiDocumentImport(multi)) {
  diffs.push('X7-5 projectfilter-fixture gaf geen meervoudige import terug');
} else {
  eq('X7-5 file-wide index is lineair maar lekt geen gelijke task_id tussen projecten',
    multi.documents.map(document => document.result.tasks.filter(task => !task.isSummary).map(task => [
      task.p6ProjectId, task.p6TaskId, task.name, task.p6CompletePctType, task.time.remainingTime,
    ])), [
      [['P1', 'GELIJK', 'P1-taak', 'CP_Drtn', 0.75]],
      [['P2', 'GELIJK', 'P2-taak', 'CP_Phys', 0.25]],
    ]);
}

if (diffs.length > 0) {
  console.error(`XER-X7-voortgang: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-X7-voortgang: ${checks} parser-/solverfirewallchecks groen`);
