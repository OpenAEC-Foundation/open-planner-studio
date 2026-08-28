import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';
import { XerImportError } from '@/services/xer/xerTables';
import { solveProject } from '@/engine/scheduler/solveProject';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';

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

function read(lines: readonly string[]): XerReadResult {
  const parsed = readXER(bytes(lines));
  if (isMultiDocumentImport(parsed)) throw new Error('Enkelprojectfixture gaf een meervoudige import terug');
  return parsed;
}

const fixture = [
  'ERMHDR\t23.12\t2026-04-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tDagploeg\tP1\tCA_Project\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tdef_duration_type\tplan_start_date\tplan_end_date',
  '%R\tP1\tBrugrenovatie\tC1\t2026-04-02 09:30\tdt_fixeddur2\t2099-01-01 00:00\t2099-12-31 00:00',
  '%T\tPROJWBS',
  '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
  '%R\tW-CHILD\tP1\tW-ROOT\t20\t1.1\tOnderbouw',
  '%R\tW-ROOT\tP1\t\t10\t1\tBrug',
  '%R\tW-SIB\tP1\tW-ROOT\t30\t1.2\tBovenbouw',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tpriority_type\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tcstr_type\tcstr_date\tcstr_type2\tcstr_date2\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\tplan_start_date\tplan_end_date',
  '%R\tT1\tP1\tW-CHILD\tC1\tA100\tStartsein\ttt_mile\tDT_FixedDUR2\ttk_notstart\tPT_Normal\t0\t0\t0\t2026-04-06 08:00\t2026-04-06 08:00\t\t\t\t\t\t\t2099-01-01 00:00\t2099-01-02 00:00\t2099-01-03 00:00\t2099-01-04 00:00\t2099-01-05 00:00\t2099-01-06 00:00',
  '%R\tT2\tP1\tW-CHILD\tC1\tA200\tFundering\tTT_LOE\tDT_FixedDrtn\tTK_Active\tPT_High\t25\t16\t12\t2026-04-06 08:00\t2026-04-07 16:00\t2026-04-06 08:00\t\tCS_MANSTART\t2026-04-06 08:00\tCS_MEOB\t2026-04-08 16:00\t2099-02-01 00:00\t2099-02-02 00:00\t2099-02-03 00:00\t2099-02-04 00:00\t2099-02-05 00:00\t2099-02-06 00:00',
  '%R\tT3\tP1\tW-SIB\tC1\tA300\tLigger\tTT_Rsrc\tDT_FixedQty\tTK_Complete\tPT_Top\t100\t8\t0\t2026-04-08 08:00\t2026-04-08 16:00\t2026-04-08 08:00\t2026-04-08 16:00\tCS_MANFINISH\t2026-04-08 16:00\t\t\t2099-03-01 00:00\t2099-03-02 00:00\t2099-03-03 00:00\t2099-03-04 00:00\t2099-03-05 00:00\t2099-03-06 00:00',
  '%R\tT4\tP1\tW-SIB\tC1\tA400\tControle\tTT_WBS\tDT_FixedRate\tTK_NotStart\tPT_Normal\t0\t8\t8\t2026-04-09 08:00\t2026-04-09 16:00\t\t\tCS_MSOA\t2026-04-09 08:00\tCS_MEOA\t2026-04-10 08:00\t2099-04-01 00:00\t2099-04-02 00:00\t2099-04-03 00:00\t2099-04-04 00:00\t2099-04-05 00:00\t2099-04-06 00:00',
  '%R\tT5\tP1\tW-SIB\tC1\tA500\tOnbekende bronwaarden\tTT_Alien\tDT_Alien\tTK_Alien\tPT_Alien\t0\t8\t8\t2026-04-10 08:00\t2026-04-10 16:00\t\t\tCS_Alien\t2026-04-10 08:00\t\t\t2099-05-01 00:00\t2099-05-02 00:00\t2099-05-03 00:00\t2099-05-04 00:00\t2099-05-05 00:00\t2099-05-06 00:00',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tT2\tT1\tP1\tP1\tPR_FS\t1.5',
  '%R\tR2\tT3\tT2\tP1\tP1\tss\t-2',
  '%R\tR3\tT4\tT3\tP1\tP1\tPR_FF\t0',
  '%R\tR4\tT5\tT4\tP1\tP1\tPR_SF\t0.25',
  '%R\tR5\tT5\tEXT-7\tP1\tP-EXT\tFS\t4',
  '%E',
] as const;

