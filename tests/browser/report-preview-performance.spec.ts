import { expect, seedProject, test } from './fixtures/ops';
import type { Page } from '@playwright/test';

type PreviewGeometry = {
  index: number;
  height: number;
  hasImage: boolean;
  naturalWidth: number;
  quality: string | null;
  generation: string | null;
};

async function chooseQuality(page: Page, name: RegExp): Promise<void> {
  await page.getByLabel(/^(Preview quality|Previewkwaliteit)$/).click();
  await page.getByRole('option', { name }).click();
}

async function previewGeometry(page: Page): Promise<{
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  pages: PreviewGeometry[];
  visible: PreviewGeometry[];
}> {
  return page.locator('[data-report-preview-viewport]').evaluate(node => {
    const rootRect = node.getBoundingClientRect();
    const pages = [...node.querySelectorAll<HTMLElement>('[data-preview-page]')].map(element => {
      const image = element.querySelector<HTMLImageElement>('img');
      return {
        index: Number(element.dataset.previewPage),
        height: element.getBoundingClientRect().height,
        hasImage: image !== null,
        naturalWidth: image?.naturalWidth ?? 0,
        quality: image?.dataset.previewQuality ?? null,
        generation: image?.dataset.previewGeneration ?? null,
      };
    });
    return {
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      pages,
      visible: pages.filter(pageInfo => {
        const element = node.querySelector<HTMLElement>(`[data-preview-page="${pageInfo.index}"]`)!;
        const rect = element.getBoundingClientRect();
        return rect.bottom > rootRect.top && rect.top < rootRect.bottom;
      }),
    };
  });
}

async function firstVisibleAnchor(page: Page): Promise<{ index: number; relativeTop: number }> {
  return page.locator('[data-report-preview-viewport]').evaluate(node => {
    const rootRect = node.getBoundingClientRect();
    const visible = [...node.querySelectorAll<HTMLElement>('[data-preview-page]')]
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > rootRect.top && rect.top < rootRect.bottom)
      .sort((a, b) => Math.abs(a.rect.top - rootRect.top) - Math.abs(b.rect.top - rootRect.top))[0];
    if (!visible) throw new Error('geen zichtbare previewpagina');
    return {
      index: Number(visible.element.dataset.previewPage),
      relativeTop: visible.rect.top - rootRect.top,
    };
  });
}

