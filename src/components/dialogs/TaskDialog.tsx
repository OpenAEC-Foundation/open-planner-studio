import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { TaskType } from '@/types/task';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { Select } from '@/components/common/Select';
import { DateTextInput } from '@/components/common/DateTextInput';
import { X } from 'lucide-react';
import { isHourCalendar } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';

export function TaskDialog() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const { options: taskTypeOptions } = useTaskTypeLabels();

  const showTaskDialog = useAppStore(s => s.ui.showTaskDialog);
  const editingTaskId = useAppStore(s => s.ui.editingTaskId);
  const tasks = useAppStore(s => s.tasks);
  const setUI = useAppStore(s => s.setUI);
  const addTask = useAppStore(s => s.addTask);
  const updateTask = useAppStore(s => s.updateTask);
  const project = useAppStore(s => s.project);

  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [wbsCode, setWbsCode] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('CONSTRUCTION');
  const [isMilestone, setIsMilestone] = useState(false);
  // Duur-invoer (fase 2.8b, §6.4): dag-modus toont één Dagen-vakje (`durDays`); uur-modus toont drie
  // gesyncte vakjes (Dagen/Uren/Totaal uren) — alle drie HELE getallen. `durHours` blijft 0 in dag-modus.
  const [durDays, setDurDays] = useState(5);
  const [durHours, setDurHours] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [parentId, setParentId] = useState<string>('');
  // Taak-kalender-keuze (fase 2.8a, §7.3): '' = Projectkalender (undefined).
  const [calendarId, setCalendarId] = useState<string>('');
  const calendars = useAppStore(s => s.calendars);
  const projectCal = useAppStore(s => s.calendar);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const allowMixedDayHour = useAppStore(s => s.ui.allowMixedDayHour);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Effectieve kalender van de (bewerkte) taak volgt de kalender-dropdown live (§6.4): de drie
  // uur-vakjes verschijnen zodra Urenplanning aan staat én de gekozen kalender uur-modus is.
  const effCal = (calendarId ? calendars.find(c => c.id === calendarId) : undefined) || projectCal;
  const hourMode = isHourCalendar(effCal);
  const hpd = effHoursPerDay(effCal);
  const showHourBoxes = enableHourPlanning && hourMode && !isMilestone;
  const totalHours = durDays * hpd + durHours;

  useEffect(() => {
    if (!showTaskDialog) return;

    if (editingTask) {
      setName(editingTask.name);
      setDescription(editingTask.description);
      setWbsCode(editingTask.wbsCode);
      setTaskType(editingTask.taskType);
      setIsMilestone(editingTask.isMilestone);
      // Duur-init (§6.4): uur-kalender-taak met `durationMinutes` ⇒ splits in dagen/uren via de
      // effectieve hpd; anders het naakte aantal werkdagen (dag-modus, byte-identiek).
      const eff = (editingTask.calendarId ? calendars.find(c => c.id === editingTask.calendarId) : undefined) || projectCal;
      const ehpd = effHoursPerDay(eff);
      if (isHourCalendar(eff) && editingTask.time.durationMinutes != null && ehpd > 0) {
        const dm = editingTask.time.durationMinutes;
        setDurDays(Math.floor(dm / (ehpd * 60)));
        setDurHours(Math.floor((dm % (ehpd * 60)) / 60));
      } else {
        setDurDays(Math.round(editingTask.time.scheduleDuration));
        setDurHours(0);
      }
      // Toon de berekende start (consistent met tabel/Gantt); scheduleStart is de geplande anker.
      setStartDate(editingTask.time.earlyStart || editingTask.time.scheduleStart);
      setParentId(editingTask.parentId || '');
      setCalendarId(editingTask.calendarId ?? '');
    } else {
      setName('');
      setDescription('');
      setWbsCode('');
      setTaskType('CONSTRUCTION');
      setIsMilestone(false);
      setDurDays(5);
      setDurHours(0);
      setStartDate(project.startDate);
      setParentId('');
      setCalendarId('');
    }

  }, [showTaskDialog, editingTaskId, editingTask, project.startDate, calendars, projectCal]);

  useEffect(() => {
    if (!showTaskDialog) return;
    const id = setTimeout(() => {
      const el = nameInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(0, el.value.length);
    }, 30);
    return () => clearTimeout(id);
  }, [showTaskDialog, editingTaskId]);

  // Esc sluit dialog (LAYOUTS.md §3.3 keyboard support)
  useEffect(() => {
    if (!showTaskDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUI({ showTaskDialog: false, editingTaskId: null });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showTaskDialog, setUI]);

  if (!showTaskDialog) return null;

  const handleSave = () => {
    if (!name.trim()) return;

    // Duur-schrijfregel (§6.4): uur-taak ⇒ `durationMinutes = totaalUren × 60` + afgeleide
    // `scheduleDuration` (dagen). Dag-taak/mijlpaal ⇒ het naakte aantal werkdagen, GEEN
    // `durationMinutes` (invariant Bevinding 2: sub-dag-duur alleen op een uur-kalender).
    const useHour = enableHourPlanning && hourMode && !isMilestone;
    const total = durDays * hpd + durHours;
    const durationMinutes = total * 60;
    const derivedDays = hpd > 0 ? total / hpd : durDays;

    if (editingTask) {
      // scheduleStart (de geplande anker) alléén bijwerken als de gebruiker de startdatum
      // daadwerkelijk wijzigde — anders zou opslaan de berekende start als nieuw anker vastleggen
      // en de drift na herberekenen herintroduceren.
      const shownStart = editingTask.time.earlyStart || editingTask.time.scheduleStart;
      const time = { ...editingTask.time };
      if (startDate !== shownStart) time.scheduleStart = startDate;
      if (isMilestone) {
        time.scheduleDuration = 0;
        delete time.durationMinutes;
      } else if (useHour) {
        time.scheduleDuration = derivedDays;
        time.durationMinutes = durationMinutes;
      } else {
        // Dag-modus-tak (Urenplanning uit of dag-kalender). Speciaal geval: staat de schakelaar UIT
        // terwijl de effectieve kalender tóch uur-modus is (bv. net geladen uur-bestand), dan toont
        // het enkele Dagen-vakje slechts de hele-dagen-benadering; laat de minuut-bron ONGEMOEID
        // zolang de gebruiker die waarde niet wijzigde — anders zou opslaan 2,5d stil truncaten.
        const initWholeDays = hourMode && editingTask.time.durationMinutes != null && hpd > 0
          ? Math.floor(editingTask.time.durationMinutes / (hpd * 60))
          : Math.round(editingTask.time.scheduleDuration);
        if (hourMode && editingTask.time.durationMinutes != null && durDays === initWholeDays) {
          // bron behouden: durationMinutes + scheduleDuration blijven staan
        } else {
          time.scheduleDuration = durDays;
          delete time.durationMinutes;
        }
      }
      updateTask(editingTask.id, {
        name,
        description,
        wbsCode,
        taskType,
        isMilestone,
        time,
        calendarId: calendarId || undefined,
      });
    } else {
      addTask({
        name,
        description,
        wbsCode,
        taskType,
        isMilestone,
        parentId: parentId || null,
        calendarId: calendarId || undefined,
        time: {
          durationType: 'WORKTIME',
          scheduleDuration: isMilestone ? 0 : (useHour ? derivedDays : durDays),
          ...(useHour ? { durationMinutes } : {}),
          scheduleStart: startDate,
          scheduleFinish: startDate,
          earlyStart: startDate,
          earlyFinish: startDate,
          lateStart: startDate,
          lateFinish: startDate,
          freeFloat: 0,
          totalFloat: 0,
          isCritical: false,
          completion: 0,
        },
      });
    }

    setUI({ showTaskDialog: false, editingTaskId: null });
  };

  const handleClose = () => {
    setUI({ showTaskDialog: false, editingTaskId: null });
  };

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

  // Alleen niet-negatieve HELE getallen (§6.4): een lege string ⇒ 0; decimalen/tekst worden geweigerd
  // (de invoer verandert niet). Zo kan geen "2.5"/"1,5" de drie synchrone vakjes binnenkomen.
  const onIntChange = (setter: (n: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value;
    if (v === '') { setter(0); return; }
    if (!/^\d+$/.test(v)) return;
    setter(parseInt(v, 10));
  };
  const onTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value;
    if (v === '') { setDurDays(0); setDurHours(0); return; }
    if (!/^\d+$/.test(v)) return;
    const total = parseInt(v, 10);
    setDurDays(hpd > 0 ? Math.floor(total / hpd) : total);
    setDurHours(hpd > 0 ? total % hpd : 0);
  };

  // Kalender-poort (§6.8): gemengd-toestaan UIT ⇒ binnen het project alleen kalenders met dezelfde
  // modus (dag/uur) als de projectkalender; de al-gekozen kalender blijft altijd zichtbaar.
  const projectIsHour = isHourCalendar(projectCal);
  const calOptions = (enableHourPlanning && !allowMixedDayHour)
    ? calendars.filter(c => c.id === calendarId || isHourCalendar(c) === projectIsHour)
    : calendars;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {editingTask ? t('dialog.editTitle') : t('dialog.newTitle')}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 text-xs overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.nameRequired')}</label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={`${inputCls} h-16 resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.wbsCode')}</label>
              <input
                value={wbsCode}
                onChange={e => setWbsCode(e.target.value)}
                className={inputCls}
                placeholder={t('dialog.wbsPlaceholder')}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.type')}</label>
              <Select
                aria-label={t('dialog.type')}
                value={taskType}
                onChange={v => setTaskType(v as TaskType)}
                options={taskTypeOptions.map(tt => ({ value: tt.value, label: tt.label }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.startDate')}</label>
              <DateTextInput
                value={startDate}
                onCommit={setStartDate}
                className={inputCls}
                ariaLabel={t('dialog.startDate')}
              />
            </div>

            {/* Dag-modus: één Dagen-vakje (byte-identiek). Uur-modus: de drie vakjes staan
                full-width hieronder, dus deze kolom blijft leeg. */}
            {!showHourBoxes && (
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary">{t('dialog.duration')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={isMilestone ? 0 : durDays}
                  onChange={onIntChange(setDurDays)}
                  disabled={isMilestone}
                  className={`${inputCls} disabled:opacity-50`}
                  aria-label={t('dialog.duration')}
                  data-ops-duration-days
                />
                {/* Invariant Bevinding 2: uren vereisen een uur-kalender. */}
                {enableHourPlanning && !hourMode && !isMilestone && (
                  <span className="text-[10px] text-text-secondary italic" data-ops-hour-hint>{t('dialog.hourCalendarHint')}</span>
                )}
              </div>
            )}
          </div>

          {/* Drie gesyncte duur-vakjes (§6.4): totaalUren = dagen × effHpd + uren. Alle HELE getallen. */}
          {showHourBoxes && (
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary">{t('dialog.durationDays')}</label>
                <input type="text" inputMode="numeric" value={durDays}
                  onChange={onIntChange(setDurDays)} className={inputCls}
                  aria-label={t('dialog.durationDays')} data-ops-dur-days />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary">{t('dialog.durationHours')}</label>
                <input type="text" inputMode="numeric" value={durHours}
                  onChange={onIntChange(setDurHours)} className={inputCls}
                  aria-label={t('dialog.durationHours')} data-ops-dur-hours />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary">{t('dialog.durationTotalHours')}</label>
                <input type="text" inputMode="numeric" value={totalHours}
                  onChange={onTotalChange} className={inputCls}
                  aria-label={t('dialog.durationTotalHours')} data-ops-dur-total />
              </div>
            </div>
          )}

          {/* Bovenliggende taak alleen bij aanmaken: bij bewerken schreef de dialoog parentId
              toch al niet weg (structuur wijzigen gaat via inspringen/uitspringen). */}
          {!editingTask && (
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary">{t('dialog.parentTask')}</label>
              <Select
                aria-label={t('dialog.parentTask')}
                value={parentId}
                onChange={setParentId}
                options={[
                  { value: '', label: t('dialog.noParent') },
                  ...tasks
                    .filter(t => t.id !== editingTaskId)
                    .map(t => ({
                      value: t.id,
                      label: `${t.wbsCode ? `${t.wbsCode} — ` : ''}${t.name}`,
                    })),
                ]}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('properties.calendar')}</label>
            <Select
              aria-label={t('properties.calendar')}
              value={calendarId}
              onChange={setCalendarId}
              options={[
                { value: '', label: t('properties.calendarProject') },
                ...calOptions.map(c => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>

          <label className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={isMilestone}
              onChange={e => setIsMilestone(e.target.checked)}
              className="accent-accent"
            />
            <span>{t('dialog.milestone')}</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border">
          <button onClick={handleClose} className="btn btn--sm btn--secondary" data-ops-task-cancel>
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
            data-ops-task-save
          >
            {editingTask ? tCommon('save') : tCommon('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
