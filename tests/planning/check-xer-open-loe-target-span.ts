import { solveProject } from '@/engine/scheduler/solveProject';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { explainOpenXerLoeTargetSpanEligibility } from '@/engine/scheduler/p6OpenLoeTargetSpanTrace';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';
import type { Task } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const workWeek = '(0||CalendarData()(    (0||DaysOfWeek()(      (0||1()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||2()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||3()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||4()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||5()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||6()())      (0||7()())))    (0||Exceptions()())))';

/** Kleine raw-XER-vorm uit Ashspace: SS naar open LOE, FF naar opvolger, geen actuals. */
interface FixtureOptions {
  targetStart?: string;
  targetEnd?: string;
  rawYear?: string;
  outgoingType?: string;
  outgoingLag?: string;
  includeOutgoing?: boolean;
  dayMode?: boolean;
}

function fixtureBytes(options: FixtureOptions = {}): Uint8Array {
  const dayMode = options.dayMode ?? false;
  const targetStart = options.targetStart ?? (dayMode ? '2026-01-05' : '2026-01-05 08:00');
  const targetEnd = options.targetEnd ?? (dayMode ? '2026-01-16' : '2026-01-16 17:00');
  const rawYear = options.rawYear ?? '2099';
  const outgoingType = options.outgoingType ?? 'PR_FF';
  const outgoingLag = options.outgoingLag ?? '0';
  const includeOutgoing = options.includeOutgoing ?? true;
  const predecessorStart = dayMode ? '2026-01-05' : '2026-01-05 08:00';
  const predecessorEnd = dayMode ? '2026-01-05' : '2026-01-05 17:00';
  const successorStart = dayMode ? targetEnd : targetEnd.replace('17:00', '08:00');
  const calendarData = dayMode ? '' : workWeek;
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tOpen LOE targetspan\tC1\t2025-12-31 17:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt\trestart_date\treend_date\tdriving_path_flag',
    `%R\tP\tP1\tC1\tPRED\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t8\t8\t${predecessorStart}\t${predecessorEnd}\t\t\t${rawYear}-01-01 00:00\t${rawYear}-01-01 17:00\t${rawYear}-01-01 00:00\t${rawYear}-01-01 17:00\t999\t888\t${rawYear}-01-01 00:00\t${rawYear}-01-01 17:00\tN`,
    `%R\tL\tP1\tC1\tLOE\tOpen LOE\tTT_LOE\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t80\t80\t${targetStart}\t${targetEnd}\t\t\t${rawYear}-02-01 00:00\t${rawYear}-02-01 17:00\t${rawYear}-02-01 00:00\t${rawYear}-02-01 17:00\t777\t666\t${rawYear}-02-01 00:00\t${rawYear}-02-01 17:00\tY`,
    `%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t8\t8\t${successorStart}\t${targetEnd}\t\t\t${rawYear}-03-01 00:00\t${rawYear}-03-01 17:00\t${rawYear}-03-01 00:00\t${rawYear}-03-01 17:00\t555\t444\t${rawYear}-03-01 00:00\t${rawYear}-03-01 17:00\tN`,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR-SS\tL\tP\tP1\tP1\tPR_SS\t0',
    ...(includeOutgoing ? [`%R\tR-FF\tS\tL\tP1\tP1\t${outgoingType}\t${outgoingLag}`] : []),
    '%E',
  ].join('\n'));
}

function importedFixture(options?: FixtureOptions): ImportResult {
  const opened = readXER(fixtureBytes(options));
  if (isMultiDocumentImport(opened)) throw new Error('open-LOE-fixture moet één project openen');
  return opened;
}

function task(imported: ImportResult): Task {
  const found = imported.tasks.find(candidate => candidate.id === 'L' || candidate.p6TaskId === 'L' || candidate.wbsCode === 'LOE');
  if (!found) throw new Error('open-LOE-fixture mist taak L');
  return found;
}

