// De projectstart-bewerkbescherming als ÉÉN gedeelde, pure functie.
//
// Er zijn TWEE bewerkmomenten die `project.startDate` kunnen verzetten: de UI
// (`projectSlice.setProject`) en de AI-assistent (`mcpTransaction.ts`'s `draft.setProject`,
// aangeroepen door de `planner_update_project`-MCP-tool). Beide horen zich identiek te gedragen;
// vandaar één functie, aangeroepen door beide.
//
// SEMANTIEK: uitsluitend bij een ECHTE verzetting naar
// een LATERE `startDate` klemmen wortel-taken (geen voorganger, geen forward-constraint, geen
// hammock) die vóór de nieuwe datum staan vooruit naar de eerstvolgende werk-instant OP/NÁ die
// datum, IN DE ENGINE WAARIN DE SOLVER DIE TAAK REKENT. Beide stappen zijn de solver-functies zelf,
// geen kopie:
//   - de engine-keuze is `engineForTaskCalendar` (CPMSolver.ts), dezelfde functie achter
//     `CPMSolver.calendarFor`: taak-eigen kalender via `resolveCalendar`, en voor een URENtaak de
//     effectieve uurbanden van die kalender. Op een scalaire kalender zonder `workTime` (zoals de
//     standaardprojectkalender) staat de engine voor een urentaak dus in uurmodus en landt het
//     anker op het eerste werkmoment (bv. 07:00); een dagtaak op diezelfde kalender krijgt een kale
//     datum. Een engine op de ruwe kalender zou een urentaak op middernacht (`T00:00`) zetten;
//   - de snap is `snapWorkInstantOnOrAfter`, dezelfde als `CPMSolver.ownAnchor`/`rootFloor` (een
//     kale datumstring zonder kalender-snap landt op middernacht i.p.v. de eerste werkband).
// `scheduleFinish` schuift consistent mee (duurbehoudend, klokbehoudend: `shiftIso` met het
// kalenderdag-verschil tussen oude en nieuwe start — zelfde mechaniek als
// `moveProject`/`shiftTask`).
import type { Task, TaskConstraint } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { engineForTaskCalendar, snapWorkInstantOnOrAfter } from './CPMSolver';
import { shiftIso } from '../moveProject';
import { parseDate, parseInstant, formatInstant, diffDays, type DateMode } from '@/utils/dateUtils';

/**
 * Heeft `c` een FORWARD-effect in de solver? Alleen SNET/MSO/FNET/MFO mét datum leveren een
 * ondergrens op in `CPMSolver.forwardBoundOf` — ASAP/ALAP (per definitie dateless) hebben er GEEN,
 * dus `{ type: 'ASAP' }` mag de klem niet blokkeren. Zelfde vraag, zelfde antwoord als de solver.
 */
function hasForwardConstraint(c: TaskConstraint | undefined): boolean {
  return !!c && !!c.date && (c.type === 'SNET' || c.type === 'MSO' || c.type === 'FNET' || c.type === 'MFO');
}

export interface ClampProjectStartAnchorsInput {
  /** Muteert de elementen IN PLACE (Immer-draft-verdraagzaam, `applyCpmResult`-patroon). */
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  prevStartDate: string;
  nextStartDate: string;
}

/**
 * Klem wortel-ankers die vóór `nextStartDate` staan vooruit naar die datum — uitsluitend als
 * `nextStartDate` aantoonbaar LATER is dan `prevStartDate` (een gelijke, eerdere, of onparseerbare
 * datum ⇒ 0, volledige no-op, geen mutatie). Levert het aantal geklemde taken.
 */
export function clampProjectStartAnchors(input: ClampProjectStartAnchorsInput): number {
  const nextRaw = parseDate(input.nextStartDate);
  const prevRaw = parseDate(input.prevStartDate);
  if (isNaN(nextRaw.getTime()) || isNaN(prevRaw.getTime())) return 0;
  if (nextRaw.getTime() <= prevRaw.getTime()) return 0; // dag-granulaire vergelijking, geen rauwe string

  const hasPredecessor = new Set(input.sequences.map((seq) => seq.successorId));
  // Eén cache per klem-aanroep; de sleutel (kalender-id + uur-/dagonderscheid) komt uit
  // `engineForTaskCalendar`, dus een uur- en een dagtaak op dezelfde kalender delen geen engine.
  const engineCache = new Map<string, CalendarEngine>();

  let clamped = 0;
  for (const t of input.tasks) {
    if (isSummaryTask(t)) continue;               // alleen bladtaken (CPMSolver-precedent)
    if (t.isHammock) continue;                     // de solver negeert een hammock-anker toch
    if (hasPredecessor.has(t.id)) continue;         // heeft een voorganger — geen wortel-anker
    if (hasForwardConstraint(t.constraint)) continue;  // expliciete forward-constraint wint
    if (hasForwardConstraint(t.constraint2)) continue;

    const eng = engineForTaskCalendar(engineCache, resolveCalendar(t.calendarId, input.calendars, input.calendar), t);
    const mode: DateMode = eng.isHourMode ? 'hour' : 'day';
    // Vergelijk GEPARSEERDE instants, niet rauwe strings — een datetime-anker op de
    // projectstartdag zelf ("2026-08-15T08:00") is lexicografisch "groter" dan het rauwe
    // date-only `startDate` ("2026-08-15") maar hoort NIET geklemd te worden.
    const own = eng.isHourMode ? parseInstant(t.time.scheduleStart) : parseDate(t.time.scheduleStart);
    if (isNaN(own.getTime())) continue; // onparseerbaar anker (corrupte import) ⇒ met rust laten
    const floor = snapWorkInstantOnOrAfter(eng, nextRaw); // uurmodus snapt naar de werk-band
    if (own.getTime() >= floor.getTime()) continue;

    const newAnchorIso = formatInstant(floor, mode);
    const deltaDays = diffDays(t.time.scheduleStart, newAnchorIso);
    t.time.scheduleStart = newAnchorIso;
    // scheduleFinish schuift consistent mee — anders blijft finish<start staan en schrijft
    // een export die vóór de eerstvolgende runCPM gebeurt die inconsistentie stil weg.
    t.time.scheduleFinish = shiftIso(t.time.scheduleFinish, deltaDays);
    clamped++;
  }
  return clamped;
}
