// contourEngine.ts — de contour-engine (etappe "contour-engine", 2026-09; de vervolgetappe die
// de nul-afwijkingen-etappe en de taaktypes-spec allebei aankondigden — zie
// `docs/superpowers/specs/2026-08-18-spec-taaktypes-effort-driven.md` §"Wat er onder de motorkap
// nodig is", punt 3, en `docs/superpowers/plans/2026-08-17-plan-mpp-nul-afwijkingen.md` §10).
//
// WAT DIT IS. Eén pure rekenmodule die de werkverdeling-per-dag van een toewijzing als DATA
// behandelt in plaats van als formule. Tot deze etappe was de dagbelasting van een resource
// uitsluitend een formule (`ResourceLoad.ts`'s `distributeUnits`: load × duur, uitgesmeerd volgens
// een curvevorm) — de rauwe contourperiodes die de `.mpp`-lezer sinds Z14b bewaart
// (`Task.timephasedContours`) werden nergens gelezen, en een P6-resourcecurve werd tot een van
// zes vaste vormen versimpeld. Deze module leest die data wél en levert er drie dingen op:
//   1. `periodsToSlotWork` — een contourprofiel (periodes op de cumulatieve taak-as) → werkminuten
//      per dagslot. Dat is de voeding voor het histogram, de overallocatie-detectie, de
//      nivelleerder en het bezettingsoverzicht (via `ResourceLoad.ts`'s `assignmentDayUnits`).
//   2. De 21-punts contourtabellen van MS Project (en P6's `<ResourceCurve>`-vorm, die dezelfde
//      21 waarden draagt) — zodat een curve exact als data kan worden gematerialiseerd, en een
//      P6-curve die géén OPS-vorm is (`ResourceAssignment.curveValues`) toch precies wordt
//      uitgerekend in plaats van tot "uniform" te vervallen.
//   3. `rescaleContourForDuration` — de herschalingsregel bij een duurwijziging: een bewerking op
//      een gecontourde taak neemt de verdeling mee (spec-eis: "de etappe is pas af als een bewerking
//      op een gecontourde taak de verdeling meeneemt").
//
// DE AS. Alle periodes leven op DEZELFDE cumulatieve werkminuten-as als `TaskSplitGap`
// (`task.ts`'s docblok bij `TaskSplitGap`/`TimephasedContourPeriod` — lees die eerst): 0 = taakstart,
// de as loopt door werktijd van de TAAKkalender en telt ook periodes zonder werk (gaten) mee. Een
// "dagslot" is `hoursPerDay × 60` asminuten (dezelfde `mpd`-conventie als `splitWalk.ts`'s
// `splitDayPattern`), dus slot k dekt `[k·mpd, (k+1)·mpd)`. In uur-modus met ongelijk lange
// werkdagen is dat een benadering (een 4-uursvrijdag telt als een half slot) — bewust dezelfde
// benadering die `enumerateTaskWorkDays` al maakt, zodat de dagen waarop deze module werk legt
// exact de dagen zijn waarop de lastlezers boeken. Eén as, één slotdefinitie, geen tweede.
//
// WAT DIT NIET IS. Geen solverstap: de CPM-datums van een geïmporteerde contourtaak komen uit
// laag 3/4 van de Z8-beslistabel (`CPMSolver.ts`'s `timephasedFinish`) en uit `splitGaps`; deze
// module raakt geen enkele taakdatum. Dat is een harde ontwerpvoorwaarde uit de taaktypes-spec
// ("taaktype-semantiek werkt op bewerkingen, nooit op het herberekenen van een vers geopend
// bestand, anders verschuiven de gepinde importdatums") — de fidelity-poort (`check-mpp-fidelity.ts`)
// bewaakt dat mechanisch.
//
// AFRONDING. `distributeUnits` rondt bij een geheel tempo af op hele eenheden per dag om een
// FORMULE-artefact te onderdrukken (issue #21 punt 7). Opgeslagen dagwaarden uit een contour zijn
// bedoelde data, geen rekenresidu, en worden hier NOOIT afgerond (spec, "Eén grensregel").
//
// Pure module: geen store, geen kalender-engine-import (de aanroeper levert `mpd`), geen I/O.
import type { TaskSplitGap, TaskTimephasedContour, TimephasedContourPeriod, MspTaskType } from '@/types/task';
import type { ResourceAssignment, ResourceCurve } from '@/types/resource';
import { splitDayPattern } from '@/engine/scheduler/splitWalk';

