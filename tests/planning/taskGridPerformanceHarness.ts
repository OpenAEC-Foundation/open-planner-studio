import { resolveTaskGridCommand } from '@/engine/taskGrid/navigation';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import { createTaskGridAdapter, createTaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { createTaskGridRowIndex, type TaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { createEmptyGridSelection, updateGridSelection } from '@/engine/taskGrid/selection';
import { computeVirtualWindow } from '@/engine/taskGrid/virtualization';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import type { TaskColumnId } from '@/types/taskGrid';

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

export const TASK_GRID_PERFORMANCE_BUDGETS = Object.freeze({
  relationIndexMs: 500,
  commandBatchMs: 100,
  selectionAdapterMs: 2,
  virtualWindowMs: 5,
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
