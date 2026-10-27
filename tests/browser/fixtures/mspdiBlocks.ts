import type { Locator, Page } from '@playwright/test';
import { expect } from './ops';

// Gedeelde fixture voor het kalendervenster met werkblokken: een MSPDI-bestand (MS Project XML) met
// blokken per weekdag, geopend via de knop Openen en de echte bestandskiezer. Gebruikt door
// calendar-dialog.spec.ts en time-notation.spec.ts.
export function mspdiWithBlocks(blocks: [string, string][], fridayBlocks: [string, string][] = blocks): string {
  const times = (list: [string, string][]) => '<WorkingTimes>' + list.map(([from, to]) =>
    `<WorkingTime><FromTime>${from}:00</FromTime><ToTime>${to}:00</ToTime></WorkingTime>`).join('') + '</WorkingTimes>';
  const days = [1, 2, 3, 4, 5, 6, 7].map(n => `<WeekDay><DayType>${n}</DayType><DayWorking>${n >= 2 && n <= 6 ? 1 : 0}</DayWorking>${n >= 2 && n <= 5 ? times(blocks) : n === 6 ? times(fridayBlocks) : ''}</WeekDay>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>Blokken</Name><StartDate>2026-01-05T08:00:00</StartDate>
<MinutesPerDay>480</MinutesPerDay><CalendarUID>1</CalendarUID>
<Calendars><Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${days}</WeekDays></Calendar></Calendars>
<Tasks><Task><UID>1</UID><ID>1</ID><Name>Taak</Name><OutlineLevel>1</OutlineLevel><Start>2026-01-05T08:00:00</Start><Finish>2026-01-09T17:00:00</Finish><Duration>PT40H0M0S</Duration></Task></Tasks>
</Project>`;
}

export async function openMspdiAndCalendarDialog(page: Page, xml: string) {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'blokken.xml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().calendar.name)).toBe('Standard');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true, }));
  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  return dialog;
}

export const blocksOf = (dialog: Locator, day: number) =>
  dialog.locator(`[data-ops-worktime-day="${day}"] [data-ops-band] [data-ops-time-input]`)
    .evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));

