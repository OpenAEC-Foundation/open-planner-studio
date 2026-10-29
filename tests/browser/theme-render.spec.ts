// Karakterisering voor expliciete canvas- en documentinvalidatie. Fixtures bouwen alleen de
// deterministische toestand; thema-, splitter-, Gantt- en documenttabhandelingen zijn echte
// browserevents. Na elke paint-trigger volgen twee rustige vensters van 500 ms.
import type { Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';

type PaintSurface = 'primary' | 'histogram';

async function paintCount(page: Page, surface: PaintSurface): Promise<number> {
  return page.evaluate(requested => window.__OPS__!.gantt.paintCount(requested), surface);
}

async function waitForFontsAndTwoQuietWindows(page: Page, surface: PaintSurface): Promise<number> {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(500);
  const afterFirst = await paintCount(page, surface);
  await page.waitForTimeout(500);
  const afterSecond = await paintCount(page, surface);
  expect(afterSecond, `${surface} bleef tekenen tijdens het tweede rustige venster`).toBe(afterFirst);
  return afterSecond;
}

async function canvasDataUrl(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
}

/** De kleur die het meest voorkomt in de onderste helft van het Gantt-canvas: met één taak bovenin
 *  is dat de kaartachtergrond (weekendkolommen zijn 2 van de 7 dagen). Als `#RRGGBB`. */
async function ganttBackground(page: Page): Promise<string> {
  return page.locator('[data-testid="gantt-primary-canvas"]').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const y = Math.floor(canvas.height * 0.6);
    const { data } = ctx.getImageData(0, y, canvas.width, Math.floor(canvas.height * 0.3));
    const counts = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) {
      const hex = '#' + [data[i], data[i + 1], data[i + 2]].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  });
}

async function themeAttributes(page: Page): Promise<[string | null, string | null]> {
  return page.evaluate(() => [
    document.documentElement.getAttribute('data-theme'),
    document.documentElement.getAttribute('data-oa-theme'),
  ]);
}

/** De achtergrond van titelbalk, linttabs, documentbalk en werkruimte. Bevinding Ethan 2026-10-29:
 *  elk van de vier houdt zijn eigen tint (de titelbalk liep in donker op in het lint). */
async function shellTints(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const bg = (selector: string) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).backgroundColor : 'ontbreekt';
    };
    return {
      titlebar: bg('.title-bar'),
      ribbonTabs: bg('.ribbon-tabs'),
      docbar: bg('.ops-tabstrip'),
      workspace: bg('#ops-document-tabpanel'),
    };
  });
}

async function addLibraryBooking(page: Page, taskId: string, label: string): Promise<{
  companyId: string;
  poolResourceId: string;
}> {
  return page.evaluate(({ id, name }) => {
    const s = window.__OPS__!.store.getState();
    const companyId = s.addCompany(`${name} bibliotheek`);
    const poolResourceId = s.addPoolResource(companyId, {
      name: `${name} kraan`,
      type: 'LABOR',
      description: '',
      maxUnits: 2,
    });
    if (!poolResourceId) throw new Error('poolresource kon niet worden aangemaakt');
    s.bindProjectToCompany(companyId);
    const materialized = s.addLibraryResourceToProject(companyId, poolResourceId);
    if (!materialized.resourceId) throw new Error('poolresource kon niet worden gematerialiseerd');
    s.assignResource(id, materialized.resourceId, 1);
    s.runCPM();
    return { companyId, poolResourceId };
  }, { id: taskId, name: label });
}

async function openOccupancyWithRealClick(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({
      showResourcePanel: true,
      resourcePanelDocked: false,
      resourcesView: 'project',
    });
  });
  await page.locator('[data-ops-occupancy-view-button]').click();
  await expect(page.locator('[data-ops-occupancy-view]')).toBeVisible();
}

