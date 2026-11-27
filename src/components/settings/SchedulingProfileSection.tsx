import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { Select } from '@/components/common/Select';
import {
  BUILT_IN_PROFILE_IDS, CONVENTIONS, CONVENTION_THEMES, builtInConventions, isOffInEveryBuiltIn,
  resolveConventions, type ConventionDescriptor, type ConventionTheme,
} from '@/engine/scheduler/conventions/registry';
import {
  MAX_CUSTOM_PROFILES, deleteCustomProfile, loadCustomProfiles, upsertCustomProfileResult,
} from '@/services/schedulingProfiles/profileStore';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { NewProfileDialog } from '@/components/settings/NewProfileDialog';
import type { BuiltInProfileId, ConventionKey, ProjectSchedulingOptions, SchedulingProfile } from '@/types/project';
import { generateId } from '@/utils/id';
import { isHourModeCalendar } from '@/types/calendar';
import { effHoursPerDay } from '@/utils/taskDuration';
import {
  choiceOf, conventionsEditable, editConvention, hasValidProfileName, isModifiedBuiltIn, newProfileFrom, optionDeviations,
  optionDeviationsSignature, sameSettings,
  ssLagHasHourPlanning, profileLabel, renameProfile, type EffectiveOptions, type OptionDeviation,
  resetConventionToBase, selectProfile, templateRelation,
  totalFloatModeFromUi,
  totalFloatModeToUi, withCriticalMode, withCriticalThreshold, withDefaultOptions,
  SOURCE_ONLY_OPTION_KEYS, type ProfileChoice, type SchedulingSettingsDraft, type SourceOnlyOptionKey, type TotalFloatModeUi,
} from '@/state/schedulingProfileDraft';
import { refusalNotice } from '@/state/refusalNotice';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';

interface SchedulingProfileSectionProps {
  mode: 'wizard' | 'edit';
  value: SchedulingSettingsDraft;
  onChange: (next: SchedulingSettingsDraft) => void;
}

const conventionLabelKey = (id: ConventionKey): ParseKeys<'common'> => `conventions.${id}.label`;
const conventionHelpKey = (id: ConventionKey): ParseKeys<'common'> => `conventions.${id}.help`;
const builtInNameKey = (id: BuiltInProfileId): ParseKeys<'common'> => `profiles.builtIn.${id}`;

type ConventionGroupId = ConventionTheme | 'ownProfilesOnly';
const CONVENTION_GROUPS: readonly { id: ConventionGroupId; items: readonly ConventionDescriptor[] }[] = [
  ...CONVENTION_THEMES.map(theme => ({
    id: theme as ConventionGroupId,
    items: CONVENTIONS.filter(d => d.theme === theme && !isOffInEveryBuiltIn(d)),
  })),
  { id: 'ownProfilesOnly' as const, items: CONVENTIONS.filter(isOffInEveryBuiltIn) },
].filter(g => g.items.length > 0);

type ShownSourceOptionKey = Exclude<SourceOnlyOptionKey, 'leveling'>;
const SHOWN_SOURCE_OPTIONS = SOURCE_ONLY_OPTION_KEYS.filter((key): key is ShownSourceOptionKey => key !== 'leveling');
const sourceOptionKey = (key: ShownSourceOptionKey): ParseKeys<'common'> =>
  `schedulingProfile.sourceOptions.${key}`;
const themeTitleKey = (id: ConventionGroupId): ParseKeys<'common'> => `schedulingProfile.themes.${id}`;

const dismissedOptionNotices = new Set<string>();
const noticeKey = (documentId: string, signature: string) => `${documentId}\u0000${signature}`;

