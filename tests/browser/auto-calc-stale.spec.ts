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
  const durationCell = page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${first}"][data-grid-column-id="task.time.scheduleDuration"]`,
  );
  await durationCell.click();
  await page.keyboard.press('Enter');
  await durationCell.locator('input').fill('9d');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  expect(await page.evaluate(() => (
    window as unknown as Window & { __s1StaleAppearances: number }
  ).__s1StaleAppearances)).toBe(0);

  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    store.setUI({ autoCalcCPM: false });
  });
  await durationCell.click();
  await page.keyboard.press('Enter');
  await durationCell.locator('input').fill('8d');
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

// Review taakmutaties, bijvangst A: een mislukte berekening pushte een melding, die melding wijzigde
// de store en automatisch berekenen rekende meteen opnieuw — ~10 solves per seconde, teller ×42 in
// 3 s. De kring komt als ruwe data binnen (zoals uit een geopend bestand) en Berekenen laat hem één
// keer falen; daarna gaat alles via echte klikken en toetsen: automatisch berekenen aanzetten in de
// instellingen mag bij dezelfde invoer niets herhalen, en een echte bewerking in de Tabel mag
// precies één nieuwe poging geven.
test('automatisch berekenen herhaalt een mislukte berekening niet tot de invoer verandert', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Eerste kringtaak', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Tweede kringtaak', start: '2026-09-21', finish: '2026-10-02' },
  ]);
  await page.evaluate(([a, b]) => {
    const bridge = window.__OPS__!;
    bridge.store.setState((s) => {
      s.sequences.push({ id: 'seq-kring-1', predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
      s.sequences.push({ id: 'seq-kring-2', predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
    });
    let solves = 0;
    bridge.store.subscribe((s, p) => { if (s.cpmResult !== p.cpmResult) solves++; });
    Object.defineProperty(window, '__autoCalcSolves', { configurable: true, get: () => solves });
  }, [first, second]);
  const solves = () => page.evaluate(() => (window as unknown as { __autoCalcSolves: number }).__autoCalcSolves);
  const toast = page.locator('.ops-toast.toast-error');

  await page.locator('.ribbon-content').getByRole('button', { name: /^(Calculate|Berekenen)$/ }).click();
  await expect(toast).toHaveCount(1);
  await expect(toast.locator('.ops-toast-count')).toHaveCount(0);
  expect(await solves()).toBe(1);

  await page.getByTitle(/^(Settings|Instellingen)$/, { exact: true }).click();
  const dialog = page.locator('.settings-dialog');
  await dialog.locator('.settings-tab').filter({ hasText: /^Planning$/ }).click();
  await dialog.getByLabel(/^(Calculate automatically|Automatisch berekenen)$/).check();
  await dialog.locator('.modal-close-btn').click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(1_500);
  expect(await solves(), 'aanzetten bij dezelfde mislukte invoer rekent niet opnieuw').toBe(1);
  await expect(toast.locator('.ops-toast-count')).toHaveCount(0);

  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const durationCell = page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${first}"][data-grid-column-id="task.time.scheduleDuration"]`,
  );
  await durationCell.click();
  await page.keyboard.press('Enter');
  await durationCell.locator('input').fill('7d');
  await page.keyboard.press('Enter');
  await expect.poll(solves).toBe(2);
  await expect(toast.locator('.ops-toast-count')).toHaveText('×2');
  await page.waitForTimeout(1_500);
  expect(await solves(), 'na de ene nieuwe poging blijft het stil').toBe(2);
  await expect(toast.locator('.ops-toast-count')).toHaveText('×2');
});
