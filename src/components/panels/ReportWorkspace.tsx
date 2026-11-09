import { lazy, Suspense, useEffect, useState } from 'react';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
import { useAppStore } from '@/state/appStore';
import { isFeatureEnabled, REPORT_REDESIGN_FLAG } from '@/utils/featureFlags';
import { loadReportSettings, type ReportType } from '@/utils/reportSettings';
import { ReportPanel } from './ReportPanel';

const GanttReportStudio = lazy(() => import('./reportStudio/GanttReportStudio').then(m => ({ default: m.GanttReportStudio })));

/**
 * De werkruimte van het tabblad Rapport. Zonder de feature flag `reportRedesign` precies het oude paneel.
 * Met de flag krijgt de Gantt-afdruk het nieuwe tabblad (issue #817); de andere tien rapporttypen blijven
 * voorlopig in het oude paneel (besluit eigenaar 7-11-2026: de Gantt-afdruk is de kern). Het Resourcediagram
 * is met de flag geen eigen rapport meer: het is de Gantt-afdruk met de layout Resourcediagram (#861), dus
 * een bewaarde keuze `resourceGantt` opent ook het nieuwe tabblad. Beide kanten bewaren het gekozen
 * rapporttype in `ops-reportSettings` vóór ze wisselen.
 *
 * Vernieuwt een andere bron die sleutel (de host na de start, #818, of een ander tabblad), dan volgt de
 * werkruimte het rapporttype daaruit: anders blijft het nieuwe tabblad staan terwijl de opgeslagen keuze
 * een ander rapport is (review Sol #847).
 */
export function ReportWorkspace() {
  const enabled = useAppStore(s => isFeatureEnabled(s.ui.featureFlags, REPORT_REDESIGN_FLAG));
  const [type, setType] = useState<ReportType | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadReportSettings().then(
      loaded => { if (!cancelled) setType(loaded.reportType); },
      () => { if (!cancelled) setType('gantt'); },
    );
    return () => { cancelled = true; };
  }, [enabled]);

  useStoredSettingRefresh('ops-reportSettings', () => {
    if (enabled) void loadReportSettings().then(loaded => setType(loaded.reportType), () => {});
  });

  if (!enabled) return <ReportPanel />;
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
