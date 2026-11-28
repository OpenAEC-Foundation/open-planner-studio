const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

interface RRect { x: number; y: number; w: number; h: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; roundRects: RRect[] } {
  const roundRects: RRect[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { roundRects.push({ x, y, w, h }); },
    fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, roundRects };
}

S().newProject();
S().addTask({ name: 'Gezond' });
S().runCPM();
const healthy = S().tasks[0];

function stripDates(t: Task, value: undefined | ''): Task {
  return {
    ...t,
    id: `${t.id}-dateless-${value === undefined ? 'undef' : 'empty'}-${Math.random().toString(36).slice(2, 6)}`,
    time: {
      ...t.time,
      earlyStart: value, earlyFinish: value,
      scheduleStart: value, scheduleFinish: value,
    },
  } as unknown as Task;
}

const datelessLeaf = stripDates(healthy, undefined);
const datelessLeafEmpty = stripDates(healthy, '');
const datelessSummary = { ...stripDates(healthy, undefined), childIds: ['kind-x'] } as Task;
const datelessMilestone = { ...stripDates(healthy, undefined), isMilestone: true } as Task;

const datedMilestone = { ...healthy, id: 'ms-dated', isMilestone: true, time: { ...healthy.time, scheduleDuration: 0 } } as Task;
const datedSummary = { ...healthy, id: 'sum-dated', childIds: ['kind-y'] } as Task;

const hourInstant = `${(healthy.time.earlyStart || healthy.time.scheduleStart || '').slice(0, 10)}T08:00`;
const hourMilestone: Task = {
  ...healthy,
  id: 'ms-hour',
  isMilestone: true,
  time: {
    ...healthy.time,
    earlyStart: hourInstant, earlyFinish: hourInstant,
    scheduleStart: hourInstant, scheduleFinish: hourInstant,
  },
} as Task;

const startOnlyMilestone: Task = {
  ...healthy,
  id: 'ms-start-only',
  isMilestone: true,
  time: {
    ...healthy.time,
    earlyStart: healthy.time.earlyStart, scheduleStart: healthy.time.scheduleStart,
    earlyFinish: undefined, scheduleFinish: undefined,
    scheduleDuration: 0,
  },
} as unknown as Task;

const rows: ViewRow[] = [
  { kind: 'task', rowKey: healthy.id, task: healthy, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datelessLeaf.id, task: datelessLeaf, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datelessLeafEmpty.id, task: datelessLeafEmpty, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datelessSummary.id, task: datelessSummary, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datelessMilestone.id, task: datelessMilestone, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datedMilestone.id, task: datedMilestone, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datedSummary.id, task: datedSummary, depth: 0, dimmed: false },
  { kind: 'task', rowKey: hourMilestone.id, task: hourMilestone, depth: 0, dimmed: false },
  { kind: 'task', rowKey: startOnlyMilestone.id, task: startOnlyMilestone, depth: 0, dimmed: false },
];

const W = 1200, H = 600, TTW = 0, ROWH = 28, HDRH = 60;
const st = S();
const view = { ...st.view, scrollX: 0, scrollY: 0 };

const { ctx, roundRects } = makeCtx();
const renderer = new GanttRenderer(ctx, {
  rows,
  sequences: [],
  calendar: st.calendar,
  view,
  selectedTaskIds: [],
  statusDate: view.viewStartDate,
  showProgressLine: true,
  canvasWidth: W,
  canvasHeight: H,
  rowHeight: ROWH,
  headerHeight: HDRH,
});

let renderError: unknown = null;
try {
  renderer.render();
} catch (err) {
  renderError = err;
}
ok(`render() gooit op datumloze taken: ${String(renderError)}`, renderError === null);

