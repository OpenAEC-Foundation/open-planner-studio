import { expect, seedProject, test } from './fixtures/ops';

test('bedieningssignalen: gewone controls wijzen, uitgeschakelde ribbonbediening weigert en presentatiehint noemt Esc', async ({ page, ops: _ops }) => {
  const startTab = page.locator('.ribbon-tab').first();
  await expect(startTab).toHaveCSS('cursor', 'pointer');

  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await expect(page.locator('.ribbon-tab.active').filter({ hasText: /^Planning$/ })).toBeVisible();
  const tabTransitions = await page.evaluate(() => [...new Set([...document.querySelectorAll('.ribbon-tab')]
    .flatMap(t => getComputedStyle(t).transitionProperty.split(',').map(p => p.trim())))]);
  expect(tabTransitions.filter(p => p !== 'background-color' && p !== 'color')).toEqual([]);
  const tabTops = await page.evaluate(() => {
    const titleBottom = document.querySelector('.title-bar')!.getBoundingClientRect().bottom;
    return [...document.querySelectorAll('.ribbon-tab')].map(t => t.getBoundingClientRect().top - titleBottom);
  });
  expect(Math.min(...tabTops)).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: /^(Link|Relatie)$/ }).click();
  const nativeDisabled = page.getByRole('menuitem', { name: /Link selected tasks|Geselecteerde taken koppelen/ });
  await expect(nativeDisabled).toBeVisible();
  await expect(nativeDisabled).toHaveCSS('cursor', 'not-allowed');

  for (const tab of await page.locator('.ribbon-tab').all()) {
    await tab.click();
    if (await page.locator('button.ribbon-btn[aria-disabled="true"]').count()) break;
  }
  const customDisabled = page.locator('button.ribbon-btn[aria-disabled="true"]').first();
  await expect(customDisabled).toBeVisible();
  await expect(customDisabled).toHaveCSS('cursor', 'not-allowed');

  await page.locator('.ribbon-tab').filter({ hasText: /^(Beeld|View)$/ }).click();
  await page.keyboard.press('F11');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(false);
  await expect(startTab).toBeVisible();

  const [taskId] = await seedProject(page, [
    { name: 'Presentatietaak', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
  ]);
  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
  }, taskId);
  const duration = page.locator('[data-ops-task-duration] [data-ops-duration-value]').first();
  await expect(duration).toHaveValue('5');
  await duration.fill('7');
  expect(await page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration, taskId)).toBe(5);

  await page.getByRole('button', { name: /^(Presentation|Presentatie)$/ }).click();
  await expect(page.locator('text=/Esc.*F11|F11.*Esc/')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(false);
  await expect(duration).toHaveValue('7');
  expect(await page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration, taskId)).toBe(7);
});
