import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { FieldRef, GroupLevel } from '@/types/view';

// Zelfde codering als de lintprimitieven (`ribbonPrimitives.encodeFieldRef`); hier lokaal, zodat
// viewControls niet van de lintlaag afhangt.
const encodeFieldRef = (f: FieldRef): string => JSON.stringify(f);
const decodeFieldRef = (s: string): FieldRef => JSON.parse(s) as FieldRef;

/**
 * Herhaalbare rijen {veld ▾, richting} voor groeperen en sorteren (fase 2.7, §7). Controlled, zodat
 * dezelfde editor zowel live op de view werkt (de klassieke lintpopovers) als op het concept van de
 * layoutdialoog (issue #144). `GroupLevel` en `SortLevel` hebben dezelfde vorm.
 */
export function LevelListEditor({
  levels, onChange, options, maxLevels, emptyLabel, addLabel,
}: {
  levels: GroupLevel[];
  onChange: (next: GroupLevel[]) => void;
  options: { field: FieldRef; label: string }[];
  maxLevels?: number;
  emptyLabel: string;
  addLabel: string;
}) {
  const { t } = useTranslation('common');
  const setLevel = (i: number, changes: Partial<GroupLevel>) => {
    onChange(levels.map((lvl, li) => (li === i ? { ...lvl, ...changes } : lvl)));
  };
  const canAdd = options.length > 0 && (maxLevels === undefined || levels.length < maxLevels);

  return (
    <>
      {levels.length === 0 && <span className="ribbon-info">{emptyLabel}</span>}
      {levels.map((lvl, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select
            value={encodeFieldRef(lvl.field)}
            onChange={e => setLevel(i, { field: decodeFieldRef(e.target.value) })}
            className="input !text-small !leading-4 !px-1.5 !py-1 flex-1"
            aria-label={t('view.filter.field')}
          >
            {options.map(({ field: f, label }) => (
              <option key={encodeFieldRef(f)} value={encodeFieldRef(f)}>{label}</option>
            ))}
          </select>
          <select
            value={lvl.dir}
            onChange={e => setLevel(i, { dir: e.target.value as 'asc' | 'desc' })}
            className="input !text-small !leading-4 !px-1.5 !py-1 !w-32"
            aria-label={t('view.group.direction')}
          >
            <option value="asc">{t('view.sort.ascending')}</option>
            <option value="desc">{t('view.sort.descending')}</option>
          </select>
          <button type="button" onClick={() => onChange(levels.filter((_, li) => li !== i))} style={{ color: 'var(--error)' }} title={t('delete')}>
            <X size={13} />
          </button>
        </div>
      ))}
      {canAdd && (
        <button
          type="button"
          onClick={() => onChange([...levels, { field: options[0]!.field, dir: 'asc' }])}
          className="btn btn--sm btn--secondary"
          style={{ alignSelf: 'flex-start' }}
        >
          {addLabel}
        </button>
      )}
    </>
  );
}
