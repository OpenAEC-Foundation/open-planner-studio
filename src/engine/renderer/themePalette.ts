// Centraal themapalet voor de tekenlaag (fase 2.7/2.9, audit C5/P17). Vroeger las ELKE renderer
// (GanttRenderer/HistogramRenderer/MiniMapRenderer) zélf de CSS-thema-variabelen via
// getComputedStyle én droeg elk zijn eigen kopie van de merk-hex-tabel — half DOM-read, half
// hardcoded hex, met "gelijk aan GanttRenderer"-commentaar als enige koppeling. Dat staat nu op één
// plek:
//   - de merk-hex-constanten (kritiek-rood, normaal-blauw, …) staan één keer in `BRAND`;
//   - readGanttPalette/readHistogramPalette/readMiniMapPalette lezen de CSS-vars (met per-renderer
//     fallback, EXACT zoals voorheen) en stellen het palet samen;
//   - PRINT_PALETTE is de parallelle, DOM-loze print-tabel (dezelfde merk-bron voor kritiek/normaal/
//     mijlpaal/samenvatting).
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
const BRAND = {
  critical: '#DC2626',          // kritiek (rood)
  criticalLight: '#991B1B',     // voortgangsvulling kritiek
  nearCritical: '#F59E0B',      // bijna-kritiek (amber, fase 2.9 §5.4)
  hammock: '#0E7490',           // hammock/LOE-balk (teal, fase 2.9 §5.3)
  normal: '#2563EB',            // normale taak (blauw)
  normalLight: '#1D4ED8',       // voortgangsvulling / voltooid (blauw)
  milestone: '#7C3AED',         // mijlpaal (paars, ruit)
  baseline: '#6B7280',          // baseline-onderbalk (grijs)
  dependency: '#6B7280',        // afhankelijkheidspijl (grijs)
  summary: '#475569',           // samenvattingsbalk (slate)
  ghost: '#94A3B8',             // externe (cross-project) ghost-balk (grijs, fase 2.9 §5.5)
  constraintEarly: '#3B82F6',   // vroege-zijde constraint (SNET/FNET): blauw
  constraintLate: '#8B5CF6',    // late-zijde/pinnende constraint (SNLT/FNLT/MSO/MFO): violet
  deadlineOk: '#10B981',        // deadline-marker (groen; rood bij overschrijding)
  tracePred: '#F59E0B',         // path tracing: voorganger (goud)
  tracePredDriving: '#D97706',  // path tracing: driving voorganger (donkerder goud)
  traceSucc: '#A78BFA',         // path tracing: opvolger (paars)
  traceSuccDriving: '#7C3AED',  // path tracing: driving opvolger (donkerder paars)
};

// Optionele tint per float-pad (fase 2.9 §5.4): pad 1 = kritiek (rood, elders), paden ≥2 elk een
// eigen tint. [0]/[1] hergebruiken de merk-blauw/-violet — byte-identiek aan de vroegere literalen.
const FLOAT_PATH_TINTS: string[] = [
  BRAND.normal, BRAND.milestone, '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#0D9488', '#9333EA',
];

// ── GanttRenderer ────────────────────────────────────────────────────────────
export interface GanttPalette {
  bg: string;
  surface: string;
  grid: string;
  gridWeekend: string;
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
  /** Wit label-tekst op een gekleurde balk/knop. */
  barText: string;
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
    float: v('--theme-bar-float', '#059669'),
    baseline: BRAND.baseline,
    complete: BRAND.normalLight, // '#1D4ED8', zelfde hex als normalLight
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
  gridHoliday: '#fef3c7',
  border: '#d1d5db',
  borderDark: '#9ca3af',
  text: '#111827',
  textSecondary: '#6b7280',
  critical: BRAND.critical,   // '#DC2626'
  criticalDark: '#991b1b',
  normal: BRAND.normal,       // '#2563EB'
  normalDark: '#1d4ed8',
  milestone: BRAND.milestone, // '#7C3AED'
  float: '#10B981',
  dependency: '#9CA3AF',
  today: '#F59E0B',
  headerBg: '#f1f5f9',
  summary: BRAND.milestone,   // '#7C3AED' — print-samenvatting is violet (zelfde hex als mijlpaal)
  rowEven: '#f9fafb',
  rowOdd: '#ffffff',
};
