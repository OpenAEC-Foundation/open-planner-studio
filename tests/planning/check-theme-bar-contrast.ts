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

import { readGanttPalette, contrastRatio, doneBarTones } from '@/engine/renderer/themePalette';
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
  eq('fallback baseline', p.baseline, '#6B7280');
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
for (const selector of ['[data-theme="light"]', '[data-theme="dark"]']) {
  const vars = themeBlock(selector);
  const gezet = BALK_VARS.filter(v => vars[v] !== undefined);
  ok(`${selector} laat de balktinten aan BRAND over (kreeg ${gezet.join(', ') || 'geen'})`, gezet.length === 0);
}

if (diffs.length === 0) {
  console.log(`OK  theme-bar-contrast: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  theme-bar-contrast: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
