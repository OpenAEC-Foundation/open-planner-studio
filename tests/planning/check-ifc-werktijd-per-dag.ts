import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { ImportResult } from '@/services/importTypes';

declare const process: { exit(code: number): never };

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}

type Band = { start: number; end: number };
type Day = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const DAYS: readonly Day[] = [1, 2, 3, 4, 5, 6, 7];
const week = (m: Partial<Record<Day, Band[]>>): WorkTimeBands =>
  ({ byWeekday: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], ...m } });
const on = (days: Day[], bands: Band[]): Partial<Record<Day, Band[]>> =>
  Object.fromEntries(days.map((d) => [d, bands.map((b) => ({ ...b }))]));

const project = { ...createDefaultProject(), id: 'proj-b7', calendarId: 'cal-b7', startDate: '2026-06-01' };
function hourCal(name: string, workTime: WorkTimeBands, scalar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay'>): WorkCalendar {
  const workDays = DAYS.filter((d) => workTime.byWeekday[d].length > 0);
  return { id: 'cal-b7', name, description: '', workDays, holidays: [], workTime, ...scalar };
}
function write(cal: WorkCalendar, tasks: Task[] = []): string {
  const input: ImportResult = { project, calendar: cal, tasks, sequences: [], resources: [], assignments: [] };
  return writeIFC(input);
}
function shape(c: WorkCalendar) {
  return {
    workDays: [...c.workDays], workStartHour: c.workStartHour, workEndHour: c.workEndHour, hoursPerDay: c.hoursPerDay,
    byWeekday: c.workTime ? DAYS.map((d) => (c.workTime!.byWeekday[d] ?? []).map((b) => [b.start, b.end])) : null,
  };
}

