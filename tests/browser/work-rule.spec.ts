import type { Page } from '@playwright/test';
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
  await select.selectOption('FIXED_WORK');
  let st = await taskState(page, taskId);
  expect(st.workRule).toBe('FIXED_WORK');
  expect(st.duration).toBe(4);
  expect(st.work).toBe(4 * 8 * 60);
  await expect(page.locator('[data-ops-work-rule-protects]')).toHaveAttribute('data-ops-work-rule-protects', 'FIXED_WORK');
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
  await select.selectOption('');
  st = await taskState(page, taskId);
  expect(st.workRule).toBeUndefined();
  expect(st.work).toBe(64 * 60);
});

test('taakdialoog: werkregel kiezen commit direct, werk typen in dezelfde dialoog rekent met die regel, Opslaan draait de duur niet terug', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  const dialog = page.locator('[role="dialog"]').last();
  await expect(dialog).toBeVisible();
  const select = dialog.locator('[data-ops-work-rule]');
  await select.selectOption('FIXED_WORK');
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
  await expect(page.locator('[data-ops-work-rule]')).toHaveValue('FIXED_RATE');
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
      helpArticleId: 'gids-rekenprofielen',
      detailLines: [{ messageKey: 'notifications.taskTypesUnlockedDetail', helpArticleId: 'gids-taaktypes', linkKey: 'notifications.workRulesReadMore' }],
    });
  });
  const link = page.locator('[data-ops-toast-detail-link="gids-taaktypes"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.backstageSection)).toBe('help');
  const titles = await page.evaluate(async () => {
    const m = await (await fetch(new URL('docs/manifest.json', document.baseURI))).json() as { articles: { id: string; title: Record<string, string> }[] };
    return m.articles.find(a => a.id === 'gids-taaktypes')!.title;
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
  await dialog.locator('[data-ops-work-rule]').selectOption('FIXED_DURATION_WORK');
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
  await dialog.locator('[data-ops-work-rule]').selectOption('FIXED_DURATION_WORK');
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

// Gebruikstest #170, E5/G6: de instelling heet "Toon werkregels en werk", staat onder Berekenen
// (geen eigen sectiekop) en haar toelichting is één zin in een gekleurd blok (accentbalk), geen
// los bijschrift; in het paneel staan "Beschermd: …" en het MS Project-vinkje in datzelfde blok.
test('instelling en paneel: werkregel-toelichting in een gekleurd blok, instelling onder Berekenen', async ({ page, ops: _ops }) => {
  await seedAssignedTask(page);
  const note = page.locator('[data-ops-work-rule-note]');
  await expect(note).toBeVisible();
  await expect(note.locator('[data-ops-work-rule-protects]')).toBeVisible();
  expect(await note.evaluate(el => getComputedStyle(el).boxShadow)).toContain('inset');

  await page.getByTitle(/^(Settings|Instellingen)$/, { exact: true }).click();
  const dlg = page.locator('.settings-dialog');
  await dlg.locator('.settings-tab').filter({ hasText: /^Planning$/ }).click();
  const box = dlg.locator('[data-ops-setting-show-task-types]');
  const row = box.locator('xpath=ancestor::label[1]');
  await expect(row).toHaveText(/^(Show work rules and work|Toon werkregels en werk)$/);
  const section = row.locator('xpath=ancestor::div[contains(@class,"settings-section")][1]');
  await expect(section.locator('> h3')).toHaveText(/^(Calculation|Berekenen)$/);
  const settingNote = section.locator('[data-ops-setting-show-task-types-note]');
  await expect(settingNote).toBeVisible();
  expect(await settingNote.evaluate(el => getComputedStyle(el).boxShadow)).toContain('inset');
  // Geen los grijs bijschrift direct onder het vinkje.
  expect(await row.evaluate(el => el.nextElementSibling?.classList.contains('scrollzoom-hint') ?? false)).toBe(false);
});

// Gebruikstest #170, G2: "taaktype" betekende drie dingen. De werkregelkolom heet Werkregel en is
// op die naam te vinden; de bewaarde MS Project-waarde heet "MS Project-taaktype (import)".
test('kolomkiezer: zoeken op werkregel vindt de kolom; de MS Project-kolom heet "(import)"', async ({ page, ops: _ops }) => {
  await seedAssignedTask(page);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const shell = page.locator('[data-task-grid-surface-id="full-task-grid"] .task-grid-shell');
  await shell.locator('.task-grid-add-column').click();
  const search = page.locator('.task-grid-column-chooser-search input');
  await expect(search).toBeVisible();
  const nl = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl');
  const results = page.locator('section[aria-label]').filter({ has: page.locator('.task-grid-column-chooser-section-label') }).last();
  await search.fill(nl ? 'werkregel' : 'work rule');
  await expect(results.getByText(nl ? 'Werkregel' : 'Work rule', { exact: true })).toBeVisible();
  await search.fill(nl ? 'taaktype' : 'task type');
  await expect(results.getByText(nl ? 'MS Project-taaktype (import)' : 'MS Project task type (import)', { exact: true })).toBeVisible();
});

// E7 (orkestratorbesluit 25-09, gebruikstest #170 G4): opgeslagen werk dat afwijkt van inzet × duur
// (P6-toewijzing met een eigen spanne, EC2370: 30 u naast 90 u) krijgt in de werkcel een markering
// met beide getallen; de inzet wordt niet stil aangepast. Fixture: het werkveld zoals de XER-lezer
// het zet (via de brug); gelijk aan inzet × duur ⇒ geen markering.
test('werkcel: opgeslagen werk dat afwijkt van inzet × duur is gemarkeerd, inzet blijft', async ({ page, ops: _ops }) => {
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
