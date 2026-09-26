import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import {
  TABLE_REPORT_LIMITS, type ReportOrientation, type ReportPaperSize, type ReportType, type TableReportOptions,
  type TableReportPeriodKey,
} from '@/utils/reportSettings';
import type { ResourceLoadingBucket } from '@/engine/reports';
import { ReportingPeriodField } from './ReportingPeriodField';
import { OrientationSelect, PaperSizeSelect, ReportCheckRow, ReportFieldRow, ReportOptionsCard } from './reportFormPrimitives';

/**
 * Optieblok van de tabelrapporten (discussie #31): per rapporttype alleen de knoppen die dat
 * rapport gebruikt. Zelfde rij-opmaak als het Gantt-instellingenblok in `ReportPanel`. De waarden
 * worden via `onChange` als patch teruggegeven; het paneel bewaart ze samen met de overige
 * rapportinstellingen (`reportSettings.tableReports`).
 */
interface Props {
  reportType: ReportType;
  options: TableReportOptions;
  onChange: (patch: Partial<TableReportOptions>) => void;
  /** Papier en oriëntatie sturen de PDF-schaal van élk rapport (fit-width): op A4 staand wordt een
   *  brede tabel 5 pt — de knoppen horen dus ook hier, niet alleen bij de Gantt-afdruk. */
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  onPaperSize: (p: ReportPaperSize) => void;
  onOrientation: (o: ReportOrientation) => void;
}

const range = (min: number, max: number): number[] => Array.from({ length: max - min + 1 }, (_, i) => min + i);

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  if (raw.trim() === '') return fallback;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Getalveld met een lokale kladwaarde: de gebruiker mag het veld leegmaken en overtypen zonder dat
 * elke toetsaanslag meteen naar de minimumwaarde springt; de waarde wordt bij blur/Enter geklemd
 * en doorgegeven. Een wijziging van buitenaf (hydratatie, ander rapport) zet de klad opnieuw.
 */
function NumberField({ id, value, min, max, onCommit, dataKey }: {
  id: string; value: number; min: number; max: number; onCommit: (n: number) => void; dataKey: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const next = clampInt(draft, min, max, value);
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      className="input flex-1 min-w-0 !text-small !leading-4 !px-2 !py-1"
      data-ops-report-option={dataKey}
    />
  );
}

