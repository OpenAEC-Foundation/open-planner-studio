// Relatiepijlen worden op de canvasrand geknipt vóór het tekenen — prestatiemeting rehab-2 (2026-10-07).
//
// AANLEIDING. Op rehab-2.xer (6.978 taken, 10.730 relaties) kostte elke scroll- of zoomstap ±1 s
// rasteren (`ProduceCanvasResource` 0,8–1,8 s per frame); `setLineDash` als no-op haalde 93 % weg.
// De verticale cull hield terecht elke pijl die het beeld KRUIST, maar gaf zijn volle route door:
// een relatie tussen rij 100 en rij 6.000 is dan ±165.000 px lang, en het streeppatroon werd over
// die hele lengte berekend. Nu knipt `strokeArrowPath` elk segment op de canvas (plus marge) en
// tekent alleen het zichtbare stuk; het streeppatroon loopt door via `lineDashOffset` = de
// afgelegde lengte tot het knippunt, zodat het beeld identiek blijft.
//
// Wat dit pint:
//  A. Op ±7.000 taken / ±10.000 relaties ligt GEEN getekend pijlpunt verder dan de marge buiten
//     de canvas, en de totale getekende pijllengte blijft begrensd (algoritme, geen tijdmeting).
//  B. Streepfase: een geknipte lange pijl begint met `lineDashOffset` = booglengte van het
//     weggeknipte stuk, en elk getekend punt ligt op de ongeknipte route (gemeten op een canvas dat
//     groot genoeg is om niets te knippen).
//  C. Na de pijlenlaag staat `lineDashOffset` weer op 0 (latere lagen strepen vanaf het begin).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';
import type { TaskTime } from '@/types/task';
import { addCalendarDays, formatDate, parseDate } from '@/utils/dateUtils';
import { createLargeSchedule, countsOf } from './largeScheduleFixture';

