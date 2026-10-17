/**
 * Resttempo (eigenaarsbesluit 2026-10-15, optie 1; bron: docs/superpowers/plans/
 * 2026-10-07-review-pr109-uitkomsten.md op `claude/review-pr109-log`, laatste twee punten).
 *
 * Voor werk dat nog moet gebeuren rekent en toont de app met het RESTERENDE tempo (XER
 * `remain_qty_per_hr`, P6 XML `RemainingUnitsPerTime`). Het geplande werk blijft in de drie
 * werkvelden; een toewijzing zonder restwerk houdt het geplande tempo; bij openen rekent de app
 * niets om. De P6 XML-export schrijft het geplande tempo als `PlannedUnitsPerTime`, nooit het
 * resterende.
 *
 * De XER-fixture bootst Roads_Project_TEC.xer na, taak A10530 (DT_FixedDrtn, TK_Active, 9 h):
 * Foreman begroot 10 h bij 1,111/h, rest 306 h bij 34/h; General worker begroot 20 h bij 2,22/h,
 * rest 9 h bij 1/h. Geen corpusbestand in de repo.
 */
import './domStub';
import { installDOMParser } from './xmldom-shim';
import { readXerArchiveIFC } from './xerArchiveTestReader';
import { useAppStore } from '@/state/appStore';
import { readXER } from '@/services/xer/xerReader';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { createExtensionApi } from '@/extensions/extensionApi';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import type { TaskColumnContext } from '@/types/taskGrid';
import { appStoreContext } from '@/state/appStore';
import { importedAssignmentRate } from '@/engine/work/workRuleMapping';
import { assignmentWorkDeviation } from '@/engine/work/assignmentWorkDeviation';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import { assignmentDayUnits } from '@/engine/scheduler/ResourceLoad';
import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

installDOMParser();

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function ok(label: string, cond: unknown): void {
  checks++;
  if (!cond) diffs.push(label);
}
const near = (a: number | undefined, b: number, eps = 1e-6): boolean => a !== undefined && Math.abs(a - b) <= eps;

const T_FOREMAN = 1.11111111111111;
const T_WORKER = 2.22222222222222;

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a) importedAssignmentRate: de keuzeregel --');
{
  eq('a1 restwerk > 0 en een ander resttempo ⇒ resttempo, begroot apart', importedAssignmentRate(T_FOREMAN, 34, 306),
    { unitsPerDay: 34, plannedUnitsPerDay: T_FOREMAN });
  eq('a2 geen restwerk (0) ⇒ begroot tempo', importedAssignmentRate(T_FOREMAN, 34, 0), { unitsPerDay: T_FOREMAN });
  eq('a3 restwerk onbekend ⇒ begroot tempo', importedAssignmentRate(T_FOREMAN, 34, undefined), { unitsPerDay: T_FOREMAN });
  eq('a4 restwerk > 0 maar resttempo 0 ⇒ begroot tempo (geen getal verzinnen)', importedAssignmentRate(T_FOREMAN, 0, 306), { unitsPerDay: T_FOREMAN });
  eq('a5 resttempo ontbreekt ⇒ begroot tempo', importedAssignmentRate(T_FOREMAN, undefined, 306), { unitsPerDay: T_FOREMAN });
  eq('a6 resttempo NaN ⇒ begroot tempo', importedAssignmentRate(T_FOREMAN, Number.NaN, 306), { unitsPerDay: T_FOREMAN });
  eq('a7 XER-afronding op 8 decimalen (Roads 1.77777778) ⇒ hetzelfde tempo, het preciezere getal',
    importedAssignmentRate(1.77777777777778, 1.77777778, 16), { unitsPerDay: 1.77777777777778 });
  eq('a8 XER-afronding op 6 cijfers (rehab-2 1.46667) ⇒ hetzelfde tempo', importedAssignmentRate(1.46666667, 1.46667, 35.2), { unitsPerDay: 1.46666667 });
  eq('a9 een echt klein verschil (42.226 / 42.2267, 1,7e-5) ⇒ resttempo', importedAssignmentRate(42.226, 42.2267, 1013.44),
    { unitsPerDay: 42.2267, plannedUnitsPerDay: 42.226 });
}

