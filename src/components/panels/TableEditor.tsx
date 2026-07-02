import { useState, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { groupTasksByCode } from '@/utils/grouping';
import { useTaskTypeLabels } from '@/i18n/taskTypes';

/** Compacte, altijd-bewerkbare celvariant voor een custom field (tabelrij). */
function FieldCell({ def, value, onCommit }: {
  def: CustomFieldDef;
  value: CustomFieldValue | undefined;
  onCommit: (value: CustomFieldValue | null) => void;
}) {
  const cls = 'input !text-[10px] !px-1 !py-0.5 w-full';
  if (def.type === 'boolean') {
    return (
      <input type="checkbox" checked={value === true}
        onChange={e => onCommit(e.target.checked ? true : null)}
        onClick={e => e.stopPropagation()}
        className="w-3.5 h-3.5 accent-[var(--theme-accent)]" />
    );
  }
  if (def.type === 'date') {
    return (
      <input type="date" value={typeof value === 'string' ? value : ''}
        onChange={e => onCommit(e.target.value || null)}
        onClick={e => e.stopPropagation()} className={cls} />
    );
  }
  if (def.type === 'text') {
    return (
      <input value={typeof value === 'string' ? value : ''}
        onChange={e => onCommit(e.target.value || null)}
        onClick={e => e.stopPropagation()} className={cls} />
    );
  }
  return (
    <input type="number" step={def.type === 'integer' ? 1 : 'any'}
      value={typeof value === 'number' ? value : ''}
      onChange={e => {
        const raw = e.target.value;
        if (raw === '') { onCommit(null); return; }
        const n = def.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isFinite(n)) onCommit(n);
      }}
      onClick={e => e.stopPropagation()} className={cls + ' text-right'} />
  );
}

