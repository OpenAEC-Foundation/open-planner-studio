import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const SHOTS = process.env.OPS_UI_2409_SHOTS;

const OPTION = '[data-ops-open-ended]';
const optionValue = (page: Page) => page.evaluate(() =>
  window.__OPS__!.store.getState().project.schedulingOptions?.makeOpenEndedCritical ?? null);
const activeTab = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.activeRibbonTab);
const section = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.backstageSection);

async function toProjectInfo(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).click();
  await expect(page.locator('[data-ops-scheduling-profile-section]')).toBeVisible();
}

test('B2: wegnavigeren met een niet-toegepaste wijziging vraagt Toepassen/Verwerpen/Annuleren', async ({ page, ops: _ops }) => {
  const dialog = page.locator('[data-ops-unapplied-dialog]');
  const marker = page.locator('[data-ops-project-info-unapplied]');
  const bar = page.locator('[data-ops-project-info-actions]');
  const apply = bar.getByRole('button', { name: /^(Apply|Toepassen)$/ });

  await toProjectInfo(page);
  await expect(marker).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => activeTab(page)).toBe('start');

  await toProjectInfo(page);
  expect(await optionValue(page)).toBeNull();
  await page.locator(OPTION).check();
  await expect(marker).toBeVisible();
  expect(await bar.evaluate(el => getComputedStyle(el).position)).toBe('static');
  await apply.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize()!;
  const applyBox = (await apply.boundingBox())!;
  expect(applyBox.y + applyBox.height).toBeLessThanOrEqual(viewport.height);
  expect(applyBox.y).toBeGreaterThanOrEqual(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b2-01-markering-niet-toegepast.png` });

  await page.locator('[data-ops-backstage-back]').click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-ops-unapplied-choice="cancel"]')).toBeFocused();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b2-02-dialoog-terug.png` });
  await dialog.locator('[data-ops-unapplied-choice="cancel"]').click();
  await expect(dialog).toHaveCount(0);
  expect(await activeTab(page)).toBe('file');
  await expect(page.locator(OPTION)).toBeChecked();
  await expect(marker).toBeVisible();

  await page.locator('.backstage-title').click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await activeTab(page)).toBe('file');
  await expect(page.locator(OPTION)).toBeChecked();

  await page.locator('.ribbon-tabs button').filter({ hasText: /^(Planning)$/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-unapplied-choice="cancel"]').click();
  expect(await activeTab(page)).toBe('file');

  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(App settings|App-instellingen)$/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-unapplied-choice="discard"]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => section(page)).toBe('settings');
  expect(await optionValue(page)).toBeNull();
  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).click();
  await expect(page.locator(OPTION)).not.toBeChecked();
  await expect(marker).toHaveCount(0);

  await page.locator(OPTION).check();
  await expect(marker).toBeVisible();
  await bar.locator('[data-ops-project-info-discard]').click();
  await expect(page.locator(OPTION)).not.toBeChecked();
  await expect(marker).toHaveCount(0);

  await page.locator(OPTION).check();
  await page.locator('[data-ops-backstage-back]').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-unapplied-choice="apply"]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => optionValue(page)).toBe(true);
  await expect.poll(() => activeTab(page)).toBe('start');
});

const activeDoc = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId);

