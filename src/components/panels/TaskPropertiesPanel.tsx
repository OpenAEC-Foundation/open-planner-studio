import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task, TaskType, ConstraintType } from '@/types/task';
import { SequenceType, SEQUENCE_TYPE_OPTIONS } from '@/types/sequence';
import { CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { Select } from '@/components/common/Select';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { Trash2, Zap } from 'lucide-react';

/** Getypeerd invoerveld voor één custom field op een taak. */
function CustomFieldInput({ def, value, onCommit }: {
  def: CustomFieldDef;
  value: CustomFieldValue | undefined;
  onCommit: (value: CustomFieldValue | null) => void;
}) {
  const cls = 'input !text-xs !px-2.5 !py-1.5';
  if (def.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={e => onCommit(e.target.checked ? true : null)}
        className="w-4 h-4 accent-[var(--theme-accent)]"
      />
    );
  }
  if (def.type === 'date') {
    return (
      <input
        type="date"
        value={typeof value === 'string' ? value : ''}
        onChange={e => onCommit(e.target.value || null)}
        className={cls}
      />
    );
  }
  if (def.type === 'text') {
    return (
      <input
        value={typeof value === 'string' ? value : ''}
        onChange={e => onCommit(e.target.value || null)}
        className={cls}
      />
    );
  }
  // number / integer / cost
  return (
    <input
      type="number"
      step={def.type === 'integer' ? 1 : 'any'}
      value={typeof value === 'number' ? value : ''}
      onChange={e => {
        const raw = e.target.value;
        if (raw === '') { onCommit(null); return; }
        const n = def.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isFinite(n)) onCommit(n);
      }}
      className={cls}
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
  const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const setTaskActivityCode = useAppStore(s => s.setTaskActivityCode);
  const setTaskCustomField = useAppStore(s => s.setTaskCustomField);
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
        {/* Bij auto-nummering bezit de app de codes — handmatige invoer zou bij de
            eerstvolgende structuurmutatie toch overschreven worden. */}
        {wbsAutoNumber ? (
          <input value={task.wbsCode} disabled title={t('properties.wbsAutoHint')}
            className="input !text-xs !px-2.5 !py-1.5 opacity-60 cursor-not-allowed" />
        ) : (
          <Input value={task.wbsCode} onChange={v => update({ wbsCode: v })} />
        )}
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

      {/* Constraint & deadline (fase 2.3) — P6-soft: schendingen worden negatieve float */}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('properties.constraint')}>
          <select
            value={task.constraint?.type ?? 'ASAP'}
            onChange={e => {
              const type = e.target.value as ConstraintType;
              if (type === 'ASAP') update({ constraint: undefined });
              else if (type === 'ALAP') update({ constraint: { type } });
              else update({ constraint: { type, date: task.constraint?.date ?? task.time.scheduleStart } });
            }}
            className="input !text-xs !px-2.5 !py-1.5"
          >
            {(['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'] as ConstraintType[]).map(ct => (
              <option key={ct} value={ct}>{t(`constraintType.${ct}`)}</option>
            ))}
          </select>
        </Field>
        {task.constraint && task.constraint.type !== 'ALAP' && (
          <Field label={t('properties.constraintDate')}>
            <Input
              type="date"
              value={task.constraint.date ?? ''}
              onChange={v => update({ constraint: { type: task.constraint!.type, date: v } })}
            />
          </Field>
        )}
      </div>

      <Field label={t('properties.deadline')}>
        <Input
          type="date"
          value={task.deadline ?? ''}
          onChange={v => update({ deadline: v || undefined })}
        />
      </Field>

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

      {(activityCodeTypes.length > 0 || customFieldDefs.length > 0) && (
        <>
          <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
          <span className="ui-card-header !text-xs">{t('structure.title')}</span>
          {activityCodeTypes.map(type => (
            <Field key={type.id} label={type.name}>
              <select
                value={task.activityCodes?.[type.id] ?? ''}
                onChange={e => setTaskActivityCode(task.id, type.id, e.target.value || null)}
                className="input !text-xs !px-2.5 !py-1.5"
              >
                <option value="">{t('structure.none')}</option>
                {type.values.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.code}{v.description ? ` — ${v.description}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          {customFieldDefs.map(def => (
            <Field key={def.id} label={def.name}>
              <CustomFieldInput
                def={def}
                value={task.customFields?.[def.id]}
                onCommit={value => setTaskCustomField(task.id, def.id, value)}
              />
            </Field>
          ))}
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
