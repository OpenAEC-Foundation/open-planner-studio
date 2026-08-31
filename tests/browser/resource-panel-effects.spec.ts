// Resourcepaneelkarakterisering: mount-/koppelingsovergangen, lintverzoeken en gewone
// weergavewissels hebben elk één eigen effectdoel en mogen elkaars lokale concept-rij niet wissen.
import { expect, test } from './fixtures/ops';

async function setupLinkedProject(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    const companyId = store.addCompany('Browserbibliotheek');
    store.setProject({ companyId });
    store.setUI({
      activeRibbonTab: 'resources',
      showResourcePanel: false,
      resourcePanelDocked: false,
      resourcesView: 'company',
      pendingNewResource: false,
    });
  });
}

test('resource panel: reset op mount maar niet na een handmatige weergavekeuze', async ({ page, ops: _ops }) => {
  await setupLinkedProject(page);
  await page.getByTitle(/Open the full resource panel|volledige resourcepaneel/i).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.resourcesView))
    .toBe('project');

  await page.getByRole('button', { name: /^(Library|Bibliotheek)$/ }).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.resourcesView))
    .toBe('company');
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({ name: 'Onverwante hertekening' }));
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.resourcesView))
    .toBe('company');
});

test('resource panel: pending-new opent één gefocuste draft en viewwissels ruimen alleen de oude variant op', async ({ page, ops: _ops }) => {
  await setupLinkedProject(page);

  // De echte lintknop zet pendingNewResource; het paneel consumeert die vlag en opent exact één rij.
  await page.getByRole('button', { name: /^(New resource|Nieuwe resource)$/ }).click();
  const draft = page.locator('[data-ops-pending-new-row]');
  await expect(draft).toHaveCount(1);
  await expect(draft.getByPlaceholder(/^(Name|Naam)$/)).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.pendingNewResource))
    .toBe(false);

  // Een tweede verzoek vervangt de lokale lege draft, maar verdubbelt hem nooit.
  await page.getByRole('button', { name: /^(New resource|Nieuwe resource)$/ }).click();
  await expect(draft).toHaveCount(1);
  await expect(draft.getByPlaceholder(/^(Name|Naam)$/)).toBeFocused();

  // De projectdraft hoort niet in de bibliotheekweergave en verdwijnt bij de echte tabklik.
  await page.getByRole('button', { name: /^(Library|Bibliotheek)$/ }).click();
  await expect(draft).toHaveCount(0);
  await page.locator('[data-ops-resource-add]').click();
  await expect(draft).toHaveCount(1);

  // Een render door poolinhoud laat de draft van de actuele weergave ongemoeid.
  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    store.renameCompany(store.project.companyId!, 'Browserbibliotheek hernoemd');
  });
  await expect(draft).toHaveCount(1);

  // Naar Project ruimt precies de pooldraft op; terugkeren maakt niets uit zichzelf opnieuw aan.
  await page.getByRole('button', { name: /^Project$/ }).click();
  await expect(draft).toHaveCount(0);
  await page.getByRole('button', { name: /^(Library|Bibliotheek)$/ }).click();
  await expect(draft).toHaveCount(0);
});
