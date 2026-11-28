import type { IfcSchemaId, Project, ProgressMode, ProjectSchedulingOptions, SchedulingProfile } from '@/types/project';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { createDefaultTaskTime, deriveScheduleDurationFromMinutes, seedNewHourTaskFinish } from '@/utils/taskDefaults';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { CustomTaskType } from '@/types/taskType';
import type { Baseline } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { sameValue } from '@/utils/sameValue';
import { diffDays } from '@/utils/dateUtils';
import { applyWbsNumbering } from '@/utils/wbs';
import { CPMSolver, type CPMResult } from '@/engine/scheduler/CPMSolver';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { expandSummaryRelations, leafTasksForSolve } from '@/engine/scheduler/expandSummaryRelations';
import { applyProjectPatch } from '../projectPatch';
import { applyIfcSchemaChoice, splitIfcSchemaPatch } from '../ifcSchemaChoice';
import { markDocumentUnsaved } from '../documentEdited';
import {
  computeMoveDelta, computeMoveImpact, computeHolidayGaps, shiftIso, shiftTask,
  shiftProjectDates, shiftResource, shiftBaseline,
  type MoveProjectOptions, type MoveImpact, type HolidayGapCalendar,
} from '@/engine/moveProject';
import { syncProjectCalendar, promoteProjectCalendarToLibrary } from '../syncProjectCalendar';
import { freshPayload, hydratePayload, type DocumentFileFormat, type TargetFingerprint } from '../documentContract';
import { normalizeTaskDates } from '../migrations/minuteModel';
import { HOST_EVENTS } from '@/services/extensionEvents';
import { clearTimephasedLossNoticeForDoc } from '../timephasedLossNotice';
import { clearTaskTypesNoticeForDoc, notifyWorkRuleDurationsChanged } from '../taskTypesNotice';
import { captureCalendarChange, settleCalendarChange } from '@/engine/work/workRuleApply';
import { assignmentsByTask, tasksFollowingProjectCalendar } from '../calendarTasks';
import { notifyTimephasedLoss } from '../timephasedLossNotice';
import type { AppSliceFactory } from './types';
import { PROJECT_INFO_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { effHoursPerDay } from '@/utils/taskDuration';
import type { XerArchiveIssue, XerImportMetadata } from '@/services/importTypes';
import type { XerSourceArchive } from '@/services/xerSourceArchive';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import type { ForeignSourceMark } from '@/services/ifc/foreign/foreignSourceMark';
import { createDefaultProject } from '../defaults';
import { newTaskTimeUnit, settleNewTaskMeasure } from '../newTaskMeasure';
import { removeSessionHistoryForDocumentFromState } from '../sessionHistory';
import { replaceDocumentContent } from '../documentSaveState';
import { copyProfile, normalizeOptions, normalizeProfile } from '../schedulingProfileDraft';
export { createDefaultProject };

export interface NewProjectOptions {
  name: string;
  description?: string;
  author?: string;
  company?: string;
  startDate: string;
  endDate?: string;
  calendar: WorkCalendar;
  phaseNames: string[];
  defaultTaskDurationUnit?: 'days' | 'hours';
  schedulingProfile?: SchedulingProfile;
  schedulingOptions?: ProjectSchedulingOptions;
}

export interface MoveProjectResult {
  moved: boolean;
  deltaDays: number;
  taskCount: number;
}

export interface MoveProjectPreview {
  deltaDays: number;
  startBefore: string;
  startAfter: string;
  endBefore: string;
  endAfter: string;
  durationBefore: number;
  durationAfter: number;
  endDeltaDays: number;
  impact: MoveImpact;
  holidayGapCalendars: HolidayGapCalendar[];
  error?: string;
}

export interface ProjectSlice {
  project: Project;
  calendar: WorkCalendar;
  isDirty: boolean;
  filePath: string | null;
  fileHandle: FileSystemFileHandle | null;
  siteFileId: string | null;
  siteFileVersion: string | null;
  knownTargetFingerprint: TargetFingerprint | null;
  fileFormat: DocumentFileFormat;
  autoSaveToFile: boolean;
  xerImportMetadata: XerImportMetadata | null;
  xerSourceArchive: XerSourceArchive | null;
  xerSourceProjectId: string | null;
  ifcSource: IfcSource | null;
  foreignSourceMark: ForeignSourceMark | null;
  ifcxReferences: import('../documentContract').DocumentPayload['ifcxReferences'];
  taskTypesVisible: boolean;
  importPristine: boolean;
  xerArchiveIssue: XerArchiveIssue | null;
  ifcGlobalIds: Readonly<Record<string, string>> | null;
  ifcLiteralCalendarIds: string[] | null;
  setProject: (project: Partial<Project>) => void;
  setIfcSchema: (schema: IfcSchemaId) => boolean;
  setWbsAutoNumber: (on: boolean) => void;
  setCalendar: (calendar: WorkCalendar) => void;
  setProjectCalendar: (id: string) => void;
  ensureProjectCalendarInLibrary: () => void;
  setStatusDate: (date: string | undefined) => void;
  setProgressMode: (mode: ProgressMode) => void;
  moveProject: (newStartDate: string, opts?: MoveProjectOptions) => MoveProjectResult;
  previewMoveProject: (newStartDate: string, opts?: MoveProjectOptions) => MoveProjectPreview;
  newProject: () => void;
  createNewProject: (opts: NewProjectOptions) => void;
  setFilePath: (path: string | null) => void;
  loadState: (state: {
    project: Project;
    calendar: WorkCalendar;
    tasks: Task[];
    sequences: Sequence[];
    resources: Resource[];
    assignments: ResourceAssignment[];
    resourceCalendars?: WorkCalendar[];
    activityCodeTypes?: ActivityCodeType[];
    customFieldDefs?: CustomFieldDef[];
    customTaskTypes?: CustomTaskType[];
    baselines?: Baseline[];
    activeBaselineId?: string | null;
  }, opts?: { viewStartDate?: string }) => void;
}

function projectChanges(current: Project, updates: Partial<Project>): boolean {
  return (Object.keys(updates) as (keyof Project)[])
    .some((k) => k !== 'modifiedAt' && !sameValue(current[k], updates[k]));
}


export const createProjectSlice: AppSliceFactory<ProjectSlice> = (runtime) => (set, get) => ({
  project: createDefaultProject(),
  calendar: createDefaultCalendar(),
  isDirty: false,
  filePath: null,
  fileHandle: null,
  siteFileId: null,
  siteFileVersion: null,
  knownTargetFingerprint: null,
  fileFormat: 'ifc',
  autoSaveToFile: false,
  xerImportMetadata: null,
  xerSourceArchive: null,
  xerSourceProjectId: null,
  ifcSource: null,
  foreignSourceMark: null,
  ifcxReferences: null,
  taskTypesVisible: false,
  importPristine: false,
  xerArchiveIssue: null,
  ifcGlobalIds: null,
  ifcLiteralCalendarIds: null,

  setIfcSchema: (schema) => {
    let changed = false;
    set((s) => {
      changed = applyIfcSchemaChoice(s.project, schema, s.ifcSource);
      if (changed) markDocumentUnsaved(s);
    });
    return changed;
  },

  setProject: (patch) => {
    const { schema, rest: updates } = splitIfcSchemaPatch(patch, get().project);
    if (schema) get().setIfcSchema(schema);
    let clampedAnchors = 0;
    let measureChanged = false;
    set((s) => {
      if (!projectChanges(s.project, updates)) return;
      runtime.beginUndoable(s);
      const outcome = applyProjectPatch(s, updates);
      clampedAnchors = outcome.clampedAnchors;
      measureChanged = outcome.measureChangedTaskIds.length > 0;
      runtime.finishMutation(s, { stale: 'startDate' in updates || measureChanged });
    });
    if (measureChanged) {
      get().recomputeResourceLoad();
      get().recomputeViewRows();
    }
    if (clampedAnchors > 0) {
      get().runCPM({ withinEvent: true });
      get().notify({
        severity: 'info',
        messageKey: 'notifications.projectStartAnchorsClamped',
        params: { count: clampedAnchors },
        dedupeKey: 'project-start-anchors-clamped',
        helpArticleId: PROJECT_INFO_HELP_ARTICLE_ID,
      });
    }
  },

  setWbsAutoNumber: (on) =>
    set((s) => {
      if (!!s.project.wbsAutoNumber === on) return;
      runtime.beginUndoable(s);
      s.project.wbsAutoNumber = on;
      if (on) applyWbsNumbering(s.tasks);
      runtime.finishMutation(s);
    }),

  setCalendar: (calendar) =>
    set((s) => {
      const idx = s.calendars.findIndex((c) => c.id === calendar.id);
      if (sameValue(s.calendar, calendar) && (idx < 0 || sameValue(s.calendars[idx], calendar))) return;
      runtime.beginUndoable(s);
      s.calendar = calendar;
      if (idx >= 0) s.calendars[idx] = calendar;
      runtime.finishMutation(s, { stale: true });
    }),

  setProjectCalendar: (id) => {
    let changed = 0;
    let lost = 0;
    set((s) => {
      if (!s.calendars.some((c) => c.id === id)) return;
      if (s.project.calendarId === id) return;
      runtime.beginUndoable(s);
      const byTask = assignmentsByTask(s.assignments);
      const affected = tasksFollowingProjectCalendar(s).map((task) => ({ task, before: captureCalendarChange(task, byTask.get(task.id) ?? [], s) }));
      s.project.calendarId = id;
      syncProjectCalendar(s);
      for (const { task, before } of affected) {
        const settled = settleCalendarChange(task, byTask.get(task.id) ?? [], before, s);
        if (settled.durationChanged) changed++;
        if (settled.timephasedLost) lost++;
      }
      runtime.finishMutation(s, { stale: true });
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, changed);
    if (lost > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lost);
  },

  ensureProjectCalendarInLibrary: () =>
    set((s) => {
      promoteProjectCalendarToLibrary(s);
    }),

  setStatusDate: (date) =>
    set((s) => {
      const next = date || undefined;
      if (s.project.statusDate === next) return;
      runtime.beginUndoable(s, { coalesceKey: 'project.statusDate' });
      if (next) s.project.statusDate = next;
      else delete s.project.statusDate;
      s.project.modifiedAt = new Date().toISOString();
      runtime.finishMutation(s, { stale: true });
    }),

  setProgressMode: (mode) =>
    set((s) => {
      if (s.project.progressMode === mode) return;
      runtime.beginUndoable(s);
      s.project.progressMode = mode;
      s.project.modifiedAt = new Date().toISOString();
      runtime.finishMutation(s, { stale: true });
    }),

  moveProject: (newStartDate, opts) => {
    let out: MoveProjectResult = { moved: false, deltaDays: 0, taskCount: 0 };
    set((s) => {
      const delta = computeMoveDelta(s.project.startDate, newStartDate);
      if (!Number.isFinite(delta) || delta === 0) return;
      runtime.beginUndoable(s);
      s.project = shiftProjectDates(s.project, delta);
      s.project.startDate = newStartDate;
      s.project.modifiedAt = new Date().toISOString();
      s.tasks = s.tasks.map((t) => shiftTask(t, delta));
      s.resources = s.resources.map((r) => shiftResource(r, delta));
      if (opts?.shiftBaselines) s.baselines = s.baselines.map((b) => shiftBaseline(b, delta));
      runtime.finishMutation(s, { stale: true });
      out = { moved: true, deltaDays: delta, taskCount: s.tasks.length };
    });
    if (out.moved) {
      get().runCPM({ withinEvent: true });
      get().requestFitToProject();
    }
    return out;
  },

  previewMoveProject: (newStartDate, opts) => {
    const s = get();
    const delta = computeMoveDelta(s.project.startDate, newStartDate);
    const impact = computeMoveImpact(
      s.tasks, s.resources,
      opts?.shiftBaselines ? s.baselines : [],
      s.customFieldDefs,
    );
    const empty: MoveProjectPreview = {
      deltaDays: delta,
      startBefore: s.project.startDate, startAfter: newStartDate,
      endBefore: '', endAfter: '',
      durationBefore: 0, durationAfter: 0, endDeltaDays: 0,
      impact, holidayGapCalendars: [],
    };
    if (!Number.isFinite(delta)) return empty;

    const { sequences: expandedSequences } = expandSummaryRelations(s.tasks, s.sequences);
    const solve = (
      tasks: Task[], dataDate: string | undefined, projectStartDate: string, projectEndDate: string,
    ): CPMResult => {
      const leaf = leafTasksForSolve(tasks);
      return new CPMSolver(leaf, expandedSequences, s.calendar, s.calendars, {
        ...solveOptionsFor(s.project),
        dataDate,
        projectStartDate,
        projectEndDate,
      }).solve();
    };

    if (s.tasks.length === 0) {
      return {
        ...empty,
        holidayGapCalendars: computeHolidayGaps(
          [s.calendar, ...s.calendars],
          newStartDate,
          shiftIso(s.project.endDate, delta) || newStartDate,
        ),
      };
    }

    const fresh = s.cpmResult && !s.cpmResult.error && !s.scheduleStale ? s.cpmResult : null;
    const before = fresh ?? solve(
      s.tasks.map((t) => shiftTask(t, 0)), s.project.statusDate, s.project.startDate, s.project.endDate,
    );
    const after = solve(
      s.tasks.map((t) => shiftTask(t, delta)),
      shiftIso(s.project.statusDate, delta),
      newStartDate,
      shiftIso(s.project.endDate, delta) || s.project.endDate,
    );

    if (after.error) return { ...empty, error: after.error };

    const endBefore = before.error ? '' : before.projectEnd;
    const endAfter = after.projectEnd;
    const endDeltaDays = endBefore && endAfter ? diffDays(endBefore, endAfter) : delta;

    return {
      ...empty,
      endBefore, endAfter,
      durationBefore: before.error ? 0 : before.projectDuration,
      durationAfter: after.projectDuration,
      endDeltaDays: Number.isFinite(endDeltaDays) ? endDeltaDays : delta,
      holidayGapCalendars: computeHolidayGaps(
        [s.calendar, ...s.calendars],
        newStartDate,
        endAfter || shiftIso(s.project.endDate, delta) || newStartDate,
      ),
    };
  },

  newProject: () => {
    set((s) => {
      removeSessionHistoryForDocumentFromState(s, s.activeDocumentId);
      replaceDocumentContent(s, s.activeDocumentId);
      hydratePayload(s, freshPayload());
      s.ui.showLibraryLinkDialog = false;
      s.ui.libraryRefreshNotice = null;
      clearTimephasedLossNoticeForDoc(s.activeDocumentId);
      clearTaskTypesNoticeForDoc(s.activeDocumentId);
    });
    runtime.emitHostEvent(HOST_EVENTS.projectNew);
  },

  createNewProject: (opts) => {
    const st = get();
    const pristine =
      st.tasks.length === 0 && st.sequences.length === 0 && st.resources.length === 0 &&
      st.filePath === null && !st.isDirty;
    if (!pristine) get().newDocument();

    set((s) => {
      removeSessionHistoryForDocumentFromState(s, s.activeDocumentId);
      replaceDocumentContent(s, s.activeDocumentId);
      const proj = createDefaultProject();
      proj.name = opts.name.trim() || proj.name;
      proj.description = opts.description ?? '';
      proj.author = opts.author ?? '';
      proj.company = opts.company ?? '';
      proj.startDate = opts.startDate || proj.startDate;
      proj.endDate = opts.endDate ?? '';
      proj.calendarId = opts.calendar.id;
      proj.defaultTaskDurationUnit = opts.defaultTaskDurationUnit ?? 'days';
      const profile = normalizeProfile(opts.schedulingProfile);
      proj.schedulingProfile = profile ? copyProfile(profile) : undefined;
      proj.schedulingOptions = normalizeOptions(opts.schedulingOptions);

      const payload = freshPayload();
      payload.project = proj;
      payload.calendar = opts.calendar;
      const phaseHoursPerDay = effHoursPerDay(opts.calendar);
      payload.tasks = opts.phaseNames.map((name, i): Task => {
        const time = createDefaultTaskTime(proj.startDate, 5, newTaskTimeUnit(proj), opts.calendar);
        deriveScheduleDurationFromMinutes(time, phaseHoursPerDay);
        const task: Task = {
          id: generateId('task'),
          name,
          description: '',
          wbsCode: String(i + 1),
          taskType: s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED',
          status: 'NOT_STARTED' as const,
          isMilestone: false,
          priority: 500,
          parentId: null,
          childIds: [],
          time,
          resourceIds: [],
        };
        if (settleNewTaskMeasure(task, proj, false, phaseHoursPerDay)) seedNewHourTaskFinish(task, undefined, opts.calendar);
        return task;
      });
      payload.tasks = payload.tasks.map(task => normalizeTaskDates(task, { calendar: opts.calendar, calendars: [opts.calendar] }));
      payload.isDirty = opts.phaseNames.length > 0;
      payload.view.viewStartDate = proj.startDate;
      hydratePayload(s, payload);
      s.ui.showLibraryLinkDialog = false;
      s.ui.libraryRefreshNotice = null;
      clearTimephasedLossNoticeForDoc(s.activeDocumentId);
      clearTaskTypesNoticeForDoc(s.activeDocumentId);
    });
    get().recomputeViewRows();
    runtime.emitHostEvent(HOST_EVENTS.projectNew);
  },

  setFilePath: (path) =>
    set((s) => {
      s.filePath = path;
      s.knownTargetFingerprint = null;
    }),

  loadState: (loaded, opts) => {
    get().applyLoadedProject(loaded, {
      recompute: true,
      fit: false,
      viewStartDate: opts?.viewStartDate,
    });
  },
});
