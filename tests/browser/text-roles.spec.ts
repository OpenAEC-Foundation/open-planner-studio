import { expect, seedProject, test } from './fixtures/ops';
import type { Page } from '@playwright/test';

// Tekstrollen: elke zichtbare interfacetekst staat op één van de zes rolmaten, en die schalen mee met
// `ui.uiFontScale`. `npm run verify:text-roles` bewaakt de BRONCODE; deze test bewaakt wat de browser
// er werkelijk van maakt — een multi-line declaratie, een overstemde klasse of een geërfde maat ziet
// een broncodepoort niet.

const ROLE_PX = [9, 10, 11, 12, 14, 20];

interface Offender { px: number; where: string }

/** Computed font-size van alles wat zelf tekst draagt, teruggerekend naar schaal 1. */
async function offenders(page: Page): Promise<Offender[]> {
  return page.evaluate((roles) => {
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-scale')) || 1;
    const out: Offender[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (el.closest('svg')) continue; // SVG-tekst rekent in viewBox-eenheden
      if (el.closest('.help-inline-code')) continue; // bewust relatief (0.85em) t.o.v. de omringende rol
      const ownText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      const isControl = el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA';
      if (!ownText && !isControl) continue;
      if (el.getClientRects().length === 0) continue;
      const px = Math.round((parseFloat(getComputedStyle(el).fontSize) / scale) * 100) / 100;
      if (!roles.includes(px)) out.push({ px, where: `${el.tagName}.${String(el.className).slice(0, 60)}` });
    }
    return out;
  }, ROLE_PX);
}

async function fontSizeOf(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
}

const setUI = (page: Page, patch: Record<string, unknown>) =>
  page.evaluate(p => window.__OPS__!.store.getState().setUI(p), patch);

test('elke zichtbare tekst staat op een rolmaat, op 100% en op 125%', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 },
    { name: 'Ruwbouw', start: '2026-01-12', finish: '2026-01-23', durationDays: 10 },
  ]);

  for (const scale of [100, 125]) {
    await setUI(page, { uiFontScale: scale });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-font-scale').trim()))
      .toBe(String(scale / 100));

    for (const tab of ['start', 'planning', 'resources', 'beeld', 'instellingen', 'table', 'report']) {
      await setUI(page, { activeRibbonTab: tab });
      await expect.poll(() => offenders(page), { message: `schaal ${scale}, tabblad ${tab}` }).toEqual([]);
    }
    for (const section of ['recent', 'settings', 'library', 'help']) {
      await setUI(page, { activeRibbonTab: 'file', backstageSection: section });
      await expect.poll(() => offenders(page), { message: `schaal ${scale}, backstage ${section}` }).toEqual([]);
    }
    await setUI(page, { activeRibbonTab: 'start' });
    for (const flag of ['showLevelingDialog', 'showCalendarDialog', 'showShortcutsDialog']) {
      await setUI(page, { [flag]: true });
      await expect.poll(() => offenders(page), { message: `schaal ${scale}, ${flag}` }).toEqual([]);
      await setUI(page, { [flag]: false });
    }
  }
});

test('ankerpunten houden hun rol: tabblad 12, taakcel 11, groepslabel 9 — maal de schaal', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Fundering', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 }]);
  const anchors: Array<[string, number]> = [
    ['.ribbon-tab', 12],
    ['[role="gridcell"]', 11],
    ['.ribbon-group-label', 9],
  ];
  for (const scale of [100, 125]) {
    await setUI(page, { uiFontScale: scale, activeRibbonTab: 'start' });
    for (const [selector, px] of anchors) {
      await expect.poll(() => fontSizeOf(page, selector), { message: `${selector} op ${scale}%` })
        .toBeCloseTo(px * (scale / 100), 2);
    }
  }
});
