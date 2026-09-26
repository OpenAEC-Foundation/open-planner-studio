import { useCallback, useLayoutEffect, useState, type KeyboardEvent } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Plus, Copy, Trash2, Star, AlertTriangle } from 'lucide-react';
import type { WorkCalendar } from '@/types/calendar';
import { createNewCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { computeGenerateSpan } from '@/engine/calendar/generateCalendarHolidays';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { CalendarForm } from './CalendarForm';
import { calendarScalarBreakIssue } from '@/utils/effectiveWorkTime';
import { calendarHasHolidayIssue, withCanonicalHolidayEnds } from '@/utils/holidayRange';

/** Kan deze bufferkalender zo niet worden opgeslagen? Ongeldige pauze of een ongeldige feestdagregel
 *  (zelfde regels als het formulier toont; MCP deelt `holidayIssue`). */
const calendarInvalid = (calendar: WorkCalendar): boolean =>
  calendarScalarBreakIssue(calendar) !== undefined || calendarHasHolidayIssue(calendar);

/**
 * Kalender-bibliotheek-dialoog: links een lijst van
 * alle bibliotheek-kalenders met de projectdefault gemarkeerd, rechts `CalendarForm` voor de
 * geselecteerde kalender.
 *
 * BUFFER-MODEL: álle bewerkingen — nieuw/dupliceren/verwijderen/projectdefault
 * én de veld-edits in het formulier — muteren UITSLUITEND een lokale kopie van de bibliotheek. De
 * store wordt pas op "Toepassen" in één keer bijgewerkt (`commitCalendarLibrary`). Zo draaien
 * "Annuleren"/Esc/kruisje/klik-buiten de in de dialoog gemaakte wijzigingen terug door simpelweg
 * te sluiten. Uitzondering, bewust: Enter in een tekstveld commit de buffer
 * tussentijds zonder te sluiten (`commitOnInputEnter`); Annuleren gooit daarna alleen weg wat sinds
 * die Enter is gewijzigd. Een commit zonder wijziging is in de store een no-op.
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
  const [scalarTimeTextInvalid, setScalarTimeTextInvalid] = useState(false);
  // Enter in een invoerveld vraagt een tussentijdse commit aan; hij draait pas ná de render van die
  // toetsaanslag (zie `commitOnInputEnter` en het layout-effect hieronder).
  const [enterCommitRequested, setEnterCommitRequested] = useState(false);

  // Init vóór de eerste paint (useLayoutEffect, geen flash): promoveer (lazy, idempotente
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
  }, [ensureProjectCalendarInLibrary]);

  const selected = localCalendars.find(c => c.id === selectedId) ?? null;
  // Ongeldige invoer in ÉÉN van de bufferkalenders blokkeert Toepassen én Enter: de commit schrijft
  // altijd de hele bibliotheek. De lijst links markeert welke kalender het is.
  const invalid = scalarTimeTextInvalid || localCalendars.some(calendarInvalid);
  const projectYearSpan = computeGenerateSpan(project.startDate, project.endDate || undefined);

  // Annuleren = sluiten zonder te committen (buffer wordt weggegooid ⇒ alle wijzigingen terug).
  const cancel = () => setUI({ showCalendarDialog: false });

  // Lege einddatums zijn in de editor bewust toegestaan: bij opslag worden zij canoniek dezelfde
  // dag als de startdatum. Zo blijft het domeinmodel en alle bestaande readers/schrijvers eenduidig.
  // Is er per saldo niets veranderd, dan commit de store niets (geen undo-stap, document blijft
  // ongewijzigd) en slaan we ook de herberekening over — anders zou "even kijken en Toepassen" een
  // document in de modus "datums zoals opgeslagen" alsnog herberekenen.
  const commit = useCallback(() => {
    if (commitCalendarLibrary(localCalendars.map(withCanonicalHolidayEnds), localProjectId)) runCPM();
  }, [commitCalendarLibrary, localCalendars, localProjectId, runCPM]);

  // Toepassen = de hele buffer in één keer naar de store + herberekenen + sluiten.
  const confirm = () => {
    if (invalid) return;
    commit();
    setUI({ showCalendarDialog: false });
  };

  // Alleen gewone enkelregelige invoervelden in déze dialoog gebruiken Enter als "opslaan en
  // open blijven". Knoppen, selects, checkboxen en invoervelden die de toets al zelf afhandelen
  // houden hun eigen native betekenis; andere dialogs gebruiken hun eigen contract.
  //
  // Deze handler commit NIET zelf. Een datumveld (`DateTextInput`) rondt bij Enter eerst zichzelf af
  // (`onCommit` ⇒ setState in deze buffer) en laat de toets dan doorbubbelen naar hier — binnen
  // dezelfde React-dispatch, dus deze closure ziet `localCalendars` nog van vóór die toetsaanslag.
  // Direct committen legde daardoor de buffer zonder de net getypte datum vast. Daarom vragen we
  // de commit aan en voert het layout-effect hieronder hem uit zodra React de updates van deze
  // toetsaanslag heeft toegepast (discrete event: synchroon, vóór de volgende invoer). Dezelfde
  // reden waarom `useDialogKeys` zijn `onConfirm` via een ref leest.
  const commitOnInputEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.nativeEvent.isComposing) return;
    const target = event.target;
    const ownsEnter = target instanceof HTMLButtonElement
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLInputElement
        && ['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'].includes(target.type));
    if (ownsEnter) {
      // Niet preventDefault: een knop moet bij Enter nog steeds zelf klikken.
      event.stopPropagation();
      return;
    }
    if (!(target instanceof HTMLInputElement) || target.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setEnterCommitRequested(true);
  };

  // Uitvoering van de aangevraagde Enter-commit, met de buffer en `invalid` van ná de toetsaanslag.
  // Zelfde poort als de knop Toepassen: nooit een ongeldige buffer tussentijds wegschrijven.
  useLayoutEffect(() => {
    if (!enterCommitRequested) return;
    setEnterCommitRequested(false);
    if (!invalid) commit();
  }, [enterCommitRequested, invalid, commit]);

  // Zelfde fabriek als "+ Resourcekalender" in de resourcerij en MCP `create` (createNewCalendar).
  const handleNew = () => {
    const cal: WorkCalendar = { ...createNewCalendar(tCommon('calendar.library.new')), id: generateId('cal') };
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
    // Esc = Annuleren, Enter = Toepassen (primaire actie), met de standaard
    // textarea/dropdown/IME-uitzonderingen.
    <Dialog
      onCancel={cancel}
      onConfirm={confirm}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[860px] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-calendar-dialog': true, onKeyDown: commitOnInputEnter }}
    >
        <DialogHeader title={tCommon('calendar.library.title')} onClose={cancel} />

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
                      'w-full text-left px-3 py-2 text-small leading-4 flex items-center gap-1.5 ' +
                      (isSelected ? 'bg-accent/10 text-text-primary' : 'text-text-secondary hover:bg-surface-hover')
                    }
                    data-ops-calendar-row={cal.id}
                  >
                    {isDefault && <Star size={11} className="shrink-0 text-accent" fill="currentColor" />}
                    <span className="truncate flex-1">{cal.name || tCommon('calendar.library.new')}</span>
                    {calendarInvalid(cal) && (
                      <span role="img" className="shrink-0 text-red-600" title={tCommon('calendar.library.invalid')}
                        aria-label={tCommon('calendar.library.invalid')} data-ops-calendar-row-invalid>
                        <AlertTriangle size={11} aria-hidden="true" />
                      </span>
                    )}
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
                    <span className="!text-body font-medium text-accent flex items-center gap-1">
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
                  onScalarTimeValidityChange={setScalarTimeTextInvalid}
                  projectYearSpan={projectYearSpan}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-small leading-4 text-text-secondary">
                {tMenu('ribbon.calendarDialog.noHolidays')}
              </div>
            )}
          </div>
        </div>

        {/* Dialoog-footer: Annuleren draait alle nog niet gecommitte wijzigingen terug en sluit;
            Toepassen commit de hele buffer in één keer + herberekent (niets gewijzigd ⇒ no-op). */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={cancel} className="btn btn--sm btn--secondary" data-ops-cal-cancel>
            {tCommon('cancel')}
          </button>
          <button onClick={confirm} disabled={invalid}
            className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] disabled:opacity-40" data-ops-cal-apply>
            {tCommon('apply')}
          </button>
        </div>
    </Dialog>
  );
}
