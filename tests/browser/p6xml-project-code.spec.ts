// P6 Project-ID los van de projectnaam (eigenaarsbesluit 2026-10-13): overal waar de app een document
// bij naam noemt staat "Naam (code)" (tabblad, titelbalk, venstertitel, sluitdialoog, rapportkop en
// PDF-naam, bezettingsoverzicht, herstelvenster); Projectinfo toont alleen de naam, en hernoemen houdt
// de code.
// Echte gebruikersflow: het bestand via de ribbonknop Openen en de bestandskiezer, hernoemen in
// Instellingen → Projectinfo met echte toetsaanslagen, tabbladen en kruisjes met echte klikken.
// `window.__OPS__` LEEST de uitkomst; alleen de bibliotheekboeking voor het bezettingsoverzicht en het
// openzetten van het resourcepaneel zijn fixtures (zoals in theme-render.spec.ts).
// Fixture: een klein P6 XML-bestand met drie projecten (A leeg, B "Project B & bouw" / B-BOUW,
// C "Project C" / C-AFBOUW), dat twee tabbladen opent.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const P6XML_MULTI = readFileSync(join(process.cwd(), 'tests/planning/fixtures/p6xml-genest-meerdere-projecten.xml'));
const APP = 'Open Planner Studio';

/** Openen via de ribbonknop en de bestandskiezer: twee tabbladen, B actief. */
async function openMulti(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'meerdere-projecten.xml', mimeType: 'application/xml', buffer: P6XML_MULTI });
  await expect(page.getByRole('tab', { name: 'Project B & bouw (B-BOUW)', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Project C (C-AFBOUW)', exact: true })).toBeVisible();
}

/** Instellingen → Projectinfo, het naamveld leegmaken en typen, de primaire knop. */
async function renameActive(page: Page, from: string, to: string): Promise<void> {
  await page.locator('button.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  await page.locator('button.ribbon-btn').filter({ hasText: /^(Project\s+settings|Project\u00ad?instellingen)$/ }).click();
  const dialog = page.locator('[data-ops-project-dialog="info"]');
  await expect(dialog).toBeVisible();
  const nameField = dialog.locator('[data-ops-project-name]');
  await expect(nameField).toHaveValue(from);
  await nameField.press('ControlOrMeta+A');
  await nameField.press('Backspace');
  await nameField.pressSequentially(to);
  await expect(nameField).toHaveValue(to);
  await dialog.locator('[data-ops-project-primary]').click();
  await expect(dialog).toHaveCount(0);
}

test('P6 XML: tabblad, titelbalk, venstertitel en sluitdialoog "Naam (code)"; Projectinfo alleen de naam',
  async ({ page, ops: _ops }) => {
    // 1. Openen: twee tabbladen, elk "Naam (code)"; titelbalk en venstertitel ook.
    await openMulti(page);
    const tabB = page.getByRole('tab', { name: 'Project B & bouw (B-BOUW)', exact: true });
    const tabC = page.getByRole('tab', { name: 'Project C (C-AFBOUW)', exact: true });
    await expect(page.locator('[data-ops-title-file-name]')).toHaveText('Project B & bouw (B-BOUW)');
    await expect(page).toHaveTitle(`Project B & bouw (B-BOUW) — ${APP}`);

    // 2-3. Projectinfo toont alleen de naam; hernoemen met echte toetsaanslagen.
    await renameActive(page, 'Project B & bouw', 'Nieuwe naam');

    // 4. Tabblad, titelbalk en venstertitel tonen "Nieuwe naam (B-BOUW)"; het andere tabblad blijft gelijk.
    const renamed = page.getByRole('tab', { name: 'Nieuwe naam (B-BOUW)', exact: true });
    await expect(renamed).toBeVisible();
    await expect(renamed).toHaveAttribute('aria-selected', 'true');
    await expect(tabB).toHaveCount(0);
    await expect(tabC).toBeVisible();
    await expect(page.locator('[data-ops-title-file-name]')).toHaveText('* Nieuwe naam (B-BOUW)');
    await expect(page).toHaveTitle(`* Nieuwe naam (B-BOUW) — ${APP}`);
    expect(await page.evaluate(() => {
      const p = window.__OPS__!.store.getState().project;
      return [p.name, p.p6ProjectCode];
    })).toEqual(['Nieuwe naam', 'B-BOUW']);

    // 5. Projectinfo opnieuw: nog steeds alleen de (nieuwe) naam.
    await page.locator('button.ribbon-btn').filter({ hasText: /^(Project\s+settings|Project\u00ad?instellingen)$/ }).click();
    const dialog = page.locator('[data-ops-project-dialog="info"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-ops-project-name]')).toHaveValue('Nieuwe naam');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // 6. De sluitdialoog van het ACTIEVE document noemt het met code; Annuleren laat het open.
    const closeB = page.getByRole('button', { name: /^(Close|Sluiten) Nieuwe naam \(B-BOUW\)$/ });
    const closeDialog = page.locator('[data-ops-close-dialog]');
    await closeB.click();
    await expect(closeDialog).toBeVisible();
    await expect(closeDialog).toContainText("'Nieuwe naam (B-BOUW)'");
    await closeDialog.getByRole('button', { name: /^(Cancel|Annuleren)$/ }).click();
    await expect(closeDialog).toHaveCount(0);
    await expect(renamed).toBeVisible();

    // 7. Naar tabblad C; dan het kruisje van het NIET-actieve, gewijzigde B: ook daar met code.
    await tabC.click();
    await expect(tabC).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveTitle(/^(\* )?Project C \(C-AFBOUW\) — Open Planner Studio$/);
    await closeB.click();
    await expect(closeDialog).toBeVisible();
    await expect(closeDialog).toContainText("'Nieuwe naam (B-BOUW)'");
    await closeDialog.getByRole('button', { name: /^(Cancel|Annuleren)$/ }).click();
    await expect(closeDialog).toHaveCount(0);
    await expect(renamed).toBeVisible();
  });

test('P6 XML: rapportkop en PDF-naam dragen "Naam (code)"', async ({ page, ops: _ops }) => {
  await openMulti(page);
  // Het tweede tabblad, met een echte klik: de kop volgt het actieve document.
  await page.getByRole('tab', { name: 'Project C (C-AFBOUW)', exact: true }).click();
  // De kop wordt met canvas-`fillText` in de hoofdthread getekend; we lezen alleen mee.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __opsFillTexts: string[] }).__opsFillTexts = seen;
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.fillText;
    proto.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
      seen.push(String(text));
      return maxWidth === undefined ? original.call(this, text, x, y) : original.call(this, text, x, y, maxWidth);
    };
  });
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await expect(page.locator('[data-preview-page]').first().locator('img')).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opsFillTexts: string[] }).__opsFillTexts
    .includes('Project C (C-AFBOUW)'))).toBe(true);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  expect((await download).suggestedFilename()).toBe('Project C (C-AFBOUW)-schedule.pdf');
});

