// Contrastpoort voor de thema's (huisstijl fase B). Regel van de eigenaar (2026-10-29): geen enkel
// kleurpaar wordt slechter dan op main. Deze check rekent elk paar uit zoals de app het tekent en
// toetst het aan een drempel in `theme-contrast-thresholds.json`: de waarde op main, of een waarde
// die de eigenaar bewust aanvaardt (veld `reden`). Zo kan een latere update van de OpenAEC-tokens
// (`scripts/style-tokens.py --tag …`) geen contrast stil verlagen.
//
// Hoe: de check leest `src/styles/openaec-tokens.css` en de themablokken uit `globals.css`, legt ze
// in cascadevolgorde op elkaar per thema, lost `var()` op en geeft de uitkomst aan het echte
// `readGanttPalette` (via de getComputedStyle-stub). Contrast is WCAG 2.x; een halfdoorzichtige
// kleur wordt eerst op zijn ondergrond gemengd. Op 2026-10-29 gaf een meting in de browser
// (getComputedStyle en het echte `readGanttPalette` in de draaiende app) dezelfde 226 getallen;
// `tests/browser/theme-render.spec.ts` bewaakt dat de cascade in de browser zo uitvalt.
import './domStub';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { barLabelColor, doneBarTones, readGanttPalette } from '@/engine/renderer/themePalette';

// Gebundeld draait dit vanuit een tijdelijke map; de checks starten in de repo-root (run.sh).
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const tokensCss = read('src/styles/openaec-tokens.css');
const globalsCss = read('src/styles/globals.css');

interface Threshold { theme: string; group: string; name: string; min: number; reden?: string }
const THRESHOLDS: Threshold[] = JSON.parse(read('tests/planning/theme-contrast-thresholds.json'));

let failures = 0;
let checks = 0;
const fail = (msg: string) => { failures++; console.log(`XX ${msg}`); };

// ── CSS: blokken op selector, in bronvolgorde ─────────────────────────────────────────────────
/** Alle custom properties uit het eerste blok waarvan de selectorlijst precies `selector` is. */
function block(css: string, selector: string): Record<string, string> {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
    if (sel !== selector) continue;
    const out: Record<string, string> = {};
    const body = m[2].replace(/\/\*[\s\S]*?\*\//g, '');
    for (const d of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
    return out;
  }
  fail(`selector niet gevonden: ${selector}`);
  return {};
}

function themeVars(theme: 'light' | 'dark' | 'high-contrast'): Record<string, string> {
  const oa = theme === 'high-contrast' ? 'high-contrast-dark' : theme;
  const layers = [
    block(tokensCss, ':root'),
    block(tokensCss, ':root, [data-oa-theme="light"]'),
    ...(oa === 'light' ? [] : [block(tokensCss, `[data-oa-theme="${oa}"]`)]),
    block(globalsCss, ':root, [data-oa-theme="dark"]'),
    ...(theme === 'light' ? [block(globalsCss, '[data-oa-theme="light"]')] : []),
    ...(theme === 'high-contrast' ? [block(globalsCss, '[data-theme="high-contrast"]')] : []),
  ];
  const raw: Record<string, string> = Object.assign({}, ...layers);
  const resolveVar = (value: string, depth = 0): string =>
    depth > 10 ? value : value.replace(/var\((--[a-z0-9-]+)(?:,\s*([^)]+))?\)/g, (_m, name: string, fb?: string) =>
      resolveVar(raw[name] ?? fb ?? '', depth + 1));
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, resolveVar(v)]));
}

// ── Kleur en contrast ────────────────────────────────────────────────────────────────────────
type RGBA = [number, number, number, number];
function parse(color: string): RGBA {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map(x => x + x).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
  throw new Error(`kleur niet te lezen: ${color}`);
}
/** Mengt een (halfdoorzichtige) kleur op een dichte ondergrond, afgerond op hele kanaalwaarden
 *  zoals de browser het tekent. */
