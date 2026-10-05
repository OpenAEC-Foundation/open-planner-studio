// Taakbalk-tinten: lichte vulling, donkere rand en voortgangsarcering blijven in elke kleur te
// onderscheiden.
//
// Bewaakt `barTones` (themePalette.ts), de bron van de balkweergave in GanttRenderer:
//   1. voor elke tint die de renderer kan tekenen — merktinten, float-pad-tinten, trace-tinten,
//      het resourcepalet (ook na `ensureThemeVisible` in het donkere thema) en eigen extreme
//      kleuren — is de vulling lichter en de rand donkerder dan de basiskleur, en houden vulling
//      en rand minstens BAR_TONE_MIN_CONTRAST contrast (de rand draagt ook de voortgangsarcering);
//   2. het balklabel haalt op elke vulling minstens LABEL_MIN_CONTRAST;
//   3. `BAR_TONE_STEP` is de afstemknop: een grotere stap geeft meer contrast;
//   4. niet-hex invoer valt terug op de basiskleur met een vaste donkere rand.
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import {
  readGanttPalette, contrastRatio, barTones, barLabelColor, BAR_TONE_STEP, GANTT_TRACE_COLORS,
} from '@/engine/renderer/themePalette';
import { RESOURCE_PALETTE, ensureThemeVisible } from '@/engine/renderer/resourcePalette';

/** Ondergrens vulling↔rand bij de standaardstap 0,4 (gemeten minimum: wit, 2,85). */
const BAR_TONE_MIN_CONTRAST = 2.5;
/** Ondergrens balklabel op de vulling (gemeten minimum: slate #1E293B, 4,39). */
const LABEL_MIN_CONTRAST = 4;

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
const lum = (hex: string): number => contrastRatio(rgbOf(hex), [0, 0, 0]);

const p = readGanttPalette();
const TINTEN: string[] = [
  p.critical, p.normal, p.nearCritical, p.milestone, p.ghost, p.hammock,
  ...p.floatPathTints,
  ...Object.values(GANTT_TRACE_COLORS),
  ...RESOURCE_PALETTE,
  // Hoog-contrast-balktinten (globals.css) en eigen extreme kleuren uit projectdata.
  '#FF6B6B', '#60A5FA', '#D9A6FF',
  '#000000', '#0B0B0B', '#1E293B', '#808080', '#F5F5F5', '#FFFFFF', '#FFFF00',
];

ok(`BAR_TONE_STEP ligt in (0,1) (kreeg ${BAR_TONE_STEP})`, BAR_TONE_STEP > 0 && BAR_TONE_STEP < 1);

// ── 1 + 2: elke tint, licht én donker thema (na ensureThemeVisible) ──────────
for (const dark of [false, true]) {
  for (const raw of TINTEN) {
    const base = ensureThemeVisible(raw, dark);
    const { fill, outline } = barTones(base);
    ok(`${base}: vulling ${fill} en rand ${outline} zijn hex`, /^#[0-9a-f]{6}$/i.test(fill) && /^#[0-9a-f]{6}$/i.test(outline));
    ok(`${base}: vulling ${fill} is niet donkerder dan de basis`, lum(fill) >= lum(base));
    ok(`${base}: rand ${outline} is niet lichter dan de basis`, lum(outline) <= lum(base));
    const r = contrastRatio(rgbOf(fill), rgbOf(outline));
    ok(`${base}: vulling↔rand ${r.toFixed(2)} >= ${BAR_TONE_MIN_CONTRAST}`, r >= BAR_TONE_MIN_CONTRAST);
    const l = contrastRatio(rgbOf(fill), rgbOf(barLabelColor(fill)));
    ok(`${base}: label op vulling ${l.toFixed(2)} >= ${LABEL_MIN_CONTRAST}`, l >= LABEL_MIN_CONTRAST);
  }
}

// ── 3: de stap is de afstemknop ─────────────────────────────────────────────
{
  const c = (step: number) => {
    const t = barTones(p.normal, step);
    return contrastRatio(rgbOf(t.fill), rgbOf(t.outline));
  };
  ok('stap 0 = geen contrast (vulling == rand == basis)', Math.abs(c(0) - 1) < 1e-9);
  ok(`grotere stap = meer contrast (0,2: ${c(0.2).toFixed(2)}, 0,4: ${c(0.4).toFixed(2)}, 0,6: ${c(0.6).toFixed(2)})`,
    c(0.2) < c(0.4) && c(0.4) < c(0.6));
  ok('standaardstap is BAR_TONE_STEP', barTones(p.normal).fill === barTones(p.normal, BAR_TONE_STEP).fill);
}

// ── 4: niet-hex invoer ─────────────────────────────────────────────────────
{
  const t = barTones('var(--x)');
  ok('CSS-var: vulling blijft de basiskleur', t.fill === 'var(--x)');
  ok('CSS-var: rand is een vaste donkere laag', t.outline.startsWith('rgba(0, 0, 0'));
}

// ── Uitslag ─────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  bar-tones: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  bar-tones: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
