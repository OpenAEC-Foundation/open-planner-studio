// Audit 2026-09-26 — de versnelde resource-leveler (PF-cache met stroomafwaartse invalidatie +
// heap voor de keuze) moet exact hetzelfde opleveren als de oude route (volledige CPM-solve per
// plaatsing + lineaire keuze). `LEVELER_TEST_HOOKS.incremental` schakelt tussen beide; deze check
// legt de volledige `LevelingResult` van beide routes naast elkaar op willekeurige projecten: alle
// relatietypen en lags (ook negatief), ALAP, hammock, SNET/FNLT, dag- en uurkalenders, elapsed duur,
// meerdere resources met afwijkende capaciteit, splitsen aan/uit, speling-begrenzing, scope en een
// uitloopplafond.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { levelResources, LEVELER_TEST_HOOKS, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment } from '@/types/resource';

const diffs: string[] = [];
let checks = 0;

let seed = 0x1234567;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const TYPES: SequenceType[] = ['FINISH_START', 'FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH'];

const DAY: WorkCalendar = {
  id: 'cal', name: 'dag', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
  holidays: [{ name: 'x', startDate: '2026-06-15', endDate: '2026-06-16' }],
};
const BAND = [{ start: 480, end: 960 }];
const HOUR = { ...DAY, id: 'uur', workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } } } as WorkCalendar;
const SIX: WorkCalendar = { ...DAY, id: 'zes', workDays: [1, 2, 3, 4, 5, 6] };

function project(rep: number) {
  const hours = rep % 3 === 2;
  const cal = hours ? HOUR : DAY;
  const n = 12 + Math.floor(rnd() * 30);
  const tasks: Task[] = [];
  const seqs: Sequence[] = [];
  const features = { alap: false, hammock: false };
  const allowAlap = rnd() < 0.35;
  for (let i = 0; i < n; i++) {
    const dur = rnd() < 0.08 ? 0 : 1 + Math.floor(rnd() * 5);
    const time = createDefaultTaskTime('2026-06-01', hours ? dur * 8 : dur, hours ? 'hours' as never : undefined) as Task['time'];
    if (!hours && rnd() < 0.08) time.durationType = 'ELAPSEDTIME';
    const t = {
      id: `t${i}`, name: `t${i}`, description: '', wbsCode: String(i), taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
      isMilestone: dur === 0, priority: pick([300, 500, 500, 700]), parentId: null, childIds: [], time, resourceIds: [],
    } as Task;
    const r = rnd();
    if (allowAlap && r < 0.07) { t.constraint = { type: 'ALAP' }; features.alap = true; }
    else if (r < 0.14) t.constraint = { type: 'SNET', date: '2026-06-08' };
    else if (r < 0.18) t.constraint = { type: 'FNLT', date: '2026-06-26' };
    if (!hours && rnd() < 0.08) t.calendarId = 'zes';
    tasks.push(t);
    const preds = i === 0 ? 0 : Math.floor(rnd() * 3);
    for (let k = 0; k < preds; k++) {
      const from = Math.floor(rnd() * i);
      seqs.push({ id: `s${from}-${i}-${k}`, predecessorId: `t${from}`, successorId: t.id, type: pick(TYPES), lagDays: pick([0, 0, 1, 2, -1]) });
    }
  }
  if (rnd() < 0.15 && n > 6) {
    // Hammock tussen twee willekeurige taken (start- en finish-driver).
    const h = tasks[n - 1];
    h.isHammock = true; h.isMilestone = false; features.hammock = true;
    seqs.push({ id: 'h-in', predecessorId: 't1', successorId: h.id, type: 'START_START', lagDays: 0 });
    seqs.push({ id: 'h-out', predecessorId: h.id, successorId: 't3', type: 'FINISH_FINISH', lagDays: 0 });
  }
  const resources: Resource[] = [
    { id: 'r1', name: 'r1', type: 'LABOR', description: '', maxUnits: 1 },
    { id: 'r2', name: 'r2', type: 'LABOR', description: '', maxUnits: 2 },
    { id: 'r3', name: 'r3', type: 'EQUIPMENT', description: '', maxUnits: 1 },
  ];
  const assignments: ResourceAssignment[] = [];
  for (const t of tasks) {
    if (t.isMilestone || t.isHammock) continue;
    if (rnd() < 0.7) assignments.push({ id: `a-${t.id}`, taskId: t.id, resourceId: pick(['r1', 'r2', 'r3']), unitsPerDay: pick([1, 1, 0.5, 2]) });
    if (rnd() < 0.15) assignments.push({ id: `b-${t.id}`, taskId: t.id, resourceId: 'r3', unitsPerDay: 1 });
  }
  const options: LevelingOptions = {
    constrainToFloat: rnd() < 0.25,
    ...(rnd() < 0.3 ? { allowSplits: true } : {}),
    ...(rnd() < 0.2 ? { scopeTaskIds: tasks.filter(() => rnd() < 0.6).map(t => t.id) } : {}),
    ...(rnd() < 0.15 ? { overrunCeilingDays: 3 } : {}),
  };
  return { tasks, seqs, cal, resources, assignments, options, features };
}

const schedulingOptions = effectiveSchedulingOptions({});
let withFeatures = 0;
let local = 0;
for (let rep = 0; rep < 300; rep++) {
  const p = project(rep);
  if (p.features.alap || p.features.hammock) withFeatures++; else local++;
  const calendars = [p.cal, SIX];
  const cpm = solveProject({ tasks: p.tasks, sequences: p.seqs, calendar: p.cal, calendars, schedulingOptions, projectStartDate: '2026-06-01' });
  if (cpm.error) continue;
  const run = (incremental: boolean) => {
    LEVELER_TEST_HOOKS.incremental = incremental;
    try {
      return JSON.stringify(levelResources(
        structuredClone(p.tasks), p.seqs, p.resources, p.assignments, p.cal, calendars, cpm, p.options,
        { schedulingOptions, projectStartDate: '2026-06-01' },
      ));
    } finally {
      LEVELER_TEST_HOOKS.incremental = true;
    }
  };
  const reference = run(false);
  const fast = run(true);
  checks++;
  if (reference !== fast) diffs.push(`rep ${rep}: ${reference.slice(0, 220)}\n       ≠ ${fast.slice(0, 220)}`);
}
checks++;
if (withFeatures < 40) diffs.push(`te weinig projecten met ALAP/hammock om de globale tak te toetsen: ${withFeatures}`);
checks++;
if (local < 100) diffs.push(`te weinig projecten zonder ALAP/hammock om de lokale invalidatie te toetsen: ${local}`);

if (diffs.length === 0) {
  console.log(`OK  leveler-differential: alle checks groen (${checks}; ${withFeatures} met ALAP/hammock, ${local} lokaal)`);
  process.exit(0);
} else {
  console.log(`XX  leveler-differential: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 8)) console.log(`   - ${d}`);
  process.exit(1);
}
