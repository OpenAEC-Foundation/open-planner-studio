import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  addTaskGridColumn,
  applyAutoFitWidths,
  cloneColumns,
  moveTaskGridColumn,
  removeTaskGridColumn,
  resizeTaskGridColumn,
  sameTaskGridColumns,
  setTaskGridColumnPinned,
} from '@/engine/taskGrid/preferences';
import type {
  TaskColumnId,
  TaskGridColumnPreference,
  TaskGridSurfaceId,
  TaskGridSurfacePreferences,
} from '@/types/taskGrid';
import { startAutoFitScheduler } from '@/engine/taskGrid/autoFitScheduler';
import { isAutoCalcHeld, onAutoCalcReleased } from '@/state/editHold';
import { ColumnChooser, type ColumnChooserLabels, type TaskGridColumnOption } from './ColumnChooser';
import { DataGridCore, type DataGridCoreProps } from './DataGridCore';
import { TASK_GRID_CHOOSER_STRIP } from '@/engine/taskGrid/scrollExtent';
import type { DataGridColumnModel, DataGridLabels } from './taskGridContext';

/** Rust vóór een automatische meting (ms). */
const AUTO_FIT_DELAY_MS = 250;

export interface TaskGridHistoryLabels {
  addColumn: (label: string) => string;
  removeColumn: (label: string) => string;
  pinColumn: (label: string) => string;
  unpinColumn: (label: string) => string;
  moveColumn: (label: string) => string;
  resizeColumn: (label: string) => string;
  autoFitColumn: (label: string) => string;
  resetColumns: string;
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
  /** De standaardindeling van dit oppervlak (`defaultTaskGridSurfaceColumns`), voor "Herstel standaard". */
  defaultColumns: readonly TaskGridColumnPreference[];
  labels: TaskGridLabels;
  /** Commit een al gevalideerde gebruikersvoorkeur als precies één history-event. */
  onCommitColumns: (label: string, columns: readonly TaskGridColumnPreference[]) => void;
  onRecordRecentColumn: (columnId: TaskColumnId) => void;
  /** Commit een geldige actieve editor synchroon; geef false terug zolang de waarde ongeldig is. */
  beforeColumnAction?: () => boolean;
  /** De adapter scant alle actuele taak-occurrences en geeft null terug als de bron onderweg verdwijnt. */
  onComputeAutoFitWidth?: (columnId: TaskColumnId) => Promise<number | null>;
  /** Instelling "Kolommen automatisch aanpassen". Kolommen met `manualWidth` blijven staan. */
  autoFitColumns?: boolean;
  /** Tijdelijk geen automatisch aanpassen, bijvoorbeeld tijdens het bewerken van een cel. */
  autoFitPaused?: boolean;
  /** Schrijft de automatisch gemeten breedtes weg: bewaard, maar geen eigen undo-stap. Moet stabiel zijn. */
  onApplyAutoFit?: (columns: readonly TaskGridColumnPreference[]) => void;
  chooserOpen?: boolean;
  onChooserOpenChange?: (open: boolean) => void;
  /** Zie `ColumnChooserProps.externalToggleSelector`. */
  chooserExternalToggleSelector?: string;
}

export function TaskGrid({
  surfaceId,
  surfacePreferences,
  recentColumnIds,
  availableColumns,
  defaultColumns,
  labels,
  onCommitColumns,
  onRecordRecentColumn,
  beforeColumnAction,
  onComputeAutoFitWidth,
  autoFitColumns = false,
  autoFitPaused = false,
  onApplyAutoFit,
  chooserOpen,
  onChooserOpenChange,
  chooserExternalToggleSelector,
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
    if (sameTaskGridColumns(before, after)) return false;
    onCommitColumns(label, after);
    return true;
  };

  // Tijdens het slepen van een kolomrand grijpt automatisch aanpassen niet in.
  const resizing = previewWidths.size > 0;

  // Automatisch aanpassen (instelling): na een korte rust meten we alle kolommen zonder
  // `manualWidth` en schrijven de nieuwe breedtes weg. `onComputeAutoFitWidth` krijgt een nieuwe
  // identiteit zodra rijen, tekst, taal of lettergrootte veranderen en is daarmee de trigger. Tijdens
  // het bewerken van een cel in dit raster (`autoFitPaused`), tijdens het slepen van een kolomrand en
  // zolang een andere bewerking loopt (`holdAutoCalc`: het eigenschappenpaneel dat per toetsaanslag
  // schrijft, een sleepgebaar) wacht de meting, zodat een kolom niet onder de hand beweegt; daarna
  // volgt één nieuwe meting (`autoFitScheduler.ts`).
  useEffect(() => {
    if (!autoFitColumns || autoFitPaused || resizing || !onComputeAutoFitWidth || !onApplyAutoFit) return;
    return startAutoFitScheduler({
      delayMs: AUTO_FIT_DELAY_MS,
      isHeld: isAutoCalcHeld,
      onReleased: onAutoCalcReleased,
      run: async ({ isCancelled }) => {
        const before = cloneColumns(preferencesRef.current.columns);
        const widths = new Map<TaskColumnId, number>();
        for (const preference of before) {
          if (preference.manualWidth === true || !optionsById.has(preference.id)) continue;
          const width = await onComputeAutoFitWidth(preference.id);
          if (isCancelled()) return 'done';
          if (width !== null) widths.set(preference.id, width);
        }
        if (isAutoCalcHeld()) return 'blocked';
        const current = preferencesRef.current.columns;
        if (!sameTaskGridColumns(current, before)) return 'done';
        const after = applyAutoFitWidths(current, widths);
        if (!sameTaskGridColumns(current, after)) onApplyAutoFit(after);
        return 'done';
      },
    });
  }, [autoFitColumns, autoFitPaused, resizing, onApplyAutoFit, onComputeAutoFitWidth, optionsById, surfacePreferences.columns]);

  const autoFitColumn = async (columnId: TaskColumnId) => {
    const option = optionsById.get(columnId);
    if (!option || !onComputeAutoFitWidth || !allowAction()) return;
    const before = cloneColumns(preferencesRef.current.columns);
    const width = await onComputeAutoFitWidth(columnId);
    if (width === null || !sameTaskGridColumns(preferencesRef.current.columns, before)) return;
    const after = resizeTaskGridColumn(before, columnId, width, false);
    if (sameTaskGridColumns(before, after)) return;
    onCommitColumns(labels.history.autoFitColumn(option.label), after);
  };

  return (
    <div
      className="task-grid-shell"
      data-task-grid-surface={surfaceId}
      style={{
        '--task-grid-header-height': `${coreProps.headerHeight}px`,
        '--task-grid-chooser-strip': `${TASK_GRID_CHOOSER_STRIP}px`,
      } as CSSProperties}
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
          const resized = resizeTaskGridColumn(current, columnId, after, true);
          if (!sameTaskGridColumns(current, resized)) {
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
        externalToggleSelector={chooserExternalToggleSelector}
        beforeOpen={allowAction}
        // Dezelfde commitroute als elke andere kolomhandeling: één history-event, direct opgeslagen.
        resetDisabled={sameTaskGridColumns(surfacePreferences.columns, defaultColumns)}
        onReset={() => commitAction(labels.history.resetColumns, () => cloneColumns(defaultColumns))}
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
