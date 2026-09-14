import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import { useAppStore } from '@/state/appStore';
import { formatDate } from '@/utils/dateUtils';
import {
  REPORTING_PERIOD_PRESETS, type ReportingPeriod, type ReportingPeriodPreset, type ResolvedPeriod,
  isIsoDay, projectSpan, referenceDayOf, resolveReportingPeriod,
} from '@/engine/reports';

/**
 * Het gedeelde rapportageperiode-control (issue #120): één preset-keuzelijst (volgende/afgelopen
 * N weken of maand, hele project, aangepast) plus twee datumvelden. Bij een preset tonen de velden
 * de berekende datums alleen-lezen; bij *Aangepast* zijn ze bewerkbaar (tekstinvoer én de
 * browser-datumkiezer van `<input type="date">`). Een omgekeerd bereik (tot < van) wordt niet
 * doorgegeven maar rood gemarkeerd met een melding — het rapport blijft op de laatste geldige
 * periode staan. Wisselen van *Aangepast* terug naar een preset laat de eigen datums vallen;
 * wisselen náár *Aangepast* start met de datums van de preset die op dat moment gold.
 *
 * De opgeloste datums komen uit dezelfde pure functie als de engine (`resolveReportingPeriod`,
 * tegen dezelfde referentiedag en projectspanne), zodat wat hier staat exact het venster is dat het
 * rapport rekent — óók wanneer de statusdatum wijzigt.
 */
interface Props {
  id: string;
  value: ReportingPeriod;
  onChange: (next: ReportingPeriod) => void;
  /** `data-ops-report-option`-sleutel voor tests. */
  dataKey: string;
}

/** De referentiedag en projectspanne uit de live store — dezelfde bron als `useReportContext`. */
function useResolvedPeriod(period: ReportingPeriod): ResolvedPeriod {
  const tasks = useAppStore(s => s.tasks);
  const statusDate = useAppStore(s => s.project.statusDate);
  const today = formatDate(new Date());
  return useMemo(() => {
    const { day } = referenceDayOf(statusDate, today);
    return resolveReportingPeriod(period, day, projectSpan(tasks));
  }, [period, tasks, statusDate, today]);
}

export function ReportingPeriodField({ id, value, onChange, dataKey }: Props) {
  const { t } = useTranslation('report');
  const resolved = useResolvedPeriod(value);
  const isCustom = value.preset === 'custom';
  // Kladwaarden van de datumvelden: de gebruiker mag een datum half intypen zonder dat elke
  // toetsaanslag het rapport herrekent of het veld terugspringt; commit zodra beide geldig zijn.
  const [draftFrom, setDraftFrom] = useState(resolved.from);
  const [draftTo, setDraftTo] = useState(resolved.to);
  useEffect(() => { setDraftFrom(resolved.from); setDraftTo(resolved.to); }, [resolved.from, resolved.to]);

  const invalidRange = isCustom && isIsoDay(draftFrom) && isIsoDay(draftTo) && draftTo < draftFrom;

  const commitCustom = (from: string, to: string) => {
    if (!isIsoDay(from) || !isIsoDay(to) || to < from) return;
    if (from === value.from && to === value.to) return;
    onChange({ preset: 'custom', from, to });
  };

  const changePreset = (preset: ReportingPeriodPreset) => {
    if (preset === value.preset) return;
    // Naar Aangepast: start met de datums die de vorige keuze opleverde (die staan al in beeld).
    if (preset === 'custom') onChange({ preset: 'custom', from: resolved.from, to: resolved.to });
    else onChange({ preset });
  };

  const dateInput = (which: 'from' | 'to') => {
    const draft = which === 'from' ? draftFrom : draftTo;
    const setDraft = which === 'from' ? setDraftFrom : setDraftTo;
    return (
      <label className="flex items-center gap-1 min-w-0 flex-1">
        <span className="text-text-secondary flex-shrink-0">{t(which === 'from' ? 'tableReports.options.periodFrom' : 'tableReports.options.periodTo')}</span>
        <input
          type="date"
          value={draft}
          disabled={!isCustom}
          aria-invalid={invalidRange ? true : undefined}
          aria-describedby={invalidRange ? `${id}-invalid` : undefined}
          onChange={e => {
            const next = e.target.value;
            setDraft(next);
            if (which === 'from') commitCustom(next, draftTo); else commitCustom(draftFrom, next);
          }}
          className="input flex-1 min-w-0 !text-xs !px-2 !py-1"
          style={invalidRange ? { borderColor: 'var(--error)' } : undefined}
          data-ops-report-option={`${dataKey}.${which}`}
        />
      </label>
    );
  };

  return (
    <div className="flex flex-col gap-1 min-w-0" data-ops-report-period={dataKey}>
      <div className="flex items-center gap-2 min-w-0">
        <label className="text-text-secondary w-32 flex-shrink-0" htmlFor={id}>{t('tableReports.options.reportingPeriod')}</label>
        <Select
          id={id}
          className="flex-1 min-w-0"
          aria-label={t('tableReports.options.reportingPeriod')}
          value={value.preset}
          onChange={v => changePreset(v as ReportingPeriodPreset)}
          options={REPORTING_PERIOD_PRESETS.map(p => ({ value: p, label: t(`tableReports.periodPresets.${p}`) }))}
        />
      </div>
      <div className="flex items-center gap-2 min-w-0 pl-[8.5rem]">
        {dateInput('from')}
        {dateInput('to')}
      </div>
      {invalidRange && (
        <div id={`${id}-invalid`} className="text-[11px] pl-[8.5rem]" style={{ color: 'var(--error)' }} role="alert">
          {t('tableReports.options.periodInvalid')}
        </div>
      )}
    </div>
  );
}
