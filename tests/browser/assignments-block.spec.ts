import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';

// Het blok *Toewijzingen* in het taakpaneel (eigenaar 2026-10-15, testversie met Roads A10530):
// 1. de inzet toont hooguit twee decimalen; de opgeslagen waarde blijft exact tot de gebruiker hem
//    zelf wijzigt;
// 2. bij de standaard- én de smalste paneelbreedte is geen veld of knop afgeknipt, ook niet in een
//    rij met ⚠ (afwijkend opgeslagen werk);
// 3. curve, "Verplaatsen naar…" en "Resource toewijzen" zijn de eigen keuzelijst, nooit native.
// De brug zet alleen fixtures (taken, resources, toewijzingen, paneelbreedte) en leest state; de
// geteste handelingen zijn echte klikken en toetsaanslagen.

const EXACT = 1.77777777777778;

async function seedBlock(page: Page, panelWidth: number) {
  const [taskId, otherId] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
    { name: 'Voegwerk', start: '2026-09-11', finish: '2026-09-14', durationDays: 2 },
  ]);
  const ids = await page.evaluate(({ id, panelWidth, exact }) => {
    const ops = window.__OPS__!;
    const s = ops.store.getState();
    const a = s.addResource({ name: 'Transit mixer', type: 'LABOR', description: '', maxUnits: 4 });
    const b = s.addResource({ name: 'Foreman', type: 'LABOR', description: '', maxUnits: 4 });
    s.addResource({ name: 'Opperman', type: 'LABOR', description: '', maxUnits: 4 });
    s.assignResource(id, a, 1);
    s.assignResource(id, b, 1);
    const [asgA, asgB] = ops.store.getState().assignments.filter(x => x.taskId === id);
    s.updateAssignment(asgA.id, { unitsPerDay: exact });
    // Fixture: opgeslagen restwerk dat afwijkt van inzet × restduur ⇒ ⚠ op de rij van Foreman,
    // zoals na een P6-import.
    ops.store.setState(st => {
      const target = st.assignments.find(x => x.id === asgB.id)!;
      target.remainingWorkMinutes = 306 * 60;
    });
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, showTaskTypes: true, rightPanelWidth: panelWidth });
    s.selectTask(id);
    return { unitsId: asgA.id, warnId: asgB.id };
  }, { id: taskId, panelWidth, exact: EXACT });
  return { taskId, otherId, ...ids };
}

const assignmentOf = (page: Page, id: string) => page.evaluate(
  (aid) => {
    const a = window.__OPS__!.store.getState().assignments.find(x => x.id === aid);
    return a ? {
      units: a.unitsPerDay, curve: a.curve ?? 'UNIFORM', taskId: a.taskId,
      curveValues: a.curveValues?.length ?? 0, work: a.remainingWorkMinutes,
    } : null;
  },
  id,
);

/** App-taal kiezen zoals een gebruiker die hem eerder koos (opgeslagen voorkeur), daarna herladen. */
async function useLocale(page: Page, locale: string) {
  await page.evaluate((l) => localStorage.setItem('ops-locale', l), locale);
  await page.reload();
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale);
}

test('inzet: toont twee decimalen, focus en blur zonder wijziging laten de opslag exact', async ({ page, ops: _ops }) => {
  const { unitsId } = await seedBlock(page, 280);
  const row = page.locator(`[data-ops-assignment-row="${unitsId}"]`);
  const input = row.locator('input').first();
  const lang = await page.evaluate(() => document.documentElement.lang);
  const expected = new Intl.NumberFormat(`${lang}-u-nu-latn`, { maximumFractionDigits: 2, useGrouping: false }).format(EXACT);
  await expect(input).toHaveValue(expected);
  expect(expected).toMatch(/^1[.,]78$/);
  // De title draagt de exacte waarde.
  await expect(input).toHaveAttribute('title', /1\.77777777777778/);

  // Klik erin, verlaat met Tab: geen wijziging ⇒ de opslag blijft exact.
  await input.click();
  await expect(input).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).not.toBeFocused();
  expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
  // Nog een keer met een klik ernaast als blur.
  await input.click();
  await page.locator('[data-ops-assignment-name]').first().click();
  expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
  await expect(input).toHaveValue(expected);

  // Een echte wijziging commit wel, ook met een komma als decimaalteken.
  await input.click();
  await input.press('Control+a');
  await page.keyboard.type('2,5');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.units).toBe(2.5);
});

