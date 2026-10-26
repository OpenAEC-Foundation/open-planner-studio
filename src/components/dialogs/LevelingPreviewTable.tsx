import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { computeVirtualWindow } from '@/engine/taskGrid/virtualization';

export interface LevelingPreviewRow {
  taskId: string;
  name: string;
  oldStart: string;
  newStart: string;
  delay: number;
}

/** Alleen de zichtbare voorstelregels mounten; Toepassen blijft het volledige resultaat gebruiken. */
export function LevelingPreviewTable({ rows, formatStart }: {
  rows: readonly LevelingPreviewRow[];
  /** De start van een taak volgens B4 (`useTaskIdDateText`, startachtig). */
  formatStart: (taskId: string, iso: string) => string;
}) {
  const { t } = useTranslation('common');
  const fontScale = useAppStore(s => s.ui.uiFontScale);
  const rowHeight = Math.max(24, Math.round(24 * fontScale / 100));
  const viewportRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(280);
  useEffect(() => {
    const viewport = viewportRef.current;
    const header = headerRef.current;
    if (!viewport || !header) return;
    const measure = () => setViewportHeight(Math.max(0, viewport.clientHeight - header.offsetHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const virtual = computeVirtualWindow({ totalRows: rows.length, rowHeight, viewportHeight, scrollTop });

  return (
    <div
      ref={viewportRef}
      className="overflow-auto shrink-0"
      style={{ maxHeight: 280 }}
      tabIndex={0}
      role="region"
      aria-label={t('resource.leveling.dialogTitle')}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={event => {
        // De browser scrolt deze lijst; globale Gantt-sneltoetsen mogen Home/pijlen niet overnemen.
        if (['Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
          event.stopPropagation();
        }
      }}
      data-ops-leveling-preview
    >
      <table className="w-full border-collapse table-fixed" aria-rowcount={rows.length + 1}>
        <colgroup><col style={{ width: '40%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /><col style={{ width: '16%' }} /></colgroup>
        <thead ref={headerRef} className="sticky top-0 bg-surface">
          <tr style={{ color: 'var(--theme-text-dim)' }} aria-rowindex={1}>
            <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('resource.leveling.colTask')}</th>
            <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('resource.leveling.colOldStart')}</th>
            <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('resource.leveling.colNewStart')}</th>
            <th className="text-right px-2 py-1 font-semibold border-b border-border">{t('resource.leveling.colShift')}</th>
          </tr>
        </thead>
        <tbody>
          {virtual.topSpacerHeight > 0 && <tr aria-hidden="true"><td colSpan={4} style={{ height: virtual.topSpacerHeight, padding: 0, border: 0 }} /></tr>}
          {virtual.mountedRows.map(({ index, ariaRowIndex }) => {
            const row = rows[index];
            return (
              <tr key={row.taskId} aria-rowindex={ariaRowIndex} className="border-b border-border-light" style={{ height: rowHeight }}>
                <td className="px-2 py-0 truncate" title={row.name}>{row.name}</td>
                <td className="px-2 py-0 whitespace-nowrap">{formatStart(row.taskId, row.oldStart)}</td>
                <td className="px-2 py-0 whitespace-nowrap">{formatStart(row.taskId, row.newStart)}</td>
                <td className="px-2 py-0 text-right whitespace-nowrap">{t('resource.leveling.shiftDays', { count: row.delay })}</td>
              </tr>
            );
          })}
          {virtual.bottomSpacerHeight > 0 && <tr aria-hidden="true"><td colSpan={4} style={{ height: virtual.bottomSpacerHeight, padding: 0, border: 0 }} /></tr>}
        </tbody>
      </table>
    </div>
  );
}
