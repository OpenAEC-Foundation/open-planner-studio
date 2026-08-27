// Dev-only Gantt-testnaad: de browserdriver mag canvasgeometrie alleen LEZEN uit de echte
// renderer. Deze check verankert daarom eerst de reverse locator tegen dezelfde balkgeometrie en
// hit-test die het product gebruikt. Geen pixelgolden en geen gekopieerde datum→x-formule.

const globals = globalThis as unknown as Record<string, unknown>;
globals.document = { documentElement: {} };
globals.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import {
  lastSize,
  paintCount,
  recordGanttPaint,
  registerGanttTestSurface,
  taskBarPoint,
} from '@/utils/ganttTestDriver';
import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { RefObject } from 'react';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

interface RecordedRect { x: number; y: number; width: number; height: number }
function recordingContext(): { ctx: CanvasRenderingContext2D; roundRects: RecordedRect[] } {
  const roundRects: RecordedRect[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, width: number, height: number) => {
      roundRects.push({ x, y, width, height });
    },
    fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, roundRects };
}

const store = useAppStore.getState();
store.newProject();
store.addTask({ name: 'Lokaliseerbare taak' });
useAppStore.getState().runCPM();
const healthy = useAppStore.getState().tasks[0];
const dateless = {
  ...healthy,
  id: 'driver-dateless',
  time: {
    ...healthy.time,
    earlyStart: undefined,
    earlyFinish: undefined,
    scheduleStart: undefined,
    scheduleFinish: undefined,
  },
} as unknown as Task;
const milestone = {
  ...healthy,
  id: 'driver-milestone',
  isMilestone: true,
  childIds: [],
  time: { ...healthy.time, scheduleDuration: 0 },
} as Task;
const summary = {
  ...healthy,
  id: 'driver-summary',
  childIds: ['driver-child'],
} as Task;
const rows: ViewRow[] = [healthy, dateless, milestone, summary].map((task) => ({
  kind: 'task' as const,
  task,
  depth: 0,
  dimmed: false,
}));

const rowHeight = 28;
const headerHeight = 60;
const scrollY = 9;
const { ctx, roundRects } = recordingContext();
const state = useAppStore.getState();
const renderer = new GanttRenderer(ctx, {
  rows,
  sequences: [],
  calendar: state.calendar,
  view: { ...state.view, scrollX: 0, scrollY },
  selectedTaskIds: [],
  collapsedTaskIds: [],
  canvasWidth: 1200,
  canvasHeight: 400,
  taskTableWidth: 300,
  rowHeight,
  headerHeight,
});
renderer.render();

ok('onbekend taak-id levert geen fictieve rechthoek', renderer.getTaskBarRect('bestaat-niet') === null);
ok('datumloze taak levert geen fictieve sleeprechthoek', renderer.getTaskBarRect(dateless.id) === null);
ok('mijlpaal volgt bestaand hit-testbeleid en levert geen sleeprechthoek', renderer.getTaskBarRect(milestone.id) === null);
ok('summary volgt bestaand hit-testbeleid en levert geen sleeprechthoek', renderer.getTaskBarRect(summary.id) === null);

const rect = renderer.getTaskBarRect(healthy.id);
ok('gezonde leaf-taak heeft een rechthoek', rect !== null);
if (rect) {
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;
  ok('bodypunt ligt horizontaal binnen de rechthoek', centerX > rect.left && centerX < rect.right);
  ok('bodypunt ligt verticaal binnen de rechthoek', centerY > rect.top && centerY < rect.bottom);
  const hit = renderer.getTaskBarBounds(centerX, centerY);
  ok('reverse hit-test vindt vanaf hetzelfde bodypunt dezelfde taak', hit?.task.id === healthy.id);
  ok('reverse hit-test classificeert het midden als body', hit?.edge === 'body');

  const recorded = roundRects.find((candidate) => (
    Math.abs(candidate.x - rect.left) < 0.001
    && Math.abs(candidate.y - rect.top) < 0.001
    && Math.abs(candidate.x + candidate.width - rect.right) < 0.001
    && Math.abs(candidate.y + candidate.height - rect.bottom) < 0.001
  ));
  ok('locator gebruikt exact de werkelijk getekende balkgeometrie', recorded !== undefined);

  const canvas = {
    getBoundingClientRect: () => ({
      left: 100,
      top: 200,
      right: 1300,
      bottom: 600,
      width: 1200,
      height: 400,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLCanvasElement;
  const unregister = registerGanttTestSurface('primary', {
    canvas: { current: canvas } as RefObject<HTMLCanvasElement | null>,
    renderer: { current: renderer } as RefObject<GanttRenderer | null>,
  });
  const point = taskBarPoint(healthy.id, 'body', 'primary');
  ok('bodypunt wordt van canvas-CSS naar client-X omgerekend', point?.x === 100 + centerX);
  ok('bodypunt wordt van canvas-CSS naar client-Y omgerekend', point?.y === 200 + centerY);
  unregister();
  ok('opgeruimd oppervlak is niet meer lokaliseerbaar', taskBarPoint(healthy.id, 'body', 'primary') === null);
}

const storeBeforePaint = useAppStore.getState();
const healthyBeforePaint = JSON.stringify(healthy);
const paintsBefore = paintCount('primary');
recordGanttPaint('primary', 801, 499);
ok('paintobserver telt precies één echte registratie', paintCount('primary') === paintsBefore + 1);
ok('paintobserver bewaart de laatste CSS-maat', JSON.stringify(lastSize('primary')) === JSON.stringify({ width: 801, height: 499 }));
ok('paintobserver vervangt of muteert de store niet', useAppStore.getState() === storeBeforePaint);
ok('paintobserver muteert geen renderer-/taakdata', JSON.stringify(healthy) === healthyBeforePaint);

if (diffs.length === 0) {
  console.log(`OK  gantt-test-driver: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  gantt-test-driver: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
