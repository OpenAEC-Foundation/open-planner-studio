// Grijs is de basis, oranje het accent (regel van Ethan, 2 november 2026; Blueprint `docs/iconen.md`, "Grijs en
// oranje"). Een icoon van één vorm is grijs, een icoon met meer delen heeft één deel in oranje, en een icoon is nooit
// helemaal oranje. De Blueprint-check toetst de tekeningen; deze test toetst wat de app ervan maakt.
// De eerste test meet op vier tabs van het lint, in licht en donker:
// - geen zichtbaar icoon is helemaal oranje (dan kleurt de plek ook het grijze deel oranje);
// - elk deel dat in de tekening oranje is (`var(--icon-accent)`), is op het scherm ook oranje.
// De uitzonderingen voor het tweede punt staan ook in `src/components/icons/icons.css`: een uitgeschakelde knop en
// een vlak in een kleur (actieve of primaire lintknop, melding). Daar tekent alles in de hoofdkleur.
// De tweede test meet hetzelfde buiten het lint: de modusmeldingen, de taakvelden, de dialogen en het menu Bestand.
// Daar gaf de plek het hele icoon de oranje tekstkleur (`text-accent` of `color: var(--theme-accent)`), zodat hoofdkleur
// en accent gelijk werden (review van Sol op #765, ronde 1, 2 november 2026).
// De derde test bewaakt de oorzaak van een fout uit het nalopen (1 november 2026): `color: inherit` op `.oa-icon`,
// buiten een CSS-laag, won van Tailwind-klassen in `@layer utilities`. Een rood of oranje icoon kreeg zo de kleur
// van de plek eromheen.
import type { Page } from '@playwright/test';
import { FORMAT_NOTICE_KINDS } from '@/services/formatNoticeKinds';
import { expect, seedProject, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';

test.beforeEach(async ({ page, ops: _ops }) => {
  await page.goto('/');
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
  });
  await expect(page.locator('svg[data-icon]').first()).toBeVisible();
  await expect(page.locator('svg[data-icon].lucide')).toHaveCount(0);
});

const MONO_PLACES = [
  'button:disabled', '[aria-disabled="true"]', '.ribbon-btn.disabled', '.ribbon-btn.active', '.ribbon-btn.primary',
  '.ribbon-split-large.active .ribbon-split-bottom', '.backstage-nav-item.active', '.btn--primary', '.ops-toast',
].join(', ');

/** Zichtbare iconen die de regel breken, als "id in klasse-van-de-plek: fout". */
function iconColourErrors(page: Page): Promise<string[]> {
  return page.evaluate((mono) => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--theme-accent)';
    document.body.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    const colour = (path: SVGPathElement) => {
      const cs = getComputedStyle(path);
      return cs.stroke !== 'none' ? cs.stroke : cs.fill;
    };
    const errors: string[] = [];
    for (const svg of document.querySelectorAll<SVGSVGElement>('svg[data-icon]')) {
      if (svg.getBoundingClientRect().width === 0) continue;
      const paths = [...svg.querySelectorAll('path')].filter(path => path.getClientRects().length > 0);
      if (!paths.length) continue;
      const meant = paths.filter(path => /icon-accent/.test(`${path.getAttribute('stroke')} ${path.getAttribute('fill')}`));
      const orange = paths.filter(path => colour(path) === accent);
      const place = `${svg.dataset.icon} in ${String(svg.parentElement?.className ?? '').slice(0, 50)}`;
      if (orange.length === paths.length) errors.push(`${place}: helemaal oranje`);
      else if (meant.length && !orange.length && !svg.closest(mono)) errors.push(`${place}: oranje deel niet oranje`);
    }
    return errors;
  }, MONO_PLACES);
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate(id => window.__OPS__!.store.getState().setUI({ uiTheme: id }), theme);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe(theme);
}

type UiPatch = Parameters<ReturnType<NonNullable<Window['__OPS__']>['store']['getState']>['setUI']>[0];

async function setUI(page: Page, patch: UiPatch) {
  await page.evaluate(value => window.__OPS__!.store.getState().setUI(value), patch);
}

