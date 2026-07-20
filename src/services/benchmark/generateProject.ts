// Deterministische testproject-generator voor de ingebouwde benchmark-tool (pakket S).
//
// PUUR: geen store-/React-imports. Levert een `ImportResult` (= `WriteIFCInput`) zodat de
// gegenereerde data 1-op-1 door `writeIFC` én rechtstreeks door `CPMSolver`/`GanttRenderer` kan —
// exact de vorm die de rest van de app als "een geladen project" gebruikt, maar ZONDER de store
// aan te raken (isolatie-eis). Alles is seeded (mulberry32) zodat twee runs met dezelfde grootte
// bit-identieke data opleveren en dus vergelijkbaar zijn.

import type { ImportResult } from '@/services/importTypes';
import type { Task, TaskType } from '@/types/task';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { Resource, ResourceAssignment, ResourceType } from '@/types/resource';
import type { WorkCalendar, Holiday } from '@/types/calendar';
import type { Project } from '@/types/project';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

/** De aangeboden benchmark-groottes (aantal taken totaal, incl. mijlpalen + verzameltaken). */
export const BENCHMARK_SIZES = [100, 500, 1000, 2500, 5000] as const;
export type BenchmarkSize = (typeof BENCHMARK_SIZES)[number];

/** Kleine, snelle PRNG (mulberry32) — deterministisch per seed, geen externe dependency. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TASK_TYPE_POOL: TaskType[] = [
  'CONSTRUCTION', 'CONSTRUCTION', 'CONSTRUCTION', 'INSTALLATION', 'INSTALLATION',
  'DEMOLITION', 'LOGISTIC', 'MAINTENANCE',
];

const RESOURCE_POOL: { name: string; type: ResourceType; maxUnits: number; costPerHour: number }[] = [
  { name: 'Uitvoerder',      type: 'LABOR',         maxUnits: 2, costPerHour: 55 },
  { name: 'Timmerlieden',    type: 'CREW',          maxUnits: 4, costPerHour: 48 },
  { name: 'Betonploeg',      type: 'CREW',          maxUnits: 3, costPerHour: 46 },
  { name: 'Kraan',           type: 'EQUIPMENT',     maxUnits: 1, costPerHour: 120 },
  { name: 'Installateur',    type: 'SUBCONTRACTOR', maxUnits: 2, costPerHour: 62 },
  { name: 'Elektricien',     type: 'SUBCONTRACTOR', maxUnits: 2, costPerHour: 60 },
  { name: 'Grondwerker',     type: 'LABOR',         maxUnits: 3, costPerHour: 44 },
  { name: 'Steiger',         type: 'EQUIPMENT',     maxUnits: 1, costPerHour: 30 },
];

const SEQ_TYPES: { type: SequenceType; w: number }[] = [
  { type: 'FINISH_START', w: 0.70 },
  { type: 'START_START',  w: 0.18 },
  { type: 'FINISH_FINISH', w: 0.12 },
];

function pickSeqType(r: number): SequenceType {
  let acc = 0;
  for (const s of SEQ_TYPES) {
    acc += s.w;
    if (r < acc) return s.type;
  }
  return 'FINISH_START';
}

/** Niet-triviale kalender: ma-vr 07:00-16:00 (8u), met een handvol feestdagen verspreid over het
 *  planningsvenster. Bewust NIET via `createDefaultCalendar()` (die leest de bouwmodus-vlag uit
 *  localStorage en is dus niet deterministisch) — de benchmark bouwt zijn eigen vaste kalender. */
function buildCalendar(startYear: number): WorkCalendar {
  const holidays: Holiday[] = [];
  // Vaste, bekende feestdagen over drie jaar zodat een lange planning er meerdere raakt.
  for (let y = startYear; y <= startYear + 2; y++) {
    holidays.push({ name: 'Nieuwjaar',     startDate: `${y}-01-01`, endDate: `${y}-01-01` });
    holidays.push({ name: 'Koningsdag',    startDate: `${y}-04-27`, endDate: `${y}-04-27` });
    holidays.push({ name: 'Bevrijdingsdag', startDate: `${y}-05-05`, endDate: `${y}-05-05` });
    holidays.push({ name: 'Bouwvak',       startDate: `${y}-07-27`, endDate: `${y}-08-14` });
    holidays.push({ name: 'Kerst',         startDate: `${y}-12-25`, endDate: `${y}-12-26` });
  }
  return {
    id: 'cal-benchmark',
    name: 'Benchmark-kalender',
    description: 'ma-vr 07:00-16:00 met feestdagen (benchmark)',
    workDays: [1, 2, 3, 4, 5],
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays,
  };
}

export interface GeneratedProject extends ImportResult {
  /** Aantal leaf-taken (waarop de CPM-solver rekent) — apart gerapporteerd in de resultaten. */
  leafCount: number;
}