const result = read(fixture);
eq('0 enkelproject-XER draagt hetzelfde volledige importverslagcontract als meerproject-XER',
  result.xer.report, {
    projectsSeen: 1,
    documentsOpened: 1,
    emptyProjectsSkipped: 0,
    baselineProjectsExcluded: 0,
    baselinesMaterialized: 0,
    danglingBaselineReferences: 0,
    externalLinksPreserved: 0,
    baselineExclusionReverted: false,
    baselineFallbackReasons: [],
  });
eq('1 PROJECT-identiteit, statusdatum, projectkalender en header-valuta', {
  id: result.project.id,
  name: result.project.name,
  statusDate: result.project.statusDate,
  calendarId: result.project.calendarId,
  currency: result.xer.defaultCurrencyCode,
}, {
  id: 'P1',
  name: 'Brugrenovatie',
  statusDate: '2026-04-02T09:30',
  calendarId: 'C1',
  currency: 'EUR',
});
eq('2 projectdatumbereik komt uit input-TASK-velden, nooit uit PROJECT plan/output', {
  start: result.project.startDate,
  end: result.project.endDate,
}, { start: '2026-04-06T08:00', end: '2026-04-10T16:00' });
eq('3 PROJECT-kalender blijft de hoofdkalender', {
  id: result.calendar.id,
  hourMode: result.calendar.workTime !== undefined,
  mondayBands: result.calendar.workTime?.byWeekday[1],
}, { id: 'C1', hourMode: true, mondayBands: [{ start: 480, end: 960 }] });

// X12-kalenderbandfixture: `clndr_data` is leeg, maar de toegestane geplande invoer bewijst een
// P6 Standard 5x8-dag met lunchpauze: 40 uur vanaf wo 08:00 eindigt di 17:00, niet 16:00.
// De bestaande Brugrenovatie-fixture hierboven bewijst tegelijk dat een lege kalender met
// volledige-dagfinishes om 16:00 aaneengesloten 08:00-16:00 blijft.
const p6Lunch = read([
  'ERMHDR\t23.12\t2026-04-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tP6 lunchdag\tC1\t2026-04-01 08:00\t2026-04-01 08:00',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\t1010\tP1\tC1\tA1010\tOntwerp\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-04-01 08:00\t2026-04-07 17:00',
  '%R\t2010\tP1\tC1\tA2010\tFrame\tTT_Task\tDT_FixedDUR\tTK_NotStart\t60\t60\t2026-04-29 08:00\t2026-05-08 17:00',
  '%R\t2020\tP1\tC1\tA2020\tDak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2026-05-11 08:00\t2026-05-14 17:00',
  '%R\t3000\tP1\tC1\tA3000\tInspectie\tTT_Task\tDT_FixedDUR\tTK_NotStart\t16\t16\t2026-05-15 08:00\t2026-05-18 17:00',
  '%R\t3010\tP1\tC1\tA3010\tProjecteinde\tTT_Mile\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-05-18 17:00\t2026-05-18 17:00',
  '%R\t4000\tP1\tC1\tA4000\tDagtaak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-05-20 08:00\t2026-05-20 17:00',
  '%R\t4010\tP1\tC1\tA4010\tVolgende start\tTT_Mile\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-05-21 08:00\t2026-05-21 08:00',
  '%R\t5000\tP1\tC1\tA5000\tVroege voorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-05-25 08:00\t2026-05-25 17:00',
  '%R\t5010\tP1\tC1\tA5010\tGepland na ruimte\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-06-01 08:00\t2026-06-01 17:00',
  '%R\t6000\tP1\tC1\tA6000\tLaat anker\tTT_Task\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-06-02 16:49\t2026-06-02 16:49',
  '%R\t6010\tP1\tC1\tA6010\tSS-opvolger\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-06-03 08:00\t2026-06-03 17:00',
  '%R\t7000\tP1\tC1\tA7000\tP6 eindgrens +1 minuut\tTT_FinMile\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-06-10 08:01\t2026-06-10 08:01',
  '%R\t8000\tP1\tC1\tA8000\tVoorganger met eindgrens\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-05-25 08:00\t2026-05-25 17:00',
  '%R\t8010\tP1\tC1\tA8010\tGeplande FS-eindgrens\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-05-25 17:00\t2026-05-26 17:00',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\t2020\t2010\tP1\tP1\tPR_FS\t0',
  '%R\tR2\t3010\t3000\tP1\tP1\tPR_FS\t0',
  '%R\tR3\t4010\t4000\tP1\tP1\tPR_FS\t0',
  '%R\tR4\t5010\t5000\tP1\tP1\tPR_FS\t0',
  '%R\tR5\t6010\t6000\tP1\tP1\tPR_SS\t0',
  '%R\tR6\t7000\t5000\tP1\tP1\tPR_FS\t0',
  '%R\tR7\t8010\t8000\tP1\tP1\tPR_FS\t0',
  '%E',
]);
solveProject({
  tasks: p6Lunch.tasks,
  sequences: p6Lunch.sequences,
  calendar: p6Lunch.calendar,
  calendars: p6Lunch.resourceCalendars ?? [],
  dataDate: p6Lunch.project.statusDate,
  progressMode: p6Lunch.project.progressMode,
  schedulingOptions: p6Lunch.project.schedulingOptions,
  projectStartDate: p6Lunch.project.startDate,
});
eq('3a lege P6-5x8-kalender leidt lunchbanden af uit geplande start/eind/duur', {
  bands: p6Lunch.calendar.workTime?.byWeekday[1],
  earlyFinish: p6Lunch.tasks.find(task => task.id === '1010')?.time.earlyFinish,
}, {
  bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }],
  earlyFinish: '2026-04-07T17:00',
});
eq('3b P6-planned window bewaart fractionele duur en FS neemt volgende werkstart', {
  predecessorFinish: p6Lunch.tasks.find(task => task.id === '2010')?.time.earlyFinish,
  successorStart: p6Lunch.tasks.find(task => task.id === '2020')?.time.earlyStart,
}, {
  predecessorFinish: '2026-05-08T17:00',
  successorStart: '2026-05-11T08:00',
});
eq('3c P6 nulduurmijlpaal met FS+0 landt op de voorganger-finishgrens',
  p6Lunch.tasks.find(task => task.id === '3010')?.time.earlyStart,
  '2026-05-18T17:00');
