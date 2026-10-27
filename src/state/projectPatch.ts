// De kern van "projectvelden wijzigen", gedeeld door `projectSlice.setProject` (UI) en de MCP-draft
// `setProject` (AI-assistent): die twee moeten zich bij hetzelfde bewerkmoment identiek gedragen.
// Wat per pad verschilt blijft bij de aanroeper: de no-op-guard en de undo-snapshot (UI),
// `isDirty`/`scheduleStale` en wat er met het aantal geklemde ankers gebeurt (UI: herberekenen +
// melding; MCP: in het tool-resultaat).
import type { Project } from '@/types/project';
import type { Sequence } from '@/types/sequence';
import { clampProjectStartAnchors } from '@/engine/scheduler/projectStartAnchorClamp';
import { settleDefaultWorkRuleSwitch, type DefaultWorkRuleSwitchState } from './defaultWorkRuleSwitch';

/** Projectvelden die de MCP-draft kan WISSEN (sleutel echt weg: IFC en solver lezen op aanwezigheid). */
export type ClearableProjectKey = 'statusDate' | 'progressMode' | 'defaultWorkRule';

export interface ProjectPatchOutcome {
  /** Het aantal wortel-ankers dat de projectstart-vloer klemde. */
  clampedAnchors: number;
  /** Taken die door een nieuwe projectstandaard (vast werk) de urenmaat kregen. Niet leeg ⇒ de
   *  aanroeper behandelt de bewerking als planning (geval 11c): modus uit, planning verouderd. */
  measureChangedTaskIds: string[];
}

/**
 * Merge `updates` in het project (en wis de sleutels in `clear`), bump `modifiedAt`, zet bij een
 * nieuwe projectstandaard voor het taaktype de taken om die hem erven (`settleDefaultWorkRuleSwitch`)
 * en klem bij een NIEUWE `startDate` de verouderde wortel-ankers die nu vóór het projectbegin liggen.
 *
 * De projectstart-vloer hoort bij het bewerkmoment, niet in de solver (CPMSolver is MSP-getrouw — een
 * ingelezen anker wordt nooit door de vloer overruled, zie `CPMSolver.ownAnchor`). Alléén hier
 * bestaat het intentiesignaal "de gebruiker heeft zojuist zelf de projectstart verzet": in de
 * solver hebben een VEROUDERD in-app-anker en een aantoonbaar-eerder MS-Project-anker (uit een
 * `.mpp`-import) exact dezelfde vorm. GEEN Δ-verschuiving van de rest van de planning — dat is
 * `moveProject`. Geïmporteerde bestanden raken dit pad niet (ze hydrateren via het
 * documentcontract). De klem-mechaniek zelf zit in `clampProjectStartAnchors`.
 */
export function applyProjectPatch(
  s: DefaultWorkRuleSwitchState & { sequences: Sequence[] },
  updates: Partial<Project>,
  clear: readonly ClearableProjectKey[] = [],
): ProjectPatchOutcome {
  const prevStartDate = s.project.startDate;
  const previousDefault = s.project.defaultWorkRule;
  Object.assign(s.project, updates);
  for (const key of clear) delete s.project[key];
  s.project.modifiedAt = new Date().toISOString();
  // Een nieuwe projectstandaard voor het taaktype geldt meteen voor elke taak die hem erft.
  const measureChangedTaskIds = settleDefaultWorkRuleSwitch(s, previousDefault);
  const clampedAnchors = typeof updates.startDate !== 'string' ? 0 : clampProjectStartAnchors({
    tasks: s.tasks, sequences: s.sequences, calendar: s.calendar, calendars: s.calendars,
    prevStartDate, nextStartDate: updates.startDate,
  });
  return { clampedAnchors, measureChangedTaskIds };
}
