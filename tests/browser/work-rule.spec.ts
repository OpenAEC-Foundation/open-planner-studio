import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

// Taaktypes-etappe (spec 2026-09-04 §7, bouwstap 5): de werkregel en het resterende werk bewerken
// via het eigenschappenpaneel. Fixture via de brug (taak + resource + toewijzing, instelling
// "Toon taaktypes" aan); de geteste handelingen zijn echte keuzelijst- en invoerbewerkingen.
// Asserties op de store (werkregel, werkveld, duur, undo) — geen canvaspixels.

async function seedAssignedTask(page: Page): Promise<{ taskId: string; resourceId: string }> {
  const [taskId] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
  ]);
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const resourceId = s.addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(id, resourceId, 1);
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, showTaskTypes: true });
    s.selectTask(id);
    return { taskId: id, resourceId };
  }, taskId);
}

/** De tooltip staat direct bij zijn i-icoon (besluit eigenaar 2026-10-15, checkstap 17: "op de tool,
 *  niet naast de dropdown"): zijn rechthoek grenst aan die van het icoon, erboven of eronder (≤ 10 px
 *  tussenruimte), en ligt horizontaal over het icoon. */
async function expectTipAtIcon(tip: Locator, icon: Locator): Promise<void> {
  await expect.poll(async () => {
    const t = (await tip.boundingBox())!;
    const i = (await icon.boundingBox())!;
    const below = t.y >= i.y + i.height - 0.5 && t.y <= i.y + i.height + 10;
    const above = t.y + t.height <= i.y + 0.5 && t.y + t.height >= i.y - 10;
    const overIcon = t.x <= i.x + 0.5 && t.x + t.width >= i.x + i.width - 0.5;
    return (below || above) && overIcon ? 'bij het icoon' : `tooltip ${JSON.stringify(t)} niet bij icoon ${JSON.stringify(i)}`;
  }).toBe('bij het icoon');
}

/** Kies een werkregel met echte klikken in de eigen keuzelijst (geen native `<select>` meer). */
async function chooseWorkRule(page: Page, scope: Page | Locator, value: string): Promise<void> {
  await scope.locator('[data-ops-work-rule] button[aria-haspopup="listbox"]').first().click();
  await page.locator(`.ops-select__menu [role="option"][data-value="${value}"]`).click();
  await expect(page.locator('.ops-select__menu')).toHaveCount(0);
}

function taskState(page: Page, taskId: string): Promise<{ workRule?: string; duration: number; units: number; work?: number; stale: boolean }> {
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.id === id)!;
    const a = s.assignments.find(x => x.taskId === id)!;
    return { workRule: t.workRule, duration: t.time.scheduleDuration, units: a.unitsPerDay, work: a.remainingWorkMinutes, stale: s.scheduleStale };
  }, taskId);
}

