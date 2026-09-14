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

/** De ANDERE echte route: de lintknop "Verdelen…" op het Resources-tabblad, zonder eerder gekozen
 *  poolitem — de stand die vóór de reparatie van 2026-09-11 doodliep. */
async function openDistributionFromRibbon(page: Page): Promise<void> {
  await page.locator('.ribbon-tab').filter({ hasText: /^Resources$/ }).click();
  await page.locator('.ribbon-content').getByRole('button', { name: /Verdelen|Distribute/ }).click();
  await expect(page.locator('[data-ops-distribution-dialog]')).toBeVisible();
}

test('lintknop zonder gekozen item: de kiezer toont de conflicten en één klik start het voorstel', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  // Niets gekozen: de dialoog opent in zijn kiezer-stand.
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.levelingDistribution)).toBe(null);
  await openDistributionFromRibbon(page);

  const picks = page.locator('[data-ops-distribution-pick]');
  await expect(picks).toHaveCount(1);
  await expect(picks.first()).toContainText('Gedeelde kraan');
  // In de kiezer-stand bestaan de voorstel-knoppen niet — er valt nog niets te herberekenen of toe
  // te passen (dat waren juist de drie grijze knoppen die de gebruiker deden vastlopen).
  await expect(page.locator('[data-ops-distribution-dialog]')
    .getByRole('button', { name: /Toepassen|Apply/ })).toHaveCount(0);
  await expect(page.locator('[data-ops-distribution-dialog]')
    .getByRole('button', { name: /Verdeel automatisch|Herbereken|Distribute automatically|Recalculate/ })).toHaveCount(0);

  // Klikken = dezelfde start als de conflictregel in het overzicht: beide documenten krijgen een strook.
  await picks.first().click();
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);
});

test('lintknop zonder conflict: de kiezer zegt dat er niets te verdelen valt', async ({ page, ops: _ops }) => {
  // Eén document dat ruim binnen de capaciteit boekt — geen dubbele boeking, dus geen keuze.
  const [taskA] = await seedProject(page, [{
    name: 'Solo taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Solo project');
  const library = await createLibrary(page, 2);
  await bookOnPoolItem(page, library, taskA, 1);

  await openDistributionFromRibbon(page);
  await expect(page.locator('[data-ops-distribution-no-conflicts]')).toBeVisible();
  await expect(page.locator('[data-ops-distribution-pick]')).toHaveCount(0);
  await expect(page.locator('[data-ops-distribution-dialog]')
    .getByRole('button', { name: /Toepassen|Apply/ })).toHaveCount(0);
});

test('"Ander item kiezen…" brengt de gevulde dialoog terug naar de kiezer', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  await page.locator('[data-ops-distribution-pick-another]').click();

  // Geen bevestigingsdialoog ertussen: de tune-state is meteen weg en de kiezer staat er weer.
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.levelingDistribution)).toBe(null);
  await expect(page.locator('[data-ops-distribution-dialog]')).toBeVisible();
  await expect(page.locator('[data-ops-distribution-pick]')).toHaveCount(1);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(0);
});

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
  // De pin is sinds het herontwerp een TEKSTknop ("vastzetten" ↔ "vast — losmaken", spec §6), geen
  // icoon meer. Het testanker blijft `data-ops-distribution-pin`; de toestand blijft `aria-pressed`.
  const pin = strip.locator('[data-ops-distribution-pin]');
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

  // PageUp/PageDown zijn drie werkdagen tegelijk (§5) — het grovere stapje naast de pijltjes.
  await handle.press('PageUp');
  await expect(handle).toHaveAttribute('aria-valuenow', '4');
  await handle.press('PageDown');
  await expect(handle).toHaveAttribute('aria-valuenow', '1');

  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  await handle.press('End');
  await expect(handle).toHaveAttribute('aria-valuetext', /onbegrensd|unlimited/i);
  // Onbegrensd zet de handle aan het einde van de as (spec §5) — meetbaar: hij staat rechts van
  // het laatste dagblokje van dezelfde rij.
  const handleBox = (await handle.boundingBox())!;
  const lastDay = (await strip.locator('[data-ops-distribution-day="work"]').last().boundingBox())!;
  expect(handleBox.x).toBeGreaterThan(lastDay.x + lastDay.width);
  // ... maar de gestippelde "toegestaan maar niet benut"-doos hoort er NIET te zijn: die is een
  // maat, en onbegrensd is geen maat (§4-noot 2026-09-14). Eerder vulde hij de hele track.
  await expect(strip.locator('[data-ops-distribution-tail]')).toHaveCount(0);
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
  // "Toegestaan maar niet benut" is sinds het herontwerp geen ZIN meer maar een VORM (spec §4): de
  // gestippelde lege doos van het nieuwe fase-einde tot de handle-stand. Gevraagd 3, benut 1 ⇒ die
  // doos bestaat en heeft een meetbare breedte.
  const tail = strip.locator('[data-ops-distribution-tail]');
  await expect(tail).toHaveCount(1);
  expect((await tail.boundingBox())!.width).toBeGreaterThan(0);
  // De legenda die uitlegt wat de blokjes, de arcering en de meetlat betekenen staat er één keer.
  await expect(page.locator('[data-ops-distribution-legend]')).toBeVisible();
});