const S = () => useAppStore.getState();
const fails: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  checks++;
  if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`);
};

const ARROW = '#a0a0a1';
const ARROW_CRIT = '#a0a0a2';
const palette = { ...readGanttPalette(), dependency: ARROW, critical: ARROW_CRIT };

interface Stroke { pts: number[]; offset: number; dash: number[] }

function makeCtx(): { ctx: CanvasRenderingContext2D; strokes: Stroke[]; state: { lineDashOffset: number } } {
  const strokes: Stroke[] = [];
  let cur: number[] = [];
  let dash: number[] = [];
  const noop = () => {};
  const state = {
    fillStyle: '' as unknown, strokeStyle: '' as unknown, lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '', lineDashOffset: 0,
    beginPath: () => { cur = []; },
    moveTo: (x: number, y: number) => { cur.push(x, y); },
    lineTo: (x: number, y: number) => { cur.push(x, y); },
    stroke: () => {
      const color = String(state.strokeStyle).toLowerCase();
      if ((color === ARROW || color === ARROW_CRIT) && cur.length >= 4) {
        strokes.push({ pts: cur.slice(), offset: state.lineDashOffset, dash: dash.slice() });
      }
    },
    setLineDash: (d: number[]) => { dash = d.slice(); },
    getLineDash: () => dash.slice(),
    roundRect: noop, rect: noop, fill: noop, closePath: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    arc: noop, arcTo: noop, ellipse: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop, setTransform: noop, resetTransform: noop,
    fillText: noop, strokeText: noop, measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }), createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: state as unknown as CanvasRenderingContext2D, strokes, state };
}

function render(opts: { width: number; height: number; scrollY: number; zoom?: number; driving?: string[]; viewStartDate?: string }) {
  const { ctx, strokes, state } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, zoom: opts.zoom ?? st.view.zoom, scrollX: 0, scrollY: opts.scrollY, viewStartDate: opts.viewStartDate ?? st.view.viewStartDate },
    selectedTaskIds: [],
    drivingSequenceIds: opts.driving ?? st.cpmResult?.drivingSequenceIds,
    canvasWidth: opts.width,
    canvasHeight: opts.height,
    rowHeight: 28,
    headerHeight: 50,
    palette,
  }).render();
  return { strokes, finalOffset: state.lineDashOffset };
}

const lengthOf = (pts: number[]) => {
  let len = 0;
  for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return len;
};

/** Booglengte langs `route` tot punt (x, y), of null als het punt niet op de route ligt. */
function arcLengthTo(route: number[], x: number, y: number): number | null {
  let acc = 0;
  for (let i = 2; i < route.length; i += 2) {
    const x0 = route[i - 2], y0 = route[i - 1], x1 = route[i], y1 = route[i + 1];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    const d0 = Math.hypot(x - x0, y - y0);
    const d1 = Math.hypot(x1 - x, y1 - y);
    if (Math.abs(d0 + d1 - seg) < 1e-6) return acc + d0;
    acc += seg;
  }
  return null;
}

const MARGIN = 32; // ruimer dan de rendermarge: de toets is "niet ver buiten", niet de exacte marge

// ── A. Op schaal ────────────────────────────────────────────────────────────────────────────────
{
  const big = createLargeSchedule({ assignmentsPerTask: 1 });
  const counts = countsOf(big);
  ok('A opzet: ±7.000 taken en ≥ 10.000 relaties', counts.tasks >= 6_900 && counts.sequences >= 10_000, JSON.stringify(counts));
  S().applyLoadedProject(big, { filePath: null, recompute: true });
  ok('A opzet: berekend zonder fout', !!S().cpmResult && !S().cpmResult!.error, S().cpmResult?.error ?? '');
  ok('A opzet: er zijn driving én niet-driving relaties',
    (S().cpmResult?.drivingSequenceIds.length ?? 0) > 0 && (S().cpmResult?.drivingSequenceIds.length ?? 0) < S().sequences.length);
  const W = 1600, H = 900;
  for (const [label, scrollY, zoom] of [['midden', 3_500 * 28, 20], ['boven', 0, 8], ['onder', 6_500 * 28, 40]] as const) {
    // Venster op de taken die op deze hoogte staan: de eerste taakrij in beeld, tien dagen ervoor.
    const rows = S().viewRows;
    const firstRow = rows.slice(Math.floor(scrollY / 28)).find(r => r.kind === 'task' && !!r.task.time.earlyStart);
    const anchor = firstRow?.kind === 'task' ? firstRow.task.time.earlyStart.slice(0, 10) : '2026-01-05';
    const viewStartDate = formatDate(addCalendarDays(parseDate(anchor), -10));
    const { strokes, finalOffset } = render({ width: W, height: H, scrollY, zoom, viewStartDate });
    const outside = strokes.flatMap(s => {
      const bad: string[] = [];
      for (let i = 0; i < s.pts.length; i += 2) {
        const x = s.pts[i], y = s.pts[i + 1];
        if (x < -MARGIN || x > W + MARGIN || y < -MARGIN || y > H + MARGIN) bad.push(`(${x.toFixed(0)},${y.toFixed(0)})`);
      }
      return bad;
    });
    ok(`A ${label}: pijlen getekend`, strokes.length > 5, String(strokes.length));
    ok(`A ${label}: ook gestreepte pijlen`, strokes.some(s => s.dash.length > 0));
    ok(`A ${label}: geen getekend pijlpunt ver buiten de canvas`, outside.length === 0, `${outside.length}× bv. ${outside.slice(0, 3).join(' ')}`);
    const total = strokes.reduce((sum, s) => sum + lengthOf(s.pts), 0);
    // Elke getekende run ligt binnen de (canvas + marge); per run hoogstens een paar keer de omtrek.
    ok(`A ${label}: totale getekende pijllengte begrensd`, total <= strokes.length * 2 * (W + H + 4 * MARGIN), `${total.toFixed(0)} px over ${strokes.length} strokes`);
    ok(`A ${label}: lineDashOffset na de pijlenlaag terug op 0`, finalOffset === 0, String(finalOffset));
  }
}

// ── B. Streepfase bij knippen ─────────────────────────────────────────────────────────────────────
{
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  const ids: string[] = [];
  for (let i = 0; i < 300; i++) ids.push(S().addTask({ name: `T${i}`, time: { scheduleDuration: 2 } as TaskTime }));
  S().addSequence({ predecessorId: ids[0], successorId: ids[299], type: 'FINISH_START', lagDays: 3 });
  S().runCPM();
  const fullH = 50 + 300 * 28 + 100;
  // Niets driving ⇒ gestreept; een canvas dat alles bevat ⇒ niets geknipt (de referentieroute).
  const full = render({ width: 1600, height: fullH, scrollY: 0, zoom: 20, driving: [], viewStartDate: '2026-02-23' });
  ok('B referentie: één ongeknipte gestreepte pijl', full.strokes.length === 1 && full.strokes[0].dash.length > 0 && full.strokes[0].offset === 0,
    JSON.stringify(full.strokes.map(s => ({ n: s.pts.length, off: s.offset, dash: s.dash }))));
  const route = full.strokes[0]?.pts ?? [];
  // Dezelfde pijl in een venster halverwege: zowel begin als eind vallen buiten beeld.
  const clipped = render({ width: 1600, height: 500, scrollY: 150 * 28, zoom: 20, driving: [], viewStartDate: '2026-02-23' });
  ok('B geknipt: precies één run in beeld', clipped.strokes.length === 1, String(clipped.strokes.length));
  const run = clipped.strokes[0];
  if (run && route.length) {
    // Terug naar referentiecoördinaten: dezelfde scroll-verschuiving.
    const shift = 150 * 28;
    const pts = run.pts.map((v, i) => (i % 2 === 1 ? v + shift : v));
    const onRoute = pts.every((_, i) => i % 2 === 1 || arcLengthTo(route, pts[i], pts[i + 1]) !== null);
    ok('B geknipt: elk getekend punt ligt op de ongeknipte route', onRoute);
    const startArc = arcLengthTo(route, pts[0], pts[1]);
    ok('B geknipt: lineDashOffset = booglengte van het weggeknipte stuk',
      startArc !== null && Math.abs(run.offset - startArc) < 1e-6, `offset ${run.offset}, booglengte ${startArc}`);
    ok('B geknipt: het weggeknipte stuk is echt lang (anders pint B niets)', (startArc ?? 0) > 3_000, String(startArc));
    ok('B geknipt: de getekende run is kort (canvas + marge)', lengthOf(run.pts) < 500 + 2 * MARGIN + 50, lengthOf(run.pts).toFixed(0));
  }
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`gantt-arrow-clip: ${fails.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`gantt-arrow-clip: ${checks} checks groen`);
