import { expect, test } from './fixtures/ops';

test('AutoSave staat bovenin, is voor een naamloos project uitgeschakeld en wisselt per document', async ({ page, ops }) => {
  const toggle = page.locator('[data-ops-autosave]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('title', /Save this project first/);

  const docA = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    // Alleen testfixture: een al handmatig geautoriseerde FSA-handle. De interactie die we
    // testen blijft de zichtbare schakelaar; geen echte picker in een headless browser.
    window.__OPS__!.store.setState({
      filePath: 'autosave-browser.ifc',
      fileHandle: {
        queryPermission: async () => 'granted',
        createWritable: async () => { throw new Error('test: doel verdwenen'); },
      },
      isDirty: true,
    } as never);
    return s.activeDocumentId;
  });
  await expect(toggle).toBeEnabled();
  ops.acceptError(/Werkelijke AutoSave mislukt:.*AutoSaveTargetUnavailableError/);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().autoSaveToFile)).toBe(true);

  // De echte timer/write-route faalt; geen notificatiefixture en geen schoonmarkering.
  const notice = page.locator('.ops-toast').filter({ hasText: 'Auto-save failed: the existing project file is not writable.' });
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().isDirty)).toBe(true);
  for (const [locale, text] of [
    ['nl', 'Automatisch opslaan mislukt: het bestaande projectbestand is niet schrijfbaar.'],
    ['en', 'Auto-save failed: the existing project file is not writable.'],
  ]) {
    await page.evaluate(async language => {
      const localePath = '/src/i18n/config.ts';
      const { setLocale } = await import(/* @vite-ignore */ localePath);
      await setLocale(language);
    }, locale);
    await expect(page.locator('.ops-toast').filter({ hasText: text })).toBeVisible();
  }

  const docB = await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${docA}"]`).click();
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId)).toBe(docA);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().autoSaveToFile)).toBe(false);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${docB}"]`).click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});
