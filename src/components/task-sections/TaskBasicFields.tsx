import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Task } from '@/types/task';
import { Select } from '@/components/common/Select';
import { TaskTypeField } from './TaskTypeField';
import { Field, Input } from './shared';
import type { DeferredProjectRenames } from './projectTaskTypeRename';

export function TaskBasicFields({ task, onChange, onCalendarChange, hideName, materializeTaskType = true, projectRenames }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
  onCalendarChange: (calendarId: string | undefined) => void;
  hideName?: boolean;
  materializeTaskType?: boolean;
  projectRenames?: DeferredProjectRenames;
}) {
  const { t } = useTranslation('task');
  const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
  const calendars = useAppStore(s => s.calendars);
  const projectCalendar = useAppStore(s => s.calendar);
  const pendingTaskNameFocusId = useAppStore(s => s.ui.pendingTaskNameFocusId);
  const setUI = useAppStore(s => s.setUI);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hideName || pendingTaskNameFocusId !== task.id) return;
    const input = nameInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
    setUI({ pendingTaskNameFocusId: null });
  }, [hideName, pendingTaskNameFocusId, setUI, task.id]);

  return (
    <>
      {!hideName && (
        <Field label={t('properties.name')}>
          <Input ref={nameInputRef} value={task.name} required onChange={v => onChange({ name: v })} />
        </Field>
      )}

      <Field label={t('properties.wbsCode')}>
        {wbsAutoNumber ? (
          <input value={task.wbsCode} disabled title={t('properties.wbsAutoHint')}
            className="input !text-small !leading-4 !px-2.5 !py-1.5 opacity-60 cursor-not-allowed" />
        ) : (
          <Input value={task.wbsCode} required onChange={v => onChange({ wbsCode: v })} />
        )}
      </Field>

      <Field label={t('properties.description')}>
        <textarea
          value={task.description}
          onChange={e => onChange({ description: e.target.value })}
          className="input !text-small !leading-4 !px-2.5 !py-1.5 h-16 resize-none"
        />
      </Field>

      <TaskTypeField task={task} onChange={onChange} materializeProjectType={materializeTaskType} projectRenames={projectRenames} />

      <Field label={t('properties.calendar')}>
        <Select
          aria-label={t('properties.calendar')}
          value={task.calendarId ?? ''}
          onChange={v => onCalendarChange(v || undefined)}
          options={[
            { value: '', label: `${t('properties.calendarProject')}: ${projectCalendar.name}` },
            ...calendars.map(c => ({ value: c.id, label: c.name })),
          ]}
        />
      </Field>
    </>
  );
}
