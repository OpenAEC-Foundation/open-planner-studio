import { useCallback, useLayoutEffect, useState, type KeyboardEvent } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import type { WorkCalendar } from '@/types/calendar';
import { createNewCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { computeGenerateSpan } from '@/engine/calendar/generateCalendarHolidays';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { CalendarForm } from './CalendarForm';
import type { WorkTimeSessionStart } from '@/services/subdayIo';
import { calendarScalarBreakIssue } from '@/utils/effectiveWorkTime';
import { calendarHasHolidayIssue, withCanonicalHolidayEnds } from '@/utils/holidayRange';
import { CALENDARS_HELP_ARTICLE_ID } from '@/state/helpArticles';

const calendarInvalid = (calendar: WorkCalendar): boolean =>
  calendarScalarBreakIssue(calendar) !== undefined || calendarHasHolidayIssue(calendar);

export function CalendarDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const calculatedEnd = useAppStore(s => s.cpmResult?.projectEnd);
  const commitCalendarLibrary = useAppStore(s => s.commitCalendarLibrary);
  const ensureProjectCalendarInLibrary = useAppStore(s => s.ensureProjectCalendarInLibrary);
  const runCPM = useAppStore(s => s.runCPM);
  const setUI = useAppStore(s => s.setUI);

  const [ready, setReady] = useState(false);
  const [localCalendars, setLocalCalendars] = useState<WorkCalendar[]>([]);
  const [localProjectId, setLocalProjectId] = useState<string>(project.calendarId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scalarTimeTextInvalid, setScalarTimeTextInvalid] = useState(false);
  const [enterCommitRequested, setEnterCommitRequested] = useState(false);
  const [committedSnapshot, setCommittedSnapshot] = useState('');
  const [sessionStarts, setSessionStarts] = useState<Record<string, WorkTimeSessionStart>>({});

  useLayoutEffect(() => {
    ensureProjectCalendarInLibrary();
    const st = useAppStore.getState();
    const cals = structuredClone(st.calendars) as WorkCalendar[];
    setLocalCalendars(cals);
    setLocalProjectId(st.project.calendarId);
    setSelectedId(cals.find(c => c.id === st.project.calendarId)?.id ?? cals[0]?.id ?? null);
    setCommittedSnapshot(JSON.stringify([cals, st.project.calendarId]));
    setReady(true);
  }, [ensureProjectCalendarInLibrary]);

  const selected = localCalendars.find(c => c.id === selectedId) ?? null;
  const invalid = scalarTimeTextInvalid || localCalendars.some(calendarInvalid);
  const projectYearSpan = computeGenerateSpan(project.startDate, project.endDate || undefined, calculatedEnd);

  const cancel = () => setUI({ showCalendarDialog: false });

  const commit = useCallback(() => {
    if (commitCalendarLibrary(localCalendars.map(withCanonicalHolidayEnds), localProjectId)) runCPM({ withinEvent: true });
    setCommittedSnapshot(JSON.stringify([localCalendars, localProjectId]));
  }, [commitCalendarLibrary, localCalendars, localProjectId, runCPM]);
  const dirty = ready && JSON.stringify([localCalendars, localProjectId]) !== committedSnapshot;

  const confirm = () => {
    if (invalid) return;
    commit();
    setUI({ showCalendarDialog: false });
  };

  const commitOnInputEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.nativeEvent.isComposing) return;
    const target = event.target;
    const ownsEnter = target instanceof HTMLButtonElement
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLInputElement
        && ['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'].includes(target.type));
    if (ownsEnter) {
      event.stopPropagation();
      return;
    }
    if (!(target instanceof HTMLInputElement) || target.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setEnterCommitRequested(true);
  };

  useLayoutEffect(() => {
    if (!enterCommitRequested) return;
    setEnterCommitRequested(false);
    if (!invalid) commit();
  }, [enterCommitRequested, invalid, commit]);

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
    if (selected) {
      const before = { workTime: selected.workTime, hoursPerDay: selected.hoursPerDay };
      setSessionStarts(m => (m[selectedId] ? m : { ...m, [selectedId]: before }));
    }
    setLocalCalendars(cs => cs.map(c => (c.id === selectedId ? { ...c, ...patch } : c)));
  };

  return (
    <Dialog
      onCancel={cancel}
      onConfirm={confirm}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[860px] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-calendar-dialog': true, onKeyDown: commitOnInputEnter }}
    >
        <DialogHeader
          title={tCommon('calendar.library.title')}
          onClose={cancel}
          help={{
            articleId: CALENDARS_HELP_ARTICLE_ID,
            confirmLeave: { dirty, onSave: () => { if (invalid) return false; confirm(); } },
          }}
        />

        <div className="flex flex-1 overflow-hidden">
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
                    {isDefault && <Icon id="status.project-calendar" size={11} className="shrink-0" />}
                    <span className="truncate flex-1">{cal.name || tCommon('calendar.library.new')}</span>
                    {calendarInvalid(cal) && (
                      <span role="img" className="shrink-0 text-red-600" title={tCommon('calendar.library.invalid')}
                        aria-label={tCommon('calendar.library.invalid')} data-ops-calendar-row-invalid>
                        <Icon id="status.error" size={11} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1 p-2 border-t border-border">
              <button onClick={handleNew} className="btn btn--sm btn--secondary flex-1 flex items-center justify-center gap-1" title={tCommon('calendar.library.new')}>
                <Icon id="calendar.new" size={12} />
              </button>
              <button onClick={handleDuplicate} disabled={!selected} className="btn btn--sm btn--secondary flex-1 flex items-center justify-center gap-1 disabled:opacity-40" title={tCommon('calendar.library.duplicate')}>
                <Icon id="calendar.duplicate" size={12} />
              </button>
              <button
                onClick={handleRemove}
                disabled={!selected || localCalendars.length <= 1}
                className="btn btn--sm btn--secondary flex-1 flex items-center justify-center gap-1 disabled:opacity-40"
                title={tCommon('delete')}
              >
                <Icon id="edit.delete" size={12} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {ready && selected ? (
              <>
                <div className="flex items-center justify-between px-4 pt-3">
                  {localProjectId === selected.id ? (
                    <span className="!text-body font-medium text-accent flex items-center gap-1">
                      <Icon id="status.project-calendar" size={11} />
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
                  sessionStart={sessionStarts[selected.id] ?? selected}
                  onSessionStartChange={start => setSessionStarts(m => ({ ...m, [selected.id]: start }))}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-small leading-4 text-text-secondary">
                {tMenu('ribbon.calendarDialog.noHolidays')}
              </div>
            )}
          </div>
        </div>

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