// --- Eigenaarsbesluit 2026-09-14 — slepen is stil, loslaten rekent ------------------------------

test('plafond-handle: tijdens het slepen beweegt alleen de greep; bij loslaten wordt herberekend', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  // De rijen staan in plaatsingsvolgorde; nr. 2 is degene die moet wijken. Home = plafond 0, een
  // deterministisch startpunt ongeacht de benutte uitloop.
  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  const handle = strip.locator('[data-ops-distribution-handle]');
  await handle.focus();
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(() => strip.locator('[data-ops-distribution-effect]').textContent())
    .not.toContain('…');

  // Geen magisch getal: de dagbreedte komt uit de gedeelde tijdas, zichtbaar via hetzelfde
  // attribuut dat de sleeppositie zelf ook gebruikt.
  const dayWidth = Number(await strip.getAttribute('data-ops-distribution-day-width'));
  expect(dayWidth).toBeGreaterThan(0);

  const pill = strip.locator('[data-ops-distribution-effect-pill]');
  const status = page.locator('[data-ops-distribution-status]');
  const pillBefore = await pill.textContent();
  const statusBefore = await status.textContent();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  // Eigenaarsbesluit 2026-09-14 (spec §5-noot): tijdens het slepen beweegt ALLEEN de greep. De
  // gesnapte waarde loopt dus wél mee...
  await page.mouse.move(box.x + box.width / 2 + 3 * dayWidth, box.y + box.height / 2, { steps: 6 });
  await expect(handle).toHaveAttribute('aria-valuenow', '3');

  // De muis verlaat het element en het slepen loopt door — `setPointerCapture` op de handle, geen
  // document-brede listener nodig.
  await page.mouse.move(box.x + box.width / 2 + 5 * dayWidth, box.y - 200, { steps: 4 });
  await expect(handle).toHaveAttribute('aria-valuenow', '5');

  // ...en de GREEP beweegt echt mee onder de muis. Dat is niet vanzelfsprekend zonder de
  // herberekening: de tijdas groeit tijdens het slepen niet meer mee, dus zonder extrapolatie klemt
  // de geometrie de greep vast op de rechterrand van het laatste assegment en sleep je een greep
  // die blijft staan (gemeten 2026-09-14, vóór de extrapolatie in `PhaseStrip`).
  const handleDuring = (await handle.boundingBox())!;
  expect(handleDuring.x).toBeGreaterThan(box.x + 4 * dayWidth);

  // ...maar de UITKOMST niet: geen herberekening, dus de pil en de validatiestrook staan er nog
  // precies zoals vóór het gebaar. Dít is de flikkering die de eigenaar wegwilde.
  expect(await pill.textContent()).toBe(pillBefore);
  expect(await status.textContent()).toBe(statusBefore);

  await page.mouse.up();

  // Pas het loslaten is het rekenmoment — en dan verandert de uitkomst wél.
  await expect.poll(() => pill.textContent()).not.toBe(pillBefore);

  const shiftedDocId = await strip.getAttribute('data-ops-doc-id') ?? '';
  await expect.poll(() => page.evaluate(docId => {
    const ui = window.__OPS__!.store.getState().ui.levelingDistribution!;
    return ui.ceilings[docId];
  }, shiftedDocId)).toBe(5);
});

// --- Polishronde bevinding 3 — de tijdas groeit niet onder de muis weg ---------------------------

