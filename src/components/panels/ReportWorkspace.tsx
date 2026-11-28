import { lazy, Suspense } from 'react';
import { useReportSettings } from '@/hooks/useReportSettings';
import { ReportPanel } from './ReportPanel';
import { useCustomReportFontGuard } from './reports/reportFormPrimitives';

const GanttReportStudio = lazy(() => import('./reportStudio/GanttReportStudio').then(m => ({ default: m.GanttReportStudio })));

export function ReportWorkspace() {
  const { reportType, reportFontFamily } = useReportSettings();
  useCustomReportFontGuard(reportFontFamily);
  if (reportType === 'gantt' || reportType === 'resourceGantt') {
    return (
      <Suspense fallback={<div className="flex-1 min-h-0" />}>
        <GanttReportStudio />
      </Suspense>
    );
  }
  return <ReportPanel />;
}
