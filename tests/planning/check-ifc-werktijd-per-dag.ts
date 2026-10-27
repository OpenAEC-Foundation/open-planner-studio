// B7 (docs/onderhoudbaarheid/deelrapporten/rapport-ifc.md) — werkblokken die per weekdag verschillen,
// door opslaan als IFC en heropenen.
//
// Vóór de fix schreef `writeCalendar` alleen de blokken van de eerste werkdag, en stopte de lezer na de
// eerste `IFCWORKTIME`: een korte vrijdag (ma–do 07–15, vr 07–11) kwam terug als een volle vrijdag. Nu
// krijgt elke groep weekdagen met dezelfde blokken een eigen `IFCWORKTIME` (het model van IFC 4.3,
// `IfcWorkCalendar` figuur 1). Een `IFCWORKTIME` met een datum doet niet mee in de week.
//
// De writer schrijft IfcWorkCalendar met de 9 attributen van het schema; de lezer leest ook de 8 van
// oude OPS-bestanden (§5). Zie docs/ifc-round-trip.md, "Schemageldigheid".
//
//  §1 round-trip per geval: korte vrijdag, zaterdag, drie groepen, nachtploeg per dag, blok tot 24:00,
//     zondag die afwijkt (de scalaire dag is niet de eerste groep), de nachtploeg van MS Project (de
//     eerste werkdag is de afwijkende), IFC 4.3 figuur 1; plus een tweede round-trip.
//  §2 de vorm van het bestand: één `IFCWORKTIME` per groep, zonder datum, in de volgorde van `workDays`;
//     geen terugvalweek (besluit orkestrator 2026-10-13, PR #344).
//  §4 gelijk aan main: een uniforme uurweek (ook met de blokken van één dag in een andere volgorde), een
//     dagkalender zonder blokken en een scalaire kalender met urentaak (gematerialiseerde blokken). De
//     verwachte regels zijn gemaakt met de writer van main 1e192b31a, met bewuste verschillen van de
//     schemafix: REAL met decimale punt, en `Identification` in IfcWorkCalendar. Een andere gewijzigde
//     byte is een fout, geen reden om de verwachting bij te werken.
//  §5 de lezer op bestanden zonder `OPS_Calendar`, in beide indelingen van `IfcWorkCalendar` (9
//     attributen volgens IFC 4.3, 8 in oude OPS-bestanden): één `IFCWORKTIME` per tijdvak, overlap, de
//     dag-modus (vereniging van werkdagen), de scalaire dag (eerste werkdag met blokken, zoals
//     MSPDI/.mpp), en werktijden MET datum (zomer-/winterweek, losse werkzaterdag, alleen een StartDate
//     of alleen een FinishDate): die doen niet mee, tenzij er geen werktijd zonder datum is. Plus de
//     plek van ExceptionTimes en PredefinedType per indeling.
//  §6 afgeleide velden en de motor na heropenen: de pauze in de blokken, `hoursPerDay`, en een urentaak
//     van 16 u vanaf donderdag 07:00 die eindigt op maandag 11:00 (met de oude fout: vrijdag 15:30).
//  §7 robuustheid: STEP-id's hernummerd (zoals een ander pakket kan doen) en een weggevallen
//     `OPS_Calendar`-pset.
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
/** De kalendervelden die de round-trip ongeschonden moet laten; `workTime` per weekdag. */
function shape(c: WorkCalendar) {
  return {
    workDays: [...c.workDays], workStartHour: c.workStartHour, workEndHour: c.workEndHour, hoursPerDay: c.hoursPerDay,
    byWeekday: c.workTime ? DAYS.map((d) => (c.workTime!.byWeekday[d] ?? []).map((b) => [b.start, b.end])) : null,
  };
}

// ── Mini-STEP-lezer voor de vormchecks (alleen DATA-regels `#n=TYPE(args);`) ─────────────────────────
type Entity = { type: string; args: string[] };
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === "'" && s[i + 1] === "'") cur += s[++i]; // '' is een apostrof binnen de string
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
/** Index van `WorkingTimes` in een `IFCWORKCALENDAR`: 6 bij 9 attributen (IFC 4.3, zo schrijft OPS sinds
 *  de schemafix), 5 bij 8 (oude OPS-bestanden). */
