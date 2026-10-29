import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

// De eigen keuzelijst (`Select`) mag geen toetsen naar de globale sneltoetsen laten lekken, en zijn
// open lijst mag de opties niet afknippen. Gemeten fouten (review PR #368, ook op main):
//  - Delete/Backspace op de trigger of in de open lijst verwijderden de geselecteerde taak;
//  - − en 0 in de open lijst zoomden de Gantt;
//  - Escape in een open lijst in een dialoog sloot de hele dialoog (concept weg);
//  - Escape op een dichte trigger hief de taakselectie op (een native <select> doet dat niet);
//  - de lijst was even breed als de trigger, dus lange opties vielen weg.
// Fixtures (taken, kalender, panelen, dialoog openen) gaan via de brug; elke geteste handeling is
// een echte klik of toetsaanslag.

const zoom = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().view.zoom);
const taskIds = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().tasks.map(t => t.id));
const selected = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds);
const menu = (page: Page) => page.locator('.ops-select__menu');

const LONG_TASK = 'Gevelmetselwerk met verdiepte voegen en natuursteen plinten aan de noordzijde, inclusief steigerwerk en voegwerk na de vorstperiode';
/** `dialog.parentTask` uit de taalbestanden: zo volgt de test de vertaling. */
const parentTaskLabel = (locale: 'en' | 'ar'): string =>
  (JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${locale}/task.json`, import.meta.url), 'utf8')) as { dialog: { parentTask: string } }).dialog.parentTask;
const LONG_CALENDAR = 'Kalender met een heel lange naam voor de winterploeg op de bouwplaats Noord';

/** Eén taak, geselecteerd, met het eigenschappenpaneel open. Geeft de kalendertrigger terug. */
async function seedPanel(page: Page, extraCalendar = false): Promise<{ id: string; trigger: Locator }> {
  const [id] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
  ]);
  const projectCalendar = await page.evaluate(({ taskId, longName }) => {
    const s = window.__OPS__!.store.getState();
    if (longName) {
      const { id: _drop, ...base } = s.calendar;
      s.addCalendar({ ...base, name: longName });
    }
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(taskId);
    return s.calendar.name;
  }, { taskId: id, longName: extraCalendar ? LONG_CALENDAR : null });
  // De kalendertrigger toont "<projectkalender>: <naam>"; zo vinden we hem in elke taal.
  const trigger = page.locator('button[aria-haspopup="listbox"]').filter({ hasText: projectCalendar });
  await expect(trigger).toBeVisible();
  return { id, trigger };
}

test('Delete en Backspace in de open lijst en op de dichte trigger verwijderen de taak niet', async ({ page, ops: _ops }) => {
  const { id, trigger } = await seedPanel(page);

  // Open lijst.
  await trigger.click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  expect(await taskIds(page)).toEqual([id]);

  // Kiezen met de muis: de focus gaat terug naar de dichte trigger. Backspace en Delete daar
  // verwijderen de taak ook niet.
  await menu(page).locator('[role="option"]').first().click();
  await expect(menu(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  // Ook met Ctrl: Delete en Backspace blijven op de trigger afgevangen.
  await page.keyboard.press('Control+Delete');
  await page.keyboard.press('Control+Backspace');
  expect(await taskIds(page)).toEqual([id]);
  expect(await selected(page)).toEqual([id]);

  // En in de open lijst met Ctrl evenmin.
  await trigger.click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Control+Delete');
  await page.keyboard.press('Control+Backspace');
  expect(await taskIds(page)).toEqual([id]);
});

test('Ctrl+Z na een muiskeuze zet de keuze terug; in de open lijst doet Ctrl+Z niets', async ({ page, ops: _ops }) => {
  const { id } = await seedPanel(page, true);
  // De trigger toont na de keuze een andere tekst; zoek hem hier op zijn (Engelse) label.
  const trigger = page.locator('button[aria-haspopup="listbox"][aria-label="Calendar"]');
  await expect(trigger).toHaveCount(1);
  const calendarOf = () => page.evaluate(taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.calendarId ?? null, id);
  expect(await calendarOf()).toBeNull();

  // Muiskeuze: de focus staat daarna weer op de dichte trigger.
  await trigger.click();
  await menu(page).getByRole('option', { name: LONG_CALENDAR }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const chosen = await calendarOf();
  expect(chosen).not.toBeNull();

  // Open lijst: Ctrl+Z blijft afgevangen, de keuze staat nog.
  await trigger.click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await calendarOf()).toBe(chosen);
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Dichte trigger: Ctrl+Z gaat door naar de globale undo.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(calendarOf).toBeNull();
  expect(await taskIds(page)).toEqual([id]);
});

test('dezelfde optie opnieuw kiezen roept geen onChange aan (klik, Enter, Spatie)', async ({ page, ops: _ops }) => {
  const { id } = await seedPanel(page, true);
  const trigger = page.locator('button[aria-haspopup="listbox"][aria-label="Calendar"]');
  // Spion op de storeactie achter de kalenderkeuze in het paneel (alleen tellen, gedrag blijft).
  await page.evaluate(() => {
    const store = window.__OPS__!.store;
    const original = store.getState().setTaskCalendar;
    const w = window as unknown as { __calendarCalls: number };
    w.__calendarCalls = 0;
    store.setState({
      setTaskCalendar: (...args: Parameters<typeof original>) => { w.__calendarCalls++; return original(...args); },
    });
  });
  const calls = () => page.evaluate(() => (window as unknown as { __calendarCalls: number }).__calendarCalls);

  await trigger.click();
  await menu(page).getByRole('option', { name: LONG_CALENDAR }).click();
  await expect(menu(page)).toHaveCount(0);
  expect(await calls()).toBe(1);
  const chosen = await page.evaluate(taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.calendarId, id);

  // Klik op de al gekozen optie: de lijst sluit, geen onChange.
  await trigger.click();
  await menu(page).getByRole('option', { name: LONG_CALENDAR }).click();
  await expect(menu(page)).toHaveCount(0);
  // Enter+Enter en Spatie+Spatie: openen en de actieve (gekozen) optie opnieuw kiezen.
  for (const key of ['Enter', ' ']) {
    await page.keyboard.press(key);
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press(key);
    await expect(menu(page)).toHaveCount(0);
  }
  expect(await calls()).toBe(1);
  expect(await page.evaluate(taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.calendarId, id)).toBe(chosen);
});

test('− en 0 in de open lijst zoomen de Gantt niet', async ({ page, ops: _ops }) => {
  const { trigger } = await seedPanel(page);

  // Controle vooraf: zonder veldfocus zoomt het min-teken wél.
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const start = await zoom(page);
  await page.keyboard.press('-');
  await expect.poll(() => zoom(page)).toBeLessThan(start);

  await trigger.click();
  await expect(menu(page)).toBeVisible();
  const before = await zoom(page);
  await page.keyboard.press('-');
  await page.keyboard.press('0');
  expect(await zoom(page)).toBe(before);
  await expect(menu(page)).toBeVisible();
});

test('Escape op de keuzelijst in het paneel: lijst dicht, taakselectie blijft (zoals een native select)', async ({ page, ops: _ops }) => {
  const { id, trigger } = await seedPanel(page);

  await trigger.click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await selected(page)).toEqual([id]);

  // Dichte, gefocuste trigger: Escape heft de selectie niet op. Op main doet een gefocuste native
  // <select> hetzelfde (het sneltoetsregister slaat een typveld over).
  await page.keyboard.press('Escape');
  expect(await selected(page)).toEqual([id]);
});

test('Escape in een open lijst in de taakdialoog sluit alleen de lijst; het concept blijft', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
    { name: 'Metselwerk', start: '2026-09-11', finish: '2026-09-16', durationDays: 4 },
  ]);
  await page.evaluate(taskId => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: taskId }), second);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Concept: een nieuwe naam typen.
  const name = dialog.locator('input').first();
  await expect(name).toHaveValue('Metselwerk');
  await name.fill('Metselwerk gevel');

  const parent = dialog.locator(`button[aria-haspopup="listbox"][aria-label="${parentTaskLabel('en')}"]`);
  await parent.click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(name).toHaveValue('Metselwerk gevel');
  await expect(parent).toBeFocused();
  // De taak zelf is niet gewijzigd: het concept is nog niet opgeslagen en niet weggegooid.
  expect(await page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.name, second)).toBe('Metselwerk');
  expect(await taskIds(page)).toEqual([first, second]);

  // Een tweede Escape op de dichte trigger sluit de dialoog wél, net als bij een gefocuste native
  // <select> op main: alleen een open lijst houdt Escape vast.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('taakdialoog: Ctrl+Z en Ctrl+V na een muiskeuze veranderen niets achter de dialoog', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
    { name: 'Metselwerk', start: '2026-09-11', finish: '2026-09-16', durationDays: 4 },
  ]);
  // Iets op het klembord, zodat Ctrl+V echt iets zou plakken.
  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.selectTask(id);
    s.copyTasks();
    s.setUI({ showTaskDialog: true, editingTaskId: id });
  }, second);
  const snapshot = () => page.evaluate(() => JSON.stringify(window.__OPS__!.store.getState().tasks.map(t => [t.id, t.name, t.parentId ?? null])));
  const before = await snapshot();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Muiskeuze: de focus staat daarna op de dichte trigger, in de modale dialoog.
  const parent = dialog.locator(`button[aria-haspopup="listbox"][aria-label="${parentTaskLabel('en')}"]`);
  await parent.click();
  await menu(page).getByRole('option', { name: /Fundering/ }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(parent).toBeFocused();
  await expect(parent).toContainText('Fundering');

  // In een dialoog staat de keuze in het concept. De globale undo en plakken mogen hier niet af.
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(dialog).toBeVisible();
  await expect(parent).toContainText('Fundering');
  expect(await snapshot()).toBe(before);
  expect(await taskIds(page)).toEqual([first, second]);
});

test('Tabel: één Escape in een open keuzelijst-cel sluit de lijst én annuleert de bewerking', async ({ page, ops: _ops }) => {
  const [id] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
  ]);
  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    const columns = store.taskGridSurfaces['full-task-grid'].columns;
    const wanted = ['task.constraint.type', 'task.isMilestone', 'task.calendarId'] as (typeof columns)[number]['id'][];
    const missing = wanted.filter(w => !columns.some(c => c.id === w));
    if (missing.length) {
      store.commitTaskGridColumns('full-task-grid', 'Keuzelijstkolommen voor browsertest', [
        ...columns,
        ...missing.map(w => ({ id: w, width: 180, pinned: false })),
      ]);
    }
    store.setUI({ activeRibbonTab: 'table' });
  });
  const taskOf = () => page.evaluate(taskId => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === taskId)!;
    return { constraint: t.constraint?.type ?? 'ASAP', milestone: t.isMilestone, calendar: t.calendarId };
  }, id);
  const before = await taskOf();

  for (const [column, kind] of [['task.constraint.type', 'enum'], ['task.isMilestone', 'boolean'], ['task.calendarId', 'enum']] as const) {
    const cell = page.locator(`[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${id}"][data-grid-column-id="${column}"]`);
    await cell.click();
    await page.keyboard.press('Enter');
    const editor = page.locator(`[data-task-editor-kind="${kind}"]`);
    await expect(editor).toBeVisible();
    await expect(menu(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await expect(editor).toHaveCount(0);
    await expect.poll(() => cell.evaluate(el => el.contains(document.activeElement))).toBe(true);
    expect(await taskOf()).toEqual(before);
  }
  // Dezelfde kalendercel kiest op naam, maar bewaart het id. Leeg betekent de projectkalender.
  const calendarFixture = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const { id: _id, ...base } = s.calendar;
    const calendarId = s.addCalendar({ ...base, name: 'Ploeg met eigen kalender' });
    return { calendarId, projectName: s.calendar.name };
  });
  const calendarCell = page.locator('[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="' + id + '"][data-grid-column-id="task.calendarId"]');
  await expect(calendarCell).toContainText(calendarFixture.projectName);
  await calendarCell.click();
  await page.keyboard.press('Enter');
  await menu(page).getByRole('option', { name: 'Ploeg met eigen kalender', exact: true }).click();
  await expect(calendarCell).toHaveText('Ploeg met eigen kalender');
  expect((await taskOf()).calendar).toBe(calendarFixture.calendarId);
  await expect(menu(page)).toHaveCount(0);
  await calendarCell.click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(calendarCell).toContainText(calendarFixture.projectName);
  expect((await taskOf()).calendar).toBeUndefined();
  await page.keyboard.press('ControlOrMeta+y');
  await expect(calendarCell).toHaveText('Ploeg met eigen kalender');
  await calendarCell.click();
  await page.keyboard.press('Enter');
  await menu(page).getByRole('option').filter({ hasText: calendarFixture.projectName }).first().click();
  await expect(calendarCell).toContainText(calendarFixture.projectName);
  expect((await taskOf()).calendar).toBeUndefined();

});

