/**
 * Ingang van het Rust-commando `place_file_exclusive` (#804, knownbug 1131, stap 3):
 * één bestand exclusief onder een nieuwe naam in dezelfde map plaatsen. Faalt als er op de nieuwe
 * naam al iets staat, in één systeemstap; nooit een terugval (`src-tauri/src/commands/place_file.rs`).
 *
 * Het commando weigert tenzij beide paden absoluut zijn, in dezelfde map staan, precies één van beide
 * namen een eigen hulpbestand is (`save-<id>.ops-save.tmp` of `<naam>.ops-vorige-<id>`) en plugin-fs
 * `rename` beide paden voor deze webview toelaat. Wat het plaatst, is de bron die het controleerde
 * (open map, open bron, controle na de stap). Buiten Tauri: altijd `unsupported`.
 *
 * Nog door geen route gebruikt; Opslaan als en Ctrl+S op de desktop (stap 4 en 5) bouwen erop.
 */

import { isTauri } from '@/utils/platform';

/** Welke controle van het commando weigerde. Gelijk aan `RefusalReason` in `place_file.rs`. */
export type PlaceFileRefusal = 'path-shape' | 'helper-name' | 'scope' | 'not-regular-file';

/**
 * Elke uitkomst, op `code`. Gelijk aan `PlaceOutcome` en `PlaceError` in `place_file.rs`; de proef
 * `place_file_uitkomsten_hebben_vaste_codes` legt de Rust-kant vast.
 * - `placed`: geplaatst en de map vastgelegd.
 * - `dir-not-synced`: geplaatst, maar de fsync van de map mislukte. Het bestand ís verplaatst.
 * - `target-exists`: op het doel stond al iets; beide bestanden onaangeroerd.
 * - `unsupported`: het bestandssysteem of platform kent de exclusieve stap niet; niets verplaatst.
 * - `refused`: een controle weigerde vóór elke wijziging.
 * - `source-changed`: tussen controle en stap is de bron of de map gewisseld; niet geplaatst. `restored`
 *   zegt of het commando het verplaatste exclusief terugzette (anders staat het op het doel).
 * - `io`: een andere systeemfout; niets verplaatst.
 */
export type PlaceFileOutcome =
  | { code: 'placed' }
  | { code: 'dir-not-synced'; message: string }
  | { code: 'target-exists' }
  | { code: 'unsupported'; message: string }
  | { code: 'refused'; reason: PlaceFileRefusal }
  | { code: 'source-changed'; restored: boolean }
  | { code: 'io'; message: string };

const REFUSALS: readonly string[] = ['path-shape', 'helper-name', 'scope', 'not-regular-file'] satisfies PlaceFileRefusal[];

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
    case 'source-changed':
      if (typeof record.restored === 'boolean') return { code: 'source-changed', restored: record.restored };
      break;
  }
  return { code: 'io', message };
}

/** Verplaats `from` exclusief naar `to` (beide absolute paden in dezelfde map). */
export async function placeFileExclusive(from: string, to: string): Promise<PlaceFileOutcome> {
  if (!isTauri()) return { code: 'unsupported', message: 'not-tauri' };
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return toPlaceFileOutcome(await invoke('place_file_exclusive', { from, to }));
  } catch (error) {
    return toPlaceFileOutcome(error);
  }
}
