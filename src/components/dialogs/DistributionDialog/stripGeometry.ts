// B1c-plan4 taak 1 — de PURE balkgeometrie van één projectrij in de verdeeldialoog (spec §4).
//
// WAAROM DIT EEN EIGEN MODULE IS. De balk is sinds dit herontwerp de BEDIENING, niet een plaatje:
// hij toont per werkdag een blokje, maakt een ingevoegde pauze zichtbaar, tekent hoeveel ruimte je
// toestond maar niet nodig bleek, en meet met een meetlat af hoeveel van de verschuiving nog binnen
// de eigen speling valt. Dat is genoeg regelwerk om buiten React te horen: hier is het headless
// toetsbaar (`tests/planning/check-distribution-strip-geometry.ts`) en kan `PhaseStrip.tsx` zich tot
// tekenen en gebaren beperken.
//
// PUUR, GEEN DOMEINTYPES. De werkdagvraag komt als predicaat binnen (`isWorkingDay`), niet als
// `WorkCalendar` — zo hoeft de check geen kalendermotor op te tuigen en kan de aanroeper gewoon de
// `CalendarEngine` van het betreffende document doorgeven. Dezelfde keuze als `chartGeometry.ts`, dat
// de capaciteit als `capacityOn`-functie aanneemt.
//
// DE MEETLAT MEET DE FASE, NIET HET PROJECT (KEUZE VAN DIT PLAN, zie het plan bij taak 1). Grijs
// gestippeld = de BESCHIKBARE speling vanaf het oorspronkelijke fase-einde; massief rood = alles
// daarvoorbij. Dat is letterlijk `.pfl`/`.pover` uit het prototype, en het klopt per constructie met
// `endShiftWorkdays`: zolang dat 0 is, blijft het fase-einde binnen de grijze meetlat en is er geen
// rood.
//
// EEN WEEKEND IS GEEN PAUZEDAG. De as loopt op KALENDERdagen, dus zonder de werkdagtoets zou elke
// balk vol arcering staan en zou een echte, ingevoegde onderbreking niet meer opvallen — precies het
// gebrek dat de gebruikstest van 2026-09-12 aanwees ("pauzes waren onzichtbaar").
import { AXIS, type OccupancyAxis } from '@/components/panels/occupancyAxis';
import { parseDate } from '@/utils/dateUtils';

/** De maatvoering van één rij, letterlijk uit het prototype (tabblad 4, `.prow`/`.ptrack.tall`).
 *  Eén definitie, gedeeld door `PhaseStrip.tsx` (de rij zelf) en `DistributionDialog.tsx` (de
 *  uitlijning van het histogram eronder) — anders lopen balk en histogram alsnog uit elkaar. */
export const STRIP = {
  /** `.plabel` — kleurstip, projectnaam, "speling N dagen". */
  labelWidth: 150,
  /** `.pend` — de uitkomstpil met "max <datum> · benut N". */
  endWidth: 132,
  /** `.prow { gap: 10px }`. */
  gap: 10,
  /** `.ptrack.tall { height: 32px }`. */
  trackHeight: 32,
  /** `.ptrack.tall .pblk { top: 5px; height: 15px }`. */
  blockHeight: 15,
  blockTop: 5,
  /** `.pfl`/`.pover { bottom: 3px; height: 3px }`. */
  measureHeight: 3,
  measureBottom: 3,
  /** `.phandle { top: 1px; height: 30px; width: 15px; margin-left: -7px }`. */
  handleWidth: 15,
  handleHeight: 30,
  handleTop: 1,
} as const;

export type StripBlockKind = 'work' | 'pause';

/** Eén dagblokje in de track. `w` is altijd één dagbreedte; de 1 px witte scheiding rechts is een
 *  tekenkeuze van de component, geen geometrie. */
export interface StripBlock {
  iso: string;
  x: number;
  w: number;
  kind: StripBlockKind;
}

/** Een aaneengesloten horizontale band (vaste last, gestippelde rest, meetlat). */
export interface StripBand {
  x: number;
  w: number;
}

export interface StripGeometry {
  blocks: StripBlock[];
  /** De vaste last van gepinde/#63-documenten, samengevoegd tot aaneengesloten banden. */
  fixedBands: StripBand[];
  /** "Toegestaan maar niet benut": van het fase-einde tot de handle. `null` ⇒ niets over. */
  freeBox: StripBand | null;
  /** De beschikbare eigen speling, vanaf het OORSPRONKELIJKE fase-einde. */
  slackBar: StripBand | null;
  /** Alles voorbij die speling — dus echte einddatum-verschuiving. */
  overrunBar: StripBand | null;
  /** x van het MIDDEN van de handle. */
  handleX: number;
  /** x van de rechterrand van de laatste geboekte dag. */
  phaseEndX: number;
  /** De kalenderdag waarop het plafond uitkomt; `null` bij een onbegrensd plafond. */
  ceilingEndIso: string | null;
  /** x-posities van de 1 px weekscheidingen (elke maandag) … */
  weekLines: number[];
  /** … en van de donkerdere maandlijnen (elke eerste van de maand). */
  monthLines: number[];
}

