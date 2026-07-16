import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { Select } from '@/components/common/Select';
import { DateTextInput } from '@/components/common/DateTextInput';
import { X } from 'lucide-react';
import { isHourCalendar } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import { Dialog } from '@/components/common/Dialog';
import { Field } from '@/components/task-sections/shared';
import { TaskBasicFields } from '@/components/task-sections/TaskBasicFields';
import { TaskNotesFields } from '@/components/task-sections/TaskNotesFields';
import { TaskMilestoneFields } from '@/components/task-sections/TaskMilestoneFields';
import { TaskHammockFields } from '@/components/task-sections/TaskHammockFields';
import { TaskConstraintFields } from '@/components/task-sections/TaskConstraintFields';
import { TaskDeadlineField } from '@/components/task-sections/TaskDeadlineField';
import { TaskProgressFields } from '@/components/task-sections/TaskProgressFields';
import { TaskCpmResultSection } from '@/components/task-sections/TaskCpmResultSection';
import { TaskDependenciesSection } from '@/components/task-sections/TaskDependenciesSection';
import { TaskAssignmentsSection } from '@/components/task-sections/TaskAssignmentsSection';
import { TaskCodesFieldsSection } from '@/components/task-sections/TaskCodesFieldsSection';

/** Lege draft voor de (in de praktijk onbereikbare — zie ontwerp-doc item 2) "nieuwe taak"-tak:
 *  een vangnet, geen actieve UI-ingang roept de dialoog ooit met `editingTaskId: null` aan. */
function blankDraft(startDate: string, constructionMode: boolean): Task {
  return {
    // Bouwmodus (2026-07-13): neutraal taaktype-default (USERDEFINED) in bouw-agnostische modus.
    id: '', name: '', description: '', wbsCode: '',
    taskType: constructionMode ? 'CONSTRUCTION' : 'USERDEFINED', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: createDefaultTaskTime(startDate, 5), resourceIds: [],
  };
}

