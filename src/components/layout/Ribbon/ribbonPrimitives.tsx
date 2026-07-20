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
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <span>{current?.label ?? value}</span>
          <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
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
            fontSize: 11,
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

export function RibbonButton({ icon, label, onClick, active, disabled, primary, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const cls = ['ribbon-btn'];
  if (active) cls.push('active');
  if (disabled) cls.push('disabled');
  if (primary) cls.push('primary');
  if (danger) cls.push('danger');
  return (
    <button className={cls.join(' ')} onClick={disabled ? undefined : onClick}>
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
  return (
    <button className={cls.join(' ')} onClick={disabled ? undefined : onClick} title={title}>
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
