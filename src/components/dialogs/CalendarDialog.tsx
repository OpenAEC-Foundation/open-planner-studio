import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Plus, Copy, Trash2, Star } from 'lucide-react';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/types/calendar';
import { computeGenerateSpan } from '@/engine/calendar/generateCalendarHolidays';
import { CalendarForm } from './CalendarForm';

/**
 * Bewerksectie voor precies één bibliotheek-kalender. Eigen lokale `draft`-state, remount per
 * `calendar.id` (via de `key` in `CalendarDialog`) zodat wisselen van selectie nooit de
 * in-progress-edits van een ándere kalender overschrijft. Apply-patroon (fase 2.5-precedent,
 * `ResourceCalendarDialog`): pas op expliciete "Toepassen" committeren.
 */
function CalendarEditor({
  calendar,
  projectYearSpan,
  onApply,
}: {
  calendar: WorkCalendar;
  projectYearSpan: { from: number; to: number };
  onApply: (draft: WorkCalendar) => void;
}) {
  const { t: tCommon } = useTranslation('common');
  const [draft, setDraft] = useState<WorkCalendar>(() => structuredClone(calendar));

  return (
    <>
      <CalendarForm
        draft={draft}
        onChange={patch => setDraft(d => ({ ...d, ...patch }))}
        projectYearSpan={projectYearSpan}
      />
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <button onClick={() => setDraft(structuredClone(calendar))} className="btn btn--sm btn--secondary">
          {tCommon('cancel')}
        </button>
        <button onClick={() => onApply(draft)} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]">
          {tCommon('apply')}
        </button>
      </div>
    </>
  );
}

/**
 * Kalender-bibliotheek-dialoog (fase 2.8a, §7.1): links een lijst van alle bibliotheek-
 * kalenders (`s.calendars`) met de projectdefault gemarkeerd, rechts `CalendarEditor` (=
 * `CalendarForm` + Apply) voor de geselecteerde kalender. Nieuw/dupliceren/verwijderen/
 * "Als projectdefault" via de golf-1-bibliotheek-CRUD (`addCalendar`/`updateCalendar`/
 * `removeCalendar`/`setProjectCalendar`).
 */
export function CalendarDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const calendars = useAppStore(s => s.calendars);
  const addCalendar = useAppStore(s => s.addCalendar);
  const updateCalendar = useAppStore(s => s.updateCalendar);
  const removeCalendar = useAppStore(s => s.removeCalendar);
  const setProjectCalendar = useAppStore(s => s.setProjectCalendar);
  const ensureProjectCalendarInLibrary = useAppStore(s => s.ensureProjectCalendarInLibrary);
  const runCPM = useAppStore(s => s.runCPM);
  const setUI = useAppStore(s => s.setUI);

  // Golf-1 promoveert de gedenormaliseerde projectkalender niet automatisch naar de zichtbare
  // bibliotheek (dat gebeurt pas bij het laden van oude bestanden, §4.3) — hier lazy zodat de
  // huidige projectdefault altijd als beheerbare rij verschijnt.
  useEffect(() => {
    ensureProjectCalendarInLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(project.calendarId);

  // Val terug op de projectdefault (of de eerste entry) zodra de huidige selectie niet meer
  // bestaat — inclusief de allereerste render, vóórdat de promotie-effect hierboven vuurde.
  useEffect(() => {
    if (!calendars.some(c => c.id === selectedId)) {
      setSelectedId(calendars.find(c => c.id === project.calendarId)?.id ?? calendars[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendars, project.calendarId]);

  const selected = calendars.find(c => c.id === selectedId) ?? null;

  const close = () => setUI({ showCalendarDialog: false });

  const projectYearSpan = computeGenerateSpan(project.startDate, project.endDate || undefined);

  const handleNew = () => {
    const id = addCalendar({ ...createDefaultCalendar(), name: tCommon('calendar.library.new'), holidays: [], generation: undefined });
    setSelectedId(id);
  };

  const handleDuplicate = () => {
    if (!selected) return;
    const { id: _unused, ...rest } = selected;
    void _unused;
    const id = addCalendar({ ...rest, name: `${selected.name} (${tCommon('calendar.library.duplicate').toLowerCase()})` });
    setSelectedId(id);
  };

  const handleRemove = () => {
    if (!selected) return;
    removeCalendar(selected.id);
  };

  const handleSetDefault = () => {
    if (!selected) return;
    setProjectCalendar(selected.id);
    runCPM();
  };

  const handleApply = (draft: WorkCalendar) => {
    if (!selected) return;
    updateCalendar(selected.id, draft);
    if (selected.id === project.calendarId) runCPM();
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
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[860px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        data-ops-calendar-dialog
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {tCommon('calendar.library.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Links: bibliotheek-lijst */}
          <div className="w-[220px] border-r border-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto py-2">
              {calendars.map(cal => {
                const isDefault = cal.id === project.calendarId;
                const isSelected = cal.id === selectedId;
                return (
                  <button
                    key={cal.id}
                    onClick={() => setSelectedId(cal.id)}
                    className={
                      'w-full text-left px-3 py-2 text-xs flex items-center gap-1.5 ' +
                      (isSelected ? 'bg-accent/10 text-text-primary' : 'text-text-secondary hover:bg-surface-hover')
                    }
                    data-ops-calendar-row={cal.id}
                  >
                    {isDefault && <Star size={11} className="shrink-0 text-accent" fill="currentColor" />}
                    <span className="truncate flex-1">{cal.name || tCommon('calendar.library.new')}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1 p-2 border-t border-border">
              <button onClick={handleNew} className="btn btn--sm btn--secondary flex-1 flex items-center justify-center gap-1" title={tCommon('calendar.library.new')}>
                <Plus size={12} />
              </button>
              <button onClick={handleDuplicate} disabled={!selected} className="btn btn--sm btn--secondary flex-1 flex items-center justify-center gap-1 disabled:opacity-40" title={tCommon('calendar.library.duplicate')}>
                <Copy size={12} />
              </button>
              <button
                onClick={handleRemove}
                disabled={!selected || calendars.length <= 1}
                className="btn btn--sm btn--secondary flex-1 flex items-center justify-center gap-1 disabled:opacity-40"
                title={tCommon('delete')}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Rechts: bewerkformulier voor de geselecteerde kalender */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="flex items-center justify-between px-4 pt-3">
                  {selected.id === project.calendarId ? (
                    <span className="text-[11px] font-medium text-accent flex items-center gap-1">
                      <Star size={11} fill="currentColor" />
                      {tCommon('calendar.library.project')}
                    </span>
                  ) : (
                    <button onClick={handleSetDefault} className="btn btn--sm btn--secondary">
                      {tCommon('calendar.library.setDefault')}
                    </button>
                  )}
                </div>
                <CalendarEditor
                  key={selected.id}
                  calendar={selected}
                  projectYearSpan={projectYearSpan}
                  onApply={handleApply}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                {tMenu('ribbon.calendarDialog.noHolidays')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
