import { expect, test as base, type ConsoleMessage, type Page } from '@playwright/test';
import type { OpsDevBridge } from '@/utils/devBridge';

declare global {
  interface Window {
    __OPS__?: OpsDevBridge;
  }
}

export interface SeedTaskInput {
  name: string;
  start: string;
  finish: string;
  durationDays?: number;
}

export interface OpsStateSnapshot {
  activeDocumentId: string;
  documentIds: string[];
  projectName: string;
  tasks: Array<{
    id: string;
    name: string;
    scheduleStart: string;
    scheduleFinish: string;
    earlyStart?: string;
    earlyFinish?: string;
  }>;
  sequences: Array<{
    id: string;
    predecessorId: string;
    successorId: string;
    type: string;
    lagDays: number;
  }>;
  selectedTaskIds: string[];
  viewRows: Array<
    | { kind: 'task'; taskId: string }
    | { kind: 'group'; key: string }
  >;
  view: {
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewStartDate: string;
    pendingFit: boolean;
    pendingFocusTaskId: string | null;
    histogramResourceId: string | null;
    splitView: {
      ratio: number;
      secondaryZoom: number;
      secondaryScrollX: number;
    } | null;
  };
  ui: {
    leftPanelWidth: number;
    histogramHeight: number;
    scrollMode: string;
    showHistogram: boolean;
    showMiniMap: boolean;
  };
  undoDepth: number;
  redoDepth: number;
}

export interface OpsHarness {
  /** Sta één bekende fout expliciet toe; alle overige page-/consolefouten falen in teardown. */
  acceptError: (matcher: string | RegExp) => void;
}

interface CapturedBrowserError {
  kind: 'pageerror' | 'console.error';
  text: string;
}

export async function waitForOps(page: Page): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => window.__OPS__ !== undefined),
    { message: 'window.__OPS__ is niet geïnstalleerd' },
  ).toBe(true);
}

export async function state(page: Page): Promise<OpsStateSnapshot> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return {
      activeDocumentId: s.activeDocumentId,
      documentIds: s.documents.map(document => document.id),
      projectName: s.project.name,
      tasks: s.tasks.map(task => ({
        id: task.id,
        name: task.name,
        scheduleStart: task.time.scheduleStart,
        scheduleFinish: task.time.scheduleFinish,
        earlyStart: task.time.earlyStart,
        earlyFinish: task.time.earlyFinish,
      })),
      sequences: s.sequences.map(sequence => ({
        id: sequence.id,
        predecessorId: sequence.predecessorId,
        successorId: sequence.successorId,
        type: sequence.type,
        lagDays: sequence.lagDays,
      })),
      selectedTaskIds: [...s.selectedTaskIds],
      viewRows: s.viewRows.map(row => (
        row.kind === 'task'
          ? { kind: 'task' as const, taskId: row.task.id }
          : { kind: 'group' as const, key: row.key }
      )),
      view: {
        zoom: s.view.zoom,
        scrollX: s.view.scrollX,
        scrollY: s.view.scrollY,
        viewStartDate: s.view.viewStartDate,
        pendingFit: !!s.view.pendingFit,
        pendingFocusTaskId: s.view.pendingFocusTaskId ?? null,
        histogramResourceId: s.view.histogramResourceId ?? null,
        splitView: s.view.splitView ? { ...s.view.splitView } : null,
      },
      ui: {
        leftPanelWidth: s.ui.leftPanelWidth,
        histogramHeight: s.ui.histogramHeight,
        scrollMode: s.ui.scrollMode,
        showHistogram: s.ui.showHistogram,
        showMiniMap: s.ui.showMiniMap,
      },
      undoDepth: s.undoStack.length,
      redoDepth: s.redoStack.length,
    };
  });
}

/** Seed de actieve planning via de publieke acties; runCPM blijft een expliciete laatste stap. */
export async function seedProject(
  page: Page,
  tasks: SeedTaskInput[],
  projectName = 'Browserkarakterisering',
): Promise<string[]> {
  const ids = await page.evaluate(({ inputs, name }) => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name, startDate: inputs[0]?.start ?? s.project.startDate });
    // De testdata moet onafhankelijk van de kalenderdatum waarop CI draait werkelijk in beeld
    // staan; dit is dezelfde publieke viewactie die de interface gebruikt, geen gekopieerde x-as.
    if (inputs[0]) s.setViewStartDate(inputs[0].start);
    const created = inputs.map(input => {
      const id = s.addTask({ name: input.name, manuallyScheduled: true });
      const current = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
      window.__OPS__!.store.getState().updateTask(id, {
        time: {
          ...current.time,
          scheduleStart: input.start,
          scheduleFinish: input.finish,
          earlyStart: input.start,
          earlyFinish: input.finish,
          scheduleDuration: input.durationDays ?? 10,
        },
      });
      return id;
    });
    window.__OPS__!.store.getState().runCPM();
    return created;
  }, { inputs: tasks, name: projectName });

  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(tasks.length);
  return ids;
}

export async function barPoint(
  page: Page,
  taskId: string,
  edge: 'left' | 'body' | 'right' = 'body',
  surface: 'primary' | 'secondary' = 'primary',
): Promise<{ x: number; y: number }> {
  let point: { x: number; y: number } | null = null;
  await expect.poll(async () => {
    point = await page.evaluate(
      ({ id, requestedEdge, requestedSurface }) => (
        window.__OPS__!.gantt.taskBarPoint(id, requestedEdge, requestedSurface)
      ),
      { id: taskId, requestedEdge: edge, requestedSurface: surface },
    );
    return point;
  }, { message: `geen ${surface}-${edge}punt voor taak ${taskId}` }).not.toBeNull();
  return point!;
}

function matches(error: CapturedBrowserError, matcher: string | RegExp): boolean {
  return typeof matcher === 'string' ? error.text.includes(matcher) : matcher.test(error.text);
}

export const test = base.extend<{ ops: OpsHarness }>({
  ops: async ({ page }, use) => {
    const errors: CapturedBrowserError[] = [];
    const accepted: Array<string | RegExp> = [];
    const onPageError = (error: Error) => errors.push({ kind: 'pageerror', text: error.stack ?? error.message });
    const onConsole = (message: ConsoleMessage) => {
      if (message.type() === 'error') errors.push({ kind: 'console.error', text: message.text() });
    };
    page.on('pageerror', onPageError);
    page.on('console', onConsole);

    await page.goto('/');
    await waitForOps(page);
    await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      s.newProject();
      s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
    });

    await use({ acceptError: matcher => accepted.push(matcher) });

    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    const unexpected = errors.filter(error => !accepted.some(matcher => matches(error, matcher)));
    expect(unexpected, `onverwachte browserfouten:\n${unexpected.map(error => `${error.kind}: ${error.text}`).join('\n')}`)
      .toEqual([]);
  },
});

export { expect };