type Entity = { type: string; args: string[] };
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === "'" && s[i + 1] === "'") cur += s[++i];
      else if (ch === "'") quote = false;
      continue;
    }
    if (ch === "'") { quote = true; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function parseStep(ifc: string): Map<string, Entity> {
  const map = new Map<string, Entity>();
  for (const line of ifc.split('\n')) {
    const m = /^#(\d+)=([A-Z0-9]+)\((.*)\);$/.exec(line.trim());
    if (m) map.set(m[1], { type: m[2], args: splitTop(m[3]) });
  }
  return map;
}
const refs = (s: string): string[] => [...s.matchAll(/#(\d+)/g)].map((m) => m[1]);
const ints = (s: string): number[] => s.replace(/[()]/g, '').split(',').filter(Boolean).map(Number);
const unq = (s: string): string => s.replace(/^'|'$/g, '');
const workingTimesIndex = (calArgs: string[]): number => (calArgs.length === 9 ? 6 : 5);
function workingTimes(ifc: string) {
  const e = parseStep(ifc);
  const cal = [...e.values()].find((x) => x.type === 'IFCWORKCALENDAR')!;
  return refs(cal.args[workingTimesIndex(cal.args)]).map((id) => {
    const wt = e.get(id)!;
    const rec = e.get(refs(wt.args[3])[0])!;
    const periods = refs(rec.args[7]).map((p) => e.get(p)!.args.map(unq).join('-'));
    return { id, name: unq(wt.args[0]), dates: `${wt.args[4]},${wt.args[5]}`, days: ints(rec.args[2]), periods };
  });
}
function opsCalendarProp(ifc: string, name: string): string | undefined {
  const line = ifc.split('\n').find((l) => l.includes(`IFCPROPERTYSINGLEVALUE('${name}'`));
  return line ? /,\$,IFC[A-Z]+\((.*)\),\$\);$/.exec(line)?.[1] : undefined;
}

const MA_DO_PAUZE = [{ start: 420, end: 720 }, { start: 750, end: 960 }];
const CASES: [string, WorkCalendar][] = [
  ['korte vrijdag', hourCal('Korte vrijdag',
    week({ ...on([1, 2, 3, 4], [{ start: 420, end: 900 }]), 5: [{ start: 420, end: 660 }] }),
    { workStartHour: 7, workEndHour: 15, hoursPerDay: 8 })],
  ['zaterdag met een ander blok', hourCal('Zaterdag',
    week({ ...on([1, 2, 3, 4, 5], MA_DO_PAUZE), 6: [{ start: 480, end: 720 }] }),
    { workStartHour: 7, workEndHour: 16, hoursPerDay: 8.5 })],
  ['drie groepen', hourCal('Drie groepen',
    week({ ...on([1, 2, 3, 4], MA_DO_PAUZE), 5: [{ start: 420, end: 720 }, { start: 750, end: 870 }], 6: [{ start: 480, end: 720 }] }),
    { workStartHour: 7, workEndHour: 16, hoursPerDay: 8.5 })],
  ['nachtploeg die per dag verschilt', hourCal('Nacht',
    week({ ...on([1, 2, 3, 4], [{ start: 1320, end: 1800 }]), 5: [{ start: 1320, end: 1680 }] }),
    { workStartHour: 22, workEndHour: 24, hoursPerDay: 8 })],
  ['blok tot 24:00 per dag', hourCal('Avond',
    week({ ...on([1, 2, 3, 4, 5], [{ start: 960, end: 1440 }]), 6: [{ start: 960, end: 1200 }] }),
    { workStartHour: 16, workEndHour: 24, hoursPerDay: 8 })],
  ['zondag die afwijkt', hourCal('Zondag',
    week({ ...on([1, 2, 3, 4, 5], MA_DO_PAUZE), 7: [{ start: 600, end: 840 }] }),
    { workStartHour: 7, workEndHour: 16, hoursPerDay: 8.5 })],
  ['nachtploeg van MS Project (eerste werkdag wijkt af)', hourCal('Night Shift',
    week({ 1: [{ start: 1380, end: 1440 }],
      ...on([2, 3, 4, 5], [{ start: 0, end: 180 }, { start: 240, end: 480 }, { start: 1380, end: 1440 }]),
      6: [{ start: 0, end: 180 }, { start: 240, end: 480 }] }),
    { workStartHour: 23, workEndHour: 24, hoursPerDay: 8 })],
  ['IFC 4.3 figuur 1 (ma–do 08–12 + 13–17, vr 08–14)', hourCal('IFC figuur 1',
    week({ ...on([1, 2, 3, 4], [{ start: 480, end: 720 }, { start: 780, end: 1020 }]), 5: [{ start: 480, end: 840 }] }),
    { workStartHour: 8, workEndHour: 17, hoursPerDay: 8 })],
];
const caseCal = (label: string): WorkCalendar => CASES.find(([l]) => l.startsWith(label))![1];
for (const [label, cal] of CASES) {
  const ifc1 = write(cal);
  const rt1 = readIFC(ifc1).calendar;
  same(`§1 ${label}: kalender ongewijzigd na opslaan en heropenen`, shape(rt1), shape(cal));
  const rt2 = readIFC(write({ ...rt1, id: cal.id })).calendar;
  same(`§1 ${label}: tweede round-trip gelijk aan de eerste`, shape(rt2), shape(rt1));
}

{
  const ifc = write(CASES[0][1]);
  const wts = workingTimes(ifc);
  same('§2 korte vrijdag: WorkingTimes = twee groepen zonder datum, geen terugvalweek',
    wts.map((w) => ({ name: w.name, dates: w.dates, days: w.days, periods: w.periods })), [
      { name: 'Standard work week (Mon, Tue, Wed, Thu)', dates: '$,$', days: [1, 2, 3, 4], periods: ['07:00:00-15:00:00'] },
      { name: 'Standard work week (Fri)', dates: '$,$', days: [5], periods: ['07:00:00-11:00:00'] },
    ]);
  same('§2 korte vrijdag: geen STEP-id-markering in OPS_Calendar', opsCalendarProp(ifc, 'LegacyWorkTimeIds'), undefined);
  same('§2 korte vrijdag: WorkStartHour/WorkEndHour altijd geschreven bij meer groepen',
    [opsCalendarProp(ifc, 'WorkStartHour'), opsCalendarProp(ifc, 'WorkEndHour')], ['7.', '15.']);
}

function calendarLines(ifc: string): string[] {
  const keep = /=IFC(TIMEPERIOD|RECURRENCEPATTERN|WORKTIME|WORKCALENDAR)\(|'OPS_Calendar'|IFCPROPERTYSINGLEVALUE\('(WorkStartHour|WorkEndHour|HoursPerDay|IsHourCalendar|LiteralTimes|LegacyWorkTimeIds|SimpleBreakStart|SimpleBreakDuration)'/;
  const lines = ifc.split('\n').map((l) => l.trim()).filter((l) => keep.test(l));
  const base = Number(/^#(\d+)=/.exec(lines[0])![1]);
  return lines.map((l) => l.replace(/#(\d+)/g, (_, n: string) => (Number(n) >= base ? `#+${Number(n) - base}` : '#<')));
}
const uniformWeek = hourCal('Uniforme uurweek', week(on([1, 2, 3, 4, 5], MA_DO_PAUZE)),
  { workStartHour: 7, workEndHour: 16, hoursPerDay: 8.5 });
const uniformWeekUnsorted = hourCal('Uniforme uurweek',
  week({ ...on([1, 3, 4, 5], MA_DO_PAUZE), 2: [...MA_DO_PAUZE].reverse() }), { workStartHour: 7, workEndHour: 16, hoursPerDay: 8.5 });
const dayCal: WorkCalendar = {
  id: 'cal-b7', name: 'Dagkalender', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [{ name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' }],
};
const hourTask: Task = {
  id: 't-uur', name: 'Urentaak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime('2026-06-01', 4, 'hours', dayCal),
};
const UNIFORM_GOLDEN = [
    "#+0=IFCTIMEPERIOD('07:00:00','12:00:00');",
    "#+1=IFCTIMEPERIOD('12:30:00','16:00:00');",
    "#+2=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,$,$,(#+0,#+1));",
    "#+3=IFCWORKTIME('Standard work week',.PREDICTED.,$,#+2,$,$);",
    "#+4=IFCWORKCALENDAR('2uNGXnRewWtJPOazG2o4_7',#<,'Uniforme uurweek',$,$,$,(#+3),$,.FIRSTSHIFT.);",
    "#+5=IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.T.),$);",
    "#+6=IFCPROPERTYSINGLEVALUE('WorkEndHour',$,IFCREAL(16.),$);",
    "#+7=IFCPROPERTYSINGLEVALUE('IsHourCalendar',$,IFCBOOLEAN(.T.),$);",
    "#+8=IFCPROPERTYSET('263IQ2FKK_eiUDl$xw9qpv',#<,'OPS_Calendar',$,(#+5,#+6,#+7));",
];
const GOLDEN: [string, () => string, string[]][] = [
  ['uniforme uurweek', () => write(uniformWeek), UNIFORM_GOLDEN],
  ['uniforme uurweek, blokken van dinsdag in andere volgorde', () => write(uniformWeekUnsorted), UNIFORM_GOLDEN],
  ['dagkalender zonder blokken', () => write(dayCal), [
    "#+0=IFCTIMEPERIOD('07:00:00','16:00:00');",
    "#+1=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,$,$,(#+0));",
    "#+2=IFCWORKTIME('Standard work week',.PREDICTED.,$,#+1,$,$);",
    "#+3=IFCWORKTIME('Kerst',.PREDICTED.,$,$,'2026-12-25','2026-12-26');",
    "#+4=IFCWORKCALENDAR('2uNGXnRewWtJPOazG2o4_7',#<,'Dagkalender',$,$,$,(#+2),(#+3),.FIRSTSHIFT.);",
    "#+5=IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(8.),$);",
    "#+6=IFCPROPERTYSET('263IQ2FKK_eiUDl$xw9qpv',#<,'OPS_Calendar',$,(#+5));",
  ]],
  ['scalaire kalender met urentaak (gematerialiseerde blokken)', () => write(dayCal, [hourTask]), [
    "#+0=IFCTIMEPERIOD('07:00:00','12:00:00');",
    "#+1=IFCTIMEPERIOD('13:00:00','16:00:00');",
    "#+2=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,$,$,(#+0,#+1));",
    "#+3=IFCWORKTIME('Standard work week',.PREDICTED.,$,#+2,$,$);",
    "#+4=IFCWORKTIME('Kerst',.PREDICTED.,$,$,'2026-12-25','2026-12-26');",
    "#+5=IFCWORKCALENDAR('2uNGXnRewWtJPOazG2o4_7',#<,'Dagkalender',$,$,$,(#+3),(#+4),.FIRSTSHIFT.);",
    "#+6=IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.T.),$);",
    "#+7=IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(8.),$);",
    "#+8=IFCPROPERTYSINGLEVALUE('WorkEndHour',$,IFCREAL(16.),$);",
    "#+9=IFCPROPERTYSINGLEVALUE('IsHourCalendar',$,IFCBOOLEAN(.F.),$);",
    "#+10=IFCPROPERTYSET('263IQ2FKK_eiUDl$xw9qpv',#<,'OPS_Calendar',$,(#+6,#+7,#+8,#+9));",
  ]],
];
for (const [label, writeFor, want] of GOLDEN) {
  same(`§4 ${label}: kalenderregels gelijk aan main (op de schemaverschillen na)`, calendarLines(writeFor()), want);
}

type Dates = [string | null, string | null];
function foreignIfc(
  layout: 8 | 9,
  groups: [number[], [string, string][], Dates?][],
  opts: { exceptions?: [string, string, string][]; predefinedType?: string } = {},
): string {
  const lines: string[] = [];
  let id = 100;
  const wtIds: number[] = [];
  const dateArg = (d: string | null) => (d ? `'${d}'` : '$');
  for (const [days, periods, dates] of groups) {
    const tps = periods.map(([s, e]) => { lines.push(`#${++id}=IFCTIMEPERIOD('${s}:00','${e}:00');`); return id; });
    lines.push(`#${++id}=IFCRECURRENCEPATTERN(.WEEKLY.,$,(${days.join(',')}),$,$,$,$,(${tps.map((t) => `#${t}`).join(',')}));`);
    const dateArgs = dates ? `${dateArg(dates[0])},${dateArg(dates[1])}` : '$,$';
    lines.push(`#${++id}=IFCWORKTIME('Werktijd',.PREDICTED.,$,#${id - 1},${dateArgs});`);
    wtIds.push(id);
  }
  const excIds = (opts.exceptions ?? []).map(([name, start, end]) => {
    lines.push(`#${++id}=IFCWORKTIME('${name}',.PREDICTED.,$,$,'${start}','${end}');`);
    return id;
  });
  const list = (ids: number[]) => (ids.length > 0 ? `(${ids.map((w) => `#${w}`).join(',')})` : '$');
  const args = ["'3Ext0000000000000000000'", '$', "'Extern'", '$', '$', ...(layout === 9 ? ['$'] : []),
    list(wtIds), list(excIds), opts.predefinedType ?? '.FIRSTSHIFT.'];
  lines.push(`#${++id}=IFCWORKCALENDAR(${args.join(',')});`);
  return `ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
{
  const calArgs = (layout: 8 | 9) => splitTop(/IFCWORKCALENDAR\((.*)\);/.exec(foreignIfc(layout, []))![1]).length;
  same('§5 testvoorwaarde: IfcWorkCalendar met 9 en met 8 attributen', [calArgs(9), calArgs(8)], [9, 8]);
}
for (const layout of [9, 8] as const) {
  const L = `[${layout} attributen]`;
  const read = (groups: Parameters<typeof foreignIfc>[1], opts?: Parameters<typeof foreignIfc>[2]) =>
    readIFC(foreignIfc(layout, groups, opts)).calendar;
  const c = read([[[1, 2, 3, 4, 5], [['08:00', '12:00']]], [[1, 2, 3, 4, 5], [['13:00', '17:00']]]]);
  same(`§5a ${L} één IFCWORKTIME per tijdvak: beide tijdvakken op elke werkdag`, shape(c), {
    workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17, hoursPerDay: 8,
    byWeekday: DAYS.map((d) => (d <= 5 ? [[480, 720], [780, 1020]] : [])),
  });
  const d = read([[[1, 2, 3, 4], [['07:00', '15:00']]], [[5], [['07:00', '11:00']]]]);
  same(`§5b ${L} dag-modus: werkdagen = vereniging van de groepen`, shape(d),
    { workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15, hoursPerDay: 8, byWeekday: null });
  const o = read([[[1, 2, 3, 4], [['07:00', '12:00'], ['12:30', '16:00']]], [[5], [['07:00', '11:00']]], [[5], [['08:00', '11:30']]]]);
  same(`§5c ${L} overlap op één weekdag: de vereniging van de tijdvakken`, o.workTime?.byWeekday[5], [{ start: 420, end: 690 }]);
  const s = read([[[1, 2, 3, 4, 5], [['08:00', '12:00'], ['13:00', '17:00']]], [[7], [['10:00', '14:00']]]]);
  same(`§5d ${L} scalaire dag = eerste werkdag met blokken (zondag eerst)`, [s.workStartHour, s.workEndHour], [10, 14]);

  const BASIS: [number[], [string, string][]] = [[1, 2, 3, 4, 5], [['08:00', '12:00'], ['13:00', '17:00']]];
  const basis = shape(read([BASIS]));
  const zomer = read([BASIS, [[1, 2, 3, 4, 5], [['07:00', '16:00']], ['2026-04-01', '2026-09-30']]]);
  same(`§5e ${L} zomerweek met datum naast een basisweek: alleen de basisweek telt`, shape(zomer), basis);
  const seizoen = read([
    [[1, 2, 3, 4, 5], [['07:00', '16:00']], ['2026-04-01', '2026-09-30']],
    [[1, 2, 3, 4, 5], [['08:00', '17:00']], ['2026-10-01', '2027-03-31']],
  ]);
  same(`§5f ${L} alleen een zomer- en een winterweek met datum: het eerste patroon (07–16, 9 u)`, shape(seizoen),
    { workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 9, byWeekday: null });
  const eenWeek = read([[[1, 2, 3, 4, 5], [['08:00', '16:00']], ['2026-01-01', '2027-12-31']]]);
  same(`§5f2 ${L} alleen één week met datum: die week (08–16)`, shape(eenWeek),
    shape(read([[[1, 2, 3, 4, 5], [['08:00', '16:00']]]])));
  same(`§5f2 ${L} testvoorwaarde: 08–16 is niet de standaardweek`, [eenWeek.workStartHour, eenWeek.workEndHour], [8, 16]);
  const zaterdag = read([BASIS, [[6], [['08:00', '12:00']], ['2026-06-13', '2026-06-13']]]);
  same(`§5g ${L} losse werkzaterdag met datum: zaterdag blijft vrij`, [shape(zaterdag), zaterdag.workDays], [basis, [1, 2, 3, 4, 5]]);
  same(`§5g ${L} losse werkzaterdag met datum: geen feestdag`, zaterdag.holidays, []);
  const alleenStart = read([BASIS, [[6], [['08:00', '12:00']], ['2026-06-13', null]]]);
  same(`§5h ${L} werkzaterdag met alleen een StartDate: zaterdag blijft vrij`, [shape(alleenStart), alleenStart.workDays], [basis, [1, 2, 3, 4, 5]]);
  const alleenEind = read([BASIS, [[6], [['08:00', '12:00']], [null, '2026-06-13']]]);
  same(`§5h ${L} werkzaterdag met alleen een FinishDate: zaterdag blijft vrij`, [shape(alleenEind), alleenEind.workDays], [basis, [1, 2, 3, 4, 5]]);
  const KORT: [number[], [string, string][]] = [[1, 2, 3, 4], [['07:00', '15:00']]];
  const VR: [number[], [string, string][]] = [[5], [['07:00', '11:00']]];
  same(`§5j ${L} terugvalweek van main (1900-01-01) doet niet mee`,
    shape(read([[[1, 2, 3, 4, 5], [['07:00', '15:00']], ['1900-01-01', '1900-01-01']], KORT, VR])), shape(read([KORT, VR])));
  const metUitzondering = read([BASIS], { exceptions: [['Kerst', '2026-12-25', '2026-12-26']], predefinedType: '.SECONDSHIFT.' });
  same(`§5i ${L} feestdag uit ExceptionTimes en ploeg uit PredefinedType`,
    [metUitzondering.holidays, metUitzondering.shift, shape(metUitzondering)],
    [[{ name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' }], 'SECOND', basis]);
}

{
  const MA_DO = [{ start: 420, end: 720 }, { start: 750, end: 930 }];
  const cal = hourCal('Korte vrijdag met pauze', week({ ...on([1, 2, 3, 4], MA_DO), 5: [{ start: 420, end: 660 }] }),
    { workStartHour: 7, workEndHour: 15.5, hoursPerDay: 8 });
  const rt = readIFC(write(cal)).calendar;
  same('§6 de pauze (12:00–12:30) staat na heropenen in de blokken van ma–do, vrijdag houdt één blok',
    [1, 2, 3, 4, 5].map((d) => rt.workTime?.byWeekday[d as Day]), [MA_DO, MA_DO, MA_DO, MA_DO, [{ start: 420, end: 660 }]]);
  same('§6 hoursPerDay = modale dagsom (ma–do 8 u, vr 4 u)', rt.hoursPerDay, 8);
  const finish = new CalendarEngine(rt).addWorkMinutes(new Date('2026-06-04T07:00:00Z'), 16 * 60);
  same('§6 urentaak van 16 u vanaf do 07:00 eindigt ma 11:00 (niet vr 15:30)', finish.toISOString(), '2026-06-08T11:00:00.000Z');
}

const renumber = (ifc: string, shift: number): string => ifc.replace(/#(\d+)/g, (_, n: string) => `#${Number(n) + shift}`);
function dropOpsCalendarPset(ifc: string): string {
  const psetIds = new Set(ifc.split('\n').flatMap((l) => {
    const m = /^#(\d+)=IFCPROPERTYSET\(.*'OPS_Calendar'/.exec(l.trim());
    return m ? [m[1]] : [];
  }));
  return ifc.split('\n').filter((l) => {
    const m = /^#(\d+)=(IFCPROPERTYSET|IFCRELDEFINESBYPROPERTIES)\((.*)\);$/.exec(l.trim());
    if (!m) return true;
    if (m[2] === 'IFCPROPERTYSET') return !psetIds.has(m[1]);
    return !psetIds.has(refs(splitTop(m[3])[5] ?? '')[0] ?? '');
  }).join('\n');
}
{
  const shifted = renumber(write(caseCal('korte vrijdag')), 1000);
  same('§7 testvoorwaarde: de id\'s zijn echt verschoven', Number(/\n#(\d+)=/.exec(shifted)![1]) > 1000, true);
  same('§7 testvoorwaarde: zonder pset staat er geen OPS_Calendar meer in',
    dropOpsCalendarPset(write(caseCal('korte vrijdag'))).includes("'OPS_Calendar'"), false);
}
for (const [label, cal] of CASES) {
  same(`§7a ${label}: hernummerde STEP-id's (+1000) lezen exact`,
    shape(readIFC(renumber(write(cal), 1000)).calendar), shape(cal));
  same(`§7b ${label}: zonder OPS_Calendar dezelfde werkdagen`,
    readIFC(dropOpsCalendarPset(write(cal))).calendar.workDays, cal.workDays);
}
for (const label of ['IFC 4.3 figuur 1', 'nachtploeg van MS Project']) {
  const cal = caseCal(label);
  same(`§7c ${label}: zonder OPS_Calendar exact`, shape(readIFC(dropOpsCalendarPset(write(cal))).calendar), shape(cal));
  same(`§7c ${label}: hernummerd én zonder OPS_Calendar exact`,
    shape(readIFC(renumber(dropOpsCalendarPset(write(cal)), 1000)).calendar), shape(cal));
}

if (failures.length > 0) {
  for (const f of failures) console.log(`   XX ${f}`);
  console.log(`XX  ifc-werktijd-per-dag: ${failures.length} van ${checks} controles rood`);
  process.exit(1);
}
console.log(`OK  ifc-werktijd-per-dag: alle ${checks} controles groen`);
