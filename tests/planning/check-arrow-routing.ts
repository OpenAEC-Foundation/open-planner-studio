// Pijlrouting-regressie (issue #41): een relatielijn mag NIET onder een taakbalk door lopen.
//
// Melding: "relationship lines are obscured by subsequent activity bars". Oorzaak: de pijlen worden
// vóór de balken getekend (render-volgorde), en de vaste elleboog `fromX+8` lag per definitie in de
// rij van de voorganger (bij SS zelfs midden ín diens balk) en liep bij krappe/achterwaartse
// gevallen dwars door de OPVOLGERbalk — inclusief de pijlkop.
//
// Deze batterij draait de ECHTE GanttRenderer met een opnemende 2D-context-stub en een GEÏNJECTEERD
// palet met unieke kleuren, zodat balkvlakken (roundRect+fill) en pijlpaden (moveTo/lineTo+stroke)
// eenduidig uit elkaar te houden zijn. Daarna wordt elk pijlsegment op 0,5px-resolutie afgelopen en
// getoetst tegen alle balkrechthoeken.
//
// Wat er GEEN afwijking is (bewuste ontwerpkeuzes, zie GanttRenderer.buildRowObstacles):
//  - de speling-band, baseline-onderbalk, constraint-pins en badges tellen niet als obstakel;
//  - is er GEEN vrije kolom (een balk die de hele corridor beslaat), dan accepteert de router
//    occlusie i.p.v. een omweg door het halve diagram — daar is in dit scenario geen sprake van.
//
// Draait via run.sh. Exit 0 = alles groen.

// ── DOM-stubs (vóór het instantiëren) ────────────────────────────────────────
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean, detail = ''): void {
  checks++;
  if (!cond) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
}

// ── Palet met unieke, herkenbare kleuren ─────────────────────────────────────
const BAR_FILL = new Set(['#b0b0b0', '#b1b1b1', '#b2b2b2', '#b3b3b3']);
const ARROW_STROKE = new Set(['#a0a0a0', '#b0b0b0']); // dependency + kritieke link (== critical)
const palette = {
  ...readGanttPalette(),
  normal: '#b1b1b1',
  critical: '#b0b0b0',
  summary: '#b2b2b2',
  hammock: '#b3b3b3',
  dependency: '#a0a0a0',
  // Alles wat GEEN balk/pijl is uit de weg zetten met kleuren die nergens mee botsen.
  normalLight: '#010101', criticalLight: '#010102', nearCritical: '#010103', milestone: '#010104',
  float: '#010105', baseline: '#010106', selected: '#010107', ghost: '#010108',
  grid: '#010109', gridWeekend: '#01010a', border: '#01010b', today: '#01010c', statusDate: '#01010d',
  bg: '#01010e', surface: '#01010f', headerBg: '#010110', text: '#010111', textSecondary: '#010112',
};

// ── Opnemende 2D-context-stub ────────────────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number }
interface Poly { color: string; pts: number[] }

function makeCtx(): { ctx: CanvasRenderingContext2D; bars: Rect[]; arrows: Poly[] } {
  const bars: Rect[] = [];
  const arrows: Poly[] = [];
  let cur: number[] = [];
  let pendingRect: Rect | null = null;
  const noop = () => {};
  const st = { fillStyle: '', strokeStyle: '' };
  const ctx = {
    get fillStyle() { return st.fillStyle; }, set fillStyle(v: string) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v: string) { st.strokeStyle = v; },
    lineWidth: 1, font: '', textAlign: '', textBaseline: '', globalAlpha: 1, lineCap: '', lineJoin: '',
    shadowBlur: 0, shadowColor: '',
    beginPath: () => { cur = []; pendingRect = null; },
    moveTo: (x: number, y: number) => { cur.push(x, y); },
    lineTo: (x: number, y: number) => { cur.push(x, y); },
    roundRect: (x: number, y: number, w: number, h: number) => { pendingRect = { x, y, w, h }; },
    rect: (x: number, y: number, w: number, h: number) => { pendingRect = { x, y, w, h }; },
    fill: () => {
      if (pendingRect && BAR_FILL.has(String(st.fillStyle).toLowerCase())) bars.push(pendingRect);
      pendingRect = null;
    },
    stroke: () => {
      if (!pendingRect && cur.length >= 4 && ARROW_STROKE.has(String(st.strokeStyle).toLowerCase())) {
        arrows.push({ color: String(st.strokeStyle), pts: cur.slice() });
      }
      pendingRect = null;
    },
    closePath: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    arc: noop, arcTo: noop, ellipse: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop, setLineDash: noop, getLineDash: () => [],
    fillText: noop, strokeText: noop, measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }), createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, bars, arrows };
}

