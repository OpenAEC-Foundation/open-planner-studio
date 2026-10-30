// Eén tekenregel voor de baselinestrook onder een taakbalk, gedeeld door het scherm
// (`GanttRenderer`) en de afdruk/PDF (`printPreview`), net als `paintProgressBarPiece` voor de balk.
//
// De Gantt toont de actieve baseline plus tot twee vergelijkingsbaselines (issue #391) in ÉÉN strook.
// Per taak wordt die strook op de begin- en eindgrenzen van de baselines in stukken verdeeld:
//   - ligt er in een stuk één baseline: effen in haar kleur;
//   - liggen er twee of drie: schuine strepen (45°) die om de beurt precies die kleuren tonen;
//   - raken baselines elkaar niet: losse stukken.
// Een buitenkant van de strook (geen baseline er direct naast) is halfrond. Mijlpalen krijgen een
// ruit per datum; vallen meerdere baselines op dezelfde datum, dan één gestreepte ruit.
//
// Alles wordt als veelhoek getekend (geen canvaspatroon, geen clip), omdat de afdruklaag (`Draw2D`,
// ook de vector-PDF) die niet kent. Zo zijn scherm en papier per constructie gelijk. De strepen
// liggen vast aan `anchorX` (de linkerkant van de strook), dus ze schuiven mee bij pannen.

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

/** Eén stuk van de strook met de baselines die er liggen (oplopend op plaats). */
export interface BaselineStripPiece {
  x1: number;
  x2: number;
  slots: BaselineSlot[];
  /** Halfrond aan deze kant: er ligt geen baseline direct links/rechts van het stuk. */
  roundLeft: boolean;
  roundRight: boolean;
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
  const covered = (x: number) => valid.some(b => b.x1 < x && b.x2 > x);
  const pieces: BaselineStripPiece[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i];
    const b = edges[i + 1];
    const slots = valid.filter(bar => bar.x1 <= a && bar.x2 >= b).map(bar => bar.slot).sort(bySlot);
    if (slots.length === 0) continue;
    pieces.push({ x1: a, x2: b, slots, roundLeft: !covered(a - 1e-6), roundRight: !covered(b + 1e-6) });
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
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  setLineDash(segments: number[]): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}

/**
 * Issue #741: hoe een baseline ook zonder kleur herkenbaar is (bv. op een zwart-witafdruk). De
 * kleuren en de strepen bij overlap blijven in elke stijl; de stijl voegt een tweede kenmerk toe.
 *  - `kleur`: alleen kleur (zoals goedgekeurd op 2026-10-20);
 *  - `vorm`: actief effen, vergelijking 1 alleen een rand (hol), vergelijking 2 een dunne lijn;
 *  - `patroon`: actief effen, vergelijking 1 blokjes, vergelijking 2 alleen een rand (hol);
 *  - `label`: kleur plus een letter (A, B, C) achter het einde van elke baseline.
 * Tijdelijk drie varianten naast elkaar; de eigenaar kiest er één.
 */
export type BaselineMarkStyle = 'kleur' | 'vorm' | 'patroon' | 'label';
export const BASELINE_MARK_STYLES: readonly BaselineMarkStyle[] = ['kleur', 'vorm', 'patroon', 'label'];

/** Letter per baselineplaats in de stijl `label` (ook in de legenda). */
export const BASELINE_SLOT_LETTER: Record<BaselineSlot, string> = { 0: 'A', 1: 'B', 2: 'C' };

/** Vulling van één baselineplaats: effen, alleen een rand, een dunne lijn of blokjes. */
type SlotFill = 'full' | 'rim' | 'thin' | 'dash';

function slotFill(style: BaselineMarkStyle, slot: BaselineSlot): SlotFill {
  if (style === 'vorm') return (['full', 'rim', 'thin'] as const)[slot];
  if (style === 'patroon') return (['full', 'dash', 'rim'] as const)[slot];
  return 'full';
}

/** Eén letterlabel achter het einde van een baseline (stijl `label`). */
export interface BaselineLabel {
  /** Linkerkant van het label: het einde van de baseline (of de rechterpunt van de ruit). */
  x: number;
  slots: BaselineSlot[];
}

