import { memo, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReportPaper, type ReportPaperInput } from './useReportPaper';
import { ReportPaperView, type PaperPick, type PaperTarget } from './ReportPaperView';

/** Wat de zijbalk van het papier moet weten (samenvattingen, waarschuwingen). */
export interface PaperInfo {
  totalPages: number;
  rows: number;
  cols: number;
  tableWidth: number;
  headerHeight: number;
}

export function samePaperInfo(a: PaperInfo | null, b: PaperInfo | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.totalPages === b.totalPages && a.rows === b.rows && a.cols === b.cols
    && a.tableWidth === b.tableWidth && a.headerHeight === b.headerHeight;
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
}

/**
 * Het papier als eigen component: als de opname na een klik binnenkomt, rendert alleen dit deel
 * opnieuw en niet de hele zijbalk. De zijbalk krijgt alleen bericht als het aantal pagina's of de
 * tabelbreedte verandert (`onInfo`).
 */
export const StudioPaper = memo(function StudioPaper({
  input, loading, selected, onPick, regionLabel, columnLabel, statusItems, actions, onInfo,
}: StudioPaperProps) {
  const { t } = useTranslation('report');
  const paper = useReportPaper(input);

  const totalPages = paper?.totalPages ?? 0;
  const rows = paper?.layout.rows ?? 0;
  const cols = paper?.layout.cols ?? 0;
  const tableWidth = paper?.tableWidth ?? 0;
  const headerHeight = paper?.headerHeight ?? 0;
  const hasPaper = paper !== null;
  useEffect(() => {
    onInfo(hasPaper ? { totalPages, rows, cols, tableWidth, headerHeight } : null);
  }, [onInfo, hasPaper, totalPages, rows, cols, tableWidth, headerHeight]);

  const stale = paper?.stale ?? false;
  const status = useMemo(() => (hasPaper ? (
    <>
      <strong>{t('studio.pages', { count: totalPages })}</strong>
      {statusItems.map(item => (
        <span key={item} className="contents">
          <span>·</span>
          <span>{item}</span>
        </span>
      ))}
      {stale && <span className="sr-only">{t('studio.updating')}</span>}
    </>
  ) : <span>{t('studio.loading')}</span>), [hasPaper, totalPages, statusItems, stale, t]);

  return (
    <ReportPaperView
      paper={paper}
      loading={loading}
      selected={selected}
      onPick={onPick}
      regionLabel={regionLabel}
      columnLabel={columnLabel}
      status={status}
      actions={actions}
    />
  );
});
