// XER-export (#391, Must "Write XER"): Bestand › Exporteren › Primavera P6 XER als echte
// gebruikershandeling. Deze headless Chromium heeft geen File System Access-API, dus de export valt
// terug op een download (`saveBytesDialog` → `downloadBlob`, webBackend.ts); Playwright vangt die op.
// De spec leest de gedownloade bytes met de ECHTE productielezer (`readXER`, puur, geen store) en
// toetst de melding in de toast. `window.__OPS__` LEEST alleen de store; de klikken zijn echt.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';

async function downloadBytes(download: { createReadStream: () => Promise<NodeJS.ReadableStream | null> }): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Voorbeeldproject De Akkers via Bestand › Voorbeelden (echte klikken). */
async function openAkkers(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.locator('.ribbon-tab--file').first().click();
  await page.locator('button.backstage-nav-item[data-tour-anchor="backstage-examples"]').click();
  await page.locator('button.backstage-export-card')
    .filter({ has: page.locator('h4', { hasText: /De Akkers/ }) }).first().click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBeGreaterThan(20);
}

test('XER-export: kaart Primavera P6 XER levert een leesbaar .xer en één verliesmelding', async ({ page, ops: _ops }) => {
  await openAkkers(page);
  const leafNames = await page.evaluate(() => window.__OPS__!.store.getState().tasks
    .filter(t => t.childIds.length === 0).map(t => t.name).sort());

  // Bestand › Exporteren › de kaart "Primavera P6 XER".
  await page.locator('.ribbon-tab--file').first().click();
  await page.locator('button.backstage-nav-item').filter({ hasText: /^(Export|Exporteren)$/ }).click();
  const card = page.locator('button.backstage-export-card').filter({ has: page.locator('h4', { hasText: 'Primavera P6 XER' }) });
  await expect(card).toHaveCount(1);
  await expect(card.locator('.backstage-export-icon')).toHaveText('XER');
  const downloadPromise = page.waitForEvent('download');
  await card.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xer$/);
  const bytes = await downloadBytes(download);

  // De bytes: ERMHDR-kop, en de productielezer leest dezelfde bladtaken terug.
  expect(bytes.subarray(0, 12).toString('latin1')).toBe('ERMHDR\t20.12');
  const read = readXER(new Uint8Array(bytes));
  expect(isMultiDocumentImport(read)).toBe(false);
  if (isMultiDocumentImport(read)) return;
  const project = read;
  const backNames = project.tasks.filter(t => t.childIds.length === 0).map(t => t.name).sort();
  expect(backNames).toEqual(leafNames);

  // Eén XER-verliesmelding met o.a. de deadline; geen algemene XER-bronmelding.
  const notices = await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
    .map(n => ({ key: n.messageKey as string, lines: (n.detailLines ?? []).map(l => l.messageKey as string) })));
  expect(notices.filter(n => n.key === 'notifications.xerExportLoss')).toEqual([]);
  const xer = notices.filter(n => n.key === 'notifications.exportXerLoss');
  expect(xer).toHaveLength(1);
  expect(xer[0].lines).toContain('notifications.exportXerLossItem.deadlines');
  const toast = page.locator('.ops-toast').filter({ hasText: /XER-export is opgeslagen|XER export is saved/ });
  await expect(toast).toBeVisible();
  await expect(toast.locator('[data-ops-toast-detail="notifications.exportXerLossItem.deadlines"]')).toHaveText(/1 deadline/);
});
