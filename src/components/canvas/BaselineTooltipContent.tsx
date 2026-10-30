import { useTranslation } from 'react-i18next';
import { useDisplayDate } from '@/hooks/displayDate';
import type { Task } from '@/types/task';
import type { BaselineLayer, BaselineLayerSlot } from '@/types/baseline';
import { paintBaselineSwatch, svgStripRecorder } from '@/engine/renderer/baselineStrip';
import { useBaselineMarkStyle } from '@/utils/baselineMarkStyleDev';

/** Issue #391: CSS-kleur per baselineplaats; dezelfde thema-tokens als de tekenlaag. */
export const BASELINE_SLOT_COLOR: Record<BaselineLayerSlot, string> = {
  0: 'var(--theme-bar-baseline, #6B7280)',
  1: 'var(--theme-bar-baseline-compare-1, #0891B2)',
  2: 'var(--theme-bar-baseline-compare-2, #C026D3)',
};

/** Klein strookje dat laat zien welke baseline bedoeld is: dezelfde tekenregel als de Gantt
 *  (`paintBaselineSwatch`), dus in elke stijl van issue #741 ook zonder kleur te lezen. */
export function BaselineSwatch({ slot }: { slot: BaselineLayerSlot }) {
  const style = useBaselineMarkStyle();
  const W = 16, H = 6, LETTER = 6;
  const rec = svgStripRecorder(LETTER);
  paintBaselineSwatch(rec, slot, 0.5, 0.5, W - 1, H - 1, {
    colorOf: s => BASELINE_SLOT_COLOR[s], stripeWidth: 3, markStyle: style,
  });
  const width = style === 'label' ? W + LETTER + 3 : W;
  return (
    <svg
      aria-hidden="true"
      data-ops-baseline-swatch={slot}
      data-ops-baseline-mark-style={style}
      width={width} height={H + 4} viewBox={`0 -2 ${width} ${H + 4}`}
      style={{ display: 'inline-block', marginInlineEnd: 6, verticalAlign: 'middle', flexShrink: 0, overflow: 'visible' }}
    >
      {rec.items.map((it, i) => it.kind === 'fill'
        ? <path key={i} d={it.d} fill={it.color} />
        : it.kind === 'stroke'
          ? <path key={i} d={it.d} fill="none" stroke={it.color} strokeWidth={it.width} />
          : <text key={i} x={it.x} y={it.y} fill={it.color} fontSize={9} fontWeight={700} dominantBaseline="middle">{it.text}</text>)}
    </svg>
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
