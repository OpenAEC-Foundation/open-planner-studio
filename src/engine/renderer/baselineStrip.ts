// Eén tekenregel voor de baselinestrook onder een taakbalk, gedeeld door het scherm
// (`GanttRenderer`) en de afdruk/PDF (`printPreview`), net als `paintProgressBarPiece` voor de balk.
//
// De Gantt toont de actieve baseline plus tot twee vergelijkingsbaselines (issue #391) in ÉÉN strook.
// Elke baseline is een eigen lijn binnen die strook (issue #741), in een vaste volgorde van boven naar
// onder (plaats 0, 1, 2):
//   - loopt er één baseline: die heeft de volle dikte, en begin en einde zijn recht afgesneden;
//   - lopen er meer tegelijk: ze delen de hoogte, en de overgang is vloeiend (`baselineLanes`);
//   - raken baselines elkaar niet: losse lijnen.
// Mijlpalen krijgen een ruit per datum; vallen meerdere baselines op dezelfde datum, dan één gestreepte
// ruit.
//
// Alles wordt als veelhoek getekend (geen canvaspatroon, geen clip), omdat de afdruklaag (`Draw2D`,
// ook de vector-PDF) die niet kent. Zo zijn scherm en papier per constructie gelijk.

import { MS_PER_DAY, parseDate, parseInstant } from '@/utils/dateUtils';
import { finishInstant } from '@/utils/taskDates';

/** Kleurplaats van een baseline in de strook: 0 = actief, 1 en 2 = de vergelijkingsbaselines. */
export type BaselineSlot = 0 | 1 | 2;

/** Eén baseline van één taak als horizontale strook (x in px). */
export interface BaselineBar {
  slot: BaselineSlot;
  x1: number;
  x2: number;
}

/** Eén baseline-mijlpaal van één taak (x = midden van de ruit, in px). */
export interface BaselineMilestone {
  slot: BaselineSlot;
  x: number;
  /** Het moment van de mijlpaal (`baselineSpanX`). Mijlpalen delen alleen een ruit bij hetzelfde
   *  moment: op de werkdag-as vallen ook verschillende momenten (za en zo) op dezelfde x. */
  moment: string;
}

/** Begin en einde van één baseline van één taak, zoals de baseline ze bewaart. */
export interface BaselineSpan {
  start: string;
  finish: string;
  isMilestone: boolean;
}

/** Plaats van één baseline op de tijdas: een strook of een mijlpaal. */
export type BaselineSpanX = { kind: 'bar'; x1: number; x2: number } | { kind: 'milestone'; x: number; moment: string };

/**
 * Zet één baseline om naar x, met dezelfde regel als de taakbalk (`barGeometry` in de renderer):
 *  - datum mét tijd (urentaak, bv. een MSPDI-baseline van een urentaak): `[start, einde)` op het
 *    tijdstip zelf, zonder een hele dag erbij; een mijlpaal op haar tijdstip;
 *  - datum zonder tijd (dagtaak): de hele dag, `[start, begin van de dag na het einde)`, allebei via
 *    de as; een mijlpaal midden op de dag. Het exclusieve einde gaat via de as en niet als
 *    `dateToX(einde) + dayWidth`: op de werkdag-as vallen za en ma op dezelfde x, en een extra
 *    pixelkolom zou daar overlap verzinnen. Een dag zonder werktijd krijgt zo geen breedte.
 * Scherm en afdruk geven hun eigen as mee (`dateToX`, ook de werkdag-as) en hun daggrootte.
 * Onleesbare datums geven `null`.
 */