for (const width of [280, 200]) {
  test(`rij: niets afgeknipt bij paneelbreedte ${width} px, ook in een rij met ⚠`, async ({ page, ops: _ops }) => {
    const { warnId } = await seedBlock(page, width);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.rightPanelWidth)).toBe(width);
    const warnRow = page.locator(`[data-ops-assignment-row="${warnId}"]`);
    await expect(warnRow.locator('[data-ops-assignment-work-deviates]')).toBeVisible();
    // Elke toewijzingsrij heeft een "Verplaatsen naar…" (Voegwerk is een kandidaat).
    await expect(page.locator('[data-ops-assignment-move]')).toHaveCount(2);

    const report = await page.evaluate(() => {
      const rail = document.querySelector('[data-ops-rail]')!.getBoundingClientRect();
      const els = [...document.querySelectorAll<HTMLElement>(
        '[data-ops-assignment-row] input, [data-ops-assignment-row] button, [data-ops-assignment-row] .ops-select__value, [data-ops-assignment-row] .ops-select__value-text, [data-ops-assignment-add] .ops-select__value',
      )];
      return {
        count: els.length,
        clipped: els.filter(el => el.scrollWidth > el.clientWidth + 0.5).map(el => el.outerHTML.slice(0, 100)),
        outside: els.filter(el => {
          const r = el.getBoundingClientRect();
          return r.width < 1 || r.left < rail.left - 0.5 || r.right > rail.right + 0.5;
        }).map(el => el.outerHTML.slice(0, 100)),
        // De zichtbare curvetekst in de trigger: hele label, geen ellips.
        curveText: [...document.querySelectorAll<HTMLElement>('[data-ops-assignment-curve] .ops-select__value-text')]
          .map(el => ({ text: el.textContent, fits: el.scrollWidth <= el.clientWidth + 0.5 })),
      };
    });
    expect(report.count).toBeGreaterThan(10);
    expect(report.clipped).toEqual([]);
    expect(report.outside).toEqual([]);
    expect(report.curveText.length).toBe(2);
    for (const c of report.curveText) expect(c.fits).toBe(true);
  });
}

test('keuzelijsten: geen native select; curve, verplaatsen en toewijzen werken met muis en toetsenbord', async ({ page, ops: _ops }) => {
  const { taskId, otherId, unitsId, warnId } = await seedBlock(page, 280);
  const block = page.locator('[data-ops-assignment-row]');
  await expect(block).toHaveCount(2);
  // In het hele paneel staat in dit blok geen enkele native keuzelijst meer.
  await expect(page.locator('[data-ops-assignment-row] select, [data-ops-assignment-add] select')).toHaveCount(0);

  // Curve met de muis: trigger openen, optie aanklikken.
  const curve = page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-curve] button`);
  await curve.click();
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('listbox').locator('[data-value="BELL"]').click();
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.curve).toBe('BELL');
  await expect(curve).toHaveAttribute('data-value', 'BELL');

  // Curve met het toetsenbord: focus, ArrowDown opent, Home + Enter kiest de eerste vorm (Uniform).
  await curve.focus();
  await page.keyboard.press('ArrowDown');
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(curve).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.curve).toBe('UNIFORM');
  // Escape sluit zonder keuze.
  await page.keyboard.press('Enter');
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(curve).toHaveAttribute('aria-expanded', 'false');
  expect((await assignmentOf(page, unitsId))!.curve).toBe('UNIFORM');

  // Verplaatsen met het toetsenbord: focus bouwt de lijst, Enter opent. Een lijst met plaatshouder
  // opent zonder actieve optie (#370): Enter kiest dan niets, eerst Pijl-omlaag naar Voegwerk.
  const move = page.locator(`[data-ops-assignment-row="${warnId}"] [data-ops-assignment-move]`);
  const moveTrigger = move.getByRole('button');
  await moveTrigger.focus();
  await expect(move).toHaveAttribute('data-ops-assignment-move', 'open');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await assignmentOf(page, warnId))!.taskId).toBe(otherId);
  await expect(block).toHaveCount(1);

  // Resource toewijzen met de muis: Foreman staat weer vrij, Opperman ook.
  const add = page.locator('[data-ops-assignment-add] button');
  await add.click();
  await page.getByRole('listbox').getByRole('option', { name: 'Opperman' }).click();
  await expect(block).toHaveCount(2);
  // En met het toetsenbord: Foreman (plaatshouder ⇒ geen actieve optie, eerst Pijl-omlaag).
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(block).toHaveCount(3);
  const names = await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    return s.assignments.filter(a => a.taskId === id).map(a => s.resources.find(r => r.id === a.resourceId)!.name).sort();
  }, taskId);
  expect(names).toEqual(['Foreman', 'Opperman', 'Transit mixer']);
});

test('curve: dezelfde curve opnieuw kiezen laat de geïmporteerde P6-curve staan', async ({ page, ops: _ops }) => {
  const { unitsId } = await seedBlock(page, 280);
  // Fixture: een P6-import met naamterugval én de exacte 21 waarden.
  await page.evaluate((id) => {
    window.__OPS__!.store.setState(st => {
      const a = st.assignments.find(x => x.id === id)!;
      a.curve = 'FRONT_LOADED';
      a.curveValues = Array.from({ length: 21 }, (_, i) => 21 - i);
    });
  }, unitsId);
  const curve = page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-curve] button`);
  await expect(curve).toHaveAttribute('data-value', 'FRONT_LOADED');
  expect((await assignmentOf(page, unitsId))!.curveValues).toBe(21);

  // Enter + Enter: openen, de actieve (huidige) optie kiezen.
  await curve.focus();
  await page.keyboard.press('Enter');
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(curve).toHaveAttribute('aria-expanded', 'false');
  // Spatie + Spatie.
  await page.keyboard.press(' ');
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press(' ');
  await expect(curve).toHaveAttribute('aria-expanded', 'false');
  // Klik op dezelfde optie.
  await curve.click();
  await page.getByRole('listbox').locator('[data-value="FRONT_LOADED"]').click();
  await expect(curve).toHaveAttribute('aria-expanded', 'false');

  const after = (await assignmentOf(page, unitsId))!;
  expect([after.curve, after.curveValues]).toEqual(['FRONT_LOADED', 21]);
  // Een ándere curve vervangt de importcurve wél (bestaand gedrag).
  await curve.click();
  await page.getByRole('listbox').locator('[data-value="BELL"]').click();
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.curveValues).toBe(0);
});

