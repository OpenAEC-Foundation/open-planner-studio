// Karakterisering vóór het opruimen van synchronisatie-effecten. De fixtures bouwen alleen de
// relevante beginsituatie; alle cursor-, invoer-, keuze-, pauze- en tekenhandelingen lopen via de
// echte browser-events waarmee een gebruiker deze oppervlakken bedient.
import type { Locator, Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { expect, seedProject, test, waitForOps } from './fixtures/ops';

async function openTaskDialog(page: Page, taskId: string): Promise<void> {
  await page.evaluate((id) => {
    window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id });
  }, taskId);
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('hook synchronization: Select initialiseert bij openen en bewaart de cursor bij nieuwe opties', async ({ page, ops: _ops }) => {
  const [editedId] = await seedProject(page, [
    { name: 'Te bewerken taak', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Bestaande bovenliggende taak', start: '2026-09-07', finish: '2026-09-18' },
  ]);
  await openTaskDialog(page, editedId);

  const trigger = page.getByRole('button', { name: /^(Parent task|Bovenliggende taak)$/ });
  await trigger.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveAttribute('aria-activedescendant', /-opt-0$/);

  await page.keyboard.press('ArrowDown');
  const cursorBefore = await listbox.getAttribute('aria-activedescendant');
  expect(cursorBefore).toMatch(/-opt-1$/);

  await page.evaluate(() => {
    window.__OPS__!.store.getState().addTask({
      name: 'Optie die tijdens de open keuzelijst verschijnt',
      manuallyScheduled: true,
    });
  });
  await expect(page.getByRole('option', { name: /Optie die tijdens/ })).toBeVisible();
  await expect(listbox).toHaveAttribute('aria-activedescendant', cursorBefore!);
});

test('hook synchronization: een ander relatieveld wist half ingevoerde lag niet', async ({ page, ops: _ops }) => {
  const [predecessorId, successorId] = await seedProject(page, [
    { name: 'Voorganger', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Opvolger', start: '2026-09-21', finish: '2026-10-02' },
  ]);
  const sequenceId = await page.evaluate(({ predecessor, successor }) => {
    const store = window.__OPS__!.store.getState();
    const id = store.addSequence({
      predecessorId: predecessor,
      successorId: successor,
      type: 'FINISH_START',
      lagDays: 0,
    });
    store.setUI({ activeRibbonTab: 'relations' });
    return id;
  }, { predecessor: predecessorId, successor: successorId });
  expect(sequenceId).not.toBeNull();

  const lag = page.getByTitle(/Lag/).first();
  const type = lag.locator('xpath=../preceding-sibling::div[1]//select');
  await expect(lag).toBeVisible();
  await lag.fill('-');
  await expect(lag).toHaveAttribute('aria-invalid', 'true');
  await type.selectOption('START_START');

  await expect(lag).toHaveValue('-');
  await expect.poll(() => page.evaluate((id) => (
    window.__OPS__!.store.getState().sequences.find(sequence => sequence.id === id)?.type
  ), sequenceId)).toBe('START_START');
});

test('hook synchronization: een resourcetoewijzing wist geen niet-opgeslagen taakvelden', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [
    { name: 'Oorspronkelijke taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const resourceId = await page.evaluate(() => window.__OPS__!.store.getState().addResource({
    name: 'Ploeg voor concepttaak', type: 'LABOR', description: '', maxUnits: 1,
  }));
  await openTaskDialog(page, taskId);

  const dialog = page.getByRole('dialog');
  const name = dialog.locator('input').first();
  const description = dialog.locator('textarea').first();
  const duration = dialog.locator('[data-ops-duration-value]');
  await name.fill('Nog niet opgeslagen naam');
  await description.fill('Nog niet opgeslagen omschrijving');
  await duration.fill('13d');

  // In deze fixture zijn alleen de native constraint- en resourcekeuzevelden aanwezig; de
  // resourcekeuze staat na de constraint en is daarmee het laatste native select-element.
  const resourcePicker = dialog.locator('select').last();
  await expect(resourcePicker).toHaveValue('');
  await resourcePicker.selectOption(resourceId);

  await expect(name).toHaveValue('Nog niet opgeslagen naam');
  await expect(description).toHaveValue('Nog niet opgeslagen omschrijving');
  await expect(duration).toHaveValue('13d');
  await dialog.locator('[data-ops-task-save]').click();

  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id);
    return task && { name: task.name, description: task.description, duration: task.time.scheduleDuration };
  }, taskId)).toEqual({
    name: 'Nog niet opgeslagen naam',
    description: 'Nog niet opgeslagen omschrijving',
    duration: 13,
  });
});

