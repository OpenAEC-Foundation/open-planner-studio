import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { barPoint, expect, seedProject, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';

test.use({ viewport: { width: 1600, height: 900 } });

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

async function expandAll(page: Page) {
  const closed = page.locator('[data-ops-assignment-expand="closed"]');
  const n = await closed.count();
  for (let i = 0; i < n; i++) await closed.first().click();
  await expect(page.locator('[data-ops-assignment-expand="open"]')).toHaveCount(n);
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
  await expect(input).toHaveAttribute('title', /1\.77777777777778/);

  await input.click();
  await expect(input).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).not.toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(input).toBeFocused();
  expect(await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, expected.length]);
  await page.keyboard.press('Tab');
  expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
  await input.click();
  await page.locator('[data-ops-assignment-name]').first().click();
  expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
  await expect(input).toHaveValue(expected);

  await input.click();
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
    const warnBox = (await warnRow.locator('[data-ops-assignment-work-deviates]').boundingBox())!;
    const workBox = (await warnRow.locator('[data-ops-assignment-work] input').boundingBox())!;
    expect(warnBox.x).toBeGreaterThanOrEqual(workBox.x);
    expect(warnBox.x + warnBox.width).toBeLessThanOrEqual(workBox.x + workBox.width);
    await expect(page.locator('[data-ops-assignment-move]')).toHaveCount(0);

    const measure = () => page.evaluate(() => {
      const rail = document.querySelector('[data-ops-rail]')!.getBoundingClientRect();
      const els = [...document.querySelectorAll<HTMLElement>(
        '[data-ops-assignment-row] input, [data-ops-assignment-row] button, [data-ops-assignment-row] .ops-select__value, [data-ops-assignment-row] .ops-select__value-text, [data-ops-assignment-add] .ops-select__value, [data-ops-assignment-lock-units], [data-ops-assignment-lock-work]',
      )];
      return {
        count: els.length,
        clipped: els.filter(el => el.scrollWidth > el.clientWidth + 0.5).map(el => el.outerHTML.slice(0, 100)),
        outside: els.filter(el => {
          const r = el.getBoundingClientRect();
          return r.width < 1 || r.left < rail.left - 0.5 || r.right > rail.right + 0.5;
        }).map(el => el.outerHTML.slice(0, 100)),
        curveText: [...document.querySelectorAll<HTMLElement>('[data-ops-assignment-curve] .ops-select__value')]
          .map(el => ({ text: el.textContent, fits: el.scrollWidth <= el.clientWidth + 0.5 })),
      };
    });
    const closed = await measure();
    expect(closed.count).toBeGreaterThan(7);
    expect(closed.clipped).toEqual([]);
    expect(closed.outside).toEqual([]);

    await expandAll(page);
    await expect(page.locator('[data-ops-assignment-move]')).toHaveCount(2);
    const report = await measure();
    expect(report.count).toBeGreaterThan(10);
    expect(report.clipped).toEqual([]);
    expect(report.outside).toEqual([]);
    expect(report.curveText.length).toBe(2);
    for (const c of report.curveText) expect(c.fits).toBe(true);
  });
}

