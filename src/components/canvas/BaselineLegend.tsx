import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { buildBaselineLayers } from '@/types/baseline';
import { BaselineSwatch } from './BaselineTooltipContent';

/**
 * Issue #391: legenda van de baselinelagen in de statusbalk. Alleen zichtbaar als er
 * naast de actieve baseline minstens één vergelijkingsbaseline in de Gantt staat: dan zegt ze welke
 * kleur bij welke baseline hoort (actief eerst, dan de vergelijkingen, in de stapelvolgorde).
 */
export function BaselineLegend() {
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const compared = useAppStore(s => s.comparedBaselineIds);
  const showBaselineOverlay = useAppStore(s => s.ui.showBaselineOverlay);
  const layers = useMemo(
    () => buildBaselineLayers(baselines, activeBaselineId, compared),
    [baselines, activeBaselineId, compared],
  );
  if (!showBaselineOverlay || !layers.some(l => l.slot !== 0)) return null;
  return (
    <span data-ops-baseline-legend className="flex items-center gap-3 min-w-0">
      {layers.map(l => (
        <span key={l.slot} className="flex items-center min-w-0 whitespace-nowrap" title={l.name}>
          <BaselineSwatch slot={l.slot} />
          <span className="overflow-hidden text-ellipsis">{l.name}</span>
        </span>
      ))}
    </span>
  );
}