test('De Vaart-preview houdt vaste pagina-geometrie en een stabiel scrollanker', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000);
  await seedProject(page, Array.from({ length: 260 }, (_, i) => ({
    name: `Taak ${i + 1}`,
    start: `2026-01-${String(1 + (i % 20)).padStart(2, '0')}`,
    finish: `2026-03-${String(1 + (i % 20)).padStart(2, '0')}`,
    durationDays: 20,
  })), 'Grote rapportpreview');
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    let created = 0;
    let revoked = 0;
    URL.createObjectURL = blob => { created++; return create(blob); };
    URL.revokeObjectURL = url => { revoked++; revoke(url); };
    Object.defineProperties(window, {
      __opsPreviewUrlsCreated: { configurable: true, get: () => created },
      __opsPreviewUrlsRevoked: { configurable: true, get: () => revoked },
    });
    localStorage.setItem('ops-reportSettings', JSON.stringify({ previewQuality: '300' }));
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const viewport = page.locator('[data-report-preview-viewport]');
  const firstImage = viewport.locator('img').first();
  await expect(firstImage).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  await expect(firstImage).toHaveAttribute('data-preview-quality', 'maximum');

  const initial = await previewGeometry(page);
  expect(initial.pages.length).toBeGreaterThan(2);
  // Ook nog niet gerasterde pagina's moeten vanaf de eerste layout exact dezelfde papiermaat
  // reserveren. Anders verandert scrollHeight onder de gebruiker zodra een pagina materialiseert.
  for (const previewPage of initial.pages) {
    expect(Math.abs(previewPage.height - initial.pages[0].height)).toBeLessThanOrEqual(1);
  }

  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error('previewviewport heeft geen afmetingen');
  await page.mouse.move(bounds.x + bounds.width - 20, bounds.y + bounds.height - 20);
  await page.mouse.wheel(0, initial.pages[0].height + 40);
  await expect.poll(async () => (await previewGeometry(page)).visible.every(pageInfo => pageInfo.hasImage), {
    timeout: 15_000,
  }).toBe(true);
  const afterScroll = await previewGeometry(page);
  expect(Math.abs(afterScroll.scrollHeight - initial.scrollHeight)).toBeLessThanOrEqual(2);
  expect(afterScroll.scrollTop).toBeGreaterThan(initial.pages[0].height * 0.75);
  expect(afterScroll.scrollTop).toBeLessThan(initial.pages[0].height * 1.5);
  // Geef ook de 700px-prefetchmarge tijd om leeg te lopen. De laatst gerenderde prefetch mag na
  // cache-snoeien geen pagina verdringen die nog echt in de viewport staat.
  await page.waitForTimeout(300);
  expect((await previewGeometry(page)).visible.every(pageInfo => pageInfo.hasImage)).toBe(true);
  const anchorAfterInitialScroll = await firstVisibleAnchor(page);

  // Materialiseer één keer de hele beperkte A3-preview. Zodra de laatste laadmelding verdwijnt,
  // moet de vast gereserveerde statusregel voorkomen dat scrollHeight alsnog een regel inzakt.
  for (let index = 0; index < initial.pages.length; index++) {
    await viewport.evaluate((node, pageIndex) => {
      const previewPage = node.querySelector<HTMLElement>(`[data-preview-page="${pageIndex}"]`);
      if (previewPage) node.scrollTop = previewPage.offsetTop;
    }, index);
    await expect(viewport.locator(`[data-preview-page="${index}"] img`)).toBeAttached({ timeout: 15_000 });
  }
  await expect(viewport.locator('[data-preview-cache-status]')).toHaveText('');
  expect(Math.abs((await previewGeometry(page)).scrollHeight - initial.scrollHeight)).toBeLessThanOrEqual(2);
  await viewport.evaluate((node, scrollTop) => { node.scrollTop = scrollTop; }, afterScroll.scrollTop);
  await expect.poll(async () => (await firstVisibleAnchor(page)).index).toBe(anchorAfterInitialScroll.index);

  const anchorBeforeQuality = await firstVisibleAnchor(page);
  await chooseQuality(page, /^(High|Hoog)( \(200%\))?$/);
  await expect.poll(async () => {
    const current = await previewGeometry(page);
    return current.visible.every(pageInfo => pageInfo.hasImage && pageInfo.quality === 'high');
  }, { timeout: 15_000 }).toBe(true);
  const anchorAfterQuality = await firstVisibleAnchor(page);
  expect(anchorAfterQuality.index).toBe(anchorBeforeQuality.index);
  expect(Math.abs(anchorAfterQuality.relativeTop - anchorBeforeQuality.relativeTop)).toBeLessThanOrEqual(2);

  // Ook een gejaagde reeks mag de browser niet naar de kwaliteitsknop of de eerste pagina trekken.
  // De knop staat daarom buiten de eigenlijke paginascroller; alleen het raster wordt vervangen.
  const anchorBeforeRapidQuality = await firstVisibleAnchor(page);
  const urlsBeforeRapidQuality = await page.evaluate(() => (
    (window as unknown as { __opsPreviewUrlsCreated: number }).__opsPreviewUrlsCreated
  ));
  await chooseQuality(page, /^(Standard|Standaard)$/);
  await chooseQuality(page, /^(Maximum|Maximaal)$/);
  await chooseQuality(page, /^(Standard|Standaard)$/);
  await chooseQuality(page, /^(Maximum|Maximaal)$/);
  await chooseQuality(page, /^(High|Hoog)$/);
  await expect.poll(async () => {
    const current = await previewGeometry(page);
    return current.visible.every(pageInfo => pageInfo.hasImage && pageInfo.quality === 'high');
  }, { timeout: 15_000 }).toBe(true);
  const anchorAfterRapidQuality = await firstVisibleAnchor(page);
  expect(anchorAfterRapidQuality.index).toBe(anchorBeforeRapidQuality.index);
  expect(Math.abs(anchorAfterRapidQuality.relativeTop - anchorBeforeRapidQuality.relativeTop)).toBeLessThanOrEqual(2);
  const urlsAfterRapidQuality = await page.evaluate(() => (
    (window as unknown as { __opsPreviewUrlsCreated: number }).__opsPreviewUrlsCreated
  ));
  // Vijf gebruikerswissels horen door generatie-annulering en de korte rustperiode niet vijf
  // complete paints op te leveren. Dit is een deterministische regressie voor de oude ~5,36 s-reeks.
  expect(urlsAfterRapidQuality - urlsBeforeRapidQuality).toBeLessThanOrEqual(3);

  // Een echte rapportoptie start een nieuwe generatie. De zichtbare pagina blijft gevuld en dezelfde
  // geometrie/positie houden; een oude async callback mag niet meer over de nieuwe generatie heen.
  const generationBefore = (await previewGeometry(page)).visible[0].generation;
  const weekends = page.getByLabel(/^(Weekends|Weekenden)$/);
  await weekends.uncheck();
  await weekends.check();
  await expect.poll(async () => {
    const current = await previewGeometry(page);
    return current.visible.every(pageInfo => pageInfo.hasImage && pageInfo.quality === 'high'
      && pageInfo.generation !== generationBefore);
  }, { timeout: 15_000 }).toBe(true);
  const afterOptions = await previewGeometry(page);
  expect(Math.abs(afterOptions.scrollHeight - initial.scrollHeight)).toBeLessThanOrEqual(2);

  const anchorBeforeResize = await firstVisibleAnchor(page);
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.setViewportSize({ width: 1440, height: 820 });
  await expect.poll(async () => (await previewGeometry(page)).visible.every(pageInfo => (
    pageInfo.hasImage && pageInfo.quality === 'high'
  )), { timeout: 15_000 }).toBe(true);
  expect((await firstVisibleAnchor(page)).index).toBe(anchorBeforeResize.index);

  // Ook een echte browsertab op de achtergrond en terug mag geen Blob-image kwijtraken of een
  // verouderde generatie opnieuw activeren.
  const backgroundPage = await page.context().newPage();
  await backgroundPage.goto('about:blank');
  await backgroundPage.bringToFront();
  await page.bringToFront();
  await backgroundPage.close();
  const afterBackground = await previewGeometry(page);
  expect(afterBackground.visible.every(pageInfo => (
    pageInfo.hasImage && pageInfo.quality === 'high'
  ))).toBe(true);
  expect(new Set(afterBackground.visible.map(pageInfo => pageInfo.generation)).size).toBe(1);

  // Blob-URL's moeten bij vervangen/evict werkelijk worden vrijgegeven; een dataURL laat zulke
  // grote base64-strings volledig aan GC over en was de belangrijkste geheugenpiek bij snel wisselen.
  const urls = await page.evaluate(() => ({
    created: (window as unknown as { __opsPreviewUrlsCreated: number }).__opsPreviewUrlsCreated,
    revoked: (window as unknown as { __opsPreviewUrlsRevoked: number }).__opsPreviewUrlsRevoked,
  }));
  expect(urls.created).toBeGreaterThan(2);
  expect(urls.revoked).toBeGreaterThan(0);

  // Weggaan en heropenen moet een verse, gevulde preview geven; geen stale image uit de vorige mount.
  await page.getByRole('button', { name: /^(Home|Start)$/ }).click();
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await expect(viewport.locator('img').first()).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  await expect(viewport.locator('img').first()).toHaveAttribute('data-preview-quality', 'high');

  // Snelle keuzereeksen en twee echte viewport-resizes mogen alleen de laatste generatie tonen.
  await chooseQuality(page, /^(Standard|Standaard)$/);
  await chooseQuality(page, /^(Maximum|Maximaal)$/);
  await chooseQuality(page, /^(Standard|Standaard)$/);
  await chooseQuality(page, /^(High|Hoog)$/);
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.setViewportSize({ width: 1440, height: 820 });
  await expect.poll(async () => {
    const current = await previewGeometry(page);
    return current.visible.length > 0
      && current.visible.every(pageInfo => pageInfo.hasImage && pageInfo.quality === 'high');
  }, { timeout: 20_000 }).toBe(true);

  // Herhaald openen/sluiten lekt geen huidige Blob-URL door en levert elke keer één bruikbare paint.
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /^(Home|Start)$/ }).click();
    await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
    await expect(viewport.locator('img').first()).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
    await expect(viewport.locator('img').first()).toHaveAttribute('data-preview-quality', 'high');
  }
  const urlsAfterReopen = await page.evaluate(() => ({
    created: (window as unknown as { __opsPreviewUrlsCreated: number }).__opsPreviewUrlsCreated,
    revoked: (window as unknown as { __opsPreviewUrlsRevoked: number }).__opsPreviewUrlsRevoked,
  }));
  expect(urlsAfterReopen.created).toBeGreaterThan(urls.created);
  expect(urlsAfterReopen.revoked).toBeGreaterThan(urls.revoked);
});