test('hook synchronization: een bedrijfsupdate overschrijft de handmatige poolimportkeuze niet', async ({ page, ops: _ops }) => {
  const setup = await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    const sourceId = store.addCompany('Bronbibliotheek');
    const targetId = store.addCompany('Handmatig doel');
    const ifc = window.__OPS__!.store.getState().exportPoolIFC(sourceId)!;
    store.setUI({ showPoolImportDialog: true, poolImportCompanyId: sourceId });
    return { sourceId, targetId, ifc };
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^(Choose file…|Bestand kiezen…)$/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'bronbibliotheek.ifc',
    mimeType: 'text/plain',
    buffer: Buffer.from(setup.ifc),
  });
  const target = page.locator('#pool-import-target-company');
  await expect(target).toBeVisible();
  await target.selectOption(setup.targetId);
  await expect(target).toHaveValue(setup.targetId);

  await page.evaluate((sourceId) => {
    window.__OPS__!.store.getState().renameCompany(sourceId, 'Bronbibliotheek, extern hernoemd');
  }, setup.sourceId);
  await expect(target.locator(`option[value="${setup.sourceId}"]`)).toContainText('extern hernoemd');
  await expect(target).toHaveValue(setup.targetId);
});

test('hook synchronization: nieuwe debugregels verplaatsen een gepauzeerde snapshot niet', async ({ page, ops: _ops }) => {
  const first = `voor-pauze-${Date.now()}`;
  const second = `na-pauze-${Date.now()}`;
  await page.evaluate((message) => {
    const store = window.__OPS__!.store.getState();
    store.setUI({
      showPropertiesPanel: true,
      rightPanelCollapsed: false,
      debugTerminalEnabled: true,
      debugTerminalOpen: true,
    });
    window.__OPS__!.log.emit('info', 'hook-sync-test', message);
  }, first);

  const pause = page.getByTitle(/^(Pause|Pauzeren)$/);
  await expect(pause).toBeVisible();
  await expect(page.getByText(first, { exact: false })).toBeVisible();
  const pauseElement = await pause.elementHandle();
  expect(pauseElement).not.toBeNull();
  await pauseElement!.click();

  await page.evaluate((message) => {
    window.__OPS__!.log.emit('info', 'hook-sync-test', message);
  }, second);
  await expect(page.getByText(first, { exact: false })).toBeVisible();
  await expect(page.getByText(second, { exact: false })).toHaveCount(0);
});

async function canvasDigest(canvas: Locator): Promise<string> {
  return canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL('image/png'));
}

test('hook synchronization: een annotatie tekent opnieuw zonder het canvas te herschalen', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const canvasPrototype = HTMLCanvasElement.prototype;
    const widthDescriptor = Object.getOwnPropertyDescriptor(canvasPrototype, 'width')!;
    const heightDescriptor = Object.getOwnPropertyDescriptor(canvasPrototype, 'height')!;
    let writes = 0;
    Object.defineProperty(window, '__opsAnnotatorResizeWrites', { configurable: true, get: () => writes });
    Object.defineProperty(canvasPrototype, 'width', {
      configurable: true,
      get: widthDescriptor.get,
      set(value: number) {
        if (this.classList.contains('annotator-editor-canvas')) writes++;
        widthDescriptor.set!.call(this, value);
      },
    });
    Object.defineProperty(canvasPrototype, 'height', {
      configurable: true,
      get: heightDescriptor.get,
      set(value: number) {
        if (this.classList.contains('annotator-editor-canvas')) writes++;
        heightDescriptor.set!.call(this, value);
      },
    });
    window.__OPS__!.store.getState().setUI({ showFeedbackDialog: true });
  });

  await page.getByLabel(/^(Attach screenshot|Schermafbeelding bijvoegen)$/).check();
  const annotate = page.getByRole('button', { name: /^(Annotate|Annoteren)$/ });
  await expect(annotate).toBeVisible({ timeout: 20_000 });
  await annotate.click();

  const canvas = page.locator('canvas.annotator-editor-canvas');
  await expect.poll(() => canvas.evaluate(element => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height,
  }))).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width)).toBeGreaterThan(0);
  const beforeWrites = await page.evaluate(() => (
    window as Window & { __opsAnnotatorResizeWrites?: number }
  ).__opsAnnotatorResizeWrites ?? 0);
  expect(beforeWrites).toBe(2);
  const beforeDigest = await canvasDigest(canvas);
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  await page.mouse.move(bounds!.x + bounds!.width * 0.25, bounds!.y + bounds!.height * 0.30);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.65, bounds!.y + bounds!.height * 0.65);
  await page.mouse.up();

  await expect(page.locator('.annotator-editor').getByTitle(/^(Undo|Ongedaan maken)$/)).toBeEnabled();
  await expect.poll(() => canvasDigest(canvas)).not.toBe(beforeDigest);
  expect(await page.evaluate(() => (
    window as Window & { __opsAnnotatorResizeWrites?: number }
  ).__opsAnnotatorResizeWrites ?? 0)).toBe(beforeWrites);
});