test('Tabel: de al gekozen optie opnieuw kiezen (klik, Spatie, Enter) legt vast en sluit de editor', async ({ page, ops: _ops }) => {
  const [id] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
  ]);
  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    const columns = store.taskGridSurfaces['full-task-grid'].columns;
    const wanted = ['task.constraint.type', 'task.isMilestone'] as (typeof columns)[number]['id'][];
    const missing = wanted.filter(w => !columns.some(c => c.id === w));
    if (missing.length) {
      store.commitTaskGridColumns('full-task-grid', 'Keuzelijstkolommen voor browsertest', [
        ...columns,
        ...missing.map(w => ({ id: w, width: 180, pinned: false })),
      ]);
    }
    store.setUI({ activeRibbonTab: 'table' });
  });
  const taskOf = () => page.evaluate(taskId => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === taskId)!;
    return { constraint: t.constraint?.type ?? 'ASAP', milestone: t.isMilestone };
  }, id);
  const before = await taskOf();

  for (const [column, kind] of [['task.constraint.type', 'enum'], ['task.isMilestone', 'boolean']] as const) {
    const cell = page.locator(`[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${id}"][data-grid-column-id="${column}"]`);
    const editor = page.locator(`[data-task-editor-kind="${kind}"]`);
    for (const how of ['click', ' ', 'Enter'] as const) {
      await cell.click();
      await page.keyboard.press('Enter');
      await expect(editor).toBeVisible();
      await expect(menu(page)).toBeVisible();
      const current = menu(page).locator('[role="option"][aria-selected="true"]');
      await expect(current).toHaveCount(1);
      if (how === 'click') await current.click();
      else await page.keyboard.press(how);
      await expect(menu(page)).toHaveCount(0);
      await expect(editor).toHaveCount(0);
      // Vastleggen gaat zoals Enter bij een andere waarde: de focus staat weer op een cel van deze
      // kolom (de volgende rij), niet op een losse knop.
      await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[data-grid-column-id]')?.getAttribute('data-grid-column-id') ?? null)).toBe(column);
      expect(await taskOf()).toEqual(before);
    }
  }
});

