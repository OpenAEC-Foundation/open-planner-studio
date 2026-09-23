import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Select } from '@/components/common/Select';
import {
  BUILT_IN_PROFILE_IDS, CONVENTIONS, CONVENTION_THEMES, builtInConventions, displayNameKey, isOffInEveryBuiltIn,
  resolveConventions, type ConventionDescriptor, type ConventionTheme,
} from '@/engine/scheduler/conventions/registry';
import { deleteCustomProfile, loadCustomProfiles, upsertCustomProfile } from '@/services/schedulingProfiles/profileStore';
import type { BuiltInProfileId, ConventionKey, ProjectSchedulingOptions, SchedulingProfile } from '@/types/project';
import { generateId } from '@/utils/id';
import { isHourCalendar } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import {
  choiceOf, editConvention, hasValidProfileName, profileLabel, renameProfile, resetConventionToBase, selectProfile, templateRelation,
  totalFloatModeFromUi,
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
type ThemeTitleKey = 'schedulingProfile.themes.completedWork';

/** De groepen in het blok: de zes thema's uit het register, en als laatste de conventies die in élk
 *  ingebouwd profiel uit staan (alleen in een eigen profiel aan te zetten). Een lege groep valt weg. */
type ConventionGroupId = ConventionTheme | 'ownProfilesOnly';
const CONVENTION_GROUPS: readonly { id: ConventionGroupId; items: readonly ConventionDescriptor[] }[] = [
  ...CONVENTION_THEMES.map(theme => ({
    id: theme as ConventionGroupId,
    items: CONVENTIONS.filter(d => d.theme === theme && !isOffInEveryBuiltIn(d)),
  })),
  { id: 'ownProfilesOnly' as const, items: CONVENTIONS.filter(isOffInEveryBuiltIn) },
].filter(g => g.items.length > 0);

/** De drie projectopties die alleen uit een P6-bestand komen en in het blok niet te wijzigen zijn
 *  (gebruikstest B10): alleen-lezen getoond, zodat zichtbaar is waarom twee projecten met hetzelfde
 *  profiel anders rekenen. */
const SOURCE_ONLY_OPTIONS = ['useExpectedFinishDates', 'useProjectEndDateForFloat', 'p6CompletedLateFromRemainingWindow'] as const;
type SourceOptionKey = 'schedulingProfile.sourceOptions.useExpectedFinishDates';

/**
 * Rekenprofielen (spec v3.1 §6) — opvolger van `CalcOptionsSection`. Bovenaan het profiel (ingebouwd,
 * eigen sjablonen, of het eigen profiel van dit project), daaronder de zesentwintig conventies (per thema
 * uit het register, met de basiswaarde, "terug naar basis" en uitklapbare uitleg per regel) en zeven van de
 * tien projectopties (kritiek-definitie met drempel, speling-berekening, open-eind kritiek, bijna-
 * kritiek, meerdere speling-paden, lag-kalender, SS-lag-variant van C6). De andere drie — `useExpectedFinishDates`,
 * `useProjectEndDateForFloat` en `p6CompletedLateFromRemainingWindow` — zijn bewust NIET bewerkbaar:
 * het zijn P6-bronsignalen die de XER-lezer uit SCHEDOPTIONS zet (of die aan de P6-herkomstketen van
 * B3/B4 hangen), zonder betekenis voor een project dat niet uit P6 komt. Het blok toont ze onderaan alleen-lezen
 * (gebruikstest B10) en laat ze verder ongemoeid
 * (elke optiewijziging spreidt de bestaande opties); alleen "Standaardopties van dit profiel
 * toepassen" vervangt alle opties door `defaultOptionsFor` (onder P6 zet dat de eerste en de laatste
 * aan; `useProjectEndDateForFloat` valt dan weg, want die komt alleen uit het bestand). Commit gebeurt pas op Toepassen via `applySchedulingSettings` (één undo-stap,
 * herberekenen, melding "N taken verschoven"). Alleen sjablonen opslaan/verwijderen gaat direct: dat
 * is app-data, geen projectdata.
 */
export function SchedulingProfileSection({ mode, value, onChange }: SchedulingProfileSectionProps) {
  const { t } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const { t: tTask } = useTranslation('task');
  // Eigen sjablonen: app-globaal, buiten de store (profileStore). Lezen bij mount; na opslaan of
  // verwijderen opnieuw lezen, zodat de lijst gelijk is aan wat er gepersisteerd staat.
  const [templates, setTemplates] = useState(() => loadCustomProfiles());
  // Welke conventie-uitleg is opengeklapt (sessielokaal, geen draft-data).
  const [openHelp, setOpenHelp] = useState<ReadonlySet<ConventionKey>>(() => new Set());
  const toggleHelp = (id: ConventionKey) => setOpenHelp(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const saveTemplate = (p: SchedulingProfile) => {
    // Een sjabloon zonder naam is niet te kiezen; de knop staat dan uit, dit is de vangrail.
    if (!hasValidProfileName(p)) return;
    if (upsertCustomProfile({ ...p, name: p.name.trim() })) setTemplates(loadCustomProfiles());
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
  // De basiswaarden van het gekozen profiel (een eigen profiel: zijn ingebouwde basis).
  const baseId: BuiltInProfileId = profile?.baseId ?? 'ops';
  const base = useMemo(() => builtInConventions(baseId), [baseId]);
  // De SS-lag-projectoptie werkt alleen met C6 én A19 aan (`CPMSolver.inProgressStartLag`).
  const ssLagMissing: ConventionKey | null = !conventions.p6InProgressStartLagElapsed ? 'p6InProgressStartLagElapsed'
    : !conventions.p6UseRemainingStartForProgress ? 'p6UseRemainingStartForProgress' : null;
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
  const nameValid = hasValidProfileName(profile);
  // Alleen de opties die het project echt draagt; een project zonder P6-bron toont het blok niet.
  const sourceOptions = SOURCE_ONLY_OPTIONS.filter(key => so[key] !== undefined);

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
            aria-invalid={!nameValid}
            data-ops-scheduling-profile-name
          />
          {!nameValid && (
            // Leeg mag tijdens het bewerken; opslaan als sjabloon en Toepassen weigeren het.
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
            <button type="button" className={btnCls} onClick={() => deleteTemplate(profile.id)} data-ops-scheduling-delete-template>
              {t('schedulingProfile.deleteTemplate')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2" data-ops-scheduling-conventions>
        <span className={labelCls}>{t('schedulingProfile.conventionsTitle')}</span>
        {CONVENTION_GROUPS.map(group => {
          const deviating = group.items.filter(c => conventions[c.id] !== base[c.id]).length;
          return (
            <section key={group.id} className="flex flex-col gap-1 rounded-[8px] px-2 py-1.5"
              style={{ border: '1px solid var(--theme-border-light)' }} data-ops-convention-group={group.id}>
              <div className="flex items-center gap-2">
                <span className="text-body leading-5 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                  {t(`schedulingProfile.themes.${group.id}` as ThemeTitleKey)}
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
                const name = t(`${c.labelKey}.label` as ConventionLabelKey);
                const deviates = conventions[c.id] !== base[c.id];
                const helpOpen = openHelp.has(c.id);
                return (
                  <div key={c.id} className="flex flex-col gap-1" data-ops-convention-row={c.id}
                    data-ops-convention-deviates={deviates ? 'true' : undefined}>
                    <div className="flex items-start gap-1.5 rounded-[6px] px-1 py-0.5"
                      style={deviates ? { background: 'color-mix(in srgb, #D97706 12%, transparent)' } : undefined}>
                      <button type="button" className="mt-0.5 shrink-0 text-text-secondary hover:text-text-primary"
                        aria-expanded={helpOpen} aria-label={t('schedulingProfile.showHelp', { name })}
                        onClick={() => toggleHelp(c.id)} data-ops-convention-help-toggle={c.id}>
                        {helpOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <label className="flex items-start gap-1.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          className="accent-accent mt-0.5"
                          checked={conventions[c.id]}
                          onChange={e => onChange({ ...value, profile: editConvention(profile, c.id, e.target.checked, copyTarget()) })}
                          data-ops-convention={c.id}
                        />
                        <span className={deviates ? 'font-semibold' : undefined} data-ops-convention-label>{name}</span>
                      </label>
                      {c.perFile && (
                        <span className="badge badge--blue shrink-0" data-ops-convention-per-file>{t('schedulingProfile.perFile')}</span>
                      )}
                      <span className="shrink-0 whitespace-nowrap text-text-secondary" data-ops-convention-base>
                        {t('schedulingProfile.baseValue', { value: base[c.id] ? t('schedulingProfile.on') : t('schedulingProfile.off') })}
                      </span>
                      {deviates && (
                        <button type="button" className="shrink-0 whitespace-nowrap underline text-accent"
                          onClick={() => onChange({ ...value, profile: resetConventionToBase(profile, c.id) })}
                          data-ops-convention-reset={c.id}>
                          {t('schedulingProfile.resetToBase')}
                        </button>
                      )}
                    </div>
                    {helpOpen && (
                      <div className="alert alert--info ml-5" data-ops-convention-help={c.id}>
                        {t(`${c.labelKey}.help` as ConventionLabelKey)}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
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
              // De eenheid staat zichtbaar bij het veld: een drempel uit een .xer staat in uren (per
              // taakkalender), een eigen drempel in werkdagen — zonder label is "8" dubbelzinnig.
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

        {/* P6 "Calculate Start-to-Start lag from": de variant van conventie C6, die in de motor alleen
            samen met A19 (`p6UseRemainingStartForProgress`) werkt. Staat een van beide uit, dan doet de
            optie niets: uitgeschakeld (de waarde blijft staan), met een zichtbaar blok dat de ontbrekende
            conventie noemt (gebruikstest B8: niet alleen een tooltip). */}
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{tMenu('projectInfo.calc.ssLagFrom')}</label>
          <Select aria-label={tMenu('projectInfo.calc.ssLagFrom')} value={so.startToStartLagFrom ?? 'earlyStart'}
            disabled={ssLagMissing !== null}
            onChange={v => patchOptions({ ...so, startToStartLagFrom: v as ProjectSchedulingOptions['startToStartLagFrom'] })}
            options={[
              { value: 'earlyStart', label: tMenu('projectInfo.calc.ssLagEarlyStart') },
              { value: 'actualStart', label: tMenu('projectInfo.calc.ssLagActualStart') },
            ]} />
          {ssLagMissing && (
            <div className="alert alert--info" data-ops-ss-lag-needs-convention>
              {tMenu('projectInfo.calc.ssLagNeedsConvention', { convention: t(`conventions.${ssLagMissing}.label` as ConventionLabelKey) })}
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
                {t(`schedulingProfile.sourceOptions.${key}` as SourceOptionKey)}: <strong>{so[key] ? t('schedulingProfile.on') : t('schedulingProfile.off')}</strong>
              </span>
              {key === 'p6CompletedLateFromRemainingWindow' && so[key] && !conventions.p6CompletedDataDateWindow && (
                <span data-ops-scheduling-source-option-inert>
                  {t('schedulingProfile.sourceOptions.needsConvention', {
                    convention: t('conventions.p6CompletedDataDateWindow.label' as ConventionLabelKey),
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
