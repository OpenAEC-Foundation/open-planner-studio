import { useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import type { WorkCalendar } from '@/types/calendar';
import { createNewCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { computeGenerateSpan } from '@/engine/calendar/generateCalendarHolidays';
import { CalendarForm } from './CalendarForm';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { calendarScalarBreakIssue } from '@/utils/effectiveWorkTime';
import { calendarHasHolidayIssue, withCanonicalHolidayEnds } from '@/utils/holidayRange';
import { withTransaction } from '@/state/batchTransaction';

/**
 * Resource-kalender-editor (fase 2.5, §3.4) — hergebruikt `CalendarForm`, net als de
 * projectkalender-`CalendarDialog`, maar schrijft naar `s.calendars` via `addCalendar`/
 * `updateCalendar` i.p.v. `s.calendar`/`setCalendar`.
 *
 * Bewust GEEN `runCPM()`-aanroep na Apply ("plannen is handmatig"). In zijn rol als resource-
 * kalender raakt een kalender de CPM-datums niet (§3.2) — alleen belasting/nivellering lezen hem.
 * Maar de bibliotheek is gedeeld (fase 2.8a): de keuzelijst in de resourcerij biedt ook de
 * projectkalender en taakkalenders aan. Bewerk je zo'n gedeelde kalender hier, dan verandert de
 * planning wél; `updateCalendar` markeert hem dan als verouderd (stale) en F5 rekent hem door.
 *
 * `poolCompanyId` (issue #19, Bibliotheekweergave-editor): aanwezig ⇒ POOL-modus — lees/schrijf
 * `pools[poolCompanyId].calendars` via `addPoolCalendar`/`updatePoolCalendar` in plaats van de
 * projectkalender-bibliotheek. Zelfde `CalendarForm`, alleen de opslagbestemming wisselt.
 *
 * `calendarId`: id van een bestaande kalender-entry (project- of poolbibliotheek, afhankelijk van
 * `poolCompanyId`) om te bewerken, of `undefined` om een nieuwe resource-kalender aan te maken
 * (AANMAAKMODUS: de draft komt uit `createNewCalendar`, dezelfde fabriek als "+" in de
 * kalenderdialoog). In aanmaakmodus bestaat de kalender pas na Toepassen; `onCreated` krijgt dan
 * het nieuwe id — "+ Resourcekalender" koppelt er de resource mee. In de projectbibliotheek zijn
 * aanmaken en koppelen samen één undo-stap; Annuleren laat niets achter.
 */
export function ResourceCalendarDialog({
  calendarId,
  poolCompanyId,
  onCreated,
  onClose,
}: {
  calendarId?: string;
  poolCompanyId?: string;
  /** Alleen in aanmaakmodus: na Toepassen aangeroepen met het id van de nieuwe kalender. */
  onCreated?: (calendarId: string) => void;
  onClose: () => void;
}) {
  const { t: tCommon } = useTranslation('common');
  const resourceCalendars = useAppStore(s => s.calendars);
  const pools = useAppStore(s => s.pools);
  const addCalendar = useAppStore(s => s.addCalendar);
  const updateCalendar = useAppStore(s => s.updateCalendar);
  const addPoolCalendar = useAppStore(s => s.addPoolCalendar);
  const updatePoolCalendar = useAppStore(s => s.updatePoolCalendar);
  const project = useAppStore(s => s.project);
  const projectYearSpan = computeGenerateSpan(project.startDate, project.endDate || undefined);

  const sourceCalendars = poolCompanyId ? (pools[poolCompanyId]?.calendars ?? []) : resourceCalendars;
  const existing = calendarId ? sourceCalendars.find(c => c.id === calendarId) : undefined;

  // Local working copy — only committed on Apply.
  const [draft, setDraft] = useState<WorkCalendar>(() =>
    existing
      ? structuredClone(existing)
      : { ...createNewCalendar(tCommon('resource.calendarDialog.title')), id: generateId('rescal') },
  );
  const [scalarTimeTextInvalid, setScalarTimeTextInvalid] = useState(false);

  // Dezelfde poort als de kalenderdialoog: ongeldige pauze of een ongeldige feestdagregel
  // (`holidayIssue`, gedeeld met MCP) blokkeert Toepassen.
  const invalid = scalarTimeTextInvalid || calendarScalarBreakIssue(draft) !== undefined
    || calendarHasHolidayIssue(draft);

  const handleApply = () => {
    if (invalid) return;
    // Zelfde opslagvorm als de kalenderdialoog: een lege einddatum wordt een eendaagse feestdag.
    const saved = withCanonicalHolidayEnds(draft);
    // Een nieuwe kalender gaat zonder id de bibliotheek in; die kent zelf een id toe.
    const { id: _unused, ...rest } = saved;
    void _unused;
    if (poolCompanyId) {
      // De poolbibliotheek is niet undo-baar (app-globaal); aanmaken en koppelen blijven twee
      // pool-mutaties, maar pas ná Toepassen.
      if (existing) updatePoolCalendar(poolCompanyId, existing.id, saved);
      else {
        const newId = addPoolCalendar(poolCompanyId, rest);
        if (newId) onCreated?.(newId);
      }
    } else if (existing) {
      updateCalendar(existing.id, saved);
    } else {
      // Aanmaken + (via onCreated) koppelen = één gebruikershandeling ⇒ één undo-stap.
      withTransaction(() => {
        const newId = addCalendar(rest);
        onCreated?.(newId);
      });
    }
    onClose();
  };

  return (
    // Esc sluit dialog (LAYOUTS.md §3.3) — via de standaard-toetsafhandeling van `Dialog`.
    <Dialog
      onCancel={onClose}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[600px] max-h-[90vh] flex flex-col overflow-hidden"
    >
        <DialogHeader title={tCommon('resource.calendarDialog.title')} onClose={onClose} />

        <CalendarForm
          draft={draft}
          onChange={patch => setDraft(d => ({ ...d, ...patch }))}
          onScalarTimeValidityChange={setScalarTimeTextInvalid}
          projectYearSpan={projectYearSpan}
        />

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn btn--sm btn--secondary">
            {tCommon('cancel')}
          </button>
          <button onClick={handleApply} disabled={invalid} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] disabled:opacity-40">
            {tCommon('apply')}
          </button>
        </div>
    </Dialog>
  );
}
