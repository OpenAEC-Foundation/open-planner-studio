import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { expandSummaryRelations, leafTasksForSolve } from '@/engine/scheduler/expandSummaryRelations';
import { applyCpmResult } from '@/engine/scheduler/applyCpmResult';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { GanttRenderer, type GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import { computeViewRows, type ViewRow } from '@/engine/view/visibleRows';
import type { ViewContext } from '@/engine/view/filterEval';
import type { ViewState } from '@/types/view';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { generateBenchmarkProject, type GeneratedProject } from './generateProject';
import { formatBytes } from '@/utils/formatBytes';

export type PhaseId = 'generate' | 'cpm' | 'ifcWrite' | 'ifcRead' | 'render';
export const PHASE_ORDER: PhaseId[] = ['generate', 'cpm', 'ifcWrite', 'ifcRead', 'render'];

export interface PhaseResult {
  phase: PhaseId;
  iterations: number;
  median: number;
  min: number;
  max: number;
}

export interface BenchmarkResult {
  size: number;
  tasks: number;
  leafTasks: number;
  sequences: number;
  resources: number;
  assignments: number;
  ifcBytes: number;
  roundTripOk: boolean;
  roundTripTasks: number;
  criticalTasks: number;
  renderRows: number;
  renderWidth: number;
  renderHeight: number;
  renderAvailable: boolean;
  phases: PhaseResult[];
  version: string;
  timestamp: string;
}

export interface ProgressUpdate {
  phase: PhaseId;
  phaseIndex: number;
  totalPhases: number;
  iteration: number;
  iterations: number;
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

function stats(samples: number[]): { median: number; min: number; max: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { median, min: sorted[0], max: sorted[sorted.length - 1] };
}

function iterationsFor(size: number, phase: PhaseId): number {
  const base = size <= 500 ? 7 : size <= 1000 ? 5 : size <= 2500 ? 3 : 2;
  if (phase === 'generate') return Math.max(2, Math.ceil(base / 2));
  return base;
}


function buildViewRows(data: GeneratedProject): ViewRow[] {
  const ctx: ViewContext = {
    activityCodeTypes: [],
    customFieldDefs: [],
    resources: data.resources,
    assignments: data.assignments,
    noneLabel: '(geen)',
  };
  return computeViewRows(
    data.tasks,
    { filter: null, group: [], sort: [], collapsedTaskIds: new Set(), collapsedGroupKeys: new Set() },
    ctx,
  );
}

export interface RunOptions {
  size: number;
  version: string;
  resourceCount?: number;
  onProgress?: (u: ProgressUpdate) => void;
}

export async function runBenchmark({ size, version, resourceCount, onProgress }: RunOptions): Promise<BenchmarkResult> {
  const phases: PhaseResult[] = [];
  const totalPhases = PHASE_ORDER.length;

  const report = (phase: PhaseId, phaseIndex: number, iteration: number, iterations: number) =>
    onProgress?.({ phase, phaseIndex, totalPhases, iteration, iterations });

  const genIters = iterationsFor(size, 'generate');
  const genSamples: number[] = [];
  let data!: GeneratedProject;
  for (let i = 0; i < genIters; i++) {
    report('generate', 0, i + 1, genIters);
    const t0 = performance.now();
    data = generateBenchmarkProject(size, { resourceCount });
    genSamples.push(performance.now() - t0);
    await yieldToUi();
  }
  phases.push({ phase: 'generate', iterations: genIters, ...stats(genSamples) });

  const leafTasks = leafTasksForSolve(data.tasks);
  const { sequences: expandedSequences } = expandSummaryRelations(data.tasks, data.sequences);

  const cpmIters = iterationsFor(size, 'cpm');
  const cpmSamples: number[] = [];
  let lastResult: CPMResult | null = null;
  for (let i = 0; i < cpmIters; i++) {
    report('cpm', 1, i + 1, cpmIters);
    const solver = new CPMSolver(leafTasks, expandedSequences, data.calendar, [data.calendar], solveOptionsFor(data.project));
    const t0 = performance.now();
    lastResult = solver.solve();
    cpmSamples.push(performance.now() - t0);
    await yieldToUi();
  }
  const criticalTasks = lastResult ? [...lastResult.tasks.values()].filter((t) => t.isCritical).length : 0;
  phases.push({ phase: 'cpm', iterations: cpmIters, ...stats(cpmSamples) });

  if (lastResult && !lastResult.error) {
    applyCpmResult(data.tasks, lastResult, { projectCalendar: data.calendar, calendars: [data.calendar] });
  }
  await yieldToUi();

  const writeIters = iterationsFor(size, 'ifcWrite');
  const writeSamples: number[] = [];
  let ifc = '';
  for (let i = 0; i < writeIters; i++) {
    report('ifcWrite', 2, i + 1, writeIters);
    const t0 = performance.now();
    ifc = writeIFC(data);
    writeSamples.push(performance.now() - t0);
    await yieldToUi();
  }
  const ifcBytes = ifc.length;
  phases.push({ phase: 'ifcWrite', iterations: writeIters, ...stats(writeSamples) });

  const readIters = iterationsFor(size, 'ifcRead');
  const readSamples: number[] = [];
  let parsedTasks = 0;
  for (let i = 0; i < readIters; i++) {
    report('ifcRead', 3, i + 1, readIters);
    const t0 = performance.now();
    const parsed = await readIFCWithXerReconstruction(ifc);
    readSamples.push(performance.now() - t0);
    parsedTasks = parsed.tasks.length;
    await yieldToUi();
  }
  const roundTripOk = parsedTasks === data.tasks.length;
  phases.push({ phase: 'ifcRead', iterations: readIters, ...stats(readSamples) });

  const renderIters = iterationsFor(size, 'render');
  const renderSamples: number[] = [];
  const rows = buildViewRows(data);
  const RENDER_W = 1600;
  const RENDER_H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = RENDER_W;
  canvas.height = RENDER_H;
  const ctx2d = canvas.getContext('2d');
  const renderAvailable = ctx2d !== null;
  const view: ViewState = {
    scrollX: 0, scrollY: 0, zoom: 8, timeScale: 'week',
    viewStartDate: data.project.startDate,
    filter: null, group: [], sort: [], collapsedGroupKeys: [],
  };
  const opts: GanttRenderOptions = {
    rows,
    sequences: data.sequences,
    calendar: data.calendar,
    view,
    selectedTaskIds: [],
    canvasWidth: RENDER_W,
    canvasHeight: RENDER_H,
    rowHeight: 22,
    headerHeight: 48,
  };
  if (renderAvailable) {
    for (let i = 0; i < renderIters; i++) {
      report('render', 4, i + 1, renderIters);
      const renderer = new GanttRenderer(ctx2d, opts);
      const t0 = performance.now();
      renderer.render();
      renderSamples.push(performance.now() - t0);
      await yieldToUi();
    }
    phases.push({ phase: 'render', iterations: renderSamples.length, ...stats(renderSamples) });
  } else {
    phases.push({ phase: 'render', iterations: 0, median: NaN, min: NaN, max: NaN });
  }

  return {
    size,
    tasks: data.tasks.length,
    leafTasks: leafTasks.length,
    sequences: data.sequences.length,
    resources: data.resources.length,
    assignments: data.assignments.length,
    ifcBytes,
    roundTripOk,
    roundTripTasks: parsedTasks,
    criticalTasks,
    renderRows: rows.length,
    renderWidth: RENDER_W,
    renderHeight: RENDER_H,
    renderAvailable,
    phases,
    version,
    timestamp: new Date().toISOString(),
  };
}

export function phaseDetailEnglish(phase: PhaseId, r: BenchmarkResult): string {
  switch (phase) {
    case 'generate': return `${r.tasks} tasks · ${r.sequences} relationships`;
    case 'cpm': return `${r.leafTasks} leaf tasks · ${r.sequences} relationships · ${r.criticalTasks} critical`;
    case 'ifcWrite': return formatBytes(r.ifcBytes);
    case 'ifcRead': return `${r.roundTripTasks} tasks read back · round-trip ${r.roundTripOk ? 'OK' : 'MISMATCH'}`;
    case 'render': return r.renderAvailable
      ? `${r.renderRows} rows · ${r.renderWidth}×${r.renderHeight}`
      : 'render unavailable (no 2D canvas context)';
  }
}

export const fmtMs = (v: number) => (Number.isNaN(v) ? '—' : v.toFixed(2));

export function formatResultsMarkdown(r: BenchmarkResult): string {
  const lines: string[] = [];
  lines.push(`# Open Planner Studio — benchmark`);
  lines.push('');
  lines.push(`- Version: ${r.version}`);
  lines.push(`- Date: ${r.timestamp}`);
  lines.push(`- Size: ${r.size} tasks (${r.tasks} total, ${r.leafTasks} leaf)`);
  lines.push(`- Sequences: ${r.sequences} · Resources: ${r.resources} · Assignments: ${r.assignments}`);
  lines.push(`- IFC size: ${formatBytes(r.ifcBytes)} · Round-trip: ${r.roundTripOk ? 'OK' : 'MISMATCH'} (${r.roundTripTasks} tasks) · Critical: ${r.criticalTasks}`);
  lines.push('');
  lines.push(`| Phase | Iterations | Median (ms) | Min (ms) | Max (ms) | Detail |`);
  lines.push(`| --- | ---: | ---: | ---: | ---: | --- |`);
  for (const p of r.phases) {
    lines.push(`| ${p.phase} | ${p.iterations} | ${fmtMs(p.median)} | ${fmtMs(p.min)} | ${fmtMs(p.max)} | ${phaseDetailEnglish(p.phase, r)} |`);
  }
  lines.push('');
  return lines.join('\n');
}