test('werkregel kiezen, werk typen en inzet wijzigen volgen de regel; undo in één stap', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);

  const select = page.locator('[data-ops-work-rule]');
  await expect(select).toBeVisible();
  // Standaard: projectstandaard (vaste duur en inzet) — de inzetkolom draagt het slotje.
  await expect(page.locator('[data-ops-assignment-lock-units]')).toHaveAttribute('data-ops-assignment-lock-units', 'locked');
  await expect(page.locator('[data-ops-assignment-work]')).toHaveAttribute('data-ops-assignment-work', 'derived');

  // Vast werk kiezen: geen getal verandert, het restwerk (4 d × 8 u = 32 u) wordt vastgelegd.
  await chooseWorkRule(page, page, 'FIXED_WORK');
  let st = await taskState(page, taskId);
  expect(st.workRule).toBe('FIXED_WORK');
  expect(st.duration).toBe(4);
  expect(st.work).toBe(4 * 8 * 60);
  await expect(page.locator('[data-ops-work-rule-info]')).toHaveAttribute('data-ops-work-rule-info', 'FIXED_WORK');
  await expect(page.locator('[data-ops-assignment-lock-work]')).toHaveAttribute('data-ops-assignment-lock-work', 'locked');
  await expect(page.locator('[data-ops-assignment-work]')).toHaveAttribute('data-ops-assignment-work', 'stored');

  // Werk 32 → 64 uur TYPEN (toets voor toets, review K5: pas op Enter committen — "6" onderweg mag
  // geen eigen driehoekstap zijn): onder vast werk wordt de taak twee keer zo lang (8 d), inzet blijft 1.
  const workInput = page.locator('[data-ops-assignment-work] input');
  await expect(workInput).toHaveValue('32');
  await workInput.click();
  await workInput.press('Control+a');
  await workInput.pressSequentially('64');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(4);
  await workInput.press('Enter');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(8);
  expect(st.units).toBe(1);
  expect(st.work).toBe(64 * 60);
  expect(st.stale).toBe(true);

  // Inzet 1 → 2 via de inzetkolom: 64 u ÷ 2 = 4 d.
  const row = page.locator('[data-ops-assignment-row]').first();
  const unitsInput = row.locator('input').first();
  await unitsInput.fill('2');
  await unitsInput.press('Enter');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(4);
  expect(st.units).toBe(2);

  // Undo in één stap: terug naar 8 d en inzet 1.
  await page.keyboard.press('Control+z');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(8);
  expect(st.units).toBe(1);

  // Terug naar de projectstandaard: het veld verdwijnt, het werk blijft staan (besluit 2).
  await chooseWorkRule(page, page, '');
  st = await taskState(page, taskId);
  expect(st.workRule).toBeUndefined();
  expect(st.work).toBe(64 * 60);
});

test('taakdialoog: werkregel kiezen commit direct, werk typen in dezelfde dialoog rekent met die regel, Opslaan draait de duur niet terug', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  const dialog = page.locator('[role="dialog"]').last();
  await expect(dialog).toBeVisible();
  await chooseWorkRule(page, dialog, 'FIXED_WORK');
  let st = await taskState(page, taskId);
  expect(st.workRule).toBe('FIXED_WORK');
  const workInput = dialog.locator('[data-ops-assignment-work] input');
  await workInput.fill('64');
  await workInput.press('Enter');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(8);
  // Opslaan: de duur die de driehoek zette blijft 8 (review B4).
  await dialog.getByRole('button', { name: /opslaan|save/i }).click();
  st = await taskState(page, taskId);
  expect(st.duration).toBe(8);
  expect(st.workRule).toBe('FIXED_WORK');
});

test('instelling uit en document zonder taaktypes: geen werkregel-UI; een gezette regel ontsluit het document', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showTaskTypes: false }));
  await expect(page.locator('[data-ops-work-rule]')).toHaveCount(0);
  await expect(page.locator('[data-ops-assignment-header]')).toHaveCount(0);
  // Documentontsluiting: een regel via de store zet `taskTypesVisible` ⇒ de UI verschijnt.
  await page.evaluate((id) => window.__OPS__!.store.getState().setTaskWorkRule(id, 'FIXED_RATE'), taskId);
  await expect(page.locator('[data-ops-work-rule]')).toBeVisible();
  await expect(page.locator('[data-ops-work-rule]')).toHaveAttribute('data-value', 'FIXED_RATE');
});

