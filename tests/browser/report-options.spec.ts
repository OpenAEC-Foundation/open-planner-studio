// Rapportkarakterisering: de gebruiker wijzigt de kop en een concrete tekenoptie, waarna zowel de
// levende preview als de echte PDF-export dezelfde actuele waarden moeten gebruiken.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import type { Download } from '@playwright/test';
import { expect, seedProject, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';
import { chooseLocale, LOCALE_CASES } from './fixtures/locale';

test('report options: preview en export gebruiken dezelfde actuele kop en legendaoptie', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    // Het CJK-teken dwingt de bestaande vector-export gecontroleerd naar zijn rasterfallback, zodat
    // dezelfde Canvas-tekengrens als de preview observeerbaar is zonder productcode te instrumenteren.
    { name: '施工 – rapporttaak', start: '2026-09-07', finish: '2026-10-16', durationDays: 30 },
  ], 'Rapportopties');
  const downloads: string[] = [];
  page.on('download', download => { downloads.push(download.suggestedFilename()); });
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawnText: string[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ) {
      // Alleen de (losse) rapportcanvassen tellen: de Gantt-canvassen (`data-testid="gantt-*"`)
      // kunnen ná het installeren van deze haak nog één keer painten en tekenen dan de volledige
      // taaknaam op de balk — dat is geen rapporttekst (gezien als race op een trage CI-runner).
      if (!(this.canvas?.dataset.testid ?? '').startsWith('gantt-')) drawnText.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsReportDrawnText', {
      configurable: true,
      value: drawnText,
    });
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  // De preview gebruikt bewust revocable Blob-URL's: een dataURL hield grote base64-strings na
  // snelle her-renders onnodig in het geheugen. Dit contract test alleen dat er een verse PNG-
  // preview staat; de P1-performanceflow bewaakt apart dat vervangen URL's worden ingetrokken.
  await expect(preview).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  const previewBefore = await preview.getAttribute('src');

  // De export moet het ingestelde vel gebruiken, niet opnieuw het standaardrapport openen.
  const paper = page.getByLabel(/^(Paper:|Papier:)$/);
  await paper.click();
  await page.getByRole('option', { name: 'A4', exact: true }).click();
  const orientation = page.getByLabel(/^(Orientation:|Oriëntatie:)$/);
  await orientation.click();
  await page.getByRole('option', { name: /^(Portrait|Staand)$/ }).click();

  const legend = page.getByLabel(/^(Legend|Legenda)$/);
  if (await legend.isChecked()) await legend.uncheck();
  await page.evaluate(() => {
    const drawn = (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText;
    drawn?.splice(0, drawn.length);
  });
  const companyName = `Actuele rapportkop ${Date.now()}`;
  const company = page.getByPlaceholder(/^(Company name|Bedrijfsnaam)$/);
  await company.fill(companyName);
  // Enter in de invoer blijft een gewone invoerhandeling: geen impliciete formulierexport.
  await company.press('Enter');
  await expect(company).toBeFocused();
  expect(downloads).toHaveLength(0);

  await expect.poll(() => preview.getAttribute('src')).not.toBe(previewBefore);
  await expect.poll(() => page.evaluate((header) => (
    ((window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? [])
      .some(text => text.includes(header))
  ), companyName)).toBe(true);
  const previewText = await page.evaluate(() => (
    (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? []
  ));
  expect(previewText).not.toContain('Critical path');
  expect(previewText).not.toContain('Kritieke pad');

  await page.evaluate(() => {
    const drawn = (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText;
    drawn?.splice(0, drawn.length);
  });
  const downloadPromise = page.waitForEvent('download');
  // Knownbug 21: Exporteer PDF exporteert met de ingestelde paneelstate, zonder remount.
  const print = page.locator('form#report-pdf-export button[type="submit"]');
  await print.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Rapportopties-schedule.pdf');
  expect(downloads).toHaveLength(1);
  await expect(print).toBeFocused();
  await expect(company).toHaveValue(companyName);
  await expect(paper).toContainText('A4');
  await expect(orientation).toContainText(/^(Portrait|Staand)$/);
  await expect(legend).not.toBeChecked();
  const pdfPath = await download.path();
  expect(pdfPath).not.toBeNull();
  const pdf = await PDFDocument.load(await readFile(pdfPath!));
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  for (const pdfPage of pdf.getPages()) {
    expect(pdfPage.getWidth()).toBeCloseTo(595.28, 1);
    expect(pdfPage.getHeight()).toBeCloseTo(841.89, 1);
  }

  await expect.poll(() => page.evaluate((header) => (
    ((window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? [])
      .some(text => text.includes(header))
  ), companyName)).toBe(true);
  const exportText = await page.evaluate(() => (
    (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? []
  ));
  expect(exportText).not.toContain('Critical path');
  expect(exportText).not.toContain('Kritieke pad');

  // Ctrl+P blijft navigatie naar Rapport; de lokale rapportinvoer blijft staan.
  await page.keyboard.press('Control+p');
  await expect(company).toHaveValue(companyName);
  expect(downloads).toHaveLength(1);
  const panelDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  expect((await panelDownloadPromise).suggestedFilename()).toBe('Rapportopties-schedule.pdf');
  expect(downloads).toHaveLength(2);

  // Knownbug 61: ook de drie rapporttypen zonder TableReportSpec gebruiken de gekozen taal.
  // De bestaande kop-, papier-, focus- en rasterfallbackcontroles hierboven blijven intact.
  const typePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  const exports = [
    { option: /^(Gantt chart|Gantt-afdruk)$/, nl: 'planning', en: 'schedule' },
    { option: /^(Milestone overview|Mijlpalen-overzicht)$/, nl: 'mijlpalen', en: 'milestones' },
    { option: /^Variance$/, nl: 'afwijkingen', en: 'variance' },
  ];
  for (const locale of [LOCALE_CASES[2], LOCALE_CASES[3]]) {
    await chooseLocale(page, locale);
    for (const reportExport of exports) {
      await typePicker.click();
      await page.getByRole('option', { name: reportExport.option }).click();
      const nextDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
      expect((await nextDownload).suggestedFilename()).toBe(`Rapportopties-${reportExport[locale.code]}.pdf`);
    }
  }

  // Alleen het rapportdeel wisselt van taal: de naamloze basis blijft in beide talen `project`.
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({ name: '   ' }));
  for (const [locale, filename] of [
    [LOCALE_CASES[3], 'project-variance.pdf'],
    [LOCALE_CASES[2], 'project-afwijkingen.pdf'],
  ] as const) {
    await chooseLocale(page, locale);
    const nextDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
    expect((await nextDownload).suggestedFilename()).toBe(filename);
  }
});

// Naamkolom van de rapporttabel: de gebruiker zet "Taaknamen afkappen" uit en ziet de volledige
// naam; zet het weer aan en verstelt de slider, waarna de naam op de gekozen breedte afkapt.
test('report options: taaknamen afkappen en de naamkolom-slider sturen de tabel', async ({ page, ops: _ops }) => {
  const longName = 'Een bewust erg lange taaknaam die in de standaardkolom nooit past';
  await seedProject(page, [
    { name: longName, start: '2026-09-07', finish: '2026-10-16', durationDays: 30 },
  ], 'Naamkolom');
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawnText: string[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
      // Zie de eerste test: Gantt-paints ná het installeren van de haak horen niet bij het rapport.
      if (!(this.canvas?.dataset.testid ?? '').startsWith('gantt-')) drawnText.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsReportDrawnText', { configurable: true, value: drawnText });
  });
  const drawn = () => page.evaluate(() => (
    (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? []
  ));
  const clearDrawn = () => page.evaluate(() => {
    const d = (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText;
    d?.splice(0, d.length);
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  await expect(preview).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });

  // Standaard: afkappen aan op de standaardbreedte ⇒ de naam eindigt op een ellipsis.
  const truncate = page.locator('[data-ops-report-truncate-names]');
  await expect(truncate).toBeChecked();
  await expect.poll(drawn).toContainEqual(expect.stringMatching(/^Een bewust erg lange.*…$/));
  expect(await drawn()).not.toContain(longName);

  // Afkappen uit ⇒ de kolom groeit mee en de volledige naam wordt getekend.
  const srcBefore = await preview.getAttribute('src');
  await clearDrawn();
  await truncate.uncheck();
  await expect(page.locator('[data-ops-report-name-column-width]')).toHaveCount(0);
  await expect.poll(() => preview.getAttribute('src')).not.toBe(srcBefore);
  await expect.poll(drawn).toContain(longName);

  // Weer aan, slider naar het minimum ⇒ opnieuw afgekapt, en korter dan bij de standaardbreedte.
  const srcAuto = await preview.getAttribute('src');
  await clearDrawn();
  await truncate.check();
  const slider = page.locator('[data-ops-report-name-column-width]');
  await expect(slider).toBeVisible();
  await slider.fill(await slider.getAttribute('min') ?? '60');
  await expect.poll(() => preview.getAttribute('src')).not.toBe(srcAuto);
  await expect.poll(drawn).toContainEqual(expect.stringMatching(/^Een.*…$/));
  // Het aanvinken rendert eerst nog op de bewaarde breedte; de slider-render volgt daarna. De
  // kortste afgekapte variant is dus de uitkomst van het minimum.
  await expect.poll(async () => {
    const cut = (await drawn()).filter(t => t.endsWith('…') && longName.startsWith(t.slice(0, -1)));
    return cut.length ? Math.min(...cut.map(t => t.length)) : Number.POSITIVE_INFINITY;
  }).toBeLessThan('Een bewust erg lange'.length + 1);
  expect(await drawn()).not.toContain(longName);
});

// Datakolommen van de rapporttabel (WBS/Duur/Start/Einde/Volt.): die stonden op een vaste breedte
// die niet met de inhoud meebewoog — een vertaalde kop liep over de buurkolom heen en korte inhoud
// verspilde ruimte die de tijdlijn kan gebruiken. Deze flow bewaakt dat de meting uit het paneel
// ook echt in de getekende tabel landt (koppen voluit, kolom niet breder dan nodig).
test('report options: de datakolommen van de tabel schalen mee met hun inhoud', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Kolomtaak', start: '2026-09-07', finish: '2026-10-16', durationDays: 30 },
  ], 'Kolombreedtes');
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawn: { text: string; x: number }[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
      // Zie de eerste test: Gantt-paints ná het installeren van de haak horen niet bij het rapport.
      if (!(this.canvas?.dataset.testid ?? '').startsWith('gantt-')) drawn.push({ text: String(text), x });
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsReportDrawnCells', { configurable: true, value: drawn });
  });
  const drawnCells = () => page.evaluate(() => (
    (window as Window & { __opsReportDrawnCells?: { text: string; x: number }[] }).__opsReportDrawnCells ?? []
  ));

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  await expect(preview).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });

  // De WBS-kolom stond vast op 50 px en tekent zijn kop gecentreerd, dus op x = 25. Zodra de meting
  // (asynchroon, ná het laden van Inter) in de render landt, is de kolom nog zo breed als 'WBS' plus
  // een WBS-code en schuift die kop naar links. "Kleiner dan 25" is dus precies het bewijs dat de
  // gemeten breedte het tekenpad haalt, zonder een exacte pixelmaat vast te pinnen.
  await expect.poll(async () => (await drawnCells()).filter(c => c.text === 'WBS').pop()?.x ?? Number.POSITIVE_INFINITY,
    { timeout: 20_000 }).toBeLessThan(25);

  // En de koppen zelf staan er voluit — de kolom groeit naar de kop in plaats van hem af te kappen.
  const texts = (await drawnCells()).map(c => c.text);
  expect(texts).toContainEqual(expect.stringMatching(/^(Duration|Duur)$/));
  expect(texts).toContainEqual(expect.stringMatching(/^(Start)$/));
  expect(texts).toContainEqual(expect.stringMatching(/^(End|Einde)$/));
});

