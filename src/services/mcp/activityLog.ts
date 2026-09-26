// MCP-bridge — AI-activiteitenlog (voedt het AI-activiteitenpaneel).
//
// Een eigen ring-buffer (cap 500) van `ActivityEntry`, met exact het subscribe-patroon van de
// bestaande log-bus (`src/services/debug/appLog`) — maar volledig los ervan: de debug-terminal blijft
// ongemoeid, dit is een aparte feed die alleen door de MCP-request-wiring (`server.ts`) gevoed wordt.
// De React-kant (`AIActivityPanel`) leest 'm via `useSyncExternalStore` (subscribe + getEntries).
//
// De zware velden (`argsJson`/`resultJson`) worden defensief afgekapt op 20 kB per veld: de wiring
// kapt ze al af, maar `record` garandeert het als laatste linie zodat één uitschieter het paneel
// (en het geheugen) nooit kan opblazen. Afkappen is idempotent (dubbel afkappen = zelfde resultaat).

import type { ActivityEntry } from './contracts';

/** Ring-buffer-capaciteit: hooguit de 500 nieuwste aanroepen blijven bewaard. */
export const MAX_ENTRIES = 500;

/** Maximale grootte per JSON-veld (`argsJson`/`resultJson`) vóór afkappen. */
export const FIELD_CAP = 20 * 1024; // 20 kB

/** Marker die aan een afgekapt veld wordt geplakt zodat de UI de afkapping toont. */
export const TRUNCATE_MARKER = '… afgekapt';

let buffer: ActivityEntry[] = [];
const listeners = new Set<(entries: ActivityEntry[]) => void>();

/**
 * Kap een JSON-veld af op `FIELD_CAP` en plak de afkap-marker eraan. Idempotent: een al-afgekapte
 * string (die op de marker eindigt en ≤ CAP+marker lang is) verandert bij een tweede aanroep niet
 * van betekenis — het eerste `FIELD_CAP`-segment blijft identiek plus dezelfde marker.
 */
export function capField(s: string): string {
  if (s.length <= FIELD_CAP) return s;
  return s.slice(0, FIELD_CAP) + TRUNCATE_MARKER;
}

function notify(): void {
  // slice() → subscribers krijgen een stabiele snapshot-referentie (nieuwe array per notify).
  const snapshot = buffer.slice();
  for (const fn of listeners) {
    try { fn(snapshot); }
    catch { /* een kapotte consumer mag de feed niet platleggen */ }
  }
}

/**
 * Voeg één entry toe. De zware velden worden defensief afgekapt (laatste linie — de wiring hoort ze
 * al af te kappen). Bij overschrijden van `MAX_ENTRIES` valt de oudste entry (index 0) eruit.
 */
export function record(entry: ActivityEntry): void {
  const capped: ActivityEntry = {
    ...entry,
    argsJson: capField(entry.argsJson),
    resultJson: capField(entry.resultJson),
  };
  buffer.push(capped);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  notify();
}

/** Momentopname (oudste → nieuwste) van de huidige buffer. */
export function getEntries(): ActivityEntry[] {
  return buffer.slice();
}

/** Leeg de buffer en notificeer de subscribers. */
export function clear(): void {
  buffer = [];
  notify();
}

/** Abonneer op wijzigingen; geeft een unsubscribe-callback terug (log-bus-patroon). */
export function subscribe(fn: (entries: ActivityEntry[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
