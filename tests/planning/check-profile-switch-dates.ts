import { createAppStoreContext } from '@/state/appStore';
import { selectProfile } from '@/state/schedulingProfileDraft';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readXerArchiveIFC } from './xerArchiveTestReader';
import type { Task } from '@/types/task';
import { shownStart } from '@/utils/taskDates';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

function calendarData(): string {
  const day = (n: number) => `(0||${n}()(${n >= 2 && n <= 6 ? '(0||0(s|08:00|f|17:00)())' : ''}))`;
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
}
const XER = [
  'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData()}`,
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
  '%R\tP1\tGebruikstest\tC1\t2026-03-02 08:00\t2026-01-05 08:00\t2026-06-30 17:00\tY',
  '%T\tSCHEDOPTIONS',
  '%F\tproj_id\tsched_lag_early_start_flag',
  '%R\tP1\tN',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
  '%R\tA1\tP1\tC1\tA1\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t90\t0\t2026-01-05 08:00\t2026-01-16 17:00\t2026-01-05 08:00\t2026-01-16 17:00',
  '%R\tA2\tP1\tC1\tA2\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t90\t45\t2026-02-23 08:00\t2026-03-06 17:00\t2026-02-23 08:00\t',
  '%R\tA3\tP1\tC1\tA3\tLos\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-03-02 08:00\t2026-03-06 17:00\t\t',
  '%R\tA4\tP1\tC1\tA4\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t90\t90\t2026-03-09 08:00\t2026-03-20 17:00\t\t',
  '%R\tM1\tP1\tC1\tM1\tEindmijlpaal\tTT_FinMile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-03-27 17:00\t2026-03-27 17:00\t\t',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tA2\tA1\tP1\tP1\tPR_FS\t0',
  '%R\tR2\tA4\tA2\tP1\tP1\tPR_SS\t40',
  '%R\tR3\tM1\tA4\tP1\tP1\tPR_FS\t0',
  '%R\tR4\tM1\tA3\tP1\tP1\tPR_FS\t0',
  '%E',
].join('\n');

function openXer(): ImportResult {
  const opened = readXER(new TextEncoder().encode(XER));
  if (isMultiDocumentImport(opened)) throw new Error('fixture moet één project openen');
  return opened;
}
type Ctx = ReturnType<typeof createAppStoreContext>;
const timesOf = (tasks: readonly Task[]) =>
  Object.fromEntries([...tasks].sort((a, b) => (a.wbsCode ?? '').localeCompare(b.wbsCode ?? ''))
    .map(task => [task.wbsCode, task.time]));
const m1 = (ctx: Ctx) => ctx.store.getState().tasks.find(task => task.wbsCode === 'M1')!.time;
function switchTo(ctx: Ctx, baseId: 'p6' | 'ops' | 'msproject') {
  const s = ctx.store.getState();
  return s.applySchedulingSettings({
    profile: selectProfile(s.project.schedulingProfile, `builtin:${baseId}`, []),
    options: s.project.schedulingOptions,
  });
}

const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
S().applyOpenedImport(openXer(), { filePath: null, recompute: true });
const freshProfile = JSON.stringify(S().project.schedulingProfile);
const fresh = JSON.stringify(timesOf(S().tasks));
eq('00 uitgangspunt: P6 (A19 aan in de basis), M1 op 27-03 17:00',
  [S().project.schedulingProfile?.id, m1(ctx).earlyStart, m1(ctx).earlyFinish, m1(ctx).lateFinish],
  ['p6', '2026-03-27T17:00', '2026-03-27T17:00', '2026-03-27T17:00']);
S().runCPM();
eq('01 Bereken op de verse opening verandert niets', JSON.stringify(timesOf(S().tasks)), fresh);

for (const other of ['ops', 'msproject'] as const) {
  const away = switchTo(ctx, other);
  eq(`02 ${other}: de bronvelden van M1 blijven het geplande venster uit het bestand`,
    [m1(ctx).scheduleStart, m1(ctx).scheduleFinish], ['2026-03-27T17:00', '2026-03-27T17:00']);
  const back = switchTo(ctx, 'p6');
  eq(`03 ${other}: het profiel is weer het origineel`, JSON.stringify(S().project.schedulingProfile), freshProfile);
  eq(`04 ${other}: elk tijdveld van elke taak is byte-gelijk aan de verse opening`, JSON.stringify(timesOf(S().tasks)), fresh);
  eq(`05 ${other}: M1 eindigt niet vóór zijn start`, m1(ctx).earlyFinish >= m1(ctx).earlyStart, true);
  eq(`06 ${other}: de terugweg verschuift evenveel taken als de heenweg`, back.shifted, away.shifted);
  S().runCPM();
  eq(`07 ${other}: Bereken daarna verandert niets`, JSON.stringify(timesOf(S().tasks)), fresh);
}
S().undo(); S().undo();
const a2 = () => S().tasks.find(task => task.wbsCode === 'A2')!;
eq('08- onder P6 toont A2 haar werkelijke start, haar rekenstart is de restwerkstart (A19)',
  [shownStart(a2()), a2().time.earlyStart], ['2026-02-23T08:00', '2026-03-02T08:00']);
const toOps = switchTo(ctx, 'ops');
eq('08 P6 → OPS: 2 taken verschoven (A4, M1)', toOps.shifted, 2);
eq('08a …en onder OPS staat M1 eerder, niet omgekeerd', [m1(ctx).earlyStart, m1(ctx).earlyFinish],
  ['2026-03-13T17:00', '2026-03-13T17:00']);
eq('08b onder OPS staat A2 op haar werkelijke start (A19 uit)',
  S().tasks.find(task => task.wbsCode === 'A2')!.time.earlyStart, '2026-02-23T08:00');
eq('08c …en dus is haar GETOONDE start in beide profielen gelijk', shownStart(a2()), '2026-02-23T08:00');
eq('09 OPS → P6: 2 taken terug', switchTo(ctx, 'p6').shifted, 2);

switchTo(ctx, 'ops');
const ifc = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
const reopened = createAppStoreContext();
reopened.store.getState().applyOpenedImport(readXerArchiveIFC(ifc), { filePath: null, recompute: true });
eq('10 heropend IFC draagt OPS (standaardprofiel, afwezig)', reopened.store.getState().project.schedulingProfile, undefined);
eq('11 heropend: M1-bronvenster is het geplande venster uit het bestand',
  [m1(reopened).scheduleStart, m1(reopened).scheduleFinish], ['2026-03-27T17:00', '2026-03-27T17:00']);
switchTo(reopened, 'p6');
const reopenedTimes = timesOf(reopened.store.getState().tasks);
const freshTimes = JSON.parse(fresh) as Record<string, Task['time']>;
const pick = (t: Task['time']) => [t.scheduleStart, t.scheduleFinish, t.earlyStart, t.earlyFinish, t.lateStart, t.lateFinish, t.totalFloat, t.freeFloat];
eq('12 heropend en terug naar P6: dezelfde taken', Object.keys(reopenedTimes), Object.keys(freshTimes));
for (const code of Object.keys(freshTimes)) {
  eq(`13 heropend en terug naar P6: ${code} gelijk aan de verse XER-opening`,
    reopenedTimes[code] ? pick(reopenedTimes[code]) : null, pick(freshTimes[code]));
}

if (diffs.length === 0) console.log(`OK  profielwissel-datums (B1): ${checks} checks groen`);
else { console.log(`XX  profielwissel-datums (B1): ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
