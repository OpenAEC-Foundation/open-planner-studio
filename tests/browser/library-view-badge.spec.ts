// Bibliotheekweergave: een poolitem dat al in het actieve project zit toont de badge "In project"
// in plaats van de knop "Toewijzen aan project" — die knop gaf daar toch alleen de melding
// "Zit al in het project.". Een nog niet toegewezen item houdt de knop.
import { expect, test } from './fixtures/ops';

test('bibliotheekweergave: al toegewezen poolitem toont de badge, het andere de knop', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    const companyId = store.addCompany('Badge-bibliotheek');
    store.setProject({ companyId });
    const linkedId = store.addPoolResource(companyId, {
      name: 'Gekoppelde kraan', type: 'EQUIPMENT', maxUnits: 1,
    } as never)!;
    const freeId = store.addPoolResource(companyId, {
      name: 'Vrije ploeg', type: 'CREW', maxUnits: 2,
    } as never)!;
    // Fixture: de koppeling zelf via de store-actie — de test meet de weergave, niet het toewijzen.
    window.__OPS__!.store.getState().addLibraryResourceToProject(companyId, linkedId);
    store.setUI({
      activeRibbonTab: 'resources',
      showResourcePanel: false,
      resourcePanelDocked: false,
      pendingNewResource: false,
    });
    return { linkedId, freeId };
  });

  // Echte klikken: paneel openen en naar de Bibliotheekweergave.
  await page.getByTitle(/Open the full resource panel|volledige resourcepaneel/i).click();
  await page.getByRole('button', { name: /^(Library|Bibliotheek)$/ }).click();

  const rows = page.locator('[data-ops-pool-resource-row]');
  await expect(rows).toHaveCount(2);

  const linkedRow = rows.filter({ has: page.locator(`input[value="Gekoppelde kraan"]`) });
  const freeRow = rows.filter({ has: page.locator(`input[value="Vrije ploeg"]`) });
  await expect(linkedRow).toHaveCount(1);
  await expect(freeRow).toHaveCount(1);

  const assignName = /^(Assign to project|Toewijzen aan project)$/;
  await expect(linkedRow.locator('[data-ops-pool-in-project]')).toHaveAttribute('data-ops-pool-in-project', '1');
  await expect(linkedRow.getByRole('button', { name: assignName })).toHaveCount(0);

  await expect(freeRow.locator('[data-ops-pool-in-project]')).toHaveCount(0);
  await expect(freeRow.getByRole('button', { name: assignName })).toHaveCount(1);

  // En de knop op het vrije item doet nog gewoon zijn werk: daarna telt ook die rij als "in project".
  await freeRow.getByRole('button', { name: assignName }).click();
  await expect(freeRow.locator('[data-ops-pool-in-project]')).toHaveAttribute('data-ops-pool-in-project', '1');
  expect(await page.evaluate(id => window.__OPS__!.store.getState().resources
    .filter(r => r.libraryOrigin?.libraryItemId === id).length, ids.freeId)).toBe(1);
});
