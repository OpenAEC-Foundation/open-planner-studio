export interface ContourPhase {
  days: number;
  unitsPerDay: number;
}

const UNITS_EPS = 0.005;

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

export function phasesTotalDays(phases: readonly ContourPhase[]): number {
  return phases.reduce((a, p) => a + Math.max(0, Math.floor(p.days)), 0);
}

export function phaseStartDay(phases: readonly ContourPhase[], index: number): number {
  let day = 0;
  for (let i = 0; i < index && i < phases.length; i++) day += Math.max(0, Math.floor(phases[i].days));
  return day;
}

export function splitPhase(phases: readonly ContourPhase[], index: number, afterDays: number): ContourPhase[] {
  const p = phases[index];
  if (!p) return [...phases];
  const at = Math.floor(afterDays);
  if (!(at >= 1 && at < p.days)) return [...phases];
  const out = [...phases];
  out.splice(index, 1, { days: at, unitsPerDay: p.unitsPerDay }, { days: p.days - at, unitsPerDay: p.unitsPerDay });
  return out;
}

export function mergePhaseWithNext(phases: readonly ContourPhase[], index: number): ContourPhase[] {
  if (index < 0 || index >= phases.length - 1) return [...phases];
  const out = [...phases];
  out.splice(index, 2, { days: phases[index].days + phases[index + 1].days, unitsPerDay: phases[index].unitsPerDay });
  return out;
}

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

export function setPhaseUnits(phases: readonly ContourPhase[], index: number, unitsPerDay: number): ContourPhase[] {
  if (index < 0 || index >= phases.length) return [...phases];
  const out = [...phases];
  out[index] = { ...phases[index], unitsPerDay: Number.isFinite(unitsPerDay) && unitsPerDay > 0 ? unitsPerDay : 0 };
  return out;
}

export function setPhaseDays(phases: readonly ContourPhase[], index: number, days: number): ContourPhase[] {
  if (index < 0 || index >= phases.length - 1) return [...phases];
  return movePhaseBoundary(phases, index, phaseStartDay(phases, index) + Math.floor(days));
}

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
