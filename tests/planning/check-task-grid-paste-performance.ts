// Bulk-plak-performance (eindreview, FIX 5) — de gezamenlijke-eindtoestandcontrole voor
// conditioneel schrijfbare cellen (applyCellEdits in gridTransaction.ts) kopieerde vroeger, per
// conditioneel schrijfbare cel × per prefixlengte, de VOLLEDIGE `tasksById`-documentkaart, en de
// route ernaartoe deed daarnaast twee eigen O(document)-hotspots: `orderWritesForDependentTransitions`
// scande de complete schrijflijst opnieuw voor elke betrokken taak, en `applyCellEdits` zocht de
// taakindex met `Array.findIndex` in plaats van de kaart die de caller al had. Gemeten: 2.000
// taken × 27 kolommen plakken (16.000+ writes) bevroor de app 4.446 ms synchroon.
//
// Deze batterij reproduceert dat scenario op de ECHTE store (`useAppStore` + `runGridMutation`),
// met `wbsAutoNumber` aan zodat `task.wbsCode` op elke rij conditioneel read-only is — precies de
// kolom die de review aanwees — en met synthetische, gegarandeerd-gewijzigde waarden zodat
// `planTaskGridPaste`'s no-op-eliminatie de writes niet wegfiltert vóór ze de gemeten hot path
// bereiken. De plak hoeft niet te SLAGEN (wbsCode blijft door `wbsAutoNumber` conditioneel
// read-only): de meting gaat over hoe lang de controle erover doet om dat vast te stellen.
//
// Aanbeveling 3 (onafhankelijke eindreview): één sample zonder warmup was gevoelig voor CPU-druk
// (de reviewer zag 5.049 ms rood en 2.935 ms net groen op hetzelfde werk). Zelfde protocol als
// check-task-grid-performance.ts: twee warmups, negen runs, mediaan, en `OPS_RELAX_PERF=1` meet
// alleen zonder de poort te laten falen (voor een zwaarbelaste machine/CI-runner).
//
// Draait via run.sh. Exit 0 = alles groen.
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
