// Grijs is de basis, oranje het accent (regel van Ethan, 2 november 2026; Blueprint `docs/iconen.md`, "Grijs en
// oranje"). Een icoon van één vorm is grijs, een icoon met meer delen heeft één deel in oranje, en een icoon is nooit
// helemaal oranje. De Blueprint-check toetst de tekeningen; deze test toetst wat de app ervan maakt.
// De eerste test meet op vier tabs van het lint, in licht en donker:
// - geen zichtbaar icoon is helemaal oranje (dan kleurt de plek ook het grijze deel oranje);
// - elk deel dat in de tekening oranje is (`var(--icon-accent)`), is op het scherm ook oranje.
// De uitzonderingen voor het tweede punt staan ook in `src/components/icons/icons.css`: een uitgeschakelde knop en
// een vlak in een kleur (actieve of primaire lintknop, melding). Daar tekent alles in de hoofdkleur.
// De tweede test bewaakt de oorzaak van een fout uit het nalopen (1 november 2026): `color: inherit` op `.oa-icon`,
// buiten een CSS-laag, won van Tailwind-klassen in `@layer utilities`. Een rood of oranje icoon kreeg zo de kleur
// van de plek eromheen.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const MONO_PLACES = [
  'button:disabled', '[aria-disabled="true"]', '.ribbon-btn.disabled', '.ribbon-btn.active', '.ribbon-btn.primary',
  '.ribbon-split-large.active .ribbon-split-bottom', '.ops-toast',
].join(', ');

/** Zichtbare iconen die de regel breken, als "id in klasse-van-de-plek: fout". */
function iconColourErrors(page: Page): Promise<string[]> {
  return page.evaluate((mono) => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--theme-accent)';
    document.body.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    const colour = (path: SVGPathElement) => {
      const cs = getComputedStyle(path);
      return cs.stroke !== 'none' ? cs.stroke : cs.fill;
    };
    const errors: string[] = [];
    for (const svg of document.querySelectorAll<SVGSVGElement>('svg[data-icon]')) {
      if (svg.getBoundingClientRect().width === 0) continue;
      const paths = [...svg.querySelectorAll('path')].filter(path => path.getClientRects().length > 0);
      if (!paths.length) continue;
      const meant = paths.filter(path => /icon-accent/.test(`${path.getAttribute('stroke')} ${path.getAttribute('fill')}`));
      const orange = paths.filter(path => colour(path) === accent);
      const place = `${svg.dataset.icon} in ${String(svg.parentElement?.className ?? '').slice(0, 50)}`;
      if (orange.length === paths.length) errors.push(`${place}: helemaal oranje`);
      else if (meant.length && !orange.length && !svg.closest(mono)) errors.push(`${place}: oranje deel niet oranje`);
    }
    return errors;
  }, MONO_PLACES);
}

for (const theme of ['light', 'dark'] as const) {
  test(`iconen (${theme}): grijs als basis, oranje als accent op het lint`, async ({ page, ops: _ops }) => {
    await page.evaluate(id => window.__OPS__!.store.getState().setUI({ uiTheme: id }), theme);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe(theme);
    for (const tab of ['start', 'planning', 'resources', 'beeld'] as const) {
      await page.evaluate(id => window.__OPS__!.store.getState().setUI({ activeRibbonTab: id }), tab);
      await expect(page.locator(`[data-ops-ribbon-tab="${tab}"]`)).toHaveClass(/\bactive\b/);
      expect(await iconColourErrors(page), `tab ${tab}`).toEqual([]);
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
