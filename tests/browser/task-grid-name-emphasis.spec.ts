import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

// Discussion #97: de naamkolom van het taakraster gaf samenvattingen (containertaken) en
// mijlpalen geen enkel typografisch signaal — alleen de inspringing verried de hiërarchie. Dit
// karakteriseert het `data-grid-task-kind`-attribuut dat FullTaskGrid nu op de naamrij zet en de
// bijbehorende CSS in globals.css (vet voor samenvatting/mijlpaal, plus de mijlpaalkleur):
// echte DOM-attributen en computed styles, geen canvaspixels.

function nameSpan(page: Page, taskId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"] .full-task-grid-name`,
  );
}

test('samenvatting en mijlpaal krijgen een eigen data-grid-task-kind en typografie in de naamkolom', async ({ page, ops: _ops }) => {
  const [summaryId, milestoneId, normalId] = await seedProject(page, [
    { name: 'Fase 1', start: '2026-09-07', finish: '2026-09-25' },
    { name: 'Oplevering', start: '2026-09-07', finish: '2026-09-07' },
    { name: 'Gewone taak', start: '2026-09-07', finish: '2026-09-18' },
  ]);

  // seedProject maakt platte taken aan; maak er hier een echte samenvatting (kind erbij) en een
  // echte mijlpaal van via de publieke store-acties, en herbereken.
  await page.evaluate((parentId) => {
    const s = window.__OPS__!.store.getState();
    const id = s.addTask({ name: 'Onderdeel', parentId, manuallyScheduled: true });
    const created = window.__OPS__!.store.getState().tasks.find(t => t.id === id)!;
    s.updateTask(id, {
      time: {
        ...created.time,
        scheduleStart: '2026-09-07',
        scheduleFinish: '2026-09-11',
        earlyStart: '2026-09-07',
        earlyFinish: '2026-09-11',
        scheduleDuration: 5,
      },
    });
  }, summaryId);
  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    s.updateTask(id, { isMilestone: true });
  }, milestoneId);
  await page.evaluate(() => window.__OPS__!.store.getState().runCPM());
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(4);

  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const grid = page.locator('[data-task-grid-surface-id="full-task-grid"] [role="grid"]');
  await expect(grid).toBeVisible();

  const summarySpan = nameSpan(page, summaryId);
  const milestoneSpan = nameSpan(page, milestoneId);
  const normalSpan = nameSpan(page, normalId);
  await expect(summarySpan).toBeVisible();
  await expect(milestoneSpan).toBeVisible();
  await expect(normalSpan).toBeVisible();

  await expect(summarySpan).toHaveAttribute('data-grid-task-kind', 'summary');
  await expect(milestoneSpan).toHaveAttribute('data-grid-task-kind', 'milestone');
  await expect.poll(() => normalSpan.getAttribute('data-grid-task-kind')).toBeNull();

  const summaryLabel = summarySpan.locator('.full-task-grid-name-label');
  const milestoneLabel = milestoneSpan.locator('.full-task-grid-name-label');
  const normalLabel = normalSpan.locator('.full-task-grid-name-label');

  const [summaryWeight, milestoneWeight, normalWeight] = await Promise.all([
    summaryLabel.evaluate(node => Number(getComputedStyle(node).fontWeight)),
    milestoneLabel.evaluate(node => Number(getComputedStyle(node).fontWeight)),
    normalLabel.evaluate(node => Number(getComputedStyle(node).fontWeight)),
  ]);
  expect(summaryWeight).toBeGreaterThanOrEqual(600);
  expect(milestoneWeight).toBeGreaterThanOrEqual(600);
  expect(normalWeight).toBeLessThan(600);

  const [milestoneColor, normalColor] = await Promise.all([
    milestoneLabel.evaluate(node => getComputedStyle(node).color),
    normalLabel.evaluate(node => getComputedStyle(node).color),
  ]);
  expect(milestoneColor).not.toBe(normalColor);
});
