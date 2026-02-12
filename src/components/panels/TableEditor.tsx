import { useState, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useI18n } from '@/i18n/i18n';
import { Task, TaskType } from '@/types/task';

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  CONSTRUCTION: 'Bouw',
  INSTALLATION: 'Installatie',
  DEMOLITION: 'Sloop',
  LOGISTIC: 'Logistiek',
  ATTENDANCE: 'Keuring',
  MOVE: 'Verplaatsing',
  RENOVATION: 'Renovatie',
  MAINTENANCE: 'Onderhoud',
  USERDEFINED: 'Overig',
};

export function TableEditor() {
  const { t } = useI18n();
  const tasks = useAppStore(s => s.tasks);
  const updateTask = useAppStore(s => s.updateTask);
  const selectTask = useAppStore(s => s.selectTask);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const collapsedTaskIds = useAppStore(s => s.ui.collapsedTaskIds);
  const toggleCollapse = useAppStore(s => s.toggleCollapse);

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

  const renderCell = (taskId: string, field: string, value: string, _width: string, align = 'left') => {
    const isEditing = editCell?.taskId === taskId && editCell?.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditCell(null); }}
          className="w-full bg-surface border border-accent px-1 py-0.5 text-xs outline-none"
          style={{ textAlign: align as 'left' | 'right' | 'center' }}
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
      {/* Header */}
      <div className="flex border-b border-border bg-surface-alt text-[10px] font-bold uppercase tracking-wider text-text-secondary select-none" style={{ minHeight: 28 }}>
        <div className="w-[60px] px-2 flex items-center">{t('table.wbs')}</div>
        <div className="flex-1 min-w-[200px] px-2 flex items-center">{t('table.name')}</div>
        <div className="w-[60px] px-1 flex items-center justify-end">{t('table.duration')}</div>
        <div className="w-[100px] px-1 flex items-center">{t('table.start')}</div>
        <div className="w-[100px] px-1 flex items-center">{t('table.finish')}</div>
        <div className="w-[80px] px-1 flex items-center">{t('table.type')}</div>
        <div className="w-[50px] px-1 flex items-center justify-center">{t('table.critical')}</div>
        <div className="w-[50px] px-1 flex items-center justify-end">{t('table.totalFloat')}</div>
        <div className="w-[60px] px-1 flex items-center justify-end">{t('table.completion')}</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {flatTasks.map(({ task, depth }) => {
          const isSummary = task.childIds.length > 0;
          const isCollapsed = collapsedTaskIds.includes(task.id);
          const isSelected = selectedTaskIds.includes(task.id);

          return (
            <div
              key={task.id}
              className={`flex border-b border-border text-xs hover:bg-surface-hover cursor-default ${isSelected ? 'bg-accent/20' : ''} ${isSummary ? 'font-semibold' : ''}`}
              style={{ minHeight: 26 }}
              onClick={() => selectTask(task.id)}
            >
              <div className="w-[60px] px-2 flex items-center text-text-secondary">
                {renderCell(task.id, 'wbsCode', task.wbsCode, '60px')}
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
              </div>
              <div className="w-[100px] px-1 flex items-center text-text-secondary">
                {renderCell(task.id, 'finish', task.time.earlyFinish || task.time.scheduleFinish, '100px')}
              </div>
              <div className="w-[80px] px-1 flex items-center text-text-secondary text-[10px]">
                {TASK_TYPE_LABELS[task.taskType] || task.taskType}
              </div>
              <div className="w-[50px] px-1 flex items-center justify-center">
                {task.time.isCritical ? (
                  <span className="text-red-400 font-bold">{t('table.yes')}</span>
                ) : (
                  <span className="text-text-secondary">{t('table.no')}</span>
                )}
              </div>
              <div className="w-[50px] px-1 flex items-center justify-end text-text-secondary">
                {task.time.totalFloat}{t('table.days')}
              </div>
              <div className="w-[60px] px-1 flex items-center justify-end">
                {renderCell(task.id, 'completion', `${Math.round(task.time.completion * 100)}`, '60px', 'right')}
                <span className="text-text-secondary ml-0.5">%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
