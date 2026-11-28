import type { Locator, Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';
import { chooseLocale, LOCALE_CASES } from './fixtures/locale';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.beforeEach(async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ leftPanelWidth: 350 }));
});

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
}

async function selectedRowIs(page: Page, rowKey: string): Promise<boolean> {
  const ids = (await state(page)).selectedTaskIds;
  return ids.length === 1 && rowKey.includes(ids[0]);
}

type Surface = 'gantt-task-grid' | 'full-task-grid';

async function overlayLayout(page: Page, surface: Surface) {
  return page.evaluate(selector => {
    const shell = document.querySelector<HTMLElement>(selector)!;
    const core = shell.querySelector<HTMLElement>('.task-grid-core')!;
    const header = core.querySelector<HTMLElement>('.task-grid-header-row')!;
    const v = shell.querySelector<HTMLElement>('[data-testid="task-grid-vscroll"]')!;
    const h = shell.querySelector<HTMLElement>('[data-testid="task-grid-hscroll"]');
    const c = core.getBoundingClientRect();
    const vb = v.getBoundingClientRect();
    return {
      gutterX: core.offsetWidth - core.clientWidth,
      gutterY: core.offsetHeight - core.clientHeight,
      vLeftGap: vb.left - c.left,
      vRightGap: c.right - vb.right,
      vTopGap: vb.top - header.getBoundingClientRect().bottom,
      vRange: v.scrollHeight - v.clientHeight,
      coreRangeY: core.scrollHeight - core.clientHeight,
      hRange: h ? h.scrollWidth - h.clientWidth : null,
      coreRangeX: core.scrollWidth - core.clientWidth,
    };
  }, `[data-task-grid-surface-id="${surface}"] .task-grid-shell`);
}

async function clickRowAt(page: Page, x: number, y: number): Promise<string> {
  const rowKey = await page.evaluate(({ px, py }) => {
    const hit = document.elementFromPoint(px, py);
    return hit?.closest<HTMLElement>('[data-grid-data-row]')?.dataset.gridRowKey ?? null;
  }, { px: x, py: y });
  const hitInfo = await page.evaluate(({ px, py }) => {
    const hit = document.elementFromPoint(px, py) as HTMLElement | null;
    return hit ? `${hit.tagName}.${hit.className}` : 'niets';
  }, { px: x, py: y });
  expect(rowKey, `geen rastercel op (${x}, ${y}): ${hitInfo}`).not.toBeNull();
  await page.mouse.click(x, y);
  return rowKey!;
}

