// Ownership-contract voor de Gantt-migratie: elke vastgelegde actie heeft precies
// één actuele eigenaar. Task 15 verplaatst de linker acties naar DOM-grid/workspace
// en de tijdlijngebaren naar timelinecanvas, zonder een tussenstand met dubbele listeners.
import {
  ganttEventOwnership,
  type GanttAction,
  type GanttOwner,
} from '@/components/canvas/ganttEventOwnership';

const expectedCurrentOwners = {
  rowselect: 'canvas',
  disclosure: 'canvas',
  add: 'canvas',
  'row-dubbelklik': 'canvas',
  rowcontextmenu: 'canvas',
  rowdrag: 'canvas',
  tooltip: 'canvas',
  splitter: 'canvas',
  'vertical-scroll': 'canvas',
  'horizontal-time-scroll': 'canvas',
  'fit-to-project': 'canvas',
  'focus-on-task': 'canvas',
  bars: 'canvas',
  dependencies: 'canvas',
  pan: 'canvas',
  boxselect: 'canvas',
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

if (diffs.length === 0) {
  console.log(`OK  gantt-event-ownership: alle checks groen (${checks})`);
  process.exit(0);
}

console.log(`XX  gantt-event-ownership: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
