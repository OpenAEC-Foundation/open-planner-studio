// H7 — kalenderidentiteit door de IFC-round-trip (opslaan → heropenen via de echte openroute).
//
// Twee lekken in dezelfde kalendermapping, samen zichtbaar als een bibliotheekkopie die direct na
// opslaan+heropenen op "wijkt af" stond in plaats van "in sync"/"loopt achter":
//  (1) De lezer nam de scalar `workStartHour`/`workEndHour` uit de EERSTE `IFCTIMEPERIOD`. Staan er
//      meerdere banden in het bestand — een uurkalender, of een scalaire kalender waarvoor de export
//      de effectieve banden materialiseert — dan werd 07:00–16:00 zo 07:00–12:00.
//  (2) Een SCALAIRE kalender die door een urentaak gebruikt wordt, kwam terug als uurkalender
//      (`workTime` erbij): de export schrijft zijn effectieve lunchbanden (interop, bewust) en de lezer
//      promoveerde die via discriminator (a) meer-banden / (c) sub-dag-taak. Scalair blijft scalair:
//      `effectiveWorkTimeBands` materialiseert uitsluitend in het geheugen.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { classifyCalendarOnOpen } from '@/services/library';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { shiftPresetPatch } from '@/utils/shiftPresets';
import { seedScalarWorkTime } from '@/utils/effectiveWorkTime';
import { deriveHoursPerDay } from '@/services/subdayIo';
import { createDefaultProject } from '@/state/defaults';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { CompanyPool } from '@/types/library';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `import.meta.url`-relatief: de bundel draait vanuit tests/planning/ (zie check-adapters-hours.ts).
const HERE = fileURLToPath(new URL('.', import.meta.url));

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

/** De kalendervelden die een round-trip ongeschonden moet laten (id's worden bij lezen hergenereerd). */
function calendarShape(c: WorkCalendar) {
  return {
    workDays: c.workDays, workStartHour: c.workStartHour, workEndHour: c.workEndHour,
    hoursPerDay: c.hoursPerDay, workTime: c.workTime ?? null, shift: c.shift ?? null,
    simpleBreakStartMinute: c.simpleBreakStartMinute ?? null,
    simpleBreakDurationMinutes: c.simpleBreakDurationMinutes ?? null,
  };
}
function taskShape(t: Task) {
  const x = t.time;
  return {
    unit: x.durationUnit ?? 'days', min: x.durationMinutes ?? null, dur: x.scheduleDuration,
    ss: x.scheduleStart, sf: x.scheduleFinish, es: x.earlyStart, ef: x.earlyFinish,
    ls: x.lateStart, lf: x.lateFinish,
  };
}
const byName = (tasks: Task[], name: string) => tasks.find((t) => t.name === name)!;

// ── §1–§4: scalaire projectkalender met een urentaak, via de store en de echte openroute ─────────
async function scalarScenario(label: string, patch: Partial<WorkCalendar>): Promise<void> {
  const store = createAppStoreContext().store;
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  S().setCalendar({ ...S().calendar, ...patch });
  S().ensureProjectCalendarInLibrary();
  S().addTask({ name: 'Dagtaak', time: createDefaultTaskTime('2026-06-01', 2) });
  S().addTask({ name: 'Urentaak', time: createDefaultTaskTime('2026-06-01', 10, 'hours', S().calendar) });
  S().runCPM();
  const cid = S().addCompany('Bouwbedrijf');
  S().bindProjectToCompany(cid);
  const poolId = S().promoteCalendarToPool(cid, S().calendars.find((c) => c.id === S().project.calendarId)!)!;

  const before = calendarShape(S().calendar);
  const tasksBefore = { dag: taskShape(byName(S().tasks, 'Dagtaak')), uren: taskShape(byName(S().tasks, 'Urentaak')) };
  same(`${label}: uitgangspunt is een scalaire kalender`, before.workTime, null);

  const ifc = writeIFC(buildWriteIFCInput(S()));
  const parsed = readIFC(ifc);
  same(`${label}: readIFC geeft dezelfde scalaire kalender terug`, calendarShape(parsed.calendar), before);
  same(`${label}: bibliotheekkopie is na heropenen in sync (pool ongewijzigd)`,
    classifyCalendarOnOpen(parsed.calendar, S().pools[cid]), 'in-sync');
  same(`${label}: dagtaak houdt zijn datums`, taskShape(byName(parsed.tasks, 'Dagtaak')), tasksBefore.dag);
  same(`${label}: urentaak houdt minuten en tijden`, taskShape(byName(parsed.tasks, 'Urentaak')), tasksBefore.uren);

  // Idempotentie: een tweede ronde (write→read→write→read) verschuift niets.
  const again = readIFC(writeIFC({ ...buildWriteIFCInput(S()), calendar: parsed.calendar, tasks: parsed.tasks }));
  same(`${label}: tweede round-trip is identiek`, calendarShape(again.calendar), before);

  // De pool beweegt ná het opslaan ⇒ de onbewerkte kopie "loopt achter" (stil verversen), niet "wijkt af".
  S().updatePoolCalendar(cid, poolId, { description: 'bijgewerkt in de bibliotheek' });
  same(`${label}: bibliotheekkopie loopt achter wanneer de pool bewoog`,
    classifyCalendarOnOpen(readIFC(ifc).calendar, S().pools[cid]), 'behind');

  // De echte openroute (parseOpenedFile → applyOpenedImport, met herberekening).
  const opened = createAppStoreContext().store;
  opened.getState().applyOpenedImport(await parseOpenedFile({ name: 'h7.ifc', text: ifc }), {
    filePath: null, recompute: true, linkedOpen: true, hourDataNotice: true,
  });
  same(`${label}: na openen is de projectkalender ongewijzigd`, calendarShape(opened.getState().calendar), before);
  same(`${label}: na openen plant de urentaak identiek`,
    taskShape(byName(opened.getState().tasks, 'Urentaak')), tasksBefore.uren);
}

