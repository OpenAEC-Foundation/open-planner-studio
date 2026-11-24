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

/** De labels van de keuzelijst *Lettertype*, één per letter uit het vaste setje (`reportFont.ts`). */
const REPORT_FONT_LABEL_KEYS = {
  inter: 'reportFontFamily.inter',
  liberationSans: 'reportFontFamily.liberationSans',
  carlito: 'reportFontFamily.carlito',
  liberationSerif: 'reportFontFamily.liberationSerif',
  liberationMono: 'reportFontFamily.liberationMono',
} as const satisfies Record<ReportFontId, string>;

/** De optie onderaan de keuzelijst die het venster *Ander lettertype…* opent; nooit een gekozen waarde. */
const OTHER_FONT = '__other';

/**
 * Keuzelijst *Lettertype* (issue #770). Eén keuze voor álle rapporten, dus hij staat overal waar ook
 * Papier en Oriëntatie staan: in het Gantt-/resourcediagramblok en in het blok van de tabelrapporten.
 *
 * Onder het vaste setje staat het eigen lettertype (als de planner er een koos) en *Ander lettertype…*
 * (besluit Ethan, 14 november 2026). Dat eigen lettertype zet deze keuzelijst zelf in de rapportinstellingen
 * (naam en versie; de bytes in `customFontStore.ts`); de aanroeper krijgt alleen de keuze `custom`.
 */
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

/** Eén melding per sessie dat het eigen lettertype weg is, ook als beide rapportschermen het merken. */
let missingNoticeShown = false;

/**
 * Staat de keuze op het eigen lettertype, maar is de kopie op dit apparaat weg (opslag gewist, privévenster),
 * dan valt het rapport terug op Inter, met één melding (besluit Ethan, 14 november 2026). Staat er in de opslag
 * een nieuwere versie dan in de instellingen, dan neemt deze stand die naam en versie over; leest altijd vers.
 */
export function useCustomReportFontGuard(value: ReportFontChoice): void {
  const { customReportFont } = useReportSettings();
  const rev = customReportFont?.rev;
  useEffect(() => {
    if (value !== 'custom') return;
    let cancelled = false;
    void getCustomFont({ fresh: true }).then(font => {
      if (cancelled) return;
      const current = latestReportSettings();
      // De keuze kan al gewijzigd zijn voordat React de vorige effectopruiming uitvoert.
      // Een oude opslaglezing mag een nieuwere keuze of revisie niet overschrijven.
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
        // Alleen een nieuwere kopie overnemen (een ander venster bewaarde de bytes, maar de instelling kwam hier
        // nog niet aan); nooit een oudere versie terugschrijven (review Sol #946, ronde 1).
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
