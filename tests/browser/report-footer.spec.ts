// Voet op elke pagina (issue #113, "een blad per persoon"): met de optie aan krijgt élke pagina van
// de geëxporteerde vector-PDF de voetstrook (projectnaam, afdrukdatum, legenda) — ook wanneer de
// tijdlijn over meerdere pagina's naast elkaar staat; uit ⇒ de voet hangt alleen aan de laatste
// body-tegel. De tegelwiskunde, de voetbreedte en de preview delen dezelfde `TileLayout` (headless
// bewaakt in check-print-report.ts); hier de echte gebruikersflow: de knop in het paneel, de preview
// die opnieuw rastert, en het bestand dat de gebruiker in handen krijgt.
//
// De controle op de PDF leest per pagina de content-stream: de vector-pagineerder tekent per
// bronvenster `q  x y w h re W n  cm  /X0 Do  …tekst…  Q`. De voetstrook is het venster met de
// clip-rechthoek op de onderrand van het printgebied (y = marge 24 + paginanummerruimte 14), laag
// (de strook is 50 logische px × schaal — de bovengrens laat de lettergrootte 125% toe; een
// body-tegel op die y is een volle pagina en dus honderden punten hoog), en — dat is het contract —
// altijd vanaf x = 24 en één volle printbreedte breed, dus nooit per kolom gesneden. Inhoud: de
// tekst wordt per venster geëmit ónder dezelfde clip, dus het voetvenster van élke pagina moet
// tekstoperatoren dragen (projectnaam, afdrukdatum, legenda, merk) — de glyfs zelf zijn
// gesubset-gecodeerd, dus we tellen `Tj`/`TJ`, niet de letters.
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, type PDFPage } from 'pdf-lib';
import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

const MARGIN_PT = 24;
const PAGE_NUMBER_PT = 14;

interface PageShape { width: number; draws: number; footerRects: { x: number; y: number; w: number; h: number; textOps: number }[] }

async function pageShapes(pdfBytes: Uint8Array): Promise<PageShape[]> {
  const doc = await PDFDocument.load(pdfBytes);
  const streamText = (page: PDFPage): string => {
    const contents = page.node.Contents();
    if (!contents) return '';
    const streams = contents instanceof PDFArray
      ? contents.asArray().map(ref => doc.context.lookup(ref))
      : [contents];
    return streams.map(stream => {
      if (!(stream instanceof PDFRawStream)) return '';
      const raw = stream.contents;
      const filter = stream.dict.get(PDFName.of('Filter'));
      const bytes = filter ? inflateSync(raw) : raw;
      return Buffer.from(bytes).toString('latin1');
    }).join('\n');
  };
  return doc.getPages().map(page => {
    const text = streamText(page);
    // Per tegelvenster (`q  x y w h re … Q`, met een stack voor geneste `q`/`Q` van halfdoorzichtige
    // tekst): de clip-rechthoek en het aantal tekstoperatoren erbinnen.
    const windows: { x: number; y: number; w: number; h: number; textOps: number }[] = [];
    const tokens = text.split(/\s+/);
    let depth = 0;
    let current: { depth: number; win: typeof windows[number] } | null = null;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === 'q') {
        depth++;
        if (!current && tokens[i + 5] === 're') {
          current = { depth, win: { x: Number(tokens[i + 1]), y: Number(tokens[i + 2]), w: Number(tokens[i + 3]), h: Number(tokens[i + 4]), textOps: 0 } };
        }
      } else if (tok === 'Q') {
        if (current && depth === current.depth) { windows.push(current.win); current = null; }
        depth--;
      } else if (current && (tok === 'Tj' || tok === 'TJ')) {
        current.win.textOps++;
      }
    }
    // Een clip-rechthoek op de onderrand van het printgebied die geen volle pagina hoog is, is de
    // voetstrook (50 logische px × schaal; bij een smal rapport is de schaal groter dan 0,75, bij
    // lettergrootte 125 % de strook hoger — vandaar geen krappe band). Een body-tegel die tot die
    // onderrand reikt is een volle pagina en dus meer dan de halve papierhoogte.
    const footerRects = windows.filter(r => Math.abs(r.y - (MARGIN_PT + PAGE_NUMBER_PT)) < 0.01 && r.h > 15 && r.h < page.getHeight() / 2);
    return { width: page.getWidth(), draws: (text.match(/\/X0 Do/g) ?? []).length, footerRects };
  });
}

/** Elke pagina: precies één voetvenster, vanaf de linkermarge, één volle printbreedte breed, mét tekst. */
function expectFullFooterOnEveryPage(shapes: PageShape[]): void {
  expect(shapes.length).toBeGreaterThan(1);
  for (const shape of shapes) {
    expect(shape.footerRects).toHaveLength(1);
    const footer = shape.footerRects[0];
    expect(footer.x).toBeCloseTo(MARGIN_PT, 1);
    expect(footer.w).toBeCloseTo(shape.width - 2 * MARGIN_PT, 1);
    // Projectnaam, afdrukdatum, merk en minstens één legendalabel: nooit een lege grijze strook.
    expect(footer.textOps).toBeGreaterThanOrEqual(4);
  }
}

