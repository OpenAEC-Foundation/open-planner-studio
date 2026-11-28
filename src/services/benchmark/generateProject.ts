import type { ImportResult } from '@/services/importTypes';
import type { Task, TaskType } from '@/types/task';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { Resource, ResourceAssignment, ResourceType } from '@/types/resource';
import type { WorkCalendar, Holiday } from '@/types/calendar';
import type { Project } from '@/types/project';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { isLeafTask } from '@/utils/taskHierarchy';

export const BENCHMARK_SIZES = [100, 500, 1000, 2500, 5000] as const;
export type BenchmarkSize = (typeof BENCHMARK_SIZES)[number];

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

export const BENCHMARK_RESOURCE_COUNTS = [0, 4, 8, 25, 80, 250] as const;
export const DEFAULT_RESOURCE_COUNT = RESOURCE_POOL.length;

export interface BenchmarkOptions {
  seed?: number;
  resourceCount?: number;
}

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

function buildCalendar(startYear: number): WorkCalendar {
  const holidays: Holiday[] = [];
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
  leafCount: number;
}

export function generateBenchmarkProject(size: number, opts: BenchmarkOptions = {}): GeneratedProject {
  const seed = opts.seed ?? 0x5eed;
  const resourceCount = Math.max(0, Math.min(2000, Math.round(opts.resourceCount ?? DEFAULT_RESOURCE_COUNT)));
  const rnd = mulberry32(seed ^ (size * 2654435761));
  const projectStart = '2026-01-05';
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

  const nSummaries = Math.max(2, Math.round(size * 0.10));
  const nMilestones = Math.round(size * 0.06);
  const nLeafWork = Math.max(1, size - nSummaries - nMilestones);
  const nTopSummaries = Math.max(1, Math.round(nSummaries * 0.35));
  const nSubSummaries = nSummaries - nTopSummaries;

  const tasks: Task[] = [];
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

  const addTask = (task: Task): Task => {
    tasks.push(task);
    taskById.set(task.id, task);
    return task;
  };

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

  const subWbsCounter = new Map<string, number>();
  for (let i = 0; i < nSubSummaries; i++) {
    const parentId = i < topSummaryIds.length
      ? topSummaryIds[i]
      : topSummaryIds[Math.floor(rnd() * topSummaryIds.length)];
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

  const leafParents = subSummaryIds.length > 0 ? subSummaryIds : topSummaryIds;
  const leafWbsCounter = new Map<string, number>();
  const leafTaskIds: string[] = [];

  const addLeaf = (isMilestone: boolean, idx: number) => {
    const parentId = idx < leafParents.length
      ? leafParents[idx]
      : leafParents[Math.floor(rnd() * leafParents.length)];
    const parent = taskById.get(parentId)!;
    const n = (leafWbsCounter.get(parentId) ?? 0) + 1;
    leafWbsCounter.set(parentId, n);
    const id = `bm-leaf-${idx}`;
    parent.childIds.push(id);
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

  const totalLeaves = nLeafWork + nMilestones;
  let msLeft = nMilestones;
  for (let i = 0; i < totalLeaves; i++) {
    const remaining = totalLeaves - i;
    const makeMs = msLeft > 0 && rnd() < msLeft / remaining;
    addLeaf(makeMs, i);
    if (makeMs) msLeft--;
  }

  const sequences: Sequence[] = [];
  const seen = new Set<string>();
  let seqCounter = 0;

  const addEdge = (pi: number, si: number): boolean => {
    if (pi < 0 || pi >= si) return false;
    const predecessorId = leafTaskIds[pi];
    const successorId = leafTaskIds[si];
    const key = `${predecessorId}>${successorId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const type = pickSeqType(rnd());
    const lagDays = rnd() < 0.15 ? Math.floor(rnd() * 5) - 1 : 0;
    sequences.push({ id: `bm-seq-${seqCounter++}`, predecessorId, successorId, type, lagDays });
    return true;
  };

  for (let si = 1; si < leafTaskIds.length; si++) {
    const window = Math.min(si, 25);
    addEdge(si - 1 - Math.floor(rnd() * window), si);
  }

  const targetEdges = Math.max(sequences.length, Math.round(leafTaskIds.length * 1.3));
  let attempts = 0;
  while (sequences.length < targetEdges && attempts < targetEdges * 6) {
    attempts++;
    const si = 1 + Math.floor(rnd() * (leafTaskIds.length - 1));
    const window = Math.min(si, 25);
    addEdge(si - 1 - Math.floor(rnd() * window), si);
  }

  const resources: Resource[] = Array.from({ length: resourceCount }, (_, i) => {
    const rol = RESOURCE_POOL[i % RESOURCE_POOL.length];
    const ronde = Math.floor(i / RESOURCE_POOL.length);
    return {
      id: `bm-res-${i}`,
      name: ronde === 0 ? rol.name : `${rol.name} ${ronde + 1}`,
      type: rol.type,
      description: '',
      maxUnits: rol.maxUnits,
      costPerHour: rol.costPerHour,
    };
  });

  const assignments: ResourceAssignment[] = [];
  let asgCounter = 0;
  for (const leafId of leafTaskIds) {
    if (resources.length === 0) break;
    const task = taskById.get(leafId)!;
    if (task.isMilestone) continue;
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

  project.endDate = formatDate(addCalendarDays(parseDate(projectStart), Math.max(30, size)));

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    leafCount: tasks.filter(isLeafTask).length,
  };
}