for (const width of [280, 200]) {
  test(`regel: indeling bij paneelbreedte ${width} px`, async ({ page, ops: _ops }) => {
    const { unitsId, warnId } = await seedBlock(page, width);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.rightPanelWidth)).toBe(width);
    const header = page.locator('[data-ops-assignment-header]');
    await expect(header).toBeVisible();
    for (const id of [unitsId, warnId]) {
      const row = page.locator(`[data-ops-assignment-row="${id}"]`);
      const box = async (sel: string) => (await row.locator(sel).first().boundingBox())!;
      const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
      const name = await box('[data-ops-assignment-name]');
      const units = await box('input');
      const work = await box('[data-ops-assignment-work] input');
      const remove = await box('[data-ops-assignment-remove]');
      expect(Math.abs(mid(work) - mid(units))).toBeLessThan(3);
      expect(Math.abs(mid(remove) - mid(units))).toBeLessThan(3);
      if (width === 280) {
        expect(Math.abs(mid(name) - mid(units))).toBeLessThan(3);
      } else {
        expect(name.y + name.height).toBeLessThanOrEqual(units.y + 0.5);
      }
      const right = (b: { x: number; width: number }) => b.x + b.width;
      const hUnits = (await header.locator('[data-ops-assignment-lock-units]').boundingBox())!;
      const hWork = (await header.locator('[data-ops-assignment-lock-work]').boundingBox())!;
      expect(Math.abs(right(hUnits) - right(units))).toBeLessThan(1);
      expect(Math.abs(right(hWork) - right(work))).toBeLessThan(1);
    }
    const expand = page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-expand]`);
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'true');
    const details = page.locator(`[id="${await expand.getAttribute('aria-controls')}"]`);
    await expect(details).toHaveAttribute('data-ops-assignment-details');
    const unitsBox = (await page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first().boundingBox())!;
    expect((await details.boundingBox())!.y).toBeGreaterThanOrEqual(unitsBox.y + unitsBox.height - 0.5);
    await expand.click();
    await expect(details).toHaveCount(0);
  });
}

test('keuzelijsten: geen native select; curve, verplaatsen en toewijzen werken met muis en toetsenbord', async ({ page, ops: _ops }) => {
  const { taskId, otherId, unitsId, warnId } = await seedBlock(page, 280);
  const block = page.locator('[data-ops-assignment-row]');
  await expect(block).toHaveCount(2);
  await expect(page.locator('[data-ops-assignment-row] select, [data-ops-assignment-add] select')).toHaveCount(0);
  await expandAll(page);
  await expect(page.locator('[data-ops-assignment-row] select, [data-ops-assignment-add] select')).toHaveCount(0);

  const curve = page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-curve] button`);
  await curve.click();
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('listbox').locator('[data-value="BELL"]').click();
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.curve).toBe('BELL');
  await expect(curve).toHaveAttribute('data-value', 'BELL');

  await curve.focus();
  await page.keyboard.press('ArrowDown');
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(curve).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.curve).toBe('UNIFORM');
  await page.keyboard.press('Enter');
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(curve).toHaveAttribute('aria-expanded', 'false');
  expect((await assignmentOf(page, unitsId))!.curve).toBe('UNIFORM');

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

  const add = page.locator('[data-ops-assignment-add] button');
  await add.click();
  await page.getByRole('listbox').getByRole('option', { name: 'Opperman' }).click();
  await expect(block).toHaveCount(2);
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
  await page.evaluate((id) => {
    window.__OPS__!.store.setState(st => {
      const a = st.assignments.find(x => x.id === id)!;
      a.curve = 'FRONT_LOADED';
      a.curveValues = Array.from({ length: 21 }, (_, i) => 21 - i);
    });
  }, unitsId);
  await expect(page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-curve-mark]`)).toHaveAttribute('data-ops-assignment-curve-mark', 'FRONT_LOADED');
  const expand = page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-expand]`);
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  const curve = page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-curve] button`);
  await expect(curve).toHaveAttribute('data-value', 'FRONT_LOADED');
  expect((await assignmentOf(page, unitsId))!.curveValues).toBe(21);

  await curve.focus();
  await page.keyboard.press('Enter');
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(curve).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press(' ');
  await expect(curve).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press(' ');
  await expect(curve).toHaveAttribute('aria-expanded', 'false');
  await curve.click();
  await page.getByRole('listbox').locator('[data-value="FRONT_LOADED"]').click();
  await expect(curve).toHaveAttribute('aria-expanded', 'false');

  const after = (await assignmentOf(page, unitsId))!;
  expect([after.curve, after.curveValues]).toEqual(['FRONT_LOADED', 21]);
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
      await units.click();
      await units.press('Control+a');
      if (bad) await page.keyboard.type(bad); else await page.keyboard.press('Backspace');
      await expect(units).toHaveAttribute('aria-invalid', 'true');
      await page.keyboard.press('Enter');
      expect((await assignmentOf(page, unitsId))!.units, bad).toBe(EXACT);
      await expect(units).toHaveValue(shownUnits);
      await expect(units).toHaveAttribute('aria-invalid', 'false');
    }

    await work.click();
    await work.press('Control+a');
    await page.keyboard.type('1.234,5');
    await expect(work).toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.press('Tab');
    expect((await assignmentOf(page, warnId))!.work).toBe(before);
    await expect(work).toHaveValue('306');
    await expect(work).toHaveAttribute('aria-invalid', 'false');

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

const AMBIGUITY = {
  en: { bad: '1,500', badWork: '2,000', leadingZero: '01,500', ok: '1.5', zero: '0,500', hint: '"." (1.5)' },
  nl: { bad: '1.500', badWork: '15.000', leadingZero: '01.500', ok: '1,500', zero: '0.500', hint: '"," (1,5)' },
} as const;
for (const locale of ['en', 'nl'] as const) {
  const c = AMBIGUITY[locale];
  test(`invoer (${locale}): "${c.bad}" is dubbelzinnig en wordt geweigerd, "${c.ok}" en "${c.zero}" niet`, async ({ page, ops: _ops }) => {
    await useLocale(page, locale);
    const { unitsId, warnId } = await seedBlock(page, 280);
    const units = page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
    const work = page.locator(`[data-ops-assignment-row="${warnId}"] [data-ops-assignment-work] input`);
    const shown = locale === 'nl' ? '1,78' : '1.78';

    await units.click();
    await units.press('Control+a');
    await page.keyboard.type(c.bad);
    await expect(units).toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.press('Enter');
    const toast = page.locator('.ops-toast-message', { hasText: c.bad });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(c.hint);
    expect(await page.evaluate(() => {
      const n = window.__OPS__!.store.getState().ui.notifications
        .find(x => x.messageKey === 'notifications.ambiguousThousands');
      return n && { severity: n.severity, refusal: n.refusal === true };
    })).toEqual({ severity: 'error', refusal: true });
    expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
    await expect(units).toHaveValue(shown);

    await units.click();
    await units.press('Control+a');
    await page.keyboard.type(c.leadingZero);
    await expect(units).toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ops-toast-message', { hasText: c.leadingZero })).toBeVisible();
    expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);

    const workBefore = (await assignmentOf(page, warnId))!.work;
    await work.click();
    await work.press('Control+a');
    await page.keyboard.type(c.badWork);
    await expect(work).toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.press('Tab');
    expect((await assignmentOf(page, warnId))!.work).toBe(workBefore);
    await expect(page.locator('.ops-toast-message', { hasText: c.badWork })).toBeVisible();

    await units.click();
    await units.press('Control+a');
    await page.keyboard.type(c.ok);
    await expect(units).toHaveAttribute('aria-invalid', 'false');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await assignmentOf(page, unitsId))!.units).toBe(1.5);
    await units.click();
    await units.press('Control+a');
    await page.keyboard.type(c.zero);
    await expect(units).toHaveAttribute('aria-invalid', 'false');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await assignmentOf(page, unitsId))!.units).toBe(0.5);
  });
}

for (const key of ['Control+s', 'F5'] as const) {
  test(`inzet: ${key} commit één keer en houdt de focus; Backspace verwijdert de taak niet`, async ({ page, ops: _ops }) => {
    const { taskId, unitsId } = await seedBlock(page, 280);
    const units = page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
    const history = () => page.evaluate(() => window.__OPS__!.store.getState().historyEvents.length);
    await units.click();
    await units.press('Control+a');
    await page.keyboard.type('2.75');
    const before = await history();
    const download = key === 'Control+s' ? page.waitForEvent('download') : null;
    await page.keyboard.press(key);
    await download;
    expect((await assignmentOf(page, unitsId))!.units).toBe(2.75);
    expect(await history()).toBe(before + 1);
    await expect(units).toBeFocused();
    await page.keyboard.press('Backspace');
    expect(await page.evaluate((id) => window.__OPS__!.store.getState().tasks.some(t => t.id === id), taskId)).toBe(true);
    await expect(units).toHaveValue('2.7');
    await page.keyboard.press('Escape');
    expect((await assignmentOf(page, unitsId))!.units).toBe(2.75);
  });
}

for (const key of ['F5', 'Control+s'] as const) {
  test(`inzet: na ${key} zijn Ctrl+Z, Ctrl+Y en Escape van de app`, async ({ page, ops: _ops }) => {
    const { taskId, unitsId } = await seedBlock(page, 280);
    const units = page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
    await units.click();
    await units.press('Control+a');
    await page.keyboard.type('2.25');
    const download = key === 'Control+s' ? page.waitForEvent('download') : null;
    await page.keyboard.press(key);
    await download;
    expect((await assignmentOf(page, unitsId))!.units).toBe(2.25);
    await expect(units).toBeFocused();

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await assignmentOf(page, unitsId))!.units).toBe(EXACT);
    await expect(units).toHaveValue(/^1[.,]78$/);
    await page.keyboard.press('Control+y');
    await expect.poll(async () => (await assignmentOf(page, unitsId))!.units).toBe(2.25);
    await expect(units).toHaveValue(/^2[.,]25$/);

    expect(await page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([taskId]);
    await units.focus();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([]);
    expect((await assignmentOf(page, unitsId))!.units).toBe(2.25);
  });
}

test('inzet: een kleine geldige waarde toont meer cijfers en geen rode rand', async ({ page, ops: _ops }) => {
  const { unitsId } = await seedBlock(page, 280);
  await page.evaluate((id) => window.__OPS__!.store.getState().updateAssignment(id, { unitsPerDay: 0.004 }), unitsId);
  const units = page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
  await expect(units).toHaveValue(/^0[.,]004$/);
  await expect(units).toHaveAttribute('aria-invalid', 'false');
  await units.click();
  await page.keyboard.press('Tab');
  expect((await assignmentOf(page, unitsId))!.units).toBe(0.004);
  await expect(units).toHaveAttribute('aria-invalid', 'false');
});

test('curve: bij 200 px en 125 % in uk valt de knop binnen het paneel', async ({ page, ops: _ops }) => {
  await useLocale(page, 'uk');
  const { unitsId } = await seedBlock(page, 200);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiFontScale: 125 }));
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.rightPanelWidth)).toBe(200);
  await expandAll(page);
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
  const curve = page.locator(`[data-ops-assignment-row="${unitsId}"] [data-ops-assignment-curve] button`);
  await curve.click();
  await page.getByRole('listbox').locator('[data-value="BELL"]').click();
  await expect.poll(async () => (await assignmentOf(page, unitsId))!.curve).toBe('BELL');
});

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
  await units.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect((await assignmentOf(page, unitsId))!.units).toBe(EXACT);
});

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
  await work.click();
  await work.press('Control+a');
  await page.keyboard.type('0,02');
  await expect(work).toHaveAttribute('aria-invalid', 'false');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await assignmentOf(page, warnId))!.work).toBe(1);
});

test('documentwissel zonder blur (MCP-dupliceren): de open inzet landt in de bron, en de kopie volgt', async ({ page, ops: _ops }) => {
  const { unitsId } = await seedBlock(page, 280);
  await page.evaluate(() => window.__OPS__!.store.setState(st => { st.isDirty = false; }));
  const units = page.locator(`[data-ops-assignment-row="${unitsId}"] input`).first();
  await units.click();
  await units.press('Control+a');
  await page.keyboard.type('3');
  await expect(units).toBeFocused();
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const src = s.activeDocumentId;
    const copy = s.duplicateDocument();
    return { src, copy };
  });
  const read = () => page.evaluate(({ src, copy, id }) => {
    const docs = window.__OPS__!.store.getState().getOpenDocumentPayloads();
    const of = (doc: string) => docs.find(d => d.id === doc)!.payload;
    return {
      src: of(src).assignments.find(a => a.id === id)!.unitsPerDay,
      srcDirty: of(src).isDirty,
      copy: of(copy).assignments.find(a => a.id === id)!.unitsPerDay,
    };
  }, { ...ids, id: unitsId });
  expect(await read()).toEqual({ src: 3, srcDirty: true, copy: 3 });
  await expect(units).toHaveCount(0);
  expect(await read()).toEqual({ src: 3, srcDirty: true, copy: 3 });
});

for (const locale of ['nl', 'en', 'ar', 'fa'] as const) {
  for (const width of [280, 200]) {
    test(`werk (${locale}, ${width} px): 306,5 en 1234,5 passen in het veld, ook met de ⚠`, async ({ page, ops: _ops }) => {
      await useLocale(page, locale);
      const { warnId } = await seedBlock(page, width);
      const work = page.locator(`[data-ops-assignment-row="${warnId}"] [data-ops-assignment-work] input`);
      for (const minutes of [306.5 * 60, 1234.5 * 60]) {
        await page.evaluate(({ id, minutes }) => window.__OPS__!.store.setState(st => {
          st.assignments.find(x => x.id === id)!.remainingWorkMinutes = minutes;
        }), { id: warnId, minutes });
        await expect(work).toHaveValue(/^(306|1234)\D5$/);
        await expect(page.locator(`[data-ops-assignment-row="${warnId}"] [data-ops-assignment-work-deviates]`)).toBeVisible();
        const fit = await page.evaluate(() => {
          const rail = document.querySelector('[data-ops-rail]')!.getBoundingClientRect();
          return [...document.querySelectorAll<HTMLInputElement>('[data-ops-assignment-row] input')].map(el => {
            const r = el.getBoundingClientRect();
            return { value: el.value, fits: el.scrollWidth <= el.clientWidth + 0.5, inRail: r.left >= rail.left - 0.5 && r.right <= rail.right + 0.5 };
          }).filter(x => !x.fits || !x.inRail);
        });
        expect(fit).toEqual([]);
      }
    });
  }
}

for (const key of ['Control+s', 'F5'] as const) {
  test(`automatisch berekenen: ${key} in het inzetveld rekent door en blokkeert daarna niet`, async ({ page, ops: _ops }) => {
    const [taskId] = await seedProject(page, [
      { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
    ]);
    const asgId = await page.evaluate((id) => {
      const s = window.__OPS__!.store.getState();
      const r = s.addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 4 });
      s.assignResource(id, r, 1);
      s.updateTask(id, { manuallyScheduled: false });
      s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, showTaskTypes: true, rightPanelWidth: 280, autoCalcCPM: true });
      s.setTaskWorkRule(id, 'FIXED_WORK');
      s.runCPM();
      s.selectTask(id);
      return window.__OPS__!.store.getState().assignments.find(a => a.taskId === id)!.id;
    }, taskId);
    const state = () => page.evaluate((id) => {
      const s = window.__OPS__!.store.getState();
      const t = s.tasks.find(x => x.id === id)!;
      return { finish: t.time.earlyFinish.slice(0, 10), stale: s.scheduleStale };
    }, taskId);
    expect(await state()).toEqual({ finish: '2026-09-10', stale: false });

    const units = page.locator(`[data-ops-assignment-row="${asgId}"] input`).first();
    await units.click();
    await units.press('Control+a');
    await page.keyboard.type('2');
    const download = key === 'Control+s' ? page.waitForEvent('download') : null;
    await page.keyboard.press(key);
    expect(await state()).toEqual({ finish: '2026-09-08', stale: false });
    if (download) {
      const ifc = readFileSync((await (await download).path())!, 'utf8');
      const taskTime = ifc.split('\n').find(l => l.includes("IFCTASKTIME('Metselwerk Time'"))!;
      expect(taskTime).toContain("'PT16H0M0S','2026-09-07T07:00:00','2026-09-08T16:00:00','2026-09-07T07:00:00','2026-09-08T16:00:00'");
    }
    await expect(units).toBeFocused();

    await page.evaluate(() => window.__OPS__!.store.setState(st => { st.scheduleStale = true; }));
    await expect.poll(() => state().then(s => s.stale), { timeout: 3000 }).toBe(false);
    await expect(units).toBeFocused();
  });
}

async function seedFixedWorkAutoCalc(page: Page) {
  const [taskId] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
  ]);
  const asgId = await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const r = s.addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 4 });
    s.assignResource(id, r, 1);
    s.updateTask(id, { manuallyScheduled: false });
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, showTaskTypes: true, rightPanelWidth: 280, autoCalcCPM: true });
    s.setTaskWorkRule(id, 'FIXED_WORK');
    s.runCPM();
    window.__OPS__!.store.setState(st => { st.isDirty = false; });
    s.selectTask(id);
    return window.__OPS__!.store.getState().assignments.find(a => a.taskId === id)!.id;
  }, taskId!);
  return { taskId: taskId!, asgId };
}

test('afsluiten met de focus in het inzetveld: de invoer staat in de store en de sluitvraag komt', async ({ page, ops: _ops }) => {
  const { asgId } = await seedFixedWorkAutoCalc(page);
  const units = page.locator(`[data-ops-assignment-row="${asgId}"] input`).first();
  await units.click();
  await units.press('Control+a');
  await page.keyboard.type('3');
  await expect(units).toBeFocused();
  const dialogs: string[] = [];
  page.on('dialog', (d) => { dialogs.push(d.type()); void d.dismiss(); });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => dialogs).toEqual(['beforeunload']);
  expect(page.isClosed()).toBe(false);
  expect(await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    return { units: s.assignments.find(a => a.id === id)!.unitsPerDay, dirty: s.isDirty };
  }, asgId)).toEqual({ units: 3, dirty: true });
});

test('MCP-dupliceren met open inzet en automatisch berekenen: de kopie rekent door, Ctrl+S slaat het nieuwe einde op', async ({ page, ops: _ops }) => {
  const { taskId, asgId } = await seedFixedWorkAutoCalc(page);
  const units = page.locator(`[data-ops-assignment-row="${asgId}"] input`).first();
  await units.click();
  await units.press('Control+a');
  await page.keyboard.type('2');
  await expect(units).toBeFocused();
  await page.evaluate(() => window.__OPS__!.store.getState().duplicateDocument());
  await expect(units).toHaveCount(0);
  const copyState = () => page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.id === id)!;
    return { duration: t.time.scheduleDuration, finish: t.time.earlyFinish.slice(0, 10), stale: s.scheduleStale };
  }, taskId);
  await expect.poll(copyState, { timeout: 3000 }).toEqual({ duration: 2, finish: '2026-09-08', stale: false });

  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const ifc = readFileSync((await (await download).path())!, 'utf8');
  const taskTime = ifc.split('\n').find(l => l.includes("IFCTASKTIME('Metselwerk Time'"))!;
  expect(taskTime).toContain("'PT16H0M0S','2026-09-07T07:00:00','2026-09-08T16:00:00','2026-09-07T07:00:00','2026-09-08T16:00:00'");
});

test('F5 in het inzetveld met automatisch berekenen: één berekening', async ({ page, ops: _ops }) => {
  const { asgId } = await seedFixedWorkAutoCalc(page);
  await page.evaluate(() => {
    let solves = 0;
    window.__OPS__!.store.subscribe((s, p) => { if (s.cpmResult !== p.cpmResult) solves++; });
    Object.defineProperty(window, '__f5Solves', { configurable: true, get: () => solves });
  });
  const solves = () => page.evaluate(() => (window as unknown as { __f5Solves: number }).__f5Solves);
  const units = page.locator(`[data-ops-assignment-row="${asgId}"] input`).first();
  await units.click();
  await units.press('Control+a');
  await page.keyboard.type('2');
  await page.keyboard.press('F5');
  await page.waitForTimeout(400);
  expect(await solves()).toBe(1);
});