eq('3d P6-startmijlpaal op geplande dagstart blijft de volgende werkstart',
  p6Lunch.tasks.find(task => task.id === '4010')?.time.earlyStart,
  '2026-05-21T08:00');
eq('3e XER-geplande start blijft ondergrens wanneer voorgangerlogica eerder vrijgeeft',
  p6Lunch.tasks.find(task => task.id === '5010')?.time.earlyStart,
  '2026-06-01T08:00');
eq('3f een geplande volgende-start vervangt geen relatie-instant binnen één dag',
  p6Lunch.tasks.find(task => task.id === '6010')?.time.earlyStart,
  '2026-06-02T16:49');
eq('3g P6 TT_FinMile op bandstart plus één minuut gebruikt start- en vorige finishgrens', {
  earlyStart: p6Lunch.tasks.find(task => task.id === '7000')?.time.earlyStart,
  earlyFinish: p6Lunch.tasks.find(task => task.id === '7000')?.time.earlyFinish,
  lateStart: p6Lunch.tasks.find(task => task.id === '7000')?.time.lateStart,
  lateFinish: p6Lunch.tasks.find(task => task.id === '7000')?.time.lateFinish,
}, {
  earlyStart: '2026-06-10T08:00',
  earlyFinish: '2026-06-09T17:00',
  lateStart: '2026-06-10T08:00',
  lateFinish: '2026-06-09T17:00',
});
eq('3h XER-reader markeert de expliciete geplande FS-finishgrens brongebonden',
  p6Lunch.sequences.find(sequence => sequence.id === 'R7')?.p6StartAtPredecessorFinishBoundary,
  true);
eq('3i XER-FS bewaart een expliciete geplande start op de voorganger-finishgrens', {
  predecessorFinish: p6Lunch.tasks.find(task => task.id === '8000')?.time.earlyFinish,
  successorStart: p6Lunch.tasks.find(task => task.id === '8010')?.time.earlyStart,
  successorFinish: p6Lunch.tasks.find(task => task.id === '8010')?.time.earlyFinish,
}, {
  predecessorFinish: '2026-05-25T17:00',
  successorStart: '2026-05-25T17:00',
  successorFinish: '2026-05-26T17:00',
});

