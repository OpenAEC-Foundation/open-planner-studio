// Documenttabstrook zonder scrollbalk: pijlknoppen < > bij overloop, twee tabbladen per klik
// (uitgelijnd op de rand van een tabblad), het scrollwiel schuift horizontaal, en RTL spiegelt.
// De brug zet alleen de fixture (twaalf open projecten); klikken en scrollwiel zijn echte events.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

const viewportSel = '[data-ops-tabstrip-viewport]';
const startSel = '[data-ops-tabstrip-scroll-start]';
const endSel = '[data-ops-tabstrip-scroll-end]';

async function openProjects(page: Page, count: number): Promise<void> {
  await page.evaluate((n) => {
    const s = () => window.__OPS__!.store.getState();
    s().setProject({ name: 'Project 1' });
    for (let i = 2; i <= n; i += 1) {
      s().newDocument();
      s().setProject({ name: `Project ${i}` });
    }
  }, count);
  await expect(page.locator('[data-testid="document-tab"]')).toHaveCount(count);
}

/** Afstand tussen de beginrand van de viewport en de beginrand van tabblad `index` (0-based). */
async function startEdgeGap(page: Page, index: number, rtl: boolean): Promise<number> {
  return page.evaluate(({ sel, i, isRtl }) => {
    const viewport = document.querySelector(sel)!;
    const group = viewport.querySelectorAll('.ops-tab-group')[i]!;
    const v = viewport.getBoundingClientRect();
    const g = group.getBoundingClientRect();
    return isRtl ? v.right - g.right : g.left - v.left;
  }, { sel: viewportSel, i: index, isRtl: rtl });
}

async function scrollOffset(page: Page): Promise<number> {
  return page.locator(viewportSel).evaluate(el => Math.abs(el.scrollLeft));
}

async function expectTabAtStartEdge(page: Page, index: number, rtl: boolean): Promise<void> {
  await expect.poll(async () => Math.abs(await startEdgeGap(page, index, rtl)), {
    message: `tabblad ${index + 1} staat aan de beginrand`,
  }).toBeLessThanOrEqual(1);
  // Het schuiven moet tot rust gekomen zijn (vloeiend), niet toevallig voorbij komen.
  const settled = await scrollOffset(page);
  await page.waitForTimeout(150);
  expect(await scrollOffset(page)).toBeCloseTo(settled, 0);
  expect(Math.abs(await startEdgeGap(page, index, rtl))).toBeLessThanOrEqual(1);
}

async function activateViaOverview(page: Page, index: number): Promise<void> {
  await page.locator('.ops-tabstrip-menu').click();
  await page.locator('[data-ops-overview-card]').nth(index).click();
  await expect(page.locator('[data-testid="document-tab"]').nth(index)).toHaveAttribute('aria-selected', 'true');
}

async function expectNoScrollbar(viewport: Locator): Promise<void> {
  const metrics = await viewport.evaluate(el => ({
    gutter: (el as HTMLElement).offsetHeight - el.clientHeight,
    scrollbarWidth: getComputedStyle(el).scrollbarWidth,
  }));
  expect(metrics.gutter, 'scrollbalk neemt hoogte in').toBe(0);
  expect(metrics.scrollbarWidth).toBe('none');
}

async function expectDimmed(locator: Locator, dimmed: boolean): Promise<void> {
  const opacity = Number(await locator.evaluate(el => getComputedStyle(el).opacity));
  if (dimmed) expect(opacity, 'uitgeschakelde pijl is zichtbaar gedimd').toBeLessThan(0.6);
  else expect(opacity, 'actieve pijl is niet gedimd').toBe(1);
}

/** Vrije ruimte in de strook na de "+" (in de logische eindrichting), met een breed venster. */
async function stripSlack(page: Page): Promise<number> {
  return page.evaluate(() => {
    const strip = document.querySelector('[data-ops-tabstrip]')! as HTMLElement;
    const add = document.querySelector('.ops-tabstrip-add')!.getBoundingClientRect();
    const r = strip.getBoundingClientRect();
    const style = getComputedStyle(strip);
    return document.documentElement.dir === 'rtl'
      ? add.left - (r.left + Number.parseFloat(style.paddingLeft))
      : r.right - Number.parseFloat(style.paddingRight) - add.right;
  });
}