function over(fg: string, bg: string): string {
  const f = parse(fg), b = parse(bg);
  const mix = [0, 1, 2].map(i => Math.round(f[i] * f[3] + b[i] * (1 - f[3])));
  return '#' + mix.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function lum(color: string): number {
  const [r, g, b] = parse(color);
  const c = [r, g, b].map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(fg: string, bg: string): number {
  const b = over(bg, '#000000');
  const f = over(fg, b);
  const [l1, l2] = [lum(f), lum(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

// ── De paren (dezelfde lijst als de browsermeting in de PR) ──────────────────────────────────
function pairs(theme: 'light' | 'dark' | 'high-contrast'): Map<string, number> {
  const v = themeVars(theme);
  const g0 = globalThis as unknown as { getComputedStyle: unknown };
  const prev = g0.getComputedStyle;
  g0.getComputedStyle = () => ({ getPropertyValue: (n: string) => v[n] ?? '' });
  const g = readGanttPalette();
  g0.getComputedStyle = prev;
  const dark = theme === 'dark';
  const out = new Map<string, number>();
  const add = (group: string, name: string, fg: string, bg: string) => out.set(`${group}|${name}`, ratio(fg, bg));
  const C = 'Gantt';
  for (const k of ['critical', 'normal', 'milestone', 'summary', 'baseline', 'float', 'nearCritical', 'hammock', 'ghost',
    'dependency', 'constraintEarly', 'constraintLate', 'deadlineOk', 'tracePred', 'tracePredDriving', 'traceSucc',
    'traceSuccDriving'] as const)
    add(C, `${k} op kaart`, g[k], g.bg);
  for (const k of ['critical', 'normal', 'summary'] as const) {
    const t = doneBarTones(g[k], dark);
    add(C, `voltooid deel (${k}) op kaart`, t.fill, g.bg);
    add(C, `tekst op voltooid deel (${k})`, t.text, t.fill);
  }
  for (const k of ['critical', 'normal', 'milestone'] as const) add(C, `balklabel op ${k}`, barLabelColor(g[k]), g[k]);
  add(C, 'tekst naast balk op kaart', g.text, g.bg);
  add(C, 'secundaire tekst op kaart', g.textSecondary, g.bg);
  add(C, 'tekst op weekendband', g.text, over(g.gridWeekend, g.bg));
  add(C, 'rasterlijn op kaart', g.grid, g.bg);
  add(C, 'weekendarcering op kaart', over(g.gridWeekend, g.bg), g.bg);
  add(C, 'weekband op kaart', over(g.gridWeekBand, g.bg), g.bg);
  add(C, 'rand op kaart', g.border, g.bg);
  add(C, 'vandaag-/statusdatumlijn op kaart', g.today, g.bg);
  add(C, 'selectie op kaart', g.selected, g.bg);
  add(C, 'tekst op accent (datumlabel)', g.accentOn, g.today);
  add(C, 'koptekst op tijdschaalkop', g.text, g.headerBg);
  add(C, 'secundaire koptekst op tijdschaalkop', g.textSecondary, g.headerBg);

  const A = 'App';
  const surf: Record<string, string> = {
    kaart: v['--theme-surface'], 'kop/verzonken vlak': v['--theme-surface-alt'], werkruimte: v['--theme-bg'],
    zwevend: v['--theme-surface-elevated'], veld: v['--theme-input-bg'], lint: v['--theme-ribbon-content-bg'],
    titelbalk: v['--theme-titlebar-bg'], dropdown: v['--theme-dropdown-bg'],
  };
  for (const [n, s] of Object.entries(surf)) if (!s.includes('gradient')) add(A, `tekst op ${n}`, v['--theme-text'], s);
  for (const n of ['kaart', 'kop/verzonken vlak', 'werkruimte', 'veld']) add(A, `secundaire tekst op ${n}`, v['--theme-text-dim'], surf[n]);
  for (const n of ['kaart', 'kop/verzonken vlak']) add(A, `gedempte tekst op ${n}`, v['--theme-text-muted'], surf[n]);
  for (const n of ['kaart', 'kop/verzonken vlak']) {
    add(A, `waarschuwing op ${n}`, v['--theme-warning-text'], surf[n]);
    add(A, `kritiek-tekst op ${n}`, v['--theme-critical-text'], surf[n]);
    add(A, `accent als tekst op ${n}`, v['--theme-accent'], surf[n]);
  }
  add(A, 'tekst op accent (knop)', v['--theme-accent-on'], v['--theme-accent']);
  add(A, 'tekst op accent-hover', v['--theme-accent-on'], v['--theme-accent-hover']);
  add(A, 'rand op kaart', v['--theme-border'], surf.kaart);
  add(A, 'rand op werkruimte', v['--theme-border'], surf.werkruimte);
  add(A, 'zachte rand op kaart', v['--theme-border-light'], surf.kaart);
  add(A, 'veldrand op veld', v['--theme-control-border'], surf.veld);
  add(A, 'veldrand op kaart', v['--theme-control-border'], surf.kaart);
  add(A, 'hover op kaart', over(v['--theme-hover'], surf.kaart), surf.kaart);
  add(A, 'hover op kop', over(v['--theme-hover'], surf['kop/verzonken vlak']), surf['kop/verzonken vlak']);
  add(A, 'kaart op werkruimte', surf.kaart, surf.werkruimte);
  add(A, 'kop op kaart', surf['kop/verzonken vlak'], surf.kaart);
  if (!surf.titelbalk.includes('gradient') && !v['--theme-ribbon-tab-bg'].includes('gradient'))
    add(A, 'titelbalk tegen linttabs', surf.titelbalk, v['--theme-ribbon-tab-bg']);
  add(A, 'scrollbalk op spoor', v['--theme-scrollbar-thumb'], v['--theme-scrollbar-track']);
  for (const n of ['--relation-predecessor', '--relation-predecessor-driving', '--relation-successor', '--relation-successor-driving'])
    add(A, `${n.slice(2)} op kaart`, v[n], surf.kaart);
  add(A, 'mijlpaaltekst raster op kaart', v['--theme-grid-milestone-text'], surf.kaart);
  return out;
}

const measured = {
  light: pairs('light'),
  dark: pairs('dark'),
  'high-contrast': pairs('high-contrast'),
};

for (const t of THRESHOLDS) {
  checks++;
  const got = measured[t.theme as keyof typeof measured]?.get(`${t.group}|${t.name}`);
  if (got === undefined) { fail(`${t.theme} ${t.group} "${t.name}": paar bestaat niet meer`); continue; }
  if (got < t.min) fail(`${t.theme} ${t.group} "${t.name}": ${got.toFixed(2)} < drempel ${t.min.toFixed(2)}${t.reden ? ` (${t.reden})` : ''}`);
}
// Elk gemeten paar heeft een drempel: een nieuw paar zonder drempel is een vergeten toets.
for (const [theme, m] of Object.entries(measured)) {
  for (const key of m.keys()) {
    checks++;
    const [group, name] = key.split('|');
    if (!THRESHOLDS.some(t => t.theme === theme && t.group === group && t.name === name))
      fail(`${theme} ${group} "${name}": geen drempel in theme-contrast-thresholds.json`);
  }
}

if (process.argv.includes('--dump')) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(measured).map(([k, m]) => [k, Object.fromEntries(m)])), null, 1));
}
if (failures === 0) {
  console.log(`OK  theme-contrast: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  theme-contrast: ${failures} afwijking(en) van ${checks}`);
  process.exit(1);
}