test('plafond-handle: een sleep in rij 2 laat de as en de greep van rij 1 staan', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const first = page.locator('[data-ops-distribution-strip]').nth(0);
  const second = page.locator('[data-ops-distribution-strip]').nth(1);
  const anchorHandle = first.locator('[data-ops-distribution-handle]');
  const handle = second.locator('[data-ops-distribution-handle]');

  const dayWidth = Number(await second.getAttribute('data-ops-distribution-day-width'));
  expect(dayWidth).toBeGreaterThan(0);

  // Plafond 0 als deterministisch startpunt, net als de live-sleeptest hierboven.
  await handle.focus();
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(() => second.locator('[data-ops-distribution-effect]').textContent())
    .not.toContain('…');

  // Het ankerpunt: de greep van de rij die NIET gesleept wordt. Vóór deze ronde fitte de as zich
  // bij élke commit opnieuw op de beschikbare breedte; de dagenset groeit mee met het plafond, dus
  // kromp de dagbreedte onderweg en sprong deze greep mee — terwijl er aan die rij niets gebeurde.
  const anchorBefore = (await anchorHandle.boundingBox())!;

  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 4 * dayWidth, box.y + box.height / 2, { steps: 8 });
  await expect(handle).toHaveAttribute('aria-valuenow', '4');

  // TIJDENS het slepen — dit is het moment waarop het misging.
  const anchorDuring = (await anchorHandle.boundingBox())!;
  expect(Math.abs(anchorDuring.x - anchorBefore.x)).toBeLessThan(1);
  expect(Number(await second.getAttribute('data-ops-distribution-day-width'))).toBe(dayWidth);

  await page.mouse.move(box.x + box.width / 2 + 9 * dayWidth, box.y + box.height / 2, { steps: 8 });
  await expect(handle).toHaveAttribute('aria-valuenow', '9');
  await page.mouse.up();

  // En ná het loslaten, wanneer de herberekening binnen is: de dagbreedte ligt vast voor de hele
  // dialoogsessie, dus ook een veel ruimere dagenset verzet geen bestaande x.
  await expect.poll(() => second.getAttribute('data-ops-distribution-day-width')).toBe(String(dayWidth));
  const anchorAfter = (await anchorHandle.boundingBox())!;
  expect(Math.abs(anchorAfter.x - anchorBefore.x)).toBeLessThan(1);
});

// --- Polishronde bevinding 6 — een project dat niet past toont zijn oude boeking -----------------

test('een tekort tekent de VÓÓR-boeking als spookblokjes in plaats van een lege balk', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  // Plafond 0 op de rij die moet wijken: hij mag geen werkdag opschuiven, dus zijn ene taak kan
  // nergens heen. Dat is de echte gebruikersroute naar een tekort — Home op de greep.
  const handle = page.locator('[data-ops-distribution-strip]').nth(1)
    .locator('[data-ops-distribution-handle]');
  await handle.focus();
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');

  // De rij met het tekort is de rij die zijn uitkomstpil rood heeft.
  const shortStrip = page.locator('[data-ops-distribution-strip]')
    .filter({ has: page.locator('[data-ops-distribution-effect-shortfall]') });
  await expect(shortStrip).toHaveCount(1);

  // Geen enkel echt dagblokje — en tóch iets te zien: de spoken van waar dit werk stond.
  await expect(shortStrip.locator('[data-ops-distribution-day="work"]')).toHaveCount(0);
  await expect(shortStrip.locator('[data-ops-distribution-day="unplaced"]').first()).toBeVisible();

  // De rij die wél geplaatst is heeft geen spoken: dit is een tekort-markering, geen achtergrond.
  const okStrip = page.locator('[data-ops-distribution-strip]')
    .filter({ hasNot: page.locator('[data-ops-distribution-effect-shortfall]') });
  await expect(okStrip.locator('[data-ops-distribution-day="unplaced"]')).toHaveCount(0);
});

// --- Fixronde bevinding B9 — de greep houdt de focus na een muisgebaar ---------------------------

test('plafond-handle: na loslaten heeft de greep de focus en werkt een pijltje meteen', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  const handle = strip.locator('[data-ops-distribution-handle]');
  const dayWidth = Number(await strip.getAttribute('data-ops-distribution-day-width'));
  expect(dayWidth).toBeGreaterThan(0);

  // BEWUST GEEN `handle.focus()` VOORAF — dat is precies wat deze test moet aantonen. De greep
  // roept `preventDefault()` aan op `pointerdown` (nodig om tekstselectie tijdens het slepen te
  // voorkomen), en dat onderdrukt óók de focus-stap van de browser. Zonder de eigen `focus()` in
  // de component staat de focus na dit gebaar nog op wat er daarvóór actief was.
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 2 * dayWidth, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();

  // (1) De focus staat op DEZE greep — niet ergens anders in de dialoog.
  await expect.poll(() => page.evaluate(() =>
    document.activeElement?.hasAttribute('data-ops-distribution-handle') ?? false,
  )).toBe(true);
  const focusedDocId = await page.evaluate(() =>
    document.activeElement?.closest('[data-ops-distribution-strip]')?.getAttribute('data-ops-doc-id') ?? null);
  expect(focusedDocId).toBe(await strip.getAttribute('data-ops-doc-id'));

  // (2) En een pijltje werkt meteen, zónder eerst ergens te klikken of te tabben: de toets gaat
  // naar `document.activeElement`, dus dit kan alleen slagen als de greep de focus echt heeft.
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', String(before + 1));
});

