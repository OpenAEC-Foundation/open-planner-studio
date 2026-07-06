import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, GripVertical, RotateCcw } from 'lucide-react';
import { defaultColumns } from '@/engine/view/visibleRows';
import type { ColumnConfig, FieldRef } from '@/state/slices/types';

const MIN_COLUMN_WIDTH = 40;

/**
 * Kolommen-dialoog (fase 2.7, §5.5): lijst van alle beschikbare velden (builtin + activity codes +
 * custom fields + resource) met zichtbaar-checkbox, sleep-handle voor volgorde en breedte-input.
 * Live toegepast via `setColumns` (elke wijziging schrijft direct naar de store, zoals de tabel al
 * verwacht — `TableEditor` leest `view.columns` reactief). "Herstel standaard" → `defaultColumns()`.
 */
export function ColumnsDialog() {
  const { t } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const setUI = useAppStore(s => s.setUI);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const viewColumns = useAppStore(s => s.view.columns);
  const setColumns = useAppStore(s => s.setColumns);

  const close = () => setUI({ showColumnsDialog: false });

  const columns = useMemo<ColumnConfig[]>(
    () => viewColumns ?? defaultColumns(activityCodeTypes, customFieldDefs),
    [viewColumns, activityCodeTypes, customFieldDefs],
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

  const patch = (index: number, changes: Partial<ColumnConfig>) => {
    setColumns(columns.map((c, i) => (i === index ? { ...c, ...changes } : c)));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= columns.length || from === to) return;
    const next = columns.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setColumns(next);
  };

  const reset = () => setColumns(defaultColumns(activityCodeTypes, customFieldDefs));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[480px] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('view.columns.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 text-xs">
          {columns.map((col, index) => (
            <div
              key={index}
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
                checked={col.visible}
                onChange={e => patch(index, { visible: e.target.checked })}
                aria-label={t('view.columns.visible')}
                className="accent-accent flex-shrink-0"
              />
              <span className="flex-1 truncate">{label(col.field)}</span>
              <input
                type="number"
                min={MIN_COLUMN_WIDTH}
                value={col.width}
                onChange={e => {
                  const w = Math.max(MIN_COLUMN_WIDTH, parseInt(e.target.value, 10) || MIN_COLUMN_WIDTH);
                  patch(index, { width: w });
                }}
                aria-label={t('view.columns.width')}
                className="input !text-xs !px-1.5 !py-0.5 text-right flex-shrink-0"
                style={{ width: 64, flexShrink: 0 }}
              />
              <span className="text-text-secondary flex-shrink-0" style={{ fontSize: 10 }}>px</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <button onClick={reset} className="btn btn--sm btn--secondary flex items-center gap-1.5">
            <RotateCcw size={12} /> {t('view.columns.resetDefault')}
          </button>
          <button onClick={close} className="btn btn--sm btn--primary">
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
