import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { TASK_COLUMN_CATEGORY_ORDER } from '@/engine/taskGrid/taskColumnRegistry';
import { recentAvailableTaskColumnIds } from '@/engine/taskGrid/preferences';
import type { TaskColumnCategory, TaskColumnId } from '@/types/taskGrid';

export interface TaskGridColumnOption {
  id: TaskColumnId;
  label: string;
  category: TaskColumnCategory;
  defaultWidth: number;
  align?: 'start' | 'center' | 'end';
}

export interface ColumnChooserItem extends TaskGridColumnOption {
  selected: boolean;
  disabled: boolean;
}

export interface ColumnChooserCategory {
  category: TaskColumnCategory;
  items: ColumnChooserItem[];
}

export interface ColumnChooserModel {
  recent: ColumnChooserItem[];
  search: ColumnChooserItem[];
  categories: ColumnChooserCategory[];
}

function chooserItem(
  option: TaskGridColumnOption,
  visibleIds: ReadonlySet<TaskColumnId>,
): ColumnChooserItem {
  const selected = visibleIds.has(option.id);
  return { ...option, selected, disabled: selected };
}

export function buildColumnChooserModel(
  options: readonly TaskGridColumnOption[],
  recentIds: readonly TaskColumnId[],
  visibleIds: ReadonlySet<TaskColumnId>,
  query: string,
): ColumnChooserModel {
  const byId = new Map(options.map(option => [option.id, option] as const));
  const availableIds = new Set(options.map(option => option.id));
  const recent = recentAvailableTaskColumnIds(recentIds, availableIds)
    .flatMap(id => {
      const option = byId.get(id);
      return option ? [chooserItem(option, visibleIds)] : [];
    });
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const search = normalizedQuery === '' ? [] : options
    .filter(option => option.label.toLocaleLowerCase().includes(normalizedQuery))
    .map(option => chooserItem(option, visibleIds));
  const categories = TASK_COLUMN_CATEGORY_ORDER.map(category => ({
    category,
    items: options
      .filter(option => option.category === category)
      .map(option => chooserItem(option, visibleIds)),
  }));
  return { recent, search, categories };
}

export interface ColumnChooserLabels {
  addColumn: string;
  title: string;
  recent: string;
  search: string;
  searchResults: string;
  noSearchResults: string;
  category: (category: TaskColumnCategory) => string;
}

