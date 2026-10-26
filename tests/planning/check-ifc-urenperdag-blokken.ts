import './domStub';
// Uren per dag bij een blokkenkalender, door opslaan als IFC en heropenen.
//
// `hoursPerDay` is de omrekening tussen dagen en uren (P6 `day_hr_cnt`), los van de werktijd. Een
// XER-kalender "Late ploeg" met blokken 14:00–24:00 (10 klokuren) en `day_hr_cnt` 8 kwam na IFC terug met
// 10: de writer schreef `HoursPerDay` alleen voor een dagkalender, en de lezer zette `hoursPerDay` van een
// uurkalender op de modale dagsom van de blokken. Nu draagt een uurkalender `HoursPerDay` in
// `OPS_Calendar` zodra hij afwijkt van zijn blokken (altijd samen met `IsHourCalendar = .T.`), en wint die
// waarde in de lezer na de promotie. Zie docs/ifc-round-trip.md, "Uren per dag bij een blokkenkalender".
//
//  §1 round-trip per geval: één blok, twee blokken, nachtblok, blokken per weekdag, gelijk aan de spanne
//     maar niet aan de blokken, een gebroken getal, een lange maandag (modaal ≠ eerste groep ≠ maximum),
//     werkdagen zonder eigen blokken (de dagsom van het bestand ≠ die in het geheugen), en gelijk aan de
//     klokuren; plus een tweede round-trip.
//  §2 de vorm van het bestand: `HoursPerDay` alleen bij een afwijking, met de exacte waarde, altijd samen
//     met `IsHourCalendar = .T.`; nooit `SimpleBreak*`.
//  §3 urentaken: de dagwaarde (`scheduleDuration`) is na heropenen werkminuten ÷ de werktijd per dag van
//     de geschreven blokken, niet ÷ hoursPerDay (eigenaarsbesluit 2026-10-15, optie 2).
//  §4 de echte open- en opslaanroute (store, doorrekenen): kalenders, getoonde duur, datums en de motor
//     (die rekent met de blokken) gelijk vóór en na. Zonder de kalender waarvan de writer de week anders
//     schrijft (`written`): zijn werktijd verandert los van de uren per dag.
//  §5 een bestand van de writer van main 7ea3e8748 (zonder deze `HoursPerDay`) leest zoals main het las.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { effectiveCalendarOf, formatTaskDurationDisplay } from '@/utils/taskDuration';
import type { DocumentPayload } from '@/state/documentContract';
import type { OpenedImport } from '@/services/importTypes';
import type { WorkCalendar } from '@/types/calendar';
import { buildProject, CASES, DAYS, deviates } from './urenperdagBlokken';

declare const process: { exit(code: number): never };

const HERE = fileURLToPath(new URL('.', import.meta.url));

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}

/** De kalendervelden die de round-trip ongeschonden moet laten; `workTime` per weekdag. */
function shape(c: WorkCalendar) {
  return {
    workDays: [...c.workDays], workStartHour: c.workStartHour, workEndHour: c.workEndHour, hoursPerDay: c.hoursPerDay,
    byWeekday: c.workTime ? DAYS.map((d) => (c.workTime!.byWeekday[d] ?? []).map((b) => [b.start, b.end])) : null,
  };
}
const calendarsOf = (r: { calendar: WorkCalendar; resourceCalendars?: WorkCalendar[] }): WorkCalendar[] =>
  [r.calendar, ...(r.resourceCalendars ?? [])];
const byName = (cals: WorkCalendar[], name: string): WorkCalendar | undefined => cals.find((c) => c.name === name);

