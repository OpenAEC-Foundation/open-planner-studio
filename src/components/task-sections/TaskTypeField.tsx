import { useEffect, useSyncExternalStore, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import type { Task, TaskType } from '@/types/task';
import type { CustomTaskType } from '@/types/taskType';
import { TASK_TYPES } from '@/types/task';
import { useAppStore } from '@/state/appStore';
import {
  addPersonalTaskType, getPersonalTaskTypes, removePersonalTaskType, renamePersonalTaskType, subscribePersonalTaskTypes,
} from '@/services/taskTypes/personalTaskTypes';
import { customTaskTypeInUse } from '@/services/taskTypes/customTaskTypeRules';
import { Dialog } from '@/components/common/Dialog';
import { Select, type SelectOption } from '@/components/common/Select';
import { Field } from './shared';
import { applyProjectTaskTypeRename, type DeferredProjectRenames, type ProjectTaskTypeRename } from './projectTaskTypeRename';

const GROUP_BUILTIN = '__ops_task_type_group_builtin__';
const GROUP_PERSONAL = '__ops_task_type_group_personal__';
const GROUP_PROJECT = '__ops_task_type_group_project__';
const SEPARATOR = '__ops_task_type_separator__';
const ACTION_NEW = '__ops_new_task_type__';
const ACTION_MANAGE = '__ops_manage_task_types__';
const customValue = (id: string) => `custom:${id}`;

function usePersonalTypes(): CustomTaskType[] {
  return useSyncExternalStore(subscribePersonalTaskTypes, getPersonalTaskTypes, () => []);
}

/** Eén veld voor het instant-apply paneel én de TaskDialog-draft. De globale bibliotheek is nooit
 * documentstate; de projectkopie wordt pas gematerialiseerd bij een echte typekeuze. Met
 * `projectRenames` (Taak bewerken) wacht een bevestigde hernoeming in het project tot de taakbewerking
 * dicht is; zonder (het paneel) gebeurt ze meteen. */
export function TaskTypeField({ task, onChange, materializeProjectType = true, projectRenames }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
  materializeProjectType?: boolean;
  projectRenames?: DeferredProjectRenames;
}) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const personal = usePersonalTypes();
  const storedProject = useAppStore(s => s.customTaskTypes);
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  // Een uitgestelde hernoeming (Taak bewerken) toont in deze dialoog al de naam die de planner koos.
  const project = projectRenames
    ? storedProject.map(type => {
      const pending = projectRenames.pending.find(rename => rename.id === type.id && rename.documentId === activeDocumentId);
      return pending ? { ...type, name: pending.newName } : type;
    })
    : storedProject;
  const ensureProjectTaskType = useAppStore(s => s.ensureProjectTaskType);
  const [dialog, setDialog] = useState<'new' | 'manage' | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  // Hernoemd persoonlijk type dat een taak in het actieve document gebruikt, met een andere naam daar:
  // de app vraagt of die naam mee moet (#804 keuze 7). De vraag hoort bij het document waarin ze gesteld
  // is en vervalt bij een documentwissel (fixronde 1 van #999).
  const [projectRename, setProjectRename] = useState<ProjectTaskTypeRename | null>(null);
  const openRename = projectRename?.documentId === activeDocumentId ? projectRename : null;
  useEffect(() => {
    if (projectRename && projectRename.documentId !== activeDocumentId) setProjectRename(null);
  }, [projectRename, activeDocumentId]);

  const projectOnly = project.filter(p => !personal.some(g => g.id === p.id));
  const selected = task.customTaskTypeId ? customValue(task.customTaskTypeId) : task.taskType;
  const selectedProject = task.customTaskTypeId ? project.find(x => x.id === task.customTaskTypeId) : undefined;
  const options: SelectOption[] = [
    { value: GROUP_BUILTIN, label: t('taskType.builtinGroup'), disabled: true },
    ...TASK_TYPES.filter(type => type !== 'USERDEFINED').map(type => ({ value: type, label: t(`taskType.${type}`) })),
    ...(!task.customTaskTypeId && task.taskType === 'USERDEFINED'
      ? [{ value: 'USERDEFINED', label: t('taskType.USERDEFINED') }]
      : []),
    ...(personal.length > 0
      ? [
          { value: GROUP_PERSONAL, label: t('taskType.personalGroup'), disabled: true },
          ...personal.map(type => ({
            value: customValue(type.id),
            label: type.id === task.customTaskTypeId && selectedProject ? selectedProject.name : type.name,
          })),
        ]
      : []),
    ...(projectOnly.length > 0
      ? [
          { value: GROUP_PROJECT, label: t('taskType.projectGroup'), disabled: true },
          ...projectOnly.map(type => ({ value: customValue(type.id), label: type.name })),
        ]
      : []),
    ...(selectedProject && !personal.some(type => type.id === selectedProject.id) && !projectOnly.some(type => type.id === selectedProject.id)
      ? [{ value: selected, label: selectedProject.name }]
      : []),
    // Terugval voor een typereferentie die nergens (meer) bestaat. Een persoonlijk type dat nog niet
    // in het project staat (de TaskDialog-draft materialiseert pas bij Opslaan) staat hierboven al
    // in de lijst — nogmaals toevoegen gaf dezelfde optiewaarde twee keer (dubbele React-key).
    ...(task.customTaskTypeId && !selectedProject && !personal.some(type => type.id === task.customTaskTypeId)
      ? [{ value: selected, label: t('taskType.USERDEFINED') }]
      : []),
    { value: SEPARATOR, label: '────────────', disabled: true },
    { value: ACTION_NEW, label: t('taskType.new') },
    { value: ACTION_MANAGE, label: t('taskType.manage') },
  ];
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
    if (!result) return;
    setName(''); setEditingId(null);
    const inProject = project.find(type => type.id === id);
    if (!inProject || inProject.name === result.name) return;
    // Gebruikt een taak de werksoort, dan vraagt de app het; een ongebruikte projectkopie (die IFC en
    // herstel niet bewaren) krijgt de naam stil (eigenaarsbesluit 18 november 2026). Botst die naam in
    // het project, dan blijft de kopie zoals ze is, zonder melding.
    const store = useAppStore.getState();
    if (customTaskTypeInUse(store.tasks, id)) {
      setProjectRename({ documentId: activeDocumentId, id, oldName: inProject.name, newName: result.name });
    } else {
      store.renameUnusedProjectTaskType(activeDocumentId, id, result.name);
    }
  };
  const answerProjectRename = (alsoInProject: boolean) => {
    const pending = openRename;
    setProjectRename(null);
    if (!pending || !alsoInProject) return;
    if (projectRenames) projectRenames.defer(pending);
    else applyProjectTaskTypeRename(pending);
  };
  const deleteType = (id: string) => {
    const inOpenProject = project.some(type => type.id === id);
    if (inOpenProject && !window.confirm(t('taskType.confirmRemove'))) return;
    removePersonalTaskType(id);
  };

  return <>
    <Field label={t('properties.type')}>
      <div data-ops-task-type>
        <Select
          aria-label={t('properties.type')}
          className="!text-small !leading-4 !px-2.5 !py-1.5"
          value={selected}
          options={options}
          onChange={value => {
            if (value === ACTION_NEW) { setName(''); setDialog('new'); return; }
            if (value === ACTION_MANAGE) { setDialog('manage'); return; }
            if (value.startsWith('custom:')) {
              const type = [...personal, ...project].find(x => x.id === value.slice(7));
              if (type) chooseCustom(type);
              return;
            }
            onChange({ taskType: value as TaskType, customTaskTypeId: undefined });
          }}
        />
      </div>
    </Field>

    {dialog === 'new' && <Dialog
      onCancel={() => setDialog(null)} onConfirm={create}
      overlayClassName="bg-black/60 z-[60]" stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[360px] p-4 flex flex-col gap-3"
      panelProps={{ 'data-ops-new-task-type-dialog': true }}
    >
      <h2 className="text-body leading-5 font-bold">{t('taskType.newTitle')}</h2>
      <Field label={t('taskType.name')}><input autoFocus value={name} onChange={e => setName(e.target.value)} className="input !text-small !leading-4 !px-2.5 !py-1.5" /></Field>
      <div className="flex justify-end gap-2"><button className="btn btn--sm btn--secondary" onClick={() => setDialog(null)}>{tCommon('cancel')}</button><button className="btn btn--sm btn--primary" onClick={create} disabled={!name.trim()}>{tCommon('create')}</button></div>
    </Dialog>}

    {dialog === 'manage' && <Dialog
      onCancel={() => setDialog(null)}
      overlayClassName="bg-black/60 z-[60]" stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-h-[80vh] overflow-auto p-4 flex flex-col gap-3"
      panelProps={{ 'data-ops-task-type-manager': true }}
    >
      <h2 className="text-body leading-5 font-bold">{t('taskType.manageTitle')}</h2>
      <div className="flex flex-col gap-1"><span className="!text-small uppercase text-text-secondary">{t('taskType.builtinGroup')}</span>{TASK_TYPES.filter(x => x !== 'USERDEFINED').map(type => <div key={type} className="text-small leading-4 opacity-60">{t(`taskType.${type}`)} · {t('taskType.fixed')}</div>)}</div>
      <div className="flex flex-col gap-2"><span className="!text-small uppercase text-text-secondary">{t('taskType.personalGroup')}</span>
        {personal.length === 0 && <span className="text-small leading-4 text-text-secondary">{t('taskType.empty')}</span>}
        {personal.map(type => editingId === type.id ? <div className="flex gap-2" key={type.id}><input autoFocus value={name} onChange={e => setName(e.target.value)} className="input !text-small !leading-4 flex-1" /><button className="btn btn--sm btn--primary" onClick={() => rename(type.id)}>{tCommon('save')}</button></div> : <div className="flex items-center gap-2 text-small leading-4" key={type.id}><span className="flex-1">{type.name}</span><button className="p-1 rounded-[6px] hover:bg-surface-hover text-text-secondary" onClick={() => { setEditingId(type.id); setName(type.name); }} aria-label={t('taskType.rename')} title={t('taskType.rename')}><Icon id="object.rename" size={12} /></button><button className="p-1 rounded-[6px] hover:bg-surface-hover text-text-secondary hover:text-red-500" onClick={() => deleteType(type.id)} aria-label={t('taskType.remove')} title={t('taskType.remove')}><Icon id="edit.delete" size={12} /></button></div>)}
      </div>
      {projectOnly.length > 0 && <div className="flex flex-col gap-2"><span className="!text-small uppercase text-text-secondary">{t('taskType.projectGroup')}</span>{projectOnly.map(type => <div className="flex items-center gap-2 text-small leading-4" key={type.id}><span className="flex-1">{type.name}</span><button className="btn btn--sm btn--secondary" onClick={() => addPersonalTaskType(type.name, type.id)}>{t('taskType.addToMine')}</button></div>)}</div>}
      <div className="flex justify-end"><button className="btn btn--sm btn--primary" onClick={() => setDialog(null)}>{tCommon('close')}</button></div>
    </Dialog>}

    {openRename && <Dialog
      onCancel={() => answerProjectRename(false)} onConfirm={() => answerProjectRename(true)} focusedButtonOwnsEnter
      overlayClassName="bg-black/60 z-[70]" stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[420px] p-4 flex flex-col gap-3"
      panelProps={{ 'data-ops-rename-project-task-type': true }}
    >
      <h2 className="text-body leading-5 font-bold">{t('taskType.renameInProjectTitle')}</h2>
      <p className="text-small leading-relaxed">{t('taskType.renameInProjectMessage', { oldName: openRename.oldName, newName: openRename.newName })}</p>
      <div className="flex justify-end gap-2">
        <button className="btn btn--sm btn--secondary" onClick={() => answerProjectRename(false)}>{t('taskType.renameInProjectNo')}</button>
        <button className="btn btn--sm btn--primary" onClick={() => answerProjectRename(true)}>{t('taskType.renameInProjectYes')}</button>
      </div>
    </Dialog>}
  </>;
}
