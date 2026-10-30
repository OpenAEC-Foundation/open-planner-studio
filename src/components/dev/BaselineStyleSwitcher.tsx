// Issue #741: tijdelijke schakelaar tussen de varianten voor een baseline zonder kleur. Alleen op de
// dev-server, en alleen als de link `baselineStijl` noemt. Geen gebruikerstekst: hij verdwijnt zodra
// de eigenaar een variant kiest, en komt nooit in een build.
import { BASELINE_MARK_STYLES } from '@/engine/renderer/baselineStrip';
import { setDevBaselineMarkStyle, setDevGrayscale, useDevBaselineSwitch } from '@/utils/baselineMarkStyleDev';

const button = (active: boolean): React.CSSProperties => ({
  padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
  border: '1px solid var(--theme-border, #888)',
  background: active ? 'var(--theme-accent, #2563eb)' : 'transparent',
  color: active ? '#fff' : 'inherit',
});

export function BaselineStyleSwitcher() {
  const { style, grayscale } = useDevBaselineSwitch();
  return (
    <div
      data-ops-dev-baseline-switch
      className="text-caption"
      style={{
        position: 'fixed', right: 12, bottom: 40, zIndex: 9999, display: 'flex', gap: 4, alignItems: 'center',
        padding: 6, borderRadius: 6, background: 'var(--theme-bg-panel, #fff)', color: 'var(--theme-text, #111)',
        border: '1px solid var(--theme-border, #888)', boxShadow: '0 2px 8px rgba(0,0,0,.25)',
      }}
    >
      <span style={{ marginInlineEnd: 4 }}>{'#741'}</span>
      {BASELINE_MARK_STYLES.map(s => (
        <button key={s} type="button" data-ops-dev-baseline-style={s} style={button(s === style)} onClick={() => setDevBaselineMarkStyle(s)}>
          {s}
        </button>
      ))}
      <button type="button" data-ops-dev-grayscale style={button(grayscale)} onClick={() => setDevGrayscale(!grayscale)}>
        {'zw'}
      </button>
    </div>
  );
}
