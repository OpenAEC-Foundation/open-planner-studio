// Centraal themapalet voor de tekenlaag (GanttRenderer/HistogramRenderer/MiniMapRenderer):
//   - de merk-hex-constanten (kritiek-rood, normaal-blauw, …) staan één keer in `BRAND`;
//   - readGanttPalette/readHistogramPalette/readMiniMapPalette lezen de CSS-vars (met per-renderer
//     fallback) en stellen het palet samen;
//   - PRINT_PALETTE is de parallelle, DOM-loze print-tabel. Die loopt NIET met `BRAND` mee, maar
//     houdt eigen literalen: papier is wit en stelt andere eisen dan een scherm met twee thema's
//     (zie de toelichting bij PRINT_PALETTE zelf).
// De renderers krijgen hun palet via de constructor-opts geïnjecteerd; ontbreekt dat, dan roepen ze
// zelf de bijbehorende read*-functie aan. Zo is de renderer puur/headless-testbaar.
//
// LET OP: de exacte casing van elke hex is load-bearing — de teken-aanroepen geven de string
// letterlijk aan `fillStyle`/`strokeStyle` door. Waarden in verschillende casing (bv. Gantt
// `#991B1B` vs print `#991b1b`) blijven daarom apart en worden NIET samengevoegd.

/** Leest een CSS-custom-property van het document-element, met fallback als de var leeg is
 *  (`getComputedStyle(...).getPropertyValue(...).trim() || fallback`). */
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

// De BALKKLEUREN zijn de verzadigde merktinten, en dat is een bewuste keuze. Een ontzadigde set
// die met ÉÉN set >=3:1 haalt tegen zowel de lichte kaart (#FAFAFA) als de donkere (#2E3239) kost
// het merkkarakter (de balken lezen als mat pastel); die contrasteis is voor de balken losgelaten.
// Gemeten (WCAG 2.x), lichte kaart #FAFAFA / donkere kaart #2E3239 / hoog-contrastkaart #0a0a0a:
//   critical  #DC2626  4,63 / 2,67 / 4,10
//   normal    #2563EB  4,95 / 2,49 / 3,83
//   complete  #1D4ED8  6,42 / 1,92 / 2,95
//   milestone #7C3AED  5,46 / 2,26 / 3,47
//   baseline  #6B7280  4,63 / 2,66 / 4,10
// Noem het bij de naam in plaats van het weg te redeneren: op de donkere kaart zakken ze naar
// 1,92-2,67 en in het HOOG-CONTRASTTHEMA zakt `complete` naar 2,95 — dat is formeel non-conform met
// WCAG 1.4.11 (die
// kent geen grootte-uitzondering voor grafische objecten), en in `mode: 'critical'` is de balkkleur
// de enige drager van "kritiek ja/nee", wat ook 1.4.1 raakt. Die afwijking is aanvaard voor licht
// en donker. Wat de afruil dráágt is niet de vlakgrootte — de balk is
// `rowHeight * 0,5`, bij de standaard ROW_HEIGHT 28 dus ~14 px, en in `mode: 'critical'` tekent
// GanttRenderer er GEEN rand omheen (`modeAdvies` is daar `null`) — maar het LABEL: dat haalt via
// `barLabelColor` (hieronder) 4,83-6,70 op elke balktint, en dat is wel gemeten.
// De speling (`float`) is als enige WEL per thema gescheiden gebleven (`--theme-bar-float`): die
// band is halfdoorzichtig en draagt geen label, dus hij moet het puur van zijn ondergrond winnen.
// LET OP 1: deze vijf waarden plus de spelinggroenen staan óók als CSS-var in
// `src/styles/globals.css` (`--color-*` / `--theme-bar-float`). De tekenlaag leest die CSS niet in
// headless tests, dus de twee bronnen moeten met de hand gelijk blijven.
// LET OP 2: `--color-critical` is niet alléén een balkkleur. Tailwind v4 leidt er de utility
// `text-critical` uit af, die als ECHTE TEKST wordt gebruikt in ExtensionConsentDialog,
// BenchmarkDialog en TaskCpmResultSection. Op #DC2626 haalt die tekst 4,83 op wit, maar 2,67 op de
// donkere kaart en 2,33 op een elevated donker vlak — geen AA. Wie dat wil oplossen verplaatst die
// zes gebruiken naar `--theme-critical-text`, dat per thema bestaat en precies hiervoor bedoeld is.
// LET OP 3: enkele tinten vallen samen: `baseline` == `dependency` (#6B7280), en `milestone` ==
// GANTT_TRACE_COLORS.successorDriving (#7C3AED), wat ook DOC_PALETTE[3] in utils/documents.ts is —
// bij 1 op de 8
// documenten valt de mijlpaalmarkering daar samen met de identiteitskleur.
const BRAND = {
  critical: '#DC2626',          // kritiek (rood)
  criticalLight: '#991B1B',     // voortgangsvulling kritiek
  nearCritical: '#F59E0B',      // bijna-kritiek (amber)
  hammock: '#0E7490',           // hammock/LOE-balk (teal)
  normal: '#2563EB',            // normale taak (blauw)
  normalLight: '#1D4ED8',       // voortgangsvulling / voltooid (blauw)
  milestone: '#7C3AED',         // mijlpaal (paars, ruit)
  baseline: '#6B7280',          // baseline-onderbalk (grijs)
  dependency: '#6B7280',        // afhankelijkheidspijl (grijs)
  summary: '#475569',           // samenvattingsbalk (slate)
  ghost: '#94A3B8',             // externe (cross-project) ghost-balk (grijs)
  constraintEarly: '#3B82F6',   // vroege-zijde constraint (SNET/FNET): blauw
  constraintLate: '#8B5CF6',    // late-zijde/pinnende constraint (SNLT/FNLT/MSO/MFO): violet
  deadlineOk: '#10B981',        // deadline-marker (groen; rood bij overschrijding)
  tracePred: GANTT_TRACE_COLORS.predecessor,
  tracePredDriving: GANTT_TRACE_COLORS.predecessorDriving,
  traceSucc: GANTT_TRACE_COLORS.successor,
  traceSuccDriving: GANTT_TRACE_COLORS.successorDriving,
};