for (const theme of ['light', 'dark'] as const) {
  test(`iconen (${theme}): grijs als basis, oranje als accent op het lint`, async ({ page, ops: _ops }) => {
    await setTheme(page, theme);
    for (const tab of ['start', 'planning', 'resources', 'beeld'] as const) {
      await page.evaluate(id => window.__OPS__!.store.getState().setUI({ activeRibbonTab: id }), tab);
      await expect(page.locator(`[data-ops-ribbon-tab="${tab}"]`)).toHaveClass(/\bactive\b/);
      expect(await iconColourErrors(page), `tab ${tab}`).toEqual([]);
    }
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`iconen (${theme}): nooit helemaal oranje in meldingen, taakvelden, dialogen en het menu Bestand`, async ({ page, ops: _ops }) => {
    await setTheme(page, theme);
    const [first, second] = await seedProject(page, [
      { name: 'Fundering', start: '2026-06-01', finish: '2026-06-12', durationDays: 10 },
      { name: 'Opbouw', start: '2026-06-15', finish: '2026-06-26', durationDays: 10 },
    ]);
    await page.evaluate(({ from, to }) => {
      const s = window.__OPS__!.store.getState();
      s.addSequence({ predecessorId: from, successorId: to, type: 'FINISH_START', lagDays: 0 });
      s.runCPM();
      s.selectTask(to);
      s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    }, { from: first, to: second });

    // Taakvelden: de aanwijzing "drijvend" bij de voorganger en de knop Aantekening toevoegen.
    await expect(page.locator('[data-ops-note-add]').first()).toBeVisible();
    expect.soft(await iconColourErrors(page), 'taakvelden').toEqual([]);

    // Modusmeldingen onder het lint: Relatie tekenen, Splitsen en Datums zoals opgeslagen.
    for (const flag of ['showDependencyMode', 'showSplitMode'] as const) {
      await setUI(page, { [flag]: true });
      await expect(page.locator('[data-ops-notice-tone]').first()).toBeVisible();
      expect.soft(await iconColourErrors(page), flag).toEqual([]);
      await setUI(page, { [flag]: false });
    }
    await page.evaluate(() => window.__OPS__!.store.setState({ datesAsRecorded: true }));
    await expect(page.locator('[data-ops-notice-tone]').first()).toBeVisible();
    expect.soft(await iconColourErrors(page), 'datums zoals opgeslagen').toEqual([]);
    await page.evaluate(() => window.__OPS__!.store.setState({ datesAsRecorded: false }));

    // Dialogen.
    const dialogs: Array<[string, UiPatch, UiPatch]> = [
      ['bijwerken', { showUpdateDialog: true }, { showUpdateDialog: false }],
      ['kalenders', { showCalendarDialog: true }, { showCalendarDialog: false }],
      ['net bijgewerkt', { justUpdated: { from: '2026.8.0', to: '2026.8.1' } }, { justUpdated: null }],
      ['uitleg formaat', { pendingFormatNotice: FORMAT_NOTICE_KINDS[0] }, { pendingFormatNotice: null }],
    ];
    for (const [name, open, close] of dialogs) {
      await setUI(page, open);
      await expect(page.locator('[role="dialog"]').first(), name).toBeVisible();
      expect.soft(await iconColourErrors(page), `dialoog ${name}`).toEqual([]);
      await setUI(page, close);
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    }

    // Menu Bestand: de kaarten van Exporteren en Importeren, en Extensies.
    for (const section of ['export', 'import', 'extensions'] as const) {
      await setUI(page, { activeRibbonTab: 'file', backstageSection: section });
      await expect(page.locator('.backstage-nav-icon').first()).toBeVisible();
      expect.soft(await iconColourErrors(page), `Bestand › ${section}`).toEqual([]);
    }

    // Menu Bestand › App-instellingen, elke groep (review van Sol op #765, ronde 2: de melding bij de taaktypes
    // in Planning was helemaal oranje).
    await setUI(page, { activeRibbonTab: 'file', backstageSection: 'settings' });
    const tabs = page.locator('.settings-tab');
    await expect(tabs.first()).toBeVisible();
    let taskTypesNote = 0;
    for (let i = 0; i < await tabs.count(); i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveClass(/\bactive\b/);
      taskTypesNote += await page.locator('[data-ops-setting-note="taskTypes"] svg[data-icon]').count();
      expect.soft(await iconColourErrors(page), `App-instellingen, groep ${i + 1}`).toEqual([]);
    }
    expect(taskTypesNote, 'de melding bij de taaktypes is gemeten').toBe(1);

    // Help met een promptblok (knop Prompt kopiëren).
    await page.evaluate(() => window.__OPS__!.store.getState().openHelpArticle('howto-ai-assistent-koppelen'));
    await expect(page.locator('[data-help-prompt] svg[data-icon]').first()).toBeVisible();
    expect.soft(await iconColourErrors(page), 'Help met een promptblok').toEqual([]);
  });
}

test('iconen: een tekstkleur-klasse op een icoon wint van de kleur van de plek', async ({ page, ops: _ops }) => {
  const result = await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.color = 'rgb(1, 2, 3)';
    host.innerHTML = '<span class="text-critical">x</span><svg class="oa-icon text-critical" width="16" height="16"></svg>';
    document.body.append(host);
    const out = { text: getComputedStyle(host.children[0]).color, icon: getComputedStyle(host.children[1]).color };
    host.remove();
    return out;
  });
  expect(result.icon).not.toBe('rgb(1, 2, 3)');
  expect(result.icon).toBe(result.text);
});
