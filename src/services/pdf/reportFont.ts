// Het lettertype van de rapporten (Gantt-afdruk, resourcediagram, tabelrapporten), issue #770.
//
// WAAROM een eigen moduletje: de canvas-fontstack van de rapporten stond als twee losse kopieën in
// `printPreview.ts` en `pdfTable.ts`, en de familienaam waaronder `fontLoader.ts` het gevendorde
// Inter registreert stond er een derde keer. Een andere rapportletter moet op álle drie de plekken
// tegelijk landen (preview, raster-export, meting van de kolombreedtes én de vector-PDF), anders
// meet het paneel op de ene letter en tekent de render op de andere. Daarom één bron, zonder
// `?url`-imports, zodat de headless bundels (planningsuite, kern) dit bestand kunnen laden.

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
