import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task, TaskType } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { formatLagShort, parseLagInput } from '@/utils/lagFormat';
import { Select } from '@/components/common/Select';
import { Trash2, Zap } from 'lucide-react';

const SEQUENCE_TYPE_OPTIONS: { value: SequenceType; label: string }[] = [
  { value: 'FINISH_START', label: 'FS' },
  { value: 'START_START', label: 'SS' },
  { value: 'FINISH_FINISH', label: 'FF' },
  { value: 'START_FINISH', label: 'SF' },
];

/** Klein lag-invoerveld met MSP-notatie (2d/3ed/50%/-25e%); commit op blur/Enter, herstel bij onzin. */
function SequenceLagInput({ seq, title, onCommit }: {
  seq: Sequence;
  title: string;
  onCommit: (patch: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent'>) => void;
}) {
  const [val, setVal] = useState(formatLagShort(seq));
  useEffect(() => {
    setVal(formatLagShort(seq));
  }, [seq.lagDays, seq.lagUnit, seq.lagPercent]);
  const commit = () => {
    const parsed = parseLagInput(val);
    if (parsed) {
      onCommit(parsed);
      setVal(formatLagShort(parsed as Sequence));
    } else {
      setVal(formatLagShort(seq));
    }
  };
  return (
    <input
      value={val}
      title={title}
      placeholder="0d"
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="input !text-[10px] !px-1 !py-0.5 w-14 text-right"
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[10px] uppercase tracking-wide"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        {label}
      </label>
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
      className="input !text-xs !px-2.5 !py-1.5"
    />
  );
}

export function TaskPropertiesPanel() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const { options: taskTypeOptions } = useTaskTypeLabels();

  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const cpmResult = useAppStore(s => s.cpmResult);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const updateSequence = useAppStore(s => s.updateSequence);
  const removeSequence = useAppStore(s => s.removeSequence);
  const runCPM = useAppStore(s => s.runCPM);

  if (selectedTaskIds.length === 0) {
    return (
      <div className="p-3 text-xs text-text-secondary">
        {t('properties.selectPrompt')}
      </div>
    );
  }

  if (selectedTaskIds.length > 1) {
    return (
      <div className="p-3 text-xs text-text-secondary">
        {t('properties.multiSelect', { count: selectedTaskIds.length })}
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
        <span className="ui-card-header !text-xs">{t('properties.task')}</span>
        <button
          onClick={() => deleteTask(task.id)}
          className="p-1 rounded"
          style={{ color: 'var(--error)' }}
          title={t('properties.deleteTask')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <Field label={t('properties.name')}>
        <Input value={task.name} onChange={v => update({ name: v })} />
      </Field>

      <Field label={t('properties.wbsCode')}>
        <Input value={task.wbsCode} onChange={v => update({ wbsCode: v })} />
      </Field>

      <Field label={t('properties.description')}>
        <textarea
          value={task.description}
          onChange={e => update({ description: e.target.value })}
          className="input !text-xs !px-2.5 !py-1.5 h-16 resize-none"
        />
      </Field>

      <Field label={t('properties.type')}>
        <Select
          aria-label={t('properties.type')}
          value={task.taskType}
          onChange={v => update({ taskType: v as TaskType })}
          options={taskTypeOptions.map(tt => ({ value: tt.value, label: tt.label }))}
        />
      </Field>

      <div className="flex gap-2">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={task.isMilestone}
            onChange={e => update({ isMilestone: e.target.checked })}
            className="accent-accent"
          />
          {t('properties.milestone')}
        </label>
      </div>

      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />

      <span className="ui-card-header !text-xs">{t('properties.time')}</span>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('properties.start')}>
          <Input
            type="date"
            value={task.time.scheduleStart}
            onChange={v => updateTime('scheduleStart', v)}
          />
        </Field>
        <Field label={t('properties.duration')}>
          <Input
            type="number"
            value={task.time.scheduleDuration}
            onChange={v => updateTime('scheduleDuration', parseInt(v) || 0)}
            min={0}
          />
        </Field>
      </div>

      <Field label={t('properties.completion')}>
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
          <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
          <span className="ui-card-header !text-xs">{t('properties.cpmResult')}</span>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-text-secondary">{t('properties.earlyStart')}</span>
            <span>{task.time.earlyStart}</span>
            <span className="text-text-secondary">{t('properties.earlyFinish')}</span>
            <span>{task.time.earlyFinish}</span>
            <span className="text-text-secondary">{t('properties.lateStart')}</span>
            <span>{task.time.lateStart}</span>
            <span className="text-text-secondary">{t('properties.lateFinish')}</span>
            <span>{task.time.lateFinish}</span>
            <span className="text-text-secondary">{t('properties.totalFloat')}</span>
            <span>{task.time.totalFloat} {tCommon('daysLong')}</span>
            <span className="text-text-secondary">{t('properties.freeFloat')}</span>
            <span>{task.time.freeFloat} {tCommon('daysLong')}</span>
            <span className="text-text-secondary">{t('properties.criticalPath')}</span>
            <span className={task.time.isCritical ? 'text-critical font-bold' : ''}>
              {task.time.isCritical ? tCommon('yes') : tCommon('no')}
            </span>
          </div>
        </>
      )}

      {taskSequences.length > 0 && (
        <>
          <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
          <span className="ui-card-header !text-xs">{t('properties.dependencies')}</span>
          {taskSequences.map(seq => {
            const other = seq.predecessorId === task.id
              ? tasks.find(t => t.id === seq.successorId)
              : tasks.find(t => t.id === seq.predecessorId);
            const role = seq.predecessorId === task.id ? '→' : '←';
            const isDriving = !!cpmResult && !cpmResult.error
              && cpmResult.drivingSequenceIds.includes(seq.id);
            return (
              <div key={seq.id} className="flex items-center gap-1 text-[10px]">
                <span>{role}</span>
                <span className="flex-1 truncate">{other?.name || '?'}</span>
                {isDriving && (
                  <span title={t('properties.driving')} style={{ color: 'var(--theme-accent)' }}>
                    <Zap size={10} />
                  </span>
                )}
                <select
                  value={seq.type}
                  onChange={e => updateSequence(seq.id, { type: e.target.value as SequenceType })}
                  className="input !text-[10px] !px-1 !py-0.5"
                >
                  {SEQUENCE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <SequenceLagInput
                  seq={seq}
                  title={t('properties.lag')}
                  onCommit={patch => updateSequence(seq.id, patch)}
                />
                <button
                  onClick={() => removeSequence(seq.id)}
                  style={{ color: 'var(--error)' }}
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
        className="btn btn--sm btn--primary mt-2"
        style={{ boxShadow: 'var(--shadow-glow)' }}
      >
        {t('properties.recalculate')}
      </button>
    </div>
  );
}