test('takenlijst heeft zwevende balken zonder gereserveerde strook; schuiven en klikken blijven werken', async ({ page, ops: _ops }) => {
  const taskIds = await seedProject(page, Array.from({ length: 80 }, (_, index) => ({
    name: `Zweefrij ${index + 1}`,
    start: '2026-09-07',
    finish: '2026-09-11',
    durationDays: 5,
  })));

  const nativeGutter = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;width:100px;height:100px;overflow:scroll';
    document.body.append(probe);
    const gutter = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    return gutter;
  });
  expect(nativeGutter).toBeGreaterThan(0);

  const core = page.locator('.gantt-task-grid .task-grid-core');
  await expect(core).toBeVisible();
  expect(await core.evaluate((node: HTMLElement) => ({
    x: node.offsetWidth - node.clientWidth,
    y: node.offsetHeight - node.clientHeight,
    overflowsY: node.scrollHeight > node.clientHeight,
  }))).toEqual({ x: 0, y: 0, overflowsY: true });

  const vBar = page.locator('.gantt-task-grid [data-testid="task-grid-vscroll"]');
  await expect(vBar).toBeVisible();
  const coreBox = await box(core);
  const vBox = await box(vBar);
  expect(Math.round(vBox.x + vBox.width)).toBe(Math.round(coreBox.x + coreBox.width));
  expect(vBox.width).toBe(8);
  const layout = await overlayLayout(page, 'gantt-task-grid');
  expect(Math.abs(layout.vTopGap)).toBeLessThanOrEqual(0.5);
  expect(layout.vRange).toBe(layout.coreRangeY);
  expect(layout.hRange).toBe(layout.coreRangeX);

  await page.locator('.gantt-task-grid .task-grid-add-column').focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return {
      inGrid: Boolean(active?.closest('.gantt-task-grid .task-grid-core')),
      overlay: active?.dataset.testid ?? null,
    };
  })).toEqual({ inGrid: true, overlay: null });

  const barBefore = await barPoint(page, taskIds[0]);
  await page.mouse.move(coreBox.x + coreBox.width / 2, coreBox.y + coreBox.height / 2);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBeGreaterThan(0);
  const scrolled = (await state(page)).view.scrollY;
  await expect.poll(() => core.evaluate((node: HTMLElement) => node.scrollTop)).toBe(scrolled);
  await expect.poll(() => vBar.evaluate((node: HTMLElement) => node.scrollTop)).toBe(scrolled);
  await expect.poll(async () => Math.round(barBefore.y - (await barPoint(page, taskIds[0])).y)).toBe(Math.round(scrolled));

  await page.mouse.wheel(0, -5000);
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBe(0);
  await page.mouse.move(vBox.x + vBox.width / 2, vBox.y + 24);
  await page.mouse.down();
  await page.mouse.move(vBox.x + vBox.width / 2, vBox.y + 124, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBeGreaterThan(0);
  const dragged = (await state(page)).view.scrollY;
  expect(await core.evaluate((node: HTMLElement) => node.scrollTop)).toBe(dragged);

  const hOverlay = page.locator('.gantt-task-grid [data-testid="task-grid-hscroll"]');
  const hOverlayBox = await box(hOverlay);
  const coreLeft = () => core.evaluate((node: HTMLElement) => node.scrollLeft);
  const coreTop = () => core.evaluate((node: HTMLElement) => node.scrollTop);
  const topBeforeShift = await coreTop();
  expect(await coreLeft()).toBe(0);
  await page.mouse.move(hOverlayBox.x + hOverlayBox.width / 2, hOverlayBox.y + hOverlayBox.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 100);
  await page.keyboard.up('Shift');
  await expect.poll(coreLeft).toBeGreaterThan(0);
  expect(await coreTop()).toBe(topBeforeShift);
  await page.mouse.move(coreBox.x + coreBox.width / 2, coreBox.y + coreBox.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -500);
  await page.keyboard.up('Shift');
  await expect.poll(coreLeft).toBe(0);
  await page.mouse.move(vBox.x + vBox.width / 2, vBox.y + vBox.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 100);
  await page.keyboard.up('Shift');
  await expect.poll(coreLeft).toBeGreaterThan(0);
  expect(await coreTop()).toBe(topBeforeShift);
  await page.mouse.move(coreBox.x + coreBox.width / 2, coreBox.y + coreBox.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -500);
  await page.keyboard.up('Shift');
  await expect.poll(coreLeft).toBe(0);

  await page.mouse.click(vBox.x + vBox.width / 2, vBox.y + vBox.height - 12);
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBeGreaterThan(dragged);
  let lastTop = -1;
  await expect.poll(async () => {
    const top = await core.evaluate((node: HTMLElement) => node.scrollTop);
    const settled = top === lastTop;
    lastTop = top;
    return settled;
  }, { intervals: [100] }).toBe(true);

  const rowY = vBox.y + 3 * 25;
  const besideThumb = await clickRowAt(page, vBox.x - 2, rowY);
  await expect.poll(() => selectedRowIs(page, besideThumb)).toBe(true);
  const hBar = page.locator('.gantt-task-grid [data-testid="task-grid-hscroll"]');
  await expect(hBar).toBeVisible();
  {
    const hBox = await box(hBar);
    expect(hBox.height).toBe(8);
    expect(Math.round(hBox.y + hBox.height)).toBe(Math.round(coreBox.y + coreBox.height));
    expect(Math.round(vBox.y + vBox.height)).toBe(Math.round(hBox.y));
    const aboveThumb = await clickRowAt(page, coreBox.x + 40, hBox.y - 2);
    await expect.poll(() => selectedRowIs(page, aboveThumb)).toBe(true);
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="gridcell"]')))).toBe(true);
    const thumbBox = await box(vBar);
    await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height - 30);
    await page.mouse.down();
    await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height - 80, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return { inGrid: Boolean(active?.closest('.gantt-task-grid .task-grid-core')), overlay: active?.dataset.testid ?? null };
    })).toEqual({ inGrid: true, overlay: null });
  }
});

