// Het nieuwe Rapport-tabblad achter de feature flag `reportRedesign` (issue #817). Eén werkroute van een
// planner: tabblad openen, op het papier klikken om een stap te openen, een kolom toevoegen, Herstel standaard
// en ongedaan maken, de zijbalk inklappen, een zwevend venster verslepen, erin typen en via de zwevende knop
// exporteren. De flag en een verouderde planning zijn fixtures (via de store), de rest zijn echte klikken en toetsen.
// Het venster is 1280×720: de kleinste maat waarop melding, "Kolom toevoegen" en de stapkop in beeld moeten blijven.
import { expect, seedProject, test } from './fixtures/ops';

test('rapport-studio: klik op het papier opent de stap, kolom toevoegen, zijbalk inklappen', async ({ page, ops: _ops }) => {
  // Deze route loopt door alle stappen, layouts en een rapportwissel (~20–22 s lokaal); ruimte voor drukte in CI.
  test.slow();
  await seedProject(page, [
    { name: 'Fundering storten', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Wanden metselen', start: '2026-09-21', finish: '2026-10-09', durationDays: 15 },
  ], 'Rapportstudio');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ featureFlags: { ...s.ui.featureFlags, reportRedesign: true } });
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const studio = page.locator('[data-rs-studio]');
  await expect(studio).toBeVisible();
  // Met de flag heeft het tabblad geen lintinhoud: alleen de tabnamen blijven staan.
  await expect(page.locator('.ribbon-content')).toHaveCount(0);
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();

  // Eerste bezoek: stap 1 staat open, met boven het eerste blad de aanwijzing dat het papier klikbaar is.
  await expect(page.locator('[data-rs-step-body="tasks"]')).toBeVisible();
  await expect(page.locator('[data-rs-paper-hint]')).toBeVisible();

  // Bewegen over de kop: de naam staat boven het blad en dekt het blad niet af.
  const sheet = page.locator('[data-preview-page="0"]');
  const sheetBox = (await sheet.boundingBox())!;
  await page.mouse.move(sheetBox.x + sheetBox.width * 0.3, sheetBox.y + sheetBox.height * 0.04);
  const label = page.locator('[data-rs-region-label]');
  await expect(label).toBeVisible();
  expect((await label.boundingBox())!.y + (await label.boundingBox())!.height).toBeLessThanOrEqual(sheetBox.y + 1);

  // Klik op de kolomkop "Start" op het papier: de stap Kolommen opent en de rij Start krijgt focus.
  await expect(page.locator('[data-rs-step-body="columns"]')).toHaveCount(0);
  await page0.locator('text', { hasText: /^Start$/ }).first().click();
  await expect(page.locator('[data-rs-paper-hint]')).toHaveCount(0);
  await expect(page.locator('[data-rs-step-body="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-column="task.time.start"]')).toBeFocused();

  // Klik op de tijdlijn: de stap Balken en tijdlijn opent.
  await page0.locator('text', { hasText: /^(August|Augustus|October|Oktober) 2026$/ }).first().click();
  await expect(page.locator('[data-rs-step-body="bars"]')).toBeVisible();

  // Statusdatumlijn zonder statusdatum: de melding verschijnt onder de keuze en komt helemaal in beeld; de
  // stapkop met Herstel standaard blijft zichtbaar (de voetbalk is weg, check Ethan 9-11-2026). De keuze staat vooraf precies onderaan het scrollvak, zodat de klik niet
  // scrolt en alleen de app de melding in beeld kan brengen.
  await page.locator('[data-rs-step-body="bars"]').evaluate(el => {
    const seg = el.querySelector('[data-rs-segmented="statusLine"]')!;
    el.scrollTop += seg.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom + 1;
  });
  await page.locator('[data-rs-segmented="statusLine"] [data-rs-value="statusDate"]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-status-today]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-step="bars"] [data-rs-reset="bars"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-step-foot]')).toHaveCount(0);
  // "Op vandaag zetten" rekent meteen door, zoals "Nu doorrekenen": er komt geen balk "niet doorgerekend".
  await page.locator('[data-rs-status-today]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return !!s.project.statusDate && !s.scheduleStale;
  })).toBe(true);
  await expect(page.locator('[data-rs-banner="stale"]')).toHaveCount(0);
  await page.locator('[data-rs-segmented="statusLine"] [data-rs-value="none"]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toHaveCount(0);

  // Planning gewijzigd zonder doorrekenen: een balk boven het papier, "Nu doorrekenen" werkt het papier bij.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.name === 'Wanden metselen')!;
    s.updateTask(t.id, { time: { ...t.time, scheduleStart: '2026-09-28T08:00' } });
  });
  const stale = page.locator('[data-rs-banner="stale"]');
  await expect(stale).toBeVisible();
  await page.locator('[data-rs-recalculate]').click();
  await expect(stale).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

  // Kolom Kalenderdagen toevoegen met het kolomvenster van de tabel (check Ethan 9-11-2026: dezelfde dialoog
  // als in het tabblad Tabel): zoeken en klikken. De headless browser draait in het Engels; de kop volgt de
  // taal van de app.
  const calendarDays = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl') ? 'Kalenderdagen' : 'Calendar days';
  const chooser = page.getByRole('dialog', { name: /^(Choose column|Kolom kiezen)$/ });
  const addColumn = async (label: string) => {
    await page.locator('[data-rs-add-column]').click();
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole('searchbox')).toBeFocused();
    await page.keyboard.type(label);
    // Het laatste treffer is de zoeklijst (daarboven kan "Laatst gebruikt" dezelfde kolom tonen).
    await chooser.getByRole('menuitemcheckbox', { name: new RegExp(`^${label}$`) }).last().click();
  };
  await page.locator('[data-rs-step-head="columns"]').click();
  // De verplichte taaknaam: zijn kruisje staat uit, met de uitleg als tooltip; een klik doet niets.
  const requiredX = page.locator('[data-rs-column="task.name"] [data-rs-required-slot]');
  await expect(requiredX).toHaveAttribute('aria-disabled', 'true');
  await expect(requiredX).toHaveAttribute('title', /(task name|taaknaam)/i);
  await expect(requiredX.locator('svg')).toBeAttached();
  const columnCount = await page.locator('[data-rs-column]').count();
  await page.locator('[data-rs-column="task.name"]').hover();
  // `force`: Playwright klikt zelf niet op een knop met `aria-disabled`; juist die klik mag niets doen.
  await requiredX.click({ force: true });
  await expect(page.locator('[data-rs-column]')).toHaveCount(columnCount);
  await expect(page.locator('[data-rs-column="task.name"]')).toBeVisible();
  await addColumn(calendarDays);
  await expect(page.locator('[data-rs-column="task.time.calendarDays"]')).toBeVisible();
  // Na de keuze is het venster dicht en staat de focus op "Kolom toevoegen", klaar voor de volgende.
  await expect(chooser).toHaveCount(0);
  await expect(page.locator('[data-rs-add-column]')).toBeFocused();
  await expect(page0.locator('text', { hasText: new RegExp(`^${calendarDays}$`) }).first()).toBeAttached();
  // Bewaard per apparaat, in de volgorde van de lijst.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').columns))
    .toEqual(['task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.start', 'task.time.finish', 'task.time.completion', 'task.time.calendarDays']);
  // Alt+pijl omhoog verplaatst de kolom een plek.
  await page.locator('[data-rs-column="task.time.calendarDays"]').focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').columns.at(-1)))
    .toBe('task.time.completion');

  // Kolommen overnemen: het tabblad Tabel en de tabel naast de Gantt hebben elk een eigen indeling (check
  // Ethan 9-11-2026: "die zijn verschillend"). Elke knop heeft zijn eigen Ongedaan maken.
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'));
  const surfaceIds = (id: 'full-task-grid' | 'gantt-task-grid') => page.evaluate(
    surface => window.__OPS__!.store.getState().taskGridSurfaces[surface].columns.map(column => String(column.id)), id);
  const tableIds = await surfaceIds('full-task-grid');
  const ganttIds = await surfaceIds('gantt-task-grid');
  expect(tableIds).not.toEqual(ganttIds);
  const ownColumns = (await saved()).columns;
  await page.locator('[data-rs-like-grid="table"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(tableIds);
  await expect(page.locator('[data-rs-undo]')).toContainText(/(Table tab|tabblad Tabel)/);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownColumns);
  await page.locator('[data-rs-like-grid="gantt"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ganttIds);
  await expect(page.locator('[data-rs-undo]')).toContainText(/(next to the Gantt|naast de Gantt)/);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownColumns);

  // Zoals de weergave drukt ook de kolommen van de tabel naast de Gantt af, live; de stap Kolommen toont ze
  // alleen. De eigen kolommen blijven bewaard en komen terug bij Alle taken (Ethan, 10-11-2026, keuze 1).
  const listedColumns = () => page.locator('[data-rs-columns] [data-rs-column]').evaluateAll(
    rows => rows.map(row => row.getAttribute('data-rs-column')));
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="view"]').click();
  await page.locator('[data-rs-step-head="columns"]').click();
  await expect(page.locator('[data-rs-notice="columns-follow-view"]')).toBeVisible();
  await expect.poll(listedColumns).toEqual(ganttIds);
  await expect(page.locator('[data-rs-add-column]')).toHaveCount(0);
  await expect(page.locator('[data-rs-like-grid]')).toHaveCount(0);
  await expect(page.locator('[data-rs-grip]')).toHaveCount(0);
  await expect(page.locator('[data-rs-remove]')).toHaveCount(0);
  // Delete en Alt+pijl op een rij veranderen niets.
  await page.locator(`[data-rs-column="${ganttIds[ganttIds.length - 1]}"]`).focus();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(listedColumns).toEqual(ganttIds);
  expect((await saved()).columns).toEqual(ownColumns);
  // De tabel naast de Gantt verandert (fixture): het rapport volgt live, ook op het papier.
  const ganttPrefs = await page.evaluate(() => window.__OPS__!.store.getState().taskGridSurfaces['gantt-task-grid'].columns);
  const fewer = ganttIds.filter(id => id !== 'task.time.scheduleDuration');
  expect(fewer).toHaveLength(ganttIds.length - 1);
  await page.evaluate(ids => {
    const state = window.__OPS__!.store.getState();
    state.setTaskGridColumns('gantt-task-grid', state.taskGridSurfaces['gantt-task-grid'].columns.filter(c => ids.includes(String(c.id))));
  }, fewer);
  await expect.poll(listedColumns).toEqual(fewer);
  // Ook het papier: de samenvatting van de dichte stap telt de kolommen op het papier.
  await page.locator('[data-rs-step-head="tasks"]').click();
  await expect(page.locator('[data-rs-summary="columns"]')).toContainText(String(fewer.length));
  await page.evaluate(prefs => window.__OPS__!.store.getState().setTaskGridColumns('gantt-task-grid', prefs), ganttPrefs);
  // Terug naar Alle taken: de eigen kolommen staan er weer, en je kunt ze weer aanpassen.
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await page.locator('[data-rs-step-head="columns"]').click();
  await expect.poll(listedColumns).toEqual(ownColumns);
  await expect(page.locator('[data-rs-notice="columns-follow-view"]')).toHaveCount(0);
  await expect(page.locator('[data-rs-add-column]')).toBeVisible();

  // Herstel standaard in de kop van Kolommen, daarna A2 in Pagina, dan ongedaan maken: de kolommen komen
  // terug, A2 blijft.
  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await page.locator('[data-rs-step-head="page"]').click();
  await page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A2"]').click();
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns.length).toBe(7);
  expect((await saved()).paperSize).toBe('A2');

  // Zijbalk inklappen: de stapknoppen blijven, exporteren gaat via de zwevende knop linksonder. Het blad
  // wordt daarbij niet kleiner (Hele blad).
  const zoomPct = async () => Number((await page.locator('[data-rs-zoom="value"]').innerText()).replace(/\D/g, ''));
  await page.locator('[data-rs-zoom="page"]').click();
  const openZoom = await zoomPct();
  // Inklappen en uitklappen hebben elk hun eigen icoon (check Ethan 9-11-2026).
  const toggleIcon = () => page.locator('[data-rs-sidebar-toggle] svg').getAttribute('class');
  const collapseIcon = await toggleIcon();
  await page.locator('[data-rs-sidebar-toggle="collapse"]').click();
  await expect(page.locator('[data-rs-sidebar-toggle="expand"]')).toBeVisible();
  expect(await toggleIcon()).not.toBe(collapseIcon);
  await expect(page.locator('[data-rs-rail-step="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-export]')).toHaveCount(0);
  const fab = page.locator('[data-rs-fab-export]');
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAccessibleName(/^(PDF exporteren|Export PDF)$/);
  await expect.poll(zoomPct).toBeGreaterThanOrEqual(openZoom);
  // Bij Breedte en ingezoomd ligt de knop nooit over een blad, ook na scrollen.
  const fabCoversSheet = () => page.evaluate(() => {
    const f = document.querySelector('[data-rs-fab-export]')!.getBoundingClientRect();
    const v = document.querySelector('[data-rs-viewport]')!.getBoundingClientRect();
    return [...document.querySelectorAll('.rs-page')].some(p => {
      const b = p.getBoundingClientRect();
      const top = Math.max(b.top, v.top), bottom = Math.min(b.bottom, v.bottom), left = Math.max(b.left, v.left), right = Math.min(b.right, v.right);
      return right > f.left && left < f.right && bottom > f.top && top < f.bottom;
    });
  });
  await page.locator('[data-rs-zoom="width"]').click();
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-viewport]').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-zoom="in"]').click();
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-zoom="page"]').click();
  // Ingeklapt opent een klik op het papier dezelfde stap als klein venster.
  await page0.locator('text', { hasText: /^Start$/ }).first().click();
  await expect(page.locator('[data-rs-popover="columns"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rs-popover]')).toHaveCount(0);
  // Via de stapknop: de focus staat op het eerste bedienelement van de stap, niet op "In de zijbalk".
  await page.locator('[data-rs-rail-step="columns"]').click();
  const popover = page.locator('[data-rs-popover="columns"]');
  await expect(popover.locator('[data-rs-add-column]')).toBeFocused();
  // Het venster versleep je aan zijn kop (check Ethan 9-11-2026). Het blijft rechts van de rand met de
  // stapknoppen en boven de exportknop, ook als je het naar linksonder trekt.
  const popBefore = (await popover.boundingBox())!;
  const popHead = (await popover.locator('[data-rs-pop-drag]').boundingBox())!;
  await page.mouse.move(popHead.x + 30, popHead.y + popHead.height / 2);
  await page.mouse.down();
  await page.mouse.move(popHead.x + 230, popHead.y + popHead.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await popover.boundingBox())!.x).toBeGreaterThan(popBefore.x + 150);
  const dragged = (await popover.boundingBox())!;
  await page.mouse.move(dragged.x + 30, dragged.y + popHead.height / 2);
  await page.mouse.down();
  await page.mouse.move(0, 719, { steps: 6 });
  await page.mouse.up();
  const railRight = (await page.locator('.rs-sidebar').boundingBox())!;
  const fabBox = (await fab.boundingBox())!;
  await expect.poll(async () => (await popover.boundingBox())!.x).toBeGreaterThanOrEqual(railRight.x + railRight.width);
  const corner = (await popover.boundingBox())!;
  expect(corner.y + corner.height).toBeLessThanOrEqual(fabBox.y);
  await expect(popover).toBeVisible();
  // Herstel standaard in de kop van het zwevende venster, dan Ongedaan maken in de werkbalk: het venster blijft
  // open en de kolommen komen terug. De melding staat in de werkbalk, niet over een blad.
  await expect(popover.locator('.rs-pop-head [data-rs-reset="columns"]')).toBeVisible();
  await page.locator('[data-rs-popover="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-column]')).toHaveCount(6);
  await expect(page.locator('[data-rs-toolbar] [data-rs-undo]')).toBeVisible();
  await page.locator('[data-rs-undo-button]').click();
  await expect(page.locator('[data-rs-popover="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-column]')).toHaveCount(7);
  // Het kolomvenster opent ook vanuit het zwevende venster. Een klik erin (een categorie openen) sluit het
  // zwevende venster niet; beide blijven binnen het scherm.
  await page.locator('[data-rs-popover="columns"] [data-rs-add-column]').click();
  await expect(chooser).toBeVisible();
  await chooser.locator('.task-grid-column-chooser-category').first().click();
  await expect(chooser).toBeVisible();
  await expect(popover).toBeVisible();
  await expect.poll(() => popover.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  })).toBe(true);
  // Escape sluit eerst het kolomvenster, dan het zwevende venster.
  await page.keyboard.press('Escape');
  await expect(chooser).toHaveCount(0);
  await expect(popover).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rs-popover]')).toHaveCount(0);

  // Typen in een zwevend venster: elke toets blijft in het veld (de focus sprong eerder na één letter weg).
  await page.locator('[data-rs-rail-step="headerFooter"]').click();
  const company = page.locator('[data-rs-popover="headerFooter"] #rs-company');
  await company.fill('');
  await company.pressSequentially('abc');
  await expect(company).toHaveValue('abc');
  await expect(company).toBeFocused();
  await page.keyboard.press('Escape');

  const download = page.waitForEvent('download');
  await fab.click();
  expect((await download).suggestedFilename()).toMatch(/^Rapportstudio-.+\.pdf$/);

  // Uitklappen: de knop in de zijbalk is terug, de zwevende knop weg; de knop heeft weer het icoon van inklappen.
  await page.locator('[data-rs-sidebar-toggle="expand"]').click();
  await expect(page.locator('[data-rs-export]')).toBeVisible();
  expect(await toggleIcon()).toBe(collapseIcon);
  await expect(fab).toHaveCount(0);

  // Een andere bron vernieuwt de opgeslagen instellingen: de host die pas na de start antwoordt (#818),
  // of een ander tabblad. Het tabblad volgt, en de volgende klik schrijft de oude kopie niet terug (review
  // Sol #847). Beginstand uit de review: A3 met de zes standaardkolommen; de nieuwe stand is A1 met alleen
  // Taaknaam. De host stuurt precies zo'n `StorageEvent` (`siteHostSettings.ts`).
  const refreshStored = (patch: Record<string, unknown>) => page.evaluate(next => {
    const oldValue = localStorage.getItem('ops-reportSettings');
    const newValue = JSON.stringify({ ...JSON.parse(oldValue ?? '{}'), ...next });
    localStorage.setItem('ops-reportSettings', newValue);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ops-reportSettings', oldValue, newValue, storageArea: localStorage, url: location.href }));
  }, patch);
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await page.locator('[data-rs-step-head="page"]').click();
  await page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A3"]').click();
  await expect.poll(async () => (await saved()).paperSize).toBe('A3');
  await expect(page.locator('[data-rs-undo-button]')).toBeVisible();
  await refreshStored({ paperSize: 'A1', columns: ['task.name'] });
  await expect(page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A1"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page0.locator('text', { hasText: /^Start$/ })).toHaveCount(0);
  // Ongedaan maken zou de zes kolommen over de vernieuwde stand terugzetten: het verdwijnt.
  await expect(page.locator('[data-rs-undo-button]')).toHaveCount(0);
  await page.locator('[data-rs-segmented="orientation"] [data-rs-value="portrait"]').click();
  await expect.poll(async () => (await saved()).orientation).toBe('portrait');
  expect(await saved()).toMatchObject({ paperSize: 'A1', columns: ['task.name'], orientation: 'portrait' });

  // Ook het rapporttype volgt: een ander rapport in de opslag opent het oude paneel voor dat rapport, de
  // Gantt-afdruk weer het nieuwe tabblad. Het oude paneel laat de velden van het nieuwe tabblad staan.
  await refreshStored({ reportType: 'milestones' });
  await expect(studio).toHaveCount(0);
  await refreshStored({ reportType: 'gantt' });
  await expect(studio).toBeVisible();
  await expect(page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A1"]')).toHaveAttribute('aria-checked', 'true');
  expect(await saved()).toMatchObject({ reportType: 'gantt', paperSize: 'A1', columns: ['task.name'], orientation: 'portrait' });

  // Een layout in de stap Taken (#861). Het meegeleverde Resourcediagram maakt de afdruk per resource, zoals
  // het oude rapporttype; het scherm houdt zijn eigen groepering en rijen. De resources zijn een fixture.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const id = (name: string) => s.tasks.find(task => task.name === name)!.id;
    const ploeg = s.addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 1 });
    const kraan = s.addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    s.assignResource(id('Fundering storten'), ploeg, 1);
    s.assignResource(id('Wanden metselen'), ploeg, 1);
    s.assignResource(id('Wanden metselen'), kraan, 1);
    window.__OPS__!.store.getState().runCPM();
  });
  const screen = () => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { filter: s.view.filter, group: s.view.group, sort: s.view.sort, rows: s.viewRows.map(row => row.rowKey) };
  });
  const screenBefore = await screen();
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-layout="builtin:resource-diagram"]').click();
  await expect(page.locator('[data-rs-layout="builtin:resource-diagram"]')).toHaveAttribute('aria-checked', 'true');
  // Twee resources, drie toewijzingen (Wanden metselen staat onder beide), geen taak zonder resource.
  await expect(page.locator('[data-rs-resource-counts]')).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  // Op het papier een band per resource, met het aantal taken: Ploeg A (2) en Kraan (1).
  await expect(page0.locator('text', { hasText: /^Ploeg A \(2\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan \(1\)$/ }).first()).toBeAttached();
  // Een blad per resource: twee bladen.
  const pageBreak = page.locator('[data-rs-switch="pageBreakPerResource"]');
  await pageBreak.click();
  await expect(pageBreak.locator('input')).toBeChecked();
  await expect(page.locator('[data-preview-page]')).toHaveCount(2);
  await pageBreak.click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(1);
  // Relatielijnen staan uit, met uitleg in Balken; de keuze voor een gewone afdruk blijft bewaard.
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(page.locator('[data-rs-relations-off]')).toBeVisible();
  await expect(page.locator('[data-rs-option="showDeps"]')).toBeDisabled();
  await expect(page.locator('[data-rs-option="showDeps"]')).not.toBeChecked();
  await expect.poll(async () => (await saved()).reportType).toBe('resourceGantt');
  expect(await screen()).toEqual(screenBefore);
  // Een beperkte periode, dan via Rapporttype een ander rapport en terug (review Sol #847, ronde 4): de layout
  // Resourcediagram, zijn banden en zijn periode blijven staan. Eerst kwam de terugweg op Alle taken uit, zonder
  // banden en zonder periode. Alleen met een periode noemen de tellingen ook "Buiten de periode".
  expect(await saved()).toMatchObject({ reportType: 'resourceGantt', layoutId: 'builtin:resource-diagram' });
  const rdChoice = page.locator('[data-rs-layout="builtin:resource-diagram"]');
  const resourceCounts = page.locator('[data-rs-resource-counts]');
  const periodPicker = page.getByLabel(/^(Reporting period|Rapportageperiode)$/);
  const reportTypePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  const toOtherReportAndBack = async () => {
    await reportTypePicker.click();
    // De andere rapporten staan met hun eigen naam, zonder "Ander rapport:" ervoor (check Ethan 9-11-2026).
    await expect(page.getByRole('option', { name: /^(Other report|Ander rapport)/ })).toHaveCount(0);
    await page.getByRole('option', { name: /^(Milestone overview|Mijlpalen-overzicht)$/ }).click();
    await expect(studio).toHaveCount(0);
    await reportTypePicker.click();
    await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
    await expect(studio).toBeVisible();
  };
  // De periode loopt tot en met 18 september: alleen Fundering storten (Ploeg A) valt erin, Wanden metselen niet.
  await page.locator('[data-rs-step-head="tasks"]').click();
  await periodPicker.click();
  await page.getByRole('option', { name: /^(Custom|Aangepast)$/ }).click();
  const periodTo = page.locator('[data-ops-report-period="resourceGanttPeriod"]').getByRole('group', { name: /^(To|Tot)$/ }).getByRole('textbox');
  await periodTo.nth(0).fill('18');
  await periodTo.nth(1).fill('09');
  await periodTo.nth(2).fill('2026');
  await page.keyboard.press('Enter');
  const inPeriod = /:\s*1\D+:\s*1\D+:\s*0\D+:\s*\d+$/;
  await expect(resourceCounts).toHaveText(inPeriod);
  await expect(page0.locator('text', { hasText: /^Ploeg A \(1\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan/ })).toHaveCount(0);
  const countsInPeriod = (await resourceCounts.textContent()) ?? '';
  await toOtherReportAndBack();
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await expect(resourceCounts).toHaveText(countsInPeriod);
  await expect(periodPicker).toHaveAttribute('data-value', 'custom');
  await expect(page0.locator('text', { hasText: /^Ploeg A \(1\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan/ })).toHaveCount(0);
  expect(await saved()).toMatchObject({
    reportType: 'gantt', layoutId: 'builtin:resource-diagram', resourceGantt: { period: { preset: 'custom', to: '2026-09-18' } },
  });
  await periodPicker.click();
  await page.getByRole('option', { name: /^(Project duration|Hele project)$/ }).click();
  await expect(resourceCounts).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  // Een oude opslag kent het Resourcediagram alleen als rapporttype: die opent als de layout, en ook die keuze
  // overleeft een uitstap naar een ander rapport.
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');
  await refreshStored({ reportType: 'resourceGantt', layoutId: '' });
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await toOtherReportAndBack();
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await expect(resourceCounts).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  await page.locator('[data-rs-step-head="bars"]').click();
  // Eenh./d en Curve staan op het papier achter de taaknaam (Per resource). De samenvatting van Kolommen telt
  // ze mee; het label boven het blad heet zoals de kop, en een klik gaat naar de schakelaar die ze aan- en
  // uitzet (fixronde na council ronde 5: het label was "Kolommen · units" en de klik opende Kolommen).
  await expect(page.locator('[data-rs-summary="columns"]')).toHaveText(/^3\D.*(Units\/d|Eenh\.\/d).*Curve/);
  const unitsHead = page0.locator('text', { hasText: /^(Units\/d|Eenh\.\/d)$/ }).first();
  await unitsHead.hover();
  await expect(page.locator('[data-rs-region-label]')).toHaveText(/^(Columns|Kolommen) · (Units\/d|Eenh\.\/d)$/);
  await unitsHead.click();
  await expect(page.locator('[data-rs-step-body="tasks"]')).toBeVisible();
  await expect(page.locator('[data-rs-option="showAssignmentColumns"]')).toBeFocused();
  // In Kolommen staat waar je ze vindt, met een knop ernaartoe.
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-to-resource-options]').click();
  await expect(page.locator('[data-rs-option="showAssignmentColumns"]')).toBeFocused();
  await page.locator('[data-rs-step-head="bars"]').click();

  // Een eigen layout uit een ander venster (dezelfde `StorageEvent` als de host): alleen één taak. Het papier
  // volgt de layout ook als die daarna verandert, zonder nieuwe keuze.
  const storeLayouts = (layouts: unknown[]) => page.evaluate(list => {
    const oldValue = localStorage.getItem('ops-taskGridLayouts');
    const newValue = JSON.stringify({ version: 1, layouts: list });
    localStorage.setItem('ops-taskGridLayouts', newValue);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ops-taskGridLayouts', oldValue, newValue, storageArea: localStorage, url: location.href }));
  }, layouts);
  const onlyTask = (name: string) => ({
    id: 'layout-rapport', name: 'Een taak',
    filter: { kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'eq', value: name },
  });
  await storeLayouts([onlyTask('Fundering storten')]);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-layout="layout-rapport"]').click();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Wanden metselen$/ })).toHaveCount(0);
  await expect(page.locator('[data-rs-resource-counts]')).toHaveCount(0);
  await storeLayouts([onlyTask('Wanden metselen')]);
  await expect(page0.locator('text', { hasText: /^Wanden metselen$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ })).toHaveCount(0);
  expect(await saved()).toMatchObject({ reportType: 'gantt', layoutId: 'layout-rapport', followView: false });
  expect(await screen()).toEqual(screenBefore);
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toHaveCount(0);
  // Het filter gebruikt een eigen veld dat dit project niet heeft (review Sol #847, ronde 4): nul rijen, en nu
  // met een melding naast de keuze. Het filter blijft bewaard; niets verdwijnt stil.
  const missingFieldLayout = {
    id: 'layout-rapport', name: 'Een taak',
    filter: { kind: 'rule', field: { src: 'customField', defId: 'removed-custom-field' }, operator: 'eq', value: 'A' },
  };
  await storeLayouts([missingFieldLayout]);
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toBeVisible();
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toContainText(/(not in this project|niet in dit project)/);
  await expect(page0.locator('text', { hasText: /^(Fundering storten|Wanden metselen)$/ })).toHaveCount(0);
  await expect(page.locator('[data-rs-layout="layout-rapport"]')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-taskGridLayouts') ?? '{}').layouts)).toEqual([missingFieldLayout]);
  // Verwijderd: terug naar Alle taken, met een melding.
  await storeLayouts([]);
  await expect(page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
    .some(n => n.messageKey === 'notifications.reportLayoutGone'))).toBe(true);
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toHaveCount(0);

  // Een layout kiezen verandert alleen de rijen; kolommen en balkopties neem je over met een knop (fixronde na
  // council ronde 5, de scenario's van Opus en Sol). Eigen stand: de zes standaardkolommen plus Kalenderdagen,
  // en Afhankelijkheden uit. De layout "Korte tabel" heeft drie kolommen, relatielijnen aan, speling uit, een
  // basislijn en een voortgangslijn.
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await addColumn(calendarDays);
  await expect(page.locator('[data-rs-column]')).toHaveCount(7);
  await page.locator('[data-rs-step-head="bars"]').click();
  await page.locator('[data-rs-switch="showDeps"]').click();
  const own = async () => {
    const s = await saved();
    return { columns: s.columns, showDeps: s.showDeps, showFloat: s.showFloat, showBaselineOverlay: s.showBaselineOverlay, statusLine: s.statusLine, barColors: s.barColors };
  };
  await expect.poll(async () => (await own()).showDeps).toBe(false);
  const ownBefore = await own();
  expect(ownBefore).toMatchObject({ showFloat: true, showBaselineOverlay: false, statusLine: 'none', barColors: null });
  expect(ownBefore.columns).toHaveLength(7);
  const shortColumns = ['task.wbsCode', 'task.name', 'task.time.scheduleDuration'];
  await storeLayouts([{
    id: 'layout-kort', name: 'Korte tabel', icon: 'flag',
    columns: shortColumns.map(id => ({ id, width: 80, pinned: false })),
    group: [{ field: { src: 'builtin', key: 'taskType' }, dir: 'asc' }],
    showRelations: true,
    overlays: { baseline: true, progressLine: true, statusDateLine: false, resourceAccent: false, floatBand: false, barColors: { mode: 'auto' } },
  }]);
  await page.locator('[data-rs-step-head="tasks"]').click();
  const shortTable = page.locator('[data-rs-layout="layout-kort"]');
  const allTasks = page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]');
  // Opus: de layout kiezen en terug naar Alle taken laat de zeven kolommen staan, zonder "Ongedaan maken".
  await shortTable.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  expect(await own()).toEqual(ownBefore);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  await expect(page.locator('[data-rs-notice="layout-own"]')).toBeVisible();
  // Het i-icoon naast het kopje Layouts legt uit wat een layout verandert (Ethan, 10-11-2026): de tooltip
  // verschijnt bij toetsenbordfocus, met de kernzin vet; de pijltjes op het icoon kiezen geen andere bron.
  const layoutInfo = page.locator('[data-rs-step-body="tasks"] [data-rs-group-info]');
  await layoutInfo.focus();
  await expect(page.locator('.ops-tooltip')).toBeVisible();
  await expect(page.locator('.ops-tooltip strong')).toHaveText(/^(Een layout bepaalt alleen de rijen|A layout only sets the rows)$/);
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  await page.keyboard.press('Escape');
  await allTasks.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');
  expect(await own()).toEqual(ownBefore);
  // Opus: met de pijltjes door alle keuzes (elk pijltje kiest meteen), ook over de layout: niets verandert.
  await allTasks.focus();
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp']) await page.keyboard.press(key);
  await expect.poll(async () => (await saved()).followView).toBe(true);
  expect(await own()).toEqual(ownBefore);
  // Sol: met de layout gekozen een eigen keuze in Balken (Speling), dan opnieuw op dezelfde layout klikken:
  // die klik doet niets, ook niet opnieuw overnemen.
  await shortTable.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  await page.locator('[data-rs-step-head="bars"]').click();
  const floatBefore = (await saved()).showFloat;
  await page.locator('[data-rs-switch="showFloat"]').click();
  await expect.poll(async () => (await saved()).showFloat).toBe(!floatBefore);
  const beforeSecondClick = await saved();
  await page.locator('[data-rs-step-head="tasks"]').click();
  await shortTable.click();
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(page.locator('[data-rs-step-body="bars"]')).toBeVisible();
  expect(await saved()).toEqual(beforeSecondClick);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  await page.locator('[data-rs-switch="showFloat"]').click();
  await expect.poll(own).toEqual(ownBefore);
  // "Kolommen overnemen": alleen de kolommen, met één Ongedaan maken voor alleen dat deel. De keuze van de
  // layout blijft staan, ook na Ongedaan maken.
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-take-over="columns"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(shortColumns);
  expect(await own()).toMatchObject({ showDeps: false, showFloat: true, statusLine: 'none' });
  await expect(page.locator('[data-rs-take-over="columns"]')).toHaveCount(0);
  await expect(page.locator('[data-rs-take-over="bars"]')).toBeVisible();
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownBefore.columns);
  expect((await saved()).layoutId).toBe('layout-kort');
  await expect(page.locator('[data-rs-take-over="columns"]')).toBeVisible();
  // "Balkopties overnemen": relatielijnen, basislijn, speling, statuslijn en balkkleuren; Ongedaan maken zet ze terug.
  await page.locator('[data-rs-take-over="bars"]').click();
  await expect.poll(own).toEqual({ ...ownBefore, showDeps: true, showFloat: false, showBaselineOverlay: true, statusLine: 'progress', barColors: { mode: 'auto' } });
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(own).toEqual(ownBefore);
  expect((await saved()).layoutId).toBe('layout-kort');
  // Beide delen na elkaar overnemen, dan één keer Ongedaan maken: kolommen én balkopties komen terug (review Sol
  // #847, ronde 4; eerst zette Ongedaan maken alleen de balkopties terug en bleven de drie kolommen staan).
  await page.locator('[data-rs-take-over="columns"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(shortColumns);
  await page.locator('[data-rs-take-over="bars"]').click();
  await expect.poll(own).toEqual({ columns: shortColumns, showDeps: true, showFloat: false, showBaselineOverlay: true, statusLine: 'progress', barColors: { mode: 'auto' } });
  await expect(page.locator('[data-rs-undo]')).toContainText(/^Korte tabel: (columns and bar options applied|kolommen en balkopties overgenomen)\./);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(own).toEqual(ownBefore);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  expect(await screen()).toEqual(screenBefore);
  // Eigen balkkleuren (keuze Ethan, 10-11-2026). Het overnemen liet de balkkleuren van het scherm staan; een
  // keuze in Balken geldt ook alleen voor het rapport. Bij Zoals de weergave volgt het rapport het scherm en
  // staat de keuze uit; bij Alle taken staat de eigen keuze er weer.
  const screenColors = () => page.evaluate(() => window.__OPS__!.store.getState().ui.barColorSelection);
  expect(await screenColors()).toEqual({ mode: 'critical' });
  await page.locator('[data-rs-step-head="bars"]').click();
  const colorPicker = page.locator('[data-rs-step-body="bars"]').getByRole('button', { name: /^(Bar colours|Balkkleuren)$/ });
  await colorPicker.click();
  await page.getByRole('option', { name: /^(Per task — automatic|Per taak — automatisch)$/ }).click();
  await expect.poll(async () => (await saved()).barColors).toEqual({ mode: 'auto' });
  expect(await screenColors()).toEqual({ mode: 'critical' });
  await expect(page.locator('[data-rs-bar-colors-hint]')).toHaveText(/^(This choice applies only to the report|Deze keuze geldt alleen voor het rapport)/);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="view"]').click();
  await expect.poll(async () => (await saved()).followView).toBe(true);
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(colorPicker).toBeDisabled();
  await expect(colorPicker).toContainText(/Critical path|Kritiek pad/);
  await expect(page.locator('[data-rs-bar-colors-hint]')).toHaveText(/follow your Gantt chart|volgen je Gantt-diagram/);
  expect((await saved()).barColors).toEqual({ mode: 'auto' });
  await page.locator('[data-rs-step-head="tasks"]').click();
  await allTasks.click();
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(colorPicker).toBeEnabled();
  await expect(colorPicker).toContainText(/Per task — automatic|Per taak — automatisch/);
  expect(await screenColors()).toEqual({ mode: 'critical' });
});

