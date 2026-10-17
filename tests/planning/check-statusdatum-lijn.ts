// De statusdatumlijn staat op het echte tijdstip van de statusdatum (besluit eigenaar 2026-10-17:
// label en lijn zeggen hetzelfde). De ECHTE GanttRenderer met een opnemende 2D-context-stub (zelfde
// opzet als check-arrow-hour-anchor.ts). Vóór de fix kapte `parseDate` de tijd weg: de lijn stond op
// het begin van de dag terwijl het label "17:00" zei.
//
// Keuze: kalendertijd op de as, net als een uurtaakbalk (`parseInstant` + `dateToX`). Op de lineaire
// kalenderas is 17:00 dus 17/24 van de dagbreedte, ook bij dagzoom. Zonder tijd: begin van de dag.
//
//  §1 gestippelde statusdatumlijn (voortgangslijn uit): 17:00, 12:00 en zonder tijd, op drie zooms.
//  §2 voortgangslijn (de rechte rug op een niet-gestarte taak) ligt op dezelfde X.
//  §3 het label staat naast die X (rechts, 4 px).
//
// Draait via run.sh. Exit 0 = alles groen.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';
import { parseDate } from '@/utils/dateUtils';

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
const CASES: Array<[string, number]> = [[`${DAY}T17:00`, 17 / 24], [`${DAY}T12:00`, 12 / 24], [DAY, 0]];

function render(statusDate: string, zoom: number, progress: boolean) {
  const rec = makeCtx();
  const st = S();
  const r = new GanttRenderer(rec.ctx, {
    rows: st.viewRows, sequences: st.sequences, calendar: st.calendar,
    view: { ...st.view, zoom, scrollX: 0, scrollY: 0, viewStartDate: '2026-02-23' },
    selectedTaskIds: [], canvasWidth: 2400, canvasHeight: 300, rowHeight: 28, headerHeight: 50, palette,
    barSplitMode: 'never', statusDate, showStatusDateLine: true, showProgressLine: progress,
    dateNotation: 'dmy', timeNotation: '24h',
  });
  r.render();
  return { ...rec, dayStartX: r.dateToX(parseDate(DAY)) };
}

for (const zoom of [24, 48, 96]) {
  for (const [statusDate, fraction] of CASES) {
    // §1 gestippelde lijn
    const a = render(statusDate, zoom, false);
    const want = a.dayStartX + fraction * zoom;
    const vertical = a.lines.filter(p => p.length === 4 && p[0] === p[2]);
    ok(`§1 zoom ${zoom} ${statusDate}: één statusdatumlijn`, vertical.length === 1, `${vertical.length} lijnen`);
    if (vertical.length === 1) {
      ok(`§1 zoom ${zoom} ${statusDate}: lijn op ${(fraction * 24).toFixed(0)}:00 van de dag`,
        Math.abs(vertical[0][0] - want) < 0.01, `lijn ${vertical[0][0].toFixed(2)}, verwacht ${want.toFixed(2)}`);
    }
    // §3 label rechts naast de lijn (vlakje begint 4 px rechts; tekst nog de padding verder)
    const label = a.texts.find(x => x.text.startsWith('02-03-2026'));
    ok(`§3 zoom ${zoom} ${statusDate}: label naast de lijn`, !!label && label.x > want + 4 && label.x < want + 20,
      label ? `label ${label.x.toFixed(2)}, lijn ${want.toFixed(2)}` : 'geen label');

    // §2 voortgangslijn: rechte rug op de rij van de niet-gestarte taak
    const b = render(statusDate, zoom, true);
    const spine = b.lines.flat().filter((_, i) => i % 2 === 0);
    ok(`§2 zoom ${zoom} ${statusDate}: voortgangslijn op dezelfde X`,
      spine.length > 0 && spine.every(x => Math.abs(x - want) < 0.01), `x ${spine.map(x => x.toFixed(2)).join(',')}, verwacht ${want.toFixed(2)}`);
  }
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-statusdatum-lijn: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-statusdatum-lijn: ${checks}/${checks} groen`);