/** Aantal keer dat de pijlen binnen `ms` verschijnen of verdwijnen (0 = rustig). */
async function arrowToggles(page: Page, ms: number): Promise<number> {
  return page.evaluate(duration => new Promise<number>((resolve) => {
    let count = 0;
    const strip = document.querySelector('[data-ops-tabstrip]');
    if (!strip) { resolve(-1); return; }
    const observer = new MutationObserver(list => { for (const m of list) count += m.addedNodes.length + m.removedNodes.length; });
    observer.observe(strip, { childList: true });
    setTimeout(() => { observer.disconnect(); resolve(count); }, duration);
  }), ms);
}

/**
 * Loop de vensterbreedte per pixel langs de grens waar alles net past, eerst smaller en dan weer
 * breder. Bij elke stap moet de app er nog staan, de pijlen rustig zijn, en het juiste gedrag
 * gelden: smaller dan de grens pijlen, breder geen pijlen, en bij het breder worden een marge van
 * een paar pixels voordat ze verdwijnen.
 */
async function sweepOverflowBoundary(page: Page, label: string): Promise<void> {
  await page.setViewportSize({ width: 2600, height: 800 });
  await expect(page.locator('[data-ops-tabstrip-scroll]')).toHaveCount(0);
  const w0 = Math.round(2600 - await stripSlack(page));
  const step = async (width: number) => {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(60);
    expect(await arrowToggles(page, 120), `${label} w=${width} (grens ${w0}): pijlen rustig`).toBe(0);
    await expect(page.locator('[data-ops-tabstrip]'), `${label} w=${width}: app staat er nog`).toHaveCount(1);
    return page.locator('[data-ops-tabstrip-scroll]').count();
  };
  for (let w = w0 + 3; w >= w0 - 6; w -= 1) {
    const arrows = await step(w);
    if (w >= w0 + 1) expect(arrows, `${label} smaller, w=${w} (grens ${w0}): past, geen pijlen`).toBe(0);
    if (w <= w0 - 2) expect(arrows, `${label} smaller, w=${w} (grens ${w0}): past niet, pijlen`).toBe(1);
  }
  for (let w = w0 - 5; w <= w0 + 8; w += 1) {
    const arrows = await step(w);
    if (w <= w0 + 2) expect(arrows, `${label} breder, w=${w} (grens ${w0}): binnen de marge blijven de pijlen`).toBe(1);
    if (w >= w0 + 6) expect(arrows, `${label} breder, w=${w} (grens ${w0}): ruim genoeg, geen pijlen`).toBe(0);
  }
}

async function sweepTabCounts(page: Page, label: string): Promise<void> {
  await page.setViewportSize({ width: 2600, height: 800 });
  await openProjects(page, 4);
  await sweepOverflowBoundary(page, `${label} 4 tabbladen`);
  await page.evaluate(() => { for (let i = 5; i <= 8; i += 1) { const s = window.__OPS__!.store.getState(); s.newDocument(); window.__OPS__!.store.getState().setProject({ name: `Project ${i}` }); } });
  await expect(page.locator('[data-testid="document-tab"]')).toHaveCount(8);
  await sweepOverflowBoundary(page, `${label} 8 tabbladen`);
  await page.evaluate(() => { for (let i = 9; i <= 12; i += 1) { const s = window.__OPS__!.store.getState(); s.newDocument(); window.__OPS__!.store.getState().setProject({ name: `Project ${i}` }); } });
  await expect(page.locator('[data-testid="document-tab"]')).toHaveCount(12);
  await sweepOverflowBoundary(page, `${label} 12 tabbladen`);
}

test('vensterbreedte per pixel langs de overloopgrens: geen lus, geen lege app (4, 8, 12 tabbladen)', async ({ page, ops: _ops }) => {
  test.setTimeout(180_000);
  await sweepTabCounts(page, 'LTR');
});

