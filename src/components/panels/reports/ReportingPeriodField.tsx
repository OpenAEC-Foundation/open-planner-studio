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
  /**
   * Dicht, zoals een veld in het eigenschappenpaneel: de labels klein en in hoofdletters zonder dubbele punt
   * (`Field`, `.rs-field-label`) en de keuzelijst met de opvulling van de andere keuzelijsten. Alleen in de
   * zijbalk van het Rapport-tabblad (#817; fixronde na council ronde 5).
   */
  compact?: boolean;
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

export function ReportingPeriodField({ id, value, onChange, dataKey, compact = false }: Props) {
  const { t } = useTranslation('report');
  const dd = useDisplayDate();
  const resolved = useResolvedPeriod(value);
  const isCustom = value.preset === 'custom';
  // Kladwaarden van de datumvelden: de gebruiker mag een datum half intypen zonder dat elke
  // toetsaanslag het rapport herrekent of het veld terugspringt; commit zodra beide geldig zijn.
  const [draftFrom, setDraftFrom] = useState(resolved.from);
  const [draftTo, setDraftTo] = useState(resolved.to);
  useEffect(() => { setDraftFrom(resolved.from); setDraftTo(resolved.to); }, [resolved.from, resolved.to]);

  const incomplete = isCustom && (!isIsoDay(draftFrom) || !isIsoDay(draftTo));
  const invalidRange = isCustom && !incomplete && draftTo < draftFrom;
  const invalid = incomplete || invalidRange;

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
    const label = t(which === 'from' ? 'tableReports.options.periodFrom' : 'tableReports.options.periodTo');
    const labelClass = compact ? 'rs-field-label flex-shrink-0' : 'text-text-secondary flex-shrink-0';
    if (!isCustom) {
      return (
        <div className="flex items-center gap-2 min-w-0 flex-1" style={{ minWidth: compact ? undefined : '11rem' }}>
          <span className={labelClass} data-ops-report-period-label={which}>{label}</span>
          <span className="flex-1 min-w-0 truncate" data-ops-report-option={`${dataKey}.${which}`} data-ops-readonly>
            {dd.date(which === 'from' ? resolved.from : resolved.to)}
          </span>
        </div>
      );
    }
    // Het datumveld van de app, met de eigen kalender (#904): het commit pas bij Enter, bij het verlaten of
    // bij een gekozen dag, en alleen een bestaande datum.
    return (
      <span className="flex items-center gap-2 min-w-0 flex-1" style={{ minWidth: compact ? undefined : '11rem' }}>
        <span className={labelClass} data-ops-report-period-label={which}>{label}</span>
        <span className="flex-1 min-w-0" data-ops-report-option={`${dataKey}.${which}`}>
          <DateTextInput
            value={draft}
            ariaLabel={label}
            onCommit={next => {
              setDraft(next);
              if (which === 'from') commitCustom(next, draftTo); else commitCustom(draftFrom, next);
            }}
            className={compact ? 'input w-full !text-small !leading-4 !px-2.5 !py-1.5' : 'input w-full !text-small !leading-4 !px-2 !py-1'}
            invalid={invalid}
          />
        </span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-1 min-w-0" data-ops-report-period={dataKey}>
      {/* Label bóven de keuzelijst: naast een `w-32`-label blijven bij de standaardkolom 53 px over
          en leest élke preset als "Hele pr…". */}
      <div className="flex flex-col gap-1 min-w-0">
        <label className={compact ? 'rs-field-label' : 'text-text-secondary'} htmlFor={id}>
          {compact ? t('studio.reportingPeriod') : t('tableReports.options.reportingPeriod')}
        </label>
        <Select
          id={id}
          className={compact ? 'w-full min-w-0 !py-1.5 !px-2.5' : 'w-full min-w-0'}
          aria-label={compact ? t('studio.reportingPeriod') : t('tableReports.options.reportingPeriod')}
          value={value.preset}
          onChange={v => changePreset(v as ReportingPeriodPreset)}
          options={REPORTING_PERIOD_PRESETS.map(p => ({ value: p, label: t(`tableReports.periodPresets.${p}`) }))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        {dateInput('from')}
        {dateInput('to')}
      </div>
      {invalid && (
        <div id={`${id}-invalid`} className="!text-body" style={{ color: 'var(--error)' }} role="alert">
          {t(incomplete ? 'tableReports.options.periodIncomplete' : 'tableReports.options.periodInvalid')}
        </div>
      )}
    </div>
  );
}
