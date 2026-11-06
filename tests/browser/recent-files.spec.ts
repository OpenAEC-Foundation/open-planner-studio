import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures/ops';

const ifc = readFileSync('public/examples/10-villa-wassenaar.ifc', 'utf8');

test('Recent: leesfout meldt de reden en behoudt project en item; opnieuw proberen opent Unicode-pad',
  async ({ page, ops }, testInfo) => {
    ops.acceptError(/Failed to open recent file:/);
    const path = 'D:\\Budowy Łódź\\Zażółć gęślą jaźń.ifc';
    // Alleen de native I/O-rand is vervangen. De klikken, parser, store en melding zijn echt.
    await page.evaluate(({ path, ifc }) => {
      const w = window as unknown as {
        __recentReadFails: boolean;
        __TAURI_INTERNALS__: { invoke: (cmd: string, args: { path: string }) => Promise<Uint8Array> };
      };
      w.__recentReadFails = true;
      w.__TAURI_INTERNALS__ = {
        invoke: async (cmd, args) => {
          if (cmd !== 'plugin:fs|read_text_file' || args.path !== path) {
            throw new Error(`Onverwachte bestandsaanroep: ${cmd} ${args.path}`);
          }
          if (w.__recentReadFails) throw `forbidden path: ${path}`;
          return new TextEncoder().encode(ifc);
        },
      };
      window.__OPS__!.store.setState({ recentFiles: [{
        id: 'recent-windows', name: 'Zażółć gęślą jaźń.ifc', ref: { kind: 'path', path }, addedAt: 1,
      }] });
    }, { path, ifc });
    const snapshot = () => page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      return JSON.stringify({ active: s.activeDocumentId, documents: s.getOpenDocumentPayloads(),
        history: s.historyEvents, recentFiles: s.recentFiles });
    });
    const before = await snapshot();
    const fileTab = page.locator('.ribbon-tab').filter({ hasText: /^(File|Bestand)$/ });
    await fileTab.click();
    const recent = page.locator('.backstage-recent-item').filter({ hasText: 'Zażółć gęślą jaźń.ifc' });
    await expect(recent).toHaveCount(1);
    await recent.click();
    const error = page.locator('.ops-toast.toast-error');
    await expect(error).toContainText(/(Bestand openen mislukt|Failed to open file)/);
    await expect(error).toContainText(`forbidden path: ${path}`);
    expect(await snapshot()).toBe(before);
    await page.screenshot({ path: testInfo.outputPath('recent-leesfout.png') });
    await error.locator('[data-ops-toast-close]').click();

    // Een herstelde leesmogelijkheid moet dezelfde entry opnieuw kunnen openen.
    await page.evaluate(() => {
      (window as unknown as { __recentReadFails: boolean }).__recentReadFails = false;
    });
    await fileTab.click();
    await expect(recent).toHaveCount(1);
    await recent.click();
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().filePath)).toBe(path);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().recentFiles[0].ref))
      .toEqual({ kind: 'path', path });
    await expect(error).toHaveCount(0);
    await page.evaluate(() => { delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; });
  });
