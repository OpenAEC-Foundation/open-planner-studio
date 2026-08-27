// Grenscontracten voor de gefaseerde extractie uit GanttCanvas.
//
// Deze batterij is bewust DOM-vrij. Zij bewaakt niet het uiteindelijke browsergedrag (dat ligt al
// vast in tests/browser/gantt-*.spec.ts), maar de vorm van de drie nieuwe coördinatornaden:
// renderer-levenscyclus, viewport/splitters en pointerprioriteit. De type-asserties breken tijdens
// `npm run typecheck` zodra iemand een volledige AppState of een domeinmutator door de verkeerde
// grens duwt; de bronchecks voorkomen daarnaast dat een singletonselector de contractmodule zelf
// binnensluipt.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  GanttPointerCoordinatorInput,
  GanttPointerCoordinatorOutput,
  GanttRendererHost,
  GanttRendererHostInput,
  GanttViewportCoordinatorInput,
  GanttViewportCoordinatorOutput,
} from '@/components/canvas/hooks/ganttCoordinatorTypes';

const diffs: string[] = [];
let checks = 0;

function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

type ForbiddenCoordinatorKey =
  | 'store'
  | 'appState'
  | 'state'
  | 'addTask'
  | 'updateTask'
  | 'moveTaskTo'
  | 'moveTasksTo'
  | 'deleteTask'
  | 'runCPM';
type NoForbiddenKeys<T> = Extract<keyof T, ForbiddenCoordinatorKey> extends never ? true : false;

// Renderer- en viewportcoördinatie mogen geen domeinmutators krijgen. De pointercoördinator is de
// gerichte eigenaar van taakgebaren en krijgt daarom wel expliciete, smalle taakacties.
const rendererInputIsNarrow: NoForbiddenKeys<GanttRendererHostInput> = true;
const rendererOutputIsNarrow: NoForbiddenKeys<GanttRendererHost> = true;
const viewportInputIsNarrow: NoForbiddenKeys<GanttViewportCoordinatorInput> = true;
const viewportOutputIsNarrow: NoForbiddenKeys<GanttViewportCoordinatorOutput> = true;
const pointerInputHasTargetedActions:
  'updateTask' extends keyof GanttPointerCoordinatorInput
    ? 'moveTaskTo' extends keyof GanttPointerCoordinatorInput
      ? true
      : false
    : false = true;
const pointerOutputOwnsReactHandlers:
  'onMouseDown' extends keyof GanttPointerCoordinatorOutput
    ? 'onMouseMove' extends keyof GanttPointerCoordinatorOutput
      ? true
      : false
    : false = true;

ok('rendererinput heeft geen store- of domeinsleutel', rendererInputIsNarrow);
ok('rendereroutput heeft geen store- of domeinsleutel', rendererOutputIsNarrow);
ok('viewportinput heeft geen store- of domeinsleutel', viewportInputIsNarrow);
ok('viewportoutput heeft geen store- of domeinsleutel', viewportOutputIsNarrow);
ok('pointerinput noemt uitsluitend gerichte mutators expliciet', pointerInputHasTargetedActions);
ok('pointeroutput bezit de React-pointerhandlers', pointerOutputOwnsReactHandlers);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const contractPath = resolve(root, 'src/components/canvas/hooks/ganttCoordinatorTypes.ts');
const canvasPath = resolve(root, 'src/components/canvas/GanttCanvas.tsx');
const pointerPath = resolve(root, 'src/components/canvas/hooks/useGanttPointerCoordinator.ts');
const source = readFileSync(contractPath, 'utf8');
const canvasSource = readFileSync(canvasPath, 'utf8');
const pointerSource = readFileSync(pointerPath, 'utf8');

for (const exportedName of [
  'GanttRendererHostInput',
  'GanttRendererHost',
  'GanttViewportCoordinatorInput',
  'GanttViewportCoordinatorOutput',
  'GanttPointerCoordinatorInput',
  'GanttPointerCoordinatorOutput',
]) {
  ok(`contract exporteert ${exportedName}`, new RegExp(`export interface ${exportedName}\\b`).test(source));
}

ok('contract importeert AppState niet', !/\bAppState\b/.test(source));
ok('contract gebruikt geen singletonselector', !/\buseAppStore\b/.test(source));
ok('rendererhost benoemt renderRevision', /interface GanttRendererHostInput[\s\S]*?renderRevision: string \| number;/.test(source));
ok('viewport benoemt effectieve view en gedeelde as', /interface GanttViewportCoordinatorOutput[\s\S]*?effectiveView: ViewState;[\s\S]*?sharedAxis: GanttAxis;/.test(source));
ok('pointeroutput benoemt overlays en popovers', /interface GanttPointerCoordinatorOutput[\s\S]*?overlays: GanttGestureOverlays;[\s\S]*?relationPopover:/.test(source));
ok('GanttCanvas start geen gesturehooks rechtstreeks',
  !/\.(?:startBarDrag|startPan|startBoxSelect|startRowDrag|startDepDraw)\(/.test(canvasSource));
ok('pointercoördinator bezit precies één mousedown-dispatcher',
  (pointerSource.match(/const onMouseDown\s*=\s*useCallback/g) ?? []).length === 1);
ok('pointercoördinator gebruikt alle vijf gerichte gesture-starts',
  ['startBarDrag', 'startPan', 'startBoxSelect', 'startRowDrag', 'startDepDraw']
    .every(name => pointerSource.includes(`.${name}(`)));
ok('pointercoördinator leest geen storesingleton', !/\buseAppStore\b/.test(pointerSource));
ok('pointercoördinator kopieert geen renderer- of viewportgeometrie',
  !/\b(?:barGeometry|dateToX|computeGanttScrollBounds|computeFitToProject)\b/.test(pointerSource));

if (diffs.length === 0) {
  console.log(`OK: Gantt-coördinatorcontracten — ${checks} checks groen`);
} else {
  console.log(`XX Gantt-coördinatorcontracten — ${diffs.length} van ${checks} checks rood:`);
  for (const diff of diffs) console.log(`  - ${diff}`);
  process.exit(1);
}
