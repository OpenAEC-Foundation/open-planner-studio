import { barPoint, expect, test } from './fixtures/ops';

// Audit weergaven, bevinding 4: de groene spelingsband moet eindigen op "Laatste einde".
// De band was `totalFloat × zoom` — werkdagen maal pixels per KALENDERdag — en stopte over een
// weekend dagen te vroeg. Hier op echte canvaspixels: A (2d) naast B (12d), C na beide; A heeft
// 10 werkdagen speling over twee weekenden, "Laatste einde" di 16-06, en C begint wo 17-06. De
// band van A moet dus precies tot de linkerrand van C lopen.
//
// De brug zet alleen de fixture en leest balkcoördinaten; berekenen gaat via de echte F5-toets en
// de band wordt uit de geschilderde canvaspixels gelezen.
test('de spelingsband eindigt op "Laatste einde", ook over een weekend', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const g = () => window.__OPS__!.store.getState();
    g().setCalendar({ ...g().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] });
    g().setProject({ name: 'Spelingsband', startDate: '2026-06-01' });
    const A = g().addTask({ name: 'A kort' });
    const B = g().addTask({ name: 'B lang' });
    const C = g().addTask({ name: 'C daarna' });
    const setDur = (id: string, d: number) => {
      const t = g().tasks.find(x => x.id === id)!;
      g().updateTask(id, { time: { ...t.time, scheduleDuration: d, scheduleStart: '2026-06-01' } });
    };
    setDur(A, 2); setDur(B, 12); setDur(C, 1);
    g().addSequence({ predecessorId: A, successorId: C, type: 'FINISH_START', lagDays: 0 });
    g().addSequence({ predecessorId: B, successorId: C, type: 'FINISH_START', lagDays: 0 });
    // 12 px per dag: A, de band en de linkerrand van C passen dan ruim in de standaard viewport.
    g().setZoom(12);
    g().setViewStartDate('2026-05-29');
    return { A, C };
  });

  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const a = s.tasks.find(t => t.id === id)!;
    return { stale: s.scheduleStale, lf: a.time.lateFinish, tf: a.time.totalFloat, critical: a.time.isCritical };
  }, ids.A)).toEqual({ stale: false, lf: '2026-06-16', tf: 10, critical: false });

  const aRight = await barPoint(page, ids.A, 'right');
  const cLeft = await barPoint(page, ids.C, 'left');
  // C begint op de dag ná "Laatste einde" van A (FS zonder lag), dus zijn linkerrand is precies
  // het einde van die dag. Ter controle: dat ligt 14 kalenderdagen (12 px) rechts van de balk.
  expect(cLeft.x - aRight.x).toBeCloseTo(14 * 12, 0);

  // Lees de canvasrij van A vanaf de balkrand en zoek waar het band-groen ophoudt. Wacht tot de
  // band geschilderd is (de F5-berekening plant een nieuwe paint).
  const scanBandEnd = () => page.evaluate(({ x0, y }) => {
    const canvas = [...document.querySelectorAll('canvas')].find(c => {
      const r = c.getBoundingClientRect();
      return x0 > r.left && x0 < r.right && y > r.top && y < r.bottom;
    });
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    const data = canvas.getContext('2d')!.getImageData(0, Math.round((y - r.top) * sy), canvas.width, 1).data;
    const green = (i: number) => data[i * 4 + 1] > data[i * 4] + 25 && data[i * 4 + 1] > data[i * 4 + 2] + 5;
    const start = Math.round((x0 - r.left) * sx) + 2;
    if (!green(start)) return null;
    let end = start;
    while (end < canvas.width && green(end)) end++;
    return end / sx + r.left;
  }, { x0: aRight.x, y: aRight.y });

  await expect.poll(scanBandEnd, { message: 'geen spelingsband achter de balk van A geschilderd' }).not.toBeNull();
  const bandEnd = (await scanBandEnd())!;
  // Binnen twee pixels van de rand van "Laatste einde" (anti-aliasing op de rand).
  expect(Math.abs(bandEnd - cLeft.x), `band eindigt op x=${bandEnd.toFixed(1)}, "Laatste einde" op x=${cLeft.x.toFixed(1)}`)
    .toBeLessThanOrEqual(2);
});
