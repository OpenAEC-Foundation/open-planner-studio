// Rapportkarakterisering: de gebruiker wijzigt de kop en een concrete tekenoptie, waarna zowel de
// levende preview als de echte PDF-export dezelfde actuele waarden moeten gebruiken.
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { expect, seedProject, test } from './fixtures/ops';
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

  // Afdruk moet het ingestelde vel gebruiken, niet opnieuw het standaardrapport openen.
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
  // Knownbug 21: de echte lintknop start dezelfde export als Exporteer PDF, zonder remount.
  const print = page.locator('[data-tour-anchor="ribbon:report:printPreview"]');
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
