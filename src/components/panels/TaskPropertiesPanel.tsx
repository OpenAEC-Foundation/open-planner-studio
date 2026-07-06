import { useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task, TaskType, ConstraintType, MilestoneKind } from '@/types/task';
import { SequenceType, SEQUENCE_TYPE_OPTIONS } from '@/types/sequence';
import type { ResourceCurve } from '@/types/resource';
import { CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { Select } from '@/components/common/Select';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { UnitsInput } from '@/components/common/UnitsInput';
import { DateTextInput } from '@/components/common/DateTextInput';
import { useDisplayDate } from '@/utils/displayDate';
import { Trash2, Zap } from 'lucide-react';

export const RESOURCE_CURVES: ResourceCurve[] = ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK'];

/** ResourceCurve → i18n-key in de common-namespace (resource.curve.*). `as const` houdt de
 *  literal-keytypes zodat de getypeerde `t(...)` ze accepteert. */
export const CURVE_KEY = {
  UNIFORM: 'resource.curve.uniform',
  FRONT_LOADED: 'resource.curve.frontLoaded',
  BACK_LOADED: 'resource.curve.backLoaded',
  BELL: 'resource.curve.bell',
  EARLY_PEAK: 'resource.curve.earlyPeak',
  LATE_PEAK: 'resource.curve.latePeak',
} as const satisfies Record<ResourceCurve, string>;

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
      <DateTextInput
        value={typeof value === 'string' ? value : ''}
        onCommit={v => onCommit(v || null)}
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

function Input({ value, onChange, type = 'text', min, max, step, disabled }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="input !text-xs !px-2.5 !py-1.5 disabled:opacity-50"
    />
  );
}

