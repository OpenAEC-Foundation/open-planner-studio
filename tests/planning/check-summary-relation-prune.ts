// Audit 2026-09-26 — samenvatting→samenvatting-relaties boven het uitklapbudget.
//
// `expandSummaryRelations` klapt een relatie tussen twee samenvattingen uit tot het kruisproduct van
// hun bladen, met een plafond (MAX_EXPANDED_RELATIONS). Twee fasen van elk ~250 bladen gingen daar
// al overheen en de relatie viel in haar geheel weg: de planning negeerde de fase-logica. Nu wordt
// boven het budget eerst EXACT gesnoeid: een blad dat via een interne relatie (lag ≥ 0) altijd door
// een ander blad van dezelfde tak wordt "ingehaald", voegt niets toe.
//
// Deze check dwingt de snoeitak af met een laag budget en vergelijkt de volledige solve met de
// gesnoeide, op willekeurige takken (alle relatietypen, ook negatieve lag, mijlpalen, handmatige
// taken, constraints, dag- en uurkalender): elke taakdatum, elke speling, de drijvende relaties en
// de relatie-vrije-speling moeten gelijk zijn.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { expandSummaryRelations, foldSyntheticSequenceIds } from '@/engine/scheduler/expandSummaryRelations';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { Task } from '@/types/task';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
const DAY: WorkCalendar = {
  id: 'c', name: 'c', description: 'c', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
  holidays: [{ name: 'x', startDate: '2026-06-10', endDate: '2026-06-11' }],
};
const BAND = [{ start: 480, end: 960 }];
const HOUR = { ...DAY, id: 'h', workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } } } as WorkCalendar;
const TYPES: SequenceType[] = ['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH'];

// mulberry32: deterministisch en zonder de korte cyclus van een kale LCG (die herhaalde hier elke
// ~116 projecten hetzelfde geval).
let seed = 0x9e3779b9;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

function mk(id: string, dur: number, parentId: string | null, hours: boolean): Task {
  const time = createDefaultTaskTime('2026-06-01', hours ? dur * 8 : dur, hours ? 'hours' as never : undefined) as Task['time'];
  const t = {
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: dur === 0, priority: 500, parentId, childIds: [], time, resourceIds: [],
  } as Task;
  const r = rnd();
  if (r < 0.06) t.manuallyScheduled = true;
  else if (r < 0.12) t.constraint = { type: 'SNET', date: '2026-06-08' };
  else if (r < 0.16) t.constraint = { type: 'MSO', date: '2026-06-03' };
  else if (r < 0.2) t.constraint = { type: 'ALAP' };
  return t;
}

function project(hours: boolean) {
  const tasks: Task[] = [];
  const seqs: Sequence[] = [];
  const S1 = mk('S1', 1, null, hours); const S2 = mk('S2', 1, null, hours);
  S1.manuallyScheduled = S2.manuallyScheduled = undefined; S1.constraint = S2.constraint = undefined;
  tasks.push(S1, S2, mk('PRE', 3, null, hours));
  for (const [sid, prefix] of [['S1', 'P'], ['S2', 'Q']] as const) {
    const n = 5 + Math.floor(rnd() * 4);
    const parent = sid === 'S1' ? S1 : S2;
    for (let i = 0; i < n; i++) {
      const t = mk(`${prefix}${i}`, rnd() < 0.12 ? 0 : 1 + Math.floor(rnd() * 5), sid, hours);
      tasks.push(t); parent.childIds.push(t.id);
      // Interne logica: vooral ketens, soms dwars, soms negatieve lag.
      if (i > 0 && rnd() < 0.8) {
        const from = `${prefix}${Math.floor(rnd() * i)}`;
        seqs.push({ id: `${from}-${t.id}`, predecessorId: from, successorId: t.id, type: pick(TYPES), lagDays: rnd() < 0.2 ? -1 : Math.floor(rnd() * 3) });
      }
    }
  }
  seqs.push({ id: 'pre', predecessorId: 'PRE', successorId: 'P1', type: 'FINISH_START', lagDays: 1 });
  tasks.push(mk('END', 1, null, hours));
  seqs.push({ id: 'end', predecessorId: 'Q0', successorId: 'END', type: 'FINISH_START', lagDays: 0 });
  const rel: Sequence = { id: 'R', predecessorId: 'S1', successorId: 'S2', type: pick(TYPES), lagDays: pick([0, 2, -1]) };
  return { tasks, seqs: [...seqs, rel] };
}

