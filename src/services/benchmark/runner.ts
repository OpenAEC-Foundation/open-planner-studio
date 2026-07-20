// Benchmark-runner (pakket S). Draait een meetreeks over vijf fasen op lokaal gegenereerde data en
// rapporteert per fase mediaan/min/max (`performance.now()`). ISOLATIE: raakt de store/het open
// project NIET aan — de engine-klassen (CalendarEngine/CPMSolver), writeIFC/readIFC en GanttRenderer
// worden rechtstreeks op de gegenereerde `ImportResult` aangeroepen. Tussen de fasen (en tussen
// iteraties bij grote planningen) wordt geyield zodat de UI responsief blijft en de voortgang
// zichtbaar bijwerkt.

import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { GanttRenderer, type GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import { computeViewRows, type ViewRow } from '@/engine/view/visibleRows';
import type { ViewContext } from '@/engine/view/filterEval';
import type { ViewState } from '@/types/view';
import type { Task } from '@/types/task';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { generateBenchmarkProject, type GeneratedProject } from './generateProject';

export type PhaseId = 'generate' | 'cpm' | 'ifcWrite' | 'ifcRead' | 'render';
export const PHASE_ORDER: PhaseId[] = ['generate', 'cpm', 'ifcWrite', 'ifcRead', 'render'];

export interface PhaseResult {
  phase: PhaseId;
  iterations: number;
  median: number; // ms
  min: number;    // ms
  max: number;    // ms
}

export interface BenchmarkResult {
  size: number;
  tasks: number;
  leafTasks: number;
  sequences: number;
  resources: number;
  assignments: number;
  ifcBytes: number;
  /** True ⇒ IFC-write→read leverde exact hetzelfde aantal taken terug (round-trip klopt). */
  roundTripOk: boolean;
  roundTripTasks: number;
  criticalTasks: number;
  /** Aantal gerenderde rijen (render-fase) + canvasafmetingen — voor de Detail-kolom. */
  renderRows: number;
  renderWidth: number;
  renderHeight: number;
  /** False ⇒ er was geen 2D-canvascontext; de render-fase kon niet draaien (audit-punt 4). */
  renderAvailable: boolean;
  phases: PhaseResult[];
  version: string;
  timestamp: string; // ISO
}

export interface ProgressUpdate {
  phase: PhaseId;
  phaseIndex: number;   // 0-based
  totalPhases: number;
  iteration: number;    // 1-based
  iterations: number;
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

function stats(samples: number[]): { median: number; min: number; max: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { median, min: sorted[0], max: sorted[sorted.length - 1] };
}

/** Iteratie-aantal per fase, afgeschaald op grootte zodat een 5.000-taken-run bruikbaar snel blijft. */
function iterationsFor(size: number, phase: PhaseId): number {
  const base = size <= 500 ? 7 : size <= 1000 ? 5 : size <= 2500 ? 3 : 2;
  // Genereren alloceert veel; houd dat wat lager. Render/CPM krijgen de volle `base`.
  if (phase === 'generate') return Math.max(2, Math.ceil(base / 2));
  return base;
}

/** Schrijf een CPM-resultaat terug op de taken (leaf + verzameltaak-rollup), zoals `runCPM` dat
 *  doet — zodat de IFC-write en de render met realistisch gespreide datums werken. Muteert alleen
 *  de meegegeven (lokale) taken; raakt de store niet. */
function applyCpmResult(tasks: Task[], result: CPMResult): void {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const task of tasks) {
    const r = result.tasks.get(task.id);
    if (!r) continue;
    task.time.earlyStart = r.earlyStart;
    task.time.earlyFinish = r.earlyFinish;
    task.time.lateStart = r.lateStart;
    task.time.lateFinish = r.lateFinish;
    task.time.totalFloat = r.totalFloat;
    task.time.freeFloat = r.freeFloat;
    task.time.isCritical = r.isCritical;
  }
  const rollup = (taskId: string) => {
    const task = byId.get(taskId);
    if (!task || task.childIds.length === 0) return;
    for (const cid of task.childIds) rollup(cid);
    const children = task.childIds.map((cid) => byId.get(cid)).filter(Boolean) as Task[];
    if (children.length === 0) return;
    const starts = children.map((c) => c.time.earlyStart).sort();
    const finishes = children.map((c) => c.time.earlyFinish).sort();
    task.time.earlyStart = starts[0];
    task.time.earlyFinish = finishes[finishes.length - 1];
    task.time.isCritical = children.some((c) => c.time.isCritical);
  };
  for (const task of tasks) if (!task.parentId) rollup(task.id);
}

/** Bouw de gedeelde `viewRows` (pure boommodus: geen filter/groep/sort) voor de render-fase. */
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
  onProgress?: (u: ProgressUpdate) => void;
}

/**
 * Draai de volledige benchmark voor één grootte. Asynchroon met yields, zodat de dialoog de
 * voortgang kan tonen en de UI niet blokkeert.
 */
