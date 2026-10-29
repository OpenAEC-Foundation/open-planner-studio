import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import { buildNewTask, createDefaultTaskTime } from '@/utils/taskDefaults';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { expect } from './ops';

declare global {
  interface Window {
    __opsPublishedSelectionTiming?: Promise<number>;
  }
}

const surface = '[data-task-grid-surface-id="full-task-grid"]';
const columns = ['task.name', 'task.time.scheduleDuration', 'task.time.scheduleStart'];
const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function domain(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return JSON.stringify({
      project: s.project, tasks: s.tasks, sequences: s.sequences, resources: s.resources,
      assignments: s.assignments, calendar: s.calendar, calendars: s.calendars,
      baselines: s.baselines, cpmResult: s.cpmResult, scheduleStale: s.scheduleStale,
      recordedDates: s.recordedDates, historyEvents: s.historyEvents, isDirty: s.isDirty,
    });
  });
}

/** Zelfde toetsenroute in de bestaande navigatietest; grote aantallen alleen op de meetrunner. */
export async function checkPublishedSelection(page: Page, info: TestInfo): Promise<void> {
  const measuring = process.env.OPS_SELECTION_MEASURE === '1';
  if (measuring) info.setTimeout(240_000);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1280, height: 900 });
  const reports = [];
  // Boomweergave bewaakt ook de lege invoerregel. Gesorteerd eindigt Ctrl+Shift+End op een echte
  // taak: gelijke selectielengtes, dus juist daar draait de dure membershipcontrole van het effect.
  for (const { count, sorted } of [
    { count: 20, sorted: false }, { count: 20, sorted: true },
    ...(measuring ? [1_000, 5_000, 10_000].map(count => ({ count, sorted: true })) : []),
  ]) {
    const tasks = Array.from({ length: count }, (_, i) => buildNewTask(
      { name: `Taak ${String(i).padStart(5, '0')}`, manuallyScheduled: true },
      { id: `selectie-${i}`, parentId: null, parentTask: undefined, constructionMode: true,
        time: createDefaultTaskTime('2026-09-07', 10) },
    ));
    const ids = tasks.map(task => task.id);
    // Eén fixturepublicatie; geen 10.000 addTask/CPM-acties of brugselectie in de gemeten route.
    await page.evaluate(({ tasks, sorted, preferences }) => {
      const store = window.__OPS__!.store;
      const s = store.getState();
      store.setState({
        tasks, sequences: [], resources: [], assignments: [], cpmResult: null,
        selectedTaskIds: [], activeTaskId: null,
        ui: { ...s.ui, activeRibbonTab: 'start', showPropertiesPanel: false },
        view: { ...s.view, scrollX: 0, scrollY: 0, group: [],
          sort: sorted ? [{ field: { src: 'builtin', key: 'name' }, dir: 'asc' }] : [] },
        taskGridSurfaces: { ...s.taskGridSurfaces,
          'full-task-grid': { ...s.taskGridSurfaces['full-task-grid'], scrollX: 0, columns: preferences },
        },
      });
      store.getState().recomputeViewRows();
    }, { tasks, sorted, preferences: columns.map((id, i) => ({ id: taskColumnId(id), width: i === 0 ? 240 : 120, pinned: false })) });
    await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
    const grid = page.locator(`${surface} [role="grid"]`);
    await expect(grid).toBeVisible();
    const cell = (id: string, column: string) => grid.locator(
      `[data-grid-data-cell="true"][data-grid-row-key="${id}"][data-grid-column-id="${column}"]`,
    );
    const first = cell(ids[0], columns[0]);
    const lastId = sorted ? ids[count - 1] : 'ops-ghost-row';
    const last = cell(lastId, columns[2]);
    const before = await domain(page);
    const samplesMs: number[] = [];
    const outputHashes: string[] = [];
    const warmups = count > 20 ? 2 : 0;
    const runs = count > 20 ? 5 : 1;
    for (let run = -warmups; run < runs; run++) {
      if (run > -warmups) {
        await page.keyboard.press('Control+Home');
        await expect(first).toBeFocused();
      }
      await first.click();
      await expect(first).toBeFocused();
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([ids[0]]);
      await page.evaluate(({ count, lastId, selector, lastColumn }) => {
        window.__opsPublishedSelectionTiming = new Promise<number>(resolve => {
          const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'End' || !event.ctrlKey || !event.shiftKey) return;
            window.removeEventListener('keydown', onKey, true);
            const started = performance.now();
            const settled = () => {
              const active = document.querySelector(`${selector} [data-grid-active="true"]`);
              if (window.__OPS__!.store.getState().selectedTaskIds.length === count
                && active?.getAttribute('data-grid-row-key') === lastId
                && active?.getAttribute('data-grid-column-id') === lastColumn
                && document.activeElement === active) {
                // Laat ook passieve React-effecten en de daaropvolgende paint/focusframes aflopen.
                requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - started)));
              } else requestAnimationFrame(settled);
            };
            requestAnimationFrame(settled);
          };
          window.addEventListener('keydown', onKey, true);
        });
      }, { count, lastId, selector: surface, lastColumn: columns[2] });
      await page.keyboard.press('Control+Shift+End');
      await expect(last).toBeFocused();
      const ms = await page.evaluate(() => window.__opsPublishedSelectionTiming!);
      const selected = await page.evaluate(() => {
        const s = window.__OPS__!.store.getState();
        return { ids: s.selectedTaskIds, active: s.activeTaskId };
      });
      expect(selected).toEqual({ ids, active: sorted ? ids[count - 1] : null });
      await expect(last).toHaveAttribute('data-grid-selected', 'true');

      // Echte kopieerhandeling leest de VOLLEDIGE celrechthoek, ook de niet-gemounte rijen.
      // Dit en de hashes vallen buiten de tijdmeting. De lege invoerregel heeft geen domeintaak.
      await page.evaluate(() => navigator.clipboard.writeText(''));
      await page.keyboard.press('Control+c');
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe('');
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      const lines = clipboard.trimEnd().split(/\r?\n/);
      expect(lines.slice(0, count).map(line => line.split('\t')[0])).toEqual(tasks.map(task => task.name));
      expect(lines.slice(0, count).every(line => line.split('\t').length === columns.length)).toBe(true);
      expect(lines.length).toBe(count + (sorted ? 0 : 1));
      expect(await domain(page)).toBe(before);
      if (run >= 0) {
        samplesMs.push(ms);
        outputHashes.push(sha256({ tasks, selected, clipboard }));
      }
    }
    // Het anker blijft linksboven: één Shift+omhoog verkleint het bereik vanaf de laatste rij.
    await page.keyboard.press('Shift+ArrowUp');
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds))
      .toEqual(sorted ? ids.slice(0, -1) : ids);
    expect(await domain(page)).toBe(before);
    expect(new Set(outputHashes).size).toBe(1);
    if (count === 20 && sorted) {
      await info.attach('selectiebereik.png', { body: await page.screenshot(), contentType: 'image/png' });
    }
    reports.push({ count, sorted, columns, warmups, runs, samplesMs, outputHashes });
  }
  const report = {
    revision: process.env.OPS_SELECTION_REVISION ?? null,
    description: 'Vite ontwikkelbuild; capture keydown Ctrl+Shift+End tot eindselectie, celfocus en twee extra frames. Inclusief store, React, effect, layout en framewachttijd; exclusief fixture, eerste klik, kopiëren en hashes.',
    reports,
  };
  await info.attach('publicatieselectie.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  if (process.env.OPS_SELECTION_BROWSER_OUT) {
    writeFileSync(process.env.OPS_SELECTION_BROWSER_OUT, `${JSON.stringify(report, null, 2)}\n`);
  }
}
