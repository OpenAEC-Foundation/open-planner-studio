// Profielwissel heen en terug geeft dezelfde datums (gebruikstest rekenprofielen 24-09, bevinding B1).
// Exit 0 = groen.
//
// De fout: `applyCpmResult` schreef in uur-modus `scheduleFinish = earlyFinish` terug. De
// P6-conventies lezen `scheduleFinish` als het geplande bronvenster (`target_end_date`), dus de
// uitvoer van de ene berekening werd invoer voor de volgende. Gemeten op deze fixture vóór de fix:
// XER onder P6 → OPS → P6 gaf eindmijlpaal M1 ES 27-03 17:00 / EF 13-03 17:00 (einde vóór start),
// Bereken herstelde het niet, en de teller zei bij de terugweg 4 i.p.v. 3 verschoven taken.
//
// De fixture is de gebruikstest-XER, nagebouwd uit de beschrijving in
// docs/superpowers/plans/2026-09-24-gebruikstest-rekenprofielen-26.md: statusdatum 2026-03-02,
// rem_target_link_flag = Y (A19 per bestand), sched_lag_early_start_flag = N. A1 voltooid, A2 lopend,
// A3 en A4 niet gestart, M1 een eindmijlpaal (TT_FinMile). A1→A2 FS, A2→A4 SS 40 u, A4→M1 FS, A3→M1 FS.
// De wissel loopt via `selectProfile`, dezelfde functie als de keuzelijst in Projectinfo (A19 blijft
// dus staan, zoals in de UI).
//
// Verwachting met de hand afgeleid: onder OPS valt voor A4 de A16-vloer (gepland venster 09-03…20-03)
// weg, dus A4 en M1 schuiven naar voren. A1 (voltooid) schuift sinds eigenaarsvraag 7 (2026-09-23,
// B3 `p6CompletedDataDateWindow` in P6 uit) niet meer: het statusdatumvenster van een voltooide taak
// is onder P6 al weg, dus P6 en OPS geven A1 dezelfde datums. A2 (A19 blijft aan) en A3 (niet gestart,
// statusdatum) houden hun datums: 2 verschoven (vóór vraag 7 waren het er 3, met A1).
// Terug naar P6 draait dezelfde 3 terug, en ELK tijdveld van elke taak is weer byte-gelijk aan de
// verse opening.
//
// Mutatiebewijs: `task.time.scheduleFinish = r.earlyFinish;` terugzetten in applyCpmResult.ts
// (uur-tak) ⇒ 14 van 25 rood: 02, 04, 05 en 07 in beide rondes, 11, en 13 voor alle vijf taken
// (gemeten 2026-09-23).
import { createAppStoreContext } from '@/state/appStore';
import { selectProfile } from '@/state/schedulingProfileDraft';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readXerArchiveIFC } from './xerArchiveTestReader';
import type { Task } from '@/types/task';

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
/** Alle tijdvelden per taak (op wbsCode, zodat een IFC-heropening met nieuwe id's vergelijkbaar blijft). */
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

// 1. Vers geopend onder P6.
const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
S().applyOpenedImport(openXer(), { filePath: null, recompute: true });
const freshProfile = JSON.stringify(S().project.schedulingProfile);
const fresh = JSON.stringify(timesOf(S().tasks));
eq('00 uitgangspunt: P6 met A19 uit het bestand, M1 op 27-03 17:00',
  [S().project.schedulingProfile?.id, m1(ctx).earlyStart, m1(ctx).earlyFinish, m1(ctx).lateFinish],
  ['p6', '2026-03-27T17:00', '2026-03-27T17:00', '2026-03-27T17:00']);
S().runCPM();
eq('01 Bereken op de verse opening verandert niets', JSON.stringify(timesOf(S().tasks)), fresh);

// 2. P6 → OPS → P6 (en P6 → MS Project → P6).
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
// De telling uit de gebruikstest, met de hand afgeleid (kop): A4 en M1 (A1 sinds vraag 7 niet meer).
S().undo(); S().undo(); // terug naar P6 vóór de MS Project-ronde
const toOps = switchTo(ctx, 'ops');
eq('08 P6 → OPS: 2 taken verschoven (A4, M1)', toOps.shifted, 2);
// Onder OPS (A19 blijft aan, C6 en A16 uit): A2 restwerk vanaf 02-03 08:00; A4 SS 40 u (9-urige dagen)
// ⇒ 06-03 12:00, plus 90 u ⇒ 20-03 12:00; M1 (FS) daar. Een gewoon venster, niet omgekeerd.
eq('08a …en onder OPS staat M1 eerder, niet omgekeerd', [m1(ctx).earlyStart, m1(ctx).earlyFinish],
  ['2026-03-20T12:00', '2026-03-20T12:00']);
eq('09 OPS → P6: 2 taken terug', switchTo(ctx, 'p6').shifted, 2);

// 3. "Gaat zo het IFC in": opslaan ná een berekening onder OPS, heropenen, terug naar P6.
switchTo(ctx, 'ops');
const ifc = writeIFC(buildWriteIFCInput(S()));
const reopened = createAppStoreContext();
reopened.store.getState().applyOpenedImport(readXerArchiveIFC(ifc), { filePath: null, recompute: true });
eq('10 heropend IFC draagt OPS (met A19)', reopened.store.getState().project.schedulingProfile?.baseId, 'ops');
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
