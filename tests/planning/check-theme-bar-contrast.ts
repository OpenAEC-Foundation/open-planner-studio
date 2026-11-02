// Thema-balktinten: de CSS-overrides en de tekenlaag mogen niet uit elkaar lopen.
//
// De balkkleuren komen uit `BRAND`, maar `readGanttPalette` leest ze via een thema-var met BRAND
// als fallback (`--theme-bar-critical`, `-normal`, `-milestone`, `-baseline`, `-float`). Licht en donker definiëren die vars bewust NIET en vallen dus
// terug op BRAND; het hoog-contrastthema zet ze wél, omdat de verzadigde merkset op #0a0a0a door
// de 3:1 heen zakt.
//
// Die CSS is losse tekst die niemand typecheckt. Deze poort leest `globals.css` en bewaakt drie
// dingen die anders stil verlopen:
//   1. de tekenlaag valt zonder CSS terug op exact de BRAND-hexen (het licht/donker-pad);
//   2. elk thema dat een balktint overschrijft, haalt op ZIJN EIGEN kaartkleur minstens 3:1 —
//      voor hoog contrast met een strengere lat, want dat thema bestaat juist daarvoor;
//   3. het grijze, voltooide deel van een taakbalk (`doneBarTones`) haalt op elke themakaart
//      minstens 3:1, zodat afgerond werk wel bleek maar niet onzichtbaar wordt.
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { readGanttPalette, contrastRatio, doneBarTones, PRINT_PALETTE } from '@/engine/renderer/themePalette';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq<T>(label: string, actual: T, expected: T): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${String(actual)}, verwacht ${String(expected)}`);
}

const rgbOf = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

// ── 1. Zonder CSS: de tekenlaag levert exact de BRAND-hexen ─────────────────
// Dit is het licht/donker-pad (die thema's zetten de balk-vars niet). Zakt hier iets weg, dan is
// de thema-var-indirectie stuk en tekent de app plots een fallback die niemand koos.
{
  const p = readGanttPalette();
  eq('fallback critical', p.critical, '#DC2626');
  eq('fallback normal', p.normal, '#2563EB');
  eq('fallback milestone', p.milestone, '#7C3AED');
  eq('fallback baseline', p.baseline, '#1F2937');
}

// ── 2. De themablokken uit globals.css ──────────────────────────────────────
const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/styles/globals.css');
const css = readFileSync(cssPath, 'utf8');

/** Pakt het `{...}`-blok achter een selector en leest er custom properties uit. */
function themeBlock(selector: string): Record<string, string> {
  const at = css.indexOf(selector);
  if (at === -1) return {};
  const open = css.indexOf('{', at);
  const close = css.indexOf('\n}', open);
  const body = css.slice(open, close);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const BALK_VARS = [
  '--theme-bar-critical', '--theme-bar-normal', '--theme-bar-milestone', '--theme-bar-baseline',
] as const;

/** Ondergrens van het grijze, voltooide balkdeel op de themakaart (grafisch object, WCAG 1.4.11). */
const DONE_MIN_CONTRAST = 3;

// Elk thema met zijn eigen kaartkleur en de lat die daar geldt. Hoog contrast bestaat om de norm
// te halen, dus daar 7:1 in plaats van de 3:1-ondergrens voor grafische objecten.
const THEMAS: { selector: string; kaart: string; lat: number; moetZetten: boolean }[] = [
  { selector: '[data-theme="high-contrast"]', kaart: '#0a0a0a', lat: 7, moetZetten: true },
  { selector: '[data-theme="light"]', kaart: '#FAFAFA', lat: 3, moetZetten: false },
];

for (const { selector, kaart, lat, moetZetten } of THEMAS) {
  const vars = themeBlock(selector);
  const gezet = BALK_VARS.filter(v => vars[v] !== undefined);

  if (moetZetten) {
    ok(`${selector}: zet alle ${BALK_VARS.length} balktinten (kreeg ${gezet.length})`,
      gezet.length === BALK_VARS.length);
  }

  for (const v of gezet) {
    const ratio = contrastRatio(rgbOf(vars[v]), rgbOf(kaart));
    ok(`${selector} ${v} (${vars[v]}) haalt ${ratio.toFixed(2)} >= ${lat} op ${kaart}`, ratio >= lat);
  }

  // Het voltooide deel van een taakbalk is grijs (`doneBarTones`). Het hoog-contrastthema tekent
  // met het lichte grijs (`darkTheme` staat daar uit); dat moet op de eigen kaart zichtbaar blijven.
  for (const v of ['--theme-bar-critical', '--theme-bar-normal'] as const) {
    if (!vars[v]) continue;
    const grey = doneBarTones(vars[v], false).fill;
    const c = contrastRatio(rgbOf(grey), rgbOf(kaart));
    ok(`${selector} ${v}: grijs voltooid deel ${grey} haalt ${c.toFixed(2)} >= ${DONE_MIN_CONTRAST} op ${kaart}`,
      c >= DONE_MIN_CONTRAST);
  }
}

// Donker thema (geen eigen balktinten, dus BRAND): het donkere grijs op de donkere kaart.
{
  const pal = readGanttPalette();
  for (const base of [pal.critical, pal.normal]) {
    const grey = doneBarTones(base, true).fill;
    const c = contrastRatio(rgbOf(grey), rgbOf('#2E3239'));
    // Het donkere grijs is bewust ingetogen: het moet van de kaart loskomen, niet ermee wedijveren.
    ok(`[data-theme="dark"] grijs voltooid deel ${grey} haalt ${c.toFixed(2)} >= 1.5 op #2E3239`, c >= 1.5);
  }
}

