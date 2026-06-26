import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { TaskType } from '@/types/task';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { Select } from '@/components/common/Select';
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
      // Toon de berekende start (consistent met tabel/Gantt); scheduleStart is de geplande anker.
      setStartDate(editingTask.time.earlyStart || editingTask.time.scheduleStart);
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
      // scheduleStart (de geplande anker) alléén bijwerken als de gebruiker de startdatum
      // daadwerkelijk wijzigde — anders zou opslaan de berekende start als nieuw anker vastleggen
      // en de drift na herberekenen herintroduceren.
      const shownStart = editingTask.time.earlyStart || editingTask.time.scheduleStart;
      const time = {
        ...editingTask.time,
        scheduleDuration: isMilestone ? 0 : duration,
        ...(startDate !== shownStart ? { scheduleStart: startDate } : {}),
      };
      updateTask(editingTask.id, {
        name,
        description,
        wbsCode,
        taskType,
        isMilestone,
        time,
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

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {editingTask ? t('dialog.editTitle') : t('dialog.newTitle')}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 text-xs overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.nameRequired')}</label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={`${inputCls} h-16 resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.wbsCode')}</label>
              <input
                value={wbsCode}
                onChange={e => setWbsCode(e.target.value)}
                className={inputCls}
                placeholder={t('dialog.wbsPlaceholder')}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.type')}</label>
              <Select
                aria-label={t('dialog.type')}
                value={taskType}
                onChange={v => setTaskType(v as TaskType)}
                options={taskTypeOptions.map(tt => ({ value: tt.value, label: tt.label }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={inputCls}
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
                className={`${inputCls} disabled:opacity-50`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.parentTask')}</label>
            <Select
              aria-label={t('dialog.parentTask')}
              value={parentId}
              onChange={setParentId}
              options={[
                { value: '', label: t('dialog.noParent') },
                ...tasks
                  .filter(t => t.id !== editingTaskId)
                  .map(t => ({
                    value: t.id,
                    label: `${t.wbsCode ? `${t.wbsCode} — ` : ''}${t.name}`,
                  })),
              ]}
            />
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
            className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
          >
            {editingTask ? tCommon('save') : tCommon('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
