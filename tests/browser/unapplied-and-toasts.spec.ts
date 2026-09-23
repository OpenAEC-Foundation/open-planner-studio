// Gebruikstest rekenprofielen 24-09, B2 en B5 — in de echte gebruikersflow.
// B2: een niet-toegepaste wijziging in Backstage → Projectinfo gaat niet meer stil verloren bij
//     wegnavigeren (Terug, zijbalk, Escape, linttabblad); de actiebalk plakt onderaan in beeld en
//     toont een gekleurd blok "niet toegepast".
// B5: de meldingenstapel bedekt nooit een knop van een open dialoog (Projectinfo, wizard) of de
//     plakkende actiebalk.
// `window.__OPS__` zet alleen de meldingen als fixture (`notify`) en leest de uitkomst; alle geteste
// handelingen zijn echte klikken en toetsen.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const SHOTS = process.env.OPS_UI_2409_SHOTS;

const CONVENTION = '[data-ops-convention="clampNegativeFreeFloat"]';
const conventionOverride = (page: Page) => page.evaluate(() =>
  window.__OPS__!.store.getState().project.schedulingProfile?.overrides?.clampNegativeFreeFloat ?? null);
const activeTab = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.activeRibbonTab);
const section = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.backstageSection);

async function toProjectInfo(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Project info|Projectinfo)$/ }).click();
  await expect(page.locator('[data-ops-scheduling-profile-section]')).toBeVisible();
}

test('B2: wegnavigeren met een niet-toegepaste wijziging vraagt Toepassen/Verwerpen/Annuleren', async ({ page, ops: _ops }) => {
  const dialog = page.locator('[data-ops-unapplied-dialog]');
  const marker = page.locator('[data-ops-project-info-unapplied]');
  const bar = page.locator('[data-ops-project-info-actions]');
  const apply = bar.getByRole('button', { name: /^(Apply|Toepassen)$/ });

  // Zonder wijziging: Terug gaat gewoon terug, geen dialoog, geen markering.
  await toProjectInfo(page);
  await expect(marker).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => activeTab(page)).toBe('start');

  // Wijzigen ⇒ gekleurd blok "niet toegepast"; de actiebalk met Toepassen staat in beeld zonder scrollen.
  await toProjectInfo(page);
  expect(await conventionOverride(page)).toBeNull();
  await page.locator(CONVENTION).check();
  await expect(marker).toBeVisible();
  const viewport = page.viewportSize()!;
  const applyBox = (await apply.boundingBox())!;
  expect(applyBox.y + applyBox.height).toBeLessThanOrEqual(viewport.height);
  expect(applyBox.y).toBeGreaterThanOrEqual(0);
  // De balk plakt tegen de onderrand van het scrollgebied (geen doorschemerende strook eronder).
  const mainBox = (await page.locator('.backstage-main').boundingBox())!;
  const barBox = (await bar.boundingBox())!;
  expect(Math.abs(barBox.y + barBox.height - (mainBox.y + mainBox.height))).toBeLessThanOrEqual(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b2-01-markering-niet-toegepast.png` });

  // Terug ⇒ dialoog; Annuleren houdt de sectie en de wijziging.
  await page.locator('[data-ops-backstage-back]').click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-ops-unapplied-choice="cancel"]')).toBeFocused();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b2-02-dialoog-terug.png` });
  await dialog.locator('[data-ops-unapplied-choice="cancel"]').click();
  await expect(dialog).toHaveCount(0);
  expect(await activeTab(page)).toBe('file');
  await expect(page.locator(CONVENTION)).toBeChecked();
  await expect(marker).toBeVisible();

  // Escape ⇒ dialoog; Escape in de dialoog = Annuleren (Backstage blijft open).
  await page.locator('.backstage-title').click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await activeTab(page)).toBe('file');
  await expect(page.locator(CONVENTION)).toBeChecked();

  // Linttabblad ⇒ dialoog (het lint staat buiten Backstage); annuleren.
  await page.locator('.ribbon-tabs button').filter({ hasText: /^(Planning)$/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-unapplied-choice="cancel"]').click();
  expect(await activeTab(page)).toBe('file');

  // Zijbalk → Instellingen ⇒ dialoog; Verwerpen ⇒ naar Instellingen, niets in de store.
  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Settings|Instellingen)$/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-unapplied-choice="discard"]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => section(page)).toBe('settings');
  expect(await conventionOverride(page)).toBeNull();
  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Project info|Projectinfo)$/ }).click();
  await expect(page.locator(CONVENTION)).not.toBeChecked();
  await expect(marker).toHaveCount(0);

  // Verwerpen in de plakkende balk zet de draft terug zonder weg te gaan.
  await page.locator(CONVENTION).check();
  await expect(marker).toBeVisible();
  await bar.locator('[data-ops-project-info-discard]').click();
  await expect(page.locator(CONVENTION)).not.toBeChecked();
  await expect(marker).toHaveCount(0);

  // Opnieuw wijzigen, Terug ⇒ Toepassen in de dialoog ⇒ toegepast én terug naar de werkruimte.
  await page.locator(CONVENTION).check();
  await page.locator('[data-ops-backstage-back]').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-unapplied-choice="apply"]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => conventionOverride(page)).toBe(true);
  await expect.poll(() => activeTab(page)).toBe('start');
});

