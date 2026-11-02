// Issue #391: meerdere baselines tegelijk in de Gantt, in één gestreepte strook. Opent de
// kijkscène `?qaScene=meerdere-baselines` (drie baselines; "Contract" actief, twee extra aan) en
// controleert met echte klikken en hovers: de gesplitste knop Baseline-overlay met het menu "Toon in
// de Gantt", de legenda en de tooltip op stukken met één, twee en drie baselines, en dat de keuze
// opslaan (Ctrl+S) en heropenen (Openen + bestandskiezer) overleeft. `__OPS__` leest
// alleen. Met `OPS_QA_SHOTS=<map>` legt de spec schermbeelden vast voor de ontwerpbeoordeling.
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const SHOTS = process.env.OPS_QA_SHOTS;
async function shot(page: Page, name: string, clip?: { x: number; y: number; width: number; height: number }): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, name), clip });
}

const compared = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().comparedBaselineIds);
const idOf = (page: Page, name: string) => page.evaluate(n => window.__OPS__!.store.getState().baselines
  .find(b => b.name === n)!.id, name);

async function openScene(page: Page): Promise<void> {
  await page.goto('/?qaScene=meerdere-baselines');
  await expect(page.locator('[data-ops-baseline-split]')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().baselines.map(b => b.name)))
    .toEqual(['Contract', 'Herplanning maart', 'Herplanning juni']);
  // Het welkomstvenster kan ná de scène nog opkomen (verse browser); het hoort niet bij deze check.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  await expect(page.locator('[data-ops-welcome-dialog]')).toHaveCount(0);
  // Weg met de omlijning van de kijkscène voor de schermbeelden.
  const split = page.locator('[data-ops-baseline-split]');
  await expect.poll(() => split.evaluate(el => el.style.outline)).not.toBe('');
  await split.evaluate(el => { el.style.outline = ''; });
}

/** Viewportpunten van de zichtbare taken met een baseline: balkmidden, links en rechts. */
async function visibleBars(page: Page) {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const g = window.__OPS__!.gantt;
    const ids = new Set(s.baselines[0].tasks.filter(t => !t.isMilestone).map(t => t.taskId));
    return s.tasks.filter(t => ids.has(t.id)).flatMap(t => {
      const left = g.taskBarPoint(t.id, 'left', 'primary');
      const right = g.taskBarPoint(t.id, 'right', 'primary');
      return left && right ? [{ id: t.id, name: t.name, y: left.y, left: left.x, right: right.x }] : [];
    });
  });
}