await scalarScenario('§1 07-16/8 (impliciete middagpauze)', {});
await scalarScenario('§2 07-16 + expliciete pauze 12:00/60m', { simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60 });
await scalarScenario('§3 08-16/8 (één band, geen pauze)', { workStartHour: 8, workEndHour: 16, hoursPerDay: 8 });
await scalarScenario('§4 07:30-16:00 + pauze 12:00/30m', {
  workStartHour: 7.5, workEndHour: 16, hoursPerDay: 8, simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 30,
});

// De interop-export zelf blijft: een ander pakket ziet de lunchpauze als twee TimePeriods.
{
  const store = createAppStoreContext().store;
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  S().addTask({ name: 'Urentaak', time: createDefaultTaskTime('2026-06-01', 10, 'hours', S().calendar) });
  const ifc = writeIFC(buildWriteIFCInput(S()));
  same('§5 export materialiseert nog steeds de effectieve lunchbanden',
    ifc.includes("IFCTIMEPERIOD('07:00:00','12:00:00')") && ifc.includes("IFCTIMEPERIOD('13:00:00','16:00:00')"), true);
}

// ── §6: scalaire BIBLIOTHEEKkalender (task.calendarId) met een urentaak ─────────────────────────
{
  const store = createAppStoreContext().store;
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const calId = S().addCalendar({
    name: 'Vroege ploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 6, workEndHour: 15, hoursPerDay: 8, holidays: [],
  });
  const lib = S().calendars.find((c) => c.id === calId)!;
  const id = S().addTask({ name: 'Urentaak', time: createDefaultTaskTime('2026-06-01', 10, 'hours', lib) });
  S().updateTask(id, { calendarId: calId });
  S().runCPM();
  const before = calendarShape(S().calendars.find((c) => c.id === calId)!);
  const parsed = readIFC(writeIFC(buildWriteIFCInput(S())));
  same('§6 scalaire bibliotheekkalender met urentaak blijft scalair en 06-15',
    calendarShape((parsed.resourceCalendars ?? []).find((c) => c.name === 'Vroege ploeg')!), before);
}

// ── §7: echte uurkalenders houden hun scalar werktijd (lek 1 zonder urentaak) ────────────────────
for (const [label, patch] of [
  ['§7a tweeploegenpreset 06-14 + 14-22 (scalar 06-22)', shiftPresetPatch('two-shift')],
  ['§7b bandeditor geseed uit 07-16/8', (() => {
    const workTime = seedScalarWorkTime([1, 2, 3, 4, 5], 7, 16, 8);
    return { workTime, hoursPerDay: deriveHoursPerDay(workTime, 8) };
  })()],
] as const) {
  const store = createAppStoreContext().store;
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  S().setCalendar({ ...S().calendar, ...patch });
  S().ensureProjectCalendarInLibrary();
  S().addTask({ name: 'Dagtaak' });
  S().runCPM();
  const cid = S().addCompany('Bouwbedrijf');
  S().bindProjectToCompany(cid);
  S().promoteCalendarToPool(cid, S().calendars.find((c) => c.id === S().project.calendarId)!);
  const before = calendarShape(S().calendar);
  const parsed = readIFC(writeIFC(buildWriteIFCInput(S())));
  same(`${label}: kalender ongewijzigd na round-trip`, calendarShape(parsed.calendar), before);
  same(`${label}: bibliotheekkopie in sync`, classifyCalendarOnOpen(parsed.calendar, S().pools[cid]), 'in-sync');
}