/**
 * Genereer een deterministisch testproject van (ongeveer) `size` taken.
 *
 * Structuur (realistisch WBS): twee niveaus verzameltaken (fasen → subfasen) met daaronder
 * leaf-taken en mijlpalen. Verhouding ~10% verzameltaken + ~6% mijlpalen ⇒ de rest leaf-werktaken.
 * Relaties (~1,3 per leaf-taak) lopen ALTIJD van een eerder-gecreëerde naar een later-gecreëerde
 * leaf-taak ⇒ gegarandeerd acyclisch. FS/SS/FF met af en toe een lag.
 */
export function generateBenchmarkProject(size: number, seed = 0x5eed): GeneratedProject {
  const rnd = mulberry32(seed ^ (size * 2654435761));
  const projectStart = '2026-01-05'; // een maandag
  const startYear = 2026;

  const calendar = buildCalendar(startYear);

  const project: Project = {
    id: 'proj-benchmark',
    name: `Benchmark ${size} taken`,
    description: 'Gegenereerd testproject voor de ingebouwde benchmark',
    startDate: projectStart,
    endDate: projectStart,
    calendarId: calendar.id,
    createdAt: `${projectStart}T00:00:00`,
    modifiedAt: `${projectStart}T00:00:00`,
    author: 'Benchmark',
    company: 'Open Planner Studio',
    wbsAutoNumber: true,
  };

  // --- Aantallen bepalen ------------------------------------------------------
  const nSummaries = Math.max(2, Math.round(size * 0.10));
  const nMilestones = Math.round(size * 0.06);
  const nLeafWork = Math.max(1, size - nSummaries - nMilestones);
  const nTopSummaries = Math.max(1, Math.round(nSummaries * 0.35));
  const nSubSummaries = nSummaries - nTopSummaries;

  const tasks: Task[] = [];
  // O(1)-lookup i.p.v. `tasks.find(...)` (audit-punt 6): elke taak wordt bij aanmaak geïndexeerd.
  // De volgorde van aanmaken/rnd()-aanroepen blijft exact gelijk ⇒ de gegenereerde output is
  // bit-identiek, alleen de opzoekingen zijn nu constant i.p.v. lineair.
  const taskById = new Map<string, Task>();
  const topSummaryIds: string[] = [];
  const subSummaryIds: string[] = [];
  let wbsTop = 0;

  const makeTask = (partial: Omit<Task, 'time'> & { durationDays: number }): Task => {
    const { durationDays, ...rest } = partial;
    return {
      ...rest,
      time: createDefaultTaskTime(projectStart, durationDays),
    };
  };

  /** Voeg een taak toe aan zowel de output-array als de id-index (behoudt volgorde). */
  const addTask = (task: Task): Task => {
    tasks.push(task);
    taskById.set(task.id, task);
    return task;
  };

  // Top-fasen (verzameltaken op wortelniveau).
  for (let i = 0; i < nTopSummaries; i++) {
    wbsTop++;
    const id = `bm-top-${i}`;
    topSummaryIds.push(id);
    addTask(makeTask({
      id, name: `Fase ${i + 1}`, description: '', wbsCode: `${wbsTop}`,
      taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
      priority: 500, parentId: null, childIds: [], resourceIds: [], durationDays: 0,
    }));
  }

  // Subfasen (verzameltaken onder een willekeurige top-fase).
  const subWbsCounter = new Map<string, number>();
  for (let i = 0; i < nSubSummaries; i++) {
    const parentId = topSummaryIds[Math.floor(rnd() * topSummaryIds.length)];
    const parent = taskById.get(parentId)!;
    const n = (subWbsCounter.get(parentId) ?? 0) + 1;
    subWbsCounter.set(parentId, n);
    const id = `bm-sub-${i}`;
    subSummaryIds.push(id);
    parent.childIds.push(id);
    addTask(makeTask({
      id, name: `${parent.name}.${n}`, description: '', wbsCode: `${parent.wbsCode}.${n}`,
      taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
      priority: 500, parentId, childIds: [], resourceIds: [], durationDays: 0,
    }));
  }

  // Bladeren waaronder de leaf-taken/mijlpalen hangen: bij voorkeur subfasen, anders top-fasen.
  const leafParents = subSummaryIds.length > 0 ? subSummaryIds : topSummaryIds;
  const leafWbsCounter = new Map<string, number>();
  const leafTaskIds: string[] = [];

  const addLeaf = (isMilestone: boolean, idx: number) => {
    const parentId = leafParents[Math.floor(rnd() * leafParents.length)];
    const parent = taskById.get(parentId)!;
    const n = (leafWbsCounter.get(parentId) ?? 0) + 1;
    leafWbsCounter.set(parentId, n);
    const id = `bm-leaf-${idx}`;
    parent.childIds.push(id);
    // Duurspreiding: kort werk overheerst, af en toe een lange taak (log-achtig).
    let dur = 0;
    if (!isMilestone) {
      const u = rnd();
      dur = u < 0.55 ? 1 + Math.floor(rnd() * 5)
          : u < 0.85 ? 5 + Math.floor(rnd() * 10)
          : 15 + Math.floor(rnd() * 25);
    }
    const type = TASK_TYPE_POOL[Math.floor(rnd() * TASK_TYPE_POOL.length)];
    addTask(makeTask({
      id,
      name: isMilestone ? `Mijlpaal ${idx}` : `Taak ${idx}`,
      description: '', wbsCode: `${parent.wbsCode}.${n}`,
      taskType: type, status: 'NOT_STARTED',
      isMilestone,
      milestoneKind: isMilestone ? 'FINISH' : undefined,
      priority: 500, parentId, childIds: [], resourceIds: [],
      durationDays: dur,
    }));
    leafTaskIds.push(id);
  };

  // Leaf-werktaken en mijlpalen interleaven (mijlpalen verspreid, niet aan het eind geklonterd).
  const totalLeaves = nLeafWork + nMilestones;
  let msLeft = nMilestones;
  for (let i = 0; i < totalLeaves; i++) {
    const remaining = totalLeaves - i;
    const makeMs = msLeft > 0 && rnd() < msLeft / remaining;
    addLeaf(makeMs, i);
    if (makeMs) msLeft--;
  }

  // --- Relaties (~1,3 per leaf-taak, acyclisch: predecessor komt altijd eerder) --------------
  const sequences: Sequence[] = [];
  const targetEdges = Math.round(leafTaskIds.length * 1.3);
  const seen = new Set<string>();
  let seqCounter = 0;
  let attempts = 0;
  while (sequences.length < targetEdges && attempts < targetEdges * 6) {
    attempts++;
    // Kies een opvolger (niet de allereerste) en een eerdere voorganger binnen een venster.
    const si = 1 + Math.floor(rnd() * (leafTaskIds.length - 1));
    const window = Math.min(si, 25);
    const pi = si - 1 - Math.floor(rnd() * window);
    if (pi < 0 || pi >= si) continue;
    const predecessorId = leafTaskIds[pi];
    const successorId = leafTaskIds[si];
    const key = `${predecessorId}>${successorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = pickSeqType(rnd());
    const lagDays = rnd() < 0.15 ? Math.floor(rnd() * 5) - 1 : 0; // af en toe een (kleine) lag/lead
    sequences.push({
      id: `bm-seq-${seqCounter++}`,
      predecessorId, successorId, type, lagDays,
    });
  }

  // --- Resources + toewijzingen -----------------------------------------------
  const resources: Resource[] = RESOURCE_POOL.map((r, i) => ({
    id: `bm-res-${i}`,
    name: r.name,
    type: r.type,
    description: '',
    maxUnits: r.maxUnits,
    costPerHour: r.costPerHour,
  }));

  const assignments: ResourceAssignment[] = [];
  let asgCounter = 0;
  for (const leafId of leafTaskIds) {
    const task = taskById.get(leafId)!;
    if (task.isMilestone) continue;
    // ~60% van de werktaken krijgt 1 resource, ~15% een tweede.
    if (rnd() < 0.60) {
      const r1 = resources[Math.floor(rnd() * resources.length)];
      task.resourceIds.push(r1.id);
      assignments.push({ id: `bm-asg-${asgCounter++}`, taskId: leafId, resourceId: r1.id, unitsPerDay: 1 });
      if (rnd() < 0.15) {
        const r2 = resources[Math.floor(rnd() * resources.length)];
        if (r2.id !== r1.id) {
          task.resourceIds.push(r2.id);
          assignments.push({ id: `bm-asg-${asgCounter++}`, taskId: leafId, resourceId: r2.id, unitsPerDay: 0.5 });
        }
      }
    }
  }

  // Projecteindscatting louter cosmetisch (CPM herberekent alles); zet een ruime horizon.
  project.endDate = formatDate(addCalendarDays(parseDate(projectStart), Math.max(30, size)));

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    // Leaf-taken = taken zonder kinderen — EXACT hetzelfde criterium als waarop de solver in
    // `runner.ts` rekent (audit-punt 5). Dit telt ook een eventuele verzameltaak die (door de
    // willekeurige verdeling) geen kinderen kreeg, zodat het gerapporteerde aantal en het aantal
    // dat de CPM-fase daadwerkelijk verwerkt niet meer uiteenlopen (geen "91 vs 90").
    leafCount: tasks.filter(t => t.childIds.length === 0).length,
  };
}
