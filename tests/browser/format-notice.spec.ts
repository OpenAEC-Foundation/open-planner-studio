// F2: taakdatums worden op D1/D2/D7-momenten vergeleken (§4.2); de echte handeling blijft gelijk.
// Uitleg na het openen van een ander formaat dan IFC (eigenaarsbesluit 2026-10-12, optie 1).
// Echte gebruikersflow: bestanden via de ribbonknop Openen en de bestandskiezer, de dialoog en de
// instelling met echte klikken. `window.__OPS__` zet alleen de beginstand (uitleg aan; de fixture
// zet hem voor de rest van de suite uit) en LEEST de uitkomst.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tUitlegBrowser\tC1\t2026-03-02\t2026-01-05',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tNiet gestart\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%E',
].join('\n');
const IFC = readFileSync(join(process.cwd(), 'public/examples/10-villa-wassenaar.ifc'));

const notice = (page: Page) => page.locator('[data-ops-format-notice]');
const documentCount = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().documents.length);

/** Open via de ribbonknop en de bestandskiezer. Het eerste bestand hergebruikt het lege tabblad
 *  van de fixture; elk volgend bestand krijgt een nieuw tabblad. Wacht tot het project er staat. */
async function openFile(page: Page, name: string, buffer: Buffer, firstFile = false): Promise<void> {
  const before = await documentCount(page);
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name, mimeType: 'application/octet-stream', buffer });
  if (firstFile) {
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBeGreaterThan(0);
  } else {
    await expect.poll(() => documentCount(page)).toBe(before + 1);
  }
}

async function setXerNoticeInSettings(page: Page, shown: boolean): Promise<void> {
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  const settings = page.locator('.settings-dialog');
  await expect(settings).toBeVisible();
  await settings.getByRole('button', { name: /^(Advanced|Geavanceerd)$/ }).click();
  const box = settings.locator('[data-ops-setting-format-notice-kind="xer"]');
  await expect(box).toBeChecked({ checked: !shown });
  await box.click();
  await expect(box).toBeChecked({ checked: shown });
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
}

test('formaatuitleg: XER toont hem, "niet meer tonen" werkt, Instellingen zet hem terug, IFC nooit',
  async ({ page, ops: _ops }) => {
    await page.evaluate(() => {
      localStorage.setItem('ops-formatNoticeHidden', '[]');
      window.__OPS__!.store.getState().setUI({ formatNoticeHidden: [] });
    });

    // 1. XER openen ⇒ de uitleg voor XER, met de drie blokken.
    await openFile(page, 'uitleg.xer', Buffer.from(XER), true);
    await expect(notice(page)).toHaveAttribute('data-ops-format-notice', 'xer');
    await expect(notice(page)).toContainText(/(Primavera file \(\.xer\) opened|Primavera-bestand \(\.xer\) geopend)/);
    await expect(notice(page).locator('[data-ops-format-notice-kept]')).toContainText(/(activity codes|activiteitcodes)/);
    await expect(notice(page).locator('[data-ops-format-notice-save]')).toContainText(/(Writing back to \.xer is not possible|Terugschrijven naar \.xer kan niet)/);

    // 2. "Niet meer tonen" aanvinken en sluiten ⇒ bewaard.
    await notice(page).locator('[data-ops-format-notice-dont-show]').check();
    await notice(page).locator('[data-ops-format-notice-close]').click();
    await expect(notice(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ops-formatNoticeHidden'))).toBe('["xer"]');

    // 3. Opnieuw een XER ⇒ geen uitleg.
    await openFile(page, 'uitleg-2.xer', Buffer.from(XER));
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.pendingFormatNotice)).toBeNull();
    await expect(notice(page)).toHaveCount(0);

    // 4. Instellingen → Geavanceerd: XER weer aan ⇒ de uitleg komt terug.
    await setXerNoticeInSettings(page, true);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ops-formatNoticeHidden'))).toBe('[]');
    await openFile(page, 'uitleg-3.xer', Buffer.from(XER));
    await expect(notice(page)).toHaveAttribute('data-ops-format-notice', 'xer');
    // Escape sluit zonder vinkje: de uitleg blijft aan.
    await page.keyboard.press('Escape');
    await expect(notice(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('ops-formatNoticeHidden'))).toBe('[]');

    // 5. IFC openen ⇒ nooit een uitleg.
    await openFile(page, 'villa.ifc', IFC);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.pendingFormatNotice)).toBeNull();
    await expect(notice(page)).toHaveCount(0);

    // 6. Opnieuw een XER, dan "Lees meer" sluit de uitleg en opent de XER-gids in Help (zonder vinkje: blijft aan).
    await openFile(page, 'uitleg-4.xer', Buffer.from(XER));
    await expect(notice(page)).toHaveAttribute('data-ops-format-notice', 'xer');
    await notice(page).locator('[data-ops-format-notice-read-more]').click();
    await expect(notice(page)).toHaveCount(0);
    await expect(page.locator('.help-panel')).toBeVisible();
    await expect(page.locator('.help-article-body')).toHaveAttribute('data-help-current', 'howto-xer-openen');
    expect(await page.evaluate(() => localStorage.getItem('ops-formatNoticeHidden'))).toBe('[]');
  });

