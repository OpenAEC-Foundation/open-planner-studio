import { RESOURCE_DIAGRAM_LAYOUT_ID } from '@/engine/view/layoutPresets';
import { groupIsMultiBand } from '@/engine/reports/layoutReport';
import type { Layout } from '@/types/view';
import type { BarColorSelection } from '@/types/barColor';
import type { ReportSettings } from '@/utils/reportSettings';
import { reportColumnsFromGrid } from './reportColumns';

// De keuze in de stap Taken van het nieuwe Rapport-tabblad (issue #861): alle taken, zoals de weergave, of
// een layout. Eén keuze tegelijk, bewaard in `ops-reportSettings`. Puur, zodat de planningssuite het headless
// toetst; de lijst met layouts komt uit `useReportLayouts`.

export type ReportTaskSource = { kind: 'all' } | { kind: 'view' } | { kind: 'layout'; id: string };

/**
 * De keuze uit de bewaarde stand. De rijenbron staat in `layoutId`, ook voor de meegeleverde layout
 * Resourcediagram: zo overleeft de keuze een uitstap naar een ander rapport, dat alleen `reportType`
 * overschrijft (review Sol #847, ronde 4). `reportType: 'resourceGantt'` blijft als invoer gelden: een
 * opslag van vóór deze keuze, of een keuze voor het rapporttype Resourcediagram in het oude paneel (flag
 * uit), opent als de layout Resourcediagram.
 */
export function reportTaskSource(settings: Pick<ReportSettings, 'reportType' | 'layoutId' | 'followView'>): ReportTaskSource {
  if (settings.reportType === 'resourceGantt') return { kind: 'layout', id: RESOURCE_DIAGRAM_LAYOUT_ID };
  if (settings.layoutId) return { kind: 'layout', id: settings.layoutId };
  return settings.followView ? { kind: 'view' } : { kind: 'all' };
}

/**
 * De velden die een keuze in de stap Taken schrijft. De layout Resourcediagram schrijft daarnaast
 * `reportType: 'resourceGantt'`, zodat het oude paneel (flag uit) bij die keuze het Resourcediagram toont.
 */
export function taskSourcePatch(source: ReportTaskSource): Pick<ReportSettings, 'reportType' | 'layoutId' | 'followView'> {
  if (source.kind === 'layout' && source.id === RESOURCE_DIAGRAM_LAYOUT_ID) {
    return { reportType: 'resourceGantt', layoutId: RESOURCE_DIAGRAM_LAYOUT_ID, followView: false };
  }
  if (source.kind === 'layout') return { reportType: 'gantt', layoutId: source.id, followView: false };
  return { reportType: 'gantt', layoutId: '', followView: source.kind === 'view' };
}

/**
 * De balkkleuren op papier. Bij *Zoals de weergave* die van het scherm (live), net als de kolommen; anders de
 * eigen keuze van het rapport.
 */
export function reportBarColors(
  settings: Pick<ReportSettings, 'reportType' | 'layoutId' | 'followView' | 'barColors'>,
  screen: BarColorSelection,
): BarColorSelection {
  return reportTaskSource(settings).kind === 'view' ? screen : settings.barColors;
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
 * Wat een layout naar de stappen Kolommen en Balken kan brengen (#861). De rijen volgen de layout live; deze
 * velden neemt het rapport alleen over als de planner op "Kolommen overnemen" of "Balkopties overnemen" klikt
 * (fixronde na council ronde 5), elk met één stap "Ongedaan maken". Een keuze wisselen verandert ze nooit.
 * - `columns` → de kolommen van het rapport (de taaknaam blijft verplicht). Geen kolommen ⇒ ongemoeid.
 * - `showRelations` → Afhankelijkheden, behalve bij een groepering waarin een taak onder meer banden staat:
 *   daar staan de relatielijnen toch uit, en de keuze voor een gewone afdruk blijft bewaard.
 * - `overlays` → basislijn, speling, de statuslijn (voortgangslijn gaat voor statusdatumlijn) en de
 *   balkkleuren; die van het rapport zijn eigen, de Gantt op het scherm verandert niet mee. De resourcekleur
 *   heeft geen tegenhanger op papier.
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
    patch.barColors = layout.overlays.barColors;
  }
  return patch;
}
