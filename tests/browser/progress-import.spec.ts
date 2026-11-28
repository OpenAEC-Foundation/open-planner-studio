import type { Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';
import { parseProgressXlsx } from '@/services/progressImport/parseProgressXlsx';
import { detectDateOrder } from '@/services/progressImport/sheetValues';
import { writeProgressSheetXLSX } from '@/services/xlsx/writeProgressXlsx';
import { parseZipEntries, writeZip } from '@/services/zip';
import { xlsxFromText } from '../planning/progressSheetFixture';
import type { Task } from '@/types/task';

const DIALOG = '[data-ops-progress-import-dialog]';

const CHOOSE_FILE = /^(Choose file…|Bestand kiezen…)$/;
const CANCEL = /^(Cancel|Annuleren)$/;
const APPLY = /^(Apply|Toepassen)$/;
const CLOSE = /^(Close|Sluiten)$/;
const CLEAR_LINK = /^(Clear link|Koppeling wissen)$/;
const KEEP_APP = /^(Keep app|App houden)$/;
const USE_SHEET = /^(Use sheet|Blad overnemen)$/;
const NEEDS_LINK_HEADING = /^(Waiting for a link|Wacht op koppeling)$/;
const PICKER_PLACEHOLDER = /^(Choose a task…|Kies een taak…)$/;
const PROGRESS_IMPORT_BUTTON = /^(Update progress from a spreadsheet|Voortgang bijwerken uit een blad)$/;

function dialog(page: Page) {
  return page.locator(DIALOG);
}

function footerCloseButton(page: Page) {
  return dialog(page).getByRole('button', { name: CLOSE }).filter({ hasText: CLOSE });
}

function rowByNumber(page: Page, rowNumber: number) {
  return page.locator(`[data-ops-progress-row="${rowNumber}"]`);
}

async function openViaBackstage(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'file', backstageSection: 'import' });
  });
  await expect(page.locator('[data-ops-progress-import-card]')).toContainText(/\.xlsx/);
  await page.locator('[data-ops-progress-import-card]').click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText(/\.xlsx/);
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function chooseSheet(
  page: Page, name: string, mimeType: string, buffer: Buffer,
): Promise<void> {
  await page.evaluate(() => {
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await dialog(page).getByRole('button', { name: CHOOSE_FILE }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name, mimeType, buffer });
}

async function chooseTextSheet(page: Page, text: string): Promise<void> {
  await chooseSheet(page, 'voortgang.xlsx', XLSX_MIME, Buffer.from(await xlsxFromText(text)));
}

async function downloadBytes(download: { createReadStream: () => Promise<NodeJS.ReadableStream | null> }): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function storeTasks(page: Page): Promise<Task[]> {
  return page.evaluate(() => JSON.parse(
    JSON.stringify(window.__OPS__!.store.getState().tasks),
  ) as unknown) as Promise<Task[]>;
}

async function exportProgressSheet(page: Page): Promise<{ name: string; bytes: Buffer }> {
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'planning' });
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: EXPORT_BUTTON }).click();
  const download = await downloadPromise;
  return { name: download.suggestedFilename(), bytes: await downloadBytes(download) };
}

async function taskTime(page: Page, taskId: string) {
  return page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    return {
      completion: t.time.completion,
      actualStart: t.time.actualStart,
      actualFinish: t.time.actualFinish,
    };
  }, taskId);
}

async function taskInfo(page: Page, taskId: string) {
  return page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    return { id: t.id, wbsCode: t.wbsCode, name: t.name };
  }, taskId);
}

test('preview toont wijzigingen en weigeringen, annuleren laat het document ongemoeid', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Cancel-taak A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);

  await openViaBackstage(page);
  await chooseTextSheet(page, [
    'OPS Task ID;Completion (%)',
    `${idA};40`,
    'niet-bestaand-id;40',
    '',
  ].join('\r\n'));

  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await expect(page.getByText(NEEDS_LINK_HEADING)).toBeVisible();

  await dialog(page).getByRole('button', { name: CANCEL }).click();
  await expect(dialog(page)).toBeHidden();

  const after = await taskTime(page, idA);
  expect(after.completion).toBe(0);
});