test('F5 na een muiskeuze: de focus blijft op de keuzelijst-trigger', async ({ page, ops: _ops }) => {
  await seedPanel(page, true);
  const trigger = page.locator('button[aria-haspopup="listbox"][aria-label="Calendar"]');
  await trigger.click();
  await menu(page).getByRole('option', { name: LONG_CALENDAR }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('F5');
  await expect(trigger).toBeFocused();
});

test('lange lijst: alleen de zichtbare opties in de DOM; toetsen, scrollen en breedte werken over alle opties', async ({ page, ops: _ops }) => {
  const COUNT = 600;
  const LAST = `${LONG_TASK} (laatste)`;
  const ids = await seedProject(page, Array.from({ length: COUNT }, (_, i) => ({
    name: i === COUNT - 1 ? LAST : `Taak-${String(i + 1).padStart(3, '0')}`,
    start: '2026-09-07', finish: '2026-09-10', durationDays: 4,
  })));
  await page.evaluate(taskId => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: taskId }), ids[0]);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const trigger = dialog.locator(`button[aria-haspopup="listbox"][aria-label="${parentTaskLabel('en')}"]`);
  await trigger.click();
  const list = menu(page);
  await expect(list).toBeVisible();

  // Veel minder optie-nodes dan opties; aria-setsize noemt het echte aantal.
  const options = list.locator('[role="option"]');
  const rendered = await options.count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(100);
  const setsize = Number(await options.first().getAttribute('aria-setsize'));
  expect(setsize).toBeGreaterThanOrEqual(COUNT - 1);

  const active = () => list.locator('.ops-select__option.is-highlighted');
  const expectActiveInView = async (name: RegExp | string) => {
    await expect(active()).toHaveCount(1);
    await expect(active()).toContainText(name);
    await expect(active()).toBeInViewport();
    const activeId = await active().getAttribute('id');
    await expect(list).toHaveAttribute('aria-activedescendant', activeId!);
  };

  // End: de laatste optie is actief en staat in beeld; het langste label past helemaal.
  await page.keyboard.press('End');
  await expectActiveInView(LAST);
  await expect(active()).toHaveAttribute('aria-posinset', String(setsize));
  const fit = await list.evaluate(el => {
    const label = el.querySelector<HTMLElement>('.ops-select__option.is-highlighted .ops-select__option-label')!;
    const r = el.getBoundingClientRect();
    return { clipped: label.scrollWidth > label.clientWidth + 0.5, left: r.left, right: r.right, viewport: window.innerWidth };
  });
  expect(fit.clipped).toBe(false);
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(fit.viewport);

  // Home, PageDown en PageUp.
  await page.keyboard.press('Home');
  await expect(active()).toHaveAttribute('aria-posinset', '1');
  await expect(active()).toBeInViewport();
  await page.keyboard.press('PageDown');
  const afterPage = Number(await active().getAttribute('aria-posinset'));
  expect(afterPage).toBeGreaterThan(2);
  await expect(active()).toBeInViewport();
  await page.keyboard.press('PageUp');
  await expect(active()).toHaveAttribute('aria-posinset', '1');

  // Typeahead vindt een optie ver buiten het getekende stuk. Het label is "<WBS> — <naam>" (of alleen
  // de naam); typ het begin tot de eerste spatie, want een spatie kiest de actieve optie.
  const target = await page.evaluate(taskId => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === taskId)!;
    return { label: `${t.wbsCode ? `${t.wbsCode} — ` : ''}${t.name}`, name: t.name };
  }, ids[449]);
  await page.keyboard.type(target.label.split(' ')[0], { delay: 20 });
  await expectActiveInView(target.name);

  // Scrollen met het muiswiel naar onderen toont de laatste optie.
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await trigger.click();
  await expect(list).toBeVisible();
  await list.hover();
  for (let i = 0; i < 40 && !(await list.getByRole('option', { name: LAST }).isVisible()); i++) {
    await page.mouse.wheel(0, 4000);
  }
  await expect(list.getByRole('option', { name: LAST })).toBeInViewport();
  expect(await options.count()).toBeLessThan(100);
});