// ═══════════════════════════════════════════════════════════════════════════
// Uurkalender 07:00–17:00 ma–vr (zoals de Roads-kalender), dus een uurtaak van 9 h.
const weekBands = '(0||DaysOfWeek()('
  + '(0||2()((0||0(s|07:00|f|17:00)())))'
  + '(0||3()((0||0(s|07:00|f|17:00)())))'
  + '(0||4()((0||0(s|07:00|f|17:00)())))'
  + '(0||5()((0||0(s|07:00|f|17:00)())))'
  + '(0||6()((0||0(s|07:00|f|17:00)())))'
  + '))';
const calendarData = `(0||CalendarData()(${weekBands}(0||Exceptions()())))`;
const xer = [
  'ERMHDR\t23.12\t2026-04-23\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tdef_duration_type\tlast_recalc_date',
  '%R\tP1\tWegen\tCR\tDT_FixedDUR2\t2026-04-23 07:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tCR\tAll Items-5d\tP1\tCA_Project\t10\t50\t${calendarData}`,
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
  // A10530: gestart, 9 h, rest 9 h — de Foreman-situatie.
  '%R\t85140\tP1\tCR\tA10530\tPlacing of Blinding Concrete\tTT_Task\tDT_FixedDrtn\tTK_Active\tCP_Phys\t50\t9\t9\t2026-04-23 07:00\t2026-04-23 16:00\t2026-02-16 07:00\t',
  // A2: voltooid, geen restwerk; het resttempo wijkt af maar telt niet.
  '%R\t85141\tP1\tCR\tA2\tKlaar\tTT_Task\tDT_FixedDrtn\tTK_Complete\tCP_Phys\t100\t8\t0\t2026-04-20 07:00\t2026-04-20 15:00\t2026-04-20 07:00\t2026-04-20 15:00',
  // A3: niet gestart, randgevallen.
  '%R\t85142\tP1\tCR\tA3\tRandgevallen\tTT_Task\tDT_FixedDrtn\tTK_NotStart\tCP_Phys\t0\t9\t9\t2026-04-24 07:00\t2026-04-24 16:00\t\t',
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr\tunit_id',
  '%R\t2969\tForeman\tRT_Labor\tCR\t1\t',
  '%R\t2971\tGeneral worker\tRT_Labor\tCR\t1\t',
  '%R\t2923\tCompactor\tRT_Equip\tCR\t1\t',
  '%R\t3100\tBeton\tRT_Mat\tCR\t1\t',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trsrc_type\ttarget_qty_per_hr\tremain_qty_per_hr\tremain_qty\ttarget_qty\tact_reg_qty\tact_ot_qty',
  '%R\t72605\tP1\t85140\t2969\tRT_Labor\t1.11111111111111\t34\t306\t10\t0\t0',
  '%R\t72607\tP1\t85140\t2971\tRT_Labor\t2.22222222222222\t1\t9\t20\t0\t0',
  // Zelfde tempo, alleen anders afgerond (Roads: 1.77777778 naast 1.77777777777778).
  '%R\t72604\tP1\t85140\t2923\tRT_Equip\t1.77777777777778\t1.77777778\t16\t16\t0\t0',
  // Voltooid: restwerk 0 ⇒ begroot tempo.
  '%R\t72700\tP1\t85141\t2969\tRT_Labor\t1\t0.5\t0\t8\t8\t0',
  // Restwerk > 0 maar resttempo 0 (DCP-03 Baseline) ⇒ begroot tempo.
  '%R\t72701\tP1\t85142\t2971\tRT_Labor\t2\t0\t18\t18\t0\t0',
  // Materiaal met een ander resttempo ⇒ begroot tempo (buiten de werkdriehoek).
  '%R\t72702\tP1\t85142\t3100\tRT_Mat\t3\t5\t45\t27\t0\t0',
  '%E',
].join('\n');

