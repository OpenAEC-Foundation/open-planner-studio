// Het Rapport-tabblad voor de Gantt-afdruk (issue #817). Eén werkroute van een planner: tabblad openen, op het
// papier klikken om een stap te openen, een kolom toevoegen, Herstel standaard en ongedaan maken, de zijbalk
// inklappen, een zwevend venster verslepen, erin typen en via de zwevende knop exporteren. Een verouderde planning
// is een fixture (via de store), de rest zijn echte klikken en toetsen.
// Het venster is 1280×720: de kleinste maat waarop melding, "Kolom toevoegen" en de stapkop in beeld moeten blijven.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import fontkit from '@pdf-lib/fontkit';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, type PDFPage } from 'pdf-lib';
import type { Download, Page } from '@playwright/test';
import { expect, seedProject, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';

// De voetstrook in de PDF (issue #113, "een blad per persoon"). De vector-pagineerder tekent per bronvenster
// `q  x y w h re W n  cm  /X0 Do  …tekst…  Q`. De voetstrook is het venster met de clip-rechthoek op de onderrand
// van het printgebied (y = marge 24 + paginanummerruimte 14), laag, en altijd vanaf x = 24 en één volle
// printbreedte breed, dus nooit per kolom gesneden. De tekst staat per venster onder dezelfde clip, dus het
// voetvenster van elke pagina draagt tekstoperatoren (de glyfs zijn gesubset, dus we tellen `Tj`/`TJ`).
const MARGIN_PT = 24;
const PAGE_NUMBER_PT = 14;

interface PageShape { width: number; draws: number; footerRects: { x: number; y: number; w: number; h: number; textOps: number }[] }

async function pageShapes(pdfBytes: Uint8Array): Promise<PageShape[]> {
  const doc = await PDFDocument.load(pdfBytes);
  const streamText = (page: PDFPage): string => {
    const contents = page.node.Contents();
    if (!contents) return '';
    const streams = contents instanceof PDFArray
      ? contents.asArray().map(ref => doc.context.lookup(ref))
      : [contents];
    return streams.map(stream => {
      if (!(stream instanceof PDFRawStream)) return '';
      const raw = stream.contents;
      const filter = stream.dict.get(PDFName.of('Filter'));
      const bytes = filter ? inflateSync(raw) : raw;
      return Buffer.from(bytes).toString('latin1');
    }).join('\n');
  };
  return doc.getPages().map(page => {
    const text = streamText(page);
    // Per tegelvenster (`q  x y w h re … Q`, met een stack voor geneste `q`/`Q` van halfdoorzichtige
    // tekst): de clip-rechthoek en het aantal tekstoperatoren erbinnen.
    const windows: { x: number; y: number; w: number; h: number; textOps: number }[] = [];
    const tokens = text.split(/\s+/);
    let depth = 0;
    let current: { depth: number; win: typeof windows[number] } | null = null;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === 'q') {
        depth++;
        if (!current && tokens[i + 5] === 're') {
          current = { depth, win: { x: Number(tokens[i + 1]), y: Number(tokens[i + 2]), w: Number(tokens[i + 3]), h: Number(tokens[i + 4]), textOps: 0 } };
        }
      } else if (tok === 'Q') {
        if (current && depth === current.depth) { windows.push(current.win); current = null; }
        depth--;
      } else if (current && (tok === 'Tj' || tok === 'TJ')) {
        current.win.textOps++;
      }
    }
    // Een clip-rechthoek op de onderrand van het printgebied die geen volle pagina hoog is, is de
    // voetstrook (50 logische px × schaal; bij een smal rapport is de schaal groter dan 0,75, bij
    // lettergrootte 125 % de strook hoger — vandaar geen krappe band). Een body-tegel die tot die
    // onderrand reikt is een volle pagina en dus meer dan de halve papierhoogte.
    const footerRects = windows.filter(r => Math.abs(r.y - (MARGIN_PT + PAGE_NUMBER_PT)) < 0.01 && r.h > 15 && r.h < page.getHeight() / 2);
    return { width: page.getWidth(), draws: (text.match(/\/X0 Do/g) ?? []).length, footerRects };
  });
}

/** Elke pagina: precies één voetvenster, vanaf de linkermarge, één volle printbreedte breed, mét tekst. */
function expectFullFooterOnEveryPage(shapes: PageShape[]): void {
  expect(shapes.length).toBeGreaterThan(1);
  for (const shape of shapes) {
    expect(shape.footerRects).toHaveLength(1);
    const footer = shape.footerRects[0];
    expect(footer.x).toBeCloseTo(MARGIN_PT, 1);
    expect(footer.w).toBeCloseTo(shape.width - 2 * MARGIN_PT, 1);
    // Projectnaam, afdrukdatum, merk en minstens één legendalabel: nooit een lege grijze strook.
    expect(footer.textOps).toBeGreaterThanOrEqual(4);
  }
}

/** Opent een stap in de zijbalk. Een klik op de kop van een open stap klapt hem dicht, en de open stap blijft
 *  bewaard, dus klik alleen als hij nog dicht is. */
async function openStep(page: Page, step: string): Promise<void> {
  const head = page.locator(`[data-rs-step-head="${step}"]`);
  if (await head.getAttribute('aria-expanded') !== 'true') await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
}

/** Exporteer via de knop in de zijbalk en geef de bytes van de PDF. */
async function exportStudioPdf(page: Page, name: RegExp): Promise<Uint8Array> {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-rs-export]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(name);
  const path = await download.path();
  expect(path).not.toBeNull();
  return new Uint8Array(await readFile(path!));
}