// --- B1c-plan3 taak 11b — de voor/na-grafiek (spec §7) ---------------------------------------------

test('voor/na-preview: de na-stand blijft binnen de capaciteitslijn', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);

  await expect(page.locator('[data-ops-distribution-chart-before]')).toBeVisible();
  await expect(page.locator('[data-ops-distribution-chart-after]')).toBeVisible();
  // De conflictdagen staan in de VOOR-stand rood en in de NA-stand niet meer.
  await expect(page.locator('[data-ops-distribution-chart-before] [data-ops-conflict-day]')).not.toHaveCount(0);
  await expect(page.locator('[data-ops-distribution-chart-after] [data-ops-conflict-day]')).toHaveCount(0);

  // Fixronde-2 bevinding B1: de VOOR-stand is een GESTAPELDE grafiek, dus hij moet allebei de
  // documenten ECHT laten zien. Leende hij de per-document-schaal van de fasestroken, dan klom de
  // eerste staaf naar volle hoogte en zakte de tweede op de zichtbaarheidsbodem van 0,5 px — het
  // conflict werd dan door de schaal weggepoetst. Gemeten in echte px op het scherm, per document.
  const barHeights = await page.locator('[data-ops-distribution-chart-before] rect[data-ops-doc-id]')
    .evaluateAll(nodes => {
      const byDoc = new Map<string, number>();
      for (const node of nodes) {
        const docId = node.getAttribute('data-ops-doc-id') ?? '';
        const height = node.getBoundingClientRect().height;
        byDoc.set(docId, Math.max(byDoc.get(docId) ?? 0, height));
      }
      return [...byDoc.entries()];
    });
  expect(barHeights.length).toBe(2);
  for (const [docId, height] of barHeights) {
    expect(height, `staafhoogte van ${docId}`).toBeGreaterThan(10);
  }

  // En de conflictband wordt NÁ de staven getekend, dus een volle staaf schildert 'm niet dicht:
  // hij heeft een echte, meetbare bounding box.
  const conflictBox = await page.locator('[data-ops-distribution-chart-before] [data-ops-conflict-day]')
    .first().boundingBox();
  expect(conflictBox).not.toBeNull();
  expect(conflictBox!.width).toBeGreaterThan(0);
  expect(conflictBox!.height).toBeGreaterThan(0);
});

// --- B1c-plan3 taak 12 — Toepassen, de terugweg en de voorstel-invalidatie (spec §5/§6a) ---------

/**
 * Het aantal taken MET een nivelleringsvertraging over ALLE geopende documenten — het actieve op
 * top-level, de slapers in hun payload. Bewust niet alleen `state.tasks`: bij twee conflicterende
 * documenten wijkt er precies één, en welke dat is hangt van de float-sortering af. De belofte van
 * Toepassen ("het schrijft over de documentgrens heen") toets je dus op de som, niet op het toevallig
 * actieve tabblad.
 */
function delayedTaskCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    let count = s.tasks.filter(t => t.levelingDelay !== undefined).length;
    for (const document of s.documents) {
      if (document.payload) count += document.payload.tasks.filter(t => t.levelingDelay !== undefined).length;
    }
    return count;
  });
}

/**
 * Eén document dat MEER vraagt dan het poolitem ooit kan leveren (1/dag tegen een capaciteit van
 * 0,5). Geen enkele verschuiving lost dat op — de verdeler levert een geldige preview mét tekort,
 * en juist dat moet Toepassen tegenhouden (spec §4 stap 3).
 */
