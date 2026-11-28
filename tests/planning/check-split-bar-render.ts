const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { Task, TaskSplitGap } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { ViewRow } from '@/engine/view/visibleRows';
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import { computeSplitSegments } from '@/engine/renderer/splitBarGeometry';
import { doneBarTones, readGanttPalette } from '@/engine/renderer/themePalette';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseInstant, formatInstant } from '@/utils/dateUtils';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { solveProject } from '@/engine/scheduler/solveProject';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { profileCountsWorkdays } from '@/utils/taskDuration';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}
function near(label: string, actual: number, expected: number, tol = 0.01): void {
  checks++;
  if (!(Math.abs(actual - expected) <= tol)) diffs.push(`${label}: kreeg ${actual}, verwacht ${expected} (±${tol})`);
}

interface RRect { x: number; y: number; w: number; h: number; fillStyle: string }
interface LineEv { kind: 'move' | 'line'; x: number; y: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; rects: RRect[]; lines: LineEv[] } {
  const rects: RRect[] = [];
  const lines: LineEv[] = [];
  let pending: { x: number; y: number; w: number; h: number } | null = null;
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: () => { pending = null; },
    closePath: noop,
    moveTo: (x: number, y: number) => { lines.push({ kind: 'move', x, y }); },
    lineTo: (x: number, y: number) => { lines.push({ kind: 'line', x, y }); },
    arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { pending = { x, y, w, h }; },
    fill: () => { if (pending) { rects.push({ ...pending, fillStyle: String((ctx as { fillStyle: string }).fillStyle) }); pending = null; } },
    stroke: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, lines };
}