test('bevestigen past het blad toe en één Ctrl+Z draait het hele blad terug', async ({ page, ops: _ops }) => {
  const [idA, idB] = await seedProject(page, [
    { name: 'Apply-taak A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Apply-taak B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);

  await openViaBackstage(page);
  await chooseTextSheet(page, [
    'OPS Task ID;Completion (%)',
    `${idA};40`,
    `${idB};70`,
    '',
  ].join('\r\n'));

  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await dialog(page).getByRole('button', { name: APPLY }).click();
  await expect(footerCloseButton(page)).toBeVisible();

  const afterA = await taskTime(page, idA);
  const afterB = await taskTime(page, idB);
  expect(afterA.completion).toBe(0.4);
  expect(afterB.completion).toBe(0.7);

  await footerCloseButton(page).click();
  await expect(dialog(page)).toBeHidden();

  await page.keyboard.press('Control+z');
  await expect.poll(() => taskTime(page, idA).then(t => t.completion)).toBe(0);
  const undoneB = await taskTime(page, idB);
  expect(undoneB.completion).toBe(0);
});

test('een losse rij handmatig koppelen laat hem meedraaien', async ({ page, ops: _ops }) => {
  const [idA, idB, idC] = await seedProject(page, [
    { name: 'Koppel-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'WBS-keuze A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'WBS-keuze B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(({ idB, idC }) => {
    window.__OPS__!.store.setState(s => {
      for (const task of s.tasks) if (task.id === idB || task.id === idC) task.wbsCode = 'DUBBEL';
    });
  }, { idB, idC });
  const info = await taskInfo(page, idA);
  const infoB = await taskInfo(page, idB);

  await openViaBackstage(page);
  await chooseTextSheet(page, [
    'OPS Task ID;WBS;Name;Completion (%)',
    'onbekend-id;;;55',
    'ander-project-id;DUBBEL;Bladtaak;65',
    `${idC};;;`,
    `${idC};;;80`,
    '',
  ].join('\r\n'));

  const needsLinkSection = dialog(page).getByText(NEEDS_LINK_HEADING).locator('..');
  const unknownRow = rowByNumber(page, 2);
  const ambiguousRow = rowByNumber(page, 3);
  const duplicateRow = rowByNumber(page, 5);
  const unmatchedReason = /^(No task found for this row\.|Geen taak gevonden voor deze rij\.)$/;
  const ambiguousReason = /^(This WBS code occurs on multiple tasks — link the row by hand\.|Deze WBS-code komt bij meerdere taken voor — koppel de rij met de hand\.)$/;

  await expect(needsLinkSection).toBeVisible();
  await expect(needsLinkSection.locator('[data-ops-progress-row]')).toHaveCount(2);
  await expect(unknownRow.locator('.font-medium')).toHaveText('OPS Task ID: onbekend-id');
  await expect(unknownRow.getByText(unmatchedReason)).toBeVisible();
  await expect(unknownRow.getByText(/^(row 2 in the sheet|rij 2 in het blad)$/)).toBeVisible();
  await expect(ambiguousRow.locator('.font-medium')).toHaveText('DUBBEL Bladtaak');
  await expect(ambiguousRow.getByText('OPS Task ID: ander-project-id', { exact: true })).toBeVisible();
  await expect(ambiguousRow.getByText(ambiguousReason)).toBeVisible();
  await expect(ambiguousRow.getByText(/^(row 3 in the sheet|rij 3 in het blad)$/)).toBeVisible();
  await expect(duplicateRow).toContainText(/Another row already claimed this task\.|Een andere rij claimde deze taak al\./);
  await expect(duplicateRow.getByRole('button', { name: PICKER_PLACEHOLDER })).toHaveCount(0);
  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeDisabled();

  await unknownRow.getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  await page.getByRole('option', { name: new RegExp(info.name) }).click();
  await expect(unknownRow.getByText(unmatchedReason)).toHaveCount(0);

  await unknownRow.getByRole('button', { name: CLEAR_LINK }).click();
  await expect(unknownRow.locator('.font-medium')).toHaveText('OPS Task ID: onbekend-id');
  await expect(unknownRow.getByText(unmatchedReason)).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeDisabled();
  await unknownRow.getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  await page.getByRole('option', { name: new RegExp(info.name) }).click();
  await ambiguousRow.getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  await page.getByRole('option', { name: new RegExp(infoB.name) }).click();
  await expect(ambiguousRow).toContainText(infoB.name);
  await expect(ambiguousRow.getByText(ambiguousReason)).toHaveCount(0);
  await expect(dialog(page).getByText(NEEDS_LINK_HEADING)).toHaveCount(0);
  expect((await taskTime(page, idA)).completion).toBe(0);
  expect((await taskTime(page, idB)).completion).toBe(0);

  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await dialog(page).getByRole('button', { name: APPLY }).click();
  await expect(footerCloseButton(page)).toBeVisible();

  expect((await taskTime(page, idA)).completion).toBe(0.55);
  expect((await taskTime(page, idB)).completion).toBe(0.65);
  expect((await taskTime(page, idC)).completion).toBe(0);
  await expect(duplicateRow).toContainText(/Another row already claimed this task\.|Een andere rij claimde deze taak al\./);
});

test('koppelkiezer met plaatshouder: bij openen geen actieve optie, Enter en Spatie kiezen niets', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Koppel-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await openViaBackstage(page);
  await chooseTextSheet(page, [
    'OPS Task ID;Completion (%)',
    'onbekend-id;55',
    '',
  ].join('\r\n'));
  await expect(page.getByText(NEEDS_LINK_HEADING)).toBeVisible();

  const picker = rowByNumber(page, 2).getByRole('button', { name: PICKER_PLACEHOLDER });
  await picker.click();
  const list = page.locator('.ops-select__menu');
  await expect(list).toBeVisible();
  await expect(list.locator('.ops-select__option.is-highlighted')).toHaveCount(0);
  await expect(list).not.toHaveAttribute('aria-activedescendant', /./);

  await page.keyboard.press('Enter');
  await page.keyboard.press(' ');
  await expect(picker).toHaveText(PICKER_PLACEHOLDER);
  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeDisabled();

  await expect(list).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(list.locator('[role="option"]').first()).toHaveClass(/is-highlighted/);
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(dialog(page)).toBeVisible();
});

test('een al gekoppelde taak is niet nog eens kiesbaar', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Enige-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const info = await taskInfo(page, idA);

  await openViaBackstage(page);
  await chooseTextSheet(page, [
    'OPS Task ID;Completion (%)',
    'onbekend-1;40',
    'onbekend-2;60',
    '',
  ].join('\r\n'));

  await rowByNumber(page, 2).getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  await page.getByRole('option', { name: new RegExp(info.name) }).click();

  await rowByNumber(page, 3).getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  const takenOption = page.getByRole('option', { name: new RegExp(info.name) });
  await expect(takenOption).toBeVisible();
  await expect(takenOption).toHaveAttribute('aria-disabled', 'true');
});

test('een bestand met alleen dubbelzinnige datums vraagt de volgorde', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Datumtaak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const info = await taskInfo(page, idA);

  await openViaBackstage(page);
  await chooseTextSheet(page, [
    'WBS;Actual Start',
    `${info.wbsCode};3-4-2026`,
    '',
  ].join('\r\n'));

  await expect(page.getByText('3-4-2026')).toBeVisible();
  const optionButtons = dialog(page).locator('button[class*="self-start"]');
  await expect(optionButtons).toHaveCount(2);
});

test('de keuze werkt door in de preview', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Datumtaak2', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const info = await taskInfo(page, idA);

  await openViaBackstage(page);
  await chooseTextSheet(page, [
    'WBS;Actual Start',
    `${info.wbsCode};3-4-2026`,
    '',
  ].join('\r\n'));

  const optionButtons = dialog(page).locator('button[class*="self-start"]');
  await expect(optionButtons).toHaveCount(2);
  await optionButtons.nth(1).click();

  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await dialog(page).getByRole('button', { name: APPLY }).click();
  await expect(footerCloseButton(page)).toBeVisible();

  const after = await taskTime(page, idA);
  expect(after.actualStart).toBe("2026-03-04T07:00");
});