// Gebruikstest #170, G1: met de kolom "Werk (rest)" en een "Verplaats naar…"-keuzelijst (vanaf
// twee resources en een tweede taak) werd de naamkolom 0 px breed en verdween het slotje op de
// inzetkolom. De naam moet op 100 % én 125 % zichtbaar blijven, het slotje ook.
for (const scale of [100, 125]) {
  test(`toewijzingstabel: resourcenaam en slotje blijven zichtbaar met werkkolom bij ≥ 2 resources (${scale} %)`, async ({ page, ops: _ops }) => {
    const [taskId] = await seedProject(page, [
      { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
      { name: 'Voegwerk', start: '2026-09-11', finish: '2026-09-14', durationDays: 2 },
    ]);
    await page.evaluate(({ id, scale }) => {
      const s = window.__OPS__!.store.getState();
      const a = s.addResource({ name: 'Metselploeg Noord', type: 'LABOR', description: '', maxUnits: 2 });
      const b = s.addResource({ name: 'Opperman', type: 'LABOR', description: '', maxUnits: 2 });
      s.assignResource(id, a, 1);
      s.assignResource(id, b, 1);
      s.runCPM();
      s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, showTaskTypes: true, uiFontScale: scale });
      s.selectTask(id);
    }, { id: taskId, scale });

    const rows = page.locator('[data-ops-assignment-row]');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('[data-ops-assignment-move]')).toBeVisible();
    await expect(rows.first().locator('[data-ops-assignment-work] input')).toBeVisible();
    for (const [i, name] of [[0, 'Metselploeg Noord'], [1, 'Opperman']] as const) {
      const nameCell = rows.nth(i).getByText(name, { exact: true });
      await expect(nameCell).toBeVisible();
      const box = (await nameCell.boundingBox())!;
      expect(box.width).toBeGreaterThan(40);
    }
    // Het slotje op de inzetkolom (projectstandaard = vaste duur en inzet) heeft echte breedte.
    const lock = page.locator('[data-ops-assignment-lock-units="locked"] svg');
    await expect(lock).toBeVisible();
    expect((await lock.boundingBox())!.width).toBeGreaterThan(4);
    // De verwijderknop valt niet uit het paneel.
    const trash = rows.first().locator('[data-ops-assignment-remove]');
    await expect(trash).toBeVisible();
    const panel = (await page.locator('[data-ops-rail]').first().boundingBox())!;
    const tb = (await trash.boundingBox())!;
    expect(tb.x + tb.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
  });
}

// Her-check #170, punt 3: op 125 % toonde het inzetveld "0.267" afgekapt. De kolom schaalt nu met
// de tekstrol mee (breedte in `--text-small`), en de title draagt de volledige waarde.
test('toewijzingstabel: inzet 0.267 past volledig in het veld op 125 % en staat in de title', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
  ]);
  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const a = s.addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(id, a, 1);
    const asg = window.__OPS__!.store.getState().assignments.find(x => x.taskId === id)!;
    s.updateAssignment(asg.id, { unitsPerDay: 0.267 });
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, showTaskTypes: true, uiFontScale: 125 });
    s.selectTask(id);
  }, taskId);
  const input = page.locator('[data-ops-assignment-row]').first().locator('input').first();
  await expect(input).toHaveValue('0.267');
  await expect(input).toHaveAttribute('title', /0\.267/);
  const fit = await input.evaluate((el: HTMLInputElement) => {
    const cs = getComputedStyle(el);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = ctx.measureText(el.value).width;
    const content = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { text, content };
  });
  // Chromium reserveert in een `type="number"` altijd ruimte voor de (onzichtbare) spinknop, ook
  // zonder hover — gemeten ±15 px; dáárdoor viel de "7" weg terwijl de tekst zelf wel paste.
  const SPIN_BUTTON_PX = 15;
  expect(fit.text + SPIN_BUTTON_PX).toBeLessThanOrEqual(fit.content);
});

// Gebruikstest #170, G3: de taaktypes-detailregel in de bestandsmelding (.mpp/XER) heeft een EIGEN
// gidslink naar "Werkregels en werk"; de "Lees meer" van de melding zelf blijft naar het
// bestand/rekenprofiel wijzen. Fixture: de melding zoals `applyOpenedImport` hem samenstelt.
test('bestandsmelding: de werkregel-detailregel opent de werkregelgids, niet de rekenprofielgids', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.notify({
      severity: 'info',
      messageKey: 'notifications.schedulingProfileApplied',
      params: { profile: 'Primavera P6' },
      helpArticleId: 'uitleg-rekenprofielen',
      detailLines: [{ messageKey: 'notifications.taskTypesUnlockedDetail', helpArticleId: 'uitleg-werkregels', linkKey: 'notifications.workRulesReadMore' }],
    });
  });
  const link = page.locator('[data-ops-toast-detail-link="uitleg-werkregels"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.backstageSection)).toBe('help');
  const titles = await page.evaluate(async () => {
    const m = await (await fetch(new URL('docs/manifest.json', document.baseURI))).json() as { articles: { id: string; title: Record<string, string> }[] };
    return m.articles.find(a => a.id === 'uitleg-werkregels')!.title;
  });
  const active = page.locator('.help-toc-item.active');
  await expect(active).toHaveCount(1);
  expect(Object.values(titles)).toContain((await active.textContent())?.trim());
});