async function settledScrollTop(core: Locator): Promise<number> {
  let last = -1;
  await expect.poll(async () => {
    const top = await core.evaluate((node: HTMLElement) => node.scrollTop);
    const settled = top === last;
    last = top;
    return settled;
  }, { intervals: [120] }).toBe(true);
  return last;
}

async function bottomGeometry(page: Page, lastTaskId: string) {
  const geometry = await page.evaluate(() => {
    const core = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
    const rows = [...core.querySelectorAll<HTMLElement>('[data-grid-data-row]')];
    const ghost = rows.find(row => row.dataset.gridRowKey === 'ops-ghost-row');
    const real = rows.filter(row => row !== ghost);
    const last = real[real.length - 1].getBoundingClientRect();
    const ghostBox = ghost?.getBoundingClientRect() ?? { top: Number.NaN, bottom: Number.NaN };
    const hBar = document.querySelector('.gantt-task-grid [data-testid="task-grid-hscroll"]')!.getBoundingClientRect();
    return {
      scrollTop: core.scrollTop,
      maxScrollTop: core.scrollHeight - core.clientHeight,
      scrollLeft: core.scrollLeft,
      storeScrollY: window.__OPS__!.store.getState().view.scrollY,
      lastRowMid: last.top + last.height / 2,
      rowHeight: last.height,
      ghostTop: ghostBox.top,
      ghostBottom: ghostBox.bottom,
      hBarTop: hBar.top,
    };
  });
  const bar = await barPoint(page, lastTaskId);
  return { ...geometry, ganttBarMid: bar.y };
}