export interface StripGeometryInput {
  axis: OccupancyAxis;
  /** `DistributionProposal.bookingByDay[docId]` — de stand VÓÓR de verdeling. Levert het
   *  oorspronkelijke fase-einde, het ankerpunt van de meetlat. */
  beforeLoadByDay: Record<string, number>;
  /** `DistributionProposal.afterLoadByDay[docId]` — de stand NÁ de verdeling; dít wordt getekend. */
  loadByDay: Record<string, number>;
  /** `DistributionProposal.fixedLoadByDay`, met de eigen boeking er al afgetrokken wanneer dit
   *  document zélf gepind is (dat doet de aanroeper — een gepind document zit in de vaste last). */
  fixedLoadByDay: Record<string, number>;
  isWorkingDay: (iso: string) => boolean;
  /** De eigen speling in hele werkdagen (`documentFloatOn`, geklemd op ≥ 0). */
  slackWorkdays: number;
  /** Het ingestelde plafond in werkdagen; `null` = onbegrensd. */
  ceilingWorkdays: number | null;
  /** De benutte uitloop (`DistributionDocResult.endShiftWorkdays`). */
  endShiftWorkdays: number;
}

/** Alle kalenderdagen van de as met hun x, in tekenvolgorde. */
function axisDayXs(axis: OccupancyAxis): { iso: string; x: number }[] {
  const out: { iso: string; x: number }[] = [];
  for (const segment of axis.segments) {
    for (let i = 0; i < segment.days.length; i++) {
      out.push({ iso: segment.days[i], x: segment.x0 + i * axis.dayWidth });
    }
  }
  return out;
}

/** De laatste dag met een boeking, of `null` wanneer er niets geboekt is. */
function lastBookedDay(loadByDay: Record<string, number>): string | null {
  let last: string | null = null;
  for (const [iso, units] of Object.entries(loadByDay)) {
    if (units > 0 && (last === null || iso > last)) last = iso;
  }
  return last;
}

/** De eerste dag met een boeking, of `null`. */
function firstBookedDay(loadByDay: Record<string, number>): string | null {
  let first: string | null = null;
  for (const [iso, units] of Object.entries(loadByDay)) {
    if (units > 0 && (first === null || iso < first)) first = iso;
  }
  return first;
}

/**
 * Loop vanaf (exclusief) `fromIso` `workdays` WERKdagen vooruit over de as en geef de dag waarop je
 * uitkomt plus de x van zijn rechterrand. Loopt de as op vóór het aantal bereikt is, dan levert hij
 * het aseinde — de handle mag de as nooit verlaten.
 */
function advanceWorkdays(
  axis: OccupancyAxis,
  days: { iso: string; x: number }[],
  fromIso: string | null,
  workdays: number,
  isWorkingDay: (iso: string) => boolean,
): { iso: string | null; xEnd: number } {
  const startX = fromIso === null
    ? AXIS.padLeft
    : (axis.xOf(fromIso) ?? AXIS.padLeft) + axis.dayWidth;
  if (workdays <= 0) return { iso: fromIso, xEnd: startX };
  let remaining = workdays;
  for (const day of days) {
    if (fromIso !== null && day.iso <= fromIso) continue;
    if (!isWorkingDay(day.iso)) continue;
    remaining -= 1;
    if (remaining === 0) return { iso: day.iso, xEnd: day.x + axis.dayWidth };
  }
  return { iso: null, xEnd: axis.width - AXIS.padRight };
}

