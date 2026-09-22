// Store-actie van het rekenprofiel (rekenprofielen, spec v3.1 §6; plan taak D3). Het profiel en de
// projectopties zijn documentdata (`project`, rijdt mee in DOCUMENT_FIELDS/snapshot). Eigen sjablonen
// zijn app-globaal en leven buiten de store (`services/schedulingProfiles/profileStore.ts`).
import type { AppSliceFactory } from './types';
import type { Project } from '@/types/project';
import { countShiftedTasks, type RecordedTime } from '@/engine/scheduler/recordedDates';
import { clampProjectStartAnchors } from '@/engine/scheduler/projectStartAnchorClamp';
import { isLeafTask } from '@/utils/taskHierarchy';
import {
  copyProfile, hasValidProfileName, normalizeOptions, normalizeProfile, sameSettings, type SchedulingSettingsDraft,
} from '@/state/schedulingProfileDraft';

export type SchedulingSettings = SchedulingSettingsDraft;
export type ApplyResult = { changed: boolean; shifted: number | null };

export interface SchedulingProfileSlice {
  /** Eén undo-stap: `finishMutation({ stale: true })` (verlaat ook "datums zoals opgeslagen"), daarna
   *  `runCPM()` zoals Toepassen in Projectinfo altijd deed (ook met Automatisch berekenen uit; runCPM
   *  ververst het `after` van datzelfde undo-event), daarna één melding "N taken verschoven" (vóór/ná-
   *  telling van de bladtaken, dezelfde als de #63-strook). Geen kloon-solve vooraf, geen dialoog.
   *  Inhoudelijk gelijke instellingen (`sameSettings`) ⇒ niets, geen undo-stap. Een eigen profiel
   *  zonder naam (`hasValidProfileName`) wordt geweigerd (`changed: false`); een geldige naam wordt
   *  getrimd. = `applyProjectInfo({}, next)`. */
  applySchedulingSettings: (next: SchedulingSettings) => ApplyResult;
  /** Toepassen in Projectinfo (gebruikstest I5): `metadata` = alleen de ÉCHT gewijzigde velden
   *  (`projectInfoPatch`). Wijzigt het profiel niet, dan gaat de metadata via `setProject` (met zijn
   *  eigen no-op-guard en projectstart-klem). Wijzigt het profiel wél, dan landen metadata én profiel
   *  in ÉÉN producer met één undo-stap "Projectinfo" (of "Rekenprofiel" zonder metadata) — zodat één
   *  Ctrl+Z profiel, naam, datums en "datums zoals opgeslagen" samen terugzet. Leeg + ongewijzigd ⇒
   *  niets: geen undo-stap, niet vuil, de modus blijft. */
  applyProjectInfo: (metadata: Partial<Project>, scheduling: SchedulingSettings | undefined) => ApplyResult;
}

export const createSchedulingProfileSlice: AppSliceFactory<SchedulingProfileSlice> = (runtime) => (set, get) => ({
  applySchedulingSettings: (next) => get().applyProjectInfo({}, next),

  applyProjectInfo: (metadata, next) => {
    const before = get();
    const hasMetadata = Object.keys(metadata).length > 0;
    if (next && !hasValidProfileName(next.profile)) return { changed: false, shifted: null };
    const profileChanges = !!next
      && !sameSettings({ profile: before.project.schedulingProfile, options: before.project.schedulingOptions }, next);
    if (!profileChanges) {
      if (!hasMetadata) return { changed: false, shifted: null };
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
      const prevStartDate = s.project.startDate;
      if (hasMetadata) Object.assign(s.project, metadata);
      // Zelfde projectstart-klem als `setProject` (T7b): alleen bij een echte startdatumwijziging.
      if (typeof metadata.startDate === 'string' && metadata.startDate !== prevStartDate) {
        clampedAnchors = clampProjectStartAnchors({
          tasks: s.tasks, sequences: s.sequences, calendar: s.calendar, calendars: s.calendars,
          prevStartDate, nextStartDate: metadata.startDate,
        });
      }
      s.project.schedulingProfile = profile ? { ...copyProfile(profile), name: profile.name.trim() } : undefined;
      s.project.schedulingOptions = options;
      s.project.modifiedAt = new Date().toISOString();
      runtime.finishMutation(s, { stale: true });
    });
    get().runCPM();
    const after = get();
    if (clampedAnchors > 0) {
      after.notify({
        severity: 'info',
        messageKey: 'notifications.projectStartAnchorsClamped',
        params: { count: clampedAnchors },
        dedupeKey: 'project-start-anchors-clamped',
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