export function TableEditor() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const { labels: taskTypeLabels } = useTaskTypeLabels();
  const tasks = useAppStore(s => s.tasks);
  const updateTask = useAppStore(s => s.updateTask);
  const selectTask = useAppStore(s => s.selectTask);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const collapsedTaskIds = useAppStore(s => s.ui.collapsedTaskIds);
  const toggleCollapse = useAppStore(s => s.toggleCollapse);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const groupBy = useAppStore(s => s.view.groupBy);
  const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
  const setTaskActivityCode = useAppStore(s => s.setTaskActivityCode);
  const setTaskCustomField = useAppStore(s => s.setTaskCustomField);

  const [editCell, setEditCell] = useState<{ taskId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Flatten tasks respecting collapse state
  const flatTasks: { task: Task; depth: number }[] = [];
  const addRecursive = (task: Task, depth: number) => {
    flatTasks.push({ task, depth });
    if (collapsedTaskIds.includes(task.id)) return;
    const children = tasks.filter(t => t.parentId === task.id);
    for (const child of children) {
      addRecursive(child, depth + 1);
    }
  };
  const roots = tasks.filter(t => !t.parentId);
  for (const root of roots) addRecursive(root, 0);
  for (const task of tasks) {
    if (!flatTasks.find(ft => ft.task.id === task.id)) {
      flatTasks.push({ task, depth: 0 });
    }
  }

  // Groeperingsweergave (fase 2.2): banden per codewaarde vervangen de boom;
  // zelfde util als de Gantt-renderer zodat beide weergaven identiek groeperen.
  type Row = { band: { label: string; color?: string } } | { task: Task; depth: number };
  const groupType = groupBy ? activityCodeTypes.find(ct => ct.id === groupBy) : undefined;
  const rows: Row[] = [];
  if (groupType) {
    const byId = new Map(tasks.map(t2 => [t2.id, t2]));
    for (const g of groupTasksByCode(tasks, groupType, t('structure.none'))) {
      rows.push({ band: { label: g.label, color: g.color } });
      for (const id of g.taskIds) {
        const task = byId.get(id);
        if (task) rows.push({ task, depth: 0 });
      }
    }
  } else {
    rows.push(...flatTasks);
  }

  const startEdit = useCallback((taskId: string, field: string, value: string) => {
    setEditCell({ taskId, field });
    setEditValue(value);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editCell) return;
    const { taskId, field } = editCell;
    const task = tasks.find(t => t.id === taskId);
    if (!task) { setEditCell(null); return; }

    if (field === 'name') {
      updateTask(taskId, { name: editValue });
    } else if (field === 'wbsCode') {
      updateTask(taskId, { wbsCode: editValue });
    } else if (field === 'duration') {
      updateTask(taskId, { time: { ...task.time, scheduleDuration: parseInt(editValue) || 0 } });
    } else if (field === 'start') {
      updateTask(taskId, { time: { ...task.time, scheduleStart: editValue } });
    } else if (field === 'finish') {
      updateTask(taskId, { time: { ...task.time, scheduleFinish: editValue } });
    } else if (field === 'completion') {
      updateTask(taskId, { time: { ...task.time, completion: (parseInt(editValue) || 0) / 100 } });
    }
    setEditCell(null);
  }, [editCell, editValue, tasks, updateTask]);

  const editableFields = ['wbsCode', 'name', 'duration', 'start', 'finish', 'completion'];

  const navigateCell = useCallback((taskId: string, field: string, direction: 'up' | 'down' | 'left' | 'right') => {
    commitEdit();
    const rowIndex = flatTasks.findIndex(ft => ft.task.id === taskId);
    const colIndex = editableFields.indexOf(field);
    if (rowIndex === -1 || colIndex === -1) return;

    let newRow = rowIndex;
    let newCol = colIndex;

    if (direction === 'up') newRow = Math.max(0, rowIndex - 1);
    else if (direction === 'down') newRow = Math.min(flatTasks.length - 1, rowIndex + 1);
    else if (direction === 'left') newCol = Math.max(0, colIndex - 1);
    else if (direction === 'right') newCol = Math.min(editableFields.length - 1, colIndex + 1);

    if (newRow === rowIndex && newCol === colIndex) return;

    const nextTask = flatTasks[newRow].task;
    const nextField = editableFields[newCol];
    const nextValue = getCellValue(nextTask, nextField);
    selectTask(nextTask.id);
    startEdit(nextTask.id, nextField, nextValue);
  }, [flatTasks, commitEdit, selectTask, startEdit]);

  const getCellValue = (task: Task, field: string): string => {
    if (field === 'name') return task.name;
    if (field === 'wbsCode') return task.wbsCode;
    if (field === 'duration') return `${task.time.scheduleDuration}`;
    if (field === 'start') return task.time.earlyStart || task.time.scheduleStart;
    if (field === 'finish') return task.time.earlyFinish || task.time.scheduleFinish;
    if (field === 'completion') return `${Math.round(task.time.completion * 100)}`;
    return '';
  };

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, taskId: string, field: string) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      navigateCell(taskId, field, 'down');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateCell(taskId, field, 'up');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      navigateCell(taskId, field, e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      setEditCell(null);
    }
  }, [navigateCell]);

  const renderCell = (taskId: string, field: string, value: string, _width: string, align = 'left') => {
    const isEditing = editCell?.taskId === taskId && editCell?.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => handleCellKeyDown(e, taskId, field)}
          className="w-full px-1 py-0.5 text-xs outline-none"
          style={{
            textAlign: align as 'left' | 'right' | 'center',
            background: 'var(--theme-input-bg)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-accent)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.20)',
          }}
        />
      );
    }
    return (
      <span
        className="block truncate cursor-text px-1"
        style={{ textAlign: align as 'left' | 'right' | 'center' }}
        onDoubleClick={() => startEdit(taskId, field, value)}
      >
        {value}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface">
      {/* Header — sticky thead per LAYOUTS.md §3.2 */}
      <div
        className="sticky top-0 z-10 flex bg-surface-alt text-[10px] font-bold uppercase tracking-wider select-none"
        style={{
          minHeight: 28,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
          color: 'var(--theme-text-muted)',
          borderBottom: '1px solid var(--theme-border)',
        }}
      >
        <div className="w-[60px] px-2 flex items-center">{t('table.wbs')}</div>
        <div className="flex-1 min-w-[200px] px-2 flex items-center">{t('table.name')}</div>
        <div className="w-[60px] px-1 flex items-center justify-end">{t('table.duration')}</div>
        <div className="w-[100px] px-1 flex items-center">{t('table.start')}</div>
        <div className="w-[100px] px-1 flex items-center">{t('table.finish')}</div>
        <div className="w-[80px] px-1 flex items-center">{t('table.type')}</div>
        <div className="w-[50px] px-1 flex items-center justify-center">{t('table.critical')}</div>
        <div className="w-[50px] px-1 flex items-center justify-end">{t('table.totalFloat')}</div>
        <div className="w-[60px] px-1 flex items-center justify-end">{t('table.completion')}</div>
        {activityCodeTypes.map(ct => (
          <div key={ct.id} className="w-[90px] px-1 flex items-center">{ct.name}</div>
        ))}
        {customFieldDefs.map(def => (
          <div key={def.id} className="w-[90px] px-1 flex items-center">{def.name}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.map((row, rowIdx) => {
          if ('band' in row) {
            return (
              <div
                key={`band-${rowIdx}`}
                className="flex items-center gap-2 text-xs font-semibold px-2"
                style={{
                  minHeight: 26,
                  background: (row.band.color ?? 'var(--theme-border)') + '1A',
                  borderBottom: '1px solid var(--theme-border-light)',
                }}
              >
                {row.band.color && (
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: row.band.color }} />
                )}
                {row.band.label}
              </div>
            );
          }
          const { task, depth } = row;
          const isSummary = task.childIds.length > 0;
          const isCollapsed = collapsedTaskIds.includes(task.id);
          const isSelected = selectedTaskIds.includes(task.id);

          return (
            <div
              key={task.id}
              className={`flex text-xs hover:bg-surface-hover cursor-default ${isSummary ? 'font-semibold' : ''}`}
              style={{
                minHeight: 26,
                borderBottom: '1px solid var(--theme-border-light)',
                ...(isSelected
                  ? {
                      background: 'var(--theme-accent-soft, rgba(217,119,6,.10))',
                      boxShadow: 'inset 2px 0 0 var(--theme-accent)',
                    }
                  : {}),
              }}
              onClick={() => selectTask(task.id)}
            >
              <div className="w-[60px] px-2 flex items-center text-text-secondary">
                {wbsAutoNumber
                  ? <span className="px-1 truncate">{task.wbsCode}</span>
                  : renderCell(task.id, 'wbsCode', task.wbsCode, '60px')}
              </div>
              <div className="flex-1 min-w-[200px] px-2 flex items-center gap-1" style={{ paddingLeft: 8 + depth * 16 }}>
                {isSummary && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleCollapse(task.id); }}
                    className="w-4 h-4 flex items-center justify-center text-text-secondary hover:text-text-primary flex-shrink-0"
                  >
                    {isCollapsed ? '\u25B6' : '\u25BC'}
                  </button>
                )}
                {!isSummary && <span className="w-4" />}
                <span className="flex-1 min-w-0">
                  {renderCell(task.id, 'name', task.name, 'auto')}
                </span>
              </div>
              <div className="w-[60px] px-1 flex items-center justify-end">
                {renderCell(task.id, 'duration', `${task.time.scheduleDuration}`, '60px', 'right')}
              </div>
              <div className="w-[100px] px-1 flex items-center text-text-secondary">
                {renderCell(task.id, 'start', task.time.earlyStart || task.time.scheduleStart, '100px')}
                {task.constraint && ['SNET', 'SNLT', 'MSO'].includes(task.constraint.type) && (
                  <span title={t('properties.hasConstraint')} style={{ color: 'var(--theme-accent)' }}>*</span>
                )}
              </div>
              <div className="w-[100px] px-1 flex items-center text-text-secondary">
                {renderCell(task.id, 'finish', task.time.earlyFinish || task.time.scheduleFinish, '100px')}
                {task.constraint && ['FNET', 'FNLT', 'MFO'].includes(task.constraint.type) && (
                  <span title={t('properties.hasConstraint')} style={{ color: 'var(--theme-accent)' }}>*</span>
                )}
              </div>
              <div className="w-[80px] px-1 flex items-center text-text-secondary text-[10px]">
                {taskTypeLabels[task.taskType] || task.taskType}
              </div>
              <div className="w-[50px] px-1 flex items-center justify-center">
                {task.time.isCritical ? (
                  <span className="text-critical font-bold">{tCommon('yes')}</span>
                ) : (
                  <span className="text-text-secondary">{tCommon('no')}</span>
                )}
              </div>
              <div
                className="w-[50px] px-1 flex items-center justify-end"
                style={task.time.totalFloat < 0 ? { color: 'var(--error)', fontWeight: 600 } : undefined}
              >
                <span className={task.time.totalFloat < 0 ? '' : 'text-text-secondary'}>
                  {task.time.totalFloat}{tCommon('days')}
                </span>
              </div>
              <div className="w-[60px] px-1 flex items-center justify-end">
                {renderCell(task.id, 'completion', `${Math.round(task.time.completion * 100)}`, '60px', 'right')}
                <span className="text-text-secondary ml-0.5">%</span>
              </div>
              {activityCodeTypes.map(ct => (
                <div key={ct.id} className="w-[90px] px-1 flex items-center">
                  {!isSummary && (
                    <select
                      value={task.activityCodes?.[ct.id] ?? ''}
                      onChange={e => setTaskActivityCode(task.id, ct.id, e.target.value || null)}
                      onClick={e => e.stopPropagation()}
                      className="input !text-[10px] !px-1 !py-0.5 w-full"
                    >
                      <option value=""></option>
                      {ct.values.map(v => (
                        <option key={v.id} value={v.id}>{v.code}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              {customFieldDefs.map(def => (
                <div key={def.id} className="w-[90px] px-1 flex items-center">
                  {!isSummary && (
                    <FieldCell
                      def={def}
                      value={task.customFields?.[def.id]}
                      onCommit={value => setTaskCustomField(task.id, def.id, value)}
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
