import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import type { HistorySessionMark } from '@/state/slices/historySlice';
import { moveTaskVerdict, phaseAssignmentQuestionForTaskDialog } from '@/state/slices/taskSlice';
import type { PhaseAssignmentChoice } from '@/state/structuralTransition';
import { notifyHierarchyCycle } from '@/state/hierarchyRelationNotice';
import { askActualStart } from '@/state/actualStartQuestion';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { localTodayIso } from '@/utils/dateUtils';
import type { ProgressEdit, ProgressEntryResult } from '@/engine/progressEntry';
import {
  planTaskDialogProgress, prepareTaskDialogSaveProgress, saveTaskDialog,
  type TaskDialogDraft, type TaskDialogInitialDuration, type TaskDialogStartEdit,
} from '@/state/taskDialogSave';
import { shownStart, startIsActual } from '@/utils/taskDates';
import { hasMilestoneBlockingAssignments, milestoneRefusal } from '@/engine/taskMilestoneTransition';
import { milestoneRefusalNotices } from '@/state/structuralTransition';
import { Select } from '@/components/common/Select';
import { TaskDateTimeInput } from '@/components/common/TaskDateTimeInput';
import { Icon } from '@/components/icons';
import { Dialog, DialogHelpButton } from '@/components/common/Dialog';
import { Field } from '@/components/task-sections/shared';
import { TaskBasicFields } from '@/components/task-sections/TaskBasicFields';
import { applyProjectTaskTypeRename, type ProjectTaskTypeRename } from '@/components/task-sections/projectTaskTypeRename';
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
import { TASK_PROPERTIES_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { defaultTaskMeasure } from '@/state/newTaskMeasure';

function blankDraft(startDate: string, constructionMode: boolean, durationUnit: 'days' | 'hours' = 'days'): Task {
  return {
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
  const actualStartHelpOpen = useAppStore(s => s.ui.pendingActualStartQuestion !== null
    && s.ui.activeRibbonTab === 'file' && s.ui.backstageSection === 'help');
  const editingTaskId = useAppStore(s => s.ui.editingTaskId);
  const tasks = useAppStore(s => s.tasks);
  const setUI = useAppStore(s => s.setUI);
  const setTaskWorkRule = useAppStore(s => s.setTaskWorkRule);
  const project = useAppStore(s => s.project);
  const constructionMode = useAppStore(s => s.ui.constructionMode);


  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null;

  const newTaskUnit = defaultTaskMeasure(project);
  const [draft, setDraft] = useState<TaskDialogDraft>(() => blankDraft(project.startDate, constructionMode, newTaskUnit));
  const [saveProgressError, setSaveProgressError] = useState<'afterStatusDate' | 'actualFinishBeforeStart'>();
  const onChange = (patch: Partial<Task>) => {
    setSaveProgressError(undefined);
    const state = useAppStore.getState();
    setDraft(d => {
      const next = { ...d, ...patch };
      if (!patch.time || !next.inferredActualFinish) return next;
      const plan = planTaskDialogProgress(state, next, startDateEdit, { field: 'completion', value: 1 }, {
        today: localTodayIso(), initialDuration: initialDurationRef.current,
      });
      return plan.ok && plan.change ? plan.change.task : next;
    });
  };

  const [startDateEdit, setStartDateEdit] = useState<TaskDialogStartEdit>();
  const originalStart = editingTask ? shownStart(editingTask) : project.startDate;
  const startDate = startDateEdit?.date ?? originalStart;
  const initialDurationRef = useRef<TaskDialogInitialDuration | null>(null);
  const calendars = useAppStore(s => s.calendars);
  const projectCal = useAppStore(s => s.calendar);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const sessionKey = editingTaskId ? `task:${editingTaskId}` : 'new-task';
  const initializedSessionRef = useRef<string | null>(null);
  const [readySession, setReadySession] = useState<string | null>(null);
  const historyMarkRef = useRef<HistorySessionMark | null>(null);
  const historyMark = useAppStore(s => s.historyMark);
  const endHistorySession = useAppStore(s => s.endHistorySession);
  const revertHistorySince = useAppStore(s => s.revertHistorySince);
  const pendingRenamesRef = useRef<ProjectTaskTypeRename[]>([]);
  const [pendingRenames, setPendingRenames] = useState<ProjectTaskTypeRename[]>([]);
  const deferProjectRename = useCallback((rename: ProjectTaskTypeRename) => {
    const next = [...pendingRenamesRef.current.filter(item => item.id !== rename.id || item.documentId !== rename.documentId), rename];
    pendingRenamesRef.current = next;
    setPendingRenames(next);
  }, []);
  const finishSession = useCallback(() => {
    if (historyMarkRef.current !== null) endHistorySession(historyMarkRef.current);
    historyMarkRef.current = null;
    const renames = pendingRenamesRef.current;
    if (renames.length === 0) return;
    pendingRenamesRef.current = [];
    setPendingRenames([]);
    for (const rename of renames) applyProjectTaskTypeRename(rename);
  }, [endHistorySession]);

  const effCal = (draft.calendarId ? calendars.find(c => c.id === draft.calendarId) : undefined) || projectCal;

  useEffect(() => {
    if (!showTaskDialog) {
      initializedSessionRef.current = null;
      setReadySession(null);
      finishSession();
      return;
    }

    if (initializedSessionRef.current === sessionKey) return;
    initializedSessionRef.current = sessionKey;
    setReadySession(sessionKey);
    finishSession();
    historyMarkRef.current = editingTaskId ? historyMark() : null;
    setStartDateEdit(undefined);
    setSaveProgressError(undefined);

    if (editingTask) {
      setDraft({ ...editingTask, time: { ...editingTask.time } });
      initialDurationRef.current = {
        unit: editingTask.time.durationUnit, scheduleDuration: editingTask.time.scheduleDuration, durationMinutes: editingTask.time.durationMinutes,
      };
    } else {
      setDraft(blankDraft(project.startDate, constructionMode, newTaskUnit));
    }

  }, [showTaskDialog, editingTaskId, editingTask, sessionKey, project.startDate, constructionMode, newTaskUnit, historyMark, finishSession]);

  const initialFocus = useCallback(() => {
    const el = nameInputRef.current;
    el?.setSelectionRange(0, el.value.length);
    return el;
  }, []);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const enterDraftProgress = (edit: ProgressEdit, opts?: { actualStart?: string }): ProgressEntryResult => {
    setSaveProgressError(undefined);
    const state = useAppStore.getState();
    const plan = planTaskDialogProgress(state, draftRef.current, startDateEdit, edit, {
      today: localTodayIso(), actualStart: opts?.actualStart, initialDuration: initialDurationRef.current,
    });
    if (!plan.ok) return plan;
    if (plan.change) {
      draftRef.current = plan.change.task;
      setDraft(plan.change.task);
    }
    return { ok: true };
  };

  const handleSave = (): boolean => saveWith(undefined) === true;

  const saveWith = (
    phaseAssignments: PhaseAssignmentChoice | undefined,
    afterLaterSave?: () => void,
    actualStart?: string,
  ): boolean | 'later' => {
    if (!draft.name.trim()) return false;
    if (editingTask && draft.parentId !== editingTask.parentId) {
      const current = useAppStore.getState();
      const verdict = moveTaskVerdict(current, editingTask.id, draft.parentId);
      if (!verdict.ok) {
        notifyHierarchyCycle(current, verdict.cycle);
        return false;
      }
    }
    if (editingTask && draft.isMilestone && !editingTask.isMilestone) {
      const store = useAppStore.getState();
      const refusal = milestoneRefusal({
        hasChildren: editingTask.childIds.length > 0,
        hasAssignments: hasMilestoneBlockingAssignments(editingTask.id, store.assignments, store.resources),
      });
      if (refusal) {
        for (const notice of milestoneRefusalNotices([{ id: editingTask.id, name: editingTask.name, refusal }])) store.notify(notice);
        return false;
      }
    }
    if (!phaseAssignments) {
      const store = useAppStore.getState();
      const ask = () => (!editingTask || draft.parentId !== editingTask.parentId
        ? phaseAssignmentQuestionForTaskDialog(useAppStore.getState(), editingTask?.id ?? null, draft.parentId || null, {
          name: draft.name,
          isMilestone: draft.isMilestone,
          hasChildren: (editingTask?.childIds.length ?? 0) > 0,
        })
        : null);
      const question = ask();
      if (question) {
        store.askPhaseAssignmentQuestion(question, (choice) => {
          if (saveWith(choice) === true) afterLaterSave?.();
        }, ask);
        return 'later';
      }
    }
    const input = {
      editingTaskId: editingTask ? editingTask.id : null,
      draft: draftRef.current,
      startDate: editingTask ? startDateEdit : startDate,
      initialDuration: initialDurationRef.current,
      session: historyMarkRef.current,
      today: localTodayIso(),
      phaseAssignments,
    };
    const progress = prepareTaskDialogSaveProgress(useAppStore.getState(), input, actualStart);
    if (!progress.ok) {
      if (progress.reason === 'needsActualStart') {
        const question = progress.question;
        void askActualStart([{ ...question, taskName: input.draft.name }]).then(answers => {
          const answer = answers?.[question.taskId];
          if (answer && saveWith(phaseAssignments, afterLaterSave, answer) === true) afterLaterSave?.();
        });
        return 'later';
      }
      setSaveProgressError(progress.reason);
      return false;
    }
    const saved = saveTaskDialog({ ...input, draft: progress.change?.task ?? input.draft });
    if (!saved) return false;
    setUI({ showTaskDialog: false, editingTaskId: null });
    return true;
  };

  const handleClose = () => {
    if (historyMarkRef.current !== null) revertHistorySince(historyMarkRef.current);
    setUI({ showTaskDialog: false, editingTaskId: null });
  };

  if (!showTaskDialog || readySession !== sessionKey) return null;

  const startLocked = startIsActual(draft);

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

  return (
    <Dialog
      key={sessionKey}
      initialFocus={initialFocus}
      suspended={actualStartHelpOpen}
      onCancel={handleClose}
      onConfirm={handleSave}
      overlayClassName="bg-black/50 z-50"
      overlayProps={{ 'data-ops-task-dialog': true }}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[620px] max-h-[85vh] overflow-hidden flex flex-col"
    >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-body leading-5 font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {editingTask ? t('dialog.editTitle') : t('dialog.newTitle')}
          </h2>
          <span className="flex items-center gap-1">
            <DialogHelpButton
              help={{ articleId: TASK_PROPERTIES_HELP_ARTICLE_ID, confirmLeave: { onSave: openHelpLater => saveWith(undefined, openHelpLater) } }}
              onClose={handleClose}
            />
            <button
              onClick={handleClose}
              className="p-1 hover:bg-surface-hover rounded-[8px]"
              aria-label={tCommon('close')}
              title={tCommon('close')}
            >
              <Icon id="ui.close" size={16} />
            </button>
          </span>
        </div>

        <div className="p-4 flex flex-col gap-3 text-small leading-4 overflow-y-auto">
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
            projectRenames={{ pending: pendingRenames, defer: deferProjectRename }}
          />

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

          <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
          <span className="ui-card-header !text-small !leading-4">{t('properties.time')}</span>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('dialog.startDate')}>
              <TaskDateTimeInput
                task={draft}
                side="start"
                dataAttribute="dialog-start"
                value={startLocked ? shownStart(draft) : startDate}
                required
                disabled={startLocked}
                title={startLocked ? t('taskGrid.validation.startIsActual') : undefined}
                onCommit={value => {
                  if (startLocked || value === startDate) return;
                  setStartDateEdit(value === originalStart ? undefined : { date: value, completion: draft.time.completion });
                }}
                className="input !text-small !leading-4 !px-2.5 !py-1.5"
                ariaLabel={t('dialog.startDate')}
              />
            </Field>

            <Field label={t('duration.label')}>
              <TaskDurationField task={draft} calendar={effCal} onChange={onChange} />
            </Field>
          </div>
          <TaskWorkRuleField
            task={draft}
            onChange={patch => {
              onChange(patch);
              if (editingTask) setTaskWorkRule(editingTask.id, patch.workRule);
            }}
          />

          <TaskHammockFields task={draft} onChange={onChange} />

          <TaskConstraintFields task={draft} onChange={onChange} />

          <TaskDeadlineField task={draft} onChange={onChange} />

          <TaskProgressFields
            task={draft}
            onSetProgress={(raw, opts) => enterDraftProgress({ field: 'completion', value: raw }, opts)}
            onSetActualStart={(date, opts) => enterDraftProgress({ field: 'actualStart', value: date }, opts)}
            onSetActualFinish={(date, opts) => enterDraftProgress({ field: 'actualFinish', value: date }, opts)}
          />
          {saveProgressError && (
            <div role="alert" className="text-body" style={{ color: 'var(--error)' }}>
              {saveProgressError === 'afterStatusDate'
                ? tCommon('progress.actualsAfterStatusDate')
                : tCommon('progress.actualStartAfterFinish')}
            </div>
          )}

          {editingTask && (
            <>
              <TaskCpmResultSection taskId={editingTask.id} />
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
