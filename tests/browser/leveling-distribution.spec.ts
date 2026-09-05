// B1c-plan3 taak 8 — de verdeeldialoog: ingang, voorstel-berekening, focus-trap en blokkade.
//
// De `window.__OPS__`-brug bouwt UITSLUITEND de deterministische fixture (bibliotheek, poolitem,
// documenten, boekingen) en leest state; elke geteste handeling — het openen van de
// Bezetting-weergave, het klikken op "Verdelen…", de gereedschapsschakelaar, "Herbereken", Escape —
// is een echt browserevent.
import type { Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';

interface Library {
  companyId: string;
  poolResourceId: string;
}

/** Maak de app-globale bibliotheek met één poolitem van `maxUnits` capaciteit. */
async function createLibrary(page: Page, maxUnits: number): Promise<Library> {
  return page.evaluate(units => {
    const s = window.__OPS__!.store.getState();
    const companyId = s.addCompany('Verdeelbibliotheek');
    const poolResourceId = s.addPoolResource(companyId, {
      name: 'Gedeelde kraan',
      type: 'LABOR',
      description: '',
      maxUnits: units,
    });
    if (!poolResourceId) throw new Error('poolresource kon niet worden aangemaakt');
    return { companyId, poolResourceId };
  }, maxUnits);
}

/** Koppel het ACTIEVE document aan de bibliotheek en boek `unitsPerDay` op `taskId`. */
async function bookOnPoolItem(
  page: Page,
  library: Library,
  taskId: string,
  unitsPerDay: number,
  { calculate = true }: { calculate?: boolean } = {},
): Promise<void> {
  await page.evaluate(({ companyId, poolResourceId, id, units, calculate: doCalc }) => {
    const s = window.__OPS__!.store.getState();
    s.bindProjectToCompany(companyId);
    const materialized = s.addLibraryResourceToProject(companyId, poolResourceId);
    if (!materialized.resourceId) throw new Error('poolresource kon niet worden gematerialiseerd');
    s.assignResource(id, materialized.resourceId, units);
    if (doCalc) window.__OPS__!.store.getState().runCPM();
  }, { ...library, id: taskId, units: unitsPerDay, calculate });
}

/** Twee documenten die op dezelfde dagen elk 1/dag op één poolitem met capaciteit 1 boeken. */
async function seedTwoConflictingDocuments(page: Page): Promise<Library> {
  const [taskA] = await seedProject(page, [{
    name: 'Project A taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Project A');
  const library = await createLibrary(page, 1);
  await bookOnPoolItem(page, library, taskA, 1);

  await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  const [taskB] = await seedProject(page, [{
    name: 'Project B taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Project B');
  await bookOnPoolItem(page, library, taskB, 1);
  return library;
}

/**
 * Eén gerekend document mét conflict (capaciteit 0,5 tegen een boeking van 1/dag) plus één SLAPEND
 * document dat op hetzelfde poolitem boekt maar een relatiecyclus draagt: dat kan niet efemeer
 * doorgerekend worden, meldt dus `counted: false`, en dat blokkeert de hele verdeling (spec §3.1).
 */
async function seedUncountedDocument(page: Page): Promise<Library> {
  const [taskA] = await seedProject(page, [{
    name: 'Gerekend project taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Gerekend project');
  const library = await createLibrary(page, 0.5);
  await bookOnPoolItem(page, library, taskA, 1);
  const countedDocumentId = (await state(page)).activeDocumentId;

  await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  const [cycleA, cycleB] = await seedProject(page, [
    { name: 'Cyclus taak 1', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Cyclus taak 2', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Ongerekend project');
  await bookOnPoolItem(page, library, cycleA, 1);
  // De cyclus als LAATSTE, en zonder runCPM erna: het document blijft `scheduleStale` staan, dus de
  // bezettingskern probeert hem efemeer door te rekenen — en faalt op de cyclus.
  await page.evaluate(({ a, b }) => {
    const s = window.__OPS__!.store.getState();
    s.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    s.addSequence({ predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
  }, { a: cycleA, b: cycleB });

  await page.evaluate(id => window.__OPS__!.store.getState().switchDocument(id), countedDocumentId);
  return library;
}

/** De Bezetting-weergave openen met een echte klik (patroon uit theme-render.spec.ts). */
async function openOccupancyWithRealClick(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({
      showResourcePanel: true,
      resourcePanelDocked: false,
      resourcesView: 'project',
    });
  });
  await page.locator('[data-ops-occupancy-view-button]').click();
  await expect(page.locator('[data-ops-occupancy-view]')).toBeVisible();
}

/** De echte gebruikersroute naar de dialoog: de "Verdelen…"-knop op de conflictregel. */
async function openDistributionFromConflictRow(page: Page): Promise<void> {
  await openOccupancyWithRealClick(page);
  await page.locator('[data-ops-occupancy-row]').first()
    .getByRole('button', { name: /Verdelen|Distribute/ }).click();
  await expect(page.locator('[data-ops-distribution-dialog]')).toBeVisible();
}

test('verdeeldialoog: openen vanuit de conflictregel, een voorstel rekenen, focus-trap en sluiten', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);

  // Focus-trap: de gedeelde `Dialog` legt de focus meteen binnen het paneel.
  await expect(page.locator('[data-ops-distribution-dialog] :focus')).toHaveCount(1);
  // Losse dialoog, geen drill-down: het overzicht blijft eronder gewoon staan.
  await expect(page.locator('[data-ops-occupancy-row]').first()).toBeVisible();
  // §3.4: het openen IS een rekenmoment — beide deelnemende documenten krijgen een strook.
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ops-distribution-dialog]')).toHaveCount(0);
  // De tune-state overleeft de sluiting (§7): opnieuw openen begint niet van voren af aan.
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.levelingDistribution !== null)).toBe(true);
});

test('verdeeldialoog: de gereedschapsschakelaar laat het voorstel vervallen met reden', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const toggle = page.getByRole('switch', { name: /Onderbrekingen toestaan|Allow interruptions/ });
  await toggle.click();

  // §3.4 noemt een gereedschapswijziging een DISCREET REKENMOMENT: de wijziging zet de reden én
  // plant meteen de herberekening, en de stale-strook blijft staan tot die run klaar is. Op deze
  // minieme fixture is die run binnen één macrotask voorbij, dus de strook zelf is niet
  // betrouwbaar te vangen. Wat wél stabiel is: de dialoog houdt de LAATSTE reden vast, zodat
  // aantoonbaar blijft dat de gebruiker `stale.tool` te zien kreeg.
  await expect(page.locator('[data-ops-distribution-dialog]'))
    .toHaveAttribute('data-ops-distribution-last-stale-reason', 'tool');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.levelingDistribution!.allowSplits)).toBe(true);

  // "Herbereken" is de expliciete route; daarna staat er geen stale-strook meer.
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect(page.locator('[data-ops-distribution-stale]')).toHaveCount(0);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);
});

test('verdeeldialoog: een geblokkeerd voorstel legt uit waarom en biedt geen Toepassen', async ({ page, ops: _ops }) => {
  await seedUncountedDocument(page);
  await openDistributionFromConflictRow(page);

  await expect(page.locator('[data-ops-distribution-blocked]')).toContainText(/doorrekenen|calculate/i);
  await expect(page.getByRole('button', { name: /^(Toepassen|Apply)$/ })).toBeDisabled();
  // Geblokkeerd ⇒ geen stroken en geen gereedschapsschakelaar: er valt niets te bedienen.
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: /Onderbrekingen toestaan|Allow interruptions/ })).toHaveCount(0);
});