// Licht en donker komen uit de OpenAEC-tokens 0.4 via de brugblokken in globals.css: de Gantt-kaart
// is `--oa-panel` van het thema. Hoog contrast heeft nog zijn eigen kleuren (#0a0a0a).
test('theme switch tekent Gantt en minimap opnieuw en wordt daarna stil', async ({ page, ops: _ops }) => {
  await seedProject(page, [{
    name: 'Themataak',
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showMiniMap: true }));
  const miniMap = page.getByTestId('minimap').locator('canvas');
  await expect(miniMap).toBeVisible();
  await waitForFontsAndTwoQuietWindows(page, 'primary');

  const before = {
    paint: await paintCount(page, 'primary'),
    gantt: await canvasDataUrl(page, '[data-testid="gantt-primary-canvas"]'),
    minimap: await canvasDataUrl(page, '[data-testid="minimap"] canvas'),
  };

  // Standaard donker: beide attributen, en de Gantt-kaart is --oa-frame uit de tokens (#2A2A32):
  // donkerder dan de oude kaart, zodat geen balkcontrast zakt (check-theme-contrast.ts).
  expect(await themeAttributes(page)).toEqual(['dark', 'dark']);
  expect(await ganttBackground(page)).toBe('#2A2A32');
  // Titelbalk en documentbalk `frame`, linttabs `panel` (Blueprint-schermen); de werkruimte houdt de
  // oude OPS-waarde #1B1D22 (elk token is lichter en verlaagt het contrast).
  expect(await shellTints(page)).toEqual({
    titlebar: 'rgb(42, 42, 50)', ribbonTabs: 'rgb(51, 51, 60)', docbar: 'rgb(42, 42, 50)', workspace: 'rgb(27, 29, 34)',
  });

  // Het openen mag fixturematig; de geteste gebruikershandeling is de echte klik op de themakaart.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.getByRole('dialog');
  await expect(settings).toBeVisible();

  // Licht: de kaart is --oa-panel (#FFFFFF); werkruimte en tekst houden hun oude OPS-waarde.
  await settings.locator('[data-ops-theme-card="light"]').click();
  await expect.poll(() => themeAttributes(page)).toEqual(['light', 'light']);
  await expect.poll(() => ganttBackground(page)).toBe('#FFFFFF');
  expect(await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return ['--theme-surface', '--theme-bg', '--theme-text', '--theme-accent']
      .map(name => cs.getPropertyValue(name).trim());
  })).toEqual(['#FFFFFF', '#E5E5E8', '#2A2A31', '#D97706']);
  // Licht: titelbalk en documentbalk warm `frame`, linttabs wit, werkruimte neutraal grijs (#E5E5E8).
  expect(await shellTints(page)).toEqual({
    titlebar: 'rgb(241, 238, 234)', ribbonTabs: 'rgb(255, 255, 255)', docbar: 'rgb(241, 238, 234)', workspace: 'rgb(229, 229, 232)',
  });
  // Bevinding Ethan 2026-10-29: de randen tussen de vlakken moeten zichtbaar zijn. De kaartrand
  // is daarom niet --oa-border (#EAEAEA, 1,04:1 op `frame`), maar #D6D2CC (Blueprint-issue #44).
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-border').trim()))
    .toBe('#D6D2CC');
  const lightGantt = await canvasDataUrl(page, '[data-testid="gantt-primary-canvas"]');
  await waitForFontsAndTwoQuietWindows(page, 'primary');
  before.paint = await paintCount(page, 'primary');
  before.gantt = lightGantt;
  before.minimap = await canvasDataUrl(page, '[data-testid="minimap"] canvas');

  await settings.locator('[data-ops-theme-card="high-contrast"]').click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme))
    .toBe('high-contrast');
  await expect.poll(() => paintCount(page, 'primary')).toBeGreaterThan(before.paint);
  await expect.poll(() => canvasDataUrl(page, '[data-testid="gantt-primary-canvas"]')).not.toBe(before.gantt);
  await expect.poll(() => canvasDataUrl(page, '[data-testid="minimap"] canvas')).not.toBe(before.minimap);
  // Hoog contrast valt nog buiten de brug: eigen kaartkleur, data-oa-theme alvast high-contrast-dark.
  expect(await themeAttributes(page)).toEqual(['high-contrast', 'high-contrast-dark']);
  expect(await ganttBackground(page)).toBe('#0A0A0A');
  await waitForFontsAndTwoQuietWindows(page, 'primary');

  // En terug naar donker: weer de tokenkleur.
  await settings.locator('[data-ops-theme-card="dark"]').click();
  await expect.poll(() => themeAttributes(page)).toEqual(['dark', 'dark']);
  await expect.poll(() => ganttBackground(page)).toBe('#2A2A32');
});