test('rapport-studio: klik op het papier opent de stap, kolom toevoegen, zijbalk inklappen', async ({ page, ops: _ops }) => {
  // Deze route loopt door alle stappen, layouts en een rapportwissel (~20–22 s lokaal); ruimte voor drukte in CI.
  test.slow();
  await seedProject(page, [
    { name: 'Fundering storten', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Wanden metselen', start: '2026-09-21', finish: '2026-10-09', durationDays: 15 },
  ], 'Rapportstudio');

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const studio = page.locator('[data-rs-studio]');
  await expect(studio).toBeVisible();
  // Het tabblad heeft geen lintinhoud: alleen de tabnamen blijven staan.
  await expect(page.locator('.ribbon-content')).toHaveCount(0);
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();

  // Eerste bezoek: stap 1 staat open, met boven het eerste blad de aanwijzing dat het papier klikbaar is.
  await expect(page.locator('[data-rs-step-body="tasks"]')).toBeVisible();
  await expect(page.locator('[data-rs-paper-hint]')).toBeVisible();

  // Bewegen over de kop: de naam staat boven het blad en dekt het blad niet af.
  const sheet = page.locator('[data-preview-page="0"]');
  const sheetBox = (await sheet.boundingBox())!;
  await page.mouse.move(sheetBox.x + sheetBox.width * 0.3, sheetBox.y + sheetBox.height * 0.04);
  const label = page.locator('[data-rs-region-label]');
  await expect(label).toBeVisible();
  expect((await label.boundingBox())!.y + (await label.boundingBox())!.height).toBeLessThanOrEqual(sheetBox.y + 1);

  // Klik op de kolomkop "Start" op het papier: de stap Kolommen opent en de rij Start krijgt focus.
  await expect(page.locator('[data-rs-step-body="columns"]')).toHaveCount(0);
  await page0.locator('text', { hasText: /^Start$/ }).first().click();
  await expect(page.locator('[data-rs-paper-hint]')).toHaveCount(0);
  await expect(page.locator('[data-rs-step-body="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-column="task.time.start"]')).toBeFocused();

  // Klik op de tijdlijn: de stap Balken en tijdlijn opent.
  await page0.locator('text', { hasText: /^(August|Augustus|October|Oktober) 2026$/ }).first().click();
  await expect(page.locator('[data-rs-step-body="bars"]')).toBeVisible();

  // Statusdatumlijn zonder statusdatum: de melding verschijnt onder de keuze en komt helemaal in beeld; de
  // stapkop met Herstel standaard blijft zichtbaar (de voetbalk is weg, check Ethan 9-11-2026). De keuze staat vooraf precies onderaan het scrollvak, zodat de klik niet
  // scrolt en alleen de app de melding in beeld kan brengen.
  await page.locator('[data-rs-step-body="bars"]').evaluate(el => {
    const seg = el.querySelector('[data-rs-segmented="statusLine"]')!;
    el.scrollTop += seg.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom + 1;
  });
  await page.locator('[data-rs-segmented="statusLine"] [data-rs-value="statusDate"]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-status-today]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-step="bars"] [data-rs-reset="bars"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-step-foot]')).toHaveCount(0);
  // "Op vandaag zetten" rekent meteen door, zoals "Nu doorrekenen": er komt geen balk "niet doorgerekend".
  await page.locator('[data-rs-status-today]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return !!s.project.statusDate && !s.scheduleStale;
  })).toBe(true);
  await expect(page.locator('[data-rs-banner="stale"]')).toHaveCount(0);
  await page.locator('[data-rs-segmented="statusLine"] [data-rs-value="none"]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toHaveCount(0);

  // Planning gewijzigd zonder doorrekenen: een balk boven het papier, "Nu doorrekenen" werkt het papier bij.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.name === 'Wanden metselen')!;
    s.updateTask(t.id, { time: { ...t.time, scheduleStart: '2026-09-28T08:00' } });
  });
  const stale = page.locator('[data-rs-banner="stale"]');
  await expect(stale).toBeVisible();
  await page.locator('[data-rs-recalculate]').click();
  await expect(stale).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

  // Kolom Kalenderdagen toevoegen met het kolomvenster van de tabel (check Ethan 9-11-2026: dezelfde dialoog
  // als in het tabblad Tabel): zoeken en klikken. De headless browser draait in het Engels; de kop volgt de
  // taal van de app.
  const calendarDays = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl') ? 'Kalenderdagen' : 'Calendar days';
  const chooser = page.getByRole('dialog', { name: /^(Choose column|Kolom kiezen)$/ });
  const addColumn = async (label: string) => {
    await page.locator('[data-rs-add-column]').click();
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole('searchbox')).toBeFocused();
    await page.keyboard.type(label);
    // Het laatste treffer is de zoeklijst (daarboven kan "Laatst gebruikt" dezelfde kolom tonen).
    await chooser.getByRole('menuitemcheckbox', { name: new RegExp(`^${label}$`) }).last().click();
  };
  await page.locator('[data-rs-step-head="columns"]').click();
  // De verplichte taaknaam: zijn kruisje staat uit, met de uitleg als tooltip; een klik doet niets.
  const requiredX = page.locator('[data-rs-column="task.name"] [data-rs-required-slot]');
  await expect(requiredX).toHaveAttribute('aria-disabled', 'true');
  await expect(requiredX).toHaveAttribute('title', /(task name|taaknaam)/i);
  await expect(requiredX.locator('svg')).toBeAttached();
  const columnCount = await page.locator('[data-rs-column]').count();
  await page.locator('[data-rs-column="task.name"]').hover();
  // `force`: Playwright klikt zelf niet op een knop met `aria-disabled`; juist die klik mag niets doen.
  await requiredX.click({ force: true });
  await expect(page.locator('[data-rs-column]')).toHaveCount(columnCount);
  await expect(page.locator('[data-rs-column="task.name"]')).toBeVisible();
  await addColumn(calendarDays);
  await expect(page.locator('[data-rs-column="task.time.calendarDays"]')).toBeVisible();
  // Na de keuze is het venster dicht en staat de focus op "Kolom toevoegen", klaar voor de volgende.
  await expect(chooser).toHaveCount(0);
  await expect(page.locator('[data-rs-add-column]')).toBeFocused();
  await expect(page0.locator('text', { hasText: new RegExp(`^${calendarDays}$`) }).first()).toBeAttached();
  // Bewaard per apparaat, in de volgorde van de lijst.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').columns))
    .toEqual(['task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.start', 'task.time.finish', 'task.time.completion', 'task.time.calendarDays']);
  // Alt+pijl omhoog verplaatst de kolom een plek.
  await page.locator('[data-rs-column="task.time.calendarDays"]').focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').columns.at(-1)))
    .toBe('task.time.completion');

  // Kolommen overnemen: het tabblad Tabel en de tabel naast de Gantt hebben elk een eigen indeling (check
  // Ethan 9-11-2026: "die zijn verschillend"). Elke knop heeft zijn eigen Ongedaan maken.
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'));
  const surfaceIds = (id: 'full-task-grid' | 'gantt-task-grid') => page.evaluate(
    surface => window.__OPS__!.store.getState().taskGridSurfaces[surface].columns.map(column => String(column.id)), id);
  const tableIds = await surfaceIds('full-task-grid');
  const ganttIds = await surfaceIds('gantt-task-grid');
  expect(tableIds).not.toEqual(ganttIds);
  const ownColumns = (await saved()).columns;
  await page.locator('[data-rs-like-grid="table"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(tableIds);
  await expect(page.locator('[data-rs-undo]')).toContainText(/(Table tab|tabblad Tabel)/);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownColumns);
  await page.locator('[data-rs-like-grid="gantt"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ganttIds);
  await expect(page.locator('[data-rs-undo]')).toContainText(/(next to the Gantt|naast de Gantt)/);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownColumns);

  // Zoals de weergave drukt ook de kolommen van de tabel naast de Gantt af, live; de stap Kolommen toont ze
  // alleen. De eigen kolommen blijven bewaard en komen terug bij Alle taken (Ethan, 10-11-2026, keuze 1).
  const listedColumns = () => page.locator('[data-rs-columns] [data-rs-column]').evaluateAll(
    rows => rows.map(row => row.getAttribute('data-rs-column')));
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="view"]').click();
  await page.locator('[data-rs-step-head="columns"]').click();
  // Grijs, zonder melding erboven; de uitleg staat in een tooltip die meteen verschijnt (check Ethan 10-11-2026).
  await expect.poll(listedColumns).toEqual(ganttIds);
  await expect(page.locator('[data-rs-notice="columns-follow-view"]')).toHaveCount(0);
  const nameOpacity = () => page.locator('[data-rs-column] .rs-col-name').first().evaluate(el => Number(getComputedStyle(el).opacity));
  expect(await nameOpacity()).toBeLessThan(0.6);
  await page.locator(`[data-rs-column="${ganttIds[0]}"]`).hover();
  await expect(page.locator('.ops-tooltip strong')).toHaveText(/^(These columns follow the table next to the Gantt|Deze kolommen volgen de tabel naast de Gantt)$/);
  await page.mouse.move(0, 0);
  await expect(page.locator('.ops-tooltip')).toHaveCount(0);
  await expect(page.locator('[data-rs-add-column]')).toHaveCount(0);
  await expect(page.locator('[data-rs-like-grid]')).toHaveCount(0);
  await expect(page.locator('[data-rs-grip]')).toHaveCount(0);
  await expect(page.locator('[data-rs-remove]')).toHaveCount(0);
  // Delete en Alt+pijl op een rij veranderen niets.
  await page.locator(`[data-rs-column="${ganttIds[ganttIds.length - 1]}"]`).focus();
  await expect(page.locator('.ops-tooltip strong')).toHaveText(/^(These columns follow the table next to the Gantt|Deze kolommen volgen de tabel naast de Gantt)$/);
  await page.keyboard.press('Delete');
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(listedColumns).toEqual(ganttIds);
  expect((await saved()).columns).toEqual(ownColumns);
  // De tabel naast de Gantt verandert (fixture): het rapport volgt live, ook op het papier.
  const ganttPrefs = await page.evaluate(() => window.__OPS__!.store.getState().taskGridSurfaces['gantt-task-grid'].columns);
  const fewer = ganttIds.filter(id => id !== 'task.time.scheduleDuration');
  expect(fewer).toHaveLength(ganttIds.length - 1);
  await page.evaluate(ids => {
    const state = window.__OPS__!.store.getState();
    state.setTaskGridColumns('gantt-task-grid', state.taskGridSurfaces['gantt-task-grid'].columns.filter(c => ids.includes(String(c.id))));
  }, fewer);
  await expect.poll(listedColumns).toEqual(fewer);
  // Ook het papier: de samenvatting van de dichte stap telt de kolommen op het papier.
  await page.locator('[data-rs-step-head="tasks"]').click();
  await expect(page.locator('[data-rs-summary="columns"]')).toContainText(String(fewer.length));
  await page.evaluate(prefs => window.__OPS__!.store.getState().setTaskGridColumns('gantt-task-grid', prefs), ganttPrefs);
  // Terug naar Alle taken: de eigen kolommen staan er weer, en je kunt ze weer aanpassen.
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await page.locator('[data-rs-step-head="columns"]').click();
  await expect.poll(listedColumns).toEqual(ownColumns);
  await expect(page.locator('[data-rs-add-column]')).toBeVisible();
  expect(await nameOpacity()).toBe(1);
  await expect(page.locator('[data-rs-column]').first()).not.toHaveAttribute('title');

  // Herstel standaard in de kop van Kolommen, daarna A2 in Pagina, dan ongedaan maken: de kolommen komen
  // terug, A2 blijft.
  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await openStep(page, 'page');
  await page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A2"]').click();
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns.length).toBe(7);
  expect((await saved()).paperSize).toBe('A2');

  // Zijbalk inklappen: de stapknoppen blijven, exporteren gaat via de zwevende knop linksonder. Het blad
  // wordt daarbij niet kleiner (Hele blad).
  const zoomPct = async () => Number((await page.locator('[data-rs-zoom="value"]').innerText()).replace(/\D/g, ''));
  await page.locator('[data-rs-zoom="page"]').click();
  const openZoom = await zoomPct();
  // Inklappen en uitklappen hebben elk hun eigen icoon (check Ethan 9-11-2026).
  const toggleIcon = () => page.locator('[data-rs-sidebar-toggle] svg').getAttribute('class');
  const collapseIcon = await toggleIcon();
  await page.locator('[data-rs-sidebar-toggle="collapse"]').click();
  await expect(page.locator('[data-rs-sidebar-toggle="expand"]')).toBeVisible();
  expect(await toggleIcon()).not.toBe(collapseIcon);
  await expect(page.locator('[data-rs-rail-step="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-export]')).toHaveCount(0);
  const fab = page.locator('[data-rs-fab-export]');
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAccessibleName(/^(PDF exporteren|Export PDF)$/);
  await expect.poll(zoomPct).toBeGreaterThanOrEqual(openZoom);
  // Bij Breedte en ingezoomd ligt de knop nooit over een blad, ook na scrollen.
  const fabCoversSheet = () => page.evaluate(() => {
    const f = document.querySelector('[data-rs-fab-export]')!.getBoundingClientRect();
    const v = document.querySelector('[data-rs-viewport]')!.getBoundingClientRect();
    return [...document.querySelectorAll('.rs-page')].some(p => {
      const b = p.getBoundingClientRect();
      const top = Math.max(b.top, v.top), bottom = Math.min(b.bottom, v.bottom), left = Math.max(b.left, v.left), right = Math.min(b.right, v.right);
      return right > f.left && left < f.right && bottom > f.top && top < f.bottom;
    });
  });
  await page.locator('[data-rs-zoom="width"]').click();
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-viewport]').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-zoom="in"]').click();
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-zoom="page"]').click();
  // Ingeklapt opent een klik op het papier dezelfde stap als klein venster.
  await page0.locator('text', { hasText: /^Start$/ }).first().click();
  await expect(page.locator('[data-rs-popover="columns"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rs-popover]')).toHaveCount(0);
  // Via de stapknop: de focus staat op het eerste bedienelement van de stap, niet op "In de zijbalk".
  await page.locator('[data-rs-rail-step="columns"]').click();
  const popover = page.locator('[data-rs-popover="columns"]');
  await expect(popover.locator('[data-rs-add-column]')).toBeFocused();
  // Het venster versleep je aan zijn kop (check Ethan 9-11-2026). Het blijft rechts van de rand met de
  // stapknoppen en boven de exportknop, ook als je het naar linksonder trekt.
  const popBefore = (await popover.boundingBox())!;
  const popHead = (await popover.locator('[data-rs-pop-drag]').boundingBox())!;
  await page.mouse.move(popHead.x + 30, popHead.y + popHead.height / 2);
  await page.mouse.down();
  await page.mouse.move(popHead.x + 230, popHead.y + popHead.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await popover.boundingBox())!.x).toBeGreaterThan(popBefore.x + 150);
  const dragged = (await popover.boundingBox())!;
  await page.mouse.move(dragged.x + 30, dragged.y + popHead.height / 2);
  await page.mouse.down();
  await page.mouse.move(0, 719, { steps: 6 });
  await page.mouse.up();
  const railRight = (await page.locator('.rs-sidebar').boundingBox())!;
  const fabBox = (await fab.boundingBox())!;
  await expect.poll(async () => (await popover.boundingBox())!.x).toBeGreaterThanOrEqual(railRight.x + railRight.width);
  const corner = (await popover.boundingBox())!;
  expect(corner.y + corner.height).toBeLessThanOrEqual(fabBox.y);
  await expect(popover).toBeVisible();
  // Herstel standaard in de kop van het zwevende venster, dan Ongedaan maken in de werkbalk: het venster blijft
  // open en de kolommen komen terug. De melding staat in de werkbalk, niet over een blad.
  await expect(popover.locator('.rs-pop-head [data-rs-reset="columns"]')).toBeVisible();
  await page.locator('[data-rs-popover="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-column]')).toHaveCount(6);
  await expect(page.locator('[data-rs-toolbar] [data-rs-undo]')).toBeVisible();
  await page.locator('[data-rs-undo-button]').click();
  await expect(page.locator('[data-rs-popover="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-column]')).toHaveCount(7);
  // Het kolomvenster opent ook vanuit het zwevende venster. Een klik erin (een categorie openen) sluit het
  // zwevende venster niet; beide blijven binnen het scherm.
  await page.locator('[data-rs-popover="columns"] [data-rs-add-column]').click();
  await expect(chooser).toBeVisible();
  await chooser.locator('.task-grid-column-chooser-category').first().click();
  await expect(chooser).toBeVisible();
  await expect(popover).toBeVisible();
  await expect.poll(() => popover.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  })).toBe(true);
  // Escape sluit eerst het kolomvenster, dan het zwevende venster.
  await page.keyboard.press('Escape');
  await expect(chooser).toHaveCount(0);
  await expect(popover).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rs-popover]')).toHaveCount(0);

  // Typen in een zwevend venster: elke toets blijft in het veld (de focus sprong eerder na één letter weg).
  await page.locator('[data-rs-rail-step="headerFooter"]').click();
  const company = page.locator('[data-rs-popover="headerFooter"] #rs-company');
  await company.fill('');
  await company.pressSequentially('abc');
  await expect(company).toHaveValue('abc');
  await expect(company).toBeFocused();
  await page.keyboard.press('Escape');

  const download = page.waitForEvent('download');
  await fab.click();
  expect((await download).suggestedFilename()).toMatch(/^Rapportstudio-.+\.pdf$/);

  // Uitklappen: de knop in de zijbalk is terug, de zwevende knop weg; de knop heeft weer het icoon van inklappen.
  await page.locator('[data-rs-sidebar-toggle="expand"]').click();
  await expect(page.locator('[data-rs-export]')).toBeVisible();
  expect(await toggleIcon()).toBe(collapseIcon);
  await expect(fab).toHaveCount(0);

  // Een andere bron vernieuwt de opgeslagen instellingen: de host die pas na de start antwoordt (#818),
  // of een ander tabblad. Het tabblad volgt, en de volgende klik schrijft de oude kopie niet terug (review
  // Sol #847). Beginstand uit de review: A3 met de zes standaardkolommen; de nieuwe stand is A1 met alleen
  // Taaknaam. De host stuurt precies zo'n `StorageEvent` (`siteHostSettings.ts`).
  const refreshStored = (patch: Record<string, unknown>) => page.evaluate(next => {
    const oldValue = localStorage.getItem('ops-reportSettings');
    const newValue = JSON.stringify({ ...JSON.parse(oldValue ?? '{}'), ...next });
    localStorage.setItem('ops-reportSettings', newValue);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ops-reportSettings', oldValue, newValue, storageArea: localStorage, url: location.href }));
  }, patch);
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await openStep(page, 'page');
  await page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A3"]').click();
  await expect.poll(async () => (await saved()).paperSize).toBe('A3');
  await expect(page.locator('[data-rs-undo-button]')).toBeVisible();
  await refreshStored({ paperSize: 'A1', columns: ['task.name'] });
  await expect(page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A1"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page0.locator('text', { hasText: /^Start$/ })).toHaveCount(0);
  // Ongedaan maken zou de zes kolommen over de vernieuwde stand terugzetten: het verdwijnt.
  await expect(page.locator('[data-rs-undo-button]')).toHaveCount(0);
  await page.locator('[data-rs-segmented="orientation"] [data-rs-value="portrait"]').click();
  await expect.poll(async () => (await saved()).orientation).toBe('portrait');
  expect(await saved()).toMatchObject({ paperSize: 'A1', columns: ['task.name'], orientation: 'portrait' });

  // Ook het rapporttype volgt: een ander rapport in de opslag opent het paneel voor de andere rapporten.
  await refreshStored({ reportType: 'milestones' });
  await expect(studio).toHaveCount(0);
  // Dat paneel bewaart alleen zijn eigen velden (rapporttype, tabelopties, papier, richting, letter). Kiezen en
  // instellen daar laat de velden van dit tabblad staan: kolommen, balkkleuren, layout, zijbalk, open stap.
  const panelFields = ['reportType', 'tableReports', 'paperSize', 'orientation', 'reportFontFamily'];
  const studioFields = async () => Object.fromEntries(Object.entries(await saved()).filter(([key]) => !panelFields.includes(key)));
  const studioBefore = await studioFields();
  expect(studioBefore).toMatchObject({ columns: ['task.name'] });
  const typePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  await typePicker.click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();
  await expect(page.locator('[data-ops-table-report]')).toBeVisible();
  const tablePaper = page.locator('[data-ops-report-options]').getByLabel(/^(Paper:|Papier:)$/);
  await tablePaper.click();
  await page.getByRole('option', { name: 'A4', exact: true }).click();
  await expect.poll(async () => (await saved()).paperSize).toBe('A4');
  expect(await saved()).toMatchObject({ reportType: 'lookAhead', orientation: 'portrait' });
  expect(await studioFields()).toEqual(studioBefore);
  // Terug naar de Gantt-afdruk via dezelfde keuzelijst: het tabblad opent met het papier uit het paneel.
  await typePicker.click();
  await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
  await expect(studio).toBeVisible();
  await expect(page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A4"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page0.locator('text', { hasText: /^Start$/ })).toHaveCount(0);
  expect(await saved()).toMatchObject({ reportType: 'gantt', paperSize: 'A4', columns: ['task.name'], orientation: 'portrait' });
  const kept = ['columns', 'barColors', 'layoutId', 'followView', 'sidebar', 'resourceGantt', 'truncateTaskNames', 'taskNameColumnWidth'];
  const pick = (o: Record<string, unknown>) => Object.fromEntries(kept.map(key => [key, o[key]]));
  expect(pick(await saved())).toEqual(pick(studioBefore));

  // Voet op elke pagina, ook als de tijdlijn over twee vellen loopt: één rij hoog en twee vellen breed krijgt op
  // beide vellen de volle voetstrook. Zonder de optie heeft geen vel een los voetvenster, wel kop en body.
  await openStep(page, 'page');
  await page.locator('[data-rs-segmented="autoFit"] [data-rs-value="fit"]').click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(1);
  await page.locator('[data-rs-option="timelineColumns-more"]').click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(2);
  await page.locator('[data-rs-step-head="headerFooter"]').click();
  const footerSwitch = page.locator('[data-rs-switch="repeatFooter"]');
  await expect(footerSwitch.locator('input')).toBeChecked();
  const withFooter = await pageShapes(await exportStudioPdf(page, /^Rapportstudio-.+\.pdf$/));
  expectFullFooterOnEveryPage(withFooter);
  await footerSwitch.click();
  await expect(footerSwitch.locator('input')).not.toBeChecked();
  const withoutFooter = await pageShapes(await exportStudioPdf(page, /^Rapportstudio-.+\.pdf$/));
  expect(withoutFooter).toHaveLength(2);
  // Per vel precies één venster minder: de voet.
  withoutFooter.forEach((shape, i) => {
    expect(shape.draws).toBe(withFooter[i].draws - 1);
    expect(shape.footerRects).toHaveLength(0);
  });
  await footerSwitch.click();
  await openStep(page, 'page');
  await page.locator('[data-rs-option="timelineColumns-less"]').click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(1);

  // Een layout in de stap Taken (#861). Het meegeleverde Resourcediagram maakt de afdruk per resource, zoals
  // het oude rapporttype; het scherm houdt zijn eigen groepering en rijen. De resources zijn een fixture.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const id = (name: string) => s.tasks.find(task => task.name === name)!.id;
    const ploeg = s.addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 1 });
    const kraan = s.addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    s.assignResource(id('Fundering storten'), ploeg, 1);
    s.assignResource(id('Wanden metselen'), ploeg, 1);
    s.assignResource(id('Wanden metselen'), kraan, 1);
    window.__OPS__!.store.getState().runCPM();
  });
  const screen = () => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { filter: s.view.filter, group: s.view.group, sort: s.view.sort, rows: s.viewRows.map(row => row.rowKey) };
  });
  const screenBefore = await screen();
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-layout="builtin:resource-diagram"]').click();
  await expect(page.locator('[data-rs-layout="builtin:resource-diagram"]')).toHaveAttribute('aria-checked', 'true');
  // Twee resources, drie toewijzingen (Wanden metselen staat onder beide), geen taak zonder resource.
  await expect(page.locator('[data-rs-resource-counts]')).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  // Op het papier een band per resource, met het aantal taken: Ploeg A (2) en Kraan (1).
  await expect(page0.locator('text', { hasText: /^Ploeg A \(2\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan \(1\)$/ }).first()).toBeAttached();
  // Een blad per resource: twee bladen, ook in de PDF, met de eigen naam van dit rapport.
  const pageBreak = page.locator('[data-rs-switch="pageBreakPerResource"]');
  await pageBreak.click();
  await expect(pageBreak.locator('input')).toBeChecked();
  await expect(page.locator('[data-preview-page]')).toHaveCount(2);
  const resourcePdf = await PDFDocument.load(await exportStudioPdf(page, /^Rapportstudio-(resource-diagram|resourcediagram)\.pdf$/));
  expect(resourcePdf.getPageCount()).toBe(2);
  await pageBreak.click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(1);
  // Relatielijnen staan uit, met uitleg in Balken; de keuze voor een gewone afdruk blijft bewaard.
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(page.locator('[data-rs-relations-off]')).toBeVisible();
  await expect(page.locator('[data-rs-option="showDeps"]')).toBeDisabled();
  await expect(page.locator('[data-rs-option="showDeps"]')).not.toBeChecked();
  await expect.poll(async () => (await saved()).layoutId).toBe('builtin:resource-diagram');
  expect(await screen()).toEqual(screenBefore);
  // Een beperkte periode, dan via Rapporttype een ander rapport en terug (review Sol #847, ronde 4): de layout
  // Resourcediagram, zijn banden en zijn periode blijven staan. Eerst kwam de terugweg op Alle taken uit, zonder
  // banden en zonder periode. Alleen met een periode noemen de tellingen ook "Buiten de periode".
  expect(await saved()).toMatchObject({ reportType: 'gantt', layoutId: 'builtin:resource-diagram' });
  const rdChoice = page.locator('[data-rs-layout="builtin:resource-diagram"]');
  const resourceCounts = page.locator('[data-rs-resource-counts]');
  const periodPicker = page.getByLabel(/^(Reporting period|Rapportageperiode)$/);
  const reportTypePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  const toOtherReportAndBack = async () => {
    await reportTypePicker.click();
    // De andere rapporten staan met hun eigen naam, zonder "Ander rapport:" ervoor (check Ethan 9-11-2026).
    await expect(page.getByRole('option', { name: /^(Other report|Ander rapport)/ })).toHaveCount(0);
    await page.getByRole('option', { name: /^(Milestone overview|Mijlpalen-overzicht)$/ }).click();
    await expect(studio).toHaveCount(0);
    await reportTypePicker.click();
    await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
    await expect(studio).toBeVisible();
  };
  // De periode loopt tot en met 18 september: alleen Fundering storten (Ploeg A) valt erin, Wanden metselen niet.
  await page.locator('[data-rs-step-head="tasks"]').click();
  await periodPicker.click();
  await page.getByRole('option', { name: /^(Custom|Aangepast)$/ }).click();
  const periodTo = page.locator('[data-ops-report-period="resourceGanttPeriod"]').getByRole('group', { name: /^(To|Tot)$/ }).getByRole('textbox');
  await periodTo.nth(0).fill('18');
  await periodTo.nth(1).fill('09');
  await periodTo.nth(2).fill('2026');
  await page.keyboard.press('Enter');
  const inPeriod = /:\s*1\D+:\s*1\D+:\s*0\D+:\s*\d+$/;
  await expect(resourceCounts).toHaveText(inPeriod);
  await expect(page0.locator('text', { hasText: /^Ploeg A \(1\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan/ })).toHaveCount(0);
  const countsInPeriod = (await resourceCounts.textContent()) ?? '';
  await toOtherReportAndBack();
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await expect(resourceCounts).toHaveText(countsInPeriod);
  await expect(periodPicker).toHaveAttribute('data-value', 'custom');
  await expect(page0.locator('text', { hasText: /^Ploeg A \(1\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan/ })).toHaveCount(0);
  expect(await saved()).toMatchObject({
    reportType: 'gantt', layoutId: 'builtin:resource-diagram', resourceGantt: { period: { preset: 'custom', to: '2026-09-18' } },
  });
  await periodPicker.click();
  await page.getByRole('option', { name: /^(Project duration|Hele project)$/ }).click();
  await expect(resourceCounts).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  // Een oude opslag kent het Resourcediagram alleen als rapporttype: die opent als de layout, en ook die keuze
  // overleeft een uitstap naar een ander rapport.
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');
  await refreshStored({ reportType: 'resourceGantt', layoutId: '' });
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await toOtherReportAndBack();
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await expect(resourceCounts).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  await page.locator('[data-rs-step-head="bars"]').click();
  // Eenh./d en Curve staan op het papier achter de taaknaam (Per resource). De samenvatting van Kolommen telt
  // ze mee; het label boven het blad heet zoals de kop, en een klik gaat naar de schakelaar die ze aan- en
  // uitzet (fixronde na council ronde 5: het label was "Kolommen · units" en de klik opende Kolommen).
  await expect(page.locator('[data-rs-summary="columns"]')).toHaveText(/^3\D.*(Units\/d|Eenh\.\/d).*Curve/);
  const unitsHead = page0.locator('text', { hasText: /^(Units\/d|Eenh\.\/d)$/ }).first();
  await unitsHead.hover();
  await expect(page.locator('[data-rs-region-label]')).toHaveText(/^(Columns|Kolommen) · (Units\/d|Eenh\.\/d)$/);
  await unitsHead.click();
  await expect(page.locator('[data-rs-step-body="tasks"]')).toBeVisible();
  await expect(page.locator('[data-rs-option="showAssignmentColumns"]')).toBeFocused();
  // In Kolommen staat waar je ze vindt, met een knop ernaartoe.
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-to-resource-options]').click();
  await expect(page.locator('[data-rs-option="showAssignmentColumns"]')).toBeFocused();
  await page.locator('[data-rs-step-head="bars"]').click();

  // Een eigen layout uit een ander venster (dezelfde `StorageEvent` als de host): alleen één taak. Het papier
  // volgt de layout ook als die daarna verandert, zonder nieuwe keuze.
  const storeLayouts = (layouts: unknown[]) => page.evaluate(list => {
    const oldValue = localStorage.getItem('ops-taskGridLayouts');
    const newValue = JSON.stringify({ version: 1, layouts: list });
    localStorage.setItem('ops-taskGridLayouts', newValue);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ops-taskGridLayouts', oldValue, newValue, storageArea: localStorage, url: location.href }));
  }, layouts);
  const onlyTask = (name: string) => ({
    id: 'layout-rapport', name: 'Een taak',
    filter: { kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'eq', value: name },
  });
  await storeLayouts([onlyTask('Fundering storten')]);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-layout="layout-rapport"]').click();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Wanden metselen$/ })).toHaveCount(0);
  await expect(page.locator('[data-rs-resource-counts]')).toHaveCount(0);
  await storeLayouts([onlyTask('Wanden metselen')]);
  await expect(page0.locator('text', { hasText: /^Wanden metselen$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ })).toHaveCount(0);
  expect(await saved()).toMatchObject({ reportType: 'gantt', layoutId: 'layout-rapport', followView: false });
  expect(await screen()).toEqual(screenBefore);
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toHaveCount(0);
  // Het filter gebruikt een eigen veld dat dit project niet heeft (review Sol #847, ronde 4): nul rijen, en nu
  // met een melding naast de keuze. Het filter blijft bewaard; niets verdwijnt stil.
  const missingFieldLayout = {
    id: 'layout-rapport', name: 'Een taak',
    filter: { kind: 'rule', field: { src: 'customField', defId: 'removed-custom-field' }, operator: 'eq', value: 'A' },
  };
  await storeLayouts([missingFieldLayout]);
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toBeVisible();
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toContainText(/(not in this project|niet in dit project)/);
  await expect(page0.locator('text', { hasText: /^(Fundering storten|Wanden metselen)$/ })).toHaveCount(0);
  await expect(page.locator('[data-rs-layout="layout-rapport"]')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-taskGridLayouts') ?? '{}').layouts)).toEqual([missingFieldLayout]);
  // Verwijderd: terug naar Alle taken, met een melding.
  await storeLayouts([]);
  await expect(page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
    .some(n => n.messageKey === 'notifications.reportLayoutGone'))).toBe(true);
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toHaveCount(0);

  // Een layout kiezen verandert alleen de rijen; kolommen en balkopties neem je over met een knop (fixronde na
  // council ronde 5, de scenario's van Opus en Sol). Eigen stand: de zes standaardkolommen plus Kalenderdagen,
  // en Afhankelijkheden uit. De layout "Korte tabel" heeft drie kolommen, relatielijnen aan, speling uit, een
  // basislijn en een voortgangslijn.
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await addColumn(calendarDays);
  await expect(page.locator('[data-rs-column]')).toHaveCount(7);
  await page.locator('[data-rs-step-head="bars"]').click();
  await page.locator('[data-rs-switch="showDeps"]').click();
  const own = async () => {
    const s = await saved();
    return { columns: s.columns, showDeps: s.showDeps, showFloat: s.showFloat, showBaselineOverlay: s.showBaselineOverlay, statusLine: s.statusLine, barColors: s.barColors };
  };
  await expect.poll(async () => (await own()).showDeps).toBe(false);
  const ownBefore = await own();
  expect(ownBefore).toMatchObject({ showFloat: true, showBaselineOverlay: false, statusLine: 'none', barColors: { mode: 'critical' } });
  expect(ownBefore.columns).toHaveLength(7);
  const shortColumns = ['task.wbsCode', 'task.name', 'task.time.scheduleDuration'];
  await storeLayouts([{
    id: 'layout-kort', name: 'Korte tabel', icon: 'flag',
    columns: shortColumns.map(id => ({ id, width: 80, pinned: false })),
    group: [{ field: { src: 'builtin', key: 'taskType' }, dir: 'asc' }],
    showRelations: true,
    overlays: { baseline: true, progressLine: true, statusDateLine: false, resourceAccent: false, floatBand: false, barColors: { mode: 'auto' } },
  }]);
  await page.locator('[data-rs-step-head="tasks"]').click();
  const shortTable = page.locator('[data-rs-layout="layout-kort"]');
  const allTasks = page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]');
  // Opus: de layout kiezen en terug naar Alle taken laat de zeven kolommen staan, zonder "Ongedaan maken".
  await shortTable.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  expect(await own()).toEqual(ownBefore);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  await expect(page.locator('[data-rs-notice="layout-own"]')).toBeVisible();
  // Het i-icoon naast het kopje Layouts legt uit wat een layout verandert (Ethan, 10-11-2026): de tooltip
  // verschijnt bij toetsenbordfocus, met de kernzin vet; de pijltjes op het icoon kiezen geen andere bron.
  const layoutInfo = page.locator('[data-rs-step-body="tasks"] [data-rs-group-info]');
  await layoutInfo.focus();
  await expect(page.locator('.ops-tooltip')).toBeVisible();
  await expect(page.locator('.ops-tooltip strong')).toHaveText(/^(Een layout bepaalt alleen de rijen|A layout only sets the rows)$/);
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  await page.keyboard.press('Escape');
  await allTasks.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');
  expect(await own()).toEqual(ownBefore);
  // Opus: met de pijltjes door alle keuzes (elk pijltje kiest meteen), ook over de layout: niets verandert.
  await allTasks.focus();
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp']) await page.keyboard.press(key);
  await expect.poll(async () => (await saved()).followView).toBe(true);
  expect(await own()).toEqual(ownBefore);
  // Sol: met de layout gekozen een eigen keuze in Balken (Speling), dan opnieuw op dezelfde layout klikken:
  // die klik doet niets, ook niet opnieuw overnemen.
  await shortTable.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  await page.locator('[data-rs-step-head="bars"]').click();
  const floatBefore = (await saved()).showFloat;
  await page.locator('[data-rs-switch="showFloat"]').click();
  await expect.poll(async () => (await saved()).showFloat).toBe(!floatBefore);
  const beforeSecondClick = await saved();
  await page.locator('[data-rs-step-head="tasks"]').click();
  await shortTable.click();
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(page.locator('[data-rs-step-body="bars"]')).toBeVisible();
  expect(await saved()).toEqual(beforeSecondClick);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  await page.locator('[data-rs-switch="showFloat"]').click();
  await expect.poll(own).toEqual(ownBefore);
  // "Kolommen overnemen": alleen de kolommen, met één Ongedaan maken voor alleen dat deel. De keuze van de
  // layout blijft staan, ook na Ongedaan maken.
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-take-over="columns"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(shortColumns);
  expect(await own()).toMatchObject({ showDeps: false, showFloat: true, statusLine: 'none' });
  await expect(page.locator('[data-rs-take-over="columns"]')).toHaveCount(0);
  await expect(page.locator('[data-rs-take-over="bars"]')).toBeVisible();
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownBefore.columns);
  expect((await saved()).layoutId).toBe('layout-kort');
  await expect(page.locator('[data-rs-take-over="columns"]')).toBeVisible();
  // "Balkopties overnemen": relatielijnen, basislijn, speling, statuslijn en balkkleuren; Ongedaan maken zet ze terug.
  await page.locator('[data-rs-take-over="bars"]').click();
  await expect.poll(own).toEqual({ ...ownBefore, showDeps: true, showFloat: false, showBaselineOverlay: true, statusLine: 'progress', barColors: { mode: 'auto' } });
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(own).toEqual(ownBefore);
  expect((await saved()).layoutId).toBe('layout-kort');
  // Beide delen na elkaar overnemen, dan één keer Ongedaan maken: kolommen én balkopties komen terug (review Sol
  // #847, ronde 4; eerst zette Ongedaan maken alleen de balkopties terug en bleven de drie kolommen staan).
  await page.locator('[data-rs-take-over="columns"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(shortColumns);
  await page.locator('[data-rs-take-over="bars"]').click();
  await expect.poll(own).toEqual({ columns: shortColumns, showDeps: true, showFloat: false, showBaselineOverlay: true, statusLine: 'progress', barColors: { mode: 'auto' } });
  await expect(page.locator('[data-rs-undo]')).toContainText(/^Korte tabel: (columns and bar options applied|kolommen en balkopties overgenomen)\./);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(own).toEqual(ownBefore);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  expect(await screen()).toEqual(screenBefore);
  // Eigen balkkleuren (keuze Ethan, 10-11-2026). Het overnemen liet de balkkleuren van het scherm staan; een
  // keuze in Balken geldt ook alleen voor het rapport. Bij Zoals de weergave volgt het rapport het scherm en
  // staat de keuze uit; bij Alle taken staat de eigen keuze er weer.
  const screenColors = () => page.evaluate(() => window.__OPS__!.store.getState().ui.barColorSelection);
  expect(await screenColors()).toEqual({ mode: 'critical' });
  await page.locator('[data-rs-step-head="bars"]').click();
  const colorPicker = page.locator('[data-rs-step-body="bars"]').getByRole('button', { name: /^(Bar colours|Balkkleuren)$/ });
  await colorPicker.click();
  await page.getByRole('option', { name: /^(Per task — automatic|Per taak — automatisch)$/ }).click();
  await expect.poll(async () => (await saved()).barColors).toEqual({ mode: 'auto' });
  expect(await screenColors()).toEqual({ mode: 'critical' });
  await expect(page.locator('[data-rs-bar-colors-hint]')).toHaveText(/^(This choice applies only to the report|Deze keuze geldt alleen voor het rapport)/);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="view"]').click();
  await expect.poll(async () => (await saved()).followView).toBe(true);
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(colorPicker).toBeDisabled();
  await expect(colorPicker).toContainText(/Critical path|Kritiek pad/);
  await expect(page.locator('[data-rs-bar-colors-hint]')).toHaveText(/follow your Gantt chart|volgen je Gantt-diagram/);
  expect((await saved()).barColors).toEqual({ mode: 'auto' });
  await page.locator('[data-rs-step-head="tasks"]').click();
  await allTasks.click();
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(colorPicker).toBeEnabled();
  await expect(colorPicker).toContainText(/Per task — automatic|Per taak — automatisch/);
  expect(await screenColors()).toEqual({ mode: 'critical' });
  // Een eigen keuze staat vast (review Sol #877, ronde 1): wisselt daarna het scherm, dan blijven het papier en de
  // legenda bij de keuze van het rapport. Standaard zet een vaste kleur terug (het kritieke pad), ook als het
  // scherm iets anders heeft; een volgstand die op het scherm lijkt maar anders uitpakt, bestaat niet.
  const paper = page.locator('[data-report-page-svg="0"]');
  const outline = /Critical path \(outline\)|Kritiek pad \(rand\)/;
  await expect(paper).toContainText(outline);
  await page.evaluate(() => window.__OPS__!.store.getState().setOverlays({ barColors: { mode: 'category', field: { src: 'builtin', key: 'taskType' } } }));
  await expect.poll(screenColors).toMatchObject({ mode: 'category' });
  await expect(colorPicker).toContainText(/Per task — automatic|Per taak — automatisch/);
  await expect(paper).toContainText(outline);
  await page.locator('[data-rs-step="bars"] [data-rs-reset="bars"]').click();
  await expect.poll(async () => (await saved()).barColors).toEqual({ mode: 'critical' });
  await expect(colorPicker).toContainText(/Critical path|Kritiek pad/);
  await expect(paper).not.toContainText(outline);
  expect(await screenColors()).toMatchObject({ mode: 'category' });
});

