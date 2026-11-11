import { lazy, Suspense, useEffect, useState } from 'react';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
import { loadReportSettings, type ReportType } from '@/utils/reportSettings';
import { ReportPanel } from './ReportPanel';

const GanttReportStudio = lazy(() => import('./reportStudio/GanttReportStudio').then(m => ({ default: m.GanttReportStudio })));

/**
 * De werkruimte van het tabblad Rapport. De Gantt-afdruk krijgt het Rapport-tabblad (issue #817); de andere
 * tien rapporttypen staan in `ReportPanel` (besluit eigenaar 7-11-2026: de Gantt-afdruk is de kern). Het
 * Resourcediagram is geen eigen rapport meer: het is de Gantt-afdruk met de layout Resourcediagram (#861), dus
 * een bewaarde keuze `resourceGantt` opent ook het Rapport-tabblad. Beide kanten bewaren het gekozen
 * rapporttype in `ops-reportSettings` vóór ze wisselen.
 *
 * Vernieuwt een andere bron die sleutel (de host na de start, #818, of een ander tabblad), dan volgt de
 * werkruimte het rapporttype daaruit: anders blijft het Rapport-tabblad staan terwijl de opgeslagen keuze
 * een ander rapport is (review Sol #847).
 */
export function ReportWorkspace() {
  const [type, setType] = useState<ReportType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReportSettings().then(
      loaded => { if (!cancelled) setType(loaded.reportType); },
      () => { if (!cancelled) setType('gantt'); },
    );
    return () => { cancelled = true; };
  }, []);

  useStoredSettingRefresh('ops-reportSettings', () => {
    void loadReportSettings().then(loaded => setType(loaded.reportType), () => {});
  });

  if (type === null) return <div className="flex-1 min-h-0" data-tour-anchor="report-panel" />;
  if (type === 'gantt' || type === 'resourceGantt') {
    return (
      <Suspense fallback={<div className="flex-1 min-h-0" data-tour-anchor="report-panel" />}>
        <GanttReportStudio onReportTypeChange={setType} />
      </Suspense>
    );
  }
  return <ReportPanel onReportTypeChange={next => { if (next === 'gantt' || next === 'resourceGantt') setType(next); }} />;
}
