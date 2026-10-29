import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

// Delete en Backspace mogen de geselecteerde taak niet verwijderen terwijl een modaal venster
// openstaat. Gemeten fout (2026-10-19, showcase, 16 taken): met de focus op een knop in het
// kalendervenster, in *Taak bewerken* of in *Projectinstellingen* gaf Delete/Backspace 15 taken,
// terwijl het venster openbleef. Fixtures (taken, selectie, venster openen) gaan via de brug; de
// geteste handeling is steeds een echte toetsaanslag.

const taskCount = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().tasks.length);

async function seedAndSelect(page: Page): Promise<string> {
  const ids = await seedProject(page, [
    { name: 'Set up site', start: '2026-09-07', finish: '2026-09-08', durationDays: 2 },
    { name: 'Foundations', start: '2026-09-09', finish: '2026-09-11', durationDays: 3 },
    { name: 'Walls', start: '2026-09-14', finish: '2026-09-18', durationDays: 5 },
  ]);
  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), ids[0]!);
  return ids[0]!;
}

async function pressDeleteKeys(page: Page, focusTarget: Locator) {
  await focusTarget.focus();
  await expect(focusTarget).toBeFocused();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
}

test('Delete en Backspace in het kalendervenster verwijderen de taak niet', async ({ page, ops: _ops }) => {
  await seedAndSelect(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();

  await pressDeleteKeys(page, dialog.getByRole('button', { name: 'Mon–Fri' }));
  expect(await taskCount(page)).toBe(3);
  await expect(dialog).toBeVisible();
});

test('Delete en Backspace op Cancel in Taak bewerken verwijderen de taak niet', async ({ page, ops: _ops }) => {
  const id = await seedAndSelect(page);
  // Knownbug 120 / CI #534: de oude naamfocustimer (30 ms) stal een expliciete knopfocus.
  // Zet de klok vóór openen stil, zoals in toast-open-sticky.spec.ts. Echte handelingen kunnen
  // zo aantoonbaar vóór die timer vallen, ongeacht de belasting van de CI-runner.
  await page.clock.install();
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
  const open = () => page.evaluate((taskId) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: taskId }), id);
  await open();
  const dialog = page.getByRole('dialog');
  const name = dialog.locator('[data-ops-task-name]');
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  const save = dialog.locator('[data-ops-task-save]');
  const help = dialog.getByRole('button', { name: 'Help on this topic', exact: true });
  await expect(name).toHaveValue('Set up site');

  // Klokcontrole: precies dezelfde 30ms-timerroute staat stil en moet straks wél verlopen.
  const timer = await page.evaluateHandle(() => {
    const control = { fired: false };
    window.setTimeout(() => { control.fired = true; }, 30);
    return control;
  });
  await name.click();
  await page.keyboard.press('Shift+Tab'); // sluiten
  await page.keyboard.press('Shift+Tab'); // Help
  await expect(help).toBeFocused();
  await page.keyboard.press('Shift+Tab'); // wrap naar Opslaan
  await expect(save).toBeFocused();
  await page.keyboard.press('Shift+Tab'); // Annuleren, zonder de dialoog te sluiten
  await expect(cancel).toBeFocused();
  expect(await timer.evaluate(control => control.fired)).toBe(false);
  await page.clock.runFor(30);
  expect(await timer.evaluate(control => control.fired)).toBe(true);
  await timer.dispose();
  await expect(cancel).toBeFocused(); // Oude code faalt hier: de timer heeft de naam gefocust.

  await pressDeleteKeys(page, cancel);
  expect(await taskCount(page)).toBe(3);
  await expect(name).toHaveValue('Set up site');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.editingTaskId)).toBe(id);

  // Ook vooruit blijft Tab binnen het venster; Escape sluit alleen de bewerksessie.
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(help).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // Beginfocus selecteert de volledige, geïnitialiseerde naam, ook na heropenen en taakwissel.
  const expectSelectedName = async (value: string) => {
    await expect(name).toHaveValue(value);
    await expect(name).toBeFocused();
    expect(await name.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, value.length]);
  };
  await open();
  await expectSelectedName('Set up site');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ editingTaskId: s.tasks[1]!.id });
  });
  await expectSelectedName('Foundations');
  await page.keyboard.type('Foundations edited');
  await expect(name).toHaveValue('Foundations edited');
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().tasks[1]!.name)).toBe('Foundations edited');
  expect(await taskCount(page)).toBe(3);
});

test('Delete en Backspace in een tekstveld van Taak bewerken wissen gewoon tekens', async ({ page, ops: _ops }) => {
  const id = await seedAndSelect(page);
  await page.evaluate((taskId) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: taskId }), id);
  const dialog = page.getByRole('dialog');
  const name = dialog.locator('input[type="text"], input:not([type])').first();
  await expect(name).toHaveValue('Set up site');

  await name.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Home');
  await page.keyboard.press('Delete');
  await expect(name).toHaveValue('et up sit');
  expect(await taskCount(page)).toBe(3);
});

