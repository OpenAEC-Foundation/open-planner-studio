/**
 * Regressiegevallen uit de review van PR #393 (XER-schrijver, issue #391): acht BLOKKEERT-punten.
 * Elk geval was rood vóór de fix en is groen erna.
 *
 *  R1  Een UDF-definitie `OPS_TaskDurationUnit` zonder (volledige) markerwaarden verandert de
 *      importmodus niet: zo'n bestand leest precies als zonder die definitie, en de UDF blijft zichtbaar.
 *  R2  Een bestaande P6-projectcode met `OPS:` blijft staan; een project zonder code krijgt geen
 *      `OPS:`-code in de XER.
 *  R3  De geërfde werkregel (projectstandaard) gaat mee als `duration_type`.
 *  R4  Een vaste resourcecapaciteit gaat mee als RSRCRATE `max_qty_per_hr`, ook zonder tarief.
 *  R5  Afgeleid restwerk = restduur × inzet, niet begroot − 0.
 *  R6  Een werkende uitzondering over middernacht houdt haar ochtenddeel op de volgende dag.
 *  R7  Een WBS-summary-activiteit (`TT_WBS`) blijft `TT_WBS`.
 *  R8  Activiteit-ID's blijven na normalisatie uniek en binnen 40 tekens; idem resource- en WBS-codes.
 */
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { writeXER, type XerWriteInput } from '@/services/xer/xerWriter';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { parseXerTables } from '@/services/xer/xerTables';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { parseDate } from '@/utils/dateUtils';
import { remainingMinutesOf } from '@/engine/work/workRuleApply';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment } from '@/types/resource';

declare const process: { exit(code: number): never };

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function ok(label: string, value: unknown): void { eq(label, Boolean(value), true); }

const enc = (text: string) => new TextEncoder().encode(text);
function read(bytes: Uint8Array): XerReadResult {
  const parsed = readXER(bytes);
  if (isMultiDocumentImport(parsed)) throw new Error('meerdere projecten');
  return parsed;
}
function xer(lines: string[]): Uint8Array { return enc(`${lines.join('\r\n')}\r\n`); }
/** De rijen van één tabel als cellenkaarten. */
function rowsOf(bytes: Uint8Array, name: string): Record<string, string>[] {
  return (parseXerTables(bytes).tables.get(name)?.rows ?? []).map(r => ({ ...r.cells }));
}
/** Een geïmporteerde planning zonder bron-/diagnosevelden, voor een "leest precies gelijk"-vergelijking. */
function planOf(r: ImportResult): unknown {
  return {
    project: { ...r.project, createdAt: undefined, modifiedAt: undefined },
    // Eigen-veldwaarden op taken tellen hier niet: die horen juist zichtbaar te blijven (R1c/R1f).
    calendar: r.calendar, calendars: r.resourceCalendars ?? [], tasks: r.tasks.map(t => ({ ...t, customFields: undefined })), sequences: r.sequences,
    resources: r.resources, assignments: r.assignments,
  };
}

const CAL = '(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|16:00)())))(0||3()((0||0(s|08:00|f|16:00)())))(0||4()((0||0(s|08:00|f|16:00)())))(0||5()((0||0(s|08:00|f|16:00)())))(0||6()((0||0(s|08:00|f|16:00)())))(0||7()())))(0||Exceptions()())))';
const BASE = [
  'ERMHDR\t23.12\t2026-04-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${CAL}`,
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tplan_start_date\tplan_end_date',
  '%R\tP1\tPRJ\tC1\t2026-06-01 08:00\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA100\tOchtend\tTT_Task\tDT_FixedDrtn\tTK_NotStart\t4\t4\t2026-06-01 08:00\t2026-06-01 12:00',
  '%R\tT2\tP1\tC1\tA200\tNormaal\tTT_Task\tDT_FixedDrtn\tTK_NotStart\t80\t80\t2026-06-01 08:00\t2026-06-12 16:00',
];
const UDFTYPE_DEF = [
  '%T\tUDFTYPE',
  '%F\tudf_type_id\ttable_name\tudf_type_name\tudf_type_label\tlogical_data_type',
  '%R\t77\tTASK\tuser_field_77\tOPS_TaskDurationUnit\tFT_TEXT',
];

