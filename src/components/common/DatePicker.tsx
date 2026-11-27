import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon, type IconId } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { localTodayIso } from '@/utils/dateUtils';
import { registerDatePickerPanel } from '@/utils/datePickerFocus';
import {
  addMonthsClamped, datePickerKeyTarget, datePickerLabels, monthGrid, monthOf,
} from '@/utils/datePickerMonth';
import './DatePicker.css';

export const DATE_PICKER_ICONS = {
  open: 'input.date-picker',
  previous: 'input.month-previous',
  next: 'input.month-next',
} as const satisfies Record<string, IconId>;

const WEEKDAY_KEYS = {
  1: 'ribbon.calendarDialog.days.1',
  2: 'ribbon.calendarDialog.days.2',
  3: 'ribbon.calendarDialog.days.3',
  4: 'ribbon.calendarDialog.days.4',
  5: 'ribbon.calendarDialog.days.5',
  6: 'ribbon.calendarDialog.days.6',
  7: 'ribbon.calendarDialog.days.7',
} as const;

const GAP = 4;
const MARGIN = 8;

interface PanelPos { top: number; left: number; openUp: boolean }

export interface DatePickerPanelProps {
  anchorRef: RefObject<HTMLElement | null>;
  value: string;
  onPick: (iso: string) => void;
  onClose: (restoreFocus: boolean) => void;
  ignoreRef?: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  ariaLabel?: string;
}

export function DatePickerPanel({ anchorRef, value, onPick, onClose, ignoreRef, panelRef, ariaLabel }: DatePickerPanelProps) {
  const { t, i18n } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  const locale = i18n.language;
  const labels = useMemo(() => datePickerLabels(locale), [locale]);
  const today = localTodayIso();

  const [active, setActive] = useState(() => value || today);
  const { year, month } = monthOf(active);
  const weeks = useMemo(() => monthGrid(year, month, weekStartDay), [year, month, weekStartDay]);
  const weekdays = weeks[0].days.map(d => d.isoWeekday as keyof typeof WEEKDAY_KEYS);

  const [pos, setPos] = useState<PanelPos | null>(null);
  const placed = pos !== null;
  const [rtl, setRtl] = useState(false);
  const gridRef = useRef<HTMLTableElement>(null);
  const focusActive = useRef(true);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    return panel ? registerDatePickerPanel(panel, () => closeRef.current(true)) : undefined;
  }, [panelRef]);

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const dirRtl = getComputedStyle(anchor).direction === 'rtl';
      const w = panel?.offsetWidth ?? 0;
      const h = panel?.offsetHeight ?? 0;
      const below = window.innerHeight - r.bottom - GAP - MARGIN;
      const above = r.top - GAP - MARGIN;
      const openUp = h > below && above > below;
      const wanted = dirRtl ? r.right - w : r.left;
      const left = Math.max(MARGIN, Math.min(wanted, window.innerWidth - w - MARGIN));
      const top = openUp ? Math.max(MARGIN, r.top - GAP - h) : r.bottom + GAP;
      setRtl(dirRtl);
      setPos(prev => (prev && prev.top === top && prev.left === left && prev.openUp === openUp ? prev : { top, left, openUp }));
    };
    place();
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      place();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    const observer = panelRef.current ? new ResizeObserver(place) : null;
    if (panelRef.current) observer?.observe(panelRef.current);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      observer?.disconnect();
    };
  }, [anchorRef, panelRef, placed]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (panelRef.current?.contains(target) || ignoreRef?.current?.contains(target)) return;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && panelRef.current?.contains(focused)) focused.blur();
      closeRef.current(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [panelRef, ignoreRef]);

  useEffect(() => {
    if (!pos || !focusActive.current) return;
    focusActive.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-iso="${active}"]`)?.focus();
  }, [pos, active]);

  const moveTo = (iso: string) => { focusActive.current = true; setActive(iso); };
  const page = (delta: number) => setActive(prev => addMonthsClamped(prev, delta));

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onPick(active);
      return;
    }
    const next = datePickerKeyTarget(active, e.key, { shift: e.shiftKey, rtl, weekStartDay });
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    moveTo(next);
  };

  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'))
        .filter(el => el.tabIndex >= 0);
      if (focusables.length === 0) return;
      const i = focusables.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? focusables[(i <= 0 ? focusables.length : i) - 1]
        : focusables[(i + 1) % focusables.length];
      e.preventDefault();
      e.stopPropagation();
      next.focus();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !/^F\d{1,2}$/.test(e.key)) e.stopPropagation();
  };

  const title = labels.monthTitle(year, month);

  return createPortal(
    <div
      ref={panelRef}
      className="ops-date-picker"
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel ? `${t('dateInput.calendar')} — ${ariaLabel}` : t('dateInput.calendar')}
      dir={rtl ? 'rtl' : undefined}
      data-ops-date-picker
      data-open-up={pos?.openUp || undefined}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
      onKeyDown={onPanelKeyDown}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => {
        e.stopPropagation();
        if (!(e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
    >
      <div className="ops-date-picker__head">
        <button
          type="button"
          className="ops-date-picker__nav"
          aria-label={t('dateInput.previousMonth')}
          title={t('dateInput.previousMonth')}
          onClick={() => page(-1)}
          data-ops-date-picker-nav="previous"
        >
          <Icon id={DATE_PICKER_ICONS.previous} size={14} className="ops-date-picker__nav-icon is-previous" />
        </button>
        <div className="ops-date-picker__title" aria-live="polite" data-ops-date-picker-title>{title}</div>
        <button
          type="button"
          className="ops-date-picker__nav"
          aria-label={t('dateInput.nextMonth')}
          title={t('dateInput.nextMonth')}
          onClick={() => page(1)}
          data-ops-date-picker-nav="next"
        >
          <Icon id={DATE_PICKER_ICONS.next} size={14} className="ops-date-picker__nav-icon is-next" />
        </button>
      </div>
      <table ref={gridRef} className="ops-date-picker__grid" role="grid" aria-label={title} onKeyDown={onGridKeyDown}>
        <thead>
          <tr>
            <th scope="col" className="ops-date-picker__week" aria-hidden="true">{t('dateInput.weekShort')}</th>
            {weekdays.map(d => (
              <th key={d} scope="col" className="ops-date-picker__weekday" data-ops-date-picker-weekday={d}>
                {tMenu(WEEKDAY_KEYS[d])}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map(week => (
            <tr key={week.days[0].iso}>
              <th scope="row" className="ops-date-picker__week" aria-label={t('dateInput.weekNumber', { number: week.weekNumber })}>
                {week.weekNumber}
              </th>
              {week.days.map(d => {
                const selected = d.iso === value;
                const isToday = d.iso === today;
                const classes = [
                  'ops-date-picker__day',
                  d.inMonth ? '' : 'is-outside',
                  selected ? 'is-selected' : '',
                  isToday ? 'is-today' : '',
                  d.isoWeekday >= 6 ? 'is-weekend' : '',
                ].filter(Boolean).join(' ');
                return (
                  <td key={d.iso} role="gridcell" aria-selected={selected}>
                    <button
                      type="button"
                      className={classes}
                      tabIndex={d.iso === active ? 0 : -1}
                      aria-label={labels.dayLabel(d.iso)}
                      aria-current={isToday ? 'date' : undefined}
                      data-iso={d.iso}
                      onClick={() => onPick(d.iso)}
                    >
                      {d.day}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ops-date-picker__foot">
        <button type="button" className="ops-date-picker__today" onClick={() => onPick(today)} data-ops-date-picker-today>
          {t('dateInput.today')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
