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

/** De familienaam waaronder `fontLoader.ts` het gevendorde Inter als `@font-face`-regel registreert. */
export const INTER_PDF_FAMILY = 'InterPDF';

/**
 * De standaard-fontstack van alle rapporttekst op het canvas: eerst het gevendorde Inter (dezelfde
 * bytes die de vector-PDF inbedt, dus `measureText` in de preview is gelijk aan de export), daarna
 * de systeemletter als terugval zolang de `@font-face` nog niet geladen is.
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
export const REPORT_FONT_IDS = ['inter', 'liberationSans', 'carlito', 'liberationSerif', 'liberationMono'] as const;
export type ReportFontId = (typeof REPORT_FONT_IDS)[number];
export const DEFAULT_REPORT_FONT_ID: ReportFontId = 'inter';

export interface ReportFontDef {
  /** De `@font-face`-familie in de browser. Bewust een eigen naam en niet "Liberation Sans": een
   *  geïnstalleerde systeemletter met dezelfde naam mag nooit de plaats van de gevendorde bytes
   *  innemen, want de PDF bedt de gevendorde bytes in en de preview moet daarop meten. */
  family: string;
  /** Bestandsnamen in `src/services/pdf/fonts/` (ongewijzigde upstreambestanden, zie README). */
  files: { regular: string; bold: string };
  /** Generieke CSS-familie als allerlaatste terugval. */
  generic: 'sans-serif' | 'serif' | 'monospace';
}

export const REPORT_FONTS: Record<ReportFontId, ReportFontDef> = {
  inter: { family: INTER_PDF_FAMILY, files: { regular: 'Inter-Regular.ttf', bold: 'Inter-Bold.ttf' }, generic: 'sans-serif' },
  // Zelfde tekenbreedtes als Arial.
  liberationSans: { family: 'OpsReportLiberationSans', files: { regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf' }, generic: 'sans-serif' },
  // Zelfde tekenbreedtes als Calibri.
  carlito: { family: 'OpsReportCarlito', files: { regular: 'Carlito-Regular.ttf', bold: 'Carlito-Bold.ttf' }, generic: 'sans-serif' },
  // Zelfde tekenbreedtes als Times New Roman.
  liberationSerif: { family: 'OpsReportLiberationSerif', files: { regular: 'LiberationSerif-Regular.ttf', bold: 'LiberationSerif-Bold.ttf' }, generic: 'serif' },
  // Vaste tekenbreedte, dezelfde breedtes als Courier New (vraag van manuvarkey in #770: cijfers en
  // codes in kolommen recht onder elkaar).
  liberationMono: { family: 'OpsReportLiberationMono', files: { regular: 'LiberationMono-Regular.ttf', bold: 'LiberationMono-Bold.ttf' }, generic: 'monospace' },
};

export function isReportFontId(value: unknown): value is ReportFontId {
  return typeof value === 'string' && (REPORT_FONT_IDS as readonly string[]).includes(value);
}

/**
 * RTL-codepoint? (Arabisch + Hebreeuws, incl. presentatievormen). De rapportletters dekken deze scripts
 * niet; tekst met zo'n teken gaat in de PDF door de shaping-kern (`bidiShape.ts`). Hier en niet in
 * `reportTextMeasure.ts`: ook {@link reportTextFont} leest het, en dit bestand blijft zonder imports.
 */
export function isRtlCodepoint(cp: number): boolean {
  return (
    (cp >= 0x0590 && cp <= 0x05FF) || // Hebreeuws
    (cp >= 0x0600 && cp <= 0x06FF) || // Arabisch
    (cp >= 0x0750 && cp <= 0x077F) || // Arabic Supplement
    (cp >= 0x08A0 && cp <= 0x08FF) || // Arabic Extended-A
    (cp >= 0xFB50 && cp <= 0xFDFF) || // Arabic Presentation Forms-A
    (cp >= 0xFE70 && cp <= 0xFEFF)    // Arabic Presentation Forms-B
  );
}

export function hasRtlText(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && isRtlCodepoint(cp)) return true;
  }
  return false;
}

