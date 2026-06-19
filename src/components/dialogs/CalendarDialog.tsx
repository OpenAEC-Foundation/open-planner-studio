import { useState, useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2 } from 'lucide-react';
import type { WorkCalendar, Holiday } from '@/types/calendar';

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function CalendarDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const calendar = useAppStore(s => s.calendar);
  const setCalendar = useAppStore(s => s.setCalendar);
  const runCPM = useAppStore(s => s.runCPM);
  const setUI = useAppStore(s => s.setUI);

  // Local working copy — only committed on Apply.
  const [draft, setDraft] = useState<WorkCalendar>(() => structuredClone(calendar));

  const close = () => setUI({ showCalendarDialog: false });

  const handleApply = () => {
    setCalendar(draft);
    runCPM(); // schedule depends on the work calendar
    setUI({ showCalendarDialog: false });
  };

  // Esc sluit dialog (LAYOUTS.md §3.3)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUI({ showCalendarDialog: false });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setUI]);

  const toggleWorkDay = (day: number) => {
    setDraft(d => {
      const has = d.workDays.includes(day);
      const workDays = has
        ? d.workDays.filter(x => x !== day)
        : [...d.workDays, day].sort((a, b) => a - b);
      return { ...d, workDays };
    });
  };

  const updateHoliday = (index: number, patch: Partial<Holiday>) => {
    setDraft(d => {
      const holidays = d.holidays.map((h, i) => (i === index ? { ...h, ...patch } : h));
      return { ...d, holidays };
    });
  };

  const addHoliday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDraft(d => ({
      ...d,
      holidays: [...d.holidays, { name: '', startDate: today, endDate: today }],
    }));
  };

  const removeHoliday = (index: number) => {
    setDraft(d => ({ ...d, holidays: d.holidays.filter((_, i) => i !== index) }));
  };

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[600px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>{tMenu('ribbon.calendarTitle')}</span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">
              {tMenu('ribbon.calendarDialog.name')}
            </label>
            <input
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
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
                onChange={e => setDraft(d => ({ ...d, workStartHour: Number(e.target.value) }))}
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
                onChange={e => setDraft(d => ({ ...d, workEndHour: Number(e.target.value) }))}
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
                onChange={e => setDraft(d => ({ ...d, hoursPerDay: Number(e.target.value) }))}
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

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={close} className="btn btn--sm btn--secondary">
            {tCommon('cancel')}
          </button>
          <button onClick={handleApply} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]">
            {tCommon('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