// ── R1: een UDF-definitie alleen verandert niets ─────────────────────────────────────────────────
{
  const plain = read(xer([...BASE, '%E']));
  const withDef = read(xer([...BASE, ...UDFTYPE_DEF, '%E']));
  const ochtend = withDef.tasks.find(t => t.name === 'Ochtend')!;
  eq('R1a urentaak blijft urentaak (eenheid, minuten)', [ochtend.time.durationUnit, ochtend.time.durationMinutes], ['hours', 240]);
  eq('R1b planning gelijk aan hetzelfde bestand zonder de UDF-definitie', planOf(withDef), planOf(plain));
  ok('R1c de UDF-definitie blijft zichtbaar als eigen veld', (withDef.customFieldDefs ?? []).some(d => d.name === 'OPS_TaskDurationUnit'));

  // Een OPS-export waarin één activiteit geen markerwaarde heeft (in P6 toegevoegd): leest als een
  // gewone P6-XER (alle OPS-markeringen eruit gehaald), en de UDF's blijven zichtbaar.
  const project = createDefaultProject();
  project.id = 'proj-r1'; project.name = 'R1'; project.startDate = '2026-06-01';
  const calendar: WorkCalendar = {
    id: 'cal', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  const tasks: Task[] = ['Een', 'Twee'].map((name, i) => ({
    id: `t${i}`, name, description: '', wbsCode: `A${i}`, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2026-06-01', 3),
  }));
  const written = writeXER({ project, calendar, calendars: [calendar], tasks, sequences: [], resources: [], assignments: [], exportDate: '2026-10-20' });
  const lines = written.text.split('\r\n');
  const udfValueStart = lines.indexOf('%T\tUDFVALUE');
  ok('R1d de export draagt markerwaarden', udfValueStart > 0);
  // Haal de markerwaarde van de eerste taak weg.
  const taskValue = lines.findIndex((l, i) => i > udfValueStart && l.startsWith('%R\t') && l.split('\t')[1] === '900000001');
  const partial = lines.filter((_, i) => i !== taskValue).join('\r\n');
  // Hetzelfde bestand zonder UDFTYPE/UDFVALUE: zo leest de lezer het als gewone P6-XER.
  const stripped: string[] = [];
  let skip = false;
  for (const l of lines) {
    if (l.startsWith('%T\t')) skip = l === '%T\tUDFTYPE' || l === '%T\tUDFVALUE';
    if (!skip) stripped.push(l);
  }
  const partialRead = read(enc(partial));
  eq('R1e onvolledige markerwaarden ⇒ leest als gewone P6-XER', planOf(partialRead), planOf(read(enc(stripped.join('\r\n')))));
  ok('R1f onvolledige markerwaarden ⇒ de UDF\'s blijven zichtbaar', (partialRead.customFieldDefs ?? []).some(d => d.name === 'OPS_TaskDurationUnit'));
  // Volledig: wordt herkend (dagtaak blijft dagtaak) en de markeringen zijn geen eigen veld.
  const full = read(written.bytes);
  eq('R1g volledige markerwaarden ⇒ dagtaak blijft dagtaak', full.tasks.find(t => t.name === 'Een')?.time.durationUnit, 'days');
  ok('R1h volledige markerwaarden ⇒ geen eigen veld', !(full.customFieldDefs ?? []).some(d => d.name.startsWith('OPS_')));
}

// ── R2: projectcode met OPS: ─────────────────────────────────────────────────────────────────────
{
  const bytes = xer(BASE.map(l => l.replace('\tPRJ\t', '\tOPS:BRUG\t')).concat('%E'));
  const r = read(bytes);
  eq('R2a OPS:BRUG blijft de documentcode', documentProjectCode(r.project, r.xer), 'OPS:BRUG');
  const w = writeXER({ project: r.project, calendar: r.calendar, calendars: r.resourceCalendars ?? [], tasks: r.tasks, sequences: r.sequences,
    resources: r.resources, assignments: r.assignments, projectCode: documentProjectCode(r.project, r.xer), exportDate: '2026-10-20' });
  eq('R2b de export schrijft OPS:BRUG terug', rowsOf(w.bytes, 'PROJECT')[0].proj_short_name, 'OPS:BRUG');
  // Een project zonder code: geen OPS:-code, en na heropenen toont de app alleen de naam.
  const project = createDefaultProject();
  project.id = 'proj-zonder'; project.name = 'Brug Zuid';
  const calendar: WorkCalendar = { id: 'cal', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] };
  const task: Task = { id: 't', name: 'Taak', description: '', wbsCode: 'A', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2026-06-01', 2) };
  const w2 = writeXER({ project, calendar, calendars: [calendar], tasks: [task], sequences: [], resources: [], assignments: [], exportDate: '2026-10-20' });
  const code = rowsOf(w2.bytes, 'PROJECT')[0].proj_short_name;
  ok('R2c geen OPS:-code voor een project zonder code', !code.startsWith('OPS:'));
  const back = read(w2.bytes);
  eq('R2d heropend: documentnaam is de projectnaam', nameWithProjectCode(back.project.name, documentProjectCode(back.project, back.xer)), 'Brug Zuid');
}

// ── Gedeeld synthetisch project voor R3–R8 ──────────────────────────────────────────────────────
function baseInput(): XerWriteInput & { tasks: Task[]; resources: Resource[]; assignments: ResourceAssignment[]; calendars: WorkCalendar[] } {
  const project = createDefaultProject();
  project.id = 'proj-rv'; project.name = 'Review'; project.startDate = '2026-06-01'; project.statusDate = '2026-06-08';
  const calendar: WorkCalendar = { id: 'cal', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] };
  return { project, calendar, calendars: [calendar], tasks: [], sequences: [], resources: [], assignments: [], exportDate: '2026-10-20' };
}
let n = 0;
function leaf(name: string, days: number, extra: Partial<Task> = {}): Task {
  return { id: `t${++n}`, name, description: '', wbsCode: `A${n}`, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2026-06-01', days), ...extra };
}

// ── R3: geërfde werkregel ───────────────────────────────────────────────────────────────────────
{
  const input = baseInput();
  input.project.defaultWorkRule = 'FIXED_WORK';
  input.tasks.push(leaf('Geërfd', 5));
  const w = writeXER(input);
  eq('R3a duration_type = Vast werk (DT_FixedQty)', rowsOf(w.bytes, 'TASK')[0].duration_type, 'DT_FixedQty');
  eq('R3b heropend: werkregel FIXED_WORK', read(w.bytes).tasks.find(t => t.name === 'Geërfd')?.workRule, 'FIXED_WORK');
}

// ── R4: vaste capaciteit ─────────────────────────────────────────────────────────────────────────
{
  const input = baseInput();
  input.tasks.push(leaf('Werk', 5));
  input.resources.push({ id: 'r1', name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 3, costPerHour: 50 });
  input.resources.push({ id: 'r2', name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 2 });
  const w = writeXER(input);
  const rates = rowsOf(w.bytes, 'RSRCRATE');
  const rsrc = rowsOf(w.bytes, 'RSRC');
  const rateOf = (name: string) => rates.find(r => r.rsrc_id === rsrc.find(x => x.rsrc_name === name)?.rsrc_id);
  eq('R4a met tarief: max_qty_per_hr = 3', rateOf('Ploeg')?.max_qty_per_hr, '3');
  eq('R4b zonder tarief: toch een capaciteitsrij met 2', rateOf('Kraan')?.max_qty_per_hr, '2');
  const back = read(w.bytes);
  eq('R4c heropend: maxUnits 3 en 2', [back.resources.find(r => r.name === 'Ploeg')?.maxUnits, back.resources.find(r => r.name === 'Kraan')?.maxUnits], [3, 2]);
}

// ── R5: afgeleid restwerk ────────────────────────────────────────────────────────────────────────
{
  const input = baseInput();
  const t = leaf('Half', 10, { status: 'STARTED' });
  t.time.actualStart = '2026-06-01'; t.time.completion = 0.5;
  input.tasks.push(t);
  input.resources.push({ id: 'r1', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1 });
  input.assignments.push({ id: 'a1', taskId: t.id, resourceId: 'r1', unitsPerDay: 1 });
  const w = writeXER(input);
  const tr = rowsOf(w.bytes, 'TASKRSRC')[0];
  eq('R5a begroot, rest, verricht (uren)', [tr.target_qty, tr.remain_qty, tr.act_reg_qty], ['80', '40', '40']);
  const back = read(w.bytes);
  const a = back.assignments[0];
  const backTask = back.tasks.find(x => x.name === 'Half')!;
  // Effectief restwerk zoals de werkregelbrug het ziet (`remainingWorkOf`): het veld, anders restduur × inzet.
  const effectiveRemaining = a?.remainingWorkMinutes ?? remainingMinutesOf(backTask, { hoursPerDay: 8 }) * (a?.unitsPerDay ?? 0);
  eq('R5b heropend: effectief restwerk 2400 min, verricht 2400 min', [effectiveRemaining, a?.actualWorkMinutes], [2400, 2400]);
}

// ── R6: werkende uitzondering over middernacht ───────────────────────────────────────────────────
{
  const input = baseInput();
  input.calendar = {
    ...input.calendar,
    workTime: { byWeekday: { 1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [] } },
    workingExceptions: [{ name: 'Nachtploeg', startDate: '2026-06-06', endDate: '2026-06-06', bands: [{ start: 1320, end: 1800 }] }],
  };
  input.calendars = [input.calendar];
  input.tasks.push(leaf('Taak', 5, { time: { ...createDefaultTaskTime('2026-06-01', 5), durationUnit: 'hours', durationMinutes: 2400 } }));
  const minutes = (cal: WorkCalendar) => new CalendarEngine(calendarForEngine(cal))
    .workMinutesBetween(parseDate('2026-06-06'), new Date(parseDate('2026-06-08').getTime()));
  const before = minutes(input.calendar);
  const back = read(writeXER(input).bytes);
  eq('R6a werkminuten za+zo vóór de export', before, 480);
  eq('R6b werkminuten za+zo na heropenen', minutes(back.calendar), before);
}

// ── R7: WBS-summary-activiteit ───────────────────────────────────────────────────────────────────
{
  const input = baseInput();
  input.tasks.push(leaf('Samenvattend', 5, { p6ActivityType: 'TT_WBS' }));
  const w = writeXER(input);
  eq('R7a task_type TT_WBS', rowsOf(w.bytes, 'TASK')[0].task_type, 'TT_WBS');
  eq('R7b heropend: TT_WBS', read(w.bytes).tasks.find(t => t.name === 'Samenvattend')?.p6ActivityType, 'TT_WBS');
}

// ── R8: codes na normalisatie uniek en binnen de grens ───────────────────────────────────────────
{
  const input = baseInput();
  const long = 'X'.repeat(40);
  input.tasks.push(leaf('Lang 1', 1, { wbsCode: long }), leaf('Lang 2', 1, { wbsCode: long }));
  input.tasks.push(leaf('Tab', 1, { wbsCode: 'A\tB' }), leaf('Spatie', 1, { wbsCode: 'A B' }));
  input.resources.push({ id: 'r1', name: 'R\tX', type: 'LABOR', description: '', maxUnits: 1 }, { id: 'r2', name: 'R X', type: 'LABOR', description: '', maxUnits: 1 });
  const w = writeXER(input);
  const codes = rowsOf(w.bytes, 'TASK').map(r => r.task_code);
  ok('R8a alle activiteit-ID\'s ≤ 40 tekens', codes.every(c => Array.from(c).length <= 40));
  eq('R8b activiteit-ID\'s uniek', new Set(codes).size, codes.length);
  const shortNames = rowsOf(w.bytes, 'RSRC').map(r => r.rsrc_short_name);
  eq('R8c resourcecodes uniek na normalisatie', new Set(shortNames).size, shortNames.length);
  ok('R8d het verslag telt de aangepaste codes', (w.loss.find(l => l.code === 'changedIds')?.count ?? 0) >= 3);
  const back = read(w.bytes);
  eq('R8e heropend: vier taken', back.tasks.filter(t => t.childIds.length === 0).length, 4);
}

// ── Ronde 2, C: materiaalcapaciteit op dezelfde uurschaal als de materiaalinzet ─────────────────
{
  const input = baseInput();
  const t = leaf('Storten', 2);
  input.tasks.push(t);
  input.resources.push({ id: 'beton', name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 80, unitOfMeasure: 'm3' });
  input.resources.push({ id: 'zand', name: 'Zand', type: 'MATERIAL', description: '', maxUnits: 80, unitOfMeasure: 'm3',
    availabilitySteps: [{ from: '2026-06-01', maxUnits: 40 }] });
  input.assignments.push({ id: 'a1', taskId: t.id, resourceId: 'beton', unitsPerDay: 80 });
  input.assignments.push({ id: 'a2', taskId: t.id, resourceId: 'zand', unitsPerDay: 40 });
  const w = writeXER(input);
  const rsrc = rowsOf(w.bytes, 'RSRC');
  const idOf = (name: string) => rsrc.find(r => r.rsrc_name === name)?.rsrc_id;
  const rate = (name: string) => Number(rowsOf(w.bytes, 'RSRCRATE').find(r => r.rsrc_id === idOf(name))?.max_qty_per_hr);
  const use = (name: string) => Number(rowsOf(w.bytes, 'TASKRSRC').find(r => r.rsrc_id === idOf(name))?.target_qty_per_hr);
  eq('C1 vaste capaciteit: capaciteit/inzet in de XER = 80/80 (volledig bezet)', rate('Beton') / use('Beton'), 1);
  eq('C2 capaciteitsstap: capaciteit/inzet in de XER = 40/40', rate('Zand') / use('Zand'), 1);
}

// ── Ronde 2, E1: de effectieve projectstandaard, ook zonder eigen keuze ──────────────────────────
{
  const input = baseInput();
  input.tasks.push(leaf('Gewoon', 3));
  eq('E1 zonder projectstandaard: def_duration_type = DT_FixedDrtn (FIXED_DURATION_RATE)', rowsOf(writeXER(input).bytes, 'PROJECT')[0].def_duration_type, 'DT_FixedDrtn');
}

if (diffs.length === 0) {
  console.log(`OK  xer-writer-review: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  xer-writer-review: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