test('meerdere baselines: gesplitste knop, menu, legenda en tooltip per stuk', async ({ page, browser, ops: _ops }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await openScene(page);
  const maart = await idOf(page, 'Herplanning maart');
  const juni = await idOf(page, 'Herplanning juni');
  expect(await compared(page)).toEqual([maart, juni]);
  // De scène opent het menu niet zelf.
  await expect(page.locator('[data-ops-baseline-menu]')).toHaveCount(0);

  // Legenda in de statusbalk: de actieve baseline eerst, dan de twee extra, elk met een kleurstrookje.
  const legend = page.locator('[data-ops-baseline-legend]');
  await expect(legend).toHaveText(/Contract.*Herplanning maart.*Herplanning juni/);
  await expect(legend.locator('[data-ops-baseline-swatch]')).toHaveCount(3);

  for (const theme of ['light', 'dark', 'high-contrast'] as const) {
    await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(400);
    await shot(page, `meerdere-baselines-${theme}.png`);
  }
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiTheme: 'light' }));
  await page.waitForTimeout(300);

  // Hover over de strook onder elke zichtbare taak, van links naar rechts: de tooltip noemt per stuk
  // de baselines die daar liggen. De scène zorgt voor stukken met 1, 2 en 3 baselines.
  const bars = await visibleBars(page);
  expect(bars.length).toBeGreaterThan(3);
  const seen = new Map<string, string>();
  const stripDy = await page.evaluate(() => {
    // Balkhoogte 0,6·rij, dan 1 px lucht, dan de strook: het midden van de strook onder het balkmidden.
    const rowH = 32 * (window.__OPS__!.store.getState().ui.uiFontScale ?? 100) / 100;
    return rowH * 0.3 + 1 + 2.5;
  });
  for (const bar of bars.slice(0, 6)) {
    for (let x = bar.left - 260; x <= bar.right + 10; x += 6) {
      if (x < 380) continue;
      await page.mouse.move(x, bar.y + stripDy);
      const tip = page.locator('[data-ops-baseline-tooltip]');
      if (!(await tip.count())) continue;
      const slots = (await tip.getAttribute('data-ops-baseline-tooltip'))!;
      if (!seen.has(slots)) {
        seen.set(slots, (await tip.textContent()) ?? '');
        if (slots === '0,1,2') await shot(page, 'meerdere-baselines-tooltip.png');
      }
    }
  }
  await page.mouse.move(5, 5);
  const keys = [...seen.keys()];
  expect(keys.some(k => k.split(',').length === 1)).toBe(true);
  expect(keys.some(k => k.split(',').length === 2)).toBe(true);
  expect(keys).toContain('0,1,2');
  expect(seen.get('0,1,2')).toMatch(/Contract.*Herplanning maart.*Herplanning juni/);

  // Knopdeel: overlay uit en weer aan, zoals de oude knop.
  const main = page.locator('[data-ops-ribbon-item="toggleBaselineOverlay"]');
  await main.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.showBaselineOverlay)).toBe(false);
  await main.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.showBaselineOverlay)).toBe(true);

  // Pijltje: menu "Toon in de Gantt". Actief bovenaan, altijd aan; de andere twee aangevinkt.
  await page.locator('[data-ops-baseline-menu-toggle]').click();
  const menu = page.locator('[data-ops-baseline-menu]');
  await expect(menu).toBeVisible();
  const items = menu.getByRole('menuitemcheckbox');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Contract');
  await expect(items.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(items.nth(0)).toHaveAttribute('aria-disabled', 'true');
  await expect(items.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(items.nth(2)).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'meerdere-baselines-menu.png');
  // De actieve uitvinken kan niet.
  await items.nth(0).click({ force: true });
  expect(await compared(page)).toEqual([maart, juni]);
  // maart uit: het menu blijft open, alleen die plaats wordt leeg.
  await menu.locator(`[data-ops-baseline-menu-item="${maart}"]`).click();
  await expect(menu).toBeVisible();
  expect(await compared(page)).toEqual([null, juni]);
  await expect(legend).toHaveText(/Contract.*Herplanning juni/);
  await menu.locator(`[data-ops-baseline-menu-item="${maart}"]`).click();
  expect(await compared(page)).toEqual([maart, juni]);

  // De keuze hoort bij het document: maart uit, opslaan (Ctrl+S geeft in de browser een download)
  // en het bestand opnieuw openen in een verse pagina via Openen en de bestandskiezer.
  await menu.locator(`[data-ops-baseline-menu-item="${maart}"]`).click();
  expect(await compared(page)).toEqual([null, juni]);
  await page.locator('[data-ops-baseline-menu-toggle]').click();
  await expect(menu).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const saved = await readFile((await (await download).path())!);
  expect(saved.toString('utf8')).toContain('ComparedBaselineIds');

  // Een verse browsercontext: in dezelfde context biedt de app terecht crashherstel aan.
  const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  const reopened = await fresh.newPage();
  await reopened.goto('/');
  await expect.poll(() => reopened.evaluate(() => !!window.__OPS__?.store)).toBe(true);
  await reopened.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  await reopened.locator('[data-ops-ribbon-tab="start"]').click();
  const openButton = reopened.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooser = reopened.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'meerdere-baselines.ifc', mimeType: 'application/octet-stream', buffer: saved });
  await expect.poll(() => reopened.evaluate(() => window.__OPS__!.store.getState().baselines.map(b => b.name)))
    .toEqual(['Contract', 'Herplanning maart', 'Herplanning juni']);
  const names = () => reopened.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const name = (id: string | null) => (id ? s.baselines.find(b => b.id === id)?.name ?? '?' : null);
    return [name(s.activeBaselineId), ...s.comparedBaselineIds.map(name)];
  });
  expect(await names()).toEqual(['Contract', null, 'Herplanning juni']);
  // De Gantt toont na heropenen precies die keuze (legenda in de statusbalk).
  const reopenedLegend = reopened.locator('[data-ops-baseline-legend]');
  await expect(reopenedLegend).toHaveText(/Contract.*Herplanning juni/);
  await expect(reopenedLegend).not.toContainText('Herplanning maart');
  await fresh.close();
});

test('meerdere baselines: 2×-schermbeeld van de strepen (alleen met OPS_QA_SHOTS)', async ({ browser }) => {
  test.skip(!SHOTS, 'alleen voor de ontwerpbeoordeling');
  test.setTimeout(90_000);
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await openScene(page);
  const bars = await visibleBars(page);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(400);
    const top = bars[1].y - 20;
    await shot(page, `meerdere-baselines-2x-${theme}.png`, { x: 364, y: top, width: 620, height: 230 });
  }
  await context.close();
});

test('meerdere baselines: lint Beeld breed en smal (alleen met OPS_QA_SHOTS)', async ({ browser }) => {
  test.skip(!SHOTS, 'alleen voor de ontwerpbeoordeling');
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await openScene(page);
  for (const width of [1600, 1000]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(500);
    const mini = await page.locator('[data-ops-ribbon-item="toggleBaselineOverlay"]').evaluate(el => el.hasAttribute('data-ribbon-mini'));
    console.log(`breedte ${width}: Baseline-overlay smal=${mini}`);
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
      await page.waitForTimeout(400);
      await shot(page, `lint-${width === 1600 ? 'breed' : 'smal'}-${theme}.png`, { x: 0, y: 0, width, height: 160 });
    }
    await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiTheme: 'light' }));
    await page.locator('[data-ops-baseline-menu-toggle]').click();
    await expect(page.locator('[data-ops-baseline-menu]')).toBeVisible();
    await shot(page, `lint-${width === 1600 ? 'breed' : 'smal'}-menu.png`, { x: 0, y: 0, width, height: 300 });
    await page.keyboard.press('Escape');
    await page.mouse.click(width - 200, 600);
    await expect(page.locator('[data-ops-baseline-menu]')).toHaveCount(0);
  }
  // Handmatig ingeklapt lint (40px-strip): pictogram en ▾ naast elkaar.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ ribbonCompact: true }));
  await page.waitForTimeout(400);
  await shot(page, 'lint-ingeklapt-light.png', { x: 0, y: 0, width: 1600, height: 110 });
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ ribbonCompact: false }));
  await context.close();
});

