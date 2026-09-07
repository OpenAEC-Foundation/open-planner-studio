import { solveProject } from '@/engine/scheduler/solveProject';
import { explainCompletedXerLoeActualFinishEligibility } from '@/engine/scheduler/p6CompletedRouteTrace';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const workWeek = '(0||CalendarData()(    (0||DaysOfWeek()(      (0||1()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||2()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||3()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||4()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||5()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||6()())      (0||7()())))    (0||Exceptions()())))';

function fixtureBytes(): Uint8Array {
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${workWeek}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tCompleted LOE guard\tC1\t2026-06-30 17:00\t2026-01-05 08:00\t2026-06-30 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date',
    '%R\tP\tP1\tC1\tPRED\tSS voorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-01-05 08:00\t2026-01-05 17:00\t\t\t\t',
    '%R\tL\tP1\tC1\tLOE\tLange voltooide LOE\tTT_LOE\tDT_FixedDrtn\tTK_Complete\tCP_Drtn\t352\t0\t2026-01-05 08:00\t2026-03-06 17:00\t2026-01-05 08:00\t2026-03-06 17:00\t\t',
    '%R\tO\tP1\tC1\tOPEN\tOpen opvolger\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-03-09 08:00\t2026-03-09 17:00\t\t\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR-SS\tL\tP\tP1\tP1\tPR_SS\t0',
    '%E',
  ].join('\n'));
}

function importedFixture(): ImportResult {
  const opened = readXER(fixtureBytes());
  if (isMultiDocumentImport(opened)) throw new Error('completed LOE-fixture moet één project openen');
  return opened;
}

function task(imported: ImportResult): Task {
  const found = imported.tasks.find(candidate => candidate.id === 'L');
  if (!found) throw new Error('completed LOE-fixture mist taak L');
  return found;
}

function projection(mutate?: (imported: ImportResult, loe: Task) => void) {
  const imported = structuredClone(importedFixture());
  const loe = task(imported);
  mutate?.(imported, loe);
  const incoming = imported.sequences.filter(sequence => sequence.successorId === loe.id);
  const outgoing = imported.sequences.filter(sequence => sequence.predecessorId === loe.id);
  const decision = explainCompletedXerLoeActualFinishEligibility(
    loe,
    imported.project.statusDate ? parseInstant(imported.project.statusDate) : null,
    imported.project.schedulingOptions,
    incoming,
    outgoing,
  );
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
  const solved = result.tasks.get(loe.id);
  if (!solved) throw new Error('solver mist completed LOE');
  return {
    decision,
    schedule: {
      es: solved.earlyStart,
      ef: solved.earlyFinish,
      ls: solved.lateStart,
      lf: solved.lateFinish,
      tf: solved.totalFloat,
      ff: solved.freeFloat,
      earlyOrder: parseInstant(solved.earlyStart).getTime() <= parseInstant(solved.earlyFinish).getTime(),
      lateOrder: parseInstant(solved.lateStart).getTime() <= parseInstant(solved.lateFinish).getTime(),
    },
  };
}

/**
 * Een onparseerbare targetdatum moet door de smalle guard worden afgewezen vóór de solver die
 * terecht geen planning van corrupte invoer kan maken. Dit toetst dus de fail-closed grens zelf,
 * zonder een verzonnen hammock-uitkomst voor onplanbare invoer te verwachten.
 */
function decisionOnly(mutate: (imported: ImportResult, loe: Task) => void) {
  const imported = structuredClone(importedFixture());
  const loe = task(imported);
  mutate(imported, loe);
  return explainCompletedXerLoeActualFinishEligibility(
    loe,
    imported.project.statusDate ? parseInstant(imported.project.statusDate) : null,
    imported.project.schedulingOptions,
    imported.sequences.filter(sequence => sequence.successorId === loe.id),
    imported.sequences.filter(sequence => sequence.predecessorId === loe.id),
  );
}

const importedSource = importedFixture();
const importedLoe = task(importedSource);
eq('completed XER LOE: reader levert alle vereiste XER-provenance en vlaggen', {
  source: importedSource.project.schedulingOptions?.p6Source,
  remainingStart: importedSource.project.schedulingOptions?.p6UseRemainingStartForProgress,
  preserveBackward: importedSource.project.schedulingOptions?.preserveActualDatesInBackwardPass,
  preserveInstants: importedSource.project.schedulingOptions?.p6PreserveActualInstants,
  projectId: importedLoe.p6ProjectId,
  taskId: importedLoe.p6TaskId,
}, {
  source: 'XER', remainingStart: true, preserveBackward: true, preserveInstants: true,
  projectId: 'P1', taskId: 'L',
});

