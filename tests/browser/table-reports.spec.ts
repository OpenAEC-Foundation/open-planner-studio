import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';
import { chooseLocale, LOCALE_CASES } from './fixtures/locale';

async function typeDate(page: Page, field: Locator, iso: string): Promise<void> {
  const [y, m, d] = iso ? iso.split('-') : ['', '', ''];
  const segments = field.getByRole('textbox');
  await segments.nth(0).fill(d);
  await segments.nth(1).fill(m);
  await segments.nth(2).fill(y);
  await page.keyboard.press('Tab');
}

async function shownDate(field: Locator): Promise<string> {
  const [d, m, y] = await field.getByRole('textbox').evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
  return `${y}-${m}-${d}`;
}

test('table reports: rapporttype kiezen rendert tabel, optie ververst live, PDF-export gebruikt eigen suffix', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Casco', start: '2026-09-21', finish: '2026-10-16', durationDays: 20 },
  ], 'Tabelrapporten');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setStatusDate('2026-09-14');
    s.runCPM();
  });

  await page.locator('[data-ops-ribbon-tab="resources"]').click();
  const openResources = page.locator('[data-tour-anchor="ribbon:resources:openResourcePanel"]');
  await openResources.click();
  const addResource = page.locator('[data-ops-resource-add]');
  await expect(addResource).toBeVisible();
  await openResources.click();
  await expect(addResource).toHaveCount(0);
  await openResources.click();
  await expect(addResource).toBeVisible();
  await page.locator('[data-ops-ribbon-tab="report"]').click();
  await expect(addResource).toHaveCount(0);

  await page.locator('[data-tour-anchor="ribbon-tab:file"]').click();
  const backstage = page.getByRole('region', { name: /^(File menu|Bestandsmenu)$/ });
  await backstage.locator('.backstage-sidebar').getByRole('button', { name: /^(Print|Afdruk)$/ }).click();
  await backstage.getByRole('button', { name: /^(Open print preview|Open afdrukvoorbeeld)$/ }).click();
  await expect(backstage).toHaveCount(0);
  const reportWorkspace = page.locator('[data-tour-anchor="report-panel"]').filter({
    has: page.locator('form#report-pdf-export'),
  });
  await expect(reportWorkspace).toBeVisible();
  await expect(addResource).toHaveCount(0);
  expect(await page.evaluate(() => {
    const { activeRibbonTab, showResourcePanel, resourcePanelDocked } = window.__OPS__!.store.getState().ui;
    return { activeRibbonTab, showResourcePanel, resourcePanelDocked };
  })).toEqual({ activeRibbonTab: 'report', showResourcePanel: true, resourcePanelDocked: false });

  const typePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  await typePicker.click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();

  const report = page.locator('[data-ops-table-report]');
  await expect(report).toBeVisible();
  const rows = report.locator('[data-ops-report-section="rows"] tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Fundering');
  await expect(rows.nth(1)).toContainText('Casco');
  await expect(report.locator('[data-ops-report-summary] > div').first()).toHaveText(/^(Activities|Activiteiten)2$/);

  const periodField = page.locator('[data-ops-report-period="lookAheadPeriod"]');
  await periodField.getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Next week|Volgende week)$/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Fundering');
  await expect(report).not.toContainText('Casco');
  const fromInput = periodField.locator('[data-ops-report-option="lookAheadPeriod.from"]');
  const toInput = periodField.locator('[data-ops-report-option="lookAheadPeriod.to"]');
  await expect(fromInput).toHaveAttribute('data-ops-readonly', 'true');
  await expect(fromInput).toHaveText('14-09-2026');
  await expect(toInput).toHaveText('20-09-2026');
  const fitsOwnBox = (el: HTMLElement) => el.scrollWidth <= el.clientWidth + 1;
  for (const el of await periodField.locator('[data-ops-report-period-label], [data-ops-readonly]').all()) {
    expect(await el.evaluate(fitsOwnBox)).toBe(true);
  }
  const optionValues = page.locator('[data-ops-report-options] .ops-select__value');
  expect(await optionValues.count()).toBeGreaterThan(0);
  for (const el of await optionValues.all()) {
    expect(await el.evaluate(fitsOwnBox)).toBe(true);
  }

  await periodField.getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Custom|Aangepast)$/ }).click();
  await expect(fromInput.getByRole('textbox').first()).toBeEnabled();
  await expect.poll(() => shownDate(fromInput)).toBe('2026-09-14');
  for (const input of [fromInput, toInput]) {
    expect((await input.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(120);
  }
  for (const el of await periodField.locator('[data-ops-report-period-label]').all()) {
    expect(await el.evaluate(fitsOwnBox)).toBe(true);
  }
  await typeDate(page, toInput, '2026-10-16');
  await typeDate(page, fromInput, '2026-10-05');
  await expect(rows).toHaveCount(2);
  await expect(report).toContainText('Casco');
  await typeDate(page, toInput, '2026-10-01');
  await expect(periodField.getByRole('alert')).toBeVisible();
  await expect(rows).toHaveCount(2);
  await typeDate(page, toInput, '2026-10-16');
  await expect(periodField.getByRole('alert')).toHaveCount(0);
  await typeDate(page, fromInput, '');
  await expect(periodField.getByRole('alert')).toBeVisible();
  await expect(report).toContainText('Casco');
  await typeDate(page, fromInput, '2026-10-05');
  await expect(periodField.getByRole('alert')).toHaveCount(0);

  const paper = page.getByLabel(/^(Paper:|Papier:)$/);
  await paper.click();
  await page.getByRole('option', { name: 'A2', exact: true }).click();
  const orientation = page.getByLabel(/^(Orientation:|Oriëntatie:)$/);
  await orientation.click();
  await page.getByRole('option', { name: /^(Portrait|Staand)$/ }).click();

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const casco = s.tasks.find(t => t.name === 'Casco')!;
    s.updateTask(casco.id, { time: { ...casco.time, scheduleDuration: 40 } });
  });
  await expect(report.locator('[role=note]')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  const print = page.locator('form#report-pdf-export button[type="submit"]');
  await print.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Tabelrapporten-look-ahead.pdf');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  await expect(report.locator('[role=note]')).toHaveCount(0);
  await expect(print).toBeFocused();
  await expect(typePicker).toContainText('Look-ahead');
  await expect.poll(() => shownDate(fromInput)).toBe('2026-10-05');
  await expect.poll(() => shownDate(toInput)).toBe('2026-10-16');
  await expect(paper).toContainText('A2');
  await expect(orientation).toContainText(/^(Portrait|Staand)$/);
  const pdfPath = await download.path();
  expect(pdfPath).not.toBeNull();
  const pdf = await PDFDocument.load(await readFile(pdfPath!));
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  for (const pdfPage of pdf.getPages()) {
    expect(pdfPage.getWidth()).toBeCloseTo(1190.55, 1);
    expect(pdfPage.getHeight()).toBeCloseTo(1683.78, 1);
  }

  const exports = [
    { option: /^Look-ahead$/, nl: 'look-ahead', en: 'look-ahead' },
    { option: /^(Critical & near-critical|Kritiek & near-critical)$/, nl: 'kritiek', en: 'critical' },
    { option: /^(Progress report|Voortgangsrapport)$/, nl: 'voortgang', en: 'progress' },
    { option: /^(Progress curve|Voortgangscurve)$/, nl: 'voortgangscurve', en: 'progress-curve', chart: true },
    { option: /^(Schedule health|Planningsgezondheid)$/, nl: 'gezondheid', en: 'schedule-health' },
    { option: /^(Resource loading|Resourcebelasting)$/, nl: 'resourcebelasting', en: 'resource-loading' },
    { option: /^(Resource assignments|Resourcetoewijzingen)$/, nl: 'toewijzingen', en: 'resource-assignments' },
    { option: /^(WBS summary|WBS-samenvatting)$/, nl: 'wbs', en: 'wbs' },
    { option: /^(Milestone overview|Mijlpalen-overzicht)$/, nl: 'mijlpalen', en: 'milestones', table: false },
    { option: /^Variance$/, nl: 'afwijkingen', en: 'variance', table: false },
  ];
  for (const locale of [LOCALE_CASES[2], LOCALE_CASES[3]]) {
    await chooseLocale(page, locale);
    for (const reportExport of exports) {
      await typePicker.click();
      await page.getByRole('option', { name: reportExport.option }).click();
      if (reportExport.table !== false) await expect(report).toBeVisible();
      if (reportExport.chart) {
        await expect(page.locator('[data-ops-report-kpi]')).toHaveCount(4);
        await expect(page.locator('[data-ops-report-chart] svg[role="img"]')).toBeVisible();
      }
      if (reportExport.table === false) {
        const opts = page.locator('[data-ops-report-options]');
        await expect(opts).toBeVisible();
        await expect(opts.locator('#report-opt-paper')).toBeVisible();
        await expect(opts.locator('#report-opt-orientation')).toBeVisible();
        await expect(opts.locator('#report-opt-font')).toBeVisible();
      }
      const nextDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
      const download = await nextDownload;
      expect(download.suggestedFilename()).toBe(`Tabelrapporten-${reportExport[locale.code]}.pdf`);
      if (reportExport.table === false) {
        const pdfPath = await download.path();
        expect(pdfPath).not.toBeNull();
        const pdf = await PDFDocument.load(await readFile(pdfPath!));
        expect(pdf.getPageCount()).toBeGreaterThan(0);
        for (const pdfPage of pdf.getPages()) {
          expect(pdfPage.getWidth()).toBeCloseTo(1190.55, 1);
          expect(pdfPage.getHeight()).toBeCloseTo(1683.78, 1);
        }
      }
    }
  }

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

test('table reports: resourcebelasting groepeert per resource en aggregeert per week of maand', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Casco', start: '2026-09-21', finish: '2026-10-16', durationDays: 20 },
  ], 'Belasting');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const [a, b] = s.tasks;
    const crew = s.addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 1 });
    s.assignResource(a.id, crew, 1);
    s.assignResource(b.id, crew, 1);
    s.setStatusDate('2026-09-14');
    s.runCPM();
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await page.getByLabel(/^(Report type|Rapporttype)$/).first().click();
  await page.getByRole('option', { name: /^(Resource loading|Resourcebelasting)$/ }).click();
  const report = page.locator('[data-ops-table-report]');
  await expect(report).toBeVisible();
  const rows = report.locator('[data-ops-report-section="rows"] tbody tr');
  await expect(rows).toHaveCount(6);
  await expect(rows.nth(0).locator('td').first()).toHaveText('Ploeg A');
  await expect(rows.nth(1).locator('td').first()).toHaveText('');

  await page.getByLabel(/^(Aggregation:|Aggregatie:)$/).first().click();
  await page.getByRole('option', { name: /^(Monthly|Per maand)$/ }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('td').nth(2)).toHaveText(/2026/);
  for (const el of await page.locator('[data-ops-report-options] .ops-select__value').all()) {
    expect(await el.evaluate((node: HTMLElement) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  await expect(rows.nth(0).locator('td').first()).toHaveText('Ploeg A');
  await expect(rows.nth(1).locator('td').first()).toHaveText('');
  await expect(report.locator('[data-ops-report-summary]')).toContainText(/^(Resources1(Months|Maanden)2)/);

  const periodField = page.locator('[data-ops-report-period="resourceLoadPeriod"]');
  await periodField.getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Next week|Volgende week)$/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(report).toContainText(/(Period|Periode): /);
});
