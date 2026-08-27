import { useState, useId } from 'react';
import { Popover } from '@/components/common/Popover';
import type { FieldRef } from '@/state/slices/types';

/**
 * Gedeelde ribbon-primitives (audit P18). Vroeger stonden deze onderdelen als lokale
 * helpers boven in Ribbon.tsx; ze zijn hierheen verplaatst zodat zowel het declaratieve
 * render-pad (RibbonTabContent) als de complexe widget-escape-hatches (ribbonWidgets)
 * dezelfde bouwstenen delen. Markup/CSS-klassen zijn ONgewijzigd — Ribbon.css blijft kloppen.
 */

export function encodeFieldRef(f: FieldRef): string {
  return JSON.stringify(f);
}
export function decodeFieldRef(s: string): FieldRef {
  return JSON.parse(s) as FieldRef;
}

export function RibbonDropdown<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const current = options.find(o => o.value === value);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      containerStyle={{ minWidth: 100 }}
      panelStyle={{ marginTop: 2, zIndex: 9999 }}
      trigger={
        <button
          id={id}
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%',
            padding: '4px 8px',
            background: 'var(--theme-input-bg)',
            border: '1px solid var(--theme-control-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--theme-text)',
            fontSize: 'calc(11px * var(--ui-font-scale, 1))',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <span>{current?.label ?? value}</span>
          <span style={{ fontSize: 'calc(8px * var(--ui-font-scale, 1))', opacity: 0.6 }}>▼</span>
        </button>
      }
    >
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => { onChange(o.value); setOpen(false); }}
          style={{
            display: 'block',
            width: '100%',
            padding: '5px 8px',
            background: o.value === value ? 'var(--theme-active)' : 'var(--theme-dropdown-bg)',
            color: 'var(--theme-text)',
            border: 'none',
            textAlign: 'left',
            fontSize: 'calc(11px * var(--ui-font-scale, 1))',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { if (o.value !== value) (e.target as HTMLElement).style.background = 'var(--theme-hover)'; }}
          onMouseLeave={e => { if (o.value !== value) (e.target as HTMLElement).style.background = 'var(--theme-dropdown-bg)'; }}
        >
          {o.label}
        </button>
      ))}
    </Popover>
  );
}

/**
 * Compacte native keuzelijst voor een bediening die al ín een Popover staat. Een tweede
 * geportalde RibbonDropdown is daar niet veilig: de buitenste click-outside-handler ziet een klik
 * in dat tweede portaal als buitenklik en kan de opties vóór hun click-handler ontkoppelen.
 */
export function RibbonInlineSelect<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={event => onChange(event.currentTarget.value as T)}
      className="input !text-[11px] !px-1.5 !py-1 w-full"
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

export function RibbonButton({ icon, label, onClick, active, disabled, primary, danger, title }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  /** Tooltip — bestond alleen op de kleine knop; issue #40 heeft hem ook op de grote nodig, waar
   *  de Relatie-knop afhankelijk van de selectie iets anders doet. Puur een `title`-attribuut:
   *  geen enkel effect op de vormgeving van het lint. */
  title?: string;
}) {
  const cls = ['ribbon-btn'];
  if (active) cls.push('active');
  if (disabled) cls.push('disabled');
  if (primary) cls.push('primary');
  if (danger) cls.push('danger');
  // Zonder eigen tooltip valt het label terug als tooltip: in de icoon-only-standen (handmatig
  // ingeklapt, of automatisch gedegradeerd) is het label verborgen en zou de knop anders volstrekt
  // naamloos zijn. Een expliciete `title` (bv. de Relatie-knop, issue #40) wint.
  const tip = title ?? label;
  return (
    <button className={cls.join(' ')} onClick={disabled ? undefined : onClick} title={tip} aria-label={tip} aria-disabled={disabled || undefined}>
      <span className="ribbon-btn-icon">{icon}</span>
      <span className="ribbon-btn-label">{label}</span>
    </button>
  );
}

export function RibbonSmallButton({ icon, label, onClick, active, disabled, danger, title }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  const cls = ['ribbon-btn', 'small'];
  if (active) cls.push('active');
  if (disabled) cls.push('disabled');
  if (danger) cls.push('danger');
  // Zie RibbonButton: label als terugval-tooltip, zodat een icoon-only knop nooit naamloos is.
  const tip = title ?? label;
  return (
    <button
      className={cls.join(' ')}
      onClick={disabled ? undefined : onClick}
      title={tip}
      aria-label={tip}
      aria-disabled={disabled || undefined}
    >
      <span className="ribbon-btn-icon">{icon}</span>
      <span className="ribbon-btn-label">{label}</span>
    </button>
  );
}

export function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-content">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

export function RibbonButtonStack({ children }: { children: React.ReactNode }) {
  return <div className="ribbon-btn-stack">{children}</div>;
}
