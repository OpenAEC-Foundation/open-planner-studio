import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import type { SchedulingOptions } from '@/types/project';
import { isHourCalendar } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';

/**
 * Fase 2.9 §5.7/§7 (besluit B5) — "Berekening"-sectie in de project-info-dialoog. PROJECT-scoped
 * reken-opties (`project.schedulingOptions`), NIET de 3 app-instellingen-ingangen: een
 * scheduling-optie verandert de BEREKENDE planning, dus hij hoort bij het bestand (reproduceerbaar
 * over machines) — motivatie §7. Elke control schrijft live naar de store en herberekent, zodat het
 * effect (near-critical amber, langste-pad-keten, …) meteen zichtbaar is. Leeg/afwezig = huidig
 * gedrag (byte-identiek).
 *
 * NB: `progressMode`/`statusDate` (ook project-scoped) hebben hun UI in de Ribbon, niet in deze
 * dialoog; dit blok is de natuurlijke project-scoped uitbreiding volgens B5.
 */
export function CalcOptionsSection() {
  const { t } = useTranslation('menu');
  const so = useAppStore(s => s.project.schedulingOptions) ?? {};
  const setProject = useAppStore(s => s.setProject);
  const runCPM = useAppStore(s => s.runCPM);
  const durationDisplay = useAppStore(s => s.ui.durationDisplay);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const projectCal = useAppStore(s => s.calendar);

  // Wijzig één sleutel en herbereken meteen (live effect). `undefined` = terug naar default ⇒
  // JSON.stringify laat de sleutel weg ⇒ byte-identiek bij opslaan.
  const patch = (p: Partial<SchedulingOptions>) => {
    setProject({ schedulingOptions: { ...so, ...p } });
    runCPM();
  };

  // Near-critical-drempel-eenheid volgt de Duurweergave (besluit B3). De WAARDE staat altijd in
  // werkdagen; bij uren-weergave tonen/lezen we `werkdagen × u/dag`.
  const hpd = effHoursPerDay(projectCal);
  const hourUnit = enableHourPlanning
    && (durationDisplay === 'hours' || (durationDisplay === 'auto' && isHourCalendar(projectCal)));

  const critMode = so.criticalDefinition?.mode ?? 'totalFloat';
  const critThreshold = so.criticalDefinition?.threshold ?? 0;
  const tfMode = so.totalFloatMode ?? 'smallest';
  const ncEnabled = so.nearCriticalThreshold !== undefined;
  const ncDays = so.nearCriticalThreshold ?? 2;
  const ncDisplay = hourUnit ? +(ncDays * hpd).toFixed(2) : ncDays;
  const fp = so.floatPaths;
  const lagCal = so.lagCalendar ?? 'predecessor';

  const labelCls = 'text-text-secondary font-medium';
  const numCls =
    'w-20 px-2 py-1 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent';

  return (
    <div className="flex flex-col gap-3">
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('projectInfo.calc.title')}
        </span>
        <span className="text-[11px] text-text-secondary">{t('projectInfo.calc.subtitle')}</span>
      </div>

      {/* Kritiek-definitie */}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>{t('projectInfo.calc.criticalDefinition')}</label>
        <div className="grid grid-cols-2 gap-2">
          <Select
            aria-label={t('projectInfo.calc.criticalDefinition')}
            value={critMode}
            onChange={v => patch({ criticalDefinition: { mode: v as 'totalFloat' | 'longestPath', threshold: critThreshold } })}
            options={[
              { value: 'totalFloat', label: t('projectInfo.calc.critTotalFloat') },
              { value: 'longestPath', label: t('projectInfo.calc.critLongestPath') },
            ]}
          />
          {critMode === 'totalFloat' && (
            <input
              type="number"
              step="any"
              aria-label={t('projectInfo.calc.critThreshold')}
              title={t('projectInfo.calc.critThreshold')}
              value={critThreshold}
              onChange={e => {
                const n = parseFloat(e.target.value);
                patch({ criticalDefinition: { mode: 'totalFloat', threshold: Number.isFinite(n) ? n : 0 } });
              }}
              className={numCls}
              data-ops-crit-threshold
            />
          )}
        </div>
      </div>

      {/* Speling-berekeningswijze */}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>{t('projectInfo.calc.totalFloatMode')}</label>
        <Select
          aria-label={t('projectInfo.calc.totalFloatMode')}
          value={tfMode}
          onChange={v => patch({ totalFloatMode: v as 'start' | 'finish' | 'smallest' })}
          options={[
            { value: 'smallest', label: t('projectInfo.calc.tfSmallest') },
            { value: 'start', label: t('projectInfo.calc.tfStart') },
            { value: 'finish', label: t('projectInfo.calc.tfFinish') },
          ]}
        />
      </div>

      {/* Open-eind-taken kritiek */}
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={!!so.makeOpenEndedCritical}
          onChange={e => patch({ makeOpenEndedCritical: e.target.checked || undefined })}
          className="accent-accent"
          data-ops-open-ended
        />
        {t('projectInfo.calc.makeOpenEndedCritical')}
      </label>

      {/* Near-critical (default UIT; inschakelen ⇒ default 2 werkdagen; eenheid volgt Duurweergave) */}
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={ncEnabled}
            onChange={e => patch({ nearCriticalThreshold: e.target.checked ? 2 : undefined })}
            className="accent-accent"
            data-ops-near-critical-enable
          />
          {t('projectInfo.calc.nearCritical')}
        </label>
        {ncEnabled && (
          <div className="flex items-center gap-2 pl-5">
            <span className="text-text-secondary">{t('projectInfo.calc.nearCriticalThreshold')}</span>
            <input
              type="number"
              step="any"
              min={0}
              aria-label={t('projectInfo.calc.nearCriticalThreshold')}
              value={ncDisplay}
              onChange={e => {
                const n = parseFloat(e.target.value);
                if (!Number.isFinite(n)) return;
                patch({ nearCriticalThreshold: hourUnit && hpd > 0 ? n / hpd : n });
              }}
              className={numCls}
              data-ops-near-critical-threshold
            />
            <span className="text-text-secondary">
              {hourUnit ? t('projectInfo.calc.unitHours') : t('projectInfo.calc.unitDays')}
            </span>
          </div>
        )}
      </div>

      {/* Meerdere speling-paden (default FREE_FLOAT, maxPaths 10) */}
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!fp?.enabled}
            onChange={e => patch({ floatPaths: e.target.checked ? { enabled: true, method: fp?.method ?? 'FREE_FLOAT', maxPaths: fp?.maxPaths ?? 10 } : undefined })}
            className="accent-accent"
            data-ops-float-paths-enable
          />
          {t('projectInfo.calc.floatPaths')}
        </label>
        {fp?.enabled && (
          <div className="grid grid-cols-2 gap-2 pl-5">
            <Select
              aria-label={t('projectInfo.calc.floatPathsMethod')}
              value={fp.method}
              onChange={v => patch({ floatPaths: { ...fp, method: v as 'FREE_FLOAT' | 'TOTAL_FLOAT' } })}
              options={[
                { value: 'FREE_FLOAT', label: t('projectInfo.calc.methodFree') },
                { value: 'TOTAL_FLOAT', label: t('projectInfo.calc.methodTotal') },
              ]}
            />
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">{t('projectInfo.calc.maxPaths')}</span>
              <input
                type="number"
                min={1}
                step={1}
                aria-label={t('projectInfo.calc.maxPaths')}
                value={fp.maxPaths}
                onChange={e => {
                  const n = parseInt(e.target.value, 10);
                  patch({ floatPaths: { ...fp, maxPaths: Number.isFinite(n) && n > 0 ? n : 10 } });
                }}
                className={numCls}
                data-ops-max-paths
              />
            </div>
          </div>
        )}
      </div>

      {/* Lag-kalender (4-way, default predecessor) */}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>{t('projectInfo.calc.lagCalendar')}</label>
        <Select
          aria-label={t('projectInfo.calc.lagCalendar')}
          value={lagCal}
          onChange={v => patch({ lagCalendar: v as SchedulingOptions['lagCalendar'] })}
          options={[
            { value: 'predecessor', label: t('projectInfo.calc.lagPredecessor') },
            { value: 'successor', label: t('projectInfo.calc.lagSuccessor') },
            { value: '24hour', label: t('projectInfo.calc.lag24hour') },
            { value: 'projectDefault', label: t('projectInfo.calc.lagProjectDefault') },
          ]}
        />
      </div>
    </div>
  );
}
