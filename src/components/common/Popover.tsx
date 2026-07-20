import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '@/hooks/useClickOutside';

/**
 * Gedeelde dropdown/popover-primitive (audit UI-F3): bundelt de container (`position: relative`),
 * de klik-buiten-afhandeling (via {@link useClickOutside}) en de paneel-basisstijl die de acht
 * ribbon-dropdowns letterlijk hadden gekopieerd (de `--theme-dropdown-bg`-achtergrond,
 * `--theme-border`-rand, `--radius-md` en `--shadow-pop`).
 *
 * Het paneel wordt via `createPortal` naar `document.body` gerenderd i.p.v. `position: absolute`
 * binnen de container: de ribbon-groepen zitten in `.ribbon-content-scroll`, dat bewust
 * `overflow-y: hidden` heeft (voor de horizontale scroll bij te veel groepen) — een gewoon
 * absoluut-gepositioneerd paneel daarbinnen werd dus altijd afgesneden zodra het onder de rand van
 * die 90px-hoge strook uitstak, wat bij élk paneel met meer dan 1-2 items gebeurde (bug: klik op
 * Mijlpaal ▾ toonde alleen een 20px-sliver van het keuzemenu). De portal ontsnapt aan die clip; de
 * positie wordt na mount gemeten (`useLayoutEffect`, vóór de eerste schilderbeurt — geen zichtbare
 * sprong) i.p.v. relatief aan de trigger, en de aanroeper's `align` bepaalt links- of
 * rechts-verankering aan de trigger.
 *
 * Bewust *controlled*: de aanroeper houdt zijn eigen `open`-state (dropdowns gebruiken die soms ook
 * voor de trigger-`active`-klasse of om een lijst te verversen). De variatiepunten van de acht sites
 * — uitlijning links/rechts, `zIndex`, `minWidth`/`maxWidth`/`maxHeight`, `padding`, flex-layout —
 * blijven per site via `panelStyle` gezet, zodat het resultaat visueel identiek is aan vroeger.
 */
const BASE_PANEL_STYLE: CSSProperties = {
  position: 'fixed',
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
  const panelRef = useRef<HTMLDivElement>(null);
  // extraRef: het paneel leeft (via de portal) buiten `ref`'s DOM-subtree — zonder dit telt een
  // klik ín het paneel als "buiten" en sluit useClickOutside het meteen vóór het item-onClick vuurt.
  useClickOutside(ref, onClose, open, { extraRef: panelRef });

  const [panelPos, setPanelPos] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!open) { setPanelPos(null); return; }
    const trigger = ref.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelPos(
      align === 'right'
        ? { top: rect.bottom, right: window.innerWidth - rect.right }
        : { top: rect.bottom, left: rect.left },
    );
  }, [open, align]);

  return (
    <div ref={ref} style={{ position: 'relative', ...containerStyle }}>
      {trigger}
      {open && panelPos && createPortal(
        <div ref={panelRef} style={{ ...BASE_PANEL_STYLE, ...panelPos, ...panelStyle }}>
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