// Mini-STEP-lezer: de eigenschapnamen + waarden in het `OPS_Calendar`-pset van één kalender.
function opsCalendarProps(ifc: string, calendarName: string): Record<string, string> {
  const lines = new Map([...ifc.matchAll(/^#(\d+)=(.*);$/gm)].map((m) => [m[1], m[2]]));
  const calId = [...lines].find(([, l]) => l.startsWith('IFCWORKCALENDAR(') && l.includes(`'${calendarName}'`))?.[0];
  const rel = [...lines.values()].find((l) => l.startsWith('IFCRELDEFINESBYPROPERTIES(') && l.includes(`(#${calId}),`));
  const pset = lines.get(rel?.match(/,#(\d+)\)$/)?.[1] ?? '') ?? '';
  const out: Record<string, string> = {};
  for (const ref of pset.matchAll(/#(\d+)/g)) {
    const m = /^IFCPROPERTYSINGLEVALUE\('([^']+)',\$,(.*),\$\)$/.exec(lines.get(ref[1]) ?? '');
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const project = buildProject();
const ifc = writeIFC(project);
const read = readIFC(ifc);

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 Round-trip per geval
// ════════════════════════════════════════════════════════════════════════════════════════════════
same('§1 opzet: één geval zonder afwijking, acht met', CASES.map(deviates),
  [true, true, true, true, true, true, true, true, false]);
/** De kalender zoals hij terug moet komen: met de blokken zoals het bestand ze draagt. */
const expected = (c: (typeof CASES)[number]): WorkCalendar => ({ ...c.cal, workTime: c.written ?? c.cal.workTime });
{
  const rt2 = readIFC(writeIFC(read));
  for (const c of CASES) {
    const got = byName(calendarsOf(read), c.cal.name);
    same(`§1 ${c.label}: kalender na opslaan en heropenen`, got && shape(got), shape(expected(c)));
    const got2 = byName(calendarsOf(rt2), c.cal.name);
    same(`§1 ${c.label}: tweede round-trip gelijk`, got2 && shape(got2), shape(expected(c)));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 De vorm van het bestand
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const c of CASES) {
  const props = opsCalendarProps(ifc, c.cal.name);
  same(`§2 ${c.label}: HoursPerDay ${deviates(c) ? `= ${c.cal.hoursPerDay}` : 'ontbreekt'}`,
    props.HoursPerDay ?? null, deviates(c) ? `IFCREAL(${Number.isInteger(c.cal.hoursPerDay) ? `${c.cal.hoursPerDay}.` : c.cal.hoursPerDay})` : null);
  same(`§2 ${c.label}: IsHourCalendar .T., geen SimpleBreak`, {
    hour: props.IsHourCalendar ?? null, breaks: ['SimpleBreakStart', 'SimpleBreakDuration'].filter((p) => p in props),
  }, { hour: 'IFCBOOLEAN(.T.)', breaks: [] });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §3 Urentaken: de dagwaarde komt terug
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const taskShape = (t: { time: { durationUnit?: string; durationMinutes?: number; scheduleDuration: number } }) =>
    ({ unit: t.time.durationUnit, min: t.time.durationMinutes ?? null, dur: t.time.scheduleDuration });
  // Verwacht per kalender: 2400 werkminuten ÷ de klokuren van de GESCHREVEN blokken (`clockHours`). Voor
  // de kalender die de writer anders schrijft (`written`) is dat bewust een ander getal dan vóór opslaan:
  // zijn blokken veranderen, dus de werktijd per dag ook.
  const clockOf = new Map(CASES.map((c) => [c.cal.id, c.clockHours]));
  for (const t of project.tasks) {
    const got = read.tasks.find((x) => x.id === t.id);
    const clock = clockOf.get(t.calendarId ?? CASES[0].cal.id)!;
    const want = t.time.durationUnit === 'hours' ? { ...taskShape(t), dur: 2400 / (clock * 60) } : taskShape(t);
    same(`§3 taak "${t.name}": eenheid, minuten en dagwaarde`, got && taskShape(got), want);
  }
  // De Late ploeg: 40 u bij blokken van 10 u is 4 d, ook al staat hoursPerDay op 8 (optie 2).
  same('§3 Late ploeg: urentaak van 40 u is 4 d', read.tasks.find((t) => t.id === 't-late')?.time.scheduleDuration, 4);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §4 De echte open- en opslaanroute, met doorrekenen
// ════════════════════════════════════════════════════════════════════════════════════════════════
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
function openInStore(parsed: OpenedImport): DocumentPayload {
  const store = createAppStoreContext().store;
  store.getState().applyOpenedImport(parsed, OPEN);
  return store.getState().getOpenDocumentPayloads()[0].payload;
}
{
  const stable = CASES.filter((c) => !c.written);
  const before = openInStore(buildProject(stable));
  const after = openInStore(await parseOpenedFile({ name: 'urenperdag.ifc', text: writeIFC(buildWriteIFCInput(before)) }));
  const calView = (p: DocumentPayload) => Object.fromEntries(calendarsOf({ calendar: p.calendar, resourceCalendars: p.calendars })
    .map((c) => [c.name, { ...shape(c), motor: new CalendarEngine(c).hoursPerDay }]));
  same('§4 kalenders (en de uren per dag van de motor) gelijk na opslaan en heropenen', calView(after), calView(before));
  // De motor rekent bij een uurkalender met de blokken (`CalendarEngine.hoursPerDay` = de modale dagsom);
  // de fix verandert de rekenuitkomst dus niet.
  same('§4 de motor rekent met de klokuren van de blokken', stable.map((c) => calView(after)[c.cal.name]?.motor),
    stable.map((c) => c.clockHours));
  const taskView = (p: DocumentPayload) => Object.fromEntries(p.tasks.map((t) => {
    const cal = effectiveCalendarOf(t, p.calendar, p.calendars);
    const x = t.time;
    return [t.id, {
      auto: formatTaskDurationDisplay(t, cal, 'auto'),
      days: formatTaskDurationDisplay(t, cal, 'days'),
      hours: formatTaskDurationDisplay(t, cal, 'hours'),
      dates: [x.scheduleStart, x.scheduleFinish, x.earlyStart, x.earlyFinish, x.lateStart, x.lateFinish],
      dur: x.scheduleDuration, min: x.durationMinutes ?? null,
    }];
  }));
  same('§4 taken: getoonde duur, datums en dagwaarde gelijk na opslaan en heropenen', taskView(after), taskView(before));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §5 Een bestand van de writer van main 7ea3e8748 (zonder HoursPerDay bij een uurkalender)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// De fixture is gegenereerd met de writer van origin/main 7ea3e8748 uit `buildProject()`; de JSON ernaast
// legt vast wat de lezer van diezelfde commit eruit las: de uren per dag per kalender (de klokuren van de
// geschreven blokken) en de dagwaarde per taak.
{
  const oldIfc = readFileSync(join(HERE, 'fixtures', 'urenperdag-oude-writer.ifc'), 'utf8');
  const want = JSON.parse(readFileSync(join(HERE, 'fixtures', 'urenperdag-oude-writer.json'), 'utf8')) as {
    hoursPerDay: Record<string, number>;
    scheduleDuration: Record<string, number>;
  };
  same('§5 fixture: de oude writer schreef geen HoursPerDay', oldIfc.includes("'HoursPerDay'"), false);
  const old = readIFC(oldIfc);
  same('§5 oud bestand: uren per dag zoals main ze las (de klokuren)',
    Object.fromEntries(calendarsOf(old).map((c) => [c.name, c.hoursPerDay])), want.hoursPerDay);
  same('§5 oud bestand: dagwaarde per taak zoals main hem las',
    Object.fromEntries(old.tasks.map((t) => [t.id, t.time.scheduleDuration])), want.scheduleDuration);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  urenperdag-blokken: ${f}`);
  console.log(`XX  urenperdag-blokken: ${failures.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  urenperdag-blokken: alle ${checks} checks groen`);