function openXer(text = xer): ImportResult {
  const opened = readXER(new TextEncoder().encode(text));
  if (isMultiDocumentImport(opened)) throw new Error('resttempo-fixture gaf meerdere documenten');
  return opened;
}
const asg = (r: { assignments: ResourceAssignment[] }, sourceId: string): ResourceAssignment => {
  const found = r.assignments.find((a) => a.id === `xer-assignment:${sourceId}`);
  if (!found) throw new Error(`toewijzing ${sourceId} ontbreekt`);
  return found;
};
const hpdOf = (task: Task, calendars: WorkCalendar[], calendar: WorkCalendar): number => taskCalendarHoursPerDay(task, calendars, calendar);

console.log('-- (b) XER-lezer: inzet = resttempo, werkvelden bewaard --');
const opened = openXer();
{
  const foreman = asg(opened, '72605');
  const worker = asg(opened, '72607');
  eq('b1 Foreman: inzet = resttempo 34, begroot tempo bewaard', [foreman.unitsPerDay, foreman.plannedUnitsPerDay], [34, T_FOREMAN]);
  eq('b2 Foreman: drie werkvelden zoals het bestand (10 / 0 / 306 h)',
    [foreman.plannedWorkMinutes, foreman.actualWorkMinutes, foreman.remainingWorkMinutes], [600, 0, 306 * 60]);
  eq('b3 General worker: inzet = resttempo 1, begroot tempo bewaard', [worker.unitsPerDay, worker.plannedUnitsPerDay], [1, T_WORKER]);
  eq('b4 General worker: werkvelden (20 / 0 / 9 h)',
    [worker.plannedWorkMinutes, worker.actualWorkMinutes, worker.remainingWorkMinutes], [1200, 0, 540]);
  const compactor = asg(opened, '72604');
  eq('b5 zelfde tempo anders afgerond ⇒ het begrote getal, geen apart begroot tempo',
    [compactor.unitsPerDay, 'plannedUnitsPerDay' in compactor], [1.77777777777778, false]);
  const done = asg(opened, '72700');
  eq('b6 toewijzing zonder restwerk ⇒ begroot tempo, geen apart begroot tempo', [done.unitsPerDay, 'plannedUnitsPerDay' in done], [1, false]);
  const rate0 = asg(opened, '72701');
  eq('b7 restwerk zonder resttempo ⇒ begroot tempo', [rate0.unitsPerDay, 'plannedUnitsPerDay' in rate0], [2, false]);
  const mat = asg(opened, '72702');
  eq('b8 materiaal houdt het begrote tempo (× uren per dag, 10)', [mat.unitsPerDay, 'plannedUnitsPerDay' in mat], [30, false]);
  const sources = opened.xer?.resources?.assignments ?? [];
  const foremanSource = sources.find((s) => s.sourceId === '72605');
  eq('b9 het bronarchief houdt beide tarieven', [foremanSource?.quantities.remainingPerHour, foremanSource?.quantities.targetPerHour], [34, T_FOREMAN]);
}

console.log('-- (c) geen waarschuwingsteken bij het resttempo --');
{
  const task = opened.tasks.find((t) => t.wbsCode === 'A10530');
  if (!task) throw new Error('A10530 ontbreekt');
  const hpd = hpdOf(task, opened.resourceCalendars ?? [], opened.calendar);
  eq('c0 voorwaarde: uurtaak van 9 h met rest 9 h', [task.time.durationUnit, task.time.durationMinutes, task.time.remainingMinutes], ['hours', 540, 540]);
  const foreman = asg(opened, '72605');
  const worker = asg(opened, '72607');
  eq('c1 Foreman: geen waarschuwing (34 × 9 h = 306 h)', assignmentWorkDeviation(task, foreman.unitsPerDay, foreman.remainingWorkMinutes, hpd, false), null);
  eq('c2 General worker: geen waarschuwing (1 × 9 h = 9 h)', assignmentWorkDeviation(task, worker.unitsPerDay, worker.remainingWorkMinutes, hpd, false), null);
  // Tegenproef: met het begrote tempo zou de waarschuwing er wél staan (zoals vóór dit besluit).
  eq('c3 tegenproef: begroot tempo 1,111 naast 306 h ⇒ waarschuwing 306 / 10',
    assignmentWorkDeviation(task, foreman.plannedUnitsPerDay!, foreman.remainingWorkMinutes, hpd, false), { stored: 306, derived: 10 });
}