const workingTimesIndex = (calArgs: string[]): number => (calArgs.length === 9 ? 6 : 5);
/** De `IFCWORKTIME`'s in `WorkingTimes` van de (enige/eerste) kalender: naam, datums, weekdagen, tijdvakken. */
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 Round-trip per geval
// ════════════════════════════════════════════════════════════════════════════════════════════════
const MA_DO_PAUZE = [{ start: 420, end: 720 }, { start: 750, end: 960 }]; // 07:00–12:00 + 12:30–16:00 (8,5 u)
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
  // De scalaire dag van de lezer (eerste werkdag met blokken, zondag eerst — zoals MSPDI/.mpp) is hier
  // NIET de eerste groep, en de eerste periode geeft de scalar 7 terug. Zonder `WorkStartHour` werd
  // het 10 (de zondag).
  ['zondag die afwijkt', hourCal('Zondag',
    week({ ...on([1, 2, 3, 4, 5], MA_DO_PAUZE), 7: [{ start: 600, end: 840 }] }),
    { workStartHour: 7, workEndHour: 16, hoursPerDay: 8.5 })],
  // De ingebouwde "Night Shift" van MS Project: de eerste werkdag (maandag 23:00–24:00) is de
  // afwijkende dag, di–vr de grote groep, za een derde.
  ['nachtploeg van MS Project (eerste werkdag wijkt af)', hourCal('Night Shift',
    week({ 1: [{ start: 1380, end: 1440 }],
      ...on([2, 3, 4, 5], [{ start: 0, end: 180 }, { start: 240, end: 480 }, { start: 1380, end: 1440 }]),
      6: [{ start: 0, end: 180 }, { start: 240, end: 480 }] }),
    { workStartHour: 23, workEndHour: 24, hoursPerDay: 8 })],
  // Het voorbeeld uit IFC 4.3 zelf (`IfcWorkCalendar`, figuur 1).
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 De vorm van het bestand
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const ifc = write(CASES[0][1]); // korte vrijdag
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §4 Gelijk aan main (1e192b31a) bij één groep en bij een kalender zonder blokken
// ════════════════════════════════════════════════════════════════════════════════════════════════
/** De kalenderregels van het bestand, met STEP-ids relatief aan de eerste kalenderregel (`#+n`) en
 *  verwijzingen naar eerdere regels als `#<`; zo maakt een extra entiteit vóór de kalender niets uit. */
