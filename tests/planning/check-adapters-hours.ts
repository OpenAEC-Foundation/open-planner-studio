// Adapter-uur-precisie-checks (fase 2.8b golf 4, ontwerpdoc §7). Permanent bewaakt via
// `bash tests/planning/run.sh`. Twee bewijzen:
//   1. UUR-ROUND-TRIP per formaat (IFC/P6/MSPDI): een uur-project (H8-band-projectkalender +
//      nachtploeg (wrap) + split-shift + taak 20u + lag 4u + taak-kalender-toewijzing) → schrijven →
//      lezen → `durationMinutes`/banden/echte-tijden/`lagMinutes` moeten exact terugkomen.
//   2. DAG-BESTAND-DISCRIMINATOR: een echt dag-example (IFC) → export naar P6/MSPDI → import: geen
//      `workTime`/`durationMinutes`-lek en identieke leaf-schedule (bewijst dat de discriminator een
//      dag-bestand dag houdt).
// De P6/MSPDI-readers gebruiken de browser-`DOMParser`; in Node leveren we die via een minimale shim.
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Project } from '@/types/project';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

let checks = 0;
let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}
function eq(name: string, got: unknown, want: unknown): void {
  assert(JSON.stringify(got) === JSON.stringify(want), `${name}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}

// ── Uur-model ────────────────────────────────────────────────────────────
const weekBands = (list: [number, number][]): WorkTimeBands['byWeekday'] => {
  const bw = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (let d = 1; d <= 5; d++) bw[d as 1] = list.map(([s, e]) => ({ start: s, end: e }));
  return bw;
};
const H8: WorkCalendar = {
  id: 'cal-h8', name: 'H8', description: 'ma-vr 08-16', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: { byWeekday: weekBands([[480, 960]]) },
};
const NIGHT: WorkCalendar = {
  id: 'cal-night', name: 'Nachtploeg', description: 'ma-vr 22-06', workDays: [1, 2, 3, 4, 5],
  workStartHour: 22, workEndHour: 6, hoursPerDay: 8, holidays: [], workTime: { byWeekday: weekBands([[1320, 1800]]) }, shift: 'THIRD',
};
const BREAK: WorkCalendar = {
  id: 'cal-break', name: 'Pauze', description: 'split-shift', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: { byWeekday: weekBands([[480, 720], [750, 990]]) }, shift: 'SECOND',
};
const project: Project = {
  id: 'p', name: 'Uur', description: '', startDate: '2026-07-06', endDate: '2026-07-31',
  calendarId: 'cal-h8', createdAt: '2026-07-06T00:00', modifiedAt: '2026-07-06T00:00', author: 'T', company: 'C',
};
const mk = (id: string, name: string, wbs: string, start: string, finish: string, minutes: number, calId?: string): Task => ({
  id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
  priority: 500, parentId: null, childIds: [],
  time: {
    durationType: 'WORKTIME', scheduleDuration: minutes / 480, durationMinutes: minutes,
    scheduleStart: start, scheduleFinish: finish, earlyStart: start, earlyFinish: finish,
    lateStart: start, lateFinish: finish, freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
  resourceIds: [], ...(calId ? { calendarId: calId } : {}),
});
const tasks = [
  mk('t-a', 'Metselen', '1', '2026-07-06T08:00', '2026-07-08T12:00', 1200),
  mk('t-b', 'Nachtwerk', '2', '2026-07-13T22:00', '2026-07-14T06:00', 480, 'cal-night'),
  mk('t-c', 'Afbouw', '3', '2026-07-20T08:00', '2026-07-21T10:30', 600, 'cal-break'),
];
const sequences: Sequence[] = [
  { id: 's1', predecessorId: 't-a', successorId: 't-b', type: 'FINISH_START', lagDays: 0, lagMinutes: 240 },
  { id: 's2', predecessorId: 't-b', successorId: 't-c', type: 'FINISH_START', lagDays: 0 },
];
const resources: Resource[] = [{ id: 'r', name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 }];
const assignments: ResourceAssignment[] = [{ id: 'a', taskId: 't-a', resourceId: 'r', unitsPerDay: 1 }];
const lib = [NIGHT, BREAK];

function roundTrip(label: string, tk: Task[], seq: Sequence[], cal: WorkCalendar, rcals: WorkCalendar[], supportsShift: boolean): void {
  const byName = new Map(tk.map(t => [t.name, t]));
  const calByName = new Map<string, WorkCalendar>([[cal.name, cal], ...rcals.map(c => [c.name, c] as const)]);
  eq(`${label} H8.bands`, cal.workTime?.byWeekday[1], [{ start: 480, end: 960 }]);
  eq(`${label} H8.hoursPerDay`, cal.hoursPerDay, 8);
  eq(`${label} Nacht.bands(wrap)`, calByName.get('Nachtploeg')?.workTime?.byWeekday[1], [{ start: 1320, end: 1800 }]);
  eq(`${label} Pauze.bands(split)`, calByName.get('Pauze')?.workTime?.byWeekday[1], [{ start: 480, end: 720 }, { start: 750, end: 990 }]);
  if (supportsShift) {
    eq(`${label} Nacht.shift`, calByName.get('Nachtploeg')?.shift, 'THIRD');
    eq(`${label} Pauze.shift`, calByName.get('Pauze')?.shift, 'SECOND');
  }
  eq(`${label} A.durationMinutes`, byName.get('Metselen')?.time.durationMinutes, 1200);
  eq(`${label} A.start`, byName.get('Metselen')?.time.scheduleStart, '2026-07-06T08:00');
  eq(`${label} B.durationMinutes`, byName.get('Nachtwerk')?.time.durationMinutes, 480);
  eq(`${label} B.start(22:00)`, byName.get('Nachtwerk')?.time.scheduleStart, '2026-07-13T22:00');
  eq(`${label} C.durationMinutes`, byName.get('Afbouw')?.time.durationMinutes, 600);
  const s1 = seq.find(s => tk.find(t => t.id === s.predecessorId)?.name === 'Metselen');
  eq(`${label} lag A→B lagMinutes`, s1?.lagMinutes, 240);
}

{
  const p = readIFC(writeIFC(project, H8, tasks, sequences, resources, assignments, [], [], lib));
  roundTrip('IFC', p.tasks, p.sequences, p.calendar, p.resourceCalendars, true);
}
{
  const p = readP6XML(writeP6XML(project, H8, tasks, sequences, resources, assignments, lib));
  roundTrip('P6', p.tasks, p.sequences, p.calendar, p.resourceCalendars, false);
}
{
  const p = readMSPDI(writeMSPDI(project, H8, tasks, sequences, resources, assignments, lib));
  roundTrip('MSPDI', p.tasks, p.sequences, p.calendar, p.resourceCalendars, false);
}

// ── Dag-bestand-discriminator (geen uur-lek + identieke leaf-schedule) ──────
{
  const src = readFileSync(join(process.cwd(), 'examples', '03-kantoorgebouw-zuidas.ifc'), 'utf8');
  const M = readIFC(src);
  const startOf = (t: Task) => (t.time.earlyStart || t.time.scheduleStart).substring(0, 10);
  const digest = (ts: Task[]) => ts.filter(t => t.childIds.length === 0)
    .map(t => `${t.name}|${t.time.scheduleDuration}|${startOf(t)}`).sort().join('\n');
  const base = digest(M.tasks);
  const p6 = readP6XML(writeP6XML(M.project, M.calendar, M.tasks, M.sequences, M.resources, M.assignments, M.resourceCalendars));
  const msp = readMSPDI(writeMSPDI(M.project, M.calendar, M.tasks, M.sequences, M.resources, M.assignments, M.resourceCalendars));
  eq('P6-example leaf-schedule', digest(p6.tasks), base);
  eq('MSPDI-example leaf-schedule', digest(msp.tasks), base);
  assert([p6.calendar, ...p6.resourceCalendars].every(c => !c.workTime), 'P6-example: geen workTime-lek');
  assert(p6.tasks.every(t => t.time.durationMinutes == null), 'P6-example: geen durationMinutes-lek');
  assert([msp.calendar, ...msp.resourceCalendars].every(c => !c.workTime), 'MSPDI-example: geen workTime-lek');
  assert(msp.tasks.every(t => t.time.durationMinutes == null), 'MSPDI-example: geen durationMinutes-lek');
}

if (fails === 0) {
  console.log(`OK  adapters-hours: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  adapters-hours: ${fails}/${checks} checks GEFAALD`);
  process.exit(1);
}