eq('completed XER LOE: uitsluitend de bewezen Harbour-vorm verlaat de hammock-forwardtak', projection(), {
  decision: { eligible: true, reason: 'eligible' },
  schedule: {
    es: '2026-01-05T08:00', ef: '2026-03-06T17:00',
    ls: '2026-01-05T08:00', lf: '2026-03-06T17:00',
    tf: 0, ff: 0, earlyOrder: true, lateOrder: true,
  },
});

eq('completed XER LOE: meerdere inkomende SS-relaties blijven binnen de expliciete Harbour-topologie',
  projection(imported => {
    imported.sequences.push({ ...imported.sequences[0]!, id: 'R-SS-2' });
  }), {
    decision: { eligible: true, reason: 'eligible' },
    schedule: {
      es: '2026-01-05T08:00', ef: '2026-03-06T17:00',
      ls: '2026-01-05T08:00', lf: '2026-03-06T17:00',
      tf: 0, ff: 0, earlyOrder: true, lateOrder: true,
    },
  });

eq('completed XER LOE: actualFinish precies op dataDate blijft een geldige bovengrens',
  decisionOnly((_imported, loe) => { loe.time.actualFinish = '2026-06-30T17:00'; }),
  { eligible: true, reason: 'eligible' });

const hammockAtDataDate = {
  es: '2026-07-01T08:00', ef: '2026-07-01T08:00',
  ls: '2026-07-01T08:00', lf: '2026-07-01T08:00',
  tf: 0, ff: 0, earlyOrder: true, lateOrder: true,
};
const hammockAtTargetStart = {
  es: '2026-01-05T08:00', ef: '2026-01-05T08:00',
  ls: '2026-01-05T08:00', lf: '2026-01-05T08:00',
  tf: 0, ff: 0, earlyOrder: true, lateOrder: true,
};
const hammockAfterPredecessorFinish = {
  es: '2026-07-02T08:00', ef: '2026-07-02T08:00',
  ls: '2026-07-02T08:00', lf: '2026-07-02T08:00',
  tf: 0, ff: 0, earlyOrder: true, lateOrder: true,
};