async function seedUnsolvableShortfall(page: Page): Promise<Library> {
  const [taskA] = await seedProject(page, [{
    name: 'Overvraagd', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Overvraagd project');
  await makeScheduled(page, taskA);
  const library = await createLibrary(page, 0.5);
  await bookOnPoolItem(page, library, taskA, 1);
  return library;
}

test('toepassen: schrijft in beide projecten en biedt daarna "alles terugdraaien"', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const apply = page.getByRole('button', { name: /^(Toepassen|Apply)$/ });
  await expect(apply).toBeEnabled();
  await apply.click();

  // De strook is PERMANENT (spec §5) — anders dan een `info`-melding, die het meldingenkanaal na
  // 5 s opruimt. Vandaar de wachttijd van 6 s: die overleeft die opruiming aantoonbaar.
  await expect(page.locator('[data-ops-distribution-applied]')).toBeVisible();
  await page.waitForTimeout(6000);
  await expect(page.locator('[data-ops-distribution-applied]')).toBeVisible();
  await expect.poll(() => delayedTaskCount(page)).toBeGreaterThan(0);

  // §6a: de documenten zijn nu gemuteerd, dus het voorstel op het scherm hoort er niet meer bij en
  // Toepassen gaat op slot tot "Herbereken".
  await expect(page.locator('[data-ops-distribution-stale]')).toContainText(/niet meer actueel|no longer/i);
  await expect(apply).toBeDisabled();

  await page.getByRole('button', { name: /Alles terugdraaien|Undo all/ }).click();
  await expect.poll(() => delayedTaskCount(page)).toBe(0);
  await expect(page.locator('[data-ops-distribution-applied]')).toHaveCount(0);
});

test('een tekort kleurt de validatiestrook rood en houdt Toepassen tegen', async ({ page, ops: _ops }) => {
  await seedUnsolvableShortfall(page);
  await openDistributionFromConflictRow(page);

  // Het tekortblok is weg (spec §3.5): het tekort staat nu BIJ NAAM in de validatiestrook, en de
  // einddatum-badge van het getroffen document draagt dezelfde markering — een lege balk zonder
  // uitleg was de klacht uit de gebruikstest.
  const status = page.locator('[data-ops-distribution-status]');
  await expect(status).toContainText(/tekort|short/i);
  await expect(page.locator('[data-ops-distribution-end-badges] [data-ops-distribution-badge-shortfall]'))
    .not.toHaveCount(0);
  await expect(page.locator('[data-ops-distribution-preview-shortfall]')).toBeVisible();

  await expect(page.getByRole('button', { name: /^(Toepassen|Apply)$/ })).toBeDisabled();
  await expect(page.locator('[data-ops-distribution-apply-reason]')).toContainText(/tekort|shortfall/i);
});

test('de validatiestrook staat er altijd en meldt de uitkomst of het tekort', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);

  // Spec §3.5/§7: ALTIJD gerenderd, ook wanneer alles goed is — en dan groen met de grootste
  // einddatum-verschuiving erin.
  const status = page.locator('[data-ops-distribution-status]');
  await expect(status).toBeVisible();
  await expect(status).toContainText(/Conflict opgelost|Conflict resolved/i);

  // Alle deelnemers vastzetten ⇒ er valt niets te herverdelen, en de strook zegt dat met een uitweg.
  for (const pin of await page.locator('[data-ops-distribution-pin]').all()) await pin.click();
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect(status).toContainText(/staan vast|is pinned/i);
});

test('Reset zet plafonds en vastzettingen terug, en laat de schakelaar staan', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);

  await page.getByRole('switch', { name: /Onderbrekingen toestaan|Allow interruptions/ }).click();
  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  await strip.locator('[data-ops-distribution-handle]').focus();
  await strip.locator('[data-ops-distribution-handle]').press('ArrowRight');
  await page.locator('[data-ops-distribution-pin]').first().click();
  await expect.poll(() => page.evaluate(() => {
    const ui = window.__OPS__!.store.getState().ui.levelingDistribution!;
    return Object.keys(ui.ceilings).length + Object.values(ui.pinned).filter(Boolean).length;
  })).toBeGreaterThan(1);

  await page.locator('[data-ops-distribution-reset]').click();

  // Spec §3.6: alle plafonds en pins terug, de SCHAKELAAR ongemoeid.
  await expect.poll(() => page.evaluate(() => {
    const ui = window.__OPS__!.store.getState().ui.levelingDistribution!;
    return {
      ceilings: Object.values(ui.ceilings).filter(v => v !== null).length,
      pins: Object.values(ui.pinned).filter(Boolean).length,
      splits: ui.allowSplits,
    };
  })).toEqual({ ceilings: 0, pins: 0, splits: true });
});

test('de dialoog flitst niet: dezelfde boundingBox over een herberekening en een sleep', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const dialog = page.locator('[data-ops-distribution-dialog]');
  const before = (await dialog.boundingBox())!;

  // (1) Een herberekening. De bezig-toestand mag zich alleen via kleur/opaciteit tonen — nooit door
  // een blok toe te voegen of weg te halen (spec §7).
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  const during = (await dialog.boundingBox())!;
  await expect(page.locator('[data-ops-distribution-status]')).toBeVisible();
  const after = (await dialog.boundingBox())!;

  // (2) Een sleep plus het loslaten — het loslaten is sinds 2026-09-14 het enige rekenmoment van
  // een muisgebaar, dus `dragging` toetst de stille sleep en `released` de run die erop volgt.
  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  const handle = strip.locator('[data-ops-distribution-handle]');
  const dayWidth = Number(await strip.getAttribute('data-ops-distribution-day-width'));
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 4 * dayWidth, box.y + box.height / 2, { steps: 8 });
  const dragging = (await dialog.boundingBox())!;
  await page.mouse.up();
  const released = (await dialog.boundingBox())!;

  for (const [name, box2] of [['tijdens', during], ['erna', after], ['slepend', dragging], ['losgelaten', released]] as const) {
    expect(box2.x, `x ${name}`).toBeCloseTo(before.x, 0);
    expect(box2.y, `y ${name}`).toBeCloseTo(before.y, 0);
    expect(box2.width, `breedte ${name}`).toBeCloseTo(before.width, 0);
    expect(box2.height, `hoogte ${name}`).toBeCloseTo(before.height, 0);
  }
});

