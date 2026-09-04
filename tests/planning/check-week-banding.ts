// Om-en-om weekbanden onder compressie (issue #21 punt 2). Gebruikersklacht: met
// `compressNonWorkdays` AAN verdwijnen de weekendkolommen — en dus ook de weekend-arcering die in
// de praktijk als visuele WEEKSCHEIDING fungeert ("de weekenddagen … zijn namelijk lichter").
// Fix: in de gecomprimeerde tak van `drawGridBackground` krijgen de dagkolommen van ONEVEN
// weeknummers een licht getinte achtergrondband (`palette.gridWeekBand`), even weken blijven
// neutraal. De pariteit hangt aan het WEEKNUMMER (`getWeekNumberFor`, met `weekStartDay`), niet
// aan de beeldrand — anders zou de banding bij elke horizontale scroll verspringen.
//
// Deze batterij draait de ECHTE GanttRenderer met een opnemende 2D-context-stub en een
// GEÏNJECTEERD palet met unieke kleuren (model: check-arrow-routing.ts), en bewijst:
//   1. (compressie AAN) elke getekende band-kolom hoort bij een ONEVEN weeknummer en elke
//      zichtbare werkdag-kolom van een oneven week ÍS geband — d.w.z. de bandkleur wisselt
//      precies op de weekgrens (zelfde `weekStartDay`-grens als de dikke weekscheidingslijn),
//      en beide pariteiten komen daadwerkelijk voor (er is écht afwisseling te zien).
//   2. (compressie UIT) er wordt NUL keer met de band-kleur gevuld — het niet-gecomprimeerde pad
//      (weekend-arcering als scheiding) blijft ongewijzigd.
//   3. (scroll-invariantie) de band-status van een DATUM is identiek over sterk verschillende
//      scrollX-standen: de pariteit hangt aan het weeknummer, niet aan de scrollpositie.
//   4. (weekStartDay) met 'sunday' volgt de banding de zondag-gebaseerde weeknummering
//      (`getWeekNumberFor(d,'sunday')`) — zelfde grens als de dikke weeklijn in die stand.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen.

// ── DOM-stubs (vóór het importeren/instantiëren) ─────────────────────────────
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {}, createElement: () => ({ getContext: () => null }) };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { getWeekNumberFor, formatDate } from '@/utils/dateUtils';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean, detail = ''): void {
  checks++;
  if (!cond) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
}

// ── Palet met unieke, herkenbare kleuren: band en weekend eenduidig herkenbaar ───────────────
const BAND = '#0e0e01';
const WEEKEND = '#0e0e02';
const palette = {
  ...readGanttPalette(),
  gridWeekBand: BAND,
  gridWeekend: WEEKEND,
};

// ── Opnemende 2D-context-stub: registreert elke fillRect mét de actieve fillStyle ────────────
interface RectOp { x: number; y: number; w: number; h: number; color: string }
function makeCtx(): { ctx: CanvasRenderingContext2D; rects: RectOp[] } {
  const rects: RectOp[] = [];
  const noop = () => {};
  const st = { fillStyle: '' };
  const ctx = {
    get fillStyle() { return st.fillStyle; }, set fillStyle(v: string) { st.fillStyle = v; },
    strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: (x: number, y: number, w: number, h: number) => { rects.push({ x, y, w, h, color: st.fillStyle }); },
    strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

// ── Scenario: ma-vr-kalender met feestdagen (compressie doet er dus echt iets) + lange taak ──
const S = () => useAppStore.getState();
S().newProject();
const cal = createDefaultCalendar(2026);
if (cal.holidays.length === 0) {
  cal.holidays.push({ name: 'Test-feestdag', startDate: '2026-04-27', endDate: '2026-04-27' });
}
S().setCalendar(cal);
S().addTask({ name: 'Lange taak' });
const [ta] = S().tasks;
S().updateTask(ta.id, { time: { ...S().tasks[0].time, scheduleStart: '2026-01-01', scheduleDuration: 400 } });
S().runCPM();

const W = 1200, H = 600, HEADER_H = 44;
const VIEW_START = '2026-03-02'; // een maandag

function renderRects(zoom: number, scrollX: number, compress: boolean, weekStartDay: 'monday' | 'sunday'): RectOp[] {
  const { ctx, rects } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, zoom, scrollX, scrollY: 0, viewStartDate: VIEW_START },
    selectedTaskIds: [],
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: 28,
    headerHeight: HEADER_H,
    compressNonWorkdays: compress,
    weekStartDay,
    palette,
  }).render();
  return rects;
}

/** Herleidt per zichtbare werkdag-kolom (dezelfde iteratie als `drawGridBackground`s
 *  gecomprimeerde tak) de kolom-x en de datum, zodat de opgenomen band-fillRects op x
 *  teruggekoppeld kunnen worden aan een concrete kalenderdag. */