const rejections: Array<{
  label: string;
  mutate: (imported: ImportResult, loe: Task) => void;
  reason: string;
  schedule?: typeof hammockAtDataDate;
  skipSolver?: true;
}> = [
  { label: 'andere bron', mutate: imported => { imported.project.schedulingOptions = { ...imported.project.schedulingOptions, p6Source: undefined }; }, reason: 'notXerSource' },
  { label: 'ontbrekende projectprovenance', mutate: (_imported, loe) => { loe.p6ProjectId = undefined; }, reason: 'missingProjectProvenance' },
  { label: 'lege projectprovenance', mutate: (_imported, loe) => { loe.p6ProjectId = ''; }, reason: 'missingProjectProvenance' },
  { label: 'ontbrekende taakprovenance', mutate: (_imported, loe) => { loe.p6TaskId = undefined; }, reason: 'missingTaskProvenance' },
  { label: 'lege taakprovenance', mutate: (_imported, loe) => { loe.p6TaskId = ''; }, reason: 'missingTaskProvenance' },
  { label: 'TT_Task', mutate: (_imported, loe) => { loe.p6ActivityType = 'TT_Task'; loe.isHammock = true; }, reason: 'wrongActivityType' },
  { label: 'CP_Phys', mutate: (_imported, loe) => { loe.p6CompletePctType = 'CP_Phys'; }, reason: 'wrongCompletePctType' },
  { label: 'ander duurtype', mutate: (_imported, loe) => { loe.p6DurationType = 'DT_FixedDUR2'; }, reason: 'wrongDurationType' },
  { label: 'in uitvoering', mutate: (_imported, loe) => { loe.time.completion = 0.5; }, reason: 'notCompleted' },
  { label: 'niet-completed status', mutate: (_imported, loe) => { loe.status = 'STARTED'; }, reason: 'notCompleted' },
  { label: 'oneindige completion', mutate: (_imported, loe) => { loe.time.completion = Infinity; }, reason: 'invalidCompletion' },
  { label: 'ontbrekende targetStart', mutate: (_imported, loe) => { loe.time.scheduleStart = ''; }, reason: 'missingScheduleStart', skipSolver: true },
  { label: 'ongeldige targetStart', mutate: (_imported, loe) => { loe.time.scheduleStart = 'geen-datum'; }, reason: 'invalidScheduleStart', skipSolver: true },
  { label: 'ontbrekende targetFinish', mutate: (_imported, loe) => { loe.time.scheduleFinish = ''; }, reason: 'missingScheduleFinish', skipSolver: true },
  { label: 'ongeldige targetFinish', mutate: (_imported, loe) => { loe.time.scheduleFinish = 'geen-datum'; }, reason: 'invalidScheduleFinish', skipSolver: true },
  { label: 'omgekeerd targetvenster', mutate: (_imported, loe) => { loe.time.scheduleStart = '2026-03-06T17:01'; }, reason: 'targetWindowInverted' },
  { label: 'ontbrekende actualFinish', mutate: (_imported, loe) => { loe.time.actualFinish = undefined; }, reason: 'missingActualFinish' },
  { label: 'ongeldige actualFinish', mutate: (_imported, loe) => { loe.time.actualFinish = 'geen-datum'; }, reason: 'invalidActualFinish' },
  { label: 'actualFinish vóór targetFinish', mutate: (_imported, loe) => { loe.time.actualFinish = '2026-03-06T16:00'; }, reason: 'actualFinishBeforeTargetFinish' },
  { label: 'actualFinish ná dataDate', mutate: (_imported, loe) => { loe.time.actualFinish = '2026-07-01T08:00'; }, reason: 'actualFinishAfterDataDate' },
  { label: 'ontbrekende dataDate', mutate: imported => { imported.project.statusDate = ''; }, reason: 'missingDataDate', schedule: hammockAtTargetStart },
  { label: 'ongeldige dataDate', mutate: imported => { imported.project.statusDate = 'geen-datum'; }, reason: 'invalidDataDate', skipSolver: true },
  { label: 'ontbrekend targetvenster', mutate: (_imported, loe) => { loe.p6ExplicitTargetWindow = false; }, reason: 'missingExplicitTargetWindow' },
  { label: 'stop', mutate: (_imported, loe) => { loe.time.stop = '2026-02-01T17:00'; }, reason: 'hasSuspendResume' },
  { label: 'resume', mutate: (_imported, loe) => { loe.time.resume = '2026-02-02T08:00'; }, reason: 'hasSuspendResume' },
  { label: 'suspend-markering', mutate: (_imported, loe) => { loe.p6SuspendResume = true; }, reason: 'hasSuspendResume' },
  { label: 'mijlpaalmarkering', mutate: (_imported, loe) => { loe.isMilestone = true; }, reason: 'milestoneOrZeroDuration' },
  { label: 'nulduur', mutate: (_imported, loe) => { loe.time.scheduleDuration = 0; loe.time.durationMinutes = 0; }, reason: 'milestoneOrZeroDuration' },
  { label: 'geen inkomende relatie', mutate: imported => { imported.sequences = []; }, reason: 'missingIncomingStartStart', schedule: hammockAtTargetStart },
  { label: 'inkomende FS', mutate: imported => { imported.sequences[0]!.type = 'FINISH_START'; }, reason: 'incomingNotOnlyStartStart', schedule: hammockAfterPredecessorFinish },
  { label: 'gemengde inkomende relaties', mutate: imported => { imported.sequences.push({ ...imported.sequences[0]!, id: 'R-FS', type: 'FINISH_START' }); }, reason: 'incomingNotOnlyStartStart', schedule: hammockAfterPredecessorFinish },
  { label: 'uitgaande relatie', mutate: imported => { imported.sequences.push({ ...imported.sequences[0]!, id: 'R-OUT', predecessorId: 'L', successorId: 'O' }); }, reason: 'hasOutgoingRelation' },
  { label: 'remaining-start-optie uit', mutate: imported => { imported.project.schedulingOptions = { ...imported.project.schedulingOptions, p6UseRemainingStartForProgress: false }; }, reason: 'remainingStartOff' },
  { label: 'backward-preserve-optie uit', mutate: imported => { imported.project.schedulingOptions = { ...imported.project.schedulingOptions, preserveActualDatesInBackwardPass: false }; }, reason: 'preserveActualDatesOff' },
  { label: 'actual-instant-optie uit', mutate: imported => { imported.project.schedulingOptions = { ...imported.project.schedulingOptions, p6PreserveActualInstants: false }; }, reason: 'preserveActualInstantsOff' },
];

for (const rejection of rejections) {
  if (rejection.skipSolver) {
    eq(`completed XER LOE fail-closed: ${rejection.label}`,
      decisionOnly(rejection.mutate), { eligible: false, reason: rejection.reason });
    continue;
  }
  const actual = projection(rejection.mutate);
  eq(`completed XER LOE fail-closed: ${rejection.label}`, actual.decision, { eligible: false, reason: rejection.reason });
  eq(`completed XER LOE ${rejection.label}: fail-closed behoudt alle zes solverassen`,
    actual.schedule, rejection.schedule ?? hammockAtDataDate);
}

if (diffs.length > 0) {
  console.error(`XER completed LOE actual-finish RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER completed LOE actual-finish GREEN: ${checks} checks groen`);
