import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import { latestReportSettings, patchReportSettings, type ReportOrientation, type ReportPaperSize } from '@/utils/reportSettings';
import { isReportFontId, REPORT_FONT_IDS, type ReportFontChoice, type ReportFontId } from '@/services/pdf/reportFont';
import { getCustomFont, saveCustomFont } from '@/services/pdf/customFontStore';
import { fontReadIsCurrent } from '@/services/pdf/customFontGuard';
import type { PickedFont } from '@/services/pdf/systemFonts';
import { useReportSettings } from '@/hooks/useReportSettings';
import { useAppStore } from '@/state/appStore';
import { CustomReportFontDialog } from './CustomReportFontDialog';

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

export function ReportFieldRow({ label, labelWidth = 'w-20', htmlFor, children }: {
  label: ReactNode;
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

export function ReportCheckRow({ checked, onChange, label, spaced = false, inputProps }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  spaced?: boolean;
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

const REPORT_FONT_LABEL_KEYS = {
  inter: 'reportFontFamily.inter',
  liberationSans: 'reportFontFamily.liberationSans',
  carlito: 'reportFontFamily.carlito',
  liberationSerif: 'reportFontFamily.liberationSerif',
  liberationMono: 'reportFontFamily.liberationMono',
} as const satisfies Record<ReportFontId, string>;

const OTHER_FONT = '__other';

export function ReportFontSelect({ id, className, value, onChange }: {
  id?: string;
  className: string;
  value: ReportFontChoice;
  onChange: (font: ReportFontChoice) => void;
}) {
  const { t } = useTranslation('report');
  const { customReportFont } = useReportSettings();
  const [dialogOpen, setDialogOpen] = useState(false);

  const picked = async (font: PickedFont) => {
    const saved = await saveCustomFont(font);
    patchReportSettings({ customReportFont: { name: saved.name, rev: saved.rev } });
    onChange('custom');
    setDialogOpen(false);
    if (!saved.bold) {
      useAppStore.getState().notify({
        severity: 'info', messageKey: 'notifications.reportFontNoBold', params: { name: saved.name }, dedupeKey: 'report-font-no-bold',
      });
    }
  };

  return (
    <>
      <Select
        id={id}
        className={className}
        aria-label={t('reportFontFamilyLabel')}
        value={value}
        onChange={v => {
          if (v === OTHER_FONT) setDialogOpen(true);
          else if (v === 'custom' || isReportFontId(v)) onChange(v);
        }}
        options={[
          ...REPORT_FONT_IDS.map(font => ({ value: font, label: t(REPORT_FONT_LABEL_KEYS[font]) })),
          ...(customReportFont ? [{ value: 'custom', label: t('reportFontFamily.custom', { name: customReportFont.name }) }] : []),
          { value: OTHER_FONT, label: t('reportFontFamily.other') },
        ]}
      />
      {dialogOpen && <CustomReportFontDialog onPicked={picked} onClose={() => setDialogOpen(false)} />}
    </>
  );
}

let missingNoticeShown = false;

export function useCustomReportFontGuard(value: ReportFontChoice): void {
  const { customReportFont } = useReportSettings();
  const rev = customReportFont?.rev;
  useEffect(() => {
    if (value !== 'custom') return;
    let cancelled = false;
    void getCustomFont({ fresh: true }).then(font => {
      if (cancelled) return;
      const current = latestReportSettings();
      if (!fontReadIsCurrent(rev, current)) return;
      const ref = current.customReportFont;
      if (!font) {
        patchReportSettings({ reportFontFamily: 'inter', customReportFont: null });
        if (missingNoticeShown) return;
        missingNoticeShown = true;
        useAppStore.getState().notify({
          severity: 'info', messageKey: 'notifications.reportFontMissing',
          params: { name: ref?.name ?? '' }, dedupeKey: 'report-font-missing',
        });
      } else if (font.rev > (ref?.rev ?? 0)) {
        patchReportSettings({ customReportFont: { name: font.name, rev: font.rev } });
      }
    });
    return () => { cancelled = true; };
  }, [value, rev]);
}

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
