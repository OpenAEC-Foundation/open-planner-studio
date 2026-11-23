import type { ViewRow } from '@/engine/view/visibleRows';
import type { ResolvedPeriod, ResourceGanttRowsResult } from '@/engine/reports';
import type { PrintOptions } from '@/services/print/printPreview';
import type { ResourceGanttReportOptions, ReportSettings } from '@/utils/reportSettings';

export interface StudioRowSource {
  rows: ViewRow[] | undefined;
  multiBand: boolean;
  resource: {
    result: ResourceGanttRowsResult;
    options: ResourceGanttReportOptions;
  } | null;
  window: ResolvedPeriod | undefined;
}

/** De velden van `PrintOptions` die uit de rijenbron volgen. */
export type StudioRowPrintFields = Pick<PrintOptions,
  'rows' | 'showDeps' | 'showCritical' | 'pageBreakBeforeGroups' | 'timeWindow' | 'assignmentColumns' | 'rowAssignments'>;

export function studioRowPrintFields(
  source: StudioRowSource,
  settings: Pick<ReportSettings, 'showDeps' | 'showCritical'>,
): StudioRowPrintFields {
  const resource = source.resource;
  const assignmentColumns = !!resource && resource.options.showAssignmentColumns;
  return {
    rows: source.rows,
    showDeps: source.multiBand ? false : settings.showDeps,
    showCritical: source.multiBand ? true : settings.showCritical,
    pageBreakBeforeGroups: !!resource && resource.options.pageBreakPerResource,
    timeWindow: source.window,
    assignmentColumns,
    rowAssignments: resource?.result.assignmentByRowKey,
  };
}
