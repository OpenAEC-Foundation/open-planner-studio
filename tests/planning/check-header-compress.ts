// Header-regressiebatterij (issue #21 punt 5, vervolg): vóór deze fix toonde de datumregel
// (header) delen ZWART/onleesbaar zodra `compressNonWorkdays` AAN stond en de gebruiker ver
// genoeg had gescrold — `drawTimelineHeader` berekende zijn zichtbare-datumbereik
// (`startDate`/`endDate`) via de kalenderdag-aanname `scrollX/zoom` (1 kalenderdag = 1
// zoom-kolom), wat alleen klopt op de ONgecomprimeerde as. Onder compressie "kost" elke
// overgeslagen niet-werkdag 0 px maar telde in de oude formule als 1 kalenderdag mee, dus het
// berekende bereik liep bij toenemende scrollX steeds verder ACHTER op het werkelijk zichtbare
// venster — bij genoeg scroll viel de tick-loop stil vóórdat hij het canvas bereikte: een
// (deels of geheel) LEGE headerband. Zie ook `docs/superpowers/werkdagen-as-ontwerp.md` §4.1.
//
// Fix: `startDate`/`endDate` via de as-index (`this.axis.dayIndexOf`/`dateAtIndex`) i.p.v. de
// kalenderdag-aanname; de dag-tier stapt onder compressie bovendien over werkdag-AS-INDICES
// (`drawWorkdayTierLabels`) i.p.v. kalenderdagen, zodat nooit twee dag-labels op dezelfde x
// landen (elke as-index is per constructie een andere echte werkdag).
//
// Deze batterij bewijst:
//   1. (compressie AAN) over een zoom×scrollX-raster: de dag-rij dekt het volledige zichtbare
//      canvas (geen vroegtijdig afbrekende tick-loop — het exacte, headless waargenomen defect),
//      en geen twee labels in dezelfde header-rij landen op (nagenoeg) dezelfde x.
//   2. (compressie UIT) de as-index-gebaseerde `startDate`/`endDate`-herleiding is ALGEBRAÏSCH
//      identiek aan de oude `addCalendarDays(viewStart, floor(scrollX/zoom)±1)`-formule — het
//      niet-gecomprimeerde pad blijft dus byte-identiek (ontwerp-eis §10).
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {}, createElement: () => ({ getContext: () => null }) };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { addCalendarDays } from '@/utils/dateUtils';
import { buildCalendarAxis } from '@/engine/renderer/workdayAxis';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}

// ── Opnemende 2D-context-stub: registreert elke fillText met (x, y, tekstbreedte) ───────────
interface TextOp { x: number; y: number; text: string; width: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; ops: TextOp[] } {
  const ops: TextOp[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: (text: string, x: number, y: number) => {
      ops.push({ x, y, text, width: String(text).length * 6 });
    },
    strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

// ── Scenario: kalender MET NL-feestdagen (meerdaagse blokken zoals Kerst) + een lange taak,
// zodat de zichtbare periode altijd weekends én feestdagblokken bevat. ───────────────────────
const S = () => useAppStore.getState();
S().newProject();
const cal = createDefaultCalendar(2026);
if (cal.holidays.length === 0) {
  // Bouwmodus kan afhankelijk van localStorage-status leeg zijn in Node — forceer een
  // realistisch meerdaags blok zodat het scenario hoe dan ook niet-triviale compressie test.
  cal.holidays.push(
    { name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-27' },
    { name: 'Nieuwjaar', startDate: '2027-01-01', endDate: '2027-01-01' },
  );
}
S().setCalendar(cal);
S().addTask({ name: 'Lange taak' });
const [ta] = S().tasks;
S().updateTask(ta.id, { time: { ...S().tasks[0].time, scheduleStart: '2026-01-01', scheduleDuration: 500 } });
S().runCPM();

const W = 1200, H = 600, TTW = 300, HEADER_H = 44;
const VIEW_START = '2026-11-15'; // vóór het Kerst/Nieuwjaar-blok, zodat het in het venster valt

function renderHeaderOps(zoom: number, scrollX: number, compress: boolean): TextOp[] {
  const { ctx, ops } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, zoom, scrollX, scrollY: 0, viewStartDate: VIEW_START },
    selectedTaskIds: [],
    collapsedTaskIds: [],
    canvasWidth: W,
    canvasHeight: H,
    taskTableWidth: TTW,
    rowHeight: 28,
    headerHeight: HEADER_H,
    compressNonWorkdays: compress,
    weekStartDay: 'monday',
  }).render();
  return ops.filter((o) => o.y < HEADER_H);
}

// ── 1. Compressie AAN: geen stapeling binnen een rij + volle canvas-dekking van de dag-rij ──
const ZOOMS = [8, 15, 26, 45, 60, 100];
const SCROLLS = [0, 500, 1500, 3000, 6000, 10000, 25000];

