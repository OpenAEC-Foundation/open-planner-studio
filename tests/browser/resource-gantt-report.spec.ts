// Resourcediagram (issue #113, gfayat): de gebruiker kiest het rapporttype en krijgt de Gantt-afdruk
// gegroepeerd per resource — zonder eerst de schermweergave te verbouwen. De rijen en de gedwongen
// paginaovergangen worden headless bewaakt (tests/planning/check-reports.ts en check-print-report.ts);
// hier alleen de echte gebruikersflow: samenvatting, preview-pagina's per optie en het exportsuffix.
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { expect, seedProject, test } from './fixtures/ops';

test('resourcediagram: rapporttype rendert per resource, opties sturen samenvatting en paginering, export krijgt eigen suffix', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Casco', start: '2026-09-21', finish: '2026-10-16', durationDays: 20 },
    { name: 'Gevel', start: '2026-10-19', finish: '2026-10-30', durationDays: 10 },
  ], 'Resourcediagram');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const [fundering, casco] = s.tasks.map(task => task.id);
    const ploeg = s.addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 1 });
    const kraan = s.addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    s.assignResource(fundering, ploeg, 1);
    s.assignResource(casco, ploeg, 1);
    s.assignResource(casco, kraan, 1);
    window.__OPS__!.store.getState().runCPM();
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  // Bij het gewone Gantt-rapport (standaardtype) staat het vinkje Kritiek pad er wél — de negatieve
  // assertie hieronder zegt anders niets.
  await expect(page.getByLabel(/^(Critical path|Kritiek pad)$/)).toHaveCount(1);
  const typePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  await typePicker.click();
  await page.getByRole('option', { name: /^(Resource diagram|Resourcediagram)$/ }).click();

  // Samenvatting: twee resources, drie toewijzingen (Casco telt onder beide), één taak zonder resource.
  const count = (key: string) => page.locator(`[data-ops-resource-gantt-count="${key}"]`);
  await expect(count('resources')).toHaveText('2');
  await expect(count('assignments')).toHaveText('3');
  await expect(count('unassigned')).toHaveText('1');
  // Geen relatie-optie bij dit type (een taak kan onder meerdere banden staan); Volg weergave evenmin,
  // en ook geen Kritiek pad: dat vinkje kleurt alleen relatielijnen en zou hier enkel de legendaregel
  // wegnemen terwijl de balken rood blijven (manuvarkey op #113). Bij het gewone Gantt-rapport staat het wel.
  await expect(page.getByLabel(/^(Dependencies|Afhankelijkheden)$/)).toHaveCount(0);
  await expect(page.getByLabel(/^(Follow view|Volg weergave)/)).toHaveCount(0);
  await expect(page.getByLabel(/^(Critical path|Kritiek pad)$/)).toHaveCount(0);

  // Preview: alles past op één pagina, en die pagina is een echte gerasterde afbeelding.
  const pages = page.locator('[data-preview-page]');
  await expect(pages).toHaveCount(1);
  await expect(pages.first().locator('img')).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });

  // "Een blad per persoon": elke resource op een nieuwe pagina ⇒ twee pagina's.
  await page.locator('[data-ops-report-option="pageBreakPerResource"]').check();
  await expect(pages).toHaveCount(2);

  // Taken zonder resource erbij ⇒ een derde band, dus een derde pagina; de telling stond er al.
  await page.locator('[data-ops-report-option="includeUnassigned"]').check();
  await expect(pages).toHaveCount(3);
  await expect(count('unassigned')).toHaveText('1');

  // Typelaag (manuvarkey punt 2): Ploeg A (ploeg) en Kraan (materieel) krijgen elk een typekop, en die
  // blijft bij zijn eerste resource op hetzelfde vel — nog steeds drie pagina's, geen leeg vel per type.
  await page.locator('[data-ops-report-option="groupByType"]').check();
  await expect(pages).toHaveCount(3);

  // Rapportageperiode (manuvarkey punt 3): een eigen bereik dat alleen Fundering raakt ⇒ alleen Ploeg A
  // blijft over; Casco (met Kraan) en Gevel vallen buiten de periode en de telling zegt dat. Terug naar
  // Hele project herstelt alles — de export hieronder telt dan weer drie pagina's.
  const periodField = page.locator('[data-ops-report-period="resourceGanttPeriod"]');
  await periodField.getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Custom|Aangepast)$/ }).click();
  const fromInput = page.locator('[data-ops-report-option="resourceGanttPeriod.from"]');
  const toInput = page.locator('[data-ops-report-option="resourceGanttPeriod.to"]');
  await toInput.fill('2026-09-15');
  await fromInput.fill('2026-09-01');
  await expect(count('resources')).toHaveText('1');
  await expect(count('assignments')).toHaveText('1');
  await expect(count('unassigned')).toHaveText('0');
  await expect(count('outsidePeriod')).toHaveText('2');
  await expect(pages).toHaveCount(1);
  await periodField.getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Project duration|Hele project)$/ }).click();
  await expect(count('outsidePeriod')).toHaveCount(0);
  await expect(pages).toHaveCount(3);

  // De échte export (vector-tak, zie paginateVector) moet dezelfde drie pagina's opleveren als de
  // preview: dat is het pad dat de gebruiker in handen krijgt, en de enige plek waar de gedwongen
  // breekposities de PDF in gaan.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-resourcediagram\.pdf$/);
  const pdfPath = await download.path();
  expect(pdfPath).not.toBeNull();
  const pdf = await PDFDocument.load(await readFile(pdfPath!));
  expect(pdf.getPageCount()).toBe(3);
});