// ── 21-punts contourtabellen ────────────────────────────────────────────────────────────────────
//
// Bron: MPXJ `org.mpxj.WorkContour` (LGPL-2.1, github.com/joniles/mpxj) — de vaste MS Project-
// contouren als 21 waarden: index 0 is altijd 0, de indices 1..20 zijn het PERCENTAGE van het
// totale werk dat in de k-de 5%-slice van de duur valt (de som van 1..20 is ~100). P6 schrijft zijn
// `<ResourceCurve>`-objecten in exact dezelfde vorm (`Value0`..`Value100`, MPXJ
// `XmlContextReader.processWorkContour`), dus deze ene tabelvorm dekt beide pakketten.
// De indices 3 (DOUBLE_PEAK) en 7 (TURTLE) van MSPDI's `WorkContour`-enum hebben geen OPS-`ResourceCurve`-
// lid (bewust: het enum is op acht plekken in de UI/MCP/IFC gedupliceerd — zie docs/TODO.md);
// ze zijn hier wél aanwezig als vorm zodat een MSPDI-/P6-bestand ze exact als `curveValues` kan
// dragen in plaats van tot uniform te vervallen.
export type ContourShape =
  | 'FLAT' | 'BACK_LOADED' | 'FRONT_LOADED' | 'DOUBLE_PEAK' | 'EARLY_PEAK' | 'LATE_PEAK' | 'BELL' | 'TURTLE';