export interface ColumnChooserProps {
  options: readonly TaskGridColumnOption[];
  recentIds: readonly TaskColumnId[];
  visibleIds: ReadonlySet<TaskColumnId>;
  labels: ColumnChooserLabels;
  beforeOpen?: () => boolean;
  onChoose: (option: TaskGridColumnOption) => boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

/**
 * Screenshotbevinding: het paneel is uitsluitend rechts-verankerd aan de trigger (CSS `right`)
 * zonder linkerklem. Staat de trigger dicht genoeg bij de linkerkant van het venster — het plusje
 * in een smal Gantt-taakgridpaneel, vlak bij de splitter — dan steekt het (vaste
 * `min(310px, 100vw-16px)`-brede) paneel links voorbij x=0 en wordt het daar door de viewport
 * afgesneden: labels als "…ezen"/"…GEBRUIKT" missen hun begin.
 *
 * Deze pure functie bepaalt of dat gebeurt: `naturalLeft` is waar het paneel zou landen bij pure
 * rechtsverankering (triggerRect.right - panelWidth). Past het (>= viewportMargin), dan geeft dit
 * `null` terug — de aanroeper laat de bestaande `right`-verankering dan met rust. Past het niet,
 * dan schuift dit de linkerrand naar rechts tot 'm binnen het venster valt (nooit voorbij de
 * rechterrand, voor het geval `naturalLeft` zelf al negatief genoeg is om ook rechts te missen).
 */
export function clampColumnChooserLeft(
  triggerRight: number,
  panelWidth: number,
  innerWidth: number,
  viewportMargin = 8,
): number | null {
  const naturalLeft = triggerRight - panelWidth;
  if (naturalLeft >= viewportMargin) return null;
  return Math.max(viewportMargin, Math.min(naturalLeft, innerWidth - panelWidth - viewportMargin));
}

export function ColumnChooser({
  options,
  recentIds,
  visibleIds,
  labels,
  beforeOpen,
  onChoose,
  open: controlledOpen,
  onOpenChange,
}: ColumnChooserProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<TaskColumnCategory>>(() => new Set());
  const [panelPosition, setPanelPosition] = useState<CSSProperties | null>(null);
  const triggerContainerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const model = useMemo(
    () => buildColumnChooserModel(options, recentIds, visibleIds, query),
    [options, recentIds, visibleIds, query],
  );

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) nextFrame(() => triggerRef.current?.focus());
  };

  useClickOutside(triggerContainerRef, () => close(true), open, { escape: true, extraRef: panelRef });

  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewportMargin = 8;
    const availableBelow = window.innerHeight - rect.bottom - gap - viewportMargin;
    const availableAbove = rect.top - gap - viewportMargin;
    const openAbove = availableBelow < 180 && availableAbove > availableBelow;
    const verticalPosition = openAbove
      ? { bottom: Math.max(viewportMargin, window.innerHeight - rect.top + gap) }
      : { top: rect.bottom + gap };
    setPanelPosition({
      position: 'fixed',
      ...verticalPosition,
      right: Math.max(viewportMargin, window.innerWidth - rect.right),
      maxHeight: Math.max(80, openAbove ? availableAbove : availableBelow),
    });
  }, [open]);

  // De eerste pass hierboven kan de werkelijke paneelbreedte nog niet meten (het paneel bestaat nog
  // niet); deze tweede pass loopt ná mount, meet 'm via `panelRef` en schuift het paneel naar rechts
  // (van `right`- naar expliciete `left`-verankering) zodra `clampColumnChooserLeft` een klem nodig
  // acht — naar hetzelfde meet-ná-mount-patroon als het kolomkop-contextmenu (DataGridHeader.tsx).
  // De guard (bail als de herberekende `left` al gelijk is aan de huidige) voorkomt een oneindige
  // effect-lus: zonder klem nodig raakt `panelPosition` nooit aan, dus blijft dit effect stil.
  useLayoutEffect(() => {
    if (!open || !panelPosition) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = panel.getBoundingClientRect().width;
    const clampedLeft = clampColumnChooserLeft(triggerRect.right, panelWidth, window.innerWidth);
    if (clampedLeft === null) return;
    setPanelPosition(current => {
      if (!current || (current.left === clampedLeft && current.right === undefined)) return current;
      return { ...current, right: undefined, left: clampedLeft };
    });
  }, [open, panelPosition]);

  useEffect(() => {
    if (open && panelPosition) nextFrame(() => searchRef.current?.focus());
  }, [open, panelPosition]);

  const openChooser = () => {
    if (open) {
      close(true);
      return;
    }
    if (beforeOpen && !beforeOpen()) return;
    setOpen(true);
  };

  const choose = (item: ColumnChooserItem) => {
    if (item.disabled || !onChoose(item)) return;
    close(true);
  };

  const toggleCategory = (category: TaskColumnCategory) => {
    setOpenCategories(current => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const itemList = (items: readonly ColumnChooserItem[], prefix: string) => (
    <div role="menu" className="task-grid-column-chooser-list">
      {items.map(item => (
        <button
          key={`${prefix}:${item.id}`}
          type="button"
          role="menuitemcheckbox"
          aria-checked={item.selected}
          disabled={item.disabled}
          className="task-grid-column-chooser-item"
          onClick={() => choose(item)}
        >
          <span className="task-grid-column-chooser-check" aria-hidden="true">
            {item.selected ? <Check size={13} /> : null}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  const panel = open && panelPosition && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label={labels.title}
        className="task-grid-column-chooser"
        style={panelPosition}
        onKeyDown={event => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }}
      >
        <div className="task-grid-column-chooser-title">{labels.title}</div>
        {model.recent.length > 0 && (
          <section aria-label={labels.recent}>
            <div className="task-grid-column-chooser-section-label">{labels.recent}</div>
            {itemList(model.recent, 'recent')}
          </section>
        )}
        <label className="task-grid-column-chooser-search">
          <Search size={14} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={labels.search}
            aria-label={labels.search}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        {query.trim() !== '' && (
          <section aria-label={labels.searchResults}>
            <div className="task-grid-column-chooser-section-label">{labels.searchResults}</div>
            {model.search.length > 0
              ? itemList(model.search, 'search')
              : <div className="task-grid-column-chooser-empty">{labels.noSearchResults}</div>}
          </section>
        )}
        <div className="task-grid-column-chooser-categories">
          {model.categories.map(group => {
            const expanded = openCategories.has(group.category);
            const categoryLabel = labels.category(group.category);
            return (
              <section key={group.category}>
                <button
                  type="button"
                  className="task-grid-column-chooser-category"
                  aria-expanded={expanded}
                  onClick={() => toggleCategory(group.category)}
                >
                  <span>{categoryLabel}</span>
                  <span className="task-grid-column-chooser-category-count">{group.items.length}</span>
                  <ChevronDown size={14} aria-hidden="true" data-expanded={expanded ? 'true' : 'false'} />
                </button>
                {expanded && itemList(group.items, `category:${group.category}`)}
              </section>
            );
          })}
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={triggerContainerRef} className="task-grid-column-chooser-anchor">
      <button
        ref={triggerRef}
        type="button"
        className="task-grid-add-column"
        aria-label={labels.addColumn}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openChooser}
      >
        <Plus size={15} aria-hidden="true" />
      </button>
      {panel}
    </div>
  );
}
