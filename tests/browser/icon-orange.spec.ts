// Elk icoon heeft een oranje element (besluit Ethan, 2 november 2026; Blueprint `docs/iconen.md`, "Het oranje
// element"). De eerste test meet op drie tabs van het lint, in licht en donker, dat elk zichtbaar icoon een deel in
// de accentkleur heeft. De uitzonderingen zijn dezelfde als in `src/components/icons/icons.css`: een uitgeschakelde
// knop, een vlak in de accentkleur (actieve of primaire lintknop), een melding, en de acht statusiconen die nog op
// Ethans keuze wachten (`STATUS_PROPOSAL_IDS` in `statusProposal.ts`; hier overgenomen, want die module leest
// `import.meta.env` en laadt niet buiten Vite).
// De tweede test bewaakt de oorzaak van een fout uit het nalopen (1 november 2026): `color: inherit` op `.oa-icon`,
// buiten een CSS-laag, won van Tailwind-klassen in `@layer utilities`. Een rood of oranje icoon kreeg zo de kleur
// van de plek eromheen.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const OPEN_STATUS_IDS = [
  'status.warning', 'status.resource-overallocated', 'status.schedule-preview', 'status.schedule-last-result',
  'status.error', 'status.library-item-missing', 'status.library-item-deviated', 'status.bridge-off',
];

const EXEMPT = [
  'button:disabled', '[aria-disabled="true"]', '.ribbon-btn.disabled', '.ribbon-btn.active', '.ribbon-btn.primary',
  '.ribbon-split-large.active .ribbon-split-bottom', '.ops-toast',
].join(', ');

/** Zichtbare iconen zonder deel in de accentkleur, buiten de uitzonderingen: "id in klasse-van-de-plek". */
function iconsWithoutOrange(page: Page): Promise<string[]> {
  return page.evaluate(([open, exempt]) => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--theme-accent)';
    document.body.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return [...document.querySelectorAll<SVGSVGElement>('svg[data-icon]')]
      .filter(svg => svg.getBoundingClientRect().width > 0)
      .filter(svg => !svg.closest(exempt) && !open.includes(svg.dataset.icon ?? ''))
      .filter(svg => ![...svg.querySelectorAll('path')].some((path) => {
        const cs = getComputedStyle(path);
        return (cs.stroke !== 'none' ? cs.stroke : cs.fill) === accent;
      }))
      .map(svg => `${svg.dataset.icon} in ${String(svg.parentElement?.className ?? '').slice(0, 50)}`);
  }, [OPEN_STATUS_IDS, EXEMPT] as const);
}

for (const theme of ['light', 'dark'] as const) {
  test(`iconen (${theme}): elk zichtbaar icoon op het lint heeft een oranje deel`, async ({ page, ops: _ops }) => {
    await page.evaluate(id => window.__OPS__!.store.getState().setUI({ uiTheme: id }), theme);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe(theme);
    for (const tab of ['start', 'planning', 'beeld'] as const) {
      await page.evaluate(id => window.__OPS__!.store.getState().setUI({ activeRibbonTab: id }), tab);
      await expect(page.locator(`[data-ops-ribbon-tab="${tab}"]`)).toHaveClass(/\bactive\b/);
      expect(await iconsWithoutOrange(page), `tab ${tab}: iconen zonder oranje deel`).toEqual([]);
    }
  });
}

test('iconen: een tekstkleur-klasse op een icoon wint van de kleur van de plek', async ({ page, ops: _ops }) => {
  const result = await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.color = 'rgb(1, 2, 3)';
    host.innerHTML = '<span class="text-critical">x</span><svg class="oa-icon text-critical" width="16" height="16"></svg>';
    document.body.append(host);
    const out = { text: getComputedStyle(host.children[0]).color, icon: getComputedStyle(host.children[1]).color };
    host.remove();
    return out;
  });
  expect(result.icon).not.toBe('rgb(1, 2, 3)');
  expect(result.icon).toBe(result.text);
});