test('P6 XML: het bezettingsoverzicht noemt het document "Naam (code)"', async ({ page, ops: _ops }) => {
  await openMulti(page);
  // Fixture (zoals theme-render.spec.ts): een bibliotheekboeking op een taak van B.
  const poolResourceId = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const companyId = s.addCompany('Codebibliotheek');
    const pool = s.addPoolResource(companyId, { name: 'Codekraan', type: 'LABOR', description: '', maxUnits: 2 });
    if (!pool) throw new Error('poolresource kon niet worden aangemaakt');
    s.bindProjectToCompany(companyId);
    const materialized = s.addLibraryResourceToProject(companyId, pool);
    if (!materialized.resourceId) throw new Error('poolresource kon niet worden gematerialiseerd');
    // Toewijzen kan alleen op een gewone taak: geen samenvatting, geen mijlpaal. B1 (werkdriehoek
    // F3a, review #562): een nieuwe resource op een gestarte of voltooide taak heeft geen verleden,
    // dus op het voltooide Grondwerk geeft ze geen belasting en geen boeking. Daarom een ongestarte taak.
    const task = s.tasks.find(t => !t.isSummary && !t.isMilestone && !s.tasks.some(o => o.parentId === t.id)
      && (t.time.completion ?? 0) === 0 && !t.time.actualStart);
    if (!task) throw new Error('fixture: B heeft geen gewone taak');
    s.assignResource(task.id, materialized.resourceId, 1);
    if (!window.__OPS__!.store.getState().assignments.some(a => a.taskId === task.id)) throw new Error('fixture: toewijzing mislukt');
    s.runCPM();
    s.setUI({ showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project' });
    return pool;
  });
  await page.locator('[data-ops-occupancy-view-button]').click();
  const row = page.locator(`[data-ops-occupancy-row="${poolResourceId}"]`);
  await expect(row).toBeVisible();
  await row.locator('[data-ops-occupancy-expand]').click();
  await expect(page.locator(`[data-ops-occupancy-docs="${poolResourceId}"]`)).toContainText('Project B & bouw (B-BOUW)');
});

test('P6 XML: het herstelvenster noemt de documenten "Naam (code)", ook na hernoemen', async ({ page, ops: _ops }) => {
  test.setTimeout(90_000);
  await openMulti(page);
  await renameActive(page, 'Project B & bouw', 'Hersteld hal');
  await expect(page.getByRole('tab', { name: 'Hersteld hal (B-BOUW)', exact: true })).toBeVisible();

  // De auto-save-tick (throttle 10 s) afwachten in de echte IndexedDB `ops-recovery` (alleen lezen).
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve) => {
    const request = indexedDB.open('ops-recovery');
    request.onerror = () => resolve(false);
    request.onsuccess = () => {
      const db = request.result;
      if (![...db.objectStoreNames].includes('records')) { db.close(); resolve(false); return; }
      const all = db.transaction('records', 'readonly').objectStore('records').getAll();
      all.onsuccess = () => {
        db.close();
        const records = all.result as Array<{ kind: string; ifc?: string }>;
        resolve(records.some(r => r.kind === 'doc' && typeof r.ifc === 'string' && r.ifc.includes('Hersteld hal')
          && r.ifc.includes("'P6ProjectCode'")));
      };
      all.onerror = () => { db.close(); resolve(false); };
    };
  })), { timeout: 30_000, intervals: [500] }).toBe(true);

  // Herladen, zoals na een crash; het herstelvenster noemt beide documenten met code.
  await page.evaluate(() => localStorage.setItem('ops-welcomeSeen', 'true'));
  page.on('dialog', d => { void d.accept(); });
  await page.reload();
  const recovery = page.locator('[data-ops-recovery-dialog]');
  await expect(recovery).toBeVisible({ timeout: 15_000 });
  await expect(recovery).toContainText('Hersteld hal (B-BOUW)');
  await expect(recovery).toContainText('Project C (C-AFBOUW)');
  await recovery.getByRole('button', { name: /^(Restore|Herstellen)$/ }).click();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Hersteld hal (B-BOUW)', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Project C (C-AFBOUW)', exact: true })).toBeVisible();
});
