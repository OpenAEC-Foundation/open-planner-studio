// Knownbug 18: de hint moet dezelfde hiërarchie beschrijven als de echte invoegactie.
// Nieuwe route: er bestond nog geen browserscenario voor het WBS-sjablonenmenu.
import { expect, test } from './fixtures/ops';

test('WBS-sjabloon: hint en invoegen als laatste subtaak of op rootniveau komen overeen', async ({ page, ops: _ops }) => {
  for (const locale of ['nl', 'en']) {
    const fixture = await page.evaluate(async locale => {
      const localePath = '/src/i18n/config.ts';
      const { setLocale } = await import(/* @vite-ignore */ localePath);
      await setLocale(locale);
      const store = window.__OPS__!.store;
      store.getState().newProject();
      const parent = store.getState().addTask({ name: 'Doelfase' });
      const child = store.getState().addTask({ name: 'Bestaande subtaak', parentId: parent });
      store.getState().addTask({ name: 'Andere hoofdtaak' });
      store.getState().selectTask(parent);
      localStorage.setItem('ops-wbs-templates', JSON.stringify([{
        id: 'plaatsing', name: 'Plaatsingssjabloon', createdAt: '2026-10-21',
        tasks: [{ id: 'root', parentId: null, name: 'Ingevoegde tak', description: '',
          taskType: 'CONSTRUCTION', isMilestone: false, durationDays: 2 }],
        sequences: [],
      }]));
      return { parent, child };
    }, locale);
    await page.locator('[data-ops-ribbon-tab="planning"]').click();
    const menu = page.getByRole('button', { name: locale === 'nl' ? 'Sjablonen' : 'Templates', exact: true });
    const hint = locale === 'nl'
      ? 'Invoegen als laatste subtaak van de geselecteerde taak (of onderaan op rootniveau)'
      : 'Insert as the last subtask of the selected task (or at the bottom of the root level)';
    await menu.click();
    const item = page.getByTitle(hint, { exact: true });
    await expect(item).toBeVisible();
    await item.click();
    await expect.poll(() => page.evaluate(({ parent, child }) => {
      const tasks = window.__OPS__!.store.getState().tasks;
      const target = tasks.find(task => task.id === parent)!;
      const inserted = tasks.find(task => task.name === 'Ingevoegde tak')!;
      return { parent: inserted?.parentId, children: target.childIds, insertedId: inserted?.id, child };
    }, fixture)).toMatchObject({
      parent: fixture.parent,
      children: [fixture.child, expect.any(String)],
      insertedId: expect.any(String),
    });
    expect(await page.evaluate(parent => {
      const tasks = window.__OPS__!.store.getState().tasks;
      return tasks.find(task => task.id === parent)!.childIds.at(-1)
        === tasks.find(task => task.name === 'Ingevoegde tak')!.id;
    }, fixture.parent)).toBe(true);

    // Geen selectie is een aparte invoegstand; alleen de fixture verandert, de klik blijft echt.
    await page.evaluate(() => window.__OPS__!.store.setState({ selectedTaskIds: [], activeTaskId: null }));
    await menu.click();
    await expect(item).toBeVisible();
    await item.click();
    await expect.poll(() => page.evaluate(() => {
      const tasks = window.__OPS__!.store.getState().tasks;
      const inserted = tasks.filter(task => task.name === 'Ingevoegde tak');
      return { count: inserted.length, lastParent: inserted.at(-1)?.parentId,
        lastRootName: tasks.filter(task => !task.parentId).at(-1)?.name };
    })).toEqual({ count: 2, lastParent: null, lastRootName: 'Ingevoegde tak' });
  }
});
