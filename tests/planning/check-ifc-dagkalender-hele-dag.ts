import './domStub';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { DocumentPayload } from '@/state/documentContract';
import type { ImportResult, OpenedImport } from '@/services/importTypes';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

declare const process: { exit(code: number): never };

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}

function heleDag(id: string, name: string): WorkCalendar {
  return {
    ...createDefaultCalendar(), id, name, workDays: [1, 2, 3, 4, 5, 6, 7],
    workStartHour: 0, workEndHour: 24, hoursPerDay: 8, holidays: [], generation: undefined,
  };
}
const gewoon: WorkCalendar = {
  ...createDefaultCalendar(), id: 'cal-gewoon', name: 'Gewoon', workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
  holidays: [], generation: undefined,
};
function dayTask(id: string, name: string, days: number, calendarId?: string): Task {
  return {
    id, name, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    ...(calendarId ? { calendarId } : {}),
    time: createDefaultTaskTime('2024-01-15', days, 'days'),
  } as Task;
}
function buildProject(): ImportResult {
  const project = { ...createDefaultProject(), id: 'proj-hele-dag', calendarId: 'cal-default', startDate: '2024-01-15' };
  const calendar = heleDag('cal-default', 'global');
  const lib = heleDag('cal-lib', 'Bibliotheek 24 uur');
  return {
    project, calendar, resourceCalendars: [lib, gewoon],
    tasks: [dayTask('t-proj', 'Achttien dagen', 18), dayTask('t-lib', 'Op de bibliotheek', 18, 'cal-lib'),
      dayTask('t-gewoon', 'Gewone dagkalender', 5, 'cal-gewoon')],
    sequences: [], resources: [], assignments: [],
  };
}

const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
function openAndRecalc(parsed: OpenedImport): DocumentPayload {
  const store = createAppStoreContext().store;
  store.getState().applyOpenedImport(parsed, OPEN);
  store.getState().runCPM();
  return store.getState().getOpenDocumentPayloads()[0].payload;
}
const calView = (p: DocumentPayload) => Object.fromEntries([p.calendar, ...p.calendars].map((c) => [c.name, {
  workDays: c.workDays, workStartHour: c.workStartHour, workEndHour: c.workEndHour, hoursPerDay: c.hoursPerDay,
  workTime: c.workTime ?? null,
}]));
const taskView = (p: DocumentPayload) => Object.fromEntries(p.tasks.map((t) => [t.name, {
  unit: t.time.durationUnit, dur: t.time.scheduleDuration, min: t.time.durationMinutes ?? null,
  dates: [t.time.scheduleStart, t.time.scheduleFinish, t.time.earlyStart, t.time.earlyFinish],
}]));

const before = openAndRecalc(buildProject());
const ifc = writeIFC(buildWriteIFCInput(before, 'planOnly'));

{
  const lines = ifc.split('\n');
  const calProps = (name: string): string[] => {
    const calLine = lines.find((l) => l.includes('IFCWORKCALENDAR(') && l.includes(`'${name}'`));
    const calId = calLine?.match(/^#(\d+)=/)?.[1];
    if (!calId) return ['<kalender niet gevonden>'];
    const rel = lines.find((l) => l.includes('IFCRELDEFINESBYPROPERTIES(') && new RegExp(`\\(#${calId}\\)`).test(l));
    const psetId = rel?.match(/,#(\d+)\);\s*$/)?.[1];
    const pset = psetId ? lines.find((l) => l.startsWith(`#${psetId}=`)) : undefined;
    if (!pset || !pset.includes("'OPS_Calendar'")) return [];
    const refs = [...(pset.match(/\(([^()]*)\)\);\s*$/)?.[1] ?? '').matchAll(/#(\d+)/g)].map((m) => m[1]);
    return refs.map((r) => lines.find((l) => l.startsWith(`#${r}=`)) ?? '')
      .map((l) => l.replace(/^#\d+=IFCPROPERTYSINGLEVALUE\('([^']+)',\$,(.*),\$\);\s*$/, '$1=$2'));
  };
  same('§1 projectkalender 0–24: HoursPerDay 8 en IsHourCalendar .F.', calProps('global'),
    ['HoursPerDay=IFCREAL(8.)', 'IsHourCalendar=IFCBOOLEAN(.F.)']);
  same('§1 bibliotheekkalender 0–24: HoursPerDay 8 en IsHourCalendar .F.', calProps('Bibliotheek 24 uur'),
    ['HoursPerDay=IFCREAL(8.)', 'IsHourCalendar=IFCBOOLEAN(.F.)']);
  same('§1 gewone dagkalender 08–16: LiteralTimes houdt de bron scalaire kalender', calProps('Gewoon'),
    ['LiteralTimes=IFCBOOLEAN(.T.)', 'IsHourCalendar=IFCBOOLEAN(.F.)']);
}

{
  same('§2 voorwaarde: vóór opslaan is de 0–24-kalender een dagkalender met 8 uur per dag', calView(before).global,
    { workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 8, workTime: null });
  const after = openAndRecalc(await parseOpenedFile({ name: 'hele-dag.ifc', text: ifc }));
  same('§2 kalenders gelijk na opslaan als IFC en heropenen', calView(after), calView(before));
  same('§2 taakduur en F5-datums gelijk na opslaan als IFC en heropenen', taskView(after), taskView(before));
  const again = openAndRecalc(await parseOpenedFile({ name: 'hele-dag-2.ifc', text: writeIFC(buildWriteIFCInput(after, 'planOnly')) }));
  same('§2 tweede rondgang: kalenders en taken ongewijzigd', [calView(again), taskView(again)], [calView(before), taskView(before)]);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ${f}`);
  console.log(`XX  check-ifc-dagkalender-hele-dag: ${failures.length} van ${checks} controles mislukt`);
  process.exit(1);
}
console.log(`OK  check-ifc-dagkalender-hele-dag: ${checks} controles groen`);
