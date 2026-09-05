import { resolveTaskGridCommand } from '@/engine/taskGrid/navigation';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import { createTaskGridAdapter, createTaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { createTaskGridRowIndex, type TaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { createEmptyGridSelection, updateGridSelection } from '@/engine/taskGrid/selection';
import { computeVirtualWindow } from '@/engine/taskGrid/virtualization';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { planTaskGridPaste, serializeTaskGridTsv, type TaskGridClipboardEnvironment } from '@/engine/taskGrid/clipboard';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { useAppStore } from '@/state/appStore';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import type { TaskColumnContext, TaskColumnDescriptor, TaskColumnId } from '@/types/taskGrid';

export const TASK_GRID_PERFORMANCE_COUNTS = Object.freeze({
  taskCount: 50_000,
  rowCount: 50_000,
  columnCount: 24,
  relationCount: 100_000,
  rowHeight: 28,
  viewportHeight: 900,
  overscan: 8,
  commandCount: 1_000,
  selectionAdapterTaskCount: 3_000,
  selectionAdapterRelationCount: 2_999,
});

// Eindreview-bevinding: bulk-plakken bevroor de app. Gemeten 2.000 taken × 27 kolommen (16.000
// writes) ⇒ 4.446 ms synchroon vóór de fix in gridTransaction.ts (de gezamenlijke-eindtoestand-
// controle voor conditioneel schrijfbare cellen kopieerde daar per cel × per prefixlengte de
// VOLLEDIGE tasksById-map). Zie runTaskGridPasteBenchmark hieronder.
export const TASK_GRID_PASTE_PERFORMANCE_COUNTS = Object.freeze({
  taskCount: 2_000,
  columnCount: 27,
});

export const TASK_GRID_PERFORMANCE_BUDGETS = Object.freeze({
  relationIndexMs: 500,
  commandBatchMs: 100,
  selectionAdapterMs: 2,
  virtualWindowMs: 5,
  // Gemeten mediaan na de FIX 5-reparaties (10 losse processen op de gebruikte sandbox): 764–1.378
  // ms, mediaan ~1.300 ms. Budget is ~2× die mediaan, zie docs/superpowers/evidence/
  // tabel-overhaul-review-fixes.md, sectie "Verwerking onafhankelijke eindreview". Vóór de fix was
  // dit exact scenario niet eens haalbaar binnen enkele seconden (zie het commentaar bij
  // TASK_GRID_PASTE_PERFORMANCE_COUNTS hierboven) — dit blijft een echte regressiegrens: hij kan
  // falen als de gezamenlijke-eindtoestandcontrole ooit weer O(taken × schrijfacties) wordt.
  pasteCommitMs: 3_000,
});

export interface TaskGridPerformanceFixture {
  counts: typeof TASK_GRID_PERFORMANCE_COUNTS;
  tasks: readonly Task[];
  rows: readonly ViewRow[];
  columns: readonly TaskColumnId[];
  sequences: readonly Sequence[];
  rowIndex: TaskGridRowIndex;
  fingerprint: string;
}

export interface TaskGridPerformanceSamples {
  relationIndex: number[];
  navigationCommands: number[];
  selectionCommands: number[];
  selectionAdapter: number[];
  virtualWindow: number[];
}

export interface TaskGridPerformanceBenchmark {
  counts: typeof TASK_GRID_PERFORMANCE_COUNTS;
  budgetsMs: typeof TASK_GRID_PERFORMANCE_BUDGETS;
  warmups: number;
  runs: number;
  samplesMs: TaskGridPerformanceSamples;
  mediansMs: {
    relationIndex: number;
    navigationCommands: number;
    selectionCommands: number;
    selectionAdapter: number;
    virtualWindow: number;
  };
  mountedRows: number;
  mountedDataCells: number;
}

/**
 * Eén deterministische dataset voor zowel de blokkerende check als het losse benchmarkscript.
 * De twee relatiegolven koppelen iedere taak aan zijn volgende en op-een-na-volgende buur; zo zijn
 * alle 50.000 taken vertegenwoordigd zonder toeval, self-links of een generator die zelf de meting
 * domineert. De generatorbouw valt bewust buiten de gemeten tijden.
 */
export function createTaskGridPerformanceFixture(): TaskGridPerformanceFixture {
  const { taskCount, columnCount, relationCount } = TASK_GRID_PERFORMANCE_COUNTS;
  const tasks: Task[] = Array.from({ length: taskCount }, (_, index) => ({
    id: `task-${index}`,
    name: `Taak ${index}`,
    description: '',
    wbsCode: `${index + 1}`,
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 500,
    parentId: null,
    childIds: [],
    resourceIds: [],
    // buildTaskRelationIndex leest alleen scheduleDuration; de fixture bootst bewust geen project-
    // of solverpayload na, zodat uitsluitend het afgesproken indexpad wordt gemeten.
    time: { scheduleDuration: 5 },
  }) as unknown as Task);
  const rows: ViewRow[] = tasks.map(task => ({
    kind: 'task',
    rowKey: task.id,
    task,
    depth: 0,
    dimmed: false,
  }));
  const columns = Array.from({ length: columnCount }, (_, index) => taskColumnId(`performance-${index}`));
  const sequences: Sequence[] = Array.from({ length: relationCount }, (_, index) => {
    const predecessorIndex = index % taskCount;
    const wave = Math.floor(index / taskCount);
    const successorIndex = (predecessorIndex + wave + 1) % taskCount;
    return {
      id: `sequence-${index}`,
      predecessorId: `task-${predecessorIndex}`,
      successorId: `task-${successorIndex}`,
      type: 'FINISH_START',
      lagDays: 0,
    };
  });
  const firstSequence = sequences[0];
  const lastSequence = sequences[sequences.length - 1];
  return {
    counts: TASK_GRID_PERFORMANCE_COUNTS,
    tasks,
    rows,
    columns,
    sequences,
    rowIndex: createTaskGridRowIndex(rows),
    fingerprint: [
      tasks[0]?.id,
      tasks[tasks.length - 1]?.id,
      `${firstSequence?.id}:${firstSequence?.predecessorId}>${firstSequence?.successorId}`,
      `${lastSequence?.id}:${lastSequence?.predecessorId}>${lastSequence?.successorId}`,
    ].join('|'),
  };
}

function median(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)] ?? Number.NaN;
}

