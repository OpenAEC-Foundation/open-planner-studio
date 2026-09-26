// De kern van "projectvelden wijzigen", gedeeld door `projectSlice.setProject` (UI) en de MCP-draft
// `setProject` (AI-assistent): die twee moeten zich bij hetzelfde bewerkmoment identiek gedragen.
// Wat per pad verschilt blijft bij de aanroeper: de no-op-guard en de undo-snapshot (UI),
// `isDirty`/`scheduleStale` en wat er met het aantal geklemde ankers gebeurt (UI: herberekenen +
// melding; MCP: in het tool-resultaat).
import type { Project } from '@/types/project';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { clampProjectStartAnchors } from '@/engine/scheduler/projectStartAnchorClamp';

/**
 * Merge `updates` in het project, bump `modifiedAt` en klem bij een NIEUWE `startDate` de verouderde
 * wortel-ankers die nu vóór het projectbegin liggen. Retourneert het aantal geklemde ankers.
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
  s: { project: Project; tasks: Task[]; sequences: Sequence[]; calendar: WorkCalendar; calendars: WorkCalendar[] },
  updates: Partial<Project>,
): number {
  const prevStartDate = s.project.startDate;
  Object.assign(s.project, updates);
  s.project.modifiedAt = new Date().toISOString();
  if (typeof updates.startDate !== 'string') return 0;
  return clampProjectStartAnchors({
    tasks: s.tasks, sequences: s.sequences, calendar: s.calendar, calendars: s.calendars,
    prevStartDate, nextStartDate: updates.startDate,
  });
}
