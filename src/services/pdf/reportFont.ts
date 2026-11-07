// Het lettertype van de rapporten (Gantt-afdruk, resourcediagram, tabelrapporten), issue #770.
//
// WAAROM een eigen moduletje: de canvas-fontstack van de rapporten stond als twee losse kopieën in
// `printPreview.ts` en `pdfTable.ts`, en de familienaam waaronder `fontLoader.ts` het gevendorde
// Inter registreert stond er een derde keer. Een andere rapportletter moet op álle drie de plekken
// tegelijk landen (preview, raster-export, meting van de kolombreedtes én de vector-PDF), anders
// meet het paneel op de ene letter en tekent de render op de andere. Daarom één bron, zonder
// `?url`-imports, zodat de headless bundels (planningsuite, kern) dit bestand kunnen laden.
//
// WAAROM een vast setje en geen systeemletters (besluit Ethan, 7 november 2026, op advies uit #770):
// een PDF moet de letter inbedden, en dat mag en kan alleen met een letter die we zelf meeleveren.
// Systeemletters verschillen per apparaat, mogen vaak niet ingebed worden (Apple SF) en zijn in de
// browser alleen in Chrome/Edge na een toestemmingsvraag te lezen. Elke letter hieronder staat onder
// de SIL Open Font License 1.1 (meeleveren en inbedden toegestaan), heeft TrueType-contouren (glyf,
// dus `CIDFontType2` in pdf-lib) en dekt alle Latijnse en Cyrillische talen van de app; wat hij mist
// (Arabisch, CJK, een enkel symbool) vangt de terugvalketen van `paginateVector.ts` op.

/** De familienaam waaronder `fontLoader.ts` het gevendorde Inter als `FontFace` registreert. */
export const INTER_PDF_FAMILY = 'InterPDF';

/**
 * De standaard-fontstack van alle rapporttekst op het canvas: eerst het gevendorde Inter (dezelfde
 * bytes die de vector-PDF inbedt, dus `measureText` in de preview is gelijk aan de export), daarna
 * de systeemletter als terugval zolang de `FontFace` nog niet geladen is.
 *
 * De vector-backend (`PdfVectorDraw2D`) leest de familie uit deze string NIET: die tekent met de
 * fonts die de pagineerder inbedt. Wie een andere stack meegeeft, geeft dus ook de bytes van
 * diezelfde letter aan de pagineerder.
 */
export const DEFAULT_REPORT_FONT_STACK = `${INTER_PDF_FAMILY}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

/**
 * De keuzes van de keuzelijst *Lettertype* op het tabblad Rapport, in de volgorde van de lijst.
 * Alleen deze id gaat naar de rapportinstellingen (`ops-reportSettings`); een onbekende id valt
 * terug op `inter`. Een id hernoemen = de opgeslagen keuze van bestaande gebruikers kwijtraken.
 */
export const REPORT_FONT_IDS = ['inter', 'liberationSans', 'carlito', 'liberationSerif'] as const;
export type ReportFontId = (typeof REPORT_FONT_IDS)[number];
export const DEFAULT_REPORT_FONT_ID: ReportFontId = 'inter';

export interface ReportFontDef {
  /** De `FontFace`-familie in de browser. Bewust een eigen naam en niet "Liberation Sans": een
   *  geïnstalleerde systeemletter met dezelfde naam mag nooit de plaats van de gevendorde bytes
   *  innemen, want de PDF bedt de gevendorde bytes in en de preview moet daarop meten. */
  family: string;
  /** Bestandsnamen in `src/services/pdf/fonts/` (ongewijzigde upstreambestanden, zie README). */
  files: { regular: string; bold: string };
  /** Generieke CSS-familie als allerlaatste terugval. */
  generic: 'sans-serif' | 'serif';
}

export const REPORT_FONTS: Record<ReportFontId, ReportFontDef> = {
  inter: { family: INTER_PDF_FAMILY, files: { regular: 'Inter-Regular.ttf', bold: 'Inter-Bold.ttf' }, generic: 'sans-serif' },
  // Zelfde tekenbreedtes als Arial.
  liberationSans: { family: 'OpsReportLiberationSans', files: { regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf' }, generic: 'sans-serif' },
  // Zelfde tekenbreedtes als Calibri.
  carlito: { family: 'OpsReportCarlito', files: { regular: 'Carlito-Regular.ttf', bold: 'Carlito-Bold.ttf' }, generic: 'sans-serif' },
  // Zelfde tekenbreedtes als Times New Roman.
  liberationSerif: { family: 'OpsReportLiberationSerif', files: { regular: 'LiberationSerif-Regular.ttf', bold: 'LiberationSerif-Bold.ttf' }, generic: 'serif' },
};

export function isReportFontId(value: unknown): value is ReportFontId {
  return typeof value === 'string' && (REPORT_FONT_IDS as readonly string[]).includes(value);
}

/**
 * De canvas-fontstack van een rapportletter. Voor `inter` exact {@link DEFAULT_REPORT_FONT_STACK}
 * (byte-identiek aan vóór de keuzelijst). Voor een andere letter: die letter, dan Inter, dan de
 * generieke familie. Inter staat er bewust tussen: een teken dat de gekozen letter mist, tekent het
 * canvas dan in Inter, net als de vector-PDF (`fallbackFonts` in `paginateVector.ts`).
 */
export function reportFontStack(id: ReportFontId): string {
  if (id === 'inter') return DEFAULT_REPORT_FONT_STACK;
  const def = REPORT_FONTS[id];
  return `"${def.family}", ${INTER_PDF_FAMILY}, ${def.generic}`;
}

/**
 * De fontstack voor de DOM-weergave van de tabelrapporten (mijlpalen, afwijkingen, de zeven
 * tabelrapporten). Gelijk aan {@link reportFontStack}, met het UI-Inter (`"Inter"`, @fontsource)
 * direct achter `InterPDF`. Reden: de raster-terugval van die export maakt een DOM-screenshot
 * (`modern-screenshot`), en die neemt alleen CSS-`@font-face`-regels mee, geen `FontFace`-objecten
 * uit `document.fonts`. Zonder `"Inter"` viel die terugval op een systeemletter; nu op Inter, zoals
 * vóór de keuzelijst.
 */
export function reportDomFontStack(id: ReportFontId): string {
  return reportFontStack(id).replace(`${INTER_PDF_FAMILY},`, `${INTER_PDF_FAMILY}, "Inter",`);
}
