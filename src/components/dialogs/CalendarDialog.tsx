import { useState, useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarForm } from './CalendarForm';

// Projectkalender-flow — ongewijzigd t.o.v. vóór de CalendarForm-extractie (fase 2.5, §3.4):
// leest/schrijft s.calendar, committeert met runCPM() erna.
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

        <CalendarForm draft={draft} onChange={patch => setDraft(d => ({ ...d, ...patch }))} />

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
