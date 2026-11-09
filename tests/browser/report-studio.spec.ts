// Het nieuwe Rapport-tabblad achter de feature flag `reportRedesign` (issue #817). Eén werkroute van een
// planner: tabblad openen, op het papier klikken om een stap te openen, een kolom toevoegen, Standaard en
// ongedaan maken, de zijbalk inklappen, in een zwevend venster typen en via de zwevende knop exporteren.
// De flag is een fixture (de instelling zelf), de rest zijn echte klikken en toetsen.
import { expect, seedProject, test } from './fixtures/ops';

test('rapport-studio: klik op het papier opent de stap, kolom toevoegen, zijbalk inklappen', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering storten', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Wanden metselen', start: '2026-09-21', finish: '2026-10-09', durationDays: 15 },
  ], 'Rapportstudio');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ featureFlags: { ...s.ui.featureFlags, reportRedesign: true } });
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const studio = page.locator('[data-rs-studio]');
  await expect(studio).toBeVisible();
  // Met de flag heeft het tabblad geen lintinhoud: alleen de tabnamen blijven staan.
  await expect(page.locator('.ribbon-content')).toHaveCount(0);
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();

  // Eerste bezoek: stap 1 staat open, met boven het eerste blad de aanwijzing dat het papier klikbaar is.
  await expect(page.locator('[data-rs-step-body="tasks"]')).toBeVisible();
  await expect(page.locator('[data-rs-paper-hint]')).toBeVisible();

  // Bewegen over de kop: de naam staat boven het blad en dekt het blad niet af.
  const sheet = page.locator('[data-preview-page="0"]');
  const sheetBox = (await sheet.boundingBox())!;
  await page.mouse.move(sheetBox.x + sheetBox.width * 0.3, sheetBox.y + sheetBox.height * 0.04);
  const label = page.locator('[data-rs-region-label]');
  await expect(label).toBeVisible();
  expect((await label.boundingBox())!.y + (await label.boundingBox())!.height).toBeLessThanOrEqual(sheetBox.y + 1);

  // Klik op de kolomkop "Start" op het papier: de stap Kolommen opent en de rij Start krijgt focus.
  await expect(page.locator('[data-rs-step-body="columns"]')).toHaveCount(0);
  await page0.locator('text', { hasText: /^Start$/ }).first().click();
  await expect(page.locator('[data-rs-paper-hint]')).toHaveCount(0);
  await expect(page.locator('[data-rs-step-body="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-column="task.time.start"]')).toBeFocused();

  // Klik op de tijdlijn: de stap Balken en tijdlijn opent.
  await page0.locator('text', { hasText: /^(August|Augustus|October|Oktober) 2026$/ }).first().click();
  await expect(page.locator('[data-rs-step-body="bars"]')).toBeVisible();

  // Kolom Kalenderdagen toevoegen via de kiezer, met het toetsenbord. De headless browser draait in het
  // Engels; de kop volgt de taal van de app.
  const calendarDays = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl') ? 'Kalenderdagen' : 'Calendar days';
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-add-column]').click();
  await page.keyboard.type(calendarDays);
  await expect(page.locator('[data-rs-pick]').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-rs-column="task.time.calendarDays"]')).toBeVisible();
  // Na Enter is de kiezer dicht en staat de focus op "Kolom toevoegen", klaar voor de volgende.
  await expect(page.locator('[data-rs-picker]')).toHaveCount(0);
  await expect(page.locator('[data-rs-add-column]')).toBeFocused();
  await expect(page0.locator('text', { hasText: new RegExp(`^${calendarDays}$`) }).first()).toBeAttached();
  // Bewaard per apparaat, in de volgorde van de lijst.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').columns))
    .toEqual(['task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.start', 'task.time.finish', 'task.time.completion', 'task.time.calendarDays']);
  // Alt+pijl omhoog verplaatst de kolom een plek.
  await page.locator('[data-rs-column="task.time.calendarDays"]').focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').columns.at(-1)))
    .toBe('task.time.completion');

  // Standaard op Kolommen, daarna A2 in Pagina, dan ongedaan maken: de kolommen komen terug, A2 blijft.
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'));
  await page.locator('[data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await page.locator('[data-rs-step-head="page"]').click();
  await page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A2"]').click();
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns.length).toBe(7);
  expect((await saved()).paperSize).toBe('A2');

  // Zijbalk inklappen: de stapknoppen blijven, exporteren gaat via de zwevende knop linksonder.
  await page.locator('[data-rs-sidebar-toggle]').click();
  await expect(page.locator('[data-rs-rail-step="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-export]')).toHaveCount(0);
  const fab = page.locator('[data-rs-fab-export]');
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAccessibleName(/^(PDF exporteren|Export PDF)$/);
  // Ingeklapt opent een klik op het papier dezelfde stap als klein venster.
  await page0.locator('text', { hasText: /^Start$/ }).first().click();
  await expect(page.locator('[data-rs-popover="columns"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rs-popover]')).toHaveCount(0);

  // Typen in een zwevend venster: elke toets blijft in het veld (de focus sprong eerder na één letter weg).
  await page.locator('[data-rs-rail-step="headerFooter"]').click();
  const company = page.locator('[data-rs-popover="headerFooter"] #rs-company');
  await company.fill('');
  await company.pressSequentially('abc');
  await expect(company).toHaveValue('abc');
  await expect(company).toBeFocused();
  await page.keyboard.press('Escape');

  const download = page.waitForEvent('download');
  await fab.click();
  expect((await download).suggestedFilename()).toMatch(/^Rapportstudio-.+\.pdf$/);

  // Uitklappen: de knop in de zijbalk is terug, de zwevende knop weg.
  await page.locator('[data-rs-sidebar-toggle]').click();
  await expect(page.locator('[data-rs-export]')).toBeVisible();
  await expect(fab).toHaveCount(0);
});
