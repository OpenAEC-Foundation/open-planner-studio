import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, GripVertical, RotateCcw, Plus } from 'lucide-react';
import { Dialog } from '@/components/common/Dialog';
import { FILTER_SORT_BUILTIN_KEYS } from '@/components/viewControls/fieldCatalog';
import {
  createDefaultTaskGridPreferences,
  fieldRefToTaskColumnId,
  TASK_GRID_COLUMN_MAX_WIDTH,
  TASK_GRID_COLUMN_MIN_WIDTH,
  taskColumnIdToLegacyFieldRef,
} from '@/engine/taskGrid/preferences';
import type { FieldRef } from '@/state/slices/types';
import type { TaskColumnId, TaskGridColumnPreference } from '@/types/taskGrid';

/** Redelijke default-breedte voor een pas toegevoegd legacyveld (px). */
function defaultWidthFor(field: FieldRef): number {
  if (field.src === 'resource') return 140;
  if (field.src === 'activityCode' || field.src === 'customField') return 90;
  switch (field.key) {
    case 'name': return 240;
    case 'start':
    case 'finish': return 100;
    case 'taskType':
    case 'completion':
    case 'duration': return 80;
    default: return 60; // wbsCode/isCritical/totalFloat/isMilestone + de 2.9-analysevelden
  }
}

/**
 * Kolommen-dialoog (fase 2.7 §5.5, uitgebreid fase 2.9): boven de reeds gekozen kolommen (zichtbaar-
 * checkbox, sleep-handle voor volgorde, breedte-input); daaronder een "Beschikbare velden"-lijst met
 * ELK builtin-veld (`FILTER_SORT_BUILTIN_KEYS`, incl. de vier 2.9-analysevelden) plus activity codes,
 * eigen velden en resource dat nog GEEN kolom is — aanvinken voegt het als kolom toe. Zo zijn ook niet-
 * default-velden toevoegbaar zonder een hardcoded lijst. Live toegepast op de persoonlijke
 * `full-task-grid`-voorkeur; het actieve project wordt daardoor nooit dirty. Onbekende of voor het
 * huidige project niet-beschikbare ids blijven zichtbaar als opaque id en worden niet stil gewist.
 */