// ── Scenario ────────────────────────────────────────────────────────────────
// Precies de gevallen uit de melding + de randgevallen die de oude route stukmaakten.
S().newProject();
const names = [
  'A ketenstart',        // 0
  'B direct erna',       // 1  FS lag 0 ⇒ toX == fromX (de meest voorkomende relatie)
  'C neg. lag',          // 2  FS lag -3 ⇒ toX < fromX (achteruit)
  'D SS-opvolger',       // 3  SS lag 2  ⇒ uitloop moet naar LINKS
  'E SS achteruit',      // 4  SS lag -4 ⇒ achteruit én links
  'F lange sprong',      // 5  FS lag 12 vanaf A, over de rijen heen
  'G FF-voorganger',     // 6  FF: opvolger eindigt als voorganger eindigt (zelfde finish)
  'H FF-opvolger',       // 7
  'I SF-voorganger',     // 8  SF: opvolger eindigt als voorganger start (pijl start→finish)
  'J SF-opvolger',       // 9
];
for (const n of names) S().addTask({ name: n });
const t = S().tasks;
const setDur = (i: number, d: number) => {
  const cur = S().tasks[i];
  S().updateTask(cur.id, { time: { ...cur.time, scheduleDuration: d } });
};
setDur(0, 5); setDur(1, 4); setDur(2, 3); setDur(3, 6); setDur(4, 4); setDur(5, 3);
setDur(6, 5); setDur(7, 4); setDur(8, 5); setDur(9, 4);
S().addSequence({ predecessorId: t[0].id, successorId: t[1].id, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: t[1].id, successorId: t[2].id, type: 'FINISH_START', lagDays: -3 });
S().addSequence({ predecessorId: t[2].id, successorId: t[3].id, type: 'START_START', lagDays: 2 });
S().addSequence({ predecessorId: t[3].id, successorId: t[4].id, type: 'START_START', lagDays: -4 });
S().addSequence({ predecessorId: t[0].id, successorId: t[5].id, type: 'FINISH_START', lagDays: 12 });
// Issue #59: FF en SF ankerten vroeger op de verkeerde opvolger-rand (de `default`-tak katapulteerde
// ze naar FS). G→H is finish-to-finish (beide eindigen gelijk); I→J is start-to-finish. I is via FS
// achter H geplaatst zodat I.start ruim genoeg ligt om een negatieve J-start te vermijden.
S().addSequence({ predecessorId: t[6].id, successorId: t[7].id, type: 'FINISH_FINISH', lagDays: 0 });
S().addSequence({ predecessorId: t[7].id, successorId: t[8].id, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: t[8].id, successorId: t[9].id, type: 'START_FINISH', lagDays: 2 });
S().runCPM();

ok('opzet: 10 taken', S().tasks.length === 10, `kreeg ${S().tasks.length}`);
ok('opzet: 8 relaties', S().sequences.length === 8, `kreeg ${S().sequences.length}`);

// ── Renderen + toetsen, over meerdere zoomniveaus en scrollposities ─────────
const W = 1400, H = 500, ROW = 28;

function render(zoom: number, scrollX: number): { bars: Rect[]; arrows: Poly[] } {
  const { ctx, bars, arrows } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, zoom, scrollX, scrollY: 0 },
    selectedTaskIds: [],
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: ROW,
    headerHeight: 50,
    palette,
  }).render();
  return { bars, arrows };
}

/** Ligt (x,y) in de balk (1px binnenwaarts, zodat het rakelings passeren van een rand telt als vrij)? */
function inside(r: Rect, x: number, y: number): boolean {
  return x > r.x + 1 && x < r.x + r.w - 1 && y > r.y + 1 && y < r.y + r.h - 1;
}

