// Labelkleur op de taakbalk.
//
// Het balklabel was ooit hardgecodeerd wit. Dat is niet houdbaar zodra de balkkleur uit projectdata
// komt: in de kleurmodi (`auto`, resource- en categoriekleuring) kiest de gebruiker zijn eigen
// tinten, en op een lichte eigen kleur is wit onleesbaar. `barLabelColor` kiest daarom per vlak
// zwart of wit, op de gemeten WCAG-contrastverhouding — en `compositeOver` lost de half-
// transparante voortgangslaag eerst op tot een echte hex, zodat de keuze het vlak ziet dat de
// gebruiker ONDER de tekst ziet.
//
// Sinds het kleurherstel van 18-09-2026 (verzadigde merktinten terug op de balken) wint WIT op de
// VIJF STANDAARD-balktinten — het beeld van vóór werkblok U2 dus, maar nu gemeten in plaats van
// aangenomen. "Alle balktinten" zou onjuist zijn: nearCritical, ghost en de trace-/float-pad-tinten
// liggen ook onder een label en kiezen juist zwart. Die staan hieronder apart gepind, want dat
// gedrag is even belangrijk om te bewaken als het witte geval.
// Deze check pint de uitkomst per vlak (niet de formule): wit op de vijf standaardtinten, wit op de
// donkere kritieke voortgangsvulling en op de 25%-zwart-overlay, zwart op de spelinggroenen en op de
// lichte niet-standaardtinten. `contrastRatio` wordt daarbij gebruikt als onafhankelijke meting: de
// gekozen kleur moet aantoonbaar de hoogste verhouding halen van de twee kandidaten, en minimaal
// 3:1 (grote/vette tekst, WCAG AA).
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

// ── De vijf balktinten: wit label ───────────────────────────────────────────
// Exact de hexen uit BRAND/readGanttPalette die als BALKVLAK onder een label kunnen liggen.
const BALKTINTEN: [string, string][] = [
  ['kritiek', '#DC2626'],
  ['normaal', '#2563EB'],
  ['voltooid/normalLight', '#1D4ED8'],
  ['mijlpaal', '#7C3AED'],
  ['baseline', '#6B7280'],
];
for (const [naam, hex] of BALKTINTEN) {
  expectLabel(`balktint ${naam}`, hex, BAR_LABEL_LIGHT, 4.5);
}

// ── De speling: zwart label ─────────────────────────────────────────────────
// De spelingband draagt zelf GEEN label; hij wordt getekend als `colors.float + '99'` en er komt
// nooit tekst overheen. Hij staat hier puur als functiedekking: het is wel een tint uit hetzelfde
// palet, en de enige die per thema verschilt (`--theme-bar-float`). Beide waarden gepind, zodat een
// toekomstige groentint die naar wit-label zou kantelen hier opvalt.
const FLOATTINTEN: [string, string][] = [
  ['float donker thema', '#10B981'],
  ['float licht thema', '#059669'],
];
for (const [naam, hex] of FLOATTINTEN) {
  expectLabel(`balktint ${naam}`, hex, BAR_LABEL_DARK, 4.5);
}

// ── De niet-standaard balkvlakken: ook zwart ────────────────────────────────
// Deze liggen wél echt onder een balklabel — via `barColor()` (nearCritical, ghost, hammock) of via
// `overrideColor` (path-tracing) of de float-pad-tinten. Ze zijn licht genoeg dat zwart wint, en dat
// is de bedoeling: wit haalt op #F59E0B maar 2,15. Gepind zodat "wit is het oude beeld" hier nooit
// stilzwijgend weer wordt ingevoerd.
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

// En de twee niet-standaardvlakken waar wit juist wél wint — anders leest de lijst hierboven als
// "alles buiten de vijf is zwart", en dat is het niet.
expectLabel('balkvlak hammock', '#0E7490', BAR_LABEL_LIGHT, 4.5);
expectLabel('balkvlak traceSuccDriving', '#7C3AED', BAR_LABEL_LIGHT, 4.5);

// ── De donkere kritieke voortgangsvulling: wit label ────────────────────────
expectLabel('voortgangsvulling kritiek', '#991B1B', BAR_LABEL_LIGHT, 4.5);

// ── De 25%-zwart-overlay (modi/trace-tint): wit label op elke balktint ──────
// In de kleurmodi en bij een trace-tint is de voortgangsvulling geen eigen hex maar
// `rgba(0, 0, 0, 0.25)` over de balkkleur — precies de string die GanttRenderer gebruikt.
const OVERLAY = 'rgba(0, 0, 0, 0.25)';
for (const [naam, hex] of [...BALKTINTEN, ...FLOATTINTEN]) {
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