export const CONTOUR_SHAPE_VALUES: Record<ContourShape, readonly number[]> = {
  FLAT: [0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  BACK_LOADED: [0, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
  FRONT_LOADED: [0, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5],
  DOUBLE_PEAK: [0, 1.3, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5, 2.5, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5],
  EARLY_PEAK: [0, 1.2, 2.5, 3.8, 5, 7.5, 10.1, 10.1, 10.1, 8.8, 7.5, 6.3, 5.0, 5.0, 5.0, 3.8, 2.5, 2.0, 1.5, 1.3, 1.0],
  LATE_PEAK: [0, 1.0, 1.3, 1.5, 2.0, 2.5, 3.8, 5.0, 5.0, 5.0, 6.3, 7.5, 8.8, 10.1, 10.1, 10.1, 7.5, 5, 3.8, 2.5, 1.2],
  BELL: [0, 0.5, 0.5, 1.5, 1.5, 4.0, 4.0, 7.5, 7.5, 11.5, 11.5, 11.5, 11.5, 7.5, 7.5, 4, 4, 1.5, 1.5, 0.5, 0.5],
  TURTLE: [0, 1.0, 1.0, 3.5, 3.5, 5.5, 5.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 5.5, 5.5, 3.5, 3.5, 1.0, 1.0],
};

/** MSPDI `<WorkContour>`-code per vorm (MPXJ `WorkContour.getUniqueID() − 1`; 8 = Contoured, geen vorm). */
export const CONTOUR_SHAPE_MSPDI_CODE: Record<ContourShape, number> = {
  FLAT: 0, BACK_LOADED: 1, FRONT_LOADED: 2, DOUBLE_PEAK: 3, EARLY_PEAK: 4, LATE_PEAK: 5, BELL: 6, TURTLE: 7,
};
export const MSPDI_WORKCONTOUR_CONTOURED = 8;

/** OPS-curve → tabelvorm. `UNIFORM` is FLAT. */
export const CURVE_TO_SHAPE: Record<ResourceCurve, ContourShape> = {
  UNIFORM: 'FLAT', FRONT_LOADED: 'FRONT_LOADED', BACK_LOADED: 'BACK_LOADED', BELL: 'BELL',
  EARLY_PEAK: 'EARLY_PEAK', LATE_PEAK: 'LATE_PEAK',
};

const SHAPE_TO_CURVE: Partial<Record<ContourShape, ResourceCurve>> = {
  FLAT: 'UNIFORM', FRONT_LOADED: 'FRONT_LOADED', BACK_LOADED: 'BACK_LOADED', BELL: 'BELL',
  EARLY_PEAK: 'EARLY_PEAK', LATE_PEAK: 'LATE_PEAK',
};

export const CURVE_VALUE_COUNT = 21;

/** Valideert een 21-waardenlijst (P6 `<ResourceCurve>`/`ResourceAssignment.curveValues`): precies
 *  21 eindige, niet-negatieve getallen met een positieve som over de indices 1..20. Geeft een
 *  verse, genormaliseerde kopie (index 0 op 0 gezet — MPXJ/P6 dragen daar altijd 0) of `null`. */
export function normalizeCurveValues(values: unknown): number[] | null {
  if (!Array.isArray(values) || values.length !== CURVE_VALUE_COUNT) return null;
  const out: number[] = [];
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    out.push(v);
  }
  out[0] = 0;
  const sum = out.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  return out;
}

/** Spiegelt MPXJ `WorkContour.isContourFlat`: index 0 is 0 en alle overige waarden zijn gelijk. */
export function isFlatCurveValues(values: readonly number[]): boolean {
  if (values.length !== CURVE_VALUE_COUNT || values[0] !== 0) return false;
  const first = values[1];
  for (let i = 2; i < values.length; i++) if (values[i] !== first) return false;
  return true;
}

/** Herkent een 21-waardenlijst als een van de OPS-curves (exacte tabelmatch met tolerantie 1e-6;
 *  een vlakke lijst met een andere constante dan 5 telt ook als UNIFORM — de dichtheid is
 *  immers gelijk). `undefined` ⇒ geen OPS-vorm (DOUBLE_PEAK/TURTLE of een eigen P6-curve). */
export function matchCurveValues(values: readonly number[]): ResourceCurve | undefined {
  if (values.length !== CURVE_VALUE_COUNT) return undefined;
  if (isFlatCurveValues(values)) return 'UNIFORM';
  for (const shape of Object.keys(CONTOUR_SHAPE_VALUES) as ContourShape[]) {
    const table = CONTOUR_SHAPE_VALUES[shape];
    let same = true;
    for (let i = 0; i < CURVE_VALUE_COUNT; i++) {
      if (Math.abs(table[i] - values[i]) > 1e-6) { same = false; break; }
    }
    if (same) return SHAPE_TO_CURVE[shape];
  }
  return undefined;
}

/** Herkent een 21-waardenlijst als een van de acht tabelvormen (ook DOUBLE_PEAK/TURTLE). */
export function matchContourShape(values: readonly number[]): ContourShape | undefined {
  if (values.length !== CURVE_VALUE_COUNT) return undefined;
  if (isFlatCurveValues(values)) return 'FLAT';
  for (const shape of Object.keys(CONTOUR_SHAPE_VALUES) as ContourShape[]) {
    const table = CONTOUR_SHAPE_VALUES[shape];
    let same = true;
    for (let i = 0; i < CURVE_VALUE_COUNT; i++) {
      if (Math.abs(table[i] - values[i]) > 1e-6) { same = false; break; }
    }
    if (same) return shape;
  }
  return undefined;
}

/**
 * Gewichten per slot (som exact 1) voor `slotCount` gelijke slots van de duur, uit een 21-punts-
 * tabel: de tabel is een stuksgewijs constante dichtheid over 20 slices van 5% van de duur; slot k
 * dekt `[k/N, (k+1)/N)` van de duur en krijgt de geïntegreerde dichtheid over dat interval. Zo
 * behoudt een korte taak (N < 20) de asymmetrie van de vorm (een FRONT_LOADED 2-daagse taak krijgt
 * 65/35, niet 50/50 — `distributeUnits`' lineaire interpolatie vervlakt daar juist, zie het
 * A7-commentaar aldaar; dat bestaande gedrag blijft ongewijzigd, dit is de DATA-route).
 */
export function slotWeightsFromValues(values: readonly number[], slotCount: number): number[] {
  if (!(slotCount > 0)) return [];
  const n = Math.ceil(slotCount);
  const density = values.slice(1, CURVE_VALUE_COUNT); // 20 slices
  const total = density.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return new Array<number>(n).fill(1 / n);
  const weights: number[] = [];
  const sliceWidth = 1 / density.length;
  for (let k = 0; k < n; k++) {
    const lo = k / n;
    const hi = (k + 1) / n;
    let acc = 0;
    for (let s = 0; s < density.length; s++) {
      const sLo = s * sliceWidth;
      const sHi = (s + 1) * sliceWidth;
      const overlap = Math.min(hi, sHi) - Math.max(lo, sLo);
      if (overlap > 0) acc += density[s] * (overlap / sliceWidth);
    }
    weights.push(acc / total);
  }
  // Exacte som 1 (drijvendekomma-residu op de laatste slot).
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum > 0 && Math.abs(sum - 1) > 1e-12) {
    const last = weights.length - 1;
    weights[last] += 1 - sum;
  }
  return weights;
}