const HOUR_CAL: WorkCalendar = {
  id: 'cal-hour-z15', name: 'uur', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: {
    1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
    4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
  } },
};
const DAY_CAL: WorkCalendar = {
  id: 'cal-day-z15', name: 'dag', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

const dayEng = new CalendarEngine(DAY_CAL);
const hourEng = new CalendarEngine(HOUR_CAL);

function segStrings(
  gaps: TaskSplitGap[] | undefined, from: string, to: string, hourMode: boolean, eng: CalendarEngine,
): string {
  const mode = hourMode ? 'hour' : 'day';
  return computeSplitSegments(gaps, parseInstant(from), parseInstant(to), hourMode, eng)
    .map(s => `${formatInstant(s.start, mode)}→${formatInstant(s.end, mode)}`)
    .join(' | ');
}

console.log('-- split-bar-render: as-definitie (H1) bij twee niet-overlappende gaten --');
eq(
  'dag-modus, gaten {480,480}+{1440,480} ⇒ werkblokken ma | wo | vr',
  segStrings([{ afterMinutes: 480, gapMinutes: 480 }, { afterMinutes: 1440, gapMinutes: 480 }],
    '2026-06-01', '2026-06-05', false, dayEng),
  '2026-06-01→2026-06-02 | 2026-06-03→2026-06-04 | 2026-06-05→2026-06-05',
);

eq(
  'uur-modus, gaten {120,60}+{300,60} ⇒ 08-10 | 11-13 | 14-16',
  segStrings([{ afterMinutes: 120, gapMinutes: 60 }, { afterMinutes: 300, gapMinutes: 60 }],
    '2026-06-01T08:00', '2026-06-01T16:00', true, hourEng),
  '2026-06-01T08:00→2026-06-01T10:00 | 2026-06-01T11:00→2026-06-01T13:00 | 2026-06-01T14:00→2026-06-01T16:00',
);

eq(
  'uur-modus, drie gaten ⇒ vier gelijke werkblokken van een uur',
  segStrings(
    [{ afterMinutes: 60, gapMinutes: 60 }, { afterMinutes: 180, gapMinutes: 60 }, { afterMinutes: 300, gapMinutes: 60 }],
    '2026-06-01T08:00', '2026-06-01T15:00', true, hourEng),
  '2026-06-01T08:00→2026-06-01T09:00 | 2026-06-01T10:00→2026-06-01T11:00 | '
  + '2026-06-01T12:00→2026-06-01T13:00 | 2026-06-01T14:00→2026-06-01T15:00',
);

eq(
  'ongesorteerde invoer geeft dezelfde grenzen',
  segStrings([{ afterMinutes: 300, gapMinutes: 60 }, { afterMinutes: 120, gapMinutes: 60 }],
    '2026-06-01T08:00', '2026-06-01T16:00', true, hourEng),
  segStrings([{ afterMinutes: 120, gapMinutes: 60 }, { afterMinutes: 300, gapMinutes: 60 }],
    '2026-06-01T08:00', '2026-06-01T16:00', true, hourEng),
);

S().newProject();
S().addTask({ name: 'basis' });
const base = S().tasks[0];
const st = S();
const view = { ...st.view, viewStartDate: '2026-06-01', zoom: 30, scrollX: 0, scrollY: 0 };

function hourTask(id: string, earlyStart: string, earlyFinish: string, splitGaps?: TaskSplitGap[], completion = 0): Task {
  return {
    ...base, id,
    time: { ...base.time, earlyStart, earlyFinish, scheduleStart: earlyStart, scheduleFinish: earlyFinish, completion },
    splitGaps,
  } as Task;
}

const W = 1400, H = 600, ROWH = 28, HDRH = 60;
function renderRows(rows: ViewRow[], opts: Partial<GanttRenderOptions> = {}): { rects: RRect[]; lines: LineEv[]; renderer: GanttRenderer } {
  const { ctx, rects, lines } = makeCtx();
  const renderer = new GanttRenderer(ctx, {
    rows,
    sequences: [],
    calendar: DAY_CAL,
    effectiveCalById: new Map([
      ['row0', HOUR_CAL], ['row1', HOUR_CAL], ['row2', HOUR_CAL],
      ['dayrow', DAY_CAL], ['dayrow2', DAY_CAL],
    ]),
    view,
    selectedTaskIds: [],
    statusDate: view.viewStartDate,
    showProgressLine: false,
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: ROWH,
    headerHeight: HDRH,
    ...opts,
  });
  let err: unknown = null;
  try { renderer.render(); } catch (e) { err = e; }
  ok(`render() gooit niet: ${String(err)}`, err === null);
  return { rects, lines, renderer };
}
const barTop = (i: number) => HDRH + i * ROWH;
const inRow = (r: { y: number }, i: number) => r.y >= barTop(i) && r.y < barTop(i + 1);
const rowMidY = (i: number) => HDRH + i * ROWH + ROWH / 2;

console.log('-- split-bar-render: 2 gaten ⇒ 3 segmenten op de juiste x-posities + connector --');
{
  const twoGaps: TaskSplitGap[] = [
    { afterMinutes: 120, gapMinutes: 60 },
    { afterMinutes: 300, gapMinutes: 60 },
  ];
  const twoGapTask = hourTask('row0', '2026-06-01T08:00', '2026-06-01T16:00', twoGaps);
  eq('geval 1 is een dagtaak (de dagenmaat)', taskDurationUnit(twoGapTask), 'days');
  const rows: ViewRow[] = [
    { kind: 'task', rowKey: 'row0', task: twoGapTask, depth: 0, dimmed: false },
  ];
  const { rects, lines } = renderRows(rows, { barSplitMode: 'never', view: { ...view, zoom: 240 } });
  const row0Rects = rects.filter(r => inRow(r, 0));
  eq('2 gaten ⇒ exact 3 roundRect-aanroepen (3 segmenten) op die rij', row0Rects.length, 3);
  if (row0Rects.length === 3) {
    const [s1, s2, s3] = row0Rects;
    near('segment 1 begint op x(08:00)', s1.x, 80);
    near('segment 1 is 2 werkuren breed', s1.w, 20);
    near('segment 2 begint op x(11:00) — NIET op 14:00 (dubbel getelde gaten)', s2.x, 110);
    near('segment 2 is 2 werkuren breed', s2.w, 20);
    near('segment 3 begint op x(14:00)', s3.x, 140);
    near('segment 3 loopt tot x(16:00), het taakeinde', s3.x + s3.w, 160);
  }
  const connectorLines = lines.filter(l => Math.abs(l.y - rowMidY(0)) < 0.01);
  eq('necking-connector: exact 1 moveTo + 1 lineTo op halve rijhoogte', connectorLines.length, 2);
  ok('connector: eerst moveTo dan lineTo', connectorLines[0]?.kind === 'move' && connectorLines[1]?.kind === 'line');
}

console.log('-- split-bar-render: knownbug 243, profiel bepaalt de splitranden van een dagtaak --');
{
  const long = [{ start: 420, end: 900 }];
  const cal: WorkCalendar = {
    ...HOUR_CAL, id: 'short-friday', workStartHour: 7, workEndHour: 15,
    workTime: { byWeekday: { 1: long, 2: long, 3: long, 4: long, 5: [{ start: 420, end: 780 }], 6: [], 7: [] } },
  };
  const start = '2026-06-05T07:00';
  for (const baseId of ['ops', 'p6', 'msproject'] as const) {
    const project = { schedulingProfile: { id: baseId, baseId, name: baseId, overrides: {} } };
    const daysMeasure = baseId === 'ops';
    const workdayDurationMeasure = profileCountsWorkdays(project);
    eq(`${baseId}: profielmaat voor Gantt`, workdayDurationMeasure, daysMeasure);
    const task: Task = {
      ...base, id: 'row0',
      time: { ...createDefaultTaskTime(start, 1), durationUnit: 'days' },
      splitGaps: [{ afterMinutes: 120, gapMinutes: 240 }],
    };
    const result = solveProject({ tasks: [task], sequences: [], calendar: cal, calendars: [],
      schedulingOptions: effectiveSchedulingOptions(project) });
    eq(`${baseId}: doorrekening zonder fout`, result.error ?? null, null);
    eq(`${baseId}: start motor`, task.time.earlyStart, start);
    eq(`${baseId}: einde motor`, task.time.earlyFinish, daysMeasure ? '2026-06-08T11:00' : '2026-06-08T13:00');
    const { rects } = renderRows([{ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false }], {
      calendar: cal, effectiveCalById: new Map([[task.id, cal]]), workdayDurationMeasure,
      compressNonWorkdays: false, barSplitMode: 'never',
      view: { ...view, viewStartDate: '2026-06-05', zoom: 240 },
    });
    const pieces = rects.filter(r => inRow(r, 0));
    eq(`${baseId}: twee zichtbare stukken`, pieces.length, 2);
    if (pieces.length === 2) {
      const [first, second] = pieces;
      near(`${baseId}: balkstart`, first.x, 70);
      near(`${baseId}: begin pauze`, first.x + first.w, daysMeasure ? 85 : 90);
      near(`${baseId}: einde pauze`, second.x, daysMeasure ? 115 : 130);
      near(`${baseId}: balkeinde = einde motor`, second.x + second.w, daysMeasure ? 830 : 850);
    }
  }
}

console.log('-- split-bar-render: dag-modus, twee gaten ⇒ ma | wo | vr op de juiste x --');
{
  const twoDayGaps: TaskSplitGap[] = [
    { afterMinutes: 480, gapMinutes: 480 },
    { afterMinutes: 1440, gapMinutes: 480 },
  ];
  const dayTask: Task = {
    ...base, id: 'dayrow2',
    time: {
      ...base.time,
      earlyStart: '2026-06-01', earlyFinish: '2026-06-05',
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-05', completion: 0,
    },
    splitGaps: twoDayGaps,
  } as Task;
  const { rects } = renderRows([{ kind: 'task', rowKey: dayTask.id, task: dayTask, depth: 0, dimmed: false }]);
  const dayRects = rects.filter(r => inRow(r, 0));
  eq('dag-modus, 2 gaten ⇒ exact 3 segmenten', dayRects.length, 3);
  if (dayRects.length === 3) {
    const [s1, s2, s3] = dayRects;
    near('maandag: x 0, breedte 30', s1.x, 0);
    near('maandag is één dag breed', s1.w, 30);
    near('woensdag begint op x 60 — NIET op 30 (blok 2 twee dagen breed)', s2.x, 60);
    near('woensdag is één dag breed, niet twee', s2.w, 30);
    near('vrijdag begint op x 120, binnen de balk', s3.x, 120);
    near('vrijdag loopt tot x 150 (inclusieve laatste dag)', s3.x + s3.w, 150);
    ok('geen enkel segment loopt achterstevoren of buiten de balk',
      dayRects.every(r => r.w > 0 && r.x >= 0 && r.x + r.w <= 150));
  }
}

console.log('-- split-bar-render: barSplitMode=never + geen splitGaps ⇒ geen split --');
{
  const rows: ViewRow[] = [
    { kind: 'task', rowKey: 'row1', task: hourTask('row1', '2026-06-01T08:00', '2026-06-03T16:00', undefined), depth: 0, dimmed: false },
  ];
  const { rects, lines } = renderRows(rows, { barSplitMode: 'never' });
  const row1Rects = rects.filter(r => inRow(r, 0));
  eq('geen splitGaps + barSplitMode=never ⇒ exact 1 roundRect (ongesplitst)', row1Rects.length, 1);
  const connectorLines = lines.filter(l => Math.abs(l.y - rowMidY(0)) < 0.01);
  eq('geen connector zonder split', connectorLines.length, 0);
}

console.log('-- split-bar-render: voortgangsvulling globaal, niet per segment --');
{
  const oneGap: TaskSplitGap[] = [{ afterMinutes: 120, gapMinutes: 2880 }];
  const passA = renderRows([
    { kind: 'task', rowKey: 'row2', task: hourTask('row2', '2026-06-01T08:00', '2026-06-22T16:00', oneGap, 0), depth: 0, dimmed: false },
  ]);
  const bgA = passA.rects.filter(r => inRow(r, 0));
  eq('opzet pass A: 1 gat ⇒ 2 achtergrondsegmenten', bgA.length, 2);
  if (bgA.length === 2) {
    const [seg1, seg2] = bgA;
    const overallX1 = seg1.x;
    const overallX2 = seg2.x + seg2.w;
    const overallWidth = overallX2 - overallX1;
    const targetProgressEnd = seg1.x + seg1.w * 0.5;
    const completion = (targetProgressEnd - overallX1) / overallWidth;
    ok('opzet: completion ligt in (0,1)', completion > 0 && completion < 1);

    const passB = renderRows([
      { kind: 'task', rowKey: 'row2', task: hourTask('row2', '2026-06-01T08:00', '2026-06-22T16:00', oneGap, completion), depth: 0, dimmed: false },
    ]);
    const row2Rects = passB.rects.filter(r => inRow(r, 0));
    const progressTone = doneBarTones(readGanttPalette().normal, false).fill.toLowerCase();
    const progressFills = row2Rects.filter(r => r.fillStyle.toLowerCase() === progressTone);
    ok('er is minstens 1 voortgangsvulling', progressFills.length > 0);
    const seg2Start = seg2.x;
    const leaksIntoSeg2 = progressFills.some(r => r.x >= seg2Start - 0.01);
    ok('GEEN voortgangsvulling in segment 2 (progressEnd valt ruim vóór segment 2)', !leaksIntoSeg2);
    const allInSeg1 = progressFills.every(r => r.x >= seg1.x - 0.01 && r.x + r.w <= seg1.x + seg1.w + 0.01);
    ok('elke voortgangsvulling blijft binnen segment 1 s grenzen', allInSeg1);
  }
}

console.log('-- split-bar-render: dag-modus splitGaps (addWorkingDaysSigned-pad, geen crash) --');
{
  const dayGap: TaskSplitGap[] = [{ afterMinutes: 1440, gapMinutes: 960 }];
  const dayTask: Task = {
    ...base, id: 'dayrow',
    time: { ...base.time, earlyStart: '2026-06-01', earlyFinish: '2026-06-20', scheduleStart: '2026-06-01', scheduleFinish: '2026-06-20', completion: 0 },
    splitGaps: dayGap,
  } as Task;
  const { rects } = renderRows([{ kind: 'task', rowKey: dayTask.id, task: dayTask, depth: 0, dimmed: false }]);
  const dayRects = rects.filter(r => inRow(r, 0));
  eq('dag-modus: 1 gat ⇒ 2 segmenten, GEEN crash', dayRects.length, 2);
}

console.log('-- split-bar-render: hit-test per stuk (segmentIndex/segmentCount, pauze = null) --');
{
  const splitTask: Task = {
    ...base, id: 'dayrow',
    time: {
      ...base.time,
      earlyStart: '2026-06-01', earlyFinish: '2026-06-17',
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-17', scheduleDuration: 10, completion: 0,
    },
    splitGaps: [{ afterMinutes: 2400, gapMinutes: 1440, source: 'user' }],
  } as Task;
  const plainTask: Task = {
    ...base, id: 'dayrow2',
    time: {
      ...base.time,
      earlyStart: '2026-06-01', earlyFinish: '2026-06-12',
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-12', scheduleDuration: 10, completion: 0,
    },
    splitGaps: undefined,
  } as Task;
  const { rects, renderer } = renderRows([
    { kind: 'task', rowKey: splitTask.id, task: splitTask, depth: 0, dimmed: false },
    { kind: 'task', rowKey: plainTask.id, task: plainTask, depth: 0, dimmed: false },
  ]);
  const segs = rects.filter(r => inRow(r, 0));
  eq('opzet: 1 gat ⇒ 2 stukken', segs.length, 2);
  if (segs.length === 2) {
    const [s1, s2] = segs;
    near('opzet: stuk 1 eindigt op x 210', s1.x + s1.w, 210);
    near('opzet: stuk 2 begint op x 300', s2.x, 300);
    const y = rowMidY(0);
    const mid2 = renderer.getTaskBarBounds((s2.x + s2.x + s2.w) / 2, y);
    eq('midden stuk 2: taak', mid2?.task.id, 'dayrow');
    eq('midden stuk 2: body', mid2?.edge, 'body');
    eq('midden stuk 2: segmentIndex 1', mid2?.segmentIndex, 1);
    eq('midden stuk 2: segmentCount 2', mid2?.segmentCount, 2);
    const right1 = renderer.getTaskBarBounds(s1.x + s1.w - 2, y);
    eq('rechterrand stuk 1: right', right1?.edge, 'right');
    eq('rechterrand stuk 1: segmentIndex 0', right1?.segmentIndex, 0);
    eq('rechterrand stuk 1: segmentCount 2', right1?.segmentCount, 2);
    const left1 = renderer.getTaskBarBounds(s1.x + 2, y);
    eq('linkerrand stuk 1: left (hele taak)', left1?.edge, 'left');
    eq('linkerrand stuk 1: segmentIndex 0', left1?.segmentIndex, 0);
    const left2 = renderer.getTaskBarBounds(s2.x + 2, y);
    eq('linkerrand stuk 2 heeft GEEN eigen grijpzone: body', left2?.edge, 'body');
    eq('linkerrand stuk 2: segmentIndex 1', left2?.segmentIndex, 1);
    const right2 = renderer.getTaskBarBounds(s2.x + s2.w - 2, y);
    eq('rechterrand laatste stuk: right', right2?.edge, 'right');
    eq('rechterrand laatste stuk: segmentIndex 1', right2?.segmentIndex, 1);
    eq('x IN de pauze: geen grijpvlak', renderer.getTaskBarBounds(255, y), null);
    eq('x in de pauze: getSplitGapAt geeft pauze 0', renderer.getSplitGapAt(255, y)?.gapIndex, 0);
    eq('x in de pauze: getSplitGapAt geeft de taak', renderer.getSplitGapAt(255, y)?.task.id, 'dayrow');
    eq('x op een stuk: getSplitGapAt null', renderer.getSplitGapAt((s2.x + s2.x + s2.w) / 2, y), null);
  }
  const y2 = rowMidY(1);
  const plainBody = renderer.getTaskBarBounds(150, y2);
  eq('ongesplitst: body', plainBody?.edge, 'body');
  eq('ongesplitst: segmentIndex 0', plainBody?.segmentIndex, 0);
  eq('ongesplitst: segmentCount 1', plainBody?.segmentCount, 1);
  eq('ongesplitst: linkerrand', renderer.getTaskBarBounds(2, y2)?.edge, 'left');
  eq('ongesplitst: rechterrand', renderer.getTaskBarBounds(358, y2)?.edge, 'right');
  eq('ongesplitst: getSplitGapAt null', renderer.getSplitGapAt(150, y2), null);
}

console.log('-- split-bar-render: uur-taak > 1 jaar, gescrold naar jaar 2 ⇒ segmenten in beeld --');
{
  const longHour = hourTask('row0', '2026-06-01T08:00', '2028-06-01T16:00');
  longHour.time = { ...longHour.time, durationUnit: 'hours' };
  const rows: ViewRow[] = [
    { kind: 'task', rowKey: 'row0', task: longHour, depth: 0, dimmed: false },
  ];
  const scrollX = 457 * 240;
  const { rects } = renderRows(rows, { barSplitMode: 'always', view: { ...view, zoom: 240, scrollX } });
  const visible = rects.filter(r => inRow(r, 0) && r.x + r.w > 0 && r.x < W && r.w > 0);
  ok(`uur-taak in jaar 2: werksegmenten in beeld (kreeg ${visible.length})`, visible.length >= 3);
  ok('uur-taak in jaar 2: segmenten zijn een werkdag breed of smaller (gesplitst)', visible.every(r => r.w <= 240));
}

interface PRect { x: number; y: number; w: number; h: number; fillStyle: string }
interface PLine { kind: 'move' | 'line'; x: number; y: number; strokeStyle: string }
function makeD2D(): { d2d: Draw2D; rects: PRect[]; lines: PLine[] } {
  const rects: PRect[] = [];
  const lines: PLine[] = [];
  let pending: { x: number; y: number; w: number; h: number } | null = null;
  const stv = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const d2d: Draw2D = {
    get font() { return stv.font; }, set font(v) { stv.font = v; },
    get fillStyle() { return stv.fillStyle; }, set fillStyle(v) { stv.fillStyle = v; },
    get strokeStyle() { return stv.strokeStyle; }, set strokeStyle(v) { stv.strokeStyle = v; },
    get lineWidth() { return stv.lineWidth; }, set lineWidth(v) { stv.lineWidth = v; },
    get textAlign() { return stv.textAlign; }, set textAlign(v) { stv.textAlign = v; },
    get textBaseline() { return stv.textBaseline; }, set textBaseline(v) { stv.textBaseline = v; },
    setLineDash() {},
    fillRect() {}, strokeRect() {},
    beginPath() { pending = null; },
    moveTo(x, y) { lines.push({ kind: 'move', x, y, strokeStyle: stv.strokeStyle }); },
    lineTo(x, y) { lines.push({ kind: 'line', x, y, strokeStyle: stv.strokeStyle }); },
    closePath() {},
    fill() { if (pending) { rects.push({ ...pending, fillStyle: stv.fillStyle }); pending = null; } },
    stroke() {},
    roundRect(x, y, w, h) { pending = { x, y, w, h }; },
    fillText() {}, measureText(t) { return { width: t.length * 6 }; },
  };
  return { d2d, rects, lines };
}

const isConnectorLine = (l: PLine) => l.strokeStyle.endsWith('80');

const printTask = (id: string, from: string, to: string, splitGaps?: TaskSplitGap[], completion = 0): Task => ({
  id, name: 'Print ' + id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  childIds: [], predecessorIds: [], successorIds: [], resourceIds: [], progress: 0, isMilestone: false,
  time: {
    durationType: 'WORKTIME', scheduleDuration: 1,
    scheduleStart: from, scheduleFinish: to, earlyStart: from, earlyFinish: to,
    lateStart: from, lateFinish: to, freeFloat: 0, totalFloat: 0, isCritical: false, completion,
  },
  splitGaps,
} as unknown as Task);

const PRINT_CAL: WorkCalendar = { ...DAY_CAL, id: 'print-cal-z15' };
const printOptions: PrintOptions = {
  showCritical: true, showFloat: false, showDeps: false, showWeekends: true,
  showLegend: false, showTaskNames: false, showCompletion: true,
  autoFit: true, customZoom: 1, paperSize: 'A4', orientation: 'landscape',
  companyName: '', labels: {
    noTasks: '-', printed: '-', legend: {} as any, tableHeaders: {} as any,
    today: '-',
  }, locale: 'nl', reportFontScale: 100,
} as PrintOptions;

console.log('-- split-bar-render (print/PDF): dezelfde assertie op de Draw2D-opnemer --');
{
  const twoGaps: TaskSplitGap[] = [
    { afterMinutes: 1440, gapMinutes: 960 },
    { afterMinutes: 2880, gapMinutes: 960 },
  ];
  const { d2d, rects, lines } = makeD2D();
  let err: unknown = null;
  try {
    renderReport(() => d2d, [printTask('p0', '2026-06-01', '2026-06-25', twoGaps)], [], PRINT_CAL, 'P', printOptions);
  } catch (e) { err = e; }
  ok(`renderReport gooit niet: ${String(err)}`, err === null);
  eq('print: 2 gaten ⇒ exact 3 roundRect-aanroepen (3 segmenten)', rects.length, 3);
  if (rects.length === 3) {
    const [s1, s2, s3] = rects;
    const pxPerDay = s1.w / 3;
    ok(`opzet: rapportschaal ruim boven de 2px-minimumbreedte (${pxPerDay.toFixed(2)} px/dag)`, pxPerDay > 4);
    near('print: gat 1 is 4 kalenderdagen breed (do→ma)', (s2.x - (s1.x + s1.w)) / pxPerDay, 4, 0.05);
    near('print: werkblok 2 is 1 werkdag breed, niet 3', s2.w / pxPerDay, 1, 0.05);
    near('print: gat 2 is 2 kalenderdagen breed (di→do)', (s3.x - (s2.x + s2.w)) / pxPerDay, 2, 0.05);
    ok('print: geen segment loopt achterstevoren', [s1, s2, s3].every(r => r.w > 0));
  }
  const connectorLines = lines.filter(isConnectorLine);
  eq('print: necking-connector — exact 1 moveTo + 1 lineTo', connectorLines.length, 2);
  ok('print: connector eerst moveTo dan lineTo', connectorLines[0]?.kind === 'move' && connectorLines[1]?.kind === 'line');

  const { d2d: d2dNo, rects: rectsNo, lines: linesNo } = makeD2D();
  renderReport(() => d2dNo, [printTask('p1', '2026-06-01', '2026-06-10', undefined)], [], PRINT_CAL, 'P', printOptions);
  eq('print: geen splitGaps ⇒ exact 1 roundRect', rectsNo.length, 1);
  eq('print: geen splitGaps ⇒ geen connector', linesNo.filter(isConnectorLine).length, 0);
}

console.log('-- split-bar-render (print/PDF): voortgangsvulling globaal, niet per segment --');
{
  const oneGap: TaskSplitGap[] = [{ afterMinutes: 1440, gapMinutes: 5760 }];
  const passA = makeD2D();
  renderReport(() => passA.d2d, [printTask('p2', '2026-06-01', '2026-07-20', oneGap, 0)], [], PRINT_CAL, 'P', printOptions);
  eq('print opzet pass A: 1 gat ⇒ 2 achtergrondsegmenten', passA.rects.length, 2);
  if (passA.rects.length === 2) {
    const [seg1, seg2] = passA.rects;
    const overallX1 = seg1.x;
    const overallWidth = (seg2.x + seg2.w) - overallX1;
    const completion = ((seg1.x + seg1.w * 0.5) - overallX1) / overallWidth;
    const passB = makeD2D();
    renderReport(() => passB.d2d, [printTask('p2', '2026-06-01', '2026-07-20', oneGap, completion)], [], PRINT_CAL, 'P', printOptions);
    const printGrey = doneBarTones(seg1.fillStyle, false).fill;
    const progressFills = passB.rects.filter(r => r.fillStyle === printGrey);
    ok('print: minstens 1 voortgangsvulling', progressFills.length > 0);
    const leaksIntoSeg2 = progressFills.some(r => r.x >= seg2.x - 0.01);
    ok('print: GEEN voortgangsvulling in segment 2', !leaksIntoSeg2);
  }
}

if (diffs.length === 0) {
  console.log(`OK  split-bar-render: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  split-bar-render: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