export function SchedulingProfileSection({ mode, value, onChange }: SchedulingProfileSectionProps) {
  const { t } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const { t: tTask } = useTranslation('task');
  const [templates, setTemplates] = useState(() => loadCustomProfiles());
  useStoredSettingRefresh('ops-schedulingProfiles', () => setTemplates(loadCustomProfiles()));
  const [conventionsOpen, setConventionsOpen] = useState(false);
  const [newProfileOpen, setNewProfileOpen] = useState(false);
  const notify = useAppStore(s => s.notify);
  const saveTemplate = (p: SchedulingProfile) => {
    if (!hasValidProfileName(p)) return;
    const name = p.name.trim();
    const result = upsertCustomProfileResult({ ...p, name });
    if (result === 'saved') {
      setTemplates(loadCustomProfiles());
      notify({ severity: 'info', messageKey: 'notifications.schedulingTemplateSaved', params: { name }, dedupeKey: `scheduling-template-saved:${p.id}` });
    } else if (result === 'limit') {
      notify(refusalNotice({ messageKey: 'notifications.schedulingTemplateLimit', params: { max: MAX_CUSTOM_PROFILES }, dedupeKey: 'scheduling-template-limit' }));
    } else if (result === 'storage') {
      notify({ severity: 'error', messageKey: 'notifications.schedulingTemplateStorageFailed', dedupeKey: 'scheduling-template-storage' });
    } else {
      console.warn('[rekenprofielen] sjabloon niet opgeslagen: ongeldig profiel', p.id);
    }
  };
  const [pendingDelete, setPendingDelete] = useState<SchedulingProfile | null>(null);
  const confirmDeleteTemplate = () => {
    if (!pendingDelete) return;
    if (!deleteCustomProfile(pendingDelete.id)) {
      notify({ severity: 'error', messageKey: 'notifications.schedulingTemplateDeleteFailed', dedupeKey: 'scheduling-template-storage' });
    }
    setTemplates(loadCustomProfiles());
    setPendingDelete(null);
  };
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  const appliedProfile = useAppStore(s => s.project.schedulingProfile);
  const appliedOptions = useAppStore(s => s.project.schedulingOptions);
  const [, setDismissTick] = useState(0);
  const durationDisplay = useAppStore(s => s.ui.durationDisplay);

  const projectCal = useAppStore(s => s.calendar);

  const profile = value.profile;
  const so: ProjectSchedulingOptions = value.options ?? {};
  const conventions = useMemo(() => resolveConventions(profile), [profile]);
  const baseId: BuiltInProfileId = profile?.baseId ?? 'ops';
  const base = useMemo(() => builtInConventions(baseId), [baseId]);
  const ssLagMissing: ConventionKey | null = !conventions.p6InProgressStartLagElapsed ? 'p6InProgressStartLagElapsed'
    : !conventions.p6UseRemainingStartForProgress ? 'p6UseRemainingStartForProgress' : null;
  const libraryCalendars = useAppStore(s => s.calendars);
  const tasks = useAppStore(s => s.tasks);
  const ssLagNoHourPlanning = !ssLagHasHourPlanning(so, tasks, projectCal, libraryCalendars);
  const label = profileLabel(profile);
  const relation = templateRelation(profile, templates);
  const brand = (id: BuiltInProfileId) => t(builtInNameKey(id));
  const currentName = label.kind === 'builtIn' ? brand(label.baseId) : label.name;
  const choice = choiceOf(profile, templates);
  const modifiedSource = profile && isModifiedBuiltIn(profile) ? profile
    : mode === 'edit' && appliedProfile && isModifiedBuiltIn(appliedProfile) ? appliedProfile : undefined;

  const choices: { value: ProfileChoice; label: string }[] = [
    ...BUILT_IN_PROFILE_IDS.map(id => ({ value: `builtin:${id}` as ProfileChoice, label: brand(id) })),
    ...(modifiedSource ? [{ value: 'modified' as ProfileChoice, label: t('profiles.modified', { name: brand(modifiedSource.baseId) }) }] : []),
    ...templates.map(tp => ({ value: `template:${tp.id}` as ProfileChoice, label: tp.name })),
    ...(choice === 'current' ? [{ value: 'current' as ProfileChoice, label: currentName }] : []),
  ];

  const onChoose = (next: ProfileChoice) => {
    const nextProfile = selectProfile(profile, next, templates, modifiedSource);
    onChange(mode === 'wizard'
      ? { profile: nextProfile, options: withDefaultOptions(nextProfile, value.options) }
      : { ...value, profile: nextProfile });
  };
  const patchOptions = (next: ProjectSchedulingOptions) => onChange({ ...value, options: next });

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent';
  const numCls =
    'w-20 px-2 py-1 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent';
  const labelCls = 'text-text-secondary font-medium';
  const btnCls = 'btn btn--secondary btn--sm';

  const select = (
    <div className={mode === 'edit' ? 'flex-1 min-w-0' : undefined} data-ops-scheduling-profile-select>
      <Select
        id="ops-scheduling-profile"
        value={choice}
        onChange={next => onChoose(next as ProfileChoice)}
        options={choices}
      />
    </div>
  );

  if (mode === 'wizard') {
    return (
      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="ops-scheduling-profile">{t('schedulingProfile.profile')}</label>
        {select}
      </div>
    );
  }

  const hpd = effHoursPerDay(projectCal);
  const hourUnit = (durationDisplay === 'hours' || (durationDisplay === 'auto' && isHourModeCalendar(projectCal)));
  const crit = so.criticalDefinition;
  const critMode = crit?.mode ?? 'totalFloat';
  const hoursThreshold = crit?.thresholdHours !== undefined;
  const ncEnabled = so.nearCriticalThreshold !== undefined;
  const ncDays = so.nearCriticalThreshold ?? 2;
  const ncDisplay = hourUnit ? +(ncDays * hpd).toFixed(2) : ncDays;
  const fp = so.floatPaths;
  const copyName = t('profiles.copyOf', { name: currentName });
  const editable = conventionsEditable(profile);
  const deviatingTotal = CONVENTIONS.filter(c => conventions[c.id] !== base[c.id]).length;
  const createProfile = (name: string) => {
    onChange({ ...value, profile: newProfileFrom(profile, { id: generateId('prof'), name }) });
    setNewProfileOpen(false);
    setConventionsOpen(true);
  };
  const templateName = templates.find(tp => tp.id === profile?.id)?.name ?? '';
  const nameValid = hasValidProfileName(profile);
  const deviations = optionDeviations(profile, appliedOptions);
  const deviationsSignature = optionDeviationsSignature(profile, deviations);
  const draftOnApplied = sameSettings({ profile: undefined, options: value.options }, { profile: undefined, options: appliedOptions });
  const showOptionsNotice = deviations.length > 0 && draftOnApplied
    && !dismissedOptionNotices.has(noticeKey(activeDocumentId, deviationsSignature));
  const optionsFromFile = SOURCE_ONLY_OPTION_KEYS.some(key => appliedOptions?.[key] !== undefined);
  const dismissOptionsNotice = () => {
    dismissedOptionNotices.add(noticeKey(activeDocumentId, deviationsSignature));
    setDismissTick(n => n + 1);
  };
  const optionFieldLabel = (key: OptionDeviation['key']): string => {
    switch (key) {
      case 'criticalDefinition': return tMenu('projectInfo.calc.criticalDefinition');
      case 'totalFloatMode': return tMenu('projectInfo.calc.totalFloatMode');
      case 'makeOpenEndedCritical': return tMenu('projectInfo.calc.makeOpenEndedCritical');
      case 'nearCriticalThreshold': return tMenu('projectInfo.calc.nearCritical');
      case 'floatPaths': return tMenu('projectInfo.calc.floatPaths');
      case 'lagCalendar': return tMenu('projectInfo.calc.lagCalendar');
      case 'startToStartLagFrom': return tMenu('projectInfo.calc.ssLagFrom');
    }
  };
  const onOff = (on: boolean) => (on ? t('schedulingProfile.on') : t('schedulingProfile.off'));
  const amount = (count: number, unit: 'hours' | 'days') => (unit === 'hours'
    ? t('schedulingProfile.optionsDeviate.hours', { count }) : t('schedulingProfile.optionsDeviate.days', { count }));
  const critLabel = (c: EffectiveOptions['criticalDefinition']) => (c.mode === 'longestPath'
    ? tMenu('projectInfo.calc.critLongestPath')
    : t('schedulingProfile.optionsDeviate.totalFloatAtMost', { amount: amount(c.value, c.unit) }));
  const optionValueLabel = (d: OptionDeviation, side: 'current' | 'standard'): string => {
    switch (d.key) {
      case 'criticalDefinition': return critLabel(d[side]);
      case 'totalFloatMode': {
        const v = d[side];
        if (v === 'auto') return t('schedulingProfile.optionsDeviate.tfAuto');
        return tMenu(v === 'smallest' ? 'projectInfo.calc.tfSmallest'
          : v === 'start' ? 'projectInfo.calc.tfStart' : 'projectInfo.calc.tfFinish');
      }
      case 'makeOpenEndedCritical': return onOff(d[side]);
      case 'nearCriticalThreshold': {
        const v = d[side];
        return v === null ? onOff(false) : amount(+(hourUnit ? v * hpd : v).toFixed(2), hourUnit ? 'hours' : 'days');
      }
      case 'floatPaths': {
        const v = d[side];
        return v === null ? onOff(false)
          : `${tMenu(v.method === 'FREE_FLOAT' ? 'projectInfo.calc.methodFree' : 'projectInfo.calc.methodTotal')}, ${tMenu('projectInfo.calc.maxPaths')} ${v.maxPaths}`;
      }
      case 'lagCalendar': {
        const v = d[side];
        return tMenu(v === 'predecessor' ? 'projectInfo.calc.lagPredecessor' : v === 'successor' ? 'projectInfo.calc.lagSuccessor'
          : v === '24hour' ? 'projectInfo.calc.lag24hour' : 'projectInfo.calc.lagProjectDefault');
      }
      case 'startToStartLagFrom':
        return tMenu(d[side] === 'actualStart' ? 'projectInfo.calc.ssLagActualStart' : 'projectInfo.calc.ssLagEarlyStart');
    }
  };
  const sourceOptions = SHOWN_SOURCE_OPTIONS.filter(key => so[key] !== undefined);

  return (
    <div className="flex flex-col gap-3" data-ops-scheduling-profile-section>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="text-body leading-5 font-semibold" style={{ fontFamily: 'var(--font-heading)' }} data-ops-scheduling-title>
        {t('schedulingProfile.title')}
      </span>
      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="ops-scheduling-profile">{t('schedulingProfile.profile')}</label>
        <div className="flex items-center gap-2">
          {select}
          <button type="button" className={`${btnCls} shrink-0 inline-flex items-center gap-1`}
            onClick={() => setNewProfileOpen(true)} data-ops-scheduling-new-profile>
            <Icon id="planning.profile-new" size={14} aria-hidden />
            {t('schedulingProfile.newProfile')}
          </button>
        </div>
      </div>
      {modifiedSource && choice === `builtin:${modifiedSource.baseId}` && (
        <div className="alert alert--info" data-ops-scheduling-bare-base-hint>
          {t('schedulingProfile.bareBaseHint', { name: brand(modifiedSource.baseId), modified: t('profiles.modified', { name: brand(modifiedSource.baseId) }) })}
        </div>
      )}
      {newProfileOpen && (
        <NewProfileDialog
          sourceName={currentName}
          initialName={copyName}
          onCreate={createProfile}
          onCancel={() => setNewProfileOpen(false)}
        />
      )}

      {label.kind === 'custom' && (
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="ops-scheduling-profile-name">{t('schedulingProfile.customName')}</label>
          <input
            id="ops-scheduling-profile-name"
            value={label.name}
            onChange={e => onChange({ ...value, profile: renameProfile(profile, e.target.value) })}
            className={inputCls}
            aria-invalid={!nameValid}
            data-ops-scheduling-profile-name
          />
          {!nameValid && (
            <div className="alert alert--warning" data-ops-scheduling-profile-name-required>
              {tTask('taskGrid.validation.required')}
            </div>
          )}
        </div>
      )}

      {relation === 'deviates' && (
        <div className="alert alert--warning" data-ops-scheduling-template-deviates>
          {t('schedulingProfile.templateDeviates', { name: templateName })}
        </div>
      )}

      {label.kind === 'custom' && profile && (
        <div className="flex flex-wrap gap-2">
          {relation === 'none' && (
            <button type="button" className={btnCls} onClick={() => saveTemplate(profile)} disabled={!nameValid} data-ops-scheduling-save-template>
              {t('schedulingProfile.saveAsTemplate')}
            </button>
          )}
          {relation === 'deviates' && (
            <>
              <button type="button" className={btnCls} onClick={() => saveTemplate(profile)} disabled={!nameValid} data-ops-scheduling-update-template>
                {t('schedulingProfile.updateTemplate')}
              </button>
              <button type="button" className={btnCls} onClick={() => onChoose(`template:${profile.id}`)} data-ops-scheduling-apply-template>
                {t('schedulingProfile.applyTemplate')}
              </button>
            </>
          )}
          {relation !== 'none' && (
            <button type="button" className={btnCls}
              onClick={() => setPendingDelete(templates.find(tp => tp.id === profile.id) ?? profile)} data-ops-scheduling-delete-template>
              {t('schedulingProfile.deleteTemplate')}
            </button>
          )}
        </div>
      )}
      {pendingDelete && (
        <ConfirmDialog
          message={t('schedulingProfile.deleteTemplateConfirm', { name: pendingDelete.name })}
          onConfirm={confirmDeleteTemplate}
          onCancel={() => setPendingDelete(null)}
          danger
        />
      )}

      <div className="flex flex-col gap-2" data-ops-scheduling-conventions
        data-ops-conventions-readonly={editable ? undefined : 'true'}>
        <button type="button" className="flex items-center gap-1.5 self-start text-left"
          aria-expanded={conventionsOpen} aria-controls="ops-scheduling-conventions-body"
          onClick={() => setConventionsOpen(open => !open)} data-ops-conventions-toggle>
          {conventionsOpen ? <Icon id="tree.collapse" size={14} aria-hidden /> : <Icon id="tree.expand" size={14} className="ops-icon-inline-flip" aria-hidden />}
          <span className={labelCls}>{t('schedulingProfile.conventionsTitle')}</span>
          <span className="text-text-secondary" data-ops-conventions-count>({CONVENTIONS.length})</span>
          {deviatingTotal > 0 && (
            <span className="badge badge--amber" data-ops-conventions-deviating>
              {t('schedulingProfile.deviatingCount', { n: deviatingTotal })}
            </span>
          )}
        </button>
        {conventionsOpen && (
          <div id="ops-scheduling-conventions-body" className="flex flex-col gap-2" data-ops-conventions-body>
            {!editable && (
              <div className="alert alert--info" data-ops-conventions-readonly-note>
                {deviatingTotal > 0
                  ? t('schedulingProfile.builtInDeviations', { name: brand(baseId), button: t('schedulingProfile.newProfile') })
                  : t('schedulingProfile.builtInReadOnly', { name: brand(baseId), button: t('schedulingProfile.newProfile') })}
              </div>
            )}
            {CONVENTION_GROUPS.map(group => {
              const deviating = group.items.filter(c => conventions[c.id] !== base[c.id]).length;
              return (
                <section key={group.id} className="flex flex-col gap-1 rounded-[8px] px-2 py-1.5"
                  style={{ border: '1px solid var(--theme-border-light)' }} data-ops-convention-group={group.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-body leading-5 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                      {t(themeTitleKey(group.id))}
                    </span>
                    <span className="text-text-secondary">({group.items.length})</span>
                    {deviating > 0 && (
                      <span className="badge badge--amber" data-ops-convention-group-deviating>
                        {t('schedulingProfile.deviatingCount', { n: deviating })}
                      </span>
                    )}
                  </div>
                  {group.id === 'ownProfilesOnly' && (
                    <div className="alert alert--info" data-ops-convention-own-only-note>{t('schedulingProfile.ownProfilesOnlyNote')}</div>
                  )}
                  {group.items.map(c => {
                    const name = t(conventionLabelKey(c.id));
                    const on = conventions[c.id];
                    const deviates = on !== base[c.id];
                    return (
                      <div key={c.id} className="flex items-start gap-1.5 rounded-[6px] px-1 py-0.5" data-ops-convention-row={c.id}
                        data-ops-convention-deviates={deviates ? 'true' : undefined}
                        style={deviates ? { background: 'color-mix(in srgb, var(--warning) 14%, transparent)' } : undefined}>
                        {editable ? (
                          <label className="flex items-start gap-1.5 min-w-0">
                            <input
                              type="checkbox"
                              className="accent-accent mt-0.5"
                              checked={on}
                              onChange={e => onChange({ ...value, profile: editConvention(profile, c.id, e.target.checked) })}
                              data-ops-convention={c.id}
                            />
                            <span className={deviates ? 'font-semibold' : undefined} data-ops-convention-label>{name}</span>
                          </label>
                        ) : (
                          <>
                            <span className={`badge ${on ? 'badge--green' : 'badge--gray'} shrink-0 min-w-[3.25em] text-center`}
                              data-ops-convention-value={c.id} data-value={on ? 'on' : 'off'}>
                              {on ? t('schedulingProfile.on') : t('schedulingProfile.off')}
                            </span>
                            <span className={deviates ? 'font-semibold min-w-0' : 'min-w-0'} data-ops-convention-label>{name}</span>
                          </>
                        )}
                        <button type="button"
                          className="mt-0.5 shrink-0 inline-flex rounded-[4px] text-text-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                          title={t(conventionHelpKey(c.id))} aria-label={t('schedulingProfile.showHelp', { name })}
                          data-tooltip-instant="true" data-ops-convention-help={c.id}>
                          <Icon id="help.context-hint" size={14} aria-hidden />
                        </button>
                        <span className="flex-1" />
                        {c.requires?.hourPlanning && (
                          <span className="badge badge--blue shrink-0" data-ops-convention-requires="hourPlanning"
                            title={t('schedulingProfile.requires.hourPlanningTitle')}>
                            {t('schedulingProfile.requires.hourPlanning')}
                          </span>
                        )}
                        {c.requires?.xerOrigin && (
                          <span className="badge badge--blue shrink-0" data-ops-convention-requires="xerOrigin">
                            {t('schedulingProfile.requires.xerOrigin')}
                          </span>
                        )}
                        {(editable || deviates) && (
                          <span className="shrink-0 whitespace-nowrap text-text-secondary" data-ops-convention-base>
                            {t('schedulingProfile.baseValue', { value: base[c.id] ? t('schedulingProfile.on') : t('schedulingProfile.off') })}
                          </span>
                        )}
                        {editable && deviates && (
                          <button type="button" className="shrink-0 whitespace-nowrap underline text-accent"
                            onClick={() => onChange({ ...value, profile: resetConventionToBase(profile, c.id) })}
                            data-ops-convention-reset={c.id}>
                            {t('schedulingProfile.resetToBase')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2" data-ops-scheduling-options>
        <span className={labelCls}>{t('schedulingProfile.optionsTitle')}</span>

        {showOptionsNotice && (
          <div className="alert alert--info relative flex flex-col gap-1.5 pr-8" data-ops-options-deviate-notice>
            <button type="button" className="absolute top-1.5 right-1.5 inline-flex rounded-[4px] p-0.5 text-text-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={t('close')} title={t('close')} onClick={dismissOptionsNotice} data-ops-options-deviate-dismiss>
              <Icon id="ui.close" size={14} aria-hidden />
            </button>
            <span>{optionsFromFile
              ? t('schedulingProfile.optionsDeviate.intro', { name: brand(baseId) })
              : t('schedulingProfile.optionsDeviate.introNeutral', { name: brand(baseId) })}</span>
            <ul className="flex flex-col gap-0.5 pl-4 list-disc">
              {deviations.map(d => (
                <li key={d.key} data-ops-options-deviation={d.key}>
                  {t('schedulingProfile.optionsDeviate.line', {
                    field: optionFieldLabel(d.key), current: optionValueLabel(d, 'current'), standard: optionValueLabel(d, 'standard'),
                  })}
                </li>
              ))}
            </ul>
            <button type="button" className={`${btnCls} self-start`}
              onClick={() => onChange({ ...value, options: withDefaultOptions(profile, value.options) })}
              data-ops-scheduling-apply-defaults>
              {t('schedulingProfile.optionsDeviate.useDefaults', { name: brand(baseId) })}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className={labelCls}>{tMenu('projectInfo.calc.criticalDefinition')}</label>
          <div className="grid grid-cols-2 gap-2">
            <Select
              aria-label={tMenu('projectInfo.calc.criticalDefinition')}
              value={critMode}
              onChange={v => patchOptions(withCriticalMode(so, v as 'totalFloat' | 'longestPath'))}
              options={[
                { value: 'totalFloat', label: tMenu('projectInfo.calc.critTotalFloat') },
                { value: 'longestPath', label: tMenu('projectInfo.calc.critLongestPath') },
              ]}
            />
            {critMode === 'totalFloat' && (
              <label className="flex flex-col gap-0.5">
                <input
                  type="number"
                  step="any"
                  value={hoursThreshold ? crit?.thresholdHours : (crit?.threshold ?? 0)}
                  onChange={e => {
                    const n = parseFloat(e.target.value);
                    patchOptions(withCriticalThreshold(so, hoursThreshold ? 'thresholdHours' : 'threshold', Number.isFinite(n) ? n : 0));
                  }}
                  className={numCls}
                  data-ops-crit-threshold
                />
                <span className="text-text-secondary" data-ops-crit-threshold-unit>
                  {hoursThreshold ? tMenu('projectInfo.calc.critThresholdHours') : tMenu('projectInfo.calc.critThreshold')}
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>{tMenu('projectInfo.calc.totalFloatMode')}</label>
          <Select
            aria-label={tMenu('projectInfo.calc.totalFloatMode')}
            value={totalFloatModeToUi(so.totalFloatMode)}
            onChange={v => patchOptions({ ...so, totalFloatMode: totalFloatModeFromUi(v as TotalFloatModeUi) })}
            options={[
              { value: 'auto', label: tMenu('projectInfo.calc.tfAuto') },
              { value: 'smallest', label: tMenu('projectInfo.calc.tfSmallest') },
              { value: 'start', label: tMenu('projectInfo.calc.tfStart') },
              { value: 'finish', label: tMenu('projectInfo.calc.tfFinish') },
            ]}
          />
        </div>

        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-accent" checked={!!so.makeOpenEndedCritical}
            onChange={e => patchOptions({ ...so, makeOpenEndedCritical: e.target.checked || undefined })} data-ops-open-ended />
          {tMenu('projectInfo.calc.makeOpenEndedCritical')}
        </label>

        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="accent-accent" checked={ncEnabled}
              onChange={e => patchOptions({ ...so, nearCriticalThreshold: e.target.checked ? 2 : undefined })} data-ops-near-critical-enable />
            {tMenu('projectInfo.calc.nearCritical')}
          </label>
          {ncEnabled && (
            <div className="flex items-center gap-2 pl-5">
              <span className="text-text-secondary">{tMenu('projectInfo.calc.nearCriticalThreshold')}</span>
              <input type="number" step="any" min={0} aria-label={tMenu('projectInfo.calc.nearCriticalThreshold')} value={ncDisplay}
                onChange={e => {
                  const n = parseFloat(e.target.value);
                  if (!Number.isFinite(n)) return;
                  patchOptions({ ...so, nearCriticalThreshold: hourUnit && hpd > 0 ? n / hpd : n });
                }}
                className={numCls} data-ops-near-critical-threshold />
              <span className="text-text-secondary">{hourUnit ? tMenu('projectInfo.calc.unitHours') : tMenu('projectInfo.calc.unitDays')}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="accent-accent" checked={!!fp?.enabled}
              onChange={e => patchOptions({ ...so, floatPaths: e.target.checked
                ? { enabled: true, method: fp?.method ?? 'FREE_FLOAT', maxPaths: fp?.maxPaths ?? 10 } : undefined })}
              data-ops-float-paths-enable />
            {tMenu('projectInfo.calc.floatPaths')}
          </label>
          {fp?.enabled && (
            <div className="grid grid-cols-2 gap-2 pl-5">
              <Select aria-label={tMenu('projectInfo.calc.floatPathsMethod')} value={fp.method}
                onChange={v => patchOptions({ ...so, floatPaths: { ...fp, method: v as 'FREE_FLOAT' | 'TOTAL_FLOAT' } })}
                options={[
                  { value: 'FREE_FLOAT', label: tMenu('projectInfo.calc.methodFree') },
                  { value: 'TOTAL_FLOAT', label: tMenu('projectInfo.calc.methodTotal') },
                ]} />
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">{tMenu('projectInfo.calc.maxPaths')}</span>
                <input type="number" min={1} step={1} aria-label={tMenu('projectInfo.calc.maxPaths')} value={fp.maxPaths}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    patchOptions({ ...so, floatPaths: { ...fp, maxPaths: Number.isFinite(n) && n > 0 ? n : 10 } });
                  }}
                  className={numCls} data-ops-max-paths />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>{tMenu('projectInfo.calc.lagCalendar')}</label>
          <Select aria-label={tMenu('projectInfo.calc.lagCalendar')} value={so.lagCalendar ?? 'predecessor'}
            onChange={v => patchOptions({ ...so, lagCalendar: v as ProjectSchedulingOptions['lagCalendar'] })}
            options={[
              { value: 'predecessor', label: tMenu('projectInfo.calc.lagPredecessor') },
              { value: 'successor', label: tMenu('projectInfo.calc.lagSuccessor') },
              { value: '24hour', label: tMenu('projectInfo.calc.lag24hour') },
              { value: 'projectDefault', label: tMenu('projectInfo.calc.lagProjectDefault') },
            ]} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>{tMenu('projectInfo.calc.ssLagFrom')}</label>
          <Select aria-label={tMenu('projectInfo.calc.ssLagFrom')} value={so.startToStartLagFrom ?? 'earlyStart'}
            disabled={ssLagMissing !== null || ssLagNoHourPlanning}
            onChange={v => patchOptions({ ...so, startToStartLagFrom: v as ProjectSchedulingOptions['startToStartLagFrom'] })}
            options={[
              { value: 'earlyStart', label: tMenu('projectInfo.calc.ssLagEarlyStart') },
              { value: 'actualStart', label: tMenu('projectInfo.calc.ssLagActualStart') },
            ]} />
          {ssLagMissing && (
            <div className="alert alert--info" data-ops-ss-lag-needs-convention>
              {tMenu('projectInfo.calc.ssLagNeedsConvention', { convention: t(conventionLabelKey(ssLagMissing)) })}
            </div>
          )}
          {!ssLagMissing && ssLagNoHourPlanning && (
            <div className="alert alert--info" data-ops-ss-lag-needs-hour-planning>
              {tMenu('projectInfo.calc.ssLagNeedsHourPlanning')}
            </div>
          )}
        </div>
      </div>

      {sourceOptions.length > 0 && (
        <div className="alert alert--info flex flex-col gap-1" data-ops-scheduling-source-options>
          <span className="font-semibold">{t('schedulingProfile.sourceOptions.title')}</span>
          <span>{t('schedulingProfile.sourceOptions.intro')}</span>
          {sourceOptions.map(key => (
            <div key={key} className="flex flex-col" data-ops-scheduling-source-option={key}>
              <span>
                {t(sourceOptionKey(key))}: <strong>{so[key] ? t('schedulingProfile.on') : t('schedulingProfile.off')}</strong>
              </span>
              {key === 'p6CompletedLateFromRemainingWindow' && so[key] && !conventions.p6CompletedDataDateWindow && (
                <span data-ops-scheduling-source-option-inert>
                  {t('schedulingProfile.sourceOptions.needsConvention', {
                    convention: t('conventions.p6CompletedDataDateWindow.label'),
                  })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