test('meerdere baselines: een vergelijkingsbaseline ver vóór de taken is bereikbaar door te pannen', async ({ page, ops: _ops }) => {
  // Fixture: taak op 20–21 okt met actieve baseline "Okt", en een baseline "Juli" (1–31 juli) die
  // de gebruiker via het menu aanzet. Het pannen is een echte wiel-handeling.
  await page.evaluate(() => {
    const ops = window.__OPS__!;
    const s = ops.store.getState();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, scrollMode: 'position', positionDivision: 'left-right', showBaselineOverlay: true });
    s.setProject({ startDate: '2026-10-20' });
    const id = s.addTask({ name: 'Oktobertaak' });
    s.updateTask(id, { duration: 2 } as never);
    s.runCPM();
    s.saveBaseline('Okt');
    ops.store.setState(st => {
      st.baselines.unshift({
        id: 'bl-juli', name: 'Juli', createdAt: '2026-06-01T00:00:00Z', projectEnd: '', projectDuration: 0,
        tasks: [{ taskId: id, start: '2026-07-01', finish: '2026-07-31', duration: 31, isMilestone: false }],
      });
    });
    s.setViewStartDate('2026-10-20');
    s.setZoom(30);
    s.setScroll(0, 0);
  });
  await page.locator('[data-ops-ribbon-tab="beeld"]').click();
  await page.locator('[data-ops-baseline-menu-toggle]').click();
  await page.locator('[data-ops-baseline-menu-item="bl-juli"]').click();
  expect(await compared(page)).toEqual(['bl-juli', null]);
  await page.locator('[data-ops-baseline-menu-toggle]').click();

  const bounds = (await page.getByTestId('gantt-primary-canvas').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.6);
  await page.mouse.wheel(0, -200_000);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().view.scrollX)).toBe(0);
  // Helemaal links staat 1 juli in beeld (oorsprong = 1 juli − 14 dagen), niet links buiten de tijdlijn.
  const x = await page.evaluate(() => window.__OPS__!.gantt.dateX('2026-07-01'));
  expect(x).not.toBeNull();
  expect(x!).toBeGreaterThanOrEqual(0);
  expect(x!).toBeLessThan(bounds.width);
});

test('meerdere baselines: het menu past in het venster bij 30 baselines; de lijst scrolt', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Fixture: één taak en 30 baselines (revisie 0 … 29); de laatste is actief.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false });
    s.addTask({ name: 'Taak' });
    s.runCPM();
    for (let i = 0; i < 30; i++) s.saveBaseline(`Revisie ${i}`);
  });
  await page.locator('[data-ops-ribbon-tab="beeld"]').click();
  await page.locator('[data-ops-baseline-menu-toggle]').click();
  const menu = page.locator('[data-ops-baseline-menu]');
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  // De voetregel blijft zichtbaar binnen het venster.
  const hint = (await page.locator('[data-ops-baseline-menu-hint]').boundingBox())!;
  expect(hint.y + hint.height).toBeLessThanOrEqual(800);
  // De laatste niet-actieve baseline in de lijst is aan te klikken (de lijst scrolt ernaar).
  const last = await page.evaluate(() => window.__OPS__!.store.getState().baselines.find(b => b.name === 'Revisie 28')!.id);
  const item = menu.locator(`[data-ops-baseline-menu-item="${last}"]`);
  await item.click({ timeout: 5_000 });
  expect(await compared(page)).toEqual([last, null]);
  const itemBox = (await item.boundingBox())!;
  expect(itemBox.y + itemBox.height).toBeLessThanOrEqual(hint.y + 1);
});

test('meerdere baselines: resource-accent en baselines samen, licht en donker (alleen met OPS_QA_SHOTS)', async ({ browser }) => {
  test.skip(!SHOTS, 'alleen voor de ontwerpbeoordeling');
  test.setTimeout(90_000);
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await openScene(page);
  // Eigenaarsbesluit 2026-10-20: met accent én baselines wordt de balk lager, de strook blijft 5 px.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showResourceAccent: true }));
  const bars = await visibleBars(page);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(400);
    const top = bars[1].y - 20;
    await shot(page, `accent-en-baselines-${theme}.png`, { x: 364, y: top, width: 620, height: 230 });
  }
  await context.close();
});