// ── §8: gulden regel — waar de lezer het al goed afleidt, komt er niets bij in het bestand ───────
{
  const project = { ...createDefaultProject(), calendarId: 'c', startDate: '2026-06-01' };
  const dayCal: WorkCalendar = {
    id: 'c', name: 'Dag', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  const dayIfc = writeIFC({ project, calendar: dayCal, tasks: [], sequences: [], resources: [], assignments: [] });
  same('§8a dagkalender zonder urentaak schrijft geen extra kalendereigenschappen',
    ['WorkStartHour', 'WorkEndHour', 'IsHourCalendar'].filter((p) => dayIfc.includes(`'${p}'`)), []);
  const h8: WorkCalendar = {
    ...dayCal, workStartHour: 8, workEndHour: 16,
    workTime: { byWeekday: { 1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
      4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [] } },
  };
  const h8Ifc = writeIFC({ project, calendar: h8, tasks: [], sequences: [], resources: [], assignments: [] });
  same('§8b uurkalender waarvan de eerste band de scalar is, schrijft geen WorkStartHour/WorkEndHour',
    ['WorkStartHour', 'WorkEndHour'].filter((p) => h8Ifc.includes(`'${p}'`)), []);
}

// ── §9–§10: bestanden die OPS vóór de H7-markering schreef (eigenaarsbesluit: herkennen en
//    herstellen, zonder melding) ──────────────────────────────────────────────────────────────────
// De fixture is gegenereerd met de writer van origin/main 531940ac (vóór de H7-fix); de JSON ernaast
// legt vast wat er vóór opslaan in het geheugen stond, plus de bibliotheekpool op dat moment.
interface LegacyExpect {
  projectCalendar: ReturnType<typeof calendarShape>;
  libraryCalendars: Record<string, ReturnType<typeof calendarShape>>;
  tasks: Record<string, { unit: string; min: number | null; dur: number; ss: string; sf: string; es: string; ef: string }>;
  pool: CompanyPool;
}
const legacyIfc = readFileSync(join(HERE, 'fixtures', 'h7-kalender-oude-writer.ifc'), 'utf8');
const legacy = JSON.parse(readFileSync(join(HERE, 'fixtures', 'h7-kalender-oude-writer.json'), 'utf8')) as LegacyExpect;
const libCal = (p: ReturnType<typeof readIFC>, name: string) => (p.resourceCalendars ?? []).find((c) => c.name === name)!;
const legacyTask = (t: Task) => {
  const x = t.time;
  return { unit: x.durationUnit ?? 'days', min: x.durationMinutes ?? null, dur: x.scheduleDuration,
    ss: x.scheduleStart, sf: x.scheduleFinish, es: x.earlyStart, ef: x.earlyFinish };
};

// §9a. De oude writer markeerde de scalaire kalenders niet, maar schreef wél hun lunchbanden: zonder
//      herkenning kwam 07:00–16:00 terug als uurkalender 07:00–12:00.
same('§9 fixture: oude writer schreef geen H7-markering', ['WorkStartHour', 'WorkEndHour', 'IFCBOOLEAN(.F.)']
  .filter((needle) => legacyIfc.includes(needle)), []);
{
  const parsed = readIFC(legacyIfc);
  same('§9a oud bestand: projectkalender wordt weer scalair 07-16/8', calendarShape(parsed.calendar), legacy.projectCalendar);
  same('§9a oud bestand: bibliotheekkopie in sync', classifyCalendarOnOpen(parsed.calendar, legacy.pool), 'in-sync');
  const movedPool: CompanyPool = {
    ...legacy.pool,
    calendars: legacy.pool.calendars.map((c) => ({ ...c, description: 'bijgewerkt in de bibliotheek' })),
  };
  same('§9a oud bestand: bibliotheekkopie loopt achter wanneer de pool bewoog',
    classifyCalendarOnOpen(parsed.calendar, movedPool), 'behind');
  for (const name of ['Vroege ploeg', 'Pauzekalender']) {
    same(`§9a oud bestand: scalaire bibliotheekkalender "${name}" hersteld`, calendarShape(libCal(parsed, name)),
      legacy.libraryCalendars[name]);
  }
  for (const name of ['Dagtaak', 'Urentaak', 'Urentaak vroeg', 'Urentaak pauze']) {
    same(`§9a oud bestand: taak "${name}" houdt duur en tijden`, legacyTask(byName(parsed.tasks, name)), legacy.tasks[name]);
  }

  // §9b. Echte uurkalenders uit hetzelfde oude bestand blijven uurkalenders (IsHourCalendar .T.): de
  //      herkenning raakt ze niet. Hun scalar werktijd stond niet in het oude bestand; die blijft de
  //      bekende oude afleiding uit de eerste periode (06-14, 07-12) — niet te herstellen, niet geraden.
  for (const [name, firstBand] of [['Tweeploegen', [6, 14]], ['Bandeditor', [7, 12]]] as const) {
    const got = calendarShape(libCal(parsed, name));
    const want = legacy.libraryCalendars[name];
    same(`§9b oud bestand: uurkalender "${name}" blijft uurkalender`, {
      workTime: got.workTime, hoursPerDay: got.hoursPerDay, shift: got.shift, workDays: got.workDays,
    }, { workTime: want.workTime, hoursPerDay: want.hoursPerDay, shift: want.shift, workDays: want.workDays });
    same(`§9b oud bestand: uurkalender "${name}" houdt de oude scalarafleiding`,
      [got.workStartHour, got.workEndHour], firstBand);
  }
  same('§9b oud bestand: urentaak op de uurkalender ongewijzigd',
    legacyTask(byName(parsed.tasks, 'Urentaak bandeditor')), legacy.tasks['Urentaak bandeditor']);
}

// §9c. De echte openroute op het oude bestand.
{
  const opened = createAppStoreContext().store;
  opened.getState().applyOpenedImport(await parseOpenedFile({ name: 'oud.ifc', text: legacyIfc }), {
    filePath: null, recompute: true, linkedOpen: true, hourDataNotice: true,
  });
  same('§9c oud bestand geopend: projectkalender 07-16/8 scalair', calendarShape(opened.getState().calendar), legacy.projectCalendar);
  same('§9c oud bestand geopend: urentaak plant zoals vóór opslaan',
    legacyTask(byName(opened.getState().tasks, 'Urentaak')), legacy.tasks.Urentaak);
}

// §9d. Grenzen van de herkenning — geen kenmerk of geen sluitende reconstructie ⇒ het oude pad.
{
  // Uurkalender zonder IsHourCalendar (OPS-bestanden van vóór die markering, eind augustus): geen
  // HoursPerDay/SimpleBreak ⇒ niet herkend, blijft uurkalender via de meer-bandendiscriminator.
  const unmarked = readIFC(legacyIfc.split("'IsHourCalendar'").join("'GeenMarkering'"));
  same('§9d uurkalender zonder markering blijft uurkalender (Tweeploegen)', calendarShape(libCal(unmarked, 'Tweeploegen')).workTime,
    legacy.libraryCalendars.Tweeploegen.workTime);
  same('§9d uurkalender zonder markering blijft uurkalender (Bandeditor)', calendarShape(libCal(unmarked, 'Bandeditor')).workTime,
    legacy.libraryCalendars.Bandeditor.workTime);
  // Zonder OPS-scalarkenmerk (zoals een bestand van een ander pakket): oud pad, dus uurkalender.
  const noMarks = readIFC(legacyIfc.split("'HoursPerDay'").join("'GeenKenmerk'"));
  same('§9d twee banden zonder OPS-kenmerk volgen het oude pad', [
    noMarks.calendar.workTime !== undefined, noMarks.calendar.workEndHour,
  ], [true, 12]);
  // Kenmerk aanwezig maar de banden passen niet bij de gereconstrueerde scalar: niet raden.
  const mismatch = readIFC(legacyIfc.replace(/(#81=IFCTIMEPERIOD\(')13:00:00'/, "$113:30:00'"));
  same('§9d banden die niet uit de scalar volgen worden niet als scalair gelezen',
    calendarShape(libCal(mismatch, 'Pauzekalender')).workTime !== null, true);
}

// §10. De kenmerken waarop §9 steunt schrijft de writer UITSLUITEND voor scalaire kalenders: geen
//      enkele uurkalender — ook niet met achtergebleven pauzevelden of een afwijkende hpd — krijgt
//      HoursPerDay of SimpleBreak*, met of zonder urentaak. (In git sinds de invoering, 829a4123 en
//      601aa417, stond hun schrijfvoorwaarde altijd achter `!cal.workTime`.)
{
  const seeded = seedScalarWorkTime([1, 2, 3, 4, 5], 7, 16, 8);
  const hourCalendars: [string, Partial<WorkCalendar>][] = [
    ['tweeploegen', shiftPresetPatch('two-shift')],
    ['drieploegen', shiftPresetPatch('three-shift')],
    ['nacht', shiftPresetPatch('night')],
    ['continu', shiftPresetPatch('continuous')],
    ['bandeditor 07-16', { workTime: seeded, hoursPerDay: deriveHoursPerDay(seeded, 8) }],
    ['uurkalender met oude pauzevelden en hpd 6', {
      workTime: seeded, hoursPerDay: 6, simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60,
    }],
  ];
  const project = { ...createDefaultProject(), calendarId: 'k', startDate: '2026-06-01' };
  const baseCal: WorkCalendar = {
    id: 'k', name: 'K', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  const hourTask = (cal: WorkCalendar): Task => ({
    id: 't', name: 'Urentaak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: createDefaultTaskTime('2026-06-01', 10, 'hours', cal),
  } as Task);
  const leaks: string[] = [];
  for (const [label, patch] of hourCalendars) {
    const cal = { ...baseCal, ...patch };
    for (const tasks of [[], [hourTask(cal)]]) {
      const ifc = writeIFC({ project, calendar: cal, tasks, sequences: [], resources: [], assignments: [] });
      const props = ['HoursPerDay', 'SimpleBreakStart', 'SimpleBreakDuration'].filter((p) => ifc.includes(`'${p}'`));
      if (props.length > 0 || !ifc.includes("'IsHourCalendar',$,IFCBOOLEAN(.T.)")) {
        leaks.push(`${label}${tasks.length ? ' + urentaak' : ''}: ${props.join(',') || 'mist IsHourCalendar .T.'}`);
      }
    }
  }
  same('§10 geen uurkalender draagt een scalarkenmerk (en elke draagt IsHourCalendar .T.)', leaks, []);
  // En de oude writer deed hetzelfde: in de fixture dragen de twee uurkalenders er ook geen.
  const psetOfCalendar = (text: string, name: string): string[] => {
    const lines = new Map([...text.matchAll(/^#(\d+)=(.*);$/gm)].map((m) => [m[1], m[2]]));
    const calId = [...lines].find(([, l]) => l.startsWith('IFCWORKCALENDAR(') && l.includes(`'${name}'`))?.[0];
    const rel = [...lines.values()].find((l) => l.startsWith('IFCRELDEFINESBYPROPERTIES(') && l.includes(`(#${calId}),`));
    const pset = lines.get(rel?.match(/,#(\d+)\)$/)?.[1] ?? '') ?? '';
    return [...pset.matchAll(/#(\d+)/g)].map((m) => lines.get(m[1]) ?? '')
      .filter((l) => l.startsWith('IFCPROPERTYSINGLEVALUE(')).map((l) => l.match(/^IFCPROPERTYSINGLEVALUE\('([^']+)'/)?.[1] ?? '');
  };
  same('§10 oude writer: uurkalenders in de fixture zonder scalarkenmerk',
    { twee: psetOfCalendar(legacyIfc, 'Tweeploegen'), band: psetOfCalendar(legacyIfc, 'Bandeditor') },
    { twee: ['IsHourCalendar'], band: ['IsHourCalendar'] });
  same('§10 oude writer: scalaire kalenders in de fixture dragen HoursPerDay/SimpleBreak',
    { vroeg: psetOfCalendar(legacyIfc, 'Vroege ploeg'), pauze: psetOfCalendar(legacyIfc, 'Pauzekalender') },
    { vroeg: ['HoursPerDay'], pauze: ['HoursPerDay', 'SimpleBreakStart', 'SimpleBreakDuration'] });
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX ${failure}`);
  console.log(`\n${failures.length}/${checks} kalenderidentiteitschecks mislukt.`);
  process.exitCode = 1;
} else {
  console.log(`OK ifc-kalenderidentiteit (H7): ${checks} controles groen`);
}
