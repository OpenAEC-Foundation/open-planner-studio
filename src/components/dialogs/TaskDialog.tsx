import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { TaskType } from '@/types/task';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { X } from 'lucide-react';

export function TaskDialog() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const { options: taskTypeOptions } = useTaskTypeLabels();

  const showTaskDialog = useAppStore(s => s.ui.showTaskDialog);
  const editingTaskId = useAppStore(s => s.ui.editingTaskId);
  const tasks = useAppStore(s => s.tasks);
  const setUI = useAppStore(s => s.setUI);
  const addTask = useAppStore(s => s.addTask);
  const updateTask = useAppStore(s => s.updateTask);
  const project = useAppStore(s => s.project);

  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [wbsCode, setWbsCode] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('CONSTRUCTION');
  const [isMilestone, setIsMilestone] = useState(false);
  const [duration, setDuration] = useState(5);
  const [startDate, setStartDate] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showTaskDialog) return;

    if (editingTask) {
      setName(editingTask.name);
      setDescription(editingTask.description);
      setWbsCode(editingTask.wbsCode);
      setTaskType(editingTask.taskType);
      setIsMilestone(editingTask.isMilestone);
      setDuration(editingTask.time.scheduleDuration);
      setStartDate(editingTask.time.scheduleStart);
      setParentId(editingTask.parentId || '');
    } else {
      setName('');
      setDescription('');
      setWbsCode('');
      setTaskType('CONSTRUCTION');
      setIsMilestone(false);
      setDuration(5);
      setStartDate(project.startDate);
      setParentId('');
    }

  }, [showTaskDialog, editingTaskId, editingTask, project.startDate]);

  useEffect(() => {
    if (!showTaskDialog) return;
    const id = setTimeout(() => {
      const el = nameInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(0, el.value.length);
    }, 30);
    return () => clearTimeout(id);
  }, [showTaskDialog, editingTaskId]);

  // Esc sluit dialog (LAYOUTS.md §3.3 keyboard support)
  useEffect(() => {
    if (!showTaskDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUI({ showTaskDialog: false, editingTaskId: null });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showTaskDialog, setUI]);

  if (!showTaskDialog) return null;

  const handleSave = () => {
    if (!name.trim()) return;

    if (editingTask) {
      updateTask(editingTask.id, {
        name,
        description,
        wbsCode,
        taskType,
        isMilestone,
        time: {
          ...editingTask.time,
          scheduleDuration: isMilestone ? 0 : duration,
          scheduleStart: startDate,
        },
      });
    } else {
      addTask({
        name,
        description,
        wbsCode,
        taskType,
        isMilestone,
        parentId: parentId || null,
        time: {
          durationType: 'WORKTIME',
          scheduleDuration: isMilestone ? 0 : duration,
          scheduleStart: startDate,
          scheduleFinish: startDate,
          earlyStart: startDate,
          earlyFinish: startDate,
          lateStart: startDate,
          lateFinish: startDate,
          freeFloat: 0,
          totalFloat: 0,
          isCritical: false,
          completion: 0,
        },
      });
    }

    setUI({ showTaskDialog: false, editingTaskId: null });
  };

  const handleClose = () => {
    setUI({ showTaskDialog: false, editingTaskId: null });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-surface-alt border border-border rounded-lg shadow-xl w-[560px] max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold">
            {editingTask ? t('dialog.editTitle') : t('dialog.newTitle')}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-surface-hover rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.nameRequired')}</label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none h-16 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.wbsCode')}</label>
              <input
                value={wbsCode}
                onChange={e => setWbsCode(e.target.value)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
                placeholder={t('dialog.wbsPlaceholder')}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.type')}</label>
              <select
                value={taskType}
                onChange={e => setTaskType(e.target.value as TaskType)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              >
                {taskTypeOptions.map(tt => (
                  <option key={tt.value} value={tt.value}>{tt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.duration')}</label>
              <input
                type="number"
                value={isMilestone ? 0 : duration}
                onChange={e => setDuration(parseInt(e.target.value) || 0)}
                disabled={isMilestone}
                min={0}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.parentTask')}</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
            >
              <option value="">{t('dialog.noParent')}</option>
              {tasks
                .filter(t => t.id !== editingTaskId)
                .map(t => (
                  <option key={t.id} value={t.id}>{t.wbsCode ? `${t.wbsCode} — ` : ''}{t.name}</option>
                ))}
            </select>
          </div>

          <label className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={isMilestone}
              onChange={e => setIsMilestone(e.target.checked)}
              className="accent-accent"
            />
            <span>{t('dialog.milestone')}</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border">
          <button onClick={handleClose} className="btn btn--sm btn--secondary">
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="btn btn--sm btn--primary"
          >
            {editingTask ? tCommon('save') : tCommon('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
