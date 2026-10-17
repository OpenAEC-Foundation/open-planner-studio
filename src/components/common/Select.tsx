import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Info } from 'lucide-react';
import './Select.css';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optionele uitleg bij deze optie. In de open lijst krijgt de optie dan een i-icoon met deze
   *  tekst als directe tooltip (`TooltipHost`, `data-tooltip-instant`: hover, klik en tik). Staat er
   *  een regeleinde (`\n`) in, dan is de eerste regel de vette kernzin (`data-tooltip-lead`).
   *  Toetsenbord: de focus blijft op de trigger; bij de gemarkeerde optie wijst de trigger met
   *  `aria-describedby` naar de uitleg, zodat een schermlezer hem voorleest. Zonder `description`
   *  verandert er niets aan de keuzelijst. */
  description?: string;
};

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Label voor een `value` die bij geen optie hoort maar wél echt gezet is (bv. een type uit een
   *  import dat de lijst niet aanbiedt). De trigger toont het als gewone waarde, niet grijs zoals
   *  `placeholder`. De lijst zelf krijgt er geen optie bij en opent zonder actieve optie. */
  valueLabel?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
  /** Begin al UITGEKLAPT (met de volledige lijst zichtbaar) i.p.v. pas
   *  na een tweede interactie te openen — nodig voor gridcel-editors, waar "de cel in gaan" zélf al
   *  de keuzemoment is. Focust bij mount ook meteen de trigger, zodat pijltjes/Enter direct werken.
   *  Niet-grid-aanroepers laten dit weg en starten gesloten. */
  autoOpen?: boolean;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  /** Maak de trigger zo breed als het LANGSTE optielabel (plus opvulling en pijltje), zodat het
   *  gekozen woord in geen enkele taal wordt afgekapt en de breedte niet verspringt bij een andere
   *  keuze. Voor korte suffix-kiezers naast een invoerveld (duur-eenheid). De wrapper moet de
   *  breedte dan niet vastzetten (`shrink-0`, geen `w-*`). */
  fitWidestOption?: boolean;
  /** Kiest de gebruiker de al gekozen optie opnieuw (klik, Enter of Spatie), dan roept `Select`
   *  `onChange` NIET aan, zoals een native `<select>`. Wie die keuze toch moet horen (de gridcel-
   *  editor legt vast en sluit bij elke keuze), geeft deze callback mee. */
  onReselect?: (value: string) => void;
}

