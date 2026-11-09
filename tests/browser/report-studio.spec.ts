// Het nieuwe Rapport-tabblad achter de feature flag `reportRedesign` (issue #817). Eén werkroute van een
// planner: tabblad openen, op het papier klikken om een stap te openen, een kolom toevoegen, Standaard en
// ongedaan maken, de zijbalk inklappen, in een zwevend venster typen en via de zwevende knop exporteren.
// De flag en een verouderde planning zijn fixtures (via de store), de rest zijn echte klikken en toetsen.
// Het venster is 1280×720: de kleinste maat waarop melding, "Kolom toevoegen" en stapvoet in beeld moeten blijven.
import { expect, seedProject, test } from './fixtures/ops';

test('rapport-studio: klik op het papier opent de stap, kolom toevoegen, zijbalk inklappen', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering storten', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Wanden metselen', start: '2026-09-21', finish: '2026-10-09', durationDays: 15 },
  ], 'Rapportstudio');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ featureFlags: { ...s.ui.featureFlags, reportRedesign: true } });
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const studio = page.locator('[data-rs-studio]');
  await expect(studio).toBeVisible();
  // Met de flag heeft het tabblad geen lintinhoud: alleen de tabnamen blijven staan.
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
  // stapvoet blijft zichtbaar. De keuze staat vooraf precies onderaan het scrollvak, zodat de klik niet
  // scrolt en alleen de app de melding in beeld kan brengen.
  await page.locator('[data-rs-step-body="bars"]').evaluate(el => {
    const seg = el.querySelector('[data-rs-segmented="statusLine"]')!;
    el.scrollTop += seg.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom + 1;
  });
  await page.locator('[data-rs-segmented="statusLine"] [data-rs-value="statusDate"]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-status-today]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-step-foot="bars"]')).toBeInViewport({ ratio: 1 });
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

  // Kolom Kalenderdagen toevoegen via de kiezer, met het toetsenbord. De headless browser draait in het
  // Engels; de kop volgt de taal van de app.
  const calendarDays = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl') ? 'Kalenderdagen' : 'Calendar days';
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-add-column]').click();
  await page.keyboard.type(calendarDays);
  await expect(page.locator('[data-rs-pick]').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-rs-column="task.time.calendarDays"]')).toBeVisible();
  // Na Enter is de kiezer dicht en staat de focus op "Kolom toevoegen", klaar voor de volgende.
  await expect(page.locator('[data-rs-picker]')).toHaveCount(0);
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

  // Standaard op Kolommen, daarna A2 in Pagina, dan ongedaan maken: de kolommen komen terug, A2 blijft.
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'));
  await page.locator('[data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await page.locator('[data-rs-step-head="page"]').click();
  await page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A2"]').click();
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns.length).toBe(7);
  expect((await saved()).paperSize).toBe('A2');

  // Zijbalk inklappen: de stapknoppen blijven, exporteren gaat via de zwevende knop linksonder. Het blad
  // wordt daarbij niet kleiner (Hele blad).
  const zoomPct = async () => Number((await page.locator('[data-rs-zoom="value"]').innerText()).replace(/\D/g, ''));
  await page.locator('[data-rs-zoom="page"]').click();
  const openZoom = await zoomPct();
  await page.locator('[data-rs-sidebar-toggle]').click();
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
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-add-column]')).toBeFocused();
  // Standaard in het zwevende venster, dan Ongedaan maken in de werkbalk: het venster blijft open en de
  // kolommen komen terug. De melding staat in de werkbalk, niet over een blad.
  await page.locator('[data-rs-popover="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-column]')).toHaveCount(6);
  await expect(page.locator('[data-rs-toolbar] [data-rs-undo]')).toBeVisible();
  await page.locator('[data-rs-undo-button]').click();
  await expect(page.locator('[data-rs-popover="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-column]')).toHaveCount(7);
  // Het venster groeit (kiezer open) en blijft binnen het scherm; de stapinhoud scrolt erin en de stapvoet
  // blijft in beeld.
  await page.locator('[data-rs-popover="columns"] [data-rs-add-column]').click();
  await expect(page.locator('[data-rs-picker-search]')).toBeVisible();
  await expect.poll(() => page.locator('[data-rs-popover="columns"]').evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  })).toBe(true);
  await expect(page.locator('[data-rs-step-foot="columns"]')).toBeInViewport({ ratio: 1 });
  // Escape sluit eerst de kiezer, dan het venster.
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rs-picker-search]')).toHaveCount(0);
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

  // Uitklappen: de knop in de zijbalk is terug, de zwevende knop weg.
  await page.locator('[data-rs-sidebar-toggle]').click();
  await expect(page.locator('[data-rs-export]')).toBeVisible();
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
  await page.locator('[data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await page.locator('[data-rs-step-head="page"]').click();
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

  // Ook het rapporttype volgt: een ander rapport in de opslag opent het oude paneel voor dat rapport, de
  // Gantt-afdruk weer het nieuwe tabblad. Het oude paneel laat de velden van het nieuwe tabblad staan.
  await refreshStored({ reportType: 'milestones' });
  await expect(studio).toHaveCount(0);
  await refreshStored({ reportType: 'gantt' });
  await expect(studio).toBeVisible();
  await expect(page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A1"]')).toHaveAttribute('aria-checked', 'true');
  expect(await saved()).toMatchObject({ reportType: 'gantt', paperSize: 'A1', columns: ['task.name'], orientation: 'portrait' });
});

