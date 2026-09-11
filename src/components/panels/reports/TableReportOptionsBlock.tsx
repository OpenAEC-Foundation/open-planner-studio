import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import {
  TABLE_REPORT_LIMITS, type ReportOrientation, type ReportPaperSize, type ReportType, type TableReportOptions,
} from '@/utils/reportSettings';

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
      className="input flex-1 min-w-0 !text-xs !px-2 !py-1"
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
    <div className="flex items-center gap-2 min-w-0">
      <label className="text-text-secondary w-32 flex-shrink-0" htmlFor={`report-opt-${key}`}>{label}</label>
      <NumberField id={`report-opt-${key}`} value={options[key]} min={min} max={max} onCommit={n => onChange({ [key]: n })} dataKey={key} />
    </div>
  );

  const weeksRow = (key: 'lookAheadWeeks' | 'progressPeriodWeeks' | 'resourceAssignmentWeeks', label: string, allowAll: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <label className="text-text-secondary w-32 flex-shrink-0">{label}</label>
      <Select
        className="flex-1 min-w-0"
        aria-label={label}
        value={String(options[key])}
        onChange={v => onChange({ [key]: Number(v) })}
        options={[
          ...(allowAll ? [{ value: '0', label: t('tableReports.options.allWeeks') }] : []),
          ...range(L.weeks.min, L.weeks.max).map(n => ({ value: String(n), label: String(n) })),
        ]}
      />
    </div>
  );

  const checkRow = (key: 'resourceLoadOnlyOverloaded' | 'resourceAssignmentIncludeCompleted' | 'wbsSummaryIncludeActivities', label: string) => (
    <label className="flex items-center gap-2 min-w-0">
      <input
        type="checkbox"
        checked={options[key]}
        onChange={e => onChange({ [key]: e.target.checked })}
        className="accent-accent flex-shrink-0"
        data-ops-report-option={key}
      />
      <span className="min-w-0">{label}</span>
    </label>
  );

  let body: React.ReactNode = null;
  switch (reportType) {
    case 'lookAhead':
      body = <>{weeksRow('lookAheadWeeks', t('tableReports.options.lookAheadWeeks'), false)}{numberRow('nearCriticalDays', t('tableReports.options.nearCriticalDays'), L.nearCriticalDays.min, L.nearCriticalDays.max)}</>;
      break;
    case 'critical':
      body = numberRow('nearCriticalDays', t('tableReports.options.nearCriticalDays'), L.nearCriticalDays.min, L.nearCriticalDays.max);
      break;
    case 'progress':
      body = <>{weeksRow('progressPeriodWeeks', t('tableReports.options.periodWeeks'), false)}{numberRow('nearCriticalDays', t('tableReports.options.nearCriticalDays'), L.nearCriticalDays.min, L.nearCriticalDays.max)}</>;
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
      body = checkRow('resourceLoadOnlyOverloaded', t('tableReports.options.onlyOverloaded'));
      break;
    case 'resourceAssignments':
      body = <>{weeksRow('resourceAssignmentWeeks', t('tableReports.options.assignmentWeeks'), true)}{checkRow('resourceAssignmentIncludeCompleted', t('tableReports.options.includeCompleted'))}</>;
      break;
    case 'wbsSummary':
      body = (
        <>
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-text-secondary w-32 flex-shrink-0">{t('tableReports.options.wbsLevel')}</label>
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
          </div>
          {checkRow('wbsSummaryIncludeActivities', t('tableReports.options.includeActivities'))}
        </>
      );
      break;
    default:
      return null;
  }

  return (
    <div className="bg-surface-alt rounded-lg p-3" style={{ border: '1px solid var(--theme-border)' }} data-ops-report-options>
      <h3 className="ui-card-header !text-xs mb-2">{t('tableReports.options.sectionTitle')}</h3>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <label className="text-text-secondary w-32 flex-shrink-0">{t('paper')}</label>
          <Select
            className="flex-1 min-w-0"
            aria-label={t('paper')}
            value={paperSize}
            onChange={v => onPaperSize(v as ReportPaperSize)}
            options={(['A4', 'A3', 'A2', 'A1'] as const).map(p => ({ value: p, label: p }))}
          />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <label className="text-text-secondary w-32 flex-shrink-0">{t('orientation')}</label>
          <Select
            className="flex-1 min-w-0"
            aria-label={t('orientation')}
            value={orientation}
            onChange={v => onOrientation(v as ReportOrientation)}
            options={[
              { value: 'landscape', label: t('landscape') },
              { value: 'portrait', label: t('portrait') },
            ]}
          />
        </div>
        {body}
      </div>
    </div>
  );
}