/** Labels voor de stijl `label`: één per einde; baselines met hetzelfde einde delen een label.
 *  Rekent met de echte grenzen, niet met de verbrede stukken. */
export function baselineLabels(
  bars: readonly BaselineBar[], milestones: readonly BaselineMilestone[], diamondSize: number,
): BaselineLabel[] {
  const ends = [
    ...bars.filter(b => b.x2 > b.x1).map(b => ({ x: b.x2, slot: b.slot })),
    ...milestones.map(m => ({ x: m.x + diamondSize, slot: m.slot })),
  ].sort((a, b) => a.x - b.x || a.slot - b.slot);
  const out: BaselineLabel[] = [];
  for (const e of ends) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - e.x) < 0.5) {
      if (!last.slots.includes(e.slot)) last.slots.push(e.slot);
    } else {
      out.push({ x: e.x, slots: [e.slot] });
    }
  }
  return out;
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
    // Een rand van (bijna) nul lang begrenst niets; zijn richting is alleen afrondruis en zou de
    // hele vorm kunnen wegsnijden (gebeurt bij een vorm die zelf al afgesneden is, issue #741).
    if (len < 1e-7) continue;
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

/** Rechthoek met halfronde zijkanten als convexe veelhoek (met de klok mee). */
function stripOutline(x1: number, x2: number, y: number, h: number, roundLeft: boolean, roundRight: boolean): Pt[] {
  const r = Math.min(h / 2, (x2 - x1) / 2);
  const steps = 6;
  const pts: Pt[] = [];
  // Bovenkant van links naar rechts, rechterkant, onderkant terug, linkerkant.
  if (roundRight && r > 0) {
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / steps;
      pts.push([x2 - r + r * Math.cos(a), y + r + r * Math.sin(a)]);
    }
  } else {
    pts.push([x2, y], [x2, y + h]);
  }
  if (roundLeft && r > 0) {
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI / 2 + (Math.PI * i) / steps;
      pts.push([x1 + r + r * Math.cos(a), y + r + r * Math.sin(a)]);
    }
  } else {
    pts.push([x1, y + h], [x1, y]);
  }
  return pts;
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
  /** Breedte van één schuine band (horizontaal gemeten). */
  stripeWidth: number;
  /** Kleur per baselineplaats. */
  colorOf: (slot: BaselineSlot) => string;
  /** Halve diagonaal van een mijlpaalruit. */
  diamondSize: number;
  /** Alleen dit horizontale bereik tekenen (scherm: het zichtbare canvas). Weglaten = alles. */
  visibleX?: readonly [number, number];
  /** Kenmerk naast kleur (issue #741). Weglaten = `kleur`. */
  markStyle?: BaselineMarkStyle;
  /** Stijl `label`: de labels (`baselineLabels`) en het lettertype. */
  labels?: readonly BaselineLabel[];
  labelFont?: string;
  /** Achtergrond achter een label, zodat een letter op een andere strook leesbaar blijft. */
  labelBackground?: string;
}

/**
 * Tekent de strook van één taak: de stukken uit {@link baselineStripPieces} en de ruiten uit
 * {@link baselineDiamonds}. De strepen liggen vast aan de linkerkant van de strook (`anchorX`).
 */