for (const locale of ['nl', 'en']) {
  test(`invoer (${locale}): onzin commit niet, krijgt een rode rand en laat de oude waarde staan`, async ({ page, ops: _ops }) => {
    await useLocale(page, locale);
    const { unitsId, warnId } = await seedBlock(page, 280);
    const units = page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
    const work = page.locator(`[data-ops-assignment-row="${warnId}"] [data-ops-assignment-work] input`);
    const before = (await assignmentOf(page, warnId))!.work;
    expect(before).toBe(306 * 60);
    const shownUnits = locale === 'nl' ? '1,78' : '1.78';
    await expect(units).toHaveValue(shownUnits);
    await expect(units).toHaveAttribute('aria-invalid', 'false');

    for (const bad of ['1.234,5', '1,234.5', '2x', '1e3', '-2', '']) {
      // Echt typen, teken voor teken: ook een geldig voorvoegsel ("1.234") mag niet committen.
      await units.click();
      await units.press('Control+a');
      if (bad) await page.keyboard.type(bad); else await page.keyboard.press('Backspace');
      await expect(units).toHaveAttribute('aria-invalid', 'true');
      await page.keyboard.press('Enter');
      expect((await assignmentOf(page, unitsId))!.units, bad).toBe(EXACT);
      // Na het verlaten staat de opgeslagen waarde er weer, zonder rode rand.
      await expect(units).toHaveValue(shownUnits);
      await expect(units).toHaveAttribute('aria-invalid', 'false');
    }

    // Werk: "1.234,5" werd eerder 1.234 uur = 74 min.
    await work.click();
    await work.press('Control+a');
    await page.keyboard.type('1.234,5');
    await expect(work).toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.press('Tab');
    expect((await assignmentOf(page, warnId))!.work).toBe(before);
    await expect(work).toHaveValue('306');
    await expect(work).toHaveAttribute('aria-invalid', 'false');

    // Escape zet terug zonder commit; een geldige waarde met het andere decimaalteken commit wel.
    await units.click();
    await units.press('Control+a');
    await page.keyboard.type('3');
    await page.keyboard.press('Escape');
    expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
    await units.click();
    await units.press('Control+a');
    await page.keyboard.type(locale === 'nl' ? '0.5' : '0,5');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await assignmentOf(page, unitsId))!.units).toBe(0.5);
  });
}

test('inzet: een kleine geldige waarde toont meer cijfers en geen rode rand', async ({ page, ops: _ops }) => {
  const { unitsId } = await seedBlock(page, 280);
  await page.evaluate((id) => window.__OPS__!.store.getState().updateAssignment(id, { unitsPerDay: 0.004 }), unitsId);
  const units = page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
  await expect(units).toHaveValue(/^0[.,]004$/);
  await expect(units).toHaveAttribute('aria-invalid', 'false');
  // Focussen en verlaten wijzigt niets.
  await units.click();
  await page.keyboard.press('Tab');
  expect((await assignmentOf(page, unitsId))!.units).toBe(0.004);
  await expect(units).toHaveAttribute('aria-invalid', 'false');
});

