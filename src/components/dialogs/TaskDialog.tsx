import { useState, useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { TaskType } from '@/types/task';
import { X } from 'lucide-react';

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'CONSTRUCTION', label: 'Bouw' },
  { value: 'INSTALLATION', label: 'Installatie' },
  { value: 'DEMOLITION', label: 'Sloop' },
  { value: 'LOGISTIC', label: 'Logistiek' },
  { value: 'ATTENDANCE', label: 'Keuring/Inspectie' },
  { value: 'MOVE', label: 'Verplaatsing' },
  { value: 'RENOVATION', label: 'Renovatie' },
  { value: 'MAINTENANCE', label: 'Onderhoud' },
];

export function TaskDialog() {
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

  useEffect(() => {
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
  }, [editingTask, project.startDate]);

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

  // const summaryTasks = tasks.filter(t => t.childIds.length > 0 || !editingTask);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-surface-alt border border-border rounded-lg shadow-xl w-[440px] max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold">
            {editingTask ? 'Taak bewerken' : 'Nieuwe taak'}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-surface-hover rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">Naam *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">Beschrijving</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none h-16 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">WBS Code</label>
              <input
                value={wbsCode}
                onChange={e => setWbsCode(e.target.value)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
                placeholder="bijv. RB-301"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">Type</label>
              <select
                value={taskType}
                onChange={e => setTaskType(e.target.value as TaskType)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              >
                {TASK_TYPES.map(tt => (
                  <option key={tt.value} value={tt.value}>{tt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">Startdatum</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">Duur (werkdagen)</label>
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
            <label className="text-text-secondary">Bovenliggende taak</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
            >
              <option value="">- Geen (root) -</option>
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
            <span>Mijlpaal (nul duur)</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 border border-border rounded hover:bg-surface-hover text-xs"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-1.5 bg-accent text-white rounded hover:bg-accent-hover text-xs disabled:opacity-50"
          >
            {editingTask ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