// Een Arabische taaknaam bij naamweergave Volledig (review Sol #847). De meting van het papier en de PDF komt
// uit Noto Sans Arabic; het scherm moet dezelfde letter tekenen, anders tekende de browser de naam in een
// systeemletter (183 px in plaats van 175 px) en liep hij over de volgende kolom. Gecontroleerd op de
// werkelijk getekende tekst: in de SVG van het papier (`getBBox`, tegen de getekende kolomlijn) en, met de flag
// uit, op het canvas van het oude voorbeeld (`fillText`, meegelezen). Daarna hetzelfde voor een lange
// Latijnse naam (het canvas rondde letterbreedtes af en kapte die af terwijl afkappen uit stond) en voor een
// Chinese naam zonder CJK-extensie.
test('rapport-studio: een Arabische of lange naam past in de naamkolom, op het papier en in het oude voorbeeld', async ({ page, ops: _ops }) => {
  const arabic = 'أعمال البناء والتشييد وإدارة الموارد ومتابعة التنفيذ';
  const latin = 'Stakeholder management en afstemming met de gemeente over de bouwlogistiek';
  const [taskId] = await seedProject(page, [
    { name: arabic, start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Rapport Arabisch');
  // Alleen meelezen: wat het canvas van het oude voorbeeld tekent, met de letter en breedte van dat moment.
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawn: { text: string; x: number; font: string; width: number }[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
      if (this.font.includes('InterPDF')) drawn.push({ text: String(text), x, font: this.font, width: this.measureText(text).width });
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsReportDrawn', { configurable: true, value: drawn });
  });
  // De breedte volgens de meting van papier en PDF (`loadReportTextMetrics`), op de letter van de naamcel.
  const measured = (text: string, font: string) => page.evaluate(async ({ text, font }) => {
    const { loadReportTextMetrics } = await import('/src/services/pdf/fontLoader.ts' as string);
    return (await loadReportTextMetrics('inter', 'ltr')).measure(text, font) as number;
  }, { text, font });
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ featureFlags: { ...s.ui.featureFlags, reportRedesign: true } });
  });
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();
  await page.locator('[data-rs-step-head="columns"]').click();
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
  const paperCell = async (name: string) => {
    await expect.poll(() => nameCell(name).then(c => c !== null && Number.isFinite(c.border))).toBe(true);
    const cell = (await nameCell(name))!;
    // Dezelfde breedte als de meting (dus dezelfde letter), en de naam eindigt vóór de rechtermarge van de
    // kolom (2 px, `NAME_RIGHT_PAD`): niets loopt over de kolomlijn.
    expect(Math.abs(cell.drawn - await measured(name, cell.font)), `getekend ${cell.drawn}`).toBeLessThan(0.1);
    expect(cell.end, `kolomlijn op ${cell.border}`).toBeLessThanOrEqual(cell.border - 2);
    return cell;
  };
  const arabicCell = await paperCell(arabic);
  expect(arabicCell.family).toMatch(/^"?OpsReportArabic"?, /);
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === 'OpsReportArabic' && face.status === 'loaded').map(face => face.weight).sort()))
    .toEqual(['400', '700']);

  // Het oude voorbeeld (flag uit) leest dezelfde opgeslagen naamweergave en meet met dezelfde meting. Het
  // canvas tekent de naam volledig, in Noto vooraan, en even breed als de meting.
  const canvasName = (name: string) => page.evaluate(name => {
    const drawn = (window as Window & { __opsReportDrawn?: { text: string; x: number; font: string; width: number }[] }).__opsReportDrawn ?? [];
    const cells = drawn.filter(d => d.text === name || (d.text.endsWith('…') && name.startsWith(d.text.slice(0, 8))));
    return cells.length === 0 ? null : cells.reduce((a, b) => (b.x < a.x ? b : a));
  }, name);
  const clearDrawn = () => page.evaluate(() => {
    (window as Window & { __opsReportDrawn?: unknown[] }).__opsReportDrawn!.length = 0;
  });
  const canvasCell = async (name: string) => {
    await expect.poll(() => canvasName(name).then(c => c?.text ?? null), { timeout: 20_000 }).toBe(name);
    const cell = (await canvasName(name))!;
    expect(Math.abs(cell.width - await measured(name, cell.font)), `canvas ${cell.width}`).toBeLessThan(0.1);
    return cell;
  };
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'))).truncateTaskNames).toBe(false);
  await clearDrawn();
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ featureFlags: { ...s.ui.featureFlags, reportRedesign: false } });
  });
  await expect(page.locator('[data-tour-anchor="report-panel"] img').first()).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  expect((await canvasCell(arabic)).font).toMatch(/^(bold )?[\d.]+px "?OpsReportArabic"?, /);

  // Een lange Latijnse naam, nu de langste: hetzelfde op het canvas en, met de flag weer aan, op het papier.
  await clearDrawn();
  await page.evaluate(({ id, name }) => window.__OPS__!.store.getState().updateTask(id, { name }), { id: taskId, name: latin });
  await canvasCell(latin);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ featureFlags: { ...s.ui.featureFlags, reportRedesign: true } });
  });
  await expect(page0).toBeVisible();
  await paperCell(latin);

  // Een naam in een schrift dat geen meegeleverde letter heeft (Chinees zonder CJK-extensie): het scherm
  // tekent hem in een systeemletter en de PDF valt dan terug op raster. De meting volgt dan de browser, niet
  // de lege glyph van Inter.
  await page.evaluate(({ id }) => window.__OPS__!.store.getState().updateTask(id, { name: '地基浇筑与钢筋绑扎工程施工' }), { id: taskId });
  await paperCell('地基浇筑与钢筋绑扎工程施工');
});