// Een Arabische taaknaam bij naamweergave Volledig (review Sol #847). De meting van het papier en de PDF komt
// uit Noto Sans Arabic; het scherm moet dezelfde letter tekenen, anders tekende de browser de naam in een
// systeemletter (183 px in plaats van 175 px) en liep hij over de volgende kolom. Gecontroleerd op de
// werkelijk getekende tekst in de SVG van het papier (`getBBox`, tegen de getekende kolomlijn). Daarna hetzelfde
// voor een lange Latijnse naam, voor een Chinese naam zonder CJK-extensie, en voor een gemengde Latijns-Arabische
// naam in Inter en in Carlito (ronde 2: de browser nam de spaties in het Latijnse deel uit Noto, de meting uit de
// rapportletter).
test('rapport-studio: een Arabische of lange naam past in de naamkolom op het papier', async ({ page, ops: _ops }) => {
  const arabic = 'أعمال البناء والتشييد وإدارة الموارد ومتابعة التنفيذ';
  const latin = 'Stakeholder management en afstemming met de gemeente over de bouwlogistiek';
  const [taskId] = await seedProject(page, [
    { name: arabic, start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Rapport Arabisch');
  // De breedte volgens de meting van papier en PDF (`loadReportTextMetrics`), op de letter van de naamcel.
  type FontId = 'inter' | 'carlito';
  const measured = (text: string, font: string, id: FontId) => page.evaluate(async ({ text, font, id }) => {
    const { loadReportTextMetrics } = await import('/src/services/pdf/fontLoader.ts' as string);
    return (await loadReportTextMetrics(id, 'ltr')).measure(text, font) as number;
  }, { text, font, id });
  // De rapportletter van een getekende tekst, uit zijn familie in de SVG.
  const fontIdOf = (font: string): FontId => (font.includes('OpsReportCarlito') ? 'carlito' : 'inter');
  const rename = (name: string) => page.evaluate(({ id, name }) => window.__OPS__!.store.getState().updateTask(id, { name }), { id: taskId, name });
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();
  await openStep(page, 'columns');
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="full"]').click();

  // De naamcel in de tabel (de meest linkse tekst met de naam; de andere staat naast de balk), met de
  // eerste getekende kolomlijn rechts ervan in hetzelfde venster.
  const nameCell = (name: string) => page0.evaluate((svg, name) => {
    const cells = [...svg.querySelectorAll('text')].filter(t => t.textContent === name);
    if (cells.length === 0) return null;
    const cell = cells.reduce((a, b) => (b.getBBox().x < a.getBBox().x ? b : a));
    const box = cell.getBBox();
    const borders: number[] = [];
    for (const path of cell.ownerSVGElement!.querySelectorAll('path')) {
      for (const m of (path.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)) {
        const [x1, y1, x2, y2] = m.slice(1).map(Number);
        if (x1 === x2 && x1 > box.x + 1 && Math.min(y1, y2) <= box.y && Math.max(y1, y2) >= box.y + box.height) borders.push(x1);
      }
    }
    const style = getComputedStyle(cell);
    return {
      end: box.x + box.width, border: Math.min(...borders), drawn: cell.getComputedTextLength(),
      font: `${style.fontWeight === '700' ? 'bold ' : ''}${style.fontSize} InterPDF`, family: style.fontFamily,
    };
  }, name);
  const paperCell = async (name: string, id: FontId = 'inter') => {
    await expect.poll(() => nameCell(name).then(c => c !== null && Number.isFinite(c.border) && fontIdOf(c.family) === id)).toBe(true);
    const cell = (await nameCell(name))!;
    // Dezelfde breedte als de meting (dus dezelfde letter), en de naam eindigt vóór de rechtermarge van de
    // kolom (2 px, `NAME_RIGHT_PAD`): niets loopt over de kolomlijn.
    expect(Math.abs(cell.drawn - await measured(name, cell.font, id)), `getekend ${cell.drawn}`).toBeLessThan(0.1);
    expect(cell.end, `kolomlijn op ${cell.border}`).toBeLessThanOrEqual(cell.border - 2);
    return cell;
  };
  const arabicCell = await paperCell(arabic);
  expect(arabicCell.family).toMatch(/^"?OpsReportArabic"?, /);
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === 'OpsReportArabic' && face.status === 'loaded').map(face => face.weight).sort()))
    .toEqual(['400', '700']);
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'))).truncateTaskNames).toBe(false);

  // Een lange Latijnse naam, nu de langste.
  await rename(latin);
  await paperCell(latin);
  // Afkappen met de schuif op het minimum: de naam in de tabel eindigt op een beletselteken; het label naast de
  // balk blijft heel. Terug op Volledig staat hij er weer.
  const fullName = page0.locator('text', { hasText: latin });
  await expect(fullName).toHaveCount(2);
  const cutName = () => page0.evaluate((svg, name) => [...svg.querySelectorAll('text')]
    .map(t => t.textContent ?? '').filter(text => text.endsWith('…') && name.startsWith(text.slice(0, 8))), latin);
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="cut"]').click();
  const nameWidth = page.locator('[data-rs-option="taskNameColumnWidth"]');
  await nameWidth.fill(await nameWidth.getAttribute('min') ?? '60');
  await expect.poll(async () => (await cutName()).length).toBeGreaterThan(0);
  await expect(fullName).toHaveCount(1);
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="full"]').click();
  await paperCell(latin);

  // Een naam in een schrift dat geen meegeleverde letter heeft (Chinees zonder CJK-extensie): het scherm
  // tekent hem in een systeemletter en de PDF valt dan terug op raster. De meting volgt dan de browser, niet
  // de lege glyph van Inter.
  const chinese = '地基浇筑与钢筋绑扎工程施工';
  await rename(chinese);
  await paperCell(chinese);

  // Een gemengde naam: Latijn, een cijfer en Arabisch (review Sol #847, ronde 2). De browser kiest de letter
  // per teken, ook in het Latijnse deel: elke spatie komt uit Noto. De PDF en de meting doen nu hetzelfde.
  // Daarvoor mat Carlito 409,8 px en tekende de browser 414,4 px: de naam liep de volgende kolom in.
  // Daarna een naam met cijfers en leestekens: een stuk zonder letter ("2.3") kernt de browser als
  // Latijn; de meting kernde het eerst als DFLT (Inter: 0,24 px smaller). Eerst in Inter, dan in Carlito.
  const mixed = 'Fase 1 أعمال البناء en afstemming met de gemeente over de bouwlogistiek en bereikbaarheid van de bouwplaats';
  const mixedDigits = 'Fase 2.3 – أعمال (البناء) 50%, week 12/03: 3 dagen';
  await rename(mixedDigits);
  await paperCell(mixedDigits);
  await rename(mixed);
  await paperCell(mixed);
  // Carlito kiezen in de stap Pagina, met een echte klik in de keuzelijst.
  await openStep(page, 'page');
  const fontPicker = page.getByLabel(/^(Font:|Lettertype:)$/);
  await fontPicker.click();
  await page.getByRole('option', { name: /^Carlito/ }).click();
  await expect(fontPicker).toContainText(/^Carlito/);
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'))).reportFontFamily).toBe('carlito');
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === 'OpsReportCarlito' && face.status === 'loaded').map(face => face.weight).sort()), { timeout: 20_000 })
    .toEqual(['400', '700']);
  expect((await paperCell(mixed, 'carlito')).family).toMatch(/^"?OpsReportArabic"?, "?OpsReportCarlito"?, /);
});