interface MenuRect {
  left: number;
  /** Rechterrand van de trigger: in RTL lijnt de lijst daarop uit. */
  right: number;
  rtl: boolean;
  top: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 280;
/** Vanaf zoveel opties tekent de open lijst alleen de zichtbare rijen (plus een buffer). Een lijst
 *  met duizenden opties (bv. "Bovenliggende taak" in een groot P6-project) opende anders pas na
 *  ruim een seconde. Korte lijsten tekenen alle opties, zoals altijd. */
const SELECT_VIRTUAL_THRESHOLD = 200;
const VIRTUAL_BUFFER = 8;

/** Eén canvas voor alle breedtemetingen: meet de labels zonder er DOM-nodes voor te maken. */
let measureContext: CanvasRenderingContext2D | null = null;
function measureLabels(labels: readonly string[], font: string): number {
  if (!measureContext) measureContext = document.createElement('canvas').getContext('2d');
  if (!measureContext) return 0;
  measureContext.font = font;
  let widest = 0;
  for (const label of labels) widest = Math.max(widest, measureContext.measureText(label).width);
  return widest;
}

/** Rijhoogte van een gevirtualiseerde optie: de `min-height: 2rem` uit Select.css, als vaste hoogte. */
function virtualRowHeight(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (Number.isFinite(rem) && rem > 0 ? rem : 16) * 2;
}

const px = (value: string): number => parseFloat(value) || 0;

export function Select({
  value,
  onChange,
  options,
  placeholder,
  valueLabel,
  disabled = false,
  id,
  className,
  'aria-label': ariaLabel,
  autoOpen = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  fitWidestOption = false,
  onReselect,
}: SelectProps) {
  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;

  const [open, setOpen] = useState(autoOpen);
  const [highlight, setHighlight] = useState(-1);
  const [rect, setRect] = useState<MenuRect | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const virtual = options.length >= SELECT_VIRTUAL_THRESHOLD;
  // Breedte van het langste label, per optielijst en lettertype maar één keer gemeten.
  const labelWidthCache = useRef<{ options: SelectOption[]; font: string; width: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typeahead = useRef<{ buffer: string; timer: number | null }>({
    buffer: '',
    timer: null,
  });

  const selectedIndex = options.findIndex(o => o.value === value);
  const descriptionId = (i: number) => `${listboxId}-desc-${i}`;
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : valueLabel;

  const firstEnabled = options.findIndex(o => !o.disabled);
  // De keuzelijst leest deze waarde uitsluitend op de gesloten→open-grens. Tijdens een open sessie
  // mogen nieuwe opties de toetsenbordcursor niet terugzetten; bij een volgende open sessie moet de
  // dan actuele selectie juist wel worden gebruikt.
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const lastEnabled = (() => {
    for (let i = options.length - 1; i >= 0; i--) if (!options[i].disabled) return i;
    return -1;
  })();

  const computeRect = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - MENU_GAP;
    const spaceAbove = r.top - MENU_GAP;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow);
    setRect({
      left: r.left,
      right: r.right,
      rtl: getComputedStyle(el).direction === 'rtl',
      top: openUp ? r.top - MENU_GAP : r.bottom + MENU_GAP,
      width: r.width,
      maxHeight: Math.max(maxHeight, 80),
      openUp,
    });
  }, []);

  // Recompute position whenever open, and keep it in sync on scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    computeRect();
    // Het scrollen van de lijst zelf verplaatst de trigger niet; dat hoeft geen nieuwe meting.
    const onScrollOrResize = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      computeRect();
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, computeRect]);

  // Het menu is minstens zo breed als de trigger, maar groeit tot het langste label (plus een
  // eventueel i-icoon) past; anders knipt een smalle trigger de opties af (in it/pl/de zag je twee
  // keer hetzelfde begin). In LTR lijnt het uit op de linkerrand van de trigger en schuift het naar
  // links als het rechts buiten het venster valt. In RTL lijnt het uit op de rechterrand en groeit
  // het naar links; het blijft altijd binnen het venster.
  //
  // Een gevirtualiseerde lijst tekent niet alle opties, dus `max-content` kent het langste label
  // niet. Daar meet een canvas alle labels in het lettertype van de lijst; de opvulling, het
  // i-icoon, de rand en de scrollbalk komen uit de getekende rijen.
  useLayoutEffect(() => {
    if (!open || !rect || !menuRef.current) return;
    const menu = menuRef.current;
    if (virtual) {
      const label = menu.querySelector<HTMLElement>('.ops-select__option-label');
      const option = label?.closest<HTMLElement>('.ops-select__option');
      if (label && option) {
        const ls = getComputedStyle(label);
        const font = `${ls.fontStyle} ${ls.fontWeight} ${ls.fontSize} ${ls.fontFamily}`;
        const cached = labelWidthCache.current;
        const widest = cached && cached.options === options && cached.font === font
          ? cached.width
          : measureLabels(options.map(o => o.label), font);
        labelWidthCache.current = { options, font, width: widest };
        const os = getComputedStyle(option);
        const info = options.some(o => o.description)
          ? (menu.querySelector<HTMLElement>('.ops-select__option-info')?.offsetWidth ?? 30)
          : 0;
        const ms = getComputedStyle(menu);
        const chrome = menu.offsetWidth - menu.clientWidth + px(ms.paddingLeft) + px(ms.paddingRight);
        const wanted = Math.ceil(widest + px(os.paddingLeft) + px(os.paddingRight) + info + chrome) + 2;
        menu.style.width = `${Math.min(Math.max(rect.width, wanted), window.innerWidth - MENU_GAP * 4)}px`;
      }
    }
    const width = menu.offsetWidth;
    const minLeft = MENU_GAP * 2;
    const maxLeft = window.innerWidth - MENU_GAP * 2 - width;
    const wanted = rect.rtl ? rect.right - width : rect.left;
    menu.style.left = `${Math.max(minLeft, Math.min(wanted, maxLeft))}px`;
  }, [open, rect, virtual, options]);

  // Bij autoOpen begint de trigger nooit gefocust vanuit de gewone
  // klik-/tabvolgorde (de gridcel-editor mount 'm rechtstreeks) — zonder deze focus werken
  // pijltjes/Enter/Escape pas na een extra klik.
  useEffect(() => {
    if (autoOpen) triggerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bij openen is de gekozen optie actief. Hoort `value` bij geen enkele optie (een plaatshouder
  // zoals "Verplaatsen naar…"), dan is er GEEN actieve optie: anders kiest een extra Enter of Spatie
  // meteen de eerste optie. Pijl-omlaag maakt dan de eerste optie actief.
  useEffect(() => {
    if (open) {
      setHighlight(selectedIndexRef.current);
      setScrollTop(0);
    }
  }, [open]);

  // Keep the highlighted option scrolled into view. In een gevirtualiseerde lijst bestaat de rij
  // misschien nog niet: dan rekent de lijst de scrollpositie uit de rijhoogte.
  const menuReady = rect !== null;
  useEffect(() => {
    if (!open || highlight < 0) return;
    const menu = menuRef.current;
    if (virtual && menu) {
      const row = virtualRowHeight();
      const top = px(getComputedStyle(menu).paddingTop) + highlight * row;
      if (top < menu.scrollTop) menu.scrollTop = top;
      else if (top + row > menu.scrollTop + menu.clientHeight) menu.scrollTop = top + row - menu.clientHeight;
      setScrollTop(menu.scrollTop);
      return;
    }
    optionRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight, virtual, menuReady]);

  // Outside-click / focus-out closing.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Dezelfde optie opnieuw kiezen sluit alleen de lijst, net als een native `<select>`: geen
  // `onChange`. Anders wiste bv. dezelfde curve opnieuw kiezen een geïmporteerde P6-curve.
  const selectAt = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      if (opt.value !== value) onChange(opt.value);
      else onReselect?.(opt.value);
      close();
    },
    [options, value, onChange, onReselect, close],
  );

  const moveHighlight = useCallback(
    (dir: 1 | -1) => {
      setHighlight(prev => {
        const n = options.length;
        if (n === 0) return -1;
        // Zonder actieve optie begint omlaag bij de eerste en omhoog bij de laatste optie.
        let i = prev < 0 ? (dir === 1 ? -1 : n) : prev;
        for (let step = 0; step < n; step++) {
          i = (i + dir + n) % n;
          if (!options[i].disabled) return i;
        }
        return prev;
      });
    },
    [options],
  );

  /** PageUp/PageDown: een schermhoogte verder, zonder rond te lopen; landt op een geldige optie. */
  const pageHighlight = useCallback(
    (dir: 1 | -1) => {
      // Eén formule voor korte en lange lijsten: zoveel rijen als er in beeld passen, min één.
      const menu = menuRef.current;
      const row = virtual
        ? virtualRowHeight()
        : (optionRefs.current.find(el => el)?.offsetHeight || virtualRowHeight());
      const rows = menu ? Math.max(1, Math.floor(menu.clientHeight / row) - 1) : 1;
      setHighlight(prev => {
        const n = options.length;
        if (n === 0) return -1;
        const from = prev < 0 ? (dir === 1 ? -1 : n) : prev;
        const target = Math.min(n - 1, Math.max(0, from + dir * rows));
        for (let i = target; i >= 0 && i < n; i -= dir) if (!options[i].disabled) return i;
        for (let i = target; i >= 0 && i < n; i += dir) if (!options[i].disabled) return i;
        return prev;
      });
    },
    [options, virtual],
  );

  const runTypeahead = useCallback(
    (char: string) => {
      const ta = typeahead.current;
      ta.buffer += char.toLowerCase();
      if (ta.timer) window.clearTimeout(ta.timer);
      ta.timer = window.setTimeout(() => {
        ta.buffer = '';
        ta.timer = null;
      }, 600);
      const match = options.findIndex(
        o => !o.disabled && o.label.toLowerCase().startsWith(ta.buffer),
      );
      if (match >= 0) setHighlight(match);
    },
    [options],
  );

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp' ||
        e.key === 'Enter' ||
        e.key === ' '
      ) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveHighlight(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveHighlight(-1);
        break;
      case 'Home':
        e.preventDefault();
        if (firstEnabled >= 0) setHighlight(firstEnabled);
        break;
      case 'End':
        e.preventDefault();
        if (lastEnabled >= 0) setHighlight(lastEnabled);
        break;
      case 'PageDown':
        e.preventDefault();
        pageHighlight(1);
        break;
      case 'PageUp':
        e.preventDefault();
        pageHighlight(-1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        // StopPropagation zodra dit ECHT een keuze maakt — anders zou
        // dezelfde Enter ook nog doorbubbelen naar een omringende "Enter commit"-handler (zoals de
        // gridcel-editor), die de keuze dan een TWEEDE keer zou verwerken. Grid-integratie roept de
        // commit zelf al aan vanuit onChange (zie TaskCellEditor); dit voorkomt dat dubbel gebeurt.
        // Dezelfde waarde opnieuw kiezen roept geen onChange aan. Zonder `onReselect` mag de Enter
        // dan wél door (een omringende Enter-handler ziet een gewone Enter); met `onReselect` handelt
        // die callback de keuze af en stopt de toets hier. Zonder actieve optie kiest Enter of
        // Spatie niets.
        if (highlight >= 0) {
          if (options[highlight]?.value !== value || onReselect) e.stopPropagation();
          selectAt(highlight);
        }
        break;
      case 'Escape':
        // Escape in een open lijst sluit alleen de lijst. Zonder stopPropagation sloot dezelfde
        // toets ook de omringende dialoog (`useDialogKeys` luistert op `document`) en gooide hij het
        // concept weg. Een dichte trigger laat Escape door, net als een native `<select>`.
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          runTypeahead(e.key);
        }
    }
  };

  // `autoOpen` maakt `open` al bij de EERSTE render `true`, dus ook tijdens `renderToStaticMarkup`
  // (dit project heeft géén jsdom) — createPortal(..., document.body) crasht dan op een ontbrekend
  // `document`. `typeof document !== 'undefined'` maakt de portal SSR-veilig: de menu-portal
  // bestaat pas zinvol zodra de component in een echte browser draait.
  // Gevirtualiseerd: alleen de rijen in beeld (plus een buffer), met lege vlakken erboven en
  // eronder zodat de scrollbalk de hele lijst voorstelt.
  const rowHeight = virtual && open && rect && typeof document !== 'undefined' ? virtualRowHeight() : 0;
  const windowStart = rowHeight ? Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_BUFFER) : 0;
  const windowEnd = rowHeight && rect
    ? Math.min(options.length, Math.ceil((scrollTop + rect.maxHeight) / rowHeight) + VIRTUAL_BUFFER)
    : options.length;
  const renderOption = (opt: SelectOption, i: number) => {
    const isSelected = opt.value === value;
    const isHighlighted = i === highlight;
    return (
      <div
        key={opt.value}
        id={`${listboxId}-opt-${i}`}
        ref={el => {
          optionRefs.current[i] = el;
        }}
        role="option"
        data-value={opt.value}
        aria-selected={isSelected}
        aria-disabled={opt.disabled || undefined}
        aria-setsize={virtual ? options.length : undefined}
        aria-posinset={virtual ? i + 1 : undefined}
        style={virtual ? { height: rowHeight, flexShrink: 0, boxSizing: 'border-box' } : undefined}
        className={
          'ops-select__option' +
          (isHighlighted ? ' is-highlighted' : '') +
          (isSelected ? ' is-selected' : '') +
          (opt.disabled ? ' is-disabled' : '')
        }
        onMouseEnter={() => !opt.disabled && setHighlight(i)}
        onMouseDown={e => {
          // Prevent the trigger from losing focus before we handle the click.
          e.preventDefault();
        }}
        onClick={() => selectAt(i)}
      >
        <span className="ops-select__option-label">{opt.label}</span>
        {opt.description && (
          <>
            {/* i-icoon: alleen voor muis en tik (de focus blijft op de trigger); een klik
                toont de uitleg en kiest de optie NIET. Schermlezers krijgen de uitleg via
                `aria-describedby` op de trigger (verborgen spans ná de opties, zodat de tekst van de optie
                zelf alleen het label blijft). */}
            <span
              className="ops-select__option-info"
              title={opt.description}
              data-tooltip-instant="true"
              data-tooltip-lead={opt.description.includes('\n') ? 'true' : undefined}
              data-ops-select-option-info={opt.value}
              aria-hidden="true"
              onClick={e => e.stopPropagation()}
            >
              <Info size={14} aria-hidden="true" />
            </span>
          </>
        )}
      </div>
    );
  };
  const menu =
    open && rect && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-activedescendant={
              highlight >= 0 ? `${listboxId}-opt-${highlight}` : undefined
            }
            className="ops-select__menu"
            onScroll={virtual ? e => setScrollTop(e.currentTarget.scrollTop) : undefined}
            style={{
              left: rect.left,
              minWidth: rect.width,
              // Gevirtualiseerd zet de breedtemeting hierboven de breedte zelf.
              ...(virtual ? {} : { width: 'max-content' }),
              maxWidth: window.innerWidth - MENU_GAP * 4,
              maxHeight: rect.maxHeight,
              ...(rect.openUp
                ? { bottom: window.innerHeight - rect.top }
                : { top: rect.top }),
            }}
          >
            {virtual ? (
              <>
                <div aria-hidden="true" style={{ height: windowStart * rowHeight, flexShrink: 0 }} />
                {options.slice(windowStart, windowEnd).map((opt, k) => renderOption(opt, windowStart + k))}
                <div aria-hidden="true" style={{ height: (options.length - windowEnd) * rowHeight, flexShrink: 0 }} />
                {highlight >= 0 && options[highlight]?.description
                  ? <span id={descriptionId(highlight)} hidden>{options[highlight].description}</span>
                  : null}
              </>
            ) : options.map(renderOption)}
            {!virtual && options.map((opt, i) => opt.description
              ? <span key={`desc-${opt.value}`} id={descriptionId(i)} hidden>{opt.description}</span>
              : null)}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={'ops-select__trigger' + (className ? ` ${className}` : '')}
        disabled={disabled}
        data-value={value}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={
          [ariaDescribedBy, open && highlight >= 0 && options[highlight]?.description ? descriptionId(highlight) : undefined]
            .filter(Boolean).join(' ') || undefined
        }
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onTriggerKeyDown}
        onBlur={e => {
          // Close if focus moves entirely outside trigger + menu.
          const next = e.relatedTarget as Node | null;
          if (next && (menuRef.current?.contains(next) || triggerRef.current?.contains(next))) {
            return;
          }
          setOpen(false);
        }}
      >
        <span
          className={
            'ops-select__value' +
            (selectedLabel === undefined ? ' is-placeholder' : '') +
            (fitWidestOption ? ' ops-select__value--fit' : '')
          }
        >
          {fitWidestOption ? (
            <>
              <span className="ops-select__value-text">{selectedLabel ?? placeholder ?? ''}</span>
              {/* Onzichtbare maatvoerders: het label staat in een `::before` uit `data-label`, dus de
                  tekstinhoud (en `toHaveText`) van de trigger blijft alleen het gekozen woord. */}
              {options.map(opt => (
                <span
                  key={opt.value}
                  className="ops-select__sizer"
                  data-label={opt.label}
                  aria-hidden="true"
                />
              ))}
            </>
          ) : (
            selectedLabel ?? placeholder ?? ''
          )}
        </span>
        <ChevronDown size={16} className="ops-select__chevron" aria-hidden="true" />
      </button>
      {menu}
    </>
  );
}
