// Statusbalk: geen tekst breekt af, wordt afgekapt of valt onder de vensterrand, ook niet in een smal
// venster, in de langste talen en met drie lange baselinenamen. De balk krijgt dan extra rijen. Opent
// De Akkers via de gewone open-route; de zwaarste stand (alles tegelijk in beeld) zet de brug als
// fixture, want het gaat hier om de opmaak en niet om de handelingen die elke melding oproepen.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const BAR = '[data-tour-anchor="status-bar"]';
const WIDTHS = [1920, 1500, 1366, 1280, 1024, 800, 640, 480];
const LONG_BASELINES = [
  'Contract gegund aanbesteding fase 1',
  'Re-plan after frost delay blok C',
  'Herplanning na vertraging fundering',
];

interface BarMeasure {
  height: number;
  /** Elke tekst in de balk, per element: verdwijnt er een, dan valt die op tegen de breedste meting. */
  texts: string[];
  problems: string[];
}

/** Meet elke tekst: op één regel, volledig binnen de balk, en de balk zelf helemaal in het venster. */
function measureBar(page: Page, allowBreak?: string): Promise<BarMeasure> {
  return page.evaluate(async ({ selector, allowBreak }) => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const bar = document.querySelector<HTMLElement>(selector)!;
    const rect = bar.getBoundingClientRect();
    const problems: string[] = [];
    if (Math.abs(rect.bottom - innerHeight) > 0.5) problems.push(`balk eindigt op ${rect.bottom}, venster op ${innerHeight}`);
    const published = getComputedStyle(document.documentElement).getPropertyValue('--statusbar-height');
    if (parseFloat(published) !== Math.round(rect.height)) problems.push(`--statusbar-height ${published} bij balk van ${rect.height}px`);
    const workspace = document.querySelector('[data-tour-anchor="gantt-panel"]')!.getBoundingClientRect();
    if (workspace.bottom > rect.top + 0.5) problems.push(`werkruimte loopt door tot ${workspace.bottom}, balk begint op ${rect.top}`);

    const owners = new Set<HTMLElement>();
    const walker = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim()) owners.add(node.parentElement!);
    }
    const texts: string[] = [];
    for (const owner of owners) {
      const text = owner.textContent!.trim();
      texts.push(text);
      const range = document.createRange();
      range.selectNodeContents(owner);
      const lines = [...range.getClientRects()].filter(r => r.width > 0);
      const tops = lines.map(r => r.top);
      // Kleiner dan een halve rij: een lettertypewissel binnen één regel (ar, fa, lo) mag iets schelen.
      if (text !== allowBreak && Math.max(...tops) - Math.min(...tops) >= 12) problems.push(`breekt af: ${text}`);
      const box = range.getBoundingClientRect();
      if (box.left < rect.left - 0.5 || box.right > rect.right + 0.5 || box.top < rect.top - 0.5 || box.bottom > rect.bottom + 0.5) {
        problems.push(`valt buiten de balk: ${text}`);
      }
      for (let el: HTMLElement | null = owner; el && el !== bar.parentElement; el = el.parentElement) {
        if (getComputedStyle(el).overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) problems.push(`afgekapt: ${text}`);
      }
    }
    return { height: Math.round(rect.height), texts: texts.sort(), problems };
  }, { selector: BAR, allowBreak });
}

const setLocale = (page: Page, locale: string) => page.evaluate(async lng => {
  const { setLocale: apply } = await import('/src/i18n/config.ts' as string);
  await apply(lng);
}, locale);

/** Alles wat de balk kan tonen tegelijk: vier waarschuwingen, verouderd, selectie, drie baselines. */
const showEverything = (page: Page) => page.evaluate(names => {
  const store = window.__OPS__!.store;
  store.getState().saveBaseline(names[2]);
  store.setState(s => {
    s.baselines[0].name = names[0];
    s.baselines[1].name = names[1];
    const others = s.baselines.filter(b => b.id !== s.activeBaselineId).map(b => b.id);
    s.comparedBaselineIds = [others[0], others[1]];
    s.ui.showBaselineOverlay = true;
    s.ui.aiMode = true;
    s.ui.debugTerminalEnabled = true;
    s.ui.autoCalcCPM = false;
    s.scheduleStale = true;
    s.isDirty = true;
    s.selectedTaskIds = s.tasks.slice(0, 12).map(t => t.id);
    s.cpmResult!.violatedConstraintTaskIds = s.tasks.slice(0, 2).map(t => t.id);
  });
}, LONG_BASELINES);

test('statusbalk: elke tekst blijft heel en in beeld, in elke taal en vensterbreedte', async ({ page, ops: _ops }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto('/?open=examples/showcase-rijwoningen-de-akkers.ifc');
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  const bar = page.locator(BAR);
  await expect(bar).toContainText('83');

  // In een breed venster verandert er niets: De Akkers past op één rij van 24 px.
  await setLocale(page, 'en');
  expect((await measureBar(page)).height).toBe(24);

  await showEverything(page);
  await expect(page.locator('[data-ops-baseline-legend] [data-ops-baseline-swatch]')).toHaveCount(3);

  const locales = await page.evaluate(async () => (await import('/src/i18n/config.ts' as string)).LOCALES as string[]);
  expect(locales.length).toBeGreaterThanOrEqual(28);
  for (const locale of locales) {
    await setLocale(page, locale);
    await page.setViewportSize({ width: 2600, height: 900 });
    const reference = await measureBar(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const measured = await measureBar(page);
      expect(measured.problems, `${locale} op ${width}px`).toEqual([]);
      expect(measured.texts, `${locale} op ${width}px`).toEqual(reference.texts);
    }
  }

  // Fijnmazig, om afrondingsgrenzen te vangen waar een rij net wel of net niet past.
  for (const locale of ['nl', 'en']) {
    await setLocale(page, locale);
    for (let width = 1700; width >= 800; width -= 7) {
      await page.setViewportSize({ width, height: 900 });
      expect((await measureBar(page)).problems, `${locale} op ${width}px`).toEqual([]);
    }
  }

  // De grootste tekstschaal uit de instellingen, in de talen met de langste statusteksten.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiFontScale: 125 }));
  for (const locale of ['hr', 'fi', 'ru', 'de']) {
    await setLocale(page, locale);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      expect((await measureBar(page)).problems, `${locale} op ${width}px, tekst 125%`).toEqual([]);
    }
  }
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiFontScale: 100 }));
  await setLocale(page, 'en');

  // Laatste redmiddel: een naam die breder is dan het hele venster mag afbreken, maar blijft compleet.
  const huge = Array.from({ length: 14 }, (_, i) => `Herplanningsvariant${i}`).join('');
  await page.evaluate(name => window.__OPS__!.store.setState(s => { s.baselines[0].name = name; }), huge);
  await page.setViewportSize({ width: 800, height: 900 });
  expect((await measureBar(page, huge)).problems).toEqual([]);
});
