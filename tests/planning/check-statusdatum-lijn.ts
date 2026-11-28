const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';
import { parseDate } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const ok = (label: string, cond: boolean, detail = '') => { checks++; if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`); };

const STATUS_COLOR = '#0a0b0c';
const palette = { ...readGanttPalette(), statusDate: STATUS_COLOR };

function makeCtx() {
  const lines: number[][] = [];
  const texts: Array<{ text: string; x: number }> = [];
  let cur: number[] = [];
  const st = { fillStyle: '', strokeStyle: '' };
  const noop = () => {};
  const ctx = {
    get fillStyle() { return st.fillStyle; }, set fillStyle(v: string) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v: string) { st.strokeStyle = v; },
    lineWidth: 1, font: '', textAlign: '', textBaseline: '', globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    beginPath: () => { cur = []; },
    moveTo: (x: number, y: number) => { cur.push(x, y); }, lineTo: (x: number, y: number) => { cur.push(x, y); },
    roundRect: noop, rect: noop, fill: noop,
    stroke: () => { if (String(st.strokeStyle).toLowerCase() === STATUS_COLOR && cur.length >= 4) lines.push(cur.slice()); },
    closePath: noop, fillRect: noop, strokeRect: noop, clearRect: noop, arc: noop, arcTo: noop, ellipse: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop, setLineDash: noop, getLineDash: () => [],
    fillText: (text: string, x: number) => { texts.push({ text: String(text), x }); }, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }), createPattern: () => null, quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, lines, texts };
}

S().newProject();
const t = S().addTask({ name: 'Later werk' });
useAppStore.setState((s) => {
  const task = s.tasks.find((x) => x.id === t)!;
  Object.assign(task.time, { earlyStart: '2026-03-10', earlyFinish: '2026-03-12', scheduleStart: '2026-03-10', scheduleFinish: '2026-03-12', completion: 0 });
});
S().recomputeViewRows();

const DAY = '2026-03-02';
const CASES: Array<[string, number, string]> = [
  [`${DAY}T17:00`, 17 / 24, '02-03-2026 17:00'], [`${DAY}T12:00`, 12 / 24, '02-03-2026 12:00'], [DAY, 0, '02-03-2026'],
];
const BAND = [{ start: 7 * 60, end: 16 * 60 }];
const DAY_CAL: WorkCalendar = S().calendar;
const HOUR_CAL: WorkCalendar = { ...DAY_CAL, id: 'uur', workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } } } as WorkCalendar;
ok('voorwaarde: de standaardkalender rekent in dag-modus', !DAY_CAL.workTime);

function render(calendar: WorkCalendar, statusDate: string, zoom: number, progress: boolean) {
  const rec = makeCtx();
  const st = S();
  const r = new GanttRenderer(rec.ctx, {
    rows: st.viewRows, sequences: st.sequences, calendar,
    view: { ...st.view, zoom, scrollX: 0, scrollY: 0, viewStartDate: '2026-02-23' },
    selectedTaskIds: [], canvasWidth: 2400, canvasHeight: 300, rowHeight: 28, headerHeight: 50, palette,
    barSplitMode: 'never', statusDate, showStatusDateLine: true, showProgressLine: progress,
    dateNotation: 'dmy', timeNotation: '24h',
  });
  r.render();
  return { ...rec, dayStartX: r.dateToX(parseDate(DAY)) };
}

for (const [mode, calendar] of [['dag', DAY_CAL], ['uur', HOUR_CAL]] as const) {
  for (const zoom of [24, 48, 96]) {
    for (const [statusDate, hourFraction, hourLabel] of CASES) {
      const fraction = mode === 'uur' ? hourFraction : 0;
      const wantLabel = mode === 'uur' ? hourLabel : '02-03-2026';
      const tag = `${mode} zoom ${zoom} ${statusDate}`;
      const a = render(calendar, statusDate, zoom, false);
      const want = a.dayStartX + fraction * zoom;
      const vertical = a.lines.filter(p => p.length === 4 && p[0] === p[2]);
      ok(`§1 ${tag}: één statusdatumlijn`, vertical.length === 1, `${vertical.length} lijnen`);
      if (vertical.length === 1) {
        ok(`§1 ${tag}: lijn op ${(fraction * 24).toFixed(0)}:00 van de dag`,
          Math.abs(vertical[0][0] - want) < 0.01, `lijn ${vertical[0][0].toFixed(2)}, verwacht ${want.toFixed(2)}`);
      }
      const label = a.texts.find(x => x.text.startsWith('02-03-2026'));
      ok(`§3 ${tag}: label naast de lijn`, !!label && label.x > want + 4 && label.x < want + 20,
        label ? `label ${label.x.toFixed(2)}, lijn ${want.toFixed(2)}` : 'geen label');
      ok(`§3 ${tag}: labeltekst`, label?.text === wantLabel, `kreeg ${JSON.stringify(label?.text)}, verwacht ${JSON.stringify(wantLabel)}`);

      const b = render(calendar, statusDate, zoom, true);
      const spine = b.lines.flat().filter((_, i) => i % 2 === 0);
      ok(`§2 ${tag}: voortgangslijn op dezelfde X`,
        spine.length > 0 && spine.every(x => Math.abs(x - want) < 0.01), `x ${spine.map(x => x.toFixed(2)).join(',')}, verwacht ${want.toFixed(2)}`);
    }
  }
}

const late = S().addTask({ name: 'Ochtendwerk' });
useAppStore.setState((s) => {
  const task = s.tasks.find((x) => x.id === late)!;
  Object.assign(task.time, {
    earlyStart: `${DAY}T08:00`, earlyFinish: `${DAY}T12:00`, scheduleStart: `${DAY}T08:00`, scheduleFinish: `${DAY}T12:00`, completion: 0,
  });
});
S().recomputeViewRows();
for (const zoom of [24, 96]) {
  const hour = render(HOUR_CAL, `${DAY}T17:00`, zoom, true);
  const statusX = hour.dayStartX + (17 / 24) * zoom;
  const barStartX = hour.dayStartX + (8 / 24) * zoom;
  const xs = hour.lines.flat().filter((_, i) => i % 2 === 0);
  ok(`§4 uur zoom ${zoom}: voortgangslijn stulpt uit naar 08:00 (achterlopende taak)`,
    xs.some(x => Math.abs(x - barStartX) < 0.01), `x ${xs.map(x => x.toFixed(2)).join(',')}, verwacht ook ${barStartX.toFixed(2)} (status ${statusX.toFixed(2)})`);
  const day = render(DAY_CAL, `${DAY}T17:00`, zoom, true);
  const dxs = day.lines.flat().filter((_, i) => i % 2 === 0);
  ok(`§4 dag zoom ${zoom}: per dag ⇒ niet gestart, rechte lijn op de dagrand`,
    dxs.length > 0 && dxs.every(x => Math.abs(x - day.dayStartX) < 0.01), `x ${dxs.map(x => x.toFixed(2)).join(',')}, verwacht ${day.dayStartX.toFixed(2)}`);
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-statusdatum-lijn: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-statusdatum-lijn: ${checks}/${checks} groen`);
