// Voortgangsvulling: het voltooide deel van een balk blijft in elk thema en elke balkkleurmodus
// te onderscheiden van het resterende deel.
//
// Bewaakt `progressFill` (themePalette.ts) en de keuze in GanttRenderer:
//   1. `progressFill` haalt voor elke tint die de renderer kan tekenen — merktinten, float-pad-
//      tinten, trace-tinten, het resourcepalet (ook na `ensureThemeVisible` in het donkere thema)
//      en eigen extreme kleuren — minstens PROGRESS_MIN_CONTRAST, in beide richtingen;
//   2. de richting volgt het palet (`progressPrefersLighter`): hoog contrast lichter, anders donkerder;
//   3. niet-hex invoer valt terug op de oude rgba-laag in plaats van te crashen.
// De renderkant (vulling per resourcesegment) staat in check-resource-accent.ts.
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import {
  readGanttPalette, contrastRatio, progressFill, progressPrefersLighter,
  PROGRESS_MIN_CONTRAST, PROGRESS_FALLBACK_OVERLAY, GANTT_TRACE_COLORS,
} from '@/engine/renderer/themePalette';
import { RESOURCE_PALETTE, ensureThemeVisible } from '@/engine/renderer/resourcePalette';

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

// ── 1 + 2: elke tint, beide richtingen, licht én donker (na ensureThemeVisible) ──
for (const preferLighter of [false, true]) {
  for (const dark of [false, true]) {
    for (const raw of TINTEN) {
      const bar = ensureThemeVisible(raw, dark);
      const fill = progressFill(bar, preferLighter);
      ok(`${bar} (${dark ? 'donker' : 'licht'}, ${preferLighter ? 'lichter' : 'donkerder'}): vulling ${fill} is een hex`,
        /^#[0-9a-f]{6}$/i.test(fill));
      const ratio = contrastRatio(rgbOf(bar), rgbOf(fill));
      ok(`${bar} → ${fill} (${preferLighter ? 'lichter' : 'donkerder'}): ${ratio.toFixed(2)} >= ${PROGRESS_MIN_CONTRAST}`,
        ratio >= PROGRESS_MIN_CONTRAST);
    }
  }
}
// Voorkeursrichting wordt gevolgd waar die haalbaar is.
ok('donkerder-voorkeur op blauw geeft een donkerdere vulling', lum(progressFill('#2563EB', false)) < lum('#2563EB'));
ok('lichter-voorkeur op blauw geeft een lichtere vulling', lum(progressFill('#2563EB', true)) > lum('#2563EB'));
// Onhaalbare richting valt om: zwart kan niet donkerder, wit niet lichter.
ok('zwart met donkerder-voorkeur wordt lichter', lum(progressFill('#000000', false)) > lum('#000000'));
ok('wit met lichter-voorkeur wordt donkerder', lum(progressFill('#FFFFFF', true)) < lum('#FFFFFF'));

// Paletrichting: BRAND (licht/donker) vult donkerder, hoog contrast lichter.
ok('BRAND-palet vult donkerder', progressPrefersLighter(p) === false);
ok('hoog-contrastpalet vult lichter', progressPrefersLighter({ normal: '#60A5FA', normalLight: '#DBEAFE' }) === true);

// ── 3: niet-hex invoer ─────────────────────────────────────────────────────
ok('CSS-var valt terug op de rgba-laag', progressFill('var(--x)') === PROGRESS_FALLBACK_OVERLAY);
ok('rgba valt terug op de rgba-laag', progressFill('rgba(1,2,3,0.5)') === PROGRESS_FALLBACK_OVERLAY);

// ── Uitslag ─────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  progress-contrast: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  progress-contrast: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
