// Tourkarakterisering: echte navigatieknoppen sturen de stappen; de storebrug zet alleen de
// beginsnapshot of een doelbewust ontbrekend DOM-anker voor het te bewijzen randgeval.
import { expect, test } from './fixtures/ops';
import type { UIState } from '@/state/slices/types';

async function startTour(page: import('@playwright/test').Page, updates: Partial<UIState> = {}): Promise<void> {
  await page.evaluate((extra) => {
    window.__OPS__!.store.getState().setUI({
      showTourOverlay: true,
      tourStepIndex: 0,
      tourSnapshot: null,
      ...extra,
    });
  }, updates);
  await expect(page.locator('[data-ops-tour-card]')).toBeVisible();
}

test('tour layout: overslaan herstelt het startsnapshot na echte stapnavigatie', async ({ page, ops: _ops }) => {
  await startTour(page, {
    activeRibbonTab: 'beeld',
    backstageSection: 'help',
    showHistogram: false,
    rightPanelCollapsed: true,
    showPropertiesPanel: false,
  });
  await page.getByRole('button', { name: /^(Next|Volgende)$/ }).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.tourStepIndex)).toBe(1);
  await page.getByRole('button', { name: /^(Skip|Overslaan)$/ }).click();

  await expect(page.locator('[data-ops-tour-card]')).toHaveCount(0);
  const restored = await page.evaluate(() => {
    const ui = window.__OPS__!.store.getState().ui;
    return {
      activeRibbonTab: ui.activeRibbonTab,
      backstageSection: ui.backstageSection,
      showHistogram: ui.showHistogram,
      rightPanelCollapsed: ui.rightPanelCollapsed,
      showPropertiesPanel: ui.showPropertiesPanel,
      tourSnapshot: ui.tourSnapshot,
      showTourOverlay: ui.showTourOverlay,
    };
  });
  expect(restored).toEqual({
    activeRibbonTab: 'beeld',
    backstageSection: 'help',
    showHistogram: false,
    rightPanelCollapsed: true,
    showPropertiesPanel: false,
    tourSnapshot: null,
    showTourOverlay: false,
  });
});

test('tour layout: een ontbrekend anker wordt eenmaal vooruit overgeslagen', async ({ page, ops: _ops }) => {
  await page.locator('[data-tour-anchor="ribbon-tabs"]').evaluate(element => {
    element.removeAttribute('data-tour-anchor');
  });
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({
    showTourOverlay: true,
    tourStepIndex: 0,
    tourSnapshot: null,
  }));

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.tourStepIndex)).toBe(1);
  const card = page.locator('[data-ops-tour-card]');
  await expect(card).toContainText(/Task table and Gantt chart|Taaktabel en Gantt-diagram/);
  await page.getByRole('button', { name: /^(Skip|Overslaan)$/ }).click();
  await expect(card).toHaveCount(0);
});

test('tour layout: Nederlandse inhoud en een volgende stap worden hermeet zonder lus', async ({ page, ops: _ops }) => {
  // Letterlijke taalkeuze vóór de modale tour: tijdens de tour blokkeert de overlay terecht alle
  // onderliggende bediening. De daaropvolgende Next-klik verandert de gemeten kaartinhoud live.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  await page.getByRole('button', { name: /^(Language|Taal)$/ }).click();
  await page.getByRole('button', { name: /^(Language|Taal)$/ }).last().click();
  await page.getByRole('option', { name: /Nederlands/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^(Close|Sluiten)$/ }).click();

  await page.evaluate(() => {
    const NativeResizeObserver = window.ResizeObserver;
    let callbacks = 0;
    class CountingResizeObserver extends NativeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          callbacks++;
          callback(entries, observer);
        });
      }
    }
    window.ResizeObserver = CountingResizeObserver;
    Object.defineProperty(window, '__opsTourResizeCallbacks', { configurable: true, get: () => callbacks });
  });
  await startTour(page);
  const card = page.locator('[data-ops-tour-card]');
  await expect(card).toContainText('Lint-tabbladen');
  const first = await card.boundingBox();
  expect(first).not.toBeNull();

  await page.getByRole('button', { name: 'Volgende' }).click();
  await expect(card).toContainText('Taaktabel en Gantt-diagram');
  const second = await card.boundingBox();
  expect(second).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(second!.x).toBeGreaterThanOrEqual(0);
  expect(second!.y).toBeGreaterThanOrEqual(0);
  expect(second!.x + second!.width).toBeLessThanOrEqual(viewport.width);
  expect(second!.y + second!.height).toBeLessThanOrEqual(viewport.height);

  await page.waitForTimeout(500);
  const settled = await page.evaluate(() => (
    window as Window & { __opsTourResizeCallbacks?: number }
  ).__opsTourResizeCallbacks ?? 0);
  expect(settled).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (
    window as Window & { __opsTourResizeCallbacks?: number }
  ).__opsTourResizeCallbacks ?? 0)).toBe(settled);
});
