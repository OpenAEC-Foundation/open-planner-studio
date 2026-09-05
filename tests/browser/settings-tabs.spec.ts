// U1: Instellingen kreeg drie tabs (Weergave/Planning/Geavanceerd i.p.v. de oude vier), met de
// sectie Project eruit. Dit is de ENE gedeelde `SettingsPanelContent`-component op drie ingangen
// (tandwiel-popup, Instellingen-ribbontab, Backstage → Instellingen) — deze test bewijst dat alle
// drie daadwerkelijk dezelfde tabs/sectiekoppen tonen ná echte klikken, niet alleen ná een
// store-fixture. De dev-brug wordt hier bewust niet gebruikt: openen/sluiten/tab-wisselen gaat
// via echte DOM-interacties; assertions lezen alleen zichtbare tekst.
import { expect, test } from './fixtures/ops';
import type { Locator } from '@playwright/test';

const TAB_LABELS: RegExp[] = [
  /^(Appearance|Weergave)$/,
  /^Planning$/,
  /^(Advanced|Geavanceerd)$/,
];

// Exacte sectiekoppen (h3/h4) per tab, in de vaste volgorde uit CLAUDE.md/de opdracht.
const SECTION_HEADINGS: RegExp[][] = [
  [
    /^(Theme|Thema)$/,
    /^(Language|Taal)$/,
    /^(Font|Lettertype)$/,
    /^(Text size|Tekengrootte)$/,
    /^(Date format|Datumnotatie)$/,
    /^(Duration display|Duurweergave)$/,
    /^(Document switch style|Documentwissel-stijl)$/,
    /^Gantt$/,
    /^(Timeline axis|Tijd-as)$/,
    /^(Quarter-hour zoom|Kwartierzoom)$/,
    /^(Task bars at interruptions|Taakbalken bij onderbrekingen)$/,
    /^(Scroll & zoom|Scrollen & zoomen)$/,
  ],
  [
    /^(Construction mode|Bouwmodus)$/,
    /^(Hour planning|Urenplanning)$/,
    /^(Week starts on|Week begint op)$/,
    /^(Calculation|Berekenen)$/,
  ],
  [
    /^(AI mode|AI-modus)$/,
    /^(Debug terminal|Debug-terminal)$/,
    /^Benchmark$/,
    /^(Tour|Rondleiding)$/,
    /^(Version|Versie)$/,
  ],
];

const PROJECT_SECTION_TEXT = /^(Project|Project information\.\.\.|Projectinformatie\.\.\.)$/;

/** Doorloopt alle drie de tabs binnen `container` en vergelijkt tabnamen + sectiekoppen. */
async function assertThreeTabsAndSections(container: Locator): Promise<void> {
  const tabs = container.locator('.settings-tab');
  await expect(tabs).toHaveCount(3);
  for (let i = 0; i < TAB_LABELS.length; i++) {
    await expect(tabs.nth(i)).toHaveText(TAB_LABELS[i]);
  }

  for (let i = 0; i < SECTION_HEADINGS.length; i++) {
    await tabs.nth(i).click();
    // Scopen op directe kinderen: de theme-kaartjes (Weergave → Thema) hebben zelf ook een <h4>
    // per kleurstaal, die géén sectiekop is en dus niet mag meetellen.
    const headings = container.locator('.settings-section-list > .settings-section > h3, .settings-section-list > h4.settings-subhead');
    await expect(headings).toHaveCount(SECTION_HEADINGS[i].length);
    for (let j = 0; j < SECTION_HEADINGS[i].length; j++) {
      await expect(headings.nth(j)).toHaveText(SECTION_HEADINGS[i][j]);
    }
  }

  // De sectie Project (issue-regel 1) is nergens meer te vinden — niet als tabnaam, niet als
  // sectiekop, niet als de oude snelkoppelingsknop "Projectinformatie...".
  await expect(container.getByText(PROJECT_SECTION_TEXT, { exact: true })).toHaveCount(0);
}

test('gear-popup, Instellingen-ribbontab en Backstage tonen dezelfde drie tabs zonder de sectie Project', async ({ page, ops: _ops }) => {
  // 1) Tandwiel-popup (⚙) in de titelbalk.
  await page.getByTitle(/^(Settings|Instellingen)$/, { exact: true }).click();
  const gearDialog = page.locator('.settings-dialog');
  await expect(gearDialog).toBeVisible();
  await assertThreeTabsAndSections(gearDialog);
  await gearDialog.locator('.modal-close-btn').click();
  await expect(gearDialog).toBeHidden();

  // 2) Instellingen-ribbontab → knop "Instellingen"/"Settings" in de Project-lintgroep.
  await page.locator('.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  await page.locator('.ribbon-content').getByRole('button', { name: /^(Settings|Instellingen)$/, exact: true }).click();
  const ribbonDialog = page.locator('.settings-dialog');
  await expect(ribbonDialog).toBeVisible();
  await assertThreeTabsAndSections(ribbonDialog);
  await ribbonDialog.locator('.modal-close-btn').click();
  await expect(ribbonDialog).toBeHidden();

  // 3) Backstage (Bestand-tab) → navitem "Instellingen"/"Settings" — geen dialoog, direct in de body.
  await page.locator('.ribbon-tab--file').click();
  const backstage = page.locator('.backstage');
  await expect(backstage).toBeVisible();
  await backstage.locator('.backstage-nav-item').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  await assertThreeTabsAndSections(backstage.locator('.backstage-main'));
});
