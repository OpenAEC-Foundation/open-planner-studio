// Statusbalk: altijd precies één rij, zonder overloop en zonder afgebroken tekst, op elke breedte en
// in elke taal. Past niet alles, dan voegt de balk samen of verbergt hij; wat weg is, staat nog in de
// tooltip van het waarschuwingenkopje of van de ⋯-knop. Opent De Akkers via de gewone open-route; de
// zwaarste stand (alles tegelijk in beeld) zet de brug als fixture.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const BAR = '[data-tour-anchor="status-bar"]';
const MORE = '[data-ops-status-more]';
const SUMMARY = '[data-ops-status-warning="summary"]';
const WIDTHS = [1920, 1500, 1366, 1280, 1024, 800, 640, 480];
const LONG_BASELINES = [
  'Contract gegund aanbesteding fase 1',
  'Re-plan after frost delay blok C',
  'Herplanning na vertraging fundering',
];

interface BarMeasure {
  height: number;
  /** De zichtbare teksten, per element. */
  visible: string[];
  /** De tooltips waar samengevoegde en verborgen tekst nog in staat. */
  tooltips: string[];
  problems: string[];
}

/** Meet de balk: één rij, niets loopt over, elke tekst op één regel en volledig binnen de balk. */
function measureBar(page: Page): Promise<BarMeasure> {
  return page.evaluate(async ({ selector, more, summary }) => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const bar = document.querySelector<HTMLElement>(selector)!;
    const rect = bar.getBoundingClientRect();
    const problems: string[] = [];
    if (Math.round(rect.height) !== 24) problems.push(`balk is ${rect.height}px hoog`);
    if (Math.abs(rect.bottom - innerHeight) > 0.5) problems.push(`balk eindigt op ${rect.bottom}, venster op ${innerHeight}`);
    if (bar.scrollWidth > bar.clientWidth) problems.push(`overloop: ${bar.scrollWidth} in ${bar.clientWidth}`);

    const owners = new Set<HTMLElement>();
    const walker = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim()) owners.add(node.parentElement!);
    }
    const visible: string[] = [];
    for (const owner of owners) {
      const text = owner.textContent!.trim();
      visible.push(text);
      const range = document.createRange();
      range.selectNodeContents(owner);
      const tops = [...range.getClientRects()].filter(r => r.width > 0).map(r => r.top);
      // Kleiner dan een halve rij: een lettertypewissel binnen één regel (ar, fa, lo) mag iets schelen.
      if (Math.max(...tops) - Math.min(...tops) >= 12) problems.push(`breekt af: ${text}`);
      const box = range.getBoundingClientRect();
      if (box.left < rect.left - 0.5 || box.right > rect.right + 0.5 || box.top < rect.top - 0.5 || box.bottom > rect.bottom + 0.5) {
        problems.push(`valt buiten de balk: ${text}`);
      }
    }
    const tooltips = [...bar.querySelectorAll(`${more}, ${summary}`)].map(el => el.getAttribute('title') ?? '');
    return { height: Math.round(rect.height), visible, tooltips, problems };
  }, { selector: BAR, more: MORE, summary: SUMMARY });
}

const plain = (text: string) => text.replace(/^⚠\s*/, '');

