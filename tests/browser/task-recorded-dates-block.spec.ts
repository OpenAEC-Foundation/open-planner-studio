// "Datums zoals opgeslagen" in het eigenschappenpaneel als infoblok (eigenaar, 2026-10-17). De oude
// badge (hoofdletters, `white-space: nowrap`) liep met een hele zin buiten het paneel en stond los in
// het midden. Nu: een `alert`-blok over de volle breedte, direct boven de datumvelden onder *Tijd*,
// met per stand een themakleur (oranje = actief, grijs = deels niet vastgelegd). Teksten en het
// vervallen van de aanbod-stand (dus geen 'wijkt af' meer): eigenaar, 2026-10-17, optie 1.
// Echte gebruikersflow: een .xer via de ribbonknop Openen en de bestandskiezer, en een klik op de
// taakrij. `window.__OPS__` zet alleen de paneelbreedte (fixture), leest taak-id's en zet het thema
// voor het schermbewijs.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

// Schermbewijs (licht en donker, nl en en) alleen als deze map is gezet.
const SHOTS = process.env.OPS_P6_DATUMS_SHOTS;

const HEADER = [
  'task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type',
  'status_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
].join('\t');

// Zelfde orakel-fixture als `recorded-dates.spec.ts`: T1 wijkt af van onze herberekening (de modus gaat
// vanzelf aan), T2 ligt gelijk met de herberekening, T3 legt alleen het vroege paar vast (deels niet
// vastgelegd).
const XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tInfoblok\tC1\t2026-01-01\t2026-01-01',
  '%T\tTASK',
  `%F\t${HEADER}`,
  '%R\tT1\tP1\tC1\tA1\tDeviates\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-01-05\t2026-01-12\t2026-01-10\t2026-01-17\t40\t8',
  '%R\tT2\tP1\tC1\tA2\tStays\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-02-02\t2026-02-06\t2026-02-02\t2026-02-06\t2026-02-02\t2026-02-06\t0\t0',
  '%R\tT3\tP1\tC1\tA3\tEarlyOnly\tTT_Task\tDT_FixedDUR\tTK_NotStart\t16\t16\t2026-03-01\t2026-03-03\t2026-03-01\t2026-03-03\t\t\t\t',
  '%E',
].join('\n');

async function openXer(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'infoblok.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(XER) });
}

