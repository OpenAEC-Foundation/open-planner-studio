/**
 * Gedeelde tegel-/schaalwiskunde voor de print-pagineerders.
 *
 * Zowel de raster-pagineerder (`paginate.ts` → `paginateCanvasToTile`, `drawImage`-crops) als de
 * vector-pagineerder (`paginateVector.ts`, één Form-XObject dat per pagina onder een eigen clip
 * ge-`Do`'d wordt) moeten EXACT dezelfde pagina-indeling produceren — anders wijkt de preview af van
 * de export. Die wiskunde stond letterlijk twee keer in de codebase (met de comment "1:1 uit
 * de raster-pagineerder"); elke uitbreiding moest dus twee keer, identiek, doorgevoerd worden.
 * Deze module is de enige bron van waarheid: een PURE functie zonder canvas-, DOM- of pdf-lib-
 * afhankelijkheid, zodat hij ook headless testbaar is.
 *
 * Het resultaat is bewust volledig "uitgerekend": de backends krijgen kant-en-klare bron-vensters
 * (in LOGISCHE px) plus hun plek op de pagina (in punten) en hoeven zelf geen enkele afgeleide meer
 * te berekenen. Daarom levert `columns` per kolom een LIJST horizontale vensters (`xWindows`) in
 * plaats van een "herhaal de bevroren strip"-vlag: de herhaling van de bevroren naam-kolom is dan
 * gewoon een extra venster in die lijst, en beide backends lopen er met dezelfde lus overheen.
 *
 * Drie assen van tegeling:
 *   1. VERTICAAL — de body wordt over `rows` pagina's verdeeld. Is `repeatHeaderHeightPx` gezet, dan
 *      wordt de bronstrook `y ∈ [0, repeatHeaderHeightPx)` (project-/tijdschaalkop) op ELKE
 *      verticale tegel bovenaan de pagina herhaald en begint de body daaronder (issue #25 punt 1).
 *   2. HORIZONTAAL in `'actual'`-modus — vaste CSS→papierverhouding (0,75 pt per CSS-px), dus
 *      zoveel kolommen als de bron breed is zonder de tabel groter te drukken dan in auto-fit.
 *   3. HORIZONTAAL in `'fit-width'`-modus — normaal 1 kolom (alles op één paginabreedte geperst),
 *      maar met `timelineColumns: N` wordt de tijdlijn bewust over N paginabreedtes uitgesmeerd
 *      (issue #25 punt 5) zodat hij leesbaar blijft.
 *
 * Bij `repeatHeaderHeightPx: 0` en `timelineColumns: 1` reproduceert deze functie exact de oude
 * uitkomst; die twee defaults zijn dus het "oude gedrag" van deze ENGINE.
 *
 * Dat is uitdrukkelijk geen belofte over wat de gebruiker ziet: het rapportpaneel
 * (`ReportPanel.tsx`) zet de knop "kop herhalen" sinds issue #25 punt 1 bewust standaard AAN en
 * geeft dus standaard een `repeatHeaderHeightPx > 0` door. De defaults hier houden alleen deze
 * module gedragsneutraal voor aanroepers die niets meegeven.
 */

export type PaperSize = 'a4' | 'a3' | 'a2' | 'a1';
export type Orientation = 'portrait' | 'landscape';
export type PaginateMode = 'fit-width' | 'actual';

/** Paginamaten in PDF-punten (1/72 inch), portret; landscape = omgewisseld. */
export const PAPER_PT: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  a3: { width: 841.89, height: 1190.55 },
  a2: { width: 1190.55, height: 1683.78 },
  a1: { width: 1683.78, height: 2383.94 },
};

/** Standaard witruimte rond een rapportpagina, in PDF-punten. */
export const DEFAULT_MARGIN_PT = 24;

/** Eén logische CSS-pixel meet 0,75 PDF-punt (96 CSS-px per inch versus 72 pt per inch). */
export const LOGICAL_PX_TO_PT = 72 / 96;

/** De bruikbare horizontale ruimte van één rapportpagina, in PDF-punten. */
export function printableWidthPt(
  paperSize: PaperSize,
  orientation: Orientation,
  marginPt = DEFAULT_MARGIN_PT,
): number {
  const paper = PAPER_PT[paperSize];
  const pageWidthPt = orientation === 'landscape' ? paper.height : paper.width;
  return Math.max(0, pageWidthPt - 2 * marginPt);
}

/**
 * De bruikbare horizontale ruimte van één rapportpagina, omgerekend naar logische render-pixels.
 * De rapport-renderer gebruikt dit om de tijdlijn te comprimeren zonder de tabeltekst alsnog via
 * de pagineerder mee te schalen (issue #74).
 */
