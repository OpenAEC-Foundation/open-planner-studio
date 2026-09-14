// Voet op elke pagina (issue #113, "een blad per persoon"): met de optie aan krijgt élke pagina van
// de geëxporteerde vector-PDF de voetstrook (projectnaam, afdrukdatum, legenda); uit ⇒ de voet hangt
// alleen aan de laatste body-tegel. De tegelwiskunde en de preview delen dezelfde `TileLayout`
// (headless bewaakt in check-print-report.ts); hier de echte gebruikersflow: de knop in het paneel,
// de preview die opnieuw rastert, en het bestand dat de gebruiker in handen krijgt.
//
// De controle op de PDF telt per pagina de `/X0 Do`-aanroepen in de content-stream: de vector-
// pagineerder tekent het gedeelde Form-XObject één keer per bronvenster — kop, body en (met de
// optie) voet — dus 3 per pagina mét voet, 2 zonder (A3 liggend, één tijdlijnkolom).
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, type PDFPage } from 'pdf-lib';
import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

async function xobjectDrawsPerPage(pdfBytes: Uint8Array): Promise<number[]> {
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
  return doc.getPages().map(page => (streamText(page).match(/\/X0 Do/g) ?? []).length);
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

test('report footer: met de optie aan tekent elke PDF-pagina de voetstrook, uit alleen de laatste', async ({ page, ops: _ops }) => {
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

  // Standaard aan: kop + body + voet op elke pagina.
  const footerToggle = page.locator('[data-ops-report-repeat-footer]');
  await expect(footerToggle).toBeChecked();
  const withFooter = await xobjectDrawsPerPage(await exportPdf(page));
  expect(withFooter.length).toBe(pagesWithFooter);
  expect(withFooter.every(n => n === 3)).toBe(true);

  // Uit: de preview rastert opnieuw, en de PDF tekent per pagina alleen kop + body — de voet zit in
  // de laatste body-tegel en is dus geen eigen venster meer. Zonder voet past er niet minder op een
  // pagina.
  const before = await firstImg.getAttribute('src');
  await footerToggle.uncheck();
  await expect.poll(() => firstImg.getAttribute('src'), { timeout: 20_000 }).not.toBe(before);
  const pagesWithout = await pages.count();
  expect(pagesWithout).toBeLessThanOrEqual(pagesWithFooter);
  const without = await xobjectDrawsPerPage(await exportPdf(page));
  expect(without.length).toBe(pagesWithout);
  expect(without.every(n => n === 2)).toBe(true);
});