// ── Periodes op de taak-as ──────────────────────────────────────────────────────────────────────

/** Defensieve filter (zelfde dreigingsmodel als `splitTotalSpanMinutes`: periodes kunnen via een
 *  handgemaakte IFC/MSPDI/P6 binnenkomen): niet-eindig, negatief of nul-lang wordt overgeslagen. */
function usablePeriods(periods: readonly TimephasedContourPeriod[]): TimephasedContourPeriod[] {
  return periods.filter((p) =>
    Number.isFinite(p.afterMinutes) && Number.isFinite(p.minutes) && Number.isFinite(p.workMinutes)
    && p.afterMinutes >= 0 && p.minutes > 0 && p.workMinutes >= 0);
}

/** Einde van de laatste periode op de as (inclusief gaten) — de asspanne van het profiel. 0 ⇒ leeg. */
export function periodsSpanMinutes(periods: readonly TimephasedContourPeriod[]): number {
  let end = 0;
  for (const p of usablePeriods(periods)) end = Math.max(end, p.afterMinutes + p.minutes);
  return end;
}

/** Som van het werk over alle bruikbare periodes (minuten). */
export function periodsWorkMinutes(periods: readonly TimephasedContourPeriod[]): number {
  let sum = 0;
  for (const p of usablePeriods(periods)) sum += p.workMinutes;
  return sum;
}

/** Aslengte die WERKT (periodes met werk), d.w.z. de spanne minus de gat-minuten. */
export function periodsWorkingSpanMinutes(periods: readonly TimephasedContourPeriod[]): number {
  let sum = 0;
  for (const p of usablePeriods(periods)) if (p.workMinutes > 0) sum += p.minutes;
  return sum;
}

/**
 * Contourprofiel → werkminuten per dagslot van `slotMinutes` asminuten. Het werk van een periode is
 * gelijkmatig over haar eigen lengte verdeeld (dat is ook MSP's/MPXJ's model: `amountPerHour` is
 * per periode constant); een periode die een slotgrens kruist wordt naar rato gesplitst. Lengte
 * van de uitkomst = `max(ceil(spanne / slotMinutes), minSlots)`; slots zonder werk zijn 0. De som
 * van de uitkomst is EXACT `periodsWorkMinutes` — een lastlezer verliest nooit stil werk.
 */
