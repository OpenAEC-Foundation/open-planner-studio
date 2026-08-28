import fs from 'node:fs';
import path from 'node:path';
import {
  clampTaskGridWidth,
  effectiveTaskGridMax,
} from '../../src/components/canvas/ganttSplitter';

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
const renderer = read('src/engine/renderer/GanttRenderer.ts');
const styles = read('src/styles/globals.css');

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
  ok('Workspace bezit een full-width histogrambaan buiten grid en timeline',
    /data-testid=["']gantt-histogram-host["']/.test(workspace)
      && /histogramPickerWidth=\{renderedLeftPanelWidth\}/.test(workspace)
      && /\.gantt-workspace-histogram[\s\S]*?grid-column:\s*1\s*\/\s*-1/.test(styles));
  ok('Workspace gebruikt en bewaart leftPanelWidth',
    /leftPanelWidth/.test(workspace) && /saveLeftPanelWidth/.test(workspace));
  ok('Pointer, toetsenbord en ARIA delen de effectieve viewportgrens',
    /effectiveTaskGridMax/.test(workspace)
      && /aria-valuemax=\{taskGridMax\}/.test(workspace)
      && !/aria-valuemax=\{TASK_TABLE_MAX_WIDTH\}/.test(workspace));
  ok('Splitternaam loopt door i18n',
    /aria-label=\{t\('taskGrid\.controls\.resizeTaskGrid'\)\}/.test(workspace)
      && !workspace.includes('aria-label="Resize task grid"'));
}

if (exists(gridPath)) {
  const grid = read(gridPath);
  ok('GanttTaskGrid gebruikt de gedeelde grid-surface met eigen voorkeuren',
    /TaskGridSurface/.test(grid) && /gantt-task-grid/.test(grid));
}

ok('De renderer is werkelijk timeline-only zonder verborgen canvas-taaktabel',
  !/taskTableWidth|drawTaskTable|isInTaskTable|isCollapseToggle|isAddButton/.test(renderer));
ok('Het canvas bevat geen tweede verticale DOM-scroller meer',
  !/data-testid=["']gantt-vscroll["']/.test(canvas));
ok('Effectieve splittergrens bewaart minimaal 180 px tijdlijn',
  effectiveTaskGridMax(640) === 460 && effectiveTaskGridMax(1280) === 800);
ok('Dezelfde klem begrenst opgeslagen, pointer- en toetsenbordbreedte',
  clampTaskGridWidth(900, 640) === 460 && clampTaskGridWidth(100, 640) === 150);

const ganttGrid = exists(gridPath) ? read(gridPath) : '';
const fullGrid = read('src/components/task-grid/FullTaskGrid.tsx');
ok('Dubbelklik is geen surface-optie en opent overal het eigenschappenpaneel',
  !ganttGrid.includes('doubleClickAction')
    && !fullGrid.includes('doubleClickAction')
    && !/onCellDoubleClick[\s\S]{0,900}showTaskDialog/.test(fullGrid)
    && /onCellDoubleClick[\s\S]{0,900}showPropertiesPanel/.test(fullGrid));

if (diffs.length) {
  console.error(`FAIL gantt-workspace: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  gantt-workspace: ${checks}/${checks}`);