test('het voorstel vervalt met reden zodra er in een betrokken document gewerkt wordt', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);
  await expect(page.locator('[data-ops-distribution-stale]')).toHaveCount(0);

  // WAAROM HIER GEEN ECHTE GEBRUIKERSHANDELING STAAT. De verdeeldialoog is modaal met een
  // focus-trap: het lint en de tabel zijn onbereikbaar zolang hij open staat, dus een bewerking ín
  // een betrokken document kán tijdens dit scenario alleen van BUITEN komen — auto-save-herstel,
  // een MCP-tool of een extensie. De store-route is daarmee geen vervanging van een klik maar de
  // enige realistische bron van precies deze gebeurtenis.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks[0];
    s.updateTask(task.id, { time: { ...task.time, scheduleDuration: 4 } });
  });

  await expect(page.locator('[data-ops-distribution-stale]')).toContainText(/niet meer actueel|no longer/i);
  await expect(page.getByRole('button', { name: /^(Toepassen|Apply)$/ })).toBeDisabled();

  // "Herbereken" is het discrete rekenmoment dat de reden opruimt (§3.4).
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect(page.locator('[data-ops-distribution-stale]')).toHaveCount(0);
});

// --- B1c-plan4 taak 6 — het VERSCHIL-prijskaartje bij de gereedschapsschakelaar (spec §2.2) ------

test('het prijskaartje is één VERSCHIL en volgt de stand van de schakelaar', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  // Eigenaarsbesluit 2026-09-12 (spec §2.2): geen twee bedragen naast elkaar meer, maar één
  // verschil. Schakelaar UIT ⇒ een belofte ("zou … besparen"); AAN ⇒ een constatering ("bespaart
  // …"). Nul is expliciet, niet leeg.
  const price = page.locator('[data-ops-distribution-tool-price]');
  await expect.poll(() => price.textContent())
    .toMatch(/zou .*besparen|would save|zou niets besparen|would save nothing/i);

  await page.getByRole('switch', { name: /Onderbrekingen toestaan|Allow interruptions/ }).click();
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect.poll(() => price.textContent())
    .toMatch(/^(?!.*zou)(?=.*(bespaart|saves))/i);

  // Een externe bewerking laat het voorstel vervallen (§6a); een prijs bij een vervallen voorstel
  // zou liegen, dus die gaat terug naar "prijs onbekend".
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks[0];
    s.updateTask(task.id, { time: { ...task.time, scheduleDuration: 4 } });
  });
  await expect(price).toContainText(/prijs onbekend|price unknown/i);
});

/**
 * Eén document met MEER dan `MAX_TASKS_AUTO` (1000) taken: één echte conflicttaak plus 1050 kale,
 * ongerelateerde taken zonder toewijzing. De kale taken duwen alleen de teller over de grens — ze
 * dragen geen vraag op het poolitem, dus de CPM-solve en de nivelleerpass blijven goedkoop en de
 * test ruim binnen de Playwright-timeout.
 */
