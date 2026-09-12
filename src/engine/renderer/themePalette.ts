// Centraal themapalet voor de tekenlaag (fase 2.7/2.9, audit C5/P17). Vroeger las ELKE renderer
// (GanttRenderer/HistogramRenderer/MiniMapRenderer) zélf de CSS-thema-variabelen via
// getComputedStyle én droeg elk zijn eigen kopie van de merk-hex-tabel — half DOM-read, half
// hardcoded hex, met "gelijk aan GanttRenderer"-commentaar als enige koppeling. Dat staat nu op één
// plek:
//   - de merk-hex-constanten (kritiek-rood, normaal-blauw, …) staan één keer in `BRAND`;
//   - readGanttPalette/readHistogramPalette/readMiniMapPalette lezen de CSS-vars (met per-renderer
//     fallback, EXACT zoals voorheen) en stellen het palet samen;
//   - PRINT_PALETTE is de parallelle, DOM-loze print-tabel. Die loopt sinds de U2-fixronde NIET
//     met `BRAND` mee: papier is wit, dus het printpalet houdt de verzadigde merkhexen (zie de
//     toelichting bij PRINT_PALETTE zelf).
// De renderers krijgen hun palet via de constructor-opts geïnjecteerd; ontbreekt dat, dan roepen ze
// zelf de bijbehorende read*-functie aan (identiek lees-moment/-resultaat als vroeger). Zo wordt de
// renderer puur/headless-testbaar terwijl de GETEKENDE kleuren byte-identiek blijven.
//
// LET OP: de exacte casing van elke hex is load-bearing — de teken-aanroepen geven de string
// letterlijk aan `fillStyle`/`strokeStyle` door. Waarden die vroeger in verschillende casing stonden
// (bv. Gantt `#991B1B` vs print `#991b1b`) blijven daarom apart en worden NIET samengevoegd.

/** Leest een CSS-custom-property van het document-element, met fallback als de var leeg is.
 *  Exact het `getComputedStyle(...).getPropertyValue(...).trim() || fallback`-patroon dat elke
 *  renderer eerder inline had. */