test('hook synchronization: de updatecontrole start eenmaal per open sessie', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    let starts = 0;
    const seen = new WeakSet<Element>();
    const count = (root: ParentNode) => {
      const candidates = root instanceof Element && root.matches('.animate-spin')
        ? [root]
        : Array.from(root.querySelectorAll?.('.animate-spin') ?? []);
      for (const candidate of candidates) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        starts++;
      }
    };
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof Element) count(node);
      }
    }).observe(document.body, { childList: true, subtree: true });
    Object.defineProperty(window, '__opsUpdateCheckStarts', { configurable: true, get: () => starts });
    window.__OPS__!.store.getState().setUI({ showSettingsDialog: true });
  });

  await page.getByRole('button', { name: /^(Application|Applicatie)$/ }).click();
  await page.getByRole('button', { name: /^(Check for updates|Controleren op updates)$/ }).click();
  await expect.poll(() => page.evaluate(() => (
    window as Window & { __opsUpdateCheckStarts?: number }
  ).__opsUpdateCheckStarts ?? 0)).toBe(1);

  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    store.setUI({ showPropertiesPanel: !store.ui.showPropertiesPanel });
  });
  expect(await page.evaluate(() => (
    window as Window & { __opsUpdateCheckStarts?: number }
  ).__opsUpdateCheckStarts ?? 0)).toBe(1);

  await page.getByRole('dialog').getByTitle(/^(Close|Sluiten)$/).click();
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  await page.getByRole('button', { name: /^(Application|Applicatie)$/ }).click();
  await page.getByRole('button', { name: /^(Check for updates|Controleren op updates)$/ }).click();
  await expect.poll(() => page.evaluate(() => (
    window as Window & { __opsUpdateCheckStarts?: number }
  ).__opsUpdateCheckStarts ?? 0)).toBe(2);
});

test('hook synchronization: een taalwissel start de recoverycontrole niet opnieuw', async ({ page, ops: _ops }) => {
  await page.addInitScript(() => {
    const originalOpen = IDBFactory.prototype.open;
    Object.defineProperty(window, '__opsRecoveryOpenCount', { configurable: true, writable: true, value: 0 });
    IDBFactory.prototype.open = function open(name: string, version?: number) {
      if (name === 'ops-recovery') {
        const testWindow = window as Window & { __opsRecoveryOpenCount?: number };
        testWindow.__opsRecoveryOpenCount = (testWindow.__opsRecoveryOpenCount ?? 0) + 1;
      }
      return version === undefined
        ? originalOpen.call(this, name)
        : originalOpen.call(this, name, version);
    };
  });
  await page.reload();
  await waitForOps(page);
  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    store.setUI({ showWelcomeDialog: false, showTourOverlay: false, showSettingsDialog: true });
  });
  await expect.poll(() => page.evaluate(() => (
    window as Window & { __opsRecoveryOpenCount?: number }
  ).__opsRecoveryOpenCount ?? 0)).toBeGreaterThan(0);
  const before = await page.evaluate(() => (
    window as Window & { __opsRecoveryOpenCount?: number }
  ).__opsRecoveryOpenCount ?? 0);

  await page.getByRole('button', { name: /^(Language|Taal)$/ }).click();
  const language = page.getByRole('button', { name: /^(Language|Taal)$/ }).last();
  await language.click();
  await page.getByRole('option', { name: /Nederlands/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (
    window as Window & { __opsRecoveryOpenCount?: number }
  ).__opsRecoveryOpenCount ?? 0)).toBe(before);
});