export function TaskDialog() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');

  const showTaskDialog = useAppStore(s => s.ui.showTaskDialog);
  const editingTaskId = useAppStore(s => s.ui.editingTaskId);
  const tasks = useAppStore(s => s.tasks);
  const setUI = useAppStore(s => s.setUI);
  const addTask = useAppStore(s => s.addTask);
  const updateTask = useAppStore(s => s.updateTask);
  const moveTask = useAppStore(s => s.moveTask);
  const project = useAppStore(s => s.project);
  const constructionMode = useAppStore(s => s.ui.constructionMode);

  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null;

  // Lokale draft (fase 2.10, item 2): alle "veld-secties" (naam/omschrijving/type/kalender,
  // mijlpaal, hammock, constraint, deadline, voortgang, aantekeningen) muteren deze draft via
  // `onChange(patch)` — commit pas op Save. De RELATIONELE secties (afhankelijkheden/toewijzingen/
  // codes&velden/CPM-resultaat) werken rechtstreeks op de store via `taskId` (identiek aan het
  // paneel, spec-akkoord) en raken de draft niet.
  const [draft, setDraft] = useState<Task>(() => blankDraft(project.startDate, constructionMode));
  const onChange = (patch: Partial<Task>) => setDraft(d => ({ ...d, ...patch }));

  // Duur-invoer (fase 2.8b, §6.4) — BEWUST buiten de draft/onChange-generieke-patch-flow gehouden
  // (KRITIEK spec-risico, item 2): dag-modus toont één Dagen-vakje (`durDays`); uur-modus toont drie
  // gesyncte vakjes (Dagen/Uren/Totaal uren) — alle drie HELE getallen. `durHours` blijft 0 in
  // dag-modus. `startDate` toont bewust de berekende `earlyStart` (consistent met tabel/Gantt), niet
  // de ruwe `scheduleStart` — de subtiele "alleen scheduleStart aanpassen als de gebruiker die
  // daadwerkelijk wijzigde"-commit-regel in `handleSave` leest daarom `editingTask.time` (vers uit de
  // store) i.p.v. `draft.time`, zodat een eventuele CPM-herberekening tijdens het open staan van de
  // dialoog niet wordt teruggedraaid door een verouderde draft-snapshot.
  const [durDays, setDurDays] = useState(5);
  const [durHours, setDurHours] = useState(0);
  const [startDate, setStartDate] = useState('');
  const calendars = useAppStore(s => s.calendars);
  const projectCal = useAppStore(s => s.calendar);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Effectieve kalender van de (bewerkte) taak volgt de kalender-dropdown live (§6.4): de drie
  // uur-vakjes verschijnen zodra Urenplanning aan staat én de gekozen kalender uur-modus is.
  const effCal = (draft.calendarId ? calendars.find(c => c.id === draft.calendarId) : undefined) || projectCal;
  const hourMode = isHourCalendar(effCal);
  const hpd = effHoursPerDay(effCal);
  const showHourBoxes = enableHourPlanning && hourMode && !draft.isMilestone;
  const totalHours = durDays * hpd + durHours;

  useEffect(() => {
    if (!showTaskDialog) return;

    if (editingTask) {
      setDraft({ ...editingTask });
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
    } else {
      setDraft(blankDraft(project.startDate, constructionMode));
      setDurDays(5);
      setDurHours(0);
      setStartDate(project.startDate);
    }

  }, [showTaskDialog, editingTaskId, editingTask, project.startDate, calendars, projectCal, constructionMode]);

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

  const handleSave = () => {
    if (!draft.name.trim()) return;

    // Duur-schrijfregel (§6.4): uur-taak ⇒ `durationMinutes = totaalUren × 60` + afgeleide
    // `scheduleDuration` (dagen). Dag-taak/mijlpaal ⇒ het naakte aantal werkdagen, GEEN
    // `durationMinutes` (invariant Bevinding 2: sub-dag-duur alleen op een uur-kalender).
    const useHour = enableHourPlanning && hourMode && !draft.isMilestone;
    const total = durDays * hpd + durHours;
    const durationMinutes = total * 60;
    const derivedDays = hpd > 0 ? total / hpd : durDays;

    if (editingTask) {
      // Vers uit de store (niet de draft!) — zie de docstring bij de duur-state hierboven: een
      // eventuele CPM-herberekening tijdens het open staan van de dialoog mag niet worden
      // teruggedraaid. Voortgangs-velden (completion/actualStart/actualFinish) komen WEL uit de
      // draft — dat zijn de enige `time`-subvelden die deze dialoog-sessie zelf muteert buiten de
      // hieronder-berekende schedule-ankervelden.
      const time = { ...editingTask.time, completion: draft.time.completion, actualStart: draft.time.actualStart, actualFinish: draft.time.actualFinish };
      // scheduleStart (de geplande anker) alléén bijwerken als de gebruiker de startdatum
      // daadwerkelijk wijzigde — anders zou opslaan de berekende start als nieuw anker vastleggen
      // en de drift na herberekenen herintroduceren.
      const shownStart = editingTask.time.earlyStart || editingTask.time.scheduleStart;
      if (startDate !== shownStart) time.scheduleStart = startDate;
      if (draft.isMilestone) {
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
        name: draft.name,
        description: draft.description,
        wbsCode: draft.wbsCode,
        taskType: draft.taskType,
        calendarId: draft.calendarId,
        isMilestone: draft.isMilestone,
        milestoneKind: draft.milestoneKind,
        mandatory: draft.mandatory,
        isHammock: draft.isHammock,
        constraint: draft.constraint,
        constraint2: draft.constraint2,
        deadline: draft.deadline,
        notes: draft.notes,
        time,
      });
      // QA-fix P1 (fase 2.10, onderdeel 2): een gewijzigde ouder gaat via `moveTask` — die
      // synchroniseert childIds op ZOWEL de oude als de nieuwe ouder en weigert cykels (een
      // summary onder zijn eigen kind hangen). `updateTask` is een kale Object.assign zonder die
      // sync — parentId hierboven meepatchen zou de boom stil corrumperen (parentId wijst naar de
      // nieuwe ouder, maar diens childIds weet van niets). Bij een geweigerde move (cykel) doet
      // `moveTask` niets: parentId blijft dan ook ongewijzigd — geen halftoegepaste state.
      if (draft.parentId !== editingTask.parentId) {
        moveTask(editingTask.id, draft.parentId);
      }
    } else {
      addTask({
        name: draft.name,
        description: draft.description,
        wbsCode: draft.wbsCode,
        taskType: draft.taskType,
        isMilestone: draft.isMilestone,
        parentId: draft.parentId || null,
        calendarId: draft.calendarId,
        time: {
          durationType: 'WORKTIME',
          scheduleDuration: draft.isMilestone ? 0 : (useHour ? derivedDays : durDays),
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

  if (!showTaskDialog) return null;

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

  return (
    // Esc = Annuleren, Enter = Opslaan (primaire actie) — huisconventie (QA-fix P3, fase 2.10
    // onderdeel 2): dezelfde guards (textarea/open-dropdown/IME) als CalendarDialog/
    // ProjectInfoDialog, nu via de standaard-toetsafhandeling van `Dialog`. `Dialog` rendert pas
    // ná de `showTaskDialog`-gate hierboven, dus de toetsen zijn alleen actief bij een open dialoog.
    // Let op: overlaytint is hier bg-black/50 (historisch iets lichter dan de andere dialogs).
    <Dialog
      onBackdropClick={handleClose}
      onCancel={handleClose}
      onConfirm={handleSave}
      overlayClassName="bg-black/50 z-50"
      overlayProps={{ 'data-ops-task-dialog': true }}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[620px] max-h-[85vh] overflow-hidden flex flex-col"
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
          {/* Naam wordt apart gehouden (i.p.v. binnen TaskBasicFields) omdat de dialoog er de
              auto-focus/select-all-ref op zet bij het openen — TaskBasicFields kent die ref niet. */}
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.nameRequired')}</label>
            <input
              ref={nameInputRef}
              value={draft.name}
              onChange={e => onChange({ name: e.target.value })}
              className={inputCls}
            />
          </div>

          <TaskBasicFields
            task={draft}
            onChange={onChange}
            onCalendarChange={id => onChange({ calendarId: id })}
            hideName
          />

          {/* Bovenliggende taak (item 2, besluit 2): blijft dialoog-only — bestaat niet in het
              paneel (WBS-herstructurering gaat daar via drag/indent-outdent). */}
          <Field label={t('dialog.parentTask')}>
            <Select
              aria-label={t('dialog.parentTask')}
              value={draft.parentId ?? ''}
              onChange={v => onChange({ parentId: v || null })}
              options={[
                { value: '', label: t('dialog.noParent') },
                ...tasks
                  .filter(tk => tk.id !== editingTaskId)
                  .map(tk => ({
                    value: tk.id,
                    label: `${tk.wbsCode ? `${tk.wbsCode} — ` : ''}${tk.name}`,
                  })),
              ]}
            />
          </Field>

          <TaskNotesFields task={draft} onChange={onChange} />

          <TaskMilestoneFields task={draft} onChange={onChange} />

          {/* Tijd — dialoogspecifiek (KRITIEK spec-risico, item 2): NIET de gedeelde
              `TaskTimeFields`, want de Save-commit-logica hierboven (scheduleStart-alleen-bij-
              wijziging, duur-bron-behoud) hoort bij deze aparte dagen/uren-invoer, niet bij een
              instant-apply patch-contract. */}
          <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
          <span className="ui-card-header !text-xs">{t('properties.time')}</span>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('dialog.startDate')}>
              <DateTextInput
                value={startDate}
                onCommit={setStartDate}
                className="input !text-xs !px-2.5 !py-1.5"
                ariaLabel={t('dialog.startDate')}
              />
            </Field>

            {/* Dag-modus: één Dagen-vakje (byte-identiek). Uur-modus: de drie vakjes staan
                full-width hieronder, dus deze kolom blijft leeg. */}
            {!showHourBoxes && (
              <Field label={t('dialog.duration')}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.isMilestone ? 0 : durDays}
                  onChange={onIntChange(setDurDays)}
                  disabled={draft.isMilestone}
                  className="input !text-xs !px-2.5 !py-1.5 disabled:opacity-50"
                  aria-label={t('dialog.duration')}
                  data-ops-duration-days
                />
                {/* Invariant Bevinding 2: uren vereisen een uur-kalender. */}
                {enableHourPlanning && !hourMode && !draft.isMilestone && (
                  <span className="text-[10px] text-text-secondary italic" data-ops-hour-hint>{t('dialog.hourCalendarHint')}</span>
                )}
              </Field>
            )}
          </div>

          {/* Drie gesyncte duur-vakjes (§6.4): totaalUren = dagen × effHpd + uren. Alle HELE getallen. */}
          {showHourBoxes && (
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('dialog.durationDays')}>
                <input type="text" inputMode="numeric" value={durDays}
                  onChange={onIntChange(setDurDays)} className="input !text-xs !px-2.5 !py-1.5"
                  aria-label={t('dialog.durationDays')} data-ops-dur-days />
              </Field>
              <Field label={t('dialog.durationHours')}>
                <input type="text" inputMode="numeric" value={durHours}
                  onChange={onIntChange(setDurHours)} className="input !text-xs !px-2.5 !py-1.5"
                  aria-label={t('dialog.durationHours')} data-ops-dur-hours />
              </Field>
              <Field label={t('dialog.durationTotalHours')}>
                <input type="text" inputMode="numeric" value={totalHours}
                  onChange={onTotalChange} className="input !text-xs !px-2.5 !py-1.5"
                  aria-label={t('dialog.durationTotalHours')} data-ops-dur-total />
              </Field>
            </div>
          )}

          <TaskHammockFields task={draft} onChange={onChange} />

          <TaskConstraintFields task={draft} onChange={onChange} />

          <TaskDeadlineField task={draft} onChange={onChange} />

          <TaskProgressFields
            task={draft}
            onSetProgress={raw => setDraft(d => {
              const completion = Math.max(0, Math.min(1, raw));
              const time = { ...d.time, completion };
              // Spiegelt taskSlice.setTaskProgress (§3.2), maar op de draft — commit pas op Save.
              if (completion > 0 && !time.actualStart) time.actualStart = time.earlyStart || time.scheduleStart;
              if (completion < 1) time.actualFinish = undefined;
              return { ...d, time };
            })}
            onSetActualStart={date => {
              // Spiegelt taskSlice.setActualStart (§3.2): actuals nooit ná de statusdatum.
              if (date && project.statusDate && date > project.statusDate) return false;
              setDraft(d => ({ ...d, time: { ...d.time, actualStart: date } }));
              return true;
            }}
            onSetActualFinish={date => {
              if (date && project.statusDate && date > project.statusDate) return false;
              setDraft(d => {
                const time = { ...d.time, actualFinish: date };
                if (!date && time.completion >= 1) time.completion = 0;
                return { ...d, time };
              });
              return true;
            }}
          />

          {editingTask && (
            <>
              <TaskCpmResultSection taskId={editingTask.id} />
              <TaskDependenciesSection taskId={editingTask.id} />
              <TaskAssignmentsSection taskId={editingTask.id} />
              <TaskCodesFieldsSection taskId={editingTask.id} />
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border">
          <button onClick={handleClose} className="btn btn--sm btn--secondary" data-ops-task-cancel>
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!draft.name.trim()}
            className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
            data-ops-task-save
          >
            {editingTask ? tCommon('save') : tCommon('add')}
          </button>
        </div>
    </Dialog>
  );
}