test('helemaal onderaan: spookregel zichtbaar, opzij schuiven houdt de stand, tabel en Gantt op één hoogte', async ({ page, ops: _ops }) => {
  const taskIds = await seedProject(page, Array.from({ length: 80 }, (_, index) => ({
    name: `Onderrij ${index + 1}`,
    start: '2026-09-07',
    finish: '2026-09-11',
    durationDays: 5,
  })));
  const lastTaskId = taskIds[taskIds.length - 1];
  const core = page.locator('.gantt-task-grid .task-grid-core');
  await expect(core).toBeVisible();
  await expect(page.locator('.gantt-task-grid [data-testid="task-grid-hscroll"]')).toBeVisible();
  const coreBox = await box(core);

  await page.mouse.move(coreBox.x + coreBox.width / 2, coreBox.y + coreBox.height / 2);
  for (let step = 0; step < 12; step++) await page.mouse.wheel(0, 600);
  await settledScrollTop(core);
  const bottom = await bottomGeometry(page, lastTaskId);
  expect(bottom.scrollTop).toBe(bottom.maxScrollTop);
  expect(bottom.storeScrollY).toBe(bottom.scrollTop);
  expect(bottom.ghostBottom).toBeLessThanOrEqual(bottom.hBarTop + 0.5);
  expect(Math.abs(bottom.lastRowMid - bottom.ganttBarMid)).toBeLessThanOrEqual(1);
  expect(Math.abs(bottom.ghostTop - (bottom.ganttBarMid + bottom.rowHeight / 2))).toBeLessThanOrEqual(1);

  const hBox = await box(page.locator('.gantt-task-grid [data-testid="task-grid-hscroll"]'));
  await page.mouse.move(hBox.x + 24, hBox.y + hBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hBox.x + 64, hBox.y + hBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => core.evaluate((node: HTMLElement) => node.scrollLeft)).toBeGreaterThan(0);
  const afterDrag = await core.evaluate((node: HTMLElement) => node.scrollLeft);
  expect(await core.evaluate((node: HTMLElement) => node.scrollTop)).toBe(bottom.scrollTop);
  await page.mouse.move(coreBox.x + coreBox.width / 2, coreBox.y + coreBox.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -20);
  await page.keyboard.up('Shift');
  await expect.poll(() => core.evaluate((node: HTMLElement) => node.scrollLeft)).toBeLessThan(afterDrag);
  await page.waitForTimeout(300);
  const sideways = await bottomGeometry(page, lastTaskId);
  expect(sideways.scrollLeft).toBeGreaterThan(0);
  expect(sideways.scrollTop).toBe(bottom.scrollTop);
  expect(sideways.storeScrollY).toBe(bottom.scrollTop);
  expect(sideways.ghostBottom).toBeLessThanOrEqual(sideways.hBarTop + 0.5);
  expect(Math.abs(sideways.lastRowMid - sideways.ganttBarMid)).toBeLessThanOrEqual(1);

  for (let step = 0; step < 12; step++) await page.mouse.wheel(0, -600);
  await expect.poll(() => core.evaluate((node: HTMLElement) => node.scrollTop)).toBe(0);
  await page.mouse.move(coreBox.x + coreBox.width + 300, coreBox.y + coreBox.height / 2);
  await page.keyboard.down('Shift');
  for (let step = 0; step < 12; step++) await page.mouse.wheel(0, 600);
  await page.keyboard.up('Shift');
  await settledScrollTop(core);
  const viaGantt = await bottomGeometry(page, lastTaskId);
  expect(viaGantt.scrollTop).toBe(viaGantt.maxScrollTop);
  expect(viaGantt.storeScrollY).toBe(viaGantt.scrollTop);
  expect(Math.abs(viaGantt.lastRowMid - viaGantt.ganttBarMid)).toBeLessThanOrEqual(1);
});

const AR = LOCALE_CASES.find(locale => locale.code === 'ar')!;
const LAYOUT_CASES: ReadonlyArray<{ name: string; surface: Surface; rtl: boolean }> = [
  { name: 'ar, Gantt', surface: 'gantt-task-grid', rtl: true },
  { name: 'Tabel', surface: 'full-task-grid', rtl: false },
  { name: 'ar, Tabel', surface: 'full-task-grid', rtl: true },
];
for (const layoutCase of LAYOUT_CASES) {
  test(`zwevende balken: ${layoutCase.name}`, async ({ page, ops: _ops }) => {
    await seedProject(page, Array.from({ length: 80 }, (_, index) => ({
      name: `Ligrij ${index + 1}`,
      start: '2026-09-07',
      finish: '2026-09-11',
      durationDays: 5,
    })));
    if (layoutCase.surface === 'full-task-grid') {
      await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
    }
    if (layoutCase.rtl) await chooseLocale(page, AR);
    const shellSelector = `[data-task-grid-surface-id="${layoutCase.surface}"] .task-grid-shell`;
    const core = page.locator(`${shellSelector} .task-grid-core`);
    const vBar = page.locator(`${shellSelector} [data-testid="task-grid-vscroll"]`);
    await expect(vBar).toBeVisible();
    const layout = await overlayLayout(page, layoutCase.surface);
    expect(layout.gutterX).toBe(0);
    expect(layout.gutterY).toBe(0);
    expect(Math.abs(layout.vTopGap)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(layoutCase.rtl ? layout.vLeftGap : layout.vRightGap)).toBeLessThanOrEqual(0.5);
    expect(layout.vRange).toBe(layout.coreRangeY);
    if (layout.hRange !== null) expect(layout.hRange).toBe(layout.coreRangeX);

    const vBox = await box(vBar);
    await page.mouse.move(vBox.x + vBox.width / 2, vBox.y + 24);
    await page.mouse.down();
    await page.mouse.move(vBox.x + vBox.width / 2, vBox.y + 124, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => core.evaluate((node: HTMLElement) => node.scrollTop)).toBeGreaterThan(0);
    expect(await vBar.evaluate((node: HTMLElement) => node.scrollTop))
      .toBe(await core.evaluate((node: HTMLElement) => node.scrollTop));
  });
}