let timingSink = 0;

function measure(operation: () => number, warmups: number, runs: number): number[] {
  for (let index = 0; index < warmups; index++) timingSink ^= operation();
  const samples: number[] = [];
  for (let index = 0; index < runs; index++) {
    const startedAt = performance.now();
    timingSink ^= operation();
    samples.push(performance.now() - startedAt);
  }
  return samples;
}

export function runTaskGridPerformanceBenchmark(
  fixture: TaskGridPerformanceFixture,
  warmups = 2,
  runs = 9,
): TaskGridPerformanceBenchmark {
  const { counts } = fixture;
  const virtualInput = {
    totalRows: counts.rowCount,
    rowHeight: counts.rowHeight,
    viewportHeight: counts.viewportHeight,
    scrollTop: 25_000 * counts.rowHeight + 7,
    overscan: counts.overscan,
  };
  const active = { rowKey: 'task-25000', columnId: fixture.columns[12] };
  const navigationInput = {
    event: { key: 'ArrowDown' },
    mode: 'select' as const,
    active,
    rowIndex: fixture.rowIndex,
    columns: fixture.columns,
    rowHeight: counts.rowHeight,
    viewportHeight: counts.viewportHeight,
    isReadOnly: () => false,
  };
  const selectionAdapterTasks = fixture.tasks.slice(0, counts.selectionAdapterTaskCount);
  const selectionAdapterRows = fixture.rows.slice(0, counts.selectionAdapterTaskCount);
  const selectionAdapterSequences = fixture.sequences.slice(0, counts.selectionAdapterRelationCount);
  const selectionAdapterDomain = createTaskGridAdapterDomain({
    projectId: 'performance-project',
    tasks: selectionAdapterTasks,
    sequences: selectionAdapterSequences,
    assignments: [],
    resources: [],
    baselines: [],
    activityCodeTypes: [],
    customFieldDefs: [],
    scheduleStale: false,
    wbsAutoNumber: false,
    labelForColumn: labelKey => labelKey,
  });

  const relationIndex = measure(() => {
    const index = buildTaskRelationIndex(fixture.tasks, fixture.sequences);
    return index.analysisBySequenceId.size + index.predecessorsByTaskId.size;
  }, warmups, runs);
  const navigationCommands = measure(() => {
    let checksum = 0;
    for (let index = 0; index < counts.commandCount; index++) {
      const command = resolveTaskGridCommand({
        ...navigationInput,
        event: { key: index % 2 === 0 ? 'ArrowDown' : 'ArrowUp' },
      });
      if (command.kind === 'move') checksum += command.cell.rowKey.length;
    }
    return checksum;
  }, warmups, runs);
  const selectionCommands = measure(() => {
    let selection = createEmptyGridSelection();
    for (let index = 0; index < counts.commandCount; index++) {
      selection = updateGridSelection(
        selection,
        { rowKey: `task-${25_000 + (index % 2)}`, columnId: fixture.columns[index % fixture.columns.length] },
        fixture.rowIndex,
        fixture.columns,
        'replace',
      );
    }
    return selection.active?.rowKey.length ?? 0;
  }, warmups, runs);
  let selectedAdapterTask = 0;
  const selectionAdapter = measure(() => {
    selectedAdapterTask = selectedAdapterTask === 0 ? counts.selectionAdapterTaskCount - 1 : 0;
    const adapter = createTaskGridAdapter({
      surfaceId: 'full-task-grid',
      rows: selectionAdapterRows,
      selectedTaskIds: [`task-${selectedAdapterTask}`],
    }, selectionAdapterDomain);
    const selectedRow = adapter.rows[selectedAdapterTask];
    return adapter.rowMetaByKey.size
      + (selectedRow?.kind === 'data' && selectedRow.selected ? 1 : 0);
  }, warmups, runs);
  const virtualWindow = measure(() => {
    const result = computeVirtualWindow(virtualInput);
    return result.startIndex + result.endIndexExclusive;
  }, warmups, runs);
  const mountedWindow = computeVirtualWindow(virtualInput);
  const mountedRows = mountedWindow.mountedRows.length;

  // Houd de meetoperaties observeerbaar voor de runtime zonder het resultaat te beïnvloeden.
  if (timingSink === Number.MIN_SAFE_INTEGER) throw new Error('onbereikbare performance-sink');

  return {
    counts,
    budgetsMs: TASK_GRID_PERFORMANCE_BUDGETS,
    warmups,
    runs,
    samplesMs: { relationIndex, navigationCommands, selectionCommands, selectionAdapter, virtualWindow },
    mediansMs: {
      relationIndex: median(relationIndex),
      navigationCommands: median(navigationCommands),
      selectionCommands: median(selectionCommands),
      selectionAdapter: median(selectionAdapter),
      virtualWindow: median(virtualWindow),
    },
    mountedRows,
    mountedDataCells: mountedRows * counts.columnCount,
  };
}