test('RTL: vensterbreedte per pixel langs de overloopgrens (4, 8, 12 tabbladen)', async ({ page, ops: _ops }) => {
  test.setTimeout(180_000);
  await chooseLocale(page, LOCALE_CASES.find(locale => locale.code === 'ar')!);
  await sweepTabCounts(page, 'RTL');
});

test('geen scrollbalk; pijlen alleen bij overloop; klik schuift twee tabbladen; wiel schuift', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const viewport = page.locator(viewportSel);

  // Eén tabblad: geen overloop, geen pijlen.
  await expect(page.locator('[data-testid="document-tab"]')).toHaveCount(1);
  await expect(page.locator('[data-ops-tabstrip-scroll]')).toHaveCount(0);
  await expectNoScrollbar(viewport);

  await openProjects(page, 12);
  await expect(page.locator(startSel)).toBeVisible();
  await expect(page.locator(endSel)).toBeVisible();
  await expectNoScrollbar(viewport);
  await expect(page.locator(startSel)).toHaveAttribute('aria-label', 'Scroll tabs towards the start');
  await expect(page.locator(startSel)).toHaveAttribute('title', 'Scroll tabs towards the start');
  await expect(page.locator(endSel)).toHaveAttribute('aria-label', 'Scroll tabs towards the end');

  // De pijlen staan tussen de tabbladen en de "+", de "+" aan de eindrand.
  const vBox = (await viewport.boundingBox())!;
  const sBox = (await page.locator(startSel).boundingBox())!;
  const eBox = (await page.locator(endSel).boundingBox())!;
  const addBox = (await page.locator('.ops-tabstrip-add').boundingBox())!;
  expect(sBox.x).toBeGreaterThanOrEqual(vBox.x + vBox.width - 0.5);
  expect(eBox.x).toBeGreaterThan(sBox.x);
  expect(addBox.x).toBeGreaterThanOrEqual(eBox.x + eBox.width - 0.5);
  await expect(page.locator('.ops-tabstrip-add')).toBeInViewport({ ratio: 1 });

  // Het laatst geopende project is actief en in beeld: aan het eind, dus ">" uit.
  await expect(page.locator('[data-testid="document-tab"]').nth(11)).toBeInViewport({ ratio: 0.99 });
  await expect(page.locator(endSel)).toBeDisabled();
  await expect(page.locator(startSel)).toBeEnabled();
  await expectDimmed(page.locator(endSel), true);
  await expectDimmed(page.locator(startSel), false);

  // Activeren via het overzicht brengt tabblad 1 in beeld; aan het begin is "<" uit.
  await activateViaOverview(page, 0);
  await expect(page.locator('[data-testid="document-tab"]').nth(0)).toBeInViewport({ ratio: 0.99 });
  await expect.poll(() => scrollOffset(page)).toBeLessThanOrEqual(1);
  await expect(page.locator(startSel)).toBeDisabled();
  await expect(page.locator(endSel)).toBeEnabled();
  await expectDimmed(page.locator(startSel), true);
  await expectDimmed(page.locator(endSel), false);

  // Ctrl+wiel is zoomen, geen schuiven: de tabbladen blijven staan.
  await viewport.hover();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 240);
  await page.keyboard.up('Control');
  await page.waitForTimeout(250);
  expect(await scrollOffset(page), 'Ctrl+wiel schuift de tabbladen niet').toBeLessThanOrEqual(1);

  // ">" schuift precies twee tabbladen: tabblad 3 staat heel aan de beginrand.
  await page.locator(endSel).click();
  await expectTabAtStartEdge(page, 2, false);
  await expect(page.locator(startSel)).toBeEnabled();
  await page.locator(endSel).click();
  await expectTabAtStartEdge(page, 4, false);
  // "<" schuift twee terug.
  await page.locator(startSel).click();
  await expectTabAtStartEdge(page, 2, false);
  await page.locator(startSel).click();
  await expectTabAtStartEdge(page, 0, false);
  await expect(page.locator(startSel)).toBeDisabled();

  // Snel twee keer ">" (tijdens het vloeiend schuiven): samen vier tabbladen, tabblad 5 aan de rand.
  const endBox = (await page.locator(endSel).boundingBox())!;
  await page.mouse.click(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2);
  await page.waitForTimeout(50);
  await page.mouse.click(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2);
  await expectTabAtStartEdge(page, 4, false);

  // Half tabblad aan de rand (wiel 60 px): "<" telt dat halve tabblad als eerste stap en zet
  // tabblad 4 heel aan de rand; ">" schuift vanaf een half tabblad 2 twee verder (tabblad 4).
  await viewport.hover();
  await page.mouse.wheel(0, 60);
  await expect.poll(() => startEdgeGap(page, 4, false)).toBeLessThan(-30);
  await page.locator(startSel).click();
  await expectTabAtStartEdge(page, 3, false);
  await page.locator(startSel).click();
  await expectTabAtStartEdge(page, 1, false);
  await viewport.hover();
  await page.mouse.wheel(0, 60);
  await expect.poll(() => startEdgeGap(page, 1, false)).toBeLessThan(-30);
  await page.locator(endSel).click();
  await expectTabAtStartEdge(page, 3, false);

  // Terug naar het begin.
  await activateViaOverview(page, 0);
  await expect.poll(() => scrollOffset(page)).toBeLessThanOrEqual(1);

  // Klikken tot het eind: ">" wordt uitgeschakeld en het laatste tabblad staat in beeld.
  for (let i = 0; i < 8 && await page.locator(endSel).isEnabled(); i += 1) {
    await page.locator(endSel).click();
    await page.waitForTimeout(700);
  }
  await expect(page.locator(endSel)).toBeDisabled();
  await expect(page.locator('[data-testid="document-tab"]').nth(11)).toBeInViewport({ ratio: 0.99 });

  // Activeren via het overzicht van een tabblad buiten beeld brengt het in beeld.
  await activateViaOverview(page, 1);
  await expect(page.locator('[data-testid="document-tab"]').nth(1)).toBeInViewport({ ratio: 0.99 });

  // Verticaal scrollwiel boven de tabstrook schuift horizontaal.
  await activateViaOverview(page, 0);
  await expect.poll(() => scrollOffset(page)).toBeLessThanOrEqual(1);
  await viewport.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => scrollOffset(page)).toBeGreaterThan(100);
  await page.mouse.wheel(0, -240);
  await expect.poll(() => scrollOffset(page)).toBeLessThanOrEqual(1);

  // Venster breed genoeg: alles past, de pijlen verdwijnen en de "+" volgt het laatste tabblad.
  await page.setViewportSize({ width: 2600, height: 800 });
  await expect(page.locator('[data-ops-tabstrip-scroll]')).toHaveCount(0);
  const last = (await page.locator('.ops-tab-group').last().boundingBox())!;
  const plus = (await page.locator('.ops-tabstrip-add').boundingBox())!;
  expect(Math.abs(plus.x - (last.x + last.width))).toBeLessThanOrEqual(8);
  await expectNoScrollbar(viewport);

  // En weer smaller: de pijlen komen terug.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(endSel)).toBeVisible();
});

