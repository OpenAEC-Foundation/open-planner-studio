import { useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { computeGenerateSpan } from '@/engine/calendar/generateCalendarHolidays';
import { CalendarForm } from './CalendarForm';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { calendarScalarBreakIssue } from '@/utils/effectiveWorkTime';

/**
 * Resource-kalender-editor (fase 2.5, §3.4) — hergebruikt `CalendarForm`, net als de
 * projectkalender-`CalendarDialog`, maar schrijft naar `s.calendars` via `addCalendar`/
 * `updateCalendar` i.p.v. `s.calendar`/`setCalendar`.
 *
 * Bewust GEEN `runCPM()`-aanroep na Apply: resource-kalenders zijn informatief en raken de
 * CPM-datums niet aan (§3.2) — alleen belasting/nivellering lezen ze, en dat gebeurt pas als
 * de gebruiker expliciet Nivelleren/Herberekenen drukt (die leest `resourceLoadResult` opnieuw).
 *
 * `poolCompanyId` (issue #19, Bibliotheekweergave-editor): aanwezig ⇒ POOL-modus — lees/schrijf
 * `pools[poolCompanyId].calendars` via `addPoolCalendar`/`updatePoolCalendar` in plaats van de
 * projectkalender-bibliotheek. Zelfde `CalendarForm`, alleen de opslagbestemming wisselt.
 *
 * `calendarId`: id van een bestaande kalender-entry (project- of poolbibliotheek, afhankelijk van
 * `poolCompanyId`) om te bewerken, of `undefined` om een nieuwe resource-kalender aan te maken
 * (draft start als kopie van `createDefaultCalendar` met een lege naam, zodat de gebruiker 'm
 * meteen kan hernoemen).
 */
export function ResourceCalendarDialog({
  calendarId,
  poolCompanyId,
  onClose,
}: {
  calendarId?: string;
  poolCompanyId?: string;
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
    existing ? structuredClone(existing) : { ...createDefaultCalendar(), id: generateId('rescal'), name: '' },
  );
  const [scalarTimeTextInvalid, setScalarTimeTextInvalid] = useState(false);

  const simpleBreakInvalid = scalarTimeTextInvalid || calendarScalarBreakIssue(draft) !== undefined;

  const handleApply = () => {
    if (simpleBreakInvalid) return;
    // Een nieuwe kalender gaat zonder id de bibliotheek in; die kent zelf een id toe.
    const { id: _unused, ...rest } = draft;
    void _unused;
    if (poolCompanyId) {
      if (existing) updatePoolCalendar(poolCompanyId, existing.id, draft);
      else addPoolCalendar(poolCompanyId, rest);
    } else if (existing) {
      updateCalendar(existing.id, draft);
    } else {
      addCalendar(rest);
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
          <button onClick={handleApply} disabled={simpleBreakInvalid} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] disabled:opacity-40">
            {tCommon('apply')}
          </button>
        </div>
    </Dialog>
  );
}
