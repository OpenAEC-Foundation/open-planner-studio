import { useAppStore } from '@/state/appStore';
import { Task, TaskType } from '@/types/task';

import { Trash2 } from 'lucide-react';

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', min, max, step }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      min={min}
      max={max}
      step={step}
      className="w-full px-2 py-1 text-xs bg-surface border border-border rounded focus:border-accent focus:outline-none"
    />
  );
}

export function TaskPropertiesPanel() {
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const removeSequence = useAppStore(s => s.removeSequence);
  const runCPM = useAppStore(s => s.runCPM);

  if (selectedTaskIds.length === 0) {
    return (
      <div className="p-3 text-xs text-text-secondary">
        Selecteer een taak om eigenschappen te bekijken.
      </div>
    );
  }

  if (selectedTaskIds.length > 1) {
    return (
      <div className="p-3 text-xs text-text-secondary">
        {selectedTaskIds.length} taken geselecteerd
      </div>
    );
  }

  const task = tasks.find(t => t.id === selectedTaskIds[0]);
  if (!task) return null;

  const taskSequences = sequences.filter(
    s => s.predecessorId === task.id || s.successorId === task.id
  );

  const update = (updates: Partial<Task>) => {
    updateTask(task.id, updates);
  };

  const updateTime = (key: string, value: string | number) => {
    updateTask(task.id, {
      time: { ...task.time, [key]: value },
    });
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-xs overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm">Taak</span>
        <button
          onClick={() => deleteTask(task.id)}
          className="p-1 hover:bg-red-500/20 rounded text-red-400"
          title="Verwijder taak"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <Field label="Naam">
        <Input value={task.name} onChange={v => update({ name: v })} />
      </Field>

      <Field label="WBS Code">
        <Input value={task.wbsCode} onChange={v => update({ wbsCode: v })} />
      </Field>

      <Field label="Beschrijving">
        <textarea
          value={task.description}
          onChange={e => update({ description: e.target.value })}
          className="w-full px-2 py-1 text-xs bg-surface border border-border rounded focus:border-accent focus:outline-none h-16 resize-none"
        />
      </Field>

      <Field label="Type">
        <select
          value={task.taskType}
          onChange={e => update({ taskType: e.target.value as TaskType })}
          className="w-full px-2 py-1 text-xs bg-surface border border-border rounded focus:border-accent focus:outline-none"
        >
          {TASK_TYPES.map(tt => (
            <option key={tt.value} value={tt.value}>{tt.label}</option>
          ))}
        </select>
      </Field>

      <div className="flex gap-2">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={task.isMilestone}
            onChange={e => update({ isMilestone: e.target.checked })}
            className="accent-accent"
          />
          Mijlpaal
        </label>
      </div>

      <div className="h-px bg-border" />

      <span className="font-bold">Tijd</span>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Start">
          <Input
            type="date"
            value={task.time.scheduleStart}
            onChange={v => updateTime('scheduleStart', v)}
          />
        </Field>
        <Field label="Duur (dagen)">
          <Input
            type="number"
            value={task.time.scheduleDuration}
            onChange={v => updateTime('scheduleDuration', parseInt(v) || 0)}
            min={0}
          />
        </Field>
      </div>

      <Field label="Voortgang (%)">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(task.time.completion * 100)}
            onChange={e => updateTime('completion', parseInt(e.target.value) / 100)}
            className="flex-1 accent-accent"
          />
          <span className="w-8 text-right">{Math.round(task.time.completion * 100)}%</span>
        </div>
      </Field>

      {task.time.isCritical !== undefined && (
        <>
          <div className="h-px bg-border" />
          <span className="font-bold">CPM Resultaat</span>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-text-secondary">Vroegste start:</span>
            <span>{task.time.earlyStart}</span>
            <span className="text-text-secondary">Vroegste einde:</span>
            <span>{task.time.earlyFinish}</span>
            <span className="text-text-secondary">Laatste start:</span>
            <span>{task.time.lateStart}</span>
            <span className="text-text-secondary">Laatste einde:</span>
            <span>{task.time.lateFinish}</span>
            <span className="text-text-secondary">Totale speling:</span>
            <span>{task.time.totalFloat} dagen</span>
            <span className="text-text-secondary">Vrije speling:</span>
            <span>{task.time.freeFloat} dagen</span>
            <span className="text-text-secondary">Kritiek pad:</span>
            <span className={task.time.isCritical ? 'text-critical font-bold' : ''}>
              {task.time.isCritical ? 'Ja' : 'Nee'}
            </span>
          </div>
        </>
      )}

      {taskSequences.length > 0 && (
        <>
          <div className="h-px bg-border" />
          <span className="font-bold">Dependencies</span>
          {taskSequences.map(seq => {
            const other = seq.predecessorId === task.id
              ? tasks.find(t => t.id === seq.successorId)
              : tasks.find(t => t.id === seq.predecessorId);
            const role = seq.predecessorId === task.id ? '→' : '←';
            return (
              <div key={seq.id} className="flex items-center gap-1 text-[10px]">
                <span>{role}</span>
                <span className="flex-1 truncate">{other?.name || '?'}</span>
                <span className="text-text-secondary">{seq.type.replace('_', '-')}</span>
                {seq.lagDays > 0 && <span>+{seq.lagDays}d</span>}
                <button
                  onClick={() => removeSequence(seq.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </>
      )}

      <button
        onClick={runCPM}
        className="mt-2 px-3 py-1.5 bg-accent text-white rounded hover:bg-accent-hover text-xs"
      >
        CPM Herberekenen
      </button>
    </div>
  );
}
