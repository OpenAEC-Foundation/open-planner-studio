import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Select } from '@/components/common/Select';
import {
  BUILT_IN_PROFILE_IDS, CONVENTIONS, displayNameKey, resolveConventions,
} from '@/engine/scheduler/conventions/registry';
import { deleteCustomProfile, loadCustomProfiles, upsertCustomProfile } from '@/services/schedulingProfiles/profileStore';
import type { BuiltInProfileId, ProjectSchedulingOptions, SchedulingProfile } from '@/types/project';
import { generateId } from '@/utils/id';
import { isHourCalendar } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import {
  choiceOf, editConvention, profileLabel, renameProfile, selectProfile, templateRelation, totalFloatModeFromUi,
  totalFloatModeToUi, withCriticalMode, withCriticalThreshold, withDefaultOptions,
  type ProfileChoice, type SchedulingSettingsDraft, type TotalFloatModeUi,
} from '@/state/schedulingProfileDraft';

interface SchedulingProfileSectionProps {
  /** 'wizard' = alleen de keuzelijst; een keuze past meteen de standaardopties van dat profiel toe.
   *  'edit' = het volledige blok (dialoog én Backstage → Projectinfo). */
  mode: 'wizard' | 'edit';
  /** DRAFT (lokale kopie in ProjectInfoPanelContent), NIET de store. */
  value: SchedulingSettingsDraft;
  onChange: (next: SchedulingSettingsDraft) => void;
}

// De i18n-typering kent alleen letterlijke sleutels; de conventie- en profielsleutels komen uit het
// register (`labelKey`, `displayNameKey`) en worden daarom naar één concrete sleutel gecast (zelfde
// patroon als `SHIFT_PRESET_LABEL` in ProjectInfoPanelContent). `check-conventions-registry` sectie 8
// bewijst dat elke sleutel in alle 14 locales bestaat.
type ConventionLabelKey = 'conventions.clampNegativeFreeFloat.label';
type BuiltInNameKey = 'profiles.builtIn.ops';

/**
 * Rekenprofielen (spec v3.1 §6) — opvolger van `CalcOptionsSection`. Bovenaan het profiel (ingebouwd,
 * eigen sjablonen, of het eigen profiel van dit project), daaronder de twintig conventies en de negen
 * projectopties. Commit gebeurt pas op Toepassen via `applySchedulingSettings` (één undo-stap,
 * herberekenen, melding "N taken verschoven"). Alleen sjablonen opslaan/verwijderen gaat direct: dat
 * is app-data, geen projectdata.
 */