export function periodsToSlotWork(
  periods: readonly TimephasedContourPeriod[],
  slotMinutes: number,
  minSlots = 0,
): number[] {
  const mpd = Math.max(1, slotMinutes);
  const usable = usablePeriods(periods);
  const span = periodsSpanMinutes(usable);
  const slotCount = Math.max(Math.ceil(span / mpd - 1e-9), Math.max(0, Math.ceil(minSlots)));
  const out = new Array<number>(slotCount).fill(0);
  for (const p of usable) {
    if (p.workMinutes <= 0) continue;
    const start = p.afterMinutes;
    const end = p.afterMinutes + p.minutes;
    const first = Math.floor(start / mpd);
    const last = Math.min(slotCount - 1, Math.ceil(end / mpd) - 1);
    for (let k = first; k <= last; k++) {
      const overlap = Math.min(end, (k + 1) * mpd) - Math.max(start, k * mpd);
      if (overlap > 0) out[k] += p.workMinutes * (overlap / p.minutes);
    }
  }
  return out;
}

/**
 * Slotwerk UITGELIJND op de dagenlijst van `enumerateTaskWorkDays(gaps, …)` (splitWalk.ts): die
 * lijst bevat alleen WERKdagen (pauzedagen van `splitGaps` zijn eruit), dus een lastlezer die
 * `slotWork[i]` op `days[i]` boekt heeft een array nodig waaruit de gat-slots verwijderd zijn —
 * precies volgens hetzelfde blokpatroon (`splitDayPattern`) dat die enumeratie gebruikt, zodat
 * index i aan beide kanten dezelfde dag betekent. Werk dat toch in een gat-slot valt (een gat
 * dat niet op een hele dag rondt) wordt naar het eerstvolgende werkslot doorgeschoven, nooit
 * weggegooid. Geen `gaps` ⇒ identiek aan `periodsToSlotWork`.
 */
export function periodsToWorkDaySlots(
  periods: readonly TimephasedContourPeriod[],
  gaps: readonly TaskSplitGap[] | undefined,
  slotMinutes: number,
  minSlots = 0,
): number[] {
  const raw = periodsToSlotWork(periods, slotMinutes, 0);
  if (!gaps || gaps.length === 0) {
    while (raw.length < minSlots) raw.push(0);
    return raw;
  }
  const blocks = splitDayPattern([...gaps], slotMinutes, raw.length);
  const out: number[] = [];
  let pos = 0;
  let carry = 0;
  for (const b of blocks) {
    for (let i = 0; i < b.work && pos < raw.length; i++, pos++) {
      out.push(raw[pos] + carry);
      carry = 0;
    }
    for (let i = 0; i < b.gap && pos < raw.length; i++, pos++) carry += raw[pos];
  }
  // Restant voorbij het laatste blok (profiel langer dan de blokken dekken) — gewoon aanhangen.
  for (; pos < raw.length; pos++) { out.push(raw[pos] + carry); carry = 0; }
  if (carry > 0) {
    if (out.length > 0) out[out.length - 1] += carry; else out.push(carry);
  }
  while (out.length < minSlots) out.push(0);
  return out;
}

/** Inverse voor de exportkant: werkminuten per slot → aaneengesloten periodes (één per slot,
 *  ook 0-werk-slots — die zijn precies de gaten die `deriveSplitGapsFromPeriods` weer herkent). */
export function periodsFromSlotWork(
  slotWork: readonly number[],
  slotMinutes: number,
  kind: 'actual' | 'remaining' = 'remaining',
): TimephasedContourPeriod[] {
  const mpd = Math.max(1, slotMinutes);
  return slotWork.map((w, k) => ({ afterMinutes: k * mpd, minutes: mpd, workMinutes: Math.max(0, w), kind }));
}

// ── Contour ↔ toewijzing ─────────────────────────────────────────────────────────────────────────

