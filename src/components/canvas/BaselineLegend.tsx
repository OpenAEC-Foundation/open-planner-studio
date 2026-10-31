import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { buildBaselineLayers, type BaselineLayer } from '@/types/baseline';
import { BaselineSwatch } from './BaselineTooltipContent';

/**
 * De lagen voor de legenda in de statusbalk: leeg tenzij er naast de actieve baseline minstens één
 * vergelijkingsbaseline in de Gantt staat (actief eerst, dan de vergelijkingen, in de stapelvolgorde).
 */
export function useBaselineLegendLayers(): BaselineLayer[] {
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const compared = useAppStore(s => s.comparedBaselineIds);
  const showBaselineOverlay = useAppStore(s => s.ui.showBaselineOverlay);
  return useMemo(() => {
    const layers = buildBaselineLayers(baselines, activeBaselineId, compared);
    return showBaselineOverlay && layers.some(l => l.slot !== 0) ? layers : [];
  }, [baselines, activeBaselineId, compared, showBaselineOverlay]);
}

/**
 * Issue #391: legenda van de baselinelagen in de statusbalk: ze zegt welke kleur bij welke baseline
 * hoort. Met `namesHidden` blijven alleen de kleuren staan; de naam staat dan in de tooltip.
 */
export function BaselineLegend({ layers, namesHidden }: { layers: BaselineLayer[]; namesHidden: boolean }) {
  if (layers.length === 0) return null;
  return (
    <span data-ops-baseline-legend className="flex items-center gap-3">
      {layers.map(l => (
        <span key={l.slot} className="flex items-center" title={l.name}>
          <BaselineSwatch slot={l.slot} />
          {!namesHidden && <span>{l.name}</span>}
        </span>
      ))}
    </span>
  );
}
