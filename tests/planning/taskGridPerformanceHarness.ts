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

export const TASK_GRID_PASTE_PERFORMANCE_COUNTS = Object.freeze({
  taskCount: 2_000,
  columnCount: 27,
});

export const TASK_GRID_PERFORMANCE_BUDGETS = Object.freeze({
  relationIndexMs: 500,
  commandBatchMs: 100,
  selectionAdapterMs: 2,
  virtualWindowMs: 5,
  pasteCommitMs: 3_000,
});

export const TASK_GRID_SELECTION_ADAPTER_PROTOCOL = Object.freeze({
  warmups: 30,
  runs: 21,
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
  selectionAdapterProtocol: { warmups: number; runs: number };
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
  }, TASK_GRID_SELECTION_ADAPTER_PROTOCOL.warmups, TASK_GRID_SELECTION_ADAPTER_PROTOCOL.runs);
  const virtualWindow = measure(() => {
    const result = computeVirtualWindow(virtualInput);
    return result.startIndex + result.endIndexExclusive;
  }, warmups, runs);
  const mountedWindow = computeVirtualWindow(virtualInput);
  const mountedRows = mountedWindow.mountedRows.length;

  if (timingSink === Number.MIN_SAFE_INTEGER) throw new Error('onbereikbare performance-sink');

  return {
    counts,
    budgetsMs: TASK_GRID_PERFORMANCE_BUDGETS,
    warmups,
    runs,
    selectionAdapterProtocol: { ...TASK_GRID_SELECTION_ADAPTER_PROTOCOL },
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