export function baselineSpanX(
  span: BaselineSpan,
  dateToX: (date: Date) => number,
  dayWidth: number,
): BaselineSpanX | null {
  const startStr = span.start || span.finish;
  const finishStr = span.finish || span.start;
  if (!startStr) return null;
  const hourMode = startStr.includes('T') || finishStr.includes('T');
  const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
  if (Number.isNaN(start.getTime())) return null;
  if (span.isMilestone) {
    // Moment: een tijdstip, of een hele dag (dagmijlpaal). Twee mijlpalen met hetzelfde moment delen een ruit.
    const moment = `${hourMode ? 'T' : 'D'}${start.getTime()}`;
    return { kind: 'milestone', x: hourMode ? dateToX(start) : dateToX(start) + dayWidth / 2, moment };
  }
  // Uur-einde zonder tijd (een dagkind als laatste) loopt tot het einde van die dag: `finishInstant`.
  const end = hourMode ? finishInstant(finishStr) : parseDate(finishStr);
  if (Number.isNaN(end.getTime())) return null;
  const x1 = dateToX(start);
  const x2 = hourMode ? dateToX(end) : dateToX(new Date(end.getTime() + MS_PER_DAY));
  return { kind: 'bar', x1, x2 };
}

/** Eén stuk van de strook met de baselines die er liggen (oplopend op plaats). Voor de hover. */
export interface BaselineStripPiece {
  x1: number;
  x2: number;
  slots: BaselineSlot[];
}

/** Eén ruit met de baselines die op die datum liggen. */
export interface BaselineDiamond {
  x: number;
  slots: BaselineSlot[];
}

const bySlot = (a: BaselineSlot, b: BaselineSlot) => a - b;

/**
 * Deelt de strook van één taak op in stukken. Puur: dezelfde invoer geeft op scherm en afdruk
 * dezelfde stukken. Lege of omgekeerde stroken (x2 <= x1) tellen niet mee.
 */
export function baselineStripPieces(bars: readonly BaselineBar[]): BaselineStripPiece[] {
  const valid = bars.filter(b => b.x2 > b.x1);
  if (valid.length === 0) return [];
  const edges = [...new Set(valid.flatMap(b => [b.x1, b.x2]))].sort((a, b) => a - b);
  const pieces: BaselineStripPiece[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i];
    const b = edges[i + 1];
    const slots = valid.filter(bar => bar.x1 <= a && bar.x2 >= b).map(bar => bar.slot).sort(bySlot);
    if (slots.length === 0) continue;
    pieces.push({ x1: a, x2: b, slots });
  }
  return pieces;
}

/**
 * Minimale zichtbare breedte, toegepast NA de opdeling (scherm en afdruk gelijk). Een groep stukken
 * die op elkaar aansluiten, wordt samen minstens `minWidth` breed: eerst naar rechts tot de volgende
 * groep, de rest naar links tot de vorige. Alleen de buitenste stukken groeien; de naden en de
 * baselines per stuk blijven gelijk, dus er ontstaat nooit een nieuwe streepzone en een stuk loopt
 * nooit over een buur heen. De opdeling zelf en de hover rekenen met de echte grenzen.
 */
export function widenShortRuns(pieces: readonly BaselineStripPiece[], minWidth: number): BaselineStripPiece[] {
  const out = pieces.map(p => ({ ...p }));
  let i = 0;
  while (i < out.length) {
    let j = i;
    while (j + 1 < out.length && out[j + 1].x1 === out[j].x2) j++;
    const width = out[j].x2 - out[i].x1;
    if (width < minWidth) {
      const nextStart = j + 1 < out.length ? out[j + 1].x1 : Infinity;
      const prevEnd = i > 0 ? out[i - 1].x2 : -Infinity;
      let need = minWidth - width;
      const right = Math.min(need, nextStart - out[j].x2);
      out[j].x2 += right;
      need -= right;
      if (need > 0) out[i].x1 -= Math.min(need, out[i].x1 - prevEnd);
    }
    i = j + 1;
  }
  return out;
}

/**
 * Lengte van de overgang in px: over deze afstand bouwt een baseline zijn dikte op of af. In pixels en
 * niet in dagen, zodat de overgang er bij elke zoom hetzelfde uitziet. Dit is de enige plek voor deze
 * waarde; de afdruk schaalt hem mee met de rapportschaal.
 */