/** De BaseFont van elk Type0-font in de PDF; pdf-lib noemt een ingebed font `/<PostScript-naam>-<getal>`. */
function type0BaseFonts(pdf: PDFDocument): string[] {
  const baseFonts: string[] = [];
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Subtype')) === PDFName.of('Type0')) baseFonts.push(String(obj.get(PDFName.of('BaseFont'))));
  }
  return baseFonts;
}

/**
 * De tekst die de PDF met fontsleutel `fontKey` tekent, terugvertaald naar letters. De rapportletter
 * staat volledig ingebed (glyph-id = CID, zie `paginateVector.ts`), dus de glyph-id's van het
 * gevendorde bestand vertalen de hex-strings van `Tj` terug.
 */
async function pdfTextsInFont(pdf: PDFDocument, fontKey: string, fontFile: string): Promise<string[]> {
  const font = fontkit.create(await readFile(join(process.cwd(), fontFile)));
  const charOf = new Map<number, string>();
  // Oplopend, zodat een glyph die meerdere tekens dekt (spatie en U+00A0) het laagste teken krijgt.
  for (const cp of [...font.characterSet].sort((a, b) => a - b)) {
    const gid = font.glyphForCodePoint(cp).id;
    if (!charOf.has(gid)) charOf.set(gid, String.fromCodePoint(cp));
  }
  const usesKey = new RegExp(`/${fontKey} [\\d.]+ Tf`);
  const texts: string[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      const ops = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
      for (const [, block] of ops.matchAll(/BT\s([\s\S]*?)\sET/g)) {
        if (!usesKey.test(block)) continue;
        for (const [, hex] of block.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
          texts.push((hex.match(/.{4}/g) ?? []).map(h => charOf.get(parseInt(h, 16)) ?? '�').join(''));
        }
      }
    }
  }
  return texts;
}