// X12-voortgangsfixture: sommige geldige XER-producenten leveren bij CP_Drtn wel de expliciete
// target-/restduur maar geen redundante `complete_pct`-kolom. Status+restduur blijven dan de
// invoerwaarheid; 40 resterende uren op 80 totaal betekent 50%, niet 0%/nogmaals 80 uur.
const p6DurationProgressWithoutPct = read([
  'ERMHDR\t23.12\t2026-06-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tVoortgang zonder percentage\tC1\t2026-06-01 08:00\t2026-05-25 08:00',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date',
  '%R\tT1\tP1\tC1\tA100\tActieve duurtaak\tTT_Task\tDT_FixedDUR\tTK_Active\tCP_Drtn\t80\t40\t2026-05-25 08:00\t2026-06-05 17:00\t2026-05-25 08:00',
  '%E',
]);
solveProject({
  tasks: p6DurationProgressWithoutPct.tasks,
  sequences: p6DurationProgressWithoutPct.sequences,
  calendar: p6DurationProgressWithoutPct.calendar,
  calendars: p6DurationProgressWithoutPct.resourceCalendars ?? [],
  dataDate: p6DurationProgressWithoutPct.project.statusDate,
  progressMode: p6DurationProgressWithoutPct.project.progressMode,
  schedulingOptions: p6DurationProgressWithoutPct.project.schedulingOptions,
  projectStartDate: p6DurationProgressWithoutPct.project.startDate,
});
eq('3j CP_Drtn zonder complete_pct leidt voortgang en restwerk af uit expliciete bronduur', {
  completion: p6DurationProgressWithoutPct.tasks[0]?.time.completion,
  remainingMinutes: p6DurationProgressWithoutPct.tasks[0]?.time.remainingMinutes,
  earlyFinish: p6DurationProgressWithoutPct.tasks[0]?.time.earlyFinish,
}, {
  completion: 0.5,
  remainingMinutes: 2400,
  earlyFinish: '2026-06-05T17:00',
});

// X12-actualfixture: P6-actuals zijn geregistreerde broninstants, ook wanneer ze buiten een
// kalenderband op 00:00 liggen. De XER-route mag ze niet naar dezelfde-dag-start/vorige-finish
// normaliseren; dat zou zowel datum als minuut van een historisch feit wijzigen.
const p6MidnightActual = read([
  'ERMHDR\t23.12\t2026-06-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tP6 actualinstants\tC1\t2026-06-01 08:00\t2026-05-01 08:00',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
  '%R\tT1\tP1\tC1\tA100\tVoltooid om middernacht\tTT_Task\tDT_FixedDUR\tTK_Complete\tCP_Phys\t100\t40\t0\t2026-05-04 08:00\t2026-05-08 17:00\t2026-05-03 00:00\t2026-05-10 00:00',
  '%E',
]);
solveProject({
  tasks: p6MidnightActual.tasks,
  sequences: p6MidnightActual.sequences,
  calendar: p6MidnightActual.calendar,
  calendars: p6MidnightActual.resourceCalendars ?? [],
  dataDate: p6MidnightActual.project.statusDate,
  progressMode: p6MidnightActual.project.progressMode,
  schedulingOptions: p6MidnightActual.project.schedulingOptions,
  projectStartDate: p6MidnightActual.project.startDate,
});
eq('3k XER/P6 behoudt voltooide actual start/finish als minuutexacte broninstants', {
  earlyStart: p6MidnightActual.tasks[0]?.time.earlyStart,
  earlyFinish: p6MidnightActual.tasks[0]?.time.earlyFinish,
  lateStart: p6MidnightActual.tasks[0]?.time.lateStart,
  lateFinish: p6MidnightActual.tasks[0]?.time.lateFinish,
}, {
  earlyStart: '2026-05-03T00:00',
  earlyFinish: '2026-05-10T00:00',
  lateStart: '2026-05-03T00:00',
  lateFinish: '2026-05-10T00:00',
});

const byId = new Map(result.tasks.map(task => [task.id, task]));
eq('4 WBS-rijen worden exact één samenvattingstaak, vóór activiteiten en stabiel gesorteerd',
  result.tasks.slice(0, 3).map(task => ({ id: task.id, parent: task.parentId, children: task.childIds })),
  [
    { id: 'xer-wbs:P1:W-ROOT', parent: null, children: ['xer-wbs:P1:W-CHILD', 'xer-wbs:P1:W-SIB'] },
    { id: 'xer-wbs:P1:W-CHILD', parent: 'xer-wbs:P1:W-ROOT', children: ['T1', 'T2'] },
    { id: 'xer-wbs:P1:W-SIB', parent: 'xer-wbs:P1:W-ROOT', children: ['T3', 'T4', 'T5'] },
  ]);
