// Huisstijl: de iconen komen uit de B2-set van de OpenAEC-Blueprint (`Icon`, `data-icon="<b2-id>"`),
// niet meer uit lucide. Stap 1 zet alleen het lint om; volgende groepen (panelen, dialogen, Gantt)
// breiden dit blok uit met hun eigen scherm. Echte klikken op de tabs; de storebrug zet alleen de
// AI-modus aan (anders bestaat de MCP-tab niet) en leest niets wat de test zelf beweert.
import { expect, test } from './fixtures/ops';

const RIBBON_TABS = ['start', 'planning', 'resources', 'beeld', 'instellingen', 'table', 'ifc', 'report', 'ai'] as const;

test('lint: elke tab tekent alleen B2-iconen, met accent waar dat hoort', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ aiMode: true, ribbonCompact: false }));
  const ribbon = page.locator('.ribbon-container');

  for (const tab of RIBBON_TABS) {
    await page.locator(`.ribbon-tab[data-ops-ribbon-tab="${tab}"]`).click();
    await expect(page.locator(`.ribbon-tab[data-ops-ribbon-tab="${tab}"]`)).toHaveClass(/active/);

    // Geen lucide meer, en elk icoon in het lint is een B2-icoon met een getekend pad.
    await expect(ribbon.locator('svg.lucide'), `lucide in tab ${tab}`).toHaveCount(0);
    const report = await ribbon.evaluate((root) => {
      const svgs = [...root.querySelectorAll('svg')];
      return {
        withoutId: svgs.filter(svg => !svg.dataset.icon).map(svg => svg.outerHTML.slice(0, 120)),
        empty: svgs.filter(svg => svg.dataset.icon && ![...svg.querySelectorAll('path')].some(p => (p.getAttribute('d') ?? '').length > 0))
          .map(svg => svg.dataset.icon),
        count: svgs.length,
      };
    });
    expect(report.withoutId, `svg zonder data-icon in tab ${tab}`).toEqual([]);
    expect(report.empty, `B2-icoon zonder pad in tab ${tab}`).toEqual([]);
    expect(report.count, `tab ${tab} heeft iconen`).toBeGreaterThan(0);
    // Alleen hele mastermaten: een verkleinde 16-master wordt vaag (Blueprint #35).
    const sizes = await ribbon.locator('svg[data-icon]').evaluateAll(svgs => [...new Set(svgs.map(svg => {
      const box = svg.getBoundingClientRect();
      return `${Math.round(box.width)}x${Math.round(box.height)}`;
    }))]);
    for (const size of sizes) expect(['16x16', '24x24'], `maat ${size} in tab ${tab}`).toContain(size);
  }

  // Rapport heeft geen eigen Afdruk-knop meer (deed hetzelfde als Exporteer PDF; besluit 2026-10-29).
  await page.locator('.ribbon-tab[data-ops-ribbon-tab="report"]').click();
  await expect(page.locator('[data-ops-ribbon-item="printPreview"]')).toHaveCount(0);
  // Sneltoetsen is een grote knop met een 24-master.
  await page.locator('.ribbon-tab[data-ops-ribbon-tab="instellingen"]').click();
  await expect(page.locator('[data-ops-ribbon-item="shortcuts"]')).not.toHaveClass(/\bsmall\b/);
  await expect(page.locator('[data-ops-ribbon-item="shortcuts"] svg[data-icon]')).toHaveAttribute('width', '24');

  // Smal venster: de weergaveschakelaars op Beeld lijken als B2-icoon op elkaar (Blueprint #48) en houden
  // daarom hun label; het lint krimpt eerst andere groepen tot iconen.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('.ribbon-tab[data-ops-ribbon-tab="beeld"]').click();
  const overlays = page.locator('[data-tour-anchor="ribbon-group:beeld:overlays"] .ribbon-btn');
  await expect.poll(() => page.locator('.ribbon-container [data-ribbon-mini]').count(), 'het lint krimpt op 1280 px').toBeGreaterThan(0);
  await expect(overlays.first()).toBeVisible();
  for (const button of await overlays.all()) {
    await expect(button).not.toHaveAttribute('data-ribbon-mini', /.*/);
    await expect(button.locator('.ribbon-btn-label')).toBeVisible();
  }
  await page.setViewportSize({ width: 1600, height: 900 });

  // Koppeling uit #566 op vaste plekken: grote knop 24 px (24-master), kleine knop 16 px.
  await page.locator('.ribbon-tab[data-ops-ribbon-tab="start"]').click();
  const calc = page.locator('[data-ops-ribbon-item="calc"] svg[data-icon]');
  const addTask = page.locator('[data-ops-ribbon-item="addTask"] svg[data-icon]');
  const save = page.locator('[data-ops-ribbon-item="save"] svg[data-icon]');
  await expect(calc).toHaveAttribute('data-icon', 'planning.calculate');
  await expect(addTask).toHaveAttribute('data-icon', 'task.add');
  await expect(save).toHaveAttribute('data-icon', 'file.save');
  await expect(addTask).toHaveAttribute('viewBox', '0 0 24 24');
  await expect(addTask).toHaveAttribute('width', '24');
  await expect(save).toHaveAttribute('viewBox', '0 0 16 16');

  // Accent: op een gewone knop krijgt het accentdeel de accentkleur van het thema; op de gevulde
  // primaire knop (Bereken) valt het terug op de hoofdkleur, anders verdwijnt het tegen het oranje.
  const colours = await page.evaluate(() => {
    const parts = (selector: string) => {
      const svg = document.querySelector<SVGSVGElement>(selector)!;
      const paths = [...svg.querySelectorAll('path')];
      const paint = (p: SVGPathElement) => {
        const style = getComputedStyle(p);
        return p.getAttribute('fill') === 'none' ? style.stroke : style.fill;
      };
      return {
        accentVar: getComputedStyle(svg).getPropertyValue('--icon-accent').trim(),
        main: paths.filter(p => !(p.getAttribute('stroke') ?? p.getAttribute('fill') ?? '').includes('icon-accent')).map(paint),
        accent: paths.filter(p => (p.getAttribute('stroke') ?? p.getAttribute('fill') ?? '').includes('icon-accent')).map(paint),
      };
    };
    return { addTask: parts('[data-ops-ribbon-item="addTask"] svg[data-icon]'), calc: parts('[data-ops-ribbon-item="calc"] svg[data-icon]') };
  });
  expect(colours.addTask.accent.length, 'task.add heeft een accentdeel').toBeGreaterThan(0);
  expect(colours.addTask.accent[0]).not.toBe(colours.addTask.main[0]);
  expect(colours.calc.accentVar).toBe('currentColor');
  for (const paint of colours.calc.accent) expect(paint).toBe(colours.calc.main[0]);

  // Het inklapknopje rechts in het lint is ook een B2-icoon.
  await expect(page.locator('.ribbon-collapse-toggle svg')).toHaveAttribute('data-icon', 'workspace.ribbon-compact');
});
