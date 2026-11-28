import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { flattenOrder } from '@/utils/wbs';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Project } from '@/types/project';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

let checks = 0;
let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`XX ${msg}`); }
}
function eq(name: string, got: unknown, want: unknown): void {
  assert(JSON.stringify(got) === JSON.stringify(want), `${name}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}

const H8: WorkCalendar = {
  id: 'cal-h8', name: 'Standaard', description: 'ma-vr 08-16', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const H10: WorkCalendar = {
  id: 'cal-h10', name: 'Tien', description: 'ma-vr 07-17', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 17, hoursPerDay: 10, holidays: [],
};
const H24: WorkCalendar = {
  id: 'cal-247', name: '24/7', description: 'continu', workDays: [1, 2, 3, 4, 5, 6, 7],
  workStartHour: 0, workEndHour: 24, hoursPerDay: 24, holidays: [],
};
const project: Project = {
  id: 'p', name: 'Rest', description: '', startDate: '2026-09-07', endDate: '2026-10-30',
  calendarId: 'cal-h8', createdAt: '2026-09-07T00:00', modifiedAt: '2026-09-07T00:00', author: 'T', company: 'C',
};
const mk = (id: string, name: string, wbs: string, days: number, parentId: string | null, childIds: string[], extra: Partial<Task> = {}): Task => ({
  id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
  priority: 500, parentId, childIds,
  time: {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: days,
    scheduleStart: '2026-09-07', scheduleFinish: '2026-09-11', earlyStart: '2026-09-07', earlyFinish: '2026-09-11',
    lateStart: '2026-09-07', lateFinish: '2026-09-11', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
  resourceIds: [], ...extra,
});
const treeTasks = (): Task[] => [
  mk('R', 'Project', 'PRJ', 20, null, ['S1', 'S2']),
  mk('S1', 'Voorbereiding', 'A', 10, 'R', ['a', 'b']),
  mk('S2', 'Ruwbouw', 'B', 10, 'R', ['c']),
  mk('a', 'Bouwplaats', 'A-01', 3, 'S1', []),
  mk('b', 'Vergunningen', 'A-02', 7, 'S1', []),
  mk('c', 'Fundering', 'B-01', 10, 'S2', []),
];
const WANT_ORDER_NAMES = ['Project', 'Voorbereiding', 'Bouwplaats', 'Vergunningen', 'Ruwbouw', 'Fundering'];
const parentName = (tasks: readonly Task[], n: string) => { const t = tasks.find(x => x.name === n)!; return t.parentId ? tasks.find(x => x.id === t.parentId)!.name : null; };

{
  const tasks = [
    mk('p', 'Op projectkalender', '1', 5, null, [], { time: { ...mk('x', 'x', 'x', 5, null, []).time, remainingTime: 5 } }),
    mk('q', 'Op 24/7-kalender', '2', 7, null, [], { calendarId: 'cal-247', time: { ...mk('x', 'x', 'x', 7, null, []).time, remainingTime: 7 } }),
  ];
  const xml = writeP6XML(project, H8, tasks, [], [], [], [H24]);
  const blocks = xml.match(/<Activity>[\s\S]*?<\/Activity>/g) ?? [];
  const get = (blk: string, tag: string) => (blk.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) ?? [])[1] ?? '';
  const q = blocks.find(b => b.includes('<Name>Op 24/7-kalender</Name>'))!;
  eq('1a P6 PlannedDuration 7 d × 24 u', get(q, 'PlannedDuration'), '168');
  eq('1b P6 RemainingDuration op dezelfde kalender (was 56)', get(q, 'RemainingDuration'), '168');
  const back = readP6XML(xml);
  const qb = back.tasks.find(t => t.name === 'Op 24/7-kalender')!;
  eq('1c terug: duur 7 en restduur 7', [qb.time.scheduleDuration, qb.time.remainingTime], [7, 7]);
  const pb = back.tasks.find(t => t.name === 'Op projectkalender')!;
  eq('1d projectkalender-taak ongewijzigd: 5/5', [pb.time.scheduleDuration, pb.time.remainingTime], [5, 5]);
}

{
  const tasks = treeTasks();
  const xml = writeP6XML(project, H8, tasks, [], [], []);
  const wbsBlocks = xml.match(/<WBS>[\s\S]*?<\/WBS>/g) ?? [];
  const get = (blk: string, tag: string) => (blk.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) ?? [])[1] ?? '';
  eq('2a WBS-elementen diepte-eerst (ouder vóór kind)', wbsBlocks.map(b => get(b, 'Name')), ['Project', 'Voorbereiding', 'Ruwbouw']);
  const seqNrs = wbsBlocks.map(b => Number(get(b, 'SequenceNumber')));
  assert(seqNrs.every(n => Number.isInteger(n) && n > 0) && seqNrs[0] < seqNrs[1] && seqNrs[1] < seqNrs[2], `2b SequenceNumber oplopend, kreeg ${JSON.stringify(seqNrs)}`);
  const actBlocks = xml.match(/<Activity>[\s\S]*?<\/Activity>/g) ?? [];
  eq('2c activiteiten in boomvolgorde', actBlocks.map(b => get(b, 'Name')), ['Bouwplaats', 'Vergunningen', 'Fundering']);
  const back = readP6XML(xml);
  eq('2d lezer levert boomvolgorde (was: samenvattingen eerst)', back.tasks.map(t => t.name), WANT_ORDER_NAMES);
  eq('2e …met de juiste ouders', WANT_ORDER_NAMES.map(n => parentName(back.tasks, n)), [null, 'Project', 'Voorbereiding', 'Voorbereiding', 'Project', 'Ruwbouw']);
  eq('2f flattenOrder van het resultaat is een no-op', flattenOrder(back.tasks).map(t => t.id), back.tasks.map(t => t.id));
}

{
  const tasks = [mk('t', 'Grondwerk', '1', 5, null, [])];
  const ifc = writeIFC({ project: { ...project, calendarId: 'cal-h10' }, calendar: H10, tasks, sequences: [], resources: [], assignments: [], resourceCalendars: [] });
  assert(ifc.includes("'P0Y0M5D'"), '3a opzet: de writer schrijft de dagduur als P0Y0M5D');
  const foreign = ifc.replace("'P0Y0M5D'", "'PT50H'");
  const back = readIFC(foreign);
  eq('3b kalender terug op 10 u/dag', back.calendar.hoursPerDay, 10);
  const t = back.tasks[0];
  eq('3c PT50H op 10 u/dag = 5 dagen (was ceil(50/8) = 7)', t.time.scheduleDuration, 5);
  eq('3d …als uur-taak met 3000 minuten (bestaande identiteitsregel PT… = uren)', [t.time.durationUnit, t.time.durationMinutes], ['hours', 3000]);
}

{
  const tasks = treeTasks();
  tasks.find(t => t.id === 'S2')!.isMilestone = true;
  const ifc = writeIFC({ project, calendar: H8, tasks, sequences: [], resources: [], assignments: [], resourceCalendars: [] });
  const back = readIFC(ifc);
  const s2 = back.tasks.find(t => t.name === 'Ruwbouw')!;
  eq('4a IFC-round-trip bewaart isMilestone óók op een taak met kinderen', [s2.isMilestone, s2.childIds.length], [true, 1]);
  eq('4b de boom is intact', WANT_ORDER_NAMES.map(n => parentName(back.tasks, n)), [null, 'Project', 'Voorbereiding', 'Voorbereiding', 'Project', 'Ruwbouw']);
}

{
  const tasks = [mk('t', 'Grondwerk', '1', 5, null, [], { time: { ...mk('x', 'x', 'x', 5, null, []).time, totalFloat: 3, freeFloat: 2 } })];
  const ifc = writeIFC({ project: { ...project, calendarId: 'cal-h10' }, calendar: H10, tasks, sequences: [], resources: [], assignments: [], resourceCalendars: [] });
  assert(ifc.includes("'P0Y0M3D'") && ifc.includes("'P0Y0M2D'"), '5a opzet: speling als P0Y0M3D / P0Y0M2D');
  const foreign = ifc.replace("'P0Y0M3D'", "'PT30H'").replace("'P0Y0M2D'", "'PT20H'");
  const t = readIFC(foreign).tasks[0];
  eq('5b totalFloat PT30H op 10 u/dag = 3 (was ceil(30/8) = 4)', t.time.totalFloat, 3);
  eq('5c freeFloat PT20H op 10 u/dag = 2 (was 3)', t.time.freeFloat, 2);
}

{
  const tasks = treeTasks();
  const xml = writeP6XML(project, H8, tasks, [], [], []);
  const wbsBlocks = xml.match(/<WBS>[\s\S]*?<\/WBS>/g)!;
  const voorb = wbsBlocks.find(b => b.includes('<Name>Voorbereiding</Name>'))!;
  const ruw = wbsBlocks.find(b => b.includes('<Name>Ruwbouw</Name>'))!;
  const swapped = xml.replace(voorb, '\u0000').replace(ruw, voorb).replace('\u0000', ruw);
  assert(swapped.indexOf('<Name>Ruwbouw</Name>') < swapped.indexOf('<Name>Voorbereiding</Name>'), '6a opzet: Ruwbouw staat nu vóór Voorbereiding in het bestand');
  const back = readP6XML(swapped);
  eq('6b lezer herstelt de broervolgorde uit SequenceNumber', back.tasks.map(t => t.name), WANT_ORDER_NAMES);
  const noSeq = swapped.replace(/\s*<SequenceNumber>\d+<\/SequenceNumber>/g, '');
  eq('6c zonder SequenceNumber geldt de documentvolgorde', readP6XML(noSeq).tasks.map(t => t.name), ['Project', 'Ruwbouw', 'Fundering', 'Voorbereiding', 'Bouwplaats', 'Vergunningen']);
}

if (fails === 0) {
  console.log(`OK  check-adapters-hierarchy-rest: alles groen (${checks} checks)`);
  process.exit(0);
} else {
  console.log(`check-adapters-hierarchy-rest: ${fails}/${checks} checks gefaald`);
  process.exit(1);
}
