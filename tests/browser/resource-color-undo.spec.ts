// Kleurkiezer in de resourcerij (Projectweergave van het resourcepaneel). Tijdens het slepen in de
// kiezer vuurt de browser een `input`-event per tussenkleur; pas bij het kiezen (sluiten) volgt één
// `change`. Vroeger schreef elk `input`-event `updateResource`: één sleep gaf een undo-stap per
// tussenkleur, en Ctrl+Z zette alleen de voorlaatste tussenkleur terug. Nu is één gekozen kleur
// één undo-stap.
//
// De kleurkiezer zelf is een native venster buiten de pagina (Playwright kan hem niet bedienen);
// daarom speelt de test de eventreeks na die de browser tijdens een sleep aan het invoerveld levert:
// een waarde per stap met een `input`-event, afgesloten met `change`. Ctrl+Z is een echte toets;
// `window.__OPS__` zet alleen de resource klaar, opent het paneel en leest state.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

async function openProjectResources(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const rid = s.addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, color: '#112233' });
    s.setUI({ activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project' });
    return rid;
  });
  await expect(colorInput(page, id)).toBeVisible();
  return id;
}

const colorInput = (page: Page, id: string) =>
  page.locator(`[data-ops-grid-row="${id}"] input[type="color"]`);

const resource = (page: Page, id: string) => page.evaluate((rid) => {
  const s = window.__OPS__!.store.getState();
  return {
    color: s.resources.find(x => x.id === rid)!.color ?? null,
    undo: s.historyEvents.filter(e => e.state === 'applied').length,
  };
}, id);

/** Wat de native kiezer bij een sleep aan het veld levert: per tussenkleur de waarde + `input`,
 *  bij het kiezen één `change`. De native value-setter, zodat React de wijziging ziet. */
async function dragPicker(page: Page, id: string, steps: string[], commit: boolean): Promise<void> {
  await colorInput(page, id).evaluate((el: HTMLInputElement, { steps, commit }) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (const value of steps) {
      setValue.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (commit) el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { steps, commit });
}

test('resourcerij: slepen in de kleurkiezer is één undo-stap per gekozen kleur', async ({ page, ops: _ops }) => {
  const id = await openProjectResources(page);
  const before = await resource(page, id);

  await dragPicker(page, id, ['#223344', '#334455', '#445566', '#556677'], false);
  // Tijdens het slepen toont het veld de tussenkleur, maar de store (en de undo-geschiedenis) nog niet.
  await expect(colorInput(page, id)).toHaveValue('#556677');
  expect(await resource(page, id)).toEqual(before);

  await dragPicker(page, id, ['#667788'], true);
  const after = await resource(page, id);
  expect(after.color).toBe('#667788');
  expect(after.undo - before.undo).toBe(1);

  // Ctrl+Z buiten een typveld: de oorspronkelijke kleur komt in één stap terug, ook in het veld.
  await page.locator('thead th').nth(1).click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => resource(page, id).then(r => r.color)).toBe('#112233');
  await expect(colorInput(page, id)).toHaveValue('#112233');
});

test('resourcerij: twee gekozen kleuren zijn twee undo-stappen', async ({ page, ops: _ops }) => {
  const id = await openProjectResources(page);
  const before = await resource(page, id);

  // Playwrights eigen invoer voor een kleurveld (`fill`: waarde + `input` + `change`) = één keuze.
  await colorInput(page, id).fill('#aa0000');
  await expect.poll(() => resource(page, id).then(r => r.color)).toBe('#aa0000');
  await dragPicker(page, id, ['#00aa00', '#00bb00'], true);
  const after = await resource(page, id);
  expect(after.color).toBe('#00bb00');
  expect(after.undo - before.undo).toBe(2);
});