eq('5 er ontstaan geen extra fidelity-bladtaken voor WBS', {
  total: result.tasks.length,
  activities: result.tasks.filter(task => task.p6ActivityType !== undefined).length,
  summaries: result.tasks.filter(task => task.id.startsWith('xer-wbs:')).length,
}, { total: 8, activities: 5, summaries: 3 });
eq('6 bekende activity/duration enums zijn case-insensitief en canoniek bewaard', [
  [byId.get('T1')?.p6ActivityType, byId.get('T1')?.p6DurationType],
  [byId.get('T2')?.p6ActivityType, byId.get('T2')?.p6DurationType],
], [['TT_Mile', 'DT_FixedDUR2'], ['TT_LOE', 'DT_FixedDrtn']]);
eq('7 activity type leidt alleen de afgesproken operationele vlaggen af', {
  startMilestone: [byId.get('T1')?.isMilestone, byId.get('T1')?.milestoneKind],
  loe: byId.get('T2')?.isHammock,
  resourceDependent: byId.get('T3')?.p6ActivityType,
  wbsActivity: byId.get('T4')?.p6ActivityType,
}, {
  startMilestone: [true, 'START'],
  loe: true,
  resourceDependent: 'TT_Rsrc',
  wbsActivity: 'TT_WBS',
});
eq('8 onbekende tokens vallen gedocumenteerd terug en worden per veld gerapporteerd', {
  activity: byId.get('T5')?.p6ActivityType,
  duration: byId.get('T5')?.p6DurationType,
  status: byId.get('T5')?.status,
  priority: byId.get('T5')?.priority,
  fallbacks: result.xer.enumFallbacks.map(item => [item.family, item.token, item.fallback]),
}, {
  activity: 'TT_Task',
  duration: 'DT_FixedDUR2',
  status: 'NOT_STARTED',
  priority: 500,
  fallbacks: [
    ['activityType', 'TT_Alien', 'TT_Task'],
    ['durationType', 'DT_Alien', 'DT_FixedDUR2'],
    ['status', 'TK_Alien', 'NOT_STARTED'],
    ['priority', 'PT_Alien', '500'],
    ['constraint', 'CS_Alien', 'ASAP'],
  ],
});
eq('9 P6-status, completion, actuals en bronduur worden zonder X7-semantiek gelezen', {
  t2: [byId.get('T2')?.status, byId.get('T2')?.time.completion, byId.get('T2')?.time.actualStart,
    byId.get('T2')?.time.durationMinutes, byId.get('T2')?.time.remainingMinutes],
  t3: [byId.get('T3')?.status, byId.get('T3')?.time.completion, byId.get('T3')?.time.actualFinish],
}, {
  t2: ['STARTED', 0.25, '2026-04-06T08:00', 960, 720],
  t3: ['COMPLETED', 1, '2026-04-08T16:00'],
});
eq('10 productielezer negeert P6-output- en planvelden', {
  t2Start: byId.get('T2')?.time.scheduleStart,
  t2Finish: byId.get('T2')?.time.scheduleFinish,
  t2Early: byId.get('T2')?.time.earlyStart,
  t2Late: byId.get('T2')?.time.lateFinish,
}, {
  t2Start: '2026-04-06T08:00',
  t2Finish: '2026-04-07T16:00',
  t2Early: '2026-04-06T08:00',
  t2Late: '2026-04-07T16:00',
});
eq('11 mandatory constraints zijn hard; secundaire constraints blijven soft', {
  t2: [byId.get('T2')?.constraint, byId.get('T2')?.constraint2],
  t3: byId.get('T3')?.constraint,
  t4: [byId.get('T4')?.constraint, byId.get('T4')?.constraint2],
}, {
  t2: [
    { type: 'MSO', date: '2026-04-06T08:00', hard: true },
    { type: 'FNLT', date: '2026-04-08T16:00' },
  ],
  t3: { type: 'MFO', date: '2026-04-08T16:00', hard: true },
  t4: [
    { type: 'SNET', date: '2026-04-09T08:00' },
    { type: 'FNET', date: '2026-04-10T08:00' },
  ],
});
eq('12 alle vier PR-relaties plus kale SS worden gemapt en lag blijft integer minuten',
  result.sequences.map(sequence => [sequence.id, sequence.type, sequence.lagMinutes]), [
    ['R1', 'FINISH_START', 90],
    ['R2', 'START_START', -120],
    ['R3', 'FINISH_FINISH', 0],
    ['R4', 'START_FINISH', 15],
  ]);
eq('13 externe relatie is uitsluitend brondata en geen solver-Sequence', {
  sequenceIds: result.sequences.map(sequence => sequence.id),
  external: result.xer.externalRelations,
}, {
  sequenceIds: ['R1', 'R2', 'R3', 'R4'],
  external: [{
    id: 'R5',
    localProjectId: 'P1',
    localTaskId: 'T5',
    externalProjectId: 'P-EXT',
    externalTaskId: 'EXT-7',
    direction: 'predecessor',
    type: 'FS',
    lagMinutes: 240,
  }],
});

