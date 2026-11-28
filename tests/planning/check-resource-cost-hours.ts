import './domStub';
import { createAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { assignmentDayUnits } from '@/engine/scheduler/ResourceLoad';
import { workDaySlotsToPeriods } from '@/engine/contour/contourEdit';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import type { AppState } from '@/state/appStore';
import { resourceCostTotals } from '@/utils/resourceCostTotals';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
const r2 = (n: number | undefined) => (n === undefined ? undefined : Math.round(n * 100) / 100);

function panelCost(s: AppState, resourceId: string): number | undefined {
  return resourceCostTotals(s.resources, s.assignments, s.resourceLoadResult?.hours)[resourceId];
}

function contourDialogHours(s: AppState, taskId: string, resourceId: string): number {
  const task = s.tasks.find((t) => t.id === taskId)!;
  const a = s.assignments.find((x) => x.taskId === taskId && x.resourceId === resourceId)!;
  const engine = new CalendarEngine(calendarForEngine(resolveCalendar(task.calendarId, s.calendars, s.calendar)));
  const mpd = engine.hoursPerDay * 60;
  const siblings = s.assignments.filter((x) => x.taskId === taskId);
  return assignmentDayUnits(task, a, mpd, undefined, siblings).reduce((sum, u) => sum + u * mpd, 0) / 60;
}

function mspdiWorkHours(s: AppState, resourceId: string): number | undefined {
  const xml = writeMSPDI(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments, s.calendars);
  const uid = /<Resource>[\s\S]*?<UID>(\d+)<\/UID>[\s\S]*?<Name>([^<]*)<\/Name>/g;
  const name = s.resources.find((r) => r.id === resourceId)!.name;
  let resUid: string | undefined;
  for (let m = uid.exec(xml); m; m = uid.exec(xml)) if (m[2] === name) resUid = m[1];
  const asg = [...xml.matchAll(/<Assignment>([\s\S]*?)<\/Assignment>/g)].map((m) => m[1])
    .find((body) => new RegExp(`<ResourceUID>${resUid}</ResourceUID>`).test(body));
  const work = asg ? /<Work>PT(\d+)H(\d+)M/.exec(asg) : null;
  return work ? Number(work[1]) + Number(work[2]) / 60 : undefined;
}

const store = createAppStore();
const S = () => store.getState();
S().setProject({ startDate: '2026-06-01' });
const longCal = S().addCalendar({
  name: 'Lange dagen', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 6, workEndHour: 16, hoursPerDay: 10, holidays: [],
});
const lang = S().addTask({ name: 'Bekisting', time: createDefaultTaskTime('2026-06-01', 5) });
S().setTaskCalendar(lang, longCal);
const timmerman = S().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 50 });
S().assignResource(lang, timmerman, 1);
S().runCPM();

eq('1a projectkalender blijft 8 u (anders toetst dit niets)', S().calendar.hoursPerDay, 8);
eq('1b belaste uren = 5 d × 10 u (taakkalender)', r2(S().resourceLoadResult?.hours?.[timmerman]), 50);
eq('1c contourdialoog zegt hetzelfde', r2(contourDialogHours(S(), lang, timmerman)), 50);
eq('1d MSPDI <Work> zegt hetzelfde', mspdiWorkHours(S(), timmerman), 50);
eq('1e kolom Totaal = 50 u × €50', r2(panelCost(S(), timmerman)), 2500);

const kort = S().addTask({ name: 'Stort', time: createDefaultTaskTime('2026-06-08', 2) });
S().assignResource(kort, timmerman, 0.5);
S().runCPM();
eq('2a uren tellen per toewijzing op de eigen taakkalender (50 + 2 × 0,5 × 8)', r2(S().resourceLoadResult?.hours?.[timmerman]), 58);
eq('2b kolom Totaal volgt', r2(panelCost(S(), timmerman)), 2900);

const mpdLang = 10 * 60;
const asg = S().assignments.find((a) => a.taskId === lang && a.resourceId === timmerman)!;
S().setAssignmentContour(asg.id, workDaySlotsToPeriods([600, 600, 300, 300, 0], undefined, mpdLang));
eq('3a contour: de contourdialoog telt 30 u', r2(contourDialogHours(S(), lang, timmerman)), 30);
eq('3b contour: de belasting telt 30 u + 8 u', r2(S().resourceLoadResult?.hours?.[timmerman]), 38);
eq('3c contour: kolom Totaal volgt', r2(panelCost(S(), timmerman)), 1900);

const kraan = S().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
S().assignResource(kort, kraan, 1);
const reserve = S().addResource({ name: 'Reserve', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 40 });
S().runCPM();
eq('4a geen tarief ⇒ geen bedrag', panelCost(S(), kraan), undefined);
eq('4b geen toewijzing ⇒ geen bedrag', panelCost(S(), reserve), undefined);

const leges = S().addResource({ name: 'Leges', type: 'COST', description: '', maxUnits: 1 });
S().assignResource(kort, leges, 1, undefined, 1250.55);
S().assignResource(lang, leges, 1, undefined, 0);
S().runCPM();
eq('5a kosten: Totaal = 1250,55 + 0', r2(panelCost(S(), leges)), 1250.55);
eq('5b kosten: geen belaste uren', S().resourceLoadResult?.hours?.[leges] ?? null, null);
S().setAssignmentCost(S().assignments.find((a) => a.resourceId === leges && a.taskId === kort)!.id, undefined);
S().setAssignmentCost(S().assignments.find((a) => a.resourceId === leges && a.taskId === lang)!.id, undefined);
eq('5c kosten zonder bedrag ⇒ geen Totaal', panelCost(S(), leges), undefined);
eq('5d werkresource ongewijzigd', r2(panelCost(S(), timmerman)), 1900);

if (diffs.length) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`resource-cost-hours: ${checks - diffs.length}/${checks} groen`);
  process.exit(1);
}
console.log(`OK  resource-cost-hours: ${checks}/${checks} groen`);
