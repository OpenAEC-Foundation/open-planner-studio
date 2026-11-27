import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReportPaper, type ReportPaperInput } from './useReportPaper';
import { ReportPaperView, type FabZone, type PaperPick, type PaperTarget } from './ReportPaperView';

export interface PaperInfo {
  totalPages: number;
  rows: number;
  cols: number;
  tableWidth: number;
  headerHeight: number;
  dayWidth: number;
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
  statusItems: readonly string[];
  actions?: ReactNode;
  onInfo: (info: PaperInfo | null) => void;
  fabZone: FabZone | null;
  hint: { text: string; closeLabel: string; onClose: () => void } | null;
  banner: ReactNode;
  notice?: ReactNode;
}

export const StudioPaper = memo(function StudioPaper({
  input, loading, selected, onPick, regionLabel, columnLabel, statusItems, actions, onInfo, fabZone, hint, banner, notice,
}: StudioPaperProps) {
  const { t } = useTranslation('report');
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