async function seedLargeDegradedProject(page: Page): Promise<Library> {
  const [taskA] = await seedProject(page, [{
    name: 'Groot project taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Groot project');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    for (let i = 0; i < 1050; i++) s.addTask({ name: `Kale taak ${i}`, manuallyScheduled: true });
  });
  const library = await createLibrary(page, 1);
  await bookOnPoolItem(page, library, taskA, 1);

  await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  const [taskB] = await seedProject(page, [{
    name: 'Klein project taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Klein project');
  await bookOnPoolItem(page, library, taskB, 1);
  return library;
}

/**
 * ZEVEN kleine documenten, elk met één eendaagse taak op hetzelfde poolitem (fixronde-2 bevinding
 * B6). Geen enkel document komt ook maar in de buurt van `MAX_TASKS_AUTO` of
 * `MAX_BOOKING_TASKS_AUTO` — het is het AANTAL documenten dat de kost opdrijft: `computeDistribution`
 * draait per deelnemer een volledige solve, en de labelpas doet dat nog een keer per deelnemer.
 */
async function seedManySmallDocuments(page: Page, count: number): Promise<Library> {
  const [firstTask] = await seedProject(page, [{
    name: 'Project 1 taak', start: '2026-09-07', finish: '2026-09-07', durationDays: 1,
  }], 'Project 1');
  const library = await createLibrary(page, 1);
  await bookOnPoolItem(page, library, firstTask, 1);

  for (let i = 2; i <= count; i++) {
    await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
    const [task] = await seedProject(page, [{
      name: `Project ${i} taak`, start: '2026-09-07', finish: '2026-09-07', durationDays: 1,
    }], `Project ${i}`);
    await bookOnPoolItem(page, library, task, 1);
  }
  return library;
}

test('boven het documentenplafond rekent de dialoog alleen op de knop', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000);
  // Zeven documenten: één meer dan `MAX_DOCS_AUTO` (6). Elk document is minuscuul, dus alleen de
  // documenttelling in de degradatiepoort kan dit vangen — precies wat er ontbrak (bevinding B6).
  await seedManySmallDocuments(page, 7);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(7);

  await expect(page.locator('[data-ops-distribution-degraded]')).toBeVisible();
  // Gedegradeerd ⇒ geen verschil-pas, dus geen prijs maar de expliciete route.
  await expect(page.locator('[data-ops-distribution-tool-price]')).toContainText(/prijs onbekend|price unknown/i);
});

test('boven de ondersteunde schaal rekent de dialoog alleen op de knop', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000);
  const start = Date.now();
  await seedLargeDegradedProject(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  await expect(page.locator('[data-ops-distribution-degraded]')).toBeVisible();
  // Boven de schaal is de verschil-pas zelf een volledige extra run — dat is precies de kost die de
  // degradatie voorkomt, dus er wordt niet automatisch gerekend: "prijs onbekend" i.p.v. een getal.
  await expect(page.locator('[data-ops-distribution-tool-price]')).toContainText(/prijs onbekend|price unknown/i);

  const handle = page.locator('[data-ops-distribution-strip]').first().locator('[data-ops-distribution-handle]');
  await handle.focus();
  await handle.press('ArrowRight');
  // Boven de schaal rekent een plafondwijziging NIET door (spec §5): de reden staat in de
  // validatiestrook, met de expliciete route erbij.
  await expect(page.locator('[data-ops-distribution-status]')).toContainText(/Herbereken|Recalculate/);

  console.log(`seedLargeDegradedProject-test duur: ${Date.now() - start}ms`);
});

test('van document wisselen sluit de dialoog', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);
  const documentIds = await page.evaluate(
    () => window.__OPS__!.store.getState().documents.map(d => d.id));
  const activeBefore = await page.evaluate(
    () => window.__OPS__!.store.getState().activeDocumentId);

  // (1) DE SNELTOETS DOET NIETS ZOLANG DEZE DIALOOG OPENSTAAT — dat is sinds issue #27/E4 de
  // belofte, niet een gemiste route. `nav.switchDocument1..9` draagt daar een
  // `when: () => !hasBlockingDialogOpen()`, en `ui.showDistributionDialog` staat in die lijst: een
  // modale dialoog hoort modaal te zijn. Vóór #27 wisselde Ctrl+1 gewoon door en ving
  // `resetDocumentScopedUI` de scherven op; die volgorde is nu omgedraaid.
  await page.keyboard.press('Control+1');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId)).toBe(activeBefore);
  await expect(page.locator('[data-ops-distribution-dialog]')).toBeVisible();

  // (2) DE NIET-TOETSENBORDROUTE. `switchDocument` is óók bereikbaar buiten de sneltoets om — via
  // de store zelf, via een MCP-tool en via het sluiten van een document — en die paden komen niet
  // langs `hasBlockingDialogOpen`. Daar is `resetDocumentScopedUI` het vangnet, en dát is wat deze
  // helft toetst: een echte klik bestaat er niet voor, dus dit gaat bewust via de brug.
  const other = documentIds.find(id => id !== activeBefore)!;
  await page.evaluate(id => window.__OPS__!.store.getState().switchDocument(id), other);

  await expect(page.locator('[data-ops-distribution-dialog]')).toHaveCount(0);
  // §6a/besluit eigenaar: de DIALOOG gaat dicht — het voorstel op het scherm hoorde bij een
  // momentopname die niet meer geldt. De TUNE-STATE blijft juist staan (fixronde B1c-etappe-3,
  // bevinding B3): daarin zit `applied`, het record achter "Alles terugdraaien", en een verdeling
  // over meerdere documenten beoordeel je nu juist dóór ernaartoe te wisselen.
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.levelingDistribution !== null)).toBe(true);
  // Het bezettingsoverzicht blijft gewoon staan; de gebruiker opent opnieuw op de conflictregel.
  await expect(page.locator('[data-ops-occupancy-view]')).toBeVisible();
});

