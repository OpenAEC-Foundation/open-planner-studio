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

// --- B1c-plan3 taak 9 — de fasestroken (spec §6, minus het pointer-slepen van taak 10) ----------

/**
 * `seedProject` maakt HANDMATIG GEPLANDE taken (`manuallyScheduled: true`) — daar rekent de
 * CPM-solver de datums niet van, dus een nivelleringsdelay verschuift wel de boeking maar NIET de
 * einddatum. Voor een fixture die het einddatum-effect meet moet de taak dus door de planner
 * gestuurd worden; verder blijft alles bij het oude (duur en projectstartdatum staan al goed).
 */
async function makeScheduled(page: Page, taskId: string): Promise<void> {
  await page.evaluate(id => {
    window.__OPS__!.store.getState().updateTask(id, { manuallyScheduled: false });
    window.__OPS__!.store.getState().runCPM();
  }, taskId);
}

/**
 * Twee documenten met elk ÉÉN werkdag werk op DEZELFDE dag, op een poolitem met capaciteit 1.
 * Het document met rang 2 kan die maandag niet krijgen en schuift bij een plafond ≥ 1 precies één
 * werkdag op — het kleinste fixture waarin het einddatum-effect een vast, controleerbaar getal is.
 */
async function seedTwoSingleDayDocuments(page: Page): Promise<Library> {
  const [taskA] = await seedProject(page, [{
    name: 'Eendaagse A', start: '2026-09-07', finish: '2026-09-07', durationDays: 1,
  }], 'Eendaags project A');
  await makeScheduled(page, taskA);
  const library = await createLibrary(page, 1);
  await bookOnPoolItem(page, library, taskA, 1);

  await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  const [taskB] = await seedProject(page, [{
    name: 'Eendaagse B', start: '2026-09-07', finish: '2026-09-07', durationDays: 1,
  }], 'Eendaags project B');
  await makeScheduled(page, taskB);
  await bookOnPoolItem(page, library, taskB, 1);
  return library;
}

test('fasestroken: pin en plafond zijn met het toetsenbord te bedienen', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const strip = page.locator('[data-ops-distribution-strip]').first();
  // De pin is een echte toggle-knop: STABIELE naam, toestand uitsluitend via `aria-pressed` (§6).
  const pin = strip.getByRole('button', { name: /Vastzetten|Pin/ });
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => Object.values(
    window.__OPS__!.store.getState().ui.levelingDistribution!.pinned).filter(Boolean).length)).toBe(1);

  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect(strip).toHaveAttribute('data-ops-distribution-pinned', 'true');

  await pin.click(); // pin weer los — een gepinde strook heeft geen bedienbaar plafond
  await expect(pin).toHaveAttribute('aria-pressed', 'false');

  const handle = strip.getByRole('slider');
  await handle.focus();
  await handle.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState()
    .ui.levelingDistribution!.ceilings[Object.keys(window.__OPS__!.store.getState().ui.levelingDistribution!.ceilings)[0]]))
    .toBe(1);

  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  await handle.press('End');
  await expect(handle).toHaveAttribute('aria-valuetext', /onbegrensd|unlimited/i);
});

test('fasestroken: het label toont het EINDDATUM-effect, niet de sleepafstand', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  // De stroken staan in RANGORDE; nr. 2 is degene die moet wijken.
  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  const handle = strip.getByRole('slider');
  await handle.focus();
  // Home = plafond 0 — een deterministisch startpunt, ongeacht de benutte uitloop.
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  for (let step = 0; step < 3; step++) await handle.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '3');

  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  // Het label meldt wat er met de EINDDATUM gebeurt (+1 werkdag), niet hoe ver de handle stond (3).
  await expect(strip.locator('[data-ops-distribution-effect]')).toContainText(/eind \+1 dag|end \+1 day/i);
  // Toegestaan maar niet benut: gevraagd 3, dichtst haalbare 1.
  await expect(strip.locator('[data-ops-distribution-achievable]')).toBeVisible();
});

// --- B1c-plan3 taak 10 — pointer-slepen op de plafond-handle, en rangorde met de muis -------------

