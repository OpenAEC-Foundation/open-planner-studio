// F4b (spec "alleen uren" §3.6, B4): wat een planner in een datumveld van een taak typt, met en zonder tijd.
//
// Het veld (`TaskDateTimeInput`) toont wat de tabel toont: de datum, en een tijd als het moment midden op
// de werkdag valt. Een datum zonder tijd zet de store op de dagrand van het veld (D1 begin, D2 einde, D7
// mijlpaal; getoetst in check-minute-model). Hier: de pure kern van het tijdveld en de koppeling in de
// taakvelden.
//  - Een getypte tijd hoort bij de getoonde datum; bij een werkdag zonder tijd valt hij binnen die werkdag
//    (nachtploeg: 05:00 bij "wo" is do 05:00).
//  - De tijd leegmaken geeft de datum zonder tijd terug: de store zet die op de dagrand.
//  - Een stap (pijl omhoog of omlaag) gaat een kwartier vanaf het moment.
import './domStub';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { TaskDateTimeInput, timeCommitValue, timeStepValue } from '@/components/common/TaskDateTimeInput';
import { useAppStore } from '@/state/appStore';
import { taskDateClock, taskDateLabel } from '@/utils/taskDateLabel';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

type Band = { start: number; end: number };
const week = (bands: Band[], days: number[] = [1, 2, 3, 4, 5]): WorkTimeBands => ({
  byWeekday: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, days.includes(d) ? bands : []])) as WorkTimeBands['byWeekday'],
});
const cal = (id: string, workTime: WorkTimeBands, workDays = [1, 2, 3, 4, 5]): WorkCalendar => ({
  id, name: id, description: '', workDays, workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime,
});
// De standaardkalender van B4: 07:00–12:00 + 13:00–16:00 op ma–vr.
const standard = cal('std', week([{ start: 420, end: 720 }, { start: 780, end: 960 }]));
// Nachtploeg 22:00–06:00 op ma–vr; het blok hoort bij de dag waarop het begint.
const night = cal('nacht', week([{ start: 1320, end: 1800 }]));
const allDay = cal('24u', week([{ start: 0, end: 1440 }], [1, 2, 3, 4, 5, 6, 7]), [1, 2, 3, 4, 5, 6, 7]);

function task(time: Partial<TaskTime> = {}, extra: Partial<Task> = {}): Task {
  return {
    id: extra.id ?? 't', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], activityCodes: {}, customFields: {},
    ...extra,
    time: { ...createDefaultTaskTime('2026-06-01', 1, 'days'), ...time },
  } as Task;
}
const dayTask = task();

// ── 1. Een tijd typen ────────────────────────────────────────────────────────────────────────────
same('tijd bij een werkdag zonder tijd: die datum met die tijd',
  timeCommitValue('13:00', '2026-06-03', '2026-06-03T07:00'), '2026-06-03T13:00');
same('tijd bij een moment: dezelfde klokdatum, de nieuwe tijd',
  timeCommitValue('14:30', '2026-06-03T13:00', '2026-06-03T13:00'), '2026-06-03T14:30');
same('dezelfde tijd als nu: niets te committen',
  timeCommitValue('13:00', '2026-06-03T13:00', '2026-06-03T13:00'), null);
same('ook zonder dubbele punt ("1330")', timeCommitValue('1330', '2026-06-03', '2026-06-03T07:00'), '2026-06-03T13:30');
same('onleesbaar: niets', timeCommitValue('kwart over', '2026-06-03', '2026-06-03T07:00'), null);
same('25:00 bestaat niet: niets', timeCommitValue('25:00', '2026-06-03', '2026-06-03T07:00'), null);
same('24:00 is geen tijd van een dag: niets', timeCommitValue('24:00', '2026-06-05', '2026-06-05T16:00'), null);
same('zonder datum: niets', timeCommitValue('13:00', '', ''), null);

// ── 2. De tijd leegmaken ─────────────────────────────────────────────────────────────────────────
same('tijd leegmaken bij een moment: de datum zonder tijd (de store zet de dagrand)',
  timeCommitValue('', '2026-06-03T13:00', '2026-06-03T13:00'), '2026-06-03');
same('leeg bij een werkdag zonder tijd: niets (er stond geen tijd)',
  timeCommitValue('  ', '2026-06-03', '2026-06-03T07:00'), null);

// ── 3. Een getypte tijd valt binnen de getoonde werkdag (nachtploeg) ─────────────────────────────
const nightClock = taskDateClock(dayTask, night);
// Einde do 06:00 = einde van het blok van wo: het veld toont "wo" zonder tijd.
same('nachtploeg: het einde do 06:00 toont "wo"', taskDateLabel(dayTask, '2026-06-04T06:00', 'end', night), '2026-06-03');
same('nachtploeg: 05:00 bij "wo" is do 05:00 (binnen het blok van wo)',
  timeCommitValue('05:00', '2026-06-03', '2026-06-04T06:00', nightClock), '2026-06-04T05:00');
same('nachtploeg: 23:00 bij "wo" is wo 23:00',
  timeCommitValue('23:00', '2026-06-03', '2026-06-04T06:00', nightClock), '2026-06-03T23:00');
same('nachtploeg: 12:00 ligt in geen van beide, het blijft wo 12:00',
  timeCommitValue('12:00', '2026-06-03', '2026-06-04T06:00', nightClock), '2026-06-03T12:00');