/**
 * De familie waaronder `fontLoader.ts` Noto Sans Arabic voor het scherm registreert (review Sol #847).
 * De vector-PDF tekent Arabisch in die letter (de shaping-kern) en meet er ook mee; het scherm moet hem
 * dus ook tekenen. Zonder deze familie tekende de browser Arabisch in een systeemletter: de meting gaf
 * 175 px, de browser tekende 183 px en de naam liep over de volgende kolom.
 */
export const ARABIC_REPORT_FAMILY = 'OpsReportArabic';

/**
 * De tekens die de browser uit {@link ARABIC_REPORT_FAMILY} haalt (`unicode-range`): het Arabische schrift
 * (`isArabicScriptCp` in `bidiShape.ts`) en de neutrale tekens (spaties en algemene interpunctie,
 * `isNeutralCp`). Dat zijn precies de tekens die de shaping-kern in Noto zet, in elk stuk van de tekst en
 * in beide richtingen (`fontClassFor`). De browser kiest de letter per teken: elk teken uit dit bereik dat
 * Noto heeft, komt uit Noto; een neutraal teken dat Noto mist (streepjes, aanhalingstekens, het
 * beletselteken) valt in de browser door naar de rapportletter, net als in de PDF. Cijfers en Latijn
 * staan er bewust niet in: die tekent de PDF ook in een Arabische tekst in de rapportletter.
 *
 * Wijzig dit bereik alleen samen met die twee functies: dan kiezen scherm en PDF niet meer dezelfde letter
 * en klopt de meting niet meer met wat de browser tekent (de gemengde naam in `report-studio.spec.ts`).
 */
export const ARABIC_REPORT_UNICODE_RANGE = 'U+0009-000A, U+000D, U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+08A0-08FF, U+2000-206F, U+FB50-FDFF, U+FE70-FEFF';

/** `font` (een canvas- en CSS-letter, `bold 9px InterPDF, …`) met {@link ARABIC_REPORT_FAMILY} vooraan. */
export function rtlReportFont(font: string): string {
  return font.replace(/(\d+(?:\.\d+)?px(?:\s*\/\s*\S+)?\s+)/, `$1"${ARABIC_REPORT_FAMILY}", `);
}

/** Is `font` een letter uit {@link rtlReportFont}? Dan tekent het scherm met kerning, zoals de shaping-kern. */
export function isRtlReportFont(font: string): boolean {
  return font.includes(`"${ARABIC_REPORT_FAMILY}"`);
}

/**
 * De letter waarmee het scherm (SVG-papier, canvas) `text` tekent. Tekst met Arabisch of Hebreeuws gaat in
 * de PDF door de shaping-kern: Arabische en neutrale tekens in Noto, de rest in de rapportletter, en met
 * de kerning van `fontkit.layout`. Het scherm tekent zo'n tekst daarom met Noto vóór de rapportletter
 * (de `unicode-range` beperkt Noto tot die tekens) en met kerning aan; zo komen ook de spaties uit Noto.
 * Elke andere tekst: `font` ongewijzigd (de vaste stack, zie {@link DEFAULT_REPORT_FONT_STACK}).
 *
 * Dat geldt ook voor de spaties in het Latijnse deel van een gemengde tekst ("Fase 1 أعمال … en
 * afstemming"): de browser kiest per teken en neemt ze uit Noto, en de shaping-kern doet sinds ronde 2
 * van de review hetzelfde. Daarvoor zette de PDF ze in de rapportletter; bij Carlito liep zo'n naam
 * ruim 4 px de volgende kolom in.
 */
export function reportTextFont(text: string, font: string): string {
  return hasRtlText(text) ? rtlReportFont(font) : font;
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