export function printableWidthLogicalPx(
  paperSize: PaperSize,
  orientation: Orientation,
  marginPt = DEFAULT_MARGIN_PT,
): number {
  return printableWidthPt(paperSize, orientation, marginPt) / LOGICAL_PX_TO_PT;
}

/** Ruimte onderaan (punten) gereserveerd voor het paginanummer in de marge. */
export const FOOTER_PT = 14;

/** Bovengrens voor {@link TileLayoutInput.timelineColumns}. Zie de afdwinging in
 *  {@link computeTileLayout}: het paginatotaal loopt kwadratisch in N, dus een ongebonden waarde
 *  laat deze pure functie ontsporen. De UI biedt 1..8; dit is de harde vangrail eromheen. */
export const MAX_TIMELINE_COLUMNS = 32;

/** Invoer voor {@link computeTileLayout}; alle px-maten zijn LOGISCHE (CSS-)px van de bron-render. */
export interface TileLayoutInput {
  paperSize: PaperSize;
  orientation: Orientation;
  mode: PaginateMode;
  /** Logische breedte van de broninhoud (= `renderReport().width`). */
  logicalWidth: number;
  /** Logische hoogte van de broninhoud (= `renderReport().height`). */
  logicalHeight: number;
  /**
   * Breedte (logische px) van de linker bevroren naam-kolom die op elke volgende horizontale tegel
   * herhaald wordt. Default 0 (geen bevroren kolom).
   */
  frozenColumnWidthPx?: number;
  /**
   * Hoogte (logische px, gemeten vanaf de BOVENkant van de bron) van de kopstrook die op elke
   * verticale tegel bovenaan de pagina herhaald moet worden. Default 0 = geen herhaling; dat is de
   * gedragsneutrale ENGINE-default, niet wat de UI standaard kiest (die herhaalt sinds issue #25
   * punt 1 wél — zie de module-doc hierboven).
   */
  repeatHeaderHeightPx?: number;
  /**
   * Aantal paginabreedtes waarover de tijdlijn uitgesmeerd wordt. Alleen van toepassing in
   * `'fit-width'`; in `'actual'` volgt het kolom-aantal uit de bronbreedte en wordt dit genegeerd.
   * Default 1 = alles op één paginabreedte, oud gedrag.
   */
  timelineColumns?: number;
  /** Paginamarge in punten (rondom). Default 24. */
  marginPt?: number;
}

/** Eén horizontaal bron-venster op een pagina: welk stuk bron-x komt waar op de pagina terecht. */
export interface TileXWindow {
  /** Linkerrand van het bron-venster (logische px). */
  srcX: number;
  /** Breedte van het bron-venster (logische px). Kan 0/negatief zijn ⇒ overslaan. */
  srcW: number;
  /** x op de pagina in punten, gerekend vanaf de LINKERrand van het papier (dus incl. marge). */
  pageX: number;
}

/** Eén horizontale tegel-kolom = de vensters die samen één paginabreedte vullen. */
export interface TileColumn {
  /**
   * Van links naar rechts. Kolom 0 heeft één venster (bron-x vanaf 0). Elke volgende kolom begint
   * met de herhaalde bevroren naam-strip (srcX 0) en daarna het aansluitende body-venster.
   */
  xWindows: TileXWindow[];
}

/** Eén verticale body-tegel (de kopstrook zit hier NIET in; die wordt per pagina apart herhaald). */
export interface TileBodyRow {
  /** Bovenrand van het bron-venster (logische px). */
  srcY: number;
  /** Hoogte van het bron-venster (logische px). */
  srcH: number;
}

/** Volledig uitgerekende pagina-indeling; beide backends tekenen hier 1:1 uit. */
export interface TileLayout {
  /** Papierbreedte in punten (honoreert oriëntatie). */
  pageWidthPt: number;
  /** Papierhoogte in punten (honoreert oriëntatie). */
  pageHeightPt: number;
  /** Gebruikte paginamarge in punten. */
  marginPt: number;
  /** Breedte van het printgebied in punten (papier minus linker+rechter marge). */
  printW: number;
  /** Hoogte van het printgebied in punten (papier minus boven+onder marge minus voetruimte). */
  printH: number;
  /** Punten per LOGISCHE bron-px. */
  scale: number;
  /** Aantal verticale tegels. */
  rows: number;
  /** Aantal horizontale tegels. */
  cols: number;
  /** Effectieve breedte van de bevroren naam-kolom (logische px); 0 als er niets herhaald wordt. */
  frozenPx: number;
  /** Diezelfde bevroren kolom in punten op de pagina (`frozenPx * scale`). */
  frozenPtW: number;
  /** Effectieve kopstrookhoogte (logische px); 0 = geen kopherhaling. */
  repeatHeaderPx: number;
  /** Diezelfde kopstrook in punten op de pagina (`repeatHeaderPx * scale`). */
  repeatHeaderPtH: number;
  /**
   * y (punten, gerekend vanaf de BOVENkant van het papier) waar de body-tegel begint: onder de
   * marge én onder de eventueel herhaalde kopstrook. De kopstrook zelf begint op `marginPt`.
   */
  bodyTopPt: number;
  /** Horizontale tegels, van links naar rechts. Lengte === `cols`. */
  columns: TileColumn[];
  /** Verticale body-tegels, van boven naar onder. Lengte === `rows`. */
  bodyRows: TileBodyRow[];
}

