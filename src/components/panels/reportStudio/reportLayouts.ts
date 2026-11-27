import { RESOURCE_DIAGRAM_LAYOUT_ID } from '@/engine/view/layoutPresets';
import { groupIsMultiBand } from '@/engine/reports/layoutReport';
import type { Layout } from '@/types/view';
import type { BarColorSelection } from '@/types/barColor';
import type { ReportSettings } from '@/utils/reportSettings';
import { reportColumnsFromGrid } from './reportColumns';

export type ReportTaskSource = { kind: 'all' } | { kind: 'view' } | { kind: 'layout'; id: string };

export function reportTaskSource(settings: Pick<ReportSettings, 'reportType' | 'layoutId' | 'followView'>): ReportTaskSource {
  if (settings.reportType === 'resourceGantt') return { kind: 'layout', id: RESOURCE_DIAGRAM_LAYOUT_ID };
  if (settings.layoutId) return { kind: 'layout', id: settings.layoutId };
  return settings.followView ? { kind: 'view' } : { kind: 'all' };
}

export function taskSourcePatch(source: ReportTaskSource): Pick<ReportSettings, 'reportType' | 'layoutId' | 'followView'> {
  if (source.kind === 'layout') return { reportType: 'gantt', layoutId: source.id, followView: false };
  return { reportType: 'gantt', layoutId: '', followView: source.kind === 'view' };
}

export function reportBarColors(
  settings: Pick<ReportSettings, 'reportType' | 'layoutId' | 'followView' | 'barColors'>,
  screen: BarColorSelection,
): BarColorSelection {
  return reportTaskSource(settings).kind === 'view' ? screen : settings.barColors;
}

export function taskSourceKey(source: ReportTaskSource): string {
  return source.kind === 'layout' ? `layout:${source.id}` : source.kind;
}

export function taskSourceFromKey(key: string): ReportTaskSource {
  if (key.startsWith('layout:')) return { kind: 'layout', id: key.slice('layout:'.length) };
  return key === 'view' ? { kind: 'view' } : { kind: 'all' };
}

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