console.log('-- (d) bij openen rekent de app niets om: belasting = opgeslagen werk --');
{
  const task = opened.tasks.find((t) => t.wbsCode === 'A10530')!;
  const foreman = asg(opened, '72605');
  const hpdMinutes = hpdOf(task, opened.resourceCalendars ?? [], opened.calendar) * 60;
  const before = { ...foreman, unitsPerDay: foreman.plannedUnitsPerDay! };
  const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0) * hpdMinutes;
  eq('d1 de belasting van de Foreman verandert niet door het andere tempo (laag 3: opgeslagen werk)',
    JSON.stringify(assignmentDayUnits(task, foreman, hpdMinutes, null, [foreman])),
    JSON.stringify(assignmentDayUnits(task, before, hpdMinutes, null, [before])));
  ok('d2 en ze telt 306 h', near(sum(assignmentDayUnits(task, foreman, hpdMinutes, null, [foreman])), 306 * 60, 1e-6));
}

console.log('-- (e) bewerking: duur 9 → 10 h onder vaste duur en inzet geeft 340 h --');
const S = () => useAppStore.getState();
const OPEN_OPTIONS = { filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: true } as const;
{
  S().applyOpenedImport(openXer(), OPEN_OPTIONS);
  const task = S().tasks.find((t) => t.wbsCode === 'A10530')!;
  eq('e0 voorwaarde: werkregel vaste duur en inzet (DT_FixedDrtn)', task.workRule, 'FIXED_DURATION_RATE');
  S().updateTask(task.id, { time: { ...task.time, durationMinutes: 600 } });
  const after = S().tasks.find((t) => t.id === task.id)!;
  const foreman = S().assignments.find((a) => a.id === 'xer-assignment:72605')!;
  const worker = S().assignments.find((a) => a.id === 'xer-assignment:72607')!;
  eq('e1 duur 10 h, rest 10 h', [after.time.durationMinutes, after.time.remainingMinutes], [600, 600]);
  eq('e2 Foreman: inzet blijft 34, restwerk 34 × 10 h = 340 h (zoals P6)', [foreman.unitsPerDay, foreman.remainingWorkMinutes], [34, 340 * 60]);
  eq('e3 General worker: 1 × 10 h = 10 h', [worker.unitsPerDay, worker.remainingWorkMinutes], [1, 600]);
  eq('e4 begroot werk en begroot tempo blijven referentie', [foreman.plannedWorkMinutes, foreman.plannedUnitsPerDay], [600, T_FOREMAN]);
}

console.log('-- (f) P6 XML-export: het begrote tempo als PlannedUnitsPerTime --');
let exported = '';
{
  S().applyOpenedImport(openXer(), OPEN_OPTIONS);
  const s = S();
  exported = writeP6XML(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments, s.calendars);
  ok('f1 Foreman: PlannedUnitsPerTime = begroot 1,111', exported.includes(`<PlannedUnitsPerTime>${T_FOREMAN}</PlannedUnitsPerTime>`));
  ok('f2 Foreman: RemainingUnitsPerTime = 34', exported.includes('<RemainingUnitsPerTime>34</RemainingUnitsPerTime>'));
  ok('f3 het resttempo staat nooit als PlannedUnitsPerTime', !exported.includes('<PlannedUnitsPerTime>34</PlannedUnitsPerTime>'));
  ok('f4 General worker: begroot 2,22 en rest 1',
    exported.includes(`<PlannedUnitsPerTime>${T_WORKER}</PlannedUnitsPerTime>`) && exported.includes('<RemainingUnitsPerTime>1</RemainingUnitsPerTime>'));
  eq('f5 alleen de twee toewijzingen met een eigen resttempo krijgen RemainingUnitsPerTime',
    (exported.match(/<RemainingUnitsPerTime>/g) ?? []).length, 2);
  ok('f6 schemavolgorde: RemainingUnits vóór RemainingUnitsPerTime vóór ResourceObjectId',
    /<RemainingUnits>306<\/RemainingUnits>\s*<RemainingUnitsPerTime>34<\/RemainingUnitsPerTime>\s*<ResourceObjectId>/.test(exported));
}

