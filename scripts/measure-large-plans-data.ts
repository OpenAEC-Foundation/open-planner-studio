import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { applyCpmResult } from '@/engine/scheduler/applyCpmResult';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { Task } from '@/types/task';

const SEED = 0x5eed;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const out = arg('--out');
if (!out) {
  console.error('gebruik: measure-large-plans-data.ts --out <map> [--sizes 1000,5000,10000] [--repeats 3]');
  process.exit(2);
}
const sizes = (arg('--sizes') ?? '1000,5000,10000').split(',').map(Number);
const repeats = Math.max(1, Number(arg('--repeats') ?? 3));
if (sizes.some(s => !Number.isInteger(s) || s < 10)) {
  console.error(`ongeldige --sizes: ${arg('--sizes')}`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { median: r(median), min: r(sorted[0]), max: r(sorted[sorted.length - 1]), samples: samples.map(r) };
}

function normalizeWriteTime(ifc: string): string {
  const stamp = /^FILE_NAME\('[^']*','([^']*)'/m.exec(ifc)?.[1];
  const withoutStamp = stamp ? ifc.split(`'${stamp}'`).join("'<tijd>'") : ifc;
  return withoutStamp.replace(/^(#\d+=IFCOWNERHISTORY\((?:[^,]*,){7})\d+\)/m, '$1<tijd>)');
}

function depthOf(task: Task, byId: Map<string, Task>): number {
  let d = 0;
  let cur = task;
  while (cur.parentId) {
    const p = byId.get(cur.parentId);
    if (!p) break;
    cur = p;
    d++;
  }
  return d;
}

const datasets = [];
for (const size of sizes) {
  const data = generateBenchmarkProject(size, { seed: SEED });
  const byId = new Map(data.tasks.map(t => [t.id, t]));
  const leaves = data.tasks.filter(isLeafTask);
  const summaries = data.tasks.filter(t => !isLeafTask(t));
  const summaryLevels = new Set(summaries.map(t => depthOf(t, byId)));
  const maxDepth = Math.max(...data.tasks.map(t => depthOf(t, byId)));
  const relationsByType: Record<string, number> = {};
  for (const s of data.sequences) relationsByType[s.type] = (relationsByType[s.type] ?? 0) + 1;
  const resourcesByType: Record<string, number> = {};
  for (const r of data.resources) resourcesByType[r.type] = (resourcesByType[r.type] ?? 0) + 1;
  const { sequences: expanded } = expandSummaryRelations(data.tasks, data.sequences);

  const cpm: number[] = [];
  let result = null as ReturnType<CPMSolver['solve']> | null;
  for (let i = 0; i < repeats; i++) {
    const solver = new CPMSolver(leaves, expanded, data.calendar, [data.calendar], solveOptionsFor(data.project));
    const t0 = performance.now();
    result = solver.solve();
    cpm.push(performance.now() - t0);
  }
  if (!result || result.error) throw new Error(`rekenen mislukt bij ${size}: ${result?.error ?? 'geen resultaat'}`);
  applyCpmResult(data.tasks, result, { projectCalendar: data.calendar, calendars: [data.calendar] });
  const critical = [...result.tasks.values()].filter(t => t.isCritical).length;

  const write: number[] = [];
  let ifc = '';
  for (let i = 0; i < repeats; i++) {
    const t0 = performance.now();
    ifc = writeIFC(data);
    write.push(performance.now() - t0);
  }
  const read: number[] = [];
  let readTasks = 0;
  for (let i = 0; i < repeats; i++) {
    const t0 = performance.now();
    const parsed = await readIFCWithXerReconstruction(ifc);
    read.push(performance.now() - t0);
    readTasks = parsed.tasks.length;
  }
  if (readTasks !== data.tasks.length) throw new Error(`round-trip ${size}: ${readTasks} ≠ ${data.tasks.length} taken`);

  const file = join(out, `plan-${size}.ifc`);
  writeFileSync(file, ifc);
  const cal = data.calendar;
  datasets.push({
    size,
    file: `plan-${size}.ifc`,
    ifcBytes: Buffer.byteLength(ifc),
    contentSha256: createHash('sha256').update(normalizeWriteTime(ifc)).digest('hex'),
    generator: { function: 'generateBenchmarkProject', seed: `0x${SEED.toString(16)}`, resourceCount: data.resources.length },
    tasks: data.tasks.length,
    leafWorkTasks: leaves.filter(t => !t.isMilestone).length,
    milestones: leaves.filter(t => t.isMilestone).length,
    summaryTasks: summaries.length,
    summaryLevels: summaryLevels.size,
    wbsDepth: maxDepth + 1,
    relations: data.sequences.length,
    relationsByType,
    relationsWithLag: data.sequences.filter(s => s.lagDays !== 0).length,
    resources: data.resources.length,
    resourcesByType,
    assignments: data.assignments.length,
    tasksWithAssignment: new Set(data.assignments.map(a => a.taskId)).size,
    calendars: [{
      name: cal.name,
      workDays: cal.workDays,
      hours: `${String(cal.workStartHour).padStart(2, '0')}:00-${String(cal.workEndHour).padStart(2, '0')}:00`,
      hoursPerDay: cal.hoursPerDay,
      holidayPeriods: cal.holidays.length,
    }],
    projectStart: data.project.startDate,
    computedFinish: result.projectEnd ?? null,
    criticalTasks: critical,
    node: { repeats, cpmMs: stats(cpm), ifcWriteMs: stats(write), ifcReadMs: stats(read) },
  });
  console.log(`dataset ${size}: ${data.tasks.length} taken, ${data.sequences.length} relaties, ${data.assignments.length} toewijzingen, ${(Buffer.byteLength(ifc) / 1e6).toFixed(1)} MB`);
}

writeFileSync(join(out, 'datasets.json'), JSON.stringify({ seed: SEED, sizes, repeats, datasets }, null, 2));
