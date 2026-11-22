import { expect, test } from './fixtures/ops';

const DIR = 'tests/browser/fixtures/ifc/externe-bron';

for (const mode of ['toevoegen', 'bewerken'] as const) {
  test(`mislukte browserbron wist oude keuze bij ${mode}, annuleren niet`, async ({ page, ops }) => {
    ops.acceptError(/chooseExternalSourceFile:.*knownbug 993/);
    const response = await page.request.get(`/${DIR}/Installateur.ifc`);
    expect(response.ok()).toBe(true);
    const ifc = await response.text();
    await page.goto(`/?open=${DIR}/Aannemer.ifc`);
    await expect.poll(() => page.evaluate(() =>
      window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
    const ownTaskId = await page.evaluate(async ({ ifc, mode }) => {
      const s = window.__OPS__!.store.getState();
      s.setUI({ showWelcomeDialog: false, showTourOverlay: false });
      const task = mode === 'bewerken'
        ? s.tasks.find(t => t.name === 'Afbouw' && t.externalLinks?.length)
        : s.tasks.find(t => t.childIds.length === 0 && !t.externalLinks?.length);
      if (!task) throw new Error('Proeftaak ontbreekt');
      s.selectTask(task.id);
      const root = await navigator.storage.getDirectory();
      const a = await root.getFileHandle('Bron-A.ifc', { create: true });
      const writable = await a.createWritable();
      await writable.write(ifc);
      await writable.close();
      const b = await root.getFileHandle('Bron-B.ifc', { create: true });
      Object.defineProperty(b, 'getFile', {
        value: async () => { throw new DOMException('knownbug 993: bron B kan niet worden gelezen', 'NotReadableError'); },
      });
      let attempt = 0;
      Object.defineProperty(document, 'featurePolicy', { configurable: true, value: undefined });
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value: async () => {
          attempt++;
          if (attempt === 2) throw new DOMException('Geannuleerd', 'AbortError');
          return [attempt === 3 ? b : a];
        },
      });
      if (mode === 'bewerken') {
        const columns = s.taskGridSurfaces['full-task-grid'].columns;
        if (!columns.some(column => column.id === 'relation.predecessors')) {
          s.setTaskGridColumns('full-task-grid', [
            ...columns,
            { id: 'relation.predecessors', width: 160, pinned: false } as unknown as (typeof columns)[number],
          ]);
        }
      }
      return task.id;
    }, { ifc, mode });
    const storedLinks = () => page.evaluate(id =>
      window.__OPS__!.store.getState().tasks.find(t => t.id === id)?.externalLinks ?? [], ownTaskId);
    const before = await storedLinks();
    if (mode === 'bewerken') {
      expect(before).toHaveLength(1);
      await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
      const chip = page.locator(`[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${ownTaskId}"]`)
        .locator('[data-grid-column-id="relation.predecessors"] .task-grid-relation-chip');
      await chip.click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Edit external relationship…', exact: true }).click();
    } else {
      expect(before).toHaveLength(0);
      await page.getByRole('button', { name: 'Link', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Add external relation…' }).click();
    }

    const dialog = page.getByTestId('external-link-dialog');
    await dialog.getByRole('button', { name: 'Source file', exact: true }).click();
    const choose = dialog.locator('[data-ops-external-source-choose]');
    const picked = dialog.locator('[data-ops-external-source-chosen]');
    const save = dialog.getByTestId('external-link-add');
    await choose.click();
    await expect(picked).toHaveText('Bron-A.ifc');
    await expect(save).toBeEnabled();

    // Annuleren van de tweede keuze houdt A; een mislukte lezing van B wist A.
    await choose.click();
    await expect(choose).toBeEnabled();
    await expect(picked).toHaveText('Bron-A.ifc');
    await expect(save).toBeEnabled();
    await choose.click();
    await expect(dialog.getByText('This file cannot be read.', { exact: true })).toBeVisible();
    await expect(picked).toHaveCount(0);
    await expect(save).toBeDisabled();
    // Focus niet op de bestandskiezer: Enter probeert nu het formulier te bewaren.
    await dialog.getByTestId('external-link-add').evaluate(el => el.ownerDocument.activeElement instanceof HTMLElement
      && el.ownerDocument.activeElement.blur());
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    expect(await storedLinks()).toEqual(before);
    await choose.click();
    await expect(picked).toHaveText('Bron-A.ifc');
    await expect(save).toBeEnabled();
  });
}
