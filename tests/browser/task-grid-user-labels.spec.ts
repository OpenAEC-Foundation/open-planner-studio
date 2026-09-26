// Kolomnamen die de gebruiker zelf geeft (bijvondst G8, audit ronde 3 / G10). Een activity code of
// eigen veld met een punt in de naam kreeg in de kolomkiezer en in de kolomkop een verminkt label:
// "Fase 1.2" werd "2", "Blok v.o." werd leeg. De naam ging door `t()` en daarna door de terugval voor
// ontbrekende vertalingen, die alleen het stuk na de laatste punt houdt. Een naam die de gebruiker
// zelf gaf, is geen vertaalsleutel.
//
// Echte events: de kiezer opent met de plus in de tabelkop, een groep klapt open met een klik, een
// klik op een veld zet het als kolom, en in het layoutvenster wordt een groepeerniveau met klikken en
// een keuzelijst ingesteld. `__OPS__` zet alleen de fixture (velden, codes, baseline) en leest state.
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

type Surface = 'full-task-grid' | 'gantt-task-grid';

const CHOOSER = /^(Choose column|Kolom kiezen)$/;
const SEARCH = /^(Search|Zoeken)$/;
const SEARCH_RESULTS = /^(Search results|Zoekresultaten)$/;

/** Namen zoals de gebruiker ze in Codes & velden intikt. Elk stond vóór de reparatie verminkt. */
const CODE_NAME = 'Locatie 2.1';
const FIELD_NAMES = ['Fase 1.2', 'Blok v.o.', 'aannemer_nr', 'duration'];
const BASELINE_NAME = 'Basis 1.2';

function shell(page: Page, surface: Surface): Locator {
  return page.locator(`[data-task-grid-surface-id="${surface}"] .task-grid-shell`);
}

/** De namen van de velden in één groep van de open kolomkiezer; klapt de groep zo nodig open. */
async function categoryItems(chooser: Locator, name: RegExp): Promise<Locator> {
  const button = chooser.locator('.task-grid-column-chooser-category', { hasText: name });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  return button.locator('xpath=..').getByRole('menuitemcheckbox');
}

async function seedUserFields(page: Page): Promise<void> {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Casco', start: '2026-09-21', finish: '2026-10-16', durationDays: 20 },
  ], 'Eigen namen');
  await page.evaluate(({ codeName, fieldNames, baselineName }) => {
    const s = window.__OPS__!.store.getState();
    const [fundering, casco] = s.tasks.map(task => task.id);
    const code = s.addActivityCodeType(codeName);
    const noord = s.addActivityCodeValue(code, { code: 'N.1', description: 'Noordvleugel' });
    const zuid = s.addActivityCodeValue(code, { code: 'Z.2' });
    s.setTaskActivityCode(fundering, code, noord);
    s.setTaskActivityCode(casco, code, zuid);
    for (const name of fieldNames) s.addCustomField(name, 'text');
    s.saveBaseline(baselineName);
  }, { codeName: CODE_NAME, fieldNames: FIELD_NAMES, baselineName: BASELINE_NAME });
}

