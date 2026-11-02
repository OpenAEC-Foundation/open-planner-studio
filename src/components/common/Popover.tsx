import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '@/hooks/useClickOutside';

/**
 * Gedeelde dropdown/popover-primitive: bundelt de container (`position: relative`),
 * de klik-buiten-afhandeling (via {@link useClickOutside}) en de paneel-basisstijl van de
 * ribbon-dropdowns (de `--theme-dropdown-bg`-achtergrond,
 * `--theme-border`-rand, `--radius-md` en `--shadow-pop`).
 *
 * Het paneel wordt via `createPortal` naar `document.body` gerenderd i.p.v. `position: absolute`
 * binnen de container: de ribbon-groepen zitten in `.ribbon-content-scroll`, dat bewust
 * `overflow-y: hidden` heeft (voor de horizontale scroll bij te veel groepen) — een gewoon
 * absoluut-gepositioneerd paneel daarbinnen wordt afgesneden zodra het onder de rand van
 * die 90px-hoge strook uitsteekt. De portal ontsnapt aan die clip; de
 * positie wordt na mount gemeten (`useLayoutEffect`, vóór de eerste schilderbeurt — geen zichtbare
 * sprong) i.p.v. relatief aan de trigger, en de aanroeper's `align` bepaalt links- of
 * rechts-verankering aan de trigger. Past het paneel daar niet, dan schuift het het venster in: het
 * begint breed genoeg om gemeten te worden (`width: max-content`, dus los van de ruimte die rechts
 * ervan over is) en wordt nooit breder dan het venster. `panelPos` zet ook een `minWidth` op de gemeten
 * trigger-breedte (`minWidth: '100%'` zou voor een `position: fixed`-element de viewport
 * zijn); sites met een eigen
 * vaste `minWidth` in `panelStyle` overschrijven 'm gewoon (die spreidt ná `panelPos`).
 *
 * Bewust *controlled*: de aanroeper houdt zijn eigen `open`-state (dropdowns gebruiken die soms ook
 * voor de trigger-`active`-klasse of om een lijst te verversen). De variatiepunten per site
 * — uitlijning links/rechts, `zIndex`, `minWidth`/`maxWidth`/`maxHeight`, `padding`, flex-layout —
 * blijven per site via `panelStyle` gezet.
 */
const BASE_PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  width: 'max-content',
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
  /** Klasse op het paneel — voor de tekstrolklassen (`text-body` e.d.) i.p.v. `fontSize` in `panelStyle`. */
  panelClassName?: string;
  /** Extra stijl op de `position: relative`-container (bijv. `minWidth`). */
  containerStyle?: CSSProperties;
  /**
   * Begrens de paneelhoogte op de ruimte tussen de trigger en de onderkant van het venster
   * (`maxHeight`, ook na een venstergrootte-wijziging). Het paneel zelf scrolt niet: de inhoud
   * kiest welk deel scrolt (bv. een lijst tussen een vaste kop en voetregel).
   */
  fitViewport?: boolean;
}

/** Ruimte (px) die tussen een paneel en de rand van het venster vrij blijft. */
const VIEWPORT_MARGIN = 8;

/** Breedste paneel dat met {@link VIEWPORT_MARGIN} aan beide kanten in het venster past. */
const VIEWPORT_MAX_WIDTH = `calc(100vw - ${2 * VIEWPORT_MARGIN}px)`;

/** Linkerkant die het paneel in het venster houdt; is het venster te smal, dan wint de linkerrand. */
function fitLeft(left: number, width: number): number {
  return Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));
}

export function Popover({
  open, onClose, trigger, children, align = 'left', panelStyle, panelClassName, containerStyle, fitViewport = false,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // extraRef: het paneel leeft (via de portal) buiten `ref`'s DOM-subtree — zonder dit telt een
  // klik ín het paneel als "buiten" en sluit useClickOutside het meteen vóór het item-onClick vuurt.
  useClickOutside(ref, onClose, open, { extraRef: panelRef });

  const [panelPos, setPanelPos] = useState<CSSProperties | null>(null);
  const panelMounted = panelPos !== null;
  useLayoutEffect(() => {
    if (!open) { setPanelPos(null); return; }
    const place = () => {
      const trigger = ref.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const marginTop = typeof panelStyle?.marginTop === 'number' ? panelStyle.marginTop : 0;
      const fit: CSSProperties = fitViewport
        ? { maxHeight: Math.max(120, window.innerHeight - rect.bottom - marginTop - VIEWPORT_MARGIN) }
        : {};
      // De eerste ronde is er nog geen paneel; de tweede, vóór het schilderen, meet zijn breedte.
      const width = panelRef.current?.offsetWidth ?? 0;
      const left = fitLeft(align === 'right' ? rect.right - width : rect.left, width);
      setPanelPos({ top: rect.bottom, left, minWidth: rect.width, ...fit });
    };
    place();
    window.addEventListener('resize', place);
    // Andere inhoud (een keuze die extra velden toont) kan het paneel breder maken.
    const observer = panelRef.current ? new ResizeObserver(place) : null;
    if (panelRef.current) observer?.observe(panelRef.current);
    return () => {
      window.removeEventListener('resize', place);
      observer?.disconnect();
    };
    // panelStyle.marginTop is een vaste waarde per site; een nieuw stijlobject per render mag de
    // positie niet steeds opnieuw laten meten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align, fitViewport, panelMounted]);

  const siteMaxWidth = panelStyle?.maxWidth;
  const maxWidth = siteMaxWidth === undefined
    ? VIEWPORT_MAX_WIDTH
    : `min(${typeof siteMaxWidth === 'number' ? `${siteMaxWidth}px` : siteMaxWidth}, ${VIEWPORT_MAX_WIDTH})`;

  return (
    <div ref={ref} style={{ position: 'relative', ...containerStyle }}>
      {trigger}
      {open && panelPos && createPortal(
        <div ref={panelRef} className={panelClassName} style={{ ...BASE_PANEL_STYLE, ...panelPos, ...panelStyle, maxWidth }}>
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
