import { useState, useId } from 'react';
import { Popover } from '@/components/common/Popover';

/**
 * Gedeelde ribbon-primitives: zowel het declaratieve render-pad (RibbonTabContent) als de
 * complexe widget-escape-hatches (ribbonWidgets) delen deze bouwstenen. De markup/CSS-klassen
 * horen bij Ribbon.css.
 */

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
          <span className="!text-caption" style={{ opacity: 0.6 }}>▼</span>
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
  /** Tooltip — ook op de grote knop, waar de Relatie-knop afhankelijk van de selectie iets anders
   *  doet. Puur een `title`-attribuut:
   *  geen enkel effect op de vormgeving van het lint. */
  title?: string;
  /** Spec-id van het lintitem als `data-ops-ribbon-item`. Stabiel aanknopingspunt voor de
   *  browsertests: de toegankelijke naam is de (taalafhankelijke) tooltip, en het zichtbare label
   *  verdwijnt in de icoon-only-standen. */
  itemId?: string;
}

/** Grote en kleine lintknop delen alles behalve de `small`-klasse (en `primary` bestaat alleen groot). */
function ribbonButton(
  small: boolean,
  { icon, label, onClick, active, disabled, primary, danger, title, itemId }: RibbonButtonProps,
) {
  const cls = small ? ['ribbon-btn', 'small'] : ['ribbon-btn'];
  if (active) cls.push('active');
  if (disabled) cls.push('disabled');
  if (primary) cls.push('primary');
  if (danger) cls.push('danger');
  // Zonder eigen tooltip valt het label terug als tooltip: in de icoon-only-standen (handmatig
  // ingeklapt, of automatisch gedegradeerd) is het label verborgen en zou de knop anders volstrekt
  // naamloos zijn. Een expliciete `title` (bv. de Relatie-knop) wint.
  const tip = title ?? label;
  return (
    <button
      className={cls.join(' ')}
      onClick={disabled ? undefined : onClick}
      title={tip}
      aria-label={tip}
      aria-disabled={disabled || undefined}
      data-ops-ribbon-item={itemId}
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

/**
 * Icoon-only trigger van een compacte lintgroep: de hele groep zit dan achter deze ene knop en een
 * popover (Basislijnen/Voortgang, AI-verbinding).
 */
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

type MenuItemOverflow = 'wrap' | 'nowrap' | 'ellipsis';

/**
 * Tekstregel in een lint-keuzemenu (Mijlpaal, Sjablonen, Recent, Exporteren, Resource toewijzen).
 * `overflow` bepaalt of lange tekst doorloopt, op één regel blijft of met "…" afkapt; `fill` laat
 * de knop naast een ander element in een flex-rij de resterende breedte nemen (sjablonen).
 */
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
