import type { Locator, Page } from '@playwright/test';
import { expect } from './ops';

/** Twee rechts-naar-linkstalen en twee ltr-talen: dezelfde stappen in nl/en bewijzen dat ltr niet
 *  veranderde. */
export const LOCALE_CASES = [
  { code: 'ar', option: /العربية/, rtl: true },
  { code: 'fa', option: /فارسی/, rtl: true },
  { code: 'nl', option: /Nederlands/, rtl: false },
  { code: 'en', option: /English/, rtl: false },
] as const;
export type LocaleCase = typeof LOCALE_CASES[number];

/** Taal kiezen zoals een gebruiker dat doet: Instellingen → Taal → optie. De brug opent alleen het
 *  instellingenvenster; de taalkeuze zelf is een klik. */
export async function chooseLocale(page: Page, locale: LocaleCase): Promise<void> {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  await page.getByRole('button', { name: /^(Language|Taal)$/, exact: true }).click();
  await page.getByRole('option', { name: locale.option }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', locale.code);
  await expect(page.locator('html')).toHaveAttribute('dir', locale.rtl ? 'rtl' : 'ltr');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export interface Box { left: number; right: number; top: number; bottom: number }

export async function box(locator: Locator): Promise<Box> {
  return locator.evaluate(element => {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    return { left, right, top, bottom };
  });
}

export const centerX = (rect: Box) => (rect.left + rect.right) / 2;
export const centerY = (rect: Box) => (rect.top + rect.bottom) / 2;