let totalSegments = 0;
let totalArrows = 0;
for (const zoom of [10, 15.5, 24, 40]) {
  for (const scrollX of [0, 37, 120]) {
    const { bars, arrows } = render(zoom, scrollX);
    totalArrows += arrows.length;
    const hits: string[] = [];
    for (const a of arrows) {
      for (let i = 0; i + 3 < a.pts.length; i += 2) {
        const x0 = a.pts[i], y0 = a.pts[i + 1], x1 = a.pts[i + 2], y1 = a.pts[i + 3];
        totalSegments++;
        const len = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(len * 2));
        for (let k = 0; k <= steps; k++) {
          const x = x0 + ((x1 - x0) * k) / steps;
          const y = y0 + ((y1 - y0) * k) / steps;
          const bar = bars.find((r) => inside(r, x, y));
          if (bar) {
            hits.push(`segment (${x0.toFixed(1)},${y0.toFixed(1)})→(${x1.toFixed(1)},${y1.toFixed(1)}) raakt balk x=${bar.x.toFixed(1)}..${(bar.x + bar.w).toFixed(1)} y=${bar.y.toFixed(1)}..${(bar.y + bar.h).toFixed(1)}`);
            break;
          }
        }
      }
    }
    ok(`zoom=${zoom} scrollX=${scrollX}: geen pijlsegment onder een balk`, hits.length === 0, hits.slice(0, 3).join(' | '));
    // Bij scrollX=0 staat alles in beeld; verder naar rechts cullt de renderer terecht de pijlen
    // waarvan BEIDE eindpunten links van de taaktabel liggen (bestaande, ongewijzigde cull).
    if (scrollX === 0) ok(`zoom=${zoom}: alle 8 relaties getekend`, arrows.length === 8, `kreeg ${arrows.length}`);
  }
}

// ── Sanity: de meting zelf moet iets gezien hebben ──────────────────────────
ok('meting: pijlen opgenomen', totalArrows > 0, `${totalArrows}`);
ok('meting: segmenten bemonsterd', totalSegments > 50, `${totalSegments}`);

// ── Contract-eigenschappen van elk pad ──────────────────────────────────────
// De pijlkop landt op de opvolger-rand die hoort bij het relatietype: bij FS/SS de START (linkerrand,
// kop wijst naar rechts ⇒ laatste segment loopt naar rechts); bij FF/SF de FINISH (rechterrand, kop
// wijst naar links ⇒ laatste segment loopt naar links). Vóór issue #59 liep het laatste stuk van
// FF/SF altijd naar rechts (landde op de start) — deze per-type richtingstoets vangt die regressie.
// `arrows` komt in dezelfde volgorde binnen als `sequences` (de renderer itereert die 1-op-1).
{
  const { arrows } = render(15.5, 0);
  const seqs = S().sequences;
  ok('richtingtest: alle relaties getekend', arrows.length === seqs.length, `${arrows.length}/${seqs.length}`);
  for (let i = 0; i < arrows.length; i++) {
    const a = arrows[i];
    const type = seqs[i].type;
    const n = a.pts.length;
    const [x0, y0, x1, y1] = [a.pts[n - 4], a.pts[n - 3], a.pts[n - 2], a.pts[n - 1]];
    ok(`[${type}] laatste segment horizontaal`, Math.abs(y1 - y0) < 0.001, `Δy=${(y1 - y0).toFixed(2)}`);
    const finishAnchored = type === 'FINISH_FINISH' || type === 'START_FINISH';
    if (finishAnchored) {
      ok(`[${type}] laatste segment loopt naar links (kop wijst ←)`, x1 < x0, `x0=${x0.toFixed(1)} x1=${x1.toFixed(1)}`);
    } else {
      ok(`[${type}] laatste segment loopt naar rechts (kop wijst →)`, x1 > x0, `x0=${x0.toFixed(1)} x1=${x1.toFixed(1)}`);
    }
  }
}

// ── Uitslag ─────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  arrow-routing: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  arrow-routing: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
