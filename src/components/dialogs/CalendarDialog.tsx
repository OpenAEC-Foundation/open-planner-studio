import { useLayoutEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Plus, Copy, Trash2, Star } from 'lucide-react';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { computeGenerateSpan } from '@/engine/calendar/generateCalendarHolidays';
import { Dialog } from '@/components/common/Dialog';
import { CalendarForm } from './CalendarForm';

/**
 * Kalender-bibliotheek-dialoog (fase 2.8a, §7.1; buffer-herziening fase 2.8b): links een lijst van
 * alle bibliotheek-kalenders met de projectdefault gemarkeerd, rechts `CalendarForm` voor de
 * geselecteerde kalender.
 *
 * BUFFER-MODEL (fase 2.8b-bugfix): álle bewerkingen — nieuw/dupliceren/verwijderen/projectdefault
 * én de veld-edits in het formulier — muteren UITSLUITEND een lokale kopie van de bibliotheek. De
 * store wordt pas op "Toepassen" in één keer bijgewerkt (`commitCalendarLibrary`). Zo draaien
 * "Annuleren"/Esc/kruisje/klik-buiten ALLE in de dialoog gemaakte wijzigingen terug door simpelweg
 * te sluiten (er is niets naar de store gecommit). Dit vervangt het oude live-commit-gedrag, waarin
 * "Annuleren" niets deed omdat de wijzigingen al in de store zaten.
 */
export function CalendarDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const commitCalendarLibrary = useAppStore(s => s.commitCalendarLibrary);
  const ensureProjectCalendarInLibrary = useAppStore(s => s.ensureProjectCalendarInLibrary);
  const runCPM = useAppStore(s => s.runCPM);
  const setUI = useAppStore(s => s.setUI);

  const [ready, setReady] = useState(false);
  const [localCalendars, setLocalCalendars] = useState<WorkCalendar[]>([]);
  const [localProjectId, setLocalProjectId] = useState<string>(project.calendarId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Init vóór de eerste paint (useLayoutEffect, geen flash): promoveer (lazy, idempotente §4.3-
  // normalisatie — geen gebruikerswijziging) de gedenormaliseerde projectkalender naar de zichtbare
  // bibliotheek en vul dáárna de lokale buffer met een diepe kopie van de store-bibliotheek.
  useLayoutEffect(() => {
    ensureProjectCalendarInLibrary();
    const st = useAppStore.getState();
    const cals = structuredClone(st.calendars) as WorkCalendar[];
    setLocalCalendars(cals);
    setLocalProjectId(st.project.calendarId);
    setSelectedId(cals.find(c => c.id === st.project.calendarId)?.id ?? cals[0]?.id ?? null);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = localCalendars.find(c => c.id === selectedId) ?? null;
  const projectYearSpan = computeGenerateSpan(project.startDate, project.endDate || undefined);

  // Annuleren = sluiten zonder te committen (buffer wordt weggegooid ⇒ alle wijzigingen terug).
  const cancel = () => setUI({ showCalendarDialog: false });

  // Toepassen = de hele buffer in één keer naar de store + herberekenen + sluiten.
  const confirm = () => {
    commitCalendarLibrary(localCalendars, localProjectId);
    runCPM();
    setUI({ showCalendarDialog: false });
  };

  const handleNew = () => {
    const cal: WorkCalendar = {
      ...createDefaultCalendar(),
      id: generateId('cal'),
      name: tCommon('calendar.library.new'),
      holidays: [],
      generation: undefined,
    };
    setLocalCalendars(cs => [...cs, cal]);
    setSelectedId(cal.id);
  };

  const handleDuplicate = () => {
    if (!selected) return;
    const dup: WorkCalendar = {
      ...structuredClone(selected),
      id: generateId('cal'),
      name: `${selected.name} (${tCommon('calendar.library.duplicate').toLowerCase()})`,
    };
    setLocalCalendars(cs => [...cs, dup]);
    setSelectedId(dup.id);
  };

  const handleRemove = () => {
    if (!selected || localCalendars.length <= 1) return;
    const removedId = selected.id;
    const remaining = localCalendars.filter(c => c.id !== removedId);
    const nextProjectId = localProjectId === removedId ? (remaining[0]?.id ?? localProjectId) : localProjectId;
    setLocalCalendars(remaining);
    setLocalProjectId(nextProjectId);
    if (selectedId === removedId) {
      setSelectedId(remaining.find(c => c.id === nextProjectId)?.id ?? remaining[0]?.id ?? null);
    }
  };

  const handleSetDefault = () => {
    if (!selected) return;
    setLocalProjectId(selected.id);
  };

  const patchSelected = (patch: Partial<WorkCalendar>) => {
    if (!selectedId) return;
    setLocalCalendars(cs => cs.map(c => (c.id === selectedId ? { ...c, ...patch } : c)));
  };

  return (
    // Esc = Annuleren (LAYOUTS.md §3.3), Enter = Toepassen (primaire actie), met de standaard
    // textarea/dropdown/IME-uitzonderingen.
    <Dialog
      onBackdropClick={cancel}
      onCancel={cancel}
      onConfirm={confirm}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[860px] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-calendar-dialog': true }}
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {tCommon('calendar.library.title')}
          </span>
          <button onClick={cancel} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Links: bibliotheek-lijst (lokale buffer) */}
          <div className="w-[220px] border-r border-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto py-2">
              {localCalendars.map(cal => {
                const isDefault = cal.id === localProjectId;
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
                disabled={!selected || localCalendars.length <= 1}
                className="btn btn--sm btn--secondary flex-1 flex items-center justify-center gap-1 disabled:opacity-40"
                title={tCommon('delete')}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Rechts: bewerkformulier — bindt direct op de geselecteerde buffer-kalender */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {ready && selected ? (
              <>
                <div className="flex items-center justify-between px-4 pt-3">
                  {localProjectId === selected.id ? (
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
                <CalendarForm
                  key={selected.id}
                  draft={selected}
                  onChange={patchSelected}
                  projectYearSpan={projectYearSpan}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                {tMenu('ribbon.calendarDialog.noHolidays')}
              </div>
            )}
          </div>
        </div>

        {/* Dialoog-footer: Annuleren draait alle in de dialoog gemaakte wijzigingen terug (niets is
            gecommit) en sluit; Toepassen commit de hele buffer in één keer + herberekent. */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={cancel} className="btn btn--sm btn--secondary" data-ops-cal-cancel>
            {tCommon('cancel')}
          </button>
          <button onClick={confirm} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]" data-ops-cal-apply>
            {tCommon('apply')}
          </button>
        </div>
    </Dialog>
  );
}
