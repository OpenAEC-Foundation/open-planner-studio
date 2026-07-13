import { useState, useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { computeGenerateSpan } from '@/engine/calendar/generateCalendarHolidays';
import { CalendarForm } from './CalendarForm';

/**
 * Resource-kalender-editor (fase 2.5, §3.4) — hergebruikt `CalendarForm`, net als de
 * projectkalender-`CalendarDialog`, maar schrijft naar `s.resourceCalendars` via
 * `addCalendar`/`updateCalendar` i.p.v. `s.calendar`/`setCalendar`.
 *
 * Bewust GEEN `runCPM()`-aanroep na Apply: resource-kalenders zijn informatief en raken de
 * CPM-datums niet aan (§3.2) — alleen belasting/nivellering lezen ze, en dat gebeurt pas als
 * de gebruiker expliciet Nivelleren/Herberekenen drukt (die leest `resourceLoadResult` opnieuw).
 *
 * `calendarId`: id van een bestaande `resourceCalendars`-entry om te bewerken, of `undefined`
 * om een nieuwe resource-kalender aan te maken (draft start als kopie van `createDefaultCalendar`
 * met een lege naam, zodat de gebruiker 'm meteen kan hernoemen).
 */
export function ResourceCalendarDialog({
  calendarId,
  onClose,
}: {
  calendarId?: string;
  onClose: () => void;
}) {
  const { t: tCommon } = useTranslation('common');
  const resourceCalendars = useAppStore(s => s.calendars);
  const addCalendar = useAppStore(s => s.addCalendar);
  const updateCalendar = useAppStore(s => s.updateCalendar);
  const project = useAppStore(s => s.project);
  const projectYearSpan = computeGenerateSpan(project.startDate, project.endDate || undefined);

  const existing = calendarId ? resourceCalendars.find(c => c.id === calendarId) : undefined;

  // Local working copy — only committed on Apply.
  const [draft, setDraft] = useState<WorkCalendar>(() =>
    existing ? structuredClone(existing) : { ...createDefaultCalendar(), id: generateId('rescal'), name: '' },
  );

  const handleApply = () => {
    if (existing) {
      updateCalendar(existing.id, draft);
    } else {
      const { id: _unused, ...rest } = draft;
      void _unused;
      addCalendar(rest);
    }
    onClose();
  };

  // Esc sluit dialog (LAYOUTS.md §3.3)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[600px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {tCommon('resource.calendarDialog.title')}
          </span>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <CalendarForm
          draft={draft}
          onChange={patch => setDraft(d => ({ ...d, ...patch }))}
          projectYearSpan={projectYearSpan}
        />

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn btn--sm btn--secondary">
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