const imported = importedFixture();
const loe = task(imported);
eq('open XER LOE: raw fixture levert uitsluitend toegestane provenance', {
  source: imported.project.schedulingOptions?.p6Source,
  activity: loe.p6ActivityType,
  completePct: loe.p6CompletePctType,
  duration: loe.p6DurationType,
  targetWindow: loe.p6ExplicitTargetWindow,
  status: loe.status,
  actualStart: loe.time.actualStart,
  actualFinish: loe.time.actualFinish,
}, {
  source: 'XER', activity: 'TT_LOE', completePct: 'CP_Drtn', duration: 'DT_FixedDUR2',
  targetWindow: true, status: 'NOT_STARTED', actualStart: undefined, actualFinish: undefined,
});
const calendar = new CalendarEngine(imported.calendar);
eq('open XER LOE: targetvenster en bronduur gebruiken dezelfde positieve werkminuten', {
  durationMinutes: loe.time.durationMinutes,
  scheduleDuration: loe.time.scheduleDuration,
  targetWindowMinutes: calendar.workMinutesBetween(
    parseInstant(loe.time.scheduleStart),
    parseInstant(loe.time.scheduleFinish),
  ),
}, { durationMinutes: 80 * 60, scheduleDuration: 10, targetWindowMinutes: 72 * 60 });
eq('open XER LOE: de pure diagnose accepteert de positieve raw-vorm',
  explainOpenXerLoeTargetSpanEligibility(
    loe,
    imported.project.schedulingOptions,
    imported.sequences.filter(sequence => sequence.successorId === loe.id),
    imported.sequences.filter(sequence => sequence.predecessorId === loe.id),
    parseInstant(loe.time.scheduleStart),
    calendar.workMinutesBetween(parseInstant(loe.time.scheduleStart), parseInstant(loe.time.scheduleFinish)),
    calendar.hoursPerDay * 60,
  ),
  { eligible: true, reason: 'eligible' },
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
if (!solved) throw new Error('solver mist open LOE');

// Dit is bewust de initiële rode causale eis: de uitgaande FF is geen eigen finish-driver in de
// generieke hammockroute, dus alleen een geverifieerde XER-targetspanroute mag dit doel halen.
eq('open XER LOE: expliciet targetvenster bepaalt de eigen span', {
  es: solved.earlyStart, ef: solved.earlyFinish,
  ls: solved.lateStart, lf: solved.lateFinish,
  tf: solved.totalFloat, ff: solved.freeFloat,
}, {
  es: '2026-01-05T08:00', ef: '2026-01-16T17:00',
  ls: '2026-01-05T08:00', lf: '2026-01-16T17:00',
  tf: 0, ff: 0,
});

function diagnose(input: ImportResult) {
  const candidate = task(input);
  const candidateCalendar = new CalendarEngine(input.calendar);
  return explainOpenXerLoeTargetSpanEligibility(
    candidate,
    input.project.schedulingOptions,
    input.sequences.filter(sequence => sequence.successorId === candidate.id),
    input.sequences.filter(sequence => sequence.predecessorId === candidate.id),
    parseInstant('2026-01-05T08:00'),
    candidate.time.scheduleStart && candidate.time.scheduleFinish
      ? candidateCalendar.workMinutesBetween(parseInstant(candidate.time.scheduleStart), parseInstant(candidate.time.scheduleFinish))
      : Number.NaN,
    candidateCalendar.hoursPerDay * 60,
  );
}

function axes(input: ImportResult) {
  const candidate = task(input);
  const solvedResult = solveProject({
    tasks: input.tasks, sequences: input.sequences, calendar: input.calendar,
    calendars: input.resourceCalendars ?? [], dataDate: input.project.statusDate,
    progressMode: input.project.progressMode, schedulingOptions: input.project.schedulingOptions,
    projectStartDate: input.project.startDate, projectEndDate: input.project.endDate,
  });
  if (solvedResult.error) throw new Error(solvedResult.error);
  const solvedTask = solvedResult.tasks.get(candidate.id);
  if (!solvedTask) throw new Error('solver mist open LOE in mutatie');
  return {
    es: solvedTask.earlyStart, ef: solvedTask.earlyFinish,
    ls: solvedTask.lateStart, lf: solvedTask.lateFinish,
    tf: solvedTask.totalFloat, ff: solvedTask.freeFloat,
  };
}

const baseAxes = axes(importedFixture());
const absurdRaw = importedFixture({ rawYear: '2088' });
eq('open XER LOE: raw early/late/float/restart/reend/driving blijven meetlat en zijn productinert',
  axes(absurdRaw), baseAxes);

// Permanente echte-reader-regressie: de Ashspace-vorm bewaart XER-provenance, TT_LOE en een
// positief expliciet targetvenster, maar een XER-kalender zonder klokbanden blijft dagmodus. De
// uur-native targetspanroute mag dan niet openen; de gewone hammocksemantiek blijft leidend.
const dayModeImported = importedFixture({ dayMode: true });
const dayModeLoe = task(dayModeImported);
const dayModeCalendar = new CalendarEngine(dayModeImported.calendar);
// De dagmodusprojectie draagt de bronduur in hele dagen; geef de expliciete XER-bronduur hier
// bewust weer als minuten door aan de solveringang. Zo isoleren we de uurmodusguard zónder de
// echte readXER-provenance, taakvorm of het gelezen doelvenster te vervangen.
dayModeLoe.time.durationMinutes = 80 * 60;
eq('open XER LOE dagmodus: echte reader bewaart provenance en expliciet doelvenster zonder workTime', {
  source: dayModeImported.project.schedulingOptions?.p6Source,
  activity: dayModeLoe.p6ActivityType,
  targetWindow: dayModeLoe.p6ExplicitTargetWindow,
  start: dayModeLoe.time.scheduleStart,
  finish: dayModeLoe.time.scheduleFinish,
  workTime: dayModeImported.calendar.workTime,
  hourMode: dayModeCalendar.isHourMode,
}, {
  source: 'XER', activity: 'TT_LOE', targetWindow: true,
  start: '2026-01-05', finish: '2026-01-16', workTime: undefined, hourMode: false,
});
eq('open XER LOE dagmodus: uur-native route sluit fail-closed',
  explainOpenXerLoeTargetSpanEligibility(
    dayModeLoe,
    dayModeImported.project.schedulingOptions,
    dayModeImported.sequences.filter(sequence => sequence.successorId === dayModeLoe.id),
    dayModeImported.sequences.filter(sequence => sequence.predecessorId === dayModeLoe.id),
    parseInstant(dayModeLoe.time.scheduleStart),
    Number.NaN,
    dayModeCalendar.hoursPerDay * 60,
  ),
  { eligible: false, reason: 'targetWindowDurationMismatch' },
);
let dayModeSolveError: string | undefined;
let dayModeAxes: ReturnType<typeof axes> | undefined;
try {
  dayModeAxes = axes(dayModeImported);
} catch (error) {
  dayModeSolveError = error instanceof Error ? error.message : String(error);
}
eq('open XER LOE dagmodus: echte readXER-naar-solveProject-route gooit niet', dayModeSolveError, undefined);
eq('open XER LOE dagmodus: generieke hammockroute bewaart alle zes solverassen', dayModeAxes, {
  es: '2026-01-05', ef: '2026-01-05', ls: '2026-01-05', lf: '2026-01-05', tf: 0, ff: 0,
});

const changedTargetEnd = importedFixture({ targetEnd: '2026-01-19 17:00' });
eq('open XER LOE: alleen target_end_date wijzigt kandidaat-EF en -LF', {
  decision: diagnose(changedTargetEnd), axes: axes(changedTargetEnd),
}, {
  decision: { eligible: true, reason: 'eligible' },
  axes: { es: '2026-01-05T08:00', ef: '2026-01-19T17:00', ls: '2026-01-05T08:00', lf: '2026-01-19T17:00', tf: 0, ff: 0 },
});

const targetStartConflict = importedFixture({ targetStart: '2026-01-06 08:00' });
eq('open XER LOE: afwijkende target_start_date valt op relationele startconflict fail-closed terug', {
  decision: diagnose(targetStartConflict), axes: axes(targetStartConflict),
}, {
  decision: { eligible: false, reason: 'targetStartConflictsWithRelation' },
  axes: { es: '2026-01-05T08:00', ef: '2026-01-05T08:00', ls: '2026-01-05T08:00', lf: '2026-01-05T08:00', tf: 0, ff: 0 },
});

for (const mutation of [
  { label: 'omgekeerd targetvenster', mutate: (_input: ImportResult, candidate: Task) => { candidate.time.scheduleStart = '2026-01-17T08:00'; }, reason: 'targetWindowNotPositive' },
  { label: 'half targetvenster', mutate: (_input: ImportResult, candidate: Task) => { candidate.time.scheduleFinish = ''; }, reason: 'missingScheduleFinish' },
  { label: 'ongeldig targetvenster', mutate: (_input: ImportResult, candidate: Task) => { candidate.time.scheduleFinish = 'geen-datum'; }, reason: 'invalidScheduleFinish' },
  { label: 'andere bron', mutate: (input: ImportResult) => { delete input.project.schedulingOptions?.p6Source; }, reason: 'notXerSource' },
  { label: 'ander taaktype', mutate: (_input: ImportResult, candidate: Task) => { candidate.p6ActivityType = 'TT_Task'; }, reason: 'wrongActivityType' },
  { label: 'ander duurtype', mutate: (_input: ImportResult, candidate: Task) => { candidate.p6DurationType = 'DT_FixedDrtn'; }, reason: 'wrongDurationType' },
  { label: 'andere voortgangsfamilie', mutate: (_input: ImportResult, candidate: Task) => { candidate.p6CompletePctType = 'CP_Phys'; }, reason: 'wrongCompletePctType' },
  { label: 'gestarte status', mutate: (_input: ImportResult, candidate: Task) => { candidate.status = 'STARTED'; }, reason: 'notNotStarted' },
  { label: 'actual', mutate: (_input: ImportResult, candidate: Task) => { candidate.time.actualFinish = '2026-01-10T17:00'; }, reason: 'hasActuals' },
  { label: 'stop', mutate: (_input: ImportResult, candidate: Task) => { candidate.time.stop = '2026-01-10T17:00'; }, reason: 'hasSuspendResume' },
  { label: 'resume', mutate: (_input: ImportResult, candidate: Task) => { candidate.time.resume = '2026-01-11T08:00'; }, reason: 'hasSuspendResume' },
  { label: 'bronduur buiten targetband', mutate: (_input: ImportResult, candidate: Task) => { candidate.time.durationMinutes = 1; }, reason: 'targetWindowDurationMismatch' },
]) {
  const candidateInput = structuredClone(importedFixture());
  mutation.mutate(candidateInput, task(candidateInput));
  eq(`open XER LOE fail-closed: ${mutation.label}`, diagnose(candidateInput), { eligible: false, reason: mutation.reason });
}

for (const topology of [
  { label: 'zonder PR_FF', options: { includeOutgoing: false }, reason: 'missingOutgoingFinishFinish' },
  { label: 'met andere uitgaande type', options: { outgoingType: 'PR_FS' }, reason: 'outgoingNotOnlyFinishFinish' },
  { label: 'met lag', options: { outgoingLag: '8' }, reason: 'nonZeroRelationLag' },
]) {
  eq(`open XER LOE fail-closed: ${topology.label}`,
    diagnose(importedFixture(topology.options)), { eligible: false, reason: topology.reason });
}

const assigned = structuredClone(importedFixture());
task(assigned).resourceIds.push('resource-1', 'resource-2');
eq('open XER LOE: toegevoegde toewijzingen veranderen de span niet', axes(assigned), baseAxes);

const reloaded = await readIFCWithXerReconstruction(writeIFC(importedFixture()));
eq('open XER LOE: XER-IFC-reload bewaart de relevante XER-provenance en span', {
  source: reloaded.project.schedulingOptions?.p6Source,
  decision: diagnose(reloaded),
  axes: axes(reloaded),
}, { source: 'XER', decision: { eligible: true, reason: 'eligible' }, axes: baseAxes });

const genericIfcSource = structuredClone(importedFixture());
delete genericIfcSource.project.schedulingOptions?.p6Source;
genericIfcSource.xer = undefined;
genericIfcSource.xerSourceArchive = undefined;
genericIfcSource.xerSourceProjectId = undefined;
const genericIfc = readIFC(writeIFC(genericIfcSource));
eq('open XER LOE: generieke IFC zonder XER-provenance blijft fail-closed',
  diagnose(genericIfc), { eligible: false, reason: 'notXerSource' });

if (diffs.length > 0) {
  console.error(`XER open LOE targetspan RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER open LOE targetspan GREEN: ${checks} checks groen`);