// Optionele tint per float-pad: pad 1 = kritiek (rood, elders), paden ≥2 elk een
// eigen tint. [0]/[1] hergebruiken de merk-blauw/-violet.
const FLOAT_PATH_TINTS: string[] = [
  BRAND.normal, BRAND.milestone, '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#0D9488', '#9333EA',
];

// ── Labelkleur op een gekleurd vlak ──────────────────────────────────────────
// Een vast wit balklabel is niet houdbaar zodra de balkkleur niet vaststaat:
// in de kleurmodi (`auto`, resource-, categorie-kleuring) tekent de gebruiker zijn eigen tinten op
// de balk, en op een lichte eigen kleur is wit onleesbaar. `barLabelColor` kiest daarom per vlak de
// beste van twee: bijna-zwart (#111827, hetzelfde als PRINT_PALETTE.text) of wit.
//
// Met het verzadigde balkpalet (zie BRAND hierboven) wint wit op de VIJF STANDAARD-balktinten.
// Gemeten (WCAG 2.x), zwart-label / wit-label:
//   critical   #DC2626  3,67 / 4,83  ⇒ wit
//   normal     #2563EB  3,43 / 5,17  ⇒ wit
//   complete   #1D4ED8  2,65 / 6,70  ⇒ wit
//   milestone  #7C3AED  3,11 / 5,70  ⇒ wit
//   baseline   #6B7280  3,67 / 4,83  ⇒ wit
// Ook op de donkere voortgangsvullingen, waar het label vaak op begint, blijft het wit:
//   criticalLight #991B1B  2,13 / 8,31                       ⇒ wit
//   moduskleur + 25% zwart (de rgba-overlay), bv. normal      1,84-2,40 / 7,39-9,63 ⇒ wit
// "Alle balktinten" zou een overclaim zijn: er liggen meer vlakken onder een label, en die kiezen
// juist ZWART — en dat hoort ook, want daar is zwart aantoonbaar leesbaarder:
//   nearCritical #F59E0B  8,26 / 2,15  ⇒ zwart      ghost      #94A3B8  6,92 / 2,56  ⇒ zwart
//   traceSucc    #A78BFA  6,52 / 2,72  ⇒ zwart      tracePred  #F59E0B  8,26 / 2,15  ⇒ zwart
//   float-pad-tinten #0891B2 / #65A30D / #EA580C / #0D9488     ⇒ zwart (4,74-5,74 / 3,09-3,74)
// Wit blijft winnen op `hammock` (#0E7490, 3,31 / 5,36) en `successorDriving` (#7C3AED, = milestone).
// De speling draagt geen label, maar staat hier voor de volledigheid: #10B981 (donker thema)
// 6,99 / 2,54 ⇒ zwart, #059669 (licht thema) 4,71 / 3,77 ⇒ zwart.
// De functie is dus geen dode vangrail: hij kiest vandaag al op minstens zeven vlakken zwart, en hij
// is onmisbaar voor de kleurmodi, waar de balkkleur uit projectdata komt en elke kant op kan.

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
 * WCAG-contrastverhouding haalt. Eén gebruiksplek: het TAAKBALK-label in `GanttRenderer`, dat op
 * de balkkleur zelf of op de voortgangsvulling staat. Labels op de CANVAS-achtergrond horen bij
 * `palette.text`/`textSecondary` en niet hier.
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
    // De balktinten komen uit BRAND, maar via een thema-var met BRAND als fallback — hetzelfde
    // patroon dat `--theme-bar-float` al had. Licht en donker definiëren die vars NIET, dus daar
    // valt alles terug op BRAND en is de uitkomst byte-identiek aan een directe `BRAND.x`. Alleen
    // het hoog-contrastthema zet ze, omdat de verzadigde set daar onder 3:1 zakt (complete 2,95).
    critical: v('--theme-bar-critical', BRAND.critical),
    criticalLight: v('--theme-bar-critical-progress', BRAND.criticalLight),
    nearCritical: BRAND.nearCritical,
    hammock: BRAND.hammock,
    normal: v('--theme-bar-normal', BRAND.normal),
    normalLight: v('--theme-bar-complete', BRAND.normalLight),
    milestone: v('--theme-bar-milestone', BRAND.milestone),
    float: v('--theme-bar-float', '#059669'),
    baseline: v('--theme-bar-baseline', BRAND.baseline),
    // complete deelt bewust één bron met normalLight — het IS dezelfde vulling.
    complete: v('--theme-bar-complete', BRAND.normalLight),
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
    // Zelfde bron als GanttRenderer's normal/critical, thema-var met BRAND-fallback — zodat de
    // staven in hoog contrast meelopen met de balken en niet ineens een ander blauw tonen.
    barNormal: v('--theme-bar-normal', BRAND.normal),
    barOver: v('--theme-bar-critical', BRAND.critical),
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
    bar: v('--theme-bar-normal', BRAND.normal),
    critical: v('--theme-bar-critical', BRAND.critical),
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
  // Het printpalet loopt BEWUST niet met `BRAND` mee, ook al zijn de waarden sinds het herstel van
  // 18-09-2026 weer identiek. De reden om ze apart te houden is dat ze op verschillende eisen zijn
  // gekozen: het scherm weegt twee kaarten (licht/donker) tegen elkaar af, papier is altijd wit en
  // moet daarnaast in grijstinten nog te onderscheiden zijn — een ontzadigde tint verdwijnt daar
  // sneller. Wordt het schermpalet ooit opnieuw bijgesteld, dan hoeft de print daar niet in mee.
  // De casing is hier lowercase waar dat vroeger zo stond; dat is load-bearing (zie de kop).
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
