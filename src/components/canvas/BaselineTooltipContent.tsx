import { useTranslation } from 'react-i18next';
import { useDisplayDate } from '@/hooks/displayDate';
import type { Task } from '@/types/task';
import type { BaselineLayer, BaselineLayerSlot } from '@/types/baseline';

/** Issue #391: CSS-kleur per baselineplaats; dezelfde thema-tokens als de tekenlaag. */
export const BASELINE_SLOT_COLOR: Record<BaselineLayerSlot, string> = {
  0: 'var(--theme-bar-baseline, #6B7280)',
  1: 'var(--theme-bar-baseline-compare-1, #0891B2)',
  2: 'var(--theme-bar-baseline-compare-2, #C026D3)',
};

/** Klein rond kleurstrookje dat laat zien welke baseline (kleur) bedoeld is. */
export function BaselineSwatch({ slot }: { slot: BaselineLayerSlot }) {
  return (
    <span
      aria-hidden="true"
      data-ops-baseline-swatch={slot}
      style={{
        display: 'inline-block', width: 16, height: 6, borderRadius: 3, marginInlineEnd: 6,
        verticalAlign: 'middle', background: BASELINE_SLOT_COLOR[slot], flexShrink: 0,
      }}
    />
  );
}

/**
 * Issue #391: hovertooltip op een stuk van de baselinestrook. Noemt de taak en daaronder
 * elke baseline die in dat stuk ligt: kleurstrookje, naam (de actieve met "actief"), start en einde.
 */
export function BaselineTooltipContent({ task, slots, layers }: {
  task: Task;
  slots: BaselineLayerSlot[];
  layers: BaselineLayer[];
}) {
  const { t: tTask } = useTranslation('task');
  const dd = useDisplayDate();
  const format = (iso: string) => (iso ? dd.date(iso) : '-');
  const rows = slots
    .map(slot => {
      const layer = layers.find(l => l.slot === slot);
      const entry = layer?.overlay.get(task.id);
      return layer && entry ? { slot, layer, entry } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return null;
  return (
    <div data-ops-baseline-tooltip={rows.map(r => r.slot).join(',')}>
      <div className="tooltip-title">{task.name}</div>
      {rows.map(({ slot, layer, entry }) => (
        <div key={slot} className="tooltip-row" data-ops-baseline-tooltip-row={slot}>
          <span className="tooltip-label" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <BaselineSwatch slot={slot} />
            {layer.name}
            {slot === 0 && <span style={{ color: 'var(--theme-text-muted)', marginInlineStart: 4 }}>({tTask('tooltip.baselineActive')})</span>}
          </span>
          <span className="tooltip-value">
            {entry.isMilestone ? format(entry.start) : `${format(entry.start)} – ${format(entry.finish)}`}
          </span>
        </div>
      ))}
    </div>
  );
}