/** Alle tekst uit de ruimste meting staat nog in beeld, of anders in een tooltip. */
function expectNothingLost(full: BarMeasure, measured: BarMeasure, where: string): void {
  const reachable = [...measured.visible, ...measured.tooltips].map(plain).join('\n');
  expect(full.visible.map(plain).filter(text => !reachable.includes(text)), where).toEqual([]);
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

test('statusbalk: altijd één rij, en wat niet past blijft te vinden', async ({ page, ops: _ops }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto('/?open=examples/showcase-rijwoningen-de-akkers.ifc');
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  const bar = page.locator(BAR);
  await expect(bar).toContainText('83');

  // In een breed venster verandert er niets: De Akkers past en er valt niets samen.
  await setLocale(page, 'en');
  expect((await measureBar(page)).problems).toEqual([]);
  await expect(page.locator(MORE)).toHaveCount(0);
  await expect(page.locator(SUMMARY)).toHaveCount(0);
  await expect(page.locator('[data-ops-status-warning="outOfSequence"]')).toBeVisible();
  await expect(bar).toContainText('Zoom:');

  // Het kopje telt de waarschuwingen, noemt ze in de tooltip en opent met een klik het paneel.
  await page.setViewportSize({ width: 800, height: 900 });
  const summary = page.locator(SUMMARY);
  await expect(summary).toHaveText(/18 warnings/);
  await expect(summary).toHaveAttribute('title', /16 out-of-sequence relation\(s\)/);
  await expect(page.locator('[data-ops-status-warning="outOfSequence"]')).toHaveCount(0);
  await summary.click();
  await expect(page.locator('[data-ops-warnings-panel]')).toBeVisible();

  // De ⋯-knop toont wat verborgen is, ook bij aanwijzen: de echte tooltip, niet alleen het attribuut.
  await page.locator(MORE).hover();
  await expect(page.locator('.ops-tooltip')).toContainText('Zoom:');
  await page.mouse.move(400, 300);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWarningsPanel: false }));

  // Een echte klik op een taak: de selectie verschijnt, de balk blijft één rij.
  await page.setViewportSize({ width: 1500, height: 900 });
  const point = await page.evaluate(() => {
    const { tasks } = window.__OPS__!.store.getState();
    return tasks.map(t => window.__OPS__!.gantt.taskBarPoint(t.id, 'body', 'primary')).find(p => p !== null)!;
  });
  await page.mouse.click(point.x, point.y);
  await expect(bar).toContainText('Selection: 1');
  expect((await measureBar(page)).problems).toEqual([]);

  await showEverything(page);
  await expect(page.locator('[data-ops-baseline-legend] [data-ops-baseline-swatch]')).toHaveCount(3);

  const locales = await page.evaluate(async () => (await import('/src/i18n/config.ts' as string)).LOCALES as string[]);
  expect(locales).toHaveLength(28);
  for (const locale of locales) {
    await setLocale(page, locale);
    await page.setViewportSize({ width: 4000, height: 900 });
    const full = await measureBar(page);
    expect(full.problems, `${locale} ruim`).toEqual([]);
    expect(full.tooltips, `${locale} ruim`).toEqual([]);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const measured = await measureBar(page);
      expect(measured.problems, `${locale} op ${width}px`).toEqual([]);
      expectNothingLost(full, measured, `${locale} op ${width}px`);
      // De waarschuwingen vallen samen, maar verdwijnen nooit helemaal uit beeld.
      await expect(page.locator('[data-ops-status-warning]').first(), `${locale} op ${width}px`).toBeVisible();
    }
  }

  // Fijnmazig, om afrondingsgrenzen te vangen waar een stand net wel of net niet past.
  for (const locale of ['nl', 'en']) {
    await setLocale(page, locale);
    for (let width = 2600; width >= 480; width -= 7) {
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

  // Een baselinenaam breder dan het venster: geen overloop, en de naam blijft in de tooltip.
  const huge = Array.from({ length: 14 }, (_, i) => `Herplanningsvariant${i}`).join('');
  await page.evaluate(name => window.__OPS__!.store.setState(s => { s.baselines[0].name = name; }), huge);
  await page.setViewportSize({ width: 800, height: 900 });
  const measured = await measureBar(page);
  expect(measured.problems).toEqual([]);
  expect(measured.tooltips.join('\n')).toContain(huge);

  // Terug naar ruim: wat samenviel, komt weer helemaal terug.
  await page.evaluate(() => window.__OPS__!.store.setState(s => { s.baselines[0].name = 'Contract'; }));
  await page.setViewportSize({ width: 4000, height: 900 });
  await expect(page.locator(MORE)).toHaveCount(0);
  await expect(page.locator(SUMMARY)).toHaveCount(0);
});
