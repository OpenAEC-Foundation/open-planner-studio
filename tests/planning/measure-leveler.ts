// Meetkern voor docs/superpowers/evidence/resource-leveler-performance.mjs; geen testbatterij.
// De oude en nieuwe bundel krijgen exact dezelfde deterministische invoer en aparte werkkopieën.
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { applyCpmResult } from '@/engine/scheduler/applyCpmResult';
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { isLeafTask } from '@/utils/taskHierarchy';

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, (_key, v: unknown) => v instanceof Map ? [...v] : v)).digest('hex');
}
export function createMeasurement(size: number) {
  const data = generateBenchmarkProject(size, { seed: 0x5eed });
  const tasks = data.tasks.filter(isLeafTask);
  const { sequences } = expandSummaryRelations(data.tasks, data.sequences);
  const options = solveOptionsFor(data.project);
  const cpm = new CPMSolver(tasks, sequences, data.calendar, [data.calendar], options).solve();
  if (cpm.error) throw new Error(`ongeldige meetinvoer: ${JSON.stringify(cpm.error)}`);
  applyCpmResult(data.tasks, cpm, { projectCalendar: data.calendar, calendars: [data.calendar] });
  const inputHash = hash(data);
  return () => {
    const start = performance.now();
    const result = levelResources(tasks, sequences, data.resources, data.assignments,
      data.calendar, [data.calendar], cpm, { constrainToFloat: false }, options);
    const ms = performance.now() - start;
    const applied = tasks.map(t => ({
      ...t, time: { ...t.time }, levelingDelay: result.delays[t.id],
      levelingDelayMinutes: undefined, levelingDelayElapsed: undefined,
      splitGaps: result.gaps[t.id] ?? t.splitGaps,
    }));
    const trial = new CPMSolver(applied, sequences, data.calendar, [data.calendar], options).solve();
    if (trial.error || trial.projectEnd !== result.projectEndAfter) throw new Error('voorstel/CPM-pariteit faalt');
    return { ms, inputHash, proposalHash: hash(result), cpmHash: hash(trial),
      shifts: Object.keys(result.shifts).length, unresolved: Object.keys(result.unresolved).length };
  };
}
