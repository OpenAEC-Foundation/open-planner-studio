import type { ViewRow } from '@/engine/view/visibleRows';
import type { ResolvedPeriod, ResourceGanttRowsResult } from '@/engine/reports';
import type { PrintOptions } from '@/services/print/printPreview';
import type { ResourceGanttReportOptions, ReportSettings } from '@/utils/reportSettings';

/**
 * Waar de rijen van de afdruk vandaan komen (stap Taken, #861): `rows` (afwezig = alle taken als WBS-boom),
 * of een taak onder meer banden kan staan (dan geen relatielijnen), bij een resourcegroepering de
 * uitkomst en opties van het oude rapporttype Resourcediagram, en het tijdvak (#997). Bij een tijdvak staan in
 * `rows` al alleen de rijen die het raken.
 */
export interface StudioRowSource {
  rows: ViewRow[] | undefined;
  multiBand: boolean;
  resource: {
    result: ResourceGanttRowsResult;
    options: ResourceGanttReportOptions;
  } | null;
  /** Het tijdvak als tijdvenster; afwezig bij de hele planning. */
  window: ResolvedPeriod | undefined;
}

/** De velden van `PrintOptions` die uit de rijenbron volgen. */
export type StudioRowPrintFields = Pick<PrintOptions,
  'rows' | 'showDeps' | 'showCritical' | 'pageBreakBeforeGroups' | 'timeWindow' | 'assignmentColumns' | 'rowAssignments'>;

/**
 * De printvelden van een rijenbron. Puur, zodat `check-report-layouts.ts` precies deze regel naast het oude
 * rapporttype Resourcediagram (vóór #817) legt.
 * - Een taak onder meer banden: geen relatielijnen, en Kritiek pad aan. Dat vinkje kleurt alleen relatielijnen
 *   en de legendaregel; de balken blijven rood.
 * - Resourcegroepering: een blad per resource en de toewijzingskolommen.
 * - Een tijdvak: de tijdas precies op het tijdvak, voor elke bron.
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
    timeWindow: source.window,
    assignmentColumns,
    rowAssignments: resource?.result.assignmentByRowKey,
  };
}
