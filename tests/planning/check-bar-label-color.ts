const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import {
  barLabelColor,
  contrastRatio,
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

const DARK_RGB: [number, number, number] = [17, 24, 39];
const LIGHT_RGB: [number, number, number] = [255, 255, 255];

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

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

const BALKTINTEN: [string, string][] = [
  ['kritiek', '#DC2626'],
  ['normaal', '#2563EB'],
  ['mijlpaal', '#7C3AED'],
  ['baseline', '#1F2937'],
];
for (const [naam, hex] of BALKTINTEN) {
  expectLabel(`balktint ${naam}`, hex, BAR_LABEL_LIGHT, 4.5);
}

const FLOATTINTEN: [string, string][] = [
  ['float donker thema', '#10B981'],
  ['float licht thema', '#059669'],
];
for (const [naam, hex] of FLOATTINTEN) {
  expectLabel(`balktint ${naam}`, hex, BAR_LABEL_DARK, 4.5);
}

const ZWARTE_VLAKKEN: [string, string][] = [
  ['nearCritical', '#F59E0B'],
  ['ghost', '#94A3B8'],
  ['tracePredDriving', '#D97706'],
  ['traceSucc', '#A78BFA'],
  ['float-pad cyaan', '#0891B2'],
  ['float-pad lime', '#65A30D'],
  ['float-pad oranje', '#EA580C'],
  ['float-pad teal', '#0D9488'],
];
for (const [naam, hex] of ZWARTE_VLAKKEN) {
  expectLabel(`balkvlak ${naam}`, hex, BAR_LABEL_DARK, 4.5);
}

expectLabel('balkvlak hammock', '#0E7490', BAR_LABEL_LIGHT, 4.5);
expectLabel('balkvlak traceSuccDriving', '#7C3AED', BAR_LABEL_LIGHT, 4.5);

eq('onparseerbare rgba() ⇒ wit', barLabelColor('rgba(1,2,3,0.5)'), BAR_LABEL_LIGHT);
eq('CSS-var ⇒ wit', barLabelColor('var(--theme-accent)'), BAR_LABEL_LIGHT);

if (diffs.length === 0) {
  console.log(`OK  bar-label-color: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  bar-label-color: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
