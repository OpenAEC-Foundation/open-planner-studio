// G1: een kalender zonder taken heeft nog steeds een tijdlijn die tot zijn vrije dagen reikt.
// De fixture zet alleen kalenderdata via de publieke storeactie; het pannen zelf is een echte
// wheel-handeling in de browser.
import type { Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

async function primaryCanvasBounds(page: Page) {
  const bounds = await page.getByTestId('gantt-primary-canvas').boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

test('Gantt viewport: een lege kalender blijft zoomen en naar een verre feestdag pannen', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({
      ...s.calendar,
      holidays: [{ name: 'Eerste kerstdag', startDate: '2030-12-25', endDate: '2030-12-25' }],
    });
    s.setViewStartDate('2026-01-01');
    s.setZoom(100);
    s.setScroll(0, 0);
    s.setUI({ scrollMode: 'position', positionDivision: 'left-right' });
  });

  const bounds = await primaryCanvasBounds(page);
  // Ctrl+wiel is in de position-modus de vaste, echte zoomhandeling. Zonder taken moet hij niet
  // afhangen van een taakbar of van de fit-to-project-code.
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await page.keyboard.up('Control');
  await expect.poll(() => state(page).then(snapshot => snapshot.view.zoom)).toBeGreaterThan(100);

  // In de rechterhelft is de afgesproken position-mode-actie horizontaal pannen.
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.6);
  await page.mouse.wheel(0, 200_000);

  // 25 december 2030 ligt bijna vijf jaar (ca. 1820 dagen) vanaf de zichtbare oorsprong.
  // Bij 100 px/dag moet de tijdlijn dus ruim voorbij de oude lege-projectgrens van 2000 px
  // kunnen bewegen; een lege takenlijst mag die horizon niet alsnog afsluiten.
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollX)).toBeGreaterThan(150_000);
});