// Rapportletter (issue #770): de gebruiker kiest Carlito. Papier en PDF gebruiken die letter (en Inter alleen voor
// het vinkje dat Carlito mist). Daarna kiest hij Liberation Sans en exporteert meteen, terwijl die letter nog
// laadt. Het blok van de tabelrapporten toont dezelfde keuze, ook in de raster-terugval, en na een herstart van de
// app staat de keuze er nog. Alleen een voorkeur op dit apparaat.
test('rapport-studio: de gekozen rapportletter staat in de PDF en blijft na een herstart', async ({ page, ops: _ops }) => {
  const longName = 'Afwerking begane grond noordzijde';
  const [letterTaskId] = await seedProject(page, [
    // Cyrillisch dekt Carlito zelf; het vinkje niet, dat komt in de PDF uit Inter.
    { name: '✓ Lettertaak Фундамент', start: '2026-09-07', finish: '2026-10-16', durationDays: 30 },
    // De langste naam bepaalt de naamkolom bij naamweergave Volledig. In Liberation Sans is hij breder dan in Carlito.
    { name: longName, start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Rapportletter');
  await page.evaluate(() => {
    // Zoals in table-reports.spec.ts: met deze statusdatum toont de look-ahead beide taken.
    const s = window.__OPS__!.store.getState();
    s.setStatusDate('2026-09-14');
    s.runCPM();
  });
  // De gewichten die de browser van een letter echt geladen heeft. De berekende font-family toont de gevraagde
  // naam ook als de letter ontbreekt (review Sol #837, ronde 1).
  const loadedWeights = (family: string) => page.evaluate(fam => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === fam && face.status === 'loaded')
    .map(face => face.weight)
    .sort(), family);
  const readPdf = async (download: Download): Promise<PDFDocument> => {
    const pdfPath = await download.path();
    expect(pdfPath).not.toBeNull();
    return PDFDocument.load(await readFile(pdfPath!));
  };

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();

  // Standaard de letter van vóór de keuzelijst.
  await openStep(page, 'page');
  const fontPicker = page.getByLabel(/^(Font:|Lettertype:)$/);
  await expect(fontPicker).toContainText(/^Inter/);
  await fontPicker.click();
  await page.getByRole('option', { name: /^Carlito/ }).click();
  await expect(fontPicker).toContainText(/^Carlito/);
  await expect.poll(() => loadedWeights('OpsReportCarlito'), { timeout: 20_000 }).toEqual(['400', '700']);

  // De PDF bedt Carlito in (regular + bold) en tekent het vinkje uit Inter: vector, geen raster.
  const carlitoFonts = type0BaseFonts(await PDFDocument.load(await exportStudioPdf(page, /^Rapportletter-.+\.pdf$/)));
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/^\/Carlito-Regular-\d+$/));
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/^\/Carlito-Bold-\d+$/));
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/Inter/));

  // Naamweergave Volledig: de naamkolom krijgt de breedte van de langste naam, gemeten in de rapportletter.
  await openStep(page, 'columns');
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="full"]').click();
  await expect(page0.locator('text', { hasText: longName }).first()).toBeAttached();

  // Wissel naar Liberation Sans en exporteer meteen, terwijl de letter nog laadt (review Sol #837, ronde 1). De
  // test houdt de letter vast tot na de klik. De export moet wachten tot de kolommen op de nieuwe letter gemeten
  // zijn; met de breedte uit Carlito kapte de PDF de lange naam af.
  const heldFonts: string[] = [];
  let releaseFonts = () => {};
  const fontsReleased = new Promise<void>(resolve => { releaseFonts = resolve; });
  const liberationSansFiles = /LiberationSans-(Regular|Bold)\.ttf/;
  await page.route(liberationSansFiles, async route => {
    heldFonts.push(route.request().url());
    await fontsReleased;
    await route.continue();
  });
  await openStep(page, 'page');
  await fontPicker.click();
  await page.getByRole('option', { name: /^Liberation Sans/ }).click();
  await expect(fontPicker).toContainText(/^Liberation Sans/);
  await expect.poll(() => heldFonts.length).toBeGreaterThan(0);
  const lateDownload = page.waitForEvent('download');
  await page.locator('[data-rs-export]').click();
  // De klik viel terwijl de letter nog niet geladen was; pas nu laat de test hem door.
  expect(await loadedWeights('OpsReportLiberationSans')).toEqual([]);
  releaseFonts();
  const latePdf = await readPdf(await lateDownload);
  await page.unroute(liberationSansFiles);
  expect(type0BaseFonts(latePdf)).toContainEqual(expect.stringMatching(/^\/LiberationSans-\d+$/));
  const lateTexts = await pdfTextsInFont(latePdf, 'F0', 'src/services/pdf/fonts/LiberationSans-Regular.ttf');
  expect(lateTexts).toContain(longName);
  expect(lateTexts.filter(text => text.endsWith('…') && longName.startsWith(text.slice(0, -1)))).toEqual([]);

  // Eén keuze voor alle rapporten: het blok van een tabelrapport toont hem ook, en de tabel staat erin.
  await page.getByLabel(/^(Report type|Rapporttype)$/).first().click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();
  const tableFontPicker = page.locator('[data-ops-report-options]').getByLabel(/^(Font:|Lettertype:)$/);
  await expect(tableFontPicker).toContainText(/^Liberation Sans/);
  const tableReport = page.locator('[data-ops-table-report]');
  await expect(tableReport).toHaveCSS('font-family', /OpsReportLiberationSans/);

  // Raster-terugval (review Sol #837, ronde 1): zonder CJK-letter in de app valt de vector-export van een
  // CJK-naam terug op een DOM-opname (modern-screenshot). Die opname moet de gekozen letter meenemen. De haak
  // leest alleen de SVG die de opname als afbeelding laadt.
  await page.evaluate(() => {
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    const shots: string[] = [];
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get(this: HTMLImageElement) { return src.get!.call(this) as string; },
      set(this: HTMLImageElement, value: string) {
        if (typeof value === 'string' && value.startsWith('data:image/svg+xml')) shots.push(decodeURIComponent(value.slice(value.indexOf(',') + 1)));
        src.set!.call(this, value);
      },
    });
    Object.defineProperty(window, '__opsDomShots', { configurable: true, value: shots });
  });
  await page.evaluate(id => { window.__OPS__!.store.getState().updateTask(id, { name: '施工 Lettertaak' }); }, letterTaskId);
  await expect(tableReport).toContainText('施工 Lettertaak');
  const rasterDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  const rasterPdf = await readPdf(await rasterDownload);
  expect(type0BaseFonts(rasterPdf)).not.toContainEqual(expect.stringMatching(/LiberationSans/));
  // Per opname: de families waarvan een `@font-face`-regel met ingebedde bytes in de SVG staat.
  const shotFamilies = await page.evaluate(() => ((window as Window & { __opsDomShots?: string[] }).__opsDomShots ?? [])
    .map(svg => [...svg.matchAll(/@font-face\s*\{([^}]*)\}/g)]
      .filter(([, body]) => /url\(\s*["']?data:/.test(body))
      .map(([, body]) => (/font-family:\s*["']?([^"';]+)/.exec(body)?.[1] ?? '').trim())));
  expect(shotFamilies).toContainEqual(expect.arrayContaining(['OpsReportLiberationSans']));

  // Herstart van de app: de keuze komt terug uit de voorkeuren van het apparaat.
  await page.reload();
  await waitForOps(page);
  const recovery = page.locator('[data-ops-recovery-dialog]');
  const welcome = page.locator('[data-ops-welcome-dialog]');
  await expect(recovery.or(welcome).first()).toBeAttached({ timeout: 15_000 });
  if (await recovery.count() > 0) {
    await recovery.getByRole('button', { name: /^(Don't restore|Niet herstellen)$/ }).click();
    await expect(recovery).toHaveCount(0);
  }
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await expect(page.locator('[data-ops-report-options]').getByLabel(/^(Font:|Lettertype:)$/)).toContainText(/^Liberation Sans/);
  await page.getByLabel(/^(Report type|Rapporttype)$/).first().click();
  await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
  await openStep(page, 'page');
  await expect(page.getByLabel(/^(Font:|Lettertype:)$/)).toContainText(/^Liberation Sans/);
});
