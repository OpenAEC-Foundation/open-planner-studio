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
  }

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