export function ColumnsDialog() {
  const { t } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const setUI = useAppStore(s => s.setUI);
  const projectId = useAppStore(s => s.project.id);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const columns = useAppStore(s => s.taskGridSurfaces['full-task-grid'].columns);
  const setColumns = useAppStore(s => s.setTaskGridColumns);

  const close = () => setUI({ showColumnsDialog: false });

  const projectFields = useMemo(() => ({
    projectId,
    activityCodeTypeIds: activityCodeTypes.map(type => type.id),
    customFieldDefIds: customFieldDefs.map(def => def.id),
  }), [projectId, activityCodeTypes, customFieldDefs]);

  const selectedColumns = useMemo(
    () => columns.map(preference => ({
      preference,
      field: taskColumnIdToLegacyFieldRef(preference.id, projectFields),
    })),
    [columns, projectFields],
  );

  // Alle beschikbare velden (builtin-catalogus + user-data + resource). Wat al kolom is, valt weg uit
  // de "toevoegen"-lijst; de rest is aanvinkbaar om als kolom toe te voegen.
  const availableFields = useMemo<FieldRef[]>(
    () => [
      ...FILTER_SORT_BUILTIN_KEYS.map((key): FieldRef => ({ src: 'builtin', key })),
      ...activityCodeTypes.map((ct): FieldRef => ({ src: 'activityCode', typeId: ct.id })),
      ...customFieldDefs.map((d): FieldRef => ({ src: 'customField', defId: d.id })),
      { src: 'resource' },
    ],
    [activityCodeTypes, customFieldDefs],
  );

  const addable = useMemo<Array<{ id: TaskColumnId; field: FieldRef }>>(
    () => availableFields.flatMap(field => {
      const id = fieldRefToTaskColumnId(field, projectId);
      return id && !columns.some(column => column.id === id) ? [{ id, field }] : [];
    }),
    [availableFields, columns, projectId],
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const label = (field: FieldRef): string => {
    if (field.src === 'builtin') {
      switch (field.key) {
        case 'wbsCode': return tTask('table.wbs');
        case 'name': return tTask('table.name');
        case 'duration': return tTask('table.duration');
        case 'start': return tTask('table.start');
        case 'finish': return tTask('table.finish');
        case 'taskType': return tTask('table.type');
        case 'isCritical': return tTask('table.critical');
        case 'totalFloat': return tTask('table.totalFloat');
        case 'completion': return tTask('table.completion');
        case 'isMilestone': return tTask('table.milestone');
        case 'freeFloat': return tTask('table.freeFloat');                 // fase 2.9 (§3.5)
        case 'interferingFloat': return tTask('table.interferingFloat');   // fase 2.9 (§3.5)
        case 'isNearCritical': return tTask('table.isNearCritical');       // fase 2.9 (§3.5)
        case 'floatPath': return tTask('table.floatPath');                 // fase 2.9 (§3.5)
        default: return field.key;
      }
    }
    if (field.src === 'activityCode') return activityCodeTypes.find(ct => ct.id === field.typeId)?.name ?? field.typeId;
    if (field.src === 'customField') return customFieldDefs.find(d => d.id === field.defId)?.name ?? field.defId;
    return tTask('column.resource');
  };

  const saveColumns = (next: readonly TaskGridColumnPreference[]) => {
    setColumns('full-task-grid', next);
  };

  const patch = (index: number, changes: Partial<TaskGridColumnPreference>) => {
    saveColumns(columns.map((column, i) => (i === index ? { ...column, ...changes } : column)));
  };

  const remove = (index: number) => {
    saveColumns(columns.filter((_, i) => i !== index));
  };

  const add = (id: TaskColumnId, field: FieldRef) => {
    saveColumns([...columns, { id, width: defaultWidthFor(field), pinned: false }]);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= columns.length || from === to) return;
    const next = columns.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    saveColumns(next);
  };

  const reset = () => saveColumns(createDefaultTaskGridPreferences(projectFields)
    .surfaces['full-task-grid'].columns);

  return (
    // Let op: deze dialoog had bewust GEEN Escape-afhandeling — daarom geen `onCancel`.
    <Dialog
      onBackdropClick={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[480px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-columns-dialog': true }}
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('view.columns.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        {/* Deze overgangsdialoog stuurt alleen de persoonlijke full-task-grid-voorkeur. De
            afzonderlijke Gantt-surface krijgt later zijn eigen gedeelde kolomkiezer. */}
        <div className="px-4 pt-3 text-[11px] text-text-secondary">
          {t('view.columns.scopeHint')}
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 text-xs">
          {selectedColumns.map(({ preference: col, field }, index) => (
            <div
              key={col.id}
              draggable
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIndex(index); }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-[8px] hover:bg-surface-hover"
              style={{ opacity: dragIndex === index ? 0.4 : 1 }}
            >
              <span className="cursor-grab text-text-secondary flex-shrink-0" title={t('view.columns.title')}>
                <GripVertical size={14} />
              </span>
              <input
                type="checkbox"
                checked
                onChange={e => { if (!e.target.checked) remove(index); }}
                aria-label={t('view.columns.visible')}
                className="accent-accent flex-shrink-0"
              />
              <span className="flex-1 truncate" title={field ? undefined : col.id}>
                {field ? label(field) : col.id}
              </span>
              <input
                type="number"
                min={TASK_GRID_COLUMN_MIN_WIDTH}
                max={TASK_GRID_COLUMN_MAX_WIDTH}
                value={col.width}
                onChange={e => {
                  const w = Math.max(TASK_GRID_COLUMN_MIN_WIDTH,
                    parseInt(e.target.value, 10) || TASK_GRID_COLUMN_MIN_WIDTH);
                  patch(index, { width: w });
                }}
                aria-label={t('view.columns.width')}
                className="input !text-xs !px-1.5 !py-0.5 text-right flex-shrink-0"
                style={{ width: 64, flexShrink: 0 }}
              />
              <span className="text-text-secondary flex-shrink-0" style={{ fontSize: 'calc(10px * var(--ui-font-scale, 1))' }}>px</span>
            </div>
          ))}

          {addable.length > 0 && (
            <>
              <div className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                {t('view.columns.available')}
              </div>
              {addable.map(({ id, field }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => add(id, field)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-[8px] hover:bg-surface-hover text-left"
                  data-ops-columns-add={field.src === 'builtin' ? field.key : field.src}
                >
                  <span className="flex-shrink-0 text-text-secondary"><Plus size={14} /></span>
                  <span className="flex-1 truncate text-text-secondary">{label(field)}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <button onClick={reset} className="btn btn--sm btn--secondary flex items-center gap-1.5">
            <RotateCcw size={12} /> {t('view.columns.resetDefault')}
          </button>
          <button onClick={close} className="btn btn--sm btn--primary">
            {t('close')}
          </button>
        </div>
    </Dialog>
  );
}