/**
 * Welke contour hoort bij welke toewijzing van de taak. Regel: `contour.resourceId` (het
 * OPS-resource-id, gezet door elke lezer sinds deze etappe) matcht `assignment.resourceId`, in
 * volgorde en elke contour hooguit één keer (twee toewijzingen van dezelfde resource op één taak
 * krijgen zo elk hun eigen contour). Terugval voor oudere documenten zonder `resourceId` (Z14b-
 * bestanden dragen alleen MSP's `resourceUid`): precies één contour én precies één toewijzing op
 * de taak ⇒ die horen bij elkaar. Anders `undefined` — de toewijzing valt terug op de formule.
 */
export function matchContoursToAssignments(
  contours: readonly TaskTimephasedContour[] | undefined,
  assignments: readonly ResourceAssignment[],
): Map<string, TaskTimephasedContour> {
  const out = new Map<string, TaskTimephasedContour>();
  if (!contours || contours.length === 0 || assignments.length === 0) return out;
  const used = new Set<number>();
  for (const a of assignments) {
    const idx = contours.findIndex((c, i) => !used.has(i) && c.resourceId !== undefined && c.resourceId === a.resourceId);
    if (idx >= 0) { used.add(idx); out.set(a.id, contours[idx]); }
  }
  if (out.size === 0 && contours.length === 1 && assignments.length === 1 && contours[0].resourceId === undefined) {
    out.set(assignments[0].id, contours[0]);
  }
  return out;
}

// ── Herschaling bij bewerken ─────────────────────────────────────────────────────────────────────

/**
 * Herschaal een contourprofiel wanneer de werkduur van de taak van `oldWorkMinutes` naar
 * `newWorkMinutes` gaat (de duur zoals de solver hem rekent: zuivere werkminuten, zonder gaten).
 *
 * REGEL (MS Project-gedrag bij een duurwijziging op een "Contoured" toewijzing — MSP rekt of
 * krimpt de contour proportioneel mee met de nieuwe duur; hier overgenomen als ontwerpregel, er is
 * nog geen bewerken-meetlat tegen MSP zelf, zie de taaktypes-spec §"bewerken-meetlat"):
 *  - de as wordt proportioneel gerekt/gekrompen: elke `afterMinutes`/`minutes` × factor, dus ook de
 *    gaten schuiven en groeien mee (ze zijn onderdeel van dezelfde as — `rescaleSplitGaps` doet
 *    hetzelfde met `Task.splitGaps` zodat CPM en lastlezers dezelfde vorm zien);
 *  - `workMinutes` schaalt mee (werk = duur × inzet, het FIXED_UNITS-default van MSP én de
 *    bouwdefault van OPS) — BEHALVE bij `mspTaskType === 'FIXED_WORK'`: dan blijft het werk staan
 *    en daalt/stijgt alleen de dichtheid (de inzet per dag);
 *  - periodes van `kind: 'actual'` (al verricht werk) blijven ONGEWIJZIGD staan; alleen het deel
 *    van de as ná het einde van het laatste actual-record wordt herschaald, met een factor die op
 *    dát resterende deel is berekend (oud restant = `oldWorkMinutes − actual-werktijd`).
 * De factor is `newWork/oldWork` op het herschaalbare deel; is dat oude deel ≤ 0 of zijn de
 * invoerwaarden niet bruikbaar, dan komt het profiel ongewijzigd terug (nooit een NaN-profiel).
 */
export function rescaleContourForDuration(
  periods: readonly TimephasedContourPeriod[],
  oldWorkMinutes: number,
  newWorkMinutes: number,
  taskType?: MspTaskType,
): TimephasedContourPeriod[] {
  const factorInfo = rescaleFactor(periods, oldWorkMinutes, newWorkMinutes);
  if (!factorInfo) return periods.map((p) => ({ ...p }));
  const { anchor, factor } = factorInfo;
  const keepWork = taskType === 'FIXED_WORK';
  return periods.map((p) => {
    if (p.kind === 'actual' || !Number.isFinite(p.afterMinutes) || !Number.isFinite(p.minutes)) return { ...p };
    const start = Math.max(anchor, p.afterMinutes);
    const newAfter = anchor + (start - anchor) * factor;
    const newMinutes = p.minutes * factor;
    return {
      afterMinutes: newAfter,
      minutes: newMinutes,
      workMinutes: keepWork ? p.workMinutes : p.workMinutes * factor,
      kind: p.kind,
    };
  });
}