test('een verouderd scroll-event van balk of store zet het raster niet terug', async ({ page, ops: _ops }) => {
  await seedProject(page, Array.from({ length: 120 }, (_, index) => ({
    name: `Echorij ${index + 1}`,
    start: '2026-09-07',
    finish: '2026-09-11',
    durationDays: 5,
  })));
  const core = page.locator('.gantt-task-grid .task-grid-core');
  const vBar = page.locator('.gantt-task-grid [data-testid="task-grid-vscroll"]');
  const hBar = page.locator('.gantt-task-grid [data-testid="task-grid-hscroll"]');
  await expect(vBar).toBeVisible();
  await expect(hBar).toBeVisible();
  const settle = () => page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50)));
  }));

  await core.evaluate((node: HTMLElement) => { node.scrollTop = 100; });
  await expect.poll(() => vBar.evaluate((node: HTMLElement) => node.scrollTop)).toBe(100);
  await settle();
  await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
    const bar = document.querySelector<HTMLElement>('.gantt-task-grid [data-testid="task-grid-vscroll"]')!;
    grid.scrollTop = 400;
    bar.dispatchEvent(new Event('scroll'));
  });
  await settle();
  expect(await core.evaluate((node: HTMLElement) => node.scrollTop)).toBe(400);
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBe(400);

  await core.evaluate((node: HTMLElement) => { node.scrollLeft = 10; });
  await expect.poll(() => hBar.evaluate((node: HTMLElement) => node.scrollLeft)).toBe(10);
  await settle();
  await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
    const bar = document.querySelector<HTMLElement>('.gantt-task-grid [data-testid="task-grid-hscroll"]')!;
    grid.scrollLeft = 30;
    bar.dispatchEvent(new Event('scroll'));
  });
  await settle();
  expect(await core.evaluate((node: HTMLElement) => node.scrollLeft)).toBe(30);

  await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
    const win = window as unknown as { __echoBlock?: boolean; __echoBlocker?: (event: Event) => void };
    win.__echoBlock = false;
    win.__echoBlocker = event => {
      if (win.__echoBlock && event.target === grid) event.stopImmediatePropagation();
    };
    window.addEventListener('scroll', win.__echoBlocker, true);
    grid.scrollTop = 600;
    grid.dispatchEvent(new Event('scroll'));
    win.__echoBlock = true;
    grid.scrollTop = 650;
  });
  await settle();
  await settle();
  await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
    const win = window as unknown as { __echoBlock?: boolean; __echoBlocker?: (event: Event) => void };
    win.__echoBlock = false;
    window.removeEventListener('scroll', win.__echoBlocker!, true);
    grid.dispatchEvent(new Event('scroll'));
  });
  await settle();
  expect(await core.evaluate((node: HTMLElement) => node.scrollTop)).toBe(650);
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBe(650);

  await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
    const bar = document.querySelector<HTMLElement>('.gantt-task-grid [data-testid="task-grid-vscroll"]')!;
    bar.scrollTop = 800;
    bar.dispatchEvent(new Event('scroll'));
    bar.scrollTop = 1000;
    grid.dispatchEvent(new Event('scroll'));
  });
  await settle();
  await settle();
  expect(await vBar.evaluate((node: HTMLElement) => node.scrollTop)).toBe(1000);
  expect(await core.evaluate((node: HTMLElement) => node.scrollTop)).toBe(1000);
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBe(1000);
});