// X12 late-pass RED/GREEN: P6 mag alleen het toegestane PROJECT.plan_end_date als late
// projecteinde-anker gebruiken wanneer SCHEDOPTIONS dat expliciet vraagt. De bronwaarde ligt op
// middernacht; in de projectkalender betekent dat het voorafgaande bandeinde (28 februari 17:00).
const p6ProjectEndForFloat = read([
  'ERMHDR\t23.12\t2026-04-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC-END\tZeven dagen\tP-END\tCA_Project\t8\t56\t(0||CalendarData()(    (0||DaysOfWeek()(      (0||1()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||2()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||3()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||4()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||5()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||6()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||7()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))))    (0||Exceptions()())))',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tplan_start_date\tplan_end_date',
  '%R\tP-END\tProjecteinde voor float\tC-END\t2013-02-27 17:00\t2013-03-01 00:00',
  '%T\tSCHEDOPTIONS',
  '%F\tproj_id\tsched_use_project_end_date_for_float',
  '%R\tP-END\tY',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tcstr_type\tcstr_date',
  '%R\tT-START\tP-END\tC-END\tSTART\tProjectstart\tTT_Mile\tDT_FixedDrtn\tTK_NotStart\t0\t0\t2012-05-01 08:00\t2012-05-01 08:00\tCS_MSOB\t2012-05-01 08:00',
  '%R\tT-END\tP-END\tC-END\tEND\tProjecteinde\tTT_FinMile\tDT_FixedDrtn\tTK_NotStart\t0\t0\t2013-02-27 17:00\t2013-02-27 17:00\t\t',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR-END\tT-END\tT-START\tP-END\tP-END\tPR_FS\t0',
  '%E',
]);
const p6ProjectEndTasks = p6ProjectEndForFloat.tasks.map(task => ({ ...task, time: { ...task.time } }));
const p6ProjectEndSolveInput = {
  tasks: p6ProjectEndTasks,
  sequences: p6ProjectEndForFloat.sequences,
  calendar: p6ProjectEndForFloat.calendar,
  calendars: p6ProjectEndForFloat.resourceCalendars ?? [],
  schedulingOptions: p6ProjectEndForFloat.project.schedulingOptions,
  projectStartDate: p6ProjectEndForFloat.project.startDate,
  projectEndDate: p6ProjectEndForFloat.project.endDate,
};
solveProject(p6ProjectEndSolveInput);
const p6ProjectEndTask = p6ProjectEndTasks.find(task => task.id === 'T-END');
const p6ProjectStartTask = p6ProjectEndTasks.find(task => task.id === 'T-START');
eq('13a SCHEDOPTIONS projecteinde geeft één P6-werkdag late float zonder outputvelden', {
  importedProjectEnd: p6ProjectEndForFloat.project.endDate,
  useProjectEndDateForFloat: p6ProjectEndForFloat.project.schedulingOptions?.useProjectEndDateForFloat,
  lateFinish: p6ProjectEndTask?.time.lateFinish,
  totalFloatMinutes: (p6ProjectEndTask?.time.totalFloat ?? NaN) * 8 * 60,
  freeFloatMinutes: (p6ProjectEndTask?.time.freeFloat ?? NaN) * 8 * 60,
}, {
  importedProjectEnd: '2013-03-01T00:00',
  useProjectEndDateForFloat: true,
  lateFinish: '2013-02-28T17:00',
  totalFloatMinutes: 480,
  freeFloatMinutes: 0,
});
eq('13b P6 SNLT op de exacte startband houdt een nulduurmijlpaal op die broninstant', {
  lateStart: p6ProjectStartTask?.time.lateStart,
  lateFinish: p6ProjectStartTask?.time.lateFinish,
}, {
  lateStart: '2012-05-01T08:00',
  lateFinish: '2012-05-01T08:00',
});

function typedError(label: string, lines: readonly string[], code: string): void {
  let got = 'NO_ERROR';
  try {
    read(lines);
  } catch (error) {
    got = error instanceof XerImportError ? error.xerCode : String(error);
  }
  eq(label, got, code);
}

typedError('14 meerdere uitsluitend lege PROJECT-rijen worden expliciet geweigerd', [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\tP1\tEen',
  '%R\tP2\tTwee',
  '%E',
], 'XER_EMPTY_PROJECT');

typedError('15 project zonder TASK wordt expliciet geweigerd', [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\tP1\tLeeg',
  '%E',
], 'XER_EMPTY_PROJECT');

ok('16 XER-resultaat levert lege resourcevelden binnen het gedeelde importcontract',
  result.resources.length === 0 && result.assignments.length === 0);