/** Elke optie past volledig: geen afgeknipt label, en de lijst ligt binnen het venster. */
async function expectOptionsFit(page: Page): Promise<{ menu: DOMRect; widest: number }> {
  const result = await menu(page).evaluate(el => {
    const labels = [...el.querySelectorAll<HTMLElement>('.ops-select__option-label')];
    return {
      menu: el.getBoundingClientRect().toJSON() as DOMRect,
      clipped: labels.filter(l => l.scrollWidth > l.clientWidth + 0.5).map(l => l.textContent),
      widest: Math.max(...labels.map(l => l.scrollWidth)),
      viewport: window.innerWidth,
    };
  });
  expect(result.clipped).toEqual([]);
  expect(result.menu.width).toBeGreaterThanOrEqual(result.widest);
  expect(result.menu.left).toBeGreaterThanOrEqual(0);
  expect(result.menu.right).toBeLessThanOrEqual(result.viewport);
  return { menu: result.menu, widest: result.widest };
}

/** De taakdialoog met een taak met een naam die breder is dan de (brede) trigger "Bovenliggende taak". De
 *  dialoog staat midden in het venster, dus de lijst heeft aan beide kanten ruimte om te groeien. */
async function openParentSelect(page: Page, locale: 'en' | 'ar'): Promise<Locator> {
  const [, second] = await seedProject(page, [
    { name: LONG_TASK, start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
    { name: 'Metselwerk', start: '2026-09-11', finish: '2026-09-16', durationDays: 4 },
  ]);
  await page.evaluate(taskId => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: taskId }), second);
  const label = parentTaskLabel(locale);
  const trigger = page.getByRole('dialog').locator(`button[aria-haspopup="listbox"][aria-label="${label}"]`);
  await trigger.click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('option', { name: LONG_TASK })).toBeVisible();
  return trigger;
}