function visibleWorkdayColumns(zoom: number, scrollX: number): { x: number; date: Date }[] {
  const engine = new CalendarEngine(S().calendar);
  const axis = resolveGanttAxis({
    calendar: engine,
    compressNonWorkdays: true,
    origin: new Date(VIEW_START + 'T00:00:00.000Z'),
    chartOriginX: 0,
    zoom,
    scrollX,
  });
  const visibleDays = Math.ceil(W / zoom) + 2;
  const startIdx = Math.floor(axis.dayIndexOf(new Date(VIEW_START + 'T00:00:00.000Z')) + scrollX / zoom);
  const cols: { x: number; date: Date }[] = [];
  for (let i = -1; i < visibleDays; i++) {
    const date = axis.dateAtIndex(startIdx + i);
    cols.push({ x: axis.dateToX(date), date });
  }
  return cols;
}

const ZOOMS = [10, 26, 45];
const SCROLLS = [0, 500, 1500, 4000, 9000];

// ── 1 + 4. Compressie AAN: band-kolommen ⇔ oneven weeknummer, voor beide weekStartDay-standen ─
for (const wsd of ['monday', 'sunday'] as const) {
  for (const zoom of ZOOMS) {
    for (const scrollX of SCROLLS) {
      const rects = renderRects(zoom, scrollX, true, wsd);
      const bandXs = new Set(rects.filter((r) => r.color === BAND).map((r) => Math.round(r.x * 100) / 100));
      const cols = visibleWorkdayColumns(zoom, scrollX);

      let sawBanded = false;
      let sawPlain = false;
      for (const col of cols) {
        const banded = bandXs.has(Math.round(col.x * 100) / 100);
        const odd = getWeekNumberFor(col.date, wsd) % 2 === 1;
        ok(
          `band ⇔ oneven week (wsd=${wsd} z=${zoom} sx=${scrollX} d=${formatDate(col.date)})`,
          banded === odd,
          `banded=${banded}, weeknr=${getWeekNumberFor(col.date, wsd)}`,
        );
        if (banded) sawBanded = true; else sawPlain = true;
      }
      // Afwisseling moet écht zichtbaar zijn: het venster toont meerdere weken, dus beide
      // pariteiten moeten voorkomen (anders test punt 1 stiekem een leeg universum).
      ok(`beide pariteiten zichtbaar (wsd=${wsd} z=${zoom} sx=${scrollX})`, sawBanded && sawPlain);
      // Geen weekend-arcering in de gecomprimeerde tak (die kolommen bestaan niet).
      ok(
        `geen weekend-fill onder compressie (wsd=${wsd} z=${zoom} sx=${scrollX})`,
        rects.every((r) => r.color !== WEEKEND),
      );
    }
  }
}

// ── 2. Compressie UIT: nul band-fills; de weekend-arcering (de bestaande scheiding) blijft ───
for (const zoom of ZOOMS) {
  for (const scrollX of SCROLLS) {
    const rects = renderRects(zoom, scrollX, false, 'monday');
    ok(
      `geen weekband zonder compressie (z=${zoom} sx=${scrollX})`,
      rects.every((r) => r.color !== BAND),
      `${rects.filter((r) => r.color === BAND).length} band-fills gevonden`,
    );
    ok(
      `weekend-arcering aanwezig zonder compressie (z=${zoom} sx=${scrollX})`,
      rects.some((r) => r.color === WEEKEND),
    );
  }
}

// ── 3. Scroll-invariantie: de band-status van een DATUM verandert niet met scrollX ───────────
// (Punt 1 bewijst dit al indirect — banded ⇔ weeknummer-pariteit, en een weeknummer kent geen
// scrollpositie — maar deze directe vergelijking betrapt óók een implementatie die per ongeluk
// consistent-met-pariteit rendert op elk raster afzonderlijk maar tussen scrollstanden wisselt,
// bv. door een off-by-one in de kolom-iteratie.)
for (const zoom of ZOOMS) {
  const perScroll = SCROLLS.map((sx) => {
    const rects = renderRects(zoom, sx, true, 'monday');
    const bandXs = new Set(rects.filter((r) => r.color === BAND).map((r) => Math.round(r.x * 100) / 100));
    const byDate = new Map<string, boolean>();
    for (const col of visibleWorkdayColumns(zoom, sx)) {
      byDate.set(formatDate(col.date), bandXs.has(Math.round(col.x * 100) / 100));
    }
    return byDate;
  });
  for (let a = 0; a < perScroll.length; a++) {
    for (let b = a + 1; b < perScroll.length; b++) {
      for (const [dateStr, banded] of perScroll[a]) {
        const other = perScroll[b].get(dateStr);
        if (other === undefined) continue; // datum niet zichtbaar in de andere scrollstand
        ok(
          `scroll-invariant (z=${zoom} sx=${SCROLLS[a]}↔${SCROLLS[b]} d=${dateStr})`,
          banded === other,
        );
      }
    }
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  week-banding: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  week-banding: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
