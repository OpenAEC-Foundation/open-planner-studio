import { expect, seedProject, test } from './fixtures/ops';

const staleText = /Out of date — recalculate \(F5\)|Verouderd — herbereken \(F5\)/;

test('automatisch berekenen verbergt alleen de tijdelijke stale-indicator', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Eerste S1-taak', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Tweede S1-taak', start: '2026-09-21', finish: '2026-10-02' },
  ]);

  // Bewaak de zichtbare DOM gedurende de hele automatische berekening. Alleen de fixture en
  // instellingen gaan via de brug; de geteste statusbalk blijft gewone gerenderde UI.
  await page.evaluate(() => {
    let staleAppearances = 0;
    const count = () => {
      if (Array.from(document.querySelectorAll('span')).some(span => (
        /Out of date — recalculate \(F5\)|Verouderd — herbereken \(F5\)/.test(span.textContent ?? '')
      ))) staleAppearances++;
    };
    const observer = new MutationObserver(count);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    Object.defineProperty(window, '__s1StaleAppearances', { configurable: true, get: () => staleAppearances });
    const store = window.__OPS__!.store.getState();
    store.setUI({ autoCalcCPM: true });
  });

  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const nameCell = page.locator(`[data-testid="task-cell"][data-task-id="${first}"][data-field-key="name"]`);
  await nameCell.locator('.cursor-text').click();
  await nameCell.locator('input').fill('Eerste S1-taak automatisch');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  expect(await page.evaluate(() => (
    window as unknown as Window & { __s1StaleAppearances: number }
  ).__s1StaleAppearances)).toBe(0);

  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    store.setUI({ autoCalcCPM: false });
  });
  await nameCell.locator('.cursor-text').click();
  await nameCell.locator('input').fill('Eerste S1-taak handmatig');
  await page.keyboard.press('Enter');
  await expect(page.getByText(staleText)).toBeVisible();
  await page.waitForTimeout(150);
  await expect(page.getByText(staleText)).toBeVisible();

  await page.evaluate((taskIds) => {
    const store = window.__OPS__!.store.getState();
    store.setUI({ autoCalcCPM: true });
    store.addSequence({ predecessorId: taskIds[0], successorId: taskIds[1], type: 'FINISH_START', lagDays: 0 });
    store.addSequence({ predecessorId: taskIds[1], successorId: taskIds[0], type: 'FINISH_START', lagDays: 0 });
  }, [first, second]);
  await expect.poll(() => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { stale: s.scheduleStale, error: s.cpmResult?.error ?? null };
  })).toEqual({ stale: true, error: expect.any(String) });
  await expect(page.getByText(staleText)).toBeVisible();
});