/** De volledige geometrie van één rij. Zie het moduleblok voor de vier lagen. */
export function buildStripGeometry(input: StripGeometryInput): StripGeometry {
  const {
    axis, beforeLoadByDay, loadByDay, fixedLoadByDay, isWorkingDay,
    slackWorkdays, ceilingWorkdays, endShiftWorkdays,
  } = input;
  const dayWidth = axis.dayWidth;
  const days = axisDayXs(axis);
  const trackRight = axis.width - AXIS.padRight;

  // (1) De dagblokjes van de NA-stand, binnen de fasespanne.
  const first = firstBookedDay(loadByDay);
  const last = lastBookedDay(loadByDay);
  const blocks: StripBlock[] = [];
  if (first !== null && last !== null) {
    for (const day of days) {
      if (day.iso < first || day.iso > last) continue;
      const booked = (loadByDay[day.iso] ?? 0) > 0;
      if (booked) blocks.push({ iso: day.iso, x: day.x, w: dayWidth, kind: 'work' });
      else if (isWorkingDay(day.iso)) blocks.push({ iso: day.iso, x: day.x, w: dayWidth, kind: 'pause' });
      // Een niet-werkdag zonder boeking is geen pauze maar gewoon weekend: niets tekenen.
    }
  }
  const phaseEndX = last === null ? AXIS.padLeft : (axis.xOf(last) ?? AXIS.padLeft) + dayWidth;

  // (2) De vaste last, samengevoegd tot aaneengesloten banden.
  const fixedBands: StripBand[] = [];
  let open: StripBand | null = null;
  for (const day of days) {
    if ((fixedLoadByDay[day.iso] ?? 0) > 0) {
      if (open !== null && Math.abs(open.x + open.w - day.x) < 0.001) open.w += dayWidth;
      else { open = { x: day.x, w: dayWidth }; fixedBands.push(open); }
    } else {
      open = null;
    }
  }

  // (3) De meetlat, verankerd aan het OORSPRONKELIJKE fase-einde.
  const origEnd = lastBookedDay(beforeLoadByDay);
  const origEndX = origEnd === null ? AXIS.padLeft : (axis.xOf(origEnd) ?? AXIS.padLeft) + dayWidth;
  const slack = advanceWorkdays(axis, days, origEnd, Math.max(0, Math.floor(slackWorkdays)), isWorkingDay);
  const slackEndX = Math.min(trackRight, slack.xEnd);
  const slackBar = slackEndX > origEndX ? { x: origEndX, w: slackEndX - origEndX } : null;
  const overrunBar = phaseEndX > slackEndX ? { x: slackEndX, w: phaseEndX - slackEndX } : null;

  // (4) Het plafond: de handle en de gestippelde rest. Onbegrensd ⇒ aan het einde van de as (§5).
  let handleX: number;
  let ceilingEndIso: string | null;
  if (ceilingWorkdays === null) {
    handleX = trackRight;
    ceilingEndIso = null;
  } else {
    // Het plafond is een uitloop van de EINDDATUM, en `endShiftWorkdays` zegt hoeveel daarvan al
    // benut is. Wat er dan nog openstaat — `ceilingWorkdays - endShiftWorkdays` werkdagen — ligt
    // per definitie ACHTER het huidige fase-einde: dat is precies de "toegestaan maar niet
    // benut"-doos van spec §4 ("van het nieuwe fase-einde tot de handle-stand") en het maakt de
    // aflezing van het uitkomstlabel ("max <datum> · benut N") kloppend. Het oorspronkelijke einde
    // is hier bewust NIET het anker: een fase kan binnen haar eigen speling opschuiven zonder de
    // einddatum te raken (`endShiftWorkdays` blijft dan 0), en met een anker op het oude einde zou
    // de vrije ruimte dan stilzwijgend met die verschuiving krimpen terwijl er niets van de uitloop
    // verbruikt is.
    const remaining = Math.max(0, Math.floor(ceilingWorkdays) - Math.max(0, Math.floor(endShiftWorkdays)));
    const ceiling = advanceWorkdays(axis, days, last, remaining, isWorkingDay);
    handleX = Math.max(AXIS.padLeft, Math.min(trackRight, ceiling.xEnd));
    ceilingEndIso = ceiling.iso;
  }
  const freeBox = handleX > phaseEndX ? { x: phaseEndX, w: handleX - phaseEndX } : null;

  // (5) Week- en maandlijnen.
  const weekLines: number[] = [];
  const monthLines: number[] = [];
  for (const day of days) {
    if (day.iso.slice(8) === '01') monthLines.push(day.x);
    else if (parseDate(day.iso).getDay() === 1) weekLines.push(day.x);
  }

  return {
    blocks, fixedBands, freeBox, slackBar, overrunBar,
    handleX, phaseEndX, ceilingEndIso, weekLines, monthLines,
  };
}

/** De grootste einddatum-verschuiving over de deelnemers — de UITSCHIETER, niet de som (§2.2). */
export function maxEndShiftWorkdays(docs: { endShiftWorkdays: number }[]): number {
  return docs.reduce((max, doc) => Math.max(max, doc.endShiftWorkdays), 0);
}

/**
 * Het verschil-prijskaartje van "Onderbrekingen toestaan" (§2.2): hoeveel werkdagen de aan-stand
 * bespaart ten opzichte van de uit-stand. Geklemd op 0 — onderbreken kán in theorie duurder
 * uitvallen, en dan is "bespaart niets" het eerlijke antwoord.
 */
export function savingsWorkdays(offMax: number, onMax: number): number {
  return Math.max(0, offMax - onMax);
}
