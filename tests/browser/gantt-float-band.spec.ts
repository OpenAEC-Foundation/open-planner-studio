import { barPoint, expect, test } from './fixtures/ops';

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
    g().setZoom(12);
    g().setViewStartDate('2026-05-29');
    return { A, C };
  });

  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const a = s.tasks.find(t => t.id === id)!;
    return { stale: s.scheduleStale, lf: a.time.lateFinish, tf: a.time.totalFloat, critical: a.time.isCritical };
  }, ids.A)).toEqual({ stale: false, lf: "2026-06-16T16:00", tf: 10, critical: false });

  const aRight = await barPoint(page, ids.A, 'right');
  const cLeft = await barPoint(page, ids.C, 'left');
  expect(cLeft.x - aRight.x).toBeCloseTo((14 + 15 / 24) * 12, 0);
  const lateFinishX = cLeft.x - 15 / 24 * 12;

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
    const GAP = 3;
    let end = start;
    while (end < canvas.width) {
      if (green(end)) { end++; continue; }
      let k = 1;
      while (k <= GAP && end + k < canvas.width && !green(end + k)) k++;
      if (k > GAP || end + k >= canvas.width) break;
      end += k;
    }
    return end / sx + r.left;
  }, { x0: lateFinishX - 30, y: aRight.y });

  await expect.poll(scanBandEnd, { message: 'geen spelingsband achter de balk van A geschilderd' }).not.toBeNull();
  const bandEnd = (await scanBandEnd())!;
  expect(Math.abs(bandEnd - lateFinishX), `band eindigt op x=${bandEnd.toFixed(1)}, "Laatste einde" op x=${lateFinishX.toFixed(1)}`)
    .toBeLessThanOrEqual(2);
});