/** Bedekt geen enkele melding `button`? Box-overlap én een echte hit-test in het midden van de knop. */
async function expectNotCovered(page: Page, button: Locator): Promise<void> {
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  const toasts = await page.locator('.ops-toast').all();
  expect(toasts.length).toBeGreaterThan(0);
  const topmostAtCenter = await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  expect(topmostAtCenter, 'de knop is in zijn midden niet de bovenste laag').toBe(true);
  for (const toast of toasts) {
    const t = await toast.boundingBox();
    if (!t) continue;
    const onTop = await toast.evaluate((el) => getComputedStyle(el.closest('.ops-toast-stack')!).zIndex);
    const overlaps = t.x < box.x + box.width && box.x < t.x + t.width && t.y < box.y + box.height && box.y < t.y + t.height;
    // Een overlap mag alleen als de stapel onder de dialoogbackdrop ligt (smal venster).
    if (overlaps) expect(Number(onTop)).toBeLessThan(50);
  }
}

async function seedToasts(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    for (let i = 1; i <= 3; i++) {
      s.notify({
        severity: 'error', messageKey: 'notifications.openFailed', dedupeKey: `b5-${i}`,
        detail: `Testmelding ${i}: een wat langere regel zodat de stapel hoog genoeg wordt om over de dialoogvoet te vallen.`,
      });
    }
  });
  await expect(page.locator('.ops-toast')).toHaveCount(3);
}

async function openProjectInfoDialog(page: Page): Promise<void> {
  await page.locator('.ribbon-tabs button').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  await page.locator('button.ribbon-btn').filter({ hasText: /^(Project info|Projectinfo)$/ }).click();
  await expect(page.locator('[data-ops-project-dialog="info"]')).toBeVisible();
}

test('B5: meldingen bedekken geen knoppen van de Projectinfo-dialoog, de wizard of de plakkende balk', async ({ page, ops: _ops }) => {
  await seedToasts(page);

  // Projectinfo-dialoog: de stapel gaat naast de dialoog.
  await openProjectInfoDialog(page);
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'side');
  await expectNotCovered(page, page.locator('[data-ops-project-cancel]'));
  await expectNotCovered(page, page.locator('[data-ops-project-primary]'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-01-projectinfo-dialoog.png` });
  await page.locator('[data-ops-project-cancel]').click();
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'default');

  // Nieuw-projectwizard (via de tabstrip-plus).
  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  await page.locator('[data-ops-new-project-choice]').click();
  await expect(page.locator('[data-ops-project-dialog="new"]')).toBeVisible();
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'side');
  await expectNotCovered(page, page.locator('[data-ops-project-cancel]'));
  await expectNotCovered(page, page.locator('[data-ops-project-primary]'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-02-wizard.png` });
  await page.locator('[data-ops-project-cancel]').click();

  // Smal venster: geen ruimte naast de dialoog ⇒ de stapel zakt onder de backdrop.
  await page.setViewportSize({ width: 640, height: 720 });
  await openProjectInfoDialog(page);
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'underModal');
  await expectNotCovered(page, page.locator('[data-ops-project-cancel]'));
  await expectNotCovered(page, page.locator('[data-ops-project-primary]'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-03-smal-venster.png` });
  await page.locator('[data-ops-project-cancel]').click();
  await page.setViewportSize({ width: 1280, height: 720 });

  // Backstage → Projectinfo met een niet-toegepaste wijziging: de stapel schuift boven de balk.
  await toProjectInfo(page);
  await page.locator(CONVENTION).check();
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'above');
  const bar = page.locator('[data-ops-project-info-actions]');
  await expectNotCovered(page, bar.getByRole('button', { name: /^(Apply|Toepassen)$/ }));
  await expectNotCovered(page, bar.locator('[data-ops-project-info-discard]'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-04-backstage-balk.png` });
});