test('B2: F1 en Ctrl+1 lopen niet dwars door een niet-toegepaste draft of de keuzedialoog', async ({ page, ops: _ops }) => {
  const dialog = page.locator('[data-ops-unapplied-dialog]');
  const firstId = await activeDoc(page);
  const secondId = await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  expect(secondId).not.toBe(firstId);
  expect(await activeDoc(page)).toBe(secondId);

  await toProjectInfo(page);
  await page.locator(OPTION).check();
  await page.locator('.backstage-title').click();

  await page.keyboard.press('Control+1');
  await expect(dialog).toHaveCount(0);
  expect(await activeDoc(page)).toBe(secondId);
  expect(await section(page)).toBe('project-info');
  await expect(page.locator(OPTION)).toBeChecked();

  await page.keyboard.press('F1');
  await expect(dialog).toBeVisible();
  expect(await section(page)).toBe('project-info');

  await page.keyboard.press('F1');
  await page.keyboard.press('Control+1');
  await expect(dialog).toBeVisible();
  expect(await section(page)).toBe('project-info');
  expect(await activeDoc(page)).toBe(secondId);

  await dialog.locator('[data-ops-unapplied-choice="cancel"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(OPTION)).toBeChecked();
  await page.locator('.backstage-title').click();
  await page.keyboard.press('F1');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-unapplied-choice="discard"]').click();
  await expect.poll(() => section(page)).toBe('help');
  expect(await optionValue(page)).toBeNull();

  await page.locator('.backstage-title').click();
  await page.keyboard.press('Control+1');
  await expect.poll(() => activeDoc(page)).toBe(firstId);
});

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
  await page.locator('button.ribbon-btn').filter({ hasText: /^(Project\s+settings|Project\u00ad?instellingen)$/ }).click();
  await expect(page.locator('[data-ops-project-dialog="info"]')).toBeVisible();
}

test('B5: meldingen bedekken geen knoppen van de Projectinfo-dialoog, de wizard of de plakkende balk', async ({ page, ops: _ops }) => {
  await seedToasts(page);

  await openProjectInfoDialog(page);
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'side');
  await expectNotCovered(page, page.locator('[data-ops-project-cancel]'));
  await expectNotCovered(page, page.locator('[data-ops-project-primary]'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-01-projectinfo-dialoog.png` });
  await page.locator('[data-ops-project-cancel]').click();
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'default');

  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  await page.locator('[data-ops-new-project-choice]').click();
  await expect(page.locator('[data-ops-project-dialog="new"]')).toBeVisible();
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'side');
  await expectNotCovered(page, page.locator('[data-ops-project-cancel]'));
  await expectNotCovered(page, page.locator('[data-ops-project-primary]'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-02-wizard.png` });
  await page.locator('[data-ops-project-cancel]').click();

  await page.setViewportSize({ width: 640, height: 720 });
  await openProjectInfoDialog(page);
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'underModal');
  await expectNotCovered(page, page.locator('[data-ops-project-cancel]'));
  await expectNotCovered(page, page.locator('[data-ops-project-primary]'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-03-smal-venster.png` });
  await page.locator('[data-ops-project-cancel]').click();
  await page.setViewportSize({ width: 1280, height: 720 });

  await toProjectInfo(page);
  await page.locator(OPTION).check();
  const bar = page.locator('[data-ops-project-info-actions]');
  await bar.scrollIntoViewIfNeeded();
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'above');
  await expectNotCovered(page, bar.getByRole('button', { name: /^(Apply|Toepassen)$/ }));
  await expectNotCovered(page, bar.locator('[data-ops-project-info-discard]'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-04-backstage-balk.png` });

  await page.locator('[data-ops-backstage-back]').click();
  const unapplied = page.locator('[data-ops-unapplied-dialog]');
  await expect(unapplied).toBeVisible();
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'side');
  for (const choice of ['cancel', 'discard', 'apply']) {
    await expectNotCovered(page, unapplied.locator(`[data-ops-unapplied-choice="${choice}"]`));
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/b5-05-keuzedialoog.png` });
  await unapplied.locator('[data-ops-unapplied-choice="cancel"]').click();
  await expect(unapplied).toHaveCount(0);
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'above');

  await page.locator('[data-ops-backstage-back]').click();
  await expect(unapplied).toBeVisible();
  await page.setViewportSize({ width: 520, height: 720 });
  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'underModal');
  for (const choice of ['cancel', 'discard', 'apply']) {
    await expectNotCovered(page, unapplied.locator(`[data-ops-unapplied-choice="${choice}"]`));
  }
  await unapplied.locator('[data-ops-unapplied-choice="cancel"]').click();
  await page.setViewportSize({ width: 1280, height: 720 });
});

test('B2: Escape in een open keuzelijst in Backstage sluit alleen de lijst', async ({ page, ops: _ops }) => {
  await toProjectInfo(page);
  const trigger = page.locator('.backstage-main [aria-haspopup="listbox"]').first();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(await activeTab(page)).toBe('file');
  expect(await section(page)).toBe('project-info');
});