export function TableReportOptionsBlock({ reportType, options, onChange, paperSize, orientation, onPaperSize, onOrientation }: Props) {
  const { t } = useTranslation('report');
  const L = TABLE_REPORT_LIMITS;

  const numberRow = (
    key: keyof TableReportOptions & ('nearCriticalDays' | 'healthHighFloatDays' | 'healthLongDurationDays' | 'healthLagDays'),
    label: string,
    min: number,
    max: number,
  ) => (
    <ReportFieldRow label={label} labelWidth="w-32" htmlFor={`report-opt-${key}`}>
      <NumberField id={`report-opt-${key}`} value={options[key]} min={min} max={max} onCommit={n => onChange({ [key]: n })} dataKey={key} />
    </ReportFieldRow>
  );

  // Het gedeelde rapportageperiode-control (issue #120) — per rapport een eigen opgeslagen keuze.
  const periodRow = (key: TableReportPeriodKey) => (
    <ReportingPeriodField id={`report-opt-${key}`} value={options[key]} onChange={next => onChange({ [key]: next })} dataKey={key} />
  );

  // Label bóven de keuzelijst, net als bij de rapportageperiode: "Per maand" paste anders niet.
  const aggregationRow = (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-text-secondary" htmlFor="report-opt-resourceLoadBucket">{t('tableReports.options.aggregation')}</label>
      <Select
        id="report-opt-resourceLoadBucket"
        className="w-full min-w-0"
        aria-label={t('tableReports.options.aggregation')}
        value={options.resourceLoadBucket}
        onChange={v => onChange({ resourceLoadBucket: v as ResourceLoadingBucket })}
        options={[
          { value: 'week', label: t('tableReports.options.aggregation_week') },
          { value: 'month', label: t('tableReports.options.aggregation_month') },
        ]}
      />
    </div>
  );

  const checkRow = (key: 'resourceLoadOnlyOverloaded' | 'resourceAssignmentIncludeCompleted' | 'wbsSummaryIncludeActivities', label: string) => (
    <ReportCheckRow
      checked={options[key]}
      onChange={checked => onChange({ [key]: checked })}
      label={label}
      inputProps={{ 'data-ops-report-option': key }}
    />
  );

  let body: React.ReactNode = null;
  switch (reportType) {
    case 'lookAhead':
      body = <>{periodRow('lookAheadPeriod')}{numberRow('nearCriticalDays', t('tableReports.options.nearCriticalDays'), L.nearCriticalDays.min, L.nearCriticalDays.max)}</>;
      break;
    case 'critical':
      body = numberRow('nearCriticalDays', t('tableReports.options.nearCriticalDays'), L.nearCriticalDays.min, L.nearCriticalDays.max);
      break;
    case 'progress':
      body = <>{periodRow('progressPeriod')}{numberRow('nearCriticalDays', t('tableReports.options.nearCriticalDays'), L.nearCriticalDays.min, L.nearCriticalDays.max)}</>;
      break;
    case 'health':
      body = (
        <>
          {numberRow('healthHighFloatDays', t('tableReports.options.highFloatDays'), L.thresholdDays.min, L.thresholdDays.max)}
          {numberRow('healthLongDurationDays', t('tableReports.options.longDurationDays'), L.thresholdDays.min, L.thresholdDays.max)}
          {numberRow('healthLagDays', t('tableReports.options.lagDays'), L.lagDays.min, L.lagDays.max)}
          {numberRow('nearCriticalDays', t('tableReports.options.nearCriticalDays'), L.nearCriticalDays.min, L.nearCriticalDays.max)}
        </>
      );
      break;
    case 'resourceLoading':
      body = <>{periodRow('resourceLoadPeriod')}{aggregationRow}{checkRow('resourceLoadOnlyOverloaded', t('tableReports.options.onlyOverloaded'))}</>;
      break;
    case 'resourceAssignments':
      body = <>{periodRow('resourceAssignmentPeriod')}{checkRow('resourceAssignmentIncludeCompleted', t('tableReports.options.includeCompleted'))}</>;
      break;
    case 'wbsSummary':
      body = (
        <>
          <ReportFieldRow label={t('tableReports.options.wbsLevel')} labelWidth="w-32">
            <Select
              className="flex-1 min-w-0"
              aria-label={t('tableReports.options.wbsLevel')}
              value={String(options.wbsSummaryLevel)}
              onChange={v => onChange({ wbsSummaryLevel: Number(v) })}
              options={[
                { value: '0', label: t('tableReports.options.wbsLevelAll') },
                ...range(1, L.wbsLevel.max).map(n => ({ value: String(n), label: String(n) })),
              ]}
            />
          </ReportFieldRow>
          {checkRow('wbsSummaryIncludeActivities', t('tableReports.options.includeActivities'))}
        </>
      );
      break;
    default:
      return null;
  }

  return (
    <ReportOptionsCard title={t('tableReports.options.sectionTitle')} cardProps={{ 'data-ops-report-options': true }}>
      <div className="flex flex-col gap-2 text-small leading-4">
        {/* Papier en oriëntatie elk op een eigen rij met het label erboven: naast een `w-32`-label
            (en ook in twee kolommen) bleef bij de standaardkolom ~53 px over en las "Landscape"
            als "Landsc…" (dezelfde meting als bij de rapportageperiode, reviewronde 3). */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-text-secondary" htmlFor="report-opt-paper">{t('paper')}</label>
            <PaperSizeSelect id="report-opt-paper" className="w-full min-w-0" value={paperSize} onChange={onPaperSize} />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-text-secondary" htmlFor="report-opt-orientation">{t('orientation')}</label>
            <OrientationSelect id="report-opt-orientation" className="w-full min-w-0" value={orientation} onChange={onOrientation} />
          </div>
        </div>
        {body}
      </div>
    </ReportOptionsCard>
  );
}