// Gebruikstest #170, G5/G7: de taakdialoog commit werkregel, werk en toewijzingen direct (zodat ze
// in de dialoog met elkaar rekenen), maar Annuleren draait ze terug — zonder redo-rest — en Opslaan
// maakt er één undo-stap van; Opslaan zonder wijziging voegt geen lege undo-stap toe.
function historyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__OPS__!.store.getState().historyEvents.length);
}

test('taakdialoog: Annuleren draait werkregel en werk terug, Opslaan is één undo-stap', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  const baseline = await historyCount(page);
  const open = async () => {
    await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
    const dialog = page.locator('[data-ops-task-dialog] [role="dialog"], [role="dialog"]').last();
    await expect(dialog.locator('[data-ops-work-rule]')).toBeVisible();
    return dialog;
  };

  // Annuleren: regel + werk (inzet volgt) worden teruggedraaid.
  let dialog = await open();
  await chooseWorkRule(page, dialog, 'FIXED_DURATION_WORK');
  const work = dialog.locator('[data-ops-assignment-work] input');
  await work.fill('64');
  await work.press('Enter');
  let st = await taskState(page, taskId);
  expect([st.workRule, st.units, st.duration]).toEqual(['FIXED_DURATION_WORK', 2, 4]);
  await dialog.locator('[data-ops-task-cancel]').click();
  await expect(page.locator('[data-ops-work-rule]').first()).toBeVisible();
  st = await taskState(page, taskId);
  expect([st.workRule, st.units, st.work, st.duration]).toEqual([undefined, 1, undefined, 4]);
  expect(await historyCount(page)).toBe(baseline);

  // Opslaan zonder wijziging: geen lege undo-stap (G7).
  dialog = await open();
  await dialog.locator('[data-ops-task-save]').click();
  expect(await historyCount(page)).toBe(baseline);

  // Opslaan met regel + werk + naam: één Ctrl+Z haalt alles terug.
  dialog = await open();
  await chooseWorkRule(page, dialog, 'FIXED_DURATION_WORK');
  await dialog.locator('[data-ops-assignment-work] input').fill('64');
  await dialog.locator('[data-ops-assignment-work] input').press('Enter');
  await dialog.locator('input').first().fill('Metselwerk gevel');
  await dialog.locator('[data-ops-task-save]').click();
  st = await taskState(page, taskId);
  expect([st.workRule, st.units]).toEqual(['FIXED_DURATION_WORK', 2]);
  expect(await historyCount(page)).toBe(baseline + 1);
  await page.keyboard.press('Control+z');
  st = await taskState(page, taskId);
  const name = await page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.name, taskId);
  expect([st.workRule, st.units, st.work, name]).toEqual([undefined, 1, undefined, 'Metselwerk']);
});