export const BASELINE_BLEND_PX = 21;

/** Afstand tussen twee meetpunten in een overgang, als deel van de overgangslengte. */
const BLEND_STEPS = 16;
/** Zo ver naast een rand meten we: precies op de rand is het gewicht 0. */
const EDGE_EPSILON = 1e-3;

/** S-curve van 0 naar 1. */
function sCurve(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Overgangslengte van één baseline: een korte baseline bereikt midden in zijn lengte zijn volle
 *  gewicht, anders blijft hij naast een lange baseline een onzichtbaar sliertje. */
const rampOf = (b: BaselineBar, blend: number) => Math.min(blend, (b.x2 - b.x1) / 2);

/** Gewicht op x: bouwt op vanaf het begin, bouwt af naar het einde, buiten de baseline 0. */
function laneWeight(b: BaselineBar, x: number, blend: number): number {
  if (x <= b.x1 || x >= b.x2) return 0;
  const ramp = rampOf(b, blend);
  return sCurve((x - b.x1) / ramp) * sCurve((b.x2 - x) / ramp);
}

/** Eén baseline als lijn in de strook: per `x` de boven- en onderkant, gemeten vanaf de strookbovenkant. */
export interface BaselineLane {
  slot: BaselineSlot;
  x: number[];
  top: number[];
  bottom: number[];
}

/**
 * Rekent de lijnen van één taak uit. Dikte = `height` × eigen gewicht ÷ som van de gewichten; de
 * volgorde in de strook is de plaats (0 boven). Loopt een baseline alleen, dan is zijn gewicht ook de
 * som: volle dikte tot aan de rand. Puur, en buiten de overgangen maar twee punten per stuk.
 * Lege of omgekeerde stroken tellen niet mee.
 */
export function baselineLanes(bars: readonly BaselineBar[], height: number, blend: number): BaselineLane[] {
  const valid = bars.filter(b => b.x2 > b.x1).sort((a, b) => a.slot - b.slot);
  const edges = [...new Set(valid.flatMap(b => {
    const ramp = rampOf(b, blend);
    return [b.x1, b.x1 + ramp, b.x2 - ramp, b.x2];
  }))].sort((a, b) => a - b);
  // Meetpunten: alle randen, en fijn verdeeld waar twee of meer baselines naast elkaar lopen en de
  // dikte dus verandert. Loopt er één, dan blijft de dikte gelijk.
  const grid: number[] = [];
  edges.forEach((a, i) => {
    grid.push(a);
    const b = edges[i + 1];
    if (b === undefined) return;
    const active = valid.filter(v => v.x1 <= a && v.x2 >= b);
    const changing = active.length > 1 && active.some(v => {
      const ramp = rampOf(v, blend);
      return a < v.x1 + ramp || b > v.x2 - ramp;
    });
    if (!changing) return;
    const n = Math.max(1, Math.ceil((b - a) / (blend / BLEND_STEPS)));
    for (let k = 1; k < n; k++) grid.push(a + ((b - a) * k) / n);
  });
  return valid.map(bar => {
    const lane: BaselineLane = { slot: bar.slot, x: [], top: [], bottom: [] };
    for (const x of grid) {
      if (x < bar.x1 || x > bar.x2) continue;
      // Op de eigen rand net binnen de baseline meten: daar is het eigen gewicht nog niet 0.
      const at = x === bar.x1 ? x + EDGE_EPSILON : x === bar.x2 ? x - EDGE_EPSILON : x;
      let above = 0;
      let own = 0;
      let sum = 0;
      for (const other of valid) {
        const w = laneWeight(other, at, blend);
        sum += w;
        if (other.slot < bar.slot) above += w;
        else if (other === bar) own = w;
      }
      if (sum <= 0) continue;
      lane.x.push(x);
      lane.top.push((height * above) / sum);
      lane.bottom.push((height * (above + own)) / sum);
    }
    return lane;
  });
}

/** Past de minimumbreedte van {@link widenShortRuns} toe op de baselines zelf, vóór `baselineLanes`
 *  (scherm en afdruk gelijk). Een baseline volgt de stukken waarin hij ligt, dus twee baselines die op
 *  elkaar aansluiten, gaan niet overlappen. */
export function widenBars(bars: readonly BaselineBar[], minWidth: number): BaselineBar[] {
  const valid = bars.filter(b => b.x2 > b.x1);
  const real = baselineStripPieces(valid);
  const wide = widenShortRuns(real, minWidth);
  return valid.map(bar => {
    const mine = wide.filter((_, i) => real[i].x1 >= bar.x1 && real[i].x2 <= bar.x2);
    return { ...bar, x1: Math.min(...mine.map(p => p.x1)), x2: Math.max(...mine.map(p => p.x2)) };
  });
}

/** Groepeert baseline-mijlpalen op hun moment (`moment`): mijlpalen op hetzelfde moment
 *  delen één ruit. Verschillende momenten blijven aparte ruiten, ook als ze op dezelfde x vallen
 *  (lage zoom, of za en zo op de werkdag-as): geen valse overlap. De volgorde is de tekenvolgorde:
 *  op x, en bij gelijke x in de volgorde van de invoer (de laatste ligt bovenop). */
export function baselineDiamonds(milestones: readonly BaselineMilestone[]): BaselineDiamond[] {
  const byMoment = new Map<string, { x: number; slots: BaselineSlot[]; order: number }>();
  milestones.forEach((m, order) => {
    const group = byMoment.get(m.moment) ?? { x: m.x, slots: [], order };
    if (!group.slots.includes(m.slot)) group.slots.push(m.slot);
    byMoment.set(m.moment, group);
  });
  return [...byMoment.values()]
    .sort((a, b) => a.x - b.x || a.order - b.order)
    .map(g => ({ x: g.x, slots: g.slots.sort(bySlot) }));
}

/** Halve diagonaal van een baseline-mijlpaalruit bij strookhoogte `h` (scherm en afdruk gelijk). */
export const baselineDiamondSize = (h: number): number => Math.max(2.4, h * 0.8);

/** Het deel van een 2D-context dat de strook nodig heeft (canvas én `Draw2D`). */
export interface StripPainter {
  fillStyle: string | CanvasGradient | CanvasPattern;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
}

type Pt = readonly [number, number];

/** Snijdt een convexe veelhoek af op een convexe veelhoek (Sutherland–Hodgman, beide met de klok mee
 *  in schermcoördinaten). */
function clipConvex(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  let out: Pt[] = [...subject];
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const [ax, ay] = clip[i];
    const [bx, by] = clip[(i + 1) % clip.length];
    // Een punt op de rand telt als binnen, met een kleine marge voor afrondfouten. Strepen en
    // ruitranden lopen allebei onder 45°: zonder marge geeft een (bijna) evenwijdige rand een
    // snijpunt ver buiten de vorm.
    const len = Math.hypot(bx - ax, by - ay);
    const inside = ([x, y]: Pt) => (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -1e-9 * len;
    const cross = ([px, py]: Pt, [qx, qy]: Pt): Pt => {
      const a1 = by - ay, b1 = ax - bx, c1 = a1 * ax + b1 * ay;
      const a2 = qy - py, b2 = px - qx, c2 = a2 * px + b2 * py;
      const det = a1 * b2 - a2 * b1;
      return Math.abs(det) <= 1e-9 * len * Math.hypot(a2, b2) ? [px, py] : [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cross(prev, cur));
      }
    }
  }
  return out;
}

