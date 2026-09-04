// Karakterisering vóór het sluiten van de hookpoort: een echte taalkeuze moet zowel de
// weekdaglabels op de tijdas als de duur-eenheid in de gedeelde DOM-taakgrid opnieuw vertalen.
import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

async function paintCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'));
}

async function waitForFontsAndTwoQuietWindows(page: Page): Promise<void> {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(500);
  const afterFirst = await paintCount(page);
  await page.waitForTimeout(500);
  expect(await paintCount(page), 'de Gantt bleef tekenen in het tweede rustige venster')
    .toBe(afterFirst);
}

test('Gantt vertaalt weekdagen en duursuffix na een echte taalkeuze', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{
    name: 'Lokalisatietaak',
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }]);
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawnText: string[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ) {
      drawnText.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsGanttDrawnText', {
      configurable: true,
      value: drawnText,
    });
    const store = window.__OPS__!.store.getState();
    store.setZoom(48);
    store.setUI({ enableHourPlanning: true, showSettingsDialog: true });
  });
  const beforePaint = await paintCount(page);

  await page.getByRole('button', { name: /^(Language|Taal)$/ }).click();
  await page.getByRole('button', { name: /^(Language|Taal)$/ }).last().click();
  await page.getByRole('option', { name: /Deutsch/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.getByRole('dialog').getByRole('button', { name: /^(Close|Sluiten|Schließen)$/ }).click();

  await expect.poll(() => paintCount(page)).toBeGreaterThan(beforePaint);
  await waitForFontsAndTwoQuietWindows(page);
  const drawnText = await page.evaluate(() => (
    (window as Window & { __opsGanttDrawnText?: string[] }).__opsGanttDrawnText ?? []
  ));
  await expect(page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${taskId}"][data-grid-column-id="task.time.scheduleDuration"]`,
  )).toContainText('10T');
  expect(drawnText.some(text => /^(Mo|Di|Mi|Do|Fr|Sa|So) \d+$/.test(text))).toBe(true);
});