export function paintBaselineStrip(
  d: StripPainter,
  pieces: readonly BaselineStripPiece[],
  diamonds: readonly BaselineDiamond[],
  o: PaintBaselineStripOptions,
): void {
  const [vMin, vMax] = o.visibleX ?? [-Infinity, Infinity];
  const style = o.markStyle ?? 'kleur';
  const shaped = style === 'vorm' || style === 'patroon';
  const anchorX = pieces.length ? pieces[0].x1 : 0;
  for (const p of pieces) {
    if (p.x2 < vMin || p.x1 > vMax) continue;
    // Een heel lang stuk (ver ingezoomd) alleen tekenen waar het zichtbaar is; de ronde kanten
    // blijven dan buiten beeld.
    const x1 = p.x1 < vMin - o.height ? vMin - o.height : p.x1;
    const x2 = p.x2 > vMax + o.height ? vMax + o.height : p.x2;
    const roundL = p.roundLeft && x1 === p.x1;
    const roundR = p.roundRight && x2 === p.x2;
    const outline = stripOutline(x1, x2, o.top, o.height, roundL, roundR);
    if (!shaped) {
      fillStriped(d, outline, p.slots.map(o.colorOf), o.stripeWidth, anchorX, o.top, o.height, x1, x2);
      continue;
    }
    const thin = Math.max(1.5, o.height * 0.4);
    const ty = o.top + (o.height - thin) / 2;
    fillShaped(d, outline, p.slots, style, o, anchorX, o.top, o.height, x1, x2, {
      thin: [[x1, ty], [x2, ty], [x2, ty + thin], [x1, ty + thin]],
      rim: () => stripOutline(x1 + 0.5, x2 - 0.5, o.top + 0.5, o.height - 1, roundL, roundR),
    });
  }
  const s = o.diamondSize;
  const cy = o.top + o.height / 2;
  for (const dm of diamonds) {
    if (dm.x + s < vMin || dm.x - s > vMax) continue;
    const ruit = (r: number): Pt[] => [[dm.x, cy - r], [dm.x + r, cy], [dm.x, cy + r], [dm.x - r, cy]];
    const outline = ruit(s);
    if (!shaped) {
      fillStriped(d, outline, dm.slots.map(o.colorOf), o.stripeWidth, dm.x - s, cy - s, 2 * s, dm.x - s, dm.x + s);
      continue;
    }
    fillShaped(d, outline, dm.slots, style, o, dm.x - s, cy - s, 2 * s, dm.x - s, dm.x + s, {
      thin: ruit(s * 0.5),
      rim: () => ruit(Math.max(0.5, s - 0.75)),
    });
  }
  if (style === 'label' && o.labels?.length) paintLabels(d, o.labels, o, vMin, vMax);
}

/**
 * Stijl `vorm`/`patroon`: elke baseline vult alleen haar eigen deel (effen, dunne lijn of blokjes);
 * een holle baseline vult niets en krijgt een rand om de hele vorm. Waar baselines overlappen,
 * krijgt elke schuine band het deel van zijn baseline. Zo zijn ook de strepen zonder kleur te lezen.
 */
function fillShaped(
  d: StripPainter, outline: readonly Pt[], slots: readonly BaselineSlot[], style: BaselineMarkStyle,
  o: PaintBaselineStripOptions, anchorX: number, top: number, h: number, xMin: number, xMax: number,
  shapes: { thin: readonly Pt[]; rim: () => Pt[] },
): void {
  // Het gebied per baseline als lijst convexe veelhoeken (binnen de vorm).
  const region = (slot: BaselineSlot): Pt[][] => {
    const fill = slotFill(style, slot);
    if (fill === 'full') return [[...outline]];
    if (fill === 'thin') return [clipConvex(shapes.thin, outline)].filter(q => q.length >= 3);
    if (fill === 'dash') {
      const period = Math.max(4, Math.round(o.height * 1.2));
      const on = Math.ceil(period * 0.6);
      const out: Pt[][] = [];
      for (let j = Math.floor((xMin - anchorX) / period); anchorX + j * period <= xMax; j++) {
        const a = anchorX + j * period;
        const q = clipConvex([[a, top - 1], [a + on, top - 1], [a + on, top + h + 1], [a, top + h + 1]], outline);
        if (q.length >= 3) out.push(q);
      }
      return out;
    }
    return [];
  };
  if (slots.length === 1) {
    d.fillStyle = o.colorOf(slots[0]);
    for (const q of region(slots[0])) fillPolygon(d, q);
  } else {
    const n = slots.length;
    const regions = slots.map(region);
    const w = o.stripeWidth;
    const kFrom = Math.floor((xMin - anchorX) / w);
    const kTo = Math.ceil((xMax + h - anchorX) / w);
    for (let k = kFrom; k <= kTo; k++) {
      const ci = ((k % n) + n) % n;
      const c1 = anchorX + k * w;
      const band: Pt[] = [[c1, top], [c1 + w, top], [c1 + w - h, top + h], [c1 - h, top + h]];
      d.fillStyle = o.colorOf(slots[ci]);
      for (const q of regions[ci]) fillPolygon(d, clipConvex(band, q));
    }
  }
  for (const slot of slots) {
    if (slotFill(style, slot) !== 'rim') continue;
    const rim = shapes.rim();
    if (rim.length < 3) continue;
    d.strokeStyle = o.colorOf(slot);
    d.lineWidth = 1;
    d.setLineDash([]);
    d.beginPath();
    d.moveTo(rim[0][0], rim[0][1]);
    for (let i = 1; i < rim.length; i++) d.lineTo(rim[i][0], rim[i][1]);
    d.closePath();
    d.stroke();
  }
}