/** De BaseFont van elk Type0-font in de PDF; pdf-lib noemt een ingebed font `/<PostScript-naam>-<getal>`. */
function type0BaseFonts(pdf: PDFDocument): string[] {
  const baseFonts: string[] = [];
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Subtype')) === PDFName.of('Type0')) baseFonts.push(String(obj.get(PDFName.of('BaseFont'))));
  }
  return baseFonts;
}

/**
 * De tekst die de PDF met fontsleutel `fontKey` tekent, terugvertaald naar letters. De rapportletter
 * staat volledig ingebed (glyph-id = CID, zie `paginateVector.ts`), dus de glyph-id's van het
 * gevendorde bestand vertalen de hex-strings van `Tj` terug.
 */
async function pdfTextsInFont(pdf: PDFDocument, fontKey: string, fontFile: string): Promise<string[]> {
  const font = fontkit.create(await readFile(join(process.cwd(), fontFile)));
  const charOf = new Map<number, string>();
  // Oplopend, zodat een glyph die meerdere tekens dekt (spatie en U+00A0) het laagste teken krijgt.
  for (const cp of [...font.characterSet].sort((a, b) => a - b)) {
    const gid = font.glyphForCodePoint(cp).id;
    if (!charOf.has(gid)) charOf.set(gid, String.fromCodePoint(cp));
  }
  const usesKey = new RegExp(`/${fontKey} [\\d.]+ Tf`);
  const texts: string[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      const ops = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
      for (const [, block] of ops.matchAll(/BT\s([\s\S]*?)\sET/g)) {
        if (!usesKey.test(block)) continue;
        for (const [, hex] of block.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
          texts.push((hex.match(/.{4}/g) ?? []).map(h => charOf.get(parseInt(h, 16)) ?? '�').join(''));
        }
      }
    }
  }
  return texts;
}

