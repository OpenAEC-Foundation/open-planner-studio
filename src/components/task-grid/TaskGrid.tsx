import { useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  addTaskGridColumn,
  moveTaskGridColumn,
  removeTaskGridColumn,
  resizeTaskGridColumn,
  setTaskGridColumnPinned,
} from '@/engine/taskGrid/preferences';
import type {
  TaskColumnId,
  TaskGridColumnPreference,
  TaskGridSurfaceId,
  TaskGridSurfacePreferences,
} from '@/types/taskGrid';
import { ColumnChooser, type ColumnChooserLabels, type TaskGridColumnOption } from './ColumnChooser';
import { DataGridCore, type DataGridCoreProps } from './DataGridCore';
import type { DataGridColumnModel, DataGridLabels } from './taskGridContext';

export interface TaskGridHistoryLabels {
  addColumn: (label: string) => string;
  removeColumn: (label: string) => string;
  pinColumn: (label: string) => string;
  unpinColumn: (label: string) => string;
  moveColumn: (label: string) => string;
  resizeColumn: (label: string) => string;
  autoFitColumn: (label: string) => string;
}

export interface TaskGridLabels extends DataGridLabels {
  chooser: ColumnChooserLabels;
  noColumns: string;
  history: TaskGridHistoryLabels;
}

type CoreProps = Omit<
  DataGridCoreProps,
  | 'columns'
  | 'labels'
  | 'onResizeStart'
  | 'onResizePreview'
  | 'onResizeCommit'
  | 'onResizeCancel'
  | 'onRemoveColumn'
  | 'onTogglePinned'
  | 'onAutoFitColumn'
  | 'onReorderColumn'
>;

export interface TaskGridProps extends CoreProps {
  surfaceId: TaskGridSurfaceId;
  surfacePreferences: Readonly<TaskGridSurfacePreferences>;
  recentColumnIds: readonly TaskColumnId[];
  availableColumns: readonly TaskGridColumnOption[];
  labels: TaskGridLabels;
  /** Commit een al gevalideerde gebruikersvoorkeur als precies één history-event. */
  onCommitColumns: (label: string, columns: readonly TaskGridColumnPreference[]) => void;
  onRecordRecentColumn: (columnId: TaskColumnId) => void;
  /** Commit een geldige actieve editor synchroon; geef false terug zolang de waarde ongeldig is. */
  beforeColumnAction?: () => boolean;
  /** De adapter scant alle actuele taak-occurrences en geeft null terug als de bron onderweg verdwijnt. */
  onComputeAutoFitWidth?: (columnId: TaskColumnId) => Promise<number | null>;
  chooserOpen?: boolean;
  onChooserOpenChange?: (open: boolean) => void;
}

function sameColumns(
  left: readonly TaskGridColumnPreference[],
  right: readonly TaskGridColumnPreference[],
): boolean {
  return left.length === right.length && left.every((column, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && column.id === candidate.id
      && column.width === candidate.width
      && column.pinned === candidate.pinned;
  });
}

function cloneColumns(columns: readonly TaskGridColumnPreference[]): TaskGridColumnPreference[] {
  return columns.map(column => ({ ...column }));
}

