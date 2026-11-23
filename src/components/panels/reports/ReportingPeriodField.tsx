import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/hooks/displayDate';
import { localTodayIso } from '@/utils/dateUtils';
import { DateTextInput } from '@/components/common/DateTextInput';
import {
  REPORTING_PERIOD_PRESETS, type ReportingPeriod, type ReportingPeriodPreset, type ResolvedPeriod,
  isIsoDay, projectSpan, referenceDayOf, resolveReportingPeriod,
} from '@/engine/reports';

/**
 * Het gedeelde rapportageperiode-control: één preset-keuzelijst (volgende/afgelopen
 * N weken of maand, hele project, aangepast) plus twee datumvelden. Bij een preset tonen de velden
 * de berekende datums alleen-lezen als tekst in de datumnotatie van de app (`useDisplayDate`, net
 * als de rapportondertitel); bij *Aangepast* worden het bewerkbare datumvelden van de app
 * (`DateTextInput`, met de eigen kalender van #904). Een omgekeerd bereik (tot < van) of een leeg/
 * onvolledig veld wordt niet doorgegeven maar rood gemarkeerd met een melding — het rapport blijft
 * op de laatste geldige periode staan. Wisselen van *Aangepast* terug naar een preset laat de eigen
 * datums vallen; wisselen náár *Aangepast* start met de datums van de preset die op dat moment gold.
 *
 * LAYOUT: de datumvelden staan op een eigen rij die bij de standaardbreedte van de instellingen-
 * kolom (256 px) omslaat naar twee volle regels — een datumveld heeft ~120 px nodig om een datum
 * plus kalenderknop te tonen; onder een `w-32`-label ingesprongen blijft er 18 px over. Het Van/Tot-label
 * heeft bewust géén vaste breedte: "Başlangıç" (tr) is breder dan "Van" en wordt met `w-8` afgekapt.
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

/** De referentiedag en projectspanne uit de live store — dezelfde bron als `useReportContext`.
 *  Ook gebruikt door `ReportPanel` voor het tijdvenster van het resourcediagram, zodat de rijen en
 *  de tijdas exact het venster nemen dat dit control toont. */
export function useResolvedPeriod(period: ReportingPeriod): ResolvedPeriod {
  const tasks = useAppStore(s => s.tasks);
  const statusDate = useAppStore(s => s.project.statusDate);
  const today = localTodayIso();
  return useMemo(() => {
    const { day } = referenceDayOf(statusDate, today);
    return resolveReportingPeriod(period, day, projectSpan(tasks));
  }, [period, tasks, statusDate, today]);
}

export function ReportingPeriodField({ id, value, onChange, dataKey }: Props) {
  const { t } = useTranslation('report');
  const dd = useDisplayDate();
  const resolved = useResolvedPeriod(value);
  const isCustom = value.preset === 'custom';

  const changePreset = (preset: ReportingPeriodPreset) => {
    if (preset === value.preset) return;
    if (preset === 'custom') onChange({ preset: 'custom', from: resolved.from, to: resolved.to });
    else onChange({ preset });
  };

  const shownDate = (which: 'from' | 'to') => (
    <div className="flex items-center gap-2 min-w-0 flex-1" style={{ minWidth: '11rem' }}>
      <span className="text-text-secondary flex-shrink-0" data-ops-report-period-label={which}>
        {t(which === 'from' ? 'tableReports.options.periodFrom' : 'tableReports.options.periodTo')}
      </span>
      <span className="flex-1 min-w-0 truncate" data-ops-report-option={`${dataKey}.${which}`} data-ops-readonly>
        {dd.date(which === 'from' ? resolved.from : resolved.to)}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-1 min-w-0" data-ops-report-period={dataKey}>
      <div className="flex flex-col gap-1 min-w-0">
        <label className="text-text-secondary" htmlFor={id}>{t('tableReports.options.reportingPeriod')}</label>
        <Select
          id={id}
          className="w-full min-w-0"
          aria-label={t('tableReports.options.reportingPeriod')}
          value={value.preset}
          onChange={v => changePreset(v as ReportingPeriodPreset)}
          options={REPORTING_PERIOD_PRESETS.map(p => ({ value: p, label: t(`tableReports.periodPresets.${p}`) }))}
        />
      </div>
      {isCustom ? (
        <CustomPeriodDates id={id} period={resolved} onChange={onChange} dataKey={dataKey} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          {shownDate('from')}
          {shownDate('to')}
        </div>
      )}
    </div>
  );
}

export function CustomPeriodDates({ id, period, onChange, dataKey, compact = false }: {
  id: string;
  period: ResolvedPeriod;
  onChange: (next: ReportingPeriod) => void;
  dataKey: string;
  compact?: boolean;
}) {
  const { t } = useTranslation('report');
  const [draftFrom, setDraftFrom] = useState(period.from);
  const [draftTo, setDraftTo] = useState(period.to);
  useEffect(() => { setDraftFrom(period.from); setDraftTo(period.to); }, [period.from, period.to]);

  const incomplete = !isIsoDay(draftFrom) || !isIsoDay(draftTo);
  const invalidRange = !incomplete && draftTo < draftFrom;
  const invalid = incomplete || invalidRange;

  const commit = (from: string, to: string) => {
    if (!isIsoDay(from) || !isIsoDay(to) || to < from) return;
    if (from === period.from && to === period.to) return;
    onChange({ preset: 'custom', from, to });
  };

  const dateInput = (which: 'from' | 'to') => {
    const draft = which === 'from' ? draftFrom : draftTo;
    const setDraft = which === 'from' ? setDraftFrom : setDraftTo;
    const label = t(which === 'from' ? 'tableReports.options.periodFrom' : 'tableReports.options.periodTo');
    return (
      <span className="flex items-center gap-2 min-w-0 flex-1" style={{ minWidth: compact ? undefined : '11rem' }}>
        <span className={compact ? 'rs-field-label flex-shrink-0' : 'text-text-secondary flex-shrink-0'} data-ops-report-period-label={which}>{label}</span>
        <span className="flex-1 min-w-0" data-ops-report-option={`${dataKey}.${which}`}>
          <DateTextInput
            value={draft}
            ariaLabel={label}
            onCommit={next => {
              setDraft(next);
              if (which === 'from') commit(next, draftTo); else commit(draftFrom, next);
            }}
            className={compact ? 'input w-full !text-small !leading-4 !px-2.5 !py-1.5' : 'input w-full !text-small !leading-4 !px-2 !py-1'}
            invalid={invalid}
          />
        </span>
      </span>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        {dateInput('from')}
        {dateInput('to')}
      </div>
      {invalid && (
        <div id={`${id}-invalid`} className="!text-body" style={{ color: 'var(--error)' }} role="alert">
          {t(incomplete ? 'tableReports.options.periodIncomplete' : 'tableReports.options.periodInvalid')}
        </div>
      )}
    </>
  );
}