/** Dezelfde herschaling voor `Task.splitGaps` (alleen IMPORTsplits — gaten zonder `source`;
 *  nivelleergaten hebben hun eigen levenscyclus, `clearLevelingGaps`). `anchor`/`factor` komen uit
 *  het contourprofiel van dezelfde taak (`rescaleFactor`) zodat CPM-gaten en lastlezer-gaten niet
 *  uit elkaar lopen. Zonder profiel (geen contour) blijft de lijst onaangeraakt. */
export function rescaleSplitGaps(
  gaps: readonly TaskSplitGap[] | undefined,
  periods: readonly TimephasedContourPeriod[],
  oldWorkMinutes: number,
  newWorkMinutes: number,
): TaskSplitGap[] | undefined {
  if (!gaps || gaps.length === 0) return gaps ? [...gaps] : gaps;
  const factorInfo = rescaleFactor(periods, oldWorkMinutes, newWorkMinutes);
  if (!factorInfo) return gaps.map((g) => ({ ...g }));
  const { anchor, factor } = factorInfo;
  return gaps.map((g) => {
    if (g.source === 'leveling' || !Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes)) return { ...g };
    if (g.afterMinutes < anchor) return { ...g }; // gat in het reeds verrichte deel — blijft staan
    return { ...g, afterMinutes: anchor + (g.afterMinutes - anchor) * factor, gapMinutes: g.gapMinutes * factor };
  });
}

/** Anker (aseinde van het laatste actual-record, 0 zonder actuals) en factor voor de herschaling;
 *  `null` wanneer er niets zinnigs te herschalen valt. */
export function rescaleFactor(
  periods: readonly TimephasedContourPeriod[],
  oldWorkMinutes: number,
  newWorkMinutes: number,
): { anchor: number; factor: number } | null {
  if (!Number.isFinite(oldWorkMinutes) || !Number.isFinite(newWorkMinutes) || newWorkMinutes <= 0) return null;
  let anchor = 0;
  let actualWork = 0;
  for (const p of usablePeriods(periods)) {
    if (p.kind !== 'actual') continue;
    anchor = Math.max(anchor, p.afterMinutes + p.minutes);
    if (p.workMinutes > 0) actualWork += p.minutes;
  }
  const oldRest = oldWorkMinutes - actualWork;
  const newRest = newWorkMinutes - actualWork;
  if (!(oldRest > 0) || !(newRest > 0)) return null;
  const factor = newRest / oldRest;
  if (!Number.isFinite(factor) || factor <= 0) return null;
  if (Math.abs(factor - 1) < 1e-12) return null;
  return { anchor, factor };
}

/** Werkduur van een taak in werkminuten zoals de solver hem rekent (spiegelt `duration.ts`'s
 *  `durationMinutesOf`, maar zonder engine-object: de aanroeper geeft de `hoursPerDay` van de
 *  taakkalender mee). Uren-taak ⇒ `durationMinutes` (bron van waarheid), anders dagen × mpd. */
export function taskWorkMinutes(
  time: { durationUnit?: 'days' | 'hours'; durationMinutes?: number; scheduleDuration: number },
  hoursPerDay: number,
): number {
  if (time.durationUnit === 'hours' && typeof time.durationMinutes === 'number' && Number.isFinite(time.durationMinutes)) {
    return Math.max(0, time.durationMinutes);
  }
  return Math.max(0, time.scheduleDuration) * Math.max(0, hoursPerDay) * 60;
}
