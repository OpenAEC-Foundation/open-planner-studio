import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import { useClickOutside } from '@/hooks/useClickOutside';
import { TASK_COLUMN_CATEGORY_ORDER } from '@/engine/taskGrid/taskColumnRegistry';
import { recentAvailableTaskColumnIds } from '@/engine/taskGrid/preferences';
import type { TaskColumnCategory, TaskColumnId } from '@/types/taskGrid';
import { nextFrame } from '@/utils/nextFrame';

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
  resetDefault: string;
}

export const COLUMNS_RIBBON_TOGGLE_SELECTOR = '[data-ops-ribbon-item="tableColumns"]';

export interface ColumnChooserTrigger {
  anchorClassName: string;
  className: string;
  content: ReactNode;
  disabled?: boolean;
  data?: Record<`data-${string}`, string | boolean>;
}

export interface ColumnChooserProps {
  options: readonly TaskGridColumnOption[];
  recentIds: readonly TaskColumnId[];
  visibleIds: ReadonlySet<TaskColumnId>;
  labels: ColumnChooserLabels;
  beforeOpen?: () => boolean;
  onChoose: (option: TaskGridColumnOption) => boolean;
  onReset: () => boolean;
  resetDisabled: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  externalToggleSelector?: string;
  trigger?: ColumnChooserTrigger;
}

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
  onReset,
  resetDisabled,
  open: controlledOpen,
  onOpenChange,
  externalToggleSelector,
  trigger: triggerSpec,
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

  useClickOutside(triggerContainerRef, () => close(true), open, {
    escape: true, extraRef: panelRef, ignoreSelector: externalToggleSelector,
  });

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

  const reset = () => {
    if (!onReset()) return;
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
            {item.selected ? <Icon id="status.column-present" size={13} /> : null}
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
          <Icon id="view.search" size={14} aria-hidden="true" />
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
                  <Icon id="tree.collapse" size={14} aria-hidden="true" data-expanded={expanded ? 'true' : 'false'} />
                </button>
                {expanded && itemList(group.items, `category:${group.category}`)}
              </section>
            );
          })}
        </div>
        <div className="task-grid-column-chooser-footer">
          <button
            type="button"
            className="task-grid-column-chooser-reset"
            disabled={resetDisabled}
            onClick={reset}
          >
            <Icon id="table.columns-reset" size={13} aria-hidden="true" />
            <span>{labels.resetDefault}</span>
          </button>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={triggerContainerRef} className={triggerSpec?.anchorClassName ?? 'task-grid-column-chooser-anchor'}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerSpec?.className ?? 'task-grid-add-column'}
        aria-label={triggerSpec ? undefined : labels.addColumn}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={triggerSpec?.disabled}
        onClick={openChooser}
        {...triggerSpec?.data}
      >
        {triggerSpec ? triggerSpec.content : <Icon id="table.column-add-menu" size={15} aria-hidden="true" />}
      </button>
      {panel}
    </div>
  );
}
