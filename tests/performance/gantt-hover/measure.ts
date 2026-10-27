// Opt-in browsermeting; alleen aangeroepen vanuit het bestaande histogramhoverscenario in CI.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { cpus, release, totalmem } from 'node:os';
import type { Page, TestInfo } from '@playwright/test';
import { barPoint, expect } from '../../browser/fixtures/ops';

interface HoverProbe {
  armed: boolean;
  expectedLines: string[];
  eventAt?: number;
  tooltipAt?: number;
  timers: Array<{ requestedAt: number; startedAt?: number; finishedAt?: number }>;
}

declare global {
  interface Window { __ganttHoverProbe?: HoverProbe }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// Bewust een projectie: functies, willekeurige document-/geschiedenisids en sessietijden behoren
// niet tot de histograminvoer. De volledige taak-, resource-, assignment- en kalenderobjecten wel.
async function hashes(page: Page) {
  return page.evaluate(async () => {
    const s = window.__OPS__!.store.getState();
    const input = { tasks: s.tasks, resources: s.resources, assignments: s.assignments, calendar: s.calendar };
    const store = { ...input, resourceLoadResult: s.resourceLoadResult,
      selectedTaskIds: s.selectedTaskIds, histogramResourceId: s.view.histogramResourceId ?? null };
    const digest = async (value: unknown) => Array.from(new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))),
    ), byte => byte.toString(16).padStart(2, '0')).join('');
    return { input: await digest(input), store: await digest(store) };
  });
}

