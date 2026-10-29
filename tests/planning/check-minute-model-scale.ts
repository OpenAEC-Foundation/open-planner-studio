import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readXER } from '@/services/xer/xerReader';
import { activeImportResult } from '@/services/importTypes';
import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';

const root = process.env.OPS_XER_CORPUS;
const file = root && join(root, 'crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer');
if (!file || !existsSync(file)) {
  console.log('Prestatiemeting rehab-2: corpus ontbreekt, niet gemeten.');
} else {
  const startRead = performance.now();
  const source = activeImportResult(readXER(readFileSync(file)));
  const readMs = performance.now() - startRead;
  const durations: number[] = [];
  for (let n = 0; n < 5; n++) {
    const tasks = cloneTasksForSolve(source.tasks);
    const start = performance.now();
    const result = solveProject(solveInputFor(source.project, tasks, source.sequences, source.calendar, source.resourceCalendars ?? []));
    durations.push(performance.now() - start);
    if (result.error) throw new Error(`Prestatiemeting: berekening mislukt: ${result.error}`);
  }
  const sorted = [...durations].sort((a, b) => a - b);
  console.log(`Prestatiemeting rehab-2: ${source.tasks.length} taken; lezen ${readMs.toFixed(1)} ms; berekenen ${durations.map(ms => ms.toFixed(1)).join(', ')} ms; mediaan ${sorted[2].toFixed(1)} ms.`);
}
