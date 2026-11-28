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
import { RESOURCE_CALENDAR_HELP_ARTICLE_ID } from '@/state/helpArticles';

export function ResourceCalendarDialog({
  calendarId,
  poolCompanyId,
  onCreated,
  onClose,
}: {
  calendarId?: string;
  poolCompanyId?: string;
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
  const calculatedEnd = useAppStore(s => s.cpmResult?.projectEnd);
  const projectYearSpan = computeGenerateSpan(project.startDate, project.endDate || undefined, calculatedEnd);

  const sourceCalendars = poolCompanyId ? (pools[poolCompanyId]?.calendars ?? []) : resourceCalendars;
  const existing = calendarId ? sourceCalendars.find(c => c.id === calendarId) : undefined;

  const [draft, setDraft] = useState<WorkCalendar>(() =>
    existing
      ? structuredClone(existing)
      : { ...createNewCalendar(tCommon('resource.calendarDialog.title')), id: generateId('rescal') },
  );
  const [scalarTimeTextInvalid, setScalarTimeTextInvalid] = useState(false);
  const [initialDraft] = useState(() => JSON.stringify(draft));

  const invalid = scalarTimeTextInvalid || calendarScalarBreakIssue(draft) !== undefined
    || calendarHasHolidayIssue(draft);

  const handleApply = () => {
    if (invalid) return;
    const saved = withCanonicalHolidayEnds(draft);
    const { id: _unused, ...rest } = saved;
    void _unused;
    if (poolCompanyId) {
      if (existing) updatePoolCalendar(poolCompanyId, existing.id, saved);
      else {
        const newId = addPoolCalendar(poolCompanyId, rest);
        if (newId) onCreated?.(newId);
      }
    } else if (existing) {
      updateCalendar(existing.id, saved);
    } else {
      withTransaction(() => {
        const newId = addCalendar(rest);
        onCreated?.(newId);
      });
    }
    onClose();
  };

  return (
    <Dialog
      onCancel={onClose}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[600px] max-h-[90vh] flex flex-col overflow-hidden"
    >
        <DialogHeader
          title={tCommon('resource.calendarDialog.title')}
          onClose={onClose}
          help={{
            articleId: RESOURCE_CALENDAR_HELP_ARTICLE_ID,
            confirmLeave: {
              dirty: JSON.stringify(draft) !== initialDraft,
              onSave: () => { if (invalid) return false; handleApply(); },
            },
          }}
        />

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