// --- Gebruikstest eigenaar 2026-09-14 — de vaste kolommen blijven in beeld -----------------------

test('een opgerekt plafond schuift de label- en uitkomstkolom niet uit de dialoog', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  const handle = strip.locator('[data-ops-distribution-handle]');
  const dayWidth = Number(await strip.getAttribute('data-ops-distribution-day-width'));
  expect(dayWidth).toBeGreaterThan(0);

  // Home eerst: het plafond staat standaard op ONBEGRENSD, en dan zit de greep al tegen de
  // rechterrand van de as — er is dan nauwelijks sleepruimte over binnen het venster. Vanaf
  // plafond 0 staat hij bij het fase-einde en levert één sleep naar de vensterrand tientallen
  // werkdagen op. Zelfde deterministische startpunt als de sleeptests hierboven.
  await handle.focus();
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(() => strip.locator('[data-ops-distribution-effect]').textContent())
    .not.toContain('…');

  // Een ECHTE sleep, zo ver naar rechts als het venster toelaat: de dagenset groeit mee met het
  // plafond, dus de tijdas wordt hierdoor een veelvoud breder dan de dialoog zelf. Dat is precies
  // de stand waarin de eigenaar "eind +5 dage" en "max onbegrensd · benu" afgekapt zag.
  const viewport = page.viewportSize()!;
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width - 8, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  // De as is echt buiten de dialoog gegroeid — zonder die overloop bewijst deze test niets.
  const scroller = page.locator('[data-ops-distribution-scroller]');
  await expect.poll(() => scroller.evaluate(el => el.scrollWidth - el.clientWidth))
    .toBeGreaterThan(100);

  const dialogBox = (await page.locator('[data-ops-distribution-dialog]').boundingBox())!;
  const within = async (selector: string) => {
    const cells = page.locator(selector);
    await expect(cells).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const cell = (await cells.nth(i).boundingBox())!;
      expect(cell.width).toBeGreaterThan(0);
      expect(cell.x).toBeGreaterThanOrEqual(dialogBox.x - 1);
      expect(cell.x + cell.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width + 1);
    }
  };

  // (1) Op de niet-gescrolde stand: de uitkomstkolom is aan de rechterrand vastgezet en staat dus
  // niet meer achter de as aan, ver buiten het paneel.
  await within('[data-ops-distribution-effect]');
  await within('[data-ops-distribution-label]');

  // (2) En met de as helemaal naar rechts gescrold blijven beide kolommen staan — dat is wat
  // "bevroren" betekent, en het is de enige manier om de projectnaam bij de uitkomst te houden.
  await scroller.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await within('[data-ops-distribution-effect]');
  await within('[data-ops-distribution-label]');
  await expect(page.locator('[data-ops-distribution-label]').first()).toContainText(/Eendaags project/);
});

// --- De begrippenlijst (eigenaarsvraag 2026-09-14: "wat betekent 'taken passen niet'?") ----------

test('begrippenlijst: uitklappen toont de uitleg, inklappen geeft de dialoog zijn maat terug', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const dialog = page.locator('[data-ops-distribution-dialog]');
  const toggle = page.locator('[data-ops-distribution-glossary-toggle]');
  const glossary = page.locator('[data-ops-distribution-glossary]');

  // Ingeklapt bij het openen: de dialoog is bediening, geen naslagwerk.
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(glossary).toHaveCount(0);
  const closedBox = (await dialog.boundingBox())!;

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(glossary).toBeVisible();
  // Alle niet-vanzelfsprekende termen van deze dialoog staan erin; minder dan acht betekent dat er
  // een term uit de lijst gevallen is.
  expect(await glossary.locator('dt').count()).toBeGreaterThanOrEqual(8);
  await expect(glossary).toContainText(/past niet|does not fit/i);

  // Uitklappen mag de hoogte veranderen — het is een gebruikershandeling, geen REKENtoestand.
  // Maar inklappen moet de dialoog exact op zijn oude maat terugzetten (spec §7).
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(glossary).toHaveCount(0);
  const reclosedBox = (await dialog.boundingBox())!;
  expect(reclosedBox.x).toBeCloseTo(closedBox.x, 0);
  expect(reclosedBox.y).toBeCloseTo(closedBox.y, 0);
  expect(reclosedBox.width).toBeCloseTo(closedBox.width, 0);
  expect(reclosedBox.height).toBeCloseTo(closedBox.height, 0);
});
