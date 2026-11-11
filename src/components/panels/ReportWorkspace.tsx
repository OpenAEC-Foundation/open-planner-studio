import { lazy, Suspense } from 'react';
import { useReportSettings } from '@/hooks/useReportSettings';
import { ReportPanel } from './ReportPanel';

const GanttReportStudio = lazy(() => import('./reportStudio/GanttReportStudio').then(m => ({ default: m.GanttReportStudio })));

/**
 * De werkruimte van het tabblad Rapport. De Gantt-afdruk krijgt het Rapport-tabblad (issue #817); de andere
 * tien rapporttypen staan in `ReportPanel` (besluit eigenaar 7-11-2026: de Gantt-afdruk is de kern). Het
 * Resourcediagram is geen eigen rapport meer: het is de Gantt-afdruk met de layout Resourcediagram (#861), dus
 * een bewaarde keuze `resourceGantt` opent ook het Rapport-tabblad.
 *
 * De werkruimte volgt het rapporttype in de gedeelde stand (`useReportSettings`): een keuze in het tabblad of het
 * paneel, en ook een wijziging van een andere bron (de host na de start, #818, of een ander tabblad).
 *
 * Het tour-anker `report-panel` staat op de kaart om deze werkruimte (`App.tsx`), niet hierbinnen.
 */
export function ReportWorkspace() {
  const { reportType } = useReportSettings();
  if (reportType === 'gantt' || reportType === 'resourceGantt') {
    return (
      <Suspense fallback={<div className="flex-1 min-h-0" />}>
        <GanttReportStudio />
      </Suspense>
    );
  }
  return <ReportPanel />;
}
