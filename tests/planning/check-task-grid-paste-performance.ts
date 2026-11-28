import {
  TASK_GRID_PASTE_PERFORMANCE_COUNTS,
  TASK_GRID_PERFORMANCE_BUDGETS,
  runTaskGridPasteBenchmark,
} from './taskGridPerformanceHarness';

const diffs: string[] = [];
let checks = 0;
const relaxed = process.env.OPS_RELAX_PERF === '1';
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const ok = (label: string, condition: boolean) => {
  checks++;
  if (!condition) diffs.push(label);
};

const result = runTaskGridPasteBenchmark();

eq('fixture gebruikt 2.000 taken', result.counts.taskCount, TASK_GRID_PASTE_PERFORMANCE_COUNTS.taskCount);
eq('fixture gebruikt 27 kolommen', result.counts.columnCount, TASK_GRID_PASTE_PERFORMANCE_COUNTS.columnCount);
eq('meting gebruikt exact twee warmups', result.warmups, 2);
eq('meting gebruikt exact negen meetruns', result.runs, 9);
eq('negen ruwe meetwaarden bewaard', result.samplesMs.length, 9);
ok('alle ruwe meetwaarden zijn eindig en niet-negatief',
  result.samplesMs.every(sample => Number.isFinite(sample) && sample >= 0));
ok('de plak levert daadwerkelijk schrijfacties op (geen no-op-fixture)', result.writeCount > 0);
ok('de gezamenlijke-eindtoestandcontrole heeft een verdict geveld (ok of afgewezen, geen crash)', result.prepared);

const measurementLine = `ruwe metingen ms: [${result.samplesMs.map(sample => sample.toFixed(1)).join(', ')}], mediaan ${result.medianMs.toFixed(1)} ms`;

if (!relaxed) {
  ok(
    `2.000×27 plakken/committen (mediaan van ${result.runs}) blijft <= ${TASK_GRID_PERFORMANCE_BUDGETS.pasteCommitMs} ms (gemeten: ${result.medianMs.toFixed(1)} ms)`,
    result.medianMs <= TASK_GRID_PERFORMANCE_BUDGETS.pasteCommitMs,
  );
} else {
  console.log(`MEASURE task-grid-paste-performance ${JSON.stringify({
    counts: result.counts, medianMs: result.medianMs, samplesMs: result.samplesMs,
  })}`);
}

if (diffs.length === 0) {
  console.log(`OK  task-grid-paste-performance: ${checks}/${checks} groen (${measurementLine}, ${relaxed ? 'alleen meten' : 'poort actief'}, ${result.writeCount} writes)`);
  process.exit(0);
}
for (const d of diffs) console.log(`XX  ${d}`);
console.log(`XX  task-grid-paste-performance: ${diffs.length}/${checks} FOUT (${measurementLine})`);
process.exit(1);
