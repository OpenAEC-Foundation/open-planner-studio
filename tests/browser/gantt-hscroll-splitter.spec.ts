import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';
import { box, chooseLocale, LOCALE_CASES, type Box } from './fixtures/locale';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const AR = LOCALE_CASES.find(locale => locale.code === 'ar')!;
const NL = LOCALE_CASES.find(locale => locale.code === 'nl')!;

const CASES = [
  { name: 'nl', locale: NL, split: false, bar: 'gantt-hscroll' },
  { name: 'ar', locale: AR, split: false, bar: 'gantt-hscroll' },
  { name: 'ar, gesplitst', locale: AR, split: true, bar: 'gantt-hscroll-secondary' },
] as const;

function hitAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(([px, py]) => {
    const element = document.elementFromPoint(px, py) as HTMLElement | null;
    return element?.dataset.testid ?? element?.className ?? 'niets';
  }, [x, y] as const);
}

async function seedLongPlan(page: Page): Promise<void> {
  await seedProject(page, [
    { name: 'Begin', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Midden', start: '2027-06-07', finish: '2027-06-18', durationDays: 10 },
    { name: 'Eind', start: '2028-09-04', finish: '2028-09-15', durationDays: 10 },
  ]);
}

async function dragThumbToEnd(page: Page, bar: Locator, barBox: Box) {
  const y = (barBox.top + barBox.bottom) / 2;
  const startX = await bar.evaluate((node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    const thumb = node.clientWidth * (node.clientWidth / node.scrollWidth);
    return rect.left + (node.scrollLeft / node.scrollWidth) * node.clientWidth + Math.min(10, thumb / 2);
  });
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(barBox.right + 400, y, { steps: 8 });
  await page.mouse.up();
}

for (const testCase of CASES) {
  test(`${testCase.name}: Gantt-balk begint na de splitter, is daar klikbaar en de splitter blijft sleepbaar`, async ({ page, ops: _ops }) => {
    await seedLongPlan(page);
    await chooseLocale(page, testCase.locale);
    if (testCase.split) {
      await page.evaluate(() => window.__OPS__!.store.getState().setSplitView({
        ratio: 0.5,
        secondaryZoom: 30,
        secondaryScrollX: 0,
      }));
      await expect(page.getByTestId('gantt-secondary-canvas')).toBeVisible();
    }
    const splitter = page.getByTestId('gantt-workspace-splitter');
    const bar = page.getByTestId(testCase.bar);
    await expect(bar).toBeVisible();
    const rtl = testCase.locale.rtl;

    const splitBox = await box(splitter);
    const barBox = await box(bar);
    expect(splitBox.right - splitBox.left).toBe(5);
    if (rtl) expect(barBox.right).toBe(splitBox.left);
    else expect(barBox.left).toBe(splitBox.right);
    const paneBox = await box(bar.locator('xpath=..'));
    if (rtl) expect(barBox.left).toBe(paneBox.left);
    else expect(barBox.right).toBe(paneBox.right);

    const y = (barBox.top + barBox.bottom) / 2;
    const barEdgeX = rtl ? barBox.right - 1 : barBox.left + 1;
    expect(await hitAt(page, barEdgeX, y)).toBe(testCase.bar);
    expect(await hitAt(page, (splitBox.left + splitBox.right) / 2, y)).toBe('gantt-workspace-splitter');

    await dragThumbToEnd(page, bar, barBox);
    await expect.poll(() => bar.evaluate((node: HTMLElement) => node.scrollWidth - node.clientWidth - node.scrollLeft))
      .toBeLessThanOrEqual(1);
    const storeX = await page.evaluate(() => {
      const view = window.__OPS__!.store.getState().view;
      return view.splitView ? view.splitView.secondaryScrollX : view.scrollX;
    });
    const scrollLeft = await bar.evaluate((node: HTMLElement) => node.scrollLeft);
    if (!testCase.split) expect(Math.abs(storeX - scrollLeft)).toBeLessThanOrEqual(1);
    else expect(storeX).toBeGreaterThan(0);

    const listWidth = () => page.evaluate(() => window.__OPS__!.store.getState().ui.leftPanelWidth);
    const before = await listWidth();
    const away = rtl ? -1 : 1;
    const grabX = (splitBox.left + splitBox.right) / 2;
    await page.mouse.move(grabX, y);
    await page.mouse.down();
    await page.mouse.move(grabX + away * 20, y, { steps: 3 });
    await page.mouse.move(grabX + away * 40, y, { steps: 3 });
    await page.mouse.up();
    await expect.poll(listWidth).toBeGreaterThanOrEqual(before + 38);
    const splitAfter = await box(splitter);
    const barAfter = await box(bar);
    if (rtl) expect(barAfter.right).toBe(splitAfter.left);
    else expect(barAfter.left).toBe(splitAfter.right);
  });
}
