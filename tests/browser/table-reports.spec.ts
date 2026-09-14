// Tabelrapporten (discussie #31): de gebruiker kiest een rapporttype in het Rapport-tabblad en
// krijgt een gerenderde tabel met samenvatting; een optiewijziging ververst het rapport live en de
// PDF-export levert een bestand met het rapport-eigen suffix. De rekenkant wordt headless bewaakt
// (tests/planning/check-reports.ts); hier alleen de echte gebruikersflow door de DOM.
import { expect, seedProject, test } from './fixtures/ops';

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

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const typePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  await typePicker.click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();

  const report = page.locator('[data-ops-table-report="look-ahead"]');
  await expect(report).toBeVisible();
  // Beide taken raken de standaardperiode "volgende maand" vanaf de statusdatum (14 sep – 13 okt):
  // twee echte rijen (op naam, niet op aantal — de lege-staat is óók één <tr>).
  const rows = report.locator('[data-ops-report-section="rows"] tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Fundering');
  await expect(rows.nth(1)).toContainText('Casco');
  // Samenvatting: "Activities 2" als label-waardepaar, niet een los cijfer ergens in het blok.
  await expect(report.locator('[data-ops-report-summary] > div').first()).toHaveText(/^(Activities|Activiteiten)2$/);

  // Rapportageperiode (issue #120) naar "volgende week": alleen de lopende taak (Fundering) blijft
  // over; Casco valt eruit. De datumvelden tonen het berekende venster alleen-lezen.
  const periodField = page.locator('[data-ops-report-period="lookAheadPeriod"]');
  await periodField.getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Next week|Volgende week)$/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Fundering');
  await expect(report).not.toContainText('Casco');
  const fromInput = periodField.locator('[data-ops-report-option="lookAheadPeriod.from"]');
  const toInput = periodField.locator('[data-ops-report-option="lookAheadPeriod.to"]');
  // Bij een preset zijn het alleen-lezen teksten in de datumnotatie van de app (standaard d-m-j),
  // geen invoervelden.
  await expect(fromInput).toHaveAttribute('data-ops-readonly', 'true');
  await expect(fromInput).toHaveText('14-09-2026');
  await expect(toInput).toHaveText('20-09-2026');
  // Reviewbevinding: labels en waarden mogen bij de standaardbreedte van de instellingenkolom
  // niet afkappen — gemeten op scroll- versus clientbreedte, niet alleen op de tekst.
  const fitsOwnBox = (el: HTMLElement) => el.scrollWidth <= el.clientWidth + 1;
  for (const el of await periodField.locator('[data-ops-report-period-label], [data-ops-readonly]').all()) {
    expect(await el.evaluate(fitsOwnBox)).toBe(true);
  }
  // Ronde 3: óók de gekozen waarde in de keuzelijsten van het optieblok mag niet afkappen
  // ("Hele pr…" bij een label naast de Select).
  const optionValues = page.locator('[data-ops-report-options] .ops-select__value');
  expect(await optionValues.count()).toBeGreaterThan(0);
  for (const el of await optionValues.all()) {
    expect(await el.evaluate(fitsOwnBox)).toBe(true);
  }

  // Aangepast: de velden worden bewerkbaar en starten op de presetdatums; een eigen bereik in
  // oktober haalt Casco terug (Fundering blijft: die had vóór de statusdatum moeten starten en
  // staat daarom altijd in de lijst). Een omgekeerd bereik wordt gemeld en NIET toegepast — het
  // rapport blijft op het laatste geldige venster staan.
  await periodField.getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Custom|Aangepast)$/ }).click();
  await expect(fromInput).toBeEnabled();
  await expect(fromInput).toHaveValue('2026-09-14');
  // De invoervelden moeten een volledige datum plus kalenderknop kunnen tonen (eerste review: 18 px),
  // en het label ervoor mag niet afkappen (tweede review: "Başlang" in het Turks).
  for (const input of [fromInput, toInput]) {
    expect((await input.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(120);
  }
  for (const el of await periodField.locator('[data-ops-report-period-label]').all()) {
    expect(await el.evaluate(fitsOwnBox)).toBe(true);
  }
  await toInput.fill('2026-10-16');
  await fromInput.fill('2026-10-05');
  await expect(rows).toHaveCount(2);
  await expect(report).toContainText('Casco');
  await toInput.fill('2026-10-01');
  await expect(periodField.getByRole('alert')).toBeVisible();
  await expect(rows).toHaveCount(2);
  await toInput.fill('2026-10-16');
  await expect(periodField.getByRole('alert')).toHaveCount(0);
  // Een leeggemaakt veld is óók ongeldig: gemeld, niet toegepast (het rapport houdt 5–16 okt).
  await fromInput.fill('');
  await expect(periodField.getByRole('alert')).toBeVisible();
  await expect(report).toContainText('Casco');
  await fromInput.fill('2026-10-05');
  await expect(periodField.getByRole('alert')).toHaveCount(0);

  // Review-bevinding 1: een export op een VEROUDERDE planning rekent eerst door én exporteert pas
  // ná de re-render — het rapport op het scherm draagt dan geen "planning gewijzigd"-melding meer
  // en de store staat niet meer op stale wanneer het bestand komt.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const casco = s.tasks.find(t => t.name === 'Casco')!;
    s.updateTask(casco.id, { time: { ...casco.time, scheduleDuration: 40 } });
  });
  await expect(report.locator('[role=note]')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-look-ahead\.pdf$/);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  await expect(report.locator('[role=note]')).toHaveCount(0);
});

// Resourcebelasting (issue #119): gegroepeerd per resource (naam alleen op de eerste rij van de
// groep) en schakelbaar tussen week- en maandaggregatie; de rapportageperiode beperkt de rijen.
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
  const report = page.locator('[data-ops-table-report="resourcebelasting"]');
  await expect(report).toBeVisible();
  const rows = report.locator('[data-ops-report-section="rows"] tbody tr');
  // Zes kalenderweken (7 sep t/m 12 okt) met vraag; de resourcenaam staat alleen op de eerste rij.
  await expect(rows).toHaveCount(6);
  await expect(rows.nth(0).locator('td').first()).toHaveText('Ploeg A');
  await expect(rows.nth(1).locator('td').first()).toHaveText('');

  // Maandaggregatie: september en oktober — twee rijen, opnieuw gegroepeerd; de gekozen waarde
  // en de maandlabels blijven leesbaar bij de standaardkolombreedte.
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

  // Rapportageperiode "volgende week" vanaf de statusdatum (14–20 sep) ⇒ alleen september.
  const periodField = page.locator('[data-ops-report-period="resourceLoadPeriod"]');
  await periodField.getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Next week|Volgende week)$/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(report).toContainText(/(Period|Periode): /);
});