console.log('-- (g) P6 XML-lezer: spiegel van de XER-lezer --');
{
  const back = readP6XML(exported);
  const resId = (name: string) => back.resources.find((r) => r.name === name)?.id;
  const task = back.tasks.find((t) => t.name === 'Placing of Blinding Concrete')!;
  const foreman = back.assignments.find((a) => a.taskId === task.id && a.resourceId === resId('Foreman'))!;
  const worker = back.assignments.find((a) => a.taskId === task.id && a.resourceId === resId('General worker'))!;
  eq('g1 Foreman na XER → P6 XML → app: inzet 34, begroot 1,111', [foreman.unitsPerDay, foreman.plannedUnitsPerDay], [34, T_FOREMAN]);
  eq('g2 General worker: inzet 1, begroot 2,22', [worker.unitsPerDay, worker.plannedUnitsPerDay], [1, T_WORKER]);
  eq('g3 werkvelden reizen mee', [foreman.plannedWorkMinutes, foreman.remainingWorkMinutes], [600, 306 * 60]);
  const hpd = hpdOf(task, back.resourceCalendars ?? [], back.calendar);
  eq('g4 geen waarschuwing na de P6 XML-route', assignmentWorkDeviation(task, foreman.unitsPerDay, foreman.remainingWorkMinutes, hpd, false), null);
  // Tweede export is gelijk aan de eerste: geen drift in de P6 XML-route.
  const again = writeP6XML(back.project, back.calendar, back.tasks, back.sequences, back.resources, back.assignments, back.resourceCalendars ?? []);
  eq('g5 P6 XML → app → P6 XML: dezelfde tempo-elementen',
    (again.match(/<(Planned|Remaining)UnitsPerTime>[^<]*</g) ?? []).sort(), (exported.match(/<(Planned|Remaining)UnitsPerTime>[^<]*</g) ?? []).sort());

  // Losse lezercases: een P6 XML zonder `plannedUnitsPerDay`-route (OPS-model met inzet = begroot),
  // waarin we het resttempo met de hand zetten. Zo toetst dit de lezer, niet de writer.
  const s = S();
  const plain = s.assignments.map((a) => {
    const { plannedUnitsPerDay, ...rest } = a;
    return plannedUnitsPerDay !== undefined ? { ...rest, unitsPerDay: plannedUnitsPerDay } : rest;
  });
  const base = writeP6XML(s.project, s.calendar, s.tasks, s.sequences, s.resources, plain, s.calendars);
  ok('g6 voorwaarde: de basis heeft geen RemainingUnitsPerTime', !base.includes('RemainingUnitsPerTime'));
  const foremanRead = (xml: string) => {
    const r = readP6XML(xml);
    const t = r.tasks.find((x) => x.name === 'Placing of Blinding Concrete')!;
    const id = r.resources.find((x) => x.name === 'Foreman')!.id;
    return r.assignments.find((a) => a.taskId === t.id && a.resourceId === id)!;
  };
  const withRest = (units: string, rate: string) => base.replace('<RemainingUnits>306</RemainingUnits>',
    `<RemainingUnits>${units}</RemainingUnits><RemainingUnitsPerTime>${rate}</RemainingUnitsPerTime>`);
  ok('g7 voorwaarde: het patchpunt bestaat', base.includes('<RemainingUnits>306</RemainingUnits>'));
  const r1 = foremanRead(withRest('306', '34'));
  eq('g8 RemainingUnitsPerTime 34 bij restwerk 306 ⇒ inzet 34, begroot 1,111', [r1.unitsPerDay, r1.plannedUnitsPerDay], [34, T_FOREMAN]);
  const r2 = foremanRead(withRest('0', '34'));
  eq('g9 restwerk 0 ⇒ begroot tempo', [r2.unitsPerDay, 'plannedUnitsPerDay' in r2], [T_FOREMAN, false]);
  const r3 = foremanRead(withRest('306', '0'));
  eq('g10 resttempo 0 ⇒ begroot tempo', [r3.unitsPerDay, 'plannedUnitsPerDay' in r3], [T_FOREMAN, false]);
  const r4 = foremanRead(base);
  eq('g11 geen RemainingUnitsPerTime ⇒ begroot tempo (zoals vroeger)', [r4.unitsPerDay, 'plannedUnitsPerDay' in r4], [T_FOREMAN, false]);

  // Review #361 punt 2: geen bruikbaar begroot tempo (PlannedUnitsPerTime 0) maar wel een resttempo.
  // Dan is het resttempo ook het begrote, zoals in de XER-lezer; de lezer verzint geen begroot tempo 1.
  const plannedPatch = `<PlannedUnitsPerTime>${T_FOREMAN}</PlannedUnitsPerTime>`;
  ok('g12 voorwaarde: het begrote tempo van de Foreman staat één keer in de basis', base.split(plannedPatch).length === 2);
  const zonderBegroot = (xml: string) => xml.replace(plannedPatch, '<PlannedUnitsPerTime>0</PlannedUnitsPerTime>');
  const r5 = foremanRead(zonderBegroot(withRest('306', '34')));
  eq('g13 PlannedUnitsPerTime 0 en resttempo 34 ⇒ inzet 34, geen apart begroot tempo', [r5.unitsPerDay, 'plannedUnitsPerDay' in r5], [34, false]);
  const xerZonderBegroot = openXer(xer.replace(`\t2969\tRT_Labor\t${T_FOREMAN}\t34\t`, '\t2969\tRT_Labor\t0\t34\t'));
  const xerForeman = asg(xerZonderBegroot, '72605');
  eq('g14 dezelfde gegevens in XER (target 0, rest 34) geven hetzelfde', [xerForeman.unitsPerDay, 'plannedUnitsPerDay' in xerForeman], [34, false]);
  const r6 = foremanRead(zonderBegroot(base));
  eq('g15 PlannedUnitsPerTime 0 zonder resttempo ⇒ de oude terugval 1', [r6.unitsPerDay, 'plannedUnitsPerDay' in r6], [1, false]);

  // Review #361 punt 3: materiaal houdt in de P6 XML-lezer het begrote tempo, zoals in XER (b8).
  // Mutatiebewijs: de materiaaluitzondering in `p6xmlReader.ts` uit ⇒ g17 rood (inzet 50).
  const materiaal = /(<PlannedUnitsPerTime>30<\/PlannedUnitsPerTime>\s*<ProjectObjectId>\d+<\/ProjectObjectId>)(\s*<ResourceObjectId>)/;
  ok('g16 voorwaarde: het materiaalblok (Beton, 30 per dag) staat in de basis', materiaal.test(base));
  const metMateriaalRest = base.replace(materiaal, '$1<RemainingUnits>45</RemainingUnits><RemainingUnitsPerTime>50</RemainingUnitsPerTime>$2');
  const mr = readP6XML(metMateriaalRest);
  const betonId = mr.resources.find((x) => x.name === 'Beton')?.id;
  const beton = mr.assignments.find((a) => a.resourceId === betonId);
  eq('g17 materiaal met restwerk en een ander resttempo ⇒ inzet blijft 30, geen apart begroot tempo',
    [mr.resources.find((x) => x.id === betonId)?.type, beton?.unitsPerDay, beton ? 'plannedUnitsPerDay' in beton : 'ontbreekt'],
    ['MATERIAL', 30, false]);
}

