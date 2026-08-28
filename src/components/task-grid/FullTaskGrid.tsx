import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TaskGrid } from './TaskGrid';
import type { TaskGridLabels } from './TaskGrid';
import { TaskCellEditor } from './TaskCellEditor';
import { RelationCellContent } from './RelationCellEditor';
import { ExternalLinkDialog } from '@/components/dialogs/ExternalLinkDialog';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { TaskTooltipContent } from '@/components/canvas/TaskTooltipContent';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { contextMenuBulk, contextMenuOutlineScope } from '@/components/canvas/contextMenuScope';
import { buildTrace } from '@/engine/taskGrid/trace';
import { useTableRowDrag } from '@/components/panels/hooks/useTableRowDrag';
import { createTaskGridAdapter, createTaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { shouldCancelTaskGridEdit } from '@/engine/taskGrid/editLifecycle';
import {
  computeTaskGridAutoFitWidth,
  taskGridAutoFitValueVersion,
} from '@/engine/taskGrid/preferences';
import { nextTaskGridMenuIndex } from '@/engine/taskGrid/menuNavigation';
import { buildRelationCellItems } from '@/engine/taskGrid/relationCell';
import { taskRelations } from '@/engine/taskGrid/relationIndex';
import {
  createEmptyGridSelection,
  reconcileGridSelection,
  updateGridSelection,
  type GridCellAddress,
  type GridSelectionState,
} from '@/engine/taskGrid/selection';
import {
  copyTaskGridSelection,
  planTaskGridClear,
  planTaskGridPaste,
  type TaskGridClipboardEnvironment,
} from '@/engine/taskGrid/clipboard';
import type { TaskGridCommand } from '@/engine/taskGrid/navigation';
import { isTreeMode } from '@/engine/view/visibleRows';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { signedWorkDaysBetween } from '@/engine/variance';
import { insertTaskRelativeToScope } from '@/state/taskInsertActions';
import { useAppStore } from '@/state/appStore';
import { saveBranchAsWbsTemplate } from '@/utils/wbsTemplates';
import { buildImportLabels } from '@/i18n/importLabels';
import type { DataGridCellModel, DataGridDataRowModel } from './taskGridContext';
import type { GridEditorCommitResult } from './GridEditorHost';
import type { Task } from '@/types/task';
import type { TaskColumnCategory, TaskColumnId, TaskGridSurfaceId } from '@/types/taskGrid';

interface EditingCell {
  documentId: string;
  cell: GridCellAddress;
  replacement?: string;
}

interface HoverState {
  documentId: string;
  task: Task;
  x: number;
  y: number;
}

interface GridContextMenuState {
  documentId: string;
  x: number;
  y: number;
  task: Task | null;
  group: { key: string; collapsed: boolean } | null;
}

interface ExternalRelationMenuState {
  documentId: string;
  x: number;
  y: number;
  taskId: string;
  relationId: string;
  filePath?: string;
  trigger: HTMLElement;
}

interface ExternalRelationDialogState {
  documentId: string;
  taskId: string;
  relationId?: string;
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
  const dynamicSeparator = labelKey.indexOf(' — ');
  if (dynamicSeparator > 0) {
    const prefix = labelKey.slice(0, dynamicSeparator);
    const fieldKey = labelKey.slice(dynamicSeparator + 3);
    return `${prefix} — ${resolveColumnLabel(fieldKey, translate)}`;
  }
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
  onPlainTaskClick?: (task: Task) => void;
}

export function TaskGridSurface({
  surfaceId,
  baseHeaderHeight = 32,
  showSummaryAdd = false,
  onPlainTaskClick,
}: TaskGridSurfaceProps) {
  const { t: tTask, i18n: taskI18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const calculatedReadOnlyFallback = tTask('table.calculatedReadOnly');
  const textDirection = taskI18n.dir() === 'rtl' ? 'rtl' : 'ltr';
  const activeDocumentId = useAppStore(state => state.activeDocumentId);
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
  const publishedActiveTaskId = useAppStore(state => state.activeTaskId);
  const surfacePreferences = useAppStore(state => state.taskGridSurfaces[surfaceId]);
  const recentColumnIds = useAppStore(state => state.recentTaskColumns);
  const selectTask = useAppStore(state => state.selectTask);
  const selectTasks = useAppStore(state => state.selectTasks);
  const focusOnTask = useAppStore(state => state.focusOnTask);
  const removeExternalLink = useAppStore(state => state.removeExternalLink);
  const refreshExternalAnchorsFrom = useAppStore(state => state.refreshExternalAnchorsFrom);
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
  const [externalRelationMenu, setExternalRelationMenu] = useState<ExternalRelationMenuState | null>(null);
  const [externalRelationDialog, setExternalRelationDialog] = useState<ExternalRelationDialogState | null>(null);
  const commitEditorRef = useRef<(() => GridEditorCommitResult) | null>(null);
  const autoFitCacheRef = useRef(new Map<string, number>());
  const externalRelationMenuRef = useRef<HTMLDivElement | null>(null);
  const previousDocumentIdRef = useRef(activeDocumentId);
  const justDraggedRef = useRef(false);
  const { ref: containerRef, size } = useElementSize();

  const closeExternalRelationMenu = useCallback((restoreFocus: boolean) => {
    const trigger = externalRelationMenu?.trigger;
    const canRestore = restoreFocus
      && externalRelationMenu?.documentId === activeDocumentId
      && trigger?.isConnected;
    setExternalRelationMenu(null);
    if (canRestore) requestAnimationFrame(() => trigger.focus());
  }, [activeDocumentId, externalRelationMenu]);

  useEffect(() => {
    if (!externalRelationMenu || externalRelationMenu.documentId !== activeDocumentId) return;
    externalRelationMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = () => closeExternalRelationMenu(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [activeDocumentId, closeExternalRelationMenu, externalRelationMenu]);

  useEffect(() => {
    if (previousDocumentIdRef.current === activeDocumentId) return;
    previousDocumentIdRef.current = activeDocumentId;
    commitEditorRef.current = null;
    autoFitCacheRef.current.clear();
    setSelection(createEmptyGridSelection());
    setEditing(null);
    setSurfaceError(null);
    setHover(null);
    setContextMenu(null);
    setExternalRelationMenu(null);
    setExternalRelationDialog(null);
  }, [activeDocumentId]);

  const calendarEngine = useMemo(() => new CalendarEngine(calendar), [calendar]);
  const calendarOptions = useMemo(() => [calendar, ...calendars]
    .filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index)
    .map(item => ({ value: item.id, label: item.name })), [calendar, calendars]);
  const trace = useMemo(
    () => buildTrace(traceMode, selectedTaskIds, sequences, cpmResult),
    [cpmResult, selectedTaskIds, sequences, traceMode],
  );
  const adapterDomain = useMemo(() => createTaskGridAdapterDomain({
    projectId: project.id,
    tasks,
    sequences,
    cpmResult,
    assignments,
    resources,
    baselines,
    activityCodeTypes,
    customFieldDefs,
    scheduleStale,
    wbsAutoNumber: project.wbsAutoNumber === true,
    dateNotation,
    calendarOptions,
    effectiveHoursPerDay: task => effHoursPerDay(effectiveCalendarOf(task, calendar, calendars)),
    signedWorkDaysBetween: (fromIso, toIso) => signedWorkDaysBetween(calendarEngine, fromIso, toIso),
    labelForColumn: labelKey => resolveColumnLabel(
      labelKey,
      key => tTask(key, { defaultValue: key }),
    ),
    labelForBoolean: value => tCommon(value ? 'yes' : 'no'),
    labelForText: (key, values) => key.startsWith('resource.curve.')
      ? tCommon(key, { ...values, defaultValue: key })
      : tTask(key, { ...values, defaultValue: key }),
    textDirection,
  }), [
    activityCodeTypes, assignments, baselines, calendar, calendarEngine, calendarOptions,
    cpmResult, customFieldDefs, dateNotation, project.id, project.wbsAutoNumber, resources,
    scheduleStale, sequences, tCommon, tTask, tasks, textDirection,
  ]);
  const adapter = useMemo(() => createTaskGridAdapter({
    surfaceId,
    rows: viewRows,
    selectedTaskIds,
    trace,
    callbacks: {
      onPrepareEdit: () => true,
      onCommitEdit: (_target, intents) => {
        if (useAppStore.getState().activeDocumentId !== activeDocumentId) {
          return {
            ok: false,
            errors: [{ code: 'documentChanged', messageKey: 'taskGrid.validation.invalid' }],
          };
        }
        const result = runGridMutation(intents);
        if (result.ok) {
          setEditing(null);
          setSurfaceError(null);
        }
        return result;
      },
    },
  }, adapterDomain), [
    activeDocumentId, adapterDomain, runGridMutation, selectedTaskIds, surfaceId, trace, viewRows,
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
        const preferredTaskIds = publishedActiveTaskId
          ? [publishedActiveTaskId, ...selectedTaskIds.filter(id => id !== publishedActiveTaskId)]
          : selectedTaskIds;
        const selectedRows = preferredTaskIds
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
      const samePublishedActiveTask = current.activeTaskId === publishedActiveTaskId;
      return samePublishedSelection && samePublishedActiveTask
        ? reconciled
        : {
            ...reconciled,
            selectedTaskIds: [...selectedTaskIds],
            activeTaskId: publishedActiveTaskId,
          };
    });
    previousRowsRef.current = rowIndex;
    previousColumnsRef.current = visibleColumnIds;
  }, [publishedActiveTaskId, rowIndex, selectedTaskIds, visibleColumnIds]);

  useEffect(() => {
    if (!editing || editing.documentId !== activeDocumentId) return;
    const liveRowExists = useAppStore.getState().viewRows.some(candidate => (
      candidate.kind === 'task' && candidate.rowKey === editing.cell.rowKey
    ));
    if (shouldCancelTaskGridEdit({
      indexedRowExists: rowIndex.taskByRowKey.has(editing.cell.rowKey),
      liveRowExists,
      columnVisible: visibleColumnIds.includes(editing.cell.columnId),
    })) {
      commitEditorRef.current = null;
      setEditing(null);
    }
  }, [activeDocumentId, editing, rowIndex, visibleColumnIds]);

  const finishEditing = useCallback((): boolean => {
    if (!editing) return true;
    if (editing.documentId !== useAppStore.getState().activeDocumentId) {
      commitEditorRef.current = null;
      setEditing(null);
      setSurfaceError(null);
      return true;
    }
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
    selectTasks([...next.selectedTaskIds], false, next.activeTaskId);
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
    if (next !== selection) applySelection(next);
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
    setEditing(replacement === undefined
      ? { documentId: activeDocumentId, cell }
      : { documentId: activeDocumentId, cell, replacement });
    setSurfaceError(null);
  }, [activeDocumentId, adapter, calculatedReadOnlyFallback]);

  const clipboardEnvironment = useCallback((): TaskGridClipboardEnvironment => ({
    selection,
    rowIndex,
    columns: visibleColumnIds,
    descriptors: adapter.descriptorsById,
    context: adapter.context,
    dateNotation,
    booleanLabels: { true: tCommon('yes'), false: tCommon('no') },
  }), [adapter.context, adapter.descriptorsById, dateNotation, rowIndex, selection, tCommon, visibleColumnIds]);

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
      const planned = planTaskGridClear(clipboardEnvironment());
      if (!planned.ok) {
        setSurfaceError(tTask(planned.errors[0]?.messageKey ?? 'taskGrid.validation.invalid', {
          defaultValue: 'Wissen is voor deze selectie niet mogelijk.',
        }));
        return;
      }
      const result = runGridMutation([planned.value]);
      if (!result.ok) {
        setSurfaceError(tTask(result.errors[0]?.messageKey ?? 'taskGrid.validation.invalid', {
          defaultValue: 'Wissen is mislukt.',
        }));
      }
      return;
    }
    if (command.kind === 'insert-task') {
      if (!finishEditing()) return;
      const row = rowIndex.taskByRowKey.get(command.anchorRowKey);
      if (!row) return;
      // De grid volgt hier de globale betekenis van de Insert-toets (`structure.insertAbove` in
      // shortcutRegistry.ts): boven de actieve taak invoegen. "Onder" blijft bereikbaar via
      // Ctrl+I (`structure.insertBelow`), ook binnen de tabel.
      const id = insertTaskRelativeToScope([row.task.id], 'above', {
        name: tTask('defaultTask', { defaultValue: 'Nieuwe taak' }),
      });
      if (!id) return;
      const live = useAppStore.getState().viewRows.find(candidate => candidate.kind === 'task' && candidate.task.id === id);
      if (!live) return;
      selectTask(id, false);
      const cell = { rowKey: live.rowKey, columnId: command.targetColumnId };
      setSelection(updateGridSelection(createEmptyGridSelection(), cell, createTaskGridRowIndex(useAppStore.getState().viewRows), visibleColumnIds, 'replace'));
      setEditing({ documentId: activeDocumentId, cell, replacement: '' });
    }
  }, [activeDocumentId, applySelection, calculatedReadOnlyFallback, clipboardEnvironment, finishEditing, rowIndex, runGridMutation, selectTask, selection, startEdit, tTask, visibleColumnIds]);

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
      addColumn: column => tTask('taskGrid.history.addColumn', { column }),
      removeColumn: column => tTask('taskGrid.history.removeColumn', { column }),
      pinColumn: column => tTask('taskGrid.history.pinColumn', { column }),
      unpinColumn: column => tTask('taskGrid.history.unpinColumn', { column }),
      moveColumn: column => tTask('taskGrid.history.moveColumn', { column }),
      resizeColumn: column => tTask('taskGrid.history.resizeColumn', { column }),
      autoFitColumn: column => tTask('taskGrid.history.autoFitColumn', { column }),
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
        const visibleText = adapter.getCell(row.rowKey, columnId)?.text ?? '';
        return {
          rowKey: row.rowKey,
          text: visibleText,
          valueVersion: taskGridAutoFitValueVersion(
            value,
            visibleText,
            context2d.font,
            activeDocumentId,
          ),
        };
      }),
      cache: autoFitCacheRef.current,
      measureText: text => context2d.measureText(text).width,
    });
  }, [activeDocumentId, adapter, rowIndex.taskRows, uiFontScale]);

  const getCell = useCallback((row: DataGridDataRowModel, column: { id: TaskColumnId; label: string }): DataGridCellModel => {
    const base = adapter.getCell(row.rowKey, column.id);
    if (!base) return { text: '', readOnly: true };
    const cell = { rowKey: row.rowKey, columnId: column.id };
    if (editing?.documentId === activeDocumentId && sameCell(editing.cell, cell)) {
      return {
        text: base.text,
        readOnly: false,
        content: (
          <TaskCellEditor
            key={`${cell.rowKey}\u0000${cell.columnId}`}
            adapter={adapter}
            cell={cell}
            label={column.label}
            calendarPickerLabel={column.label}
            initialText={editing.replacement}
            previousCell={editorNeighbour(cell, rowIndex.taskRows, -1)}
            nextCell={editorNeighbour(cell, rowIndex.taskRows, 1)}
            messageForError={messageKey => tTask(messageKey, { defaultValue: 'De ingevoerde waarde is niet geldig.' })}
            labelForOption={(labelKey, value) => labelKey.startsWith('resource.curve.')
              ? tCommon(labelKey, { defaultValue: value })
              : tTask(labelKey, { defaultValue: value })}
            onCancel={() => { commitEditorRef.current = null; setEditing(null); setSurfaceError(null); }}
            onFocusCell={next => {
              applySelection(updateGridSelection(selection, next, rowIndex, visibleColumnIds, 'replace'));
              setEditing(null);
            }}
            onCommitReady={commit => { commitEditorRef.current = commit; }}
            onOpenExternal={(taskId, relationId) => {
              commitEditorRef.current = null;
              setEditing(null);
              setExternalRelationDialog({
                documentId: activeDocumentId,
                taskId,
                ...(relationId ? { relationId } : {}),
              });
            }}
          />
        ),
      };
    }
    const meta = adapter.rowMetaByKey.get(row.rowKey);
    const task = meta?.kind === 'task' ? tasksById.get(meta.taskId) : undefined;
    const isName = column.id === 'task.name';
    const relationDirection = column.id === 'relation.predecessors'
      ? 'predecessor'
      : column.id === 'relation.successors' ? 'successor' : null;
    const relationItems = task && relationDirection
      ? buildRelationCellItems({
          ownerTaskId: task.id,
          direction: relationDirection,
          entries: taskRelations(adapter.context.relationIndex, task.id, relationDirection),
          context: adapter.context,
        })
      : [];
    return {
      text: base.text,
      readOnly: base.readOnly,
      stale: base.stale,
      statusText: resolveGridStatusLabel(
        base.statusText,
        key => tTask(key, { defaultValue: key }),
      ),
      title: base.title,
      content: relationDirection && task && relationItems.length > 0 ? (
        <RelationCellContent
          items={relationItems}
          onFocusTask={focusOnTask}
          onHoverStart={() => setHover(null)}
          onExternalContextMenu={(item, event) => {
            const external = item.parsedToken.kind === 'external' ? item.parsedToken.external : null;
            if (!external) return;
            setExternalRelationMenu({
              documentId: activeDocumentId,
              x: event.clientX,
              y: event.clientY,
              taskId: task.id,
              relationId: item.relationId,
              trigger: event.currentTarget.closest<HTMLElement>('[role="gridcell"]')
                ?? event.currentTarget,
              ...(external.sourceRef.filePath ? { filePath: external.sourceRef.filePath } : {}),
            });
          }}
        />
      ) : isName && task ? (
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
  }, [activeDocumentId, adapter, addTask, applySelection, collapsedTaskIds, editing, focusOnTask, rowIndex, selection, showSummaryAdd, tTask, tasksById, toggleCollapse, visibleColumnIds]);

  const rowHeight = Math.max(20, Math.round(28 * uiFontScale / 100));
  const headerHeight = Math.max(24, Math.round(baseHeaderHeight * uiFontScale / 100));
  const viewportHeight = Math.max(0, size.height - headerHeight);
  const handleExternalRelationMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeExternalRelationMenu(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .filter(item => !item.hasAttribute('disabled'));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = nextTaskGridMenuIndex(
      event.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
      currentIndex,
      items.length,
    );
    if (nextIndex === null) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  }, [closeExternalRelationMenu]);

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
        mode={editing?.documentId === activeDocumentId ? 'edit' : 'select'}
        textDirection={textDirection}
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
          applySelection(next);
          setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
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
          const scopedSelection = {
            ...next,
            selectedTaskIds: [...taskScope],
            activeTaskId: task.id,
          };
          applySelection(scopedSelection);
          setContextMenu({
            documentId: activeDocumentId,
            x: event.clientX,
            y: event.clientY,
            task,
            group: null,
          });
        }}
        onGroupContextMenu={(row, event) => {
          event.preventDefault();
          if (!finishEditing()) return;
          setHover(null);
          const source = viewRows.find(candidate => candidate.rowKey === row.rowKey);
          if (source?.kind !== 'group') return;
          setContextMenu({
            documentId: activeDocumentId,
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
          const planned = planTaskGridPaste(
            event.clipboardData.getData('text/plain'), clipboardEnvironment(), { skipReadOnlyCells: true },
          );
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
          if (task) setHover({ documentId: activeDocumentId, task, x: event.clientX, y: event.clientY });
        }}
        onDataRowMouseLeave={() => setHover(null)}
        onCommitColumns={(label, columns) => commitTaskGridColumns(surfaceId, label, columns)}
        onRecordRecentColumn={recordRecentTaskColumn}
        beforeColumnAction={finishEditing}
        onComputeAutoFitWidth={computeAutoFitWidth}
        chooserOpen={surfaceId === 'full-task-grid' ? showColumnsDialog : undefined}
        onChooserOpenChange={surfaceId === 'full-task-grid'
          ? open => setUI({ showColumnsDialog: open })
          : undefined}
      />
      {surfaceError && <div className="full-task-grid-error" role="alert">{surfaceError}</div>}
      {hover?.documentId === activeDocumentId && !editing && (
        <HoverTooltip left={hover.x + 16} top={hover.y - 10}>
          <TaskTooltipContent task={hover.task} />
        </HoverTooltip>
      )}
      {externalRelationMenu?.documentId === activeDocumentId && (
        <div
          ref={externalRelationMenuRef}
          className="task-grid-relation-context"
          role="menu"
          style={{ left: externalRelationMenu.x, top: externalRelationMenu.y }}
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={handleExternalRelationMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setExternalRelationDialog({
                documentId: activeDocumentId,
                taskId: externalRelationMenu.taskId,
                relationId: externalRelationMenu.relationId,
              });
              closeExternalRelationMenu(false);
            }}
          >
            {tTask('externalLinks.edit')}
          </button>
          {externalRelationMenu.filePath && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const filePath = externalRelationMenu.filePath!;
                closeExternalRelationMenu(false);
                void (async () => {
                const result = await refreshExternalAnchorsFrom(
                  filePath,
                  buildImportLabels(tCommon),
                );
                if (!result && useAppStore.getState().activeDocumentId === activeDocumentId) {
                  setSurfaceError(tTask('externalLinks.notAvailableWeb', { defaultValue: 'Verversen is hier niet beschikbaar.' }));
                }
                })();
              }}
            >
              {tTask('externalLinks.refreshSource')}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="task-grid-relation-context-danger"
            onClick={() => {
              if (useAppStore.getState().activeDocumentId === activeDocumentId) {
                removeExternalLink(externalRelationMenu.taskId, externalRelationMenu.relationId);
              }
              closeExternalRelationMenu(false);
            }}
          >
            {tTask('externalLinks.deleteRelation')}
          </button>
        </div>
      )}
      {externalRelationDialog?.documentId === activeDocumentId && (
        <ExternalLinkDialog
          taskId={externalRelationDialog.taskId}
          {...(externalRelationDialog.relationId ? { linkId: externalRelationDialog.relationId } : {})}
          onClose={() => setExternalRelationDialog(null)}
        />
      )}
      {contextMenu?.documentId === activeDocumentId && (
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
