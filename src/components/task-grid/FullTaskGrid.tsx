import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TaskGrid } from './TaskGrid';
import type { TaskGridLabels } from './TaskGrid';
import { TaskCellEditor } from './TaskCellEditor';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { TaskTooltipContent } from '@/components/canvas/TaskTooltipContent';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { contextMenuBulk, contextMenuOutlineScope } from '@/components/canvas/contextMenuScope';
import { buildTrace } from '@/components/canvas/ganttRenderOptions';
import { useTableRowDrag } from '@/components/panels/hooks/useTableRowDrag';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { computeTaskGridAutoFitWidth } from '@/engine/taskGrid/preferences';
import {
  createEmptyGridSelection,
  reconcileGridSelection,
  updateGridSelection,
  type GridCellAddress,
  type GridSelectionState,
} from '@/engine/taskGrid/selection';
import {
  copyTaskGridSelection,
  planTaskGridPaste,
  type TaskGridClipboardEnvironment,
} from '@/engine/taskGrid/clipboard';
import type { TaskGridCommand } from '@/engine/taskGrid/navigation';
import { isTreeMode } from '@/engine/view/visibleRows';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { signedWorkDaysBetween } from '@/engine/variance';
import { insertTaskRelativeToScope } from '@/state/taskInsertActions';
import { deleteTasksBulk } from '@/state/taskBulkActions';
import { useAppStore } from '@/state/appStore';
import { saveBranchAsWbsTemplate } from '@/utils/wbsTemplates';
import type { DataGridCellModel, DataGridDataRowModel } from './taskGridContext';
import type { GridEditorCommitResult } from './GridEditorHost';
import type { Task } from '@/types/task';
import type { TaskColumnCategory, TaskColumnId, TaskGridSurfaceId } from '@/types/taskGrid';

interface EditingCell {
  cell: GridCellAddress;
  replacement?: string;
}

interface HoverState {
  task: Task;
  x: number;
  y: number;
}

interface GridContextMenuState {
  x: number;
  y: number;
  task: Task | null;
  group: { key: string; collapsed: boolean } | null;
}

function useElementSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize(current => current.width === rect.width && current.height === rect.height
        ? current
        : { width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

function sameCell(left: GridCellAddress | null, right: GridCellAddress | null): boolean {
  return left?.rowKey === right?.rowKey && left?.columnId === right?.columnId;
}

function categoryFallback(category: TaskColumnCategory): string {
  return ({
    task: 'Taak', planning: 'Planning', constraints: 'Beperkingen', relations: 'Relaties',
    resources: 'Resources', progress: 'Voortgang', computed: 'Berekend', baseline: 'Baseline',
    custom: 'Aangepast', technical: 'Technisch',
  } satisfies Record<TaskColumnCategory, string>)[category];
}

const COLUMN_LABEL_ALIASES: Readonly<Record<string, string>> = {
  'taskGrid.columns.wbs': 'table.wbs',
  'taskGrid.columns.name': 'table.name',
  'taskGrid.columns.description': 'properties.description',
  'taskGrid.columns.duration': 'table.duration',
  'taskGrid.columns.scheduleStart': 'table.start',
  'taskGrid.columns.scheduleFinish': 'table.finish',
  'taskGrid.columns.taskType': 'table.type',
  'taskGrid.columns.critical': 'table.critical',
  'taskGrid.columns.totalFloat': 'table.totalFloat',
  'taskGrid.columns.freeFloat': 'table.freeFloat',
  'taskGrid.columns.interferingFloat': 'table.interferingFloat',
  'taskGrid.columns.nearCritical': 'table.isNearCritical',
  'taskGrid.columns.floatPath': 'table.floatPath',
  'taskGrid.columns.completion': 'table.completion',
  'taskGrid.columns.milestone': 'table.milestone',
  'taskGrid.columns.milestoneKind': 'properties.milestoneKind',
  'taskGrid.columns.mandatoryMilestone': 'properties.mandatory',
  'taskGrid.columns.constraintType': 'properties.constraint',
  'taskGrid.columns.constraintDate': 'properties.constraintDate',
  'taskGrid.columns.constraint2Type': 'properties.constraint2',
  'taskGrid.columns.constraint2Date': 'properties.constraint2Date',
  'taskGrid.columns.hammock': 'properties.hammock',
  'taskGrid.columns.deadline': 'properties.deadline',
  'taskGrid.columns.actualStart': 'properties.progress.actualStart',
  'taskGrid.columns.actualFinish': 'properties.progress.actualFinish',
  'taskGrid.columns.remainingTime': 'properties.progress.remaining',
};

function humanizeTaskGridKey(labelKey: string): string {
  const parts = labelKey.split('.');
  const leaf = parts[parts.length - 1] ?? labelKey;
  const words = leaf
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\bwbs\b/gi, 'WBS')
    .replace(/\bcpm\b/gi, 'CPM');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function resolveColumnLabel(labelKey: string, translate: (key: string) => string): string {
  const direct = translate(labelKey);
  if (direct !== labelKey) return direct;
  const alias = COLUMN_LABEL_ALIASES[labelKey];
  if (alias) {
    const translatedAlias = translate(alias);
    if (translatedAlias !== alias) return translatedAlias;
  }
  return humanizeTaskGridKey(labelKey);
}

function resolveGridStatusLabel(
  statusKey: string | undefined,
  translate: (key: string) => string,
): string | undefined {
  if (!statusKey) return undefined;
  const direct = translate(statusKey);
  if (direct !== statusKey) return direct;
  if (statusKey === 'taskGrid.status.stale') {
    const existing = translate('externalLinks.stale');
    if (existing !== 'externalLinks.stale') return existing;
  }
  return humanizeTaskGridKey(statusKey);
}

function editorNeighbour(
  cell: GridCellAddress,
  taskRows: readonly { rowKey: string }[],
  delta: -1 | 1,
): GridCellAddress | undefined {
  const index = taskRows.findIndex(row => row.rowKey === cell.rowKey);
  const row = taskRows[index + delta];
  return row ? { rowKey: row.rowKey, columnId: cell.columnId } : undefined;
}

export interface TaskGridSurfaceProps {
  surfaceId: TaskGridSurfaceId;
  baseHeaderHeight?: number;
  showSummaryAdd?: boolean;
  doubleClickAction?: 'properties' | 'dialog';
  onPlainTaskClick?: (task: Task) => void;
}

export function TaskGridSurface({
  surfaceId,
  baseHeaderHeight = 32,
  showSummaryAdd = false,
  doubleClickAction = 'properties',
  onPlainTaskClick,
}: TaskGridSurfaceProps) {
  const { t: tTask, i18n: taskI18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const calculatedReadOnlyFallback = taskI18n.resolvedLanguage === 'nl'
    ? 'Deze berekende kolom kan niet worden bewerkt.'
    : 'This calculated column cannot be edited.';
  const tasks = useAppStore(state => state.tasks);
  const sequences = useAppStore(state => state.sequences);
  const assignments = useAppStore(state => state.assignments);
  const resources = useAppStore(state => state.resources);
  const baselines = useAppStore(state => state.baselines);
  const activityCodeTypes = useAppStore(state => state.activityCodeTypes);
  const customFieldDefs = useAppStore(state => state.customFieldDefs);
  const project = useAppStore(state => state.project);
  const calendar = useAppStore(state => state.calendar);
  const calendars = useAppStore(state => state.calendars);
  const scheduleStale = useAppStore(state => state.scheduleStale);
  const cpmResult = useAppStore(state => state.cpmResult);
  const viewRows = useAppStore(state => state.viewRows);
  const view = useAppStore(state => state.view);
  const dateNotation = useAppStore(state => state.ui.dateNotation);
  const uiFontScale = useAppStore(state => state.ui.uiFontScale);
  const traceMode = useAppStore(state => state.ui.traceMode);
  const showColumnsDialog = useAppStore(state => state.ui.showColumnsDialog);
  const collapsedTaskIds = useAppStore(state => state.ui.collapsedTaskIds);
  const selectedTaskIds = useAppStore(state => state.selectedTaskIds);
  const surfacePreferences = useAppStore(state => state.taskGridSurfaces[surfaceId]);
  const recentColumnIds = useAppStore(state => state.recentTaskColumns);
  const selectTask = useAppStore(state => state.selectTask);
  const selectTasks = useAppStore(state => state.selectTasks);
  const addTask = useAppStore(state => state.addTask);
  const pasteTasks = useAppStore(state => state.pasteTasks);
  const taskClipboard = useAppStore(state => state.taskClipboard);
  const setUI = useAppStore(state => state.setUI);
  const setScroll = useAppStore(state => state.setScroll);
  const setCollapsedGroupKey = useAppStore(state => state.setCollapsedGroupKey);
  const toggleCollapse = useAppStore(state => state.toggleCollapse);
  const collapseTasks = useAppStore(state => state.collapseTasks);
  const expandTasks = useAppStore(state => state.expandTasks);
  const collapseAllGroups = useAppStore(state => state.collapseAllGroups);
  const expandAllGroups = useAppStore(state => state.expandAllGroups);
  const moveTaskTo = useAppStore(state => state.moveTaskTo);
  const moveTasksTo = useAppStore(state => state.moveTasksTo);
  const notifyStructureLocked = useAppStore(state => state.notifyStructureLocked);
  const runGridMutation = useAppStore(state => state.runGridMutation);
  const commitTaskGridColumns = useAppStore(state => state.commitTaskGridColumns);
  const setTaskGridScrollX = useAppStore(state => state.setTaskGridScrollX);
  const recordRecentTaskColumn = useAppStore(state => state.recordRecentTaskColumn);
  const [selection, setSelection] = useState<GridSelectionState>(createEmptyGridSelection);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [contextMenu, setContextMenu] = useState<GridContextMenuState | null>(null);
  const commitEditorRef = useRef<(() => GridEditorCommitResult) | null>(null);
  const autoFitCacheRef = useRef(new Map<string, number>());
  const justDraggedRef = useRef(false);
  const { ref: containerRef, size } = useElementSize();

  const calendarEngine = useMemo(() => new CalendarEngine(calendar), [calendar]);
  const trace = useMemo(
    () => buildTrace(traceMode, selectedTaskIds, sequences, cpmResult),
    [cpmResult, selectedTaskIds, sequences, traceMode],
  );
  const adapter = useMemo(() => createTaskGridAdapter({
    surfaceId,
    projectId: project.id,
    rows: viewRows,
    tasks,
    sequences,
    assignments,
    resources,
    baselines,
    activityCodeTypes,
    customFieldDefs,
    scheduleStale,
    wbsAutoNumber: project.wbsAutoNumber === true,
    selectedTaskIds,
    dateNotation,
    calendarOptions: [calendar, ...calendars]
      .filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index)
      .map(item => ({ value: item.id, label: item.name })),
    effectiveHoursPerDay: task => effHoursPerDay(effectiveCalendarOf(task, calendar, calendars)),
    signedWorkDaysBetween: (fromIso, toIso) => signedWorkDaysBetween(calendarEngine, fromIso, toIso),
    labelForColumn: labelKey => resolveColumnLabel(
      labelKey,
      key => tTask(key, { defaultValue: key }),
    ),
    labelForBoolean: value => tCommon(value ? 'yes' : 'no'),
    traceClassForTask: task => {
      if (!trace || task.id === trace.focusId) return null;
      if (trace.drivingPredecessors.includes(task.id)) return 'task-grid-trace-predecessor-driving';
      if (trace.predecessors.includes(task.id)) return 'task-grid-trace-predecessor';
      if (trace.drivenSuccessors.includes(task.id)) return 'task-grid-trace-successor-driving';
      if (trace.successors.includes(task.id)) return 'task-grid-trace-successor';
      return 'task-grid-trace-dimmed';
    },
    callbacks: {
      onPrepareEdit: () => true,
      onCommitEdit: (_target, intents) => {
        const result = runGridMutation(intents);
        if (result.ok) {
          setEditing(null);
          setSurfaceError(null);
        }
        return result;
      },
    },
  }), [
    activityCodeTypes, assignments, baselines, calendar, calendarEngine, calendars,
    customFieldDefs, dateNotation, project.id, project.wbsAutoNumber, resources, surfaceId,
    runGridMutation, scheduleStale, selectedTaskIds, sequences, tCommon, tTask, tasks, trace, viewRows,
  ]);
  const rowIndex = useMemo(() => createTaskGridRowIndex(viewRows), [viewRows]);
  const tasksById = useMemo(() => new Map(tasks.map(task => [task.id, task] as const)), [tasks]);
  const availableIds = useMemo(
    () => new Set(adapter.availableColumns.map(column => column.id)),
    [adapter.availableColumns],
  );
  const visibleColumnIds = useMemo(
    () => surfacePreferences.columns.filter(column => availableIds.has(column.id)).map(column => column.id),
    [availableIds, surfacePreferences.columns],
  );

  const previousRowsRef = useRef(rowIndex);
  const previousColumnsRef = useRef<readonly TaskColumnId[]>(visibleColumnIds);
  useEffect(() => {
    setSelection(current => {
      if (!current.active) {
        const selectedRows = selectedTaskIds
          .flatMap(id => rowIndex.taskRows.filter(row => row.task.id === id));
        const selected = selectedRows[0] ?? rowIndex.taskRows[0];
        const columnId = visibleColumnIds[0];
        if (!selected || !columnId) return createEmptyGridSelection();
        return updateGridSelection(
          createEmptyGridSelection(),
          { rowKey: selected.rowKey, columnId },
          rowIndex,
          visibleColumnIds,
          'replace',
        );
      }
      const reconciled = reconcileGridSelection(
        current,
        previousRowsRef.current,
        rowIndex,
        previousColumnsRef.current,
        visibleColumnIds,
      );
      const samePublishedSelection = current.selectedTaskIds.length === selectedTaskIds.length
        && current.selectedTaskIds.every(id => selectedTaskIds.includes(id));
      return samePublishedSelection
        ? reconciled
        : { ...reconciled, selectedTaskIds: [...selectedTaskIds] };
    });
    previousRowsRef.current = rowIndex;
    previousColumnsRef.current = visibleColumnIds;
  }, [rowIndex, selectedTaskIds, visibleColumnIds]);

  useEffect(() => {
    if (editing && (!rowIndex.taskByRowKey.has(editing.cell.rowKey)
      || !visibleColumnIds.includes(editing.cell.columnId))) {
      commitEditorRef.current = null;
      setEditing(null);
    }
  }, [editing, rowIndex, visibleColumnIds]);

  const finishEditing = useCallback((): boolean => {
    if (!editing) return true;
    const result = commitEditorRef.current?.();
    if (!result) return false;
    if (!result.ok) {
      setSurfaceError(result.error.message);
      return false;
    }
    commitEditorRef.current = null;
    setEditing(null);
    setSurfaceError(null);
    return true;
  }, [editing]);

  const applySelection = useCallback((next: GridSelectionState) => {
    setSelection(next);
    selectTasks([...next.selectedTaskIds], false);
    setSurfaceError(null);
  }, [selectTasks]);

  const selectCell = useCallback((
    cell: GridCellAddress,
    event: Pick<ReactPointerEvent<HTMLDivElement>, 'button' | 'shiftKey' | 'ctrlKey' | 'metaKey'>,
  ) => {
    if (event.button !== 0) return;
    if (!sameCell(editing?.cell ?? null, cell) && !finishEditing()) return;
    const gesture = event.shiftKey ? 'extend' : event.ctrlKey || event.metaKey ? 'toggle-task' : 'replace';
    const next = updateGridSelection(selection, cell, rowIndex, visibleColumnIds, gesture);
    applySelection(next);
    if (gesture === 'replace' && onPlainTaskClick) {
      const meta = adapter.rowMetaByKey.get(cell.rowKey);
      const task = meta?.kind === 'task' ? tasksById.get(meta.taskId) : undefined;
      if (task) onPlainTaskClick(task);
    }
  }, [adapter.rowMetaByKey, applySelection, editing?.cell, finishEditing, onPlainTaskClick, rowIndex, selection, tasksById, visibleColumnIds]);

  const startEdit = useCallback((cell: GridCellAddress, replacement?: string) => {
    const model = adapter.getCell(cell.rowKey, cell.columnId);
    if (!model || model.readOnly) {
      setSurfaceError(calculatedReadOnlyFallback);
      return;
    }
    setEditing(replacement === undefined ? { cell } : { cell, replacement });
    setSurfaceError(null);
  }, [adapter, calculatedReadOnlyFallback]);

  const clipboardEnvironment = useCallback((): TaskGridClipboardEnvironment => ({
    selection,
    rowIndex,
    columns: visibleColumnIds,
    descriptors: adapter.descriptorsById,
    context: adapter.context,
    dateNotation,
  }), [adapter.context, adapter.descriptorsById, dateNotation, rowIndex, selection, visibleColumnIds]);

  const handleCommand = useCallback((command: TaskGridCommand) => {
    if (command.kind === 'move') {
      if (!finishEditing()) return;
      applySelection(updateGridSelection(
        selection,
        command.cell,
        rowIndex,
        visibleColumnIds,
        command.extend ? 'extend' : 'replace',
      ));
      return;
    }
    if (command.kind === 'start-edit') {
      startEdit(command.cell, command.replacement);
      return;
    }
    if (command.kind === 'readonly') {
      setSurfaceError(calculatedReadOnlyFallback);
      return;
    }
    if (command.kind === 'clear-cells') {
      if (!finishEditing()) return;
      deleteTasksBulk(selection.selectedTaskIds);
      return;
    }
    if (command.kind === 'insert-task') {
      if (!finishEditing()) return;
      const row = rowIndex.taskByRowKey.get(command.afterRowKey);
      if (!row) return;
      const id = insertTaskRelativeToScope([row.task.id], 'below', {
        name: tTask('defaultTask', { defaultValue: 'Nieuwe taak' }),
      });
      if (!id) return;
      const live = useAppStore.getState().viewRows.find(candidate => candidate.kind === 'task' && candidate.task.id === id);
      if (!live) return;
      selectTask(id, false);
      const cell = { rowKey: live.rowKey, columnId: command.targetColumnId };
      setSelection(updateGridSelection(createEmptyGridSelection(), cell, createTaskGridRowIndex(useAppStore.getState().viewRows), visibleColumnIds, 'replace'));
      setEditing({ cell, replacement: '' });
    }
  }, [calculatedReadOnlyFallback, finishEditing, rowIndex, selectTask, selection, startEdit, tTask, visibleColumnIds, applySelection]);

  const { startRowDrag, dragState, active: rowDragActive } = useTableRowDrag({
    rows: viewRows,
    tasksById,
    moveTaskTo,
    selectedTaskIds,
    moveTasksTo,
    enabled: isTreeMode(view),
    onBlocked: notifyStructureLocked,
    justDraggedRef,
  });

  const renderedRows = useMemo(() => adapter.rows.map((row, absoluteIndex) => {
    if (row.kind !== 'data') return row;
    const meta = adapter.rowMetaByKey.get(row.rowKey);
    return {
      ...row,
      dragging: meta?.kind === 'task' && dragState?.taskId === meta.taskId,
      dropZone: dragState?.hoverRowIndex === absoluteIndex ? dragState.hoverZone : null,
    };
  }), [adapter.rowMetaByKey, adapter.rows, dragState]);

  const labels = useMemo<TaskGridLabels>(() => ({
    grid: tTask('table.title', { defaultValue: 'Takentabel' }),
    collapseGroup: label => `${tTask('taskGrid.controls.collapse')}: ${label}`,
    expandGroup: label => `${tTask('taskGrid.controls.expand')}: ${label}`,
    resizeColumn: label => `${tTask('taskGrid.controls.resize')}: ${label}`,
    removeColumn: label => `${tTask('taskGrid.controls.remove')}: ${label}`,
    pinColumn: tTask('taskGrid.controls.pin'),
    unpinColumn: tTask('taskGrid.controls.unpin'),
    autoFitColumn: tTask('taskGrid.controls.autoFit'),
    chooser: {
      addColumn: tTask('table.addColumn', { defaultValue: 'Kolom toevoegen' }),
      title: tTask('table.chooseColumn', { defaultValue: 'Kolom kiezen' }),
      recent: tTask('table.recentColumns', { defaultValue: 'Laatst gebruikt' }),
      search: tTask('taskGrid.controls.search'),
      searchResults: tTask('taskGrid.controls.searchResults'),
      noSearchResults: tTask('taskGrid.controls.noResults'),
      category: category => tTask(`taskGrid.category.${category}`, { defaultValue: categoryFallback(category) }),
    },
    noColumns: tTask('table.noColumns', { defaultValue: 'Voeg met + een kolom toe.' }),
    history: {
      addColumn: label => `Kolom ${label} toevoegen`,
      removeColumn: label => `Kolom ${label} verwijderen`,
      pinColumn: label => `Kolom ${label} vastzetten`,
      unpinColumn: label => `Kolom ${label} losmaken`,
      moveColumn: label => `Kolom ${label} verplaatsen`,
      resizeColumn: label => `Kolom ${label} verbreden`,
      autoFitColumn: label => `Kolom ${label} passend maken`,
    },
  }), [tCommon, tTask]);

  const computeAutoFitWidth = useCallback(async (columnId: TaskColumnId): Promise<number | null> => {
    const descriptor = adapter.descriptorsById.get(columnId);
    const option = adapter.availableColumns.find(column => column.id === columnId);
    if (!descriptor || !option) return null;
    const canvasNode = document.createElement('canvas');
    const context2d = canvasNode.getContext('2d');
    if (!context2d) return null;
    const gridNode = containerRef.current;
    const style = gridNode ? getComputedStyle(gridNode) : null;
    context2d.font = style?.font || `${Math.max(10, Math.round(12 * uiFontScale / 100))}px sans-serif`;
    return computeTaskGridAutoFitWidth({
      columnId,
      headerText: option.label,
      rows: rowIndex.taskRows.map(row => {
        const value = descriptor.read(row.task, adapter.context);
        return {
          rowKey: row.rowKey,
          text: descriptor.autoFitText(row.task, adapter.context),
          valueVersion: JSON.stringify(value),
        };
      }),
      cache: autoFitCacheRef.current,
      measureText: text => context2d.measureText(text).width,
    });
  }, [adapter, rowIndex.taskRows, uiFontScale]);

  const getCell = useCallback((row: DataGridDataRowModel, column: { id: TaskColumnId; label: string }): DataGridCellModel => {
    const base = adapter.getCell(row.rowKey, column.id);
    if (!base) return { text: '', readOnly: true };
    const cell = { rowKey: row.rowKey, columnId: column.id };
    if (editing && sameCell(editing.cell, cell)) {
      return {
        text: base.text,
        readOnly: false,
        content: (
          <TaskCellEditor
            key={`${cell.rowKey}\u0000${cell.columnId}`}
            adapter={adapter}
            cell={cell}
            label={column.label}
            initialText={editing.replacement}
            previousCell={editorNeighbour(cell, rowIndex.taskRows, -1)}
            nextCell={editorNeighbour(cell, rowIndex.taskRows, 1)}
            messageForError={messageKey => tTask(messageKey, { defaultValue: 'De ingevoerde waarde is niet geldig.' })}
            labelForOption={(labelKey, value) => tTask(labelKey, { defaultValue: value })}
            onCancel={() => { commitEditorRef.current = null; setEditing(null); setSurfaceError(null); }}
            onFocusCell={next => {
              applySelection(updateGridSelection(selection, next, rowIndex, visibleColumnIds, 'replace'));
              setEditing(null);
            }}
            onCommitReady={commit => { commitEditorRef.current = commit; }}
          />
        ),
      };
    }
    const meta = adapter.rowMetaByKey.get(row.rowKey);
    const task = meta?.kind === 'task' ? tasksById.get(meta.taskId) : undefined;
    const isName = column.id === 'task.name';
    return {
      text: base.text,
      readOnly: base.readOnly,
      stale: base.stale,
      statusText: resolveGridStatusLabel(
        base.statusText,
        key => tTask(key, { defaultValue: key }),
      ),
      title: base.title,
      content: isName && task ? (
        <span className="full-task-grid-name" style={{ paddingInlineStart: row.depth * 14 }}>
          {task.childIds.length > 0 && (
            <>
              <button
                type="button"
                className="full-task-grid-disclosure"
                aria-label={tTask('table.toggleSummary', { defaultValue: 'Samenvatting in- of uitklappen' })}
                aria-expanded={!collapsedTaskIds.includes(task.id)}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); toggleCollapse(task.id); }}
              >
                {collapsedTaskIds.includes(task.id) ? '▸' : '▾'}
              </button>
              {showSummaryAdd && (
                <button
                  type="button"
                  className="gantt-task-grid-add-child"
                  aria-label={`${tTask('defaultTask', { defaultValue: 'Nieuwe taak' })}: ${task.name}`}
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation();
                    addTask({
                      name: tTask('defaultTask', { defaultValue: 'Nieuwe taak' }),
                      parentId: task.id,
                    });
                  }}
                >
                  +
                </button>
              )}
            </>
          )}
          <span>{base.text}</span>
        </span>
      ) : undefined,
    };
  }, [adapter, addTask, applySelection, collapsedTaskIds, editing, rowIndex, selection, showSummaryAdd, tTask, tasksById, toggleCollapse, visibleColumnIds]);

  const rowHeight = Math.max(20, Math.round(28 * uiFontScale / 100));
  const headerHeight = Math.max(24, Math.round(baseHeaderHeight * uiFontScale / 100));
  const viewportHeight = Math.max(0, size.height - headerHeight);

  return (
    <div
      ref={containerRef}
      className={surfaceId === 'full-task-grid' ? 'full-task-grid' : 'gantt-task-grid'}
      data-task-grid-surface-id={surfaceId}
    >
      <TaskGrid
        surfaceId={surfaceId}
        surfacePreferences={surfacePreferences}
        recentColumnIds={recentColumnIds}
        availableColumns={adapter.availableColumns}
        labels={labels}
        rows={renderedRows}
        selection={selection}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        viewportHeight={viewportHeight}
        viewportWidth={size.width}
        scrollTop={view.scrollY}
        scrollLeft={surfacePreferences.scrollX}
        mode={editing ? 'edit' : 'select'}
        getCell={getCell}
        onScrollTopChange={top => setScroll(view.scrollX, top)}
        onScrollLeftChange={left => setTaskGridScrollX(surfaceId, left)}
        onToggleGroup={rowKey => {
          const row = viewRows.find(candidate => candidate.rowKey === rowKey);
          if (row?.kind === 'group') setCollapsedGroupKey(row.key, !row.collapsed);
        }}
        onCommand={handleCommand}
        onCellPointerDown={selectCell}
        onCellDoubleClick={cell => {
          if (!finishEditing()) return;
          const meta = adapter.rowMetaByKey.get(cell.rowKey);
          if (meta?.kind !== 'task') return;
          const next = updateGridSelection(createEmptyGridSelection(), cell, rowIndex, visibleColumnIds, 'replace');
          setSelection(next);
          selectTask(meta.taskId, false);
          if (doubleClickAction === 'dialog') {
            setUI({ showTaskDialog: true, editingTaskId: meta.taskId });
          } else {
            setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
          }
        }}
        onCellContextMenu={(cell, event) => {
          event.preventDefault();
          if (!finishEditing()) return;
          setHover(null);
          const meta = adapter.rowMetaByKey.get(cell.rowKey);
          if (meta?.kind !== 'task') return;
          const task = tasksById.get(meta.taskId);
          if (!task) return;
          const taskScope = selectedTaskIds.includes(task.id) ? selectedTaskIds : [task.id];
          const next = updateGridSelection(createEmptyGridSelection(), cell, rowIndex, visibleColumnIds, 'replace');
          setSelection({ ...next, selectedTaskIds: [...taskScope] });
          if (!selectedTaskIds.includes(task.id)) selectTask(task.id, false);
          setContextMenu({ x: event.clientX, y: event.clientY, task, group: null });
        }}
        onGroupContextMenu={(row, event) => {
          event.preventDefault();
          if (!finishEditing()) return;
          setHover(null);
          const source = viewRows.find(candidate => candidate.rowKey === row.rowKey);
          if (source?.kind !== 'group') return;
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            task: null,
            group: { key: source.key, collapsed: source.collapsed },
          });
        }}
        onCopy={event => {
          const copied = copyTaskGridSelection(clipboardEnvironment());
          if (!copied.ok) return;
          event.preventDefault();
          event.clipboardData.setData('text/plain', copied.value);
        }}
        onPaste={event => {
          if (!finishEditing()) return;
          const planned = planTaskGridPaste(event.clipboardData.getData('text/plain'), clipboardEnvironment());
          if (!planned.ok) {
            setSurfaceError(tTask(planned.errors[0]?.messageKey ?? 'taskGrid.validation.invalid', { defaultValue: 'Plakken is voor deze selectie niet mogelijk.' }));
            return;
          }
          event.preventDefault();
          const result = runGridMutation([planned.value]);
          if (!result.ok) setSurfaceError(tTask(result.errors[0]?.messageKey ?? 'taskGrid.validation.invalid', { defaultValue: 'Plakken is mislukt.' }));
        }}
        onDataRowMouseDown={(row, _absoluteIndex, event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey
            || (event.target as HTMLElement).closest('button,input,select,textarea')) return;
          const meta = adapter.rowMetaByKey.get(row.rowKey);
          if (meta?.kind !== 'task') return;
          startRowDrag({ taskId: meta.taskId, startClientX: event.clientX, startClientY: event.clientY });
        }}
        onDataRowMouseMove={(row, event) => {
          if (rowDragActive || contextMenu) { setHover(null); return; }
          const meta = adapter.rowMetaByKey.get(row.rowKey);
          const task = meta?.kind === 'task' ? tasksById.get(meta.taskId) : undefined;
          if (task) setHover({ task, x: event.clientX, y: event.clientY });
        }}
        onDataRowMouseLeave={() => setHover(null)}
        onCommitColumns={(label, columns) => commitTaskGridColumns(surfaceId, label, columns)}
        onRecordRecentColumn={recordRecentTaskColumn}
        beforeColumnAction={finishEditing}
        onComputeAutoFitWidth={computeAutoFitWidth}
        chooserOpen={showColumnsDialog}
        onChooserOpenChange={open => setUI({ showColumnsDialog: open })}
      />
      {surfaceError && <div className="full-task-grid-error" role="alert">{surfaceError}</div>}
      {hover && !editing && (
        <HoverTooltip left={hover.x + 16} top={hover.y - 10}>
          <TaskTooltipContent task={hover.task} />
        </HoverTooltip>
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={contextMenu.task}
          barHit={false}
          group={contextMenu.group}
          traceActive={traceMode !== 'off'}
          isTreeMode={isTreeMode(view)}
          calendars={calendars}
          canPaste={!!taskClipboard}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            if (contextMenu.task) setUI({ showTaskDialog: true, editingTaskId: contextMenu.task.id });
          }}
          onAddSubtask={() => addTask({
            name: tTask('defaultTask', { defaultValue: 'Nieuwe taak' }),
            parentId: contextMenu.task?.id ?? null,
          })}
          onAddMilestone={() => addTask({
            name: tTask('defaultMilestone', { defaultValue: 'Nieuwe mijlpaal' }),
            isMilestone: true,
            taskType: 'ATTENDANCE',
            parentId: contextMenu.task?.id ?? null,
          })}
          onAddRelation={() => {
            if (!contextMenu.task) return;
            selectTask(contextMenu.task.id, false);
            setUI({ showDependencyMode: true });
          }}
          onSaveTemplate={() => {
            if (!contextMenu.task) return;
            const state = useAppStore.getState();
            const template = saveBranchAsWbsTemplate(
              contextMenu.task.name,
              contextMenu.task.id,
              state.tasks,
              state.sequences,
            );
            state.notify({
              severity: 'info',
              messageKey: 'notifications.templateSaved',
              params: { name: template.name },
            });
          }}
          onTracePath={() => {
            if (traceMode !== 'off') setUI({ traceMode: 'off' });
            else if (contextMenu.task) {
              selectTask(contextMenu.task.id, false);
              setUI({ traceMode: 'both' });
            }
          }}
          onCollapse={() => {
            if (contextMenu.task) collapseTasks(contextMenuOutlineScope(contextMenu.task.id));
          }}
          onExpand={() => {
            if (contextMenu.task) expandTasks(contextMenuOutlineScope(contextMenu.task.id));
          }}
          onDelete={() => {
            if (contextMenu.task) contextMenuBulk.remove(contextMenu.task.id);
          }}
          onAddTask={() => contextMenuBulk.addNearSelection(
            tTask('defaultTask', { defaultValue: 'Nieuwe taak' }),
          )}
          onInsertAbove={() => {
            if (contextMenu.task) contextMenuBulk.insert(
              contextMenu.task.id,
              'above',
              tTask('defaultTask', { defaultValue: 'Nieuwe taak' }),
            );
          }}
          onInsertBelow={() => {
            if (contextMenu.task) contextMenuBulk.insert(
              contextMenu.task.id,
              'below',
              tTask('defaultTask', { defaultValue: 'Nieuwe taak' }),
            );
          }}
          onIndent={() => { if (contextMenu.task) contextMenuBulk.indent(contextMenu.task.id); }}
          onOutdent={() => { if (contextMenu.task) contextMenuBulk.outdent(contextMenu.task.id); }}
          onToggleMilestone={() => {
            if (contextMenu.task) contextMenuBulk.toggleMilestone(contextMenu.task);
          }}
          onSetCalendar={calendarId => {
            if (contextMenu.task) contextMenuBulk.setCalendar(contextMenu.task.id, calendarId);
          }}
          onSetProgress={completion => {
            if (contextMenu.task) contextMenuBulk.setProgress(contextMenu.task.id, completion);
          }}
          onSetPriority={priority => {
            if (contextMenu.task) contextMenuBulk.setPriority(contextMenu.task.id, priority);
          }}
          onStartRelationFromBar={() => undefined}
          onPaste={() => { pasteTasks(); }}
          onZoomReset={() => undefined}
          onFitToProject={() => undefined}
          onToggleGroupCollapse={() => {
            if (contextMenu.group) setCollapsedGroupKey(contextMenu.group.key, !contextMenu.group.collapsed);
          }}
          onExpandAll={expandAllGroups}
          onCollapseAll={collapseAllGroups}
        />
      )}
    </div>
  );
}

export function FullTaskGrid() {
  return <TaskGridSurface surfaceId="full-task-grid" />;
}