test('een store-sprong heen en terug vóór het scroll-event van het raster eindigt op de laatste stand', async ({ page, ops: _ops }) => {
  await seedProject(page, Array.from({ length: 120 }, (_, index) => ({
    name: `Sprongrij ${index + 1}`,
    start: '2026-09-07',
    finish: '2026-09-11',
    durationDays: 5,
  })));
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ leftPanelWidth: 200 }));
  const core = page.locator('.gantt-task-grid .task-grid-core');
  await expect(page.locator('.gantt-task-grid [data-testid="task-grid-vscroll"]')).toBeVisible();
  const settle = () => page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50)));
  }));

  for (const axis of ['top', 'left'] as const) {
    const domProp: 'scrollTop' | 'scrollLeft' = axis === 'top' ? 'scrollTop' : 'scrollLeft';
    const storeValue = () => page.evaluate(a => {
      const s = window.__OPS__!.store.getState();
      return a === 'top' ? s.view.scrollY : s.taskGridSurfaces['gantt-task-grid'].scrollX;
    }, axis);
    const range = await core.evaluate((node: HTMLElement, a) => (a === 'top'
      ? node.scrollHeight - node.clientHeight
      : node.scrollWidth - node.clientWidth), axis);
    expect(range, `schuifruimte ${axis}`).toBeGreaterThanOrEqual(60);
    const near = Math.min(500, Math.round(range / 3));
    const far = Math.min(800, Math.round((range * 2) / 3));
    const domValue = () => core.evaluate((node: HTMLElement, p: 'scrollTop' | 'scrollLeft') => node[p], domProp);
    const storeWrite = (value: number) => page.evaluate(([a, v]) => {
      const s = window.__OPS__!.store.getState();
      if (a === 'top') s.setScroll(s.view.scrollX, v);
      else s.setTaskGridScrollX('gantt-task-grid', v);
    }, [axis, value] as const);

    await core.evaluate((node: HTMLElement, [p, v]: readonly ['scrollTop' | 'scrollLeft', number]) => {
      node[p] = v;
    }, [domProp, near] as const);
    await expect.poll(storeValue).toBe(near);
    await settle();

    await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
      const win = window as unknown as { __jumpBlocker?: (event: Event) => void };
      win.__jumpBlocker = event => { if (event.target === grid) event.stopImmediatePropagation(); };
      window.addEventListener('scroll', win.__jumpBlocker, true);
    });
    await storeWrite(far);
    await settle();
    expect(await domValue()).toBe(far);
    await storeWrite(near);
    await settle();
    await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
      const win = window as unknown as { __jumpBlocker?: (event: Event) => void };
      window.removeEventListener('scroll', win.__jumpBlocker!, true);
      grid.dispatchEvent(new Event('scroll'));
    });
    await settle();
    expect(await domValue(), `raster ${axis}`).toBe(near);
    await expect.poll(storeValue).toBe(near);
  }
});