test('histogramsplitter tekent de nieuwe hoogte en veroorzaakt geen ResizeObserver-loop', async ({ page, ops: _ops }) => {
  await seedProject(page, [{
    name: 'Histogramtaak',
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showHistogram: true }));
  await expect(page.getByTestId('gantt-histogram-canvas')).toBeVisible();
  const beforePaint = await waitForFontsAndTwoQuietWindows(page, 'histogram');
  const beforeHeight = await page.evaluate(() => window.__OPS__!.store.getState().ui.histogramHeight);

  const splitter = page.locator('.histogram-splitter');
  const box = await splitter.boundingBox();
  if (!box) throw new Error('histogramsplitter heeft geen geometrie');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 36, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.histogramHeight))
    .toBeGreaterThan(beforeHeight);
  await expect.poll(() => paintCount(page, 'histogram')).toBeGreaterThan(beforePaint);
  const expectedHeight = await page.evaluate(() => window.__OPS__!.store.getState().ui.histogramHeight);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.gantt.lastSize('histogram')?.height))
    .toBe(expectedHeight);
  await waitForFontsAndTwoQuietWindows(page, 'histogram');
});

test('occupancy ververst na actieve-documentedit zonder documentwissel', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{
    name: 'Bezettingstaak',
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }], 'Bezettingsproject');
  const { poolResourceId } = await addLibraryBooking(page, taskId, 'Actief');
  const documentId = (await state(page)).activeDocumentId;
  // Openen moet ook met automatisch berekenen UIT het actieve project één keer bijwerken.
  const beforeOpen = await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ autoCalcCPM: false });
    const task = s.tasks.find(t => t.id === id)!;
    s.updateTask(id, { manuallyScheduled: false, time: { ...task.time, scheduleDuration: 15 } });
    const changed = window.__OPS__!.store.getState();
    return { end: changed.cpmResult?.projectEnd, dirty: changed.isDirty,
      history: changed.historyEvents, stale: changed.scheduleStale };
  }, taskId);
  expect(beforeOpen.stale).toBe(true);
  await openOccupancyWithRealClick(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  const afterOpen = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { end: s.cpmResult?.projectEnd, dirty: s.isDirty, history: s.historyEvents };
  });
  expect(afterOpen.end).not.toBe(beforeOpen.end);
  expect(afterOpen.dirty).toBe(beforeOpen.dirty);
  // F5 kan de huidige event-afterdata verversen, maar maakt geen extra undo-event.
  expect(afterOpen.history.map(e => e.id)).toEqual(beforeOpen.history.map(e => e.id));
  const row = page.locator(`[data-ops-occupancy-row="${poolResourceId}"]`);
  await expect(row).toBeVisible();
  const beforeText = await row.innerText();

  // Het volledige resourcepaneel blijft gemount terwijl de taakdialoog erboven opent. De
  // toewijzingseenheden zijn in deze gedeelde sectie direct-storeful: typen is dus de echte
  // gebruikershandeling en moet het onderliggende overzicht meteen invalidateren.
  await page.evaluate(id => window.__OPS__!.store.getState().setUI({
    showTaskDialog: true,
    editingTaskId: id,
  }), taskId);
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await expect(taskDialog).toBeVisible();
  // Het inzetveld is het eerste veld van de enige toewijzingsrij (tekstveld met `inputMode="decimal"`).
  await expect(taskDialog.locator('[data-ops-assignment-row]')).toHaveCount(1);
  const units = taskDialog.locator('[data-ops-assignment-row] input').first();
  // TaskDialog zet 30 ms na openen de focus (met selectie) op het naamveld. Wacht daarop: valt die
  // focuswissel midden in `fill`, dan belandt de tekst in de taaknaam (CI-run 36032473792).
  await expect(taskDialog.locator('input:focus')).toHaveCount(1);
  await units.fill('1.5');
  // Het inzetveld commit op Enter of blur, niet per toetsaanslag.
  await units.press('Enter');

  await expect.poll(() => row.innerText()).not.toBe(beforeText);
  expect((await state(page)).activeDocumentId).toBe(documentId);
  // Een duurwijziging maakt de planning stale; alleen inzet wijzigen hoeft dat niet te doen.
  const duration = taskDialog.locator('[data-ops-duration-value]');
  await duration.fill('20');
  await duration.blur();
  await taskDialog.locator('[data-ops-task-save]').click();
  await expect(taskDialog).toBeHidden();
  // Een edit in een reeds geopend overzicht start geen CPM per toetsaanslag.
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(true);
  await openOccupancyWithRealClick(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

  // Openen is nooit stil toestemming om de modus 'datums zoals opgeslagen' te verlaten.
  await page.evaluate(() => window.__OPS__!.store.setState(s => {
    s.datesAsRecorded = true;
    s.scheduleStale = true;
  }));
  await openOccupancyWithRealClick(page);
  expect(await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return [s.datesAsRecorded, s.scheduleStale];
  })).toEqual([true, true]);

  // Ook een foutieve invoer krijgt maar één poging, geen render-/notificatielus.
  await page.evaluate(id => window.__OPS__!.store.setState(s => {
    s.datesAsRecorded = false;
    s.tasks.find(t => t.id === id)!.time.scheduleStart = '';
    s.scheduleStale = true;
  }), taskId);
  await openOccupancyWithRealClick(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().cpmResult?.errorInfo?.code))
    .toBe('invalidStartDate');
  const count = () => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
    .find(n => n.dedupeKey === 'cpm-error')?.count);
  const countAfterOpen = await count();
  await page.waitForTimeout(200);
  expect(await count()).toBe(countAfterOpen);

});

