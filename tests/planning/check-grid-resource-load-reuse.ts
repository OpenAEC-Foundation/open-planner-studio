// Een rasterbewerking die de resourcebelasting niet raakt, rekent haar niet opnieuw uit —
// prestatiemeting rehab-2 (2026-10-07).
//
// AANLEIDING. `prepareGridMutation` riep na ELKE celbewerking `computeReliableResourceLoad` aan,
// ook bij een naamwijziging: 0,75 s per bewerking op rehab-2.xer (52.640 toewijzingen). Nu wordt
// het vorige resultaat hergebruikt als (a) resources, toewijzingen, kalenders en het CPM-resultaat
// dezelfde objecten zijn en (b) elke gewijzigde taak alleen sleutels uit
// `RESOURCE_LOAD_NEUTRAL_TASK_KEYS` wijzigt.
//
// Wat dit pint:
//  1. De lijst zelf (exact; een wijziging is een bewuste, geteste keuze).
//  2. De belastingmotor leest GEEN van die sleutels (proxy op elke taak) — de lijst kan dus niet
//     stil een veld bevatten dat de belasting wél bepaalt.
//  3. Elk veld buiten de lijst dat de belasting bepaalt (duur, datums, kalender, splits, contour,
//     mijlpaal, structuur) leidt tot herberekening: de beslisfunctie zegt "niet hergebruiken". Een
//     veld dat opnieuw wordt geschreven met dezelfde inhoud (de naamcel schrijft `time` mee) niet.
//  4. Via de echte store: een naam- en notitiebewerking houdt hetzelfde resultaat-object; een
//     duurbewerking levert een nieuw resultaat dat gelijk is aan een verse berekening.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { computeReliableResourceLoad, computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { RESOURCE_LOAD_NEUTRAL_TASK_KEYS, resourceLoadInputsUnchanged } from '@/state/resourceLoadReuse';
import { parseTaskDurationInput } from '@/utils/taskDurationInput';
import type { CellEditIntent } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import { createLargeSchedule } from './largeScheduleFixture';