test('curve: bij 200 px en 125 % in uk valt de knop binnen het paneel', async ({ page, ops: _ops }) => {
  await useLocale(page, 'uk');
  const { unitsId } = await seedBlock(page, 200);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiFontScale: 125 }));
  // Het paneel draagt de veldenregel; de rand van de rail is de rand van het paneel.
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.rightPanelWidth)).toBe(200);
  const report = await page.evaluate(() => {
    const rail = document.querySelector('[data-ops-rail]')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('[data-ops-assignment-curve] button, [data-ops-assignment-contour]')]
      .map(el => {
        const r = el.getBoundingClientRect();
        return { left: r.left >= rail.left - 0.5, right: r.right <= rail.right + 0.5, width: r.width };
      });
  });
  expect(report.length).toBe(4);
  for (const r of report) {
    expect(r.left).toBe(true);
    expect(r.right).toBe(true);
    expect(r.width).toBeGreaterThan(10);
  }
  // De curve blijft werken (krimpt met een ellips, maar opent en kiest).
  const curve = page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-curve] button`);
  await curve.click();
  await page.getByRole('listbox').locator('[data-value="BELL"]').click();
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.curve).toBe('BELL');
});

// Een taakwissel verwijdert de rij vóór de browser een blur stuurt. De getypte waarde moet dan
// toch in de store landen (op main commitde de inzet per toetsaanslag; het werkveld verloor hem al).
for (const via of ['raster', 'gantt'] as const) {
  for (const field of ['inzet', 'werk'] as const) {
    test(`taakwissel via ${via}: getypte ${field} zonder Enter blijft bewaard`, async ({ page, ops: _ops }) => {
      const { otherId, unitsId, warnId } = await seedBlock(page, 280);
      const input = field === 'inzet'
        ? page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first()
        : page.locator(`[data-ops-assignment-row="${warnId}"] [data-ops-assignment-work] input`);
      await input.click();
      await input.press('Control+a');
      await page.keyboard.type(field === 'inzet' ? '3' : '200');
      if (via === 'raster') {
        await page.locator('.full-task-grid-name-label', { hasText: 'Voegwerk' }).first().click();
      } else {
        const p = await barPoint(page, otherId);
        await page.mouse.click(p.x, p.y);
      }
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([otherId]);
      if (field === 'inzet') {
        await expect.poll(async () => (await assignmentOf(page, unitsId))!.units).toBe(3);
      } else {
        await expect.poll(async () => (await assignmentOf(page, warnId))!.work).toBe(200 * 60);
      }
    });
  }
}

async function openDialogFor(page: Page, taskId: string) {
  await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  const dialog = page.locator('[data-ops-task-dialog]');
  await expect(dialog).toBeVisible();
  // TaskDialog zet kort na openen de focus op het naamveld; wacht daarop.
  await expect(dialog.locator('input:focus')).toHaveCount(1);
  return dialog;
}

test('taakdialoog: Escape met een draft zet alleen het veld terug, de tweede Escape sluit', async ({ page, ops: _ops }) => {
  const { taskId, unitsId } = await seedBlock(page, 280);
  const dialog = await openDialogFor(page, taskId);
  const units = dialog.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
  const shown = await units.inputValue();
  await units.click();
  await units.press('Control+a');
  await page.keyboard.type('3');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(units).toHaveValue(shown);
  expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
  // Zonder draft is Escape weer van de dialoog.
  await units.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
});

// Bewuste keuze (fixronde 2): Enter is van het veld, zoals het duurveld en het werkveld. De dialoog
// blijft open; Opslaan of Enter buiten een veld slaat op.
test('taakdialoog: Enter in het inzetveld commit het veld, de dialoog blijft open', async ({ page, ops: _ops }) => {
  const { taskId, unitsId } = await seedBlock(page, 280);
  const dialog = await openDialogFor(page, taskId);
  const units = dialog.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
  await units.click();
  await units.press('Control+a');
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.units).toBe(3);
  await expect(units).not.toBeFocused();
  await expect(dialog).toBeVisible();
});

test('inzet: één teken wissen en terugtypen rondt de opslag niet af', async ({ page, ops: _ops }) => {
  const { unitsId } = await seedBlock(page, 280);
  const units = page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
  await units.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('8');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
});

test('werk: een waarde die tot 0 minuten afrondt is ongeldig', async ({ page, ops: _ops }) => {
  const { warnId } = await seedBlock(page, 280);
  const work = page.locator(`[data-ops-assignment-row="${warnId}"] [data-ops-assignment-work] input`);
  await work.click();
  await work.press('Control+a');
  await page.keyboard.type('0,004');
  await expect(work).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Tab');
  expect((await assignmentOf(page, warnId))!.work).toBe(306 * 60);
  await expect(work).toHaveAttribute('aria-invalid', 'false');
  // Eén minuut (1/60 uur ≈ 0,017) mag wel.
  await work.click();
  await work.press('Control+a');
  await page.keyboard.type('0,02');
  await expect(work).toHaveAttribute('aria-invalid', 'false');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await assignmentOf(page, warnId))!.work).toBe(1);
});