// Rapportletter (issue #770): de gebruiker kiest Carlito. Preview en PDF gebruiken die letter (en
// Inter alleen voor het vinkje dat Carlito mist). Daarna kiest hij Liberation Sans en exporteert
// meteen, terwijl die letter nog laadt. Het blok van de tabelrapporten toont dezelfde keuze, ook in
// de raster-terugval, en na een herstart van de app staat de keuze er nog. Alleen een voorkeur op
// dit apparaat.
test('report options: de gekozen rapportletter staat in preview en PDF en blijft na een herstart', async ({ page, ops: _ops }) => {
  const longName = 'Afwerking begane grond noordzijde';
  const [letterTaskId] = await seedProject(page, [
    // Cyrillisch dekt Carlito zelf; het vinkje niet, dat komt in de PDF uit Inter.
    { name: '✓ Lettertaak Фундамент', start: '2026-09-07', finish: '2026-10-16', durationDays: 30 },
    // De langste naam bepaalt de naamkolom als afkappen uit staat. In Liberation Sans is hij breder
    // dan in Carlito.
    { name: longName, start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Rapportletter');
  await page.evaluate(() => {
    // Zoals in table-reports.spec.ts: met deze statusdatum toont de look-ahead beide taken.
    const s = window.__OPS__!.store.getState();
    s.setStatusDate('2026-09-14');
    s.runCPM();
  });
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const fonts: string[] = [];
    const texts: string[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
      // Zie de eerste test: Gantt-paints ná het installeren van de haak horen niet bij het rapport.
      if (!(this.canvas?.dataset.testid ?? '').startsWith('gantt-')) {
        fonts.push(this.font);
        texts.push(String(text));
      }
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsReportFonts', { configurable: true, value: fonts });
    Object.defineProperty(window, '__opsReportTexts', { configurable: true, value: texts });
  });
  const drawnFonts = () => page.evaluate(() => (window as Window & { __opsReportFonts?: string[] }).__opsReportFonts ?? []);
  const drawnTexts = () => page.evaluate(() => (window as Window & { __opsReportTexts?: string[] }).__opsReportTexts ?? []);
  // De gewichten die de browser van een letter echt geladen heeft. `ctx.font` en de berekende
  // font-family tonen de gevraagde naam ook als de letter ontbreekt (review Sol #837, ronde 1).
  const loadedWeights = (family: string) => page.evaluate(fam => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === fam && face.status === 'loaded')
    .map(face => face.weight)
    .sort(), family);
  const exportButton = page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ });
  const readPdf = async (download: Download): Promise<PDFDocument> => {
    const pdfPath = await download.path();
    expect(pdfPath).not.toBeNull();
    return PDFDocument.load(await readFile(pdfPath!));
  };
  const exportPdf = async (): Promise<PDFDocument> => {
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    return readPdf(await downloadPromise);
  };

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  await expect(preview).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });

  // Standaard de letter van vóór de keuzelijst.
  const fontPicker = page.getByLabel(/^(Font:|Lettertype:)$/);
  await expect(fontPicker).toContainText(/^Inter/);
  await fontPicker.click();
  await page.getByRole('option', { name: /^Carlito/ }).click();
  await expect(fontPicker).toContainText(/^Carlito/);
  await expect.poll(() => loadedWeights('OpsReportCarlito'), { timeout: 20_000 }).toEqual(['400', '700']);
  await expect.poll(async () => (await drawnFonts()).some(font => font.includes('OpsReportCarlito')), { timeout: 20_000 }).toBe(true);

  // De PDF bedt Carlito in (regular + bold) en tekent het vinkje uit Inter: vector, geen raster.
  const carlitoFonts = type0BaseFonts(await exportPdf());
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/^\/Carlito-Regular-\d+$/));
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/^\/Carlito-Bold-\d+$/));
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/Inter/));

  // Afkappen uit: de naamkolom krijgt de breedte van de langste naam, gemeten in Carlito.
  await page.evaluate(() => { const t = (window as Window & { __opsReportTexts?: string[] }).__opsReportTexts; t?.splice(0, t.length); });
  const srcBefore = await preview.getAttribute('src');
  await page.locator('[data-ops-report-truncate-names]').uncheck();
  await expect.poll(() => preview.getAttribute('src')).not.toBe(srcBefore);
  await expect.poll(async () => (await drawnTexts()).includes(longName), { timeout: 20_000 }).toBe(true);

  // Wissel naar Liberation Sans en exporteer meteen, terwijl de letter nog laadt (review Sol #837,
  // ronde 1). De test houdt de letter vast tot na de klik. De export moet wachten tot de kolommen op
  // de nieuwe letter gemeten zijn; met de breedte uit Carlito kapte de PDF de lange naam af.
  const heldFonts: string[] = [];
  let releaseFonts = () => {};
  const fontsReleased = new Promise<void>(resolve => { releaseFonts = resolve; });
  const liberationSansFiles = /LiberationSans-(Regular|Bold)\.ttf/;
  await page.route(liberationSansFiles, async route => {
    heldFonts.push(route.request().url());
    await fontsReleased;
    await route.continue();
  });
  await fontPicker.click();
  await page.getByRole('option', { name: /^Liberation Sans/ }).click();
  await expect(fontPicker).toContainText(/^Liberation Sans/);
  await expect.poll(() => heldFonts.length).toBeGreaterThan(0);
  const lateDownload = page.waitForEvent('download');
  await exportButton.click();
  // De klik viel terwijl de letter nog niet geladen was; pas nu laat de test hem door.
  expect(await loadedWeights('OpsReportLiberationSans')).toEqual([]);
  releaseFonts();
  const latePdf = await readPdf(await lateDownload);
  await page.unroute(liberationSansFiles);
  expect(type0BaseFonts(latePdf)).toContainEqual(expect.stringMatching(/^\/LiberationSans-\d+$/));
  const lateTexts = await pdfTextsInFont(latePdf, 'F0', 'src/services/pdf/fonts/LiberationSans-Regular.ttf');
  expect(lateTexts).toContain(longName);
  expect(lateTexts.filter(text => text.endsWith('…') && longName.startsWith(text.slice(0, -1)))).toEqual([]);

  // Eén keuze voor alle rapporten: het blok van een tabelrapport toont hem ook, en de tabel staat erin.
  await page.getByLabel(/^(Report type|Rapporttype)$/).first().click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();
  const tableFontPicker = page.locator('[data-ops-report-options]').getByLabel(/^(Font:|Lettertype:)$/);
  await expect(tableFontPicker).toContainText(/^Liberation Sans/);
  const tableReport = page.locator('[data-ops-table-report]');
  await expect(tableReport).toHaveCSS('font-family', /OpsReportLiberationSans/);

  // Raster-terugval (review Sol #837, ronde 1): zonder CJK-letter in de app valt de vector-export van
  // een CJK-naam terug op een DOM-opname (modern-screenshot). Die opname moet de gekozen letter
  // meenemen. De haak leest alleen de SVG die de opname als afbeelding laadt.
  await page.evaluate(() => {
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    const shots: string[] = [];
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get(this: HTMLImageElement) { return src.get!.call(this) as string; },
      set(this: HTMLImageElement, value: string) {
        if (typeof value === 'string' && value.startsWith('data:image/svg+xml')) shots.push(decodeURIComponent(value.slice(value.indexOf(',') + 1)));
        src.set!.call(this, value);
      },
    });
    Object.defineProperty(window, '__opsDomShots', { configurable: true, value: shots });
  });
  await page.evaluate(id => { window.__OPS__!.store.getState().updateTask(id, { name: '施工 Lettertaak' }); }, letterTaskId);
  await expect(tableReport).toContainText('施工 Lettertaak');
  const rasterPdf = await exportPdf();
  expect(type0BaseFonts(rasterPdf)).not.toContainEqual(expect.stringMatching(/LiberationSans/));
  // Per opname: de families waarvan een `@font-face`-regel met ingebedde bytes in de SVG staat.
  const shotFamilies = await page.evaluate(() => ((window as Window & { __opsDomShots?: string[] }).__opsDomShots ?? [])
    .map(svg => [...svg.matchAll(/@font-face\s*\{([^}]*)\}/g)]
      .filter(([, body]) => /url\(\s*["']?data:/.test(body))
      .map(([, body]) => (/font-family:\s*["']?([^"';]+)/.exec(body)?.[1] ?? '').trim())));
  expect(shotFamilies).toContainEqual(expect.arrayContaining(['OpsReportLiberationSans']));

  // Herstart van de app: de keuze komt terug uit de voorkeuren van het apparaat.
  await page.reload();
  await waitForOps(page);
  const recovery = page.locator('[data-ops-recovery-dialog]');
  const welcome = page.locator('[data-ops-welcome-dialog]');
  await expect(recovery.or(welcome).first()).toBeAttached({ timeout: 15_000 });
  if (await recovery.count() > 0) {
    await recovery.getByRole('button', { name: /^(Don't restore|Niet herstellen)$/ }).click();
    await expect(recovery).toHaveCount(0);
  }
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await expect(page.locator('[data-ops-report-options]').getByLabel(/^(Font:|Lettertype:)$/)).toContainText(/^Liberation Sans/);
  await page.getByLabel(/^(Report type|Rapporttype)$/).first().click();
  await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
  await expect(page.getByLabel(/^(Font:|Lettertype:)$/)).toContainText(/^Liberation Sans/);
});