// Gebruikstest #170, E5/G6: de instelling heet "Taaktypes gebruiken" (eigenaar 2026-10-17), staat onder Berekenen
// (geen eigen sectiekop) en haar toelichting is één zin in een gekleurd blok (accentbalk), geen
// los bijschrift. In het paneel staat sinds 2026-10-15 GEEN blok meer onder de werkregel: de uitleg
// zit achter het i-icoon (zie de test hieronder).
test('instelling en paneel: geen blok onder de werkregel, instelling onder Berekenen', async ({ page, ops: _ops }) => {
  await seedAssignedTask(page);
  await expect(page.locator('[data-ops-work-rule]')).toBeVisible();
  await expect(page.locator('[data-ops-work-rule-note]')).toHaveCount(0);
  // Geen native keuzelijst (besluit eigenaar 2026-10-15: "mag nooit native zijn").
  await expect(page.locator('[data-ops-work-rule] select')).toHaveCount(0);

  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  const dlg = page.locator('.settings-dialog');
  await dlg.locator('.settings-tab').filter({ hasText: /^Planning$/ }).click();
  const box = dlg.locator('[data-ops-setting-show-task-types]');
  const row = box.locator('xpath=ancestor::label[1]');
  await expect(row).toHaveText(/^(Use task types|Taaktypes gebruiken)$/);
  const section = row.locator('xpath=ancestor::div[contains(@class,"settings-section")][1]');
  await expect(section.locator('> h3')).toHaveText(/^(Calculation|Berekenen)$/);
  const settingNote = section.locator('[data-ops-setting-show-task-types-note]');
  await expect(settingNote).toBeVisible();
  expect(await settingNote.evaluate(el => getComputedStyle(el).boxShadow)).toContain('inset');
  // Geen los grijs bijschrift direct onder het vinkje.
  expect(await row.evaluate(el => el.nextElementSibling?.classList.contains('scrollzoom-hint') ?? false)).toBe(false);
});

// Gebruikstest #170, G2: "taaktype" betekende drie dingen. Sinds de hernoeming (eigenaar 2026-10-17)
// heet de werkregelkolom Taaktype en de IFC-soort Werksoort; beide zijn op die naam te vinden. De
// bewaarde MS Project-waarde heet "MS Project-taaktype (import)".
test('kolomkiezer: zoeken op taaktype vindt de kolom; werksoort apart; de MS Project-kolom heet "(import)"', async ({ page, ops: _ops }) => {
  await seedAssignedTask(page);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const shell = page.locator('[data-task-grid-surface-id="full-task-grid"] .task-grid-shell');
  await shell.locator('.task-grid-add-column').click();
  const search = page.locator('.task-grid-column-chooser-search input');
  await expect(search).toBeVisible();
  const nl = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl');
  const results = page.locator('section[aria-label]').filter({ has: page.locator('.task-grid-column-chooser-section-label') }).last();
  await search.fill(nl ? 'taaktype' : 'task type');
  await expect(results.getByText(nl ? 'Taaktype' : 'Task type', { exact: true })).toBeVisible();
  await expect(results.getByText(nl ? 'MS Project-taaktype (import)' : 'MS Project task type (import)', { exact: true })).toBeVisible();
  await search.fill(nl ? 'werksoort' : 'work category');
  await expect(results.getByText(nl ? 'Werksoort' : 'Work category', { exact: true })).toBeVisible();
});

