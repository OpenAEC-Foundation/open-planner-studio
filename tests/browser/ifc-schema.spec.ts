// Issue #292 — het IFC-schema kiezen in Projectinfo, in de echte gebruikersflow: Bestand › Projectinfo,
// de keuzelijst met echte klikken, Toepassen, en daarna Ctrl+S. In de browser zonder bestand wordt
// opslaan een download; de test leest de kop van dat bestand. `window.__OPS__` zet alleen de beginstand
// (één taak) en leest de store; de geteste handelingen zijn klikken en toetsen.
//
// OPS_IFC_SCHEMA_SHOTS=<map> bewaart schermbeelden van het formulier, licht en donker.
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures/ops';

const SHOTS = process.env.OPS_IFC_SCHEMA_SHOTS;

const schemaOf = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().project.ifcSchema ?? null);
const isDirty = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().isDirty);
const activeTab = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.activeRibbonTab);

async function toProjectInfo(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).click();
  await expect(page.locator('[data-ops-project-ifc-schema]')).toBeVisible();
}

const trigger = (page: Page) =>
  page.locator('[data-ops-project-ifc-schema]').getByRole('button', { name: /^(IFC schema when saving|IFC-schema bij opslaan)$/ });

async function pick(page: Page, option: RegExp): Promise<void> {
  await trigger(page).click();
  await page.getByRole('option', { name: option }).click();
  await expect(trigger(page)).toHaveText(option);
}

async function apply(page: Page): Promise<void> {
  await page.locator('[data-ops-project-info-actions]').getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  // Toepassen in Backstage keert terug naar het lint (onApply = Backstage sluiten).
  await expect.poll(() => activeTab(page)).not.toBe('file');
}

/** Ctrl+S zonder bestand in de browser ⇒ een download; geef de FILE_SCHEMA-regel van dat bestand terug. */
async function saveAndReadSchemaLine(page: Page): Promise<string> {
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const path = await (await download).path();
  const text = await readFile(path!, 'utf8');
  return text.split('\n').find(line => line.startsWith('FILE_SCHEMA(')) ?? '(geen FILE_SCHEMA-regel)';
}