export async function runBenchmark({ size, version, onProgress }: RunOptions): Promise<BenchmarkResult> {
  const phases: PhaseResult[] = [];
  const totalPhases = PHASE_ORDER.length;

  const report = (phase: PhaseId, phaseIndex: number, iteration: number, iterations: number) =>
    onProgress?.({ phase, phaseIndex, totalPhases, iteration, iterations });

  // --- Fase 1: genereren -------------------------------------------------------
  const genIters = iterationsFor(size, 'generate');
  const genSamples: number[] = [];
  let data!: GeneratedProject;
  for (let i = 0; i < genIters; i++) {
    report('generate', 0, i + 1, genIters);
    const t0 = performance.now();
    data = generateBenchmarkProject(size);
    genSamples.push(performance.now() - t0);
    await yieldToUi();
  }
  phases.push({ phase: 'generate', iterations: genIters, ...stats(genSamples) });

  // Leaf-taken = taken zonder kinderen; dit is EXACT het criterium dat de generator ook voor
  // `data.leafCount` gebruikt (audit-punt 5), zodat het gerapporteerde aantal overeenkomt met
  // wat de CPM-fase daadwerkelijk verwerkt.
  const leafTasks = data.tasks.filter((t) => t.childIds.length === 0);

  // --- Fase 2: CPM-kern (CalendarEngine + CPMSolver, direct) -------------------
  const cpmIters = iterationsFor(size, 'cpm');
  const cpmSamples: number[] = [];
  let lastResult: CPMResult | null = null;
  for (let i = 0; i < cpmIters; i++) {
    report('cpm', 1, i + 1, cpmIters);
    const solver = new CPMSolver(leafTasks, data.sequences, data.calendar, [], {});
    const t0 = performance.now();
    lastResult = solver.solve();
    cpmSamples.push(performance.now() - t0);
    await yieldToUi();
  }
  const criticalTasks = lastResult ? [...lastResult.tasks.values()].filter((t) => t.isCritical).length : 0;
  phases.push({ phase: 'cpm', iterations: cpmIters, ...stats(cpmSamples) });

  // Resultaat terugschrijven zodat write/read/render met echte datums werken.
  if (lastResult && !lastResult.error) applyCpmResult(data.tasks, lastResult);
  await yieldToUi();

  // --- Fase 3: IFC schrijven ---------------------------------------------------
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

  // --- Fase 4: IFC inlezen -----------------------------------------------------
  const readIters = iterationsFor(size, 'ifcRead');
  const readSamples: number[] = [];
  let parsedTasks = 0;
  for (let i = 0; i < readIters; i++) {
    report('ifcRead', 3, i + 1, readIters);
    const t0 = performance.now();
    const parsed = readIFC(ifc);
    readSamples.push(performance.now() - t0);
    parsedTasks = parsed.tasks.length;
    await yieldToUi();
  }
  const roundTripOk = parsedTasks === data.tasks.length;
  phases.push({ phase: 'ifcRead', iterations: readIters, ...stats(readSamples) });

  // --- Fase 5: Gantt-renderer (offscreen canvas) ------------------------------
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
    collapsedTaskIds: [],
    canvasWidth: RENDER_W,
    canvasHeight: RENDER_H,
    taskTableWidth: 320,
    rowHeight: 22,
    headerHeight: 48,
  };
  if (renderAvailable) {
    for (let i = 0; i < renderIters; i++) {
      report('render', 4, i + 1, renderIters);
      // Constructie BUITEN de timing (audit-punt 3): net als de CPMSolver-constructie hierboven
      // meten we alleen het eigenlijke werk — hier `render()` — niet het opbouwen van de renderer.
      const renderer = new GanttRenderer(ctx2d, opts);
      const t0 = performance.now();
      renderer.render();
      renderSamples.push(performance.now() - t0);
      await yieldToUi();
    }
    phases.push({ phase: 'render', iterations: renderSamples.length, ...stats(renderSamples) });
  } else {
    // Geen 2D-context: luid falen (audit-punt 4) — 0 iteraties + `renderAvailable:false`, zodat de
    // dialoog/markdown een expliciete "render niet beschikbaar"-melding tonen i.p.v. stille 0,00 ms.
    phases.push({ phase: 'render', iterations: 0, median: NaN, min: NaN, max: NaN });
  }

  return {
    size,
    tasks: data.tasks.length,
    leafTasks: leafTasks.length, // == data.leafCount (zelfde childless-criterium)
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Engelse detail-tekst per fase, opgebouwd uit de gestructureerde velden (audit-punt 1) — geen
 *  hardgecodeerde runner-strings meer. De dialoog rendert dezelfde data via `t(...)`; deze functie
 *  is bewust i18n-vrij Engels zodat de export universeel deelbaar is. */
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

const fmtMs = (v: number) => (Number.isNaN(v) ? '—' : v.toFixed(2));

/**
 * Resultaten als Markdown-tekst — handig om aan een AI of een issue te plakken. Bewust i18n-vrij
 * (technische rapport-output, Engelse kolomkoppen) zodat het universeel deelbaar is.
 */
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
