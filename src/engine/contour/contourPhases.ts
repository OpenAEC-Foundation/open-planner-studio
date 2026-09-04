// contourPhases.ts — het FASENmodel van de contour-editor (etappe "fasen-editor", 2026-09).
//
// WAT DIT IS. Een planner denkt niet in "maandag 1,6 uur, dinsdag 9,2 uur" maar in fasen: "de
// eerste twee weken een halve ploeg, daarna de volle ploeg". Een fase is een aaneengesloten reeks
// WERKdagen van de taak met één vaste inzet (eenheden per dag). Een contour is in dit model een
// korte lijst fasen die samen precies de werkdagen van de toewijzing dekken. Dit bestand vertaalt
// tussen die fasen en de werkdagslots van `contourEdit.ts` (werkminuten per werkdag):
//   - `phasesFromSlots`: run-length-codering — opeenvolgende dagen met (nagenoeg) dezelfde inzet
//     vormen één fase. Een uniforme verdeling is dus één fase; een per dag variërende import
//     wordt in het slechtste geval één fase per dag (nooit méér dan het oude dagenmodel).
//   - `slotsFromPhases`: de inverse — elke fase levert `days` slots van `unitsPerDay × mpd`.
//   - bewerkingen: splitsen, samenvoegen, een grens verschuiven (de buur neemt de dagen op, het
//     totaal aantal dagen blijft gelijk) en de inzet zetten.
// Alle functies zijn puur en geven verse arrays terug; ongeldige invoer wordt begrensd, nooit
// gegooid (de UI valideert, dit is de tweede grendel).
//
// WAAROM GEEN NIEUW DATAMODEL. `TimephasedContourPeriod` heeft al een eigen lengte per periode, en
// `periodsToSlotWork` verdeelt een periode over meerdere dagslots. Een fase van tien dagen KAN dus
// als één periode worden opgeslagen. Deze etappe doet dat bewust nog niet: de opslagvorm blijft
// één periode per werkdag (`workDaySlotsToPeriods`), zodat de MSPDI-/P6-/IFC-round-trips en de
// lastlezers byte-identiek blijven en de fasen een zuivere WEERGAVE-laag zijn. Terug lezen gaat
// via run-length, dus een opgeslagen contour komt als dezelfde fasen terug.
export interface ContourPhase {
  /** Aantal WERKdagen van deze fase (geheel, ≥ 1). */
  days: number;
  /** Inzet in eenheden per dag (≥ 0; 1 = één persoon/stuk voltijds, 0 = geen werk). */
  unitsPerDay: number;
}

/** Tolerantie waarbinnen twee daginzetten als gelijk gelden bij het samenvouwen tot een fase —
 *  op honderdsten van een eenheid, dezelfde precisie als de UI toont en `distributeUnits` bij een
 *  fractioneel tempo aanhoudt. */
const UNITS_EPS = 0.005;

/** Werkminuten per werkdagslot → fasen (run-length over de inzet per dag). Leeg ⇒ geen fasen. */
export function phasesFromSlots(slotWork: readonly number[], slotMinutes: number): ContourPhase[] {
  const mpd = Math.max(1, slotMinutes);
  const out: ContourPhase[] = [];
  for (const w of slotWork) {
    const units = Number.isFinite(w) && w > 0 ? w / mpd : 0;
    const last = out[out.length - 1];
    if (last && Math.abs(last.unitsPerDay - units) <= UNITS_EPS) last.days += 1;
    else out.push({ days: 1, unitsPerDay: units });
  }
  return out;
}

/** Fasen → werkminuten per werkdagslot (inverse van `phasesFromSlots`). */
export function slotsFromPhases(phases: readonly ContourPhase[], slotMinutes: number): number[] {
  const mpd = Math.max(1, slotMinutes);
  const out: number[] = [];
  for (const p of phases) {
    const days = Math.max(0, Math.floor(p.days));
    const w = Number.isFinite(p.unitsPerDay) && p.unitsPerDay > 0 ? p.unitsPerDay * mpd : 0;
    for (let i = 0; i < days; i++) out.push(w);
  }
  return out;
}

/** Totaal aantal werkdagen dat de fasen dekken. */
export function phasesTotalDays(phases: readonly ContourPhase[]): number {
  return phases.reduce((a, p) => a + Math.max(0, Math.floor(p.days)), 0);
}

/** Werkdagindex (0-gebaseerd) waarop fase `index` begint. */
export function phaseStartDay(phases: readonly ContourPhase[], index: number): number {
  let day = 0;
  for (let i = 0; i < index && i < phases.length; i++) day += Math.max(0, Math.floor(phases[i].days));
  return day;
}