// Definitieve teksten (eigenaar, 2026-10-17); nl of en, afhankelijk van de taal van de testbrowser.
const SHOWN_PRIMAVERA = /^(Je ziet de datums die Primavera opsloeg, niet de berekening van de app\.|You see the dates Primavera saved, not the app's calculation\.)$/;
const WILL_SHIFT = /^(Bij herberekenen verandert deze taak\.|Recalculating changes this task\.)$/;
const WILL_STAY = /^(Bij herberekenen blijft deze taak gelijk\.|Recalculating leaves this task the same\.)$/;
const MISSING_PRIMAVERA = /^(Primavera heeft voor deze taak niet alles opgeslagen\. Ontbreekt: Laatste start, Laatste einde, Totale speling, Vrije speling\.|Primavera did not save everything for this task\. Missing: Late start, Late finish, Total float, Free float\.)$/;
const sentence = (block: Locator, i: number) => block.locator(`[data-ops-task-recorded-dates-sentence="${i}"]`);

const panel = (page: Page) => page.locator('[data-ops-rail-panel="properties"]');

async function clickTask(page: Page, taskId: string): Promise<void> {
  await page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`
      + ' [data-grid-data-cell="true"][data-grid-column-id="task.name"]',
  ).click();
}

/** Een CSS-kleur zoals de browser hem uitrekent (zelfde schrijfwijze als `getComputedStyle`). */
async function resolveColor(page: Page, css: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.querySelector('[data-ops-rail-panel="properties"]')!.appendChild(probe);
    const out = getComputedStyle(probe).color;
    probe.remove();
    return out;
  }, css);
}

const EXPECTED_BORDER: Record<string, string> = {
  active: 'var(--theme-accent)',
  'partly-unrecorded': 'color-mix(in srgb, var(--color-text-primary) 35%, var(--theme-surface))',
};

/** Het blok voor `state`: boven de datumvelden, binnen de paneelbreedte, gewone letters, themakleur. */
async function expectBlock(page: Page, state: string): Promise<Locator> {
  const block = panel(page).locator(`[data-ops-task-recorded-dates="${state}"]`);
  await expect(block).toBeVisible();
  await block.scrollIntoViewIfNeeded();

  // Plek: onder de kop *Tijd* en direct boven het veld Start.
  const startField = panel(page).getByLabel(/^Start$/).first();
  const timeHeader = panel(page).locator('.ui-card-header').filter({ hasText: /^(Tijd|Time)$/ });
  const [b, start, head] = await Promise.all([block.boundingBox(), startField.boundingBox(), timeHeader.boundingBox()]);
  expect(b && start && head).toBeTruthy();
  expect(b!.y).toBeGreaterThanOrEqual(head!.y + head!.height - 0.5);
  expect(b!.y + b!.height).toBeLessThanOrEqual(start!.y + 0.5);
  // Niets tussen blok en Start-veld behalve de veldlabel: het blok is de directe voorganger van het raster.
  expect(await block.evaluate(el => el.nextElementSibling?.querySelector('input') != null)).toBe(true);

  // Breedte: het blok en zijn tekst blijven binnen het paneel; het blok vult de paneelbreedte.
  const p = (await panel(page).boundingBox())!;
  expect(b!.x).toBeGreaterThanOrEqual(p.x - 0.5);
  expect(b!.x + b!.width).toBeLessThanOrEqual(p.x + p.width + 0.5);
  expect(b!.width).toBeGreaterThan(p.width * 0.8);
  const fit = await block.evaluate((el) => {
    const span = el.querySelector('span')!;
    const r = span.getBoundingClientRect();
    const o = el.getBoundingClientRect();
    return { overflow: el.scrollWidth - el.clientWidth, spanLeft: r.left - o.left, spanRight: o.right - r.right };
  });
  expect(fit.overflow).toBeLessThanOrEqual(0);
  expect(fit.spanLeft).toBeGreaterThanOrEqual(0);
  expect(fit.spanRight).toBeGreaterThanOrEqual(0);

  // Gewone letters, mag over meerdere regels.
  const style = await block.evaluate((el) => {
    const s = getComputedStyle(el);
    return { transform: s.textTransform, whiteSpace: s.whiteSpace, border: s.borderLeftColor, borderWidth: s.borderLeftWidth };
  });
  expect(style.transform).toBe('none');
  expect(style.whiteSpace).not.toMatch(/nowrap/);
  expect(parseFloat(style.borderWidth)).toBeGreaterThan(0);
  expect(style.border).toBe(await resolveColor(page, EXPECTED_BORDER[state]));
  return block;
}

async function shoot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.evaluate(() => window.__OPS__!.store.setState(st => { st.ui.notifications = []; }));
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme);
  const timeHeader = panel(page).locator('.ui-card-header').filter({ hasText: /^(Tijd|Time)$/ });
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(300);
    await timeHeader.scrollIntoViewIfNeeded();
    const p = (await panel(page).boundingBox())!;
    const h = (await timeHeader.boundingBox())!;
    const top = Math.max(h.y - 12, p.y);
    await page.screenshot({
      path: `${SHOTS}/${name}-${theme === 'light' ? 'licht' : 'donker'}.png`,
      clip: { x: p.x, y: top, width: p.width, height: Math.min(260, p.y + p.height - top) },
    });
  }
  await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), before);
}

for (const width of [280, 200] as const) {
  test(`datums zoals opgeslagen: infoblok boven de datumvelden, binnen een paneel van ${width} px, kleur per stand`, async ({ page, ops: _ops }) => {
    await openXer(page);
    await expect(page.locator('[data-ops-recorded-dates-active]')).toBeVisible();
    // Fixture: de paneelbreedte (de splitter heeft een eigen spec, `right-rail-resize.spec.ts`).
    await page.evaluate(w => window.__OPS__!.store.getState().setUI({ rightPanelWidth: w, showPropertiesPanel: true, rightPanelCollapsed: false }), width);
    const ids = await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      return { a1: s.tasks.find(t => t.wbsCode === 'A1')!.id, a2: s.tasks.find(t => t.wbsCode === 'A2')!.id, a3: s.tasks.find(t => t.wbsCode === 'A3')!.id };
    });

    // Oranje, met per taak de tweede zin: A1 verschuift bij herberekenen, A2 niet.
    await clickTask(page, ids.a1);
    const a1 = await expectBlock(page, 'active');
    await expect(sentence(a1, 0)).toHaveText(SHOWN_PRIMAVERA);
    await expect(sentence(a1, 1)).toHaveText(WILL_SHIFT);
    await clickTask(page, ids.a2);
    const a2 = await expectBlock(page, 'active');
    await expect(sentence(a2, 0)).toHaveText(SHOWN_PRIMAVERA);
    await expect(sentence(a2, 1)).toHaveText(WILL_STAY);

    // Grijs: de ontbrekende waarden met de kolomnamen, zonder vaktaal.
    await clickTask(page, ids.a3);
    const a3 = await expectBlock(page, 'partly-unrecorded');
    await expect(sentence(a3, 0)).toHaveText(MISSING_PRIMAVERA);
    await expect(a3).not.toContainText(/vastlegging|late-\/speling/i);

    // Geen aanbod-stand meer: na herberekenen is er geen blok en geen strook.
    await page.locator('[data-ops-recorded-dates-recalculate]').click();
    await expect(page.locator('[data-ops-recorded-dates-active]')).toHaveCount(0);
    await clickTask(page, ids.a1);
    await expect(panel(page).locator('[data-ops-task-recorded-dates]')).toHaveCount(0);
  });
}

test('datums zoals opgeslagen: schermbewijs nl en en, licht en donker', async ({ page, ops: _ops }) => {
  test.skip(!SHOTS, 'alleen met OPS_P6_DATUMS_SHOTS');
  await page.setViewportSize({ width: 1280, height: 1000 });
  for (const code of ['nl', 'en'] as const) {
    await chooseLocale(page, LOCALE_CASES.find(l => l.code === code)!);
    await openXer(page);
    await expect(page.locator('[data-ops-recorded-dates-active]')).toBeVisible();
    await page.evaluate(() => window.__OPS__!.store.getState().setUI({ rightPanelWidth: 280, showPropertiesPanel: true, rightPanelCollapsed: false }));
    const ids = await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      return { a1: s.tasks.find(t => t.wbsCode === 'A1')!.id, a2: s.tasks.find(t => t.wbsCode === 'A2')!.id, a3: s.tasks.find(t => t.wbsCode === 'A3')!.id };
    });
    await clickTask(page, ids.a1);
    await expectBlock(page, 'active');
    await shoot(page, `actief-${code}`);
    await clickTask(page, ids.a3);
    await expectBlock(page, 'partly-unrecorded');
    await shoot(page, `deels-${code}`);
  }
});
