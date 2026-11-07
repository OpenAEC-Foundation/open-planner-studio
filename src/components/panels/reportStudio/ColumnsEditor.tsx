import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import type { TaskGridAdapterColumn } from '@/engine/taskGrid/taskGridAdapter';
import type { TaskColumnCategory } from '@/types/taskGrid';
import { REPORT_MAX_COLUMNS, REPORT_REQUIRED_COLUMN } from '@/utils/reportSettings';
import {
  addReportColumn, moveReportColumn, placeReportColumn, removeReportColumn, reportColumnsFromGrid, REPORT_PICKER_CATEGORY_ORDER,
} from './reportColumns';

/**
 * De kolommen van de afdruk (stap Kolommen): de lijst in papiervolgorde, met slepen of Alt+↑/↓ om te
 * verplaatsen, Delete om weg te halen, en een zoekbare kiezer uit het kolomregister van het
 * taakraster. De taaknaam is verplicht en heeft een slot in plaats van een kruisje.
 */
export function ColumnsEditor({ ids, onChange, available, gridIds, focusId, labelFor, categoryLabel }: {
  ids: readonly string[];
  onChange: (ids: string[], input: string) => void;
  available: readonly TaskGridAdapterColumn[];
  /** De zichtbare kolommen van het taakraster naast de Gantt (voor het merkje "in de tabel"). */
  gridIds: readonly string[];
  /** Een kolom die op het papier is aangeklikt: die rij licht op en krijgt focus. */
  focusId: string | null;
  labelFor: (id: string) => string;
  categoryLabel: (category: TaskColumnCategory) => string;
}) {
  const { t } = useTranslation('report');
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!focusId || !ids.includes(focusId)) return;
    setActiveId(focusId);
    setFlashId(focusId);
    const node = rowRefs.current.get(focusId);
    node?.scrollIntoView({ block: 'nearest' });
    node?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setFlashId(null), 1300);
    return () => window.clearTimeout(timer);
  }, [focusId, ids]);

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setActiveId(id);
    requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>, id: string, index: number) => {
    if (e.target !== e.currentTarget) return;
    const move = e.altKey || e.ctrlKey || e.metaKey;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? -1 : 1;
      if (move) {
        onChange(moveReportColumn(ids, id, delta), 'column-move');
        focusRow(id);
      } else {
        focusRow(ids[index + delta]);
      }
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusRow(e.key === 'Home' ? ids[0] : ids[ids.length - 1]);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && id !== REPORT_REQUIRED_COLUMN) {
      e.preventDefault();
      onChange(removeReportColumn(ids, id), 'column-remove');
      focusRow(ids[index + 1] ?? ids[index - 1]);
    }
  };

  // Slepen met de muis of pen: de greep vangt de aanwijzer; de rij onder de aanwijzer bepaalt de plek.
  const onGripDown = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, over: ids.indexOf(id) });
  };
  const dropIndexAt = (clientY: number): number => {
    let index = 0;
    for (const id of ids) {
      const node = rowRefs.current.get(id);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (clientY > rect.top + rect.height / 2) index++;
    }
    return index;
  };
  const onGripMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    const over = dropIndexAt(e.clientY);
    if (over !== drag.over) setDrag({ ...drag, over });
  };
  const onGripUp = () => {
    if (!drag) return;
    const from = ids.indexOf(drag.id);
    // `over` telt rijen boven de aanwijzer, inclusief de gesleepte zelf; na het weghalen schuift alles één op.
    const to = drag.over > from ? drag.over - 1 : drag.over;
    if (to !== from) onChange(placeReportColumn(ids, drag.id, to), 'column-drag');
    setDrag(null);
  };

  const gridSet = useMemo(() => new Set(gridIds), [gridIds]);
  const full = ids.length >= REPORT_MAX_COLUMNS;
  const dropLineAt = drag ? drag.over : -1;
  const dragFrom = drag ? ids.indexOf(drag.id) : -1;
  const showDropLine = (i: number) => drag !== null && dropLineAt === i && i !== dragFrom && i !== dragFrom + 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="rs-cols" role="listbox" aria-label={t('studio.columns.listLabel')} aria-describedby="rs-cols-hint" data-rs-columns>
        {ids.map((id, i) => {
          const required = id === REPORT_REQUIRED_COLUMN;
          const tabbable = (activeId ?? ids[0]) === id;
          return (
            <div key={id} className="contents">
              {showDropLine(i) && <div className="rs-drop-line" aria-hidden="true" />}
              <div
                ref={el => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id); }}
                className="rs-col"
                role="option"
                aria-selected={activeId === id}
                tabIndex={tabbable ? 0 : -1}
                data-rs-column={id}
                data-dragging={drag?.id === id ? 'true' : undefined}
                data-flash={flashId === id ? 'true' : undefined}
                onFocus={() => setActiveId(id)}
                onKeyDown={e => onRowKeyDown(e, id, i)}
              >
                <span
                  className="rs-grip"
                  onPointerDown={e => onGripDown(e, id)}
                  onPointerMove={onGripMove}
                  onPointerUp={onGripUp}
                  onPointerCancel={() => setDrag(null)}
                  title={t('studio.columns.drag')}
                  aria-hidden="true"
                  data-rs-grip={id}
                >
                  <span className="rs-grip-dots" />
                </span>
                <span className="rs-col-name">
                  {labelFor(id)}
                  {required && <small>{t('studio.columns.required')}</small>}
                </span>
                <span className="rs-col-actions">
                  <button type="button" className="rs-icon-btn" tabIndex={-1} data-reveal
                    disabled={i === 0} onClick={() => { onChange(moveReportColumn(ids, id, -1), 'column-move'); focusRow(id); }}
                    title={t('studio.columns.moveUp')} aria-label={t('studio.columns.moveUp')}>
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button type="button" className="rs-icon-btn" tabIndex={-1} data-reveal
                    disabled={i === ids.length - 1} onClick={() => { onChange(moveReportColumn(ids, id, 1), 'column-move'); focusRow(id); }}
                    title={t('studio.columns.moveDown')} aria-label={t('studio.columns.moveDown')}>
                    <span aria-hidden="true">↓</span>
                  </button>
                  {required ? (
                    <span className="rs-icon-btn" title={t('studio.columns.requiredHint')} aria-hidden="true" data-rs-required-slot />
                  ) : (
                    <button type="button" className="rs-icon-btn" tabIndex={-1}
                      onClick={() => onChange(removeReportColumn(ids, id), 'column-remove')}
                      title={t('studio.columns.remove')} aria-label={t('studio.columns.remove')} data-rs-remove={id}>
                      <Icon id="list.item-remove" size={14} />
                    </button>
                  )}
                </span>
              </div>
            </div>
          );
        })}
        {showDropLine(ids.length) && <div className="rs-drop-line" aria-hidden="true" />}
      </div>
      <p className="rs-hint" id="rs-cols-hint">{t('studio.columns.keysHint')}</p>

      {pickerOpen ? (
        <ColumnPicker
          ids={ids}
          available={available}
          gridSet={gridSet}
          categoryLabel={categoryLabel}
          onPick={id => { onChange(addReportColumn(ids, id), 'column-add'); setFlashId(id); }}
          onClose={() => setPickerOpen(false)}
        />
      ) : (
        <button type="button" className="rs-add" onClick={() => setPickerOpen(true)} disabled={full} data-rs-add-column>
          <Icon id="table.column-add-menu" size={14} />
          {full ? t('studio.columns.full', { count: REPORT_MAX_COLUMNS }) : t('studio.columns.add')}
        </button>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rs-btn"
          onClick={() => onChange(reportColumnsFromGrid(gridIds, new Set(available.map(column => String(column.id)))), 'columns-like-grid')}
          title={t('studio.columns.likeGridHint')}
          data-rs-like-grid
        >
          <Icon id="table.columns" size={14} />
          {t('studio.columns.likeGrid')}
        </button>
      </div>
    </div>
  );
}