export function TaskPropertiesPanel() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const dd = useDisplayDate();
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
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const assignResource = useAppStore(s => s.assignResource);
  const updateAssignment = useAppStore(s => s.updateAssignment);
  const unassignResource = useAppStore(s => s.unassignResource);
  // Voortgang (fase 2.6): de acties dwingen de §3.2-invarianten af.
  const setTaskProgress = useAppStore(s => s.setTaskProgress);
  const setActualStart = useAppStore(s => s.setActualStart);
  const setActualFinish = useAppStore(s => s.setActualFinish);
  const [actualError, setActualError] = useState(false);
  // Taak-kalender-keuze (fase 2.8a, §7.3): bibliotheek-kalenders + "Projectkalender" (undefined).
  const calendars = useAppStore(s => s.calendars);
  const setTaskCalendar = useAppStore(s => s.setTaskCalendar);

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

  // Toewijzingen (fase 2.5, §6.3) — leaf-only, geen mijlpalen/samenvattingstaken.
  const taskAssignments = assignments.filter(a => a.taskId === task.id);
  const assignmentsDisabled = task.isMilestone || task.childIds.length > 0;
  const assignedResourceIds = new Set(taskAssignments.map(a => a.resourceId));
  const availableResources = resources.filter(r => !assignedResourceIds.has(r.id));

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

      <Field label={t('properties.calendar')}>
        <Select
          aria-label={t('properties.calendar')}
          value={task.calendarId ?? ''}
          onChange={v => setTaskCalendar(task.id, v || undefined)}
          options={[
            { value: '', label: t('properties.calendarProject') },
            ...calendars.map(c => ({ value: c.id, label: c.name })),
          ]}
        />
      </Field>

      <div className="flex gap-2">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={task.isMilestone}
            onChange={e => {
              // Mijlpaal = duur 0 (paritair met TaskDialog); uitvinken geeft de
              // standaardduur terug zodat de balk niet onzichtbaar blijft.
              const on = e.target.checked;
              update({
                isMilestone: on,
                ...(on ? {} : { milestoneKind: undefined, mandatory: undefined }),
                time: { ...task.time, scheduleDuration: on ? 0 : (task.time.scheduleDuration || 5) },
              });
            }}
            className="accent-accent"
          />
          {t('properties.milestone')}
        </label>
      </div>

      {task.isMilestone && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('properties.milestoneKind')}>
            <select
              value={task.milestoneKind ?? 'AUTO'}
              onChange={e => {
                const v = e.target.value;
                update({ milestoneKind: v === 'AUTO' ? undefined : (v as MilestoneKind) });
              }}
              className="input !text-xs !px-2.5 !py-1.5"
            >
              <option value="AUTO">{t('milestoneKind.AUTO')}</option>
              <option value="START">{t('milestoneKind.START')}</option>
              <option value="FINISH">{t('milestoneKind.FINISH')}</option>
            </select>
          </Field>
          <label className="flex items-center gap-1.5 self-end pb-1.5">
            <input
              type="checkbox"
              checked={!!task.mandatory}
              onChange={e => update({ mandatory: e.target.checked || undefined })}
              className="accent-accent"
            />
            {t('properties.mandatory')}
          </label>
        </div>
      )}

      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />

      <span className="ui-card-header !text-xs">{t('properties.time')}</span>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('properties.start')}>
          <DateTextInput
            className="input !text-xs !px-2.5 !py-1.5"
            ariaLabel={t('properties.start')}
            value={task.time.scheduleStart}
            onCommit={v => updateTime('scheduleStart', v)}
          />
        </Field>
        <Field label={t('properties.duration')}>
          <Input
            type="number"
            value={task.isMilestone ? 0 : task.time.scheduleDuration}
            onChange={v => updateTime('scheduleDuration', parseInt(v) || 0)}
            min={0}
            disabled={task.isMilestone}
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
            <DateTextInput
              className="input !text-xs !px-2.5 !py-1.5"
              ariaLabel={t('properties.constraintDate')}
              value={task.constraint.date ?? ''}
              onCommit={v => update({ constraint: { type: task.constraint!.type, date: v } })}
            />
          </Field>
        )}
      </div>

      <Field label={t('properties.deadline')}>
        <DateTextInput
          className="input !text-xs !px-2.5 !py-1.5"
          ariaLabel={t('properties.deadline')}
          value={task.deadline ?? ''}
          onCommit={v => update({ deadline: v || undefined })}
        />
      </Field>

      <Field label={t('properties.completion')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(task.time.completion * 100)}
            onChange={e => setTaskProgress(task.id, parseInt(e.target.value) / 100)}
            className="flex-1 accent-accent"
          />
          <span className="w-8 text-right">{Math.round(task.time.completion * 100)}%</span>
        </div>
      </Field>

      {/* Werkelijke datums (fase 2.6, §11.3): mijlpaal ⇒ één "Werkelijke datum"; anders start+einde.
          De acties dwingen de invarianten af en weigeren datums ná de statusdatum (toast). */}
      {task.isMilestone ? (
        <Field label={t('properties.progress.actualDate')}>
          <DateTextInput
            className="input !text-xs !px-2.5 !py-1.5"
            ariaLabel={t('properties.progress.actualDate')}
            value={task.time.actualFinish ?? ''}
            onCommit={v => { setActualError(!setActualFinish(task.id, v || undefined)); }}
          />
        </Field>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('properties.progress.actualStart')}>
              <DateTextInput
                className="input !text-xs !px-2.5 !py-1.5"
                ariaLabel={t('properties.progress.actualStart')}
                value={task.time.actualStart ?? ''}
                onCommit={v => { setActualError(!setActualStart(task.id, v || undefined)); }}
              />
            </Field>
            <Field label={t('properties.progress.actualFinish')}>
              <DateTextInput
                className="input !text-xs !px-2.5 !py-1.5"
                ariaLabel={t('properties.progress.actualFinish')}
                value={task.time.actualFinish ?? ''}
                onCommit={v => { setActualError(!setActualFinish(task.id, v || undefined)); }}
              />
            </Field>
          </div>
          <Field label={t('properties.progress.remaining')}>
            <input
              value={task.time.remainingTime ?? Math.round(task.time.scheduleDuration * (1 - task.time.completion))}
              disabled
              className="input !text-xs !px-2.5 !py-1.5 opacity-60"
            />
          </Field>
        </>
      )}
      {actualError && (
        <div className="text-[11px]" style={{ color: 'var(--error)' }}>
          {tCommon('progress.actualsAfterStatusDate')}
        </div>
      )}

      {task.time.isCritical !== undefined && (
        <>
          <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
          <span className="ui-card-header !text-xs">{t('properties.cpmResult')}</span>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-text-secondary">{t('properties.earlyStart')}</span>
            <span>{dd.date(task.time.earlyStart)}</span>
            <span className="text-text-secondary">{t('properties.earlyFinish')}</span>
            <span>{dd.date(task.time.earlyFinish)}</span>
            <span className="text-text-secondary">{t('properties.lateStart')}</span>
            <span>{dd.date(task.time.lateStart)}</span>
            <span className="text-text-secondary">{t('properties.lateFinish')}</span>
            <span>{dd.date(task.time.lateFinish)}</span>
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

      {/* Toewijzingen (fase 2.5, §6.3) */}
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.assignments.title')}</span>
      {assignmentsDisabled ? (
        <span className="text-[10px] text-text-secondary italic">
          {task.isMilestone
            ? t('properties.assignments.disabledMilestone')
            : t('properties.assignments.disabledSummary')}
        </span>
      ) : (
        <>
          {taskAssignments.length === 0 && (
            <span className="text-[10px] text-text-secondary">{t('properties.assignments.empty')}</span>
          )}
          {taskAssignments.map(a => {
            const res = resources.find(r => r.id === a.resourceId);
            return (
              <div key={a.id} className="flex items-center gap-1 text-[10px]">
                <span className="flex-1 truncate" title={res?.name}>{res?.name || '?'}</span>
                <UnitsInput
                  value={a.unitsPerDay}
                  title={t('properties.assignments.unitsPerDay')}
                  ariaLabel={t('properties.assignments.unitsPerDay')}
                  onCommit={n => updateAssignment(a.id, { unitsPerDay: n })}
                  className="input !text-[10px] !px-1 !py-0.5 !w-14 text-right"
                />
                <select
                  value={a.curve ?? 'UNIFORM'}
                  title={t('properties.assignments.curve')}
                  onChange={e => updateAssignment(a.id, { curve: e.target.value as ResourceCurve })}
                  className="input !text-[10px] !px-1 !py-0.5 !w-24"
                >
                  {RESOURCE_CURVES.map(c => (
                    <option key={c} value={c}>{tCommon(CURVE_KEY[c])}</option>
                  ))}
                </select>
                <button onClick={() => unassignResource(a.id)} style={{ color: 'var(--error)' }} title={t('properties.assignments.remove')}>
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
          {availableResources.length > 0 ? (
            <select
              value=""
              onChange={e => { if (e.target.value) assignResource(task.id, e.target.value, 1); }}
              className="input !text-xs !px-2.5 !py-1.5"
            >
              <option value="">{t('properties.assignments.add')}</option>
              {availableResources.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] text-text-secondary">
              {resources.length === 0
                ? t('properties.assignments.noResources')
                : t('properties.assignments.allAssigned')}
            </span>
          )}
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
