import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReportPaper, type ReportPaperInput } from './useReportPaper';
import { ReportPaperView, type FabZone, type PaperPick, type PaperTarget } from './ReportPaperView';

/** Wat de zijbalk van het papier moet weten (samenvattingen, waarschuwingen). */
export interface PaperInfo {
  totalPages: number;
  rows: number;
  cols: number;
  tableWidth: number;
  headerHeight: number;
  dayWidth: number;
  /** De toewijzingskolommen (Resourcediagram) passen niet naast de tijdlijn en staan er niet op. */
  assignmentColumnsDropped: boolean;
}

export function samePaperInfo(a: PaperInfo | null, b: PaperInfo | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.totalPages === b.totalPages && a.rows === b.rows && a.cols === b.cols
    && a.tableWidth === b.tableWidth && a.headerHeight === b.headerHeight && a.dayWidth === b.dayWidth
    && a.assignmentColumnsDropped === b.assignmentColumnsDropped;
}

interface StudioPaperProps {
  input: ReportPaperInput;
  loading: boolean;
  selected: { targets: PaperTarget[]; column?: string } | null;
  onPick: (pick: PaperPick) => void;
  regionLabel: (target: PaperTarget) => string;
  columnLabel: (key: string) => string;
  /** De vaste delen van de statusregel na het aantal pagina's (papier, kolommen, rijen). */
  statusItems: readonly string[];
  actions?: ReactNode;
  onInfo: (info: PaperInfo | null) => void;
  /** De hoek linksonder van de zwevende exportknop (zijbalk ingeklapt), of `null`. */
  fabZone: FabZone | null;
  /** De aanwijzing boven het eerste blad, of `null`. */
  hint: { text: string; closeLabel: string; onClose: () => void } | null;
  /** Balk boven het papier (verouderde planning, fout in de planning), of `null`. */
  banner: ReactNode;
  /** Korte melding in de werkbalk ("Ongedaan maken" na Standaard), of `null`. */
  notice?: ReactNode;
}

/**
 * Het papier als eigen component: als de opname na een klik binnenkomt, rendert alleen dit deel
 * opnieuw en niet de hele zijbalk. De zijbalk krijgt alleen bericht als het aantal pagina's of de
 * tabelbreedte verandert (`onInfo`).
 */
export const StudioPaper = memo(function StudioPaper({
  input, loading, selected, onPick, regionLabel, columnLabel, statusItems, actions, onInfo, fabZone, hint, banner, notice,
}: StudioPaperProps) {
  const { t } = useTranslation('report');
  // De bladen in beeld: de volgende opname tekent meteen hun rijen (en de rest pas bij scrollen).
  const visibleHint = useRef<readonly number[]>([0]);
  const onVisible = useCallback((pages: readonly number[]) => { visibleHint.current = pages; }, []);
  const { paper, stale } = useReportPaper(input, visibleHint);

  const totalPages = paper?.totalPages ?? 0;
  const rows = paper?.layout.rows ?? 0;
  const cols = paper?.layout.cols ?? 0;
  const tableWidth = paper?.tableWidth ?? 0;
  const headerHeight = paper?.headerHeight ?? 0;
  const dayWidth = paper?.dayWidth ?? 0;
  const assignmentColumnsDropped = paper?.assignmentColumnsDropped ?? false;
  const hasPaper = paper !== null;
  useEffect(() => {
    onInfo(hasPaper ? { totalPages, rows, cols, tableWidth, headerHeight, dayWidth, assignmentColumnsDropped } : null);
  }, [onInfo, hasPaper, totalPages, rows, cols, tableWidth, headerHeight, dayWidth, assignmentColumnsDropped]);

  // Het aantal pagina's staat alleen hier. Lopen de bladen ook naast elkaar, dan met de indeling erbij.
  const status = useMemo(() => (hasPaper ? (
    <>
      <strong data-rs-status-pages>
        {cols > 1 ? t('studio.page.gridPages', { count: totalPages, rows, cols }) : t('studio.pages', { count: totalPages })}
      </strong>
      {statusItems.map(item => (
        <span key={item} className="contents">
          <span>·</span>
          <span>{item}</span>
        </span>
      ))}
      {stale && <span className="sr-only">{t('studio.updating')}</span>}
    </>
  ) : <span>{t('studio.loading')}</span>), [hasPaper, totalPages, rows, cols, statusItems, stale, t]);

  return (
    <ReportPaperView
      paper={paper}
      stale={stale}
      loading={loading}
      selected={selected}
      onPick={onPick}
      regionLabel={regionLabel}
      columnLabel={columnLabel}
      status={status}
      actions={actions}
      onVisible={onVisible}
      fabZone={fabZone}
      hint={hint}
      banner={banner}
      notice={notice}
    />
  );
});