const singleDangling = read([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tsum_base_proj_id',
  '%R\tP1\tLosse baselineverwijzing\tP-MISSING',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tA1\tTaak\t2026-01-01\t2026-01-02',
  '%E',
]);
eq('16a enkelproject-XER rapporteert een dangling baselineverwijzing echt', {
  dangling: singleDangling.xer.report.danglingBaselineReferences,
  baselines: singleDangling.baselines ?? [],
}, { dangling: 1, baselines: [] });

const singleSelf = read([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tsum_base_proj_id',
  '%R\tP1\tZelfbaseline\tP1',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tA1\tTaak\t2026-01-01\t2026-01-02',
  '%E',
]);
eq('16b enkelproject-XER rapporteert zelfverwijzing en vangrail zonder opensemantiek te wijzigen', {
  project: singleSelf.project.id,
  report: singleSelf.xer.report,
}, {
  project: 'P1',
  report: {
    projectsSeen: 1,
    documentsOpened: 1,
    emptyProjectsSkipped: 0,
    baselineProjectsExcluded: 0,
    baselinesMaterialized: 0,
    danglingBaselineReferences: 0,
    externalLinksPreserved: 0,
    baselineExclusionReverted: true,
    baselineFallbackReasons: ['self-reference', 'all-projects-baselines'],
  },
});

// Fixronde 1, bevinding 1: een lege PROJWBS-rij blijft semantisch een samenvattingstaak. Dit
// bewijs rijdt niet alleen langs de fidelityfilter, maar door de echte solveProject-keten én de
// gedeelde relatie-/resourceconsumenten die uitsluitend bladtaken mogen zien.
const emptyWbsResult = read([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_data',
  '%R\tC1\tStandaard\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tLege WBS\tC1\t2026-01-01 08:00',
  '%T\tPROJWBS',
  '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
  '%R\tW-USED\tP1\t\t10\t1\tGebruikt',
  '%R\tW-EMPTY\tP1\t\t20\t2\tLeeg maar summary',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tW-USED\tA1\tTaak\t8\t2026-01-01 08:00\t2026-01-01 16:00',
  '%E',
]);
const emptyWbsId = 'xer-wbs:P1:W-EMPTY';
const emptyWbs = emptyWbsResult.tasks.find(task => task.id === emptyWbsId);
eq('17 lege PROJWBS heeft expliciete samenvattingsidentiteit',
  (emptyWbs as typeof emptyWbs & { isSummary?: boolean })?.isSummary, true);
const emptyWbsSolve = solveProject({
  tasks: emptyWbsResult.tasks.map(task => ({ ...task, time: { ...task.time } })),
  sequences: [],
  calendar: emptyWbsResult.calendar,
  calendars: emptyWbsResult.resourceCalendars ?? [],
});
eq('18 echte solveProject-route neemt lege PROJWBS niet als CPM-knoop op',
  emptyWbsSolve.tasks.has(emptyWbsId), false);
eq('19 samenvattingsrelatie vanaf lege PROJWBS wordt zichtbaar gedropt',
  expandSummaryRelations(emptyWbsResult.tasks, [{
    id: 'EMPTY-WBS-REL', predecessorId: emptyWbsId, successorId: 'T1',
    type: 'FINISH_START', lagDays: 0,
  }]).droppedSequenceIds, ['EMPTY-WBS-REL']);
const poisonedSummaryTasks = emptyWbsResult.tasks.map(task => task.id === emptyWbsId
  ? { ...task, time: { ...task.time, scheduleDuration: 1, earlyFinish: '2026-01-02' } }
  : task);
const emptyWbsLoad = computeResourceLoad(
  [{ id: 'R1', name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 }],
  [{ id: 'A1', taskId: emptyWbsId, resourceId: 'R1', unitsPerDay: 1 }],
  poisonedSummaryTasks,
  emptyWbsResult.calendar,
  emptyWbsResult.resourceCalendars ?? [],
);
eq('20 resourcebelasting behandelt lege PROJWBS niet als bladtaak', emptyWbsLoad.load, {});
const emptyWbsLeveling = levelResources(
  poisonedSummaryTasks,
  [],
  [{ id: 'R1', name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 }],
  [
    { id: 'A1', taskId: emptyWbsId, resourceId: 'R1', unitsPerDay: 1 },
    { id: 'A2', taskId: 'T1', resourceId: 'R1', unitsPerDay: 1 },
  ],
  emptyWbsResult.calendar,
  emptyWbsResult.resourceCalendars ?? [],
  emptyWbsSolve,
  { constrainToFloat: false },
);
eq('20b nivelleerder laat lege PROJWBS ook bij directe aanroep buiten CPM en vraag', {
  delays: emptyWbsLeveling.delays,
  shifts: emptyWbsLeveling.shifts,
}, { delays: {}, shifts: {} });
const emptyWbsIfc = readIFC(writeIFC(emptyWbsResult));
eq('21 IFC-roundtrip behoudt lege PROJWBS als expliciete samenvatting',
  (emptyWbsIfc.tasks.find(task => task.wbsCode === '2') as TaskWithSummary | undefined)?.isSummary,
  true);

