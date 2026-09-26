import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import type { HistorySessionMark } from '@/state/slices/historySlice';
import { moveTaskVerdict } from '@/state/slices/taskSlice';
import { notifyHierarchyCycle } from '@/state/hierarchyRelationNotice';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import {
  draftWithActualFinish, draftWithActualStart, draftWithProgress, saveTaskDialog,
} from '@/state/taskDialogSave';
import { shownStart } from '@/utils/taskDates';
import { milestoneRefusal } from '@/engine/taskMilestoneTransition';
import { milestoneRefusalNotices } from '@/state/structuralTransition';
import { Select } from '@/components/common/Select';
import { DateTextInput } from '@/components/common/DateTextInput';
import { X } from 'lucide-react';
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
import { TaskWorkRuleField } from '@/components/task-sections/TaskWorkRuleField';
import { TaskCodesFieldsSection } from '@/components/task-sections/TaskCodesFieldsSection';
import { TaskDurationField } from '@/components/task-sections/TaskDurationField';

/** Lege draft voor de (in de praktijk onbereikbare — zie ontwerp-doc item 2) "nieuwe taak"-tak:
 *  een vangnet, geen actieve UI-ingang roept de dialoog ooit met `editingTaskId: null` aan. */
function blankDraft(startDate: string, constructionMode: boolean, durationUnit: 'days' | 'hours' = 'days'): Task {
  return {
    // Bouwmodus (2026-07-13): neutraal taaktype-default (USERDEFINED) in bouw-agnostische modus.
    id: '', name: '', description: '', wbsCode: '',
    taskType: constructionMode ? 'CONSTRUCTION' : 'USERDEFINED', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: createDefaultTaskTime(startDate, 5, durationUnit), resourceIds: [],
  };
}