const fails: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  checks++;
  if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`);
};

// ── 1. De lijst ────────────────────────────────────────────────────────────────────────────────────
ok('1 neutrale taaksleutels exact vastgelegd',
  JSON.stringify([...RESOURCE_LOAD_NEUTRAL_TASK_KEYS].sort()) === JSON.stringify([
    'activityCodes', 'color', 'customFields', 'deadline', 'description', 'externalLinks', 'name', 'notes', 'priority', 'wbsCode',
  ]), JSON.stringify([...RESOURCE_LOAD_NEUTRAL_TASK_KEYS].sort()));

// ── 2. De motor leest geen neutrale sleutel ────────────────────────────────────────────────────────
const project = createLargeSchedule({ tasks: 600, assignmentsPerTask: 3, sequences: 600 });
{
  const read = new Set<string>();
  const proxied = project.tasks.map(t => new Proxy(t, {
    get(target, key, receiver) {
      if (typeof key === 'string') read.add(key);
      return Reflect.get(target, key, receiver) as unknown;
    },
  }));
  computeResourceLoad(project.resources, project.assignments, proxied, project.calendar, []);
  const leaked = [...RESOURCE_LOAD_NEUTRAL_TASK_KEYS].filter(k => read.has(k));
  ok('2 de belastingmotor leest geen neutrale taaksleutel', leaked.length === 0, leaked.join(', '));
  ok('2 de proxy zag de motor echt lezen (anders pint 2 niets)', read.has('time') && read.has('id'), [...read].join(', '));
}

// ── 3. De beslisfunctie ───────────────────────────────────────────────────────────────────────────
{
  const base = { tasks: project.tasks, assignments: project.assignments, resources: project.resources,
    calendar: project.calendar, calendars: [] as typeof project.calendar[], cpmResult: null };
  const leaf = project.tasks.findIndex(t => t.childIds.length === 0 && !t.isMilestone && t.resourceIds.length > 0);
  const withTask = (patch: Partial<Task>) => {
    const tasks = project.tasks.slice();
    tasks[leaf] = { ...tasks[leaf], ...patch };
    return { ...base, tasks };
  };
  ok('3a niets gewijzigd ⇒ hergebruiken', resourceLoadInputsUnchanged(base, { ...base }));
  ok('3b naam ⇒ hergebruiken', resourceLoadInputsUnchanged(base, withTask({ name: 'Nieuw' })));
  ok('3c naam + notities + kleur ⇒ hergebruiken', resourceLoadInputsUnchanged(base, withTask({ name: 'x', notes: [], color: '#123456' })));
  const t = project.tasks[leaf];
  const loadAffecting: [string, Partial<Task>][] = [
    ['duur', { time: { ...t.time, scheduleDuration: t.time.scheduleDuration + 1 } }],
    ['kalender', { calendarId: 'cal-x' }],
    ['mijlpaal', { isMilestone: true }],
    ['splits', { splitGaps: [] }],
    ['contour', { timephasedContours: [] }],
    ['structuur', { childIds: ['kind'] }],
    ['resourceIds', { resourceIds: [] }],
    ['status', { status: t.status }],
  ];
  for (const [label, patch] of loadAffecting) {
    // `status` met dezelfde waarde is een nieuw object-veld maar referentie-gelijk ⇒ hergebruik mag;
    // alle andere hierboven zijn nieuwe waarden ⇒ herberekenen.
    const want = label === 'status';
    ok(`3d ${label} ⇒ ${want ? 'hergebruiken (zelfde waarde)' : 'herberekenen'}`, resourceLoadInputsUnchanged(base, withTask(patch)) === want);
  }
  ok('3k `time` opnieuw geschreven met dezelfde inhoud ⇒ hergebruiken (zo doet de naamcel het)',
    resourceLoadInputsUnchanged(base, withTask({ name: 'y', time: { ...t.time } })));
  ok('3e andere taakvolgorde ⇒ herberekenen', !resourceLoadInputsUnchanged(base, { ...base, tasks: [...project.tasks].reverse() }));
  ok('3f taak erbij ⇒ herberekenen', !resourceLoadInputsUnchanged(base, { ...base, tasks: [...project.tasks, project.tasks[leaf]] }));
  ok('3g nieuwe toewijzingenlijst ⇒ herberekenen', !resourceLoadInputsUnchanged(base, { ...base, assignments: project.assignments.slice() }));
  ok('3h nieuwe resourcelijst ⇒ herberekenen', !resourceLoadInputsUnchanged(base, { ...base, resources: project.resources.slice() }));
  ok('3i nieuwe projectkalender ⇒ herberekenen', !resourceLoadInputsUnchanged(base, { ...base, calendar: { ...project.calendar } }));
  ok('3j nieuwe kalenderlijst ⇒ herberekenen', !resourceLoadInputsUnchanged(base, { ...base, calendars: [] }));
}

// ── 4. Via de store ───────────────────────────────────────────────────────────────────────────────
{
  const store = createAppStore();
  const S = () => store.getState();
  S().applyLoadedProject(createLargeSchedule({ tasks: 600, assignmentsPerTask: 3, sequences: 600 }), { filePath: null, recompute: true });
  const leaf = S().tasks.find(t => t.childIds.length === 0 && !t.isMilestone && t.resourceIds.length > 0)!;
  const cell = (columnId: string, route: CellEditIntent['route'], value: unknown): CellEditIntent =>
    ({ kind: 'cell-edit', taskId: leaf.id, columnId: columnId as CellEditIntent['columnId'], route, value });
  const before = S().resourceLoadResult;
  ok('4 opzet: belasting berekend', !!before && Object.keys(before.load).length > 0);

  ok('4a naambewerking slaagt', S().runGridMutation([cell('task.name', 'task-field', 'Hernoemd')]).ok);
  ok('4b naambewerking hergebruikt het belastingresultaat (zelfde object)', S().resourceLoadResult === before);

  const res = S().runGridMutation([cell('task.time.scheduleDuration', 'task-schedule',
    parseTaskDurationInput(`${leaf.time.scheduleDuration + 3}d`, 'days'))]);
  ok('4c duurbewerking slaagt', res.ok, JSON.stringify(res));
  const after = S().resourceLoadResult;
  ok('4d duurbewerking rekent opnieuw (nieuw object)', after !== before);
  const fresh = computeReliableResourceLoad(S().cpmResult, S().resources, S().assignments, S().tasks, S().calendar, S().calendars);
  ok('4e en dat resultaat is gelijk aan een verse berekening', JSON.stringify(after) === JSON.stringify(fresh));
  ok('4f de duur raakte de belasting echt (anders pint 4d/4e niets)', JSON.stringify(after) !== JSON.stringify(before));
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`grid-resource-load-reuse: ${fails.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`grid-resource-load-reuse: ${checks} checks groen`);