export function SchedulingProfileSection({ mode, value, onChange }: SchedulingProfileSectionProps) {
  const { t } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  // Eigen sjablonen: app-globaal, buiten de store (profileStore). Lezen bij mount; na opslaan of
  // verwijderen opnieuw lezen, zodat de lijst gelijk is aan wat er gepersisteerd staat.
  const [templates, setTemplates] = useState(() => loadCustomProfiles());
  const saveTemplate = (p: SchedulingProfile) => {
    if (upsertCustomProfile(p)) setTemplates(loadCustomProfiles());
  };
  const deleteTemplate = (id: string) => {
    deleteCustomProfile(id);
    setTemplates(loadCustomProfiles());
  };
  const durationDisplay = useAppStore(s => s.ui.durationDisplay);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const projectCal = useAppStore(s => s.calendar);

  const profile = value.profile;
  const so: ProjectSchedulingOptions = value.options ?? {};
  const conventions = useMemo(() => resolveConventions(profile), [profile]);
  const label = profileLabel(profile);
  const relation = templateRelation(profile, templates);
  const brand = (id: BuiltInProfileId) => t(displayNameKey(id) as BuiltInNameKey);
  const currentName = label.kind === 'builtIn' ? brand(label.baseId) : label.name;
  const choice = choiceOf(profile, templates);

  const choices: { value: ProfileChoice; label: string }[] = [
    ...BUILT_IN_PROFILE_IDS.map(id => ({
      value: `builtin:${id}` as ProfileChoice,
      // "(aangepast)" volgt diffAgainstBase (profileLabel), niet het aantal sleutels in overrides.
      label: label.kind === 'builtIn' && label.baseId === id && label.modified
        ? t('profiles.modified', { name: brand(id) }) : brand(id),
    })),
    ...templates.map(tp => ({ value: `template:${tp.id}` as ProfileChoice, label: tp.name })),
    ...(choice === 'current' ? [{ value: 'current' as ProfileChoice, label: currentName }] : []),
  ];

  const onChoose = (next: ProfileChoice) => {
    const nextProfile = selectProfile(profile, next, templates);
    onChange(mode === 'wizard'
      ? { profile: nextProfile, options: withDefaultOptions(nextProfile) }
      : { ...value, profile: nextProfile });
  };
  const patchOptions = (next: ProjectSchedulingOptions) => onChange({ ...value, options: next });

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent';
  const numCls =
    'w-20 px-2 py-1 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent';
  const labelCls = 'text-text-secondary font-medium';
  const btnCls = 'btn btn--secondary btn--sm';

  const profileSelect = (
    <div className="flex flex-col gap-1">
      <label className={labelCls} htmlFor="ops-scheduling-profile">{t('schedulingProfile.profile')}</label>
      <select
        id="ops-scheduling-profile"
        value={choice}
        onChange={e => onChoose(e.target.value as ProfileChoice)}
        className={inputCls}
        data-ops-scheduling-profile-select
      >
        {choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </div>
  );

  if (mode === 'wizard') return profileSelect;

  // Reken-opties (overgenomen uit CalcOptionsSection, met twee reparaties: 'auto' voor afwezig, en
  // thresholdHours die bij een bewerking niet meer wegvalt — spec v3.1 §6, A6/A7).
  const hpd = effHoursPerDay(projectCal);
  const hourUnit = enableHourPlanning
    && (durationDisplay === 'hours' || (durationDisplay === 'auto' && isHourCalendar(projectCal)));
  const crit = so.criticalDefinition;
  const critMode = crit?.mode ?? 'totalFloat';
  const hoursThreshold = crit?.thresholdHours !== undefined;
  const ncEnabled = so.nearCriticalThreshold !== undefined;
  const ncDays = so.nearCriticalThreshold ?? 2;
  const ncDisplay = hourUnit ? +(ncDays * hpd).toFixed(2) : ncDays;
  const fp = so.floatPaths;
  const copyTarget = () => ({ id: generateId('prof'), name: t('profiles.copyOf', { name: currentName }) });
  const templateName = templates.find(tp => tp.id === profile?.id)?.name ?? '';

  return (
    <div className="flex flex-col gap-3" data-ops-scheduling-profile-section>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="text-body leading-5 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
        {t('schedulingProfile.title')}
      </span>
      {profileSelect}

      {label.kind === 'custom' && (
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="ops-scheduling-profile-name">{t('schedulingProfile.customName')}</label>
          <input
            id="ops-scheduling-profile-name"
            value={label.name}
            onChange={e => onChange({ ...value, profile: renameProfile(profile, e.target.value) })}
            className={inputCls}
            data-ops-scheduling-profile-name
          />
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
            <button type="button" className={btnCls} onClick={() => saveTemplate(profile)} data-ops-scheduling-save-template>
              {t('schedulingProfile.saveAsTemplate')}
            </button>
          )}
          {relation === 'deviates' && (
            <>
              <button type="button" className={btnCls} onClick={() => saveTemplate(profile)} data-ops-scheduling-update-template>
                {t('schedulingProfile.updateTemplate')}
              </button>
              <button type="button" className={btnCls} onClick={() => onChoose(`template:${profile.id}`)} data-ops-scheduling-apply-template>
                {t('schedulingProfile.applyTemplate')}
              </button>
            </>
          )}
          {relation !== 'none' && (
            <button type="button" className={btnCls} onClick={() => deleteTemplate(profile.id)} data-ops-scheduling-delete-template>
              {t('schedulingProfile.deleteTemplate')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1" data-ops-scheduling-conventions>
        <span className={labelCls}>{t('schedulingProfile.conventionsTitle')}</span>
        {CONVENTIONS.map(c => (
          <label key={c.id} className="flex items-center gap-1.5" title={t(`${c.labelKey}.help` as ConventionLabelKey)}>
            <input
              type="checkbox"
              className="accent-accent"
              checked={conventions[c.id]}
              onChange={e => onChange({ ...value, profile: editConvention(profile, c.id, e.target.checked, copyTarget()) })}
              data-ops-convention={c.id}
            />
            {t(`${c.labelKey}.label` as ConventionLabelKey)}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2" data-ops-scheduling-options>
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>{t('schedulingProfile.optionsTitle')}</span>
          <button type="button" className={btnCls} onClick={() => onChange({ ...value, options: withDefaultOptions(profile) })}
            data-ops-scheduling-apply-defaults>
            {t('schedulingProfile.applyDefaultOptions')}
          </button>
        </div>

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
              <input
                type="number"
                step="any"
                aria-label={hoursThreshold ? tMenu('projectInfo.calc.critThresholdHours') : tMenu('projectInfo.calc.critThreshold')}
                title={hoursThreshold ? tMenu('projectInfo.calc.critThresholdHours') : tMenu('projectInfo.calc.critThreshold')}
                value={hoursThreshold ? crit?.thresholdHours : (crit?.threshold ?? 0)}
                onChange={e => {
                  const n = parseFloat(e.target.value);
                  patchOptions(withCriticalThreshold(so, hoursThreshold ? 'thresholdHours' : 'threshold', Number.isFinite(n) ? n : 0));
                }}
                className={numCls}
                data-ops-crit-threshold
              />
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
      </div>
    </div>
  );
}
