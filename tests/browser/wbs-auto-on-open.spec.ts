import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const TREE: [string, number, string][] = [
  ['Voorbereiding', 1, '1'], ['Ontwerp', 2, '1.1'], ['Vergunning', 2, '1.2'],
  ['Aanvraag', 3, '1.2.1'], ['Besluit', 3, '1.2.2'], ['Uitvoering', 1, '2'], ['Fundering', 2, '2.1'],
];
const MSPDI = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>WBS</Name><StartDate>2026-01-05T08:00:00</StartDate>
<MinutesPerDay>480</MinutesPerDay><Tasks>${TREE.map(([name, level, wbs], i) =>
  `<Task><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${name}</Name><WBS>${wbs}</WBS><OutlineLevel>${level}</OutlineLevel>`
  + '<Start>2026-01-05T08:00:00</Start><Finish>2026-01-09T17:00:00</Finish><Duration>PT40H0M0S</Duration></Task>').join('')}</Tasks></Project>`;

function nameCell(page: Page, taskId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`
    + ' [data-grid-data-cell="true"][data-grid-column-id="task.name"]',
  );
}

async function scrollIntoGrid(page: Page, taskId: string): Promise<void> {
  const grid = page.locator('[data-task-grid-surface-id="gantt-task-grid"]');
  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  for (let i = 0; i < 40 && await nameCell(page, taskId).count() === 0; i++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(50);
  }
  await nameCell(page, taskId).scrollIntoViewIfNeeded();
}

async function openViaChooser(page: Page, name: string, buffer: Buffer, mimeType: string): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name, mimeType, buffer });
}

const wbsCodes = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().tasks.map(t => t.wbsCode));
const taskIdByName = (page: Page, name: string) => page.evaluate(n =>
  window.__OPS__!.store.getState().tasks.find(t => t.name === n)?.id ?? null, name);

async function insertAndIndent(page: Page, anchorName: string): Promise<{ newId: string; newCode: string; parentName: string | null }> {
  const anchor = await taskIdByName(page, anchorName);
  expect(anchor).not.toBeNull();
  const before = await page.evaluate(() => window.__OPS__!.store.getState().tasks.length);
  await scrollIntoGrid(page, anchor!);
  await nameCell(page, anchor!).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([anchor]);
  await page.keyboard.press('Insert');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(before + 1);
  const newId = await page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds[0]);
  expect(newId).not.toBe(anchor);
  let codes = await wbsCodes(page);
  expect(new Set(codes).size).toBe(codes.length);

  await page.keyboard.press('Escape');
  await scrollIntoGrid(page, newId);
  await nameCell(page, newId).click();
  await page.keyboard.press('Alt+Shift+ArrowRight');
  const parentOf = (id: string) => page.evaluate(x =>
    window.__OPS__!.store.getState().tasks.find(t => t.id === x)?.parentId ?? null, id);
  const anchorParent = await parentOf(anchor!);
  await expect.poll(() => parentOf(newId)).not.toBe(anchorParent);
  codes = await wbsCodes(page);
  expect(new Set(codes).size).toBe(codes.length);
  return page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.id === id)!;
    return { newId: id, newCode: t.wbsCode, parentName: s.tasks.find(x => x.id === t.parentId)?.name ?? null };
  }, newId);
}

async function expectWbsAutoActive(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.__OPS__!.store.getState().project.wbsAutoNumber)).toBe(true);
  await page.locator('button.ribbon-tab').filter({ hasText: /^(Planning)$/ }).click();
  await expect(page.locator('[data-ops-ribbon-item="wbsAuto"]')).toHaveClass(/\bactive\b/);
}

test('MSPDI met boomcodes: WBS auto staat na openen aan, invoegen en inspringen geven geen dubbele code', async ({ page, ops: _ops }) => {
  await openViaChooser(page, 'boomcodes.xml', Buffer.from(MSPDI), 'application/xml');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(TREE.length);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().isDirty)).toBe(false);
  await expectWbsAutoActive(page);

  const result = await insertAndIndent(page, 'Besluit');
  expect(result.parentName).toBe('Aanvraag');
  expect(result.newCode).toBe('1.2.1.1');
  await expect(page.locator('[data-ops-ribbon-item="wbsAuto"]')).toHaveClass(/\bactive\b/);
});

const QA = process.env.OPS_QA_FILES;
const MPP = QA ? join(QA, 'productieplanning.mpp') : '';

test('productieplanning.mpp: geen dubbele code na Insert boven "Hefcilinder monteren" en inspringen', async ({ page, ops: _ops }) => {
  test.skip(!MPP || !existsSync(MPP), 'OPS_QA_FILES met productieplanning.mpp ontbreekt (alleen lokaal)');
  await openViaChooser(page, 'productieplanning.mpp', readFileSync(MPP), 'application/vnd.ms-project');
  await expect.poll(() => taskIdByName(page, 'Hefcilinder monteren'), { timeout: 30_000 }).not.toBeNull();
  await expectWbsAutoActive(page);

  const result = await insertAndIndent(page, 'Hefcilinder monteren');
  expect(result.parentName).toBe('Assembleren hefsysteem dmv. Assen');
  expect(result.newCode).toBe('1.3.6.1.1');
  const hef = await taskIdByName(page, 'Hefcilinder monteren');
  expect(await page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.wbsCode, hef)).toBe('1.3.6.2');
});
