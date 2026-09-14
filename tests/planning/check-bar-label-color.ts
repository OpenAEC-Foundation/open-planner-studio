// U2 — labelkleur op de taakbalk.
//
// Het balklabel was hardgecodeerd wit. Met ÉÉN balkpalet voor licht én donker kan dat niet: om
// 4,5:1 met wit te halen moet de balkluminantie laag blijven, terwijl >=3:1 tegen de donkere kaart
// juist een lichtere balk eist. `barLabelColor` kiest daarom per vlak zwart of wit, op de gemeten
// WCAG-contrastverhouding — en `compositeOver` lost de half-transparante voortgangslaag eerst op
// tot een echte hex, zodat de keuze het vlak ziet dat de gebruiker ONDER de tekst ziet.
//
// Deze check pint de UITKOMST per vlak (niet de formule): zwart op de zes balktinten, wit op de
// donkere kritieke voortgangsvulling en op de 25%-zwart-overlay van elke balktint. `contrastRatio`
// wordt daarbij gebruikt als onafhankelijke meting: de gekozen kleur moet aantoonbaar de hoogste
// verhouding halen van de twee kandidaten, en minimaal 3:1 (grote/vette tekst, WCAG AA).
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import {
  barLabelColor,
  contrastRatio,
  compositeOver,
  BAR_LABEL_DARK,
  BAR_LABEL_LIGHT,
} from '@/engine/renderer/themePalette';

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

const DARK_RGB: [number, number, number] = [17, 24, 39]; // BAR_LABEL_DARK
const LIGHT_RGB: [number, number, number] = [255, 255, 255];

/** Eigen hex-ontleding — bewust NIET de (private) helper uit themePalette, zodat deze check een
 *  onafhankelijke meting doet en niet dezelfde bug tweemaal zou herhalen. */
function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Controleert dat `barLabelColor(vlak)` de verwachte kleur geeft ÉN dat die keuze de hoogste
 *  gemeten contrastverhouding heeft, met minimaal `minRatio`. */
function expectLabel(label: string, vlak: string, verwacht: string, minRatio: number): void {
  eq(`${label} (${vlak}) ⇒ ${verwacht === BAR_LABEL_DARK ? 'zwart' : 'wit'}`, barLabelColor(vlak), verwacht);
  const rgb = rgbOf(vlak);
  const dark = contrastRatio(rgb, DARK_RGB);
  const light = contrastRatio(rgb, LIGHT_RGB);
  const gekozen = verwacht === BAR_LABEL_DARK ? dark : light;
  const andere = verwacht === BAR_LABEL_DARK ? light : dark;
  ok(`${label} (${vlak}): gekozen kleur heeft het hoogste contrast (${gekozen.toFixed(2)} vs ${andere.toFixed(2)})`, gekozen >= andere);
  ok(`${label} (${vlak}): contrast ${gekozen.toFixed(2)} >= ${minRatio}`, gekozen >= minRatio);
}

// ── De zes balktinten: zwart label ──────────────────────────────────────────
// Exact de hexen uit BRAND/readGanttPalette die als BALKVLAK onder een label kunnen liggen.
const BALKTINTEN: [string, string][] = [
  ['kritiek', '#DA5252'],
  ['normaal', '#648BE0'],
  ['voltooid/normalLight', '#5778D6'],
  ['mijlpaal', '#986DE2'],
  ['baseline', '#808694'],
  ['float', '#1E976F'],
];
for (const [naam, hex] of BALKTINTEN) {
  expectLabel(`balktint ${naam}`, hex, BAR_LABEL_DARK, 4.2);
}

// ── De donkere kritieke voortgangsvulling: wit label ────────────────────────
expectLabel('voortgangsvulling kritiek', '#991B1B', BAR_LABEL_LIGHT, 4.5);

// ── De 25%-zwart-overlay (modi/trace-tint): wit label op elke balktint ──────
// In de kleurmodi en bij een trace-tint is de voortgangsvulling geen eigen hex maar
// `rgba(0, 0, 0, 0.25)` over de balkkleur — precies de string die GanttRenderer gebruikt.
const OVERLAY = 'rgba(0, 0, 0, 0.25)';
for (const [naam, hex] of BALKTINTEN) {
  const vlak = compositeOver(OVERLAY, hex);
  ok(`overlay op ${naam}: compositeOver geeft een echte hex`, /^#[0-9a-f]{6}$/i.test(vlak));
  ok(`overlay op ${naam} is donkerder dan de balk zelf`, rgbOf(vlak).every((c, i) => c <= rgbOf(hex)[i]));
  expectLabel(`25%-zwart-overlay op ${naam}`, vlak, BAR_LABEL_LIGHT, 3);
}

// ── Randgeval: onparseerbare invoer valt terug op wit (het vroegere gedrag) ──
eq('onparseerbare rgba() ⇒ wit', barLabelColor('rgba(1,2,3,0.5)'), BAR_LABEL_LIGHT);
eq('CSS-var ⇒ wit', barLabelColor('var(--theme-accent)'), BAR_LABEL_LIGHT);

// ── Uitslag ─────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  bar-label-color: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  bar-label-color: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
