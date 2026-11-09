import { RESOURCE_DIAGRAM_LAYOUT_ID } from '@/engine/view/layoutPresets';
import { groupIsMultiBand } from '@/engine/reports/layoutReport';
import type { Layout } from '@/types/view';
import type { ReportSettings } from '@/utils/reportSettings';
import { reportColumnsFromGrid } from './reportColumns';

// De keuze in de stap Taken van het nieuwe Rapport-tabblad (issue #861): alle taken, zoals de weergave, of
// een layout. Eén keuze tegelijk, bewaard in `ops-reportSettings`. Puur, zodat de planningssuite het headless
// toetst; de lijst met layouts komt uit `useReportLayouts`.

export type ReportTaskSource = { kind: 'all' } | { kind: 'view' } | { kind: 'layout'; id: string };

/**
 * De keuze uit de bewaarde stand. `reportType: 'resourceGantt'` is de meegeleverde layout Resourcediagram:
 * zo opent een bewaarde keuze voor het oude rapporttype met de flag aan als Gantt-afdruk met die layout, en
 * toont het oude paneel (flag uit) bij die keuze nog steeds het Resourcediagram.
 */
export function reportTaskSource(settings: Pick<ReportSettings, 'reportType' | 'layoutId' | 'followView'>): ReportTaskSource {
  if (settings.reportType === 'resourceGantt') return { kind: 'layout', id: RESOURCE_DIAGRAM_LAYOUT_ID };
  if (settings.layoutId) return { kind: 'layout', id: settings.layoutId };
  return settings.followView ? { kind: 'view' } : { kind: 'all' };
}

/** De velden die een keuze in de stap Taken schrijft. */
export function taskSourcePatch(source: ReportTaskSource): Pick<ReportSettings, 'reportType' | 'layoutId' | 'followView'> {
  if (source.kind === 'layout' && source.id === RESOURCE_DIAGRAM_LAYOUT_ID) {
    return { reportType: 'resourceGantt', layoutId: '', followView: false };
  }
  if (source.kind === 'layout') return { reportType: 'gantt', layoutId: source.id, followView: false };
  return { reportType: 'gantt', layoutId: '', followView: source.kind === 'view' };
}

/** Een vaste sleutel per keuze, voor de radiogroep. */
export function taskSourceKey(source: ReportTaskSource): string {
  return source.kind === 'layout' ? `layout:${source.id}` : source.kind;
}

export function taskSourceFromKey(key: string): ReportTaskSource {
  if (key.startsWith('layout:')) return { kind: 'layout', id: key.slice('layout:'.length) };
  return key === 'view' ? { kind: 'view' } : { kind: 'all' };
}

/**
 * Wat een layout bij het kiezen naar de stappen Kolommen en Balken brengt (#861). De rijen volgen de layout
 * live; deze velden neemt het rapport één keer over, met één stap "Ongedaan maken", en daarna zijn ze van de
 * planner.
 * - `columns` → de kolommen van het rapport (de taaknaam blijft verplicht). Geen kolommen ⇒ ongemoeid.
 * - `showRelations` → Afhankelijkheden, behalve bij een groepering waarin een taak onder meer banden staat:
 *   daar staan de relatielijnen toch uit, en de keuze voor een gewone afdruk blijft bewaard.
 * - `overlays` → basislijn, speling en de statuslijn (voortgangslijn gaat voor statusdatumlijn). De
 *   resourcekleur heeft geen tegenhanger op papier; de balkkleuren gelden voor rapport én scherm en gaan
 *   daarom niet vanzelf mee (de stap Taken meldt het verschil, met de knop "Balkkleuren overnemen").
 * - `timeScale` → genegeerd: het rapport heeft een eigen paginaschaal (Pagina).
 */
export function layoutReportPatch(layout: Layout, availableColumnIds: ReadonlySet<string>): Partial<ReportSettings> {
  const patch: Partial<ReportSettings> = {};
  if (layout.columns) patch.columns = reportColumnsFromGrid(layout.columns.map(column => String(column.id)), availableColumnIds);
  if (layout.showRelations !== undefined && !groupIsMultiBand(layout.group)) patch.showDeps = layout.showRelations;
  if (layout.overlays) {
    patch.showBaselineOverlay = layout.overlays.baseline;
    patch.showFloat = layout.overlays.floatBand;
    patch.statusLine = layout.overlays.progressLine ? 'progress' : layout.overlays.statusDateLine ? 'statusDate' : 'none';
  }
  return patch;
}