// E7 (orkestratorbesluit 25-09, gebruikstest #170 G4): opgeslagen werk dat afwijkt van inzet × resterende duur
// (P6-toewijzing met een eigen spanne, EC2370: 30 u naast 90 u) krijgt in de werkcel een markering
// met beide getallen; de inzet wordt niet stil aangepast. Fixture: het werkveld zoals de XER-lezer
// het zet (via de brug); gelijk aan inzet × resterende duur ⇒ geen markering.
test('werkcel: opgeslagen werk dat afwijkt van inzet × resterende duur is gemarkeerd, inzet blijft', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  await page.evaluate((id) => {
    const store = window.__OPS__!.store;
    const s = store.getState();
    const painter = s.addResource({ name: 'Schilder', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(id, painter, 1);
    store.setState((draft: { assignments: { taskId: string; resourceId: string; remainingWorkMinutes?: number }[] }) => {
      for (const a of draft.assignments) {
        if (a.taskId !== id) continue;
        a.remainingWorkMinutes = a.resourceId === painter ? 10 * 60 : 32 * 60;
      }
    });
  }, taskId);
  const rows = page.locator('[data-ops-assignment-row]');
  await expect(rows).toHaveCount(2);
  const painterRow = rows.filter({ hasText: 'Schilder' });
  const crewRow = rows.filter({ hasText: 'Metselploeg' });
  const mark = painterRow.locator('[data-ops-assignment-work-deviates]');
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute('data-ops-assignment-work-deviates', '10/32');
  await expect(mark).toHaveAttribute('title', /10.*32/);
  await expect(crewRow.locator('[data-ops-assignment-work-deviates]')).toHaveCount(0);
  const units = await page.evaluate((id) => window.__OPS__!.store.getState().assignments.filter(a => a.taskId === id).map(a => a.unitsPerDay), taskId);
  expect(units).toEqual([1, 1]);
});

// Besluit eigenaar 2026-10-15: eigen keuzelijst met een i-icoon per optie en een i-icoon naast het
// gesloten veld. Echte events: lijst openen met een klik, het i-icoon van een optie aanwijzen
// (hover) en aanklikken (een klik op het icoon kiest NIET), het toetsenbord (aria-describedby op de
// gemarkeerde optie en de trigger), een regel kiezen, en dan de tooltip van het gesloten veld.
test('werkregel: i-icoon per optie en naast het veld, met de uitleg van de regel die nu geldt', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  const nl = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl');
  const tip = page.locator('.ops-tooltip[role="tooltip"]');
  const field = page.locator('[data-ops-work-rule]');
  const trigger = field.locator('button[aria-haspopup="listbox"]');
  const info = page.locator('[data-ops-work-rule-info]');

  // Gesloten veld: projectstandaard ⇒ het i-icoon legt Vaste duur en inzet uit (de regel tussen haakjes).
  await expect(info).toHaveAttribute('data-ops-work-rule-info', 'FIXED_DURATION_RATE');
  // Klikvlak zoals bij *Duur*: vierkant, minstens 24 px (review #359, punt 2).
  const ib = (await info.boundingBox())!;
  expect(ib.width).toBeGreaterThanOrEqual(24);
  expect(ib.height).toBeGreaterThanOrEqual(24);
  expect(Math.abs(ib.width - ib.height)).toBeLessThanOrEqual(1);
  await info.hover();
  await expect(tip).toBeVisible();
  await expect(tip.locator('strong')).toHaveText(nl ? 'Het werk volgt uit de duur en de inzet.' : 'Work follows from duration and units.');
  await expectTipAtIcon(tip, info);
  // Elke zin een eigen regel: geen spatie als scheiding tussen zinnen (zh/ja, review #359, punt 5).
  await expect(tip.locator('.ops-tooltip__line')).toHaveText(nl
    ? ['Wijzig je het werk, dan past de inzet zich aan.', 'Een extra resource voegt werk toe.']
    : ['If you change the work, the units adjust.', 'An extra resource adds work.']);
  await page.mouse.move(0, 0);
  await expect(tip).toHaveCount(0);

  // Lijst openen: elke optie (5) heeft een i-icoon.
  await trigger.click();
  const menu = page.locator('.ops-select__menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[role="option"]')).toHaveCount(5);
  await expect(menu.locator('[data-ops-select-option-info]')).toHaveCount(5);

  // Hover op het i-icoon van Vast werk: de tooltip met de uitleg van díe regel.
  const workIcon = menu.locator('[data-ops-select-option-info="FIXED_WORK"]');
  await workIcon.hover();
  await expect(tip).toBeVisible();
  await expect(tip.locator('strong')).toHaveText(nl ? 'De duur volgt uit het werk en de inzet.' : 'Duration follows from work and units.');
  await expect(tip).toContainText(nl ? 'Wijzig je de duur, dan past de inzet zich aan.' : 'If you change the duration, the units adjust.');
  // Het menu en de tooltip vallen binnen het scherm, en de tooltip staat bij het i-icoon van de optie
  // zelf, niet naast de lijst (hij mag andere opties bedekken: keus van de eigenaar).
  const vw = page.viewportSize()!.width;
  for (const box of [(await menu.boundingBox())!, (await tip.boundingBox())!]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw);
  }
  await expectTipAtIcon(tip, workIcon);
  // Een klik op het i-icoon toont de uitleg en kiest de optie niet.
  await workIcon.click();
  await expect(menu).toBeVisible();
  await expect(tip).toBeVisible();
  expect((await taskState(page, taskId)).workRule).toBeUndefined();

  // Toetsenbord: de focus blijft op de trigger; die wijst met aria-describedby naar de uitleg van de
  // gemarkeerde optie (een optie zelf krijgt nooit focus, dus geen aria-describedby op de optie).
  await trigger.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  const highlighted = menu.locator('[role="option"].is-highlighted');
  await expect(highlighted).toHaveAttribute('data-value', 'FIXED_DURATION_RATE');
  await expect(highlighted).not.toHaveAttribute('aria-describedby', /.+/);
  const descId = await trigger.getAttribute('aria-describedby');
  expect(descId).toBeTruthy();
  await expect(page.locator(`[id="${descId}"]`)).toHaveText(nl ? /^Het werk volgt uit de duur en de inzet\./ : /^Work follows from duration and units\./);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(`[id="${await trigger.getAttribute('aria-describedby')}"]`)).toHaveText(nl ? /^De inzet volgt uit de duur en het werk\./ : /^Units follow from duration and work\./);

  // Kies Vaste inzet met een klik op het label.
  await menu.locator('[role="option"][data-value="FIXED_RATE"]').click();
  await expect(menu).toHaveCount(0);
  expect((await taskState(page, taskId)).workRule).toBe('FIXED_RATE');

  // Het i-icoon van het gesloten veld legt nu Vaste inzet uit; focus toont de tooltip ook.
  await expect(info).toHaveAttribute('data-ops-work-rule-info', 'FIXED_RATE');
  await info.focus();
  await expect(tip).toBeVisible();
  await expect(tip.locator('strong')).toHaveText(nl ? 'De duur volgt uit het werk en de inzet.' : 'Duration follows from work and units.');
  await expect(tip).toContainText(nl ? 'Wijzig je de duur, dan past het werk zich aan.' : 'If you change the duration, the work adjusts.');
  // Dagtaak: de rekenkern rondt af op hele werkdagen, dus de zin noemt dat (besluit eigenaar 2026-10-15).
  await expect(tip).toContainText(nl ? 'Een extra resource maakt de taak korter, afgerond op hele dagen.' : 'An extra resource makes the task shorter, rounded to whole days.');
});