/**
 * Reken de volledige pagina-indeling uit. Puur: geen canvas, geen DOM, geen pdf-lib.
 *
 * @see TileLayoutInput voor de defaults die het historische gedrag reproduceren.
 */
export function computeTileLayout(input: TileLayoutInput): TileLayout {
  const marginPt = input.marginPt ?? DEFAULT_MARGIN_PT;
  const frozenRequestedPx = Math.max(0, input.frozenColumnWidthPx ?? 0);

  const base = PAPER_PT[input.paperSize];
  const pageWidthPt = input.orientation === 'landscape' ? base.height : base.width;
  const pageHeightPt = input.orientation === 'landscape' ? base.width : base.height;

  const printW = pageWidthPt - 2 * marginPt;
  const printH = pageHeightPt - 2 * marginPt - FOOTER_PT;

  // Bron-afmetingen in LOGISCHE px — alle tegel-wiskunde gebeurt in deze eenheid.
  //
  // Contract-afdwinging: deze functie is de bron van waarheid voor BEIDE pagineer-backends, en elke
  // afgeleide hieronder (rows, cols, de vensterlijsten) is een deling of een `ceil` op deze twee
  // getallen. Een NaN/Infinity die hier binnenkomt plant zich daardoor stil voort: `rows` wordt NaN
  // en de tegel-lus levert nul pagina's op — een lege PDF zonder ook maar één foutmelding. Vandaar
  // een expliciete finite-check; niet-eindige of negatieve maten worden 0, wat verderop netjes door
  // de bestaande degeneratie-vangnetten wordt afgevangen.
  const cw = Number.isFinite(input.logicalWidth) ? Math.max(0, input.logicalWidth) : 0;
  const ch = Number.isFinite(input.logicalHeight) ? Math.max(0, input.logicalHeight) : 0;

  // Gevraagd aantal tijdlijn-kolommen (alleen zinvol in fit-width). Defensief geklemd: een
  // niet-eindig of < 1 getal zou de schaalformule hieronder laten ontsporen. De BOVENgrens is er
  // omdat `rows` meegroeit met de schaal en het paginatotaal dus kwadratisch in N loopt: een
  // doorgegeven 1e6 bouwt een miljoen kolomobjecten en rapporteert honderden miljarden pagina's.
  // De UI biedt 1..8; MAX_TIMELINE_COLUMNS laat ruim marge en houdt de functie eindig voor elke
  // aanroeper.
  const requestedCols = input.timelineColumns ?? 1;
  const timelineCols = Number.isFinite(requestedCols)
    ? Math.min(MAX_TIMELINE_COLUMNS, Math.max(1, Math.floor(requestedCols)))
    : 1;

  // ---- Horizontale schaal + kolom-aantal --------------------------------------------------------
  //
  // 'actual': vaste CSS→papierverhouding, zoveel kolommen als nodig (hieronder afgeleid).
  // 'fit-width' met N kolommen: de bron wordt over N paginabreedtes uitgesmeerd. Er wordt dan in
  //   totaal `cw + (N-1)*frozenPx` bron-px getekend (de bevroren naam-strip komt N-1 keer extra
  //   terug) op `N * printW` punten, dus scale = N*printW / (cw + (N-1)*frozenPx). Bij N = 1 valt dit
  //   terug op de oude `printW / cw`.
  //
  // De `cw > 0`-guard is een degeneratie-vangnet: bij een lege bron zou de deling Infinity opleveren
  // en `rows`/`cols` naar oneindig laten lopen (= vastloper). Echte renders hebben altijd cw > 0.
  let scale: number;
  if (input.mode === 'fit-width') {
    const virtualWidth = cw + (timelineCols - 1) * frozenRequestedPx;
    scale = virtualWidth > 0 ? (printW * timelineCols) / virtualWidth : 1;
  } else {
    // De bronmaten zijn CSS-pixels, geen PDF-punten. De handmatige tijdzoom verandert alleen de
    // tijdas; de fysieke tabelmaat moet gelijk blijven aan de Auto-fit-preview.
    scale = LOGICAL_PX_TO_PT;
  }

  // De bevroren strip wordt herhaald zodra er meer dan één kolom is — dat was vroeger alleen in
  // 'actual'-modus zo, maar geldt nu ook voor een fit-width-export met timelineColumns > 1.
  // In 'actual' kennen we `cols` pas ná deze berekening (hij hangt van `frozenPtW` af), dus daar
  // rekenen we de strip-breedte onvoorwaardelijk uit; blijft het toch bij één kolom, dan wordt
  // `frozenPtW` simpelweg nergens gebruikt (kolom 0 herhaalt niets) — precies zoals voorheen.
  const repeatsFrozen = input.mode === 'actual' || timelineCols > 1;
  const frozenPx = repeatsFrozen ? frozenRequestedPx : 0;
  const frozenPtW = frozenPx * scale;

  // Bron-px die kolom 0 in beeld brengt (inclusief de bevroren strip) resp. die elke VOLGENDE kolom
  // aan body toevoegt (die kolom offert `frozenPtW` punten op aan de herhaalde strip).
  const col0Bodypx = printW / scale;
  const laterColBodypx = (printW - frozenPtW) / scale;

  let cols: number;
  if (input.mode === 'fit-width') {
    cols = timelineCols;
  } else if (cw > col0Bodypx && laterColBodypx > 0) {
    cols = 1 + Math.ceil((cw - col0Bodypx) / laterColBodypx);
  } else {
    cols = 1;
  }
  cols = Math.max(1, cols);

  // ---- Verticale tegeling (met eventuele kopherhaling) ------------------------------------------
  //
  // Zonder kopherhaling past er `printH / scale` bron-px op één pagina. Herhalen we de kopstrook,
  // dan gaat daar `repeatHeaderPx` bron-px vanaf: de body krijgt per pagina nog maar
  // `printH/scale - repeatHeaderPx` bron-px, en de te verdelen bron loopt van `repeatHeaderPx` tot
  // `ch` in plaats van van 0 tot `ch`. Bij repeatHeaderPx = 0 is dit letterlijk de oude formule.
  const pageSrcHpx = printH / scale;
  const repeatRequestedPx = Math.max(0, input.repeatHeaderHeightPx ?? 0);
  // Degeneratie-vangnet: een kopstrook die net zo hoog is als het printgebied (of als de hele bron)
  // laat geen body over en zou `rows` naar oneindig laten lopen. Dan herhalen we de kop niet.
  const repeatHeaderPx = repeatRequestedPx > 0 && repeatRequestedPx < pageSrcHpx && repeatRequestedPx < ch
    ? repeatRequestedPx
    : 0;
  const repeatHeaderPtH = repeatHeaderPx * scale;
  const bodyRowHpx = pageSrcHpx - repeatHeaderPx;
  const rows = Math.max(1, Math.ceil((ch - repeatHeaderPx) / bodyRowHpx));

  const bodyRows: TileBodyRow[] = [];
  for (let r = 0; r < rows; r++) {
    const srcY = repeatHeaderPx + r * bodyRowHpx;
    bodyRows.push({ srcY, srcH: Math.min(bodyRowHpx, ch - srcY) });
  }

  // ---- Horizontale vensters per kolom -----------------------------------------------------------
  const columns: TileColumn[] = [];
  for (let c = 0; c < cols; c++) {
    if (c === 0) {
      // Kolom 0 laat de bron vanaf x = 0 zien; de bevroren strip zit daar al in.
      columns.push({ xWindows: [{ srcX: 0, srcW: Math.min(col0Bodypx, cw), pageX: marginPt }] });
      continue;
    }
    const xWindows: TileXWindow[] = [];
    // De bevroren naam-strip herhalen, zodat elke pagina zelfstandig leesbaar blijft.
    if (frozenPx > 0 && frozenPtW > 0) {
      xWindows.push({ srcX: 0, srcW: frozenPx, pageX: marginPt });
    }
    // Body-venster: kolom 0 dekte [0 .. col0Bodypx]; elke volgende kolom schuift `laterColBodypx`
    // verder, aansluitend zonder gat of overlap. Voor fit-width met N kolommen geldt exact
    // col0Bodypx + (N-1)*laterColBodypx === cw (zie de scale-afleiding hierboven).
    const bodySrcX = col0Bodypx + (c - 1) * laterColBodypx;
    xWindows.push({
      srcX: bodySrcX,
      srcW: Math.min(laterColBodypx, cw - bodySrcX),
      pageX: marginPt + frozenPtW,
    });
    columns.push({ xWindows });
  }

  return {
    pageWidthPt,
    pageHeightPt,
    marginPt,
    printW,
    printH,
    scale,
    rows,
    cols,
    frozenPx,
    frozenPtW,
    repeatHeaderPx,
    repeatHeaderPtH,
    bodyTopPt: marginPt + repeatHeaderPtH,
    columns,
    bodyRows,
  };
}
