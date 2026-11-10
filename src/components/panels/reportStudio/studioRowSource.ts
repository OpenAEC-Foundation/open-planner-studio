import type { ViewRow } from '@/engine/view/visibleRows';
import type { ResolvedPeriod, ResourceGanttRowsResult } from '@/engine/reports';
import type { PrintOptions } from '@/services/print/printPreview';
import type { ResourceGanttReportOptions, ReportSettings } from '@/utils/reportSettings';

/**
 * Waar de rijen van de afdruk vandaan komen (stap Taken, #861): `rows` (afwezig = alle taken als WBS-boom),
 * of een taak onder meer banden kan staan (dan geen relatielijnen), en bij een resourcegroepering de
 * uitkomst en opties van het oude rapporttype Resourcediagram.
 */
export interface StudioRowSource {
  rows: ViewRow[] | undefined;
  multiBand: boolean;
  resource: {
    result: ResourceGanttRowsResult;
    options: ResourceGanttReportOptions;
    /** De rapportageperiode als tijdvenster; afwezig bij "Hele project". */
    window: ResolvedPeriod | undefined;
  } | null;
}

/** De velden van `PrintOptions` die uit de rijenbron volgen. */
export type StudioRowPrintFields = Pick<PrintOptions,
  'rows' | 'showDeps' | 'showCritical' | 'pageBreakBeforeGroups' | 'timeWindow' | 'assignmentColumns' | 'rowAssignments'>;

/**
 * De printvelden van een rijenbron. Puur, zodat `check-report-layouts.ts` precies deze regel naast het oude
 * rapporttype Resourcediagram (`ReportPanel`) legt.
 * - Een taak onder meer banden: geen relatielijnen, en Kritiek pad aan. Dat vinkje kleurt alleen relatielijnen
 *   en de legendaregel; de balken blijven rood (`reportTypeShowsCriticalToggle`).
 * - Resourcegroepering: een blad per resource, de tijdas op de periode, de toewijzingskolommen.
 */
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
    timeWindow: resource?.window,
    assignmentColumns,
    rowAssignments: resource?.result.assignmentByRowKey,
  };
}
