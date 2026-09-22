// Ownership-contract voor de Gantt-migratie: elke vastgelegde actie heeft precies
// één actuele eigenaar. Task 15 verplaatst de linker acties naar DOM-grid/workspace
// en de tijdlijngebaren naar timelinecanvas, zonder een tussenstand met dubbele listeners.
import {
  ganttEventOwnership,
  type GanttAction,
  type GanttOwner,
} from '@/components/canvas/ganttEventOwnership';
import fs from 'node:fs';
import path from 'node:path';

const expectedCurrentOwners = {
  rowselect: 'DOM-grid/workspace',
  disclosure: 'DOM-grid/workspace',
  add: 'DOM-grid/workspace',
  'row-dubbelklik': 'DOM-grid/workspace',
  rowcontextmenu: 'DOM-grid/workspace',
  rowdrag: 'DOM-grid/workspace',
  tooltip: 'DOM-grid/workspace',
  splitter: 'DOM-grid/workspace',
  'vertical-scroll': 'DOM-grid/workspace',
  'horizontal-time-scroll': 'timelinecanvas',
  'fit-to-project': 'timelinecanvas',
  'focus-on-task': 'timelinecanvas',
  bars: 'timelinecanvas',
  dependencies: 'timelinecanvas',
  pan: 'timelinecanvas',
  boxselect: 'timelinecanvas',
} as const satisfies Record<GanttAction, GanttOwner>;

const expectedActions = Object.keys(expectedCurrentOwners) as GanttAction[];

let checks = 0;
const diffs: string[] = [];

const actualActions = Object.keys(ganttEventOwnership).sort();
const expectedActionNames = [...expectedActions].sort();
checks++;
if (JSON.stringify(actualActions) !== JSON.stringify(expectedActionNames)) {
  diffs.push(`acties: kreeg ${JSON.stringify(actualActions)}, verwacht ${JSON.stringify(expectedActionNames)}`);
}

for (const action of expectedActions) {
  const owners: readonly GanttOwner[] = ganttEventOwnership[action] ?? [];
  checks++;
  if (owners.length !== 1) {
    diffs.push(`${action}: verwacht precies één eigenaar, kreeg ${JSON.stringify(owners)}`);
  }
  checks++;
  if (owners[0] !== expectedCurrentOwners[action]) {
    diffs.push(`${action}: kreeg eigenaar ${JSON.stringify(owners[0])}, verwacht ${JSON.stringify(expectedCurrentOwners[action])}`);
  }
}

const root = process.cwd();
const rendererSource = fs.readFileSync(path.join(root, 'src/engine/renderer/GanttRenderer.ts'), 'utf8');
const canvasSource = fs.readFileSync(path.join(root, 'src/components/canvas/GanttCanvas.tsx'), 'utf8');
const oldRowDragPath = path.join(root, 'src/components/canvas/hooks/useRowDrag.ts');

checks++;
if (/drawTaskTable|isInTaskTable|isCollapseToggle|isAddButton/.test(rendererSource)) {
  diffs.push('timelinecanvas bevat nog teken- of hitcode van de oude canvas-taaktabel');
}
checks++;
if (/useRowDrag|startRowDrag|rowDragState/.test(canvasSource) || fs.existsSync(oldRowDragPath)) {
  diffs.push('canvas-rijsleep bestaat nog naast de DOM-grid-eigenaar');
}

// De KETEN als positieve eis, naast de negatieve checks hierboven.
//
// Een verticale sleep op een BALK wordt overgedragen aan de rijsleep van de DOM-grid. Die keten is
// op 2026-08-31 al eens ongemerkt geknapt: `useBarDrag` hield zijn `onVerticalBodyDrag`-callback,
// maar de coördinator gaf hem niet meer mee, en het gebaar was weg zonder dat één poort rood werd.
// Een negatieve check ("het canvas bezit geen rijsleep") kán dat ook niet zien — die wordt juist
// groener naarmate er méér verdwijnt. Vandaar deze lijst: elke schakel moet aanwezig zijn.
//
// Dit is een structurele tripwire, geen gedragsbewijs: het gedrag zelf staat in
// `tests/browser/gantt-drag-undo.spec.ts`. Verdwijnt hier een symbool, dan is het gebaar zeker
// stuk; staat het er, dan zeggen deze checks alleen dat de bedrading er nog is.
const delegationChain: ReadonlyArray<{ file: string; needs: readonly string[] }> = [
  {
    file: 'src/components/canvas/ganttRowDragBridge.ts',
    needs: ['GanttRowDragBridgeContext', 'useGanttRowDragBridge'],
  },
  { file: 'src/components/canvas/GanttWorkspace.tsx', needs: ['GanttRowDragBridgeContext'] },
  { file: 'src/components/canvas/GanttCanvas.tsx', needs: ['useGanttRowDragBridge', 'startVerticalRowDrag'] },
  {
    file: 'src/components/canvas/hooks/useGanttPointerCoordinator.ts',
    needs: ['startVerticalRowDrag', 'onVerticalBodyDrag'],
  },
  { file: 'src/components/canvas/hooks/useBarDrag.ts', needs: ['onVerticalBodyDrag'] },
  { file: 'src/components/task-grid/FullTaskGrid.tsx', needs: ['useGanttRowDragBridge', 'startRowDrag'] },
];

for (const link of delegationChain) {
  const absolute = path.join(root, link.file);
  checks++;
  if (!fs.existsSync(absolute)) {
    diffs.push(`${link.file}: ontbreekt — de overdracht van de verticale balksleep is verbroken`);
    continue;
  }
  const source = fs.readFileSync(absolute, 'utf8');
  for (const symbol of link.needs) {
    checks++;
    // Woordgrenzen, geen deeltekst: `onVerticalBodyDragXX` is niet `onVerticalBodyDrag`. Met een
    // `includes` glipt een hernoeming er ongemerkt langs, en dan bewaakt deze lijst precies niets.
    if (!new RegExp(`\\b${symbol}\\b`).test(source)) {
      diffs.push(`${link.file}: '${symbol}' ontbreekt — de overdracht van de verticale balksleep is verbroken`);
    }
  }
}

if (diffs.length === 0) {
  console.log(`OK  gantt-event-ownership: alle checks groen (${checks})`);
  process.exit(0);
}

console.log(`XX  gantt-event-ownership: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
