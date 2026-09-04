import fs from 'node:fs';
import path from 'node:path';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { dateToX, MS_PER_DAY, xToDate, xToDayOffset } from '@/engine/renderer/timeAxis';
import { buildCalendarAxis, buildWorkdayAxis, resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { buildSharedAxis } from '@/components/canvas/ganttRenderOptions';
import { isTimelineCanvasX } from '@/components/canvas/hooks/useCanvasLayer';
import type { WorkCalendar } from '@/types/calendar';
import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { HistogramRenderer } from '@/engine/renderer/HistogramRenderer';
import { readGanttPalette, readHistogramPalette } from '@/engine/renderer/themePalette';
import { computeSplitPaneWidths, computeTimelineZoom, splitPanePrimaryWidthCss } from '@/utils/ganttViewport';

const diffs: string[] = [];
let checks = 0;

function equal(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${String(actual)}, verwacht ${String(expected)}`);
}

function deepEqual(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

function close(label: string, actual: number, expected: number, tolerance = 1e-8): void {
  checks++;
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    diffs.push(`${label}: kreeg ${actual}, verwacht ${expected}`);
  }
}

const origin = new Date('2026-08-24T00:00:00.000Z');
const target = new Date(origin.getTime() + 2.5 * MS_PER_DAY);

// De positionele hot-pathfuncties behouden byte-identiek de formule; alleen de naam van het
// derde argument wordt semantisch `chartOriginX`.
for (const [chartOriginX, zoom, scrollX] of [
  [0, 30, 0],
  [317, 7.5, -125],
  [317, 90, 2048],
] as const) {
  const expected = chartOriginX + 2.5 * zoom - scrollX;
  close(`dateToX oorsprong=${chartOriginX} zoom=${zoom} scroll=${scrollX}`, dateToX(target, origin, chartOriginX, zoom, scrollX), expected);
  close(`xToDayOffset inverse oorsprong=${chartOriginX}`, xToDayOffset(expected, chartOriginX, zoom, scrollX), 2.5);
  equal(`xToDate inverse oorsprong=${chartOriginX}`, xToDate(expected, origin, chartOriginX, zoom, scrollX).getTime(), target.getTime());
}

const calendar: WorkCalendar = {
  id: 'coordinate-contract',
  name: 'Coordinate contract',
  description: '',
  workDays: [1, 2, 3, 4, 5],
  workStartHour: 8,
  workEndHour: 16,
  hoursPerDay: 8,
  holidays: [],
};
const engine = new CalendarEngine(calendar);

for (const chartOriginX of [0, 317]) {
  const zoom = 24;
  const scrollX = chartOriginX === 0 ? 900 : -33;
  const calendarAxis = buildCalendarAxis({ origin, chartOriginX, zoom, scrollX });
  close(`kalenderas oorsprong ${chartOriginX}`, calendarAxis.dateToX(target), chartOriginX + 2.5 * zoom - scrollX);
  equal(`kalenderas roundtrip ${chartOriginX}`, calendarAxis.xToDate(calendarAxis.dateToX(target)).getTime(), target.getTime());

  const workdayAxis = buildWorkdayAxis({ calendar: engine, origin, chartOriginX, zoom, scrollX });
  const nextWorkday = new Date('2026-08-25T00:00:00.000Z');
  close(`werkdagenas oorsprong ${chartOriginX}`, workdayAxis.dateToX(nextWorkday), chartOriginX + zoom - scrollX);
  equal(`werkdagenas roundtrip ${chartOriginX}`, workdayAxis.xToDate(workdayAxis.dateToX(nextWorkday)).getTime(), nextWorkday.getTime());

  const resolved = resolveGanttAxis({
    calendar: engine,
    compressNonWorkdays: chartOriginX !== 0,
    origin,
    chartOriginX,
    zoom,
    scrollX,
  });
  close(`resolveGanttAxis oorsprong ${chartOriginX}`, resolved.dateToX(origin), chartOriginX - scrollX);

  const shared = buildSharedAxis({
    calendar,
    compressNonWorkdays: chartOriginX !== 0,
    viewStartDate: '2026-08-24',
    chartOriginX,
    zoom,
    scrollX,
  });
  close(`buildSharedAxis oorsprong ${chartOriginX}`, shared.dateToX(origin), chartOriginX - scrollX);
}

const root = process.cwd();
const timeAxisSource = fs.readFileSync(path.join(root, 'src/engine/renderer/timeAxis.ts'), 'utf8');
const workdayAxisSource = fs.readFileSync(path.join(root, 'src/engine/renderer/workdayAxis.ts'), 'utf8');
const renderOptionsSource = fs.readFileSync(path.join(root, 'src/components/canvas/ganttRenderOptions.ts'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'src/engine/renderer/GanttRenderer.ts'), 'utf8');
const histogramSource = fs.readFileSync(path.join(root, 'src/engine/renderer/HistogramRenderer.ts'), 'utf8');
const ganttCanvasSource = fs.readFileSync(path.join(root, 'src/components/canvas/GanttCanvas.tsx'), 'utf8');
const ganttViewportCoordinatorSource = fs.readFileSync(
  path.join(root, 'src/components/canvas/hooks/useGanttViewportCoordinator.ts'),
  'utf8',
);
const ganttWorkspaceSource = fs.readFileSync(path.join(root, 'src/components/canvas/GanttWorkspace.tsx'), 'utf8');
const timelineHookSources = [
  'useCanvasLayer.ts',
  'useBarDrag.ts',
  'usePan.ts',
  'useBoxSelect.ts',
  'useDependencyDraw.ts',
].map(file => fs.readFileSync(path.join(root, 'src/components/canvas/hooks', file), 'utf8')).join('\n');
const zoomSources = [
  fs.readFileSync(path.join(root, 'src/hooks/useGanttZoom.ts'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/hooks/useZoomShortcuts.ts'), 'utf8'),
].join('\n');

equal('timeAxis gebruikt chartOriginX', /chartOriginX:\s*number/.test(timeAxisSource), true);
equal('timeAxis noemt de oude oorsprong niet meer', /taskTableWidth/.test(timeAxisSource), false);
equal('workdayAxis gebruikt chartOriginX', /chartOriginX:\s*number/.test(workdayAxisSource), true);
equal('workdayAxis noemt de oude oorsprong niet meer', /taskTableWidth/.test(workdayAxisSource), false);
equal('SharedAxisInput gebruikt chartOriginX', /interface SharedAxisInput[\s\S]*?chartOriginX:\s*number/.test(renderOptionsSource), true);

// Task 16B: ieder timelinecanvas heeft een lokale oorsprong 0. Randpunten zijn inclusief x=0 en
// exclusief x=width; geen enkele gesture mag nog een DOM-paneelbreedte van canvas-x aftrekken.
equal('timeline x=0 is geldig', isTimelineCanvasX(0, 640), true);
equal('timeline x=width-1 is geldig', isTimelineCanvasX(639, 640), true);
equal('timeline x=-1 is ongeldig', isTimelineCanvasX(-1, 640), false);
equal('timeline x=width is ongeldig', isTimelineCanvasX(640, 640), false);

// Echte renderer-hit-tests op beide uiterste geldige pixels. De taak begint exact op de lokale
// oorsprong en loopt voorbij de rechterrand, zodat x=0 een resize-rand is en width-1 de balkbody.
const globalRecord = globalThis as unknown as Record<string, unknown>;
globalRecord.document = { documentElement: {} };
globalRecord.getComputedStyle = () => ({ getPropertyValue: () => '' });
const store = useAppStore.getState();
store.newProject();
store.addTask({ name: 'Randtaak' });
const edgeBase = useAppStore.getState().tasks[0];
const edgeTask = {
  ...edgeBase,
  time: {
    ...edgeBase.time,
    scheduleStart: '2026-08-24',
    scheduleFinish: '2026-12-31',
    earlyStart: '2026-08-24',
    earlyFinish: '2026-12-31',
    scheduleDuration: 94,
  },
};
const edgeRenderer = new GanttRenderer({} as CanvasRenderingContext2D, {
  rows: [{ kind: 'task', rowKey: edgeTask.id, task: edgeTask, depth: 0, dimmed: false }],
  sequences: [],
  calendar,
  view: { ...useAppStore.getState().view, viewStartDate: '2026-08-24', zoom: 10, scrollX: 0, scrollY: 0 },
  selectedTaskIds: [],
  canvasWidth: 640,
  canvasHeight: 240,
  rowHeight: 28,
  headerHeight: 50,
  palette: readGanttPalette(),
});
const rowMidY = 64;
equal('bar-resize raakt x=0', edgeRenderer.getTaskBarBounds(0, rowMidY)?.edge, 'left');
equal('barbody raakt x=width-1', edgeRenderer.getTaskBarBounds(639, rowMidY)?.edge, 'body');
equal('barhit weigert x=width', edgeRenderer.getTaskBarBounds(640, rowMidY), null);
equal('relatiebron raakt x=0', edgeRenderer.getRelationSourceAt(0, rowMidY)?.id, edgeTask.id);
equal('relatiebron raakt x=width-1', edgeRenderer.getRelationSourceAt(639, rowMidY)?.id, edgeTask.id);
equal('relatiebron weigert x=width', edgeRenderer.getRelationSourceAt(640, rowMidY), null);

equal('GanttRenderer kent geen taskTableWidth meer', /taskTableWidth/.test(rendererSource), false);
equal('GanttRenderer tekent geen canvas-taaktabel meer', /drawTaskTable|columnHeaders/.test(rendererSource), false);
equal('GanttRenderer heeft geen lokale tabelhit-tests meer', /isInTaskTable|isCollapseToggle|isAddButton/.test(rendererSource), false);
equal('primaire gedeelde as begint letterlijk op 0',
  /buildSharedAxis\(\{[\s\S]*?chartOriginX:\s*0\b/.test(ganttViewportCoordinatorSource), true);
equal('timelinehooks trekken geen paneel- of tabelbreedte af', /taskTableWidth|leftPanelWidth/.test(timelineHookSources), false);

// Task 16C: zoomankers, splitverhoudingen en DOM-scrollrange rekenen uitsluitend binnen de echte
// timelinebreedte. Hoge scroll en beide uiterste cursorpixels bewaken de oude datum-onder-cursor.
deepEqual('zoom op x=0 behoudt de datum onder de cursor',
  computeTimelineZoom(30, 60, 900, 0, 400), { zoom: 60, scrollX: 1800 });
deepEqual('zoom op x=width-1 behoudt de datum onder de cursor',
  computeTimelineZoom(30, 60, 900, 639, 400), { zoom: 60, scrollX: 2439 });
deepEqual('zoom-uit op een smalle timeline klemt scroll niet negatief',
  computeTimelineZoom(60, 15, 0, 0, 400), { zoom: 15, scrollX: 0 });
deepEqual('split 20/80 verdeelt alleen ruimte buiten de splitter',
  computeSplitPaneWidths(1000, 0.2, 5), { primary: 199, secondary: 796 });
deepEqual('split 80/20 verdeelt alleen ruimte buiten de splitter',
  computeSplitPaneWidths(1000, 0.8, 5), { primary: 796, secondary: 199 });
deepEqual('smalle split blijft niet-negatief',
  computeSplitPaneWidths(3, 0.5, 5), { primary: 0, secondary: 0 });
equal('split-CSS drukt dezelfde 20/80-verdeling zonder ongedekte vermenigvuldiging uit',
  splitPanePrimaryWidthCss(0.2, 5), 'calc(20% - 1px)');
equal('split-CSS drukt dezelfde 80/20-verdeling zonder ongedekte vermenigvuldiging uit',
  splitPanePrimaryWidthCss(0.8, 5), 'calc(80% - 4px)');
equal('zoomhooks kennen geen tweede linkerpaneelaftrek meer', /taskTableWidth|leftPanelWidth/.test(zoomSources), false);
equal('fitpaden geven de werkelijk gemeten paneelbreedte door',
  /computeFitToProject\([^\n]*rect\.width\s*-/.test(`${ganttCanvasSource}\n${zoomSources}`), false);
equal('splitlayout trekt de splitter vóór de ratioverdeling af',
  (ganttCanvasSource.match(/splitPanePrimaryWidthCss\(splitView\.ratio, SPLIT_RATIO_BAR_WIDTH\)/g) ?? []).length, 2);
equal('primaire scrollbar begint lokaal op nul', /data-testid="gantt-hscroll"[\s\S]*?style=\{\{\s*left:\s*0\b/.test(ganttCanvasSource), true);
equal('primaire scrollbar gebruikt de volledige timeline-contentbreedte',
  /data-testid="gantt-hscroll"[\s\S]*?width:\s*Math\.max\(1,\s*totalContentWidth\)/.test(ganttCanvasSource), true);

// Task 16D: het histogram is een full-width workspacebaan. Alleen zijn resourcekiezer heeft een
// semantische linkerbreedte; de datumplot begint exact op die breedte en deelt de primaire view.
const histogramAxis = buildSharedAxis({
  calendar,
  compressNonWorkdays: false,
  viewStartDate: '2026-08-24',
  chartOriginX: 350,
  zoom: 10,
  scrollX: 0,
});
const histogram = new HistogramRenderer({} as CanvasRenderingContext2D, {
  series: {
    load: { '2026-08-24': 1 },
    capacity: { '2026-08-24': 1 },
    overSet: new Set<string>(),
  },
  picker: [{ label: 'Alle resources', overallocated: false }],
  selectedResourceId: undefined,
  view: useAppStore.getState().view,
  canvasWidth: 1000,
  canvasHeight: 120,
  pickerWidth: 350,
  labels: { unitsSuffix: 'u' },
  palette: readHistogramPalette(),
  axis: histogramAxis,
});
deepEqual('histogrampicker raakt de laatste pixel links van de plot',
  histogram.pickerAt(349, 10), { id: undefined });
equal('histogrampicker weigert de eerste plotpixel', histogram.pickerAt(350, 10), null);
equal('histogramdatumhit weigert de laatste kiezerpixel', histogram.dayAt(349, 10), null);
equal('histogramdatumhit raakt de eerste plotpixel', histogram.dayAt(350, 10), '2026-08-24');
equal('histogram gebruikt pickerWidth als chartOriginX', histogram.dateAtX(350), '2026-08-24');
equal('histogramcode kent alleen de semantische pickerWidth', /taskTableWidth/.test(histogramSource), false);
equal('workspace bezit een full-width histogramhost',
  /data-testid="gantt-histogram-host"/.test(ganttWorkspaceSource), true);
equal('workspace geeft zijn linkerbreedte als histogramkiezerbreedte door',
  /histogramPickerWidth=\{renderedLeftPanelWidth\}/.test(ganttWorkspaceSource), true);
equal('GanttCanvas portaleert het histogram naar de workspacehost',
  /createPortal\([\s\S]*?gantt-histogram/.test(ganttCanvasSource), true);

if (diffs.length > 0) {
  console.error(`XX  gantt-coordinate-contracts: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.error(`   - ${diff}`);
  process.exit(1);
}

console.log(`OK  gantt-coordinate-contracts: ${checks}/${checks}`);