export async function measureGanttHover(page: Page, info: TestInfo): Promise<void> {
  info.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => {
    const bridge = window.__OPS__!;
    const s = bridge.store.getState();
    const resources = Array.from({ length: 32 }, (_, index) => ({
      id: `hover-resource-${index}`, name: `Hoverresource ${index}`, type: 'LABOR' as const,
      description: '', maxUnits: 2000,
    }));
    const tasks = Array.from({ length: 10_000 }, (_, index) => ({
      id: `hover-task-${index}`, name: `Hovertaak ${String(index).padStart(5, '0')}`,
      description: '', wbsCode: String(index + 1), taskType: 'CONSTRUCTION' as const,
      status: 'NOT_STARTED' as const, isMilestone: false, priority: 500,
      parentId: null, childIds: [], manuallyScheduled: true,
      resourceIds: Array.from({ length: 4 }, (_, slot) => resources[(index * 4 + slot) % 32].id),
      time: { durationType: 'WORKTIME' as const, durationUnit: 'hours' as const,
        durationMinutes: 960, scheduleDuration: 2,
        scheduleStart: '2026-09-07T07:00', scheduleFinish: '2026-09-08T16:00',
        earlyStart: '2026-09-07T07:00', earlyFinish: '2026-09-08T16:00',
        lateStart: '2026-09-07T07:00', lateFinish: '2026-09-08T16:00',
        freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0 },
    }));
    const assignments = tasks.flatMap(task => task.resourceIds.map((resourceId, slot) => ({
      id: `${task.id}-assignment-${slot}`, taskId: task.id, resourceId, unitsPerDay: 1,
    })));
    // De last is fixture-invoer; deze meting rekent geen ResourceLoad of CPM en meet alleen hover.
    const days = { '2026-09-07': 1250, '2026-09-08': 1250 };
    bridge.store.setState({ tasks, resources, assignments, sequences: [], selectedTaskIds: [], cpmResult: null,
      calendar: { ...s.calendar, id: 'hover-calendar' }, calendars: [],
      resourceLoadResult: { load: Object.fromEntries(resources.map(resource => [resource.id, { ...days }])),
        capacity: Object.fromEntries(resources.map(resource => [resource.id, { '2026-09-07': 2000, '2026-09-08': 2000 }])),
        overallocatedDays: {}, overallocatedReasons: {}, hours: {} },
      view: { ...s.view, histogramResourceId: undefined, scrollX: 0, scrollY: 0, zoom: 32,
        viewStartDate: '2026-09-07', pendingFit: false, pendingFocusTaskId: undefined },
      ui: { ...s.ui, showHistogram: true, autoCalcCPM: false },
    });
    bridge.store.getState().recomputeViewRows();
  });
  const canvas = page.getByTestId('gantt-histogram-canvas');
  await expect(canvas).toBeVisible();
  const point = await barPoint(page, 'hover-task-0', 'left');
  const bounds = (await canvas.boundingBox())!;
  const dayWidth = await page.evaluate(() => window.__OPS__!.gantt.dateX('2026-09-08')!
    - window.__OPS__!.gantt.dateX('2026-09-07')!);
  const y = bounds.y + 70;
  await page.mouse.move(bounds.x - 20, bounds.y - 20);
  await page.evaluate(async () => { await document.fonts.ready; });

  // Alleen observerende meetinstrumenten: echte mousemove, bestaande 300-ms-timer en DOM-commit.
  // De callbackduur omvat buildTooltip (inclusief indexbouw) én de setState-aanroep.
  await page.evaluate(() => {
    // Window houdt hier bewust het DOM-timertype; de Node-testconfig kent daarnaast een eigen
    // setTimeout met een promisify-eigenschap die in de browser niet bestaat.
    const browserWindow: Window = window;
    const original = browserWindow.setTimeout.bind(browserWindow);
    browserWindow.setTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const probe = window.__ganttHoverProbe;
      if (!probe?.armed || timeout !== 300 || typeof handler !== 'function') return original(handler, timeout, ...args);
      const timer: HoverProbe['timers'][number] = { requestedAt: performance.now() };
      probe.timers.push(timer);
      return original(() => {
        timer.startedAt = performance.now();
        try { handler(...args); } finally { timer.finishedAt = performance.now(); }
      }, timeout);
    };
    document.addEventListener('mousemove', event => {
      const probe = window.__ganttHoverProbe;
      if (probe?.armed && probe.eventAt === undefined
        && (event.target as HTMLElement).matches('[data-testid="gantt-histogram-canvas"]')) probe.eventAt = performance.now();
    }, true);
    new MutationObserver(() => {
      const probe = window.__ganttHoverProbe;
      if (probe?.armed && probe.eventAt !== undefined && probe.tooltipAt === undefined
        && JSON.stringify(Array.from(document.querySelectorAll('.gantt-tooltip > div'), node => node.textContent))
          === JSON.stringify(probe.expectedLines)) probe.tooltipAt = performance.now();
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  });

  const samples: unknown[] = [];
  const allNames = Array.from({ length: 10_000 }, (_, index) => `Hovertaak ${String(index).padStart(5, '0')}`);
  async function hover(label: string, day: number, contributors: string[], sameDay = false) {
    const before = await hashes(page);
    const isoDate = day === 0 ? '2026-09-07' : '2026-09-08';
    const expectedLines = [`${contributors.length} tasks contribute on ${isoDate}`, ...contributors.slice(0, 8)];
    await page.evaluate(lines => { window.__ganttHoverProbe = { armed: true, timers: [], expectedLines: lines }; }, expectedLines);
    await page.mouse.move(point.x + day * dayWidth + (sameDay ? 6 : 5), y + (sameDay ? 1 : 0));
    await page.waitForFunction(() => window.__ganttHoverProbe?.tooltipAt !== undefined);
    const lines = await page.locator('.gantt-tooltip > div').allTextContents();
    expect(lines).toEqual(expectedLines);
    const probe = await page.evaluate(() => {
      window.__ganttHoverProbe!.armed = false;
      return window.__ganttHoverProbe!;
    });
    expect(probe.timers).toHaveLength(sameDay ? 0 : 1);
    const timer = probe.timers[0];
    const after = await hashes(page);
    expect(after).toEqual(before);
    samples.push({ label, isoDate, lines, contributors, contributorsHash: sha256(JSON.stringify(contributors)),
      before, after, raw: probe, fixedDelayMs: sameDay ? 0 : 300,
      eventToTooltipMs: probe.tooltipAt! - probe.eventAt!,
      timerWaitMs: timer ? timer.startedAt! - timer.requestedAt : null,
      callbackMs: timer ? timer.finishedAt! - timer.startedAt! : null });
  }

  await hover('eerste tooltip met indexbouw', 0, allNames);
  await hover('bewegen binnen dezelfde dag', 0, allNames, true);
  for (let repeat = 0; repeat < 4; repeat++) await hover(`hergebruik ${repeat + 1}`, repeat % 2 === 0 ? 1 : 0, allNames);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    window.__OPS__!.store.setState({
      tasks: s.tasks.map((task, index) => index === 0 ? { ...task, name: 'Hovertaak actueel' } : task),
      resources: s.resources.map((resource, index) => index === 0 ? { ...resource, type: 'MATERIAL', unitOfMeasure: 'm³' } : resource),
    });
  });
  const currentNames = ['Hovertaak actueel', ...allNames.slice(1)];
  await hover('nieuwe invoerarrays en nieuwe dag', 1, currentNames);
  await canvas.click({ position: { x: 24, y: 35 } });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().view.histogramResourceId)).toBe('hover-resource-0');
  await hover('gekozen materiaalresource', 0, currentNames.filter((_, index) => index % 8 === 0));
  const screenshot = info.outputPath('histogram-hover.png');
  await page.screenshot({ path: screenshot });
  const result = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    fixture: { tasks: 10_000, resources: 32, assignments: 40_000, dates: ['2026-09-07', '2026-09-08'] },
    environment: { node: process.version, cpu: cpus()[0]?.model, cores: cpus().length,
      memoryBytes: totalmem(), kernel: release(), browser: page.context().browser()!.version(),
      viewport: page.viewportSize(), mode: 'Vite development / React development' }, samples };
  writeFileSync(process.env.OPS_GANTT_HOVER_OUT!, JSON.stringify(result, null, 2) + '\n');
  await info.attach('histogram-hover', { path: screenshot, contentType: 'image/png' });
}