console.log('-- (h) P6 XML geopend in de app: duur 9 → 10 h geeft 340 h --');
{
  S().applyOpenedImport(readP6XML(exported), OPEN_OPTIONS);
  const task = S().tasks.find((t) => t.name === 'Placing of Blinding Concrete')!;
  const foremanId = S().resources.find((r) => r.name === 'Foreman')!.id;
  eq('h0 voorwaarde: werkregel en uurtaak', [task.workRule, task.time.durationUnit, task.time.durationMinutes], ['FIXED_DURATION_RATE', 'hours', 540]);
  S().updateTask(task.id, { time: { ...task.time, durationMinutes: 600 } });
  const foreman = S().assignments.find((a) => a.taskId === task.id && a.resourceId === foremanId)!;
  eq('h1 Foreman: 34 × 10 h = 340 h', [foreman.unitsPerDay, foreman.remainingWorkMinutes], [34, 340 * 60]);
}

console.log('-- (i) IFC: beide tempo\'s en het bronarchief overleven opslaan en openen --');
{
  const reloaded = readXerArchiveIFC(writeIFC(opened));
  const task = reloaded.tasks.find((t) => t.wbsCode === 'A10530')!;
  const foremanId = reloaded.resources.find((r) => r.name === 'Foreman')!.id;
  const foreman = reloaded.assignments.find((a) => a.taskId === task.id && a.resourceId === foremanId)!;
  eq('i1 inzet 34 en begroot 1,111 na IFC', [foreman.unitsPerDay, foreman.plannedUnitsPerDay], [34, T_FOREMAN]);
  eq('i2 werkvelden na IFC', [foreman.plannedWorkMinutes, foreman.remainingWorkMinutes], [600, 306 * 60]);
  const source = reloaded.xer?.resources?.assignments.find((s) => s.sourceId === '72605');
  eq('i3 bronarchief na IFC: remain_qty_per_hr en target_qty_per_hr intact',
    [source?.quantities.remainingPerHour, source?.quantities.targetPerHour], [34, T_FOREMAN]);
  const compactorId = reloaded.resources.find((r) => r.name === 'Compactor')!.id;
  const compactor = reloaded.assignments.find((a) => a.taskId === task.id && a.resourceId === compactorId)!;
  eq('i4 zonder apart begroot tempo schrijft IFC geen veld', 'plannedUnitsPerDay' in compactor, false);
}

