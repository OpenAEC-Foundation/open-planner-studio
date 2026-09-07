import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import { TABLE_REPORT_LIMITS, type ReportType, type TableReportOptions } from '@/utils/reportSettings';

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
}

const range = (min: number, max: number): number[] => Array.from({ length: max - min + 1 }, (_, i) => min + i);

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function TableReportOptionsBlock({ reportType, options, onChange }: Props) {
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
      <input
        id={`report-opt-${key}`}
        type="number"
        min={min}
        max={max}
        value={options[key]}
        onChange={e => onChange({ [key]: clampInt(e.target.value, min, max, options[key]) })}
        className="input flex-1 min-w-0 !text-xs !px-2 !py-1"
        data-ops-report-option={key}
      />
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
      <div className="flex flex-col gap-2 text-xs">{body}</div>
    </div>
  );
}