if (renderError === null) {
  const rowMidY = (i: number) => HDRH + i * ROWH + ROWH / 2;

  const barTop = (i: number) => HDRH + i * ROWH;
  const inRow = (r: RRect, i: number) => r.y >= barTop(i) && r.y + r.h <= barTop(i + 1);
  const healthyBars = roundRects.filter(r => inRow(r, 0));
  ok('gezonde taak: geen balk-roundRect in rij 0 getekend', healthyBars.length > 0);

  const stubBars = roundRects.filter(r => inRow(r, 1));
  ok('datumloze leaf: geen terugval-stub getekend in rij 1', stubBars.length > 0);
  ok(
    `datumloze leaf: stub niet op de viewstart (x=${stubBars[0]?.x}, verwacht ~${TTW})`,
    stubBars.length > 0 && Math.abs(stubBars[0].x - TTW) < 1,
  );
  ok('datumloze leaf (lege strings): geen terugval-stub getekend in rij 2', roundRects.some(r => inRow(r, 2)));

  let hitError: unknown = null;
  let datelessHit: unknown = 'niet-gezet';
  try {
    datelessHit = renderer.getTaskBarBounds(TTW + 5, rowMidY(1));
  } catch (err) {
    hitError = err;
  }
  ok(`getTaskBarBounds gooit op datumloze taak: ${String(hitError)}`, hitError === null);
  ok('getTaskBarBounds armt drag op een datumloze taak (verwacht null)', datelessHit === null);

  if (healthyBars.length > 0) {
    const bar = healthyBars[0];
    const healthyHit = renderer.getTaskBarBounds(bar.x + bar.w / 2, rowMidY(0));
    ok('getTaskBarBounds vindt de gezonde balk niet meer (guard te breed)', healthyHit !== null);
  }

  if (healthyBars.length > 0) {
    const bar = healthyBars[0];
    const midX = bar.x + bar.w / 2;

    ok('getRelationSourceAt vindt de gezonde bladtaak niet',
      renderer.getRelationSourceAt(midX, rowMidY(0))?.id === healthy.id);

    ok('getRelationSourceAt weigert een MIJLPAAL (dit is de bug die we repareren)',
      renderer.getRelationSourceAt(bar.x, rowMidY(5))?.id === 'ms-dated');

    ok('getRelationSourceAt WEIGERT een VERZAMELTAAK als bron NIET MEER (regressie-anker 2026-08-15)',
      renderer.getRelationSourceAt(midX, rowMidY(6))?.id === 'sum-dated');

    ok('getRelationSourceAt accepteert een datumloze taak',
      renderer.getRelationSourceAt(TTW + 5, rowMidY(1)) === null);

    const msX = renderer.getTaskBarRect('ms-dated');
    const msAnchor = msX ? (msX.left + msX.right) / 2 : bar.x;
    for (const dx of [-5, -1, 0, 1, 5]) {
      const hit = renderer.getTaskBarBounds(msAnchor + dx, rowMidY(5));
      ok(`getTaskBarBounds: mijlpaal op anker${dx >= 0 ? '+' : ''}${dx} is geen verplaatsgreep (kreeg ${JSON.stringify(hit && { id: hit.task.id, edge: hit.edge })})`,
        hit?.task.id === 'ms-dated' && hit.edge === 'body');
    }
    ok('getTaskBarBounds: mijlpaal ruim naast de ruit (anker+20) armt toch een greep',
      renderer.getTaskBarBounds(msAnchor + 20, rowMidY(5)) === null);
    ok('getTaskBarRect: greepvlak van de mijlpaal ligt niet om het ruitanker',
      msX !== null && Math.abs(msAnchor - renderer.dateToX(parseInstant(datedMilestone.time.earlyStart!))) < 0.5);
    ok('getTaskBarBounds armt nu wél drag op een verzamelbalk (mag niet)',
      renderer.getTaskBarBounds(midX, rowMidY(6)) === null);

    const hourX1 = renderer.dateToX(parseInstant(hourInstant));
    ok('getRelationSourceAt vindt de UUR-mijlpaal niet op zijn exacte x1',
      renderer.getRelationSourceAt(hourX1, rowMidY(7))?.id === 'ms-hour');
    ok('getRelationSourceAt vindt de UUR-mijlpaal niet binnen de marge (x1+4)',
      renderer.getRelationSourceAt(hourX1 + 4, rowMidY(7))?.id === 'ms-hour');
    ok('getRelationSourceAt accepteert de UUR-mijlpaal ruim buiten de marge (bewijst dat de marge iets doet)',
      renderer.getRelationSourceAt(hourX1 + 20, rowMidY(7)) === null);

    const startOnlyX = renderer.dateToX(parseInstant(startOnlyMilestone.time.earlyStart!));
    ok('getRelationSourceAt weigert een MIJLPAAL MET ALLEEN EEN START (dit is de bug die we repareren)',
      renderer.getRelationSourceAt(startOnlyX, rowMidY(8))?.id === 'ms-start-only');
    ok('getRelationSourceAt vindt de start-only mijlpaal ook net binnen de marge (startOnlyX+4)',
      renderer.getRelationSourceAt(startOnlyX + 4, rowMidY(8))?.id === 'ms-start-only');
    ok('getRelationSourceAt weigert de start-only mijlpaal ruim buiten de marge',
      renderer.getRelationSourceAt(startOnlyX + 20, rowMidY(8)) === null);
    ok('getTaskBarBounds geeft de start-only mijlpaal geen verplaatsgreep',
      renderer.getTaskBarBounds(startOnlyX, rowMidY(8))?.edge === 'body');
    ok('getTaskBarBounds geeft de start-only mijlpaal ruim naast de ruit toch een greep',
      renderer.getTaskBarBounds(startOnlyX + 20, rowMidY(8)) === null);
  }
}

if (diffs.length === 0) {
  console.log(`OK  renderer-dateless: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  renderer-dateless: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
