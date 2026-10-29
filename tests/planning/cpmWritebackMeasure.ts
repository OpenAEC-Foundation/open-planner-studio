// Hulpmodule voor measure-cpm-writeback.mjs; beide bundels draaien dezelfde store-actie.
import { createHash } from 'node:crypto';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { isLeafTask } from '@/utils/taskHierarchy';

export function createMeasurement(size: number) {
  const data = generateBenchmarkProject(size, { seed: 0x5eed });
  const { store } = createAppStoreContext();
  store.setState(s => {
    s.project = data.project; s.tasks = data.tasks; s.sequences = data.sequences;
    s.calendar = data.calendar; s.calendars = [data.calendar];
    s.resources = data.resources; s.assignments = data.assignments;
  });
  const first = data.tasks.find(isLeafTask)!;
  let edits = 0;
  return {
    run(changed: boolean) {
      if (changed) {
        const task = store.getState().tasks.find(t => t.id === first.id)!;
        store.getState().updateTask(task.id, {
          time: { ...task.time, scheduleDuration: first.time.scheduleDuration + (++edits % 2) },
        });
      }
      const start = performance.now();
      store.getState().runCPM();
      const ms = performance.now() - start;
      const state = store.getState();
      if (state.cpmResult?.error) throw new Error(state.cpmResult.error);
      // Buiten de tijdmeting: vergelijk alle taakvelden, het hele CPM-resultaat en belasting.
      const output = JSON.stringify({ tasks: state.tasks, cpm: state.cpmResult, load: state.resourceLoadResult },
        (_, value: unknown) => value instanceof Map || value instanceof Set ? [...value] : value);
      return { ms, sha256: createHash('sha256').update(output).digest('hex') };
    },
  };
}