export function TaskDialog() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');

  const showTaskDialog = useAppStore(s => s.ui.showTaskDialog);
  const editingTaskId = useAppStore(s => s.ui.editingTaskId);
  const tasks = useAppStore(s => s.tasks);
  const setUI = useAppStore(s => s.setUI);
  const setTaskWorkRule = useAppStore(s => s.setTaskWorkRule);
  const project = useAppStore(s => s.project);
  const constructionMode = useAppStore(s => s.ui.constructionMode);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);

  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null;

  // Lokale draft (fase 2.10, item 2): alle "veld-secties" (naam/omschrijving/type/kalender,
  // mijlpaal, hammock, constraint, deadline, voortgang, aantekeningen) muteren deze draft via
  // `onChange(patch)` — commit pas op Save. De RELATIONELE secties (afhankelijkheden/toewijzingen/
  // codes&velden/CPM-resultaat) werken rechtstreeks op de store via `taskId` (identiek aan het
  // paneel, spec-akkoord) en raken de draft niet.
  const newTaskUnit = enableHourPlanning ? (project.defaultTaskDurationUnit ?? 'days') : 'days';
  const [draft, setDraft] = useState<Task>(() => blankDraft(project.startDate, constructionMode, newTaskUnit));
  const onChange = (patch: Partial<Task>) => setDraft(d => ({ ...d, ...patch }));

  // `startDate` toont bewust de berekende `earlyStart` (consistent met de Tabel-kolom Start en de
  // Gantt), niet de ruwe `scheduleStart` — de subtiele "alleen scheduleStart aanpassen als de gebruiker die
  // daadwerkelijk wijzigde"-commit-regel in `handleSave` leest daarom `editingTask.time` (vers uit de
  // store) i.p.v. `draft.time`, zodat een eventuele CPM-herberekening tijdens het open staan van de
  // dialoog niet wordt teruggedraaid door een verouderde draft-snapshot.
  const [startDate, setStartDate] = useState('');
  const initialDurationRef = useRef<{ unit: 'days' | 'hours'; scheduleDuration: number; durationMinutes?: number } | null>(null);
  const calendars = useAppStore(s => s.calendars);
  const projectCal = useAppStore(s => s.calendar);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // De dialoog bevat zowel een lokale draft als relationele secties die direct de store muteren
  // (zoals resourcetoewijzingen). Een storemutatie mag de nog niet opgeslagen draft nooit opnieuw
  // initialiseren; alleen openen of naar een andere taak wisselen begint een nieuwe sessie.
  const initializedSessionRef = useRef<string | null>(null);
  // G5 (gebruikstest #170): begin van deze bewerksessie in de sessiehistorie.
  const historyMarkRef = useRef<HistorySessionMark | null>(null);
  const historyMark = useAppStore(s => s.historyMark);
  const endHistorySession = useAppStore(s => s.endHistorySession);
  const revertHistorySince = useAppStore(s => s.revertHistorySince);

  // Effectieve kalender volgt de kalender-dropdown live; de gedeelde duurbediening gebruikt hem
  // alleen voor plaatsing en exacte conversievoorstellen, nooit om de taakeenheid af te leiden.
  const effCal = (draft.calendarId ? calendars.find(c => c.id === draft.calendarId) : undefined) || projectCal;

  useEffect(() => {
    if (!showTaskDialog) {
      initializedSessionRef.current = null;
      // Dicht op een andere manier dan Opslaan/Annuleren: de sessie sluiten, de historie laten staan.
      if (historyMarkRef.current !== null) endHistorySession(historyMarkRef.current);
      historyMarkRef.current = null;
      return;
    }

    const sessionKey = editingTaskId ? `task:${editingTaskId}` : 'new-task';
    if (initializedSessionRef.current === sessionKey) return;
    initializedSessionRef.current = sessionKey;
    if (historyMarkRef.current !== null) endHistorySession(historyMarkRef.current);
    historyMarkRef.current = editingTaskId ? historyMark() : null;

    if (editingTask) {
      setDraft({ ...editingTask, time: { ...editingTask.time } });
      initialDurationRef.current = {
        unit: editingTask.time.durationUnit, scheduleDuration: editingTask.time.scheduleDuration, durationMinutes: editingTask.time.durationMinutes,
      };
      // Toon de berekende start (consistent met de Tabel-kolom Start en de Gantt); scheduleStart
      // is de geplande anker.
      setStartDate(shownStart(editingTask));
    } else {
      setDraft(blankDraft(project.startDate, constructionMode, newTaskUnit));
      setStartDate(project.startDate);
    }

  }, [showTaskDialog, editingTaskId, editingTask, project.startDate, constructionMode, newTaskUnit, historyMark, endHistorySession]);

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
    // Een andere bovenliggende taak die via de relaties van de nieuwe fase een kring zou maken
    // (audit taakmutaties, S4): weigeren VÓÓR er iets wordt opgeslagen. `moveTask` weigert zelf ook,
    // maar dan zou de rest van de bewerking al zijn doorgevoerd en de dialoog sluiten; zo blijft hij
    // open met de melding, zoals de conceptrelatie in het paneel, en kan de gebruiker corrigeren.
    if (editingTask && draft.parentId !== editingTask.parentId) {
      const current = useAppStore.getState();
      const verdict = moveTaskVerdict(current, editingTask.id, draft.parentId);
      if (!verdict.ok) {
        notifyHierarchyCycle(current, verdict.cycle);
        return;
      }
    }
    // Wordt mijlpaal (audit §6): het vinkje weigert al in het concept (`TaskMilestoneFields`); dit
    // vangt de toewijzing die intussen via de relationele sectie van deze dialoog is toegevoegd.
    // Weigeren houdt de dialoog open met de rest van het concept intact.
    if (editingTask && draft.isMilestone && !editingTask.isMilestone) {
      const store = useAppStore.getState();
      const refusal = milestoneRefusal({
        hasChildren: editingTask.childIds.length > 0,
        hasAssignments: store.assignments.some(a => a.taskId === editingTask.id),
      });
      if (refusal) {
        for (const notice of milestoneRefusalNotices([{ name: editingTask.name, refusal }])) store.notify(notice);
        return;
      }
    }
    // Opslaan = één undo-stap met dezelfde voortgangsregels als het paneel; de details (vers uit de
    // store vs uit de draft, het scheduleStart-anker, `moveTask` voor de ouder, de duur alleen bij
    // een echte duurbewerking) staan in state/taskDialogSave.ts. G5 (#170): met een open
    // bewerksessie maakt die van alles wat deze sessie op de store deed (werkregel, toewijzingen,
    // werk, relaties) plus het Opslaan zelf één undo-stap (`squashHistorySince`).
    saveTaskDialog({
      editingTaskId: editingTask ? editingTask.id : null,
      draft,
      startDate,
      initialDuration: initialDurationRef.current,
      session: historyMarkRef.current,
    });
    setUI({ showTaskDialog: false, editingTaskId: null });
  };

  const handleClose = () => {
    // Gebruikstest #170, G5: de relationele secties (werkregel, toewijzingen, werk, relaties)
    // committen direct zodat ze in de dialoog met elkaar rekenen; Annuleren draait ze terug.
    if (historyMarkRef.current !== null) revertHistorySince(historyMarkRef.current);
    setUI({ showTaskDialog: false, editingTaskId: null });
  };

  if (!showTaskDialog) return null;

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

  return (
    // Esc = Annuleren, Enter = Opslaan (primaire actie) — huisconventie (QA-fix P3, fase 2.10
    // onderdeel 2): dezelfde guards (textarea/open-dropdown/IME) als CalendarDialog/
    // ProjectInfoDialog, nu via de standaard-toetsafhandeling van `Dialog`. `Dialog` rendert pas
    // ná de `showTaskDialog`-gate hierboven, dus de toetsen zijn alleen actief bij een open dialoog.
    // Let op: overlaytint is hier bg-black/50 (historisch iets lichter dan de andere dialogs).
    <Dialog
      onCancel={handleClose}
      onConfirm={handleSave}
      overlayClassName="bg-black/50 z-50"
      overlayProps={{ 'data-ops-task-dialog': true }}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[620px] max-h-[85vh] overflow-hidden flex flex-col"
    >
        {/* Eigen kop i.p.v. DialogHeader: die rendert de titel als <span> (en krapper/lichter), dit
            is een <h2> — overstappen kost de kopsemantiek. Het kruisje draagt wél dezelfde naam +
            tooltip als DialogHeader (net als ContourDialog). */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-body leading-5 font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {editingTask ? t('dialog.editTitle') : t('dialog.newTitle')}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-surface-hover rounded-[8px]"
            aria-label={tCommon('close')}
            title={tCommon('close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 text-small leading-4 overflow-y-auto">
          {/* Naam wordt apart gehouden (i.p.v. binnen TaskBasicFields) omdat de dialoog er de
              auto-focus/select-all-ref op zet bij het openen — TaskBasicFields kent die ref niet. */}
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary">{t('dialog.nameRequired')}</label>
            <input
              ref={nameInputRef}
              data-ops-task-name
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
            materializeTaskType={false}
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

          {/* Start blijft dialoogdraft-specifiek; de duurbediening hieronder is exact dezelfde
              component als in het vaste eigenschappenpaneel. */}
          <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
          <span className="ui-card-header !text-small !leading-4">{t('properties.time')}</span>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('dialog.startDate')}>
              <DateTextInput
                value={startDate}
                required
                onCommit={setStartDate}
                className="input !text-small !leading-4 !px-2.5 !py-1.5"
                ariaLabel={t('dialog.startDate')}
              />
            </Field>

            <Field label={t('duration.label')}>
              <TaskDurationField task={draft} calendar={effCal} onChange={onChange} />
            </Field>
          </div>
          {/* Taaktypes-etappe (spec §7): zelfde veld als het paneel; commit op Opslaan via `workRule`
              in de updateTask-/addTask-patch (de store legt het werk vast, K1). */}
          <TaskWorkRuleField
            task={draft}
            onChange={patch => {
              // Review B4: op een bestaande taak direct committen (zoals de toewijzingssectie, die óók
              // rechtstreeks op de store werkt) zodat werk/inzet in dezelfde dialoog met de gekozen
              // regel rekenen; de draft spiegelt. Een nieuwe taak houdt 'm in de draft tot Opslaan.
              onChange(patch);
              if (editingTask) setTaskWorkRule(editingTask.id, patch.workRule);
            }}
          />

          <TaskHammockFields task={draft} onChange={onChange} />

          <TaskConstraintFields task={draft} onChange={onChange} />

          <TaskDeadlineField task={draft} onChange={onChange} />

          <TaskProgressFields
            task={draft}
            // Dezelfde regels als de paneelsetters (§3.2), maar op de draft — commit pas op Opslaan.
            // `null` = geweigerd (actual ná de statusdatum), net als de boolean van de store-setters.
            onSetProgress={raw => setDraft(d => draftWithProgress(d, raw, project.statusDate))}
            // De weigering hangt alleen van datum en statusdatum af, dus synchroon te beantwoorden.
            onSetActualStart={date => {
              if (!draftWithActualStart(draft, date, project.statusDate)) return false;
              setDraft(d => draftWithActualStart(d, date, project.statusDate) ?? d);
              return true;
            }}
            onSetActualFinish={date => {
              if (!draftWithActualFinish(draft, date, project.statusDate)) return false;
              setDraft(d => draftWithActualFinish(d, date, project.statusDate) ?? d);
              return true;
            }}
          />

          {editingTask && (
            <>
              <TaskCpmResultSection taskId={editingTask.id} />
              {/* interactive=false (hyperkritische review issue #65): de dialoog kan op elk
                  tabblad open staan (F2), dus zonder gegarandeerd gemonte GanttCanvas kan het
                  "spring naar taak"-signaal nooit worden opgepikt — de sprongknop hoort daarom
                  alleen in het eigenschappenpaneel. */}
              <TaskDependenciesSection taskId={editingTask.id} interactive={false} />
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