test('de Tabel-tabknop opent dezelfde dialoog', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Tabel-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'table' }));
  await page.getByRole('button', { name: PROGRESS_IMPORT_BUTTON }).click();
  await expect(dialog(page)).toBeVisible();

  await chooseSheet(page, 'voortgang.csv', 'text/csv', Buffer.from('OPS Task ID;Completion (%)\r\ntaak;50\r\n', 'utf-8'));
  await expect(dialog(page)).toContainText(/(can only be read as an Excel file|alleen als Excel-bestand gelezen)/);
  await expect(dialog(page).getByRole('button', { name: CHOOSE_FILE })).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: APPLY })).toHaveCount(0);
});

test('de knop staat niet op de Start-tab', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Start-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'start' }));
  await expect(page.getByRole('button', { name: PROGRESS_IMPORT_BUTTON })).toHaveCount(0);
});

test('wisselen is onmogelijk zolang de dialoog openstaat', async ({ page, ops: _ops }) => {
  const [taskA] = await seedProject(page, [
    { name: 'Doc1-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Document 1');
  const doc1Id = (await state(page)).activeDocumentId;
  const info = await taskInfo(page, taskA);

  const doc2Id = await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  await seedProject(page, [
    { name: 'Doc2-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Document 2');

  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), doc1Id);
  await expect.poll(() => state(page).then(s => s.activeDocumentId)).toBe(doc1Id);

  await openViaBackstage(page);
  await chooseTextSheet(page, [
    'OPS Task ID;Completion (%)',
    'onbekend-doc1;40',
    '',
  ].join('\r\n'));

  await expect(page.getByText(NEEDS_LINK_HEADING)).toBeVisible();
  await rowByNumber(page, 2).getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  await page.getByRole('option', { name: new RegExp(info.name) }).click();
  await expect(rowByNumber(page, 2).getByRole('button', { name: CLEAR_LINK })).toBeVisible();

  const docTab2 = page.locator(`[data-testid="document-tab"][data-ops-tab="${doc2Id}"]`);
  await expect(docTab2).toBeVisible();
  await expect(docTab2.click({ timeout: 2000 })).rejects.toThrow(/intercepts pointer events/);

  await page.keyboard.press('Control+2');

  await expect.poll(() => state(page).then(s => s.activeDocumentId)).toBe(doc1Id);
  await expect(dialog(page)).toBeVisible();
  await expect(rowByNumber(page, 2).getByRole('button', { name: CLEAR_LINK })).toBeVisible();

  let fileChooserFired = false;
  const onFileChooser = () => { fileChooserFired = true; };
  page.on('filechooser', onFileChooser);
  await page.keyboard.press('Control+o');
  await page.waitForTimeout(300);
  page.off('filechooser', onFileChooser);

  expect(fileChooserFired).toBe(false);
  const afterCtrlO = await state(page);
  expect(afterCtrlO.activeDocumentId).toBe(doc1Id);
  expect(afterCtrlO.documentIds).toHaveLength(2);
  await expect(dialog(page)).toBeVisible();
  await expect(rowByNumber(page, 2).getByRole('button', { name: CLEAR_LINK })).toBeVisible();
});

const EXPORT_BUTTON = /^(Export progress sheet|Voortgangsblad exporteren)$/;

test('voortgangsblad-export: knop op Planning levert een leesbaar .xlsx in de downloads', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Voortgangsblad-export');

  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    s.setActualStart(id, '2026-09-07');
    s.setTaskProgress(id, 0.4);
  }, idA);

  const { name, bytes } = await exportProgressSheet(page);

  expect(name).toBe('Voortgangsblad-export-progress.xlsx');
  expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

  const sheet = await parseProgressXlsx(new Uint8Array(bytes));
  expect(sheet.fileIssue).toBeUndefined();
  expect(sheet.rawRows).toHaveLength(1);

  const row = sheet.rawRows[0]!;
  expect(row.taskId).toBe(idA);
  expect(row.wbsCode).toBeTruthy();
  expect(row.name).toBe('Fundering');
  expect(row.rawCompletion).toBeTruthy();
  expect(row.rawActualStart).toBe("2026-09-07T07:00");
  expect(row.rawActualFinish === undefined || row.rawActualFinish === '').toBe(true);
  const detected = new Set(sheet.detectionCells.map(cell => cell.field));
  expect(detected.has('start')).toBe(true);
  expect(detected.has('finish')).toBe(true);
  expect(detected.has('actualStart')).toBe(true);

  const tasks = await storeTasks(page);
  const detection = detectDateOrder(sheet.detectionCells, tasks);
  expect(detection.order).not.toBe('ambiguous');
  expect(detection.order === 'ambiguous' ? undefined : detection.evidence).toBe('noAmbiguity');
});

