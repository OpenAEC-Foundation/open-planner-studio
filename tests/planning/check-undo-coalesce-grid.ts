// Audit 2026-09-26 — undo-coalescing over een tussenliggende rasterbewerking heen.
//
// De taakraster-commit (`commitPreparedGridMutation`) neemt zijn history-event op buiten de
// store-runtime om en reset de coalesce-marker dus niet. Een tweede gekeyde mutatie ná zo'n
// celbewerking (bv. de statusdatum opnieuw zetten, of het naamveld verder typen) schreef daarom de
// `after` van het OUDERE event over met een toestand mét die celbewerking: één undo draaide dan beide
// terug, en redo gaf de celbewerking terug maar verloor de tweede gekeyde waarde. Nu coalescet de
// runtime alleen zolang het marker-event nog het laatst opgenomen event is.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import './domStub';
import { createAppStore } from '@/state/appStore';
import type { CellEditIntent } from '@/types/taskGrid';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
const cell = (taskId: string, value: string): CellEditIntent =>
  ({ kind: 'cell-edit', taskId, columnId: 'task.name' as CellEditIntent['columnId'], route: 'task-field', value });

const store = createAppStore();
const S = () => store.getState();
S().newProject();
const a = S().addTask({ name: 'A' });
const b = S().addTask({ name: 'B' });
const names = () => [S().tasks.find(t => t.id === a)?.name, S().tasks.find(t => t.id === b)?.name];

S().updateTask(a, { name: 'A1' }, { coalesceKey: 'typen:A' });
eq('voorwaarde: rastercommit slaagt', S().runGridMutation([cell(b, 'B-raster')]).ok, true);
S().updateTask(a, { name: 'A2' }, { coalesceKey: 'typen:A' });
eq('na de drie stappen', names(), ['A2', 'B-raster']);

S().undo();
eq('undo 1 draait ALLEEN de tweede gekeyde stap terug', names(), ['A1', 'B-raster']);
S().undo();
eq('undo 2 draait de rastercommit terug', names(), ['A1', 'B']);
S().undo();
eq('undo 3 draait de eerste gekeyde stap terug', names(), ['A', 'B']);
S().redo();
S().redo();
S().redo();
eq('drie keer redo herstelt alles, niets verloren', names(), ['A2', 'B-raster']);

// Zonder tussenliggend event blijft coalescen gewoon werken (één undo-stap voor het hele gebaar).
const before = S().historyEvents.length;
S().updateTask(a, { name: 'A3' }, { coalesceKey: 'typen:A2' });
S().updateTask(a, { name: 'A4' }, { coalesceKey: 'typen:A2' });
eq('aaneengesloten gekeyde stappen: één event', S().historyEvents.length - before, 1);
S().undo();
eq('…en één undo', names(), ['A2', 'B-raster']);

if (diffs.length === 0) {
  console.log(`OK  undo-coalesce-grid: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  undo-coalesce-grid: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
