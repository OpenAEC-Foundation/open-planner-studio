// T7b (plan-§9/O2-vervolg, orkestratorbesluit 2026-08-15 — optie B) + T7-review-fixronde (H1/H3/
// L1/L2/M4): de projectstart-bewerkbescherming als ÉÉN gedeelde, pure functie.
//
// WAAROM DEZE MODULE BESTAAT (H1). Er zijn TWEE bewerkmomenten die `project.startDate` kunnen
// verzetten: de UI (`projectSlice.setProject`) en de AI-assistent (`mcpTransaction.ts`'s
// `draft.setProject`, aangeroepen door de `planner_update_project`-MCP-tool). De review (H1) vond
// dat de tweede alleen `Object.assign` deed — géén klem, géén melding, terwijl de tool-beschrijving
// wél de klem beloofde. Beide bewerkmomenten horen zich identiek te gedragen; vandaar één functie
// hier, aangeroepen door beide, i.p.v. twee implementaties die stil uit elkaar kunnen lopen.
//
// SEMANTIEK (ongewijzigd t.o.v. het orkestratorbesluit): uitsluitend bij een ECHTE verzetting naar
// een LATERE `startDate` klemmen wortel-taken (geen voorganger, geen forward-constraint, geen
// hammock) die vóór de nieuwe datum staan vooruit naar de eerstvolgende werk-instant OP/NÁ die
// datum, IN DE TAAK-EIGEN KALENDER — exact `CPMSolver.ownAnchor`/`rootFloor`'s eigen snap
// (`snapWorkInstantOnOrAfter`, hergebruikt, geen tweede implementatie — dat was de bron van de
// H3a-middernacht-bug: een kale datumstring zonder kalender-snap landde ná de eerstvolgende
// `runCPM` op middernacht i.p.v. de eerste werkband). `scheduleFinish` schuift consistent mee
// (duurbehoudend, klokbehoudend: `shiftIso` met het kalenderdag-verschil tussen oude en nieuwe
// start — zelfde mechaniek als `moveProject`/`shiftTask`, H3b).
import type { Task, TaskConstraint } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { snapWorkInstantOnOrAfter } from './CPMSolver';
import { shiftIso } from '../moveProject';
import { parseDate, parseInstant, formatInstant, diffDays, type DateMode } from '@/utils/dateUtils';

/**
 * Heeft `c` een FORWARD-effect in de solver (L1)? Alleen SNET/MSO/FNET/MFO mét datum leveren een
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
  if (nextRaw.getTime() <= prevRaw.getTime()) return 0; // M4: dag-granulaire vergelijking, geen rauwe string

  const hasPredecessor = new Set(input.sequences.map((seq) => seq.successorId));
  const engineCache = new Map<string, CalendarEngine>();
  const engineFor = (calId: string | undefined): CalendarEngine => {
    const key = calId ?? '';
    let eng = engineCache.get(key);
    if (!eng) {
      eng = new CalendarEngine(resolveCalendar(calId, input.calendars, input.calendar));
      engineCache.set(key, eng);
    }
    return eng;
  };

  let clamped = 0;
  for (const t of input.tasks) {
    if (t.childIds.length > 0) continue;          // alleen bladtaken (CPMSolver-precedent)
    if (t.isHammock) continue;                     // L2: de solver negeert een hammock-anker toch
    if (hasPredecessor.has(t.id)) continue;         // heeft een voorganger — geen wortel-anker
    if (hasForwardConstraint(t.constraint)) continue;  // L1: expliciete forward-constraint wint
    if (hasForwardConstraint(t.constraint2)) continue;

    const eng = engineFor(t.calendarId);
    const mode: DateMode = eng.isHourMode ? 'hour' : 'day';
    // M4: vergelijk GEPARSEERDE instants, niet rauwe strings — een datetime-anker op de
    // projectstartdag zelf ("2026-08-15T08:00") is lexicografisch "groter" dan het rauwe
    // date-only `startDate` ("2026-08-15") maar hoort NIET geklemd te worden.
    const own = eng.isHourMode ? parseInstant(t.time.scheduleStart) : parseDate(t.time.scheduleStart);
    if (isNaN(own.getTime())) continue; // onparseerbaar anker (corrupte import) ⇒ met rust laten
    const floor = snapWorkInstantOnOrAfter(eng, nextRaw); // H3a: uurmodus snapt naar de werk-band
    if (own.getTime() >= floor.getTime()) continue;

    const newAnchorIso = formatInstant(floor, mode);
    const deltaDays = diffDays(t.time.scheduleStart, newAnchorIso);
    t.time.scheduleStart = newAnchorIso;
    // H3b: scheduleFinish schuift consistent mee — anders blijft finish<start staan en schrijft
    // een export die vóór de eerstvolgende runCPM gebeurt die inconsistentie stil weg.
    t.time.scheduleFinish = shiftIso(t.time.scheduleFinish, deltaDays);
    clamped++;
  }
  return clamped;
}
