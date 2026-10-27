import { useTranslation } from 'react-i18next';
import { DEFAULT_CRITICAL_BAR_COLORS, type CriticalBarColors } from '@/types/barColor';

/** De drie kleuren zijn één keuze, zodat een layout ze samen kan bewaren. */
export function CriticalBarColorsEditor({ colors, onChange }: {
  colors?: CriticalBarColors;
  onChange: (colors: CriticalBarColors | undefined) => void;
}) {
  const { t } = useTranslation(['report', 'menu', 'common']);
  const current = colors ?? DEFAULT_CRITICAL_BAR_COLORS;
  const fields = [
    { key: 'critical', label: t('report:legend.criticalPath') },
    { key: 'nearCritical', label: t('report:tableReports.common.nearCritical') },
    { key: 'normal', label: t('report:legend.normal') },
  ] as const;
  return <div className="flex flex-col gap-1">
    {fields.map(({ key, label }) => <label key={key} className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <input type="color" aria-label={label} value={current[key]}
        onChange={event => onChange({ ...current, [key]: event.target.value })} />
    </label>)}
    <button type="button" className="ribbon-btn small" onClick={() => onChange(undefined)}>
      {t('common:view.columns.resetDefault')}
    </button>
  </div>;
}
