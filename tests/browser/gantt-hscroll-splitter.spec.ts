// Eigenaarscheck desktopapp 2026-10-20 (PR #362): "de horizontale Gantt-scrollbalk verdwijnt een heel
// klein beetje onder de tabel". De grijpzone van de werkruimte-splitter (5 px, z 6) ligt over de
// Gantt-rand aan de kant van de takenlijst; de eerste 5 px van de balk lagen eronder en een klik daar
// ging naar de splitter. Nu begint de balk precies waar de splitter eindigt: geen overlap en geen gat.
// In ar/fa staat de takenlijst rechts, dus raakt de splitter het RECHTERuiteinde van de balk; met de
// splitsing aan is dat de balk van het secundaire pane (de pane-rij is altijd ltr).
// Handelingen via echte muis-events; de brug zet alleen de planning en de splitsing, en leest state.
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

/** Het element op een punt, als testid of klassenaam. */
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

/** Sleep de duim van de balk ver voorbij het einde en lees de eindstand. */
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

    // 1. Ligging: het splitteruiteinde van de balk valt precies op de rand van de grijpzone.
    const splitBox = await box(splitter);
    const barBox = await box(bar);
    expect(splitBox.right - splitBox.left).toBe(5);
    if (rtl) expect(barBox.right).toBe(splitBox.left);
    else expect(barBox.left).toBe(splitBox.right);
    // Het andere uiteinde loopt tot de rand van zijn pane (geen inkorting aan die kant).
    const paneBox = await box(bar.locator('xpath=..'));
    if (rtl) expect(barBox.left).toBe(paneBox.left);
    else expect(barBox.right).toBe(paneBox.right);

    // 2. Klikbaar: de eerste pixel naast de splitter is de balk, de grijpzone zelf blijft de splitter.
    const y = (barBox.top + barBox.bottom) / 2;
    const barEdgeX = rtl ? barBox.right - 1 : barBox.left + 1;
    expect(await hitAt(page, barEdgeX, y)).toBe(testCase.bar);
    expect(await hitAt(page, (splitBox.left + splitBox.right) / 2, y)).toBe('gantt-workspace-splitter');

    // 3. Bereik: de duim tot voorbij het einde slepen eindigt op het einde van de balk, en de kaart
    //    volgt zonder terugsprong (spacer en kaart hebben hetzelfde schuifbereik).
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

    // 4. De splitter blijft sleepbaar, ook op de hoogte van de balk: 40 px van de lijst af.
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
    // Na het slepen ligt de balk weer strak tegen de splitter.
    const splitAfter = await box(splitter);
    const barAfter = await box(bar);
    if (rtl) expect(barAfter.right).toBe(splitAfter.left);
    else expect(barAfter.left).toBe(splitAfter.right);
  });
}
