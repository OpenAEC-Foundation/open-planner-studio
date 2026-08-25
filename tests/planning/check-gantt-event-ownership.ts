// Ownership-contract voor de Gantt-migratie: elke vastgelegde actie heeft precies
// één actuele eigenaar. Task 15 verplaatst de linker acties naar DOM-grid/workspace
// en de tijdlijngebaren naar timelinecanvas, zonder een tussenstand met dubbele listeners.
import {
  ganttEventOwnership,
  type GanttAction,
  type GanttOwner,
} from '@/components/canvas/ganttEventOwnership';

const expectedActions: readonly GanttAction[] = [
  'rowselect',
  'disclosure',
  'add',
  'row-dubbelklik',
  'rowcontextmenu',
  'rowdrag',
  'tooltip',
  'splitter',
  'vertical-scroll',
  'horizontal-time-scroll',
  'fit-to-project',
  'focus-on-task',
  'bars',
  'dependencies',
  'pan',
  'boxselect',
];

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
}

if (diffs.length === 0) {
  console.log(`OK  gantt-event-ownership: alle checks groen (${checks})`);
  process.exit(0);
}

console.log(`XX  gantt-event-ownership: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
