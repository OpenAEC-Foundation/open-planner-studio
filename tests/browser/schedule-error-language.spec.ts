import { expect, seedProject, test } from './fixtures/ops';

// Review taakmutaties, bijvangst B: solverfouten verschenen ongeacht de UI-taal als vaste tekst —
// "Ongeldige startdatum voor taak …" in het Nederlands, "Circular dependency detected" in het Engels.
// De ongeldige start en de kring komen als ruwe data binnen (zoals uit een geopend bestand); taal
// kiezen, berekenen en het waarschuwingenpaneel openen gaan via echte klikken.
test('solverfouten verschijnen in de gekozen UI-taal, in de melding en in het waarschuwingenpaneel', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Erdarbeiten', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Rohbau', start: '2026-09-21', finish: '2026-10-02' },
  ]);
  await page.evaluate((id) => {
    window.__OPS__!.store.setState((s) => {
      s.tasks.find(t => t.id === id)!.time.scheduleStart = '';
    });
    window.__OPS__!.store.getState().setUI({ showSettingsDialog: true });
  }, first);

  await page.getByRole('button', { name: /^(Language|Taal)$/, exact: true }).click();
  await page.getByRole('option', { name: /Deutsch/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  // Sinds #233 heeft het sluitkruisje zelf de naam "Sluiten" (naast de voetknop met dezelfde
  // tekst); kies daarom expliciet het kruisje, en bewijs meteen dat ook zijn naam meevertaalt.
  const closeX = page.getByRole('dialog').locator('.modal-close-btn');
  await expect(closeX).toHaveAccessibleName('Schließen');
  await closeX.click();

  await page.locator('.ribbon-tab').filter({ hasText: /^Planung$/ }).click();
  const ribbon = page.locator('.ribbon-content');
  await ribbon.getByRole('button', { name: /^Berechnen$/ }).click();
  const toast = page.locator('.ops-toast.toast-error');
  await expect(toast.locator('.ops-toast-message')).toHaveText('Zeitplan konnte nicht berechnet werden');
  await expect(toast.locator('.ops-toast-detail')).toHaveText("Ungültiges Startdatum für Aufgabe 'Erdarbeiten'");

  await page.evaluate(([a, b]) => {
    window.__OPS__!.store.setState((s) => {
      s.tasks.find(t => t.id === a)!.time.scheduleStart = '2026-09-07';
      s.sequences.push({ id: 'seq-kring-1', predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
      s.sequences.push({ id: 'seq-kring-2', predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
    });
  }, [first, second]);
  await ribbon.getByRole('button', { name: /^Berechnen$/ }).click();
  const cycleText = /^Zirkelbezug zwischen Aufgaben: (Erdarbeiten → Rohbau → Erdarbeiten|Rohbau → Erdarbeiten → Rohbau)$/;
  await expect(toast.locator('.ops-toast-detail')).toHaveText(cycleText);

  await ribbon.getByRole('button', { name: /^Warnungen$/ }).click();
  const panel = page.locator('[data-ops-warnings-panel]');
  await expect(panel).toContainText('Der Terminplan konnte nicht berechnet werden: Zirkelbezug zwischen Aufgaben:');
  await expect(panel).not.toContainText('Circular dependency');
  await expect(toast).not.toContainText(/Ongeldige|Circular dependency/);
});