// Besluit eigenaar 2026-10-15: "afgerond op hele dagen" alleen bij een dagtaak. Een urentaak rondt af op
// hele minuten en houdt de korte zin. Fixture: de taak als urentaak via de brug.
test('werkregel: bij een urentaak noemt de uitleg geen afronding op hele dagen', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  await page.evaluate((id) => {
    const store = window.__OPS__!.store;
    store.getState().setTaskWorkRule(id, 'FIXED_WORK');
    store.setState((draft: { tasks: { id: string; time: { durationUnit: string; durationMinutes?: number; scheduleDuration: number } }[] }) => {
      const t = draft.tasks.find(x => x.id === id)!;
      t.time.durationUnit = 'hours';
      t.time.durationMinutes = t.time.scheduleDuration * 8 * 60;
    });
  }, taskId);
  const nl = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl');
  const tip = page.locator('.ops-tooltip[role="tooltip"]');
  await page.locator('[data-ops-work-rule-info]').hover();
  await expect(tip.locator('.ops-tooltip__line').last()).toHaveText(nl ? 'Een extra resource maakt de taak korter.' : 'An extra resource makes the task shorter.');
  // Ook de uitleg bij de optie in de open lijst volgt de geselecteerde (uren)taak.
  await page.mouse.move(0, 0);
  await page.locator('[data-ops-work-rule] button[aria-haspopup="listbox"]').click();
  await page.locator('[data-ops-select-option-info="FIXED_RATE"]').hover();
  await expect(tip.locator('.ops-tooltip__line').last()).toHaveText(nl ? 'Een extra resource maakt de taak korter.' : 'An extra resource makes the task shorter.');
});

