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

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX ${failure}`);
  console.log(`\n${failures.length}/${checks} kalenderidentiteitschecks mislukt.`);
  process.exitCode = 1;
} else {
  console.log(`OK ifc-kalenderidentiteit (H7): ${checks} controles groen`);
}
