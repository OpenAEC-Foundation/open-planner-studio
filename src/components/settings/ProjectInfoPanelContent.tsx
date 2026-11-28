import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { hasForeignContent } from '@/services/ifc/foreign/ifcSource';
import { ifcxEnabled } from '@/utils/featureFlags';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { Select } from '@/components/common/Select';
import { DateTextInput } from '@/components/common/DateTextInput';
import { localTodayIso } from '@/utils/dateUtils';
import { PROJECT_TEMPLATES, templatePhases, buildGeneratedCalendar, type TemplateKey } from '@/utils/projectTemplates';
import { CalendarGeneratorFields } from '@/components/dialogs/CalendarGeneratorFields';
import { SchedulingProfileSection } from '@/components/settings/SchedulingProfileSection';
import { hasValidProfileName, sameSettings, type SchedulingSettingsDraft } from '@/state/schedulingProfileDraft';
import { projectInfoPatch } from '@/state/projectInfoPatch';
import { defaultTaskMeasureLocked } from '@/state/newTaskMeasure';
import { BUILT_IN_PROFILE_BRANDS, profileBrand } from '@/state/schedulingProfileNotice';
import { projectIfcSchema, type IfcSchemaId } from '@/types/project';
import { DEFAULT_WORK_RULE, WORK_RULES, type WorkRule } from '@/types/workRule';
import { computeGenerateSpan, type HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import type { HolidayCountry } from '@/engine/calendar/holidays';
import { WIZARD_PRESETS, SHIFT_PRESET_LABEL, shiftPresetPatch, type ShiftPresetKey } from '@/utils/shiftPresets';

type WizardCalendarState = Omit<HolidayGenParams, 'country'> & { country: HolidayCountry | 'none' | 'custom' };

const DEFAULT_WIZARD_CALENDAR: WizardCalendarState = {
  country: 'NL', region: undefined, bouwvak: 'geen',
};

const NEW_COMPANY_OPTION = '__new__';

interface MetaDraft {
  name: string; description: string; author: string; company: string;
  startDate: string; endDate: string; defaultTaskDurationUnit: 'days' | 'hours';
  defaultWorkRule: WorkRule;
  ifcSchema: IfcSchemaId;
  anchorsFromOpenDocuments: boolean;
}
const META_KEYS = ['name', 'description', 'author', 'company', 'startDate', 'endDate', 'defaultTaskDurationUnit', 'defaultWorkRule', 'ifcSchema', 'anchorsFromOpenDocuments'] as const satisfies readonly (keyof MetaDraft)[];

export interface ProjectInfoPanelContentHandle {
  submit: (options?: ProjectInfoSubmitOptions) => boolean;
  discard: () => void;
}

export interface ProjectInfoSubmitOptions {
  skipDone?: boolean;
}

export interface ProjectInfoPanelContentProps {
  mode: 'wizard' | 'edit';
  onDone: () => void;
  autoFocusName?: boolean;
  onValidityChange?: (valid: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export const ProjectInfoPanelContent = forwardRef<ProjectInfoPanelContentHandle, ProjectInfoPanelContentProps>(
  function ProjectInfoPanelContent({ mode, onDone, autoFocusName, onValidityChange, onDirtyChange }, ref) {
    const isNew = mode === 'wizard';
    const { t: tMenu } = useTranslation('menu');
    const { t: tCommon } = useTranslation('common');
    const { t: tTask } = useTranslation('task');
    const project = useAppStore(s => s.project);
    const ifcSource = useAppStore(s => s.ifcSource);
    const schemaLocked = !isNew && hasForeignContent(ifcSource);
    const fileFormat = useAppStore(s => (ifcxEnabled(s.ui.featureFlags) ? s.fileFormat : null));
    const activeDocumentId = useAppStore(s => s.activeDocumentId);
    const activeRibbonTab = useAppStore(s => s.ui.activeRibbonTab);
    const createNewProject = useAppStore(s => s.createNewProject);
    const setUI = useAppStore(s => s.setUI);
    const applyProjectInfo = useAppStore(s => s.applyProjectInfo);

    const [name, setName] = useState(isNew ? '' : project.name);
    const [description, setDescription] = useState(isNew ? '' : project.description);
    const [author, setAuthor] = useState(isNew ? '' : project.author);
    const [company, setCompany] = useState(isNew ? '' : project.company);
    const [startDate, setStartDate] = useState(isNew ? localTodayIso() : project.startDate);
    const [endDate, setEndDate] = useState(isNew ? '' : project.endDate);
    const [defaultTaskDurationUnit, setDefaultTaskDurationUnit] = useState<'days' | 'hours'>(
      isNew ? 'days' : (project.defaultTaskDurationUnit ?? 'days'),
    );
    const [defaultWorkRule, setDefaultWorkRule] = useState<WorkRule>(project.defaultWorkRule ?? DEFAULT_WORK_RULE);
    const [ifcSchema, setIfcSchema] = useState<IfcSchemaId>(projectIfcSchema(isNew ? {} : project));
    const [anchorsFromOpenDocuments, setAnchorsFromOpenDocuments] = useState(!isNew && !!project.anchorsFromOpenDocuments);
    const [scheduling, setSchedulingRaw] = useState<SchedulingSettingsDraft>(
      isNew ? { profile: undefined, options: undefined }
        : { profile: project.schedulingProfile, options: project.schedulingOptions },
    );
    const constructionMode = useAppStore(s => s.ui.constructionMode);
    const [calState, setCalState] = useState<WizardCalendarState>(() =>
      constructionMode
        ? DEFAULT_WIZARD_CALENDAR
        : { country: 'none', region: undefined, bouwvak: 'geen' },
    );
    const [template, setTemplate] = useState<TemplateKey>('empty');
    const companies = useAppStore(s => s.companies);
    const defaultCompanyId = useAppStore(s => s.defaultCompanyId);
    const bindProjectToCompany = useAppStore(s => s.bindProjectToCompany);
    const unbindProject = useAppStore(s => s.unbindProject);
    const addCompany = useAppStore(s => s.addCompany);
    const [linkedCompanyId, setLinkedCompanyId] = useState<string>(isNew ? defaultCompanyId : (project.companyId ?? ''));
    const [companyTouched, setCompanyTouched] = useState(false);
    const [creatingCompany, setCreatingCompany] = useState(false);
    const [pendingNewCompany, setPendingNewCompany] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');
    const [shiftPreset, setShiftPreset] = useState<ShiftPresetKey>('day');
    const [calcTouched, setCalcTouched] = useState(false);
    const measureLocked = defaultTaskMeasureLocked({ schedulingProfile: scheduling.profile, schedulingOptions: scheduling.options });
    const setScheduling = (next: SchedulingSettingsDraft) => {
      setCalcTouched(true);
      setSchedulingRaw(next);
    };

    const resetDraftFromProject = useCallback(() => {
      const p = useAppStore.getState().project;
      setName(p.name);
      setDescription(p.description);
      setAuthor(p.author);
      setCompany(p.company);
      setStartDate(p.startDate);
      setEndDate(p.endDate);
      setDefaultTaskDurationUnit(p.defaultTaskDurationUnit ?? 'days');
      setDefaultWorkRule(p.defaultWorkRule ?? DEFAULT_WORK_RULE);
      setIfcSchema(projectIfcSchema(p));
      setAnchorsFromOpenDocuments(!!p.anchorsFromOpenDocuments);
      setSchedulingRaw({ profile: p.schedulingProfile, options: p.schedulingOptions });
      setCalcTouched(false);
      setStoreChangedUnderDraft(false);
      setLinkedCompanyId(p.companyId ?? '');
      setCompanyTouched(false);
      setCreatingCompany(false);
      setPendingNewCompany(false);
      setNewCompanyName('');
    }, []);

    const storeScheduling = useMemo<SchedulingSettingsDraft>(
      () => ({ profile: project.schedulingProfile, options: project.schedulingOptions }),
      [project.schedulingProfile, project.schedulingOptions],
    );
    const storeMeta = useMemo<MetaDraft>(() => ({
      name: project.name, description: project.description, author: project.author, company: project.company,
      startDate: project.startDate, endDate: project.endDate,
      defaultTaskDurationUnit: project.defaultTaskDurationUnit ?? 'days',
      defaultWorkRule: project.defaultWorkRule ?? DEFAULT_WORK_RULE,
      ifcSchema: projectIfcSchema({ ifcSchema: project.ifcSchema }),
      anchorsFromOpenDocuments: !!project.anchorsFromOpenDocuments,
    }), [project.name, project.description, project.author, project.company, project.startDate, project.endDate,
      project.defaultTaskDurationUnit, project.defaultWorkRule, project.ifcSchema, project.anchorsFromOpenDocuments]);
    const draftMeta = useMemo<MetaDraft>(
      () => ({
        name, description, author, company, startDate, endDate, defaultTaskDurationUnit, defaultWorkRule, ifcSchema,
        anchorsFromOpenDocuments,
      }),
      [name, description, author, company, startDate, endDate, defaultTaskDurationUnit, defaultWorkRule, ifcSchema,
        anchorsFromOpenDocuments],
    );
    const metaSetters = useMemo<Record<keyof MetaDraft, (value: never) => void>>(() => ({
      name: setName, description: setDescription, author: setAuthor, company: setCompany,
      startDate: setStartDate, endDate: setEndDate, defaultTaskDurationUnit: setDefaultTaskDurationUnit,
      defaultWorkRule: setDefaultWorkRule,
      ifcSchema: setIfcSchema, anchorsFromOpenDocuments: setAnchorsFromOpenDocuments,
    }), []);
    const [storeChangedUnderDraft, setStoreChangedUnderDraft] = useState(false);

    const seenStoreRef = useRef({ docId: activeDocumentId, meta: storeMeta, scheduling: storeScheduling });
    useLayoutEffect(() => {
      if (isNew) return;
      const seen = seenStoreRef.current;
      if (activeDocumentId !== seen.docId) {
        seenStoreRef.current = { docId: activeDocumentId, meta: storeMeta, scheduling: storeScheduling };
        resetDraftFromProject();
        return;
      }
      if (seen.meta !== storeMeta) {
        const previous = seen.meta;
        seenStoreRef.current = { ...seenStoreRef.current, meta: storeMeta };
        for (const key of META_KEYS) {
          if (previous[key] !== storeMeta[key] && draftMeta[key] === previous[key]) (metaSetters[key] as (value: MetaDraft[typeof key]) => void)(storeMeta[key]);
        }
      }
      if (seen.scheduling !== storeScheduling) {
        const previous = seen.scheduling;
        seenStoreRef.current = { ...seenStoreRef.current, scheduling: storeScheduling };
        if (!calcTouched || sameSettings(previous, scheduling) || sameSettings(storeScheduling, scheduling)) {
          setSchedulingRaw(storeScheduling);
          setCalcTouched(false);
          setStoreChangedUnderDraft(false);
        } else {
          setStoreChangedUnderDraft(true);
        }
        return;
      }
      if (storeChangedUnderDraft && sameSettings(storeScheduling, scheduling)) setStoreChangedUnderDraft(false);
    }, [isNew, activeDocumentId, storeMeta, storeScheduling, storeChangedUnderDraft, scheduling, calcTouched, draftMeta,
      metaSetters, resetDraftFromProject]);


    const calSpan = useMemo(() => computeGenerateSpan(startDate, endDate || undefined), [startDate, endDate]);

    const draftValid = hasValidProfileName(scheduling.profile);
    useEffect(() => { onValidityChange?.(draftValid); }, [draftValid, onValidityChange]);

    const dirty = !isNew && (
      Object.keys(projectInfoPatch(project, draftMeta)).length > 0
      || (calcTouched && !sameSettings({ profile: project.schedulingProfile, options: project.schedulingOptions }, scheduling))
      || pendingNewCompany
      || (companyTouched && linkedCompanyId !== (project.companyId ?? ''))
    );
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
    useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

    const handleSubmit = (options?: ProjectInfoSubmitOptions): boolean => {
      if (!draftValid) return false;
      let effectiveLinkedCompanyId = linkedCompanyId;
      let effectiveCompanyTouched = companyTouched;
      if (pendingNewCompany) {
        const createdId = addCompany(newCompanyName.trim() || tCommon('companyLibrary.newCompany'));
        effectiveLinkedCompanyId = createdId;
        effectiveCompanyTouched = true;
        setPendingNewCompany(false);
        setCreatingCompany(false);
        setLinkedCompanyId(createdId);
      }

      if (isNew) {
        const isCustom = calState.country === 'custom';
        const calendarName = tCommon(constructionMode
          ? 'calendar.defaultConstructionName'
          : 'calendar.defaultStandardName');
        const calendar = isCustom
          ? buildGeneratedCalendar({ country: 'none', bouwvak: 'geen' }, calSpan, calendarName)
          : buildGeneratedCalendar(calState as HolidayGenParams, calSpan, calendarName);
        if (shiftPreset !== 'day') {
          const patch = shiftPresetPatch(shiftPreset);
          calendar.workTime = patch.workTime;
          calendar.shift = patch.shift;
          calendar.workDays = patch.workDays;
          calendar.workStartHour = patch.workStartHour;
          calendar.workEndHour = patch.workEndHour;
          calendar.hoursPerDay = patch.hoursPerDay;
        }
        createNewProject({
          name, description, author, company, startDate, endDate,
          calendar,
          phaseNames: templatePhases(template, tMenu),
          defaultTaskDurationUnit: defaultTaskDurationUnit,
          schedulingProfile: scheduling.profile,
          schedulingOptions: scheduling.options,
        });
        if (effectiveLinkedCompanyId) {
          bindProjectToCompany(effectiveLinkedCompanyId);
          if (useAppStore.getState().computeRecognition().some(c => c.suggestedPoolId)) {
            useAppStore.getState().setUI({ showLibraryLinkDialog: true });
          }
        }
        setUI({
          showNewProjectDialog: false,
          ...(isCustom ? { showCalendarDialog: true } : {}),
          ...(activeRibbonTab === 'file' ? { activeRibbonTab: 'start' as const } : {}),
        });
      } else {
        applyProjectInfo(
          projectInfoPatch(project, draftMeta),
          calcTouched ? scheduling : undefined,
        );
        if (effectiveCompanyTouched) {
          const prevCompany = project.companyId ?? '';
          if (effectiveLinkedCompanyId !== prevCompany) {
            if (effectiveLinkedCompanyId) {
              bindProjectToCompany(effectiveLinkedCompanyId);
              if (useAppStore.getState().computeRecognition().some(c => c.suggestedPoolId)) {
                useAppStore.getState().setUI({ showLibraryLinkDialog: true });
              }
            } else {
              unbindProject();
            }
          }
        }
      }
      if (!options?.skipDone) onDone();
      return true;
    };

    useImperativeHandle(ref, () => ({ submit: handleSubmit, discard: resetDraftFromProject }));

    const inputCls =
      'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

    const templateLabel: Record<TemplateKey, string> = {
      empty: tMenu('newProject.tmplEmpty'),
      woningbouw: tMenu('newProject.tmplWoningbouw'),
      utiliteit: tMenu('newProject.tmplUtiliteit'),
    };
    const templateOptions = PROJECT_TEMPLATES
      .filter(t => constructionMode || t.key === 'empty')
      .map(t => ({ value: t.key, label: templateLabel[t.key] }));

    const handleCompanySelectChange = (value: string) => {
      if (value === NEW_COMPANY_OPTION) {
        setCreatingCompany(true);
        setPendingNewCompany(true);
        setNewCompanyName('');
        return;
      }
      setCompanyTouched(true);
      setCreatingCompany(false);
      setPendingNewCompany(false);
      setLinkedCompanyId(value);
    };
    const cancelNewCompany = () => {
      setCreatingCompany(false);
      setPendingNewCompany(false);
      setNewCompanyName('');
    };
    const confirmNewCompany = () => {
      setCreatingCompany(false);
      setCompanyTouched(true);
    };

    return (
      <div className="flex flex-col gap-3 text-small leading-4" data-ops-project-info-panel>
        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">{tMenu('projectInfo.name')}</label>
          <input data-ops-project-name value={name} onChange={e => setName(e.target.value)} placeholder={tCommon('project.untitled')} className={inputCls} autoFocus={autoFocusName} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">{tMenu('projectInfo.description')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.author')}</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tCommon('companyLibrary.linkedCompany')}</label>
            <select
              value={(creatingCompany || pendingNewCompany) ? NEW_COMPANY_OPTION : linkedCompanyId}
              onChange={e => handleCompanySelectChange(e.target.value)}
              className={inputCls}
              data-ops-project-company-select
            >
              <option value="">{tCommon('companyLibrary.noCompanyLinked')}</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_COMPANY_OPTION}>{tCommon('companyLibrary.addNewOption')}</option>
            </select>
            {creatingCompany && (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirmNewCompany(); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelNewCompany(); }
                  }}
                  placeholder={tCommon('companyLibrary.newCompany')}
                  aria-label={tCommon('companyLibrary.companyName')}
                  className={inputCls}
                  autoFocus
                  data-ops-project-new-company-name
                />
                <button
                  type="button"
                  onClick={confirmNewCompany}
                  className="p-1 hover:bg-surface-hover rounded-[6px] shrink-0"
                  title={tCommon('ok')}
                  data-ops-project-new-company-confirm
                >
                  <Icon id="input.confirm-draft" size={14} />
                </button>
                <button
                  type="button"
                  onClick={cancelNewCompany}
                  className="p-1 hover:bg-surface-hover rounded-[6px] shrink-0"
                  title={tCommon('cancel')}
                  data-ops-project-new-company-cancel
                >
                  <Icon id="ui.close" size={14} />
                </button>
              </div>
            )}
            {pendingNewCompany && !creatingCompany && (
              <div className="flex items-center gap-1.5 mt-1 text-text-secondary">
                <span data-ops-project-new-company-pending>{newCompanyName.trim() || tCommon('companyLibrary.newCompany')}</span>
                <button
                  type="button"
                  onClick={() => setCreatingCompany(true)}
                  className="p-1 hover:bg-surface-hover rounded-[6px] shrink-0"
                  title={tCommon('companyLibrary.editItem')}
                >
                  <Icon id="object.rename" size={12} />
                </button>
                <button
                  type="button"
                  onClick={cancelNewCompany}
                  className="p-1 hover:bg-surface-hover rounded-[6px] shrink-0"
                  title={tCommon('cancel')}
                >
                  <Icon id="ui.close" size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">{tCommon('companyLibrary.clientOrg')}</label>
          <input value={company} onChange={e => setCompany(e.target.value)} className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.startDate')}</label>
            <DateTextInput value={startDate} onCommit={setStartDate} className={inputCls} commitMode="live" ariaLabel={tMenu('projectInfo.startDate')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.endDate')}</label>
            <DateTextInput value={endDate} onCommit={setEndDate} className={inputCls} commitMode="live" ariaLabel={tMenu('projectInfo.endDate')} />
          </div>
        </div>

        <div className="flex flex-col gap-1" data-ops-default-task-measure>
          <label className="text-text-secondary font-medium">
            {tCommon('settings.defaultTaskDurationUnit')}
          </label>
          <Select
            aria-label={tCommon('settings.defaultTaskDurationUnit')}
            value={measureLocked ? 'hours' : defaultTaskDurationUnit}
            onChange={value => setDefaultTaskDurationUnit(value as 'days' | 'hours')}
            disabled={measureLocked}
            options={[
              { value: 'days', label: tCommon('settings.defaultTaskDurationUnitDays') },
              { value: 'hours', label: tCommon('settings.defaultTaskDurationUnitHours') },
            ]}
          />
          <p className="settings-hint">
            {measureLocked
              ? tCommon('settings.defaultTaskDurationUnitLocked', {
                profile: scheduling.profile ? profileBrand(scheduling.profile) : BUILT_IN_PROFILE_BRANDS.ops,
              })
              : tCommon('settings.defaultTaskDurationUnitHint')}
          </p>
        </div>

        {!isNew && (
          <div className="flex flex-col gap-1" data-ops-default-work-rule>
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.defaultWorkRule')}</label>
            <Select
              aria-label={tMenu('projectInfo.defaultWorkRule')}
              value={defaultWorkRule}
              onChange={value => setDefaultWorkRule(value as WorkRule)}
              options={WORK_RULES.map(rule => ({ value: rule, label: tTask(`workRule.${rule}`) }))}
            />
            <p className="settings-hint">{tMenu('projectInfo.defaultWorkRuleHint')}</p>
          </div>
        )}

        {!isNew && fileFormat && (
          <div className="flex flex-col gap-1" data-ops-project-file-type={fileFormat}>
            <label className="text-text-secondary font-medium">{tMenu('ifcx.projectInfo.fileType')}</label>
            <Select
              aria-label={tMenu('ifcx.projectInfo.fileType')}
              disabled
              value={fileFormat}
              onChange={() => {}}
              options={[{ value: 'ifc', label: 'IFC' }, { value: 'ifcx', label: 'IFCX' }]}
            />
            <p className="settings-hint">{tMenu('ifcx.projectInfo.fileTypeHint')}</p>
          </div>
        )}

        {!isNew && (
          <div className="flex flex-col gap-1" data-ops-project-ifc-schema>
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.ifcSchema.label')}</label>
            <Select
              aria-label={tMenu('projectInfo.ifcSchema.label')}
              disabled={schemaLocked}
              value={schemaLocked ? ifcSource!.schemaName : ifcSchema}
              valueLabel={schemaLocked ? ifcSource!.schemaName : undefined}
              onChange={value => setIfcSchema(value as IfcSchemaId)}
              options={[
                { value: 'IFC4X3_ADD2', label: tMenu('projectInfo.ifcSchema.optionIfc4x3Add2') },
                { value: 'IFC4X3', label: tMenu('projectInfo.ifcSchema.optionIfc4x3') },
                { value: 'IFC4', label: tMenu('projectInfo.ifcSchema.optionIfc4') },
              ]}
            />
            {schemaLocked && <p className="text-caption text-text-secondary">{tMenu('projectInfo.ifcSchema.foreignLocked')}</p>}
            {fileFormat === 'ifcx' && <p className="settings-hint" data-ops-project-ifc-schema-ifcx>{tMenu('ifcx.projectInfo.schemaForIfcx')}</p>}
          </div>
        )}

        {!isNew && (
          <div className="flex flex-col gap-1" data-ops-project-anchors-from-open>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="accent-accent" checked={anchorsFromOpenDocuments}
                onChange={e => setAnchorsFromOpenDocuments(e.target.checked)} data-ops-project-anchors-from-open-input />
              {tMenu('projectInfo.anchorsFromOpenDocuments')}
            </label>
            <p className="settings-hint">{tMenu('projectInfo.anchorsFromOpenDocumentsHint')}</p>
          </div>
        )}

        {isNew && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('newProject.template')}</label>
              <Select aria-label={tMenu('newProject.template')} value={template}
                onChange={v => setTemplate(v as TemplateKey)} options={templateOptions} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tCommon('calendar.worktime.shiftPreset')}</label>
              <Select aria-label={tCommon('calendar.worktime.shiftPreset')} value={shiftPreset}
                onChange={v => setShiftPreset(v as ShiftPresetKey)}
                options={WIZARD_PRESETS.map(k => ({ value: k, label: tCommon(SHIFT_PRESET_LABEL[k]) }))} />
            </div>

            <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
            <span className="text-text-secondary font-medium">{tMenu('wizard.calendar.country')}</span>
            <CalendarGeneratorFields
              value={calState}
              onChange={patch => setCalState(s => ({ ...s, ...patch }))}
              fromYear={calSpan.from}
              toYear={calSpan.to}
              noneLabel={tMenu('wizard.calendar.none')}
              extraCountryOptions={[{ value: 'custom', label: tMenu('wizard.calendar.custom') }]}
            />
          </>
        )}

        {storeChangedUnderDraft && dirty && (
          <div className="alert alert--warning" role="status" data-ops-scheduling-store-changed>
            {tCommon('schedulingProfile.storeChangedUnderDraft', { apply: tCommon('apply') })}
          </div>
        )}
        <SchedulingProfileSection mode={isNew ? 'wizard' : 'edit'} value={scheduling} onChange={setScheduling} />
      </div>
    );
  },
);
