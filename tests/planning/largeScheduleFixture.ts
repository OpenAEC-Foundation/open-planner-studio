import { generateBenchmarkProject, type GeneratedProject } from '@/services/benchmark/generateProject';
import { isLeafTask } from '@/utils/taskHierarchy';

export interface LargeScheduleCounts {
  tasks: number;
  sequences: number;
  assignments: number;
}

export function createLargeSchedule(opts: { tasks?: number; assignmentsPerTask?: number; sequences?: number } = {}): GeneratedProject {
  const size = opts.tasks ?? 7_000;
  const perTask = opts.assignmentsPerTask ?? 9;
  const targetSequences = opts.sequences ?? 10_000;
  const project = generateBenchmarkProject(size, { seed: 0x7e4ab2, resourceCount: 250 });
  const resources = project.resources;
  const assignments = project.assignments;
  const workLeaves = project.tasks.filter(t => isLeafTask(t) && !t.isMilestone);

  const assigned = new Set(assignments.map(a => `${a.taskId}|${a.resourceId}`));
  const perTaskCount = new Map<string, number>();
  for (const a of assignments) perTaskCount.set(a.taskId, (perTaskCount.get(a.taskId) ?? 0) + 1);
  let counter = assignments.length;
  workLeaves.forEach((task, i) => {
    let added = perTaskCount.get(task.id) ?? 0;
    for (let k = 0; added < perTask && k < resources.length; k++) {
      const resource = resources[(i * 7 + k * 13) % resources.length];
      const key = `${task.id}|${resource.id}`;
      if (assigned.has(key)) continue;
      assigned.add(key);
      task.resourceIds.push(resource.id);
      assignments.push({ id: `lg-asg-${counter++}`, taskId: task.id, resourceId: resource.id, unitsPerDay: 1 });
      added++;
    }
  });

  const leaves = project.tasks.filter(isLeafTask);
  const existing = new Set(project.sequences.map(s => `${s.predecessorId}|${s.successorId}`));
  let seqCounter = 0;
  for (let step = 37; project.sequences.length < targetSequences && step < leaves.length; step += 211) {
    for (let i = 0; i + step < leaves.length && project.sequences.length < targetSequences; i += 3) {
      const pred = leaves[i];
      const succ = leaves[i + step];
      const key = `${pred.id}|${succ.id}`;
      if (existing.has(key)) continue;
      existing.add(key);
      project.sequences.push({
        id: `lg-seq-${seqCounter++}`, predecessorId: pred.id, successorId: succ.id, type: 'FINISH_START', lagDays: 0,
      });
    }
  }
  return project;
}

export function countsOf(project: GeneratedProject): LargeScheduleCounts {
  return { tasks: project.tasks.length, sequences: project.sequences.length, assignments: project.assignments.length };
}
