import { useState, useId, useEffect, useRef, useCallback } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Popover } from '@/components/common/Popover';
import { Icon } from '@/components/icons';

export { encodeFieldRef, decodeFieldRef } from '@/components/viewControls/fieldRefCodec';

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
          className="!text-body"
          style={{
            width: '100%',
            padding: '4px 8px',
            background: 'var(--theme-input-bg)',
            border: '1px solid var(--theme-control-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--theme-text)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <span>{current?.label ?? value}</span>
          <Icon id="ui.dropdown" size={16} />
        </button>
      }
    >
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => { onChange(o.value); setOpen(false); }}
          className="!text-body"
          style={{
            display: 'block',
            width: '100%',
            padding: '5px 8px',
            background: o.value === value ? 'var(--theme-active)' : 'var(--theme-dropdown-bg)',
            color: 'var(--theme-text)',
            border: 'none',
            textAlign: 'left',
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
      className="input !text-body !px-1.5 !py-1 w-full"
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

interface RibbonButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  form?: string;
  title?: string;
  itemId?: string;
  anchor?: string;
}

function ribbonButton(
  small: boolean,
  { icon, label, onClick, active, disabled, primary, danger, form, title, itemId, anchor }: RibbonButtonProps,
) {
  const cls = small ? ['ribbon-btn', 'small'] : ['ribbon-btn'];
  if (active) cls.push('active');
  if (disabled) cls.push('disabled');
  if (primary) cls.push('primary');
  if (danger) cls.push('danger');
  const tip = title ?? label.replace(/\u00ad/g, '').replace(/\s*\n\s*/g, ' ');
  return (
    <button
      className={cls.join(' ')}
      form={form}
      type={form ? (disabled ? 'button' : 'submit') : undefined}
      onClick={disabled ? undefined : onClick}
      title={tip}
      aria-label={tip}
      aria-disabled={disabled || undefined}
      data-ops-ribbon-item={itemId}
      data-tour-anchor={anchor}
    >
      <span className="ribbon-btn-icon">{icon}</span>
      <span className="ribbon-btn-label">{label}</span>
    </button>
  );
}

export function RibbonButton(props: RibbonButtonProps) {
  return ribbonButton(false, props);
}

export function RibbonSmallButton(props: Omit<RibbonButtonProps, 'primary'>) {
  return ribbonButton(true, props);
}

export function RibbonCompactTrigger({ icon, title, ariaLabel, onClick }: {
  icon: React.ReactNode;
  title: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      className="ribbon-btn small"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{ minWidth: 0, padding: '2px 5px', gap: 0 }}
    >
      <span className="ribbon-btn-icon" style={{ width: 16, height: 16 }}>{icon}</span>
    </button>
  );
}

export function RibbonCollapsible({ full, collapsed, popoverOpen, onHidden }: {
  full: React.ReactNode;
  collapsed: React.ReactNode;
  popoverOpen: boolean;
  onHidden: () => void;
}) {
  const collapsedRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef(onHidden);
  hiddenRef.current = onHidden;
  useEffect(() => {
    const el = collapsedRef.current;
    if (!popoverOpen || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (el.getClientRects().length === 0) hiddenRef.current();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [popoverOpen]);
  return (
    <>
      <div className="ribbon-collapse-full" data-ribbon-collapse-part="full">{full}</div>
      <div
        ref={collapsedRef}
        data-ribbon-collapse-part="collapsed"
        data-ribbon-popover-open={popoverOpen ? '' : undefined}
      >
        {collapsed}
      </div>
    </>
  );
}

export function RibbonCollapsedTrigger({ icon, label, title, open, onClick }: {
  icon: React.ReactNode;
  label: string;
  title: string;
  open: boolean;
  onClick: (viaKeyboard: boolean) => void;
}) {
  return (
    <button
      className="ribbon-btn"
      onClick={event => onClick(event.detail === 0)}
      title={title}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <span className="ribbon-btn-icon">{icon}</span>
      <span className="ribbon-btn-label">{label}<Icon id="ui.dropdown" size={16} className="ribbon-label-caret" /></span>
    </button>
  );
}

export function RibbonPopoverContent({ trap, children }: { trap: boolean; children: React.ReactNode }) {
  return trap ? <FocusTrappedContent>{children}</FocusTrappedContent> : <>{children}</>;
}

function FocusTrappedContent({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const firstField = useCallback(() => ref.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])') ?? null, []);
  useFocusTrap(ref, firstField);
  return <div ref={ref} style={{ display: 'contents' }}>{children}</div>;
}

type MenuItemOverflow = 'wrap' | 'nowrap' | 'ellipsis';

export function RibbonMenuItem({ onClick, title, overflow = 'nowrap', fill = false, children }: {
  onClick: () => void;
  title?: string;
  overflow?: MenuItemOverflow;
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className="!text-body"
      style={{
        ...(fill ? { flex: 1 } : { display: 'block', width: '100%' }),
        textAlign: 'left', padding: '6px 12px', border: 'none',
        background: 'transparent', color: 'var(--theme-text)', cursor: 'pointer',
        ...(overflow !== 'wrap' ? { whiteSpace: 'nowrap' } : {}),
        ...(overflow === 'ellipsis' ? { overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
      }}
      title={title}
      onMouseOver={e => (e.currentTarget.style.background = 'var(--theme-hover)')}
      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RibbonGroup({ label, anchor, children }: {
  label: string;
  anchor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ribbon-group" data-tour-anchor={anchor}>
      <div className="ribbon-group-content">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

export function RibbonButtonStack({ anchor, children }: { anchor?: string; children: React.ReactNode }) {
  return <div className="ribbon-btn-stack" data-tour-anchor={anchor}>{children}</div>;
}