test('drie previewkwaliteiten wijzigen alleen rasterdichtheid, nooit papierlayout', async ({ page, ops: _ops }) => {
  test.setTimeout(45_000);
  await seedProject(page, [
    { name: 'Scherpe detailtaak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Tweede detailtaak', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
  ], 'Kwaliteit preview');
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const quality = page.getByLabel(/^(Preview quality|Previewkwaliteit)$/);
  const paper = page.locator('[data-preview-page]').first();
  const image = paper.locator('img');
  await expect(image).toBeVisible({ timeout: 20_000 });
  const cssSize = await paper.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  await chooseQuality(page, /^(Standard|Standaard)( \(100%\))?$/);
  await expect(image).toHaveAttribute('data-preview-quality', 'standard', { timeout: 15_000 });
  const standard = await image.evaluate(element => (element as HTMLImageElement).naturalWidth);

  await chooseQuality(page, /^(High|Hoog)( \(200%\))?$/);
  await expect(image).toHaveAttribute('data-preview-quality', 'high', { timeout: 15_000 });
  const high = await image.evaluate(element => (element as HTMLImageElement).naturalWidth);

  await chooseQuality(page, /^(Maximum|Maximaal)( \(300%\))?$/);
  await expect(image).toHaveAttribute('data-preview-quality', 'maximum', { timeout: 15_000 });
  const maximum = await image.evaluate(element => (element as HTMLImageElement).naturalWidth);
  const finalCssSize = await paper.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  expect(high).toBeGreaterThanOrEqual(standard * 1.45);
  expect(maximum).toBeGreaterThanOrEqual(high * 1.3);
  expect(finalCssSize.width).toBeCloseTo(cssSize.width, 0);
  expect(finalCssSize.height).toBeCloseTo(cssSize.height, 0);
  expect(await viewportOverflow(page)).toBeLessThanOrEqual(1);
  await expect(quality).toHaveText(/^(Maximum|Maximaal)( \(300%\))?$/);
});

async function viewportOverflow(page: Page): Promise<number> {
  return page.locator('[data-report-preview-viewport]').evaluate(node => node.scrollWidth - node.clientWidth);
}
