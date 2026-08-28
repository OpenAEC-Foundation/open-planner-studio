import { useSyncExternalStore, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Task, TaskType } from '@/types/task';
import type { CustomTaskType } from '@/types/taskType';
import { TASK_TYPES } from '@/types/task';
import { useAppStore } from '@/state/appStore';
import {
  addPersonalTaskType, getPersonalTaskTypes, removePersonalTaskType, renamePersonalTaskType, subscribePersonalTaskTypes,
} from '@/services/taskTypes/personalTaskTypes';
import { Dialog } from '@/components/common/Dialog';
import { Field } from './shared';

const ACTION_NEW = '__ops_new_task_type__';
const ACTION_MANAGE = '__ops_manage_task_types__';
const customValue = (id: string) => `custom:${id}`;

function usePersonalTypes(): CustomTaskType[] {
  return useSyncExternalStore(subscribePersonalTaskTypes, getPersonalTaskTypes, () => []);
}

/** Eén veld voor het instant-apply paneel én de TaskDialog-draft. De globale bibliotheek is nooit
 * documentstate; de projectkopie wordt pas gematerialiseerd bij een echte typekeuze. */
export function TaskTypeField({ task, onChange, materializeProjectType = true }: { task: Task; onChange: (patch: Partial<Task>) => void; materializeProjectType?: boolean }) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const personal = usePersonalTypes();
  const project = useAppStore(s => s.customTaskTypes);
  const ensureProjectTaskType = useAppStore(s => s.ensureProjectTaskType);
  const [dialog, setDialog] = useState<'new' | 'manage' | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const projectOnly = project.filter(p => !personal.some(g => g.id === p.id));
  const selected = task.customTaskTypeId ? customValue(task.customTaskTypeId) : task.taskType;
  const selectedProject = task.customTaskTypeId ? project.find(x => x.id === task.customTaskTypeId) : undefined;
  const chooseCustom = (type: CustomTaskType) => {
    if (materializeProjectType) ensureProjectTaskType(type);
    onChange({ taskType: 'USERDEFINED', customTaskTypeId: type.id });
  };
  const create = () => {
    const type = addPersonalTaskType(name);
    if (!type) return;
    chooseCustom(type);
    setName('');
    setDialog(null);
  };
  const rename = (id: string) => {
    const result = renamePersonalTaskType(id, name);
    if (result) { setName(''); setEditingId(null); }
  };
  const deleteType = (id: string) => {
    const inOpenProject = project.some(type => type.id === id);
    if (inOpenProject && !window.confirm(t('taskType.confirmRemove'))) return;
    removePersonalTaskType(id);
  };

  return <>
    <Field label={t('properties.type')}>
      <select
        aria-label={t('properties.type')}
        data-ops-task-type
        className="input !text-xs !px-2.5 !py-1.5"
        value={selected}
        onChange={event => {
          const value = event.currentTarget.value;
          if (value === ACTION_NEW) { setName(''); setDialog('new'); return; }
          if (value === ACTION_MANAGE) { setDialog('manage'); return; }
          if (value.startsWith('custom:')) {
            const type = [...personal, ...project].find(x => x.id === value.slice(7));
            if (type) chooseCustom(type);
            return;
          }
          onChange({ taskType: value as TaskType, customTaskTypeId: undefined });
        }}
      >
        <optgroup label={t('taskType.builtinGroup')}>
          {TASK_TYPES.filter(type => type !== 'USERDEFINED').map(type => <option key={type} value={type}>{t(`taskType.${type}`)}</option>)}
          {!task.customTaskTypeId && task.taskType === 'USERDEFINED' && <option value="USERDEFINED">{t('taskType.USERDEFINED')}</option>}
        </optgroup>
        {personal.length > 0 && <optgroup label={t('taskType.personalGroup')}>
          {personal.map(type => <option key={type.id} value={customValue(type.id)}>{type.id === task.customTaskTypeId && selectedProject ? selectedProject.name : type.name}</option>)}
        </optgroup>}
        {projectOnly.length > 0 && <optgroup label={t('taskType.projectGroup')}>
          {projectOnly.map(type => <option key={type.id} value={customValue(type.id)}>{type.name}</option>)}
        </optgroup>}
        {selectedProject && !personal.some(type => type.id === selectedProject.id) && !projectOnly.some(type => type.id === selectedProject.id) && <option value={selected}>{selectedProject.name}</option>}
        {task.customTaskTypeId && !selectedProject && <option value={selected}>{t('taskType.USERDEFINED')}</option>}
        <option disabled>────────────</option>
        <option value={ACTION_NEW}>{t('taskType.new')}</option>
        <option value={ACTION_MANAGE}>{t('taskType.manage')}</option>
      </select>
    </Field>

    {dialog === 'new' && <Dialog
      onBackdropClick={() => setDialog(null)} onCancel={() => setDialog(null)} onConfirm={create}
      overlayClassName="bg-black/60 z-[60]" stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[360px] p-4 flex flex-col gap-3"
      panelProps={{ 'data-ops-new-task-type-dialog': true }}
    >
      <h2 className="text-sm font-bold">{t('taskType.newTitle')}</h2>
      <Field label={t('taskType.name')}><input autoFocus value={name} onChange={e => setName(e.target.value)} className="input !text-xs !px-2.5 !py-1.5" /></Field>
      <div className="flex justify-end gap-2"><button className="btn btn--sm btn--secondary" onClick={() => setDialog(null)}>{tCommon('cancel')}</button><button className="btn btn--sm btn--primary" onClick={create} disabled={!name.trim()}>{tCommon('create')}</button></div>
    </Dialog>}

    {dialog === 'manage' && <Dialog
      onBackdropClick={() => setDialog(null)} onCancel={() => setDialog(null)}
      overlayClassName="bg-black/60 z-[60]" stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-h-[80vh] overflow-auto p-4 flex flex-col gap-3"
      panelProps={{ 'data-ops-task-type-manager': true }}
    >
      <h2 className="text-sm font-bold">{t('taskType.manageTitle')}</h2>
      <div className="flex flex-col gap-1"><span className="text-[10px] uppercase text-text-secondary">{t('taskType.builtinGroup')}</span>{TASK_TYPES.filter(x => x !== 'USERDEFINED').map(type => <div key={type} className="text-xs opacity-60">{t(`taskType.${type}`)} · {t('taskType.fixed')}</div>)}</div>
      <div className="flex flex-col gap-2"><span className="text-[10px] uppercase text-text-secondary">{t('taskType.personalGroup')}</span>
        {personal.length === 0 && <span className="text-xs text-text-secondary">{t('taskType.empty')}</span>}
        {personal.map(type => editingId === type.id ? <div className="flex gap-2" key={type.id}><input autoFocus value={name} onChange={e => setName(e.target.value)} className="input !text-xs flex-1" /><button className="btn btn--sm btn--primary" onClick={() => rename(type.id)}>{tCommon('save')}</button></div> : <div className="flex items-center gap-2 text-xs" key={type.id}><span className="flex-1">{type.name}</span><button className="btn btn--sm btn--secondary" onClick={() => { setEditingId(type.id); setName(type.name); }}>{t('taskType.rename')}</button><button className="btn btn--sm btn--secondary" onClick={() => deleteType(type.id)}>{t('taskType.remove')}</button></div>)}
      </div>
      {projectOnly.length > 0 && <div className="flex flex-col gap-2"><span className="text-[10px] uppercase text-text-secondary">{t('taskType.projectGroup')}</span>{projectOnly.map(type => <div className="flex items-center gap-2 text-xs" key={type.id}><span className="flex-1">{type.name}</span><button className="btn btn--sm btn--secondary" onClick={() => addPersonalTaskType(type.name, type.id)}>{t('taskType.addToMine')}</button></div>)}</div>}
      <div className="flex justify-end"><button className="btn btn--sm btn--primary" onClick={() => setDialog(null)}>{tCommon('close')}</button></div>
    </Dialog>}
  </>;
}
