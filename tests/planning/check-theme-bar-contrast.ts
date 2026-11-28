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

{
  const p = readGanttPalette();
  eq('fallback critical', p.critical, '#DC2626');
  eq('fallback normal', p.normal, '#2563EB');
  eq('fallback milestone', p.milestone, '#7C3AED');
  eq('fallback baseline', p.baseline, '#1F2937');
}

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/styles/globals.css');
const css = readFileSync(cssPath, 'utf8');

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

const DONE_MIN_CONTRAST = 3;

const THEMAS: { selector: string; kaart: string; lat: number; moetZetten: boolean }[] = [
  { selector: '[data-theme="high-contrast"] {', kaart: '#0a0a0a', lat: 7, moetZetten: true },
  { selector: '[data-oa-theme="light"] {', kaart: '#FFFFFF', lat: 3, moetZetten: false },
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

  for (const v of ['--theme-bar-critical', '--theme-bar-normal'] as const) {
    if (!vars[v]) continue;
    const grey = doneBarTones(vars[v], false).fill;
    const c = contrastRatio(rgbOf(grey), rgbOf(kaart));
    ok(`${selector} ${v}: grijs voltooid deel ${grey} haalt ${c.toFixed(2)} >= ${DONE_MIN_CONTRAST} op ${kaart}`,
      c >= DONE_MIN_CONTRAST);
  }
}

{
  const pal = readGanttPalette();
  for (const base of [pal.critical, pal.normal]) {
    const grey = doneBarTones(base, true).fill;
    const c = contrastRatio(rgbOf(grey), rgbOf('#2A2A32'));
    ok(`[data-oa-theme="dark"] grijs voltooid deel ${grey} haalt ${c.toFixed(2)} >= 1.5 op #2A2A32`, c >= 1.5);
  }
}

const MAG_ZETTEN: Record<string, readonly string[]> = {
  '[data-oa-theme="light"] {': ['--theme-bar-baseline'],
  '[data-oa-theme="dark"] {': ['--theme-bar-baseline'],
};
for (const [selector, mag] of Object.entries(MAG_ZETTEN)) {
  const vars = themeBlock(selector);
  const gezet = BALK_VARS.filter(v => vars[v] !== undefined && !mag.includes(v));
  ok(`${selector} laat de balktinten aan BRAND over (kreeg ${gezet.join(', ') || 'geen'})`, gezet.length === 0);
}

const MIN_STAP_L = 10;
const lStar = (hex: string): number => {
  const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgbOf(hex);
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : y * 24389 / 27;
};
{
  const pal = readGanttPalette();
  const donker = themeBlock('[data-oa-theme="dark"] {');
  const lichtEigen = themeBlock('[data-oa-theme="light"] {');
  const licht = (v: string): string | undefined => lichtEigen[v] ?? donker[v];
  ok('donker blok is ook :root', /:root,\s*\[data-oa-theme="dark"\]\s*\{/.test(css));
  const lichtSet = [licht('--theme-bar-baseline'), licht('--theme-bar-baseline-compare-2'), licht('--theme-bar-baseline-compare-1')];
  eq('licht actief = fallback', lichtSet[0], pal.baseline);
  eq('licht vergelijking 2 = fallback', lichtSet[1], pal.baselineCompare2);
  eq('licht vergelijking 1 = fallback', lichtSet[2], pal.baselineCompare1);
  eq('afdruk actief = fallback', PRINT_PALETTE.baseline, pal.baseline);
  eq('afdruk vergelijking 1 = fallback', PRINT_PALETTE.baselineCompare1, pal.baselineCompare1);
  eq('afdruk vergelijking 2 = fallback', PRINT_PALETTE.baselineCompare2, pal.baselineCompare2);
  const hoogEigen = themeBlock('[data-theme="high-contrast"] {');
  const hoog = (v: string): string | undefined => hoogEigen[v] ?? donker[v];
  const sets: [string, string, string | undefined, string | undefined, string | undefined][] = [
    ['licht', '#FFFFFF', ...lichtSet] as [string, string, string | undefined, string | undefined, string | undefined],
    ['donker', '#2A2A32', donker['--theme-bar-baseline'], donker['--theme-bar-baseline-compare-2'], donker['--theme-bar-baseline-compare-1']],
    ['hoog contrast', '#0a0a0a', hoog('--theme-bar-baseline'), hoog('--theme-bar-baseline-compare-2'), hoog('--theme-bar-baseline-compare-1')],
  ];
  const MAX_L_DONKER_ACTIEF = 90;
  {
    const a = donker['--theme-bar-baseline'];
    ok(`donker: actieve baseline ${a} (L* ${a ? lStar(a).toFixed(1) : '?'}) is niet feller dan L* ${MAX_L_DONKER_ACTIEF}`,
      !!a && lStar(a) <= MAX_L_DONKER_ACTIEF);
  }
  for (const [naam, kaart, actief, verg2, verg1] of sets) {
    ok(`${naam}: drie baselinetinten gezet (${actief}, ${verg2}, ${verg1})`, !!actief && !!verg2 && !!verg1);
    if (!actief || !verg2 || !verg1) continue;
    const [lk, la, l2, l1] = [lStar(kaart), lStar(actief), lStar(verg2), lStar(verg1)];
    const richting = lk >= 50 ? 1 : -1;
    const woord = richting === 1 ? 'lichter' : 'donkerder';
    ok(`${naam}: vergelijking 2 ${verg2} (L* ${l2.toFixed(1)}) is minstens ${MIN_STAP_L} ${woord} dan actief ${actief} (L* ${la.toFixed(1)})`,
      richting * (l2 - la) >= MIN_STAP_L);
    ok(`${naam}: vergelijking 1 ${verg1} (L* ${l1.toFixed(1)}) is minstens ${MIN_STAP_L} ${woord} dan vergelijking 2 (L* ${l2.toFixed(1)})`,
      richting * (l1 - l2) >= MIN_STAP_L);
    ok(`${naam}: actief ligt het verst van de kaart ${kaart} (L* ${lk.toFixed(1)}): ${Math.abs(la - lk).toFixed(1)} tegen ${Math.abs(l2 - lk).toFixed(1)} en ${Math.abs(l1 - lk).toFixed(1)}`,
      Math.abs(la - lk) > Math.abs(l2 - lk) && Math.abs(la - lk) > Math.abs(l1 - lk));
    const lat = naam === 'hoog contrast' ? 7 : 3;
    for (const [rol, hex] of [['actief', actief], ['vergelijking 2', verg2], ['vergelijking 1', verg1]] as const) {
      const c = contrastRatio(rgbOf(hex), rgbOf(kaart));
      ok(`${naam}: ${rol} ${hex} haalt ${c.toFixed(2)} >= ${lat} op ${kaart}`, c >= lat);
    }
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