type TaskWithSummary = XerReadResult['tasks'][number] & { isSummary?: boolean };

function duplicateFixture(table: 'PROJWBS' | 'TASK' | 'TASKPRED'): readonly string[] {
  const lines = [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name',
    '%R\tP1\tDubbeltest',
    '%T\tPROJWBS',
    '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
    '%R\tW1\tP1\t\t10\t1\tEen',
    ...(table === 'PROJWBS' ? ['%R\tW1\tP1\t\t20\t2\tDubbel'] : []),
    '%T\tTASK',
    '%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\tW1\tA1\tEen\t2026-01-01\t2026-01-02',
    ...(table === 'TASK' ? ['%R\tT1\tP1\tW1\tA2\tDubbel\t2026-01-03\t2026-01-04'] : [
      '%R\tT2\tP1\tW1\tA2\tTwee\t2026-01-03\t2026-01-04',
    ]),
    ...(table === 'TASKPRED' ? [
      '%T\tTASKPRED',
      '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
      '%R\tR1\tT2\tT1\tP1\tP1\tPR_FS\t0',
      '%R\tR1\tT2\tT1\tP1\tP1\tPR_FS\t0',
    ] : []),
    '%E',
  ];
  return lines;
}

typedError('22 dubbele wbs_id wordt vóór boombouw getypeerd geweigerd',
  duplicateFixture('PROJWBS'), 'XER_DUPLICATE_ID');
typedError('23 dubbele task_id wordt vóór taakmap getypeerd geweigerd',
  duplicateFixture('TASK'), 'XER_DUPLICATE_ID');
typedError('24 dubbele relatie-id wordt vóór relatiebouw getypeerd geweigerd',
  duplicateFixture('TASKPRED'), 'XER_DUPLICATE_ID');

typedError('25 lokaal gedeclareerde relatie met ontbrekend lokaal eindpunt verdwijnt nooit stil', [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\tP1\tVerweesde relatie',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tA1\tEen\t2026-01-01\t2026-01-02',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR-DANGLING\tMISSING\tT1\tP1\tP1\tPR_FS\t0',
  '%E',
], 'XER_DANGLING_LOCAL_RELATION');

function sortingFixture(order: readonly string[]): readonly string[] {
  const rows: Record<string, string> = {
    root: '%R\tROOT\tP1\t\t1\t0\tRoot',
    z: '%R\tW-Z\tP1\tROOT\t10\tZ\tZ',
    umlaut: '%R\tW-Ä\tP1\tROOT\t10\tÄ\tÄ',
  };
  return [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name',
    '%R\tP1\tSortering',
    '%T\tPROJWBS',
    '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
    ...order.map(key => rows[key]),
    '%T\tTASK',
    '%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\tROOT\tA1\tTaak\t2026-01-01\t2026-01-02',
    '%E',
  ];
}

function sortedWbsUnderLocale(locale: string, order: readonly string[]): string[] {
  const original = String.prototype.localeCompare;
  String.prototype.localeCompare = function localeBound(other: string): number {
    return original.call(String(this), other, locale);
  };
  try {
    return read(sortingFixture(order)).tasks
      .filter(task => task.id.startsWith('xer-wbs:'))
      .map(task => task.id);
  } finally {
    String.prototype.localeCompare = original;
  }
}
const expectedWbsOrder = ['xer-wbs:P1:ROOT', 'xer-wbs:P1:W-Z', 'xer-wbs:P1:W-Ä'];
eq('26 WBS-sortering is hostonafhankelijk onder en-US',
  sortedWbsUnderLocale('en-US', ['root', 'umlaut', 'z']), expectedWbsOrder);
eq('27 WBS-sortering is hostonafhankelijk onder sv-SE',
  sortedWbsUnderLocale('sv-SE', ['root', 'umlaut', 'z']), expectedWbsOrder);
eq('28 unieke wbs_id is tie-breaker, onafhankelijk van bronhussel',
  sortedWbsUnderLocale('en-US', ['z', 'root', 'umlaut']), expectedWbsOrder);

if (diffs.length > 0) {
  console.error(`XER-reader: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-reader: ${checks} corpusloze project/taak/WBS/relatie/constraint-checks`);
