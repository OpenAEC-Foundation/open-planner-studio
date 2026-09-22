// De ENIGE weg van een project naar de solver (rekenprofielen, spec v3.1 §3.2).
//
// `solveOptionsFor` levert de volledige solve-opties van een project: de effectieve reken-opties
// (conventies uit het profiel, projectopties uit het bestand — `effectiveSchedulingOptions`), plus
// statusdatum, voortgangsmodus en de twee projectdatums. `solveInputFor` plakt daar de vier
// invoerlijsten bij. `CPMOptions.schedulingOptions` is verplicht `EffectiveSchedulingOptions`: wie deze
// helper overslaat en een kale `project.schedulingOptions` doorgeeft, compileert niet.
import type {
  EffectiveSchedulingOptions, Project, ProgressMode, SchedulingOptions,
} from '@/types/project';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { effectiveSchedulingOptions } from './conventions/registry';
// TIJDELIJK(rekenprofielen): de migratie van oude optieblobs; C3 haalt deze import weg.
import { legacyOptionsToProfile, optionKeysOnly } from '@/services/ifc/schedulingProfileMigration';
import type { SolveProjectInput } from './solveProject';

export type SolveProjectFields = Pick<Project,
  'statusDate' | 'progressMode' | 'schedulingOptions' | 'schedulingProfile' | 'startDate' | 'endDate'>;

export interface ProjectSolveOptions {
  dataDate: string | undefined;
  progressMode: ProgressMode | undefined;
  schedulingOptions: EffectiveSchedulingOptions;
  projectStartDate: string | undefined;
  projectEndDate: string | undefined;
}

/** TIJDELIJK(rekenprofielen): tot C3 dragen verse XER-/.mpp-imports hun conventies (en de
 *  XER-bronmarkering) nog in `project.schedulingOptions`, zonder profiel. Omdat de conventies als
 *  LAATSTE gespreid worden, gingen ze anders verloren; deze tak haalt zulke opties door dezelfde
 *  migratie die baan A byte-identiek bewijst. "Legacy" = er staat een sleutel in die geen
 *  projectoptie is (`optionKeysOnly` strip hem) — zo leest deze motormodule de bronmarkering niet
 *  zelf. C3 verwijdert de tak (de lezers zetten dan zelf het profiel). */
function settingsOf(project: SolveProjectFields): Pick<Project, 'schedulingProfile' | 'schedulingOptions'> {
  const raw = project.schedulingOptions as SchedulingOptions | undefined;
  const legacy = project.schedulingProfile === undefined && raw !== undefined
    && Object.keys(raw).length !== Object.keys(optionKeysOnly(raw) ?? {}).length;
  if (!legacy) return { schedulingProfile: project.schedulingProfile, schedulingOptions: project.schedulingOptions };
  const migrated = legacyOptionsToProfile(raw);
  return { schedulingProfile: migrated.profile, schedulingOptions: migrated.options };
}

export function solveOptionsFor(project: SolveProjectFields): ProjectSolveOptions {
  return {
    dataDate: project.statusDate,
    progressMode: project.progressMode,
    schedulingOptions: effectiveSchedulingOptions(settingsOf(project)),
    projectStartDate: project.startDate,
    projectEndDate: project.endDate,
  };
}

export function solveInputFor(
  project: SolveProjectFields, tasks: Task[], sequences: Sequence[],
  calendar: WorkCalendar, calendars: WorkCalendar[],
): SolveProjectInput {
  return { tasks, sequences, calendar, calendars, ...solveOptionsFor(project) };
}