/** Zoekbare kolomkiezer: typen filtert, ↑/↓ kiest, Enter voegt toe, Esc sluit. */
function ColumnPicker({ ids, available, gridSet, categoryLabel, onPick, onClose }: {
  ids: readonly string[];
  available: readonly TaskGridAdapterColumn[];
  gridSet: ReadonlySet<string>;
  categoryLabel: (category: TaskColumnCategory) => string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('report');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const options = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const taken = new Set(ids);
    const order = new Map(REPORT_PICKER_CATEGORY_ORDER.map((c, i) => [c, i]));
    return available
      .filter(column => !taken.has(String(column.id)))
      .filter(column => !q || column.label.toLocaleLowerCase().includes(q))
      .sort((a, b) => {
        // Eerst wat in de tabel staat, dan per categorie, dan op naam.
        const ga = gridSet.has(String(a.id)) ? 0 : 1;
        const gb = gridSet.has(String(b.id)) ? 0 : 1;
        if (ga !== gb) return ga - gb;
        const ca = order.get(a.category) ?? 99;
        const cb = order.get(b.category) ?? 99;
        return ca - cb || a.label.localeCompare(b.label);
      });
  }, [available, ids, query, gridSet]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const option = options[active];
      if (option) onPick(String(option.id));
    } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };

  let lastGroup = '';
  return (
    <div className="rs-picker" data-rs-picker>
      <div className="rs-picker-search">
        <Icon id="view.search" size={14} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('studio.columns.search')}
          aria-label={t('studio.columns.search')}
          role="combobox"
          aria-expanded="true"
          aria-controls="rs-picker-list"
          aria-activedescendant={options[active] ? `rs-pick-${active}` : undefined}
          data-rs-picker-search
        />
        <button type="button" className="rs-icon-btn" onClick={onClose} title={t('studio.close')} aria-label={t('studio.close')}>
          <Icon id="ui.close" size={14} />
        </button>
      </div>
      <div className="rs-picker-list" id="rs-picker-list" role="listbox" ref={listRef}>
        {options.length === 0 && <div className="rs-picker-empty">{t('studio.columns.noMatch')}</div>}
        {options.map((option, index) => {
          const inGrid = gridSet.has(String(option.id));
          const group = inGrid ? '__grid' : option.category;
          const header = group !== lastGroup
            ? <div className="rs-picker-cat" key={`g-${group}`}>{inGrid ? t('studio.columns.inGrid') : categoryLabel(option.category)}</div>
            : null;
          lastGroup = group;
          return [
            header,
            <button
              key={String(option.id)}
              type="button"
              role="option"
              id={`rs-pick-${index}`}
              aria-selected={index === active}
              className="rs-picker-item"
              data-active={index === active ? 'true' : undefined}
              data-index={index}
              data-rs-pick={String(option.id)}
              tabIndex={-1}
              onMouseEnter={() => setActive(index)}
              onClick={() => onPick(String(option.id))}
            >
              <span>{option.label}</span>
            </button>,
          ];
        })}
      </div>
    </div>
  );
}
