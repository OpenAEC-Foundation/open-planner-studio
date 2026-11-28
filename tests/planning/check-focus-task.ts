import {
  computeFocusTaskHorizontal, computeFocusTaskScrollY, computeGanttScrollBounds,
  setGanttScrollBounds, clampGanttScroll,
  FOCUS_TASK_MIN_ZOOM, FOCUS_TASK_MAX_ZOOM,
} from '@/utils/ganttViewport';
import { OVERLAY_SCROLLBAR_SIZE, taskListScrollContentHeight } from '@/engine/taskGrid/scrollExtent';
import fs from 'node:fs';
import path from 'node:path';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const close = (label: string, got: number, want: number, eps = 0.001) => {
  checks++;
  if (!(Math.abs(got - want) <= eps)) {
    diffs.push(`${label}: verwacht ≈${want}, kreeg ${got}`);
  }
};

const relationCellSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/task-grid/RelationCellEditor.tsx'), 'utf8',
);
const fullGridSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/task-grid/FullTaskGrid.tsx'), 'utf8',
);
eq('00 relatiecel hergebruikt exact HoverTooltip en TaskTooltipContent van issue 65',
  /<HoverTooltip/.test(relationCellSource) && /<TaskTooltipContent/.test(relationCellSource), true);
eq('00b beide taskgrids bedraden lokale relaties naar dezelfde focusOnTask-actie',
  /onFocusTask=\{focusOnTask\}/.test(fullGridSource)
    && /onFocusTask\(item\.otherTaskId\)/.test(relationCellSource), true);

{
  const { zoom, scrollX } = computeFocusTaskHorizontal(10, 100, 1000);
  close('01 zoom = (bruikbareBreedte × 20%) / duur', zoom, (1000 * 0.2) / 10);
  close('02 scrollX centreert het midden van de taak', scrollX, 100 * zoom - 1000 / 2);
}

{
  const long = computeFocusTaskHorizontal(730, 400, 1000);
  eq('03 een taak van jaren klemt op de ondergrens', long.zoom, FOCUS_TASK_MIN_ZOOM);

  const milestoneDefensief = computeFocusTaskHorizontal(0, 50, 1000);
  eq('04 duration=0 (defensief) klemt op de bovengrens', milestoneDefensief.zoom, FOCUS_TASK_MAX_ZOOM);
  const milestoneEcht = computeFocusTaskHorizontal(1, 50, 1000);
  eq('04b duration=1 (wat een milestone in de praktijk doorgeeft) geeft hetzelfde resultaat',
    milestoneEcht.zoom, milestoneDefensief.zoom);
}

{
  const { scrollX } = computeFocusTaskHorizontal(5, 1, 100);
  eq('05 scrollX klemt op 0', scrollX, 0);
}

{
  const splitPane = computeFocusTaskHorizontal(10, 100, 995);
  close('05b focus gebruikt de volledige gemeten timelinebreedte', splitPane.zoom, 19.9);
}

{
  const scrollY = computeFocusTaskScrollY(10, 28, 40, 600);
  close('06 verticaal centreren', scrollY, 10 * 28 + 28 / 2 - (600 - 40) / 2);
}

{
  const scrollY = computeFocusTaskScrollY(0, 28, 40, 600);
  eq('07 rij 0 in een ruime viewport klemt op 0', scrollY, 0);
}

{
  const b1 = computeGanttScrollBounds( 5000, 20 * 28,
    40, 900, 600);
  eq('08 maxScrollX = contentWidth - canvasWidth', b1.maxScrollX, 5000 - 900);
  eq('09 maxScrollY = rijen·rowHeight - (canvasHeight - headerHeight)', b1.maxScrollY, 20 * 28 - (600 - 40));

  const b2 = computeGanttScrollBounds(400, 2 * 28, 40, 900, 600);
  eq('10 maxScrollX klemt op 0 als de content past', b2.maxScrollX, 0);
  eq('11 maxScrollY klemt op 0 als alle rijen passen', b2.maxScrollY, 0);

  const shared = taskListScrollContentHeight(20, 28, true);
  eq('11b gedeelde schuifhoogte = (rijen + spookregel)·rowHeight + eindstrook',
    shared, 21 * 28 + OVERLAY_SCROLLBAR_SIZE);
  eq('11c zonder spookregel (filter/groep/sortering) telt hij niet mee',
    taskListScrollContentHeight(20, 28, false), 20 * 28 + OVERLAY_SCROLLBAR_SIZE);
}

{
  setGanttScrollBounds(computeGanttScrollBounds(700, 1 * 28, 40, 900, 600));
  const { x: staleX } = clampGanttScroll(14950, 0);
  eq('12 karakterisering: ZONDER verse grenzen klemt de sprong fout (het gat dat de bug was)',
    staleX < 14950, true);

  setGanttScrollBounds(computeGanttScrollBounds(16000, 71 * 28, 40, 900, 600));
  const { x: freshX, y: freshY } = clampGanttScroll(14950, 1414);
  eq('13 MET verse grenzen landt de sprong wél op de bedoelde positie (horizontaal)', freshX, 14950);
  eq('14 MET verse grenzen landt de sprong wél op de bedoelde positie (verticaal)', freshY, 1414);

  setGanttScrollBounds({ maxScrollX: 0, maxScrollY: 0 });
}

if (diffs.length === 0) {
  console.log(`OK  focus-task: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  focus-task: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
