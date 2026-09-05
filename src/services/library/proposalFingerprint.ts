// proposalFingerprint.ts — B1c-plan3 taak 4 (spec §6a).
//
/**
 * Vingerafdruk van de documentstate waarop een verdelingsvoorstel gerekend heeft (spec §6a).
 *
 * Referentie-gebaseerd, met opzet: Immer bevriest de state na elke producer en levert bij elke
 * mutatie een NIEUWE referentie voor het gemuteerde deel. Een vergelijking op inhoud zou duurder én
 * zwakker zijn (een gelijk-ogende takenlijst na een undo/redo is niet dezelfde planning).
 *
 * De velden zijn precies wat `computeDistribution` leest: de taken (datums, delays, gaten, prioriteit),
 * de relaties, de resources en toewijzingen (wie boekt), de kalenders, het project (statusdatum,
 * voortgangsmodus, planningsopties, bibliotheekkoppeling) en `cpmResult` (de doorgerekende cijfers
 * waar §3.1 op staat), plus `scheduleStale`/`datesAsRecorded` (§3.1/§3.3a bepalen mee of een document
 * meetelt). Groeit die leeslijst, dan groeit deze functie mee — anders overleeft een voorstel een
 * bewerking die het wél ongeldig maakt.
 *
 * Puur, geen store-import (bewaakt door `verify:store-boundaries`).
 */
export interface FingerprintInput {
  tasks: unknown;
  sequences: unknown;
  resources: unknown;
  assignments: unknown;
  calendar: unknown;
  calendars: unknown;
  project: unknown;
  cpmResult: unknown;
  scheduleStale: unknown;
  datesAsRecorded: unknown;
}

const FINGERPRINT_KEYS: readonly (keyof FingerprintInput)[] = [
  'tasks', 'sequences', 'resources', 'assignments', 'calendar', 'calendars',
  'project', 'cpmResult', 'scheduleStale', 'datesAsRecorded',
];

// Eén WeakMap + oplopende teller per proces: goedkoop te vergelijken id's zonder de geziene objecten
// zelf vast te houden (de WeakMap laat ze vrij zodra niemand anders ze meer refereert). Primitieven
// (booleans, null) kunnen niet als WeakMap-sleutel dienen en worden daarom letterlijk in de string
// opgenomen — hun WAARDE is dan zelf het onderscheid (bv. `scheduleStale` van false naar true).
const refIds = new WeakMap<object, number>();
let nextRefId = 1;

function idFor(value: unknown): string {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    let id = refIds.get(value as object);
    if (id === undefined) {
      id = nextRefId++;
      refIds.set(value as object, id);
    }
    return `r${id}`;
  }
  return `p${String(value)}`;
}

/** Bouw de vingerafdruk. `mutationSeq` is de grofmazige backstop van `StoreRuntime.mutationSeq()`. */
export function documentFingerprint(d: FingerprintInput, mutationSeq: number): string {
  const parts = FINGERPRINT_KEYS.map((k) => idFor(d[k]));
  parts.push(`m${mutationSeq}`);
  return parts.join('|');
}
