// Stap 1.5 (keuze 1 en het vangnet van keuze 6, Ethan 2026-11-03; `docs/relaties-tussen-projecten.md`):
// de balk bij een nieuwe versie van een bron, met echte klikken. De rekenregels (wat telt als wijziging,
// de gevolgen, Later en Accepteren in de store) staan in `tests/planning/check-external-source-update.ts`;
// hier de bedrading: openen geeft de balk, Bekijken opent het venster, Later haalt alles weg, een nieuwe
// versie geeft bij terugkeer naar het venster weer een balk, Accepteren zet de ankers en Ctrl+Z zet ze terug.
// Review #811: Enter op een knop doet wat die knop doet. Enter op het kruisje sluit alleen het venster, Enter
// op *Later* haalt de balk weg; geen van beide accepteert. Enter op *Accepteren* accepteert.
// Review #811 ronde 2: F5 terwijl het venster open staat ⇒ het voorstel volgt de nieuwe berekening.
//
// De fixtures zijn gewone IFC-bestanden van OPS: *Aannemer* heeft twee externe voorgangers naar
// `/projecten/Installateur.ifc` met ankers uit een oudere versie (`sourceVersion` 1 november 2026);
// *Installateur* heeft de auteur Anna de Vries. De dev-link `source=` laat de browser die bron uit de repo
// lezen, met de `Last-Modified` van de dev-server als versie (`docs/dev-link.md`).
import { utimesSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures/ops';

const DIR = 'tests/browser/fixtures/ifc/externe-bron';
const SOURCE_FILE = fileURLToPath(new URL('./fixtures/ifc/externe-bron/Installateur.ifc', import.meta.url));
const STRIP = '[data-ops-external-source-update]';
const DIALOG = '[data-ops-external-source-review-dialog]';

test('nieuwe versie van een bron: balk, Bekijken, Enter op het kruisje en op Later, opnieuw bij een volgende versie, Accepteren en undo', async ({ page, ops: _ops }) => {
  test.setTimeout(120_000);
  // Het bronbestand krijgt een verse wijzigingstijd, ook als de checkout ouder is.
  const now = new Date();
  utimesSync(SOURCE_FILE, now, now);
  await page.goto(`/?open=${DIR}/Aannemer.ifc&source=${DIR}/Installateur.ifc`);
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  const anchors = () => page.evaluate(() => window.__OPS__!.store.getState().tasks
    .flatMap(task => (task.externalLinks ?? []).map(link => `${task.name}: ${link.anchorDate}`)));
  const oldAnchors = ['Afbouw: 2027-03-19T16:00', 'Terreinafwerking: 2027-03-03T16:00'];

  // Openen ⇒ de balk, met de auteur en twee koppelingen; het plan verandert niet vanzelf.
  const strip = page.locator(STRIP);
  await expect(strip).toHaveCount(1, { timeout: 15_000 });
  await expect(strip).toContainText('Installateur.ifc');
  await expect(strip).toContainText('Anna de Vries');
  expect(await anchors()).toEqual(oldAnchors);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().isDirty)).toBe(false);

  // Bekijken ⇒ het venster met beide koppelingen en de gevolgen.
  await page.locator('[data-ops-external-source-review]').click();
  const dialog = page.locator(DIALOG);
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(2);
  await expect(dialog.locator('[data-ops-external-source-review-effects] div')).toHaveCount(2);

  const appliedSteps = () => page.evaluate(() => window.__OPS__!.store.getState().historyEvents.filter(e => e.state === 'applied').length);
  const stepsBeforeKeys = await appliedSteps();

  // Enter op het kruisje ⇒ alleen het venster dicht; de balk blijft, het plan ongewijzigd.
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(strip).toHaveCount(1);
  expect(await anchors()).toEqual(oldAnchors);
  expect(await appliedSteps()).toBe(stepsBeforeKeys);

  // Enter op Later in het venster ⇒ venster en balk weg, plan ongewijzigd, geen stap in de geschiedenis.
  await page.locator('[data-ops-external-source-review]').click();
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(2);
  await dialog.locator('[data-ops-external-source-review-later]').focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(strip).toHaveCount(0);
  expect(await anchors()).toEqual(oldAnchors);
  expect(await appliedSteps()).toBe(stepsBeforeKeys);

  // Terug naar het venster met dezelfde versie ⇒ geen balk.
  await page.waitForTimeout(2_100);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1_000);
  await expect(strip).toHaveCount(0);

  // Een volgende versie van de bron ⇒ bij terugkeer naar het venster weer de balk.
  const later = new Date(now.getTime() + 60_000);
  utimesSync(SOURCE_FILE, later, later);
  // Een focus binnen 2 s na de vorige controle telt niet (focus en zichtbaarheid vallen vaak samen).
  await page.waitForTimeout(2_100);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(strip).toHaveCount(1, { timeout: 15_000 });

  // F5 terwijl het venster open staat ⇒ het voorstel volgt de nieuwe berekening. Opzet (fixture): de bladtaak die
  // het laatst eindigt, duurt twee keer zo lang, zonder herberekening; het venster vergelijkt dan eerst met de
  // oude berekening.
  await page.evaluate(() => {
    const S = window.__OPS__!.store.getState();
    const last = S.tasks.filter(t => t.childIds.length === 0)
      .reduce((a, b) => ((b.time.earlyFinish ?? '') > (a.time.earlyFinish ?? '') ? b : a));
    S.updateTask(last.id, { time: { ...last.time, scheduleDuration: last.time.scheduleDuration * 2 } });
  });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(true);
  const effectsText = () => dialog.locator('[data-ops-external-source-review-effects]').innerText();
  await page.locator('[data-ops-external-source-review]').click();
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(2);
  const staleEffects = await effectsText();
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  await expect.poll(effectsText).not.toBe(staleEffects);
  const recalculatedEffects = await effectsText();
  // Hetzelfde als een venster dat na de berekening opengaat.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.locator('[data-ops-external-source-review]').click();
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(2);
  await expect.poll(effectsText).toBe(recalculatedEffects);

  // Enter op Accepteren ⇒ de nieuwe ankers, één undo-stap, balk en venster weg.
  const steps = await appliedSteps();
  await dialog.locator('[data-ops-external-source-review-accept]').focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(strip).toHaveCount(0);
  expect(await anchors()).toEqual(['Afbouw: 2027-03-23T16:00', 'Terreinafwerking: 2027-03-05T16:00']);
  expect(await appliedSteps()).toBe(steps + 1);

  // Ctrl+Z ⇒ de oude ankers terug.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(anchors).toEqual(oldAnchors);
});