console.log('-- (j) MSPDI: één Units per toewijzing; lezen verandert niet --');
{
  S().applyOpenedImport(openXer(), OPEN_OPTIONS);
  const st = S();
  const xml = writeMSPDI(st.project, st.calendar, st.tasks, st.sequences, st.resources, st.assignments, st.calendars);
  const back = readMSPDI(xml);
  const foremanId = back.resources.find((r) => r.name === 'Foreman')?.id;
  const task = back.tasks.find((t) => t.name === 'Placing of Blinding Concrete');
  const foreman = back.assignments.find((a) => a.taskId === task?.id && a.resourceId === foremanId);
  eq('j1 MSPDI kent geen begroot tempo: geen apart veld na lezen', foreman ? 'plannedUnitsPerDay' in foreman : 'ontbreekt', false);
  eq('j2 MSPDI Units = de inzet (het resttempo), consistent met RemainingWork 306 h', [foreman?.unitsPerDay, foreman?.remainingWorkMinutes], [34, 306 * 60]);
}

console.log('-- (l) tabelkolom: begroot tempo in dezelfde opmaak als de inzet --');
// Review #361 punt 4: de gids belooft `Naam: getal` zonder afronding, net als de inzetkolom.
{
  const task = opened.tasks.find((t) => t.wbsCode === 'A10530')!;
  const ctx: TaskColumnContext = {
    projectId: opened.project.id,
    tasksById: new Map(opened.tasks.map((t) => [t.id, t] as const)),
    relationIndex: buildTaskRelationIndex(opened.tasks, opened.sequences),
    assignmentsByTaskId: new Map([[task.id, opened.assignments.filter((a) => a.taskId === task.id)]]),
    resourcesById: new Map(opened.resources.map((r) => [r.id, r] as const)),
    baselinesById: new Map(),
    scheduleStale: false,
  };
  const registry = buildTaskColumnRegistry({ projectId: opened.project.id, activityCodeTypes: [], customFieldDefs: [], baselines: [] });
  const text = (id: string) => {
    const column = registry.find((c) => c.id === id)!;
    return column.format(column.read(task, ctx), task, ctx);
  };
  // Weergave op hooguit twee decimalen (eigenaar 2026-10-15); de opslag blijft exact (b1–b5).
  eq('l1 Begrote eenheden per dag: alleen de toewijzingen met een apart begroot tempo, op twee decimalen',
    text('assignment.plannedUnits'), 'Foreman: 1.11; General worker: 2.22');
  eq('l2 de inzetkolom toont het resttempo in dezelfde opmaak',
    text('assignment.unitsPerDay'), 'Foreman: 34; General worker: 1; Compactor: 1.78');
  // Met de app-taal het decimaalteken van die taal; de bewerktekst blijft exact (geen stille afronding bij Enter).
  const nlCtx = { ...ctx, numberLocale: 'nl' };
  const unitsColumn = registry.find((c) => c.id === 'assignment.unitsPerDay')!;
  eq('l3 inzetkolom in nl: komma als decimaalteken',
    unitsColumn.format(unitsColumn.read(task, nlCtx), task, nlCtx), 'Foreman: 34; General worker: 1; Compactor: 1,78');
  eq('l4 bewerktekst van de inzetkolom blijft exact',
    unitsColumn.editText?.(task, ctx).includes('1.77777777777778'), true);
}