/** Stijl `label`: de letter(s) achter het einde, elke letter in de kleur van haar baseline. Een
 *  label dat op het vorige zou vallen, schuift erachter. */
function paintLabels(
  d: StripPainter, labels: readonly BaselineLabel[], o: PaintBaselineStripOptions, vMin: number, vMax: number,
): void {
  if (o.labelFont) d.font = o.labelFont;
  d.textAlign = 'left';
  d.textBaseline = 'middle';
  const gap = Math.max(1.5, o.height * 0.4);
  const cy = o.top + o.height / 2;
  let nextFree = -Infinity;
  for (const l of labels) {
    let x = Math.max(l.x + gap, nextFree);
    const width = l.slots.reduce<number>((sum, slot) => sum + d.measureText(BASELINE_SLOT_LETTER[slot]).width, 0);
    nextFree = x + width + gap;
    if (x > vMax || x + width < vMin) continue;
    if (o.labelBackground) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(o.labelFont ?? '')?.[1] ?? o.height * 2);
      const pad = Math.max(1, size * 0.15);
      d.fillStyle = o.labelBackground;
      fillPolygon(d, [[x - pad, cy - size * 0.55], [x + width + pad, cy - size * 0.55], [x + width + pad, cy + size * 0.55], [x - pad, cy + size * 0.55]]);
    }
    for (const slot of l.slots) {
      const letter = BASELINE_SLOT_LETTER[slot];
      d.fillStyle = o.colorOf(slot);
      d.fillText(letter, x, cy);
      x += d.measureText(letter).width;
    }
  }
}

/**
 * Legendablokje voor één baseline: een kort stuk strook met dezelfde tekenregel als de Gantt, en in
 * de stijl `label` de letter erachter (`withLabel: false`: zonder letter). Gedeeld door de afdruklegenda en de legenda in de statusbalk.
 */
export function paintBaselineSwatch(
  d: StripPainter, slot: BaselineSlot, x: number, top: number, width: number, height: number,
  o: Pick<PaintBaselineStripOptions, 'colorOf' | 'stripeWidth' | 'markStyle' | 'labelFont' | 'labelBackground'> & { withLabel?: boolean },
): void {
  paintBaselineStrip(d, [{ x1: x, x2: x + width, slots: [slot], roundLeft: true, roundRight: true }], [], {
    ...o,
    top, height,
    diamondSize: baselineDiamondSize(height),
    labels: o.withLabel === false ? undefined : [{ x: x + width, slots: [slot] }],
  });
}

/** Eén getekend element van {@link svgStripRecorder}. */
export type SvgStripItem =
  | { kind: 'fill'; d: string; color: string }
  | { kind: 'stroke'; d: string; color: string; width: number }
  | { kind: 'text'; x: number; y: number; text: string; color: string };

/** Een `StripPainter` die SVG-elementen opneemt, voor de legenda in React (geen canvas nodig).
 *  `charWidth`: geschatte breedte van een letter (SVG meet geen tekst). */
export function svgStripRecorder(charWidth: number): StripPainter & { items: SvgStripItem[] } {
  let path = '';
  const items: SvgStripItem[] = [];
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    items,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'middle',
    beginPath() { path = ''; },
    moveTo(x, y) { path += `M${r(x)} ${r(y)}`; },
    lineTo(x, y) { path += `L${r(x)} ${r(y)}`; },
    closePath() { path += 'Z'; },
    fill() { items.push({ kind: 'fill', d: path, color: String(this.fillStyle) }); },
    stroke() { items.push({ kind: 'stroke', d: path, color: String(this.strokeStyle), width: this.lineWidth }); },
    setLineDash() { /* geen stippellijnen in de strook */ },
    fillText(text, x, y) { items.push({ kind: 'text', x, y, text, color: String(this.fillStyle) }); },
    measureText(text) { return { width: text.length * charWidth }; },
  };
}