export interface TaskGridPasteBenchmark {
  counts: typeof TASK_GRID_PASTE_PERFORMANCE_COUNTS;
  budgetMs: number;
  writeCount: number;
  prepared: boolean;
  warmups: number;
  runs: number;
  samplesMs: number[];
  medianMs: number;
}

/**
 * Reproduceert de bulk-plak-bevinding uit de eindreview op de ECHTE store: `wbsAutoNumber` staat
 * aan (dus `task.wbsCode` is een conditioneel schrijfbare cel op elke rij — precies de kolom die
 * de review aanwees), en de plak dekt alle taken × alle gekozen kolommen tegelijk. De brontekst is
 * de eigen `copy()`-weergave van elke cel, zodat elke waarde gegarandeerd geldig parseert zonder
 * per kolomtype handmatig een format te hoeven verzinnen. De plak hoeft niet te SLAGEN (wbsCode
 * blijft door `wbsAutoNumber` conditioneel read-only) — de meting gaat over hoe lang de
 * gezamenlijke-eindtoestandcontrole erover doet om dat te bepalen, niet over het eindresultaat.
 */
/**
 * Genereert per (rij, kolom) een geldige, van de huidige waarde AFWIJKENDE brontekst — puur op
 * `valueKind`, zonder een specifieke kolom-id te hoeven kennen. Nodig omdat `planTaskGridPaste`
 * een no-op (dezelfde canonieke waarde terugplakken) al vóór de `PasteIntent` elimineert: een
 * paste die de bestaande waarden herhaalt zou de gemeten hot path — de gezamenlijke-eindtoestand-
 * controle in gridTransaction.ts — dus stilzwijgend overslaan.
 */
function syntheticPasteText(descriptor: TaskColumnDescriptor, rowIndex: number, columnIndex: number): string {
  switch (descriptor.valueKind) {
    case 'text': return `Gewijzigd ${rowIndex}-${columnIndex}`;
    case 'number': return String(1 + ((rowIndex + columnIndex) % 200));
    case 'boolean': return (rowIndex + columnIndex) % 2 === 0 ? 'true' : 'false';
    case 'enum': {
      const options = descriptor.editorOptions ?? [];
      return options.length > 0 ? options[(rowIndex + columnIndex) % options.length].value : '';
    }
    case 'date': return '15-01-2027';
    case 'datetime': return '15-01-2027 09:30';
    case 'duration': return `${1 + (rowIndex % 9)}d`;
    default: return '';
  }
}