// Integratie ronde 2 (#325 × #330): een P6 XML-bestand met meerdere projecten opent meerdere
// documenten, maar geeft één uitleg (één open-actie). Een P6 XML zonder leesbare activiteit opent
// niet: dan een foutmelding en géén uitleg.
const P6XML_MULTI = readFileSync(join(process.cwd(), 'tests/planning/fixtures/p6xml-genest-meerdere-projecten.xml'));
const P6XML_EMPTY = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects"><Project><ObjectId>7</ObjectId><Name>Leeg</Name></Project></APIBusinessObjects>`);

test('formaatuitleg: P6 XML en CSV openen met uitleg; onleesbare imports geven alleen een fout',
  async ({ page, ops }) => {
    // De mislukte import logt zijn fout (`Failed to open file`) naast de melding; die fout is hier verwacht.
    ops.acceptError(/Failed to open file: P6XmlImportError/);
    ops.acceptError(/Failed to open file: CsvDateImportError/);
    await page.evaluate(() => {
      localStorage.setItem('ops-formatNoticeHidden', '[]');
      window.__OPS__!.store.getState().setUI({ formatNoticeHidden: [] });
    });
    // Tel elke keer dat de store een uitleg klaarzet (ook als dezelfde soort twee keer zou komen).
    await page.evaluate(() => {
      const w = window as unknown as { __noticeSets: string[] };
      w.__noticeSets = [];
      window.__OPS__!.store.subscribe((state, prev) => {
        if (state.ui.pendingFormatNotice && state.ui.pendingFormatNotice !== prev.ui.pendingFormatNotice) {
          w.__noticeSets.push(state.ui.pendingFormatNotice);
        }
      });
    });
    const noticeSets = () => page.evaluate(() => (window as unknown as { __noticeSets: string[] }).__noticeSets);

    // Knownbug 128: documentinhoud en undo/opslagdoel mogen bij een weigering niet veranderen.
    // Alleen observeren; openen en wegklikken gaan via echte browserbediening.
    const documentData = () => page.evaluate(() => {
      const state = window.__OPS__!.store.getState();
      return JSON.stringify({
        active: state.activeDocumentId,
        documents: state.getOpenDocumentPayloads().map(({ id, payload }) => ({
          id, project: payload.project, tasks: payload.tasks, sequences: payload.sequences,
          calendar: payload.calendar, resources: payload.resources, assignments: payload.assignments,
          filePath: payload.filePath, isDirty: payload.isDirty,
        })),
        history: state.historyEvents, nextHistorySequence: state.nextHistorySequence,
        recentFiles: state.recentFiles,
      });
    });
    const rejectCsv = async (content: string, column: string, value: string) => {
      const before = await documentData();
      const ids = await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.map(n => n.id));
      const chooser = page.waitForEvent('filechooser');
      await page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ }).click();
      await (await chooser).setFiles({ name: 'onleesbaar.csv', mimeType: 'text/csv', buffer: Buffer.from(content) });
      const error = page.locator('.ops-toast.toast-error', { hasText: value });
      await expect(error).toHaveCount(1);
      await expect(error).toContainText(/CSV (niet geopend|not opened)/);
      await expect(error).toContainText(/(CSV-rij 3|CSV row 3)/);
      await expect(error).toContainText(column);
      await expect(error).toContainText(/(jjjj-mm-dd|yyyy-mm-dd)/);
      expect(await page.evaluate(previous => window.__OPS__!.store.getState().ui.notifications
        .filter(n => !previous.includes(n.id))
        .map(n => ({ severity: n.severity, messageKey: n.messageKey, params: n.params })), ids)).toEqual([{
        severity: 'error', messageKey: 'notifications.csvInvalidDate', params: { row: 3, column, value },
      }]);
      expect(await documentData()).toBe(before);
      expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.pendingFormatNotice)).toBeNull();
      await expect(notice(page)).toHaveCount(0);
      await error.locator('[data-ops-toast-close]').click();
      await expect(error).toHaveCount(0);
    };

    // Leeg/pristine tabblad: ook geen gedeeltelijke commit van de eerste, geldige CSV-rij.
    await rejectCsv([
      'Naam;Duur;Startdatum;Einddatum;Werkelijke start',
      'Geldig;1;2015-01-05;2015-01-05;',
      'Onleesbaar;1;2015-01-06;2015-01-06;2 maart 2026',
    ].join('\n'), 'Werkelijke start', '2 maart 2026');
    expect(await noticeSets()).toEqual([]);

    // 1. Meerdere projecten ⇒ twee documenten (het lege tabblad wordt hergebruikt), één uitleg.
    const before = await documentCount(page);
    const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
    let chooser = page.waitForEvent('filechooser');
    await openButton.click();
    await (await chooser).setFiles({ name: 'meerdere.xml', mimeType: 'application/xml', buffer: P6XML_MULTI });
    await expect.poll(() => documentCount(page)).toBe(before + 1);
    await expect(notice(page)).toHaveAttribute('data-ops-format-notice', 'p6xml');
    await expect(notice(page)).toHaveCount(1);
    // De tekst klopt met de lezer van #330: baselines komen mee.
    await expect(notice(page).locator('[data-ops-format-notice-kept]')).toContainText(/(baseline project becomes a baseline|baselineproject wordt een baseline)/);
    expect(await noticeSets()).toEqual(['p6xml']);
    await notice(page).locator('[data-ops-format-notice-close]').click();
    await expect(notice(page)).toHaveCount(0);
    expect(await noticeSets()).toEqual(['p6xml']);

    // 2. P6 XML zonder activiteiten ⇒ foutmelding, geen nieuw document, geen uitleg.
    const docs = await documentCount(page);
    chooser = page.waitForEvent('filechooser');
    await openButton.click();
    await (await chooser).setFiles({ name: 'leeg.xml', mimeType: 'application/xml', buffer: P6XML_EMPTY });
    await expect(page.locator('.ops-toast', { hasText: /(no activities the app can read|geen activiteiten die de app kan lezen)/ })).toHaveCount(1);
    expect(await documentCount(page)).toBe(docs);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.pendingFormatNotice)).toBeNull();
    await expect(notice(page)).toHaveCount(0);
    expect(await noticeSets()).toEqual(['p6xml']);

    // Gevulde documentset: een onleesbaar gepland einde weigeren, alle documenten behouden.
    const invalidCsv = [
      'Name,Duration,Start,Finish',
      'ISO,1,2015-01-05,2015-01-05',
      'DMY,1,06-01-2015,Mon 3/2/26',
      'Leeg,1,,',
    ].join('\n');
    await rejectCsv(invalidCsv, 'Finish', 'Mon 3/2/26');
    expect(await noticeSets()).toEqual(['p6xml']);

    // De gebruiker herstelt de cel en opent opnieuw: ISO/DMY/slash én lege datums importeren.
    await openFile(page, 'hersteld.csv', Buffer.from(invalidCsv.replace('Mon 3/2/26', '06/01/2015')));
    await expect(notice(page)).toHaveAttribute('data-ops-format-notice', 'csv');
    expect(await noticeSets()).toEqual(['p6xml', 'csv']);
    expect(await page.evaluate(() => {
      const state = window.__OPS__!.store.getState();
      return {
        filePath: state.filePath,
        tasks: state.tasks.map(t => ({
          name: t.name, start: t.time.scheduleStart, finish: t.time.scheduleFinish,
          actualStart: t.time.actualStart ?? null, actualFinish: t.time.actualFinish ?? null,
        })),
      };
    })).toEqual({
      filePath: null,
      tasks: [
        { name: 'ISO', start: "2015-01-05T07:00", finish: "2015-01-05T16:00", actualStart: null, actualFinish: null },
        { name: 'DMY', start: "2015-01-06T07:00", finish: "2015-01-06T16:00", actualStart: null, actualFinish: null },
        { name: 'Leeg', start: "2015-01-05T07:00", finish: "2015-01-05T16:00", actualStart: null, actualFinish: null },
      ],
    });
    await notice(page).locator('[data-ops-format-notice-close]').click();
  });
