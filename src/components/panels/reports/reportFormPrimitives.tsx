import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import type { ReportOrientation, ReportPaperSize } from '@/utils/reportSettings';

// Bouwstenen van de instellingenkaarten op het Rapport-tabblad: het Gantt-/resourcediagramblok in
// `ReportPanel` en het optieblok van de tabelrapporten delen dezelfde kaart, rijen en keuzelijsten.

/** Kaart met kop (`bg-surface-alt`); `children` is de inhoud onder de kop. */
export function ReportOptionsCard({ title, children, cardProps }: {
  title: ReactNode;
  children: ReactNode;
  cardProps?: Record<string, unknown>;
}) {
  return (
    <div className="bg-surface-alt rounded-lg p-3" style={{ border: '1px solid var(--theme-border)' }} {...cardProps}>
      <h3 className="ui-card-header !text-small !leading-4 mb-2">{title}</h3>
      {children}
    </div>
  );
}

/** Rij met een vast-brede labelkolom en daarnaast het control. */
export function ReportFieldRow({ label, labelWidth = 'w-20', htmlFor, children }: {
  label: ReactNode;
  /** `w-20` in het Gantt-blok, `w-32` in het tabelrapportblok. */
  labelWidth?: 'w-20' | 'w-32';
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <label className={`text-text-secondary ${labelWidth} flex-shrink-0`} htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/** Vinkrij: checkbox met label ernaast. */
export function ReportCheckRow({ checked, onChange, label, spaced = false, inputProps }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  /** `mt-1`: opent een nieuwe groep vinkjes. */
  spaced?: boolean;
  /** Extra attributen op de checkbox (data-ops-* voor de tests). */
  inputProps?: Record<string, unknown>;
}) {
  return (
    <label className={spaced ? 'flex items-center gap-2 mt-1 min-w-0' : 'flex items-center gap-2 min-w-0'}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="accent-accent flex-shrink-0"
        {...inputProps}
      />
      <span className="min-w-0">{label}</span>
    </label>
  );
}

const PAPER_OPTIONS = (['A4', 'A3', 'A2', 'A1'] as const).map(p => ({ value: p, label: p }));

export function PaperSizeSelect({ id, className, value, onChange }: {
  id?: string;
  className: string;
  value: ReportPaperSize;
  onChange: (paper: ReportPaperSize) => void;
}) {
  const { t } = useTranslation('report');
  return (
    <Select
      id={id}
      className={className}
      aria-label={t('paper')}
      value={value}
      onChange={v => onChange(v as ReportPaperSize)}
      options={PAPER_OPTIONS}
    />
  );
}

export function OrientationSelect({ id, className, value, onChange }: {
  id?: string;
  className: string;
  value: ReportOrientation;
  onChange: (orientation: ReportOrientation) => void;
}) {
  const { t } = useTranslation('report');
  return (
    <Select
      id={id}
      className={className}
      aria-label={t('orientation')}
      value={value}
      onChange={v => onChange(v as ReportOrientation)}
      options={[
        { value: 'landscape', label: t('landscape') },
        { value: 'portrait', label: t('portrait') },
      ]}
    />
  );
}