function cssVarReader(): (name: string, fallback: string) => string {
  const s = getComputedStyle(document.documentElement);
  return (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
}

// ── Merk-hex: de vaste, niet-thema-gebonden kleuren, één keer gedefinieerd. ──
export const GANTT_TRACE_COLORS = {
  predecessor: '#F59E0B',        // path tracing: voorganger (goud)
  predecessorDriving: '#D97706', // path tracing: driving voorganger (donkerder goud)
  successor: '#A78BFA',          // path tracing: opvolger (paars)
  successorDriving: '#7C3AED',   // path tracing: driving opvolger (donkerder paars)
} as const;

const BRAND = {
  critical: '#DA5252',          // kritiek (rood) — U2: >=3:1 op lichte EN donkere kaart
  criticalLight: '#991B1B',     // voortgangsvulling kritiek
  nearCritical: '#F59E0B',      // bijna-kritiek (amber, fase 2.9 §5.4)
  hammock: '#0E7490',           // hammock/LOE-balk (teal, fase 2.9 §5.3)
  normal: '#648BE0',            // normale taak (blauw) — U2: >=3:1 op lichte EN donkere kaart
  normalLight: '#5778D6',       // voortgangsvulling / voltooid (blauw) — U2
  milestone: '#986DE2',         // mijlpaal (paars, ruit) — U2
  baseline: '#808694',          // baseline-onderbalk (grijs) — U2
  dependency: '#6B7280',        // afhankelijkheidspijl (grijs)
  summary: '#475569',           // samenvattingsbalk (slate)
  ghost: '#94A3B8',             // externe (cross-project) ghost-balk (grijs, fase 2.9 §5.5)
  constraintEarly: '#3B82F6',   // vroege-zijde constraint (SNET/FNET): blauw
  constraintLate: '#8B5CF6',    // late-zijde/pinnende constraint (SNLT/FNLT/MSO/MFO): violet
  deadlineOk: '#10B981',        // deadline-marker (groen; rood bij overschrijding)
  tracePred: GANTT_TRACE_COLORS.predecessor,
  tracePredDriving: GANTT_TRACE_COLORS.predecessorDriving,
  traceSucc: GANTT_TRACE_COLORS.successor,
  traceSuccDriving: GANTT_TRACE_COLORS.successorDriving,
};

// Optionele tint per float-pad (fase 2.9 §5.4): pad 1 = kritiek (rood, elders), paden ≥2 elk een
// eigen tint. [0]/[1] hergebruiken de merk-blauw/-violet — byte-identiek aan de vroegere literalen.
const FLOAT_PATH_TINTS: string[] = [
  BRAND.normal, BRAND.milestone, '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#0D9488', '#9333EA',
];

// ── Labelkleur op een gekleurd vlak (U2-fixronde) ────────────────────────────
// Het balklabel was hardgecodeerd wit. Met ÉÉN balkpalet voor licht én donker is wit aantoonbaar
// niet houdbaar: om 4,5:1 met wit te halen moet de balkluminantie <= 0,183 blijven, terwijl >=3:1
// tegen de donkere kaart (#2E3239) juist >= 0,195 eist — die twee eisen sluiten elkaar uit. De
// uitweg is niet een donkerder palet maar een labelkleur die de BALK volgt.
//
// `barLabelColor` kiest per vlak de beste van twee: bijna-zwart (#111827, hetzelfde als
// PRINT_PALETTE.text) of wit. Gemeten (WCAG 2.x), zwart-label / wit-label:
//   critical   #DA5252  4,49 / 3,95  ⇒ zwart
//   normal     #648BE0  5,33 / 3,33  ⇒ zwart
//   complete   #5778D6  4,28 / 4,15  ⇒ zwart
//   milestone  #986DE2  4,75 / 3,74  ⇒ zwart
//   baseline   #808694  4,86 / 3,65  ⇒ zwart
//   float      #1E976F  4,82 / 3,68  ⇒ zwart
// en juist WIT op de donkere voortgangsvullingen, waar het label vaak op begint:
//   criticalLight #991B1B  2,13 / 8,31                       ⇒ wit
//   moduskleur + 25% zwart (de rgba-overlay), bv. normal      2,70-3,26 / 5,45-6,56 ⇒ wit
// Vier van de zes tinten halen met zwart >= 4,5:1 (AA voor normale tekst), de overige twee >= 4,2:1
// op 10 px vetgedrukt-equivalent; met wit haalde GEEN van de zes 4,5:1 en drie bleven onder 3,7:1.

/** sRGB-hex ⇒ [r,g,b] (0-255). Accepteert `#rgb` en `#rrggbb`. */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** WCAG 2.x relatieve luminantie van een sRGB-kleur. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG-contrastverhouding tussen twee sRGB-kleuren (>= 1). */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Donker labelalternatief — dezelfde bijna-zwart als `PRINT_PALETTE.text`. */
export const BAR_LABEL_DARK = '#111827';
/** Licht labelalternatief. */
export const BAR_LABEL_LIGHT = '#ffffff';

/**
 * Componeert `top` over `base` (beide `#rrggbb`, of `top` als `rgba(r, g, b, a)`), zodat de
 * labelkeuze de kleur ziet die de gebruiker ECHT onder de tekst ziet — de voortgangsvulling is in
 * de kleurmodi een half-transparante zwarte laag over de balkkleur, geen eigen hex.
 * Onparseerbare invoer ⇒ `base` ongewijzigd terug (de labelkeuze valt dan op de balkkleur terug).
 */
export function compositeOver(top: string, base: string): string {
  const b = hexToRgb(base);
  if (!b) return base;
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(top.trim());
  let t: [number, number, number] | null = null;
  let alpha = 1;
  if (rgba) {
    t = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  } else {
    t = hexToRgb(top);
  }
  if (!t) return base;
  const mix = (i: number): number => Math.round(t![i] * alpha + b[i] * (1 - alpha));
  const hx = (n: number): string => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${hx(mix(0))}${hx(mix(1))}${hx(mix(2))}`;
}

/**
 * De leesbaarste labelkleur op `barColor`: bijna-zwart of wit, wie van de twee de hoogste
 * WCAG-contrastverhouding haalt. Eén bron voor balklabels, mijlpaallabels-op-vlak en
 * histogramlabels-op-staaf; labels die op de CANVAS-achtergrond staan (het mijlpaalbijschrift
 * naast de ruit, de histogram-rijlabels) horen bij `palette.text`/`textDim` en niet hier.
 * Onparseerbare invoer (een `rgba()`-string, een CSS-var) ⇒ wit, het vroegere gedrag.
 */
export function barLabelColor(barColor: string): string {
  const rgb = hexToRgb(barColor);
  if (!rgb) return BAR_LABEL_LIGHT;
  const dark = contrastRatio(rgb, [17, 24, 39]);
  const light = contrastRatio(rgb, [255, 255, 255]);
  return dark >= light ? BAR_LABEL_DARK : BAR_LABEL_LIGHT;
}

// ── GanttRenderer ────────────────────────────────────────────────────────────
export interface GanttPalette {
  bg: string;
  surface: string;
  grid: string;
  gridWeekend: string;
  /** Om-en-om weekband in de GECOMPRIMEERDE modus (issue #21 punt 2): de achtergrondtint van de
   *  dagkolommen van oneven ISO-weken. Onder compressie bestaan weekendkolommen niet meer, dus de
   *  weekendarcering — de enige visuele weekscheiding — vervalt daar; deze band neemt die rol
   *  over. Aparte var (géén hergebruik van `gridWeekend`): de band bedekt hele weken (5+ kolommen
   *  aaneen) i.p.v. losse dagen en moet dus per thema onafhankelijk subtieler afgesteld kunnen
   *  worden. */
  gridWeekBand: string;
  border: string;
  text: string;
  textSecondary: string;
  critical: string;
  criticalLight: string;
  nearCritical: string;
  hammock: string;
  normal: string;
  normalLight: string;
  milestone: string;
  float: string;
  baseline: string;
  complete: string;
  selected: string;
  dependency: string;
  today: string;
  statusDate: string;
  headerBg: string;
  summary: string;
  ghost: string;
  constraintEarly: string;
  constraintLate: string;
  deadlineOk: string;
  tracePred: string;
  tracePredDriving: string;
  traceSucc: string;
  traceSuccDriving: string;
  /** Tint per float-pad (≥2); pad 1 = kritiek. */
  floatPathTints: string[];
  /** Wit label-tekst op een gekleurde knop/vlak met een vaste donkere achtergrond.
   *  LET OP (U2-fixronde): het TAAKBALK-label gebruikt dit NIET meer — dat kiest per balk zwart of
   *  wit via `barLabelColor`, omdat één balkpalet voor licht én donker geen vaste witte tekst
   *  toelaat. Gebruik dit veld alleen waar de ondergrond gegarandeerd donker is. */
  barText: string;
  /** Tekstkleur ÓP een accent-vlak (`--theme-accent-on`): wit in licht/donker, zwart in
   *  high-contrast. Zelfde paar dat de DOM-chrome al gebruikt voor accentknoppen — de tekenlaag
   *  mag daar geen eigen wit-op-oranje van maken (issue #51). */
  accentOn: string;
}

/** Leest het Gantt-palet uit de CSS-thema-vars (met de vroegere fallbacks) + de merk-hex-tabel. */
export function readGanttPalette(): GanttPalette {
  const v = cssVarReader();
  return {
    // De Gantt leeft in een witte zwevende kaart, dus de canvas-achtergrond leest het kaart-
    // oppervlak (--theme-surface), NIET de werkruimte-tint (--theme-bg).
    bg: v('--theme-surface', '#ffffff'),
    surface: v('--theme-surface-alt', '#F6F8FB'),
    grid: v('--theme-border-light', '#EDF0F5'),
    gridWeekend: v('--theme-grid-weekend', '#EFF2F7'),
    gridWeekBand: v('--theme-grid-week-band', '#F1F4F9'),
    border: v('--theme-border', '#E2E7EE'),
    text: v('--theme-text', '#333845'),
    textSecondary: v('--theme-text-dim', '#5B6472'),
    critical: BRAND.critical,
    criticalLight: BRAND.criticalLight,
    nearCritical: BRAND.nearCritical,
    hammock: BRAND.hammock,
    normal: BRAND.normal,
    normalLight: BRAND.normalLight,
    milestone: BRAND.milestone,
    float: v('--theme-bar-float', '#1E976F'),
    baseline: BRAND.baseline,
    complete: BRAND.normalLight, // '#5778D6', zelfde hex als normalLight
    selected: v('--theme-accent', '#B45309'),
    dependency: BRAND.dependency,
    today: v('--theme-accent', '#B45309'),
    // statusdatum-/voortgangslijn: accent-oranje, zelfde bron als today/selected (fase 2.6)
    statusDate: v('--theme-accent', '#B45309'),
    headerBg: v('--theme-surface-alt', '#F6F8FB'),
    summary: BRAND.summary,
    ghost: BRAND.ghost,
    constraintEarly: BRAND.constraintEarly,
    constraintLate: BRAND.constraintLate,
    deadlineOk: BRAND.deadlineOk,
    tracePred: BRAND.tracePred,
    tracePredDriving: BRAND.tracePredDriving,
    traceSucc: BRAND.traceSucc,
    traceSuccDriving: BRAND.traceSuccDriving,
    floatPathTints: FLOAT_PATH_TINTS,
    barText: '#ffffff',
    accentOn: v('--theme-accent-on', '#ffffff'),
  };
}

// ── HistogramRenderer ──────────────────────────────────────────────────────────
export interface HistogramPalette {
  bg: string;
  surfaceAlt: string;
  grid: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  hover: string;
  active: string;
  barNormal: string;
  barOver: string;
  capacity: string;
}

/** Leest het histogram-palet. De staafkleuren delen de Gantt-merk-hex (normaal-blauw/kritiek-rood).
 *  NB: de `--theme-accent`-fallback is hier `#D97706` (afwijkend van Gantt/MiniMap) — zo gehouden. */
export function readHistogramPalette(): HistogramPalette {
  const v = cssVarReader();
  return {
    bg: v('--theme-surface', '#ffffff'),
    surfaceAlt: v('--theme-surface-alt', '#F6F8FB'),
    grid: v('--theme-border-light', '#EDF0F5'),
    border: v('--theme-border', '#E2E7EE'),
    text: v('--theme-text', '#333845'),
    textDim: v('--theme-text-dim', '#5B6472'),
    accent: v('--theme-accent', '#D97706'),
    hover: v('--theme-hover', 'rgba(0,0,0,0.05)'),
    active: v('--theme-active', 'rgba(0,0,0,0.08)'),
    barNormal: BRAND.normal, // gelijk aan GanttRenderer's "normal" (blauw)
    barOver: BRAND.critical, // gelijk aan GanttRenderer's "critical" (rood)
    capacity: v('--theme-text-dim', '#5B6472'),
  };
}

// ── MiniMapRenderer ──────────────────────────────────────────────────────────
export interface MiniMapPalette {
  bg: string;
  border: string;
  bar: string;
  critical: string;
  frame: string;
}

/** Leest het mini-map-palet (thumbnail-strip). Staaf-/kritiek-kleur delen de Gantt-merk-hex. */
export function readMiniMapPalette(): MiniMapPalette {
  const v = cssVarReader();
  return {
    bg: v('--theme-surface-alt', '#F6F8FB'),
    border: v('--theme-border', '#E2E7EE'),
    bar: BRAND.normal,
    critical: BRAND.critical,
    frame: v('--theme-accent', '#B45309'),
  };
}

// ── Print (printPreview.ts) ────────────────────────────────────────────────────
// Print-vriendelijk schema, DOM-loos (papier-witte achtergrond, donkere greys). Kritiek/normaal/
// mijlpaal/samenvatting delen de merk-hex; de print-specifieke greys/tinten blijven literalen. De
// *Dark-varianten staan bewust in lowercase (vroegere print-casing) en delen dus NIET met de
// uppercase Gantt-varianten.
export const PRINT_PALETTE = {
  bg: '#ffffff',
  surface: '#f8f9fa',
  grid: '#e5e7eb',
  gridWeekend: '#f0f1f3',
  // Weekbanden horen alleen op de gecomprimeerde werkdagen-as: daar bestaan geen weekendkolommen
  // meer om de weekgrens te lezen. Lichter dan `gridWeekend`, omdat een heel weekvlak rustiger
  // moet blijven dan twee losse vrije dagen (issue #21 punt 2).
  gridWeekBand: '#f1f4f9',
  gridHoliday: '#fef3c7',
  border: '#d1d5db',
  borderDark: '#9ca3af',
  text: '#111827',
  textSecondary: '#6b7280',
  // U2-fixronde — het printpalet loopt BEWUST niet met `BRAND` mee. De U2-balkkleuren zijn één
  // stap ontzadigd omdat ze >=3:1 moeten halen tegen ZOWEL de lichte als de donkere kaart; papier
  // is altijd wit, dus die tweede eis bestaat hier niet. Op wit halen de verzadigde merkhexen meer
  // contrast (kritiek #DC2626 5,9:1 vs #DA5252 3,9:1; normaal #2563EB 5,2:1 vs #648BE0 3,3:1) en
  // ze drukken ook betrouwbaarder af — een ontzadigde tint verdwijnt sneller in grijstinten.
  // Daarom staan hieronder de OUDE, verzadigde waarden als eigen literalen.
  critical: '#DC2626',
  criticalDark: '#991b1b',
  // Bijna-kritiek (#21 kleurmodi): de print tekende bijna-kritiek nooit zelf (critical/normal
  // waren de enige balkkleuren); de 'critical'-kleurmodus deelt die keuze nu met barColors.
  nearCritical: BRAND.nearCritical, // '#F59E0B'
  normal: '#2563EB',
  normalDark: '#1d4ed8',
  milestone: '#7C3AED',
  baseline: '#6B7280',
  uncategorized: BRAND.ghost, // '#94A3B8' — ontbrekende categoriewaarde
  float: '#10B981',
  dependency: '#9CA3AF',
  today: '#F59E0B',
  headerBg: '#f1f5f9',
  summary: '#7C3AED',         // print-samenvatting is violet (zelfde hex als print-mijlpaal)
  rowEven: '#f9fafb',
  rowOdd: '#ffffff',
};