// Een Arabische taaknaam bij naamweergave Volledig (review Sol #847). De meting van het papier en de PDF komt
// uit Noto Sans Arabic; het scherm moet dezelfde letter tekenen, anders tekende de browser de naam in een
// systeemletter (183 px in plaats van 175 px) en liep hij over de volgende kolom. Gecontroleerd op de
// werkelijk getekende tekst: in de SVG van het papier (`getBBox`, tegen de getekende kolomlijn) en, met de flag
// uit, op het canvas van het oude voorbeeld (`fillText`, meegelezen). Daarna hetzelfde voor een lange
// Latijnse naam (het canvas rondde letterbreedtes af en kapte die af terwijl afkappen uit stond), voor een
// Chinese naam zonder CJK-extensie, en voor een gemengde Latijns-Arabische naam in Inter en in Carlito
// (ronde 2: de browser nam de spaties in het Latijnse deel uit Noto, de meting uit de rapportletter).
test('rapport-studio: een Arabische of lange naam past in de naamkolom, op het papier en in het oude voorbeeld', async ({ page, ops: _ops }) => {
  const arabic = 'أعمال البناء والتشييد وإدارة الموارد ومتابعة التنفيذ';
  const latin = 'Stakeholder management en afstemming met de gemeente over de bouwlogistiek';
  const [taskId] = await seedProject(page, [
    { name: arabic, start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Rapport Arabisch');
  // Alleen meelezen: wat het canvas van het oude voorbeeld tekent, met de letter en breedte van dat moment.
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawn: { text: string; x: number; font: string; width: number }[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
      if (this.font.includes('InterPDF')) drawn.push({ text: String(text), x, font: this.font, width: this.measureText(text).width });
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsReportDrawn', { configurable: true, value: drawn });
  });
  // De breedte volgens de meting van papier en PDF (`loadReportTextMetrics`), op de letter van de naamcel.
  type FontId = 'inter' | 'carlito';
  const measured = (text: string, font: string, id: FontId) => page.evaluate(async ({ text, font, id }) => {
    const { loadReportTextMetrics } = await import('/src/services/pdf/fontLoader.ts' as string);
    return (await loadReportTextMetrics(id, 'ltr')).measure(text, font) as number;
  }, { text, font, id });
  // De rapportletter van een getekende tekst, uit zijn letter (canvas) of familie (SVG).
  const fontIdOf = (font: string): FontId => (font.includes('OpsReportCarlito') ? 'carlito' : 'inter');
  const setFlag = (on: boolean) => page.evaluate(on => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ featureFlags: { ...s.ui.featureFlags, reportRedesign: on } });
  }, on);
  const rename = (name: string) => page.evaluate(({ id, name }) => window.__OPS__!.store.getState().updateTask(id, { name }), { id: taskId, name });
  await setFlag(true);
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="full"]').click();

  // De naamcel in de tabel (de meest linkse tekst met de naam; de andere staat naast de balk), met de
  // eerste getekende kolomlijn rechts ervan in hetzelfde venster.
  const nameCell = (name: string) => page0.evaluate((svg, name) => {
    const cells = [...svg.querySelectorAll('text')].filter(t => t.textContent === name);
    if (cells.length === 0) return null;
    const cell = cells.reduce((a, b) => (b.getBBox().x < a.getBBox().x ? b : a));
    const box = cell.getBBox();
    const borders: number[] = [];
    for (const path of cell.ownerSVGElement!.querySelectorAll('path')) {
      for (const m of (path.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)) {
        const [x1, y1, x2, y2] = m.slice(1).map(Number);
        if (x1 === x2 && x1 > box.x + 1 && Math.min(y1, y2) <= box.y && Math.max(y1, y2) >= box.y + box.height) borders.push(x1);
      }
    }
    const style = getComputedStyle(cell);
    return {
      end: box.x + box.width, border: Math.min(...borders), drawn: cell.getComputedTextLength(),
      font: `${style.fontWeight === '700' ? 'bold ' : ''}${style.fontSize} InterPDF`, family: style.fontFamily,
    };
  }, name);
  const paperCell = async (name: string, id: FontId = 'inter') => {
    await expect.poll(() => nameCell(name).then(c => c !== null && Number.isFinite(c.border) && fontIdOf(c.family) === id)).toBe(true);
    const cell = (await nameCell(name))!;
    // Dezelfde breedte als de meting (dus dezelfde letter), en de naam eindigt vóór de rechtermarge van de
    // kolom (2 px, `NAME_RIGHT_PAD`): niets loopt over de kolomlijn.
    expect(Math.abs(cell.drawn - await measured(name, cell.font, id)), `getekend ${cell.drawn}`).toBeLessThan(0.1);
    expect(cell.end, `kolomlijn op ${cell.border}`).toBeLessThanOrEqual(cell.border - 2);
    return cell;
  };
  const arabicCell = await paperCell(arabic);
  expect(arabicCell.family).toMatch(/^"?OpsReportArabic"?, /);
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === 'OpsReportArabic' && face.status === 'loaded').map(face => face.weight).sort()))
    .toEqual(['400', '700']);

  // Het oude voorbeeld (flag uit) leest dezelfde opgeslagen naamweergave en meet met dezelfde meting. Het
  // canvas tekent de naam volledig, in Noto vooraan, en even breed als de meting.
  const canvasName = (name: string, id: FontId) => page.evaluate(({ name, id }) => {
    const drawn = (window as Window & { __opsReportDrawn?: { text: string; x: number; font: string; width: number }[] }).__opsReportDrawn ?? [];
    const cells = drawn.filter(d => (d.text === name || (d.text.endsWith('…') && name.startsWith(d.text.slice(0, 8))))
      && (d.font.includes('OpsReportCarlito') ? 'carlito' : 'inter') === id);
    return cells.length === 0 ? null : cells.reduce((a, b) => (b.x < a.x ? b : a));
  }, { name, id });
  const clearDrawn = () => page.evaluate(() => {
    (window as Window & { __opsReportDrawn?: unknown[] }).__opsReportDrawn!.length = 0;
  });
  const canvasCell = async (name: string, id: FontId = 'inter') => {
    await expect.poll(() => canvasName(name, id).then(c => c?.text ?? null), { timeout: 20_000 }).toBe(name);
    const cell = (await canvasName(name, id))!;
    expect(Math.abs(cell.width - await measured(name, cell.font, id)), `canvas ${cell.width}`).toBeLessThan(0.1);
    return cell;
  };
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'))).truncateTaskNames).toBe(false);
  await clearDrawn();
  await setFlag(false);
  await expect(page.locator('[data-tour-anchor="report-panel"] img').first()).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  expect((await canvasCell(arabic)).font).toMatch(/^(bold )?[\d.]+px "?OpsReportArabic"?, /);

  // Een lange Latijnse naam, nu de langste: hetzelfde op het canvas en, met de flag weer aan, op het papier.
  await clearDrawn();
  await rename(latin);
  await canvasCell(latin);
  await setFlag(true);
  await expect(page0).toBeVisible();
  await paperCell(latin);

  // Een naam in een schrift dat geen meegeleverde letter heeft (Chinees zonder CJK-extensie): het scherm
  // tekent hem in een systeemletter en de PDF valt dan terug op raster. De meting volgt dan de browser, niet
  // de lege glyph van Inter. Op het papier en, met de flag uit, op het canvas.
  const chinese = '地基浇筑与钢筋绑扎工程施工';
  await rename(chinese);
  await paperCell(chinese);
  await clearDrawn();
  await setFlag(false);
  await canvasCell(chinese);

  // Een gemengde naam: Latijn, een cijfer en Arabisch (review Sol #847, ronde 2). De browser kiest de letter
  // per teken, ook in het Latijnse deel: elke spatie komt uit Noto. De PDF en de meting doen nu hetzelfde.
  // Daarvoor mat Carlito 409,8 px en tekende de browser 414,4 px: de naam liep de volgende kolom in en het
  // oude voorbeeld kapte hem af ("… bouwpla…"), terwijl afkappen uit stond. Eerst in Inter, dan in Carlito.
  // Daartussen een naam met cijfers en leestekens: een stuk zonder letter ("2.3") kernt de browser als
  // Latijn; de meting kernde het eerst als DFLT (Inter: 0,24 px smaller).
  const mixed = 'Fase 1 أعمال البناء en afstemming met de gemeente over de bouwlogistiek en bereikbaarheid van de bouwplaats';
  const mixedDigits = 'Fase 2.3 – أعمال (البناء) 50%, week 12/03: 3\u00A0dagen';
  await clearDrawn();
  await rename(mixed);
  expect((await canvasCell(mixed)).font).toMatch(/^(bold )?[\d.]+px "?OpsReportArabic"?, /);
  await clearDrawn();
  await rename(mixedDigits);
  await canvasCell(mixedDigits);
  await setFlag(true);
  await expect(page0).toBeVisible();
  await paperCell(mixedDigits);
  await rename(mixed);
  await paperCell(mixed);
  // Carlito kiezen in de stap Pagina, met een echte klik in de keuzelijst.
  await page.locator('[data-rs-step-head="page"]').click();
  const fontPicker = page.getByLabel(/^(Font:|Lettertype:)$/);
  await fontPicker.click();
  await page.getByRole('option', { name: /^Carlito/ }).click();
  await expect(fontPicker).toContainText(/^Carlito/);
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'))).reportFontFamily).toBe('carlito');
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === 'OpsReportCarlito' && face.status === 'loaded').map(face => face.weight).sort()), { timeout: 20_000 })
    .toEqual(['400', '700']);
  expect((await paperCell(mixed, 'carlito')).family).toMatch(/^"?OpsReportArabic"?, "?OpsReportCarlito"?, /);
  await clearDrawn();
  await setFlag(false);
  expect((await canvasCell(mixed, 'carlito')).font).toMatch(/^(bold )?[\d.]+px "?OpsReportArabic"?, "?OpsReportCarlito"?, /);
});