test('eigen namen met een punt: kolomkiezer, zoeken en kolomkop tonen de naam letterlijk', async ({ page, ops: _ops }) => {
  await seedUserFields(page);

  // De Tabel: plus in de tabelkop, groep Aangepast.
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const table = shell(page, 'full-task-grid');
  await expect(table.locator('[role="grid"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: CHOOSER });
  await table.locator('.task-grid-add-column').click();
  await expect(chooser).toBeVisible();
  const custom = await categoryItems(chooser, /^(Custom|Aangepast)/);
  await expect(custom).toHaveText([CODE_NAME, ...FIELD_NAMES]);

  // Baselinekolommen: de naam van de baseline blijft letterlijk vóór het vertaalde veld staan.
  const baseline = await categoryItems(chooser, /^Baseline/);
  await expect(baseline.first()).toHaveText(new RegExp(`^${BASELINE_NAME.replace('.', '\\.')} — (Scheduled start|Geplande start)$`));

  // Zoeken vindt het veld op de naam die de gebruiker gaf.
  await chooser.getByRole('searchbox', { name: SEARCH }).fill('Fase');
  const results = chooser.getByRole('region', { name: SEARCH_RESULTS }).getByRole('menuitemcheckbox');
  await expect(results).toHaveText(['Fase 1.2']);
  await results.first().click();
  await expect(chooser).toHaveCount(0);

  // De kolomkop en de knop om hem te verwijderen noemen het veld bij zijn naam.
  const added = table.locator('[role="columnheader"][data-grid-column-id^="custom-field:"]');
  await expect(added).toHaveCount(1);
  await expect(added.locator('.task-grid-column-label')).toHaveText('Fase 1.2');
  await expect(added.locator('.task-grid-remove-column')).toHaveAttribute('aria-label', /Fase 1\.2/);

  // De takenlijst naast de Gantt deelt dezelfde kolommen: daar dezelfde namen.
  await page.locator('.ribbon-tab', { hasText: /^(Home|Start)$/ }).click();
  const gantt = shell(page, 'gantt-task-grid');
  await expect(gantt.locator('[role="grid"]')).toBeVisible();
  await gantt.locator('.task-grid-add-column').click();
  await expect(chooser).toBeVisible();
  const ganttCustom = await categoryItems(chooser, /^(Custom|Aangepast)/);
  await expect(ganttCustom).toHaveText([CODE_NAME, ...FIELD_NAMES]);
  await ganttCustom.filter({ hasText: /^Blok v\.o\.$/ }).click();
  await expect(chooser).toHaveCount(0);
  await expect(gantt.locator('[role="columnheader"][data-grid-column-id^="custom-field:"] .task-grid-column-label'))
    .toHaveText('Blok v.o.');
});

test('gids-plannen-wbs: groeperen op een code via Beeld → Layout → Nieuwe layout, met de naam zoals gegeven', async ({ page, ops: _ops }) => {
  await page.evaluate(() => { localStorage.removeItem('ops-taskGridLayouts'); });
  await seedUserFields(page);

  // Standaard staat er op Beeld geen losse knop Groeperen… (die hoort bij de klassieke knoppen).
  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  await expect(page.getByRole('button', { name: /^(Group…|Groeperen…)$/ })).toHaveCount(0);

  // Lintgroep Layout → Nieuwe layout; onder Groeperen "+ niveau" en in de keuzelijst de code.
  await page.getByRole('button', { name: /^(New layout|Nieuwe layout)$/ }).click();
  const dialog = page.locator('[data-ops-layout-dialog]');
  await dialog.locator('[data-ops-layout-name]').fill('Per locatie');
  const groupRow = dialog.locator('[data-ops-layout-part-row="group"]');
  await expect(groupRow.locator('[data-ops-layout-part="group"]')).toBeChecked();
  await groupRow.getByRole('button', { name: /^(\+ level|\+ niveau)$/ }).click();
  const field = groupRow.getByRole('combobox', { name: /^(Field|Veld)$/ });
  await expect(field.locator('option', { hasText: CODE_NAME })).toHaveCount(1);
  await field.selectOption({ label: CODE_NAME });
  await page.locator('[data-ops-layout-save]').click();
  await expect(dialog).toHaveCount(0);

  // De nieuwe layoutknop zet de groepering aan en weer uit.
  const own = page.locator('[data-ops-layout-button]').filter({ hasText: 'Per locatie' }).locator('button');
  await own.click();
  await expect(page.locator('[data-grid-group-cell] .task-grid-group-label')).toHaveText(['N.1 — Noordvleugel', 'Z.2']);
  await own.click();
  await expect(page.locator('[data-grid-group-cell]')).toHaveCount(0);
});
