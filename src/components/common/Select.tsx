import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import './Select.css';

export type SelectOption = { value: string; label: string; disabled?: boolean };

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

interface MenuRect {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 280;

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  id,
  className,
  'aria-label': ariaLabel,
}: SelectProps) {
  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [rect, setRect] = useState<MenuRect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typeahead = useRef<{ buffer: string; timer: number | null }>({
    buffer: '',
    timer: null,
  });

  const selectedIndex = options.findIndex(o => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : undefined;

  const firstEnabled = options.findIndex(o => !o.disabled);
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
    const onScrollOrResize = () => computeRect();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, computeRect]);

  // On open, initialise highlight to the selected (or first enabled) option.
  useEffect(() => {
    if (open) {
      setHighlight(selectedIndex >= 0 ? selectedIndex : firstEnabled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open || highlight < 0) return;
    optionRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

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

  const selectAt = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
      close();
    },
    [options, onChange, close],
  );

  const moveHighlight = useCallback(
    (dir: 1 | -1) => {
      setHighlight(prev => {
        const n = options.length;
        if (n === 0) return -1;
        let i = prev;
        for (let step = 0; step < n; step++) {
          i = (i + dir + n) % n;
          if (!options[i].disabled) return i;
        }
        return prev;
      });
    },
    [options],
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
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlight >= 0) selectAt(highlight);
        break;
      case 'Escape':
        e.preventDefault();
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

  const menu =
    open && rect
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-activedescendant={
              highlight >= 0 ? `${listboxId}-opt-${highlight}` : undefined
            }
            className="ops-select__menu"
            style={{
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxHeight,
              ...(rect.openUp
                ? { bottom: window.innerHeight - rect.top }
                : { top: rect.top }),
            }}
          >
            {options.map((opt, i) => {
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
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
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
                </div>
              );
            })}
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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
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
            'ops-select__value' + (selectedLabel === undefined ? ' is-placeholder' : '')
          }
        >
          {selectedLabel ?? placeholder ?? ''}
        </span>
        <ChevronDown size={16} className="ops-select__chevron" aria-hidden="true" />
      </button>
      {menu}
    </>
  );
}