const opts = { schedulingOptions: effectiveSchedulingOptions({}), projectStartDate: '2026-06-01' };
function solveWith(tasks: Task[], expanded: Sequence[], cal: WorkCalendar) {
  const r = new CPMSolver(structuredClone(tasks.filter(isLeafTask)), expanded, cal, [cal], opts).solve();
  foldSyntheticSequenceIds(r);
  const rows = [...r.tasks.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([id, t]) => `${id}:${t.earlyStart}|${t.earlyFinish}|${t.lateStart}|${t.lateFinish}|${t.totalFloat}|${t.freeFloat}`);
  return {
    error: r.error ?? null,
    rows,
    driving: [...new Set(r.drivingSequenceIds)].sort(),
    relFloat: r.sequenceFreeFloat?.R ?? null,
  };
}

let pruned = 0, skipped = 0;
for (let rep = 0; rep < 400; rep++) {
  const hours = rep % 2 === 1;
  const cal = hours ? HOUR : DAY;
  const { tasks, seqs } = project(hours);
  const full = expandSummaryRelations(tasks, seqs);
  const nP = tasks.filter(t => t.parentId === 'S1').length;
  const nQ = tasks.filter(t => t.parentId === 'S2').length;
  const budget = nP * nQ - 1;                       // net te klein ⇒ de snoeitak MOET draaien
  const small = expandSummaryRelations(tasks, seqs, budget);
  if (small.droppedSequenceIds.includes('R')) { skipped++; continue; }   // niets te snoeien ⇒ als vanouds gedropt
  pruned++;
  const a = solveWith(tasks, full.sequences, cal);
  const b = solveWith(tasks, small.sequences, cal);
  checks++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    const bad = a.rows.filter((row, i) => row !== b.rows[i]);
    diffs.push(`rep ${rep} (${hours ? "uur" : "dag"}): ${bad.slice(0, 3).map(row => row + " ≠ " + b.rows[a.rows.indexOf(row)]).join(" ; ")} ${a.error ?? ''}/${b.error ?? ''} driving ${JSON.stringify(a.driving) === JSON.stringify(b.driving)} relFloat ${a.relFloat}/${b.relFloat}`);
  }
}
checks++;
if (pruned < 100) diffs.push(`te weinig snoeigevallen om iets te bewijzen: ${pruned} (overgeslagen ${skipped})`);

// Schaalgeval: twee fasen van 300 bladen (elk een keten) — vroeger 90.000 combinaties ⇒ gedropt.
{
  const tasks: Task[] = [];
  const seqs: Sequence[] = [];
  const S1 = mk('F1', 1, null, false); const S2 = mk('F2', 1, null, false);
  for (const t of [S1, S2]) { t.manuallyScheduled = undefined; t.constraint = undefined; }
  tasks.push(S1, S2);
  for (const [parent, prefix] of [[S1, 'a'], [S2, 'b']] as const) {
    for (let i = 0; i < 300; i++) {
      const t = mk(`${prefix}${i}`, 2, parent.id, false);
      t.manuallyScheduled = undefined; t.constraint = undefined;
      tasks.push(t); parent.childIds.push(t.id);
      if (i > 0) seqs.push({ id: `${prefix}${i - 1}-${i}`, predecessorId: `${prefix}${i - 1}`, successorId: t.id, type: 'FINISH_START', lagDays: 0 });
    }
  }
  seqs.push({ id: 'fase', predecessorId: 'F1', successorId: 'F2', type: 'FINISH_START', lagDays: 0 });
  const res = expandSummaryRelations(tasks, seqs);
  checks++;
  if (res.droppedSequenceIds.includes('fase')) diffs.push('fase-relatie 300×300 wordt nog steeds gedropt');
  const r = new CPMSolver(tasks.filter(isLeafTask), res.sequences, DAY, [DAY], opts).solve();
  checks++;
  if ((r.tasks.get('b0')?.earlyStart ?? '') <= (r.tasks.get('a299')?.earlyFinish ?? '')) {
    diffs.push(`fase 2 start niet na fase 1: b0 ${r.tasks.get('b0')?.earlyStart} vs a299 ${r.tasks.get('a299')?.earlyFinish}`);
  }
}

if (diffs.length === 0) {
  console.log(`OK  summary-relation-prune: alle checks groen (${checks}; ${pruned} gesnoeid vergeleken, ${skipped} niet snoeibaar)`);
  process.exit(0);
} else {
  console.log(`XX  summary-relation-prune: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 15)) console.log(`   - ${d}`);
  process.exit(1);
}