for (const zoom of ZOOMS) {
  for (const scrollX of SCROLLS) {
    const ops = renderHeaderOps(zoom, scrollX, true);

    // Geen twee labels in dezelfde rij (afgeronde y) op (nagenoeg) dezelfde x — dat was het
    // hypothetische stapelingsmechanisme; blijft als regressiebewaking staan.
    const byY = new Map<number, TextOp[]>();
    for (const op of ops) {
      const ry = Math.round(op.y);
      if (!byY.has(ry)) byY.set(ry, []);
      byY.get(ry)!.push(op);
    }
    for (const [y, list] of byY) {
      const sorted = [...list].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        checks++;
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (cur.x < prev.x + prev.width) {
          diffs.push(
            `stapeling z=${zoom} sx=${scrollX} y=${y}: "${prev.text}"@x${prev.x.toFixed(1)}(w${prev.width}) ` +
            `overlapt "${cur.text}"@x${cur.x.toFixed(1)}`,
          );
        }
      }
    }

    // Dag-rij (onderste rij, de grootste afgeronde y) moet — als hij bestaat — het canvas
    // vrijwel volledig dekken (rechterrand ≥ canvasWidth - zoom - labelmarge). Dít is het
    // exacte, headless waargenomen defect: vóór de fix stopte de dag-rij bij hoge scrollX ver
    // vóór de rechterrand (of verdween helemaal — 0 dag-ops bij scrollX=3000+ in de diagnose).
    const dayY = Math.max(...ops.map((o) => Math.round(o.y)));
    const dayOps = ops.filter((o) => Math.round(o.y) === dayY);
    checks++;
    if (dayOps.length === 0) {
      diffs.push(`dag-rij ontbreekt volledig: z=${zoom} sx=${scrollX} (${ops.length} header-ops totaal)`);
    } else {
      // Marge ruim genoeg voor één ontbrekende laatste kolom van de onderste rij (die bij lage
      // zoom 'week' i.p.v. 'day' kan zijn, dus geschaald op zoom mét een vloer) — maar veel te
      // krap om het pre-fix defect te maskeren (dat liet de rij honderden pixels, of het HELE
      // canvas, ongedekt: zie de diagnose-sweep in `diag-header-compress.ts`).
      const maxX = Math.max(...dayOps.map((o) => o.x));
      const margin = Math.max(zoom * 4, 150);
      checks++;
      if (maxX < W - margin) {
        diffs.push(
          `onderste header-rij dekt canvas niet: z=${zoom} sx=${scrollX} laatste label bij x=${maxX.toFixed(1)}, ` +
          `verwacht ≥${(W - margin).toFixed(1)} (canvasWidth=${W})`,
        );
      }
    }
  }
}

// ── 2. Compressie UIT: de as-index-gebaseerde startDate/endDate (`axisViewStartIdx + …`) moet
// ALGEBRAÏSCH identiek zijn aan de oude `addCalendarDays(viewStart, floor(scrollX/zoom)±1)`-
// formule — de exacte byte-identiek-eis uit werkdagen-as-ontwerp.md §10 voor het niet-
// gecomprimeerde pad. Rechtstreeks getoetst op de `CalendarAxis` (waar `GanttRenderer` op
// terugvalt zodra `compressNonWorkdays` uit staat, zie `resolveGanttAxis`): `dayIndexOf(origin)`
// moet exact 0 zijn, en `dateAtIndex(0 + n)` moet exact `addCalendarDays(origin, n)` teruggeven
// voor elke `n` die de header-berekening daadwerkelijk gebruikt. ──────────────────────────────
const ORIGIN = new Date(VIEW_START + 'T00:00:00.000Z');
for (const zoom of ZOOMS) {
  for (const scrollX of SCROLLS) {
    const axis = buildCalendarAxis({ origin: ORIGIN, taskTableWidth: TTW, zoom, scrollX });
    checks++;
    if (axis.dayIndexOf(ORIGIN) !== 0) {
      diffs.push(`CalendarAxis.dayIndexOf(origin) !== 0 bij z=${zoom} sx=${scrollX}: kreeg ${axis.dayIndexOf(ORIGIN)}`);
    }
    const startOffset = Math.floor(scrollX / zoom) - 1;
    const endOffset = Math.ceil((scrollX + W) / zoom) + 1;
    const axisStart = axis.dateAtIndex(axis.dayIndexOf(ORIGIN) + startOffset);
    const axisEnd = axis.dateAtIndex(axis.dayIndexOf(ORIGIN) + endOffset);
    const oldStart = addCalendarDays(ORIGIN, startOffset);
    const oldEnd = addCalendarDays(ORIGIN, endOffset);
    eq(`startDate as-index vs oude formule z=${zoom} sx=${scrollX}`, axisStart.getTime(), oldStart.getTime());
    eq(`endDate as-index vs oude formule z=${zoom} sx=${scrollX}`, axisEnd.getTime(), oldEnd.getTime());

    // En de daadwerkelijke render moet, met compressie uit, hetzelfde aantal/positie header-ops
    // opleveren als een tweede render met identieke opts (determinisme — geen per-call drift
    // door de nieuwe as-instantiatie in de constructor, zie workdayAxis.ts §2.5-commentaar).
    const first = renderHeaderOps(zoom, scrollX, false);
    const second = renderHeaderOps(zoom, scrollX, false);
    checks++;
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      diffs.push(`compressie-uit: render niet deterministisch bij z=${zoom} sx=${scrollX}`);
    }
    checks++;
    if (first.length === 0) {
      diffs.push(`compressie-uit: geen header-ops bij z=${zoom} sx=${scrollX} — onverwacht leeg`);
    }
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  header-compress: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  header-compress: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