function calendarLines(ifc: string): string[] {
  const keep = /=IFC(TIMEPERIOD|RECURRENCEPATTERN|WORKTIME|WORKCALENDAR)\(|'OPS_Calendar'|IFCPROPERTYSINGLEVALUE\('(WorkStartHour|WorkEndHour|HoursPerDay|IsHourCalendar|LiteralTimes|LegacyWorkTimeIds|SimpleBreakStart|SimpleBreakDuration)'/;
  const lines = ifc.split('\n').map((l) => l.trim()).filter((l) => keep.test(l));
  const base = Number(/^#(\d+)=/.exec(lines[0])![1]);
  return lines.map((l) => l.replace(/#(\d+)/g, (_, n: string) => (Number(n) >= base ? `#+${Number(n) - base}` : '#<')));
}
const uniformWeek = hourCal('Uniforme uurweek', week(on([1, 2, 3, 4, 5], MA_DO_PAUZE)),
  { workStartHour: 7, workEndHour: 16, hoursPerDay: 8.5 });
// Dezelfde week, maar dinsdag heeft zijn blokken in omgekeerde volgorde. Gelijke blokken zijn één groep,
// ongeacht de volgorde; main schreef de blokken van maandag, dus het bestand is gelijk aan de vorige.
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
// Gemaakt door deze batterij met esbuild te bundelen tegen `src/` van main 1e192b31a (alias `@`) en de
// §4-uitvoer over te nemen. Zie de kop: een afwijking is een fout in de writer, niet in deze lijst.
// Bewuste verschillen met main sinds de schemafix (docs/ifc-round-trip.md, alinea "Schemageldigheid"),
// verder byte-gelijk:
//  - REAL met decimale punt: `IFCREAL(16.)` en `IFCREAL(8.)` (was `IFCREAL(16)`, `IFCREAL(8)`);
//  - `Identification` = `$` na ObjectType in `IFCWORKCALENDAR` (9 attributen in plaats van 8).
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §5 De lezer op bestanden zonder OPS_Calendar, in beide indelingen van IfcWorkCalendar
// ════════════════════════════════════════════════════════════════════════════════════════════════
/** StartDate en FinishDate van een `IFCWORKTIME`; `null` is een leeg slot (`$`). */
type Dates = [string | null, string | null];
/** Een minimaal bestand: één `IFCWORKCALENDAR` met de gegeven `WorkingTimes` (weekdagen + tijdvakken
 *  als 'hh:mm', en optioneel StartDate/FinishDate). `layout` 9 = IFC 4.3, met `Identification` (zo
 *  schrijven bSI, xbim en IfcOpenShell, en OPS sinds de schemafix); 8 = oude OPS-bestanden, zonder.
 *  `opts.exceptions` komen als feestdag-`IFCWORKTIME`'s in ExceptionTimes, `opts.predefinedType` in
 *  PredefinedType. */
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
  // Testvoorwaarde: de twee indelingen hebben echt 9 en 8 attributen.
  const calArgs = (layout: 8 | 9) => splitTop(/IFCWORKCALENDAR\((.*)\);/.exec(foreignIfc(layout, []))![1]).length;
  same('§5 testvoorwaarde: IfcWorkCalendar met 9 en met 8 attributen', [calArgs(9), calArgs(8)], [9, 8]);
}
for (const layout of [9, 8] as const) {
  const L = `[${layout} attributen]`;
  const read = (groups: Parameters<typeof foreignIfc>[1], opts?: Parameters<typeof foreignIfc>[2]) =>
    readIFC(foreignIfc(layout, groups, opts)).calendar;
  // (a) Eén IFCWORKTIME per tijdvak (ma–vr 08–12 en ma–vr 13–17): de vereniging per dag.
  const c = read([[[1, 2, 3, 4, 5], [['08:00', '12:00']]], [[1, 2, 3, 4, 5], [['13:00', '17:00']]]]);
  same(`§5a ${L} één IFCWORKTIME per tijdvak: beide tijdvakken op elke werkdag`, shape(c), {
    workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17, hoursPerDay: 8,
    byWeekday: DAYS.map((d) => (d <= 5 ? [[480, 720], [780, 1020]] : [])),
  });
  // (b) Dag-modus (één blok per dag, geen signaal (a)/(b)/(c)): geen workTime, maar workDays is de
  //     vereniging van alle groepen, en de scalar komt van de eerste werkdag met blokken.
  const d = read([[[1, 2, 3, 4], [['07:00', '15:00']]], [[5], [['07:00', '11:00']]]]);
  same(`§5b ${L} dag-modus: werkdagen = vereniging van de groepen`, shape(d),
    { workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15, hoursPerDay: 8, byWeekday: null });
  // (c) Overlap: vrijdag in twee IFCWORKTIME's (07–11 en 08–11:30) wordt één tijdvak 07–11:30.
  const o = read([[[1, 2, 3, 4], [['07:00', '12:00'], ['12:30', '16:00']]], [[5], [['07:00', '11:00']]], [[5], [['08:00', '11:30']]]]);
  same(`§5c ${L} overlap op één weekdag: de vereniging van de tijdvakken`, o.workTime?.byWeekday[5], [{ start: 420, end: 690 }]);
  // (d) De scalaire dag is de eerste werkdag met blokken in de MSPDI/.mpp-volgorde (zondag eerst),
  //     onafhankelijk van de volgorde in de SET.
  const s = read([[[1, 2, 3, 4, 5], [['08:00', '12:00'], ['13:00', '17:00']]], [[7], [['10:00', '14:00']]]]);
  same(`§5d ${L} scalaire dag = eerste werkdag met blokken (zondag eerst)`, [s.workStartHour, s.workEndHour], [10, 14]);

  // Werktijden MET datum doen niet mee: datumgebonden werktijden worden (nog) niet gelezen. Als gewone
  // week zouden ze in elke week gelden.
  const BASIS: [number[], [string, string][]] = [[1, 2, 3, 4, 5], [['08:00', '12:00'], ['13:00', '17:00']]];
  const basis = shape(read([BASIS]));
  // (e) Een basisweek zonder datum en een zomerweek met datum: alleen de basisweek.
  const zomer = read([BASIS, [[1, 2, 3, 4, 5], [['07:00', '16:00']], ['2026-04-01', '2026-09-30']]]);
  same(`§5e ${L} zomerweek met datum naast een basisweek: alleen de basisweek telt`, shape(zomer), basis);
  // (f) Alleen een zomer- en een winterweek, beide met datum (07–16 en 08–17): er is geen werktijd zonder
  //     datum, dus het eerste patroon met datum (de zomerweek), zoals de lezer vóór de indeling per
  //     weekdag. Niet de vereniging (07–17, 10 u) en niet de standaardweek (07–16, 8 u).
  const seizoen = read([
    [[1, 2, 3, 4, 5], [['07:00', '16:00']], ['2026-04-01', '2026-09-30']],
    [[1, 2, 3, 4, 5], [['08:00', '17:00']], ['2026-10-01', '2027-03-31']],
  ]);
  same(`§5f ${L} alleen een zomer- en een winterweek met datum: het eerste patroon (07–16, 9 u)`, shape(seizoen),
    { workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 9, byWeekday: null });
  // (f2) Het voorbeeld uit de review van #340: één week 08–16 met datums 2026-01-01 t/m 2027-12-31. Main
  //      las 08–16; zonder deze regel kwam de standaardweek (07–16) binnen.
  const eenWeek = read([[[1, 2, 3, 4, 5], [['08:00', '16:00']], ['2026-01-01', '2027-12-31']]]);
  same(`§5f2 ${L} alleen één week met datum: die week (08–16)`, shape(eenWeek),
    shape(read([[[1, 2, 3, 4, 5], [['08:00', '16:00']]]])));
  same(`§5f2 ${L} testvoorwaarde: 08–16 is niet de standaardweek`, [eenWeek.workStartHour, eenWeek.workEndHour], [8, 16]);
  // (g) Een losse werkzaterdag met datum: geen werkzaterdag in elke week, en ook geen feestdag (in een
  //     kalender met 9 attributen las de lezer vóór de schemafix `WorkingTimes` als ExceptionTimes).
  const zaterdag = read([BASIS, [[6], [['08:00', '12:00']], ['2026-06-13', '2026-06-13']]]);
  same(`§5g ${L} losse werkzaterdag met datum: zaterdag blijft vrij`, [shape(zaterdag), zaterdag.workDays], [basis, [1, 2, 3, 4, 5]]);
  same(`§5g ${L} losse werkzaterdag met datum: geen feestdag`, zaterdag.holidays, []);
  // (h) Alleen een StartDate, of alleen een FinishDate, telt ook als datum (beide slots zijn OPTIONAL).
  const alleenStart = read([BASIS, [[6], [['08:00', '12:00']], ['2026-06-13', null]]]);
  same(`§5h ${L} werkzaterdag met alleen een StartDate: zaterdag blijft vrij`, [shape(alleenStart), alleenStart.workDays], [basis, [1, 2, 3, 4, 5]]);
  const alleenEind = read([BASIS, [[6], [['08:00', '12:00']], [null, '2026-06-13']]]);
  same(`§5h ${L} werkzaterdag met alleen een FinishDate: zaterdag blijft vrij`, [shape(alleenEind), alleenEind.workDays], [basis, [1, 2, 3, 4, 5]]);
  // (j) Een bestand van main tussen #340 en #344 (niet uitgebracht) heeft vooraan een terugvalweek met
  //     StartDate = FinishDate = 1900-01-01. Die doet niet mee: het leest gelijk aan zonder.
  const KORT: [number[], [string, string][]] = [[1, 2, 3, 4], [['07:00', '15:00']]];
  const VR: [number[], [string, string][]] = [[5], [['07:00', '11:00']]];
  same(`§5j ${L} terugvalweek van main (1900-01-01) doet niet mee`,
    shape(read([[[1, 2, 3, 4, 5], [['07:00', '15:00']], ['1900-01-01', '1900-01-01']], KORT, VR])), shape(read([KORT, VR])));
  // (i) ExceptionTimes en PredefinedType staan in elke indeling op hun eigen plek.
  const metUitzondering = read([BASIS], { exceptions: [['Kerst', '2026-12-25', '2026-12-26']], predefinedType: '.SECONDSHIFT.' });
  same(`§5i ${L} feestdag uit ExceptionTimes en ploeg uit PredefinedType`,
    [metUitzondering.holidays, metUitzondering.shift, shape(metUitzondering)],
    [[{ name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' }], 'SECOND', basis]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §6 Afgeleide velden en de motor na heropenen
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const MA_DO = [{ start: 420, end: 720 }, { start: 750, end: 930 }]; // 07:00–12:00 + 12:30–15:30 (8 u)
  const cal = hourCal('Korte vrijdag met pauze', week({ ...on([1, 2, 3, 4], MA_DO), 5: [{ start: 420, end: 660 }] }),
    { workStartHour: 7, workEndHour: 15.5, hoursPerDay: 8 });
  const rt = readIFC(write(cal)).calendar;
  // De pauze van een uurkalender is de ruimte tussen zijn blokken. (`inferredSimpleBreak` kijkt na #338
  // niet meer naar blokken, dus die toetst hier niets.)
  same('§6 de pauze (12:00–12:30) staat na heropenen in de blokken van ma–do, vrijdag houdt één blok',
    [1, 2, 3, 4, 5].map((d) => rt.workTime?.byWeekday[d as Day]), [MA_DO, MA_DO, MA_DO, MA_DO, [{ start: 420, end: 660 }]]);
  same('§6 hoursPerDay = modale dagsom (ma–do 8 u, vr 4 u)', rt.hoursPerDay, 8);
  // 16 werkuren vanaf donderdag 4 juni 2026 07:00: do 8 u + vr 4 u + ma 4 u ⇒ maandag 8 juni 11:00.
  const finish = new CalendarEngine(rt).addWorkMinutes(new Date('2026-06-04T07:00:00Z'), 16 * 60);
  same('§6 urentaak van 16 u vanaf do 07:00 eindigt ma 11:00 (niet vr 15:30)', finish.toISOString(), '2026-06-08T11:00:00.000Z');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §7 Robuustheid: hernummerde STEP-id's en een weggevallen OPS_Calendar-pset
// ════════════════════════════════════════════════════════════════════════════════════════════════
/** Alle STEP-id's + `shift`, zoals een ander pakket een bestand kan hernummeren. */
const renumber = (ifc: string, shift: number): string => ifc.replace(/#(\d+)/g, (_, n: string) => `#${Number(n) + shift}`);
/** Zonder `OPS_Calendar`: de pset en de relatie die hem aan de kalender hangt. */
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
  // (a) Hernummerd (+1000): exact.
  same(`§7a ${label}: hernummerde STEP-id's (+1000) lezen exact`,
    shape(readIFC(renumber(write(cal), 1000)).calendar), shape(cal));
  // (b) Zonder pset: dezelfde werkdagen (de vereniging van de groepen). Zonder pset ontbreken ook
  //     `IsHourCalendar` en `WorkStartHour`/`WorkEndHour`; een week met één blok per dag wordt dan een
  //     dagkalender, net als bij de MSPDI- en `.mpp`-lezer. De blokken per dag toetst (c).
  same(`§7b ${label}: zonder OPS_Calendar dezelfde werkdagen`,
    readIFC(dropOpsCalendarPset(write(cal))).calendar.workDays, cal.workDays);
}
// (c) De twee voorbeelden van de review lezen zonder pset exact (meer blokken op een dag ⇒ uurkalender).
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
