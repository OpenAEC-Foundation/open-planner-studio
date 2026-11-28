import type { AppSliceFactory } from './types';
import { PROJECT_INFO_HELP_ARTICLE_ID } from '@/state/helpArticles';
import type { Project } from '@/types/project';
import { splitIfcSchemaPatch } from '@/state/ifcSchemaChoice';
import { countShiftedTasks, type RecordedTime } from '@/engine/scheduler/recordedDates';
import { applyProjectPatch } from '@/state/projectPatch';
import { isLeafTask } from '@/utils/taskHierarchy';
import {
  copyProfile, hasValidProfileName, normalizeOptions, normalizeProfile, sameSettings, type SchedulingSettingsDraft,
} from '@/state/schedulingProfileDraft';

export type SchedulingSettings = SchedulingSettingsDraft;
export type ApplyResult = { changed: boolean; shifted: number | null };

export interface SchedulingProfileSlice {
  applySchedulingSettings: (next: SchedulingSettings) => ApplyResult;
  applyProjectInfo: (metadata: Partial<Project>, scheduling: SchedulingSettings | undefined) => ApplyResult;
}

export const createSchedulingProfileSlice: AppSliceFactory<SchedulingProfileSlice> = (runtime) => (set, get) => ({
  applySchedulingSettings: (next) => get().applyProjectInfo({}, next),

  applyProjectInfo: (patch, next) => {
    if (next && !hasValidProfileName(next.profile)) return { changed: false, shifted: null };
    const { schema, rest: metadata } = splitIfcSchemaPatch(patch, get().project);
    const schemaChanged = schema ? get().setIfcSchema(schema) : false;
    const before = get();
    const hasMetadata = Object.keys(metadata).length > 0;
    const profileChanges = !!next
      && !sameSettings({ profile: before.project.schedulingProfile, options: before.project.schedulingOptions }, next);
    if (!profileChanges) {
      if (!hasMetadata) return { changed: schemaChanged, shifted: null };
      get().setProject(metadata);
      return { changed: true, shifted: null };
    }
    const profile = normalizeProfile(next.profile);
    const options = normalizeOptions(next.options);
    const times: Record<string, RecordedTime> = {};
    for (const task of before.tasks) {
      if (isLeafTask(task) && task.time.earlyStart && task.time.earlyFinish) {
        times[task.id] = { start: task.time.earlyStart, finish: task.time.earlyFinish };
      }
    }
    let clampedAnchors = 0;
    set((s) => {
      runtime.beginUndoable(s, { label: hasMetadata ? 'Projectinfo' : 'Rekenprofiel' });
      if (hasMetadata) clampedAnchors = applyProjectPatch(s, metadata).clampedAnchors;
      s.project.schedulingProfile = profile ? { ...copyProfile(profile), name: profile.name.trim() } : undefined;
      s.project.schedulingOptions = options;
      s.project.modifiedAt = new Date().toISOString();
      runtime.finishMutation(s, { stale: true });
    });
    get().runCPM({ withinEvent: true });
    const after = get();
    if (clampedAnchors > 0) {
      after.notify({
        severity: 'info',
        messageKey: 'notifications.projectStartAnchorsClamped',
        params: { count: clampedAnchors },
        dedupeKey: 'project-start-anchors-clamped',
        helpArticleId: PROJECT_INFO_HELP_ARTICLE_ID,
      });
    }
    if (after.cpmResult?.error) return { changed: true, shifted: null };
    const shifted = countShiftedTasks(after.tasks, times);
    if (shifted > 0) {
      after.notify({
        severity: 'info',
        messageKey: 'notifications.schedulingProfileShifted',
        params: { count: shifted },
        dedupeKey: `scheduling-profile-shifted:${after.activeDocumentId}`,
      });
    }
    return { changed: true, shifted };
  },
});