same('nachtploeg met getoonde tijd: de klokdatum blijft (do 02:00 → do 03:00)',
  timeCommitValue('03:00', '2026-06-04T02:00', '2026-06-04T02:00', nightClock), '2026-06-04T03:00');
same('standaardkalender: 06:00 bij "wo" blijft wo 06:00 (geen blok over middernacht)',
  timeCommitValue('06:00', '2026-06-03', '2026-06-03T07:00', taskDateClock(dayTask, standard)), '2026-06-03T06:00');
// 24:00-regel: einde za 00:00 op een 24-uurskalender toont "vr"; 18:00 is vr 18:00.
same('24:00-regel: het einde za 00:00 toont "vr"', taskDateLabel(dayTask, '2026-06-06T00:00', 'end', allDay), '2026-06-05');
same('24:00-regel: 18:00 bij "vr" is vr 18:00',
  timeCommitValue('18:00', '2026-06-05', '2026-06-06T00:00', taskDateClock(dayTask, allDay)), '2026-06-05T18:00');

// ── 4. Een stap van het tijdveld ─────────────────────────────────────────────────────────────────
same('stap omhoog vanaf de getoonde tijd', timeStepValue('2026-06-03T13:00', '2026-06-03T13:00', 15), '2026-06-03T13:15');
same('stap omlaag over middernacht', timeStepValue('2026-06-04T00:00', '2026-06-04T00:00', -15), '2026-06-03T23:45');
same('stap zonder getoonde tijd: vanaf het opgeslagen moment', timeStepValue('2026-06-04', '2026-06-04T06:00', -15), '2026-06-04T05:45');
same('stap zonder moment: niets', timeStepValue('2026-06-04', '2026-06-04', 15), null);
same('stap zonder waarde: niets', timeStepValue('', '', 15), null);

// ── 5. Het veld toont de datum en de tijd van B4 ─────────────────────────────────────────────────
useAppStore.setState(s => { s.calendar = standard; s.calendars = [standard]; });
function render(value: string, side: 'start' | 'end', t: Task = dayTask): { date: string; time: string } {
  const html = renderToStaticMarkup(createElement(TaskDateTimeInput, {
    task: t, value, side, onCommit: () => undefined, ariaLabel: 'Start', dataAttribute: 'probe',
  }));
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map(m => m[0]);
  const valueOf = (tag: string) => /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? '';
  // De datumsegmenten van DateTextInput (dag, maand, jaar) en het tijdveld.
  const segs = inputs.filter(tag => tag.includes('inputMode="numeric"')).map(valueOf);
  const timeTag = inputs.find(tag => tag.includes('data-ops-task-date-time-input="probe"'));
  const time = timeTag ? valueOf(timeTag) : '<geen tijdveld>';
  return { date: segs.join('-'), time };
}
same('veld: start na de pauze toont datum en tijd', render('2026-06-03T13:00', 'start'), { date: '03-06-2026', time: '13:00' });
same('veld: start op het begin van de werkdag toont geen tijd', render('2026-06-01T07:00', 'start'), { date: '01-06-2026', time: '' });
same('veld: einde op het einde van de werkdag toont geen tijd', render('2026-06-05T16:00', 'end'), { date: '05-06-2026', time: '' });
same('veld: einde om 07:00 toont de tijd', render('2026-06-02T07:00', 'end'), { date: '02-06-2026', time: '07:00' });
same('veld: leeg veld toont niets', render('', 'end'), { date: '--', time: '' });

// ── 6. De taakvelden gebruiken het veld met de kant van hun datum ───────────────────────────────
const root = resolvePath(fileURLToPath(new URL('.', import.meta.url)), '../../src');
const src = (...p: string[]) => readFileSync(resolvePath(root, ...p), 'utf8');
function fields(file: string): string[] {
  return [...file.matchAll(/<TaskDateTimeInput\b([\s\S]*?)\/>/g)].map(m => {
    const side = /side=(?:"(start|end)"|\{([^}]*)\})/.exec(m[1]);
    const data = /dataAttribute="([^"]+)"/.exec(m[1]);
    const own = /milestoneOwn=\{false\}/.test(m[1]) ? ':eigen-kant' : '';
    return `${data?.[1]}=${side?.[1] ?? side?.[2]}${own}`;
  });
}
same('paneel: Start', fields(src('components', 'task-sections', 'TaskTimeFields.tsx')), ['start=start']);
same('dialoog: Startdatum', fields(src('components', 'dialogs', 'TaskDialog.tsx')), ['dialog-start=start']);
same('voortgang: werkelijke datum, start en einde', fields(src('components', 'task-sections', 'TaskProgressFields.tsx')),
  ['actual-date=end', 'actual-start=start', 'actual-finish=end']);
same('beperkingen: kant volgens het type, zonder mijlpaalregel', fields(src('components', 'task-sections', 'TaskConstraintFields.tsx')),
  ["constraint=constraintDateSide(task.constraint.type) ?? 'start':eigen-kant", "constraint2=constraintDateSide(task.constraint2.type) ?? 'start':eigen-kant"]);
same('deadline: eindachtig, zonder mijlpaalregel', fields(src('components', 'task-sections', 'TaskDeadlineField.tsx')), ['deadline=end:eigen-kant']);

if (failures.length > 0) {
  for (const f of failures) console.log(`   XX ${f}`);
  console.error(`\nTOTAAL: ${failures.length}/${checks} afwijking(en)`);
  process.exit(1);
}
console.log(`   OK ${checks} controles op de datuminvoer (F4b, §3.6)`);
console.log('\nTOTAAL: alles groen');
process.exit(0);