test('RTL: pijlen gespiegeld, klik schuift twee tabbladen, wiel schuift', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const ar = LOCALE_CASES.find(locale => locale.code === 'ar')!;
  await chooseLocale(page, ar);
  await openProjects(page, 12);
  // Eén tabblad zonder wijzigingen (geen stipje): daar loopt de naam door tot de padding, dus
  // alleen hier toont zich of het kruisje de naam raakt.
  await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  await expect(page.locator('[data-testid="document-tab"]')).toHaveCount(13);
  await expect(page.locator('.ops-tab-group').last().locator('.ops-dirty-dot')).toHaveCount(0);
  const viewport = page.locator(viewportSel);
  await expectNoScrollbar(viewport);

  await activateViaOverview(page, 0);
  await expect.poll(() => scrollOffset(page)).toBeLessThanOrEqual(1);
  await expectTabAtStartEdge(page, 0, true);
  await expect(page.locator(startSel)).toBeDisabled();

  // Gespiegeld: de pijlen staan links van de tabbladen, de knop naar het begin rechts van die naar
  // het eind, en wijst naar rechts.
  const vBox = (await viewport.boundingBox())!;
  const sBox = (await page.locator(startSel).boundingBox())!;
  const eBox = (await page.locator(endSel).boundingBox())!;
  expect(sBox.x + sBox.width).toBeLessThanOrEqual(vBox.x + 0.5);
  expect(sBox.x).toBeGreaterThan(eBox.x);
  await expect(page.locator(`${startSel} svg`)).toHaveAttribute('data-b2-icon', 'tabs.scroll-start');
  await expect(page.locator(`${startSel} svg`)).toHaveAttribute('data-b2-flip', 'x');
  await expect(page.locator(`${endSel} svg`)).toHaveAttribute('data-b2-icon', 'tabs.scroll-end');
  await expect(page.locator(`${endSel} svg`)).toHaveAttribute('data-b2-flip', 'x');

  // Elk sluitkruisje staat binnen zijn eigen tabblad, aan de logische eindkant (in RTL links).
  // Anders staat het naast de naam van het buurtabblad en sluit een klik het verkeerde project.
  const closeLayout = await page.evaluate(() => [...document.querySelectorAll('.ops-tab-group')].map((group) => {
    const g = group.getBoundingClientRect();
    const c = group.querySelector('.ops-tab-close')!.getBoundingClientRect();
    const name = group.querySelector('.ops-tab-name')!;
    const n = name.getBoundingClientRect();
    return {
      inside: c.left >= g.left - 0.5 && c.right <= g.right + 0.5,
      atLogicalEnd: c.right < (g.left + g.right) / 2,
      clearOfName: c.right <= n.left + 0.5,
      latinName: /^Project/.test(name.textContent ?? ''),
      clean: !group.querySelector('.ops-dirty-dot'),
      nameLtr: name.matches(':dir(ltr)'),
    };
  }));
  for (const [i, tab] of closeLayout.entries()) {
    expect(tab.inside, `kruisje ${i + 1} binnen zijn tabblad`).toBe(true);
    expect(tab.atLogicalEnd, `kruisje ${i + 1} aan de eindkant (links in RTL)`).toBe(true);
    expect(tab.clearOfName, `kruisje ${i + 1} overlapt de naam niet`).toBe(true);
    if (tab.latinName) expect(tab.nameLtr, `naam ${i + 1} (Latijns) loopt ltr, begin blijft zichtbaar`).toBe(true);
  }
  expect(closeLayout.filter(tab => tab.clean), 'de controle omvat een tabblad zonder wijzigingen').toHaveLength(1);
  // Een klik op het kruisje van tabblad 2 vraagt om tabblad 2 te sluiten, niet een buurtabblad.
  // De fixtureprojecten hebben wijzigingen, dus de klik vraagt eerst om bevestiging. De brug leest
  // alleen welk document gevraagd is; Annuleren (heeft de focus) laat alles open.
  const secondId = await page.locator('[data-testid="document-tab"]').nth(1).getAttribute('data-ops-tab');
  const closeTarget = page.locator('.ops-tab-group').nth(1).locator('.ops-tab-close');
  const closeBox = (await closeTarget.boundingBox())!;
  await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.pendingCloseDocId))
    .toBe(secondId);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.pendingCloseDocId)).toBe(null);
  await expect(page.locator('[data-testid="document-tab"]')).toHaveCount(13);

  await page.locator(endSel).click();
  await expectTabAtStartEdge(page, 2, true);
  await page.locator(startSel).click();
  await expectTabAtStartEdge(page, 0, true);
  await expect(page.locator(startSel)).toBeDisabled();

  await viewport.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => scrollOffset(page)).toBeGreaterThan(100);
  await expect(page.locator(startSel)).toBeEnabled();
});