test('exporteren en meteen terugimporteren geeft nul wijzigingen', async ({ page, ops: _ops }) => {
  const [idA, idB] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Ruwbouw', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
  ], 'Voortgangsblad-noop');

  await page.evaluate(([a, b]) => {
    const s = window.__OPS__!.store.getState();
    s.setActualStart(a, '2026-09-07');
    s.setTaskProgress(a, 1 / 3);
    s.setTaskProgress(b, 0);
  }, [idA, idB] as const);

  const { bytes } = await exportProgressSheet(page);

  await openViaBackstage(page);
  await chooseSheet(page, 'voortgang.xlsx', XLSX_MIME, Buffer.from(bytes));

  await expect(dialog(page).getByText(/^(Day or month first\?|Dag of maand eerst\?)$/)).toHaveCount(0);
  await expect(dialog(page).getByText(/^(Applied|Toegepast): 0$/)).toBeVisible();
  await expect(dialog(page).getByText(/^(Refused|Geweigerd): 0$/)).toBeVisible();
  await expect(dialog(page).getByText(/^(Unchanged|Ongewijzigd): 2$/)).toBeVisible();
  await expect(page.getByText(NEEDS_LINK_HEADING)).toHaveCount(0);
  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeDisabled();

  await dialog(page).getByRole('button', { name: CANCEL }).click();
  await expect(dialog(page)).toHaveCount(0);

  const after = await taskTime(page, idA);
  expect(after.completion).toBeCloseTo(1 / 3, 4);
  expect(after.actualStart).toBe("2026-09-07T07:00");
});

