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
//   3. de taakbalk leidt vulling, rand en voortgang af met `barTones`; ook op de tinten die een
//      thema zelf zet blijven vulling en rand/voortgang onderling te onderscheiden.
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { readGanttPalette, contrastRatio, barTones } from '@/engine/renderer/themePalette';
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

/** Ondergrens vulling↔rand/voortgang van `barTones` op een themetint (zie check-bar-tones). */
const BAR_TONE_MIN_CONTRAST = 2.5;

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

  // De taakbalk tekent een lichte vulling met donkere rand en voortgang uit elke tint; die twee
  // moeten ook op de thema-eigen tinten uit elkaar te houden zijn, anders is voortgang onzichtbaar.
  for (const v of ['--theme-bar-critical', '--theme-bar-normal'] as const) {
    if (!vars[v]) continue;
    const t = barTones(vars[v]);
    const c = contrastRatio(rgbOf(t.fill), rgbOf(t.outline));
    ok(`${selector} ${v}: vulling ${t.fill} vs rand/voortgang ${t.outline} ${c.toFixed(2)} >= ${BAR_TONE_MIN_CONTRAST}`,
      c >= BAR_TONE_MIN_CONTRAST);
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