test('Ctrl+End toont de laatste rij boven de horizontale balk', async ({ page, ops: _ops }) => {
  await seedProject(page, Array.from({ length: 120 }, (_, index) => ({
    name: `Eindrij ${index + 1}`,
    start: '2026-09-07',
    finish: '2026-09-11',
    durationDays: 5,
  })));
  const core = page.locator('.gantt-task-grid .task-grid-core');
  const hBar = page.locator('.gantt-task-grid [data-testid="task-grid-hscroll"]');
  await expect(hBar).toBeVisible();
  const coreBox = await box(core);
  const firstRow = page.locator('.gantt-task-grid [data-grid-data-row]').first();
  const firstBox = await box(firstRow);
  await clickRowAt(page, coreBox.x + 40, firstBox.y + firstBox.height / 2);
  await page.keyboard.press('Control+End');
  await expect.poll(() => core.evaluate((node: HTMLElement) => node.scrollTop)).toBeGreaterThan(0);
  await settledScrollTop(core);
  const geometry = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.gantt-task-grid .task-grid-core')!;
    const bar = document.querySelector<HTMLElement>('.gantt-task-grid [data-testid="task-grid-hscroll"]')!;
    const active = document.activeElement?.closest<HTMLElement>('[data-grid-data-row]');
    return {
      activeInGrid: !!active && grid.contains(active),
      activeBottom: active?.getBoundingClientRect().bottom ?? Number.NaN,
      hBarTop: bar.getBoundingClientRect().top,
      scrollTop: grid.scrollTop,
      maxScrollTop: grid.scrollHeight - grid.clientHeight,
    };
  });
  expect(geometry.activeInGrid).toBe(true);
  expect(geometry.activeBottom).toBeLessThanOrEqual(geometry.hBarTop + 0.5);
  expect(Math.abs(geometry.scrollTop - geometry.maxScrollTop)).toBeLessThanOrEqual(1);
});

test('Tabel na de Gantt in een kleiner venster: store volgt het raster tot onderaan', async ({ page, ops: _ops }) => {
  await seedProject(page, Array.from({ length: 200 }, (_, index) => ({
    name: `Tabelrij ${index + 1}`,
    start: '2026-09-07',
    finish: '2026-09-11',
    durationDays: 5,
  })));
  await expect(page.locator('.gantt-task-grid [data-testid="task-grid-vscroll"]')).toBeVisible();
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const viewport = page.viewportSize()!;
  const resizedViewport = { width: viewport.width, height: Math.max(420, viewport.height - 260) };
  await page.setViewportSize(resizedViewport);
  const shell = '[data-task-grid-surface-id="full-task-grid"] .task-grid-shell';
  const core = page.locator(`${shell} .task-grid-core`);
  await expect(page.locator(`${shell} [data-testid="task-grid-vscroll"]`)).toBeVisible();
  await expect.poll(() => core.evaluate((node: HTMLElement) => {
    const surface = node.closest<HTMLElement>('[data-task-grid-surface-id]')!.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      followsSurface: Math.abs(rect.width - surface.width) < 0.5 && Math.abs(rect.height - surface.height) < 0.5,
      insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
    };
  })).toEqual({ viewport: resizedViewport, followsSurface: true, insideViewport: true });
  const coreBox = await box(core);
  const wheelPoint = { x: coreBox.x + coreBox.width / 2, y: coreBox.y + coreBox.height / 2 };
  await page.mouse.move(wheelPoint.x, wheelPoint.y);
  expect(await core.evaluate((node: HTMLElement, point) => {
    const row = document.elementFromPoint(point.x, point.y)?.closest('[data-grid-data-row]');
    return !!row && node.contains(row);
  }, wheelPoint), 'het wielpunt raakt een echte rij in het verkleinde raster').toBe(true);
  await page.mouse.wheel(0, 800);
  await expect.poll(() => core.evaluate((node: HTMLElement) => node.scrollTop)).toBeGreaterThan(0);
  for (let step = 1; step < 20; step++) await page.mouse.wheel(0, 800);
  await settledScrollTop(core);
  const geometry = await page.evaluate(selector => {
    const grid = document.querySelector<HTMLElement>(selector)!;
    const rect = grid.getBoundingClientRect();
    const rowNear = (y: number) => document.elementFromPoint(rect.left + 40, y)
      ?.closest<HTMLElement>('[data-grid-data-row]') ?? null;
    return {
      scrollTop: grid.scrollTop,
      maxScrollTop: grid.scrollHeight - grid.clientHeight,
      rowAtBottom: rowNear(rect.bottom - 8 - 12) !== null,
    };
  }, `${shell} .task-grid-core`);
  expect(Math.abs(geometry.scrollTop - geometry.maxScrollTop)).toBeLessThanOrEqual(1);
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBe(geometry.scrollTop);
  expect(geometry.rowAtBottom).toBe(true);
});