test('een gewijzigd .xlsx-blad komt zonder datumvraag terug het document in', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Terugimport-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Voortgangsblad-terugimport');

  const exported = await exportProgressSheet(page);
  const exportedSheet = await parseProgressXlsx(new Uint8Array(exported.bytes));
  expect(exportedSheet.fileIssue).toBeUndefined();
  expect(exportedSheet.rawRows[0]?.taskId).toBe(idA);

  const tasks = await storeTasks(page);
  const mutated = tasks.map(task => (task.id === idA
    ? { ...task, time: { ...task.time, completion: 0.65 } }
    : task));
  const buffer = Buffer.from(await writeProgressSheetXLSX(mutated));

  await openViaBackstage(page);
  await chooseSheet(page, 'voortgang.xlsx', XLSX_MIME, buffer);

  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await expect(page.getByText(NEEDS_LINK_HEADING)).toHaveCount(0);
  await expect(rowByNumber(page, 2)).toBeVisible();

  await dialog(page).getByRole('button', { name: APPLY }).click();
  await expect(footerCloseButton(page)).toBeVisible();

  const after = await taskTime(page, idA);
  expect(after.completion).toBeCloseTo(0.65, 5);
});

async function typeCompletion(bytes: Buffer, cells: Record<string, number>): Promise<Buffer> {
  const part = 'xl/worksheets/sheet1.xml';
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const entries = await parseZipEntries(buffer);
  const files = entries.map((entry) => {
    if (entry.name !== part) return { name: entry.name, data: entry.data };
    let xml = new TextDecoder().decode(entry.data);
    for (const [ref, value] of Object.entries(cells)) {
      const next = xml.replace(new RegExp(`(<c r="${ref}"[^>]*><v>)[^<]*(</v>)`), `$1${value}$2`);
      expect(next).not.toBe(xml);
      xml = next;
    }
    return { name: entry.name, data: new TextEncoder().encode(xml) };
  });
  return Buffer.from(await writeZip(files));
}