// Het bewaarde MS Project-vinkje staat niet meer als losse regel onder het veld; de uitleg zelf
// volgt het (Vaste inzet, niet effort-driven: een extra resource voegt werk toe, de duur blijft).
test('werkregel: de uitleg volgt het bewaarde MS Project-vinkje', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  await page.evaluate((id) => {
    const store = window.__OPS__!.store;
    store.getState().setTaskWorkRule(id, 'FIXED_RATE');
    // Zoals de MSP-lezer het zet: taaktype Fixed Units, niet effort-driven.
    store.setState((draft: { tasks: { id: string; effortDriven?: boolean; mspTaskType?: string }[] }) => {
      const t = draft.tasks.find(x => x.id === id)!;
      t.mspTaskType = 'FIXED_UNITS';
      t.effortDriven = false;
    });
  }, taskId);
  const nl = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl');
  await expect(page.locator('[data-ops-work-rule-msp]')).toHaveCount(0);
  const info = page.locator('[data-ops-work-rule-info]');
  await info.hover();
  const tip = page.locator('.ops-tooltip[role="tooltip"]');
  await expect(tip).toContainText(nl ? 'Een extra resource voegt werk toe; de duur blijft gelijk.' : 'An extra resource adds work; the duration stays the same.');
});

// Review #359, punt 1: de tooltip toont de uitleg van de regel die NU geldt, ook als de regel
// verandert terwijl hij open staat (Ctrl+Z met de muis of de focus op het i-icoon). Voorheen zette
// TooltipHost bij het sluiten het oude `title` terug over de nieuwe waarde van React.
test('werkregel: na Ctrl+Z met de tooltip open toont het i-icoon de regel die nu geldt', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  const nl = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl');
  const tip = page.locator('.ops-tooltip[role="tooltip"]');
  const info = page.locator('[data-ops-work-rule-info]');
  const fdr = nl ? 'Het werk volgt uit de duur en de inzet.' : 'Work follows from duration and units.';
  const fw = nl ? 'De duur volgt uit het werk en de inzet.' : 'Duration follows from work and units.';
  for (const how of ['hover', 'focus'] as const) {
    await chooseWorkRule(page, page, 'FIXED_WORK');
    expect((await taskState(page, taskId)).workRule).toBe('FIXED_WORK');
    if (how === 'hover') await info.hover(); else await info.focus();
    await expect(tip.locator('strong')).toHaveText(fw);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await taskState(page, taskId)).workRule).toBeUndefined();
    await expect(info).toHaveAttribute('data-ops-work-rule-info', 'FIXED_DURATION_RATE');
    // Zichtbare tooltip volgt meteen; na sluiten staat het nieuwe `title` op de knop.
    await expect(tip.locator('strong')).toHaveText(fdr);
    await page.mouse.move(0, 0);
    // Een tooltip door focus sluit met Escape (TooltipHost slikt die Escape; zonder tooltip zou
    // Escape de selectie opheffen).
    if (how === 'focus') await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await expect.poll(async () => (await info.getAttribute('title'))?.startsWith(fdr)).toBe(true);
    await info.hover();
    await expect(tip.locator('strong')).toHaveText(fdr);
    await page.mouse.move(0, 0);
  }
});

// Review #359, punt 3: een tooltip die onder het scherm zou vallen, komt boven zijn element.
test('tooltip: onderaan het scherm staat de tooltip boven het i-icoon', async ({ page, ops: _ops }) => {
  await seedAssignedTask(page);
  await page.setViewportSize({ width: 1280, height: 560 });
  const info = page.locator('[data-ops-work-rule-info]');
  await info.evaluate(el => el.scrollIntoView({ block: 'end' }));
  const vh = page.viewportSize()!.height;
  const ib = (await info.boundingBox())!;
  const tip = page.locator('.ops-tooltip[role="tooltip"]');
  await info.hover();
  await expect(tip).toBeVisible();
  // De uitleg (drie regels) past niet meer onder het icoon …
  const th = (await tip.boundingBox())!.height;
  expect(ib.y + ib.height + 6 + th, 'fixture: het icoon moet laag genoeg staan').toBeGreaterThan(vh - 6);
  // … dus staat hij erboven, helemaal in beeld, direct bij het icoon.
  await expectTipAtIcon(tip, info);
  await expect.poll(async () => {
    const tb = (await tip.boundingBox())!;
    return tb.y + tb.height <= ib.y + 0.5 && tb.y >= 0;
  }).toBe(true);
});