export function TaskGrid({
  surfaceId,
  surfacePreferences,
  recentColumnIds,
  availableColumns,
  labels,
  onCommitColumns,
  onRecordRecentColumn,
  beforeColumnAction,
  onComputeAutoFitWidth,
  chooserOpen,
  onChooserOpenChange,
  ...coreProps
}: TaskGridProps) {
  const [previewWidths, setPreviewWidths] = useState<ReadonlyMap<TaskColumnId, number>>(
    () => new Map(),
  );
  const preferencesRef = useRef(surfacePreferences);
  preferencesRef.current = surfacePreferences;
  const optionsById = useMemo(
    () => new Map(availableColumns.map(option => [option.id, option] as const)),
    [availableColumns],
  );
  const visibleIds = useMemo(
    () => new Set(surfacePreferences.columns
      .filter(column => optionsById.has(column.id))
      .map(column => column.id)),
    [surfacePreferences.columns, optionsById],
  );
  const columns = useMemo<DataGridColumnModel[]>(() => surfacePreferences.columns.flatMap(preference => {
    const option = optionsById.get(preference.id);
    if (!option) return [];
    return [{
      id: preference.id,
      label: option.label,
      width: previewWidths.get(preference.id) ?? preference.width,
      pinned: preference.pinned,
      align: option.align,
    }];
  }), [surfacePreferences.columns, optionsById, previewWidths]);

  const allowAction = () => beforeColumnAction?.() !== false;

  const commitAction = (
    label: string,
    transform: (columns: readonly TaskGridColumnPreference[]) => TaskGridColumnPreference[],
  ): boolean => {
    if (!allowAction()) return false;
    const before = preferencesRef.current.columns;
    const after = transform(before);
    if (sameColumns(before, after)) return false;
    onCommitColumns(label, after);
    return true;
  };

  const autoFitColumn = async (columnId: TaskColumnId) => {
    const option = optionsById.get(columnId);
    if (!option || !onComputeAutoFitWidth || !allowAction()) return;
    const before = cloneColumns(preferencesRef.current.columns);
    const width = await onComputeAutoFitWidth(columnId);
    if (width === null || !sameColumns(preferencesRef.current.columns, before)) return;
    const after = resizeTaskGridColumn(before, columnId, width);
    if (sameColumns(before, after)) return;
    onCommitColumns(labels.history.autoFitColumn(option.label), after);
  };

  return (
    <div
      className="task-grid-shell"
      data-task-grid-surface={surfaceId}
      style={{ '--task-grid-header-height': `${coreProps.headerHeight}px` } as CSSProperties}
    >
      <DataGridCore
        {...coreProps}
        columns={columns}
        labels={labels}
        onRemoveColumn={columnId => {
          const option = optionsById.get(columnId);
          if (!option) return;
          commitAction(
            labels.history.removeColumn(option.label),
            current => removeTaskGridColumn(current, columnId),
          );
        }}
        onTogglePinned={(columnId, pinned) => {
          const option = optionsById.get(columnId);
          if (!option) return;
          commitAction(
            pinned ? labels.history.pinColumn(option.label) : labels.history.unpinColumn(option.label),
            current => setTaskGridColumnPinned(current, columnId, pinned),
          );
        }}
        onAutoFitColumn={columnId => { void autoFitColumn(columnId); }}
        onReorderColumn={(draggedId, targetId, placement) => {
          const option = optionsById.get(draggedId);
          if (!option) return;
          commitAction(
            labels.history.moveColumn(option.label),
            current => moveTaskGridColumn(current, draggedId, targetId, placement),
          );
        }}
        onResizeStart={() => {
          if (!allowAction()) return false;
          setPreviewWidths(new Map());
          return true;
        }}
        onResizePreview={(columnId, width) => {
          setPreviewWidths(current => {
            const next = new Map(current);
            next.set(columnId, width);
            return next;
          });
        }}
        onResizeCommit={(columnId, _before, after) => {
          const option = optionsById.get(columnId);
          setPreviewWidths(new Map());
          if (!option) return;
          const current = preferencesRef.current.columns;
          const resized = resizeTaskGridColumn(current, columnId, after);
          if (!sameColumns(current, resized)) {
            onCommitColumns(labels.history.resizeColumn(option.label), resized);
          }
        }}
        onResizeCancel={() => setPreviewWidths(new Map())}
      />
      {columns.length === 0 && (
        <div className="task-grid-no-columns" role="status">{labels.noColumns}</div>
      )}
      <ColumnChooser
        options={availableColumns}
        recentIds={recentColumnIds}
        visibleIds={visibleIds}
        labels={labels.chooser}
        open={chooserOpen}
        onOpenChange={onChooserOpenChange}
        beforeOpen={allowAction}
        onChoose={option => {
          const added = commitAction(
            labels.history.addColumn(option.label),
            current => addTaskGridColumn(current, {
              id: option.id,
              width: option.defaultWidth,
              pinned: false,
            }),
          );
          if (added) onRecordRecentColumn(option.id);
          return added;
        }}
      />
    </div>
  );
}
