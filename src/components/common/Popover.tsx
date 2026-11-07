import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
  /** Sluiten bij buiten klikken, Escape of scrollen van de triggeromgeving. */
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
  /** Rol van het paneel, bijv. `'dialog'` voor een paneel met velden achter een knop met `aria-haspopup="dialog"`. */
  panelRole?: 'dialog';
  /** Toegankelijke naam van het paneel (hoort bij `panelRole`). */
  panelAriaLabel?: string;
}

/**
 * Event op `window` waarmee een herindeling buiten het venster-`resize` om open panelen opnieuw laat
 * plaatsen. Het lint verschuift zijn knoppen in een ResizeObserver, dus ná het `resize`-event: zonder
 * dit event bleef een open paneel staan waar zijn knop vóór die herindeling stond.
 */
export const POPOVER_REPOSITION_EVENT = 'ops:popover-reposition';

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
  panelRole, panelAriaLabel,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorRectRef = useRef<DOMRect | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Sluiten door een klik ernaast of door scrollen gebeurt vóór de browser de focus verplaatst. Haal
  // daarom eerst de focus uit het paneel: dan rondt een veld zijn invoer af (blur), net als in het
  // lint zelf, en gaat een half gewijzigde datum niet verloren. Escape sluit zonder dit: annuleren.
  const closeKeepingInput = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && panelRef.current?.contains(active)) active.blur();
    closeRef.current();
  };
  const closeKeepingInputRef = useRef(closeKeepingInput);
  closeKeepingInputRef.current = closeKeepingInput;
  // extraRef: het paneel leeft (via de portal) buiten `ref`'s DOM-subtree — zonder dit telt een
  // klik ín het paneel als "buiten" en sluit useClickOutside het meteen vóór het item-onClick vuurt.
  useClickOutside(ref, closeKeepingInput, open, { extraRef: panelRef });

  useEffect(() => {
    if (!open) return;
    const container = ref.current;
    // Een gesplitste knop kan meer dan één focusbaar deel hebben: onthoud het bediende deel.
    const focused = document.activeElement;
    const trigger = focused instanceof HTMLElement && container?.contains(focused) ? focused : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
      trigger?.focus();
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      // De lijst in het paneel en andere scrollvlakken mogen bewegen; alleen een bewegende
      // voorouder maakt de vaste portalpositie los van de trigger.
      if (target === document || (target instanceof Node && container && target.contains(container))) {
        const anchor = anchorRectRef.current;
        const current = container?.getBoundingClientRect();
        // De browser kan de knop vóór de openende klik in beeld schuiven en het scrollevent pas
        // erna bezorgen. Sluit alleen als de knop sinds het plaatsen van dit paneel is verplaatst.
        if (anchor && current && (current.left !== anchor.left || current.right !== anchor.right || current.bottom !== anchor.bottom)) {
          closeKeepingInputRef.current();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const [panelPos, setPanelPos] = useState<CSSProperties | null>(null);
  const panelMounted = panelPos !== null;
  useLayoutEffect(() => {
    if (!open) { anchorRectRef.current = null; setPanelPos(null); return; }
    const place = () => {
      const trigger = ref.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      anchorRectRef.current = rect;
      const marginTop = typeof panelStyle?.marginTop === 'number' ? panelStyle.marginTop : 0;
      const fit: CSSProperties = fitViewport
        ? { maxHeight: Math.max(0, window.innerHeight - rect.bottom - marginTop - VIEWPORT_MARGIN) }
        : {};
      // De eerste ronde is er nog geen paneel; de tweede, vóór het schilderen, meet zijn breedte.
      const width = panelRef.current?.offsetWidth ?? 0;
      const left = fitLeft(align === 'right' ? rect.right - width : rect.left, width);
      setPanelPos({ top: rect.bottom, left, minWidth: rect.width, ...fit });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener(POPOVER_REPOSITION_EVENT, place);
    // Andere inhoud (een keuze die extra velden toont) kan het paneel breder maken.
    const observer = panelRef.current ? new ResizeObserver(place) : null;
    if (panelRef.current) observer?.observe(panelRef.current);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener(POPOVER_REPOSITION_EVENT, place);
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
        <div ref={panelRef} role={panelRole} aria-label={panelAriaLabel} className={panelClassName} style={{ ...BASE_PANEL_STYLE, ...panelPos, ...panelStyle, maxWidth }}>
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
