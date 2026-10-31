import { useTranslation } from 'react-i18next';
import { DEFAULT_CRITICAL_BAR_COLORS, type CriticalBarColors } from '@/types/barColor';

/** De drie kleuren zijn één keuze, zodat een layout ze samen kan bewaren. */
export function CriticalBarColorsEditor({ colors, onChange }: {
  colors?: CriticalBarColors;
  onChange: (colors: CriticalBarColors | undefined) => void;
}) {
  const { t } = useTranslation(['report', 'menu', 'common']);
  const current = { ...DEFAULT_CRITICAL_BAR_COLORS, ...colors };
  const fields = [
    { key: 'critical', label: t('report:legend.criticalPath') },
    { key: 'nearCritical', label: t('menu:ribbon.screenColorsNearCritical') },
    { key: 'normal', label: t('report:legend.normal') },
  ] as const;
  return <div data-ops-bar-colors-editor className="ribbon-choice-detail">
    {fields.map(({ key, label }) => <label key={key} className="ribbon-choice-row">
      <span>{label}</span>
      <input type="color" className="ribbon-color-swatch" aria-label={label} value={current[key]}
        onChange={event => onChange({ ...colors, [key]: event.target.value })} />
    </label>)}
    <button type="button" className="ribbon-check-item" onClick={() => onChange(undefined)}>
      {t('common:view.columns.resetDefault')}
    </button>
  </div>;
}