test('de open lijst is minstens zo breed als de langste optie en lijnt links uit', async ({ page, ops: _ops }) => {
  const trigger = await openParentSelect(page, 'en');
  const t = (await trigger.boundingBox())!;
  const { menu: box, widest } = await expectOptionsFit(page);
  // De lange naam is breder dan de trigger; de lijst groeit dus mee, vanaf de linkerrand.
  expect(widest).toBeGreaterThan(t.width);
  expect(box.width).toBeGreaterThan(t.width);
  expect(Math.abs(box.left - t.x)).toBeLessThanOrEqual(1);
});

test('een lijst bij de vensterrand blijft binnen het venster en knipt niets af (paneel)', async ({ page, ops: _ops }) => {
  const { trigger } = await seedPanel(page, true);
  await trigger.click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('option', { name: LONG_CALENDAR })).toBeVisible();
  const t = (await trigger.boundingBox())!;
  const { widest } = await expectOptionsFit(page);
  expect(widest).toBeGreaterThan(t.width);
});

test('RTL (ar): de open lijst past de langste optie en lijnt uit op de rechterrand', async ({ page, ops: _ops }) => {
  await chooseLocale(page, LOCALE_CASES.find(c => c.code === 'ar')!);
  const trigger = await openParentSelect(page, 'ar');
  const t = (await trigger.boundingBox())!;
  const { menu: box, widest } = await expectOptionsFit(page);
  expect(widest).toBeGreaterThan(t.width);
  // Rechterrand van lijst en trigger vallen samen (binnen een pixel); de lijst groeit naar links.
  expect(Math.abs(box.right - (t.x + t.width))).toBeLessThanOrEqual(1);
  expect(box.left).toBeLessThan(t.x);
});