/**
 * Splits fase `index` in tweeën ná `afterDays` dagen (1 ≤ afterDays < days); beide helften houden
 * de inzet. Een fase van één dag of een ongeldige positie ⇒ ongewijzigd terug.
 */
export function splitPhase(phases: readonly ContourPhase[], index: number, afterDays: number): ContourPhase[] {
  const p = phases[index];
  if (!p) return [...phases];
  const at = Math.floor(afterDays);
  if (!(at >= 1 && at < p.days)) return [...phases];
  const out = [...phases];
  out.splice(index, 1, { days: at, unitsPerDay: p.unitsPerDay }, { days: p.days - at, unitsPerDay: p.unitsPerDay });
  return out;
}

/** Voegt fase `index` samen met de volgende; de samengevoegde fase houdt de inzet van `index`
 *  (de linker). Laatste fase of ongeldige index ⇒ ongewijzigd. */
export function mergePhaseWithNext(phases: readonly ContourPhase[], index: number): ContourPhase[] {
  if (index < 0 || index >= phases.length - 1) return [...phases];
  const out = [...phases];
  out.splice(index, 2, { days: phases[index].days + phases[index + 1].days, unitsPerDay: phases[index].unitsPerDay });
  return out;
}

/**
 * Verschuift de grens NÁ fase `index` naar werkdag `boundaryDay` (0-gebaseerde dagindex van de
 * eerste dag van de volgende fase). De fase en haar rechterbuur wisselen dagen uit; het totaal
 * blijft gelijk en elke fase houdt minstens één dag. Bij de laatste fase is er geen buur en gebeurt
 * niets — het totaal aantal dagen is de duur van de taak, niet iets wat de contour bepaalt.
 */
export function movePhaseBoundary(phases: readonly ContourPhase[], index: number, boundaryDay: number): ContourPhase[] {
  if (index < 0 || index >= phases.length - 1) return [...phases];
  const start = phaseStartDay(phases, index);
  const pair = phases[index].days + phases[index + 1].days;
  const left = Math.min(pair - 1, Math.max(1, Math.round(boundaryDay) - start));
  if (left === phases[index].days) return [...phases];
  const out = [...phases];
  out[index] = { ...phases[index], days: left };
  out[index + 1] = { ...phases[index + 1], days: pair - left };
  return out;
}

/** Zet de inzet van fase `index` (niet-eindig of negatief ⇒ 0). */
export function setPhaseUnits(phases: readonly ContourPhase[], index: number, unitsPerDay: number): ContourPhase[] {
  if (index < 0 || index >= phases.length) return [...phases];
  const out = [...phases];
  out[index] = { ...phases[index], unitsPerDay: Number.isFinite(unitsPerDay) && unitsPerDay > 0 ? unitsPerDay : 0 };
  return out;
}

/**
 * Zet het aantal dagen van fase `index` op `days` en laat de RECHTERbuur het verschil opvangen
 * (dezelfde regel als `movePhaseBoundary`). Voor de laatste fase gebeurt niets: haar lengte is het
 * restant van de taakduur.
 */
export function setPhaseDays(phases: readonly ContourPhase[], index: number, days: number): ContourPhase[] {
  if (index < 0 || index >= phases.length - 1) return [...phases];
  return movePhaseBoundary(phases, index, phaseStartDay(phases, index) + Math.floor(days));
}

/**
 * Brengt de fasen op precies `totalDays` werkdagen: te lang ⇒ de laatste fasen worden afgekapt;
 * te kort ⇒ de laatste fase wordt verlengd (of, zonder fasen, één fase met `fillUnits`). Gebruikt
 * bij het openen (een opgeslagen contour kan langer of korter zijn dan de huidige duur).
 */
export function fitPhasesToDays(phases: readonly ContourPhase[], totalDays: number, fillUnits: number): ContourPhase[] {
  const target = Math.max(0, Math.floor(totalDays));
  const out: ContourPhase[] = [];
  let used = 0;
  for (const p of phases) {
    if (used >= target) break;
    const days = Math.min(Math.max(0, Math.floor(p.days)), target - used);
    if (days > 0) { out.push({ days, unitsPerDay: p.unitsPerDay }); used += days; }
  }
  if (used < target) {
    if (out.length > 0) out[out.length - 1] = { ...out[out.length - 1], days: out[out.length - 1].days + (target - used) };
    else if (target > 0) out.push({ days: target, unitsPerDay: Math.max(0, fillUnits) });
  }
  return out;
}