test('na de export gewijzigd: de app-waarde blijft en een botsing vraagt een keuze', async ({ page, ops: _ops }) => {
  const [idA, idB, idC] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Ruwbouw', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
    { name: 'Afbouw', start: '2026-10-05', finish: '2026-10-16', durationDays: 10 },
  ], 'Voortgangsblad-sinds-export');
  await page.evaluate(() => { window.__OPS__!.store.getState().setStatusDate('2026-10-30'); });

  const { bytes } = await exportProgressSheet(page);
  const filled = await typeCompletion(bytes, { F3: 40, F4: 60 });

  await page.evaluate(([a, b]) => {
    const s = window.__OPS__!.store.getState();
    s.setTaskProgress(a, 0.5);
    s.setTaskProgress(b, 0.3);
  }, [idA, idB] as const);

  await openViaBackstage(page);
  await chooseSheet(page, 'voortgang.xlsx', XLSX_MIME, filled);

  const conflicts = dialog(page).locator('[data-ops-progress-conflicts]');
  await expect(conflicts).toContainText(/Ruwbouw/);
  await expect(conflicts).not.toContainText(/Fundering/);
  const apply = dialog(page).getByRole('button', { name: APPLY });
  await expect(apply).toBeDisabled();
  await expect(dialog(page)).toContainText(/(First choose app or sheet|Kies eerst bij elke botsing)/);
  await expect(dialog(page)).toContainText(/(Changed only in the app since the export|Alleen in de app gewijzigd sinds de export)/);

  const row = conflicts.locator('[data-ops-progress-row]');
  await conflicts.getByRole('button', { name: USE_SHEET }).first().click();
  await expect(row.getByRole('button', { name: USE_SHEET })).toHaveAttribute('aria-pressed', 'true');
  await expect(apply).toBeEnabled();
  await row.getByRole('button', { name: KEEP_APP }).click();
  await expect(row.getByRole('button', { name: KEEP_APP })).toHaveAttribute('aria-pressed', 'true');
  await expect(row.getByRole('button', { name: USE_SHEET })).toHaveAttribute('aria-pressed', 'false');

  await apply.click();
  await expect(footerCloseButton(page)).toBeVisible();
  expect((await taskTime(page, idA)).completion).toBeCloseTo(0.5, 5);
  expect((await taskTime(page, idB)).completion).toBeCloseTo(0.3, 5);
  expect((await taskTime(page, idC)).completion).toBeCloseTo(0.6, 5);
});