// ── 3. Licht en donker zetten ze bewust NIET ────────────────────────────────
// Zou een van beide er een gaan zetten, dan is de aanname "licht en donker delen één balkset"
// stilzwijgend vervallen — dat moet een bewuste wijziging zijn, geen verrassing.
// Uitzondering (#741): het donkere thema zet alleen de actieve baseline, omdat het lichte #1F2937
// op de donkere kaart wegvalt.
const MAG_ZETTEN: Record<string, readonly string[]> = {
  '[data-theme="light"]': [],
  '[data-theme="dark"]': ['--theme-bar-baseline'],
};
for (const [selector, mag] of Object.entries(MAG_ZETTEN)) {
  const vars = themeBlock(selector);
  const gezet = BALK_VARS.filter(v => vars[v] !== undefined && !mag.includes(v));
  ok(`${selector} laat de balktinten aan BRAND over (kreeg ${gezet.join(', ') || 'geen'})`, gezet.length === 0);
}

// ── 4. Baselines: drie helderheidsstappen (#741, besluit Ethan 2026-11-02) ──────────────────
// "Niet alleen door kleur": de actieve baseline is het donkerst, dan vergelijking 2, dan
// vergelijking 1. Zo blijven ze in grijs (zwart-witafdruk, kleurenblindheid) uit elkaar. Gemeten
// als CIELAB L* (0 zwart, 100 wit); elke stap minstens MIN_STAP_L.
const MIN_STAP_L = 10;
const lStar = (hex: string): number => {
  const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgbOf(hex);
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : y * 24389 / 27;
};
{
  const pal = readGanttPalette();
  const licht = themeBlock('[data-theme="light"]');
  const donker = themeBlock('[data-theme="dark"]');
  // Het lichte thema en de tekenlaag zonder CSS (headless, afdruk-fallback) moeten gelijk blijven.
  eq('licht vergelijking 1 = fallback', licht['--theme-bar-baseline-compare-1'], pal.baselineCompare1);
  eq('licht vergelijking 2 = fallback', licht['--theme-bar-baseline-compare-2'], pal.baselineCompare2);
  eq('afdruk actief = licht', PRINT_PALETTE.baseline, pal.baseline);
  eq('afdruk vergelijking 1 = licht', PRINT_PALETTE.baselineCompare1, pal.baselineCompare1);
  eq('afdruk vergelijking 2 = licht', PRINT_PALETTE.baselineCompare2, pal.baselineCompare2);
  const sets: [string, string[]][] = [
    ['licht', [pal.baseline, pal.baselineCompare2, pal.baselineCompare1]],
    ['donker', [donker['--theme-bar-baseline'], donker['--theme-bar-baseline-compare-2'], donker['--theme-bar-baseline-compare-1']]],
  ];
  for (const [naam, [actief, verg2, verg1]] of sets) {
    ok(`${naam}: drie baselinetinten gezet (${actief}, ${verg2}, ${verg1})`, !!actief && !!verg2 && !!verg1);
    if (!actief || !verg2 || !verg1) continue;
    const [la, l2, l1] = [lStar(actief), lStar(verg2), lStar(verg1)];
    ok(`${naam}: actief ${actief} (L* ${la.toFixed(1)}) + ${MIN_STAP_L} <= vergelijking 2 ${verg2} (L* ${l2.toFixed(1)})`, la + MIN_STAP_L <= l2);
    ok(`${naam}: vergelijking 2 (L* ${l2.toFixed(1)}) + ${MIN_STAP_L} <= vergelijking 1 ${verg1} (L* ${l1.toFixed(1)})`, l2 + MIN_STAP_L <= l1);
  }
}

if (diffs.length === 0) {
  console.log(`OK  theme-bar-contrast: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  theme-bar-contrast: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