console.log('-- (k) extensie: lees-wijzig-laad houdt het begrote tempo (review #361 punt 1) --');
// `api.data.loadProject(get*())` op hetzelfde project. Het begrote tempo is niet publiek; zonder de
// `assignments`-regel in `retainActiveDocument` schreef de P6 XML-export daarna het resttempo 34 als
// `PlannedUnitsPerTime`. Mutatiebewijs: die regel weg ⇒ k1, k2 en k3 rood.
{
  S().applyOpenedImport(openXer(), OPEN_OPTIONS);
  const api = createExtensionApi('resttempo-k', [], undefined, appStoreContext, { app: appStoreContext, showNotification: () => {} });
  const lees = () => ({
    project: api.data.getProject(), calendar: api.data.getCalendar(), tasks: api.data.getTasks(),
    sequences: api.data.getSequences(), resources: api.data.getResources(), assignments: api.data.getAssignments(),
  });
  const foreman = () => S().assignments.find((a) => a.id === 'xer-assignment:72605');
  const tempo = (xml: string) => (xml.match(/<(Planned|Remaining)UnitsPerTime>[^<]*</g) ?? []).sort();
  const projectId = S().project.id;
  ok('k0 voorwaarde: het contract draagt het begrote tempo niet', api.data.getAssignments().every((a) => !('plannedUnitsPerDay' in a)));
  api.data.loadProject(lees());
  eq('k1 Foreman na een ongewijzigde lees-wijzig-laad: inzet 34, begroot 1,111, zelfde project',
    [foreman()?.unitsPerDay, foreman()?.plannedUnitsPerDay, S().project.id], [34, T_FOREMAN, projectId]);
  const st = S();
  const xml = writeP6XML(st.project, st.calendar, st.tasks, st.sequences, st.resources, st.assignments, st.calendars);
  ok('k2 P6 XML daarna: PlannedUnitsPerTime blijft 1,111, nooit 34',
    xml.includes(`<PlannedUnitsPerTime>${T_FOREMAN}</PlannedUnitsPerTime>`) && !xml.includes('<PlannedUnitsPerTime>34</PlannedUnitsPerTime>'));
  eq('k3 dezelfde tempo-elementen als de export vóór de extensie (f)', tempo(xml), tempo(exported));

  // De extensie wijzigt de inzet: het begrote tempo blijft referentie, zoals bij een wijziging in de app.
  const gewijzigd = lees();
  gewijzigd.assignments = gewijzigd.assignments.map((a) => (a.id === 'xer-assignment:72605' ? { ...a, unitsPerDay: 30 } : a));
  api.data.loadProject(gewijzigd);
  eq('k4 extensie zet de inzet op 30 ⇒ inzet 30, begroot blijft 1,111', [foreman()?.unitsPerDay, foreman()?.plannedUnitsPerDay], [30, T_FOREMAN]);

  // Een ander project-id is een nieuw project: dan geldt alleen wat de extensie meestuurt.
  const ander = lees();
  ander.project = { ...ander.project, id: 'ander-project-resttempo' };
  api.data.loadProject(ander);
  eq('k5 ander project-id ⇒ geen begroot tempo van het vorige document', foreman() ? 'plannedUnitsPerDay' in foreman()! : 'ontbreekt', false);
}

if (diffs.length > 0) {
  console.log(`XX  check-resttempo: ${diffs.length}/${checks} checks rood`);
  for (const d of diffs) console.log(`XX    ${d}`);
  process.exit(1);
}
console.log(`OK  check-resttempo: ${checks} checks groen`);
