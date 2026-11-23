import { isTauri } from '@/utils/platform';

/** Welke controle van het commando weigerde. Gelijk aan `RefusalReason` in `place_file.rs`. */
export type PlaceFileRefusal = 'path-shape' | 'helper-name' | 'scope' | 'not-regular-file' | 'hard-linked';

/**
 * Elke uitkomst, op `code`. Gelijk aan `PlaceOutcome` en `PlaceError` in `place_file.rs`; de proef
 * `place_file_uitkomsten_hebben_vaste_codes` legt de Rust-kant vast.
 * - `placed`: geplaatst en de map vastgelegd.
 * - `dir-not-synced`: geplaatst, maar de fsync van de map mislukte. Het bestand ís verplaatst.
 * - `target-exists`: op het doel stond al iets; beide bestanden onaangeroerd.
 * - `unsupported`: het bestandssysteem of platform kent de exclusieve stap niet; niets verplaatst.
 * - `refused`: een controle weigerde vóór elke wijziging.
 * - `source-changed`: na de stap stond op het doel niet de gecontroleerde bron; het commando raakte
 *   daarna niets meer aan. Of al vóór de stap: de open bron had geen naam meer (nul namen), er is niets
 *   verplaatst. Belooft geen stand op schijf: leid er geen eigendom of opruimen uit af.
 * - `io`: een andere systeemfout; niets verplaatst, behalve op een netwerkschijf die de fout pas na de
 *   hernoeming meldt (knownbug 1795).
 */
export type PlaceFileOutcome =
  | { code: 'placed' }
  | { code: 'dir-not-synced'; message: string }
  | { code: 'target-exists' }
  | { code: 'unsupported'; message: string }
  | { code: 'refused'; reason: PlaceFileRefusal }
  | { code: 'source-changed' }
  | { code: 'io'; message: string };

const REFUSALS: readonly string[] = ['path-shape', 'helper-name', 'scope', 'not-regular-file', 'hard-linked'] satisfies PlaceFileRefusal[];

function describe(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}

/** Lees de waarde die het commando teruggaf (of waarmee het weigerde); al het andere is `io`. */
function toPlaceFileOutcome(value: unknown): PlaceFileOutcome {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const message = typeof record.message === 'string' ? record.message : describe(value);
  switch (record.code) {
    case 'placed':
    case 'target-exists':
    case 'source-changed':
      return { code: record.code };
    case 'dir-not-synced':
    case 'unsupported':
    case 'io':
      return { code: record.code, message };
    case 'refused':
      if (typeof record.reason === 'string' && REFUSALS.includes(record.reason)) {
        return { code: 'refused', reason: record.reason as PlaceFileRefusal };
      }
      break;
  }
  return { code: 'io', message };
}

/** Verplaats `from` exclusief naar `to` (beide absolute paden in dezelfde map). */
export async function placeFileExclusive(from: string, to: string, beside?: string): Promise<PlaceFileOutcome> {
  if (!isTauri()) return { code: 'unsupported', message: 'not-tauri' };
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return toPlaceFileOutcome(await invoke('place_file_exclusive', beside === undefined ? { from, to } : { from, to, beside }));
  } catch (error) {
    return toPlaceFileOutcome(error);
  }
}