function fillPolygon(d: StripPainter, pts: readonly Pt[]): void {
  if (pts.length < 3) return;
  d.beginPath();
  d.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) d.lineTo(pts[i][0], pts[i][1]);
  d.closePath();
  d.fill();
}

/**
 * Vult een convexe vorm met schuine strepen in `colors` (band k krijgt kleur k mod n). De band van
 * kleur 0 is de ondergrond; de andere banden komen er als veelhoeken overheen.
 * `xMin`/`xMax`: het deel van de vorm dat getekend moet worden (scherm: alleen het zichtbare deel).
 */
function fillStriped(
  d: StripPainter, outline: readonly Pt[], colors: readonly string[], stripeWidth: number,
  anchorX: number, top: number, h: number, xMin: number, xMax: number,
): void {
  d.fillStyle = colors[0];
  fillPolygon(d, outline);
  if (colors.length < 2 || stripeWidth <= 0) return;
  const n = colors.length;
  // Band k: (x - anchorX) + (y - top) ∈ [k·w, (k+1)·w).
  const kFrom = Math.floor((xMin - anchorX) / stripeWidth);
  const kTo = Math.ceil((xMax + h - anchorX) / stripeWidth);
  for (let k = kFrom; k <= kTo; k++) {
    const ci = ((k % n) + n) % n;
    if (ci === 0) continue;
    const c1 = anchorX + k * stripeWidth;
    const c2 = c1 + stripeWidth;
    const band: Pt[] = [[c1, top], [c2, top], [c2 - h, top + h], [c1 - h, top + h]];
    const piece = clipConvex(band, outline);
    if (piece.length < 3) continue;
    d.fillStyle = colors[ci];
    fillPolygon(d, piece);
  }
}

