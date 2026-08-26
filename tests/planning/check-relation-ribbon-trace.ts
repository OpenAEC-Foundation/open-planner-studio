import fs from 'node:fs';
import path from 'node:path';
import {
  buildTrace, classifyTraceTask, isRelationOutsideTrace, taskGridTraceClass,
} from '@/engine/taskGrid/trace';
import { relationActionAvailability } from '@/components/layout/Ribbon/ribbonWidgets';
import { useAppStore } from '@/state/appStore';
import type { Sequence } from '@/types/sequence';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
let checks = 0;
const failures: string[] = [];
const ok = (label: string, condition: boolean) => {
  checks++;
  if (!condition) failures.push(label);
};

const sequences: Sequence[] = [
  { id: 'ab', predecessorId: 'a', successorId: 'b', type: 'FINISH_START', lagDays: 0 },
  { id: 'bc', predecessorId: 'b', successorId: 'c', type: 'FINISH_START', lagDays: 0 },
  { id: 'bd', predecessorId: 'b', successorId: 'd', type: 'FINISH_START', lagDays: 0 },
];
const cpm = {
  error: null,
  drivingSequenceIds: ['ab', 'bc'],
} as unknown as CPMResult;

const trace = buildTrace('both', ['b'], sequences, cpm);
ok('trace bestaat bij een focus en actieve richting', trace !== undefined);
ok('focus krijgt exact de focusrol', classifyTraceTask(trace, 'b') === 'focus');
ok('driving voorganger krijgt de sterke voorgangerrol', classifyTraceTask(trace, 'a') === 'predecessor-driving');
ok('driving opvolger krijgt de sterke opvolgerrol', classifyTraceTask(trace, 'c') === 'successor-driving');
ok('gewone opvolger krijgt de gewone opvolgerrol', classifyTraceTask(trace, 'd') === 'successor');
ok('niet-betrokken taak wordt vervaagd maar niet verwijderd', classifyTraceTask(trace, 'x') === 'dimmed');
ok('canvasrelatie gebruikt dezelfde classificatie voor tracevervaging',
  !isRelationOutsideTrace(trace, 'a', 'b') && isRelationOutsideTrace(trace, 'a', 'x'));
ok('beschadigde overlap kiest overal deterministisch voorganger boven opvolger',
  classifyTraceTask({
    focusId: 'b', predecessors: ['x'], drivingPredecessors: ['x'],
    successors: ['x'], drivenSuccessors: ['x'],
  }, 'x') === 'predecessor-driving');
ok('de gridklasse komt uitsluitend uit dezelfde traceclassificatie',
  taskGridTraceClass(classifyTraceTask(trace, 'a')) === 'task-grid-trace-predecessor-driving');
ok('trace uit geeft geen rol of gridklasse',
  classifyTraceTask(buildTrace('off', ['b'], sequences, cpm), 'a') === null
    && taskGridTraceClass(null) === null);

ok('zonder selectie zijn koppelen en extern toevoegen concreet niet beschikbaar', (() => {
  const availability = relationActionAvailability(0, 0);
  return !availability.linkSelected && !availability.addExternal && !availability.refreshExternal;
})());
ok('één selectie opent alleen de externe route', (() => {
  const availability = relationActionAvailability(1, 0);
  return !availability.linkSelected && availability.addExternal && !availability.refreshExternal;
})());
ok('twee selecties koppelen en bestaande externe links laten verversen', (() => {
  const availability = relationActionAvailability(2, 1);
  return availability.linkSelected && !availability.addExternal && availability.refreshExternal;
})());

const beforeUi = useAppStore.getState();
const selectionBefore = [...beforeUi.selectedTaskIds];
const viewBefore = JSON.stringify(beforeUi.view);
const historyBefore = beforeUi.historyEvents.length;
beforeUi.setUI({ traceMode: 'both' });
useAppStore.getState().setUI({ activeRibbonTab: 'table' });
const afterSurfaceSwitch = useAppStore.getState();
ok('trace overleeft een surfacewissel binnen hetzelfde document', afterSurfaceSwitch.ui.traceMode === 'both');
ok('trace en surfacewissel veranderen selectie, view en history niet',
  JSON.stringify(afterSurfaceSwitch.selectedTaskIds) === JSON.stringify(selectionBefore)
    && JSON.stringify(afterSurfaceSwitch.view) === viewBefore
    && afterSurfaceSwitch.historyEvents.length === historyBefore);

const widgets = read('src/components/layout/Ribbon/ribbonWidgets.tsx');
const config = read('src/components/layout/Ribbon/ribbonConfig.tsx');
const gridAdapter = read('src/engine/taskGrid/taskGridAdapter.ts');
const renderer = read('src/engine/renderer/GanttRenderer.ts');

ok('RelationDropdown bestaat als popovercomponent',
  /export function RelationDropdown\(\)[\s\S]*?<Popover/.test(widgets));
for (const action of ['draw', 'linkSelected', 'addExternal', 'refreshExternal']) {
  ok(`relatiedropdown bevat actie ${action}`, new RegExp(`key:\\s*['\"]${action}['\"]`).test(widgets));
}
ok('geselecteerde taken koppelen gebruikt de bewaakte gedeelde actie',
  /createRelationWithFeedback\(selectedTaskIds\[0\],\s*selectedTaskIds\[1\],\s*'FINISH_START'\)/.test(widgets));
ok('externe relatie opent de bestaande ExternalLinkDialog voor één taak',
  /<ExternalLinkDialog[\s\S]*taskId=\{externalTaskId\}/.test(widgets));
ok('alle externe relaties vernieuwen gebruikt de bestaande refreshroute',
  /refreshAllExternalAnchors\(buildImportLabels\(tCommon\)\)/.test(widgets));
ok('de gedeelde taken-groep gebruikt de dropdown en niet de oude wisselknop',
  /const relationDropdownItem[\s\S]*Component:\s*RelationDropdown/.test(config)
    && /const tasksGroup[\s\S]*relationDropdownItem/.test(config)
    && !/const relationButton/.test(config));
ok('Tabel bevat de onafhankelijke voorganger- en opvolgertracegroep',
  /const tableTab[\s\S]*tasksGroup,[\s\S]*traceGroup,[\s\S]*tableColumnsGroup/.test(config));
ok('de adapter consumeert de gedeelde trace en classificeert niet zelf',
  /trace\?:\s*TaskTrace/.test(gridAdapter)
    && /classifyTraceTask/.test(gridAdapter)
    && !/traceClassForTask/.test(gridAdapter));
ok('de canvasrenderer consumeert dezelfde classifiers voor balken en relaties',
  /classifyTraceTask/.test(renderer)
    && /isRelationOutsideTrace/.test(renderer)
    && /outsideTrace \? \[1, 4\]/.test(renderer));

const sourceFiles = fs.readdirSync(path.join(root, 'src'), { recursive: true })
  .filter((entry): entry is string => typeof entry === 'string' && (entry.endsWith('.ts') || entry.endsWith('.tsx')))
  .map(entry => path.join(root, 'src', entry));
const definitions = sourceFiles.reduce((count, file) => {
  const source = fs.readFileSync(file, 'utf8');
  return count + (source.match(/(?:export\s+)?function\s+buildTrace\s*\(/g)?.length ?? 0);
}, 0);
ok('buildTrace heeft exact één definitie onder src', definitions === 1);

if (failures.length > 0) {
  console.error(`FAIL relation-ribbon-trace: ${failures.length}/${checks}`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`OK relation-ribbon-trace: ${checks}/${checks}`);
