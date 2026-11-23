import { expect, test } from './fixtures/ops';

const DIR = 'tests/browser/fixtures/ifc/externe-bron';
const SOURCE_A = 'proj-mw0y30dn7b1w5';
const SOURCE_B = 'test-knownbug-991-project-b';

test('bronbestanden één voor één kiezen laat de andere bron geteld en sluit pas na de tweede keuze', async ({ page, ops: _ops }) => {
  const src = await page.request.get(`/${DIR}/Installateur.ifc`);
  expect(src.ok()).toBe(true);
  const ifcA = await src.text();
  expect(ifcA.split(SOURCE_A)).toHaveLength(2);
  const ifcB = ifcA.replace(SOURCE_A, SOURCE_B);

  await page.goto(`/?open=${DIR}/Aannemer.ifc`);
  await expect.poll(() => page.evaluate(() =>
    window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
  const oldDates = await page.evaluate(({ a, b }) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false });
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
    const first = s.tasks.find(task => task.name === 'Afbouw');
    const second = s.tasks.find(task => task.name === 'Terreinafwerking');
    if (!first?.externalLinks?.[0] || !second?.externalLinks?.[0]) throw new Error('Bronkoppelingen ontbreken in Aannemer.ifc');
    for (const [task, projectId] of [[first, a], [second, b]] as const) {
      const link = task.externalLinks![0]!;
      const sourceRef = { ...link.sourceRef, projectId };
      delete sourceRef.filePath;
      s.updateTask(task.id, { externalLinks: [{ ...link, sourceRef }] });
    }
    return [first.externalLinks[0].anchorDate, second.externalLinks[0].anchorDate];
  }, { a: SOURCE_A, b: SOURCE_B });

  const anchors = () => page.evaluate(({ a, b }) => {
    const links = window.__OPS__!.store.getState().tasks.flatMap(task => task.externalLinks ?? []);
    return [a, b].map(projectId => links.find(link => link.sourceRef.projectId === projectId)?.anchorDate);
  }, { a: SOURCE_A, b: SOURCE_B });
  expect(oldDates).toEqual(['2027-03-19T16:00', '2027-03-03T16:00']);
  expect(await anchors()).toEqual(oldDates);

  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Refresh all external relations' }).click();
  const status = page.locator('.ribbon-relation-menu-status');
  const choose = page.locator('[data-ops-external-sources-choose]');
  await expect(status).toContainText('2 sources not read.');
  await expect(choose).toBeVisible();
  expect(await anchors()).toEqual(oldDates);

  const chooseOne = async (name: string, ifc: string) => {
    const pending = page.waitForEvent('filechooser');
    await choose.click();
    const picker = await pending;
    expect(picker.isMultiple()).toBe(true);
    await picker.setFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(ifc) });
  };
  await chooseOne('Installateur-A.ifc', ifcA);
  await expect(status).toContainText('1 anchor(s) refreshed');
  await expect(status).toContainText('1 source not read.');
  await expect(choose).toBeVisible();
  expect(await anchors()).toEqual(['2027-03-23T16:00', oldDates[1]]);

  await chooseOne('Installateur-B.ifc', ifcB);
  await expect(choose).toHaveCount(0);
  await expect(status).toContainText('1 anchor(s) refreshed');
  await expect(status).not.toContainText(/\bsources? not read\b/);
  expect(await anchors()).toEqual(['2027-03-23T16:00', '2027-03-05T16:00']);
});