async function exportPdf(page: Page): Promise<Uint8Array> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-planning\.pdf$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  return new Uint8Array(await readFile(path!));
}

test('report footer: elke PDF-pagina krijgt de volle voetstrook — ook per tijdlijnkolom — en zonder de optie alleen de laatste', async ({ page, ops: _ops }) => {
  // Genoeg rijen voor ruim meer dan twee pagina's op A3 liggend.
  const tasks = Array.from({ length: 160 }, (_, i) => ({
    name: `Taak ${i + 1}`, start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }));
  await seedProject(page, tasks, 'Voet per pagina');

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const pages = page.locator('[data-preview-page]');
  const firstImg = pages.first().locator('img');
  await expect(firstImg).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  const pagesWithFooter = await pages.count();
  expect(pagesWithFooter).toBeGreaterThan(2);

  // Standaard aan: op elke pagina één voetstrook, vanaf de linkermarge en één volle printbreedte breed.
  const footerToggle = page.locator('[data-ops-report-repeat-footer]');
  await expect(footerToggle).toBeChecked();
  const withFooter = await pageShapes(await exportPdf(page));
  expect(withFooter.length).toBe(pagesWithFooter);
  expect(withFooter.every(shape => shape.draws === 3)).toBe(true);
  expectFullFooterOnEveryPage(withFooter);

  // Tijdlijn over 2 pagina's: kolom 2 tekent de bevroren naamstrip + body, maar de voet blijft op
  // ÉLKE pagina het volle venster vanaf x = 24 — niet de kolomsnede (review #135, bevinding 1).
  const before2 = await firstImg.getAttribute('src');
  await page.getByLabel(/^(Timeline over:|Tijdlijn over:)$/).first().click();
  await page.getByRole('option', { name: /^2 (pages|pagina's)$/ }).click();
  await expect.poll(() => firstImg.getAttribute('src'), { timeout: 20_000 }).not.toBe(before2);
  const twoCols = await pageShapes(await exportPdf(page));
  expect(twoCols.length).toBe(await pages.count());
  expect(twoCols.length).toBeGreaterThan(withFooter.length);
  expectFullFooterOnEveryPage(twoCols);
  await page.getByLabel(/^(Timeline over:|Tijdlijn over:)$/).first().click();
  await page.getByRole('option', { name: /^1 (page|pagina)$/ }).click();
  await expect.poll(() => pages.count(), { timeout: 20_000 }).toBe(pagesWithFooter);

  // Uit: de preview rastert opnieuw, en de PDF tekent per pagina alleen kop + body — geen enkele
  // pagina heeft nog een losse voetstrook. Zonder voet past er niet minder op een pagina.
  const before = await firstImg.getAttribute('src');
  await footerToggle.uncheck();
  await expect.poll(() => firstImg.getAttribute('src'), { timeout: 20_000 }).not.toBe(before);
  const pagesWithout = await pages.count();
  expect(pagesWithout).toBeGreaterThan(2);
  expect(pagesWithout).toBeLessThanOrEqual(pagesWithFooter);
  const without = await pageShapes(await exportPdf(page));
  expect(without.length).toBe(pagesWithout);
  for (const shape of without) {
    expect(shape.draws).toBe(2);
    expect(shape.footerRects).toHaveLength(0);
  }
});

test('report footer: klein project met de tijdlijn over 2 pagina\'s — één rij hoog, twee vellen breed — krijgt op beide vellen de volle voet', async ({ page, ops: _ops }) => {
  await seedProject(page, Array.from({ length: 6 }, (_, i) => ({
    name: `Taak ${i + 1}`, start: '2026-09-07', finish: '2026-10-16', durationDays: 30,
  })), 'Klein, breed');
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const pages = page.locator('[data-preview-page]');
  const firstImg = pages.first().locator('img');
  await expect(firstImg).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  await expect(pages).toHaveCount(1);
  // Eén pagina: de voet blijft onder de laatste rij — geen los voetvenster, wel gewoon kop + body.
  const single = await pageShapes(await exportPdf(page));
  expect(single).toHaveLength(1);
  expect(single[0].draws).toBe(2);
  expect(single[0].footerRects).toHaveLength(0);

  const before = await firstImg.getAttribute('src');
  await page.getByLabel(/^(Timeline over:|Tijdlijn over:)$/).first().click();
  await page.getByRole('option', { name: /^2 (pages|pagina's)$/ }).click();
  await expect.poll(() => firstImg.getAttribute('src'), { timeout: 20_000 }).not.toBe(before);
  await expect(pages).toHaveCount(2);
  const twoCols = await pageShapes(await exportPdf(page));
  expect(twoCols).toHaveLength(2);
  expectFullFooterOnEveryPage(twoCols);
});
