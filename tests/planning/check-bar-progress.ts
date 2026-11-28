const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { readGanttPalette, contrastRatio, doneBarTones, GANTT_TRACE_COLORS } from '@/engine/renderer/themePalette';
import { RESOURCE_PALETTE, ensureThemeVisible } from '@/engine/renderer/resourcePalette';
import { paintProgressBarPiece, type BarPainter } from '@/engine/renderer/barPaint';

const LABEL_MIN_CONTRAST = 4.5;
const GREY_MAX_CHROMA = 40;
const MIN_CHROMA_DROP = 100;

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
const rgbOf = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const chroma = (hex: string): number => { const c = rgbOf(hex); return Math.max(...c) - Math.min(...c); };

const p = readGanttPalette();
const TINTEN: string[] = [
  p.critical, p.normal, p.nearCritical, p.milestone, p.ghost, p.hammock,
  ...p.floatPathTints,
  ...Object.values(GANTT_TRACE_COLORS),
  ...RESOURCE_PALETTE,
  '#FF6B6B', '#60A5FA', '#D9A6FF',
  '#000000', '#0B0B0B', '#1E293B', '#808080', '#F5F5F5', '#FFFFFF', '#FFFF00',
];

for (const dark of [false, true]) {
  for (const raw of TINTEN) {
    const base = ensureThemeVisible(raw, dark);
    const { fill, text } = doneBarTones(base, dark);
    ok(`${base}: grijs ${fill} is hex`, /^#[0-9a-f]{6}$/i.test(fill));
    ok(`${base}: grijs ${fill} is vrijwel neutraal (kleurigheid ${chroma(fill)} <= ${GREY_MAX_CHROMA})`, chroma(fill) <= GREY_MAX_CHROMA);
    const l = contrastRatio(rgbOf(fill), rgbOf(text));
    ok(`${base}${dark ? ' (donker)' : ''}: label ${text} op grijs ${l.toFixed(2)} >= ${LABEL_MIN_CONTRAST}`, l >= LABEL_MIN_CONTRAST);
  }
}
ok('niet-hex basiskleur valt terug op het kale grijs', /^#[0-9a-f]{6}$/i.test(doneBarTones('var(--x)', false).fill));

for (const dark of [false, true]) {
  for (const base of [p.critical, p.normal, p.milestone, p.hammock]) {
    const drop = chroma(base) - chroma(doneBarTones(base, dark).fill);
    ok(`${base}${dark ? ' (donker)' : ''}: kleurigheid zakt ${drop} >= ${MIN_CHROMA_DROP} van balk naar grijs`, drop >= MIN_CHROMA_DROP);
  }
}

interface Shape { x: number; w: number; fill: string; r: readonly number[] }
function record(paint: (d: BarPainter) => void): Shape[] {
  const shapes: Shape[] = [];
  let pending: Omit<Shape, 'fill'> | null = null;
  const d = {
    fillStyle: '' as BarPainter['fillStyle'],
    beginPath: () => { pending = null; },
    roundRect: (x: number, _y: number, w: number, _h: number, r: readonly [number, number, number, number]) => { pending = { x, w, r }; },
    fill: () => { if (pending) shapes.push({ ...pending, fill: String(d.fillStyle) }); },
  };
  paint(d);
  return shapes;
}
const BASE = p.normal;
const GREY = doneBarTones(BASE, false).fill;
const piece = (progressX: number, roundLeft = true, roundRight = true) =>
  record(d => paintProgressBarPiece(d, 100, 200, 0, 20, 4, BASE, progressX, false, roundLeft, roundRight));

{
  const none = piece(-Infinity);
  ok(`geen voortgang: één vlak in de basiskleur (${JSON.stringify(none)})`,
    none.length === 1 && none[0].fill === BASE && none[0].x === 100 && none[0].w === 100);
  ok('geen voortgang: alle vier de hoeken rond', none[0]?.r.every(r => r === 4));

  const half = piece(150.4);
  ok(`deels: eerst kleur, dan grijs eroverheen (${JSON.stringify(half)})`,
    half.length === 2 && half[0].fill === BASE && half[1].fill === GREY);
  ok('deels: grijs eindigt exact op de voortgangsgrens (niet afgerond)',
    half.length === 2 && half[1].x === 100 && Math.abs(half[1].x + half[1].w - 150.4) < 1e-9);
  ok('deels: kleur loopt precies 1 px onder het grijs door',
    half.length === 2 && Math.abs(half[0].x - 149.4) < 1e-9 && half[0].x + half[0].w === 200);
  ok('deels: kleur alleen rechts rond, grijs alleen links rond',
    half.length === 2 && JSON.stringify(half[0].r) === '[0,4,4,0]' && JSON.stringify(half[1].r) === '[4,0,0,4]');
  const shifted = record(d => paintProgressBarPiece(d, 100.3, 200.3, 0, 20, 4, BASE, 150.7, false));
  ok('schuiven: grijs schuift exact mee (breedte blijft 50,4)',
    shifted.length === 2 && Math.abs(shifted[1].w - 50.4) < 1e-9);

  const done = piece(Infinity);
  ok(`voltooid: één grijs vlak over de hele balk (${JSON.stringify(done)})`,
    done.length === 1 && done[0].fill === GREY && done[0].x === 100 && done[0].w === 100);

  const before = piece(50);
  ok('voortgangsgrens vóór het vlak: alleen kleur, vanaf de linkerrand', before.length === 1 && before[0].fill === BASE && before[0].x === 100);
  const after = piece(250);
  ok('voortgangsgrens voorbij het vlak (ander stuk van de balk): alleen grijs', after.length === 1 && after[0].fill === GREY);

  const inner = piece(150, false, false);
  ok('binnenstuk (resource-modus): geen enkele ronde hoek',
    inner.every(s => s.r.every(r => r === 0)));
}

if (diffs.length === 0) {
  console.log(`OK  bar-progress: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  bar-progress: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
