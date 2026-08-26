import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative: string) => fs.existsSync(path.join(root, relative));
const diffs: string[] = [];
let checks = 0;
const ok = (label: string, condition: boolean) => {
  checks++;
  if (!condition) diffs.push(label);
};

const workspacePath = 'src/components/canvas/GanttWorkspace.tsx';
const gridPath = 'src/components/task-grid/GanttTaskGrid.tsx';
const app = read('src/App.tsx');
const canvas = read('src/components/canvas/GanttCanvas.tsx');

ok('GanttWorkspace bestaat', exists(workspacePath));
ok('GanttTaskGrid bestaat', exists(gridPath));
ok('App rendert de workspace in plaats van het canvas rechtstreeks',
  /<GanttWorkspace\s*\/>/.test(app) && !/<GanttCanvas\s*\/>/.test(app));

if (exists(workspacePath)) {
  const workspace = read(workspacePath);
  ok('Workspace bezit DOM-grid, splitter en timeline',
    /<GanttTaskGrid/.test(workspace)
      && /data-testid=["']gantt-workspace-splitter["']/.test(workspace)
      && /<GanttCanvas/.test(workspace));
  ok('Workspace gebruikt en bewaart leftPanelWidth',
    /leftPanelWidth/.test(workspace) && /saveLeftPanelWidth/.test(workspace));
}

if (exists(gridPath)) {
  const grid = read(gridPath);
  ok('GanttTaskGrid gebruikt de gedeelde grid-surface met eigen voorkeuren',
    /TaskGridSurface/.test(grid) && /gantt-task-grid/.test(grid));
}

ok('Het primaire canvas draait timeline-only met tabelbreedte nul',
  /const taskTableWidth = 0/.test(canvas));
ok('Het canvas bevat geen tweede verticale DOM-scroller meer',
  !/data-testid=["']gantt-vscroll["']/.test(canvas));

if (diffs.length) {
  console.error(`FAIL gantt-workspace: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  gantt-workspace: ${checks}/${checks}`);
