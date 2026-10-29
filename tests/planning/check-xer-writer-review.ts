/**
 * Regressiegevallen uit de review van PR #393 (XER-schrijver, issue #391): de BLOKKEERT-punten.
 * Elk geval was rood vóór de fix en is groen erna.
 *
 *  R1  De OPS-eenheid geldt PER TAAK (T15, zoals de P6 XML-lezer; `xerOpsMarkers.ts`). Een definitie
 *      `OPS_TaskDurationUnit` zonder waarden verandert niets aan de planning. Een activiteit zonder waarde
 *      (later in P6 toegevoegd) leest als op main, en de andere activiteiten blijven dagtaken (ronde 2,
 *      punt A). Een OPS-definitie is nooit een eigen veld van de gebruiker, net als in de P6 XML-lezer.
 *  RB  Een hernummerde kalender (P6 nummert `clndr_id` om) houdt haar eigen werktijd: de kalenders lezen
 *      met de gewone regels, zonder OPS-markering die naar een kalendernummer wijst (ronde 2, punt B).
 *  RD  Een vaste resourcecapaciteit blijft na heropenen vast: *Max. eenheden* bepaalt daarna weer de
 *      capaciteit (ronde 2, punt D; `OPS_FlatCapacity`).
 *  RE  De standaardwerkregel van het project komt terug (ronde 2, punt E2; `OPS_DefaultWorkRule`).
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
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
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

// ── R1: de OPS-eenheid per taak ──────────────────────────────────────────────────────────────────
{
  const plain = read(xer([...BASE, '%E']));
  const withDef = read(xer([...BASE, ...UDFTYPE_DEF, '%E']));
  const ochtend = withDef.tasks.find(t => t.name === 'Ochtend')!;
  eq('R1a urentaak blijft urentaak (eenheid, minuten)', [ochtend.time.durationUnit, ochtend.time.durationMinutes], ['hours', 240]);
  eq('R1b planning gelijk aan hetzelfde bestand zonder de UDF-definitie', planOf(withDef), planOf(plain));
  // Herschreven (oude opzet: "de definitie blijft zichtbaar als eigen veld"). Een OPS-definitie is nooit een
  // eigen veld van de gebruiker, net als in de P6 XML-lezer; de planning verandert er niet door (R1b).
  ok('R1c een OPS-definitie is geen eigen veld', !(withDef.customFieldDefs ?? []).some(d => d.name === 'OPS_TaskDurationUnit'));

  // Een OPS-export waarin één activiteit geen eenheidswaarde heeft (in P6 toegevoegd, of de waarde gewist).
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
  // Hetzelfde bestand zonder UDFTYPE/UDFVALUE: zo leest de lezer het als gewone P6-XER (zoals op main).
  const stripped: string[] = [];
  let skip = false;
  for (const l of lines) {
    if (l.startsWith('%T\t')) skip = l === '%T\tUDFTYPE' || l === '%T\tUDFVALUE';
    if (!skip) stripped.push(l);
  }
  const partialRead = read(enc(partial));
  const plainRead = read(enc(stripped.join('\r\n')));
  const full = read(written.bytes);
  const byName = (r: ImportResult, name: string) => r.tasks.find(t => t.name === name);
  // Herschreven (oude opzet: "onvolledige markerwaarden ⇒ het hele project leest als gewone P6-XER"). Nu per
  // taak (ronde 2, punt A): de taak zonder waarde leest precies als zonder OPS-UDF's.
  eq('R1e taak zonder markerwaarde ⇒ leest als op main', byName(partialRead, 'Een'), byName(plainRead, 'Een'));
  eq('R1e2 taak zonder markerwaarde ⇒ urenmaat', byName(partialRead, 'Een')?.time.durationUnit, 'hours');
  // Herschreven (oude opzet: "onvolledige markerwaarden ⇒ de UDF's blijven zichtbaar"). Nu: de andere taak
  // merkt niets van de taak zonder waarde (ronde 2, punt A).
  eq('R1f de andere taak blijft dagtaak, gelijk aan de volledige export', byName(partialRead, 'Twee'), byName(full, 'Twee'));
  // Volledig: wordt herkend (dagtaak blijft dagtaak) en de markeringen zijn geen eigen veld.
  eq('R1g volledige markerwaarden ⇒ dagtaak blijft dagtaak', full.tasks.find(t => t.name === 'Een')?.time.durationUnit, 'days');
  ok('R1h volledige markerwaarden ⇒ geen eigen veld', !(full.customFieldDefs ?? []).some(d => d.name.startsWith('OPS_')));
  ok('R1h2 onvolledige markerwaarden ⇒ geen eigen veld', !(partialRead.customFieldDefs ?? []).some(d => d.name.startsWith('OPS_')));

  // Ronde 2, punt A: een activiteit die iemand in P6 toevoegt (een nieuwe TASK-rij, zonder OPS-waarde).
  const taskHeader = lines.findIndex(l => l === '%T\tTASK');
  const taskFields = lines[taskHeader + 1].split('\t').slice(1);
  const firstTask = lines[taskHeader + 2].split('\t').slice(1);
  const added = taskFields.map((field, i) => field === 'task_id' ? '777' : field === 'task_code' ? 'P6-NIEUW'
    : field === 'task_name' ? 'Nieuw in P6' : field === 'target_drtn_hr_cnt' || field === 'remain_drtn_hr_cnt' ? '12' : firstTask[i]);
  const withNew = [...lines.slice(0, taskHeader + 2), ['%R', ...added].join('\t'), ...lines.slice(taskHeader + 2)].join('\r\n');
  const newRead = read(enc(withNew));
  eq('A1 een in P6 toegevoegde activiteit leest in de urenmaat', [byName(newRead, 'Nieuw in P6')?.time.durationUnit, byName(newRead, 'Nieuw in P6')?.time.durationMinutes], ['hours', 720]);
  eq('A2 de OPS-taken blijven dagtaken van 3 d', ['Een', 'Twee'].map(name => [byName(newRead, name)?.time.durationUnit, byName(newRead, name)?.time.scheduleDuration]), [['days', 3], ['days', 3]]);
}

// ── Ronde 2, punt B: hernummerde kalender ────────────────────────────────────────────────────────
{
  const project = createDefaultProject();
  project.id = 'proj-rb'; project.name = 'Hernummerd'; project.startDate = '2026-06-01';
  const calendar: WorkCalendar = {
    id: 'cal-week', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  const band = (start: number, end: number) => [{ start, end }];
  const shortFriday: WorkCalendar = {
    id: 'cal-vrijdag', name: 'Korte vrijdag', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
    workTime: { byWeekday: { 1: band(420, 900), 2: band(420, 900), 3: band(420, 900), 4: band(420, 900), 5: band(420, 660), 6: [], 7: [] } },
  };
  const task = (name: string, calendarId?: string): Task => ({
    id: `rb-${name}`, name, description: '', wbsCode: name, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2026-06-01', 5), ...(calendarId ? { calendarId } : {}),
  });
  const written = writeXER({ project, calendar, calendars: [calendar, shortFriday], tasks: [task('Gewoon'), task('Vrijdag', shortFriday.id)],
    sequences: [], resources: [], assignments: [], exportDate: '2026-10-20' });
  // P6 nummert de kalenders om: hier wisselen de twee nummers van plaats, in elke tabel.
  const ids = rowsOf(written.bytes, 'CALENDAR').map(r => r.clndr_id);
  eq('RB0 twee kalenders geschreven', ids.length, 2);
  const swap = new Map([[ids[0], ids[1]], [ids[1], ids[0]]]);
  const out: string[] = [];
  let fields: string[] = [];
  for (const line of written.text.split('\r\n')) {
    if (line.startsWith('%F\t')) fields = line.split('\t');
    if (!line.startsWith('%R\t')) { out.push(line); continue; }
    out.push(line.split('\t').map((cell, i) => fields[i] === 'clndr_id' && swap.has(cell) ? swap.get(cell)! : cell).join('\t'));
  }
  const back = read(enc(out.join('\r\n')));
  const friday = [back.calendar, ...(back.resourceCalendars ?? [])].find(c => c.name === 'Korte vrijdag');
  const minutes = (cal: WorkCalendar | undefined, from: string, to: string) => cal
    ? new CalendarEngine(calendarForEngine(cal)).workMinutesBetween(parseDate(from), parseDate(to)) : -1;
  eq('RB1 korte vrijdag: vrijdag 240 min', minutes(friday, '2026-06-05', '2026-06-06'), 240);
  eq('RB2 korte vrijdag: donderdag 480 min', minutes(friday, '2026-06-04', '2026-06-05'), 480);
  eq('RB3 werkweek: vrijdag 480 min', minutes(back.calendar, '2026-06-05', '2026-06-06'), 480);
  const vrijdag = back.tasks.find(t => t.name === 'Vrijdag');
  eq('RB4 de taak houdt haar kalender en blijft 5 d', [[back.calendar, ...(back.resourceCalendars ?? [])].find(c => c.id === (vrijdag?.calendarId ?? back.calendar.id))?.name,
    vrijdag?.time.durationUnit, vrijdag?.time.scheduleDuration], ['Korte vrijdag', 'days', 5]);
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

// ── Ronde 2, punt D: een vaste capaciteit blijft vast ───────────────────────────────────────────
{
  const input = baseInput();
  input.tasks.push(leaf('Werk', 5));
  input.resources.push({ id: 'ploeg', name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 3 });
  input.resources.push({ id: 'beton', name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 80, unitOfMeasure: 'm3' });
  input.resources.push({ id: 'kraan', name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 2,
    availabilitySteps: [{ from: '2026-06-01', maxUnits: 1 }, { from: '2026-06-08', maxUnits: 2 }] });
  const w = writeXER(input);
  const back = read(w.bytes);
  const res = (r: ImportResult, name: string) => r.resources.find(x => x.name === name)!;
  eq('D1 vaste capaciteit: geen stappen na heropenen', [res(back, 'Ploeg').maxUnits, res(back, 'Ploeg').availabilitySteps], [3, undefined]);
  eq('D2 Max. eenheden naar 5 ⇒ capaciteit 5', maxUnitsOn({ ...res(back, 'Ploeg'), maxUnits: 5 }, '2026-06-03'), 5);
  eq('D3 materiaal: vaste capaciteit 80 per dag, geen stappen', [res(back, 'Beton').maxUnits, res(back, 'Beton').availabilitySteps], [80, undefined]);
  eq('D4 stappen blijven stappen', res(back, 'Kraan').availabilitySteps, [{ from: '2026-06-01', maxUnits: 1 }, { from: '2026-06-08', maxUnits: 2 }]);
  // In P6 gewijzigd: de rij draagt niet meer de geschreven capaciteit ⇒ zoals elk ander bestand (een stap).
  const ploegId = rowsOf(w.bytes, 'RSRC').find(r => r.rsrc_name === 'Ploeg')!.rsrc_id;
  let fields: string[] = [];
  const edited = w.text.split('\r\n').map(line => {
    if (line.startsWith('%F\t')) fields = line.split('\t');
    if (!line.startsWith('%R\t') || fields[1] !== 'rsrc_rate_id') return line;
    const cells = line.split('\t');
    return cells[fields.indexOf('rsrc_id')] === ploegId ? cells.map((c, i) => fields[i] === 'max_qty_per_hr' ? '4' : c).join('\t') : line;
  }).join('\r\n');
  eq('D5 capaciteit in P6 gewijzigd ⇒ een stap, zoals op main', res(read(enc(edited)), 'Ploeg').availabilitySteps?.map(s => s.maxUnits), [4]);
}

// ── Capaciteitsstappen van materiaal (fixronde #393) ─────────────────────────────────────────────
// OPS kent de capaciteit van materiaal per DAG, XER per uur: de schrijver deelt elke stap door de uren per
// dag (review ronde 2, punt C). Zonder meer las `readXER` de stappen per uur terug: 40 en 80 per dag
// werden 5 en 10.
{
  const input = baseInput();
  input.tasks.push(leaf('Storten', 5));
  input.resources.push({ id: 'beton', name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 80, unitOfMeasure: 'm3',
    availabilitySteps: [{ from: '2026-06-01', maxUnits: 40 }, { from: '2026-06-08', maxUnits: 80 }] });
  input.resources.push({ id: 'zand', name: 'Zand', type: 'MATERIAL', description: '', maxUnits: 50, unitOfMeasure: 't',
    availabilitySteps: [{ from: '2026-06-01', maxUnits: 50 }, { from: '2026-06-15', maxUnits: 100 / 3 }] });
  const w = writeXER(input);
  const rates = rowsOf(w.bytes, 'RSRCRATE');
  const betonId = rowsOf(w.bytes, 'RSRC').find(r => r.rsrc_name === 'Beton')!.rsrc_id;
  eq('M0 P6 ziet de capaciteit per uur (40 en 80 per dag op 8 uur)', rates.filter(r => r.rsrc_id === betonId).map(r => Number(r.max_qty_per_hr)), [5, 10]);
  const back = read(w.bytes);
  const res = (r: ImportResult, name: string) => r.resources.find(x => x.name === name)!;
  eq('M1 materiaalstappen komen terug per dag', res(back, 'Beton').availabilitySteps, [{ from: '2026-06-01', maxUnits: 40 }, { from: '2026-06-08', maxUnits: 80 }]);
  eq('M2 een breuk per dag komt exact terug', res(back, 'Zand').availabilitySteps?.map(s => s.maxUnits), [50, 100 / 3]);
  eq('M3 Max. eenheden blijft per dag', res(back, 'Beton').maxUnits, 80);
  ok('M3b de OPS-velden zijn geen eigen veld', !(back.customFieldDefs ?? []).some(d => d.name.startsWith('OPS_')));
  // In P6 gewijzigd: een rij draagt niet meer de geschreven capaciteit ⇒ die rij leest zoals op main (per uur,
  // ongeschaald); de andere rij houdt haar dagwaarde.
  let fields: string[] = [];
  let changed = false;
  const edited = w.text.split('\r\n').map(line => {
    if (line.startsWith('%F\t')) fields = line.split('\t');
    if (!line.startsWith('%R\t') || fields[1] !== 'rsrc_rate_id') return line;
    const cells = line.split('\t');
    if (changed || cells[fields.indexOf('rsrc_id')] !== betonId) return line;
    changed = true;
    return cells.map((c, i) => fields[i] === 'max_qty_per_hr' ? '6' : c).join('\t');
  }).join('\r\n');
  eq('M4 eerste stap in P6 gewijzigd ⇒ die stap zoals op main, de tweede blijft per dag',
    res(read(enc(edited)), 'Beton').availabilitySteps?.map(s => s.maxUnits), [6, 80]);
}

// ── Ronde 2, punt E2: de standaardwerkregel van het project ───────────────────────────────────────
{
  const input = baseInput();
  input.project.defaultWorkRule = 'FIXED_WORK';
  input.tasks.push(leaf('Geërfd', 5));
  const w = writeXER(input);
  eq('E2a heropend: projectstandaard Vast werk', read(w.bytes).project.defaultWorkRule, 'FIXED_WORK');
  const none = baseInput();
  none.tasks.push(leaf('Gewoon', 5));
  eq('E2b zonder eigen keuze: geen projectstandaard na heropenen', read(writeXER(none).bytes).project.defaultWorkRule, undefined);
  // In P6 gewijzigd: `def_duration_type` draagt niet meer het geschreven token ⇒ zoals op main (geen standaard).
  const edited = w.text.replace('\tDT_FixedQty\tQT_Hour\t', '\tDT_FixedRate\tQT_Hour\t');
  ok('E2c (proef) def_duration_type gewijzigd', edited !== w.text);
  eq('E2c def_duration_type in P6 gewijzigd ⇒ geen projectstandaard', read(enc(edited)).project.defaultWorkRule, undefined);
}

if (diffs.length === 0) {
  console.log(`OK  xer-writer-review: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  xer-writer-review: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
