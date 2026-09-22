// Store-actie van het rekenprofiel (rekenprofielen, spec v3.1 §6; plan taak D3). Het profiel en de
// projectopties zijn documentdata (`project`, rijdt mee in DOCUMENT_FIELDS/snapshot). Eigen sjablonen
// zijn app-globaal en leven buiten de store (`services/schedulingProfiles/profileStore.ts`).
import type { AppSliceFactory } from './types';
import { countShiftedTasks, type RecordedTime } from '@/engine/scheduler/recordedDates';
import { isLeafTask } from '@/utils/taskHierarchy';
import {
  copyProfile, hasValidProfileName, normalizeOptions, normalizeProfile, sameSettings, type SchedulingSettingsDraft,
} from '@/state/schedulingProfileDraft';

export type SchedulingSettings = SchedulingSettingsDraft;

export interface SchedulingProfileSlice {
  /** Eén undo-stap: `finishMutation({ stale: true })` (verlaat ook "datums zoals opgeslagen"), daarna
   *  `runCPM()` zoals Toepassen in Projectinfo altijd deed (ook met Automatisch berekenen uit; runCPM
   *  ververst het `after` van datzelfde undo-event), daarna één melding "N taken verschoven" (vóór/ná-
   *  telling, dezelfde als de #63-strook). Geen kloon-solve vooraf, geen dialoog. Inhoudelijk gelijke
   *  instellingen (`sameSettings`) ⇒ niets, geen undo-stap. Een eigen profiel zonder naam
   *  (`hasValidProfileName`) wordt geweigerd (`changed: false`); een geldige naam wordt getrimd. */
  applySchedulingSettings: (next: SchedulingSettings) => { changed: boolean; shifted: number | null };
}

export const createSchedulingProfileSlice: AppSliceFactory<SchedulingProfileSlice> = (runtime) => (set, get) => ({
  applySchedulingSettings: (next) => {
    const before = get();
    if (!hasValidProfileName(next.profile)) return { changed: false, shifted: null };
    if (sameSettings({ profile: before.project.schedulingProfile, options: before.project.schedulingOptions }, next)) {
      return { changed: false, shifted: null };
    }
    const profile = normalizeProfile(next.profile);
    const options = normalizeOptions(next.options);
    const times: Record<string, RecordedTime> = {};
    for (const task of before.tasks) {
      if (isLeafTask(task) && task.time.earlyStart && task.time.earlyFinish) {
        times[task.id] = { start: task.time.earlyStart, finish: task.time.earlyFinish };
      }
    }
    set((s) => {
      runtime.beginUndoable(s, { label: 'Rekenprofiel' });
      s.project.schedulingProfile = profile ? { ...copyProfile(profile), name: profile.name.trim() } : undefined;
      s.project.schedulingOptions = options;
      s.project.modifiedAt = new Date().toISOString();
      runtime.finishMutation(s, { stale: true });
    });
    get().runCPM();
    const after = get();
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