test('occupancy gebruikt na echte documenttabwissel de nieuwe company- en poolcache', async ({ page, ops: _ops }) => {
  const [taskA] = await seedProject(page, [{
    name: 'Document A taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Document A');
  const a = await addLibraryBooking(page, taskA, 'A');
  const documentA = (await state(page)).activeDocumentId;

  const documentB = await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  const [taskB] = await seedProject(page, [{
    name: 'Document B taak', start: '2026-10-05', finish: '2026-10-16', durationDays: 10,
  }], 'Document B');
  const b = await addLibraryBooking(page, taskB, 'B');
  await openOccupancyWithRealClick(page);
  await expect(page.locator(`[data-ops-occupancy-row="${b.poolResourceId}"]`)).toBeVisible();
  await expect(page.locator(`[data-ops-occupancy-row="${a.poolResourceId}"]`)).toHaveCount(0);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${documentA}"]`).click();
  await expect.poll(() => state(page).then(snapshot => snapshot.activeDocumentId)).toBe(documentA);
  // De bestaande documentgrens zet deze app-globale paneelkeuze bewust terug naar Project;
  // opnieuw op Occupancy klikken is daarom onderdeel van de echte gebruikershandeling.
  await page.locator('[data-ops-occupancy-view-button]').click();
  await expect(page.locator(`[data-ops-occupancy-row="${a.poolResourceId}"]`)).toBeVisible();
  await expect(page.locator(`[data-ops-occupancy-row="${b.poolResourceId}"]`)).toHaveCount(0);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${documentB}"]`).click();
  await page.locator('[data-ops-occupancy-view-button]').click();
  await expect(page.locator(`[data-ops-occupancy-row="${b.poolResourceId}"]`)).toBeVisible();
});