export interface PaintBaselineStripOptions {
  /** Bovenkant en hoogte van de strook. */
  top: number;
  height: number;
  /** Lengte van de overgang in px (`BASELINE_BLEND_PX`, op papier geschaald). */
  blend: number;
  /** Breedte van één schuine band waar mijlpalen samenvallen (horizontaal gemeten). */
  stripeWidth: number;
  /** Kleur per baselineplaats. */
  colorOf: (slot: BaselineSlot) => string;
  /** Halve diagonaal van een mijlpaalruit. */
  diamondSize: number;
  /** Alleen dit horizontale bereik tekenen (scherm: het zichtbare canvas). Weglaten = alles. */
  visibleX?: readonly [number, number];
}

/**
 * Tekent de strook van één taak: de lijnen uit {@link baselineLanes} en de ruiten uit
 * {@link baselineDiamonds}. Elke lijn loopt van zijn bovenkant door tot de onderkant van de strook, en
 * de lijnen eronder komen er daarna overheen. Zo valt er tussen twee lijnen geen lichte naad.
 */
export function paintBaselineStrip(
  d: StripPainter,
  bars: readonly BaselineBar[],
  diamonds: readonly BaselineDiamond[],
  o: PaintBaselineStripOptions,
): void {
  const [vMin, vMax] = o.visibleX ?? [-Infinity, Infinity];
  // Heel ver ingezoomd of in een rapportvenster: alleen tekenen wat in beeld valt.
  const clampX = (x: number) => Math.min(vMax, Math.max(vMin, x));
  const bottom = o.top + o.height;
  for (const lane of baselineLanes(bars, o.height, o.blend)) {
    const n = lane.x.length;
    if (n < 2 || lane.x[n - 1] < vMin || lane.x[0] > vMax) continue;
    d.fillStyle = o.colorOf(lane.slot);
    const edge: Pt[] = lane.x.map((x, i) => [clampX(x), o.top + lane.top[i]]);
    fillPolygon(d, [...edge, [clampX(lane.x[n - 1]), bottom], [clampX(lane.x[0]), bottom]]);
  }
  const s = o.diamondSize;
  const cy = o.top + o.height / 2;
  for (const dm of diamonds) {
    if (dm.x + s < vMin || dm.x - s > vMax) continue;
    const outline: Pt[] = [[dm.x, cy - s], [dm.x + s, cy], [dm.x, cy + s], [dm.x - s, cy]];
    fillStriped(d, outline, dm.slots.map(o.colorOf), o.stripeWidth, dm.x - s, cy - s, 2 * s, dm.x - s, dm.x + s);
  }
}