test('plafond-handle: slepen snapt op hele werkdagen en rekent pas bij loslaten', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  // De stroken staan in RANGORDE; nr. 2 is degene die moet wijken (zelfde fixture als de vorige
  // test). Home = plafond 0 — een deterministisch startpunt voor de sleep, ongeacht de benutte
  // uitloop; expliciet herberekend zodat het effectlabel al bij díé stand hoort vóór de sleep begint.
  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  const handle = strip.locator('[data-ops-distribution-handle]');
  await handle.focus();
  await handle.press('Home');
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect(handle).toHaveAttribute('aria-valuenow', '0');

  // Geen magisch getal: de dagbreedte komt uit de gedeelde tijdas (`occupancyAxis.ts`), zichtbaar via
  // hetzelfde `data-ops-distribution-day-width`-attribuut dat de sleeppositie zelf ook gebruikt.
  const dayWidth = Number(await strip.getAttribute('data-ops-distribution-day-width'));
  expect(dayWidth).toBeGreaterThan(0);

  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  // Tijdens het slepen: de PLAFOND-waarde beweegt mee, het EFFECT-label niet (spec §3.4 — "nooit per
  // sleep-pixel").
  const effectBefore = await strip.locator('[data-ops-distribution-effect]').textContent();
  await page.mouse.move(box.x + box.width / 2 + 3 * dayWidth, box.y + box.height / 2, { steps: 6 });
  await expect(handle).toHaveAttribute('aria-valuenow', '3');
  expect(await strip.locator('[data-ops-distribution-effect]').textContent()).toBe(effectBefore);

  // De muis verlaat het element en het slepen loopt door — `setPointerCapture` op de handle, geen
  // document-brede listener nodig.
  await page.mouse.move(box.x + box.width / 2 + 5 * dayWidth, box.y - 200, { steps: 4 });
  await expect(handle).toHaveAttribute('aria-valuenow', '5');
  await page.mouse.up();

  // Loslaten is een discreet rekenmoment (§3.4) ⇒ de waarde gaat de ui-state in en het overzicht
  // rekent automatisch door (dezelfde route als een toetsaanslag of de pin-knop) — het effectlabel
  // wordt dus uiteindelijk bijgewerkt, zonder dat de test zelf op "Herbereken" hoeft te klikken.
  await expect.poll(() => strip.locator('[data-ops-distribution-effect]').textContent()).not.toBe(effectBefore);
  const shiftedDocId = await strip.getAttribute('data-ops-doc-id') ?? '';
  await expect.poll(() => page.evaluate(docId => {
    const ui = window.__OPS__!.store.getState().ui.levelingDistribution!;
    return ui.ceilings[docId];
  }, shiftedDocId)).toBe(5);
});

test('rangorde: slepen verandert de volgorde en laat het voorstel vervallen', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);

  const rows = page.locator('[data-ops-distribution-rank-row]');
  await expect(rows).toHaveCount(2);
  const firstDocId = await rows.nth(0).getAttribute('data-ops-doc-id');
  const secondDocId = await rows.nth(1).getAttribute('data-ops-doc-id');

  // Sleep rij 2 boven rij 1 — native HTML5 drag-and-drop, HETZELFDE mechanisme als
  // `DataGridHeader`'s kolomherordening (`draggable` + dragover/drop), geen los pointer-events-
  // sleepmechanisme ernaast. `targetPosition` mikt op het BOVENSTE stuk van rij 1, zodat de drop als
  // "voor" telt — een drop op het midden zou de rij weer op zijn oude plek laten vallen.
  await rows.nth(1).dragTo(rows.nth(0), { targetPosition: { x: 20, y: 2 } });

  await expect(page.locator('[data-ops-distribution-rank-row]').first())
    .toHaveAttribute('data-ops-doc-id', secondDocId!);
  await expect(page.locator('[data-ops-distribution-rank-row]').last())
    .toHaveAttribute('data-ops-doc-id', firstDocId!);
  // Een herordening is een rangordewijziging ⇒ hetzelfde `staleReason = 'rank'` als de knoppen.
  await expect(page.locator('[data-ops-distribution-dialog]'))
    .toHaveAttribute('data-ops-distribution-last-stale-reason', 'rank');
});