test('IFC-schema: kiezen en opslaan, undo houdt het schema; schrijffout vóór terugval, annuleren en kopie opslaan',
  async ({ page, ops }) => {
    // Beginstand: een nieuw project met één taak, nog op de standaard.
    await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      s.setProject({ name: 'Schemaproef' });
      s.addTask({ name: 'Ruwbouw' });
    });
    expect(await schemaOf(page)).toBeNull();

    await toProjectInfo(page);
    // De standaard is IFC 4.3 ADD2 (besluit eigenaar 2026-10-13).
    await expect(trigger(page)).toHaveText(/^(IFC 4\.3 ADD2 \(default\)|IFC 4\.3 ADD2 \(standaard\))$/);
    if (SHOTS) {
      // Alleen voor de schermbeelden: het thema via de store (`ui.uiTheme`), zoals de instelling het zet.
      const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme);
      await page.locator('[data-ops-project-ifc-schema]').scrollIntoViewIfNeeded();
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate((t) => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/projectinfo-ifc-schema-${theme === 'light' ? 'licht' : 'donker'}.png` });
      }
      await page.evaluate((t) => window.__OPS__!.store.getState().setUI({ uiTheme: t }), before);
    }

    // Kiezen is een concept: de store verandert pas bij Toepassen.
    await pick(page, /^IFC4$/);
    await expect(page.locator('[data-ops-project-info-unapplied]')).toBeVisible();
    expect(await schemaOf(page)).toBeNull();
    await apply(page);
    await expect.poll(() => schemaOf(page)).toBe('IFC4');
    expect(await isDirty(page)).toBe(true);

    // Opslaan (echte Ctrl+S) schrijft het gekozen schema in de kop.
    expect(await saveAndReadSchemaLine(page)).toBe("FILE_SCHEMA(('IFC4'));");

    // Het schema hoort bij het bestand (review #336): ongedaan maken en opnieuw doen raken alleen de
    // bewerking ervoor (de taak), nooit het schema. Anders schreef AutoSave na Ctrl+Z stil het oude schema.
    const taskCount = () => page.evaluate(() => window.__OPS__!.store.getState().tasks.length);
    const tasksBefore = await taskCount();
    await page.keyboard.press('Control+z');
    await expect.poll(taskCount).toBe(tasksBefore - 1);
    expect(await schemaOf(page)).toBe('IFC4');
    await page.keyboard.press('Control+y');
    await expect.poll(taskCount).toBe(tasksBefore);
    expect(await schemaOf(page)).toBe('IFC4');

    // Het formulier toont de opgeslagen keuze; IFC 4.3 kiezen en opslaan.
    await toProjectInfo(page);
    await expect(trigger(page)).toHaveText(/^IFC4$/);
    await pick(page, /^IFC 4\.3$/);
    await apply(page);
    await expect.poll(() => schemaOf(page)).toBe('IFC4X3');
    expect(await saveAndReadSchemaLine(page)).toBe("FILE_SCHEMA(('IFC4X3'));");

    // Terug naar de standaard.
    await toProjectInfo(page);
    await pick(page, /^(IFC 4\.3 ADD2 \(default\)|IFC 4\.3 ADD2 \(standaard\))$/);
    await apply(page);
    await expect.poll(() => schemaOf(page)).toBe('IFC4X3_ADD2');
    // Het gekozen schema ook bewaren als het bestaande bestand vergrendeld is (knownbug163).
    // Alleen de opslaggrens is een fixture: een geweigerde oude handle en een synthetische kiezer.
    // De kopie is een echte, in IndexedDB bewaarbare OPFS-handle; Ctrl+S en de melding blijven echt.
    ops.acceptError('Save failed:');
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const copy = await root.getFileHandle('schemaproef-kopie.ifc', { create: true });
      const store = window.__OPS__!.store;
      store.getState().addTask({ name: 'Bewaar na fout' });
      store.setState({
        filePath: 'vergrendeld.ifc',
        fileHandle: {
          name: 'vergrendeld.ifc',
          queryPermission: async () => 'granted',
          createWritable: async () => { throw new DOMException('Bestand vergrendeld', 'NoModificationAllowedError'); },
        },
        ui: { ...store.getState().ui, notifications: [] },
      } as never);
      Object.defineProperty(document, 'featurePolicy', { configurable: true, value: undefined });
      Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: async () => [] });
      let calls = 0;
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: () => {
          sessionStorage.setItem('ops-test-save-picker-calls', String(++calls));
          sessionStorage.setItem('ops-test-save-notices-before-picker', JSON.stringify(store.getState().ui.notifications.map(n => [n.severity, n.messageKey, n.detail])));
          if (calls > 1) return Promise.resolve(copy);
          // Laat de kiezer openstaan tot de test de zichtbare melding heeft gecontroleerd.
          return new Promise<FileSystemFileHandle>((_resolve, reject) => {
            window.addEventListener('ops-test-cancel-save-picker', () => reject(new DOMException('Geannuleerd', 'AbortError')), { once: true });
          });
        },
      });
    });
    const pickerCalls = () => page.evaluate(() => Number(sessionStorage.getItem('ops-test-save-picker-calls')));
    const saveErrors = () => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
      .filter(n => n.severity === 'error').map(n => [n.messageKey, n.detail, n.count]));
    const toast = page.locator('.ops-toast.toast-error', { hasText: 'Failed to save' });
    await page.keyboard.press('Control+s');
    await expect.poll(pickerCalls).toBe(1);
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('ops-test-save-notices-before-picker')!)))
      .toEqual([['error', 'notifications.saveFailed', 'Bestand vergrendeld']]);
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Bestand vergrendeld');
    await page.evaluate(() => window.dispatchEvent(new Event('ops-test-cancel-save-picker')));
    await expect.poll(saveErrors).toEqual([['notifications.saveFailed', 'Bestand vergrendeld', 1]]);
    expect(await isDirty(page)).toBe(true);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().filePath)).toBe('vergrendeld.ifc');

    // Opnieuw Ctrl+S, nu naar de kopie. Geen dubbele fout of misleidende browserbeperking; de kopie
    // bevat het gekozen schema en wordt het doel van de volgende Opslaan.
    await toast.getByRole('button', { name: 'Close notification' }).click();
    await page.keyboard.press('Control+s');
    await expect.poll(pickerCalls).toBe(2);
    await expect.poll(() => isDirty(page)).toBe(false);
    await expect(toast).toHaveCount(1);
    expect(await saveErrors()).toEqual([['notifications.saveFailed', 'Bestand vergrendeld', 1]]);
    await expect.poll(() => page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      return [s.filePath, s.fileHandle?.name, s.recentFiles[0]?.name, s.ui.notifications.map(n => n.messageKey)];
    })).toEqual(['schemaproef-kopie.ifc', 'schemaproef-kopie.ifc', 'schemaproef-kopie.ifc', ['notifications.saveFailed']]);
    const copy = await page.evaluate(async () => {
      const file = await window.__OPS__!.store.getState().fileHandle!.getFile();
      return file.text();
    });
    expect(copy).toContain("FILE_SCHEMA(('IFC4X3_ADD2'));");
    expect(copy).toContain('Bewaar na fout');
    // Een nieuw project kreeg nooit een schemavraag.
    await expect(page.locator('[data-ops-ifc-schema-question]')).toHaveCount(0);
  });
