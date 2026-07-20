import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

/**
 * Gedeelde dropdown/popover-primitive (audit UI-F3): bundelt de container (`position: relative`),
 * de klik-buiten-afhandeling (via {@link useClickOutside}) en de paneel-basisstijl die de acht
 * ribbon-dropdowns letterlijk hadden gekopieerd (absolute positionering onder de trigger, de
 * `--theme-dropdown-bg`-achtergrond, `--theme-border`-rand, `--radius-md` en `--shadow-pop`).
 *
 * Bewust *controlled*: de aanroeper houdt zijn eigen `open`-state (dropdowns gebruiken die soms ook
 * voor de trigger-`active`-klasse of om een lijst te verversen). De variatiepunten van de acht sites
 * — uitlijning links/rechts, `zIndex`, `minWidth`/`maxWidth`/`maxHeight`, `padding`, flex-layout —
 * blijven per site via `panelStyle` gezet, zodat het resultaat visueel identiek is aan vroeger.
 */
const BASE_PANEL_STYLE: CSSProperties = {
  position: 'absolute',
  top: '100%',
  background: 'var(--theme-dropdown-bg)',
  border: '1px solid var(--theme-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-pop)',
};

export interface PopoverProps {
  /** Open-vlag (controlled). */
  open: boolean;
  /** Aangeroepen wanneer buiten geklikt wordt (de aanroeper zet dan zijn `open` op false). */
  onClose: () => void;
  /** De trigger (knop) — altijd gerenderd, binnen de `position: relative`-container. */
  trigger: ReactNode;
  /** Paneelinhoud — alleen gerenderd als `open`. */
  children: ReactNode;
  /** Horizontale verankering van het paneel onder de trigger (default `'left'`). */
  align?: 'left' | 'right';
  /** Per-site paneel-overrides (zIndex, minWidth, padding, flex-layout, marginTop, …). */
  panelStyle?: CSSProperties;
  /** Extra stijl op de `position: relative`-container (bijv. `minWidth`). */
  containerStyle?: CSSProperties;
}

export function Popover({
  open, onClose, trigger, children, align = 'left', panelStyle, containerStyle,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, open);

  return (
    <div ref={ref} style={{ position: 'relative', ...containerStyle }}>
      {trigger}
      {open && (
        <div style={{ ...BASE_PANEL_STYLE, [align]: 0, ...panelStyle }}>
          {children}
        </div>
      )}
    </div>
  );
}
