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
// Draait via run.sh. Exit 0 = alles groen.
import {
  TASK_GRID_PASTE_PERFORMANCE_COUNTS,
  TASK_GRID_PERFORMANCE_BUDGETS,
  runTaskGridPasteBenchmark,
} from './taskGridPerformanceHarness';

const diffs: string[] = [];
let checks = 0;
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
ok('de plak levert daadwerkelijk schrijfacties op (geen no-op-fixture)', result.writeCount > 0);
ok('de gezamenlijke-eindtoestandcontrole heeft een verdict geveld (ok of afgewezen, geen crash)', result.prepared);
ok(
  `2.000×27 plakken/committen blijft <= ${TASK_GRID_PERFORMANCE_BUDGETS.pasteCommitMs} ms (gemeten: ${result.elapsedMs.toFixed(1)} ms)`,
  result.elapsedMs <= TASK_GRID_PERFORMANCE_BUDGETS.pasteCommitMs,
);

if (diffs.length === 0) {
  console.log(`OK  task-grid-paste-performance: ${checks}/${checks} groen (${result.elapsedMs.toFixed(1)} ms, ${result.writeCount} writes)`);
  process.exit(0);
}
for (const d of diffs) console.log(`XX  ${d}`);
console.log(`XX  task-grid-paste-performance: ${diffs.length}/${checks} FOUT`);
process.exit(1);