for (const [label, flag] of [
  ['Projectinstellingen', 'showProjectInfoDialog'],
  ['App-instellingen', 'showSettingsDialog'],
] as const) {
  test(`Delete en Backspace in ${label} verwijderen de taak niet`, async ({ page, ops: _ops }) => {
    await seedAndSelect(page);
    await page.evaluate((key) => window.__OPS__!.store.getState().setUI({ [key]: true }), flag);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await pressDeleteKeys(page, dialog.getByRole('button', { name: 'Help on this topic' }).first());
    expect(await taskCount(page)).toBe(3);
    await expect(dialog).toBeVisible();
  });
}

test('zonder venster verwijdert Delete de geselecteerde taak wel', async ({ page, ops: _ops }) => {
  const id = await seedAndSelect(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Delete');
  await expect.poll(() => taskCount(page)).toBe(2);
  expect(await page.evaluate((taskId) => window.__OPS__!.store.getState().tasks.some(t => t.id === taskId), id)).toBe(false);
});

test('in de presentatiemodus verwijdert Delete de taak en zet Ctrl+Z hem terug', async ({ page, ops: _ops }) => {
  // De gids `howto-presentatie` belooft dit; de presentatie is een weergave, geen venster.
  const id = await seedAndSelect(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setPresentationMode(true));
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(true);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.keyboard.press('Delete');
  await expect.poll(() => taskCount(page)).toBe(2);
  await page.keyboard.press('Control+z');
  await expect.poll(() => taskCount(page)).toBe(3);
  expect(await page.evaluate((taskId) => window.__OPS__!.store.getState().tasks.some(t => t.id === taskId), id)).toBe(true);
});

test('Delete en Backspace met de sluitvraag open verwijderen de taak niet', async ({ page, ops: _ops }) => {
  await seedAndSelect(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ pendingCloseDocId: s.activeDocumentId });
  });
  const dialog = page.locator('[data-ops-close-dialog]');
  await expect(dialog).toBeVisible();

  await pressDeleteKeys(page, dialog.getByRole('button', { name: 'Cancel', exact: true }));
  expect(await taskCount(page)).toBe(3);
  await expect(dialog).toBeVisible();
});

test('in Backstage verwijdert Delete geen taak, maar zet Ctrl+Z wel terug', async ({ page, ops: _ops }) => {
  await seedAndSelect(page);
  // Eerst een verwijdering in de planning, zodat Ctrl+Z in Backstage iets terug te zetten heeft.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Delete');
  await expect.poll(() => taskCount(page)).toBe(2);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.selectTask(s.tasks[0]!.id);
    s.setUI({ activeRibbonTab: 'file', backstageSection: 'recent' });
  });

  await pressDeleteKeys(page, page.getByRole('button', { name: 'Back', exact: true }).first());
  expect(await taskCount(page)).toBe(2);

  await page.keyboard.press('Control+z');
  await expect.poll(() => taskCount(page)).toBe(3);
});

test('op het tabblad Rapport verwijderen Delete en Backspace geen taak en plakt Ctrl+V niets', async ({ page, ops: _ops }) => {
  await seedAndSelect(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+c');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'report' }));

  await pressDeleteKeys(page, page.getByRole('button', { name: 'Export PDF' }).first());
  expect(await taskCount(page)).toBe(3);
  // Apart meten: zou Delete toch werken, dan zet een plakactie het aantal anders weer op 3.
  await page.keyboard.press('Control+v');
  expect(await taskCount(page)).toBe(3);
});

test('op het tabblad IFC verwijdert Delete geen taak', async ({ page, ops: _ops }) => {
  await seedAndSelect(page);
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'ifc' });
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  expect(await taskCount(page)).toBe(3);
});

test('onder het volledige resourcepaneel verwijderen Delete en Backspace geen taak', async ({ page, ops: _ops }) => {
  await seedAndSelect(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({
    activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false,
  }));

  await pressDeleteKeys(page, page.getByRole('button', { name: 'New resource in project' }).first());
  expect(await taskCount(page)).toBe(3);
});

test('Ctrl+C in Backstage › Help laat het gewone kopiëren met rust', async ({ page, ops: _ops }) => {
  await seedAndSelect(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'file', backstageSection: 'help' }));
  await page.getByRole('button', { name: 'Back', exact: true }).first().focus();
  // Deze luisteraar komt ná die van de app, en ziet dus of de app de toets heeft afgevangen.
  await page.evaluate(() => {
    const w = window as unknown as { __copyPrevented?: boolean };
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'c' && e.ctrlKey) w.__copyPrevented = e.defaultPrevented;
    });
  });
  await page.keyboard.press('Control+c');
  expect(await page.evaluate(() => (window as unknown as { __copyPrevented?: boolean }).__copyPrevented)).toBe(false);
});
