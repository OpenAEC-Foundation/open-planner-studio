import { expect, seedProject, test } from './fixtures/ops';
import { box, chooseLocale, LOCALE_CASES } from './fixtures/locale';
import type { Page } from '@playwright/test';

const activeTab = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.activeRibbonTab);

async function wheelOver(page: Page, selector: string, deltaY: number, deltaX = 0): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} niet zichtbaar`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(deltaX, deltaY);
}

test('lint: muiswiel wisselt tabs, gepersisteerde schakelaar wisselt en bewaart, UI-actieknop opent zijn dialoog herhaald', async ({ page, ops: _ops }) => {
  expect(await activeTab(page)).toBe('start');
  await wheelOver(page, '.ribbon-tab[data-ops-ribbon-tab="resources"]', 100);
  await expect.poll(() => activeTab(page)).toBe('planning');
  await wheelOver(page, '.ribbon-tabs', -100);
  await expect.poll(() => activeTab(page)).toBe('start');
  await wheelOver(page, '.ribbon-tabs', -100);
  await page.waitForTimeout(100);
  expect(await activeTab(page)).toBe('start');
  await wheelOver(page, '.ribbon-content', 100);
  await expect.poll(() => activeTab(page)).toBe('planning');
  await wheelOver(page, '.ribbon-content', -100);
  await expect.poll(() => activeTab(page)).toBe('start');
  const size = page.viewportSize()!;
  await page.locator('[data-ops-ribbon-tab="planning"]').click();
  await page.setViewportSize({ width: 480, height: size.height });
  const scroller = page.locator('.ribbon-content-scroll');
  await expect.poll(() => scroller.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await scroller.evaluate(el => el.scrollLeft)).toBe(0);
  await wheelOver(page, '.ribbon-content', 60, 150);
  await expect.poll(() => scroller.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await activeTab(page)).toBe('planning');
  await page.setViewportSize(size);
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await expect.poll(() => activeTab(page)).toBe('start');

  const [taskId] = await seedProject(page, [{ name: 'Duurconcept', start: '2026-09-07', finish: '2026-09-08', durationDays: 2 }]);
  const duration = () => page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration, taskId);
  await page.locator('[data-ops-ribbon-tab="table"]').click();
  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
  }, taskId);
  const durationInput = page.locator('[data-ops-duration-value]');
  await durationInput.fill('3');
  await expect(durationInput).toBeFocused();
  expect(await duration()).toBe(2);
  await wheelOver(page, '.ribbon-tabs', 100);
  await expect.poll(() => activeTab(page)).toBe('ifc');
  await expect(durationInput).toHaveCount(0);
  expect(await duration()).toBe(3);
  await page.locator('[data-ops-ribbon-tab="start"]').click();

  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  const settings = page.locator('.settings-dialog');
  await settings.locator('[data-ops-settings-group="workspace"]').click();
  const wheelSetting = settings.locator('[data-ops-ribbon-wheel-setting]');
  await expect(wheelSetting).toBeChecked();
  await wheelSetting.click();
  await expect(wheelSetting).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('ops-ribbonWheelSwitchesTabs'))).toBe('false');
  await settings.locator('.modal-close-btn').click();
  await expect(settings).toBeHidden();
  await wheelOver(page, '.ribbon-tabs', 100);
  await page.waitForTimeout(100);
  expect(await activeTab(page)).toBe('start');

  await page.locator('.ribbon-tab').filter({ hasText: /^(View|Beeld)$/ }).click();
  const floatBand = page.getByRole('button', { name: /^(Float band|Spelingsband)/ });
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand);

  await floatBand.click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand)).toBe(!before);
  expect(await page.evaluate(() => localStorage.getItem('ops-showFloatBand'))).toBe(String(!before));
  await expect.poll(() => floatBand.evaluate(el => el.classList.contains('active'))).toBe(!before);

  await floatBand.click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand)).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('ops-showFloatBand'))).toBe(String(before));

  await page.locator('.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  const projectInfo = page.getByRole('button', { name: /^(Project settings|Projectinstellingen)/ });
  for (let i = 0; i < 2; i++) {
    await projectInfo.click();
    const dialog = page.locator('[data-ops-project-dialog="info"]');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('lint: een keuzemenu-item (Mijlpaal → Startmijlpaal) voegt precies die mijlpaal toe', async ({ page, ops: _ops }) => {
  const before = await page.evaluate(() => window.__OPS__!.store.getState().tasks.length);
  await page.getByRole('button', { name: /^(Milestone|Mijlpaal)( ▾)?$/ }).click();
  await page.getByRole('button', { name: /^(Start milestone|Startmijlpaal)$/ }).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(before + 1);
  const added = await page.evaluate(() => {
    const tasks = window.__OPS__!.store.getState().tasks;
    const task = tasks[tasks.length - 1];
    return { isMilestone: task.isMilestone, milestoneKind: task.milestoneKind };
  });
  expect(added).toEqual({ isMilestone: true, milestoneKind: 'START' });
});

async function expectBarColorsMenuInView(page: Page): Promise<void> {
  const title = page.locator('[data-ops-bar-colors-menu]');
  await expect(title).toBeVisible();
  const viewport = page.viewportSize()!;
  const panel = await box(title.locator('xpath=ancestor::div[contains(@style, "fixed")]'));
  expect(panel.left, 'linkerrand').toBeGreaterThanOrEqual(0);
  expect(panel.right, 'rechterrand').toBeLessThanOrEqual(viewport.width);
  expect(panel.bottom, 'onderrand').toBeLessThanOrEqual(viewport.height);
  const hint = page.locator('[data-ops-bar-colors-hint]');
  expect((await box(hint)).right, 'uitleg past in het paneel').toBeLessThanOrEqual(panel.right);
  expect(await hint.evaluate(element => element.scrollWidth <= element.clientWidth), 'uitleg is niet afgekapt').toBe(true);
}

async function expectBarColorsBlockApart(page: Page): Promise<void> {
  const editor = page.locator('[data-ops-bar-colors-editor]');
  const rtl = await page.evaluate(() => document.documentElement.dir === 'rtl');
  const field = await box(editor.locator('label span').first());
  const choice = await box(page.locator('[data-ops-bar-color-mode="auto"] .ribbon-check-label'));
  if (rtl) expect(field.right, 'veld springt verder in').toBeLessThan(choice.right);
  else expect(field.left, 'veld springt verder in').toBeGreaterThan(choice.left);
  const panelBackground = await page.locator('[data-ops-bar-colors-menu]').evaluate(
    title => getComputedStyle(title.closest<HTMLElement>('div[style*="fixed"]')!).backgroundColor,
  );
  const block = await editor.evaluate(element => getComputedStyle(element.parentElement!).backgroundColor);
  expect(block, 'eigen vlak').not.toBe(panelBackground);
}

async function openBarColors(page: Page): Promise<void> {
  await page.locator('[data-ops-ribbon-tab="beeld"]').click();
  await page.locator('[data-ops-bar-colors-toggle]').click();
}

const barColors = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.barColorSelection);

test('lint: menu Balkkleuren staat in beeld, de kleuren horen bij Kritiek pad, en de tekst is overal gelijk', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 900, height: 760 });
  await openBarColors(page);
  await expectBarColorsMenuInView(page);

  const editor = page.locator('[data-ops-bar-colors-editor]');
  const critical = page.locator('[data-ops-bar-color-mode="critical"]');
  const auto = page.locator('[data-ops-bar-color-mode="auto"]');
  const category = page.locator('[data-ops-bar-color-mode="category"]');
  expect((await box(critical)).bottom).toBeLessThanOrEqual((await box(editor)).top + 1);
  expect((await box(editor)).bottom).toBeLessThanOrEqual((await box(auto)).top + 1);
  await expectBarColorsBlockApart(page);

  const textColor = (selector: string) => page.locator(selector).first().evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    return getComputedStyle(walker.nextNode()!.parentElement!).color;
  });
  const dim = await textColor('[data-ops-bar-colors-hint]');
  expect(await textColor('[data-ops-bar-color-mode="auto"]')).not.toBe(dim);
  expect(await textColor('[data-ops-bar-color-mode="category"]')).not.toBe(dim);

  const fontSizes = () => page.locator('[data-ops-bar-colors-menu]').evaluate(title => {
    const panel = title.closest<HTMLElement>('div[style*="fixed"]')!;
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    const sizes = new Set<string>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim()) sizes.add(getComputedStyle(node.parentElement!).fontSize);
    }
    return [...sizes];
  });
  expect(await fontSizes()).toHaveLength(1);

  await editor.locator('input[type="color"]').first().fill('#123456');
  expect((await barColors(page)).colors?.critical).toBe('#123456');
  await category.click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('[data-ops-bar-colors-menu]')).toBeVisible();
  expect(await fontSizes()).toHaveLength(1);
  await expectBarColorsMenuInView(page);
  await auto.click();
  expect((await barColors(page)).mode).toBe('auto');
  await expect(page.locator('[data-ops-bar-colors-menu]')).toBeVisible();
  await expect(editor).toHaveCount(0);
  await page.mouse.click(5, 400);
  await expect(page.locator('[data-ops-bar-colors-menu]')).toHaveCount(0);
  await page.locator('[data-ops-bar-colors-toggle]').click();
  await expect(editor).toHaveCount(0);
  await critical.click();
  await expect(page.locator('[data-ops-bar-colors-menu]')).toBeVisible();
  await expect(editor).toBeVisible();
  await expect(editor.locator('input[type="color"]').first()).toHaveValue('#123456');
  await editor.getByRole('button').click();
  expect((await barColors(page)).colors).toBeUndefined();

  await page.setViewportSize({ width: 1343, height: 760 });
  await expectBarColorsMenuInView(page);
  await page.setViewportSize({ width: 420, height: 760 });
  await expectBarColorsMenuInView(page);
  await page.keyboard.press('Escape');
  await page.locator('[data-ops-ribbon-tab="beeld"]').click({ position: { x: 2, y: 2 } });
  await page.mouse.click(5, 400);
  await expect(page.locator('[data-ops-bar-colors-menu]')).toHaveCount(0);

  await page.setViewportSize({ width: 1343, height: 300 });
  await openBarColors(page);
  await expectBarColorsMenuInView(page);
  await page.mouse.click(5, 280);
  await expect(page.locator('[data-ops-bar-colors-menu]')).toHaveCount(0);

  await page.setViewportSize({ width: 1343, height: 760 });
  await chooseLocale(page, LOCALE_CASES[0]);
  await openBarColors(page);
  await expectBarColorsMenuInView(page);
  await expectBarColorsBlockApart(page);
  await page.setViewportSize({ width: 420, height: 760 });
  await expectBarColorsMenuInView(page);
  await expectBarColorsBlockApart(page);
});
