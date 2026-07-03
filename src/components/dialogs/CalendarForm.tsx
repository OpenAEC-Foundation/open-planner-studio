import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { WorkCalendar, Holiday } from '@/types/calendar';

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Presentational kalenderformulier (naam, werkdagen, uren, feestdagen) — kent geen store.
 * Hergebruikt door `CalendarDialog` (projectkalender) én `ResourceCalendarDialog`
 * (fase 2.5, §3.4); de aanroeper beslist wat er met `onChange`-patches gebeurt en wanneer
 * er gecommit wordt (Apply-knop leeft in de aanroeper, niet hier).
 */
export function CalendarForm({
  draft,
  onChange,
}: {
  draft: WorkCalendar;
  onChange: (patch: Partial<WorkCalendar>) => void;
}) {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');

  const toggleWorkDay = (day: number) => {
    const has = draft.workDays.includes(day);
    const workDays = has
      ? draft.workDays.filter(x => x !== day)
      : [...draft.workDays, day].sort((a, b) => a - b);
    onChange({ workDays });
  };

  const updateHoliday = (index: number, patch: Partial<Holiday>) => {
    const holidays = draft.holidays.map((h, i) => (i === index ? { ...h, ...patch } : h));
    onChange({ holidays });
  };

  const addHoliday = () => {
    const today = new Date().toISOString().slice(0, 10);
    onChange({ holidays: [...draft.holidays, { name: '', startDate: today, endDate: today }] });
  };

  const removeHoliday = (index: number) => {
    onChange({ holidays: draft.holidays.filter((_, i) => i !== index) });
  };

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-text-secondary font-medium">
          {tMenu('ribbon.calendarDialog.name')}
        </label>
        <input
          value={draft.name}
          onChange={e => onChange({ name: e.target.value })}
          className={inputCls}
          autoFocus
        />
      </div>

      {/* Work days */}
      <div className="flex flex-col gap-1">
        <label className="text-text-secondary font-medium">
          {tMenu('ribbon.calendarDialog.workDays')}
        </label>
        <div className="flex gap-1.5">
          {WEEK_DAYS.map(day => {
            const active = draft.workDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleWorkDay(day)}
                className={
                  'px-2.5 py-1.5 rounded-[8px] border-[1.5px] transition-colors ' +
                  (active
                    ? 'bg-accent text-white border-accent shadow-[var(--shadow-glow)]'
                    : 'bg-surface border-[var(--theme-control-border)] text-text-secondary hover:bg-surface-hover')
                }
              >
                {tMenu(`ribbon.calendarDialog.days.${day}` as 'ribbon.calendarDialog.days.1')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Work hours */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">
            {tMenu('ribbon.calendarDialog.startHour')}
          </label>
          <input
            type="number"
            min={0}
            max={23}
            value={draft.workStartHour}
            onChange={e => onChange({ workStartHour: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">
            {tMenu('ribbon.calendarDialog.endHour')}
          </label>
          <input
            type="number"
            min={0}
            max={24}
            value={draft.workEndHour}
            onChange={e => onChange({ workEndHour: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">
            {tMenu('ribbon.calendarDialog.hoursPerDay')}
          </label>
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={draft.hoursPerDay}
            onChange={e => onChange({ hoursPerDay: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
      </div>

      {/* Holidays */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-text-secondary font-medium">
            {tMenu('ribbon.calendarDialog.holidaysSection')}
          </label>
          <button onClick={addHoliday} className="btn btn--sm btn--secondary flex items-center gap-1">
            <Plus size={12} />
            {tMenu('ribbon.calendarDialog.addHoliday')}
          </button>
        </div>

        {draft.holidays.length === 0 ? (
          <span className="text-text-secondary italic">
            {tMenu('ribbon.calendarDialog.noHolidays')}
          </span>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-text-secondary font-medium px-1">
              <span>{tMenu('ribbon.calendarDialog.holidayName')}</span>
              <span>{tMenu('ribbon.calendarDialog.from')}</span>
              <span>{tMenu('ribbon.calendarDialog.until')}</span>
              <span />
            </div>
            {draft.holidays.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <input
                  value={h.name}
                  onChange={e => updateHoliday(i, { name: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="date"
                  value={h.startDate}
                  onChange={e => updateHoliday(i, { startDate: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="date"
                  value={h.endDate}
                  onChange={e => updateHoliday(i, { endDate: e.target.value })}
                  className={inputCls}
                />
                <button
                  onClick={() => removeHoliday(i)}
                  className="p-1.5 hover:bg-surface-hover rounded-[8px] text-text-secondary"
                  title={tCommon('delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