export function runTaskGridPasteBenchmark(warmups = 2, runs = 9): TaskGridPasteBenchmark {
  const { taskCount, columnCount } = TASK_GRID_PASTE_PERFORMANCE_COUNTS;
  const store = useAppStore;
  const S = () => store.getState();
  S().newProject();
  S().setWbsAutoNumber(true);
  for (let index = 0; index < taskCount; index++) S().addTask({ name: `Taak ${index}` });

  const state = S();
  const descriptors = buildTaskColumnRegistry({
    projectId: state.project.id, activityCodeTypes: [], customFieldDefs: [], baselines: [],
  });
  // Alleen gewone, per-cel bewerkbare velden — relaties/technische samengestelde kolommen
  // ('tokens'/'technical') hebben een eigen tokenformaat en horen niet in deze meting.
  // Taaktypes-etappe (2026-09-05): kolommen die alleen ontsloten beschikbaar zijn (`task.workRule`,
  // `available(ctx)` leest `taskTypesUnlocked`) horen niet in de vaste 27 — de meting gebruikt,
  // net als de echte adapter, alleen kolommen die in DIT (niet-ontsloten) context beschikbaar zijn.
  const availabilityContext = { projectId: state.project.id } as TaskColumnContext;
  const writable = descriptors.filter(descriptor => descriptor.readOnly !== true
    && typeof descriptor.parse === 'function'
    && descriptor.available(availabilityContext)
    && descriptor.valueKind !== 'tokens' && descriptor.valueKind !== 'technical');
  const wbsPosition = writable.findIndex(descriptor => descriptor.id === taskColumnId('task.wbsCode'));
  const ordered = wbsPosition > 0
    ? [writable[wbsPosition], ...writable.slice(0, wbsPosition), ...writable.slice(wbsPosition + 1)]
    : writable;
  const columns: TaskColumnId[] = ordered.slice(0, columnCount).map(descriptor => descriptor.id);
  const columnDescriptors = ordered.slice(0, columnCount);
  const descriptorMap = new Map(descriptors.map(descriptor => [descriptor.id, descriptor]));

  const assignmentsByTaskId = new Map<string, typeof state.assignments>();
  for (const assignment of state.assignments) {
    const current = assignmentsByTaskId.get(assignment.taskId);
    if (current) current.push(assignment);
    else assignmentsByTaskId.set(assignment.taskId, [assignment]);
  }
  const context: TaskColumnContext = {
    projectId: state.project.id,
    tasksById: new Map(state.tasks.map(task => [task.id, task])),
    relationIndex: buildTaskRelationIndex(state.tasks, state.sequences, state.cpmResult),
    assignmentsByTaskId,
    resourcesById: new Map(state.resources.map(resource => [resource.id, resource])),
    baselinesById: new Map(state.baselines.map(baseline => [baseline.id, baseline])),
    scheduleStale: state.scheduleStale,
    wbsAutoNumber: true,
    effectiveHoursPerDay: () => 8,
  };
  const matrix = state.tasks.map((_task, rowIndex) => columnDescriptors.map(
    (descriptor, columnIndex) => syntheticPasteText(descriptor, rowIndex, columnIndex),
  ));
  const source = serializeTaskGridTsv(matrix);

  const rows: ViewRow[] = state.tasks.map(task => ({
    kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false,
  }));
  const rowIndex = createTaskGridRowIndex(rows);
  const start = { rowKey: rows[0].rowKey, columnId: columns[0] };
  const end = { rowKey: rows[rows.length - 1].rowKey, columnId: columns[columns.length - 1] };
  let selection = updateGridSelection(createEmptyGridSelection(), start, rowIndex, columns, 'replace');
  selection = updateGridSelection(selection, end, rowIndex, columns, 'extend');
  const environment: TaskGridClipboardEnvironment = {
    selection, rowIndex, columns, descriptors: descriptorMap, context, dateNotation: 'dmy',
  };

  const planned = planTaskGridPaste(source, environment);
  if (!planned.ok) throw new Error('Paste-benchmarkfixture kon zichzelf niet plannen — geen geldig 2.000×27-blok');
  const writeCount = planned.value.writes.length;

  // Aanbeveling 3 (onafhankelijke eindreview): één sample zonder warmup was gevoelig voor
  // CPU-druk (de reviewer zag 5.049 ms rood en 2.935 ms net groen op hetzelfde werk). `runGridMutation`
  // wordt hier — net als de review's eigen wbsCode-repro — zonder `skipReadOnlyCells` gepland, dus
  // de conditionele wbsCode-cel weigert de HELE transactie vóór er ooit gecommit wordt: de store
  // blijft na elke sample ongewijzigd, dus dezelfde voorbereide `PasteIntent` mag veilig
  // `warmups + runs` keer herhaald worden op precies dezelfde 2.000-taken-fixture, net als
  // `runTaskGridPerformanceBenchmark` hierboven doet.
  let prepared = false;
  const samplesMs = measure(() => {
    const result = S().runGridMutation([planned.value]);
    prepared = result.ok || result.errors.length > 0;
    return prepared ? 1 : 0;
  }, warmups, runs);

  return {
    counts: TASK_GRID_PASTE_PERFORMANCE_COUNTS,
    budgetMs: TASK_GRID_PERFORMANCE_BUDGETS.pasteCommitMs,
    writeCount,
    prepared,
    warmups,
    runs,
    samplesMs,
    medianMs: median(samplesMs),
  };
}
