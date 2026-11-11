// Het sluitkruisje van een documenttabblad staat verticaal in het midden van zijn zichtbare tabblad:
// actief en niet-actief, licht en donker, LTR en RTL (ar). De brug zet alleen de fixture (drie open
// projecten en het thema); de taalkeuze en het wisselen van tabblad zijn echte klikken.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

interface Offset { label: string; button: number; glyph: number }

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

/** Verticale afwijking (px) van het midden van knop en kruisje (icoon) t.o.v. het midden van het tabblad. */
async function offsets(page: Page): Promise<Offset[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll('.ops-tab-group')).map((group) => {
    const tab = group.querySelector('.ops-tab')!.getBoundingClientRect();
    const close = group.querySelector('.ops-tab-close')!;
    const button = close.getBoundingClientRect();
    // Zonder B2 (#844) is het kruisje weer het ×-teken van vóór #765; met B2 een icoon.
    const glyph = close.querySelector('span, svg')!.getBoundingClientRect();
    const mid = (r: DOMRect) => r.top + r.height / 2;
    const active = group.querySelector('.ops-tab')!.classList.contains('active');
    return {
      label: `${active ? 'actief' : 'niet-actief'} ${group.querySelector('.ops-tab-name')!.textContent}`,
      button: mid(button) - mid(tab),
      glyph: mid(glyph) - mid(tab),
    };
  }));
}

async function expectCentered(page: Page, context: string): Promise<void> {
  const list = await offsets(page);
  console.log(`[sluitknop-midden] ${context}: ${list.map(o => `${o.label} knop=${o.button.toFixed(2)} teken=${o.glyph.toFixed(2)}`).join(' | ')}`);
  expect(list.length).toBeGreaterThan(1);
  for (const o of list) {
    expect(Math.abs(o.button), `${context} ${o.label}: knopmidden`).toBeLessThanOrEqual(1);
    expect(Math.abs(o.glyph), `${context} ${o.label}: midden van het kruisje`).toBeLessThanOrEqual(1);
  }
}

async function checkThemes(page: Page, context: string): Promise<void> {
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ uiTheme: id }), theme);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe(theme);
    await expectCentered(page, `${context} ${theme}`);
    // Echte klik op een ander tabblad: ook na het wisselen van het actieve tabblad blijft het kruisje in het midden.
    await page.locator('[data-testid="document-tab"]').first().click();
    await expect(page.locator('[data-testid="document-tab"]').first()).toHaveAttribute('aria-selected', 'true');
    await expectCentered(page, `${context} ${theme} na klik`);
    await page.locator('[data-testid="document-tab"]').last().click();
    await expect(page.locator('[data-testid="document-tab"]').last()).toHaveAttribute('aria-selected', 'true');
  }
}

test('sluitkruisje staat verticaal in het midden van zijn tabblad (LTR, licht en donker)', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openProjects(page, 3);
  await checkThemes(page, 'LTR');
});

test('sluitkruisje staat verticaal in het midden van zijn tabblad (RTL ar, licht en donker)', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await chooseLocale(page, LOCALE_CASES.find(locale => locale.code === 'ar')!);
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await openProjects(page, 3);
  await checkThemes(page, 'RTL');
});
